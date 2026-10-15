import type { Building } from '@/core/building/Building'
import type { BuildingLevelDef } from '@/core/building/BuildingLevelEffect'
import { SPIRIT_STONE_MATERIAL_ID } from '@/core/material/SpiritStoneMaterial'
import { REALM_TIERS, getRealmIdForTier } from '@/core/realm/RealmTierMap'
import { buildProfessionMaterialId } from '@/core/profession/ProfessionMaterial'
import { productionUpgradeStoneCost } from '@/core/economy/EconomyRealmPace'

// gp123 6E (task C2): thang tuoi go/khoang theo tier - dung truc tuoi
// thong nhat (decade..thuong_co) thay hau to pham hoang..tien cu.
const AGE_BY_TIER: Record<number, 'decade' | 'century' | 'millennium' | 'myriad_year' | 'thuong_co'> = {
  1: 'decade',
  2: 'decade',
  3: 'century',
  4: 'century',
  5: 'millennium',
  6: 'millennium',
  7: 'myriad_year',
  8: 'myriad_year',
  9: 'thuong_co',
}

function extendCosts(firstThree: Building['upgradeCost'], baseAmount: number): Building['upgradeCost'] {
  const future = REALM_TIERS.slice(3).map((_, offset) => {
    const tier = offset + 4
    const realmId = getRealmIdForTier(tier)
    const age = AGE_BY_TIER[tier]!
    const amount = Math.round(baseAmount * Math.pow(1.65, tier - 3))
    return [
      { materialId: buildProfessionMaterialId('wood', age), amount },
      { materialId: buildProfessionMaterialId('ore', age), amount: Math.max(1, Math.round(amount / 2)) },
    ]
  })
  return [...firstThree, ...future]
}

function craftingUpgradeCosts(costs: Building['upgradeCost'], addOre = false): Building['upgradeCost'] {
  return costs.map((materials, index) => {
    const realmId = REALM_TIERS[index]!
    // Row zero is unused; row one is the first live upgrade quote.
    const result = [...materials, { materialId: SPIRIT_STONE_MATERIAL_ID, amount: productionUpgradeStoneCost(Math.max(0, index - 1), realmId) }]
    const wood = materials.find(cost => cost.materialId.includes('_wood_'))
    if (addOre && wood && !materials.some(cost => cost.materialId.includes('_ore_'))) {
      result.push({ materialId: wood.materialId.replace('_wood_', '_ore_'), amount: Math.ceil(wood.amount / 2) })
    }
    return result
  })
}

// W5 (2026-08-27) - repurpose building levels:
// - Khi Duong: moi cap tu 2 tro di giam 3% chi phi Cuong Hoa/Tay
//   Luyen/Tinh Luyen (tran 24% o level 9).
// - Alchemy has one kiln and three additional waiting slots per level.
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
  return Array.from({ length: 9 }, (_, index) => ({
    level: index + 1,
    effects: [{ kind: 'alchemy_queue_slots', amount: 3 }],
  }))
}

