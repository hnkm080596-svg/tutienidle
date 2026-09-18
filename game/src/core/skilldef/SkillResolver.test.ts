import { describe, expect, it } from 'vitest'

import type { CombatEntityId, SkillId } from '../battle/contracts/ids'
import type { CombatRng } from '../battle/contracts/rng'
import type { ResolvedCombatOperation } from '../battle/contracts/operations'
import { SeededCombatRng } from '../battle/runtime/rng/SeededCombatRng'

import type { ActiveSkillDefinition } from './SkillDefinition'
import { SkillDefinitionRegistry } from './SkillDefinitionRegistry'
import { SkillResolver, SkillResolverError } from './SkillResolver'
import type {
  ResolvedSkillPlan,
  ResolvedSkillPlanStep,
} from './ResolvedSkillPlan'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PLAYER = 'entity.player' as CombatEntityId
const ENEMY_A = 'entity.enemy.a' as CombatEntityId
const ENEMY_B = 'entity.enemy.b' as CombatEntityId
const ALLY = 'entity.ally' as CombatEntityId

/** deterministic sequence rng -- each roll() consumes the next value. */
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

function entityQuery(overrides: Partial<Parameters<typeof baseQuery>[0]> = {}) {
  return baseQuery(overrides)
}

function baseQuery(
  overrides: Partial<{
    the: number
    mp: number
    enemies: readonly CombatEntityId[]
    allies: readonly CombatEntityId[]
  }> = {},
) {
  const the = overrides.the ?? 0
  const enemies = overrides.enemies ?? [ENEMY_A, ENEMY_B]
  const allies = overrides.allies ?? [PLAYER, ALLY]
  return {
    currentThe: () => the,
    currentMp: () => overrides.mp ?? 50,
    alive: () => true,
    enemiesOf: () => enemies,
    alliesOf: () => allies,
  }
}

function statPort(scalars: Record<string, number> = {}) {
  return { scalar: (_id: CombatEntityId, key: string) => scalars[key] ?? 0 }
}

function activeDef(overrides: Partial<ActiveSkillDefinition> = {}): ActiveSkillDefinition {
  return {
    kind: 'active',
    id: 'skill.test' as SkillId,
    name: 'Test Skill',
    targetIntent: 'primary_target',
    cadence: { cooldownTurns: 2 },
    operations: [{ type: 'deal_damage', target: 'primary_target', coefficient: 2 }],
    ...overrides,
  }
}

const progression = { skillId: 'skill.test' as SkillId, level: 3, experience: 0, totalExperience: 10, unlocked: true, equipped: true, loadoutSlots: [0] }

function resolve(
  defs: readonly ActiveSkillDefinition[],
  defIndex = 0,
  overrides: Partial<Parameters<SkillResolver['resolve']>[0]> = {},
  rolls: readonly number[] = [],
) {
  const registry = new SkillDefinitionRegistry(defs, {
    isBuffDefinitionId: () => true,
  })
  const resolver = new SkillResolver(registry, seqRng(rolls))
  const plan = resolver.resolve({
    definition: defs[defIndex]!,
    sourceId: PLAYER,
    declaredTargetIds: [ENEMY_A],
    progression,
    sourceStats: statPort(),
    entityQuery: entityQuery(),
    castId: 'cast.1',
    rootActionId: 'action.turn.1.0',
    subcastIndex: 0,
    ...overrides,
  })
  return plan
}

function operationSteps(plan: ResolvedSkillPlan) {
  const out: Extract<ResolvedSkillPlanStep, { kind: 'operation' }>[] = []
  const walk = (steps: readonly ResolvedSkillPlanStep[]): void => {
    for (const step of steps) {
      if (step.kind === 'operation') out.push(step)
      if (step.kind === 'branch') {
        walk(step.then)
        if (step.else !== undefined) walk(step.else)
      }
    }
  }
  walk(plan.steps)
  return out
}

