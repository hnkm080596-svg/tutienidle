# Fixpoint r39 — INT (integration coherence) audit

- Commit under audit: `56098103` (the full r38 adjudication: code `c3f1503a` + report docs)
- Branch audited: `codex/hoa-cau-fireball-vfx` @ `56098103` (exact checkout, worktree `.agent-worktrees/audit-r39-int`)
- Probe: `src/services/save/auditR39INT.probe.test.ts` — **7 green + 5 expected-fail (`it.fails`) assert-bug pins** (`npx vitest run src/services/save/auditR39INT.probe.test.ts --pool=threads`). Each `it.fails` was verified to fail on its intended assertion by running the same bodies as plain `it` — all five land exactly on the claimed defect.
- Auditor: r39 INT, blind (no coordinator guidance beyond the prompt seams)
- Scope: the eight r38 fixes (step-7 IDLE-token strip, FIFO guard, drain try/catch, hoisted splice, intent-slot hoist, `enemyManager.clear` at committed step-1, `stageSnapshot` in `grantTurnBattleRewards`, `entryStage` gate) + the cross-piece coherence: third carry paths, the three-state intent triple, splice/drain ordering, registry consumers, post-emit live reads, boot/error/re-auth admission surfaces.

## Verdict

**PASS WITH EVIDENCE** — 0 Critical / 0 High / 0 Medium / 4 Low / 1 Nit.

Every r38 mechanism verified coherent against actual code and consumers with deterministic probes. All five findings are the same *latent* class the batch already adjudicated as acceptable risk (no production listener mints inside a synchronous combat emit, and no production caller re-enters `setBattleManualMode` mid-rescue); each has a working repro pinned by an `it.fails` probe. This wave is NOT a fixpoint signal — the Lows are actionable.

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 0 |
| Medium   | 0 |
| Low      | 4 |
| Nit      | 1 |

---

## Findings

### r39-INT-1 (Low) — F7's misattribution class survives in the same function's other emit windows and its post-emit live reads

**Location:** `GameManagerBattleRewardOps.ts` `grantTurnBattleRewards` (:81-188) + `recordPerfectClearIfEligible` (:200-239).

**Mechanism:** the fix snapshot `stageSnapshot = getActiveStage()` at :151 hardens only the `publishBattleEnd` emit at :157. Three other live reads still execute *after* the emit or *after* the per-kill emit loop, and all see the world a synchronous listener mint leaves behind:

- `:164` `settleTechniqueMastery` — reads+zeros `pendingTechniqueMastery` on the shared loot session. A `battle_end` listener minting `fresh`/`stage`/`test` inside :157 runs `beginBattle()` (:1933) which zeroes the buffer → the ended battle's accrued mastery is silently dropped. Probe E2 (`it.fails`): buffer seeded to 7, listener mints `fresh`, `gainMastery` never called.
- `:206` `getPlayerData()` — inside `recordPerfectClearIfEligible`, runs post-emit. A `'test'` mint rebinds `playerDataForTurnBattle` to `null` (:2044-2046 writes `player` only when `request.player` exists) → `!player` early-return drops the perfect clear, while the completion write at :172-186 still lands because its `playerData` was captured pre-emit at :131. Probe E1 (`it.fails`): `completedStageIds` contains `pc_stage`, `perfectClearStageIds` does not — the function's own two writes disagree.
- `:226` `getStartedAtMs()` — same post-emit read; a nested mint either nulls the stamp (:1949) or re-stamps it (:2477), producing `clearSeconds ~= 0` and writing a `perfectClearSeconds[stage.id]` entry the `includes()` once-guard at :212 then protects from every honest future record (B4 first-write-wins). Same window, same class.
- **Pre-terminal window:** `processDefeatedEnemies` at :107 emits `reward_particle` per paid kill (BattleLootSystem :375/:653/:694) *before* the terminal block. A listener minting there rebinding `playerDataForTurnBattle`/`activeStageForTurnBattle` mid-function means even the :131 read and the :151 snapshot see the nested world — `bankPassiveCarry` (:133), `completedStageIds`/`issueCompanionGifts` (:172-186), `stageSnapshot` all misattribute to the nested cycle. The snapshot fix hardened the emit boundary only; the kill loop is an earlier unhardened emit boundary in the same function.

