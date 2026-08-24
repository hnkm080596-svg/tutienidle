import { describe, expect, it } from 'vitest'
import { GameManager } from '../game/GameManager'
import { createDefaultPlayer } from '../player/Player'
import { createBaseStats } from '../stats/StatBlock'
import { defineEnemy } from '../enemy/Enemy'
import type { Skill } from '../skill/Skill'
import { buildBasicAttackPresentation, buildLoadoutPresentation } from './CombatSkillPresentation'

function basicSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'test_basic',
    name: 'Test Basic',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 0,
    remainingCooldown: 0,
    cost: 0,
    target: 'enemy',
    effects: [{ type: 'damage', value: 1, damageType: 'physical' }],
    isBasicAttack: true,
    resourceType: 'none',
    unlocked: true,
    equipped: false,
    ...overrides,
  }
}

function loadoutSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'test_loadout',
    name: 'Test Loadout Skill',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 5,
    remainingCooldown: 0,
    cost: 10,
    resourceType: 'mana',
    target: 'enemy',
    effects: [{ type: 'damage', value: 1, damageType: 'physical' }],
    unlocked: true,
    equipped: false,
    ...overrides,
  }
}

function makeEnemy() {
  return defineEnemy({
    id: 'presentation_test_enemy',
    name: 'Quái',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: {
      maxHp: 999, attack: 0, attackSpeed: 1, movementSpeed: 0,
      attackRange: 999999, criticalRate: 0, criticalDamage: 1.5, armor: 0,
    },
    rewards: { techniqueInsight: 0, cultivation: 0, spiritStone: 0 },
  })
}

describe('buildBasicAttackPresentation', () => {
  it('null khi chưa equip skill isBasicAttack nào', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.startBattleWithPlayer(player, createBaseStats(), makeEnemy())

    expect(buildBasicAttackPresentation(gameManager.getBattle()!, gameManager.skillManager)).toBeNull()
  })

  it('kind/cadenceTotal đúng theo getAttackIntervalSeconds(attackSpeed), cadenceRemaining=0 lúc mới bắt đầu', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.skillSystem.learn(basicSkill())
    gameManager.skillSystem.equipWithoutSlot('test_basic')

    const stats = createBaseStats()
    stats.attackSpeed = 2

    gameManager.startBattleWithPlayer(player, stats, makeEnemy())
    gameManager.update(3) // bỏ qua countdown

    const presentation = buildBasicAttackPresentation(gameManager.getBattle()!, gameManager.skillManager)

    expect(presentation).not.toBeNull()
    expect(presentation!.kind).toBe('basic_attack')
    expect(presentation!.cadenceTotal).toBe(0.5)
    expect(presentation!.cadenceRemaining).toBe(0)
  })

  it('isAdvancing true khi đang fighting, không bị khống chế, còn quái sống', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.skillSystem.learn(basicSkill())
    gameManager.skillSystem.equipWithoutSlot('test_basic')

    gameManager.startBattleWithPlayer(player, createBaseStats(), makeEnemy())
    gameManager.update(3) // bỏ qua countdown -> state 'fighting'

    expect(buildBasicAttackPresentation(gameManager.getBattle()!, gameManager.skillManager)!.isAdvancing).toBe(true)
  })

  it('isAdvancing false lúc còn countdown (chưa sang fighting)', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.skillSystem.learn(basicSkill())
    gameManager.skillSystem.equipWithoutSlot('test_basic')

    gameManager.startBattleWithPlayer(player, createBaseStats(), makeEnemy())

    expect(gameManager.getBattle()!.state).toBe('countdown')
    expect(buildBasicAttackPresentation(gameManager.getBattle()!, gameManager.skillManager)!.isAdvancing).toBe(false)
  })

  it('isAdvancing false khi player đang Choáng/Đóng Băng', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.skillSystem.learn(basicSkill())
    gameManager.skillSystem.equipWithoutSlot('test_basic')

    gameManager.startBattleWithPlayer(player, createBaseStats(), makeEnemy())
    gameManager.update(3)

    gameManager.getBattle()!.playerAilments.add({
      id: 'choang',
      category: 'cc',
      sourceId: 'presentation_test_enemy',
      targetId: 'player',
      duration: 1,
      remainingTime: 1,
      stacks: 1,
      stackMode: 'refresh',
      ccEffect: 'stun',
      continuousSeconds: 0,
    })

    expect(buildBasicAttackPresentation(gameManager.getBattle()!, gameManager.skillManager)!.isAdvancing).toBe(false)
  })

  it('isAdvancing false khi không còn quái nào sống', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.skillSystem.learn(basicSkill())
    gameManager.skillSystem.equipWithoutSlot('test_basic')

    gameManager.startBattleWithPlayer(player, createBaseStats(), makeEnemy())
    gameManager.update(3)

    for (const battleEnemy of gameManager.getBattle()!.enemies) {
      battleEnemy.entity.alive = false
    }

    expect(buildBasicAttackPresentation(gameManager.getBattle()!, gameManager.skillManager)!.isAdvancing).toBe(false)
  })
})

describe('buildLoadoutPresentation', () => {
  it('slot ngoài unlockedSlotCount thì state locked', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.startBattleWithPlayer(player, createBaseStats(), makeEnemy())

    const entries = buildLoadoutPresentation(gameManager.getBattle()!, gameManager.skillManager, 5, 2)

    expect(entries).toHaveLength(5)
    expect(entries[0]!.state).toBe('empty')
    expect(entries[1]!.state).toBe('empty')
    expect(entries[2]!.state).toBe('locked')
    expect(entries[4]!.state).toBe('locked')
  })

  it('skill trong slot mở khoá nhưng thiếu resource thì insufficient_resource', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.skillSystem.learn(loadoutSkill())
    gameManager.skillSystem.equipToSlot('test_loadout', 0)

    const stats = createBaseStats()
    stats.maxMp = 0

    gameManager.startBattleWithPlayer(player, stats, makeEnemy())

    const entries = buildLoadoutPresentation(gameManager.getBattle()!, gameManager.skillManager, 5, 5)

    expect(entries[0]!.skillId).toBe('test_loadout')
    expect(entries[0]!.state).toBe('insufficient_resource')
  })

  it('skill đang cooldown thì state cooldown, cooldownRemaining khớp remainingCooldownBySlot', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.skillSystem.learn(loadoutSkill())
    gameManager.skillSystem.equipToSlot('test_loadout', 0)

    gameManager.startBattleWithPlayer(player, createBaseStats(), makeEnemy())

    const skill = gameManager.skillManager.get('test_loadout')!
    skill.remainingCooldownBySlot = { 0: 3 }

    const entries = buildLoadoutPresentation(gameManager.getBattle()!, gameManager.skillManager, 5, 5)

    expect(entries[0]!.state).toBe('cooldown')
    expect(entries[0]!.cooldownRemaining).toBe(3)
    expect(entries[0]!.cooldownTotal).toBe(5)
  })
})
