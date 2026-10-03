import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
export const paperNavigationIds = ['realm', 'character', 'inventory', 'skill', 'technique', 'body', 'alchemy', 'equipment', 'exploration'] as const
export function previewPaperNavigation(t: (key: string) => string) {
  return paperNavigationIds.map(id => ({ id, label: t(`nav.${id}`), icon: resolveAssetUrl(`/assets/ui/huyen-kim/symbols/${id}.svg`) }))
}
