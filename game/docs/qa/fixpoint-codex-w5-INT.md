# Fixpoint QA — Wave 5, INT (adversarial integration)

- **Reviewer**: INT (integration/adversarial)
- **Target**: `codex/hoa-cau-fireball-vfx` @ `66746ede` (post-wave-4 state)
- **Inputs**: `fixpoint-codex-w4-INT.md`, `fixpoint-codex-adjudication.md`, `git log 0afd0b2f..66746ede`, protocol README, w4 repro/pin files
- **Scope attack**: seams the wave-4 fixes compose — not the edited lines. Full reset lifecycle (boot → incompatible gate → `reset_character` → reload → `empty` → `requireCharacter` → creation), the `'deleted'` reroute, the `bootFlow.fail()` ordering, `resetCharacter` error mapping, and whether the new test pins pin the behavior they claim.
- **Evidence**: EXECUTED_REPRO (new `src/services/save/w5int.repro.test.ts`, 3/3 pass, ran on this tree), EXECUTED_VERIFY (`npm run type-check` clean; scoped vitest 788 pass + 1 expected-fail), SOURCE_PROOF, INFERRED.

## Verdict: FINDINGS — 1 High + 4 Medium

| ID | Severity | Class | Root | Surface |
|---|---|---|---|---|
| W5-INT-1 | **High** | REAL_DEFECT | CON-06 | `locales/{vi,en}.json` `saveIncompatible.confirm.resetCloud*` + `SaveIncompatibleScreen.handleReset` |
| W5-INT-2 | **Medium** | REAL_DEFECT | CON-04 | `App.vue` onResume reject → `useBootFlow.fail()` → `GamePresentationCoordinator.request()` |
| W5-INT-3 | **Medium** | REAL_DEFECT | STA-05 | `OnlineSessionController.attemptReconnect` markReady-then-onResume ordering |
| W5-INT-4 | **Medium** | REAL_DEFECT | CON-02 | `useAppLifecycle` 'deleted'→`requireCharacter` vs `create_character` tombstone handling |
| W5-INT-5 | **Medium** | TEST_DEFECT | TST-01 | `src/services/save/w4int.repro.test.ts` stale "verbatim" replica |
| W5-INT-6 | Low (re-flag) | REAL_DEFECT | PER-09 | `App.vue` resume-reject `JSON.stringify(save)` vs server-verbatim bytes |
| — | Nit | DOCUMENTATION_DEFECT | — | stale "soft-deletes" comment; resetNotice stale carry |

---

## W5-INT-1 — High — the gate's confirm dialog promises the cloud save is NOT deleted; the action now hard-deletes the character

**Class** REAL_DEFECT · **Root** CON-06 (user-facing contract contradicts behavior)

**Evidence**: SOURCE_PROOF.

`saveIncompatible.confirm.resetCloudTitle/Body`:

- vi.json:1873-1874 — "Tải Lại Từ Cloud" / "…Save trên máy chủ không bị xoá — nếu dữ liệu server vẫn lỗi, màn hình này sẽ hiện lại."
- en.json:1873-1874 — "Reload From Cloud" / "…The cloud save is not deleted — if the server data is still corrupt, this screen will return."
- button `saveIncompatible.actions.resetCloud` (vi.json:1866) — "Tải Lại Từ Cloud".

What `handleReset` now does under `remoteAuthoritative` (SaveIncompatibleScreen.vue:62-77): `cloudSaveCoordinator.resetCharacter()` → `reset_character` RPC → `DELETE FROM public.characters` — the entire character row plus every cascade (saves, checkpoints, receipts). The user then lands on character creation. Everything the dialog says is false: the cloud save **is** deleted, the screen **will not** return, and nothing is "reloaded from the server" — the server state is destroyed.

Why this is High not Medium: it is an affirmative false safety claim on an irreversible destructive action. The dialog does not merely fail to warn — it asserts the opposite of the truth, in both locales, under a `danger: true` confirm. A user who reads the copy reasonably believes their cloud progress survives.

