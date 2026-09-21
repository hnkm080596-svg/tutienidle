import { computed } from 'vue'
import { useGameManager, useStateVersion } from './useGameState'
import type { TurnSkillPresentationEntry } from '@/core/combat/CombatSkillPresentation'
import type { TurnSkillDefinition, TurnSkillSlotRole } from '@/core/battle/turn/TurnSkillAction'

/**
 * Slice 7 (Completion Task 10 + master plan Task 5 hợp nhất) — cầu nối
 * reactivity giữa turn-based engine (GameManager/TurnBattle) và Vue cho
 * manual UI. Cầu nối duy nhất là stateVersion (App.vue tick + bumpState)
 * như các composable combat khác — KHÔNG setInterval/rAF riêng.
 *
 * ARCH-005 (M12): EVERY derived computed below reads stateVersion.value
 * directly — the engine mutates the TurnBattle object in place, so
 * `battle` resolves to the same reference forever and a computed
 * chained on it is never invalidated again after first eval (the skill
 * bar stayed invisible in live combat; 2026-09-14 audit). Same rule as
 * useTurnBattleInfo.
 */
export function useTurnCombatManual() {
  const gameManager = useGameManager()
  const { stateVersion, bumpState } = useStateVersion()

  const battle = computed(() => {
    stateVersion.value

    return gameManager.getTurnBattle()
  })

  const isBattleFighting = computed(() => {
    stateVersion.value

    return battle.value?.state === 'fighting'
  })

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
    stateVersion.value

    const entry = presentation.value

    return {
      basic: entry?.basic ?? null,
      special: entry?.special ?? null,
      ultimate: entry?.ultimate ?? null,
    }
  })

  const slotList = computed<TurnSkillPresentationEntry[]>(() => {
    stateVersion.value

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

  // Kiem Tu Reimagined Task 7 — sword_pathway manual orb picker. When the player
  // participant carries a dynamicBasic provider (Kiem Pho / Ngu Kiem
  // Dao) its manualOptions() are the ONLY legal manual picks — the
  // generic 3-slot basic button is replaced by these buttons.
  const dynamicBasicOptions = computed<readonly TurnSkillDefinition[]>(() => {
    stateVersion.value

    const current = battle.value

    if (!current || current.state !== 'fighting') {
      return []
    }

    return current.players[0]?.dynamicBasic?.manualOptions?.() ?? []
  })

  const hasDynamicBasic = computed(() => dynamicBasicOptions.value.length > 0)

  function chooseDynamicBasic(defId: string): void {
    if (!gameManager.isAwaitingManualTurnChoice()) {
      return
    }

    gameManager.submitTurnChoice({ kind: 'dynamic_basic', defId })

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
    dynamicBasicOptions,
    hasDynamicBasic,
    chooseDynamicBasic,
    setManualMode,
  }
}
