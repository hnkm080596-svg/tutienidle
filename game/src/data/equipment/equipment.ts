import type { Equipment, EquipmentStatRange } from '@/core/equipment/Equipment'
import type { EquipmentSlot } from '@/core/equipment/EquipmentTypes'

// Core Loop Foundation checklist (Phase 3, Mục AFFIX) — substatPool cũ
// đã bị XOÁ khỏi Equipment (roll ngẫu nhiên phẳng, không phân loại) —
// dòng phụ giờ đến từ Affix pool CHUNG (data/equipment/affixes.ts),
// lọc theo `slot` của từng template thay vì mỗi template tự khai pool
// riêng. mainStat (Implicit) vẫn giữ nguyên như cũ.

// Naming pass thứ 2 (2026-08-15, cùng ngày với cơ chế Set) — người
// chơi không còn cần đặt tên/mô tả riêng cho từng vật phẩm trong 1
// Set nữa. `createSetEquipment()` sinh đủ 6 template (khớp 6
// EquipmentSlot) từ 1 bảng cấu hình GỌN: mỗi slot chỉ cần 1 TỪ LOẠI
// (vd "Chùy") + 1 mainStat range — tên hiển thị đầy đủ ghép động lúc
// runtime (Phẩm + Set + Địa Giới + từ loại này, xem EquipmentNaming.ts).
// Cost shape dùng CHUNG cho cả 6 slot (khớp bộ cost đầy đủ nhất trong
// 6 item Thái Hư viết tay bên dưới — `thai_hu_sword`) — thêm Set MỚI
// sau này chỉ cần thêm 1 phần tử vào SET_SLOT_CONFIGS, không viết lại
// từng field cost.
function createSetEquipment(
  setId: string,
  description: string,
  slots: { slot: EquipmentSlot; typeName: string; mainStat: EquipmentStatRange }[],
): Equipment[] {
  return slots.map(({ slot, typeName, mainStat }) => ({
    id: `${setId}_${slot}`,

    name: typeName,

    icon: `/assets/equipment/${setId}_${slot}.png`,

    description,

    slot,

    setId,

    grade: 5,

    maxEnhanceLevel: 10,

    requiredRealmId: 'foundation',

    mainStat,

    enhanceCost: [{ materialId: 'bui_cot', amount: 3 }],

    enhanceSpiritStoneCost: 20,

    upgradeQualityCost: [
      { materialId: 'yeu_huyet_qi_refining', amount: 3 },
      { materialId: 'yeu_dan_qi_refining', amount: 3 },
    ],

    upgradeRealmCost: [{ materialId: 'yeu_dan_qi_refining', amount: 2 }],

    addAffixCost: [{ materialId: 'affix_rune_stone', amount: 1 }],

    upgradeAffixCost: [{ materialId: 'affix_tier_stone', amount: 1 }],
  }))
}

// 1 bộ range mainStat DÙNG CHUNG cho mọi Set (đứng ngang hàng nhau,
// không phải bậc thang tiến hoá) — khớp ĐÚNG range đã dùng cho 6 item
// Thái Hư viết tay bên dưới, chỉ đổi `stat` theo slot.
const SET_MAIN_STAT: Record<EquipmentSlot, EquipmentStatRange> = {
  weapon: { stat: 'attack', min: 24, max: 38 },
  helmet: { stat: 'defense', min: 18, max: 28 },
  armor: { stat: 'defense', min: 22, max: 34 },
  boots: { stat: 'movementSpeed', min: 10, max: 18 },
  ring: { stat: 'criticalRate', min: 0.03, max: 0.06 },
  necklace: { stat: 'maxHp', min: 28, max: 42 },
}

function slotConfigs(typeNames: Record<EquipmentSlot, string>) {
  return (Object.keys(typeNames) as EquipmentSlot[]).map(slot => ({
    slot,
    typeName: typeNames[slot],
    mainStat: SET_MAIN_STAT[slot],
  }))
}

