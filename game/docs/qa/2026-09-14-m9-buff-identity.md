# M9 — Buff Target/Ingredient Identity (ARCH-009) — Worker G5 Report

Date: 2026-09-14
Branch: `arch/m9-buff-identity` (worktree `E:\tutienidle\.agent-worktrees\arch-m9-buff-identity`, base `arch/repair-2026-09` @ `1afd7c51`)
Status: **commit-ready, uncommitted** (per user instruction: do NOT commit)

```text
TASK CARD
Task / user request:
  M9 of the ARCH repair program: (a) ARCH-009 buff identity repair —
  proc'd effects must be written to the correct target pool with correct
  source/target identity; reaction consumption must remove the exact
  matched ingredient instances; multi-source reaction selection must be
  explicit; target-scoped CC queries must filter by targetId. (b) Retained
  M7 debt: live passive modifiers targeting MainStatKeys (specifically
  passive_dai_thua_dao_tam's on-hit attunement stacking) update raw stats
  but do not re-derive derived elemental powers — pick ONE approved
  strategy and prove the passive changes combat numbers.
Assigned absolute worktree / branch:
  E:\tutienidle\.agent-worktrees\arch-m9-buff-identity / arch/m9-buff-identity
Requested observable behavior:
  1. thach_hoa holder lands a hit -> choang lands in the VICTIM's pool,
     choang.sourceId = hitter, choang.targetId = victim; holder pool keeps
     thach_hoa only; holder is not stunned, victim is stunned (ccBlocked on
     its next declare).
  2. Player fire (bong) + companion water (te_cong) x2 on one target ->
     exactly ONE Boc Hoi reaction; the player's bong instance is consumed
     once and cannot feed a second reaction.
  3. A cc buff aimed at another entity inside a pool does not control the
     pool holder.
  4. passive_dai_thua_dao_tam: 10 landed hits raise effective attunement
     AND the attunement-derived powers (firePower etc.) mid-battle.
  No recipe, damage, or balance changes; ElementReaction data untouched.
Single responsibility / invariant:
  Buff instance identity (pool ownership + sourceId/targetId) is preserved
  through proc routing, CC queries, and reaction matching/consumption;
  live main-stat deltas re-derive their incremental attribute-derived
  stats at the single resolved->effective boundary.
Current owner (path + symbol):
  BuffSystem.rollOnHitEffects / isStunned|isFrozen|isRooted
  (src/core/buff/BuffSystem.ts) — proc enumeration+write and CC queries.
  TurnReactionManager.checkAndTrigger
  (src/core/battle/turn/TurnReactionManager.ts) — reaction match+consume.
  calculateEffectiveStats (src/core/stats/StatCalculator.ts) — the M7
  resolved->effective assembly boundary.
Target owner (path + symbol; same owner is valid):
  Same owners. BuffSystem keeps proc enumeration (holder pool) but the
  proc result is applied through the victim's pool (passed by the caller).
  TurnBattleSystem supplies target.buffs at the call site.
Existing primitive/mechanism to reuse:
  BuffSystem.apply (the apply/write authority — proc results now go
  through a BuffSystem wrapping the victim pool, keeping snapshot/dot
  resolution, resist/duration policy, stack merge in one place);
  BuffPool.removeInstance(id, sourceId) — the (id, sourceId) pair is the
  pool's instance key (apply() merges same-source instances, so the pair
  uniquely identifies the matched ingredient); deriveAttributeModifiers
  (single derivation rule, now parameterized on the 5 main stats only).
Missing capability (or none), real caller that needs it:
  (a) target-pool parameter on rollOnHitEffects — caller:
      TurnBattleSystem.applyActionImpact hit branch.
  (b) instance-carried sourceId in the reaction scan — replaces
      reconstructing existingSourceId = source.id.
  (c) delta-derivation pass in calculateEffectiveStats — caller:
      recomputeEffectiveStats -> TurnBattleSystem.refreshParticipantStats
      (live modifiers from GameManagerPersistentEffectOps provider).
Production chain: entry -> orchestrator -> owner -> downstream consumer
  Proc: turn hit -> TurnBattleSystem.applyActionImpact ->
    BuffSystem(actor.buffs).rollOnHitEffects(actor, victim, victim.buffs)
    -> BuffSystem(victim.buffs).apply -> victim pool; consumed by
    declareActorAction CC gate + update() DoT tick on the victim's turn.
  Reaction: applySkillAilments -> BuffSystem(target.buffs).apply(new
    ingredient) -> TurnReactionManager.checkAndTrigger(target.buffs, id,
    actor.entity, target.entity, combat, registry, actor.buffs) ->
    ELEMENT_REACTIONS match -> instance consumption -> damage via
    combat.applyModifiedDirectDamage; eventBus 'reaction' event.
  Stats: GameManager.update -> tickPacing/refreshParticipantStats ->
    recomputeEffectiveStats(baseStats, buffs, liveStatModifiers(entity))
    -> calculateEffectiveStats -> entity.stats (read by hits, DoTs,
    gauge, vitals ceiling).
State: writer / readers / reset / persistence / async cleanup
  BuffPool instances: written by BuffSystem.apply/convert/update and
  pool-level remove*/clear*; read by BuffSystem queries,
  recomputeEffectiveStats (statModifiers), and the reaction scan; reset
  per battle (fresh BuffPool per participant, TurnBattleAdapter); no
  persistence (combat ephemeral). entity.stats: single writer
  refreshParticipantStats; passive modifier.stacks mutated by
  PassiveSystem (Skill collection state, reset per battle via
  resetStacks). No new state introduced.
Expected files and why each is in this responsibility:
  src/core/buff/BuffSystem.ts — owns proc routing + CC queries.
  src/core/battle/turn/TurnBattleSystem.ts — call-site migration (passes
    the victim pool; scopes the CC gate by actor id).
  src/core/battle/turn/TurnReactionManager.ts — owns reaction match/consume.
  src/core/element/ElementReaction.ts — hosts the consumption contract
    doc (data unchanged).
  src/core/stats/StatCalculator.ts — owns derivation; delta pass.
  src/core/battle/turn/TurnStatsRecompute.ts — contract comment.
  Tests: BuffSystem.test.ts, TurnBuffSystem.test.ts,
    TurnReactionManager.test.ts, ReactionManager.test.ts (call-site
    migrations), TurnBuffIdentity.test.ts (new ARCH-009 coverage),
    GameManager.statRefresh.test.ts (retained-debt regression).
Explicit non-goals:
  No ElementReaction recipe/damage/balance edits; no legacy
  ReactionManager.ts change (unreachable in production — see Q11); no
  consumesAilmentId semantics change (authored consume-all rule, not
  ARCH-009); no charge-path on-hit-proc addition (pre-existing asymmetry,
  out of scope); no new BuffPool API (the (id, sourceId) key is the
  instance identity under the pool's uniqueness invariant).
Applicable roadmap phase and current source evidence:
  roadmap.md ARCH repair wave 3 — "M9 — Buff target/ingredient identity
  (ARCH-009)". Audit anchors: AUD-C04 (proc written to holder pool),
  AUD-C08 (cross-source ingredient consumed with wrong sourceId and
  replayed). Turn engine is the live combat path; legacy BattleSystem
  is deleted (R13).
Tests and gates selected, including runtime triggers:
  npx vitest run src/core/battle src/core/buff src/core/element
  src/core/game; npm run type-check. New engine-level tests use real
  TurnBattleSystem + BUFF_REGISTRY + TurnReactionManager and the real
  GameManager + ManualClockSource path.
Stop condition:
  ARCH-009 behaviors hold through the real production chain; the retained
  M7 debt item is closed by one documented strategy with a combat-number
  regression; scope gates green with only the known pre-existing
  perfectClear failures.
Unresolved material assumptions:
  None — multi-source selection policy decided explicitly below; the
  legacy ReactionManager twin defect is recorded as retained debt.
```

