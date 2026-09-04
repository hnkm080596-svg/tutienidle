# Turn Battle System — Slice 4: Resource / Boss Triggers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire 2 of the 3 Foundation primitives reserved for this slice — `ResourceTurnHook.applyTurnStartDeltas()` (generic resource regen/decay) and `BossTurnTriggers.isTurnTriggerReady()` (global-turn-count boss mechanic) — into `TurnBattleSystem.resolveNextStep()`. `MomentumBreak.ts` is dropped entirely per the locked decision (not wired, not deferred).

**Architecture:** Both hooks run unconditionally at the start of the acting participant's own turn (same timing convention Slice 3 established for buff ticking), right after the buff tick and before the CC check. No new files — both are additions to `TurnBattleSystem.ts`.

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-turn-battle-system-slice4-resource-boss-design.md`

**Dependency:** This plan assumes Slice 2's plan (`docs/superpowers/plans/2026-09-04-turn-battle-system-slice2-skill-actions.md`) AND Slice 3's plan (`docs/superpowers/plans/2026-09-04-turn-battle-system-slice3-buff-wiring.md`) have both already been executed and merged. It modifies `resolveNextStep()` starting from the exact shape Slice 3's Task 3 left it in (reproduced in Task 2/3 below) — if the real merged code differs, resolve the mismatch before starting Task 1.

## Global Constraints

- Do not use `game/src/core/battle/turn/MomentumBreak.ts` anywhere in this plan.
- Do not modify `game/src/core/battle/BattleSystem.ts`, `game/src/core/enemy/TribulationPhase.ts`, or `game/src/core/game/GameManager.ts`.
- No `any` types.
- No real content migration (Hỏa Thế/Kiếm Ý regen rules, real boss enrage data) — all resource pools/boss triggers in this plan's tests are fixtures.

---

### Task 1: Add `TurnResourcePool`/`TurnBossTrigger` types + `totalTurnsElapsed`

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts`

**Interfaces:**
- Consumes: `TurnResourceDelta` (`game/src/core/battle/turn/ResourceTurnHook.ts`).
- Produces: `TurnResourcePool`, `TurnBossTrigger` types, `TurnBattleParticipant.resources?`/`bossTrigger?`, `TurnBattle.totalTurnsElapsed?: number` — used by Task 2/3.

- [ ] **Step 1: Add the import and new types**

In `game/src/core/battle/turn/TurnBattleSystem.ts`, add the import:

```typescript
import type { TurnResourceDelta } from './ResourceTurnHook'
```

Add these types near `TurnBattleParticipant`:

```typescript
export interface TurnResourcePool {
  values: Record<string, number>
  deltasPerTurn: TurnResourceDelta[]
}

export interface TurnBossTrigger {
  afterTurns: number
  buffDefinitionId: string
  firedAlready: boolean
}
```

- [ ] **Step 2: Extend `TurnBattleParticipant` and `TurnBattle`**

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
  resources?: TurnResourcePool
  bossTrigger?: TurnBossTrigger
}
```

Modify `TurnBattle`:

```typescript
export interface TurnBattle {
  player: TurnBattleParticipant
  enemies: TurnBattleParticipant[]
  state: TurnBattleState
  totalTurnsElapsed?: number
}
```

- [ ] **Step 3: Run the full turn/ test suite to verify nothing broke**

Run: `npx vitest run game/src/core/battle/turn/`
Expected: PASS — both new fields are optional/additive, no existing test object literal needs updating.

- [ ] **Step 4: Typecheck**

Run: `npx vue-tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/src/core/battle/turn/TurnBattleSystem.ts
git commit -m "feat(turn-combat): add TurnResourcePool/TurnBossTrigger types (Slice 4 task 1)"
```

---

### Task 2: Wire `totalTurnsElapsed` counter + resource tick

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts`
- Test: `game/src/core/battle/turn/TurnBattleSystem.test.ts`

**Interfaces:**
- Consumes: `applyTurnStartDeltas` (`game/src/core/battle/turn/ResourceTurnHook.ts`), `TurnResourcePool` (Task 1).
- Produces: `battle.totalTurnsElapsed` incremented every step, `actor.resources.values` updated every own-turn — used by Task 3.

- [ ] **Step 1: Write the failing tests**

Append to `game/src/core/battle/turn/TurnBattleSystem.test.ts`:

```typescript
describe('TurnBattleSystem.resolveNextStep resource tick + totalTurnsElapsed', () => {
  it('increments totalTurnsElapsed by 1 on every step', () => {
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

    system.resolveNextStep(battle)
    expect(battle.totalTurnsElapsed).toBe(1)

    system.resolveNextStep(battle)
    expect(battle.totalTurnsElapsed).toBe(2)
  })

  it('applies resource deltas to the acting participant at the start of their own turn', () => {
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
    const resources = {
      values: { fixture_resource: 5 },
      deltasPerTurn: [{ stat: 'fixture_resource', amount: 2, min: 0, max: 10 }],
    }
    playerParticipant.resources = resources

    const battle: TurnBattle = {
      player: playerParticipant,
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    system.resolveNextStep(battle)

    expect(resources.values.fixture_resource).toBe(7)
  })

  it('clamps the resource delta at max', () => {
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
    const resources = {
      values: { fixture_resource: 9 },
      deltasPerTurn: [{ stat: 'fixture_resource', amount: 5, min: 0, max: 10 }],
    }
    playerParticipant.resources = resources

    const battle: TurnBattle = {
      player: playerParticipant,
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    system.resolveNextStep(battle)

    expect(resources.values.fixture_resource).toBe(10)
  })

  it('does not tick a resource pool the participant does not have', () => {
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

    expect(() => system.resolveNextStep(battle)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run game/src/core/battle/turn/TurnBattleSystem.test.ts`
Expected: FAIL — `totalTurnsElapsed` never increments, `resources.values` never updates.

- [ ] **Step 3: Wire the counter and resource tick**

In `game/src/core/battle/turn/TurnBattleSystem.ts`, add the import:

```typescript
import { applyTurnStartDeltas } from './ResourceTurnHook'
```

Modify `resolveNextStep()` — insert 2 blocks. Right after `const actor = resolved.actor`, insert the counter increment:

```typescript
    const actor = resolved.actor

    battle.totalTurnsElapsed = (battle.totalTurnsElapsed ?? 0) + 1

    const actorBuffSystem = new TurnBuffSystem(actor.buffs)

    actorBuffSystem.update(actor.entity, this.combat, this.registry)

    if (actor.resources) {
      actor.resources.values = applyTurnStartDeltas(actor.resources.values, actor.resources.deltasPerTurn)
    }

    const ccBlocked = actorBuffSystem.isStunned() || actorBuffSystem.isFrozen()
```

