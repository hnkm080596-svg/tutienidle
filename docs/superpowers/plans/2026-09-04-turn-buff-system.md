# TurnBuffSystem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully standalone, turn-based buff/debuff engine (`TurnBuffSystem`) that ports the live `BuffSystem.ts`'s apply/stack/tick/expire/convert logic 1:1, replacing real-seconds duration with turn counts — without modifying, importing from, or being called by any file that currently drives live combat.

**Architecture:** Three new files under `game/src/core/battle/turn/`: `TurnBuffTypes.ts` (data shapes, parallel to `BuffTypes.ts`/`BuffDefinition.ts`/`Buff.ts`), `TurnBuffPool.ts` (parallel to `BuffPool.ts`), `TurnBuffSystem.ts` (parallel to `BuffSystem.ts`). Pure calculation helpers with no time semantics (`getArmorMitigationPercent`, `getResistanceMitigationPercent`, `elementalBasePower`, `getSkillRuntimeStat`) are reused via import from their existing locations — only the time-coupled `BuffSystem.ts` itself is not touched or imported.

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-turn-buff-system-design.md`

## Global Constraints

- Do not modify `game/src/core/buff/BuffSystem.ts`, `Buff.ts`, `BuffPool.ts`, `BuffTypes.ts`, `BuffDefinition.ts`, `BuffRegistry.ts` — these drive live real-time combat and must be untouched.
- Do not modify `game/src/core/battle/BattleSystem.ts` or any of its 4 `BuffSystem.update()` call sites.
- Do not modify any buff content file (`game/src/data/buff/buffs.ts`, `TribulationPhase.ts` enrage data, equipment/talent passive definitions).
- Do not modify any presentation/VFX file (`combat-vfx-spawner.ts`, `combat-status-tooltip.ts`, `CombatScene.ts`).
- `TurnBuffSystem`'s `update()` takes no `deltaSeconds` parameter — one call ticks exactly one turn.
- Field renames vs. the live system: `remainingTime`→`remainingTurns`, `continuousSeconds`→`continuousTurns`, `convertsAfterContinuousSeconds`→`convertsAfterContinuousTurns`, `damagePerSecond`→`damagePerTurn`. `duration` and `dpsRatio` keep their names (unit-agnostic).
- No balance re-tuning: numeric `duration`/`convertsAfterContinuousTurns` values are irrelevant to this plan (no content file is touched) — this plan only builds the mechanism.

---

### Task 1: `TurnBuffTypes.ts` + `TurnBuffPool.ts`

**Files:**
- Create: `game/src/core/battle/turn/TurnBuffTypes.ts`
- Create: `game/src/core/battle/turn/TurnBuffPool.ts`
- Test: `game/src/core/battle/turn/TurnBuffPool.test.ts`

**Interfaces:**
- Consumes: `StatType` from `game/src/core/stats/StatTypes.ts` (type-only import, no behavior change — this is the same type the live `BuffTypes.ts` already imports), `ElementType` from `game/src/core/element/ElementType.ts` (same reuse).
- Produces (used by every later task): `TurnBuffPolarity = 'buff' | 'debuff'`, `TurnBuffStackMode = 'stack' | 'refresh' | 'replace'`, `TurnBuffCcEffect = 'stun' | 'freeze' | 'root'`, `TurnBuffEffectTemplate` (union of `TurnStatModifierEffect | TurnDotEffectTemplate | TurnCcEffect | TurnOnHitProcEffect`), `TurnBuffEffect` (union of `TurnStatModifierEffect | TurnDotEffect | TurnCcEffect | TurnOnHitProcEffect`), `TurnBuffDefinition`, `TurnBuff`, `TurnBuffRegistry { get(id: string): TurnBuffDefinition }`, and `class TurnBuffPool` with methods `getAllById(id: string): TurnBuff[]`, `getFromSource(id: string, sourceId: string): TurnBuff | undefined`, `getAll(): TurnBuff[]`, `hasAny(id: string): boolean`, `add(buff: TurnBuff): void`, `removeInstance(id: string, sourceId: string): void`, `removeAllById(id: string): void`, `clear(): void`.

- [ ] **Step 1: Write the failing test for `TurnBuffPool`**

Create `game/src/core/battle/turn/TurnBuffPool.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { TurnBuffPool } from './TurnBuffPool'
import type { TurnBuff } from './TurnBuffTypes'

function makeBuff(overrides: Partial<TurnBuff> = {}): TurnBuff {
  return {
    id: 'test_buff',
    sourceId: 'source_1',
    targetId: 'target_1',
    polarity: 'debuff',
    duration: 5,
    remainingTurns: 5,
    stacks: 1,
    stackMode: 'refresh',
    continuousTurns: 0,
    effects: [],
    ...overrides,
  }
}

