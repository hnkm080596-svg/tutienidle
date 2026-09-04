import { computed } from 'vue'
import { useGameManager, useStateVersion } from './useGameState'
import type { TurnSkillPresentationEntry } from '@/core/combat/CombatSkillPresentation'
import type { TurnSkillSlotRole } from '@/core/battle/turn/TurnSkillAction'

/**
 * Slice 7 (Completion Task 10 + master plan Task 5 hợp nhất) — cầu nối
 * reactivity giữa turn-based engine (GameManager/TurnBattle) và Vue cho
 * manual UI. Cầu nối duy nhất là stateVersion (App.vue tick + bumpState)
 * như các composable combat khác — KHÔNG setInterval/rAF riêng.
 */
export function useTurnCombatManual() {
  const gameManager = useGameManager()
  const { stateVersion, bumpState } = useStateVersion()

  const battle = computed(() => {
    stateVersion.value

    return gameManager.getTurnBattle()
  })

  const isBattleFighting = computed(() => battle.value?.state === 'fighting')

  const isAwaitingChoice = computed(() => {
    stateVersion.value

    return gameManager.isAwaitingManualTurnChoice()
  })

  const isManualMode = computed(() => {
    stateVersion.value

    return gameManager.isBattleManualMode()
  })

  const presentation = computed(() => {
    stateVersion.value

    const current = battle.value

    if (!current) {
      return null
    }

    return gameManager.buildTurnSkillPresentation(current, isAwaitingChoice.value)
  })

  const slots = computed<Record<TurnSkillSlotRole, TurnSkillPresentationEntry | null>>(() => {
    const entry = presentation.value

    return {
      basic: entry?.basic ?? null,
      special: entry?.special ?? null,
      ultimate: entry?.ultimate ?? null,
    }
  })

  const slotList = computed<TurnSkillPresentationEntry[]>(() => {
    const entry = presentation.value

    if (!entry) {
      return []
    }

    return [entry.basic, entry.special, entry.ultimate]
  })

  /** Bấm 1 slot role — chỉ khi đang pause chờ choice; slot không ready đã bị disable ở UI. */
  function chooseSlot(role: TurnSkillSlotRole): void {
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
    isBattleFighting,
    isAwaitingChoice,
    isManualMode,
    slots,
    slotList,
    chooseSlot,
    setManualMode,
  }
}
