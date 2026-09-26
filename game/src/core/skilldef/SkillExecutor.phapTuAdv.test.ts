import { describe, expect, it } from 'vitest'

import type { CombatEntityId } from '../battle/contracts/ids'

import {
  ENEMY_A,
  ENEMY_B,
  PLAYER,
  makeDef,
  makeHarness,
  makeInput,
  setResource,
  spawn,
} from './SkillExecutor.testkit'

// Adversarial round-B reviewer scenario (QA write boundary: test-only).
// Attacks the cleanA seams at EXECUTION level (the pins in
// SkillResolver.test.ts cover plan shape; these drive resolved plans
// through the executor with scripted hit outcomes):
//   - oncePerCast dedup under PARTIAL AoE whiff (first lane dodges,
//     second lands -> the flagged secondary must still fire exactly once)
//   - follow-up executions (subcastIndex > 0) minting The grants
//   - the live 30%-of-max cost gate at exactly-below / exactly-at

const EMPOWERED_AOE = makeDef({
  id: 'skill.empowered_water' as never,
  operations: [
    {
      type: 'deal_damage',
      target: 'all_enemies',
      coefficient: 2,
      onLanded: [
        {
          type: 'if',
          condition: { kind: 'target_hit_landed', target: 'loop_target' },
          then: [
            {
              type: 'deal_damage',
              target: 'other_enemy',
              oncePerCast: true,
              coefficient: 1,
            },
          ],
        },
      ],
    },
  ],
})

const GRANT_DEF = makeDef({
  id: 'skill.grant' as never,
  grants: { theOnLandedCast: 1 },
  operations: [{ type: 'deal_damage', target: 'primary_target', coefficient: 1 }],
})

const COST_DEF = makeDef({
  id: 'skill.trang' as never,
  targetIntent: 'self',
  cost: { resourceType: 'mana', percentOfMax: 0.3 },
  operations: [{ type: 'apply_buff', target: 'self', definitionId: 'buff.mark' as never }],
})

const dealDamageOps = (ops: readonly { type: string }[]) =>
  ops.filter((o) => o.type === 'deal_damage')

describe('SkillExecutor - phap-tu adversarial seams (clean round B)', () => {
  it('oncePerCast: first lane dodges, second lands -> secondary fires once on the OTHER enemy', () => {
    const harness = makeHarness({
      defs: [EMPOWERED_AOE],
      damageScript: [{ landed: false }, { landed: true }],
    })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)
    spawn(harness, ENEMY_B)

    const input = makeInput(EMPOWERED_AOE, { declaredTargetIds: [ENEMY_A] })
    harness.executor.execute(harness.resolver.resolve(input), input)

    const hits = dealDamageOps(harness.state.executedOps)
    // 2 primaries (A dodge, B land) + exactly 1 secondary minted on
    // B's landed lane, aimed at A (first living enemy != loop target).
    expect(hits).toHaveLength(3)
    expect((hits[2]!.payload as { targetId: CombatEntityId }).targetId).toBe(ENEMY_A)
  })

  it('oncePerCast: both primaries land -> still exactly one secondary', () => {
    const harness = makeHarness({
      defs: [EMPOWERED_AOE],
      damageScript: [{ landed: true }, { landed: true }],
    })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)
    spawn(harness, ENEMY_B)

    const input = makeInput(EMPOWERED_AOE, { declaredTargetIds: [ENEMY_A] })
    harness.executor.execute(harness.resolver.resolve(input), input)

    const hits = dealDamageOps(harness.state.executedOps)
    expect(hits).toHaveLength(3)
    expect((hits[2]!.payload as { targetId: CombatEntityId }).targetId).toBe(ENEMY_B)
  })

  it('oncePerCast: every primary whiffs -> zero secondary hits', () => {
    const harness = makeHarness({
      defs: [EMPOWERED_AOE],
      damageScript: [{ landed: false }, { landed: false }],
    })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)
    spawn(harness, ENEMY_B)

    const input = makeInput(EMPOWERED_AOE, { declaredTargetIds: [ENEMY_A] })
    harness.executor.execute(harness.resolver.resolve(input), input)

    expect(dealDamageOps(harness.state.executedOps)).toHaveLength(2)
  })

  it('theGainOnLandedCast: root plan mints +1 The on a landed hit', () => {
    const harness = makeHarness({ defs: [GRANT_DEF] })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)

    const input = makeInput(GRANT_DEF)
    harness.executor.execute(harness.resolver.resolve(input), input)

    const grants = harness.state.executedOps.filter(
      (o) =>
        o.type === 'gain_resource' &&
        (o.payload as { resourceId?: string }).resourceId === 'the',
    )
    expect(grants).toHaveLength(1)
  })

  it('theGainOnLandedCast: a LANDED repeat follow-up (subcastIndex 1) mints NOTHING', () => {
    const harness = makeHarness({ defs: [GRANT_DEF] })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)

    // A follow-up execution of the same def: commitsCast=false,
    // subcastIndex=1 -- emitGrants must suppress even though it lands.
    const input = makeInput(GRANT_DEF, { subcastIndex: 1 })
    harness.executor.execute(harness.resolver.resolve(input), input)

    const grants = harness.state.executedOps.filter(
      (o) => o.type === 'gain_resource',
    )
    expect(grants).toHaveLength(0)
    expect(harness.state.commits).toHaveLength(0)
  })

  it('theGainOnLandedCast: whiffed root mints nothing', () => {
    const harness = makeHarness({
      defs: [GRANT_DEF],
      damageScript: [{ landed: false }],
    })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)

    const input = makeInput(GRANT_DEF)
    harness.executor.execute(harness.resolver.resolve(input), input)

    expect(
      harness.state.executedOps.filter((o) => o.type === 'gain_resource'),
    ).toHaveLength(0)
  })

  it('30% MaxLL cost: exactly-below-threshold blocks the cast (no commit, no ops)', () => {
    const harness = makeHarness({ defs: [COST_DEF] })
    spawn(harness, PLAYER)
    // maxMp snapshot 100 -> frozen cost 30; live mana 29 -> PRECHECK blocks.
    setResource(harness, PLAYER, 'mana', 29)

    const input = makeInput(COST_DEF, {
      sourceStats: { scalar: (_id: CombatEntityId, key: string) => (key === 'maxMp' ? 100 : 0) },
    })
    const outcome = harness.executor.execute(harness.resolver.resolve(input), input)

    expect(outcome.blocked).toBe(true)
    expect(harness.state.commits).toHaveLength(0)
    expect(harness.state.executedOps).toHaveLength(0)
  })

  it('30% MaxLL cost: exactly-at-threshold commits and debits the frozen amount', () => {
    const harness = makeHarness({ defs: [COST_DEF] })
    spawn(harness, PLAYER)
    setResource(harness, PLAYER, 'mana', 30)

    const input = makeInput(COST_DEF, {
      sourceStats: { scalar: (_id: CombatEntityId, key: string) => (key === 'maxMp' ? 100 : 0) },
    })
    const outcome = harness.executor.execute(harness.resolver.resolve(input), input)

    expect(outcome.blocked).not.toBe(true)
    expect(harness.state.commits).toHaveLength(1)
    expect(
      harness.state.resources.get(`${PLAYER}|mana`),
    ).toBe(0)
  })
})
