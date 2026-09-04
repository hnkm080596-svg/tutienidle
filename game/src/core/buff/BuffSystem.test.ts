import { describe, expect, it, vi } from 'vitest'
import { BuffSystem } from './BuffSystem'
import { BuffPool } from './BuffPool'
import { BuffRegistry } from './BuffRegistry'
import type { Buff } from './Buff'
import type { BuffDefinition } from './BuffDefinition'
import type { CombatEntity } from '../combat/CombatEntity'
import { CombatSystem as RealCombatSystem } from '../combat/CombatSystem'
import type { CombatSystem } from '../combat/CombatSystem'
import { EventBus } from '../events/EventBus'
import { createBaseStats } from '../stats/StatBlock'
import { createSkillRuntimeStats } from '../skill/SkillRuntimeStats'

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

// Mộc Tu Trúc Cơ Pure ("Độc Căn" major, Plans/PoisonPath mục 8,
// 2026-08-21) — "Poison càng lâu càng mạnh": BuffSystem.getPoisonRootMultiplier().
// Ported from AilmentSystem.poisonRoot.test.ts (5 cases) — the poisonRoot
// config now lives on the BuffDefinition's dot effect itself
// (poisonRootPercentPerStack/poisonRootMaxStacks/poisonRootThresholdBonusPercent),
// NOT on source.skillStats like the old Ailment model.
describe('BuffSystem — Độc Căn (ported from AilmentSystem.poisonRoot.test.ts)', () => {
  // trung_doc (data/ailment/ailments.ts): duration 5, stackMode stack,
  // maxStacks 5, element wood, dpsRatio 0.2.
  function trungDoc(overrides: Partial<Extract<BuffDefinition['effects'][number], { type: 'dot' }>> = {}): BuffDefinition {
    return {
      id: 'trung_doc', name: 'Trúng Độc', polarity: 'debuff',
      duration: 5, maxStacks: 5, stackMode: 'stack',
      effects: [{ type: 'dot', dpsRatio: 0.2, element: 'wood', ...overrides }],
    }
  }

  it('poisonRootMaxStacks=0 (mặc định, chưa mua Độc Căn) — không đổi hành vi cũ', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const combatSystem = new RealCombatSystem(new EventBus())

    const source = makeEntity({ id: 'source', type: 'player', stats: { ...createBaseStats(), woodPower: 100 } })
    const target = makeEntity({ id: 'target', currentHp: 1000, maxHp: 1000 })

    system.apply(trungDoc(), source, target)

    const hpBeforeTick = target.currentHp

    system.update(1, target, combatSystem)

    // dpsRatio 0.2 × (ATK 10 + woodPower 100 = 110, plan §3.2) × stacks
    // 1 × 1s, hệ số Độc Căn = 1.
    expect(hpBeforeTick - target.currentHp).toBeCloseTo(22, 5)
  })

  it('Trúng Độc tồn tại liên tục càng lâu, damage/giây càng tăng theo tầng Độc Căn', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const combatSystem = new RealCombatSystem(new EventBus())

    const source = makeEntity({ id: 'source', type: 'player', stats: { ...createBaseStats(), woodPower: 100 } })
    const target = makeEntity({ id: 'target', currentHp: 1000000, maxHp: 1000000 })

    system.apply(trungDoc({ poisonRootPercentPerStack: 0.03, poisonRootMaxStacks: 5 }), source, target)

    const hpAfterTick1 = (() => {
      const before = target.currentHp
      system.update(1, target, combatSystem)
      return before - target.currentHp
    })()

    const hpAfterTick2 = (() => {
      const before = target.currentHp
      system.update(1, target, combatSystem)
      return before - target.currentHp
    })()

    // Tick 2 (2 tầng Độc Căn) phải gây nhiều damage hơn Tick 1 (1 tầng).
    expect(hpAfterTick2).toBeGreaterThan(hpAfterTick1)
    // Tick 1: 22 × (1 + 0.03×1) = 22.66.
    expect(hpAfterTick1).toBeCloseTo(22.66, 5)
  })

  it('"Độc Mạch" — từ 3 tầng Độc Căn trở lên cộng thêm poisonRootThresholdBonusPercent', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const combatSystem = new RealCombatSystem(new EventBus())

    const source = makeEntity({ id: 'source', type: 'player', stats: { ...createBaseStats(), woodPower: 100 } })
    const target = makeEntity({ id: 'target', currentHp: 1000000, maxHp: 1000000 })

    system.apply(
      trungDoc({ poisonRootPercentPerStack: 0.03, poisonRootMaxStacks: 5, poisonRootThresholdBonusPercent: 0.05 }),
      source, target,
    )

    // 2 tick đầu (1-2 tầng) CHƯA đạt ngưỡng.
    system.update(1, target, combatSystem)
    system.update(1, target, combatSystem)

    const before = target.currentHp
    // Tick 3 — vừa chạm 3 tầng, threshold bonus bắt đầu tính.
    system.update(1, target, combatSystem)
    const tick3Damage = before - target.currentHp

    // 22 × (1 + 0.03×3 + 0.05) = 22 × 1.14 = 25.08.
    expect(tick3Damage).toBeCloseTo(25.08, 5)
  })

  it('poisonRootMaxStacks — tầng Độc Căn KHÔNG vượt trần dù buff tồn tại lâu hơn', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const combatSystem = new RealCombatSystem(new EventBus())

    const source = makeEntity({ id: 'source', type: 'player', stats: { ...createBaseStats(), woodPower: 100 } })
    const target = makeEntity({ id: 'target', currentHp: 1000000, maxHp: 1000000 })

    system.apply(trungDoc({ poisonRootPercentPerStack: 0.03, poisonRootMaxStacks: 5 }), source, target)

    // renewWithExtension() (KHÔNG apply() lại — apply() lại sẽ cộng thêm
    // `buff.stacks` qua stackMode 'stack' đã có sẵn, một cơ chế KHÁC hẳn
    // Độc Căn, gây nhiễu phép đo) để giữ buff sống lâu hơn hẳn
    // poisonRootMaxStacks (5) mà continuousSeconds vẫn tăng đều.
    for (let tick = 0; tick < 4; tick++) {
      system.renewWithExtension('trung_doc', 'source', 1)
      system.update(1, target, combatSystem)
    }

    const beforeTick5 = target.currentHp
    system.renewWithExtension('trung_doc', 'source', 1)
    system.update(1, target, combatSystem)
    const tick5Damage = beforeTick5 - target.currentHp

    const beforeTick6 = target.currentHp
    system.renewWithExtension('trung_doc', 'source', 1)
    system.update(1, target, combatSystem)
    const tick6Damage = beforeTick6 - target.currentHp

    // Tick 5 (5 tầng, chạm trần) và Tick 6 (continuousSeconds=6 nhưng vẫn
    // kẹp ở 5 tầng) phải GIỐNG NHAU — 22 × (1 + 0.03×5) = 25.3.
    expect(tick5Damage).toBeCloseTo(25.3, 5)
    expect(tick6Damage).toBeCloseTo(25.3, 5)
  })

  it('ailmentDurationPercent — kéo dài duration khi áp buff', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const combatSystem = new RealCombatSystem(new EventBus())

    const source = makeEntity({ id: 'source', type: 'player', stats: { ...createBaseStats(), woodPower: 100, ailmentDurationPercent: 0.1 } })
    const target = makeEntity({ id: 'target', currentHp: 1000, maxHp: 1000 })

    system.apply(trungDoc(), source, target)

    // trung_doc duration 5s (xem ailments.ts) × 1.1 = 5.5s — sau 5.4s vẫn
    // còn active, sau 5.6s mới hết.
    system.update(5.4, target, combatSystem)
    expect(system.getActiveIds()).toEqual(['trung_doc'])

    system.update(0.2, target, combatSystem)
    expect(system.getActiveIds()).toEqual([])
  })
})

