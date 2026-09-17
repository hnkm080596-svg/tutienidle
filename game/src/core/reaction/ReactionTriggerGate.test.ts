// ReactionTriggerGate.test.ts -- megaplan M1 step 3: the LOCKED gate
// chain order (contract sec.23): suppressed -> not_elemental ->
// no_stack_gain -> capability_missing -> evaluate. Capability is only
// queried after every structural gate passes.

import { describe, expect, it } from 'vitest'
import type { CombatCapabilityQuery } from '../battle/contracts/capability'
import type { ElementalApplicationCommitted } from '../battle/contracts/events'
import type { BuffDefinitionId, CombatEntityId } from '../battle/contracts/ids'
import { ReactionTriggerGate } from './ReactionTriggerGate'
import { ELEMENTAL_REACTION_CAPABILITY } from './ReactionTypes'
import {
  createReactionTestWorld,
  TEST_ELEMENT_BUFF_IDS,
  TEST_ENTITIES,
} from './testing/ReactionTestFixtures'

const { sourceA, targetA } = TEST_ENTITIES

function makeGate(opts: { granted?: boolean; calls?: string[] }) {
  const w = createReactionTestWorld()
  const capabilities: CombatCapabilityQuery = {
    has(entityId: CombatEntityId, capabilityId: string) {
      opts.calls?.push(`${entityId}:${capabilityId}`)
      return opts.granted === true
    },
  }
  return { w, gate: new ReactionTriggerGate(capabilities, w.elements) }
}

/** Fabricated event envelope -- fields overridden per case. */
function event(over: Partial<ElementalApplicationCommitted>): ElementalApplicationCommitted {
  return {
    type: 'elemental_application_committed',
    eventId: 'evt.gate.1' as ElementalApplicationCommitted['eventId'],
    combatSequence: 1,
    instanceId: 'buff.t.1' as ElementalApplicationCommitted['instanceId'],
    sourceId: sourceA,
    targetId: targetA,
    definitionId: TEST_ELEMENT_BUFF_IDS.fire,
    element: 'fire',
    stacksBefore: 0,
    stacksAfter: 2,
    requestedStacks: 2,
    addedStacks: 2,
    reactionEligibility: 'eligible',
    origin: {
      kind: 'skill',
      originId: 'test',
      sourceId: sourceA,
      rootActionId: 'root.1',
    },
    ...over,
  }
}

describe('ReactionTriggerGate -- locked chain order', () => {
  it('all gates pass -> evaluate', () => {
    const { gate } = makeGate({ granted: true })
    expect(gate.check(event({}))).toBe('evaluate')
  })

  it('suppressed eligibility wins over every other failure', () => {
    const calls: string[] = []
    const { gate } = makeGate({ granted: false, calls })
    // Every gate would fail; suppressed is FIRST.
    expect(
      gate.check(
        event({ reactionEligibility: 'suppressed', addedStacks: 0 }),
      ),
    ).toBe('suppressed')
    expect(calls).toHaveLength(0) // capability never queried
  })

  it('definitionId not registered -> not_elemental', () => {
    const { gate } = makeGate({ granted: true })
    expect(
      gate.check(
        event({ definitionId: 'test_bleed' as BuffDefinitionId, element: 'fire' }),
      ),
    ).toBe('not_elemental')
  })

  it('element mismatch (def maps to another element) -> not_elemental', () => {
    const { gate } = makeGate({ granted: true })
    expect(
      gate.check(
        event({ definitionId: TEST_ELEMENT_BUFF_IDS.water, element: 'fire' }),
      ),
    ).toBe('not_elemental')
  })

  it('addedStacks <= 0 -> no_stack_gain (cap refresh / failed add)', () => {
    const calls: string[] = []
    const { gate } = makeGate({ granted: true, calls })
    expect(
      gate.check(event({ addedStacks: 0, stacksBefore: 5, stacksAfter: 5 })),
    ).toBe('no_stack_gain')
    expect(calls).toHaveLength(0)
  })

  it('capability absent -> capability_missing, queried with the source id', () => {
    const calls: string[] = []
    const { gate } = makeGate({ granted: false, calls })
    expect(gate.check(event({}))).toBe('capability_missing')
    expect(calls).toEqual([`${sourceA}:${ELEMENTAL_REACTION_CAPABILITY}`])
  })

  it('capability queried only after structural gates pass (order spy)', () => {
    const calls: string[] = []
    const { gate } = makeGate({ granted: true, calls })
    // Structural failure upstream: capability must NOT be consulted.
    gate.check(event({ addedStacks: 0 }))
    expect(calls).toHaveLength(0)
    gate.check(event({}))
    expect(calls).toHaveLength(1)
  })
})
