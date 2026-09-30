# QA Review: beta-pr6-guest-identity

- Date: 2026-09-30
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths:
  - `game/electron/main.ts`, `game/electron/preload.ts`
  - `game/src/App.vue`
  - `game/src/components/onboarding/AuthEntryScreen.vue`, `GuestUpgradeCard.vue`
  - `game/src/components/panels/GuestAbandonDialog.vue`, `SettingsPanel.vue`
  - `game/src/composables/resumeSession.ts`, `useElectronBridge.ts`, `useOnlineAuthority.ts`, `useSessionAccount.ts`
  - `game/src/locales/en.json`, `game/src/locales/vi.json`
  - `game/src/main-process/GuestCredentialStore.ts`
  - `game/src/services/auth/{AuthService,MockAuthService,SupabaseAuthService}.ts`
  - `game/src/services/backend/backendBundle.ts`
  - `game/src/services/supabase/SupabaseSession.ts`
  - `game/supabase/migrations/202609300003_beta_guest_finalize.sql`
  - tests/config: `game/playwright.electron.config.ts`, `game/tests/electron/{global-setup.ts,guest-persistence.spec.ts}`, `game/tests/integration/supabase/guest-upgrade.spec.ts`, `game/src/**` companion test files

## Scope and Risk Map

Changed systems: durable guest credential seam (Electron main + preload +
SupabaseSession bridge), auth service upgrade/finalize/logout legs, resume
pipeline, auth-entry and settings account surfaces, finalize SQL.

One-hop consumers: boot/auth card (resume candidate + Continue),
settings account section, online authority save queue (flush leg of
logout), pending save journal (identity-namespaced keys).

Mapper output: domains `save-and-cloud`, `ui-input-lifecycle`;
`deepAuditCandidate: true` (critical state boundary + 2 domains);
11 `unmappedPaths`.

Escalation decision (quick, not deep): the `deepAuditCandidate` flag and
the unmapped paths are confidently bounded from code inspection —
`electron/main.ts`/`preload.ts` are the IPC seam (renderer sees
operations only), `GuestCredentialStore.ts` is a deps-injected value
store with no domain rules, `useSessionAccount.ts` orchestrates existing
owners (authority flush, authService, teardown binding) rather than
reimplementing them, the migration derives registered status from
`auth.users` alone, and locale JSONs are display strings. The
save/cloud consistency question reduces to one ledger row (flush leg
ordering + journal namespace fence) with deterministic unit coverage;
no save-write path itself changed. Residual staging risk is recorded as
a coverage gap, not silently waived.

## Invariant Ledger

| # | Invariant | Evidence | Result |
|---|-----------|----------|--------|
| 1 | Newest rotated credential persisted before old record retired (atomic tmp+rename) | `GuestCredentialStore.save` tmp+rename; `SupabaseSession.storeSupabaseSession` guest-only write; store test asserts tmp→rename order | HOLDS |
| 2 | safeStorage unavailable/corrupted = recovery error, never plaintext, never new anonymous signup | `GuestCredentialStore.load` corrupted/invalid codes; `restoreDurableGuestSession` maps to 'corrupted'/'unavailable'; `auth-credential-error` surface; no fallback path exists | HOLDS |
| 3 | Later durable op wins over earlier queued op; failed op never wedges chain | serialized `durableChain`; `durableSeamDown` latch on store errors | HOLDS |
| 4 | Transient refresh failure retains identity + journal; terminal rejection clears | `resolveFailure()` distinguishes stored-vs-cleared; unit test asserts retention after 500, clear after 400 | HOLDS |
| 5 | Same-UUID upgrade; no second profile/character; finalize resumable; client metadata cannot elevate | `updateUser` PUT + same-uuid guard; `finalize_guest_upgrade` derives from `auth.users` only; replay-idempotent | HOLDS |
| 6 | Logout order flush → revoke → signout → clear; offline signout never claims remote revoke | `requestSessionLogout` legs; `AuthLogoutOutcome` honest states; ordering assertion in unit tests | HOLDS |
| 7 | Registered sessions stay session-scoped (no durable write) | `storeSupabaseSession` gate `mode === 'guest'`; finalize clears durable | HOLDS |
| 8 | Cross-account switch is explicit ack, never merge/transfer | `crossAccountAck` ConfirmModal gate on login/register/new-guest submit | HOLDS |
| 9 | Taken login id surfaces `id_taken`, never `server_unavailable`; a non-duplicate 400 (e.g. `email_address_invalid`) is NEVER `id_taken` | `isEmailExistsError` (422, or email_exists payload on any status) -> `id_taken`; all other 400s -> `server_unavailable`; staging-proven defect found and fixed — see finding 1 | HOLDS |
| 10 | A durable-record mismatch/corruption never resurrects a wrong identity | generation fence on store/clear; e2e rotated-token + rejected-token specs | HOLDS |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|------------------------|--------|---------------------|
| `npx vitest run src/services/supabase src/services/auth src/main-process/GuestCredentialStore.test.ts` | pass | SupabaseSession +16 durable tests, auth service 26 tests incl. 422 repro, store 10 tests |
| `npx playwright test -c playwright.electron.config.ts` | 6/6 pass | process close/reopen specs incl. finalize-interruption replay; e2e cipher substitutes only the cipher primitive (no OS keyring headless) |
| `npx vitest run` (full) | 828 files pass, 1 skipped | includes audio-binding manifest scan, all architecture guards |
| `npm run type-check` | pass | vue-tsc clean |
| `npm run build` | pass | |
| `npm run test:supabase` | NOT RUN — no staging creds | `SUPABASE_STAGING_*` absent in env; contract spec env-gated |
| P18 OCR delegation preview+rule | 29 files reviewable, all reviewed | see P5 pass notes |

