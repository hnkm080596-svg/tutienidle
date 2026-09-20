import { describe, expect, it } from 'vitest'

import type { BuffDefinitionId, CombatEntityId } from '../battle/contracts/ids'

import {
  ENEMY_A,
  ENEMY_B,
  PLAYER,
  makeDef,
  makeHarness,
  makeInput,
  seedBuff,
  spawn,
} from './SkillExecutor.testkit'
import type { FakeBuff } from './SkillExecutor.testkit'

describe('SkillExecutor -- ordering + settlement (contract sec.55/94)', () => {
  it('a read step after apply_buff+reaction sees post-settlement stacks = 0', () => {
    // apply Hoa -> settlement-time reaction consumes it -> read sees 0.
    const def = makeDef({
      operations: [
        { type: 'apply_buff', target: 'primary_target', definitionId: 'ailment.burn' },
        { type: 'read_stacks', target: 'primary_target', definitionId: 'ailment.burn', into: 'burn' },
        {
          type: 'if',
          condition: { kind: 'var', name: 'burn', op: 'eq', value: 0 },
          then: [{ type: 'push_gauge', target: 'primary_target', fractionOfMax: 0.5 }],
        },
      ],
    })
    const harness = makeHarness({
      defs: [def],
      // the reaction lane: the instant the burn lands, a reaction
      // consumes it inside the SAME settlement barrier.
      onBuffApplied: (inst: FakeBuff) => {
        harness.state.buffs.splice(harness.state.buffs.indexOf(inst), 1)
      },
    })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)

    const plan = harness.resolver.resolve(makeInput(def))
    harness.executor.execute(plan, makeInput(def))

    // the gauge op ran -> the branch read the post-consume state (0).
    expect(harness.state.executedOps.map((o) => o.type)).toEqual([
      'apply_buff',
      'push_gauge',
    ])
  })

  it('settles each operation before the next step (op order log = authored order)', () => {
    const def = makeDef({
      operations: [
        { type: 'apply_buff', target: 'primary_target', definitionId: 'buff.mark' },
        { type: 'deal_damage', target: 'primary_target', coefficient: 1 },
        { type: 'heal', target: 'self', amount: 5 },
      ],
    })
    const harness = makeHarness({ defs: [def] })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)

    const plan = harness.resolver.resolve(makeInput(def))
    harness.executor.execute(plan, makeInput(def))

    expect(harness.state.executedOps.map((o) => o.type)).toEqual([
      'apply_buff',
      'deal_damage',
      'heal',
    ])
    // every op carries the cast origin envelope.
    for (const op of harness.state.executedOps) {
      expect(op.origin).toMatchObject({ kind: 'skill', castId: 'cast.1', subcastIndex: 0 })
    }
    // one execution record per op -- barrier-per-op settlement.
    expect(harness.scheduler.trace.records).toHaveLength(3)
  })
})

