import { describe, expect, it } from 'vitest'
import { createDefaultArtifactProgress } from '../artifact/ArtifactProgression'
import { createDefaultPlayer } from '../player/Player'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { ALL_PROGRESSION_NODES } from '../../data/progression/ProgressionNodeCatalog'
import { GameManager } from './GameManager'

describe('GameManager — cultivation path realm rewards', () => {
  it('kit Trúc Cơ Pháp Tu từ data: artifact deferred Kim Đan, gọi lại không đụng tiến trình cũ', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerProgressionNodes(ALL_PROGRESSION_NODES)
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.realmId = 'qi_refining'
    gameManager.realmAdvanceOps.grantCanonicalTechnique('five_elements_art', player)
    gameManager.techniqueManager.getActive()!.mastery = 42

    player.realmId = 'foundation_establishment'

    // P7-M3 - the Truc Co record used to grant the artifact; the old
    // technique swap folded into five_elements_art.gradeEffects[2]
    // (grade-advance transaction), so the holder keeps the SAME
    // canonical technique and its progression state.
    // M-F-ARTIFACT-DEFER: the artifactId record moved to golden_core -
    // the TC record is passive-only now, so the grant reports true but
    // delivers NO artifact.
    expect(gameManager.realmAdvanceOps.grantCultivationPathRealmReward(player, player.realmId)).toBe(true)
    expect(gameManager.techniqueManager.getActive()?.id).toBe('five_elements_art')
    expect(gameManager.techniqueManager.getActive()?.mastery).toBe(42)
    expect(player.artifact).toBeUndefined()

    // A persisted dormant artifact (pre-deferral dev save) is never
    // disturbed by a repeated grant call.
    player.artifact = createDefaultArtifactProgress('ngu_hanh_chau')
    player.artifact.experience = 99

    expect(gameManager.realmAdvanceOps.grantCultivationPathRealmReward(player, player.realmId)).toBe(true)
    expect(player.artifact!.experience).toBe(99)
    expect(gameManager.techniqueManager.getActive()?.mastery).toBe(42)
  })

  it('realm-entry grant writes nodeLevels only - purchasedNodeIds mirror stays untouched', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerProgressionNodes(ALL_PROGRESSION_NODES)
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.realmId = 'foundation_establishment'
    player.purchasedNodeIds = ['existing_purchase']

    expect(gameManager.realmAdvanceOps.grantCultivationPathRealmReward(player, player.realmId)).toBe(true)
    expect(player.nodeLevels['the_thuc_tinh']).toBe(1)
    expect(player.purchasedNodeIds).toEqual(['existing_purchase'])
  })

  it('Kiếm Tu ở Trúc Cơ chỉ có record passive — không nhận nhầm technique/artifact Pháp Tu', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerProgressionNodes(ALL_PROGRESSION_NODES)
    player.cultivationPath = 'sword'
    player.cultivationWay = 'sword_pathway'
    player.realmId = 'foundation_establishment'

    // P7-M2 - sword's composed record is passive-only; the op reports
    // the reward exists (true) but grants no technique/artifact itself
    // (passive delivery is syncRealmPassive's channel).
    expect(gameManager.realmAdvanceOps.grantCultivationPathRealmReward(player, player.realmId)).toBe(true)
    expect(player.artifact).toBeUndefined()
    expect(gameManager.techniqueManager.getActive()).toBeUndefined()
  })
})
