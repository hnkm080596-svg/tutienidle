#!/usr/bin/env node
// BETA-FINAL PR1 / spec B2 - one immutable BuildIdentity per build.
//
// Reads canonical sources only: package.json version, electron-builder.yml
// productName, CURRENT_SAVE_VERSION from src/services/save/saveVersion.ts
// (regex over source text - a Node script cannot import the TS module, so the
// constant is extracted at its declaration, never duplicated as a second
// literal), full `git rev-parse HEAD` SHA, and an ALLOWLIST of CI env keys.
// Arbitrary process.env values are never read or serialized (P11).
//
// Modes:
//   --json   print the identity JSON for build tooling (vite.config.ts)
//   check    verify dist/build-identity.json, dist/ and dist-electron/ bundles
//            carry the same buildId/gitSha/saveSchemaVersion
//
// Release mode (RELEASE_CHANNEL=beta) fails closed: semantic non-0.0.0
// version, matching v<version> tag, clean git tree, CI build id and a
// non-development backend are all required before any build output exists.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export class BuildIdentityError extends Error {
  constructor(message) {
    super(message)
    this.name = 'BuildIdentityError'
  }
}

const BACKEND_ENVIRONMENTS = new Set(['development', 'staging', 'beta', 'production'])
const RELEASE_CHANNELS = new Set(['development', 'beta'])
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
const GIT_SHA_RE = /^[0-9a-f]{40}$/
// Same UTC shape the TS contract enforces (see src/shared/build/BuildIdentity.ts).
const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
const DEV_GIT_SHA = 'unknown'
const DEV_BUILD_ID = 'dev'

// The complete list of environment variables this script may read. Anything
// else in process.env is invisible to it, so no credential can ride into the
// generated identity.
const ALLOWED_ENV_KEYS = new Set([
  'RELEASE_CHANNEL',
  'BACKEND_ENVIRONMENT',
  'BUILD_ID',
  'GIT_TAG',
  'GITHUB_SHA',
  'GITHUB_RUN_ID',
  'GITHUB_RUN_NUMBER',
  'BUILT_AT_UTC',
])

export function readPackageVersion(rootDir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'))
  if (typeof pkg.version !== 'string' || pkg.version === '') {
    throw new BuildIdentityError('package.json has no usable version field')
  }
  return pkg.version
}

export function readProductName(rootDir) {
  const file = path.join(rootDir, 'electron-builder.yml')
  const text = fs.readFileSync(file, 'utf8')
  const match = /^productName:\s*(.+?)\s*$/m.exec(text)
  if (!match) {
    throw new BuildIdentityError('electron-builder.yml has no productName entry')
  }
  return match[1]
}

export function readSaveSchemaVersion(rootDir) {
  const file = path.join(rootDir, 'src', 'services', 'save', 'saveVersion.ts')
  const text = fs.readFileSync(file, 'utf8')
  const match = /export\s+const\s+CURRENT_SAVE_VERSION\s*=\s*(\d+)/.exec(text)
  if (!match) {
    throw new BuildIdentityError(
      'cannot read CURRENT_SAVE_VERSION from src/services/save/saveVersion.ts - the canonical export moved',
    )
  }
  return Number(match[1])
}

function readEnv(env) {
  const picked = {}
  for (const key of ALLOWED_ENV_KEYS) {
    const value = env[key]
    if (typeof value === 'string' && value !== '') picked[key] = value
  }
  return picked
}

function git(exec, args) {
  return exec('git', args).trim()
}

function optionalGit(exec, args) {
  try {
    const out = git(exec, args)
    return out === '' ? null : out
  } catch {
    return null
  }
}

