// ReactionTestFixtures.ts -- fixture world builder + fixture ids
// (megaplan M1). The ONLY place fixture ids live: 5 elemental seal defs
// + 4 status defs + a real BuffSystem + the REAL validating
// ElementalStateRegistry (never a stub -- the gate/board fidelity depends
// on sharing one registry with the system under test).
//
// world.applyElement routes a REAL ApplyBuffRequest (eligibility
// 'eligible' by default) through the system and returns the fabricated
// ElementalApplicationCommitted envelope the committed apply produced.

import type { ElementType } from '../../element/ElementType'
import type {
  BuffDefinitionId,
  BuffInstanceId,
  CombatEntityId,
  CombatEventId,
} from '../../battle/contracts/ids'
import type { ApplyBuffRequest } from '../../battle/contracts/operations'
import type { CombatOperationOrigin } from '../../battle/contracts/origin'
import type { CombatAuthorityExecutionContext } from '../../battle/contracts/context'
import type {
  CombatEventPayload,
  ElementalApplicationCommitted,
  PendingCombatEvent,
} from '../../battle/contracts/events'
import { createCapabilityValidatorRegistry } from '../../battle/runtime/capability/CapabilityValidatorRegistry'
import type { BuffDefinition } from '../../buff2/BuffDefinition'
import { BuffRegistry } from '../../buff2/BuffRegistry'
import { BuffStore } from '../../buff2/BuffStore'
import { BuffSystem } from '../../buff2/BuffSystem'
import type {
  BuffEntityReadPort,
  BuffStatReadPort,
  DamageProfileSnapshotPort,
} from '../../buff2/BuffSystem'
import { ApplicationResolver } from '../../buff2/ApplicationResolver'
import {
  makeCollectingSink,
  makeTestDamageProfiles,
  makeTestRng,
  TEST_ENTITIES,
  type CollectedEvents,
  type TestRng,
} from '../../buff2/testing/BuffTestFixtures'
import { createElementalStateRegistry } from '../ElementalStateRegistry'
import type { ElementalStateRegistry } from '../ElementalStateRegistry'
import type { ReactionDefinition } from '../ReactionDefinition'
import type { CombatCapabilityQuery } from '../../battle/contracts/capability'
import { BuffSystemBoardQuery, type ElementalBoardQuery } from '../ReactionBoard'
import { ReactionTriggerGate } from '../ReactionTriggerGate'
import {
  ReactionSystem,
  type ReactionPayoffEmitter,
} from '../ReactionSystem'
import type { ReactionBiasQuery } from '../ReactionBias'
import type { ReactionRegistry } from '../ReactionRegistry'
import { ELEMENTAL_REACTION_CAPABILITY } from '../ReactionTypes'
import { ReactionBatchRunner } from '../ReactionBatchRunner'
import { ReactionDispatcher } from '../ReactionDispatcher'
import {
  resolutionToBatch,
  type ReactionResolution,
} from '../ReactionResolution'
import type { CombatOperationBatch } from '../../battle/contracts/settlement'
import type { ResolvedCombatOperation } from '../../battle/contracts/operations'
import type {
  CombatOperationResult,
  CombatOperationResultBase,
} from '../../battle/contracts/results'
import {
  BatchResultStore,
  CombatOperationBatchRunner,
  isDeferredOperation,
  resultTypeOfBatchEntry,
} from '../../battle/runtime/scheduler/CombatOperationBatchRunner'
import { CombatOperationExecutor } from '../../battle/runtime/scheduler/CombatOperationExecutor'
import type { CombatAuthorityPorts } from '../../battle/runtime/scheduler/CombatAuthorityPorts'

export { TEST_ENTITIES }

export const TEST_ELEMENT_BUFF_IDS: Record<ElementType, BuffDefinitionId> = {
  fire: 'test_seal_fire' as BuffDefinitionId,
  water: 'test_seal_water' as BuffDefinitionId,
  wood: 'test_seal_wood' as BuffDefinitionId,
  metal: 'test_seal_metal' as BuffDefinitionId,
  earth: 'test_seal_earth' as BuffDefinitionId,
}

// Status ids match the production payoff defs (canonical-seals S2 --
// data/reaction/ReactionDefinitions.ts emits these ids; the fixture
// registers synthetic SHAPES under them so payoff tests exercise the
// real production ids without a core->data import).
export const TEST_STATUS_BUFF_IDS = {
  bleed: 'reaction_bleed' as BuffDefinitionId,
  defenseBreak: 'defense_break' as BuffDefinitionId,
  defenseErosion: 'defense_erosion' as BuffDefinitionId,
  camCong: 'cam_cong' as BuffDefinitionId,
} as const

