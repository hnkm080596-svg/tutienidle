import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from './player'
import { createBaseStats } from '../core/stats/StatBlock'
import type { GameSave } from '../services/save/SaveSystem'

// QA evidence - stat-system-reimagined domain gate + Mission G dev-stage
// rule: a save carrying a legacy stat key (e.g. 'manaRegenPerSecond',
// 'speedMultiplier') or a domain-less modifier on a now-gated stat is NOT
// backfilled - the modifier is dropped at restore so it can never sit in
// state as an always-rejected applyDomainGate zombie. Oracle: restore
// never throws, the modifier is gone, the stat stays at baseline; a
// correctly-domained modifier on the same stat survives.
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
    hasSeenTutorial: false,
    totalCultivationGained: 0,
    bossKillCount: 0,
    skillInsight: 0,
    totalSkillInsightGained: 0,
    attributePoints: 0,
    nodeLevels: {},
    purchasedNodeIds: [],
    completedStageIds: [],
    bodyProgression: { body_refinement: { completedTiers: 0, currentTierProgress: 0 }, meridian: { openedIds: [] } },
    physiqueGrade: 'pham',
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

function timedEffectWith(modifier: Record<string, unknown>) {
  return {
    id: 'fx-legacy',
    sourceItemId: 'pill_source',
    effectGroup: 'pill_fx',
    durationStackable: false,
    appliedAtMs: NOW - 1_000,
    expiresAtMs: NOW + 60_000,
    modifiers: [modifier],
  }
}

describe('legacy save -> domain gate on persisted modifiers (QA)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockImplementation(() => NOW)
  })

  it('a legacy-keyed persisted modifier is dropped at restore, not backfilled', () => {
    const player = usePlayerStore()
    const save = buildMinimalSave({
      persistentTimedEffects: [
        timedEffectWith({
          id: 'pill-regen-mp:pill_mp_regen',
          sourceId: 'pill_mp_regen',
          sourceType: 'pill',
          stat: 'manaRegenPerSecond',
          flat: 2,
        }),
      ],
    })

    player.restoreFromSave(save)

    expect(player.persistentTimedEffects[0]!.modifiers).toEqual([])

    // Emulate the per-tick feed: GameManager writes timed+slot modifiers
    // into externalModifiers, then finalStats runs the pipeline.
    player.externalModifiers = player.persistentTimedEffects
      .filter((effect) => effect.expiresAtMs > Date.now())
      .flatMap((effect) => effect.modifiers)

    expect(() => player.finalStats).not.toThrow()
    expect(player.finalStats.manaRegenPerTurn).toBe(createBaseStats().manaRegenPerTurn)
  })

  it('a domain-less modifier on a gated stat is dropped at restore', () => {
    const player = usePlayerStore()
    const save = buildMinimalSave({
      persistentTimedEffects: [
        timedEffectWith({
          id: 'site-haste',
          sourceId: 'site_haste',
          sourceType: 'pill',
          stat: 'productionSpeedMultiplier',
          percent: 10,
        }),
      ],
    })

    player.restoreFromSave(save)

    expect(player.persistentTimedEffects[0]!.modifiers).toEqual([])

    player.externalModifiers = player.persistentTimedEffects
      .filter((effect) => effect.expiresAtMs > Date.now())
      .flatMap((effect) => effect.modifiers)

    expect(() => player.finalStats).not.toThrow()
    expect(player.finalStats.productionSpeedMultiplier).toBe(
      createBaseStats().productionSpeedMultiplier,
    )
  })

  it('a correctly-domained modifier on a gated stat survives restore', () => {
    const player = usePlayerStore()
    const save = buildMinimalSave({
      persistentTimedEffects: [
        timedEffectWith({
          id: 'site-haste',
          sourceId: 'site_haste',
          sourceType: 'pill',
          stat: 'productionSpeedMultiplier',
          domain: 'production',
          percent: 10,
        }),
      ],
    })

    player.restoreFromSave(save)

    expect(player.persistentTimedEffects[0]!.modifiers).toHaveLength(1)

    player.externalModifiers = player.persistentTimedEffects
      .filter((effect) => effect.expiresAtMs > Date.now())
      .flatMap((effect) => effect.modifiers)

    expect(() => player.finalStats).not.toThrow()
    expect(player.finalStats.productionSpeedMultiplier).toBeGreaterThan(
      createBaseStats().productionSpeedMultiplier,
    )
  })
})
