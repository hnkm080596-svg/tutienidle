// BETA-FINAL PR11 / spec B8 - the main-process diagnostic bundle.
//
// One instance owns the <userData>/diagnostics directory: a bounded NDJSON
// ring on disk (events.ndjson rotated through .1 ... .maxFiles-1), a stable
// per-install report id, and export() which serializes
// { manifest, summary, events } to a caller-chosen path.
//
// Guarantees that hold here:
//   - every persisted event passed validateDiagnosticEvent() (renderer events
//     are re-validated on arrival; malformed lines drop at append AND again
//     at export, so a corrupted/tampered file can never leak into a report);
//   - appends serialize through a single promise chain - concurrent writers
//     can never interleave a line;
//   - rotation keeps disk usage under maxFiles * maxFileBytes;
//   - denied disk access degrades to no-op/failed results - it never throws
//     into main and never exposes original payloads.
//
// The fs surface is injectable for deterministic tests; in production it is
// node:fs/promises.

import type { BuildIdentity } from '../shared/build/BuildIdentity'
import {
  DEFAULT_DIAGNOSTIC_BOUNDS,
  validateDiagnosticEvent,
  type DiagnosticBounds,
  type DiagnosticEvent,
} from '../shared/diagnostics/DiagnosticEvent'

export interface DiagnosticBundleFs {
  mkdir(dir: string, options?: { recursive?: boolean }): Promise<unknown>
  appendFile(path: string, data: string): Promise<void>
  readFile(path: string, encoding: 'utf8'): Promise<string>
  writeFile(path: string, data: string): Promise<void>
  rename(from: string, to: string): Promise<void>
  readdir(dir: string): Promise<string[]>
  stat(path: string): Promise<{ size: number }>
  unlink(path: string): Promise<void>
}

export interface DiagnosticBundlePlatform {
  platform: string
  arch: string
  osRelease: string
  osType: string
  versions: { electron?: string; chrome?: string; node?: string }
}

/** Coarse save metadata supplied by the renderer at export time. */
export interface DiagnosticExportContext {
  revision?: number
  saveHash?: string
}

export interface DiagnosticBundleDeps {
  directory: string
  identity: BuildIdentity
  bounds?: Partial<DiagnosticBounds>
  fs: DiagnosticBundleFs
  nowUtc?: () => string
  platform?: DiagnosticBundlePlatform
  randomId?: () => string
}

export interface DiagnosticBundleManifest {
  formatVersion: 1
  reportId: string
  createdAtUtc: string
  buildId: string
  productName: string
  appVersion: string
  gitSha: string
  saveSchemaVersion: number
  backendEnvironment: string
  releaseChannel: string
  builtAtUtc: string
  platform: DiagnosticBundlePlatform | null
  save: {
    schemaVersion: number
    revision: number | null
    hash: string | null
  }
  counts: {
    events: number
    truncatedEvents: number
  }
}

export interface DiagnosticBundleFile {
  manifest: DiagnosticBundleManifest
  summary: string
  events: DiagnosticEvent[]
}

export type DiagnosticExportResult =
  | { status: 'exported'; path: string; reportId: string; eventCount: number }
  | { status: 'denied' | 'failed'; code: string; reportId: string }

const LIVE_FILE = 'events.ndjson'
const REPORT_ID_FILE = 'report-id'
const REPORT_ID_RE = /^[A-Za-z0-9_.:-]{8,128}$/
const MAX_RECENT_ERROR_LINES = 10

function isNotFound(error: unknown): boolean {
  return (error as { code?: string }).code === 'ENOENT'
}

function isDenied(error: unknown): boolean {
  const code = (error as { code?: string }).code
  return code === 'EACCES' || code === 'EPERM'
}

export class DiagnosticBundle {
  private readonly directory: string
  private readonly identity: BuildIdentity
  private readonly bounds: DiagnosticBounds
  private readonly fs: DiagnosticBundleFs
  private readonly nowUtc: () => string
  private readonly platform: DiagnosticBundlePlatform | null
  private readonly randomId: () => string
  private queue: Promise<unknown> = Promise.resolve()
  private seq = 0
  private reportIdCache: string | null = null

  constructor(deps: DiagnosticBundleDeps) {
    this.directory = deps.directory
    this.identity = deps.identity
    this.bounds = { ...DEFAULT_DIAGNOSTIC_BOUNDS, ...deps.bounds }
    this.fs = deps.fs
    this.nowUtc = deps.nowUtc ?? (() => new Date().toISOString())
    this.platform = deps.platform ?? null
    this.randomId = deps.randomId ?? (() => crypto.randomUUID())
  }

