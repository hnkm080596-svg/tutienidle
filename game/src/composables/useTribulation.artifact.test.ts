import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../stores/player'
import { GameManager } from '../core/game/GameManager'
import { checkTribulationOutcomeAction } from './useTribulation'
import { createDefaultArtifactProgress } from '../core/artifact/ArtifactProgression'
import { getTribulationChapters } from '../data/tribulation/TribulationChapters'

// Ban Menh Phap Bao (doc sec4) - resolveVictory() trong useTribulation.ts
// la diem chuyen dai canh gioi THAT cho Truc Co (khac
// useBreakthrough.ts's breakthrough(), gio chi con xu ly tieu canh
// gioi, xem CultivationSystem.breakthrough()).
function winFoundationTribulation(player: ReturnType<typeof usePlayerStore>, gameManager: GameManager) {
  player.realmId = 'qi_refining'
  player.realmLevel = 12
  player.completedStageIds = ['qi_refining_abyssal_pool']
  player.baseStats.defense = 10_000 // mitigation gan tuyet doi
  player.baseStats.maxHp = 500_000 // song sot het kiep du sai het cau

  expect(
    gameManager.startTribulation(player.$state, 'foundation_establishment'),
  ).toBe(true)

  // Troi du tong thoi gian cac chuong (khong tra loi - het gio = sai
  // nhung HP du tru vi defense cao + maxHp lon).
  const chapters = getTribulationChapters('foundation_establishment')!
  const totalSeconds = chapters.reduce((total, chapter) => {
    if (chapter.mind) {
      return total + chapter.mind.questionCount * (chapter.mind.firstQuestionSeconds + chapter.mind.restSecondsBetweenQuestions) + 2
    }
    return total + chapter.tank!.durationSeconds + 2
  }, 0)
  gameManager.tickOps.update(totalSeconds)

  expect(gameManager.tribulationDirector.getState()?.state).toBe('victory')
}

describe('useTribulation resolveVictory — Bản Mệnh Pháp Bảo thức tỉnh (doc §4)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('Pháp Tu thắng Độ Kiếp Trúc Cơ -> KHÔNG nhận artifact nào (deferred to Kim Dan, M-F-ARTIFACT-DEFER)', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'

    winFoundationTribulation(player, gameManager)

    checkTribulationOutcomeAction(player, gameManager)

    expect(player.realmId).toBe('foundation_establishment')
    expect(player.artifact).toBeUndefined()
  })

  it('Kiếm Tu thắng Độ Kiếp Trúc Cơ -> KHÔNG nhận artifact nào (chưa có definition)', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    player.cultivationPath = 'sword'
    player.cultivationWay = 'sword_pathway'

    winFoundationTribulation(player, gameManager)

    checkTribulationOutcomeAction(player, gameManager)

    expect(player.realmId).toBe('foundation_establishment')
    expect(player.artifact).toBeUndefined()
  })

  it('idempotent — gọi lại không tạo/ghi đè artifact đã có', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.realmId = 'foundation_establishment'
    player.artifact = { ...createDefaultArtifactProgress('ngu_hanh_chau'), experience: 42 }

    // Khong co active tribulation -> checkTribulationOutcomeAction() no-op.
    checkTribulationOutcomeAction(player, gameManager)

    expect(player.artifact.experience).toBe(42)
  })
})
