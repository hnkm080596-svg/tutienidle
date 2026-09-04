import { describe, expect, it, vi } from 'vitest'
import { TurnBuffSystem } from './TurnBuffSystem'
import { TurnBuffPool } from './TurnBuffPool'
import type { TurnBuffDefinition, TurnBuffRegistry } from './TurnBuffTypes'
import type { CombatEntity } from '../../combat/CombatEntity'
import type { CombatSystem } from '../../combat/CombatSystem'
import { createBaseStats } from '../../stats/StatBlock'

// QA adversarial probes (2026-09-04 quick review) — TurnBuffSystem.

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

describe('TurnBuffSystem adversarial (QA probes)', () => {
  it('INV-TB-1: target chết — DoT KHÔNG tick nhưng remainingTurns vẫn giảm', () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = makeEntity({ id: 'source_1' })
    const target = makeEntity({ id: 'target_1', alive: false })
    const combat = makeCombatSystem()

    system.apply(
      { id: 'bleed', name: 'Bleed', polarity: 'debuff', duration: 2, stackMode: 'refresh',
        effects: [{ type: 'dot', dpsRatio: 1 }] },
      source,
      target,
    )

    system.update(target, combat)

    expect(combat.applyDotDamage).not.toHaveBeenCalled()
    expect(pool.getFromSource('bleed', 'source_1')!.remainingTurns).toBe(1)
  })

  it('INV-TB-2: convert giữa update loop không làm mất buff khác — iteration qua snapshot an toàn', () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = makeEntity({ id: 'source_1' })
    const target = makeEntity({ id: 'target_1' })
    const slow: TurnBuffDefinition = {
      id: 'slow', name: 'Slow', polarity: 'debuff', duration: 5, stackMode: 'refresh',
      convertsToId: 'frozen', convertsAfterContinuousTurns: 1, effects: [],
    }
    const frozen: TurnBuffDefinition = {
      id: 'frozen', name: 'Frozen', polarity: 'debuff', duration: 5, stackMode: 'refresh',
      effects: [{ type: 'cc', ccEffect: 'freeze' }],
    }
    const other: TurnBuffDefinition = {
      id: 'other', name: 'Other', polarity: 'debuff', duration: 5, stackMode: 'refresh', effects: [],
    }
    const registry: TurnBuffRegistry = { get: (id) => (id === 'slow' ? slow : id === 'frozen' ? frozen : other) }

    system.apply(slow, source, target, registry)
    system.apply(other, source, target, registry)
    system.update(target, makeCombatSystem(), registry, () => source)

    // slow convert thành frozen, other vẫn nguyên.
    expect(pool.getFromSource('slow', 'source_1')).toBeUndefined()
    expect(pool.getFromSource('frozen', 'source_1')).toBeDefined()
    expect(pool.getFromSource('other', 'source_1')).toBeDefined()
    expect(pool.getFromSource('other', 'source_1')!.remainingTurns).toBe(4)
  })

  it('INV-TB-3: ailmentResistPercent > cap 0.75 bị clamp — duration không âm', () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = makeEntity({ id: 'source_1' })
    const target = makeEntity({ id: 'target_1', stats: { ...createBaseStats(), evasionRate: 0, criticalRate: 0, blockChance: 0, ailmentResistPercent: 5 } })
    const definition: TurnBuffDefinition = {
      id: 'test', name: 'Test', polarity: 'debuff', duration: 4, stackMode: 'refresh', effects: [],
    }

    system.apply(definition, source, target)

    const instance = pool.getFromSource('test', 'source_1')!
    // 4 * (1 - 0.75) = 1 — clamp đúng tại cap, không 0/âm.
    expect(instance.remainingTurns).toBe(1)
  })

  it('INV-TB-4: maxStacksBonus từ skillStats cộng vào maxStacks', () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = makeEntity({
      id: 'source_1',
      skillStats: { maxStacksBonusByBuffId: { test: 2 } } as unknown as CombatEntity['skillStats'],
    })
    const target = makeEntity({ id: 'target_1' })
    const definition: TurnBuffDefinition = {
      id: 'test', name: 'Test', polarity: 'debuff',
      duration: 3, maxStacks: 2, stackMode: 'stack', effects: [],
    }

    system.apply(definition, source, target)
    system.apply(definition, source, target)
    system.apply(definition, source, target) // cap thật = 2 + 2 = 4

    expect(pool.getFromSource('test', 'source_1')!.stacks).toBe(3)
  })

  it('INV-TB-5: refresh không đổi stacks (chỉ reset remainingTurns)', () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = makeEntity({ id: 'source_1' })
    const target = makeEntity({ id: 'target_1' })
    const definition: TurnBuffDefinition = {
      id: 'test', name: 'Test', polarity: 'debuff',
      duration: 3, maxStacks: 5, stackMode: 'refresh', effects: [],
    }

    system.apply(definition, source, target)
    system.apply(definition, source, target)
    system.apply(definition, source, target)

    const instance = pool.getFromSource('test', 'source_1')!
    expect(instance.stacks).toBe(1)
    expect(instance.remainingTurns).toBe(3)
  })
})
