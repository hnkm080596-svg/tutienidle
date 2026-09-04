import { computed } from 'vue'
import { useGameManager, useStateVersion } from './useGameState'
import type { TurnSkillPresentationEntry } from '@/core/combat/CombatSkillPresentation'
import type { TurnSkillSlotRole } from '@/core/battle/turn/TurnSkillAction'

// Slice 7 (master plan Task 5, 2026-09-04) — rewrite cho 3 skill role cố
// định: bản cũ đọc buildLoadoutPresentation (N-slot loadout + shape
// real-time Battle) — dead code từ Slice 6 cutover. batKiemTickSeconds/
// tuLucState/skillFor/unlockedSlotCount/loadout đều retire (channel-tick
// UI được gỡ kèm HUD legacy; TurnSkillDefinition không phải Skill object
// nên skillFor không còn nghĩa — tên skill hiển thị là gap content hiển
// thị, xử lý khi HUD legacy được thay — không âm thầm bỏ qua).
//
// Cầu nối reactivity duy nhất là stateVersion (App.vue tick + bumpState)
// — KHÔNG setInterval/rAF riêng.

export function useCombatSkillPresentation() {
  const gameManager = useGameManager()
  const { stateVersion } = useStateVersion()

  const isPlayerTurnPaused = computed(() => {
    stateVersion.value

    return gameManager.isAwaitingManualTurnChoice()
  })

  const presentation = computed(() => {
    stateVersion.value

    const battle = gameManager.getTurnBattle()

    if (!battle) {
      return null
    }

    return gameManager.buildTurnSkillPresentation(battle, isPlayerTurnPaused.value)
  })

  const basic = computed<TurnSkillPresentationEntry | null>(() => presentation.value?.basic ?? null)
  const special = computed<TurnSkillPresentationEntry | null>(() => presentation.value?.special ?? null)
  const ultimate = computed<TurnSkillPresentationEntry | null>(() => presentation.value?.ultimate ?? null)

  const entriesByRole = computed<Record<TurnSkillSlotRole, TurnSkillPresentationEntry | null>>(() => ({
    basic: basic.value,
    special: special.value,
    ultimate: ultimate.value,
  }))

  function chooseSkill(slot: TurnSkillSlotRole) {
    if (!isPlayerTurnPaused.value) {
      return
    }

    gameManager.submitTurnChoice(slot)
  }

  return { basic, special, ultimate, entriesByRole, isPlayerTurnPaused, chooseSkill }
}
