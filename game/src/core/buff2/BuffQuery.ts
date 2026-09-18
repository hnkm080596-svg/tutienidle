// BuffQuery.ts -- spec sec.51 read-only surface handed to
// Reaction/Skill/UI/ops layer. Every accessor returns SNAPSHOTS (deep-
// frozen copies) -- consumers can never mutate the store through this port
// and can never be mutated by later store writes.

import type { BuffInstanceSelector } from '../battle/contracts/selectors'
import type { ActiveCapabilityGrant } from '../battle/contracts/capability'
import type {
  BuffDefinitionId,
  BuffInstanceId,
  CombatEntityId,
} from '../battle/contracts/ids'
import type { StatModifier } from '../stats/StatCalculator'
import type { BuffDefinition } from './BuffDefinition'
import type { BuffInstance, BuffInstanceSnapshot } from './BuffInstance'
import { snapshotInstance } from './BuffInstance'
import type { BuffModifier } from './BuffModifier'
import type { BuffStore } from './BuffStore'

export interface BuffReadPort {
  getInstance(sel: BuffInstanceSelector): BuffInstanceSnapshot | undefined
  getForTarget(targetId: CombatEntityId): readonly BuffInstanceSnapshot[]
  getForSource(sourceId: CombatEntityId): readonly BuffInstanceSnapshot[]
  getByDefinition(
    targetId: CombatEntityId,
    definitionId: BuffDefinitionId,
  ): readonly BuffInstanceSnapshot[]
  getStacks(sel: BuffInstanceSelector): number
  getModifiers(sel: BuffInstanceSelector): readonly BuffModifier[] // frozen copies
  getStatModifiers(targetId: CombatEntityId): StatModifier[] // R-B5 -- legacy StatModifier shape incl. stacks
  getCapabilities(targetId: CombatEntityId): readonly ActiveCapabilityGrant[] // spec sec.51 -- CANONICAL ORDER (r4 HIGH 2): sort definitionId -> sourceId -> instanceId -> capabilityId; identical capability sets return identical order regardless of insertion history -- consumers' RNG consumption order is insertion-independent
  hasControl(
    targetId: CombatEntityId,
    control: 'stun' | 'freeze' | 'root',
  ): boolean // spec sec.50
  hasForbiddenTags(entityId: CombatEntityId): ReadonlySet<string> // resolves def.forbiddenActionTags over the entity's instances
  has(sel: BuffInstanceSelector): boolean
}

/** Catalog surface the query needs for definition lookups. The buff2
    BuffRegistry satisfies it; tests may substitute a Map-backed stub. */
export interface BuffDefinitionLookup {
  get(id: BuffDefinitionId): BuffDefinition
  tryGet?(id: BuffDefinitionId): BuffDefinition | undefined
}

function resolveInstance(
  store: BuffStore,
  sel: BuffInstanceSelector,
): BuffInstance | undefined {
  switch (sel.kind) {
    case 'instance':
      return store.get(sel.instanceId)
    case 'identity':
      return store.find(sel.definitionId, sel.sourceId, sel.targetId)
    case 'target_definition':
      return store.findOnTarget(sel.definitionId, sel.targetId)
  }
}

/** spec sec.55 comparator minus periodicId: the canonical multi-instance
    order for observable sweeps (capabilities, stat projection). */
function compareInstance(a: BuffInstance, b: BuffInstance): number {
  return (
    a.targetId.localeCompare(b.targetId) ||
    a.definitionId.localeCompare(b.definitionId) ||
    a.sourceId.localeCompare(b.sourceId) ||
    a.instanceId.localeCompare(b.instanceId)
  )
}

export function sourceTypeOf(definition: BuffDefinition): 'buff' | 'debuff' {
  if (definition.polarity !== undefined) return definition.polarity
  return definition.kind === 'debuff' || definition.kind === 'ailment'
    ? 'debuff'
    : 'buff'
}

