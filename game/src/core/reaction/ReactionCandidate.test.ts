// ReactionCandidate.test.ts -- megaplan M2 step 1 (strength math,
// spec sec.74) + step 2 (candidate generation, spec sec.15/28).

import { describe, expect, it } from 'vitest'
import type { ElementType } from '../element/ElementType'
import type { CombatEntityId } from '../battle/contracts/ids'
import {
  agentElement,
  buildCandidates,
  computeBaseStrength,
  computeFinalWeight,
  selectCandidate,
} from './ReactionCandidate'
import { normalizeReactionBias } from './ReactionBias'
import type { ReactionBoard, ReactionCandidate } from './ReactionTypes'
import type { ReactionDefinition } from './ReactionDefinition'
import {
  makeCanonicalReactionDefs,
  TEST_ENTITIES,
} from './testing/ReactionTestFixtures'

const DEFS = makeCanonicalReactionDefs()
const def = (id: string): ReactionDefinition =>
  DEFS.find((d) => d.id === id)!

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

const IDENTITY = normalizeReactionBias(undefined)

describe('computeBaseStrength -- spec sec.74', () => {
  it('sinh strength is P squared', () => {
    const expected = [1, 4, 9, 16, 25]
    for (let p = 1; p <= 5; p++) {
      const b = board({ wood: p, fire: 1 })
      expect(computeBaseStrength(def('duong_viem'), b)).toBe(expected[p - 1])
    }
  })

  it('khac strength is A times D', () => {
    const cases: Array<[number, number, number]> = [
      [1, 5, 5],
      [3, 3, 9],
      [5, 5, 25],
      [4, 5, 20],
    ]
    for (const [a, d, expected] of cases) {
      const b = board({ water: a, fire: d })
      expect(computeBaseStrength(def('tuc_viem'), b)).toBe(expected)
    }
  })
})

describe('computeFinalWeight -- contract sec.31 fixed-point', () => {
  it('identity bias yields base * BIAS_SCALE^3', () => {
    const b = board({ water: 2, fire: 3 })
    const base = computeBaseStrength(def('tuc_viem'), b)
    expect(computeFinalWeight(base, def('tuc_viem'), IDENTITY)).toBe(
      base * 10_000 * 10_000 * 10_000,
    )
  })

  it('bias rescales by exact integer product (no float)', () => {
    const bias = normalizeReactionBias({
      relationBiasBps: { khac: 5_000 },
    })
    const b = board({ water: 4, fire: 4 })
    const base = computeBaseStrength(def('tuc_viem'), b) // 16
    // 16 * 5_000 * 10_000 * 10_000 -- exact integer math
    expect(computeFinalWeight(base, def('tuc_viem'), bias)).toBe(
      16 * 5_000 * 10_000 * 10_000,
    )
  })

  it('element bias keys on the agent element (R-D)', () => {
    // khac agent = attacker; sinh agent = parent.
    const bias = normalizeReactionBias({
      elementBiasBps: { water: 8_000, wood: 12_000 },
    })
    const b = board({ water: 2, fire: 2, wood: 2 })
    const khacBase = computeBaseStrength(def('tuc_viem'), b) // 2*2 = 4
    const sinhBase = computeBaseStrength(def('nhuan_moc'), b) // 2^2 = 4
    expect(agentElement(def('tuc_viem'))).toBe('water')
    expect(agentElement(def('nhuan_moc'))).toBe('water')
    // tuc_viem agent = water (attacker) -> 8_000
    expect(computeFinalWeight(khacBase, def('tuc_viem'), bias)).toBe(
      4 * 10_000 * 8_000 * 10_000,
    )
    // nhuan_moc agent = water (parent) -> 8_000 as well
    expect(computeFinalWeight(sinhBase, def('nhuan_moc'), bias)).toBe(
      4 * 10_000 * 8_000 * 10_000,
    )
    // duong_viem agent = wood (parent) -> 12_000
    const dvm = computeBaseStrength(def('duong_viem'), b)
    expect(computeFinalWeight(dvm, def('duong_viem'), bias)).toBe(
      4 * 10_000 * 12_000 * 10_000,
    )
  })
})

function candidate(
  id: string,
  b: ReactionBoard,
  bias = IDENTITY,
): ReactionCandidate {
  const d = def(id)
  const base = computeBaseStrength(d, b)
  const evaluatedBias = {
    relationBps: bias.relationBps[d.relation],
    elementBps: bias.elementBps(agentElement(d)),
    reactionBps: bias.reactionBps(d.id),
  }
  return {
    definition: d,
    baseStrength: base,
    finalWeightScaled:
      base *
      evaluatedBias.relationBps *
      evaluatedBias.elementBps *
      evaluatedBias.reactionBps,
    evaluatedBias,
  }
}

