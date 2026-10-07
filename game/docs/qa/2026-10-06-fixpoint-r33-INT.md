# Fixpoint audit r33 — INT (integration coherence)

Auditor: r33-INT worker (Devin session). Base: `codex/hoa-cau-fireball-vfx`
@ `a014b7fb` (the full r32 adjudication). Role: do the r32-corrected pieces
still agree with each other and their consumers — the three-way
drop/park/clamp policy split vs callers and UI, the `mintedSpanMs` headroom
denominator vs callers that compute `cycleMs` from a different level than
`siteLevel`, the seeded-head re-stamp skip vs deadline-mode successor
ordering, `expiresCeiling`'s `Date.now()` vs the validator's
`lastSavedAt + dur + 7d` bound across write lag, `bootGame`'s eager
`resumeCombat('authority-pause')` vs the `entryStage`-gated pause/resume
pair and the coded-refuse ordering, and `tickTimedEffects` vs the
clamped/coerced stamps.

Worktree: `.agent-worktrees/audit-r33-int` @ `a014b7fb`. Read-only on
production code; every claim below carries an EXECUTED deterministic repro
in `src/services/save/auditR33Int.probe.test.ts` (15 tests, all passing —
`npx vitest run <file> --pool=threads`, `@vitest-environment node`,
`Date.now` mocked). Report branch: `devin/audit-r33-INT-a014b7fb`.

Verification executed:
- `npx vitest run src/services/save/auditR33Int.probe.test.ts
  --pool=threads` — 15/15 green.
- `npm run type-check` — clean.
- ESLint on the probe file — 0 errors, 0 warnings.
- Full read of the r32 surfaces at the audit commit:
  `useAppLifecycle.ts` (:261-305 pauseSimulation/resumeSimulation
  entryStage gates, :335-749 bootGame incl. :346 flag + :355
  resumeCombat + :399 load await + :488 restore + :542/:658 save awaits
  + :727-742 markReady/clock/tick/enterGame tail, :309-331
  persistProgress gate), `useBootFlow.ts` (:82-112 auth/error/enterGame
  route requests), `GameManagerTurnBattleOps.ts` (:231 clock field,
  :384-433 setCombatClockSource/freeze/resume/getters, :480-486
  syncOffScreenFreeze, :488-516 advanceCombat/stepTurnBattle),
  `CombatClock.ts` (:63-155 reasons/stop/start/resume semantics),
  `WorkerLaneAdvance.ts` (:121-203 mintedSpanMs + guard arms, :205-341
  lane loop incl. seeded flag inheritance :230/:323 and pending emit
  :338-345), `ProductionOffline.ts` (:90-201 settleWorkersOffline incl.
  :184-194 per-head re-stamp condition), `ProductionSystem.ts`
  (:129-189 restoreStates shift arm, :214 detached getState),
  `ProductionCycles.ts` (:22-42 buildProductionCycle authored-span
  stamp), `ProductionBalance.ts` (:14-40 CYCLE_BASE_SECONDS_BY_REALM +
  computeCycleSeconds), `AlchemySystem.ts` (:88-110 job shape,
  :376-463 restoreJobs drop/shift/normalize arms, :473 getJobs),
  `QuestManager.ts` (:147-204 restore normalize arm),
  `DecomposeSystem.ts` (:292-339 merged-deadline cap),
  `TribulationDirector.ts` (:870-878 cooldown cap),
  `GameManagerPersistentEffectOps.ts` (:307-413 applyTimedEffect
  ceiling/merge/push arms, :416-424 tickTimedEffects, :434-459
  activateTuLinhTran), `TuLinhTranBalance.ts` (:41-58
  getActiveCultivationSpeedPercent), `stores/player.ts` (:119-196
  boundTimedEffectClocks + payoutExpiresAtMs, :654-660 restore map),
  `saveShapeValidation.ts` (:1640-1760 TLT/pill branches, :3500-3580
  worker-cycle ordering/span/started pins, :3706-3830 alchemy job pins
  incl. :3763 ordering + :3795-3809 span), `SaveSystem.ts`
  (:273-323 restoreGameSession, :345-360 buildGameSave lastSavedAt =
  Date.now()).

---

## Verdict: FAIL (0 Critical / 0 High / 1 Medium / 0 Low / 3 Nit)

