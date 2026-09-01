import { describe, expect, it, vi } from 'vitest'
import { BuffSystem } from './BuffSystem'
import { BuffPool } from './BuffPool'
import type { Buff } from './Buff'
import type { BuffDefinition } from './BuffDefinition'
import type { CombatEntity } from '../combat/CombatEntity'
import type { CombatSystem } from '../combat/CombatSystem'
import { createBaseStats } from '../stats/StatBlock'

function makeEntity(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, criticalRate: 0, blockChance: 0, ...overrides.stats }
  // `stats` is destructured out of overrides (and merged into `stats`
  // above already) so the ...restOverrides spread below can't clobber the
  // merge with a raw partial (eg. `{ attack: 10 } as CombatEntity['stats']`)
  // and silently drop base fields (defense, ailmentPotencyPercent, ...)
  // that calculateDamagePerSecond()/apply() still read.
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
  }
}

function makeRuntimeBuff(overrides: Partial<Buff> = {}): Buff {
  return {
    id: 'test_buff',
    sourceId: 'source_1',
    targetId: 'target_1',
    polarity: 'debuff',
    duration: 5,
    remainingTime: 5,
    stacks: 1,
    stackMode: 'refresh',
    continuousSeconds: 0,
    effects: [],
    ...overrides,
  }
}

function makeCombatSystem(): CombatSystem {
  return { applyDotDamage: vi.fn() } as unknown as CombatSystem
}

describe('BuffSystem — áp buff và getActiveModifiers()', () => {
  it('buff mới áp vào → modifier xuất hiện trong getActiveModifiers() với stacks đúng', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const source = makeEntity({ id: 'source_1' })
    const target = makeEntity({ id: 'target_1' })

    const definition: BuffDefinition = {
      id: 'test_buff', name: 'Buff thử nghiệm', polarity: 'buff',
      duration: 5, stackMode: 'refresh',
      effects: [{ type: 'statModifier', stat: 'attack', flat: 5 }],
    }

    system.apply(definition, source, target)

    expect(pool.getFromSource('test_buff', 'source_1')).toBeDefined()

    const active = system.getActiveModifiers()

    expect(active).toHaveLength(1)
    expect(active[0]).toMatchObject({
      sourceId: 'source_1',
      sourceType: 'buff',
      stat: 'attack',
      flat: 5,
      stacks: 1,
    })
  })

  it('getActiveModifiers() gắn stacks hiện hành của buff vào TỪNG modifier', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const source = makeEntity({ id: 'source_1' })
    const target = makeEntity({ id: 'target_1' })

    const definition: BuffDefinition = {
      id: 'test_buff', name: 'Buff thử nghiệm', polarity: 'buff',
      duration: 5, maxStacks: 5, stackMode: 'stack',
      effects: [
        { type: 'statModifier', stat: 'attack', flat: 5 },
        { type: 'statModifier', stat: 'defense', flat: 2 },
      ],
    }

    system.apply(definition, source, target)
    system.apply(definition, source, target)

    const active = system.getActiveModifiers()

    expect(active).toHaveLength(2)
    expect(active.map((modifier) => modifier.stacks)).toEqual([2, 2])
  })
})

describe('BuffSystem — áp lại cùng buff theo stackMode', () => {
  it('stackMode stack: cộng tầng tới trần maxStacks và làm mới remainingTime', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const source = makeEntity({ id: 'source_1' })
    const target = makeEntity({ id: 'target_1' })
    const combatSystem = makeCombatSystem()

    const definition: BuffDefinition = {
      id: 'test_buff', name: 'Buff thử nghiệm', polarity: 'debuff',
      duration: 5, maxStacks: 2, stackMode: 'stack',
      effects: [{ type: 'statModifier', stat: 'attack', flat: 5 }],
    }

    system.apply(definition, source, target)
    system.apply(definition, source, target)
    system.apply(definition, source, target)

    // 3 lần áp nhưng trần maxStacks 2 → dừng ở 2 tầng.
    expect(pool.getFromSource('test_buff', 'source_1')!.stacks).toBe(2)

    system.update(4, target, combatSystem)

    system.apply(definition, source, target)

    // re-applied làm mới thời gian về full duration.
    expect(pool.getFromSource('test_buff', 'source_1')!.remainingTime).toBe(5)
  })

  it('stackMode refresh: giữ nguyên tầng, remainingTime làm mới theo duration của lần áp MỚI', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const source = makeEntity({ id: 'source_1' })
    const target = makeEntity({ id: 'target_1' })
    const combatSystem = makeCombatSystem()

    const baseDefinition: BuffDefinition = {
      id: 'test_buff', name: 'Buff thử nghiệm', polarity: 'debuff',
      stackMode: 'refresh', duration: 5,
      effects: [{ type: 'statModifier', stat: 'attack', flat: 5 }],
    }

    system.apply(baseDefinition, source, target)

    system.update(3, target, combatSystem)

    expect(pool.getFromSource('test_buff', 'source_1')!.remainingTime).toBe(2)

    system.apply({ ...baseDefinition, duration: 8 }, source, target)

    const stored = pool.getFromSource('test_buff', 'source_1')!

    expect(stored.remainingTime).toBe(8)
    expect(stored.stacks).toBe(1)
  })

  it('stackMode replace: bản cũ bị xoá, bản mới thêm với duration tươi (stacks giữ nguyên — ported verbatim từ AilmentSystem.handleExisting())', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const source = makeEntity({ id: 'source_1' })
    const target = makeEntity({ id: 'target_1' })
    const combatSystem = makeCombatSystem()

    const definition: BuffDefinition = {
      id: 'test_buff', name: 'Buff thử nghiệm', polarity: 'debuff',
      duration: 5, stackMode: 'replace',
      effects: [{ type: 'statModifier', stat: 'attack', flat: 5 }],
    }

    system.apply(definition, source, target)

    // Giả lập tầng đã tích luỹ trên bản cũ — replace KHÔNG reset stacks
    // (verbatim theo AilmentSystem.handleExisting()'s 'replace' case:
    // `{...existing, ...}` giữ nguyên existing.stacks).
    pool.getFromSource('test_buff', 'source_1')!.stacks = 3

    system.update(3, target, combatSystem)

    system.apply(definition, source, target)

    expect(pool.getAll()).toHaveLength(1)

    const stored = pool.getFromSource('test_buff', 'source_1')!

    expect(stored.stacks).toBe(3)
    expect(stored.remainingTime).toBe(5)
  })
})

