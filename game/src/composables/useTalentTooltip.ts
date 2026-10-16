import { TALENT_RARITY_LABELS, type TalentDefinition, type TalentTag } from '@/core/talent/Talent'
import { stableSymbolUrl, talentSymbolId, talentIllustrationUrl, type StableSymbolId } from '@/presentation/huyenKim/StableSceneArt'
import type { TalentTooltipContent } from './useTooltip'

// Single owner for "what a talent looks like" (tooltip + inline cards):
// creation offer tiles, the creation detail aside, character talent
// seals and the entitlement modal all read this one model instead of
// each formatting name/rarity/description/tags locally.
export const TALENT_TAG_SYMBOLS: Record<TalentTag, StableSymbolId> = {
  cultivation: 'realm', combat: 'skill', defense: 'body', resource: 'inventory',
  crafting: 'alchemy', element: 'technique', skill: 'skill', risk_reward: 'exploration', mechanic: 'settings',
}

export function talentTagLabel(tag: TalentTag, t: (key: string) => string): string {
  return t(`talents.tags.${tag}`)
}

export function talentIconUrl(talent: TalentDefinition): string {
  return talentIllustrationUrl(talent.id) ?? stableSymbolUrl(talentSymbolId(talent.id, TALENT_TAG_SYMBOLS[talent.tags[0] ?? 'cultivation']))
}

export function buildTalentTooltip(talent: TalentDefinition, t: (key: string) => string): TalentTooltipContent {
  const [main = '', tradeoff] = talent.description.split(/Ngược lại:\s*/, 2)
  const opening = main.match(/^(.+?[.!?])\s+([\s\S]+)$/)
  const flavor = opening?.[1]
  const mechanics = opening?.[2] ?? main
  return {
    flavor, mechanics, tradeoff,
    kind: 'talent',
    name: talent.name,
    rarityLabel: TALENT_RARITY_LABELS[talent.rarity],
    rarity: talent.rarity,
    imagePath: talentIconUrl(talent),
    description: talent.description,
    featuresLabel: t('talents.features'),
    tagLabels: talent.tags.map((tag) => talentTagLabel(tag, t)),
  }
}
