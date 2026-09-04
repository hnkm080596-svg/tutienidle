# Turn Battle System — Slice 2: 3-Skill Action Model — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `TurnBattleSystem` real skill actions — each combatant (player and enemy, symmetric) picks from exactly 3 fixed roles (`basic`/`special`/`ultimate`) each turn instead of Slice 1's hardcoded basic attack, with turn-count cooldowns, resource gating, and AOE targeting — while switching the engine's calling convention from `runToCompletion()` (run-to-end) to a step-oriented `resolveNextStep()` that every later slice will build on.

**Architecture:** One new file, `game/src/core/battle/turn/TurnSkillAction.ts`, holds the skill-selection/resource/targeting pure functions (matching the existing `ActionGauge.ts`/`TurnQueue.ts` one-concern-per-file pattern). `TurnBattleSystem.ts` is modified to add optional skill fields on `TurnBattleParticipant` and to implement `resolveNextStep()`, with `runToCompletion()` becoming a thin loop wrapper over it. `basic`/`special`/`ultimate` are all optional on `TurnBattleParticipant` — when absent, the engine falls back to Slice 1's exact hardcoded `{ kind: 'physical', multiplier: 1 }` single-target basic attack, so every existing Slice 1 test keeps passing unmodified.

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-turn-battle-system-slice2-skill-actions-design.md`

## Global Constraints

- Do not modify `game/src/core/battle/BattleSystem.ts` or `game/src/core/game/GameManager.ts` — `TurnBattleSystem` stays standalone/headless, untouched by this slice.
- Do not modify `game/src/core/combat/CombatSystem.ts`, `game/src/core/battle/ActionTargetingSystem.ts`, `game/src/core/skill/Skill.ts`, or `game/src/core/combat/CombatEntity.ts` — read/import from them only.
- No `any` types.
- No content migration: skills used in this plan's tests are fixture `TurnSkillDefinition` objects, not real game skill IDs. No buff/debuff application (pure damage only) — deferred to Slice 3.
- Cooldown values, when they eventually come from real content, convert 1:1 from real-seconds to turn-count — not relevant to this plan's fixtures, but no code here should imply any other conversion ratio.

---

### Task 1: `TurnSkillAction.ts` — types + resource gating

**Files:**
- Create: `game/src/core/battle/turn/TurnSkillAction.ts`
- Test: `game/src/core/battle/turn/TurnSkillAction.test.ts`

**Interfaces:**
- Consumes: `CombatEntity` (`game/src/core/combat/CombatEntity.ts`), `SkillResourceType` (`game/src/core/skill/SkillTypes.ts`), `ActionDamageInfo` (`game/src/core/battle/ActionImpactSystem.ts`), `ActionTargeting` (`game/src/core/battle/CombatAction.ts`).
- Produces: `TurnSkillDefinition`, `TurnSkillSlot`, `hasResourceFor(entity, skill): boolean`, `consumeResourceFor(entity, skill): void` — used by Task 2.

- [ ] **Step 1: Write the failing tests**

Create `game/src/core/battle/turn/TurnSkillAction.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { hasResourceFor, consumeResourceFor, type TurnSkillDefinition } from './TurnSkillAction'
import type { CombatEntity } from '../../combat/CombatEntity'
import { createBaseStats } from '../../stats/StatBlock'

function entity(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats()

  return {
    id: 'id',
    name: 'name',
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: 50,
    currentSwordIntent: 30,
    currentMomentum: 10,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  } as CombatEntity
}

function skill(overrides: Partial<TurnSkillDefinition> = {}): TurnSkillDefinition {
  return {
    id: 'fixture_skill',
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1 },
    targeting: { shape: 'single' },
    ...overrides,
  }
}

