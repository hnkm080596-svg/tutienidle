import type { Material } from '@/core/material/Material'
import { SPIRIT_STONE_MATERIAL } from '@/core/material/SpiritStoneMaterial'
import type { ProfessionMaterialMeta } from '@/core/profession/ProfessionMaterial'
import { EQUIPMENT_REALM_ESSENCE_MATERIAL } from '@/core/equipment/RefinementBalance'

// sourceType (MASTER SPEC Mục II-V) — nhãn nguồn CHÍNH, không ràng
// buộc cứng (vd Xích Đồng vẫn rơi cả từ quái lẫn thám hiểm, xem
// data/enemy/Enemies.ts và data/exploration/explorations.ts).
//
// "tunghematandsuch" pass (2026-08-14) — thay hẳn kiểu material zoo
// "mỗi loài quái 1-2 material riêng" (13 material từ tầng 1-10 content
// pass + wolf-fang/wolf-hide/demon-core cũ) bằng ĐÚNG 3 material Yêu
// Tài dùng CHUNG cho mọi quái (Yêu Đan/Yêu Huyết/Yêu Cốt, tiered theo
// CẢNH GIỚI của quái chứ không phải theo loài — xem
// data/enemy/Enemies.ts) + 3 nhóm nguyên liệu tự nhiên age-tiered
// (Linh Thảo/Linh Mộc/Linh Thiết). Currency đặc thù (demon-soul/
// flame-essence/affix_rune_stone/affix_tier_stone/great_dao_seed + 4
// item Trúc Cơ ẩn) giữ NGUYÊN — không thuộc phạm vi đơn giản hoá
// "nguyên liệu tự nhiên" của tài liệu.
const legacyMaterials: Material[] = [
  // ============================================================
  // LINH THẢO (herb) — dùng cho Luyện Đan. 3 "họ" thật (kế thừa từ
  // naming-principles pass trước: Linh Chi/Quế/Cúc Hoa), mỗi họ có
  // đúng 3 bậc niên đại (base/Bách Niên/Thiên Niên) — niên đại đặt
  // TRẦN phẩm cấp tối đa của Đan chế từ nó (xem data/recipe/recipes.ts).
  // ============================================================
  {
    id: 'linh_chi',
    name: 'Linh Chi',
    category: 'herb',
    years: 0,
    element: 'wood',
    sourceType: 'exploration',
    description: 'Linh thảo phổ thông chứa linh khí Mộc thuộc tính.',
  },

  {
    id: 'bach_nien_linh_chi',
    name: 'Bách Niên Linh Chi',
    category: 'herb',
    years: 100,
    element: 'wood',
    sourceType: 'exploration',
    description: 'Linh Chi trăm năm tuổi, dược tính đậm đặc hơn hẳn.',
  },

  {
    id: 'thien_nien_linh_chi',
    name: 'Thiên Niên Linh Chi',
    category: 'herb',
    years: 1000,
    element: 'wood',
    sourceType: 'exploration',
    description: 'Linh Chi nghìn năm tuổi, cực hiếm, tích tụ linh khí Mộc thuần khiết.',
  },

  {
    id: 'que',
    name: 'Quế',
    category: 'herb',
    years: 0,
    element: 'fire',
    sourceType: 'exploration',
    description: 'Linh thảo mang Hỏa linh lực.',
  },

  {
    id: 'bach_nien_que',
    name: 'Bách Niên Quế',
    category: 'herb',
    years: 100,
    element: 'fire',
    sourceType: 'exploration',
    description: 'Quế trăm năm tuổi, Hỏa khí nồng đậm.',
  },

  {
    id: 'thien_nien_que',
    name: 'Thiên Niên Quế',
    category: 'herb',
    years: 1000,
    element: 'fire',
    sourceType: 'exploration',
    description: 'Quế nghìn năm tuổi, cực hiếm, Hỏa khí gần như thực chất.',
  },

  {
    id: 'cuc_hoa',
    name: 'Cúc Hoa',
    category: 'herb',
    years: 0,
    element: 'water',
    sourceType: 'exploration',
    description: 'Linh thảo sinh trưởng tại nơi hàn khí hội tụ.',
  },

  {
    id: 'bach_nien_cuc_hoa',
    name: 'Bách Niên Cúc Hoa',
    category: 'herb',
    years: 100,
    element: 'water',
    sourceType: 'exploration',
    description: 'Cúc Hoa trăm năm tuổi, hàn khí tinh thuần.',
  },

  {
    id: 'thien_nien_cuc_hoa',
    name: 'Thiên Niên Cúc Hoa',
    category: 'herb',
    years: 1000,
    element: 'water',
    sourceType: 'exploration',
    description: 'Cúc Hoa nghìn năm tuổi, cực hiếm, hàn khí ngưng thành sương.',
  },

  // ============================================================
  // LINH MỘC (wood) — dùng cho Chế Phù. Cùng cơ chế niên đại.
  // ============================================================
  {
    id: 'thanh_linh_moc',
    name: 'Thanh Linh Mộc',
    category: 'wood',
    years: 0,
    element: 'wood',
    sourceType: 'exploration',
    description:
      'Gỗ linh mộc phổ thông, cần Thiên Công Phường xử lý thành Phù Chỉ mới dùng chế Phù được.',
  },

  {
    id: 'bach_nien_thanh_linh_moc',
    name: 'Bách Niên Thanh Linh Mộc',
    category: 'wood',
    years: 100,
    element: 'wood',
    sourceType: 'exploration',
    description: 'Linh Mộc trăm năm tuổi, dẫn linh lực ổn định hơn hẳn.',
  },

  {
    id: 'thien_nien_thanh_linh_moc',
    name: 'Thiên Niên Thanh Linh Mộc',
    category: 'wood',
    years: 1000,
    element: 'wood',
    sourceType: 'exploration',
    description: 'Linh Mộc nghìn năm tuổi, cực hiếm, gần như không hao tổn linh lực khi dẫn.',
  },

  // Thiên Công Phường (2026-08-15) — raw material do Building sản
  // xuất, chưa qua chế luyện (đúng ví dụ chuỗi Iron Ore → Iron Ingot,
  // giờ áp dụng thêm cho tuyến Linh Mộc → Phù Chỉ). Thay thế
  // thanh-linh-moc làm nguyên liệu TRỰC TIẾP trong công thức chế Phù
  // (xem data/recipe/recipes.ts, data/building/processingRecipes.ts).
  {
    id: 'phu_chi',
    name: 'Phù Chỉ',
    category: 'wood',
    sourceType: 'building',
    description: 'Giấy phù đã qua xử lý ở Thiên Công Phường, sẵn sàng để vẽ chú văn chế Phù.',
  },

  // ============================================================
  // LINH THIẾT (ore) — dùng cho Bày Trận + Luyện Khí. KHÔNG dùng
  // niên đại (đã có sẵn 5 biến thể Ngũ Hành làm trục đa dạng, tránh
  // chồng 2 trục cùng lúc lên 1 nhóm — xem tunghematandsuch mục 8-9).
  // ============================================================
  {
    id: 'huyen_thiet',
    name: 'Huyền Thiết',
    category: 'ore',
    years: 0,
    element: 'metal',
    sourceType: 'exploration',
    description: 'Khoáng thạch thường dùng trong luyện khí, thiên Kim.',
  },

  {
    id: 'xich_dong',
    name: 'Xích Đồng',
    category: 'ore',
    years: 0,
    element: 'fire',
    sourceType: 'exploration',
    description: 'Khoáng kim loại chứa Hỏa linh khí.',
  },

  {
    id: 'thanh-dong',
    name: 'Thanh Đồng',
    category: 'ore',
    years: 0,
    element: 'wood',
    sourceType: 'exploration',
    description: 'Khoáng kim loại thiên Mộc, dùng bày trận Mộc hệ.',
  },

  {
    id: 'han-thiet',
    name: 'Hàn Thiết',
    category: 'ore',
    years: 0,
    element: 'water',
    sourceType: 'exploration',
    description: 'Khoáng thiết lạnh buốt, thiên Thủy.',
  },

  {
    id: 'hoang_kim_linh_thiet',
    name: 'Hoàng Kim Linh Thiết',
    category: 'ore',
    years: 0,
    element: 'earth',
    sourceType: 'exploration',
    description: 'Khoáng thiết sắc vàng đất, thiên Thổ.',
  },

  // Orphan CÓ CHỦ ĐÍCH — Phase 4/5 (Herb Garden/Iron Mine/Smelter)
  // không sản xuất chất này (đúng kế hoạch, tránh thêm building/
  // recipe mới ngoài phạm vi Phase 10 "chỉ tune data"). Không thuộc
  // nhóm Linh Thiết 5-hành (không có element gán) — nguồn cung thật
  // để dành cho 1 đợt Economy tiếp theo.
  {
    id: 'tinh_ngan',
    name: 'Tinh Ngân',
    category: 'ore',
    sourceType: 'building',
    description:
      'Khoáng vật quý hiếm, chưa có Building nào khai thác được — dự kiến bổ sung ở đợt sau.',
  },

  // MỚI (Phase 4) — raw material do Building sản xuất, chưa qua chế
  // luyện (đúng ví dụ spec "Iron Ore → Iron Ingot", xem Phase 5's
  // Smelter processing black-iron từ iron-ore này). Nguồn ĐỔI sang
  // Khai Thác (exploration) — Thiết Khoáng Sơn đã bị thay bằng Linh
  // Tuyền (xem data/building/buildings.ts).
  {
    id: 'quang_sat',
    name: 'Quặng Sắt',
    category: 'ore',
    sourceType: 'exploration',
    description: 'Quặng sắt thô, cần Lò Luyện xử lý mới dùng được.',
  },

  // Khai Thác/Linh Thảo Viên rework — Khai Thác (exploration) giờ chỉ
  // cho hạt giống thô, Linh Thảo Viên là nơi GIEO hạt (9 ô vườn, xem
  // Building.gardenSeedMaterialId) rồi mới ra thành phẩm linh thảo
  // thật (green-spirit-herb) — tách bước "thu thập" khỏi "trồng trọt",
  // đúng ý tránh trùng chức năng giữa 2 Building.
  {
    id: 'linh_thao_chung',
    name: 'Linh Thảo Chủng',
    category: 'herb',
    sourceType: 'exploration',
    description:
      'Hạt giống linh thảo thô nhặt được khi thám hiểm, đem gieo ở Linh Thảo Viên mới nảy mầm thành linh thảo thật.',
  },

  // ============================================================
  // YÊU TÀI — tài nguyên rơi từ MỌI quái, tiered theo CẢNH GIỚI của
  // quái đó (không phải theo loài) — thay thế wolf-fang/wolf-hide/
  // demon-core cũ VÀ 13 material trophy riêng từng loài của tầng
  // 1-10 content pass (đã xoá khỏi file này). Chỉ id hậu tố
  // `_qi_refining` được tạo — realm cao hơn chưa có Stage nào tồn tại
  // để rơi, thêm khi có nội dung thật (xem data/enemy/Enemies.ts).
  // ============================================================
  {
    id: 'yeu_dan_luyen_khi_canh',
    name: 'Yêu Đan (Luyện Khí Cảnh)',
    category: 'monster_core',
    sourceType: 'monster',
    description:
      'Nội đan của yêu thú Luyện Khí Cảnh, chứa tinh hoa tu vi — nguồn năng lượng chính khi Luyện Đan.',
  },

  {
    id: 'yeu_huyet_luyen_khi_canh',
    name: 'Yêu Huyết (Luyện Khí Cảnh)',
    category: 'monster_core',
    sourceType: 'monster',
    description: 'Máu yêu thú Luyện Khí Cảnh, mang linh tính mạnh — dùng dẫn lực khi Chế Phù.',
  },

  {
    id: 'yeu_cot_luyen_khi_canh',
    name: 'Yêu Cốt (Luyện Khí Cảnh)',
    category: 'monster_core',
    sourceType: 'monster',
    description: 'Xương yêu thú Luyện Khí Cảnh, cứng chắc — làm cốt trận khi Bày Trận.',
  },

  // Reclassify: trước rơi ở Exploration (Vạn Yêu Lâm, chance 0.1) —
  // giờ CHỈ rơi từ Boss (đúng flavor "hồn quái" hiếm/giá trị cao,
  // Mục II) — xem Enemies.ts's bandit.eliteRewards. Currency đặc thù,
  // KHÔNG thuộc nhóm Yêu Tài phổ thông ở trên.
  {
    id: 'yeu_hon',
    name: 'Yêu Hồn',
    category: 'essence',
    sourceType: 'boss',
    description: 'Một luồng thần hồn còn sót lại của yêu thú, chỉ tìm thấy nơi Boss trấn giữ.',
  },

  // MỚI — material CHỈ rơi từ Boss (Sơn Tặc Đầu Lĩnh, xem Enemies.ts),
  // minh hoạ đúng "Boss A → Flame Essence" (Mục II). Currency đặc thù.
  {
    id: 'tinh_hoa_hoa',
    name: 'Tinh Hoa Hỏa',
    category: 'essence',
    sourceType: 'boss',
    description: 'Tinh hoa Hỏa linh khí ngưng tụ nơi Boss trấn giữ, cực kỳ hiếm.',
  },

  // Realm Passive & Pressure System (2026-08-20) — currency Luyện Thể,
  // CHỈ rơi từ 20 quái Phàm Nhân (data/enemy/Enemies.ts), đầu tư qua
  // GameManager.investBodyRefinement() để lấp đầy 6 tầng (xem
  // data/realm/LuyenThe.ts/core/realm/BodyRefinementSystem.ts). id khớp
  // TINH_HOA_PHAM_THE_MATERIAL_ID.
  {
    id: 'tinh_hoa_pham_the',
    name: 'Tinh Hoa Phàm Thể',
    category: 'essence',
    sourceType: 'monster',
    description: 'Tinh hoa ngưng tụ từ thể phách phàm thú, dùng để rèn luyện 6 tầng thân thể.',
  },

  // MỚI (Core Loop Foundation, Phase 4) — currency cho 2 thao tác
  // Affix (Thêm Dòng/Nâng Cấp Dòng), xem data/enemy/Enemies.ts's
  // drop entries + data/equipment/equipment.ts's addAffixCost/
  // upgradeAffixCost.
  {
    id: 'affix_rune_stone',
    name: 'Phù Văn Thạch',
    category: 'other',
    sourceType: 'monster',
    description: 'Đá khắc phù văn cổ, dùng khắc thêm 1 dòng Affix lên trang bị.',
  },

  {
    id: 'affix_tier_stone',
    name: 'Cường Hoa Thạch',
    category: 'other',
    sourceType: 'boss',
    description: 'Đá cường hoá quý hiếm, dùng nâng Tier 1 dòng Affix đã có trên trang bị.',
  },

  // Đột Phá Trúc Cơ (Phase 3) — điều kiện ẩn của Đại Đạo (mục 8/15
  // spec `breakthrough`), rơi 0.01% từ Boss "Đại Vương Sơn Tặc" (xem
  // data/enemy/Enemies.ts's bandit.bossRewards). Description CỐ Ý
  // không tiết lộ công dụng — verbatim đúng spec, KHÔNG được sửa.
  {
    id: 'great_dao_seed',
    name: 'Đại Đạo Chi Cơ',
    category: 'other',
    sourceType: 'boss',
    description: 'Một vật phẩm kỳ dị, không thể xác định công dụng.',
  },

  // Đột Phá Trúc Cơ (Phase 6) — loot "vô thưởng vô phạt" (mục 14 spec
  // `breakthrough`): KHÔNG stat/effect, KHÔNG mở quest, KHÔNG dùng
  // crafting — chỉ tạo manh mối qua description, verbatim đúng spec,
  // KHÔNG được sửa/diễn giải thêm.
  {
    id: 'broken_foundation_scroll',
    name: 'Tàn Quyển Trúc Cơ',
    category: 'other',
    sourceType: 'exploration',
    description: 'Chín tầng đã đủ để bước vào con đường của người thường.',
  },

  {
    id: 'old_jade_slip',
    name: 'Ngọc Giản Cũ',
    category: 'other',
    sourceType: 'exploration',
    description: 'Có người dừng lại ở tầng thứ chín. Có người không.',
  },

  {
    id: 'cultivator_diary',
    name: 'Nhật Ký Tu Sĩ',
    category: 'other',
    sourceType: 'monster',
    description: 'Ta đã vượt qua tầng thứ mười hai.',
  },

  {
    id: 'stele_fragment',
    name: 'Mảnh Bia',
    category: 'other',
    sourceType: 'monster',
    description: 'Mười hai...',
  },

  // ============================================================
  // PHẾ LIỆU LUYỆN KHÍ — Bụi Cốt (byproduct của Luyện Khí, xem
  // GameManager.smeltEquipment()), tiêu thụ lại bởi Cường Hóa. Tinh
  // Luyện Cốt là bậc tinh chế cao hơn (Bụi Cốt + Linh Thạch, xem
  // GameManager.refineBuiCot()) — CHƯA có consumer cụ thể trong lượt
  // này (tài liệu chỉ liệt kê use-case tương lai — "cường hóa cao
  // cấp/sửa chữa Khí" — chưa có mechanic thật để wire vào, cố tình
  // KHÔNG bịa thêm 1 sink giả chỉ để lấp chỗ trống, tránh lặp lại lỗi
  // "material chết" đã rút kinh nghiệm ở lượt naming-principles trước
  // — khác ở chỗ lần này ít nhất ĐÃ có nguồn thu thật (refineBuiCot),
  // chỉ thiếu điểm tiêu, sẽ bổ sung khi có mechanic "cường hóa cao
  // cấp" cụ thể).
  // ============================================================
  {
    id: 'bui_cot',
    name: 'Bụi Cốt',
    category: 'byproduct',
    sourceType: 'building',
    description: 'Phế liệu thu được sau khi Luyện Khí, dùng làm nguyên liệu Cường Hóa.',
  },

  {
    id: 'tinh_luyen_cot',
    name: 'Tinh Luyện Cốt',
    category: 'byproduct',
    sourceType: 'building',
    description:
      'Bụi Cốt đã qua tinh luyện, giá trị cao hơn hẳn — chưa có nơi tiêu thụ, giữ làm tài nguyên tích trữ.',
  },

  // ============================================================
  // ĐỘT PHÁ LỆNH — "con đường bình thường" của Đột Phá tổng quát
  // (2026-08-16, xem core/breakthrough/BreakthroughRequirement.ts):
  // vật phẩm CÔNG KHAI hiện trong BreakthroughRequirementPanel.vue
  // trước khi vào Độ Kiếp, khác hẳn 4 item Trúc Cơ ẩn phía trên
  // (great_dao_seed/broken_foundation_scroll/old_jade_slip/
  // cultivator_diary/stele_fragment — không đổi). Luyện được bằng
  // Linh Thạch qua GameManager.craftBreakthroughToken() — cùng pattern
  // "chuyển đổi trực tiếp, không qua Recipe" như refineBuiCot() ở trên
  // (RecipeResultType không hỗ trợ material làm kết quả), sourceType
  // 'building' theo đúng tiền lệ tinh_luyen_cot.
  // ============================================================
  {
    id: 'breakthrough_token_foundation_establishment',
    name: 'Trúc Cơ Lệnh',
    category: 'other',
    sourceType: 'building',
    description: 'Lệnh bài ngưng tụ từ Linh Thạch, dẫn đường Độ Kiếp Trúc Cơ.',
  },

  {
    id: 'breakthrough_token_golden_core',
    name: 'Kim Đan Lệnh',
    category: 'other',
    sourceType: 'building',
    description: 'Lệnh bài ngưng tụ từ Linh Thạch, dẫn đường Độ Kiếp Kim Đan.',
  },

  {
    id: 'breakthrough_token_nascent_soul',
    name: 'Nguyên Anh Lệnh',
    category: 'other',
    sourceType: 'building',
    description: 'Lệnh bài ngưng tụ từ Linh Thạch, dẫn đường Độ Kiếp Nguyên Anh.',
  },

  {
    id: 'breakthrough_token_soul_transformation',
    name: 'Hóa Thần Lệnh',
    category: 'other',
    sourceType: 'building',
    description: 'Lệnh bài ngưng tụ từ Linh Thạch, dẫn đường Độ Kiếp Hóa Thần.',
  },

  {
    id: 'breakthrough_token_void_refinement',
    name: 'Luyện Hư Lệnh',
    category: 'other',
    sourceType: 'building',
    description: 'Lệnh bài ngưng tụ từ Linh Thạch, dẫn đường Độ Kiếp Luyện Hư.',
  },

  {
    id: 'breakthrough_token_body_integration',
    name: 'Hợp Thể Lệnh',
    category: 'other',
    sourceType: 'building',
    description: 'Lệnh bài ngưng tụ từ Linh Thạch, dẫn đường Độ Kiếp Hợp Thể.',
  },

  {
    id: 'breakthrough_token_mahayana',
    name: 'Đại Thừa Lệnh',
    category: 'other',
    sourceType: 'building',
    description: 'Lệnh bài ngưng tụ từ Linh Thạch, dẫn đường Độ Kiếp Đại Thừa.',
  },

  {
    id: 'breakthrough_token_tribulation',
    name: 'Độ Kiếp Lệnh',
    category: 'other',
    sourceType: 'building',
    description: 'Lệnh bài ngưng tụ từ Linh Thạch, dẫn đường Độ Kiếp tối hậu.',
  },

]

