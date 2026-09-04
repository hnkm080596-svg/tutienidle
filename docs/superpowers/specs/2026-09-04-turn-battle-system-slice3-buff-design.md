# Turn Battle System — Slice 3: Buff / Reaction / Zone-as-dot — Design Spec

Date: 2026-09-04
Status: Approved (design), plan not yet written

## 1. Motivation

Slice 2 (design approved, plan written, not yet executed) gives every
combatant 3 fixed skill roles resolving pure damage only — buff/debuff
application was explicitly deferred. `TurnBuffSystem`/`TurnBuffPool`/
`TurnBuffTypes` (`game/src/core/battle/turn/`) already exist, fully
built and merged as a Milestone 1 Foundation primitive (not just
planned, as earlier roadmap entries assumed) — `apply()`/`update()`/
`isStunned()`/`isFrozen()`, duration measured in turns, verbatim-ported
from live `BuffSystem.ts`'s stack/refresh/replace/convert logic. This
slice wires that primitive into `TurnBattleSystem`, and separately
folds in the already-locked "HazardZoneSystem reversal" decision: Lava
Zone/Sword Zone (positional, real-time) become a `dot` buff applied
directly to the AOE-shape-selected target set at cast time — no
`TurnHazardZoneSystem` is built, matching the roadmap's standing
decision.

## 2. Survey Finding: Damage Model Conflict (resolved)

Live `HazardZoneSystem.spawnLavaZone()`/`spawnSwordZone()` receive an
already-computed `damagePerTick` number — the caller (`ReactionManager`
for Lava Zone's "Dung Nham" reaction, `SkillEffectResolver` for Sword
Zone's Kiếm Trận keystone) has its own formula and hands over a final
number. `TurnBuffSystem`'s `TurnDotEffectTemplate` instead carries a
`dpsRatio` — `calculateDamagePerTurn()` computes the actual number
itself, every time `apply()` runs, from the source's `attack`/elemental
power × `dpsRatio` (plus armor/resistance mitigation, `ailmentPotencyPercent`,
Kim Thế multiplier, etc. — ported verbatim from live `BuffSystem.ts`).

**Decision (locked, 2026-09-04): keep `dpsRatio` as the only model.**
`TurnBuffSystem` is not modified. Any future content migration (Dung
Nham reaction, Kiếm Trận zone) must convert its existing
already-computed-number formula into an equivalent `dpsRatio` at
migration time — not part of this slice (see §5). This keeps every dot
buff in the turn-based engine consistent (elemental/burn/poison content
and former-zone content all go through the same `dpsRatio` path), and
avoids reopening a file (`TurnBuffSystem.ts`) that is already merged
and tested.

## 3. Scope

**In scope:**
- Each `TurnBattleParticipant` gets its own `buffs: TurnBuffPool`
  (mirrors live `Battle.playerBuffs`/`enemyBuffs`, one pool per
  combatant — not shared).
- `TurnSkillDefinition` (Slice 2) gains an optional
  `appliesBuff?: { definitionId: string; target: 'self' | 'target' }`
  — after a skill successfully hits (Slice 2's existing hit-resolution
  path), if this field is set, `TurnBuffSystem.apply()` is called
  against the resolved buff definition (looked up from a
  `TurnBuffRegistry`), targeting either the caster (`'self'`) or each
  entity the skill actually hit (`'target'`).
- Buff **tick timing**: `TurnBuffSystem.update()` runs at the START of
  the buff-holder's OWN turn — before `tickCooldowns()`/`selectAction()`
  in `resolveNextStep()` — matching this rework's standing "tick at the
  holder's own turn" convention (already used identically by the live
  `TurnBuffSystem.update()`'s per-buff `continuousTurns` semantics).
- **CC block**: after ticking buffs, if the acting participant is
  `isStunned()` or `isFrozen()`, they skip their action for this turn
  (gauge still consumes, `resolveNextStep()` still returns a result,
  but no skill/damage resolves) — both checks are already implemented
  methods on `TurnBuffSystem`, this slice only wires the call site.
- **Zone-as-dot**: no new mechanism needed beyond the above — a former
  "Lava Zone"/"Sword Zone" cast is simply a skill whose `targeting`
  selects an AOE cell set (Slice 2's `collectTurnTargets()`) and whose
  `appliesBuff` points at a `dot`-effect `TurnBuffDefinition`. This
  slice proves that shape with a fixture skill/buff pair — it does not
  migrate the real Dung Nham/Kiếm Trận content (§5).
- A `TurnBuffRegistry` implementation sufficient for tests (in-memory
  map of fixture `TurnBuffDefinition`s), needed because `apply()`'s
  stack-mode `'stack'`-with-`convertsToId` path and `update()`'s
  convert-on-`convertsAfterContinuousTurns` path both take an optional
  `registry` argument.

**Explicitly out of scope (deferred, tracked in roadmap):**
- `TurnStatModifierEffect` application — applying a stat-modifier buff
  requires a stats recompute pass (base stats + active modifiers →
  effective stats), which `TurnBattleSystem` doesn't have yet (live
  `BattleSystem.ts`'s `updateStatModifiers()` equivalent is real,
  nontrivial work). This slice only wires `dot` and `cc` effect types;
  `statModifier`/`onHitProc` effect types are not exercised even though
  `TurnBuffTypes.ts` already defines them.
- Real content migration: converting the actual Dung Nham reaction
  formula and Kiếm Trận zone formula into `dpsRatio`-based
  `TurnBuffDefinition`s, and moving `ReactionManager.ts`/
  `SkillEffectResolver.ts`'s real call sites off `HazardZoneSystem`.
  Tests in this slice use fixture skills/buffs exactly like Slice 2.
- `TurnBuffSystem.getActiveModifiers()`/`rollOnHitEffects()`/
  `getStacks()` — these were already excluded from the original
  TurnBuffSystem plan and remain unbuilt; not needed since
  `statModifier`/`onHitProc` stay out of scope here too.
- Any change to `BattleSystem.ts`, `HazardZoneSystem.ts`,
  `ReactionManager.ts`, `SkillEffectResolver.ts`, or `GameManager.ts`.

## 4. What This Slice Proves

A skill cast in `TurnBattleSystem` can apply a real turn-based dot/CC
buff to its target set (single or AOE), the buff ticks damage and
duration correctly at its holder's own turn, and CC effects correctly
block the holder's next action — closing the loop the "HazardZoneSystem
reversal" decision opened (zones are just dot buffs on a cast-time
target set, no positional zone entity needed).

## 5. Roadmap Note (to be copied into the roadmap doc)

- **dpsRatio conversion for real content** (Dung Nham reaction, Kiếm
  Trận zone) — deferred, needed before `ReactionManager.ts`/
  `SkillEffectResolver.ts` can actually cut over off `HazardZoneSystem`.
- **TurnStatModifierEffect application** (stats recompute pass for
  `TurnBattleSystem`) — deferred, real work comparable in size to a
  slice of its own; not attempted here.
