// W3-INT audit repro harness (temp file - not part of the suite).
// Traces bad-class spell_pathway saves through the REAL boot seams in
// order: validateGameSaveShape -> isSaveAcceptable (remote gate) ->
// preflightSaveRegistryReferences via restoreGameSession -> verdict +
// zero-mutation check on the live player store.
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer, type PlayerData } from '../../core/player/Player'
import { usePlayerStore } from '../../stores/player'
import { lockBetaFeaturesForTests } from '../../core/game/__fixtures__/betaFeaturesUnlock'
import {
  commitSpellInitiationForTest,
  lockBetaWaysForTests,
} from '../../core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '../../core/game/__fixtures__/betaTalentsUnlock'
import { lockBetaElementsForTests } from '../../core/game/__fixtures__/betaElementsUnlock'
import { BETA_MORTAL_STARTER_SKILL_ID } from '../../core/betaScope'
import { getActiveElement } from '../../core/player/CultivationPathSystem'
import { CORE_REALM_LEVEL } from '../../core/realm/realmSystem'
import { materials } from '../../data/materials/materials'
import { pills } from '../../data/pill/pills'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'

import { buildGameSave, restoreGameSession } from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'
import {
  assertSaveAcceptable,
  isSaveAcceptable,
  staticSaveAcceptanceCatalogs,
} from './saveAcceptance'
import type { GameSave } from './saveTypes'

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

