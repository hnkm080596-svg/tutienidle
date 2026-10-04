// Event carry vi tri/ket thuc tran - nguon DUY NHAT de view (Phaser
// MainScene.ts) biet vi tri player/quai, KHONG duoc cam tham chieu
// truc tiep GameManager/BattleSystem (xem ghi chu kien truc trong ke
// hoach: core <-> Phaser chi giao tiep qua EventBus).

import type { LaneIndex } from './BattleLane'
import type { CellArea, GridPosition } from './BattleGrid'
import type {
  ActionTargetingShape,
  CombatVfxPresetId,
  EnemySpawnVfxPresetId,
  PlayerSpawnVfxPresetId,
} from './CombatAction'
import type { ArtifactId } from '../artifact/Artifact'

/**
 * Ban Menh Phap Bao (2026-08-27, foundation-artifact-system-plan.md
 * sec11) - attribution AN TOAN cho 1 action_impact, de renderer chon
 * VFX dung nguon va summary ghi dung damage artifact. Threading hien
 * CHI that su set o nhanh 'artifact' (ArtifactSystem.ts - dormant, M13) - basic
 * attack/skill/enemy van nhan dien qua field cu (HitResolveOptions.
 * skillId, sourceId so voi battle.player.id) nen KHONG can backfill
 * origin cho cac nhanh do ngay bay gio; union du 4 kind de mo rong
 * dan khong phai doi shape lan nua.
 */
export type CombatActionOrigin =
  | { kind: 'basic_attack' }
  | { kind: 'skill'; skillId: string }
  | { kind: 'artifact'; artifactId: ArtifactId }
  | { kind: 'enemy'; enemyId: string }

export interface BattlePositionsEvent {
  type: 'positions'
  mode?: 'combat'

  playerX: number

  /**
   * Row that cua avatar Player (plan sec2.2) - teleport doi row tuc thoi,
   * renderer snap sprite toi projected cell moi.
   */
  playerRow: LaneIndex

  playerCurrentHp: number

  playerMaxHp: number

  /**
   * Targetability (plan sec5.4) - false khi Player dang cho telegraph
   * spawn; renderer KHONG hien sprite Player trong trang thai nay.
   */
  playerMaterialized: boolean

  /**
   * Telegraph spawn cua avatar Player tai projected cell - ve VFX
   * telegraph roi materialize sprite khi bien mat khoi snapshot.
   */
  playerSpawn?: {
    row: LaneIndex
    column: number
    progress: number
    presetId: PlayerSpawnVfxPresetId
  }

  // Chi gom quai CON SONG - quai chet tu "bien mat" khoi payload,
  // MainScene coi do la tin hieu ngung cap nhat vi tri (dong bang
  // cho tween chet chay), khoi can them co alive rieng. `lane` chi de
  // MainScene tinh vi tri Y hien thi - khong anh huong combat.
  enemies: {
    id: string
    name: string
    x: number
    row: LaneIndex
    currentHp: number
    maxHp: number
    isBoss: boolean
  }[]

  /**
   * Spawn telegraph (2026-08-24) - quai dang dem nguoc "telegraph -> xuat
   * hien". Dung SNAPSHOT (khong chi event tuc thoi) de hieu ung khong mat
   * khi CombatScene vua khoi tao, resize giua animation, auto-repeat bat
   * dau tran moi trong cung scene, hay 1 frame nhan nhieu event vi tri.
   * `progress` in [0,1] - 0 moi dat lich, 1 sap materialize. Renderer
   * reconcile theo `id`: id bien mat khoi mang = materialize xong.
   */
  spawningEnemies?: {
    id: string
    name: string
    row: LaneIndex
    column: number
    progress: number
    isBoss: boolean
    presetId: EnemySpawnVfxPresetId
  }[]
}

export interface BattleEndEvent {
  type: 'battle_end'

  state: 'victory' | 'defeat'
}

