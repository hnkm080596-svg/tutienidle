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
