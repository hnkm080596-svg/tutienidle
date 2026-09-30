# Release pipeline + candidate feed — Closed Beta (B5)

> Scope: **EXT-02 / EXT-03 / EXT-04 are unresolved.** The pipeline exists and
> is fail-closed — a run today stops at the first unprovisioned gate instead
> of simulating a seal. This document describes what the workflow does, which
> inputs it needs, and what stays honestly unsealed.

## Workflows

| Workflow | Trigger | Trust level | Purpose |
|---|---|---|---|
| `.github/workflows/beta-checks.yml` | `pull_request`, pushes to `master`/`beta-final/**`, manual | **unprivileged** — `contents: read`, no `environment:`, no secrets | Read-only verification: full `npm run verify` + release-script tests on `ubuntu-24.04`; unsigned `npm run dist:win` packaging dry-run + `inspect-package` + informational `signing-preflight` on `windows-2022`. |
| `.github/workflows/beta-release.yml` | `v*` tag push or manual dispatch (`tag` input) | **protected** — `environment: beta-release`, `contents: write` + `id-token`/`attestations` on the release job only | Builds the signed candidate, freezes evidence, uploads a draft release. |

beta-checks runs untrusted PR head code (`npm ci` executes the PR's install
scripts), so it carries no secrets and no environment — fork PRs get nothing
to exfiltrate by construction. It never runs `dist:win` with signing
credentials, because none exist in that context.

## beta-release pipeline stages

1. `verify-source` (ubuntu-24.04, `contents: read`):
   - checks out the exact tag/SHA (`ref: ${{ inputs.tag || github.sha }}`),
   - validates tag ↔ tagged commit ↔ `HEAD` ↔ `git describe --exact-match`
     ↔ `package.json` version, plus a clean `git status --porcelain`,
   - `npm ci` from the lockfile,
   - `build-identity.mjs` in release mode (releaseChannel=`beta`,
     backendEnvironment=`beta`, `GIT_TAG`, CI `BUILD_ID`),
   - full `npm run verify` + `node --test scripts/release/*.test.mjs`.
2. `release` (windows-2022, `environment: beta-release`):
   - re-validates tag/SHA/dirty on the packaging runner (defense in depth),
   - backend identity gate: `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`
     must be present (EXT-03),
   - `npm run signing:preflight:release` — fail-closed signing gate (EXT-02),
   - `npm run dist:win` — compile once, electron-builder signs app binaries
     during packaging and the installer last,
   - `verify-signatures.ps1` with `BETA_CERT_THUMBPRINT`,
   - `inspect-package.mjs` payload inspection,
   - `npm sbom` → `release/sbom.cdx.json` (CycloneDX),
   - `manifest.mjs` → `release/release-manifest.json` + `checksums.txt`
     (SHA-256 over the **final signed bytes**),
   - `manifest.mjs --verify` — re-hash everything before upload,
   - `attest-build-provenance` — Sigstore provenance over `game/release/*`,
   - `publish-candidate.mjs --verify-download` — idempotent draft upload.

No step dumps the environment or logs credentials; all secrets are referenced
by name through the protected environment only.

## Required configuration (when EXT-02/03 resolve)

GitHub **Environment `beta-release`** (Settings → Environments) with
required-reviewer approval so its secrets only materialize after a human
gate:

| Name | Kind | Role |
|---|---|---|
| `WIN_CSC_LINK` | secret | Windows certificate source (see signing.md) |
| `WIN_CSC_KEY_PASSWORD` | secret | PFX password (optional per electron-builder) |
| `BETA_CERT_THUMBPRINT` | variable | Approved certificate SHA-1 thumbprint — public evidence |
| `BETA_SUPABASE_URL` | variable | Beta backend project URL |
| `BETA_SUPABASE_ANON_KEY` | secret | Beta backend anon key (baked into the build at compile time) |

The workflow's `GITHUB_TOKEN` is the built-in Actions token — it only exists
on the release job (`contents: write`) and creates the draft release.

## Draft upload semantics (`publish-candidate.mjs`)

- Idempotent retry: an existing draft asset with the same SHA-256 is reused
  (`unchanged`); only missing assets upload.
- Different bytes under the same asset name → the whole run is `rejected`
  and **nothing is replaced**. There is no delete/overwrite code path.
- A published (non-draft) release for the tag → `blocked`: published
  version bytes are immutable.
- `--verify-download` re-downloads every asset and compares actual bytes
  against the manifest (`downloadedAssetSha256 == manifest sha256`) —
  provider-reported digests are advisory, never authoritative.
- Local drift between signing and upload → `blocked`.

## Candidate feed (EXT-04)

The candidate feed **is** the draft GitHub Release: draft assets are only
reachable with an authenticated token. The transport contract
(`getReleaseByTag` / `downloadAsset` / digest verification) is the same one a
private feed provider or the B6 updater will use. Rules:

- tokens stay on CI/server side — **never** embedded in the installer,
  renderer bundle, or update metadata;
- tester entitlement = GitHub account with repo read access; bytes are
  fetched through the token-holding side (CI download, or a later
  server-side feed endpoint), never by shipping a token to testers;
- production update feed is untouched while the candidate is under QA;
- public promotion is a separate protected job requiring **B10
  certification evidence + explicit authority** — `promoteCandidate()`
  returns `blocked` without both, and no promotion job exists yet.

## Local commands

```sh
# inspect what a release dir would produce (unsigned dry run)
node scripts/release/manifest.mjs --input release --allow-unsigned

# after a signed build (thumbprint from the certificate record)
node scripts/release/manifest.mjs --input release --tag v0.1.0-beta.0 \
  --signing-thumbprint <40-hex>

# verify manifest hashes still match the bytes on disk
node scripts/release/manifest.mjs --verify release/release-manifest.json --input release

# dry-run the upload plan (no network, no token needed)
node scripts/release/publish-candidate.mjs \
  --manifest release/release-manifest.json --dry-run
```

## Authorized draft smoke (env-gated)

`publish-candidate.test.mjs` carries a real-GitHub smoke that skips when
unprovisioned. To run it once a protected environment exists:

```sh
BETA_CANDIDATE_SMOKE_REPO=owner/repo \
BETA_CANDIDATE_SMOKE_TOKEN=<server-side token> \
BETA_CANDIDATE_SMOKE_TAG=v0.1.0-beta.0 \
BETA_CANDIDATE_SMOKE_ASSET="Tien Hiep Idle-0.1.0-beta.0-Setup.exe" \
BETA_CANDIDATE_SMOKE_SHA256=<expected hex> \
node --test scripts/release/publish-candidate.test.mjs
```

## Honest bound — unsealed today

- **EXT-02**: no certificate/service identity → `signing:preflight:release`
  blocks the release job. Manifest can only be emitted `--allow-unsigned`
  (`signing.status: unsealed`), which `publish-candidate` refuses to upload.
- **EXT-03**: the `beta-release` environment, its approvals, and the backend
  env vars do not exist yet → the release job waits/blocks at the
  environment and backend gates.
- **EXT-04**: the restricted transport is implemented at the draft-release +
  provider-contract level and is exercised by mocked tests; the env-gated
  real-GitHub download smoke is unrun (no creds). A dedicated server-side
  feed endpoint for testers does not exist yet.
- **B5 seal**: public promotion is blocked by design (B10 + explicit
  authority) and no promotion job exists — only the draft path is wired.
