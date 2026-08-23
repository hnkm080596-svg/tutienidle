import { usePlayerStore } from '../stores/player'
import { useUiStore } from '../stores/ui'
import { useGameManager, useStateVersion } from './useGameState'
import type { Stage } from '../core/stage/Stage'
import type { BattleRunMode } from '../stores/ui'

/**
 * Trước đây chỉ gọi được qua debug hook/console (fightWolf() cục bộ
 * trong App.vue) — tách ra composable để nút "Bắt Đầu" thật trong UI
 * (StageSelectPanel.vue) gọi được.
 *
 * Thám Hiểm rework — startBattle() không còn hardcode STAGES[0] nữa,
 * nhận thẳng `stage` do caller chọn. Combat UI Redesign — caller giờ
 * là StageSelectPanel.vue's startSelectedStage() (trận đầu) hoặc
 * CombatVictoryPanel.vue's refight() (Đánh Lại/Auto-refight — đọc lại
 * ui.selectedStageId, KHÔNG còn App.vue's fightStage() cũ nữa, xem
 * App.vue's tick()).
 *
 * Trảm gate (blockIfNoBasicAttack, 2026-08-20 → gỡ 2026-08-21) — Pháp
 * Tu giờ tự học + trang bị SẴN 1 chiêu cơ bản (Hỏa Cầu Thuật) ngay lúc
 * chọn path (xem GameManager.chooseCultivationPath()), nên tình huống
 * "chưa trang bị gì" không còn xảy ra nữa — bỏ hẳn kiểm tra trước
 * trận đấu này, không chỉ Pháp Tu mà mọi path.
 */
export function useBattleActions() {
  const player = usePlayerStore()
  const ui = useUiStore()
  const gameManager = useGameManager()
  const { bumpState } = useStateVersion()

  function startBattle(stage: Stage) {
    // finalStats (từ store) đã cộng đủ modifiers + externalModifiers,
    // GameManager chỉ nhận và convert sang CombatEntity, không tính lại.
    const started = gameManager.startStage(player.$state, player.finalStats, stage, ui.battleRunMode === 'repeat')

    bumpState()

    return started
  }

  /**
   * Bấm "Bắt Đầu" ở StageSelectPanel.vue — bỏ trạng thái tu luyện
   * (spec "hero sẽ bỏ trạng thái tu luyện"), ghi nhớ Màn/chế độ đã
   * chọn cho Auto-refight (xem App.vue's fightStage()), đóng panel để
   * quay lại Home Scene xem trận đấu diễn ra.
   */
  function startSelectedStage(zoneId: string, stage: Stage, mode: BattleRunMode) {
    // isCultivating giờ SUY RA từ isFighting mỗi tick (App.vue's tick()),
    // KHÔNG cần set tay ở đây nữa — nhưng vẫn emit NGAY để pose ngồi
    // thiền tắt tức thời lúc bấm "Bắt Đầu", không đợi tick kế tiếp.
    gameManager.eventBus.emit('cultivation_changed', { isCultivating: false })

    ui.selectedZoneId = zoneId
    ui.selectedStageId = stage.id
    ui.battleRunMode = mode
    ui.leftPanelMode = null
    ui.enterCombatScene('stage')

    return startBattle(stage)
  }

  return { startBattle, startSelectedStage }
}