function collectOperations(steps: readonly ResolvedSkillPlanStep[]): ResolvedCombatOperation[] {
  const ops: ResolvedCombatOperation[] = []
  for (const step of steps) {
    if (step.kind === 'operation') ops.push(step.operation)
    if (step.kind === 'branch') {
      ops.push(...collectOperations(step.then))
      if (step.else !== undefined) ops.push(...collectOperations(step.else))
    }
  }
  return ops
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SkillResolver -- basic op translation', () => {
  it('emits a deal_damage op with contract-v1.6 origin metadata + skill_hit profile', () => {
    const plan = resolve([activeDef()])
    const ops = operationSteps(plan)
    expect(ops).toHaveLength(1)
    const op = ops[0]!.operation
    expect(op.type).toBe('deal_damage')
    expect(op.origin).toMatchObject({
      kind: 'skill',
      originId: 'skill.test',
      sourceId: PLAYER,
      rootActionId: 'action.turn.1.0',
      castId: 'cast.1',
      subcastIndex: 0,
    })
    if (op.type !== 'deal_damage') throw new Error('unreachable')
    expect(op.payload.damageProfile).toBe('skill_hit')
    expect(op.payload.targetId).toBe(ENEMY_A)
    expect(op.payload.coefficient).toBe(2)
    expect(op.payload.hitCount).toBe(1)
    expect(op.payload.canCrit).toBe(true)
    expect(op.payload.canMiss).toBe(true)
    expect(op.operationId).toBe('op.cast.1.0.0')
    expect(plan.snapshot.statScalars.realmIndex).toBeDefined()
  })

  it('resolves affected_targets to every declared target', () => {
    const plan = resolve(
      [activeDef({ operations: [{ type: 'heal', target: 'affected_targets', amount: 5 }] })],
      0,
      { declaredTargetIds: [ENEMY_A, ENEMY_B] },
    )
    const ops = operationSteps(plan)
    expect(ops.map((o) => o.operation.payload)).toEqual([
      { targetId: ENEMY_A, amount: 5 },
      { targetId: ENEMY_B, amount: 5 },
    ])
  })

  it('resolves all_enemies via entityQuery roster order and allies_except_self minus source', () => {
    const plan = resolve(
      [
        activeDef({
          operations: [
            { type: 'deal_damage', target: 'all_enemies', coefficient: 1 },
            { type: 'apply_shield', target: 'allies_except_self', amount: 3 },
          ],
        }),
      ],
      0,
      { entityQuery: entityQuery({ enemies: [ENEMY_B, ENEMY_A], allies: [PLAYER, ALLY] }) },
    )
    const ops = operationSteps(plan)
    const damage = ops.filter((o) => o.operation.type === 'deal_damage')
    expect(damage.map((o) => (o.operation as { payload: { targetId: string } }).payload.targetId))
      .toEqual([ENEMY_B, ENEMY_A])
    const shields = ops.filter((o) => o.operation.type === 'apply_shield')
    expect(shields).toHaveLength(1)
    expect((shields[0]!.operation as { payload: { targetId: string } }).payload.targetId).toBe(ALLY)
  })

  it('unrolls for_each_target binding loop_target into ops AND conditions', () => {
    const plan = resolve(
      [
        activeDef({
          operations: [
            {
              type: 'for_each_target',
              target: 'affected_targets',
              ops: [
                {
                  type: 'if',
                  condition: {
                    kind: 'target_alive',
                    target: 'loop_target',
                  },
                  then: [
                    {
                      type: 'apply_buff',
                      target: 'loop_target',
                      definitionId: 'debuff.mark',
                    },
                  ],
                },
              ],
            },
          ],
        }),
      ],
      0,
      { declaredTargetIds: [ENEMY_A, ENEMY_B] },
    )
    expect(plan.steps).toHaveLength(2)
    const [branchA, branchB] = plan.steps
    if (
      branchA === undefined ||
      branchB === undefined ||
      branchA.kind !== 'branch' ||
      branchB.kind !== 'branch'
    ) {
      throw new Error('expected branch steps')
    }
    expect(branchA.condition).toEqual({ kind: 'target_alive', targetId: ENEMY_A })
    expect(branchB.condition).toEqual({ kind: 'target_alive', targetId: ENEMY_B })
    const applyA = (branchA.then[0] as Extract<ResolvedSkillPlanStep, { kind: 'operation' }>)
      .operation
    expect((applyA as { payload: { targetId: string } }).payload.targetId).toBe(ENEMY_A)
    // no authored intent survives in the resolved plan
    const serialized = JSON.stringify(plan.steps)
    expect(serialized).not.toContain('loop_target')
    expect(serialized).not.toContain('affected_targets')
  })
})

