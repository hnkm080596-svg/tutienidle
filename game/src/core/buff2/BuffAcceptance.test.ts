import { describe, expect, it } from 'vitest'
import type { ApplyBuffRequest, BuffModifierPayload } from '../battle/contracts/operations'
import type { BuffInstanceSelector } from '../battle/contracts/selectors'
import type { PeriodicRequestsCommitted } from '../battle/contracts/events'
import type { BuffDefinition } from './BuffDefinition'
import type { BuffInstance } from './BuffInstance'
import type { BuffPeriodicDamageRequest } from '../battle/contracts/periodic'
import {
  makeBuffSystemWorld,
  TEST_ENTITIES,
  type BuffSystemWorld,
} from './testing/BuffTestFixtures'

// Spec sec.70-72 -- acceptance surface. Every scenario here is authored on
// GENERIC primitives only: no def carries a hardcoded behavior flag and no
// branch in buff2 is Hoa-An-specific. Sec.71 requires the full Hoa An
// lifecycle to be expressible this way; sec.72 requires at least one
// non-Hoa status on the same primitives.

function def(w: BuffSystemWorld, overrides: Partial<BuffDefinition> = {}): BuffDefinition {
  const d = w.makeTestDefinition(overrides)
  w.registry.register(d)
  return d
}

/** Hoa-An-shaped test definition: ailment, per-source ownership, 5-stack
    cap, add+refresh reapply, 3 holder turns, dynamic fire DoT at holder
    turn end, ailment-resistance application gate. */
function hoaAnDef(): Partial<BuffDefinition> {
  return {
    id: 'test_buff.hoa_an' as BuffDefinition['id'],
    name: 'Hoa An (test)',
    kind: 'ailment',
    element: 'fire',
    instanceScope: 'per_source',
    stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 3, scaling: 'ailment_scaled' },
    application: { resistance: 'ailment' },
    periodic: [
      {
        id: 'dot',
        type: 'damage',
        element: 'fire',
        damageProfile: 'test_profile',
        coefficient: 0.15,
        scaling: 'dynamic',
        timing: 'holder_turn_end',
        stackScaling: 'multiply',
        canCrit: false,
        canMiss: false,
        hitCount: 1,
      },
    ],
    dispellable: true,
  }
}

function req(overrides: Partial<ApplyBuffRequest> = {}): ApplyBuffRequest {
  return {
    definitionId: 'test_buff.hoa_an' as ApplyBuffRequest['definitionId'],
    sourceId: TEST_ENTITIES.sourceA,
    targetId: TEST_ENTITIES.targetA,
    stacks: 1,
    baseChance: 1,
    reactionEligibility: 'eligible',
    origin: {
      kind: 'skill',
      originId: 'test',
      sourceId: TEST_ENTITIES.sourceA,
      rootActionId: 'root.test.1',
    },
    ...overrides,
  }
}

function sel(instance: { instanceId: BuffInstance['instanceId'] }): BuffInstanceSelector {
  return { kind: 'instance', instanceId: instance.instanceId }
}

function lastRequests(w: BuffSystemWorld): readonly BuffPeriodicDamageRequest[] {
  const events = w.sink
    .ofType('periodic_requests_committed')
    .map((e) => e as PeriodicRequestsCommitted)
  const last = events[events.length - 1]
  return (last?.requests ?? []) as readonly BuffPeriodicDamageRequest[]
}

function mod(overrides: Partial<BuffModifierPayload> = {}): BuffModifierPayload {
  return {
    id: 'test_mod.1',
    channel: 'next_periodic_damage',
    operation: 'multiply',
    value: 1.5,
    reapply: 'replace',
    priority: 0,
    lifetime: { type: 'uses', remaining: 1 },
    ...overrides,
  }
}

// =====================================================================
// sec.70 -- required core scenarios
// =====================================================================