**Reachability:** no `battle_end` or `reward_particle` subscriber mints today — latent, identical class bound to the adjudicated family. Not worse than r38-AUT-3 in severity but the fix's stated invariant ("post-emit reads must credit the stage THIS battle finished") is only 1-of-4 enforced.

**Suggested direction:** hoist the remaining live reads to the same pre-emit capture line (:131-151) — player, startedAtMs, and consume `pendingTechniqueMastery` before `publishBattleEnd`; or document the emit windows as mint-free (queue mints post-return).

### r39-INT-2 (Low) — committed `enemyManager.clear()` mid-`processDefeatedEnemies` cancels the rest of the kill batch unpaid

**Location:** `GameManagerTurnBattleOps.ts:1914` vs `BattleLootSystem.ts:247-508`.

**Mechanism:** `processDefeatedEnemies` iterates `enemies`; per kill it sets `rewardGranted = true` (:257) *then* reads `this.deps.enemySystem.get(id)` at :278 and skips the entire drop block when undefined. The per-kill emits (`entity_vitals_changed` via `applyHealing` :262-269 — before the get; `reward_particle` :375/:653/:694 — after) are synchronous reentrancy windows: a listener minting any committed cycle runs `enemyManager.clear()` at :1914 → every remaining kill's `get` returns undefined → consumed (`rewardGranted` set) without payment. Deny-direction, bounded to the batch remainder; the outgoing battle's own despawn at :498 no-ops the same way. Probe D2 (`it.fails`): two dead enemies, one `reward_particle` listener mints on the first kill → `materialBag` holds 1 signature drop instead of 2.

**Reachability:** latent (same no-minting-listener bound). Note the heal emit at :262 precedes the `get` — a mint there denies the *current* kill too.

**Suggested direction:** resolve once per batch before the loop (pass resolved `enemy` alongside the entity), or capture `pendingEnemies` + entity handles before any emit-capable work; alternatively `clear()` is only needed to sweep *stale* entries — despawn-by-id for the current battle's members is already the lifecycle — a scoped `clear` that skips entries the in-flight batch still needs is equivalent.

### r39-INT-3 (Low) — `abandonBattle`/`discardInFlightBattle` `stop()` erases owner-held latches; the pause owner is never told

**Location:** `GameManagerTurnBattleOps.ts:2662` (abandon), :1785 (discard) → `CombatClock.stop()` clears the reason set.

**Mechanism:** the step-7 latch replay and `setCombatClockSource` are the only *carry* paths (verified — no third verbatim snapshot exists). `stop()` is the *erase* path, and it cannot distinguish owned from unowned reasons: an `'authority-pause'`/`'tab-hidden'` planted by its owner (`pauseSimulation`, `useCombatPause`) dies at abandon, and the next mint's step-7 snapshot is empty → the new battle runs unlatched while `simPaused`/the composable flag still believe a freeze is held. The owner-side `resumeSimulation` then no-ops (nothing to remove), so the seam self-heals at the resume but the *window* between restart and resume ran unpaused. Probe F1 (`it.fails`): freeze `'authority-pause'` → `abandonBattle()` → `startStage` → new clock `'running'` with reasons `[ 'not-revealed' ]` — the latch is gone.

**Reachability:** production authority pauses mount `authorityOverlayActive` (App.vue:818), which inerts `GameRoot` + the pause overlay + all content — the user cannot reach abandon/restart while they hold. The seam is live for (a) the update-install flush pause (`useUpdates.ts:146` `pauseAdmission` → `pauseSimulation` — no authority overlay, narrow window ≈ one save write), (b) any programmatic abandon under an owned freeze (devtools/restore-path callers). Bounded both ways; the r37-COR-5 curtain sibling covers the `isPaused` residue side (stateVersion watcher :524 clears it). This is the *inverse* polarity (surface outlives latch — the adjudicated item — vs latch dies while surface survives).

**Suggested direction:** treat owner-held reasons as lifecycle-latched across `stop()` too — re-carry them at the next mint, or signal the owners (stateVersion bump is already emitted — `useCombatPause`/`useAppLifecycle` could observe the latch loss and drop `isPaused`/`simPaused` symmetrically). At minimum document that `abandonBattle` releases admin latches.

