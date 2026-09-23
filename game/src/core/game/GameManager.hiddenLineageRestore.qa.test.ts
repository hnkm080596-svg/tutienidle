// QA (deep audit, hidden-perfection-lineage): the full persistence chain
// for the lineage state machine - ritual commit -> buildGameSave ->
// JSON round-trip -> validateGameSaveShape -> restoreGameSession.
// The learned-defect pattern QA-2026-09-21-M4-F1 (restore ordering)
// plus the entered-realm==current-realm boundary are the attacks here.
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../stores/player'
import { GameManager } from './GameManager'
import { buildGameSave, restoreGameSession } from '../../services/save/SaveSystem'
import { validateGameSaveShape } from '../../services/save/saveShapeValidation'
import { completeHiddenBody } from '../realm/hidden/HiddenLineage'
import { TribulationOutcomeService } from '../tribulation/TribulationOutcomeService'
import { materials } from '../../data/materials/materials'
import { pills } from '../../data/pill/pills'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { SKILL_CORE_NODES } from '../../data/progression/SkillCoreNodes'

const NHAP_DAO_ENHANCED_PERCENT = 0.21

function makeManager(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerPills(pills)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  manager.catalogOps.registerBuildings(buildings)
  manager.catalogOps.registerSkillTemplates(SKILLS)
  manager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  manager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
  return manager
}

function eligibleForHiddenMortal(player: ReturnType<typeof usePlayerStore>): void {
  player.realmLevel = 18
  // Effective cap at mortal with 1 completed hidden body = floor(10*1.1)=11.
  player.baseStats = {
    ...player.baseStats,
    strength: 11,
    dexterity: 11,
    intelligence: 11,
    attunement: 11,
    vitality: 11,
  }
  expect(completeHiddenBody(player.$state, 'mortal')).toBeDefined()
}