// Kim Tu Trúc Cơ Pure ("Kim Thế" major, Plans/KimPath mục 9, 2026-08-21) —
// BuffSystem.calculateDamagePerSecond()'s kimTheMultiplier, CHỈ scope cho
// DoT element 'metal'. Ported from AilmentSystem.kimThe.test.ts (4 cases)
// — kimTheDotDamagePercentPerStack/metalAilmentPotencyPercent STILL live
// on source.skillStats (SkillRuntimeStats), unlike poisonRoot which moved
// onto the BuffDefinition effect.
describe('BuffSystem — Kim Thế (ported from AilmentSystem.kimThe.test.ts)', () => {
  // chay_mau (data/ailment/ailments.ts): duration 5, stackMode stack,
  // maxStacks 5, element metal, dpsRatio 0.2.
  const chayMau: BuffDefinition = {
    id: 'chay_mau', name: 'Chảy Máu', polarity: 'debuff',
    duration: 5, maxStacks: 5, stackMode: 'stack',
    effects: [{ type: 'dot', dpsRatio: 0.2, element: 'metal' }],
  }

  it('currentKimThe=0 (mặc định, chưa mua Kim Thế) — không đổi hành vi cũ', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const combatSystem = new RealCombatSystem(new EventBus())

    const source = makeEntity({ id: 'source', type: 'player', stats: { ...createBaseStats(), metalPower: 100 } })
    const target = makeEntity({ id: 'target', currentHp: 1000, maxHp: 1000 })

    system.apply(chayMau, source, target)

    const before = target.currentHp

    system.update(1, target, combatSystem)

    // dpsRatio 0.2 × (ATK 10 + metalPower 100 = 110, plan §3.2) × stacks
    // 1 × 1s, kimTheMultiplier = 1.
    expect(before - target.currentHp).toBeCloseTo(22, 5)
  })

  it('currentKimThe > 0 nhân thêm kimTheDotDamagePercentPerStack VÀO ĐÚNG DoT element metal', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const combatSystem = new RealCombatSystem(new EventBus())

    const source = makeEntity({
      id: 'source', type: 'player', stats: { ...createBaseStats(), metalPower: 100 },
      skillStats: { ...createSkillRuntimeStats(), kimTheDotDamagePercentPerStack: 0.05 }, currentKimThe: 3,
    })
    const target = makeEntity({ id: 'target', currentHp: 1000, maxHp: 1000 })

    system.apply(chayMau, source, target)

    const before = target.currentHp

    system.update(1, target, combatSystem)

    // 22 × (1 + 3×0.05) = 25.3.
    expect(before - target.currentHp).toBeCloseTo(25.3, 5)
  })

  it('metalAilmentPotencyPercent ("Huyết Lưu") cộng dồn cùng chỗ với kimTheDotDamagePercentPerStack', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const combatSystem = new RealCombatSystem(new EventBus())

    const source = makeEntity({
      id: 'source', type: 'player', stats: { ...createBaseStats(), metalPower: 100 }, currentKimThe: 3,
      skillStats: { ...createSkillRuntimeStats(), kimTheDotDamagePercentPerStack: 0.05, metalAilmentPotencyPercent: 0.1 },
    })
    const target = makeEntity({ id: 'target', currentHp: 1000, maxHp: 1000 })

    system.apply(chayMau, source, target)

    const before = target.currentHp

    system.update(1, target, combatSystem)

    // 22 × (1 + 3×0.05 + 0.1) = 22 × 1.25 = 27.5.
    expect(before - target.currentHp).toBeCloseTo(27.5, 5)
  })

  it('currentKimThe KHÔNG ảnh hưởng DoT hành khác (Trúng Độc, Mộc) — tránh build lai bị buff nhầm', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const combatSystem = new RealCombatSystem(new EventBus())

    const trungDoc: BuffDefinition = {
      id: 'trung_doc', name: 'Trúng Độc', polarity: 'debuff',
      duration: 5, maxStacks: 5, stackMode: 'stack',
      effects: [{ type: 'dot', dpsRatio: 0.2, element: 'wood' }],
    }

    const source = makeEntity({
      id: 'source', type: 'player', stats: { ...createBaseStats(), woodPower: 100 }, currentKimThe: 5,
      skillStats: { ...createSkillRuntimeStats(), kimTheDotDamagePercentPerStack: 0.05, metalAilmentPotencyPercent: 0.1 },
    })
    const target = makeEntity({ id: 'target', currentHp: 1000, maxHp: 1000 })

    system.apply(trungDoc, source, target)

    const before = target.currentHp

    system.update(1, target, combatSystem)

    // dpsRatio 0.2 × (ATK 10 + woodPower 100 = 110) × 1s = 22, KHÔNG nhân
    // thêm gì cả dù currentKimThe=5 và metalAilmentPotencyPercent=0.1
    // (cả 2 chỉ scope cho element 'metal').
    expect(before - target.currentHp).toBeCloseTo(22, 5)
  })
})

