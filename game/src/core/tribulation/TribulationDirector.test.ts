import { describe, it, expect } from 'vitest'
import { TribulationDirector } from './TribulationDirector'
import { createDefaultPlayer, playerToCombatEntity, type PlayerData } from '../player/Player'
import { createBaseStats, type Stats } from '../stats/StatBlock'
import { EventBus } from '../events/EventBus'
import { MERIDIANS } from '../../data/realm/Meridians'

function makeDirector() {
  const eventBus = new EventBus()
  return { director: new TribulationDirector({ eventBus }), eventBus }
}

function readyPlayer(): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = 'qi_refining'
  player.realmLevel = 12
  return player
}

// Player đủ mọi điều kiện Đại Đạo Trúc Cơ (gate foundation_establishment)
function createGreatDaoReadyPlayer(): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = 'qi_refining'
  player.realmLevel = 18
  player.selectedTalentIds = ['pham_cot']
  player.bodyRefinementCompletedTiers = 6
  player.mortalPerfectionAchieved = true
  player.openedMeridianIds = MERIDIANS.map((m) => m.id)
  player.baseStats = { ...player.baseStats, strength: 30, dexterity: 30, intelligence: 30, attunement: 30, vitality: 30 }
  return player
}

// Stats test: HP 5000, def 0 (mitigation 100/100 = 1), regen 0
function testStats(): Stats {
  return { ...createBaseStats(), maxHp: 5000, defense: 0, hpRegenPerSecond: 0 } as Stats
}

function snapshotHp(director: TribulationDirector): number {
  return director.getState()!.hp
}

