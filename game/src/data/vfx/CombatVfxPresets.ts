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
  arcane_impact: {
    id: 'arcane_impact',
    color: 0x9cecff,
    space: 'hybrid',
    areaScale: 1,
    durationMs: 230,
  },
  fire_burst: {
    id: 'fire_burst',
    color: 0xff7a45,
    space: 'hybrid',
    areaScale: 1.1,
    durationMs: 260,
  },
  water_surge: {
    id: 'water_surge',
    color: 0x58c8ff,
    space: 'ground_projected',
    areaScale: 1.1,
    durationMs: 280,
  },
  earth_shockwave: {
    id: 'earth_shockwave',
    color: 0xd49a55,
    space: 'ground_projected',
    areaScale: 1.2,
    durationMs: 300,
  },
  metal_slash: {
    id: 'metal_slash',
    color: 0xffdf70,
    space: 'upright',
    areaScale: 1,
    durationMs: 230,
  },
  wood_spikes: {
    id: 'wood_spikes',
    color: 0x58e878,
    space: 'hybrid',
    areaScale: 1.1,
    durationMs: 280,
  },
  lightning_strike: {
    id: 'lightning_strike',
    color: 0xfff17a,
    space: 'upright',
    areaScale: 1,
    durationMs: 230,
  },
  wind_blade: {
    id: 'wind_blade',
    color: 0xa8f0e8,
    space: 'upright',
    areaScale: 1,
    durationMs: 230,
  },
  holy_radiance: {
    id: 'holy_radiance',
    color: 0xfff6d8,
    space: 'hybrid',
    areaScale: 1.1,
    durationMs: 280,
  },
  shadow_burst: {
    id: 'shadow_burst',
    color: 0x9b5de5,
    space: 'hybrid',
    areaScale: 1.1,
    durationMs: 280,
  },
  boss_ground_slam: {
    id: 'boss_ground_slam',
    color: 0xffd54f,
    space: 'ground_projected',
    areaScale: 1.3,
    durationMs: 340,
    screenShake: { durationMs: 120, intensity: 0.004 },
  },
  // Kiếm Tu Bạt Kiếm channel tick (Task 8, 2026-08-28) — full-screen AoE
  // per design spec, art sau.
  tu_luc: {
    id: 'tu_luc',
    color: 0xfff6d8,
    space: 'hybrid',
    areaScale: 1.2,
    durationMs: 260,
  },
  // Kiem Tu Reimagined (spec 2026-09-15 §4.3, K11) — one entry per
  // Kiem Pho combo: tier-scaled shape (len3 hybrid 1.15 / len4 hybrid
  // 1.3 / len5 screen 1.5 + shake) plus a golden-angle distinct color
  // signature per combo — the fired payload is the only discovery
  // signal, no two combos may render identically.
  kiem_combo_tam_thich: {
    id: 'kiem_combo_tam_thich',
    color: 0xcb4d4d,
    space: 'hybrid',
    areaScale: 1.15,
    durationMs: 280
  },
  kiem_combo_tam_tram: {
    id: 'kiem_combo_tam_tram',
    color: 0x4dcb73,
    space: 'hybrid',
    areaScale: 1.15,
    durationMs: 280
  },
  kiem_combo_tam_phach: {
    id: 'kiem_combo_tam_phach',
    color: 0x974dcb,
    space: 'hybrid',
    areaScale: 1.15,
    durationMs: 280
  },
  kiem_combo_tam_lieu: {
    id: 'kiem_combo_tam_lieu',
    color: 0xcbbd4d,
    space: 'hybrid',
    areaScale: 1.15,
    durationMs: 280
  },
  kiem_combo_tam_tao: {
    id: 'kiem_combo_tam_tao',
    color: 0x4db6cb,
    space: 'hybrid',
    areaScale: 1.15,
    durationMs: 280
  },
  kiem_combo_nhi_thich_nhat_tram: {
    id: 'kiem_combo_nhi_thich_nhat_tram',
    color: 0xcb4d90,
    space: 'hybrid',
    areaScale: 1.15,
    durationMs: 280
  },
  kiem_combo_nhi_thich_nhat_phach: {
    id: 'kiem_combo_nhi_thich_nhat_phach',
    color: 0x6dcb4d,
    space: 'hybrid',
    areaScale: 1.15,
    durationMs: 280
  },
  kiem_combo_nhi_tram_nhat_thich: {
    id: 'kiem_combo_nhi_tram_nhat_thich',
    color: 0x534dcb,
    space: 'hybrid',
    areaScale: 1.15,
    durationMs: 280
  },
  kiem_combo_nhi_tram_nhat_phach: {
    id: 'kiem_combo_nhi_tram_nhat_phach',
    color: 0xcb774d,
    space: 'hybrid',
    areaScale: 1.15,
    durationMs: 280
  },
  kiem_combo_nhi_phach_nhat_thich: {
    id: 'kiem_combo_nhi_phach_nhat_thich',
    color: 0x4dcb9d,
    space: 'hybrid',
    areaScale: 1.15,
    durationMs: 280
  },
  kiem_combo_nhi_lieu_nhat_thich: {
    id: 'kiem_combo_nhi_lieu_nhat_thich',
    color: 0xc14dcb,
    space: 'hybrid',
    areaScale: 1.15,
    durationMs: 280
  },
  kiem_combo_nhi_tao_nhat_thich: {
    id: 'kiem_combo_nhi_tao_nhat_thich',
    color: 0xb0cb4d,
    space: 'hybrid',
    areaScale: 1.15,
    durationMs: 280
  },
  kiem_combo_thich_tram_thich: {
    id: 'kiem_combo_thich_tram_thich',
    color: 0x4d8ccb,
    space: 'hybrid',
    areaScale: 1.15,
    durationMs: 280
  },
  kiem_combo_tram_thich_tram: {
    id: 'kiem_combo_tram_thich_tram',
    color: 0xcb4d66,
    space: 'hybrid',
    areaScale: 1.15,
    durationMs: 280
  },
  kiem_combo_phach_thich_phach: {
    id: 'kiem_combo_phach_thich_phach',
    color: 0x4dcb58,
    space: 'hybrid',
    areaScale: 1.15,
    durationMs: 280
  },
  kiem_combo_thich_tram_phach_thich: {
    id: 'kiem_combo_thich_tram_phach_thich',
    color: 0x8e5ae2,
    space: 'hybrid',
    areaScale: 1.3,
    durationMs: 330
  },
  kiem_combo_tram_phach_thich_tram: {
    id: 'kiem_combo_tram_phach_thich_tram',
    color: 0xe2b55a,
    space: 'hybrid',
    areaScale: 1.3,
    durationMs: 330
  },
  kiem_combo_phach_tram_thich_phach: {
    id: 'kiem_combo_phach_tram_thich_phach',
    color: 0x5ae2dd,
    space: 'hybrid',
    areaScale: 1.3,
    durationMs: 330
  },
  kiem_combo_lieu_tram_thich_lieu: {
    id: 'kiem_combo_lieu_tram_thich_lieu',
    color: 0xe25ac0,
    space: 'hybrid',
    areaScale: 1.3,
    durationMs: 330
  },
  kiem_combo_tao_tram_thich_tao: {
    id: 'kiem_combo_tao_tram_thich_tao',
    color: 0x97e25a,
    space: 'hybrid',
    areaScale: 1.3,
    durationMs: 330
  },
  kiem_combo_thich_lieu_tram_thich: {
    id: 'kiem_combo_thich_lieu_tram_thich',
    color: 0x5a71e2,
    space: 'hybrid',
    areaScale: 1.3,
    durationMs: 330
  },
  kiem_combo_thich_tao_tram_thich: {
    id: 'kiem_combo_thich_tao_tram_thich',
    color: 0xe26c5a,
    space: 'hybrid',
    areaScale: 1.3,
    durationMs: 330
  },
  kiem_combo_tram_lieu_phach_tram: {
    id: 'kiem_combo_tram_lieu_phach_tram',
    color: 0x5ae293,
    space: 'hybrid',
    areaScale: 1.3,
    durationMs: 330
  },
  kiem_combo_phach_lieu_tram_phach: {
    id: 'kiem_combo_phach_lieu_tram_phach',
    color: 0xbb5ae2,
    space: 'hybrid',
    areaScale: 1.3,
    durationMs: 330
  },
  kiem_combo_thich_tram_tram_lieu: {
    id: 'kiem_combo_thich_tram_tram_lieu',
    color: 0xe2e25a,
    space: 'hybrid',
    areaScale: 1.3,
    durationMs: 330
  },
  kiem_combo_tram_thich_thich_lieu: {
    id: 'kiem_combo_tram_thich_thich_lieu',
    color: 0x5ab9e2,
    space: 'hybrid',
    areaScale: 1.3,
    durationMs: 330
  },
  kiem_combo_phach_thich_thich_tao: {
    id: 'kiem_combo_phach_thich_thich_tao',
    color: 0xe25a93,
    space: 'hybrid',
    areaScale: 1.3,
    durationMs: 330
  },
  kiem_combo_ngu_hanh_kiem: {
    id: 'kiem_combo_ngu_hanh_kiem',
    color: 0x81f471,
    space: 'screen',
    areaScale: 1.5,
    durationMs: 400,
    screenShake: { durationMs: 140, intensity: 0.005 }
  },
  kiem_combo_ngu_hanh_nghich_chuyen: {
    id: 'kiem_combo_ngu_hanh_nghich_chuyen',
    color: 0x8771f4,
    space: 'screen',
    areaScale: 1.5,
    durationMs: 400,
    screenShake: { durationMs: 140, intensity: 0.005 }
  },
  kiem_combo_thich_tram_tram_phach_thich: {
    id: 'kiem_combo_thich_tram_tram_phach_thich',
    color: 0xf4ae71,
    space: 'screen',
    areaScale: 1.5,
    durationMs: 400,
    screenShake: { durationMs: 140, intensity: 0.005 }
  },
  kiem_combo_tram_thich_phach_tram_phach: {
    id: 'kiem_combo_tram_thich_phach_tram_phach',
    color: 0x71f4d3,
    space: 'screen',
    areaScale: 1.5,
    durationMs: 400,
    screenShake: { durationMs: 140, intensity: 0.005 }
  },
  kiem_combo_phach_tram_thich_lieu_tao: {
    id: 'kiem_combo_phach_tram_thich_lieu_tao',
    color: 0xf471ed,
    space: 'screen',
    areaScale: 1.5,
    durationMs: 400,
    screenShake: { durationMs: 140, intensity: 0.005 }
  },
  kiem_combo_thich_lieu_phach_tram_tao: {
    id: 'kiem_combo_thich_lieu_phach_tram_tao',
    color: 0xc8f471,
    space: 'screen',
    areaScale: 1.5,
    durationMs: 400,
    screenShake: { durationMs: 140, intensity: 0.005 }
  },
  kiem_combo_tao_tram_thich_phach_lieu: {
    id: 'kiem_combo_tao_tram_thich_phach_lieu',
    color: 0x71a1f4,
    space: 'screen',
    areaScale: 1.5,
    durationMs: 400,
    screenShake: { durationMs: 140, intensity: 0.005 }
  },
  kiem_combo_tram_phach_lieu_tao_thich: {
    id: 'kiem_combo_tram_phach_lieu_tao_thich',
    color: 0xf4717c,
    space: 'screen',
    areaScale: 1.5,
    durationMs: 400,
    screenShake: { durationMs: 140, intensity: 0.005 }
  },
  kiem_combo_phach_lieu_tao_thich_tram: {
    id: 'kiem_combo_phach_lieu_tao_thich_tram',
    color: 0x71f48e,
    space: 'screen',
    areaScale: 1.5,
    durationMs: 400,
    screenShake: { durationMs: 140, intensity: 0.005 }
  },
  kiem_combo_lieu_tao_thich_tram_phach: {
    id: 'kiem_combo_lieu_tao_thich_tram_phach',
    color: 0xb371f4,
    space: 'screen',
    areaScale: 1.5,
    durationMs: 400,
    screenShake: { durationMs: 140, intensity: 0.005 }
  },
} as const satisfies Record<CombatVfxPresetId, CombatVfxPreset>

export function getCombatVfxPreset(id: CombatVfxPresetId): CombatVfxPreset {
  return COMBAT_VFX_PRESETS[id]
}
