import { describe, expect, it } from 'vitest'
import { CHAIN_SKILL_IDS, SKILLS } from './Skills'
import { ELEMENT_ORDER } from '../../core/element/ElementLabels'

// Spec 2026-08-30-phap-tu-dao-sac §2.2 — 5 chuỗi thần SHK, mỗi hành
// root A (skill hiện có) + 4 skill mới B/C/D/E. Data validation pattern
// test data hiện có: id duy nhất, type active, có effects.
describe('Data 5 chuỗi thần thoại (spec §2.2)', () => {
  it('CHAIN_SKILL_IDS đủ 5 hành × 5 slot', () => {
    expect(Object.keys(CHAIN_SKILL_IDS).sort()).toEqual([...ELEMENT_ORDER].sort())

    for (const element of ELEMENT_ORDER) {
      expect(CHAIN_SKILL_IDS[element]).toHaveLength(5)
    }
  })

  it('A là root hiện có của hành (đã tồn tại trước redesign)', () => {
    expect(CHAIN_SKILL_IDS.fire[0]).toBe('hoa_cau_thuat')
    expect(CHAIN_SKILL_IDS.water[0]).toBe('thuy_tien_thuat')
    expect(CHAIN_SKILL_IDS.wood[0]).toBe('doc_chuong')
    expect(CHAIN_SKILL_IDS.metal[0]).toBe('diem_kim_thuat')
    expect(CHAIN_SKILL_IDS.earth[0]).toBe('tho_cau_thuat')
  })

  it('20 skill mới B–E: có trong SKILLS, active, có effects', () => {
    for (const element of ELEMENT_ORDER) {
      for (const skillId of CHAIN_SKILL_IDS[element].slice(1)) {
        const skill = SKILLS.find(s => s.id === skillId)

        expect(skill, `thiếu skill ${skillId}`).toBeDefined()
        expect(skill!.type).toBe('active')
        expect(skill!.effects.length).toBeGreaterThan(0)
        expect(skill!.execution).toBeDefined()
      }
    }
  })

  it('mọi id skill trong SKILLS là duy nhất', () => {
    const allIds = SKILLS.map(s => s.id)

    expect(new Set(allIds).size).toBe(allIds.length)
  })

  it('skill mới KHÔNG unlocked mặc định (phải mua qua node chuỗi)', () => {
    for (const element of ELEMENT_ORDER) {
      for (const skillId of CHAIN_SKILL_IDS[element].slice(1)) {
        const skill = SKILLS.find(s => s.id === skillId)

        expect(skill!.unlocked).toBe(false)
        expect(skill!.equipped).toBe(false)
      }
    }
  })

  it('element component khớp hành của chuỗi', () => {
    const elementByChain: Record<string, string> = {
      fire: 'fire',
      water: 'water',
      wood: 'wood',
      metal: 'metal',
      earth: 'earth',
    }

    for (const [chainKey, chain] of Object.entries(CHAIN_SKILL_IDS)) {
      for (const skillId of chain) {
        const skill = SKILLS.find(s => s.id === skillId)

        for (const effect of skill?.effects ?? []) {
          for (const component of effect.components ?? []) {
            if (component.kind === 'element') {
              expect(component.element).toBe(elementByChain[chainKey])
            }
          }
        }
      }
    }
  })
})