describe('SkillResolver -- variants + composite', () => {
  it('swaps to the empowered def at/above threshold and captures the The burn', () => {
    const base = activeDef({
      id: 'skill.ult' as SkillId,
      variants: {
        empowerment: {
          theThreshold: 100,
          empoweredSkillId: 'skill.ult.empowered' as SkillId,
        },
      },
    })
    const empowered = activeDef({
      id: 'skill.ult.empowered' as SkillId,
      consumesAllThe: true,
      operations: [{ type: 'deal_damage', target: 'primary_target', coefficient: 9 }],
    })
    const plan = resolve([base, empowered], 0, {
      entityQuery: entityQuery({ the: 120 }),
    })
    expect(plan.resolvedVariantId).toBe('skill.ult.empowered')
    expect(plan.snapshot.resourcesConsumed.the).toBe(120)
    expect(plan.snapshot.compositePicks).toBeUndefined()
    const op = operationSteps(plan)[0]!.operation
    expect(op.origin.originId).toBe('skill.ult.empowered')
    if (op.type !== 'deal_damage') throw new Error('unreachable')
    expect(op.payload.coefficient).toBe(9)
  })

  it('does NOT swap below threshold and leaves resourcesConsumed empty', () => {
    const base = activeDef({
      variants: {
        empowerment: {
          theThreshold: 100,
          empoweredSkillId: 'skill.empowered' as SkillId,
        },
      },
    })
    const empowered = activeDef({ id: 'skill.empowered' as SkillId, consumesAllThe: true })
    const plan = resolve([base, empowered], 0, {
      entityQuery: entityQuery({ the: 99 }),
    })
    expect(plan.resolvedVariantId).toBeUndefined()
    expect(plan.snapshot.resourcesConsumed).toEqual({})
    expect(operationSteps(plan)[0]!.operation.origin.originId).toBe('skill.test')
  })

  it('rolls composite picks once with one rng consumption per pick and resolves picks[0]', () => {
    const shell = activeDef({
      id: 'skill.element_basic' as SkillId,
      operations: [],
      subcasts: {
        compositePool: ['skill.fire' as SkillId, 'skill.metal' as SkillId, 'skill.wood' as SkillId],
        compositeCount: 2,
      },
    })
    const fire = activeDef({
      id: 'skill.fire' as SkillId,
      operations: [{ type: 'deal_damage', target: 'primary_target', coefficient: 7 }],
    })
    const metal = activeDef({ id: 'skill.metal' as SkillId })
    const wood = activeDef({ id: 'skill.wood' as SkillId })

    const registry = new SkillDefinitionRegistry([shell, fire, metal, wood], {
      isBuffDefinitionId: () => true,
    })
    const rng = seqRng([0.0, 0.99])
    const resolver = new SkillResolver(registry, rng)
    const plan = resolver.resolve({
      definition: shell,
      sourceId: PLAYER,
      declaredTargetIds: [ENEMY_A],
      progression,
      sourceStats: statPort(),
      entityQuery: entityQuery(),
      castId: 'cast.2',
      rootActionId: 'action.turn.1.0',
      subcastIndex: 0,
    })

    // roll 0.0 -> index 0 -> 'skill.fire'; roll 0.99 -> last of remaining -> 'skill.wood'
    expect(plan.snapshot.compositePicks).toEqual(['skill.fire', 'skill.wood'])
    expect(plan.compositeExtraIds).toEqual(['skill.wood'])
    expect(rng.consumed).toBe(2)
    const op = operationSteps(plan)[0]!.operation
    expect(op.origin.originId).toBe('skill.fire')
    if (op.type !== 'deal_damage') throw new Error('unreachable')
    expect(op.payload.coefficient).toBe(7)
  })

  it('seeded composite (sec.88): identical seeds produce bit-identical plans', () => {
    const defs = [
      activeDef({
        id: 'skill.element_basic' as SkillId,
        operations: [],
        subcasts: {
          compositePool: [
            'skill.fire' as SkillId,
            'skill.metal' as SkillId,
            'skill.wood' as SkillId,
          ],
          compositeCount: 2,
        },
      }),
      activeDef({ id: 'skill.fire' as SkillId }),
      activeDef({ id: 'skill.metal' as SkillId }),
      activeDef({ id: 'skill.wood' as SkillId }),
    ]
    const resolveSeeded = (seed: number) => {
      const registry = new SkillDefinitionRegistry(defs, {
        isBuffDefinitionId: () => true,
      })
      const resolver = new SkillResolver(registry, new SeededCombatRng(seed))
      return resolver.resolve({
        definition: defs[0]!,
        sourceId: PLAYER,
        declaredTargetIds: [ENEMY_A],
        progression,
        sourceStats: statPort(),
        entityQuery: entityQuery(),
        castId: 'cast.3',
        rootActionId: 'action.turn.1.0',
        subcastIndex: 0,
      })
    }

    const a = resolveSeeded(1337)
    const b = resolveSeeded(1337)
    expect(a.snapshot.compositePicks).toEqual(b.snapshot.compositePicks)
    expect(a.compositeExtraIds).toEqual(b.compositeExtraIds)
    expect(JSON.stringify(a.steps)).toBe(JSON.stringify(b.steps))
    // the pick genuinely rides the rng -- different seeds produce at
    // least two distinct pick sets across a sweep (deterministic:
    // seeds are fixed, never rolled at test time).
    const pickSets = new Set(
      [1, 2, 3, 4, 5].map((seed) =>
        JSON.stringify(resolveSeeded(seed).snapshot.compositePicks),
      ),
    )
    expect(pickSets.size).toBeGreaterThan(1)
  })
})

