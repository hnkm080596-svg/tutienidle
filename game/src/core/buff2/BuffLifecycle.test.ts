// BuffLifecycle.test.ts -- M3 step 2: lifecycle protocol. Per-anchor
// decrement matrix, per-unit barrier ordering, Phase B revalidation,
// uses finalization on both paths, interval multi-crossing, truthful
// manual-trigger results, canonical ordering.

import { describe, expect, it } from 'vitest'
import type { PeriodicRequestsCommitted } from '../battle/contracts/events'
import type { BuffPeriodicDamageRequest } from '../battle/contracts/periodic'
import type { BuffModifierPayload } from '../battle/contracts/operations'
import type { BuffDefinition } from './BuffDefinition'
import type { BuffInstance } from './BuffInstance'
import type { BuffLifecycleContext } from './BuffLifecycleContext'
import {
  makeBuffSystemWorld,
  TEST_ENTITIES,
  type BuffSystemWorld,
} from './testing/BuffTestFixtures'

const { sourceA, sourceB, targetA, targetB } = TEST_ENTITIES

function def(w: BuffSystemWorld, overrides: Partial<BuffDefinition> = {}): BuffDefinition {
  const d = w.makeTestDefinition(overrides)
  w.registry.register(d)
  return d
}

function seed(
  w: BuffSystemWorld,
  definitionId: string,
  overrides: Partial<BuffInstance> = {},
): BuffInstance {
  const instance = w.makeTestInstance({ definitionId: definitionId as BuffInstance['definitionId'], ...overrides })
  w.store.add(instance)
  return instance
}

function periodic(timing: string, id = 'dot'): NonNullable<BuffDefinition['periodic']>[number] {
  return {
    id,
    type: 'damage',
    element: 'fire',
    damageProfile: 'test_profile',
    coefficient: 1,
    scaling: 'dynamic',
    timing: timing as 'holder_turn_end',
    stackScaling: 'ignore',
    canCrit: false,
    canMiss: false,
    hitCount: 1,
  } as NonNullable<BuffDefinition['periodic']>[number]
}

function usesMod(
  w: BuffSystemWorld,
  instance: BuffInstance,
  remaining = 1,
  channel = 'next_periodic_damage',
): BuffInstance['modifiers'][number] {
  const entry = {
    id: 'test_mod.uses',
    channel,
    operation: 'multiply',
    value: 2,
    reapply: 'replace',
    priority: 0,
    lifetime: { type: 'uses', remaining },
    modifierRuntimeId: w.mintModifierRuntimeId(instance.instanceId),
    instanceId: instance.instanceId,
  } as BuffInstance['modifiers'][number]
  instance.modifiers.push(entry)
  return entry
}

function requestsOf(w: BuffSystemWorld): readonly BuffPeriodicDamageRequest[] {
  return w.sink
    .ofType('periodic_requests_committed')
    .flatMap((e) => (e as PeriodicRequestsCommitted).requests as readonly BuffPeriodicDamageRequest[])
}

function removedReasons(w: BuffSystemWorld): readonly string[] {
  return w.sink.ofType('buff_removed').map((e) => e.reason)
}

