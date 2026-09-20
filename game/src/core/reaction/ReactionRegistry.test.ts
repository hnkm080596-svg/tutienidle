// ReactionRegistry.test.ts -- megaplan M1 step 1: startup validation
// throws on every listed malformation; canonical coverage enforced.

import { describe, expect, it } from 'vitest'
import type { BuffDefinitionId } from '../battle/contracts/ids'
import type { ReactionDefinition } from './ReactionDefinition'
import { ReactionRegistry, validateReactionDefinitions } from './ReactionRegistry'
import {
  createReactionTestWorld,
  fixtureDamageProfileExists,
  makeCanonicalReactionDefs,
  TEST_ELEMENT_BUFF_IDS,
} from './testing/ReactionTestFixtures'

function setup() {
  const w = createReactionTestWorld()
  const buffExists = (id: string) =>
    w.registry.all().some((d) => d.id === id)
  return { w, buffExists }
}

describe('ReactionRegistry validation', () => {
  it('accepts the canonical 10-def catalog', () => {
    const { w, buffExists } = setup()
    const registry = new ReactionRegistry(
      makeCanonicalReactionDefs(),
      w.elements,
      buffExists,
      fixtureDamageProfileExists,
    )
    expect(registry.all()).toHaveLength(10)
    expect(registry.get('duong_viem').elements.parent).toBe('wood')
  })

  it('throws on duplicate ReactionId', () => {
    const { w, buffExists } = setup()
    const defs = makeCanonicalReactionDefs()
    defs.push({ ...defs[0]! })
    expect(() =>
      validateReactionDefinitions(defs, w.elements, buffExists, fixtureDamageProfileExists),
    ).toThrow(/duplicate reaction id/)
  })

  it('throws on duplicate selectionTiePriority (id spelling never decides)', () => {
    const { w, buffExists } = setup()
    const defs = makeCanonicalReactionDefs()
    defs.push({ ...defs[0]!, id: 'duong_viem_alias' })
    expect(() =>
      validateReactionDefinitions(defs, w.elements, buffExists, fixtureDamageProfileExists),
    ).toThrow(/duplicate selectionTiePriority/)
  })

  it('throws on sinh def missing parent+child', () => {
    const { w, buffExists } = setup()
    const defs = makeCanonicalReactionDefs()
    defs[0] = { ...defs[0]!, elements: { parent: 'wood' } }
    expect(() =>
      validateReactionDefinitions(defs, w.elements, buffExists, fixtureDamageProfileExists),
    ).toThrow(/requires parent \+ child/)
  })

  it('throws on khac def missing attacker+defender', () => {
    const { w, buffExists } = setup()
    const defs = makeCanonicalReactionDefs()
    defs[5] = { ...defs[5]!, elements: { attacker: 'water' } }
    expect(() =>
      validateReactionDefinitions(defs, w.elements, buffExists, fixtureDamageProfileExists),
    ).toThrow(/requires attacker \+ defender/)
  })

  it('throws on wrong-relation fields', () => {
    const { w, buffExists } = setup()
    const defs = makeCanonicalReactionDefs()
    defs[0] = {
      ...defs[0]!,
      elements: { parent: 'wood', child: 'fire', attacker: 'water' },
    }
    expect(() =>
      validateReactionDefinitions(defs, w.elements, buffExists, fixtureDamageProfileExists),
    ).toThrow(/must not carry attacker\/defender/)
  })

  it('throws on self-element relation', () => {
    const { w, buffExists } = setup()
    const defs = makeCanonicalReactionDefs()
    defs[0] = { ...defs[0]!, elements: { parent: 'fire', child: 'fire' } }
    expect(() =>
      validateReactionDefinitions(defs, w.elements, buffExists, fixtureDamageProfileExists),
    ).toThrow(/self-element/)
  })

  it('throws on non-canonical pair direction', () => {
    const { w, buffExists } = setup()
    const defs = makeCanonicalReactionDefs()
    // wood->metal is khac territory (metal overcomes wood), not sinh.
    defs[0] = {
      ...defs[0]!,
      elements: { parent: 'wood', child: 'metal' },
    }
    expect(() =>
      validateReactionDefinitions(defs, w.elements, buffExists, fixtureDamageProfileExists),
    ).toThrow(/not a canonical sinh pair/)
  })

  it('throws on apply_status payoff referencing an unknown buff', () => {
    const { w, buffExists } = setup()
    const defs = makeCanonicalReactionDefs()
    defs[0] = {
      ...defs[0]!,
      payoff: {
        steps: [
          {
            kind: 'apply_status',
            definitionId: 'test_no_such_buff' as BuffDefinitionId,
          },
        ],
      },
    }
    expect(() =>
      validateReactionDefinitions(defs, w.elements, buffExists, fixtureDamageProfileExists),
    ).toThrow(/unknown buff/)
  })

  it('throws when a canonical pair has no definition', () => {
    const { w, buffExists } = setup()
    const defs = makeCanonicalReactionDefs().filter(
      (d) => d.id !== 'duong_viem',
    )
    expect(() =>
      validateReactionDefinitions(defs, w.elements, buffExists, fixtureDamageProfileExists),
    ).toThrow(/canonical pair 'sinh:wood>fire'/)
  })

  it('throws on two defs for one canonical pair', () => {
    const { w, buffExists } = setup()
    const defs = makeCanonicalReactionDefs()
    defs.push({
      ...defs[0]!,
      id: 'duong_viem_bis',
      selectionTiePriority: 999,
    })
    expect(() =>
      validateReactionDefinitions(defs, w.elements, buffExists, fixtureDamageProfileExists),
    ).toThrow(/defined by both/)
  })

  it('throws on a stacks expr referencing a role the relation lacks', () => {
    const { w, buffExists } = setup()
    const defs = makeCanonicalReactionDefs()
    defs[0] = {
      ...defs[0]!,
      payoff: {
        steps: [
          {
            kind: 'add_child_stacks',
            stacks: { op: 'stacks', role: 'attacker' }, // sinh has no attacker
          },
        ],
      },
    }
    expect(() =>
      validateReactionDefinitions(defs, w.elements, buffExists, fixtureDamageProfileExists),
    ).toThrow(/role 'attacker'/)
  })

  it('throws on a when-role the relation lacks', () => {
    const { w, buffExists } = setup()
    const defs = makeCanonicalReactionDefs()
    defs[5] = {
      ...defs[5]!,
      payoff: {
        steps: [
          {
            kind: 'apply_status',
            definitionId: 'reaction_bleed' as BuffDefinitionId,
            when: { role: 'parent', op: 'gte', value: 1 }, // khac has no parent
          },
        ],
      },
    }
    expect(() =>
      validateReactionDefinitions(defs, w.elements, buffExists, fixtureDamageProfileExists),
    ).toThrow(/when-role 'parent'/)
  })

  it('throws on a child-bound step kind authored on a khac def', () => {
    const { w, buffExists } = setup()
    const defs = makeCanonicalReactionDefs()
    defs[5] = {
      ...defs[5]!,
      payoff: {
        steps: [
          {
            kind: 'add_child_stacks',
            stacks: { op: 'const', value: 1 },
          },
        ],
      },
    }
    expect(() =>
      validateReactionDefinitions(defs, w.elements, buffExists, fixtureDamageProfileExists),
    ).toThrow(/step 'add_child_stacks' requires role 'child'/)
  })

  it('throws on heal_from_damage without a preceding reaction_damage', () => {
    const { w, buffExists } = setup()
    const defs = makeCanonicalReactionDefs()
    defs[5] = {
      ...defs[5]!,
      payoff: {
        steps: [
          {
            kind: 'heal_from_damage',
            fraction: { op: 'const', value: 0.1 },
            capRatio: 0.25,
            healTarget: 'source',
          },
        ],
      },
    }
    expect(() =>
      validateReactionDefinitions(defs, w.elements, buffExists, fixtureDamageProfileExists),
    ).toThrow(/requires a preceding reaction_damage/)
  })

  it('registry get() throws on unknown id', () => {
    const { w, buffExists } = setup()
    const registry = new ReactionRegistry(
      makeCanonicalReactionDefs(),
      w.elements,
      buffExists,
      fixtureDamageProfileExists,
    )
    expect(() => registry.get('nope')).toThrow(/unknown reaction id/)
  })

  it('throws on a reaction_damage step referencing an unknown damage profile', () => {
    const { w, buffExists } = setup()
    const defs = makeCanonicalReactionDefs()
    defs[5] = {
      ...defs[5]!,
      payoff: {
        steps: [
          {
            kind: 'reaction_damage',
            coefficient: { op: 'const', value: 1 },
            damageProfile: 'reactoin', // the catalog's 'reaction' typo'd
            element: 'attacker',
          },
        ],
      },
    }
    expect(() =>
      validateReactionDefinitions(defs, w.elements, buffExists, fixtureDamageProfileExists),
    ).toThrow(/unknown damage profile 'reactoin'/)
  })
})
