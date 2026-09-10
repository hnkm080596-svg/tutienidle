import { defineEnemy } from '../../enemy/Enemy'
import { createDefaultPlayer, type PlayerData } from '../../player/Player'
import { calculateStats } from '../../stats/StatCalculator'
import type { Stage } from '../../stage/Stage'
import type { GameManager } from '../GameManager'

/**
 * Shared "a battle is running" fixture for the turn-engine tests.
 *
 * Every combat test used to grow its own copy of this seven-line setup; the
 * clock and turn-engine suites need the exact same one, so it lives here once
 * (combat-turn-mechanism plan, task 6). It registers a single-enemy stage on
 * an EXISTING manager, which is what lets a caller install a
 * ManualClockSource before the battle starts.
 *
 * Deliberately minimal and deterministic: one enemy, one wave, no rewards,
 * enemy attack 0 so nothing ends the battle by accident, player speed 100 so
 * a gauge fills in ten fighting steps.
 */
export function startAStage(
  manager: GameManager,
  options: { stageId?: string; repeatContinuously?: boolean } = {},
): PlayerData {
  const stageId = options.stageId ?? 'fixture_stage'
  const enemyId = `${stageId}_dummy`

  const player = createDefaultPlayer()
  const stats = calculateStats({ ...player.baseStats, attack: 100, speed: 100 }, [])

  const enemy = defineEnemy({
    id: enemyId,
    name: 'Fixture Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: {
      maxHp: 1_000_000,
      attack: 0,
      attackSpeed: 1,
      attackRangeRanks: 9,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
    },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })

  const stage: Stage = {
    id: stageId,
    name: stageId,
    description: '',
    floor: 1,
    enemyPool: [{ enemyId, weight: 1 }],
    totalEnemyCount: 1,
    waves: [1],
    spawnIntervalSeconds: 0,
  }

  manager.registerEnemyTemplates([enemy])
  manager.registerStages([stage])
  manager.setActivePlayer(player)

  if (!manager.startStage(player, stats, stage, options.repeatContinuously ?? false)) {
    throw new Error(`startAStage fixture failed to start stage ${stageId}`)
  }

  return player
}
