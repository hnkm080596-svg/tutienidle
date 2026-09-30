// Candidate publish tests (BETA-FINAL PR10, spec B5).
// Run: node --test scripts/release/publish-candidate.test.mjs
// Covers the acceptance shapes: idempotent unchanged on same-hash retry,
// rejected on different-hash retry, blocked promotion without B10
// certification, and download digest verification. The GitHub provider is
// exercised through an injected fetch; the real-network smoke test skips
// honestly when no credentials are provisioned (EXT-03/EXT-04 unresolved).
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  PublishCandidateError,
  collectUploadFiles,
  githubProvider,
  planUpload,
  promoteCandidate,
  publishCandidate,
} from './publish-candidate.mjs'

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')

const INSTALLER = 'Tien Hiep Idle-0.1.0-beta.0-Setup.exe'
const TAG = 'v0.1.0-beta.0'

let dir
let scratch
let manifestPath

function writeFile(name, content) {
  fs.writeFileSync(path.join(dir, name), content)
}
function seedReleaseDir(installerContent = 'signed-installer-bytes') {
  writeFile(INSTALLER, installerContent)
  writeFile(`${INSTALLER}.blockmap`, 'blockmap-bytes')
  writeFile('beta.yml', 'version: 0.1.0-beta.0\n')
  writeFile('checksums.txt', 'placeholder')
}
function writeManifest() {
  const artifacts = []
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    artifacts.push({
      file: name,
      kind: name.endsWith('.exe') ? 'installer' : name.endsWith('.blockmap') ? 'blockmap' : name === 'beta.yml' ? 'update-metadata' : 'checksums',
      publish: true,
      bytes: fs.statSync(p).size,
      sha256: sha256(fs.readFileSync(p)),
    })
  }
  const manifest = {
    schemaVersion: 1,
    signing: { status: 'signed', thumbprint: 'd'.repeat(40) },
    identity: {
      productName: 'Tien Hiep Idle',
      appVersion: '0.1.0-beta.0',
      gitSha: 'a'.repeat(40),
      saveSchemaVersion: 7,
      backendEnvironment: 'beta',
      releaseChannel: 'beta',
    },
    provenance: { tag: TAG },
    artifacts,
  }
  manifestPath = path.join(scratch, 'release-manifest.json')
  fs.writeFileSync(manifestPath, JSON.stringify(manifest))
  return manifest
}

// In-memory provider implementing the same contract as githubProvider. The
// store records bytes so tamper/replacement attempts are detectable.
function mockProvider() {
  const store = { releases: new Map(), uploads: [] }
  let nextId = 1
  return {
    store,
    async getReleaseByTag(tag) {
      return store.releases.get(tag) ?? null
    },
    async createDraftRelease({ tag, name, body }) {
      const release = { id: nextId++, tag, name, body, draft: true, assets: [] }
      store.releases.set(tag, release)
      return release
    },
    async uploadAsset(release, { name, bytes }) {
      const asset = { id: nextId++, name, digest: `sha256:${sha256(bytes)}`, bytes }
      release.assets.push(asset)
      store.uploads.push({ release: release.tag, name })
      return asset
    },
    async downloadAsset(asset) {
      return asset.bytes
    },
  }
}

const runPublish = (provider, manifest, opts = {}) =>
  publishCandidate({
    provider,
    manifest,
    manifestPath,
    inputDir: dir,
    tag: TAG,
    ...opts,
  })

beforeEach(() => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'candidate-'))
  dir = path.join(root, 'release')
  scratch = path.join(root, 'scratch')
  fs.mkdirSync(dir)
  fs.mkdirSync(scratch)
  seedReleaseDir()
})
afterEach(() => fs.rmSync(path.dirname(dir), { recursive: true, force: true }))

