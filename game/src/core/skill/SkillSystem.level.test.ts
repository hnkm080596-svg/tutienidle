import { describe, expect, it, vi } from 'vitest'
import type { Skill } from './Skill'
import { SkillManager } from './SkillManager'
import { SkillSystem } from './SkillSystem'
import { getSkillUpgradeInsightCost } from './SkillUpgradeBalance'
import { createDefaultPlayer } from '../player/Player'
import type { CombatEntity } from '../combat/CombatEntity'

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'test_skill',
    name: 'Test Skill',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 0,
    remainingCooldown: 0,
    cost: 0,
    target: 'enemy',
    effects: [{ type: 'damage', value: 100, damageType: 'physical' }],
    unlocked: false,
    equipped: false,
    ...overrides,
  }
}

function setup(template = skill(), onLevelUp = vi.fn()) {
  const manager = new SkillManager()
  const system = new SkillSystem(manager, onLevelUp)
  expect(system.learn(template)).toBe(true)
  return { manager, system, learned: manager.get(template.id)!, onLevelUp }
}

describe('SkillSystem basic attack cadence', () => {
  it('does not let skill cooldown replace alternating basic attacks with fallback projectiles', () => {
    const { system, learned } = setup(skill({ cooldown: 10, isBasicAttack: true, resourceType: 'none' }))
    const entity = {
      realmIndex: 0,
      currentMp: 0,
      currentRage: 0,
      currentSwordIntent: 0,
      currentMomentum: 0,
    } as CombatEntity

    system.equipWithoutSlot(learned.id)
    learned.remainingCooldown = 9

    expect(system.use(learned.id, entity)).toBe(learned)
    expect(learned.remainingCooldown).toBe(0)
    expect(system.use(learned.id, entity)).toBe(learned)
  })
})

describe('SkillSystem.upgradeSkill (Cảm ngộ Kỹ năng)', () => {
  it('đủ Cảm ngộ thì tăng đúng 1 level, trừ đúng chi phí, phát callback', () => {
    const { system, learned, onLevelUp } = setup()
    const player = createDefaultPlayer()
    player.skillInsight = 100

    const cost = getSkillUpgradeInsightCost(learned)

    expect(system.upgradeSkill(learned.id, player)).toBe(true)
    expect(learned.level).toBe(2)
    expect(player.skillInsight).toBe(100 - cost)
    expect(onLevelUp).toHaveBeenCalledWith(learned, 1)
  })

  it('không đủ Cảm ngộ thì no-op hoàn toàn, không trừ/không tăng level', () => {
    const { system, learned } = setup()
    const player = createDefaultPlayer()
    player.skillInsight = 0

    expect(system.upgradeSkill(learned.id, player)).toBe(false)
    expect(learned.level).toBe(1)
    expect(player.skillInsight).toBe(0)
  })

  it('đã ở maxLevel thì no-op, không trừ Cảm ngộ', () => {
    const { system, learned } = setup(skill({ level: 10, maxLevel: 10 }))
    const player = createDefaultPlayer()
    player.skillInsight = 999

    expect(system.upgradeSkill(learned.id, player)).toBe(false)
    expect(learned.level).toBe(10)
    expect(player.skillInsight).toBe(999)
  })

  it('skillId không tồn tại thì trả false, không throw', () => {
    const { system } = setup()
    const player = createDefaultPlayer()
    player.skillInsight = 100

    expect(system.upgradeSkill('unknown_skill', player)).toBe(false)
    expect(player.skillInsight).toBe(100)
  })

  it('chi phí tăng dần theo level hiện tại', () => {
    const cheap = getSkillUpgradeInsightCost(skill({ level: 1 }))
    const expensive = getSkillUpgradeInsightCost(skill({ level: 5 }))

    expect(expensive).toBeGreaterThan(cheap)
  })

  it('getSkillUpgradeInsightCost() trả undefined khi skill không tồn tại hoặc đã max level', () => {
    const { system, learned } = setup(skill({ level: 10, maxLevel: 10 }))

    expect(system.getSkillUpgradeInsightCost(learned.id)).toBeUndefined()
    expect(system.getSkillUpgradeInsightCost('unknown_skill')).toBeUndefined()
  })
})

describe('SkillSystem.getEffectiveSkill level scaling', () => {
  it('scale active damage đúng 5% mỗi level', () => {
    const { system, learned } = setup(skill({ level: 3 }))
    expect(system.getEffectiveSkill(learned).effects[0]!.value).toBeCloseTo(110)
  })

  it('cho phép combat dùng level snapshot thay vì level progression vừa đổi', () => {
    const { system, learned } = setup(skill({ level: 5 }))
    expect(system.getEffectiveSkill(learned, 1).effects[0]!.value).toBe(100)
    expect(system.getEffectiveSkill(learned).effects[0]!.value).toBe(120)
  })

  it('scale passive flat và percent đúng một lần theo level', () => {
    const { system } = setup(skill({
      type: 'passive',
      level: 3,
      passiveTrigger: 'hit',
      passiveModifiers: [{
        id: 'passive-test',
        sourceId: 'test_skill',
        sourceType: 'skill',
        stat: 'attack',
        flat: 10,
        percent: 0.1,
        perLevelFlat: 2,
        perLevelPercent: 0.05,
      }],
    }))
    system.equipWithoutSlot('test_skill')

    expect(system.getScaledPassiveModifiers()[0]).toMatchObject({ flat: 14, percent: 0.2 })
  })
})
