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
    system.apply(slow, source, target, registry) // second apply: nextStacks hits maxStacks -> converts (1:1 với BuffSystem.ts L112-126)
    system.apply(slow, source, target, registry) // third apply: fresh 'slow' instance (stacks=1), không convert lại

    // Apply thứ 2 đã convert slow -> frozen; apply thứ 3 tạo lại 1 instance
    // slow mới (stacks=1). Cả 2 cùng tồn tại — đúng chuỗi sự kiện hệ sống.
    expect(pool.getAllById('slow')).toHaveLength(1)
    expect(pool.getFromSource('slow', 'source_1')!.stacks).toBe(1)
    const converted = pool.getFromSource('frozen', 'source_1')
    expect(converted).toBeDefined()
    expect(converted!.effects).toEqual([{ type: 'cc', ccEffect: 'freeze' }])
  })

  it("stackMode 'stack' at maxStacks: convert xảy ra đúng tại apply chạm maxStacks (parity với BuffSystem.ts)", () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = makeEntity({ id: 'source_1' })
    const target = makeEntity({ id: 'target_1' })
    const slow: TurnBuffDefinition = {
      id: 'slow2', name: 'Slow', polarity: 'debuff',
      duration: 3, maxStacks: 2, stackMode: 'stack', convertsToId: 'frozen2', effects: [],
    }
    const frozen: TurnBuffDefinition = {
      id: 'frozen2', name: 'Frozen', polarity: 'debuff',
      duration: 2, stackMode: 'refresh',
      effects: [{ type: 'cc', ccEffect: 'freeze' }],
    }
    const registry: TurnBuffRegistry = {
      get: (id) => (id === 'slow2' ? slow : frozen),
    }

    // Chưa chạm maxStacks: stacks tăng bình thường.
    system.apply(slow, source, target, registry)
    expect(pool.getFromSource('slow2', 'source_1')).toBeDefined()
    expect(pool.getFromSource('slow2', 'source_1')!.stacks).toBe(1)

    // Apply thứ 2: nextStacks = 2 >= maxStacks 2 → convert NGAY (1:1 hệ sống).
    system.apply(slow, source, target, registry)
    expect(pool.getFromSource('slow2', 'source_1')).toBeUndefined()
    expect(pool.getFromSource('frozen2', 'source_1')).toBeDefined()
    expect(pool.getFromSource('frozen2', 'source_1')!.stacks).toBe(1)
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
