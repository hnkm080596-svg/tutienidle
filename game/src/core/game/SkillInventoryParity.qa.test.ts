import { describe, expect, it } from 'vitest'
import { toTurnSkillDefinition } from '../skilldef/LegacySkillAdapter'
import { SPELL_KIT_IDS, SKILLS } from '../../data/skill/Skills'
import { ELEMENT_ORDER } from '../element/ElementLabels'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'

// R3 Verification Gate: Full reachable active skill inventory in beta.
// Every active skill reachable in the beta loop (Phap Tu 5 element kits
// x {basic, special} + specializations, Kiem Tu) must convert without
// errors or silent semantic degradation.

describe('R3: Reachable Beta Content Inventory Parity', () => {
  function createFresh() {
    const manager = new SkillManager()
    for (const s of SKILLS) {
      manager.add(structuredClone(s))
    }
    const skillSystem = new SkillSystem(manager)
    return { manager, skillSystem }
  }

  describe('Pháp Tu 5 Element Kits (basic + special)', () => {
    for (const element of ELEMENT_ORDER) {
      const [basicId, specialId] = SPELL_KIT_IDS[element]

      it(`converts ${element} kit: ${basicId}, ${specialId}`, () => {
        const { manager, skillSystem } = createFresh()
        const basic = manager.get(basicId)!
        const special = manager.get(specialId)!

        expect(basic, `missing basic ${basicId}`).toBeDefined()
        expect(special, `missing special ${specialId}`).toBeDefined()

        const turnBasic = toTurnSkillDefinition(basic, skillSystem.getEffectiveSkill(basic))
        const turnSpecial = toTurnSkillDefinition(special, skillSystem.getEffectiveSkill(special))

        expect(turnBasic.id).toBe(basicId)
        expect(turnSpecial.id).toBe(specialId)
      })

      it(`converts all specializations of ${specialId}`, () => {
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

    it('all five specials are self-buff Trang windows (no baseline damage)', () => {
      const { manager, skillSystem } = createFresh()
      for (const element of ELEMENT_ORDER) {
        const [, specialId] = SPELL_KIT_IDS[element]
        const skill = manager.get(specialId)!
        const effective = skillSystem.getEffectiveSkill(skill)
        const turnSkill = toTurnSkillDefinition(skill, effective)

        expect(turnSkill.targetScope).toBe('self')
        expect(turnSkill.damage).toBeUndefined()
        expect(turnSkill.appliesBuffs?.[0]?.target).toBe('self')
        // The %MaxLL cost is stamped by the resolve seam, not the raw
        // converter; the authored def is resourceType 'mana' + flat-less.
        expect(skill.resourceType).toBe('mana')
        expect(skill.cost).toBeUndefined()
      }
    })
  })
})
