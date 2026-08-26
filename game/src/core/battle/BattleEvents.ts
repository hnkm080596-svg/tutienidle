// Event carry vị trí/kết thúc trận — nguồn DUY NHẤT để view (Phaser
// MainScene.ts) biết vị trí player/quái, KHÔNG được cầm tham chiếu
// trực tiếp GameManager/BattleSystem (xem ghi chú kiến trúc trong kế
// hoạch: core ↔ Phaser chỉ giao tiếp qua EventBus).

import type { LaneIndex } from './BattleLane'
import type { CellArea, GridPosition } from './BattleGrid'
import type {
  ActionTargetingShape,
  CombatVfxPresetId,
  EnemySpawnVfxPresetId,
  PlayerSpawnVfxPresetId,
} from './CombatAction'

export interface BattlePositionsEvent {
  type: 'positions'
  mode?: 'combat' | 'tribulation'

  playerX: number

  /**
   * Row thật của avatar Player (plan §2.2) — teleport đổi row tức thời,
   * renderer snap sprite tới projected cell mới.
   */
  playerRow: LaneIndex

  playerCurrentHp: number

  playerMaxHp: number

  /**
   * Targetability (plan §5.4) — false khi Player đang chờ telegraph
   * spawn; renderer KHÔNG hiện sprite Player trong trạng thái này.
   */
  playerMaterialized: boolean

  /**
   * Telegraph spawn của avatar Player tại projected cell — vẽ VFX
   * telegraph rồi materialize sprite khi biến mất khỏi snapshot.
   */
  playerSpawn?: {
    row: LaneIndex
    column: number
    progress: number
    presetId: PlayerSpawnVfxPresetId
  }

  // Chỉ gồm quái CÒN SỐNG — quái chết tự "biến mất" khỏi payload,
  // MainScene coi đó là tín hiệu ngừng cập nhật vị trí (đóng băng
  // cho tween chết chạy), khỏi cần thêm cờ alive riêng. `lane` chỉ để
  // MainScene tính vị trí Y hiển thị — không ảnh hưởng combat.
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
   * Spawn telegraph (2026-08-24) — quái đang đếm ngược "telegraph → xuất
   * hiện". Dùng SNAPSHOT (không chỉ event tức thời) để hiệu ứng không mất
   * khi CombatScene vừa khởi tạo, resize giữa animation, auto-repeat bắt
   * đầu trận mới trong cùng scene, hay 1 frame nhận nhiều event vị trí.
   * `progress` ∈ [0,1] — 0 mới đặt lịch, 1 sắp materialize. Renderer
   * reconcile theo `id`: id biến mất khỏi mảng = materialize xong.
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

/** Teleport AI (plan §7.3) — phát TRƯỚC attack/cast cùng tick để renderer
 * snap sprite ngay và gắn VFX sau này qua hook placeholder. */
export interface PlayerTeleportedEvent {
  type: 'player_teleported'
  sourceId: string
  from: GridPosition
  to: GridPosition
}

export interface BattleEndEvent {
  type: 'battle_end'

  state: 'victory' | 'defeat'
}

export interface BattleRewardParticleEvent {
  sourceId: string
  kind: 'item' | 'insight' | 'currency'
  color: number
}

// ================= Combat Grid Rework (2026-08-24) =================

/**
 * ĐÚNG MỘT event cho mỗi lần action áp damage (dù trúng 1 hay 20 enemy).
 * Renderer dùng anchorCell + presetId để đặt MỘT VFX chính tại tâm ô
 * primary target; affectedTargetIds chỉ phục vụ hit-flash/UI — KHÔNG sinh
 * bản sao effect theo target.
 */
export interface ActionImpactEvent {
  type: 'action_impact'

  actionId: string

  /** Lần chạy cụ thể (mỗi windup hoàn tất = 1 instance mới). */
  actionInstanceId: string

  sourceId: string

  primaryTargetId: string

  /** Ô neo VFX — snapshot vị trí primary target tại thời điểm impact. */
  anchorCell: GridPosition

  affectedTargetIds: string[]

  landedTargetIds: string[]

  dodgedTargetIds: string[]

  affectedArea: CellArea & { shape: ActionTargetingShape }

  /** Số hit lên mỗi target (multi-hit) — preset dùng để đếm pulse. */
  hitCount: number

  presetId: CombatVfxPresetId
}

/** DOT/persistent status VFX gắn THEO TARGET — dedupe theo
 * (targetId + dotType + source), reapply = refresh, không spawn mới mỗi tick. */
export interface StatusVfxAttachedEvent {
  type: 'status_vfx_attached'

  statusInstanceId: string

  targetId: string

  dotType: string

  stacks: number

  durationSeconds: number
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

  /** Target chết / cleanse / hết hạn — renderer tự dọn đúng instance. */
  reason: 'expired' | 'cleansed' | 'target_dead'
}
