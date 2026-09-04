# Turn-Based Combat — Completion (Slice 6 Cutover + Full System Migration) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the turn-based combat rework: map real content onto the engine, flip `GameManager` off the real-time `BattleSystem.ts` for good, and complete every supporting system (BuffSystem, ReactionManager/SkillEffectSystem, stats-recompute, manual UI, speed-toggle) needed for full parity.

**Architecture:** 14 tasks across 6 phases, ordered by real dependency (see spec §13). Phases 1-2 are independent hardening/completion work on the already-merged `TurnBattleSystem`/`TurnBuffSystem`. Phase 3 is pure survey (no code) to close the remaining content-mapping unknowns. Phase 4 wires the surveyed content into `ReactionManager`/`SkillEffectSystem`. Phase 5 is the actual `GameManager` cutover — the point of no return, retiring `BattleSystem.ts`. Phase 6 builds on the post-cutover contract (manual UI, speed toggle, buff presentation).

**Tech Stack:** TypeScript, Vitest, Vue 3.

**Spec:** `docs/superpowers/specs/2026-09-04-turn-based-combat-completion-design.md`

**Also required reading before Phase 5 (Task 9-10):**
`docs/superpowers/specs/2026-09-04-turn-battle-system-slice6-gamemanager-cutover-design.md`
(the original Slice 6 design — this plan implements it, does not replace it)
and `docs/superpowers/specs/2026-09-04-gamemanager-external-contract-survey.md`
(exact current `GameManager` call sites).

**Also required reading before Phase 6 (Task 11-12):**
`docs/superpowers/specs/2026-09-04-turn-battle-system-slice7-manual-ui-design.md`.

## Global Constraints

- No `any` types.
- No rebalance — every seconds→turns or real-time→turn-based numeric
  conversion in this plan keeps the exact same number (per the
  standing "no rebalance, unit-swap only" policy), except where a
  prior spec already locked a deliberate rescale (the Stat System's
  `speed` formula — already merged, not touched here).
- Do not modify `docs/superpowers/plans/2026-09-04-combat-fairness-guards.md`'s
  in-progress work or the files it's touching — that work is separate
  and concurrent.
- Party/companion, Pháp Tu Reaction Path, Node Tree redesign,
  Gauge-delta buff effect type, and Channel skill support are OUT OF
  SCOPE — do not implement any of them even if a task here seems
  adjacent to one.
- Run `npx vitest run` and `npx vue-tsc --noEmit` (or the project's
  documented typecheck script) after every task, not just at the end —
  this plan touches enough surface area that catching regressions
  early, per-task, is cheaper than a single end-of-plan sweep.

---

# Phase 1 — Independent hardening/completion (no dependencies)

### Task 1: Multi-target death-mid-resolution hardening

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts`
- Test: `game/src/core/battle/turn/TurnBattleSystem.test.ts`

**Interfaces:**
- Consumes: the existing hit-resolution loop over `affected` (from `collectTurnTargets`).
- Produces: nothing new for later tasks — self-contained fix.

- [ ] **Step 1: Read the current hit-resolution loop**

Open `game/src/core/battle/turn/TurnBattleSystem.ts` and find the loop
resolving hits over `affected` (was at lines ~199-202 as of this
plan's writing, but Combat Fairness Guards' concurrent work may have
shifted it — search for `resolveActionHit(actor.entity, target.entity,`
to find the current location).

- [ ] **Step 2: Write the failing test**

Append to `TurnBattleSystem.test.ts`:

```typescript
describe('TurnBattleSystem multi-target death-mid-resolution hardening', () => {
  it('does not apply a second hit to a target already killed by an earlier hit in the same AOE skill', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      row: 4,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999999 },
    })
    const enemyA = createCombatant({
      id: 'enemyA',
      row: 4,
      x: 1,
      currentHp: 1,
      maxHp: 1,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })
    const enemyB = createCombatant({
      id: 'enemyB',
      row: 4,
      x: 2,
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 10, 0)
    playerParticipant.basic = {
      id: 'fixture_aoe_basic',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'row' },
    }

    const battle: TurnBattle = {
      player: playerParticipant,
      enemies: [makeParticipant('enemyA', enemyA, 10, 1), makeParticipant('enemyB', enemyB, 10, 2)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const step = system.resolveNextStep(battle)

    // enemyA dies from the overkill hit but must not go negative in a way
    // that indicates it was hit twice (currentHp floors at 0, not tracked
    // here directly — the real assertion is on targetIds/event count below).
    expect(enemyA.currentHp).toBe(0)
    expect(enemyA.alive).toBe(false)
    // Both were in the AOE's collected target set, but only living targets
    // should actually receive resolveActionHit — enemyA must not appear
    // twice or cause a double state transition.
    expect(step.targetIds.filter((id) => id === 'enemyA')).toHaveLength(1)
  })
})
```

- [ ] **Step 3: Run test to verify it currently passes (single-hit-per-target case doesn't yet prove the bug)**

Run: `npx vitest run game/src/core/battle/turn/TurnBattleSystem.test.ts`

This specific test may already pass today since a single-pass AOE only
hits each target once by construction — the real bug only manifests
with a bounce/chain skill that can hit the same target more than once
across a skill's resolution, which doesn't exist yet in the engine.
**This step exists to confirm the fix is genuinely defensive** (guards
against a currently-nonexistent-but-future multi-hit-per-target skill
shape), not to chase a currently-failing assertion — do not force a
red bar artificially. Proceed to Step 4 regardless.

- [ ] **Step 4: Add the defensive check**

In the hit-resolution loop found in Step 1, add a guard at the top:

```typescript
        for (const target of affected) {
          if (!target.entity.alive) continue

          this.combat.resolveActionHit(actor.entity, target.entity, scaledDamage)
          targetIds.push(target.id)
        }
