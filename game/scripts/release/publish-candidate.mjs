#!/usr/bin/env node
// BETA-FINAL PR10 / spec B5 - idempotent draft candidate upload and the
// restricted candidate transport seam (EXT-04).
//
// Contract:
//   * inputs are a release dir + release-manifest.json produced by
//     manifest.mjs AFTER final signing. Local bytes are re-verified against
//     the manifest before any network call - the upload step never rebuilds
//     and never ships drifted bytes.
//   * the upload target is a DRAFT GitHub Release for the version tag. A
//     published (non-draft) release for the same tag is immutable: the run
//     reports 'blocked' rather than touching published version bytes.
//   * assets are matched by name. Same SHA-256 -> 'unchanged' (the existing
//     draft asset is reused, so reruns are idempotent). Different bytes under
//     the same name -> 'rejected': the draft keeps its QA'd bytes and nothing
//     is replaced. The provider contract exposes no delete/overwrite method
//     at all, so byte replacement is impossible by construction.
//   * signing.status must be 'signed'. An unsealed manifest blocks upload -
//     unsigned output cannot enter the candidate feed (spec B5).
//
// EXT-04 restricted transport: candidate bytes reach testers through this
// same provider contract (draft release assets require an authenticated
// GitHub token). The token lives on CI/server only (GITHUB_TOKEN in the
// protected job; a dedicated feed token server-side later) - it is never
// embedded in the installer or the renderer bundle. The production update
// feed is untouched while the candidate is under QA.
//
// Promotion is a separate protected job that does not exist yet (EXT-03 +
// B10). promoteCandidate() is the admission decision only: it returns
// 'blocked' without B10 certification evidence AND explicit publication
// authority, 'ready' when both are satisfied; it never mutates release state.
//
// Usage:
//   node scripts/release/publish-candidate.mjs --manifest release/release-manifest.json \
//     [--input release] [--tag v0.1.0-beta.0] [--repo owner/name] \
//     [--dry-run] [--verify-download]
// env: GITHUB_TOKEN (or GH_TOKEN), GITHUB_REPOSITORY fallback for --repo.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sha256File, verifyArtifacts } from './manifest.mjs'

export class PublishCandidateError extends Error {
  constructor(message) {
    super(message)
    this.name = 'PublishCandidateError'
  }
}
export class ProviderError extends Error {
  constructor(message, status = null) {
    super(message)
    this.name = 'ProviderError'
    this.status = status
  }
}

const SHA256_HEX_RE = /^[0-9a-f]{64}$/

// --- provider contract -----------------------------------------------------
// The transport the Beta candidate feed and (later, B6) updater feed share:
//   getReleaseByTag(tag)   -> { id, tag, draft, assets:[{id,name,digest?}] } | null
//   createDraftRelease({tag, name, body}) -> release record
//   uploadAsset(release, {name, filePath, bytes}) -> { id, name, digest? }
//   downloadAsset(asset)   -> Uint8Array of the stored bytes
// There is intentionally no updateAsset/deleteAsset/publishRelease -
// replacing bytes or publishing is outside this contract.

const sha256Bytes = (buf) => {
  const hash = crypto.createHash('sha256')
  hash.update(buf)
  return hash.digest('hex')
}

export function assetSha256(asset, storedDigest) {
  // GitHub release assets carry a `digest` field shaped "sha256:<hex>".
  if (typeof storedDigest === 'string' && storedDigest.startsWith('sha256:')) {
    return storedDigest.slice('sha256:'.length).toLowerCase()
  }
  return null
}

// Plans what an upload run would do for each publishable file, given the
// assets already on the draft release. `resolveRemoteSha` is an async
// fallback (download + hash) used when the provider did not report a digest.
export async function planUpload({ files, existingAssets, resolveRemoteSha }) {
  const byName = new Map(existingAssets.map((a) => [a.name, a]))
  const plan = []
  for (const file of files) {
    const existing = byName.get(file.name)
    if (existing === undefined) {
      plan.push({ name: file.name, decision: 'upload', sha256: file.sha256 })
      continue
    }
    let remoteSha = assetSha256(existing, existing.digest)
    if (remoteSha === null) {
      remoteSha = (await resolveRemoteSha(existing))?.toLowerCase() ?? null
    }
    if (remoteSha === null) {
      plan.push({
        name: file.name,
        decision: 'rejected',
        reason: 'existing draft asset has no comparable digest',
        sha256: file.sha256,
      })
    } else if (remoteSha === file.sha256.toLowerCase()) {
      plan.push({ name: file.name, decision: 'unchanged', sha256: file.sha256 })
    } else {
      plan.push({
        name: file.name,
        decision: 'rejected',
        reason: `draft asset ${file.name} holds different bytes (remote ${remoteSha}) - published/candidate bytes are never replaced`,
        sha256: file.sha256,
      })
    }
  }
  return plan
}

