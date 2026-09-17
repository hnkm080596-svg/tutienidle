// BuffTestFixtures.ts -- fixture world builder for buff2 tests. Owns the
// `test_*` id namespace: buff M1-M3 tests use it, and the reaction plan's
// fixture module IMPORTS from here (shared naming -- one fixture world,
// two consumers).
//
// Nothing here ships to production: test defs are authored in `test_*`
// space, the damage-profile stub declares a closed profile catalog, and
// the capability validator registry starts EMPTY (unknown grant types
// throw by default -- register a stub validator per test).

import type {
  BuffDefinitionId,
  BuffInstanceId,
  CombatEntityId,
} from '../../battle/contracts/ids'
import type { CombatAuthorityExecutionContext } from '../../battle/contracts/context'
import type { CombatOperationOrigin } from '../../battle/contracts/origin'
import type {
  CombatEventPayload,
  PendingCombatEvent,
  PeriodicOperationSettled,
} from '../../battle/contracts/events'
import type {
  CombatOperationResultReason,
  CombatOperationResultStatus,
} from '../../battle/contracts/results'
import type { CombatRng } from '../../battle/contracts/rng'
import type { ElementalStateRegistry } from '../../battle/contracts/elemental'
import type { ElementType } from '../../element/ElementType'
import { ApplicationResolver } from '../ApplicationResolver'
import {
  BuffSystem,
  type BuffEntityReadPort,
  type BuffStatReadPort,
  type DamageProfileSnapshotPort,
} from '../BuffSystem'
import {
  createCapabilityValidatorRegistry,
  type CapabilityValidatorRegistry,
} from '../../battle/runtime/capability/CapabilityValidatorRegistry'
import type { BuffInstance } from '../BuffInstance'
import type { BuffDefinition } from '../BuffDefinition'
import {
  BuffRegistry,
  type BuffDamageProfileCatalog,
} from '../BuffRegistry'
import { BuffStore } from '../BuffStore'
import { createBuffReadPort, type BuffReadPort } from '../BuffQuery'
import type { BuffLifecycleContext } from '../BuffLifecycleContext'

/** Canonical test entity ids (reaction plan shares this namespace). */
export const TEST_ENTITIES = {
  sourceA: 'test_entity.src.a' as CombatEntityId,
  sourceB: 'test_entity.src.b' as CombatEntityId,
  targetA: 'test_entity.tgt.a' as CombatEntityId,
  targetB: 'test_entity.tgt.b' as CombatEntityId,
} as const

/** Closed test damage-profile catalog: 'test_profile' exists and declares
    the snapshot schema ['attack','element_mastery']; 'test_profile_empty'
    exists but snapshots nothing. Anything else is unknown. */
export function makeTestDamageProfiles(): BuffDamageProfileCatalog {
  const catalog: Record<string, readonly string[]> = {
    test_profile: ['attack', 'element_mastery'],
    test_profile_empty: [],
  }
  return {
    has: (id) => id in catalog,
    snapshotFields: (id) => catalog[id] ?? [],
  }
}

export interface BuffWorld {
  store: BuffStore
  registry: BuffRegistry
  query: BuffReadPort
  capabilityValidators: CapabilityValidatorRegistry
  battleId: string
  /** Deterministic instance counter feeding BuffStore.nextInstanceId. */
  mintInstanceId(): BuffInstanceId
  /** Counter for modifierRuntimeIds minted by tests (`bmr.test.${n}`). */
  mintModifierRuntimeId(instanceId: BuffInstanceId): string
  /** Author a valid test definition -- every required field present;
      overrides merge shallowly. Register via world.registry.register(). */
  makeTestDefinition(overrides?: Partial<BuffDefinition>): BuffDefinition
  /** Build a runtime instance (no validation -- tests own the fields). */
  makeTestInstance(overrides?: Partial<BuffInstance>): BuffInstance
}