// Thổ Tu (Thạch Hóa, Plans/magicpathgeneral, 2026-08-21) —
// BuffSystem.rollOnHitEffects()'s general onHitProc effect. Ported from
// AilmentSystem.onHitProc.test.ts (8 cases total: 2 statModifier-shape
// checks + 6 rollOnHitEffects() boundary cases).
describe('BuffSystem — on-hit proc / Thạch Hóa (ported from AilmentSystem.onHitProc.test.ts)', () => {
  // thach_hoa / choang / bong (data/ailment/ailments.ts).
  const thachHoa: BuffDefinition = {
    id: 'thach_hoa', name: 'Thạch Hóa', polarity: 'debuff',
    duration: 4, stackMode: 'refresh',
    effects: [
      { type: 'statModifier', stat: 'evasionRate', percent: -0.3 },
      { type: 'onHitProc', chance: 0.5, appliesBuffId: 'choang' },
    ],
  }
  const choang: BuffDefinition = {
    id: 'choang', name: 'Choáng', polarity: 'debuff',
    duration: 1.5, stackMode: 'refresh',
    effects: [{ type: 'cc', ccEffect: 'stun' }],
  }
  const bong: BuffDefinition = {
    id: 'bong', name: 'Bỏng', polarity: 'debuff',
    duration: 4, stackMode: 'refresh',
    effects: [{ type: 'dot', dpsRatio: 0.3, element: 'fire' }],
  }

  function makeRegistry(): BuffRegistry {
    const registry = new BuffRegistry()
    registry.register(thachHoa)
    registry.register(choang)
    registry.register(bong)
    return registry
  }

  it('statModifier + onHitProc cùng khai trên 1 definition — không phải marker rỗng nữa (phản hồi người dùng 2026-08-21)', () => {
    expect(thachHoa.effects).toEqual([
      { type: 'statModifier', stat: 'evasionRate', percent: -0.3 },
      { type: 'onHitProc', chance: 0.5, appliesBuffId: 'choang' },
    ])
  })

  it('apply() lên target — getActiveModifiers() trả về đúng modifier evasionRate', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const source = makeEntity({ id: 'source', type: 'player' })
    const target = makeEntity({ id: 'target' })

    system.apply(thachHoa, source, target)

    const modifiers = system.getActiveModifiers()

    expect(modifiers).toContainEqual(
      expect.objectContaining({ stat: 'evasionRate', percent: -0.3, sourceId: 'source' }),
    )
  })

  it('Thạch Hóa (onHitChance thật 0.5) active — target thực sự có khả năng nhận Choáng (kiểm tra field, không kiểm tra roll)', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const source = makeEntity({ id: 'source', type: 'player' })
    const target = makeEntity({ id: 'target' })
    const registry = makeRegistry()

    system.apply(thachHoa, source, target, registry)

    const onHitEffect = registry.get('thach_hoa').effects.find(e => e.type === 'onHitProc')

    expect(onHitEffect).toMatchObject({ chance: 0.5, appliesBuffId: 'choang' })
  })

  it('không có buff on-hit-proc nào active — rollOnHitEffects() không áp gì cả', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const source = makeEntity({ id: 'source', type: 'player' })
    const target = makeEntity({ id: 'target' })
    const registry = makeRegistry()

    system.rollOnHitEffects(source, target, registry)

    expect(system.getActiveIds()).toEqual([])
  })

  it('buff on-hit-proc active với onHitChance=1 (biên trên) — LUÔN áp appliesBuffId', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const source = makeEntity({ id: 'source', type: 'player' })
    const target = makeEntity({ id: 'target' })
    const registry = makeRegistry()

    // Snapshot thủ công 1 definition test riêng (chance=1) thay vì Thạch
    // Hóa thật (0.5) — biên xác định, không phụ thuộc Math.random.
    const thachHoaChance1: BuffDefinition = {
      ...thachHoa,
      effects: [
        { type: 'statModifier', stat: 'evasionRate', percent: -0.3 },
        { type: 'onHitProc', chance: 1, appliesBuffId: 'choang' },
      ],
    }

    system.apply(thachHoaChance1, source, target, registry)

    system.rollOnHitEffects(source, target, registry)

    expect(system.getActiveIds().sort()).toEqual(['choang', 'thach_hoa'])
    expect(system.isStunned()).toBe(true)
  })

  it('onHitChance=0 (biên dưới) — KHÔNG BAO GIỜ áp dù buff vẫn active', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const source = makeEntity({ id: 'source', type: 'player' })
    const target = makeEntity({ id: 'target' })
    const registry = makeRegistry()

    const thachHoaChance0: BuffDefinition = {
      ...thachHoa,
      effects: [
        { type: 'statModifier', stat: 'evasionRate', percent: -0.3 },
        { type: 'onHitProc', chance: 0, appliesBuffId: 'choang' },
      ],
    }

    system.apply(thachHoaChance0, source, target, registry)

    for (let i = 0; i < 20; i++) {
      system.rollOnHitEffects(source, target, registry)
    }

    expect(system.getActiveIds()).toEqual(['thach_hoa'])
    expect(system.isStunned()).toBe(false)
  })

  it('Choáng vừa proc sourceId = kẻ VỪA đánh trúng (source truyền vào rollOnHitEffects), KHÔNG phải sourceId gốc của Thạch Hóa', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const originalCaster = makeEntity({ id: 'original_caster', type: 'player' })
    const laterAttacker = makeEntity({ id: 'later_attacker' })
    const target = makeEntity({ id: 'target' })
    const registry = makeRegistry()

    const thachHoaChance1: BuffDefinition = {
      ...thachHoa,
      effects: [
        { type: 'statModifier', stat: 'evasionRate', percent: -0.3 },
        { type: 'onHitProc', chance: 1, appliesBuffId: 'choang' },
      ],
    }

    // thach_hoa được nguồn A áp lên, nhưng lần TRÚNG ĐÒN kích Choáng lại
    // đến từ nguồn B (vd 1 skill/entity khác đánh trúng target đang
    // mang Thạch Hóa) — Choáng phải mang sourceId của B.
    system.apply(thachHoaChance1, originalCaster, target, registry)

    system.rollOnHitEffects(laterAttacker, target, registry)

    expect(system.getActiveIds()).toContain('choang')
    expect(pool.getFromSource('choang', 'later_attacker')).toBeDefined()
  })

  it('buff không khai onHitProc (vd Bỏng thường) — rollOnHitEffects() bỏ qua, không crash', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const source = makeEntity({ id: 'source', type: 'player' })
    const target = makeEntity({ id: 'target' })
    const registry = makeRegistry()

    system.apply(bong, source, target, registry)

    expect(() => system.rollOnHitEffects(source, target, registry)).not.toThrow()
    expect(system.getActiveIds()).toEqual(['bong'])
  })
})

