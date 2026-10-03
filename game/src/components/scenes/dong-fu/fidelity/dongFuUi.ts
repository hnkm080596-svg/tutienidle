import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import frameMetadata from '../../../../../public/assets/ui/huyen-kim/scene/dong-fu-v2/panel-nine-slice.json'

const artRoot = '/assets/ui/huyen-kim/scene/dong-fu-v2/'
export const DONG_FU_ART = Object.freeze({
  rear: resolveAssetUrl(`${artRoot}rear.png`),
  foreground: resolveAssetUrl(`${artRoot}foreground.png`),
  cultivator: resolveAssetUrl(`${artRoot}cultivator.png`),
  frame: resolveAssetUrl(`${artRoot}${frameMetadata.image}`),
})
export { frameMetadata }
export function symbolUrl(id: string): string {
  return resolveAssetUrl(`/assets/ui/huyen-kim/symbols/${id}.svg`)
}
export interface DongFuUiAction {
  id: string
  labelKey: string
  symbol: string
  /** Wheel orbit: 1 rides the inner ring, anything else the outer. */
  ring?: number
  /** Resolved disabled hint (tooltip); suppresses activation when set. */
  disabledReason?: string | null
  /** 'alert' = urgent seal (breakthrough), 'dot' = upgrade-ready dot. */
  badge?: 'alert' | 'dot' | null
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
