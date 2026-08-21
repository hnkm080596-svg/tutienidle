import { describe, expect, it } from 'vitest'
import { addCultivation, breakthrough, canBreakthrough } from './CultivationSystem'
import { createDefaultPlayer } from '../player/Player'
import { getRequiredCultivation } from '../realm/realmSystem'

// Luyện Khí 1 → ... → 20 (mục XXI spec — checklist "Luyện Khí 9 / 9→10 /
// .../ 18 → Trúc Cơ"). realm.maxLevel của qi_refining = 20 (Đột Phá
// Trúc Cơ nâng từ 9 lên 20 — xem data/realms/realm.ts) — Đột Phá thường
// vẫn leo hết 20 tầng, CHỈ chặn lại ở việc tự nhảy sang đại cảnh giới
// kế (phải qua nút TRÚC CƠ/Foundation Resolver, không phải breakthrough()).
describe('CultivationSystem — Luyện Khí 1→20 (Đột Phá)', () => {
  it('leo từng tầng 1→20 bằng addCultivation + breakthrough, không tự nhảy đại cảnh giới ở tầng 20', () => {
    // Phàm Nhân (2026-08-16) — createDefaultPlayer() giờ khởi tạo ở
    // 'pham_nhan', không còn 'qi_refining' — test này nhắm thẳng vào
    // chuỗi Luyện Khí 1→20 nên set trực tiếp, độc lập với cảnh giới
    // khởi điểm mặc định.
    const player = createDefaultPlayer()

    player.realmId = 'qi_refining'
    player.realmLevel = 1
    player.cultivation = 0

    expect(player.realmId).toBe('qi_refining')
    expect(player.realmLevel).toBe(1)

    for (let expectedLevel = 1; expectedLevel < 20; expectedLevel++) {
      expect(player.realmLevel).toBe(expectedLevel)
      expect(canBreakthrough(player)).toBe(false)

      const required = getRequiredCultivation(player.realmId, player.realmLevel)

      addCultivation(player, required)

      expect(canBreakthrough(player)).toBe(true)
      expect(breakthrough(player)).toBe(true)
      expect(player.realmLevel).toBe(expectedLevel + 1)
      expect(player.cultivation).toBe(0)
    }

    // Ở tầng 20 (maxLevel qi_refining) — dù đủ tu vi, breakthrough()
    // KHÔNG được tự chuyển sang đại cảnh giới kế tiếp (phải qua TRÚC CƠ).
    expect(player.realmLevel).toBe(20)

    const requiredAtCap = getRequiredCultivation(player.realmId, player.realmLevel)

    addCultivation(player, requiredAtCap)

    expect(breakthrough(player)).toBe(false)
    expect(player.realmId).toBe('qi_refining')
    expect(player.realmLevel).toBe(20)
    // Tu vi vẫn giữ nguyên ở mức required, không mất — cho phép thử
    // TRÚC CƠ bất kỳ lúc nào (mục "Đột Phá Trúc Cơ" trong SaveSystem.ts).
    expect(player.cultivation).toBe(requiredAtCap)
  })

  it('addCultivation không tích lũy vượt quá mức cần để đột phá', () => {
    const player = createDefaultPlayer()
    const required = getRequiredCultivation(player.realmId, player.realmLevel)

    addCultivation(player, required * 5)

    expect(player.cultivation).toBe(required)
  })

  it('breakthrough() không làm gì khi chưa đủ tu vi', () => {
    const player = createDefaultPlayer()

    expect(breakthrough(player)).toBe(false)
    expect(player.realmLevel).toBe(1)
  })
})

// Phàm Nhân (2026-08-16) — đại cảnh giới mới, THẤP HƠN Luyện Khí, giờ
// là điểm khởi đầu thật của createDefaultPlayer(). Cùng quy tắc chặn
// tự nhảy đại cảnh giới ở maxLevel như Luyện Khí->Trúc Cơ — nghi lễ
// Phàm Nhân->Luyện Khí đi qua GameManager.chooseCultivationPath(),
// không phải breakthrough() thường. maxLevel 10 -> 18 (2026-08-20,
// Realm Passive & Pressure follow-up — Quán Khí mở sớm ở tầng 12,
// KHÔNG còn gắn với maxLevel, xem data/realms/realm.ts).
describe('CultivationSystem — Phàm Nhân 1→18 (Đột Phá)', () => {
  it('leo từng tầng 1→18 bằng addCultivation + breakthrough, không tự nhảy sang Luyện Khí ở tầng 18', () => {
    const player = createDefaultPlayer()

    expect(player.realmId).toBe('pham_nhan')
    expect(player.realmLevel).toBe(1)

    for (let expectedLevel = 1; expectedLevel < 18; expectedLevel++) {
      expect(player.realmLevel).toBe(expectedLevel)
      expect(canBreakthrough(player)).toBe(false)

      const required = getRequiredCultivation(player.realmId, player.realmLevel)

      addCultivation(player, required)

      expect(canBreakthrough(player)).toBe(true)
      expect(breakthrough(player)).toBe(true)
      expect(player.realmLevel).toBe(expectedLevel + 1)
      expect(player.cultivation).toBe(0)
    }

    expect(player.realmLevel).toBe(18)

    const requiredAtCap = getRequiredCultivation(player.realmId, player.realmLevel)

    addCultivation(player, requiredAtCap)

    expect(breakthrough(player)).toBe(false)
    expect(player.realmId).toBe('pham_nhan')
    expect(player.realmLevel).toBe(18)
    expect(player.cultivation).toBe(requiredAtCap)
  })
})
