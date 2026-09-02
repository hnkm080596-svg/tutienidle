import type { Building } from '@/core/building/Building'
import type { BuildingLevelDef } from '@/core/building/BuildingLevelEffect'
import { SPIRIT_STONE_MATERIAL_ID } from '@/core/material/SpiritStoneMaterial'
import { REALM_TIERS, getRealmIdForTier } from '@/core/realm/RealmTierMap'

const QUALITY_BY_TIER = ['hoang', 'hoang', 'huyen', 'huyen', 'dia', 'dia', 'thien', 'thien', 'tien'] as const

function extendCosts(firstThree: Building['upgradeCost'], baseAmount: number): Building['upgradeCost'] {
  const future = REALM_TIERS.slice(3).map((_, offset) => {
    const tier = offset + 4
    const realmId = getRealmIdForTier(tier)
    const quality = QUALITY_BY_TIER[tier - 1]!
    const amount = Math.round(baseAmount * Math.pow(1.65, tier - 3))
    return [
      { materialId: `${realmId}_wood_${quality}`, amount },
      { materialId: `${realmId}_ore_${quality}`, amount: Math.max(1, Math.round(amount / 2)) },
    ]
  })
  return [...firstThree, ...future]
}

// W5 (2026-08-27) — repurpose building levels:
// - Khí Đường: mỗi cấp từ 2 trở đi giảm 3% chi phí Cường Hóa/Tẩy
//   Luyện/Tinh Luyện (trần 24% ở level 9).
// - Đan Phòng: level 3/6/9 mở thêm 1 slot luyện đan đồng thời
//   (baseline 1 slot, trần 4 slot).
function equipmentHallLevels(): BuildingLevelDef[] {
  return Array.from({ length: 9 }, (_, index) => {
    const level = index + 1

    return {
      level,
      effects: level === 1 ? [] : [{ kind: 'equipment_cost_discount', percent: 3 }],
      description: level === 1 ? undefined : `Giảm ${3 * (level - 1)}% chi phí Khí Đường`,
    }
  })
}