  private livePath(index = 0): string {
    return index === 0
      ? `${this.directory}/${LIVE_FILE}`
      : `${this.directory}/${LIVE_FILE}.${index}`
  }

  /**
   * The stable per-install report id: read the minted file, mint + persist
   * on miss. Denied or unreadable disk falls back to an in-memory id that is
   * stable for the process lifetime - never retried per call, never thrown.
   */
  async reportId(): Promise<string> {
    if (this.reportIdCache !== null) return this.reportIdCache
    const path = `${this.directory}/${REPORT_ID_FILE}`
    try {
      const existing = (await this.fs.readFile(path, 'utf8')).trim()
      if (REPORT_ID_RE.test(existing)) {
        this.reportIdCache = existing
        return existing
      }
    } catch {
      // Missing or unreadable file - mint below.
    }
    const minted = this.randomId()
    this.reportIdCache = minted
    try {
      await this.fs.mkdir(this.directory, { recursive: true })
      await this.fs.writeFile(path, `${minted}\n`)
    } catch {
      // Denied disk: keep the in-memory id; never crash the game for it.
    }
    return minted
  }

  /**
   * Validate + persist one event. Returns false for rejected input or denied
   * disk - callers must not distinguish (logging the reason would risk
   * echoing the rejected payload).
   */
  async append(input: unknown): Promise<boolean> {
    const validated = validateDiagnosticEvent(input, this.bounds)
    if (!validated.ok) return false
    const event: DiagnosticEvent = {
      ...validated.event,
      seq: validated.event.seq ?? ++this.seq,
      atUtc: validated.event.atUtc ?? this.nowUtc(),
    }
    // Pre-stamped events (renderer assigns seq too) keep the counter
    // monotonic so later main-stamped events never reuse a lower seq.
    this.seq = Math.max(this.seq, event.seq)
    const work = this.queue.then(() => this.persistLine(event))
    this.queue = work.catch(() => undefined)
    return work
  }

  private async persistLine(event: DiagnosticEvent): Promise<boolean> {
    try {
      const line = `${JSON.stringify(event)}\n`
      await this.fs.mkdir(this.directory, { recursive: true })
      await this.rotateIfNeeded(line.length)
      await this.fs.appendFile(this.livePath(), line)
      return true
    } catch {
      return false
    }
  }

  private async rotateIfNeeded(incomingBytes: number): Promise<void> {
    let size = 0
    try {
      size = (await this.fs.stat(this.livePath())).size
    } catch (error) {
      if (!isNotFound(error)) throw error
    }
    if (size + incomingBytes <= this.bounds.maxFileBytes) return
    // Drop the oldest rotation, then shift .{n-1} -> .{n}, live -> .1.
    const oldest = this.livePath(this.bounds.maxFiles - 1)
    try {
      await this.fs.unlink(oldest)
    } catch (error) {
      if (!isNotFound(error)) throw error
    }
    for (let i = this.bounds.maxFiles - 1; i >= 1; i -= 1) {
      try {
        await this.fs.rename(this.livePath(i - 1), this.livePath(i))
      } catch (error) {
        if (!isNotFound(error)) throw error
      }
    }
  }

  /**
   * Serialize the persisted trail to `targetPath` via tmp+rename. The
   * renderer chooses the path through a save dialog only; it never supplies
   * content. An export-requested marker lands in the trail first so the
   * bundle explains its own existence.
   */
  async export(
    targetPath: string,
    context: DiagnosticExportContext = {},
  ): Promise<DiagnosticExportResult> {
    const reportId = await this.reportId()
    try {
      await this.append({
        source: 'main',
        severity: 'info',
        category: 'export',
        code: 'EXPORT_REQUESTED',
        message: `Diagnostic export requested to report ${reportId}`,
      })
      const { events, skipped } = await this.readEvents()
      const kept = events.slice(-this.bounds.maxBundleEvents)
      let truncated = skipped + (events.length - kept.length)
      const manifest = this.buildManifest(reportId, context, kept.length, truncated)
      let text = serializeBundle(manifest, kept)
      while (kept.length > 0 && byteLength(text) > this.bounds.maxBundleBytes) {
        kept.shift()
        truncated += 1
        const shrunk = this.buildManifest(reportId, context, kept.length, truncated)
        text = serializeBundle(shrunk, kept)
      }
      const tmpPath = `${targetPath}.tmp`
      await this.fs.writeFile(tmpPath, text)
      await this.fs.rename(tmpPath, targetPath)
      return { status: 'exported', path: targetPath, reportId, eventCount: kept.length }
    } catch (error) {
      return {
        status: isDenied(error) ? 'denied' : 'failed',
        code: (error as { code?: string }).code ?? 'unknown',
        reportId,
      }
    }
  }

