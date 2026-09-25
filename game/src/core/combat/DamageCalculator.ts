import type { CombatEntity } from './CombatEntity'
import { getArmorMitigationPercent } from './Armor'
import type { StatType } from '../stats/StatTypes'

/**
 * Helper nen DUNG CHUNG cho Skill Power (combat-skill-flow-element-
 * power-dot-plan.md -3.1) - moi damage type "co power rieng" deu lay
 * ATK cong power chuyen biet lam nen. MOT diem duy nhat de direct hit
 * (calculateBaseDamage + elementalBasePower) va DoT snapshot
 * (AilmentSystem) khong the lech cong thuc ve sau.
 */
export function baseMightPlusPower(might: number, power: number): number {
  return might + power
}

/**
 * Base damage cho 2 damage type "don gian" (khong nhieu component) -
 * 'elemental' KHONG di qua day, xem ElementDamageCalculator.ts (moi
 * component tu mitigate theo dung hanh cua no, khong gop chung 1
 * cong thuc duoc).
 *
 * Physical da AP MITIGATION (Armor) ngay tai day - Hon Nguyen
 * (primordial) thi KHONG, gay sat thuong CHUAN bo qua moi phong thu,
 * dung yeu cau revamp. Phan Block/Endurance/Ward/Leech/Thorns con lai
 * cua pipeline nam o CombatSystem.resolveHit() (ap dung deu cho ca 2
 * loai + elemental, khong phan biet).
 */
export function calculateBaseDamage(
  source: CombatEntity,
  target: CombatEntity,
  damageType: 'physical' | 'primordial',
  ignoreResistance = false,
  armorPierceFraction = 0,
  sourceMaxHpRatio = 0,
): number {
  switch (damageType) {
    case 'physical': {
      // The Tu beta (Tran Ap) -- Max-HP-derived base: the source's
      // maxHp x sourceMaxHpRatio rides the raw base alongside might,
      // mitigated like might (Tran The hits are still physical hits).
      const raw = source.stats.might + source.stats.maxHp * sourceMaxHpRatio

      const mitigation = ignoreResistance
        ? 0
        : getArmorMitigationPercent(target.stats.defense, target.realmIndex) * (1 - armorPierceFraction)

      return Math.max(0, raw * (1 - mitigation))
    }

    case 'primordial':
      // combat-skill-flow-element-power-dot-plan.md -3.1 - Primordial
      // component cung cong ATK vao Power nen, QUA DUNG helper nen dung
      // chung baseMightPlusPower() (tranh hai cong thuc doc lap).
      return baseMightPlusPower(source.stats.might, source.stats.primordialPower)
  }
}

/**
 * R3 re-audit (AR-03 gap) - every scaling field authored on SkillEffect
 * (attributeScaling/manaScalingRatio) used to be added into the
 * multiplier only by the removed legacy executor (the old engine, NOT
 * the active TurnBattleSystem) - meaning every Phap Tu skill cast
 * through the turn engine lost this scaling entirely. The SINGLE
 * shared helper (read by CombatSystem.resolveActionHit()) applies the
 * formula to ActionDamageInfo.scaling - no divergence between the two
 * pipelines.
 */
export interface DamageScalingConfig {
  attributeScaling?: { attributes: StatType[]; ratioPerPoint: number }[]

  manaScalingRatio?: number
}

export function calculateScalingBonus(source: CombatEntity, scaling: DamageScalingConfig | undefined): number {
  if (!scaling) {
    return 0
  }

  // Guard against an empty attributes array - Math.max() over an empty
  // array = -Infinity, dragging the whole bonus to -Infinity (parity
  // with the removed legacy executor).
  const attributeBonus = (scaling.attributeScaling ?? []).reduce(
    (sum, entry) =>
      sum + (entry.attributes.length === 0 ? 0 : entry.ratioPerPoint * Math.max(...entry.attributes.map(stat => source.stats[stat]))),
    0,
  )

  const manaBonus = scaling.manaScalingRatio ? scaling.manaScalingRatio * source.stats.maxMp : 0

  return attributeBonus + manaBonus
}

/**
 * Ap multiplier + critical vao 1 so base damage da tinh san - tach
 * rieng de ElementDamageCalculator.ts (pipeline nhieu component, vd
 * 20% Physical + 80% Fire) dung chung. KHONG con floor "toi thieu 1"
 * o day - floor doi xuong buoc CUOI CUNG cua pipeline
 * (CombatSystem.resolveHit()), sau ca Block/Endurance, de don bi
 * giam nhieu tang van luon gay duoc it nhat 1 sat thuong.
 */
export function applyMultiplierAndCritical(
  baseDamage: number,
  multiplier: number,
  critical: boolean,
  criticalDamageMultiplier: number,
): number {
  const multipliedDamage = baseDamage * Math.max(0, multiplier)

  return critical ? multipliedDamage * criticalDamageMultiplier : multipliedDamage
}