describe('hidden lineage - save/restore chain (restoreGameSession)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('hidden ritual commit survives save -> restore: lineage open, entered realm recorded, enhanced passive', () => {
    const gameManager = makeManager()
    const player = usePlayerStore()
    eligibleForHiddenMortal(player)

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'spell_pathway', player.$state)).toBe(true)
    expect(player.realmId).toBe('qi_refining')
    expect(player.hiddenPerfection.hiddenBreakthroughRealmIds).toEqual(['qi_refining'])
    expect(player.hiddenPerfection.lineageActive).toBe(true)
    // A minimal-grade player on the ENHANCED variant: flat 0.21, not grade*0.03.
    const nhapDao = player.modifiers.filter((m) => m.id.startsWith('realm-passive:nhap_dao:'))
    expect(nhapDao.length).toBeGreaterThan(0)
    for (const m of nhapDao) {
      expect(m.percent).toBe(NHAP_DAO_ENHANCED_PERCENT)
    }

    const save = JSON.parse(JSON.stringify(buildGameSave(player.$state, gameManager)))
    expect(validateGameSaveShape(save)).toMatchObject({ ok: true })

    const freshManager = makeManager()
    const freshPlayer = usePlayerStore()
    const result = restoreGameSession(freshPlayer, freshManager, save)

    expect(result.status).toBe('ok')
    expect(freshPlayer.hiddenPerfection.lineageActive).toBe(true)
    expect(freshPlayer.hiddenPerfection.hiddenBreakthroughRealmIds).toEqual(['qi_refining'])
    expect(freshPlayer.hiddenPerfection.completedHiddenBodyRealmIds).toEqual(['mortal'])
    expect(freshPlayer.hiddenPerfection.realms.mortal?.bodyCompleted).toBe(true)
    expect(freshPlayer.grantedRealmPassiveIds).toContain('qi_refining')
    const restoredNhapDao = freshPlayer.modifiers.filter((m) =>
      m.id.startsWith('realm-passive:nhap_dao:'),
    )
    for (const m of restoredNhapDao) {
      expect(m.percent).toBe(NHAP_DAO_ENHANCED_PERCENT)
    }
  })

  it('normal ritual commit survives save -> restore: lineage permanently closed, closer mortal', () => {
    const gameManager = makeManager()
    const player = usePlayerStore()
    player.realmLevel = 12 // normal gate, no hidden investment

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'spell_pathway', player.$state)).toBe(true)
    expect(player.hiddenPerfection.lineageActive).toBe(false)
    expect(player.hiddenPerfection.lineageClosedByRealmId).toBe('mortal')

    const save = JSON.parse(JSON.stringify(buildGameSave(player.$state, gameManager)))
    expect(validateGameSaveShape(save)).toMatchObject({ ok: true })

    const freshManager = makeManager()
    const freshPlayer = usePlayerStore()
    const result = restoreGameSession(freshPlayer, freshManager, save)

    expect(result.status).toBe('ok')
    expect(freshPlayer.hiddenPerfection.lineageActive).toBe(false)
    expect(freshPlayer.hiddenPerfection.lineageClosedByRealmId).toBe('mortal')
    expect(freshPlayer.hiddenPerfection.hiddenBreakthroughRealmIds).toEqual([])
  })

  it('hidden TRIBULATION commit state (qi->foundation) survives restore: both entered realms + great_dao foundation', () => {
    const gameManager = makeManager()
    const player = usePlayerStore()
    eligibleForHiddenMortal(player)
    expect(gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'spell_pathway', player.$state)).toBe(true)

    // Drive the qi->foundation HIDDEN commit through the real outcome
    // service seam (the same seam TribulationOutcomeSettlement.dotPha
    // tests exercise end to end).
    expect(completeHiddenBody(player.$state, 'qi_refining')).toBeDefined()
    new TribulationOutcomeService().resolveVictory(player, gameManager, {
      targetRealmId: 'foundation_establishment',
      breakthroughType: 'hidden',
      grade: 'heaven',
      chapterIndex: 0,
      chaptersTotal: 1,
      chapterName: '',
      state: 'victory',
      currentQuestion: null,
      questionSecondsRemaining: 0,
      questionSecondsLimit: 0,
      secondsRemaining: 0,
    } as never)

    const save = JSON.parse(JSON.stringify(buildGameSave(player.$state, gameManager)))
    expect(validateGameSaveShape(save)).toMatchObject({ ok: true })

    const freshManager = makeManager()
    const freshPlayer = usePlayerStore()
    const result = restoreGameSession(freshPlayer, freshManager, save)

    expect(result.status).toBe('ok')
    expect(freshPlayer.hiddenPerfection.hiddenBreakthroughRealmIds).toEqual([
      'qi_refining',
      'foundation_establishment',
    ])
    expect(freshPlayer.hiddenPerfection.completedHiddenBodyRealmIds).toEqual([
      'mortal',
      'qi_refining',
    ])
    expect(freshPlayer.highestFoundationAchieved).toBe('great_dao')
  })

  it('fail-closed: save whose hiddenBreakthroughRealmIds outrun the player realm is rejected by the boot seam', () => {
    const gameManager = makeManager()
    const player = usePlayerStore()
    player.realmLevel = 12
    expect(gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'spell_pathway', player.$state)).toBe(true)

    const save = JSON.parse(JSON.stringify(buildGameSave(player.$state, gameManager)))
    // Tamper: claim a hidden foundation entry while the player sits at qi_refining.
    save.player.hiddenPerfection.hiddenBreakthroughRealmIds = ['foundation_establishment']

    const freshManager = makeManager()
    const freshPlayer = usePlayerStore()
    const result = restoreGameSession(freshPlayer, freshManager, save)

    expect(result.status).toBe('rejected')
  })

  it('fail-closed: save with a non-prefix completedHiddenBodyRealmIds is rejected by the boot seam', () => {
    const gameManager = makeManager()
    const player = usePlayerStore()
    player.realmLevel = 12
    expect(gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'spell_pathway', player.$state)).toBe(true)

    const save = JSON.parse(JSON.stringify(buildGameSave(player.$state, gameManager)))
    // Tamper: completed list skips the lineage root.
    save.player.hiddenPerfection.completedHiddenBodyRealmIds = ['qi_refining']
    save.player.hiddenPerfection.realms = { qi_refining: { bodyCompleted: true } }

    const freshManager = makeManager()
    const freshPlayer = usePlayerStore()
    const result = restoreGameSession(freshPlayer, freshManager, save)

    expect(result.status).toBe('rejected')
  })
})