  /** Read rotated files oldest-to-newest; malformed lines are dropped. */
  private async readEvents(): Promise<{ events: DiagnosticEvent[]; skipped: number }> {
    const events: DiagnosticEvent[] = []
    let skipped = 0
    const names: string[] = []
    for (let i = this.bounds.maxFiles - 1; i >= 1; i -= 1) {
      names.push(this.livePath(i))
    }
    names.push(this.livePath())
    for (const name of names) {
      let content: string
      try {
        content = await this.fs.readFile(name, 'utf8')
      } catch (error) {
        if (isNotFound(error)) continue
        throw error
      }
      for (const line of content.split('\n')) {
        if (line.trim() === '') continue
        try {
          const validated = validateDiagnosticEvent(JSON.parse(line), this.bounds)
          if (validated.ok) {
            events.push({ ...validated.event, seq: validated.event.seq ?? 0, atUtc: validated.event.atUtc ?? '' })
          } else {
            skipped += 1
          }
        } catch {
          skipped += 1
        }
      }
    }
    return { events, skipped }
  }

  private buildManifest(
    reportId: string,
    context: DiagnosticExportContext,
    eventCount: number,
    truncated: number,
  ): DiagnosticBundleManifest {
    return {
      formatVersion: 1,
      reportId,
      createdAtUtc: this.nowUtc(),
      buildId: this.identity.buildId,
      productName: this.identity.productName,
      appVersion: this.identity.appVersion,
      gitSha: this.identity.gitSha,
      saveSchemaVersion: this.identity.saveSchemaVersion,
      backendEnvironment: this.identity.backendEnvironment,
      releaseChannel: this.identity.releaseChannel,
      builtAtUtc: this.identity.builtAtUtc,
      platform: this.platform,
      save: {
        schemaVersion: this.identity.saveSchemaVersion,
        revision: context.revision ?? null,
        hash: context.saveHash ?? null,
      },
      counts: { events: eventCount, truncatedEvents: truncated },
    }
  }
}

/** A report id is safe-charset per REPORT_ID_RE, but ':' is still not a
 *  legal Windows filename char - strip it before any path use. */
export function sanitizeReportIdForFilename(id: string): string {
  return id.replace(/[^A-Za-z0-9_.-]/g, '_')
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

function buildSummary(manifest: DiagnosticBundleManifest, events: DiagnosticEvent[]): string {
  const p = manifest.platform
  const platformLine = p
    ? `${p.platform} ${p.osRelease} (${p.arch}) electron ${p.versions.electron ?? '-'} node ${p.versions.node ?? '-'}`
    : 'unknown (no platform probe)'
  const lines = [
    `${manifest.productName} - diagnostic report`,
    `Report: ${manifest.reportId}`,
    `Created: ${manifest.createdAtUtc}`,
    `Build: ${manifest.appVersion} (${manifest.buildId}) git ${manifest.gitSha.slice(0, 7)} env ${manifest.backendEnvironment} channel ${manifest.releaseChannel} built ${manifest.builtAtUtc}`,
    `Platform: ${platformLine}`,
    `Save: schema ${manifest.save.schemaVersion} revision ${manifest.save.revision ?? '-'} hash ${manifest.save.hash ?? '-'}`,
    `Events: ${manifest.counts.events} (truncated: ${manifest.counts.truncatedEvents})`,
  ]
  const recentErrors = events
    .filter((e) => e.severity === 'error' || e.severity === 'fatal')
    .slice(-MAX_RECENT_ERROR_LINES)
  if (recentErrors.length > 0) {
    lines.push('Recent errors:')
    for (const event of recentErrors) {
      lines.push(`  ${event.atUtc} [${event.severity}] ${event.category}/${event.code} ${event.message}`)
    }
  }
  return lines.join('\n')
}

function serializeBundle(
  manifest: DiagnosticBundleManifest,
  events: DiagnosticEvent[],
): string {
  const file: DiagnosticBundleFile = {
    manifest,
    summary: buildSummary(manifest, events),
    events,
  }
  return `${JSON.stringify(file, null, 2)}\n`
}