(This replaces the corresponding lines from Slice 3's version — the counter increment is new before the buff tick, and the resource-tick block is new between the buff tick and the `ccBlocked` line. Everything else in `resolveNextStep()` stays exactly as Slice 3 left it.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run game/src/core/battle/turn/TurnBattleSystem.test.ts game/src/core/battle/turn/TurnBattleSystem.adversarial.test.ts game/src/core/battle/turn/TurnBattleSystem.qadebug.test.ts`
Expected: PASS — all pre-existing cases (none read `totalTurnsElapsed`/`resources`) plus the 4 new cases.

- [ ] **Step 5: Typecheck**

Run: `npx vue-tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnBattleSystem.test.ts
git commit -m "feat(turn-combat): wire totalTurnsElapsed counter + resource tick (Slice 4 task 2)"
```

---

### Task 3: Wire boss trigger — self-apply a buff after N total turns

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts`
- Test: `game/src/core/battle/turn/TurnBattleSystem.test.ts`

**Interfaces:**
- Consumes: `isTurnTriggerReady` (`game/src/core/battle/turn/BossTurnTriggers.ts`), `TurnBossTrigger` (Task 1), `TurnBuffSystem`/`TurnBuffRegistry` (Slice 3).
- Produces: nothing new for later tasks — final integration point of this slice.

- [ ] **Step 1: Write the failing tests**

Append to `game/src/core/battle/turn/TurnBattleSystem.test.ts`:

```typescript
const ENRAGE_DEFINITION: TurnBuffDefinition = {
  id: 'fixture_enrage',
  name: 'Fixture Enrage',
  polarity: 'buff',
  duration: 999,
  stackMode: 'refresh',
  effects: [{ type: 'dot', dpsRatio: 0.1, element: 'physical' }],
}

describe('TurnBattleSystem.resolveNextStep boss trigger', () => {
  it('fires the boss trigger and applies the buff to self once totalTurnsElapsed reaches afterTurns', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const enemyParticipant = makeParticipant('enemy', enemyEntity, 10, 1)
    const bossTrigger = { afterTurns: 1, buffDefinitionId: 'fixture_enrage', firedAlready: false }
    enemyParticipant.bossTrigger = bossTrigger

    const battle: TurnBattle = {
      player: makeParticipant('player', player, 10, 0),
      enemies: [enemyParticipant],
      state: 'fighting',
    }

    const registry = new FixtureBuffRegistry([ENRAGE_DEFINITION])
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, registry)

    // Turn 1: player acts (totalTurnsElapsed becomes 1). Turn 2: enemy acts
    // (totalTurnsElapsed becomes 2, already >= afterTurns 1 by then).
    system.resolveNextStep(battle)
    system.resolveNextStep(battle)

    expect(bossTrigger.firedAlready).toBe(true)
    expect(enemyParticipant.buffs.getAll().some((buff) => buff.id === 'fixture_enrage')).toBe(true)
  })

  it('does not fire twice even after many more of the boss own turns', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const enemyParticipant = makeParticipant('enemy', enemyEntity, 10, 1)
    enemyParticipant.bossTrigger = { afterTurns: 1, buffDefinitionId: 'fixture_enrage', firedAlready: false }

    const battle: TurnBattle = {
      player: makeParticipant('player', player, 10, 0),
      enemies: [enemyParticipant],
      state: 'fighting',
    }

    const registry = new FixtureBuffRegistry([ENRAGE_DEFINITION])
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, registry)

    for (let i = 0; i < 6; i++) {
      system.resolveNextStep(battle)
    }

    const afterBuffs = enemyParticipant.buffs.getAll().filter((buff) => buff.id === 'fixture_enrage')

    expect(afterBuffs).toHaveLength(1)
  })

  it('does not fire before totalTurnsElapsed reaches afterTurns', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const enemyParticipant = makeParticipant('enemy', enemyEntity, 10, 1)
    const bossTrigger = { afterTurns: 999, buffDefinitionId: 'fixture_enrage', firedAlready: false }
    enemyParticipant.bossTrigger = bossTrigger

    const battle: TurnBattle = {
      player: makeParticipant('player', player, 10, 0),
      enemies: [enemyParticipant],
      state: 'fighting',
    }

    const registry = new FixtureBuffRegistry([ENRAGE_DEFINITION])
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, registry)

    system.resolveNextStep(battle)
    system.resolveNextStep(battle)

    expect(bossTrigger.firedAlready).toBe(false)
    expect(enemyParticipant.buffs.getAll()).toEqual([])
  })

  it('does not throw and does not fire when no registry was provided', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const enemyParticipant = makeParticipant('enemy', enemyEntity, 10, 1)
    const bossTrigger = { afterTurns: 1, buffDefinitionId: 'fixture_enrage', firedAlready: false }
    enemyParticipant.bossTrigger = bossTrigger

    const battle: TurnBattle = {
      player: makeParticipant('player', player, 10, 0),
      enemies: [enemyParticipant],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    expect(() => {
      system.resolveNextStep(battle)
      system.resolveNextStep(battle)
    }).not.toThrow()

    expect(bossTrigger.firedAlready).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run game/src/core/battle/turn/TurnBattleSystem.test.ts`
Expected: FAIL — `bossTrigger` is never read by `resolveNextStep()` yet.

- [ ] **Step 3: Wire the boss trigger check**

In `game/src/core/battle/turn/TurnBattleSystem.ts`, add the import:

```typescript
import { isTurnTriggerReady } from './BossTurnTriggers'
```

Modify `resolveNextStep()` — insert the boss trigger check right after the resource-tick block from Task 2, still before `const ccBlocked = ...`:

```typescript
    if (actor.resources) {
      actor.resources.values = applyTurnStartDeltas(actor.resources.values, actor.resources.deltasPerTurn)
    }

    if (
      actor.bossTrigger &&
      !actor.bossTrigger.firedAlready &&
      this.registry &&
      isTurnTriggerReady({ afterTurns: actor.bossTrigger.afterTurns }, battle.totalTurnsElapsed ?? 0)
    ) {
      const definition = this.registry.get(actor.bossTrigger.buffDefinitionId)

      new TurnBuffSystem(actor.buffs).apply(definition, actor.entity, actor.entity, this.registry)

      actor.bossTrigger.firedAlready = true
    }

    const ccBlocked = actorBuffSystem.isStunned() || actorBuffSystem.isFrozen()
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
git commit -m "feat(turn-combat): wire boss turn trigger, self-applies buff once (Slice 4 task 3)"
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
git commit -m "fix: address regressions found during Slice 4 full-suite verification"
```

If no fixes were needed, skip this step.

## Not Covered By This Plan

- `MomentumBreak.ts` — dropped entirely, not wired by this or any future slice.
- Real content migration: mapping Pháp Tu/Kiếm Tu resource regen rules onto `CombatEntity`'s real named fields, and real boss enrage data (`TribulationPhase.ts`'s `BossEnrage`) into `TurnBossTrigger`/real `TurnBuffDefinition`s — separate future work, tracked in the roadmap.
- Any change to `BattleSystem.ts`, `TribulationPhase.ts`, `HazardZoneSystem.ts`, or `GameManager.ts`.
