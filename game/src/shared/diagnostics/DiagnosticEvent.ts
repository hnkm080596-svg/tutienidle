// BETA-FINAL PR11 / spec B8 - the shared diagnostic event contract.
//
// Every diagnostic record that may be persisted or exported passes through
// validateDiagnosticEvent(). The validator is a strict allowlist: unknown
// top-level keys and non-allowlisted detail keys reject the whole event, so
// a freeform transport payload or a malicious renderer can never smuggle
// raw save data, HTTP bodies, or credentials into the local bundle.
// redactDiagnosticText() is the single scrub point for every free-text
// field; it runs INSIDE validation, not as an afterthought at export.
//
// No Vue/Phaser/Node imports - this file must stay bundle-neutral.

export const DIAGNOSTIC_SEVERITIES = ['info', 'warning', 'error', 'fatal'] as const
export type DiagnosticSeverity = (typeof DIAGNOSTIC_SEVERITIES)[number]

export const DIAGNOSTIC_CATEGORIES = [
  'renderer-error',
  'main-error',
  'render-process-gone',
  'save',
  'session',
  'quit-flush',
  'lifecycle',
  'export',
] as const
export type DiagnosticCategory = (typeof DIAGNOSTIC_CATEGORIES)[number]

export const DIAGNOSTIC_SOURCES = ['renderer', 'main'] as const
export type DiagnosticSource = (typeof DIAGNOSTIC_SOURCES)[number]

// Keys allowed inside event.details. Anything else rejects the event -
// this is the primary defence against credential/payload leaks because the
// values below are scalars that get length-bounded and redacted, never
// nested objects.
export const DIAGNOSTIC_DETAIL_KEYS = new Set([
  'reason',
  'status',
  'code',
  'detail',
  'requestId',
  'generation',
  'lineage',
  'revision',
  'expectedRevision',
  'currentRevision',
  'remoteRevision',
  'saveSchemaVersion',
  'foundVersion',
  'state',
  'from',
  'to',
  'channel',
  'source',
  'trigger',
  'boundary',
  'killReason',
  'exitCode',
  'retryable',
  'attempt',
  'elapsedMs',
  'errorName',
  'eventCount',
  'truncatedEvents',
  'queueDepth',
  'file',
  'files',
])

export interface DiagnosticBounds {
  /** Max events held by the recorder ring / per exported bundle. */
  maxEntries: number
  /** Max events written into one exported bundle. */
  maxBundleEvents: number
  /** Total exported bundle bytes; oldest events drop until it fits. */
  maxBundleBytes: number
  maxMessageLength: number
  maxCodeLength: number
  maxRouteLength: number
  maxCorrelationIdLength: number
  maxDetailKeys: number
  maxDetailValueLength: number
  /** Stack lines kept when an Error is captured. */
  maxStackLines: number
  /** Per rotated NDJSON file size. */
  maxFileBytes: number
  /** Rotated file count including the live file. */
  maxFiles: number
}

// Bounds are sized against measured fixtures: a typical event serializes to
// ~300-500 bytes, so 200 events ~ 100KB per ring, four 256KB rotated files
// cap disk at ~1MB, and a 512KB bundle comfortably carries the 200-event
// export window plus manifest and summary.
export const DEFAULT_DIAGNOSTIC_BOUNDS: DiagnosticBounds = {
  maxEntries: 200,
  maxBundleEvents: 200,
  maxBundleBytes: 512 * 1024,
  maxMessageLength: 512,
  maxCodeLength: 64,
  maxRouteLength: 200,
  maxCorrelationIdLength: 64,
  maxDetailKeys: 16,
  maxDetailValueLength: 256,
  maxStackLines: 8,
  maxFileBytes: 256 * 1024,
  maxFiles: 4,
}

// Input accepted by validators: no seq/atUtc requirement (the recorder or
// the bundle assigns them), but already-stamped events re-validate cleanly.
export interface DiagnosticEventInput {
  source: DiagnosticSource
  severity: DiagnosticSeverity
  category: DiagnosticCategory
  /** Stable machine code, e.g. FLUSH_FAILED. Safe charset only. */
  code: string
  /** Free text - redacted and length-bounded before it goes anywhere. */
  message: string
  route?: string
  correlationId?: string
  /** Coarse save revision at record time - never save bytes. */
  revision?: number
  details?: Readonly<Record<string, string | number | boolean | null>>
  /** Newline-joined stack frames; paths inside frames are redacted. */
  stack?: string
  /** Stable per-install report id stamped by the recorder. */
  reportId?: string
  seq?: number
  atUtc?: string
}

