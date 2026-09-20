import { describe, expect, it } from 'vitest'
import { BUFF_REGISTRY } from '../buff/BuffRegistry'
import type { BuffDefinitionId } from '../../core/battle/contracts/ids'
import { createDamageProfileCatalog } from '../../core/combat/DamageProfiles'
import { CANONICAL_ELEMENTAL_SEALS, createElementalStateRegistry } from '../../core/reaction/ElementalStateRegistry'
import { ReactionRegistry } from '../../core/reaction/ReactionRegistry'
import { KHAC_OVERCOMES, SINH_CYCLE } from '../../core/element/WuxingRelations'
import type { ElementType } from '../../core/element/ElementType'
import {
  CANONICAL_REACTIONS,
  REACTION_STATUS_BUFF_IDS,
} from './ReactionDefinitions'

// Canonical-seals S2 (plan sec.8.4/8.5): CANONICAL_REACTIONS is
// production data -- it must validate against the SEALED battle
// registry, reference no test_* ids, and bind the four production
// payoff defs with the sec.8.2 locked shapes.

const elements = createElementalStateRegistry(CANONICAL_ELEMENTAL_SEALS)
const buffExists = (id: string) => BUFF_REGISTRY.has(id as BuffDefinitionId)

describe('CANONICAL_REACTIONS -- production registry construction', () => {
  it('constructs a ReactionRegistry against the sealed battle registry; all 10 canonical pairs present', () => {
    const registry = new ReactionRegistry(CANONICAL_REACTIONS, elements, buffExists)
    expect(registry.all()).toHaveLength(10)

    const pairs = new Set(
      registry.all().map((def) =>
        def.relation === 'sinh'
          ? `sinh:${def.elements.parent}>${def.elements.child}`
          : `khac:${def.elements.attacker}>${def.elements.defender}`,
      ),
    )
    for (const element of Object.keys(SINH_CYCLE) as ElementType[]) {
      expect(pairs).toContain(`sinh:${element}>${SINH_CYCLE[element]}`)
      expect(pairs).toContain(`khac:${element}>${KHAC_OVERCOMES[element]}`)
    }
  })

  it('references no test_* ids anywhere in production payoff data', () => {
    for (const def of CANONICAL_REACTIONS) {
      for (const step of def.payoff.steps) {
        if (step.kind === 'apply_status') {
          expect(step.definitionId).not.toMatch(/^test_/)
        }
      }
    }
    for (const id of Object.values(REACTION_STATUS_BUFF_IDS)) {
      expect(id).not.toMatch(/^test_/)
    }
  })

  it('every reaction_damage profile resolves in the damage-profile catalog', () => {
    const profiles = createDamageProfileCatalog()
    for (const def of CANONICAL_REACTIONS) {
      for (const step of def.payoff.steps) {
        if (step.kind === 'reaction_damage') {
          expect(profiles.has(step.damageProfile)).toBe(true)
        }
      }
    }
  })
})

describe('duong_kim -- elemental penetration payoff (S0.5P)', () => {
  it('authors an additive elemental_penetration child modifier at 4 points per parent stack', () => {
    const duongKim = CANONICAL_REACTIONS.find((def) => def.id === 'duong_kim')!
    const modifier = duongKim.payoff.steps.find(
      (step) => step.kind === 'add_child_modifier',
    )
    expect(modifier).toMatchObject({
      kind: 'add_child_modifier',
      modifierId: 'duong_kim',
      channel: 'elemental_penetration',
      operation: 'add',
    })
    // value = 4 * P -- mul(const 4, stacks parent).
    expect((modifier as { value: unknown }).value).toEqual({
      op: 'mul',
      args: [
        { op: 'const', value: 4 },
        { op: 'stacks', role: 'parent' },
      ],
    })
  })
})

describe('secondary payoff defs (sec.8.2 locked shapes)', () => {
  const EXPECTED = {
    reaction_bleed: { maxStacks: 5, duration: 3 },
    defense_break: { maxStacks: 5, duration: 3 },
    defense_erosion: { maxStacks: 5, duration: 4 },
    cam_cong: { maxStacks: 1, duration: 1 },
  } as const

  for (const [id, shape] of Object.entries(EXPECTED)) {
    it(`'${id}' is a registered non-elemental resistible debuff`, () => {
      const def = BUFF_REGISTRY.get(id as BuffDefinitionId)
      expect(def).toMatchObject({
        kind: 'debuff',
        polarity: 'debuff',
        instanceScope: 'per_source',
        dispellable: true,
      })
      expect(def.element).toBeUndefined()
      expect(def.application?.resistance).toBe('ailment')
      expect(def.lifetime).toMatchObject({
        clock: 'holder_turns',
        duration: shape.duration,
        scaling: 'fixed',
      })
      expect(def.stacking.maxStacks).toBe(shape.maxStacks)
    })

    it(`'${id}' never enters the ElementalStateRegistry (structural non-reactability)`, () => {
      expect(elements.getElement(id as BuffDefinitionId)).toBeNull()
    })
  }

  it('defense_break/defense_erosion carry -4% defense per stack', () => {
    for (const id of ['defense_break', 'defense_erosion'] as const) {
      const def = BUFF_REGISTRY.get(id)
      expect(def.statModifiers).toEqual([{ stat: 'defense', percent: -0.04 }])
    }
  })

  it('cam_cong forbids the attack tag without stunning the holder', () => {
    const def = BUFF_REGISTRY.get('cam_cong')
    expect(def.forbiddenActionTags).toEqual(['attack'])
    expect(def.controls ?? []).toHaveLength(0)
  })

  it('reaction_bleed carries the physical legacy_dot periodic', () => {
    const def = BUFF_REGISTRY.get('reaction_bleed')
    expect(def.periodic).toEqual([
      expect.objectContaining({
        id: 'reaction_bleed.dot',
        type: 'damage',
        element: 'physical',
        damageProfile: 'legacy_dot',
        coefficient: 0.2,
        timing: 'holder_turn_end',
        stackScaling: 'multiply',
      }),
    ])
  })
})
