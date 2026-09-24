// Combat Grid Rework (2026-08-24) -- he action THONG NHAT thay
// MissileSystem: player basic attack, player skill, enemy attack,
// enemy/boss skill... deu di cung mot pipeline windup -> impact -> resolve.
// Gameplay KHONG phu thuoc VFX hay Phaser callback -- core emit dung MOT
// event `action_impact` cho moi lan action ap sat thuong, renderer doc
// preset de dien xuat.
import { GRID_COLUMN_COUNT } from './BattleGrid'

/** Hinh dang chon vung anh huong (decision 2026-08-24: shape union; 2026-09-04: mo rong cross/row/column, doi 'area' -> 'square'). */
export type ActionTargetingShape = 'single' | 'square' | 'cross' | 'line' | 'row' | 'column' | 'all_lanes'

export type TargetSelectionMode = 'nearest' | 'lowest_hp' | 'highest_hp'

/**
 * Targeting do hoan toan bang don vi GRID (cot/hang) -- plan 2.6: KHONG
 * con targeting range rieng cho skill; tam voi do action targeting quyet
 * dinh (stat-system-reimagined Task 3 da retire stat attackRange).
 * Interface nay CHI chuan hoa shape/AOE quanh primary target:
 * - shape 'square' dung laneRadius/columnRadius quanh primary target
 *   (radius 0 = chi hang/cot cua anchor; n = mo rong n o moi phia, clamp bien).
 * - shape 'line'  = toan bo hang cua primary target.
 * - shape 'all_lanes' = dai cot [anchor.col +/- columnRadius] tren MOI hang.
 * - maxTargets: gioi han so enemy trung (can bang).
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
    shape: laneRadius > 0 || columnRadius > 0 ? 'square' : 'single',
    laneRadius,
    columnRadius,
  }
}

/** Windup = thoi gian tu luc bat dau animation toi IMPACT. Khong con thoi gian bay. */
export interface CombatActionTiming {
  windupSeconds: number
  recoverySeconds?: number
}

/**
 * Scope cua mot SkillEffect trong action:
 * - 'source': buff/heal ban than -- chi chay MOT LAN moi impact.
 * - 'primary_target': debuff/danh dau chi ap muc tieu chinh.
 * - 'affected_targets': damage/AOE chay tren toan target set.
 */
export type EffectScope = 'source' | 'primary_target' | 'affected_targets'

/** Multi-hit: ket qua on dinh theo snapshot luc impact (mac dinh). */
export type MultiHitTargetPolicy = 'on_impact' | 'each_hit'

/**
 * Dinh nghia action thong nhat -- player skill va enemy attack deu duoc
 * chuan hoa ve shape nay khi chay (enemy archetype tu sinh def mac dinh).
 */
export interface CombatActionDefinition {
  id: string

  /** Component sat thuong -- resolve tung hit qua CombatSystem pipeline day du. */
  damage: Array<{
    element?: string
    percent?: number
    flat?: number
  }>

  targeting: ActionTargeting

  timing: CombatActionTiming

  /** So hit len tung target (moi hit tu roll crit/dodge/on-hit). */
  hitCount?: number

  multiHitTargetPolicy?: MultiHitTargetPolicy

  vfxPresetId: string
}

