import { describe, expect, it } from 'vitest'
import { BASIC_ATTACKS_BY_BUILD, REQUIRED_BUILD_IDS, THUY_GIAP_LONG_WATER_SURGE, GENERIC_PHYSICAL_BASIC, enemyBasicAttackFor } from './TurnBasicAttacks'

// Structural completeness (plan Task 5 Step 4): moi build co basic attack
// mapping; moi mapping co shape TurnSkillDefinition hop le.
describe('TurnBasicAttacks structural completeness', () => {
  it('every statically-authored build has a mapped basic entry', () => {
    for (const buildId of REQUIRED_BUILD_IDS) {
      const basic = BASIC_ATTACKS_BY_BUILD[buildId]
      expect(basic, `build ${buildId} missing basic mapping`).toBeDefined()
      expect(basic!.id.length).toBeGreaterThan(0)
      expect(basic!.cooldownTurns).toBe(0)
      expect(basic!.damage).toBeDefined()
      expect(basic!.targeting.shape).toBe('single')
    }
  })

  it('only builds authored as static TurnSkillDefinitions live in the map — Phap Tu converts canonically', () => {
    expect(BASIC_ATTACKS_BY_BUILD.sword!.id).toBe('tram')
    // Mortal players carry no cultivationPath - the dead 'pham_nhan' key
    // was unreachable and only ever mapped to GENERIC_PHYSICAL_BASIC.
    expect('pham_nhan' in BASIC_ATTACKS_BY_BUILD).toBe(false)

    // No spell/body entries: spell basics convert from the authored
    // Skill at battle build (fail-fast on rejection - no static
    // substitute); body ways resolve their kit at battle build and fall
    // back to GENERIC_PHYSICAL_BASIC directly (M7 removed the dead row).
    for (const key of Object.keys(BASIC_ATTACKS_BY_BUILD)) {
      expect(key.startsWith('spell')).toBe(false)
      expect(key.startsWith('body')).toBe(false)
    }
  })

  it('Thủy Giáp Long water surge: physical x2.5 single-target (matches EnemySpecialAttack data)', () => {
    expect(THUY_GIAP_LONG_WATER_SURGE.damage).toEqual({ kind: 'physical', multiplier: 2.5 })
  })
})

// Monster attack VFX sweep (2026-10-04) - the enemy basic def carries the
// authored attackPresetId so presentation reads a real preset instead of
// the arcane_impact fallback.
describe('enemyBasicAttackFor (Monster attack VFX sweep)', () => {
  it('stamps the authored attackPresetId onto the shared generic basic', () => {
    const basic = enemyBasicAttackFor({ attackPresetId: 'claw' })
    expect(basic.id).toBe('generic_physical')
    expect(basic.presetId).toBe('claw')
    expect(basic.damage).toEqual(GENERIC_PHYSICAL_BASIC.damage)
  })

  it('returns the untouched generic basic when no preset is authored', () => {
    expect(enemyBasicAttackFor({})).toBe(GENERIC_PHYSICAL_BASIC)
    expect(enemyBasicAttackFor({ attackPresetId: undefined })).toBe(GENERIC_PHYSICAL_BASIC)
  })
})
