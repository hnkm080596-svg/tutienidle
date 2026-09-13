# M8 — Combat resources & turn-phase contract (G5 evidence report)

Mission: `arch/m8-combat-resources`, worktree `arch-m8-combat-resources`,
fork `1775f441` (merge resolution — M3 session tests on M7 stat signatures).
Scope: ARCH-003 + ARCH-010 + audit findings C05/C06 — MP/Ward regeneration
moves onto the entity-turn cadence through the vitals authority, the legacy
`*RegenPerSecond` names normalize at one point, a lethal status tick ends
the actor's turn (no regen, no charged-hit resolution, no post-death
healing), and a charged special/ultimate completion accrues `currentThe`
exactly once.

## G0 — task card

**Responsibility being repaired:**

1. MP/Ward regeneration in per-turn units through the vitals/resource owner
   — same cadence family as `hpRegenPerTurn` (already authority-routed).
2. Normalize the legacy `PerSecond` field names at ONE contract point —
   authored content and the stat schema keep their legacy names.
3. Preserve Ward's delayed-regen intent (`WARD_REGEN_DELAY_SECONDS = 3`
   wall-clock in the retired engine) as 3 holder turns measured on
   `timeSinceLastHitTaken`.
4. Status/DoT processing before regeneration; a lethal DoT tick ends the
   actor's turn — no regen, no resource deltas, no charged resolution.
5. Dead entities reject ordinary healing in the vitals owner itself.
6. Charged-hit completion preserves `currentThe` gain parity
   (`THE_GAIN_PER_LINK` / `THE_GAIN_PER_FINISHER`) with the normal path —
   the charge-resolve early return previously skipped the shared block.

**Invariants restored:**

- Every HP/MP/Ward mutation on the regen path goes through
  `EntityVitalsSystem` (`applyTurnRegen`) — `vitalsWriteAuthority` guard
  stays green with no new production writer.
- One mutable clock per delay gate: `timeSinceLastHitTaken` is written by
  `CombatSystem` on landed hits (=0) and advanced by the turn engine on
  the holder's own declare (+1). No wall-clock second system returns.
- Dead actors produce a well-formed declared object that reaches
  `completeAction` (gauge consume, win/defeat check, log) but cannot
  mutate vitals, resources, or opponents.

## G1 — evidence map (pre-change)

- `TurnBattleSystem.declareActorAction` (was ~line 794): the only regen
  was `stats.hpRegenPerTurn` via `combat.applyHealing(..., 'regen')`;
  `manaRegenPerSecond`/`wardRegenPerSecond` had NO production consumer in
  the turn engine — the stats existed (StatTypes.ts:38,53) but never
  moved a pool. The retired real-time BattleSystem regenerated both per
  second, ward gated on `timeSinceLastHitTaken >= 3`.
- Same method had no post-status liveness check: a DoT-killed actor still
  ran regen (healing a `currentHp=0`/`alive=false` entity back above 0 —
  a zombie-pool latent bug), resource deltas, boss trigger and action
  selection; a `chargeResolved` flag captured pre-death still fired the
  charged hit in `applyActionImpact`.
- `EntityVitalsSystem.applyHealing` (was ~line 86): healed regardless of
  `target.alive` — any post-death heal would silently un-zero the pool.
- `TurnBattleSystem.applyActionImpact` charge-resolve branch
  (was ~line 1045): `return { targetIds }` fired before the shared
  post-commit block that grants `currentThe` for special/ultimate slots,
  so `BAT_KIEM_THUAT` (chargeTurns 3) and `TRU_TIEN_KIEM_TRAN`
  (chargeTurns 3, `the` cost 100) completions accrued no The.
- Audit C05/C06: charged-kit resource accounting + dead-entity healing.

## G2 — design decisions

- **Single normalization point:** `declareActorAction` maps the legacy
  stat names to per-turn deltas at the turn-resource boundary:
  `manaRegenPerSecond` -> `deltas.mp`, `wardRegenPerSecond` -> `deltas.ward`
  gated by `timeSinceLastHitTaken >= WARD_REGEN_DELAY_TURNS` (=3).
  No schema rename, no per-content patch — A8/A9 preserved.
