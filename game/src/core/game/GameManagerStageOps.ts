import type { Enemy } from '../enemy/Enemy'
import type { EnemyArchetype } from '../enemy/EnemyArchetype'
import type { PlayerData } from '../player/Player'
import type { Stage } from '../stage/Stage'
import type { ZoneRegistry } from '../stage/ZoneRegistry'
import type { AmountRange, DropEntry, GuaranteedDropEntry, StageDropTable } from '../drop/DropTable'
import type { TemplateRegistry } from './TemplateRegistry'
import { stageDropTableFor } from '../../data/drop/StageDropTables'

/**
 * Stage surface read-model (BETA SCOPE LOCK v2 work-order section 9) - the ONE
 * place presentation layers read "what does this stage node look like
 * and what may the player do with it". Frontend must not reconstruct
 * unlock/eligibility rules; everything here delegates to the owning
 * authority (catalogOps unlock/lock-reason, stageWaves admission probe,
 * autoFarmOps eligibility contract, the stage drop-table data).
 * STRICTLY ADDITIVE - no existing accessor changes shape.
 */

export type StageSurfaceState =
  | 'locked'
  | 'current'
  | 'available'
  | 'completed'
  | 'perfect'

/**
 * Why a stage surface is not startable, in precedence order: the lock
 * reason (same union catalogOps.stageLockReasonCode returns), else
 * 'busy' while the single stage slot is held by another run or a farm.
 */
export type StageSurfaceDisabledReason =
  | { kind: 'realm'; realmId: string; realmLevel: number }
  | { kind: 'floor'; floor: number }
  | { kind: 'progress' }
  | { kind: 'busy' }

export interface StageSurfaceDisplayEnemy {
  id: string
  name: string
  level: number
  archetype?: EnemyArchetype
}

export interface StageSurfaceRewardPreview {
  spiritStone: AmountRange
  techniqueMastery: AmountRange
  /** Always-granted entries (chance = 1 means always). */
  guaranteed: GuaranteedDropEntry[]
  /** Drawn entries with weights stripped - a hint list, not odds. */
  poolItems: DropEntry[]
}

export interface StageSurfaceModel {
  stageId: string
  /** 1-based act index (stage.chapter). */
  act?: number
  realmId?: string
  floor?: number
  state: StageSurfaceState
  isBossFloor: boolean
  /** Boss template on boss floors, else the dominant pool species. */
  displayEnemy: StageSurfaceDisplayEnemy | undefined
  rewardPreview: StageSurfaceRewardPreview | undefined
  /** True when the stage satisfies the auto-farm eligibility contract. */
  autoFarmAvailable: boolean
  /** True when start() would admit this (player, stage) right now. */
  startAvailable: boolean
  /** null when the node is both unlocked and startable. */
  disabledReason: StageSurfaceDisabledReason | null
}

export interface GameManagerStageOpsDeps {
  stageTemplates: TemplateRegistry<Stage>
  zoneRegistry: ZoneRegistry
  enemyTemplates: TemplateRegistry<Enemy>
  // The unlock authority (catalogOps.isStageUnlocked /
  // stageLockReasonCode) - injected so the gates stay single-owner.
  isStageUnlocked: (stageId: string, player: PlayerData) => boolean
  stageLockReasonCode: (
    stageId: string,
    player: PlayerData,
  ) => { kind: 'realm'; realmId: string; realmLevel: number } | { kind: 'floor'; floor: number } | { kind: 'progress' } | null
  // The real admission probe (stageWaves.canStart) - the model never
  // re-derives start gates.
  canStart: (player: PlayerData, stage: Stage) => boolean
  // The auto-farm eligibility authority (autoFarmOps).
  isAutoFarmStageEligible: (player: PlayerData, stageId: string) => boolean
}

export class GameManagerStageOps {
  constructor(private readonly deps: GameManagerStageOpsDeps) {}

  /**
   * The read-model for one stage; undefined when the id is not a
   * registered stage (same convention as catalogOps.getStage).
   */
  getStageSurfaceModel(stageId: string, player: PlayerData): StageSurfaceModel | undefined {
    const stage = this.deps.stageTemplates.get(stageId)
    if (!stage) {
      return undefined
    }

    return this.modelFor(stage, player)
  }

