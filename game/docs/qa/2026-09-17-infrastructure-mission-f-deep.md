# Deep QA — Mission F (Verification & Infrastructure)

Date: 2026-09-17 · Mode: **deep** (mandatory escalation — save/cloud + auth/session boundary materially changed) · Branch: `chore/infrastructure` · Base: `master @ 66fd042b`

## Scope

Task-owned surface (11 commits, `master..HEAD`): test tsconfig project + lab isolation, presentation-gate key fix, per-checkout strict ports, `npm run verify`, env/packaging hygiene, single `TICK_INTERVAL_MS` authority, EventBus snapshot+isolation, per-account save keys (`saveKeys.ts`), Supabase timeout + token refresh, login-time newest-wins remote sync + in-place SQL fix.

Changed-risk-map: `deepAuditCandidate: true` (save-and-cloud + time-and-offline critical boundaries, 4 domains). Unmapped paths manually routed: `useAppLifecycle.ts` → save-and-cloud boot chain + ui-input-lifecycle; `vite/playwright/tsconfig*` → tooling (verified via `npm run verify` + in-worktree Playwright runs, not gameplay domains); `index.html`/`package.json` → packaging; `*.sql` → save-and-cloud remote boundary; `tests/e2e/helpers.ts` → e2e seam (guest slot key).

## Invariant ledger

| ID | Hypothesis | Invariant | Oracle | Result |
| --- | --- | --- | --- | --- |
| INV-F-1 | Account-slot resolution diverges between bind-time (`accountIdForSession`, loginId fallback) and reload fallback (`readSupabaseSession`) | Synchronization | `saveKeys.test.ts` (4 tests) + MockAuthService stores no session → reload → guest → rebind on re-auth | **Resolved** — convergent for real Supabase sessions (userId both paths); mock-auth is dev-only and rebinds on re-auth |
| INV-F-2 | Remote pull writes `shape.normalizedSave` — if normalization dropped `version`, next `loadGame()` → `incompatible` → boot block | Recoverability | `saveShapeValidation.ts:1393` — `normalizedSave = {...parsed, equipment, equipmentSlots}` retains `version`; `SupabaseRemoteSave.test.ts` pull case asserts a loadable write | **Resolved** — version survives |
| INV-F-3 | Pull/push slot: sync must read+write the *account* slot, not guest | Synchronization | Pull/push resolve through `resolveSaveKey()`/`resolveRevisionKey()` → bound `explicitAccountId` or stored-session userId; test binds `setSaveAccountId('u1')` | **Resolved** |
| INV-F-4 | Pre-Mission-F stored session (no `expiresAtMs`/`userId`) — refresh storm or wrong slot | Degraded env | `SupabaseSession.test.ts` missing-expiry case → one refresh, then `expiresAtMs` persisted; `resolveSaveAccountId` maps userId-less session → guest | **Resolved** — one refresh per call is bounded; userId-less sessions skip sync without refreshing |
| INV-F-5 | Guest session triggers a wasted/harmful token refresh inside sync | Degraded env | `SupabaseRemoteSave` checks `readSupabaseSession()` *before* `resolveSupabaseSession()` — guest/userId-less → `skipped`, zero fetch (test asserts `calls.length === 0`) | **Resolved** — found + fixed during implementation (guest check precedes refresh) |
| INV-F-6 | Refresh failure mid-boot flips the save slot | Recoverability | Refresh failure clears sessionStorage, but `explicitAccountId` (bound at `onAuthenticated`) still wins in `resolveSaveAccountId` → slot stays `:u1`; unbound menu-start path → guest slot = spec'd signed-out state | **Resolved** — spec-consistent both ways |
| INV-F-7 | EventBus snapshot: `off`/`clear` mid-dispatch leaks events into disposed scenes | Lifecycle | No production caller of `eventBus.clear()`; scenes teardown via per-handler `off()` (`CombatScene:1514`); snapshot-then-finish is the plan's stated semantics | **Resolved** |
| INV-F-8 | `TICK_INTERVAL_MS` 100→1000 could speed/slow consumers expecting 100ms | Determinism | Sole consumer is `useAppLifecycle:196` (previously a local `1_000` const) — zero other importers; test asserts `timeoutMs === TICK_INTERVAL_MS` | **Resolved** — no behavior change |
| INV-F-9 | Two tabs share account slot → CAS thrash | Concurrency | sessionStorage is per-tab → second tab resolves guest → isolation preserved; same-tab writers go through coordinator CAS | **Resolved** |
| INV-F-10 | `deleteSave` leaves sibling keys (revision/handoff) behind on the account slot | Atomicity | `SaveSystem.ts:614-616` removes save+handoff+revision via resolvers; backup key intentionally left (documented — same-storage backup dies with site data anyway) | **Resolved** |
| INV-F-11 | remoteSync races `coordinator.load()` — pull must land before local read | Synchronization | `useAppLifecycle.test.ts` asserts `remoteSync` `invocationCallOrder` < `coordinator.load`; pull writes revision-first (same convention as `LocalCloudSaveService`) | **Resolved** |
| INV-F-12 | Authenticated requests carry anon key → RLS silently empties every query → sync degrades to `skipped` forever | Correctness | Test captures every fetch `Authorization` header — asserts `Bearer tok-u1` on all calls | **Resolved** — guarded |
| INV-F-13 | Push omits `updated_at` → every UPDATE keeps insert timestamp → newest-wins goes stale | Monotonicity | Push body sends explicit `updated_at: new Date().toISOString()`; test asserts it | **Resolved** |
| INV-F-14 | Remote `{}` payload (`p_initial_save` from `create_character`) pulled over a real local save | Recoverability | `validateGameSaveShape({})` fails → treated as absent → local pushes (test) | **Resolved** |
| INV-F-15 | `cardinality = 3` SQL rejects the client's 1-talent contract | Correctness | In-place fix: `characters_one_talent` check + RPC `<> 1` both places + `CHARACTER_CREATION_TALENT_COUNT = 1` comment; insert/update RLS policies added for the direct table upsert | **Resolved** |
| INV-F-16 | remoteSync swallows boot (hang/failure blocks entry) | Recoverability | `useAppLifecycle.test.ts`: rejection still reaches `coordinator.load`, outcome `require-character`; all Supabase fetches carry 10s `AbortSignal.timeout` | **Resolved** |
| INV-F-17 | Mid-dispatch handler exception aborts remaining handlers / reaches tick emitter | Lifecycle | `EventBus.emit` per-handler try/catch + `console.error`; 3 new tests (snapshot, add/remove during dispatch, throw isolation) | **Resolved** |
| INV-F-18 | Port collision between parallel worktrees / stale server reuse on CI | Environment | `devPortForRoot` hashes checkout root; `strictPort: true` both server+preview; `reuseExistingServer: !CI`; in-worktree `boot-fresh` + `save-reload` + `error-recovery` green on derived port 5505 | **Resolved** |
| INV-F-19 | remoteSync consumes a pending import-handoff marker before `coordinator.load()` — the "N items discarded" import toast reports 0 | Recoverability (feedback-only) | `loadGame()` inside sync runs the handoff-consumption block; marker's `normalizedRaw` must match anyway | **Low — deferred** — requires import + remote-capable account + fresh boot; save data unaffected, only the count toast |
| INV-F-20 | `explicitAccountId` module binding survives Vue remount (HMR) → stale account slot | Stale state | `setSaveAccountId` has no unmount reset | **Nit — deferred** — dev-only seam; production unmount = page teardown |
| INV-F-21 | Refresh response missing `expires_in` → `expiresAtMs` stays undefined → every `resolveSupabaseSession` re-refreshes | Boundedness | One fetch per call, never a loop | **Nit — deferred** — GoTrue always returns `expires_in`; missing ⇒ self-heals on next login |

