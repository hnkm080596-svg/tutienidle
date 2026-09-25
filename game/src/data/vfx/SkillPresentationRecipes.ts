import type { CombatVfxPresetId } from '@/core/battle/CombatAction'
import type { SkillPresentationRecipe } from '@/presentation/skills/SkillPresentationRecipe'
import { COMBAT_VFX_PRESETS } from './CombatVfxPresets'

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
for (const preset of Object.values(COMBAT_VFX_PRESETS)) {
  const aura = preset.id === 'holy_radiance'
  const ground = preset.space === 'ground_projected' || preset.space === 'screen'
  const burst = preset.space === 'hybrid'
  recipes.set(preset.id, {
    id: preset.id, version: 1, color: preset.color,
    castMs: aura ? 220 : ground || burst ? 260 : 180,
    impactMs: preset.durationMs, recoveryMs: 80,
    cast: [{ primitive: 'aura', anchor: 'source', shape: 'ring', offsetMs: 0,
      durationMs: aura ? 220 : ground || burst ? 260 : 180 }],
    impact: [
      { primitive: aura ? 'aura' : ground ? 'ground-shape' : burst ? 'burst' : 'stroke',
        anchor: 'targets', shape: aura || ground ? 'ring' : burst ? 'sparks' : 'slash',
        offsetMs: 0, durationMs: preset.durationMs, count: 12 },
    ],
    recovery: [],
  })
}
recipes.set('ngu_kiem_flight', PHI_KIEM_RECIPE)
/** Existing skills migrate by preset; a new skill can supply its own data recipe. */
export function getSkillPresentationRecipe(id: CombatVfxPresetId): SkillPresentationRecipe {
  return recipes.get(id) ?? recipes.get('slash')!
}
