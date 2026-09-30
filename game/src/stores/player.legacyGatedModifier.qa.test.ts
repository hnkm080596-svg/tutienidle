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
    bodyProgression: { body_refinement: { completedTiers: 0, currentTierProgress: 0 }, meridian: { openedIds: [] }, zhou_tian: { completed: 0 } },
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

  it('a retired pill-permanent modifier folds into baseStats at restore, then drops', () => {
    const player = usePlayerStore()
    const save = buildMinimalSave({
      baseStats: { strength: 5 },
      modifiers: [
        { id: 'pill-permanent:strength', sourceId: 'to_cot_dan', sourceType: 'pill', stat: 'strength', flat: 3 },
        // A non-main-stat claim under the pill-permanent prefix is
        // crafted data, not a legacy grant: it drops WITHOUT folding
        // (the MAIN_STAT_KEYS gate in restoreFromSave).
        { id: 'pill-permanent:might', sourceId: 'x', sourceType: 'pill', stat: 'might', flat: 2 },
        { id: 'pill-permanent:vitality', sourceId: 'x', sourceType: 'pill', stat: 'vitality', flat: 2 },
      ],
    })

    player.restoreFromSave(save)

    expect(player.baseStats.strength).toBe(8)
    expect(player.baseStats.vitality).toBe(createBaseStats().vitality + 2)
    expect(player.baseStats.might).toBe(createBaseStats().might)
    expect(player.modifiers.every((m) => !m.id.startsWith('pill-permanent:'))).toBe(true)
  })

  it('the fold respects getEffectiveMainStatCap for main stats', () => {
    const player = usePlayerStore()
    const save = buildMinimalSave({
      baseStats: { strength: 9 },
      modifiers: [
        { id: 'pill-permanent:strength', sourceId: 'x', sourceType: 'pill', stat: 'strength', flat: 5 },
      ],
    })

    player.restoreFromSave(save)

    // mortal cap = 10, no completed perfection -> 10, not 14.
    expect(player.baseStats.strength).toBe(10)
  })

  it('a crafted modifier with a non-string id or null entry cannot crash restore', () => {
    const player = usePlayerStore()
    const save = buildMinimalSave({
      modifiers: [
        { id: 42, stat: 'strength', flat: 5 },
        null,
        { stat: 'strength', flat: 9 },
      ] as unknown as never[],
    })

    expect(() => player.restoreFromSave(save)).not.toThrow()
    expect(player.baseStats.strength).toBe(createBaseStats().strength)
  })

  it('a crafted hiddenPerfection with a null member cannot crash restore', () => {
    const player = usePlayerStore()
    const save = buildMinimalSave({
      baseStats: { strength: 9 },
      hiddenPerfection: { completedHiddenBodyRealmIds: null },
      modifiers: [
        { id: 'pill-permanent:strength', sourceId: 'x', sourceType: 'pill', stat: 'strength', flat: 5 },
      ],
    })

    expect(() => player.restoreFromSave(save)).not.toThrow()
    // null member -> zero hidden realms -> plain mortal cap 10.
    expect(player.baseStats.strength).toBe(10)
  })

  it('a pill-permanent inside persistentTimedEffects folds with credit, once', () => {
    const player = usePlayerStore()
    const save = buildMinimalSave({
      baseStats: { strength: 5 },
      persistentTimedEffects: [
        timedEffectWith({
          id: 'pill-permanent:strength',
          sourceId: 'to_cot_dan',
          sourceType: 'pill',
          stat: 'strength',
          flat: 3,
        }),
      ],
    })

    player.restoreFromSave(save)

    expect(player.baseStats.strength).toBe(8)
    expect(player.persistentTimedEffects[0]!.modifiers).toEqual([])
  })

  it('the same pill-permanent entry in two buckets credits once', () => {
    const player = usePlayerStore()
    const entry = {
      id: 'pill-permanent:strength',
      sourceId: 'to_cot_dan',
      sourceType: 'pill',
      stat: 'strength',
      flat: 3,
    }
    const save = buildMinimalSave({
      baseStats: { strength: 1 },
      modifiers: [entry],
      externalModifiers: [{ ...entry }],
    })

    player.restoreFromSave(save)

    // credited once: 1 + 3, not 1 + 3 + 3.
    expect(player.baseStats.strength).toBe(4)
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
