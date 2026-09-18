import { describe, expect, it } from 'vitest'

import type { CombatRng } from '../battle/contracts/rng'
import type { SkillId } from '../battle/contracts/ids'

import {
  ENEMY_A,
  PLAYER,
  makeDef,
  makeHarness,
  makeInput,
  spawn,
} from './SkillExecutor.testkit'

function seqRng(rolls: readonly number[]): CombatRng & { consumed: number } {
  const state = { consumed: 0 }
  return {
    get consumed() {
      return state.consumed
    },
    roll() {
      const value = rolls[state.consumed] ?? 0
      state.consumed += 1
      return value
    },
    rollChance(chance: number) {
      return this.roll() < chance
    },
  }
}

describe('SkillSubcast -- repeat executions', () => {
  it('subcasts.count fires exactly N non-committing follow-up plans', () => {
    const def = makeDef({ subcasts: { count: 2 } })
    const harness = makeHarness({ defs: [def] })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)

    const plan = harness.resolver.resolve(makeInput(def))
    harness.executor.execute(plan, makeInput(def))

    // root + 2 repeats = 3 damage ops; follow-up origins index 1 and 2.
    const damage = harness.state.executedOps.filter((o) => o.type === 'deal_damage')
    expect(damage).toHaveLength(3)
    expect(damage.map((o) => o.origin.subcastIndex)).toEqual([0, 1, 2])
    // repeats never recommit.
    expect(harness.state.commits).toHaveLength(1)
  })

  it('a dead source between subcasts stops the remaining repeats', () => {
    // the root plan's self-buff is the kill vector -- once it settles the
    // source is dead, so every queued repeat drops on the alive gate.
    const def = makeDef({
      operations: [
        { type: 'apply_buff', target: 'self', definitionId: 'buff.doom' },
        { type: 'deal_damage', target: 'primary_target', coefficient: 1 },
      ],
      subcasts: { count: 3 },
    })
    const harness = makeHarness({
      defs: [def],
      onBuffApplied: () => {
        harness.state.alive.delete(PLAYER)
      },
    })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)

    const plan = harness.resolver.resolve(makeInput(def))
    harness.executor.execute(plan, makeInput(def))

    // The self-buff settles first and kills the source; the damage
    // lane's target_alive(source) branch then evaluates false, so the
    // root plan's own hit never emits (T3-22b mid-impact death parity)
    // and all 3 repeats drop on a dead source.
    expect(harness.state.executedOps.map((o) => o.type)).toEqual(['apply_buff'])
  })
})

describe('SkillSubcast -- multicast chain', () => {
  it('multicast{chance:1,maxExtraCasts:2} spawns 2 chained executions, each settling in order', () => {
    const def = makeDef({
      subcasts: { multicast: { chance: 1, maxExtraCasts: 2 } },
    })
    const rng = seqRng([0.5, 0.5, 0.5]) // every rollChance succeeds
    const harness = makeHarness({ defs: [def], rng })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)

    const plan = harness.resolver.resolve(makeInput(def))
    harness.executor.execute(plan, makeInput(def))

    const damage = harness.state.executedOps.filter((o) => o.type === 'deal_damage')
    expect(damage).toHaveLength(3)
    expect(damage.map((o) => o.origin.subcastIndex)).toEqual([0, 1, 2])
    expect(rng.consumed).toBe(2) // one roll per spawned execution
  })

  it('caps the chain at min(maxExtraCasts, SKILL_MAX_MULTICAST)', () => {
    const def = makeDef({
      subcasts: { multicast: { chance: 1, maxExtraCasts: 99 } },
    })
    const rng = seqRng([0.5, 0.5, 0.5, 0.5, 0.5])
    const harness = makeHarness({ defs: [def], rng })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)

    const plan = harness.resolver.resolve(makeInput(def))
    harness.executor.execute(plan, makeInput(def))

    const damage = harness.state.executedOps.filter((o) => o.type === 'deal_damage')
    expect(damage).toHaveLength(1 + 3) // MAX_MULTICAST = 3
    expect(rng.consumed).toBe(3)
  })

  it('a failed roll stops the chain', () => {
    const def = makeDef({
      subcasts: { multicast: { chance: 0.5, maxExtraCasts: 3 } },
    })
    const rng = seqRng([0.1, 0.9]) // first succeeds, second fails
    const harness = makeHarness({ defs: [def], rng })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)

    const plan = harness.resolver.resolve(makeInput(def))
    harness.executor.execute(plan, makeInput(def))

    const damage = harness.state.executedOps.filter((o) => o.type === 'deal_damage')
    expect(damage).toHaveLength(2)
    expect(rng.consumed).toBe(2)
  })

  it('an empowered root resolution never rolls multicast', () => {
    const base = makeDef({
      id: 'skill.ult' as SkillId,
      subcasts: { multicast: { chance: 1, maxExtraCasts: 2 } },
      variants: {
        empowerment: {
          theThreshold: 100,
          empoweredSkillId: 'skill.ult.empowered' as SkillId,
        },
      },
    })
    const empowered = makeDef({ id: 'skill.ult.empowered' as SkillId })
    const rng = seqRng([0.5, 0.5])
    const harness = makeHarness({ defs: [base, empowered], rng })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)

    const input = makeInput(base, {
      entityQuery: {
        currentThe: () => 150,
        currentMp: () => 50,
        alive: () => true,
        enemiesOf: () => [ENEMY_A],
        alliesOf: () => [PLAYER],
      },
    })
    const plan = harness.resolver.resolve(input)
    expect(plan.resolvedVariantId).toBe('skill.ult.empowered')
    harness.executor.execute(plan, input)

    const damage = harness.state.executedOps.filter((o) => o.type === 'deal_damage')
    expect(damage).toHaveLength(1)
    expect(rng.consumed).toBe(0) // zero multicast rolls consumed
  })
})

