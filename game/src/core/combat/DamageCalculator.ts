import type { CombatEntity } from './CombatEntity'
import { getArmorMitigationPercent } from './Armor'
import type { StatType } from '../stats/StatTypes'

/**
 * Helper nền DÙNG CHUNG cho Skill Power (combat-skill-flow-element-
 * power-dot-plan.md §3.1) — mọi damage type "có power riêng" đều lấy
 * ATK cộng power chuyên biệt làm nền. MỘT điểm duy nhất để direct hit
 * (calculateBaseDamage + elementalBasePower) và DoT snapshot
 * (AilmentSystem) không thể lệch công thức về sau.
 */
export function baseMightPlusPower(might: number, power: number): number {
  return might + power
}

/**
 * Base damage cho 2 damage type "đơn giản" (không nhiều component) —
 * 'elemental' KHÔNG đi qua đây, xem ElementDamageCalculator.ts (mỗi
 * component tự mitigate theo đúng hành của nó, không gộp chung 1
 * công thức được).
 *
 * Physical đã ÁP MITIGATION (Armor) ngay tại đây — Hỗn Nguyên
 * (primordial) thì KHÔNG, gây sát thương CHUẨN bỏ qua mọi phòng thủ,
 * đúng yêu cầu revamp. Phần Block/Endurance/Ward/Leech/Thorns còn lại
 * của pipeline nằm ở CombatSystem.resolveHit() (áp dụng đều cho cả 2
 * loại + elemental, không phân biệt).
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
      // mitigated like might (Trấn Thể hits are still physical hits).
      const raw = source.stats.might + source.stats.maxHp * sourceMaxHpRatio

      const mitigation = ignoreResistance
        ? 0
        : getArmorMitigationPercent(target.stats.defense, target.realmIndex) * (1 - armorPierceFraction)

      return Math.max(0, raw * (1 - mitigation))
    }

    case 'primordial':
      // combat-skill-flow-element-power-dot-plan.md §3.1 — Primordial
      // component cũng cộng ATK vào Power nền, QUA ĐÚNG helper nền dùng
      // chung baseMightPlusPower() (tránh hai công thức độc lập).
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
 * Áp multiplier + critical vào 1 số base damage đã tính sẵn — tách
 * riêng để ElementDamageCalculator.ts (pipeline nhiều component, vd
 * 20% Physical + 80% Fire) dùng chung. KHÔNG còn floor "tối thiểu 1"
 * ở đây — floor dời xuống bước CUỐI CÙNG của pipeline
 * (CombatSystem.resolveHit()), sau cả Block/Endurance, để đòn bị
 * giảm nhiều tầng vẫn luôn gây được ít nhất 1 sát thương.
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
