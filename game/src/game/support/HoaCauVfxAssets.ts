/** Only occupied frames are playable; source sheets retain their padded cells. */
export const HOA_CAU_VFX_ASSETS = {
  portalOpen: {
    key: 'hoa-cau-portal-open',
    textureUrl: '/assets/vfx/hoa-cau-thuat/portal/mystic-portal-blood-open.png',
    atlasUrl: '/assets/vfx/hoa-cau-thuat/portal/mystic-portal-blood-open.atlas.json',
    firstFrame: 1,
    lastFrame: 24,
  },
  portalActive: {
    key: 'hoa-cau-portal-active',
    textureUrl: '/assets/vfx/hoa-cau-thuat/portal/mystic-portal-blood-active.png',
    atlasUrl: '/assets/vfx/hoa-cau-thuat/portal/mystic-portal-blood-active.atlas.json',
    firstFrame: 0,
    lastFrame: 51,
  },
  portalClose: {
    key: 'hoa-cau-portal-close',
    textureUrl: '/assets/vfx/hoa-cau-thuat/portal/mystic-portal-blood-close.png',
    atlasUrl: '/assets/vfx/hoa-cau-thuat/portal/mystic-portal-blood-close.atlas.json',
    firstFrame: 0,
    lastFrame: 14,
  },
  charge: {
    key: 'hoa-cau-charge',
    textureUrl: '/assets/vfx/hoa-cau-thuat/charge/hoa-tu-charge.png',
    atlasUrl: '/assets/vfx/hoa-cau-thuat/charge/hoa-tu-charge.json',
    firstFrame: 0,
    lastFrame: 17,
  },
  projectile: {
    key: 'hoa-cau-fire-9',
    textureUrl: '/assets/vfx/spritesheets/火 (9).png',
    atlasUrl: '/assets/vfx/hoa-cau-thuat/fire-9.atlas.json',
    firstFrame: 0,
    lastFrame: 26,
  },
  impact: {
    key: 'hoa-cau-fire-20',
    textureUrl: '/assets/vfx/spritesheets/火 (20).png',
    atlasUrl: '/assets/vfx/hoa-cau-thuat/fire-20.atlas.json',
    firstFrame: 0,
    lastFrame: 26,
  },
  /** Tam Muoi empowered-state circle, swapped in for the portal while the
      caster's tam_muoi window is up (the phoenix_projectile art variant).
      The sheet books its 62-frame loop with one blank cell at each end. */
  tripleCircle: {
    key: 'hoa-cau-triple-fire-circle',
    textureUrl: '/assets/vfx/hoa-cau-thuat/circle/hoa-cau-triple-fire-circle.png',
    atlasUrl: '/assets/vfx/hoa-cau-thuat/circle/hoa-cau-triple-fire-circle.json',
    firstFrame: 1,
    lastFrame: 62,
  },
  /** Empowered projectile for the same Tam Muoi variant of the fireball. */
  phoenixProjectile: {
    key: 'hoa-cau-phoenix-projectile',
    textureUrl: '/assets/vfx/hoa-cau-thuat/projectile/hoa-cau-phoenix.png',
    atlasUrl: '/assets/vfx/hoa-cau-thuat/projectile/hoa-cau-phoenix.json',
    firstFrame: 0,
    lastFrame: 35,
  },
  /** Two passes from one editable Arcadia effect: back sits behind the
      caster sprite, front in front - both wrap it for the whole cast.
      Each keeps its own occupied range (the authored ramp pads the front
      loop with one more blank cell), so the layers run 35 and 34 frames
      over the same 1200ms phase. */
  tamMuoiAuraBack: {
    key: 'tam-muoi-fire-aura-back',
    textureUrl: '/assets/vfx/hoa-cau-thuat/tam-muoi-aura/tam-muoi-aura-back.png',
    atlasUrl: '/assets/vfx/hoa-cau-thuat/tam-muoi-aura/tam-muoi-aura-back.json',
    firstFrame: 1,
    lastFrame: 35,
  },
  tamMuoiAuraFront: {
    key: 'tam-muoi-fire-aura-front',
    textureUrl: '/assets/vfx/hoa-cau-thuat/tam-muoi-aura/tam-muoi-aura-front.png',
    atlasUrl: '/assets/vfx/hoa-cau-thuat/tam-muoi-aura/tam-muoi-aura-front.json',
    firstFrame: 2,
    lastFrame: 35,
  },
} as const

/** Stroke-by-stroke fire seal; preview-only until its skill slot is approved. */
export const HOA_THE_PREVIEW_ASSET = {
  key: 'hoa-the-fire-stroke',
  textureUrl: '/assets/vfx/hoa-cau-thuat/fire-stroke/hoa-the.png',
  atlasUrl: '/assets/vfx/hoa-cau-thuat/fire-stroke/hoa-the.json',
  firstFrame: 0,
  lastFrame: 35,
} as const

export type HoaCauAsset = typeof HOA_CAU_VFX_ASSETS[keyof typeof HOA_CAU_VFX_ASSETS]
  | typeof HOA_THE_PREVIEW_ASSET

/** Both aura layers loop once per this many ms (authored ~30fps sheets). */
export const TAM_MUOI_AURA_LOOP_MS = 1200

export function hoaCauCombatDescriptors() {
  return Object.values(HOA_CAU_VFX_ASSETS).map(({ key, textureUrl, atlasUrl }) => ({
    kind: 'atlas' as const,
    key,
    textureUrl,
    atlasUrl,
  }))
}
