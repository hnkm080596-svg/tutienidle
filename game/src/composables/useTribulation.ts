import { inject } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useGameManager } from './useGameState'
import { GAME_PRESENTATION_KEY } from '@/presentation/PresentationContracts'
import type { GamePresentation } from '@/presentation/createGamePresentation'
import type { GameManager } from '../core/game/GameManager'
import { TribulationOutcomeService, type TribulationOutcomeResult, type TribulationPlayerWriter } from '../core/tribulation/TribulationOutcomeService'
import { useWorldAnnouncementStore } from '../stores/worldAnnouncement'
import { useUiStore } from '../stores/ui'
import { isBattleInProgress } from '../core/battle/BattleTypes'
import { i18n } from '@/i18n'

// R8.2 (AR-10): outcome authority lives in TribulationOutcomeService (core).
// This adapter keeps ONLY presentation sequencing: announcements, scene
// exit, route home, panel navigation. Zero player-state writes here.

// Tr?m gate (blockIfNoBasicAttack, 2026-08-20 -> gap 2026-08-21) - PhA?p
// Tu t? h?c + trang b? S?N 1 chiA?u c? b?n ngay lA?c ch?n path, tA�nh
// hu?ng "chua trang b? gA�" khA4ng cA2n x?y ra.

function resolveNextBreakthroughRealm(currentRealmId: string): string | null {
  if (currentRealmId === 'mortal') return 'qi_refining'
  if (currentRealmId === 'qi_refining') return 'foundation_establishment'
  return null
}

/**
 * Bấm nút đột phá (Quán Khí / Trúc Cơ / Độ Kiếp sau Trúc Cơ). Tự
 * resolve target realm từ player.realmId hiện tại.
 *
 * Luôn auto-unequip TRƯỚC khi vào kiếp (idempotent — không có đồ thì
 * không tháo gì). Caller hiện panel xác nhận "Độ kiếp cũng là độ thân"
 * trước khi gọi hàm này.
 */
export function triggerBreakthroughAction(
  player: ReturnType<typeof usePlayerStore>,
  gameManager: GameManager,
  presentation?: GamePresentation | null,
): boolean | Promise<boolean> {
  if (!gameManager.realmAdvanceOps.canTriggerBreakthrough(player.$state)) {
    return false
  }

  const battle = gameManager.getBattle()
  if (battle && isBattleInProgress(battle.state)) {
    return false
  }

  const tribulationOutcomeService = new TribulationOutcomeService()
  const targetRealmId = resolveNextBreakthroughRealm(player.realmId)
  if (!targetRealmId) {
    return false
  }

  if (presentation) {
    return (async () => {
      // No compensate: there is no domain cancel-tribulation command, and the
      // spec forbids inventing one. Orphaning is prevented up front instead -
      // canEnter('tribulation') is checked before this command runs, and the
      // session is read kind-scoped so it can never be the combat session.
      const result = await presentation.runAdmitted(
        'tribulation',
        () => {
          // R8.2 Slice 3: domain owns the start-side prep (unequip-all +
          // modifier sync) and the start itself; the adapter only reads the
          // presentation session afterwards.
          const started = tribulationOutcomeService.startTribulationPrepared(
            player,
            gameManager,
            targetRealmId,
            player.finalStats,
          )
          if (!started) return null
          const session = gameManager.getCurrentPresentationSession('tribulation')
          return session ? { target: 'tribulation', session } : null
        },
      )

      if (result.status === 'entered') {
        useUiStore().enterTribulationScene()
        return true
      }
      return false
    })()
  }

  // Fallback for tests without presentation
  const started = tribulationOutcomeService.startTribulationPrepared(
    player,
    gameManager,
    targetRealmId,
    player.finalStats,
  )

  if (started) {
    useUiStore().enterTribulationScene()
  }

  return started
}

/** Presentation sequencing driven by the typed domain outcome. */
function presentOutcome(result: TribulationOutcomeResult): void {
  const ui = useUiStore()
  const announcements = useWorldAnnouncementStore()
  const { announcement } = result

  // P16: the domain returns i18n keys + params; the gateway resolves the
  // display strings here (module-level function — i18n.global.t, not the
  // setup-scoped useI18n composable).
  announcements.show(
    i18n.global.t(announcement.titleKey, announcement.titleParams ?? {}),
    i18n.global.t(announcement.bodyKey, announcement.bodyParams ?? {}),
  )

  if (result.kind === 'victory' && result.standalonePanel) {
    ui.standalonePanel = result.standalonePanel
  }
}

/**
 * Gọi mỗi tick từ App.vue, TRƯỚC nhánh Auto-refight Stage — battle
 * Tribulation không qua Stage nên GameManager chỉ tự set 'victory'/
 * 'defeat'. Domain (TribulationOutcomeService) áp kết quả lên player;
 * adapter này chỉ dọn session + điều phối hiển thị. Trả về true nếu VỪA
 * xử lý xong 1 kết quả trong tick này, để App.vue biết bỏ qua Auto-refight
 * Stage ngay tick đó (tránh startStage() đè mất battle Tribulation vừa
 * kết thúc trước khi kịp đọc).
 */
export function checkTribulationOutcomeAction(
  player: ReturnType<typeof usePlayerStore>,
  gameManager: GameManager,
  presentation?: GamePresentation | null,
): boolean {
  const active = gameManager.tribulationDirector.getState()

  if (!active) {
    return false
  }

  // Kiếp mới (spec dot-pha-loi-kiep §5.1) KHÔNG qua battle — state nằm
  // trong ActiveTribulationState của Director.
  if (active.state === 'ongoing') {
    return false
  }

  // Outcome authority (R8.2): domain applies realm/talent/foundation/
  // penalty writes; presentation consumes the typed result.
  const applyOutcome = (): boolean => {
    const service = new TribulationOutcomeService()
    const stats = player.finalStats
    let result: TribulationOutcomeResult
    if (active.state === 'victory') {
      result = service.resolveVictory(player as TribulationPlayerWriter, gameManager, active)
    } else {
      result = service.resolveDefeat(player as TribulationPlayerWriter, gameManager, active, stats)
    }

    presentOutcome(result)

    gameManager.tribulationDirector.clear()
    useUiStore().exitTribulationScene()
    gameManager.eventBus.emit('tribulation_scene_exit', undefined)

    return true
  }


  if (presentation) {
    // Every visible effect of the outcome (realm/penalty writes reflecting
    // in home UI, announcement overlay, standalone panel, tribulation exit)
    // runs inside the closed-curtain window: the tribulation scene stays on
    // screen while the curtain travels and home is revealed only after the
    // swap completes. A rejected request leaves the outcome pending - the
    // next tick re-issues it - and a duplicate tick while in-flight shares
    // the same request, so the work still runs exactly once. Returning true
    // regardless keeps the caller's same-tick auto-refight suppression.
    void presentation.coordinator.request({ target: 'home', behindCurtain: applyOutcome })
    return true
  }

  applyOutcome()

  return true
}

/**
 * Cầu nối Vue cho component CON (đọc player/gameManager qua injection
 * bình thường, xem useGameState.ts). App.vue tự gọi thẳng *Action() ở
 * trên thay vì composable này.
 */
export function useTribulation() {
  const player = usePlayerStore()
  const gameManager = useGameManager()
  const presentation = inject(GAME_PRESENTATION_KEY, null)

  return {
    triggerBreakthrough: () => triggerBreakthroughAction(player, gameManager, presentation),
    checkTribulationOutcome: () => checkTribulationOutcomeAction(player, gameManager, presentation),
  }
}