// Collects the raw inputs for one build. `exec` and `env` are injectable so
// tests exercise the same code path without a real repo or CI.
export function collectIdentityInput({ rootDir, env = {}, exec }) {
  // stdio pipes stdout and swallows git stderr - an untagged repo makes
  // `git describe` print a fatal line on every dev-server start otherwise.
  const run =
    exec ??
    ((cmd, args) =>
      execFileSync(cmd, args, {
        cwd: rootDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }))
  const allowed = readEnv(env)

  const releaseChannel = allowed.RELEASE_CHANNEL ?? 'development'
  const mode = releaseChannel === 'beta' ? 'release' : 'development'

  const gitSha = allowed.GITHUB_SHA ?? optionalGit(run, ['rev-parse', 'HEAD']) ?? DEV_GIT_SHA
  const buildId =
    allowed.BUILD_ID ??
    (allowed.GITHUB_RUN_ID
      ? allowed.GITHUB_RUN_ID + (allowed.GITHUB_RUN_NUMBER ? `-${allowed.GITHUB_RUN_NUMBER}` : '')
      : DEV_BUILD_ID)

  const input = {
    mode,
    productName: readProductName(rootDir),
    appVersion: readPackageVersion(rootDir),
    saveSchemaVersion: readSaveSchemaVersion(rootDir),
    gitSha,
    buildId,
    backendEnvironment: allowed.BACKEND_ENVIRONMENT ?? 'development',
    releaseChannel,
    builtAtUtc: allowed.BUILT_AT_UTC ?? new Date().toISOString(),
  }
  if (mode === 'release') {
    // Tag resolution only matters for release; dev builds never shell out to
    // `git describe` (it does not exist on untagged clones anyway).
    input.releaseTag =
      allowed.GIT_TAG ?? optionalGit(run, ['describe', '--tags', '--exact-match', 'HEAD'])
    try {
      input.cleanTree = git(run, ['status', '--porcelain']) === ''
    } catch {
      input.cleanTree = false
    }
  }
  return input
}

function requireNonEmpty(value, field) {
  if (typeof value !== 'string' || value === '') {
    throw new BuildIdentityError(`build identity field ${field} is missing`)
  }
  return value
}

// Validates one collected input and returns the frozen identity.
export function createBuildIdentity(input) {
  if (input === null || typeof input !== 'object') {
    throw new BuildIdentityError('build identity input must be an object')
  }
  const mode = input.mode === 'release' ? 'release' : 'development'
  const release = mode === 'release'

  const productName = requireNonEmpty(input.productName, 'productName')
  const appVersion = requireNonEmpty(input.appVersion, 'appVersion')
  const gitSha = input.gitSha
  // Development builds carry an explicit 'dev' marker even when the caller
  // did not supply a build id; release builds must come with a CI id.
  const buildId = release ? requireNonEmpty(input.buildId, 'buildId') : (input.buildId || DEV_BUILD_ID)
  const backendEnvironment = requireNonEmpty(input.backendEnvironment, 'backendEnvironment')
  const releaseChannel = requireNonEmpty(input.releaseChannel, 'releaseChannel')
  const builtAtUtc = requireNonEmpty(input.builtAtUtc, 'builtAtUtc')
  const saveSchemaVersion = input.saveSchemaVersion

  if (!Number.isSafeInteger(saveSchemaVersion) || saveSchemaVersion < 0) {
    throw new BuildIdentityError('saveSchemaVersion must be a nonnegative safe integer')
  }
  if (!(typeof gitSha === 'string' && (GIT_SHA_RE.test(gitSha) || (!release && gitSha === DEV_GIT_SHA)))) {
    throw new BuildIdentityError('gitSha must be a full 40-hex commit SHA')
  }
  if (!BACKEND_ENVIRONMENTS.has(backendEnvironment)) {
    throw new BuildIdentityError(`backendEnvironment must be one of ${[...BACKEND_ENVIRONMENTS].join(', ')}`)
  }
  if (!RELEASE_CHANNELS.has(releaseChannel)) {
    throw new BuildIdentityError(`releaseChannel must be one of ${[...RELEASE_CHANNELS].join(', ')}`)
  }
  if (!ISO_UTC_RE.test(builtAtUtc)) {
    throw new BuildIdentityError('builtAtUtc must be an ISO-8601 UTC timestamp')
  }

  if (release) {
    if (!SEMVER_RE.test(appVersion) || appVersion === '0.0.0') {
      throw new BuildIdentityError(`release version must be semantic and not 0.0.0, got ${appVersion}`)
    }
    if (input.releaseTag !== `v${appVersion}`) {
      throw new BuildIdentityError(
        `release tag must be v${appVersion} to match the package version, got ${input.releaseTag ?? 'none'}`,
      )
    }
    if (input.cleanTree !== true) {
      throw new BuildIdentityError('release requires a clean git working tree')
    }
    if (buildId === DEV_BUILD_ID) {
      throw new BuildIdentityError('release requires a CI-provided build id')
    }
    if (backendEnvironment === 'development') {
      throw new BuildIdentityError('a release build cannot target the development backend')
    }
  }

  return Object.freeze({
    productName,
    appVersion,
    buildId,
    gitSha,
    saveSchemaVersion,
    backendEnvironment,
    releaseChannel,
    builtAtUtc,
  })
}

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const GAME_ROOT = path.resolve(SCRIPT_DIR, '..', '..')

function listJsFiles(dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.js')) {
      out.push(path.join(entry.parentPath ?? entry.path, entry.name))
    }
  }
  return out
}

