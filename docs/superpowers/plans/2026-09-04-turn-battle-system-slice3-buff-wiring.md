# Turn Battle System — Slice 3: Buff/CC Wiring + Zone-as-dot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the already-built `TurnBuffSystem`/`TurnBuffPool` into `TurnBattleSystem` so a cast skill can apply a real turn-based dot/CC buff to its target set, buffs tick at their holder's own turn, and stun/freeze correctly block the holder's next action — proving the "zone-as-dot" mechanism (a former Lava/Sword Zone is just a skill with an AOE `targeting` shape whose hit resolves into a `dot` buff, no positional zone entity needed).

**Architecture:** Each `TurnBattleParticipant` gets its own `buffs: TurnBuffPool`. `TurnSkillDefinition` (Slice 2, `TurnSkillAction.ts`) gains an optional `appliesBuff` field. `TurnBattleSystem.resolveNextStep()` (Slice 2) is extended: tick the acting participant's own buffs first, check CC block, then (if not blocked) resolve the action as before and apply any `appliesBuff` to the hit target(s). No new files — everything is an addition to `TurnBattleSystem.ts`/`TurnSkillAction.ts` plus a small fixture registry in the test files.

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-turn-battle-system-slice3-buff-design.md`

**Dependency:** This plan assumes Slice 2's plan (`docs/superpowers/plans/2026-09-04-turn-battle-system-slice2-skill-actions.md`) has already been executed and merged — it uses `TurnSkillDefinition`, `SelectedAction`, `tickCooldowns`/`selectAction`/`commitAction`/`collectTurnTargets`, `TurnBattleParticipant.basic/special/ultimate`, `resolveNextStep()`, and `TurnStepResult` exactly as that plan defines them. If any of those names/signatures changed during Slice 2's actual execution, resolve the mismatch against the real merged code before starting Task 1 — this plan's code blocks assume Slice 2 landed exactly as specified.

## Global Constraints

- Do not modify `game/src/core/battle/BattleSystem.ts`, `game/src/core/battle/HazardZoneSystem.ts`, `game/src/core/element/ReactionManager.ts`, `game/src/core/battle/SkillEffectResolver.ts`, or `game/src/core/game/GameManager.ts`.
- Do not modify `game/src/core/battle/turn/TurnBuffSystem.ts`, `TurnBuffPool.ts`, or `TurnBuffTypes.ts` — they are already merged and tested; this plan only imports and calls them.
- No `any` types.
- No `statModifier`/`onHitProc` effect handling — only `dot` and `cc` effect types are exercised (matches what `TurnBuffTypes.ts` already supports; the other two types stay unused by this slice).
- No real content migration (Dung Nham reaction, Kiếm Trận zone) — all buffs/skills in this plan's tests are fixtures.

---

### Task 1: Add `buffs`/`appliesBuff` fields, update existing test fixtures

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts`
- Modify: `game/src/core/battle/turn/TurnSkillAction.ts`
- Modify: `game/src/core/battle/turn/TurnBattleSystem.test.ts`
- Modify: `game/src/core/battle/turn/TurnBattleSystem.adversarial.test.ts`
- Modify: `game/src/core/battle/turn/TurnBattleSystem.qadebug.test.ts`
- Modify: `game/src/core/battle/turn/TurnSkillAction.test.ts`

**Interfaces:**
- Consumes: `TurnBuffPool` (`game/src/core/battle/turn/TurnBuffPool.ts`).
- Produces: `TurnBattleParticipant.buffs: TurnBuffPool` (required field), `TurnSkillDefinition.appliesBuff?: { definitionId: string; target: 'self' | 'target' }` — used by Task 2/3.

- [ ] **Step 1: Add `buffs` to `TurnBattleParticipant` and the import**

In `game/src/core/battle/turn/TurnBattleSystem.ts`, add the import:

```typescript
import { TurnBuffPool } from './TurnBuffPool'
```

Modify `TurnBattleParticipant`:

```typescript
export interface TurnBattleParticipant {
  id: string
  entity: CombatEntity
  speed: number
  priority: number
  actionGauge: number
  alive: boolean
  buffs: TurnBuffPool
  basic?: TurnSkillDefinition
  special?: TurnSkillSlot
  ultimate?: TurnSkillSlot
}
```

