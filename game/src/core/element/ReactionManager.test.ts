import { describe, expect, it } from 'vitest'
import { ReactionManager } from './ReactionManager'
import { BuffSystem } from '../buff/BuffSystem'
import { BuffPool } from '../buff/BuffPool'
import { BuffRegistry } from '../buff/BuffRegistry'
import { CombatSystem } from '../combat/CombatSystem'
import { EventBus } from '../events/EventBus'
import { createBaseStats } from '../stats/StatBlock'
import { createSkillRuntimeStats } from '../skill/SkillRuntimeStats'
import { buffs } from '../../data/buff/buffs'
import type { CombatEntity } from '../combat/CombatEntity'
import type { BuffDefinition } from '../buff/BuffDefinition'

// Unified Buff System (Task 16-prep, 2026-09-01) — data/buff/buffs.ts
// giờ đã có sẵn shape BuffDefinition port từ AilmentTemplate (Task 7),
// nên test lookup thẳng từ đó thay vì tự convert AilmentTemplate cục
// bộ như trước (xem task-16-report.md/task-16prep-brief.md).
function getBuffDefinition(id: string): BuffDefinition {
  const definition = buffs.find(buff => buff.id === id)

  if (!definition) {
    throw new Error(`data/buff/buffs.ts thiếu '${id}' — kiểm tra lại id`)
  }

  return definition
}

