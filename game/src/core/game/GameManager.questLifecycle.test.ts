// R8.1 (AR-09) - GameManager wiring: quest activation must happen at
// lifecycle points (restore, daily rollover tick, realm transition),
// NOT on panel reads. These tests drive the REAL manager and never
// open the quest UI.
import { withMortalCreationPick } from '../../services/save/GameSave.fixture'
import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { QUESTS } from '../../data/quest/quests'
import { createDefaultPlayer } from '../player/Player'
import type { PlayerData } from '../player/Player'
import type { GameSave } from '../../services/save/SaveSystem'
import { CURRENT_SAVE_VERSION } from '../../services/save/saveVersion'

function makeManager(): { manager: GameManager; player: PlayerData } {
  const manager = new GameManager()
  manager.catalogOps.registerQuests(QUESTS)
  const player = createDefaultPlayer()
  manager.setActivePlayer(player)
  return { manager, player }
}

describe('GameManager quest lifecycle wiring (AR-09)', () => {
  it('kill counts on a fresh session BEFORE any QuestPanel read', () => {
    const { manager } = makeManager()

    // No getActiveQuests() call anywhere in this test. The first update
    // tick is the boot-time reconciliation trigger.
    manager.tickOps.update(1)

    manager.questSystem.onEnemyDefeated(
      manager.questRegistry,
      manager.questManager,
      'wild_wolf',
      undefined,
    )

    expect(manager.questManager.getProgress('kill_wild_wolf_10')?.progress).toBe(1)
  })

  it('daily rollover mid-session repopulates the board without UI', () => {
    const { manager, player } = makeManager()
    manager.tickOps.update(1)
    expect(manager.questManager.getProgress('daily_kill_bandit_15')).toBeDefined()

    // Simulate the next wall-clock day: checkAndResetDaily accepts a
    // `now` argument through the system (the tick path passes
    // Date.now(); here we exercise the domain command directly with a
    // future instant, then reconcile the same way the tick does).
    const future = Date.now() + 25 * 60 * 60 * 1000
    const reset = manager.questSystem.checkAndResetDaily(
      manager.questRegistry,
      manager.questManager,
      player,
      future,
    )
    expect(reset).toBe(true)
    // Reset clears the daily entry...
    expect(manager.questManager.getProgress('daily_kill_bandit_15')).toBeUndefined()
    // ...and the lifecycle reconciliation rebuilds today's board.
    manager.tickOps.reconcileQuestLifecycle()
    expect(manager.questManager.getProgress('daily_kill_bandit_15')).toBeDefined()
    expect(manager.questManager.getProgress('daily_kill_bandit_15')!.progress).toBe(0)
  })

  it('restore from save reconciles quests without UI', () => {
    const source = makeManager()
    const save: GameSave = withMortalCreationPick({
      version: CURRENT_SAVE_VERSION,
      player: { ...source.player, lastSavedAt: Date.now() },
      techniques: [],
      skills: [],
      materials: [],
      equipment: [],
      equipmentSlots: [],
      pills: [],
      talismans: [],
      formations: [],
      buildings: [],
      quests: { active: [], completedOnceIds: [], lastDailyResetAtMs: 0 },
      productionSites: [],
    })

    const fresh = new GameManager()
    fresh.catalogOps.registerQuests(QUESTS)
    fresh.setActivePlayer(createDefaultPlayer())
    fresh.saveOps.restoreFromSave(save)

    expect(fresh.questManager.getActive().length).toBeGreaterThan(0)
  })

  it('realm transition unlocks new quests on the next tick', () => {
    const { manager, player } = makeManager()
    manager.tickOps.update(1)

    const lockedBefore = manager.questManager.getProgress(
      QUESTS.find((q) => q.requiredRealmId === 'foundation_establishment')!.id,
    )
    expect(lockedBefore).toBeUndefined()

    player.realmId = 'foundation_establishment'
    manager.tickOps.markQuestRealmTransition()
    manager.tickOps.update(1)

    const unlockedIds = manager.questRegistry
      .getAll()
      .filter((q) => q.requiredRealmId === 'foundation_establishment')
      .map((q) => q.id)
    expect(unlockedIds.length).toBeGreaterThan(0)
    for (const id of unlockedIds) {
      // M-F-COMPANION-GIFT: the daily token faucet is a token-only source -
      // whole-quest suppressed at origination, so it never activates. Every
      // other foundation-locked quest unlocks on the transition.
      if (id === 'daily_chieu_hien_lenh') {
        expect(manager.questManager.getProgress(id)).toBeUndefined()
      } else {
        expect(manager.questManager.getProgress(id)).toBeDefined()
      }
    }
  })
})
