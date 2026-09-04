# Turn-Based Combat — Completion (Slice 6 Cutover + Full System Migration) — Design Spec

Date: 2026-09-04
Status: Approved (design)

## 1. Motivation

Milestone 1 (Foundation) and Milestone 2's Slice 1-5, AOE Shape
extension, `TurnBuffSystem`, `WaveSpawnTrigger`, and the full Stat
System conversion (`attackSpeed`→`speed`, `hpRegenPerSecond`→
`hpRegenPerTurn`, `cooldownReduction`/`castSpeedPercent`/
`movementSpeed` retired) are all merged to master
([roadmap](../../game/docs/turn-based-combat-roadmap.md)). Combat
Fairness Guards (Bá Thể + Sudden Death,
[spec](2026-09-04-combat-fairness-guards-design.md)) is in progress
separately and out of scope here.

**Per explicit user instruction (2026-09-04)**, this spec consolidates
**everything else remaining** to finish the rework into one document —
a deliberate, one-time departure from this session's otherwise-strict
"one spec/plan per system" convention. Excluded (still get their own
future specs, unchanged): Party/companion system, Pháp Tu Reaction
Path (book mechanic + situational AI), Node Tree/Element Slot redesign,
Gauge-delta buff effect type, Channel skill support
(`chargeSteps`/Bạt Kiếm Thuật).

This spec does not re-derive decisions already locked in prior specs —
it cites them and adds the survey needed to close remaining gaps.

## 2. Scope Map

| # | Item | Status going in | Prior spec |
|---|---|---|---|
| A | Slice 6 content prerequisites (basic-attack mapping 8 builds, enemy mapping, wave spawn content) | Not started | [Slice 6 design](2026-09-04-turn-battle-system-slice6-gamemanager-cutover-design.md) §4 |
| B | Slice 6 cutover itself (GameManager flip, retire `BattleSystem.ts`/`HazardZoneSystem.ts`/`UltimateSystem.ts`, rewrite test files) | Blocked on A | Same, §2-4 |
| C | Slice 7 Manual UI (3-button tap-cast + turn-order preview + battle log) | Design exists, needs updating | [Slice 7 design](2026-09-04-turn-battle-system-slice7-manual-ui-design.md) + [Deep Review §5](../../game/docs/turn-based-combat-roadmap.md) |
| D | Battle-speed-toggle (x1/x2/x4) | Not designed | [Deep Review §7](../../game/docs/turn-based-combat-roadmap.md) |
| E | BuffSystem completion (port 4 remaining methods, migrate real content, rebalance, presentation) | Not started | Roadmap rows 47-50 |
| F | ReactionManager/SkillEffectResolver turn-based conversion | Surveyed this session | §6 below |
| G | Stats-recompute pass (`TurnStatModifierEffect`/`TurnOnHitProcEffect`) | Surveyed this session | §7 below |
| H | dpsRatio real content (Dung Nham, Kiếm Trận) | Partially surveyed | §7 below |
| I | `hpRegenPerTurn` wiring | Not started | [Stat System spec](2026-09-04-stat-system-turn-based-conversion-design.md) §6 |
| J | ~~3 buffs pairing `movementSpeed`+`attackSpeed`~~ | **Already done** — see §3 | — |
| K | Multi-target death-mid-resolution hardening | Surveyed, fix point known | [Deep Review §3](../../game/docs/turn-based-combat-roadmap.md) |

## 3. Correction: item J is already done

The Stat System conversion's Task 6 (compiler-navigated fixup) already
stripped `movementSpeed` from all 3 haste/slow buffs and every other
live call site as a side effect of keeping the build green — verified
this session (`grep movementSpeed` across `game/` now only matches
comments, test files, docs, and `StatLabels.ts`; `buffs.ts` has zero
matches). **This item is removed from the plan** and the roadmap's
"Ngoài phạm vi" row for it should be marked done, not carried forward.

## 4. Two roadmap corrections found this session

- **`SkillEffectResolver.ts`'s `grantsSwordZone`** (roadmap row 52)
  does not exist — the field is `SkillEffect.grantsSwordZone`
  (`game/src/core/skill/SkillEffect.ts:171`), consumed by
  `SkillEffectSystem.ts:190`, not `SkillEffectResolver.ts`. Item F's
  plan tasks target the correct file.
