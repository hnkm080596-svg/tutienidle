import { describe, expect, it } from 'vitest'
import { AilmentSystem } from './AilmentSystem'
import { AilmentManager } from './AilmentManager'
import { CombatSystem } from '../combat/CombatSystem'
import { EventBus } from '../events/EventBus'
import { createBaseStats } from '../stats/StatBlock'
import { ailments } from '../../data/ailment/ailments'
import type { CombatEntity } from '../combat/CombatEntity'
import type { AilmentTemplate } from './AilmentRegistry'
import { createSkillRuntimeStats } from '../skill/SkillRuntimeStats'

function getTemplate(id: string): AilmentTemplate {
  const template = ailments.find(ailment => ailment.id === id)

  if (!template) {
    throw new Error(`data/ailment/ailments.ts thiếu '${id}' — kiểm tra lại id`)
  }

  return template
}

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats()

  return {
    id: 'id',
    name: 'name',
    type: 'enemy',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentRage: 0,
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

// Kim Tu Trúc Cơ Pure ("Kim Thế" major, Plans/KimPath mục 9, 2026-08-21)
// — AilmentSystem.apply()'s kimTheMultiplier, CHỈ scope cho DoT
// element 'metal'.
describe('AilmentSystem — Kim Thế (Plans/KimPath, Trúc Cơ Pure Kim)', () => {
  it('currentKimThe=0 (mặc định, chưa mua Kim Thế) — không đổi hành vi cũ', () => {
    const eventBus = new EventBus()
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player', stats: { ...createBaseStats(), metalPower: 100 } })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('chay_mau'), source, target)

    const before = target.currentHp

    ailmentSystem.update(1, target, combatSystem)

    // dpsRatio 0.2 × (ATK 10 + metalPower 100 = 110, plan §3.2) × stacks
    // 1 × 1s, kimTheMultiplier = 1.
    expect(before - target.currentHp).toBeCloseTo(22, 5)
  })

  it('currentKimThe > 0 nhân thêm kimTheDotDamagePercentPerStack VÀO ĐÚNG DoT element metal', () => {
    const eventBus = new EventBus()
    const combatSystem = new CombatSystem(eventBus)

    const sourceStats = { ...createBaseStats(), metalPower: 100 }
    const source = createCombatant({ id: 'source', type: 'player', stats: sourceStats, skillStats: { ...createSkillRuntimeStats(), kimTheDotDamagePercentPerStack: 0.05 }, currentKimThe: 3 })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('chay_mau'), source, target)

    const before = target.currentHp

    ailmentSystem.update(1, target, combatSystem)

    // 22 × (1 + 3×0.05) = 25.3.
    expect(before - target.currentHp).toBeCloseTo(25.3, 5)
  })

  it('metalAilmentPotencyPercent ("Huyết Lưu") cộng dồn cùng chỗ với kimTheDotDamagePercentPerStack', () => {
    const eventBus = new EventBus()
    const combatSystem = new CombatSystem(eventBus)

    const sourceStats = {
      ...createBaseStats(),
      metalPower: 100,
    }
    const source = createCombatant({
      id: 'source', type: 'player', stats: sourceStats, currentKimThe: 3,
      skillStats: { ...createSkillRuntimeStats(), kimTheDotDamagePercentPerStack: 0.05, metalAilmentPotencyPercent: 0.1 },
    })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('chay_mau'), source, target)

    const before = target.currentHp

    ailmentSystem.update(1, target, combatSystem)

    // 22 × (1 + 3×0.05 + 0.1) = 22 × 1.25 = 27.5.
    expect(before - target.currentHp).toBeCloseTo(27.5, 5)
  })

  it('currentKimThe KHÔNG ảnh hưởng DoT hành khác (Trúng Độc, Mộc) — tránh build lai bị buff nhầm', () => {
    const eventBus = new EventBus()
    const combatSystem = new CombatSystem(eventBus)

    const sourceStats = { ...createBaseStats(), woodPower: 100 }
    const source = createCombatant({
      id: 'source', type: 'player', stats: sourceStats, currentKimThe: 5,
      skillStats: { ...createSkillRuntimeStats(), kimTheDotDamagePercentPerStack: 0.05, metalAilmentPotencyPercent: 0.1 },
    })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('trung_doc'), source, target)

    const before = target.currentHp

    ailmentSystem.update(1, target, combatSystem)

    // dpsRatio 0.2 × (ATK 10 + woodPower 100 = 110) × 1s = 22, KHÔNG nhân
    // thêm gì cả dù currentKimThe=5 và metalAilmentPotencyPercent=0.1
    // (cả 2 chỉ scope cho element 'metal').
    expect(before - target.currentHp).toBeCloseTo(22, 5)
  })
})
