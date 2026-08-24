// Combat Grid Rework — hệ impact THỐNG NHẤT:
// - Basic attack (player/enemy): schedule với windupSeconds, tick đếm
//   ngược, hết giờ → snapshot anchor cell (on_impact) → resolve từng hit.
// - Player skill: cast layer (castTime) đã là windup — khi resolve effects,
//   BattleSystem mở MỘT batch, mỗi fireHit() resolve ngay và đăng ký target;
//   endBatch() phát ĐÚNG MỘT action_impact neo tại ô của primary target.
// Gameplay không phụ thuộc VFX/Phaser — event chỉ mang dữ liệu grid.
import type { EventBus } from '../events/EventBus'
import type { Battle } from './Battle'
import type { CombatEntity } from '../combat/CombatEntity'
import type { SkillDamageComponent } from '../skill/SkillDamageComponent'
import type { CombatVfxPresetId } from './CombatAction'
import type { ActionTargetingShape } from './CombatAction'
import { getCellsInArea, worldToGridPosition, type CellArea, type GridPosition } from './BattleGrid'

/** Thay thế MissileDamageInfo — cùng shape, tên trung lập hành động. */
export type ActionDamageInfo =
  | { kind: 'physical' | 'primordial'; multiplier: number }
  | { kind: 'elemental'; components: SkillDamageComponent[]; multiplier: number }

export function scaleActionDamage(
  info: ActionDamageInfo,
  percent: number,
): ActionDamageInfo {
  if (info.kind === 'elemental') {
    return { kind: 'elemental', components: info.components, multiplier: info.multiplier * percent }
  }

  return { kind: info.kind, multiplier: info.multiplier * percent }
}

export interface HitResolveOptions {
  /** undefined = hệ thống tự roll tại thời điểm resolve. */
  critical?: boolean

  skillId?: string

  knockbackDistance?: number

  /** false = mục tiêu phụ trong AOE (áp secondaryPercent). */
  isPrimary: boolean
}

export type ResolveOneHitFn = (
  battle: Battle,
  source: CombatEntity,
  target: CombatEntity,
  damage: ActionDamageInfo,
  options: HitResolveOptions,
) => { landed: boolean }

export interface ScheduledBasicImpact {
  actionId: string

  sourceId: string

  targetId: string

  damage: ActionDamageInfo

  skillId?: string

  presetId: CombatVfxPresetId

  windupSeconds: number

  hitCount?: number

  knockbackDistance?: number
}

interface PendingImpact extends ScheduledBasicImpact {
  actionInstanceId: string

  windupRemaining: number
}

interface SkillBatchMeta {
  actionId: string

  sourceId: string

  primaryTargetId: string

  presetId: CombatVfxPresetId

  anchorCell: GridPosition

  area: CellArea & { shape: ActionTargetingShape }

  hitCount: number

  secondaryPercent?: number

  knockbackDistance?: number
}

interface OpenBatch {
  meta: SkillBatchMeta

  /** Giữ THỨ TỰ — primary được đăng ký trước nên đứng đầu payload. */
  affectedIds: string[]

  landedIds: string[]

  dodgedIds: string[]
}

let instanceCounter = 0

export class ActionImpactSystem {
  private pending: PendingImpact[] = []
  private batch: OpenBatch | null = null

  constructor(private readonly deps: { eventBus: EventBus; rollCritical: (source: CombatEntity, target: CombatEntity) => boolean }) {}

  /** Basic attack/enemy attack — windup trôi theo tick battle fixed-step. */
  scheduleBasic(entry: ScheduledBasicImpact): void {
    const actionInstanceId = `act-${++instanceCounter}`

    this.pending.push({
      ...entry,
      actionInstanceId,
      windupRemaining: entry.windupSeconds,
    })

    // Hook animation/UI cũ ('attack' phát tại thời điểm BẮT ĐẦU đòn —
    // giờ là lúc bắt đầu windup thay vì lúc projectile rời nòng).
    this.deps.eventBus.emit('attack', {
      type: 'attack',
      sourceId: entry.sourceId,
      targetId: entry.targetId,
      skillId: entry.skillId,
    } as never)
  }

  beginSkillBatch(meta: SkillBatchMeta): void {
    this.batch = { meta, affectedIds: [meta.primaryTargetId], landedIds: [], dodgedIds: [] }

    this.deps.eventBus.emit('attack', {
      type: 'attack',
      sourceId: meta.sourceId,
      targetId: meta.primaryTargetId,
      actionId: meta.actionId,
    } as never)
  }

