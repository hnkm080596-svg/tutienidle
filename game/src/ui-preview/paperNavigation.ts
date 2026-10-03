import { PAPER_NAV_IDS } from '@/composables/usePaperNavigation'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

// Preview rails consume the canonical cross-scene nav order
// (character-first, quest + settings included) - derived, never forked.
export const paperNavigationIds = PAPER_NAV_IDS

export function previewPaperNavigation(t: (key: string) => string) {
  return paperNavigationIds.map(id => ({ id, label: t(`nav.${id}`), icon: resolveAssetUrl(`/assets/ui/huyen-kim/symbols/${id}.svg`) }))
}
