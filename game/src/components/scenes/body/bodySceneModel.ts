// Scene 08 scaffold (HK mission) - shared view-model shapes for the body
// scene regions. The scene reads the canonical body chapter read-models
// (BodyProgressionSystem + per-chapter data) and collapses them into a
// uniform "unit" view: one detail card + a selector chip per unit.
import type { StatType } from '@/core/stats/StatTypes'

export type BodyUnitStatus =
  | 'done'
  | 'active'
  | 'next'
  | 'locked'
  | 'realm_locked'
  | 'complete'

export interface BodyGainView {
  // Stat badge family for the art inventory - the runtime tint icon
  // until the authored glyph exists.
  stat: StatType | null
  label: string
  value: string
}

export interface BodyCostView {
  id: string
  name: string
  icon?: string
  have: number
  need: number
  met: boolean
}

export interface BodyChipView {
  id: string
  label: string
  hint: string
  status: 'done' | 'active' | 'locked'
}

export interface BodyUnitView {
  id: string
  chip: BodyChipView
  title: string
  description: string
  status: BodyUnitStatus
  gains: BodyGainView[]
  costs: BodyCostView[]
  // Gate lines rendered cinnabar under the cost section (realm/seq/cost).
  gates: string[]
  // The single actionable unit of the chapter gets the invest affordance.
  actionable: boolean
  canInvest: boolean
  progress?: { value: number; max: number }
}

/**
 * Manual Rèn Thể pour spec (owner ruling 2026-10-09): built by the
 * scene model AFTER the real invest commits - the fidelity card replays
 * it as a particle stream (material slot -> bar start) while the count
 * drains on each particle departure and the bar fills on each landing.
 * Display-only: the domain state is already final when this exists.
 */
export interface BodyPourSpec {
  // Currency units the invest actually consumed (spread across the
  // particles, each carrying progress = share * progressPerMaterial).
  consumed: number
  // Displayed material count before/after the real debit - the row
  // drains haveFrom -> haveTo as particles leave the slot.
  haveFrom: number
  haveTo: number
  // Progress each consumed unit buys (talent multiplier snapshot).
  progressPerMaterial: number
  // Filled amount on the active tier at click time.
  tierProgress: number
  // Caps of the tiers from the click-time active tier onward - the
  // animated fill wraps through them when a tier completes mid-pour.
  caps: readonly number[]
}