## Files changed -> purpose

| File | Purpose |
|---|---|
| `src/core/buff/BuffSystem.ts` | `rollOnHitEffects(source, target, targetBuffs, registry)` — proc results apply into the victim pool (sourceId=hitter, targetId=victim). `isStunned/isFrozen/isRooted(targetId)` — target-scoped CC queries via `hasActiveCc` filtering `buff.targetId === targetId`. |
| `src/core/battle/turn/TurnBattleSystem.ts` | Passes `target.buffs` to `rollOnHitEffects` (per-victim pool in the AOE loop); CC gate calls `isStunned(actor.entity.id)/isFrozen(actor.entity.id)`. |
| `src/core/battle/turn/TurnReactionManager.ts` | Scans `targetBuffs.getAll()` keeping the matched `Buff` instance; consumes by the instance's real `(id, sourceId)` in all three branches (`appliesBuffId`, `appliesAilmentId`, standard + `keepsAilmentId` sub-branches). Oldest-applied-instance selection = pool insertion order. |
| `src/core/element/ElementReaction.ts` | Contract doc only: exact-instance consumption + per-source ingredient identity + oldest-first selection. No data change. |
| `src/core/stats/StatCalculator.ts` | `calculateEffectiveStats` derives the DELTA of the 5 main stats (effective − resolvedBase) into attribute-derived stats via a second `runPipeline` fold; `deriveAttributeModifiers` parameter narrowed to `Pick<Stats, MainStatKey>` (it only reads the 5 keys). |
| `src/core/battle/turn/TurnStatsRecompute.ts` | Comment updated: the resolved->effective site now also derives live main-stat deltas. |
| `src/core/buff/BuffSystem.test.ts` | Migrated on-hit-proc cases to the two-pool contract (holder pool + victim pool); isFrozen calls scoped to `'target'`; added identity assertions. |
| `src/core/battle/turn/TurnBuffSystem.test.ts` | CC queries scoped by targetId incl. bystander negative cases; ported `rollOnHitEffects` test asserts victim-pool landing + source/target identity. Removed one stale mojibake comment describing the pre-fix direction. |
| `src/core/battle/turn/TurnReactionManager.test.ts` | `isRooted('target')` call-site migration. |
| `src/core/element/ReactionManager.test.ts` | `isRooted('target')` call-site migration (legacy test only). |
| `src/core/battle/turn/TurnBuffIdentity.test.ts` (new) | ARCH-009 engine coverage: proc->victim pool both directions (holder=player and holder=enemy), ccBlocked through the real declare gate, foreign-targeted stun cannot block the holder, player-fire + companion-water x2 repro, oldest-first multi-source selection, refresh-in-place same-source ingredients. |
| `src/core/game/GameManager.statRefresh.test.ts` | Retained-debt regression: real `passive_dai_thua_dao_tam` + real GameManager battle — 10 `hit` events raise effective attunement AND firePower/waterPower per the delta-fold formula; zero-delta no-op case; menu-parity within fold-order tolerance. |
| `docs/qa/2026-09-14-m9-buff-identity.md` | This report. |

