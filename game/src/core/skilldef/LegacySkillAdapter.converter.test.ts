import { describe, expect, it } from 'vitest'
// skilldef M5e -- the bridge moved into LegacySkillAdapter.ts when the
// converter module retired; these tests keep covering the same functions.
import { toTurnSkillDefinition, collectUnsupportedSkillSemantics } from './LegacySkillAdapter'
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
  it('maps the fire basic hoa_cau_thuat: damage/debuff/cooldown fields', () => {
    const manager = new SkillManager()
    const skillSystem = new SkillSystem(manager)
    const skill = structuredClone(SKILLS.find((s) => s.id === 'hoa_cau_thuat')!)
    manager.add(skill)

    const effective = skillSystem.getEffectiveSkill(skill)
    const turnSkill = toTurnSkillDefinition(skill, effective)

    expect(turnSkill.id).toBe('hoa_cau_thuat')
    // Number-preserved cooldown (skill.cooldown = 4).
    expect(turnSkill.cooldownTurns).toBe(4)
    // Damage effect: elemental fire, value 1.
    expect(turnSkill.damage?.kind).toBe('elemental')
    if (turnSkill.damage && turnSkill.damage.kind === 'elemental') {
      expect(turnSkill.damage.components).toEqual([{ kind: 'element', element: 'fire', ratio: 1 }])
      expect(turnSkill.damage.multiplier).toBeCloseTo(1, 5)
    }
    // R3 re-audit (AR-03 gap) — authored manaScalingRatio/attributeScaling
    // must survive conversion (previously silently dropped).
    expect(turnSkill.damage?.scaling).toEqual({
      attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      manaScalingRatio: 0.001,
    })
    // Debuff effect -> appliesAilment (hoa_an, chance 0.5).
    expect(turnSkill.appliesAilment).toEqual({ buffDefinitionId: 'hoa_an', chance: 0.5 })
  })

  it('carries authored vfxPresetId to presetId; absence stays undefined for the runtime fallback', () => {
    const manager = new SkillManager()
    const skillSystem = new SkillSystem(manager)
    const skill = structuredClone(SKILLS.find((s) => s.id === 'hoa_cau_thuat')!)
    manager.add(skill)

    const effective = skillSystem.getEffectiveSkill(manager.get(skill.id)!)
    const withPreset = toTurnSkillDefinition(manager.get(skill.id)!, effective)
    expect(withPreset.presetId).toBe('hoa_cau_comet')

    const noPresetSkill = structuredClone(SKILLS.find((s) => s.id === 'tam_muoi_chan_hoa')!)
    manager.add(noPresetSkill)
    const noPresetEffective = skillSystem.getEffectiveSkill(manager.get(noPresetSkill.id)!)
    const withoutPreset = toTurnSkillDefinition(manager.get(noPresetSkill.id)!, noPresetEffective)
    expect(withoutPreset.presetId).toBeUndefined()
  })

  it('applies the selected specialization override through getEffectiveSkill (Tán Diễm AoE branch)', () => {
    const manager = new SkillManager()
    const skillSystem = new SkillSystem(manager)
    const skill = structuredClone(SKILLS.find((s) => s.id === 'hoa_cau_thuat')!)
    manager.add(skill)

    // Phap Tu Reimagined: the chain-era tam_muoi_tan_diem spec is gone;
    // the hoa_tan_diem basic-lane spec keeps an identical AoE override
    // (square radius 1, value 0.9, hoa_an chance 0.45).
    skillSystem.selectSpecialization(skill.id, 'hoa_tan_diem')

    const effective = skillSystem.getEffectiveSkill(manager.get(skill.id)!)
    const turnSkill = toTurnSkillDefinition(manager.get(skill.id)!, effective)

    expect(turnSkill.targeting).toEqual({ shape: 'square', laneRadius: 1 })
    if (turnSkill.damage && turnSkill.damage.kind === 'elemental') {
      expect(turnSkill.damage.multiplier).toBeCloseTo(0.9, 5)
    }
    expect(turnSkill.appliesAilment).toEqual({ buffDefinitionId: 'hoa_an', chance: 0.45 })
  })

  it('maps an ultimate with consume-for-damage fields (Detonate/ward-burst)', () => {
    // Find an ultimate in SPELL_KIT_IDS with consumesAilmentId — fall back
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
        consumesAilmentId: 'hoa_an',
        damagePerStack: 40,
        consumesWardForDamage: true,
        damagePerWardPoint: 6,
        components: [{ kind: 'element', element: 'fire', ratio: 1 }],
      },
    ]
    manager.add(synthetic)

    const effective = skillSystem.getEffectiveSkill(synthetic)
    const turnSkill = toTurnSkillDefinition(synthetic, effective)

    expect(turnSkill.consumesAilmentId).toBe('hoa_an')
    expect(turnSkill.damagePerStack).toBe(40)
    expect(turnSkill.consumesWardForDamage).toBe(true)
    expect(turnSkill.damagePerWardPoint).toBe(6)
  })

  it('maps a mana-cost skill resource fields verbatim', () => {
    const manager = new SkillManager()
    const skillSystem = new SkillSystem(manager)
    // Phap Tu Reimagined: the mana-cost specials (Phap Trang windows)
    // are the surviving resourceType:'mana' active skills.
    const skill = structuredClone(SKILLS.find((s) => s.id === 'tam_muoi_chan_hoa')!)
    manager.add(skill)

    const effective = skillSystem.getEffectiveSkill(skill)
    const turnSkill = toTurnSkillDefinition(skill, effective)

    expect(turnSkill.resourceType).toBe(skill.resourceType)
    expect(turnSkill.resourceCost).toBe(skill.cost)
  })

  it('leaves damage.scaling undefined for a skill authoring no attributeScaling/manaScalingRatio', () => {
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

    it('converts earth self-buff special trong_nhac: targetScope self, no fake damage, appliesBuff', () => {
      const manager = new SkillManager()
      const skillSystem = new SkillSystem(manager)
      // Phap Tu Reimagined: dia_tru_thua_thien retired with the chain
      // kit; trong_nhac is the reimagined earth special (a pure Phap
      // Trang window with no baseline damage).
      const skill = structuredClone(SKILLS.find((s) => s.id === 'trong_nhac')!)
      manager.add(skill)

      const effective = skillSystem.getEffectiveSkill(skill)
      const turnSkill = toTurnSkillDefinition(skill, effective)

      expect(turnSkill.id).toBe('trong_nhac')
      expect(turnSkill.targetScope).toBe('self')
      expect(turnSkill.damage).toBeUndefined()
      expect(turnSkill.appliesBuffs).toEqual([{ definitionId: 'trong_nhac', target: 'self' }])
    })

    it('maps multiple debuffs into appliesAilments (synthetic — the two-debuff wood special retired)', () => {
      const manager = new SkillManager()
      const skillSystem = new SkillSystem(manager)
      // Phap Tu Reimagined: cau_mang_can_tri retired; no shipped skill
      // still authors two debuff effects, so the field-mapping is
      // pinned on a synthetic payload.
      const skill = structuredClone(SKILLS.find((s) => s.id === 'doc_chuong')!)
      skill.id = 'fixture_two_debuffs'
      skill.effects = [
        { type: 'debuff', buffId: 'troi_chan', ailmentChance: 0.8 },
        { type: 'debuff', buffId: 'doc_can', ailmentChance: 0.6 },
      ]
      manager.add(skill)

      const effective = skillSystem.getEffectiveSkill(skill)
      const turnSkill = toTurnSkillDefinition(skill, effective)

      expect(turnSkill.appliesAilments).toHaveLength(2)
      expect(turnSkill.appliesAilments).toContainEqual({ buffDefinitionId: 'troi_chan', chance: 0.8 })
      expect(turnSkill.appliesAilments).toContainEqual({ buffDefinitionId: 'doc_can', chance: 0.6 })
    })

    it('folds add_stack effect into ailment stacks count (synthetic)', () => {
      const manager = new SkillManager()
      const skillSystem = new SkillSystem(manager)
      // Phap Tu Reimagined: tam_muoi_tu_diem retired; synthetic clone
      // keeps the debuff + add_stack fold pinned.
      const skill = structuredClone(SKILLS.find((s) => s.id === 'hoa_cau_thuat')!)
      skill.id = 'fixture_add_stack'
      skill.effects = [
        { type: 'debuff', buffId: 'hoa_an', ailmentChance: 1 },
        { type: 'add_stack', buffId: 'hoa_an', stacks: 1 },
      ]
      manager.add(skill)

      const effective = skillSystem.getEffectiveSkill(skill)
      const turnSkill = toTurnSkillDefinition(skill, effective)

      // Debuff 1 stack + add_stack 1 stack = 2 stacks.
      const bongAilment = turnSkill.appliesAilments?.find((a) => a.buffDefinitionId === 'hoa_an')
      expect(bongAilment).toBeDefined()
      expect(bongAilment?.stacks).toBe(2)
    })

    it('maps healPercentOfDamage (synthetic — doc_vien_bao_can retired)', () => {
      const manager = new SkillManager()
      const skillSystem = new SkillSystem(manager)
      const skill = structuredClone(SKILLS.find((s) => s.id === 'doc_chuong')!)
      skill.id = 'fixture_leech'
      skill.effects = [
        {
          type: 'damage',
          value: 1,
          components: [{ kind: 'element', element: 'wood', ratio: 1 }],
          healPercentOfDamage: 0.4,
        },
      ]
      manager.add(skill)

      const effective = skillSystem.getEffectiveSkill(skill)
      const turnSkill = toTurnSkillDefinition(skill, effective)

      expect(turnSkill.healPercentOfDamage).toBe(0.4)
    })

    it('carries the authored buff duration override (synthetic — duong_linh_tuyen spec retired)', () => {
      const manager = new SkillManager()
      const skillSystem = new SkillSystem(manager)
      const skill = structuredClone(SKILLS.find((s) => s.id === 'thanh_tuyen_duong_linh')!)
      skill.id = 'fixture_duration_override'
      skill.effects = [{ type: 'buff', buffId: 'thanh_tuyen', duration: 8 }]
      manager.add(skill)

      const effective = skillSystem.getEffectiveSkill(manager.get(skill.id)!)
      const turnSkill = toTurnSkillDefinition(manager.get(skill.id)!, effective)

      // M10 (ARCH-008) - the authored duration:8 must survive
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
            { type: 'consumeResource', pool: 'breakGauge', amount: 1 },
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

      // Phap Tu Reimagined: van_moc_lan_doc retired; a synthetic
      // effects list keeps the unsupported-field report pinned (the
      // scope field is authored on the EFFECTIVE skill, like the
      // Mission C fixture below).
      const wood = structuredClone(SKILLS.find((s) => s.id === 'doc_chuong')!)
      manager.add(wood)

      const woodEffective = skillSystem.getEffectiveSkill(wood)
      woodEffective.effects = [
        { type: 'damage', scope: 'primary_target', value: 1 },
      ] as typeof woodEffective.effects

      const woodReport = collectUnsupportedSkillSemantics(wood, woodEffective)

      expect(woodReport).toContain('effect.scope')

      // A clean kit reports nothing.
      const tram = structuredClone(SKILLS.find((s) => s.id === 'tram')!)
      expect(collectUnsupportedSkillSemantics(tram, skillSystem.getEffectiveSkill(tram))).toEqual([])
    })

    it('Mission C Task 10d — effect.scope + effect.refresh are reported, not silently dropped', () => {
      const manager = new SkillManager()
      const skillSystem = new SkillSystem(manager)

      // Mirror the authored usages at PhapTuChainSkills.ts:475 (scope
      // 'primary_target') and :655 (add_stack refresh:true).
      const skill = structuredClone(SKILLS.find((s) => s.id === 'tam_muoi_chan_hoa')!)
      const effective = skillSystem.getEffectiveSkill(skill)
      effective.effects = [
        { type: 'damage', scope: 'primary_target', value: 1 },
        { type: 'add_stack', buffId: 'liet_thuong', stacks: 2, refresh: true },
      ] as typeof effective.effects

      const report = collectUnsupportedSkillSemantics(skill, effective)

      expect(report).toEqual(expect.arrayContaining(['effect.scope', 'effect.refresh']))
      expect(report).toHaveLength(2)
    })

    it('converts the An special da_phap_lien_tuyen: its placeholder damage survives the strict gate (P14 — a phap_tu_an save crashed startBattle)', () => {
      const manager = new SkillManager()
      const skillSystem = new SkillSystem(manager)
      const skill = structuredClone(SKILLS.find((s) => s.id === 'da_phap_lien_tuyen')!)
      manager.add(skill)

      const effective = skillSystem.getEffectiveSkill(skill)
      const turnSkill = toTurnSkillDefinition(skill, effective)

      expect(turnSkill.id).toBe('da_phap_lien_tuyen')
      expect(turnSkill.cooldownTurns).toBe(4)
      // Placeholder only — the composite pick + repeatCasts authored by
      // applyAnKitToSpecial replace the payload at declare time.
      expect(turnSkill.damage?.kind).toBe('primordial')
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