- **Authority:** new `EntityVitalsSystem.applyTurnRegen(target, deltas,
  sourceId)` owns all three clamps (`currentHp`->`entity.maxHp`,
  `currentMp`->`stats.maxMp`, `currentWard`->`stats.wardMax` — matching
  the ceilings `emit` already reports), returns the applied amounts, and
  emits ONE `entity_vitals_changed` reason `regen` carrying all three
  before/after views. No-op calls emit nothing (same as the old full-HP
  skip). Dead targets return zero — same boundary as healing.
  `CombatSystem.applyTurnRegen` is the typed orchestrator entry.
- **Liveness boundary:** after `actorBuffSystem.update(...)` + stat
  refresh and before regen/resources/boss-trigger/action-selection,
  `!actor.entity.alive` returns a dead declared: `chargeResolved:false`,
  `chargedSkill:null`, `chargeTargetIds:[]`, `affected:[]`,
  `action:null`, `isFollowUpBypass` drained so the flag cannot leak into
  a later turn. `completeAction` still runs — gauge consume, victory/
  defeat evaluation, log entry all preserved.
- **Ward delay in turns:** `actor.entity.timeSinceLastHitTaken += 1` on
  the holder's declare; `CombatSystem.resolveAttack` resets it to 0 on
  every landed hit (unchanged). `Infinity` (never hit) regenerates from
  turn 1 — legacy parity. `+1 then >= 3` means the 3rd unhit holder turn
  regens, matching "3 turns pass unhit".
