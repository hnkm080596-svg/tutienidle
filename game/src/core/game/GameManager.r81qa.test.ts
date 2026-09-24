// QA quick (R8.1) - adversarial checks around the quest activation
// lifecycle at restore boundaries. Written to PASS against correct
// behavior; failure = confirmed defect with intended-reason evidence.
import { withMortalCreationPick } from '../../services/save/GameSave.fixture'
import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { QUESTS } from '../../data/quest/quests'
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
const ONCE_ID = 'kill_wild_wolf_10'

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

    // Reconcile must converge eligibility WITHOUT zeroing banked progress.
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
    // lastDailyResetAtMs = yesterday -> first update tick resets the day.
    const save = buildSave(source.player, {
      active: [{ questId: DAILY_ID, progress: 7, claimed: false }],
      completedOnceIds: [],
      lastDailyResetAtMs: Date.now() - 25 * 60 * 60 * 1000,
    })

    const target = makeManager()
    target.manager.saveOps.restoreFromSave(save)
    target.manager.tickOps.update(1)

    // Day rolled over: board rebuilt with zero progress (v1 semantics),
    // then normal kills count without any UI read.
    const rebuilt = target.manager.questManager.getProgress(DAILY_ID)
    expect(rebuilt).toBeDefined()
    expect(rebuilt!.progress).toBe(0)

    target.manager.questSystem.onEnemyDefeated(
      target.manager.questRegistry,
      target.manager.questManager,
      'bandit',
      undefined,
    )
    expect(target.manager.questManager.getProgress(DAILY_ID)!.progress).toBe(1)
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