describe('SkillExecutor -- outcome semantics (R-S2)', () => {
  it('all-dodged plan -> landed:false whiffed:true', () => {
    const def = makeDef({
      landed: 'any_damage_landed',
      operations: [
        { type: 'deal_damage', target: 'primary_target', coefficient: 1 },
        { type: 'deal_damage', target: 'primary_target', coefficient: 1 },
      ],
    })
    const harness = makeHarness({
      defs: [def],
      damageScript: [{ landed: false }, { landed: false }],
    })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)

    const plan = harness.resolver.resolve(makeInput(def))
    const outcome = harness.executor.execute(plan, makeInput(def))
    expect(outcome.landed).toBe(false)
    expect(outcome.whiffed).toBe(true)
    expect(outcome.critLanded).toBe(false)
  })

  it('buff-only self cast -> landed:true (self scope connects)', () => {
    const def = makeDef({
      targetIntent: 'self',
      operations: [
        { type: 'apply_buff', target: 'self', definitionId: 'buff.ward' },
      ],
    })
    const harness = makeHarness({ defs: [def] })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)

    const plan = harness.resolver.resolve(makeInput(def, { declaredTargetIds: [PLAYER] }))
    const outcome = harness.executor.execute(plan, makeInput(def, { declaredTargetIds: [PLAYER] }))
    expect(outcome.landed).toBe(true)
  })

  it('crit damage marks critLanded + anyTargetLanded', () => {
    const def = makeDef({ landed: 'any_damage_landed' })
    const harness = makeHarness({
      defs: [def],
      damageScript: [{ landed: true, crit: true }],
    })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)

    const plan = harness.resolver.resolve(makeInput(def))
    const outcome = harness.executor.execute(plan, makeInput(def))
    expect(outcome.critLanded).toBe(true)
    expect(outcome.anyTargetLanded).toBe(true)
    expect(outcome.landed).toBe(true)
  })

  it('dead target mid-plan -> trailing ops skipped, earlier committed, no rollback', () => {
    const def = makeDef({
      operations: [
        { type: 'apply_buff', target: 'primary_target', definitionId: 'buff.mark' },
        { type: 'deal_damage', target: 'primary_target', coefficient: 100 },
        { type: 'heal', target: 'primary_target', amount: 5 },
        { type: 'deal_damage', target: 'primary_target', coefficient: 1 },
      ],
    })
    const harness = makeHarness({ defs: [def] })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A, { hp: 50 })

    const plan = harness.resolver.resolve(makeInput(def))
    const outcome = harness.executor.execute(plan, makeInput(def))

    const results = harness.scheduler.trace.records.map((r) => ({
      type: r.operation.type,
      status: r.result.status,
    }))
    // The second hit lane sits inside a target_alive(target) branch --
    // with ENEMY_A dead the lane never mints, mirroring the legacy
    // `continue` on dead targets. Non-hit ops still mint and settle
    // 'skipped' via the scheduler's isAlive precondition.
    expect(results).toEqual([
      { type: 'apply_buff', status: 'resolved' },
      { type: 'deal_damage', status: 'resolved' }, // kills ENEMY_A
      { type: 'heal', status: 'skipped' }, // dead target
    ])
    // earlier ops stayed committed -- the buff remains on the corpse.
    expect(harness.state.buffs).toHaveLength(1)
    expect(outcome.landed).toBe(true)
  })

  it('skipped ops do not count as landed but the plan continues', () => {
    const def = makeDef({
      landed: 'any_damage_landed',
      operations: [
        { type: 'deal_damage', target: 'primary_target', coefficient: 100 },
        { type: 'deal_damage', target: 'primary_target', coefficient: 1 },
        { type: 'apply_buff', target: 'self', definitionId: 'buff.aftermath' },
      ],
    })
    const harness = makeHarness({ defs: [def] })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A, { hp: 30 })

    const plan = harness.resolver.resolve(makeInput(def))
    const outcome = harness.executor.execute(plan, makeInput(def))

    // damage op 1 kills -> damage op 2's lane is suppressed by its
    // target_alive(target) branch (legacy dead-target `continue`) ->
    // aftermath still applies.
    expect(harness.state.executedOps.map((o) => o.type)).toEqual([
      'deal_damage',
      'apply_buff',
    ])
    expect(outcome.landed).toBe(true) // first hit connected
  })
})

