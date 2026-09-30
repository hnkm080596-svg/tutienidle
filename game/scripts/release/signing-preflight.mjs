#!/usr/bin/env node
// BETA-FINAL PR9 / spec B4 - signing preflight for Windows beta packaging.
//
// Fail-closed contract: a releasable Beta requires signing proof, and signing
// proof requires a complete credential source plus a trusted execution
// context. Missing credentials produce a clean UNSIGNED build (the current
// development state) or a blocked release (--require-signing) - never a
// falsely sealed artifact. EXT-02 is unresolved: there is no authorized
// certificate or signing service identity yet, so the release path must
// refuse, not simulate, a seal.
//
// Certificate resolution in the locked electron-builder (app-builder-lib
// 26.15.3, codeSign/windowsSignToolManager.js) - first match wins:
//   signtoolOptions.certificateSha1 / certificateSubjectName -> Windows
//     certificate store lookup (runner-provisioned service identity)
//   signtoolOptions.certificateFile -> local .pfx; password via
//     signtoolOptions.certificatePassword, WIN_CSC_KEY_PASSWORD, then
//     CSC_KEY_PASSWORD
//   WIN_CSC_LINK -> CSC_LINK env (https URL / base64 / file path, imported
//     to a temp .pfx; password via the same chain)
//   azureSignOptions configured -> Azure Trusted Signing (AZURE_*
//     EnvironmentCredential); signtoolOptions is ignored when set
//   none of the above -> "no signing info identified, signing is skipped"
//     and the build continues unsigned.
//
// This script never stores or prints credential VALUES. Presence is captured
// as a '<redacted>' marker at read time so no secret can reach stdout, a
// problem string, or a serialized report.
//
// Usage:
//   node scripts/release/signing-preflight.mjs                    inspect
//   node scripts/release/signing-preflight.mjs --require-signing  release gate
//   node scripts/release/signing-preflight.mjs --config <path>    override yml
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export class SigningPreflightError extends Error {
  constructor(message) {
    super(message)
    this.name = 'SigningPreflightError'
  }
}

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const GAME_ROOT = path.resolve(SCRIPT_DIR, '..', '..')

const REDACTED = '<redacted>'

// The complete list of environment variables this script may look at.
// Values are dropped at capture time; only names plus a redaction marker
// survive into the report.
const ALLOWED_ENV_KEYS = new Set([
  'WIN_CSC_LINK',
  'WIN_CSC_KEY_PASSWORD',
  'CSC_LINK',
  'CSC_KEY_PASSWORD',
  // Azure Trusted Signing EnvironmentCredential inputs (per Microsoft's
  // docs referenced by app-builder-lib's windowsSignAzureManager).
  'AZURE_TENANT_ID',
  'AZURE_CLIENT_ID',
  'AZURE_CLIENT_SECRET',
  'AZURE_CLIENT_CERTIFICATE_PATH',
  'AZURE_FEDERATED_TOKEN_FILE',
  'AZURE_USERNAME',
  'AZURE_PASSWORD',
  // CI context (non-secret by definition).
  'CI',
  'GITHUB_ACTIONS',
  'GITHUB_EVENT_NAME',
  'GITHUB_HEAD_REF',
  'GITHUB_ENVIRONMENT',
])

// Captures allowlisted env PRESENCE only. The returned map can be serialized
// freely: a credential value can never appear in it by construction.
export function captureEnv(env) {
  const present = {}
  for (const key of ALLOWED_ENV_KEYS) {
    const value = env[key]
    if (typeof value === 'string' && value !== '') present[key] = REDACTED
  }
  return present
}

const has = (present, key) => present[key] === REDACTED

