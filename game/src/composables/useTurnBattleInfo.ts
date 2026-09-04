import { computed } from 'vue'
import { useGameManager, useStateVersion } from './useGameState'
import { peekUpcomingActors } from '@/core/battle/turn/TurnOrderPreview'
import type { TurnBattleParticipant, TurnBattle } from '@/core/battle/turn/TurnBattleSystem'

/**
 * Slice 7 extension (Completion Task 11) — turn-order preview + battle log
 * reactivity bridge. Cùng pattern stateVersion như useTurnCombatManual.
 */
export function useTurnBattleInfo() {
  const gameManager = useGameManager()
  const { stateVersion } = useStateVersion()

  const battle = computed<TurnBattle | null>(() => {
    stateVersion.value

    return gameManager.getTurnBattle()
  })

  const isBattleFighting = computed(() => battle.value?.state === 'fighting')

  /** Tối đa 5 actor kế tiếp theo gauge order (turn-order strip). */
  const upcomingActors = computed<TurnBattleParticipant[]>(() => {
    const current = battle.value

    if (!current || current.state !== 'fighting') {
      return []
    }

    return peekUpcomingActors(current, 5)
  })

  /** Battle log, newest-last (đọc tuần tự như nhật ký). */
  const logEntries = computed(() => {
    stateVersion.value

    return battle.value?.log ?? []
  })

  return {
    battle,
    isBattleFighting,
    upcomingActors,
    logEntries,
  }
}
