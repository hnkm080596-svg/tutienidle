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
  const nextStageId = gameManager.getNextStageInZone(zoneId, currentStageId)

  if (!nextStageId) {
    return gameManager.getStage(currentStageId) ? { status: 'complete' } : { status: 'invalid' }
  }

  const stage = gameManager.getStage(nextStageId)

  if (!stage) {
    return { status: 'invalid' }
  }

  return gameManager.isStageUnlocked(nextStageId, player)
    ? { status: 'ready', stage }
    : { status: 'locked', stage }
}
