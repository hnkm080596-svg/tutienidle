#!/usr/bin/env node
// BETA-FINAL PR8 / spec B3 - packaged payload inspection.
//
// Locates exactly ONE packaged app candidate under --input (an
// electron-builder release dir containing <target>-unpacked/, or the
// unpacked app dir itself - recognised by resources/app.asar), enumerates
// every file on disk plus every entry inside app.asar, and compares each
// against the allowlist manifest (default: build/package-manifest.json).
// Deny patterns always win: source, test, credential, dev-tool and log
// content must never ship. Multiple or zero candidates is a hard refusal -
// the script never guesses which payload is authoritative.
//
// Usage: node scripts/release/inspect-package.mjs --input release
//            [--manifest build/package-manifest.json]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export class InspectPackageError extends Error {
  constructor(message) {
    super(message)
    this.name = 'InspectPackageError'
  }
}

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const GAME_ROOT = path.resolve(SCRIPT_DIR, '..', '..')

// ---------------------------------------------------------------------------
// Glob matching: '*' within a path segment, '**' across segments (a trailing
// '**' matches anything below; a '**/' prefix matches zero or more dirs).
// All paths are compared as posix-style relative paths.
export function globToRegExp(glob) {
  let re = ''
  let i = 0
  while (i < glob.length) {
    const c = glob[i]
    if (c === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') {
          re += '(?:.*/)?'
          i += 3
        } else {
          re += '.*'
          i += 2
        }
      } else {
        re += '[^/]*'
        i += 1
      }
    } else if (c === '?') {
      re += '[^/]'
      i += 1
    } else {
      re += c.replace(/[$+.^(){}[\]|\\]/g, '\\$&')
      i += 1
    }
  }
  return new RegExp(`^${re}$`)
}

function compileGlobs(globs, label) {
  if (!Array.isArray(globs)) {
    throw new InspectPackageError(`manifest ${label} must be an array of globs`)
  }
  return globs.map((g) => {
    if (typeof g !== 'string' || g === '') {
      throw new InspectPackageError(`manifest ${label} contains a non-string/empty glob`)
    }
    return globToRegExp(g)
  })
}

const matchesAny = (regexes, p) => regexes.some((re) => re.test(p))

// ---------------------------------------------------------------------------
// asar reader: [4B pickle-size=4][4B headerSize][4B payloadSize][4B jsonLen]
// [jsonLen bytes of JSON][pad to 4][file data]. Entry offsets are relative
// to the data section start (8 + headerSize). See electron/asar disk format.
export function readAsar(buf) {
  if (buf.length < 16 || buf.readUInt32LE(0) !== 4) {
    throw new InspectPackageError('resources/app.asar is not a readable asar archive')
  }
  const headerSize = buf.readUInt32LE(4)
  const jsonLen = buf.readUInt32LE(12)
  if (8 + headerSize > buf.length || 16 + jsonLen > buf.length) {
    throw new InspectPackageError('resources/app.asar header is truncated')
  }
  let header
  try {
    header = JSON.parse(buf.toString('utf8', 16, 16 + jsonLen))
  } catch {
    throw new InspectPackageError('resources/app.asar header is not valid JSON')
  }
  return { header, dataStart: 8 + headerSize }
}

// Walks the nested asar header ({files:{dir:{files:{name:entry}}}}) and
// returns { path: entry } for every file (offset present) in the archive.
export function listAsarFiles(header) {
  const out = new Map()
  const walk = (node, prefix) => {
    for (const [name, entry] of Object.entries(node.files ?? {})) {
      const p = prefix === '' ? name : `${prefix}/${name}`
      if (entry.files && typeof entry.files === 'object') {
        walk(entry, p)
      } else {
        out.set(p, entry)
      }
    }
  }
  walk(header, '')
  return out
}

export function readAsarFile(buf, dataStart, entry) {
  const offset = Number(entry.offset)
  const size = Number(entry.size)
  if (!Number.isFinite(offset) || !Number.isFinite(size)) {
    throw new InspectPackageError('asar entry has no numeric offset/size')
  }
  const start = dataStart + offset
  if (start + size > buf.length) {
    throw new InspectPackageError('asar entry extends past end of archive')
  }
  return buf.subarray(start, start + size)
}

