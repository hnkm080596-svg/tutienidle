// W4-AUT audit repro harness (temp file - not part of the suite).
// Targets the wave-3 write-side mirror
// (supabase/migrations/202610050002_beta_save_boundary_mirror.sql):
// each case crafts a payload that provably passes every SQL leg in
// _check_save_payload, then runs it through the REAL client gates
// (validateGameSaveShape -> assertSaveAcceptable -> restoreGameSession).
// A client rejection here = a 'ready'-classified remote row that wedges
// under remote authority (no client-side remote delete/repair exists).
// SQL-side acceptance is a SOURCE_PROOF claim, argued per case by the
// migration line numbers cited in comments.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer, type PlayerData } from '../../core/player/Player'
import { usePlayerStore } from '../../stores/player'
import { lockBetaFeaturesForTests } from '../../core/game/__fixtures__/betaFeaturesUnlock'
import { commitSpellInitiationForTest, lockBetaWaysForTests } from '../../core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '../../core/game/__fixtures__/betaTalentsUnlock'
import { lockBetaElementsForTests } from '../../core/game/__fixtures__/betaElementsUnlock'
import { BETA_MORTAL_STARTER_SKILL_ID } from '../../core/betaScope'
import { CORE_REALM_LEVEL } from '../../core/realm/realmSystem'
import { materials } from '../../data/materials/materials'
import { pills } from '../../data/pill/pills'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { isValidCharacterName } from '../character/CharacterCreationService'
import { primeMortalCreationPick } from './GameSave.fixture'

import { buildGameSave, restoreGameSession } from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'
import { assertSaveAcceptable, isSaveAcceptable, staticSaveAcceptanceCatalogs } from './saveAcceptance'
import type { GameSave } from './saveTypes'
import { makeInstance } from '../../core/equipment/EquipmentInstance.fixture'
import { LUYEN_KHI_TINH_HOA_ID } from '../../core/equipment/TinhHoaMaterial'

lockBetaFeaturesForTests()
lockBetaWaysForTests()
lockBetaTalentsForTests()
lockBetaElementsForTests()

function committedContext(): { gameManager: GameManager; player: PlayerData } {
  const gameManager = new GameManager()
  const player = createDefaultPlayer()
  player.mortalBasicSkillId = BETA_MORTAL_STARTER_SKILL_ID
  player.nodeLevels = { ...player.nodeLevels, core_linh_bao: 1 }
  player.purchasedNodeIds = [...player.purchasedNodeIds, 'core_linh_bao']
  player.realmLevel = CORE_REALM_LEVEL
  gameManager.catalogOps.registerMaterials(materials)
  gameManager.catalogOps.registerPills(pills)
  gameManager.catalogOps.registerEquipment(equipment)
  gameManager.catalogOps.registerAffixes(affixes)
  gameManager.catalogOps.registerBuildings(buildings)
  gameManager.catalogOps.registerSkillTemplates([...SKILLS])
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerAlchemyRecipes(alchemyRecipes)
  gameManager.setActivePlayer(player)
  gameManager.progressionOps.learnSkill('linh_bao', player)
  commitSpellInitiationForTest(gameManager, player, 'fire')
  return { gameManager, player }
}

function committedSave(): { save: GameSave; gameManager: GameManager; player: PlayerData } {
  const { gameManager, player } = committedContext()
  return { save: buildGameSave(player, gameManager), gameManager, player }
}

function mortalSave(): { save: GameSave; gameManager: GameManager; player: PlayerData } {
  const gameManager = new GameManager()
  const player = createDefaultPlayer()
  gameManager.catalogOps.registerMaterials(materials)
  gameManager.catalogOps.registerPills(pills)
  gameManager.catalogOps.registerEquipment(equipment)
  gameManager.catalogOps.registerAffixes(affixes)
  gameManager.catalogOps.registerBuildings(buildings)
  gameManager.catalogOps.registerSkillTemplates([...SKILLS])
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerAlchemyRecipes(alchemyRecipes)
  primeMortalCreationPick(player, gameManager.skillManager)
  return { save: buildGameSave(player, gameManager), gameManager, player }
}

const playerOf = (save: GameSave) => save.player as unknown as Record<string, unknown>

