import { describe, expect, it } from 'vitest'

import type { BuffDefinitionId } from '../battle/contracts/ids'
import type { TurnSkillDefinition } from '../battle/turn/TurnSkillAction'

import { adaptSkill, adaptTurnSkillDefinition } from './LegacySkillAdapter'
import type { AuthoredSkillOperation } from './AuthoredOperation'
import { validateSkillDefinition } from './SkillDefinitionRegistry'
import { evaluateScalarExpression, type SkillReadContext } from './ScalarExpression'

import { SKILLS } from '../../data/skill/Skills'
import { PHAN_KICH, TRO_KICH, TRONG_PHAN_KICH } from '../../data/skill/TheTuSkills'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'

const KNOWN_BUFFS = new Set<BuffDefinitionId>([
  'ailment.burn',
  'debuff.mark',
  'buff.guard',
])
const deps = { isBuffDefinitionId: (id: BuffDefinitionId) => KNOWN_BUFFS.has(id) }

function turnDef(overrides: Partial<TurnSkillDefinition> = {}): TurnSkillDefinition {
  return {
    id: 'skill.test',
    cooldownTurns: 3,
    targeting: { shape: 'single' },
    damage: { kind: 'physical', multiplier: 1.5 },
    ...overrides,
  }
}

function opsOf(root: { operations: readonly AuthoredSkillOperation[] }) {
  return root.operations
}

describe('LegacySkillAdapter -- damage lane', () => {
  it('maps physical damage to deal_damage with coefficient + damageType', () => {
    const { root } = adaptTurnSkillDefinition(turnDef())
    const op = opsOf(root)[0]!
    expect(op).toMatchObject({
      type: 'deal_damage',
      target: 'affected_targets',
      coefficient: 1.5,
      damageType: 'physical',
    })
    expect(root.targetIntent).toBe('affected_targets')
    expect(root.cadence).toEqual({ cooldownTurns: 3 })
  })

  it('maps primordial + elemental kinds and carries scaling/missingHp scalars', () => {
    const scaling = { manaScalingRatio: 0.5 }
    const { root: prim } = adaptTurnSkillDefinition(
      turnDef({
        damage: {
          kind: 'primordial',
          multiplier: 2,
          scaling,
          missingHpBonusPerMissingPercent: 0.02,
          missingHpBonusCap: 2,
        },
      }),
    )
    expect(opsOf(prim)[0]).toMatchObject({
      damageType: 'primordial',
      coefficient: 2,
      scaling,
      missingHpBonusPerMissingPercent: 0.02,
      missingHpBonusCap: 2,
    })

    const components = [{ kind: 'element' as const, element: 'fire' as const, ratio: 1 }]
    const { root: elem } = adaptTurnSkillDefinition(
      turnDef({ damage: { kind: 'elemental', components, multiplier: 1.3 } }),
    )
    expect(opsOf(elem)[0]).toMatchObject({
      type: 'deal_damage',
      components,
      coefficient: 1.3,
    })
    expect((opsOf(elem)[0] as { damageType?: string }).damageType).toBeUndefined()
  })

  it('self-scope maps targetIntent self and emits no damage', () => {
    const { root } = adaptTurnSkillDefinition(
      turnDef({ targetScope: 'self', damage: undefined }),
    )
    expect(root.targetIntent).toBe('self')
    expect(opsOf(root).some((op) => op.type === 'deal_damage')).toBe(false)
  })
})

