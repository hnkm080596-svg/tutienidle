// ReactionPayoff.noRecursion.test.ts -- megaplan M4 step 3 (spec sec.80
// / contract sec.93, INV-R14): payoff ops can never recursively trigger
// a reaction. add_buff_stacks is structurally incapable of producing
// ElementalApplicationCommitted; every emitted apply_buff carries
// reactionEligibility:'suppressed'.

import { describe, expect, it } from 'vitest'
import { CANONICAL_REACTIONS } from '../../data/reaction/ReactionDefinitions'
import { ReactionRegistry } from './ReactionRegistry'
import { ELEMENTAL_REACTION_CAPABILITY } from './ReactionTypes'
import {
  createReactionTestWorld,
  TEST_ENTITIES,
  type ReactionTestWorld,
} from './testing/ReactionTestFixtures'

function makeWorld() {
  const world = createReactionTestWorld()
  const registry = new ReactionRegistry(
    CANONICAL_REACTIONS,
    world.elements,
    () => true,
  )
  const system = world.makeReactionSystem(registry)
  world.capabilities.grant(TEST_ENTITIES.sourceA, ELEMENTAL_REACTION_CAPABILITY)
  return { world, system }
}

describe('no recursive reaction (INV-R14 / spec sec.80)', () => {
  it('duong_viem child conversion emits NO ElementalApplicationCommitted -- dung_kim never chains', () => {
    const { world, system } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    // Board: metal2 incumbent (dung_kim's defender), wood3 parent, then
    // fire1 child -- duong_viem resolves. The emitted add_buff_stacks
    // pushes fire to 3 stacks: a RECURSIVE engine would immediately see
    // fire3 + metal2 and chain dung_kim inside the same batch.
    world.applyElement(s, t, 'metal', 2)
    world.applyElement(s, t, 'wood', 3)
    const trigger = world.applyElement(s, t, 'fire', 1)!
    const result = system.evaluateAfterElementalApplication(trigger)
    if (result.kind !== 'resolved') throw new Error('expected resolved')
    expect(result.resolution.reactionId).toBe('duong_viem')

    const commitCountBefore = world.sink.events.filter(
      (e) => e.type === 'elemental_application_committed',
    ).length
    const resolvedCountBefore = world.sink.events.filter(
      (e) => e.type === 'reaction_resolved',
    ).length

    const outcome = world
      .makeBatchRunner()
      .execute(result.resolution, world.sink)
    expect(outcome.status).toBe('resolved')

    // The stack conversion produced ZERO new elemental commits.
    expect(
      world.sink.events.filter(
        (e) => e.type === 'elemental_application_committed',
      ),
    ).toHaveLength(commitCountBefore)
    // Exactly one reaction resolved -- no chained evaluation.
    expect(
      world.sink.events.filter((e) => e.type === 'reaction_resolved'),
    ).toHaveLength(resolvedCountBefore + 1)
    // The would-be chain participants are untouched: metal stays on the
    // board, fire holds its converted stacks.
    const board = world.boardQuery.read(s, t)
    expect(board.metalStacks).toBe(2)
    expect(board.fireStacks).toBe(3) // 1 + ceil(3/2)
  })

  it('khac apply_status lands suppressed -- the applied status never re-triggers', () => {
    const { world, system } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    // dung_kim applies test_defense_break (suppressed). Even though the
    // status is non-elemental today, the eligibility flag is the
    // invariant that keeps ANY future elemental status silent.
    world.applyElement(s, t, 'metal', 2)
    const trigger = world.applyElement(s, t, 'fire', 3)!
    // fire was applied AFTER metal -- the trigger is fire's commit;
    // dung_kim is fire->metal khac.
    const result = system.evaluateAfterElementalApplication(trigger)
    if (result.kind !== 'resolved') throw new Error('expected resolved')
    expect(result.resolution.reactionId).toBe('dung_kim')

    const applyOp = result.resolution.operations.find(
      (op) => 'type' in op && op.type === 'apply_buff',
    )
    expect(
      (applyOp!.payload as { reactionEligibility: string })
        .reactionEligibility,
    ).toBe('suppressed')

    const commitCountBefore = world.sink.events.filter(
      (e) => e.type === 'elemental_application_committed',
    ).length
    const outcome = world
      .makeBatchRunner()
      .execute(result.resolution, world.sink)
    expect(outcome.status).toBe('resolved')
    // The suppressed application produced no commit event and no chain.
    expect(
      world.sink.events.filter(
        (e) => e.type === 'elemental_application_committed',
      ),
    ).toHaveLength(commitCountBefore)
  })
})