export function createBuffReadPort(
  store: BuffStore,
  definitions: BuffDefinitionLookup,
): BuffReadPort {
  const snapshotOf = (instance: BuffInstance | undefined) =>
    instance === undefined ? undefined : snapshotInstance(instance)

  return {
    getInstance(sel) {
      return snapshotOf(resolveInstance(store, sel))
    },

    getForTarget(targetId) {
      return [...store.forTarget(targetId)].sort(compareInstance).map(snapshotInstance)
    },

    getForSource(sourceId) {
      return [...store.fromSource(sourceId)].sort(compareInstance).map(snapshotInstance)
    },

    getByDefinition(targetId, definitionId) {
      return [...store.forTarget(targetId)]
        .sort(compareInstance)
        .filter((i) => i.definitionId === definitionId)
        .map(snapshotInstance)
    },

    getStacks(sel) {
      const instance = resolveInstance(store, sel)
      return instance?.stacks ?? 0
    },

    getModifiers(sel) {
      const instance = resolveInstance(store, sel)
      if (instance === undefined) return []
      return instance.modifiers.map((m) => Object.freeze({ ...m }))
    },

    /** R-B5 -- same projection as legacy BuffSystem.getActiveModifiers:
        id `buff:${defId}:${sourceId}:${stat}`, sourceType from polarity,
        stacks folded per entry. Order = spec sec.55 canonical comparator
        (observable sweep -- stat aggregation must not depend on insertion
        history). */
    getStatModifiers(targetId) {
      const instances = [...store.forTarget(targetId)].sort(compareInstance)
      const out: StatModifier[] = []
      for (const instance of instances) {
        const definition = definitions.tryGet
          ? definitions.tryGet(instance.definitionId)
          : definitions.get(instance.definitionId)
        if (definition?.statModifiers === undefined) continue
        for (const mod of definition.statModifiers) {
          out.push({
            id: `buff:${instance.definitionId}:${instance.sourceId}:${mod.stat}`,
            sourceId: instance.sourceId,
            sourceType: sourceTypeOf(definition),
            stat: mod.stat,
            flat: mod.flat,
            percent: mod.percent,
            stacks: instance.stacks,
            domain: mod.domain,
          })
        }
      }
      return out
    },

    /** Canonical order (r4 HIGH 2): definitionId -> sourceId -> instanceId
        -> capabilityId. Identical capability SETS produce identical output
        regardless of insertion history. */
    getCapabilities(targetId) {
      const instances = [...store.forTarget(targetId)].sort(compareInstance)
      const grants: ActiveCapabilityGrant[] = []
      for (const instance of instances) {
        const definition = definitions.tryGet
          ? definitions.tryGet(instance.definitionId)
          : definitions.get(instance.definitionId)
        if (definition?.capabilities === undefined) continue
        const sortedCaps = [...definition.capabilities].sort((a, b) =>
          a.id.localeCompare(b.id),
        )
        for (const capability of sortedCaps) {
          grants.push({
            instanceId: instance.instanceId,
            definitionId: instance.definitionId,
            capability,
            sourceId: instance.sourceId,
            targetId: instance.targetId,
            stacks: instance.stacks,
          })
        }
      }
      return grants
    },

    /** ARCH-009 semantics: controls are matched on the TARGET's instances
        -- structurally impossible to misroute in a single store. */
    hasControl(targetId, control) {
      for (const instance of store.forTarget(targetId)) {
        const definition = definitions.tryGet
          ? definitions.tryGet(instance.definitionId)
          : definitions.get(instance.definitionId)
        if (definition?.controls?.some((c) => c.type === control)) return true
      }
      return false
    },

    hasForbiddenTags(entityId) {
      const tags = new Set<string>()
      for (const instance of store.forTarget(entityId)) {
        const definition = definitions.tryGet
          ? definitions.tryGet(instance.definitionId)
          : definitions.get(instance.definitionId)
        for (const tag of definition?.forbiddenActionTags ?? []) tags.add(tag)
      }
      return tags
    },

    has(sel) {
      return resolveInstance(store, sel) !== undefined
    },
  }
}
