import type { EventBus } from '../../events/EventBus'
import type { GridPosition, CellArea } from '../BattleGrid'
import type { CombatVfxPresetId, ActionTargetingShape } from '../CombatAction'

// Action Playback Task 4 (2026-09-05) — presentation event emitter cho
// turn-based combat. GameManager là SOLE caller (Task 6), CombatScene là
// SOLE listener (Task 7). Tái dùng 'attack'/'action_impact' event names +
// payload shapes để CombatScene handlers hiện có hoạt động KHÔNG SỬA.
//
// 4 signals (spec §4):
//   turn_ready             — actor tới lượt, scene chơi ready flourish rồi
//                            acknowledgeTurnReady()
//   attack                 — cast bắt đầu (lunge tween) → acknowledge-
//                            ActionImpact() tại impact frame
//   action_impact          — VFX preset spawn → acknowledgeActionComplete()
//                            khi tween xong
//   turn_standby_complete  — tail event, presentation-only bookkeeping

/** Fallback preset khi TurnSkillDefinition.presetId undefined (generic magic hit). */
const DEFAULT_PRESET_ID: CombatVfxPresetId = 'arcane_impact'

export function emitTurnReady(eventBus: EventBus, actorId: string): void {
  eventBus.emit('turn_ready', { actorId })
}

export function emitTurnCastStart(
  eventBus: EventBus,
  sourceId: string,
  skillId: string,
  targetIds: string[],
): void {
  eventBus.emit('attack', {
    type: 'attack',
    sourceId,
    targetId: targetIds[0],
    skillId,
  })
}

export interface TurnActionImpactParams {
  actionId: string

  sourceId: string

  primaryTargetId: string

  /** Ô neo VFX — snapshot vị trí primary target tại thời điểm impact. */
  anchorCell: GridPosition

  affectedArea: CellArea & { shape: ActionTargetingShape }

  affectedTargetIds: string[]

  landedTargetIds: string[]

  dodgedTargetIds: string[]

  hitCount: number

  presetId?: CombatVfxPresetId
}

export function emitTurnActionImpact(eventBus: EventBus, params: TurnActionImpactParams): void {
  eventBus.emit('action_impact', {
    type: 'action_impact',
    actionId: params.actionId,
    actionInstanceId: `turn-act-${params.actionId}`,
    sourceId: params.sourceId,
    primaryTargetId: params.primaryTargetId,
    anchorCell: params.anchorCell,
    affectedTargetIds: params.affectedTargetIds,
    landedTargetIds: params.landedTargetIds,
    dodgedTargetIds: params.dodgedTargetIds,
    affectedArea: params.affectedArea,
    hitCount: params.hitCount,
    presetId: params.presetId ?? DEFAULT_PRESET_ID,
  })
}

export function emitTurnStandbyComplete(eventBus: EventBus, actorId: string): void {
  eventBus.emit('turn_standby_complete', { actorId })
}
