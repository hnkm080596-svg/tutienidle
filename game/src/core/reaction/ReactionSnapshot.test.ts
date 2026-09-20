// ReactionSnapshot.test.ts -- megaplan M3 step 1: participant snapshot,
// preconditions, causal context (contract sec.36-41).

import { describe, expect, it } from 'vitest'
import type { ElementType } from '../element/ElementType'
import { ReactionRegistry } from './ReactionRegistry'
import {
  buildConsumeOperations,
  buildPreconditions,
  resolveCandidate,
  snapshotParticipants,
} from './ReactionResolution'
import type { ReactionBoard } from './ReactionTypes'
import { ELEMENTAL_REACTION_CAPABILITY } from './ReactionTypes'
import {
  createReactionTestWorld,
  fixtureDamageProfileExists,
  makeCanonicalReactionDefs,
  TEST_ELEMENT_BUFF_IDS,
  TEST_ENTITIES,
} from './testing/ReactionTestFixtures'

const defs = makeCanonicalReactionDefs()

function makeWorld() {
  const world = createReactionTestWorld()
  const registry = new ReactionRegistry(
    defs,
    world.elements,
    (id) => world.registry.get(id) !== undefined,
    fixtureDamageProfileExists,
  )
  const system = world.makeReactionSystem(registry)
  world.capabilities.grant(
    TEST_ENTITIES.sourceA,
    ELEMENTAL_REACTION_CAPABILITY,
  )
  return { world, registry, system }
}

function applyPair(
  world: ReturnType<typeof createReactionTestWorld>,
  sourceId = TEST_ENTITIES.sourceA,
  targetId = TEST_ENTITIES.targetA,
) {
  // wood 4 then fire 2 -- fire application is the trigger event.
  world.applyElement(sourceId, targetId, 'wood', 4)
  const trigger = world.applyElement(sourceId, targetId, 'fire', 2)
  if (trigger === undefined) throw new Error('fire apply did not commit')
  const board = world.boardQuery.read(sourceId, targetId)
  return { trigger, board }
}

describe('snapshotParticipants -- contract sec.38', () => {
  it('captures pre-consume stacks for both sinh participants', () => {
    const { world } = makeWorld()
    const { board } = applyPair(world)
    const def = defs.find((d) => d.id === 'duong_viem')!
    const participants = snapshotParticipants(def, board)
    expect(participants).toEqual([
      {
        role: 'parent',
        element: 'wood',
        instanceId: board.instances.wood,
        stacks: 4,
      },
      {
        role: 'child',
        element: 'fire',
        instanceId: board.instances.fire,
        stacks: 2,
      },
    ])
  })

  it('captures attacker+defender for khac', () => {
    const { world } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    world.applyElement(s, t, 'water', 3)
    world.applyElement(s, t, 'fire', 5)
    const board = world.boardQuery.read(s, t)
    const def = defs.find((d) => d.id === 'tuc_viem')!
    const participants = snapshotParticipants(def, board)
    expect(participants.map((p) => [p.role, p.element, p.stacks])).toEqual([
      ['attacker', 'water', 3],
      ['defender', 'fire', 5],
    ])
  })

  it('throws when a participant element has no live instance', () => {
    const { world } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    world.applyElement(s, t, 'fire', 2)
    const board = world.boardQuery.read(s, t)
    const def = defs.find((d) => d.id === 'duong_viem')! // needs wood+fire
    expect(() => snapshotParticipants(def, board)).toThrow(/no live instance/)
  })
})

describe('buildPreconditions -- contract sec.41', () => {
  it('mirrors every participant for sinh (2) and khac (2)', () => {
    const { world } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    const { board } = applyPair(world, s, t)

    const sinhDef = defs.find((d) => d.id === 'duong_viem')!
    const sinhPres = buildPreconditions(
      snapshotParticipants(sinhDef, board),
      board,
    )
    expect(sinhPres).toHaveLength(2)
    for (const pre of sinhPres) {
      expect(pre.expectedSourceId).toBe(s)
      expect(pre.expectedTargetId).toBe(t)
      expect(pre.expectedStacks).toBeGreaterThan(0)
      expect(pre.instanceId).toBeDefined()
    }

    world.applyElement(s, t, 'water', 3)
    const board2 = world.boardQuery.read(s, t)
    const khacDef = defs.find((d) => d.id === 'tuc_viem')!
    const khacPres = buildPreconditions(
      snapshotParticipants(khacDef, board2),
      board2,
    )
    expect(khacPres).toHaveLength(2)
  })
})