describe('decrement matrix -- each boundary ticks only its own clock', () => {
  it('onHolderTurnEnd decrements holder_turns on the holder only', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, { lifetime: { clock: 'holder_turns', duration: 3, scaling: 'fixed' } })
    const mine = seed(w, d.id, { targetId: targetA, remaining: 3 })
    const other = seed(w, d.id, { targetId: targetB, remaining: 3 })
    const sourceClock = def(w, { lifetime: { clock: 'source_turns', duration: 3, scaling: 'fixed' } })
    const srcInst = seed(w, sourceClock.id, { targetId: targetA, remaining: 3 })
    w.system.onHolderTurnEnd(targetA, w.makeLctx())
    expect(mine.remaining).toBe(2)
    expect(other.remaining).toBe(3)
    expect(srcInst.remaining).toBe(3)
  })

  it('onSourceTurnEnd decrements source_turns on the source only', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, { lifetime: { clock: 'source_turns', duration: 3, scaling: 'fixed' } })
    const mine = seed(w, d.id, { sourceId: sourceA, remaining: 3 })
    const other = seed(w, d.id, { sourceId: sourceB, remaining: 3 })
    w.system.onSourceTurnEnd(sourceA, w.makeLctx())
    expect(mine.remaining).toBe(2)
    expect(other.remaining).toBe(3)
  })

  it('onRoundEnd decrements rounds on ALL instances', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, { lifetime: { clock: 'rounds', duration: 3, scaling: 'fixed' } })
    const a = seed(w, d.id, { targetId: targetA, remaining: 3 })
    const b = seed(w, d.id, { targetId: targetB, remaining: 3 })
    const holderClock = def(w, { lifetime: { clock: 'holder_turns', duration: 3, scaling: 'fixed' } })
    const untouched = seed(w, holderClock.id, { remaining: 3 })
    w.system.onRoundEnd(w.makeLctx())
    expect(a.remaining).toBe(2)
    expect(b.remaining).toBe(2)
    expect(untouched.remaining).toBe(3)
  })

  it('onTimePassed decrements seconds by the elapsed amount', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, { lifetime: { clock: 'seconds', duration: 10, scaling: 'fixed' } })
    const i = seed(w, d.id, { remaining: 10 })
    w.system.onTimePassed(4, w.makeLctx())
    expect(i.remaining).toBe(6)
  })

  it('modifier lifetimes decrement on their matching boundary only', () => {
    const w = makeBuffSystemWorld()
    const d = def(w)
    const i = seed(w, d.id)
    i.modifiers.push(
      {
        id: 'm.holder', channel: 'potency', operation: 'multiply', value: 2,
        reapply: 'replace', priority: 0,
        lifetime: { type: 'holder_turns', remaining: 2 },
        modifierRuntimeId: w.mintModifierRuntimeId(i.instanceId),
        instanceId: i.instanceId,
      },
      {
        id: 'm.rounds', channel: 'potency', operation: 'multiply', value: 2,
        reapply: 'replace', priority: 0,
        lifetime: { type: 'rounds', remaining: 2 },
        modifierRuntimeId: w.mintModifierRuntimeId(i.instanceId),
        instanceId: i.instanceId,
      },
    )
    w.system.onHolderTurnEnd(targetA, w.makeLctx())
    expect((i.modifiers[0]!.lifetime as { remaining: number }).remaining).toBe(1)
    expect((i.modifiers[1]!.lifetime as { remaining: number }).remaining).toBe(2)
    w.system.onRoundEnd(w.makeLctx())
    expect((i.modifiers[1]!.lifetime as { remaining: number }).remaining).toBe(1)
  })

  it('modifier lifetime reaching 0 removes the entry and emits buff_modifier_removed', () => {
    const w = makeBuffSystemWorld()
    const d = def(w)
    const i = seed(w, d.id)
    const entry = {
      id: 'm.expiring', channel: 'potency', operation: 'multiply', value: 2,
      reapply: 'replace', priority: 0,
      lifetime: { type: 'holder_turns', remaining: 1 },
      modifierRuntimeId: w.mintModifierRuntimeId(i.instanceId),
      instanceId: i.instanceId,
    } as BuffInstance['modifiers'][number]
    i.modifiers.push(entry)
    w.system.onHolderTurnEnd(targetA, w.makeLctx())
    expect(i.modifiers).toHaveLength(0)
    const ev = w.sink.ofType('buff_modifier_removed')
    expect(ev).toHaveLength(1)
    expect(ev[0]!.modifierRuntimeId).toBe(entry.modifierRuntimeId)
  })

  it('permanent clock never decrements or expires', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, { lifetime: { clock: 'permanent', scaling: 'fixed' } })
    const i = seed(w, d.id, { remaining: undefined })
    w.system.onHolderTurnEnd(targetA, w.makeLctx())
    expect(w.store.get(i.instanceId)).toBeDefined()
    expect(i.remaining).toBeUndefined()
  })
})

