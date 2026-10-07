# Fixpoint r38 — INT (integration coherence) audit

- Commit under audit: `de4c4fb4` ("qa fixpoint r37: auditor reports" — the full r37 adjudication: code `9881bc0b` + report docs)
- Branch audited: `codex/hoa-cau-fireball-vfx` @ `de4c4fb4` (exact checkout, worktree `.agent-worktrees/audit-r38-int`)
- Probe: `src/services/save/auditR38INT.probe.test.ts` — **15/15 green** (`npx vitest run src/services/save/auditR38INT.probe.test.ts --pool=threads`); ESLint clean; `npm run type-check` clean.
- Auditor: r38 INT, blind (no coordinator guidance beyond the prompt seams)
- Scope: the six r37 fixes (`GameManagerTurnBattleOps` F1 live-handles-only + F2 same-generation settled-check, F3 emit-after-teardown, F4 IDLE-token `'turn-in-flight'` strip, F5 `pendingManualMode` intent slot, F6 `App.vue` battle-presence gate) + r37-COR-5 bounds; consumer-side agreement (`battle_end` subscribers, `useCombatPause`, `attachTurnTokenToClock`, `drainPendingPlayback`/`settleStep`).

## Verdict

**PASS WITH EVIDENCE** — 0 Critical / 0 High / 0 Medium / 1 Low / 2 Nit.

All six r37 mechanisms verified coherent against their actual code and consumers, with deterministic probes. The single Low is a latent sibling seam on a *different* emit site of the same event — zero current trigger (every `battle_end` subscriber consumes the payload only), recorded for the next wave rather than blocking this one.

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 0 |
| Medium   | 0 |
| Low      | 1 |
| Nit      | 2 |

---

## Findings

### r38-INT-L1 (Low) — `beginBattleCycle`'s PRE-commit `battle_end` emit is not re-mint-safe for fresh/test incoming cycles

**Location:** `GameManagerTurnBattleOps.ts:1843-1868` — the pre-commit terminal block runs `bankPassiveCarry → previousBattle.state='defeat' → rewardOps.emitAbandonEnd()` at :1854, *before* `beginBattleCycleCommitted` at :1872.

**Mechanism:** r37-F3 moved `abandonBattle`'s emit *after* its teardown specifically so a `battle_end` listener minting a new battle mid-emit survives (:2632 comment). The same event is also published from `beginBattleCycle`'s pre-commit block — but there the emit runs *before* the incoming cycle's committed mint, and nothing re-reads or guards `this.turnBattle` between emit and commit. A listener that synchronously starts a battle inside this emit:

- **outer = `'stage'` policy:** nested `startStage` is refused — the incoming launch already holds the stage lease (`stageWaves.start` ran before `beginBattleCycle`; refusal is side-effect-free per the :1293 RNG comment). Listener's mint fails closed; outer mint proceeds. Safe-by-accident.
- **outer = `'fresh'`/`'test'` policy** (public entries: `startBattle`, `startBattleWithPlayer`): the nested mint commits fully (its own `clearCycleEntryState` + mint), then the outer's post-emit `stopRepeat()` (:1867) releases any stage lease the nested start acquired, and the outer committed mint overwrites `this.turnBattle` — the nested battle is silently orphaned (alive, unreachable, never terminalized).

**Probe B3** demonstrates deterministically: listener calls `startBattleWithPlayer` inside the emit → nested mint completes → outer mint wins → `getTurnBattle()` is the outer battle; the nested object remains `'intro'`-live but unreferenced (no zombie clock — the outer commit stops/starts its own).

**Reachability:** zero today — all four `battle_end` subscribers (`CombatScene.onBattleEnd`, `combatAudioBinding`, `PhaserCanvas` clearPositionsSnapshot, `ThanhVanBackdrop` variant) consume the payload only; none calls a battle-start inside the handler. This is a latent contract asymmetry: the same event is re-mint-safe at the abandon emit site and orphaned/refused at the pre-commit site. Severity Low: no current trigger, bounded blast radius (the outer mint always wins cleanly; a nested *stage* mint additionally loses its lease via the outer `stopRepeat`).

