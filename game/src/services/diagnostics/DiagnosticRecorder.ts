// BETA-FINAL PR11 / spec B8 - the renderer-side diagnostic recorder.
//
// record() runs every candidate event through the shared allowlist
// validator BEFORE it touches the ring, the transport, or the crash
// reporter - an unvalidated event never leaves this process. The ring is
// bounded (oldest events drop past maxEntries), transport/reporter failures
// are swallowed, and the module-level binding lets any layer record without
// prop drilling while remaining a no-op when nothing is bound (tests, web
// fallback before boot wires the Electron transport).

import {
  DEFAULT_DIAGNOSTIC_BOUNDS,
  validateDiagnosticEvent,
  type DiagnosticBounds,
  type DiagnosticCategory,
  type DiagnosticEvent,
  type DiagnosticSeverity,
  type DiagnosticSource,
} from '../../shared/diagnostics/DiagnosticEvent'
import type { CrashReporter, CrashReportRecord } from './CrashReporter'

export interface DiagnosticContextProviders {
  routeProvider?: () => string | undefined
  revisionProvider?: () => number | undefined
  /** Hash of the cached raw save - coarse corruption signal for exports. */
  saveHashProvider?: () => Promise<string | undefined> | string | undefined
  correlationId?: string
  /** Stable report id shown on error surfaces; bridge-supplied on Electron. */
  reportId?: string
}

export interface DiagnosticRecorderDeps extends DiagnosticContextProviders {
  bounds?: Partial<DiagnosticBounds>
  nowUtc?: () => string
  /** Best-effort forwarder (IPC to main on Electron). Never throws upward. */
  transport?: (event: DiagnosticEvent) => void
  /** Provider boundary; receives redacted records for error/fatal events. */
  reporter?: CrashReporter
  randomId?: () => string
}

export interface RecordErrorBase {
  category: DiagnosticCategory
  code: string
  severity?: DiagnosticSeverity
  source?: DiagnosticSource
  correlationId?: string
  details?: Readonly<Record<string, string | number | boolean | null>>
}

export class DiagnosticRecorder {
  private readonly bounds: DiagnosticBounds
  private readonly nowUtc: () => string
  private readonly transport?: (event: DiagnosticEvent) => void
  private readonly reporter?: CrashReporter
  private readonly ring: DiagnosticEvent[] = []
  private seq = 0
  private dropped = 0
  private invalid = 0
  private context: DiagnosticContextProviders
  private readonly fallbackReportId: string

  constructor(deps: DiagnosticRecorderDeps = {}) {
    this.bounds = { ...DEFAULT_DIAGNOSTIC_BOUNDS, ...deps.bounds }
    this.nowUtc = deps.nowUtc ?? (() => new Date().toISOString())
    this.transport = deps.transport
    this.reporter = deps.reporter
    this.context = {
      routeProvider: deps.routeProvider,
      revisionProvider: deps.revisionProvider,
      saveHashProvider: deps.saveHashProvider,
      correlationId: deps.correlationId,
      reportId: deps.reportId,
    }
    this.fallbackReportId = deps.randomId?.() ?? `local-${Math.random().toString(36).slice(2)}`
  }

  /** Late-bound context (App.vue wires route/save-revision after boot). */
  bindContext(providers: Partial<DiagnosticContextProviders>): void {
    this.context = { ...this.context, ...providers }
  }

  get reportId(): string {
    return this.context.reportId ?? this.fallbackReportId
  }

  get events(): readonly DiagnosticEvent[] {
    return this.ring
  }

  get droppedCount(): number {
    return this.dropped
  }

  get invalidCount(): number {
    return this.invalid
  }

  record(input: unknown): DiagnosticEvent | null {
    // Diagnostics sit inside save/error/session paths: a throwing provider
    // or an unforeseen failure must degrade to a dropped event, never a
    // crash for the game.
    try {
      return this.recordUnsafe(input)
    } catch {
      this.invalid += 1
      return null
    }
  }

