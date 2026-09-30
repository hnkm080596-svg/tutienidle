# B10 release-candidate certification record — 2026-09-30

Certifier: Devin coordinator session (`devin-5bf2143f50154f09bbdb6b8a1f7cb508`).
Certified tree: `master @ 00234d487b492f8a6464b9ccf4e1d82ba56e40b7` (PR1–PR14 merged).
Candidate identity: `com.fdlmg.tutienidle` / `TienHiepIdle` / `0.1.0-beta.0` / channel `beta`.
Environment: Linux x64 build host; real staging Supabase `mmuluhhlybzbcybduzzk.supabase.co`; Windows 11 x64 machine NOT available; signing chain NOT provisioned.

**Outcome: QA_UNVERIFIED.** The canonical B10 success sentence is NOT emitted.
Every step below records either real executed evidence or an honest UNSEALED
bound. No promotion of any candidate was performed or attempted.

## Evidence executed this run

| Evidence | Command | Result |
| --- | --- | --- |
| Full verification | `npm run verify` (earlier today, same tree) | type-check + build + 7645 pass / 5 expected-fail / 1 skip, 0 fail |
| Release-script harness | `node --test scripts/release/*.test.mjs` | 91 pass / 1 skip / 0 fail |
| Staging contract suite | `npm run test:supabase` (staging, `.env.supabase.contract`) | 42 pass / 1 env-bound fail / 3 phase skips / 2 cascade did-not-run — detail below |
| Local payload build | `npx electron-builder --win zip --config.win.signAndEditExecutable=false` | `release/win-unpacked` + `*-win.zip` built |
| Payload inspection | `node scripts/release/inspect-package.mjs --input release` | 75 disk files + 1734 asar entries enumerated; FAIL on exactly one manifest path: `resources/elevate.exe` (see Step 1/2 note) |

### Staging contract failure — real finding, environment-bound

`tests/integration/supabase/guest-upgrade.spec.ts` "anonymous user is a guest;
unconfirmed link keeps finalize PENDING" failed: the `PUT /auth/v1/user`
email-link returned **400 `email_address_invalid ""`** — not the 429 the test
skips for. Direct probes on the same project (today):

| Call | Result |
| --- | --- |
| `PUT /auth/v1/user` (anonymous, `*.invalid` email) | 400 `email_address_invalid ""` |
| `PUT /auth/v1/user` (anonymous, `gmail.com`/`example.com` email) | 429 `over_email_send_rate_limit` |
| `POST /auth/v1/signup` (`*.invalid` email + password) | 429 `over_email_send_rate_limit` (format accepted) |

Reads: on this staging project's GoTrue, the updateUser email-link for an
anonymous user is **currently unproven end-to-end**. A `.invalid`-TLD target is
rejected 400 before any send attempt; a deliverable-looking target passes
format checks then dies on the project's send quota (429). The production
`upgradeGuest` path in `src/services/auth/SupabaseAuthService.ts` uses the same
`@accounts.tien-hiep-idle.invalid` domain, so it shares this bound.

