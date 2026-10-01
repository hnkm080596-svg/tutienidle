// Adversarial falsification probes for the save-acceptance + restore seam.
//
// Every test asserts the SECURE expectation: a fabricated claim must be
// rejected by validateGameSaveShape / preflightSaveRegistryReferences, and
// whatever gets admitted must not mint an effect no authored writer could
// produce. A FAILING expectation is the defect evidence.
//
// Probes run at PIN commit 97f1878b on mortal + qi_refining (spell) saves.
// ASCII comments only.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { affixes } from '../data/equipment/affixes'
import { equipment } from '../data/equipment/equipment'
import { materials } from '../data/materials/materials'
import { TECHNIQUES } from '../data/technique/Techniques'
import { SKILLS } from '../data/skill/Skills'
import { ALL_PROGRESSION_NODES } from '../data/progression/ProgressionNodeCatalog'
import { ENEMIES } from '../data/enemy/Enemies'
import { STAGES } from '../data/stage/Stages'
import { zones } from '../data/stage/Zones'
import { pills } from '../data/pill/pills'
import { buffs } from '../data/buff/buffs'
import { talismans } from '../data/talisman/talismans'
import { formations } from '../data/formation/formations'
import { alchemyRecipes } from '../data/alchemy/alchemyRecipes'
import { buildings } from '../data/building/buildings'
import { QUESTS } from '../data/quest/quests'
import { GameManager } from '../core/game/GameManager'
import { makeInstance } from '../core/equipment/EquipmentInstance.fixture'
import { createDefaultPlayer } from '../core/player/Player'
import { getCultivationSpeedMultiplier } from '../core/talent/TalentEffects'
import { usePlayerStore } from '../stores/player'
import { withMortalCreationPick } from '../services/save/GameSave.fixture'
import { restoreGameSession } from '../services/save/SaveSystem'
import { validateGameSaveShape } from '../services/save/saveShapeValidation'
import { CURRENT_SAVE_VERSION } from '../services/save/SaveSystem'
import type { GameSave } from '../services/save/saveTypes'

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
    expect.soft(shape.ok).toBe(false)

    const { manager, result } = restoreSave(save)
    expect(result.status).not.toBe('ok')
    const minted = manager.equipmentOps.getEquipmentModifiers().filter((m) => m.stat === 'might')
    expect(minted).toHaveLength(0)
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
    expect.soft(shape.ok).toBe(false)

    const { manager, result } = restoreSave(save)
    expect(result.status).not.toBe('ok')
    const minted = manager.equipmentOps.getEquipmentModifiers().filter((m) => m.stat === 'maxHp')
    expect(minted).toHaveLength(0)
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
    save.equipment = [
      forgedBaseKiem({
        affixes: [
          { affixId: 'prefix_max_hp', tier: 1, value: 15 },
          { affixId: 'prefix_max_hp', tier: 2, value: 35 },
        ],
      }),
    ]

    const shape = validateGameSaveShape(save)
    expect.soft(shape.ok).toBe(false)

    const { manager, result } = restoreSave(save)
    expect(result.status).not.toBe('ok')
    const minted = manager.equipmentOps.getEquipmentModifiers().filter((m) => m.stat === 'maxHp')
    expect(minted.length).toBeLessThanOrEqual(1)
  })

  it('rejects an affix claiming the item mainStat stat', () => {
    const save = mortalSave()
    // prefix_attack is might -- same stat as the claimed mainStat; the
    // roller can never emit it on this item (excludeStats seed).
    save.equipment = [
      forgedBaseKiem({
        affixes: [{ affixId: 'prefix_attack', tier: 1, value: 6 }],
      }),
    ]

    const shape = validateGameSaveShape(save)
    expect.soft(shape.ok).toBe(false)

    const { manager, result } = restoreSave(save)
    expect(result.status).not.toBe('ok')
    const minted = manager.equipmentOps.getEquipmentModifiers().filter((m) => m.stat === 'might')
    expect(minted.length).toBeLessThanOrEqual(1)
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
  it('rejects a hoang item claiming a supreme-pool affix above its tier cap', () => {
    const save = mortalSave()
    save.equipment = [
      forgedBaseKiem({
        quality: 'hoang',
        // hoang rolls at most 1 substat, tier <= 1, pool 'basic' only.
        affixes: [
          { affixId: 'prefix_supreme_final_damage', tier: 5, value: 0.14 },
          { affixId: 'prefix_max_hp', tier: 3, value: 50 },
        ],
      }),
    ]

    const shape = validateGameSaveShape(save)
    expect.soft(shape.ok).toBe(false)

    const { manager, result } = restoreSave(save)
    expect(result.status).not.toBe('ok')
    const minted = manager.equipmentOps
      .getEquipmentModifiers()
      .filter((m) => m.stat === 'finalDamagePercent' || m.stat === 'maxHp')
    expect(minted).toHaveLength(0)
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
    expect.soft(shape.ok).toBe(false)

    const { manager, result } = restoreSave(save)
    expect(result.status).not.toBe('ok')
    const minted = manager.equipmentOps.getEquipmentModifiers().filter((m) => m.stat === 'might')
    expect(minted).toHaveLength(0)
  })
})

