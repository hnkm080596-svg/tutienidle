/**
 * BETA SCOPE LOCK v2 (spec sec.36 scope-integrity) - pins the single
 * release-policy authority in src/core/betaScope.ts:
 *
 *   - allow-list admissions (ways / elements / features / tabs /
 *     recipes / enemies) all FAIL CLOSED - unknown or absent input is
 *     never offered;
 *   - two lock classes stay distinct: 'progression-locked' (in-scope,
 *     gate unmet - may render locked) vs 'scope-hidden' (out of beta -
 *     never render);
 *   - enemy roster and recipe family censi match the live data files
 *     they will gate.
 */
import { describe, expect, it } from 'vitest'
import { lockBetaWaysForTests } from '@/core/game/__fixtures__/betaWaysUnlock'
import {
  BETA_ACT_COUNT,
  BETA_BOSSES_PER_ACT,
  BETA_ENABLED_RECIPE_FAMILIES,
  BETA_ENEMY_ROSTER,
  BETA_EQUIPMENT_TABS,
  BETA_FEATURES,
  BETA_FLOORS_PER_ACT,
  BETA_NORMALS_PER_ACT,
  BETA_PLAYABLE_ELEMENTS,
  BETA_PLAYABLE_WAYS,
  betaActOfEnemy,
  betaRecipeFamilyOfId,
  betaScopeVerdict,
  betaSurfaceVerdict,
  betaSurfaceVisible,
  isBetaElement,
  isBetaEnemyId,
  isBetaEquipmentTab,
  isBetaFeature,
  isBetaQuestEnabled,
  isBetaRecipeFamily,
  isBetaWay,
  isScopeHidden,
} from '@/core/betaScope'
import { ENEMIES } from '@/data/enemy/Enemies'
import { STAGES } from '@/data/stage/Stages'
import { alchemyRecipes } from '@/data/alchemy/alchemyRecipes'
import { QUESTS } from '@/data/quest/quests'

// The global test setup unlocks every catalog way for suites written
// pre-lock; this suite asserts the canonical beta set, so re-pin it.
lockBetaWaysForTests()

describe('beta scope v2 - way and element allow-lists', () => {
  it('offers spell_pathway and only spell_pathway', () => {
    expect([...BETA_PLAYABLE_WAYS]).toEqual(['spell_pathway'])
    expect(isBetaWay('spell_pathway')).toBe(true)
  })

  it('fails closed for every other canonical way (sword/body/hidden)', () => {
    for (const way of [
      'sword_pathway',
      'body_pathway',
      'hidden_spell_pathway',
      'hidden_sword_pathway',
      'hidden_body_pathway',
    ]) {
      expect(isBetaWay(way)).toBe(false)
    }
  })

  it('fails closed for unknown and malformed way ids', () => {
    for (const way of ['', 'SPELL_PATHWAY', 'phap_tu', 'kiem_tu', 'spell']) {
      expect(isBetaWay(way)).toBe(false)
    }
  })

  it('keeps all five Ngu Hanh elements playable, unknown elements fail closed', () => {
    expect(BETA_PLAYABLE_ELEMENTS.size).toBe(5)
    for (const el of ['fire', 'water', 'wood', 'metal', 'earth']) {
      expect(isBetaElement(el)).toBe(true)
    }
    for (const el of ['', 'wind', 'lightning', 'FIRE']) {
      expect(isBetaElement(el)).toBe(false)
    }
  })
})