**Suggested direction (next wave, not a fix authorization):** either document that `battle_end` handlers must not synchronously start battles (queue their mint post-emit), or hoist the pre-commit emit after `beginBattleCycleCommitted` — which also unifies the two emit sites' ordering contract.

### r38-INT-N1 (Nit) — dead/terminal arm still parks its fired handle

**Location:** `GameManagerTurnBattleOps.ts:897-906` — the `awaitStep` fallback's dead-battle arm (`liveBattle === null || victory || defeat || clock stopped`) writes `pendingStepDone[signal] = undefined` and returns without splicing the just-fired handle out of `pendingStepTimers`.

Every other arm now retires its handle (F1); this arm leaves one dead entry per terminal-fired fallback, swept wholesale by the next `clearPendingSteps`. Bounded (≤1 per dead step, no re-fire since the entry is consumed) — inconsistent with the stated "live handles only, flat across permanent wedges" invariant but harmless. Probe A2 asserts the residue + the sweep.

### r38-INT-N2 (Nit) — stale gate comment in `App.vue`

`App.vue:485-487` still reads "Gated on `getCombatClockState() !== 'stopped'`" while the code below now also requires `getTurnBattle() !== null`. The adjacent r37-AUT-2 comment (:489-492) documents the battle arm, so the stale sentence is cosmetic only.

---

## Attack results per mandated seam

### (1) Live-handles-only timer splices vs same-generation settled-check — VERIFIED COHERENT

**Claim attacked:** the `=== undefined` early-return (:877) could kill a *live* fallback.

Enumeration of every `pendingStepDone[signal]` writer vs every path that still expects a fallback to fire:

- `settleStep` (:987-991) consumes the entry then invokes it — the real settle channel (ACK or drain-driven `onReady`/`onImpact`/`onComplete` sink). After this, the step's fallback *should* die → bail is correct.
- The dead-battle arm (:904) and live-drive arm (:963) self-consume → the step is finished either way → any later same-closure fire correctly bails.
- `clearPendingSteps` (:993+) wipes the map and bumps the epoch — cross-generation callbacks die earlier at the epoch check.
- **Signal-keyed aliasing check:** could a stale callback for signal S observe a *newer* same-generation entry under the same key? No — the epoch bumps per turn (`beginTurnPipeline` → `clearPendingSteps` at :801-804), so within one generation each signal key has exactly one `awaitStep` owner. A consumed entry can only mean *its own* step settled. The check is exact, not heuristic.
- **Cap-drain ordering:** the deferral arm splices its fired handle then `drainPendingPlayback()` runs while the settle entry stays armed by design — the drain's completion sink routes through `settleStep`, consuming the entry. A stale callback dequeued before the drain then hits `=== undefined` and bails (probe A1): no re-arm (`vi.getTimerCount()` flat), no map residue, no re-drive, token stays `IDLE`. Both orderings verified: drain-consumed-then-fallback (bails) and fallback-first (defers; drain runs on the next fire).

**Result:** F1+F2 are internally consistent and consistent with `drainPendingPlayback`/`settleStep`. One bounded residue arm recorded as N1.

### (2) Emit-after-teardown vs auto-repeat restart + once-guard — VERIFIED COHERENT