Contrast for correctness: `panels.settings.confirm.resetCloudBody` (vi.json:807) carries nearly identical copy but is **honest** — the settings reset (`App.vue:803`) deliberately performs a local-only `deleteSave()` + reload (no `resetCharacter`), so the server row does survive there. The wave-4 change turned the *same copy family* false on one surface while it stays true on the other — exactly the kind of drift a copy audit misses.

**Fix direction**: new strings for the gate (e.g. `resetCloudBody`: "Xoá nhân vật và toàn bộ save trên máy chủ, rồi tạo nhân vật mới? Hành động này không thể hoàn tác." / "Delete the character and ALL server saves, then create a new character? This cannot be undone."), title/button renamed away from "Reload From Cloud" (e.g. "Xoá Save Cloud"), and update the stale component comment at SaveIncompatibleScreen.vue:20-23 ("reset becomes a cloud recheck that restores whatever the authoritative row holds") + the in-handler comment ("soft-deletes it first" — it is a hard delete).

---

## W5-INT-2 — Medium — `bootFlow.fail()` is silently dropped whenever a route transition is in flight; the W4-INT-1 harm window survives the fix

**Class** REAL_DEFECT · **Root** CON-04 (caller cannot observe the rejection the callee returns)

**Evidence**: EXECUTED_REPRO — `w5int.repro.test.ts` test 1.

The wave-4 fix adds `bootFlow.fail()` after `saveIssue.report(...)` on the onResume-reject path. `fail()` is `void coordinator.request({target:'error'})`. `GamePresentationCoordinator.request()` at GamePresentationCoordinator.ts:208-215 resolves a conflicting request — while `inFlightRequest` is set — as `{status:'rejected'}`: a resolved value, never a throw, never a log. The `void` in `fail()` swallows it; no caller can observe that the error transition never ran.

Repro (executed): park a `home→combat` transition in `phase:'closing'` (deferred `curtain.close`), fire `request({target:'error'})` — the exact call the fix issues. Result: `{status:'rejected'}`; the in-flight transition completes `'entered'` to `combat`; the coordinator lands `idle` on combat.

Reachability of the window: the onResume-reject handler runs when a reconnect pipeline resolves 'resumed' with a save the restore boundary rejects — i.e. typically while `authorityState==='reconnecting'` and the authority overlay is up. But a transition *started before* the overlay rose (user clicked a battle as the heartbeat was dying) can still be mid-flight — curtain/asset steps are 1-3s — precisely overlapping the reject. In that window the fix is a no-op: the player lands in the game on a rejected payload, `entryStage` never becomes `'error'`, `saveIssue` stays latched as the dead write W4-INT-1 described, and the **next** error mount is hijacked into the corrupt-save gate — which, post-wave-4, now carries the destructive hard-delete path (W5-INT-1). Narrower window than W4-INT-1, same defect class, worse payload.

Note the same silent-drop applies to every `void`-ed `coordinator.request` on the fail paths (`bootFlow.fail`, `showAuth`, `requireCharacter`, `enterGame`) — the reject return type exists and nobody consumes it.

**Fix direction**: either `fail()` inspects the result and forces a retry/escalates (e.g. schedule the error request after the in-flight transition settles, or make `request` support a "preempt" flag for 'error'), or the coordinator treats `{target:'error'}` as always-preemptive (abort in-flight, transition to error). Whichever is chosen, pin it: a test that fires `fail()` during a 'closing' transition must observe the error route reached.

---

## W5-INT-3 — Medium — `markReady()` runs BEFORE `onResume`: a throwing resume produces a permanently paused, mutation-open dead session

**Class** REAL_DEFECT · **Root** STA-05 (state transition commits before the fallible step it enables)

**Evidence**: EXECUTED_REPRO — `w5int.repro.test.ts` test 2 (+ runtime-verified sibling, test 3 lexical pin).

