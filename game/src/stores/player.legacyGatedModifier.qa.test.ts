import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from './player'
import type { GameSave } from '../services/save/SaveSystem'

// QA evidence — stat-system-reimagined quick review (Task 12):
// a save written BEFORE the StatModifier.domain tag existed can persist
// a timed modifier on a now-gated stat (pill MP regen saved as
// stat:'manaRegenPerSecond', or a production-speed timed effect saved
// as 'speedMultiplier'). migrateStatModifier renames the key but never
// tags domain, so the first post-restore recompute hits
// applyDomainGate with modifierDomain='universal' on a gated stat.
// Oracle: restoring a legit legacy payload must not throw when stats
// recompute.
function buildMinimalSave(playerOverrides: Record<string, unknown>): GameSave {
  const base = {
    name: 'Test',
    realmId: 'mortal',
    realmLevel: 1,
    cultivation: 0,
    cultivationPerSecond: 10,
    baseStats: {},
    modifiers: [],
    externalModifiers: [],
    spiritStone: 0,
    selectedTalentIds: [],
    unlockedRealmEnhancements: [],
    hasSeenTutorial: false,
    isCultivating: false,
    totalCultivationGained: 0,
    bossKillCount: 0,
    skillInsight: 0,
    totalSkillInsightGained: 0,
    attributePoints: 0,
    nodeLevels: {},
    purchasedNodeIds: [],
    completedStageIds: [],
    bodyRefinementCompletedTiers: 0,
    bodyRefinementCurrentTierProgress: 0,
    breakthroughGrade: 6,
    grantedRealmPassiveIds: [],
    persistentTimedEffects: [],
    refinementPoints: 100,
    lastRefinementRegenAtMs: Date.now(),
    lastSavedAt: Date.now(),
  }

  return { player: { ...base, ...playerOverrides } } as unknown as GameSave
}

const NOW = 1_725_160_000_000

describe('legacy save -> domain gate on gated-stat persisted modifiers (QA)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockImplementation(() => NOW)
  })

  it('restored pre-domain MP-regen pill modifier survives a stat recompute', () => {
    const player = usePlayerStore()
    const save = buildMinimalSave({
      persistentTimedEffects: [
        {
          id: 'fx-legacy-pill',
          sourceItemId: 'pill_mp_regen',
          effectGroup: 'pill_regen',
          durationStackable: false,
          appliedAtMs: NOW - 1_000,
          expiresAtMs: NOW + 60_000,
          modifiers: [
            {
              id: 'pill-regen-mp:pill_mp_regen',
              sourceId: 'pill_mp_regen',
              sourceType: 'pill',
              stat: 'manaRegenPerSecond',
              flat: 2,
            },
          ],
        },
      ],
    })

    player.restoreFromSave(save)

    // Emulate the per-tick feed: GameManager writes timed+slot modifiers
    // into externalModifiers, then finalStats runs the pipeline.
    player.externalModifiers = player.persistentTimedEffects
      .filter((effect) => effect.expiresAtMs > Date.now())
      .flatMap((effect) => effect.modifiers)

    expect(() => player.finalStats).not.toThrow()
    // The legacy grant keeps its effect: migrated domain backfill lets
    // the +2 flat manaRegenPerTurn through the phap_tu gate.
    expect(player.finalStats.manaRegenPerTurn).toBeGreaterThan(0)
  })

  it('restored pre-domain production-speed timed modifier survives a stat recompute', () => {
    const player = usePlayerStore()
    const save = buildMinimalSave({
      persistentTimedEffects: [
        {
          id: 'fx-legacy-prod',
          sourceItemId: 'site_haste',
          effectGroup: 'site_speed',
          durationStackable: false,
          appliedAtMs: NOW - 1_000,
          expiresAtMs: NOW + 60_000,
          modifiers: [
            {
              id: 'site-haste',
              sourceId: 'site_haste',
              sourceType: 'pill',
              stat: 'speedMultiplier',
              percent: 10,
            },
          ],
        },
      ],
    })

    player.restoreFromSave(save)

    player.externalModifiers = player.persistentTimedEffects
      .filter((effect) => effect.expiresAtMs > Date.now())
      .flatMap((effect) => effect.modifiers)

    expect(() => player.finalStats).not.toThrow()
    expect(player.finalStats.productionSpeedMultiplier).toBeGreaterThan(1)
  })
})
