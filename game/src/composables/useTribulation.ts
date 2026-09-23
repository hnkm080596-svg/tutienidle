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
import { getNextRealm } from '../core/realm/realmSystem'
import { i18n } from '@/i18n'

// R8.2 (AR-10): outcome authority lives in TribulationOutcomeService (core).
// M6 (ARCH-006): the once-only settlement commit is domain-owned too -
// TribulationDirector stamps a committed-outcome record at the terminal
// transition and the service settles it exactly once, independent of the
// curtain. This adapter keeps ONLY presentation sequencing: announcements,
// scene exit, route home, panel navigation. Zero player-state writes here.

// Tr?m gate (blockIfNoBasicAttack, 2026-08-20 -> gap 2026-08-21) - PhA?p
// Tu t? h?c + trang b? S?N 1 chiA?u c? b?n ngay lA?c ch?n path, tA�nh
// hu?ng "chua trang b? gA�" khA4ng cA2n x?y ra.

/**
 * Bam nut dot pha (Quan Khi / Truc Co / Do Kiep sau Truc Co). Tu
 * resolve target realm tu player.realmId hien tai.
 *
 * Luon auto-unequip TRUOC khi vao kiep (idempotent - khong co do thi
 * khong thao gi). Caller hien panel xac nhan "Do kiep cung la do than"
 * truoc khi goi ham nay.
 */
export function triggerBreakthroughAction(
  player: ReturnType<typeof usePlayerStore>,
  gameManager: GameManager,
  presentation?: GamePresentation | null,
): boolean | Promise<boolean> {
  if (!gameManager.realmAdvanceOps.canTriggerBreakthrough(player.$state)) {
    return false
  }

  const battle = gameManager.getTurnBattle()
  if (battle && isBattleInProgress(battle.state)) {
    return false
  }

  const tribulationOutcomeService = new TribulationOutcomeService()
  const targetRealmId = getNextRealm(player.realmId)?.id ?? null
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
          )
          if (!started) return null
          const session = gameManager.getCurrentPresentationSession('tribulation')
          return session ? { target: 'tribulation', session } : null
        },
      )

      return result.status === 'entered'
    })()
  }

  // Fallback for tests without presentation
  return tribulationOutcomeService.startTribulationPrepared(
    player,
    gameManager,
    targetRealmId,
  )
}

/** Presentation sequencing driven by the typed domain outcome. */
function presentOutcome(result: TribulationOutcomeResult): void {
  const ui = useUiStore()
  const announcements = useWorldAnnouncementStore()
  const { announcement } = result

  // P16: the domain returns i18n keys + params; the gateway resolves the
  // display strings here (module-level function - i18n.global.t, not the
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
 * M6 r1 - the outcome committed at the domain level but its consequence
 * apply threw mid-flight (record marked terminal-failed). There is no
 * receipt to render, so surface a generic failure announcement instead;
 * the run still drains home so the player is never soft-locked.
 */
function presentSettlementError(): void {
  const announcements = useWorldAnnouncementStore()
  announcements.show(
    i18n.global.t('announce.tribulation.settlementError.title'),
    i18n.global.t('announce.tribulation.settlementError.body'),
  )
}

/**
 * Goi moi tick tu App.vue, TRUOC nhanh Auto-refight Stage - battle
 * Tribulation khong qua Stage nen GameManager chi tu set 'victory'/
 * 'defeat'. Domain (TribulationOutcomeService) ap ket qua len player;
 * adapter nay chi don session + dieu phoi hien thi. Tra ve true neu VUA
 * xu ly xong 1 ket qua trong tick nay, de App.vue biet bo qua Auto-refight
 * Stage ngay tick do (tranh startStage() de mat battle Tribulation vua
 * ket thuc truoc khi kip doc).
 */
export function checkTribulationOutcomeAction(
  player: ReturnType<typeof usePlayerStore>,
  gameManager: GameManager,
  presentation?: GamePresentation | null,
): boolean {
  // M6 / ARCH-006: settlement is a domain command that runs BEFORE and
  // INDEPENDENT of the curtain (P17/A7). The trigger is the domain-owned
  // committed-outcome record - stamped once by the director's single
  // terminal commit (commitOutcome), bound to the run's attempt identity -
  // not the mutable live state object. The once-only commit of
  // realm/cultivation/stones/foundation/talent/penalty writes lands here
  // on the tick, so a rejected request, a curtain failure, or a reload
  // mid-transition can never strand an uncommitted outcome. Repeat calls
  // re-settle onto the SAME bound receipt - consequences can never
  // double-apply, and a duplicate tick while the route request is
  // in-flight is a no-op. The record stays pending until clear() drains
  // the run inside the curtain.
  const director = gameManager.tribulationDirector
  const committed = director.getCommittedOutcome()

  if (!committed) {
    return false
  }

  const service = new TribulationOutcomeService()
  const result = service.settleOutcome(
    player as TribulationPlayerWriter,
    gameManager,
    director,
  )

  if (result) {
    // M-F-TALENT lock (ruling S15-18): while the mandatory talent
    // entitlement is unresolved the transition is NOT finished - hold
    // the committed outcome on the seam and defer the drain. Every tick
    // re-checks the persisted record; once the modal resolves it, the
    // same tick consumes the receipt and drains normally. Returning true
    // preserves the caller's same-tick auto-refight suppression (a
    // pending decision is still a committed victory).
    if (player.pendingTalentEntitlement !== undefined) {
      return true
    }

    // Presentation consumes the committed receipt. The visible effects
    // (announcement overlay, standalone panel, tribulation scene exit and
    // the run drain) stay behind the curtain per R12 sequencing - but they
    // only RENDER the receipt; the commit already happened above.
    const consumeReceipt = (): boolean => {
      presentOutcome(result)

      director.clear()

      return true
    }

    if (presentation) {
      // Every visible effect of the outcome (announcement overlay,
      // standalone panel, tribulation exit) runs inside the closed-curtain
      // window: the tribulation scene stays on screen while the curtain
      // travels and home is revealed only after the swap completes. A
      // rejected request leaves the committed outcome pending - the next
      // tick re-issues it (settlement itself is already done and idempotent)
      // - and a duplicate tick while in-flight shares the same request, so
      // the drain still runs exactly once. Returning true regardless keeps
      // the caller's same-tick auto-refight suppression.
      void presentation.coordinator.request({ target: 'home', behindCurtain: consumeReceipt })
      return true
    }

    consumeReceipt()

    return true
  }

  // M6 r1 containment: a resolve that threw mid-apply marked the record
  // terminal-failed inside settleOutcome (the exception never escapes
  // into the tick loop, and later settles can never re-run the apply).
  // The outcome is still domain-final, so route the player home and drain
  // the run inside the curtain - the failure surfaces as an announcement
  // and the same pending/retry semantics apply.
  if (committed.settlementError) {
    const drainFailedRun = (): boolean => {
      presentSettlementError()

      director.clear()

      return true
    }

    if (presentation) {
      void presentation.coordinator.request({ target: 'home', behindCurtain: drainFailedRun })
      return true
    }

    drainFailedRun()

    return true
  }

  return false
}

/**
 * Cau noi Vue cho component CON (doc player/gameManager qua injection
 * binh thuong, xem useGameState.ts). App.vue tu goi thang *Action() o
 * tren thay vi composable nay.
 */
export function useTribulation() {
  const player = usePlayerStore()
  const gameManager = useGameManager()
  const presentation = inject(GAME_PRESENTATION_KEY, null)

  return {
    triggerBreakthrough: () => triggerBreakthroughAction(player, gameManager, presentation),
  }
}
