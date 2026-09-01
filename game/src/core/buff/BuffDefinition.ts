import type { BuffPolarity, BuffStackMode, BuffEffectTemplate } from './BuffTypes'

/**
 * Static, authored data — registered once into BuffRegistry, never
 * mutated. `BuffSystem.apply()` reads this to produce a runtime `Buff`
 * instance (Buff.ts) with any ratio-based effect resolved against the
 * casting source's stats.
 */
export interface BuffDefinition {
  id: string
  name: string
  description?: string
  polarity: BuffPolarity
  hidden?: boolean

  duration: number
  maxStacks?: number
  stackMode: BuffStackMode

  convertsToId?: string
  convertsAfterContinuousSeconds?: number

  effects: BuffEffectTemplate[]
}
