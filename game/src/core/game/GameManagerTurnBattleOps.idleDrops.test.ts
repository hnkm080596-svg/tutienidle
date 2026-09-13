// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { defineEnemy } from '../enemy/Enemy'
import type { Stage } from '../stage/Stage'
import type { Material } from '../material/Material'
import { modifiersFor } from '../drop/DropContext'
import { companionBattleExpPerKill } from '../companion/CompanionProgression'
import type { BattleLootSystem } from './BattleLootSystem'

// Drop-system Task 9 (2026-09-12): the auto-farm shim runs on the IDLE
// channel (spec E10/E11). Idle keeps the boss modifier (a stage property)
// but strips the tinh_anh tag and every chance<1 signature drop — idle is
// a background progression channel, never the farm ceiling.

const PROBE_MATERIAL = {
  id: 'idle_probe_mat',
  name: 'Probe',
  category: 'other',
  sourceType: 'monster',
  description: 'test fixture',
} as Material

const FARM_ENEMY = defineEnemy({
  id: 'idle_farm_dummy',
  name: 'Farm Dummy',
  level: 1,
  realmId: 'mortal',
  lane: 'ground',
  statsInput: {
    maxHp: 10,
    attack: 0,
    attackSpeed: 1,
    attackRangeRanks: 1,
    criticalRate: 0,
    criticalDamage: 1.5,
    armor: 0,
  },
  rewards: { techniqueInsight: 0, spiritStone: 5 },
  signatureDrops: [{ kind: 'material', itemId: 'idle_probe_mat', chance: 0.999 }],
})

const FARM_STAGE: Stage = {
  id: 'idle_farm_stage',
  name: 'Idle Farm Stage',
  description: '',
  floor: 1,
  enemyPool: [{ enemyId: FARM_ENEMY.id, weight: 1 }],
  totalEnemyCount: 2,
  waves: [2],
  spawnIntervalSeconds: 0,
}

