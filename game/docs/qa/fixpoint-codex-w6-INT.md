# Fixpoint QA — Wave 6, INT (adversarial integration)

- **Reviewer**: INT (integration/adversarial)
- **Target**: `codex/hoa-cau-fireball-vfx` @ `1bd0763f` (post-wave-5 state)
- **Inputs**: `fixpoint-codex-adjudication.md` (wave-5 dispositions), `git diff 66746ede..1bd0763f`, wave-5 reports, w4int/w5int/w5aut repro+pin files
- **Scope attack**: the six dispatched seams across the wave-5 delta — `useBootFlow.fail()` bounded retry, pending-* → `saveIssue.report('local')` → `SaveIncompatibleScreen`, `attemptReconnect` reorder vs `App.vue` onResume, `saveIssue.scope` mid-flight overwrite into `remoteResettable`, migration `202610070001` canonical order vs `save_inventory_compatibility`, and whether the wave-5 test pins pin the fix.
- **Evidence**: EXECUTED_REPRO (new `src/services/save/w6int.repro.test.ts`, 2/2 pass on this tree), EXECUTED_VERIFY (`npm run type-check` clean; `vitest run src/services/save src/composables src/presentation` = 86 files / 1173 tests, all pass), SOURCE_PROOF, INFERRED.

## Verdict: FINDINGS — 1 Medium + 2 Low + 4 Nit

| ID | Severity | Class | Root | Surface |
|---|---|---|---|---|
| W6-INT-1 | **Medium** | REAL_DEFECT | STA-05 | `useBootFlow.fail()` bounded retry vs microtask-chained competing requests |
| W6-INT-2 | Low | REAL_DEFECT | CON-06 | `useAppLifecycle` first-save `markFailed('recovery')` overrides `observeSaveResult`'s `'revoked'` |
| W6-INT-3 | Low | REAL_DEFECT | STA-05 | `OnlineSessionController.attemptReconnect` local branch: onResume outside try + no in-flight guard |
| W6-INT-4 | Nit | DOCUMENTATION_DEFECT | — | `SaveIncompatibleScreen.handleExport` provenance keys on `remoteAuthoritative`, not `saveIssue.scope` |
| W6-INT-5 | Nit | REAL_DEFECT | UX-01 | first-save failure reports `raw=''` → export affordance writes an empty file |
| W6-INT-6 | Nit | REAL_DEFECT | CON-04 | sibling fire-and-forget `void coordinator.request(...)` callers still swallow `'rejected'` |
| W6-INT-7 | Nit | TEST_DEFECT | TST-02 | `w5aut.repro.test.ts:441` comment claims the name message mislabels charset as length — no longer true |

---

## W6-INT-1 — Medium — fail()'s 3-attempt bound is exhausted by microtask-chained competing transitions: the error surface silently never mounts

**Class** REAL_DEFECT · **Root** STA-05 (ordering race at a lifecycle boundary)

**Evidence**: EXECUTED_REPRO — `src/services/save/w6int.repro.test.ts` test 1 (green on this tree); control test proves the single-conflict retry works.

The wave-5 fix for W5-INT-2 replaced the fire-and-forget `fail()` with:

```ts
for (let attempt = 0; attempt < 3; attempt++) {
  const result = await coordinator.request({ target: 'error' })
  if (result.status !== 'rejected') return
  await coordinator.whenIdle()
}
```

`whenIdle()` awaits only the CURRENT `inFlightPromise`. The hole is in the settle ordering of `GamePresentationCoordinator.request()`: the inner transition promise resolves, its first continuation (the `await promise` inside `request()`, registered at request time) clears `inFlightRequest`/`inFlightPromise` and resolves the caller-facing promise — which queues that caller's `.then` continuations — and only THEN does `whenIdle`'s `.then` continuation resolve fail()'s wait. A competitor chained off its own request — `await request(A); request(B)` — fires B inside a continuation that runs strictly before fail()'s loop continuation. The in-flight slot is re-taken in the one-microtask gap `whenIdle` retries into, on EVERY settle.

