// BuffInstance.ts -- spec sec.8. Runtime state only; no effects, no
// holderId, no potencyAmplified. `targetId` is THE canonical persistent
// subject -- it absorbs the legacy "pool owner"/holder role (M0 census:
// every apply lane lands the instance in the pool of the entity its
// targetId names -- zero exceptions).

import type {
  BuffDefinitionId,
  BuffInstanceId,
  CombatEntityId,
} from '../battle/contracts/ids'
import type { BuffModifier } from './BuffModifier'

/** Opaque source-context bag (spec sec.25 + r4 HIGH 4): the damage profile
    owns the semantic keys -- buff2 stores/forwards it verbatim on
    request.snapshot; numeric-valued today, the profile may widen the value
    type if a future schema needs non-stat context. */
export type BuffSnapshotData = Readonly<Record<string, number>>

export interface BuffInstance {
  instanceId: BuffInstanceId // buff.${battleId}.${counter} -- battleId from composition root (R-B1)
  definitionId: BuffDefinitionId
  sourceId: CombatEntityId
  targetId: CombatEntityId // canonical persistent subject -- absorbs the legacy pool-owner/holder role
  stacks: number
  remaining?: number // units of lifetime.clock; undefined for permanent
  continuousTurns: number // convertsAfterContinuousTurns bookkeeping (holder boundaries only)
  continuousSeconds: number // convertsAfterContinuousSeconds bookkeeping (onTimePassed only)
  modifiers: BuffModifier[] // internal mutable -- snapshots expose frozen copies
  snapshots?: Record<string, BuffSnapshotData> // periodicId -> opaque snapshot captured at apply per snapshot-scaled periodic via DamageProfileSnapshotPort (R-B9 + r4 HIGH 4)
  intervalElapsed?: Record<string, number> // periodicId -> seconds since last 'interval' tick; NOT reset by duration refresh (accumulator != lifetime)
  periodicTickCount?: Record<string, number> // periodicId -> emitted-tick ordinal -- mints requestId `req.${instanceId}.${periodicId}.${n}`; globally unique WITHOUT depending on event/root ids (two manual triggers under one rootActionId never collide)
  createdSequence: number // PROVENANCE, not a global ordering key (r4 MEDIUM 4): sequence of the root context that created the instance -- op's ctx.combatSequence for op-created, the lifecycle ROOT's sequence for conversions (same-root conversions share it; ordering ties break on instanceId)
  lastAppliedSequence: number
}

/** Deep-frozen readonly copy (MEDIUM 2 -- Readonly<> alone is shallow;
    nested modifiers/snapshot records must not be mutable through a
    snapshot). Produced by snapshotInstance() below. */
export type BuffInstanceSnapshot = Readonly<
  Omit<BuffInstance, 'modifiers' | 'snapshots' | 'intervalElapsed' | 'periodicTickCount'>
> & {
  readonly modifiers: readonly BuffModifier[]
  readonly snapshots?: Readonly<Record<string, BuffSnapshotData>>
  readonly intervalElapsed?: Readonly<Record<string, number>>
  readonly periodicTickCount?: Readonly<Record<string, number>>
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key])
    }
  }
  return value
}

/** Deep copy + deep freeze: a snapshot can never mutate the live instance
    nor be mutated by a consumer (r4 MEDIUM 2 / M1 step 3 oracle). */
export function snapshotInstance(instance: BuffInstance): BuffInstanceSnapshot {
  const copy: BuffInstance = {
    ...instance,
    modifiers: instance.modifiers.map((m) => ({ ...m })),
    snapshots:
      instance.snapshots === undefined
        ? undefined
        : Object.fromEntries(
            Object.entries(instance.snapshots).map(([k, v]) => [k, { ...v }]),
          ),
    intervalElapsed:
      instance.intervalElapsed === undefined
        ? undefined
        : { ...instance.intervalElapsed },
    periodicTickCount:
      instance.periodicTickCount === undefined
        ? undefined
        : { ...instance.periodicTickCount },
  }
  return deepFreeze(copy) as BuffInstanceSnapshot
}