  /** All registered stages, in zone order then standalone stages. */
  getStageSurfaceModels(player: PlayerData): StageSurfaceModel[] {
    const ordered: Stage[] = []
    const inZone = new Set<string>()

    for (const zone of this.deps.zoneRegistry.getAll()) {
      for (const stageId of zone.stageIds) {
        const stage = this.deps.stageTemplates.get(stageId)
        if (stage) {
          ordered.push(stage)
          inZone.add(stageId)
        }
      }
    }

    for (const stage of this.deps.stageTemplates.getAll()) {
      if (!inZone.has(stage.id)) {
        ordered.push(stage)
      }
    }

    const frontier = this.computeFrontier(player)
    return ordered.map((stage) => this.withFrontier(stage, player, frontier))
  }

  /** 'current' frontier stage ids: first unlocked-uncompleted per zone. */
  private computeFrontier(player: PlayerData): Set<string> {
    const frontier = new Set<string>()

    for (const zone of this.deps.zoneRegistry.getAll()) {
      for (const stageId of zone.stageIds) {
        if (
          !player.completedStageIds.includes(stageId) &&
          this.deps.isStageUnlocked(stageId, player)
        ) {
          frontier.add(stageId)
          break
        }
      }
    }

    return frontier
  }

  private surfaceState(
    stage: Stage,
    player: PlayerData,
    unlocked: boolean,
    frontier?: Set<string>,
  ): StageSurfaceState {
    if (player.perfectClearStageIds.includes(stage.id)) {
      return 'perfect'
    }
    if (player.completedStageIds.includes(stage.id)) {
      return 'completed'
    }
    if (!unlocked) {
      return 'locked'
    }
    const front = frontier ?? this.computeFrontier(player)
    return front.has(stage.id) ? 'current' : 'available'
  }

  private withFrontier(stage: Stage, player: PlayerData, frontier: Set<string>): StageSurfaceModel {
    return this.modelFor(stage, player, frontier)
  }

  /** The model for one stage; `frontier` is precomputed by the list path. */
  private modelFor(stage: Stage, player: PlayerData, frontier?: Set<string>): StageSurfaceModel {
    const unlocked = this.deps.isStageUnlocked(stage.id, player)
    const lockReason = this.deps.stageLockReasonCode(stage.id, player)
    const startAvailable = this.deps.canStart(player, stage)

    return {
      stageId: stage.id,
      act: stage.chapter,
      realmId: stage.requiredRealmId,
      floor: stage.floor ?? stage.requiredRealmLevel,
      state: this.surfaceState(stage, player, unlocked, frontier),
      isBossFloor:
        stage.bossEnemyId !== undefined && (stage.floor ?? stage.requiredRealmLevel) === 10,
      displayEnemy: this.displayEnemyFor(stage),
      rewardPreview: this.rewardPreviewFor(stage),
      autoFarmAvailable: this.deps.isAutoFarmStageEligible(player, stage.id),
      startAvailable,
      disabledReason: lockReason ?? (startAvailable ? null : { kind: 'busy' }),
    }
  }

  /**
   * The face of the node: floor-10 boss template, else the dominant
   * (highest-weight) pool entry - with single-species roster pools this
   * is simply the band species. Undefined when no template resolves.
   */
  private displayEnemyFor(stage: Stage): StageSurfaceDisplayEnemy | undefined {
    if (stage.bossEnemyId) {
      const boss = this.deps.enemyTemplates.get(stage.bossEnemyId)
      if (boss) {
        return this.toDisplayEnemy(boss)
      }
    }

    const dominant = [...stage.enemyPool].sort((a, b) => b.weight - a.weight)[0]
    const template = dominant ? this.deps.enemyTemplates.get(dominant.enemyId) : undefined
    return template ? this.toDisplayEnemy(template) : undefined
  }

  private toDisplayEnemy(enemy: Enemy): StageSurfaceDisplayEnemy {
    return {
      id: enemy.id,
      name: enemy.name,
      level: enemy.level,
      archetype: enemy.archetype,
    }
  }

  /**
   * Per-kill reward hint built from the stage drop-table data (currency
   * ranges + guaranteed/pool entries, weights stripped). Undefined when
   * no table covers the stage's realm/floor.
   */
  private rewardPreviewFor(stage: Stage): StageSurfaceRewardPreview | undefined {
    const table: StageDropTable | undefined = stageDropTableFor(
      stage.requiredRealmId,
      stage.floor ?? stage.requiredRealmLevel,
    )
    if (!table) {
      return undefined
    }

    return {
      spiritStone: table.currency.spiritStone,
      techniqueMastery: table.currency.techniqueMastery,
      // Copies: the model hands presentation a snapshot, not live
      // references into the shared drop-table literals.
      guaranteed: [...table.guaranteed],
      poolItems: table.pool.map(({ weight: _weight, ...entry }) => ({ ...entry })),
    }
  }
}
