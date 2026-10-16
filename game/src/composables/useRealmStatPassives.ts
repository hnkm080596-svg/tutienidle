import { useI18n } from 'vue-i18n'
import { realmPassiveAppearance } from '@/presentation/realm/realmPassiveAppearance'
import type { RealmPassiveTooltipContent } from './useTooltip'
import { computed } from 'vue'
import { useGameManager, useStateVersion } from './useGameState'
import { usePlayerStore } from '@/stores/player'
import { authoredRealmPassiveEntries, REALM_PASSIVES } from '@/data/realm/RealmPassives'
import { isBetaFeature } from '@/core/betaScope'
import { getHiddenBreakthroughRealmIds } from '@/core/realm/hidden/HiddenLineage'
import { statLabel, formatStat } from '@/core/stats/StatLabels'

export interface RealmStatPassiveRow {
  id: string

  name: string

  description: string

  iconUrl: string
  tierLabel: string
  tierIndex: number
  tierCount: number
  tooltip: RealmPassiveTooltipContent
  effectLines: string[]
}

/**
 * Realm Passive & Pressure System (2026-08-20) - sibling cua
 * usePassiveRows.ts (do la passive SKILL theo tam phap/Canh Gioi, cai
 * nay la stat modifier Nhap Dao/Kien Co, xem data/realm/RealmPassives.ts).
 * Chi liet ke Realm Passive DA CAP (player.grantedRealmPassiveIds) -
 * chua toi Canh Gioi do thi chua hien, tranh lo noi dung tuong lai.
 */
export function useRealmStatPassives() {
  useGameManager()
  const { t } = useI18n()

  const { stateVersion } = useStateVersion()
  const player = usePlayerStore()

  const rows = computed<RealmStatPassiveRow[]>(() => {
    stateVersion.value

    // BETA SCOPE LOCK - mirror resolvePlayerStatAssembly: passives
    // granted through a hidden breakthrough stay recorded on carried
    // saves but emit nothing while hiddenContent is locked, so the card
    // withholds the same rows the model withholds (no model-vs-surface
    // lie).
    const hiddenRealmIds = isBetaFeature('hiddenContent')
      ? undefined
      : new Set(getHiddenBreakthroughRealmIds(player.$state))

    return REALM_PASSIVES
      .filter(passive => player.grantedRealmPassiveIds.includes(passive.id))
      .filter(passive => hiddenRealmIds === undefined || !hiddenRealmIds.has(passive.id))
      .map(passive => {
        const modifiers = authoredRealmPassiveEntries(passive, player.$state)

        const effectLines = modifiers
          .filter(modifier => (modifier.percent ?? 0) !== 0)
          .map(modifier => `${statLabel(modifier.stat)} +${formatStat('realmPassivePercent', modifier.percent ?? 0)}`)

        const appearance = realmPassiveAppearance(passive.id, player.$state,
          isBetaFeature('hiddenContent') && getHiddenBreakthroughRealmIds(player.$state).includes(passive.id), t)
        const tooltip: RealmPassiveTooltipContent = {
          kind: 'realm-passive', name: passive.name, imagePath: appearance.iconUrl,
          levelLabel: appearance.tierLabel, description: passive.description,
          sections: [{ label: t('realmPassive.effects'), rows: effectLines.map((line) => ({ label: line, value: '' })) },
            { label: t('realmPassive.origin'), rows: [{ label: t('realmPassive.recorded'), value: appearance.tierLabel }] }],
        }
        return {
          ...appearance, tooltip,
          id: passive.id,
          name: passive.name,
          description: passive.description,
          effectLines,
        }
      })
  })

  return { realmStatPassiveRows: rows }
}