describe('SkillResolver -- expressions, conditions, plan IR', () => {
  it('folds snapshot-backed expressions and keeps live reads as late bindings', () => {
    const def = activeDef({
      operations: [
        {
          type: 'deal_damage',
          target: 'primary_target',
          coefficient: { op: 'multiply', values: [{ query: 'stat_scalar', key: 'might' }, 2] },
        },
        {
          type: 'deal_damage',
          target: 'primary_target',
          coefficient: {
            op: 'add',
            values: [
              1,
              { query: 'buff_stacks', target: 'primary_target', definitionId: 'ailment.burn' },
            ],
          },
        },
      ],
    })
    const plan = resolve([def], 0, {
      sourceStats: statPort({ might: 10 }),
    })
    expect(plan.snapshot.statScalars.might).toBe(10)
    const [first, second] = operationSteps(plan)
    if (first!.operation.type !== 'deal_damage' || second!.operation.type !== 'deal_damage') {
      throw new Error('unreachable')
    }
    expect(first!.operation.payload.coefficient).toBe(20)
    // live buff_stacks read -> late binding, placeholder 0
    expect(second!.operation.payload.coefficient).toBe(0)
    expect(second!.late).toHaveLength(1)
    expect(second!.late![0]!.field).toBe('coefficient')
  })

  it('emits read + branch plan steps for read_stacks / if ops', () => {
    const def = activeDef({
      operations: [
        { type: 'read_stacks', target: 'primary_target', definitionId: 'ailment.burn', into: 'burn' },
        {
          type: 'if',
          condition: { kind: 'var', name: 'burn', op: 'gte', value: 3 },
          then: [{ type: 'push_gauge', target: 'primary_target', fractionOfMax: 0.5 }],
        },
      ],
    })
    const plan = resolve([def])
    expect(plan.steps[0]).toEqual({
      kind: 'read',
      query: { query: 'buff_stacks', targetId: ENEMY_A, definitionId: 'ailment.burn' },
      into: 'burn',
    })
    const branch = plan.steps[1]!
    if (branch.kind !== 'branch') throw new Error('expected branch')
    expect(branch.condition).toEqual({ kind: 'var', name: 'burn', op: 'gte', value: 3 })
    expect(branch.then).toHaveLength(1)
  })

  it('resolves stacks_at_least / hp_percent_below / target_alive to concrete ids', () => {
    const def = activeDef({
      operations: [
        {
          type: 'if',
          condition: {
            kind: 'hp_percent_below',
            target: 'primary_target',
            threshold: { op: 'add', values: [0.2, { query: 'stat_scalar', key: 'execBonus' }] },
          },
          then: [{ type: 'deal_damage', target: 'primary_target', coefficient: 5 }],
        },
      ],
    })
    const plan = resolve([def], 0, { sourceStats: statPort({ execBonus: 0.1 }) })
    const branch = plan.steps[0]!
    if (branch.kind !== 'branch') throw new Error('expected branch')
    expect(branch.condition).toEqual({
      kind: 'hp_percent_below',
      targetId: ENEMY_A,
      threshold: 0.30000000000000004,
    })
  })

  it('faults when a resolve-time-required field cannot fold (instances.count live read)', () => {
    const def = activeDef({
      instances: {
        count: { query: 'buff_stacks', target: 'self', definitionId: 'buff.swords' },
      },
    })
    expect(() => resolve([def])).toThrow(SkillResolverError)
  })
})

