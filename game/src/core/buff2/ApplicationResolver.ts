// ApplicationResolver.ts -- spec sec.11-12/17-20. SOLE owner of the
// application roll and the duration formula. Chance is MULTIPLICATIVE
// (R-B3 locked):
//
//   sourceApplicationModifier = (1 + elementApplicationPercent)
//                               x modifierFactor(existing.modifiers,
//                                                'application_chance')
//   targetResistanceModifier  = application.resistance === 'ailment'
//                               ? 1 - min(cap, max(0, ailmentResistPercent))
//                               : 1
//   chance = baseChance x sourceApplicationModifier x targetResistanceModifier
//   clamp [0,1] unless application.clampChance === false
//   success = rng.rollChance(chance) -- ALWAYS exactly one roll, even at
//   chance <= 0 / >= 1 (contract rng stream parity -- MEDIUM 4).
//
// Duration -- three independent concepts (amount / clock / scaling):
//   base = req.durationOverride ?? def.lifetime.duration
//   'fixed'          -> base verbatim (absorbs legacy fixed_holder_turns)
//   'ailment_scaled' -> base x (1 - min(cap, max(0, ailmentResistPercent)))
//                        x (1 + ailmentDurationPercent)
//                        x modifierFactor(existing.modifiers, 'duration')
//   'permanent' clock -> undefined (no duration)
//
// The 'duration'/'application_chance' channels read off the RESOLVED
// instance on reapply -- a fresh apply has no instance to modify.

import type { ApplyBuffRequest } from '../battle/contracts/operations'
import type { CombatRng } from '../battle/contracts/rng'
import type { BuffDefinition } from './BuffDefinition'
import type { BuffInstance } from './BuffInstance'
import { resolveChannel } from './BuffModifierEngine'

export const AILMENT_RESIST_CAP = 0.75

export interface ApplicationEntityStats {
  elementApplicationPercent?: number
  ailmentDurationPercent?: number
  ailmentResistPercent?: number
}

export interface ApplicationResolutionContext {
  source: { stats: ApplicationEntityStats }
  target: { stats: ApplicationEntityStats }
  definition: BuffDefinition
  /** Reapply target -- its modifiers feed the chance/duration channels. */
  existing?: BuffInstance
}

export interface ApplicationResolution {
  success: boolean
  duration?: number
  chance: number
}

export class ApplicationResolver {
  constructor(
    private readonly rng: CombatRng,
    private readonly caps: { ailmentResistCap?: number } = {},
  ) {}

  private get cap(): number {
    return this.caps.ailmentResistCap ?? AILMENT_RESIST_CAP
  }

  resolve(
    req: ApplyBuffRequest,
    ctx: ApplicationResolutionContext,
  ): ApplicationResolution {
    const def = ctx.definition
    const mods = ctx.existing?.modifiers ?? []

    const sourceApplicationModifier =
      (1 + (ctx.source.stats.elementApplicationPercent ?? 0)) *
      resolveChannel(mods, 'application_chance', 1)
    const targetResistanceModifier =
      def.application?.resistance === 'ailment'
        ? 1 - Math.min(this.cap, Math.max(0, ctx.target.stats.ailmentResistPercent ?? 0))
        : 1

    let chance = req.baseChance * sourceApplicationModifier * targetResistanceModifier
    if (def.application?.clampChance !== false) {
      chance = Math.min(1, Math.max(0, chance))
    }
    // Exactly one roll consumed at ANY chance (stream parity).
    const success = this.rng.rollChance(chance)

    const base = req.durationOverride ?? def.lifetime.duration
    let duration: number | undefined
    if (def.lifetime.clock === 'permanent') {
      duration = undefined
    } else if (def.lifetime.scaling === 'ailment_scaled') {
      duration =
        (base ?? 0) *
        (1 - Math.min(this.cap, Math.max(0, ctx.target.stats.ailmentResistPercent ?? 0))) *
        (1 + (ctx.source.stats.ailmentDurationPercent ?? 0)) *
        resolveChannel(mods, 'duration', 1)
    } else {
      duration = base
    }

    return { success, duration, chance }
  }
}
