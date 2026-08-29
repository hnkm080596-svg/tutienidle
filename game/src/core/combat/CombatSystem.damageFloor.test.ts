import { describe, expect, it } from 'vitest'
import { CombatSystem } from './CombatSystem'
import { EventBus } from '../events/EventBus'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from './CombatEntity'

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0 }

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
    ...overrides,
  }
}

// Floor "tối thiểu 1" phải áp SAU finalDamageMultiplier — đòn bị affix
// giảm sát thương cuối cùng kéo xuống dưới 1 vẫn luôn gây đúng 1 sát
// thương (trước đây floor áp trước multiplier nên kết quả có thể < 1).
describe('CombatSystem — damage floor sau finalDamageMultiplier', () => {
  it('finalDamagePercent âm kéo damage dưới 1 — floor kéo lại đúng 1', () => {
    const combat = new CombatSystem(new EventBus())

    const sourceStats = { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 100, finalDamagePercent: -0.995 }
    const source = createCombatant({ id: 'source', type: 'player', stats: sourceStats })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const result = combat.resolveActionHit(source, target, { kind: 'physical', multiplier: 1 }, false)

    expect(result.finalDamage).toBe(1)
    expect(target.currentHp).toBe(999)
  })

  it('finalDamageReductionPercent tối đa (0.75) + damage nhỏ — vẫn gây ít nhất 1', () => {
    const combat = new CombatSystem(new EventBus())

    const sourceStats = { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 2 }
    const source = createCombatant({ id: 'source', type: 'player', stats: sourceStats })

    const targetStats = { ...createBaseStats(), evasionRate: 0, dexterity: 0, defense: 0, finalDamageReductionPercent: 0.75 }
    const target = createCombatant({ id: 'target', stats: targetStats, currentHp: 1000, maxHp: 1000 })

    const result = combat.resolveActionHit(source, target, { kind: 'physical', multiplier: 1 }, false)

    expect(result.finalDamage).toBeGreaterThanOrEqual(1)
    expect(target.currentHp).toBe(1000 - result.finalDamage)
  })
})