## Findings

### QA-2026-09-30-PR6-1: GoTrue duplicate-email on upgrade link returned 422, misreported as server_unavailable
- Severity: Medium
- Status: Confirmed (SOURCE_PROOF + failing-then-passing repro test)
- Invariant: a taken login id must surface `id_taken`, not `server_unavailable`
- Preconditions: stored guest session; chosen login id already registered (synthetic email collision)
- Reproduction: PUT `/auth/v1/user` → `422 {error_code: 'email_exists'}`; old code mapped only `400 → id_taken`
- Expected: `{ok:false, code:'id_taken'}`
- Actual: `{ok:false, code:'server_unavailable'}` — user told the server is down rather than the id is taken
- Evidence: `SupabaseAuthService.ts` upgradeGuest catch; GoTrue reports duplicate email as 422 on `updateUser`
- Test file: `src/services/auth/SupabaseAuthService.test.ts` (`GoTrue 422 email_exists ... maps to id_taken`)
- Owner subsystem: `services/auth`
- Blast radius: upgrade form error reporting only
- Resolution: FIXED — `isEmailExistsError` maps only true duplicate-email failures (any 422, or `email_exists`/`already registered`/`already in use` in a 400 payload) to `id_taken`. Follow-on staging verification by the coordinator then exposed the larger defect this fixes do not regress: a combined `{email,password}` link PUT returns 400 `email_address_invalid "Email address \"\" is invalid"` on real GoTrue (the email_change flow targets the anonymous user's empty CURRENT address when a password is present) and was itself misreported `id_taken`. Fix: the link PUT is email-only (`{email}`); the password binds post-finalize via `completeUpgrade` -> `updateUser({password})` on the email-bound session — never persisted. New mapping pinned by specs: 400 `email_address_invalid` -> `server_unavailable`, 429 email-send rate limit -> `rate_limited` (marker kept), both green.

### QA-2026-09-30-PR6-2: durable clear is fire-and-forget; killed-mid-logout can leave the record on disk
- Severity: Low
- Status: Coverage gap
- Invariant: explicit logout retires the durable guest credential
- Preconditions: logout immediately followed by a process kill inside the IPC clear's flight window
- Expected: durable record gone before teardown
- Actual: `enqueueDurable` does not return the chain; a process exit inside the window can leave the record. Next launch restores the guest and refreshes — the refresh token is still valid if the signout never reached the server (offline logout), so the identity honestly resumes; if signout landed, GoTrue revoked the refresh token and restore fails closed to a cleared credential.
- Evidence: `SupabaseSession.enqueueDurable` (void enqueue), `SupabaseAuthService.logout` finally-clear
- Test file: none — harness cannot control OS process death within the IPC window
- Owner subsystem: `services/supabase` durable seam
- Blast radius: narrow timing edge; honest outcomes either way (never resurrects a revoked credential)

### QA-2026-09-30-PR6-3: durableError-only resume candidate can mint a synthetic local guest on Continue
- Severity: Low (Nit)
- Status: Suspected
- Invariant: a corrupted/unavailable durable store surfaces a recovery error rather than silently continuing
- Preconditions: durable record corrupted AND no local/acked save exists
- Actual: `readResumeCandidate` returns a candidate (`stored:false`, `durableError` set) → Continue emits a synthetic local guest session while the `auth-credential-error` notice is shown. This is a LOCAL synthetic identity (the pre-existing local-save shape), not a Supabase anonymous signup, and the error is displayed; but Continue does mint a new identity alongside the warning.
- Evidence: `resumeSession.ts` readResumeCandidate durableError branch; `AuthEntryScreen.continueSaved` non-stored arm
- Owner subsystem: `composables/resumeSession`
- Blast radius: entry UX only; no credential or save is damaged (the credential is already unreadable)
- Deferred: blocking Continue here would remove the only remaining play path when the credential is unrecoverable and nothing is saved; the recovery error is already surfaced loudly.

## New or Changed QA Tests

Post-gate staging verification (coordinator, real staging + migration `202609300003`): 24/24 prior contract tests pass; the original 3 guest-upgrade specs failed on the `{email,password}` link PUT (400 `email_address_invalid`) — production defect in `upgradeGuest`, fixed above. Spec updated to the email-only PUT plus a post-finalize `updateUser({password})` step; staging re-run pending (no `SUPABASE_STAGING_*` creds on this box). Runbook note: the GoTrue project email-send rate limit (429 on the link PUT) is a real staging/beta constraint — the surface reports "try again in a few minutes" (`rate_limited`) and keeps the pending marker; operators raising email quotas unblocks, no client change needed.

- `src/services/auth/SupabaseAuthService.test.ts` — new `GoTrue 422 email_exists ... maps to id_taken` spec (the fixed defect's pin); plus resume/upgrade/finalize/logout ordering specs asserting call order and stored-session mutation.
- `src/services/supabase/SupabaseSession.test.ts` — durable seam: guest-only write, ordering, restore statuses, generation fence.
- `src/main-process/GuestCredentialStore.test.ts` — atomic tmp+rename, corrupted/unavailable/invalid codes, no-plaintext round-trip, IPC allowlist.
- `tests/electron/guest-persistence.spec.ts` — 6 process-restart specs: encrypted-at-rest + same userId, rotated token persisted, rejected token clears (no re-signup calls), transient failure retains, upgrade → PENDING marker → relaunch → recheck → finalize replay, no plaintext token under userData.
- `tests/integration/supabase/guest-upgrade.spec.ts` — staging contract spec (env-gated): same-uuid link → pending → confirmed → finalized with identical character id; metadata-spoof rejection; LOGIN_ID_TAKEN/ALREADY_REGISTERED verdicts.

## Gaps and Residual Risk

- **Staging run gap (material, env-blocked):** `SUPABASE_STAGING_URL`/`SUPABASE_STAGING_ANON_KEY`/`SUPABASE_STAGING_DB_URL` absent → `npm run test:supabase` and the provider proof (anonymous signup → link → password → refresh → same UUID) never executed. The contract spec is written and env-gated; EXT-09's pending-confirm design is implemented per the authoritative verdict. This is the dominant residual risk.
- **Real-cipher gap:** headless CI has no OS keyring; the Electron specs substitute the cipher primitive only (`TUTIEN_E2E_CREDENTIAL_CIPHER=e2e`). Store logic, IPC allowlist, atomic write, and disk path are the production ones, but `safeStorage.encryptString` itself is not exercised end-to-end.
- **Character-id continuity** (upgradedCharacter.id === originalCharacter.id) cannot be asserted without a live DB; stubbed only.
- Low findings PR6-2/PR6-3 recorded above as deferred/coverage-gap.

## Pre-existing Failures

- `npm run lint` repo-wide reports ~86 pre-existing errors / ~196 warnings on files outside this task's surface (probe-seams evidence, optimize.mjs, authority.spec.ts, etc.). Task-owned files were linted clean after `--fix` (button content-newline warnings + one unused import).
