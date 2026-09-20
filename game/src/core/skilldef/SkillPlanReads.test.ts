import { describe, expect, it } from 'vitest'

import type { BuffDefinitionId } from '../battle/contracts/ids'

import {
  ENEMY_A,
  PLAYER,
  makeDef,
  makeHarness,
  makeInput,
  seedBuff,
  spawn,
} from './SkillExecutor.testkit'

describe('SkillPlanReads -- read steps see post-settlement state', () => {
  it('read_stacks writes the var; a branch consumes it against live stacks', () => {
    const def = makeDef({
      operations: [
        { type: 'read_stacks', target: 'primary_target', definitionId: 'ailment.burn', into: 'burn' },
        {
          type: 'if',
          condition: { kind: 'var', name: 'burn', op: 'gte', value: 3 },
          then: [{ type: 'push_gauge', target: 'primary_target', fractionOfMax: 0.5 }],
          else: [{ type: 'heal', target: 'self', amount: 1 }],
        },
      ],
    })
    const harness = makeHarness({ defs: [def] })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)
    seedBuff(harness, {
      definitionId: 'ailment.burn' as BuffDefinitionId,
      targetId: ENEMY_A,
      sourceId: PLAYER,
      kind: 'ailment',
      stacks: 5,
      hasPeriodic: true,
      dispellable: true,
    })

    const plan = harness.resolver.resolve(makeInput(def))
    harness.executor.execute(plan, makeInput(def))
    expect(harness.state.executedOps.map((o) => o.type)).toEqual(['push_gauge'])

    // and below threshold -> the else arm runs.
    const harness2 = makeHarness({ defs: [def] })
    spawn(harness2, PLAYER)
    spawn(harness2, ENEMY_A)
    seedBuff(harness2, {
      definitionId: 'ailment.burn' as BuffDefinitionId,
      targetId: ENEMY_A,
      sourceId: PLAYER,
      kind: 'ailment',
      stacks: 1,
      hasPeriodic: true,
      dispellable: true,
    })
    const plan2 = harness2.resolver.resolve(makeInput(def))
    harness2.executor.execute(plan2, makeInput(def))
    expect(harness2.state.executedOps.map((o) => o.type)).toEqual(['heal'])
  })

  it('late bindings patch coefficient against stacks visible post-settlement', () => {
    const def = makeDef({
      operations: [
        {
          type: 'add_buff_stacks',
          selector: { kind: 'target_definition', target: 'primary_target', definitionId: 'ailment.burn' },
          stacks: 2,
        },
        {
          type: 'deal_damage',
          target: 'primary_target',
          coefficient: { query: 'buff_stacks', target: 'primary_target', definitionId: 'ailment.burn' },
        },
      ],
    })
    const harness = makeHarness({ defs: [def] })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)
    seedBuff(harness, {
      definitionId: 'ailment.burn' as BuffDefinitionId,
      targetId: ENEMY_A,
      sourceId: PLAYER,
      kind: 'ailment',
      stacks: 1,
      hasPeriodic: true,
      dispellable: true,
    })

    const plan = harness.resolver.resolve(makeInput(def))
    harness.executor.execute(plan, makeInput(def))

    const damage = harness.state.executedOps.find((o) => o.type === 'deal_damage')!
    if (damage.type !== 'deal_damage') throw new Error('unreachable')
    // add_buff_stacks settled first -> the coefficient read sees 1+2=3.
    expect(damage.payload.coefficient).toBe(3)
  })

  it('hp_percent_below branch sees post-damage vitals', () => {
    const def = makeDef({
      operations: [
        { type: 'deal_damage', target: 'primary_target', coefficient: 6 }, // 60 dmg
        {
          type: 'if',
          condition: { kind: 'hp_percent_below', target: 'primary_target', threshold: 0.5 },
          then: [{ type: 'deal_damage', target: 'primary_target', coefficient: 1 }],
          else: [{ type: 'heal', target: 'self', amount: 1 }],
        },
      ],
    })
    const harness = makeHarness({
      defs: [def],
      damageScript: [{ landed: true, hpDamage: 60 }, { landed: true, hpDamage: 10 }],
    })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A, { hp: 100 })

    const plan = harness.resolver.resolve(makeInput(def))
    harness.executor.execute(plan, makeInput(def))

    // 60% hp lost -> below 50% -> execute branch fires the second hit.
    expect(harness.state.executedOps.map((o) => o.type)).toEqual([
      'deal_damage',
      'deal_damage',
    ])
  })

  it('ops_landed_any gates the consume-for-damage lane on a dodged hit', () => {
    const def = makeDef({
      operations: [
        {
          type: 'deal_damage',
          target: 'primary_target',
          coefficient: 1,
          consumeBuff: { definitionId: 'ailment.burn', damagePerStack: 50 },
        },
      ],
    })
    const harness = makeHarness({
      defs: [def],
      damageScript: [{ landed: false }],
    })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)
    seedBuff(harness, {
      definitionId: 'ailment.burn' as BuffDefinitionId,
      targetId: ENEMY_A,
      sourceId: PLAYER,
      kind: 'ailment',
      stacks: 4,
      hasPeriodic: true,
      dispellable: true,
    })

    const plan = harness.resolver.resolve(makeInput(def))
    harness.executor.execute(plan, makeInput(def))

    // the hit whiffed -> the landed gate closed -> no consume, no flat.
    expect(
      harness.state.executedOps.filter((o) => o.type === 'consume_buff_stacks'),
    ).toHaveLength(0)
    expect(harness.state.buffs).toHaveLength(1)
    expect(harness.state.buffs[0]!.stacks).toBe(4)
  })

  it('consumeWard reads the live pool post-hit and spends it all', () => {
    const def = makeDef({
      operations: [
        {
          type: 'deal_damage',
          target: 'primary_target',
          coefficient: 1,
          consumeWard: { damagePerWardPoint: 2 },
        },
      ],
    })
    const harness = makeHarness({ defs: [def] })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)
    harness.state.resources.set(`${PLAYER}|ward`, 7)

    const plan = harness.resolver.resolve(makeInput(def))
    harness.executor.execute(plan, makeInput(def))

    const spend = harness.state.executedOps.find((o) => o.type === 'consume_resource')!
    if (spend.type !== 'consume_resource') throw new Error('unreachable')
    expect(spend.payload).toMatchObject({
      targetId: PLAYER,
      resourceId: 'ward',
      amount: 'all',
    })
    expect(harness.state.resources.get(`${PLAYER}|ward`)).toBe(0)
    // ward flat rode the pre-spend pool (7 * 2).
    const flat = harness.state.executedOps.find(
      (o) => o.type === 'deal_damage' && o.payload.damageProfile === 'legacy_flat',
    )!
    if (flat.type !== 'deal_damage') throw new Error('unreachable')
    expect(flat.payload.coefficient).toBe(14)
  })
})
