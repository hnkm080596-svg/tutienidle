import { describe, expect, it } from 'vitest'
import { BASIC_ATTACKS_BY_BUILD, REQUIRED_BUILD_IDS, THUY_GIAP_LONG_WATER_SURGE } from './TurnBasicAttacks'

// Structural completeness (plan Task 5 Step 4): mọi build có basic attack
// mapping; mọi mapping có shape TurnSkillDefinition hợp lệ.
describe('TurnBasicAttacks structural completeness', () => {
  it('every one of the 8 builds has a mapped basic entry', () => {
    for (const buildId of REQUIRED_BUILD_IDS) {
      const basic = BASIC_ATTACKS_BY_BUILD[buildId]
      expect(basic, `build ${buildId} missing basic mapping`).toBeDefined()
      expect(basic!.id.length).toBeGreaterThan(0)
      expect(basic!.cooldownTurns).toBe(0)
      expect(basic!.damage).toBeDefined()
      expect(basic!.targeting.shape).toBe('single')
    }
  })

  it('Kiếm Tu basic is tram, 5 Pháp Tu basics are the element chain starters', () => {
    expect(BASIC_ATTACKS_BY_BUILD.kiem_tu!.id).toBe('tram')
    expect(BASIC_ATTACKS_BY_BUILD.phap_tu_fire!.id).toBe('hoa_cau_thuat')
    expect(BASIC_ATTACKS_BY_BUILD.phap_tu_water!.id).toBe('thuy_tien_thuat')
    expect(BASIC_ATTACKS_BY_BUILD.phap_tu_wood!.id).toBe('doc_chuong')
    expect(BASIC_ATTACKS_BY_BUILD.phap_tu_metal!.id).toBe('diem_kim_thuat')
    expect(BASIC_ATTACKS_BY_BUILD.phap_tu_earth!.id).toBe('tho_cau_thuat')
    expect(BASIC_ATTACKS_BY_BUILD.the_tu!.id).toBe('generic_physical')
    expect(BASIC_ATTACKS_BY_BUILD.pham_nhan!.id).toBe('generic_physical')
  })

  it('5 Pháp Tu element basics carry the correct elemental component', () => {
    expect(BASIC_ATTACKS_BY_BUILD.phap_tu_fire!.damage).toEqual({ kind: 'elemental', components: [{ kind: 'element', element: 'fire', ratio: 1 }], multiplier: 1 })
    expect(BASIC_ATTACKS_BY_BUILD.phap_tu_water!.damage).toEqual({ kind: 'elemental', components: [{ kind: 'element', element: 'water', ratio: 1 }], multiplier: 1 })
    expect(BASIC_ATTACKS_BY_BUILD.phap_tu_wood!.damage).toEqual({ kind: 'elemental', components: [{ kind: 'element', element: 'wood', ratio: 1 }], multiplier: 1 })
    expect(BASIC_ATTACKS_BY_BUILD.phap_tu_metal!.damage).toEqual({ kind: 'elemental', components: [{ kind: 'element', element: 'metal', ratio: 1 }], multiplier: 1 })
    expect(BASIC_ATTACKS_BY_BUILD.phap_tu_earth!.damage).toEqual({ kind: 'elemental', components: [{ kind: 'element', element: 'earth', ratio: 1 }], multiplier: 1 })
  })

  it('Thủy Giáp Long water surge: physical x2.5 single-target (matches EnemySpecialAttack data)', () => {
    expect(THUY_GIAP_LONG_WATER_SURGE.damage).toEqual({ kind: 'physical', multiplier: 2.5 })
  })
})
