import type { Building } from '@/core/building/Building'
import { SPIRIT_STONE_MATERIAL_ID } from '@/core/material/SpiritStoneMaterial'

// Buildings (2026-08-25, resource-professions-rework plan §2) — vòng
// sản xuất KHÔNG còn building trung gian: herb_garden (Linh Thảo
// Viên), smelter (Lò Luyện), artisan_workshop (Thiên Công Phường),
// formation_altar (Trận Đài), talisman_institute (Phù Viện) đã bị loại
// bỏ. Nguyên liệu đến thẳng từ ProductionSite (core/production).
//
// Chi phí xây/nâng dùng GỖ từ Thanh Vân Lâm (`<realm>_wood`) + nguyên
// liệu khác — sink chính của Lâm (plan §5.2). Tàng Kinh Các KHÔNG phải
// building (dong-fu-command-wheel plan Workstream C).
export const buildings: Building[] = [
  // Linh Tuyền — dòng Linh Thạch thu phụ ổn định (producesMaterialId,
  // thu hoạch đổ vào MaterialBag như material bình thường, plan
  // Workstream F; xem BuildingSystem.claim()).
  {
    id: 'spirit_spring',

    name: 'Linh Tuyền',

    description:
      'Mạch linh tuyền tự nhiên, âm thầm ngưng tụ linh khí trời đất thành Linh Thạch theo thời gian.',

    category: 'resource',

    tier: 1,

    maxLevel: 5,

    producesMaterialId: SPIRIT_STONE_MATERIAL_ID,

    // 1 Linh Thạch/phút ở level 1 — dòng thu phụ ổn định.
    baseProductionRate: 1 / 60,

    baseStorageCapacity: 60,

    functionType: 'spirit_spring',

    upgradeCost: [
      [
        { materialId: 'mortal_wood', amount: 5 },
        { materialId: 'mortal_ore_hoang', amount: 2 },
      ],
      [{ materialId: 'qi_refining_wood', amount: 4 }],
      [{ materialId: 'qi_refining_wood', amount: 8 }],
      [{ materialId: 'foundation_establishment_wood', amount: 4 }],
    ],
  },

  // Khí Đường — gate + nâng cấp bốn operation (Cường Hóa/Tẩy Luyện/
  // Tinh Luyện/Hóa Luyện, plan §7).
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
      [{ materialId: 'mortal_wood', amount: 3 }],
      [
        { materialId: 'mortal_wood', amount: 6 },
        { materialId: 'mortal_ore_hoang', amount: 3 },
      ],
      [{ materialId: 'qi_refining_wood', amount: 4 }],
      [{ materialId: 'foundation_establishment_wood', amount: 3 }],
    ],

    levels: [
      {
        level: 2,
        effects: [{ kind: 'craft_time_reduction', percent: 10 }],
        description: '-10% thời gian xử lý',
      },
      {
        level: 3,
        effects: [{ kind: 'craft_quality_bonus', percent: 5 }],
        description: '+5% cơ hội thành phẩm dư',
      },
      {
        level: 4,
        effects: [{ kind: 'craft_time_reduction', percent: 10 }],
        description: '-10% thời gian xử lý',
      },
      {
        level: 5,
        effects: [{ kind: 'craft_quality_bonus', percent: 5 }],
        description: '+5% cơ hội thành phẩm dư',
      },
    ],
  },

  // Đan Phòng — gate luyện đan (alchemy jobs, plan §8); level quyết
  // định speed/success bonus riêng (xem core/alchemy/AlchemyBalance.ts).
  {
    id: 'pill_room',

    name: 'Đan Phòng',

    description: 'Lò luyện đan, chế tác đan dược từ linh thảo, gỗ nhiên liệu và linh thạch.',

    category: 'crafting_station',

    tier: 1,

    maxLevel: 5,

    baseStorageCapacity: 0,

    functionType: 'pill_room',

    // Ngày 3-5 (Đan) — cao hơn Khí Đường một chút nhưng vẫn rẻ hơn nhiều
    // lần chi phí luyện đan.
    upgradeCost: [
      [
        { materialId: 'mortal_wood', amount: 5 },
        { materialId: 'mortal_ore_hoang', amount: 2 },
      ],
      [{ materialId: 'qi_refining_wood', amount: 5 }],
      [{ materialId: 'qi_refining_wood', amount: 9 }],
      [{ materialId: 'foundation_establishment_wood', amount: 5 }],
    ],

    levels: [
      {
        level: 2,
        effects: [{ kind: 'craft_quality_bonus', percent: 5 }],
        description: '+5% tỷ lệ thành đan',
      },
      {
        level: 3,
        effects: [{ kind: 'craft_time_reduction', percent: 15 }],
        description: '-15% thời gian luyện đan',
      },
      {
        level: 4,
        effects: [{ kind: 'craft_quality_bonus', percent: 5 }],
        description: '+5% tỷ lệ thành đan',
      },
      {
        level: 5,
        effects: [{ kind: 'craft_quality_bonus', percent: 5 }],
        description: '+5% tỷ lệ thành đan',
      },
    ],
  },

  // Truyền Tống Trận — gate Thám Hiểm (combat stage select).
  {
    id: 'teleport_array',

    name: 'Truyền Tống Trận',

    description: 'Trận pháp truyền tống dẫn hero đến các Địa Giới xa xôi để khiêu chiến.',

    category: 'crafting_station',

    tier: 1,

    maxLevel: 1,

    baseStorageCapacity: 0,

    functionType: 'stage_select',

    upgradeCost: [[{ materialId: 'mortal_wood', amount: 3 }]],
  },

  // Sản Xuất — gate panel ba nguồn Lâm/Quáng/Động Thiên; BẮT BUỘC free
  // vì đây là nguồn nguyên liệu DUY NHẤT đầu game.
  {
    id: 'gathering_outpost',

    name: 'Sản Xuất',

    description: 'Trạm điều phối khai thác Lâm, Quáng và Động Thiên của Địa Giới Thanh Vân.',

    category: 'crafting_station',

    tier: 1,

    maxLevel: 1,

    baseStorageCapacity: 0,

    functionType: 'exploration',

    upgradeCost: [[]],
  },
]