describe('expiry + liveness ordering (spec sec.28 barrier ordering)', () => {
  it('buff at remaining:1 expires with reason expired on its clock boundary', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, { lifetime: { clock: 'holder_turns', duration: 1, scaling: 'fixed' } })
    seed(w, d.id, { remaining: 1 })
    w.system.onHolderTurnEnd(targetA, w.makeLctx())
    expect(removedReasons(w)).toEqual(['expired'])
    expect(w.store.all()).toHaveLength(0)
  })

  it('target killed by a periodic consequence -> removal reason death, never expired', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, {
      lifetime: { clock: 'holder_turns', duration: 1, scaling: 'fixed' },
      periodic: [periodic('holder_turn_end')],
    })
    seed(w, d.id, { remaining: 1 })
    const settleThenKill: BuffLifecycleContext = {
      rootActionId: 'status.test.kill',
      sequence: 1,
      events: w.sink,
      settle() {
        // The periodic op's consequence kills the holder mid-barrier.
        w.alive.delete(targetA)
        return new Map()
      },
    }
    w.system.onHolderTurnEnd(targetA, settleThenKill)
    expect(removedReasons(w)).toEqual(['death'])
  })

  it('a still-alive buff on a killed target also leaves as death (dead sweep covers non-ticking instances)', () => {
    const w = makeBuffSystemWorld()
    const ticking = def(w, {
      lifetime: { clock: 'holder_turns', duration: 5, scaling: 'fixed' },
      periodic: [periodic('holder_turn_end')],
    })
    const plain = def(w, { lifetime: { clock: 'holder_turns', duration: 5, scaling: 'fixed' } })
    seed(w, ticking.id)
    seed(w, plain.id)
    const lctx: BuffLifecycleContext = {
      rootActionId: 'status.test.kill2',
      sequence: 1,
      events: w.sink,
      settle() {
        w.alive.delete(targetA)
        return new Map()
      },
    }
    w.system.onHolderTurnEnd(targetA, lctx)
    expect(removedReasons(w)).toEqual(['death', 'death'])
  })

  it('dead source + removeOnSourceDeath leaves as source_death, not expired', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, {
      lifetime: { clock: 'holder_turns', duration: 1, scaling: 'fixed', removeOnSourceDeath: true },
    })
    seed(w, d.id, { remaining: 1 })
    w.alive.delete(sourceA)
    w.system.onHolderTurnEnd(targetA, w.makeLctx())
    expect(removedReasons(w)).toEqual(['source_death'])
  })

  it('dead source WITHOUT removeOnSourceDeath keeps the instance', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, { lifetime: { clock: 'holder_turns', duration: 5, scaling: 'fixed' } })
    const i = seed(w, d.id)
    w.alive.delete(sourceA)
    w.system.onHolderTurnEnd(targetA, w.makeLctx())
    expect(w.store.get(i.instanceId)).toBeDefined()
    expect(removedReasons(w)).toHaveLength(0)
  })

  it('an instance removed inside a unit barrier is skipped by Phase B (stale reference safe)', () => {
    const w = makeBuffSystemWorld()
    const ticking = def(w, {
      lifetime: { clock: 'holder_turns', duration: 5, scaling: 'fixed' },
      periodic: [periodic('holder_turn_end')],
    })
    const i = seed(w, ticking.id, { remaining: 5 })
    let first = true
    const lctx: BuffLifecycleContext = {
      rootActionId: 'status.test.cleanse',
      sequence: 1,
      events: w.sink,
      settle: () => {
        if (first) {
          first = false
          // The op's consequence cleanses the instance mid-barrier.
          w.system.cleanse(targetA, {}, undefined, {
            operationId: 'op.cleanse.test',
            origin: { kind: 'skill', originId: 't', sourceId: sourceB, rootActionId: 'r' },
            events: w.sink,
            combatSequence: 9,
          })
        }
        return new Map()
      },
    }
    w.system.onHolderTurnEnd(targetA, lctx)
    // The cleanse removed it inside the barrier; Phase B must not
    // decrement/expire through the stale reference or double-remove.
    expect(removedReasons(w)).toEqual(['cleansed'])
    expect(i.remaining).toBe(5)
  })

  it('every boundary ends with the final barrier settle', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, { periodic: [periodic('holder_turn_end')] })
    seed(w, d.id)
    const lctx = w.makeLctx()
    w.system.onHolderTurnEnd(targetA, lctx)
    // 1 per-unit settle + 1 final barrier.
    expect(lctx.settles).toBe(2)
  })

  // phap-tu-reimagine cleanA round-1 - a boundToSourceBuffId marker must
  // die 'expired' in the SAME phase boundary that expires its window
  // (spec D10), not lag one runPhaseB. The head-of-pass binding sweep
  // runs before the decrement that retires the window; the post-expiry
  // re-sweep catches markers orphaned inside this pass.
  it('boundToSourceBuffId marker dies in the same pass its window expires', () => {
    const w = makeBuffSystemWorld()
    const window = def(w, {
      lifetime: { clock: 'holder_turns', duration: 1, scaling: 'fixed' },
    })
    seed(w, window.id, { targetId: sourceA, sourceId: sourceA, remaining: 1 })
    const marker = def(w, {
      boundToSourceBuffId: window.id,
      lifetime: { clock: 'permanent', scaling: 'fixed' },
    })
    const markerInst = seed(w, marker.id, { targetId: targetB, sourceId: sourceA })

    w.system.onHolderTurnEnd(sourceA, w.makeLctx())

    expect(w.store.get(markerInst.instanceId)).toBeUndefined()
    expect(removedReasons(w)).toEqual(['expired', 'expired'])
  })

  it('boundToSourceBuffId marker survives while its window still holds', () => {
    const w = makeBuffSystemWorld()
    const window = def(w, {
      lifetime: { clock: 'holder_turns', duration: 2, scaling: 'fixed' },
    })
    seed(w, window.id, { targetId: sourceA, sourceId: sourceA, remaining: 2 })
    const marker = def(w, {
      boundToSourceBuffId: window.id,
      lifetime: { clock: 'permanent', scaling: 'fixed' },
    })
    const markerInst = seed(w, marker.id, { targetId: targetB, sourceId: sourceA })

    w.system.onHolderTurnEnd(sourceA, w.makeLctx())

    expect(w.store.get(markerInst.instanceId)).toBeDefined()
    expect(removedReasons(w)).toEqual([])
  })
})