describe('sec.70 required core tests', () => {
  it('instance identity: two sources on the same target produce two instances', () => {
    const w = makeBuffSystemWorld()
    def(w, hoaAnDef())
    w.system.apply(req(), w.makeCtx())
    w.system.apply(req({ sourceId: TEST_ENTITIES.sourceB }), w.makeCtx())
    const all = w.store.all()
    expect(all).toHaveLength(2)
    expect(all[0]!.instanceId).not.toBe(all[1]!.instanceId)
    expect(new Set(all.map((i) => i.sourceId)).size).toBe(2)
  })

  it("per_target: reapply keeps one instance, ownership follows 'latest'", () => {
    const w = makeBuffSystemWorld()
    const d = def(w, {
      instanceScope: 'per_target',
      sourceOwnership: 'latest',
      stacking: { maxStacks: 5, onReapplyStacks: 'replace', onReapplyDuration: 'refresh' },
    })
    const first = w.system.apply(req({ definitionId: d.id }), w.makeCtx())
    const second = w.system.apply(
      req({ definitionId: d.id, sourceId: TEST_ENTITIES.sourceB }),
      w.makeCtx(),
    )
    expect(second.instanceId).toBe(first.instanceId)
    expect(w.store.all()).toHaveLength(1)
    expect(w.store.all()[0]!.sourceId).toBe(TEST_ENTITIES.sourceB)
  })

  it('stack: 4 + 3 with max 5 -> 5 stacks, overflow 2', () => {
    const w = makeBuffSystemWorld()
    def(w, hoaAnDef())
    w.system.apply(req({ stacks: 4 }), w.makeCtx())
    const r = w.system.apply(req({ stacks: 3 }), w.makeCtx())
    const instance = w.store.all()[0]!
    expect(instance.stacks).toBe(5)
    expect(r.overflowStacks).toBe(2)
  })

  it('refresh: 5 stacks / 1 remaining -> successful reapply -> 5 stacks / 3', () => {
    const w = makeBuffSystemWorld()
    def(w, hoaAnDef())
    w.system.apply(req({ stacks: 5 }), w.makeCtx())
    const instance = w.store.all()[0]!
    instance.remaining = 1
    w.system.apply(req({ stacks: 1 }), w.makeCtx())
    expect(instance.stacks).toBe(5)
    expect(instance.remaining).toBe(3)
  })

  it('failed application: no state change', () => {
    const w = makeBuffSystemWorld()
    def(w, hoaAnDef())
    w.rng.queue(0.6) // baseChance 0.5 -> 0.6 >= 0.5 fails
    const r = w.system.apply(req({ baseChance: 0.5 }), w.makeCtx())
    expect(r.applied).toBe(false)
    expect(w.store.all()).toHaveLength(0)
    expect(w.sink.ofType('buff_application_failed')).toHaveLength(1)
  })

  it('dynamic periodic: tick request carries NO snapshot (live read is downstream)', () => {
    const w = makeBuffSystemWorld()
    def(w, hoaAnDef())
    w.system.apply(req({ stacks: 2 }), w.makeCtx())
    // A dynamic-scaled tick deliberately forwards no snapshot: the damage
    // authority recomputes against live source/target state (spec sec.24).
    w.system.onHolderTurnEnd(TEST_ENTITIES.targetA, w.makeLctx())
    const reqs = lastRequests(w)
    expect(reqs).toHaveLength(1)
    expect(reqs[0]!.snapshot).toBeUndefined()
    expect(reqs[0]!.coefficient).toBeCloseTo(0.3) // 0.15 x 2 stacks
    expect(reqs[0]!.stackCount).toBe(2)
  })

  it('snapshot periodic: tick request carries the apply-time snapshot verbatim', () => {
    const w = makeBuffSystemWorld()
    const d = def(w, {
      periodic: [
        {
          id: 'dot',
          type: 'damage',
          element: 'fire',
          damageProfile: 'test_profile',
          coefficient: 1,
          scaling: 'snapshot',
          snapshotFields: ['attack'],
          timing: 'holder_turn_end',
          stackScaling: 'ignore',
          canCrit: false,
          canMiss: false,
          hitCount: 1,
        },
      ],
    })
    w.snapshots.set(`test_profile:${TEST_ENTITIES.sourceA}`, { attack: 100 })
    w.system.apply(req({ definitionId: d.id }), w.makeCtx())
    // Source stat moves after apply -- the snapshot must not.
    w.snapshots.set(`test_profile:${TEST_ENTITIES.sourceA}`, { attack: 777 })
    w.system.onHolderTurnEnd(TEST_ENTITIES.targetA, w.makeLctx())
    expect(lastRequests(w)[0]!.snapshot).toEqual({ attack: 100 })
  })

  it('manual tick: triggerPeriodic emits the request and leaves duration unchanged', () => {
    const w = makeBuffSystemWorld()
    def(w, hoaAnDef())
    w.system.apply(req(), w.makeCtx())
    const instance = w.store.all()[0]!
    const start = w.system.triggerPeriodic(sel(instance), undefined, w.makeCtx())
    expect(start.started).toBe(true)
    expect(lastRequests(w)).toHaveLength(1)
    expect(instance.remaining).toBe(3)
  })

  it('next-tick modifier: x1.5 uses=1 -> first tick boosted, second tick normal', () => {
    const w = makeBuffSystemWorld()
    def(w, hoaAnDef())
    w.system.apply(req(), w.makeCtx())
    const instance = w.store.all()[0]!
    w.system.addModifier(sel(instance), mod(), w.makeCtx())

    w.system.onHolderTurnEnd(TEST_ENTITIES.targetA, w.makeLctx())
    const boosted = lastRequests(w)[0]!
    expect(boosted.coefficient).toBeCloseTo(0.15 * 1.5)
    // The request's uses-mark finalizes only when the op resolves.
    w.settlePeriodic(boosted.requestId, 'resolved')

    w.system.onHolderTurnEnd(TEST_ENTITIES.targetA, w.makeLctx())
    expect(lastRequests(w)[0]!.coefficient).toBeCloseTo(0.15)
  })

  it('holder-turn modifier: manual tick leaves remaining, natural turn end decrements', () => {
    const w = makeBuffSystemWorld()
    def(w, hoaAnDef())
    w.system.apply(req(), w.makeCtx())
    const instance = w.store.all()[0]!
    w.system.addModifier(
      sel(instance),
      mod({ channel: 'periodic_damage', lifetime: { type: 'holder_turns', remaining: 2 } }),
      w.makeCtx(),
    )
    const entry = instance.modifiers[0]!

    w.system.triggerPeriodic(sel(instance), undefined, w.makeCtx())
    expect((entry.lifetime as { remaining: number }).remaining).toBe(2)

    w.system.onHolderTurnEnd(TEST_ENTITIES.targetA, w.makeLctx())
    expect((entry.lifetime as { remaining: number }).remaining).toBe(1)
  })

  it('refresh isolation: reapply resets buff duration; modifier lifetime unchanged', () => {
    const w = makeBuffSystemWorld()
    def(w, hoaAnDef())
    w.system.apply(req(), w.makeCtx())
    const instance = w.store.all()[0]!
    w.system.addModifier(
      sel(instance),
      mod({ channel: 'periodic_damage', lifetime: { type: 'holder_turns', remaining: 5 } }),
      w.makeCtx(),
    )
    instance.remaining = 1
    w.system.apply(req(), w.makeCtx())
    expect(instance.remaining).toBe(3)
    expect((instance.modifiers[0]!.lifetime as { remaining: number }).remaining).toBe(5)
  })

  it('consume: 5 stacks -> consume all -> removed with reason consumed', () => {
    const w = makeBuffSystemWorld()
    def(w, hoaAnDef())
    w.system.apply(req({ stacks: 5 }), w.makeCtx())
    const instance = w.store.all()[0]!
    const r = w.system.consumeStacks(sel(instance), 'all', 'consumed', w.makeCtx())
    expect(r).toEqual({ consumed: 5, remaining: 0, removed: true })
    expect(w.store.all()).toHaveLength(0)
    expect(w.sink.ofType('buff_removed')[0]!.reason).toBe('consumed')
  })

  it('cleanse: dispellable instance removed with reason cleansed', () => {
    const w = makeBuffSystemWorld()
    def(w, hoaAnDef())
    w.system.apply(req(), w.makeCtx())
    const instance = w.store.all()[0]!
    const r = w.system.cleanse(
      TEST_ENTITIES.targetA,
      { definitionId: 'test_buff.hoa_an' as BuffDefinition['id'] },
      w.makeCtx(),
    )
    expect(r.cleansed).toEqual([instance.instanceId])
    expect(w.sink.ofType('buff_removed')[0]!.reason).toBe('cleansed')
  })

  it('expire: third holder turn end removes with reason expired', () => {
    const w = makeBuffSystemWorld()
    def(w, hoaAnDef())
    w.system.apply(req(), w.makeCtx())
    w.system.onHolderTurnEnd(TEST_ENTITIES.targetA, w.makeLctx())
    w.system.onHolderTurnEnd(TEST_ENTITIES.targetA, w.makeLctx())
    w.system.onHolderTurnEnd(TEST_ENTITIES.targetA, w.makeLctx())
    const removed = w.sink.ofType('buff_removed')
    expect(removed).toHaveLength(1)
    expect(removed[0]!.reason).toBe('expired')
    expect(w.store.all()).toHaveLength(0)
  })

  it('death: target dies -> removed with reason death, no expiry events', () => {
    const w = makeBuffSystemWorld()
    def(w, hoaAnDef())
    w.system.apply(req(), w.makeCtx())
    w.alive.delete(TEST_ENTITIES.targetA)
    w.system.onEntityDeath(TEST_ENTITIES.targetA, w.makeLctx())
    const removed = w.sink.ofType('buff_removed')
    expect(removed).toHaveLength(1)
    expect(removed[0]!.reason).toBe('death')
    expect(w.store.all()).toHaveLength(0)
  })

  it('source death: caster dies -> the instance persists (removeOnSourceDeath default)', () => {
    const w = makeBuffSystemWorld()
    def(w, hoaAnDef())
    w.system.apply(req(), w.makeCtx())
    w.alive.delete(TEST_ENTITIES.sourceA)
    w.system.onEntityDeath(TEST_ENTITIES.sourceA, w.makeLctx())
    expect(w.store.all()).toHaveLength(1)
    expect(w.sink.ofType('buff_removed')).toHaveLength(0)
  })

  it('modifier reapply: same replace modifier applied twice -> x1.5, not x2.25', () => {
    const w = makeBuffSystemWorld()
    def(w, hoaAnDef())
    w.system.apply(req(), w.makeCtx())
    const instance = w.store.all()[0]!
    w.system.addModifier(sel(instance), mod(), w.makeCtx())
    w.system.addModifier(sel(instance), mod(), w.makeCtx())
    w.system.onHolderTurnEnd(TEST_ENTITIES.targetA, w.makeLctx())
    expect(lastRequests(w)[0]!.coefficient).toBeCloseTo(0.15 * 1.5)
  })

  it('determinism: identical command stream on two worlds -> identical state + event order', () => {
    const run = (): { instances: unknown[]; eventTypes: string[] } => {
      const w = makeBuffSystemWorld()
      def(w, hoaAnDef())
      w.rng.queue(0.1, 0.2, 0.3)
      w.system.apply(req({ stacks: 2 }), w.makeCtx())
      w.system.apply(req({ sourceId: TEST_ENTITIES.sourceB }), w.makeCtx())
      w.system.onHolderTurnEnd(TEST_ENTITIES.targetA, w.makeLctx())
      return {
        instances: w.store.all().map((i) => ({
          instanceId: i.instanceId,
          definitionId: i.definitionId,
          sourceId: i.sourceId,
          stacks: i.stacks,
          remaining: i.remaining,
        })),
        eventTypes: w.sink.events.map((e) => e.type),
      }
    }
    expect(run()).toEqual(run())
  })
})

