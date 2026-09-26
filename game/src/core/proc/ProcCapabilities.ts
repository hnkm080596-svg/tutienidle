// ProcCapabilities.ts -- megaplan M4 (r4 HIGH 3, BLOCKER 3): typed
// payload schemas + validators for the capability types CombatProcSystem
// owns. buff2 holds the generic CapabilityGrantDefinition; this module is
// the ONLY place the proc vocabulary lives. Consumers narrow grants via
// asOnHitProc/asReactiveTrigger/asReactiveProc -- never `as` casts.
//
// Payloads mirror the retired BuffTypes effect fields exactly (mechanical
// data migration -- the numbers and optionality are unchanged).

import type { BuffDefinitionId } from '../battle/contracts/ids'
import type {
  ActiveCapabilityGrant,
} from '../battle/contracts/capability'
import type { CapabilityValidatorRegistry } from '../battle/runtime/capability/CapabilityValidatorRegistry'

// The Tu Reimagined (spec 7.1, plan Task 16) -- provenance axis for the
// reactive queue. 'normal'/'skill' describe natural turns; the reactive
// sources describe bypass actions queued by a proc window. Lives here
// (proc vocabulary leaf) so both TurnBattleSystem and TurnSkillPlanRuntime
// read it without a runtime edge between them.
export type ReactiveActionSource = 'normal' | 'skill' | 'counter' | 'follow_up' | 'intercept'

/**
 * INV-9 natural-turn classifier -- 'normal' and 'skill' are the only
 * sources a player's own turn produces; queued bypass actions
 * (counter/follow_up/intercept) never re-open proc windows.
 */
export function isNaturalActionSource(
  source: ReactiveActionSource | undefined,
): boolean {
  return source === 'normal' || source === 'skill'
}

// The shared reactive-window name space (legacy ReactiveTriggerName).
export type ReactiveTriggerName =
  | 'onCastBegin'
  | 'onImpactLanded'
  | 'onEvade'
  | 'onAllyTargeted'
  | 'onAllyActionComplete'

export const REACTIVE_TRIGGER_NAMES: readonly ReactiveTriggerName[] = [
  'onCastBegin',
  'onImpactLanded',
  'onEvade',
  'onAllyTargeted',
  'onAllyActionComplete',
]

// --- on_hit_proc (legacy OnHitProcEffect) ---

export interface OnHitProcPayload {
  chance: number
  appliesBuffId: BuffDefinitionId
}

// --- reactive_trigger (legacy ReactiveTriggerEffect) ---

export interface ReactiveTriggerPayload {
  trigger: ReactiveTriggerName
  chance: number
  appliesDefinitionId?: BuffDefinitionId
  queuesFollowUp?: boolean
  /** The Tu beta (Phan Chan) -- once-per-hostile-action reflect: the
      holder's pending reflect merges every hit of the action, then the
      action-end flush emits ONE deal_damage 'reflection' op at the
      attacker for holder.maxHp x ratio. `markedBy` names the mark
      debuff; a marked attacker reflects at `markedMaxHpRatio`
      (absent = base ratio). The mark is never consumed. */
  reflectsDamage?: {
    maxHpRatio: number
    markedMaxHpRatio?: number
    markedBy?: BuffDefinitionId
  }
}

// --- reactive_proc (legacy ReactiveProcEffect) ---

export type ReactiveProcMechanic = 'intercept' | 'counter' | 'follow_up'
export type ReactiveProcChanceStat =
  | 'protectChance'
  | 'counterChance'
  | 'followUpChance'

export interface ReactiveProcPayload {
  trigger: ReactiveTriggerName
  mechanic: ReactiveProcMechanic
  chanceStat: ReactiveProcChanceStat
  /** Flat authored cost, paid ONLY on a successful roll (success-only
      consume -- the pay-before-roll + refund lane is superseded). */
  theCost?: number
  queuedAction?: {
    payloadSkillId: string
    actionSource: 'counter' | 'follow_up' | 'intercept'
    targetMode: 'attacker' | 'triggering_targets'
  }
  /** Ho Bich -- a committed intercept wards the rescued ally at commit
      (survives the protector's death). */
  grantsWardToOriginalTarget?: {
    buffDefinitionId: BuffDefinitionId
    sourceMaxHpRatio: number
  }
}

// --- validators ---

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function requireFiniteNumber(
  value: unknown,
  field: string,
  type: string,
): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`capability '${type}': ${field} must be a finite number`)
  }
}

function requireNonEmptyString(
  value: unknown,
  field: string,
  type: string,
): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`capability '${type}': ${field} must be a non-empty string`)
  }
}

function optionalBoolean(
  value: unknown,
  field: string,
  type: string,
): void {
  if (value !== undefined && typeof value !== 'boolean') {
    throw new Error(`capability '${type}': ${field} must be a boolean`)
  }
}

function requireTrigger(value: unknown, type: string): asserts value is ReactiveTriggerName {
  if (
    typeof value !== 'string' ||
    !REACTIVE_TRIGGER_NAMES.includes(value as ReactiveTriggerName)
  ) {
    throw new Error(`capability '${type}': invalid trigger '${String(value)}'`)
  }
}

