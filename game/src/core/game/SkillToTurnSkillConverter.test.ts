import { describe, expect, it } from 'vitest'
import { toTurnSkillDefinition } from './SkillToTurnSkillConverter'
import { SKILLS } from '../../data/skill/Skills'
import { SkillSystem } from '../skill/SkillSystem'
import { SkillManager } from '../skill/SkillManager'

// Phase A3 (2026-09-07) — Skill → TurnSkillDefinition converter tests.
// The converter is a pure field mapper over an ALREADY-RESOLVED
// EffectiveSkill (produced by SkillSystem.getEffectiveSkill(), which
// applies the selected specialization's effectsOverride/targeting).
// Number-preserved unit policy: skill.cooldown (legacy real-seconds or
// authored turn-count) carries over as cooldownTurns with the same
// numeric value (A1/A2 precedent).

describe('toTurnSkillDefinition', () => {
  it('maps the fire special tam_muoi_chan_hoa: damage/debuff/cooldown fields', () => {
    const manager = new SkillManager()
    const skillSystem = new SkillSystem(manager)
    const skill = structuredClone(SKILLS.find((s) => s.id === 'tam_muoi_chan_hoa')!)
    manager.add(skill)

    const effective = skillSystem.getEffectiveSkill(skill)
    const turnSkill = toTurnSkillDefinition(skill, effective)

    expect(turnSkill.id).toBe('tam_muoi_chan_hoa')
    // Number-preserved cooldown (skill.cooldown = 3).
    expect(turnSkill.cooldownTurns).toBe(3)
    // Damage effect: elemental fire, value 1.3.
    expect(turnSkill.damage.kind).toBe('elemental')
    if (turnSkill.damage.kind === 'elemental') {
      expect(turnSkill.damage.components).toEqual([{ kind: 'element', element: 'fire', ratio: 1 }])
      expect(turnSkill.damage.multiplier).toBeCloseTo(1.3, 5)
    }
    // Debuff effect → appliesAilment (bong, chance 1).
    expect(turnSkill.appliesAilment).toEqual({ buffDefinitionId: 'bong', chance: 1 })
  })

  it('applies the selected specialization override through getEffectiveSkill (Tán Diễm AoE branch)', () => {
    const manager = new SkillManager()
    const skillSystem = new SkillSystem(manager)
    const skill = structuredClone(SKILLS.find((s) => s.id === 'tam_muoi_chan_hoa')!)
    manager.add(skill)

    // Tán Diễm: AoE square radius 1, value 1, chance 0.7.
    skillSystem.selectSpecialization(skill.id, 'tam_muoi_tan_diem')

    const effective = skillSystem.getEffectiveSkill(manager.get(skill.id)!)
    const turnSkill = toTurnSkillDefinition(manager.get(skill.id)!, effective)

    expect(turnSkill.targeting).toEqual({ shape: 'square', laneRadius: 1 })
    if (turnSkill.damage.kind === 'elemental') {
      expect(turnSkill.damage.multiplier).toBeCloseTo(1, 5)
    }
    expect(turnSkill.appliesAilment).toEqual({ buffDefinitionId: 'bong', chance: 0.7 })
  })

  it('maps an ultimate with consume-for-damage fields (Detonate/ward-burst)', () => {
    // Find an ultimate in CHAIN_SKILL_IDS with consumesAilmentId — fall back
    // to a synthetic skill if none carries it, so this test proves the
    // mapping itself regardless of content drift.
    const manager = new SkillManager()
    const skillSystem = new SkillSystem(manager)
    const synthetic = structuredClone(SKILLS.find((s) => s.id === 'tam_muoi_chan_hoa')!)

    // Give it Detonate + ward burst fields to prove the mapping.
    synthetic.id = 'fixture_ultimate'
    synthetic.effects = [
      {
        type: 'damage',
        value: 2,
        consumesAilmentId: 'bong',
        damagePerStack: 40,
        consumesWardForDamage: true,
        damagePerWardPoint: 6,
        components: [{ kind: 'element', element: 'fire', ratio: 1 }],
      },
    ]
    manager.add(synthetic)

    const effective = skillSystem.getEffectiveSkill(synthetic)
    const turnSkill = toTurnSkillDefinition(synthetic, effective)

    expect(turnSkill.consumesAilmentId).toBe('bong')
    expect(turnSkill.damagePerStack).toBe(40)
    expect(turnSkill.consumesWardForDamage).toBe(true)
    expect(turnSkill.damagePerWardPoint).toBe(6)
  })

  it('maps a mana-cost skill resource fields verbatim', () => {
    const manager = new SkillManager()
    const skillSystem = new SkillSystem(manager)
    // A chain skill with mana cost — the first non-basic chain entry with
    // resourceType mana; fall back to the fire special if content shifts.
    const skill = structuredClone(SKILLS.find((s) => s.id === 'hoa_ha_cuu_thien') ?? SKILLS.find((s) => s.id === 'tam_muoi_chan_hoa')!)
    manager.add(skill)

    const effective = skillSystem.getEffectiveSkill(skill)
    const turnSkill = toTurnSkillDefinition(skill, effective)

    expect(turnSkill.resourceType).toBe(skill.resourceType)
    expect(turnSkill.resourceCost).toBe(skill.cost)
  })
})