`OnlineSessionController.attemptReconnect` (OnlineSessionController.ts:459-478): on `'resumed'` it calls `markReady()` — which transitions to `'ready'`, re-arms the heartbeat, and **clears the retry handle** — and only then invokes `deps.onResume`. `onResume` sits inside the `try`, so a synchronous throw is swallowed by `catch {}` whose comment reads "still 'unavailable' — keep retrying". That comment is false post-markReady: there is nothing left to retry with.

Repro (executed): `beginChecking → markReady → pause('heartbeat-failed')` (sim paused, retry armed) → reconnect resolves `'resumed'`, `onResume` throws. Observed: states `['checking','ready','reconnecting','ready']`; one pause (`'heartbeat-failed'`) and zero resumes; the 10s retry interval is cleared; the 30s heartbeat stays armed; `canMutate() === true`. The session looks healthy to every probe (the server is fine — the crash is client-side), the overlay is down, the simulation never resumes, and `persistProgress`'s `!canMutate()` guard stays open — the next autosave can write the half-restored state over the good server row.

Throw surface is real: the wave-4 `onResume` handler runs `restoreGameSession` (journal/acked-envelope localStorage reads — `SecurityError` on storage-disabled browsers), `JSON.stringify(save)`, `saveIssue.report`, `bootFlow.fail` — any synchronous throw lands in this dead state, and the new `'rejected'`-return guard can't cover it.

Sibling variant (pin test 3, runtime-verified in the audit run): the local-mode branch `markReady(); onResume('same')` at line 455 sits **outside** the try entirely — a throw escapes `attemptReconnect` onto the `void`-floated promise as an unhandled rejection (observed during the audit: vitest flagged exactly this rejection), while leaving the same dead `'ready'` state.

**Fix direction**: reorder so the session is only marked ready after a successful resume (call `onResume` before `markReady`, or wrap it in its own try and map a throw to `enterTerminal('recovery')` — not a silent retry-clear). The wave-4 fix handles the clean `'rejected'` return; this is the adjacent failure mode it cannot reach.

---

## W5-INT-4 — Medium — `'deleted' → requireCharacter` routes into a creation path the server permanently refuses

