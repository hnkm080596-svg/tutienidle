import { describe, expect, it } from 'vitest'
import { COMBAT_VFX_PRESETS } from './CombatVfxPresets'
import { NGU_KIEM_THUAT } from '@/data/skill/NguKiemDaoSkills'
import { getSkillPresentationRecipe } from './SkillPresentationRecipes'
import { validateSkillRecipe } from '@/presentation/skills/SkillPresentationRecipe'
describe('authored skill presentation recipes', () => {
  it('registers every existing preset in the shared recipe system', () => {
    for (const preset of Object.values(COMBAT_VFX_PRESETS))
      expect(() => validateSkillRecipe(getSkillPresentationRecipe(preset.id))).not.toThrow()
  })
  it('routes the production Ngu Kiem skill to the full flight sequence', () => {
    expect(NGU_KIEM_THUAT.presetId).toBe('ngu_kiem_flight')
    const recipe = getSkillPresentationRecipe(NGU_KIEM_THUAT.presetId!)
    expect([recipe.castMs, recipe.impactMs, recipe.recoveryMs]).toEqual([370, 80, 170])
    expect(recipe.cast.some(cue => cue.primitive === 'trajectory')).toBe(true)
    expect(recipe.recovery.some(cue => cue.recall)).toBe(true)
  })
  it('rejects unbounded and non-finite recipe data', () => {
    const recipe = getSkillPresentationRecipe('slash')
    for (const castMs of [NaN, Infinity, -1, 1501])
      expect(() => validateSkillRecipe({ ...recipe, castMs })).toThrow()
    expect(() => validateSkillRecipe({ ...recipe, cast: [{ primitive: 'burst', shape: 'sparks',
      anchor: 'target', offsetMs: 0, durationMs: 100, count: 999 }] })).toThrow()
  })
})
