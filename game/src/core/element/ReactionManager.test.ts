import { describe, expect, it } from 'vitest'
import { ReactionManager } from './ReactionManager'
import { AilmentSystem } from '../ailment/AilmentSystem'
import { AilmentManager } from '../ailment/AilmentManager'
import { AilmentRegistry } from '../ailment/AilmentRegistry'
import { BuffSystem } from '../buff/BuffSystem'
import { BuffManager } from '../buff/BuffManager'
import { BuffRegistry } from '../buff/BuffRegistry'
import { CombatSystem } from '../combat/CombatSystem'
import { EventBus } from '../events/EventBus'
import { createBaseStats } from '../stats/StatBlock'
import { ailments } from '../../data/ailment/ailments'
import { buffs } from '../../data/buff/buffs'
import type { CombatEntity } from '../combat/CombatEntity'
import type { AilmentTemplate } from '../ailment/AilmentRegistry'

function getTemplate(id: string): AilmentTemplate {
  const template = ailments.find(ailment => ailment.id === id)

  if (!template) {
    throw new Error(`data/ailment/ailments.ts thiếu '${id}' — kiểm tra lại id`)
  }

  return template
}

function createAilmentRegistry(): AilmentRegistry {
  const registry = new AilmentRegistry()

  for (const template of ailments) {
    registry.register(template)
  }

  return registry
}

function createBuffRegistry(): BuffRegistry {
  const registry = new BuffRegistry()

  for (const buff of buffs) {
    registry.register(buff)
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
    currentRage: 0,
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    lane: 'ground',
    alive: true,
    ...overrides,
  }
}