- [ ] **Step 2: Add `appliesBuff` to `TurnSkillDefinition`**

In `game/src/core/battle/turn/TurnSkillAction.ts`, modify `TurnSkillDefinition`:

```typescript
export interface TurnSkillDefinition {
  id: string
  cooldownTurns: number
  resourceType?: SkillResourceType
  resourceCost?: number
  damage: ActionDamageInfo
  targeting: ActionTargeting
  appliesBuff?: { definitionId: string; target: 'self' | 'target' }
}
```

- [ ] **Step 3: Update `makeParticipant()` in `TurnBattleSystem.test.ts`**

In `game/src/core/battle/turn/TurnBattleSystem.test.ts`, add the import:

```typescript
import { TurnBuffPool } from './TurnBuffPool'
```

Modify both `participant()` and `makeParticipant()` helper functions to include the new field:

```typescript
function participant(
  id: string,
  combatEntity: CombatEntity,
  speed = 10,
  priority = 0,
): TurnBattleParticipant {
  return { id, entity: combatEntity, speed, priority, actionGauge: 0, alive: combatEntity.alive, buffs: new TurnBuffPool() }
}
```

```typescript
function makeParticipant(
  id: string,
  combatEntity: CombatEntity,
  speed: number,
  priority: number,
): TurnBattleParticipant {
  return { id, entity: combatEntity, speed, priority, actionGauge: 0, alive: combatEntity.alive, buffs: new TurnBuffPool() }
}
```

- [ ] **Step 4: Update `makeParticipant()` in `TurnBattleSystem.adversarial.test.ts`**

Add the same import and update its `makeParticipant()` helper identically to Step 3's second snippet.

- [ ] **Step 5: Update `participant()` in `TurnBattleSystem.qadebug.test.ts`**

Add the import `import { TurnBuffPool } from './TurnBuffPool'` and modify:

```typescript
function participant(id: string, e: CombatEntity): TurnBattleParticipant {
  return { id, entity: e, speed: 10, priority: 0, actionGauge: 0, alive: e.alive, buffs: new TurnBuffPool() }
}
```

- [ ] **Step 6: Update `participant()` in `TurnSkillAction.test.ts`**

