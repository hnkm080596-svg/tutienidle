#!/usr/bin/env node
// BETA-FINAL PR10 / spec B5 - release artifact manifest.
//
// Enumerates the FINAL signed artifacts in the electron-builder release dir,
// hashes each with SHA-256, and emits:
//   release/checksums.txt          sha256sum-compatible lines
//   release/release-manifest.json  machine manifest consumed by
//                                  publish-candidate.mjs and B6/B10 evidence
//
// Ordering contract (spec B5): this runs AFTER the installer is signed.
// Hashes are computed over the signed bytes and are immutable evidence;
// publish-candidate.mjs re-verifies them before upload and never rebuilds.
//
// Every top-level file in the release dir must classify into a known kind -
// an unrecognized file fails generation (same allowlist discipline as
// inspect-package.mjs) instead of silently shipping. Directories (e.g.
// win-unpacked/) are payload inspection territory, not upload artifacts.
//
// Signing identity is recorded, not inferred: pass --signing-thumbprint (the
// approved certificate record value that verify-signatures.ps1 just checked)
// plus optional --signing-subject. Without them the manifest requires
// --allow-unsigned and is emitted with signing.status "unsealed" - honest
// evidence for dry runs, never a false seal (EXT-02).
//
// Usage:
//   node scripts/release/manifest.mjs --input release --tag v0.1.0-beta.0 \
//     [--identity dist/build-identity.json] \
//     [--signing-thumbprint <40-hex>] [--signing-subject <cn>] \
//     [--allow-unsigned] [--out release/release-manifest.json] \
//     [--checksums release/checksums.txt]
//   node scripts/release/manifest.mjs --verify release/release-manifest.json \
//     [--input release]
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export class ManifestError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ManifestError'
  }
}

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const GAME_ROOT = path.resolve(SCRIPT_DIR, '..', '..')

const MANIFEST_SCHEMA_VERSION = 1
const MANIFEST_FILENAME = 'release-manifest.json'
const CHECKSUMS_FILENAME = 'checksums.txt'
const SHA256_HEX_RE = /^[0-9a-f]{64}$/
const THUMBPRINT_RE = /^[0-9a-f]{40}$/i
const TAG_RE = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

// Non-secret CI context only. Same discipline as build-identity.mjs and
// signing-preflight.mjs: the manifest never reads arbitrary process.env, so
// no credential can ride into release evidence.
const ALLOWED_ENV_KEYS = new Set([
  'GITHUB_REPOSITORY',
  'GITHUB_SHA',
  'GITHUB_REF_NAME',
  'GITHUB_WORKFLOW',
  'GITHUB_RUN_ID',
  'GITHUB_RUN_NUMBER',
  'GITHUB_RUN_ATTEMPT',
  'GITHUB_SERVER_URL',
  'RUNNER_OS',
  'RUNNER_ARCH',
  'ImageOS',
  'ImageVersion',
])

export function readCiEnv(env) {
  const picked = {}
  for (const key of ALLOWED_ENV_KEYS) {
    const value = env[key]
    if (typeof value === 'string' && value !== '') picked[key] = value
  }
  return picked
}

export function sha256File(filePath) {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('hex')
}

// electron-builder update metadata channel files (beta.yml, latest.yml,
// latest-beta.yml, ...) vs builder bookkeeping (builder-*.yml) vs the files
// this script itself emits.
const UPDATE_METADATA_RE = /^(latest|beta|alpha|stable|canary)(-[0-9A-Za-z.]+)?\.(yml|yaml)$/i
const BUILDER_CONFIG_RE = /^builder-.*\.(yml|yaml)$/i

// classify returns { kind, publish } for a top-level release-dir file or
// null when the file is not a manifest-listed artifact kind at all
// (release-manifest.json itself is excluded by collectArtifacts).
// publish=false artifacts are recorded as evidence but never uploaded.
export function classifyArtifactFile(name) {
  if (/\.blockmap$/i.test(name)) return { kind: 'blockmap', publish: true }
  if (/-Setup\.exe$/i.test(name)) return { kind: 'installer', publish: true }
  if (UPDATE_METADATA_RE.test(name)) return { kind: 'update-metadata', publish: true }
  if (BUILDER_CONFIG_RE.test(name)) return { kind: 'build-config', publish: false }
  if (/^sbom\.[\w.-]+\.json$/i.test(name)) return { kind: 'sbom', publish: true }
  if (name === CHECKSUMS_FILENAME) return { kind: 'checksums', publish: true }
  return null
}

