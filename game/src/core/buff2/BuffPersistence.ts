// BuffPersistence.ts -- R2: the standalone per-player persistent buff
// pool (the out-of-battle path; GameManager.buffPool's migration target).
//
// NO scheduler exists in this mode: every ctx/lctx is synthesized
// locally, and the empty-map settle is legal ONLY because periodic defs
// are rejected at construction (no barrier exists to settle requests --
// pending marks and continuations can never form). triggerPeriodic is
// unreachable and no periodic_operation_settled handler is registered.
//
// The resolver still consumes exactly one rollChance per apply -- the
// pool injects a local CombatRng (deterministic stream, no scheduler
// needed); the roll contract is uniform across modes. Events reach the
// injected sink for log/debug.

import type { CombatAuthorityExecutionContext } from '../battle/contracts/context'
import type {
  ApplyBuffRequest,
  BuffRemovalReason,
} from '../battle/contracts/operations'
import type { CombatOperationOrigin } from '../battle/contracts/origin'
import type {
  ApplyBuffResult,
  RemoveBuffResult,
} from '../battle/contracts/results'
import type { CombatRng } from '../battle/contracts/rng'
import type { BuffInstanceSelector } from '../battle/contracts/selectors'
import type { CombatEventSink } from '../battle/contracts/sink'
import type { ElementalStateRegistry } from '../battle/contracts/elemental'
import type { BuffInstanceId, CombatEntityId } from '../battle/contracts/ids'
import { ApplicationResolver } from './ApplicationResolver'
import type { BuffLifecycleContext } from './BuffLifecycleContext'
import type {
  BuffEntityReadPort,
  BuffStatReadPort,
  DamageProfileSnapshotPort,
} from './BuffSystem'
import { BuffSystem } from './BuffSystem'
import type { BuffReadPort } from './BuffQuery'
import type { BuffRegistry } from './BuffRegistry'
import { BuffStore } from './BuffStore'
import type { StatModifier } from '../stats/StatCalculator'

const PERSISTENT_ROOT = 'persistent'

export interface BuffPersistenceOptions {
  /** The persistent subject's id -- closes over the instance-id minter
      (`buff.persistent.${ownerId}.${n}`). */
  ownerId: string
  registry: BuffRegistry
  stats: BuffStatReadPort
  entities: BuffEntityReadPort
  snapshots: DamageProfileSnapshotPort
  elemental: ElementalStateRegistry
  rng: CombatRng
  /** Collecting/no-op sink for log/debug -- lifecycle + apply events. */
  sink: CombatEventSink
}

export class BuffPersistence {
  private readonly system: BuffSystem
  private readonly sink: CombatEventSink
  /** M7 -- synthetic ordering values for the OUT-OF-BATTLE persistent
      lane only. CombatScheduler remains the sole allocator of
      canonical `combatSequence` inside a battle; this counter never
      mixes with any battle's sequence space (persistent applies/
      removes/lifecycle do not enter a battle trace). */
  private seq = 0
  private applyCount = 0
  private removeCount = 0

  constructor(opts: BuffPersistenceOptions) {
    // Construction-time guard: a def carrying periodic can never settle
    // here -- reject the whole registry up front rather than discovering
    // a stranded pending mark mid-battle.
    for (const def of opts.registry.all()) {
      if (def.periodic !== undefined && def.periodic.length > 0) {
        throw new Error(
          `BuffPersistence: definition '${def.id}' carries periodic -- persistent mode has no settlement barrier`,
        )
      }
    }
    let counter = 0
    const store = new BuffStore(
      () => `buff.persistent.${opts.ownerId}.${++counter}` as BuffInstanceId,
    )
    this.system = new BuffSystem(
      store,
      opts.registry,
      new ApplicationResolver(opts.rng),
      opts.stats,
      opts.entities,
      opts.snapshots,
      opts.elemental,
    )
    this.sink = opts.sink
  }

  /** Read-only surface -- the pool's own query lane (spec sec.51). */
  get query(): BuffReadPort {
    return this.system
  }

  /** The live-modifier feed (M4 consumer: PersistentEffectOps). */
  getStatModifiers(targetId: CombatEntityId): StatModifier[] {
    return this.system.getStatModifiers(targetId)
  }

  apply(req: ApplyBuffRequest): ApplyBuffResult {
    const n = ++this.applyCount
    const origin: CombatOperationOrigin = {
      kind: 'scripted',
      originId: PERSISTENT_ROOT,
      sourceId: req.sourceId,
      rootActionId: PERSISTENT_ROOT,
    }
    const ctx: CombatAuthorityExecutionContext = {
      operationId: `persistent.apply.${n}`,
      origin,
      events: this.sink,
      combatSequence: ++this.seq,
    }
    return this.system.apply({ ...req, origin }, ctx)
  }

  remove(sel: BuffInstanceSelector, reason: BuffRemovalReason): RemoveBuffResult {
    const n = ++this.removeCount
    // Origin provenance: the instance's own source when resolvable, else
    // the selector's entity, else the persistence root sentinel.
    const resolved = this.system.getInstance(sel)
    const sourceId =
      resolved?.sourceId ??
      (sel.kind === 'identity'
        ? sel.sourceId
        : sel.kind === 'target_definition'
          ? sel.targetId
          : (PERSISTENT_ROOT as CombatEntityId))
    const origin: CombatOperationOrigin = {
      kind: 'scripted',
      originId: PERSISTENT_ROOT,
      sourceId,
      rootActionId: PERSISTENT_ROOT,
    }
    const ctx: CombatAuthorityExecutionContext = {
      operationId: `persistent.remove.${n}`,
      origin,
      events: this.sink,
      combatSequence: ++this.seq,
    }
    return this.system.remove(sel, reason, ctx)
  }

  /** The only lifecycle clock persistent mode ticks (the GameManager
      updateTime path). Empty-map settle: no periodic defs exist, so no
      unit ever waits on a barrier. */
  onTimePassed(seconds: number): void {
    const lctx: BuffLifecycleContext = {
      rootActionId: PERSISTENT_ROOT,
      sequence: ++this.seq,
      events: this.sink,
      settle: () => new Map(),
    }
    this.system.onTimePassed(seconds, lctx)
  }
}