// ------------------------------------------------------------------
// F-EQ-MAINSTAT-NEG: the writer bound rejects only flat > maxFlat; a
// negative flat is finite and admitted, then applyScaledModifier pays
// it out as a negative stat. Self-harm only -> Low.
// ------------------------------------------------------------------
describe('F-EQ-MAINSTAT-NEG: negative mainStat flat', () => {
  it('rejects a negative mainStat flat claim', () => {
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
    expect.soft(shape.ok).toBe(false)

    const { manager, result } = restoreSave(save)
    expect(result.status).not.toBe('ok')
    const minted = manager.equipmentOps
      .getEquipmentModifiers()
      .filter((m) => m.stat === 'might' && (m.flat ?? 0) < 0)
    expect(minted).toHaveLength(0)
  })
})

// ------------------------------------------------------------------
// F-BASESTATS-NEG: baseStats values are only checked finite - a
// negative claim is admitted and the restore clamp (min(cap, v))
// keeps it, minting a negative main stat. Self-harm only -> Low.
// ------------------------------------------------------------------
describe('F-BASESTATS-NEG: negative baseStats claim', () => {
  it('rejects a negative main-stat claim in baseStats', () => {
    const save = mortalSave()
    ;(save.player.baseStats as Record<string, number>).might = -50

    const shape = validateGameSaveShape(save)
    expect.soft(shape.ok).toBe(false)

    const { player, result } = restoreSave(save)
    expect(result.status).not.toBe('ok')
    expect((player.baseStats as Record<string, number>).might).toBeGreaterThanOrEqual(0)
  })
})

// ------------------------------------------------------------------
// F-AP-DOUBLE-COUNT: attributePoints and baseStats are checked
// independently -- AP <= globalCultivationLevel, baseStats clamp to the
// realm cap. The joint claim (spent AP already inside baseStats AND the
// same AP still unspent) is unverifiable only because earned AP is
// never recorded; a forged save mints roughly 2x the authored stat
// ceiling at realm cap.
// ------------------------------------------------------------------
describe('F-AP-DOUBLE-COUNT: attribute points counted twice', () => {
  it('rejects baseStats at cap while the same attributePoints remain unspent', () => {
    const save = mortalSave()
    // mortal L18 earns 18 AP. baseStats=10 each already implies ~18
    // spent (1 base + 9 headroom per stat, cap 10); claiming the full
    // 18 still unspent doubles the points the profile could ever hold.
    save.player.realmLevel = 18
    save.player.attributePoints = 18
    for (const key of Object.keys(save.player.baseStats)) {
      ;(save.player.baseStats as Record<string, number>)[key] = 10
    }

    const shape = validateGameSaveShape(save)
    expect.soft(shape.ok).toBe(false)

    const { player, result } = restoreSave(save)
    expect(result.status).not.toBe('ok')
    expect(player.attributePoints).toBe(0)
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
    expect.soft(shape.ok).toBe(false)

    const { player, result } = restoreSave(save)
    expect(result.status).not.toBe('ok')
    // Live-effect check: a single grant yields 1.1x; the dup mints 1.2x.
    expect(
      getCultivationSpeedMultiplier(player.selectedTalentIds, player.talentLevels),
    ).toBeCloseTo(1.1, 10)
  })
})

// ------------------------------------------------------------------
// F-INSIGHT-UNBOUNDED: skillInsight <= totalSkillInsightGained is the
// only bound and the total itself is requireNonNegativeNumber, so the
// currency pair admits any magnitude (spendable into every node tree).
// Producible in principle but unverifiable -> document as currency gap.
// ------------------------------------------------------------------
describe('F-INSIGHT-UNBOUNDED: insight currency magnitude', () => {
  it('rejects an insight balance no session could have accrued', () => {
    const save = mortalSave()
    save.player.skillInsight = 1_000_000_000
    save.player.totalSkillInsightGained = 1_000_000_000

    const shape = validateGameSaveShape(save)
    expect.soft(shape.ok).toBe(false)

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
    ;(save.player as Record<string, unknown>).lastSavedAt = Number.NaN
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
