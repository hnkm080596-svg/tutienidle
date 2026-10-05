// R11 AUT evidence (fixpoint round 11) - R11-AUT-1, POST-FIX pin.
//
// A forged FUTURE-DATED quests.lastDailyResetAtMs is still accepted by
// validateGameSaveShape (only isNonNegativeFiniteNumber is checked -
// saveShapeValidation.ts:3129) but QuestManager.restore now CLAMPS it
// to Date.now() (QuestManager.ts:181-188): the frozen-board hole is
// closed while "just reset" semantics deny the free-reset direction.
// Same defect class the r10 commit fixed for
// autoFarmStage.lastCheckedMs (tick re-anchor when `> now`).
//
// The daily cadence is scope-hidden in the beta (BETA_FEATURES.
// dailyQuest === false), so the forged surface is dormant today - the
// tests exercise the enabled implementation through the betaScope mock
// (same convention as QuestSystem.lifecycle.test.ts).
// ASCII comments only.

import { describe, expect, it, vi } from 'vitest'

vi.mock('@/core/betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
  isBetaQuestEnabled: () => true,
}))

import { QuestSystem } from '@/core/quest/QuestSystem'
import { QuestRegistry } from '@/core/quest/QuestRegistry'
import { QuestManager } from '@/core/quest/QuestManager'
import type { Quest } from '@/core/quest/Quest'
import type { PlayerData } from '@/core/player/Player'
import { createDefaultPlayer } from '@/core/player/Player'
import { withMortalCreationPick } from '@/services/save/GameSave.fixture'
import { validateGameSaveShape } from '@/services/save/saveShapeValidation'
import { CURRENT_SAVE_VERSION } from '@/services/save/saveVersion'
import type { GameSave } from '@/services/save/saveTypes'

const DAY_MS = 24 * 60 * 60 * 1000

const DAILY_QUEST: Quest = {
  id: 'quest_daily_r11',
  name: 'Daily quest',
  description: '',
  condition: { kind: 'kill', amount: 2 },
  reward: {},
  cadence: 'daily',
}

function makeHarness() {
  const registry = new QuestRegistry()
  registry.register(DAILY_QUEST)
  const manager = new QuestManager()
  const system = new QuestSystem()
  const player = { realmId: 'qi_refining' } as unknown as PlayerData
  return { system, registry, manager, player }
}

function saveWithResetMarker(lastDailyResetAtMs: number): GameSave {
  const save: GameSave = {
    version: CURRENT_SAVE_VERSION,
    player: createDefaultPlayer(),
    techniques: [],
    skills: [],
    materials: [],
    equipment: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    equipmentSlots: [],
  }
  const picked = withMortalCreationPick(save)
  picked.quests = {
    active: [{ questId: DAILY_QUEST.id, progress: 7, claimed: false }],
    completedOnceIds: [],
    lastDailyResetAtMs,
  }
  return picked
}

describe('R11-AUT-1 — future-dated lastDailyResetAtMs clamps to now (post-fix)', () => {
  it('forge passes shape validation but restore clamps, so the board rolls tomorrow', () => {
    const now = Date.now()
    const forged = now + 365 * DAY_MS

    // Seam 1: the save-shape validator accepts the forged marker.
    const shape = validateGameSaveShape(saveWithResetMarker(forged))
    expect(shape.ok).toBe(true)

    // Seam 2: restore normalization clamps the future value to now -
    // "just reset", denying both the freeze AND a free reset.
    const { system, registry, manager, player } = makeHarness()
    manager.restore(saveWithResetMarker(forged).quests!)
    expect(manager.getLastDailyResetAtMs()).toBeLessThanOrEqual(Date.now() + 1)
    expect(manager.getLastDailyResetAtMs()).toBeGreaterThan(now - 5000)

    // Same day bucket: no free reset (progress survives - the honest
    // "just reset" direction).
    expect(system.checkAndResetDaily(registry, manager, player, now)).toBe(false)
    expect(manager.getProgress(DAILY_QUEST.id)?.progress).toBe(7)

    // Next day bucket: the board rolls - the freeze is gone.
    expect(system.checkAndResetDaily(registry, manager, player, now + DAY_MS)).toBe(true)
    expect(manager.getProgress(DAILY_QUEST.id)).toBeUndefined()
  })

  it('control — an honest past-dated marker rolls the daily board', () => {
    const now = Date.now()

    const { system, registry, manager, player } = makeHarness()
    manager.restore(saveWithResetMarker(now - 25 * 60 * 60 * 1000).quests!)

    expect(system.checkAndResetDaily(registry, manager, player, now)).toBe(true)
    expect(manager.getProgress(DAILY_QUEST.id)).toBeUndefined()
    expect(manager.getLastDailyResetAtMs()).toBe(now)
  })
})
