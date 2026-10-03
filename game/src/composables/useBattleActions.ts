import { inject } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useUiStore } from '../stores/ui'
import { useGameManager, useStateVersion } from './useGameState'
import { GAME_PRESENTATION_KEY } from '@/presentation/PresentationContracts'
import type { Stage } from '../core/stage/Stage'
import type { BattleRunMode } from '../stores/ui'

/**
 * Truoc day chi goi duoc qua debug hook/console (fightWolf() cuc bo
 * trong App.vue) - tach ra composable de nut "Bat Dau" that trong UI
 * (StageSelectPanel.vue) goi duoc.
 *
 * Tham Hiem rework - startBattle() khong con hardcode STAGES[0] nua,
 * nhan thang `stage` do caller chon. Combat UI Redesign - caller gio
 * la StageSelectPanel.vue's startSelectedStage() (tran dau) hoac
 * CombatVictoryPanel.vue's refight() (Danh Lai/Auto-refight - doc lai
 * ui.selectedStageId, KHONG con App.vue's fightStage() cu nua, xem
 * App.vue's tick()).
 *
 * Tram gate (blockIfNoBasicAttack, 2026-08-20 -> go 2026-08-21) - Phap
 * Tu gio tu hoc + trang bi SAN 1 chieu co ban (Hoa Cau Thuat) ngay luc
 * chon path (xem GameManager.chooseCultivationPath()), nen tinh huong
 * "chua trang bi gi" khong con xay ra nua - bo han kiem tra truoc
 * tran dau nay, khong chi Phap Tu ma moi path.
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
   * ARCH-002 (M7): callers no longer pass finalStats - the ops resolves
   * the base post-reset via resolvePlayerFinalStats + the live provider.
   */
  async function runStageStart(
    stage: Stage,
    repeat: boolean,
    commit: () => void,
  ): Promise<boolean> {
    const startStage = () =>
      gameManager.turnBattleOps.startStage(player.$state, stage, repeat)

    if (!presentation) {
      const started = startStage()

      if (started) {
        commit()
      }

      return started
    }

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
  }

  function startBattle(stage: Stage): Promise<boolean> {
    return runStageStart(stage, ui.battleRunMode === 'repeat', () => {
      ui.enterCombatScene('stage')
      bumpState()
    })
  }

  /**
   * Combat -> home exit shared by every result/exit control (victory
   * "Tiep Tuc", defeat "Ve Dong Phu", exit-confirm "Thoat Tran", the 10s
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
   * Bam "Bat Dau" o StageSelectPanel.vue - admission truoc startSelectedStage (F07).
   * Chi khi startStage thanh cong moi dong panel, emit pose, va vao combat UI.
   */
  function startSelectedStage(zoneId: string, stage: Stage, mode: BattleRunMode): Promise<boolean> {
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