describe('LegacySkillAdapter -- ailments + detonate', () => {
  it('damaging defs lift ailments+detonate into deal_damage.onLanded (eligible, loop_target)', () => {
    const { root } = adaptTurnSkillDefinition(
      turnDef({
        appliesAilments: [
          { buffDefinitionId: 'ailment.burn', chance: 0.7, stacks: 2 },
          { buffDefinitionId: 'debuff.mark', chance: 1 },
        ],
        detonateDoT: { amp: 1.5 },
      }),
    )
    const op = opsOf(root)[0]!
    if (op.type !== 'deal_damage') throw new Error('unreachable')
    expect(op.onLanded).toHaveLength(3)
    expect(op.onLanded![0]).toMatchObject({
      type: 'apply_buff',
      target: 'loop_target',
      definitionId: 'ailment.burn',
      reactionEligibility: 'eligible',
      chance: 0.7,
      stacks: 2,
    })
    expect(op.onLanded![1]).toMatchObject({
      type: 'apply_buff',
      target: 'loop_target',
      definitionId: 'debuff.mark',
      reactionEligibility: 'eligible',
      chance: 1,
    })
    expect(op.onLanded![2]).toEqual({
      type: 'detonate',
      target: 'loop_target',
      amp: 1.5,
    })
  })

  it('non-damaging enemy defs compile ailments+detonate inside for_each_target', () => {
    const { root } = adaptTurnSkillDefinition(
      turnDef({
        damage: undefined,
        appliesAilment: { buffDefinitionId: 'debuff.mark', chance: 0.5 },
        detonateDoT: { amp: 2 },
      }),
    )
    expect(opsOf(root)).toHaveLength(1)
    const lane = opsOf(root)[0]!
    if (lane.type !== 'for_each_target') throw new Error('unreachable')
    expect(lane.target).toBe('affected_targets')
    expect(lane.ops[0]).toMatchObject({
      type: 'apply_buff',
      target: 'loop_target',
      definitionId: 'debuff.mark',
      reactionEligibility: 'eligible',
      chance: 0.5,
    })
    expect(lane.ops[1]).toEqual({ type: 'detonate', target: 'loop_target', amp: 2 })
  })

  it('self-scope ailments report unsupported instead of emitting dead ops', () => {
    const { root, unsupported } = adaptTurnSkillDefinition(
      turnDef({
        targetScope: 'self',
        damage: undefined,
        appliesAilment: { buffDefinitionId: 'debuff.mark', chance: 1 },
      }),
    )
    expect(opsOf(root).some((op) => op.type === 'apply_buff')).toBe(false)
    expect(unsupported.some((m) => m.includes('self-scope'))).toBe(true)
    expect(root.adapterUnsupportedMetadata?.length).toBeGreaterThan(0)
  })

  it('non-physical sourceMaxHpRatio reports unsupported instead of a silent drop', () => {
    const { unsupported } = adaptTurnSkillDefinition(
      turnDef({
        damage: {
          kind: 'elemental',
          components: [{ kind: 'element' as const, element: 'fire' as const, ratio: 1 }],
          multiplier: 1,
          sourceMaxHpRatio: 0.5,
        },
      }),
    )
    expect(unsupported.some((m) => m.includes('sourceMaxHpRatio'))).toBe(true)
  })
})

describe('LegacySkillAdapter -- consume + leech lanes', () => {
  it('maps consumesAilmentId/damagePerStack to consumeBuff{scope:any}', () => {
    const { root } = adaptTurnSkillDefinition(
      turnDef({ consumesAilmentId: 'ailment.burn', damagePerStack: 50 }),
    )
    const op = opsOf(root)[0]!
    if (op.type !== 'deal_damage') throw new Error('unreachable')
    expect(op.consumeBuff).toEqual({
      definitionId: 'ailment.burn',
      damagePerStack: 50,
      scope: 'any',
    })
  })

  it('maps consumesWardForDamage + healPercentOfDamage', () => {
    const { root } = adaptTurnSkillDefinition(
      turnDef({
        consumesWardForDamage: true,
        damagePerWardPoint: 2,
        healPercentOfDamage: 0.3,
      }),
    )
    const op = opsOf(root)[0]!
    if (op.type !== 'deal_damage') throw new Error('unreachable')
    expect(op.consumeWard).toEqual({ damagePerWardPoint: 2 })
    expect(op.healPercentOfDamage).toBe(0.3)
  })

  it('reports consume fields with no damage as never-firing', () => {
    const { root, unsupported } = adaptTurnSkillDefinition(
      turnDef({
        damage: undefined,
        consumesAilmentId: 'ailment.burn',
        damagePerStack: 10,
      }),
    )
    expect(unsupported.some((m) => m.includes('consume lane never fires'))).toBe(true)
    expect(opsOf(root).some((op) => op.type === 'deal_damage')).toBe(false)
  })
})

