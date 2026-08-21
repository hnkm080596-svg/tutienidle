import type {
  BuffCategory,
  BuffStackMode,
} from './BuffTypes'

import type {
  StatModifier,
} from '../stats/StatCalculator'

export interface Buff {
  id: string

  name: string

  description?: string

  category: BuffCategory

  duration?: number

  remainingTime?: number

  stacks: number

  maxStacks?: number

  stackMode: BuffStackMode

  modifiers: StatModifier[]

  hidden?: boolean
}