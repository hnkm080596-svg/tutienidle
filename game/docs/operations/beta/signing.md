# Windows code signing — Closed Beta (B4)

> Scope: **EXT-02 is unresolved.** No authorized certificate or signing
> service identity exists yet. This document describes the plumbing — which
> is fail-closed — and honestly records that B4 is **unsealed**: no build
> shipped today may claim to be a signed Beta.

## What a signature proves — and what it does not

| Proves | Does NOT prove |
|---|---|
| The signed bytes came from whoever holds the private key bound to the certificate subject (publisher identity). | That the publisher is trustworthy, or that the code is safe. |
| The signed bytes have not been modified since signing (tamper evidence for the signed file). | Integrity of content Authenticode cannot cover (e.g. `resources/app.asar` contents — payload integrity is asserted by the artifact manifest/checksums in PR10, not by code signing). |
| The signature was made while the certificate was valid — the RFC3161 timestamp countersignature fixes signing time, so the signature stays verifiable after certificate expiry. | Windows SmartScreen reputation. **A valid signature does not guarantee SmartScreen stays silent** — new publishers need reputation buildup (or an EV certificate); expect warnings on first Beta installs regardless. |
| The file's signature chains to the expected certificate (thumbprint compare in `verify-signatures.ps1`). | That unsigned-capable files absent from the manifest are safe — the verifier rejects any `.exe` not enumerated by the manifest rather than trusting silently. |

The certificate **thumbprint, subject CN and expiry date are public
evidence** — record them in the certificate record when EXT-02 lands. Only
the private key material and its transport credentials are secret, and they
never enter this repository, the build config, logs or artifacts.

## Signing configuration (electron-builder 26.15.3)

Only options supported by the locked `electron-builder@26.15.3` are used —
verified against `node_modules/app-builder-lib`, not unversioned online
examples.

Chosen knobs in `game/electron-builder.yml`:

```yaml
win:
  signtoolOptions:
    signingHashAlgorithms:
      - sha256
    rfc3161TimeStampServer: http://timestamp.digicert.com
```

- `signingHashAlgorithms: [sha256]` — the plan requires SHA-256; the
  electron-builder default `[sha1, sha256]` would dual-sign and SHA-1 is
  deprecated for code signing.
- `rfc3161TimeStampServer` — the plan requires an RFC3161 timestamp so
  signatures remain verifiable after expiry. DigiCert's public TSA is the
  electron-builder default; it is pinned explicitly so the contract is
  auditable and preflight can assert it.
- No `certificateFile`/`certificateSubjectName`/`certificateSha1`,
  `cscLink`/`cscKeyPassword` or `certificatePassword` in the file — credential
  material never lives in git. `scripts/release/signing-preflight.mjs` fails
  if any such field is committed.
- No `${env.X}` macro — electron-builder expands env macros only in
  artifact/output patterns (`expandMacro` throws on an unset var), so a
  macro inside `signtoolOptions` would not work anyway.
- No `forceCodeSigning` — it would break the *intended* unsigned dev build.
  Fail-closed enforcement is pipeline-level (preflight + verifier), not a
  builder flag.
- No `signExts` — the default signable set (`*.exe`) is what
  `verify-signatures.ps1` enumerates. `*.dll` files keep their upstream
  Electron signatures; `resources/elevate.exe` ships in Electron's dist
  outside the signing walk and stays upstream-signed.
- No `azureSignOptions` yet — if EXT-02 resolves to Azure Trusted Signing
  instead of a PFX, add that block plus the `AZURE_*` EnvironmentCredential
  variables; preflight already detects and cross-checks both models.
  `azureSignOptions` wins over `signtoolOptions` when both exist — the
  preflight treats their simultaneous presence as ambiguous.

## Credential contract — protected CI reference (EXT-02)

electron-builder resolves the certificate from environment variables
natively; nothing credential-shaped is committed:

| Variable | Role |
|---|---|
| `WIN_CSC_LINK` | Certificate source for Windows: https URL, base64 PFX payload, or file path. Takes precedence over `CSC_LINK`. |
| `WIN_CSC_KEY_PASSWORD` | PFX password (falls back to `CSC_KEY_PASSWORD`, then empty). |
| `CSC_LINK` / `CSC_KEY_PASSWORD` | Generic fallbacks — acceptable but `WIN_CSC_*` preferred for a Windows-only release. |
| `AZURE_TENANT_ID` + `AZURE_CLIENT_ID` + one of `AZURE_CLIENT_SECRET` / `AZURE_CLIENT_CERTIFICATE_PATH` / `AZURE_FEDERATED_TOKEN_FILE` / `AZURE_USERNAME`+`AZURE_PASSWORD` | Azure Trusted Signing (alternative model; also requires the `azureSignOptions` block). |

How the reference lands when EXT-02 resolves:

1. The approved certificate is stored as **secrets on a protected GitHub
   Environment** (EXT-03 — environment approval rules), never as repo-level
   secrets visible to unprotected jobs.
2. The release job declares `environment: <protected>` so the secrets only
   materialize in the protected signing/publish job — **never in PR or fork
   contexts**. `signing-preflight.mjs` enforces this: `pull_request*`
   events (and `GITHUB_HEAD_REF` anomalies) with reachable credentials are
   rejected outright.
3. The protected job runs `npm run signing:preflight:release` before
   `electron-builder`. Missing or partial credentials **block** the release
   instead of producing a falsely sealed artifact.
4. After signing, `verify-signatures.ps1` runs over `release/` with the
   approved thumbprint from the certificate record.
5. Record certificate subject CN, thumbprint (SHA-1 of the cert) and
   `NotAfter` expiry in the certificate record — public evidence, safe to
   commit in docs/ops notes.

## Commands

```sh
# local / CI informational check (exit 0 = consistent state, either
# unsigned-ok or signing-ready)
npm run signing:preflight

# release gate — fail-closed; exits 1 without a complete credential source
# or in an untrusted context (run in the protected job before packaging)
npm run signing:preflight:release
```

```powershell
# Windows verification of a produced candidate (installer + unpacked app)
pwsh -NoProfile -File scripts/release/verify-signatures.ps1 `
  -ArtifactPath release `
  -ExpectedThumbprint <40-hex cert SHA-1 thumbprint from the certificate record>

# narrower: one artifact / one unpacked dir
pwsh -NoProfile -File scripts/release/verify-signatures.ps1 `
  -ArtifactPath 'release\win-unpacked' -ExpectedThumbprint <thumbprint>
pwsh -NoProfile -File scripts/release/verify-signatures.ps1 `
  -ArtifactPath 'release\Tien Hiep Idle-0.1.0-beta.0-Setup.exe' -ExpectedThumbprint <thumbprint>
```

`verify-signatures.ps1` rejects: missing signature, non-`Valid` status
(NotSigned/HashMismatch/Incompatible/NotTrusted/...), wrong publisher
thumbprint, missing RFC3161 timestamp (unless `-AllowMissingTimestamp`),
any `.exe` the manifest does not list, and manifest-listed files absent
from the payload. `-ManifestPath` overrides the default
`build/package-manifest.json`.

## Current state — unsealed

- Unsigned builds are the correct present behavior; `dist:win` produces a
  clean unsigned package and SmartScreen warnings on install are expected
  (see windows-install.md).
- `npm run signing:preflight:release` currently reports
  `no complete credential source is configured (EXT-02 unresolved)` and
  exits 1 — this failure *is* the guardrail.
- Remaining evidence obligations (owned by PR10 CI + PR15 certification):
  a real protected signing invocation, a signed N candidate verified on
  clean Windows, and the certificate thumbprint/expiry record.
