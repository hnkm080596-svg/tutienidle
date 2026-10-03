import { describe, expect, it } from 'vitest'
import { SKILLS } from './Skills'

// Combat Balance Pass (2026-08-29) - Task 4: da dang nhip skill Phap Tu
// (plan sec3.3). Moi hanh mot ca tinh nhip - so baseline theo bang sec3.3:
// Hoa bung no cham/manh, Thuy duy tri nhanh, Moc DoT, Kim xuyen,
// Tho khong che cham. Deu la policy 'cast_time' - cast time khai tren
// execution (nguon su that runtime), field castTime legacy giu dong bo
// cho UI/tooltip.
const SPELL_RHYTHM: Record<string, { castTime: number; cooldown: number }> = {
  hoa_cau_thuat: { castTime: 1.6, cooldown: 4 },
  thuy_tien_thuat: { castTime: 0.9, cooldown: 1 },
  doc_chuong: { castTime: 1.2, cooldown: 2 },
  diem_kim_thuat: { castTime: 1.0, cooldown: 2.5 },
  tho_cau_thuat: { castTime: 1.4, cooldown: 5 },
}

describe('Skills — nhịp 5 skill Pháp Tu (Task 4, plan §3.3)', () => {
  it('mỗi hành một nhịp riêng theo baseline plan §3.3', () => {
    for (const [skillId, expected] of Object.entries(SPELL_RHYTHM)) {
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
    const keys = Object.keys(SPELL_RHYTHM)

    for (const a of keys) {
      for (const b of keys) {
        if (a >= b) continue

        const rhythmA = SPELL_RHYTHM[a]!
        const rhythmB = SPELL_RHYTHM[b]!

        const different =
          rhythmA.castTime !== rhythmB.castTime ||
          rhythmA.cooldown !== rhythmB.cooldown

        expect(different, `${a} và ${b} trùng nhịp hoàn toàn`).toBe(true)
      }
    }
  })
})
