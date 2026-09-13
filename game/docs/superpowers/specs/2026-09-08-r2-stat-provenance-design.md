# R2 — Stat Provenance & Effective Combat Stats — Design Spec

Date: 2026-09-08
Missions: Roadmap Phase R2 (Architecture Repair Program), Mission 0 findings AR-02 + AR-05.
Status: APPROVED-by-user-design (chat), pending spec review.

## 1. Finding / Evidence

**AR-02 (P0, confidence 100):** the same broad `Stats` type plays three
semantic roles. Chain today:

```text
stores/player.ts:142  finalStats getter  → calculateStats(baseStats, modifiers)  (derives attributes: pass1 → derive → pass2)
useBattleActions.ts:34 passes player.finalStats as "raw" input
GameManager.ts:2682   playerToCombatEntity(player, stats) → Player.ts:409 stores it AS baseStats AND stats
TurnBattleSystem.ts:743 → TurnStatsRecompute.ts:14 → StatCalculator.calculateStats(baseStats, buffs)  (derives attributes AGAIN)
```

Executed counterexample: raw attack 10 + strength 100 → finalized attack 70
→ turn recompute attack 130 with zero battle buffs. Attribute-derived
bonuses apply twice (bounded snapshot re-derivation, not unbounded
accumulation).

**AR-05 (P1, confidence 100):** `TurnBattleAdapter.ts:42` copies
`entity.stats.speed` into `participant.speed`; `TurnBattleSystem.ts:743`
recomputes only `entity.stats`; gauge (`ActionGauge.ts:16`) and order
preview (`TurnOrderPreview.ts` clone) read `participant.speed`. A +100%
speed buff yields stats speed 200 but gauge increment 100 — queue is a
stale copy without a refresh contract. Boss enrage content
(`data/buff/buffs.ts` speed percent entries) is affected.

## 2. Invariant

1. Attribute derivation (strength→attack, dexterity→speed/accuracy/evasion/
   crit, intelligence→crit-damage/ailment-resist, vitality→maxHp/regen,
   per `deriveAttributeModifiers`) runs **exactly once** on the path from
   authored input to battle stats.
2. Temporary battle modifiers (turn buffs) apply **on top of** the resolved
   base; they never re-trigger attribute derivation.
3. Queue pacing and order preview consume the **same effective speed** the
   combat stats own.
4. Product intent (user, 2026-09-08): the 5 base attributes change ONLY
   through realm attribute-point allocation (`allocateAttributePoint`
   writes `baseStats[stat]`) and permanent pills (`pill-permanent:*`
   modifiers). Combat buffs never touch raw attributes — verified: no
   statModifier in `data/buff/buffs.ts` or talent data targets the 5
   attributes; only static equipment/talent/pill modifiers do.

## 3. Semantic layers (target)

```text
Raw attributes  = baseStats (5 attributes + authored combat numbers)
                  + persistent static modifiers (pill/talent/equipment)
        ↓ calculateStats()  — formula authority, 2-pass WITH attribute derivation
Resolved base   = one snapshot per entity construction (player.finalStats;
                  enemy EnemyStatInput normalization — already resolved)
        ↓ calculateEffectiveStats()  — NEW: 1 pass, NO attribute derivation
Effective battle stats = Resolved + temporary battle modifiers (turn buffs)
```

No new nominal types in this mission. The boundary is enforced by which
function each consumer calls, plus the engine contract that
`CombatEntity.baseStats` must hold the RESOLVED base (see §6).

## 4. Ownership

| Rule | Owner |
|---|---|
| Stat formulas + attribute derivation | `StatCalculator` (unchanged authority) |
| Effective-stats composition (resolved base + temp modifiers) | `StatCalculator.calculateEffectiveStats` (new primitive, same file) |
| Turn-buff → StatModifier folding | `TurnStatsRecompute` (keeps role, migrates to new primitive) |
| Effective speed consumed by gauge/queue/preview | effective combat stats (`entity.stats.speed`); `participant.speed` is a synced read-only cache |
| Gauge state | ActionGauge/TurnQueue (unchanged) |

## 5. Existing primitives reused

- `runPipeline` (StatCalculator) — the 1-pass fold.
- `recomputeEffectiveStats`'s modifier collection (`collectStatModifiers`)
  — unchanged.
- `TurnOrderPreview.cloneGaugeActor` — clones participant, so a synced
  `speed` is automatically correct for preview.