### r39-INT-4 (Low) — reentrant `setBattleManualMode` inside the stranded-rescue emit overtakes the outer call's queued closure

**Location:** `GameManagerTurnBattleOps.ts:2714-2762` (slot write :2722 → rescue :2727-2745 → enqueue :2758).

**Mechanism:** outer `setBattleManualMode(false)` on a parked `AWAITING_INPUT` turn runs the rescue synchronously: `submitChoice` → `RESOLVING` → flag flush → `beginTurnPipeline(stranded,'ready')` → `notifyReadyActor` emits `turn_ready` mid-call. A listener calling `setBattleManualMode(true)` inside that emit writes the slot and enqueues `closure_true` *before* the outer call enqueues `closure_false` → the queue drains `[true, false]` — enqueue order is not intent order — and the session flag ends `false` while the last intent was `true`. Probe F2 (`it.fails`): nested ran (the `turn_ready` emit inside the rescue is a real reentrancy window — pinned), final `isBattleManualMode()` is `false`.

**Reachability:** zero today — `setBattleManualMode` callers are UI clicks (cannot interleave inside a synchronous call) and the drop/drain internals; no `turn_ready` subscriber toggles the mode. Latent ordering defect in the intent triple the FIFO guard was meant to protect: the guard covers the IDLE-window overtake, not the rescue-window reentrancy.

**Suggested direction:** enqueue before the rescue (move :2758 above :2727 — slot already records intent), or make the rescue path skip its own enqueue when the slot was overwritten mid-rescue (`pendingManualMode !== enabled` at :2758 → the nested call already owns the queue position).

### r39-INT-5 (Nit, pre-existing) — `turnBattleStartedAtMs` is never re-stamped on `'repeat'` mints

**Location:** writers at `GameManagerTurnBattleOps.ts:1790` (discard), :1949 (non-preserve reset), :2477 (`mintCombatSessionForLaunch` — `startStage`/`launchHiddenBattle` only). `restartTurnBattleCycle` → `beginBattleCycle('repeat')` writes none.

`recordPerfectClearIfEligible` :226-227 then measures clear time from the *original* stage launch — a perfect clear on auto-repeat cycle N records inflated seconds (whole session elapsed, not the winning cycle). Pre-existing, unrelated to r38; adjacent to the `getStartedAtMs` surface F7 touched. No test pin added (value-path, not coherence); recorded here.

---

## Attack results per mandated seam

### (1) Step-7 IDLE-token strip vs the other latch-carry arms — VERIFIED COHERENT, no third carry path exists

