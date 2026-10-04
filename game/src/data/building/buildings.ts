import type { Building } from '@/core/building/Building'
import type { BuildingLevelDef } from '@/core/building/BuildingLevelEffect'
import { SPIRIT_STONE_MATERIAL_ID } from '@/core/material/SpiritStoneMaterial'
import { REALM_TIERS, getRealmIdForTier } from '@/core/realm/RealmTierMap'
import { buildProfessionMaterialId } from '@/core/profession/ProfessionMaterial'

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
      { materialId: buildProfessionMaterialId('wood', realmId, age), amount },
      { materialId: buildProfessionMaterialId('ore', realmId, age), amount: Math.max(1, Math.round(amount / 2)) },
    ]
  })
  return [...firstThree, ...future]
}

// W5 (2026-08-27) - repurpose building levels:
// - Khi Duong: moi cap tu 2 tro di giam 3% chi phi Cuong Hoa/Tay
//   Luyen/Tinh Luyen (tran 24% o level 9).
// - Dan Phong: level 3/6/9 mo them 1 slot luyen dan dong thoi
//   (baseline 1 slot, tran 4 slot).
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
      'Quản lý nhân công khai thác Lâm, Quáng và Động Thiên trên mọi địa giới. Dưới nền chảy linh mạch ngầm, âm thầm ngưng tụ Linh Thạch.',

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
      [{ materialId: 'qi_refining_wood_decade', amount: 4 }],
      [{ materialId: 'foundation_establishment_wood_decade', amount: 6 }],
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
    upgradeCost: extendCosts([
      [{ materialId: 'mortal_wood_decade', amount: 3 }],
      [
        { materialId: 'qi_refining_wood_decade', amount: 6 },
        { materialId: 'qi_refining_ore_decade', amount: 3 },
      ],
      [{ materialId: 'foundation_establishment_wood_decade', amount: 4 }],
    ], 5),

    levels: equipmentHallLevels(),
  },

  // Dan Phong - gate luyen dan (alchemy jobs, plan sec8); level quyet
  // dinh speed/success bonus rieng (xem core/alchemy/AlchemyBalance.ts).
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
    upgradeCost: extendCosts([
      [
        { materialId: 'mortal_wood_decade', amount: 5 },
        { materialId: 'mortal_ore_decade', amount: 2 },
      ],
      [{ materialId: 'qi_refining_wood_decade', amount: 5 }],
      [{ materialId: 'foundation_establishment_wood_decade', amount: 9 }],
    ], 7),

    levels: pillRoomLevels(),
  },

  // Truyen Tong Tran - gate Tham Hiem (combat stage select).
  {
    id: 'teleport_array',

    name: 'Truyền Tống Trận',

    description: 'Trận pháp truyền tống dẫn hero đến các Địa Giới xa xôi để khiêu chiến.',

    category: 'crafting_station',

    tier: 1,

    maxLevel: 1,

    baseStorageCapacity: 0,

    functionType: 'stage_select',

    upgradeCost: [[{ materialId: 'mortal_wood_decade', amount: 3 }]],
  },

  // Ky Bao Cac - building CHUYEN cho moi co che "doi/ban" (2026-08-30,
  // bug report: exchange bi nhet nham vao Linh Tuyen/San Xuat - building
  // khong chuyen). Gop Hoa Ban (VendorSystem) + quy doi pham Linh Thach +
  // quy doi canh gioi nguyen lieu (xem VendorPanel.vue). Khong co tien
  // trinh nang cap y nghia (vendor khong "manh hon" theo cap) nen
  // maxLevel: 1, giong Truyen Tong Tran.
  {
    id: 'vendor',

    name: 'Ký Bảo Các',

    // gp123 6G removed the quy-doi (conversion) cards but left this copy
    // promising them - audit M8. Sell-only wording matches what the
    // panel actually renders.
    description: 'Nơi bán nguyên liệu dư thừa lấy Linh Thạch theo phẩm cảnh giới hiện hành.',

    category: 'crafting_station',

    tier: 1,

    maxLevel: 1,

    baseStorageCapacity: 0,

    functionType: 'vendor',

    upgradeCost: [[{ materialId: 'mortal_wood_decade', amount: 3 }]],
  },

  // Chieu Hien Quan (chi-hien-quan spec 2026-09-02) - NGUON NHAN CONG
  // DUY NHAT: capacity = 1 + level x 2 (getWorkerCapacityForLevel trong
  // core/production/WorkerCapacity.ts). Cost bands khoi diem - tuning
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
      [{ materialId: 'mortal_ore_decade', amount: 4 }],
      [{ materialId: 'qi_refining_wood_decade', amount: 6 }],
    ], 4),
  },
]