// 5 Set còn lại (2026-08-15) — 1/Pháp Tu Ngũ Hành (xem
// data/equipment/equipmentSets.ts's metadata: tên vị thần/màu/bonus
// 2-4-6 món). Từ loại mỗi Set chọn theo cảm quan nguyên tố, ưu tiên
// KHÔNG trùng nhau ở vũ khí/giáp (2 slot người chơi thấy rõ nhất) —
// mũ/giày/nhẫn/dây chuyền chấp nhận trùng 1-2 chỗ, không phải trọng
// tâm đa dạng hoá.
const generatedSetEquipment: Equipment[] = [
  ...createSetEquipment(
    'hau_tho',
    'Trang bị bộ Hậu Thổ, mang hậu trọng khí tức của đại địa.',
    slotConfigs({ weapon: 'Chùy', helmet: 'Khôi', armor: 'Khải', boots: 'Ủng', ring: 'Hoàn', necklace: 'Phối' }),
  ),

  ...createSetEquipment(
    'cau_mang',
    'Trang bị bộ Câu Mang, thấm đẫm sinh cơ của mộc mầm xuân sinh.',
    slotConfigs({ weapon: 'Trượng', helmet: 'Đai', armor: 'Bào', boots: 'Hài', ring: 'Chỉ', necklace: 'Chuỗi' }),
  ),

  ...createSetEquipment(
    'chuc_dung',
    'Trang bị bộ Chúc Dung, rực cháy uy thế của chân hỏa Nam Phương.',
    slotConfigs({ weapon: 'Đao', helmet: 'Mão', armor: 'Sam', boots: 'Hia', ring: 'Nhẫn', necklace: 'Anh' }),
  ),

  ...createSetEquipment(
    'nhuc_thu',
    'Trang bị bộ Nhục Thu, ẩn tàng sát khí lãnh liệt của kim thu Tây Phương.',
    slotConfigs({ weapon: 'Trảo', helmet: 'Trụ', armor: 'Y', boots: 'Ủng', ring: 'Khuyên', necklace: 'Toả' }),
  ),

  ...createSetEquipment(
    'huyen_minh',
    'Trang bị bộ Huyền Minh, u thẳm như đáy vực Bắc Minh.',
    slotConfigs({ weapon: 'Tiên', helmet: 'Cân', armor: 'Cừu', boots: 'Lý', ring: 'Hoàn', necklace: 'Chuỗi' }),
  ),
]

