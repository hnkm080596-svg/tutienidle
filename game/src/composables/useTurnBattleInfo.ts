import { computed } from 'vue'
import { useGameManager, useStateVersion } from './useGameState'
import { peekUpcomingActors } from '@/core/battle/turn/TurnOrderPreview'
import { isBattleInProgress } from '@/core/battle/BattleTypes'
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

  // stateVersion must be read in EVERY computed below: the engine mutates
  // the TurnBattle object in place (state/roundsElapsed/log), so `battle`
  // resolves to the same reference forever — a computed depending only on
  // `battle.value` is never invalidated again after first eval (strip stayed
  // invisible in live combat; 2026-09-12).
  const isBattleFighting = computed(() => {
    stateVersion.value

    return battle.value?.state === 'fighting'
  })

  // The canonical in-progress predicate (intro|countdown|fighting) for
  // panels that must refuse writes while a cycle is live; the ops-layer
  // gate stays authoritative -- this is the UI-side cosmetic mirror.
  const isBattleInProgressNow = computed(() => {
    stateVersion.value

    const current = battle.value

    return current !== null && isBattleInProgress(current.state)
  })

  /** Tối đa 5 actor kế tiếp theo gauge order (turn-order strip). */
  const upcomingActors = computed<TurnBattleParticipant[]>(() => {
    stateVersion.value

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

  // Combat speed gauge + round indicator (2026-09-12) — ATB round counter
  // and the stage that launched this battle (for its perfectClearTurnLimit).
  // Both are read-only views over GameManager-owned state.
  const roundsElapsed = computed(() => {
    stateVersion.value

    return battle.value?.roundsElapsed ?? 0
  })

  /** buff2 M4 -- live buff snapshots for the turn-strip badges; reads
      the battle's buff authority through the ops delegate. */
  const buffsForTarget = (entityId: string) => gameManager.getBattleBuffs(entityId)

  const activeStage = computed(() => {
    stateVersion.value

    return gameManager.getActiveTurnBattleStage()
  })

  /**
   * T4-36 - participant-id -> display name lookup for log/turn text.
   * Same players-then-enemies idiom the engine itself uses
   * (TurnBattleSystem execActor lookup); ids stay internal.
   */
  const participantNameOf = (participantId: string): string | undefined => {
    const current = battle.value

    if (!current) {
      return undefined
    }

    const participant =
      current.players.find((member) => member.id === participantId) ??
      current.enemies.find((enemy) => enemy.id === participantId)

    return participant?.entity.name
  }

  return {
    battle,
    isBattleFighting,
    isBattleInProgress: isBattleInProgressNow,
    upcomingActors,
    logEntries,
    roundsElapsed,
    activeStage,
    buffsForTarget,
    participantNameOf,
  }
}