## Verification evidence

- `npm run verify` (type-check + build + full vitest): **green** — 627 files / 5,271 passed + 4 expected-fail.
- In-worktree Playwright (P13): `boot-fresh`, `save-reload`, `error-recovery` (4 tests) green on derived port 5505 — guest save path round-trips through `:guest` keys; remote sync leaves the guest path untouched.
- New contract tests: `saveKeys` 4, `SupabaseHttp` 2, `SupabaseSession` 5, `SupabaseRemoteSave` 7, `useAppLifecycle` remoteSync 3, EventBus 3, tick-authority 1.

## Deferred findings

| Severity | Finding | Disposition |
| --- | --- | --- |
| Low | Login-time sync's internal `loadGame()` can consume an import-handoff marker, losing the "discarded items" count toast | INV-F-19 — feedback-only, rare chain |
| Nit | `explicitAccountId` module binding survives HMR remount | INV-F-20 — dev-only |
| Nit | Missing `expires_in` in refresh response re-refreshes per resolve call | INV-F-21 — bounded, self-healing |
| Pre-existing | `SupabaseAuthService.logout()` has no production caller; `saveKeys.ts` documents the required `setSaveAccountId(null)` pairing for a future logout path | Out of scope — no logout UI exists |

## Verdict

**PASS WITH EVIDENCE** — no confirmed defects. All high-risk hypotheses resolved by failing-test-first contracts plus in-worktree browser evidence; deferred findings are Low/Nit with recorded reasons.