## 6. Changes

1. **`core/stats/StatCalculator.ts`** — add
   `calculateEffectiveStats(resolvedBase: Stats, tempModifiers: StatModifier[]): Stats`
   implemented as `runPipeline(resolvedBase, tempModifiers)` (no
   attribute pass). Export a doc comment stating the input contract: the
   first argument must already be attribute-resolved output of
   `calculateStats` (or equivalent normalized enemy stats).
2. **`core/battle/turn/TurnStatsRecompute.ts`** — call
   `calculateEffectiveStats(resolvedBase, modifiers)`; at the call site
   (`TurnBattleSystem.ts:743`) pass `actor.entity.baseStats` directly and
   drop the `?? actor.entity.stats` fallback (contract: baseStats is
   always present on battle entities; the fallback hid a contract hole).
3. **`core/battle/turn/TurnBattleSystem.ts`** —
   - at the recompute site (turn start, before action selection): after
     `actor.entity.stats = recomputeEffectiveStats(...)`, sync
     `actor.speed = actor.entity.stats.speed`;
   - in `tickPacing`/`peekNextActor` gauge-step loop: sync each living
     participant's `speed` from `entity.stats.speed` before
     `advanceGauge`, so mid-battle buff application/expiry applied during
     a previous actor's turn is reflected at the next pacing step.
4. **`core/game/TurnBattleAdapter.ts`** — comment-only: document
   `participant.speed` as a synced cache of effective stats, refreshed by
   the engine (AR-05 contract), not an independent authority.
5. **Tests** — see §8.

## 7. Real consumers / migration boundary

Production chain exercised (not handcrafted fixtures alone):
`stores/player.ts finalStats → useBattleActions.startBattle →
GameManager.startStage → playerToCombatEntity → TurnBattleAdapter
.toTurnBattleParticipant → TurnBattleSystem (recompute → gauge → order
preview)`. Enemy path: `EnemyStatInput` normalization →
`enemyToCombatEntity` → same adapter/engine.

Out-of-battle `finalStats` consumers (UI panels, tribulation) keep calling
`calculateStats`-based `finalStats` — unchanged behavior, still correct:
they need the Resolved layer, which is what they already get.

## 8. Verification strategy

1. **Characterization-first regression tests** (`TurnStatsRecompute` +
   engine integration):
   - probe: raw attack 10/strength 100 → resolved 70 → effective WITH a
     +X% attack buff equals 70-folded-once + buff, NOT 130;
   - effective speed: +100% speed buff → `participant.speed` becomes 2×
     after the next pacing step; gauge increments at the new rate;
     order preview (`peekUpcomingActors`) reflects new speed;
   - buff expiry → next turn start → recompute → speed/stat restoration;
   - survive-regression guard: existing R1 suite stays green.
2. **P3 full** (touches combat core = broad shared infrastructure).
3. **P4 adversarial QA quick**; P5 code review post-simplify.
4. **P13**: engine call sites are the same `GameManager.update()` driving
   path; no wiring change. P14: deferred per isolated-worktree exception
   unless merge-time browser check is run.

## 9. Intentional behavior change (disclosed)

In-battle attribute-derived stats drop from double-applied to single
(e.g. the 10→70→130 probe becomes 10→70→70+buffs). Per roadmap Must-NOT:
no rebalancing to preserve the accidentally doubled numbers. Damage
numbers in battles may be lower than the pre-fix builds — this restores
authored intent (equipment/talent/pill percentages already counted the
attribute-derived contribution once at the Resolved layer).

## 10. Explicitly out of scope

- Introducing 3 nominal `Stats` types (touches every consumer; YAGNI).
- Rebalance of any authored enemy/quest/skill numbers.
- Rewriting the modifier system or `StatModifier` shape.
- Legacy BuffSystem/buff-pool cleanup (R4).
- AR-04 (critical policy) / AR-06 (DoT source) — later missions.
- Old development save migration (E8).

## 11. Completion gate

- Attribute derivation exactly once on the real chain (integration test
  evidence, not fixtures alone).
- Gauge + order preview consume effective speed (test with real buff
  apply/expiry through the engine).
- Full suite green; no competing effective-stat computation left
  (`recomputeEffectiveStats` is the only in-battle path and it uses the
  new primitive).
- Roadmap R2 status + QA doc updated.
