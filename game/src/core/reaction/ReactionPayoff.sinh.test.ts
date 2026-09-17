// ReactionPayoff.sinh.test.ts -- megaplan M4 step 1 (spec sec.77):
// authored sinh payoff emission through the real CANONICAL_REACTIONS
// data + emitPayoffOperations. Asserts snapshot-authoritative math
// (pre-consume P), consume-first ordering, child conversion via
// AddBuffStacks (never ApplyBuff -- INV-R14), modifier reapply:'max'
// buff_lifetime semantics, authored duration cap, and gauge ops.

import { describe, expect, it } from 'vitest'
import type {
  AddBuffModifierOperation,
  AddBuffStacksOperation,
  ConsumeBuffStacksOperation,
  ExtendBuffDurationOperation,
  PushGaugeOperation,
} from '../battle/contracts/operations'
import { CANONICAL_REACTIONS } from '../../data/reaction/ReactionDefinitions'
import { ReactionRegistry } from './ReactionRegistry'
import type { ReactionResolution } from './ReactionResolution'
import { ELEMENTAL_REACTION_CAPABILITY } from './ReactionTypes'
import {
  createReactionTestWorld,
  TEST_ELEMENT_BUFF_IDS,
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

describe('duong_viem (wood->fire sinh)', () => {
  it('consumes all parent, keeps child, converts, amplifies -- sec.77', () => {
    const { world, system } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    // seed: wood4 + fire1 -> duong_viem (P=4)
    const { resolution } = resolve(world, system, s, t, [
      ['wood', 4],
      ['fire', 1],
    ])
    expect(resolution.reactionId).toBe('duong_viem')

    // Op emission: consume(parent 4) -> add_child_stacks ceil(4/2)=+2
    // on the CHILD INSTANCE -> add_child_modifier duong_viem x1.2.
    expect(resolution.operations).toHaveLength(3)
    const consume = resolution.operations[0]! as ConsumeBuffStacksOperation
    const addStacks = resolution.operations[1]! as AddBuffStacksOperation
    const addModifier =
      resolution.operations[2]! as AddBuffModifierOperation
    expect(consume.type).toBe('consume_buff_stacks')
    expect(consume.payload.stacks).toBe('all') // parent consumed entirely
    expect(consume.payload.removalReason).toBe('reaction')
    expect(addStacks.type).toBe('add_buff_stacks')
    expect(addStacks.payload.stacks).toBe(2)
    // Conversion targets the existing child instance (resolved through
    // the ElementalStateRegistry binding -- no literal buff id in data).
    expect(addStacks.payload.selector.kind).toBe('instance')
    expect(addModifier.type).toBe('add_buff_modifier')
    expect(addModifier.payload.modifier).toMatchObject({
      id: 'duong_viem',
      channel: 'periodic_damage',
      operation: 'multiply',
      reapply: 'max',
      lifetime: { type: 'buff_lifetime' },
    })
    expect(addModifier.payload.modifier.value).toBeCloseTo(1.2)

    const outcome = world.makeBatchRunner().execute(resolution, world.sink)
    expect(outcome.status).toBe('resolved')
    // Post-consume board: parent gone, child at 1+2=3 stacks.
    const board = world.boardQuery.read(s, t)
    expect(board.woodStacks).toBe(0)
    expect(board.fireStacks).toBe(3)
    // Modifier landed on the child instance.
    const fire = board.instances.fire!
    const snapshot = world.system.getInstance({
      kind: 'instance',
      instanceId: fire,
    })!
    const modifier = snapshot.modifiers.find((m) => m.id === 'duong_viem')!
    expect(modifier.value).toBeCloseTo(1.2)
    expect(modifier.lifetime).toEqual({ type: 'buff_lifetime' })
    // INV-R18: sinh never emits a damage op.
    expect(world.stubCalls.damage).toHaveLength(0)
    // reaction_resolved lists the pre-consume parent consumption.
    const evt = world.sink.events.find((e) => e.type === 'reaction_resolved')!
    expect(
      (evt as { consumed: readonly { stacks: number }[] }).consumed.map((c) => c.stacks),
    ).toEqual([4])
  })

  it('amplifier reapply keeps max (sec.77)', () => {
    const { world, system } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    // Seed fire carrying duong_viem x1.25 (a stronger earlier proc).
    const trigger = world.applyElement(s, t, 'fire', 1)!
    void trigger
    const fireInstance = world.boardQuery.read(s, t).instances.fire!
    world.system.addModifier(
      { kind: 'instance', instanceId: fireInstance },
      {
        id: 'duong_viem',
        channel: 'periodic_damage',
        operation: 'multiply',
        value: 1.25,
        reapply: 'max',
        priority: 0,
        lifetime: { type: 'buff_lifetime' },
      },
      world.makeCtx(),
    )
    const { resolution } = resolve(world, system, s, t, [['wood', 2]])
    expect(resolution.reactionId).toBe('duong_viem')
    // New proc would be x1.10 (P=2) -- reapply:'max' keeps x1.25.
    world.makeBatchRunner().execute(resolution, world.sink)
    const snapshot = world.system.getInstance({
      kind: 'instance',
      instanceId: fireInstance,
    })!
    expect(
      snapshot.modifiers.find((m) => m.id === 'duong_viem')!.value,
    ).toBeCloseTo(1.25)
  })
})

describe('tu_thuy (metal->water sinh)', () => {
  it('extends child duration capped at authored maxRemaining 5', () => {
    const { world, system } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    // Seed water at remaining 4 (base duration 3 + 1 manual extension).
    world.applyElement(s, t, 'water', 2)
    const waterInstance = world.boardQuery.read(s, t).instances.water!
    world.system.extendDuration(
      { kind: 'instance', instanceId: waterInstance },
      1,
      undefined,
      world.makeCtx(),
    )
    expect(
      world.system.getInstance({ kind: 'instance', instanceId: waterInstance })!
        .remaining,
    ).toBe(4)

    const { resolution } = resolve(world, system, s, t, [['metal', 4]])
    expect(resolution.reactionId).toBe('tu_thuy')
    const extend = resolution.operations.find(
      (op) => 'type' in op && op.type === 'extend_buff_duration',
    ) as ExtendBuffDurationOperation
    // floor(P/2) = 2, authored cap 5.
    expect(extend.payload.turns).toBe(2)
    expect(extend.payload.maxRemaining).toBe(5)
    world.makeBatchRunner().execute(resolution, world.sink)
    // 4 + 2 = 6 -> capped at 5.
    expect(
      world.system.getInstance({ kind: 'instance', instanceId: waterInstance })!
        .remaining,
    ).toBe(5)
    expect(world.boardQuery.read(s, t).metalStacks).toBe(0)
    expect(world.boardQuery.read(s, t).waterStacks).toBe(4) // 2 + ceil(4/2)
  })
})

describe('luyen_tho (fire->earth sinh)', () => {
  it('pushes gauge by -0.03*P (P5 -> -0.15)', () => {
    const { world, system } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    const { resolution } = resolve(world, system, s, t, [
      ['fire', 5],
      ['earth', 1],
    ])
    expect(resolution.reactionId).toBe('luyen_tho')
    const gauge = resolution.operations.find(
      (op) => 'type' in op && op.type === 'push_gauge',
    ) as PushGaugeOperation
    expect(gauge.payload.fractionOfMax).toBeCloseTo(-0.15)
    expect(gauge.payload.targetId).toBe(t)
    world.makeBatchRunner().execute(resolution, world.sink)
    expect(world.stubCalls.gauge).toEqual([
      { targetId: t, fractionOfMax: -0.15 },
    ])
    expect(world.boardQuery.read(s, t).earthStacks).toBe(4) // 1 + ceil(5/2)
  })
})

describe('child conversion is registry-bound (INV-R14)', () => {
  it('add_child_stacks selector is the live child instance resolved via ElementalStateRegistry', () => {
    const { world, system } = makeWorld()
    const s = TEST_ENTITIES.sourceA
    const t = TEST_ENTITIES.targetA
    const { resolution } = resolve(world, system, s, t, [
      ['earth', 2],
      ['metal', 1],
    ])
    expect(resolution.reactionId).toBe('duong_kim')
    const addStacks = resolution.operations.find(
      (op) => 'type' in op && op.type === 'add_buff_stacks',
    ) as AddBuffStacksOperation
    const metalInstance = world.boardQuery.read(s, t).instances.metal!
    // The instance is the registry-bound metal seal -- never a literal
    // buff id authored inside the reaction data.
    expect(addStacks.payload.selector).toEqual({
      kind: 'instance',
      instanceId: metalInstance,
    })
    const snapshot = world.system.getInstance({
      kind: 'instance',
      instanceId: metalInstance,
    })!
    expect(snapshot.definitionId).toBe(TEST_ELEMENT_BUFF_IDS.metal)
  })
})
