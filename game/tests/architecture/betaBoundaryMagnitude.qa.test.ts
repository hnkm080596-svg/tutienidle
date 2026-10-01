// QA pin - TC7 boundary-magnitude falsification wave (blind sweep on
// 4c691c7e). Forged saves that pass shape schema but carry magnitudes
// no legal writer can mint must be rejected at the acceptance layer or
// normalized at restore, and the settle/emit seams must re-derive the
// admission verdicts instead of trusting the persisted record:
//
// F-TC7-TRIB  a committedOutcome whose owner fails the ordinary
//             breakthrough gate at settle time is an impossible claim -
//             settleOutcome parks it (entry required the gate, and the
//             inputs are monotonic).
// F-TC7-EXT   externalModifiers is the per-tick aggregate mirror - the
//             restored copy clears and repopulates from live sources.
// F-TC7-BASE  non-main baseStats have no persisted writer - restore
//             rebuilds onto authored defaults.
// F-TC7-LEVEL realmLevel past the realm's authored maxLevel is rejected.
// F-TC7-EQP   equipment mainStat flat beyond the authored roll bound
//             (template range x quality multiplier x realm scale), a
//             percent/multiplier the writer never emits, or a stat
//             outside the template's authored mains are rejected.
// F-TC7-ENH   equipmentSlots enhanceLevel past MAX_SLOT_ENHANCE_LEVEL
//             is rejected.
// F-TC7-AFX   getEffectiveAffixValue on a roll naming no authored tier
//             clamps the emitted value to the affix's authored union.
// F-TC7-PILL  a pill regen claim carrying percent/multiplier (the
//             writer emits exactly one flat modifier) is rejected.
// F-TC7-ENT   a pendingTalentEntitlement bound to a realm other than
//             the player's is rejected (the mint binds the pool to the
//             realm just entered).
import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { lockBetaWaysForTests } from '../../src/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaFeaturesForTests } from '../../src/core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaTalentsForTests } from '../../src/core/game/__fixtures__/betaTalentsUnlock'

lockBetaWaysForTests()
lockBetaFeaturesForTests()
lockBetaTalentsForTests()

import { GameManager } from '../../src/core/game/GameManager'
import { createDefaultPlayer, type PlayerData } from '../../src/core/player/Player'
import { createBaseStats } from '../../src/core/stats/StatBlock'
import { getEffectiveAffixValue } from '../../src/core/equipment/EquipmentRollPrimitives'
import { MAX_SLOT_ENHANCE_LEVEL } from '../../src/core/equipment/EnhanceCurve'
import { TribulationOutcomeService } from '../../src/core/tribulation/TribulationOutcomeService'
import { getGlobalCultivationLevel } from '../../src/core/realm/realmSystem'
import { REALMS } from '../../src/data/realms/realm'
import { equipment } from '../../src/data/equipment/equipment'
import { affixes } from '../../src/data/equipment/affixes'
import { materials } from '../../src/data/materials/materials'
import { pills } from '../../src/data/pill/pills'
import { buildings } from '../../src/data/building/buildings'
import { SKILLS } from '../../src/data/skill/Skills'
import { TECHNIQUES } from '../../src/data/technique/Techniques'
import { alchemyRecipes } from '../../src/data/alchemy/alchemyRecipes'
import { ITEM_QUALITY_IMPLICIT_MULTIPLIER } from '../../src/core/equipment/ItemQualityBalance'
import { MAIN_STAT_REALM_SCALE } from '../../src/core/equipment/EquipmentRolling'
import { CURRENT_SAVE_VERSION } from '../../src/services/save/saveVersion'
import { validateGameSaveShape } from '../../src/services/save/saveShapeValidation'
import { restoreGameSession, type GameSave } from '../../src/services/save/SaveSystem'
import { usePlayerStore } from '../../src/stores/player'
import type { Technique } from '../../src/core/technique/Technique'
import type { TribulationSaveSlice } from '../../src/services/save/saveTypes'
import { getRealmIndex } from '../../src/core/realm/realmSystem'
import type { PersistentTimedEffect } from '../../src/core/player/PersistentTimedEffect'
import type { StatModifier } from '../../src/core/stats/StatCalculator'
import type { TribulationPlayerWriter } from '../../src/core/tribulation/TribulationOutcomeService'