- **Charged The gain:** inside the charge-resolve early branch, after the
  hits, gated on `chargedSkill && declared.chargeTargetIds.length > 0`
  (parity with the normal path's `affected.length > 0`), resolved via
  `actor.special?.skill.id === chargedSkill.id` / `actor.ultimate?.skill.id`
  — the same special/ultimate inference the declare-phase charge code
  already uses (lines ~714-718). Fires exactly once: the resolve branch
  returns before the shared block, and charge-init never reaches the
  shared block (`(chargeTurns) === 0` gate).
- **Healing dead-rejection:** `applyHealing` returns 0 early on
  `!target.alive` — no mutation, no phantom vitals event. All production
  callers audited: `BattleLootSystem` heal-on-kill already gates
  `healTarget.currentHp > 0`; leech paths gate `source.alive`;
  `TribulationDirector` manages its ghost via its own snapshot write
  (allowlisted owner) — mind-success heal on a dead ghost now no-ops,
  which is the intended contract (dead stays dead; no resurrection
  policy exists).

## Q1-Q12

- **Q1 (observable behavior):** +N MP/Ward per actor turn on the holder's
  cadence, capped at the live ceilings; Ward resumes 3 holder turns after
  the last landed hit; a lethal status tick ends the turn; dead entities
  take no heal/regen/post-death damage; charged specials/ultimates grant
  The once at completion. Covered by `TurnBattleSystem.turnRegen.test.ts`
  (8 tests) + `GameManager.turnRegenStage.test.ts` (3 tests).
- **Q2 (one owner):** `EntityVitalsSystem.applyTurnRegen` is the sole
  mutation site for the regen path; `applyHealing` dead-rejection lives
  in the same owner. The turn engine decides WHICH pools regen (policy);
  the vitals owner decides HOW (clamp/dead/event) — same split as
  damage/healing already use.
- **Q3 (state lifecycle):** `timeSinceLastHitTaken` — written by
  `CombatSystem` (=0 on landed hit, the only existing writer) and
  advanced by `declareActorAction` (+1 per holder turn). No other
  production writer. `currentThe` gain writes stay in the impact phase
  where the normal path already writes it.
- **Q4 (real chain):** `GameManagerTurnBattleOps.buildTurnBattle` ->
  real `CombatEntity`/participant/adapters -> `resolveNextStep` ->
  `declareActorAction` -> `BuffSystem.update` -> boundary -> regen ->
  action -> `applyActionImpact` -> `completeAction`. Stage tests drive
  `turnBattleOps.startStage` + `ManualClockSource` — the real production
  loop.
- **Q5 (existing primitive):** reused `timeSinceLastHitTaken`,
  `applyTurnStartDeltas`, the vitals `emit` contract and its event
  fields; no new event types, no new stat fields, no parallel regen
  system.
- **Q6 (dependency direction):** `CombatSystem` exposes the typed entry;
  `EntityVitalsSystem` mutates; `TurnBattleSystem` orchestrates. No new
  imports across layers.
- **Q7 (timing/gameplay/presentation):** regen is a domain write inside
  declare; presentation consumes the existing `entity_vitals_changed`
  event — `reason:'regen'` and amount semantics unchanged for HP;
  mp/ward observable via the existing before/after fields.
- **Q8 (consumers preserve semantics):** authored regen numbers
  unchanged — only the cadence moved from seconds to holder turns per
  the locked decision. `applyHealing` callers unchanged in signature;
  the only behavioral delta is the intended dead rejection.
- **Q9 (queries observational):** the liveness boundary reads
  `entity.alive` only; `applyTurnRegen` is invoked (not queried) once per
  declare.
- **Q10 (duplicate/stale/failed/interrupted):** `applyTurnRegen` is
  idempotent-shaped (clamped adds); a second call same turn is
  impossible (single declare site). Dead-actor early return drains
  `pendingFollowUpBypassActorId` — no stale flag. Charge state fields
  cleared during the charge tick stay cleared on death.
- **Q11 (old path):** the retired engine's per-second regen stays
  retired; the legacy stat names are the compatibility surface
  (normalized at the consumer). The old `applyHealing(..., 'regen')`
  call for HP regen is replaced by `applyTurnRegen` — same event reason.
- **Q12 (scope/finish):** every changed file maps to the task card; P12
  classification below; stop condition = quick verification + affected
  scope green modulo documented pre-existing failures.

## Files changed

- `src/core/combat/EntityVitalsSystem.ts` — `applyHealing` dead rejection
  (lines ~87-93); new `applyTurnRegen` (lines ~118-166).
- `src/core/combat/CombatSystem.ts` — `applyTurnRegen` typed entry
  (lines ~135-148).
- `src/core/battle/turn/TurnBattleSystem.ts` — `WARD_REGEN_DELAY_TURNS`
  constant + rationale (~line 219); post-status liveness boundary +
  `timeSinceLastHitTaken` advance + `applyTurnRegen` call in
  `declareActorAction` (~lines 805-860); charged-resolution The gain in
  `applyActionImpact` (~lines 1082-1099).
- `src/core/battle/turn/TurnBattleSystem.turnRegen.test.ts` — NEW: 8
  focused tests (regen cadence + caps, ward delay gate, regen event
  contract, lethal-DoT boundary, dead charger, vitals dead rejection,
  real `BAT_KIEM_THUAT` charge The gain, charged-ultimate finisher gain).
- `src/core/game/GameManager.turnRegenStage.test.ts` — NEW: 3 real
  stage-loop tests (Thanh Tuyen MP regen, Bang Giap Ward regen via the
  `duong_linh_bang_giap` specialization, Dia Tru Ward regen) through
  `turnBattleOps.startStage` + real kits + real event stream.
- `src/core/battle/turn/TurnBattleSystem.compositePicks.qa.test.ts` —
  test-only flake fix: `makeEntity` now passes `maxHp: 1_000_000` into
  `createBaseStats` so `stats.maxHp` agrees with the 1M `currentHp`/
  `entity.maxHp` fixture (see below).
- `docs/qa/2026-09-14-m8-combat-resources.md` — this report.

## Verification

- `npm run type-check` — PASS (exit 0).
- Focused scope — 33 tests green across 9 files
  (`turnRegen` 8, `turnRegenStage` 3, `compositePicks.qa`, `healEvent`,
  `theResource`, `chargeCcInteraction`, `ResourceTurnHook` x2,
  `vitalsWriteAuthority`).
- Broad affected scope `src/core/battle src/core/combat src/core/game
  tests/architecture` — 1149 passed / 4 failed of 1153 (209 files).
  Failures classified per P12:
  - `GameManager.perfectClear.feasibility` multi-hit floors 1/5/9/10 —
    PRE-EXISTING and documented in the M7 report: all 4 fail identically
    at the fork commit (verified via `git stash` baseline: 3/4 failed at
    base, marginal round counts vs balance-lock limits; fixtures carry no
    regen stats so the M8 paths are literal no-ops there).
- `vitalsWriteAuthority.test.ts`, `statProvenanceAndQueryPurity`,
  `combatContract`, `canonicalBuffSurface`, `eslintCoreSeverity` — all
  green; no new production writer of `currentHp`/`currentMp`/
  `currentWard`/`alive`.

## P4 / P5 / P13 / P14

- **P4 adversarial QA (quick, inline):** reviewed the diff for
  adversarial edges —
  - dead actor mid-charge: charge tick clears `chargingTurnsRemaining`/
    `pendingChargedSkillId` before the boundary; `chargeResolved:false`
    + `chargedSkill:null` makes the impact-phase charge branch
    unreachable — covered by test;
  - `Infinity + 1` stays `Infinity` — never-hit entities regen turn 1;
  - MP/Ward ceilings use effective `stats.maxMp`/`stats.wardMax` — same
    values the vitals event reports as `maxMp`/`maxWard`;
  - all `applyHealing` callers audited (see G2) — no caller relied on
    healing a dead entity;
  - The-gain parity: init commits resource/cooldown (pre-block), resolve
    fires the gain once — a `the`-cost ultimate lands the finisher gain
    on the emptied pool, matching the normal path's post-commit
    ordering;
  - negative/NaN/0 deltas skip cleanly; no-op emits nothing.
  No task-caused defect found.
- **Flake found & fixed (pre-existing, test-only):**
  `compositePicks.qa` asserted exactly 2 hits, but its enemy fixture set
  `currentHp/maxHp: 1_000_000` while `stats.maxHp` stayed at the
  `createBaseStats` default 100. `refreshParticipantStats` (M7) clamps
  `currentHp` to the effective maxHp — the "immortal" target was really
  100 HP, and a ~5% crit (143 dmg) legitimately killed it, dropping the
  second pick's hit (~2-5% flake; reproduced 4/200 on the base commit
  with M8 stashed). Fixed by passing `maxHp: 1_000_000` into
  `createBaseStats`; the same inflated-hp fixture pattern exists in ~29
  other test files but only count-asserting tests can flake — noted as
  retained debt.
