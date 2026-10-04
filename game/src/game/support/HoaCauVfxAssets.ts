/** Only occupied frames are playable; source sheets retain their padded cells. */
export const HOA_CAU_VFX_ASSETS = {
  /** Converging-energy (Genki-dama style) charge authored for the full
      1700ms charge window - plays at authored rate, no render stretch. */
  charge: {
    key: 'hoa-cau-charge',
    textureUrl: '/assets/vfx/hoa-cau-thuat/charge/hoa-tu-charge.png',
    atlasUrl: '/assets/vfx/hoa-cau-thuat/charge/hoa-tu-charge.json',
    firstFrame: 0,
    lastFrame: 50,
  },
  impact: {
    key: 'hoa-cau-fire-20',
    textureUrl: '/assets/vfx/spritesheets/火 (20).png',
    atlasUrl: '/assets/vfx/hoa-cau-thuat/fire-20.atlas.json',
    firstFrame: 0,
    lastFrame: 26,
  },
  /** Portal phase for every cast - the authored Arcadia fire circle.
      The sheet books its 62-frame loop with one blank cell at each end. */
  tripleCircle: {
    key: 'hoa-cau-triple-fire-circle',
    textureUrl: '/assets/vfx/hoa-cau-thuat/circle/hoa-cau-triple-fire-circle.png',
    atlasUrl: '/assets/vfx/hoa-cau-thuat/circle/hoa-cau-triple-fire-circle.json',
    firstFrame: 1,
    lastFrame: 62,
  },
  /** Authored Arcadia projectile - the only fireball flight art. */
  phoenixProjectile: {
    key: 'hoa-cau-phoenix-projectile',
    textureUrl: '/assets/vfx/hoa-cau-thuat/projectile/hoa-cau-phoenix.png',
    atlasUrl: '/assets/vfx/hoa-cau-thuat/projectile/hoa-cau-phoenix.json',
    firstFrame: 0,
    lastFrame: 35,
  },
  /** Same authored flight hue-shifted to azure offline - the Phap The
      (empowered) cast flies blue while normal Ly Hoa Thuat stays red. */
  phoenixProjectileEmpowered: {
    key: 'hoa-cau-phoenix-empowered',
    textureUrl: '/assets/vfx/hoa-cau-thuat/projectile-empowered/hoa-cau-phoenix-empowered.png',
    atlasUrl: '/assets/vfx/hoa-cau-thuat/projectile-empowered/hoa-cau-phoenix-empowered.json',
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

/** The 5th-stack Phap The seal - the authored Arcadia living flame that
    replaces the static glyph while `currentThe >= theThreshold` holds.
    The 5th stack ignites INSTANTLY on the spot where the glyph stood:
    no reveal beat - the burn tail (frames 18..35) loops from ms 0 at the
    authored tail rate (mirrors the dev-lab driver). */
export const HOA_THE_ASSET = {
  key: 'hoa-the-fire-stroke',
  textureUrl: '/assets/vfx/hoa-cau-thuat/fire-stroke/hoa-the.png',
  atlasUrl: '/assets/vfx/hoa-cau-thuat/fire-stroke/hoa-the.json',
  firstFrame: 0,
  lastFrame: 35,
} as const

/** Stroke-count glyph states the seal reads 0..5; stack 5 swaps to
    HOA_THE_ASSET at runtime (the glyph file still exists for tooling). */
export const PHAP_THE_GLYPH_COUNT = 6

export type HoaCauAsset = typeof HOA_CAU_VFX_ASSETS[keyof typeof HOA_CAU_VFX_ASSETS]
  | typeof HOA_THE_ASSET

/** Both aura layers loop once per this many ms (authored ~30fps sheets). */
export const TAM_MUOI_AURA_LOOP_MS = 1200

/** Tier-5 Hoa The seal timing: the glyph vanishes at stack 5 and the burn
    tail (frames 18..35) loops instantly at the authored rate - the doc
    authored those 18 frames over 1.2s. Reduced-motion freezes on 18. */
export const HOA_THE_BURN_START_FRAME = 18
export const HOA_THE_BURN_FRAME_COUNT = 18
export const HOA_THE_BURN_LOOP_MS = 1200

export function hoaCauCombatDescriptors() {
  return Object.values(HOA_CAU_VFX_ASSETS).map(({ key, textureUrl, atlasUrl }) => ({
    kind: 'atlas' as const,
    key,
    textureUrl,
    atlasUrl,
  }))
}

/** Phap The seal art: the six stroke-state glyphs (svg images) plus the
    Arcadia living-flame sheet the 5th stack swaps in. */
export function phapTheCombatDescriptors() {
  const glyphs = Array.from({ length: PHAP_THE_GLYPH_COUNT }, (_, stack) => ({
    kind: 'image' as const,
    key: `phap-the-${stack}`,
    url: `/assets/vfx/hoa-cau-thuat/phap-the/phap-the-${stack}.svg`,
  }))
  return [
    ...glyphs,
    {
      kind: 'atlas' as const,
      key: HOA_THE_ASSET.key,
      textureUrl: HOA_THE_ASSET.textureUrl,
      atlasUrl: HOA_THE_ASSET.atlasUrl,
    },
  ]
}
