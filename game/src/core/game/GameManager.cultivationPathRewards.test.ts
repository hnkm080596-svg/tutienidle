import { describe, expect, it } from 'vitest'
import { createDefaultArtifactProgress } from '../artifact/ArtifactProgression'
import { createDefaultPlayer } from '../player/Player'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { GameManager } from './GameManager'

describe('GameManager — cultivation path realm rewards', () => {
  it('cấp trọn kit Trúc Cơ Pháp Tu từ data và gọi lại không ghi đè tiến trình đã nhận', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.realmAdvanceOps.learnTechnique('dai_ngu_hanh_chan_quyet')
    gameManager.realmAdvanceOps.equipTechnique('dai_ngu_hanh_chan_quyet')
    gameManager.techniqueManager.get('dai_ngu_hanh_chan_quyet')!.insight = 42

    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.realmId = 'foundation_establishment'

    expect(gameManager.realmAdvanceOps.grantCultivationPathRealmReward(player, player.realmId)).toBe(true)
    expect(gameManager.techniqueManager.getEquipped()?.id).toBe('dai_ngu_hanh_quyet_truc_co')
    expect(gameManager.techniqueManager.getEquipped()?.insight).toBe(42)
    expect(player.artifact).toEqual(createDefaultArtifactProgress('ngu_hanh_chau'))

    player.artifact!.experience = 99

    expect(gameManager.realmAdvanceOps.grantCultivationPathRealmReward(player, player.realmId)).toBe(true)
    expect(player.artifact!.experience).toBe(99)
    expect(gameManager.techniqueManager.getEquipped()?.insight).toBe(42)
  })

  it('Kiếm Tu ở Trúc Cơ chỉ có record passive — không nhận nhầm technique/artifact Pháp Tu', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    player.cultivationPath = 'sword'
    player.cultivationWay = 'sword_pathway'
    player.realmId = 'foundation_establishment'

    // P7-M2 - sword's composed record is passive-only; the op reports
    // the reward exists (true) but grants no technique/artifact itself
    // (passive delivery is syncRealmPassive's channel).
    expect(gameManager.realmAdvanceOps.grantCultivationPathRealmReward(player, player.realmId)).toBe(true)
    expect(player.artifact).toBeUndefined()
    expect(gameManager.techniqueManager.getEquipped()).toBeUndefined()
  })
})