// Publishable file set = every publish:true artifact PLUS the manifest file
// itself (the manifest is evidence and must ship beside the artifacts; it
// cannot list its own hash).
export function collectUploadFiles({ manifest, manifestPath, inputDir }) {
  const files = []
  for (const a of manifest.artifacts) {
    if (!a.publish) continue
    files.push({ name: a.file, path: path.join(inputDir, a.file), sha256: a.sha256 })
  }
  if (manifestPath !== null) {
    files.push({
      name: path.basename(manifestPath),
      path: manifestPath,
      sha256: sha256File(manifestPath),
    })
  }
  return files
}

// The whole publish run. Returns a result object whose `status` is:
//   'blocked'   preconditions failed (unsealed manifest, local hash drift,
//               published release for the tag) - nothing was sent
//   'rejected'  a draft asset already holds different bytes - nothing was
//               sent, and nothing was replaced
//   'unchanged' every planned asset already exists with identical bytes
//   'uploaded'  missing assets were uploaded to the draft (existing
//               matching assets stayed 'unchanged')
export async function publishCandidate({
  provider,
  manifest,
  manifestPath = null,
  inputDir,
  tag,
  releaseName = null,
  releaseNotes = '',
  createIfMissing = true,
  verifyDownload = false,
}) {
  if (!manifest || !Array.isArray(manifest.artifacts)) {
    throw new PublishCandidateError('publishCandidate requires a parsed release manifest')
  }
  if (manifest.signing?.status !== 'signed') {
    return {
      status: 'blocked',
      reason: 'manifest signing.status is not "signed" - unsigned output cannot enter the candidate feed',
      assets: {},
    }
  }
  const localProblems = verifyArtifacts(manifest, inputDir)
  if (localProblems.length > 0) {
    return {
      status: 'blocked',
      reason: 'local artifacts no longer match the manifest (bytes must not drift between signing and upload)',
      problems: localProblems,
      assets: {},
    }
  }

  let release = await provider.getReleaseByTag(tag)
  if (release !== null && release.draft === false) {
    return {
      status: 'blocked',
      reason: `a published (non-draft) release already exists for ${tag} - published version bytes are immutable`,
      assets: {},
    }
  }
  if (release === null) {
    if (!createIfMissing) {
      return { status: 'blocked', reason: `no draft release for ${tag}`, assets: {} }
    }
    release = await provider.createDraftRelease({
      tag,
      name: releaseName ?? `${manifest.identity.productName} ${tag} (beta candidate)`,
      body: releaseNotes,
    })
    if (release.draft === false) {
      throw new PublishCandidateError('provider returned a non-draft release for a draft creation request')
    }
  }

  const files = collectUploadFiles({ manifest, manifestPath, inputDir })
  const resolveRemoteSha = async (asset) => {
    const bytes = await provider.downloadAsset(asset)
    return sha256Bytes(bytes)
  }
  const plan = await planUpload({ files, existingAssets: release.assets ?? [], resolveRemoteSha })

  const rejected = plan.filter((p) => p.decision === 'rejected')
  if (rejected.length > 0) {
    return {
      status: 'rejected',
      reason: rejected.map((r) => r.reason).join('; '),
      assets: Object.fromEntries(plan.map((p) => [p.name, { status: p.decision, sha256: p.sha256 }])),
      release: { id: release.id, tag },
    }
  }

  const assets = {}
  for (const p of plan) {
    if (p.decision === 'unchanged') {
      assets[p.name] = { status: 'unchanged', sha256: p.sha256 }
      continue
    }
    const file = files.find((f) => f.name === p.name)
    const uploaded = await provider.uploadAsset(release, {
      name: file.name,
      filePath: file.path,
      bytes: fs.readFileSync(file.path),
    })
    assets[p.name] = { status: 'uploaded', sha256: p.sha256, assetId: uploaded.id }
  }

  if (verifyDownload) {
    // Post-upload verification is byte-authoritative: every asset the feed
    // now serves is re-downloaded and hashed (downloadedAssetSha256 must
    // equal the manifest sha256). The provider-reported digest is advisory -
    // never trusted in place of the actual bytes. A mismatch is a transport
    // integrity failure -> 'rejected'.
    const refreshed = await provider.getReleaseByTag(tag)
    const byName = new Map((refreshed?.assets ?? []).map((a) => [a.name, a]))
    let ok = true
    for (const p of plan) {
      const remote = byName.get(p.name)
      if (!remote) {
        assets[p.name] = { ...assets[p.name], status: 'verify-failed', reason: 'asset missing after upload' }
        ok = false
        continue
      }
      const remoteSha = sha256Bytes(await provider.downloadAsset(remote))
      if (remoteSha !== p.sha256.toLowerCase()) {
        assets[p.name] = {
          ...assets[p.name],
          status: 'verify-failed',
          reason: `downloaded sha256 ${remoteSha} != manifest ${p.sha256}`,
        }
        ok = false
      }
    }
    if (!ok) {
      return { status: 'rejected', reason: 'download verification failed', assets, release: { id: release.id, tag } }
    }
  }

  const anyUploaded = plan.some((p) => p.decision === 'upload')
  return {
    status: anyUploaded ? 'uploaded' : 'unchanged',
    assets,
    release: { id: release.id, tag },
  }
}