- **`abandonBattle` ordering** (:2585-2640): session end → `resetPendingState` → `state='defeat'` → `stopRepeat` → `bankPassiveCarry` → `enemyManager.clear` → `clearCycleEntryState` → `combatClock.stop()` → `emitAbandonEnd()`. Mid-emit the world is fully torn down (probe B1 asserts `clock==='stopped'` + `getTurnBattle()===` the defeat-marked outgoing battle *inside* the listener), and a synchronous `startAStage` re-mint **survives**: post-abandon `getTurnBattle()` is the nested mint at `'intro'` on a non-stopped clock. Pre-fix this mint was zombied; the fix is real.
- **Once-guard interplay:** `emitAbandonEnd` stamps `battleEndEmitted` *before* publishing (:65-72); the nested mint's `resetRewardState` clears the flag for its own cycle → the nested battle's later abandon emits exactly once (probe B2: `['defeat','defeat']`, one per cycle). An `abandonBattle` re-entered inside a 'victory' emit is suppressed by the same guard — bounded.
- **Both-flows check (`settleCombatOutcome` :1078-1119):** `grantBattleRewardIfNeeded` contains the terminal emit; the restart arm re-reads `this.turnBattle` at :1082 *after* it. A re-mint inside the victory emit leaves a `'fighting'`/`'intro'` battle → the `state!=='victory'&&!=='defeat'` guard returns early → the nested mint's own running clock survives (no zombie, no double-mint, outer repeat intent correctly dropped to the interloper). The victory emit is already re-mint-safe by the re-read guard — *this* emit site does not share L1's hazard.
- **Direction (b) — listener mint landing before expected teardown:** cannot occur on the abandon path (emit is last). On the pre-commit path it does — that is exactly L1.

### (3) 'turn-in-flight' strip vs `attachTurnTokenToClock` — VERIFIED COHERENT

- Token states are `{IDLE, CLAIMED, AWAITING_INPUT, RESOLVING, COMBAT_OVER}`; `CLAIMED` is transient inside `claim()` (resolves to AWAITING_INPUT/RESOLVING synchronously — unobservable at a swap boundary), and there is **no RESOLVED-but-not-IDLE state**. `COMBAT_OVER`+running-clock is transient inside the synchronous `resolve → settle` chain (settle either stops the clock or restarts the cycle, and `turnToken.reset()` inside `clearCycleEntryState` fires `IDLE` before any observer runs). So at any observable swap boundary, non-IDLE means mid-flight.
- A *legitimate* `'turn-in-flight'` on an IDLE token cannot exist: the listener resumes synchronously on every →IDLE transition (:513-519), and `freezeCombat` is the only other writer of that reason — foreign by definition. The strip (:443-450) removes exactly the never-unlatchable case.
- Carried-legit case: `attachTurnTokenToClock` re-binds *before* re-freezing (:439 before :441-452) and `detachTokenListener` at :511 prevents listener accumulation across swaps. The carried latch is released by the rebound listener's next →IDLE on the new clock (probe C2: frozen post-swap → drain → `[]`/running).
- Post-strip lifecycle continuity: the next claim re-freezes `'turn-in-flight'` on the new clock through the rebound listener (probe C1 tail).
- **Sibling check:** `beginBattleCycleCommitted` step 7 (:2167-2174) filters only `'user-pause'` and not `'turn-in-flight'` — but unreachable-by-construction: `turnToken.reset()` inside step-1 `clearCycleEntryState` fires →IDLE synchronously, so the reason is always absent from the snapshot (r37 probe B1 empirically confirms: post-restart reasons exclude it). Not a finding.
- `'not-revealed'` needs no symmetric strip: `syncOffScreenFreeze` re-derives it deterministically at the end of the same swap (:453).

### (4) `pendingManualMode` vs every reset path — VERIFIED COHERENT

