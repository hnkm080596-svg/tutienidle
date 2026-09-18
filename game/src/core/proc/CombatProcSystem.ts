// CombatProcSystem.ts -- megaplan M4 (HIGH 5 + r4 HIGH 3): the narrow
// proc/reactive capability owner. Consumes getCapabilities descriptors,
// rolls the shared CombatRng, and emits EVERY mutation through the
// CombatScheduler (apply_buff / deal_damage / heal / gain_resource /
// consume_resource ops) -- never touches buff/entity state directly.
//
// Ownership boundary (locked): this module owns ONLY proc/reactive
// MECHANICS -- 'on_hit_proc', 'reactive_trigger', 'reactive_proc' --
// including the The cost/gain transaction that funds reactive_proc
// rolls (routed through the resource ops channel). It does NOT own
// 'the_economy'/'reactive_economy' income reads (TheEconomy's gain
// seams), 'dot_recovery' (damage side), or 'gauge_delta'
// (GaugeDeltaHandler's buff_applied lane).
//
// Settlement rule: each emitted op settles IMMEDIATELY (enqueueAuthored
// + run()) at its seam, matching the legacy synchronous application
// order -- a success gain can fund the next attempt's cost inside the
// same window, and a procced application is visible to every later seam
// in the same action.

import type {
  CombatEntityId,
  CombatOperationId,
} from '../battle/contracts/ids'
import type {
  ApplyBuffOperation,
  ConsumeResourceOperation,
  DealDamageOperation,
  GainResourceOperation,
  HealOperation,
  ResolvedCombatOperation,
} from '../battle/contracts/operations'
import type { CombatOperationOrigin } from '../battle/contracts/origin'
import type { CombatOperationResultStatus } from '../battle/contracts/results'
import type { CombatEntity } from '../combat/CombatEntity'
import type { CombatRng } from '../battle/contracts/rng'
import type { CombatScheduler } from '../battle/runtime/scheduler/CombatScheduler'
import type { BuffSystem } from '../buff2/BuffSystem'
import type { QueuedFollowUp } from '../battle/turn/TurnBattleSystem'
import type { ReactiveTriggerContext } from '../battle/turn/TurnBattleSystem'
import { resolveProcCost, THE_PROC_COST } from '../the-tu/TheEconomy'
import { clampStatValue } from '../stats/StatMetadata'
import {
  asOnHitProc,
  asReactiveProc,
  asReactiveTrigger,
  type ReactiveTriggerName,
  type ReactiveProcPayload,
} from './ProcCapabilities'

export interface CombatProcSystemDeps {
  buffs: BuffSystem
  rng: CombatRng
  scheduler: CombatScheduler
  /** Live entity lookup (the composition root closes over the battle). */
  resolveEntity: (id: CombatEntityId) => CombatEntity | undefined
}

export interface ReactiveTriggerRollResult {
  firedFollowUp: boolean
}

export interface ReactiveProcAttempt {
  paid: boolean
  success: boolean
  effect?: ReactiveProcPayload
}

export interface ReactiveProcContext {
  attacker?: { id: CombatEntityId; entity: CombatEntity }
  outcome?: 'taken' | 'evaded'
  intercepted?: boolean
  triggeringTargets?: readonly { id: CombatEntityId; entity: CombatEntity }[]
  nonDamaging?: boolean
}

const RESOURCE_THE = 'the'
const REFLECTION_PROFILE = 'reflection'

export class CombatProcSystem {
  constructor(private readonly deps: CombatProcSystemDeps) {}

  /**
   * on_hit_proc lane (legacy rollOnHitEffects): the ATTACKER's grants
   * roll; a success applies the procced def onto the hit VICTIM
   * (ARCH-009 -- sourceId stays the attacker). One rollChance per grant,
   * canonical grant order (r4 HIGH 2 -- insertion-independent RNG draw).
   */
  onHitLanded(
    attackerId: CombatEntityId,
    targetId: CombatEntityId,
    rootActionId: string,
  ): void {
    for (const grant of this.deps.buffs.getCapabilities(attackerId)) {
      const proc = asOnHitProc(grant)
      if (proc === undefined) continue
      if (!this.deps.rng.rollChance(proc.chance)) continue
      this.emitOp(
        this.applyBuffOp(
          proc.appliesBuffId,
          attackerId,
          targetId,
          rootActionId,
          `onhit.${grant.instanceId}.${grant.capability.id}`,
        ),
      )
    }
  }

