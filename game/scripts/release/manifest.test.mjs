// Release manifest tests (BETA-FINAL PR10, spec B5).
// Run: node --test scripts/release/manifest.test.mjs
// Covers: artifact classification/enumeration strictness, checksum
// generation over final bytes, signing identity recording (signed vs
// honestly unsealed), tag/version rejection, provenance env allowlist, and
// hash-drift verification.
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  ManifestError,
  classifyArtifactFile,
  collectArtifacts,
  formatChecksums,
  generateManifest,
  requireInstaller,
  verifyArtifacts,
} from './manifest.mjs'

const IDENTITY = {
  productName: 'Tien Hiep Idle',
  appVersion: '0.1.0-beta.0',
  buildId: '12345-7',
  gitSha: 'a'.repeat(40),
  saveSchemaVersion: 7,
  backendEnvironment: 'beta',
  releaseChannel: 'beta',
  builtAtUtc: '2026-09-30T00:00:00.000Z',
}
const THUMBPRINT = 'a1b2c3'.padEnd(40, 'd')

let dir // release dir (artifacts only)
let scratch // sidecar dir (identity json lives outside the release dir)
let identityPath

function writeFile(name, content) {
  const p = path.join(dir, name)
  fs.writeFileSync(p, content)
  return p
}
function writeIdentity(overrides = {}) {
  identityPath = path.join(scratch, 'build-identity.json')
  fs.writeFileSync(identityPath, JSON.stringify({ ...IDENTITY, ...overrides }))
}
function seedReleaseDir() {
  writeFile('Tien Hiep Idle-0.1.0-beta.0-Setup.exe', 'signed-installer-bytes')
  writeFile('Tien Hiep Idle-0.1.0-beta.0-Setup.exe.blockmap', 'blockmap-bytes')
  writeFile('beta.yml', 'version: 0.1.0-beta.0\n')
  writeFile('builder-effective-config.yaml', 'appId: com.fdlmg.tutienidle\n')
  writeFile('sbom.cdx.json', '{"bomFormat":"CycloneDX"}')
}
const baseArgs = () => ({ inputDir: dir, identityPath, env: {} })

beforeEach(() => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-'))
  dir = path.join(root, 'release')
  scratch = path.join(root, 'scratch')
  fs.mkdirSync(dir)
  fs.mkdirSync(scratch)
  writeIdentity()
  seedReleaseDir()
})
afterEach(() => fs.rmSync(path.dirname(dir), { recursive: true, force: true }))

describe('classifyArtifactFile', () => {
  it('classifies the electron-builder release surface', () => {
    assert.deepEqual(classifyArtifactFile('Tien Hiep Idle-0.1.0-beta.0-Setup.exe'), {
      kind: 'installer',
      publish: true,
    })
    assert.equal(classifyArtifactFile('x-Setup.exe.blockmap').kind, 'blockmap')
    assert.equal(classifyArtifactFile('beta.yml').kind, 'update-metadata')
    assert.equal(classifyArtifactFile('latest.yml').kind, 'update-metadata')
    assert.equal(classifyArtifactFile('builder-effective-config.yaml').kind, 'build-config')
    assert.equal(classifyArtifactFile('sbom.cdx.json').kind, 'sbom')
    assert.equal(classifyArtifactFile('checksums.txt').kind, 'checksums')
  })

  it('build-config is evidence, never a published asset', () => {
    assert.equal(classifyArtifactFile('builder-effective-config.yaml').publish, false)
  })

  it('rejects unrecognized names so nothing unclassified ships', () => {
    assert.equal(classifyArtifactFile('notes.txt'), null)
    assert.equal(classifyArtifactFile('payload.dll'), null)
    assert.equal(classifyArtifactFile('build-identity.json'), null)
  })
})