describe('TribulationDirector (spec dot-pha-loi-kiep §5)', () => {
  it('start Quán Khí: 2 chương, chương 1 là mind với 3 câu', () => {
    const { director } = makeDirector()
    expect(director.start(readyPlayer(), testStats(), false, 'qi_refining')).toBe(true)
    const state = director.getState()!
    expect(state.chaptersTotal).toBe(2)
    expect(state.chapterIndex).toBe(0)
    expect(state.currentQuestion).not.toBeNull()
    expect(state.state).toBe('ongoing')
  })

  it('trả lời đúng 3/3 câu → hết mind, sang chương lightning', () => {
    const { director } = makeDirector()
    director.start(readyPlayer(), testStats(), false, 'qi_refining')
    for (let i = 0; i < 3; i++) {
      const q = director.getState()!.currentQuestion!
      expect(director.answerQuestion(q.correctAnswerIndex)).toBe(true)
      director.update(3) // rest giữa câu
    }
    director.update(1)
    expect(director.getState()!.chapterIndex).toBe(1)
    expect(director.getState()!.currentQuestion).toBeNull()
  })

  it('trả lời sai hết → stack debuff: HP tụt nhanh hơn khi tank', () => {
    const wrongDirector = makeDirector().director
    const rightDirector = makeDirector().director
    wrongDirector.start(readyPlayer(), testStats(), false, 'qi_refining')
    rightDirector.start(readyPlayer(), testStats(), false, 'qi_refining')
    for (const d of [wrongDirector, rightDirector]) {
      let guard = 0
      while (d.getState()!.chapterIndex === 0 && guard++ < 50) {
        const q = d.getState()!.currentQuestion!
        if (d === wrongDirector) {
          d.answerQuestion((q.correctAnswerIndex + 1) % 4)
        } else {
          d.answerQuestion(q.correctAnswerIndex)
        }
        d.update(3)
      }
    }
    // Sang chương lightning — đo damage sau cùng số giây
    const wrongBefore = snapshotHp(wrongDirector)
    const rightBefore = snapshotHp(rightDirector)
    wrongDirector.update(6)
    rightDirector.update(6)
    const wrongDamage = wrongBefore - snapshotHp(wrongDirector)
    const rightDamage = rightBefore - snapshotHp(rightDirector)
    expect(wrongDamage).toBeGreaterThan(rightDamage)
  })

  it('questionSecondsLimit phản ánh limit của câu hỏi hiện tại (mẫu số timer bar)', () => {
    const { director } = makeDirector()
    director.start(readyPlayer(), testStats(), false, 'qi_refining')
    const active = director.getState()
    expect(active).not.toBeNull()
    // Câu đầu của Tâm Ma Kiếp qi_refining: limit 12s
    expect(active!.questionSecondsRemaining).toBeGreaterThan(0)
    expect(active!.questionSecondsLimit).toBe(12)
    expect(active!.questionSecondsLimit).toBeGreaterThanOrEqual(active!.questionSecondsRemaining)
    // Tick trôi 2s → remaining giảm, limit giữ nguyên (mẫu số timer bar)
    director.update(2)
    const ticked = director.getState()!
    expect(ticked.questionSecondsRemaining).toBe(10)
    expect(ticked.questionSecondsLimit).toBe(12)
  })

  it('answerQuestion khi không có câu hỏi active → false (no-op)', () => {
    const { director } = makeDirector()
    expect(director.answerQuestion(0)).toBe(false)
  })

  it('HP về 0 giữa chương → defeat + cooldown', () => {
    const { director } = makeDirector()
    // Kiếp Trúc Cơ (3 chương): KHÔNG trả lời câu nào (hết giờ = sai →
    // stack debuff +20% taken) → body 10 strikes × 10% × 1.2 = 120%
    // maxHp → chết giữa chương body.
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.realmLevel = 12
    director.start(player, testStats(), false, 'foundation_establishment')
    let guard = 0
    while (director.getState()!.state === 'ongoing' && guard++ < 500) {
      director.update(1)
    }
    expect(director.getState()!.state).toBe('defeat')
    expect(director.getCooldownSeconds()).toBeGreaterThan(0)
  })

  it('sống sót hết chương cuối → victory', () => {
    const { director } = makeDirector()
    director.start(readyPlayer(), testStats(), false, 'qi_refining')
    let guard = 0
    while (director.getState()!.state === 'ongoing' && guard++ < 2000) {
      director.update(1)
      const q = director.getState()!.currentQuestion
      if (q) director.answerQuestion(q.correctAnswerIndex)
    }
    expect(director.getState()!.state).toBe('victory')
  })

  it('grade Đại Đạo (đủ điều kiện + đan): damage nhận nhiều hơn human cùng thời gian', () => {
    const humanDirector = makeDirector().director
    const greatDaoDirector = makeDirector().director
    humanDirector.start(readyPlayer(), testStats(), true, 'foundation_establishment')
    greatDaoDirector.start(createGreatDaoReadyPlayer(), testStats(), true, 'foundation_establishment')
    expect(humanDirector.getState()!.grade).toBe('human')
    expect(greatDaoDirector.getState()!.grade).toBe('great_dao')
    // qua chương mind bằng trả lời đúng
    for (const d of [humanDirector, greatDaoDirector]) {
      let guard = 0
      while (d.getState()!.chapterIndex === 0 && guard++ < 100) {
        const q = d.getState()!.currentQuestion!
        d.answerQuestion(q.correctAnswerIndex)
        d.update(3)
      }
    }
    // đo damage chương body cùng số giây
    const humanBefore = snapshotHp(humanDirector)
    const greatDaoBefore = snapshotHp(greatDaoDirector)
    humanDirector.update(10)
    greatDaoDirector.update(10)
    const humanDamage = humanBefore - snapshotHp(humanDirector)
    const greatDaoDamage = greatDaoBefore - snapshotHp(greatDaoDirector)
    expect(greatDaoDamage).toBeGreaterThan(humanDamage)
  })

  it('unknown realm → start false (framework guard)', () => {
    const { director } = makeDirector()
    expect(director.start(readyPlayer(), testStats(), false, 'golden_core')).toBe(false)
  })

  it('cooldown chặn start lần 2; clear() reset state', () => {
    const { director } = makeDirector()
    director.start(readyPlayer(), testStats(), false, 'qi_refining')
    expect(director.start(readyPlayer(), testStats(), false, 'qi_refining')).toBe(false)
    director.clear()
    expect(director.getState()).toBeNull()
    // clear KHÔNG xoá cooldown (giữ nguyên pattern TribulationSystem cũ)
  })

  it('hết giờ 1 câu = sai (stack debuff) — không cần answerQuestion', () => {
    const { director } = makeDirector()
    director.start(readyPlayer(), testStats(), false, 'qi_refining')
    // để trôi qua hết 3 câu + lightning mà không trả lời gì
    let guard = 0
    while (director.getState()!.state === 'ongoing' && guard++ < 2000) {
      director.update(1)
    }
    // phải kết thúc (thắng hoặc thua — HP 5000 có thể sống qua kiếp Nhân Đạo)
    expect(['victory', 'defeat']).toContain(director.getState()!.state)
  })

  it('defense mitigates lôi: def 900 → damage giảm còn 1/10 (100/(100+900))', () => {
    const lowDefDirector = makeDirector().director
    const highDefDirector = makeDirector().director
    const lowStats = { ...createBaseStats(), maxHp: 5000, defense: 0, hpRegenPerSecond: 0 } as Stats
    const highStats = { ...createBaseStats(), maxHp: 5000, defense: 900, hpRegenPerSecond: 0 } as Stats
    lowDefDirector.start(readyPlayer(), lowStats, false, 'qi_refining')
    highDefDirector.start(readyPlayer(), highStats, false, 'qi_refining')
    for (const d of [lowDefDirector, highDefDirector]) {
      let guard = 0
      while (d.getState()!.chapterIndex === 0 && guard++ < 100) {
        const q = d.getState()!.currentQuestion!
        d.answerQuestion(q.correctAnswerIndex)
        d.update(3)
      }
    }
    const lowBefore = snapshotHp(lowDefDirector)
    const highBefore = snapshotHp(highDefDirector)
    lowDefDirector.update(6)
    highDefDirector.update(6)
    const lowDamage = lowBefore - snapshotHp(lowDefDirector)
    const highDamage = highBefore - snapshotHp(highDefDirector)
    expect(lowDamage).toBeGreaterThan(0)
    // cùng số strike trong 6s: high def damage ~ low/10 (chấp nhận sai số
    // biên strike do interval đều)
    expect(highDamage * 5).toBeLessThan(lowDamage)
  })
})
