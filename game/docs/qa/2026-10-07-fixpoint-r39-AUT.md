# Fixpoint r39 — AUT (adversarial) wave

- Auditor role: AUT — assume every r38 fix is exploitable.
- Audited commit: `56098103` on `codex/hoa-cau-fireball-vfx` (r38 adjudication = code commit `c3f1503a` + report docs).
- Evidence: `src/services/save/auditR39AUT.probe.test.ts` — 5 deterministic probes, all passing (`npx vitest run <file> --pool=threads`).

## Verdict

**FAIL — 2 findings, both Medium.** The r38 fixes themselves hold under attack; the two findings are same-class siblings the wave did not reach: one on the emit site the new strip cannot cover, one on the boundary the latch carry cannot see past.

## Confirmed findings

### r39-AUT-1 — Medium — post-cycle `presentation_session_started` emit admits the verbatim `turn-in-flight` wedge

**Mechanism.** The r38 fix strips a foreign `turn-in-flight` only inside the step-7 latch carry (`beginBattleCycleCommitted` :2191-2205): `reason !== 'user-pause' && !(reason === 'turn-in-flight' && turnToken.getState() === 'IDLE')`. But the carry is reached only for the **in-mint** emit at :2174, which fires for `policy.kind === 'fresh' || 'test'` (:2161). Every `stage`-policy mint — the common real path via `startStage` — and every hidden-trial replacement emit their session in `mintCombatSessionForLaunch` at **:2487**, *after* `beginBattleCycleCommitted` has already run step-7, stopped the old clock, started the fresh one, and re-frozen the carried reasons. A `freezeCombat('turn-in-flight')` planted in that later emit lands verbatim on the fresh clock with no carry downstream to filter it.

**Wedge.** The token is IDLE and stays IDLE: a frozen clock never claims a turn, and `turn-in-flight` is cleared only by the token transition listener (:510-520). Result: permanent combat freeze behind an un-owned reason — the exact class r38 eliminated, re-opened at the sibling emit site.

**Repro (probe A).** Interactive mode, `startAStage`, listener plants `freezeCombat('turn-in-flight')` on `presentation_session_started`. After reveal (`hold → attach → release`) clears `not-revealed`, `getFreezeReasons()` is exactly `['turn-in-flight']`; 600 steps of `clock.advance` change nothing — `introTurnsRemaining` unmoved, token IDLE, clock `frozen`. Control without the plant ticks normally.

**Note — the seam is wider than the emit.** `freezeCombat` accepts any `FreezeReason` union member from any caller, and `freeze()` only refuses on a *stopped* clock. Any `freezeCombat('turn-in-flight')` while a live battle's token is IDLE wedges it the same way (bounded by the next mint's carry strip). The step-7 strip heals at boundaries; a typed/split API (owner-scoped reasons) or an IDLE-token strip inside `freeze()` itself is the durable fix shape — adjudication's call.

### r39-AUT-2 — Medium — terminal/teardown `stop()` erases an armed owned latch before any carry can snapshot it

**Mechanism.** The step-7 carry can only preserve reasons still armed at :2191. `CombatClock.stop()` (:82-91) clears the whole reason set unconditionally, and every terminal/teardown path stops the clock **without** a carry:

- `settleCombatOutcome` :1132 — every non-repeat victory and every defeat.
- `abandonBattle` :2662 — user retreat.
- `discardInFlightBattle` :1785 — stale-cycle teardown.

The repeat path is the exception that proves the hole: `restartTurnBattleCycle` (:1125) runs *before* any `stop()`, so the mint's step-7 does see and carry `authority-pause` there. On every other terminal the latch is erased first and the next mint restarts unlatched — while `useAppLifecycle` (the owner, edge-triggered at :286/:299/:757/:774) still believes the latch holds. `authority-pause` is lifecycle-owned, not battle-scoped like `user-pause`; it is exactly the reason the r35-AUT-2 carry was built to preserve, and it dies silently at the boundary.

**Honest repro (probe B1) — public APIs only.** Stage battle, manual ON, drive to a parked `AWAITING_INPUT` turn. `freezeCombat('authority-pause')` arms mid-wait (authority lost while the user is looking at a choice). The user answers anyway: `submitTurnChoice('basic')` drives `beginTurnPipeline` directly and never consults clock state → resolved hit kills the enemy → `victory` → `settleCombatOutcome` → `stop()` at :1132 → `getFreezeReasons()` is `[]` with no resume ever issued. The next `startBattleWithPlayer` mint restarts `running` with no `authority-pause` — combat ticks under an authority pause the owner still believes is armed. Same silent-divergence shape as r35-AUT-2, at the battle boundary instead of the mint boundary.

