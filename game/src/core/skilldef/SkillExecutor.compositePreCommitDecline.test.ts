import { describe, expect, it } from 'vitest'

import { SkillResolverError } from './SkillResolver'

import {
  ENEMY_A,
  PLAYER,
  makeDef,
  makeHarness,
  makeInput,
  setResource,
  spawn,
} from './SkillExecutor.testkit'

// Pin (INT-M Medium): composite extras RESOLVE before the commit. Before
// the hoist, executePlan committed cooldown/cast count and consumed the
// cost FIRST, then resolved extras inline -- a SkillResolverError inside
// an extra propagated to routeCast's null decline while the commit +
// cost + already-run extras stayed applied: a partial mutation stamped
// castBlocked as if nothing happened. Pre-commit resolution makes the
// decline honest -- the tick sees a clean no-op.
describe('SkillExecutor -- composite extra decline happens pre-commit', () => {
  it('an unexpressible composite member throws BEFORE commit + cost consume', () => {
    // Unexpressible member shape (INT-L pin): a target_hit_landed gate
    // on an intent no deal_damage op of this def can mint.
    const broken = makeDef({
      id: 'skill.extra.broken',
      operations: [
        {
          type: 'deal_damage',
          target: 'primary_target',
          coefficient: 1,
          onLanded: [
            {
              type: 'if',
              condition: { kind: 'target_hit_landed', target: 'self' },
              then: [{ type: 'heal', target: 'self', amount: 1 }],
            },
          ],
        },
      ],
    })
    const good = makeDef({ id: 'skill.extra.good' })
    const root = makeDef({
      id: 'skill.composite.root',
      cost: { resourceType: 'mana', amount: 5 },
      operations: [],
      subcasts: {
        // default harness rng roll()=0.5 -> index 1 first: picks
        // [good, broken], so 'broken' lands in compositeExtraIds and
        // resolves inside executePlan (not at root resolve).
        compositePool: ['skill.extra.broken', 'skill.extra.good'],
        compositeCount: 2,
      },
    })
    const harness = makeHarness({ defs: [root, good, broken] })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)
    setResource(harness, PLAYER, 'mana', 50)

    const plan = harness.resolver.resolve(makeInput(root))
    expect(() => harness.executor.execute(plan, makeInput(root))).toThrow(
      SkillResolverError,
    )

    // Decline landed pre-commit: no cooldown commit, no cost consume op.
    expect(harness.state.commits).toEqual([])
    expect(harness.state.executedOps.map((o) => o.type)).not.toContain(
      'consume_resource',
    )
    expect(harness.state.resources.get(`${PLAYER}|mana`)).toBe(50)
  })
})