// ============================================================
// NGUYÊN LIỆU NGHỀ MỚI (2026-08-25, resource-professions-rework plan
// §5/§6): KHÔNG còn cặp raw|processed (plan §2). Ba nhóm trực tiếp:
// - Lâm: 3 gỗ `<realm>_wood` — xây/nâng công trình + nhiên liệu đan lò.
// - Quáng: `<realm>_ore_<quality>` — sink Khí Đường (Cường Hóa/Tẩy
//   Luyện), phẩm là metadata material.
// - Động Thiên: mỗi đan phương một thảo riêng × 4 niên đại
//   `<herbBase>_<age>` — sink Đan Phòng.
// Tất cả sinh bằng generator để tránh author tay 66 entry lệch chuẩn;
// tên hiển thị đặt TRẦN ở đây (không parse từ id).
// ============================================================

interface ProfessionRealmCell {
  realmId: string

  realmLabel: string
}

const PROFESSION_REALM_CELLS: readonly ProfessionRealmCell[] = [
  { realmId: 'mortal', realmLabel: 'Phàm Nhân' },
  { realmId: 'qi_refining', realmLabel: 'Luyện Khí' },
  { realmId: 'foundation_establishment', realmLabel: 'Trúc Cơ' },
]

const WOOD_NAMES: Record<string, string> = {
  mortal: 'Thanh Vân Mộc',
  qi_refining: 'Hàn Ngọc Mộc',
  foundation_establishment: 'Tử Điện Mộc',
}

