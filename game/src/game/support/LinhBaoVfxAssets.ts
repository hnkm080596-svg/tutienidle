/** The authored Arcadia point detonation plays at each landed impact anchor. */
export const LINH_BAO_VFX_ASSETS = {
  burst: {
    key: 'linh-bao-burst',
    textureUrl: '/assets/vfx/linh-bao/linh-bao-burst.png',
    atlasUrl: '/assets/vfx/linh-bao/linh-bao-burst.json',
    firstFrame: 0,
    lastFrame: 11,
  },
} as const

export function linhBaoCombatDescriptors() {
  return Object.values(LINH_BAO_VFX_ASSETS).map(({ key, textureUrl, atlasUrl }) => ({
    kind: 'atlas' as const,
    key,
    textureUrl,
    atlasUrl,
  }))
}
