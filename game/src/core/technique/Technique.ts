import type { ElementType } from '../element/ElementType'

// PLAN HOÀN CHỈNH mục 5 — Tâm Pháp giờ CÓ cộng chỉ số trở lại, theo
// đúng 4 cảnh giới Sơ Nhập/Tiểu Thành/Đại Thành/Viên Mãn (đảo ngược có
// chủ đích quyết định "Tâm Pháp KHÔNG còn cộng chỉ số" ở dưới — user
// đã yêu cầu tường minh kèm bảng số liệu cụ thể, xem plan). Rework
// 2026-08-20 — tier giờ tính từ player.techniqueExperience (thanh kinh
// nghiệm THẬT của riêng Tâm Pháp, nuôi bởi tu luyện), KHÔNG còn suy
// thẳng từ đại cảnh giới người chơi — xem TechniqueTier.ts's
// getTechniqueTier(). Vẫn "không cần chức năng tháo, lắp công pháp,
// hoàn toàn dựa vào nghề nghiệp" (nguyên văn yêu cầu) — chỉ đổi driver
// của tier, không đổi việc equip là tự động.
export type TechniqueTier = 'so_nhap' | 'tieu_thanh' | 'dai_thanh' | 'vien_man'

// Shape chung cho MỌI tâm pháp — mỗi field optional vì Tụ Linh Quyết
// (Công/Phòng phẳng) và Đại Ngũ Hành (%Linh lực tối đa + %Hồi Linh)
// dùng field khác nhau; Kiếm Tu/Thể Tu (chưa thiết kế, mục 5.3) để
// tierEffects rỗng — kiến trúc vẫn hỗ trợ sẵn không cần đổi type.
// manaRegenPercent là % TĂNG THÊM lên stat manaRegenPerSecond (Increased,
// cùng pipeline percent chuẩn của StatCalculator.ts) — KHÔNG phải %
// của maxMp (tránh phụ thuộc vòng vào giá trị maxMp chưa tính xong lúc
// gộp modifier, xem GameManager.getTechniqueTierModifiers()).
export interface TechniqueTierEffect {
  attackFlat?: number

  defenseFlat?: number

  maxMpPercent?: number

  manaRegenPercent?: number
}

/**
 * Pháp Tu Redesign (magicpath, 2026-08-18) — Tâm Pháp KHÔNG còn cộng
 * chỉ số dưới BẤT KỲ hình thức nào (đã xoá `modifiers`/`mechanic`/
 * `breakthroughEffect` — mọi đường cộng stat cũ, kể cả cultivationRate
 * đã bị xoá hoàn toàn khỏi Stats). Tâm Pháp giờ THUẦN là lớp giới
 * thiệu/hướng dẫn — giải thích path chơi ra sao bằng lore (description),
 * tự động trang bị khi chọn path, không còn cơ chế "đầu tư" nào ở tầng
 * này. Chỉ số thật giờ đến từ Node Tree (core/progression/) + Equipment
 * + Skill passive — xem [[tienhiep-phap-tu-magicpath]].
 *
 * PLAN HOÀN CHỈNH mục 5 — NGOẠI LỆ DUY NHẤT cho quyết định trên:
 * `tierEffects` tái lập cộng chỉ số, nhưng theo ĐÚNG 4 cảnh giới tâm
 * pháp (không phải "đầu tư" tự do như hệ cũ đã xoá) — xem TechniqueTier.
 */
export interface Technique {
  id: string

  name: string

  description: string

  // Path ảnh minh hoạ (vd '/assets/techniques/xich_viem.png') — khai
  // NGAY TRÊN data item thay vì bảng tra tập trung (2026-08-15, theo
  // yêu cầu: icon thuộc về khai báo data của từng món, không nằm
  // chung 1 hệ thống như core/assets/AssetPaths.ts — bảng đó giờ chỉ
  // còn giữ path KHÔNG gắn liền với 1 id cụ thể trong data, vd backdrop
  // Stage/icon Building/khung UI dùng chung). Optional — technique
  // chưa có ảnh thật thì tooltip chỉ đơn giản không hiện <img>.
  icon?: string

  requiredRealmId?: string

  requiredRealmLevel?: number

  // Tu Luyện — map realmId -> id của passive skill được học/equip khi
  // đột phá vào đúng cảnh giới đó (chỉ có ý nghĩa khi technique này
  // đang trang bị). Xem GameManager.syncRealmPassive(). Đây là "cấp
  // skill" (SkillSystem tự có pipeline stat riêng), KHÔNG phải Tâm
  // Pháp tự cộng chỉ số — vẫn giữ, không thuộc phạm vi loại bỏ.
  passiveSkillIdsByRealm?: Record<string, string>

  // Chiến Đấu nội tại (optional — chỉ tâm pháp có phần chiến đấu mới
  // khai). Tra CombatTechniqueTypeConfig (data/technique/
  // CombatTechniqueTypes.ts) — chỉ mang tính tổ chức nội dung/hiển thị
  // UI, KHÔNG ràng buộc runtime cứng nhắc.
  combatTypeId?: string

  // Skill passive tự học + equip khi tâm pháp này được trang bị (xem
  // GameManager.equipTechnique()).
  innateSkillId?: string

  // Pháp Tu profession-tier ladder — gắn identity Ngũ Hành cho UI.
  // `resourceLabel` đổi TÊN HIỂN THỊ của thanh Rage (CombatHud.vue)
  // khi tâm pháp này đang trang bị — KHÔNG phải resource mới.
  element?: ElementType

  resourceLabel?: string

  // Pháp Tu Redesign (magicpath) — đổi TÊN HIỂN THỊ của thanh MP
  // (CombatHud.vue), KHÔNG đổi cấu trúc/nguồn số liệu (vẫn currentMp/
  // stats.maxMp) — cùng tinh thần resourceLabel ở trên nhưng cho MP
  // thay vì Rage. "Linh lực" (Pháp Tu) / "Niệm lực" (Kiếm Tu) / "Thể
  // lực" (Thể Tu, chưa có Technique thật — xem [[tienhiep-phap-tu-magicpath]]).
  mpLabel?: string

  // Kiếm Tu (2026-08-15) — true = thanh tài nguyên trong CombatHud.vue
  // đổi hẳn NGUỒN SỐ LIỆU sang currentSwordIntent/MAX_SWORD_INTENT
  // (pool RIÊNG, xem CombatEntity.ts) thay vì currentRage/MAX_RAGE mặc
  // định — khác `resourceLabel` (chỉ đổi TÊN hiển thị, vẫn đọc Rage).
  usesSwordIntentResource?: boolean

  // PLAN HOÀN CHỈNH mục 5 — hiệu ứng chỉ số theo tier, xem
  // TechniqueTierEffect. Optional/từng-tier-optional vì Kiếm Tu/Thể Tu
  // chưa thiết kế (mục 5.3) — technique nào không khai coi như không
  // cộng gì (giữ hành vi cũ, không lỗi).
  tierEffects?: Partial<Record<TechniqueTier, TechniqueTierEffect>>

  unlocked: boolean

  equipped: boolean
}