  private recordUnsafe(input: unknown): DiagnosticEvent | null {
    const validated = validateDiagnosticEvent(input, this.bounds)
    if (!validated.ok) {
      this.invalid += 1
      return null
    }
    // Context-derived fields cross the same schema gate as caller input:
    // a bad provider result drops only the context fields (the caller's
    // event survives), never crashing or silently vanishing at append.
    let candidate = validated.event
    const merged = validateDiagnosticEvent(
      {
        ...candidate,
        route: candidate.route ?? safeProvide(this.context.routeProvider),
        correlationId: candidate.correlationId ?? this.context.correlationId,
        revision: candidate.revision ?? safeProvide(this.context.revisionProvider),
        reportId: candidate.reportId ?? this.reportId,
      },
      this.bounds,
    )
    if (merged.ok) candidate = merged.event

    const event: DiagnosticEvent = {
      ...candidate,
      seq: candidate.seq ?? ++this.seq,
      atUtc: candidate.atUtc ?? this.nowUtc(),
    }
    this.seq = Math.max(this.seq, event.seq)
    this.ring.push(event)
    while (this.ring.length > this.bounds.maxEntries) {
      this.ring.shift()
      this.dropped += 1
    }

    // Exactly one sink per event: error/fatal records go through the
    // provider boundary (LocalBundleCrashReporter in production - its sink
    // is the same IPC forwarder, so nothing is written twice); the rest
    // flow through the trail transport.
    const crash =
      event.severity === 'error' || event.severity === 'fatal'
    if (crash && this.reporter !== undefined) {
      const record: CrashReportRecord = { ...event, reportId: this.reportId }
      try {
        this.reporter.capture(record)
      } catch {
        // Diagnostics never take the game down.
      }
    } else if (this.transport !== undefined) {
      try {
        this.transport(event)
      } catch {
        // Diagnostics never take the game down.
      }
    }
    return event
  }

  /** Manifest metadata for a bundle export (revision + save hash). */
  async collectExportContext(): Promise<{ revision?: number; saveHash?: string }> {
    let saveHash: string | undefined
    try {
      saveHash = await this.context.saveHashProvider?.()
    } catch {
      saveHash = undefined
    }
    return { revision: safeProvide(this.context.revisionProvider), saveHash }
  }

  /** Error path helper: name/message/stack are extracted and scrubbed. */
  recordError(error: unknown, base: RecordErrorBase): DiagnosticEvent | null {
    const details: Record<string, string | number | boolean | null> = {
      ...base.details,
    }
    let message: string
    let stack: string | undefined
    try {
      if (error instanceof Error) {
        details.errorName = error.name
        message = error.message || error.name
        stack = error.stack
      } else {
        message = typeof error === 'string' ? error : safeStringify(error)
      }
    } catch {
      message = 'error (unreadable)'
    }
    return this.record({
      source: base.source ?? 'renderer',
      severity: base.severity ?? 'error',
      category: base.category,
      code: base.code,
      message,
      stack,
      correlationId: base.correlationId,
      details,
    })
  }
}

/** Context providers are app-internal but still fallible - a throw drops
 *  that one field instead of the whole event. */
function safeProvide<T>(provider: (() => T) | undefined): T | undefined {
  try {
    return provider?.()
  } catch {
    return undefined
  }
}

function safeStringify(value: unknown): string {
  try {
    const text = JSON.stringify(value)
    return typeof text === 'string' ? text : String(value)
  } catch {
    return String(value)
  }
}

// ---------------------------------------------------------------------------
// Module binding (mirrors useOnlineAuthority's bind/observe idiom): the app
// binds one recorder at startup; every layer records through the bound one.
// ---------------------------------------------------------------------------

let bound: DiagnosticRecorder | null = null

export function bindDiagnosticRecorder(recorder: DiagnosticRecorder): DiagnosticRecorder {
  bound = recorder
  return recorder
}

export function unbindDiagnosticRecorder(): void {
  bound = null
}

export function getDiagnosticRecorder(): DiagnosticRecorder | null {
  return bound
}

export function recordDiagnostic(input: unknown): DiagnosticEvent | null {
  return bound?.record(input) ?? null
}

export function recordDiagnosticError(
  error: unknown,
  base: RecordErrorBase,
): DiagnosticEvent | null {
  return bound?.recordError(error, base) ?? null
}
