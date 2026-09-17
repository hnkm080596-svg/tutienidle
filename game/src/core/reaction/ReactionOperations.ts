// ReactionOperations.ts -- megaplan M4. Maps authored payoff steps to
// the emitted CombatOperation subset (spec sec.47), in authored order
// (contract sec.43/44 -- consume ops are already emitted ahead of this
// list by resolveCandidate). All payoff math reads the FROZEN context
// (pre-consume participant snapshot -- contract sec.38).
//
// Emission rules:
// - add_child_stacks -> AddBuffStacksOperation on the child INSTANCE
//   (never ApplyBuff -- contract sec.75/93: structurally incapable of
//   producing ElementalApplicationCommitted, INV-R14 no recursion).
// - add_child_modifier -> AddBuffModifierOperation {operation:'multiply',
//   reapply:'max', lifetime:{type:'buff_lifetime'}} on the child instance.
// - extend_child_duration -> ExtendBuffDurationOperation (authored cap).
// - reaction_damage -> DealDamageOperation (canCrit:false, canMiss:false,
//   element = attacker element, origin.kind 'reaction' -- R-A).
// - apply_status -> ApplyBuffOperation(reactionEligibility:'suppressed')
//   [+ AddBuffModifierOperation on the identity selector -- the instance
//   does not exist at resolution time (spec sec.78)].
// - push_gauge -> PushGaugeOperation (negative = pushback).
// - heal_from_damage -> DeferredOperation positioned after the damage
//   op; the RATIO cap is applied at resolution (fraction = min(eval,
//   capRatio) -- R-B); the batch runner materializes it from the
//   referenced deal_damage result.

import type { ElementType } from '../element/ElementType'
import type {
  AddBuffModifierOperation,
  AddBuffStacksOperation,
  ApplyBuffOperation,
  BuffModifierPayload,
  ConsumeBuffStacksOperation,
  DealDamageOperation,
  ExtendBuffDurationOperation,
  HealOperation,
  PushGaugeOperation,
  ResolvedCombatOperation,
} from '../battle/contracts/operations'
import type { DeferredOperation } from '../battle/contracts/settlement'
import type { CombatOperationId } from '../battle/contracts/ids'
import type { BuffInstanceSelector } from '../battle/contracts/selectors'
import { evalStackExpr, type StackExpr } from './StackExpr'
import type { ReactionDefinition } from './ReactionDefinition'
import type {
  ReactionContext,
  ReactionParticipantSnapshot,
} from './ReactionResolution'

/** The emitted subset of CombatOperation (spec sec.47; ApplyControl
    lowered to ApplyBuff per contract sec.6/71). */
export type ReactionOperation =
  | ConsumeBuffStacksOperation
  | AddBuffStacksOperation
  | AddBuffModifierOperation
  | ExtendBuffDurationOperation
  | DealDamageOperation
  | ApplyBuffOperation
  | PushGaugeOperation
  | HealOperation

function opId(context: ReactionContext, label: string): CombatOperationId {
  return `rx.${context.causationEventId}.${context.reactionId}.${label}` as CombatOperationId
}

function origin(context: ReactionContext) {
  return {
    kind: 'reaction' as const,
    originId: context.reactionId,
    sourceId: context.sourceId,
    rootActionId: context.rootActionId,
    causationEventId: context.causationEventId,
    reactionId: context.reactionId,
  }
}

function requireParticipant(
  context: ReactionContext,
  role: ReactionParticipantSnapshot['role'],
  step: string,
): ReactionParticipantSnapshot {
  const p = context.participants.find((entry) => entry.role === role)
  if (p === undefined) {
    throw new Error(
      `ReactionOperations: '${context.reactionId}' step '${step}' requires a '${role}' participant`,
    )
  }
  return p
}

function instanceSelector(
  p: ReactionParticipantSnapshot,
): BuffInstanceSelector {
  return { kind: 'instance', instanceId: p.instanceId }
}

function modifierPayload(
  modifierId: string,
  channel: 'potency' | 'periodic_damage',
  value: number,
): BuffModifierPayload {
  return {
    id: modifierId,
    channel,
    operation: 'multiply',
    value,
    reapply: 'max',
    priority: 0,
    lifetime: { type: 'buff_lifetime' },
  }
}

/** Emits the authored payoff steps in authored order. `lastDamageOpId`
    tracks the most recent reaction_damage op so heal_from_damage can
    reference it (a heal step with no preceding damage step is an
    authoring defect -- throws). */