Add the import `import { TurnBuffPool } from './TurnBuffPool'` and modify the `participant()` helper (added by Slice 2's plan Task 2) to include `buffs: new TurnBuffPool()` in its returned object, matching the same pattern as Step 3.

- [ ] **Step 7: Run the full turn/ test suite to verify nothing broke**

Run: `npx vitest run game/src/core/battle/turn/`
Expected: PASS — every existing case still passes (the new field is additive, no assertions changed).

- [ ] **Step 8: Typecheck**

Run: `npx vue-tsc --noEmit`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnSkillAction.ts game/src/core/battle/turn/TurnBattleSystem.test.ts game/src/core/battle/turn/TurnBattleSystem.adversarial.test.ts game/src/core/battle/turn/TurnBattleSystem.qadebug.test.ts game/src/core/battle/turn/TurnSkillAction.test.ts
git commit -m "feat(turn-combat): add buffs pool + appliesBuff field (Slice 3 task 1)"
```

---

### Task 2: Tick buffs + CC block in `resolveNextStep()`

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts`
- Test: `game/src/core/battle/turn/TurnBattleSystem.test.ts`

**Interfaces:**
- Consumes: `TurnBuffSystem` (`game/src/core/battle/turn/TurnBuffSystem.ts`), `TurnBuffRegistry`/`TurnBuffDefinition` (`TurnBuffTypes.ts`), `TurnBattleParticipant.buffs` (Task 1).
- Produces: `TurnStepResult.ccBlocked: boolean` (always present), `TurnBattleSystem` constructor gains an optional 3rd param `registry?: TurnBuffRegistry` — used by Task 3.

- [ ] **Step 1: Write the failing tests**

Append to `game/src/core/battle/turn/TurnBattleSystem.test.ts`:

```typescript
import { TurnBuffSystem } from './TurnBuffSystem'
import type { TurnBuffDefinition, TurnBuffRegistry } from './TurnBuffTypes'

class FixtureBuffRegistry implements TurnBuffRegistry {
  private readonly definitions = new Map<string, TurnBuffDefinition>()

  constructor(definitions: TurnBuffDefinition[]) {
    for (const definition of definitions) {
      this.definitions.set(definition.id, definition)
    }
  }

  get(id: string): TurnBuffDefinition {
    const definition = this.definitions.get(id)

    if (!definition) {
      throw new Error(`fixture buff not found: ${id}`)
    }

    return definition
  }
}

const STUN_DEFINITION: TurnBuffDefinition = {
  id: 'fixture_stun',
  name: 'Fixture Stun',
  polarity: 'debuff',
  duration: 1,
  stackMode: 'refresh',
  effects: [{ type: 'cc', ccEffect: 'stun' }],
}

describe('TurnBattleSystem.resolveNextStep buff/CC wiring', () => {
  it('ticks the acting participant own buffs down by 1 turn before acting', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 10, 0)

    const registry = new FixtureBuffRegistry([STUN_DEFINITION])
    new TurnBuffSystem(playerParticipant.buffs).apply(STUN_DEFINITION, enemyEntity, player, registry)

    const battle: TurnBattle = {
      player: playerParticipant,
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, registry)
    const step = system.resolveNextStep(battle)

    expect(step.ccBlocked).toBe(true)
    expect(playerParticipant.buffs.getAll()).toEqual([])
  })

  it('a stunned actor deals no damage this step but the battle continues', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 10, 0)

    const registry = new FixtureBuffRegistry([STUN_DEFINITION])
    new TurnBuffSystem(playerParticipant.buffs).apply(STUN_DEFINITION, enemyEntity, player, registry)

    const battle: TurnBattle = {
      player: playerParticipant,
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, registry)
    const step = system.resolveNextStep(battle)

    expect(step.targetIds).toEqual([])
    expect(enemyEntity.currentHp).toBe(1_000_000)
    expect(battle.state).toBe('fighting')
  })

  it('a non-stunned actor is unaffected (ccBlocked false, acts normally)', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
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
    const step = system.resolveNextStep(battle)

    expect(step.ccBlocked).toBe(false)
    expect(step.targetIds).toEqual(['enemy'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run game/src/core/battle/turn/TurnBattleSystem.test.ts`
Expected: FAIL — `TurnStepResult.ccBlocked` doesn't exist, `TurnBattleSystem` constructor doesn't accept a 3rd `registry` argument yet.

- [ ] **Step 3: Wire buff tick + CC block into `resolveNextStep()`**

In `game/src/core/battle/turn/TurnBattleSystem.ts`, add the import:

```typescript
import { TurnBuffSystem } from './TurnBuffSystem'
import type { TurnBuffRegistry } from './TurnBuffTypes'
```

Modify the `TurnStepResult` interface:

```typescript
export interface TurnStepResult {
  state: TurnBattleState
  actorId: string
  skillId: string
  targetIds: string[]
  ccBlocked: boolean
}
```

Modify the constructor to accept an optional registry:

```typescript
export class TurnBattleSystem {
  constructor(
    private readonly combat: CombatSystem,
    private readonly maxTurns: number = DEFAULT_MAX_TURNS,
    private readonly registry?: TurnBuffRegistry,
  ) {}
```

Replace the body of `resolveNextStep()` (from Slice 2) with this version — the early-return-on-no-actor branch gains `ccBlocked: false`, and a new tick/CC block is inserted right after `actor` is resolved, before `tickCooldowns()`:

```typescript
  resolveNextStep(battle: TurnBattle): TurnStepResult {
    const allParticipants = [battle.player, ...battle.enemies]

    for (const participant of allParticipants) {
      participant.alive = participant.entity.alive
    }

    const resolved = resolveNextTurn(allParticipants)

    if (!resolved) {
      battle.state = 'defeat'
      return { state: 'defeat', actorId: '', skillId: '', targetIds: [], ccBlocked: false }
    }

    const actor = resolved.actor

    const actorBuffSystem = new TurnBuffSystem(actor.buffs)

    actorBuffSystem.update(actor.entity, this.combat, this.registry)

    const ccBlocked = actorBuffSystem.isStunned() || actorBuffSystem.isFrozen()

    let skillId = ''

    const targetIds: string[] = []

    if (actor.entity.alive && !ccBlocked) {
      tickCooldowns(actor)

      const action = selectAction(actor)

      skillId = action.skillId

      const opposingSide = actor === battle.player ? battle.enemies : [battle.player]
      const primaryTarget = selectTarget(actor, opposingSide)

      if (primaryTarget) {
        const affected = collectTurnTargets(primaryTarget, opposingSide, action.targeting)

        for (const target of affected) {
          this.combat.resolveActionHit(actor.entity, target.entity, action.damage)
          targetIds.push(target.id)
        }

        commitAction(actor.entity, action)
      }
    }

    consumeGaugeAfterAction(actor)

    if (!battle.player.entity.alive) {
      battle.state = 'defeat'
    } else if (battle.enemies.every((enemy) => !enemy.entity.alive)) {
      battle.state = 'victory'
    }

    return { state: battle.state, actorId: actor.id, skillId, targetIds, ccBlocked }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run game/src/core/battle/turn/TurnBattleSystem.test.ts game/src/core/battle/turn/TurnBattleSystem.adversarial.test.ts game/src/core/battle/turn/TurnBattleSystem.qadebug.test.ts`
Expected: PASS — all pre-existing cases (unaffected by the new optional constructor param and the additive `ccBlocked` field) plus the 3 new cases.

- [ ] **Step 5: Typecheck**

Run: `npx vue-tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnBattleSystem.test.ts
git commit -m "feat(turn-combat): tick buffs + CC block in resolveNextStep (Slice 3 task 2)"
```

---

### Task 3: Wire `appliesBuff` — cast a skill that applies a dot buff (zone-as-dot proof)

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts`
- Test: `game/src/core/battle/turn/TurnBattleSystem.test.ts`

**Interfaces:**
- Consumes: `TurnSkillDefinition.appliesBuff` (Task 1), `TurnBuffSystem.apply()`, `TurnBuffRegistry` (Task 2's constructor param).
- Produces: nothing new for later tasks — this is the slice's final integration point.

- [ ] **Step 1: Write the failing tests**

Append to `game/src/core/battle/turn/TurnBattleSystem.test.ts`:

```typescript
const BURN_DEFINITION: TurnBuffDefinition = {
  id: 'fixture_burn',
  name: 'Fixture Burn',
  polarity: 'debuff',
  duration: 3,
  stackMode: 'refresh',
  effects: [{ type: 'dot', dpsRatio: 0.5, element: 'physical' }],
}

describe('TurnBattleSystem.resolveNextStep appliesBuff (zone-as-dot proof)', () => {
  it("applies the skill's buff to the target it hit", () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 10, 0)
    playerParticipant.basic = {
      id: 'fixture_burning_strike',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      appliesBuff: { definitionId: 'fixture_burn', target: 'target' },
    }

    const enemyParticipant = makeParticipant('enemy', enemyEntity, 10, 1)

    const battle: TurnBattle = {
      player: playerParticipant,
      enemies: [enemyParticipant],
      state: 'fighting',
    }

    const registry = new FixtureBuffRegistry([BURN_DEFINITION])
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, registry)
    system.resolveNextStep(battle)

    const applied = enemyParticipant.buffs.getAll()

    expect(applied).toHaveLength(1)
    expect(applied[0]!.id).toBe('fixture_burn')
    expect(applied[0]!.sourceId).toBe('player')
  })

  it("applies the skill's buff to self when target is 'self'", () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 10, 0)
    playerParticipant.basic = {
      id: 'fixture_self_burn',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      appliesBuff: { definitionId: 'fixture_burn', target: 'self' },
    }

    const battle: TurnBattle = {
      player: playerParticipant,
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const registry = new FixtureBuffRegistry([BURN_DEFINITION])
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, registry)
    system.resolveNextStep(battle)

    expect(playerParticipant.buffs.getAll()).toHaveLength(1)
  })

  it('AOE skill applies the buff to every hit target (zone-as-dot: no positional zone entity needed)', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      row: 4,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyA = createCombatant({
      id: 'enemyA',
      row: 4,
      x: 1,
      currentHp: 1_000_000,
      maxHp: 1_000_000,
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
      id: 'fixture_burning_field',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'row' },
      appliesBuff: { definitionId: 'fixture_burn', target: 'target' },
    }

    const enemyAParticipant = makeParticipant('enemyA', enemyA, 10, 1)
    const enemyBParticipant = makeParticipant('enemyB', enemyB, 10, 2)

    const battle: TurnBattle = {
      player: playerParticipant,
      enemies: [enemyAParticipant, enemyBParticipant],
      state: 'fighting',
    }

    const registry = new FixtureBuffRegistry([BURN_DEFINITION])
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, registry)
    system.resolveNextStep(battle)

    expect(enemyAParticipant.buffs.getAll()).toHaveLength(1)
    expect(enemyBParticipant.buffs.getAll()).toHaveLength(1)
  })

  it('does not throw and applies no buff when appliesBuff is set but no registry was provided', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 10, 0)
    playerParticipant.basic = {
      id: 'fixture_burning_strike',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      appliesBuff: { definitionId: 'fixture_burn', target: 'target' },
    }

    const enemyParticipant = makeParticipant('enemy', enemyEntity, 10, 1)

    const battle: TurnBattle = {
      player: playerParticipant,
      enemies: [enemyParticipant],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    expect(() => system.resolveNextStep(battle)).not.toThrow()
    expect(enemyParticipant.buffs.getAll()).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run game/src/core/battle/turn/TurnBattleSystem.test.ts`
Expected: FAIL — `appliesBuff` is never read by `resolveNextStep()` yet, so no buff is applied.

- [ ] **Step 3: Apply the buff after a successful hit**

In `game/src/core/battle/turn/TurnBattleSystem.ts`, inside `resolveNextStep()`'s `if (primaryTarget) { ... }` block, after the `commitAction(actor.entity, action)` line, add:

```typescript
        if (action.skill?.appliesBuff && this.registry) {
          const definition = this.registry.get(action.skill.appliesBuff.definitionId)

          if (action.skill.appliesBuff.target === 'self') {
            new TurnBuffSystem(actor.buffs).apply(definition, actor.entity, actor.entity, this.registry)
          } else {
            for (const target of affected) {
              new TurnBuffSystem(target.buffs).apply(definition, actor.entity, target.entity, this.registry)
            }
          }
        }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run game/src/core/battle/turn/TurnBattleSystem.test.ts`
Expected: PASS, all cases including the 4 new ones.

- [ ] **Step 5: Typecheck**

Run: `npx vue-tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnBattleSystem.test.ts
git commit -m "feat(turn-combat): apply skill's buff to hit targets, zone-as-dot proof (Slice 3 task 3)"
```

---

### Task 4: Full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, zero regressions. Only `game/src/core/battle/turn/**` files were touched, none of which are imported by any live production file.

- [ ] **Step 2: Run typecheck**

Run: `npx vue-tsc --noEmit` (or the project's existing typecheck script — check `package.json`'s `scripts` for the exact command already used elsewhere in this repo before running).
Expected: PASS, zero errors.

- [ ] **Step 3: Commit any fixups**

If Step 1-2 required fixes beyond what Tasks 1-3 anticipated, stage exactly the changed files and commit:

```bash
git add -A
git commit -m "fix: address regressions found during Slice 3 full-suite verification"
```

If no fixes were needed, skip this step.

## Not Covered By This Plan

- `TurnStatModifierEffect`/`TurnOnHitProcEffect` application — needs a stats-recompute pass `TurnBattleSystem` doesn't have yet, deferred to a future slice.
- Real content migration: converting the Dung Nham reaction's/Kiếm Trận zone's already-computed `damagePerTick` formulas into `dpsRatio`-based `TurnBuffDefinition`s, and moving `ReactionManager.ts`/`SkillEffectResolver.ts`'s real call sites off `HazardZoneSystem` — separate future work, tracked in the roadmap.
- `TurnBuffSystem.getActiveModifiers()`/`rollOnHitEffects()`/`getStacks()` — still not built, not needed by this slice.
- Any change to `BattleSystem.ts`, `HazardZoneSystem.ts`, `ReactionManager.ts`, `SkillEffectResolver.ts`, or `GameManager.ts`.