describe('LegacySkillAdapter -- post-cast buff lane', () => {
  it('appliesBuffs map to suppressed apply_buff ops appended after the hit lane', () => {
    const { root } = adaptTurnSkillDefinition(
      turnDef({
        appliesBuffs: [
          {
            definitionId: 'buff.guard',
            target: 'action_targets',
            durationOverride: 8,
            stacks: 2,
          },
          { definitionId: 'buff.guard', target: 'allies_except_self' },
        ],
      }),
    )
    expect(opsOf(root)).toHaveLength(3)
    const [first, second] = [opsOf(root)[1]!, opsOf(root)[2]!]
    expect(first).toMatchObject({
      type: 'apply_buff',
      target: 'affected_targets',
      definitionId: 'buff.guard',
      reactionEligibility: 'suppressed',
      durationOverride: 8,
      stacks: 2,
    })
    expect(second).toMatchObject({
      type: 'apply_buff',
      target: 'allies_except_self',
      stacks: 1,
    })
  })

  it('stacksPerAffectedTarget compiles to max(1, alive_count{affected_targets})', () => {
    const { root } = adaptTurnSkillDefinition(
      turnDef({
        appliesBuff: {
          definitionId: 'buff.guard',
          target: 'target',
          stacksPerAffectedTarget: true,
        },
      }),
    )
    const op = opsOf(root)[1]!
    if (op.type !== 'apply_buff') throw new Error('unreachable')
    expect(op.stacks).toEqual({
      op: 'max',
      values: [1, { query: 'alive_count', target: 'affected_targets' }],
    })
    expect(op.target).toBe('affected_targets')
  })

  it('externalWardGrant rides the apply_buff op to TBS orchestration', () => {
    const { root, unsupported } = adaptTurnSkillDefinition(
      turnDef({
        appliesBuff: {
          definitionId: 'buff.guard',
          target: 'self',
          externalWardGrant: { sourceMaxHpRatio: 0.5 },
        },
      }),
    )
    expect(unsupported.some((m) => m.includes('externalWardGrant'))).toBe(false)
    const op = opsOf(root).find((candidate) => candidate.type === 'apply_buff')
    if (op?.type !== 'apply_buff') throw new Error('unreachable')
    expect(op.externalWardGrant).toEqual({ sourceMaxHpRatio: 0.5 })
  })
})

