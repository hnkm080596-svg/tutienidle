// R11 AUT evidence (fixpoint round 11, pin 5805d962) — R11-AUT-1.
//
// A forged FUTURE-DATED quests.lastDailyResetAtMs is accepted by
// validateGameSaveShape (only isNonNegativeFiniteNumber is checked —
// saveShapeValidation.ts:3129) and survives QuestManager.restore
// normalization unchanged (QuestManager.ts:181-184). Afterwards the
// reset gate `dayBucket(now) <= dayBucket(lastDailyResetAtMs)`
// (QuestSystem.ts:476) can never fire: the daily board is frozen
// forever. Same defect class the r10 commit fixed for
// autoFarmStage.lastCheckedMs (tick re-anchor when `> now`) and that
// tribulation.cooldownUntil already covers at the validation seam via
// writer-bound rejection (F-LC-1, saveShapeValidation.ts:4371-4389);
// the quest reset marker has NEITHER guard.
//
// The daily cadence is scope-hidden in the beta (BETA_FEATURES.
// dailyQuest === false), so the forged surface is dormant today — the
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

describe('R11-AUT-1 — future-dated lastDailyResetAtMs freezes the daily reset', () => {
  it('forge passes shape validation and restore, then reset can never fire', () => {
    const now = Date.now()
    const forged = now + 365 * DAY_MS

    // Seam 1: the save-shape validator accepts the forged marker.
    const shape = validateGameSaveShape(saveWithResetMarker(forged))
    expect(shape.ok).toBe(true)

    // Seam 2: restore normalization preserves finite future values.
    const { system, registry, manager, player } = makeHarness()
    manager.restore(saveWithResetMarker(forged).quests!)
    expect(manager.getLastDailyResetAtMs()).toBe(forged)

    // Sink: the reset gate compares day buckets — a marker one year in
    // the future makes `dayBucket(now) <= dayBucket(marker)` hold for
    // any reachable now, so the daily board never rolls and the forged
    // progress survives forever.
    expect(system.checkAndResetDaily(registry, manager, player, now)).toBe(false)
    expect(system.checkAndResetDaily(registry, manager, player, now + 30 * DAY_MS)).toBe(false)
    expect(manager.getProgress(DAILY_QUEST.id)?.progress).toBe(7)
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