export const equipment: Equipment[] = [
  {
    id: 'iron_sword',

    name: 'Thiết Kiếm',

    icon: '/assets/equipment/iron_sword.png',

    description: 'Trường kiếm rèn từ Huyền Thiết, sắc bén vừa phải.',

    slot: 'weapon',

    grade: 1,

    maxEnhanceLevel: 10,

    mainStat: {
      stat: 'attack',

      min: 10,

      max: 20,
    },

    // "tunghematandsuch" pass (2026-08-14) — Cường Hóa giờ tốn Bụi Cốt
    // (phế liệu từ Luyện Khí, xem GameManager.smeltEquipment()) + Linh
    // Thạch (enhanceSpiritStoneCost) thay vì nguyên liệu thô trực
    // tiếp — đúng vòng "Khai thác → Luyện Khí → phế liệu → Cường Hóa".
    enhanceCost: [
      {
        materialId: 'bui_cot',

        amount: 2,
      },
    ],

    enhanceSpiritStoneCost: 5,

    // Beta Phase 3 (Gameplay Loop) — 4 thao tác trước đây KHÔNG có
    // cost data (mặc định miễn phí qua fallback `?? []` trong
    // EquipmentSystem.ts), khiến 4/7 thao tác Khí Đường vô nghĩa về
    // kinh tế. Số liệu khởi điểm, cần tinh chỉnh qua playtest.
    washCost: [
      {
        materialId: 'green-spirit-herb',

        amount: 2,
      },
    ],

    refineCost: [
      {
        materialId: 'red-copper',

        amount: 2,
      },
    ],

    upgradeQualityCost: [
      {
        materialId: 'yeu_huyet_qi_refining',

        amount: 2,
      },

      {
        materialId: 'yeu_dan_qi_refining',

        amount: 2,
      },
    ],

    upgradeRealmCost: [
      {
        materialId: 'yeu_dan_qi_refining',

        amount: 1,
      },
    ],

    // Core Loop Foundation checklist (Phase 4, Mục CRAFTING) — chi
    // phí Thêm Dòng/Nâng Cấp Dòng Affix.
    addAffixCost: [
      {
        materialId: 'affix_rune_stone',

        amount: 1,
      },
    ],

    upgradeAffixCost: [
      {
        materialId: 'affix_tier_stone',

        amount: 1,
      },
    ],
  },

  {
    id: 'spirit_silver_armor',

    name: 'Tinh Ngân Giáp',

    icon: '/assets/equipment/spirit_silver_armor.png',

    description: 'Giáp trụ luyện từ Tinh Ngân, phòng ngự vững chắc.',

    slot: 'armor',

    grade: 3,

    maxEnhanceLevel: 10,

    // Level requirement (checklist Equipment Base, Phase 1) — món đồ
    // cao cấp hơn, chỉ trang bị được từ Trúc Cơ trở lên.
    requiredRealmId: 'foundation',

    mainStat: {
      stat: 'defense',

      min: 15,

      max: 25,
    },

    enhanceCost: [
      {
        materialId: 'bui_cot',

        amount: 3,
      },
    ],

    enhanceSpiritStoneCost: 15,

    addAffixCost: [
      {
        materialId: 'affix_rune_stone',

        amount: 1,
      },
    ],

    upgradeAffixCost: [
      {
        materialId: 'affix_tier_stone',

        amount: 1,
      },
    ],
  },

  // Luyện Khí tầng 1-10 content pass (2026-08-14) — 4 template MỚI,
  // đúng 1 cho mỗi slot còn trống (helmet/boots/ring/necklace — trước
  // đây chỉ có weapon/armor). requiredRealmId 'qi_refining' (mở ngay
  // từ đầu, Equipment không có gate theo tầng — xem Building.ts's
  // BuildingFunctionType note tương tự). Rơi từ 1 Boss mới tương ứng
  // (data/enemy/Enemies.ts's bossRewards), cùng chance 0.4 — nhỉnh hơn
  // iron_sword-trên-bandit (0.5) một chút vì đây là slot phụ, không
  // phải vũ khí chính.
  {
    id: 'magma_boar_helm',

    name: 'Nham Trư Giáp Trụ',

    icon: '/assets/equipment/magma_boar_helm.png',

    description: 'Mũ giáp rèn từ ngà và khoáng nham thạch của Nham Trư, chịu nhiệt tốt.',

    slot: 'helmet',

    grade: 3,

    maxEnhanceLevel: 10,

    requiredRealmId: 'qi_refining',

    mainStat: {
      stat: 'defense',

      min: 12,

      max: 20,
    },

    enhanceCost: [
      {
        materialId: 'bui_cot',

        amount: 2,
      },
    ],

    enhanceSpiritStoneCost: 10,

    upgradeQualityCost: [
      {
        materialId: 'yeu_dan_qi_refining',

        amount: 2,
      },
    ],

    addAffixCost: [
      {
        materialId: 'affix_rune_stone',

        amount: 1,
      },
    ],

    upgradeAffixCost: [
      {
        materialId: 'affix_tier_stone',

        amount: 1,
      },
    ],
  },

  {
    id: 'sand_lynx_boots',

    name: 'Sa Miêu Ngoa',

    icon: '/assets/equipment/sand_lynx_boots.png',

    description: 'Giày da Sa Miêu nhẹ và bền, giúp bước chân nhanh nhẹn hơn.',

    slot: 'boots',

    grade: 3,

    maxEnhanceLevel: 10,

    requiredRealmId: 'qi_refining',

    mainStat: {
      stat: 'movementSpeed',

      min: 8,

      max: 15,
    },

    enhanceCost: [
      {
        materialId: 'bui_cot',

        amount: 2,
      },
    ],

    enhanceSpiritStoneCost: 10,

    addAffixCost: [
      {
        materialId: 'affix_rune_stone',

        amount: 1,
      },
    ],

    upgradeAffixCost: [
      {
        materialId: 'affix_tier_stone',

        amount: 1,
      },
    ],
  },

  {
    id: 'blade_edge_ring',

    name: 'Đoạn Nhận Giới',

    icon: '/assets/equipment/blade_edge_ring.png',

    description: 'Nhẫn khắc từ vuốt Đoạn Nhận Ưng, mài sắc từng đòn công kích.',

    slot: 'ring',

    grade: 3,

    maxEnhanceLevel: 10,

    requiredRealmId: 'qi_refining',

    mainStat: {
      stat: 'criticalRate',

      min: 0.02,

      max: 0.05,
    },

    enhanceCost: [
      {
        materialId: 'bui_cot',

        amount: 2,
      },
    ],

    enhanceSpiritStoneCost: 10,

    addAffixCost: [
      {
        materialId: 'affix_rune_stone',

        amount: 1,
      },
    ],

    upgradeAffixCost: [
      {
        materialId: 'affix_tier_stone',

        amount: 1,
      },
    ],
  },

  {
    id: 'flood_serpent_necklace',

    name: 'Giao Xà Uyên',

    icon: '/assets/equipment/flood_serpent_necklace.png',

    description: 'Vòng cổ nạm vảy Giao Xà, tích tụ Thủy khí sâu thẳm của vùng Thanh Vân.',

    slot: 'necklace',

    grade: 4,

    maxEnhanceLevel: 10,

    requiredRealmId: 'qi_refining',

    mainStat: {
      stat: 'maxHp',

      min: 20,

      max: 35,
    },

    enhanceCost: [
      {
        materialId: 'bui_cot',

        amount: 3,
      },
    ],

    enhanceSpiritStoneCost: 15,

    upgradeQualityCost: [
      {
        materialId: 'yeu_cot_qi_refining',

        amount: 1,
      },
    ],

    addAffixCost: [
      {
        materialId: 'affix_rune_stone',

        amount: 1,
      },
    ],

    upgradeAffixCost: [
      {
        materialId: 'affix_tier_stone',

        amount: 2,
      },
    ],
  },

  // Cơ chế Set (2026-08-15) — 6 bộ Set, mỗi bộ khớp đủ 6 EquipmentSlot,
  // 1 bộ/Pháp Tu (xem data/equipment/equipmentSets.ts). Naming pass thứ
  // 2 (cùng ngày) — KHÔNG còn đặt tên riêng cho từng vật phẩm nữa,
  // `name` giờ chỉ còn ĐÚNG 1 TỪ LOẠI (vd "Kiếm"/"Chùy"/"Trượng"), tên
  // hiển thị đầy đủ ghép động HOÀN TOÀN từ Phẩm + Set + Địa Giới +
  // từ loại này lúc runtime (xem EquipmentNaming.ts) — người chơi chỉ
  // cần thêm 1 từ loại mới khi muốn đa dạng hoá vũ khí/giáp, không cần
  // nghĩ tên riêng từng món. requiredRealmId 'foundation' (Trúc Cơ) +
  // mainStat nhỉnh hơn bộ cao nhất trước đó (spirit_silver_armor
  // defense 15-25, flood_serpent_necklace maxHp 20-35) — DÙNG CHUNG 1
  // bộ range cho cả 6 Set (đứng ngang hàng nhau, không phải bậc thang
  // tiến hóa) — số liệu khởi điểm, tinh chỉnh qua playtest. Description
  // dùng CHUNG 1 câu/Set (không viết riêng từng món) — đúng tinh thần
  // giảm effort đặt tên/mô tả thủ công.
  {
    id: 'thai_hu_sword',

    name: 'Kiếm',

    icon: '/assets/equipment/thai_hu_sword.png',

    description: 'Trang bị bộ Thái Hư, phảng phất hư vô của kiếm đạo tối cao.',

    slot: 'weapon',

    setId: 'thai_hu',

    grade: 5,

    maxEnhanceLevel: 10,

    requiredRealmId: 'foundation',

    mainStat: {
      stat: 'attack',

      min: 24,

      max: 38,
    },

    enhanceCost: [
      {
        materialId: 'bui_cot',

        amount: 3,
      },
    ],

    enhanceSpiritStoneCost: 20,

    washCost: [
      {
        materialId: 'green-spirit-herb',

        amount: 2,
      },
    ],

    refineCost: [
      {
        materialId: 'red-copper',

        amount: 2,
      },
    ],

    upgradeQualityCost: [
      {
        materialId: 'yeu_huyet_qi_refining',

        amount: 3,
      },

      {
        materialId: 'yeu_dan_qi_refining',

        amount: 3,
      },
    ],

    upgradeRealmCost: [
      {
        materialId: 'yeu_dan_qi_refining',

        amount: 2,
      },
    ],

    addAffixCost: [
      {
        materialId: 'affix_rune_stone',

        amount: 1,
      },
    ],

    upgradeAffixCost: [
      {
        materialId: 'affix_tier_stone',

        amount: 1,
      },
    ],
  },

  {
    id: 'thai_hu_helm',

    name: 'Quan',

    icon: '/assets/equipment/thai_hu_helm.png',

    description: 'Trang bị bộ Thái Hư, phảng phất hư vô của kiếm đạo tối cao.',

    slot: 'helmet',

    setId: 'thai_hu',

    grade: 5,

    maxEnhanceLevel: 10,

    requiredRealmId: 'foundation',

    mainStat: {
      stat: 'defense',

      min: 18,

      max: 28,
    },

    enhanceCost: [
      {
        materialId: 'bui_cot',

        amount: 3,
      },
    ],

    enhanceSpiritStoneCost: 20,

    upgradeQualityCost: [
      {
        materialId: 'yeu_dan_qi_refining',

        amount: 3,
      },
    ],

    addAffixCost: [
      {
        materialId: 'affix_rune_stone',

        amount: 1,
      },
    ],

    upgradeAffixCost: [
      {
        materialId: 'affix_tier_stone',

        amount: 1,
      },
    ],
  },

  {
    id: 'thai_hu_armor',

    name: 'Giáp',

    icon: '/assets/equipment/thai_hu_armor.png',

    description: 'Trang bị bộ Thái Hư, phảng phất hư vô của kiếm đạo tối cao.',

    slot: 'armor',

    setId: 'thai_hu',

    grade: 5,

    maxEnhanceLevel: 10,

    requiredRealmId: 'foundation',

    mainStat: {
      stat: 'defense',

      min: 22,

      max: 34,
    },

    enhanceCost: [
      {
        materialId: 'bui_cot',

        amount: 3,
      },
    ],

    enhanceSpiritStoneCost: 20,

    addAffixCost: [
      {
        materialId: 'affix_rune_stone',

        amount: 1,
      },
    ],

    upgradeAffixCost: [
      {
        materialId: 'affix_tier_stone',

        amount: 1,
      },
    ],
  },

  {
    id: 'thai_hu_boots',

    name: 'Ngoa',

    icon: '/assets/equipment/thai_hu_boots.png',

    description: 'Trang bị bộ Thái Hư, phảng phất hư vô của kiếm đạo tối cao.',

    slot: 'boots',

    setId: 'thai_hu',

    grade: 5,

    maxEnhanceLevel: 10,

    requiredRealmId: 'foundation',

    mainStat: {
      stat: 'movementSpeed',

      min: 10,

      max: 18,
    },

    enhanceCost: [
      {
        materialId: 'bui_cot',

        amount: 3,
      },
    ],

    enhanceSpiritStoneCost: 20,

    addAffixCost: [
      {
        materialId: 'affix_rune_stone',

        amount: 1,
      },
    ],

    upgradeAffixCost: [
      {
        materialId: 'affix_tier_stone',

        amount: 1,
      },
    ],
  },

  {
    id: 'thai_hu_ring',

    name: 'Giới',

    icon: '/assets/equipment/thai_hu_ring.png',

    description: 'Trang bị bộ Thái Hư, phảng phất hư vô của kiếm đạo tối cao.',

    slot: 'ring',

    setId: 'thai_hu',

    grade: 5,

    maxEnhanceLevel: 10,

    requiredRealmId: 'foundation',

    mainStat: {
      stat: 'criticalRate',

      min: 0.03,

      max: 0.06,
    },

    enhanceCost: [
      {
        materialId: 'bui_cot',

        amount: 3,
      },
    ],

    enhanceSpiritStoneCost: 20,

    addAffixCost: [
      {
        materialId: 'affix_rune_stone',

        amount: 1,
      },
    ],

    upgradeAffixCost: [
      {
        materialId: 'affix_tier_stone',

        amount: 1,
      },
    ],
  },

  {
    id: 'thai_hu_necklace',

    name: 'Bội',

    icon: '/assets/equipment/thai_hu_necklace.png',

    description: 'Trang bị bộ Thái Hư, phảng phất hư vô của kiếm đạo tối cao.',

    slot: 'necklace',

    setId: 'thai_hu',

    grade: 5,

    maxEnhanceLevel: 10,

    requiredRealmId: 'foundation',

    mainStat: {
      stat: 'maxHp',

      min: 28,

      max: 42,
    },

    enhanceCost: [
      {
        materialId: 'bui_cot',

        amount: 3,
      },
    ],

    enhanceSpiritStoneCost: 20,

    upgradeQualityCost: [
      {
        materialId: 'yeu_cot_qi_refining',

        amount: 2,
      },
    ],

    addAffixCost: [
      {
        materialId: 'affix_rune_stone',

        amount: 1,
      },
    ],

    upgradeAffixCost: [
      {
        materialId: 'affix_tier_stone',

        amount: 2,
      },
    ],
  },

  ...generatedSetEquipment,
]
