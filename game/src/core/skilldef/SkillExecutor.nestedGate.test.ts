import { describe, expect, it } from 'vitest'

import type { ResolvedLandedGate } from './ResolvedSkillPlan'
import type { ResolvedSkillPlan } from './ResolvedSkillPlan'

import {
  ENEMY_A,
  ENEMY_B,
  PLAYER,
  makeDef,
  makeHarness,
  makeInput,
  spawn,
} from './SkillExecutor.testkit'

// Pin (INT-E F-PTR-66): an authored `if target_hit_landed` nested under an
// onLanded consequence resolves to TWO branches gated on the SAME hit ops
// (the minted per-hit gate + the authored gate). Before the fix both fired
// the orchestration hooks -> runLandedHitProcs + resolveTakenWindow ran
// twice per landed hit (double proc rolls, double The-cost payments).
describe('SkillExecutor -- nested landed gates fire hooks once per landed hit', () => {
  it('water-rider shape: outer per-hit gate + inner authored gate -> entered/exited fire once', () => {
    const entered: string[] = []
    const exited: string[] = []
    const def = makeDef({
      operations: [
        {
          type: 'deal_damage',
          target: 'primary_target',
          coefficient: 1,
          onLanded: [
            {
              type: 'if',
              condition: { kind: 'target_hit_landed', target: 'loop_target' },
              then: [{ type: 'heal', target: 'self', amount: 1 }],
            },
          ],
        },
      ],
    })
    const harness = makeHarness({
      defs: [def],
      damageScript: [{ landed: true }],
      hooks: {
        onLandedGateEntered: (gate: ResolvedLandedGate, _plan: ResolvedSkillPlan) => {
          entered.push(`${gate.targetId}|${gate.hitOperationIds.join(',')}`)
        },
        onLandedGateExited: (gate: ResolvedLandedGate, _plan: ResolvedSkillPlan) => {
          exited.push(`${gate.targetId}|${gate.hitOperationIds.join(',')}`)
        },
      },
    })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)

    const plan = harness.resolver.resolve(makeInput(def))
    harness.executor.execute(plan, makeInput(def))

    expect(entered).toHaveLength(1)
    expect(exited).toHaveLength(1)
    // the landed consequence still ran -- heal op landed.
    expect(harness.state.executedOps.map((o) => o.type)).toContain('heal')
  })

  it('two landed targets on one cast fire one gate pair per target', () => {
    const entered: string[] = []
    const def = makeDef({
      operations: [
        {
          type: 'deal_damage',
          target: 'all_enemies',
          coefficient: 1,
          onLanded: [
            {
              type: 'if',
              condition: { kind: 'target_hit_landed', target: 'loop_target' },
              then: [{ type: 'heal', target: 'self', amount: 1 }],
            },
          ],
        },
      ],
    })
    const harness = makeHarness({
      defs: [def],
      damageScript: [{ landed: true }, { landed: true }],
      hooks: {
        onLandedGateEntered: (gate: ResolvedLandedGate) => {
          entered.push(`${gate.targetId}|${gate.hitOperationIds.join(',')}`)
        },
      },
    })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)
    spawn(harness, ENEMY_B)

    const plan = harness.resolver.resolve(
      makeInput(def, { declaredTargetIds: [ENEMY_A, ENEMY_B] }),
    )
    harness.executor.execute(
      plan,
      makeInput(def, { declaredTargetIds: [ENEMY_A, ENEMY_B] }),
    )

    expect(entered).toHaveLength(2)
    expect(new Set(entered).size).toBe(2)
  })

  // Pin (INT-F F2 / COR-F F-3): inside a multi-instance hit's onLanded,
  // the authored `if target_hit_landed` must bind THIS instance's hit
  // ops only -- the accumulated [h1..hN] key never matches the enclosing
  // consequence gate's [hi], so hooks re-fire per instance (double
  // procs, double counter-window rolls).
  it('multi-instance hit: authored if inside onLanded binds its own instance ops -> one gate pair per instance', () => {
    const entered: string[] = []
    const def = makeDef({
      instances: { count: 2 },
      operations: [
        {
          type: 'deal_damage',
          target: 'primary_target',
          coefficient: 1,
          onLanded: [
            {
              type: 'if',
              condition: { kind: 'target_hit_landed', target: 'loop_target' },
              then: [{ type: 'heal', target: 'self', amount: 1 }],
            },
          ],
        },
      ],
    })
    const harness = makeHarness({
      defs: [def],
      damageScript: [{ landed: true }, { landed: true }],
      hooks: {
        onLandedGateEntered: (gate: ResolvedLandedGate) => {
          entered.push(`${gate.targetId}|${gate.hitOperationIds.join(',')}`)
        },
      },
    })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)

    const plan = harness.resolver.resolve(makeInput(def))
    harness.executor.execute(plan, makeInput(def))

    // Two instances => two consequence gates, each entered exactly once.
    expect(entered).toHaveLength(2)
    // The inner authored gate key matches its enclosing consequence
    // gate (both bind the same single-instance op set) -- dedup fired.
    expect(entered[0]).not.toBe(entered[1])
    expect(harness.state.executedOps.filter((o) => o.type === 'heal')).toHaveLength(2)
  })
})
