import { inject } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useUiStore } from '../stores/ui'
import { useGameManager, useStateVersion } from './useGameState'
import { GAME_PRESENTATION_KEY } from '@/presentation/PresentationContracts'
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
  const presentation = inject(GAME_PRESENTATION_KEY, null)

  /**
   * One entry path for every stage start, so "UI side effects happen ONLY
   * after the domain accepted the start" is structural instead of repeated
   * at each call site (F07). `commit` runs only on acceptance.
   *
   * finalStats (từ store) đã cộng đủ modifiers + externalModifiers,
   * GameManager chỉ nhận và convert sang CombatEntity, không tính lại.
   */
  function runStageStart(
    stage: Stage,
    repeat: boolean,
    commit: () => void,
  ): boolean | Promise<boolean> {
    const startStage = () =>
      gameManager.startStage(player.$state, player.finalStats, stage, repeat)

    if (!presentation) {
      const started = startStage()

      if (started) {
        commit()
      }

      return started
    }

    return (async () => {
      const result = await presentation.runAdmitted(
        'combat',
        () => {
          if (!startStage()) {
            return null
          }

          const session = gameManager.getCurrentPresentationSession('combat')

          return session ? { target: 'combat', session } : null
        },
        { compensate: () => void gameManager.abandonBattle() },
      )

      if (result.status !== 'entered') {
        return false
      }

      commit()

      return true
    })()
  }

  function startBattle(stage: Stage): boolean | Promise<boolean> {
    return runStageStart(stage, ui.battleRunMode === 'repeat', () => {
      ui.enterCombatScene('stage')
      bumpState()
    })
  }

  /**
   * Combat -> home exit shared by every result/exit control (victory
   * "Tiếp Tục", defeat "Về Động Phủ", exit-confirm "Thoát Trận", the 10s
   * auto-return fallback). All visible teardown - battle abandon, run-mode
   * reset, dismissed flag, the scene-exit event the canvas listens to -
   * runs inside the closed-curtain window so nothing changes on screen
   * while the curtain is still travelling. Without presentation
   * (standalone tests) it runs synchronously, matching pre-coordinator
   * behavior.
   *
   * `abandon` covers the mid-battle exit: abandonBattle() self-guards and
   * returns false when the battle already ended on its own during the
   * close - the exit still stands either way, so its result is ignored.
   */
  function exitCombatToHome(options: { abandon?: boolean } = {}): void {
    const teardown = (): boolean => {
      if (options.abandon) {
        gameManager.abandonBattle()
      }

      ui.battleRunMode = 'manual'
      ui.exitCombatScene()
      gameManager.eventBus.emit('combat_scene_exit', undefined)

      return true
    }

    if (!presentation) {
      teardown()
      return
    }

    void presentation.coordinator.request({ target: 'home', behindCurtain: teardown })
  }

  /**
   * Bấm "Bắt Đầu" ở StageSelectPanel.vue — admission trước startSelectedStage (F07).
   * Chỉ khi startStage thành công mới đóng panel, emit pose, và vào combat UI.
   */
  function startSelectedStage(zoneId: string, stage: Stage, mode: BattleRunMode): boolean | Promise<boolean> {
    return runStageStart(stage, mode === 'repeat', () => {
      gameManager.eventBus.emit('cultivation_changed', { isCultivating: false })
      ui.selectedZoneId = zoneId
      ui.selectedStageId = stage.id
      ui.battleRunMode = mode
      ui.leftPanelMode = null
      ui.enterCombatScene('stage')
      bumpState()
    })
  }

  return { startBattle, startSelectedStage, exitCombatToHome }
}
