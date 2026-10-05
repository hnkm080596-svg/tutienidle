import { pcPaperIconUrl, type PcPaperIcon } from '@/presentation/assets/PcPaperIcons'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
const frameMetadata = { slices: { top: 240, right: 240, bottom: 240, left: 240 } }

const artRoot = '/assets/ui/huyen-kim/scene/dong-fu-v2/'
export const DONG_FU_ART = Object.freeze({
  rear: resolveAssetUrl('/assets/ui/tien-hiep-2026-10/source/world-vista-warm-v1.png'),
  foreground: resolveAssetUrl(`${artRoot}foreground.png`),
  cultivator: resolveAssetUrl(`${artRoot}cultivator.png`),
  frame: resolveAssetUrl('/assets/ui/tien-hiep-2026-10/runtime/panel-frame-v2.png'),
})
export { frameMetadata }
export function symbolUrl(id: string): string {
  const aliases: Record<string, PcPaperIcon> = { pill_room: 'alchemy', equipment_hall: 'forge', gathering_outpost: 'production', teleport_array: 'portal', formation_slot: 'formation', realm_breakthrough: 'realm', cultivation: 'realm', body_training: 'body' }
  const icon = aliases[id] ?? id
  const supported: readonly string[] = ['home', 'character', 'skill', 'equipment', 'sect', 'guild', 'inventory', 'alchemy', 'forge', 'body', 'companion', 'exploration', 'portal', 'formation', 'artifact', 'realm', 'technique', 'quest', 'compass', 'settings', 'feedback', 'opportunity', 'production', 'vendor']
  return supported.includes(icon) ? pcPaperIconUrl(icon as PcPaperIcon) : resolveAssetUrl(`/assets/ui/huyen-kim/symbols/${id}.svg`)
}
export interface DongFuUiAction {
  id: string
  labelKey: string
  symbol: string
  /** Resolved disabled hint (tooltip); suppresses activation when set. */
  disabledReason?: string | null
  /** 'alert' = urgent seal (breakthrough), 'dot' = ready dot,
      'upgrade' = clickable upgrade affordance (building plaques only). */
  badge?: 'alert' | 'dot' | 'upgrade' | null
  /** True while this slot's surface is already open. */
  active?: boolean
}
export interface DongFuUiBuilding extends DongFuUiAction {
  x: number
  y: number
}
export interface DongFuUiOpportunity extends DongFuUiAction {
  detailKey: string
  labelParams?: Record<string, string | number>
  detailParams?: Record<string, string | number>
  /** Per-entry CTA label key; falls back to the generic view key. */
  ctaKey?: string
}
export interface DongFuUiQuest {
  name: string
  detail: string
  claimable: boolean
}
export interface DongFuUiModel {
  name: string
  realm: string
  progressLabel: string
  progressPercent: number
  /** Resolved labels - currency names live in data, not locale keys. */
  resources: readonly { id: string; label: string; value: string }[]
  /** Command-wheel slots (owner: commandWheelCatalog + betaWheelSlots). */
  actions: readonly DongFuUiAction[]
  /** Utility seals on the HUD (feedback / inventory / settings). */
  utilities: readonly DongFuUiAction[]
  buildings: readonly DongFuUiBuilding[]
  /** Thien Co entries - dynamic, can be empty. */
  opportunities: readonly DongFuUiOpportunity[]
  /** Tracked quest plaque; null hides the whole chip. */
  quest: DongFuUiQuest | null
}
