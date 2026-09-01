import type { BuffPolarity, BuffStackMode, BuffEffect } from './BuffTypes'

/**
 * A buff/debuff/DoT/CC instance active on one entity, granted by one
 * source. Storage key is `(id, sourceId)` — see BuffPool.ts — so two
 * different sources each get their own independent instance of the same
 * buff `id` on one target; only the SAME source re-applying triggers
 * stack/refresh/replace (BuffSystem.apply()).
 */
export interface Buff {
  id: string
  sourceId: string
  targetId: string
  polarity: BuffPolarity
  hidden?: boolean

  duration: number
  remainingTime: number
  stacks: number
  maxStacks?: number
  stackMode: BuffStackMode

  // Whole-instance replacement chain (Làm Chậm -> Đóng Băng) — ported
  // verbatim from Ailment.continuousSeconds/convertsToId/
  // convertsAfterContinuousSeconds. Lives on the envelope, not inside an
  // effect, because it replaces the ENTIRE buff, not one behavior within it.
  continuousSeconds: number
  convertsToId?: string
  convertsAfterContinuousSeconds?: number

  effects: BuffEffect[]
}