- **`BattleSystem.*.test.ts` count is 27, not ~16** (the number
  carried in the roadmap since Slice 6's original design spec) —
  `game/src/core/battle/*.test.ts` glob confirms 27 files. Item B's
  rewrite task scopes against the real count.

## 5. Item A — Slice 6 Content Prerequisites

### 5.1 Basic-attack mapping, 8 builds

Confirmed so far (`game/src/data/skill/Skills.ts`):
- Kiếm Tu basic: `tram` ("Huy Kiếm", `Skills.ts:80-88`, `resourceType: 'none'`, no cooldown).
- 5 Pháp Tu Thuần elements' basic = first entry of each element's `CHAIN_SKILL_IDS` chain (`Skills.ts:2287-2293`): Hỏa=`hoa_cau_thuat`(140), Thủy=`thuy_tien_thuat`(374), Mộc=`doc_chuong`(319), Kim=`diem_kim_thuat`(450), Thổ=`tho_cau_thuat`(532) — all single-component elemental skills.

**Not yet found**: Thể Tu's and Phàm Nhân's basic-attack skill ids —
a targeted grep for `buildTag`/`the_tu`/`pham_nhan` in `Skills.ts`
returned no matches this session, meaning either they use a different
naming convention or a generic (non-`Skill`-object) attack path. **This
is the plan's first task** — a real grep/read pass, not a guess (same
"survey before code" pattern the Stat System plan's Task 1 used for its
~76-file inventory).

Each mapped basic attack becomes a `TurnSkillDefinition` (id,
`cooldownTurns: 0`, `resourceType`/`resourceCost` if any,
`damage: ActionDamageInfo` derived from the skill's `components`,
`targeting`) — a straight field copy, per Slice 2's spec §3 ("real
content mapping is not a redesign").

### 5.2 Enemy content mapping

66 enemies exist in `Enemies.ts`. `EnemySpecialAttack[]`
(`Enemies.ts:1469`) is authored on very few enemies — only one
concrete non-boss example found this session (`Enemies.ts:1764`,
`everyNth`/`damageMultiplier`/`presetId` shape). Most enemies have NO
`specialAttacks` at all, meaning **most enemies only need a basic
attack mapped** (their `attack` stat drives a generic melee hit today)
— the `specialAttacks[]`→special/ultimate mapping only applies to the
minority that author it. Bosses (e.g. `foundation_floor_10`,
`Enemies.ts:1401-1444`) use `TribulationPhase[]` instead, which per
the Deep Review decision (roadmap Deep Review §2) does **not** migrate
to a phase-system — boss "specialness" becomes hand-designed buff
content later, separately, not part of this spec's basic-attack
mapping pass.

**Enemy `speed`**: no enemy authors a base `speed` value today —
`EnemyStatInput.ts:109` still derives it from a legacy `attackSpeed`
input field via `normalizeEnemyAttackSpeed()`. This function's output
needs verifying it produces sensible values against the new
`speed = 100 + dexterity×0.15` player-side anchor (Stat System spec §4)
— enemies don't have a `dexterity` stat driving `speed` the way players
do, so `normalizeEnemyAttackSpeed()`'s target range needs checking
against the ~100-baseline convention, not assumed compatible by default.

### 5.3 Real wave/stage spawn content

`StageWaveSystem.pickEnemyForSpawn(stage: Stage, isFinalSpawn: boolean): Enemy | undefined`
(`StageWaveSystem.ts:248-292`) already has the real logic Slice 5's
`spawnEnemy` factory needs to wrap: boss-at-floor-10 shortcut → pool
roll (`pickNextEnemyEntry`) → elite-chance roll → hidden-beast
replace-roll (Qi Refining only) → stage realm override. The Slice 6
cutover's real `spawnEnemy` factory is a thin adapter: call
`pickEnemyForSpawn()`, convert the returned `Enemy` through the new
`toTurnBattleParticipant()` adapter (already scoped in Slice 6's
design spec §4) using its by-then-mapped basic attack (§5.1/5.2).

## 6. Item F — ReactionManager/SkillEffectResolver Conversion

### 6.1 Lava Zone (`ReactionManager.ts`)

`ReactionManager.ts:55` declares an injected `spawnLavaZone?` callback;
the call site (`:189-195`) reads `reaction.spawnsLavaZone` (static data
on `ElementReactionDefinition`) and invokes the callback with
`{ownerId, row, column, ...reaction.spawnsLavaZone}` — **it does not
read/write `BuffSystem`/`BuffPool` at this call site** (debuff
application happens earlier in the same function, separately). Per the
already-locked "reverse HazardZoneSystem" decision (roadmap row 53):
this call site's conversion is swapping the `spawnLavaZone(...)` call
for a `TurnBuffSystem.apply(dotDefinition, ...)` call against the
already-collected AOE target set — the zone's positional persistence
becomes an upfront DoT application at cast time, no separate zone
entity. `HazardZoneSystem.ts`/`LavaZone.ts` stay untouched until this
call site actually flips (a data/wiring change, not new engine
primitives — everything it needs already exists post-Slice 3).

### 6.2 Sword Zone (`SkillEffectSystem.ts`, not `SkillEffectResolver.ts` — see §4)