/** Id preset VFX impact -- renderer dang ky dien xuat tuong ung. */
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
  // Kiem Tu (Task 8, 2026-08-28) -- DATA ONLY, art/
  // animation sau (renderer chua dang ky dien xuat tuong ung).
  | 'tu_luc'
  // Kiem Tu Reimagined (spec 2026-09-15 4.3, K11) -- one preset per
  // Kiem Pho combo. The fired payload is the ONLY discovery signal, so
  // every combo must render distinguishably; renderer maps each preset
  // to its length-tier base + per-combo name/color signature. DATA
  // ONLY until the presentation pass registers dien xuat.
  | 'kiem_combo_tam_thich' | 'kiem_combo_tam_tram' | 'kiem_combo_tam_phach'
  | 'kiem_combo_tam_lieu' | 'kiem_combo_tam_tao'
  | 'kiem_combo_nhi_thich_nhat_tram' | 'kiem_combo_nhi_thich_nhat_phach'
  | 'kiem_combo_nhi_tram_nhat_thich' | 'kiem_combo_nhi_tram_nhat_phach'
  | 'kiem_combo_nhi_phach_nhat_thich' | 'kiem_combo_nhi_lieu_nhat_thich'
  | 'kiem_combo_nhi_tao_nhat_thich'
  | 'kiem_combo_thich_tram_thich' | 'kiem_combo_tram_thich_tram'
  | 'kiem_combo_phach_thich_phach'
  | 'kiem_combo_thich_tram_phach_thich' | 'kiem_combo_tram_phach_thich_tram'
  | 'kiem_combo_phach_tram_thich_phach' | 'kiem_combo_lieu_tram_thich_lieu'
  | 'kiem_combo_tao_tram_thich_tao' | 'kiem_combo_thich_lieu_tram_thich'
  | 'kiem_combo_thich_tao_tram_thich' | 'kiem_combo_tram_lieu_phach_tram'
  | 'kiem_combo_phach_lieu_tram_phach' | 'kiem_combo_thich_tram_tram_lieu'
  | 'kiem_combo_tram_thich_thich_lieu' | 'kiem_combo_phach_thich_thich_tao'
  | 'kiem_combo_ngu_hanh_kiem' | 'kiem_combo_ngu_hanh_nghich_chuyen'
  | 'kiem_combo_thich_tram_tram_phach_thich'
  | 'kiem_combo_tram_thich_phach_tram_phach'
  | 'kiem_combo_phach_tram_thich_lieu_tao'
  // Three-path design (2026-09-25, ruling #12) -- one preset per Phap Tu
  // element basic. DATA ONLY until the presentation pass registers
  // dien xuat; renderer maps each preset to space/color/scale/shake.
  | 'hoa_cau_comet' | 'thuy_tien_dart' | 'doc_chuong_palm' | 'diem_kim_point' | 'tho_cau_boulder'
  | 'kiem_combo_thich_lieu_phach_tram_tao'
  | 'kiem_combo_tao_tram_thich_phach_lieu'
  | 'kiem_combo_tram_phach_lieu_tao_thich'
  | 'kiem_combo_phach_lieu_tao_thich_tram'
  | 'kiem_combo_lieu_tao_thich_tram_phach'

/**
 * Id preset VFX telegraph spawn quai (luong "telegraph -> xuat hien ->
 * tham chien") -- renderer dang ky dien xuat theo cap bac quai.
 */
export type EnemySpawnVfxPresetId = 'enemy_spawn' | 'elite_spawn' | 'boss_spawn'

/**
 * Id preset VFX telegraph spawn Player (plan 5.3) -- contract RIENG voi
 * enemy spawn de renderer phan biet preset va khong gia danh
 * `enemy_spawned`.
 */
export type PlayerSpawnVfxPresetId = 'player_spawn'

/**
 * Map element cua skill -> preset VFX mac dinh. Skill co the override
 * bang field `vfxPresetId` rieng.
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
    // Spec 2026-08-30-phap-tu-dao-sac 5 -- case 'wind'/'lightning' da
    // xoa cung element; preset wind_blade/lightning_strike khong con
    // duong gan tu element cua skill.
    case 'primordial':
      return 'shadow_burst'
    default:
      return 'arcane_impact'
  }
}

export interface SkillVfxHint {
  element?: string

  vfxPresetId?: CombatVfxPresetId

  /** AOE lan theo hang quanh primary target (shape 'square' mac dinh). */
  laneRadius?: number

  columnRadius?: number
}

export function vfxPresetForSkill(skill: SkillVfxHint): CombatVfxPresetId {
  return skill.vfxPresetId ?? vfxPresetForElement(skill.element)
}
