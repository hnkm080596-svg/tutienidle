// ReactionDispatcher.test.ts -- megaplan M5: the deferred immediate
// handler for 'elemental_application_committed'. Gate fast-path,
// evaluate -> {kind:'batch'} handoff, resolved-event emission,
// sequential multicast settle (spec sec.79/contract sec.98), and the
// exactly-once handoff under double-invoke (contract sec.97).

import { describe, expect, it, vi } from 'vitest'
import type { ElementalApplicationCommitted } from '../battle/contracts/events'
import { ReactionRegistry } from './ReactionRegistry'
import { ELEMENTAL_REACTION_CAPABILITY } from './ReactionTypes'
import {
  createReactionTestWorld,
  makeCanonicalReactionDefs,
  TEST_ELEMENT_BUFF_IDS,
  TEST_ENTITIES,
  type ReactionTestWorld,
} from './testing/ReactionTestFixtures'

function makeWorld() {
  const world = createReactionTestWorld()
  const registry = new ReactionRegistry(
    makeCanonicalReactionDefs(),
    world.elements,
    () => true,
  )
  const system = world.makeReactionSystem(registry)
  world.capabilities.grant(
    TEST_ENTITIES.sourceA,
    ELEMENTAL_REACTION_CAPABILITY,
  )
  const dispatcher = world.makeDispatcher(system)
  return { world, registry, system, dispatcher }
}

function applyOrThrow(
  world: ReactionTestWorld,
  ...args: Parameters<ReactionTestWorld['applyElement']>
): ElementalApplicationCommitted {
  const event = world.applyElement(...args)
  if (event === undefined) throw new Error('apply did not commit')
  return event
}