describe('collectArtifacts', () => {
  it('enumerates top-level files with sha256, sorted, directories skipped', () => {
    fs.mkdirSync(path.join(dir, 'win-unpacked'))
    const artifacts = collectArtifacts(dir)
    const files = artifacts.map((a) => a.file)
    assert.deepEqual(files, [...files].sort((x, y) => x.localeCompare(y)))
    const installer = artifacts.find((a) => a.kind === 'installer')
    assert.equal(
      installer.sha256,
      crypto.createHash('sha256').update('signed-installer-bytes').digest('hex'),
    )
    assert.ok(artifacts.every((a) => /^[0-9a-f]{64}$/.test(a.sha256)))
    assert.ok(artifacts.every((a) => a.bytes > 0))
    // win-unpacked/ is a directory - payload inspection territory, never an upload artifact
    assert.ok(!files.some((f) => f.startsWith('win-unpacked')))
  })

  it('fails closed on an unexpected artifact', () => {
    writeFile('mystery.exe.tmp', 'x')
    assert.throws(() => collectArtifacts(dir), /unrecognized files.*mystery\.exe\.tmp/)
  })
})

describe('generateManifest', () => {
  const run = (overrides = {}) =>
    generateManifest({ ...baseArgs(), signingThumbprint: THUMBPRINT, ...overrides })

  it('produces the B5 evidence shape', () => {
    const m = run({ tag: 'v0.1.0-beta.0' })
    assert.equal(m.schemaVersion, 1)
    assert.equal(m.identity.appVersion, '0.1.0-beta.0')
    assert.equal(m.identity.saveSchemaVersion, 7)
    assert.equal(m.signing.status, 'signed')
    assert.equal(m.signing.thumbprint, THUMBPRINT.toLowerCase())
    assert.equal(m.signing.hashAlgorithm, 'sha256')
    assert.equal(m.signing.timestampAuthority, 'rfc3161')
    assert.equal(m.migrationContract.saveSchemaVersion, 7)
    assert.equal(m.migrationContract.downgrade, 'blocked')
    assert.equal(m.migrationContract.crossEnvironment, 'blocked')
    assert.equal(m.migrationContract.authority, 'schema_version')
    assert.equal(m.provenance.tag, 'v0.1.0-beta.0')
    assert.ok(m.artifacts.some((a) => a.kind === 'installer'))
    assert.ok(m.artifacts.some((a) => a.kind === 'update-metadata'))
    assert.ok(m.artifacts.some((a) => a.kind === 'blockmap'))
    assert.ok(m.artifacts.some((a) => a.kind === 'sbom'))
    assert.ok(m.artifacts.some((a) => a.kind === 'build-config' && a.publish === false))
  })

  it('tag/version mismatch is a hard failure', () => {
    assert.throws(() => run({ tag: 'v9.9.9' }), ManifestError)
  })

  it('a non-v-prefixed tag is rejected', () => {
    assert.throws(() => run({ tag: '0.1.0-beta.0' }), ManifestError)
  })

  it('non-beta channel is a hard failure', () => {
    writeIdentity({ releaseChannel: 'development' })
    assert.throws(() => run(), /releaseChannel/)
  })

  it('no signing identity fails closed unless --allow-unsigned', () => {
    assert.throws(() => generateManifest(baseArgs()), /allow-unsigned/)
    const m = generateManifest({ ...baseArgs(), allowUnsigned: true })
    assert.equal(m.signing.status, 'unsealed')
    assert.equal(m.signing.thumbprint, null)
    assert.equal(m.signing.hashAlgorithm, null)
  })

  it('a malformed thumbprint is rejected', () => {
    assert.throws(
      () => generateManifest({ ...baseArgs(), signingThumbprint: 'not-hex' }),
      ManifestError,
    )
  })

  it('a missing installer artifact blocks the manifest', () => {
    fs.rmSync(path.join(dir, 'Tien Hiep Idle-0.1.0-beta.0-Setup.exe'))
    assert.throws(() => run(), /no installer artifact/)
  })

  it('records CI provenance from the allowlisted env only', () => {
    const env = {
      GITHUB_REPOSITORY: 'hnkm080596-svg/tutienidle',
      GITHUB_SHA: 'b'.repeat(40),
      GITHUB_REF_NAME: 'v0.1.0-beta.0',
      GITHUB_RUN_ID: '999',
      GITHUB_RUN_ATTEMPT: '1',
      GITHUB_SERVER_URL: 'https://github.com',
      GITHUB_WORKFLOW: 'beta-release',
      RUNNER_OS: 'Windows',
      RUNNER_ARCH: 'X64',
      ImageOS: 'win22',
      ImageVersion: '20260921.1.0',
      WIN_CSC_LINK: 'super-secret-pfx',
      GITHUB_TOKEN: 'ghs_secret',
    }
    const m = generateManifest({
      inputDir: dir,
      identityPath,
      signingThumbprint: THUMBPRINT,
      env,
    })
    assert.equal(m.provenance.repository, 'hnkm080596-svg/tutienidle')
    assert.equal(m.provenance.tag, 'v0.1.0-beta.0')
    assert.equal(m.provenance.runId, '999')
    assert.equal(m.provenance.runner.imageOS, 'win22')
    assert.equal(m.provenance.runner.arch, 'X64')
    assert.equal(
      m.provenance.workflowRunUrl,
      'https://github.com/hnkm080596-svg/tutienidle/actions/runs/999/attempts/1',
    )
    // non-allowlisted vars are invisible - no credential can reach evidence
    const text = JSON.stringify(m)
    assert.ok(!text.includes('super-secret-pfx'))
    assert.ok(!text.includes('ghs_secret'))
  })
})

