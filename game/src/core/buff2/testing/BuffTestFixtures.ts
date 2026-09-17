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
