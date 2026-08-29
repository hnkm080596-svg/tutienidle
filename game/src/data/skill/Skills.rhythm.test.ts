import { describe, expect, it } from 'vitest'
import { SKILLS } from './Skills'

// Combat Balance Pass (2026-08-29) — Task 4: đa dạng nhịp skill Pháp Tu
// (plan §3.3). Mỗi hành một cá tính nhịp — số baseline theo bảng §3.3:
// Hỏa bùng nổ chậm/mạnh, Thủy duy trì nhanh, Mộc DoT, Kim xuyên,
// Thổ khống chế chậm. Đều là policy 'cast_time' — cast time khai trên
// execution (nguồn sự thật runtime), field castTime legacy giữ đồng bộ
// cho UI/tooltip.
const PHAP_TU_RHYTHM: Record<string, { castTime: number; cooldown: number }> = {
  hoa_cau_thuat: { castTime: 1.6, cooldown: 4 },
  thuy_tien_thuat: { castTime: 0.9, cooldown: 1 },
  doc_chuong: { castTime: 1.2, cooldown: 2 },
  diem_kim_thuat: { castTime: 1.0, cooldown: 2.5 },
  tho_cau_thuat: { castTime: 1.4, cooldown: 5 },
}

describe('Skills — nhịp 5 skill Pháp Tu (Task 4, plan §3.3)', () => {
  it('mỗi hành một nhịp riêng theo baseline plan §3.3', () => {
    for (const [skillId, expected] of Object.entries(PHAP_TU_RHYTHM)) {
      const skill = SKILLS.find(candidate => candidate.id === skillId)

      expect(skill, `thiếu skill ${skillId}`).toBeTruthy()

      expect(skill!.execution?.kind, `${skillId} execution kind`).toBe('cast_time')

      const castTime = skill!.execution?.kind === 'cast_time' ? skill!.execution.castTime : undefined

      expect(castTime, `${skillId} execution.castTime`).toBe(expected.castTime)
      expect(skill!.castTime, `${skillId} castTime (legacy/tooltip)`).toBe(expected.castTime)
      expect(skill!.cooldown, `${skillId} cooldown`).toBe(expected.cooldown)
    }
  })

  it('5 nhịp KHÔNG trùng nhau (đa dạng nhịp thật sự)', () => {
    const keys = Object.keys(PHAP_TU_RHYTHM)

    for (const a of keys) {
      for (const b of keys) {
        if (a >= b) continue

        const rhythmA = PHAP_TU_RHYTHM[a]!
        const rhythmB = PHAP_TU_RHYTHM[b]!

        const different =
          rhythmA.castTime !== rhythmB.castTime ||
          rhythmA.cooldown !== rhythmB.cooldown

        expect(different, `${a} và ${b} trùng nhịp hoàn toàn`).toBe(true)
      }
    }
  })
})
