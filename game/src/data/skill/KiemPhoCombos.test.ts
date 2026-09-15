import { describe, expect, it } from 'vitest'
import { KIEM_PHO_COMBOS } from './KiemPhoCombos'
import { COMBAT_VFX_PRESETS } from '../vfx/CombatVfxPresets'
import type { OrbId } from '../../core/kiem-tu/KiemTuState'

// Kiem Tu Reimagined Task 5 — data invariants for the 37-combo table
// (spec 2026-09-15 §4.3, K10/K11): exact pattern set, SUFFIX-free
// against the tail matcher, unique presetId per combo (the payload is
// the ONLY discovery signal).

const VALID_ORBS = new Set<OrbId>(['orb_dam', 'orb_chem', 'orb_bo', 'orb_hat', 'orb_quet'])

describe('KIEM_PHO_COMBOS table', () => {
  it('exactly 37 combos: 15 len-3, 12 len-4, 10 len-5', () => {
    expect(KIEM_PHO_COMBOS).toHaveLength(37)
    const byLen = (n: number) => KIEM_PHO_COMBOS.filter(c => c.pattern.length === n)
    expect(byLen(3)).toHaveLength(15)
    expect(byLen(4)).toHaveLength(12)
    expect(byLen(5)).toHaveLength(10)
  })

  it('every combo has a unique id and unique presetId (K11)', () => {
    const ids = KIEM_PHO_COMBOS.map(c => c.id)
    const presets = KIEM_PHO_COMBOS.map(c => c.presetId)
    expect(new Set(ids).size).toBe(37)
    expect(new Set(presets).size).toBe(37)
  })

  it('every combo has a Vietnamese name (discovery readout)', () => {
    for (const combo of KIEM_PHO_COMBOS) {
      expect(combo.name.length).toBeGreaterThan(0)
    }
  })

  it('every pattern orb is a valid OrbId', () => {
    for (const combo of KIEM_PHO_COMBOS) {
      for (const orb of combo.pattern) {
        expect(VALID_ORBS.has(orb)).toBe(true)
      }
    }
  })

  it('every pattern length is 3..5', () => {
    for (const combo of KIEM_PHO_COMBOS) {
      expect(combo.pattern.length).toBeGreaterThanOrEqual(3)
      expect(combo.pattern.length).toBeLessThanOrEqual(5)
    }
  })

  it('SUFFIX-free: no shorter pattern equals the tail of a longer pattern', () => {
    // The matcher is a TAIL matcher — the real collision class is a
    // shorter combo pattern appearing as the last-k entries of a longer
    // one. Without this property the same input sequence would change
    // meaning after a realm breakthrough (K10).
    const sorted = [...KIEM_PHO_COMBOS].sort((a, b) => a.pattern.length - b.pattern.length)
    for (const shorter of sorted) {
      for (const longer of sorted) {
        if (longer.pattern.length <= shorter.pattern.length) continue
        const tail = longer.pattern.slice(-shorter.pattern.length)
        expect(tail, `${longer.id} tail-${shorter.pattern.length} collides with ${shorter.id}`)
          .not.toEqual(shorter.pattern)
      }
    }
  })

  it('no duplicate patterns', () => {
    const seen = new Set<string>()
    for (const combo of KIEM_PHO_COMBOS) {
      const key = combo.pattern.join(',')
      expect(seen.has(key), `duplicate pattern ${key}`).toBe(false)
      seen.add(key)
    }
  })

  it('every presetId resolves to a COMBAT_VFX_PRESETS entry', () => {
    // The `as CombatVfxPresetId` construction in the table would compile
    // even for a mistyped id; registry membership is the real guard —
    // a missing entry silently degrades the K11 discovery VFX.
    for (const combo of KIEM_PHO_COMBOS) {
      expect(
        Object.hasOwn(COMBAT_VFX_PRESETS, combo.presetId),
        `presetId ${combo.presetId} missing from COMBAT_VFX_PRESETS`,
      ).toBe(true)
    }
  })
})