describe('hasResourceFor', () => {
  it('true when skill has no resourceType', () => {
    expect(hasResourceFor(entity(), skill())).toBe(true)
  })

  it('true when resourceType is none', () => {
    expect(hasResourceFor(entity(), skill({ resourceType: 'none', resourceCost: 999 }))).toBe(true)
  })

  it('true when mana cost is affordable', () => {
    expect(hasResourceFor(entity({ currentMp: 50 }), skill({ resourceType: 'mana', resourceCost: 50 }))).toBe(true)
  })

  it('false when mana cost exceeds current mana', () => {
    expect(hasResourceFor(entity({ currentMp: 10 }), skill({ resourceType: 'mana', resourceCost: 50 }))).toBe(false)
  })

  it('checks sword_intent pool', () => {
    expect(hasResourceFor(entity({ currentSwordIntent: 30 }), skill({ resourceType: 'sword_intent', resourceCost: 30 }))).toBe(true)
    expect(hasResourceFor(entity({ currentSwordIntent: 29 }), skill({ resourceType: 'sword_intent', resourceCost: 30 }))).toBe(false)
  })

  it('checks momentum pool', () => {
    expect(hasResourceFor(entity({ currentMomentum: 10 }), skill({ resourceType: 'momentum', resourceCost: 10 }))).toBe(true)
    expect(hasResourceFor(entity({ currentMomentum: 5 }), skill({ resourceType: 'momentum', resourceCost: 10 }))).toBe(false)
  })
})