The r32 corrections are mutually coherent at every stamp seam I attacked
(ordering parity, minted headroom, re-stamp headroom, cap clamps, stamp
coercion). The one real integration defect is the PLACEMENT of the new
`resumeCombat('authority-pause')`: it unlatches the combat channel at
bootGame ENTRY, before admission is proven — so every fail arm mounts the
terminal surface with combat running, and every boot await lets RAF
frames step the in-flight battle pre-admission. The r30-INT-1 channel
("combat channel keeps resolving turns behind the terminal card") is
re-opened on the retry-fail edge.

| ID | Severity | Class | Surface |
|---|---|---|---|
| R33-INT-1 | Medium | unlatch placement precedes proven admission; no re-latch exists on the fail path | `useAppLifecycle.ts:355` — `gameManager.resumeCombat('authority-pause')` runs at bootGame entry, immediately after `simPaused = false`. The pause contract is two latches (`simPaused` flag + `CombatClock.reasons`); clearing the reason is correct ONLY for the success path, but nothing re-latches it when boot fails: every fail arm (`load 'unavailable'` :411-415, 'corrupted'/'incompatible' :427-435, 'pending-*' :438-451, restore 'rejected' :490-501, commit/firstSave refuse :556-599/:682-721, grant-throw :629-643) ends at `boot.fail()` -> `entryStage 'error'`, and `pauseSimulation` can never re-fire because it requires `entryStage === 'game'` (:265) while `resumeSimulation` only deletes reasons. The singleton gameManager keeps the in-flight battle across re-boots (restoreGameSession never touches turnBattle — `SaveSystem.ts:273-323`), so after `pauseSimulation()` latched 'authority-pause' during a live battle, a failed re-boot leaves `getCombatClockState() === 'running'` with an empty reason set and the RAF/main-process source (`App.vue:198-201`) feeding `advanceCombat` -> `stepTurnBattle` (`GameManagerTurnBattleOps.ts:488-516`) behind the terminal card. PROBED (R1): entered -> startBattle -> pauseSimulation (frozen, `['authority-pause']`) -> showAuth -> load 'unavailable' -> boot 'failed', `entryStage 'error'` — combat clock `running`, reasons `[]`, `manualSource.advance(1)` emits steps into the still-mounted battle. PROBED (R2): the clock is already `running` INSIDE the awaited `coordinator.load()` — frames land pre-`markReady` on the success path too (mutations before restore are wiped by restoreGameSession's replace, but a battle that resolves during the remote-authoritative commit await :542 mutates post-restore state that the next autosave persists). Bounded harm — `persistProgress` gates on `entryStage !== 'game'` + `canMutate()` so nothing writes directly — but the invariant the r30-INT-1 ordering relies on is broken and every later pause-simulation caller is disarmed in this window. Fix direction: keep `simPaused = false` at entry (the stale flag genuinely poisons the next pause) but move `resumeCombat('authority-pause')` beside `authority.markReady()` (:727) / before `boot.enterGame()` (:742) — same unlatch on every admitted path, freeze preserved on every fail arm. Alternative: re-`freezeCombat('authority-pause')` inside the fail arms; heavier and easier to miss a new arm. R4 pins the intended success-path behavior stays intact either way. |
| R33-INT-2 | Nit | clock-source swap silently drops latched freeze reasons | `GameManagerTurnBattleOps.ts:395-408` — `setCombatClockSource` calls `combatClock.stop()`, and `CombatClock.stop()` CLEARS the whole reason set (:82-91); the rebuilt clock re-syncs only 'not-revealed' via `syncOffScreenFreeze`. A mid-pause source swap would silently lose 'authority-pause'/'user-pause'. Reachability: production calls it once at `App.vue:198-201` before any battle exists — unreachable mid-pause; sim/test harness seam only. Listed so a future source-swap caller knows the latch is not preserved. |
| R33-INT-3 | Nit | expiresCeiling classification key differs from the validator's TLT key | Writer: `GameManagerPersistentEffectOps.ts:315-318` selects the TLT ceiling on `effect.effectGroup === TU_LINH_TRAN_EFFECT_GROUP`; validator: `saveShapeValidation.ts:1640+` enters the TLT branch on `sourceItemId === 'tu_linh_tran'` and separately pins `effectGroup === TU_LINH_TRAN_EFFECT_GROUP`. A crafted record claiming the TLT source with a foreign group gets the `2^52-1` ceiling (probed C3-1: pushed `expiresAtMs === 2^52-1`), but the same record is refused at admission on the group pin regardless of expiry — the key mismatch can only narrow a writeable shape, never admit one. Reverse direction (TLT group + foreign source) over-clamps harmlessly (probed C3-2: ceiling applied). Coherent; noted because a future writer keyed on sourceItemId would diverge. |
| R33-INT-4 | Nit | dual span-source contract survives r32 | `advanceWorkerLanes` cursors chain `dueMs = startMs + cycleMs` (caller param) while the persisted head mints `completesAtMs = startedAtMs + computeCycleSeconds(baseSeconds, siteLevel)*1000` (`ProductionCycles.ts:35-38`) — an incoherent caller (cycleMs < authored) still persists the AUTHORED span, so the lane's internal due and the persisted deadline disagree within that call. r32 aligned the headroom denominator (:133-136) but the semantic split is pre-existing and unchanged. Both real callers pass the coherent pair (`tickWorkers` and `settleWorkersOffline` compute `cycleMs = computeCycleSeconds(baseSeconds, state.level)*1000` with `siteLevel = state.level` — verified identical pair); reachable only via a hypothetical third caller. Probed C1-3: pending head carries authored span, not the caller cycleMs. |

---

## Confirmed-coherent surfaces (attacked, no finding)

| Surface | Verification |
|---|---|
| Ordering parity: alchemy drop vs production park vs quest clamp | All three are deny-direction and internally consistent. Alchemy `restoreJobs` drops inverted pairs outright (the job's inputs stay burned — no refund contract on any drop arm, same as unknown-siteId drops in `restoreStates`); production `restoreStates` parks inverted pairs verbatim, then the `advanceWorkerLanes` `.some()` guard (:185-194) zero-advances the WHOLE site — honest sibling lanes freeze with it, pending preserved untouched, and the parked pair self-refuses the next save write via the F-A11-4 ordering pin (probed C2-1 end-to-end: park -> tick zero-advance -> `validateGameSaveShape` rejects). Quest clamps `lastDailyResetAtMs` to `nowMs` under a sane clock (probed C2-2). The asymmetry is unreachable through validated saves — the validator rejects `completesAtMs <= startedAtMs` for BOTH collections at admission (:3533, :3763) — so only ungated feeds see the divergence; within that class drop-vs-park is a documented doctrine choice, not an incoherence. |
| `mintedSpanMs` vs the two real callers | `tickWorkers` and `settleWorkersOffline` both pass `cycleMs = computeCycleSeconds(baseSeconds, state.level) * 1000` AND `siteLevel = state.level` — the coherent pair; `mintedSpanMs = max(0, cycleMs, authored)` collapses to cycleMs, so nothing honest tightens. Probed C1-1: an incoherent `cycleMs=1000` at `nowMs = 2^52 − authored/2` now zero-advances (old guard admitted, minted stamp ≥ 2^52); C1-2: coherent pair denies identically at the same boundary. |
| Re-stamp skip vs deadline-mode successor ordering | The skip is per-head but the SHIFT is per-PAIR uniform (`started`/`completes` + same delta, `ProductionOffline.ts:184-194`) — intra-pair ordering can never break. Successors of a parked head are minted on LATER ticks from the persisted `completesAtMs` as `due + cycleMs` — the chain re-anchors on the persisted due each time, so head-vs-successor ordering is structural, not epoch-dependent. Within one site all seeded heads share `emptyLaneStartMs + k*cycleMs` dues → identical completes → uniform decision; mixed outcomes need cross-site or budget-truncated lanes AND `Date.now()` ≈ 2^52 (unreachable under any honest clock — `completes + shift ≥ 2^52` requires `Date.now() ≥ 2^52 − span`). Probed C4-1/2: honest-skew shift keeps ordering + lands `started ≤ fieldNow` (validator `startedAtMs <= lastSavedAt` holds at the next write); crafted-far clock parks the pair verbatim. |
| `expiresCeiling` `Date.now()` vs validator `lastSavedAt + 31d` | Coherent under any monotone clock: the writer ceiling is computed at apply-time `Date.now()`, the validator bound at write-time `lastSavedAt = Date.now()` — `lastSavedAt ≥ applyNow` always, so a clamped write is ≤ its own bound. Write lag only WIDENS headroom. Honest TLT writer stamps `now + 24h` ≪ ceiling; restore re-bounds live claims at `provenance + 24h` (`boundTimedEffectClocks`) — the +7d gap is the documented skew allowance. |
| `tickTimedEffects` / `getActiveCultivationSpeedPercent` vs coerced stamps | Both consumers gate on `expiresAtMs > now` and read only finite persisted stamps. Push-arm coercion (`expires` non-finite -> applied stamp) lands dead-on-arrival: probed C3-3 — the record neither contributes `cultivationSpeedPercent` nor survives the next tick. Stackable NaN span coerces to `duration = 0` — no extension, no NaN persistence (probed C3-4). |
| Shifted restore stamps vs `startedAtMs <= lastSavedAt` pin | `restoreClockMs = min(lastSavedAt, Date.now())` (`GameManagerSaveRestore.ts`) — a shifted pair lands `started = restoreClockMs ≤ lastSavedAt`, so the write-side pin holds at the next save even under a future-dated crafted marker (shift lands at `Date.now()` ≤ next marker). Alchemy's digest re-derive on shift keeps the reservation witness replaying (unchanged r28 seam). |
| Decompose/Tribulation cap clamps | `min(restoreNow + span, 2^52−1)` mints inside `isNonNegativeBoundedTimestamp` (`|x| < 2^52`, and `2^52−1 < 2^52`) — the clamp output itself validates; `2^52−1` also satisfies each channel's tighter pin (nextCycleAt non-negative-bounded; cooldownUntil ≤ lastSavedAt + cooldown — the cap sits below `restoreNow + span` and `restoreNow ≤ lastSavedAt` for admitted saves). |
| `en.json`/`vi.json` | Diff is exactly the trailing-newline restoration — no content drift. |
| `simPaused = false` + `resumeCombat` ordering vs `beginChecking` | `authority.beginChecking()` (:365) runs AFTER the unlatch — even if it synchronously fired a loss handler, `pauseSimulation` early-returns on `entryStage !== 'game'` (boot stage is not 'game'), so no contradictory latch can interleave between the two lines. Safe ordering on that axis (the entry-vs-admission axis is R33-INT-1). |

## Rejected candidates (attacked, mechanism disproven)

| Candidate | Rejection |
|---|---|
| Parked inverted pair settles free rewards | `advanceWorkerLanes` `.some(completes <= started)` zero-advances the whole site — the parked pair never reaches a settle path; it freezes its own channel and self-refuses the next write. Deny-only. |
| Shifted post-dated pair mints a `startedAtMs > lastSavedAt` wedge | `restoreClockMs = min(lastSavedAt, Date.now()) ≤ lastSavedAt`; shifted `started = restoreClockMs` sits exactly AT the marker at worst — the write-side pin is `>` not `>=`, so it passes. |
| Mixed-epoch pending corrupts cross-lane ordering | Lanes sort by `dueMs` at each `advanceWorkerLanes` entry (:220, :234) — epoch mixing only shifts WHICH lane settles first within the window; each chain stays internally ordered (uniform per-pair delta or verbatim park). |
| Crafted TLT push exceeding `lastSavedAt + 31d` wedges the write | The ceiling mints `≤ now + 31d ≤ next lastSavedAt + 31d` — inside the writer bound by construction; the only sub-shape the ceiling misses (foreign group + TLT source) is refused on the group pin anyway (R33-INT-3). |
| `appliedAtMs` negative clamp mints an ordering wedge | `appliedCeiling = min(2^52−1, now)`; floor `−(2^52−1)` is inside `isBoundedTimestamp` (`|x| < 2^52`); the `appliedAtMs <= lastSavedAt` pin holds since the pushed stamp ≤ now ≤ next write marker. Verified C2 in the r32 probe; unchanged by r32. |
| `hiddenChannelCycles` needs the same re-stamp | Per-channel integer counters, not ms stamps (:3645-3648 pins them as integers) — no timestamp domain applies. |

## Deliverables

- Probe: `src/services/save/auditR33Int.probe.test.ts` — 15 tests, all
  passing, deterministic (`Date.now` mocked via `vi.spyOn`,
  `ManualClockSource` for the combat clock, `@vitest-environment node`,
  `--pool=threads`).
- This report.
- Branch `devin/audit-r33-INT-a014b7fb` carrying only these two files.
