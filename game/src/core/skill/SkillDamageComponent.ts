import type { ElementType } from '../element/ElementType'

/**
 * Mot phan trong tong damage cua skill - vd "20% Physical + 80% Fire"
 * la 2 component: { kind: 'physical', ratio: 0.2 } va
 * { kind: 'element', element: 'fire', ratio: 0.8 }. `ratio` tinh
 * tren base damage cua chinh component do (khong phai % cua final
 * damage) - xem core/combat/ElementDamageCalculator.ts.
 */
export type SkillDamageComponent =
  | { kind: 'physical'; ratio: number }
  | { kind: 'primordial'; ratio: number }
  | { kind: 'element'; element: ElementType; ratio: number }