// Làm Chậm giữ liên tục 2s -> Đóng Băng (BuffSystem.update()'s convert()).
// Duration buff SAU chuyển hoá phải qua cùng công thức kháng cự như
// apply() (trước đây lấy trần duration template, kháng cự của đích bị bỏ
// qua). Ported from AilmentSystem.convert.test.ts (3 cases) — measured
// through isFrozen(), not private pool internals.
describe('BuffSystem — conversion chain, Làm Chậm -> Đóng Băng (ported from AilmentSystem.convert.test.ts)', () => {
  // lam_cham / dong_bang (data/ailment/ailments.ts).
  const lamCham: BuffDefinition = {
    id: 'lam_cham', name: 'Làm Chậm', polarity: 'debuff',
    duration: 4, stackMode: 'refresh',
    convertsToId: 'dong_bang', convertsAfterContinuousSeconds: 2,
    effects: [
      { type: 'statModifier', stat: 'speed', percent: -0.3 },
    ],
  }
  const dongBang: BuffDefinition = {
    id: 'dong_bang', name: 'Đóng Băng', polarity: 'debuff',
    duration: 2, stackMode: 'refresh',
    effects: [{ type: 'cc', ccEffect: 'freeze' }],
  }

  function makeRegistry(): BuffRegistry {
    const registry = new BuffRegistry()
    registry.register(lamCham)
    registry.register(dongBang)
    return registry
  }

  it('target không kháng — Đóng Băng sống đủ 2s (duration definition)', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const combatSystem = new RealCombatSystem(new EventBus())
    const registry = makeRegistry()
    const source = makeEntity({ id: 'source', type: 'player' })
    const target = makeEntity({ id: 'target' })

    system.apply(lamCham, source, target, registry)
    system.update(2, target, combatSystem, registry)

    expect(system.isFrozen()).toBe(true)

    system.update(1.5, target, combatSystem, registry)
    expect(system.isFrozen()).toBe(true)

    system.update(1, target, combatSystem, registry)
    expect(system.isFrozen()).toBe(false)
  })

  it('target kháng 50% — Đóng Băng chỉ còn 1s', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const combatSystem = new RealCombatSystem(new EventBus())
    const registry = makeRegistry()
    const source = makeEntity({ id: 'source', type: 'player' })
    const target = makeEntity({ id: 'target', stats: { ...createBaseStats(), ailmentResistPercent: 0.5 } })

    system.apply(lamCham, source, target, registry)
    system.update(2, target, combatSystem, registry)

    expect(system.isFrozen()).toBe(true)

    system.update(0.5, target, combatSystem, registry)
    expect(system.isFrozen()).toBe(true)

    system.update(1, target, combatSystem, registry)
    expect(system.isFrozen()).toBe(false)
  })

  it('nguồn có ailmentDurationPercent +50% — nhân thêm sau kháng cự (1.5s)', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const combatSystem = new RealCombatSystem(new EventBus())
    const registry = makeRegistry()
    const source = makeEntity({ id: 'source', type: 'player', stats: { ...createBaseStats(), ailmentDurationPercent: 0.5 } })
    const target = makeEntity({ id: 'target', stats: { ...createBaseStats(), ailmentResistPercent: 0.5 } })
    const resolveSource = (sourceId: string) => (sourceId === source.id ? source : undefined)

    system.apply(lamCham, source, target, registry)
    system.update(2, target, combatSystem, registry, resolveSource)

    expect(system.isFrozen()).toBe(true)

    system.update(1, target, combatSystem, registry, resolveSource)
    expect(system.isFrozen()).toBe(true)

    system.update(1, target, combatSystem, registry, resolveSource)
    expect(system.isFrozen()).toBe(false)
  })
})

