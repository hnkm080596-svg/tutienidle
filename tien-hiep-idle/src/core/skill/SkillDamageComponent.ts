import type { ElementType } from '../element/ElementType'

/**
 * Một phần trong tổng damage của skill — vd "20% Physical + 80% Fire"
 * là 2 component: { kind: 'physical', ratio: 0.2 } và
 * { kind: 'element', element: 'fire', ratio: 0.8 }. `ratio` tính
 * trên base damage của chính component đó (không phải % của final
 * damage) — xem core/combat/ElementDamageCalculator.ts.
 */
export type SkillDamageComponent =
  | { kind: 'physical'; ratio: number }
  | { kind: 'primordial'; ratio: number }
  | { kind: 'element'; element: ElementType; ratio: number }
