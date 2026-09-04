import { computed } from 'vue'
import { useGameManager, useStateVersion } from './useGameState'
import {
  buildTurnSkillPresentation,
  type TurnSkillPresentationState,
  type TurnSkillRole,
} from '@/core/combat/CombatSkillPresentation'

/**
 * Slice 7 (Completion Task 10) — cầu nối reactivity giữa turn-based
 * engine (GameManager/TurnBattle) và Vue cho manual UI.
 *
 * Cầu nối duy nhất là stateVersion (App.vue tick + bumpState) như các
 * composable combat khác — KHÔNG setInterval/rAF riêng. Mọi giá trị
 * derive từ GameManager snapshot tại thời điểm đọc.
 */
export function useTurnCombatManual() {
  const gameManager = useGameManager()
  const { stateVersion, bumpState } = useStateVersion()

  const battle = computed(() => {
    stateVersion.value

    return gameManager.getTurnBattle()
  })

  const playerParticipant = computed(() => battle.value?.player ?? null)

  const isBattleFighting = computed(() => battle.value?.state === 'fighting')

  const isAwaitingChoice = computed(() => {
    stateVersion.value

    return gameManager.isAwaitingManualTurnChoice()
  })

  const isManualMode = computed(() => {
    stateVersion.value

    return gameManager.isBattleManualMode()
  })

  const slots = computed<TurnSkillPresentationState[]>(() => {
    stateVersion.value

    const participant = playerParticipant.value

    if (!participant) {
      return []
    }

    return buildTurnSkillPresentation({
      entity: participant.entity,
      basic: participant.basic,
      special: participant.special?.skill,
      ultimate: participant.ultimate?.skill,
      specialRemainingCooldownTurns: participant.special?.remainingCooldownTurns ?? 0,
      ultimateRemainingCooldownTurns: participant.ultimate?.remainingCooldownTurns ?? 0,
      isPlayersPausedTurn: gameManager.isAwaitingManualTurnChoice(),
    })
  })

  /** Bấm 1 slot role — chỉ khi đang pause chờ choice; slot không ready đã bị disable ở UI. */
  function chooseSlot(role: TurnSkillRole): void {
    if (!gameManager.isAwaitingManualTurnChoice()) {
      return
    }

    gameManager.submitTurnChoice(role)

    bumpState()
  }

  function setManualMode(enabled: boolean): void {
    gameManager.setBattleManualMode(enabled)

    bumpState()
  }

  return {
    battle,
    playerParticipant,
    isBattleFighting,
    isAwaitingChoice,
    isManualMode,
    slots,
    chooseSlot,
    setManualMode,
  }
}
