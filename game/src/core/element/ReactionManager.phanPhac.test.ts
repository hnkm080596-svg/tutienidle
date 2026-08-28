import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReactionManager } from './ReactionManager'
import { AilmentSystem } from '../ailment/AilmentSystem'
import { AilmentManager } from '../ailment/AilmentManager'
import { AilmentRegistry } from '../ailment/AilmentRegistry'
import { CombatSystem } from '../combat/CombatSystem'
import { EventBus } from '../events/EventBus'
import { createBaseStats } from '../stats/StatBlock'
import { ailments } from '../../data/ailment/ailments'
import type { CombatEntity } from '../combat/CombatEntity'
import type { AilmentTemplate } from '../ailment/AilmentRegistry'

// Thiên phú Phản Phác (talent-direction-choice-plan §6) — reaction_keep_chance
// chỉ tác động NHÁNH CONSUME CHUẨN của ReactionManager; nhánh đặc biệt
// (appliesAilmentId/appliesBuffId/keepsAilmentId) giữ nguyên hành vi.
// Cặp test: bong + te_dien ("Lôi Viêm", 70 dmg, nhánh chuẩn thuần).
function getTemplate(id: string): AilmentTemplate {
  const template = ailments.find((ailment) => ailment.id === id)

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
  const ailmentSystem = new AilmentSystem(new AilmentManager())

  return { reactionManager, combatSystem, source, target, ailmentSystem }
}

describe('ReactionManager — Phản Phác (reaction_keep_chance)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keepChance 0 (mặc định) — reaction tiêu cả 2 ailment như cũ', () => {
    const { reactionManager, combatSystem, source, target, ailmentSystem } = createSetup()

    ailmentSystem.apply(getTemplate('bong'), source, target)
    ailmentSystem.apply(getTemplate('te_dien'), source, target)

    reactionManager.checkAndTrigger(ailmentSystem, 'te_dien', source, target, combatSystem)

    expect(target.currentHp).toBe(1000 - 70)
    expect(ailmentSystem.getActiveIds()).toEqual([])
  })

  it('keepChance 1 — giữ lại CẢ 2 ailment, damage vẫn gây đủ', () => {
    const { reactionManager, combatSystem, source, target, ailmentSystem } = createSetup()

    ailmentSystem.apply(getTemplate('bong'), source, target)
    ailmentSystem.apply(getTemplate('te_dien'), source, target)

    reactionManager.checkAndTrigger(
      ailmentSystem, 'te_dien', source, target, combatSystem,
      undefined, undefined, undefined, undefined, 1,
    )

    expect(target.currentHp).toBe(1000 - 70)
    expect(ailmentSystem.getActiveIds().sort()).toEqual(['bong', 'te_dien'])
  })

  it('roll trúng ngưỡng 25% (random 0.2) — giữ cả 2 ailment', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2)

    const { reactionManager, combatSystem, source, target, ailmentSystem } = createSetup()

    ailmentSystem.apply(getTemplate('bong'), source, target)
    ailmentSystem.apply(getTemplate('te_dien'), source, target)

    reactionManager.checkAndTrigger(
      ailmentSystem, 'te_dien', source, target, combatSystem,
      undefined, undefined, undefined, undefined, 0.25,
    )

    expect(ailmentSystem.getActiveIds().sort()).toEqual(['bong', 'te_dien'])
  })

  it('roll trượt ngưỡng 25% (random 0.3) — vẫn tiêu cả 2 ailment', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3)

    const { reactionManager, combatSystem, source, target, ailmentSystem } = createSetup()

    ailmentSystem.apply(getTemplate('bong'), source, target)
    ailmentSystem.apply(getTemplate('te_dien'), source, target)

    reactionManager.checkAndTrigger(
      ailmentSystem, 'te_dien', source, target, combatSystem,
      undefined, undefined, undefined, undefined, 0.25,
    )

    expect(ailmentSystem.getActiveIds()).toEqual([])
  })

  it('ailment được giữ lại có thể kích reaction lần nữa (chain)', () => {
    const { reactionManager, combatSystem, source, target, ailmentSystem } = createSetup()

    ailmentSystem.apply(getTemplate('bong'), source, target)
    ailmentSystem.apply(getTemplate('te_dien'), source, target)

    reactionManager.checkAndTrigger(
      ailmentSystem, 'te_dien', source, target, combatSystem,
      undefined, undefined, undefined, undefined, 1,
    )

    // Cả 2 ailment còn nguyên — lần kích tiếp theo vẫn khớp cặp.
    reactionManager.checkAndTrigger(
      ailmentSystem, 'te_dien', source, target, combatSystem,
      undefined, undefined, undefined, undefined, 1,
    )

    expect(target.currentHp).toBe(1000 - 140)
    expect(ailmentSystem.getActiveIds().sort()).toEqual(['bong', 'te_dien'])
  })

  it('nhánh appliesAilmentId KHÔNG đổi — keepChance 1 vẫn tiêu 2 ailment gốc và áp ailment mới', () => {
    const { reactionManager, combatSystem, source, target, ailmentSystem } = createSetup()

    // Thổ+Thủy — "Trói Chân": appliesAilmentId 'troi_chan' (nhánh đặc biệt).
    ailmentSystem.apply(getTemplate('thach_hoa'), source, target)
    ailmentSystem.apply(getTemplate('te_cong'), source, target)

    reactionManager.checkAndTrigger(
      ailmentSystem, 'te_cong', source, target, combatSystem,
      createAilmentRegistry(), undefined, undefined, undefined, 1,
    )

    expect(ailmentSystem.getActiveIds()).toEqual(['troi_chan'])
  })
})