// ---------------------------------------------------------------------------
export function listDiskFiles(dir) {
  const out = []
  const walk = (d, prefix) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`
      if (entry.isDirectory()) walk(path.join(d, entry.name), rel)
      else if (entry.isFile()) out.push(rel)
    }
  }
  walk(dir, '')
  return out.sort()
}

// The payload candidate is a directory that contains resources/app.asar:
// either --input itself or exactly one of its immediate subdirectories.
export function findCandidate(inputDir) {
  if (!fs.existsSync(inputDir) || !fs.statSync(inputDir).isDirectory()) {
    throw new InspectPackageError(`--input is not a directory: ${inputDir}`)
  }
  const hasAsar = (d) => fs.existsSync(path.join(d, 'resources', 'app.asar'))
  if (hasAsar(inputDir)) {
    return inputDir
  }
  const candidates = fs
    .readdirSync(inputDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && hasAsar(path.join(inputDir, e.name)))
    .map((e) => path.join(inputDir, e.name))
  if (candidates.length === 0) {
    throw new InspectPackageError(
      `no packaged app candidate under ${inputDir} (expected a directory containing resources/app.asar)`,
    )
  }
  if (candidates.length > 1) {
    throw new InspectPackageError(
      `ambiguous packaged payload: ${candidates.length} candidates under ${inputDir}: ` +
        candidates.map((c) => path.basename(c)).join(', ') +
        ' - pass the specific unpacked dir via --input',
    )
  }
  return candidates[0]
}

export function loadManifest(manifestPath) {
  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch {
    throw new InspectPackageError(`cannot read allowlist manifest: ${manifestPath}`)
  }
  const identity = manifest.identity
  if (
    !identity ||
    typeof identity.productName !== 'string' ||
    typeof identity.appId !== 'string' ||
    typeof identity.executableName !== 'string' ||
    typeof identity.publisher !== 'string' ||
    typeof identity.installerArtifactPattern !== 'string'
  ) {
    throw new InspectPackageError('manifest identity must define appId/productName/executableName/publisher/installerArtifactPattern')
  }
  for (const section of ['unpackedApp', 'asar']) {
    if (!manifest[section] || !Array.isArray(manifest[section].allow)) {
      throw new InspectPackageError(`manifest ${section}.allow must be an array`)
    }
  }
  return manifest
}

function readJsonFromAsar(buf, dataStart, files, p) {
  const entry = files.get(p)
  if (!entry) return null
  try {
    return JSON.parse(readAsarFile(buf, dataStart, entry).toString('utf8'))
  } catch {
    return null
  }
}

// Returns { candidate, problems, diskFiles, asarFiles } - problems is a list
// of contract violations ([] = the payload satisfies the manifest).
export function inspectPackage({ inputDir, manifestPath }) {
  const manifest = loadManifest(manifestPath)
  const candidate = findCandidate(inputDir)
  const problems = []

  const deny = compileGlobs(manifest.deny ?? [], 'deny')
  const allowUnpacked = compileGlobs(manifest.unpackedApp.allow, 'unpackedApp.allow')
  const denyUnpacked = compileGlobs(manifest.unpackedApp.deny ?? [], 'unpackedApp.deny')
  const allowAsar = compileGlobs(manifest.asar.allow, 'asar.allow')
  const denyAsar = compileGlobs(manifest.asar.deny ?? [], 'asar.deny')

  // -- files on disk inside the candidate ----------------------------------
  const diskFiles = listDiskFiles(candidate)
  for (const rel of diskFiles) {
    if (matchesAny(deny, rel) || matchesAny(denyUnpacked, rel)) {
      problems.push(`denied content shipped: ${rel}`)
    } else if (!matchesAny(allowUnpacked, rel)) {
      problems.push(`file not allowlisted: ${rel}`)
    }
  }
  for (const required of manifest.required ?? []) {
    if (!diskFiles.includes(required)) {
      problems.push(`required payload file missing: ${required}`)
    }
  }
  if (!diskFiles.includes(manifest.identity.executableName)) {
    problems.push(`expected executable missing: ${manifest.identity.executableName}`)
  }

  // -- entries inside resources/app.asar ------------------------------------
  const asarPath = path.join(candidate, 'resources', 'app.asar')
  let asarFiles = new Map()
  if (fs.existsSync(asarPath)) {
    const buf = fs.readFileSync(asarPath)
    const { header, dataStart } = readAsar(buf)
    asarFiles = listAsarFiles(header)
    for (const rel of asarFiles.keys()) {
      if (matchesAny(deny, rel) || matchesAny(denyAsar, rel)) {
        problems.push(`denied content shipped in app.asar: ${rel}`)
      } else if (!matchesAny(allowAsar, rel)) {
        problems.push(`asar entry not allowlisted: ${rel}`)
      }
    }
    for (const required of manifest.asar.required ?? []) {
      if (!asarFiles.has(required)) {
        problems.push(`required asar entry missing: ${required}`)
      }
    }

    // -- identity agreement -------------------------------------------------
    const appPkg = readJsonFromAsar(buf, dataStart, asarFiles, 'package.json')
    if (appPkg === null) {
      problems.push('asar package.json is missing or unreadable')
    } else {
      if (appPkg.productName !== manifest.identity.productName) {
        problems.push(
          `asar package.json productName ${JSON.stringify(appPkg.productName)} != manifest ${JSON.stringify(manifest.identity.productName)}`,
        )
      }
      const rootVersion = JSON.parse(
        fs.readFileSync(path.join(GAME_ROOT, 'package.json'), 'utf8'),
      ).version
      if (appPkg.version !== rootVersion) {
        problems.push(`asar package.json version ${JSON.stringify(appPkg.version)} != package.json ${JSON.stringify(rootVersion)}`)
      }
      if (appPkg.main !== 'dist-electron/main.js') {
        problems.push(`asar package.json main ${JSON.stringify(appPkg.main)} != "dist-electron/main.js"`)
      }
    }
    const identityJson = readJsonFromAsar(buf, dataStart, asarFiles, 'dist/build-identity.json')
    if (identityJson !== null && identityJson.productName !== manifest.identity.productName) {
      problems.push(
        `build-identity.json productName ${JSON.stringify(identityJson.productName)} != manifest ${JSON.stringify(manifest.identity.productName)}`,
      )
    }
  }

  // -- installer artifact naming (only when --input is the release dir) -----
  if (candidate !== inputDir) {
    const installerRe = globToRegExp(manifest.identity.installerArtifactPattern)
    const artifacts = fs
      .readdirSync(inputDir, { withFileTypes: true })
      .filter((e) => e.isFile() && /-Setup\.exe$/i.test(e.name))
      .map((e) => e.name)
    for (const a of artifacts) {
      if (!installerRe.test(a)) {
        problems.push(`installer artifact name does not match ${manifest.identity.installerArtifactPattern}: ${a}`)
      }
    }
  }

  return { candidate, problems, diskFiles, asarFiles: [...asarFiles.keys()] }
}

export function parseArgs(argv) {
  let input = null
  let manifest = path.join(GAME_ROOT, 'build', 'package-manifest.json')
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input') input = argv[++i]
    else if (argv[i] === '--manifest') manifest = argv[++i]
    else if (argv[i] === '--help' || argv[i] === '-h') return { help: true }
    else throw new InspectPackageError(`unknown argument: ${argv[i]}`)
  }
  if (!input) throw new InspectPackageError('--input <dir> is required')
  return { input: path.resolve(input), manifest: path.resolve(manifest) }
}

export function main(argv) {
  const args = parseArgs(argv)
  if (args.help) {
    console.log('usage: inspect-package.mjs --input <dir> [--manifest <path>]')
    return
  }
  const { candidate, problems, diskFiles, asarFiles } = inspectPackage({
    inputDir: args.input,
    manifestPath: args.manifest,
  })
  console.log(
    `inspected ${path.relative(process.cwd(), candidate)}: ` +
      `${diskFiles.length} files on disk, ${asarFiles.length} asar entries`,
  )
  for (const p of problems) console.error(`inspect-package: ${p}`)
  if (problems.length === 0) {
    console.log('inspect-package OK: payload satisfies the allowlist manifest')
  }
  process.exitCode = problems.length ? 1 : 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
}
