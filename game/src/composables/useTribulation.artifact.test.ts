import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../stores/player'
import { GameManager } from '../core/game/GameManager'
import { checkTribulationOutcomeAction } from './useTribulation'
import { createDefaultArtifactProgress } from '../core/artifact/ArtifactProgression'
import { TRIBULATION_PROFILES } from '../core/breakthrough/TribulationProfile'

// Bản Mệnh Pháp Bảo (doc §4) — resolveVictory() trong useTribulation.ts
// là điểm chuyển đại cảnh giới THẬT cho Trúc Cơ (khác
// useBreakthrough.ts's breakthrough(), giờ chỉ còn xử lý tiểu cảnh
// giới, xem CultivationSystem.breakthrough()).
function winFoundationTribulation(player: ReturnType<typeof usePlayerStore>, gameManager: GameManager) {
  player.realmId = 'qi_refining'
  player.baseStats.defense = 10_000 // sống sót hết Độ Kiếp

  expect(
    gameManager.startTribulation(player.$state, player.finalStats, 'foundation_establishment'),
  ).toBe(true)

  const profile = TRIBULATION_PROFILES.foundation_establishment!
  gameManager.update(profile.durationSeconds + 5)

  expect(gameManager.getBattle()?.state).toBe('victory')
}

describe('useTribulation resolveVictory — Bản Mệnh Pháp Bảo thức tỉnh (doc §4)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('Pháp Tu thắng Độ Kiếp Trúc Cơ -> nhận đúng 1 Ngũ Hành Châu tầng 1/EXP 0/Phàm phẩm', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    player.cultivationPath = 'phap_tu'

    winFoundationTribulation(player, gameManager)

    checkTribulationOutcomeAction(player, gameManager)

    expect(player.realmId).toBe('foundation_establishment')
    expect(player.artifact).toEqual(createDefaultArtifactProgress('ngu_hanh_chau'))
  })

  it('Kiếm Tu thắng Độ Kiếp Trúc Cơ -> KHÔNG nhận artifact nào (chưa có definition)', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    player.cultivationPath = 'kiem_tu'

    winFoundationTribulation(player, gameManager)

    checkTribulationOutcomeAction(player, gameManager)

    expect(player.realmId).toBe('foundation_establishment')
    expect(player.artifact).toBeUndefined()
  })

  it('idempotent — gọi lại không tạo/ghi đè artifact đã có', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    player.cultivationPath = 'phap_tu'
    player.realmId = 'foundation_establishment'
    player.artifact = { ...createDefaultArtifactProgress('ngu_hanh_chau'), experience: 42 }

    // Không có active tribulation -> checkTribulationOutcomeAction() no-op.
    checkTribulationOutcomeAction(player, gameManager)

    expect(player.artifact.experience).toBe(42)
  })
})