// F-REALM-1: a realm witness must carry an authored technique object.
function fiveElementsTechnique() {
  return structuredClone(TECHNIQUES.find((t) => t.id === 'five_elements_art')!)
}

function player(overrides: Partial<PlayerData> = {}): PlayerData {
  return { ...createDefaultPlayer(), ...overrides }
}

function validSave(playerOverrides: Partial<PlayerData> = {}, overrides: Partial<GameSave> = {}) {
  const p = player(playerOverrides)
  p.mortalBasicSkillId = 'linh_bao'
  p.nodeLevels = { ...p.nodeLevels, core_linh_bao: 1 }
  p.purchasedNodeIds = [...p.purchasedNodeIds, 'core_linh_bao']

  const save: GameSave = {
    version: CURRENT_SAVE_VERSION,
    player: { ...p, lastSavedAt: Date.now() },
    techniques: [],
    skills: [
      {
        id: 'linh_bao',
        name: 'Linh Bao',
        description: 'creation pick',
        type: 'active',
        level: 1,
        maxLevel: 10,
        cooldown: 1,
        target: 'enemy',
        effects: [],
      },
    ],
    materials: [],
    equipment: [],
    equipmentSlots: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    quests: { active: [], completedOnceIds: [], lastDailyResetAtMs: 0 },
    productionSites: [],
    alchemyJobs: [],
    decompose: {
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 0 },
      nextCycleAt: 0,
      started: false,
    },
    ...overrides,
  }
  return { save, player: p }
}

function makeManager(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerPills(pills)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  manager.catalogOps.registerBuildings(buildings)
  manager.catalogOps.registerSkillTemplates([...SKILLS])
  manager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  manager.catalogOps.registerAlchemyRecipes(alchemyRecipes)
  return manager
}

function boot(save: GameSave) {
  setActivePinia(createPinia())
  const playerStore = usePlayerStore()
  const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
  const manager = makeManager()
  const result = shape.ok
    ? restoreGameSession(playerStore, manager, shape.normalizedSave as GameSave)
    : { status: 'rejected' as const, message: 'shape' }
  return { playerStore, manager, result, shape }
}

const MORTAL_MAX_LEVEL = REALMS.find((realm) => realm.id === 'mortal')!.maxLevel

function equipmentEntry(overrides: Record<string, unknown> = {}) {
  const template = equipment.find((item) => item.id === 'base_kiem')!
  const range = template.mainStats[0]!
  return {
    entry: {
      instanceId: 'e1',
      itemId: 'base_kiem',
      slot: 'weapon',
      equipped: true,
      grade: 'cuu_pham',
      quality: 'hoang',
      mainStat: {
        id: 'm1',
        sourceId: 'roll-main',
        sourceType: 'equipment',
        stat: range.stat,
        flat: range.min,
      },
      affixes: [],
      forgeUsesTotal: 0,
      forgeUsesRemaining: 0,
      ...overrides,
    },
    range,
    template,
  }
}

describe('F-TC7-LEVEL: realmLevel bounded by the realm authored maxLevel', () => {
  it('realmLevel above maxLevel is rejected at the boundary', () => {
    const { save } = validSave({ realmLevel: MORTAL_MAX_LEVEL + 1 })
    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(shape.ok).toBe(false)
    expect(shape.issues.some((issue) => issue.path === 'player.realmLevel')).toBe(true)
  })

  it('control: realmLevel at maxLevel validates', () => {
    const { save } = validSave({ realmLevel: MORTAL_MAX_LEVEL })
    expect(validateGameSaveShape(JSON.parse(JSON.stringify(save))).ok).toBe(true)
  })
})

describe('F-TC7-BASE: restore rebuilds non-main baseStats onto authored defaults', () => {
  it('a forged non-main stat resets to the authored initial value', () => {
    const { save } = validSave()
    const baseStats = save.player.baseStats as Record<string, number>
    baseStats['might'] = 999
    baseStats['defense'] = 999
    baseStats['strength'] = 5 // in-cap main claim survives

    const { playerStore, result } = boot(save)
    expect(result.status).toBe('ok')
    expect(playerStore.baseStats.might).toBe(createBaseStats().might)
    expect(playerStore.baseStats.defense).toBe(createBaseStats().defense)
    expect(playerStore.baseStats.strength).toBe(5)
  })

  it('a baseStats key outside the authored record is dropped', () => {
    const { save } = validSave()
    const baseStats = save.player.baseStats as Record<string, number>
    baseStats['adminHp'] = 1e9

    const { playerStore, result } = boot(save)
    expect(result.status).toBe('ok')
    expect('adminHp' in playerStore.baseStats).toBe(false)
  })
})

