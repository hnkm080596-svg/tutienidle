import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../stores/player'
import { GameManager } from '../core/game/GameManager'
import { checkTribulationOutcomeAction } from './useTribulation'
import { getTribulationChapters } from '../data/tribulation/TribulationChapters'
import { createBaseStats } from '../core/stats/StatBlock'
import { CHARACTER_CREATION_TALENTS, getTalentDefinition } from '../data/talent/Talents'
import { pills } from '../data/pill/pills'
import { MERIDIANS } from '../data/realm/Meridians'

// Snapshot hoàn hảo Phàm Nhân + Phàm Nhân Chi Cốt (spec dot-pha-loi-kiep
// §4.2/§4.4) — integration qua GameManager + useTribulation thật.
function tribulationTotalSeconds(targetRealmId: string): number {
  return getTribulationChapters(targetRealmId)!.reduce((total, chapter) => {
    if (chapter.mind) {
      return total + chapter.mind.questionCount * (chapter.mind.firstQuestionSeconds + chapter.mind.restSecondsBetweenQuestions) + 2
    }
    return total + chapter.tank!.durationSeconds + 2
  }, 0)
}

describe('Snapshot hoàn hảo Phàm Nhân (spec §4.2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('chooseCultivationPath khi 5/5 stat 10/10 + 6/6 Luyện Th thể → mortalPerfectionAchieved = true', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    player.realmLevel = 12
    player.bodyRefinementCompletedTiers = 6
    player.baseStats = { ...player.baseStats, strength: 10, dexterity: 10, intelligence: 10, attunement: 10, vitality: 10 }

    expect(gameManager.chooseCultivationPath('phap_tu', player.$state)).toBe(true)
    expect(player.mortalPerfectionAchieved).toBe(true)
  })

  it('thiếu 1 stat (9/10) → false; thiếu 1 tầng Luyện Th thể (5/6) → false', () => {
    // usePlayerStore() trong cùng pinia trả CÙNG instance — reset path
    // giữa 2 case (giữ nguyên realm mortal tầng 12).
    const gameManager = new GameManager()
    const player = usePlayerStore()
    player.realmLevel = 12
    player.bodyRefinementCompletedTiers = 6
    player.baseStats = { ...player.baseStats, strength: 9, dexterity: 10, intelligence: 10, attunement: 10, vitality: 10 }

    expect(gameManager.chooseCultivationPath('phap_tu', player.$state)).toBe(true)
    expect(player.mortalPerfectionAchieved).toBe(false)

    // Reset để chọn lại (case 2: đủ stat nhưng Luyện Th thể 5/6)
    player.cultivationPath = undefined
    player.realmId = 'mortal'
    player.realmLevel = 12
    player.bodyRefinementCompletedTiers = 5
    player.baseStats = { ...player.baseStats, strength: 10 }

    expect(gameManager.chooseCultivationPath('phap_tu', player.$state)).toBe(true)
    expect(player.mortalPerfectionAchieved).toBe(false)
  })

  it('snapshot chốt tại thời điểm Quán Khí — KHÔNG hồi cứu sau khi vào Luyện Khí', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    player.realmLevel = 12
    player.bodyRefinementCompletedTiers = 6
    player.baseStats = { ...player.baseStats, strength: 10, dexterity: 10, intelligence: 10, attunement: 10, vitality: 10 }

    gameManager.chooseCultivationPath('phap_tu', player.$state)
    expect(player.mortalPerfectionAchieved).toBe(true)

    // Sau khi vào Luyện Khí, "hoàn hảo" không đổi dù stat/luyện thể đổi
    player.bodyRefinementCompletedTiers = 0
    expect(player.mortalPerfectionAchieved).toBe(true)
  })
})