describe('SkillSubcast -- composite extras', () => {
  it('extra picks resolve as inline non-committing plans in pick order', () => {
    const shell = makeDef({
      id: 'skill.shell' as SkillId,
      operations: [],
      subcasts: {
        compositePool: ['skill.fire' as SkillId, 'skill.metal' as SkillId, 'skill.wood' as SkillId],
        compositeCount: 3,
      },
    })
    const fire = makeDef({
      id: 'skill.fire' as SkillId,
      operations: [{ type: 'deal_damage', target: 'primary_target', coefficient: 1 }],
    })
    const metal = makeDef({
      id: 'skill.metal' as SkillId,
      operations: [{ type: 'heal', target: 'self', amount: 2 }],
    })
    const wood = makeDef({
      id: 'skill.wood' as SkillId,
      operations: [{ type: 'push_gauge', target: 'primary_target', fractionOfMax: 0.1 }],
    })
    // picks[0]=fire (roll 0.0), then metal (0.0), then wood (last).
    const rng = seqRng([0.0, 0.0, 0.9])
    const harness = makeHarness({ defs: [shell, fire, metal, wood], rng })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)

    const plan = harness.resolver.resolve(makeInput(shell))
    expect(plan.snapshot.compositePicks).toEqual(['skill.fire', 'skill.metal', 'skill.wood'])
    harness.executor.execute(plan, makeInput(shell))

    // extras (metal, wood) resolve BEFORE the primary payload (fire)
    // -- TBS compositePickedSkills parity. Each is its own settled plan;
    // the extras consume subcastIndex 1,2 while the root stays 0.
    expect(harness.state.executedOps.map((o) => o.type)).toEqual([
      'heal',
      'push_gauge',
      'deal_damage',
    ])
    expect(harness.state.executedOps.map((o) => o.origin.subcastIndex)).toEqual([1, 2, 0])
    expect(harness.state.executedOps.map((o) => o.origin.originId)).toEqual([
      'skill.metal',
      'skill.wood',
      'skill.fire',
    ])
    // extras never recommit.
    expect(harness.state.commits).toHaveLength(1)
  })

  it('repeats re-roll the composite pool per execution', () => {
    const shell = makeDef({
      id: 'skill.shell' as SkillId,
      operations: [],
      subcasts: {
        count: 1,
        compositePool: ['skill.fire' as SkillId, 'skill.metal' as SkillId],
        compositeCount: 1,
      },
    })
    const fire = makeDef({
      id: 'skill.fire' as SkillId,
      operations: [{ type: 'deal_damage', target: 'primary_target', coefficient: 1 }],
    })
    const metal = makeDef({
      id: 'skill.metal' as SkillId,
      operations: [{ type: 'heal', target: 'self', amount: 2 }],
    })
    // root pick -> fire (0.0); repeat re-resolve pick -> metal (0.99).
    const rng = seqRng([0.0, 0.99])
    const harness = makeHarness({ defs: [shell, fire, metal], rng })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)

    const plan = harness.resolver.resolve(makeInput(shell))
    harness.executor.execute(plan, makeInput(shell))

    expect(harness.state.executedOps.map((o) => o.origin.originId)).toEqual([
      'skill.fire',
      'skill.metal',
    ])
    expect(harness.state.executedOps.map((o) => o.origin.subcastIndex)).toEqual([0, 1])
  })
})