// E1 — convert-on-max (spec talent v4 2026-09-03 §3.3): buff
// stackMode 'stack' CÓ convertsToId chạm maxStacks → buff cũ bị remove,
// buff convert được apply với stacks = 1 (nhịp "tích → ngưỡng → bùng nổ
// → tích lại" của talent v4). Khóa hành vi có sẵn ở handleExisting()
// case 'stack' — không đổi production code, chỉ chốt không hồi quy.
describe('BuffSystem — E1 convert-on-max (spec talent v4 §3.3)', () => {
  const tangTich: BuffDefinition = {
    id: 'tang_tich', name: 'Tích Tầng', polarity: 'buff',
    duration: 6, maxStacks: 3, stackMode: 'stack',
    convertsToId: 'bung_no',
    effects: [{ type: 'statModifier', stat: 'criticalRate', percent: 0.01 }],
  }
  const bungNo: BuffDefinition = {
    id: 'bung_no', name: 'Bùng Nổ', polarity: 'buff',
    duration: 8, stackMode: 'refresh',
    effects: [{ type: 'statModifier', stat: 'finalDamagePercent', percent: 0.3 }],
  }
  const khongConvert: BuffDefinition = {
    id: 'khong_convert', name: 'Không Convert', polarity: 'buff',
    duration: 6, maxStacks: 3, stackMode: 'stack',
    effects: [{ type: 'statModifier', stat: 'defense', percent: 0.02 }],
  }

  function makeConvertRegistry(): BuffRegistry {
    const registry = new BuffRegistry()
    registry.register(tangTich)
    registry.register(bungNo)
    registry.register(khongConvert)
    return registry
  }

  it('buff stack chạm maxStacks → remove buff cũ, apply convertsToId với stacks = 1', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const registry = makeConvertRegistry()
    const source = makeEntity({ id: 'source', type: 'player' })
    const target = makeEntity({ id: 'target' })

    system.apply(tangTich, source, target, registry) // stacks 1
    system.apply(tangTich, source, target, registry) // stacks 2
    system.apply(tangTich, source, target, registry) // stacks 3 = maxStacks → convert

    expect(pool.getFromSource('tang_tich', 'source')).toBeUndefined()
    expect(pool.getFromSource('bung_no', 'source')).toBeDefined()
    expect(pool.getFromSource('bung_no', 'source')!.stacks).toBe(1)
    expect(system.getActiveIds()).toEqual(['bung_no'])
  })

  it('buff KHÔNG khai convertsToId → chạm maxStacks vẫn giữ nguyên (không convert)', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const registry = makeConvertRegistry()
    const source = makeEntity({ id: 'source', type: 'player' })
    const target = makeEntity({ id: 'target' })

    for (let i = 0; i < 5; i++) {
      system.apply(khongConvert, source, target, registry)
    }

    const stored = pool.getFromSource('khong_convert', 'source')

    expect(stored).toBeDefined()
    expect(stored!.stacks).toBe(3)
    expect(pool.getFromSource('bung_no', 'source')).toBeUndefined()
  })

  it('2 đường convert độc lập: on-max chỉ cần maxStacks, theo-thời-gian chỉ cần convertsAfterContinuousSeconds', () => {
    // Guard kiến trúc — convert-on-max fire trong handleExisting() case
    // 'stack' (nextStacks >= maxStacks); convert theo thời gian fire
    // trong update() (continuousSeconds >= convertsAfterContinuousSeconds).
    // Đường thời gian đã được đo ở 3 describe Làm Chậm phía trên — ở đây
    // chỉ chốt 2 template khai báo đúng đường của mình (template thời gian
    // là refresh, không maxStacks; template on-max không có ngưỡng thời gian).
    const thoiGian: BuffDefinition = {
      id: 'thoi_gian', name: 'Theo Thời Gian', polarity: 'debuff',
      duration: 4, stackMode: 'refresh',
      convertsToId: 'dong_bang', convertsAfterContinuousSeconds: 2,
      effects: [{ type: 'statModifier', stat: 'speed', percent: -0.3 }],
    }

    expect(thoiGian.maxStacks).toBeUndefined()
    expect(thoiGian.convertsAfterContinuousSeconds).toBe(2)
    expect(tangTich.convertsAfterContinuousSeconds).toBeUndefined()
    expect(tangTich.maxStacks).toBe(3)
  })
})