Repro (executed): A (`home→auth`) parked at `closing`; competitor `competitor(a, ['character','home'])`; `flow.fail()`. Result: attempt 0 rejected by A; B lands in the gap → attempt 1 rejected; C lands in the gap → attempt 2 rejected; loop exits. Final state: `currentRoute='home'`, `phase='idle'`, `isRouteMounted('error')===false`, `snapshot.error===null`, `flow.stage==='game'`. No log, no surface, no retry — the armed `saveIssue` latch is a dead write (the W4-INT-1 harm window, deferred not closed).

The competitor shape is real, not synthetic: `await request(X)` then `request(Y)` is exactly what a queued domain flow looks like — e.g. an auto-advance after a combat/tribulation settle, or `onTransitionBack`'s home request chained behind a `retry()`. W5-INT-2 needed the transition merely in-flight at fail() time; this needs three consecutive competitors each chaining off the previous settle — rarer, but deterministic when it happens, and the consequence is identical: the terminal error route never mounts while a saveIssue armed for a corrupt/quarantined save stays invisible until the next boot redetects it.

Note: `markRouteMounted` leaks nothing here — `mountedRoutes` only records what actually mounted, and `prepare()`'s `mountedRoutes.has(target)` short-circuit is intentional for keep-alive trees.

**Fix direction**: the loop's bound only makes sense if `'rejected'` could persist forever; every settle ends the slot, so retry until `status !== 'rejected'` (rejection is defined as transient contention) — or have the coordinator queue/preempt `{target:'error'}`. Either way, pin the ≥2-competitor chain (the added repro file does this).

---

## W6-INT-2 — Low — W5-AUT-1 first-save failure: `markFailed('recovery')` overrides the `'revoked'` terminal `observeSaveResult` just set