// Promotion admission decision (EXT-03 + B10 - no promotion job exists yet;
// this never mutates release state). `certification` is the B10 evidence for
// the exact candidate: it must name this manifest's gitSha and the installer
// sha256. `authority` is the explicit human publication authority flag.
export function promoteCandidate({ manifest, certification = null, authority = false }) {
  const reasons = []
  if (authority !== true) {
    reasons.push('no explicit publication authority supplied')
  }
  if (certification === null || typeof certification !== 'object') {
    reasons.push('no B10 certification evidence supplied')
  } else {
    if (certification.gitSha !== manifest.identity?.gitSha) {
      reasons.push('certification gitSha does not match the candidate manifest')
    }
    const installer = manifest.artifacts?.find((a) => a.kind === 'installer')
    if (
      installer === undefined ||
      certification.installerSha256 !== installer.sha256
    ) {
      reasons.push('certification does not cover the candidate installer sha256')
    }
    if (typeof certification.reportRef !== 'string' || certification.reportRef === '') {
      reasons.push('certification has no report reference')
    }
  }
  if (manifest.signing?.status !== 'signed') {
    reasons.push('candidate is not signed')
  }
  return reasons.length > 0 ? { status: 'blocked', reasons } : { status: 'ready' }
}

// --- GitHub implementation of the provider contract -------------------------
// REST only, global fetch (Node 22), no third-party dependency. Draft
// releases and their assets require the token on every call; it is passed
// as a header and never logged or serialized.
export function githubProvider({
  repo,
  token,
  apiBase = 'https://api.github.com',
  uploadBase = 'https://uploads.github.com',
  fetchImpl = globalThis.fetch,
}) {
  if (typeof token !== 'string' || token === '') {
    throw new PublishCandidateError('githubProvider requires a token (kept server-side; never shipped)')
  }
  if (typeof repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new PublishCandidateError('repo must be "owner/name"')
  }
  const api = async (method, url, { body = null, headers = {}, raw = false } = {}) => {
    const res = await fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...headers,
      },
      body,
    })
    if (res.status === 404) return null
    if (!res.ok) {
      // Do not echo response bodies into errors - they can carry tokens or
      // internal URLs on some deployments. Status only.
      throw new ProviderError(`github ${method} ${url} -> HTTP ${res.status}`, res.status)
    }
    return raw ? res : res.json()
  }
  const mapRelease = (r) =>
    r === null
      ? null
      : {
          id: r.id,
          tag: r.tag_name,
          draft: r.draft === true,
          url: r.html_url,
          uploadUrl: r.upload_url,
          assets: (r.assets ?? []).map((a) => ({
            id: a.id,
            name: a.name,
            digest: a.digest ?? null,
            size: a.size,
          })),
        }

  return {
    async getReleaseByTag(tag) {
      const r = await api('GET', `${apiBase}/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`)
      return mapRelease(r)
    },
    async createDraftRelease({ tag, name, body }) {
      const r = await api('POST', `${apiBase}/repos/${repo}/releases`, {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag_name: tag,
          name,
          body,
          draft: true,
          prerelease: true,
          generate_release_notes: false,
        }),
      })
      return mapRelease(r)
    },
    async uploadAsset(release, { name, filePath, bytes }) {
      const data = bytes ?? fs.readFileSync(filePath)
      const url =
        `${uploadBase}/repos/${repo}/releases/${release.id}/assets` +
        `?name=${encodeURIComponent(name)}`
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(data.length),
        },
        body: data,
      })
      if (!res.ok) {
        throw new ProviderError(`github asset upload ${name} -> HTTP ${res.status}`, res.status)
      }
      const a = await res.json()
      return { id: a.id, name: a.name, digest: a.digest ?? null }
    },
    async downloadAsset(asset) {
      const res = await fetchImpl(`${apiBase}/repos/${repo}/releases/assets/${asset.id}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/octet-stream',
        },
      })
      if (!res.ok) {
        throw new ProviderError(`github asset download ${asset.id} -> HTTP ${res.status}`, res.status)
      }
      return new Uint8Array(await res.arrayBuffer())
    },
  }
}

export function parseArgs(argv) {
  const args = {
    manifest: null,
    input: null,
    tag: null,
    repo: null,
    dryRun: false,
    verifyDownload: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--manifest') args.manifest = argv[++i]
    else if (a === '--input') args.input = argv[++i]
    else if (a === '--tag') args.tag = argv[++i]
    else if (a === '--repo') args.repo = argv[++i]
    else if (a === '--dry-run') args.dryRun = true
    else if (a === '--verify-download') args.verifyDownload = true
    else if (a === '--help' || a === '-h') return { help: true }
    else throw new PublishCandidateError(`unknown argument: ${a}`)
  }
  return args
}

export async function main(argv, env = process.env) {
  const args = parseArgs(argv)
  if (args.help) {
    console.log(
      'usage: publish-candidate.mjs --manifest <release-manifest.json> [--input <dir>] ' +
        '[--tag v<ver>] [--repo owner/name] [--dry-run] [--verify-download]',
    )
    return
  }
  if (!args.manifest) throw new PublishCandidateError('--manifest <release-manifest.json> is required')
  const manifestPath = path.resolve(args.manifest)
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const inputDir = path.resolve(args.input ?? path.dirname(manifestPath))
  const tag = args.tag ?? manifest.provenance?.tag ?? `v${manifest.identity?.appVersion ?? ''}`
  const repo = args.repo ?? env.GITHUB_REPOSITORY ?? null

  if (args.dryRun) {
    // No network: verify local bytes and print the file plan. Unknown remote
    // state is reported as unknown, never assumed.
    const problems = verifyArtifacts(manifest, inputDir)
    const files = collectUploadFiles({ manifest, manifestPath, inputDir })
    console.log(`dry-run: tag=${tag} repo=${repo ?? '(unset)'} signing=${manifest.signing.status}`)
    for (const f of files) console.log(`  would-upload ${f.name} sha256=${f.sha256.slice(0, 12)}...`)
    if (problems.length > 0) {
      for (const p of problems) console.error(`publish-candidate: ${p}`)
      process.exitCode = 1
    }
    return
  }

  const token = env.GITHUB_TOKEN ?? env.GH_TOKEN ?? null
  if (!token) {
    throw new PublishCandidateError(
      'GITHUB_TOKEN/GH_TOKEN is required for upload - it stays on CI/server and is never shipped (EXT-04)',
    )
  }
  if (!repo) {
    throw new PublishCandidateError('--repo owner/name (or GITHUB_REPOSITORY) is required')
  }
  const provider = githubProvider({ repo, token })
  const result = await publishCandidate({
    provider,
    manifest,
    manifestPath,
    inputDir,
    tag,
    verifyDownload: args.verifyDownload,
  })
  console.log(JSON.stringify(result, null, 2))
  console.log(`publish-candidate: ${result.status}`)
  process.exitCode = ['uploaded', 'unchanged'].includes(result.status) ? 0 : 1
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => {
    if (e instanceof PublishCandidateError || e instanceof ProviderError) {
      console.error(`publish-candidate: ${e.message}`)
      process.exitCode = 1
    } else {
      throw e
    }
  })
}
