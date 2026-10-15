import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

// Preview rails consume the canonical cross-scene nav order
// (character-first, quest + settings included).
export const paperNavigationIds = [
  'character',
  'realm',
  'technique',
  'skill',
  'body',
  'exploration',
  'alchemy',
  'equipment',
  'inventory',
  'quest',
  'settings',
] as const

export function previewPaperNavigation(t: (key: string) => string, lockedIds: readonly string[] = []) {
  return paperNavigationIds.map(id => ({
    id,
    label: t(`nav.${id}`),
    icon: resolveAssetUrl(`/assets/ui/huyen-kim/symbols/${id}.svg`),
    locked: lockedIds.includes(id) || undefined,
  }))
}