describe('TurnBuffPool', () => {
  it('add + getFromSource finds the exact (id, sourceId) instance', () => {
    const pool = new TurnBuffPool()
    pool.add(makeBuff())

    expect(pool.getFromSource('test_buff', 'source_1')).toBeDefined()
    expect(pool.getFromSource('test_buff', 'other_source')).toBeUndefined()
  })

  it('getAllById returns every instance of an id regardless of source', () => {
    const pool = new TurnBuffPool()
    pool.add(makeBuff({ sourceId: 'source_1' }))
    pool.add(makeBuff({ sourceId: 'source_2' }))

    expect(pool.getAllById('test_buff')).toHaveLength(2)
  })

  it('hasAny reflects presence by id only', () => {
    const pool = new TurnBuffPool()
    expect(pool.hasAny('test_buff')).toBe(false)

    pool.add(makeBuff())
    expect(pool.hasAny('test_buff')).toBe(true)
  })

  it('removeInstance removes only the matching (id, sourceId) pair', () => {
    const pool = new TurnBuffPool()
    pool.add(makeBuff({ sourceId: 'source_1' }))
    pool.add(makeBuff({ sourceId: 'source_2' }))

    pool.removeInstance('test_buff', 'source_1')

    expect(pool.getFromSource('test_buff', 'source_1')).toBeUndefined()
    expect(pool.getFromSource('test_buff', 'source_2')).toBeDefined()
  })

  it('removeAllById removes every instance of an id across all sources', () => {
    const pool = new TurnBuffPool()
    pool.add(makeBuff({ sourceId: 'source_1' }))
    pool.add(makeBuff({ sourceId: 'source_2' }))

    pool.removeAllById('test_buff')

    expect(pool.getAll()).toHaveLength(0)
  })

  it('clear empties the pool', () => {
    const pool = new TurnBuffPool()
    pool.add(makeBuff())
    pool.clear()

    expect(pool.getAll()).toHaveLength(0)
  })

  it('getAll returns a snapshot copy, not the live internal array', () => {
    const pool = new TurnBuffPool()
    pool.add(makeBuff())

    const snapshot = pool.getAll()
    snapshot.push(makeBuff({ id: 'injected' }))

    expect(pool.getAll()).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run game/src/core/battle/turn/TurnBuffPool.test.ts`
Expected: FAIL — `./TurnBuffPool` and `./TurnBuffTypes` do not exist yet.

- [ ] **Step 3: Write `TurnBuffTypes.ts`**

```typescript
import type { StatType } from '../../stats/StatTypes'
import type { ElementType } from '../../element/ElementType'

export type TurnBuffPolarity = 'buff' | 'debuff'

export type TurnBuffStackMode = 'stack' | 'refresh' | 'replace'

export type TurnBuffCcEffect = 'stun' | 'freeze' | 'root'

// --- Template-time shapes (TurnBuffDefinition.effects) ---

export interface TurnStatModifierEffect {
  type: 'statModifier'
  stat: StatType
  percent?: number
  flat?: number
}

export interface TurnDotEffectTemplate {
  type: 'dot'
  dpsRatio: number
  element?: ElementType | 'physical'
  poisonRootPercentPerStack?: number
  poisonRootMaxStacks?: number
  poisonRootThresholdBonusPercent?: number
  armorIgnorePercentByRealm?: boolean
}

export interface TurnCcEffect {
  type: 'cc'
  ccEffect: TurnBuffCcEffect
}

export interface TurnOnHitProcEffect {
  type: 'onHitProc'
  chance: number
  appliesBuffId: string
}

export type TurnBuffEffectTemplate =
  | TurnStatModifierEffect
  | TurnDotEffectTemplate
  | TurnCcEffect
  | TurnOnHitProcEffect

// --- Runtime shapes (TurnBuff.effects) ---

export interface TurnDotEffect {
  type: 'dot'
  damagePerTurn: number
  element?: ElementType | 'physical'
  poisonRootPercentPerStack?: number
  poisonRootMaxStacks?: number
  poisonRootThresholdBonusPercent?: number
}

export type TurnBuffEffect = TurnStatModifierEffect | TurnDotEffect | TurnCcEffect | TurnOnHitProcEffect

export interface TurnBuffDefinition {
  id: string
  name: string
  description?: string
  polarity: TurnBuffPolarity
  hidden?: boolean

  duration: number
  maxStacks?: number
  stackMode: TurnBuffStackMode

  convertsToId?: string
  convertsAfterContinuousTurns?: number

  effects: TurnBuffEffectTemplate[]
}

export interface TurnBuff {
  id: string
  sourceId: string
  targetId: string
  polarity: TurnBuffPolarity
  hidden?: boolean

  duration: number
  remainingTurns: number
  stacks: number
  maxStacks?: number
  stackMode: TurnBuffStackMode

  continuousTurns: number
  convertsToId?: string
  convertsAfterContinuousTurns?: number

  effects: TurnBuffEffect[]
}

export interface TurnBuffRegistry {
  get(id: string): TurnBuffDefinition
}
```

- [ ] **Step 4: Write `TurnBuffPool.ts`**

```typescript
import type { TurnBuff } from './TurnBuffTypes'

export class TurnBuffPool {
  private buffs: TurnBuff[] = []

  getAllById(id: string): TurnBuff[] {
    return this.buffs.filter((buff) => buff.id === id)
  }

  getFromSource(id: string, sourceId: string): TurnBuff | undefined {
    return this.buffs.find((buff) => buff.id === id && buff.sourceId === sourceId)
  }

  getAll(): TurnBuff[] {
    return [...this.buffs]
  }

  hasAny(id: string): boolean {
    return this.buffs.some((buff) => buff.id === id)
  }

  add(buff: TurnBuff): void {
    this.buffs.push(buff)
  }

  removeInstance(id: string, sourceId: string): void {
    this.buffs = this.buffs.filter((buff) => !(buff.id === id && buff.sourceId === sourceId))
  }

  removeAllById(id: string): void {
    this.buffs = this.buffs.filter((buff) => buff.id !== id)
  }

  clear(): void {
    this.buffs = []
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run game/src/core/battle/turn/TurnBuffPool.test.ts`
Expected: PASS, all 7 cases.

- [ ] **Step 6: Commit**

```bash
git add game/src/core/battle/turn/TurnBuffTypes.ts game/src/core/battle/turn/TurnBuffPool.ts game/src/core/battle/turn/TurnBuffPool.test.ts
git commit -m "feat(turn-combat): add TurnBuffTypes and TurnBuffPool (standalone, no live BuffSystem coupling)"
```

---

### Task 2: `TurnBuffSystem.apply()` + stacking + conversion

**Files:**
- Create: `game/src/core/battle/turn/TurnBuffSystem.ts`
- Test: `game/src/core/battle/turn/TurnBuffSystem.test.ts`

**Interfaces:**
- Consumes: `TurnBuffPool` (Task 1), `TurnBuff`/`TurnBuffDefinition`/`TurnBuffEffectTemplate`/`TurnBuffRegistry` (Task 1), `CombatEntity` type from `game/src/core/combat/CombatEntity.ts` (read-only reuse, `.stats.ailmentResistPercent`, `.stats.ailmentDurationPercent`, `.id`, `.skillStats?.maxStacksBonusByBuffId`), `createBaseStats()` from `game/src/core/stats/StatBlock.ts` (test fixture only).
- Produces (used by Task 3): `class TurnBuffSystem` constructed as `new TurnBuffSystem(pool: TurnBuffPool)`, with public method `apply(definition: TurnBuffDefinition, source: CombatEntity, target: CombatEntity, registry?: TurnBuffRegistry): void`.

- [ ] **Step 1: Write the failing tests**

Create `game/src/core/battle/turn/TurnBuffSystem.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest'
import { TurnBuffSystem } from './TurnBuffSystem'
import { TurnBuffPool } from './TurnBuffPool'
import type { TurnBuffDefinition, TurnBuffRegistry } from './TurnBuffTypes'
import type { CombatEntity } from '../../combat/CombatEntity'
import type { CombatSystem } from '../../combat/CombatSystem'
import { createBaseStats } from '../../stats/StatBlock'

function makeEntity(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, criticalRate: 0, blockChance: 0, ...overrides.stats }
  const { stats: _overrideStats, ...restOverrides } = overrides
  return {
    id: 'id',
    name: 'name',
    type: 'enemy',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentSwordIntent: 0,
    currentMomentum: 0,
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
    ...restOverrides,
  } as CombatEntity
}

function makeCombatSystem(): CombatSystem {
  return { applyDotDamage: vi.fn() } as unknown as CombatSystem
}

describe('TurnBuffSystem.apply — fresh instance', () => {
  it('creates a TurnBuff with remainingTurns === resolved duration', () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = makeEntity({ id: 'source_1' })
    const target = makeEntity({ id: 'target_1' })
    const definition: TurnBuffDefinition = {
      id: 'test_buff', name: 'Test', polarity: 'debuff',
      duration: 5, stackMode: 'refresh', effects: [],
    }

    system.apply(definition, source, target)

    const instance = pool.getFromSource('test_buff', 'source_1')
    expect(instance).toBeDefined()
    expect(instance!.remainingTurns).toBe(5)
    expect(instance!.duration).toBe(5)
    expect(instance!.continuousTurns).toBe(0)
    expect(instance!.stacks).toBe(1)
  })

  it('duration shrinks with target.stats.ailmentResistPercent', () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = makeEntity({ id: 'source_1' })
    const target = makeEntity({ id: 'target_1', stats: { ...createBaseStats(), evasionRate: 0, criticalRate: 0, blockChance: 0, ailmentResistPercent: 0.5 } })
    const definition: TurnBuffDefinition = {
      id: 'test_buff', name: 'Test', polarity: 'debuff',
      duration: 10, stackMode: 'refresh', effects: [],
    }

    system.apply(definition, source, target)

    expect(pool.getFromSource('test_buff', 'source_1')!.remainingTurns).toBe(5)
  })
})

describe('TurnBuffSystem.apply — stack modes', () => {
  it("stackMode 'stack' increments stacks and refreshes remainingTurns, capped at maxStacks", () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = makeEntity({ id: 'source_1' })
    const target = makeEntity({ id: 'target_1' })
    const definition: TurnBuffDefinition = {
      id: 'test_buff', name: 'Test', polarity: 'debuff',
      duration: 3, maxStacks: 2, stackMode: 'stack', effects: [],
    }

    system.apply(definition, source, target)
    system.apply(definition, source, target)
    system.apply(definition, source, target) // third apply — capped at maxStacks 2

    const instance = pool.getFromSource('test_buff', 'source_1')!
    expect(instance.stacks).toBe(2)
    expect(instance.remainingTurns).toBe(3)
  })

  it("stackMode 'refresh' resets remainingTurns without changing stacks", () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = makeEntity({ id: 'source_1' })
    const target = makeEntity({ id: 'target_1' })
    const definition: TurnBuffDefinition = {
      id: 'test_buff', name: 'Test', polarity: 'debuff',
      duration: 4, stackMode: 'refresh', effects: [],
    }

    system.apply(definition, source, target)
    pool.getFromSource('test_buff', 'source_1')!.remainingTurns = 1
    system.apply(definition, source, target)

    const instance = pool.getFromSource('test_buff', 'source_1')!
    expect(instance.stacks).toBe(1)
    expect(instance.remainingTurns).toBe(4)
  })

  it("stackMode 'replace' swaps effects and resets remainingTurns", () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = makeEntity({ id: 'source_1' })
    const target = makeEntity({ id: 'target_1' })
    const first: TurnBuffDefinition = {
      id: 'test_buff', name: 'Test', polarity: 'debuff',
      duration: 4, stackMode: 'replace',
      effects: [{ type: 'statModifier', stat: 'attack', flat: 1 }],
    }
    const second: TurnBuffDefinition = {
      ...first,
      effects: [{ type: 'statModifier', stat: 'attack', flat: 2 }],
    }

    system.apply(first, source, target)
    system.apply(second, source, target)

    const instance = pool.getFromSource('test_buff', 'source_1')!
    expect(instance.effects).toEqual([{ type: 'statModifier', stat: 'attack', flat: 2 }])
  })

  it("stackMode 'stack' at maxStacks with convertsToId + registry converts instead of just capping", () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = makeEntity({ id: 'source_1' })
    const target = makeEntity({ id: 'target_1' })
    const slow: TurnBuffDefinition = {
      id: 'slow', name: 'Slow', polarity: 'debuff',
      duration: 3, maxStacks: 2, stackMode: 'stack', convertsToId: 'frozen', effects: [],
    }
    const frozen: TurnBuffDefinition = {
      id: 'frozen', name: 'Frozen', polarity: 'debuff',
      duration: 2, stackMode: 'refresh',
      effects: [{ type: 'cc', ccEffect: 'freeze' }],
    }
    const registry: TurnBuffRegistry = {
      get: (id) => (id === 'slow' ? slow : frozen),
    }

    system.apply(slow, source, target, registry)
    system.apply(slow, source, target, registry)
    system.apply(slow, source, target, registry) // third apply at maxStacks -> converts

    expect(pool.getFromSource('slow', 'source_1')).toBeUndefined()
    const converted = pool.getFromSource('frozen', 'source_1')
    expect(converted).toBeDefined()
    expect(converted!.effects).toEqual([{ type: 'cc', ccEffect: 'freeze' }])
  })
})