describe('SkillResolver -- instances + consume lanes', () => {
  it('expands instances.count per target and stamps each.* policies', () => {
    const def = activeDef({
      instances: {
        count: { query: 'stat_scalar', key: 'kiemDaoCount' },
        each: {
          guaranteedHit: true,
          critChance: 0.25,
          armorPierce: { bypassChance: 0.3, pierceFraction: 0.5 },
        },
      },
    })
    const plan = resolve([def], 0, { sourceStats: statPort({ kiemDaoCount: 3 }) })
    const ops = operationSteps(plan)
    expect(ops).toHaveLength(3)
    for (const step of ops) {
      if (step.operation.type !== 'deal_damage') throw new Error('unreachable')
      expect(step.operation.payload.hitPolicy).toEqual({ guaranteedHit: true })
      expect(step.operation.payload.critPolicy).toEqual({ bonusChance: 0.25 })
      expect(step.operation.payload.armorPolicy).toEqual({
        bypassChance: 0.3,
        pierceFractionOnFail: 0.5,
      })
    }
  })

  it('compiles each.execute to a branch{hp_percent_below} folding the multiplier', () => {
    const def = activeDef({
      operations: [{ type: 'deal_damage', target: 'primary_target', coefficient: 4 }],
      instances: {
        count: 2,
        each: { execute: { hpPercentBelow: 0.35, damageMultiplier: 2 } },
      },
    })
    const plan = resolve([def])
    // Each instance's lane wraps in nested target_alive(source ->
    // target) branches (T3-22b mid-impact death parity); instance lanes
    // hold [hp_percent_below hit branch, consequence gate].
    expect(plan.steps).toHaveLength(2)
    const alive = plan.steps[0]!
    if (alive.kind !== 'branch') throw new Error('expected target_alive wrapper')
    expect(alive.condition).toEqual({ kind: 'target_alive', targetId: PLAYER })
    const targetAlive = alive.then[0]!
    if (targetAlive.kind !== 'branch') throw new Error('expected target_alive(target) wrapper')
    expect(targetAlive.condition).toEqual({ kind: 'target_alive', targetId: ENEMY_A })
    const branch = targetAlive.then[0]!
    if (branch.kind !== 'branch') throw new Error('expected branch')
    expect(branch.condition).toEqual({
      kind: 'hp_percent_below',
      targetId: ENEMY_A,
      threshold: 0.35,
    })
    const thenOp = (branch.then[0] as Extract<ResolvedSkillPlanStep, { kind: 'operation' }>).operation
    const elseOp = (branch.else![0] as Extract<ResolvedSkillPlanStep, { kind: 'operation' }>).operation
    if (thenOp.type !== 'deal_damage' || elseOp.type !== 'deal_damage') throw new Error('unreachable')
    expect(thenOp.payload.coefficient).toBe(8)
    expect(elseOp.payload.coefficient).toBe(4)
  })

  it('compiles consumeBuff to landed gate + summed-stack read + legacy_flat + per-instance consume', () => {
    const def = activeDef({
      operations: [
        {
          type: 'deal_damage',
          target: 'primary_target',
          coefficient: 1,
          consumeBuff: { definitionId: 'ailment.burn', damagePerStack: 50 },
        },
      ],
    })
    const plan = resolve([def])
    // Per-instance lane inside the target_alive wrapper:
    // [hit] [read landed] [consume gate: read stacks + branch{stacks>0}]
    // [read landed] [stamped consequence gate]
    const alive = plan.steps[0]!
    if (alive.kind !== 'branch') throw new Error('expected target_alive wrapper')
    const targetAlive = alive.then[0]!
    if (targetAlive.kind !== 'branch') throw new Error('expected target_alive(target) wrapper')
    const lane = targetAlive.then
    const landedRead = lane[1]!
    if (landedRead.kind !== 'read') throw new Error('expected read')
    expect(landedRead.query).toEqual({
      query: 'ops_landed_any',
      operationIds: [expect.any(String)],
    })
    const gate = lane[2]!
    if (gate.kind !== 'branch') throw new Error('expected branch')
    expect(gate.condition).toMatchObject({ kind: 'var', op: 'gte', value: 1 })
    const stacksRead = gate.then[0]!
    if (stacksRead.kind !== 'read') throw new Error('expected stacks read')
    expect(stacksRead.query).toMatchObject({
      query: 'buff_stacks',
      targetId: ENEMY_A,
      definitionId: 'ailment.burn',
      sourceId: PLAYER,
    })
    const stacksGate = gate.then[1]!
    if (stacksGate.kind !== 'branch') throw new Error('expected stacks>0 branch')
    const flat = stacksGate.then[0] as Extract<ResolvedSkillPlanStep, { kind: 'operation' }>
    if (flat.operation.type !== 'deal_damage') throw new Error('unreachable')
    expect(flat.operation.payload.damageProfile).toBe('legacy_flat')
    expect(flat.operation.payload.canCrit).toBe(false)
    expect(flat.operation.payload.canMiss).toBe(false)
    expect(flat.late![0]!.field).toBe('coefficient')
    const forEach = stacksGate.then[1]!
    if (forEach.kind !== 'for_each_instance') throw new Error('expected for_each_instance')
    expect(forEach.filter).toEqual({ targetId: ENEMY_A, definitionId: 'ailment.burn' })
    expect(forEach.operation.type).toBe('consume_buff_stacks')
    if (forEach.operation.type !== 'consume_buff_stacks') throw new Error('unreachable')
    expect(forEach.operation.payload.stacks).toBe('all')
    expect(forEach.operation.payload.removalReason).toBe('consumed')
    // The stamped consequence gate trails the consume lane per hit.
    const consequence = lane[4]!
    if (consequence.kind !== 'branch') throw new Error('expected consequence gate')
    expect(consequence.gate).toEqual({
      hitOperationIds: [expect.any(String)],
      targetId: ENEMY_A,
    })
  })

  it('compiles consumeWard to read ward -> legacy_flat -> consume_resource all', () => {
    const def = activeDef({
      operations: [
        {
          type: 'deal_damage',
          target: 'primary_target',
          coefficient: 1,
          consumeWard: { damagePerWardPoint: 2 },
        },
      ],
    })
    const plan = resolve([def])
    const alive = plan.steps[0]!
    if (alive.kind !== 'branch') throw new Error('expected target_alive wrapper')
    const targetAlive = alive.then[0]!
    if (targetAlive.kind !== 'branch') throw new Error('expected target_alive(target) wrapper')
    const gate = targetAlive.then[2]!
    if (gate.kind !== 'branch') throw new Error('expected landed gate')
    const wardRead = gate.then[0]!
    if (wardRead.kind !== 'read') throw new Error('expected ward read')
    expect(wardRead.query).toEqual({
      query: 'resource_current',
      targetId: PLAYER,
      resourceId: 'ward',
    })
    const wardGate = gate.then[1]!
    if (wardGate.kind !== 'branch') throw new Error('expected ward>0 branch')
    const ops = collectOperations(wardGate.then)
    expect(ops.map((o) => o.type)).toEqual(['deal_damage', 'consume_resource'])
    const spend = ops[1]!
    if (spend.type !== 'consume_resource') throw new Error('unreachable')
    expect(spend.payload).toMatchObject({
      targetId: PLAYER,
      resourceId: 'ward',
      amount: 'all',
    })
  })
})

