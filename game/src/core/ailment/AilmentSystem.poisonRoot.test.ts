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

// Mộc Tu Trúc Cơ Pure ("Độc Căn" major, Plans/PoisonPath mục 8,
// 2026-08-21) — "Poison càng lâu càng mạnh": AilmentSystem.update()'s
// getPoisonRootMultiplier().
describe('AilmentSystem — Độc Căn (Plans/PoisonPath, Trúc Cơ Pure Mộc)', () => {
  it('poisonRootMaxStacks=0 (mặc định, chưa mua Độc Căn) — không đổi hành vi cũ', () => {
    const eventBus = new EventBus()
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player', stats: { ...createBaseStats(), woodPower: 100 } })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('trung_doc'), source, target)

    const hpBeforeTick = target.currentHp

    ailmentSystem.update(1, target, combatSystem)

    // dpsRatio 0.2 × (ATK 10 + woodPower 100 = 110, plan §3.2) × stacks
    // 1 × 1s, hệ số Độc Căn = 1.
    expect(hpBeforeTick - target.currentHp).toBeCloseTo(22, 5)
  })

  it('Trúng Độc tồn tại liên tục càng lâu, damage/giây càng tăng theo tầng Độc Căn', () => {
    const eventBus = new EventBus()
    const combatSystem = new CombatSystem(eventBus)

    const sourceStats = { ...createBaseStats(), woodPower: 100 }
    const source = createCombatant({ id: 'source', type: 'player', stats: sourceStats, skillStats: { ...createSkillRuntimeStats(), poisonRootPercentPerStack: 0.03, poisonRootMaxStacks: 5 } })
    const target = createCombatant({ id: 'target', currentHp: 1000000, maxHp: 1000000 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('trung_doc'), source, target)

    const hpAfterTick1 = (() => {
      const before = target.currentHp
      ailmentSystem.update(1, target, combatSystem)
      return before - target.currentHp
    })()

    const hpAfterTick2 = (() => {
      const before = target.currentHp
      ailmentSystem.update(1, target, combatSystem)
      return before - target.currentHp
    })()

    // Tick 2 (2 tầng Độc Căn) phải gây nhiều damage hơn Tick 1 (1 tầng).
    expect(hpAfterTick2).toBeGreaterThan(hpAfterTick1)
    // Tick 1: 22 × (1 + 0.03×1) = 22.66.
    expect(hpAfterTick1).toBeCloseTo(22.66, 5)
  })

  it('"Độc Mạch" — từ 3 tầng Độc Căn trở lên cộng thêm poisonRootThresholdBonusPercent', () => {
    const eventBus = new EventBus()
    const combatSystem = new CombatSystem(eventBus)

    const sourceStats = {
      ...createBaseStats(),
      woodPower: 100,
    }
    const source = createCombatant({
      id: 'source', type: 'player', stats: sourceStats,
      skillStats: { ...createSkillRuntimeStats(), poisonRootPercentPerStack: 0.03, poisonRootMaxStacks: 5, poisonRootThresholdBonusPercent: 0.05 },
    })
    const target = createCombatant({ id: 'target', currentHp: 1000000, maxHp: 1000000 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('trung_doc'), source, target)

    // 2 tick đầu (1-2 tầng) CHƯA đạt ngưỡng.
    ailmentSystem.update(1, target, combatSystem)
    ailmentSystem.update(1, target, combatSystem)

    const before = target.currentHp
    // Tick 3 — vừa chạm 3 tầng, threshold bonus bắt đầu tính.
    ailmentSystem.update(1, target, combatSystem)
    const tick3Damage = before - target.currentHp

    // 22 × (1 + 0.03×3 + 0.05) = 22 × 1.14 = 25.08.
    expect(tick3Damage).toBeCloseTo(25.08, 5)
  })

  it('poisonRootMaxStacks — tầng Độc Căn KHÔNG vượt trần dù ailment tồn tại lâu hơn', () => {
    const eventBus = new EventBus()
    const combatSystem = new CombatSystem(eventBus)

    const sourceStats = { ...createBaseStats(), woodPower: 100 }
    const source = createCombatant({ id: 'source', type: 'player', stats: sourceStats, skillStats: { ...createSkillRuntimeStats(), poisonRootPercentPerStack: 0.03, poisonRootMaxStacks: 5 } })
    const target = createCombatant({ id: 'target', currentHp: 1000000, maxHp: 1000000 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('trung_doc'), source, target)

    // renewWithExtension() (KHÔNG apply() lại — apply() lại sẽ cộng thêm
    // `ailment.stacks` qua stackMode 'stack' đã có sẵn, một cơ chế
    // KHÁC hẳn Độc Căn, gây nhiễu phép đo) để giữ ailment sống lâu hơn
    // hẳn poisonRootMaxStacks (5) mà continuousSeconds vẫn tăng đều.
    for (let tick = 0; tick < 4; tick++) {
      ailmentSystem.renewWithExtension('trung_doc', 1)
      ailmentSystem.update(1, target, combatSystem)
    }

    const beforeTick5 = target.currentHp
    ailmentSystem.renewWithExtension('trung_doc', 1)
    ailmentSystem.update(1, target, combatSystem)
    const tick5Damage = beforeTick5 - target.currentHp

    const beforeTick6 = target.currentHp
    ailmentSystem.renewWithExtension('trung_doc', 1)
    ailmentSystem.update(1, target, combatSystem)
    const tick6Damage = beforeTick6 - target.currentHp

    // Tick 5 (5 tầng, chạm trần) và Tick 6 (continuousSeconds=6 nhưng
    // vẫn kẹp ở 5 tầng) phải GIỐNG NHAU — 22 × (1 + 0.03×5) = 25.3.
    expect(tick5Damage).toBeCloseTo(25.3, 5)
    expect(tick6Damage).toBeCloseTo(25.3, 5)
  })

  it('ailmentDurationPercent — kéo dài duration khi áp ailment', () => {
    const eventBus = new EventBus()
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player', stats: { ...createBaseStats(), woodPower: 100, ailmentDurationPercent: 0.1 } })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('trung_doc'), source, target)

    // trung_doc duration 5s (xem ailments.ts) × 1.1 = 5.5s — sau 5.4s
    // vẫn còn active, sau 5.6s mới hết.
    ailmentSystem.update(5.4, target, combatSystem)
    expect(ailmentSystem.getActiveIds()).toEqual(['trung_doc'])

    ailmentSystem.update(0.2, target, combatSystem)
    expect(ailmentSystem.getActiveIds()).toEqual([])

    void combatSystem
  })
})