// =====================================================================
// sec.71 -- Hoa An acceptance on generic primitives
// =====================================================================

describe('sec.71 Hoa An acceptance (generic primitives only)', () => {
  it('application resistance: ailment resist gates the application roll', () => {
    const w = makeBuffSystemWorld()
    def(w, hoaAnDef())
    w.stats.set(TEST_ENTITIES.targetA, { ailmentResistPercent: 0.5 })
    // effective chance = baseChance 1 x (1 - 0.5) = 0.5
    w.rng.queue(0.6)
    expect(w.system.apply(req(), w.makeCtx()).applied).toBe(false)
    w.rng.queue(0.4)
    expect(w.system.apply(req(), w.makeCtx()).applied).toBe(true)
  })

  it('canonical reaction interaction: hoa_an apply emits elemental_application_committed', () => {
    const w = makeBuffSystemWorld({
      elementalMap: new Map([['test_buff.hoa_an', 'fire']]),
    })
    def(w, hoaAnDef())
    w.system.apply(req(), w.makeCtx())
    const committed = w.sink.ofType('elemental_application_committed')
    expect(committed).toHaveLength(1)
    expect(committed[0]!.element).toBe('fire')
    expect(committed[0]!.reactionEligibility).toBe('eligible')
    // The canonical event precedes generic buff events (r4 HIGH 5).
    expect(w.sink.events[0]!.type).toBe('elemental_application_committed')
  })

  it('potency modifier scales the periodic coefficient', () => {
    const w = makeBuffSystemWorld()
    def(w, hoaAnDef())
    w.system.apply(req(), w.makeCtx())
    const instance = w.store.all()[0]!
    w.system.addModifier(
      sel(instance),
      mod({ channel: 'potency', value: 2, lifetime: { type: 'buff_lifetime' } }),
      w.makeCtx(),
    )
    w.system.onHolderTurnEnd(TEST_ENTITIES.targetA, w.makeLctx())
    expect(lastRequests(w)[0]!.coefficient).toBeCloseTo(0.15 * 2)
  })

  it('duration extend adds turns', () => {
    const w = makeBuffSystemWorld()
    def(w, hoaAnDef())
    w.system.apply(req(), w.makeCtx())
    const instance = w.store.all()[0]!
    const r = w.system.extendDuration(sel(instance), 2, undefined, w.makeCtx())
    expect(r.durationAfter).toBe(5)
    expect(instance.remaining).toBe(5)
  })

  it('partial stack removal keeps the instance alive', () => {
    const w = makeBuffSystemWorld()
    def(w, hoaAnDef())
    w.system.apply(req({ stacks: 4 }), w.makeCtx())
    const instance = w.store.all()[0]!
    const r = w.system.removeStacks(sel(instance), 1, w.makeCtx())
    expect(r.stacksAfter).toBe(3)
    expect(w.store.all()).toHaveLength(1)
  })

  it('battle cleanup: onBattleEnd removes every instance with reason battle_end', () => {
    const w = makeBuffSystemWorld()
    def(w, hoaAnDef())
    w.system.apply(req(), w.makeCtx())
    w.system.apply(req({ sourceId: TEST_ENTITIES.sourceB }), w.makeCtx())
    w.system.onBattleEnd(w.makeLctx())
    expect(w.store.all()).toHaveLength(0)
    const removed = w.sink.ofType('buff_removed')
    expect(removed).toHaveLength(2)
    expect(removed.every((e) => e.reason === 'battle_end')).toBe(true)
  })
})

