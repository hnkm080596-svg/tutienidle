import { resolveAssetUrl } from './AssetBaseUrl'

export const PC_PAPER_ICON_IDS = ['home', 'character', 'skill', 'equipment', 'sect', 'guild', 'inventory', 'alchemy', 'forge', 'body', 'companion', 'exploration', 'portal', 'formation', 'artifact', 'realm', 'technique', 'quest', 'compass', 'settings', 'feedback', 'opportunity', 'production', 'vendor', 'body-flame', 'body-brain', 'body-lungs', 'body-heart', 'body-foot', 'body-arm'] as const
export type PcPaperIcon = (typeof PC_PAPER_ICON_IDS)[number]
export const PC_PAPER_ICON_PATHS = PC_PAPER_ICON_IDS.map((name) => '/assets/ui/tien-hiep-2026-10/icons/' + name + '.png')

/** The design showcase uses one authored brush family, without per-scene recoloring. */
export function pcPaperIconUrl(name: PcPaperIcon): string {
  return resolveAssetUrl(`/assets/ui/tien-hiep-2026-10/icons/${name}.png`)
}