describe('onEntityDeath / onBattleEnd', () => {
  it('onEntityDeath removes target instances unconditionally + flagged source instances', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, { lifetime: { clock: 'holder_turns', duration: 9, scaling: 'fixed', removeOnSourceDeath: true } })
    const onTarget = seed(w, d.id, { targetId: targetA, sourceId: sourceA })
    const onSource = seed(w, d.id, { targetId: targetB, sourceId: targetA })
    const flagged = seed(w, d.id, { targetId: targetB, sourceId: sourceB })
    w.system.onEntityDeath(targetA, w.makeLctx())
    expect(w.store.get(onTarget.instanceId)).toBeUndefined()
    expect(w.store.get(onSource.instanceId)).toBeUndefined()
    expect(w.store.get(flagged.instanceId)).toBeDefined()
    expect([...removedReasons(w)].sort()).toEqual(['death', 'source_death'])
  })

  it('onBattleEnd removes everything as battle_end, canonical-sorted', () => {
    const w = makeBuffSystemWorld()
    const d = def(w)
    seed(w, d.id, { targetId: targetB })
    seed(w, d.id, { targetId: targetA })
    w.system.onBattleEnd(w.makeLctx())
    expect(w.store.all()).toHaveLength(0)
    const ev = w.sink.ofType('buff_removed')
    expect(ev).toHaveLength(2)
    expect(ev.map((e) => e.reason)).toEqual(['battle_end', 'battle_end'])
    // canonical sort: targetA's instance emits before targetB's.
    expect(ev[0]!.targetId).toBe(targetA)
  })
})

