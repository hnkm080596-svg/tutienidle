import { describe, expect, it } from 'vitest'
import { CombatSystem } from './CombatSystem'
import { BuffSystem } from '../buff/BuffSystem'
import { BuffPool } from '../buff/BuffPool'
import { EventBus } from '../events/EventBus'
import { createBaseStats } from '../stats/StatBlock'
import { createSkillRuntimeStats } from '../skill/SkillRuntimeStats'
import { buffs } from '../../data/buff/buffs'
import type { CombatEntity } from './CombatEntity'
import type { BuffDefinition } from '../buff/BuffDefinition'

// Plans/magicpathgeneral Phase 9-11 (2026-08-21) — DOT RES + DoT
// source resolution + Poison Recovery, xem CombatSystem.
// applyDotDamage()/BuffSystem.update().

function getTemplate(id: string): BuffDefinition {
  const template = buffs.find(buff => buff.id === id)

  if (!template) {
    throw new Error(`data/buff/buffs.ts thiếu '${id}'`)
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

describe('CombatSystem.applyDotDamage (Plans/magicpathgeneral Phase 9-11)', () => {
  it('dotResistancePercent giảm thẳng damage của tick DoT', () => {
    const eventBus = new EventBus()
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })

    source.stats.firePower = 10

    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    target.stats.dotResistancePercent = 0.3

    const ailmentSystem = new BuffSystem(new BuffPool())

    ailmentSystem.apply(getTemplate('bong'), source, target)
    // bong: dpsRatio 0.3; nguồn Skill Power = ATK + FirePower
    // (plan §3.2) = 10 + 10 = 20 ->
    // damagePerSecond = 20*0.3 = 6.

    ailmentSystem.update(1, target, combatSystem)

    // 6 raw damage × (1 - 0.3) = 4.2.
    expect(target.currentHp).toBeCloseTo(1000 - 4.2, 5)
  })

  it('emit event damage với effectId đúng, sourceId đúng nguồn gây DoT', () => {
    const eventBus = new EventBus()
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })

    source.stats.firePower = 10

    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const ailmentSystem = new BuffSystem(new BuffPool())

    ailmentSystem.apply(getTemplate('bong'), source, target)

    const damageEvents: { sourceId?: string; targetId?: string; effectId?: string }[] = []
    eventBus.on('damage', event => damageEvents.push(event as typeof damageEvents[number]))

    ailmentSystem.update(1, target, combatSystem)

    expect(damageEvents).toHaveLength(1)
    expect(damageEvents[0]).toMatchObject({ sourceId: 'source', targetId: 'target', effectId: 'bong' })
  })

  it('poisonRecoveryPercent hồi máu NGUỒN theo % damage DoT element wood đã trừ — CHỈ wood, không phải fire', () => {
    const eventBus = new EventBus()
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player', currentHp: 500, maxHp: 1000 })

    source.stats.poisonRecoveryPercent = 0.5
    source.stats.woodPower = 10
    source.stats.firePower = 10

    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const ailmentSystem = new BuffSystem(new BuffPool())

    const resolveSource = (id: string) => (id === source.id ? source : undefined)

    // Trúng Độc (wood) — phải hồi máu nguồn.
    ailmentSystem.apply(getTemplate('trung_doc'), source, target)
    ailmentSystem.update(1, target, combatSystem, undefined, resolveSource)

    expect(source.currentHp).toBeGreaterThan(500)

    const hpAfterWood = source.currentHp

    // Bỏng (fire) — KHÔNG được hồi máu nguồn dù cùng nguồn/cùng stat.
    const ailmentSystem2 = new BuffSystem(new BuffPool())
    ailmentSystem2.apply(getTemplate('bong'), source, target)
    ailmentSystem2.update(1, target, combatSystem, undefined, resolveSource)

    expect(source.currentHp).toBe(hpAfterWood)
  })

  it('kimTheDotResistancePenetrationPercentPerStack chỉ xuyên kháng DoT element metal, không ảnh hưởng DoT khác', () => {
    const eventBus = new EventBus()
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })

    source.currentKimThe = 5
    source.skillStats = { ...createSkillRuntimeStats(), kimTheDotResistancePenetrationPercentPerStack: 0.1 }
    source.stats.metalPower = 10
    source.stats.woodPower = 10

    const target = createCombatant({ id: 'target', currentHp: 1000000, maxHp: 1000000 })

    target.stats.dotResistancePercent = 0.5

    const resolveSource = (id: string) => (id === source.id ? source : undefined)

    // Chảy Máu (metal) — 5 tầng × 10% penetration = 50% xuyên, mitigation
    // hiệu quả về 0 -> full raw damage áp dụng.
    const metalAilments = new BuffSystem(new BuffPool())
    metalAilments.apply(getTemplate('chay_mau'), source, target)
    const before1 = target.currentHp
    metalAilments.update(1, target, combatSystem, undefined, resolveSource)
    const metalDamage = before1 - target.currentHp

    // Trúng Độc (wood) — cùng nguồn/currentKimThe nhưng KHÔNG phải metal,
    // penetration không áp dụng -> vẫn bị mitigation đầy đủ 50%.
    const woodAilments = new BuffSystem(new BuffPool())
    woodAilments.apply(getTemplate('trung_doc'), source, target)
    const before2 = target.currentHp
    woodAilments.update(1, target, combatSystem, undefined, resolveSource)
    const woodDamage = before2 - target.currentHp

    const woodRawDamage = woodDamage / (1 - 0.5)
    const metalRawDamage = metalDamage / (1 - 0)

    // Damage metal KHÔNG bị mitigation (xuyên hết), damage wood vẫn bị
    // trừ đúng 50% dotResistancePercent — 2 tỉ lệ mitigation khác hẳn
    // nhau dù cùng 1 nguồn/cùng currentKimThe.
    expect(metalDamage).toBeCloseTo(metalRawDamage, 5)
    expect(woodDamage).toBeCloseTo(woodRawDamage * 0.5, 5)
  })
})
