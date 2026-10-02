// TC11 blind falsification harvest (devin-b7a6e9a372134a41bae53e16fb1415b7,
// pin 97f1878b) - every test asserts the SECURE expectation: a fabricated
// claim must be rejected by validateGameSaveShape / restore, and whatever
// is admitted must not mint an effect no authored writer could produce.
//
// Medium+ probes are live pins (fixed in the T21c wave on devin/qa-fixpoint).
// Low findings are deferred per the Medium+-only ruling and stay skipped,
// not deleted, until the exception closes (same convention as F-B-CONS-3/4).
// ASCII comments only.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { affixes } from '@/data/equipment/affixes'
import { equipment } from '@/data/equipment/equipment'
import { materials } from '@/data/materials/materials'
import { TECHNIQUES } from '@/data/technique/Techniques'
import { SKILLS } from '@/data/skill/Skills'
import { ALL_PROGRESSION_NODES } from '@/data/progression/ProgressionNodeCatalog'
import { ENEMIES } from '@/data/enemy/Enemies'
import { STAGES } from '@/data/stage/Stages'
import { zones } from '@/data/stage/Zones'
import { pills } from '@/data/pill/pills'
import { buffs } from '@/data/buff/buffs'
import { talismans } from '@/data/talisman/talismans'
import { formations } from '@/data/formation/formations'
import { alchemyRecipes } from '@/data/alchemy/alchemyRecipes'
import { buildings } from '@/data/building/buildings'
import { QUESTS } from '@/data/quest/quests'
import { GameManager } from '@/core/game/GameManager'
import { makeInstance } from '@/core/equipment/EquipmentInstance.fixture'
import { createDefaultPlayer } from '@/core/player/Player'
import { usePlayerStore } from '@/stores/player'
import { withMortalCreationPick } from '@/services/save/GameSave.fixture'
import { restoreGameSession } from '@/services/save/SaveSystem'
import { validateGameSaveShape } from '@/services/save/saveShapeValidation'
import { CURRENT_SAVE_VERSION } from '@/services/save/SaveSystem'
import type { GameSave } from '@/services/save/saveTypes'

// The production registration set (same union App.vue/EarlyGameSession
// boot with) - acceptance membership checks share this catalog.
function createRegisteredManager(): GameManager {
  const manager = new GameManager()
  const catalog = manager.catalogOps
  catalog.registerMaterials(materials)
  catalog.registerSkillTemplates(SKILLS)
  catalog.registerTechniqueTemplates(TECHNIQUES)
  catalog.registerEnemyTemplates(ENEMIES)
  catalog.registerStages(STAGES)
  catalog.registerZones(zones)
  catalog.registerEquipment(equipment)
  catalog.registerAffixes(affixes)
  catalog.registerPills(pills)
  catalog.registerBuffs(buffs)
  catalog.registerTalismans(talismans)
  catalog.registerFormations(formations)
  catalog.registerAlchemyRecipes(alchemyRecipes)
  catalog.registerBuildings(buildings)
  catalog.registerProgressionNodes(ALL_PROGRESSION_NODES)
  catalog.registerQuests(QUESTS)
  return manager
}

// Legal mortal save: default player + the three-channel creation pick.
function mortalSave(): GameSave {
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
  return withMortalCreationPick(save)
}

// Legal qi_refining spell-pathway save (initiation committed).
function qiRefiningSave(): GameSave {
  const save = mortalSave()
  save.player = {
    ...createDefaultPlayer(),
    realmId: 'qi_refining',
    realmLevel: 1,
    cultivationPath: 'spell',
    cultivationWay: 'spell_pathway',
    breakthroughGrade: 1,
    mortalBasicSkillId: undefined,
  }
  save.techniques = [structuredClone(TECHNIQUES.find((t) => t.id === 'five_elements_art')!)]
  save.skills = []
  save.player.nodeLevels = {}
  save.player.purchasedNodeIds = []
  return save
}

