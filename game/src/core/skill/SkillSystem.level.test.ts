import { describe, expect, it } from 'vitest'
import type { Skill } from './Skill'
import { SkillManager } from './SkillManager'
import { SkillSystem } from './SkillSystem'
import { GameManager } from '../game/GameManager'
import { createDefaultPlayer } from '../player/Player'
import type { ProgressionNode } from '../progression/ProgressionNode'
import { getSkillCoreUpgradeCost, skillCoreNodeId } from '../progression/SkillCoreLevel'

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'test_skill',
    name: 'Test Skill',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 0,
    cost: 0,
    target: 'enemy',
    effects: [{ type: 'damage', value: 100, damageType: 'physical' }],
    ...overrides,
  }
}

function coreOf(skillId: string, maxLevel: number): ProgressionNode {
  return {
    id: skillCoreNodeId(skillId),
    name: `Core: ${skillId}`,
    type: 'minor',
    insightCost: 0,
    maxLevel,
    levelsSkillId: skillId,
    effect: {},
  }
}

// M-QI-05 / QI-D3 - SkillSystem holds no writable level authority: the
// canonical channel is progressionOps.learnSkill/levelUpSkill over
// nodeLevels[core_<id>], and every live level read resolves through
// the injected provider (wired to the active player by GameManager).
describe('QI-D3 canonical skill level (learn -> core -> levelUpSkill)', () => {
  function setup(template = skill()) {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerSkillTemplates([template])
    gameManager.catalogOps.registerProgressionNodes([coreOf(template.id, template.maxLevel)])
    const player = createDefaultPlayer()
    gameManager.setActivePlayer(player)
    return { gameManager, player, template }
  }

  it('learnSkill grants the core atomically (nodeLevels + purchased mirror)', () => {
    const { gameManager, player } = setup()

    expect(gameManager.progressionOps.learnSkill('test_skill', player)).toBe(true)
    expect(gameManager.skillManager.has('test_skill')).toBe(true)
    expect(player.nodeLevels[skillCoreNodeId('test_skill')]).toBe(1)
    expect(player.purchasedNodeIds).toContain(skillCoreNodeId('test_skill'))
  })

  it('learnSkill is idempotent - re-learn does not bump the core level', () => {
    const { gameManager, player } = setup()

    expect(gameManager.progressionOps.learnSkill('test_skill', player)).toBe(true)
    // Re-learn reports "not learned" (SkillManager membership contract)
    // and must not bump the already-granted core.
    expect(gameManager.progressionOps.learnSkill('test_skill', player)).toBe(false)
    expect(player.nodeLevels[skillCoreNodeId('test_skill')]).toBe(1)
  })

  it('learnSkill fails atomically when the core is missing (no membership, no nodeLevels)', () => {
    const gameManager = new GameManager()
    const template = skill()
    gameManager.catalogOps.registerSkillTemplates([template])
    // Core deliberately NOT registered.
    const player = createDefaultPlayer()
    gameManager.setActivePlayer(player)

    expect(gameManager.progressionOps.learnSkill('test_skill', player)).toBe(false)
    expect(gameManager.skillManager.has('test_skill')).toBe(false)
    expect(player.nodeLevels[skillCoreNodeId('test_skill')]).toBeUndefined()
  })

  it('a maxLevel:1 template learns without a core', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerSkillTemplates([skill({ id: 'fixed_skill', maxLevel: 1 })])
    const player = createDefaultPlayer()
    gameManager.setActivePlayer(player)

    expect(gameManager.progressionOps.learnSkill('fixed_skill', player)).toBe(true)
    expect(player.nodeLevels[skillCoreNodeId('fixed_skill')]).toBeUndefined()
  })

  it('levelUpSkill deducts the canonical cost, bumps nodeLevels, notifies once', () => {
    const { gameManager, player } = setup()
    player.skillInsight = 100

    expect(gameManager.progressionOps.learnSkill('test_skill', player)).toBe(true)

    gameManager.drainNotifications()

    expect(gameManager.progressionOps.levelUpSkill('test_skill', player)).toBe(true)
    expect(player.nodeLevels[skillCoreNodeId('test_skill')]).toBe(2)
    expect(player.skillInsight).toBe(100 - getSkillCoreUpgradeCost(1))
    expect(gameManager.drainNotifications().filter((event) => event.kind === 'upgrade')).toHaveLength(1)
  })

  it('levelUpSkill no-ops on insufficient Insight, maxed core, or unknown id', () => {
    const { gameManager, player } = setup()

    gameManager.progressionOps.learnSkill('test_skill', player)

    player.skillInsight = 0
    expect(gameManager.progressionOps.levelUpSkill('test_skill', player)).toBe(false)
    expect(player.nodeLevels[skillCoreNodeId('test_skill')]).toBe(1)

    player.skillInsight = 999
    player.nodeLevels[skillCoreNodeId('test_skill')] = 10
    expect(gameManager.progressionOps.levelUpSkill('test_skill', player)).toBe(false)
    expect(player.skillInsight).toBe(999)

    expect(gameManager.progressionOps.levelUpSkill('unknown_skill', player)).toBe(false)
  })

  it('getSkillCoreUpgradeCost mirrors the canonical curve and gates', () => {
    const { gameManager, player } = setup()

    expect(gameManager.progressionOps.getSkillCoreUpgradeCost('test_skill', player)).toBeUndefined()

    gameManager.progressionOps.learnSkill('test_skill', player)

    expect(gameManager.progressionOps.getSkillCoreUpgradeCost('test_skill', player)).toBe(5)

    player.nodeLevels[skillCoreNodeId('test_skill')] = 10
    expect(gameManager.progressionOps.getSkillCoreUpgradeCost('test_skill', player)).toBeUndefined()
  })

  it('the live provider drives getEffectiveSkill scaling from nodeLevels', () => {
    const { gameManager, player } = setup()

    gameManager.progressionOps.learnSkill('test_skill', player)

    const learned = gameManager.skillManager.get('test_skill')!
    expect(gameManager.skillSystem.getEffectiveSkill(learned).effects[0]!.value).toBe(100)

    player.nodeLevels[skillCoreNodeId('test_skill')] = 3
    expect(gameManager.skillSystem.getEffectiveSkill(learned).effects[0]!.value).toBeCloseTo(110)

    // levelOverride still wins over the provider (combat snapshots).
    expect(gameManager.skillSystem.getEffectiveSkill(learned, 1).effects[0]!.value).toBe(100)
  })

  it('getSkillLevel reads the canonical core level (0 when ungranted)', () => {
    const { gameManager, player } = setup()

    expect(gameManager.progressionOps.getSkillLevel('test_skill', player)).toBe(0)

    gameManager.progressionOps.learnSkill('test_skill', player)
    player.nodeLevels[skillCoreNodeId('test_skill')] = 4

    expect(gameManager.progressionOps.getSkillLevel('test_skill', player)).toBe(4)
  })
})

