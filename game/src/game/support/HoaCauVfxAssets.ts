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
} as const

/** Dev-preview candidate; production still uses the existing Fire 9 projectile. */
export const HOA_CAU_PHOENIX_PREVIEW_ASSET = {
  key: 'hoa-cau-phoenix-projectile',
  textureUrl: '/assets/vfx/hoa-cau-thuat/projectile/hoa-cau-phoenix.png',
  atlasUrl: '/assets/vfx/hoa-cau-thuat/projectile/hoa-cau-phoenix.json',
  firstFrame: 0,
  lastFrame: 35,
} as const

/** The authored Arcadia circle is preview-only until the full skill is approved. */
export const HOA_CAU_TRIPLE_CIRCLE_PREVIEW_ASSET = {
  key: 'hoa-cau-triple-fire-circle',
  textureUrl: '/assets/vfx/hoa-cau-thuat/circle/hoa-cau-triple-fire-circle.png',
  atlasUrl: '/assets/vfx/hoa-cau-thuat/circle/hoa-cau-triple-fire-circle.json',
  firstFrame: 0,
  lastFrame: 63,
} as const

/** Two passes from one editable Arcadia effect; preview-only until approved. */
export const TAM_MUOI_AURA_PREVIEW_ASSET = {
  key: 'tam-muoi-fire-aura-back',
  textureUrl: '/assets/vfx/hoa-cau-thuat/tam-muoi-aura/tam-muoi-aura-back.png',
  atlasUrl: '/assets/vfx/hoa-cau-thuat/tam-muoi-aura/tam-muoi-aura-back.json',
  firstFrame: 0,
  lastFrame: 35,
} as const

export const TAM_MUOI_AURA_FRONT_PREVIEW_ASSET = {
  key: 'tam-muoi-fire-aura-front',
  textureUrl: '/assets/vfx/hoa-cau-thuat/tam-muoi-aura/tam-muoi-aura-front.png',
  atlasUrl: '/assets/vfx/hoa-cau-thuat/tam-muoi-aura/tam-muoi-aura-front.json',
  firstFrame: 0,
  lastFrame: 35,
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
  | typeof HOA_CAU_PHOENIX_PREVIEW_ASSET | typeof HOA_CAU_TRIPLE_CIRCLE_PREVIEW_ASSET
  | typeof HOA_THE_PREVIEW_ASSET

export function hoaCauCombatDescriptors() {
  return Object.values(HOA_CAU_VFX_ASSETS).map(({ key, textureUrl, atlasUrl }) => ({
    kind: 'atlas' as const,
    key,
    textureUrl,
    atlasUrl,
  }))
}