function forgedBaseKiem(overrides: Parameters<typeof makeInstance>[0]) {
  return structuredClone(
    makeInstance({
      instanceId: 'probe-item-1',
      itemId: 'base_kiem',
      equipped: true,
      mainStat: {
        id: 'probe-item-1-main',
        sourceId: 'probe-item-1',
        sourceType: 'equipment',
        stat: 'might',
        flat: 10,
      },
      ...overrides,
    }),
  )
}

function restoreSave(save: GameSave) {
  const player = usePlayerStore()
  const manager = createRegisteredManager()
  const result = restoreGameSession(player, manager, save)
  return { player, manager, result }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.spyOn(Date, 'now').mockReturnValue(1_725_160_000_000)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ------------------------------------------------------------------
// F-EQ-GRADE-REALM: an equipped instance may claim ANY ItemGrade; the
// validator checks the grade enum only, never grade-vs-player-realm.
// equip() enforces canUseItemGrade strict equality, and breakthrough
// strips gear, so no authored save can carry a mismatched EQUIP claim.
// ------------------------------------------------------------------
describe('F-EQ-GRADE-REALM: equipped item grade vs player realm', () => {
  it('rejects an equipped item whose grade the player realm cannot use', () => {
    const save = mortalSave()
    // mortal -> profession grade cuu_pham; bat_pham is the qi_refining grade.
    save.equipment = [forgedBaseKiem({ grade: 'bat_pham' })]

    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)
    // restore-side mint assertions removed: restoreGameSession
    // consumes pre-validated input only (loadGame/importSaveRaw gate at
    // validateGameSaveShape); a rejected save never reaches it.
  })
})

// ------------------------------------------------------------------
// F-EQ-AFFIX-SLOT: the validator's slot check reads the RAW data array
// where most affixes carry slots===undefined, so the check is skipped;
// the registry re-normalizes slots through isValidEquipmentSubstat, so
// the raw claim can mint a stat the slot policy forbids (maxHp is a
// substat only on armor/necklace per EQUIPMENT_SLOT_STAT_POLICY).
// ------------------------------------------------------------------
describe('F-EQ-AFFIX-SLOT: affix stat that slot policy forbids', () => {
  it('rejects prefix_max_hp claimed on a weapon', () => {
    const save = mortalSave()
    save.equipment = [
      forgedBaseKiem({
        affixes: [{ affixId: 'prefix_max_hp', tier: 1, value: 15 }],
      }),
    ]

    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)
    // restore-side mint assertions removed: restoreGameSession
    // consumes pre-validated input only (loadGame/importSaveRaw gate at
    // validateGameSaveShape); a rejected save never reaches it.
  })
})

// ------------------------------------------------------------------
// F-EQ-AFFIX-DUP: rollAffixes starts excludeStats with the mainStat and
// accumulates every rolled stat, so a real item can never carry two
// affixes on the same stat. The validator only bounds count (<=8), so
// stacked duplicate affixes mint duplicated stats.
// ------------------------------------------------------------------
describe('F-EQ-AFFIX-DUP: duplicate affix stat on one item', () => {
  it('rejects two affixes claiming the same stat on one item', () => {
    const save = mortalSave()
    // Isolated: huyen ceiling is 2 substats at tier <= 2 from the basic
    // pool, so a same-stat pair on otherwise-legal affixes is rejected
    // ONLY by the stat-uniqueness bound (roller excludeStats).
    save.equipment = [
      forgedBaseKiem({
        quality: 'huyen',
        affixes: [
          { affixId: 'prefix_critical_rate', tier: 1, value: 0.01 },
          { affixId: 'prefix_critical_rate', tier: 2, value: 0.03 },
        ],
      }),
    ]

    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)
    // restore-side mint assertions removed: restoreGameSession
    // consumes pre-validated input only (loadGame/importSaveRaw gate at
    // validateGameSaveShape); a rejected save never reaches it.
  })

  it('rejects an affix claiming the item mainStat stat', () => {
    const save = mortalSave()
    // prefix_attack is might -- same stat as the claimed mainStat; the
    // roller can never emit it on this item (excludeStats seed). The
    // slot-policy bound also rejects this save (might is never a
    // weapon substat), so the claim is masked there by design.
    save.equipment = [
      forgedBaseKiem({
        affixes: [{ affixId: 'prefix_attack', tier: 1, value: 6 }],
      }),
    ]

    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)
    // restore-side mint assertions removed: restoreGameSession
    // consumes pre-validated input only (loadGame/importSaveRaw gate at
    // validateGameSaveShape); a rejected save never reaches it.
  })
})