// `check` proves the shipped artifacts agree: the emitted manifest equals the
// identity baked into the renderer bundle and the Electron main bundle.
// Returns the list of problems found ([] = agreement proven).
export function checkArtifacts(rootDir) {
  const distManifest = path.join(rootDir, 'dist', 'build-identity.json')
  const mainManifest = path.join(rootDir, 'dist-electron', 'build-identity.json')
  const problems = []
  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(distManifest, 'utf8'))
  } catch {
    problems.push(`missing or unreadable manifest: ${path.relative(rootDir, distManifest)}`)
  }
  if (manifest && fs.existsSync(mainManifest)) {
    let secondary
    try {
      secondary = JSON.parse(fs.readFileSync(mainManifest, 'utf8'))
    } catch {
      problems.push('dist-electron/build-identity.json is unreadable')
    }
    if (secondary && JSON.stringify(secondary) !== JSON.stringify(manifest)) {
      problems.push('dist-electron/build-identity.json differs from dist/build-identity.json')
    }
  }
  // Every output directory must actually contain built JS. A web-only build
  // has no dist-electron output at all, which is fine - but a dist-electron/
  // directory that exists yet produced no JS is a broken build.
  const bundlesByDir = {}
  for (const dirName of ['dist', 'dist-electron']) {
    const dir = path.join(rootDir, dirName)
    const bundles = listJsFiles(dir)
    bundlesByDir[dirName] = bundles
    if (bundles.length === 0 && (dirName === 'dist' || fs.existsSync(dir))) {
      problems.push(`no built JS bundles found under ${dirName}/`)
    }
  }
  if (manifest) {
    // The define literal lands only in bundles whose modules reference the
    // injected constant, so each output directory is checked as a whole: the
    // renderer identity must appear somewhere under dist/ and the main-process
    // identity somewhere under dist-electron/.
    // Built bundles do not keep JSON spelling: the minifier emits unquoted
    // keys and may rewrite string values to backtick literals, so each field
    // is matched as <key>? : <value> with optional ''/" /backtick quoting.
    const quote = "['\"`]"
    const quoted = (s) => `${quote}${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${quote}`
    const fieldPatterns = {
      productName: `${quote}?productName${quote}?\\s*:\\s*${quoted(manifest.productName)}`,
      appVersion: `${quote}?appVersion${quote}?\\s*:\\s*${quoted(manifest.appVersion)}`,
      buildId: `${quote}?buildId${quote}?\\s*:\\s*${quoted(manifest.buildId)}`,
      gitSha: `${quote}?gitSha${quote}?\\s*:\\s*${quoted(manifest.gitSha)}`,
      saveSchemaVersion: `${quote}?saveSchemaVersion${quote}?\\s*:\\s*${quote}?${manifest.saveSchemaVersion}${quote}?\\b`,
      backendEnvironment: `${quote}?backendEnvironment${quote}?\\s*:\\s*${quoted(manifest.backendEnvironment)}`,
      releaseChannel: `${quote}?releaseChannel${quote}?\\s*:\\s*${quoted(manifest.releaseChannel)}`,
      builtAtUtc: `${quote}?builtAtUtc${quote}?\\s*:\\s*${quoted(manifest.builtAtUtc)}`,
    }
    for (const [dirName, bundles] of Object.entries(bundlesByDir)) {
      // A legitimately-absent dist-electron/ (web-only build) has no bundles
      // to prove; its missing-JS case was handled above.
      if (bundles.length === 0) continue
      for (const [field, pattern] of Object.entries(fieldPatterns)) {
        const re = new RegExp(pattern)
        if (!bundles.some((file) => re.test(fs.readFileSync(file, 'utf8')))) {
          problems.push(`${dirName}/: no bundle carries identity field ${field}=${JSON.stringify(manifest[field])}`)
        }
      }
    }
  }
  return problems
}

export function main(argv) {
  const command = argv[0]
  if (command === 'check') {
    const problems = checkArtifacts(GAME_ROOT)
    for (const p of problems) console.error(`build-identity check: ${p}`)
    if (problems.length === 0) {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(GAME_ROOT, 'dist', 'build-identity.json'), 'utf8'),
      )
      console.log(`build-identity check OK: ${manifest.buildId} @ ${manifest.gitSha}`)
    }
    process.exitCode = problems.length ? 1 : 0
    return
  }
  const input = collectIdentityInput({ rootDir: GAME_ROOT, env: process.env })
  const identity = createBuildIdentity(input)
  if (command === '--json') {
    process.stdout.write(JSON.stringify(identity))
    return
  }
  console.log(JSON.stringify(identity, null, 2))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
}
