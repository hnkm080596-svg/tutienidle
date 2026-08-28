import { describe, expect, it } from 'vitest'
import { SurviveLethalGuard } from './SurviveLethalGuard'

// Thiên phú Bất Tử Thể (talent-direction-choice-plan §6) — counter lượt
// sống sót battle-scoped; reset mỗi trận mới, 0 lượt trong trận Độ Kiếp.
describe('SurviveLethalGuard — Bất Tử Thể', () => {
  it('không có thiên phú — 0 lượt sống sót', () => {
    const guard = new SurviveLethalGuard()

    guard.beginBattle([])

    expect(guard.getRemainingUses()).toBe(0)
    expect(guard.tryConsumeUse()).toBe(false)
  })

  it('Bất Tử Thể — đúng 1 lượt mỗi trận, lượt thứ hai bị từ chối', () => {
    const guard = new SurviveLethalGuard()

    guard.beginBattle(['bat_tu_the'])

    expect(guard.getRemainingUses()).toBe(1)
    expect(guard.tryConsumeUse()).toBe(true)
    expect(guard.getRemainingUses()).toBe(0)
    expect(guard.tryConsumeUse()).toBe(false)
  })

  it('beginBattle trận mới — reset lượt đã tiêu của trận trước', () => {
    const guard = new SurviveLethalGuard()

    guard.beginBattle(['bat_tu_the'])
    guard.tryConsumeUse()
    guard.beginBattle(['bat_tu_the'])

    expect(guard.tryConsumeUse()).toBe(true)
  })

  it('beginTribulation — 0 lượt dù ngay trước đó có thiên phú (Độ Kiếp là nghi lễ thật)', () => {
    const guard = new SurviveLethalGuard()

    guard.beginBattle(['bat_tu_the'])
    guard.beginTribulation()

    expect(guard.getRemainingUses()).toBe(0)
    expect(guard.tryConsumeUse()).toBe(false)
  })

  it('id lạ trong save cũ — bỏ qua an toàn, không crash', () => {
    const guard = new SurviveLethalGuard()

    guard.beginBattle(['talent_khong_ton_tai'])

    expect(guard.tryConsumeUse()).toBe(false)
  })
})