// ------------------------------------------------------------------
// F-EQ-AFFIX-ENVELOPE: ITEM_QUALITY_SUBSTATS_RANGE / _AFFIX_TIER /
// _UNLOCKED_POOLS / _AFFIX_SLOTS bound what a given quality can roll;
// the validator checks none of them. A hoang item can claim more
// affixes than its quality allows, a supreme-pool affix it can never
// unlock, and a tier far above its ceiling (getEffectiveAffixValue then
// normalizes the value against the union of authored tiers).
// ------------------------------------------------------------------
describe('F-EQ-AFFIX-ENVELOPE: quality-inconsistent affix claims', () => {
  // Each probe is isolated: every claim is legal under every other bound
  // so a single envelope check is the only rejector.
  it('rejects more affixes than the quality substat ceiling', () => {
    const save = mortalSave()
    // hoang rolls at most 1 substat; both affixes are otherwise legal.
    save.equipment = [
      forgedBaseKiem({
        quality: 'hoang',
        affixes: [
          { affixId: 'prefix_critical_rate', tier: 1, value: 0.01 },
          { affixId: 'suffix_accuracy', tier: 1, value: 3 },
        ],
      }),
    ]

    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)
  })

  it('rejects an affix from a pool the quality has not unlocked', () => {
    const save = mortalSave()
    // dia unlocks basic/advanced/specialized - supreme opens at thien.
    save.equipment = [
      forgedBaseKiem({
        quality: 'dia',
        affixes: [{ affixId: 'prefix_supreme_final_damage', tier: 1, value: 0.01 }],
      }),
    ]

    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)
  })

  it('rejects an affix tier above the quality cap', () => {
    const save = mortalSave()
    // huyen caps affix tier at 2; prefix_critical_rate authors tiers
    // 1..3, so tier 3 is authored but above this quality's cap.
    save.equipment = [
      forgedBaseKiem({
        quality: 'huyen',
        affixes: [{ affixId: 'prefix_critical_rate', tier: 3, value: 0.06 }],
      }),
    ]

    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)
  })

  it('rejects an affix tier the definition never authors', () => {
    const save = mortalSave()
    // thien caps affix tier at 4; prefix_critical_rate only authors
    // tiers 1..3, so tier 4 is inside the quality cap but unproducible.
    save.equipment = [
      forgedBaseKiem({
        quality: 'thien',
        affixes: [{ affixId: 'prefix_critical_rate', tier: 4, value: 0.1 }],
      }),
    ]

    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)
  })
})

// ------------------------------------------------------------------
// F-EQ-FOREIGN-SLOT: the validator checks slot is a valid enum member
// but never compares it against the template's authored slot. A weapon
// claimed as 'helmet' equips into the helmet slot and mints its weapon
// mainStat there (applyModifiers does not re-check either).
// ------------------------------------------------------------------
describe('F-EQ-FOREIGN-SLOT: item claiming a slot its template forbids', () => {
  it('rejects base_kiem claimed in the helmet slot', () => {
    const save = mortalSave()
    save.equipment = [forgedBaseKiem({ slot: 'helmet' })]

    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)
    // restore-side mint assertions removed: restoreGameSession
    // consumes pre-validated input only (loadGame/importSaveRaw gate at
    // validateGameSaveShape); a rejected save never reaches it.
  })
})