describe('F-TC7-EXT: externalModifiers is a mirror - the restored copy clears', () => {
  it('persisted externalModifiers do not survive restore', () => {
    const forged: StatModifier = {
      id: 'ext_forge',
      sourceId: 'admin',
      sourceType: 'buff',
      stat: 'strength',
      flat: 999,
    }
    const { save } = validSave({ externalModifiers: [forged] })

    const { playerStore, result } = boot(save)
    expect(result.status).toBe('ok')
    expect(playerStore.externalModifiers).toEqual([])
  })
})

describe('F-TC7-ENH: equipmentSlots enhanceLevel bounded by MAX_SLOT_ENHANCE_LEVEL', () => {
  it('enhanceLevel above the authored cap is rejected', () => {
    const { save } = validSave({}, {
      equipmentSlots: [
        { slot: 'weapon', enhanceLevel: MAX_SLOT_ENHANCE_LEVEL + 1 },
      ],
    } as Partial<GameSave>)
    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(shape.ok).toBe(false)
  })

  it('control: enhanceLevel at the cap validates', () => {
    const { save } = validSave({}, {
      equipmentSlots: [{ slot: 'weapon', enhanceLevel: MAX_SLOT_ENHANCE_LEVEL }],
    } as Partial<GameSave>)
    expect(validateGameSaveShape(JSON.parse(JSON.stringify(save))).ok).toBe(true)
  })
})

describe('F-TC7-EQP: equipment mainStat writer-shape bound', () => {
  // mortal player, grade cuu_pham (realm mortal), quality hoang (x1):
  // bound = range.max * 1 * (1 + globalLevel(mortal, 18) * 0.05).
  const boundFlat = (rangeMax: number) =>
    rangeMax *
    ITEM_QUALITY_IMPLICIT_MULTIPLIER['hoang'] *
    (1 + getGlobalCultivationLevel('mortal', MORTAL_MAX_LEVEL) * MAIN_STAT_REALM_SCALE)

  it('mainStat flat above the authored roll bound is rejected', () => {
    const { entry, range } = equipmentEntry()
    entry.mainStat.flat = boundFlat(range.max) + 1
    const { save } = validSave({}, { equipment: [entry] } as Partial<GameSave>)
    expect(validateGameSaveShape(JSON.parse(JSON.stringify(save))).ok).toBe(false)
  })

  it('control: mainStat flat at the authored bound validates', () => {
    const { entry, range } = equipmentEntry()
    entry.mainStat.flat = boundFlat(range.max)
    const { save } = validSave({}, { equipment: [entry] } as Partial<GameSave>)
    expect(validateGameSaveShape(JSON.parse(JSON.stringify(save))).ok).toBe(true)
  })

  it('a percent or multiplier the writer never emits is rejected', () => {
    const { entry, range } = equipmentEntry()
    entry.mainStat.flat = range.min
    ;(entry.mainStat as Record<string, unknown>)['percent'] = 0.5
    const { save } = validSave({}, { equipment: [entry] } as Partial<GameSave>)
    expect(validateGameSaveShape(JSON.parse(JSON.stringify(save))).ok).toBe(false)

    const second = equipmentEntry()
    ;(second.entry.mainStat as Record<string, unknown>)['multiplier'] = 2
    const { save: saveTwo } = validSave({}, { equipment: [second.entry] } as Partial<GameSave>)
    expect(validateGameSaveShape(JSON.parse(JSON.stringify(saveTwo))).ok).toBe(false)
  })

  it('a main stat outside the template authored mains is rejected', () => {
    const { entry } = equipmentEntry()
    entry.mainStat.stat = 'strength' // weapon mains are might-only
    const { save } = validSave({}, { equipment: [entry] } as Partial<GameSave>)
    expect(validateGameSaveShape(JSON.parse(JSON.stringify(save))).ok).toBe(false)
  })
})

