import { describe, expect, it } from 'vitest'
import { GameManager } from '../game/GameManager'
import { createDefaultPlayer } from '../player/Player'
import { createBaseStats } from '../stats/StatBlock'
import { defineEnemy } from '../enemy/Enemy'
import type { Skill } from '../skill/Skill'
import { buildLoadoutPresentation } from './CombatSkillPresentation'
import { HERO_LANE_INDEX } from '../battle/BattleLane'

// Execution policy rework (plan §11.3) — KHÔNG còn basic attack
// presentation: mọi slot đọc từ scheduler thống nhất qua
// buildLoadoutPresentation với các trạng thái ready/cadence/cooldown/
// casting/blocked_resource/out_of_range.
function attackSpeedSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'test_cadence',
    name: 'Test Cadence Skill',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 0,
    remainingCooldown: 0,
    cost: 0,
    target: 'enemy',
    effects: [{ type: 'damage', value: 1, damageType: 'physical' }],
    execution: { kind: 'attack_speed' },
    resourceType: 'none',
    unlocked: true,
    equipped: false,
    loadoutSlot: 0,
    loadoutSlots: [0],
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
    execution: { kind: 'cooldown' },
    unlocked: true,
    equipped: false,
    loadoutSlot: 0,
    loadoutSlots: [0],
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
      attackRangeRanks: 999999, criticalRate: 0, criticalDamage: 1.5, armor: 0,
    },
    rewards: { techniqueInsight: 0, cultivation: 0, spiritStone: 0 },
  })
}

/**
 * Bỏ qua countdown: update(3) vừa materialize hai phía vừa chuyển
 * 'fighting' — quái đầu tiên đã nằm trong battle.enemies ở vị trí resolver
 * roll; đưa nó về ô kề avatar để các test điều khiển khoảng cách tường minh.
 */
function startFighting(gameManager: GameManager) {
  gameManager.update(3)

  const battle = gameManager.getBattle()!

  battle.playerMaterialized = true

  for (const entry of battle.enemies) {
    entry.entity.x = 2
    entry.entity.row = HERO_LANE_INDEX as never
  }
}

describe('buildLoadoutPresentation', () => {
  it('slot ngoài unlockedSlotCount thì state locked', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.startBattleWithPlayer(player, createBaseStats(), makeEnemy())
    startFighting(gameManager)

    const entries = buildLoadoutPresentation(gameManager.getBattle()!, gameManager.skillManager, 5, 2)

    expect(entries).toHaveLength(5)
    expect(entries[0]!.state).toBe('empty')
    expect(entries[1]!.state).toBe('empty')
    expect(entries[2]!.state).toBe('locked')
    expect(entries[4]!.state).toBe('locked')
  })

  it("policy attack_speed: cadenceRemaining/cadenceTotal theo getAttackIntervalSeconds(attackSpeed), state 'cadence' khi đang chờ nhịp", () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.skillSystem.learn(attackSpeedSkill())
    gameManager.skillSystem.equipToSlot('test_cadence', 0)

    const stats = createBaseStats()
    stats.attackSpeed = 2 // interval 0.5s

    gameManager.startBattleWithPlayer(player, stats, makeEnemy())
    startFighting(gameManager)

    const battle = gameManager.getBattle()!
    battle.player.skillCadenceRemainingBySlot = { 0: 0.25 }

    const entries = buildLoadoutPresentation(battle, gameManager.skillManager, 5, 5)

    expect(entries[0]!.skillId).toBe('test_cadence')
    expect(entries[0]!.cadenceTotal).toBe(0.5)
    expect(entries[0]!.cadenceRemaining).toBe(0.25)
    expect(entries[0]!.state).toBe('cadence')

    // Hết cadence → sẵn sàng.
    battle.player.skillCadenceRemainingBySlot = { 0: 0 }

    expect(buildLoadoutPresentation(battle, gameManager.skillManager, 5, 5)[0]!.state).toBe('ready')
  })

  it("policy cooldown: skill đang cooldown thì state cooldown, remaining khớp remainingCooldownBySlot", () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.skillSystem.learn(loadoutSkill())
    gameManager.skillSystem.equipToSlot('test_loadout', 0)

    gameManager.startBattleWithPlayer(player, createBaseStats(), makeEnemy())
    startFighting(gameManager)

    const skill = gameManager.skillManager.get('test_loadout')!
    skill.remainingCooldownBySlot = { 0: 3 }

    const entries = buildLoadoutPresentation(gameManager.getBattle()!, gameManager.skillManager, 5, 5)

    expect(entries[0]!.state).toBe('cooldown')
    expect(entries[0]!.cooldownRemaining).toBe(3)
    expect(entries[0]!.cooldownTotal).toBe(5)
  })

  it('thiếu resource thì state blocked_resource (đổi tên từ insufficient_resource)', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.skillSystem.learn(loadoutSkill())
    gameManager.skillSystem.equipToSlot('test_loadout', 0)

    const stats = createBaseStats()
    stats.maxMp = 0

    gameManager.startBattleWithPlayer(player, stats, makeEnemy())
    startFighting(gameManager)

    const entries = buildLoadoutPresentation(gameManager.getBattle()!, gameManager.skillManager, 5, 5)

    expect(entries[0]!.skillId).toBe('test_loadout')
    expect(entries[0]!.state).toBe('blocked_resource')
  })

  it('không có target trong attack range thì state out_of_range; có target thì ready', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.skillSystem.learn(loadoutSkill({ cost: 0 }))
    gameManager.skillSystem.equipToSlot('test_loadout', 0)

    const stats = createBaseStats()
    stats.attackRange = 1

    gameManager.startBattleWithPlayer(player, stats, makeEnemy())
    startFighting(gameManager)

    const battle = gameManager.getBattle()!

    // Quái đang ở xa (chưa vào range 1).
    for (const entry of battle.enemies) {
      entry.entity.x = 14
    }

    expect(buildLoadoutPresentation(battle, gameManager.skillManager, 5, 5)[0]!.state).toBe(
      'out_of_range',
    )

    for (const entry of battle.enemies) {
      entry.entity.x = 2
    }

    expect(buildLoadoutPresentation(battle, gameManager.skillManager, 5, 5)[0]!.state).toBe('ready')
  })
})
