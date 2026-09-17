// ReactionDeterminism.test.ts -- megaplan M5: spec sec.82/contract
// sec.87 determinism (same scripted sequence -> deep-equal candidates,
// winner, preconditions, op ids, consumed list, final board; seeded
// 200-application digest identical across runs) + spec sec.60 canonical
// ordering comparator.

import { describe, expect, it } from 'vitest'
import { SeededCombatRng } from '../battle/runtime/rng/SeededCombatRng'
import type { CombatEntityId } from '../battle/contracts/ids'
import type { ElementType } from '../element/ElementType'
import { ReactionRegistry } from './ReactionRegistry'
import type { ReactionEvaluationTrace } from './ReactionResolution'
import {
  compareReactionTraces,
  reactionTraceDigest,
} from './ReactionTrace'
import {
  ELEMENTAL_REACTION_CAPABILITY,
  type ReactionBoard,
} from './ReactionTypes'
import {
  createReactionTestWorld,
  makeCanonicalReactionDefs,
  TEST_ENTITIES,
  type ReactionTestWorld,
} from './testing/ReactionTestFixtures'

const ELEMENTS: readonly ElementType[] = [
  'wood',
  'fire',
  'earth',
  'metal',
  'water',
]

function makeWorld() {
  const world = createReactionTestWorld()
  const registry = new ReactionRegistry(
    makeCanonicalReactionDefs(),
    world.elements,
    () => true,
  )
  const system = world.makeReactionSystem(registry)
  for (const source of [TEST_ENTITIES.sourceA, TEST_ENTITIES.sourceB]) {
    world.capabilities.grant(source, ELEMENTAL_REACTION_CAPABILITY)
  }
  return { world, registry, system }
}

type TestSystem = ReturnType<ReactionTestWorld['makeReactionSystem']>

/** One scripted evaluation sequence; returns the resolutions + traces
    + final board the run produced. */
function runScriptedSequence(
  world: ReactionTestWorld,
  system: TestSystem,
) {
  const s = TEST_ENTITIES.sourceA
  const t = TEST_ENTITIES.targetA
  const resolutions = []
  const traces = []
  const script: [ElementType, number][] = [
    ['wood', 2],
    ['fire', 2],
    ['metal', 1],
    ['earth', 3],
    ['water', 2],
  ]
  for (const [element, stacks] of script) {
    const event = world.applyElement(s, t, element, stacks)
    if (event === undefined) continue
    const result = system.evaluateAfterElementalApplication(event)
    if (result.kind === 'resolved') {
      resolutions.push(result.resolution)
      traces.push(result.trace)
    } else if (result.kind === 'no_reaction' && result.gate === 'evaluate') {
      traces.push(result.trace)
    }
  }
  return {
    resolutions,
    traces,
    board: world.boardQuery.read(s, t),
  }
}

/** A seeded synthetic application sequence over a fresh world. */
function runSeededSequence(seed: number) {
  const { world, system } = makeWorld()
  const rng = new SeededCombatRng(seed)
  const sources = [TEST_ENTITIES.sourceA, TEST_ENTITIES.sourceB]
  const targets = [TEST_ENTITIES.targetA, TEST_ENTITIES.targetB]
  const digests: string[] = []
  const boards: ReactionBoard[] = []

  for (let i = 0; i < 200; i++) {
    const source = sources[Math.floor(rng.roll() * sources.length)]!
    const target = targets[Math.floor(rng.roll() * targets.length)]!
    const element = ELEMENTS[Math.floor(rng.roll() * ELEMENTS.length)]!
    const stacks = 1 + Math.floor(rng.roll() * 5)
    const event = world.applyElement(source, target, element, stacks)
    if (event === undefined) continue
    const result = system.evaluateAfterElementalApplication(event)
    if (result.kind !== 'no_reaction' || result.gate === 'evaluate') {
      digests.push(reactionTraceDigest(result.trace))
    }
    boards.push(world.boardQuery.read(source, target))
  }
  return { digests, boards }
}

describe('reaction determinism (spec sec.82/contract sec.87)', () => {
  it('two runs of the same scripted sequence are deep-equal', () => {
    const wa = makeWorld()
    const wb = makeWorld()
    const a = runScriptedSequence(wa.world, wa.system)
    const b = runScriptedSequence(wb.world, wb.system)
    expect(b.resolutions).toEqual(a.resolutions)
    expect(b.traces).toEqual(a.traces)
    expect(b.board).toEqual(a.board)
  })

  it('seeded 200-application sequence produces an identical trace digest', () => {
    const a = runSeededSequence(0xc0ffee)
    const b = runSeededSequence(0xc0ffee)
    expect(b.digests).toEqual(a.digests)
    expect(b.boards).toEqual(a.boards)
    // Sanity: the seeded run actually exercised reactions, not an
    // all-reject stream -- the digest must contain resolved lines.
    expect(a.digests.length).toBeGreaterThan(0)
    expect(a.digests.some((d) => !d.includes('selected=<none>'))).toBe(true)
  })

  it('a different seed produces a different evaluation stream', () => {
    const a = runSeededSequence(1)
    const b = runSeededSequence(2)
    expect(b.digests).not.toEqual(a.digests)
  })
})

describe('canonical ordering (spec sec.60)', () => {
  function trace(
    overrides: Partial<ReactionEvaluationTrace>,
  ): ReactionEvaluationTrace {
    return {
      eventId: 'evt.t.1',
      combatSequence: 100,
      rootActionId: 'root.t.1',
      sourceId: 'src' as CombatEntityId,
      targetId: 'tgt' as CombatEntityId,
      board: {
        sourceId: 'src' as CombatEntityId,
        targetId: 'tgt' as CombatEntityId,
        fireStacks: 0,
        waterStacks: 0,
        woodStacks: 0,
        metalStacks: 0,
        earthStacks: 0,
        instances: {},
      },
      candidates: [],
      operationIds: [],
      ...overrides,
    }
  }

  it('orders by combatSequence -> sourceId -> targetId -> reactionId', () => {
    const a = trace({
      combatSequence: 100,
      sourceId: 'src.a' as CombatEntityId,
      targetId: 'tgt.a' as CombatEntityId,
      selected: 'duong_viem',
    })
    const b = trace({
      combatSequence: 100,
      sourceId: 'src.a' as CombatEntityId,
      targetId: 'tgt.b' as CombatEntityId,
      selected: 'duong_viem',
    })
    const c = trace({
      combatSequence: 100,
      sourceId: 'src.b' as CombatEntityId,
      targetId: 'tgt.a' as CombatEntityId,
      selected: 'duong_viem',
    })
    const d = trace({
      combatSequence: 100,
      sourceId: 'src.a' as CombatEntityId,
      targetId: 'tgt.a' as CombatEntityId,
      selected: 'tuc_viem',
    })
    const e = trace({ combatSequence: 200, selected: 'duong_viem' })

    const sorted = [e, d, c, b, a].slice().sort(compareReactionTraces)
    expect(sorted).toEqual([a, d, b, c, e])
    expect(compareReactionTraces(a, a)).toBe(0)
  })
})