describe('LegacySkillAdapter -- def-level fields', () => {
  it('maps charge/cooldown/resource/subcasts/grants/theScaling verbatim', () => {
    const { root } = adaptTurnSkillDefinition(
      turnDef({
        chargeTurns: 2,
        resourceType: 'mana',
        resourceCost: 30,
        repeatCasts: 2,
        multicast: { chance: 0.4, maxExtraCasts: 2 },
        theGainOnLandedCast: 10,
        theGainOnCrit: 5,
        theScaling: { coeff: 0.5 },
        counterable: true,
        counterSkillId: 'skill.counter',
        presetId: 'vfx.test' as never,
        actionTags: ['attack', 'fire'],
      }),
    )
    expect(root.cadence).toEqual({ cooldownTurns: 3, chargeTurns: 2 })
    expect(root.cost).toEqual({ resourceType: 'mana', amount: 30 })
    expect(root.subcasts).toEqual({
      count: 2,
      multicast: { chance: 0.4, maxExtraCasts: 2 },
    })
    expect(root.grants).toEqual({ theOnLandedCast: 10, theOnCrit: 5 })
    expect(root.theScaling).toEqual({ coeff: 0.5 })
    expect(root.counterable).toBe(true)
    expect(root.counterSkillId).toBe('skill.counter')
    expect(root.presentation).toEqual({ presetId: 'vfx.test' })
    expect(root.actionTags).toEqual(['attack', 'fire'])
  })

  it('compositePicks map to compositePool + auxiliaries', () => {
    const memberA = turnDef({ id: 'skill.pick.a' })
    const memberB = turnDef({ id: 'skill.pick.b' })
    const { root, auxiliaries } = adaptTurnSkillDefinition(
      turnDef({
        damage: undefined,
        compositePicks: {
          poolType: 'element_basic',
          count: 2,
          pool: [memberA, memberB],
        },
      }),
    )
    expect(root.subcasts?.compositePool).toEqual(['skill.pick.a', 'skill.pick.b'])
    expect(root.subcasts?.compositeCount).toBe(2)
    expect(auxiliaries.map((d) => d.id)).toEqual(['skill.pick.a', 'skill.pick.b'])
  })

  it('reports composite extras the legacy lane could not express (count > 1)', () => {
    // Legacy extras only resolveDeclaredHit on members WITH damage:
    // non-damaging extras skip entirely, instance multiplicity drops,
    // member targetScope is ignored, and appliesBuffs never run (the
    // shared post-cast lane reads only the primary pick).
    const nonDamaging = turnDef({ id: 'skill.pick.buff', damage: undefined })
    const instanced = turnDef({ id: 'skill.pick.multi', instances: { count: 2 } })
    const buffed = turnDef({
      id: 'skill.pick.buffed',
      appliesBuff: { definitionId: 'buff.guard', target: 'self' },
    })
    const pure = turnDef({ id: 'skill.pick.pure' })

    for (const pool of [[pure, nonDamaging], [pure, instanced], [pure, buffed]]) {
      const { unsupported } = adaptTurnSkillDefinition(
        turnDef({
          damage: undefined,
          compositePicks: { poolType: 'element_basic', count: 2, pool },
        }),
      )
      expect(
        unsupported.some((m) => m.includes('is not expressible as a composite extra')),
      ).toBe(true)
    }

    // count:1 never surfaces extras -- the same members stay covered.
    const { unsupported: single } = adaptTurnSkillDefinition(
      turnDef({
        damage: undefined,
        compositePicks: { poolType: 'element_basic', count: 1, pool: [pure, nonDamaging] },
      }),
    )
    expect(single).toEqual([])

    // count>1 with pure-damage members is expressible -- extras resolve verbatim.
    const { unsupported: clean } = adaptTurnSkillDefinition(
      turnDef({
        damage: undefined,
        compositePicks: { poolType: 'element_basic', count: 2, pool: [pure, instanced && pure] },
      }),
    )
    expect(clean).toEqual([])
  })

  it('empowerment maps to variants + auxiliary; consumesAllThe rides the empowered def', () => {
    const empowered = turnDef({ id: 'skill.ult.god', consumesAllThe: true })
    const { root, auxiliaries } = adaptTurnSkillDefinition(
      turnDef({
        empowerment: { theThreshold: 100, empowered },
      }),
    )
    expect(root.variants?.empowerment).toEqual({
      theThreshold: 100,
      empoweredSkillId: 'skill.ult.god',
    })
    expect(
      auxiliaries.find((d) => d.id === 'skill.ult.god')?.consumesAllThe,
    ).toBe(true)
  })

  it('instances map count + declarative each; closure-only reports unsupported', () => {
    const { root } = adaptTurnSkillDefinition(
      turnDef({
        instances: {
          count: 5,
          perInstanceOptions: () => ({}),
          each: {
            guaranteedHit: true,
            execute: { hpPercentBelow: 0.4, damageMultiplier: 2 },
            critChance: 0.25,
            armorPierce: { bypassChance: 0.3, pierceFraction: 0.5 },
          },
        },
      }),
    )
    expect(root.instances).toEqual({
      count: 5,
      each: {
        guaranteedHit: true,
        execute: { hpPercentBelow: 0.4, damageMultiplier: 2 },
        critChance: 0.25,
        armorPierce: { bypassChance: 0.3, pierceFraction: 0.5 },
      },
    })

    const { root: closureOnly, unsupported } = adaptTurnSkillDefinition(
      turnDef({
        instances: { count: 3, perInstanceOptions: () => ({}) },
      }),
    )
    expect(unsupported.some((m) => m.includes('perInstanceOptions'))).toBe(true)
    expect(closureOnly.instances?.each).toBeUndefined()
  })

  it('emblemOnly defs adapt with empty operations (never cast)', () => {
    const { root } = adaptTurnSkillDefinition(
      turnDef({ damage: undefined, emblemOnly: true }),
    )
    expect(root.emblemOnly).toBe(true)
    expect(root.operations).toEqual([])
  })
})