  /**
   * reactive_trigger lane (legacy rollReactiveTrigger): the HOLDER's
   * grants at 'onCastBegin'/'onImpactLanded' windows. Success may apply
   * a self-buff, queue a follow-up (returned for the caller's battle
   * queue -- the queue stays TBS-owned), or reflect damage through a
   * 'reflection' deal_damage op (damage authority owns the reflect).
   */
  rollReactiveTrigger(
    holderId: CombatEntityId,
    trigger: 'onCastBegin' | 'onImpactLanded',
    context: { attacker?: CombatEntity; hpDamage?: number } | undefined,
    rootActionId: string,
  ): ReactiveTriggerRollResult {
    let firedFollowUp = false
    const holder = this.deps.resolveEntity(holderId)

    for (const grant of this.deps.buffs.getCapabilities(holderId)) {
      const reactive = asReactiveTrigger(grant)
      if (reactive === undefined || reactive.trigger !== trigger) continue
      if (!this.deps.rng.rollChance(reactive.chance)) continue

      if (reactive.appliesDefinitionId !== undefined) {
        this.emitOp(
          this.applyBuffOp(
            reactive.appliesDefinitionId,
            holderId,
            holderId,
            rootActionId,
            `reactive.${grant.instanceId}.${grant.capability.id}`,
          ),
        )
      }
      if (reactive.queuesFollowUp === true) {
        firedFollowUp = true
      }

      // Reflection (phan_chinh): only a TAKEN hit reflects -- the caller
      // gates on hpDamage > 0; the context guard keeps context-less
      // onCastBegin calls from reflecting nothing.
      if (
        reactive.reflectsDamage !== undefined &&
        context?.attacker !== undefined &&
        (context.hpDamage ?? 0) > 0 &&
        context.attacker.alive &&
        holder !== undefined
      ) {
        const amount =
          context.hpDamage! * reactive.reflectsDamage.takenRatio +
          holder.stats.maxHp * reactive.reflectsDamage.maxHpRatio
        this.emitOp({
          type: 'deal_damage',
          operationId:
            `proc.${rootActionId}.reflect.${grant.instanceId}.${grant.capability.id}` as CombatOperationId,
          payload: {
            targetId: context.attacker.id,
            damageProfile: REFLECTION_PROFILE,
            coefficient: amount,
            hitCount: 1,
            canCrit: false,
            canMiss: false,
          },
          origin: this.origin(holderId, rootActionId, `reflect.${grant.capability.id}`),
        })
      }
    }

    return { firedFollowUp }
  }

  /**
   * reactive_proc lane (legacy resolveReactiveProcs): the holder's
   * intercept/counter/follow-up grants at a reactive window. Per
   * attempt: read the proc cost from the holder's reactive_economy
   * grants, gate on the synchronous balance read, deduct through a
   * consume_resource op (its settle result IS the paid flag), roll the
   * authored chanceStat, and on success credit the gain through a
   * gain_resource op, emit the authored heal, and return the queued
   * action descriptor for the caller's bypass queue.
   *
   * Dead-holder guard (MED review): a participant killed by the hit
   * that opened this window performs NO transaction -- no cost, no rng
   * draw, no success credit, no queue.
   */
  resolveReactiveProcs(
    holderId: CombatEntityId,
    trigger: ReactiveTriggerName,
    context: ReactiveProcContext,
    opts: { once?: boolean; rootActionId: string },
  ): { attempts: ReactiveProcAttempt[]; queuedFollowUps: QueuedFollowUp[] } {
    const holder = this.deps.resolveEntity(holderId)
    if (holder === undefined || !holder.alive) {
      return { attempts: [], queuedFollowUps: [] }
    }

    const grants = this.deps.buffs.getCapabilities(holderId)
    const attempts: ReactiveProcAttempt[] = []
    const queuedFollowUps: QueuedFollowUp[] = []

    for (const grant of grants) {
      const proc = asReactiveProc(grant)
      if (proc === undefined || proc.trigger !== trigger) continue
      if (context.nonDamaging === true && proc.firesOnNonDamagingAction !== true) {
        continue
      }
      if (opts.once === true && attempts.length > 0) {
        return { attempts, queuedFollowUps }
      }

      const cost = resolveProcCost(grants, proc.theCost ?? THE_PROC_COST)
      const paid =
        (holder.currentThe ?? 0) >= cost &&
        this.settleOp(
          this.resourceOp(
            'consume_resource',
            holderId,
            cost,
            opts.rootActionId,
            `cost.${grant.instanceId}.${grant.capability.id}`,
          ),
        ) === 'resolved'

      if (!paid) {
        attempts.push({ paid: false, success: false })
        continue
      }

      const chance = clampStatValue(
        proc.chanceStat,
        holder.stats[proc.chanceStat] ?? 0,
      )
      const success = this.deps.rng.rollChance(chance)

      if (success) {
        if ((proc.theGainOnSuccess ?? 0) > 0) {
          this.emitOp(
            this.resourceOp(
              'gain_resource',
              holderId,
              proc.theGainOnSuccess!,
              opts.rootActionId,
              `gain.${grant.instanceId}.${grant.capability.id}`,
            ),
          )
        }

        // Task 20 (spec 8.2) -- a successful Tro proc heals the
        // TRIGGERING ally through the heal authority.
        if (
          proc.healsTriggeringAllyMaxHpRatio !== undefined &&
          context.attacker?.entity.alive === true
        ) {
          this.emitOp({
            type: 'heal',
            operationId:
              `proc.${opts.rootActionId}.heal.${grant.instanceId}.${grant.capability.id}` as CombatOperationId,
            payload: {
              targetId: context.attacker.id,
              amount:
                context.attacker.entity.stats.maxHp *
                proc.healsTriggeringAllyMaxHpRatio,
            },
            origin: this.origin(holderId, opts.rootActionId, `heal.${grant.capability.id}`),
          })
        }

        if (proc.queuedAction !== undefined) {
          const targetIds =
            proc.queuedAction.targetMode === 'attacker'
              ? context.attacker?.entity.alive === true
                ? [context.attacker.id]
                : []
              : (context.triggeringTargets ?? [])
                  .filter((participant) => participant.entity.alive)
                  .map((participant) => participant.id)

          if (targetIds.length > 0) {
            const triggerContext: ReactiveTriggerContext = {
              origin: trigger === 'onAllyActionComplete' ? 'ally_action' : 'enemy_hit',
              intercepted: context.intercepted,
              outcome: context.outcome,
            }
            attempts.push({ paid: true, success, effect: proc })
            queuedFollowUps.push({
              actorId: holderId,
              executionKind: 'reactive_bypass',
              actionSource: proc.queuedAction.actionSource,
              payloadSkillId: proc.queuedAction.payloadSkillId,
              targetIds,
              triggerContext,
            })
            continue
          }
        }
      }

      attempts.push({ paid: true, success, effect: proc })
    }

    return { attempts, queuedFollowUps }
  }

