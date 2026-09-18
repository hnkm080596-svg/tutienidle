// ReactionSelection.test.ts -- megaplan M2 step 2/3: the ReactionSystem
// facade folds a once-normalized bias snapshot into candidates and the
// fixed-point selection yields at most one winner per evaluation
// (contract sec.33-35, INV-R05/R06/R10/R13).

import { describe, expect, it } from 'vitest'
import type { ElementType } from '../element/ElementType'
import { ReactionSystem } from './ReactionSystem'
import { ReactionRegistry } from './ReactionRegistry'
import { createElementalStateRegistry } from './ElementalStateRegistry'
import type { ReactionBias, ReactionBiasQuery } from './ReactionBias'
import type { ElementalBoardQuery } from './ReactionBoard'
import type { ReactionGateCheck } from './ReactionTriggerGate'
import type { ReactionBoard } from './ReactionTypes'
import {
  makeCanonicalReactionDefs,
  TEST_ELEMENT_BUFF_IDS,
  TEST_ENTITIES,
} from './testing/ReactionTestFixtures'
import type { CombatEntityId } from '../battle/contracts/ids'

const elements = createElementalStateRegistry(TEST_ELEMENT_BUFF_IDS)
const buffExists = () => true
const registry = new ReactionRegistry(
  makeCanonicalReactionDefs(),
  elements,
  buffExists,
)

// These tests drive buildCandidates/selectCandidate on fabricated
// boards -- the evaluate chain's board/gate deps are never consulted.
const noBoard: ElementalBoardQuery = {
  read: () => {
    throw new Error('board query not wired in this suite')
  },
}
const noGate: ReactionGateCheck = {
  check: () => {
    throw new Error('gate not wired in this suite')
  },
}

function board(
  stacks: Partial<Record<ElementType, number>>,
): ReactionBoard {
  return {
    sourceId: TEST_ENTITIES.sourceA,
    targetId: TEST_ENTITIES.targetA,
    fireStacks: stacks.fire ?? 0,
    waterStacks: stacks.water ?? 0,
    woodStacks: stacks.wood ?? 0,
    metalStacks: stacks.metal ?? 0,
    earthStacks: stacks.earth ?? 0,
    instances: {},
  }
}

describe('ReactionSystem candidate+selection facade', () => {
  it('one evaluation selects at most one reaction (INV-R05)', () => {
    const system = new ReactionSystem(registry, noBoard, noGate)
    // All 4 fire relations qualify: wood, fire, earth, metal, water stocked.
    const b = board({ wood: 2, fire: 2, earth: 2, metal: 2, water: 2 })
    const candidates = system.buildCandidates(
      TEST_ENTITIES.sourceA,
      'fire',
      b,
    )
    expect(candidates).toHaveLength(4)
    const winner = system.selectCandidate(candidates)
    expect(winner).toBeDefined()
    // Deterministic: repeated evaluation on the same board/bias is stable.
    expect(system.selectCandidate(candidates)?.definition.id).toBe(
      winner?.definition.id,
    )
  })

  it('bias query is consulted exactly once per evaluation (contract sec.80)', () => {
    let calls = 0
    const spy: ReactionBiasQuery = {
      getFor(sourceId: CombatEntityId, triggerElement: ElementType): ReactionBias {
        calls++
        expect(sourceId).toBe(TEST_ENTITIES.sourceA)
        expect(triggerElement).toBe('fire')
        return { relationBiasBps: { khac: 5_000 } }
      },
    }
    const system = new ReactionSystem(registry, noBoard, noGate, spy)
    const b = board({ wood: 2, fire: 2, water: 2, metal: 2 })
    const candidates = system.buildCandidates(
      TEST_ENTITIES.sourceA,
      'fire',
      b,
    )
    expect(calls).toBe(1)
    // The normalized snapshot is recorded per candidate, identical across
    // all of them (queried once, folded everywhere).
    for (const c of candidates) {
      expect(c.evaluatedBias.relationBps).toBe(
        c.definition.relation === 'khac' ? 5_000 : 10_000,
      )
      expect(c.evaluatedBias.elementBps).toBe(10_000)
      expect(c.evaluatedBias.reactionBps).toBe(10_000)
    }
  })

  it('bias changes the winner through exact integer weights', () => {
    // Board: wood4 fire1 water1 metal1 -- duong_viem sinh base 16 vs
    // tuc_viem khac base 1*1=1 vs dung_kim khac base 1*1=1.
    const b = board({ wood: 4, fire: 1, water: 1, metal: 1 })
    const neutral = new ReactionSystem(registry, noBoard, noGate)
    const neutralWinner = neutral.selectCandidate(
      neutral.buildCandidates(TEST_ENTITIES.sourceA, 'fire', b),
    )
    expect(neutralWinner?.definition.id).toBe('duong_viem') // 16 >> 1

    // Boost a single khac reaction x20 -> tuc_viem 1 * 20 > 16.
    const boosted: ReactionBiasQuery = {
      getFor: () => ({ reactionBiasBps: { tuc_viem: 200_000 } }),
    }
    const biased = new ReactionSystem(registry, noBoard, noGate, boosted)
    const biasedWinner = biased.selectCandidate(
      biased.buildCandidates(TEST_ENTITIES.sourceA, 'fire', b),
    )
    expect(biasedWinner?.definition.id).toBe('tuc_viem')
  })

  it('selection never inspects payoff fields (contract sec.35)', () => {
    // Swap two defs' payoff steps entirely; the winner must not change.
    const defs = makeCanonicalReactionDefs()
    const dvm = defs.find((d) => d.id === 'duong_viem')!
    const ltt = defs.find((d) => d.id === 'luyen_tho')!
    const swapped = defs.map((d) =>
      d.id === 'duong_viem'
        ? { ...d, payoff: ltt.payoff }
        : d.id === 'luyen_tho'
          ? { ...d, payoff: dvm.payoff }
          : d,
    )
    const swappedRegistry = new ReactionRegistry(swapped, elements, buffExists)
    const baseline = new ReactionSystem(registry, noBoard, noGate)
    const variant = new ReactionSystem(swappedRegistry, noBoard, noGate)
    const b = board({ wood: 3, fire: 3, earth: 1, water: 3, metal: 1 })
    expect(
      variant.selectCandidate(
        variant.buildCandidates(TEST_ENTITIES.sourceA, 'fire', b),
      )?.definition.id,
    ).toBe(
      baseline.selectCandidate(
        baseline.buildCandidates(TEST_ENTITIES.sourceA, 'fire', b),
      )?.definition.id,
    )
  })
})