// =====================================================================
// sec.72 -- secondary acceptance: a non-Hoa status on the same primitives
// =====================================================================

describe('sec.72 secondary acceptance (non-Hoa status)', () => {
  it('doc-style wood DoT: apply -> dynamic tick -> cleanse', () => {
    const w = makeBuffSystemWorld()
    def(w, {
      id: 'test_buff.doc' as BuffDefinition['id'],
      name: 'Doc (test)',
      kind: 'ailment',
      element: 'wood',
      instanceScope: 'per_source',
      stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
      lifetime: { clock: 'holder_turns', duration: 4, scaling: 'ailment_scaled' },
      application: { resistance: 'ailment' },
      periodic: [
        {
          id: 'dot',
          type: 'damage',
          element: 'wood',
          damageProfile: 'test_profile',
          coefficient: 0.2,
          scaling: 'dynamic',
          timing: 'holder_turn_end',
          stackScaling: 'multiply',
          canCrit: false,
          canMiss: false,
          hitCount: 1,
        },
      ],
      dispellable: true,
    })
    w.system.apply(req({ definitionId: 'test_buff.doc' as ApplyBuffRequest['definitionId'], stacks: 3 }), w.makeCtx())
    w.system.onHolderTurnEnd(TEST_ENTITIES.targetA, w.makeLctx())
    expect(lastRequests(w)[0]!.coefficient).toBeCloseTo(0.6) // 0.2 x 3
    const r = w.system.cleanse(
      TEST_ENTITIES.targetA,
      { definitionId: 'test_buff.doc' as BuffDefinition['id'] },
      w.makeCtx(),
    )
    expect(r.cleansed).toHaveLength(1)
    expect(w.store.all()).toHaveLength(0)
  })

  it('control status: stun def answers hasControl + forbiddenActionTags', () => {
    const w = makeBuffSystemWorld()
    def(w, {
      id: 'test_buff.stun' as BuffDefinition['id'],
      name: 'Choang (test)',
      kind: 'debuff',
      controls: [{ type: 'stun' }],
      forbiddenActionTags: ['attack'],
    })
    w.system.apply(req({ definitionId: 'test_buff.stun' as ApplyBuffRequest['definitionId'] }), w.makeCtx())
    expect(w.query.hasControl(TEST_ENTITIES.targetA, 'stun')).toBe(true)
    expect(w.query.hasForbiddenTags(TEST_ENTITIES.targetA).has('attack')).toBe(true)
  })
})
