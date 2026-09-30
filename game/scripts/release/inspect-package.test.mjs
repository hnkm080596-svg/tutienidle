// Packaged-payload inspection tests (BETA-FINAL PR8, spec B3).
// Run: node --test scripts/release/inspect-package.test.mjs
// Covers: single-candidate resolution (zero/multiple refused), allowlist
// enforcement on disk and inside app.asar, deny patterns for source/test/
// credential/dev-tool/log content, required entries and identity agreement.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  InspectPackageError,
  findCandidate,
  globToRegExp,
  inspectPackage,
  listAsarFiles,
  readAsar,
} from './inspect-package.mjs'

const GAME_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const REAL_MANIFEST = path.join(GAME_ROOT, 'build', 'package-manifest.json')
const ROOT_VERSION = JSON.parse(
  fs.readFileSync(path.join(GAME_ROOT, 'package.json'), 'utf8'),
).version

// ---------------------------------------------------------------------------
// Fixture builders - produce a REAL asar binary layout so the production
// parser is exercised end to end (not a mock that shares its bug).
// [4B=4][4B headerBufLen][4B payloadSize][4B jsonLen][json][pad4][data...]
function buildAsarBuffer(entries) {
  const root = { files: {} }
  const chunks = []
  let offset = 0
  for (const [p, content] of Object.entries(entries)) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content)
    const parts = p.split('/')
    let node = root
    for (const part of parts.slice(0, -1)) {
      node.files[part] ??= { files: {} }
      node = node.files[part]
    }
    node.files[parts[parts.length - 1]] = { size: data.length, offset: String(offset) }
    chunks.push(data)
    offset += data.length
  }
  const json = Buffer.from(JSON.stringify(root), 'utf8')
  const pad = (4 - (json.length % 4)) % 4
  const headerBuf = Buffer.alloc(8 + json.length + pad)
  headerBuf.writeUInt32LE(4 + json.length + pad, 0)
  headerBuf.writeUInt32LE(json.length, 4)
  json.copy(headerBuf, 8)
  const sizePickle = Buffer.alloc(8)
  sizePickle.writeUInt32LE(4, 0)
  sizePickle.writeUInt32LE(headerBuf.length, 4)
  return Buffer.concat([sizePickle, headerBuf, ...chunks])
}

const BASE_ASAR_FILES = {
  'package.json': JSON.stringify({
    name: 'tien-hiep-idle',
    productName: 'Tien Hiep Idle',
    version: ROOT_VERSION,
    main: 'dist-electron/main.js',
  }),
  'dist/index.html': '<html></html>',
  'dist/build-identity.json': JSON.stringify({ productName: 'Tien Hiep Idle' }),
  'dist/assets/index-abc123.js': 'console.log(1)',
  'dist-electron/main.js': '// main bundle',
  'dist-electron/preload.mjs': '// preload bundle',
  'build/icon.ico': 'ICONDATA',
}

const BASE_DISK_FILES = [
  'TienHiepIdle.exe',
  'ffmpeg.dll',
  'libGLESv2.dll',
  'icudtl.dat',
  'resources.pak',
  'snapshot_blob.bin',
  'v8_context_snapshot.bin',
  'vk_swiftshader_icd.json',
  'version',
  'LICENSE.electron.txt',
  'LICENSES.chromium.html',
  'locales/en-US.pak',
  'resources/elevate.exe',
  'resources/app.asar.unpacked/build/icon.ico',
]

// Writes release/<candidateName>/ + optional extra disk/asar files.
function makeRelease({
  candidateName = 'win-unpacked',
  diskFiles = [],
  omitDisk = [],
  asarFiles = {},
  omitAsar = [],
  installer = 'Tien Hiep Idle-0.1.0-beta.0-Setup.exe',
} = {}) {
  const release = fs.mkdtempSync(path.join(os.tmpdir(), 'inspect-pkg-'))
  const candidate = path.join(release, candidateName)
  const allDisk = [...BASE_DISK_FILES, ...diskFiles].filter((f) => !omitDisk.includes(f))
  for (const rel of allDisk) {
    const p = path.join(candidate, rel)
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, 'stub')
  }
  const asarEntries = { ...BASE_ASAR_FILES, ...asarFiles }
  for (const k of omitAsar) delete asarEntries[k]
  fs.mkdirSync(path.join(candidate, 'resources'), { recursive: true })
  fs.writeFileSync(path.join(candidate, 'resources', 'app.asar'), buildAsarBuffer(asarEntries))
  if (installer !== null) {
    fs.writeFileSync(path.join(release, installer), 'stub')
  }
  return release
}