function harness() {
  const gameManager = new GameManager()
  const player = createDefaultPlayer()

  player.perfectClearStageIds.push(FARM_STAGE.id)
  player.perfectClearSeconds[FARM_STAGE.id] = 100 // cycleSeconds = 50

  gameManager.catalogOps.registerEnemyTemplates([FARM_ENEMY])
  gameManager.catalogOps.registerStages([FARM_STAGE])
  gameManager.catalogOps.registerMaterials([PROBE_MATERIAL])
  gameManager.setActivePlayer(player)

  return { gameManager, player }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('idle channel modifiers (spec E10)', () => {
  it('floor 10 idle still carries boss', () => {
    expect(
      modifiersFor({ channel: 'idle', isBoss: true, isElite: false }).map((m) => m.id),
    ).toEqual(['boss'])
  })

  it('idle never carries tinh_anh even when the spawn rolled elite', () => {
    expect(modifiersFor({ channel: 'idle', isBoss: false, isElite: true })).toEqual([])
  })
})

describe('rollAutoFarmCycleReward runs on the idle channel', () => {
  it('setChannel(idle) wraps the kills and is restored to active afterwards', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-04T10:00:00Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0) // every chance check would pass

    const { gameManager, player } = harness()
    const loot = (gameManager as unknown as { battleLoot: BattleLootSystem }).battleLoot
    const setChannel = vi.spyOn(loot, 'setChannel')

    expect(gameManager.turnBattleOps.autoFarmOps.startAutoFarm(player, FARM_STAGE.id)).toBe(true)

    vi.setSystemTime(new Date('2026-09-04T10:01:00Z')) // 60s -> 1 cycle
    gameManager.tickOps.update(0.1)

    const calls = setChannel.mock.calls.map((call) => call[0])
    expect(calls[0]).toBe('idle')
    expect(calls[calls.length - 1]).toBe('active')

    // Behavioral proof the channel was actually idle during the cycle:
    // the signature line has chance 0.999 and rng is 0, so an ACTIVE
    // channel would have dropped it. Idle strips chance<1 signatures
    // (spec E11), so nothing lands.
    expect(gameManager.materialBag.getAmount('idle_probe_mat')).toBe(0)
  })

  it('a throw mid-cycle still restores the active channel (QA: no idle leak)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-04T10:00:00Z'))

    const { gameManager, player } = harness()
    const loot = (gameManager as unknown as { battleLoot: BattleLootSystem }).battleLoot
    const setChannel = vi.spyOn(loot, 'setChannel')
    vi.spyOn(loot, 'processDefeatedEnemies').mockImplementation(() => {
      throw new Error('simulated grant failure')
    })

    expect(gameManager.turnBattleOps.autoFarmOps.startAutoFarm(player, FARM_STAGE.id)).toBe(true)

    vi.setSystemTime(new Date('2026-09-04T10:01:00Z')) // 60s -> 1 cycle
    try {
      gameManager.tickOps.update(0.1)
    } catch {
      // the simulated failure may or may not propagate through update();
      // either way the channel must already be restored.
    }

    const calls = setChannel.mock.calls.map((call) => call[0])
    expect(calls).toContain('idle')
    expect(calls[calls.length - 1]).toBe('active')
  })

  // F3 (2026-09-13): the idle cycle must hand BattleLootSystem an honest
  // reward input - the pending-enemy entries plus an explicit null heal
  // target - instead of fabricating a Battle whose `player` is a dead
  // enemy standing in for the player.
  it('passes an honest reward input: pending-enemy entries + null heal target, no fabricated Battle', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-04T10:00:00Z'))

    const { gameManager, player } = harness()
    const loot = (gameManager as unknown as { battleLoot: BattleLootSystem }).battleLoot

    // Snapshot the arguments BEFORE processDefeatedEnemies prunes the
    // dead entries out of the array, then delegate so rewards still flow.
    const original = loot.processDefeatedEnemies.bind(loot)
    let observed: {
      enemies: { entity: { alive?: boolean }; rewardGranted: boolean }[]
      healTarget: unknown
      stage: unknown
    } | null = null
    vi.spyOn(loot, 'processDefeatedEnemies').mockImplementation(
      (enemies, healTarget, stage) => {
        observed = { enemies: [...enemies], healTarget, stage }
        return original(enemies, healTarget, stage)
      },
    )

    expect(gameManager.turnBattleOps.autoFarmOps.startAutoFarm(player, FARM_STAGE.id)).toBe(true)

    vi.setSystemTime(new Date('2026-09-04T10:01:00Z')) // 60s -> 1 cycle
    gameManager.tickOps.update(0.1)

    expect(observed).not.toBeNull()
    expect(Array.isArray(observed!.enemies)).toBe(true)
    expect(observed!.enemies.length).toBeGreaterThan(0)
    expect(observed!.healTarget).toBeNull()
    expect(observed!.stage).toMatchObject({ id: FARM_STAGE.id })

    for (const entry of observed!.enemies) {
      // A plain { entity, rewardGranted } entry - not a Battle, no
      // `player` field, entity genuinely dead.
      expect(entry).not.toHaveProperty('player')
      expect(entry.entity.alive).toBe(false)
    }
  })

  // companion-gacha Task 7: auto-farm funnels through
  // processDefeatedEnemies, so formation-assigned companions gain battle
  // EXP on the idle channel with no second path (A9).
  it('a farmed cycle grants companion battle EXP to the assigned companion only', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-04T10:00:00Z'))

    const { gameManager, player } = harness()

    player.companions.push(
      {
        instanceId: 'inst_assigned',
        definitionId: 'test_companion_1',
        realmId: 'mortal',
        realmLevel: 1,
        exp: 0,
        constellationRank: 0,
      },
      {
        instanceId: 'inst_benched',
        definitionId: 'test_companion_2',
        realmId: 'mortal',
        realmLevel: 1,
        exp: 0,
        constellationRank: 0,
      },
    )
    player.formationLoadout = {
      formationId: 'farm_formation',
      assignments: [
        { row: 0, column: 0, combatantId: 'player' },
        { row: 0, column: 1, combatantId: 'test_companion_1' },
      ],
    }

    expect(gameManager.turnBattleOps.autoFarmOps.startAutoFarm(player, FARM_STAGE.id)).toBe(true)

    vi.setSystemTime(new Date('2026-09-04T10:01:00Z')) // 60s -> 1 cycle
    gameManager.tickOps.update(0.1)

    // 1 cycle x totalEnemyCount 2 kills; FARM_STAGE has no requiredRealmId,
    // so the exp anchor falls back to enemy.realmId 'mortal' -> 2 per kill.
    expect(player.companions[0]?.exp).toBe(2 * companionBattleExpPerKill('mortal'))
    expect(player.companions[1]?.exp).toBe(0)
  })
})