describe('LegacySkillAdapter -- registry round-trip', () => {
  it('adapted defs validate cleanly (registry membership)', () => {
    const catalog = adaptTurnSkillDefinition(
      turnDef({
        appliesAilments: [{ buffDefinitionId: 'ailment.burn', chance: 0.5 }],
        appliesBuffs: [{ definitionId: 'buff.guard', target: 'self', stacks: 2 }],
        detonateDoT: { amp: 1.5 },
        consumesAilmentId: 'ailment.burn',
        damagePerStack: 50,
      }),
    )
    for (const def of [catalog.root, ...catalog.auxiliaries]) {
      expect(validateSkillDefinition(def, deps)).toEqual([])
    }
  })
})

describe('LegacySkillAdapter -- Skill/EffectiveSkill path', () => {
  it('adaptSkill converts through toTurnSkillDefinition and merges unsupported reports', () => {
    const manager = new SkillManager()
    const skillSystem = new SkillSystem(manager)
    const skill = structuredClone(SKILLS.find((s) => s.id === 'tam_muoi_chan_hoa')!)
    manager.add(skill)
    const effective = skillSystem.getEffectiveSkill(skill)

    const { root, unsupported } = adaptSkill(skill, effective)
    expect(root.id).toBe('tam_muoi_chan_hoa')
    expect(root.cadence.cooldownTurns).toBe(3)
    const hit = opsOf(root)[0]!
    if (hit.type !== 'deal_damage') throw new Error('unreachable')
    // Elemental fire at 1.3 multiplier, debuff bong as eligible onLanded.
    expect(hit.components).toEqual([{ kind: 'element', element: 'fire', ratio: 1 }])
    expect(hit.coefficient).toBeCloseTo(1.3, 5)
    expect(hit.onLanded?.[0]).toMatchObject({
      type: 'apply_buff',
      definitionId: 'hoa_an',
      reactionEligibility: 'eligible',
      chance: 1,
    })
    expect(Array.isArray(unsupported)).toBe(true)
  })
})

// M-QI-05 / QI-D3 - internal actions inherit progression through
// progressionOwnerId: the authored levelScaling on their damage is the
// CONSUMING side, evaluated against the snapshot's skill_level (the
// owner's canonical Core level resolved by the plan runtime). No
// core_<internalId> exists - inheritance, not own state.
describe('LegacySkillAdapter -- inherited owner-level scaling (M-QI-05)', () => {
  function ctxAtLevel(level: number): SkillReadContext {
    return {
      resolveTarget: () => undefined,
      buffStacks: () => 0,
      buffDuration: () => 0,
      hpPercent: () => 1,
      resourceCurrent: () => 0,
      resourceMax: () => 0,
      resourceSnapshot: () => 0,
      statScalar: () => 0,
      skillLevel: () => level,
      readVar: () => 0,
      alive: () => true,
      critLanded: () => false,
      anyTargetLanded: () => false,
    }
  }

  function damageCoefficientOf(def: TurnSkillDefinition, level: number): number {
    const { root } = adaptTurnSkillDefinition(def)
    const hit = root.operations.find((op) => op.type === 'deal_damage')

    if (hit === undefined || hit.type !== 'deal_damage' || hit.coefficient === undefined) {
      throw new Error(`expected a deal_damage operation on ${def.id}`)
    }

    return evaluateScalarExpression(hit.coefficient, ctxAtLevel(level))
  }

  it.each([
    [PHAN_KICH, 1],
    [TRO_KICH, 0.7],
    [TRONG_PHAN_KICH, 1],
  ])('%s inherits the tham_the core level: coefficient = multiplier x (1 + (L-1) x 0.05)', (def, multiplier) => {
    // The runtime resolves skill_level from the OWNER core
    // (progressionOwnerId 'tham_the'); the adapter only needs the
    // authored levelScaling to scale the coefficient.
    expect(def.progressionOwnerId).toBe('tham_the')

    const lv1 = damageCoefficientOf(def, 1)
    const lv6 = damageCoefficientOf(def, 6)

    expect(lv1).toBeCloseTo(multiplier, 6)
    expect(lv6).toBeCloseTo(multiplier * 1.25, 6)
    expect(lv6 / lv1).toBeCloseTo(1 + 5 * 0.05, 6)
  })
})