## Behavior before -> after

- **On-hit proc (AUD-C04):** `rollOnHitEffects` enumerated the holder's pool and applied the result through `this.apply` into the SAME holder pool — `choang` landed on the attacker (`targetId` pointing at the victim while sitting in the attacker's pool) and the unscoped `isStunned()` stunned the attacker. After: the proc result applies through the victim's pool; `choang.sourceId`=hitter, `choang.targetId`=victim; the victim's declare is ccBlocked, the holder is unaffected.
- **CC queries:** `isStunned/isFrozen/isRooted` scanned every effect in the pool regardless of `targetId`. After: a cc effect only counts for the entity named by `buff.targetId` — a misrouted/foreign instance can no longer control the pool holder.
- **Reaction consumption (AUD-C08):** matching collapsed instances to ids (`getActiveIds()`), then removed the existing ingredient by the NEW caster's `source.id` — a fire DoT applied by the player was never consumed by a companion's water hit and re-fed the reaction on every subsequent application (audit repro: `reactionsAfterTwoWater:2`, `bong` still present). After: the matched `Buff` instance's real `(id, sourceId)` is consumed; exactly one reaction fires; the companion's second water hit finds no ingredient.
- **Multi-source selection:** previously undefined (whichever id the dedup'd scan hit first, then the wrong instance removed). After: explicit — when several sources hold a valid ingredient, the OLDEST applied instance is consumed (BuffPool preserves insertion order); documented in `ElementReaction.ts` and locked by test.
- **keepsAilmentId branch:** the kept side was renewed by `source.id` even when the kept ingredient belonged to another source (renewal silently no-opped). After: renew uses the kept instance's real sourceId.
- **Retained M7 debt (passive_dai_thua_dao_tam):** live attunement stacks raised `entity.stats.attunement` but derived powers stayed at the resolved-base values — the passive's only effect was dead in combat. After: `calculateEffectiveStats` derives the live main-stat delta and folds it on top of the resolved base; 10 stacks (+15% attunement) measurably raise firePower/waterPower mid-battle.

## Retained M7 debt — decision and contract

**Chosen strategy: (a) incremental delta derivation at the resolved->effective boundary.**

`calculateEffectiveStats(resolvedBase, tempModifiers)` now runs the
existing pipeline once, computes `delta[i] = effective[main_i] -
resolvedBase[main_i]` for the five `MAIN_STAT_KEYS`, and — only when a
delta is non-zero — folds `deriveAttributeModifiers(delta)` on top of the
effective snapshot via a second `runPipeline` pass.

Why this option: the passive's authored semantic is attunement
("Linh Can"), and converting it to direct Power stats (option b) or
guarding against live MainStat modifiers (option c) would either fork the
authored meaning or ban a legitimate modifier class. Deriving the delta
keeps `deriveAttributeModifiers()` the single derivation rule and never
re-derives the base's own attributes (no double counting).

Contract + documented divergence: the derived delta folds AFTER the
temp-modifier pools — Added merges into Added, the per-tag Increased
(e.g. attunement's `fire` tag) forms its own multiplier on the
post-temp value. The menu view (`calculateStats`) merges base+delta
percent into ONE tag pool, so battle effective and menu resolved differ
by the fold ordering — bounded and one-directional (battle below menu
for positive deltas in the authored range): ~1% at the 10-stack test
point (attunement 100, +15%), ~3.3% at the authored cap (50 stacks x
attunement 100), ~5% at attunement 200/cap; the regression asserts the
bound at the cap (ratio < 1 and > 0.96). Negative deltas
(live main-stat debuffs) symmetrically reduce derived stats. A live
modifier set that nets to zero produces a bit-identical result (fast
path, verified).

Scope safety: the only live-channel content that can move a main stat is
`passive_dai_thua_dao_tam` (pills write permanent baseStats; equipment/
talent/realm passives are static at resolve; no authored buff targets a
main stat — grep verified). A future live main-stat buff/debuff now also
derives correctly through the same path.

## Q1-Q12 / triggered modules

| ID | Verdict | Evidence |
|---|---|---|
| Q1 | PASS | Observable contracts in the task card; failing path repro'd by tests: `TurnBuffIdentity.test.ts` (proc pool + identity, ccBlocked, foreign-stun cannot block, multi-source consume-once, oldest-first) and `GameManager.statRefresh.test.ts` (attunement stacks -> power). |
| Q2 | PASS | Single owners kept: `BuffSystem.rollOnHitEffects` (proc routing), `BuffSystem.hasActiveCc` (CC query rule), `TurnReactionManager.checkAndTrigger` (reaction match/consume), `calculateEffectiveStats` (resolved->effective assembly), `deriveAttributeModifiers` (derivation rule). No second implementation added. |
| Q3 | PASS | BuffPool per participant, fresh per battle (TurnBattleAdapter); entity.stats written only by refreshParticipantStats (M7 contract preserved); passive stacks owned/reset by PassiveSystem. No new mutable state. |
| Q4 | PASS | Real chain exercised: `resolveActorTurn` -> `applyActionImpact` -> rollOnHitEffects/applySkillAilments->checkAndTrigger with real `BUFF_REGISTRY` + `TurnReactionManager`; passive path through real `GameManager`/`ManualClockSource`/`eventBus.emit('hit')`/`clock.advance`. Not helper-only. |
| Q5 | PASS | Reused `BuffSystem.apply` (the write authority — snapshot/duration/resist/stack rules unchanged), `BuffPool.removeInstance` (the (id,sourceId) key IS the instance identity under apply's same-source merge), `deriveAttributeModifiers`, `MAIN_STAT_KEYS`. No new abstraction. |
| Q6 | PASS | Imports unchanged in direction: buff/battle modules consume stats primitives; StatCalculator imports only StatTypes/StatBlock. No presentation imports. |
| Q7 | N/A→PASS | No timing/presentation boundary touched; combat remains headless. |
| Q8 | PASS | Consumers preserve semantics: per-victim proc roll inside the existing AOE loop (each victim pool gets its own roll); same-source, multi-source, refresh, keepsAilmentId, appliesAilmentId/appliesBuffId branches all keep their outcome shape; only the consumed identity was wrong and is now exact. |
| Q9 | PASS | `isStunned/isFrozen/isRooted` remain pure reads; checkAndTrigger unchanged as a command. |
| Q10 | PASS | Duplicate apply = refresh/stack merge (unchanged); consumption is idempotent via the unique (id,sourceId) key; missing `newBuffInstance` degrades to baseDamage path exactly as before; at most one reaction per newly applied buff (unchanged). |
| Q11 | PASS | Legacy `src/core/element/ReactionManager.ts` carries the same defect pattern but is UNREACHABLE in production: `new CombatSystem(this.eventBus)` in GameManager.ts:209 injects no reactionManager, and its live callers (SkillEffectSystem/SkillActionRegistry) belong to the deleted legacy battle path (R13). Left untouched by mission scope; recorded as retained debt below. |
| Q12 | PASS | Scope = the 4 named production owners + TurnStatsRecompute/StatCalculator (retained-debt owner) + tests + this report. Stop condition met; perfectClear quarantine is a separately-planned roadmap item. |

Triggered domain modules: buff lifecycle (R4 owner), reaction/element
(contract), stat pipeline (M7 boundary). All checked above.

## Owner and actual migrated consumers

- `BuffSystem.rollOnHitEffects` — migrated consumer: `TurnBattleSystem.applyActionImpact` (sole production caller; now passes `target.buffs`). Test callers updated to the two-pool contract.
- `BuffSystem.isStunned/isFrozen/isRooted` — migrated consumer: `declareActorAction` CC gate (`actor.entity.id`). No other production callers (grep-verified, incl. .vue).
- `TurnReactionManager.checkAndTrigger` — consumers: `TurnBattleSystem.applySkillAilments` (3 call sites) — signature unchanged; the fix is internal.
- `calculateEffectiveStats` — consumer: `recomputeEffectiveStats` -> `refreshParticipantStats`/`refreshEffectiveStats` (pacing + declare + per-hit refresh). Signature unchanged.

## Old/alternate path status

- `src/core/element/ReactionManager.ts` (legacy) retains the
  source-id-reconstruction defect. Production-unreachable (see Q11) —
  its own test suite still passes. Recommendation for the coordinator:
  either retire it under M13 or port the same instance-identity fix for
  parity; out of this mission's authorized owners.
- `SkillActionRegistry`/`SkillEffectSystem` ailment+reaction path: dead
  production code (same legacy family); unchanged.
- `consumesAilmentId` (Detonate-style) keeps authored consume-all
  semantics — a different rule, not ARCH-009.
- `getActiveIds()` remains a public pool query (tests/HUD); no longer
  used for reaction matching.

## Verification

Commands run in `game/`:

```text
npm run type-check                                          -> exit 0
npx vitest run src/core/buff src/core/battle/turn/TurnBuffIdentity.test.ts
  src/core/battle/turn/TurnBuffSystem.test.ts
  src/core/battle/turn/TurnReactionManager.test.ts
  src/core/element                                          -> 158/158 pass
npx vitest run src/core/battle src/core/buff src/core/element src/core/game
  -> 1067 passed, 4 failed (pre-existing, see below)
```

Pre-existing failures (verified identical on the clean base by stashing
the diff and re-running the file — same 4 failures @ `1afd7c51`):
`GameManager.perfectClear.feasibility.test.ts` multi-hit floor 1/5/9/10 —
the roadmap already carries a "perfectClear feasibility quarantine
(`it.fails`)" item; unrelated to this diff.

Transient environment note: the first full-scope run showed 3 vitest
fork-worker start timeouts (`autoFarm`, `idleDrops`, `talentM3` files
never executed); all 3 files pass on isolated rerun and the final clean
run showed no worker errors.

New/changed test count in scope: +6 (`TurnBuffIdentity.test.ts`) + 2
(`GameManager.statRefresh.test.ts` retained-debt cases) + strengthened
assertions in `BuffSystem.test.ts` (5 cases) and `TurnBuffSystem.test.ts`
(4 cases).

## QA verdict (P4) / code-review verdict (P5)

**P4 adversarial QA — PASS WITH EVIDENCE.** Probes: (1) holder stunned by
own proc — fixed, covered both directions with ccBlocked through the
real declare gate; (2) foreign-targeted stun in a pool cannot block the
holder — covered; (3) same ingredient id from two sources — oldest
instance consumed, companion's survives for a later reaction — covered;
(4) same-source re-apply refreshes in place and still reacts — covered;
(5) zero-delta fast path keeps effective stats bit-identical — covered;
(6) `keepsAilmentId` renew now targets the real owner — fixed;
(7) recipe/balance data diff is empty (doc-only). Deterministic via
`Math.random` fixed at 0.2 (< 0.5 ailment/proc chance, > 0 crit/block).

**P5 code review (self) — PASS.** No `any` introduced (the
`{} as Pick<Stats, MainStatKey>` assertion is fully populated before
use); comments English ASCII; no unrelated file touched; dead-code paths
left intact and documented rather than silently changed.

## P13 progression evidence / P14

P13: wiring-critical check — the live-modifier provider
(`liveStatModifiers`) is injected at both `TurnBattleSystem`
construction sites in `GameManagerTurnBattleOps.ts` (startStage +
repeat-cycle paths) and the regression runs through real
`GameManager.startBattleWithPlayer` + `ManualClockSource` pacing — the
passive stack actually reaches `entity.stats` through the production
wiring, not a stub. P14: deferred per isolated-worktree exception
(engine/data-layer change, no Phaser/CSS surface; a live-browser smoke
of a real earth-basic fight during branch finishing is recommended but
not required for this contract).

## Unresolved task work

None within the assigned responsibility.

## Retained debt / Notes-Suggestions

1. **Legacy `ReactionManager.ts` twin defect** — same id-collapsed
   matching + reconstructed sourceId; unreachable in production today.
   Suggest retiring under M13 or porting the instance-identity fix.
2. **Fold-order parity** — battle delta-fold vs menu single-pass differs
   in one direction (battle below menu for positive deltas): ~3.3% at the
   authored cap (50 stacks x attunement 100), ~5% at attunement 200/cap
   (tag-pool ordering). Documented above and asserted at the cap in the
   regression; exact parity would require un-folding the resolved base —
   deliberately rejected to keep the delta contract.
3. **`getActiveModifiers()` remains pool-scoped** — a misrouted
   statModifier buff would still feed the holder's stats. Post-fix no
   misrouting exists; if a future path can place foreign buffs in a pool,
   targetId-filtering modifiers is the follow-up (not needed today).
4. **Charge-resolve path does not roll on-hit procs** (pre-existing
   asymmetry — charged hits skip the rollOnHitEffects call). Flagged for
   review; not changed.
5. **`perfectClear.feasibility` x4** — pre-existing (proven on base);
   tracked by the roadmap quarantine item.

## Review round 1 (independent spec review — SPEC compliant, 2 Minor findings)

1. **Minor — divergence comment understated the bound**
   (`StatCalculator.ts`): the pool-fold comment claimed "sub-percent"
   divergence; measured ~1.05% at the tested point, ~3.3% at the
   authored cap (50 stacks x attunement 100), ~5% at attunement
   200/cap. Fixed: the comment now states the bound honestly —
   bounded, one-directional (battle below menu for positive deltas),
   worst case ~3-5% at authored extremes. This report's fold-order
   notes were updated to match.
2. **Minor — P15** (`BuffSystem.test.ts`): newly added comments
   contained Vietnamese diacritics. Rewritten in English ASCII;
   pre-existing Vietnamese comments in the file were left untouched.

**Optional strengthening taken:** the attunement parity regression now
also drives the passive to the authored stack cap (50 stacks, +75%
attunement) and asserts the one-directional bound directly — battle
delta-fold < menu single-pass, ratio > 0.96 (~3.3% divergence).

**Re-verification:** `npm run type-check` exit 0;
`npx vitest run src/core/stats src/core/buff` green.