// "doc_the" ("Độc Căn") — Reaction Reward Buff cấp cho SOURCE (không
// phải target) — xem ElementReaction.ts's `appliesBuffId: 'doc_the'`.
// Đã có sẵn trong data/buff/buffs.ts (Task 7 port), nên registry chỉ
// cần đăng ký cả mảng `buffs` — không cần định nghĩa local riêng nữa.
function createBuffRegistry(): BuffRegistry {
  const registry = new BuffRegistry()

  for (const definition of buffs) {
    registry.register(definition)
  }

  return registry
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

describe('ReactionManager (Combat Rework Phase 6 — Pháp Tu Reaction)', () => {
  it('2 buff/debuff hành khác nhau khớp bảng phản ứng — gây damage MỘT LẦN rồi tiêu cả 2', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffs = new BuffSystem(new BuffPool())

    // Bỏng (Hỏa) áp trước, tồn tại sẵn trên target.
    targetBuffs.apply(getBuffDefinition('bong'), source, target)

    const reactionEvents: unknown[] = []
    eventBus.on('reaction', event => reactionEvents.push(event))

    // Tê Cóng (Thủy) áp SAU — 2 hành khác nhau cùng có mặt, đúng cặp
    // ELEMENT_REACTIONS['bong']['te_cong'] ("Bốc Hơi", 60 dmg).
    targetBuffs.apply(getBuffDefinition('te_cong'), source, target)

    reactionManager.checkAndTrigger(targetBuffs, 'te_cong', source, target, combatSystem)

    expect(target.currentHp).toBe(1000 - 70)
    expect(targetBuffs.getActiveIds()).toEqual([])
    expect(reactionEvents).toHaveLength(1)
  })

  it('tra bảng phản ứng theo CẢ 2 CHIỀU dù data chỉ khai 1 chiều', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffs = new BuffSystem(new BuffPool())

    // Đảo thứ tự so với test trên — te_cong áp TRƯỚC, bong áp SAU.
    // ELEMENT_REACTIONS chỉ khai bong -> te_cong (1 chiều), phải tự
    // suy ra chiều ngược lại.
    targetBuffs.apply(getBuffDefinition('te_cong'), source, target)
    targetBuffs.apply(getBuffDefinition('bong'), source, target)

    reactionManager.checkAndTrigger(targetBuffs, 'bong', source, target, combatSystem)

    // Combat Balance Pass (2026-08-29) — powerScalingRatio 1.0 (T5.4): 60 + 10.
    expect(target.currentHp).toBe(1000 - 70)
    expect(targetBuffs.getActiveIds()).toEqual([])
  })

  it('không có buff/debuff nào khớp bảng — không trigger, không đụng HP/buff', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffs = new BuffSystem(new BuffPool())

    // Trúng Độc (Mộc) — chưa có cặp nào khai trong ELEMENT_REACTIONS.
    targetBuffs.apply(getBuffDefinition('trung_doc'), source, target)

    reactionManager.checkAndTrigger(targetBuffs, 'trung_doc', source, target, combatSystem)

    expect(target.currentHp).toBe(1000)
    expect(targetBuffs.getActiveIds()).toEqual(['trung_doc'])
  })

  it('cùng 1 buff refresh lại chính nó KHÔNG tự trigger phản ứng với chính mình', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffs = new BuffSystem(new BuffPool())

    targetBuffs.apply(getBuffDefinition('bong'), source, target)
    targetBuffs.apply(getBuffDefinition('bong'), source, target)

    reactionManager.checkAndTrigger(targetBuffs, 'bong', source, target, combatSystem)

    expect(target.currentHp).toBe(1000)
    expect(targetBuffs.getActiveIds()).toEqual(['bong'])
  })

  // Hỏa Tu Trúc Cơ ("Cộng Minh" minor, Plans/FirePath mục 8, 2026-08-21)
  it('reactionEffectPercent khuếch đại đúng reaction.baseDamage', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })

    source.stats.reactionEffectPercent = 0.5

    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffs = new BuffSystem(new BuffPool())

    targetBuffs.apply(getBuffDefinition('bong'), source, target)
    targetBuffs.apply(getBuffDefinition('te_cong'), source, target)

    reactionManager.checkAndTrigger(targetBuffs, 'te_cong', source, target, combatSystem)

    // Combat Balance Pass (2026-08-29) — baseDamage 60 + power
    // (attack 10 × 0.5 = 5) = 65, rồi × (1 + 0.5) = 97.5.
    expect(target.currentHp).toBe(1000 - 105)
  })

  // Plans/waterpath (2026-08-21) — chốt bảng reaction mới của Thủy.
  it('Thủy (Tê Cóng) + Mộc (Trúng Độc) khớp cặp mới "Độc Thủy"', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffs = new BuffSystem(new BuffPool())

    targetBuffs.apply(getBuffDefinition('te_cong'), source, target)
    targetBuffs.apply(getBuffDefinition('trung_doc'), source, target)

    reactionManager.checkAndTrigger(targetBuffs, 'trung_doc', source, target, combatSystem)

    // Combat Balance Pass (2026-08-29) — powerScalingRatio 1.0 (T5.4): 65 + 10.
    expect(target.currentHp).toBe(1000 - 75)
    expect(targetBuffs.getActiveIds()).toEqual([])
  })

  // Test "Thủy + Kim (Tê Điện) không phản ứng" đã XOÁ cùng te_dien
  // (spec 2026-08-30-phap-tu-dao-sac §5) — ailment mồ côi, không còn
  // cặp nào để assert.

  // Thủy Tu Trúc Cơ Reaction ("Dẫn Lưu" major, Plans/waterpath mục VII)
  it('waterReactionExtensionSeconds — GIỮ LẠI Tê Cóng (gia hạn) thay vì xoá, chỉ xoá vế còn lại', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })

    source.skillStats = { ...createSkillRuntimeStats(), waterReactionExtensionSeconds: 1 }

    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffs = new BuffSystem(new BuffPool())

    targetBuffs.apply(getBuffDefinition('bong'), source, target)
    targetBuffs.apply(getBuffDefinition('te_cong'), source, target)

    const remainingBefore = targetBuffs.getActiveIds().includes('te_cong')

    expect(remainingBefore).toBe(true)

    reactionManager.checkAndTrigger(targetBuffs, 'te_cong', source, target, combatSystem)

    // Combat Balance Pass (2026-08-29) — powerScalingRatio 1.0 (T5.4): 60 + 10.
    expect(target.currentHp).toBe(1000 - 70)
    // 'bong' bị tiêu như thường, 'te_cong' được GIỮ LẠI (không có trong
    // danh sách xoá) — vẫn active sau Reaction.
    expect(targetBuffs.getActiveIds()).toEqual(['te_cong'])
  })

  // Plans/PoisonPath mục 3 (2026-08-21) — "Độc Viêm" (Mộc+Hỏa), damage
  // dựa trên % currentHp của target thay vì flat.
  it('Mộc (Trúng Độc) + Hỏa (Bỏng) khớp cặp "Độc Viêm" — damage tính theo % currentHp của target', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 2000, maxHp: 2000 })

    const targetBuffs = new BuffSystem(new BuffPool())

    targetBuffs.apply(getBuffDefinition('bong'), source, target)
    targetBuffs.apply(getBuffDefinition('trung_doc'), source, target)

    reactionManager.checkAndTrigger(targetBuffs, 'trung_doc', source, target, combatSystem)

    // percentOfTargetCurrentHp 0.1 × 2000 = 200 (baseDamage 0).
    expect(target.currentHp).toBe(2000 - 200)
    expect(targetBuffs.getActiveIds()).toEqual([])
  })

  // Plans/EarthPath mục V/VI/VII (2026-08-21) — Thổ (thach_hoa) là hành
  // ĐẦU TIÊN có Reaction sinh ra buff/debuff MỚI thay vì chỉ true
  // damage + xoá — cần buffRegistry/sourceBuffs thật.
  it('Thổ (Thạch Hóa) + Hỏa (Bỏng) khớp cặp "Dung Nham" — sinh debuff DoT mới trên target, không phải true damage', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffs = new BuffSystem(new BuffPool())

    targetBuffs.apply(getBuffDefinition('thach_hoa'), source, target)
    targetBuffs.apply(getBuffDefinition('bong'), source, target)

    reactionManager.checkAndTrigger(targetBuffs, 'bong', source, target, combatSystem, createBuffRegistry())

    // baseDamage 0 — HP không đổi ngay lập tức, damage đến từ DoT mới.
    expect(target.currentHp).toBe(1000)
    expect(targetBuffs.getActiveIds()).toEqual(['dung_nham'])
  })

  // Plans/magicpathgeneral Phase 12 (2026-08-21) — Dung Nham CŨNG spawn
  // 1 Lava Zone tại vị trí target, NGOÀI ailment 'dung_nham' đã test ở
  // trên.
  it('Thổ (Thạch Hóa) + Hỏa (Bỏng) "Dung Nham" — CŨNG gọi spawnLavaZone tại vị trí target', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000, x: 42 })

    const targetBuffs = new BuffSystem(new BuffPool())

    targetBuffs.apply(getBuffDefinition('thach_hoa'), source, target)
    targetBuffs.apply(getBuffDefinition('bong'), source, target)

    const spawnedZones: { ownerId: string; row: number; column: number; laneRadius: number; columnRadius: number }[] = []

    reactionManager.checkAndTrigger(
      targetBuffs,
      'bong',
      source,
      target,
      combatSystem,
      createBuffRegistry(),
      undefined,
      spec => spawnedZones.push(spec),
    )

    expect(spawnedZones).toHaveLength(1)
    expect(spawnedZones[0]).toMatchObject({ ownerId: 'source', row: 2, column: 42 })
  })

  it('không truyền spawnLavaZone — "Dung Nham" vẫn hoạt động bình thường (buff/debuff + không crash)', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffs = new BuffSystem(new BuffPool())

    targetBuffs.apply(getBuffDefinition('thach_hoa'), source, target)
    targetBuffs.apply(getBuffDefinition('bong'), source, target)

    expect(() =>
      reactionManager.checkAndTrigger(targetBuffs, 'bong', source, target, combatSystem, createBuffRegistry()),
    ).not.toThrow()

    expect(targetBuffs.getActiveIds()).toEqual(['dung_nham'])
  })

  it('Thổ (Thạch Hóa) + Thủy (Tê Cóng) khớp cặp "Trói Chân" — sinh CC root, reactionEffectPercent kéo dài duration', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })

    source.stats.reactionEffectPercent = 0.5

    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffs = new BuffSystem(new BuffPool())

    targetBuffs.apply(getBuffDefinition('thach_hoa'), source, target)
    targetBuffs.apply(getBuffDefinition('te_cong'), source, target)

    reactionManager.checkAndTrigger(targetBuffs, 'te_cong', source, target, combatSystem, createBuffRegistry())

    expect(targetBuffs.getActiveIds()).toEqual(['troi_chan'])
    expect(targetBuffs.isRooted()).toBe(true)

    // troi_chan baseline duration 2.5s × (1 + 0.5) = 3.75s — extendRemaining
    // cộng thêm phần dư (0.5 × 2.5 = 1.25s) lên TRÊN remainingTime gốc.
    const remainingBeforeTick = 2.5 + 0.5 * 2.5

    targetBuffs.update(remainingBeforeTick - 0.1, target, combatSystem)
    expect(targetBuffs.getActiveIds()).toEqual(['troi_chan'])

    targetBuffs.update(0.2, target, combatSystem)
    expect(targetBuffs.getActiveIds()).toEqual([])
  })

  it('Thổ (Thạch Hóa) + Mộc (Trúng Độc) khớp cặp "Độc Thế" — KHÔNG áp buff/debuff lên target, cấp buff self-stack lên SOURCE', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffs = new BuffSystem(new BuffPool())

    targetBuffs.apply(getBuffDefinition('thach_hoa'), source, target)
    targetBuffs.apply(getBuffDefinition('trung_doc'), source, target)

    const sourceBuffs = new BuffSystem(new BuffPool())

    reactionManager.checkAndTrigger(
      targetBuffs,
      'trung_doc',
      source,
      target,
      combatSystem,
      createBuffRegistry(),
      sourceBuffs,
    )

    // target KHÔNG nhận buff/debuff mới nào cả — cả 2 vế gốc bị tiêu sạch.
    expect(targetBuffs.getActiveIds()).toEqual([])

    const modifiers = sourceBuffs.getActiveModifiers()

    // Plans/magicpathgeneral Phase 7/8/11 — buff 'doc_the' ("Độc Căn",
    // đổi tên từ "Độc Thế") giờ có 2 modifier: Sát Thương Độc (như cũ)
    // + Poison Recovery (mới, xem data/buff/buffs.ts).
    expect(modifiers).toHaveLength(2)
    expect(modifiers).toContainEqual(expect.objectContaining({ stat: 'ailmentPotencyPercent', percent: 0.05, stacks: 1 }))
    expect(modifiers).toContainEqual(expect.objectContaining({ stat: 'poisonRecoveryPercent', percent: 0.02, stacks: 1 }))
  })

  // Plans/KimPath mục 5/6 (2026-08-21) — 2 reaction Kim mới.
  it('Kim (Chảy Máu) + Hỏa (Bỏng) khớp cặp "Thiêu Huyết" — trừ currentHp thường + trừ VĨNH VIỄN % maxHp', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffs = new BuffSystem(new BuffPool())

    targetBuffs.apply(getBuffDefinition('chay_mau'), source, target)
    targetBuffs.apply(getBuffDefinition('bong'), source, target)

    reactionManager.checkAndTrigger(targetBuffs, 'bong', source, target, combatSystem)

    // Combat Balance Pass (2026-08-29) — powerScalingRatio 1.0 (T5.4): 85 + 10 = 95
    // trừ currentHp, rồi maxHp bị thu nhỏ 3% (970) — currentHp (910) <
    // maxHp mới nên không bị clamp thêm.
    expect(target.currentHp).toBe(1000 - 95)
    expect(target.maxHp).toBe(970)
    expect(target.totalMaxHpReductionPercent).toBeCloseTo(0.03, 5)
  })

  it('"Thiêu Huyết" nhiều lần liên tiếp — % maxHp reduction bị CHẶN ở trần cộng dồn', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000000, maxHp: 1000000, totalMaxHpReductionPercent: 0.29 })

    const targetBuffs = new BuffSystem(new BuffPool())

    targetBuffs.apply(getBuffDefinition('chay_mau'), source, target)
    targetBuffs.apply(getBuffDefinition('bong'), source, target)

    reactionManager.checkAndTrigger(targetBuffs, 'bong', source, target, combatSystem)

    // Đã 29%, reaction muốn +3% nhưng trần 30% — chỉ được thêm 1% NỮA
    // (tính trên maxHp HIỆN TẠI 1,000,000, không phải maxHp gốc trước
    // mọi lần giảm).
    expect(target.totalMaxHpReductionPercent).toBeCloseTo(0.3, 5)
    expect(target.maxHp).toBeCloseTo(1000000 * 0.99, 0)
  })

  it('Kim (Chảy Máu) + Mộc (Trúng Độc) khớp cặp "Huyết Độc" — sinh DoT hợp nhất mới trên target', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffs = new BuffSystem(new BuffPool())

    targetBuffs.apply(getBuffDefinition('chay_mau'), source, target)
    targetBuffs.apply(getBuffDefinition('trung_doc'), source, target)

    reactionManager.checkAndTrigger(targetBuffs, 'trung_doc', source, target, combatSystem, createBuffRegistry())

    expect(targetBuffs.getActiveIds()).toEqual(['huyet_doc'])
  })

  it('waterReactionExtensionSeconds=0 (chưa mua Dẫn Lưu) — hành vi mặc định, xoá cả 2', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffs = new BuffSystem(new BuffPool())

    targetBuffs.apply(getBuffDefinition('bong'), source, target)
    targetBuffs.apply(getBuffDefinition('te_cong'), source, target)

    reactionManager.checkAndTrigger(targetBuffs, 'te_cong', source, target, combatSystem)

    expect(targetBuffs.getActiveIds()).toEqual([])
  })
})