```

(Adjust the exact variable name for the damage argument —
`scaledDamage` if Combat Fairness Guards' Sudden Death task has already
landed, `action.damage` otherwise — match whatever the current code
reads.)

- [ ] **Step 5: Run tests, typecheck, commit**

Run: `npx vitest run game/src/core/battle/turn/` then `npx vue-tsc --noEmit`.
Expected: PASS, zero regressions.

```bash
git add game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnBattleSystem.test.ts
git commit -m "fix(turn-combat): skip already-dead targets mid multi-target resolution"
```

---

### Task 2: `hpRegenPerTurn` wiring

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts`
- Test: `game/src/core/battle/turn/TurnBattleSystem.test.ts`

**Interfaces:**
- Consumes: `actor.entity.stats.hpRegenPerTurn` (Stat System, already merged), the "holder's own turn" tick point already established by Slice 3/4 (buff tick / resource tick call site).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test**

```typescript
describe('TurnBattleSystem hpRegenPerTurn', () => {
  it("regenerates HP by the actor's hpRegenPerTurn stat at the start of their own turn, clamped to maxHp", () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      currentHp: 50,
      maxHp: 100,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0, hpRegenPerTurn: 10 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const battle: TurnBattle = {
      player: makeParticipant('player', player, 10, 0),
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    system.resolveNextStep(battle)

    expect(player.currentHp).toBe(60)
  })

  it('clamps regen to maxHp, never overhealing', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      currentHp: 95,
      maxHp: 100,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0, hpRegenPerTurn: 10 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const battle: TurnBattle = {
      player: makeParticipant('player', player, 10, 0),
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    system.resolveNextStep(battle)

    expect(player.currentHp).toBe(100)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run game/src/core/battle/turn/TurnBattleSystem.test.ts`
Expected: FAIL — HP stays at 50/95, regen never applied.

- [ ] **Step 3: Wire the regen tick**

At the same "holder's own turn" point Slice 3/4 already tick buffs/resources
(immediately after the buff tick, before the CC check), add:

```typescript
    if (actor.entity.stats.hpRegenPerTurn > 0) {
      actor.entity.currentHp = Math.min(actor.entity.maxHp, actor.entity.currentHp + actor.entity.stats.hpRegenPerTurn)
    }
```

- [ ] **Step 4: Run tests, typecheck, commit**

Run: `npx vitest run game/src/core/battle/turn/` then `npx vue-tsc --noEmit`.

```bash
git add game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnBattleSystem.test.ts
git commit -m "feat(turn-combat): wire hpRegenPerTurn at holder's own turn"
```

---

### Task 3: Port remaining `BuffSystem` methods into `TurnBuffSystem`