// ------------------------------------------------------------------
// F-EQ-MAINSTAT-NEG: the writer bound rejects only flat > maxFlat; a
// negative flat is finite and admitted, then applyScaledModifier pays
// it out as a negative stat. Self-harm only -> Low.
// ------------------------------------------------------------------
describe('F-EQ-MAINSTAT-NEG: negative mainStat flat', () => {
  // F-EQ-MAINSTAT-NEG - Low, deferred per Medium+-only ruling (human exception).
  // Skipped, not deleted: the pin stays dormant until the exception closes.
  it.skip('rejects a negative mainStat flat claim', () => {
    const save = mortalSave()
    save.equipment = [
      forgedBaseKiem({
        mainStat: {
          id: 'probe-item-neg-main',
          sourceId: 'probe-item-1',
          sourceType: 'equipment',
          stat: 'might',
          flat: -50,
        },
      }),
    ]

    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)
    // restore-side mint assertions removed: restoreGameSession
    // consumes pre-validated input only (loadGame/importSaveRaw gate at
    // validateGameSaveShape); a rejected save never reaches it.
  })
})

// ------------------------------------------------------------------
// F-BASESTATS-NEG: baseStats values are only checked finite - a
// negative claim is admitted and the restore clamp (min(cap, v))
// keeps it, minting a negative main stat. Self-harm only -> Low.
// ------------------------------------------------------------------
describe('F-BASESTATS-NEG: negative baseStats claim', () => {
  // F-BASESTATS-NEG - Low, deferred per Medium+-only ruling (human exception).
  // Skipped, not deleted: the pin stays dormant until the exception closes.
  it.skip('rejects a negative main-stat claim in baseStats', () => {
    const save = mortalSave()
    ;(save.player.baseStats as Record<string, number>).might = -50

    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)

    const { player, result } = restoreSave(save)
    expect(result.status).not.toBe('ok')
    expect((player.baseStats as Record<string, number>).might).toBeGreaterThanOrEqual(0)
  })
})

// ------------------------------------------------------------------
// F-AP-DOUBLE-COUNT: attributePoints and baseStats are checked
// independently -- AP <= globalCultivationLevel, baseStats clamp to the
// realm cap. The joint claim is unverifiable: baseStats grow through
// allocateAttributePoint spend AND permanent_stat pills (unlimited-use,
// no consumption ledger), so spent AP is unobservable in the save.
// ------------------------------------------------------------------
describe('F-AP-DOUBLE-COUNT: attribute points counted twice', () => {
  // F-AP-DOUBLE-COUNT - deferred per human exception ruling (no authored
  // ceiling class, same as forged totalExperience). Skipped, not deleted:
  // permanent_stat pills are a second, unbounded, unledgered baseStats
  // writer, so spent AP is unobservable - a saturated-stat plus full-pool
  // claim is indistinguishable from a legit pill-fed save. The bound
  // lived briefly at 120cba78 and was reverted after the
  // hiddenLineageRestore chain proved the false positive.
  it.skip('rejects baseStats at cap while the same attributePoints remain unspent', () => {
    const save = mortalSave()
    save.player.realmLevel = 18
    save.player.attributePoints = 18
    for (const key of Object.keys(save.player.baseStats)) {
      ;(save.player.baseStats as Record<string, number>)[key] = 10
    }

    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)
  })
})

// ------------------------------------------------------------------
// F-TALENT-DUP: the count bound counts array entries, never ids, so a
// duplicated pool-talent id is admitted (creation ids are protected by
// the separate creationTalentCount bound; pool ids are not).
// collectTalentEffects then pushes the talent's effects once per entry,
// minting effects the single-claim writer (guarded by includes before
// push) could never emit. Probe: lk_dung_nap cultivation_speed doubles
// from +10% to +20%.
// ------------------------------------------------------------------
describe('F-TALENT-DUP: duplicated selectedTalentIds entry', () => {
  it('rejects the same pool talent id claimed twice', () => {
    const save = qiRefiningSave()
    save.player.selectedTalentIds = ['lk_dung_nap', 'lk_dung_nap']
    save.player.talentLevels = { lk_dung_nap: 1 }

    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)
    // restore-side mint assertions removed: restoreGameSession consumes
    // pre-validated input only; a rejected save never reaches it.
  })
})

