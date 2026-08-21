import { computed } from 'vue'
import { useGameManager, useStateVersion } from './useGameState'
import { useUiStore } from '../stores/ui'

/**
 * Combat UI Redesign — Combat Scene (CombatSceneOverlay.vue + Phaser's
 * CombatScene.ts) chiếm TOÀN màn hình trong lúc 1 trận đang diễn ra
 * HOẶC vừa kết thúc nhưng CombatResultModal chưa bị đóng (battle.state
 * 'victory'/'defeat' vẫn "sticky" tới khi trận mới ghi đè, xem
 * BattleSystem.ts) — ui.combatSceneDismissed là cờ RIÊNG để phân biệt
 * "vừa xong, đang đợi người chơi xem kết quả" với "người chơi đã bấm
 * Tiếp Tục/Về Động Phủ, không hiện nữa dù object battle cũ vẫn còn".
 * Cùng pattern reactivity với useStageActive.ts (đọc stateVersion.value
 * trực tiếp vì gameManager.getBattle() trả object mutate-in-place).
 */
export function useCombatSceneActive() {
  const gameManager = useGameManager()
  const { stateVersion } = useStateVersion()
  const ui = useUiStore()

  return computed(() => {
    stateVersion.value

    if (ui.combatSceneDismissed) {
      return false
    }

    const battle = gameManager.getBattle()

    return battle !== null && battle.state !== 'idle'
  })
}
