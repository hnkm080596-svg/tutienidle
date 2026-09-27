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
  BuffDefinitionId,
  CombatEntityId,
  CombatOperationId,
} from '../battle/contracts/ids'
import type {
  ApplyBuffOperation,
  ConsumeResourceOperation,
  GainResourceOperation,
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
import { RESOURCE_THE } from '../combat/CombatTypes'
import { THE_PROC_COST } from '../the-tu/TheEconomy'
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
  /** Present+true only when the grant reached the chance roll --
      distinguishes a rolled attempt (trigger consumed) from an
      unaffordable skip ({paid:false,success:false} without a roll). */
  rolled?: boolean
  effect?: ReactiveProcPayload
}

export interface ReactiveProcContext {
  attacker?: { id: CombatEntityId; entity: CombatEntity }
  outcome?: 'taken' | 'evaded'
  intercepted?: boolean
  triggeringTargets?: readonly { id: CombatEntityId; entity: CombatEntity }[]
}

const REFLECTION_PROFILE = 'reflection'

/**
 * The Tu beta (Phan Chan) -- ONE reflect per hostile ACTION: hits of the
 * same action merge into a pending entry keyed on holderId (one reflect per holder per action),
 * then the action-end flush emits a single 'reflection' op per entry.
 * Multi-hit actions settle fully before the reflect fires; the attacker
 * identity is the action's source, so every hit of the action carries it.
 */
interface PendingReflect {
  holderId: CombatEntityId
  attackerId: CombatEntityId
  maxHpRatio: number
  markedMaxHpRatio?: number
  markedBy?: BuffDefinitionId
  rootActionId: string
  grantInstanceId: string
  capabilityId: string
}

