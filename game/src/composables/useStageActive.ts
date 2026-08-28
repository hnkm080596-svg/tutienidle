import { computed } from 'vue'
import { useGameManager, useStateVersion } from './useGameState'
import { useUiStore } from '../stores/ui'
import { isBattleInProgress } from '../core/battle/BattleTypes'

// Trích từ HomeBuildingIcons.vue (Động Phủ UI redesign, giờ DongFuScene.vue
// cũng cần đúng check này) — đang ở giữa 1 Stage hoặc trận đang đánh,
// camera MainScene.ts đang zoom vào khung combat nên mọi thứ tĩnh của
// Home Scene (building icon, background động phủ) phải tự ẩn, tránh
// đè lên khung combat.
//
// Result lifecycle (2026-08-26) — victory/defeat vẫn được coi là "đang
// hiển thị Combat Scene" cho tới khi người chơi chọn: khi thắng,
// StageWaveSystem gọi stageManager.stop() làm điều kiện cũ trả false,
// khiến DongFuScene hiện lại che canvas dù CombatScene chưa thoát. Home
// CHỈ được hiện khi combatSceneDismissed === true (người chơi đã bấm
// "Tiếp Tục"/"Về Động Phủ") hoặc chưa từng vào combat (combatOrigin
// null). Không dùng scene.pause() để giữ màn — core tự ngừng combat vì
// battle không còn state fighting.
export function useStageActive() {
  const gameManager = useGameManager()
  const ui = useUiStore()
  const { stateVersion } = useStateVersion()

  return computed(() => {
    stateVersion.value

    if (ui.combatOrigin !== null && !ui.combatSceneDismissed) {
      return true
    }

    // Scene Độ Kiếp có overlay riêng — Động Phủ không được lộ xuyên.
    if (ui.isTribulationSceneActive) {
      return true
    }

    return gameManager.stageManager.get() !== null || isBattleInProgress(gameManager.getBattle()?.state)
  })
}