export function validateOnHitProc(payload: unknown): asserts payload is OnHitProcPayload {
  const type = 'on_hit_proc'
  if (!isRecord(payload)) throw new Error(`capability '${type}': payload must be an object`)
  requireFiniteNumber(payload.chance, 'chance', type)
  requireNonEmptyString(payload.appliesBuffId, 'appliesBuffId', type)
}

export function validateReactiveTrigger(payload: unknown): asserts payload is ReactiveTriggerPayload {
  const type = 'reactive_trigger'
  if (!isRecord(payload)) throw new Error(`capability '${type}': payload must be an object`)
  requireTrigger(payload.trigger, type)
  requireFiniteNumber(payload.chance, 'chance', type)
  if (payload.appliesDefinitionId !== undefined) {
    requireNonEmptyString(payload.appliesDefinitionId, 'appliesDefinitionId', type)
  }
  optionalBoolean(payload.queuesFollowUp, 'queuesFollowUp', type)
  if (payload.reflectsDamage !== undefined) {
    const reflect = payload.reflectsDamage
    if (!isRecord(reflect)) {
      throw new Error(`capability '${type}': reflectsDamage must be an object`)
    }
    requireFiniteNumber(reflect.maxHpRatio, 'reflectsDamage.maxHpRatio', type)
    if (reflect.markedMaxHpRatio !== undefined) {
      requireFiniteNumber(reflect.markedMaxHpRatio, 'reflectsDamage.markedMaxHpRatio', type)
      if (reflect.markedBy === undefined) {
        throw new Error(`capability '${type}': reflectsDamage.markedMaxHpRatio requires markedBy`)
      }
    }
    if (reflect.markedBy !== undefined) {
      requireNonEmptyString(reflect.markedBy, 'reflectsDamage.markedBy', type)
    }
  }
}

const PROC_MECHANICS: readonly ReactiveProcMechanic[] = [
  'intercept',
  'counter',
  'follow_up',
]
const PROC_CHANCE_STATS: readonly ReactiveProcChanceStat[] = [
  'protectChance',
  'counterChance',
  'followUpChance',
]

export function validateReactiveProc(payload: unknown): asserts payload is ReactiveProcPayload {
  const type = 'reactive_proc'
  if (!isRecord(payload)) throw new Error(`capability '${type}': payload must be an object`)
  requireTrigger(payload.trigger, type)
  if (
    typeof payload.mechanic !== 'string' ||
    !PROC_MECHANICS.includes(payload.mechanic as ReactiveProcMechanic)
  ) {
    throw new Error(`capability '${type}': invalid mechanic '${String(payload.mechanic)}'`)
  }
  if (
    typeof payload.chanceStat !== 'string' ||
    !PROC_CHANCE_STATS.includes(payload.chanceStat as ReactiveProcChanceStat)
  ) {
    throw new Error(`capability '${type}': invalid chanceStat '${String(payload.chanceStat)}'`)
  }
  if (payload.theCost !== undefined) {
    requireFiniteNumber(payload.theCost, 'theCost', type)
  }
  if (payload.queuedAction !== undefined) {
    const queued = payload.queuedAction
    if (!isRecord(queued)) {
      throw new Error(`capability '${type}': queuedAction must be an object`)
    }
    requireNonEmptyString(queued.payloadSkillId, 'queuedAction.payloadSkillId', type)
    if (
      queued.actionSource !== 'counter' &&
      queued.actionSource !== 'follow_up' &&
      queued.actionSource !== 'intercept'
    ) {
      throw new Error(`capability '${type}': queuedAction.actionSource invalid`)
    }
    if (
      queued.targetMode !== 'attacker' &&
      queued.targetMode !== 'triggering_targets'
    ) {
      throw new Error(`capability '${type}': queuedAction.targetMode invalid`)
    }
  }
  if (payload.grantsWardToOriginalTarget !== undefined) {
    const ward = payload.grantsWardToOriginalTarget
    if (!isRecord(ward)) {
      throw new Error(`capability '${type}': grantsWardToOriginalTarget must be an object`)
    }
    requireNonEmptyString(ward.buffDefinitionId, 'grantsWardToOriginalTarget.buffDefinitionId', type)
    requireFiniteNumber(ward.sourceMaxHpRatio, 'grantsWardToOriginalTarget.sourceMaxHpRatio', type)
  }

}

// --- grant narrowers (consumers call these -- never `as`) ---

export function asOnHitProc(grant: ActiveCapabilityGrant): OnHitProcPayload | undefined {
  return grant.capability.type === 'on_hit_proc'
    ? (grant.capability.payload as OnHitProcPayload)
    : undefined
}

export function asReactiveTrigger(grant: ActiveCapabilityGrant): ReactiveTriggerPayload | undefined {
  return grant.capability.type === 'reactive_trigger'
    ? (grant.capability.payload as ReactiveTriggerPayload)
    : undefined
}

export function asReactiveProc(grant: ActiveCapabilityGrant): ReactiveProcPayload | undefined {
  return grant.capability.type === 'reactive_proc'
    ? (grant.capability.payload as ReactiveProcPayload)
    : undefined
}

/** Registers every proc-owned capability validator. */
export function registerProcCapabilities(validators: CapabilityValidatorRegistry): void {
  validators.register('on_hit_proc', validateOnHitProc)
  validators.register('reactive_trigger', validateReactiveTrigger)
  validators.register('reactive_proc', validateReactiveProc)
}