describe('beta scope v2 - feature flags and lock classes', () => {
  it('marks every gated beta feature unavailable', () => {
    for (const name of [
      'hiddenContent',
      'swordPath',
      'bodyPath',
      'companion',
      'formation',
      'artifact',
      'manualWorkforce',
      'equipmentWash',
      'equipmentRefine',
      'equipmentOreDecompose',
      'dailyQuest',
    ]) {
      expect(isBetaFeature(name)).toBe(false)
    }
  })

  it('keeps the feature table exhaustively off (no enabled toggle path)', () => {
    expect(Object.values(BETA_FEATURES).every((v) => v === false)).toBe(true)
  })

  it('classifies gated and unknown features as scope-hidden', () => {
    for (const name of [
      'companion',
      'formation',
      'artifact',
      'hiddenContent',
      'dailyQuest',
      'swordPath',
      'bodyPath',
      'equipmentWash',
      'equipmentRefine',
      'equipmentOreDecompose',
      'manualWorkforce',
      '',
      'nonexistent_feature',
    ]) {
      expect(isScopeHidden(name)).toBe(true)
      expect(betaSurfaceVerdict(name)).toBe('scope-hidden')
      expect(betaSurfaceVisible(name)).toBe(false)
      // A met progression gate cannot un-hide a scope-hidden surface.
      expect(betaSurfaceVerdict(name, { progressionMet: true })).toBe('scope-hidden')
      expect(betaSurfaceVisible(name, { progressionMet: true })).toBe(false)
    }
  })

  it('expresses progression-locked vs scope-hidden distinctly for any surface', () => {
    expect(betaScopeVerdict({ offered: true })).toBe('available')
    expect(betaScopeVerdict({ offered: true, progressionMet: true })).toBe('available')
    expect(betaScopeVerdict({ offered: true, progressionMet: false })).toBe(
      'progression-locked',
    )
    expect(betaScopeVerdict({ offered: false })).toBe('scope-hidden')
    expect(betaScopeVerdict({ offered: false, progressionMet: true })).toBe(
      'scope-hidden',
    )
    expect(betaScopeVerdict({ offered: false, progressionMet: false })).toBe(
      'scope-hidden',
    )
  })

  it('hidden ways and hidden content cannot initiate', () => {
    expect(isBetaWay('hidden_spell_pathway')).toBe(false)
    expect(isBetaWay('hidden_sword_pathway')).toBe(false)
    expect(isBetaWay('hidden_body_pathway')).toBe(false)
    expect(isBetaFeature('hiddenContent')).toBe(false)
    expect(isScopeHidden('hiddenContent')).toBe(true)
  })
})

describe('beta scope v2 - enemy roster authority', () => {
  it('pins the census model: 3 chapters x 10 floors, 3 normal + 1 boss per act', () => {
    expect(BETA_ACT_COUNT).toBe(3)
    expect(BETA_FLOORS_PER_ACT).toBe(10)
    expect(BETA_NORMALS_PER_ACT).toBe(3)
    expect(BETA_BOSSES_PER_ACT).toBe(1)
    expect(BETA_ENEMY_ROSTER).toHaveLength(
      BETA_ACT_COUNT * (BETA_NORMALS_PER_ACT + BETA_BOSSES_PER_ACT),
    )
  })

  it('contains exactly the canonical 12 identities in act order', () => {
    expect(BETA_ENEMY_ROSTER.map((e) => e.id)).toEqual([
      'mortal_wild_boar',
      'mortal_savage_tiger',
      'mortal_water_wolf',
      'mortal_ferocious_giant_crocodile',
      'wild_wolf',
      'flame_fox',
      'giant_earthworm',
      'ferocious_flood_serpent',
      'foundation_lava_hound',
      'foundation_sand_scorpion',
      'foundation_mud_golem',
      'foundation_ferocious_flood_dragon_whelp',
    ])
  })

  it('assigns each act exactly 3 normals and 1 boss', () => {
    for (const act of [1, 2, 3] as const) {
      const entries = BETA_ENEMY_ROSTER.filter((e) => e.act === act)
      expect(entries.filter((e) => e.role === 'normal')).toHaveLength(3)
      expect(entries.filter((e) => e.role === 'boss')).toHaveLength(1)
    }
  })

  it('matches the live stage model: 3 chapters x 10 floors, roster boss on floor 10', () => {
    expect(new Set(STAGES.map((s) => s.chapter))).toEqual(new Set([1, 2, 3]))
    for (const act of [1, 2, 3] as const) {
      const chapterStages = STAGES.filter((s) => s.chapter === act)
      expect(chapterStages).toHaveLength(BETA_FLOORS_PER_ACT)
      const bossFloor = chapterStages.find((s) => s.floor === BETA_FLOORS_PER_ACT)
      const rosterBoss = BETA_ENEMY_ROSTER.find((e) => e.act === act && e.role === 'boss')
      expect(bossFloor?.bossEnemyId).toBe(rosterBoss?.id)
    }
  })

  it('resolves every roster id against live enemy data with matching realm and boss marker', () => {
    const realmByAct = { 1: 'mortal', 2: 'qi_refining', 3: 'foundation_establishment' } as const
    const byId = new Map(ENEMIES.map((e) => [e.id, e]))
    for (const entry of BETA_ENEMY_ROSTER) {
      const enemy = byId.get(entry.id)
      expect(enemy, `missing enemy ${entry.id}`).toBeDefined()
      expect(enemy!.realmId).toBe(realmByAct[entry.act])
      if (entry.role === 'boss') {
        expect(enemy!.bossTrigger, `${entry.id} must carry a bossTrigger`).toBeDefined()
      } else {
        expect(enemy!.bossTrigger, `${entry.id} must not be a boss`).toBeUndefined()
      }
    }
  })

  it('answers isBetaEnemyId / betaActOfEnemy and fails closed off-roster', () => {
    for (const entry of BETA_ENEMY_ROSTER) {
      expect(isBetaEnemyId(entry.id)).toBe(true)
      expect(betaActOfEnemy(entry.id)).toBe(entry.act)
    }
    // Live but out-of-scope enemies are not offered.
    for (const id of ['bandit', 'flood_serpent', 'foundation_stone_fungus', 'mortal_giant_crocodile']) {
      expect(isBetaEnemyId(id)).toBe(false)
      expect(betaActOfEnemy(id)).toBeNull()
    }
    expect(isBetaEnemyId('')).toBe(false)
    expect(betaActOfEnemy('not_an_enemy')).toBeNull()
  })
})

