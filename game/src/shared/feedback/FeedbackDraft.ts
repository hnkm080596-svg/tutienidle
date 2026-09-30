// BETA-FINAL PR13 / spec B7 - shared feedback draft contract.
//
// Bundle-neutral (src/shared): the renderer dialog, the Supabase adapter and
// the contract tests all speak these types. The draft is the ONLY shape the
// wire may carry - validateFeedbackDraft() scrubs free-text fields through
// the same redaction gate as diagnostic events (tokens, emails, absolute
// paths, key/secret strings) and enforces the byte/field bounds the server
// re-checks in _check_feedback_report.
//
// EXT-06 (privacy/retention policy) is unresolved. FEEDBACK_LIMITS below are
// conservative measured interim bounds, not guesses: a maximal attached
// report (2000-char description + steps, 50 minimal diagnostic events)
// serializes to ~11.5KB, and the recorder's own sizing gives typical real
// events at ~300-500B, so 50 events ~ 25KB worst case. The report ceiling is
// 48KB and the diagnostics slice 32KB - both sides of that size the same
// way. The server enforces the same numbers from backend_config.feedbackLimits
// (migration 202609300004) - bump both together when the approved policy lands.

import type { BuildIdentity } from '../build/BuildIdentity'
import {
  redactDiagnosticText,
  type DiagnosticEvent,
} from '../diagnostics/DiagnosticEvent'

export const FEEDBACK_CATEGORIES = [
  'bug',
  'balance',
  'performance',
  'ui',
  'feature-request',
  'other',
] as const

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]

export interface FeedbackLimits {
  maxDescriptionChars: number
  maxStepsChars: number
  maxContactChars: number
  maxRouteChars: number
  maxContextKeys: number
  maxContextValueChars: number
  maxDiagnosticsEvents: number
  maxDiagnosticsBytes: number
  maxDiagnosticEventBytes: number
  /** Mirrors DEFAULT_DIAGNOSTIC_BOUNDS: details is a flat scalar map. */
  maxDiagnosticDetailKeys: number
  maxDiagnosticDetailValueChars: number
  maxClientBuildFieldChars: number
  maxReportBytes: number
}

export const FEEDBACK_LIMITS: FeedbackLimits = {
  maxDescriptionChars: 2000,
  maxStepsChars: 2000,
  maxContactChars: 200,
  maxRouteChars: 200,
  maxContextKeys: 12,
  maxContextValueChars: 64,
  maxDiagnosticsEvents: 50,
  maxDiagnosticsBytes: 32768,
  maxDiagnosticEventBytes: 4096,
  maxDiagnosticDetailKeys: 16,
  maxDiagnosticDetailValueChars: 256,
  maxClientBuildFieldChars: 128,
  maxReportBytes: 49152,
}

export type FeedbackContextValue = string | number | boolean | null

export interface FeedbackContext {
  readonly [key: string]: FeedbackContextValue
}

/** Raw form input - fields are whatever the user typed, unvalidated. */
export interface FeedbackDraftInput {
  category: string
  description: string
  steps?: string
  contact?: string
  route?: string
  context?: FeedbackContext
  /** Opt-in selection from the diagnostic recorder; each entry is expected
   *  to have already passed validateDiagnosticEvent upstream (the recorder
   *  guarantees this), and is re-bounded here + again server-side. */
  diagnostics?: readonly DiagnosticEvent[]
  build: BuildIdentity
}

/** Normalized, submission-ready draft produced by validateFeedbackDraft. */
export interface FeedbackDraft {
  category: FeedbackCategory
  description: string
  steps?: string
  contact?: string
  route?: string
  context?: FeedbackContext
  diagnostics?: DiagnosticEvent[]
  build: BuildIdentity
}

export type FeedbackValidation =
  | { ok: true; draft: FeedbackDraft }
  | { ok: false; code: string; detail: string }

const CONTEXT_KEY_RE = /^[A-Za-z0-9_.:-]{1,64}$/

function invalid(code: string, detail: string): FeedbackValidation {
  return { ok: false, code, detail }
}

function bounded(
  value: string | undefined,
  maxChars: number,
  field: string,
): { ok: true; value?: string } | { ok: false; code: string; detail: string } {
  if (value === undefined) return { ok: true }
  const trimmed = value.trim()
  if (trimmed === '') return { ok: true }
  const scrubbed = redactDiagnosticText(trimmed)
  if (scrubbed.length > maxChars) {
    return { ok: false, code: 'field-too-long', detail: `${field} exceeds ${maxChars} chars` }
  }
  return { ok: true, value: scrubbed }
}

/**
 * Validate + normalize raw form input into a submission draft. Free-text
 * fields are trimmed and passed through redactDiagnosticText; validation
 * happens on the scrubbed text so the wire never sees the raw input.
 */