describe('SkillResolver -- structural guards + determinism', () => {
  it('throws on a passive definition', () => {
    const passive = {
      kind: 'passive' as const,
      id: 'passive.x' as SkillId,
      name: 'P',
      triggers: [{ event: 'skill_landed' as const }],
      operations: [{ type: 'apply_buff' as const, target: 'self' as const, definitionId: 'b.x' }],
    }
    const registry = new SkillDefinitionRegistry([passive], { isBuffDefinitionId: () => true })
    const resolver = new SkillResolver(registry, seqRng([]))
    expect(() =>
      resolver.resolve({
        // @ts-expect-error -- deliberately wrong kind for the guard test
        definition: passive,
        sourceId: PLAYER,
        declaredTargetIds: [ENEMY_A],
        progression,
        sourceStats: statPort(),
        entityQuery: entityQuery(),
        castId: 'c',
        rootActionId: 'r',
        subcastIndex: 0,
      }),
    ).toThrow(SkillResolverError)
  })

  it('throws when gain_resource authors amount all', () => {
    const def = activeDef({
      operations: [
        { type: 'gain_resource', target: 'self', resourceId: 'mp', amount: 'all' },
      ],
    })
    expect(() => resolve([def])).toThrow(SkillResolverError)
  })

  it('is deterministic: identical inputs produce identical plans', () => {
    const def = activeDef({
      operations: [
        { type: 'read_stacks', target: 'primary_target', definitionId: 'a.b', into: 'x' },
        { type: 'deal_damage', target: 'affected_targets', coefficient: 1 },
        { type: 'cleanse', target: 'primary_target', query: { polarity: 'debuff' }, limit: 2 },
      ],
    })
    const mk = () => resolve([def], 0, { declaredTargetIds: [ENEMY_A, ENEMY_B] })
    expect(mk()).toEqual(mk())
  })

  it('stamps cleanse query + limit verbatim onto cleanse_buff ops', () => {
    const def = activeDef({
      operations: [
        { type: 'cleanse', target: 'self', query: { polarity: 'debuff', tags: ['poison'] }, limit: 1 },
      ],
    })
    const plan = resolve([def])
    const op = operationSteps(plan)[0]!.operation
    if (op.type !== 'cleanse_buff') throw new Error('unreachable')
    expect(op.payload).toEqual({
      targetId: PLAYER,
      query: { polarity: 'debuff', tags: ['poison'] },
      limit: 1,
    })
  })

  it('captures scaling attribute + manaScaling stat scalars into the snapshot', () => {
    const def = activeDef({
      operations: [
        {
          type: 'deal_damage',
          target: 'primary_target',
          coefficient: 1,
          scaling: {
            attributeScaling: [{ attributes: ['might', 'dexterity'], ratioPerPoint: 0.1 }],
            manaScalingRatio: 0.5,
          },
        },
      ],
    })
    const plan = resolve([def], 0, {
      sourceStats: statPort({ might: 11, dexterity: 7, maxMp: 200 }),
    })
    expect(plan.snapshot.statScalars).toMatchObject({
      might: 11,
      dexterity: 7,
      maxMp: 200,
      skill_level: 3,
    })
    const op = operationSteps(plan)[0]!.operation
    if (op.type !== 'deal_damage') throw new Error('unreachable')
    expect(op.payload.scaling).toEqual(def.operations[0]!.type === 'deal_damage' ? def.operations[0]!.scaling : undefined)
    expect(op.payload.snapshot).toEqual(plan.snapshot.statScalars)
  })
})
