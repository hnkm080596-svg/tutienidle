import { describe, expect, it } from 'vitest'
import { createDefaultArtifactProgress } from '../artifact/ArtifactProgression'
import { createDefaultPlayer } from '../player/Player'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { GameManager } from './GameManager'

describe('GameManager — cultivation path realm rewards', () => {
  it('cấp trọn kit Trúc Cơ Pháp Tu từ data và gọi lại không ghi đè tiến trình đã nhận', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.registerTechniqueTemplates(TECHNIQUES)
    gameManager.learnTechnique('dai_ngu_hanh_chan_quyet')
    gameManager.equipTechnique('dai_ngu_hanh_chan_quyet')
    gameManager.techniqueManager.get('dai_ngu_hanh_chan_quyet')!.insight = 42

    player.cultivationPath = 'phap_tu'
    player.realmId = 'foundation_establishment'

    expect(gameManager.grantCultivationPathRealmReward(player, player.realmId)).toBe(true)
    expect(gameManager.techniqueManager.getEquipped()?.id).toBe('dai_ngu_hanh_quyet_truc_co')
    expect(gameManager.techniqueManager.getEquipped()?.insight).toBe(42)
    expect(player.artifact).toEqual(createDefaultArtifactProgress('ngu_hanh_chau'))

    player.artifact!.experience = 99

    expect(gameManager.grantCultivationPathRealmReward(player, player.realmId)).toBe(true)
    expect(player.artifact!.experience).toBe(99)
    expect(gameManager.techniqueManager.getEquipped()?.insight).toBe(42)
  })

  it('Kiếm Tu không có reward Trúc Cơ trong data thì không nhận nhầm reward Pháp Tu', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    gameManager.registerTechniqueTemplates(TECHNIQUES)
    player.cultivationPath = 'kiem_tu'
    player.realmId = 'foundation_establishment'

    expect(gameManager.grantCultivationPathRealmReward(player, player.realmId)).toBe(false)
    expect(player.artifact).toBeUndefined()
  })
})