describe('publishCandidate idempotency', () => {
  it('first run uploads every publishable artifact to a draft', async () => {
    const provider = mockProvider()
    const manifest = writeManifest()
    const result = await runPublish(provider, manifest)
    assert.equal(result.status, 'uploaded')
    assert.equal(result.assets[INSTALLER].status, 'uploaded')
    const release = await provider.getReleaseByTag(TAG)
    assert.equal(release.draft, true)
    assert.equal(release.assets.length, 5) // 4 artifacts + release-manifest.json
  })

  it('retry with identical bytes is unchanged - nothing re-uploaded', async () => {
    const provider = mockProvider()
    const manifest = writeManifest()
    await runPublish(provider, manifest)
    const retryUploadWithSameHash = await runPublish(provider, manifest)
    assert.equal(retryUploadWithSameHash.status, 'unchanged')
    assert.equal(provider.store.uploads.length, 5) // only the first run uploaded
  })

  it('retry with different bytes under the same name is rejected and replaces nothing', async () => {
    const provider = mockProvider()
    const manifest = writeManifest()
    const first = await runPublish(provider, manifest)
    assert.equal(first.status, 'uploaded')
    const remoteBefore = (await provider.getReleaseByTag(TAG)).assets.find(
      (a) => a.name === INSTALLER,
    ).digest

    // new candidate bytes (e.g. resigned/rebuilt) under the same tag
    writeFile(INSTALLER, 'different-signed-bytes')
    const manifest2 = writeManifest()
    const retryUploadWithDifferentHash = await runPublish(provider, manifest2)
    assert.equal(retryUploadWithDifferentHash.status, 'rejected')
    assert.equal(retryUploadWithDifferentHash.assets[INSTALLER].status, 'rejected')

    // the draft kept its original bytes - no replacement happened
    const remoteAfter = (await provider.getReleaseByTag(TAG)).assets.find(
      (a) => a.name === INSTALLER,
    )
    assert.equal(remoteAfter.digest, remoteBefore)
    assert.equal(provider.store.uploads.length, 5)
  })

  it('a published (non-draft) release blocks the run outright', async () => {
    const provider = mockProvider()
    const release = await provider.createDraftRelease({ tag: TAG, name: 'x' })
    release.draft = false // someone published it
    const result = await runPublish(provider, writeManifest())
    assert.equal(result.status, 'blocked')
    assert.ok(result.reason.includes('immutable'))
  })

  it('an unsealed manifest cannot reach the candidate feed', async () => {
    const provider = mockProvider()
    const manifest = writeManifest()
    manifest.signing = { status: 'unsealed', thumbprint: null }
    const result = await runPublish(provider, manifest)
    assert.equal(result.status, 'blocked')
    assert.equal(provider.store.uploads.length, 0)
  })

  it('local byte drift between signing and upload blocks the run', async () => {
    const provider = mockProvider()
    const manifest = writeManifest()
    writeFile('beta.yml', 'tampered: true\n') // drift after manifest generation
    const result = await runPublish(provider, manifest)
    assert.equal(result.status, 'blocked')
    assert.ok(result.reason.includes('drift'))
    assert.equal(provider.store.uploads.length, 0)
  })

  it('verifyDownload re-downloads and confirms each asset digest', async () => {
    const provider = mockProvider()
    const manifest = writeManifest()
    const result = await runPublish(provider, manifest, { verifyDownload: true })
    assert.equal(result.status, 'uploaded')
    const release = await provider.getReleaseByTag(TAG)
    for (const artifact of manifest.artifacts) {
      const remote = release.assets.find((a) => a.name === artifact.file)
      const downloadedAssetSha256 = sha256(await provider.downloadAsset(remote))
      assert.equal(downloadedAssetSha256, artifact.sha256)
    }
  })

  it('verifyDownload catches transport corruption', async () => {
    const provider = mockProvider()
    const manifest = writeManifest()
    // corrupt one asset at serve time while keeping the optimistic digest
    const origUpload = provider.uploadAsset
    provider.uploadAsset = async (release, args) => {
      const asset = await origUpload(release, args)
      if (args.name === 'beta.yml') {
        asset.bytes = Buffer.from('corrupted-transit-bytes')
      }
      return asset
    }
    const result = await runPublish(provider, manifest, { verifyDownload: true })
    assert.equal(result.status, 'rejected')
    assert.equal(result.assets['beta.yml'].status, 'verify-failed')
  })
})

describe('planUpload', () => {
  const files = [{ name: 'a.bin', path: '/x/a.bin', sha256: 'a'.repeat(64) }]

  it('existing asset with matching digest is unchanged', async () => {
    const plan = await planUpload({
      files,
      existingAssets: [{ id: 1, name: 'a.bin', digest: `sha256:${'a'.repeat(64)}` }],
      resolveRemoteSha: async () => null,
    })
    assert.equal(plan[0].decision, 'unchanged')
  })

  it('existing asset without a digest falls back to download+hash', async () => {
    const plan = await planUpload({
      files,
      existingAssets: [{ id: 1, name: 'a.bin', digest: null }],
      resolveRemoteSha: async () => 'A'.repeat(64),
    })
    assert.equal(plan[0].decision, 'unchanged')
  })

  it('an unresolvable remote digest rejects rather than guesses', async () => {
    const plan = await planUpload({
      files,
      existingAssets: [{ id: 1, name: 'a.bin', digest: null }],
      resolveRemoteSha: async () => null,
    })
    assert.equal(plan[0].decision, 'rejected')
  })
})

