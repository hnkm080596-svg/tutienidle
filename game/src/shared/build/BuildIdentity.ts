// BETA-FINAL PR1 / spec B2 - the single runtime authority for build identity.
//
// The value is generated once per build by scripts/release/build-identity.mjs
// and injected into both the renderer and the Electron main bundles as the
// __BUILD_IDENTITY__ Vite define. This module validates that injected blob
// and exposes it as one frozen object; every consumer (settings, error
// surfaces, later save/diagnostics/feedback/updater code) reads from here.
// No Vue/Phaser/Node imports - this file must stay bundle-neutral.

export interface BuildIdentity {
  readonly productName: string
  readonly appVersion: string
  readonly buildId: string
  readonly gitSha: string
  readonly saveSchemaVersion: number
  readonly backendEnvironment: 'development' | 'staging' | 'beta' | 'production'
  readonly releaseChannel: 'development' | 'beta'
  readonly builtAtUtc: string
}

// Injected at build time by vite.config.ts via `define`. Declared `unknown`
// on purpose: the value crosses a boundary and is validated at runtime.
declare const __BUILD_IDENTITY__: unknown

const BACKEND_ENVIRONMENTS = new Set(['development', 'staging', 'beta', 'production'])
const RELEASE_CHANNELS = new Set(['development', 'beta'])

// The generated field is always `new Date().toISOString()`; accept that
// exact shape (UTC, with milliseconds optional) rather than anything
// Date.parse happens to tolerate.
const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

const IDENTITY_KEYS = new Set<keyof BuildIdentity>([
  'productName',
  'appVersion',
  'buildId',
  'gitSha',
  'saveSchemaVersion',
  'backendEnvironment',
  'releaseChannel',
  'builtAtUtc',
])

function requireNonEmpty(value: unknown, field: string): string {
  if (typeof value !== 'string' || value === '') {
    throw new Error(`BuildIdentity: field ${field} is missing`)
  }
  return value
}

// Validates an injected/marshalled blob and returns a fresh frozen object.
// Unknown keys are rejected so the injection channel cannot carry data that
// is not part of the contract (no secrets can ride along).
export function parseBuildIdentity(value: unknown): BuildIdentity {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('BuildIdentity: injected value must be an object')
  }
  const record = value as Record<string, unknown>
  for (const key of Object.keys(record)) {
    if (!IDENTITY_KEYS.has(key as keyof BuildIdentity)) {
      throw new Error(`BuildIdentity: unexpected field ${key}`)
    }
  }
  for (const key of IDENTITY_KEYS) {
    if (!(key in record)) {
      throw new Error(`BuildIdentity: missing field ${key}`)
    }
  }

  const saveSchemaVersion = record.saveSchemaVersion
  if (!Number.isSafeInteger(saveSchemaVersion) || (saveSchemaVersion as number) < 0) {
    throw new Error('BuildIdentity: saveSchemaVersion must be a nonnegative safe integer')
  }
  const backendEnvironment = requireNonEmpty(record.backendEnvironment, 'backendEnvironment')
  if (!BACKEND_ENVIRONMENTS.has(backendEnvironment)) {
    throw new Error(`BuildIdentity: unknown backendEnvironment ${backendEnvironment}`)
  }
  const releaseChannel = requireNonEmpty(record.releaseChannel, 'releaseChannel')
  if (!RELEASE_CHANNELS.has(releaseChannel)) {
    throw new Error(`BuildIdentity: unknown releaseChannel ${releaseChannel}`)
  }
  const builtAtUtc = requireNonEmpty(record.builtAtUtc, 'builtAtUtc')
  if (!ISO_UTC_RE.test(builtAtUtc)) {
    throw new Error('BuildIdentity: builtAtUtc must be an ISO-8601 UTC timestamp')
  }

  return Object.freeze({
    productName: requireNonEmpty(record.productName, 'productName'),
    appVersion: requireNonEmpty(record.appVersion, 'appVersion'),
    buildId: requireNonEmpty(record.buildId, 'buildId'),
    gitSha: requireNonEmpty(record.gitSha, 'gitSha'),
    saveSchemaVersion: saveSchemaVersion as number,
    backendEnvironment: backendEnvironment as BuildIdentity['backendEnvironment'],
    releaseChannel: releaseChannel as BuildIdentity['releaseChannel'],
    builtAtUtc,
  })
}

function injectedIdentity(): BuildIdentity {
  if (typeof __BUILD_IDENTITY__ === 'undefined') {
    // Fail closed: a bundle built without the define has no identity contract
    // and must not improvise one.
    throw new Error(
      'BuildIdentity: __BUILD_IDENTITY__ define missing - build through vite.config.ts',
    )
  }
  return parseBuildIdentity(__BUILD_IDENTITY__)
}

export const BUILD_IDENTITY: BuildIdentity = injectedIdentity()

/** Short form of the commit SHA for display surfaces. */
export function shortGitSha(identity: BuildIdentity = BUILD_IDENTITY): string {
  return identity.gitSha.slice(0, 7)
}