function problemsOf(release, manifestPath = REAL_MANIFEST) {
  return inspectPackage({ inputDir: release, manifestPath }).problems
}

describe('globToRegExp', () => {
  it('matches segment globs and directory globs as intended', () => {
    for (const [glob, yes, no] of [
      ['*.dll', ['a.dll', 'x.dll'], ['d/a.dll', 'a.exee']],
      ['dist/**', ['dist/a.js', 'dist/a/b/c.png'], ['dist2/a', 'src/dist/a']],
      ['**/*.ts', ['a.ts', 'x/y/a.ts'], ['a.tsx.bak', 'a.js']],
      ['**/node_modules/**', ['node_modules/a/index.js', 'x/node_modules/y/z'], ['node_modules2/a']],
      ['**/.env*', ['.env', '.env.local', 'a/.env.production'], ['env.js', 'a/env.js']],
      ['locales/*.pak', ['locales/en-US.pak'], ['locales/deep/x.pak']],
    ]) {
      const re = globToRegExp(glob)
      for (const p of yes) assert.ok(re.test(p), `${glob} should match ${p}`)
      for (const p of no) assert.ok(!re.test(p), `${glob} should NOT match ${p}`)
    }
  })
})

describe('findCandidate', () => {
  it('accepts --input that is itself the unpacked app dir', () => {
    const release = makeRelease()
    const candidate = path.join(release, 'win-unpacked')
    assert.equal(findCandidate(candidate), candidate)
  })

  it('accepts a release dir with exactly one candidate', () => {
    const release = makeRelease()
    assert.equal(findCandidate(release), path.join(release, 'win-unpacked'))
  })

  it('refuses when no candidate exists', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'inspect-empty-'))
    assert.throws(() => findCandidate(empty), InspectPackageError)
  })

  it('refuses ambiguous multiple candidates instead of guessing', () => {
    const release = makeRelease()
    // second candidate - a stale parallel build
    const second = path.join(release, 'win32-unpacked')
    fs.mkdirSync(path.join(second, 'resources'), { recursive: true })
    fs.writeFileSync(path.join(second, 'resources', 'app.asar'), buildAsarBuffer(BASE_ASAR_FILES))
    assert.throws(() => findCandidate(release), /ambiguous/)
    assert.throws(() => findCandidate(release), InspectPackageError)
  })

  it('refuses a non-directory --input', () => {
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'inspect-file-')), 'x')
    fs.writeFileSync(f, 'x')
    assert.throws(() => findCandidate(f), InspectPackageError)
  })
})

describe('inspectPackage - happy path', () => {
  it('accepts a well-formed payload against the real allowlist manifest', () => {
    const release = makeRelease()
    const { problems, diskFiles, asarFiles } = inspectPackage({
      inputDir: release,
      manifestPath: REAL_MANIFEST,
    })
    assert.deepEqual(problems, [])
    assert.ok(diskFiles.includes('resources/app.asar'))
    assert.ok(asarFiles.includes('dist-electron/main.js'))
  })

  it('works when --input points directly at the unpacked dir', () => {
    const release = makeRelease()
    const { problems } = inspectPackage({
      inputDir: path.join(release, 'win-unpacked'),
      manifestPath: REAL_MANIFEST,
    })
    assert.deepEqual(problems, [])
  })
})

describe('inspectPackage - deny rules', () => {
  it('rejects source/test/credential/dev-tool/log files shipped on disk', () => {
    const release = makeRelease({
      diskFiles: [
        'debug.log',
        'secrets.pem',
        'coverage/lcov-report/index.ts',
      ],
      asarFiles: { 'dist/keep.js': 'x' },
    })
    const problems = problemsOf(release)
    assert.ok(problems.some((p) => p.includes('debug.log')))
    assert.ok(problems.some((p) => p.includes('secrets.pem')))
    assert.ok(problems.some((p) => p.includes('index.ts')))
  })

  it('rejects denied content inside app.asar', () => {
    const release = makeRelease({
      asarFiles: {
        'src/main.ts': 'source code',
        'dist/app.test.js': 'test',
        '.env': 'SUPABASE_KEY=abc',
        'node_modules/evil/index.js': 'x',
        'docs/devtools/notes.txt': 'x',
        'logs/session.log': 'x',
      },
    })
    const problems = problemsOf(release)
    for (const expected of ['src/main.ts', 'dist/app.test.js', '.env', 'node_modules/evil/index.js', 'logs/session.log']) {
      assert.ok(
        problems.some((p) => p.includes(expected)),
        `expected a violation for ${expected}, got: ${problems.join('; ')}`,
      )
    }
  })

  it('rejects files that are merely not allowlisted (default-deny)', () => {
    const release = makeRelease({
      diskFiles: ['mystery.exe'],
      asarFiles: { 'vendor/blob.wasm': 'x' },
    })
    const problems = problemsOf(release)
    assert.ok(problems.some((p) => p.includes('mystery.exe')))
    assert.ok(problems.some((p) => p.includes('vendor/blob.wasm')))
  })
})

