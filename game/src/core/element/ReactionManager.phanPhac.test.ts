import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReactionManager } from './ReactionManager'
import { BuffSystem } from '../buff/BuffSystem'
import { BuffPool } from '../buff/BuffPool'
import { BuffRegistry } from '../buff/BuffRegistry'
import { CombatSystem } from '../combat/CombatSystem'
import { EventBus } from '../events/EventBus'
import { createBaseStats } from '../stats/StatBlock'
import { buffs } from '../../data/buff/buffs'
import type { CombatEntity } from '../combat/CombatEntity'
import type { BuffDefinition } from '../buff/BuffDefinition'

// Thiên phú Phản Phác (talent-direction-choice-plan §6) — reaction_keep_chance
// chỉ tác động NHÁNH CONSUME CHUẨN của ReactionManager; nhánh đặc biệt
// (appliesAilmentId/appliesBuffId/keepsAilmentId) giữ nguyên hành vi.
// Cặp test (spec 2026-08-30-phap-tu-dao-sac §5 — te_dien/Lôi Viêm đã
// xoá, chuyển fixture sang cặp sống): bong + te_cong ("Bốc Hơi", 60
// dmg, nhánh chuẩn thuần). Source fixture KHÔNG có
// waterReactionExtensionSeconds nên keepsAilmentId không kích — reaction
// tiêu cả 2 như nhánh chuẩn, đúng phạm vi test keepChance.

// Unified Buff System (Task 16-prep, 2026-09-01) — data/buff/buffs.ts
// giờ đã có sẵn shape BuffDefinition port từ AilmentTemplate (Task 7),
// nên test lookup thẳng từ đó thay vì tự convert AilmentTemplate cục
// bộ như trước (xem task-16-report.md/task-16prep-brief.md).
function getBuffDefinition(id: string): BuffDefinition {
  const definition = buffs.find((buff) => buff.id === id)

  if (!definition) {
    throw new Error(`data/buff/buffs.ts thiếu '${id}' — kiểm tra lại id`)
  }

  return definition
}

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

function createSetup() {
  const eventBus = new EventBus()
  const reactionManager = new ReactionManager(eventBus)
  const combatSystem = new CombatSystem(eventBus)
  const source = createCombatant({ id: 'source', type: 'player' })
  const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })
  const targetBuffs = new BuffSystem(new BuffPool())

  return { reactionManager, combatSystem, source, target, targetBuffs }
}

describe('ReactionManager — Phản Phác (reaction_keep_chance)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keepChance 0 (mặc định) — reaction tiêu cả 2 buff/debuff như cũ', () => {
    const { reactionManager, combatSystem, source, target, targetBuffs } = createSetup()

    targetBuffs.apply(getBuffDefinition('bong'), source, target)
    targetBuffs.apply(getBuffDefinition('te_cong'), source, target)

    reactionManager.checkAndTrigger(targetBuffs, 'te_cong', source, target, combatSystem)

    // Combat Balance Pass (2026-08-29) — "Bốc Hơi" powerScalingRatio
    // 1.0 (T5.4): 60 + attack(10)×1.0 = 70.
    expect(target.currentHp).toBe(1000 - 70)
    expect(targetBuffs.getActiveIds()).toEqual([])
  })

  it('keepChance 1 — giữ lại CẢ 2 buff/debuff, damage vẫn gây đủ', () => {
    const { reactionManager, combatSystem, source, target, targetBuffs } = createSetup()

    targetBuffs.apply(getBuffDefinition('bong'), source, target)
    targetBuffs.apply(getBuffDefinition('te_cong'), source, target)

    reactionManager.checkAndTrigger(
      targetBuffs, 'te_cong', source, target, combatSystem,
      undefined, undefined, undefined, 1,
    )

    expect(target.currentHp).toBe(1000 - 70)
    expect(targetBuffs.getActiveIds().sort()).toEqual(['bong', 'te_cong'])
  })

  it('roll trúng ngưỡng 25% (random 0.2) — giữ cả 2 buff/debuff', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2)

    const { reactionManager, combatSystem, source, target, targetBuffs } = createSetup()

    targetBuffs.apply(getBuffDefinition('bong'), source, target)
    targetBuffs.apply(getBuffDefinition('te_cong'), source, target)

    reactionManager.checkAndTrigger(
      targetBuffs, 'te_cong', source, target, combatSystem,
      undefined, undefined, undefined, 0.25,
    )

    expect(targetBuffs.getActiveIds().sort()).toEqual(['bong', 'te_cong'])
  })

  it('roll trượt ngưỡng 25% (random 0.3) — vẫn tiêu cả 2 buff/debuff', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3)

    const { reactionManager, combatSystem, source, target, targetBuffs } = createSetup()

    targetBuffs.apply(getBuffDefinition('bong'), source, target)
    targetBuffs.apply(getBuffDefinition('te_cong'), source, target)

    reactionManager.checkAndTrigger(
      targetBuffs, 'te_cong', source, target, combatSystem,
      undefined, undefined, undefined, 0.25,
    )

    expect(targetBuffs.getActiveIds()).toEqual([])
  })

  it('buff/debuff được giữ lại có thể kích reaction lần nữa (chain)', () => {
    const { reactionManager, combatSystem, source, target, targetBuffs } = createSetup()

    targetBuffs.apply(getBuffDefinition('bong'), source, target)
    targetBuffs.apply(getBuffDefinition('te_cong'), source, target)

    reactionManager.checkAndTrigger(
      targetBuffs, 'te_cong', source, target, combatSystem,
      undefined, undefined, undefined, 1,
    )

    // Cả 2 buff/debuff còn nguyên — lần kích tiếp theo vẫn khớp cặp.
    reactionManager.checkAndTrigger(
      targetBuffs, 'te_cong', source, target, combatSystem,
      undefined, undefined, undefined, 1,
    )

    // Combat Balance Pass (2026-08-29) — 2 lần "Bốc Hơi": (60 + 10) × 2.
    expect(target.currentHp).toBe(1000 - 140)
    expect(targetBuffs.getActiveIds().sort()).toEqual(['bong', 'te_cong'])
  })

  it('nhánh appliesAilmentId KHÔNG đổi — keepChance 1 vẫn tiêu 2 vế gốc và áp buff/debuff mới', () => {
    const { reactionManager, combatSystem, source, target, targetBuffs } = createSetup()

    // Thổ+Thủy — "Trói Chân": appliesAilmentId 'troi_chan' (nhánh đặc biệt).
    targetBuffs.apply(getBuffDefinition('thach_hoa'), source, target)
    targetBuffs.apply(getBuffDefinition('te_cong'), source, target)

    reactionManager.checkAndTrigger(
      targetBuffs, 'te_cong', source, target, combatSystem,
      createBuffRegistry(), undefined, undefined, 1,
    )

    expect(targetBuffs.getActiveIds()).toEqual(['troi_chan'])
  })
})