describe('resolveCandidate -- contract sec.36-39', () => {
  it('context carries the causal chain from the trigger event', () => {
    const { world, system } = makeWorld()
    const { trigger, board } = applyPair(world)
    const result = system.evaluateAfterElementalApplication(trigger)
    if (result.kind !== 'resolved') {
      throw new Error(`expected resolved, got ${JSON.stringify(result)}`)
    }
    const ctx = result.resolution.context
    expect(ctx.reactionId).toBe('duong_viem')
    expect(ctx.relation).toBe('sinh')
    expect(ctx.sourceId).toBe(TEST_ENTITIES.sourceA)
    expect(ctx.targetId).toBe(TEST_ENTITIES.targetA)
    expect(ctx.triggerElement).toBe('fire')
    expect(ctx.rootActionId).toBe(trigger.origin.rootActionId)
    expect(ctx.causationEventId).toBe(trigger.eventId)
    expect(ctx.combatSequence).toBe(trigger.combatSequence)
  })

  it('resolution emits consume ops first with removalReason reaction', () => {
    const { world, system } = makeWorld()
    const { trigger, board } = applyPair(world)
    const candidates = system.buildCandidates(
      TEST_ENTITIES.sourceA,
      'fire',
      board,
    )
    const winner = system.selectCandidate(candidates)!
    const resolution = system.resolveCandidate(winner, trigger, board)

    // sinh consumes ONLY the parent (spec sec.77) -- one consume op.
    const consumes = resolution.operations.filter(
      (op) => 'type' in op && op.type === 'consume_buff_stacks',
    )
    expect(consumes).toHaveLength(1)
    const payload = (consumes[0] as { payload: { stacks: unknown; removalReason: string; selector: { kind: string } } })
      .payload
    expect(payload.stacks).toBe('all')
    expect(payload.removalReason).toBe('reaction')
    // The consumed instance is the parent (wood), not the child.
    const woodInstance = board.instances.wood!
    expect(
      (consumes[0] as { payload: { selector: { instanceId: string } } })
        .payload.selector.instanceId,
    ).toBe(woodInstance)
    // Op ids mint under rx.${eventId}.${reactionId}.*
    expect(String(consumes[0]!.operationId)).toContain(
      `rx.${trigger.eventId}.duong_viem`,
    )
    // origin carries the reaction provenance.
    expect(consumes[0]!.origin.kind).toBe('reaction')
    expect(consumes[0]!.origin.reactionId).toBe('duong_viem')
    expect(consumes[0]!.origin.causationEventId).toBe(trigger.eventId)
  })

  it('khac consumes BOTH participants', () => {
    const { world, system } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    world.applyElement(s, t, 'water', 3)
    const trigger = world.applyElement(s, t, 'fire', 5)!
    const board = world.boardQuery.read(s, t)
    const candidates = system.buildCandidates(s, 'fire', board)
    const winner = system.selectCandidate(candidates)!
    expect(winner.definition.id).toBe('tuc_viem')
    const resolution = system.resolveCandidate(winner, trigger, board)
    const consumes = resolution.operations.filter(
      (op) => 'type' in op && op.type === 'consume_buff_stacks',
    )
    expect(consumes).toHaveLength(2)
  })

  it('payoff emitter receives the frozen context and appends after consumes', () => {
    const { world, registry } = makeWorld()
    const seen: string[] = []
    const system = world.makeReactionSystem(registry, {
      payoffEmitter: (def, context) => {
        // Assert the snapshot is frozen pre-consume.
        expect(context.participants[0]!.stacks).toBe(4)
        seen.push(def.id)
        return [
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
            payload: { targetId: context.targetId, fractionOfMax: -0.03 },
          },
        ]
      },
    })
    const { trigger, board } = applyPair(world)
    const candidates = system.buildCandidates(
      TEST_ENTITIES.sourceA,
      'fire',
      board,
    )
    const winner = system.selectCandidate(candidates)!
    const resolution = system.resolveCandidate(winner, trigger, board)
    expect(seen).toEqual(['duong_viem'])
    const types = resolution.operations.map((op) =>
      'type' in op ? op.type : 'deferred',
    )
    expect(types).toEqual(['consume_buff_stacks', 'push_gauge'])
  })
})

describe('evaluateAfterElementalApplication -- full chain', () => {
  it('gate verdicts short-circuit before board read', () => {
    const { world, system } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    // No capability for sourceB -> capability_missing.
    world.applyElement(s, t, 'wood', 4)
    const denied = world.applyElement(TEST_ENTITIES.sourceB, t, 'fire', 2)
    if (denied === undefined) throw new Error('apply failed')
    const result = system.evaluateAfterElementalApplication(denied)
    expect(result).toEqual({
      kind: 'no_reaction',
      gate: 'capability_missing',
    })
  })

  it('no_candidates when the trigger element pairs with nothing stocked', () => {
    const { world, system } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    // Only fire on the board -- every fire relation needs a second
    // element (wood/earth/water/metal).
    const trigger = world.applyElement(s, t, 'fire', 3)!
    const result = system.evaluateAfterElementalApplication(trigger)
    expect(result).toMatchObject({
      kind: 'no_reaction',
      gate: 'evaluate',
      reason: 'no_candidates',
    })
    // M5 -- the no_candidates evaluation still leaves a trace: the
    // board + evaluated (empty) candidate list are the debug record.
    if (result.kind !== 'no_reaction' || result.gate !== 'evaluate') {
      throw new Error('unreachable')
    }
    expect(result.trace.candidates).toEqual([])
    expect(result.trace.selected).toBeUndefined()
    expect(result.trace.operationIds).toEqual([])
  })

  it('resolved result carries the trace (contract sec.85)', () => {
    const { world, system } = makeWorld()
    const { trigger } = applyPair(world)
    const result = system.evaluateAfterElementalApplication(trigger)
    if (result.kind !== 'resolved') throw new Error('expected resolved')
    expect(result.trace.eventId).toBe(trigger.eventId)
    expect(result.trace.combatSequence).toBe(trigger.combatSequence)
    expect(result.trace.selected).toBe('duong_viem')
    expect(result.trace.candidates.length).toBeGreaterThan(0)
    expect(result.trace.operationIds).toEqual(
      result.resolution.operations.map((op) => op.operationId),
    )
    expect(result.trace.preconditions).toEqual(
      result.resolution.preconditions,
    )
  })
})
