// QA FIXPOINT probe (clean-round falsification, run qa-fixpoint-master) -
// save-shape bounds that replay writer semantics against forged claims:
//
// F-CULT-OVERCAP (High): player.cultivation was bounded only at
// non-negative - a save could bank an arbitrary magnitude into the next
// breakthrough for free. addCultivation is the sole writer and clamps
// every gain at the current tier's getRequiredCultivation - overflow
// banks to cultivationOvercharge (Hai Nap) or waits at the cap for the
// breakthrough ritual - so a persisted value above required is an
// impossible writer output. The bound rejects the claim (realmLevel /
// attributePoints sibling precedent), never clamps it.
//
// F-QUEST-DUP (Medium): quests.active carried no dedup - the sole
// writer (QuestManager.ensureActive) dedupes via getProgress
// first-match, so a duplicated active questId is unproducible. The dup
// would shadow progress/claim state at restore (same class as QA-FS-4
// skills, F-TALENT-DUP talents and equipment instanceId).
//
// Wave 3 (same falsification-clean-round class):
//
// F-ALCH-JOBID-DUP (Medium): alchemyJobs[].jobId carried no dedup -
// startJob mints a unique id per reservation, so a duplicated id is a
// replayed record that settles the same delivery twice.
// F-FORGE-TOTAL (Medium): equipment[].forgeUsesTotal was bounded only
// at non-negative - the writer stamps exactly
// ITEM_QUALITY_FORGE_USES[quality] and never increases it, so any
// other total is a fabricated forge budget.
// F-EQ-REALMLEVEL (Low): equipment[].realmLevel is stamped a positive
// int by the writer; zoneId/icon are optional string labels - a
// present-but-wrong-typed value is unproducible.
import { describe, expect, it } from 'vitest'
import { validateGameSaveShape } from './saveShapeValidation'
import { CURRENT_SAVE_VERSION } from './saveVersion'
import { createDefaultPlayer } from '../../core/player/Player'
import { getRequiredCultivation } from '../../core/realm/realmSystem'
import { ITEM_QUALITY_FORGE_USES } from '../../core/equipment/ItemQualityBalance'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { alchemySecondsFor } from '../../core/alchemy/AlchemySystem'
import { alchemyJobFixture } from '../../core/alchemy/AlchemyJob.fixture'