  /**
   * Một HIT riêng lẻ trong batch skill — tự roll crit/dodge/on-hit đầy đủ
   * qua resolveOneHit do BattleSystem cấp (giữ nguyên pipeline Kiếm Ý/
   * Momentum/Break/knockback/passive/reward cũ).
   */
  fireSkillHit(
    battle: Battle,
    source: CombatEntity,
    target: CombatEntity,
    damage: ActionDamageInfo,
    options: Omit<HitResolveOptions, 'isPrimary'> & { isPrimary?: boolean },
    resolveOneHit: ResolveOneHitFn,
  ): { landed: boolean } {
    if (!target.alive || !source.alive) {
      return { landed: false }
    }

    const isPrimary = options.isPrimary ?? target.id === this.batch?.meta.primaryTargetId
    const critical = options.critical ?? this.deps.rollCritical(source, target)
    const secondaryPercent = this.batch?.meta.secondaryPercent

    const scaled = !isPrimary && secondaryPercent !== undefined
      ? scaleActionDamage(damage, secondaryPercent)
      : damage

    const result = resolveOneHit(battle, source, target, scaled, {
      ...options,
      critical,
      isPrimary,
      knockbackDistance: options.knockbackDistance ?? this.batch?.meta.knockbackDistance,
    })

    if (this.batch && !this.batch.affectedIds.includes(target.id)) {
      this.batch.affectedIds.push(target.id)
    }

    const resultIds = result.landed ? this.batch?.landedIds : this.batch?.dodgedIds

    if (resultIds && !resultIds.includes(target.id)) {
      resultIds.push(target.id)
    }

    return result
  }

  endSkillBatch(battle: Battle): void {
    void battle
    const batch = this.batch
    this.batch = null

    if (!batch || batch.affectedIds.length === 0) {
      return
    }

    this.deps.eventBus.emit('action_impact', {
      type: 'action_impact',
      actionId: batch.meta.actionId,
      actionInstanceId: `act-${++instanceCounter}`,
      sourceId: batch.meta.sourceId,
      primaryTargetId: batch.meta.primaryTargetId,
      anchorCell: batch.meta.anchorCell,
      affectedTargetIds: [...batch.affectedIds],
      landedTargetIds: [...batch.landedIds],
      dodgedTargetIds: [...batch.dodgedIds],
      affectedArea: batch.meta.area,
      hitCount: batch.meta.hitCount,
      presetId: batch.meta.presetId,
    })
  }

  tick(
    battle: Battle,
    deltaSeconds: number,
    resolveOneHit: ResolveOneHitFn,
  ): void {
    if (this.pending.length === 0) {
      return
    }

    for (const entry of this.pending) {
      entry.windupRemaining -= deltaSeconds
    }

    const ready = this.pending.filter(entry => entry.windupRemaining <= 0)

    this.pending = this.pending.filter(entry => entry.windupRemaining > 0)

    for (const entry of ready) {
      const source = entry.sourceId === battle.player.id
        ? battle.player
        : battle.enemies.find(item => item.entity.id === entry.sourceId)?.entity
      const target = entry.targetId === battle.player.id
        ? battle.player
        : battle.enemies.find(item => item.entity.id === entry.targetId)?.entity

      if (!source || !target || !source.alive || !target.alive) {
        continue
      }

      // Snapshot anchor NGAY tại thời điểm impact (policy 'on_impact').
      const anchorCell = worldToGridPosition(target.x, target.row + 0.5)
      const hitCount = entry.hitCount ?? 1
      const affectedIds: string[] = [entry.targetId]
      let landed = false

      for (let hitIndex = 0; hitIndex < hitCount; hitIndex++) {
        const result = resolveOneHit(battle, source, target, entry.damage, {
          critical: this.deps.rollCritical(source, target),
          skillId: entry.skillId,
          knockbackDistance: entry.knockbackDistance,
          isPrimary: true,
        })
        landed ||= result.landed
      }

      this.deps.eventBus.emit('action_impact', {
        type: 'action_impact',
        actionId: entry.actionId,
        actionInstanceId: entry.actionInstanceId,
        sourceId: entry.sourceId,
        primaryTargetId: entry.targetId,
        anchorCell,
        affectedTargetIds: affectedIds,
        landedTargetIds: landed ? affectedIds : [],
        dodgedTargetIds: landed ? [] : affectedIds,
        affectedArea: { ...getCellsInArea(anchorCell, 0, 0), shape: 'single' },
        hitCount,
        presetId: entry.presetId,
      })
    }
  }

  clear(): void {
    this.pending = []
    this.batch = null
  }
}
