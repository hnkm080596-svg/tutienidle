import type { EventBus } from '../../events/EventBus'
import type { GridPosition, CellArea } from '../BattleGrid'
import { entityGridPosition } from '../BattleGrid'
import type { CombatVfxPresetId, ActionTargetingShape } from '../CombatAction'
import type { TurnBattle, TurnBattleParticipant } from './TurnBattleSystem'

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

export interface TurnBattleEntityVisualState {
  id: string
  name: string
  row: number
  column: number
  currentHp: number
  maxHp: number
  alive: boolean
  isBoss: boolean
}

export interface TurnBattleEntitySnapshotEvent {
  players: TurnBattleEntityVisualState[]
  enemies: TurnBattleEntityVisualState[]
}

function toVisualState(participant: TurnBattleParticipant): TurnBattleEntityVisualState {
  const position = entityGridPosition(participant.entity)

  return {
    id: participant.id,
    name: participant.entity.name,
    row: position.row,
    column: position.column,
    currentHp: participant.entity.currentHp,
    maxHp: participant.entity.maxHp,
    alive: participant.entity.alive,
    // Fix round 1 (Task 5 review) — CombatEntity.isBoss là optional (chỉ set
    // cho enemy spawn qua legacy spawner); mặc định false khớp với cách
    // legacy/BattleSystem.ts (dòng 621/810/831) đã coerce isBoss ?? false
    // khi build EnemySpawnedEvent, giữ nhất quán 2 nguồn dữ liệu.
    isBoss: participant.entity.isBoss ?? false,
  }
}

// Combat Art Pipeline (2026-09-05) — thay thế bridge 'positions' đã chết của
// legacy real-time engine (legacy/BattleSystem.ts không còn được tick cho
// turn-based combat). Đọc TRỰC TIẾP từ TurnBattle.players/enemies mỗi fixed
// step trong lúc 'fighting' — không phụ thuộc emitPositions()/update() của
// legacy engine. GameManager gọi hàm này (Task 5 sẽ nối CombatScene nghe).
export function emitTurnBattleEntitySnapshot(eventBus: EventBus, battle: TurnBattle): void {
  eventBus.emit('turn_battle_entity_snapshot', {
    players: battle.players.map(toVisualState),
    enemies: battle.enemies.map(toVisualState),
  })
}