function validSave(): Record<string, unknown> {
  return {
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
}

function pathsOf(result: ReturnType<typeof validateGameSaveShape>): string[] {
  return result.issues.map((issue) => issue.path)
}

describe('F-CULT-OVERCAP: player.cultivation is writer-bounded by the current tier requirement', () => {
  it('cultivation above getRequiredCultivation(realmId, realmLevel) is rejected', () => {
    const save = validSave()
    const player = save.player as { cultivation: number }
    player.cultivation = getRequiredCultivation('mortal', 1) + 1

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.cultivation')
  })

  it('cultivation exactly at required validates (cap while awaiting the breakthrough ritual)', () => {
    const save = validSave()
    const player = save.player as { cultivation: number }
    player.cultivation = getRequiredCultivation('mortal', 1)

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it('cultivation below required validates', () => {
    const save = validSave()
    const player = save.player as { cultivation: number }
    player.cultivation = 1

    expect(validateGameSaveShape(save).ok).toBe(true)
  })
})

describe('F-QUEST-DUP: quests.active dedupes by questId like the writer does', () => {
  it('a duplicated active questId is rejected', () => {
    const save = validSave()
    ;(save as Record<string, unknown>).quests = {
      active: [
        { questId: 'quest_a', progress: 0, claimed: false },
        { questId: 'quest_a', progress: 3, claimed: false },
      ],
      completedOnceIds: [],
      lastDailyResetAtMs: 0,
    }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('.quests.active[1].questId')
  })

  it('distinct active questIds validate', () => {
    const save = validSave()
    ;(save as Record<string, unknown>).quests = {
      active: [
        { questId: 'quest_a', progress: 0, claimed: false },
        { questId: 'quest_b', progress: 3, claimed: false },
      ],
      completedOnceIds: [],
      lastDailyResetAtMs: 0,
    }

    expect(validateGameSaveShape(save).ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Wave 3 - writer-replay bounds on the same clean-round class.

// Two concurrent alchemy jobs need a level-3 pill_room (authored slot
// ladder: +1 job at level 3), which is only producible at realm tier 3
// (foundation_establishment) inside the release ceiling.
function alchemySave(): Record<string, unknown> {
  const save = validSave()
  const player = save.player as ReturnType<typeof createDefaultPlayer>
  player.realmId = 'foundation_establishment'
  player.cultivationPath = 'spell'
  player.cultivationWay = 'spell_pathway'
  // F-SCOPE-1 (fixpoint W2-3): a committed element-axis pair always
  // carries the beta-scope element and its atomically minted root.
  player.spellPath = { element: 'fire' }
  player.mortalBasicSkillId = undefined
  player.breakthroughGrade = 1
  player.highestFoundationAchieved = 'human'
  player.nodeLevels = { hoa_linh_ngo: 1 }
  player.purchasedNodeIds = ['hoa_linh_ngo']
  save.techniques = [
    {
      id: 'five_elements_art',
      name: 'Five Elements Art',
      description: 'payload',
      grade: 1,
      rank: 2,
      mastery: 100,
      quality: 'huyen',
      gradeHistory: { 1: { finalRank: 12, completionState: 'dai_thanh' } },
    },
  ]
  ;(save as Record<string, unknown>).buildings = [
    { instanceId: 'b-pill', buildingId: 'pill_room', level: 3, lastCollectedAt: 0 },
  ]
  return save
}

const JOB_RECIPE = alchemyRecipes.find((r) => r.id === 'alchemy_thong_mach_dan')!

function jobAt(jobId: string, startedAtMs: number) {
  return alchemyJobFixture(
    {
      jobId,
      recipeId: JOB_RECIPE.id,
      pillId: JOB_RECIPE.pillId,
      herbMaterialId: JOB_RECIPE.herbVariants[0]!.materialId,
      startedAtMs,
      completesAtMs: startedAtMs + alchemySecondsFor(JOB_RECIPE, 3) * 1000,
      roomLevelAtStart: 3,
    },
    undefined,
    JOB_RECIPE,
  )
}

describe('F-ALCH-JOBID-DUP: alchemyJobs dedupes by jobId like startJob mints', () => {
  it('a duplicated jobId is rejected - the replayed record would settle the delivery twice', () => {
    const save = alchemySave()
    ;(save as Record<string, unknown>).alchemyJobs = [
      jobAt('job-dup', 1_000),
      jobAt('job-dup', 2_000),
    ]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('alchemyJobs[1].jobId')
  })

  it('distinct jobIds validate', () => {
    const save = alchemySave()
    ;(save as Record<string, unknown>).alchemyJobs = [
      jobAt('job-a', 1_000),
      jobAt('job-b', 2_000),
    ]

    expect(validateGameSaveShape(save).ok).toBe(true)
  })
})

function equipmentEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    instanceId: 'eq-1',
    itemId: 'base_kiem',
    slot: 'weapon',
    equipped: false,
    grade: 'cuu_pham',
    quality: 'hoang',
    mainStat: {
      id: 'eq-1:main',
      sourceId: 'eq-1',
      sourceType: 'equipment',
      stat: 'might',
      flat: 5,
    },
    affixes: [],
    forgeUsesTotal: ITEM_QUALITY_FORGE_USES.hoang,
    forgeUsesRemaining: ITEM_QUALITY_FORGE_USES.hoang,
    ...overrides,
  }
}

describe('F-FORGE-TOTAL: equipment[].forgeUsesTotal is the authored per-quality budget', () => {
  it.each([
    [0],
    [ITEM_QUALITY_FORGE_USES.hoang - 1],
    [ITEM_QUALITY_FORGE_USES.hoang + 1],
    [ITEM_QUALITY_FORGE_USES.tien],
  ])('forgeUsesTotal %s off the authored hoang budget is rejected', (total) => {
    const save = validSave()
    save.equipment = [equipmentEntry({ forgeUsesTotal: total, forgeUsesRemaining: total })]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('equipment[0].forgeUsesTotal')
  })

  it('control: the authored total with a spent remainder validates', () => {
    const save = validSave()
    save.equipment = [
      equipmentEntry({ forgeUsesRemaining: ITEM_QUALITY_FORGE_USES.hoang - 2 }),
    ]

    expect(validateGameSaveShape(save).ok).toBe(true)
  })
})

describe('F-EQ-REALMLEVEL: equipment optional writer fields carry writer types', () => {
  it.each([
    ['realmLevel', 0],
    ['realmLevel', 1.5],
    ['realmLevel', '2'],
    ['zoneId', 9],
    ['icon', false],
  ])('equipment entry with %s = %s is rejected', (field, value) => {
    const save = validSave()
    save.equipment = [equipmentEntry({ [field]: value })]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain(`equipment[0].${field}`)
  })

  it('control: writer-typed optional fields validate', () => {
    const save = validSave()
    save.equipment = [
      equipmentEntry({ realmLevel: 3, zoneId: 'thanh_van_lam', icon: 'icon_sword' }),
    ]

    expect(validateGameSaveShape(save).ok).toBe(true)
  })
})
