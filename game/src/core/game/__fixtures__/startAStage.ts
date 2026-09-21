import { defineEnemy } from '../../enemy/Enemy'
import { createDefaultPlayer, type PlayerData } from '../../player/Player'
import { asBaseStats } from '../../stats/StatBlock'
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
 * enemy might 0 so nothing ends the battle by accident, player speed 100 so
 * a gauge fills in ten fighting steps.
 */
export function startAStage(
  manager: GameManager,
  options: { stageId?: string; repeatContinuously?: boolean } = {},
): PlayerData {
  const stageId = options.stageId ?? 'fixture_stage'
  const enemyId = `${stageId}_dummy`

  const basePlayer = createDefaultPlayer()
  // ARCH-002 (M7): startStage resolves stats internally — patch the RAW
  // baseStats at construction so the resolved snapshot keeps the
  // documented might/speed (object-literal form: the R14.3a guard forbids
  // post-creation baseStats assignments in src/).
  const player: PlayerData = {
    ...basePlayer,
    baseStats: asBaseStats({ ...basePlayer.baseStats, might: 100, speed: 100 }),
  }

  const enemy = defineEnemy({
    id: enemyId,
    name: 'Fixture Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: {
      maxHp: 1_000_000,
      might: 0,
      attackSpeed: 1,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
    },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
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

  manager.catalogOps.registerEnemyTemplates([enemy])
  manager.catalogOps.registerStages([stage])
  manager.setActivePlayer(player)

  if (!manager.turnBattleOps.startStage(player, stage, options.repeatContinuously ?? false)) {
    throw new Error(`startAStage fixture failed to start stage ${stageId}`)
  }

  return player
}