**Sibling repro (probe B2).** `abandonBattle()` while `authority-pause` is armed: teardown `stop()` at :2662 clears the latch identically; next mint runs free.

## Rejected / pinned attack candidates

| Surface | Verdict | Mechanism |
|---|---|---|
| F1 strip too aggressive (a): legit non-IDLE token needing carry | **Rejected** | A listener can only make the token non-IDLE at :2191 by driving the *old* clock inside the emit; RESOLVING/AWAITING_INPUT carries are *correct* (live claims still resolve). A driven COMBAT_OVER stops the clock via :1132 first, so the snapshot is empty — nothing carries, no wedge. |
| F1 (b): other foreign reasons carrying verbatim | **Rejected** | Union enumerated — `authority-pause`/`tab-hidden` carries are owner-releasable; `not-revealed` is re-derived by `syncOffScreenFreeze` at :2211; `user-pause` dies at boundary by design. Only `turn-in-flight` wedges, and only via the post-cycle emit (finding AUT-1). |
| F2 FIFO guard: inline-run vs drain; mutation between check and push | **Rejected** | Single-threaded: no mutation window exists between the `length===0` check and `push`. Inline-run at IDLE is correct — the IDLE listener set already fired synchronously inside `setState`. |
| F3 drain try/catch: throwing command mid-batch | **Rejected** | The only production closure writes the flag then nulls the slot; a throw leaves `pendingManualMode` non-null, which the next `dropBoundaryQueue` re-lands — bounded self-heal. Mid-drain enqueues land on the fresh `boundaryQueue` (detached `queued` snapshot) and drain next step — not lost, not re-visited. |
| F4 hoisted splice: arm that must not splice; aliased `timer` after re-arms | **Rejected** | The closed-over `timer` always aliases the handle whose task is executing (each re-arm reassigns it before pushing). Same-epoch stale fires die on the `pendingStepDone[signal] === undefined` check; old-epoch fires die on the generation check — both *before* the splice. No arm re-uses a fired handle. |
| F5 intent-slot hoist: throw between slot write and queue mutation | **Rejected** | The only fallible stretch is the guarded stranded-rescue; on throw the slot stays == `enabled`, queue holds nothing, and the next `dropBoundaryQueue` re-lands it — the flag and slot re-converge. Writers enumerated (:307/:2744/:2759) all consistent. |
| F6 `enemyManager.clear()` ordering / nested-mint sweep | **Rejected** | Clear at :1914 precedes every spawn of the new cycle (initialEnemy :1983; wave enemies lazily). Nested-mint sweep of the outgoing battle's registry is adjudicated-intended; orphaned battles' entity objects are dead refs nobody reads. |
| F7 `stageSnapshot` binding | **Rejected** | Snapshot taken at :151 *before* `publishBattleEnd` :157; `completedStageIds` dedups via `includes()` :175; `recordPerfectClearIfEligible` receives the same snapshot — no post-emit live read of `activeStageForTurnBattle` remains in the reward path. |
| F8 `entryStage` gate | **Rejected** | `entryStage==='game'` on the `failed` card is deliberate (`error.failedRequest.target` pin keeps the Phaser host for retry). The gate's second clause (`clock !== 'stopped'`) discriminates: no reachable state has `entryStage==='game'` + non-stopped clock + non-game mounted surface. `error`-route zombies excluded as designed. |

## Adjudicated-accepted bounds — verified, not re-reported

- Bump-starved curtain during authority-pause — clears via the authority path's own unlatch. Holds.
- ACK drain bounds (r36-AUT-1), verbatim-parked out-of-domain stamps — `getFreezeReasons` is order-of-arrival over a finite union; holds.
- NaN-in-park write-gate — `onFrame` rejects `!Number.isFinite` before accumulating (:136). Holds.
- Boot discard contract; dangling post-discard internals write-guarded. Hold.
- `turnBattleSystem`/`combatRng` mounted-by-design. Holds.
- `boot.enterGame` rejected-route 'entered' — `fail()` retry loop is bounded at 10 attempts. Holds.
- `markReady` throw = injected-fault class. Consistent.
- `'user-pause'` dies-at-boundary semantics — intentional, documented at :2185-2190.
- Nested mint inside pre-commit emit orphaned wholesale — INTENDED; the r38 fix targeted only its enemy-registry leak.

## Scope notes

- No production code touched. Probe uses only public APIs (`freezeCombat`, `submitTurnChoice`, `abandonBattle`, `startBattleWithPlayer`, event bus) plus the shared `startAStage`/`ManualClockSource` harness.
- Both Mediums share one root seam — the clock's freeze-reason set is a bag any caller can add foreign members to and any `stop()` atomically destroys — but they are different defects at different sites and report separately.