export interface DiagnosticEvent extends DiagnosticEventInput {
  seq: number
  atUtc: string
}

export type DiagnosticValidation =
  | { ok: true; event: DiagnosticEventInput }
  | { ok: false; reason: string }

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

// If a JSON blob containing any of these key markers appears in free text,
// the whole string is a payload dump (raw save, HTTP body, credential blob)
// and is replaced wholesale. Marker choice follows the serialized GameSave
// shape ({ "saveVersion": ..., "player": ... }) plus credential envelopes.
const PAYLOAD_MARKERS = [
  '"saveversion"',
  '"player"',
  '"inventory"',
  '"cultivation"',
  '"refresh_token"',
  '"access_token"',
  '"id_token"',
  '"password"',
  '"passwd"',
  '"secret"',
  '"authorization"',
  '"apikey"',
  '"api_key"',
  '"rawpayload"',
  '"localbytehash"',
  '"raw"',
]

const KEY_VALUE_SECRET_RE =
  /\b(password|passwd|pwd|secret|token|auth|refresh[_-]?token|access[_-]?token|id[_-]?token|api[_-]?key|apikey|anon[_-]?key|session[_-]?key|signing[_-]?key|private[_-]?key|credential(?:s)?|cookie|set-cookie)(\s*[:=]\s*"?)[^\s"'`,;{}\[\]]+/gi

const SCRUBS: ReadonlyArray<readonly [RegExp, string]> = [
  // JSON Web Tokens: three base64url segments, first always starts eyJ.
  [/eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{3,}/g, '<redacted:jwt>'],
  // Authorization-style headers: "Bearer xxx", "authorization xxx".
  [/\b(bearer|authorization)\s+[A-Za-z0-9._~+/=-]{8,}/gi, '$1 <redacted>'],
  // URL query strings carry tokens/signatures; keep scheme+path only.
  [/(https?:\/\/[^\s"'`?]*)\?[^\s"'`]*/gi, '$1?<redacted:query>'],
  [KEY_VALUE_SECRET_RE, '$1$2<redacted>'],
  // Absolute filesystem paths (file:line suffixes survive the <path> slot).
  [/[A-Za-z]:\\(?:[^\s"'`\\/:*?<>|]+\\)*[^\s"'`\\/:*?<>|]*/g, '<path>'],
  [/\\\\[^\s"'`]+/g, '<path>'],
  [
    /\/(?:home|Users|users|tmp|var|opt|root|mnt|media|private|etc|usr|srv|Volumes|data|workspace|app)\/[^:\s"'`]*/g,
    '<path>',
  ],
]

/**
 * Scrubs a single free-text value. Layered: payload-marker short-circuit
 * first (a string that carries a JSON blob with save/credential keys is
 * replaced wholesale), then regex scrubs for tokens, credential
 * assignments, URL queries, and filesystem paths.
 */
export function redactDiagnosticText(text: string): string {
  if (text.includes('{') || text.includes('[')) {
    const lowered = text.toLowerCase()
    if (PAYLOAD_MARKERS.some((marker) => lowered.includes(marker))) {
      return '<redacted:payload>'
    }
  }
  let out = text
  for (const [pattern, replacement] of SCRUBS) {
    out = out.replace(pattern, replacement)
  }
  return out
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const SAFE_CODE_RE = /^[A-Za-z0-9_.:-]+$/
const SAFE_ID_RE = /^[A-Za-z0-9_.:-]+$/
const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

const INPUT_KEYS = new Set([
  'source',
  'severity',
  'category',
  'code',
  'message',
  'route',
  'correlationId',
  'revision',
  'details',
  'stack',
  'reportId',
  'seq',
  'atUtc',
])

const SEVERITY_SET = new Set<string>(DIAGNOSTIC_SEVERITIES)
const CATEGORY_SET = new Set<string>(DIAGNOSTIC_CATEGORIES)
const SOURCE_SET = new Set<string>(DIAGNOSTIC_SOURCES)

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  const marker = '[truncated]'
  return `${text.slice(0, Math.max(0, max - marker.length))}${marker}`
}

function fail(reason: string): DiagnosticValidation {
  return { ok: false, reason }
}

/**
 * Validates and sanitizes one event. Returns a fresh object containing only
 * allowlisted fields - the caller must persist the RETURNED event, never the
 * input. Rejected events carry a reason code for tests and dropped counters.
 */
export function validateDiagnosticEvent(
  input: unknown,
  bounds: DiagnosticBounds = DEFAULT_DIAGNOSTIC_BOUNDS,
): DiagnosticValidation {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return fail('not-an-object')
  }
  const record = input as Record<string, unknown>
  for (const key of Object.keys(record)) {
    if (!INPUT_KEYS.has(key)) {
      return fail(`unknown-key:${key}`)
    }
  }

  const source = record.source
  if (typeof source !== 'string' || !SOURCE_SET.has(source)) {
    return fail('bad-source')
  }
  const severity = record.severity
  if (typeof severity !== 'string' || !SEVERITY_SET.has(severity)) {
    return fail('bad-severity')
  }
  const category = record.category
  if (typeof category !== 'string' || !CATEGORY_SET.has(category)) {
    return fail('bad-category')
  }

  const code = record.code
  if (typeof code !== 'string' || code === '' || !SAFE_CODE_RE.test(code)) {
    return fail('bad-code')
  }
  const message = record.message
  if (typeof message !== 'string' || message.trim() === '') {
    return fail('bad-message')
  }

  const event: DiagnosticEventInput = {
    source: source as DiagnosticSource,
    severity: severity as DiagnosticSeverity,
    category: category as DiagnosticCategory,
    code: truncate(code, bounds.maxCodeLength),
    message: truncate(redactDiagnosticText(message), bounds.maxMessageLength),
  }

  if (record.route !== undefined) {
    if (typeof record.route !== 'string') return fail('bad-route')
    // A route keeps only its path component - queries and fragments can
    // carry oauth codes / tokens.
    const pathOnly = record.route.split(/[?#]/)[0] ?? ''
    event.route = truncate(redactDiagnosticText(pathOnly), bounds.maxRouteLength)
  }
  if (record.correlationId !== undefined) {
    if (
      typeof record.correlationId !== 'string' ||
      !SAFE_ID_RE.test(record.correlationId)
    ) {
      return fail('bad-correlation-id')
    }
    event.correlationId = truncate(record.correlationId, bounds.maxCorrelationIdLength)
  }
  if (record.revision !== undefined) {
    if (!Number.isSafeInteger(record.revision) || (record.revision as number) < 0) {
      return fail('bad-revision')
    }
    event.revision = record.revision as number
  }
  if (record.seq !== undefined) {
    if (!Number.isSafeInteger(record.seq) || (record.seq as number) < 0) {
      return fail('bad-seq')
    }
    event.seq = record.seq as number
  }
  if (record.atUtc !== undefined) {
    if (typeof record.atUtc !== 'string' || !ISO_UTC_RE.test(record.atUtc)) {
      return fail('bad-at-utc')
    }
    event.atUtc = record.atUtc
  }

  if (record.details !== undefined) {
    if (
      record.details === null ||
      typeof record.details !== 'object' ||
      Array.isArray(record.details)
    ) {
      return fail('bad-details')
    }
    const details = record.details as Record<string, unknown>
    const keys = Object.keys(details)
    if (keys.length > bounds.maxDetailKeys) return fail('too-many-detail-keys')
    const out: Record<string, string | number | boolean | null> = {}
    for (const key of keys) {
      if (!DIAGNOSTIC_DETAIL_KEYS.has(key)) {
        return fail(`unknown-detail-key:${key}`)
      }
      const value = details[key]
      if (value === null) {
        out[key] = null
      } else if (typeof value === 'boolean') {
        out[key] = value
      } else if (typeof value === 'number') {
        if (!Number.isFinite(value)) return fail('bad-detail-value')
        out[key] = value
      } else if (typeof value === 'string') {
        out[key] = truncate(redactDiagnosticText(value), bounds.maxDetailValueLength)
      } else {
        return fail('bad-detail-value')
      }
    }
    event.details = out
  }

  if (record.reportId !== undefined) {
    if (
      typeof record.reportId !== 'string' ||
      !SAFE_ID_RE.test(record.reportId)
    ) {
      return fail('bad-report-id')
    }
    event.reportId = truncate(record.reportId, bounds.maxCorrelationIdLength)
  }

  if (record.stack !== undefined) {
    if (typeof record.stack !== 'string') return fail('bad-stack')
    const lines = record.stack.split('\n').slice(0, bounds.maxStackLines)
    event.stack = lines
      .map((line) => truncate(redactDiagnosticText(line), bounds.maxDetailValueLength))
      .join('\n')
  }

  return { ok: true, event }
}