describe('W3-INT seam trace', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('baseline: canonical committed fire save passes every seam', () => {
    const { save } = committedSave()
    expect(validateGameSaveShape(save).ok).toBe(true)
    expect(acceptanceMessage(save)).toBeNull()
  })

  it('element:null committed save - dies at SHAPE (corrupted), acceptance mirrors', () => {
    const { save } = committedSave()
    playerOf(save).spellPath = { element: null }

    const issues = shapeIssues(save)
    console.log('[W3-INT:element-null] shape issues=%o', issues)
    expect(issues).not.toBeNull()

    // acceptance mirror (shape-bypassing caller): root-claim fires first
    // because the real commit minted hoa_linh_ngo.
    const msg = acceptanceMessage(save)
    console.log('[W3-INT:element-null] acceptance msg=%o', msg)
    expect(msg).toContain("element root claim 'hoa_linh_ngo'")
    expect(isSaveAcceptable(save, staticSaveAcceptanceCatalogs())).toBe(false)
  })

  it('element:null WITHOUT the root - acceptance reaches F-SCOPE-1', () => {
    const { save } = committedSave()
    playerOf(save).spellPath = { element: null }
    stripFireRoot(save)

    const msg = acceptanceMessage(save)
    console.log('[W3-INT:null-no-root] acceptance msg=%o', msg)
    expect(msg).toContain('uncommittable element')
  })

  it('element:water + water-basic - shape rejects 3 classes; acceptance ordering root->F-SCOPE-1', () => {
    const { save } = committedSave()
    playerOf(save).spellPath = { element: 'water' }
    save.skills = [...save.skills, { ...save.skills[0]!, id: 'thuy_tien_thuat' }]

    const issues = shapeIssues(save)
    console.log('[W3-INT:water] shape issues=%o', issues)
    expect(issues).not.toBeNull()

    // Inside acceptance: the owned fire root claims first (root-claim precedes F-SCOPE-1)
    const msg = acceptanceMessage(save)
    console.log('[W3-INT:water] acceptance msg=%o', msg)
    expect(msg).toContain("element root claim 'hoa_linh_ngo'")

    // Strip the fire root -> kit coherence passes (water basic learned)
    // -> F-SCOPE-1 is the firing check.
    stripFireRoot(save)
    const msg2 = acceptanceMessage(save)
    console.log('[W3-INT:water-no-root] acceptance msg=%o', msg2)
    expect(msg2).toContain('uncommittable element')
  })

  it('element:water claiming hoa_linh_ngo - root-claim beats F-SCOPE-1 (ordering pin)', () => {
    const { save } = committedSave()
    playerOf(save).spellPath = { element: 'water' }

    const msg = acceptanceMessage(save)
    expect(msg).toContain("element root claim 'hoa_linh_ngo'")
  })

  it('element:fire claiming thuy_linh_ngo - shape catches exclusion+root+mirror', () => {
    const { save } = committedSave()
    ;(playerOf(save).nodeLevels as Record<string, number>).thuy_linh_ngo = 1

    const issues = shapeIssues(save)
    console.log('[W3-INT:fire+water-root] shape issues=%o', issues)
    expect(issues).not.toBeNull()

    // shape-bypass verdict: acceptance root-claim also fires
    const msg = acceptanceMessage(save)
    console.log('[W3-INT:fire+water-root] acceptance msg=%o', msg)
    expect(msg).toContain("element root claim 'thuy_linh_ngo'")
  })

  it('element:fire missing hoa_cau_thuat - which seam rejects first', () => {
    const { save } = committedSave()
    save.skills = save.skills.filter((s) => s.id !== 'hoa_cau_thuat')

    const issues = shapeIssues(save)
    console.log('[W3-INT:no-fire-basic] shape issues=%o', issues)

    const msg = acceptanceMessage(save)
    console.log('[W3-INT:no-fire-basic] acceptance msg=%o', msg)
  })

  it('element:shadow - shape ElementType boundary; acceptance root-claim precedes unknown-element', () => {
    const { save } = committedSave()
    playerOf(save).spellPath = { element: 'shadow' }

    const issues = shapeIssues(save)
    console.log('[W3-INT:shadow] shape issues=%o', issues)
    expect(issues).not.toBeNull()

    expect(getActiveElement(save.player as PlayerData)).toBe('shadow')
    const msg = acceptanceMessage(save)
    console.log('[W3-INT:shadow] acceptance msg=%o', msg)
    expect(msg).toContain("element root claim 'hoa_linh_ngo'")

    stripFireRoot(save)
    const msg2 = acceptanceMessage(save)
    console.log('[W3-INT:shadow-no-root] acceptance msg=%o', msg2)
    expect(msg2).toContain("unknown element 'shadow'")
  })

  it('hidden_spell_pathway pair carrying stale spellPath.element', () => {
    const { save } = committedSave()
    playerOf(save).cultivationWay = 'hidden_spell_pathway'
    expect(getActiveElement(save.player as PlayerData)).toBeUndefined()

    const issues = shapeIssues(save)
    console.log('[W3-INT:hidden+stale-element] shape issues=%o', issues)
    expect(issues).not.toBeNull()
  })

  it('sword_pathway pair carrying stale spellPath slice with element', () => {
    const { save } = committedSave()
    playerOf(save).cultivationPath = 'sword'
    playerOf(save).cultivationWay = 'sword_pathway'
    playerOf(save).swordPath = { preset: ['orb_dam'], kiemY: 0, kiemDaoCount: 1, kiemDaoBase: 1 }

    const issues = shapeIssues(save)
    console.log('[W3-INT:sword+stale-element] shape issues=%o', issues)
    expect(issues).not.toBeNull()
    expect(getActiveElement(save.player as PlayerData)).toBeUndefined()
  })

  it('mortal save carrying a spell pair - contract verdict', () => {
    const { save } = committedSave()
    playerOf(save).realmId = 'mortal'

    const issues = shapeIssues(save)
    console.log('[W3-INT:mortal+pair] shape issues=%o', issues)
    expect(issues).not.toBeNull()
  })

  it('SHAPE-CLEAN but acceptance-rejecting: wrong technique for the committed way', () => {
    const { save } = committedSave()
    // registry-valid id, wrong holder for spell_pathway (needs five_elements_art)
    save.techniques = [
      { ...save.techniques[0]!, id: 'dao_insight_art' },
    ]

    const issues = shapeIssues(save)
    console.log('[W3-INT:wrong-technique] shape issues=%o', issues)

    const msg = acceptanceMessage(save)
    console.log('[W3-INT:wrong-technique] acceptance msg=%o', msg)

    const player = usePlayerStore()
    const before = JSON.parse(JSON.stringify(player.$state))
    const { gameManager } = committedSave()
    const result = restoreGameSession(player, gameManager, save)
    console.log('[W3-INT:wrong-technique] restore=%o', result)
    if (issues === null) {
      expect(result.status).toBe('rejected')
      expect(player.$state).toEqual(before)
    }
  })

  it('SHAPE-CLEAN but acceptance-rejecting: hidden way missing kit member', () => {
    const { save } = committedSave()
    playerOf(save).cultivationWay = 'hidden_spell_pathway'
    playerOf(save).spellPath = { element: null }
    stripFireRoot(save)
    save.techniques = [
      { ...save.techniques[0]!, id: 'dao_insight_art' },
    ]
    save.skills = []

    const issues = shapeIssues(save)
    console.log('[W3-INT:hidden-missing-kit] shape issues=%o', issues)

    const msg = acceptanceMessage(save)
    console.log('[W3-INT:hidden-missing-kit] acceptance msg=%o', msg)

    if (issues === null) {
      const player = usePlayerStore()
      const before = JSON.parse(JSON.stringify(player.$state))
      const { gameManager } = committedSave()
      const result = restoreGameSession(player, gameManager, save)
      console.log('[W3-INT:hidden-missing-kit] restore=%o', result)
      expect(result.status).toBe('rejected')
      expect(player.$state).toEqual(before)
    }
  })

  it('SHAPE-CLEAN but acceptance-rejecting: fire element missing basic AND its core', () => {
    const { save } = committedSave()
    save.skills = save.skills.filter((s) => s.id !== 'hoa_cau_thuat')
    delete (playerOf(save).nodeLevels as Record<string, number>).core_hoa_cau_thuat
    playerOf(save).purchasedNodeIds = (playerOf(save).purchasedNodeIds as string[]).filter(
      (id) => id !== 'core_hoa_cau_thuat',
    )

    const issues = shapeIssues(save)
    console.log('[W3-INT:no-basic-no-core] shape issues=%o', issues)

    const msg = acceptanceMessage(save)
    console.log('[W3-INT:no-basic-no-core] acceptance msg=%o', msg)

    if (issues === null) {
      const player = usePlayerStore()
      const before = JSON.parse(JSON.stringify(player.$state))
      const { gameManager } = committedSave()
      const result = restoreGameSession(player, gameManager, save)
      console.log('[W3-INT:no-basic-no-core] restore=%o', result)
      expect(result.status).toBe('rejected')
      expect(player.$state).toEqual(before)
    }
  })

  it('SHAPE-CLEAN but acceptance-rejecting: way-less mortal carrying a technique', () => {
    const { save } = committedSave()
    playerOf(save).realmId = 'mortal'
    delete playerOf(save).cultivationPath
    delete playerOf(save).cultivationWay
    playerOf(save).spellPath = { element: null }
    stripFireRoot(save)
    save.techniques = [
      { ...save.techniques[0]!, id: 'five_elements_art' },
    ]

    const issues = shapeIssues(save)
    console.log('[W3-INT:mortal-wayout-technique] shape issues=%o', issues)

    const msg = acceptanceMessage(save)
    console.log('[W3-INT:mortal-wayout-technique] acceptance msg=%o', msg)
  })
})
