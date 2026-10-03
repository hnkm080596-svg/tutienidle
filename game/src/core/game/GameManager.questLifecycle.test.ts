// R8.1 (AR-09) - GameManager wiring: quest activation must happen at
// lifecycle points (restore, daily rollover tick, realm transition),
// NOT on panel reads. These tests drive the REAL manager and never
// open the quest UI.
import { withMortalCreationPick } from '../../services/save/GameSave.fixture'
import { describe, expect, it, vi } from 'vitest'

// BETA SCOPE LOCK v2 Phase-5 - this suite exercises the scope-hidden
// system's ENABLED implementation (sec.11-15: dormant, not deleted),
// so the scope authority reports in-scope for this file.
vi.mock('../betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
  isBetaQuestEnabled: () => true,
}))

import { GameManager } from './GameManager'
import { QUESTS } from '../../data/quest/quests'
import type { Quest } from '../quest/Quest'
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
    const { manager, player } = makeManager()

    // kill_wild_wolf_10 is realm-gated to qi_refining (F2 fix - it
    // auto-admitted at mortal creation as a dead 0/10 row while its
    // target only spawns in the Quat stages); the fixture bumps the
    // realm so the same no-UI counting seam stays exercised.
    player.realmId = 'qi_refining'

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
    // BETA SCOPE LOCK v2 sec.15 - every authored daily retired, so a
    // fabricated registry daily keeps the dormant rollover machinery
    // covered (the same seam dailies return through post-beta).
    const testDaily: Quest = {
      id: 'daily_test_rollover',
      name: 'Test Daily',
      description: '',
      cadence: 'daily',
      condition: { kind: 'kill', enemyId: 'wild_wolf', amount: 3 },
      reward: { reward: { skillInsight: 5 } },
    }
    const { manager, player } = makeManager()
    manager.questRegistry.register(testDaily)
    manager.tickOps.update(1)
    expect(manager.questManager.getProgress('daily_test_rollover')).toBeDefined()

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
    expect(manager.questManager.getProgress('daily_test_rollover')).toBeUndefined()
    // ...and the lifecycle reconciliation rebuilds today's board.
    manager.tickOps.reconcileQuestLifecycle()
    expect(manager.questManager.getProgress('daily_test_rollover')).toBeDefined()
    expect(manager.questManager.getProgress('daily_test_rollover')!.progress).toBe(0)
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
    // main_14 is realm-gated AND chain-gated: the realm transition
    // admits it only with its predecessor already witnessed complete.
    manager.questManager.markCompletedOnce('main_13_giao_xa_uyen_dam')
    manager.tickOps.markQuestRealmTransition()
    manager.tickOps.update(1)

    const unlockedIds = manager.questRegistry
      .getAll()
      .filter((q) => q.requiredRealmId === 'foundation_establishment')
      .map((q) => q.id)
    expect(unlockedIds.length).toBeGreaterThan(0)
    for (const id of unlockedIds) {
      expect(manager.questManager.getProgress(id)).toBeDefined()
    }
  })
})