function elementalDef(element: ElementType): BuffDefinition {
  return {
    id: TEST_ELEMENT_BUFF_IDS[element],
    name: `Test Seal ${element}`,
    kind: 'ailment',
    element,
    instanceScope: 'per_source',
    stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 3, scaling: 'fixed' },
    application: { resistance: 'none' },
    dispellable: true,
  }
}

function statusDef(id: BuffDefinitionId, extra?: Partial<BuffDefinition>): BuffDefinition {
  return {
    id,
    name: `Test Status ${id}`,
    kind: 'ailment',
    instanceScope: 'per_source',
    stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 3, scaling: 'fixed' },
    application: { resistance: 'none' },
    dispellable: true,
    ...extra,
  }
}

/** The fixture khac defs author damageProfile 'test_profile'; the
    registry's damage-profile check accepts that plus the production
    'reaction' id so mixed fixture/production data still seals. */
export function fixtureDamageProfileExists(profile: string): boolean {
  return profile === 'test_profile' || profile === 'reaction'
}

/** Fixture CANONICAL_REACTIONS -- the locked ids/priorities with minimal
    payoff steps (M4 authors the real payoff data). Covers all 10
    canonical pairs so registry coverage validation passes. */
export function makeCanonicalReactionDefs(): ReactionDefinition[] {
  const sinh = (
    id: string,
    parent: ElementType,
    child: ElementType,
    selectionTiePriority: number,
  ): ReactionDefinition => ({
    id,
    relation: 'sinh',
    selectionTiePriority,
    elements: { parent, child },
    payoff: {
      steps: [{ kind: 'add_child_stacks', stacks: { op: 'const', value: 1 } }],
    },
  })
  const khac = (
    id: string,
    attacker: ElementType,
    defender: ElementType,
    selectionTiePriority: number,
  ): ReactionDefinition => ({
    id,
    relation: 'khac',
    selectionTiePriority,
    elements: { attacker, defender },
    payoff: {
      steps: [
        {
          kind: 'reaction_damage',
          coefficient: { op: 'const', value: 1 },
          damageProfile: 'test_profile',
          element: 'attacker',
        },
      ],
    },
  })
  return [
    sinh('duong_viem', 'wood', 'fire', 10),
    sinh('luyen_tho', 'fire', 'earth', 20),
    sinh('duong_kim', 'earth', 'metal', 30),
    sinh('tu_thuy', 'metal', 'water', 40),
    sinh('nhuan_moc', 'water', 'wood', 50),
    khac('tuc_viem', 'water', 'fire', 60),
    khac('dung_kim', 'fire', 'metal', 70),
    khac('doan_moc', 'metal', 'wood', 80),
    khac('xuyen_tho', 'wood', 'earth', 90),
    khac('tran_thuy', 'earth', 'water', 100),
  ]
}

export interface ReactionTestWorld {
  readonly system: BuffSystem
  readonly registry: BuffRegistry
  readonly store: BuffStore
  readonly elements: ElementalStateRegistry
  readonly rng: TestRng
  readonly alive: Set<CombatEntityId>
  readonly sink: CollectedEvents & { emit(e: CombatEventPayload): void }
  /** Scripted capability query -- grantAll grants everything; per-call
      override via `capabilities.grant(capId)` sets. */
  readonly capabilities: CombatCapabilityQuery & {
    grant(entityId: CombatEntityId, capabilityId: string): void
    deny(entityId: CombatEntityId, capabilityId: string): void
  }
  readonly boardQuery: ElementalBoardQuery
  readonly gate: ReactionTriggerGate
  /** Builds a ReactionSystem over the world's real gate/board/elements. */
  makeReactionSystem(
    registry: ReactionRegistry,
    opts?: {
      biasQuery?: ReactionBiasQuery
      payoffEmitter?: ReactionPayoffEmitter
    },
  ): ReactionSystem
  /** Batch runner over the REAL executor. The buffs port is the world's
      real BuffSystem; damage/gauge/heal/resource/shield are recording
      STUB ports (the reaction engine never owns those authorities --
      tests assert on the emitted ops + recorded calls, not resolved
      numbers). Pass `ports` to override any of them. */
  makeBatchRunner(opts?: {
    ports?: Partial<CombatAuthorityPorts>
  }): ReactionBatchRunner
  /** The recording stub ports makeBatchRunner wires -- inspectable. */
  readonly stubCalls: {
    damage: { targetId: string; coefficient: number }[]
    gauge: { targetId: string; fractionOfMax: number }[]
    heal: { targetId: string; amount: number }[]
    resource: { kind: 'gain' | 'consume'; targetId: string }[]
    shield: { targetId: string; amount: number }[]
  }
  /** M5 -- the deferred-registration immediate handler over the world's
      real gate/system/elements. `batchFactory` defaults to the shared
      resolutionToBatch; inject a spy to observe the handoff. */
  makeDispatcher(
    system: ReactionSystem,
    opts?: {
      batchFactory?: (resolution: ReactionResolution) => CombatOperationBatch
    },
  ): ReactionDispatcher
  /** M5 -- settles a dispatcher-produced CombatOperationBatch the way
      the scheduler's batch frame does: structural validation ->
      preflight -> ordered ops with deferred materialization through
      the shared contract runner, execution via the stub ports. The
      reaction events are the dispatcher's lane (emitted at dispatch);
      this driver returns the raw op results for assertions. */
  settleBatch(
    batch: CombatOperationBatch,
    opts?: { combatSequence?: number },
  ): readonly CombatOperationResultBase[]
  /** Scripted op ctx (sequence mints per world). */
  makeCtx(origin?: Partial<CombatOperationOrigin>): CombatAuthorityExecutionContext
  /** Real apply through the system; returns the fabricated committed
      envelope (eventId/combatSequence) or undefined when the apply
      produced no elemental commit (failed roll / non-elemental). */
  applyElement(
    sourceId: CombatEntityId,
    targetId: CombatEntityId,
    element: ElementType,
    stacks: number,
    opts?: { reactionEligibility?: 'eligible' | 'suppressed' },
  ): ElementalApplicationCommitted | undefined
}

