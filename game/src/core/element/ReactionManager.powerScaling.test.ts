import { describe, expect, it } from 'vitest'
import { ReactionManager } from './ReactionManager'
import { AilmentSystem } from '../ailment/AilmentSystem'
import { AilmentManager } from '../ailment/AilmentManager'
import { CombatSystem } from '../combat/CombatSystem'
import { EventBus } from '../events/EventBus'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import { ailments } from '../../data/ailment/ailments'

function getTemplate(id: string) {
  const template = ailments.find(ailment => ailment.id === id)

  if (!template) {
    throw new Error(`data/ailment/ailments.ts thiếu '${id}'`)
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

// Combat Balance Pass (2026-08-29) — Task 3: reaction scale theo Power
// nguyên tố của nguồn (plan §3.2). Field `powerScalingRatio` trên
// ElementReactionDefinition: damage = (baseDamage + sourcePower × ratio)
// × (1 + reactionEffectPercent). Element lấy từ ailment vừa áp
// (newAilmentId) — snapshot element trên instance ailment.
describe('ReactionManager — power scaling (Task 3)', () => {
  it('reaction có powerScalingRatio — damage cộng thêm sourcePower × ratio', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })

    // te_cong (Tê Cóng, element water) là ailment vừa áp — nguồn Power
    // đọc từ waterPower. createBaseStats attack nền = 10.
    source.stats.waterPower = 200

    const target = createCombatant({ id: 'target', currentHp: 100000, maxHp: 100000 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    // bong (element fire) áp trước; te_cong áp sau → cặp "Bốc Hơi"
    // (baseDamage 60, powerScalingRatio 1.0 — T5.4 nâng từ 0.5).
    ailmentSystem.apply(getTemplate('bong'), source, target)
    ailmentSystem.apply(getTemplate('te_cong'), source, target)

    reactionManager.checkAndTrigger(ailmentSystem, 'te_cong', source, target, combatSystem)

    const expectedPowerPart = (source.stats.attack + source.stats.waterPower) * 1.0

    // HP cuối = 100000 - (60 + powerPart). Tính ngược để không hard-code
    // attack nền (mọi caller test khác cũng lấy từ createBaseStats).
    expect(target.currentHp).toBeCloseTo(100000 - 60 - expectedPowerPart, 5)
  })

  it('sourcePower = 0 — damage về đúng baseDamage (hành vi cũ)', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })

    source.stats.waterPower = 0
    source.stats.attack = 0

    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('bong'), source, target)
    ailmentSystem.apply(getTemplate('te_cong'), source, target)

    reactionManager.checkAndTrigger(ailmentSystem, 'te_cong', source, target, combatSystem)

    expect(target.currentHp).toBe(1000 - 60)
  })

  it('reactionEffectPercent khuếch đại CẢ phần power', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })

    source.stats.reactionEffectPercent = 0.5
    // te_cong (element water) — ailment vừa áp cho test.
    source.stats.waterPower = 200

    const target = createCombatant({ id: 'target', currentHp: 100000, maxHp: 100000 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('bong'), source, target)
    ailmentSystem.apply(getTemplate('te_cong'), source, target)

    reactionManager.checkAndTrigger(ailmentSystem, 'te_cong', source, target, combatSystem)

    const expectedPowerPart = (source.stats.attack + source.stats.waterPower) * 1.0

    expect(target.currentHp).toBeCloseTo(100000 - (60 + expectedPowerPart) * 1.5, 5)
  })
})

// T5.4 (2026-09-01, user-approved "đầy đủ") — reaction scale theo
// realmIndex của SOURCE: baseDamage × realmScalar (phần "cứng" sống
// theo tiến trình, không chết late-game) + powerScalingRatio nâng
// 0.5 → 1.0 cho reaction damage chính. Công thức mới:
//   damage = (base × realmScalar(source.realmIndex) + powerPart) × (1 + reactionEffectPercent)
describe('ReactionManager — realm scalar (T5.4 full)', () => {
  it('baseDamage nhân theo realmScalar của SOURCE — Phàm Nhân (0) ×1 giữ behavior cũ', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player', realmIndex: 0 })
    source.stats.waterPower = 0
    source.stats.attack = 0

    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })
    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('bong'), source, target)
    ailmentSystem.apply(getTemplate('te_cong'), source, target)
    reactionManager.checkAndTrigger(ailmentSystem, 'te_cong', source, target, combatSystem)

    expect(target.currentHp).toBe(1000 - 60)
  })

  it('realmIndex 4 (Kim Đan): base 60 → 60 × 7 — reaction "sống" theo tiến trình', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    // realmScalar khởi điểm: 1 + realmIndex × 1.5 (realm 4 → 7.0)
    const source = createCombatant({ id: 'source', type: 'player', realmIndex: 4 })
    source.stats.waterPower = 0
    source.stats.attack = 0

    const target = createCombatant({ id: 'target', currentHp: 100000, maxHp: 100000 })
    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('bong'), source, target)
    ailmentSystem.apply(getTemplate('te_cong'), source, target)
    reactionManager.checkAndTrigger(ailmentSystem, 'te_cong', source, target, combatSystem)

    expect(target.currentHp).toBeCloseTo(100000 - 60 * 7, 5)
  })

  it('powerScalingRatio Bốc Hơi nay 1.0 (trước 0.5) — hệ số ngũ hành nặng hơn', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player', realmIndex: 0 })
    source.stats.waterPower = 200

    const target = createCombatant({ id: 'target', currentHp: 100000, maxHp: 100000 })
    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('bong'), source, target)
    ailmentSystem.apply(getTemplate('te_cong', ), source, target)
    reactionManager.checkAndTrigger(ailmentSystem, 'te_cong', source, target, combatSystem)

    const expectedPowerPart = (source.stats.attack + source.stats.waterPower) * 1.0

    expect(target.currentHp).toBeCloseTo(100000 - 60 - expectedPowerPart, 5)
  })
})