describe('ReactionManager (Combat Rework Phase 6 — Pháp Tu Reaction)', () => {
  it('2 ailment hành khác nhau khớp bảng phản ứng — gây damage MỘT LẦN rồi tiêu cả 2 ailment', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    // Bỏng (Hỏa) áp trước, tồn tại sẵn trên target.
    ailmentSystem.apply(getTemplate('bong'), source, target)

    const reactionEvents: unknown[] = []
    eventBus.on('reaction', event => reactionEvents.push(event))

    // Tê Cóng (Thủy) áp SAU — 2 hành khác nhau cùng có mặt, đúng cặp
    // ELEMENT_REACTIONS['bong']['te_cong'] ("Bốc Hơi", 60 dmg).
    ailmentSystem.apply(getTemplate('te_cong'), source, target)

    reactionManager.checkAndTrigger(ailmentSystem, 'te_cong', source, target, combatSystem)

    expect(target.currentHp).toBe(1000 - 60)
    expect(ailmentSystem.getActiveIds()).toEqual([])
    expect(reactionEvents).toHaveLength(1)
  })

  it('tra bảng phản ứng theo CẢ 2 CHIỀU dù data chỉ khai 1 chiều', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    // Đảo thứ tự so với test trên — te_cong áp TRƯỚC, bong áp SAU.
    // ELEMENT_REACTIONS chỉ khai bong -> te_cong (1 chiều), phải tự
    // suy ra chiều ngược lại.
    ailmentSystem.apply(getTemplate('te_cong'), source, target)
    ailmentSystem.apply(getTemplate('bong'), source, target)

    reactionManager.checkAndTrigger(ailmentSystem, 'bong', source, target, combatSystem)

    expect(target.currentHp).toBe(1000 - 60)
    expect(ailmentSystem.getActiveIds()).toEqual([])
  })

  it('không có ailment nào khớp bảng — không trigger, không đụng HP/ailment', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    // Trúng Độc (Mộc) — chưa có cặp nào khai trong ELEMENT_REACTIONS.
    ailmentSystem.apply(getTemplate('trung_doc'), source, target)

    reactionManager.checkAndTrigger(ailmentSystem, 'trung_doc', source, target, combatSystem)

    expect(target.currentHp).toBe(1000)
    expect(ailmentSystem.getActiveIds()).toEqual(['trung_doc'])
  })

  it('cùng 1 ailment refresh lại chính nó KHÔNG tự trigger phản ứng với chính mình', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('bong'), source, target)
    ailmentSystem.apply(getTemplate('bong'), source, target)

    reactionManager.checkAndTrigger(ailmentSystem, 'bong', source, target, combatSystem)

    expect(target.currentHp).toBe(1000)
    expect(ailmentSystem.getActiveIds()).toEqual(['bong'])
  })

  // Hỏa Tu Trúc Cơ ("Cộng Minh" minor, Plans/FirePath mục 8, 2026-08-21)
  it('reactionEffectPercent khuếch đại đúng reaction.baseDamage', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })

    source.stats.reactionEffectPercent = 0.5

    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('bong'), source, target)
    ailmentSystem.apply(getTemplate('te_cong'), source, target)

    reactionManager.checkAndTrigger(ailmentSystem, 'te_cong', source, target, combatSystem)

    // baseDamage 60 × (1 + 0.5) = 90.
    expect(target.currentHp).toBe(1000 - 90)
  })

  // Plans/waterpath (2026-08-21) — chốt bảng reaction mới của Thủy.
  it('Thủy (Tê Cóng) + Mộc (Trúng Độc) khớp cặp mới "Độc Thủy"', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('te_cong'), source, target)
    ailmentSystem.apply(getTemplate('trung_doc'), source, target)

    reactionManager.checkAndTrigger(ailmentSystem, 'trung_doc', source, target, combatSystem)

    expect(target.currentHp).toBe(1000 - 65)
    expect(ailmentSystem.getActiveIds()).toEqual([])
  })

  it('Thủy (Tê Cóng) + Kim (Tê Điện) KHÔNG còn phản ứng ("Đông Lôi" đã gỡ khỏi spec Thủy mới)', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('te_cong'), source, target)
    ailmentSystem.apply(getTemplate('te_dien'), source, target)

    reactionManager.checkAndTrigger(ailmentSystem, 'te_dien', source, target, combatSystem)

    expect(target.currentHp).toBe(1000)
    expect(ailmentSystem.getActiveIds().sort()).toEqual(['te_cong', 'te_dien'])
  })

  // Thủy Tu Trúc Cơ Reaction ("Dẫn Lưu" major, Plans/waterpath mục VII)
  it('waterReactionExtensionSeconds — GIỮ LẠI Tê Cóng (gia hạn) thay vì xoá, chỉ xoá vế còn lại', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })

    source.stats.waterReactionExtensionSeconds = 1

    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('bong'), source, target)
    ailmentSystem.apply(getTemplate('te_cong'), source, target)

    const remainingBefore = ailmentSystem.getActiveIds().includes('te_cong')

    expect(remainingBefore).toBe(true)

    reactionManager.checkAndTrigger(ailmentSystem, 'te_cong', source, target, combatSystem)

    expect(target.currentHp).toBe(1000 - 60)
    // 'bong' bị tiêu như thường, 'te_cong' được GIỮ LẠI (không có trong
    // danh sách xoá) — vẫn active sau Reaction.
    expect(ailmentSystem.getActiveIds()).toEqual(['te_cong'])
  })

  // Plans/PoisonPath mục 3 (2026-08-21) — "Độc Viêm" (Mộc+Hỏa), damage
  // dựa trên % currentHp của target thay vì flat.
  it('Mộc (Trúng Độc) + Hỏa (Bỏng) khớp cặp "Độc Viêm" — damage tính theo % currentHp của target', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 2000, maxHp: 2000 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('bong'), source, target)
    ailmentSystem.apply(getTemplate('trung_doc'), source, target)

    reactionManager.checkAndTrigger(ailmentSystem, 'trung_doc', source, target, combatSystem)

    // percentOfTargetCurrentHp 0.1 × 2000 = 200 (baseDamage 0).
    expect(target.currentHp).toBe(2000 - 200)
    expect(ailmentSystem.getActiveIds()).toEqual([])
  })

  // Plans/EarthPath mục V/VI/VII (2026-08-21) — Thổ (thach_hoa) là hành
  // ĐẦU TIÊN có Reaction sinh ra ailment/buff MỚI thay vì chỉ true
  // damage + xoá — cần ailmentRegistry/sourceBuffs/buffRegistry thật.
  it('Thổ (Thạch Hóa) + Hỏa (Bỏng) khớp cặp "Dung Nham" — sinh ailment DoT mới trên target, không phải true damage', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('thach_hoa'), source, target)
    ailmentSystem.apply(getTemplate('bong'), source, target)

    reactionManager.checkAndTrigger(ailmentSystem, 'bong', source, target, combatSystem, createAilmentRegistry())

    // baseDamage 0 — HP không đổi ngay lập tức, damage đến từ DoT mới.
    expect(target.currentHp).toBe(1000)
    expect(ailmentSystem.getActiveIds()).toEqual(['dung_nham'])
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

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('thach_hoa'), source, target)
    ailmentSystem.apply(getTemplate('bong'), source, target)

    const spawnedZones: { ownerId: string; x: number }[] = []

    reactionManager.checkAndTrigger(
      ailmentSystem,
      'bong',
      source,
      target,
      combatSystem,
      createAilmentRegistry(),
      undefined,
      undefined,
      spec => spawnedZones.push(spec),
    )

    expect(spawnedZones).toHaveLength(1)
    expect(spawnedZones[0]).toMatchObject({ ownerId: 'source', x: 42 })
  })

  it('không truyền spawnLavaZone — "Dung Nham" vẫn hoạt động bình thường (ailment + không crash)', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('thach_hoa'), source, target)
    ailmentSystem.apply(getTemplate('bong'), source, target)

    expect(() =>
      reactionManager.checkAndTrigger(ailmentSystem, 'bong', source, target, combatSystem, createAilmentRegistry()),
    ).not.toThrow()

    expect(ailmentSystem.getActiveIds()).toEqual(['dung_nham'])
  })

  it('Thổ (Thạch Hóa) + Thủy (Tê Cóng) khớp cặp "Trói Chân" — sinh CC root, reactionEffectPercent kéo dài duration', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })

    source.stats.reactionEffectPercent = 0.5

    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('thach_hoa'), source, target)
    ailmentSystem.apply(getTemplate('te_cong'), source, target)

    reactionManager.checkAndTrigger(ailmentSystem, 'te_cong', source, target, combatSystem, createAilmentRegistry())

    expect(ailmentSystem.getActiveIds()).toEqual(['troi_chan'])
    expect(ailmentSystem.isRooted()).toBe(true)

    // troi_chan baseline duration 2.5s × (1 + 0.5) = 3.75s — extendRemaining
    // cộng thêm phần dư (0.5 × 2.5 = 1.25s) lên TRÊN remainingTime gốc.
    const remainingBeforeTick = 2.5 + 0.5 * 2.5

    ailmentSystem.update(remainingBeforeTick - 0.1, target, combatSystem)
    expect(ailmentSystem.getActiveIds()).toEqual(['troi_chan'])

    ailmentSystem.update(0.2, target, combatSystem)
    expect(ailmentSystem.getActiveIds()).toEqual([])
  })

  it('Thổ (Thạch Hóa) + Mộc (Trúng Độc) khớp cặp "Độc Thế" — KHÔNG áp ailment lên target, cấp buff self-stack lên SOURCE', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('thach_hoa'), source, target)
    ailmentSystem.apply(getTemplate('trung_doc'), source, target)

    const sourceBuffs = new BuffSystem(new BuffManager())

    reactionManager.checkAndTrigger(
      ailmentSystem,
      'trung_doc',
      source,
      target,
      combatSystem,
      createAilmentRegistry(),
      sourceBuffs,
      createBuffRegistry(),
    )

    // target KHÔNG nhận ailment mới nào cả — cả 2 ailment gốc bị tiêu sạch.
    expect(ailmentSystem.getActiveIds()).toEqual([])

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

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('chay_mau'), source, target)
    ailmentSystem.apply(getTemplate('bong'), source, target)

    reactionManager.checkAndTrigger(ailmentSystem, 'bong', source, target, combatSystem)

    // baseDamage 85 trừ currentHp TRƯỚC (từ maxHp gốc 1000), rồi maxHp
    // mới bị thu nhỏ 3% RIÊNG (970) — currentHp (915) < maxHp mới nên
    // không bị clamp thêm.
    expect(target.currentHp).toBe(1000 - 85)
    expect(target.maxHp).toBe(970)
    expect(target.totalMaxHpReductionPercent).toBeCloseTo(0.03, 5)
  })

  it('"Thiêu Huyết" nhiều lần liên tiếp — % maxHp reduction bị CHẶN ở trần cộng dồn', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000000, maxHp: 1000000, totalMaxHpReductionPercent: 0.29 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('chay_mau'), source, target)
    ailmentSystem.apply(getTemplate('bong'), source, target)

    reactionManager.checkAndTrigger(ailmentSystem, 'bong', source, target, combatSystem)

    // Đã 29%, reaction muốn +3% nhưng trần 30% — chỉ được thêm 1% NỮA
    // (tính trên maxHp HIỆN TẠI 1,000,000, không phải maxHp gốc trước
    // mọi lần giảm).
    expect(target.totalMaxHpReductionPercent).toBeCloseTo(0.3, 5)
    expect(target.maxHp).toBeCloseTo(1000000 * 0.99, 0)
  })

  it('Kim (Chảy Máu) + Mộc (Trúng Độc) khớp cặp "Huyết Độc" — sinh ailment DoT hợp nhất mới trên target', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('chay_mau'), source, target)
    ailmentSystem.apply(getTemplate('trung_doc'), source, target)

    reactionManager.checkAndTrigger(ailmentSystem, 'trung_doc', source, target, combatSystem, createAilmentRegistry())

    expect(ailmentSystem.getActiveIds()).toEqual(['huyet_doc'])
  })

  it('waterReactionExtensionSeconds=0 (chưa mua Dẫn Lưu) — hành vi mặc định, xoá cả 2', () => {
    const eventBus = new EventBus()
    const reactionManager = new ReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('bong'), source, target)
    ailmentSystem.apply(getTemplate('te_cong'), source, target)

    reactionManager.checkAndTrigger(ailmentSystem, 'te_cong', source, target, combatSystem)

    expect(ailmentSystem.getActiveIds()).toEqual([])
  })
})