**This is a certification-blocking product/env finding (see Required
inputs #4) — not a code fix attempted inside PR15, per B10's no-product-edits
rule.**

## 17-step certification journey — status

| # | Step | Status | Evidence / bound |
| --- | --- | --- | --- |
| 1 | Download GitHub Release asset; verify checksum/signature | UNSEALED | EXT-04 candidate transport unresolved; only unsigned local payload exists |
| 2 | Install + launch packaged app | UNSEALED | NSIS target requires wine on Linux / a Windows host; `dist:win` fails at `spawn wine ENOENT`. `win-unpacked` payload + `*.nsis.7z` intermediates produced; installer bytes not produced |
| 3 | Verify build identity / backend / channel | PARTIAL | `build-identity.mjs` + manifest tests (91/92) pin identity; packaged `channel: beta` + `productName: TienHiepIdle` verified in local payload. Runtime display on Windows unsealed |
| 4 | Guest create + character + revision-1 before first tick | PARTIAL | Staging contract specs prove anonymous provisioning + revision-0/1 commit paths (specs 19, 41). Packaged-app proof unsealed |
| 5 | Cultivation/combat/economy mutation + cloud autosave | PARTIAL | Coordinator save serialize + receipts/digests proven on staging (specs 10-13, 24). No real gameplay-session evidence |
| 6 | Terminate/reopen → exact remote restore | PARTIAL | `load` state machine proven (spec 16: NO_CHARACTER→UNINITIALIZED→SAVE_READY→INCOMPATIBLE/DELETED). Restart-on-device unsealed |
| 7 | Physical network loss → global pause → reconcile/resume | PARTIAL | Offline accrual + admission pause proven by unit/integration tests; physical-loss on device unsealed |
| 8 | Device B login revokes A | EXECUTED (RPC level) | Two-device matrix proven on staging: claim-steal symmetric, foreign-theft denied (specs 31-34). Packaged two-device unsealed |
| 9 | Recover / re-authenticate per product flow | PARTIAL | Logout ordering + stale-JWT denial proven (spec 30); end-to-end re-auth on packaged app unsealed |
| 10 | Guest → registered upgrade, same lineage | UNSEALED + FINDING | See failure above: real GoTrue email-link cannot complete today (400 on `.invalid`, 429 on deliverable domains). Same-UUID post-confirm path proven only via DB-level confirm (earlier run: tests 47-48) |
| 11 | Controlled CAS conflict → no overwrite | EXECUTED (RPC level) | Genuine CAS divergence surfaces pending-conflict, zero overwrite (specs 22, 33) |
| 12 | Pending-journal crash points → deterministic recovery | EXECUTED (RPC level) | All three crash-replay cells pass: committed-unacked resolves once, no-journal commits fresh (specs 36-38) |
| 13 | N → N+1 update, save/schema/backend compatible | UNSEALED | Needs signed N and N+1 builds + candidate feed (EXT-02, EXT-04) |
| 14 | Feedback + diagnostics export, correlate + redact | PARTIAL | `submit_feedback` RPC certified on staging: server-derived attribution, idempotency, rate limit, no table access (specs 42-45). Diagnostics bundle proven in unit/electron tests; packaged path unsealed |
| 15 | Close during save/update → truthful flush | PARTIAL | Native flush IPC + `app:flush-complete` ordering tested; packaged close-path unsealed |
| 16 | Rollback/freeze + backup-restore drills | PARTIAL | Runbooks + guarded operator scripts exist with dry-run tests (37/37). Real-environment drills unsealed |
| 17 | Uninstall/reinstall → declared local-data policy | UNSEALED | Requires Windows install (EXT-05) |

## Required inputs before B10 can seal

1. **EXT-05 Windows 11 x64 clean machine** (or VM) — carries steps 1-2, 6-8,
   13, 15-17 to sealed.
2. **EXT-02 signing chain** — Authenticode cert + `verify-signatures.ps1` run;
   signed N and N+1 candidates.
3. **EXT-04 candidate feed** — restricted transport for draft bytes + update
   metadata; today only unsigned local artifacts exist. Note: local NSIS
   build is also impossible without wine — CI (Windows runner) or a Windows
   host must produce the installer.
4. **Guest-upgrade mailer decision (finding above)** — the `.invalid` account
   domain is rejected by GoTrue's send path and the project's mail quota is
   exhausted. Decide: real deliverable domain + SMTP for beta (required
   anyway for beta mail volume), or a no-mail confirmation design. Until
   resolved, step 10 cannot pass on any real project.
5. **Beta provisioning** — `ohndbcpnevljwytstbxq` anon/service keys exist;
   DB password + SMTP + GH env + EXT-04 token still outstanding.
6. **EXT-08 support matrix** — declare Windows 10 in/out before certifying it.

## Notes

- `resources/elevate.exe` (manifest `thirdPartySignedFiles`) is absent only in
  non-NSIS local builds; it lands during Windows NSIS packaging. Re-verify the
  manifest on the Windows-produced candidate — do NOT relax the check.
- `dist:win` on Linux is structurally blocked (wine). Recorded here so the
  runbook does not claim a local installer path.
- This document changes no product code and freezes no candidate; it is the
  certification record required by PR15's first bullet plus the unsealed
  inputs ledger for the remaining journey.