**Class** REAL_DEFECT · **Root** CON-02 (the fix's stated premise is unimplemented)

**Evidence**: SOURCE_PROOF.

The wave-4 change reroutes `loaded.status === 'deleted'` from a terminal error to `boot.requireCharacter()` — justified by the new comment "create_character ignores deleted rows". It does not:

- `create_character` (202610060001:295): `exists (select 1 from public.characters where user_id = v_session.user_id)` → `CHARACTER_EXISTS` — **no `deleted_at is null` filter**.
- Same migration :320 and `is_character_name_available` (202608240001:118-124): `normalized_name` check — no `deleted_at` filter; plus a plain unique index on `normalized_name`.

So a tombstoned account: boot → load `CHARACTER_DELETED` → `'deleted'` → character screen → submit → `CHARACTER_EXISTS` → UI message "Nhân vật đã tồn tại trên máy chủ — tải lại để tiếp tục" → reload → `'deleted'` → character screen → **self-sustaining dead loop with a misleading instruction**. Pre-wave-4 this was an honest dead end (error card, back-to-auth). Wave-4 made it a loop.

The reset migration's own comment proves tombstones are a live concern: "every other authority function resolves 'the' character by user_id without a deleted_at filter, so keeping a tombstone beside a fresh row would wedge them again" (202610060002:30-32) — which is why `reset_character` hard-deletes. But `deleted_at` remains settable outside the API (dashboard/admin action, a future soft-delete feature, a manual fix on a corrupt row) — the load path still returns `CHARACTER_DELETED` for it, and the client now routes that state into a creation flow that always rejects.

Reachability caveat (recorded honestly): no RPC currently *sets* `deleted_at`, so the loop is unreachable through the client today — but the contract the routing change claims does not exist, and the first tombstone to appear turns it into a guaranteed dead loop.

**Fix direction**: make the premise true — filter `deleted_at is null` (or auto-hard-delete the tombstone row) in `create_character`'s `exists`/`normalized_name` checks and in `is_character_name_available`; or if tombstones must keep their name reserved, revert 'deleted' to a terminal surface instead of creation.

---

## W5-INT-5 — Medium — the committed wave-4 repro replica encodes the pre-fix wiring as "verbatim"; the fix is behaviorally unpinned

**Class** TEST_DEFECT · **Root** TST-01

**Evidence**: SOURCE_PROOF + EXECUTED_VERIFY (suite is green on the post-fix tree).

`w4int.repro.test.ts` (committed at 66746ede) replicates "the src/App.vue onResume wiring verbatim" at lines 156-172 — but the replica omits `bootFlow.fail()` and its comment at 195-198 still asserts the pre-fix behavior: "unreachable post-boot because App.vue never calls boot.fail() on this path. The write is dead state." Both statements are now false in production, yet the file stays green — and a regression that *removes* `fail()` from App.vue keeps it green, because the replica pins the old shape. Presented as a wave-4 verification artifact, it is instead a snapshot of the pre-fix defect.

The only actual pin on the wave-4 wiring is the lexical witness `tests/architecture/w4corSaveBoundaryMirror.qa.test.ts` (scans App.vue source, asserts each `saveIssue.report(` is followed within 10 lines by `boot(Flow)?\.fail\(|entryStage='error'`). That is a source-adjacency pin — it pins *placement*, not *effect* (see W5-INT-2/3 for why the placement doesn't guarantee the effect).

`useAppLifecycle.test.ts`'s updated `CHARACTER_DELETED` case, `resetCharacter.spec.ts` (provision → save → DELETED → NO_CHARACTER → recreate CREATED), `boundaryMirrorW4.spec.ts`, `saveBoundaryMirrorParity.qa.test.ts`, and the `w4aut.repro.test.ts` residual-class pins were re-read and pin what they claim — this finding is scoped to the w4int replica.

**Fix direction**: refresh the replica to include `bootFlow.fail()` and drop the "dead write" claim (or annotate it as a deliberate historical witness, failing-forward: `it.fails`/`test.skip` with a comment pointing at the wave-4 fix). Add a behavioral pin for the fix itself — ideally covering the in-flight race (W5-INT-2) so the pin can't pass while the call is silently dropped.

---

## W5-INT-6 — Low (re-flag) — resume-reject reports re-serialized bytes; the "no reachable consumer" premise is now void

**Class** REAL_DEFECT · **Root** PER-09 (premise invalidated by a later change)

**Evidence**: SOURCE_PROOF.

W4-INT-2 stayed Low because `saveIssue.raw` had no reachable consumer. Wave-4 wired `SaveIncompatibleScreen.handleExport` to `saveIssue.raw` on the remote gate — the consumer is live. The resume-reject path stores `JSON.stringify(save)` (the parsed payload object from the reconnect load), while the boot path stores `loaded.raw` (server-verbatim string). Re-serialization is semantically equal but not byte-identical (whitespace, escapes, number forms), so the exported "raw corrupt save" can diverge from what the server actually rejected. Severity stays Low — the artifact remains forensically usable — but the premise it was deferred under is gone; record it so the next wave doesn't re-inherit the stale justification.

---

## Verified non-findings (negative space, attacked and cleared)

- **Reset lifecycle converges end-to-end**: remote reset → `deleteSave` (drops envelope/pending/acked/quarantine keys) → `markResetNotice` → `reload` → auth (notice consumed once at `AuthEntryScreen.vue:43`) → continue → `coordinator.load()` `empty`/`NO_CHARACTER` → `requireCharacter` → creation → `bootGame(true)` → `uninitialized` → grants → `firstSave` → `enterGame`. No stuck latch: `saveIssue` dies with the page, `bootStage`/`entryStage` re-derive from the route, `coordinator.reset()` clears revision/queue/generation on `onAuthenticated`, `pendingCreationMetadata` is overwritten per creation and unused on the `uninitialized` path (remote metadata is authoritative there). `newCharacterGrantsApplied` correctly hard-resets a same-mount second grant pass.
- **`requireCharacter`/`fail` are art-independent**: `getBundlesForRoute` returns `[]` for 'auth'/'character'/'error' — no asset wait can block or fail the route to creation/error.
- **Z-order is right**: authority overlay 1950 < appError 3000 < saveGate 4000 < saveGateModal 4100 < curtain 5000 — the save gate is never masked by the authority overlay.
- **`'empty'` vs `'deleted'`** land on the same `requireCharacter` route; `isUnchanged` short-circuits a same-route request so no double prompt; `'deleted'` is near-dead today (CHARACTER_DELETED requires a tombstone nobody writes via API) — the W5-INT-4 loop only opens on that dead-in-practice path.
- **`resetCharacter` error mapping**: `binding()` null → `unavailable/AUTH_EXPIRED`; every `mapError` code → `unavailable`; `NO_CHARACTER` → `absent` → the gate proceeds to delete+reload (correct: row already gone). `'unavailable'` aborts before `deleteSave` with a notify — idempotent retry safe.
- **Settings reset divergence is intentional**: `resetSaveFromSettings` deliberately does not call `resetCharacter`, and its copy honestly says the server save survives.
- **`observeSaveResult`/`flush` ordering** around a concurrent reset is gated by `entryStage !== 'game'` (no in-flight persist can race the gate) and a stale journal entry post-delete lands in `pending` → quarantined on next NO_CHARACTER load.
- **`executeTransition` to 'error'** carries no `behindCurtain` domain work — a combat session left held is released/detached through the failure path; cosmetic nit only (no domain teardown on the error edge), not a defect.

## Deferred Low / Nit (visible, intentionally unfixed)

- `saveIssue` latch + dead-write window during in-flight transitions (folded into W5-INT-2).
- resetNotice sessionStorage flag survives a reload that lands on `backendFatal` instead of auth — stale notice on a later auth mount; cosmetic.
- `'deleted'` reroute keeps authority `'checking'` while the user sits on creation (same as 'empty') — consistent with existing semantics, harmless.
- `SaveIncompatibleScreen.vue:20-23` comment + in-handler comment still say "cloud recheck / soft-deletes" — folded into W5-INT-1 fix scope.

## Verification run

```
export PATH=/home/linuxbrew/.linuxbrew/opt/node@22/bin:$PATH
cd game
npm run type-check                                    # clean
npx vitest run src/services/save/ \
  src/composables/useAppLifecycle.test.ts \
  src/composables/useBootFlow.test.ts \
  tests/architecture/w4corSaveBoundaryMirror.qa.test.ts \
  tests/architecture/saveBoundaryMirrorParity.qa.test.ts \
  src/presentation/GamePresentationCoordinator.test.ts
# 32 files, 788 passed + 1 expected-fail (w4cor it.fails lexical witness)
npx vitest run src/services/save/w5int.repro.test.ts  # 3/3 pass
```

## Suggested wave-5 fix order

1. W5-INT-1 — copy + comments (cheap, user-facing, irreversible).
2. W5-INT-4 — make `create_character`'s premise true or revert the 'deleted' reroute.
3. W5-INT-3 — move `markReady()` after a successful `onResume`, or map resume throws to `enterTerminal('recovery')`.
4. W5-INT-2 — make 'error' requests preempt in-flight transitions (or retry-on-reject inside `fail()`); add the behavioral pin.
5. W5-INT-5 — refresh the stale replica; note it is the *evidence* fix for 2/3.
