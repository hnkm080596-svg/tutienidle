import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
const tienHiep = '/assets/ui/tien-hiep-2026-10/'
export const CHARACTER_ART = Object.freeze({
  paper: resolveAssetUrl(`${tienHiep}source/shared-paper-page-v1.png`),
  card: resolveAssetUrl(`${tienHiep}controls/character-card-nine-slice-v2.png`),
  plus: resolveAssetUrl(`${tienHiep}controls/attribute-plus-v2.png`),
})
// Element ivory pucks from the landscape-design pack (metal/wood/water/fire/earth).
export const elementArt = (id: string) => resolveAssetUrl(`${tienHiep}icons/element-${id}-ivory-v1.png`)
// Per-talent glyph seals (talent-<id>.svg), 'technique' symbol as fallback.
export const talentGlyph = (id: string) => resolveAssetUrl(`/assets/ui/huyen-kim/symbols/talent-${id}.svg`)
export interface CharacterUiStatSource {
  /** Resolved Vietnamese source name, or the category fallback. */
  label: string
  /** flat * stacks summed over the source's modifiers ('+N' display). */
  flat?: number
  /** percent * stacks summed per Increased pool tag (0.05 = +5%). */
  percents?: { tag?: string; amount: number }[]
  /** product of multiplier^stacks over the source ('xN' display). */
  multiplier?: number
}
export interface CharacterUiStatSources {
  /** Assembled pre-modifier base for this stat (incl. body deltas). */
  base: number
  /** The Luyen The slice inside `base` - rows separate it from the
      persisted raw base when present. */
  bodyDelta?: number
  contributions: readonly CharacterUiStatSource[]
}
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
  /** Per-source attribution rows for the hover breakdown. */
  sources?: CharacterUiStatSources
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
}
export interface CharacterUiDetail {
  id: string
  label: string
  value: string
  description?: string
  /** Per-source attribution rows for the hover breakdown. */
  sources?: CharacterUiStatSources
}
export interface CharacterUiTalent { id: string; name: string; description: string; rarity: string }
export interface CharacterUiPowerSource {
  /** Resolved stat label the formula term draws from. */
  label: string
  /** Formatted contribution this term adds to combat power. */
  value: string
}
export interface CharacterUiModel {
  name: string
  realm: string
  /** Resolved cultivation-path display name ('Phap Tu' / 'Kiem Tu' / ...). */
  path: string
  /** Dao verse shown under the path name for elemental daos (Ly Hoa). */
  pathVerse?: string
  combatPower: string
  /** Per-term contributions behind combatPower (hover breakdown). */
  powerSources?: readonly CharacterUiPowerSource[]
  stats: readonly CharacterUiStat[]
  elements: readonly CharacterUiElement[]
  talents: readonly CharacterUiTalent[]
  combat: readonly CharacterUiDetail[]
  other: readonly CharacterUiDetail[]
  /** Unspent attribute points - drives the (+) affordance + points badge. */
  attributePoints: number
}