// Credential sources, mirrored from electron-builder's own resolution order.
// `complete` means the source alone lets electron-builder produce a real
// signature. `partial` means some-but-not-all required variables are set -
// a misconfiguration that must block, not degrade silently.
export function detectCredentialSources(present) {
  const sources = []

  for (const [name, linkKey, passwordKey] of [
    ['WIN_CSC_LINK', 'WIN_CSC_LINK', 'WIN_CSC_KEY_PASSWORD'],
    ['CSC_LINK', 'CSC_LINK', 'CSC_KEY_PASSWORD'],
  ]) {
    const touched = has(present, linkKey) || has(present, passwordKey)
    sources.push({
      source: name,
      kind: 'signtool-file',
      // The PFX password is optional (electron-builder falls back to an
      // empty password), so only the link itself is required.
      required: [linkKey],
      optional: [passwordKey],
      present: [linkKey, passwordKey].filter((k) => has(present, k)),
      missing: has(present, linkKey) ? [] : [linkKey],
      complete: has(present, linkKey),
      partial: touched && !has(present, linkKey),
    })
  }

  // Azure Trusted Signing requires tenant + client + ONE auth mechanism
  // (EnvironmentCredential contract).
  const azureAuthAlternates = [
    ['AZURE_CLIENT_SECRET'],
    ['AZURE_CLIENT_CERTIFICATE_PATH'],
    ['AZURE_FEDERATED_TOKEN_FILE'],
    ['AZURE_USERNAME', 'AZURE_PASSWORD'],
  ]
  const azureKeys = [
    'AZURE_TENANT_ID',
    'AZURE_CLIENT_ID',
    ...azureAuthAlternates.flat(),
  ]
  const azureMissing = ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID'].filter((k) => !has(present, k))
  const azureAuthOk = azureAuthAlternates.some((alt) => alt.every((k) => has(present, k)))
  if (azureMissing.length === 0 && !azureAuthOk) {
    azureMissing.push(
      'one of AZURE_CLIENT_SECRET | AZURE_CLIENT_CERTIFICATE_PATH | ' +
        'AZURE_FEDERATED_TOKEN_FILE | AZURE_USERNAME+AZURE_PASSWORD',
    )
  }
  sources.push({
    source: 'AZURE_TRUSTED_SIGNING',
    kind: 'azure-service',
    required: ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', '<auth mechanism>'],
    optional: [],
    present: azureKeys.filter((k) => has(present, k)),
    missing: azureMissing,
    complete: azureMissing.length === 0,
    partial: azureKeys.some((k) => has(present, k)) && azureMissing.length > 0,
  })

  return sources
}

// GitHub event names whose jobs must never see signing credentials. Fork and
// pull-request contexts run untrusted head code; pull_request_target even
// receives base-repo secrets while evaluating PR code - both are blocked.
const UNTRUSTED_EVENTS = new Set([
  'pull_request',
  'pull_request_target',
  'pull_request_review',
  'pull_request_review_comment',
])

export function detectContext(env) {
  const ci =
    env.GITHUB_ACTIONS === 'true' || env.CI === 'true' || env.CI === '1'
  const eventName =
    typeof env.GITHUB_EVENT_NAME === 'string' && env.GITHUB_EVENT_NAME !== ''
      ? env.GITHUB_EVENT_NAME
      : null
  const headRef =
    typeof env.GITHUB_HEAD_REF === 'string' && env.GITHUB_HEAD_REF !== ''
      ? env.GITHUB_HEAD_REF
      : null
  const untrusted =
    (eventName !== null && UNTRUSTED_EVENTS.has(eventName)) ||
    (eventName === null && headRef !== null)
  return {
    ci,
    eventName,
    untrusted,
    detail: untrusted
      ? eventName !== null
        ? `event ${eventName} may execute untrusted pull-request code`
        : 'GITHUB_HEAD_REF set without GITHUB_EVENT_NAME (pull-request context)'
      : ci
        ? `CI event ${eventName ?? '(unspecified)'}`
        : 'local (non-CI) context',
  }
}

