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

/** Committed dao identity for the name plate: every dao lo declares
 *  its display name and (optionally) a couplet verse here, keyed by
 *  `<wayId>.<element>` first, then bare `<wayId>` for ways that carry
 *  no element axis. The couplet renders as two vertical columns
 *  flanking the idle figure - generic mechanism, one entry per dao. */
export interface DaoIdentity {
  nameKey: string
  verseKey?: string
}
const DAO_IDENTITIES: Readonly<Record<string, DaoIdentity>> = {
  'spell_pathway.fire': { nameKey: 'character.lyHoaDao', verseKey: 'character.lyHoaVerse' },
}
export function daoIdentityFor(wayId: string | undefined, element: string | undefined) {
  if (!wayId) return undefined
  return DAO_IDENTITIES[`${wayId}.${element ?? ''}`] ?? DAO_IDENTITIES[wayId]
}
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
  /** Committed dao display name ('Ly Hoa Chi Dao' / module name).
   *  Undefined while uncommitted - a mortal plate shows just 'Pham Nhan'. */
  path?: string
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