export function makeBuffWorld(opts?: {
  battleId?: string
  damageProfiles?: BuffDamageProfileCatalog
  capabilityValidators?: CapabilityValidatorRegistry
}): BuffWorld {
  const battleId = opts?.battleId ?? 'test_battle.1'
  let instanceCounter = 0
  const mintInstanceId = (): BuffInstanceId =>
    `buff.${battleId}.${++instanceCounter}` as BuffInstanceId

  const capabilityValidators =
    opts?.capabilityValidators ?? createCapabilityValidatorRegistry()
  const registry = new BuffRegistry({
    damageProfiles: opts?.damageProfiles ?? makeTestDamageProfiles(),
    capabilityValidators,
  })
  const store = new BuffStore(mintInstanceId)
  const query = createBuffReadPort(store, registry)

  const modifierCounters = new Map<string, number>()

  return {
    store,
    registry,
    query,
    capabilityValidators,
    battleId,
    mintInstanceId,
    mintModifierRuntimeId(instanceId) {
      const n = (modifierCounters.get(instanceId) ?? 0) + 1
      modifierCounters.set(instanceId, n)
      return `bmr.${instanceId}.${n}`
    },
    makeTestDefinition(overrides = {}) {
      const n = registry.all().length + 1
      return {
        id: `test_buff.${n}` as BuffDefinitionId,
        name: `Test Buff ${n}`,
        kind: 'buff',
        instanceScope: 'per_source',
        stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
        lifetime: { clock: 'holder_turns', duration: 3, scaling: 'fixed' },
        dispellable: true,
        ...overrides,
      } as BuffDefinition
    },
    makeTestInstance(overrides = {}) {
      return {
        instanceId: mintInstanceId(),
        definitionId: 'test_buff.1' as BuffDefinitionId,
        sourceId: TEST_ENTITIES.sourceA,
        targetId: TEST_ENTITIES.targetA,
        stacks: 1,
        remaining: 3,
        continuousTurns: 0,
        continuousSeconds: 0,
        modifiers: [],
        createdSequence: 0,
        lastAppliedSequence: 0,
        ...overrides,
      } as BuffInstance
    },
  }
}

// ---------------------------------------------------------------------------
// BuffSystem-level world (M2+): authority + ports + scripted ctx.
// ---------------------------------------------------------------------------

/** Deterministic CombatRng spy -- queue rolls explicitly; every
    rollChance consumes exactly one queued value (defaults to 0 so an
    unqueued rollChance(>0) succeeds deterministically). */
export interface TestRng extends CombatRng {
  /** Rolls consumed so far (stream-parity assertions). */
  readonly rolls: number
  queue(...values: number[]): void
}

export function makeTestRng(defaultRoll = 0): TestRng {
  const queued: number[] = []
  let rolls = 0
  return {
    get rolls() {
      return rolls
    },
    queue(...values: number[]) {
      queued.push(...values)
    },
    roll() {
      rolls += 1
      return queued.shift() ?? defaultRoll
    },
    rollChance(chance: number) {
      return this.roll() < chance
    },
  }
}

export interface CollectedEvents {
  readonly events: readonly PendingCombatEvent[]
  ofType<T extends PendingCombatEvent['type']>(
    type: T,
  ): Extract<PendingCombatEvent, { type: T }>[]
  clear(): void
}

export function makeCollectingSink(): CollectedEvents & { emit(e: CombatEventPayload): void } {
  const events: PendingCombatEvent[] = []
  return {
    events,
    emit(e) {
      events.push(e as PendingCombatEvent)
    },
    ofType(type) {
      return events.filter((e) => e.type === type) as never[]
    },
    clear() {
      events.length = 0
    },
  }
}