// ---------------------------------------------------------------------------
// Minimal indentation-aware reader for electron-builder.yml. Only what the
// signing contract needs: nested `key:` blocks become objects, `- item`
// children become __items arrays, scalar `key: value` stays a string.
// ---------------------------------------------------------------------------
function parseYmlTree(text) {
  const root = {}
  const stack = [{ indent: -1, node: root }]
  for (const raw of text.split('\n')) {
    const trimmed = raw.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue
    const indent = raw.length - raw.trimStart().length
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop()
    const parent = stack[stack.length - 1].node
    const listItem = /^-\s+(.+)$/.exec(trimmed)
    if (listItem) {
      ;(parent.__items ??= []).push(stripScalar(listItem[1]))
      continue
    }
    const kv = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(trimmed)
    if (!kv) continue
    const [, key, value] = kv
    if (value === '') {
      const node = {}
      parent[key] = node
      stack.push({ indent, node })
    } else {
      parent[key] = stripScalar(value)
    }
  }
  return root
}

function stripScalar(value) {
  return value.replace(/\s+#.*$/, '').replace(/^(['"])(.*)\1$/, '$2')
}

const getPath = (node, dotted) =>
  dotted.split('.').reduce((n, k) => (n && typeof n === 'object' ? n[k] : undefined), node)

// Keys that embed credential material. Their presence in committed config is
// a violation regardless of value: signing secrets never live in git.
const SECRET_BEARING_KEYS = new Set(['cscLink', 'cscKeyPassword', 'certificatePassword'])

function collectSecretBearing(node, prefix, out) {
  if (!node || typeof node !== 'object') return
  for (const [key, value] of Object.entries(node)) {
    if (key === '__items') continue
    const p = prefix === '' ? key : `${prefix}.${key}`
    if (SECRET_BEARING_KEYS.has(key) && value !== undefined && value !== '') {
      out.push(p)
    }
    if (value && typeof value === 'object') collectSecretBearing(value, p, out)
  }
}

export function readBuilderSigningConfig(text) {
  const tree = parseYmlTree(text)
  const signtool = getPath(tree, 'win.signtoolOptions')
  const azure = getPath(tree, 'win.azureSignOptions')
  const embeddedSecrets = []
  collectSecretBearing(tree, '', embeddedSecrets)
  return {
    signtool:
      signtool && typeof signtool === 'object'
        ? {
            signingHashAlgorithms:
              signtool.signingHashAlgorithms?.__items ??
              (typeof signtool.signingHashAlgorithms === 'string'
                ? signtool.signingHashAlgorithms.replace(/[[\]]/g, '').split(',').map((s) => s.trim()).filter(Boolean)
                : null),
            rfc3161TimeStampServer: signtool.rfc3161TimeStampServer ?? null,
            timeStampServer: signtool.timeStampServer ?? null,
            certificateFile: signtool.certificateFile !== undefined,
            certificateSubjectName: signtool.certificateSubjectName !== undefined,
            certificateSha1: signtool.certificateSha1 !== undefined,
            customSignHook: signtool.sign !== undefined,
          }
        : null,
    azure: azure && typeof azure === 'object' ? { configured: true } : null,
    embeddedSecrets,
  }
}

// One consolidated preflight. `env` is injectable; the full environment is
// never read - only ALLOWED_ENV_KEYS presence.
export function signingPreflight({ env = {}, requireSigning = false, builderConfigText }) {
  const present = captureEnv(env)
  const context = detectContext(env)
  const sources = detectCredentialSources(present)
  const config =
    builderConfigText === undefined
      ? null
      : readBuilderSigningConfig(builderConfigText)

  const problems = []

  for (const p of config?.embeddedSecrets ?? []) {
    problems.push(
      `credential material embedded in electron-builder.yml at ${p} - signing secrets never live in git; use protected env references`,
    )
  }
  if (config?.signtool?.customSignHook) {
    problems.push(
      'win.signtoolOptions.sign (custom sign hook) is configured - the beta release path supports only signtool/Azure signing',
    )
  }

  for (const s of sources) {
    if (s.partial) {
      problems.push(
        `incomplete credential source ${s.source}: missing ${s.missing.join(', ')}`,
      )
    }
  }

  const azureActive = config?.azure?.configured === true
  const signtoolEnvComplete = sources
    .filter((s) => s.kind === 'signtool-file')
    .some((s) => s.complete)
  const storeIdentity =
    config?.signtool?.certificateSha1 === true ||
    config?.signtool?.certificateSubjectName === true
  const fileIdentity = config?.signtool?.certificateFile === true
  const azureEnvComplete = sources.find((s) => s.kind === 'azure-service')?.complete === true

  // What electron-builder would actually do:
  //   azureSignOptions set -> Azure path (signtool ignored, hard error with no
  //   creds); else signtool path -> store/file/env cert, else unsigned.
  const ambiguousAzure = azureActive && (signtoolEnvComplete || storeIdentity || fileIdentity)
  if (ambiguousAzure) {
    problems.push(
      'ambiguous signing configuration: win.azureSignOptions makes electron-builder ignore signtool credentials - configure exactly one signing method',
    )
  }
  if (azureActive && !azureEnvComplete) {
    problems.push(
      'win.azureSignOptions is configured but Azure credential env vars are missing - electron-builder would fail hard instead of skipping signing',
    )
  }

  const signingEngages = azureActive ? azureEnvComplete : signtoolEnvComplete || storeIdentity || fileIdentity

  if (context.untrusted && (signingEngages || azureActive)) {
    problems.push(
      `signing credentials are reachable in an untrusted context (${context.detail}) - PR/fork contexts must never receive signing credentials`,
    )
  }

  const wantsSigntool = !azureActive && (signtoolEnvComplete || storeIdentity || fileIdentity || requireSigning)
  if (wantsSigntool && config !== null) {
    const algs = config.signtool?.signingHashAlgorithms ?? null
    if (algs === null || !algs.includes('sha256') || algs.length !== 1) {
      problems.push(
        'win.signtoolOptions.signingHashAlgorithms must pin exactly [sha256] for the beta contract (default dual-signs sha1+sha256; SHA-1 is deprecated)',
      )
    }
    if (!config.signtool?.rfc3161TimeStampServer) {
      problems.push(
        'win.signtoolOptions.rfc3161TimeStampServer is not configured - the beta contract requires an explicit RFC3161 timestamp authority',
      )
    }
  }

  if (requireSigning) {
    if (context.untrusted) {
      problems.push(`release signing is forbidden in an untrusted context (${context.detail})`)
    }
    if (!signingEngages) {
      problems.push(
        'release requires a real signature but no complete credential source is configured (EXT-02 unresolved) - build stays unsealed rather than falsely signed',
      )
    }
  }

  const verdict =
    problems.length > 0 ? 'blocked' : signingEngages ? 'signing-ready' : 'unsigned-ok'

  return {
    tool: 'signing-preflight',
    requireSigning,
    context,
    credentialSources: sources,
    builderConfig:
      config === null
        ? { checked: false }
        : {
            checked: true,
            signtool: config.signtool,
            azureConfigured: config.azure?.configured === true,
            embeddedSecretFields: config.embeddedSecrets,
          },
    problems,
    verdict,
  }
}

export function parseArgs(argv) {
  const args = { requireSigning: false, configPath: path.join(GAME_ROOT, 'electron-builder.yml') }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--require-signing') args.requireSigning = true
    else if (argv[i] === '--config') args.configPath = argv[++i]
    else if (argv[i] === '--help' || argv[i] === '-h') return { help: true }
    else throw new SigningPreflightError(`unknown argument: ${argv[i]}`)
  }
  return args
}

export function main(argv) {
  const args = parseArgs(argv)
  if (args.help) {
    console.log('usage: signing-preflight.mjs [--require-signing] [--config <electron-builder.yml>]')
    return
  }
  let text
  try {
    text = fs.readFileSync(args.configPath, 'utf8')
  } catch {
    throw new SigningPreflightError(`cannot read builder config: ${args.configPath}`)
  }
  const report = signingPreflight({
    env: process.env,
    requireSigning: args.requireSigning,
    builderConfigText: text,
  })
  for (const p of report.problems) console.error(`signing-preflight: ${p}`)
  console.log(JSON.stringify(report, null, 2))
  console.log(
    `signing-preflight verdict: ${report.verdict} (${report.context.detail})`,
  )
  process.exitCode =
    report.problems.length > 0 || (args.requireSigning && report.verdict !== 'signing-ready')
      ? 1
      : 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
}
