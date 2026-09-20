import { describe, expect, it } from 'vitest'
import { toTurnSkillDefinition } from '../skilldef/LegacySkillAdapter'
import { PHAP_TU_KIT_IDS, SKILLS } from '../../data/skill/Skills'
import { ELEMENT_ORDER } from '../element/ElementLabels'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'

// R3 Verification Gate: Full reachable active skill inventory in beta.
// Every active skill reachable in the beta loop (Pháp Tu 5 chains × 3 slots +
// specializations, Kiếm Tu) must convert without errors or
// silent semantic degradation.

describe('R3: Reachable Beta Content Inventory Parity', () => {
  function createFresh() {
    const manager = new SkillManager()
    for (const s of SKILLS) {
      manager.add(structuredClone(s))
    }
    const skillSystem = new SkillSystem(manager)
    return { manager, skillSystem }
  }

  describe('Pháp Tu 5 Pure Chains (15 skills + specializations)', () => {
    for (const element of ELEMENT_ORDER) {
      const [basicId, specialId, ultimateId] = PHAP_TU_KIT_IDS[element]

      it(`converts ${element} chain: ${basicId}, ${specialId}, ${ultimateId}`, () => {
        const { manager, skillSystem } = createFresh()
        const basic = manager.get(basicId)!
        const special = manager.get(specialId)!
        const ultimate = manager.get(ultimateId)!

        expect(basic, `missing basic ${basicId}`).toBeDefined()
        expect(special, `missing special ${specialId}`).toBeDefined()
        expect(ultimate, `missing ultimate ${ultimateId}`).toBeDefined()

        const turnBasic = toTurnSkillDefinition(basic, skillSystem.getEffectiveSkill(basic))
        const turnSpecial = toTurnSkillDefinition(special, skillSystem.getEffectiveSkill(special))
        const turnUltimate = toTurnSkillDefinition(ultimate, skillSystem.getEffectiveSkill(ultimate))

        expect(turnBasic.id).toBe(basicId)
        expect(turnSpecial.id).toBe(specialId)
        expect(turnUltimate.id).toBe(ultimateId)
      })

      it(`converts all specializations of ${specialId} and ${ultimateId}`, () => {
        const { manager, skillSystem } = createFresh()
        const special = manager.get(specialId)!
        if (special.specializations) {
          for (const spec of special.specializations) {
            skillSystem.selectSpecialization(special.id, spec.id)
            const effective = skillSystem.getEffectiveSkill(manager.get(special.id)!)
            const turnSkill = toTurnSkillDefinition(manager.get(special.id)!, effective)
            expect(turnSkill.id).toBe(special.id)
          }
        }

        const ultimate = manager.get(ultimateId)!
        if (ultimate.specializations) {
          for (const spec of ultimate.specializations) {
            skillSystem.selectSpecialization(ultimate.id, spec.id)
            const effective = skillSystem.getEffectiveSkill(manager.get(ultimate.id)!)
            const turnSkill = toTurnSkillDefinition(manager.get(ultimate.id)!, effective)
            expect(turnSkill.id).toBe(ultimate.id)
          }
        }
      })
    }
  })

  describe('Key semantic invariants across inventory', () => {
    it('Water special (thanh_tuyen_duong_linh) is pure self-buff', () => {
      const { manager, skillSystem } = createFresh()
      const skill = manager.get('thanh_tuyen_duong_linh')!
      const effective = skillSystem.getEffectiveSkill(skill)
      const turnSkill = toTurnSkillDefinition(skill, effective)

      expect(turnSkill.targetScope).toBe('self')
      expect(turnSkill.damage).toBeUndefined()
      expect(turnSkill.appliesBuffs?.[0]?.definitionId).toBe('thanh_tuyen')
      expect(turnSkill.appliesBuffs?.[0]?.target).toBe('self')
    })

    it('Earth special (dia_tru_thua_thien) is pure self-buff', () => {
      const { manager, skillSystem } = createFresh()
      const skill = manager.get('dia_tru_thua_thien')!
      const effective = skillSystem.getEffectiveSkill(skill)
      const turnSkill = toTurnSkillDefinition(skill, effective)

      expect(turnSkill.targetScope).toBe('self')
      expect(turnSkill.damage).toBeUndefined()
      expect(turnSkill.appliesBuffs?.[0]?.definitionId).toBe('dia_tru')
      expect(turnSkill.appliesBuffs?.[0]?.target).toBe('self')
    })

    it('Wood special (cau_mang_can_tri) preserves both debuffs (troi_chan and trung_doc)', () => {
      const { manager, skillSystem } = createFresh()
      const skill = manager.get('cau_mang_can_tri')!
      const effective = skillSystem.getEffectiveSkill(skill)
      const turnSkill = toTurnSkillDefinition(skill, effective)

      expect(turnSkill.appliesAilments).toHaveLength(2)
      const ids = turnSkill.appliesAilments?.map((a) => a.buffDefinitionId)
      expect(ids).toContain('troi_chan')
      expect(ids).toContain('doc_can')
    })

    it('Wood ultimate (doc_vien_bao_can) preserves leech healing and poison consume', () => {
      const { manager, skillSystem } = createFresh()
      const skill = manager.get('doc_vien_bao_can')!
      const effective = skillSystem.getEffectiveSkill(skill)
      const turnSkill = toTurnSkillDefinition(skill, effective)

      expect(turnSkill.healPercentOfDamage).toBe(0.4)
      expect(turnSkill.consumesAilmentId).toBe('doc_can')
      expect(turnSkill.damagePerStack).toBe(30)
    })

    it('Fire special specialization (Tam Muội Tụ Diễm) stacks bong twice', () => {
      const { manager, skillSystem } = createFresh()
      const skill = manager.get('tam_muoi_chan_hoa')!
      skillSystem.selectSpecialization(skill.id, 'tam_muoi_tu_diem')
      const effective = skillSystem.getEffectiveSkill(manager.get(skill.id)!)
      const turnSkill = toTurnSkillDefinition(manager.get(skill.id)!, effective)

      const bong = turnSkill.appliesAilments?.find((a) => a.buffDefinitionId === 'hoa_an')
      expect(bong?.stacks).toBe(2)
    })
  })



})