// Enumerates top-level FILES of the release dir (never recursing into
// win-unpacked/ - that payload is covered by inspect-package.mjs). Throws on
// an unrecognized file: the manifest is an enumeration contract, not a
// best-effort listing.
export function collectArtifacts(inputDir) {
  if (!fs.existsSync(inputDir) || !fs.statSync(inputDir).isDirectory()) {
    throw new ManifestError(`--input is not a directory: ${inputDir}`)
  }
  const artifacts = []
  const unknown = []
  for (const entry of fs.readdirSync(inputDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue
    if (entry.name === MANIFEST_FILENAME) continue
    const classified = classifyArtifactFile(entry.name)
    if (classified === null) {
      unknown.push(entry.name)
      continue
    }
    const filePath = path.join(inputDir, entry.name)
    artifacts.push({
      file: entry.name,
      kind: classified.kind,
      publish: classified.publish,
      bytes: fs.statSync(filePath).size,
      sha256: sha256File(filePath),
    })
  }
  if (unknown.length > 0) {
    throw new ManifestError(
      `unrecognized files in release dir (refusing to guess): ${unknown.join(', ')}`,
    )
  }
  artifacts.sort((a, b) => a.file.localeCompare(b.file))
  return artifacts
}

export function readIdentity(identityPath) {
  let raw
  try {
    raw = JSON.parse(fs.readFileSync(identityPath, 'utf8'))
  } catch {
    throw new ManifestError(`cannot read build identity: ${identityPath}`)
  }
  const required = [
    'productName',
    'appVersion',
    'buildId',
    'gitSha',
    'saveSchemaVersion',
    'backendEnvironment',
    'releaseChannel',
    'builtAtUtc',
  ]
  for (const field of required) {
    if (raw[field] === undefined || raw[field] === null || raw[field] === '') {
      throw new ManifestError(`build identity missing field ${field}`)
    }
  }
  return raw
}

// The installer must exist among the artifacts - a manifest without the
// exact installable artifact is not a candidate manifest.
export function requireInstaller(artifacts) {
  const installer = artifacts.filter((a) => a.kind === 'installer')
  if (installer.length === 0) {
    throw new ManifestError('no installer artifact (*-Setup.exe) in the release dir')
  }
  if (installer.length > 1) {
    throw new ManifestError(
      `ambiguous installer artifacts: ${installer.map((a) => a.file).join(', ')}`,
    )
  }
  return installer[0]
}

export function formatChecksums(artifacts) {
  // sha256sum format: "<hash>  <file>" - human/tool consumable, mirrors the
  // manifest's artifact hashes exactly.
  return artifacts
    .filter((a) => a.publish)
    .map((a) => `${a.sha256}  ${a.file}`)
    .join('\n') + '\n'
}

export function generateManifest({
  inputDir,
  identityPath,
  signingThumbprint = null,
  signingSubject = null,
  allowUnsigned = false,
  tag = null,
  env = {},
  now = new Date(),
}) {
  const identity = readIdentity(identityPath)
  const ci = readCiEnv(env)

  const resolvedTag = tag ?? ci.GITHUB_REF_NAME ?? null
  if (resolvedTag !== null && !TAG_RE.test(resolvedTag)) {
    throw new ManifestError(`release tag must look like v<semver>, got ${resolvedTag}`)
  }
  if (identity.releaseChannel !== 'beta') {
    throw new ManifestError(
      `build identity releaseChannel must be 'beta' for a candidate manifest, got ${identity.releaseChannel}`,
    )
  }
  if (resolvedTag !== null && resolvedTag !== `v${identity.appVersion}`) {
    throw new ManifestError(
      `tag ${resolvedTag} does not match package version v${identity.appVersion} - version/tag mismatch blocks release`,
    )
  }

  let signing
  if (signingThumbprint !== null || signingSubject !== null) {
    if (signingThumbprint === null || !THUMBPRINT_RE.test(signingThumbprint)) {
      throw new ManifestError('--signing-thumbprint must be a 40-hex certificate thumbprint')
    }
    signing = {
      status: 'signed',
      thumbprint: signingThumbprint.toLowerCase(),
      subject: signingSubject,
      hashAlgorithm: 'sha256',
      timestampAuthority: 'rfc3161',
    }
  } else {
    if (!allowUnsigned) {
      throw new ManifestError(
        'no signing identity supplied - pass --signing-thumbprint after verify-signatures.ps1, or --allow-unsigned for an honestly unsealed dry run (EXT-02)',
      )
    }
    signing = {
      status: 'unsealed',
      thumbprint: null,
      subject: null,
      hashAlgorithm: null,
      timestampAuthority: null,
    }
  }

  const artifacts = collectArtifacts(inputDir)
  requireInstaller(artifacts)

  const runUrl =
    ci.GITHUB_SERVER_URL && ci.GITHUB_REPOSITORY && ci.GITHUB_RUN_ID
      ? `${ci.GITHUB_SERVER_URL}/${ci.GITHUB_REPOSITORY}/actions/runs/${ci.GITHUB_RUN_ID}` +
        (ci.GITHUB_RUN_ATTEMPT ? `/attempts/${ci.GITHUB_RUN_ATTEMPT}` : '')
      : null

  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    generatedAtUtc: now.toISOString(),
    identity: {
      productName: identity.productName,
      appVersion: identity.appVersion,
      buildId: identity.buildId,
      gitSha: identity.gitSha,
      saveSchemaVersion: identity.saveSchemaVersion,
      backendEnvironment: identity.backendEnvironment,
      releaseChannel: identity.releaseChannel,
      builtAtUtc: identity.builtAtUtc,
    },
    signing,
    // Spec B5/B6 contract: schema_version is the save compatibility
    // authority; buildId is correlation only. Downgrades and
    // cross-environment moves are blocked by policy, never inferred.
    migrationContract: {
      saveSchemaVersion: identity.saveSchemaVersion,
      backendEnvironment: identity.backendEnvironment,
      releaseChannel: identity.releaseChannel,
      downgrade: 'blocked',
      crossEnvironment: 'blocked',
      authority: 'schema_version',
    },
    provenance: {
      repository: ci.GITHUB_REPOSITORY ?? null,
      tag: resolvedTag,
      gitSha: identity.gitSha,
      workflow: ci.GITHUB_WORKFLOW ?? null,
      runId: ci.GITHUB_RUN_ID ?? null,
      runNumber: ci.GITHUB_RUN_NUMBER ?? null,
      runAttempt: ci.GITHUB_RUN_ATTEMPT ?? null,
      workflowRunUrl: runUrl,
      runner: {
        os: ci.RUNNER_OS ?? null,
        arch: ci.RUNNER_ARCH ?? null,
        imageOS: ci.ImageOS ?? null,
        imageVersion: ci.ImageVersion ?? null,
      },
      toolchain: readToolchain(),
    },
    artifacts,
  }
}