function pillRoomLevels(): BuildingLevelDef[] {
  return Array.from({ length: 9 }, (_, index) => {
    const level = index + 1
    const grantsSlot = level === 3 || level === 6 || level === 9

    return {
      level,
      effects: grantsSlot ? [{ kind: 'concurrent_job_slots', amount: 1 }] : [],
      description: grantsSlot ? '+1 slot luyện đan đồng thời' : undefined,
    }
  })
}

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
  // Khai Vật Đường — gate Sản Xuất + LINH MẠCH (chi-hien-quan spec
  // 2026-09-02): chức năng ngưng tụ Linh Thạch của Linh Tuyền (đã xóa)
  // chuyển vào đây — cùng engine rate/storage, truy vấn qua
  // BuildingSystem conditions theo id 'gathering_outpost'.
  {
    id: 'gathering_outpost',

    name: 'Khai Vật Đường',

    description:
      'Quản lý nhân công khai thác Lâm, Quáng và Động Thiên trên mọi địa giới. Dưới nền chảy linh mạch ngầm, âm thầm ngưng tụ Linh Thạch.',

    category: 'crafting_station',

    tier: 1,

    maxLevel: 9,

    // Linh mạch — engine thạch offline cũ của Linh Tuyền (rate scale
    // theo realm trong BuildingSystem, level max ≈ 5% farm online).
    producesMaterialId: SPIRIT_STONE_MATERIAL_ID,

    baseProductionRate: 5.5 / 60 / 2.6,

    baseStorageCapacity: 100,

    functionType: 'exploration',

    upgradeCost: extendCosts([
      [],
      [{ materialId: 'qi_refining_wood', amount: 4 }],
      [{ materialId: 'foundation_establishment_wood', amount: 6 }],
    ], 4),
  },

  // Khí Đường — gate + nâng cấp bốn operation (Cường Hóa/Tẩy Luyện/
  // Tinh Luyện/Hóa Luyện, plan §7).
  {
    id: 'equipment_hall',

    name: 'Khí Đường',

    description: 'Nơi luyện khí, cường hóa và tinh chỉnh trang bị.',

    category: 'crafting_station',

    tier: 1,

    maxLevel: 9,

    baseStorageCapacity: 0,

    functionType: 'equipment_hall',

    // Ngày 1-2 (Equipment) — gần như miễn phí, không được chặn nhịp độ
    // trang bị đầu game.
    upgradeCost: extendCosts([
      [{ materialId: 'mortal_wood', amount: 3 }],
      [
        { materialId: 'qi_refining_wood', amount: 6 },
        { materialId: 'qi_refining_ore_hoang', amount: 3 },
      ],
      [{ materialId: 'foundation_establishment_wood', amount: 4 }],
    ], 5),

    levels: equipmentHallLevels(),
  },

  // Đan Phòng — gate luyện đan (alchemy jobs, plan §8); level quyết
  // định speed/success bonus riêng (xem core/alchemy/AlchemyBalance.ts).
  {
    id: 'pill_room',

    name: 'Đan Phòng',

    description: 'Lò luyện đan, chế tác đan dược từ linh thảo, gỗ nhiên liệu và linh thạch.',

    category: 'crafting_station',

    tier: 1,

    maxLevel: 9,

    baseStorageCapacity: 0,

    functionType: 'pill_room',

    // Ngày 3-5 (Đan) — cao hơn Khí Đường một chút nhưng vẫn rẻ hơn nhiều
    // lần chi phí luyện đan.
    upgradeCost: extendCosts([
      [
        { materialId: 'mortal_wood', amount: 5 },
        { materialId: 'mortal_ore_hoang', amount: 2 },
      ],
      [{ materialId: 'qi_refining_wood', amount: 5 }],
      [{ materialId: 'foundation_establishment_wood', amount: 9 }],
    ], 7),

    levels: pillRoomLevels(),
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

  // Ký Bảo Các — building CHUYÊN cho mọi cơ chế "đổi/bán" (2026-08-30,
  // bug report: exchange bị nhét nhầm vào Linh Tuyền/Sản Xuất — building
  // không chuyên). Gộp Hóa Bán (VendorSystem) + quy đổi phẩm Linh Thạch +
  // quy đổi cảnh giới nguyên liệu (xem VendorPanel.vue). Không có tiến
  // trình nâng cấp ý nghĩa (vendor không "mạnh hơn" theo cấp) nên
  // maxLevel: 1, giống Truyền Tống Trận.
  {
    id: 'vendor',

    name: 'Ký Bảo Các',

    description: 'Nơi trao đổi nguyên liệu dư thừa và quy đổi phẩm cấp Linh Thạch/nguyên liệu.',

    category: 'crafting_station',

    tier: 1,

    maxLevel: 1,

    baseStorageCapacity: 0,

    functionType: 'vendor',

    upgradeCost: [[{ materialId: 'mortal_wood', amount: 3 }]],
  },

  // Chiêu Hiền Quán (chi-hien-quan spec 2026-09-02) — NGUỒN NHÂN CÔNG
  // DUY NHẤT: capacity = 1 + level × 2 (getWorkerCapacityForLevel trong
  // core/production/WorkerCapacity.ts). Cost bands khởi điểm — tuning
  // sau playtest.
  {
    id: 'chi_hien_quan',

    name: 'Chiêu Hiền Quán',

    description:
      'Nơi chiêu nạp và quản lý nhân công khai thác toàn cục. Cấp càng cao, càng nhiều hiền sĩ theo về.',

    category: 'crafting_station',

    tier: 1,

    maxLevel: 9,

    baseStorageCapacity: 0,

    functionType: 'worker_lodge',

    upgradeCost: extendCosts([
      [],
      [{ materialId: 'mortal_ore_hoang', amount: 4 }],
      [{ materialId: 'qi_refining_wood', amount: 6 }],
    ], 4),
  },
]
