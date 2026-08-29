import { describe, it, expect } from 'vitest'
import {
  getTribulationChapters,
  GRADE_DIFFICULTY_MULTIPLIER,
  TRIBULATION_DEFEAT_CULTIVATION_LOSS_BY_REALM,
  TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_BY_REALM,
} from './TribulationChapters'
import { TRIBULATION_MIND_QUESTIONS } from './TribulationMindQuestions'

describe('TribulationChapters (spec dot-pha-loi-kiep §5.2/§5.5/§5.7)', () => {
  it('Quán Khí: 2 chương mind → lightning; Trúc Cơ: 3 chương mind → body → lightning', () => {
    const quanKhi = getTribulationChapters('qi_refining')!
    expect(quanKhi.map((c) => c.kind)).toEqual(['mind', 'lightning'])
    const trucCo = getTribulationChapters('foundation_establishment')!
    expect(trucCo.map((c) => c.kind)).toEqual(['mind', 'body', 'lightning'])
  })

  it('realm chưa thiết kế → undefined (framework guard)', () => {
    expect(getTribulationChapters('golden_core')).toBeUndefined()
    expect(getTribulationChapters('unknown_realm')).toBeUndefined()
  })

  it('số câu tâm ma theo gate: Quán Khí 3, Trúc Cơ 4 (spec §5.3 — 3, 4, 5...)', () => {
    const quanKhi = getTribulationChapters('qi_refining')!
    expect(quanKhi[0]!.mind!.questionCount).toBe(3)
    const trucCo = getTribulationChapters('foundation_establishment')!
    expect(trucCo[0]!.mind!.questionCount).toBe(4)
  })

  it('mọi chương tank (body/lightning) có đủ duration/interval/percent', () => {
    for (const realmId of ['qi_refining', 'foundation_establishment']) {
      for (const chapter of getTribulationChapters(realmId)!) {
        if (chapter.kind === 'mind') continue
        expect(chapter.tank!.durationSeconds).toBeGreaterThan(0)
        expect(chapter.tank!.strikeIntervalSeconds).toBeGreaterThan(0)
        expect(chapter.tank!.lightningMaxHpDamagePercent).toBeGreaterThan(0)
      }
    }
  })

  it('Lôi Kiếp có đại lôi (finalStrike) mạnh hơn strike thường — chương lightning', () => {
    const chapters = getTribulationChapters('foundation_establishment')!
    const lightning = chapters[chapters.length - 1]!
    expect(lightning.tank!.finalStrikeMaxHpDamagePercent).toBeGreaterThan(
      lightning.tank!.lightningMaxHpDamagePercent,
    )
  })

  it('hệ số bậc: human 1 / earth 1.15 / heaven 1.3 / great_dao 1.85 (spec §5.5)', () => {
    expect(GRADE_DIFFICULTY_MULTIPLIER).toEqual({ human: 1, earth: 1.15, heaven: 1.3, great_dao: 1.85 })
  })

  it('phạt tu vi giảm dần theo realm + Linh Thạch scale (spec §5.7)', () => {
    expect(TRIBULATION_DEFEAT_CULTIVATION_LOSS_BY_REALM.qi_refining).toBe(0.5)
    expect(TRIBULATION_DEFEAT_CULTIVATION_LOSS_BY_REALM.foundation_establishment).toBe(0.4)
    expect(TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_BY_REALM.qi_refining).toBe(50)
    expect(TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_BY_REALM.foundation_establishment).toBe(200)
  })
})

describe('TribulationMindQuestions (spec §5.3)', () => {
  it('bank đủ số câu theo realm: qi_refining ≥ 12, foundation_establishment ≥ 16', () => {
    const quanKhi = TRIBULATION_MIND_QUESTIONS.filter((q) => q.realmId === 'qi_refining')
    const trucCo = TRIBULATION_MIND_QUESTIONS.filter((q) => q.realmId === 'foundation_establishment')
    expect(quanKhi.length).toBeGreaterThanOrEqual(12)
    expect(trucCo.length).toBeGreaterThanOrEqual(16)
  })

  it('mọi câu: đúng 4 đáp án, 1 đáp án đúng (index hợp lệ), id duy nhất', () => {
    const ids = new Set<string>()
    for (const q of TRIBULATION_MIND_QUESTIONS) {
      expect(q.answers).toHaveLength(4)
      expect(q.correctAnswerIndex).toBeGreaterThanOrEqual(0)
      expect(q.correctAnswerIndex).toBeLessThan(4)
      expect(ids.has(q.id)).toBe(false)
      ids.add(q.id)
    }
  })
})