describe('F-TC7-AFX: an affix roll naming no authored tier clamps to the authored union', () => {
  const affix = affixes.find((a) => a.id === 'prefix_attack')!
  const unionMin = Math.min(...affix.tiers.map((tier) => tier.min))
  const unionMax = Math.max(...affix.tiers.map((tier) => tier.max))

  it('value above the union clamps to union max', () => {
    expect(
      getEffectiveAffixValue({ affixId: 'prefix_attack', tier: 99, value: 9999 } as never, affix),
    ).toBe(unionMax)
  })

  it('value below the union clamps to union min', () => {
    expect(
      getEffectiveAffixValue({ affixId: 'prefix_attack', tier: 99, value: -50 } as never, affix),
    ).toBe(unionMin)
  })

  it('control: a listed tier keeps an in-range value verbatim', () => {
    const tier = affix.tiers[1]!
    expect(
      getEffectiveAffixValue(
        { affixId: 'prefix_attack', tier: tier.tier, value: tier.min + 1 } as never,
        affix,
      ),
    ).toBe(tier.min + 1)
  })
})

describe('F-TC7-PILL: pill regen claims carry flat-only modifiers', () => {
  function regenClaim(modifier: Record<string, unknown>): GameSave {
    const authored = pills.find((pill) =>
      pill.effects.some((e) => e.type === 'regen' && e.mpPerSecond !== undefined))!
    const regen = authored.effects.find((e) => e.type === 'regen')!
    const effect: PersistentTimedEffect = {
      id: 'te1',
      sourceItemId: authored.id,
      effectGroup: regen.effectGroup,
      appliedAtMs: 1,
      expiresAtMs: Date.now() + 60_000,
      durationStackable: regen.stackable,
      modifiers: [
        {
          id: 'm',
          sourceId: authored.id,
          sourceType: 'pill',
          stat: 'manaRegenPerTurn',
          flat: regen.mpPerSecond,
          ...modifier,
        } as StatModifier,
      ],
    }
    const { save } = validSave({ persistentTimedEffects: [effect] })
    return save
  }

  it('a percent field on the regen modifier is rejected', () => {
    expect(
      validateGameSaveShape(JSON.parse(JSON.stringify(regenClaim({ percent: 0.5 })))).ok,
    ).toBe(false)
  })

  it('a multiplier field on the regen modifier is rejected', () => {
    expect(
      validateGameSaveShape(JSON.parse(JSON.stringify(regenClaim({ multiplier: 2 })))).ok,
    ).toBe(false)
  })

  it('control: the authored flat-only regen claim validates', () => {
    expect(validateGameSaveShape(JSON.parse(JSON.stringify(regenClaim({})))).ok).toBe(true)
  })
})

describe('F-TC7-ENT: pendingTalentEntitlement is bound to the realm it minted into', () => {
  it('an entitlement naming another realm is rejected', () => {
    // The offer itself is pool-legal so the coherence check is the only
    // rejecting rule - the record binds a realm the player is not in.
    const { save } = validSave({
      pendingTalentEntitlement: {
        realmId: 'qi_refining',
        offeredTalentIds: ['lk_bac_hai'],
      },
    } as Partial<PlayerData>)
    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(shape.ok).toBe(false)
    expect(
      shape.issues.some((issue) => issue.path === 'player.pendingTalentEntitlement.realmId'),
    ).toBe(true)
  })

  it('control: an entitlement bound to the player realm validates', () => {
    const { save } = validSave({
      realmId: 'qi_refining',
      cultivationPath: 'spell',
      cultivationWay: 'spell_pathway',
      spellPath: { element: null },
      // F-REALM-1: a qi_refining claim carries the initiation grade.
      breakthroughGrade: 1,
      pendingTalentEntitlement: {
        realmId: 'qi_refining',
        offeredTalentIds: ['lk_bac_hai'],
      },
    } as Partial<PlayerData>, {
      techniques: [fiveElementsTechnique()],
    })
    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(shape.ok).toBe(true)
  })
})