describe('SkillExecutor -- for_each_instance + detonate', () => {
  it('clones the consume template per matching instance in canonical order', () => {
    const def = makeDef({
      operations: [
        { type: 'deal_damage', target: 'primary_target', coefficient: 1, consumeBuff: { definitionId: 'ailment.burn', damagePerStack: 50 } },
      ],
    })
    const harness = makeHarness({ defs: [def] })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)
    // two burn instances on the target from the same source.
    seedBuff(harness, {
      definitionId: 'ailment.burn' as BuffDefinitionId,
      targetId: ENEMY_A,
      sourceId: PLAYER,
      kind: 'ailment',
      stacks: 2,
      hasPeriodic: true,
      dispellable: true,
    })
    seedBuff(harness, {
      definitionId: 'ailment.burn' as BuffDefinitionId,
      targetId: ENEMY_A,
      sourceId: PLAYER,
      kind: 'ailment',
      stacks: 3,
      hasPeriodic: true,
      dispellable: true,
    })

    const plan = harness.resolver.resolve(makeInput(def))
    harness.executor.execute(plan, makeInput(def))

    const consumes = harness.state.executedOps.filter(
      (o) => o.type === 'consume_buff_stacks',
    )
    expect(consumes).toHaveLength(2)
    // per-instance selectors bound in canonical sortedForTarget order.
    const first = consumes[0]!
    if (first.type !== 'consume_buff_stacks') throw new Error('unreachable')
    expect(first.payload.selector.kind).toBe('instance')
    // both instances consumed -> removed.
    expect(harness.state.buffs).toHaveLength(0)
    // flat damage op ran with summed stacks * damagePerStack coefficient.
    const flat = harness.state.executedOps.find(
      (o) => o.type === 'deal_damage' && o.payload.damageProfile === 'legacy_flat',
    )
    expect(flat).toBeDefined()
  })

  it('detonate consumes only damage-periodic ailments, bursts per periodic, and re-seeds suppressed', () => {
    const def = makeDef({
      operations: [
        { type: 'push_gauge', target: 'primary_target', fractionOfMax: 0.1 },
        { type: 'detonate', target: 'primary_target', amp: 2 },
      ],
    })
    const harness = makeHarness({ defs: [def] })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A, { hp: 10000 })
    const dot = seedBuff(harness, {
      definitionId: 'ailment.burn' as BuffDefinitionId,
      targetId: ENEMY_A,
      sourceId: PLAYER,
      kind: 'ailment',
      stacks: 4,
      hasPeriodic: true,
      dispellable: true,
      remainingTurns: 3,
      periodicDamageMult: 2,
      potencyMult: 1.5,
      damagePeriodics: [
        { periodicId: 'p1', coefficient: 0.5, element: 'fire' },
        { periodicId: 'p2', coefficient: 0.25, element: 'fire', tags: ['t'] },
      ],
    })
    const utility = seedBuff(harness, {
      definitionId: 'ailment.slow' as BuffDefinitionId,
      targetId: ENEMY_A,
      sourceId: PLAYER,
      kind: 'ailment',
      stacks: 1,
      hasPeriodic: true, // heal-only periodic -- still not a DAMAGE periodic
      dispellable: true,
    })
    const buffInst = seedBuff(harness, {
      definitionId: 'buff.shield' as BuffDefinitionId,
      targetId: ENEMY_A,
      sourceId: PLAYER,
      kind: 'buff',
      stacks: 1,
      hasPeriodic: true,
      dispellable: true,
    })

    const plan = harness.resolver.resolve(makeInput(def))
    harness.executor.execute(plan, makeInput(def))

    const types = harness.state.executedOps.map((o) => o.type)
    expect(types).toEqual([
      'push_gauge',
      'consume_buff_stacks', // the dot only
      'deal_damage', // detonate_burst p1
      'deal_damage', // detonate_burst p2
      'apply_buff', // re-seed
    ])
    // TBS applyDetonate parity: coefficient x periodicDamageMult x
    // potencyMult x remainingTurns x stacks x amp, per periodic.
    const p1 = harness.state.executedOps[2]!
    if (p1.type !== 'deal_damage') throw new Error('unreachable')
    expect(p1.payload.damageProfile).toBe('detonate_burst')
    expect(p1.payload.coefficient).toBe(0.5 * 2 * 1.5 * 3 * 4 * 2)
    expect(p1.payload.element).toBe('fire')
    expect(p1.payload.statSourceId).toBe(PLAYER)
    expect(p1.payload.canCrit).toBe(false)
    expect(p1.payload.canMiss).toBe(false)
    const p2 = harness.state.executedOps[3]!
    if (p2.type !== 'deal_damage') throw new Error('unreachable')
    expect(p2.payload.coefficient).toBe(0.25 * 2 * 1.5 * 3 * 4 * 2)
    expect(p2.payload.tags).toEqual(['t'])
    const reseed = harness.state.executedOps[4]!
    if (reseed.type !== 'apply_buff') throw new Error('unreachable')
    expect(reseed.payload.definitionId).toBe(dot.definitionId)
    expect(reseed.payload.stacks).toBe(1)
    expect(reseed.payload.baseChance).toBe(1)
    expect(reseed.payload.reactionEligibility).toBe('suppressed')
    // utility ailment + buff untouched; re-seeded burn at 1 stack.
    expect(
      harness.state.buffs.map((b) => b.definitionId).sort(),
    ).toEqual([dot.definitionId, utility.definitionId, buffInst.definitionId].sort())
    expect(
      harness.state.buffs.find((b) => b.definitionId === dot.definitionId)?.stacks,
    ).toBe(1)
  })

  it('detonate dedupes re-seeds per definition across same-id instances', () => {
    const def = makeDef({
      operations: [{ type: 'detonate', target: 'primary_target', amp: 1 }],
    })
    const harness = makeHarness({ defs: [def] })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)
    // two instances of the SAME def -- both consume, one re-seed.
    for (const stacks of [2, 5]) {
      seedBuff(harness, {
        definitionId: 'ailment.burn' as BuffDefinitionId,
        targetId: ENEMY_A,
        sourceId: PLAYER,
        kind: 'ailment',
        stacks,
        hasPeriodic: true,
        dispellable: true,
        remainingTurns: 2,
        damagePeriodics: [{ periodicId: 'p', coefficient: 1, element: 'fire' }],
      })
    }

    const plan = harness.resolver.resolve(makeInput(def))
    harness.executor.execute(plan, makeInput(def))

    const types = harness.state.executedOps.map((o) => o.type)
    expect(types).toEqual([
      'consume_buff_stacks',
      'deal_damage',
      'consume_buff_stacks',
      'deal_damage',
      'apply_buff', // ONE re-seed for the shared definition id
    ])
  })
})

