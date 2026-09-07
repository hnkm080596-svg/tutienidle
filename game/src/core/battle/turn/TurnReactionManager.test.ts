import { describe, expect, it } from 'vitest'
import { TurnReactionManager } from './TurnReactionManager'
import { TurnBuffSystem } from './TurnBuffSystem'
import { TurnBuffPool } from './TurnBuffPool'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { createSkillRuntimeStats } from '../../skill/SkillRuntimeStats'
import { TURN_BUFF_REGISTRY } from '../../../data/buff/TurnBuffRegistry'
import type { CombatEntity } from '../../combat/CombatEntity'

// Phase A1 (2026-09-07) — turn-based port of ReactionManager.test.ts.
// Type substitution table per the implementation plan: BuffSystem ->
// TurnBuffSystem, BuffPool -> TurnBuffPool, BuffRegistry ->
// TURN_BUFF_REGISTRY (production registry already contains all 11
// reaction buffs), spawnLavaZone parameter deleted entirely (the
// turn-based engine has no zone system — zone-as-DoT-buff was decided
// instead; see roadmap mục 9.3).

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
  } as CombatEntity
}

describe('TurnReactionManager (Phase A1 port of ReactionManager)', () => {
  it('2 buff/debuff hành khác nhau khớp bảng phản ứng — gây damage MỘT LẦN rồi tiêu cả 2', () => {
    const eventBus = new EventBus()
    const reactionManager = new TurnReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffPool = new TurnBuffPool()
    const targetBuffs = new TurnBuffSystem(targetBuffPool)

    targetBuffs.apply(TURN_BUFF_REGISTRY.get('bong'), source, target)

    const reactionEvents: unknown[] = []
    eventBus.on('reaction', (event) => reactionEvents.push(event))

    targetBuffs.apply(TURN_BUFF_REGISTRY.get('te_cong'), source, target)

    reactionManager.checkAndTrigger(targetBuffPool, 'te_cong', source, target, combatSystem, TURN_BUFF_REGISTRY)

    expect(target.currentHp).toBe(1000 - 70)
    expect(targetBuffs.getActiveIds()).toEqual([])
    expect(reactionEvents).toHaveLength(1)
  })

  it('tra bảng phản ứng theo CẢ 2 CHIỀU dù data chỉ khai 1 chiều', () => {
    const eventBus = new EventBus()
    const reactionManager = new TurnReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffPool = new TurnBuffPool()
    const targetBuffs = new TurnBuffSystem(targetBuffPool)

    targetBuffs.apply(TURN_BUFF_REGISTRY.get('te_cong'), source, target)
    targetBuffs.apply(TURN_BUFF_REGISTRY.get('bong'), source, target)

    reactionManager.checkAndTrigger(targetBuffPool, 'bong', source, target, combatSystem, TURN_BUFF_REGISTRY)

    expect(target.currentHp).toBe(1000 - 70)
    expect(targetBuffs.getActiveIds()).toEqual([])
  })

  it('không có buff/debuff nào khớp bảng — không trigger, không đụng HP/buff', () => {
    const eventBus = new EventBus()
    const reactionManager = new TurnReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffPool = new TurnBuffPool()
    const targetBuffs = new TurnBuffSystem(targetBuffPool)

    targetBuffs.apply(TURN_BUFF_REGISTRY.get('trung_doc'), source, target)

    reactionManager.checkAndTrigger(targetBuffPool, 'trung_doc', source, target, combatSystem, TURN_BUFF_REGISTRY)

    expect(target.currentHp).toBe(1000)
    expect(targetBuffs.getActiveIds()).toEqual(['trung_doc'])
  })

  it('cùng 1 buff refresh lại chính nó KHÔNG tự trigger phản ứng với chính mình', () => {
    const eventBus = new EventBus()
    const reactionManager = new TurnReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffPool = new TurnBuffPool()
    const targetBuffs = new TurnBuffSystem(targetBuffPool)

    targetBuffs.apply(TURN_BUFF_REGISTRY.get('bong'), source, target)
    targetBuffs.apply(TURN_BUFF_REGISTRY.get('bong'), source, target)

    reactionManager.checkAndTrigger(targetBuffPool, 'bong', source, target, combatSystem, TURN_BUFF_REGISTRY)

    expect(target.currentHp).toBe(1000)
    expect(targetBuffs.getActiveIds()).toEqual(['bong'])
  })

  it('reactionEffectPercent khuếch đại đúng reaction.baseDamage', () => {
    const eventBus = new EventBus()
    const reactionManager = new TurnReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })

    source.stats.reactionEffectPercent = 0.5

    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffPool = new TurnBuffPool()
    const targetBuffs = new TurnBuffSystem(targetBuffPool)

    targetBuffs.apply(TURN_BUFF_REGISTRY.get('bong'), source, target)
    targetBuffs.apply(TURN_BUFF_REGISTRY.get('te_cong'), source, target)

    reactionManager.checkAndTrigger(targetBuffPool, 'te_cong', source, target, combatSystem, TURN_BUFF_REGISTRY)

    // Combat Balance Pass (2026-08-29) — baseDamage 60 + power
    // (attack 10 × 0.5 = 5) = 65, then × (1 + 0.5) = 97.5.
    expect(target.currentHp).toBe(1000 - 105)
  })

  it('Thủy (Tê Cóng) + Mộc (Trúng Độc) khớp cặp mới "Độc Thủy"', () => {
    const eventBus = new EventBus()
    const reactionManager = new TurnReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffPool = new TurnBuffPool()
    const targetBuffs = new TurnBuffSystem(targetBuffPool)

    targetBuffs.apply(TURN_BUFF_REGISTRY.get('te_cong'), source, target)
    targetBuffs.apply(TURN_BUFF_REGISTRY.get('trung_doc'), source, target)

    reactionManager.checkAndTrigger(targetBuffPool, 'trung_doc', source, target, combatSystem, TURN_BUFF_REGISTRY)

    expect(target.currentHp).toBe(1000 - 75)
    expect(targetBuffs.getActiveIds()).toEqual([])
  })

  it('waterReactionExtensionSeconds — GIỮ LẠI Tê Cóng (gia hạn) thay vì xoá, chỉ xoá vế còn lại', () => {
    const eventBus = new EventBus()
    const reactionManager = new TurnReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })

    source.skillStats = { ...createSkillRuntimeStats(), waterReactionExtensionSeconds: 1 }

    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffPool = new TurnBuffPool()
    const targetBuffs = new TurnBuffSystem(targetBuffPool)

    targetBuffs.apply(TURN_BUFF_REGISTRY.get('bong'), source, target)
    targetBuffs.apply(TURN_BUFF_REGISTRY.get('te_cong'), source, target)

    const remainingBefore = targetBuffs.getActiveIds().includes('te_cong')

    expect(remainingBefore).toBe(true)

    reactionManager.checkAndTrigger(targetBuffPool, 'te_cong', source, target, combatSystem, TURN_BUFF_REGISTRY)

    expect(target.currentHp).toBe(1000 - 70)
    // 'bong' is consumed as usual, 'te_cong' is KEPT (renewed, not removed).
    expect(targetBuffs.getActiveIds()).toEqual(['te_cong'])
  })

  it('Mộc (Trúng Độc) + Hỏa (Bỏng) khớp cặp "Độc Viêm" — damage tính theo % currentHp của target', () => {
    const eventBus = new EventBus()
    const reactionManager = new TurnReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 2000, maxHp: 2000 })

    const targetBuffPool = new TurnBuffPool()
    const targetBuffs = new TurnBuffSystem(targetBuffPool)

    targetBuffs.apply(TURN_BUFF_REGISTRY.get('bong'), source, target)
    targetBuffs.apply(TURN_BUFF_REGISTRY.get('trung_doc'), source, target)

    reactionManager.checkAndTrigger(targetBuffPool, 'trung_doc', source, target, combatSystem, TURN_BUFF_REGISTRY)

    // percentOfTargetCurrentHp 0.1 × 2000 = 200 (baseDamage 0).
    expect(target.currentHp).toBe(2000 - 200)
    expect(targetBuffs.getActiveIds()).toEqual([])
  })

  it('Thổ (Thạch Hóa) + Hỏa (Bỏng) khớp cặp "Dung Nham" — sinh debuff DoT mới trên target, không phải true damage', () => {
    const eventBus = new EventBus()
    const reactionManager = new TurnReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffPool = new TurnBuffPool()
    const targetBuffs = new TurnBuffSystem(targetBuffPool)

    targetBuffs.apply(TURN_BUFF_REGISTRY.get('thach_hoa'), source, target)
    targetBuffs.apply(TURN_BUFF_REGISTRY.get('bong'), source, target)

    reactionManager.checkAndTrigger(targetBuffPool, 'bong', source, target, combatSystem, TURN_BUFF_REGISTRY)

    // baseDamage 0 — HP unchanged immediately; the damage comes from the new DoT.
    expect(target.currentHp).toBe(1000)
    expect(targetBuffs.getActiveIds()).toEqual(['dung_nham'])
  })

  it('Thổ (Thạch Hóa) + Thủy (Tê Cóng) khớp cặp "Trói Chân" — sinh CC root, reactionEffectPercent kéo dài duration', () => {
    const eventBus = new EventBus()
    const reactionManager = new TurnReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })

    source.stats.reactionEffectPercent = 0.5

    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffPool = new TurnBuffPool()
    const targetBuffs = new TurnBuffSystem(targetBuffPool)

    targetBuffs.apply(TURN_BUFF_REGISTRY.get('thach_hoa'), source, target)
    targetBuffs.apply(TURN_BUFF_REGISTRY.get('te_cong'), source, target)

    reactionManager.checkAndTrigger(targetBuffPool, 'te_cong', source, target, combatSystem, TURN_BUFF_REGISTRY)

    expect(targetBuffs.getActiveIds()).toEqual(['troi_chan'])
    expect(targetBuffs.isRooted()).toBe(true)

    // Turn-based conversion (2026-09-04 policy: seconds -> turns, number
    // preserved): troi_chan duration 2.5 turns, extend adds 0.5 × 2.5
    // = 1.25 turns on top -> 3.75 remaining.
    const buff = targetBuffPool.getFromSource('troi_chan', 'source')
    expect(buff?.remainingTurns).toBeCloseTo(3.75, 5)
  })

  it('Thổ (Thạch Hóa) + Mộc (Trúng Độc) khớp cặp "Độc Thế" — KHÔNG áp buff/debuff lên target, cấp buff self-stack lên SOURCE', () => {
    const eventBus = new EventBus()
    const reactionManager = new TurnReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffPool = new TurnBuffPool()
    const targetBuffs = new TurnBuffSystem(targetBuffPool)

    targetBuffs.apply(TURN_BUFF_REGISTRY.get('thach_hoa'), source, target)
    targetBuffs.apply(TURN_BUFF_REGISTRY.get('trung_doc'), source, target)

    const sourceBuffPool = new TurnBuffPool()
    const sourceBuffs = new TurnBuffSystem(sourceBuffPool)

    reactionManager.checkAndTrigger(
      targetBuffPool,
      'trung_doc',
      source,
      target,
      combatSystem,
      TURN_BUFF_REGISTRY,
      sourceBuffPool,
    )

    expect(targetBuffs.getActiveIds()).toEqual([])

    const modifiers = sourceBuffs.getActiveModifiers()

    expect(modifiers).toHaveLength(2)
    expect(modifiers).toContainEqual(expect.objectContaining({ stat: 'ailmentPotencyPercent', percent: 0.05, stacks: 1 }))
    expect(modifiers).toContainEqual(expect.objectContaining({ stat: 'poisonRecoveryPercent', percent: 0.02, stacks: 1 }))
  })

  it('Kim (Chảy Máu) + Hỏa (Bỏng) khớp cặp "Thiêu Huyết" — trừ currentHp thường + trừ VĨNH VIỄN % maxHp', () => {
    const eventBus = new EventBus()
    const reactionManager = new TurnReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffPool = new TurnBuffPool()
    const targetBuffs = new TurnBuffSystem(targetBuffPool)

    targetBuffs.apply(TURN_BUFF_REGISTRY.get('chay_mau'), source, target)
    targetBuffs.apply(TURN_BUFF_REGISTRY.get('bong'), source, target)

    reactionManager.checkAndTrigger(targetBuffPool, 'bong', source, target, combatSystem, TURN_BUFF_REGISTRY)

    expect(target.currentHp).toBe(1000 - 95)
    expect(target.maxHp).toBe(970)
    expect(target.totalMaxHpReductionPercent).toBeCloseTo(0.03, 5)
  })

  it('"Thiêu Huyết" nhiều lần liên tiếp — % maxHp reduction bị CHẶN ở trần cộng dồn', () => {
    const eventBus = new EventBus()
    const reactionManager = new TurnReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000000, maxHp: 1000000, totalMaxHpReductionPercent: 0.29 })

    const targetBuffPool = new TurnBuffPool()
    const targetBuffs = new TurnBuffSystem(targetBuffPool)

    targetBuffs.apply(TURN_BUFF_REGISTRY.get('chay_mau'), source, target)
    targetBuffs.apply(TURN_BUFF_REGISTRY.get('bong'), source, target)

    reactionManager.checkAndTrigger(targetBuffPool, 'bong', source, target, combatSystem, TURN_BUFF_REGISTRY)

    expect(target.totalMaxHpReductionPercent).toBeCloseTo(0.3, 5)
    expect(target.maxHp).toBeCloseTo(1000000 * 0.99, 0)
  })

  it('Kim (Chảy Máu) + Mộc (Trúng Độc) khớp cặp "Huyết Độc" — sinh DoT hợp nhất mới trên target', () => {
    const eventBus = new EventBus()
    const reactionManager = new TurnReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffPool = new TurnBuffPool()
    const targetBuffs = new TurnBuffSystem(targetBuffPool)

    targetBuffs.apply(TURN_BUFF_REGISTRY.get('chay_mau'), source, target)
    targetBuffs.apply(TURN_BUFF_REGISTRY.get('trung_doc'), source, target)

    reactionManager.checkAndTrigger(targetBuffPool, 'trung_doc', source, target, combatSystem, TURN_BUFF_REGISTRY)

    expect(targetBuffs.getActiveIds()).toEqual(['huyet_doc'])
  })

  it('waterReactionExtensionSeconds=0 (chưa mua Dẫn Lưu) — hành vi mặc định, xoá cả 2', () => {
    const eventBus = new EventBus()
    const reactionManager = new TurnReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffPool = new TurnBuffPool()
    const targetBuffs = new TurnBuffSystem(targetBuffPool)

    targetBuffs.apply(TURN_BUFF_REGISTRY.get('bong'), source, target)
    targetBuffs.apply(TURN_BUFF_REGISTRY.get('te_cong'), source, target)

    reactionManager.checkAndTrigger(targetBuffPool, 'te_cong', source, target, combatSystem, TURN_BUFF_REGISTRY)

    expect(targetBuffs.getActiveIds()).toEqual([])
  })
})
