// buff2 M4 -- shared test runtime for TurnBattleSystem unit tests.
// Mirrors GameManagerTurnBattleOps.mintCycleScheduler: one BuffSystem
// authority over a battle-local BuffStore, CombatProcSystem, the
// CombatScheduler with the same immediate-handler wiring, and the
// GaugeDeltaHandler. Tests pass a live participant resolver (participants
// are constructed before the TurnBattle wrapper) and keep the returned
// handle for buff assertions + state seeding.

import type { CombatSystem } from '../../../combat/CombatSystem'
import { ApplicationResolver } from '../../../buff2/ApplicationResolver'
import { BuffRegistry } from '../../../buff2/BuffRegistry'
import { BuffStore } from '../../../buff2/BuffStore'
import { BuffSystem } from '../../../buff2/BuffSystem'
import type { BuffDefinition } from '../../../buff2/BuffDefinition'
import type { BuffSnapshotData } from '../../../buff2/BuffInstance'
import type {
  BuffDefinitionId,
  BuffInstanceId,
  CombatEntityId,
} from '../../contracts/ids'
import type { CombatRng } from '../../contracts/rng'
import type { CombatAuthorityExecutionContext } from '../../contracts/context'
import type {
  BuffAppliedEvent,
  CombatEventPayload,
  PeriodicOperationSettled,
} from '../../contracts/events'
import { FunctionCombatRng } from '../../runtime/rng/FunctionCombatRng'
import { CombatOperationExecutor } from '../../runtime/scheduler/CombatOperationExecutor'
import { CombatScheduler } from '../../runtime/scheduler/CombatScheduler'
import { CombatSystemDamageAdapter } from '../../runtime/scheduler/adapters/CombatSystemDamageAdapter'
import { CombatSystemHealAdapter } from '../../runtime/scheduler/adapters/CombatSystemHealAdapter'
import { ActionGaugeAdapter } from '../../runtime/scheduler/adapters/ActionGaugeAdapter'
import { EntityResourceAdapter } from '../../runtime/scheduler/adapters/EntityResourceAdapter'
import { VitalsShieldAdapter } from '../../runtime/scheduler/adapters/VitalsShieldAdapter'
import { createDefaultCapabilityValidators } from '../../runtime/capability/DefaultCapabilityValidators'
import { createElementalStateRegistry } from '../../../reaction/ElementalStateRegistry'
import { CombatProcSystem } from '../../../proc/CombatProcSystem'
import { createDamageProfileCatalog } from '../../../combat/DamageProfiles'
import type { TurnBattleParticipant, TurnCombatRuntime } from '../TurnBattleSystem'
import { GaugeDeltaHandler } from '../GaugeDeltaHandler'

export interface TurnRuntimeFixture extends TurnCombatRuntime {
  readonly registry: BuffRegistry
  readonly rng: CombatRng
  readonly events: CombatEventPayload[]
  /** Mint an execution context for direct authority calls (state seeding). */
  makeCtx(origin?: Partial<CombatAuthorityExecutionContext['origin']>): CombatAuthorityExecutionContext
  /** Seed a buff directly through the authority -- test setup shorthand
      for ApplyBuffRequest + ctx (deterministic, settles nothing). */
  applyBuff(
    definitionId: string,
    target: TurnBattleParticipant,
    source?: TurnBattleParticipant,
    overrides?: { stacks?: number; durationOverride?: number },
  ): void
  /** Run the holder-turn-end lifecycle boundary on one entity through a
      real scheduler lifecycle sink -- same root shape TBS mints. */
  tickHolderTurnsEnd(entityId: string): void
}

