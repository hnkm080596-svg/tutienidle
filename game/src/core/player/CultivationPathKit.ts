import type { ElementType } from '../element/ElementType'

// Pháp Tu Redesign (magicpath, 2026-08-18) — 5 path Ngũ Hành cũ
// (phap_tu_hoa/moc/thuy/kim/tho) đã GỘP thành 1 "phap_tu" duy nhất
// (mục 1 magicpath: "Pháp Tu không còn được thiết kế thành nhiều hệ
// nguyên tố tách biệt"). Kiếm Tu vẫn đứng RIÊNG (nhánh song song, cơ
// chế kit cố định KHÁC hẳn — chưa đi qua Element/Node Tree). Thêm giá
// trị mới khi Thể Tu được thiết kế sau này — KHÔNG BAO GIỜ tái cấu
// trúc union này, chỉ mở rộng thêm string.
export type CultivationPathId = 'phap_tu' | 'kiem_tu'

export interface CultivationPathKit {
  id: CultivationPathId

  name: string

  // Pháp Tu Redesign — KHÔNG còn 1 hành cố định cho Pháp Tu (multi-
  // element qua Element Loadout, xem core/element/ElementLoadout.ts).
  // Optional — CHỈ Kiếm Tu còn khai (giữ identity/màu UI riêng), Pháp
  // Tu để trống.
  element?: ElementType

  // Tâm Pháp hợp nhất (2026-08-15) — CHỈ 1 technique, tự học+trang bị
  // qua GameManager.chooseCultivationPath(), GHI ĐÈ bất kỳ tâm pháp
  // nào đang trang bị (kể cả tâm pháp khởi đầu
  // 'tu_linh_quyet' — chuyển nghề = đổi hẳn tâm pháp).
  techniqueId: string

  // ĐÚNG 3 skill cố định, gán thẳng vào Skill Loadout slot 0/1/2 lúc
  // chọn path (xem GameManager.chooseCultivationPath(), PLAN HOÀN
  // CHỈNH mục 8 — thay activeCategory basic/special/ultimate cũ). skill
  // đầu tuple PHẢI khai isBasicAttack:true trong Skills.ts. Pháp Tu
  // Redesign — Optional: CHỈ Kiếm Tu còn khai (chưa đi qua Node Tree).
  // Pháp Tu để trống — skill giờ mở qua Node Tree (unlock 1 hành =
  // unlock luôn 3 skill + 1 nội tại của hành đó, xem
  // data/progression/PhapTuNodes.ts).
  skillIds?: [basic: string, special: string, ultimate: string]
}

export const CULTIVATION_PATH_KITS: Record<CultivationPathId, CultivationPathKit> = {
  phap_tu: {
    id: 'phap_tu',
    name: 'Pháp Tu — Đại Ngũ Hành Chân Quyết',
    techniqueId: 'dai_ngu_hanh_chan_quyet',
  },

  kiem_tu: {
    id: 'kiem_tu',
    name: 'Kiếm Tu — Ngự Kiếm Tâm Kinh',
    element: 'metal',
    techniqueId: 'ngu_kiem',
    skillIds: ['ngu_kiem_thuat', 'kiem_khai_thien_mon', 'van_kiem_trieu_tong'],
  },
}

// Nghi Lễ Nhập Môn (2026-08-16) — gate cũ (mốc realmLevel cố định
// trong qi_refining) đã bị THAY THẾ: chọn nghề giờ CHÍNH LÀ nghi lễ
// đột phá Phàm Nhân -> Luyện Khí, nên điều kiện mở khoá gắn với việc
// hoàn thành Phàm Nhân cảnh (realmId === 'mortal' && realmLevel ===
// maxLevel), xem CharacterPanel.vue's canChooseCultivationPath. Không
// còn hằng số riêng ở đây nữa — đọc thẳng maxLevel của REALMS.
