// ReactionTrace.test.ts -- megaplan M5 step 4: contract sec.85 trace
// shape. formatReactionTrace renders rootAction -> event -> candidates
// (base + bias + final weight) -> selected -> preflight -> emitted ops;
// the trace records the evaluated bias snapshot per candidate and the
// causal identifiers (rootActionId/source/target) standalone.

import { describe, expect, it } from 'vitest'
import { ReactionRegistry } from './ReactionRegistry'
import { formatReactionTrace } from './ReactionTrace'
import { ELEMENTAL_REACTION_CAPABILITY } from './ReactionTypes'
import {
  createReactionTestWorld,
  makeCanonicalReactionDefs,
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
  return { world, registry, system }
}

function resolvedTrace(
  world: ReactionTestWorld,
  system: ReturnType<ReactionTestWorld['makeReactionSystem']>,
) {
  const s = TEST_ENTITIES.sourceA
  const t = TEST_ENTITIES.targetA
  world.applyElement(s, t, 'wood', 2)
  const trigger = world.applyElement(s, t, 'fire', 2)!
  const result = system.evaluateAfterElementalApplication(trigger)
  if (result.kind !== 'resolved') throw new Error('expected resolved')
  return { trigger, result }
}

describe('formatReactionTrace (contract sec.85)', () => {
  it('renders the documented tree: rootAction -> event -> candidates -> selected -> preflight -> ops', () => {
    const { world, system } = makeWorld()
    const { trigger, result } = resolvedTrace(world, system)
    const text = formatReactionTrace(result.trace)

    // Section order -- every documented element present, in order.
    const rootIdx = text.indexOf('rootAction:')
    const eventIdx = text.indexOf('event:')
    const candIdx = text.indexOf('candidates:')
    const selIdx = text.indexOf('selected:')
    const preIdx = text.indexOf('preflight:')
    const opsIdx = text.indexOf('emitted ops:')
    expect(rootIdx).toBeGreaterThanOrEqual(0)
    expect(eventIdx).toBeGreaterThan(rootIdx)
    expect(candIdx).toBeGreaterThan(eventIdx)
    expect(selIdx).toBeGreaterThan(candIdx)
    expect(preIdx).toBeGreaterThan(selIdx)
    expect(opsIdx).toBeGreaterThan(preIdx)

    // Content pins.
    expect(text).toContain(`rootAction: ${trigger.origin.rootActionId}`)
    expect(text).toContain(`event: ${trigger.eventId}`)
    expect(text).toContain('duong_viem: base=4')
    expect(text).toContain('selected: duong_viem')
    expect(text).toContain(`rx.${trigger.eventId}.duong_viem.consume.parent`)
    // Candidate weight rendered with its bias snapshot.
    expect(text).toMatch(/duong_viem: base=4 bias\(rel=\d+,el=\d+,rx=\d+\) final=\d+/)
  })

  it('records the evaluated bias snapshot per candidate', () => {
    const { world, system } = makeWorld()
    const { result } = resolvedTrace(world, system)
    const duong = result.trace.candidates.find(
      (c) => c.reactionId === 'duong_viem',
    )
    // P=2 -> base P^2 = 4; identity bias -> final = base * 10000^3
    // (raw product -- every candidate shares the scale).
    expect(duong).toMatchObject({
      baseStrength: 4,
      evaluatedBias: { relationBps: 10_000, elementBps: 10_000, reactionBps: 10_000 },
      finalWeightScaled: 4_000_000_000_000,
    })
    // The candidate list is the FULL evaluated set -- fire on a
    // wood+fire board also yields tuc_viem? No -- tuc_viem is
    // water->fire (khac attacker water). wood+fire yields sinh
    // duong_viem (wood->fire) only. Assert the evaluated set.
    expect(result.trace.candidates.map((c) => c.reactionId)).toEqual([
      'duong_viem',
    ])
  })

  it('trace stands alone: causal ids copied from the event', () => {
    const { world, system } = makeWorld()
    const { trigger, result } = resolvedTrace(world, system)
    expect(result.trace.eventId).toBe(trigger.eventId)
    expect(result.trace.combatSequence).toBe(trigger.combatSequence)
    expect(result.trace.rootActionId).toBe(trigger.origin.rootActionId)
    expect(result.trace.sourceId).toBe(trigger.sourceId)
    expect(result.trace.targetId).toBe(trigger.targetId)
    expect(result.trace.board.fireStacks).toBe(2)
    expect(result.trace.board.woodStacks).toBe(2)
  })

  it('no_candidates trace renders the empty sections deterministically', () => {
    const { world, system } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    const trigger = world.applyElement(s, t, 'fire', 3)!
    const result = system.evaluateAfterElementalApplication(trigger)
    if (result.kind !== 'no_reaction' || result.gate !== 'evaluate') {
      throw new Error('expected no_candidates')
    }
    const text = formatReactionTrace(result.trace)
    expect(text).toContain('selected: <none>')
    expect(text).toContain('emitted ops:')
    expect(result.trace.candidates).toEqual([])
  })
})