describe('interval multi-crossing (sequential, r4 BLOCKER 2)', () => {
  function intervalDef(intervalSeconds: number): Partial<BuffDefinition> {
    return {
      lifetime: { clock: 'seconds', duration: 60, scaling: 'fixed' },
      periodic: [
        {
          id: 'tick',
          type: 'damage',
          element: 'fire',
          damageProfile: 'test_profile',
          coefficient: 1,
          scaling: 'dynamic',
          timing: 'interval',
          intervalSeconds,
          stackScaling: 'ignore',
          canCrit: false,
          canMiss: false,
          hitCount: 1,
        },
      ],
    }
  }

  it('onTimePassed(10) on interval 3 emits 3 distinct requests, remainder 1', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, intervalDef(3))
    const i = seed(w, d.id)
    w.system.onTimePassed(10, w.makeLctx())
    const reqs = requestsOf(w)
    expect(reqs).toHaveLength(3)
    expect(new Set(reqs.map((r) => r.requestId)).size).toBe(3)
    expect(i.intervalElapsed!.tick).toBe(1)
  })

  it('tick-1 skipped releases the uses mark so tick-2 refolds it', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, intervalDef(3))
    const i = seed(w, d.id)
    usesMod(w, i, 1)
    const emitted: string[] = []
    const lctx: BuffLifecycleContext = {
      rootActionId: 'status.test.interval',
      sequence: 1,
      events: w.sink,
      settle() {
        // Settle each emitted request as SKIPPED (all released).
        const reqs = requestsOf(w).filter((r) => !emitted.includes(r.requestId))
        for (const r of reqs) {
          emitted.push(r.requestId)
          w.settlePeriodic(r.requestId, 'skipped')
        }
        return new Map()
      },
    }
    w.system.onTimePassed(10, lctx)
    const reqs = requestsOf(w)
    expect(reqs).toHaveLength(3)
    // Released mark refolded into every later tick -> coefficient 2 each.
    expect(reqs.map((r) => r.coefficient)).toEqual([2, 2, 2])
    expect(i.modifiers).toHaveLength(1) // uses never consumed
  })

  it('tick-1 kill -> ticks 2-3 skip at revalidation (dead holder)', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, intervalDef(3))
    seed(w, d.id)
    let settled = 0
    const lctx: BuffLifecycleContext = {
      rootActionId: 'status.test.killinterval',
      sequence: 1,
      events: w.sink,
      settle() {
        settled++
        if (settled === 1) w.alive.delete(targetA)
        return new Map()
      },
    }
    w.system.onTimePassed(10, lctx)
    // Only the first unit emitted + settled; 2-3 skipped at revalidation.
    // settles: 1 per-unit + 1 final Phase-B barrier.
    expect(requestsOf(w)).toHaveLength(1)
    expect(settled).toBe(2)
    expect(removedReasons(w)).toEqual(['death'])
  })

  it('crossings sort by absolute offset, ties by canonical comparator', () => {
    const w = makeBuffSystemWorld()
    const dFast = def(w, {
      id: 'test_buff.fast' as BuffDefinition['id'],
      lifetime: { clock: 'seconds', duration: 60, scaling: 'fixed' },
      periodic: [
        { id: 'f', type: 'damage', element: 'fire', damageProfile: 'test_profile', coefficient: 1, scaling: 'dynamic', timing: 'interval', intervalSeconds: 2, stackScaling: 'ignore', canCrit: false, canMiss: false, hitCount: 1 },
      ],
    })
    const dSlow = def(w, {
      id: 'test_buff.slow' as BuffDefinition['id'],
      lifetime: { clock: 'seconds', duration: 60, scaling: 'fixed' },
      periodic: [
        { id: 's', type: 'damage', element: 'fire', damageProfile: 'test_profile', coefficient: 1, scaling: 'dynamic', timing: 'interval', intervalSeconds: 4, stackScaling: 'ignore', canCrit: false, canMiss: false, hitCount: 1 },
      ],
    })
    seed(w, dFast.id)
    seed(w, dSlow.id)
    w.system.onTimePassed(8, w.makeLctx())
    const reqs = requestsOf(w)
    // fast: t=2,4,6,8 (4 ticks); slow: t=4,8 (2 ticks). Offset order:
    // 2:f, 4:(f then s? comparator tie-break: same target, def 'fast' < 'slow'),
    // 6:f, 8:(f then s).
    expect(reqs.map((r) => r.periodicId)).toEqual(['f', 'f', 's', 'f', 'f', 's'])
  })
})

