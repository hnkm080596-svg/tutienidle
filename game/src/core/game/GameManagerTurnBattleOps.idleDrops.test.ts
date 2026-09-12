// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { defineEnemy } from '../enemy/Enemy'
import type { Stage } from '../stage/Stage'
import type { Material } from '../material/Material'
import { modifiersFor } from '../drop/DropContext'
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

  gameManager.registerEnemyTemplates([FARM_ENEMY])
  gameManager.registerStages([FARM_STAGE])
  gameManager.registerMaterials([PROBE_MATERIAL])
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

    expect(gameManager.startAutoFarm(player, FARM_STAGE.id)).toBe(true)

    vi.setSystemTime(new Date('2026-09-04T10:01:00Z')) // 60s -> 1 cycle
    gameManager.update(0.1)

    const calls = setChannel.mock.calls.map((call) => call[0])
    expect(calls[0]).toBe('idle')
    expect(calls[calls.length - 1]).toBe('active')

    // Behavioral proof the channel was actually idle during the cycle:
    // the signature line has chance 0.999 and rng is 0, so an ACTIVE
    // channel would have dropped it. Idle strips chance<1 signatures
    // (spec E11), so nothing lands.
    expect(gameManager.materialBag.getAmount('idle_probe_mat')).toBe(0)
  })
})