describe('TurnBuffSystem — DoT resolution at apply time', () => {
  it('resolves dpsRatio into a snapshotted damagePerTurn using source.stats.attack for physical element', () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = makeEntity({ id: 'source_1', stats: { ...createBaseStats(), evasionRate: 0, criticalRate: 0, blockChance: 0, attack: 100, ailmentPotencyPercent: 0 } })
    const target = makeEntity({ id: 'target_1', stats: { ...createBaseStats(), evasionRate: 0, criticalRate: 0, blockChance: 0, defense: 0 } })
    const definition: TurnBuffDefinition = {
      id: 'bleed', name: 'Bleed', polarity: 'debuff',
      duration: 3, stackMode: 'refresh',
      effects: [{ type: 'dot', dpsRatio: 0.5 }],
    }

    system.apply(definition, source, target)

    const instance = pool.getFromSource('bleed', 'source_1')!
    const dotEffect = instance.effects[0] as { type: 'dot'; damagePerTurn: number }
    expect(dotEffect.type).toBe('dot')
    expect(dotEffect.damagePerTurn).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run game/src/core/battle/turn/TurnBuffSystem.test.ts`
Expected: FAIL — `./TurnBuffSystem` does not exist yet.

- [ ] **Step 3: Write `TurnBuffSystem.ts` (apply/stacking/conversion portion — `update()` and CC checks are added in Task 3, in the same file)**

```typescript
import type { CombatEntity } from '../../combat/CombatEntity'
import type { CombatSystem } from '../../combat/CombatSystem'
import { getArmorMitigationPercent } from '../../combat/Armor'
import { getResistanceMitigationPercent } from '../../combat/Resistance'
import { elementalBasePower } from '../../combat/ElementDamageCalculator'
import { getSkillRuntimeStat } from '../../skill/SkillRuntimeStats'
import { TurnBuffPool } from './TurnBuffPool'
import type {
  TurnBuff,
  TurnBuffDefinition,
  TurnBuffEffectTemplate,
  TurnBuffRegistry,
} from './TurnBuffTypes'

// Ported verbatim from BuffSystem.ts's AILMENT_RESIST_CAP — trần % giảm
// duration buff/debuff nhận vào.
const AILMENT_RESIST_CAP = 0.75

// Ported verbatim from BuffSystem.ts's POISON_ROOT_THRESHOLD_STACKS.
const POISON_ROOT_THRESHOLD_STACKS = 3

export class TurnBuffSystem {
  constructor(private readonly pool: TurnBuffPool) {}

  apply(definition: TurnBuffDefinition, source: CombatEntity, target: CombatEntity, registry?: TurnBuffRegistry) {
    const resolvedEffects = definition.effects.map((effect) =>
      effect.type === 'dot'
        ? {
            type: 'dot' as const,
            damagePerTurn: this.calculateDamagePerTurn(effect, source, target),
            element: effect.element,
            poisonRootPercentPerStack: effect.poisonRootPercentPerStack,
            poisonRootMaxStacks: effect.poisonRootMaxStacks,
            poisonRootThresholdBonusPercent: effect.poisonRootThresholdBonusPercent,
          }
        : effect,
    )

    const resistMultiplier = 1 - Math.min(AILMENT_RESIST_CAP, Math.max(0, target.stats.ailmentResistPercent))
    const duration = definition.duration * resistMultiplier * (1 + source.stats.ailmentDurationPercent)

    const existing = this.pool.getFromSource(definition.id, source.id)

    if (!existing) {
      this.pool.add({
        id: definition.id,
        sourceId: source.id,
        targetId: target.id,
        polarity: definition.polarity,
        hidden: definition.hidden,
        duration,
        remainingTurns: duration,
        stacks: 1,
        maxStacks: this.resolveMaxStacks(definition, source),
        stackMode: definition.stackMode,
        continuousTurns: 0,
        convertsToId: definition.convertsToId,
        convertsAfterContinuousTurns: definition.convertsAfterContinuousTurns,
        effects: resolvedEffects,
      })
      return
    }

    this.handleExisting(existing, definition, source, target, duration, resolvedEffects, registry)
  }

  private resolveMaxStacks(definition: TurnBuffDefinition, source: CombatEntity): number | undefined {
    if (definition.maxStacks === undefined) {
      return undefined
    }

    const bonus = source.skillStats?.maxStacksBonusByBuffId?.[definition.id] ?? 0

    return definition.maxStacks + bonus
  }

  private handleExisting(
    existing: TurnBuff,
    definition: TurnBuffDefinition,
    source: CombatEntity,
    target: CombatEntity,
    duration: number,
    resolvedEffects: TurnBuff['effects'],
    registry?: TurnBuffRegistry,
  ) {
    switch (definition.stackMode) {
      case 'stack': {
        let nextStacks = existing.stacks + 1
        if (existing.maxStacks !== undefined) {
          nextStacks = Math.min(nextStacks, existing.maxStacks)
        }

        if (
          definition.convertsToId &&
          registry &&
          existing.maxStacks !== undefined &&
          nextStacks >= existing.maxStacks
        ) {
          this.pool.removeInstance(existing.id, existing.sourceId)
          this.apply(registry.get(definition.convertsToId), source, target, registry)
          return
        }

        existing.stacks = nextStacks
        existing.remainingTurns = duration
        break
      }

      case 'refresh':
        existing.remainingTurns = duration
        break

      case 'replace':
        this.pool.removeInstance(existing.id, existing.sourceId)
        this.pool.add({
          ...existing,
          duration,
          remainingTurns: duration,
          effects: resolvedEffects,
        })
        break
    }
  }

  private getPoisonRootMultiplier(
    effect: Extract<TurnBuff['effects'][number], { type: 'dot' }>,
    continuousTurns: number,
  ): number {
    if (!effect.poisonRootMaxStacks) {
      return 1
    }

    const rootStacks = Math.min(effect.poisonRootMaxStacks, Math.floor(continuousTurns))
    const thresholdBonus =
      rootStacks >= POISON_ROOT_THRESHOLD_STACKS ? (effect.poisonRootThresholdBonusPercent ?? 0) : 0

    return 1 + (effect.poisonRootPercentPerStack ?? 0) * rootStacks + thresholdBonus
  }

  private calculateDamagePerTurn(
    effect: Extract<TurnBuffEffectTemplate, { type: 'dot' }>,
    source: CombatEntity,
    target: CombatEntity,
  ): number {
    const ratio = effect.dpsRatio ?? 1

    const armorIgnoreMultiplier = effect.armorIgnorePercentByRealm
      ? 1 - Math.min(0.9, 0.1 + source.realmIndex * 0.1)
      : 1

    if (!effect.element || effect.element === 'physical') {
      const power = source.stats.attack
      const mitigation =
        getArmorMitigationPercent(target.stats.defense, target.realmIndex) * armorIgnoreMultiplier
      return Math.max(0, power * ratio * (1 - mitigation)) * (1 + source.stats.ailmentPotencyPercent)
    }

    const power = elementalBasePower(source, effect.element)
    const resistance = target.stats[`${effect.element}Resistance`]
    const penetration = source.stats[`${effect.element}Penetration`]
    const mitigation = getResistanceMitigationPercent(resistance, penetration) * armorIgnoreMultiplier

    const kimTheMultiplier =
      effect.element === 'metal'
        ? 1 +
          source.currentKimThe * getSkillRuntimeStat(source, 'kimTheDotDamagePercentPerStack') +
          getSkillRuntimeStat(source, 'metalAilmentPotencyPercent')
        : 1

    return Math.max(0, power * ratio * (1 - mitigation)) * (1 + source.stats.ailmentPotencyPercent) * kimTheMultiplier
  }

  private convert(buff: TurnBuff, registry: TurnBuffRegistry, target: CombatEntity, source?: CombatEntity) {
    const nextDefinition = registry.get(buff.convertsToId!)

    this.pool.removeInstance(buff.id, buff.sourceId)

    const resistMultiplier = 1 - Math.min(AILMENT_RESIST_CAP, Math.max(0, target.stats.ailmentResistPercent))
    const duration = nextDefinition.duration * resistMultiplier * (1 + (source?.stats.ailmentDurationPercent ?? 0))

    this.pool.removeInstance(nextDefinition.id, buff.sourceId)

    this.pool.add({
      id: nextDefinition.id,
      sourceId: buff.sourceId,
      targetId: buff.targetId,
      polarity: nextDefinition.polarity,
      hidden: nextDefinition.hidden,
      duration,
      remainingTurns: duration,
      stacks: 1,
      maxStacks: nextDefinition.maxStacks,
      stackMode: nextDefinition.stackMode,
      continuousTurns: 0,
      convertsToId: nextDefinition.convertsToId,
      convertsAfterContinuousTurns: nextDefinition.convertsAfterContinuousTurns,
      effects: nextDefinition.effects.map((effect) =>
        effect.type === 'dot' ? { ...effect, damagePerTurn: 0 } : effect,
      ),
    })
  }
}
```

Note: `convert()` is private and unused by any public method until Task 3 adds `update()` (which calls it). TypeScript/eslint may flag it as unused in isolation — that is expected and resolved by Task 3 in the same file; do not add a temporary export or `@ts-ignore` to silence it in this task.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run game/src/core/battle/turn/TurnBuffSystem.test.ts`
Expected: PASS for every `apply`/stack-mode/DoT-snapshot test written in Step 1. (If your toolchain's linter fails the build on the unused-`convert` warning noted above, that is a Task 3 concern — Task 3's Step 5 runs the full suite including lint; do not work around it here.)

- [ ] **Step 5: Commit**

```bash
git add game/src/core/battle/turn/TurnBuffSystem.ts game/src/core/battle/turn/TurnBuffSystem.test.ts
git commit -m "feat(turn-combat): add TurnBuffSystem.apply with stack/refresh/replace and convert-on-max-stacks"
```

---

### Task 3: `TurnBuffSystem.update()` (turn tick) + CC checks

**Files:**
- Modify: `game/src/core/battle/turn/TurnBuffSystem.ts` (append `update()`, `isStunned()`, `isFrozen()`)
- Modify: `game/src/core/battle/turn/TurnBuffSystem.test.ts` (append new `describe` blocks)

**Interfaces:**
- Consumes: `CombatSystem` type from `game/src/core/combat/CombatSystem.ts` (read-only reuse — only its `applyDotDamage(...)` call shape is used, exact same shape as the live `BuffSystem.update()`'s call), everything from Task 1/2.
- Produces: `TurnBuffSystem.update(target: CombatEntity, combatSystem: CombatSystem, registry?: TurnBuffRegistry, resolveSource?: (sourceId: string) => CombatEntity | undefined): void`, `isStunned(): boolean`, `isFrozen(): boolean`.

- [ ] **Step 1: Write the failing tests**

Append to `game/src/core/battle/turn/TurnBuffSystem.test.ts`:

```typescript
describe('TurnBuffSystem.update — turn tick', () => {
  it('one update() call decrements remainingTurns by 1 and increments continuousTurns by 1', () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = makeEntity({ id: 'source_1' })
    const target = makeEntity({ id: 'target_1' })
    system.apply(
      { id: 'test_buff', name: 'Test', polarity: 'debuff', duration: 3, stackMode: 'refresh', effects: [] },
      source,
      target,
    )

    system.update(target, makeCombatSystem())

    const instance = pool.getFromSource('test_buff', 'source_1')!
    expect(instance.remainingTurns).toBe(2)
    expect(instance.continuousTurns).toBe(1)
  })

  it('buff is removed from the pool once remainingTurns reaches 0', () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = makeEntity({ id: 'source_1' })
    const target = makeEntity({ id: 'target_1' })
    system.apply(
      { id: 'test_buff', name: 'Test', polarity: 'debuff', duration: 2, stackMode: 'refresh', effects: [] },
      source,
      target,
    )

    system.update(target, makeCombatSystem())
    system.update(target, makeCombatSystem())

    expect(pool.getFromSource('test_buff', 'source_1')).toBeUndefined()
  })

  it('a dot effect calls combatSystem.applyDotDamage with damagePerTurn * stacks, no deltaSeconds factor', () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = makeEntity({ id: 'source_1' })
    const target = makeEntity({ id: 'target_1' })
    system.apply(
      {
        id: 'bleed', name: 'Bleed', polarity: 'debuff', duration: 3, maxStacks: 5, stackMode: 'stack',
        effects: [{ type: 'dot', dpsRatio: 1 }],
      },
      source,
      target,
    )
    system.apply(
      {
        id: 'bleed', name: 'Bleed', polarity: 'debuff', duration: 3, maxStacks: 5, stackMode: 'stack',
        effects: [{ type: 'dot', dpsRatio: 1 }],
      },
      source,
      target,
    ) // 2 stacks now

    const combatSystem = makeCombatSystem()
    system.update(target, combatSystem)

    const instance = pool.getFromSource('bleed', 'source_1')!
    const dotEffect = instance.effects[0] as { type: 'dot'; damagePerTurn: number }
    expect(combatSystem.applyDotDamage).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: 'source_1',
        target,
        rawDamage: dotEffect.damagePerTurn * 2,
        effectId: 'bleed',
      }),
    )
  })

  it('continuousTurns reaching convertsAfterContinuousTurns triggers conversion to the target definition', () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = makeEntity({ id: 'source_1' })
    const target = makeEntity({ id: 'target_1' })
    const slow: TurnBuffDefinition = {
      id: 'slow', name: 'Slow', polarity: 'debuff', duration: 10, stackMode: 'refresh',
      convertsToId: 'frozen', convertsAfterContinuousTurns: 2, effects: [],
    }
    const frozen: TurnBuffDefinition = {
      id: 'frozen', name: 'Frozen', polarity: 'debuff', duration: 2, stackMode: 'refresh',
      effects: [{ type: 'cc', ccEffect: 'freeze' }],
    }
    const registry: TurnBuffRegistry = { get: (id) => (id === 'slow' ? slow : frozen) }

    system.apply(slow, source, target, registry)
    system.update(target, makeCombatSystem(), registry, () => source)
    system.update(target, makeCombatSystem(), registry, () => source)

    expect(pool.getFromSource('slow', 'source_1')).toBeUndefined()
    expect(pool.getFromSource('frozen', 'source_1')).toBeDefined()
  })
})

describe('TurnBuffSystem — CC checks', () => {
  it('isStunned() is true only while a cc:stun effect is active on the pool', () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = makeEntity({ id: 'source_1' })
    const target = makeEntity({ id: 'target_1' })

    expect(system.isStunned()).toBe(false)

    system.apply(
      { id: 'stun', name: 'Stun', polarity: 'debuff', duration: 1, stackMode: 'refresh', effects: [{ type: 'cc', ccEffect: 'stun' }] },
      source,
      target,
    )

    expect(system.isStunned()).toBe(true)
    expect(system.isFrozen()).toBe(false)
  })

  it('isFrozen() is true only while a cc:freeze effect is active on the pool', () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = makeEntity({ id: 'source_1' })
    const target = makeEntity({ id: 'target_1' })

    system.apply(
      { id: 'frozen', name: 'Frozen', polarity: 'debuff', duration: 1, stackMode: 'refresh', effects: [{ type: 'cc', ccEffect: 'freeze' }] },
      source,
      target,
    )

    expect(system.isFrozen()).toBe(true)
    expect(system.isStunned()).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run game/src/core/battle/turn/TurnBuffSystem.test.ts`
Expected: FAIL — `update`/`isStunned`/`isFrozen` are not yet defined on `TurnBuffSystem`.

- [ ] **Step 3: Append `update()`, `isStunned()`, `isFrozen()` to the `TurnBuffSystem` class**

Add these as public methods inside the `TurnBuffSystem` class body in `game/src/core/battle/turn/TurnBuffSystem.ts` (after `convert()`, before the closing `}` of the class):

```typescript
  update(
    target: CombatEntity,
    combatSystem: CombatSystem,
    registry?: TurnBuffRegistry,
    resolveSource?: (sourceId: string) => CombatEntity | undefined,
  ) {
    const expired: TurnBuff[] = []

    for (const buff of this.pool.getAll()) {
      buff.continuousTurns += 1

      if (
        registry &&
        buff.convertsToId &&
        buff.convertsAfterContinuousTurns !== undefined &&
        buff.continuousTurns >= buff.convertsAfterContinuousTurns
      ) {
        this.convert(buff, registry, target, resolveSource?.(buff.sourceId))
        continue
      }

      for (const effect of buff.effects) {
        if (effect.type === 'dot' && effect.damagePerTurn && target.alive) {
          const rawDamage =
            effect.damagePerTurn * buff.stacks * this.getPoisonRootMultiplier(effect, buff.continuousTurns)

          combatSystem.applyDotDamage({
            sourceId: buff.sourceId,
            source: resolveSource?.(buff.sourceId),
            target,
            rawDamage,
            element: effect.element,
            effectId: buff.id,
          })
        }
      }

      buff.remainingTurns -= 1
      if (buff.remainingTurns <= 0) {
        expired.push(buff)
      }
    }

    for (const buff of expired) {
      this.pool.removeInstance(buff.id, buff.sourceId)
    }
  }

  isStunned(): boolean {
    return this.pool.getAll().some((buff) => buff.effects.some((e) => e.type === 'cc' && e.ccEffect === 'stun'))
  }

  isFrozen(): boolean {
    return this.pool.getAll().some((buff) => buff.effects.some((e) => e.type === 'cc' && e.ccEffect === 'freeze'))
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run game/src/core/battle/turn/TurnBuffSystem.test.ts`
Expected: PASS, every test in the file (Task 2's + Task 3's new blocks).

- [ ] **Step 5: Commit**

```bash
git add game/src/core/battle/turn/TurnBuffSystem.ts game/src/core/battle/turn/TurnBuffSystem.test.ts
git commit -m "feat(turn-combat): add TurnBuffSystem.update turn tick, DoT resolution, and CC checks"
```

---

### Task 4: Full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, zero regressions. Since no live file (`BuffSystem.ts`, `BattleSystem.ts`, any `data/**` content, any presentation file) was modified by this plan, no existing test outside the 3 new files should be affected. If any unrelated test fails, it indicates an accidental edit outside this plan's file list — check `git diff --stat` against the Global Constraints' untouched-file list and revert anything outside `game/src/core/battle/turn/TurnBuff*`.

- [ ] **Step 2: Run typecheck**

Run: `npx vue-tsc --noEmit` (or the project's existing typecheck script — check `package.json`'s `scripts` for the exact command already used elsewhere in this repo before running).
Expected: PASS, zero errors.

- [ ] **Step 3: Commit any fixups**

If Steps 1-2 required fixes beyond what Tasks 1-3 anticipated, stage exactly the changed files and commit:

```bash
git add -A
git commit -m "fix: address regressions found during TurnBuffSystem full-suite verification"
```

If no fixes were needed, skip this step.

## Not Covered By This Plan

- Wiring `TurnBuffSystem`/`TurnBuffPool` into `TurnBattleSystem` (Slice 1's core loop) — future slice.
- `ReactionManager.ts`'s turn-based conversion (event-triggered call site relocation) — separate future plan.
- Migrating real buff content (`game/src/data/buff/buffs.ts`, boss enrage buffs, equipment/talent passives) to `TurnBuffDefinition` — future content work, unblocked by this plan but not performed here.
- Any change to presentation/VFX/tooltip display of buff duration.
- `getActiveModifiers()`, `isRooted()`, `rollOnHitEffects()`, `getStacks()` — the live `BuffSystem.ts` has these additional consumer-facing methods; they are out of scope per the approved design spec (§2/§4) and are not ported here. If a later slice needs them, port them the same way `update()`/`isStunned()`/`isFrozen()` were ported in this plan (verbatim logic, renamed time fields).
- Balance re-tuning of any buff's authored duration value.
- The actual `BattleSystem` cutover that would make `TurnBuffSystem` the live buff engine.