- **Queue census (complete):** `boundaryQueue` has exactly three mutation sites — `enqueueAtTurnBoundary` (:667-679, runs immediately when `!turnBattle || token IDLE`), `drainBoundaryQueueIfIdle` (:690-705, swap-out + run), `dropBoundaryQueue` (:305-311, re-lands slot + clears). Both queue-clear paths are `dropBoundaryQueue` call sites — `onTurnDrained` COMBAT_OVER (:1068) and `clearCycleEntryState` (:1689). No teardown can clear the queue while skipping the slot.
- **Flag census:** `battleManualMode` is session-scoped by design — `resetPendingState` never touches it; every write is `runtime.setBattleManualMode(...)` from exactly the three places (the `setBattleManualMode` immediate flush, the queued closure, the drop). No flag-clear exists that skips the slot.
- **Drop path, combat-over:** a toggle queued in the *final* turn dies undrained with the queue — `dropBoundaryQueue` re-lands the slot's intent on the flag (probe D1: `false→true`, slot null, queue empty post-victory).
- **Double-toggle last-wins:** `setBattleManualMode` has *no* `enabled===flag` early-return — every call overwrites the slot and enqueues, so the last intent always wins on both drop orders (probe D2, both directions).
- **Drain path:** mid-battle toggle → drains at the next `fighting`-branch boundary → the closure itself lands the flag and nulls the slot (probe D3).
- **Abandon path:** `clearCycleEntryState`'s drop re-lands the intent, and the next battle's claim-time read (`tickPacing` → `isBattleManualMode`) sees it (probe D4).
- **Immediate path:** IDLE-boundary toggle runs the closure synchronously — flag lands at once, slot never stays armed (probe D5).
- **Structural note (not a finding):** `drainBoundaryQueueIfIdle` swaps the array out *before* running — a throwing earlier command would strand a later manual-mode closure with the slot still armed; unreachable today (the sole enqueued closures are non-throwing boolean writes), and even then the intent re-lands at the next drop.

### (5) Battle-presence gate vs overlay/boot consumers — VERIFIED SAFE (gate is defense-in-depth)

- `getTurnBattle()` is null only at init, post-`discardInFlightBattle` (always accompanied by `combatClock.stop()`), and transiently inside synchronous teardown (unobservable). No async mid-mint null window exists — `beginBattleCycleCommitted` is fully synchronous and assigns `turnBattle` at :1962 before its step-7 `start()`.
- `clock !== 'stopped' && battle === null` is **unreachable through public flows**: `freeze`/`resume` no-op on a stopped clock (CombatClock early-return), and the only `start()` sites are inside a mint (battle already present) or `setCombatClockSource`'s `wasRunning` carry (which requires a previously running clock — circular, needs a battle). Probe E1 asserts discard lands stopped+null and post-discard `freezeCombat('authority-pause'|'tab-hidden')` cannot re-latch.
- **Boot-failed-admission bound (prompt question):** failure *after* `discardStaleBattle` lands stopped+null (gate false — curtain cannot arm); failure *before* the discard keeps frozen+**battle-present** — the gate reads true and `isPaused` can still arm, but the curtain (layer 900) sits below `authority` (1950) and `appError` (3000), so it is covered and inert — identical to pre-fix behavior; F6 only narrows the battle-less shape. No regression.
- Dead-battle case: post-`abandonBattle` the defeat object remains but the clock is stopped → gate false under both old and new forms — consistent (a dead battle should not arm a Continue curtain).
- The 'hidden'-arm path on a live frozen battle still works end-to-end: arm → latch → `continueBattle` unlatches (probe E2).

### (6) r37-COR-5 bound — VERIFIED BOUNDED

- An armed `isPaused` surviving its cleared latch is reachable (abandon: `stop()` clears `'tab-hidden'`, the flag is composable-side residue — the App `stateVersion` watch owns the clear on the next non-starved bump; bump-starved only while *no* state change occurs).
- The bound question — *can the residue outlive every unlatch channel*: no. `continueBattle` is a live self-heal on a dead clock (`resumeCombat` on `'stopped'` is a no-op, flag clears — probe F). Hidden transitions post-teardown cannot re-arm (the gate fails: stopped). The residue is cosmetic and self-terminating — the accepted residual's bounds hold.

## Prior-wave residuals re-checked

- r36-AUT-1 finish-the-swing bounds: unchanged this wave (ACK drain still gates on `isSessionBlocking` + token; r37 probes still pin it).
- Boot-path discard contract, mounted-by-design internals, rejected-route 'entered': unchanged; no new interactions introduced by the r37 batch.

## Files

- `game/docs/qa/2026-10-07-fixpoint-r38-INT.md` (this report)
- `game/src/services/save/auditR38INT.probe.test.ts` (15 probes, all green)