describe('inspectPackage - required entries and identity', () => {
  it('requires the runtime icon inside the package at the path main.ts loads', () => {
    const release = makeRelease({ omitAsar: ['build/icon.ico'], omitDisk: ['resources/app.asar.unpacked/build/icon.ico'] })
    const problems = problemsOf(release)
    assert.ok(problems.some((p) => p.includes('build/icon.ico')))
  })

  it('requires every manifest-required asar entry', () => {
    const release = makeRelease({ omitAsar: ['dist/build-identity.json', 'dist-electron/preload.mjs'] })
    const problems = problemsOf(release)
    assert.ok(problems.some((p) => p.includes('dist/build-identity.json')))
    assert.ok(problems.some((p) => p.includes('dist-electron/preload.mjs')))
  })

  it('requires the named executable', () => {
    const release = makeRelease({ omitDisk: ['TienHiepIdle.exe'] })
    assert.ok(problemsOf(release).some((p) => p.includes('TienHiepIdle.exe')))
  })

  it('rejects an asar package.json that disagrees with the manifest identity', () => {
    const release = makeRelease({
      asarFiles: {
        'package.json': JSON.stringify({
          name: 'tien-hiep-idle',
          productName: 'Wrong Name',
          version: ROOT_VERSION,
          main: 'dist-electron/main.js',
        }),
      },
    })
    assert.ok(problemsOf(release).some((p) => p.includes('productName')))
  })

  it('rejects an asar package.json version that drifts from package.json', () => {
    const release = makeRelease({
      asarFiles: {
        'package.json': JSON.stringify({
          name: 'tien-hiep-idle',
          productName: 'Tien Hiep Idle',
          version: '9.9.9-other',
          main: 'dist-electron/main.js',
        }),
      },
    })
    assert.ok(problemsOf(release).some((p) => p.includes('version')))
  })

  it('rejects installer artifacts that do not match the naming contract', () => {
    const release = makeRelease({ installer: 'TienHiepIdle-0.1.0-beta.0-Setup.exe' })
    assert.ok(problemsOf(release).some((p) => p.includes('TienHiepIdle-0.1.0-beta.0-Setup.exe')))
  })
})

describe('inspectPackage - malformed inputs', () => {
  it('throws on a missing manifest', () => {
    const release = makeRelease()
    assert.throws(
      () => inspectPackage({ inputDir: release, manifestPath: path.join(release, 'nope.json') }),
      InspectPackageError,
    )
  })

  it('throws on a manifest without the required sections', () => {
    const release = makeRelease()
    const bad = path.join(release, 'bad.json')
    fs.writeFileSync(bad, JSON.stringify({ identity: { productName: 'x' } }))
    assert.throws(
      () => inspectPackage({ inputDir: release, manifestPath: bad }),
      InspectPackageError,
    )
  })

  it('reports a corrupt asar instead of crashing', () => {
    const release = makeRelease()
    fs.writeFileSync(path.join(release, 'win-unpacked', 'resources', 'app.asar'), 'garbage')
    assert.throws(
      () => inspectPackage({ inputDir: release, manifestPath: REAL_MANIFEST }),
      InspectPackageError,
    )
  })
})

describe('asar reader (real binary layout)', () => {
  it('parses the header and lists nested files', () => {
    const buf = buildAsarBuffer({ 'a/b/c.js': 'x', 'top.js': 'y' })
    const { header, dataStart } = readAsar(buf)
    const files = listAsarFiles(header)
    assert.deepEqual([...files.keys()].sort(), ['a/b/c.js', 'top.js'])
    const entry = files.get('top.js')
    assert.equal(buf.subarray(dataStart + Number(entry.offset), dataStart + Number(entry.offset) + entry.size).toString(), 'y')
  })
})
