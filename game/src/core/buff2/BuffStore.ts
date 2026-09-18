// BuffStore.ts -- replaces per-entity BuffPool. Battle-scoped instance
// store keyed by instanceId with maintained secondary indexes for the
// canonical subject/source/definition queries (spec sec.51 feeders).
//
// NOTE: iteration order is insertion -- any sweep producing OBSERVABLE
// order (periodic, expiry, death, cleanse, stat projection) sorts by the
// spec sec.55 comparator (targetId -> definitionId -> sourceId ->
// instanceId -> periodicId) first. The store itself never sorts.

import type {
  BuffDefinitionId,
  BuffInstanceId,
  CombatEntityId,
} from '../battle/contracts/ids'
import type { BuffInstance } from './BuffInstance'

export class BuffStore {
  /** mintInstanceId comes from the composition root (R-B1): buff2 owns the
      counter, the CALLER owns the battleId scope it closes over. */
  constructor(private readonly mintInstanceId: () => BuffInstanceId) {}

  private readonly byId = new Map<BuffInstanceId, BuffInstance>()
  private readonly targetIndex = new Map<CombatEntityId, Set<BuffInstanceId>>()
  private readonly sourceIndex = new Map<CombatEntityId, Set<BuffInstanceId>>()
  private readonly definitionIndex = new Map<BuffDefinitionId, Set<BuffInstanceId>>()

  /** Mint a fresh instanceId through the injected scope counter. The Buff
      system calls this at instance creation -- never callers. */
  nextInstanceId(): BuffInstanceId {
    return this.mintInstanceId()
  }

  add(instance: BuffInstance): void {
    if (this.byId.has(instance.instanceId)) {
      throw new Error(`BuffStore: duplicate instanceId '${instance.instanceId}'`)
    }
    this.byId.set(instance.instanceId, instance)
    this.indexAdd(this.targetIndex, instance.targetId, instance.instanceId)
    this.indexAdd(this.sourceIndex, instance.sourceId, instance.instanceId)
    this.indexAdd(this.definitionIndex, instance.definitionId, instance.instanceId)
  }

  get(instanceId: BuffInstanceId): BuffInstance | undefined {
    return this.byId.get(instanceId)
  }

  /** Returns the removed instance -- events need stacks-at-removal. */
  remove(instanceId: BuffInstanceId): BuffInstance | undefined {
    const instance = this.byId.get(instanceId)
    if (instance === undefined) return undefined
    this.byId.delete(instanceId)
    this.indexRemove(this.targetIndex, instance.targetId, instanceId)
    this.indexRemove(this.sourceIndex, instance.sourceId, instanceId)
    this.indexRemove(this.definitionIndex, instance.definitionId, instanceId)
    return instance
  }

  /** Canonical subject index -- every instance whose targetId matches. */
  forTarget(targetId: CombatEntityId): readonly BuffInstance[] {
    return this.collect(this.targetIndex.get(targetId))
  }

  fromSource(sourceId: CombatEntityId): readonly BuffInstance[] {
    return this.collect(this.sourceIndex.get(sourceId))
  }

  byDefinition(definitionId: BuffDefinitionId): readonly BuffInstance[] {
    return this.collect(this.definitionIndex.get(definitionId))
  }

  /** per_source key: (definitionId, sourceId, targetId). */
  find(
    definitionId: BuffDefinitionId,
    sourceId: CombatEntityId,
    targetId: CombatEntityId,
  ): BuffInstance | undefined {
    for (const instance of this.forTarget(targetId)) {
      if (instance.definitionId === definitionId && instance.sourceId === sourceId) {
        return instance
      }
    }
    return undefined
  }

  /** per_target key: the target's single instance of this def (any source). */
  findOnTarget(
    definitionId: BuffDefinitionId,
    targetId: CombatEntityId,
  ): BuffInstance | undefined {
    for (const instance of this.forTarget(targetId)) {
      if (instance.definitionId === definitionId) return instance
    }
    return undefined
  }

  all(): readonly BuffInstance[] {
    return [...this.byId.values()]
  }

  private indexAdd<K>(index: Map<K, Set<BuffInstanceId>>, key: K, id: BuffInstanceId): void {
    let bucket = index.get(key)
    if (bucket === undefined) {
      bucket = new Set()
      index.set(key, bucket)
    }
    bucket.add(id)
  }

  private indexRemove<K>(index: Map<K, Set<BuffInstanceId>>, key: K, id: BuffInstanceId): void {
    const bucket = index.get(key)
    if (bucket === undefined) return
    bucket.delete(id)
    if (bucket.size === 0) index.delete(key)
  }

  private collect(ids: Set<BuffInstanceId> | undefined): BuffInstance[] {
    if (ids === undefined) return []
    const out: BuffInstance[] = []
    for (const id of ids) {
      const instance = this.byId.get(id)
      if (instance !== undefined) out.push(instance)
    }
    return out
  }
}
