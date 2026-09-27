import { describe, expect, it } from 'vitest'

import { SkillResolverError } from './SkillResolver'

import {
  ENEMY_A,
  PLAYER,
  makeDef,
  makeHarness,
  makeInput,
  spawn,
} from './SkillExecutor.testkit'

// Pin (INT-L): a `target_hit_landed` gate on an intent no deal_damage op
// can mint throws SkillResolverError at RESOLVE -- the resolver stays
// fail-loud on the unexpressible shape; TurnSkillPlanRuntime routeCast /
// routeExtraCast converts it into the loud-decline lane (null ->
// reportUnroutedCast -> castBlocked) so the turn tick never crashes.
describe('SkillResolver -- target_hit_landed on unmintable intents throws at resolve', () => {
  it("'self' on an enemy-scope def: the bound target never minted hit ops", () => {
    const def = makeDef({
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
    const harness = makeHarness({ defs: [def] })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)

    expect(() => harness.resolver.resolve(makeInput(def))).toThrow(SkillResolverError)
  })

  it("'other_enemy' gate evaluated before that target minted hit ops throws identically", () => {
    const def = makeDef({
      operations: [
        {
          type: 'deal_damage',
          target: 'primary_target',
          coefficient: 1,
          onLanded: [
            {
              type: 'if',
              condition: { kind: 'target_hit_landed', target: 'other_enemy' },
              then: [{ type: 'heal', target: 'self', amount: 1 }],
            },
          ],
        },
      ],
    })
    const harness = makeHarness({ defs: [def] })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)

    expect(() => harness.resolver.resolve(makeInput(def))).toThrow(SkillResolverError)
  })
})