describe('SkillExecutor -- spec DoD rows', () => {
  it('manual tick (sec.73): trigger_buff_periodic mints + settles, never advancing lifetime', () => {
    const def = makeDef({
      operations: [
        {
          type: 'trigger_buff_periodic',
          selector: {
            kind: 'target_definition' as const,
            target: 'primary_target' as const,
            definitionId: 'ailment.burn' as BuffDefinitionId,
          },
          periodicId: 'burn.tick',
        },
      ],
    })
    const harness = makeHarness({ defs: [def] })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)
    const inst = seedBuff(harness, {
      definitionId: 'ailment.burn' as BuffDefinitionId,
      targetId: ENEMY_A,
      sourceId: PLAYER,
      kind: 'ailment',
      stacks: 3,
      hasPeriodic: true,
      dispellable: true,
      remainingTurns: 5,
    })

    const plan = harness.resolver.resolve(makeInput(def))
    harness.executor.execute(plan, makeInput(def))

    const op = harness.state.executedOps.find((o) => o.type === 'trigger_buff_periodic')
    if (op === undefined || op.type !== 'trigger_buff_periodic') {
      throw new Error('expected a settled trigger_buff_periodic op')
    }
    expect(op.payload.selector).toEqual({
      kind: 'target_definition',
      targetId: ENEMY_A,
      definitionId: 'ailment.burn',
    })
    expect(op.payload.periodicId).toBe('burn.tick')
    // dispatched through the buff authority -- a settled series-start
    // result exists on the trace.
    const rec = harness.scheduler.trace.records.find((r) => r.operation === op)
    expect(rec?.result.type).toBe('trigger_buff_periodic')
    // the manual tick fired the periodic -- the instance's remaining
    // lifetime was never advanced (sec.73 "no lifetime advance").
    expect(inst.remainingTurns).toBe(5)
  })

  it('landed survives a downstream settlement-time reaction consume (sec.41/65)', () => {
    // the ONLY landed evidence is the applied ailment -- a reaction
    // consuming it inside the same barrier must NOT un-land the cast:
    // landed reflects ops RESOLVED, not post-settlement state.
    const def = makeDef({
      operations: [
        { type: 'apply_buff', target: 'primary_target', definitionId: 'ailment.burn' },
        { type: 'deal_damage', target: 'primary_target', coefficient: 1 },
      ],
    })
    const harness = makeHarness({
      defs: [def],
      damageScript: [{ landed: false }], // the damage op whiffs
      onBuffApplied: (inst: FakeBuff) => {
        harness.state.buffs.splice(harness.state.buffs.indexOf(inst), 1)
      },
    })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)

    const plan = harness.resolver.resolve(makeInput(def))
    const outcome = harness.executor.execute(plan, makeInput(def))

    expect(harness.state.buffs).toHaveLength(0) // reaction consumed it mid-plan
    expect(outcome.landed).toBe(true)
  })
})