function acceptanceMessage(save: GameSave): string | null {
  try {
    assertSaveAcceptable(save, staticSaveAcceptanceCatalogs())
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

function shapeIssues(save: unknown): string[] | null {
  const shape = validateGameSaveShape(save)
  return shape.ok ? null : shape.issues.map((i) => `${i.path}: ${i.message}`)
}

function stripFireRoot(save: GameSave): void {
  const player = playerOf(save)
  delete (player.nodeLevels as Record<string, number>).hoa_linh_ngo
  player.purchasedNodeIds = (player.purchasedNodeIds as string[]).filter(
    (id) => id !== 'hoa_linh_ngo',
  )
}

describe('W4-AUT residual classes: SQL accepts -> client rejects', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('baseline: committed fire save passes every client seam', () => {
    const { save } = committedSave()
    expect(validateGameSaveShape(save).ok).toBe(true)
    expect(acceptanceMessage(save)).toBeNull()
  })

  it('baseline: mortal save passes every client seam', () => {
    const { save } = mortalSave()
    expect(validateGameSaveShape(save).ok).toBe(true)
    expect(acceptanceMessage(save)).toBeNull()
  })

  it('realmLevel=99 on a committed save - SQL has no leg; shape rejects', () => {
    const { save } = committedSave()
    // SQL: no realmLevel leg exists in _check_save_payload.
    playerOf(save).realmLevel = 99
    const issues = shapeIssues(save)
    console.log('[W4-AUT:realmLevel99] shape issues=%o', issues)
    expect(issues).not.toBeNull()
    // note: isSaveAcceptable alone returns true here - acceptance assumes
    // shape ran first; the composed remote gate still rejects at shape.
  })

  it('realmLevel=0 (below realm floor) - SQL accepts; shape rejects', () => {
    const { save } = committedSave()
    playerOf(save).realmLevel = 0
    const issues = shapeIssues(save)
    expect(issues).not.toBeNull()
  })

  it('breakthroughGrade=99 post-initiation - SQL >=1 leg passes; shape rejects', () => {
    const { save } = committedSave()
    // SQL (:199-203): jsonb numeric >= 1 -> accept.
    // Client (:1056-1084): > 6 and > max(1, completedTiers) -> reject.
    playerOf(save).breakthroughGrade = 99
    const issues = shapeIssues(save)
    console.log('[W4-AUT:grade99] shape issues=%o', issues)
    expect(issues).not.toBeNull()
  })

  it('breakthroughGrade=1e999 (jsonb-finite, f64-Infinity) - SQL accepts; shape rejects', () => {
    const { save } = committedSave()
    // JSON wire value 1e999: PostgreSQL jsonb stores it as numeric 10^999
    // (finite, >= 1 -> SQL accepts). JSON.parse yields Infinity, which the
    // client's isFiniteNumber leg rejects. Same wire bytes, opposite verdict.
    playerOf(save).breakthroughGrade = JSON.parse('1e999') as number
    expect(playerOf(save).breakthroughGrade).toBe(Infinity)
    const issues = shapeIssues(save)
    console.log('[W4-AUT:grade1e999] shape issues=%o', issues)
    expect(issues).not.toBeNull()
  })

  it('breakthroughGrade=-1 on a MORTAL save - SQL has no mortal leg; shape rejects', () => {
    const { save } = mortalSave()
    // SQL: the breakthroughGrade leg only runs at realm index >= 1.
    playerOf(save).breakthroughGrade = -1
    const issues = shapeIssues(save)
    console.log('[W4-AUT:mortal-grade-neg] shape issues=%o', issues)
    expect(issues).not.toBeNull()
  })

  it('breakthroughGrade="2" (string) on a MORTAL save - SQL accepts; shape rejects', () => {
    const { save } = mortalSave()
    playerOf(save).breakthroughGrade = '2' as unknown as number
    const issues = shapeIssues(save)
    console.log('[W4-AUT:mortal-grade-str] shape issues=%o', issues)
    expect(issues).not.toBeNull()
  })

  it('fractional grade 1.5 vs completedTiers - outcome depends on live tiers', () => {
    const { save } = committedSave()
    // SQL has no grade-vs-tiers leg; the client binds grade <=
    // max(1, tiers). Fractional values are legal JSON on the wire; whether
    // the client rejects depends on persistedBodyRefinementTiers.
    playerOf(save).breakthroughGrade = 1.5
    const issues = shapeIssues(save)
    console.log(
      '[W4-AUT:grade1.5] tiers=%o issues=%o',
      playerOf(save).persistedBodyRefinementTiers,
      issues,
    )
  })

  it('way cross-module (path=spell, way=sword_pathway) - SQL pair leg skipped; shape rejects', () => {
    const { save } = committedSave()
    // SQL committed-pair leg (:221-234) fires only when way ===
    // 'spell_pathway'; with 'sword_pathway' the element/root legs skip ->
    // accept. Client: way not in module.ways (:2030-2040) rejects.
    playerOf(save).cultivationWay = 'sword_pathway'
    stripFireRoot(save) // keep SQL legal: hoa_linh_ngo claim needs the committed fire tuple
    const issues = shapeIssues(save)
    console.log('[W4-AUT:cross-way] shape issues=%o', issues)
    expect(issues).not.toBeNull()
  })

  it('path=spell without way - pair leg skips SQL-side; shape rejects pair incoherence', () => {
    const { save } = committedSave()
    playerOf(save).cultivationWay = undefined
    delete playerOf(save).cultivationWay
    stripFireRoot(save)
    const issues = shapeIssues(save)
    console.log('[W4-AUT:path-no-way] shape issues=%o', issues)
    expect(issues).not.toBeNull()
  })

  it('techniques=[{id:bogus}] - SQL non-empty leg passes; acceptance holder rejects', () => {
    const { save } = committedSave()
    save.techniques = [
      { id: 'bogus_technique' } as (typeof save.techniques)[number],
    ]
    // Shape: id-string entry -> passes. SQL: array_length >= 1 -> accepts.
    // Client acceptance (:124-211): way-bound holder must be exactly
    // 'five_elements_art' -> rejects.
    expect(shapeIssues(save)).toBeNull()
    const msg = acceptanceMessage(save)
    console.log('[W4-AUT:techniques-bogus] acceptance msg=%o', msg)
    expect(msg).not.toBeNull()
  })

  it('mortalBasicSkillId persisted post-initiation - SQL equality leg passes; contract rejects', () => {
    const { save } = committedSave()
    // SQL (:211-214): only a MORTAL row is checked for the field's
    // presence; a non-mortal row carrying it is fine, and (:164-167) the
    // equality leg accepts 'linh_bao' (the character's recorded pick).
    // Client contract (MortalPrecursors.ts:75-77): post-mortal row must
    // NOT carry the pick.
    playerOf(save).mortalBasicSkillId = 'linh_bao'
    const msg = acceptanceMessage(save)
    console.log('[W4-AUT:pick-persisted] acceptance msg=%o', msg)
    expect(msg).not.toBeNull()
  })

  it('pendingTalentEntitlement realmId=golden_core (stale realm) - SQL catalog leg passes; binding rejects', () => {
    const { save } = committedSave()
    // SQL (:257-264): realmId in the 10-realm catalog -> accept.
    // Client (:856-865): entitlement realmId must equal player.realmId.
    playerOf(save).pendingTalentEntitlement = {
      realmId: 'golden_core',
      offeredTalentIds: ['kd_thanh_dan'],
    }
    const issues = shapeIssues(save)
    console.log('[W4-AUT:entitlement-stale] shape issues=%o', issues)
    expect(issues).not.toBeNull()
  })

  it('pendingTalentEntitlement realmId=mortal on qi_refining - same residual, catalog-legal', () => {
    const { save } = committedSave()
    playerOf(save).pendingTalentEntitlement = {
      realmId: 'mortal',
      offeredTalentIds: ['lk_linh_mach'],
    }
    const issues = shapeIssues(save)
    expect(issues).not.toBeNull()
  })

  it('talentLevels non-object - SQL has no leg; shape rejects', () => {
    const { save } = committedSave()
    playerOf(save).talentLevels = 5 as unknown as Record<string, number>
    const issues = shapeIssues(save)
    console.log('[W4-AUT:talentLevels] shape issues=%o', issues)
    expect(issues).not.toBeNull()
  })

  it('talentLevels entry above talent maxLevel - SQL accepts; shape rejects', () => {
    const { save } = committedSave()
    const talentId = (playerOf(save).selectedTalentIds as string[])[0]
    if (talentId === undefined) {
      return
    }
    playerOf(save).talentLevels = { ...(playerOf(save).talentLevels as object), [talentId]: 99 }
    const issues = shapeIssues(save)
    console.log('[W4-AUT:talentLevels-99] issues=%o', issues)
    expect(issues).not.toBeNull()
  })

  it('highestFoundationAchieved=imperial without body records at realm>=2 - SQL non-empty leg passes; earnability rejects', () => {
    const { save } = committedSave()
    // SQL (:204-207): realm>=2 requires only a non-empty string.
    // Client (:1643-1696): enum membership AND realm-coherence AND an
    // earnability replay against persisted body records. 'imperial' with
    // no body records fails the replay.
    playerOf(save).realmId = 'foundation_establishment'
    playerOf(save).highestFoundationAchieved = 'imperial'
    const issues = shapeIssues(save)
    console.log('[W4-AUT:hfa-imperial] issues=%o', issues)
    expect(issues).not.toBeNull()
  })

  it('highestFoundationAchieved="garbage" at realm>=2 - SQL accepts any non-empty string', () => {
    const { save } = committedSave()
    playerOf(save).realmId = 'foundation_establishment'
    playerOf(save).highestFoundationAchieved = 'garbage'
    const issues = shapeIssues(save)
    expect(issues).not.toBeNull()
  })

  it('unknown talent id fake_talent_9 - symmetric hole (BOTH sides accept)', () => {
    const { save } = committedSave()
    // W3-AUT-5 stays open: neither side pins selectedTalentIds to the
    // known-catalog union. Server: not dup/parked/great_dao/pool ->
    // counted toward the ceiling only. Client: same.
    playerOf(save).selectedTalentIds = [
      ...(playerOf(save).selectedTalentIds as string[]),
      'fake_talent_9',
    ]
    const issues = shapeIssues(save)
    const msg = acceptanceMessage(save)
    console.log('[W4-AUT:fake-talent] issues=%o acceptance=%o', issues, msg)
    // documented hollow spot - both accept today. Pin records the contract.
    expect(issues).toBeNull()
    expect(msg).toBeNull()
  })
})

describe('W4-AUT charset divergence (client half; SQL leg is SOURCE_PROOF)', () => {
  it('client \\p{L}\\p{N} charset vs server [[:alnum:] _-]', () => {
    // Accepted client-side; [[:alnum:]] never matches them in any glibc
    // locale (Nd beyond 0-9, Nl, No are outside POSIX alnum):
    expect(isValidCharacterName('Đồng²')).toBe(true) // No: superscript two
    expect(isValidCharacterName('Ⅻ')).toBe(false) // Nl: single char under min length - separate check
    expect(isValidCharacterName('Ⅻabc')).toBe(true) // Nl: roman numeral twelve
    expect(isValidCharacterName('①')).toBe(false) // min length
    expect(isValidCharacterName('①ab')).toBe(true) // No: circled digit
    expect(isValidCharacterName('１２ab')).toBe(true) // Nd: fullwidth digits
    // Arabic-Indic digits (Nd, non-ASCII):
    expect(isValidCharacterName('١٢ab')).toBe(true)
    // Letters: fine under C.UTF-8; under LC_CTYPE=C the server mirror
    // rejects every non-ASCII letter including all of these:
    expect(isValidCharacterName('Nguyễn Văn')).toBe(true)
    // Asymmetric direction: JS \p{L} excludes combining marks that glibc
    // Other_Alphabetic may classify as alpha (e.g. U+0901 chandrabindu):
    expect(isValidCharacterName('Tést')).toBe(false) // Te + U+0301 combining acute
  })
})

describe('W4-AUT resume-mutation pin (rejected live-replacement may mutate before routing)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function createRegisteredManager(): GameManager {
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

  function incomingSave(): GameSave {
    const manager = createRegisteredManager()
    const player = createDefaultPlayer()
    primeMortalCreationPick(player, manager.skillManager)
    const instance = makeInstance({
      instanceId: 'w4-repl-item',
      itemId: 'base_kiem',
      equipped: true,
      realmLevel: 3,
      zoneId: 'thanh_van_dong',
      icon: '/equipment/w4.png',
      mainStat: {
        id: 'w4-main',
        sourceId: 'w4-repl-item',
        sourceType: 'equipment',
        stat: 'might',
        flat: 12,
      },
      affixes: [{ affixId: 'suffix_accuracy', tier: 1, value: 3 }],
    })
    player.name = 'crafted-payload-name'
    player.cultivation = 321
    manager.equipmentBag.add(instance)
    manager.materialBag.add(manager.materialRegistry.get(LUYEN_KHI_TINH_HOA_ID), 4)
    return buildGameSave(player, manager)
  }

  it('post-preflight owner throw -> rejected + live player already mutated (fixture-injected)', () => {
    // Mechanism pin: restoreGameSession (:273-315) runs preflight ->
    // player.restoreFromSave (commits $state via Object.assign at
    // player.ts:475) -> saveOps.restoreFromSave (mutates domain slices;
    // late owners like applyAllBodyModifiers/tribulationDirector sit after
    // earlier slices mutate - GameManagerSaveRestore.ts:161-163,451-452
    // acknowledge mid-restore throws) -> catch -> 'rejected'.
    // A stubbed late-owner throw stands in for any real post-preflight
    // failure; the observable is the committed player mutation.
    const player = usePlayerStore()
    const manager = createRegisteredManager()
    const save = incomingSave()
    player.name = 'existing-live-name'

    vi.spyOn(manager.saveOps, 'restoreFromSave').mockImplementation(() => {
      throw new Error('simulated late-owner failure')
    })

    const result = restoreGameSession(player, manager, save)

    expect(result.status).toBe('rejected')
    // The live store carries the crafted payload BEFORE the rejection
    // routed to saveIssue (App.vue:649-678). markFailed('recovery') keeps
    // it from persisting, but the surface now overlays a mutated session.
    // (cultivation is normalized during restore - name is the witness.)
    expect(player.name).toBe('crafted-payload-name')
  })
})