export class CombatProcSystem {
  private readonly pendingReflects = new Map<string, PendingReflect>()

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
    context:
      | {
          attacker?: CombatEntity
          hpDamage?: number
          /** The Tu beta -- false for non-natural action sources
              (counter/follow_up/intercept: INV-9 parity); absent = eligible
              (context-less calls never reach the reflect branch anyway). */
          reflectsEligible?: boolean
        }
      | undefined,
    rootActionId: string,
  ): ReactiveTriggerRollResult {
    let firedFollowUp = false
    const holder = this.deps.resolveEntity(holderId)

    for (const grant of this.deps.buffs.getCapabilities(holderId)) {
      const reactive = asReactiveTrigger(grant)
      if (reactive === undefined || reactive.trigger !== trigger) continue
      // INV-9 applies to the whole lane: a non-natural action source
      // (counter/follow_up/intercept) opens no reactive outcome at all --
      // skip before the roll so excluded sources consume no RNG.
      if (context?.reflectsEligible === false) continue
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

      // The Tu beta (Phan Chan) -- one reflect per hostile ACTION: queue
      // here, emit at the action-end flushReflects(). Gates: a TAKEN hit
      // (hpDamage>0), a living attacker, a defined holder (holder.alive
      // is deliberately NOT gated - post-mortem reflect is spec-pinned),
      // a natural action source (reflectsEligible), and never
      // self-inflicted damage. AoE hits that deal hpDamage queue the
      // same way; every later hit of the same action merges into the
      // same pending entry.
      if (
        reactive.reflectsDamage !== undefined &&
        context?.attacker !== undefined &&
        (context.hpDamage ?? 0) > 0 &&
        context.attacker.alive &&
        context.attacker.id !== holderId &&
        holder !== undefined
      ) {
        // Spec: one reflect per holder per hostile action -- key on the
        // holder only so a second reflecting capability cannot emit twice.
        const key = holderId
        if (!this.pendingReflects.has(key)) {
          this.pendingReflects.set(key, {
            holderId,
            attackerId: context.attacker.id,
            maxHpRatio: reactive.reflectsDamage.maxHpRatio,
            markedMaxHpRatio: reactive.reflectsDamage.markedMaxHpRatio,
            markedBy: reactive.reflectsDamage.markedBy,
            rootActionId,
            grantInstanceId: grant.instanceId,
            capabilityId: grant.capability.id,
          })
        }
      }
    }

    return { firedFollowUp }
  }

  /**
   * Drops queued reflects without emitting. The queue is action-scoped:
   * a throw mid-action would otherwise leak entries into the next
   * action's dedupe map (mistimed fire + suppressed fresh entry).
   */
  discardPendingReflects(): void {
    this.pendingReflects.clear()
  }

  /**
   * The Tu beta -- action-end settle: emit ONE 'reflection' op per
   * pending holderId entry. The damage authority resolves it
   * (flat, holder-as-attacker, never a hit roll / crit / turn). The
   * caller drains once per applied action -- an empty map is a no-op, so
   * actions that damaged no reflect-holder cost nothing.
   */
  flushReflects(): void {
    if (this.pendingReflects.size === 0) return

    const entries = [...this.pendingReflects.values()]
    this.pendingReflects.clear()

    for (const entry of entries) {
      const holder = this.deps.resolveEntity(entry.holderId)
      const attacker = this.deps.resolveEntity(entry.attackerId)
      // Post-mortem retaliation: a holder killed by the triggering hit
      // still reflects -- the authored amount derives from maxHp, not
      // live vitals (legacy semantics + Tran The tanking fantasy).
      if (holder === undefined) continue
      if (attacker === undefined || !attacker.alive) continue

      // Mark check at FLUSH time (post-settle): a chan_an instance the
      // holder sourced on the attacker upgrades the coefficient; the
      // mark itself is never consumed.
      const marked =
        entry.markedBy !== undefined &&
        this.deps.buffs
          .getForTarget(entry.attackerId)
          .some(
            (inst) =>
              inst.definitionId === entry.markedBy &&
              inst.sourceId === entry.holderId,
          )
      const ratio =
        marked && entry.markedMaxHpRatio !== undefined
          ? entry.markedMaxHpRatio
          : entry.maxHpRatio
      const coefficient = holder.stats.maxHp * ratio
      if (coefficient <= 0) continue

      this.emitOp({
        type: 'deal_damage',
        operationId:
          `proc.${entry.rootActionId}.reflect.${entry.grantInstanceId}.${entry.capabilityId}` as CombatOperationId,
        payload: {
          targetId: entry.attackerId,
          damageProfile: REFLECTION_PROFILE,
          coefficient,
          hitCount: 1,
          canCrit: false,
          canMiss: false,
        },
        origin: this.origin(entry.holderId, entry.rootActionId, `reflect.${entry.capabilityId}`),
      })
    }
  }

  /**
   * reactive_proc lane (Ung The beta): the holder's intercept/counter/
   * follow-up grants at a reactive window. Fail-fast order per attempt
   * (design Part XI): gates -> roll -> pay on SUCCESS -> commit. A
   * window the caller suppressed (dead / hard-CC / Qua The) never
   * reaches this lane, so no RNG is consumed; an affordable-but-failed
   * roll spends NOTHING.
   *
   * Per attempt: the flat authored `theCost` gates affordability
   * (balance read only -- no consume op yet), the authored chanceStat
   * rolls, and on success the consume_resource op pays (its settle
   * result is checked), the queuedAction descriptor returns for the
   * caller's bypass queue, and the Ho Bich ward descriptor rides the
   * attempt for the window's substitution code.
   *
   * Dead-holder guard: a participant killed before this window performs
   * NO transaction -- no cost, no rng draw, no queue (design: a dead
   * actor's queued payload likewise never resolves, with no refund).
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
      // 'once' = stop after the first ROLLED attempt -- an unaffordable
      // grant (skipped before the roll) must not consume the trigger
      // and suppress a later affordable grant on the same holder.
      if (opts.once === true && attempts.some((attempt) => attempt.rolled === true)) {
        return { attempts, queuedFollowUps }
      }

      const cost = proc.theCost ?? THE_PROC_COST
      if ((holder.currentThe ?? 0) < cost) {
        attempts.push({ paid: false, success: false })
        continue
      }

      const chance = clampStatValue(
        proc.chanceStat,
        holder.stats[proc.chanceStat] ?? 0,
      )
      const success = this.deps.rng.rollChance(chance)
      let paid = false

      if (success) {
        // Success-only consume (design Part XI): the flat authored cost
        // pays AFTER the roll -- a failed roll spends nothing, and no
        // refund channel exists.
        paid =
          this.settleOp(
            this.resourceOp(
              'consume_resource',
              holderId,
              cost,
              opts.rootActionId,
              `cost.${grant.instanceId}.${grant.capability.id}`,
            ),
          ) === 'resolved'

        if (paid && proc.queuedAction !== undefined) {
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
            attempts.push({ paid, success, rolled: true, effect: proc })
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

      attempts.push({ paid, success, rolled: true, effect: proc })
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