describe('checksums + verifyArtifacts', () => {
  const manifestForTest = () => ({
    schemaVersion: 1,
    artifacts: collectArtifacts(dir),
  })

  it('checksums.txt is sha256sum-compatible over publishable artifacts', () => {
    const text = formatChecksums(collectArtifacts(dir))
    const lines = text.trim().split('\n')
    assert.ok(lines.every((l) => /^[0-9a-f]{64}  .+$/.test(l)))
    // publish=false files (build-config) are excluded from checksums.txt
    assert.ok(!text.includes('builder-effective-config.yaml'))
    assert.ok(text.includes('Tien Hiep Idle-0.1.0-beta.0-Setup.exe'))
  })

  it('verifyArtifacts passes when bytes are unchanged since generation', () => {
    assert.deepEqual(verifyArtifacts(manifestForTest(), dir), [])
  })

  it('verifyArtifacts catches post-signing tampering', () => {
    const manifest = manifestForTest()
    fs.writeFileSync(path.join(dir, 'beta.yml'), 'tampered: true\n')
    const problems = verifyArtifacts(manifest, dir)
    assert.equal(problems.length, 1)
    assert.ok(problems[0].includes('beta.yml'))
  })

  it('verifyArtifacts catches a deleted artifact', () => {
    const manifest = manifestForTest()
    fs.rmSync(path.join(dir, 'beta.yml'))
    assert.ok(verifyArtifacts(manifest, dir).some((p) => p.includes('missing on disk')))
  })

  it('verifyArtifacts rejects path traversal in manifest entries', () => {
    const manifest = manifestForTest()
    manifest.artifacts.push({ file: '../outside.exe', sha256: 'a'.repeat(64) })
    assert.ok(verifyArtifacts(manifest, dir).some((p) => p.includes('escapes')))
  })

  it('verifyArtifacts rejects a malformed digest', () => {
    const manifest = manifestForTest()
    manifest.artifacts[0].sha256 = 'zzzz'
    assert.ok(verifyArtifacts(manifest, dir).some((p) => p.includes('SHA-256')))
  })
})

describe('requireInstaller', () => {
  it('requires exactly one installer', () => {
    const artifacts = collectArtifacts(dir)
    assert.equal(requireInstaller(artifacts).kind, 'installer')
    artifacts.push({ ...artifacts.find((a) => a.kind === 'installer'), file: 'Other-Setup.exe' })
    assert.throws(() => requireInstaller(artifacts), /ambiguous/)
  })
})