- **P5 code review:** self-review against A2/A9 — one regen owner, one
  normalization point, no duplicated mutation logic, no per-skill-ID
  patches, no `any` introduced.
- **P13 runtime wiring:** no new wiring surface — regen rides the
  existing declare phase; headless `GameManager` stage tests exercise
  the real `startStage` -> clock -> declare -> regen chain end-to-end.
- **P14 visual:** deferred per the isolated-worktree exception —
  `entity_vitals_changed` reason `'regen'` is the same event shape
  CombatScene already renders for HP regen; mp/ward fields were already
  carried. No rendering path changed.

## Retained debt / non-goals

- Legacy `*RegenPerSecond` field names remain in `StatTypes`/content —
  renamed only conceptually at the single consumer; a schema rename is a
  separate content-migration mission.
- `perfectClear.feasibility` multi-hit floors remain marginal/failing at
  the fork commit (documented since M7) — a balance/test-design issue
  for a separate mission.
- Charged self-targeted skills gate their The gain on captured targets
  (parity with `affected.length > 0`); a charged self-buff resolving
  with no living enemies grants none — acceptable edge, matches the
  hit-completion semantic.
- The dead-actor declared still consumes gauge and logs an entry
  (skillId '') — intentional: the turn happened; win/defeat bookkeeping
  must still run for a DoT-killed last enemy.
- `entity_vitals_changed` `amount` field carries only the HP portion of
  a combined regen tick (mp/ward deltas are in the before/after fields)
  — documented at the emit site; widening `amount` would change the
  event contract for all consumers.