- **Carry-site census (complete):** verbatim reason-carry happens at exactly two sites — `setCombatClockSource` :433-451 and `beginBattleCycleCommitted` step-7 :2191-2210. Both apply the same `token IDLE` strip now. Every other `combatClock` touchpoint either is a reason owner (`turn-in-flight` :515-517, `'not-revealed'` :529-531) or a bare `stop()` erase (:1132 combat-over, :1785 discard, :2662 abandon — see INT-3 for the owner's-view consequence).
- **Token is provably IDLE at :2204:** `clearCycleEntryState` at step-1 calls `turnToken.reset()` → synchronous →IDLE transition (listener clears any legit `'turn-in-flight'` before the read). Between the reset and the read there is no claim path — `stepTurnBattle` is the only claimer and the clock is `stopped` until :2207. The strip's `token IDLE` guard is therefore vacuous-but-correct: every `'turn-in-flight'` in that snapshot is foreign by construction, and no legit carry can be eaten. Verified empirically: probe A1 (non-IDLE carry preserved across source swap, then released on resolution), probe A2 (`presentation_session_started` plant stripped at step-7).
- **`'combat-ready'` / future reasons:** the `FreezeReason` union is closed (5 literals); every `freezeCombat`/`combatClock.freeze` call site passes a literal from the set — no other plantable reason exists today. A foreign plant of `'turn-in-flight'` on a *live* clock outside any mint window is still an unrecoverable wedge (only the token listener unlatches it, and a frozen token never transitions) — that is the public-surface plant hazard, identical pre- and post-r38, not a regression of this batch.
- **`syncOffScreenFreeze` re-derivation** at :2211 correctly re-arms `'not-revealed'` post-mint (probe A2 observes exactly that reason surviving).

### (2) FIFO guard vs drained closure vs `pendingManualMode` — VERIFIED for today's producer set

- **Mutation census:** `boundaryQueue` — push only at `enqueueAtTurnBoundary` :684; cleared at `dropBoundaryQueue` :310 and the drain's swap-out :706. `pendingManualMode` — written at :2722 (top-of-method last-intent), consumed+nulled in the queued closure :2760, consumed+nulled in the drop :306-309. `battleManualMode` flag — written by `runtime.setBattleManualMode` at the immediate flush :2744, the queued closure, and the drop re-land. Pairwise invariants hold on every path probed (queue empty ∧ slot null ∧ flag==last intent after drain; after drop; after immediate run).
- **Double-toggle mid-turn** queues both closures and drains FIFO — last intent lands (probe B1). **Queued-then-terminal** re-lands the slot on the flag via `dropBoundaryQueue` (probe B2 — covers both `onTurnDrained` COMBAT_OVER and `clearCycleEntryState` mint teardown).
- **Inline arm vs mid-transition IDLE:** token transitions are synchronous between IDLE and AWAITING_INPUT/RESOLVING; there is no half-resolved IDLE observable at the boundary — `IDLE` at the length check is a stable state, so the inline run is exact.
- **Between-check-and-push mutation:** impossible — the whole `enqueueAtTurnBoundary` body is synchronous.

### (3) Drain try/catch vs slot cleanup — VERIFIED

- The drain **empties the queue into `queued` before iterating** (:705-706) — a throwing command cannot be double-run or re-drained, and the catch cannot race the splice. A command throwing *before* its flag write leaves the slot armed — the next `dropBoundaryQueue` re-lands it (documented design). For the sole queued producer (the manual-mode closure) there is no throw point: it is two assignments. `console.warn` as the only evidence is a design choice — bounded, self-healing; not a defect.
- **Residual (not a finding):** a throwing queued command leaves *later* same-batch commands running on their (possibly dead) battle — pre-existing drain semantics, unchanged by F3.

### (4) Hoisted fired-handle splice vs every arm — VERIFIED

- **Arm census:** all five arms (epoch bail, settled bail, dead/terminal, isBlocking-deferral, cap-drain, live drive) are correct with the splice at :899-902 — the splice removes the just-fired handle; re-arms push the new handle after. No arm needs the fired entry alive.
- **`pendingStepTimers` readers:** complete census — only `clearPendingSteps` iterates it (clearTimeout) and the splice `indexOf`s it. No positional indexing exists anywhere.
- **Same-closure second fire** (the prompt's queued-stale case): the `=== undefined` settled check at :891 precedes the splice — a stale refire returns before touching the array. Probe C proves it: after the first fire drives the step and the pipeline arms the next handle, the stale refire leaves `pendingStepTimers` untouched (`toContain` the newly armed handle).
- **`let timer` reassignment:** the splice reads `timer` at splice-time (the just-fired handle); the deferral reassignments happen after — identity is correct by construction.

### (5) Intent-slot hoist vs `pendingManualMode` readers — VERIFIED

- **Reader census:** `dropBoundaryQueue` :306 and the queued closure :2760 are the only readers. Writing the slot before the stranded-rescue is required (the rescue can reach `COMBAT_OVER` → `onTurnDrained` → `dropBoundaryQueue` reads it).
- **Throw between slot write and queue mutation:** the only mid-call work is the rescue (`beginTurnPipeline` internals); a throw there leaves slot armed against a possibly-dropped queue — the next drop re-lands it. Bounded.
- **Non-stranded calls:** the queued closure consumes the slot (`=== enabled` compare) or a drop re-lands it — both verified (probes B1/B2).

### (6) `enemyManager.clear()` vs registry consumers — VERIFIED + one sibling (INT-2)

- **Ordering:** the clear at :1914 runs before every spawn of the new cycle (bootstrap :1983, wave factory :2237, auto-farm :416). Bootstrap despawn at :2000 is registry-backed and still works (spawn→despawn same-cycle). Probe D1: outgoing ids + a stray spawn are gone post-mint; the new cycle's spawn registers.
- **Consumer census:** the only live reader is `BattleLootSystem` :278 (`enemySystem.get`); writers are the spawn sites + despawns (:2000, :2596 trial release, :498 victory cleanup). The turn engine never reads the registry mid-tick — `TurnBattleSystem` works on participant objects, `enemyManager.getAll()` has zero callers. The trial-enemy release inside `clearCycleEntryState` (:1710) runs *before* the clear — ordering consistent.
- **Pre-commit emit case (adjudicated-intended):** verified — a nested mint inside `emitAbandonEnd` (:1868) is orphaned wholesale by design; its registry entries are the leak the clear sweeps.
- **Sibling found:** INT-2 — the clear is safe against the *mint* path but unsafe against an in-flight *consumer* of the registry (the kill batch's own emits). One line of the consumer's loop (`:278 get`) is enough to deny the batch remainder.

### (7) `stageSnapshot` vs `getActiveStage` contract — PARTIALLY VERIFIED (INT-1)

- The snapshot at :151 is the *right* stage for the :157 emit window (captured before `publishBattleEnd`; the write at :170-186 binds it).
- **But:** the contract "post-emit reads credit the ending battle" is enforced for `stage` only. `playerData` (:206), `startedAtMs` (:226) and the loot buffer (:164) all read live post-emit — and the kill-loop emits at :107 expose even the pre-emit captures (:131/:151) to a mid-batch mint. Same defect class as the fixed finding — the fix is incomplete for its own invariant.

### (8) `entryStage` gate vs boot/error/re-auth — VERIFIED

- **`entryStage` writers:** `bootFlow.stage` derives solely from `routeAdapter` — `'game'` iff `activeRoute` or the curtain-closed `pendingGameRoute`/failed-request target ∈ `{home, combat, tribulation}` — tribulation battles covered. `bootFlow.fail()` retries `coordinator.request({target:'error'})` → stage `'error'`. A kept-battle zombie on the error surface lacks the `'game'` admission — the gate's claim holds.
- **Successful boot ordering:** `markReady` (:745) → `clock.start()` (:759, world clock) → `boot.enterGame()` (:772) → route `'home'` → stage `'game'` — admission only after authority ready. During the mint/boundary windows the combat clock may be `stopped` while `'game'` — gate false, correct (no live combat to curtain).
- **Reverse case:** no route runs combat outside `GAME_ROUTES`; re-auth/rejected-restore paths land `'error'` with the clock frozen — the curtain cannot arm there (composable early-returns on `isCombatActive` false).
- **Bounded edge (not a finding):** a *failed request to a game route* promotes `entryStage` to `'game'` (the failed-target keeps the host mounted deliberately for retry) — combined with a frozen zombie clock this could still arm the curtain on hidden-tab; defensible since the mount is intentional, and the reconcile watcher (:524) clears any residue on the next stateVersion bump.

### (9) Adjudicated-accepted items — bounds re-verified

- r37-COR-5 bump-starved curtain: the App.vue stateVersion watcher (:524-528) now owns the stale-curtain clear on the next bump — bound tightened since r38.
- finish-the-swing ACK drain: unchanged surface; `drainPendingPlayback`/`settleStep` compose with the hoisted splice (probe C).
- verbatim-parked stamps / NaN write-gate / boot-path discard contract / dangling post-discard internals / mounted-by-design systems / boot.enterGame rejected-route / markReady throw class / `'user-pause'` dies-at-boundary / pre-commit emit structural pinning: no new interactions from the r38 batch on any of these; bounds hold.
- The `'repeat'`-policy mint has **no** emit inside the committed block (:2161 guards `fresh`/`test` only) — no mid-mint listener window exists there, so no foreign `'turn-in-flight'` can ever be planted in a repeat mint's step-7 snapshot; the strip is vacuous-but-correct on that path.

## Prior-wave residuals re-checked

- r38-INT-L1 (pre-commit emit nested-mint orphan): still INTENDED per adjudication; the `enemyManager.clear` sweep now covers its registry leak — bounds verified.
- The drain-snapshot semantics (commands run on a snapshot while the live queue empties first) unchanged; the throwing-command residue is documented above.

## Files

- `game/docs/qa/2026-10-07-fixpoint-r39-INT.md` (this report)
- `game/src/services/save/auditR39INT.probe.test.ts` (12 probes: 7 green verifications + 5 `it.fails` assert-bug pins)