`SkillEffect.grantsSwordZone` (`SkillEffect.ts:171`), consumed at
`SkillEffectSystem.ts:190` (`if (target.alive && (effect.grantsSwordZone || effect.grantsZone) && ctx.spawnSwordZone) {...}`),
authored per-skill (e.g. `Skills.ts:56`,
`grantsSwordZone: true, swordZoneCharges: 3, swordZoneDamageRatio: 0.3`).
Same conversion shape as §6.1 — `ctx.spawnSwordZone(...)` becomes a
`TurnBuffSystem.apply(dotDefinition, ...)` call, `swordZoneDamageRatio`
becomes the `dot` effect's `dpsRatio` (needs the real formula
conversion from §7.2 first).

## 7. Items G/H — Stats Recompute + dpsRatio Real Content

### 7.1 Stats recompute (`TurnStatModifierEffect`/`TurnOnHitProcEffect`)

Confirmed unused: `TurnBuffTypes.ts:12-17`
(`TurnStatModifierEffect {type:'statModifier', stat: StatType, percent?, flat?}`)
and `:34-38` (`TurnOnHitProcEffect {type:'onHitProc', chance, appliesBuffId}`)
exist in the effect union but nothing in `TurnBattleSystem.ts` branches
on them. The live equivalent mechanism is `StatCalculator.ts:276-282`
`calculateStats(baseStats: Stats, modifiers: StatModifier[]): Stats` —
a 2-pass pipeline (base modifiers, then attribute-derived modifiers)
that `BuffSystem.getActiveModifiers()` (`BuffSystem.ts:336-356`) feeds
live. **Design**: a new pure function
`recomputeEffectiveStats(baseStats: Stats, buffs: TurnBuffPool): Stats`
collects every active `TurnStatModifierEffect` across a participant's
buff pool into a `StatModifier[]`, then calls the SAME already-live
`calculateStats()` (read-only reuse, no duplicate formula) — called
once per participant at the start of `resolveActorTurn()` (or
equivalent), replacing `entity.stats` with the recomputed result before
action selection/damage resolution for that turn. `onHitProc` fires at
the hit-resolution point (after `resolveActionHit()` succeeds), rolling
`effect.chance` and applying `effect.appliesBuffId` via
`TurnBuffSystem.apply()` on a hit — mirrors `BuffSystem.rollOnHitEffects()`'s
existing live shape (`BuffSystem.ts:383`).

### 7.2 dpsRatio real content

Neither `LavaZone.ts` nor `SwordZone.ts` contain a static dps-ratio
formula — both only declare the runtime shape (`damagePerTick: number`
on `SwordZone.ts:44`). The actual formula is computed at spawn time,
almost certainly inside `BattleSystem.ts`'s `spawnLavaZone`/
`spawnSwordZone` methods (referenced in `SwordZone.ts`/
`HazardZoneSystem.ts`'s comments but not located this session — **the
plan's first task for this item is locating and reading those two
methods**, not guessing the formula).

## 8. Item I — `hpRegenPerTurn` Wiring

No call site exists in `TurnBattleSystem.ts` today (Slice 4's
`ResourceTurnHook` wiring is generic/fixture-only, not HP-specific per
the Stat System spec §6). Design: at the same "holder's own turn" tick
point Slice 3/4 established for buffs/resources
(`actorBuffSystem.update()`/`applyTurnStartDeltas()`'s call site in
`resolveActorTurn()`), add one more line applying
`actor.entity.stats.hpRegenPerTurn` directly to `actor.entity.currentHp`
(clamped to `maxHp`) — the simplest possible integration, no new
primitive needed (unlike Slice 4's resource pools, HP regen has no
"pool" abstraction to build, it's a single stat already computed by the
Stat System conversion).

## 9. Item K — Multi-Target Death-Mid-Resolution Hardening

Confirmed insertion point: `TurnBattleSystem.ts`'s hit-resolution loop
(around line 199-202 as of this session — verify exact line at
plan-execution time, the file has moved since Combat Fairness Guards'
changes may have landed):

```typescript
for (const target of affected) {
  this.combat.resolveActionHit(actor.entity, target.entity, scaledDamage)
  targetIds.push(target.id)
}
```

Fix: `if (!target.entity.alive) continue` at the top of this loop —
prevents a target killed by an earlier hit within the same
multi-target skill resolution from receiving further hits (overkill,
double kill-trigger fire). One-line fix, needs 1-2 test cases proving
an AOE skill that kills its first target mid-resolution doesn't apply
a second hit to the already-dead entity.

## 10. Item C — Slice 7 Update (Turn-Order Preview + Battle Log)

Per the Deep Review's approved decision (roadmap Deep Review §5),
Slice 7's scope grows beyond the original 3-button tap-cast design:

