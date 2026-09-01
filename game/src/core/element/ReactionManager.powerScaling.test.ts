import { describe, expect, it } from 'vitest'
import { ReactionManager } from './ReactionManager'
import { BuffSystem } from '../buff/BuffSystem'
import { BuffPool } from '../buff/BuffPool'
import { CombatSystem } from '../combat/CombatSystem'
import { EventBus } from '../events/EventBus'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import { ailments } from '../../data/ailment/ailments'
import type { AilmentTemplate } from '../ailment/AilmentRegistry'
import type { BuffDefinition } from '../buff/BuffDefinition'
import type { BuffEffectTemplate } from '../buff/BuffTypes'

// Unified Buff System (Task 12) — Task 7 (data/buff/buffs.ts port của
// AilmentTemplate -> BuffDefinition) chưa chạy tại thời điểm task này
// (dispatch order 12 TRƯỚC 7), nên test tự convert AilmentTemplate hiện
// có sang BuffDefinition CỤC BỘ trong file test này.
function toBuffDefinition(template: AilmentTemplate): BuffDefinition {
  const effects: BuffEffectTemplate[] = []

  if (template.category === 'dot' && template.dpsRatio !== undefined) {
    effects.push({
      type: 'dot',
      dpsRatio: template.dpsRatio,
      element: template.element,
      armorIgnorePercentByRealm: template.armorIgnorePercentByRealm,
    })
  }

  if (template.ccEffect) {
    effects.push({ type: 'cc', ccEffect: template.ccEffect })
  }

  if (template.statModifiers) {
    for (const modifier of template.statModifiers) {
      effects.push({ type: 'statModifier', stat: modifier.stat, percent: modifier.percent, flat: modifier.flat })
    }
  }

  if (template.onHitChance !== undefined && template.onHitAppliesAilmentId) {
    effects.push({ type: 'onHitProc', chance: template.onHitChance, appliesBuffId: template.onHitAppliesAilmentId })
  }

  return {
    id: template.id,
    name: template.name,
    polarity: 'debuff',
    duration: template.duration,
    maxStacks: template.maxStacks,
    stackMode: template.stackMode,
    convertsToId: template.convertsToOnMaxStacks,
    convertsAfterContinuousSeconds: template.convertsAfterContinuousSeconds,
    effects,
  }
}

function getBuffDefinition(id: string): BuffDefinition {
  const template = ailments.find(ailment => ailment.id === id)

  if (!template) {
    throw new Error(`data/ailment/ailments.ts thiếu '${id}'`)
  }

  return toBuffDefinition(template)
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
// × (1 + reactionEffectPercent). Element lấy từ buff/debuff vừa áp
// (newBuffId) — snapshot element trên instance vừa áp.
describe('ReactionManager — power scaling (Task 3)', () => {
  it('reaction có powerScalingRatio — damage cộng thêm sourcePower × ratio', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })

    // te_cong (Tê Cóng, element water) là buff/debuff vừa áp — nguồn Power
    // đọc từ waterPower. createBaseStats attack nền = 10.
    source.stats.waterPower = 200

    const target = createCombatant({ id: 'target', currentHp: 100000, maxHp: 100000 })

    const targetBuffs = new BuffSystem(new BuffPool())

    // bong (element fire) áp trước; te_cong áp sau → cặp "Bốc Hơi"
    // (baseDamage 60, powerScalingRatio 0.5 — data mới của Task 3).
    targetBuffs.apply(getBuffDefinition('bong'), source, target)
    targetBuffs.apply(getBuffDefinition('te_cong'), source, target)

    reactionManager.checkAndTrigger(targetBuffs, 'te_cong', source, target, combatSystem)

    const expectedPowerPart = (source.stats.attack + source.stats.waterPower) * 0.5

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

    const targetBuffs = new BuffSystem(new BuffPool())

    targetBuffs.apply(getBuffDefinition('bong'), source, target)
    targetBuffs.apply(getBuffDefinition('te_cong'), source, target)

    reactionManager.checkAndTrigger(targetBuffs, 'te_cong', source, target, combatSystem)

    expect(target.currentHp).toBe(1000 - 60)
  })

  it('reactionEffectPercent khuếch đại CẢ phần power', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })

    source.stats.reactionEffectPercent = 0.5
    // te_cong (element water) — buff/debuff vừa áp cho test.
    source.stats.waterPower = 200

    const target = createCombatant({ id: 'target', currentHp: 100000, maxHp: 100000 })

    const targetBuffs = new BuffSystem(new BuffPool())

    targetBuffs.apply(getBuffDefinition('bong'), source, target)
    targetBuffs.apply(getBuffDefinition('te_cong'), source, target)

    reactionManager.checkAndTrigger(targetBuffs, 'te_cong', source, target, combatSystem)

    const expectedPowerPart = (source.stats.attack + source.stats.waterPower) * 0.5

    expect(target.currentHp).toBeCloseTo(100000 - (60 + expectedPowerPart) * 1.5, 5)
  })
})
