// BuffPeriodicResolver.ts -- spec sec.22-28. REQUEST COMPUTATION ONLY --
// this module never resolves combat math and NEVER touches a stats port
// (BLOCKER 6). The damage authority owns the formula via damageProfile;
// 'dynamic' scaling needs no snapshot (DamageSystem reads live stats at
// tick); 'snapshot' scaling forwards the apply-time capture verbatim
// (R-B9 -- the profile owns what the snapshot means).
//
// effectiveCoefficient =
//     periodic.coefficient
//   x (stackScaling === 'multiply' ? instance.stacks : 1)
//   x resolveChannel(mods, 'periodic_damage', 1)
//   x resolveChannel(mods, 'potency', 1)            -- Cong Minh channel;
//                                                    also scales
//                                                    statModifiers (R-B5)
//   x resolveChannel(mods, 'next_periodic_damage', 1) -- folded entries
//     get pending-marked on the emitted requestId; the mark finalizes
//     (consume a use) iff the generated op resolves
//     (PeriodicOperationSettled), else releases (spec addendum v1.2 --
//     never "consumed at read").
//
// requestId minting: `req.${instanceId}.${periodicId}.${tickOrdinal}` --
// the caller passes the per-instance monotonic tick ordinal
// (instance.periodicTickCount[periodicId]++). Globally unique across
// boundaries, manual triggers, and interval crossings WITHOUT depending
// on event/root ids (rootActionId-scoped minting would collide when two
// triggerPeriodic calls share one root transaction).

import type {
  BuffPeriodicDamageRequest,
  BuffPeriodicHealRequest,
} from '../battle/contracts/periodic'
import type { BuffInstanceId } from '../battle/contracts/ids'
import type {
  BuffPeriodicDefinition,
  PeriodicDamageDefinition,
  PeriodicHealDefinition,
} from './BuffDefinition'
import type { BuffInstance } from './BuffInstance'
import type { BuffModifier } from './BuffModifier'
import { resolveChannel } from './BuffModifierEngine'

export interface PendingUseMark {
  instanceId: BuffInstanceId
  modifierRuntimeId: string
}

export interface PeriodicRequestComputation {
  request: BuffPeriodicDamageRequest | BuffPeriodicHealRequest
  /** 'uses'-lifetime entries folded into this request -- the system
      records them under requestId and stamps entry.pendingRequestId. */
  marks: readonly PendingUseMark[]
}

/** Folded 'uses' entries = every active entry on the folded channels
    whose lifetime is 'uses'. resolveChannel already excludes pending-
    marked entries, so what folds here is exactly what the mark must
    reserve. */
function collectUseMarks(
  instance: BuffInstance,
  channels: readonly ('periodic_damage' | 'potency' | 'next_periodic_damage')[],
  requestId: string,
): PendingUseMark[] {
  const marks: PendingUseMark[] = []
  for (const m of instance.modifiers) {
    if (
      m.pendingRequestId === undefined &&
      m.lifetime.type === 'uses' &&
      channels.includes(m.channel as 'periodic_damage' | 'potency' | 'next_periodic_damage')
    ) {
      marks.push({ instanceId: instance.instanceId, modifierRuntimeId: m.modifierRuntimeId })
    }
  }
  return marks
}

const DAMAGE_CHANNELS = ['periodic_damage', 'potency', 'next_periodic_damage'] as const

export function computePeriodicRequest(
  instance: BuffInstance,
  periodic: BuffPeriodicDefinition,
  tickOrdinal: number,
): PeriodicRequestComputation {
  const requestId = `req.${instance.instanceId}.${periodic.id}.${tickOrdinal}`

  if (periodic.type === 'heal') {
    const p = periodic as PeriodicHealDefinition
    const amount = p.amount * (p.stackScaling === 'multiply' ? instance.stacks : 1)
    const request: BuffPeriodicHealRequest = {
      requestId,
      instanceId: instance.instanceId,
      periodicId: p.id,
      sourceId: instance.sourceId,
      targetId: instance.targetId,
      amount,
    }
    return { request, marks: [] }
  }

  const p = periodic as PeriodicDamageDefinition
  const effectiveCoefficient =
    p.coefficient *
    (p.stackScaling === 'multiply' ? instance.stacks : 1) *
    resolveChannel(instance.modifiers, 'periodic_damage', 1) *
    resolveChannel(instance.modifiers, 'potency', 1) *
    resolveChannel(instance.modifiers, 'next_periodic_damage', 1)

  const request: BuffPeriodicDamageRequest = {
    requestId,
    instanceId: instance.instanceId,
    periodicId: p.id,
    sourceId: instance.sourceId,
    targetId: instance.targetId,
    element: p.element,
    damageProfile: p.damageProfile,
    coefficient: effectiveCoefficient,
    hitCount: p.hitCount,
    canCrit: p.canCrit,
    canMiss: p.canMiss,
    stackCount: instance.stacks,
    ...(p.tags !== undefined ? { tags: p.tags } : {}),
    ...(p.scaling === 'snapshot' && instance.snapshots?.[p.id] !== undefined
      ? { snapshot: instance.snapshots[p.id] }
      : {}),
  }
  return { request, marks: collectUseMarks(instance, DAMAGE_CHANNELS, requestId) }
}