- **`peekNextActor()`/`resolveActorTurn()` split**: confirmed NOT yet
  implemented (`resolveNextStep` still monolithic — grep for
  `peekNextActor`/`resolveActorTurn` in `TurnBattleSystem.ts` returns
  zero matches as of this session). This split is still the core
  architecture change Slice 7's original spec locked (§2 of that spec)
  — unchanged by this consolidation, just confirming it's still
  greenfield.
- **Turn-order preview**: a new `peekUpcomingActors(battle, count: number): TurnBattleParticipant[]`
  — runs the same gauge-advancement math as `peekNextActor()` on a
  **cloned** battle state (never mutates the real `battle` object) N
  times, collecting each resolved actor without applying any real
  effects. Approximate by nature (a stun/buff landing before an actor's
  real turn can invalidate the preview) — acceptable per the Deep
  Review's note that 100% accuracy isn't required.
- **Battle log**: a new append-only array on `TurnBattle` (or a
  side-channel the UI subscribes to) recording one entry per
  `resolveActorTurn()` call: `{turn: number, actorId, skillId,
  targetIds, ccBlocked, damageDealt?}` — UI-consumed only, no gameplay
  effect. Exact UI component design (where it renders) is deferred to
  Slice 7's plan-writing time, this spec only locks the data shape.

## 11. Item D — Battle-Speed-Toggle

Confirmed wanted back (Deep Review §7), explicitly scheduled for
**after** Slice 6 lands (needs `TurnBattleSystem` to be the real
combat driver first). Design left minimal since turn resolution is
already instant/synchronous per step: a `battleSpeedMultiplier: 1|2|4`
setting (mirroring the old, removed `SpeedSettings.ts` shape) controls
how many `resolveNextStep()`/`resolveActorTurn()` calls
`GameManager.updateBattleFixedStep()` makes per real-time tick, not a
formula change — matches the roadmap's standing "Auto is the same
engine running faster" principle exactly. No further design needed
until Slice 6's real `updateBattleFixedStep()` replacement exists to
attach this to.

## 12. Item E — BuffSystem Completion

- **Port remaining methods** (`getActiveModifiers()`, `isRooted()`,
  `rollOnHitEffects()`, `getStacks()` — real signatures confirmed
  §7.1/`BuffSystem.ts:336-397`) into `TurnBuffSystem.ts`, verbatim port
  matching the pattern already used for `apply`/`update`/`isStunned`/
  `isFrozen` (turn-based field renames only, same logic) — `getActiveModifiers()`
  is exactly what §7.1's stats-recompute needs, so this port is a
  prerequisite for item G, not independent busywork.
- **Real content migration**: `buffs.ts` has 47 `BuffDefinition`
  entries (`BuffDefinition.ts:9-24` shape) to convert to
  `TurnBuffDefinition` — same shape minus seconds-to-turns field
  renames (`duration`→turns, `convertsAfterContinuousSeconds`→
  `convertsAfterContinuousTurns`), matching the already-proven
  `TurnBuffSystem` port convention. Numbers stay the same (X giây → X
  lượt), no rebalance, per the standing policy.
- **Presentation**: `combat-vfx-spawner.ts:151/197`
  (`durationSeconds`) and `combat-status-tooltip.ts:22/90`
  (`` `${remainingTime}s` ``) need turn-based display variants once
  `TurnBuffSystem` content is actually on screen (Slice 6/7-dependent,
  not buildable standalone before those land).

## 13. Sequencing

This spec's items have real dependencies on each other, not a free
order:

1. **Item A** (content survey + mapping) — no dependencies, can start
   immediately.
2. **Item E's method port** (prerequisite for G) — no dependencies,
   can start immediately, parallel to A.
3. **Item G** (stats recompute) — depends on E's `getActiveModifiers()`
   port.
4. **Item K** (multi-target hardening) — no dependencies, can start
   immediately, parallel to A/E.
5. **Item I** (`hpRegenPerTurn`) — no dependencies beyond already-merged
   Slice 3/4, can start immediately.
6. **Item B** (Slice 6 cutover) — depends on A being complete (content
   must exist before `GameManager` can route real battles through it).
7. **Item F** (Reaction/SkillEffect conversion) — depends on H's real
   dpsRatio formulas being found, and ideally B (so the new call sites
   land in the already-cutover engine, not dual-written).
8. **Item H** (dpsRatio survey) — no dependencies, can start
   immediately, blocks F.
9. **Item C** (Slice 7) — depends on B (needs the post-cutover
   `GameManager` contract, per Slice 7's original spec §depends-on).
10. **Item D** (speed-toggle) — depends on B.

## 14. What This Spec Does Not Cover

Party/companion, Pháp Tu Reaction Path, Node Tree redesign, Gauge-delta
buff effect type, Channel skill support — all explicitly excluded per
user instruction, each keeps its own future spec.
