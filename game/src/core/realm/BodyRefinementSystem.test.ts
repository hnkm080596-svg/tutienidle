import { describe, expect, it } from 'vitest'
import { createDefaultPlayer } from '../player/Player'
import { getActiveTierIndex, investTinhHoa, isActiveTierUnlocked } from './BodyRefinementSystem'
import { BODY_REFINEMENT_TIERS } from '../../data/realm/BodyRefinement'

// Luyện Thể KHÔNG còn giới hạn riêng Phàm Nhân (2026-08-22) — người
// chơi vẫn đầu tư được (lên chỉ số) ở cảnh giới sau nếu còn tồn Tinh
// Hoa Phàm Thể trong túi. requiredRealmLevel (pace theo tầng Phàm Nhân) chỉ
// áp dụng lúc CÒN Ở Phàm Nhân — xem BodyRefinementSystem.isTierRequiredRealmLevelMet().
describe('BodyRefinementSystem — đầu tư xuyên cảnh giới', () => {
  it('còn ở Phàm Nhân, chưa đủ tầng yêu cầu (requiredRealmLevel) — vẫn khoá như cũ', () => {
    const player = createDefaultPlayer()

    player.realmId = 'mortal'
    player.realmLevel = 1 // tier đầu (Luyện Bì) cần requiredRealmLevel=2

    expect(isActiveTierUnlocked(player)).toBe(false)
    expect(investTinhHoa(player, 100)).toBe(0)
  })

  it('rời Phàm Nhân (đã Lễ Nhập Môn) — requiredRealmLevel tự bypass, Tinh Hoa còn tồn vẫn tiêu được', () => {
    const player = createDefaultPlayer()

    player.realmId = 'qi_refining'
    player.realmLevel = 1 // KHÔNG đạt requiredRealmLevel=2 của Luyện Bì nếu còn tính theo Phàm Nhân

    expect(isActiveTierUnlocked(player)).toBe(true)

    const cap = BODY_REFINEMENT_TIERS[0]!.cap
    const consumed = investTinhHoa(player, cap)

    expect(consumed).toBe(cap)
    expect(player.bodyRefinementCompletedTiers).toBe(1)
  })

  it('rời Phàm Nhân vẫn giữ đúng thứ tự tuần tự — không nhảy cóc qua tầng chưa tới lượt', () => {
    const player = createDefaultPlayer()

    player.realmId = 'qi_refining'
    player.bodyRefinementCompletedTiers = 2 // đang dở tầng index 2 (Luyện Cốt)

    expect(getActiveTierIndex(player)).toBe(2)

    const consumed = investTinhHoa(player, 1)

    expect(consumed).toBe(1)
    expect(player.bodyRefinementCompletedTiers).toBe(2) // chưa đầy, chưa nhảy tầng
    expect(player.bodyRefinementCurrentTierProgress).toBe(1)
  })

  it('đã hoàn thành cả 6 tầng — không còn gì để đầu tư ở cảnh giới nào nữa', () => {
    const player = createDefaultPlayer()

    player.realmId = 'foundation_establishment'
    player.bodyRefinementCompletedTiers = BODY_REFINEMENT_TIERS.length

    expect(getActiveTierIndex(player)).toBeUndefined()
    expect(isActiveTierUnlocked(player)).toBe(true)
    expect(investTinhHoa(player, 100)).toBe(0)
  })
})
