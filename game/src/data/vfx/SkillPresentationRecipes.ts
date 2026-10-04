import type { CombatVfxPresetId } from '@/core/battle/CombatAction'
import type { SkillPresentationRecipe, SkillCue } from '@/presentation/skills/SkillPresentationRecipe'
import { COMBAT_VFX_PRESETS, type CombatVfxPreset } from './CombatVfxPresets'
import { VFX_SHEET_BINDINGS } from './VfxSheetManifest'

// Restored actor lunge (design section 9 "actor impulse + signature stroke"):
// the tuned values moved here from combatConstants ATTACK_LUNGE_* (2026-09-07
// playtest) - the recipe layer owns them now that the cue-driven impulse is
// the only consumer.
const ACTOR_IMPULSE_PX = 8
const ACTOR_IMPULSE_MAX_MS = 350

export const PHI_KIEM_RECIPE: SkillPresentationRecipe = {
  id: 'ngu_kiem_flight', version: 1, color: 0xaeeaff,
  castMs: 370, impactMs: 80, recoveryMs: 170,
  cast: [{ primitive: 'trajectory', anchor: 'target', shape: 'blade', offsetMs: 0, durationMs: 370,
    bend: -52, releaseMs: 120, cruiseMs: 180, accelerationMs: 70 }],
  impact: [
    { primitive: 'stroke', anchor: 'targets', shape: 'slash', offsetMs: 0, durationMs: 80 },
    { primitive: 'burst', anchor: 'targets', shape: 'sparks', offsetMs: 0, durationMs: 80, count: 12 },
  ],
  recovery: [{ primitive: 'trajectory', anchor: 'source', shape: 'blade', offsetMs: 0, durationMs: 170, recall: true, bend: 74 }],
}
const recipes = new Map<CombatVfxPresetId, SkillPresentationRecipe>()
for (const preset of Object.values(COMBAT_VFX_PRESETS) as CombatVfxPreset[]) {
  const aura = preset.id === 'holy_radiance'
  const ground = preset.space === 'ground_projected' || preset.space === 'screen'
  const burst = preset.space === 'hybrid'
  // Scoped to upright + the arcane_impact fallback (OQ1): hybrid and ground
  // presets keep a static cast until a melee/ranged discriminator exists.
  const impulse = preset.space === 'upright' || preset.id === 'arcane_impact'
  const castMs = aura ? 220 : ground || burst ? 260 : 180
  // Monster attack VFX sweep (2026-10-04) - a bound spritesheet plays as a
  // 'sheet' cue inside the impact phase alongside the analytic primitives
  // (the primitives stay as the procedural fallback for missing textures /
  // unbound presets). The impact phase extends to cover the sheet window's
  // playback so the whole clip runs inside the recipe bounds.
  const sheet = VFX_SHEET_BINDINGS[preset.id]
  const sheetMs = sheet ? Math.ceil(((sheet.lastFrame - sheet.firstFrame + 1) * 1000) / sheet.fps) : 0
  const impactMs = Math.max(preset.durationMs, sheetMs)
  const sheetCue: SkillCue[] = sheet ? [{
    primitive: 'sheet' as const, anchor: 'targets' as const, shape: 'sheet' as const,
    offsetMs: 0, durationMs: sheetMs,
    sheetKey: sheet.sheetKey, firstFrame: sheet.firstFrame, lastFrame: sheet.lastFrame,
    fps: sheet.fps, fitPx: sheet.fitPx, grounded: sheet.grounded,
  }] : []
  recipes.set(preset.id, {
    id: preset.id, version: 1, color: preset.color,
    castMs,
    impactMs, recoveryMs: 80,
    cast: [
      ...(impulse ? [{ primitive: 'actor-impulse' as const, anchor: 'source' as const,
        shape: 'impulse' as const, offsetMs: 0,
        durationMs: Math.min(ACTOR_IMPULSE_MAX_MS, castMs), impulsePx: ACTOR_IMPULSE_PX }] : []),
      { primitive: 'aura' as const, anchor: 'source' as const, shape: 'ring' as const,
        offsetMs: 0, durationMs: castMs },
    ],
    impact: [
      ...sheetCue,
      { primitive: aura ? 'aura' : ground ? 'ground-shape' : burst ? 'burst' : 'stroke',
        anchor: 'targets', shape: aura || ground ? 'ring' : burst ? 'sparks' : 'slash',
        offsetMs: 0, durationMs: preset.durationMs, count: 12 },
      // Authored shake migrates to an impact camera-cue; authored precedence in
      // the driver suppresses the generic landed-hit impulse for that action.
      ...(preset.screenShake ? [{ primitive: 'camera-cue' as const, anchor: 'source' as const,
        shape: 'camera' as const, offsetMs: 0, durationMs: preset.screenShake.durationMs,
        intensity: preset.screenShake.intensity }] : []),
    ],
    recovery: [],
  })
}
recipes.set('ngu_kiem_flight', PHI_KIEM_RECIPE)
// Fireball portal/charge/projectile/impact imagery is owned by the dedicated
// Phaser presentation. Keep this recipe timing-only for the runner's impact ACK.
recipes.set('hoa_cau_comet', {
  id: 'hoa_cau_comet', version: 1, color: 0xff7125,
  castMs: 1450, impactMs: 900, recoveryMs: 0,
  cast: [], impact: [], recovery: [],
})
// Same contract for the Tam Muoi self-buff cast: the aura layers + ignite
// are drawn by TamMuoiAuraPresentation, so this recipe stays timing-only
// for the runner's impact ACK (the played clip's marker supplies castMs).
recipes.set('tam_muoi_aura', {
  id: 'tam_muoi_aura', version: 1, color: 0xff8c42,
  castMs: 1450, impactMs: 400, recoveryMs: 0,
  cast: [], impact: [], recovery: [],
})
/** Existing skills migrate by preset; a new skill can supply its own data recipe. */
export function getSkillPresentationRecipe(id: CombatVfxPresetId): SkillPresentationRecipe {
  return recipes.get(id) ?? recipes.get('slash')!
}
