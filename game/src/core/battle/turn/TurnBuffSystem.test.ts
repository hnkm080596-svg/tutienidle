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

describe('TurnBuffSystem ported BuffSystem methods', () => {
  function portedEntity(overrides: Partial<CombatEntity> = {}): CombatEntity {
    const stats = { ...createBaseStats(), evasionRate: 0, criticalRate: 0, blockChance: 0, ...overrides.stats }
    const { stats: _drop, ...rest } = overrides
    return {
      id: 'id', name: 'name', type: 'enemy', baseStats: stats, stats,
      currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
      currentSwordIntent: 0, currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0,
      timeSinceLastBleedProc: 0, tuLucActive: false, tuLucElapsed: 0, tuLucDamageTakenPercent: 0,
      currentWard: 0, timeSinceLastHitTaken: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
      ...rest,
    } as CombatEntity
  }

  const ATTACK_MODIFIER_DEF: TurnBuffDefinition = {
    id: 'port_attack_up', name: 'Attack Up', polarity: 'buff', duration: 3, maxStacks: 5, stackMode: 'stack',
    effects: [{ type: 'statModifier', stat: 'attack', flat: 50 }],
  }

  const ROOT_DEF: TurnBuffDefinition = {
    id: 'port_root', name: 'Root', polarity: 'debuff', duration: 3, stackMode: 'refresh',
    effects: [{ type: 'cc', ccEffect: 'root' }],
  }

  const PROC_DEF: TurnBuffDefinition = {
    id: 'port_proc', name: 'Proc', polarity: 'debuff', duration: 3, maxStacks: 1, stackMode: 'refresh',
    effects: [{ type: 'onHitProc', chance: 1, appliesBuffId: 'port_proc_result' }],
  }

  const PROC_RESULT_DEF: TurnBuffDefinition = {
    id: 'port_proc_result', name: 'ProcResult', polarity: 'debuff', duration: 2, stackMode: 'refresh',
    effects: [{ type: 'dot', dpsRatio: 1, element: 'physical' }],
  }

  it('getActiveModifiers: folds statModifier effects into StatModifier[] with buff provenance + stacks', () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = portedEntity({ id: 'src' })
    const target = portedEntity({ id: 'tgt' })
    const registry: TurnBuffRegistry = { get: (id) => (id === 'port_attack_up' ? ATTACK_MODIFIER_DEF : ATTACK_MODIFIER_DEF) }

    system.apply(ATTACK_MODIFIER_DEF, source, target, registry)
    system.apply(ATTACK_MODIFIER_DEF, source, target, registry) // stacks -> 2

    const modifiers = system.getActiveModifiers()

    expect(modifiers).toHaveLength(1)
    expect(modifiers[0]!.stat).toBe('attack')
    expect(modifiers[0]!.flat).toBe(50)
    expect(modifiers[0]!.stacks).toBe(2)
    expect(modifiers[0]!.sourceId).toBe('src')
    expect(modifiers[0]!.sourceType).toBe('buff')
    expect(modifiers[0]!.id).toBe('buff:port_attack_up:src:attack')
  })

  it('isRooted: true only while a cc:root effect is active', () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = portedEntity({ id: 'src' })
    const target = portedEntity({ id: 'tgt' })
    const registry: TurnBuffRegistry = { get: (id) => (id === 'port_root' ? ROOT_DEF : ROOT_DEF) }

    expect(system.isRooted()).toBe(false)

    system.apply(ROOT_DEF, source, target, registry)

    expect(system.isRooted()).toBe(true)
  })

  it('rollOnHitEffects: rolls chance per onHitProc buff and applies the resulting buff on hit', () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = portedEntity({ id: 'src' })
    const target = portedEntity({ id: 'tgt' })
    const registry: TurnBuffRegistry = {
      get: (id) => (id === 'port_proc' ? PROC_DEF : PROC_RESULT_DEF),
    }

    // 'port_proc' dang active TR�N TARGET (target b? d�nh buff c� onHitProc,
    // k? d�nh source roll proc -> target d�nh port_proc_result).
    system.apply(PROC_DEF, source, target, registry)

    system.rollOnHitEffects(source, target, registry)

    expect(pool.hasAny('port_proc_result')).toBe(true)
  })

  it('getStacks: t?ng stacks tr�n m?i ngu?n khi kh�ng truy?n sourceId, d�ng 1 ngu?n khi truy?n', () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const sourceA = portedEntity({ id: 'src_a' })
    const sourceB = portedEntity({ id: 'src_b' })
    const target = portedEntity({ id: 'tgt' })
    const stackDef: TurnBuffDefinition = {
      id: 'port_stack', name: 'Stack', polarity: 'debuff', duration: 5, maxStacks: 5, stackMode: 'stack',
      effects: [],
    }
    const registry: TurnBuffRegistry = { get: () => stackDef }

    system.apply(stackDef, sourceA, target, registry)
    system.apply(stackDef, sourceA, target, registry)
    system.apply(stackDef, sourceB, target, registry)

    expect(system.getStacks('port_stack')).toBe(3)
    expect(system.getStacks('port_stack', 'src_a')).toBe(2)
    expect(system.getStacks('port_stack', 'src_b')).toBe(1)
    expect(system.getStacks('missing', 'src_a')).toBe(0)
  })
})

