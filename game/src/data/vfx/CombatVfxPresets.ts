import type { CombatVfxPresetId } from '@/core/battle/CombatAction'

export type CombatVfxSpace = 'ground_projected' | 'upright' | 'attached' | 'screen' | 'hybrid'

export interface CombatVfxPreset {
  id: CombatVfxPresetId
  color: number
  space: CombatVfxSpace
  areaScale: number
  durationMs: number
  screenShake?: { durationMs: number; intensity: number }
}

export const COMBAT_VFX_PRESETS = {
  slash: { id: 'slash', color: 0xeaf6ff, space: 'upright', areaScale: 1, durationMs: 230 },
  claw: { id: 'claw', color: 0xffb0a0, space: 'upright', areaScale: 1, durationMs: 230 },
  arcane_impact: { id: 'arcane_impact', color: 0x9cecff, space: 'hybrid', areaScale: 1, durationMs: 230 },
  fire_burst: { id: 'fire_burst', color: 0xff7a45, space: 'hybrid', areaScale: 1.1, durationMs: 260 },
  water_surge: { id: 'water_surge', color: 0x58c8ff, space: 'ground_projected', areaScale: 1.1, durationMs: 280 },
  earth_shockwave: { id: 'earth_shockwave', color: 0xd49a55, space: 'ground_projected', areaScale: 1.2, durationMs: 300 },
  metal_slash: { id: 'metal_slash', color: 0xffdf70, space: 'upright', areaScale: 1, durationMs: 230 },
  wood_spikes: { id: 'wood_spikes', color: 0x58e878, space: 'hybrid', areaScale: 1.1, durationMs: 280 },
  lightning_strike: { id: 'lightning_strike', color: 0xfff17a, space: 'upright', areaScale: 1, durationMs: 230 },
  wind_blade: { id: 'wind_blade', color: 0xa8f0e8, space: 'upright', areaScale: 1, durationMs: 230 },
  holy_radiance: { id: 'holy_radiance', color: 0xfff6d8, space: 'hybrid', areaScale: 1.1, durationMs: 280 },
  shadow_burst: { id: 'shadow_burst', color: 0x9b5de5, space: 'hybrid', areaScale: 1.1, durationMs: 280 },
  boss_ground_slam: {
    id: 'boss_ground_slam',
    color: 0xffd54f,
    space: 'ground_projected',
    areaScale: 1.3,
    durationMs: 340,
    screenShake: { durationMs: 120, intensity: 0.004 },
  },
} as const satisfies Record<CombatVfxPresetId, CombatVfxPreset>

export function getCombatVfxPreset(id: CombatVfxPresetId): CombatVfxPreset {
  return COMBAT_VFX_PRESETS[id]
}

