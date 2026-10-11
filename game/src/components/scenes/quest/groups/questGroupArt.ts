// Group-rail art registry (Codex landscape port): thematic group id ->
// medallion icon. The preview maps its five groups onto navigation-*-v2
// icons; production adds 'all' (the rail's reset button) and 'once'
// (the fallback bucket for quests whose `group` field is still
// unassigned). Unknown ids render on the quest icon so a new group id
// never ships a broken image.
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

const QUEST_GROUP_ICONS: Record<string, string> = {
  all: '/assets/ui/tien-hiep-2026-10/icons/navigation-home-v2.png',
  mainline: '/assets/ui/tien-hiep-2026-10/icons/navigation-quest-v2.png',
  once: '/assets/ui/tien-hiep-2026-10/icons/navigation-portal-v2.png',
  daily: '/assets/ui/tien-hiep-2026-10/icons/navigation-alchemy-v2.png',
  weekly: '/assets/ui/tien-hiep-2026-10/icons/navigation-production-v2.png',
  achievement: '/assets/ui/tien-hiep-2026-10/icons/navigation-feedback-v2.png',
  exploration: '/assets/ui/tien-hiep-2026-10/icons/navigation-exploration-v2.png',
}

const QUEST_GROUP_ICON_FALLBACK =
  '/assets/ui/tien-hiep-2026-10/icons/navigation-quest-v2.png'

export function questGroupIcon(id: string): string {
  return resolveAssetUrl(QUEST_GROUP_ICONS[id] ?? QUEST_GROUP_ICON_FALLBACK)
}