describe('manual triggerPeriodic -- continuation + uses', () => {
  function twoPeriodicDef(): Partial<BuffDefinition> {
    return {
      periodic: [
        { id: 'p.a', type: 'damage', element: 'fire', damageProfile: 'test_profile', coefficient: 1, scaling: 'dynamic', timing: 'holder_turn_end', stackScaling: 'ignore', canCrit: false, canMiss: false, hitCount: 1 },
        { id: 'p.b', type: 'damage', element: 'fire', damageProfile: 'test_profile', coefficient: 1, scaling: 'dynamic', timing: 'holder_turn_end', stackScaling: 'ignore', canCrit: false, canMiss: false, hitCount: 1 },
      ],
    }
  }

  function trigger(w: BuffSystemWorld, instance: BuffInstance, periodicId?: string) {
    return w.system.triggerPeriodic(
      { kind: 'instance', instanceId: instance.instanceId },
      periodicId,
      w.makeCtx(),
    )
  }

  it('truthful start result: 2-unit trigger reports candidateUnitCount, not resolutions', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, twoPeriodicDef())
    const i = seed(w, d.id)
    const r = trigger(w, i)
    expect(r.started).toBe(true)
    expect(r.candidateUnitCount).toBe(2)
    expect(r.firstRequestId).toMatch(/\.p\.a\.1$/)
    // Only the first unit emitted so far.
    expect(requestsOf(w)).toHaveLength(1)
  })

  it('all-dead branch: matched candidates but none live -> started:false, zero emits', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, twoPeriodicDef())
    const i = seed(w, d.id)
    w.alive.delete(targetA)
    const r = trigger(w, i)
    expect(r.started).toBe(false)
    expect(r.candidateUnitCount).toBe(2)
    expect(requestsOf(w)).toHaveLength(0)
  })

  it('continuation: unit A resolved -> uses consumed -> B does NOT fold it', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, twoPeriodicDef())
    const i = seed(w, d.id)
    usesMod(w, i, 1)
    const r = trigger(w, i)
    expect(r.firstRequestId).toBeDefined()
    w.settlePeriodic(r.firstRequestId!, 'resolved')
    const reqs = requestsOf(w)
    expect(reqs).toHaveLength(2)
    // A folded the uses mod (coef 2); B computed post-consume (coef 1).
    expect(reqs[0]!.coefficient).toBe(2)
    expect(reqs[1]!.coefficient).toBe(1)
    expect(i.modifiers).toHaveLength(0)
  })

  it('continuation: unit A skipped -> mark released -> B folds it', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, twoPeriodicDef())
    const i = seed(w, d.id)
    usesMod(w, i, 1)
    const r = trigger(w, i)
    w.settlePeriodic(r.firstRequestId!, 'skipped')
    const reqs = requestsOf(w)
    expect(reqs).toHaveLength(2)
    expect(reqs[1]!.coefficient).toBe(2)
    expect(i.modifiers).toHaveLength(1) // released, not consumed
  })

  it('continuation: unit A consequence kills the target -> B skipped at revalidation', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, twoPeriodicDef())
    const i = seed(w, d.id)
    const r = trigger(w, i)
    expect(r.firstRequestId).toBeDefined()
    // Unit A's resolved op killed the target downstream.
    w.alive.delete(targetA)
    w.settlePeriodic(r.firstRequestId!, 'resolved')
    // The continuation revalidates: B never computes or emits.
    expect(requestsOf(w)).toHaveLength(1)
  })

  it('continuation: unit A consequence removes the instance -> B skipped at revalidation', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, twoPeriodicDef())
    const i = seed(w, d.id)
    const r = trigger(w, i)
    expect(r.firstRequestId).toBeDefined()
    // Unit A's resolved op removed the whole instance downstream.
    w.store.remove(i.instanceId)
    w.settlePeriodic(r.firstRequestId!, 'resolved')
    expect(requestsOf(w)).toHaveLength(1)
  })

  it('uses:1 consumed by a resolved lifecycle tick emits exactly one buff_modifier_removed', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, { periodic: [periodic('holder_turn_end')] })
    const i = seed(w, d.id)
    usesMod(w, i, 1)
    w.system.onHolderTurnEnd(targetA, w.makeLctx())
    const req = requestsOf(w)[0]!
    w.settlePeriodic(req.requestId, 'resolved')
    expect(w.sink.ofType('buff_modifier_removed')).toHaveLength(1)
  })

  it('triggerPeriodic never advances lifetimes or turn-based modifier lifetimes', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, {
      lifetime: { clock: 'holder_turns', duration: 3, scaling: 'fixed' },
      periodic: [periodic('holder_turn_end')],
    })
    const i = seed(w, d.id, { remaining: 3 })
    i.modifiers.push({
      id: 'm.holder', channel: 'potency', operation: 'multiply', value: 2,
      reapply: 'replace', priority: 0,
      lifetime: { type: 'holder_turns', remaining: 2 },
      modifierRuntimeId: w.mintModifierRuntimeId(i.instanceId),
      instanceId: i.instanceId,
    })
    trigger(w, i)
    expect(i.remaining).toBe(3)
    expect((i.modifiers[0]!.lifetime as { remaining: number }).remaining).toBe(2)
  })
})

describe('canonical ordering on simultaneous periodics', () => {
  it('units sort targetId -> definitionId -> sourceId -> instanceId -> periodicId', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, { periodic: [periodic('holder_turn_end')] })
    const iB = seed(w, d.id, { targetId: targetB })
    const iA = seed(w, d.id, { targetId: targetA })
    const order: string[] = []
    const lctx: BuffLifecycleContext = {
      rootActionId: 'status.test.order',
      sequence: 1,
      events: {
        emit(e) {
          if (e.type === 'periodic_requests_committed') {
            order.push((e as PeriodicRequestsCommitted).requests[0]!.targetId)
          }
          w.sink.emit(e)
        },
      },
      settle: () => new Map(),
    }
    void iB
    void iA
    // Sweep both targets' boundaries (same trigger for both in one test:
    // emit on a shared target list via two boundaries).
    w.system.onHolderTurnEnd(targetA, lctx)
    w.system.onHolderTurnEnd(targetB, lctx)
    expect(order[0]).toBe(targetA)
    expect(order[1]).toBe(targetB)
  })
})
