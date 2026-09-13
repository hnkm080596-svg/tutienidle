import { usePlayerStore } from '../stores/player'
import { useGameManager } from './useGameState'
import { useWorldAnnouncementStore } from '../stores/worldAnnouncement'
import type { GameManager } from '../core/game/GameManager'
import type { BreakthroughOutcomeResult } from '../core/tribulation/BreakthroughOutcomeService'
import { i18n } from '@/i18n'

/**
 * R8.2 Slice 2 (AR-10): outcome authority lives in
 * BreakthroughOutcomeService (core) via the GameManager facade
 * `breakthroughWithConsequences`. This adapter keeps ONLY presentation:
 * the major-realm world announcement driven by the typed result.
 * Zero player-state writes remain here.
 *
 * Previously (2026-08-20) this composable owned the whole consequence
 * chain: realm passive sync, the phap_tu KC technique grant, artifact
 * awakening, and the banked artifact tier release. All migrated verbatim
 * to the domain service — behavior parity pinned by
 * BreakthroughOutcomeService.test.ts and the pre-existing
 * cultivationRitualFlow.integration tests.
 *
 * `gameManagerOverride` (Auto Đột Phá) — App.vue's tick() calls this
 * composable directly but is NOT inside its own provide() subtree (inject
 * would throw), so it passes its local GameManager instance. Every other
 * caller keeps the inject behavior.
 */
export function useBreakthrough(gameManagerOverride?: GameManager) {
  const player = usePlayerStore()
  const gameManager = gameManagerOverride ?? useGameManager()
  const worldAnnouncement = useWorldAnnouncementStore()

  function breakthrough(): boolean {
    const result: BreakthroughOutcomeResult =
      gameManager.realmAdvanceOps.breakthroughWithConsequences(player)

    if (result.kind === 'failure') {
      return false
    }

    // Beta Phase 4 (World Announcement) — major-realm change is a
    // milestone (minor-level successes announce nothing; the tribulation
    // chain owns its own announcements since Slice 1). P16: the domain
    // returns i18n keys + params; the gateway resolves them here.
    if (result.announcement) {
      worldAnnouncement.show(
        i18n.global.t(result.announcement.titleKey, result.announcement.titleParams ?? {}),
        i18n.global.t(result.announcement.bodyKey, result.announcement.bodyParams ?? {}),
      )
    }

    return true
  }

  return { breakthrough }
}