**Files:**
- Modify: `game/src/core/battle/turn/TurnBuffSystem.ts`
- Modify: `game/src/core/battle/turn/TurnBuffTypes.ts` (only if `getActiveModifiers`'s return type needs a turn-based `StatModifier`-equivalent import — check whether `StatModifier` from the live stat system is directly reusable before defining a new type)
- Test: `game/src/core/battle/turn/TurnBuffSystem.test.ts`

**Interfaces:**
- Consumes: live `BuffSystem.ts:336-397`'s real signatures (`getActiveModifiers(): StatModifier[]`, `isRooted(): boolean`, `rollOnHitEffects(source, target, registry)`, `getStacks(id, sourceId?): number`) as the porting reference — read that file's actual implementation before porting, do not guess the logic.
- Produces: `TurnBuffSystem.getActiveModifiers()`, `.isRooted()`, `.rollOnHitEffects()`, `.getStacks()` — `getActiveModifiers()` is consumed by Task 5 (stats recompute).

- [ ] **Step 1: Read the live implementations**

Read `game/src/core/buff/BuffSystem.ts` lines 336-397 in full (the 4
target methods) plus any private helpers they call, to have the exact
logic to port — do not port from memory or guesswork.

- [ ] **Step 2: Write failing tests for all 4 methods**

Following the exact pattern already used for `isStunned()`/`isFrozen()`
in `TurnBuffSystem.test.ts` (fixture buff definitions, `FixtureBuffRegistry`
if the live method needs registry access) — write one test per method
proving turn-based field names (`remainingTurns` not `remainingTime`)
are used correctly. Mirror the live `BuffSystem.test.ts`'s existing
test cases for these same 4 methods where they exist, adapted to turn
units.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run game/src/core/battle/turn/TurnBuffSystem.test.ts`
Expected: FAIL — methods don't exist yet.

- [ ] **Step 4: Port the 4 methods verbatim (turn-unit field renames only)**

Add to `TurnBuffSystem.ts`, following the exact logic read in Step 1,
with only the field renames already established by this file's
existing ported methods (`remainingTime`→`remainingTurns`,
`continuousSeconds`→`continuousTurns`, `damagePerSecond`→`damagePerTurn`).

- [ ] **Step 5: Run tests, typecheck, commit**

Run: `npx vitest run game/src/core/battle/turn/` then `npx vue-tsc --noEmit`.

```bash
git add game/src/core/battle/turn/TurnBuffSystem.ts game/src/core/battle/turn/TurnBuffTypes.ts game/src/core/battle/turn/TurnBuffSystem.test.ts
git commit -m "feat(turn-combat): port getActiveModifiers/isRooted/rollOnHitEffects/getStacks into TurnBuffSystem"
```

---

# Phase 2 — Stats recompute (depends on Task 3)

### Task 4: `recomputeEffectiveStats()` + wire `TurnStatModifierEffect`/`TurnOnHitProcEffect`

**Files:**
- Create: `game/src/core/battle/turn/TurnStatsRecompute.ts`
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts`
- Test: `game/src/core/battle/turn/TurnStatsRecompute.test.ts`
- Test: `game/src/core/battle/turn/TurnBattleSystem.test.ts`

**Interfaces:**
- Consumes: `TurnBuffSystem.getActiveModifiers()` (Task 3), `StatCalculator.calculateStats(baseStats, modifiers)` (live, read-only import — `game/src/core/stats/StatCalculator.ts:276-282`).
- Produces: `recomputeEffectiveStats(baseStats: Stats, buffs: TurnBuffPool): Stats` — not consumed by any later task in this plan, but available for future content wiring.

- [ ] **Step 1: Write the failing test for `recomputeEffectiveStats`**

```typescript
// game/src/core/battle/turn/TurnStatsRecompute.test.ts
import { describe, it, expect } from 'vitest'
import { recomputeEffectiveStats } from './TurnStatsRecompute'
import { TurnBuffPool } from './TurnBuffPool'
import { TurnBuffSystem } from './TurnBuffSystem'
import { createBaseStats } from '../../stats/StatBlock'
import type { TurnBuffDefinition, TurnBuffRegistry } from './TurnBuffTypes'

class FixtureBuffRegistry implements TurnBuffRegistry {
  private readonly definitions = new Map<string, TurnBuffDefinition>()
  constructor(definitions: TurnBuffDefinition[]) {
    for (const d of definitions) this.definitions.set(d.id, d)
  }
  get(id: string): TurnBuffDefinition {
    const d = this.definitions.get(id)
    if (!d) throw new Error(`fixture buff not found: ${id}`)
    return d
  }
}

const ATTACK_UP_DEFINITION: TurnBuffDefinition = {
  id: 'fixture_attack_up',
  name: 'Fixture Attack Up',
  polarity: 'buff',
  duration: 3,
  stackMode: 'refresh',
  effects: [{ type: 'statModifier', stat: 'attack', flat: 50 }],
}

describe('recomputeEffectiveStats', () => {
  it('folds active statModifier buff effects into the base stats via the live StatCalculator pipeline', () => {
    const base = { ...createBaseStats(), attack: 100 }
    const pool = new TurnBuffPool()
    const registry = new FixtureBuffRegistry([ATTACK_UP_DEFINITION])
    new TurnBuffSystem(pool).apply(ATTACK_UP_DEFINITION, /* dummy source/target CombatEntity stand-ins per existing fixture helpers */ undefined as never, undefined as never, registry)

    const effective = recomputeEffectiveStats(base, pool)

    expect(effective.attack).toBe(150)
  })

  it('returns base stats unchanged when no statModifier buffs are active', () => {
    const base = { ...createBaseStats(), attack: 100 }
    const pool = new TurnBuffPool()

    const effective = recomputeEffectiveStats(base, pool)

    expect(effective.attack).toBe(100)
  })
})
```

(The `apply()` call's `undefined as never` source/target placeholders
in the first test are a known rough edge — replace with real
`createCombatant(...)` fixtures matching this file's established
pattern once `TurnBuffSystem.apply()`'s exact source/target usage is
confirmed by reading it; adjust the test to whatever that method
actually requires.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run game/src/core/battle/turn/TurnStatsRecompute.test.ts`
Expected: FAIL — `TurnStatsRecompute.ts` doesn't exist yet.

- [ ] **Step 3: Implement `recomputeEffectiveStats`**

```typescript
// game/src/core/battle/turn/TurnStatsRecompute.ts
import type { Stats } from '../../stats/StatTypes'
import type { StatModifier } from '../../stats/StatModifier'
import { calculateStats } from '../../stats/StatCalculator'
import type { TurnBuffPool } from './TurnBuffPool'

export function recomputeEffectiveStats(baseStats: Stats, buffs: TurnBuffPool): Stats {
  const modifiers: StatModifier[] = collectStatModifiers(buffs)

  return calculateStats(baseStats, modifiers)
}

function collectStatModifiers(buffs: TurnBuffPool): StatModifier[] {
  const modifiers: StatModifier[] = []

  for (const buff of buffs.getAll()) {
    for (const effect of buff.effects) {
      if (effect.type === 'statModifier') {
        modifiers.push({
          stat: effect.stat,
          flat: effect.flat,
          percent: effect.percent,
        })
      }
    }
  }

  return modifiers
}
```

(Verify `StatModifier`'s exact field names against
`game/src/core/stats/StatModifier.ts` before finalizing — adjust
`flat`/`percent`/`stat` field names to match exactly if they differ.)

- [ ] **Step 4: Wire `onHitProc` at the hit-resolution point**

In `TurnBattleSystem.ts`, after `this.combat.resolveActionHit(...)`
succeeds inside the hit-resolution loop (same loop Task 1 hardened),
add a roll for any `onHitProc` effects on the actor's buff pool:

```typescript
        for (const target of affected) {
          if (!target.entity.alive) continue

          this.combat.resolveActionHit(actor.entity, target.entity, scaledDamage)
          targetIds.push(target.id)

          if (this.registry) {
            new TurnBuffSystem(actor.buffs).rollOnHitEffects(actor.entity, target.entity, this.registry)
          }
        }
```

(This assumes Task 3's ported `rollOnHitEffects()` mirrors the live
method's signature `rollOnHitEffects(source, target, registry)` exactly
— adjust the call if the actual ported signature differs.)

- [ ] **Step 5: Wire the recompute call at turn start**

At the start of `resolveActorTurn()`/`resolveNextStep()` (wherever the
acting participant is first resolved, before action selection), add:

```typescript
    actor.entity.stats = recomputeEffectiveStats(actor.entity.baseStats ?? actor.entity.stats, actor.buffs)
```

(Verify whether `CombatEntity` already tracks a separate `baseStats`
field distinct from the live/mutated `stats` — if not, this task needs
to add one, since recomputing every turn from an already-modified
`stats` would double-apply prior buffs. Check `CombatEntity.ts` before
finalizing this step; this is a real design decision the task must
resolve concretely, not skip.)

- [ ] **Step 6: Run tests, typecheck, commit**

Run: `npx vitest run game/src/core/battle/turn/` then `npx vue-tsc --noEmit`.

```bash
git add game/src/core/battle/turn/TurnStatsRecompute.ts game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnStatsRecompute.test.ts game/src/core/battle/turn/TurnBattleSystem.test.ts
git commit -m "feat(turn-combat): wire TurnStatModifierEffect/TurnOnHitProcEffect via recomputeEffectiveStats"
```

---

# Phase 3 — Content survey (no dependencies, no code changes)

### Task 5: Survey + map real content for Slice 6 (8 builds + enemies + wave spawn)

**Files:** none modified — this task's deliverable is a findings section appended to this plan file (Step 5) plus the actual `TurnSkillDefinition` mappings written as a new data file (Step 4).

- [ ] **Step 1: Find Thể Tu's and Phàm Nhân's basic-attack skill definitions**

Read `game/src/data/skill/Skills.ts` in full (or in large chunks —
it's 2200+ lines) filtering for `buildTag`/`resourceType: 'none'`
entries not already accounted for by the 6 builds already found
(Kiếm Tu=`tram`, 5 Pháp Tu Thuần elements per spec §5.1). If Thể Tu/Phàm
Nhân don't use `Skill` objects at all (e.g. a hardcoded generic melee
attack), find wherever that generic attack is defined instead (grep
`game/src/core` for how a Thể Tu/Phàm Nhân player currently attacks in
`BattleSystem.ts`).

- [ ] **Step 2: List `Enemy.specialAttacks[]` for every enemy that has one**

Grep `Enemies.ts` for `specialAttacks:` — list every enemy id that
authors this field (confirmed rare this session, expect a short list).
Everything else uses only its base `attack` stat (generic basic
attack) — no special/ultimate mapping needed for those, only a basic.

- [ ] **Step 3: Verify `normalizeEnemyAttackSpeed()`'s output range**

Read `EnemyStatInput.ts:109` and `normalizeEnemyAttackSpeed()`'s
implementation. Compute its output for a representative sample of
enemies' `attackSpeed` inputs and compare against the player-side
`speed = 100 + dexterity×0.15` baseline (~100-250 range). If enemy
`speed` values land wildly outside this range (e.g. still ~1.0-2.0
scale from the old real-time convention), this is a real follow-up gap
— document it, do not silently rescale without a decision (this would
be a rebalance, which needs explicit sign-off per the standing policy,
not something to do unilaterally inside a survey task).

- [ ] **Step 4: Write the real `TurnSkillDefinition` mappings**

Create `game/src/data/skill/TurnBasicAttacks.ts` exporting one
`TurnSkillDefinition` per build (8 total) and one per enemy that has a
`specialAttacks[]` entry (from Step 2), each a straight field copy from
the corresponding live `Skill`/`EnemySpecialAttack` (cooldown→
`cooldownTurns`, `damage` derived from `components`, `targeting` from
the skill's existing shape/range) — per Slice 2 spec §3, this is
data-copying, not redesign. Write a small Vitest suite
(`TurnBasicAttacks.test.ts`) asserting every one of the 8 builds has a
mapped `basic` entry (structural completeness check, not gameplay
assertions).

- [ ] **Step 5: Run tests, typecheck, commit**

```bash
git add game/src/data/skill/TurnBasicAttacks.ts game/src/data/skill/TurnBasicAttacks.test.ts
git commit -m "feat(turn-combat): map real basic-attack content for 8 builds + enemy special attacks"
```

---

### Task 6: Survey dpsRatio real formulas (Dung Nham, Kiếm Trận)

**Files:** none modified — pure survey, output feeds Task 8.

- [ ] **Step 1: Find the spawn-time formulas**

Read `game/src/core/battle/BattleSystem.ts`'s `spawnLavaZone` and
`spawnSwordZone` methods (grep for these exact names to locate them —
confirmed to exist as comments/references in `LavaZone.ts`/
`SwordZone.ts`/`HazardZoneSystem.ts` but not yet read directly this
session). Extract the exact damage-per-tick formula each computes
(likely a percentage of the caster's `attack` or a skill's base
damage — read the real code, do not assume).

- [ ] **Step 2: Convert to `dpsRatio`**

`TurnBuffTypes.ts`'s `dot` effect type uses `dpsRatio` (a ratio against
the source's `attack`, per Slice 3's design — confirm exact semantics
by reading `TurnBuffSystem.ts`'s existing `dot` handling, e.g. the
`damagePerTurn` field derivation already used by fixture tests). Write
the converted ratio for both Dung Nham and Kiếm Trận as plain numbers
in this task's commit message or a short code comment where Task 8
will consume them — no rebalance, the ratio must produce the same
expected damage-per-tick as the live formula for a baseline
attack value, not an arbitrary new number.

- [ ] **Step 3: Commit findings**

No file changes if Step 1-2 are pure investigation — if useful,
capture the findings as a code comment in the file Task 8 will create.
No separate commit needed if nothing changed; otherwise commit the
comment-only note.

---

# Phase 4 — ReactionManager/SkillEffectSystem conversion (depends on Task 6)

### Task 7: Convert Lava Zone + Sword Zone spawn calls to `TurnBuffSystem` dot application

**Files:**
- Modify: `game/src/core/element/ReactionManager.ts`
- Modify: `game/src/core/skill/SkillEffectSystem.ts`
- Test: `game/src/core/element/ReactionManager.test.ts` (or wherever its existing tests live — confirm exact path)
- Test: `game/src/core/skill/SkillEffectSystem.test.ts` (confirm exact path)

**Interfaces:**
- Consumes: `TurnBuffSystem.apply()` (merged), the dpsRatio values found in Task 6.
- Produces: nothing consumed by a later task in this plan.

**Note:** this task only makes sense to execute after Task 9 (Slice 6
cutover) actually replaces `BattleSystem.ts`'s runtime with
`TurnBattleSystem` — until then, `ReactionManager`/`SkillEffectSystem`
are called from the LIVE real-time loop, and swapping their zone-spawn
calls for `TurnBuffSystem` calls would silently break the still-running
live game (violates this session's live-file-care pattern, unlike the
Stat System's deliberate, explicit exception). **Do not execute this
task's Step 3-4 until Task 9 has landed** — Steps 1-2 (writing the new
dot buff definitions) can happen anytime.

- [ ] **Step 1: Define the two dot buff definitions**

Using the dpsRatio values from Task 6, add 2 new `TurnBuffDefinition`
entries (naming them to match the reaction's real name, e.g.
`dung_nham_burn`, `kiem_tran_burn`) to wherever real `TurnBuffDefinition`
content lives (create `game/src/data/buff/TurnBuffs.ts` if it doesn't
exist yet from Task 3's content migration work).

- [ ] **Step 2: Write failing tests proving the definitions have the right shape**

Simple structural assertions (`effects[0].type === 'dot'`,
`dpsRatio` matches the Task 6 value) — no engine wiring yet.

- [ ] **Step 3 (BLOCKED until Task 9 lands): Swap the call sites**

In `ReactionManager.ts:189-195`, replace the `spawnLavaZone(...)` call
with `new TurnBuffSystem(target.buffs).apply(dungNhamBurnDefinition, source, target, registry)`
against the already-collected reaction target (read the surrounding
function to confirm the exact target reference available at that
point). In `SkillEffectSystem.ts:190`, replace the `ctx.spawnSwordZone(...)`
call similarly.

- [ ] **Step 4 (BLOCKED until Task 9): Run tests, typecheck, commit**

```bash
git add game/src/core/element/ReactionManager.ts game/src/core/skill/SkillEffectSystem.ts game/src/data/buff/TurnBuffs.ts
git commit -m "feat(turn-combat): convert Lava Zone/Sword Zone spawn to TurnBuffSystem dot application"
```

---

# Phase 5 — Slice 6 Cutover (depends on Task 5)

### Task 8: `toTurnBattleParticipant()` adapter + `GameManager` entry-point replacement

**Files:**
- Create: `game/src/core/game/TurnBattleAdapter.ts`
- Modify: `game/src/core/game/GameManager.ts`
- Test: `game/src/core/game/TurnBattleAdapter.test.ts`
- Test: `game/src/core/game/GameManager.turnBattle.test.ts` (new file — do not add to an existing `GameManager.test.ts` if one is enormous; check file size first)

**Interfaces:**
- Consumes: `TurnBasicAttacks.ts` (Task 5), `playerToCombatEntity()`/`enemyToCombatEntity()` (live, existing), `StageWaveSystem.pickEnemyForSpawn()` (live, `StageWaveSystem.ts:248-292`).
- Produces: `toTurnBattleParticipant(entity, priority, basic): TurnBattleParticipant`, `GameManager.startBattle`/`startStage`/`updateBattleFixedStep`/`getBattle`/`getStageProgress` now backed by `TurnBattle` — consumed by Task 9-10.

- [ ] **Step 1: Read the exact current `GameManager` call sites**

Read `docs/superpowers/specs/2026-09-04-gamemanager-external-contract-survey.md`
in full, then re-read the actual current `GameManager.ts` at each cited
line (the survey may be slightly stale post-Stat-System-merge — verify
before writing).

- [ ] **Step 2: Write the adapter**

```typescript
// game/src/core/game/TurnBattleAdapter.ts
import type { CombatEntity } from '../combat/CombatEntity'
import type { TurnBattleParticipant, TurnSkillDefinition } from '../battle/turn/TurnBattleSystem'
import { TurnBuffPool } from '../battle/turn/TurnBuffPool'

export function toTurnBattleParticipant(
  entity: CombatEntity,
  priority: number,
  basic: TurnSkillDefinition,
): TurnBattleParticipant {
  return {
    id: entity.id,
    entity,
    speed: entity.stats.speed,
    priority,
    actionGauge: 0,
    alive: entity.alive,
    buffs: new TurnBuffPool(),
    consecutiveHardCcTurns: 0,
    basic,
  }
}
```

(Adjust field names to match whatever `TurnBattleParticipant`'s actual
current shape is post-Combat-Fairness-Guards — read the real interface
before finalizing, this snippet assumes that plan's Task 1 has already
landed since Phase 1 of this plan doesn't block on it but likely runs
concurrently.)

- [ ] **Step 3: Write failing tests for the adapter**

Structural tests: given a `CombatEntity` with a known `speed` stat and
a `TurnSkillDefinition`, confirm the returned `TurnBattleParticipant`
has matching fields.

- [ ] **Step 4: Run tests to verify they fail, then pass after Step 2**

Run: `npx vitest run game/src/core/game/TurnBattleAdapter.test.ts`

- [ ] **Step 5: Replace `GameManager`'s entry points**

Per the Slice 6 design spec §4: replace `startBattle`/`startStage` to
construct a `TurnBattle` via the adapter (player side + enemy side via
`spawnEnemy` wrapping `StageWaveSystem.pickEnemyForSpawn()`, per spec
§5.3); replace `updateBattleFixedStep(deltaSeconds)`'s body with a
fixed-interval loop calling `TurnBattleSystem.resolveNextStep()`
repeatedly (matching the original Slice 6 spec's exact pacing design);
replace `getBattle`/`getStageProgress` to read `TurnBattle` state.
Write this against the REAL current `GameManager.ts` code read in
Step 1 — do not guess method bodies.

- [ ] **Step 6: Retire `BattleSystem.ts`, `HazardZoneSystem.ts`, `UltimateSystem.ts`**

Delete these files and every import of them. Retire
`KiemTuCombatHud.vue`'s `setChannelTickSeconds`/`ultAutoEnabled`/
`tryPlayerUltimate()` call sites per Slice 6 spec §4.

- [ ] **Step 7: Adapt the 7 read-only UI call sites**

Per Slice 6 spec §4: `CombatCountdownOverlay.vue`, `CombatResultModal.vue`,
`PillBagSection.vue` ×2, `ArtifactPanel.vue`, `CombatTopBar.vue`,
`MortalCombatHud.vue`/`KiemTuCombatHud.vue`'s `isBattleInProgress()`
gating — read `TurnBattle.state`/wave progress instead of
`Battle.state`/`StageWaveSystem.getProgress()`.

- [ ] **Step 8: Run tests, typecheck, commit**

```bash
git add game/src/core/game/TurnBattleAdapter.ts game/src/core/game/GameManager.ts game/src/core/game/TurnBattleAdapter.test.ts game/src/core/game/GameManager.turnBattle.test.ts
git commit -m "feat(turn-combat): Slice 6 cutover — GameManager now runs on TurnBattleSystem"
```

---

### Task 9: Rewrite the 27 `BattleSystem.*.test.ts` files

**Files:**
- Delete: all 27 files matching `game/src/core/battle/*.test.ts` that pin `BattleSystem.ts` real-time behavior (confirmed list this session: skillFlow, thachHoa, chain, artifactOrigin, attackRangeVisibility, batKiem, bossSpecialAttack, buffSystemCache, castTime, countdown, deadCast, earthPath, fizzleRefund, gate, hoaThe, huyetPha, kiemTuResources, kimPath, lavaZone, onTick, pendingSpawn, reactiveTriggers, regen, skillTriggers, statusVfx, swordZone, teleport, theTu — verify this list against the real directory listing first, it may have changed).
- Create: new equivalent turn-based test coverage under `game/src/core/battle/turn/` for whatever real game-mechanic assertions those files proved (e.g. `batKiem.test.ts`'s assertions about Bạt Kiếm Thuật are N/A — channel skills are a known, accepted gap, do not port those; `hoaThe.test.ts`'s Hỏa Thế resource assertions should have an equivalent once Task 5/Phase 4 land real resource content — check which of the 27 files' assertions have a real turn-based analog yet, and which don't because their underlying content hasn't migrated yet).

- [ ] **Step 1: Read each of the 27 files' `describe` blocks (not full bodies) to classify them**

For each file, note: (a) does it test a mechanic already migrated to
`TurnBattleSystem` (basic attack, buff/CC, resource tick, wave spawn)?
(b) does it test a mechanic explicitly dropped (MomentumBreak/Break-
stagger, channel skills)? (c) does it test a mechanic not yet migrated
by this plan (boss phases — explicitly not migrating per Deep Review
§2 decision)? Categorize all 27 before deleting any.

- [ ] **Step 2: Delete files in category (b)/(c) outright**

No replacement needed — the mechanics they tested are gone by design
decision, not oversight (cite the roadmap's Deep Review §2/MomentumBreak
decision in the commit message).

- [ ] **Step 3: For category (a) files, write equivalent turn-based tests**

One new `.test.ts` file per retired file (or fold into existing
`TurnBattleSystem.*.test.ts` files where a near-identical case already
exists) proving the SAME game mechanic now works via
`TurnBattleSystem`/real content (Task 5-8's mapped skills/adapters),
not fixtures.

- [ ] **Step 4: Delete the old files, run full suite, typecheck, commit**

```bash
git add -A
git commit -m "test(turn-combat): retire 27 BattleSystem.*.test.ts, port coverage to TurnBattleSystem"
```

---

# Phase 6 — Post-cutover (depends on Task 8)

### Task 10: Slice 7 — `peekNextActor()`/`resolveActorTurn()` split + 3-button manual UI

**Files:** per Slice 7's original design spec — `game/src/core/battle/turn/TurnBattleSystem.ts`, `game/src/components/combat/CombatSkillSlot.vue`, `game/src/core/combat/CombatSkillPresentation.ts`, `game/src/core/game/GameManager.ts`.

- [ ] **Step 1-N: Implement exactly per** `docs/superpowers/specs/2026-09-04-turn-battle-system-slice7-manual-ui-design.md` **§2-4**

This task's full TDD breakdown is the original Slice 7 spec's §2
(`peekNextActor`/`resolveActorTurn` API split) and §4 (3 fixed
buttons, `deriveState()` rewrite) — write the granular steps at
execution time following that spec exactly (it was already fully
designed and approved; this plan does not re-derive it, only sequences
it as this phase's first task since it's now unblocked by Task 8).

- [ ] **Final step: Run tests, typecheck, commit**

```bash
git commit -m "feat(turn-combat): Slice 7 — peekNextActor/resolveActorTurn split + manual tap-to-cast UI"
```

---

### Task 11: Slice 7 extension — turn-order preview + battle log

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts`
- Create: a new UI component for the battle log / turn-order strip (exact file TBD by whoever designs the UI placement — not specified by this plan, per the completion spec §10's note that exact rendering is deferred to plan-writing time; write the component under `game/src/components/combat/` following this directory's existing naming convention).
- Test: `game/src/core/battle/turn/TurnBattleSystem.test.ts`

**Interfaces:**
- Consumes: `TurnBattle` (post-Task-8 real battles).
- Produces: `peekUpcomingActors(battle, count): TurnBattleParticipant[]`, `TurnBattle.log?: BattleLogEntry[]`.

- [ ] **Step 1: Write failing tests for `peekUpcomingActors`**

Prove it returns N actors in gauge-fill order WITHOUT mutating the
real `battle` object (compare `battle.player.actionGauge` before/after
the call — must be unchanged).

- [ ] **Step 2: Implement `peekUpcomingActors` via a cloned battle state**

```typescript
export function peekUpcomingActors(battle: TurnBattle, count: number): TurnBattleParticipant[] {
  const clonedBattle: TurnBattle = structuredClone(battle) // or a manual deep-clone if structuredClone can't handle CombatEntity's methods/prototypes — verify at implementation time
  const upcoming: TurnBattleParticipant[] = []

  for (let i = 0; i < count; i++) {
    const actor = peekNextActor(clonedBattle) // Task 10's peekNextActor, applied to the CLONE
    if (!actor) break
    upcoming.push(actor)
    actor.actionGauge = 0 // simulate consumption so the loop advances to the NEXT actor
  }

  return upcoming
}
```

(`structuredClone` will not work directly on `CombatEntity` if it
carries non-serializable fields like functions/class instances — verify
this at implementation time and fall back to a manual field-by-field
clone if needed; this is a real decision to resolve with the actual
`CombatEntity`/`TurnBattleParticipant` shapes, not to guess now.)

- [ ] **Step 3: Write failing tests for the battle log**

Prove `battle.log` gains one entry per `resolveActorTurn()` call with
the fields listed in the completion spec §10.

- [ ] **Step 4: Wire log entry appending**

At the end of `resolveActorTurn()`, before returning the
`TurnStepResult`:

```typescript
    battle.log = battle.log ?? []
    battle.log.push({ turn: battle.totalTurnsElapsed ?? 0, actorId: actor.id, skillId, targetIds, ccBlocked })
```

- [ ] **Step 5: Build the UI component(s)**

A turn-order strip (renders `peekUpcomingActors(battle, 5)`, refreshed
each render tick) and a battle log panel (renders `battle.log`,
newest-first or oldest-first per whatever matches this project's other
log-style components — check `ActionFeedbackLog.vue`'s convention for
consistency even though it's a different domain).

- [ ] **Step 6: Run tests, typecheck, commit**

```bash
git commit -m "feat(turn-combat): turn-order preview + battle log (Slice 7 extension)"
```

---

### Task 12: Battle-speed-toggle (x1/x2/x4)

**Files:**
- Modify: `game/src/core/idle/SpeedSettings.ts` (or wherever the removed x1/x2/x4 concept previously lived — read its current state first, it may be fully deleted rather than dormant)
- Modify: `game/src/core/game/GameManager.ts`
- Test: relevant existing/new test files.

- [ ] **Step 1: Read `SpeedSettings.ts`'s current state**

Confirm whether the old x1/x2/x4 concept is fully deleted or just
unused — this determines whether this task restores old code or writes
new.

- [ ] **Step 2: Add a `battleSpeedMultiplier: 1 | 2 | 4` setting**

Wherever player settings live (check `PlayerData`/settings store
pattern used elsewhere in this project).

- [ ] **Step 3: Wire it into `updateBattleFixedStep`**

Multiply the number of `resolveNextStep()`/`resolveActorTurn()` calls
made per real-time tick by the current `battleSpeedMultiplier` — per
completion spec §11, this is a pacing change only, no formula change.

- [ ] **Step 4: Add a UI toggle control**

Wherever other combat settings surface in the UI (check
`CombatTopBar.vue` or similar per this project's existing pattern).

- [ ] **Step 5: Run tests, typecheck, commit**

```bash
git commit -m "feat(turn-combat): reintroduce battle-speed-toggle (x1/x2/x4) for the turn-based engine"
```

---

### Task 13: BuffSystem content migration + presentation

**Files:**
- Create: `game/src/data/buff/TurnBuffs.ts` (if Task 7 didn't already create it)
- Modify: `combat-vfx-spawner.ts`, `combat-status-tooltip.ts`
- Test: corresponding test files.

**Interfaces:**
- Consumes: `buffs.ts`'s 47 `BuffDefinition` entries (live), `TurnBuffDefinition` shape (merged).

- [ ] **Step 1: Convert all 47 `BuffDefinition` entries to `TurnBuffDefinition`**

Straight field-by-field port: `duration` (seconds) → `duration` (turns,
SAME NUMBER, no rebalance), `convertsAfterContinuousSeconds` →
`convertsAfterContinuousTurns` (same number), everything else
unchanged. Write a completeness test asserting all 47 source ids have
a corresponding `TurnBuffDefinition`.

- [ ] **Step 2: Update presentation for turn-based duration display**

`combat-vfx-spawner.ts:151/197`'s `durationSeconds` → a turn-count
equivalent; `combat-status-tooltip.ts:22/90`'s `` `${remainingTime}s` ``
→ `` `${remainingTurns} lượt` `` (or whatever i18n convention this
project uses for turn-count display — check for precedent in already-
merged Slice 7 UI work from Task 10 first).

- [ ] **Step 3: Run tests, typecheck, commit**

```bash
git commit -m "feat(turn-combat): migrate 47 real buff definitions to TurnBuffDefinition + turn-based presentation"
```

---

# Final Task: Full-suite verification

### Task 14: Full-suite verification

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, zero regressions across the entire codebase — this
plan touches production `GameManager.ts`/UI files, unlike every prior
slice, so this is the first full-suite check that actually matters for
live-game correctness since the Stat System conversion.

- [ ] **Step 2: Run typecheck**

Run: `npx vue-tsc --noEmit`

- [ ] **Step 3: Manual smoke test**

Per this project's own CLAUDE.md guidance ("For UI or frontend changes,
start the dev server and use the feature in a browser before reporting
complete") — start the dev server, play through at least one full
battle for at least 2 different builds (e.g. one Pháp Tu element + Kiếm
Tu), confirm basic attack fires, buffs/CC apply, a stage clears via
wave spawn, and the result screen shows correctly. This cannot be
skipped for this task — Slice 6's cutover is the single highest-risk
change in the entire rework (per the roadmap's own note).

- [ ] **Step 4: Commit any fixups**

```bash
git add -A
git commit -m "fix: address regressions found during Turn-Based Combat Completion full-suite verification"
```

## Not Covered By This Plan

Party/companion, Pháp Tu Reaction Path, Node Tree/Element Slot
redesign, Gauge-delta buff effect type, Channel skill support — all
explicitly out of scope, each gets its own future spec+plan when its
turn comes.