// Buildings (2026-08-25, resource-professions-rework plan sec2) - vong
// san xuat KHONG con building trung gian: herb_garden (Linh Thao
// Vien), smelter (Lo Luyen), artisan_workshop (Thien Cong Phuong),
// formation_altar (Tran Dai), talisman_institute (Phu Vien) da bi loai
// bo. Nguyen lieu den thang tu ProductionSite (core/production).
//
// Chi phi xay/nang dung GO tu Thanh Van Lam (`<realm>_wood_<age>`, truc
// tuoi thong nhat gp123 6E C2) + nguyen lieu khac - sink chinh cua Lam
// (plan sec5.2). Tang Kinh Cac KHONG phai building (dong-fu-command-wheel
// plan Workstream C).
export const buildings: Building[] = [
  // Khai Vat Duong - gate San Xuat + LINH MACH (chi-hien-quan spec
  // 2026-09-02): chuc nang ngung tu Linh Thach cua Linh Tuyen (da xoa)
  // chuyen vao day - cung engine rate/storage, truy van qua
  // BuildingSystem conditions theo id 'gathering_outpost'.
  {
    id: 'gathering_outpost',

    name: 'Khai Vật Đường',

    description:
      'Quản lý khai thác Gỗ, Linh Quáng và Linh Thảo tại các địa giới. Dưới nền chảy linh mạch ngầm, âm thầm ngưng tụ Linh Thạch.',

    category: 'crafting_station',

    tier: 1,

    maxLevel: 9,

    // Linh mach - engine thach offline cu cua Linh Tuyen (rate scale
    // theo realm trong BuildingSystem, level max ~ 5% farm online).
    producesMaterialId: SPIRIT_STONE_MATERIAL_ID,

    baseProductionRate: 5.5 / 60 / 2.6,

    baseStorageCapacity: 100,

    functionType: 'exploration',

    upgradeCost: extendCosts([
      [],
      [{ materialId: 'material_spirit_wood_decade', amount: 4 }],
      [{ materialId: 'material_spirit_wood_decade', amount: 6 }],
    ], 4),
  },

  // Khi Duong - gate + nang cap bon operation (Cuong Hoa/Tay Luyen/
  // Tinh Luyen/Hoa Luyen, plan sec7).
  {
    id: 'equipment_hall',

    name: 'Khí Đường',

    description: 'Nơi luyện khí, cường hóa và tinh chỉnh trang bị.',

    category: 'crafting_station',

    tier: 1,

    maxLevel: 9,

    baseStorageCapacity: 0,

    functionType: 'equipment_hall',

    // Ngay 1-2 (Equipment) - gan nhu mien phi, khong duoc chan nhip do
    // trang bi dau game.
    upgradeCost: craftingUpgradeCosts(extendCosts([
      [{ materialId: 'material_spirit_wood_decade', amount: 3 }],
      [
        { materialId: 'material_spirit_wood_decade', amount: 6 },
        { materialId: 'material_spirit_ore_decade', amount: 3 },
      ],
      [{ materialId: 'material_spirit_wood_decade', amount: 4 }],
    ], 5)),

    levels: equipmentHallLevels(),
  },

  // Alchemy room levels increase brewing speed and waiting capacity.
  {
    id: 'pill_room',

    name: 'Đan Phòng',

    description: 'Lò luyện đan, chế tác đan dược từ linh thảo, gỗ nhiên liệu và linh thạch.',

    category: 'crafting_station',

    tier: 1,

    maxLevel: 9,

    baseStorageCapacity: 0,

    functionType: 'pill_room',

    // Ngay 3-5 (Dan) - cao hon Khi Duong mot chut nhung van re hon nhieu
    // lan chi phi luyen dan.
    upgradeCost: craftingUpgradeCosts(extendCosts([
      [
        { materialId: 'material_spirit_wood_decade', amount: 5 },
        { materialId: 'material_spirit_ore_decade', amount: 2 },
      ],
      [{ materialId: 'material_spirit_wood_decade', amount: 5 }],
      [{ materialId: 'material_spirit_wood_decade', amount: 9 }],
    ], 7), true),

    levels: pillRoomLevels(),
  },

  // Truyen Tong Tran - gate Tham Hiem (combat stage select).
  {
    id: 'teleport_array',

    name: 'Truyền Tống Trận',

    description: 'Trận pháp truyền tống dẫn tu sĩ đến các Địa Giới xa xôi để khiêu chiến.',

    category: 'crafting_station',

    tier: 1,

    maxLevel: 1,

    baseStorageCapacity: 0,

    functionType: 'stage_select',

    upgradeCost: [[{ materialId: 'material_spirit_wood_decade', amount: 3 }]],
  },

  // Ky Bao Cac - DORMANT registry entry (2026-10-11 ruling: selling is
  // gone entirely, decompose is the only material sink). Kept as data so
  // saves carrying a vendor instance still reconcile against a template;
  // every open path fails closed because 'vendor' is undeclared in
  // BETA_BUILDING_FEATURES (betaScopeSurface.ts). No upgrade
  // progression (vendor never scaled with level) -> maxLevel: 1.
  {
    id: 'vendor',

    name: 'Ký Bảo Các',

    // gp123 6G removed the quy-doi (conversion) cards but left this copy
    // promising them - audit M8. Sell-only wording matches what the
    // panel actually renders.
    description: 'Lầu các lưu giữ kỳ vật và dấu tích của tông môn.',

    category: 'crafting_station',

    tier: 1,

    maxLevel: 1,

    baseStorageCapacity: 0,

    // Art-only landmark; commerce is retired by the current ruling.

    upgradeCost: [[{ materialId: 'material_spirit_wood_decade', amount: 3 }]],
  },

  // Art-only Chieu Hien Quan landmark.
  {
    id: 'chi_hien_quan',

    name: 'Chiêu Hiền Quán',

    description:
      'Hiên quán đón khách và lưu giữ nét cổ kính của tông môn.',

    category: 'crafting_station',

    tier: 1,

    maxLevel: 1,

    baseStorageCapacity: 0,

    // Art-only landmark; no workforce or upgrade command.

    upgradeCost: [[]],
  },
]