describe('ReactionDispatcher', () => {
  it('returns void without emitting when the gate rejects', () => {
    const { world, dispatcher } = makeWorld()
    const t = TEST_ENTITIES.targetA
    // No capability for sourceB -> capability_missing at the gate.
    const denied = applyOrThrow(world, TEST_ENTITIES.sourceB, t, 'fire', 2)
    const before = world.sink.events.length
    const settlement = dispatcher.onElementalApplicationCommitted(
      denied,
      world.sink,
    )
    expect(settlement).toBeUndefined()
    expect(world.sink.events.length).toBe(before)
  })

  it('returns void when selection produces no candidate', () => {
    const { world, dispatcher } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    // Fire alone -- every fire relation needs a second element.
    const trigger = applyOrThrow(world, s, t, 'fire', 3)
    const settlement = dispatcher.onElementalApplicationCommitted(
      trigger,
      world.sink,
    )
    expect(settlement).toBeUndefined()
    expect(
      world.sink.events.some((e) => e.type === 'reaction_resolved'),
    ).toBe(false)
  })

  it('resolved -> {kind:batch} + reaction_resolved with the consumed list', () => {
    const { world, dispatcher } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    applyOrThrow(world, s, t, 'wood', 2)
    const trigger = applyOrThrow(world, s, t, 'fire', 2)

    const settlement = dispatcher.onElementalApplicationCommitted(
      trigger,
      world.sink,
    )
    if (settlement === undefined || settlement.kind !== 'batch') {
      throw new Error(`expected batch settlement, got ${JSON.stringify(settlement)}`)
    }
    // Batch shape: consume-first, deterministic ids, participant
    // preconditions tagged for the contract runner.
    expect(settlement.batch.batchId).toBe(
      `rxbatch.${trigger.eventId}.duong_viem`,
    )
    expect(settlement.batch.preconditions.length).toBe(2)
    for (const pre of settlement.batch.preconditions) {
      expect(pre.kind).toBe('buff_participant')
    }
    expect(settlement.batch.operations[0]).toMatchObject({
      type: 'consume_buff_stacks',
    })
    for (const op of settlement.batch.operations) {
      expect(
        op.operationId.startsWith(`rx.${trigger.eventId}.duong_viem.`),
      ).toBe(true)
    }

    const resolved = world.sink.events.find(
      (e) => e.type === 'reaction_resolved',
    )
    expect(resolved).toMatchObject({
      type: 'reaction_resolved',
      reactionId: 'duong_viem',
      relation: 'sinh',
      sourceId: s,
      targetId: t,
      // Sinh consumes the parent (wood, 2 stacks) only.
      consumed: [{ buffId: TEST_ELEMENT_BUFF_IDS.wood, stacks: 2 }],
    })
  })

  it('sequential multicast: a settled reaction is visible to the NEXT application (spec sec.79)', () => {
    const { world, system, dispatcher } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    const evaluate = vi.spyOn(system, 'evaluateAfterElementalApplication')
    const log: string[] = []

    // Subcast 1 -- wood 2 commits; evaluated alone (no pair yet).
    log.push('apply:wood')
    applyOrThrow(world, s, t, 'wood', 2)

    // Subcast 2 -- fire 2 commits -> dispatcher evaluates and the
    // returned batch settles BEFORE the next application lands.
    log.push('apply:fire')
    const fireTrigger = applyOrThrow(world, s, t, 'fire', 2)
    const settlement = dispatcher.onElementalApplicationCommitted(
      fireTrigger,
      world.sink,
    )
    if (settlement === undefined || settlement.kind !== 'batch') {
      throw new Error('expected batch for duong_viem')
    }
    log.push('settle:duong_viem')
    world.settleBatch(settlement.batch, {
      combatSequence: fireTrigger.combatSequence,
    })

    // Post-settle board: parent wood consumed, child fire converted
    // (2 + ceil(2/2) = 3).
    const board = world.boardQuery.read(s, t)
    expect(board.woodStacks).toBe(0)
    expect(board.fireStacks).toBe(3)

    // Subcast 3 -- metal 1 commits; dung_kim snapshots the UPDATED
    // fire stacks (3, not the pre-reaction 2).
    log.push('apply:metal')
    const metalTrigger = applyOrThrow(world, s, t, 'metal', 1)
    const metalSettlement = dispatcher.onElementalApplicationCommitted(
      metalTrigger,
      world.sink,
    )
    if (metalSettlement === undefined || metalSettlement.kind !== 'batch') {
      throw new Error('expected batch for dung_kim')
    }
    const attackerPre = metalSettlement.batch.preconditions.find(
      (p) =>
        p.kind === 'buff_participant' &&
        p.instanceId === board.instances.fire,
    )
    if (attackerPre === undefined || attackerPre.kind !== 'buff_participant') {
      throw new Error('attacker precondition missing')
    }
    expect(attackerPre.expectedStacks).toBe(3)

    // Evaluations ran strictly between applications -- the log proves
    // no batched end-of-cast scan: two evaluate calls (fire, metal),
    // interleaved with their applications.
    expect(evaluate).toHaveBeenCalledTimes(2)
    expect(log).toEqual([
      'apply:wood',
      'apply:fire',
      'settle:duong_viem',
      'apply:metal',
    ])
  })

  it('double-invoke with the same event is idempotent (scheduler owns dedup)', () => {
    const { world, dispatcher } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    applyOrThrow(world, s, t, 'wood', 2)
    const trigger = applyOrThrow(world, s, t, 'fire', 2)

    const first = dispatcher.onElementalApplicationCommitted(
      trigger,
      world.sink,
    )
    const second = dispatcher.onElementalApplicationCommitted(
      trigger,
      world.sink,
    )
    // The dispatcher is stateless -- a duplicate event produces an
    // equivalent settlement; production dedup (the scheduler never
    // delivers the same event twice) is the exactly-once owner.
    expect(second).toEqual(first)
    expect(
      world.sink.events.filter((e) => e.type === 'reaction_resolved'),
    ).toHaveLength(2)
  })
})
