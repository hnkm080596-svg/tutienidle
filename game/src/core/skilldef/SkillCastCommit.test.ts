import { describe, expect, it } from 'vitest'

import type { CombatRng } from '../battle/contracts/rng'
import type { SkillId } from '../battle/contracts/ids'

import {
  ENEMY_A,
  PLAYER,
  makeDef,
  makeHarness,
  makeInput,
  setResource,
  spawn,
} from './SkillExecutor.testkit'

/** rng spy -- counts every executor-visible roll. */
function spyRng(rolls: readonly number[] = []): CombatRng & { consumed: number } {
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

describe('SkillCastCommit -- CAST_COMMIT seam (R-S9)', () => {
  it('commits the root cast exactly once and settles cost BEFORE the first plan step', () => {
    const def = makeDef({
      cost: { resourceType: 'mana', amount: 15 },
      operations: [{ type: 'deal_damage', target: 'primary_target', coefficient: 1 }],
    })
    const rng = spyRng()
    const harness = makeHarness({ defs: [def], rng })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)
    setResource(harness, PLAYER, 'mana', 30)

    const plan = harness.resolver.resolve(makeInput(def))
    const outcome = harness.executor.execute(plan, makeInput(def))

    expect(outcome.blocked).toBe(false)
    expect(harness.state.commits).toHaveLength(1)
    expect(harness.state.commits[0]!.cadence).toEqual({ cooldownTurns: 2 })
    // consume_resource op minted FIRST, then the authored damage op.
    expect(harness.state.executedOps.map((o) => o.type)).toEqual([
      'consume_resource',
      'deal_damage',
    ])
    const cost = harness.state.executedOps[0]!
    if (cost.type !== 'consume_resource') throw new Error('unreachable')
    expect(cost.payload).toMatchObject({
      targetId: PLAYER,
      resourceId: 'mana',
      amount: 15,
    })
    expect(harness.state.resources.get(`${PLAYER}|mana`)).toBe(15)
    // the cost op shares the cast's origin (kind skill + castId).
    expect(cost.origin.castId).toBe('cast.1')
  })

  it('blocks the cast at PRECHECK when cost is insufficient -- zero commits, zero ops', () => {
    const def = makeDef({
      cost: { resourceType: 'mana', amount: 99 },
    })
    const rng = spyRng()
    const harness = makeHarness({ defs: [def], rng })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)
    setResource(harness, PLAYER, 'mana', 10)

    const plan = harness.resolver.resolve(makeInput(def))
    const outcome = harness.executor.execute(plan, makeInput(def))

    expect(outcome.blocked).toBe(true)
    expect(outcome.landed).toBe(false)
    expect(harness.state.commits).toHaveLength(0)
    expect(harness.state.executedOps).toHaveLength(0)
    expect(harness.state.resources.get(`${PLAYER}|mana`)).toBe(10)
  })

  it('never rolls back committed cooldown + cost on a whiff (all hits dodged)', () => {
    const def = makeDef({
      cost: { resourceType: 'mana', amount: 15 },
      landed: 'any_damage_landed',
    })
    const rng = spyRng()
    const harness = makeHarness({
      defs: [def],
      rng,
      damageScript: [{ landed: false }],
    })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)
    setResource(harness, PLAYER, 'mana', 30)

    const plan = harness.resolver.resolve(makeInput(def))
    const outcome = harness.executor.execute(plan, makeInput(def))

    expect(outcome.landed).toBe(false)
    expect(outcome.whiffed).toBe(true)
    // committed state survives the whiff -- spec sec.14.
    expect(harness.state.commits).toHaveLength(1)
    expect(harness.state.resources.get(`${PLAYER}|mana`)).toBe(15)
  })

  it('skips commit + cost for subcastIndex>0 follow-up plans', () => {
    const def = makeDef({
      cost: { resourceType: 'mana', amount: 15 },
    })
    const rng = spyRng()
    const harness = makeHarness({ defs: [def], rng })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)
    setResource(harness, PLAYER, 'mana', 100)

    const root = harness.resolver.resolve(makeInput(def))
    harness.executor.execute(root, makeInput(def))
    expect(harness.state.commits).toHaveLength(1)
    const afterRoot = harness.state.executedOps.length

    const followUp = harness.resolver.resolve(makeInput(def, { subcastIndex: 1 }))
    harness.executor.execute(followUp, makeInput(def, { subcastIndex: 1 }))

    // no second commit, no second consume_resource -- only the damage op.
    expect(harness.state.commits).toHaveLength(1)
    const followUpOps = harness.state.executedOps.slice(afterRoot)
    expect(followUpOps.map((o) => o.type)).toEqual(['deal_damage'])
    expect(followUpOps[0]!.origin.subcastIndex).toBe(1)
    expect(harness.state.resources.get(`${PLAYER}|mana`)).toBe(85)
  })

  it('commits the charge-init plan through the same seam (chargeProgress rides the port)', () => {
    const def = makeDef({
      cadence: { cooldownTurns: 3, chargeTurns: 1 },
      cost: { resourceType: 'mana', amount: 5 },
    })
    const rng = spyRng()
    const harness = makeHarness({ defs: [def], rng })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)
    setResource(harness, PLAYER, 'mana', 20)

    const plan = harness.resolver.resolve(makeInput(def))
    harness.executor.execute(plan, makeInput(def))

    expect(harness.state.commits).toHaveLength(1)
    expect(harness.state.commits[0]!.cadence).toEqual({
      cooldownTurns: 3,
      chargeTurns: 1,
    })
    // charge-init declares queue NO follow-ups (TBS isCharging parity).
    const multicastDef = makeDef({
      cadence: { cooldownTurns: 3, chargeTurns: 1 },
      subcasts: { multicast: { chance: 1, maxExtraCasts: 2 } },
    })
    const harness2 = makeHarness({ defs: [multicastDef], rng: spyRng() })
    spawn(harness2, PLAYER)
    spawn(harness2, ENEMY_A)
    const plan2 = harness2.resolver.resolve(makeInput(multicastDef))
    harness2.executor.execute(plan2, makeInput(multicastDef))
    expect(
      harness2.state.executedOps.filter((o) => o.type === 'deal_damage'),
    ).toHaveLength(1)
  })

  it('settles consume_resource BEFORE gain_resource ops (gain-after-consume)', () => {
    const def = makeDef({
      cost: { resourceType: 'the', amount: 40 },
      operations: [
        { type: 'deal_damage', target: 'primary_target', coefficient: 1 },
        { type: 'gain_resource', target: 'self', resourceId: 'the', amount: 5 },
      ],
    })
    const rng = spyRng()
    const harness = makeHarness({ defs: [def], rng })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)
    setResource(harness, PLAYER, 'the', 40)

    const plan = harness.resolver.resolve(makeInput(def))
    harness.executor.execute(plan, makeInput(def))

    expect(harness.state.executedOps.map((o) => o.type)).toEqual([
      'consume_resource',
      'deal_damage',
      'gain_resource',
    ])
    // 40 - 40 + 5 -- the gain landed on the post-consume pool.
    expect(harness.state.resources.get(`${PLAYER}|the`)).toBe(5)
  })

  it('the executor rng spy sees NO hit/crit/armor rolls on policy-carrying plans', () => {
    const def = makeDef({
      instances: {
        count: 2,
        each: {
          guaranteedHit: true,
          critChance: 0.5,
          armorPierce: { bypassChance: 0.5, pierceFraction: 0.5 },
        },
      },
    })
    const rng = spyRng()
    const harness = makeHarness({ defs: [def], rng })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)

    const plan = harness.resolver.resolve(makeInput(def))
    harness.executor.execute(plan, makeInput(def))

    // 2 instance ops executed; policies ride the payload as DECLARED
    // intent -- the executor never consumes rng for them.
    const damage = harness.state.executedOps.filter(
      (o) => o.type === 'deal_damage',
    )
    expect(damage).toHaveLength(2)
    expect(rng.consumed).toBe(0)
  })
})
