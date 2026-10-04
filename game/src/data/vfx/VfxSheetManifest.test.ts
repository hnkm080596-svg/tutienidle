import { describe, expect, it } from 'vitest'
import { COMBAT_VFX_PRESETS } from './CombatVfxPresets'
import { VFX_SHEET_BINDINGS, vfxSheetCombatDescriptors } from './VfxSheetManifest'
import { BETA_ENEMY_ROSTER } from '../../core/betaScope'
import { ENEMIES } from '../enemy/Enemies'

// Monster attack VFX sweep (2026-10-04) - manifest invariants: bindings
// only reference declared presets, playback windows stay inside the
// recipe-validation bounds, and emitted descriptors dedupe to one atlas
// load per sheet.
describe('VfxSheetManifest (Monster attack VFX sweep)', () => {
  it('binds only declared CombatVfxPresetIds', () => {
    for (const presetId of Object.keys(VFX_SHEET_BINDINGS)) {
      expect(COMBAT_VFX_PRESETS[presetId as keyof typeof COMBAT_VFX_PRESETS]).toBeDefined()
    }
  })

  it('keeps every binding inside the recipe cue bounds', () => {
    for (const binding of Object.values(VFX_SHEET_BINDINGS)) {
      expect(binding.firstFrame).toBeGreaterThanOrEqual(0)
      expect(binding.lastFrame).toBeGreaterThanOrEqual(binding.firstFrame)
      expect(binding.lastFrame).toBeLessThanOrEqual(9999)
      expect(binding.fps).toBeGreaterThanOrEqual(1)
      expect(binding.fps).toBeLessThanOrEqual(120)
      expect(binding.fitPx).toBeGreaterThanOrEqual(8)
      expect(binding.fitPx).toBeLessThanOrEqual(640)
      // The injected sheet cue's duration must fit the 1500ms phase bound
      // enforced by validateSkillRecipe.
      const durationMs = ((binding.lastFrame - binding.firstFrame + 1) * 1000) / binding.fps
      expect(durationMs).toBeLessThanOrEqual(1500)
    }
  })

  it('emits one unique atlas descriptor per binding', () => {
    const descriptors = vfxSheetCombatDescriptors()
    const keys = descriptors.map(d => d.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const descriptor of descriptors) {
      expect(descriptor.kind).toBe('atlas')
      expect(descriptor.textureUrl.endsWith('.png')).toBe(true)
      expect(descriptor.atlasUrl.endsWith('.json')).toBe(true)
    }
  })

  // The sweep's delivery contract: every beta-reachable enemy basic attack
  // resolves a bound preset, so no roster monster renders the generic
  // arcane_impact fallback.
  it('gives every beta-roster enemy a bound attack preset', () => {
    const byId = new Map(ENEMIES.map(enemy => [enemy.id, enemy]))
    for (const entry of BETA_ENEMY_ROSTER) {
      const enemy = byId.get(entry.id)
      expect(enemy, `roster enemy ${entry.id} missing`).toBeDefined()
      expect(enemy!.attackPresetId, `${entry.id} missing attackPresetId`).toBeDefined()
      expect(VFX_SHEET_BINDINGS[enemy!.attackPresetId!], `${entry.id} preset ${enemy!.attackPresetId} has no sheet binding`).toBeDefined()
    }
  })
})