describe('consumeResourceFor', () => {
  it('subtracts resource cost from the matching pool', () => {
    const source = entity({ currentMp: 50 })

    consumeResourceFor(source, skill({ resourceType: 'mana', resourceCost: 20 }))

    expect(source.currentMp).toBe(30)
  })

  it('no-op when skill has no resourceType', () => {
    const source = entity({ currentMp: 50 })

    consumeResourceFor(source, skill())

    expect(source.currentMp).toBe(50)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run game/src/core/battle/turn/TurnSkillAction.test.ts`
Expected: FAIL — `./TurnSkillAction` does not exist yet.

- [ ] **Step 3: Write `TurnSkillAction.ts` (types + resource gating only)**

```typescript
// Turn-Based Combat Slice 2 (spec 2026-09-04) — skill selection, resource
// gating, and AOE target collection for TurnBattleSystem.resolveNextStep().
// Kept in its own file (separate from TurnBattleSystem.ts) matching the
// existing ActionGauge.ts/TurnQueue.ts one-concern-per-file pattern.
import type { CombatEntity } from '../../combat/CombatEntity'
import type { SkillResourceType } from '../../skill/SkillTypes'
import type { ActionDamageInfo } from '../ActionImpactSystem'
import type { ActionTargeting } from '../CombatAction'

/**
 * Slice 2 skill shape — deliberately NOT the live `Skill` interface
 * (Skill.ts carries 30+ fields for progression/UI/passive concerns this
 * slice doesn't touch). Field names/types mirror the live fields this
 * slice DOES reuse (SkillResourceType, ActionDamageInfo, ActionTargeting)
 * so future content-mapping from real Skill objects is a straight field
 * copy, not a redesign — see design spec §3.
 */
export interface TurnSkillDefinition {
  id: string
  cooldownTurns: number
  resourceType?: SkillResourceType
  resourceCost?: number
  damage: ActionDamageInfo
  targeting: ActionTargeting
}

export interface TurnSkillSlot {
  skill: TurnSkillDefinition
  remainingCooldownTurns: number
}

const RESOURCE_FIELD: Record<
  Exclude<SkillResourceType, 'none'>,
  'currentMp' | 'currentSwordIntent' | 'currentMomentum'
> = {
  mana: 'currentMp',
  sword_intent: 'currentSwordIntent',
  momentum: 'currentMomentum',
}

/**
 * Simplification (design spec §3, "explicitly out of scope: content
 * migration") — checks the resource pool directly, no Kiếm Ý temp-first
 * consumption rule (KiemTuResourceSystem.consumeKiemYTempFirst) or other
 * per-path consumption order. Real content mapping resolves this later.
 */
export function hasResourceFor(entity: CombatEntity, skill: TurnSkillDefinition): boolean {
  if (!skill.resourceType || skill.resourceType === 'none' || !skill.resourceCost) {
    return true
  }

  const field = RESOURCE_FIELD[skill.resourceType]

  return entity[field] >= skill.resourceCost
}

export function consumeResourceFor(entity: CombatEntity, skill: TurnSkillDefinition): void {
  if (!skill.resourceType || skill.resourceType === 'none' || !skill.resourceCost) {
    return
  }

  const field = RESOURCE_FIELD[skill.resourceType]

  entity[field] -= skill.resourceCost
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run game/src/core/battle/turn/TurnSkillAction.test.ts`
Expected: PASS, all 8 cases.

- [ ] **Step 5: Commit**

```bash
git add game/src/core/battle/turn/TurnSkillAction.ts game/src/core/battle/turn/TurnSkillAction.test.ts
git commit -m "feat(turn-combat): add TurnSkillDefinition + resource gating (Slice 2 task 1)"
```

---

### Task 2: `TurnSkillAction.ts` — cooldown ticking + priority selection

**Files:**
- Modify: `game/src/core/battle/turn/TurnSkillAction.ts`
- Test: `game/src/core/battle/turn/TurnSkillAction.test.ts`

**Interfaces:**
- Consumes: `TurnSkillDefinition`/`TurnSkillSlot`/`hasResourceFor`/`consumeResourceFor` (Task 1). `TurnBattleParticipant` — this task ADDS the 3 new optional fields to that interface as part of this step (the interface itself lives in `TurnBattleSystem.ts`, edited here since Task 1's file needs it; Task 4 is the one that wires `resolveNextStep()` to call these functions).
- Produces: `SelectedAction` type, `tickCooldowns(participant): void`, `selectAction(participant): SelectedAction`, `commitAction(entity, action): void` — used by Task 4.

- [ ] **Step 1: Add the 3 skill fields to `TurnBattleParticipant`**

In `game/src/core/battle/turn/TurnBattleSystem.ts`, modify the `TurnBattleParticipant` interface (around line 14-21):

```typescript
export interface TurnBattleParticipant {
  id: string
  entity: CombatEntity
  speed: number
  priority: number
  actionGauge: number
  alive: boolean
  basic?: TurnSkillDefinition
  special?: TurnSkillSlot
  ultimate?: TurnSkillSlot
}
```

Add the import at the top of `TurnBattleSystem.ts`:

```typescript
import type { TurnSkillDefinition, TurnSkillSlot } from './TurnSkillAction'
```

- [ ] **Step 2: Write the failing tests**

Append to `game/src/core/battle/turn/TurnSkillAction.test.ts`:

```typescript
import { selectAction, tickCooldowns, commitAction } from './TurnSkillAction'
import type { TurnBattleParticipant } from './TurnBattleSystem'

function participant(overrides: Partial<TurnBattleParticipant> = {}): TurnBattleParticipant {
  return {
    id: 'actor',
    entity: entity(),
    speed: 10,
    priority: 0,
    actionGauge: 0,
    alive: true,
    ...overrides,
  }
}

describe('selectAction priority', () => {
  it('falls back to the hardcoded basic attack when no skill fields are set', () => {
    const action = selectAction(participant())

    expect(action.skillId).toBe('basic_attack')
    expect(action.damage).toEqual({ kind: 'physical', multiplier: 1 })
    expect(action.slot).toBeNull()
  })

  it('uses the basic skill when set and no special/ultimate are ready', () => {
    const basic = skill({ id: 'basic_skill' })

    const action = selectAction(participant({ basic }))

    expect(action.skillId).toBe('basic_skill')
    expect(action.slot).toBeNull()
  })

  it('prefers special over basic when special is off cooldown and affordable', () => {
    const basic = skill({ id: 'basic_skill' })
    const special = { skill: skill({ id: 'special_skill' }), remainingCooldownTurns: 0 }

    const action = selectAction(participant({ basic, special }))

    expect(action.skillId).toBe('special_skill')
    expect(action.slot).toBe(special)
  })

  it('prefers ultimate over special and basic when ultimate is ready', () => {
    const basic = skill({ id: 'basic_skill' })
    const special = { skill: skill({ id: 'special_skill' }), remainingCooldownTurns: 0 }
    const ultimate = { skill: skill({ id: 'ultimate_skill' }), remainingCooldownTurns: 0 }

    const action = selectAction(participant({ basic, special, ultimate }))

    expect(action.skillId).toBe('ultimate_skill')
  })

  it('falls through to special when ultimate is still on cooldown', () => {
    const special = { skill: skill({ id: 'special_skill' }), remainingCooldownTurns: 0 }
    const ultimate = { skill: skill({ id: 'ultimate_skill' }), remainingCooldownTurns: 3 }

    const action = selectAction(participant({ special, ultimate }))

    expect(action.skillId).toBe('special_skill')
  })

  it('falls through to basic when special cannot afford its resource cost', () => {
    const basic = skill({ id: 'basic_skill' })
    const special = {
      skill: skill({ id: 'special_skill', resourceType: 'mana', resourceCost: 999 }),
      remainingCooldownTurns: 0,
    }

    const action = selectAction(participant({ basic, special, entity: entity({ currentMp: 10 }) }))

    expect(action.skillId).toBe('basic_skill')
  })
})

describe('tickCooldowns', () => {
  it('decrements special/ultimate remaining cooldown by 1, floored at 0', () => {
    const special = { skill: skill({ id: 's' }), remainingCooldownTurns: 2 }
    const ultimate = { skill: skill({ id: 'u' }), remainingCooldownTurns: 0 }
    const actor = participant({ special, ultimate })

    tickCooldowns(actor)

    expect(special.remainingCooldownTurns).toBe(1)
    expect(ultimate.remainingCooldownTurns).toBe(0)
  })
})

describe('commitAction', () => {
  it('sets the used slot on cooldown and consumes its resource', () => {
    const special = {
      skill: skill({ id: 's', cooldownTurns: 4, resourceType: 'mana', resourceCost: 20 }),
      remainingCooldownTurns: 0,
    }
    const actor = entity({ currentMp: 50 })

    commitAction(actor, selectAction(participant({ special, entity: actor })))

    expect(special.remainingCooldownTurns).toBe(4)
    expect(actor.currentMp).toBe(30)
  })

  it('is a no-op for the basic-attack fallback (slot is null)', () => {
    const actor = entity({ currentMp: 50 })

    commitAction(actor, selectAction(participant({ entity: actor })))

    expect(actor.currentMp).toBe(50)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run game/src/core/battle/turn/TurnSkillAction.test.ts`
Expected: FAIL — `selectAction`/`tickCooldowns`/`commitAction` not exported yet.

- [ ] **Step 4: Add selection logic to `TurnSkillAction.ts`**

Append to `game/src/core/battle/turn/TurnSkillAction.ts` (add the import at the top alongside the existing ones):

```typescript
import type { TurnBattleParticipant } from './TurnBattleSystem'
```

```typescript
export interface SelectedAction {
  skillId: string
  skill: TurnSkillDefinition | null
  damage: ActionDamageInfo
  targeting: ActionTargeting
  slot: TurnSkillSlot | null
}

const FALLBACK_BASIC_ATTACK: ActionDamageInfo = { kind: 'physical', multiplier: 1 }

const FALLBACK_TARGETING: ActionTargeting = { shape: 'single' }

/**
 * Ticks special/ultimate cooldowns down by 1, floored at 0 — cooldown
 * counts the ACTOR's own turns (this rework's "tick at the holder's own
 * turn" convention, already used by TurnBuffSystem). Call once per actor
 * per turn, BEFORE selectAction().
 */
export function tickCooldowns(participant: TurnBattleParticipant): void {
  if (participant.special) {
    participant.special.remainingCooldownTurns = Math.max(0, participant.special.remainingCooldownTurns - 1)
  }

  if (participant.ultimate) {
    participant.ultimate.remainingCooldownTurns = Math.max(0, participant.ultimate.remainingCooldownTurns - 1)
  }
}

function slotAction(slot: TurnSkillSlot): SelectedAction {
  return {
    skillId: slot.skill.id,
    skill: slot.skill,
    damage: slot.skill.damage,
    targeting: slot.skill.targeting,
    slot,
  }
}

/**
 * Priority: ultimate (off cooldown + affordable) -> special (same) ->
 * basic (no cooldown/cost by construction) -> hardcoded fallback basic
 * attack when the participant has no `basic` set at all (Slice 1
 * backward compatibility — see plan Task 4).
 */
export function selectAction(participant: TurnBattleParticipant): SelectedAction {
  if (
    participant.ultimate &&
    participant.ultimate.remainingCooldownTurns === 0 &&
    hasResourceFor(participant.entity, participant.ultimate.skill)
  ) {
    return slotAction(participant.ultimate)
  }

  if (
    participant.special &&
    participant.special.remainingCooldownTurns === 0 &&
    hasResourceFor(participant.entity, participant.special.skill)
  ) {
    return slotAction(participant.special)
  }

  if (participant.basic) {
    return {
      skillId: participant.basic.id,
      skill: participant.basic,
      damage: participant.basic.damage,
      targeting: participant.basic.targeting,
      slot: null,
    }
  }

  return {
    skillId: 'basic_attack',
    skill: null,
    damage: FALLBACK_BASIC_ATTACK,
    targeting: FALLBACK_TARGETING,
    slot: null,
  }
}

/** Sets the used slot on cooldown and consumes its resource — call AFTER a successful cast (a target was actually hit). No-op for the basic fallback (slot is null). */
export function commitAction(entity: CombatEntity, action: SelectedAction): void {
  if (action.slot) {
    action.slot.remainingCooldownTurns = action.slot.skill.cooldownTurns
  }

  if (action.skill) {
    consumeResourceFor(entity, action.skill)
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run game/src/core/battle/turn/TurnSkillAction.test.ts`
Expected: PASS, all 16 cases (8 from Task 1 + 8 new).

- [ ] **Step 6: Typecheck**

Run: `npx vue-tsc --noEmit` (check `package.json`'s `scripts` for the project's exact typecheck command if this differs).
Expected: PASS — no circular-import errors between `TurnSkillAction.ts` and `TurnBattleSystem.ts` (this is a type-only import via `import type`, which TypeScript/bundlers resolve without a runtime cycle).

- [ ] **Step 7: Commit**

```bash
git add game/src/core/battle/turn/TurnSkillAction.ts game/src/core/battle/turn/TurnSkillAction.test.ts game/src/core/battle/turn/TurnBattleSystem.ts
git commit -m "feat(turn-combat): add skill priority selection + cooldown/commit (Slice 2 task 2)"
```

---

### Task 3: `TurnSkillAction.ts` — AOE target collection

**Files:**
- Modify: `game/src/core/battle/turn/TurnSkillAction.ts`
- Test: `game/src/core/battle/turn/TurnSkillAction.test.ts`

**Interfaces:**
- Consumes: `areaFor` (`game/src/core/battle/ActionTargetingSystem.ts`), `isCellInShape`/`AoeShapeSpec` (`game/src/core/battle/turn/AoeShape.ts`), `entityGridPosition`/`GridPosition` (`game/src/core/battle/BattleGrid.ts`), `TurnBattleParticipant` (`TurnBattleSystem.ts`).
- Produces: `collectTurnTargets(primaryTarget, opposingSide, targeting): TurnBattleParticipant[]` — used by Task 4.

- [ ] **Step 1: Write the failing tests**

Append to `game/src/core/battle/turn/TurnSkillAction.test.ts`:

```typescript
import { collectTurnTargets } from './TurnSkillAction'

describe('collectTurnTargets', () => {
  it('single shape: only the primary target', () => {
    const primary = participant({ id: 'primary', entity: entity({ id: 'primary', x: 2, row: 2 }) })
    const other = participant({ id: 'other', entity: entity({ id: 'other', x: 5, row: 2 }) })

    const affected = collectTurnTargets(primary, [primary, other], { shape: 'single' })

    expect(affected.map((p) => p.id)).toEqual(['primary'])
  })

  it('square shape: includes participants within laneRadius/columnRadius of the primary', () => {
    const primary = participant({ id: 'primary', entity: entity({ id: 'primary', x: 2, row: 2 }) })
    const near = participant({ id: 'near', entity: entity({ id: 'near', x: 3, row: 2 }) })
    const far = participant({ id: 'far', entity: entity({ id: 'far', x: 10, row: 2 }) })

    const affected = collectTurnTargets(primary, [primary, near, far], {
      shape: 'square',
      laneRadius: 1,
      columnRadius: 1,
    })

    expect(affected.map((p) => p.id).sort()).toEqual(['near', 'primary'])
  })

  it('cross shape: includes same row/column within radius, excludes diagonal', () => {
    const primary = participant({ id: 'primary', entity: entity({ id: 'primary', x: 4, row: 4 }) })
    const sameRow = participant({ id: 'sameRow', entity: entity({ id: 'sameRow', x: 5, row: 4 }) })
    const diagonal = participant({ id: 'diagonal', entity: entity({ id: 'diagonal', x: 5, row: 5 }) })

    const affected = collectTurnTargets(primary, [primary, sameRow, diagonal], {
      shape: 'cross',
      laneRadius: 2,
    })

    expect(affected.map((p) => p.id).sort()).toEqual(['primary', 'sameRow'])
  })

  it('excludes dead participants even if inside the shape', () => {
    const primary = participant({ id: 'primary', entity: entity({ id: 'primary', x: 2, row: 2 }) })
    const dead = participant({
      id: 'dead',
      entity: entity({ id: 'dead', x: 2, row: 2, alive: false }),
      alive: false,
    })

    const affected = collectTurnTargets(primary, [primary, dead], { shape: 'square', laneRadius: 2, columnRadius: 2 })

    expect(affected.map((p) => p.id)).toEqual(['primary'])
  })

  it('always includes the primary target even outside the shape bounds (defensive)', () => {
    const primary = participant({ id: 'primary', entity: entity({ id: 'primary', x: 2, row: 2 }) })

    const affected = collectTurnTargets(primary, [primary], { shape: 'column' })

    expect(affected.map((p) => p.id)).toEqual(['primary'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run game/src/core/battle/turn/TurnSkillAction.test.ts`
Expected: FAIL — `collectTurnTargets` not exported yet.

- [ ] **Step 3: Add `collectTurnTargets` to `TurnSkillAction.ts`**

Add these imports at the top of `game/src/core/battle/turn/TurnSkillAction.ts`:

```typescript
import { areaFor } from '../ActionTargetingSystem'
import { entityGridPosition, type GridPosition } from '../BattleGrid'
import { isCellInShape, type AoeShapeSpec } from './AoeShape'
```

Append:

```typescript
/**
 * AOE target collection for TurnBattle — mirrors ActionTargetingSystem.
 * collectAffected()'s shape-filter logic, but over TurnBattleParticipant[]
 * instead of a live Battle (Slice 1/2 stays standalone, no Battle
 * coupling). The primary target is always included even when the shape
 * math would exclude it, matching live collectAffected()'s "primary
 * always hits" guarantee.
 */
export function collectTurnTargets(
  primaryTarget: TurnBattleParticipant,
  opposingSide: TurnBattleParticipant[],
  targeting: ActionTargeting,
): TurnBattleParticipant[] {
  const anchor = entityGridPosition(primaryTarget.entity)

  const inShape = (position: GridPosition): boolean => {
    if (targeting.shape === 'cross') {
      const spec: AoeShapeSpec = { shape: 'cross', radius: targeting.laneRadius ?? 0 }

      return isCellInShape(anchor, spec, position)
    }

    const area = areaFor(anchor.row, anchor.column, targeting)

    if (!area) {
      return false
    }

    return (
      position.row >= area.rowStart &&
      position.row <= area.rowEnd &&
      position.column >= area.colStart &&
      position.column <= area.colEnd
    )
  }

  const living = opposingSide.filter((participant) => participant.entity.alive)

  const affected = living.filter((participant) => {
    if (participant.id === primaryTarget.id) {
      return true
    }

    return inShape(entityGridPosition(participant.entity))
  })

  return affected.length > 0 ? affected : [primaryTarget]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run game/src/core/battle/turn/TurnSkillAction.test.ts`
Expected: PASS, all 21 cases (16 from Task 1+2 + 5 new).

- [ ] **Step 5: Commit**

```bash
git add game/src/core/battle/turn/TurnSkillAction.ts game/src/core/battle/turn/TurnSkillAction.test.ts
git commit -m "feat(turn-combat): add collectTurnTargets AOE collection (Slice 2 task 3)"
```

---

### Task 4: `TurnBattleSystem.ts` — `resolveNextStep()` + `runToCompletion()` wrapper

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts`
- Test: `game/src/core/battle/turn/TurnBattleSystem.test.ts` (existing file — new cases appended, no existing case modified)

**Interfaces:**
- Consumes: `tickCooldowns`/`selectAction`/`commitAction`/`collectTurnTargets` (Task 2/3), `resolveNextTurn` (`TurnQueue.ts`), `consumeGaugeAfterAction` (`ActionGauge.ts`), `resolveActionHit` (`CombatSystem.ts`) — all already imported/used by Slice 1.
- Produces: `TurnStepResult` type, `TurnBattleSystem.resolveNextStep(battle): TurnStepResult` — the production entry point every later slice (3-7) calls instead of `runToCompletion()`.

- [ ] **Step 1: Write the failing tests**

Append to `game/src/core/battle/turn/TurnBattleSystem.test.ts`:

```typescript
import type { TurnSkillDefinition } from './TurnSkillAction'

function fixtureSkill(overrides: Partial<TurnSkillDefinition> = {}): TurnSkillDefinition {
  return {
    id: 'fixture_skill',
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1 },
    targeting: { shape: 'single' },
    ...overrides,
  }
}

describe('TurnBattleSystem.resolveNextStep', () => {
  it('reports the acting participant, chosen skillId, and hit target for one step', () => {
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

    expect(step.state).toBe('fighting')
    expect(step.actorId).toBe('player')
    expect(step.skillId).toBe('basic_attack')
    expect(step.targetIds).toEqual(['enemy'])
    expect(enemyEntity.currentHp).toBeLessThan(1_000_000)
  })

  it('uses the special skill when set instead of the hardcoded basic attack', () => {
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
    playerParticipant.special = { skill: fixtureSkill({ id: 'special_skill', cooldownTurns: 2 }), remainingCooldownTurns: 0 }

    const battle: TurnBattle = {
      player: playerParticipant,
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const step = system.resolveNextStep(battle)

    expect(step.skillId).toBe('special_skill')
    expect(playerParticipant.special.remainingCooldownTurns).toBe(2)
  })

  it('runToCompletion still resolves a full battle to victory using resolveNextStep under the hood', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1,
      maxHp: 1,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const battle: TurnBattle = {
      player: makeParticipant('player', player, 10, 0),
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const result = system.runToCompletion(battle)

    expect(result).toBe('victory')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run game/src/core/battle/turn/TurnBattleSystem.test.ts`
Expected: FAIL — `resolveNextStep` does not exist yet.

- [ ] **Step 3: Implement `resolveNextStep()`, rewrite `runToCompletion()`**

In `game/src/core/battle/turn/TurnBattleSystem.ts`, add this import:

```typescript
import { tickCooldowns, selectAction, commitAction, collectTurnTargets } from './TurnSkillAction'
```

Add the `TurnStepResult` type (near `TurnBattleState`):

```typescript
export interface TurnStepResult {
  state: TurnBattleState
  actorId: string
  skillId: string
  targetIds: string[]
}
```

Replace the body of the `TurnBattleSystem` class (the `constructor` stays unchanged; only `runToCompletion()` changes and `resolveNextStep()` is added):

```typescript
export class TurnBattleSystem {
  constructor(
    private readonly combat: CombatSystem,
    private readonly maxTurns: number = DEFAULT_MAX_TURNS,
  ) {}

  /**
   * Resolves exactly ONE actor's turn. Production entry point from Slice
   * 3 onward — GameManager/UI call this repeatedly instead of running a
   * battle to completion in one call (needed once Slice 5 adds wave
   * pauses and Slice 7 adds manual input waits).
   */
  resolveNextStep(battle: TurnBattle): TurnStepResult {
    const allParticipants = [battle.player, ...battle.enemies]

    for (const participant of allParticipants) {
      participant.alive = participant.entity.alive
    }

    const resolved = resolveNextTurn(allParticipants)

    if (!resolved) {
      battle.state = 'defeat'
      return { state: 'defeat', actorId: '', skillId: '', targetIds: [] }
    }

    const actor = resolved.actor

    tickCooldowns(actor)

    const action = selectAction(actor)

    const opposingSide = actor === battle.player ? battle.enemies : [battle.player]
    const primaryTarget = selectTarget(actor, opposingSide)

    const targetIds: string[] = []

    if (primaryTarget) {
      const affected = collectTurnTargets(primaryTarget, opposingSide, action.targeting)

      for (const target of affected) {
        this.combat.resolveActionHit(actor.entity, target.entity, action.damage)
        targetIds.push(target.id)
      }

      commitAction(actor.entity, action)
    }

    consumeGaugeAfterAction(actor)

    if (!battle.player.entity.alive) {
      battle.state = 'defeat'
    } else if (battle.enemies.every((enemy) => !enemy.entity.alive)) {
      battle.state = 'victory'
    }

    return { state: battle.state, actorId: actor.id, skillId: action.skillId, targetIds }
  }

  /** Thin wrapper for tests/dev tooling — loops resolveNextStep() to completion. */
  runToCompletion(battle: TurnBattle): TurnBattleState {
    for (let turn = 0; turn < this.maxTurns; turn++) {
      const step = this.resolveNextStep(battle)

      if (step.state !== 'fighting') {
        return step.state
      }
    }

    battle.state = 'defeat'
    return battle.state
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run game/src/core/battle/turn/TurnBattleSystem.test.ts game/src/core/battle/turn/TurnBattleSystem.adversarial.test.ts`
Expected: PASS — all pre-existing Slice 1 cases (11 across both files) still pass unmodified (they never set `basic`/`special`/`ultimate`, so they exercise the hardcoded-fallback path exactly as before), plus the 3 new `resolveNextStep` cases.

- [ ] **Step 5: Typecheck**

Run: `npx vue-tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnBattleSystem.test.ts
git commit -m "feat(turn-combat): TurnBattleSystem.resolveNextStep() step API + skill actions (Slice 2 task 4)"
```

---

### Task 5: Full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, zero regressions. `TurnBattleSystem.ts`/`TurnSkillAction.ts` are the only production files touched, both under `game/src/core/battle/turn/`, not imported by any live file — nothing outside the `turn/` test suite should be affected.

- [ ] **Step 2: Run typecheck**

Run: `npx vue-tsc --noEmit` (or the project's existing typecheck script — check `package.json`'s `scripts` for the exact command already used elsewhere in this repo before running).
Expected: PASS, zero errors.

- [ ] **Step 3: Commit any fixups**

If Step 1-2 required fixes beyond what Tasks 1-4 anticipated, stage exactly the changed files and commit:

```bash
git add -A
git commit -m "fix: address regressions found during Slice 2 full-suite verification"
```

If no fixes were needed, skip this step.

## Not Covered By This Plan

- Buff/debuff application on skill cast — Slice 3 (`TurnBuffSystem` wiring).
- Content migration: deciding which real skill fills `basicSkillId`/`specialSkillId`/`ultimateSkillId` for any actual build (Pháp Tu Thuần chain, Kiếm Tu, Thể Tu, Phàm Nhân) — separate data work, tracked in the roadmap.
- Enemy content migration off `Enemy.specialAttacks[]` — separate content work across `Enemies.ts`, tracked in the roadmap.
- The Pháp Tu Reaction hidden path (book mechanic + situational element AI) — deferred, tracked in the roadmap, not part of the 3-skill model at all.
- Node Tree / Element Slot / ProgressionNode redesign — deferred, tracked in the roadmap.
- Any change to `BattleSystem.ts`, `GameManager.ts`, or any UI component.
