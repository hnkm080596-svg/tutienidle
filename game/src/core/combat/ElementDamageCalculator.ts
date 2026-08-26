import type { CombatEntity } from './CombatEntity'
import type { ElementType } from '../element/ElementType'
import type { SkillDamageComponent } from '../skill/SkillDamageComponent'
import { baseAttackPlusPower, calculateBaseDamage } from './DamageCalculator'
import { getResistanceMitigationPercent } from './Resistance'

/**
 * 1 hành = 1 damage type ĐỘC LẬP kiểu Last Epoch — không còn chu kỳ
 * sinh/khắc (đã xoá ElementRelation.ts/ElementAffinity.ts). Power →
 * Resistance(có trần, xem Resistance.ts) → xong. "Độ thiên hành"
 * khuếch đại Power cũ (ElementAffinity) đã chuyển hẳn sang Linh Căn
 * (Attunement — xem StatCalculator.ts's deriveAttributeModifiers()),
 * nên Power ở đây đã BAO GỒM sẵn phần khuếch đại đó, không cần tính
 * thêm gì nữa.
 *
 * combat-skill-flow-element-power-dot-plan.md §3.1 — nguồn damage nền
 * của component nguyên tố đổi thành `ATK + ElementPower[element]` để
 * ATK và tiến trình trang bị đóng góp cho Pháp Tu thay vì chỉ đọc
 * Power nền gần bằng 0. Helper DÙNG CHUNG bởi direct hit lẫn DoT
 * snapshot (AilmentSystem.calculateDamagePerSecond) — tách 1 điểm duy
 * nhất để hai pipeline không thể lệch công thức về sau.
 */
export function elementalBasePower(source: CombatEntity, element: ElementType): number {
  return baseAttackPlusPower(source.stats.attack, source.stats[`${element}Power`])
}

export function calculateElementComponentDamage(
  source: CombatEntity,
  target: CombatEntity,
  element: ElementType,
  ignoreResistance = false,
): number {
  const power = elementalBasePower(source, element)

  const resistance = target.stats[`${element}Resistance`]

  const penetration = source.stats[`${element}Penetration`]

  const mitigation = ignoreResistance ? 0 : getResistanceMitigationPercent(resistance, penetration)

  return Math.max(0, power * (1 - mitigation))
}

/**
 * Base damage (TRƯỚC multiplier/crit — xem
 * CombatSystem.resolveHit()) cho 1 component trong skill nhiều
 * component (vd 20% Physical + 80% Fire). 'primordial' (Hỗn Nguyên)
 * bỏ qua mọi mitigation, đúng như calculateBaseDamage() đã xử lý.
 */
export function calculateComponentDamage(
  source: CombatEntity,
  target: CombatEntity,
  component: SkillDamageComponent,
  ignoreResistance = false,
): number {
  switch (component.kind) {
    case 'physical':
      return calculateBaseDamage(source, target, 'physical', ignoreResistance) * component.ratio

    case 'primordial':
      return calculateBaseDamage(source, target, 'primordial', ignoreResistance) * component.ratio

    case 'element':
      return calculateElementComponentDamage(source, target, component.element, ignoreResistance) * component.ratio
  }
}

/**
 * Tổng base damage (trước multiplier/crit) của toàn bộ component
 * trong 1 skill — CombatSystem.resolveHit() áp multiplier/crit/
 * block/endurance/ward/leech/thorns lên đúng 1 số tổng này, thống
 * nhất với đường đi của damage type đơn giản (physical/primordial),
 * không tách riêng nữa.
 */
export function calculateSkillBaseDamage(
  source: CombatEntity,
  target: CombatEntity,
  components: SkillDamageComponent[],
  ignoreResistance = false,
): number {
  let total = 0

  for (const component of components) {
    total += calculateComponentDamage(source, target, component, ignoreResistance)
  }

  return total
}
