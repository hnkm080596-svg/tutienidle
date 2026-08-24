import type { PlayerData } from '../player/Player'
import {
  getRequiredCultivation,
  getCurrentRealm,
} from '../realm/realmSystem'

export function addCultivation(
  player: PlayerData,
  amount: number,
) {
  const required = getRequiredCultivation(
    player.realmId,
    player.realmLevel,
  )

  // Không tích lũy dư quá mức cần để đột phá — chặn ở "required" thay
  // vì cộng thẳng rồi để tràn, tránh trường hợp AFK lâu tích được vài
  // lần "required" rồi bấm đột phá một phát nhảy nhiều tầng. Đột phá
  // xong vẫn tự reset cultivation = 0 như cũ (xem breakthrough()).
  player.cultivation = Math.min(
    player.cultivation + amount,
    required,
  )
}

export function canBreakthrough(player: PlayerData): boolean {
  const required = getRequiredCultivation(
    player.realmId,
    player.realmLevel,
  )

  return player.cultivation >= required
}

export function breakthrough(player: PlayerData): boolean {
  if (!canBreakthrough(player)) {
    return false
  }

  const realm = getCurrentRealm(player.realmId)

  if (player.realmLevel < realm.maxLevel) {
    player.cultivation = 0

    player.realmLevel++

    // skill-insight-and-auto-combat-hud-plan.md mục 1 — đột phá tiểu
    // cảnh giới KHÔNG còn cấp điểm progression skill nữa (skillPoints
    // cũ đã xoá hẳn khỏi PlayerData). Cảm ngộ Kỹ năng (skillInsight)
    // giờ CHỈ đến từ chiến đấu, xem GameManager.grantBattleRewardIfNeeded().

    // 2026-08-20 (Realm Passive & Pressure follow-up) — đổi từ ramp
    // "1-9 điểm tùy tiểu cảnh giới" (PLAN HOÀN CHỈNH mục 2 cũ) sang
    // FLAT +1/tầng, cùng nhịp skillPoints ngay dưới — ramp cũ khiến số
    // điểm CỘNG DỒN mỗi lần đột phá trùng luôn với realmLevel vừa đạt,
    // dễ hiểu lầm là bug (yêu cầu người dùng: "mỗi tầng cho 1 điểm
    // thuộc tính"). Cấp CÙNG lúc skillPoints (cùng 1 sự kiện đột phá),
    // nhưng là 2 hồ điểm HOÀN TOÀN tách biệt (xem Player.ts's
    // attributePoints).
    player.attributePoints++

    return true
  }

  // Đột Phá tổng quát (2026-08-16) — MỌI lượt chuyển đại cảnh giới giờ
  // đều bắt buộc đi qua 1 nghi lễ riêng thay vì "Đột Phá" thường: chọn
  // Pháp Tu/Kiếm Tu cho Phàm Nhân->Luyện Khí
  // (GameManager.chooseCultivationPath()), hoặc Độ Kiếp cho mọi cảnh
  // giới còn lại (GameManager.startTribulation(), panel vật phẩm yêu
  // cầu — xem composables/useTribulation.ts). breakthrough() thường
  // KHÔNG BAO GIỜ tự nhảy đại cảnh giới nữa, bất kể đang ở cảnh giới
  // nào — không còn cần check riêng từng realmId như trước. Cultivation
  // vẫn giữ nguyên ở mức required (đã chặn ở addCultivation), cho phép
  // người chơi thử lại nghi lễ bất kỳ lúc nào mà không mất tu vi.
  return false
}