describe('TurnBuffSystem port additions for ReactionManager (Phase A1)', () => {
  const A_DEF: TurnBuffDefinition = {
    id: 'fixture_a', name: 'Fixture A', polarity: 'buff', duration: 5, stackMode: 'refresh',
    effects: [{ type: 'statModifier', stat: 'attack', flat: 10 }],
  }
  const B_DEF: TurnBuffDefinition = {
    id: 'fixture_b', name: 'Fixture B', polarity: 'buff', duration: 5, stackMode: 'refresh',
    effects: [],
  }

  function portedEntity(overrides: Partial<CombatEntity> = {}): CombatEntity {
    const stats = { ...createBaseStats(), evasionRate: 0, criticalRate: 0, blockChance: 0, ...overrides.stats }
    const { stats: _drop, ...rest } = overrides
    return {
      id: 'id', name: 'name', type: 'enemy', baseStats: stats, stats,
      currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
      currentSwordIntent: 0, currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0,
      timeSinceLastBleedProc: 0, tuLucActive: false, tuLucElapsed: 0, tuLucDamageTakenPercent: 0,
      currentWard: 0, timeSinceLastHitTaken: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
      ...rest,
    } as CombatEntity
  }

  it('getActiveIds returns the id of every active buff instance', () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = portedEntity({ id: 'src' })
    const target = portedEntity({ id: 'tgt' })

    system.apply(A_DEF, source, target)
    system.apply(B_DEF, source, target)

    expect(system.getActiveIds().sort()).toEqual(['fixture_a', 'fixture_b'])
  })

  it('remove deletes only the matching (id, sourceId) instance', () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = portedEntity({ id: 'src' })
    const target = portedEntity({ id: 'tgt' })

    system.apply(A_DEF, source, target)
    system.remove('fixture_a', source.id)

    expect(system.getActiveIds()).toEqual([])
  })

  it('renewWithExtension adds to remainingTurns without resetting stacks/other fields', () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = portedEntity({ id: 'src' })
    const target = portedEntity({ id: 'tgt' })

    system.apply(A_DEF, source, target)
    system.renewWithExtension('fixture_a', source.id, 3)

    const buff = pool.getFromSource('fixture_a', source.id)
    expect(buff?.remainingTurns).toBe(8)
  })

  it('renewWithExtension is a no-op when no matching instance exists', () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)

    expect(() => system.renewWithExtension('nonexistent', 'nobody', 3)).not.toThrow()
    expect(pool.getAll()).toEqual([])
  })
})

describe('getAll / remove (Phase A0)', () => {
  const A_DEF: TurnBuffDefinition = {
    id: 'a0_bong', name: 'A0 Bong', polarity: 'debuff', duration: 5, stackMode: 'refresh',
    effects: [{ type: 'dot', dpsRatio: 1, element: 'fire' }],
  }
  const B_DEF: TurnBuffDefinition = {
    id: 'a0_te_cong', name: 'A0 Te Cong', polarity: 'debuff', duration: 5, stackMode: 'refresh',
    effects: [],
  }

  function portedEntity(overrides: Partial<CombatEntity> = {}): CombatEntity {
    const stats = { ...createBaseStats(), evasionRate: 0, criticalRate: 0, blockChance: 0, ...overrides.stats }
    const { stats: _drop, ...rest } = overrides
    return {
      id: 'id', name: 'name', type: 'enemy', baseStats: stats, stats,
      currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
      currentSwordIntent: 0, currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0,
      timeSinceLastBleedProc: 0, tuLucActive: false, tuLucElapsed: 0, tuLucDamageTakenPercent: 0,
      currentWard: 0, timeSinceLastHitTaken: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
      ...rest,
    } as CombatEntity
  }

  it('getAll returns every active buff instance', () => {
    const pool = new TurnBuffPool()
    const buffs = new TurnBuffSystem(pool)
    const sourceA = portedEntity({ id: 'src_a' })
    const target = portedEntity({ id: 'tgt' })

    buffs.apply(A_DEF, sourceA, target)
    buffs.apply(B_DEF, sourceA, target)

    expect(buffs.getAll().map((b) => b.id).sort()).toEqual(['a0_bong', 'a0_te_cong'])
  })

  it('remove deletes exactly the (id, sourceId) instance', () => {
    const pool = new TurnBuffPool()
    const buffs = new TurnBuffSystem(pool)
    const sourceA = portedEntity({ id: 'src_a' })
    const target = portedEntity({ id: 'tgt' })

    buffs.apply(A_DEF, sourceA, target)

    buffs.remove('a0_bong', sourceA.id)

    expect(buffs.getAll()).toHaveLength(0)
  })
})
