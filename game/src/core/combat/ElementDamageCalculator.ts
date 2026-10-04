import type { CombatEntity } from './CombatEntity'
import type { ElementType } from '../element/ElementType'
import type { SkillDamageComponent } from '../skill/SkillDamageComponent'
import { baseMightPlusPower, calculateBaseDamage } from './DamageCalculator'
import { getResistanceMitigationPercent } from './Resistance'

/**
 * 1 hanh = 1 damage type DOC LAP kieu Last Epoch - khong con chu ky
 * sinh/khac (da xoa ElementRelation.ts/ElementAffinity.ts). Power ->
 * Resistance(co tran, xem Resistance.ts) -> xong. "Do thien hanh"
 * khuech dai Power cu (ElementAffinity) da chuyen han sang Linh Can
 * (Attunement - xem StatCalculator.ts's deriveAttributeModifiers()),
 * nen Power o day da BAO GOM san phan khuech dai do, khong can tinh
 * them gi nua.
 *
 * combat-skill-flow-element-power-dot-plan.md sec3.1 - nguon damage nen
 * cua component nguyen to doi thanh `ATK + ElementPower[element]` de
 * ATK va tien trinh trang bi dong gop cho Phap Tu thay vi chi doc
 * Power nen gan bang 0. Helper DUNG CHUNG boi direct hit lan DoT
 * snapshot (AilmentSystem.calculateDamagePerSecond) - tach 1 diem duy
 * nhat de hai pipeline khong the lech cong thuc ve sau.
 */
export function elementalBasePower(source: CombatEntity, element: ElementType): number {
  return baseMightPlusPower(source.stats.might, source.stats[`${element}Power`])
}

export function calculateElementComponentDamage(
  source: CombatEntity,
  target: CombatEntity,
  element: ElementType,
  ignoreResistance = false,
  penetrationBonus = 0,
): number {
  const power = elementalBasePower(source, element)

  const resistance = target.stats[`${element}Resistance`]

  // Per-hit penetration bonuses (spec D7/D11) are additive POINTS on
  // the stat read -- never a stats mutation.
  const penetration = source.stats[`${element}Penetration`] + penetrationBonus

  const mitigation = ignoreResistance ? 0 : getResistanceMitigationPercent(resistance, penetration)

  return Math.max(0, power * (1 - mitigation))
}

/**
 * Base damage (TRUOC multiplier/crit - xem
 * CombatSystem.resolveHit()) cho 1 component trong skill nhieu
 * component (vd 20% Physical + 80% Fire). 'primordial' (Hon Nguyen)
 * bo qua moi mitigation, dung nhu calculateBaseDamage() da xu ly.
 */
export function calculateComponentDamage(
  source: CombatEntity,
  target: CombatEntity,
  component: SkillDamageComponent,
  ignoreResistance = false,
  penetrationBonus = 0,
): number {
  switch (component.kind) {
    case 'physical':
      return calculateBaseDamage(source, target, 'physical', ignoreResistance) * component.ratio

    case 'primordial':
      return calculateBaseDamage(source, target, 'primordial', ignoreResistance) * component.ratio

    case 'element':
      return calculateElementComponentDamage(
        source,
        target,
        component.element,
        ignoreResistance,
        penetrationBonus,
      ) * component.ratio
  }
}

/**
 * Tong base damage (truoc multiplier/crit) cua toan bo component
 * trong 1 skill - CombatSystem.resolveHit() ap multiplier/crit/
 * block/endurance/ward/leech len dung 1 so tong nay, thong
 * nhat voi duong di cua damage type don gian (physical/primordial),
 * khong tach rieng nua.
 */
export function calculateSkillBaseDamage(
  source: CombatEntity,
  target: CombatEntity,
  components: SkillDamageComponent[],
  ignoreResistance = false,
  penetrationBonus = 0,
): number {
  let total = 0

  for (const component of components) {
    total += calculateComponentDamage(source, target, component, ignoreResistance, penetrationBonus)
  }

  return total
}