export function validateFeedbackDraft(
  input: FeedbackDraftInput,
  limits: FeedbackLimits = FEEDBACK_LIMITS,
): FeedbackValidation {
  if (!FEEDBACK_CATEGORIES.includes(input.category as FeedbackCategory)) {
    return invalid('bad-category', 'unknown feedback category')
  }
  const category = input.category as FeedbackCategory

  const description = redactDiagnosticText(input.description.trim())
  if (description.length === 0) {
    return invalid('empty-description', 'description is required')
  }
  if (description.length > limits.maxDescriptionChars) {
    return invalid('field-too-long', `description exceeds ${limits.maxDescriptionChars} chars`)
  }

  const steps = bounded(input.steps, limits.maxStepsChars, 'steps')
  if (!steps.ok) return steps
  const contact = bounded(input.contact, limits.maxContactChars, 'contact')
  if (!contact.ok) return contact
  const route = bounded(input.route, limits.maxRouteChars, 'route')
  if (!route.ok) return route

  if (input.context !== undefined) {
    const keys = Object.keys(input.context)
    if (keys.length > limits.maxContextKeys) {
      return invalid('bad-context', `context exceeds ${limits.maxContextKeys} keys`)
    }
    for (const key of keys) {
      if (!CONTEXT_KEY_RE.test(key)) {
        return invalid('bad-context', `context key "${key}" violates the id charset`)
      }
      const value = input.context[key]
      if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) {
        return invalid('bad-context', `context.${key} must be a scalar`)
      }
      if (typeof value === 'string' && value.length > limits.maxContextValueChars) {
        return invalid('bad-context', `context.${key} exceeds ${limits.maxContextValueChars} chars`)
      }
    }
  }

  if (input.diagnostics !== undefined) {
    if (input.diagnostics.length > limits.maxDiagnosticsEvents) {
      return invalid('too-many-diagnostics', `diagnostics exceed ${limits.maxDiagnosticsEvents} events`)
    }
    const bytes = new TextEncoder().encode(JSON.stringify(input.diagnostics)).length
    if (bytes > limits.maxDiagnosticsBytes) {
      return invalid('diagnostics-too-large', `diagnostics exceed ${limits.maxDiagnosticsBytes} bytes`)
    }
    for (const event of input.diagnostics) {
      if (typeof event !== 'object' || event === null || Array.isArray(event)) {
        return invalid('bad-diagnostics', 'diagnostic entry is not an object')
      }
      const eventBytes = new TextEncoder().encode(JSON.stringify(event)).length
      if (eventBytes > limits.maxDiagnosticEventBytes) {
        return invalid('bad-diagnostics', `diagnostic entry exceeds ${limits.maxDiagnosticEventBytes} bytes`)
      }
      // details mirrors the server-side bound: a flat map of scalars, so an
      // unvalidated caller cannot smuggle a nested blob in an approved field.
      if (event.details !== undefined) {
        if (typeof event.details !== 'object' || event.details === null || Array.isArray(event.details)) {
          return invalid('bad-diagnostics', 'diagnostic details must be a flat object')
        }
        const detailKeys = Object.keys(event.details)
        if (detailKeys.length > limits.maxDiagnosticDetailKeys) {
          return invalid('bad-diagnostics', `diagnostic details exceed ${limits.maxDiagnosticDetailKeys} keys`)
        }
        for (const key of detailKeys) {
          if (!CONTEXT_KEY_RE.test(key)) {
            return invalid('bad-diagnostics', `diagnostic detail key "${key}" violates the id charset`)
          }
          const value = event.details[key]
          if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) {
            return invalid('bad-diagnostics', `diagnostic detail ${key} must be a scalar`)
          }
          if (typeof value === 'string' && value.length > limits.maxDiagnosticDetailValueChars) {
            return invalid('bad-diagnostics', `diagnostic detail ${key} exceeds ${limits.maxDiagnosticDetailValueChars} chars`)
          }
        }
      }
    }
  }

  const draft: FeedbackDraft = {
    category,
    description,
    ...(steps.value !== undefined ? { steps: steps.value } : {}),
    ...(contact.value !== undefined ? { contact: contact.value } : {}),
    ...(route.value !== undefined ? { route: route.value } : {}),
    ...(input.context !== undefined ? { context: { ...input.context } } : {}),
    ...(input.diagnostics !== undefined && input.diagnostics.length > 0
      ? { diagnostics: [...input.diagnostics] }
      : {}),
    build: input.build,
  }

  if (feedbackDraftBytes(draft) > limits.maxReportBytes) {
    return invalid('report-too-large', `report exceeds ${limits.maxReportBytes} bytes`)
  }

  return { ok: true, draft }
}

/**
 * The exact object sent as p_report to submit_feedback. clientBuild is the
 * client-reported BuildIdentity - the server cross-checks buildId against
 * the session's recorded build and environment against the operator-stamped
 * value, and persists authoritative attribution separately.
 */
export function serializeFeedbackReport(draft: FeedbackDraft): Record<string, unknown> {
  const report: Record<string, unknown> = {
    category: draft.category,
    description: draft.description,
    clientBuild: {
      productName: draft.build.productName,
      appVersion: draft.build.appVersion,
      buildId: draft.build.buildId,
      gitSha: draft.build.gitSha,
      saveSchemaVersion: draft.build.saveSchemaVersion,
      backendEnvironment: draft.build.backendEnvironment,
      releaseChannel: draft.build.releaseChannel,
      builtAtUtc: draft.build.builtAtUtc,
    },
  }
  if (draft.steps !== undefined) report.steps = draft.steps
  if (draft.contact !== undefined) report.contact = draft.contact
  if (draft.route !== undefined) report.route = draft.route
  if (draft.context !== undefined) report.context = draft.context
  if (draft.diagnostics !== undefined) report.diagnostics = draft.diagnostics
  return report
}

/** Serialized wire size of the report body (the byte ceiling applies here). */
export function feedbackDraftBytes(draft: FeedbackDraft): number {
  return new TextEncoder().encode(JSON.stringify(serializeFeedbackReport(draft))).length
}