export function createReactionTestWorld(): ReactionTestWorld {
  const elements = createElementalStateRegistry(TEST_ELEMENT_BUFF_IDS)
  const rng = makeTestRng()
  const alive = new Set<CombatEntityId>(Object.values(TEST_ENTITIES))
  const sink = makeCollectingSink()

  const registry = new BuffRegistry({
    damageProfiles: makeTestDamageProfiles(),
    capabilityValidators: createCapabilityValidatorRegistry(),
  })
  for (const e of Object.keys(TEST_ELEMENT_BUFF_IDS) as ElementType[]) {
    registry.register(elementalDef(e))
  }
  registry.register(statusDef(TEST_STATUS_BUFF_IDS.bleed))
  registry.register(statusDef(TEST_STATUS_BUFF_IDS.defenseBreak))
  registry.register(statusDef(TEST_STATUS_BUFF_IDS.defenseErosion))
  registry.register(
    statusDef(TEST_STATUS_BUFF_IDS.camCong, { forbiddenActionTags: ['attack'] }),
  )
  registry.seal()

  const store = new BuffStore(
    (() => {
      let n = 0
      return () => `buff.test_reaction.${++n}` as BuffInstanceId
    })(),
  )

  const stats: BuffStatReadPort = { getStats: () => undefined }
  const entities: BuffEntityReadPort = { isAlive: (id) => alive.has(id) }
  const snapshots: DamageProfileSnapshotPort = {
    capture: () => ({}),
  }

  const system = new BuffSystem(
    store,
    registry,
    new ApplicationResolver(rng),
    stats,
    entities,
    snapshots,
    elements,
  )

  // Scripted capability query -- grants are explicit per
  // (entity, capability); tests grant ELEMENTAL_REACTION_CAPABILITY to
  // whichever source they need.
  const grants = new Set<string>()
  const capabilities: ReactionTestWorld['capabilities'] = {
    has: (entityId, capabilityId) => grants.has(`${entityId}|${capabilityId}`),
    grant: (entityId, capabilityId) => {
      grants.add(`${entityId}|${capabilityId}`)
    },
    deny: (entityId, capabilityId) => {
      grants.delete(`${entityId}|${capabilityId}`)
    },
  }

  const boardQuery = new BuffSystemBoardQuery(system, elements)
  const gate = new ReactionTriggerGate(capabilities, elements)

  const stubCalls: ReactionTestWorld['stubCalls'] = {
    damage: [],
    gauge: [],
    heal: [],
    resource: [],
    shield: [],
  }

  /** Recording STUB authority ports shared by the batch runner and the
      batch-settle driver -- damage/gauge/heal/resource/shield are never
      reaction-owned authorities; tests assert on recorded calls. */
  const buildPorts = (
    overrides?: Partial<CombatAuthorityPorts>,
  ): CombatAuthorityPorts => ({
    buffs: system,
    damage: {
      dealDamage: (payload) => {
        stubCalls.damage.push({
          targetId: payload.targetId,
          coefficient: payload.coefficient,
        })
        return { rawDamage: 100, hpDamage: 100, killed: false }
      },
    },
    gauge: {
      pushGauge: (targetId, fractionOfMax) => {
        stubCalls.gauge.push({ targetId, fractionOfMax })
        return {
          before: 0,
          requestedDelta: fractionOfMax,
          appliedDelta: fractionOfMax,
          after: fractionOfMax,
        }
      },
    },
    heal: {
      heal: (payload) => {
        stubCalls.heal.push({
          targetId: payload.targetId,
          amount: payload.amount,
        })
        return {
          requested: payload.amount,
          healed: payload.amount,
          after: payload.amount,
        }
      },
    },
    resource: {
      gain: (targetId, _resourceId, amount) => {
        stubCalls.resource.push({ kind: 'gain', targetId })
        return { before: 0, requested: amount, applied: amount, after: amount }
      },
      consume: (targetId, _resourceId, amount) => {
        stubCalls.resource.push({ kind: 'consume', targetId })
        return { before: 0, requested: amount, applied: 0, after: 0 }
      },
    },
    shield: {
      applyShield: (targetId, amount) => {
        stubCalls.shield.push({ targetId, amount })
        return { applied: amount, shieldAfter: amount }
      },
    },
    ...overrides,
  })

  let seq = 0
  let eventSeq = 0

  const makeCtx: ReactionTestWorld['makeCtx'] = (origin = {}) => {
    const full: CombatOperationOrigin = {
      kind: 'skill',
      originId: 'test_reaction_op',
      sourceId: TEST_ENTITIES.sourceA,
      rootActionId: 'root.test_reaction.1',
      ...origin,
    }
    return {
      operationId: `op.test_reaction.${++seq}`,
      origin: full,
      events: sink,
      combatSequence: ++seq * 100,
    }
  }

  return {
    system,
    registry,
    store,
    elements,
    rng,
    alive,
    sink,
    capabilities,
    boardQuery,
    gate,
    stubCalls,
    makeReactionSystem(reactionRegistry, opts = {}) {
      return new ReactionSystem(
        reactionRegistry,
        boardQuery,
        gate,
        opts.biasQuery,
        opts.payoffEmitter,
      )
    },
    makeBatchRunner(opts = {}) {
      const ports = buildPorts(opts.ports)
      return new ReactionBatchRunner(
        new CombatOperationExecutor(ports),
        system,
        (id) => alive.has(id),
      )
    },
    makeDispatcher(reactionSystem, opts = {}) {
      return new ReactionDispatcher(
        gate,
        reactionSystem,
        elements,
        opts.batchFactory ?? resolutionToBatch,
      )
    },
    settleBatch(batch, opts = {}) {
      const combatSequence = opts.combatSequence ?? ++seq * 100
      const contractRunner = new CombatOperationBatchRunner({
        isAlive: (id) => alive.has(id),
        getBuffInstance: (instanceId) =>
          system.getInstance({ kind: 'instance', instanceId }),
      })
      const ports = buildPorts()
      const executor = new CombatOperationExecutor(ports)
      contractRunner.validateBatchStructure(batch)
      if (!contractRunner.preflight(batch)) {
        return batch.operations.map((entry) => ({
          operationId: entry.operationId,
          type: resultTypeOfBatchEntry(entry),
          status: 'skipped',
          reason: 'stale_reaction_snapshot',
        }) as CombatOperationResult)
      }
      const inBatch = new BatchResultStore()
      const results: CombatOperationResultBase[] = []
      for (const entry of batch.operations) {
        let op = entry as ResolvedCombatOperation
        if (isDeferredOperation(entry)) {
          const skipReason = contractRunner.deferredSkipReason(entry, inBatch)
          if (skipReason !== undefined) {
            results.push({
              operationId: entry.operationId,
              type: resultTypeOfBatchEntry(entry),
              status: 'skipped',
              reason: skipReason,
            } as CombatOperationResult)
            continue
          }
          op = contractRunner.materialize(entry, inBatch)
        }
        const ctx: CombatAuthorityExecutionContext = {
          operationId: op.operationId,
          origin: op.origin,
          events: sink,
          combatSequence,
        }
        const result = executor.execute(op, ctx)
        inBatch.record(op, result)
        results.push(result)
      }
      return results
    },
    makeCtx,
    applyElement(sourceId, targetId, element, stacks, opts = {}) {
      const ctx = makeCtx()
      const req: ApplyBuffRequest = {
        definitionId: TEST_ELEMENT_BUFF_IDS[element],
        sourceId,
        targetId,
        stacks,
        baseChance: 1,
        reactionEligibility: opts.reactionEligibility ?? 'eligible',
        origin: ctx.origin,
      }
      const before = sink.events.length
      const result = system.apply(req, ctx)
      if (!result.applied) return undefined
      const emitted = sink.events
        .slice(before)
        .find(
          (e): e is Extract<PendingCombatEvent, { type: 'elemental_application_committed' }> =>
            e.type === 'elemental_application_committed',
        )
      if (emitted === undefined) return undefined
      // Fabricate the envelope the scheduler would have stamped -- the
      // collecting sink stores the envelope-free payload verbatim.
      const { eventId: _unminted, ...rest } = emitted
      void _unminted
      return {
        ...rest,
        eventId: `evt.test_reaction.${++eventSeq}` as CombatEventId,
        combatSequence: ++seq * 100,
      }
    },
  }
}