describe('selectCandidate -- contract sec.33', () => {
  it('mature sinh beats weak khac', () => {
    const b = board({ wood: 4, fire: 1, water: 1 })
    // duong_viem sinh P4 = 16; tuc_viem khac 1*1 = 1
    const winner = selectCandidate([
      candidate('tuc_viem', b),
      candidate('duong_viem', b),
    ])
    expect(winner?.definition.id).toBe('duong_viem')
  })

  it('mature khac beats weak sinh', () => {
    const b = board({ wood: 2, fire: 4, water: 4 })
    // duong_viem sinh P2 = 4; tuc_viem khac 4*4 = 16
    const winner = selectCandidate([
      candidate('duong_viem', b),
      candidate('tuc_viem', b),
    ])
    expect(winner?.definition.id).toBe('tuc_viem')
  })

  it('equal weight tie picks khac (INV-R13)', () => {
    const b = board({ wood: 3, fire: 3, water: 3 })
    // duong_viem sinh P3 = 9; tuc_viem khac 3*3 = 9
    const winner = selectCandidate([
      candidate('duong_viem', b),
      candidate('tuc_viem', b),
    ])
    expect(winner?.definition.id).toBe('tuc_viem')
  })

  it('same-relation tie picks lower selectionTiePriority', () => {
    // Two khac candidates at equal weight: water3*fire3=9 (tuc_viem, 60)
    // vs fire3*metal3=9 (dung_kim, 70). Lower authored number wins.
    const b = board({ water: 3, fire: 3, metal: 3 })
    const winner = selectCandidate([
      candidate('dung_kim', b),
      candidate('tuc_viem', b),
    ])
    expect(winner?.definition.id).toBe('tuc_viem')
  })

  it('tie winner is id-independent (priority, not spelling)', () => {
    // Re-derive the same pair under different ids: priority decides.
    const renamed: ReactionDefinition = {
      ...def('tuc_viem'),
      id: 'zzz_renamed' as ReactionDefinition['id'],
      selectionTiePriority: 55,
    }
    const b = board({ water: 2, fire: 2, metal: 2 })
    // renamed tuc_viem (khac 2*2=4, pri 55) vs dung_kim (khac 2*2=4, pri 70)
    const a: ReactionCandidate = {
      definition: renamed,
      baseStrength: 4,
      finalWeightScaled: 4 * 10_000 ** 3,
      evaluatedBias: { relationBps: 10_000, elementBps: 10_000, reactionBps: 10_000 },
    }
    const winner = selectCandidate([candidate('dung_kim', b), a])
    expect(winner?.definition.id).toBe('zzz_renamed')
  })

  it('returns undefined for an empty candidate list', () => {
    expect(selectCandidate([])).toBeUndefined()
  })
})

describe('buildCandidates -- spec sec.15/28, INV-R06', () => {
  it('fire trigger generates at most 4 candidates', () => {
    // wood3 fire2 water4 metal1 earth0: relations containing fire =
    // duong_viem(wood->fire sinh, both present), luyen_tho(fire->earth,
    // earth absent -> excluded), tuc_viem(water>fire, both present),
    // dung_kim(fire>metal, both present) => 3 candidates.
    const b = board({ wood: 3, fire: 2, water: 4, metal: 1 })
    const found = buildCandidates('fire', b, DEFS, IDENTITY)
    expect(found.map((c) => c.definition.id).sort()).toEqual(
      ['duong_viem', 'dung_kim', 'tuc_viem'].sort(),
    )
    expect(found.length).toBeLessThanOrEqual(4)
  })

  it('earth present adds the fourth fire relation', () => {
    const b = board({ wood: 1, fire: 2, water: 1, metal: 1, earth: 3 })
    const found = buildCandidates('fire', b, DEFS, IDENTITY)
    expect(found.map((c) => c.definition.id).sort()).toEqual(
      ['duong_viem', 'dung_kim', 'luyen_tho', 'tuc_viem'].sort(),
    )
    expect(found).toHaveLength(4)
  })

  it('trigger element absent from every stocked relation yields zero', () => {
    // Only wood on the board; fire trigger matches no stocked pair.
    const b = board({ wood: 2 })
    expect(buildCandidates('fire', b, DEFS, IDENTITY)).toEqual([])
  })

  it('a pair absent one side never qualifies', () => {
    const b = board({ fire: 5 })
    // dung_kim needs metal; luyen_tho needs earth; tuc_viem needs water;
    // duong_viem needs wood -- all missing.
    expect(buildCandidates('fire', b, DEFS, IDENTITY)).toEqual([])
  })

  it('cast order does not matter (INV-R06)', () => {
    // Board is a stack-count snapshot -- arrival order leaves no trace.
    const b = board({ wood: 2, fire: 3 })
    const first = buildCandidates('fire', b, DEFS, IDENTITY)
    const second = buildCandidates('wood', b, DEFS, IDENTITY)
    // Same pair, discovered via either trigger element: duong_viem.
    expect(first.map((c) => c.definition.id)).toContain('duong_viem')
    expect(second.map((c) => c.definition.id)).toContain('duong_viem')
    // And the winner is identical regardless of which trigger we evaluate.
    expect(selectCandidate(first)?.definition.id).toBe('duong_viem')
    expect(selectCandidate(second)?.definition.id).toBe('duong_viem')
  })

  it('candidate records evaluatedBias from the normalized snapshot', () => {
    const bias = normalizeReactionBias({
      relationBiasBps: { khac: 7_500 },
    })
    const b = board({ water: 2, fire: 2 })
    const found = buildCandidates('fire', b, DEFS, bias)
    const tcv = found.find((c) => c.definition.id === 'tuc_viem')!
    expect(tcv.evaluatedBias.relationBps).toBe(7_500)
    expect(tcv.evaluatedBias.elementBps).toBe(10_000)
    expect(tcv.evaluatedBias.reactionBps).toBe(10_000)
  })
})
