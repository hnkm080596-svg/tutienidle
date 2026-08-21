import type { Building } from '@/core/building/Building'

// Resource Building mẫu (MASTER SPEC Mục V) — đủ minh hoạ khung hoạt
// động, chưa cần đủ 5 loại spec liệt kê (Farm/Mine/Lumber Mill/
// Quarry/Herbal Garden). `smelter` (Processing, Phase 5) tiêu thụ
// iron-ore (quặng sắt thô, giờ nhặt từ Khai Thác — xem
// data/exploration/explorations.ts) để ra Huyền Thiết, không tự sinh
// ra input của chính nó (xem data/building/processingRecipes.ts).
export const buildings: Building[] = [
  // Khai Thác/Linh Thảo Viên rework (2026-08-15) — trước đây building
  // này TỰ sinh thẳng green-spirit-herb, trùng hẳn chức năng với Khai
  // Thác (exploration cũng rơi thẳng green-spirit-herb/fire-spirit-herb).
  // Giờ tách 2 vai trò: Khai Thác nhặt hạt giống thô (herb-seed, xem
  // data/exploration/explorations.ts), Linh Thảo Viên là nơi GIEO hạt —
  // 9 ô vuông (GARDEN_PLOT_COUNT), mỗi level building mở thêm đúng 1 ô
  // (xem GardenSystem.ts). Không còn producesMaterialId/baseProductionRate
  // (3 kiểu building loại trừ nhau, xem Building.ts).
  {
    id: 'herb_garden',

    name: 'Linh Thảo Viên',

    description: 'Vườn gieo trồng linh thảo — mỗi ô tự nảy mầm sau khi gieo hạt, không cần chăm liên tục.',

    category: 'resource',

    tier: 1,

    maxLevel: 9,

    baseStorageCapacity: 0,

    gardenSeedMaterialId: 'herb-seed',

    // 10 phút/ô — cùng cấp độ thời gian với sản lượng cũ (1 đơn vị/
    // 5 phút cho 1 instance), nhưng giờ tối đa 9 ô chạy song song.
    gardenGrowSeconds: 600,

    gardenYieldMaterialId: 'green-spirit-herb',

    gardenYieldAmount: 2,

    upgradeCost: [
      [{ materialId: 'black-iron', amount: 3 }],
      [{ materialId: 'black-iron', amount: 6 }, { materialId: 'green-spirit-herb', amount: 10 }],
      [{ materialId: 'black-iron', amount: 12 }, { materialId: 'green-spirit-herb', amount: 20 }],
      [{ materialId: 'red-copper', amount: 8 }, { materialId: 'green-spirit-herb', amount: 40 }],
      [{ materialId: 'red-copper', amount: 12 }, { materialId: 'green-spirit-herb', amount: 60 }],
      [{ materialId: 'red-copper', amount: 16 }, { materialId: 'green-spirit-herb', amount: 80 }],
      [{ materialId: 'yeu_dan_qi_refining', amount: 2 }, { materialId: 'green-spirit-herb', amount: 100 }],
      [{ materialId: 'yeu_dan_qi_refining', amount: 4 }, { materialId: 'green-spirit-herb', amount: 120 }],
      [{ materialId: 'yeu_dan_qi_refining', amount: 6 }, { materialId: 'green-spirit-herb', amount: 150 }],
    ],
  },

  // Thay thế Thiết Khoáng Sơn (2026-08-15) — quặng sắt thô (iron-ore)
  // giờ đến từ Khai Thác (exploration), không còn building nào tự sinh
  // ra nó nữa (đúng ý tách "Khai Thác nhặt thô, Lò Luyện tinh luyện").
  // Slot Building này đổi hẳn công dụng: Linh Tuyền tự ngưng tụ Linh
  // Thạch (producesSpiritStone — đổ thẳng player.spiritStone lúc thu
  // hoạch thay vì materialBag, xem BuildingSystem.claim()).
  {
    id: 'linh_tuyen',

    name: 'Linh Tuyền',

    description: 'Mạch linh tuyền tự nhiên, âm thầm ngưng tụ linh khí trời đất thành Linh Thạch theo thời gian.',

    category: 'resource',

    tier: 1,

    maxLevel: 5,

    producesSpiritStone: true,

    // 1 Linh Thạch/phút ở level 1 — dòng thu phụ ổn định, không thay
    // thế nguồn chính (đánh quái/Độ Kiếp vẫn cho nhiều hơn hẳn).
    baseProductionRate: 1 / 60,

    baseStorageCapacity: 60,

    upgradeCost: [
      [{ materialId: 'black-iron', amount: 5 }, { materialId: 'red-copper', amount: 2 }],
      [{ materialId: 'red-copper', amount: 6 }],
      [{ materialId: 'red-copper', amount: 12 }],
      [{ materialId: 'yeu_dan_qi_refining', amount: 4 }],
    ],
  },

  {
    id: 'smelter',

    name: 'Lò Luyện',

    description: 'Nung chảy quặng sắt thô thành Huyền Thiết tinh luyện, tự động chạy liên tục nếu còn quặng.',

    category: 'processing',

    tier: 1,

    maxLevel: 5,

    processingRecipeId: 'iron_ore_smelting',

    // Hệ số tốc độ chuẩn (1 = đúng processingSeconds của recipe).
    baseProcessingSpeed: 1,

    // Sức chứa Huyền Thiết đã luyện xong, chờ thu hoạch.
    baseStorageCapacity: 10,

    requiredRealmId: 'foundation',

    // Phase 10 balancing: tier 4 cùng lý do trên — spirit-silver ->
    // demon-core (đã có ở tier 3, nâng số lượng cho tier 4 leo thang).
    upgradeCost: [
      [{ materialId: 'red-copper', amount: 4 }, { materialId: 'iron-ore', amount: 10 }],
      [{ materialId: 'red-copper', amount: 8 }],
      [{ materialId: 'yeu_dan_qi_refining', amount: 2 }],
      [{ materialId: 'yeu_dan_qi_refining', amount: 5 }],
    ],
  },

  // Thiên Công Phường (2026-08-15) — chuỗi Processing thứ 2, cùng
  // khuôn iron_mine cũ/smelter: Mộc Lâm (exploration, xem
  // data/exploration/explorations.ts) tự sinh thanh-linh-moc, building
  // này tự tiêu thụ theo thời gian thực để ra phu-chi — nguyên liệu
  // TRỰC TIẾP của recipe_slot_expansion_talisman (xem data/recipe/
  // recipes.ts). Không set requiredRealmId — recipe nó phục vụ cũng
  // không gate cảnh giới, khoá building này sẽ softlock chế Phù sớm.
  {
    id: 'thien_cong_phuong',

    name: 'Thiên Công Phường',

    description: 'Xưởng xử lý Linh Mộc thành Phù Chỉ, tự động chạy liên tục nếu còn nguyên liệu.',

    category: 'processing',

    tier: 1,

    maxLevel: 5,

    processingRecipeId: 'linh_moc_processing',

    baseProcessingSpeed: 1,

    baseStorageCapacity: 10,

    upgradeCost: [
      [{ materialId: 'thanh-linh-moc', amount: 5 }, { materialId: 'black-iron', amount: 3 }],
      [{ materialId: 'thanh-linh-moc', amount: 10 }],
      [{ materialId: 'red-copper', amount: 6 }],
      [{ materialId: 'yeu_dan_qi_refining', amount: 3 }],
    ],
  },

  // BUILDing spec — 4 building crafting_station, khoá Tứ Nghệ (Đan
  // Phòng/Trận Đài/Phù Viện/Khí Đường) sau bước Construction thật
  // (trước đây 4 panel này mở miễn phí từ đầu game, xem
  // BuildingConstructionGate.vue). Cost hiệu chỉnh theo nhịp độ 7 ngày
  // đã tune ở Phase 1 (beta roadmap mục VIII): Khí Đường là phụ thuộc
  // Ngày 1-2 (Equipment) nên cost gần như miễn phí; 3 building còn lại
  // là phụ thuộc Ngày 3-5 (Building/Đan) nên cost nhỉnh hơn 1 chút
  // nhưng vẫn rẻ hơn nhiều lần so với 1 lượt craft đầu tiên của chính
  // building đó (xem data/recipe/recipes.ts — recipe rẻ nhất đã cần
  // 2 Thanh Linh Thảo). `levels` dùng chung 3 loại effect đã build
  // plumbing thật (craft_time_reduction/craft_quality_bonus/
  // concurrent_job_slots, xem BuildingSystem.getCraftModifiers()) —
  // KHÔNG bịa thêm effect chưa có chỗ tiêu thụ trong code.
  {
    id: 'equipment_hall',

    name: 'Khí Đường',

    description: 'Nơi luyện khí, cường hóa và tinh chỉnh trang bị.',

    category: 'crafting_station',

    tier: 1,

    maxLevel: 5,

    baseStorageCapacity: 0,

    functionType: 'equipment_hall',

    // Ngày 1-2 (Equipment) — gần như miễn phí, không được chặn nhịp độ
    // trang bị đầu game.
    upgradeCost: [
      [{ materialId: 'black-iron', amount: 2 }],
      [{ materialId: 'black-iron', amount: 6 }],
      [{ materialId: 'red-copper', amount: 4 }],
      [{ materialId: 'red-copper', amount: 10 }],
    ],

    levels: [
      { level: 2, effects: [{ kind: 'craft_time_reduction', percent: 10 }], description: '-10% thời gian xử lý' },
      { level: 3, effects: [{ kind: 'concurrent_job_slots', amount: 2 }], description: '+1 job đồng thời' },
      { level: 4, effects: [{ kind: 'craft_quality_bonus', percent: 5 }], description: '+5% cơ hội thành phẩm dư' },
      { level: 5, effects: [{ kind: 'concurrent_job_slots', amount: 3 }], description: '+1 job đồng thời' },
    ],
  },

  {
    id: 'pill_room',

    name: 'Đan Phòng',

    description: 'Lò luyện đan, chế tác đan dược từ linh thảo và khoáng thạch.',

    category: 'crafting_station',

    tier: 1,

    maxLevel: 5,

    baseStorageCapacity: 0,

    functionType: 'pill_room',

    // Ngày 3-5 (Building/Đan) — cao hơn Khí Đường một chút nhưng vẫn
    // rẻ hơn nhiều lần chi phí craft, đạt được trong nhịp thu thập
    // bình thường.
    upgradeCost: [
      [{ materialId: 'green-spirit-herb', amount: 5 }, { materialId: 'black-iron', amount: 3 }],
      [{ materialId: 'green-spirit-herb', amount: 10 }],
      [{ materialId: 'fire-spirit-herb', amount: 6 }],
      [{ materialId: 'cold-spirit-herb', amount: 6 }],
    ],

    levels: [
      { level: 2, effects: [{ kind: 'craft_quality_bonus', percent: 5 }], description: '+5% cơ hội thành phẩm dư' },
      { level: 3, effects: [{ kind: 'craft_time_reduction', percent: 15 }], description: '-15% thời gian luyện đan' },
      { level: 4, effects: [{ kind: 'concurrent_job_slots', amount: 2 }], description: '+1 lò đồng thời' },
      { level: 5, effects: [{ kind: 'concurrent_job_slots', amount: 3 }], description: '+1 lò đồng thời' },
    ],
  },

  {
    id: 'formation_altar',

    name: 'Trận Đài',

    description: 'Đài chế Trận, khắc chế phù văn thành trận pháp gắn trang bị.',

    category: 'crafting_station',

    tier: 1,

    maxLevel: 5,

    baseStorageCapacity: 0,

    functionType: 'formation_altar',

    upgradeCost: [
      [{ materialId: 'black-iron', amount: 5 }, { materialId: 'red-copper', amount: 2 }],
      [{ materialId: 'black-iron', amount: 10 }],
      [{ materialId: 'red-copper', amount: 6 }],
      [{ materialId: 'red-copper', amount: 12 }],
    ],

    levels: [
      { level: 2, effects: [{ kind: 'craft_time_reduction', percent: 10 }], description: '-10% thời gian chế trận' },
      { level: 3, effects: [{ kind: 'concurrent_job_slots', amount: 2 }], description: '+1 trận đồng thời' },
      { level: 4, effects: [{ kind: 'craft_quality_bonus', percent: 5 }], description: '+5% cơ hội thành phẩm dư' },
      { level: 5, effects: [{ kind: 'concurrent_job_slots', amount: 3 }], description: '+1 trận đồng thời' },
    ],
  },

  {
    id: 'talisman_institute',

    name: 'Phù Viện',

    description: 'Viện chế Phù, vẽ chú văn lên linh phù gắn trang bị.',

    category: 'crafting_station',

    tier: 1,

    maxLevel: 5,

    baseStorageCapacity: 0,

    functionType: 'talisman_institute',

    upgradeCost: [
      [{ materialId: 'green-spirit-herb', amount: 5 }, { materialId: 'red-copper', amount: 2 }],
      [{ materialId: 'green-spirit-herb', amount: 10 }],
      [{ materialId: 'fire-spirit-herb', amount: 6 }],
      [{ materialId: 'red-copper', amount: 10 }],
    ],

    levels: [
      { level: 2, effects: [{ kind: 'craft_quality_bonus', percent: 5 }], description: '+5% cơ hội thành phẩm dư' },
      { level: 3, effects: [{ kind: 'craft_time_reduction', percent: 15 }], description: '-15% thời gian chế phù' },
      { level: 4, effects: [{ kind: 'concurrent_job_slots', amount: 2 }], description: '+1 phù đồng thời' },
      { level: 5, effects: [{ kind: 'concurrent_job_slots', amount: 3 }], description: '+1 phù đồng thời' },
    ],
  },

  // Truyền Tống Trận/Khai Thác rework (2026-08-14) — Thám Hiểm (combat,
  // StageSelectPanel.vue) và Tầm Bảo (gather tự động, ExplorationPanel.vue)
  // giờ cũng gate sau 1 Building thật (trước đây mở miễn phí ngay từ
  // đầu game) — dùng LẠI category 'crafting_station' (đúng ngữ nghĩa
  // "click mở thẳng Function UI", canBuild() đã tự enforce 1
  // instance/loại). maxLevel: 1 + KHÔNG set `levels` — 2 Building này
  // là cổng mở khoá 1 lần, không có nấc thang craft modifier nào để
  // nâng cấp (khác 4 building crafting_station kia).
  //
  // `gathering_outpost` (Khai Thác) BẮT BUỘC free (upgradeCost[0] rỗng)
  // — Tầm Bảo là nguồn nguyên liệu DUY NHẤT không cần xây gì trước đó
  // (herb_garden/linh_tuyen đều cần nguyên liệu để xây), khoá nó sau 1
  // chi phí sẽ soft-lock hẳn game mới (không còn đường lấy nguyên liệu
  // đầu tiên). `teleport_array` (Truyền Tống Trận) có thể tính phí nhẹ
  // vì Khai Thác đã đảm bảo có đường ra nguyên liệu trước đó rồi.
  {
    id: 'teleport_array',

    name: 'Truyền Tống Trận',

    description: 'Trận pháp truyền tống dẫn hero đến các Địa Giới xa xôi để khiêu chiến.',

    category: 'crafting_station',

    tier: 1,

    maxLevel: 1,

    baseStorageCapacity: 0,

    functionType: 'stage_select',

    upgradeCost: [
      [{ materialId: 'black-iron', amount: 3 }],
    ],
  },

  {
    id: 'gathering_outpost',

    name: 'Khai Thác',

    description: 'Trạm điều phối các đội tầm bảo đi thu thập nguyên liệu tự động.',

    category: 'crafting_station',

    tier: 1,

    maxLevel: 1,

    baseStorageCapacity: 0,

    functionType: 'exploration',

    upgradeCost: [[]],
  },
]