// ------------------------------------------------------------------
// F-INSIGHT-UNBOUNDED: skillInsight <= totalSkillInsightGained is the
// only bound and the total itself is requireNonNegativeNumber, so the
// currency pair admits any magnitude (spendable into every node tree).
// Producible in principle but unverifiable -> document as currency gap.
// ------------------------------------------------------------------
describe('F-INSIGHT-UNBOUNDED: insight currency magnitude', () => {
  // F-INSIGHT-UNBOUNDED - Low, deferred per Medium+-only ruling (human exception).
  // Skipped, not deleted: the pin stays dormant until the exception closes.
  it.skip('rejects an insight balance no session could have accrued', () => {
    const save = mortalSave()
    save.player.skillInsight = 1_000_000_000
    save.player.totalSkillInsightGained = 1_000_000_000

    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)

    const { player, result } = restoreSave(save)
    expect(result.status).not.toBe('ok')
    expect(player.skillInsight).toBe(0)
  })
})

// ------------------------------------------------------------------
// HOLD probes: surfaces that DO reject the forged claim. These tests
// must PASS -- they pin the bound that stops the mint.
// ------------------------------------------------------------------
describe('HOLDS: boundary claims that stay rejected', () => {
  it('negative skillInsight is rejected', () => {
    const save = mortalSave()
    save.player.skillInsight = -1
    save.player.totalSkillInsightGained = -1
    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('realmLevel above realm maxLevel is rejected', () => {
    const save = mortalSave()
    save.player.realmLevel = 19
    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('attributePoints above global cultivation level is rejected', () => {
    const save = mortalSave()
    save.player.attributePoints = 99
    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('NaN lastSavedAt is rejected', () => {
    const save = mortalSave()
    ;(save.player as unknown as Record<string, unknown>).lastSavedAt = Number.NaN
    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('unknown equipment affix id is rejected at restore preflight', () => {
    const save = mortalSave()
    save.equipment = [forgedBaseKiem({ affixes: [{ affixId: 'forged_affix', tier: 1, value: 1 }] })]
    const { result } = restoreSave(save)
    expect(result.status).toBe('rejected')
  })

  it('unknown material id is rejected at restore preflight', () => {
    const save = mortalSave()
    save.materials = [{ materialId: 'forged_material', amount: 5 } as never]
    const { result } = restoreSave(save)
    expect(result.status).toBe('rejected')
  })

  it('tribulation committedOutcome grade above resolvable rank is rejected', () => {
    const save = mortalSave()
    save.tribulation = {
      committedOutcome: {
        attemptId: 1,
        outcome: 'victory',
        targetRealmId: 'foundation_establishment',
        grade: 'tien_dao',
        breakthroughType: 'normal',
      },
    } as never
    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('a mortal save carrying cultivationPath is rejected', () => {
    const save = mortalSave()
    save.player.cultivationPath = 'spell'
    save.player.cultivationWay = 'spell_pathway'
    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('a material stack amount above stackLimit clamps at restore', () => {
    const save = mortalSave()
    // yeu_dan_hung_giao is a real registered material (stackLimit 100);
    // MaterialBag.add clamps the forged amount to the stack cap.
    save.materials = [{ materialId: 'yeu_dan_hung_giao', amount: 10_000_000_000 } as never]
    const { manager, result } = restoreSave(save)
    expect(result.status).toBe('ok')
    const stack = manager.materialBag.getAll().find((s) => s.material.id === 'yeu_dan_hung_giao')
    expect(stack!.amount).toBeLessThanOrEqual(100)
  })

  it('a modifier claiming an unowned meridian source is rejected', () => {
    const save = mortalSave()
    save.player.modifiers = [
      {
        id: 'bat-mach:ren_mai:might',
        sourceId: 'ren_mai',
        sourceType: 'meridian',
        stat: 'might',
        flat: 5,
      } as never,
    ]
    expect(validateGameSaveShape(save).ok).toBe(false)
  })
})
