// Combat Grid Rework (2026-08-24) — hệ action THỐNG NHẤT thay
// MissileSystem: player basic attack, player skill, enemy attack,
// enemy/boss skill… đều đi cùng một pipeline windup → impact → resolve.
// Gameplay KHÔNG phụ thuộc VFX hay Phaser callback — core emit đúng MỘT
// event `action_impact` cho mỗi lần action áp sát thương, renderer đọc
// preset để diễn xuất.
import { GRID_COLUMN_COUNT } from './BattleGrid'

/** Hình dạng chọn vùng ảnh hưởng (decision 2026-08-24: shape union). */
export type ActionTargetingShape = 'single' | 'area' | 'line' | 'all_lanes'

export type TargetSelectionMode = 'nearest' | 'lowest_hp' | 'highest_hp'

/**
 * Targeting đo hoàn toàn bằng đơn vị GRID (cột/hàng) — plan §2.6: KHÔNG
 * còn targeting range riêng cho skill, tầm thi triển thực tế luôn là
 * `attackRange` của entity (Chebyshev với Player, column tới cổng với
 * enemy). Interface này CHỈ chuẩn hoá shape/AOE quanh primary target:
 * - shape 'area' dùng laneRadius/columnRadius quanh primary target
 *   (radius 0 = chỉ hàng/cột của anchor; n = mở rộng n ô mỗi phía, clamp biên).
 * - shape 'line'  = toàn bộ hàng của primary target.
 * - shape 'all_lanes' = dải cột [anchor.col ± columnRadius] trên MỌI hàng.
 * - maxTargets: giới hạn số enemy trúng (cân bằng).
 */
export interface ActionTargeting {
  shape: ActionTargetingShape
  laneRadius?: number
  columnRadius?: number
  maxTargets?: number
  selection?: TargetSelectionMode
}

export function targetingForSkill(skill: {
  target: string
  targeting?: ActionTargeting
  laneRadius?: number
  columnRadius?: number
}): ActionTargeting {
  if (skill.targeting) {
    return skill.targeting
  }

  if (skill.target === 'all_enemies') {
    return { shape: 'all_lanes', columnRadius: GRID_COLUMN_COUNT }
  }

  const laneRadius = skill.laneRadius ?? 0
  const columnRadius = skill.columnRadius ?? 0

  return {
    shape: laneRadius > 0 || columnRadius > 0 ? 'area' : 'single',
    laneRadius,
    columnRadius,
  }
}

/** Windup = thời gian từ lúc bắt đầu animation tới IMPACT. Không còn thời gian bay. */
export interface CombatActionTiming {
  windupSeconds: number
  recoverySeconds?: number
}

/**
 * Scope của một SkillEffect trong action:
 * - 'source': buff/heal bản thân — chỉ chạy MỘT LẦN mỗi impact.
 * - 'primary_target': debuff/đánh dấu chỉ áp mục tiêu chính.
 * - 'affected_targets': damage/AOE chạy trên toàn target set.
 */
export type EffectScope = 'source' | 'primary_target' | 'affected_targets'

/** Multi-hit: kết quả ổn định theo snapshot lúc impact (mặc định). */
export type MultiHitTargetPolicy = 'on_impact' | 'each_hit'

/**
 * Định nghĩa action thống nhất — player skill và enemy attack đều được
 * chuẩn hóa về shape này khi chạy (enemy archetype tự sinh def mặc định).
 */
export interface CombatActionDefinition {
  id: string

  /** Component sát thương — resolve từng hit qua CombatSystem pipeline đầy đủ. */
  damage: Array<{
    element?: string
    percent?: number
    flat?: number
  }>

  targeting: ActionTargeting

  timing: CombatActionTiming

  /** Số hit lên từng target (mỗi hit tự roll crit/dodge/on-hit). */
  hitCount?: number

  multiHitTargetPolicy?: MultiHitTargetPolicy

  vfxPresetId: string
}

/** Id preset VFX impact — renderer đăng ký diễn xuất tương ứng. */
export type CombatVfxPresetId =
  | 'slash'
  | 'claw'
  | 'arcane_impact'
  | 'fire_burst'
  | 'water_surge'
  | 'earth_shockwave'
  | 'metal_slash'
  | 'wood_spikes'
  | 'lightning_strike'
  | 'wind_blade'
  | 'holy_radiance'
  | 'shadow_burst'
  | 'boss_ground_slam'
  // Kiếm Tu Bạt Kiếm/Kiếm Trận (Task 8, 2026-08-28) — DATA ONLY, art/
  // animation sau (renderer chưa đăng ký diễn xuất tương ứng).
  | 'tu_luc'
  | 'bat_kiem_quat'
  | 'kiem_tran_zone'

/**
 * Id preset VFX telegraph spawn quái (luồng "telegraph → xuất hiện →
 * tham chiến") — renderer đăng ký diễn xuất theo cấp bậc quái.
 */
export type EnemySpawnVfxPresetId = 'enemy_spawn' | 'elite_spawn' | 'boss_spawn'

/**
 * Id preset VFX telegraph spawn Player (plan §5.3) — contract RIÊNG với
 * enemy spawn để renderer phân biệt preset và không giả danh
 * `enemy_spawned`.
 */
export type PlayerSpawnVfxPresetId = 'player_spawn'

/**
 * Map element của skill → preset VFX mặc định. Skill có thể override
 * bằng field `vfxPresetId` riêng.
 */
export function vfxPresetForElement(element: string | undefined): CombatVfxPresetId {
  switch (element) {
    case 'wood':
      return 'wood_spikes'
    case 'fire':
      return 'fire_burst'
    case 'water':
      return 'water_surge'
    case 'earth':
      return 'earth_shockwave'
    case 'metal':
      return 'metal_slash'
    case 'wind':
      return 'wind_blade'
    case 'lightning':
      return 'lightning_strike'
    case 'primordial':
      return 'shadow_burst'
    default:
      return 'arcane_impact'
  }
}

export interface SkillVfxHint {
  element?: string

  vfxPresetId?: CombatVfxPresetId

  /** AOE lan theo hàng quanh primary target (shape 'area' mặc định). */
  laneRadius?: number

  columnRadius?: number
}

export function vfxPresetForSkill(skill: SkillVfxHint): CombatVfxPresetId {
  return skill.vfxPresetId ?? vfxPresetForElement(skill.element)
}