export function makeTurnRuntime(opts: {
  registry: BuffRegistry
  /** Live participant source -- tests typically pass a closure over the
      array they fill while building the battle. */
  participants: () => readonly TurnBattleParticipant[]
  combatSystem: CombatSystem
  rng?: CombatRng
}): TurnRuntimeFixture {
  const rng = opts.rng ?? new FunctionCombatRng(() => Math.random())
  const resolveParticipant = (
    id: CombatEntityId,
  ): TurnBattleParticipant | undefined =>
    opts.participants().find((participant) => participant.id === id)
  const resolveEntity = (id: CombatEntityId) => resolveParticipant(id)?.entity

  let instanceCounter = 0
  const buffs = new BuffSystem(
    new BuffStore(
      () => `buff.test.${++instanceCounter}` as BuffInstanceId,
    ),
    opts.registry,
    new ApplicationResolver(rng),
    { getStats: (id) => resolveEntity(id)?.stats },
    { isAlive: (id) => resolveEntity(id)?.alive ?? false },
    {
      capture: (_profileId, sourceId, fields): BuffSnapshotData => {
        const stats = resolveEntity(sourceId)?.stats as
          | Record<string, unknown>
          | undefined
        const snapshot: Record<string, number> = {}
        for (const field of fields) {
          const value = stats?.[field]
          if (typeof value === 'number') {
            snapshot[field] = value
          }
        }
        return snapshot
      },
    },
    // Tests bind the same canonical five-element map -- fixture defs do
    // not carry elemental-state semantics.
    createElementalStateRegistry({
      fire: 'hoa_an' as BuffDefinitionId,
      water: 'han_tuc' as BuffDefinitionId,
      wood: 'doc_can' as BuffDefinitionId,
      metal: 'liet_thuong' as BuffDefinitionId,
      earth: 'tran_an' as BuffDefinitionId,
    }),
  )

  const executor = new CombatOperationExecutor({
    damage: new CombatSystemDamageAdapter(opts.combatSystem, resolveEntity, {
      resolveSourceGrants: (id: CombatEntityId) => buffs.getCapabilities(id),
    }),
    heal: new CombatSystemHealAdapter(opts.combatSystem, resolveEntity),
    gauge: new ActionGaugeAdapter(resolveParticipant, resolveEntity),
    resource: new EntityResourceAdapter(resolveEntity),
    shield: new VitalsShieldAdapter(opts.combatSystem.vitals, resolveEntity),
    buffs,
  })

  const scheduler = new CombatScheduler(executor, {
    preconditions: {
      isAlive: (id) => resolveParticipant(id)?.entity.alive ?? false,
      getBuffInstance: (instanceId) => {
        const snapshot = buffs.getInstance({ kind: 'instance', instanceId })
        return snapshot === undefined
          ? undefined
          : {
              sourceId: snapshot.sourceId,
              targetId: snapshot.targetId,
              stacks: snapshot.stacks,
            }
      },
    },
  })

  const gaugeHandler = new GaugeDeltaHandler(opts.registry)
  const procs = new CombatProcSystem({
    buffs,
    rng,
    scheduler,
    resolveEntity,
  })

  scheduler.registerImmediateHandler('periodic_operation_settled', (event, sink) => {
    buffs.handlePeriodicSettled(event as PeriodicOperationSettled, sink)
  })
  scheduler.registerImmediateHandler('buff_applied', (event) => {
    gaugeHandler.handleBuffApplied(event as BuffAppliedEvent)
  })

  const events: CombatEventPayload[] = []
  let seq = 0

  return {
    buffs,
    procs,
    scheduler,
    gaugeHandler,
    registry: opts.registry,
    rng,
    events,
    makeCtx(origin = {}) {
      seq += 1
      return {
        operationId: `op.test.${seq}` as CombatAuthorityExecutionContext['operationId'],
        origin: {
          kind: 'skill',
          originId: 'test_op',
          sourceId: 'test_source' as CombatEntityId,
          rootActionId: 'root.test.1',
          ...origin,
        },
        events: { emit: (event: CombatEventPayload) => events.push(event) },
        combatSequence: seq * 100,
      }
    },
    applyBuff(definitionId, target, source = target, overrides = {}) {
      buffs.apply(
        {
          definitionId: definitionId as BuffDefinitionId,
          sourceId: source.entity.id,
          targetId: target.entity.id,
          stacks: overrides.stacks ?? 1,
          baseChance: 1,
          durationOverride: overrides.durationOverride,
          reactionEligibility: 'eligible',
          origin: {
            kind: 'skill',
            originId: 'test_seed',
            sourceId: source.entity.id,
            rootActionId: 'root.test.seed',
          },
        },
        this.makeCtx(),
      )
    },
    tickHolderTurnsEnd(entityId) {
      const { sink, sequence, settle } = scheduler.createLifecycleSink(
        `test.holder_turn_end.${entityId}`,
      )
      buffs.onHolderTurnEnd(entityId as CombatEntityId, {
        rootActionId: `test.holder_turn_end.${entityId}`,
        sequence,
        events: sink,
        settle,
      })
    },
  }
}

/** Build + seal a test registry from fixture defs (mirrors the production
    validator deps so seal-time checks run identically). */
export function makeTestBuffRegistry(
  definitions: readonly BuffDefinition[],
): BuffRegistry {
  const registry = new BuffRegistry({
    damageProfiles: createDamageProfileCatalog(),
    capabilityValidators: createDefaultCapabilityValidators(),
  })
  for (const definition of definitions) {
    registry.register(definition)
  }
  registry.seal()
  return registry
}