describe('beta scope v2 - recipe family allow-list', () => {
  it('enables exactly the five beta pill families', () => {
    expect([...BETA_ENABLED_RECIPE_FAMILIES].sort()).toEqual([
      'hoi_linh_dan',
      'khai_linh_dan',
      'thong_mach_dan',
      'truc_co_dan',
      'tu_linh_dan',
    ])
  })

  it('fails closed for other live families and unknown ids', () => {
    for (const id of [
      'hoi_xuan_dan',
      'phi_van_dan',
      'to_cot_dan',
      'thoi_the_dan',
      'duong_than_dan',
      '',
      'tu_linh',
      'TU_LINH_DAN',
    ]) {
      expect(isBetaRecipeFamily(id)).toBe(false)
    }
  })

  it('resolves enabled families from recipe ids, pill ids, and bare family ids', () => {
    expect(betaRecipeFamilyOfId('tu_linh_dan')).toBe('tu_linh_dan')
    expect(betaRecipeFamilyOfId('tu_linh_dan_qi_refining')).toBe('tu_linh_dan')
    expect(betaRecipeFamilyOfId('alchemy_tu_linh_dan_qi_refining')).toBe('tu_linh_dan')
    expect(betaRecipeFamilyOfId('alchemy_thong_mach_dan')).toBe('thong_mach_dan')
    expect(betaRecipeFamilyOfId('thong_mach_dan')).toBe('thong_mach_dan')
    expect(betaRecipeFamilyOfId('alchemy_truc_co_dan')).toBe('truc_co_dan')
  })

  it('fails closed on recipe ids outside the enabled families', () => {
    expect(betaRecipeFamilyOfId('alchemy_phi_van_dan_mortal')).toBeNull()
    expect(betaRecipeFamilyOfId('phi_van_dan_qi_refining')).toBeNull()
    expect(betaRecipeFamilyOfId('alchemy_')).toBeNull()
    expect(betaRecipeFamilyOfId('alchemy_tu_linh_dan_not_a_realm')).toBeNull()
    expect(betaRecipeFamilyOfId('not_a_recipe')).toBeNull()
  })

  it('keeps enabled family ids unambiguous under realm-suffix stripping', () => {
    // betaRecipeFamilyOfId strips `_${realm}` first - a family id that
    // itself ends in a realm suffix would resolve to a shorter name.
    const REALM_TIERS_AS_SUFFIX = /_(mortal|qi_refining|foundation_establishment|golden_core|nascent_soul|soul_transformation|void_refinement|mahayana|tribulation)$/
    for (const family of BETA_ENABLED_RECIPE_FAMILIES) {
      expect(REALM_TIERS_AS_SUFFIX.test(family), `${family} ends in a realm suffix`).toBe(false)
    }
  })

  it('covers at least one live recipe per enabled family', () => {
    for (const family of BETA_ENABLED_RECIPE_FAMILIES) {
      const hits = alchemyRecipes.filter(
        (r) => r.pillId === family || r.pillId.startsWith(`${family}_`),
      )
      expect(hits.length, `family ${family} has no live recipe`).toBeGreaterThan(0)
    }
  })
})

