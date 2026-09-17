// ReactionBoard.test.ts -- megaplan M1 step 2: the board reads
// same-source, same-target elemental stacks through the REAL BuffSystem.

import { describe, expect, it } from 'vitest'
import { BuffSystemBoardQuery } from './ReactionBoard'
import {
  createReactionTestWorld,
  TEST_ELEMENT_BUFF_IDS,
  TEST_ENTITIES,
  TEST_STATUS_BUFF_IDS,
} from './testing/ReactionTestFixtures'
import type { ApplyBuffRequest } from '../battle/contracts/operations'

const { sourceA, sourceB, targetA, targetB } = TEST_ENTITIES

describe('BuffSystemBoardQuery', () => {
  it('reads same-source stacks only (spec sec.7 / contract sec.27)', () => {
    const w = createReactionTestWorld()
    const board = new BuffSystemBoardQuery(w.system, w.elements)

    w.applyElement(sourceA, targetA, 'fire', 3)
    w.applyElement(sourceB, targetA, 'metal', 5)

    const a = board.read(sourceA, targetA)
    expect(a.fireStacks).toBe(3)
    expect(a.metalStacks).toBe(0)
    const b = board.read(sourceB, targetA)
    expect(b.metalStacks).toBe(5)
    expect(b.fireStacks).toBe(0)
  })

  it('board is per (source,target) pair -- same source on two targets isolated', () => {
    const w = createReactionTestWorld()
    const board = new BuffSystemBoardQuery(w.system, w.elements)

    w.applyElement(sourceA, targetA, 'fire', 3)
    w.applyElement(sourceA, targetB, 'fire', 1)

    expect(board.read(sourceA, targetA).fireStacks).toBe(3)
    expect(board.read(sourceA, targetB).fireStacks).toBe(1)
  })

  it('instances carries the live instanceId per element present', () => {
    const w = createReactionTestWorld()
    const board = new BuffSystemBoardQuery(w.system, w.elements)

    const committed = w.applyElement(sourceA, targetA, 'wood', 2)
    expect(committed).toBeDefined()

    const read = board.read(sourceA, targetA)
    expect(read.woodStacks).toBe(2)
    expect(read.instances.wood).toBe(committed!.instanceId)
    expect(read.instances.fire).toBeUndefined()
  })

  it('non-elemental buffs never appear on the board', () => {
    const w = createReactionTestWorld()
    const board = new BuffSystemBoardQuery(w.system, w.elements)

    const ctx = w.makeCtx()
    const req: ApplyBuffRequest = {
      definitionId: TEST_STATUS_BUFF_IDS.bleed,
      sourceId: sourceA,
      targetId: targetA,
      stacks: 4,
      baseChance: 1,
      reactionEligibility: 'eligible',
      origin: ctx.origin,
    }
    w.system.apply(req, ctx)

    const read = board.read(sourceA, targetA)
    expect(read.fireStacks).toBe(0)
    expect(read.waterStacks).toBe(0)
    expect(read.woodStacks).toBe(0)
    expect(read.metalStacks).toBe(0)
    expect(read.earthStacks).toBe(0)
    expect(Object.keys(read.instances)).toHaveLength(0)
  })

  it('reapply adds stacks on the same live instance (cap at maxStacks)', () => {
    const w = createReactionTestWorld()
    const board = new BuffSystemBoardQuery(w.system, w.elements)

    w.applyElement(sourceA, targetA, 'fire', 3)
    w.applyElement(sourceA, targetA, 'fire', 4)

    const read = board.read(sourceA, targetA)
    expect(read.fireStacks).toBe(5) // 3+4 clamped at maxStacks 5
    expect(Object.keys(read.instances)).toHaveLength(1)
  })

  it('element map keys match TEST_ELEMENT_BUFF_IDS coverage', () => {
    const w = createReactionTestWorld()
    expect(Object.keys(TEST_ELEMENT_BUFF_IDS)).toHaveLength(5)
    expect(w.elements.getElement(TEST_ELEMENT_BUFF_IDS.earth)).toBe('earth')
  })
})