describe('BuffSystem — hết hạn qua update()', () => {
  it('update() quá duration → buff gỡ khỏi pool và modifier biến mất', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const source = makeEntity({ id: 'source_1' })
    const target = makeEntity({ id: 'target_1' })
    const combatSystem = makeCombatSystem()

    const definition: BuffDefinition = {
      id: 'test_buff', name: 'Buff thử nghiệm', polarity: 'debuff',
      duration: 2, stackMode: 'refresh',
      effects: [{ type: 'statModifier', stat: 'attack', flat: 5 }],
    }

    system.apply(definition, source, target)

    system.update(1, target, combatSystem)

    expect(pool.getFromSource('test_buff', 'source_1')).toBeDefined()
    expect(system.getActiveModifiers()).toHaveLength(1)

    system.update(1, target, combatSystem)

    expect(pool.getFromSource('test_buff', 'source_1')).toBeUndefined()
    expect(system.getActiveModifiers()).toHaveLength(0)
  })

  it('buff gần như vĩnh viễn (duration cực lớn) không bị update() xoá sớm', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const source = makeEntity({ id: 'source_1' })
    const target = makeEntity({ id: 'target_1' })
    const combatSystem = makeCombatSystem()

    const definition: BuffDefinition = {
      id: 'test_buff', name: 'Buff thử nghiệm', polarity: 'buff',
      duration: Infinity, stackMode: 'refresh',
      effects: [{ type: 'statModifier', stat: 'attack', flat: 5 }],
    }

    system.apply(definition, source, target)

    system.update(100, target, combatSystem)

    expect(pool.getFromSource('test_buff', 'source_1')).toBeDefined()
    expect(system.getActiveModifiers()).toHaveLength(1)
  })

  it('nhiều buff hết hạn độc lập theo duration riêng', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const source = makeEntity({ id: 'source_1' })
    const target = makeEntity({ id: 'target_1' })
    const combatSystem = makeCombatSystem()

    system.apply(
      { id: 'buff_ngan', name: 'Ngắn', polarity: 'buff', duration: 1, stackMode: 'refresh', effects: [{ type: 'statModifier', stat: 'attack', flat: 1 }] },
      source, target,
    )
    system.apply(
      { id: 'buff_dai', name: 'Dài', polarity: 'buff', duration: 10, stackMode: 'refresh', effects: [{ type: 'statModifier', stat: 'attack', flat: 1 }] },
      source, target,
    )

    system.update(2, target, combatSystem)

    expect(pool.getFromSource('buff_ngan', 'source_1')).toBeUndefined()
    expect(pool.getFromSource('buff_dai', 'source_1')).toBeDefined()
    expect(system.getActiveModifiers()).toHaveLength(1)
  })
})

