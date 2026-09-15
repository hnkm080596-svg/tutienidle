import { describe, expect, it } from 'vitest'
import { toTurnSkillDefinition, collectUnsupportedSkillSemantics } from './SkillToTurnSkillConverter'
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
    expect(turnSkill.damage?.kind).toBe('elemental')
    if (turnSkill.damage && turnSkill.damage.kind === 'elemental') {
      expect(turnSkill.damage.components).toEqual([{ kind: 'element', element: 'fire', ratio: 1 }])
      expect(turnSkill.damage.multiplier).toBeCloseTo(1.3, 5)
    }
    // R3 re-audit (AR-03 gap) — authored manaScalingRatio/attributeScaling
    // must survive conversion (previously silently dropped).
    expect(turnSkill.damage?.scaling).toEqual({
      attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      manaScalingRatio: 0.001,
      swordIntentDamageRatio: undefined,
    })
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
    if (turnSkill.damage && turnSkill.damage.kind === 'elemental') {
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

  it('leaves damage.scaling undefined for a skill authoring no attributeScaling/manaScalingRatio/swordIntentDamageRatio', () => {
    const manager = new SkillManager()
    const skillSystem = new SkillSystem(manager)
    const synthetic = structuredClone(SKILLS.find((s) => s.id === 'tam_muoi_chan_hoa')!)
    synthetic.id = 'fixture_no_scaling'
    synthetic.effects = [{ type: 'damage', value: 1, damageType: 'physical' }]
    manager.add(synthetic)

    const effective = skillSystem.getEffectiveSkill(synthetic)
    const turnSkill = toTurnSkillDefinition(synthetic, effective)

    expect(turnSkill.damage?.scaling).toBeUndefined()
  })

  // AR-03: Strict converter tests
  describe('AR-03: Strict conversion of authored semantics', () => {
    it('converts water self-buff special thanh_tuyen_duong_linh: targetScope self, no fake damage, appliesBuff', () => {
      const manager = new SkillManager()
      const skillSystem = new SkillSystem(manager)
      const skill = structuredClone(SKILLS.find((s) => s.id === 'thanh_tuyen_duong_linh')!)
      manager.add(skill)

      const effective = skillSystem.getEffectiveSkill(skill)
      const turnSkill = toTurnSkillDefinition(skill, effective)

      expect(turnSkill.id).toBe('thanh_tuyen_duong_linh')
      expect(turnSkill.targetScope).toBe('self')
      expect(turnSkill.damage).toBeUndefined()
      expect(turnSkill.appliesBuffs).toEqual([{ definitionId: 'thanh_tuyen', target: 'self' }])
    })

    it('converts earth self-buff special dia_tru_thua_thien: targetScope self, no fake damage, appliesBuff', () => {
      const manager = new SkillManager()
      const skillSystem = new SkillSystem(manager)
      const skill = structuredClone(SKILLS.find((s) => s.id === 'dia_tru_thua_thien')!)
      manager.add(skill)

      const effective = skillSystem.getEffectiveSkill(skill)
      const turnSkill = toTurnSkillDefinition(skill, effective)

      expect(turnSkill.id).toBe('dia_tru_thua_thien')
      expect(turnSkill.targetScope).toBe('self')
      expect(turnSkill.damage).toBeUndefined()
      expect(turnSkill.appliesBuffs).toEqual([{ definitionId: 'dia_tru', target: 'self' }])
    })

    it('converts specialization of self-buff skill (Băng Giáp)', () => {
      const manager = new SkillManager()
      const skillSystem = new SkillSystem(manager)
      const skill = structuredClone(SKILLS.find((s) => s.id === 'thanh_tuyen_duong_linh')!)
      manager.add(skill)

      skillSystem.selectSpecialization(skill.id, 'duong_linh_bang_giap')
      const effective = skillSystem.getEffectiveSkill(manager.get(skill.id)!)
      const turnSkill = toTurnSkillDefinition(manager.get(skill.id)!, effective)

      expect(turnSkill.targetScope).toBe('self')
      expect(turnSkill.damage).toBeUndefined()
      expect(turnSkill.appliesBuffs).toEqual([{ definitionId: 'bang_giap', target: 'self' }])
    })

    it('maps multiple debuffs on wood special cau_mang_can_tri into appliesAilments', () => {
      const manager = new SkillManager()
      const skillSystem = new SkillSystem(manager)
      const skill = structuredClone(SKILLS.find((s) => s.id === 'cau_mang_can_tri')!)
      manager.add(skill)

      const effective = skillSystem.getEffectiveSkill(skill)
      const turnSkill = toTurnSkillDefinition(skill, effective)

      expect(turnSkill.appliesAilments).toHaveLength(2)
      expect(turnSkill.appliesAilments).toContainEqual({ buffDefinitionId: 'troi_chan', chance: 0.8 })
      expect(turnSkill.appliesAilments).toContainEqual({ buffDefinitionId: 'trung_doc', chance: 0.6 })
    })

    it('folds add_stack effect into ailment stacks count (Tam Muội Tụ Diễm)', () => {
      const manager = new SkillManager()
      const skillSystem = new SkillSystem(manager)
      const skill = structuredClone(SKILLS.find((s) => s.id === 'tam_muoi_chan_hoa')!)
      manager.add(skill)

      skillSystem.selectSpecialization(skill.id, 'tam_muoi_tu_diem')
      const effective = skillSystem.getEffectiveSkill(manager.get(skill.id)!)
      const turnSkill = toTurnSkillDefinition(manager.get(skill.id)!, effective)

      // Debuff 1 stack + add_stack 1 stack = 2 stacks.
      const bongAilment = turnSkill.appliesAilments?.find((a) => a.buffDefinitionId === 'bong')
      expect(bongAilment).toBeDefined()
      expect(bongAilment?.stacks).toBe(2)
    })

    it('maps healPercentOfDamage on wood ultimate doc_vien_bao_can', () => {
      const manager = new SkillManager()
      const skillSystem = new SkillSystem(manager)
      const skill = structuredClone(SKILLS.find((s) => s.id === 'doc_vien_bao_can')!)
      manager.add(skill)

      const effective = skillSystem.getEffectiveSkill(skill)
      const turnSkill = toTurnSkillDefinition(skill, effective)

      expect(turnSkill.healPercentOfDamage).toBe(0.4)
    })

    it('carries the authored buff duration override (duong_linh_tuyen spec: 8)', () => {
      const manager = new SkillManager()
      const skillSystem = new SkillSystem(manager)
      const skill = structuredClone(SKILLS.find((s) => s.id === 'thanh_tuyen_duong_linh')!)
      manager.add(skill)

      skillSystem.selectSpecialization(skill.id, 'duong_linh_tuyen')
      const effective = skillSystem.getEffectiveSkill(manager.get(skill.id)!)
      const turnSkill = toTurnSkillDefinition(manager.get(skill.id)!, effective)

      // M10 (ARCH-008) — the spec's authored duration:8 must survive
      // conversion; without it the registry default 6 silently wins.
      expect(turnSkill.appliesBuffs).toEqual([{ definitionId: 'thanh_tuyen', target: 'self', durationOverride: 8 }])
    })

    it('converts trigger-migrated tram (onCast -> dealDamage) into damage, preserving the cast-scaled value', () => {
      const manager = new SkillManager()
      const skillSystem = new SkillSystem(manager)
      const skill = structuredClone(SKILLS.find((s) => s.id === 'tram')!)
      skill.totalExperience = 10_000 // L3 — flat bonus floor(10000/10) = 1000
      manager.add(skill)

      const effective = skillSystem.getEffectiveSkill(skill)
      const turnSkill = toTurnSkillDefinition(skill, effective)

      expect(turnSkill.id).toBe('tram')
      expect(turnSkill.damage).toEqual({ kind: 'physical', multiplier: 1001, scaling: undefined })
    })

    it('throws on trigger kits that do not fit the single onCast -> dealDamage shape', () => {
      const manager = new SkillManager()
      const skillSystem = new SkillSystem(manager)
      const skill = structuredClone(SKILLS.find((s) => s.id === 'tram')!)
      skill.triggers = [
        {
          trigger: 'onCast',
          actions: [
            { type: 'dealDamage', value: 1 },
            { type: 'grantResource', pool: 'swordIntent', amount: 1 },
          ],
        },
      ]
      manager.add(skill)

      const effective = skillSystem.getEffectiveSkill(skill)

      expect(() => toTurnSkillDefinition(skill, effective)).toThrow(/Unsupported trigger kit/)
    })

    it('collectUnsupportedSkillSemantics reports authored fields the engine cannot execute', () => {
      const manager = new SkillManager()
      const skillSystem = new SkillSystem(manager)

      // diem_kim_thuat debuff carries proc-grant counters with no
      // turn-engine consumer.
      const metal = structuredClone(SKILLS.find((s) => s.id === 'diem_kim_thuat')!)
      manager.add(metal)

      const metalReport = collectUnsupportedSkillSemantics(
        metal,
        skillSystem.getEffectiveSkill(metal),
      )

      expect(metalReport).toContain('effect.grantsKimThePerProc')
      expect(metalReport).toContain('effect.grantsHuyetPhaPerProc')

      // tho_cau_thuat carries the per-cast grant + area-behavior flags.
      const earth = structuredClone(SKILLS.find((s) => s.id === 'tho_cau_thuat')!)
      const earthReport = collectUnsupportedSkillSemantics(
        earth,
        skillSystem.getEffectiveSkill(earth),
      )

      expect(earthReport).toContain('effect.earthPureAreaBehavior')
      expect(earthReport).toContain('skill.grantsThoThePerCast')

      // A clean kit reports nothing.
      const tram = structuredClone(SKILLS.find((s) => s.id === 'tram')!)
      expect(collectUnsupportedSkillSemantics(tram, skillSystem.getEffectiveSkill(tram))).toEqual([])
    })

    it('fails explicitly with an Error on unsupported effect types', () => {
      const manager = new SkillManager()
      const skillSystem = new SkillSystem(manager)
      const synthetic = structuredClone(SKILLS.find((s) => s.id === 'tam_muoi_chan_hoa')!)
      synthetic.id = 'unsupported_skill'
      synthetic.effects = [{ type: 'unknown_future_effect' as never }]
      manager.add(synthetic)

      const effective = skillSystem.getEffectiveSkill(synthetic)
      expect(() => toTurnSkillDefinition(synthetic, effective)).toThrow(/Unsupported/)
    })
  })
})
