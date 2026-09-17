// ReactionPayoff.khac.test.ts -- megaplan M4 step 2 (spec sec.78):
// authored khac payoff emission through CANONICAL_REACTIONS +
// emitPayoffOperations. Asserts snapshot A/D math, consume-BOTH
// semantics, damage payload contract (origin 'reaction', canCrit false,
// attacker element), status application with suppressed eligibility,
// identity-selector modifiers, deferred heal materialization + ratio
// cap, and the tran_thuy attacker-stack gate.

import { describe, expect, it } from 'vitest'
import type { DeferredOperation } from '../battle/contracts/settlement'
import type { ResolvedCombatOperation } from '../battle/contracts/operations'
import { CANONICAL_REACTIONS } from '../../data/reaction/ReactionDefinitions'
import { ReactionRegistry } from './ReactionRegistry'
import type { ReactionResolution } from './ReactionResolution'
import { ELEMENTAL_REACTION_CAPABILITY } from './ReactionTypes'
import {
  createReactionTestWorld,
  TEST_ENTITIES,
  TEST_STATUS_BUFF_IDS,
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

function resolve(
  world: ReactionTestWorld,
  system: ReturnType<ReactionTestWorld['makeReactionSystem']>,
  sourceId: Parameters<ReactionTestWorld['applyElement']>[0],
  targetId: Parameters<ReactionTestWorld['applyElement']>[1],
  elements: Array<[Parameters<ReactionTestWorld['applyElement']>[2], number]>,
): { resolution: ReactionResolution; eventId: string } {
  let trigger
  for (const [element, stacks] of elements) {
    trigger = world.applyElement(sourceId, targetId, element, stacks)
  }
  if (trigger === undefined) throw new Error('apply did not commit')
  const result = system.evaluateAfterElementalApplication(trigger)
  if (result.kind !== 'resolved') {
    throw new Error(`expected resolved, got ${JSON.stringify(result)}`)
  }
  return { resolution: result.resolution, eventId: trigger.eventId }
}

type Op<T extends ResolvedCombatOperation['type']> = Extract<
  ResolvedCombatOperation,
  { type: T }
>

function opsOfType<T extends ResolvedCombatOperation['type']>(
  resolution: ReactionResolution,
  type: T,
): Op<T>[] {
  return resolution.operations.filter(
    (op): op is Op<T> => 'type' in op && op.type === type,
  )
}

describe('tuc_viem (water->fire khac)', () => {
  it('snapshot coefficient + attacker element + reaction origin -- sec.78', () => {
    const { world, system } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    // A4 water + D2 fire.
    const { resolution } = resolve(world, system, s, t, [
      ['water', 4],
      ['fire', 2],
    ])
    expect(resolution.reactionId).toBe('tuc_viem')

    // consume BOTH (reason 'reaction') then damage + gauge in authored order.
    expect(resolution.operations.map((op) => ('type' in op ? op.type : op.kind))).toEqual([
      'consume_buff_stacks',
      'consume_buff_stacks',
      'deal_damage',
      'push_gauge',
    ])
    const damage = opsOfType(resolution, 'deal_damage')[0]!
    // 0.20*(A+D) + 0.08*D = 0.20*6 + 0.16 = 1.36 on PRE-CONSUME stacks.
    expect(damage.payload.coefficient).toBeCloseTo(1.36)
    expect(damage.payload.element).toBe('water')
    expect(damage.payload.canCrit).toBe(false)
    expect(damage.payload.canMiss).toBe(false)
    expect(damage.origin.kind).toBe('reaction')
    expect(damage.origin.reactionId).toBe('tuc_viem')
    expect(damage.payload.targetId).toBe(t)

    const outcome = world.makeBatchRunner().execute(resolution, world.sink)
    expect(outcome.status).toBe('resolved')
    // Board empty of BOTH participants.
    const board = world.boardQuery.read(s, t)
    expect(board.waterStacks).toBe(0)
    expect(board.fireStacks).toBe(0)
    // Gauge pushed -0.03*A = -0.12 on the target.
    expect(world.stubCalls.gauge).toEqual([
      { targetId: t, fractionOfMax: -0.12 },
    ])
    expect(world.stubCalls.damage).toEqual([{ targetId: t, coefficient: 1.36 }])
  })
})

describe('dung_kim (fire->metal khac)', () => {
  it('applies defense break with suppressed eligibility + authored duration', () => {
    const { world, system } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    // A3 fire + D2 metal -> durationOverride min(3, ceil(2/2)) = 1.
    const { resolution } = resolve(world, system, s, t, [
      ['fire', 3],
      ['metal', 2],
    ])
    expect(resolution.reactionId).toBe('dung_kim')
    const apply = opsOfType(resolution, 'apply_buff')[0]!
    expect(apply.payload.definitionId).toBe(TEST_STATUS_BUFF_IDS.defenseBreak)
    expect(apply.payload.stacks).toBe(3) // stacks A
    expect(apply.payload.durationOverride).toBe(1)
    expect(apply.payload.reactionEligibility).toBe('suppressed')
    expect(apply.payload.targetId).toBe(t)

    world.makeBatchRunner().execute(resolution, world.sink)
    const board = world.boardQuery.read(s, t)
    expect(board.fireStacks).toBe(0)
    expect(board.metalStacks).toBe(0)
    // Status applied on the target for the authored duration.
    const status = world.system.getByDefinition(
      t,
      TEST_STATUS_BUFF_IDS.defenseBreak,
    )[0]!
    expect(status.stacks).toBe(3)
    expect(status.remaining).toBe(1)
  })
})

describe('doan_moc (metal->wood khac)', () => {
  it('bleed stacks 1+floor(A/2) + modifier targets the IDENTITY selector', () => {
    const { world, system } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    // A4 metal + D2 wood.
    const { resolution } = resolve(world, system, s, t, [
      ['metal', 4],
      ['wood', 2],
    ])
    expect(resolution.reactionId).toBe('doan_moc')
    const apply = opsOfType(resolution, 'apply_buff')[0]!
    expect(apply.payload.definitionId).toBe(TEST_STATUS_BUFF_IDS.bleed)
    expect(apply.payload.stacks).toBe(3) // 1 + floor(4/2)
    const mod = opsOfType(resolution, 'add_buff_modifier')[0]!
    // The bleed instance does not exist at resolution time -- the
    // modifier targets (definitionId, sourceId, targetId), NOT an
    // instanceId (spec sec.78 doan_moc note).
    expect(mod.payload.selector).toEqual({
      kind: 'identity',
      definitionId: TEST_STATUS_BUFF_IDS.bleed,
      sourceId: s,
      targetId: t,
    })
    expect(mod.payload.modifier).toMatchObject({
      id: 'doan_moc',
      channel: 'potency',
      operation: 'multiply',
      reapply: 'max',
      lifetime: { type: 'buff_lifetime' },
    })
    expect(mod.payload.modifier.value).toBeCloseTo(1.1) // 1 + 0.05*D(2)

    world.makeBatchRunner().execute(resolution, world.sink)
    const bleed = world.system.getByDefinition(
      t,
      TEST_STATUS_BUFF_IDS.bleed,
    )[0]!
    expect(bleed.stacks).toBe(3)
    expect(
      bleed.modifiers.find((m) => m.id === 'doan_moc')!.value,
    ).toBeCloseTo(1.1)
  })
})

describe('xuyen_tho (wood->earth khac)', () => {
  it('deferred heal materializes from the damage result; ratio capped at resolution', () => {
    const { world, system } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    // A3 wood + D3 earth -> fraction = min(0.05*3, 0.25) = 0.15.
    const { resolution, eventId } = resolve(world, system, s, t, [
      ['wood', 3],
      ['earth', 3],
    ])
    expect(resolution.reactionId).toBe('xuyen_tho')

    // Deferred op positioned AFTER the damage op, carrying its own
    // pre-minted operationId + origin (spec sec.78).
    const entries = resolution.operations.map((op) =>
      'type' in op ? op.type : op.kind,
    )
    expect(entries).toEqual([
      'consume_buff_stacks',
      'consume_buff_stacks',
      'deal_damage',
      'apply_buff',
      'heal_from_damage_result',
    ])
    const deferred = resolution.operations[4]! as DeferredOperation
    expect(deferred.operationId).toBe(`rx.${eventId}.xuyen_tho.heal`)
    expect(deferred.kind).toBe('heal_from_damage_result')
    expect(deferred.fraction).toBeCloseTo(0.15)
    expect(deferred.healTarget).toBe('source')
    const damage = resolution.operations[2]! as Op<'deal_damage'>
    expect(deferred.resultOperationId).toBe(damage.operationId)
    expect(deferred.origin.kind).toBe('reaction')
    expect(deferred.origin.reactionId).toBe('xuyen_tho')

    // hpDamage 1000 -> heal amount 150 to the reaction SOURCE.
    const runner = world.makeBatchRunner({
      ports: {
        damage: {
          dealDamage: () => ({ rawDamage: 1000, hpDamage: 1000, killed: false }),
        },
      },
    })
    const outcome = runner.execute(resolution, world.sink)
    expect(outcome.status).toBe('resolved')
    expect(world.stubCalls.heal).toHaveLength(1)
    expect(world.stubCalls.heal[0]!.targetId).toBe(s)
    expect(world.stubCalls.heal[0]!.amount).toBeCloseTo(150)
    // Erosion status landed (stacks A = 3).
    const erosion = world.system.getByDefinition(
      t,
      TEST_STATUS_BUFF_IDS.defenseErosion,
    )[0]!
    expect(erosion.stacks).toBe(3)
  })

  it('D5 hits the authored 0.25 cap boundary', () => {
    const { world, system } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    const { resolution } = resolve(world, system, s, t, [
      ['wood', 5],
      ['earth', 5],
    ])
    const deferred = resolution.operations.find(
      (op) => !('type' in op),
    )! as DeferredOperation
    expect(deferred.fraction).toBeCloseTo(0.25) // min(0.05*5, 0.25)
  })

  it('a skipped damage op yields dependency_not_resolved (never a silent 0)', () => {
    const { world, system } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    const { resolution } = resolve(world, system, s, t, [
      ['wood', 3],
      ['earth', 3],
    ])
    // The target dies between resolution and execution: the damage op
    // skips invalid_target_state, so the deferred heal cannot resolve.
    world.alive.delete(t)
    const outcome = world.makeBatchRunner().execute(resolution, world.sink)
    expect(outcome.status).toBe('partial')
    if (outcome.status !== 'partial') throw new Error('unreachable')
    const heal = outcome.results[4]!
    expect(heal.status).toBe('skipped')
    expect(heal.reason).toBe('dependency_not_resolved')
    expect(world.stubCalls.heal).toHaveLength(0)
  })
})

describe('tran_thuy (earth->water khac)', () => {
  it('seal gate: A2 emits no cam_cong op; A3 emits it -- sec.81', () => {
    const { world, system } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    // A2: below the authored gate -> no status step emitted at all.
    const low = resolve(world, system, s, t, [
      ['earth', 2],
      ['water', 3],
    ])
    expect(low.resolution.reactionId).toBe('tran_thuy')
    expect(
      opsOfType(low.resolution, 'apply_buff'),
    ).toHaveLength(0)

    const { world: world2, system: system2 } = makeWorld()
    // A3 D3 -> gate opens; durationOverride clamp(3-2,1,2) = 1.
    const high = resolve(world2, system2, s, t, [
      ['earth', 3],
      ['water', 3],
    ])
    const apply = opsOfType(high.resolution, 'apply_buff')[0]!
    expect(apply.payload.definitionId).toBe(TEST_STATUS_BUFF_IDS.camCong)
    expect(apply.payload.durationOverride).toBe(1)
    expect(apply.payload.reactionEligibility).toBe('suppressed')
  })

  it('D4 yields the 2-turn seal duration', () => {
    const { world, system } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    const { resolution } = resolve(world, system, s, t, [
      ['earth', 3],
      ['water', 4],
    ])
    const apply = opsOfType(resolution, 'apply_buff')[0]!
    expect(apply.payload.durationOverride).toBe(2) // clamp(4-2,1,2)
  })
})