describe('promoteCandidate', () => {
  it('promotion without certification is blocked', async () => {
    const manifest = writeManifest()
    const promotionWithoutCertification = promoteCandidate({ manifest, authority: true })
    assert.equal(promotionWithoutCertification.status, 'blocked')
  })

  it('certification without explicit authority is blocked', async () => {
    const manifest = writeManifest()
    const cert = {
      gitSha: manifest.identity.gitSha,
      installerSha256: manifest.artifacts.find((a) => a.kind === 'installer').sha256,
      reportRef: 'docs/qa/b10-report.md',
    }
    assert.equal(promoteCandidate({ manifest, certification: cert }).status, 'blocked')
  })

  it('certification for different bytes is blocked', async () => {
    const manifest = writeManifest()
    const cert = {
      gitSha: manifest.identity.gitSha,
      installerSha256: 'f'.repeat(64),
      reportRef: 'docs/qa/b10-report.md',
    }
    const result = promoteCandidate({ manifest, certification: cert, authority: true })
    assert.equal(result.status, 'blocked')
  })

  it('B10 evidence + explicit authority -> ready (still no state mutation)', async () => {
    const manifest = writeManifest()
    const cert = {
      gitSha: manifest.identity.gitSha,
      installerSha256: manifest.artifacts.find((a) => a.kind === 'installer').sha256,
      reportRef: 'docs/qa/b10-report.md',
    }
    const result = promoteCandidate({ manifest, certification: cert, authority: true })
    assert.equal(result.status, 'ready')
  })
})

describe('githubProvider request shape', () => {
  it('creates draft releases, uploads octet-stream assets, downloads with auth', async () => {
    const calls = []
    const release = {
      id: 42,
      tag_name: TAG,
      draft: true,
      html_url: `https://github.com/o/r/releases/tag/${TAG}`,
      assets: [],
    }
    const fetchImpl = async (url, init) => {
      calls.push({ url, method: init.method, headers: init.headers })
      if (init.method === 'POST' && url.endsWith('/releases')) {
        return jsonResponse(release)
      }
      if (url.includes('/assets?name=')) {
        return jsonResponse({ id: 7, name: 'a.bin', digest: `sha256:${'0'.repeat(64)}` })
      }
      if (url.includes('/releases/assets/')) {
        return new Response(new TextEncoder().encode('asset-bytes'), { status: 200 })
      }
      return jsonResponse(release)
    }
    const provider = githubProvider({ repo: 'o/r', token: 'tok', fetchImpl })
    const found = await provider.getReleaseByTag(TAG)
    assert.equal(found.draft, true)
    const created = await provider.createDraftRelease({ tag: TAG, name: 'n' })
    const uploaded = await provider.uploadAsset(created, {
      name: 'a.bin',
      bytes: new Uint8Array([1, 2, 3]),
    })
    assert.equal(uploaded.digest, `sha256:${'0'.repeat(64)}`)
    const bytes = await provider.downloadAsset({ id: 7 })
    assert.equal(new TextDecoder().decode(bytes), 'asset-bytes')

    const createCall = calls.find((c) => c.url.endsWith('/releases') && c.method === 'POST')
    assert.equal(createCall.headers.Authorization, 'Bearer tok')
    const downloadCall = calls.find((c) => c.url.includes('/releases/assets/'))
    assert.equal(downloadCall.headers.Accept, 'application/octet-stream')
    assert.equal(downloadCall.headers.Authorization, 'Bearer tok')
    assert.ok(calls.every((c) => c.headers.Authorization === 'Bearer tok'))
  })

  it('rejects without a token and without a valid repo', () => {
    assert.throws(() => githubProvider({ repo: 'o/r', token: '' }), PublishCandidateError)
    assert.throws(() => githubProvider({ repo: 'not-a-repo', token: 'x' }), PublishCandidateError)
  })
})

function jsonResponse(obj) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

// --- authorized draft smoke (real GitHub, digest-verified download) ---------
// Env-gated: only runs when credentials are provisioned for a smoke target.
// Honest skip while EXT-03/EXT-04 stay unresolved - absence of credentials is
// reported, never simulated.
const SMOKE_ENV = [
  'BETA_CANDIDATE_SMOKE_REPO',
  'BETA_CANDIDATE_SMOKE_TOKEN',
  'BETA_CANDIDATE_SMOKE_TAG',
  'BETA_CANDIDATE_SMOKE_ASSET',
  'BETA_CANDIDATE_SMOKE_SHA256',
]
const smokeReady = SMOKE_ENV.every((k) => typeof process.env[k] === 'string' && process.env[k] !== '')

describe('authorized draft smoke (env-gated)', () => {
  it('downloads a real draft asset and verifies its digest', { skip: !smokeReady }, async () => {
    const provider = githubProvider({
      repo: process.env.BETA_CANDIDATE_SMOKE_REPO,
      token: process.env.BETA_CANDIDATE_SMOKE_TOKEN,
    })
    const release = await provider.getReleaseByTag(process.env.BETA_CANDIDATE_SMOKE_TAG)
    assert.ok(release !== null, 'smoke tag must resolve to a draft release')
    assert.equal(release.draft, true, 'candidate transport must stay a draft')
    const asset = release.assets.find(
      (a) => a.name === process.env.BETA_CANDIDATE_SMOKE_ASSET,
    )
    assert.ok(asset, 'smoke asset must exist on the draft')
    const bytes = await provider.downloadAsset(asset)
    const downloadedAssetSha256 = sha256(bytes)
    assert.equal(downloadedAssetSha256, process.env.BETA_CANDIDATE_SMOKE_SHA256.toLowerCase())
  })
})
