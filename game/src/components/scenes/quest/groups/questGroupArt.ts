// Group-rail art registry (Codex landscape port): thematic group id ->
// medallion icon. Beta scope ships 'all' (the rail's reset button),
// 'mainline' and 'once' only - the preview's other cadence groups get
// their icons back when those cadences leave beta scope. Unknown ids
// render on the quest icon so a new group id never ships a broken image.
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

const QUEST_GROUP_ICONS: Record<string, string> = {
  all: '/assets/ui/tien-hiep-2026-10/icons/navigation-home-v2.png',
  mainline: '/assets/ui/tien-hiep-2026-10/icons/navigation-quest-v2.png',
  once: '/assets/ui/tien-hiep-2026-10/icons/navigation-portal-v2.png',
  // Preview cadence tabs (locked placeholders until the cadence ships).
  day: '/assets/ui/tien-hiep-2026-10/icons/navigation-quest-v2.png',
  weekly: '/assets/ui/tien-hiep-2026-10/icons/navigation-guild-v2.png',
  achievement: '/assets/ui/tien-hiep-2026-10/icons/navigation-realm-v2.png',
  expedition: '/assets/ui/tien-hiep-2026-10/icons/navigation-exploration-v2.png',
}

const QUEST_GROUP_ICON_FALLBACK =
  '/assets/ui/tien-hiep-2026-10/icons/navigation-quest-v2.png'

export function questGroupIcon(id: string): string {
  return resolveAssetUrl(QUEST_GROUP_ICONS[id] ?? QUEST_GROUP_ICON_FALLBACK)
}