describe('BuffSystem — multi-source coexistence (2026-09-01 unified buff system)', () => {
  it('two sources applying the same debuff id each get an independent instance', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const source1 = makeEntity({ id: 'enemy_1' })
    const source2 = makeEntity({ id: 'enemy_2' })
    const target = makeEntity({ id: 'player' })

    const definition: BuffDefinition = {
      id: 'poison_weak', name: 'Poison', polarity: 'debuff',
      duration: 5, stackMode: 'refresh',
      effects: [{ type: 'dot', dpsRatio: 1, element: 'physical' }],
    }

    system.apply(definition, source1, target)
    system.apply(definition, source2, target)

    expect(pool.getAllById('poison_weak')).toHaveLength(2)
    expect(pool.getFromSource('poison_weak', 'enemy_1')).toBeDefined()
    expect(pool.getFromSource('poison_weak', 'enemy_2')).toBeDefined()
  })

  it('the SAME source re-applying stacks/refreshes/replaces per stackMode without affecting other sources', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const source1 = makeEntity({ id: 'enemy_1' })
    const source2 = makeEntity({ id: 'enemy_2' })
    const target = makeEntity({ id: 'player' })

    const definition: BuffDefinition = {
      id: 'poison_weak', name: 'Poison', polarity: 'debuff',
      duration: 5, maxStacks: 3, stackMode: 'stack',
      effects: [{ type: 'dot', dpsRatio: 1, element: 'physical' }],
    }

    system.apply(definition, source1, target)
    system.apply(definition, source2, target)
    system.apply(definition, source1, target) // source1 re-applies

    expect(pool.getFromSource('poison_weak', 'enemy_1')?.stacks).toBe(2)
    expect(pool.getFromSource('poison_weak', 'enemy_2')?.stacks).toBe(1)
  })

  it('update() ticks DoT damage independently per source instance', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const source1 = makeEntity({ id: 'enemy_1', stats: { attack: 10 } as CombatEntity['stats'] })
    const source2 = makeEntity({ id: 'enemy_2', stats: { attack: 20 } as CombatEntity['stats'] })
    const target = makeEntity({ id: 'player' })
    const combatSystem = { applyDotDamage: vi.fn() } as unknown as CombatSystem

    const definition: BuffDefinition = {
      id: 'poison_weak', name: 'Poison', polarity: 'debuff',
      duration: 5, stackMode: 'refresh',
      effects: [{ type: 'dot', dpsRatio: 1, element: 'physical' }],
    }

    system.apply(definition, source1, target)
    system.apply(definition, source2, target)
    system.update(1, target, combatSystem)

    expect(combatSystem.applyDotDamage).toHaveBeenCalledTimes(2)
  })
})

describe('BuffSystem — Kiếm Tu armorIgnorePercentByRealm (2026-09-01 review fix)', () => {
  it('armorIgnorePercentByRealm scales down armor mitigation by source.realmIndex, producing higher DoT damagePerSecond than the same effect without it', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    // realmIndex 8 (Kiếp Lôi/tribulation, realm cuối) -> ignore 90% mitigation.
    const source = makeEntity({ id: 'source_1', realmIndex: 8, stats: { ...createBaseStats(), attack: 100, defense: 0 } })
    const target = makeEntity({ id: 'target_1', stats: { ...createBaseStats(), defense: 50 } })

    const withIgnore: BuffDefinition = {
      id: 'buff_ignore', name: 'Ignore', polarity: 'debuff', duration: 5, stackMode: 'refresh',
      effects: [{ type: 'dot', dpsRatio: 1, element: 'physical', armorIgnorePercentByRealm: true }],
    }
    const withoutIgnore: BuffDefinition = {
      id: 'buff_no_ignore', name: 'No Ignore', polarity: 'debuff', duration: 5, stackMode: 'refresh',
      effects: [{ type: 'dot', dpsRatio: 1, element: 'physical' }],
    }

    system.apply(withIgnore, source, target)
    system.apply(withoutIgnore, source, target)

    const withIgnoreEffect = pool.getFromSource('buff_ignore', 'source_1')!.effects[0] as Extract<Buff['effects'][number], { type: 'dot' }>
    const withoutIgnoreEffect = pool.getFromSource('buff_no_ignore', 'source_1')!.effects[0] as Extract<Buff['effects'][number], { type: 'dot' }>

    expect(withIgnoreEffect.damagePerSecond).toBeGreaterThan(withoutIgnoreEffect.damagePerSecond)
  })
})

describe('BuffSystem — update() skips DoT tick when damagePerSecond is falsy (2026-09-01 review fix)', () => {
  it('a dot effect with damagePerSecond: 0 (e.g. a convert() destination with no snapshot yet) does not call combatSystem.applyDotDamage()', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const target = makeEntity({ id: 'target_1' })
    const combatSystem = makeCombatSystem()

    pool.add(makeRuntimeBuff({
      id: 'converted_buff', sourceId: 'source_1', targetId: 'target_1',
      effects: [{ type: 'dot', damagePerSecond: 0, element: 'physical' }],
    }))

    system.update(1, target, combatSystem)

    expect(combatSystem.applyDotDamage).not.toHaveBeenCalled()
  })
})

describe('BuffSystem — getStacks under multi-source', () => {
  it('getStacks(id, sourceId) returns that one source instance\'s stacks', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    pool.add(makeRuntimeBuff({ id: 'x', sourceId: 'a', stacks: 2 }))
    pool.add(makeRuntimeBuff({ id: 'x', sourceId: 'b', stacks: 5 }))

    expect(system.getStacks('x', 'a')).toBe(2)
    expect(system.getStacks('x', 'b')).toBe(5)
  })

  it('getStacks(id) with no sourceId sums stacks across every source', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    pool.add(makeRuntimeBuff({ id: 'x', sourceId: 'a', stacks: 2 }))
    pool.add(makeRuntimeBuff({ id: 'x', sourceId: 'b', stacks: 5 }))

    expect(system.getStacks('x')).toBe(7)
  })
})