/**
 * kind 'essence' (2026-08-30) - Tinh Hoa Pham The roi tu quai: chuoi
 * particle bay thang VE NGUOI CHOI (khong ve ho lo), mote cuoi cham
 * nguoi choi moi nap tien do Luyen The (xem combat-essence-stream.ts +
 * App.vue essenceArrivals drain). Rendering tu huy khi scene khong
 * active - chi la presentation, bo qua khong mat loot.
 */
export interface BattleRewardParticleEvent {
  sourceId: string
  kind: 'item' | 'insight' | 'currency' | 'essence'
  color: number
}

/** Event scene -> App.vue khi chuoi essence hoan tat (1 lan/drop event). */
export const ESSENCE_STREAM_ARRIVAL_EVENT = 'essence_stream_arrival'

// ================= Combat Grid Rework (2026-08-24) =================

/**
 * Exactly ONE event per action's damage application (whether it lands on
 * 1 or 20 enemies). The renderer uses anchorCell + presetId to place ONE
 * primary VFX at the primary target's cell; affectedTargetIds only feeds
 * hit-flash/UI - it does NOT spawn per-target effect copies.
 * Observation feed - no production subscribers (design section 12); skill
 * presentation runs on skill_presentation_cast/_resolved instead.
 */
export interface ActionImpactEvent {
  type: 'action_impact'

  actionId: string

  /** Lan chay cu the (moi windup hoan tat = 1 instance moi). */
  actionInstanceId: string

  sourceId: string

  primaryTargetId: string

  /** O neo VFX - snapshot vi tri primary target tai thoi diem impact. */
  anchorCell: GridPosition

  affectedTargetIds: string[]

  landedTargetIds: string[]

  dodgedTargetIds: string[]

  affectedArea: CellArea & { shape: ActionTargetingShape }

  /** So hit len moi target (multi-hit) - preset dung de dem pulse. */
  hitCount: number

  presetId: CombatVfxPresetId

  /** Ban Menh Phap Bao - undefined = basic attack/skill/enemy nhu cu. */
  origin?: CombatActionOrigin
}

/** DOT/persistent status VFX gan THEO TARGET - dedupe theo
 * (targetId + dotType + source), reapply = refresh, khong spawn moi moi tick. */
export interface StatusVfxAttachedEvent {
  type: 'status_vfx_attached'

  statusInstanceId: string

  targetId: string

  dotType: string

  stacks: number

  durationSeconds: number

  /** Buff bar (2026-09-02) - ten hien thi (tooltip/floating text). */
  buffName?: string

  /** Buff bar - mau placeholder xanh/do + hinh circle/diamond. */
  polarity?: 'buff' | 'debuff'

  /** Buff bar - duration Infinity -> hang permanent, khong timer. */
  permanent?: boolean

  /** Periodic-damage flag - lets audio/VFX tell a real DoT from a plain buff/debuff (dotType alone is just a definitionId). */
  periodicDamage?: boolean
}

export interface StatusVfxUpdatedEvent {
  type: 'status_vfx_updated'

  statusInstanceId: string

  stacks: number

  durationSeconds: number
}

export interface StatusVfxRemovedEvent {
  type: 'status_vfx_removed'

  statusInstanceId: string

  /** Target chet / cleanse / het han - renderer tu don dung instance. */
  reason: 'expired' | 'cleansed' | 'target_dead'
}

// Canonical-seals S5.3 -- elemental-reaction observation feed. Drained
// from the scheduler event journal at the post-step boundary by
// GameManagerTurnBattleOps and re-emitted here; observational only --
// the renderer floats the payoff name, it never decides anything.
export interface ReactionVfxResolvedEvent {
  type: 'reaction_resolved'

  reactionId: string

  relation: 'sinh' | 'khac'

  sourceId: string

  targetId: string

  /** Pre-consume snapshot -- which seals the reaction consumed. */
  consumed: readonly { buffId: string; stacks: number }[]
}

/** reaction_skipped rides the bus for tooling/tests; the scene renders
    nothing for it (a stale-snapshot skip carries no player signal). */
export interface ReactionVfxSkippedEvent {
  type: 'reaction_skipped'

  reactionId: string

  reason: 'stale_reaction_snapshot'
}
