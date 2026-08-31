import { computed } from 'vue'
import { useGameManager, useStateVersion } from './useGameState'
import { usePlayerStore } from '@/stores/player'
import { REALM_PASSIVES } from '@/data/realm/RealmPassives'
import { statLabel, formatStat } from '@/core/stats/StatLabels'

export interface RealmStatPassiveRow {
  id: string

  name: string

  description: string

  effectLines: string[]
}

/**
 * Realm Passive & Pressure System (2026-08-20) — sibling của
 * usePassiveRows.ts (đó là passive SKILL theo tâm pháp/cảnh giới, cái
 * này là stat modifier Nhập Đạo/Kiến Cơ, xem data/realm/RealmPassives.ts).
 * Chỉ liệt kê Realm Passive ĐÃ CẤP (player.grantedRealmPassiveIds) —
 * chưa tới cảnh giới đó thì chưa hiện, tránh lộ nội dung tương lai.
 */
export function useRealmStatPassives() {
  useGameManager()

  const { stateVersion } = useStateVersion()
  const player = usePlayerStore()

  const rows = computed<RealmStatPassiveRow[]>(() => {
    stateVersion.value

    return REALM_PASSIVES
      .filter(passive => player.grantedRealmPassiveIds.includes(passive.id))
      .map(passive => {
        const modifiers = passive.buildModifiers(player.$state)

        const effectLines = modifiers
          .filter(modifier => (modifier.percent ?? 0) !== 0)
          .map(modifier => `${statLabel(modifier.stat)} +${formatStat('realmPassivePercent', modifier.percent ?? 0)}`)

        return {
          id: passive.id,
          name: passive.name,
          description: passive.description,
          effectLines,
        }
      })
  })

  return { realmStatPassiveRows: rows }
}