describe('F-TC7-TRIB: committedOutcome re-derives the breakthrough gate at settle', () => {
  function committedOutcome(overrides: Record<string, unknown> = {}) {
    return {
      attemptId: 7,
      outcome: 'victory' as const,
      targetRealmId: 'foundation_establishment',
      grade: 'human' as const,
      breakthroughType: 'normal' as const,
      receipt: null,
      settlementError: false,
      ...overrides,
    }
  }

  function wayTechnique(realmIndex: number): Technique {
    const entry = structuredClone(TECHNIQUES.find((t) => t.id === 'five_elements_art')!)
    entry.grade = Math.max(1, Math.min(entry.grade, realmIndex))
    entry.gradeHistory = {}
    if (entry.grade < realmIndex) {
      entry.gradeHistory = { [entry.grade]: { finalRank: 12, completionState: 'dai_thanh' } }
    }
    return entry
  }

  function committedSpellPlayer(overrides: Partial<PlayerData> = {}) {
    return player({
      cultivationPath: 'spell',
      cultivationWay: 'spell_pathway',
      realmId: 'qi_refining',
      // F-REALM-1 / F-A12-2: a committed qi+ save carries the stamped
      // initiation grade (writer clamps to >= 1).
      breakthroughGrade: 1,
      mortalBasicSkillId: undefined,
      spellPath: { element: null },
      ...overrides,
    })
  }

  function saveFor(p: PlayerData, outcome: Record<string, unknown>): GameSave {
    const save: GameSave = {
      version: CURRENT_SAVE_VERSION,
      player: { ...p, lastSavedAt: Date.now() },
      techniques: [wayTechnique(getRealmIndex('qi_refining'))],
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
      alchemyJobs: [],
      decompose: {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 0 },
        nextCycleAt: 0,
        started: false,
      },
      tribulation: { committedOutcome: outcome } as TribulationSaveSlice,
    }
    return save
  }

  function writerOf(p: PlayerData): TribulationPlayerWriter {
    const writer = p as TribulationPlayerWriter
    writer.setEquipmentModifiers = (modifiers: StatModifier[]) => {
      p.modifiers = modifiers
    }
    return writer
  }

  it('a victory committed for a player below the level gate parks - no realm entry', () => {
    const p = committedSpellPlayer({ realmLevel: 5 })
    const { manager, result } = boot(saveFor(p, committedOutcome()))
    expect(result.status).toBe('ok')

    expect(
      new TribulationOutcomeService().settleOutcome(
        writerOf(p),
        manager,
        manager.tribulationDirector,
      ),
    ).toBeNull()
    expect(p.realmId).toBe('qi_refining')
    expect(manager.tribulationDirector.getCommittedOutcome()).not.toBeNull()
  })

  it('a victory committed without the chapter-clear gate parks too', () => {
    const p = committedSpellPlayer({ realmLevel: 16 })
    const { manager, result } = boot(saveFor(p, committedOutcome()))
    expect(result.status).toBe('ok')

    expect(
      new TribulationOutcomeService().settleOutcome(
        writerOf(p),
        manager,
        manager.tribulationDirector,
      ),
    ).toBeNull()
    expect(p.realmId).toBe('qi_refining')
  })

  it('control: gate inputs present, the admissible outcome settles', () => {
    const p = committedSpellPlayer({
      realmLevel: 16,
      // F-TC9-2: the chain-prefix bound requires every earlier floor in
      // the zone - a legit claim on the last qi floor carries the full
      // mortal + qi prefix.
      completedStageIds: [
        ...Array.from({ length: 10 }, (_, index) => `mortal_dong_${index + 1}`),
        'qi_refining_forest',
        'qi_refining_deep_forest',
        'qi_refining_ember_canyon',
        'qi_refining_scorched_ridge',
        'qi_refining_sand_plain',
        'qi_refining_stone_range',
        'qi_refining_blade_peak',
        'qi_refining_mineral_pit',
        'qi_refining_mystic_marsh',
        'qi_refining_abyssal_pool',
      ],
    })
    const { manager, result } = boot(saveFor(p, committedOutcome()))
    expect(result.status).toBe('ok')

    const settled = new TribulationOutcomeService().settleOutcome(
      writerOf(p),
      manager,
      manager.tribulationDirector,
    )
    expect(settled?.kind).toBe('victory')
    expect(p.realmId).toBe('foundation_establishment')
  })
})
