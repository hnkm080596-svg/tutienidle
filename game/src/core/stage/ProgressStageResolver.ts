import type { GameManager } from '../game/GameManager'
import type { PlayerData } from '../player/Player'
import type { Stage } from './Stage'

export type ProgressStageResolution =
  | { status: 'ready'; stage: Stage }
  | { status: 'locked'; stage: Stage }
  | { status: 'complete' }
  | { status: 'invalid' }

/** Resolves auto-progress without mutating UI selection or battle state. */
export function resolveNextProgressStage(
  gameManager: GameManager,
  player: PlayerData,
  zoneId: string,
  currentStageId: string,
): ProgressStageResolution {
  const nextStageId = gameManager.catalogOps.getNextStageInZone(zoneId, currentStageId)

  if (!nextStageId) {
    return gameManager.catalogOps.getStage(currentStageId) ? { status: 'complete' } : { status: 'invalid' }
  }

  const stage = gameManager.catalogOps.getStage(nextStageId)

  if (!stage) {
    return { status: 'invalid' }
  }

  return gameManager.catalogOps.isStageUnlocked(nextStageId, player)
    ? { status: 'ready', stage }
    : { status: 'locked', stage }
}