function readToolchain() {
  let electronBuilder = null
  try {
    electronBuilder = JSON.parse(
      fs.readFileSync(path.join(GAME_ROOT, 'node_modules', 'electron-builder', 'package.json'), 'utf8'),
    ).version
  } catch {
    electronBuilder = null
  }
  return {
    node: process.version,
    electronBuilder,
  }
}

// Recomputes every listed file's SHA-256 against the manifest. Returns the
// list of problems ([] = manifest matches bytes on disk). publish-candidate
// calls this before any upload so a stale or corrupted release dir cannot
// ship under the manifest's name.
export function verifyArtifacts(manifest, inputDir) {
  const problems = []
  if (!manifest || !Array.isArray(manifest.artifacts)) {
    return ['manifest has no artifacts array']
  }
  for (const artifact of manifest.artifacts) {
    if (typeof artifact.file !== 'string' || artifact.file === '') {
      problems.push('manifest artifact with no file name')
      continue
    }
    if (artifact.file.includes('..') || path.isAbsolute(artifact.file)) {
      problems.push(`manifest artifact path escapes the release dir: ${artifact.file}`)
      continue
    }
    if (!SHA256_HEX_RE.test(artifact.sha256 ?? '')) {
      problems.push(`manifest artifact ${artifact.file} has no SHA-256 hex digest`)
      continue
    }
    const filePath = path.join(inputDir, artifact.file)
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      problems.push(`manifest artifact missing on disk: ${artifact.file}`)
      continue
    }
    const actual = sha256File(filePath)
    if (actual !== artifact.sha256.toLowerCase()) {
      problems.push(
        `artifact hash drifted since manifest generation: ${artifact.file} ` +
          `(manifest ${artifact.sha256}, disk ${actual})`,
      )
    }
  }
  return problems
}

