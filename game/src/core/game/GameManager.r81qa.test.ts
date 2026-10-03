// QA quick (R8.1) - adversarial checks around the quest activation
// lifecycle at restore boundaries. Written to PASS against correct
// behavior; failure = confirmed defect with intended-reason evidence.
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
  betaRecipeFamilyOfId: () => 'tu_linh_dan',
}))

import { GameManager } from './GameManager'
import { QUESTS } from '../../data/quest/quests'
import type { Quest } from '../quest/Quest'
import { createDefaultPlayer } from '../player/Player'
import type { PlayerData } from '../player/Player'
import type { GameSave } from '../../services/save/SaveSystem'
import { CURRENT_SAVE_VERSION } from '../../services/save/saveVersion'

function makeManager(player?: PlayerData): { manager: GameManager; player: PlayerData } {
  const manager = new GameManager()
  manager.catalogOps.registerQuests(QUESTS)
  const resolved = player ?? createDefaultPlayer()
  manager.setActivePlayer(resolved)
  return { manager, player: resolved }
}

function buildSave(player: PlayerData, quests: GameSave['quests']): GameSave {
  return withMortalCreationPick({
    version: CURRENT_SAVE_VERSION,
    player: { ...player, lastSavedAt: Date.now() },
    techniques: [],
    skills: [],
    materials: [],
    equipment: [],
    equipmentSlots: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    quests,
    productionSites: [],
  })
}

const DAILY_ID = 'daily_kill_bandit_15'
// main_01 (chain head) is the once quest that stays mortal-admissible;
// kill_wild_wolf_10 moved behind requiredRealmId 'qi_refining' (F2),
// so it can no longer serve as the eligible-at-mortal fixture.
const ONCE_ID = 'main_01_da_san_dau_tien'

// BETA SCOPE LOCK v2 sec.15 - authored dailies retired from the quest
// set, so the rollover-rebuild test registers a fabricated daily: the
// day-boundary machinery is dormant (not deleted) and stays exercised.
const TEST_DAILY: Quest = {
  id: 'daily_test_rollover',
  name: 'Test Daily',
  description: '',
  cadence: 'daily',
  condition: { kind: 'kill', enemyId: 'wild_wolf', amount: 3 },
  reward: { reward: { skillInsight: 5 } },
}

describe('QA R8.1 - restore-boundary quest lifecycle', () => {
  it('boot reconcile PRESERVES existing progress (no reset)', () => {
    const source = makeManager()
    const save = buildSave(source.player, {
      active: [{ questId: DAILY_ID, progress: 7, claimed: false }],
      completedOnceIds: [],
      lastDailyResetAtMs: Date.now(),
    })

    const target = makeManager()
    target.manager.saveOps.restoreFromSave(save)

    // Reconcile must converge eligibility WITHOUT zeroing banked
    // progress - including inert residue for a retired quest id.
    expect(target.manager.questManager.getProgress(DAILY_ID)!.progress).toBe(7)
    // And the other eligible quests joined the active set.
    expect(target.manager.questManager.getProgress(ONCE_ID)).toBeDefined()
  })

  it('boot reconcile never resurrects completed-once quests', () => {
    const source = makeManager()
    const save = buildSave(source.player, {
      active: [],
      completedOnceIds: [ONCE_ID],
      lastDailyResetAtMs: Date.now(),
    })

    const target = makeManager()
    target.manager.saveOps.restoreFromSave(save)

    expect(target.manager.questManager.getProgress(ONCE_ID)).toBeUndefined()
  })

  it('restoring a stale-day save rebuilds the daily board through the reset tick', () => {
    const source = makeManager()
    source.manager.questRegistry.register(TEST_DAILY)
    // lastDailyResetAtMs = yesterday -> first update tick resets the day.
    const save = buildSave(source.player, {
      active: [{ questId: TEST_DAILY.id, progress: 7, claimed: false }],
      completedOnceIds: [],
      lastDailyResetAtMs: Date.now() - 25 * 60 * 60 * 1000,
    })

    const target = makeManager()
    target.manager.questRegistry.register(TEST_DAILY)
    target.manager.saveOps.restoreFromSave(save)
    target.manager.tickOps.update(1)

    // Day rolled over: board rebuilt with zero progress (v1 semantics),
    // then normal kills count without any UI read.
    const rebuilt = target.manager.questManager.getProgress(TEST_DAILY.id)
    expect(rebuilt).toBeDefined()
    expect(rebuilt!.progress).toBe(0)

    target.manager.questSystem.onEnemyDefeated(
      target.manager.questRegistry,
      target.manager.questManager,
      'wild_wolf',
      undefined,
    )
    expect(target.manager.questManager.getProgress(TEST_DAILY.id)!.progress).toBe(1)
  })

  it('double reconcile across boot + tick does not duplicate active entries', () => {
    const source = makeManager()
    const save = buildSave(source.player, {
      active: [],
      completedOnceIds: [],
      lastDailyResetAtMs: Date.now(),
    })

    const target = makeManager()
    target.manager.saveOps.restoreFromSave(save) // reconcile #1 (restore boundary)
    target.manager.tickOps.update(1) // reconcile #2 may run via tick paths
    target.manager.tickOps.reconcileQuestLifecycle() // explicit #3

    const activeIds = target.manager.questManager.getActive().map((p) => p.questId)
    const unique = new Set(activeIds)
    expect(unique.size).toBe(activeIds.length) // no duplicates
  })
})
