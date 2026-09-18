// ReactionBatch.test.ts -- megaplan M3 step 2: batch semantics
// (contract sec.40-51): atomic stale-skip, consume-first ordering,
// non-interleaved execution, no rollback, typed skips, events.

import { describe, expect, it } from 'vitest'
import type { ResolvedCombatOperation } from '../battle/contracts/operations'
import type { CombatOperationResult } from '../battle/contracts/results'
import type { CombatAuthorityExecutionContext } from '../battle/contracts/context'
import type { CombatAuthorityPorts } from '../battle/runtime/scheduler/CombatAuthorityPorts'
import { CombatOperationExecutor } from '../battle/runtime/scheduler/CombatOperationExecutor'
import { ReactionBatchRunner } from './ReactionBatchRunner'
import { ReactionRegistry } from './ReactionRegistry'
import type { ReactionResolution } from './ReactionResolution'
import { ELEMENTAL_REACTION_CAPABILITY } from './ReactionTypes'
import {
  createReactionTestWorld,
  makeCanonicalReactionDefs,
  TEST_ENTITIES,
  type ReactionTestWorld,
} from './testing/ReactionTestFixtures'

const defs = makeCanonicalReactionDefs()

function makeWorld() {
  const world = createReactionTestWorld()
  const registry = new ReactionRegistry(
    defs,
    world.elements,
    () => true,
  )
  const system = world.makeReactionSystem(registry)
  world.capabilities.grant(
    TEST_ENTITIES.sourceA,
    ELEMENTAL_REACTION_CAPABILITY,
  )
  return { world, registry, system }
}

/** Runs gate->evaluate->resolve for the given trigger event. */
function resolve(
  world: ReactionTestWorld,
  system: ReturnType<ReactionTestWorld['makeReactionSystem']>,
  sourceId: CombatEntityIdLike,
  targetId: CombatEntityIdLike,
  elements: Array<[ElementTypeLike, number]>,
): ReactionResolution {
  let trigger
  for (const [element, stacks] of elements) {
    trigger = world.applyElement(sourceId, targetId, element, stacks)
  }
  if (trigger === undefined) throw new Error('apply did not commit')
  const result = system.evaluateAfterElementalApplication(trigger)
  if (result.kind !== 'resolved') {
    throw new Error(`expected resolved, got ${JSON.stringify(result)}`)
  }
  return result.resolution
}

type CombatEntityIdLike = Parameters<
  ReactionTestWorld['applyElement']
>[0]
type ElementTypeLike = Parameters<ReactionTestWorld['applyElement']>[2]

class SpyExecutor extends CombatOperationExecutor {
  readonly calls: ResolvedCombatOperation[] = []
  private readonly inner: CombatOperationExecutor

  constructor(inner: CombatOperationExecutor) {
    super({})
    this.inner = inner
  }

  override execute(
    op: ResolvedCombatOperation,
    ctx: CombatAuthorityExecutionContext,
  ): CombatOperationResult {
    this.calls.push(op)
    return this.inner.execute(op, ctx)
  }
}

describe('preflight -- contract sec.40-42', () => {
  it('a stale participant skips the whole reaction (sec.95)', () => {
    const { world, system } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    const resolution = resolve(world, system, s, t, [
      ['wood', 3],
      ['fire', 2],
    ])

    // Externally remove 1 wood stack BEFORE execute -- snapshot stale.
    const woodInstance = world.boardQuery.read(s, t).instances.wood!
    world.system.removeStacks(
      { kind: 'instance', instanceId: woodInstance },
      1,
      world.makeCtx(),
    )

    const spy = new SpyExecutor(
      new CombatOperationExecutor({ buffs: world.system }),
    )
    const runner = new ReactionBatchRunner(
      spy,
      world.system,
      (id) => world.alive.has(id),
    )
    const outcome = runner.execute(resolution, world.sink)
    expect(outcome).toEqual({
      status: 'skipped',
      reactionId: 'duong_viem',
      reason: 'stale_reaction_snapshot',
    })
    expect(spy.calls).toHaveLength(0) // zero ops dispatched
    // Board unchanged: wood still 2, fire still 2.
    const board = world.boardQuery.read(s, t)
    expect(board.woodStacks).toBe(2)
    expect(board.fireStacks).toBe(2)
    // ReactionSkippedEvent emitted for trace parity.
    expect(
      world.sink.events.some((e) => e.type === 'reaction_skipped'),
    ).toBe(true)
  })

  it('a missing participant instance is stale', () => {
    const { world, system } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    const resolution = resolve(world, system, s, t, [
      ['wood', 3],
      ['fire', 2],
    ])
    const woodInstance = world.boardQuery.read(s, t).instances.wood!
    world.system.remove(
      { kind: 'instance', instanceId: woodInstance },
      'cleansed',
      world.makeCtx(),
    )
    const runner = world.makeBatchRunner()
    const outcome = runner.execute(resolution, world.sink)
    expect(outcome.status).toBe('skipped')
  })
})