describe('SkillSystem level provider seam', () => {
  function rawSetup(level: number) {
    const manager = new SkillManager()
    const system = new SkillSystem(manager)
    system.setSkillLevelProvider(() => level)
    expect(system.learn(skill())).toBe(true)
    return { system, learned: manager.get('test_skill')! }
  }

  it('getEffectiveSkill scales +5% per provider level', () => {
    const { system, learned } = rawSetup(3)
    expect(system.getEffectiveSkill(learned).effects[0]!.value).toBeCloseTo(110)
  })

  it('levelOverride beats the provider', () => {
    const { system, learned } = rawSetup(5)
    expect(system.getEffectiveSkill(learned, 1).effects[0]!.value).toBe(100)
    expect(system.getEffectiveSkill(learned).effects[0]!.value).toBeCloseTo(120)
  })

  it('passive flat/percent scale once per provider level', () => {
    const manager = new SkillManager()
    const system = new SkillSystem(manager)
    system.setSkillLevelProvider(() => 3)
    system.learn(skill({
      type: 'passive',
      passiveTrigger: 'hit',
      passiveModifiers: [{
        id: 'passive-test',
        sourceId: 'test_skill',
        sourceType: 'skill',
        stat: 'might',
        flat: 10,
        percent: 0.1,
        perLevelFlat: 2,
        perLevelPercent: 0.05,
      }],
    }))

    expect(system.getScaledPassiveModifiers()[0]).toMatchObject({ flat: 14, percent: 0.2 })
  })

  it('unwired provider falls back to Lv1', () => {
    const manager = new SkillManager()
    const system = new SkillSystem(manager)
    system.learn(skill())
    expect(system.getEffectiveSkill(manager.get('test_skill')!).effects[0]!.value).toBe(100)
  })
})
