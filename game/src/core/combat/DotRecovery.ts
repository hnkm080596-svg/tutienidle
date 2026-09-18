import type { CombatEntity } from './CombatEntity'
import type { ActiveCapabilityGrant } from '../battle/contracts/capability'
import type { ElementType } from '../element/ElementType'

import { asDotRecovery } from './DotRecoveryCapabilities'

// stat-system-reimagined Task 4 (D18) -- the bespoke poisonRecoveryPercent
// stat retired from StatType; poison recovery is an authored buff
// capability TRIGGER on the DoT source's own buffs (Doc Can's "+2% HP
// recovery from poison damage per stack"), not a character stat.
// CombatSystem.applyDotDamage calls this per tick with the source's live
// capability grants.
//
// buff2 M4: reads 'dot_recovery' ActiveCapabilityGrant descriptors
// (stacks live on the grant -- same scaling as the legacy effect read).
//
// Returns the total healPercent (already stack-scaled) for the tick's
// element. The recovered HP then scales with the source's
// healingEffectivenessPercent through the shared heal pipeline.
export function dotRecoveryTriggers(
  source: CombatEntity | undefined,
  element: ElementType | 'physical' | undefined,
  sourceGrants?: readonly ActiveCapabilityGrant[],
): number {
  if (!source?.alive || !sourceGrants) {
    return 0
  }

  let recovery = 0

  for (const grant of sourceGrants) {
    // The trigger belongs to the buff's TARGET (a self-buff on the
    // source); a misrouted instance pointing elsewhere must not feed
    // this source's recovery.
    if (grant.targetId !== source.id) {
      continue
    }

    const recoveryGrant = asDotRecovery(grant)
    if (recoveryGrant === undefined) {
      continue
    }

    if (recoveryGrant.element !== undefined && recoveryGrant.element !== element) {
      continue
    }

    recovery += recoveryGrant.healPercent * grant.stacks
  }

  return recovery
}
