import type { CombatEntity } from './CombatEntity'
import type { Buff } from '../buff/BuffTypes'
import type { ElementType } from '../element/ElementType'

// stat-system-reimagined Task 4 (D18) -- the bespoke poisonRecoveryPercent
// stat retired from StatType; poison recovery is an authored buff-effect
// TRIGGER on the DoT source's own buffs (Doc Can's "+2% HP recovery from
// poison damage per stack"), not a character stat. CombatSystem.
// applyDotDamage calls this per tick with the source's live buff list.
//
// Returns the total healPercent (already stack-scaled) for the tick's
// element. The recovered HP then scales with the source's
// healingEffectivenessPercent through the shared heal pipeline.
export function dotRecoveryTriggers(
  source: CombatEntity | undefined,
  element: ElementType | 'physical' | undefined,
  sourceBuffs?: readonly Buff[],
): number {
  if (!source?.alive || !sourceBuffs) {
    return 0
  }

  let recovery = 0

  for (const buff of sourceBuffs) {
    // The trigger belongs to the buff's TARGET (a self-buff on the
    // source); a misrouted instance pointing elsewhere must not feed
    // this source's recovery.
    if (buff.targetId !== source.id) {
      continue
    }

    for (const effect of buff.effects) {
      if (effect.type !== 'dotRecovery') {
        continue
      }

      if (effect.element !== undefined && effect.element !== element) {
        continue
      }

      recovery += effect.healPercent * buff.stacks
    }
  }

  return recovery
}