const ORE_QUALITY_LABELS: Record<string, string> = {
  hoang: 'Hoàng',
  huyen: 'Huyền',
  dia: 'Địa',
  thien: 'Thiên',
  tien: 'Tiên',
}

const ORE_BASE_NAMES: Record<string, string> = {
  mortal: 'Thiết Quáng',
  qi_refining: 'Huyền Sa',
  foundation_establishment: 'Tinh Ngọc Thạch',
}

const HERB_AGE_LABELS: Record<string, string> = {
  decade: 'Thập Niên',
  century: 'Bách Niên',
  millennium: 'Thiên Niên',
  myriad_year: 'Vạn Niên',
}

const HERB_AGE_YEARS: Record<string, number> = {
  decade: 10,
  century: 100,
  millennium: 1000,
  myriad_year: 10000,
}

/**
 * Mapping đan phương → thảo riêng (Phase 0 chốt, §13.3) — PHẢI khớp
 * THANH_VAN_GROTTO_HERB_BASES trong core/production/ProductionCatalog.ts
 * (data-integrity test chéo kiểm tra).
 */
const HERB_BASE_BY_RECIPE: Readonly<Record<string, { baseId: string; name: string; realmId: string }>> =
  {
    alchemy_pill_regen_mortal: { baseId: 'huyet_tham', name: 'Huyết Tham', realmId: 'mortal' },
    alchemy_pill_cultivation_mortal: {
      baseId: 'tinh_khi_thao',
      name: 'Tinh Khi Thảo',
      realmId: 'mortal',
    },
    alchemy_pill_insight_mortal: {
      baseId: 'minh_muc_thao',
      name: 'Minh Mục Thảo',
      realmId: 'mortal',
    },
    alchemy_pill_main_stat_mortal: {
      baseId: 'pho_cot_hoa',
      name: 'Phổ Cốt Hoa',
      realmId: 'mortal',
    },
    alchemy_pill_regen_qi_refining: {
      baseId: 'ngoc_huyet_chi',
      name: 'Ngọc Huyết Chi',
      realmId: 'qi_refining',
    },
    alchemy_pill_cultivation_qi_refining: {
      baseId: 'tuan_linh_cao',
      name: 'Tuấn Linh Cao',
      realmId: 'qi_refining',
    },
    alchemy_pill_insight_qi_refining: {
      baseId: 'than_thong_hoa',
      name: 'Thần Thông Hoa',
      realmId: 'qi_refining',
    },
    alchemy_pill_main_stat_qi_refining: {
      baseId: 'loc_cot_thao',
      name: 'Lộc Cốt Thảo',
      realmId: 'qi_refining',
    },
    alchemy_pill_regen_foundation_establishment: {
      baseId: 'cu_phuong_qua',
      name: 'Cử Phượng Quả',
      realmId: 'foundation_establishment',
    },
    alchemy_pill_cultivation_foundation_establishment: {
      baseId: 'dao_diem_lien',
      name: 'Đạo Điềm Liên',
      realmId: 'foundation_establishment',
    },
    alchemy_pill_insight_foundation_establishment: {
      baseId: 'van_tu_dang',
      name: 'Vạn Tự Đăng',
      realmId: 'foundation_establishment',
    },
    alchemy_pill_main_stat_foundation_establishment: {
      baseId: 'thien_cot_thao',
      name: 'Thiên Cốt Thảo',
      realmId: 'foundation_establishment',
    },
  }

