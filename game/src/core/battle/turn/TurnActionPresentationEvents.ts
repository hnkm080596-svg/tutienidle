import type { EventBus } from '../../events/EventBus'
import type { GridPosition, CellArea } from '../BattleGrid'
import { entityGridPosition } from '../BattleGrid'
import type { CombatVfxPresetId, ActionTargetingShape, EnemySpawnVfxPresetId } from '../CombatAction'
import type { TurnBattle, TurnBattleParticipant, PendingEnemySpawn, TurnBattleState } from './TurnBattleSystem'
import type { CastSlotRole } from './SkillPresentationFacts'
import { COUNTDOWN_TOTAL_TICKS } from './TurnBattleConstants'

// Turn-based combat presentation event emitter; GameManager is the sole
// caller. Action ACK authority lives in SkillPresentationRunner via
// skill_presentation_cast / skill_presentation_resolved - not in these events.
//
// Signals:
//   turn_ready             - actor's turn; scene plays the ready flourish
//                            then acknowledgeTurnReady()
//   turn_cast_start        - declare-time observation feed; no production
//                            subscribers (CombatScene.skillPresentation.test
//                            pins the scene unbound). Cast presentation reads
//                            ONLY the impact-time skill_presentation_cast
//                            emit in CombatAnimationRuntime - a subscriber
//                            here would read cast info at a divergent time.
//   action_impact          - observation feed - no production subscribers
//   turn_standby_complete  - tail event, presentation-only bookkeeping

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
  slotRole?: CastSlotRole,
): void {
  eventBus.emit('turn_cast_start', {
    type: 'turn_cast_start',
    sourceId,
    targetId: targetIds[0],
    skillId,
    slotRole,
  })
}

export interface TurnActionImpactParams {
  actionId: string

  sourceId: string

  primaryTargetId: string

  /** O neo VFX - snapshot vi tri primary target tai thoi diem impact. */
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
  // MP cung la live vitals nhu HP - mang theo de presentation seed HUD
  // ngay tu snapshot dau (truoc entity_vitals_changed dau tien).
  currentMp: number
  maxMp: number
  alive: boolean
  isBoss: boolean
}

export interface TurnBattleEntitySnapshotEvent {
  players: TurnBattleEntityVisualState[]
  enemies: TurnBattleEntityVisualState[]
  /** Turn-Based Wave Redesign (2026-09-06) - quai dang telegraph, CHUA vao battle.enemies. */
  pendingEnemySpawns: PendingSpawnVisualState[]
  /**
   * Battle phase at snapshot time. Needed because `countdownProgress` ===
   * undefined carries TWO different meanings - 'intro' (countdown has not
   * started yet: keep combatants HIDDEN) vs 'fighting'/terminal (countdown
   * finished: REVEAL) - and presentation must not infer it itself (A7:
   * the engine is the authority).
   */
  phase: TurnBattleState
  /** Chi co mat khi battle.state === 'countdown'; 0->1 het 3s countdown. */
  countdownProgress?: number
}

/** Turn-Based Wave Redesign (2026-09-06) - trang thai hien thi cua 1 quai dang telegraph. */
export interface PendingSpawnVisualState {
  id: string
  row: number
  column: number
  isBoss: boolean
  /** 0 = vua queue, 1 = sap materialize (tick ke tiep vao battle.enemies). */
  progress: number
  presetId: EnemySpawnVfxPresetId
}

function toPendingSpawnVisualState(pending: PendingEnemySpawn): PendingSpawnVisualState {
  const position = entityGridPosition(pending.participant.entity)
  const entity = pending.participant.entity

  let presetId: EnemySpawnVfxPresetId = 'enemy_spawn'

  if (entity.isBoss) {
    presetId = 'boss_spawn'
  } else if (entity.isElite) {
    presetId = 'elite_spawn'
  }

  return {
    id: pending.participant.id,
    row: position.row,
    column: position.column,
    isBoss: entity.isBoss ?? false,
    progress: 1 - pending.ticksRemaining / pending.totalTicks,
    presetId,
  }
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
    currentMp: participant.entity.currentMp,
    maxMp: participant.entity.stats.maxMp,
    alive: participant.entity.alive,
    // Fix round 1 (Task 5 review) - CombatEntity.isBoss la optional (chi set
    // cho enemy spawn qua legacy spawner); mac dinh false khop voi cach
    // legacy/BattleSystem.ts (dong 621/810/831) da coerce isBoss ?? false
    // khi build EnemySpawnedEvent, giu nhat quan 2 nguon du lieu.
    isBoss: participant.entity.isBoss ?? false,
  }
}

export function buildTurnBattleEntitySnapshot(battle: TurnBattle): TurnBattleEntitySnapshotEvent {
  return {
    players: battle.players.map(toVisualState),
    enemies: battle.enemies.map(toVisualState),
    pendingEnemySpawns: (battle.wave?.pendingEnemySpawns ?? []).map(toPendingSpawnVisualState),
    phase: battle.state,
    countdownProgress:
      battle.state === 'countdown' && battle.countdownTurnsRemaining !== undefined
        ? 1 - battle.countdownTurnsRemaining / COUNTDOWN_TOTAL_TICKS
        : undefined,
  }
}

// Combat Art Pipeline (2026-09-05) - thay the bridge 'positions' da chet cua
// legacy real-time engine (legacy/BattleSystem.ts khong con duoc tick cho
// turn-based combat). Doc TRUC TIEP tu TurnBattle.players/enemies moi fixed
// step trong luc 'fighting' - khong phu thuoc emitPositions()/update() cua
// legacy engine. GameManager goi ham nay (Task 5 se noi CombatScene nghe).
export function emitTurnBattleEntitySnapshot(eventBus: EventBus, battle: TurnBattle): void {
  eventBus.emit('turn_battle_entity_snapshot', buildTurnBattleEntitySnapshot(battle))
}