export interface BuffSystemWorld extends BuffWorld {
  system: BuffSystem
  rng: TestRng
  stats: Map<CombatEntityId, NonNullable<ReturnType<BuffStatReadPort['getStats']>>>
  alive: Set<CombatEntityId>
  snapshots: Map<string, Record<string, number>>
  elementalMap: Map<BuffDefinitionId, ElementType>
  sink: ReturnType<typeof makeCollectingSink>
  /** Scripted op-scope ctx -- events land in world.sink; combatSequence
      mints from a per-world counter. */
  makeCtx(origin?: Partial<CombatOperationOrigin>): CombatAuthorityExecutionContext
  /** Lifecycle root ctx -- sink-shared emissions; `settle` is a spy
      (tests assert per-unit + final barrier counts). */
  makeLctx(): BuffLifecycleContext & { settles: number }
  /** Drive the registered 'periodic_operation_settled' handler with a
      synthesized event (tests stand in for the scheduler bridge). */
  settlePeriodic(
    requestId: string,
    status?: CombatOperationResultStatus,
    reason?: CombatOperationResultReason,
  ): void
}

export function makeBuffSystemWorld(opts?: {
  battleId?: string
  damageProfiles?: BuffDamageProfileCatalog
  elementalMap?: Map<BuffDefinitionId, ElementType>
}): BuffSystemWorld {
  const world = makeBuffWorld(opts)
  const rng = makeTestRng()
  const stats: BuffSystemWorld['stats'] = new Map()
  const alive = new Set<CombatEntityId>(Object.values(TEST_ENTITIES))
  const snapshots: BuffSystemWorld['snapshots'] = new Map()
  const elementalMap = opts?.elementalMap ?? new Map<BuffDefinitionId, ElementType>()
  const sink = makeCollectingSink()
  let seq = 0

  const statsPort: BuffStatReadPort = { getStats: (id) => stats.get(id) }
  const entitiesPort: BuffEntityReadPort = { isAlive: (id) => alive.has(id) }
  const snapshotsPort: DamageProfileSnapshotPort = {
    capture: (profileId, sourceId, fields) => {
      const key = `${profileId}:${sourceId}`
      const authored = snapshots.get(key) ?? {}
      const out: Record<string, number> = {}
      for (const f of fields) out[f] = authored[f] ?? 0
      return out
    },
  }
  const elemental: ElementalStateRegistry = {
    getDefinitionId: (element) => {
      for (const [defId, el] of elementalMap) if (el === element) return defId
      return `test_an.${element}` as BuffDefinitionId
    },
    getElement: (defId) => elementalMap.get(defId) ?? null,
  }

  const system = new BuffSystem(
    world.store,
    world.registry,
    new ApplicationResolver(rng),
    statsPort,
    entitiesPort,
    snapshotsPort,
    elemental,
  )

  return {
    ...world,
    system,
    rng,
    stats,
    alive,
    snapshots,
    elementalMap,
    sink,
    makeCtx(origin = {}) {
      return {
        operationId: `op.test.${++seq}`,
        origin: {
          kind: 'skill',
          originId: 'test_op',
          sourceId: TEST_ENTITIES.sourceA,
          rootActionId: 'root.test.1',
          ...origin,
        },
        events: sink,
        combatSequence: ++seq * 100,
      }
    },
    makeLctx() {
      const lctx: BuffLifecycleContext & { settles: number } = {
        rootActionId: `status.test.${++seq}`,
        sequence: ++seq * 100,
        events: sink,
        settles: 0,
        settle() {
          lctx.settles++
          return new Map()
        },
      }
      return lctx
    },
    settlePeriodic(requestId, status = 'resolved', reason) {
      const event: PeriodicOperationSettled = {
        type: 'periodic_operation_settled',
        eventId: `evt.periodic.${requestId}.0`,
        combatSequence: ++seq * 100,
        requestId,
        operationId: `periodic.${requestId}`,
        causationOperationId: `periodic.${requestId}`,
        rootActionId: 'status.test.1',
        status,
        ...(reason !== undefined ? { reason } : {}),
      }
      system.handlePeriodicSettled(event, sink)
    },
  }
}