**Class** REAL_DEFECT · **Root** CON-06 (user-facing surface contradicts the failure's actual class)

**Evidence**: SOURCE_PROOF — `useAppLifecycle.ts:614-627`, `OnlineSessionController.ts:268-283`, `App.vue` `authorityMessage` map.

The W5-AUT-1 fix handles a non-retryable first-save `unavailable` by `authority.observeSaveResult(firstSave)` then `authority.markFailed('recovery')` + `saveIssue.report('corrupted', '', undefined, 'remote')` + `boot.fail()`. But `observeSaveResult` already classifies `AUTH_EXPIRED && !retryable` → `enterTerminal('revoked')` (the re-auth surface). The unconditional `markFailed('recovery')` then re-enters terminal as `'recovery'` — the save-recovery surface — mislabeling a credential failure as a save-corruption failure and arming `SaveIncompatibleScreen` with `scope:'remote'` → `remoteResettable=true` → offers the destructive remote reset for a problem the reset cannot fix.

Impact bound: self-protecting — `resetCharacter` for an AUTH_EXPIRED binding resolves `'unavailable'` → notify + abort before `deleteSave`; both terminals funnel through `acknowledge()`. The harm is wrong copy/affordance, not destruction.

**Fix direction**: in the firstSave branch, skip `markFailed` when `observeSaveResult` already terminated (e.g. gate on the authority's resulting state, or report `'corrupted'` only for codes that aren't `AUTH_EXPIRED`).

---

## W6-INT-3 — Low — `attemptReconnect` local branch: `onResume` runs before the in-flight guard and outside the try — reentrant and unhandled-rejection path

**Class** REAL_DEFECT · **Root** STA-05

**Evidence**: SOURCE_PROOF — `OnlineSessionController.ts:447-461` vs remote branch `:464-490`.

The wave-5 reorder (W5-INT-3) correctly moved `onResume` before `markReady` under the generation guard — but only inside the remote branch. The local branch (`!deps.reconnect`) calls `deps.onResume?.('same')` at line 457 BEFORE `reconnectInFlight` is set (line 464 is remote-only) and OUTSIDE any try:

- A throwing local `onResume` escapes `attemptReconnect` as a rejected promise; both callers use `void this.attemptReconnect()` (lines 235/252/435) → unhandled rejection. The armed retry interval survives and re-fires, so the session self-heals — but every failed local resume logs an unhandled rejection.
- `resumeFromSuspend()` plus the retry interval plus `pause()` can fire overlapping `attemptReconnect` calls; the remote branch dedups on `reconnectInFlight`, the local branch does not — a slow local `onResume` can run re-entrantly (double restore; `markReady` itself stays protected by the generation check).

**Fix direction**: hoist `reconnectInFlight = true` and the try/finally to cover the local branch too.

---

## Seam verdicts (dispatched attack list)

1. **fail() retry** — FINDING W6-INT-1. Bound is exhaustible; silent give-up confirmed by executed repro. `markRouteMounted` does not leak state.
2. **pending-* local scope → SaveIncompatibleScreen** — CLEAN. `report('corrupted', pendingRaw, undefined, 'local')` → `remoteResettable === false` (frozen const at setup; `remoteAuthoritative && scope==='remote'`). UI shows export + local-delete + import-copy only; the reset leg skips `resetCharacter` entirely and `deleteSave()` clears local envelope keys (`listSaveEnvelopeKeys`) — the remote row is never touched end-to-end.
3. **attemptReconnect reorder vs App.vue onResume** — CLEAN (remote branch). onResume→reject runs `markFailed('recovery')` inside try → generation bump skips `markReady` → `enterTerminal` cleared retry → the `'recovery'` terminal owns the surface; `acknowledge()` is the only exit — single owner, happy-path order preserved (onResume first, `markReady` only if generation untouched). Residual local-branch exposure is W6-INT-3.
4. **saveIssue.scope mid-flight overwrite** — CLEAN. `remoteResettable` is a plain const captured at component setup — a later remote-scope `report()` updates the reactive fields (status/raw shown) but cannot flip a locally-mounted screen's affordance on. The reverse direction (remote-mounted screen, later local report) requires a pending-local detection while the remote gate is up — the pending-* branches only fire during boot load, before this screen exists — unreachable in practice.
5. **Migration vs `save_inventory_compatibility`** — CLEAN. `reset_character` hard-deletes → the view emits zero rows for that character — correct semantics for an operator-only view (revoked from all api roles; no client read). `load_game_state`'s `(deleted_at is null) desc, created_at desc` ordering picks the live row when a tombstone coexists — canonical and consistent across load/write/reset/create.
6. **Test pins** — ADEQUATE with one gap. `useBootFlow.test.ts:87` pins the single-conflict retry (mental regression of the fix → `waitFor` timeout → fails). `w5int.repro.test.ts` pins the `'rejected'` contract, the remote onResume-throw→`'reconnecting'`+retry-armed behavior, and the lexical onResume-before-try order — a revert of the wave-5 reorder trips the lexical pin. Gap = ≥2 chained competitors, now covered by `w6int.repro.test.ts`.

## Nits (deferred, recorded)

- **W6-INT-4** `SaveIncompatibleScreen.vue:52-56`: export `{source}` keys on `remoteAuthoritative` (deployment capability), not `saveIssue.scope` — a `'local'`-scope quarantined boot in a remote-authoritative build exports the local pending bytes labeled `{source:'cloud'}`. Content correct; provenance tag wrong.
- **W6-INT-5** `useAppLifecycle.ts:626`: first-save failure reports `raw=''` → the export affordance writes an empty file. Dead affordance, harmless.
- **W6-INT-6** Sibling rejected-swallow class (the shape W5-COR-4 fixed for `fail()` alone): `App.vue:380` (pre-boot `'auth'` escape), `App.vue:393` (`'home'` abandon-battle back), `useBootFlow.showAuth/requireCharacter/enterGame` — all `void coordinator.request(...)`; a `'rejected'` result silently drops a user-intended navigation. Each is individually re-clickable; lower weight than `fail()` because they arm no invisible latch.
- **W6-INT-7** `w5aut.repro.test.ts:441-444`: comment still claims `CHARACTER_NAME_INVALID` "mislabels it as a LENGTH problem" citing `SupabaseCharacterCreationService.ts:40` — that message now names the allowed charset ("chỉ gồm chữ, số, khoảng trắng, gạch ngang và gạch dưới"). Stale comment.

## Verification executed on this tree

- `npm run type-check` (vue-tsc --build): clean.
- `npx vitest run src/services/save src/composables src/presentation`: 86 files / 1173 tests, all pass — including `w6int.repro.test.ts` (2/2: starvation repro green, single-conflict control green).