  // ---------------------------------------------------------------------
  // Internals -- op emission + settlement
  // ---------------------------------------------------------------------

  private origin(
    sourceId: CombatEntityId,
    rootActionId: string,
    originId: string,
  ): CombatOperationOrigin {
    return {
      kind: 'proc',
      originId: `proc.${originId}`,
      sourceId,
      rootActionId,
    }
  }

  private applyBuffOp(
    definitionId: string,
    sourceId: CombatEntityId,
    targetId: CombatEntityId,
    rootActionId: string,
    label: string,
  ): ApplyBuffOperation & { operationId: CombatOperationId; origin: CombatOperationOrigin } {
    return {
      type: 'apply_buff',
      operationId: `proc.${rootActionId}.${label}` as CombatOperationId,
      payload: {
        definitionId: definitionId as ApplyBuffOperation['payload']['definitionId'],
        targetId,
        stacks: 1,
        baseChance: 1,
        reactionEligibility: 'suppressed',
      },
      origin: this.origin(sourceId, rootActionId, label),
    }
  }

  private resourceOp(
    type: 'gain_resource' | 'consume_resource',
    targetId: CombatEntityId,
    amount: number,
    rootActionId: string,
    label: string,
  ): ResolvedCombatOperation {
    const payload = { targetId, resourceId: RESOURCE_THE, amount }
    const operationId = `proc.${rootActionId}.${label}` as CombatOperationId
    const origin = this.origin(targetId, rootActionId, label)
    return type === 'gain_resource'
      ? ({ type, operationId, payload, origin } satisfies GainResourceOperation & {
          operationId: CombatOperationId
          origin: CombatOperationOrigin
        })
      : ({ type, operationId, payload, origin } satisfies ConsumeResourceOperation & {
          operationId: CombatOperationId
          origin: CombatOperationOrigin
        })
  }

  /** Enqueue + settle immediately -- the legacy seam order is preserved
      (the buff/resource lands before the next read in the same action). */
  private emitOp(op: ResolvedCombatOperation): void {
    this.deps.scheduler.enqueueAuthored([op])
    this.deps.scheduler.run()
  }

  /** emitOp variant that reports the op's settle status (the consume
      cost's all-or-nothing gate reads 'resolved' vs 'skipped'). */
  private settleOp(op: ResolvedCombatOperation): CombatOperationResultStatus {
    this.deps.scheduler.enqueueAuthored([op])
    const trace = this.deps.scheduler.run()
    const record = trace.records.find(
      (entry) => entry.operation.operationId === op.operationId,
    )
    return record?.result.status ?? 'failed'
  }
}
