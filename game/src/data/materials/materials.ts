import type { Material } from '@/core/material/Material'

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
export const materials: Material[] = [
  // ============================================================
  // LINH THẢO (herb) — dùng cho Luyện Đan. 3 "họ" thật (kế thừa từ
  // naming-principles pass trước: Linh Chi/Quế/Cúc Hoa), mỗi họ có
  // đúng 3 bậc niên đại (base/Bách Niên/Thiên Niên) — niên đại đặt
  // TRẦN phẩm cấp tối đa của Đan chế từ nó (xem data/recipe/recipes.ts).
  // ============================================================
  {
    id: 'green-spirit-herb',
    name: 'Linh Chi',
    category: 'herb',
    years: 0,
    element: 'wood',
    sourceType: 'exploration',
    description: 'Linh thảo phổ thông chứa linh khí Mộc thuộc tính.',
  },

  {
    id: 'bach-nien-linh-chi',
    name: 'Bách Niên Linh Chi',
    category: 'herb',
    years: 100,
    element: 'wood',
    sourceType: 'exploration',
    description: 'Linh Chi trăm năm tuổi, dược tính đậm đặc hơn hẳn.',
  },

  {
    id: 'thien-nien-linh-chi',
    name: 'Thiên Niên Linh Chi',
    category: 'herb',
    years: 1000,
    element: 'wood',
    sourceType: 'exploration',
    description: 'Linh Chi nghìn năm tuổi, cực hiếm, tích tụ linh khí Mộc thuần khiết.',
  },

  {
    id: 'fire-spirit-herb',
    name: 'Quế',
    category: 'herb',
    years: 0,
    element: 'fire',
    sourceType: 'exploration',
    description: 'Linh thảo mang Hỏa linh lực.',
  },

  {
    id: 'bach-nien-que',
    name: 'Bách Niên Quế',
    category: 'herb',
    years: 100,
    element: 'fire',
    sourceType: 'exploration',
    description: 'Quế trăm năm tuổi, Hỏa khí nồng đậm.',
  },

  {
    id: 'thien-nien-que',
    name: 'Thiên Niên Quế',
    category: 'herb',
    years: 1000,
    element: 'fire',
    sourceType: 'exploration',
    description: 'Quế nghìn năm tuổi, cực hiếm, Hỏa khí gần như thực chất.',
  },

  {
    id: 'cold-spirit-herb',
    name: 'Cúc Hoa',
    category: 'herb',
    years: 0,
    element: 'water',
    sourceType: 'exploration',
    description: 'Linh thảo sinh trưởng tại nơi hàn khí hội tụ.',
  },

  {
    id: 'bach-nien-cuc-hoa',
    name: 'Bách Niên Cúc Hoa',
    category: 'herb',
    years: 100,
    element: 'water',
    sourceType: 'exploration',
    description: 'Cúc Hoa trăm năm tuổi, hàn khí tinh thuần.',
  },

  {
    id: 'thien-nien-cuc-hoa',
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
    id: 'thanh-linh-moc',
    name: 'Thanh Linh Mộc',
    category: 'wood',
    years: 0,
    element: 'wood',
    sourceType: 'exploration',
    description: 'Gỗ linh mộc phổ thông, cần Thiên Công Phường xử lý thành Phù Chỉ mới dùng chế Phù được.',
  },

  {
    id: 'bach-nien-thanh-linh-moc',
    name: 'Bách Niên Thanh Linh Mộc',
    category: 'wood',
    years: 100,
    element: 'wood',
    sourceType: 'exploration',
    description: 'Linh Mộc trăm năm tuổi, dẫn linh lực ổn định hơn hẳn.',
  },

  {
    id: 'thien-nien-thanh-linh-moc',
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
    id: 'phu-chi',
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
    id: 'black-iron',
    name: 'Huyền Thiết',
    category: 'ore',
    years: 0,
    element: 'metal',
    sourceType: 'exploration',
    description: 'Khoáng thạch thường dùng trong luyện khí, thiên Kim.',
  },

  {
    id: 'red-copper',
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
    id: 'hoang-kim-linh-thiet',
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
    id: 'spirit-silver',
    name: 'Tinh Ngân',
    category: 'ore',
    sourceType: 'building',
    description: 'Khoáng vật quý hiếm, chưa có Building nào khai thác được — dự kiến bổ sung ở đợt sau.',
  },

  // MỚI (Phase 4) — raw material do Building sản xuất, chưa qua chế
  // luyện (đúng ví dụ spec "Iron Ore → Iron Ingot", xem Phase 5's
  // Smelter processing black-iron từ iron-ore này). Nguồn ĐỔI sang
  // Khai Thác (exploration) — Thiết Khoáng Sơn đã bị thay bằng Linh
  // Tuyền (xem data/building/buildings.ts).
  {
    id: 'iron-ore',
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
    id: 'herb-seed',
    name: 'Linh Thảo Chủng',
    category: 'herb',
    sourceType: 'exploration',
    description: 'Hạt giống linh thảo thô nhặt được khi thám hiểm, đem gieo ở Linh Thảo Viên mới nảy mầm thành linh thảo thật.',
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
    id: 'yeu_dan_qi_refining',
    name: 'Yêu Đan (Luyện Khí Cảnh)',
    category: 'monster_core',
    sourceType: 'monster',
    description: 'Nội đan của yêu thú Luyện Khí Cảnh, chứa tinh hoa tu vi — nguồn năng lượng chính khi Luyện Đan.',
  },

  {
    id: 'yeu_huyet_qi_refining',
    name: 'Yêu Huyết (Luyện Khí Cảnh)',
    category: 'monster_core',
    sourceType: 'monster',
    description: 'Máu yêu thú Luyện Khí Cảnh, mang linh tính mạnh — dùng dẫn lực khi Chế Phù.',
  },

  {
    id: 'yeu_cot_qi_refining',
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
    id: 'demon-soul',
    name: 'Yêu Hồn',
    category: 'essence',
    sourceType: 'boss',
    description: 'Một luồng thần hồn còn sót lại của yêu thú, chỉ tìm thấy nơi Boss trấn giữ.',
  },

  // MỚI — material CHỈ rơi từ Boss (Sơn Tặc Đầu Lĩnh, xem Enemies.ts),
  // minh hoạ đúng "Boss A → Flame Essence" (Mục II). Currency đặc thù.
  {
    id: 'flame-essence',
    name: 'Tinh Hoa Hỏa',
    category: 'essence',
    sourceType: 'boss',
    description: 'Tinh hoa Hỏa linh khí ngưng tụ nơi Boss trấn giữ, cực kỳ hiếm.',
  },

  // Realm Passive & Pressure System (2026-08-20) — currency Luyện Thể,
  // CHỈ rơi từ 20 quái Phàm Nhân (data/enemy/Enemies.ts), đầu tư qua
  // GameManager.investLuyenThe() để lấp đầy 6 tầng (xem
  // data/realm/LuyenThe.ts/core/realm/LuyenTheSystem.ts). id khớp
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
    description: 'Bụi Cốt đã qua tinh luyện, giá trị cao hơn hẳn — chưa có nơi tiêu thụ, giữ làm tài nguyên tích trữ.',
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
    id: 'breakthrough_token_foundation',
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
