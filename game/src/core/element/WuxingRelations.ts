import type { ElementType } from './ElementType'

// Phap Tu Reimagined Task 5 — the ONE authority for Ngũ Hành pair
// relations. Sinh (generating) and Khắc (overcoming) are DIRECTIONAL
// tables: which side benefits or wins is read from the cycle, never
// from which ailment was applied first (spec §6).
//
//   SINH_CYCLE[A] === B    → A generates/feeds B (B is the beneficiary)
//   KHAC_OVERCOMES[A] === B → A overcomes B  (A is the overcomer)

export const SINH_CYCLE: Record<ElementType, ElementType> = {
  wood: 'fire',
  fire: 'earth',
  earth: 'metal',
  metal: 'water',
  water: 'wood',
}

export const KHAC_OVERCOMES: Record<ElementType, ElementType> = {
  wood: 'earth',
  earth: 'water',
  water: 'fire',
  fire: 'metal',
  metal: 'wood',
}

export type WuxingRelation = 'sinh' | 'khac' | null

/**
 * The relation between two elements, order-insensitive: 'sinh' when one
 * generates the other, 'khac' when one overcomes the other, null for
 * identical elements (every element pair over 5 elements is exactly one
 * of sinh/khac — the null case is only a === b).
 */
export function relationOf(a: ElementType, b: ElementType): WuxingRelation {
  if (a === b) {
    return null
  }

  if (SINH_CYCLE[a] === b || SINH_CYCLE[b] === a) {
    return 'sinh'
  }

  return 'khac'
}

/**
 * Which of a/b overcomes the other — the DIRECTIONAL winner read from
 * KHAC_OVERCOMES, not from call order. Callers must only invoke this on
 * a pair relationOf() reports as 'khac'.
 */
export function khacOvercomer(a: ElementType, b: ElementType): ElementType {
  return KHAC_OVERCOMES[a] === b ? a : b
}

/**
 * The Sinh beneficiary — when SINH_CYCLE[a] === b, b is the child
 * (beneficiary) regardless of application order. Callers must only
 * invoke this on a pair relationOf() reports as 'sinh'.
 */
export function sinhBeneficiary(a: ElementType, b: ElementType): ElementType {
  return SINH_CYCLE[a] === b ? b : a
}
