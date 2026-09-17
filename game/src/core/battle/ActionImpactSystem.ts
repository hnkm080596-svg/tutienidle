// Damage contract module (Mission G - the dormant class API was removed):
// `ActionDamageInfo`, `scaleActionDamage`, `HitResolveOptions` are live
// turn-engine contracts (TurnBattleSystem, TurnSkillAction,
// SkillToTurnSkillConverter); `ScheduledBasicImpact` is the parked
// artifact port's param type (ArtifactSystem calls scheduleBasic on it).
// Gameplay không phụ thuộc VFX/Phaser — event chỉ mang dữ liệu grid.
import type { SkillDamageComponent } from '../skill/SkillDamageComponent'
import type { CombatVfxPresetId } from './CombatAction'
import type { CombatActionOrigin } from './BattleEvents'
import type { DamageScalingConfig } from '../combat/DamageCalculator'

/**
 * Thay thế MissileDamageInfo — cùng shape, tên trung lập hành động.
 * `scaling` (R3 re-audit, AR-03 gap) — carries the authored per-skill
 * attributeScaling/manaScalingRatio through to
 * CombatSystem.resolveActionHit(), which is the only place with a live
 * `source` entity to evaluate them against.
 */
/**
 * The Tu Reimagined (spec 2026-09-15 section 3.4) — Cuong Chien
 * missing-HP scalar: bonus physical damage proportional to the
 * attacker's LIVE missing-HP fraction, resolved per hit at impact
 * (never a stat). `missingHpBonusPerMissingPercent` 0.02 = +2% damage
 * per 1% missing HP; `missingHpBonusCap` bounds the total bonus
 * multiplier (2.0 => up to x3 at 100% missing).
 */
interface ActionDamageMissingHpScalar {
  missingHpBonusPerMissingPercent?: number
  missingHpBonusCap?: number
}

export type ActionDamageInfo =
  | ({ kind: 'physical' | 'primordial'; multiplier: number; scaling?: DamageScalingConfig } & ActionDamageMissingHpScalar)
  | ({ kind: 'elemental'; components: SkillDamageComponent[]; multiplier: number; scaling?: DamageScalingConfig } & ActionDamageMissingHpScalar)

export function scaleActionDamage(
  info: ActionDamageInfo,
  percent: number,
): ActionDamageInfo {
  const scalar: ActionDamageMissingHpScalar = {
    missingHpBonusPerMissingPercent: info.missingHpBonusPerMissingPercent,
    missingHpBonusCap: info.missingHpBonusCap,
  }

  if (info.kind === 'elemental') {
    return { kind: 'elemental', components: info.components, multiplier: info.multiplier * percent, scaling: info.scaling, ...scalar }
  }

  return { kind: info.kind, multiplier: info.multiplier * percent, scaling: info.scaling, ...scalar }
}

export interface HitResolveOptions {
  /** undefined = hệ thống tự roll tại thời điểm resolve. */
  critical?: boolean

  skillId?: string

  knockbackDistance?: number

  /** false = mục tiêu phụ trong AOE (áp secondaryPercent). */
  isPrimary: boolean

  /** Bản Mệnh Pháp Bảo — attribution cho applyActionHit dispatch milestone. */
  origin?: CombatActionOrigin

  /**
   * Kiem Tu Reimagined Task 2 — skip the accuracy/evasion roll entirely.
   * Domain providers (e.g. Ngu Kiem Dao phi kiem) decide this; the engine
   * only executes the flag.
   */
  guaranteedHit?: boolean

  /**
   * Resolved armor policy for PHYSICAL hits — the caller has already made
   * its roll; the calculator only executes it. `armorBypass` drops the
   * mitigation term to 0; `armorPierceFraction` (0..1) multiplies the
   * mitigation down by that fraction. Ignored for elemental/primordial
   * (no armor term exists there).
   */
  armorBypass?: boolean
  armorPierceFraction?: number

  /**
   * Resolved per-hit damage scale (e.g. execute threshold roll result),
   * multiplied into the skill multiplier before crit.
   */
  damageMultiplier?: number
}

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

  /** ban_menh_phap_bao - attribution thread for the parked artifact port. */
  origin?: CombatActionOrigin
}