describe('ordered execution -- contract sec.43-44', () => {
  it('consume ops strictly precede payoff ops', () => {
    const { world, registry } = makeWorld()
    const system = world.makeReactionSystem(registry, {
      payoffEmitter: (def, context) => [
        {
          type: 'push_gauge' as const,
          operationId:
            `rx.${context.causationEventId}.${def.id}.gauge` as never,
          origin: {
            kind: 'reaction' as const,
            originId: def.id,
            sourceId: context.sourceId,
            rootActionId: context.rootActionId,
            causationEventId: context.causationEventId,
            reactionId: def.id,
          },
          payload: {
            targetId: context.targetId,
            fractionOfMax: -0.03,
          },
        },
      ],
    })
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    const resolution = resolve(world, system, s, t, [
      ['wood', 3],
      ['fire', 2],
    ])

    const ports: CombatAuthorityPorts = {
      buffs: world.system,
      gauge: {
        pushGauge: (targetId, fractionOfMax) => ({
          before: 0,
          requestedDelta: fractionOfMax,
          appliedDelta: fractionOfMax,
          after: fractionOfMax,
        }),
      },
    }
    const spy = new SpyExecutor(new CombatOperationExecutor(ports))
    const runner = new ReactionBatchRunner(
      spy,
      world.system,
      (id) => world.alive.has(id),
    )
    const outcome = runner.execute(resolution, world.sink)
    expect(outcome.status).toBe('resolved')
    expect(spy.calls.map((op) => op.type)).toEqual([
      'consume_buff_stacks',
      'push_gauge',
    ])
    // 'reaction' removal reason rides the consume payload (sec.47).
    const consume = spy.calls[0]!
    expect(
      (consume.payload as { removalReason: string }).removalReason,
    ).toBe('reaction')
    // Post-consume: parent gone, child kept at 2 stacks.
    const board = world.boardQuery.read(s, t)
    expect(board.woodStacks).toBe(0)
    expect(board.fireStacks).toBe(2)
    // reaction_resolved emitted with the pre-consume consumed list.
    const evt = world.sink.events.find(
      (e) => e.type === 'reaction_resolved',
    )
    expect(evt).toBeDefined()
    expect(
      (evt as { consumed: readonly { stacks: number }[] }).consumed.map(
        (c) => c.stacks,
      ),
    ).toEqual([3])
  })

  it('khac batch consumes both participants', () => {
    const { world, system } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    const resolution = resolve(world, system, s, t, [
      ['water', 4],
      ['fire', 2],
    ])
    expect(resolution.reactionId).toBe('tuc_viem')
    const runner = world.makeBatchRunner()
    const outcome = runner.execute(resolution, world.sink)
    expect(outcome.status).toBe('resolved')
    const board = world.boardQuery.read(s, t)
    expect(board.waterStacks).toBe(0)
    expect(board.fireStacks).toBe(0)
  })
})

describe('mid-batch invalidation -- contract sec.48-49, sec.96', () => {
  it('death mid-batch keeps committed ops, trailing op skips', () => {
    const { world, registry } = makeWorld()
    // Payoff: damage op (kills the target) then an apply_buff on the
    // dead target.
    const system = world.makeReactionSystem(registry, {
      payoffEmitter: (def, context) => [
        {
          type: 'deal_damage' as const,
          operationId:
            `rx.${context.causationEventId}.${def.id}.damage` as never,
          origin: {
            kind: 'reaction' as const,
            originId: def.id,
            sourceId: context.sourceId,
            rootActionId: context.rootActionId,
            causationEventId: context.causationEventId,
            reactionId: def.id,
          },
          payload: {
            targetId: context.targetId,
            damageProfile: 'test_profile',
            coefficient: 1,
            hitCount: 1,
            canCrit: false,
            canMiss: false,
          },
        },
        {
          type: 'apply_buff' as const,
          operationId:
            `rx.${context.causationEventId}.${def.id}.status` as never,
          origin: {
            kind: 'reaction' as const,
            originId: def.id,
            sourceId: context.sourceId,
            rootActionId: context.rootActionId,
            causationEventId: context.causationEventId,
            reactionId: def.id,
          },
          payload: {
            definitionId: 'test_bleed' as never,
            targetId: context.targetId,
            stacks: 1,
            baseChance: 1,
            reactionEligibility: 'suppressed' as const,
          },
        },
      ],
    })
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    const resolution = resolve(world, system, s, t, [
      ['water', 4],
      ['fire', 2],
    ])

    const ports: CombatAuthorityPorts = {
      buffs: world.system,
      damage: {
        dealDamage: (payload) => {
          world.alive.delete(payload.targetId) // the hit kills
          return { rawDamage: 9999, hpDamage: 9999, killed: true }
        },
      },
    }
    const runner = new ReactionBatchRunner(
      new CombatOperationExecutor(ports),
      world.system,
      (id) => world.alive.has(id),
    )
    const outcome = runner.execute(resolution, world.sink)
    expect(outcome.status).toBe('partial')
    if (outcome.status !== 'partial') throw new Error('unreachable')
    // consume ops + damage committed; trailing apply_buff skipped
    // invalid_target_state (sec.49). No rollback (sec.48).
    const statuses = outcome.results.map((r) => [r.status, r.reason])
    expect(statuses).toEqual([
      ['resolved', undefined],
      ['resolved', undefined],
      ['resolved', undefined],
      ['skipped', 'invalid_target_state'],
    ])
    // Consumed stacks NOT restored.
    const board = world.boardQuery.read(s, t)
    expect(board.waterStacks).toBe(0)
    expect(board.fireStacks).toBe(0)
    // No bleed applied on the dead target.
    expect(
      world.system.getForTarget(t).every(
        (i) => i.definitionId !== ('test_bleed' as never),
      ),
    ).toBe(true)
  })
})
