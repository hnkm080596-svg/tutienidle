import { describe, expect, it } from 'vitest'
import { COMBAT_VFX_PRESETS } from './CombatVfxPresets'
import { NGU_KIEM_THUAT } from '@/data/skill/NguKiemDaoSkills'
import { getSkillPresentationRecipe } from './SkillPresentationRecipes'
import { validateSkillRecipe } from '@/presentation/skills/SkillPresentationRecipe'
describe('authored skill presentation recipes', () => {
  it('leaves Hỏa Cầu imagery solely to its atlas presentation', () => {
    const recipe = getSkillPresentationRecipe('hoa_cau_comet')
    expect(recipe.cast).toEqual([])
    expect(recipe.impact).toEqual([])
    expect(recipe.recovery).toEqual([])
    expect(recipe.castMs).toBe(1450)
  })
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
  it('restores the cast-phase actor impulse on upright presets and the arcane_impact fallback', () => {
    for (const id of ['slash', 'claw', 'metal_slash', 'lightning_strike', 'wind_blade', 'arcane_impact'] as const) {
      const recipe = getSkillPresentationRecipe(id)
      const cue = recipe.cast.find(c => c.primitive === 'actor-impulse')
      expect(cue).toMatchObject({ anchor: 'source', shape: 'impulse', offsetMs: 0, impulsePx: 8 })
      expect(cue!.durationMs).toBeLessThanOrEqual(recipe.castMs)
    }
  })
  it('keeps Phi Kiem authored and non-impulse recipes free of actor motion', () => {
    expect(getSkillPresentationRecipe('ngu_kiem_flight').cast.every(c => c.primitive !== 'actor-impulse')).toBe(true)
    expect(getSkillPresentationRecipe('boss_ground_slam').cast.every(c => c.primitive !== 'actor-impulse')).toBe(true)
  })
  it('plays the Linh Bao Arcadia burst at the landed targets on the impact beat', () => {
    const recipe = getSkillPresentationRecipe('linh_bao_burst')
    expect([recipe.castMs, recipe.impactMs, recipe.recoveryMs]).toEqual([260, 550, 0])
    expect(recipe.cast).toEqual([
      { primitive: 'aura', anchor: 'source', shape: 'ring', offsetMs: 0, durationMs: 260 }])
    expect(recipe.impact).toContainEqual(expect.objectContaining({
      primitive: 'atlas', anchor: 'targets', shape: 'explosion',
      offsetMs: 0, durationMs: 550,
      atlas: { key: 'linh-bao-burst', frames: 12, scale: 1 } }))
    expect(recipe.impact).toContainEqual(expect.objectContaining({
      primitive: 'camera-cue', anchor: 'source', shape: 'camera',
      offsetMs: 0, durationMs: 90, intensity: 0.003 }))
  })
  it('rejects malformed atlas cue payloads', () => {
    const recipe = getSkillPresentationRecipe('slash')
    const base = { primitive: 'atlas' as const, anchor: 'targets' as const,
      shape: 'explosion' as const, offsetMs: 0, durationMs: 100 }
    for (const atlas of [undefined, { key: '', frames: 4 }, { key: 'k', frames: 0 },
      { key: 'k', frames: 65 }, { key: 'k', frames: 1.5 }, { key: 'k', frames: 4, scale: 0 },
      { key: 'k', frames: 4, scale: 9 }])
      expect(() => validateSkillRecipe({ ...recipe, impact: [{ ...base, atlas }] })).toThrow()
    // An atlas payload on a non-atlas primitive is a recipe bug too.
    expect(() => validateSkillRecipe({ ...recipe, impact: [{ primitive: 'burst' as const,
      anchor: 'targets' as const, shape: 'sparks' as const, offsetMs: 0, durationMs: 100,
      atlas: { key: 'k', frames: 4 } }] })).toThrow()
  })
  it('migrates authored screenShake to an impact camera-cue', () => {
    const slam = getSkillPresentationRecipe('boss_ground_slam')
    expect(slam.impact).toContainEqual(expect.objectContaining({
      primitive: 'camera-cue', anchor: 'source', shape: 'camera',
      offsetMs: 0, durationMs: 120, intensity: 0.004 }))
    const combo = getSkillPresentationRecipe('kiem_combo_ngu_hanh_kiem')
    expect(combo.impact).toContainEqual(expect.objectContaining({
      primitive: 'camera-cue', durationMs: 140, intensity: 0.005 }))
    expect(getSkillPresentationRecipe('slash').impact.every(cue => cue.primitive !== 'camera-cue')).toBe(true)
    expect(getSkillPresentationRecipe('ngu_kiem_flight').impact.every(cue => cue.primitive !== 'camera-cue')).toBe(true)
  })
  it('rejects out-of-range camera intensity', () => {
    const recipe = getSkillPresentationRecipe('slash')
    for (const intensity of [0, -0.001, 0.011, NaN, Infinity])
      expect(() => validateSkillRecipe({ ...recipe, impact: [{ primitive: 'camera-cue' as const,
        anchor: 'source' as const, shape: 'camera' as const, offsetMs: 0, durationMs: 100, intensity }] })).toThrow()
  })
  it('rejects out-of-range impulse data', () => {
    const recipe = getSkillPresentationRecipe('slash')
    for (const impulsePx of [0, -1, 65, NaN, Infinity])
      expect(() => validateSkillRecipe({ ...recipe, cast: [{ primitive: 'actor-impulse' as const,
        anchor: 'source' as const, shape: 'impulse' as const, offsetMs: 0, durationMs: 100, impulsePx }] })).toThrow()
  })
  it('rejects one-shot primitives placed in a phase whose context cannot serve them', () => {
    const recipe = getSkillPresentationRecipe('slash')
    const impulse = { primitive: 'actor-impulse' as const, anchor: 'source' as const,
      shape: 'impulse' as const, offsetMs: 0, durationMs: 100, impulsePx: 8 }
    // actor-impulse reads context.cast, which only exists during cast playback.
    expect(() => validateSkillRecipe({ ...recipe, impact: [impulse] })).toThrow()
    expect(() => validateSkillRecipe({ ...recipe, recovery: [impulse] })).toThrow()
    const camera = { primitive: 'camera-cue' as const, anchor: 'source' as const,
      shape: 'camera' as const, offsetMs: 0, durationMs: 100, intensity: 0.005 }
    // camera-cue reads group/primaryLanded, which only exist during resolved playback.
    expect(() => validateSkillRecipe({ ...recipe, cast: [camera] })).toThrow()
  })
  it('rejects unbounded and non-finite recipe data', () => {
    const recipe = getSkillPresentationRecipe('slash')
    for (const castMs of [NaN, Infinity, -1, 1501])
      expect(() => validateSkillRecipe({ ...recipe, castMs })).toThrow()
    expect(() => validateSkillRecipe({ ...recipe, cast: [{ primitive: 'burst', shape: 'sparks',
      anchor: 'target', offsetMs: 0, durationMs: 100, count: 999 }] })).toThrow()
  })
})