export function emitPayoffOperations(
  def: ReactionDefinition,
  context: ReactionContext,
): readonly (ResolvedCombatOperation | DeferredOperation)[] {
  const ops: (ResolvedCombatOperation | DeferredOperation)[] = []
  let lastDamageOpId: CombatOperationId | undefined

  for (let i = 0; i < def.payoff.steps.length; i++) {
    const step = def.payoff.steps[i]!
    switch (step.kind) {
      case 'add_child_stacks': {
        const child = requireParticipant(context, 'child', step.kind)
        ops.push({
          type: 'add_buff_stacks',
          operationId: opId(context, `pay.${i}`),
          origin: origin(context),
          payload: {
            selector: instanceSelector(child),
            stacks: evalStackExpr(step.stacks, context),
          },
        })
        break
      }
      case 'add_child_modifier': {
        const child = requireParticipant(context, 'child', step.kind)
        ops.push({
          type: 'add_buff_modifier',
          operationId: opId(context, `pay.${i}`),
          origin: origin(context),
          payload: {
            selector: instanceSelector(child),
            modifier: modifierPayload(
              step.modifierId,
              step.channel,
              evalStackExpr(step.value, context),
            ),
          },
        })
        break
      }
      case 'extend_child_duration': {
        const child = requireParticipant(context, 'child', step.kind)
        ops.push({
          type: 'extend_buff_duration',
          operationId: opId(context, `pay.${i}`),
          origin: origin(context),
          payload: {
            selector: instanceSelector(child),
            turns: evalStackExpr(step.turns, context),
            maxRemaining: step.maxRemaining,
          },
        })
        break
      }
      case 'reaction_damage': {
        const attacker = requireParticipant(context, 'attacker', step.kind)
        const id = opId(context, `pay.${i}`)
        lastDamageOpId = id
        ops.push({
          type: 'deal_damage',
          operationId: id,
          origin: origin(context),
          payload: {
            targetId: context.targetId,
            element: attacker.element satisfies ElementType,
            damageProfile: step.damageProfile,
            coefficient: evalStackExpr(step.coefficient, context),
            hitCount: 1,
            canCrit: false,
            canMiss: false,
          },
        })
        break
      }
      case 'apply_status': {
        if (step.when !== undefined) {
          const subject = requireParticipant(
            context,
            step.when.role,
            step.kind,
          )
          const pass =
            step.when.op === 'gte'
              ? subject.stacks >= step.when.value
              : subject.stacks < step.when.value
          if (!pass) break // gate failed -- no ops for this step
        }
        const stacks =
          step.stacks !== undefined
            ? evalStackExpr(step.stacks, context)
            : 1
        let durationOverride =
          step.durationOverride !== undefined
            ? evalStackExpr(step.durationOverride, context)
            : undefined
        if (durationOverride !== undefined && step.maxDuration !== undefined) {
          durationOverride = Math.min(durationOverride, step.maxDuration)
        }
        ops.push({
          type: 'apply_buff',
          operationId: opId(context, `pay.${i}`),
          origin: origin(context),
          payload: {
            definitionId: step.definitionId,
            targetId: context.targetId,
            stacks,
            baseChance: 1,
            reactionEligibility: 'suppressed',
            ...(durationOverride !== undefined ? { durationOverride } : {}),
          },
        })
        if (step.modifier !== undefined) {
          // The status instance does not exist at resolution time --
          // target by (definitionId, sourceId, targetId) identity
          // (spec sec.78 doan_moc note).
          ops.push({
            type: 'add_buff_modifier',
            operationId: opId(context, `pay.${i}.modifier`),
            origin: origin(context),
            payload: {
              selector: {
                kind: 'identity',
                definitionId: step.definitionId,
                sourceId: context.sourceId,
                targetId: context.targetId,
              },
              modifier: modifierPayload(
                step.modifier.modifierId,
                step.modifier.channel,
                evalStackExpr(step.modifier.value, context),
              ),
            },
          })
        }
        break
      }
      case 'push_gauge': {
        ops.push({
          type: 'push_gauge',
          operationId: opId(context, `pay.${i}`),
          origin: origin(context),
          payload: {
            targetId: context.targetId,
            fractionOfMax: evalStackExpr(step.fractionOfMax, context),
          },
        })
        break
      }
      case 'heal_from_damage': {
        if (lastDamageOpId === undefined) {
          throw new Error(
            `ReactionOperations: '${context.reactionId}' heal_from_damage requires a preceding reaction_damage step`,
          )
        }
        const fraction = Math.max(
          0,
          Math.min(evalStackExpr(step.fraction, context), step.capRatio),
        )
        ops.push({
          kind: 'heal_from_damage_result',
          operationId: opId(context, 'heal'),
          resultOperationId: lastDamageOpId,
          healTarget: step.healTarget,
          fraction,
          origin: origin(context),
        })
        break
      }
    }
  }
  return ops
}
