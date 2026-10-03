import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
const root = '/assets/ui/huyen-kim/scene/character-v2/'
export const CHARACTER_ART = Object.freeze({
  figure: resolveAssetUrl(`${root}figure.png`), paper: resolveAssetUrl(`${root}paper-nine-slice.png`),
  logo: resolveAssetUrl('/assets/ui/huyen-kim/scene/login-v2/wordmark.png'),
})
export const elementArt = (id: string) => resolveAssetUrl(`/assets/ui/elements/el-${id}.png`)
export interface CharacterUiStat {
  id: string
  /** Resolved display label (statLabel()) - not a locale key. */
  label: string
  value: string
  fill: number
  color: string
  symbol: string
  /** Resolved tooltip description. */
  description?: string
  /** Allocate affordance is live: points remain, under cap, out of battle. */
  allocatable?: boolean
  /** Base stat hit its allocation cap -> shows MAX. */
  capped?: boolean
}
export interface CharacterUiElement {
  id: string
  /** Resolved element name (ELEMENT_LABELS). */
  name: string
  share: string
  power: string
  resistance: string
  penetration: string
  x: number
  y: number
}
export interface CharacterUiDetail { id: string; label: string; value: string; description?: string }
export interface CharacterUiTalent { id: string; name: string; description: string; rarity: string }
export interface CharacterUiModel {
  name: string
  realm: string
  /** Resolved cultivation-path display name ('Phap Tu' / 'Kiem Tu' / ...). */
  path: string
  combatPower: string
  stats: readonly CharacterUiStat[]
  elements: readonly CharacterUiElement[]
  talents: readonly CharacterUiTalent[]
  combat: readonly CharacterUiDetail[]
  other: readonly CharacterUiDetail[]
  /** Unspent attribute points - drives the (+) affordance + points badge. */
  attributePoints: number
}
