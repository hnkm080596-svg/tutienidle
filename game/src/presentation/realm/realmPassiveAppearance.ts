import type { PlayerData } from '@/core/player/Player'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
type Translator = (key: string, values?: Record<string, unknown>) => string
export function realmPassiveAppearance(
  realmId: string,
  player: Pick<PlayerData, 'breakthroughGrade' | 'highestFoundationAchieved'>,
  enhanced: boolean,
  t: Translator,
) {
  const foundation = player.highestFoundationAchieved
  const foundations = ['human', 'earth', 'heaven', 'great_dao'] as const
  const tierIndex = realmId === 'qi_refining'
    ? enhanced ? 7 : player.breakthroughGrade
    : foundation ? foundations.indexOf(foundation) + 1 : 0
  return {
    iconUrl: resolveAssetUrl(`/assets/ui/tien-hiep-2026-10/character-presentation/${realmId === 'qi_refining' ? 'nhap-dao' : 'kien-co'}-seal-v1.svg`),
    tierIndex,
    tierCount: realmId === 'qi_refining' ? enhanced ? 7 : 6 : foundation === 'great_dao' ? 4 : 3,
    tierLabel: enhanced ? t('realmPassive.perfected') : realmId === 'qi_refining'
      ? t('realmPassive.tier', { tier: player.breakthroughGrade })
      : foundation ? t(`realmPassive.foundation.${foundation}`) : t('realmPassive.foundation.unknown'),
  }
}