describe('Phàm Nhân Chi Cốt (spec §4.4)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('talent pham_nhan_chi_cot tồn tại, KHÔNG thuộc pool roll (weight 0), effect đảo dấu +75%', () => {
    const talent = getTalentDefinition('pham_nhan_chi_cot')
    expect(talent).toBeDefined()
    const inPool = CHARACTER_CREATION_TALENTS.some((t) => t.id === 'pham_nhan_chi_cot')
    expect(inPool).toBe(false)
    expect(talent!.effects).toEqual([{ kind: 'cultivation_speed', percent: 0.75 }])
  })

  it('thắng kiếp Đại Đạo Trúc Cơ: Phàm Cốt chuyển thành Phàm Nhân Chi Cốt + highestFoundationAchieved = great_dao', () => {
    const gameManager = new GameManager()
    gameManager.registerPills(pills)
    const player = usePlayerStore()

    // Dựng nhân vật đủ mọi điều kiện Đại Đạo
    player.selectedTalentIds = ['pham_cot']
    player.realmLevel = 12
    player.bodyRefinementCompletedTiers = 6
    player.mortalPerfectionAchieved = true
    player.baseStats = { ...player.baseStats, strength: 10, dexterity: 10, intelligence: 10, attunement: 10, vitality: 10 }

    // Quán Khí trước (vào Luyện Khí)
    gameManager.chooseCultivationPath('phap_tu', player.$state)
    expect(player.realmId).toBe('qi_refining')

    // Đầu tư tiếp để đủ điều kiện Đại Đạo ở Luyện Khí
    player.realmLevel = 18
    player.baseStats = { ...player.baseStats, strength: 30, dexterity: 30, intelligence: 30, attunement: 30, vitality: 30 }
    player.openedMeridianIds = MERIDIANS.map((m) => m.id)
    const trucCoDan = gameManager.pillRegistry.get('truc_co_dan')!
    gameManager.pillBag.add(trucCoDan, 1)

    // Stats đủ trụ kiếp Đại Đạo (×1.85 khó hơn)
    const stats = { ...createBaseStats(), maxHp: 5_000_000, defense: 50_000, hpRegenPerSecond: 0 }

    expect(gameManager.startTribulation(player.$state, stats, 'foundation_establishment')).toBe(true)
    expect(gameManager.getActiveTribulation()!.grade).toBe('great_dao')

    // Trôi hết kiếp + trả lời đúng mọi câu
    let guard = 0
    while (gameManager.getActiveTribulation()?.state === 'ongoing' && guard++ < 5000) {
      gameManager.update(1)
      const q = gameManager.getActiveTribulation()!.currentQuestion
      if (q) gameManager.answerTribulationQuestion(q.correctAnswerIndex)
    }

    expect(gameManager.getActiveTribulation()!.state).toBe('victory')
    checkTribulationOutcomeAction(player, gameManager)

    expect(player.highestFoundationAchieved).toBe('great_dao')
    expect(player.selectedTalentIds).not.toContain('pham_cot')
    expect(player.selectedTalentIds).toContain('pham_nhan_chi_cot')
    expect(player.realmId).toBe('foundation_establishment')
  })

  it('thua kiếp Đại Đạo: greatDaoOpportunityLost vĩnh viễn + KHÔNG đổi talent; lần xét sau cap Thiên', () => {
    const gameManager = new GameManager()
    gameManager.registerPills(pills)
    const player = usePlayerStore()

    player.selectedTalentIds = ['pham_cot']
    player.realmLevel = 12
    player.bodyRefinementCompletedTiers = 6
    player.mortalPerfectionAchieved = true
    player.baseStats = { ...player.baseStats, strength: 10, dexterity: 10, intelligence: 10, attunement: 10, vitality: 10 }
    gameManager.chooseCultivationPath('phap_tu', player.$state)

    player.realmLevel = 18
    player.baseStats = { ...player.baseStats, strength: 30, dexterity: 30, intelligence: 30, attunement: 30, vitality: 30 }
    player.openedMeridianIds = MERIDIANS.map((m) => m.id)
    gameManager.pillBag.add(gameManager.pillRegistry.get('truc_co_dan')!, 1)

    // HP thấp → thua kiếp Đại Đạo
    const stats = { ...createBaseStats(), maxHp: 1, defense: 0, hpRegenPerSecond: 0 }

    expect(gameManager.startTribulation(player.$state, stats, 'foundation_establishment')).toBe(true)
    expect(gameManager.getActiveTribulation()!.grade).toBe('great_dao')

    let guard = 0
    while (gameManager.getActiveTribulation()?.state === 'ongoing' && guard++ < 5000) {
      gameManager.update(1)
      const q = gameManager.getActiveTribulation()!.currentQuestion
      if (q) gameManager.answerTribulationQuestion(q.correctAnswerIndex)
    }

    expect(gameManager.getActiveTribulation()!.state).toBe('defeat')
    checkTribulationOutcomeAction(player, gameManager)

    expect(player.greatDaoOpportunityLost).toBe(true)
    expect(player.selectedTalentIds).toContain('pham_cot') // KHÔNG đổi
    expect(player.realmId).toBe('qi_refining') // KHÔNG lên Trúc Cơ

    // Lần xét sau: cap Thiên (resolver test đã khóa; ở đây kiểm qua
    // Director). Bỏ qua cooldown 5 phút bằng cách đẩy system time.
    vi.setSystemTime(Date.now() + 6 * 60 * 1000)
    const stats2 = { ...createBaseStats(), maxHp: 5_000_000, defense: 50_000, hpRegenPerSecond: 0 }
    gameManager.pillBag.add(gameManager.pillRegistry.get('truc_co_dan')!, 1)
    expect(gameManager.startTribulation(player.$state, stats2, 'foundation_establishment')).toBe(true)
    expect(gameManager.getActiveTribulation()!.grade).toBe('heaven')
  })
})