export function parseArgs(argv) {
  const args = {
    input: null,
    identity: path.join(GAME_ROOT, 'dist', 'build-identity.json'),
    out: null,
    checksums: null,
    signingThumbprint: null,
    signingSubject: null,
    allowUnsigned: false,
    tag: null,
    verify: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--input') args.input = argv[++i]
    else if (a === '--identity') args.identity = argv[++i]
    else if (a === '--out') args.out = argv[++i]
    else if (a === '--checksums') args.checksums = argv[++i]
    else if (a === '--signing-thumbprint') args.signingThumbprint = argv[++i]
    else if (a === '--signing-subject') args.signingSubject = argv[++i]
    else if (a === '--allow-unsigned') args.allowUnsigned = true
    else if (a === '--tag') args.tag = argv[++i]
    else if (a === '--verify') args.verify = argv[++i]
    else if (a === '--help' || a === '-h') return { help: true }
    else throw new ManifestError(`unknown argument: ${a}`)
  }
  return args
}

export function main(argv) {
  const args = parseArgs(argv)
  if (args.help) {
    console.log(
      'usage: manifest.mjs --input <release-dir> [--tag v<ver>] [--identity <path>] ' +
        '[--signing-thumbprint <40hex>] [--signing-subject <cn>] [--allow-unsigned] ' +
        '[--out <path>] [--checksums <path>]\n' +
        '       manifest.mjs --verify <release-manifest.json> [--input <release-dir>]',
    )
    return
  }

  if (args.verify !== null) {
    const manifest = JSON.parse(fs.readFileSync(args.verify, 'utf8'))
    const inputDir = path.resolve(args.input ?? path.dirname(args.verify))
    const problems = verifyArtifacts(manifest, inputDir)
    for (const p of problems) console.error(`manifest verify: ${p}`)
    console.log(
      problems.length === 0
        ? `manifest verify OK: ${manifest.artifacts.length} artifacts match their recorded SHA-256`
        : `manifest verify FAILED: ${problems.length} problem(s)`,
    )
    process.exitCode = problems.length ? 1 : 0
    return
  }

  if (!args.input) throw new ManifestError('--input <release-dir> is required')
  const inputDir = path.resolve(args.input)
  const out = path.resolve(args.out ?? path.join(inputDir, MANIFEST_FILENAME))
  const checksumsPath = path.resolve(
    args.checksums ?? path.join(inputDir, CHECKSUMS_FILENAME),
  )

  const manifest = generateManifest({
    inputDir,
    identityPath: path.resolve(args.identity),
    signingThumbprint: args.signingThumbprint,
    signingSubject: args.signingSubject,
    allowUnsigned: args.allowUnsigned,
    tag: args.tag,
    env: process.env,
  })

  // Checksums are written first over the publishable artifacts, then hashed
  // itself and folded into the manifest - the manifest can record the
  // checksum file but never itself.
  fs.writeFileSync(checksumsPath, formatChecksums(manifest.artifacts))
  manifest.artifacts.push({
    file: path.basename(checksumsPath),
    kind: 'checksums',
    publish: true,
    bytes: fs.statSync(checksumsPath).size,
    sha256: sha256File(checksumsPath),
  })
  fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n')

  const publishCount = manifest.artifacts.filter((a) => a.publish).length
  console.log(
    `manifest: ${publishCount} publishable artifact(s) hashed, signing=${manifest.signing.status} -> ${path.relative(process.cwd(), out)}`,
  )
  process.exitCode = 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2))
  } catch (e) {
    if (e instanceof ManifestError) {
      console.error(`manifest: ${e.message}`)
      process.exitCode = 1
    } else {
      throw e
    }
  }
}