function buildProfessionMaterials(): Material[] {
  const list: Material[] = []

  // ---- Lâm: 3 gỗ ----
  for (const cell of PROFESSION_REALM_CELLS) {
    list.push({
      id: `${cell.realmId}_wood`,
      name: WOOD_NAMES[cell.realmId] ?? cell.realmId,
      category: 'wood',
      element: 'wood',
      sourceType: 'exploration',
      description: `Linh mộc ${cell.realmLabel} của Thanh Vân Lâm — xây công trình và làm nhiên liệu đan lò.`,
      profession: {
        resourceKind: 'wood',
        realmId: cell.realmId,
      },
    })
  }

  // ---- Quáng: 3 tier × 5 phẩm ----
  for (const cell of PROFESSION_REALM_CELLS) {
    for (const quality of ['hoang', 'huyen', 'dia', 'thien', 'tien']) {
      list.push({
        id: `${cell.realmId}_ore_${quality}`,
        name: `${ORE_QUALITY_LABELS[quality]} ${ORE_BASE_NAMES[cell.realmId]}`,
        category: 'ore',
        element: 'metal',
        sourceType: 'exploration',
        description: `Quảng thạch phẩm ${ORE_QUALITY_LABELS[quality]} của ${cell.realmLabel} — nguyên liệu Khí Đường.`,
        profession: {
          resourceKind: 'ore',
          realmId: cell.realmId,
          quality,
        },
      })
    }
  }

  // ---- Động Thiên: 12 thảo × 4 niên đại ----
  for (const [recipeId, herb] of Object.entries(HERB_BASE_BY_RECIPE)) {
    for (const age of ['decade', 'century', 'millennium', 'myriad_year']) {
      list.push({
        id: `${herb.baseId}_${age}`,
        name: `${herb.name} ${HERB_AGE_LABELS[age]}`,
        category: 'herb',
        years: HERB_AGE_YEARS[age],
        element: 'wood',
        sourceType: 'exploration',
        description: 'Linh thảo riêng cho một đan phương duy nhất — niên đại quyết định tỷ lệ thành đan cơ sở.',
        profession: {
          resourceKind: 'herb',
          realmId: herb.realmId,
          age,
          pillRecipeId: recipeId,
          herbBaseId: herb.baseId,
        },
      })
    }
  }

  // ---- Tinh Hoa (Khí Đường Hóa Luyện, §7.5): tier theo cảnh giới trang bị ----
  const ESSENCE_TIERS: ReadonlyArray<{ realmId: string; name: string }> = [
    { realmId: 'mortal', name: 'Phàm Khí Tinh Hoa' },
    { realmId: 'qi_refining', name: 'Bảo Khí Tinh Hoa' },
    { realmId: 'foundation_establishment', name: 'Linh Khí Tinh Hoa' },
  ]

  for (const tier of ESSENCE_TIERS) {
    list.push({
      id: equipmentEssenceMaterialId(tier.realmId),
      name: tier.name,
      category: 'essence',
      sourceType: 'building',
      description: 'Tinh hoa phân giải từ trang bị cùng cảnh giới — nguyên liệu Tinh Luyện.',
    })
  }

  return list
}

/** Mapping cảnh giới trang bị → tier Tinh Hoa (chốt §13.6). */
export function equipmentEssenceMaterialId(realmId: string): string {
  return EQUIPMENT_REALM_ESSENCE_MATERIAL[realmId] ?? 'tinh_hoa_pham_khi'
}

export const materials: Material[] = [
  // Linh Thạch — MATERIAL thật (plan Workstream F), tham gia mọi sort
  // trong tab Nguyên Liệu như material bình thường; KHÔNG còn currency
  // state trên PlayerData.
  SPIRIT_STONE_MATERIAL,

  ...legacyMaterials,

  ...buildProfessionMaterials(),
]
