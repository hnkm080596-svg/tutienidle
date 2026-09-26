import { describe, expect, it } from 'vitest'
import { createDefaultArtifactProgress } from '../artifact/ArtifactProgression'
import { createDefaultPlayer } from '../player/Player'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { ALL_PROGRESSION_NODES } from '../../data/progression/ProgressionNodeCatalog'
import { GameManager } from './GameManager'
import { withMortalCreationPick } from '../../services/save/GameSave.fixture'
import { CURRENT_SAVE_VERSION } from '../../services/save/saveVersion'
import type { GameSave } from '../../services/save/SaveSystem'

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
    // Phap Tu Reimagined: the_thuc_tinh is retired - Truc Co grants the
    // per-element mastery record (element gate activates the committed
    // element's grant only).
    expect(player.nodeLevels['the_thuc_tinh']).toBeUndefined()
    expect(player.nodeLevels['tinh_thong_hoa']).toBe(1)
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

  // F-PT-A9-1 - a save that already PASSED Truc Co before the reward
  // nodes existed never received the grant (breakthrough transition is
  // the only write site). Restore replays the idempotent max-write.
  it('restore reconciles realm rewards: Truc Co save missing reward nodes gets them granted', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerProgressionNodes(ALL_PROGRESSION_NODES)
    gameManager.setActivePlayer(player)

    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.realmId = 'qi_refining'
    gameManager.realmAdvanceOps.grantCanonicalTechnique('five_elements_art', player)
    player.realmId = 'foundation_establishment'
    // Canonical post-transition technique state (realm-exit seal +
    // grade catch-up) so the crafted save passes the v75 holder check.
    gameManager.realmAdvanceOps.applyTechniqueRealmTransition(player, 'foundation_establishment')
    gameManager.techniqueSystem.advanceTechniqueGrade('foundation_establishment')
    expect(player.nodeLevels['tinh_thong_hoa']).toBeUndefined()

    const save: GameSave = withMortalCreationPick({
      version: CURRENT_SAVE_VERSION,
      player: { ...player },
      techniques: gameManager.techniqueManager.getAll(),
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
    } as GameSave)

    gameManager.saveOps.restoreFromSave(save)

    expect(player.nodeLevels['tinh_thong_hoa']).toBe(1)
    expect(player.purchasedNodeIds ?? []).not.toContain('tinh_thong_hoa')
  })

  it('reconcile is idempotent and never grants rewards above the player realm', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerProgressionNodes(ALL_PROGRESSION_NODES)
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.realmId = 'qi_refining'

    // qi_refining has no realmRewards record below golden-gated content -
    // nothing the player realm has not reached may be granted.
    gameManager.realmAdvanceOps.reconcileCultivationPathRealmRewards(player)
    expect(player.nodeLevels['tinh_thong_hoa']).toBeUndefined()

    player.realmId = 'foundation_establishment'
    gameManager.realmAdvanceOps.reconcileCultivationPathRealmRewards(player)
    expect(player.nodeLevels['tinh_thong_hoa']).toBe(1)

    // Replay must not disturb existing state (max-write semantics).
    player.nodeLevels['tinh_thong_hoa'] = 4
    gameManager.realmAdvanceOps.reconcileCultivationPathRealmRewards(player)
    expect(player.nodeLevels['tinh_thong_hoa']).toBe(4)
  })
})