describe('beta scope v2 - equipment tabs and quest policy', () => {
  it('exposes only enhance + dissolve equipment tabs', () => {
    expect([...BETA_EQUIPMENT_TABS]).toEqual(['enhance', 'dissolve'])
    expect(isBetaEquipmentTab('enhance')).toBe(true)
    expect(isBetaEquipmentTab('dissolve')).toBe(true)
    for (const tab of ['wash', 'refine', 'decompose', '', 'ENHANCE']) {
      expect(isBetaEquipmentTab(tab)).toBe(false)
    }
  })

  it('keeps the tab list consistent with the equipment feature flags', () => {
    // Two tables describe the same surface: a tab hidden by its feature
    // flag must never appear in BETA_EQUIPMENT_TABS, and vice versa.
    const flagByTab = {
      wash: 'equipmentWash',
      refine: 'equipmentRefine',
      decompose: 'equipmentOreDecompose',
    } as const
    for (const [tab, flag] of Object.entries(flagByTab)) {
      expect(BETA_FEATURES[flag]).toBe(false)
      expect(BETA_EQUIPMENT_TABS).not.toContain(tab)
      expect(isBetaEquipmentTab(tab)).toBe(false)
    }
  })

  it('disables every daily quest even when the target is in scope', () => {
    expect(
      isBetaQuestEnabled({
        cadence: 'daily',
        condition: { kind: 'kill', enemyId: 'wild_wolf', amount: 5 },
      }),
    ).toBe(false)
    expect(
      isBetaQuestEnabled({
        cadence: 'daily',
        condition: { kind: 'collect', materialId: 'tu_linh_thao_qi_refining_decade', amount: 1 },
      }),
    ).toBe(false)
    expect(
      isBetaQuestEnabled({ cadence: 'daily', condition: { kind: 'kill', amount: 20 } }),
    ).toBe(false)
  })

  it('requires enemy-specific once-quests to target the beta roster', () => {
    expect(
      isBetaQuestEnabled({
        cadence: 'once',
        condition: { kind: 'kill', enemyId: 'wild_wolf', amount: 10 },
      }),
    ).toBe(true)
    expect(
      isBetaQuestEnabled({
        cadence: 'once',
        condition: { kind: 'kill', enemyId: 'mortal_ferocious_giant_crocodile', amount: 1 },
      }),
    ).toBe(true)
    expect(
      isBetaQuestEnabled({
        cadence: 'once',
        condition: { kind: 'kill', enemyId: 'bandit', amount: 15 },
      }),
    ).toBe(false)
    expect(
      isBetaQuestEnabled({
        cadence: 'once',
        condition: { kind: 'kill', enemyId: 'not_an_enemy', amount: 1 },
      }),
    ).toBe(false)
  })

  it('keeps generic-kill and collect once-quests enabled', () => {
    expect(
      isBetaQuestEnabled({ cadence: 'once', condition: { kind: 'kill', amount: 50 } }),
    ).toBe(true)
    expect(
      isBetaQuestEnabled({
        cadence: 'once',
        condition: { kind: 'collect', materialId: 'qi_refining_ore_decade', amount: 30 },
      }),
    ).toBe(true)
  })

  it('applies the policy to the live quest table', () => {
    for (const quest of QUESTS) {
      const enabled = isBetaQuestEnabled(quest)
      if (quest.cadence === 'daily') {
        expect(enabled, `daily quest ${quest.id} must be off`).toBe(false)
      }
      if (quest.condition.kind === 'kill' && quest.condition.enemyId !== undefined) {
        expect(enabled).toBe(isBetaEnemyId(quest.condition.enemyId))
      }
    }
    // Sanity: the table still contains the enabled roster-quest case.
    expect(QUESTS.some((q) => q.id === 'kill_wild_wolf_10')).toBe(true)
    expect(isBetaQuestEnabled(QUESTS.find((q) => q.id === 'kill_wild_wolf_10')!)).toBe(true)
  })
})
