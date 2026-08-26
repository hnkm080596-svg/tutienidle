// ProductionCatalog (plan §3/§5/§6) — Địa Giới Thanh Vân duy nhất trong
// scope hiện tại (§3.1): Phàm Nhân/Luyện Khí/Trúc Cơ, đúng một Lâm,
// một Quáng, một Động Thiên. Contract dùng catalog để mở rộng Địa Giới
// sau này mà không sửa engine. Validator từ chối Địa Giới thiếu nguồn,
// trùng loại hoặc sai số realm.

import { getRealmIndex } from '../realm/realmSystem'
import type {
  ForestRewardDefinition,
  GrottoHerbDefinition,
  MineRewardDefinition,
  ProductionSiteDefinition,
  ProductionSiteKind,
  TerritoryDefinition,
} from './ProductionTypes'
import { HERB_AGES, ORE_QUALITIES, PRODUCTION_SITE_KINDS } from './ProductionTypes'
import { HERB_AGE_WEIGHTS, ORE_QUALITY_WEIGHTS } from './ProductionBalance'

export const TERRITORY_THANH_VAN: TerritoryDefinition = {
  id: 'thanh_van',
  name: 'Địa Giới Thanh Vân',
  realmIds: ['mortal', 'qi_refining', 'foundation_establishment'],
  productionSiteIds: {
    forest: 'thanh_van_lam',
    mine: 'thanh_van_quang',
    grotto: 'thanh_van_dong_thien',
  },
}

// =========================
// Ba nguồn sản xuất của Thanh Vân — level riêng, giữ level khi đột phá
// (§3.2). Upgrade cost bằng Gỗ cùng realm + Linh Thạch (sink chính của
// Lâm §5.2).
// =========================

const SITE_UPGRADE_COSTS = (
  lowWood: string,
  middleWood: string,
  highWood: string,
): ProductionSiteDefinition['upgradeCosts'] => [
  { woodMaterialId: lowWood, woodAmount: 5, spiritStone: 100 },
  { woodMaterialId: lowWood, woodAmount: 12, spiritStone: 300 },
  { woodMaterialId: middleWood, woodAmount: 8, spiritStone: 800 },
  { woodMaterialId: middleWood, woodAmount: 16, spiritStone: 2000 },
]

function forestSite(): ProductionSiteDefinition {
  return {
    siteId: TERRITORY_THANH_VAN.productionSiteIds.forest,
    territoryId: TERRITORY_THANH_VAN.id,
    kind: 'forest',
    name: 'Thanh Vân Lâm',
    description: 'Rừng linh mộc của Địa Giới Thanh Vân — gỗ xây công trình và làm nhiên liệu đan lò.',
    maxLevel: 5,
    upgradeCosts: SITE_UPGRADE_COSTS('mortal_wood', 'qi_refining_wood', 'foundation_establishment_wood'),
  }
}

function mineSite(): ProductionSiteDefinition {
  return {
    siteId: TERRITORY_THANH_VAN.productionSiteIds.mine,
    territoryId: TERRITORY_THANH_VAN.id,
    kind: 'mine',
    name: 'Huyền Thiết Quảng',
    description: 'Mạch quáng sâu của Thanh Vân — linh thạch quáng đi thẳng vào Khí Đường.',
    maxLevel: 5,
    upgradeCosts: SITE_UPGRADE_COSTS('mortal_wood', 'qi_refining_wood', 'foundation_establishment_wood'),
  }
}

function grottoSite(): ProductionSiteDefinition {
  return {
    siteId: TERRITORY_THANH_VAN.productionSiteIds.grotto,
    territoryId: TERRITORY_THANH_VAN.id,
    kind: 'grotto',
    name: 'Thanh Vân Động Thiên',
    description: 'Động thiên kỳ trân dị thảo — mỗi đan phương có đúng một linh thảo riêng.',
    maxLevel: 5,
    upgradeCosts: SITE_UPGRADE_COSTS('mortal_wood', 'qi_refining_wood', 'foundation_establishment_wood'),
  }
}

export const THANH_VAN_PRODUCTION_SITES: readonly ProductionSiteDefinition[] = [
  forestSite(),
  mineSite(),
  grottoSite(),
]

// =========================
// Reward catalogs (§5.2/§5.3/§6.1)
// =========================

/** Lâm: đúng ba loại gỗ, mỗi loại gắn một realm tier (§5.2). */
export const THANH_VAN_FOREST_REWARDS: readonly ForestRewardDefinition[] = [
  { materialId: 'mortal_wood', realmId: 'mortal', amount: 3 },
  { materialId: 'qi_refining_wood', realmId: 'qi_refining', amount: 2 },
  {
    materialId: 'foundation_establishment_wood',
    realmId: 'foundation_establishment',
    amount: 1,
  },
]

/** Quáng: ba realm tier × năm phẩm (§5.3). */
export const THANH_VAN_MINE_REWARDS: readonly MineRewardDefinition[] = ORE_QUALITIES.flatMap(
  (quality) =>
    TERRITORY_THANH_VAN.realmIds.map((realmId) => ({
      materialId: `${realmId}_ore_${quality}`,
      realmId,
      quality,
      // Số lượng theo phẩm nằm ở balance; definition giữ 0 để resolver
      // tra ORE_QUALITY_AMOUNTS — tránh lệch hai nguồn sự thật.
      amount: 0,
    })),
)

/**
 * Động Thiên: mỗi đan phương ĐÚNG MỘT primary herb riêng (§6.1) —
 * 12 đan phương hiện hành × 4 biến thể niên đại. Thảo pool theo realm
 * của đan phương; cycle roll tier → thảo trong tier → niên đại.
 *
 * Herb base identity đặt tại ĐÂY (Phase 0 chốt mapping, §13.3);
 * material id đầy đủ = `${base}_${age}` do data/materials sinh.
 */
export interface GrottoHerbBase {
  baseId: string

  name: string

  /** Đan phương (alchemy recipe id) duy nhất nuôi bởi thảo này. */
  pillRecipeId: string

  realmId: string
}

export const THANH_VAN_GROTTO_HERB_BASES: readonly GrottoHerbBase[] = [
  // ---- Phàm Nhân ----
  { baseId: 'huyet_tham', name: 'Huyết Tham', pillRecipeId: 'alchemy_pill_regen_mortal', realmId: 'mortal' },
  {
    baseId: 'tinh_khi_thao',
    name: 'Tinh Khi Thảo',
    pillRecipeId: 'alchemy_pill_cultivation_mortal',
    realmId: 'mortal',
  },
  {
    baseId: 'minh_muc_thao',
    name: 'Minh Mục Thảo',
    pillRecipeId: 'alchemy_pill_insight_mortal',
    realmId: 'mortal',
  },
  {
    baseId: 'pho_cot_hoa',
    name: 'Phổ Cốt Hoa',
    pillRecipeId: 'alchemy_pill_main_stat_mortal',
    realmId: 'mortal',
  },

  // ---- Luyện Khí ----
  {
    baseId: 'ngoc_huyet_chi',
    name: 'Ngọc Huyết Chi',
    pillRecipeId: 'alchemy_pill_regen_qi_refining',
    realmId: 'qi_refining',
  },
  {
    baseId: 'tuan_linh_cao',
    name: 'Tuấn Linh Cao',
    pillRecipeId: 'alchemy_pill_cultivation_qi_refining',
    realmId: 'qi_refining',
  },
  {
    baseId: 'than_thong_hoa',
    name: 'Thần Thông Hoa',
    pillRecipeId: 'alchemy_pill_insight_qi_refining',
    realmId: 'qi_refining',
  },
  {
    baseId: 'loc_cot_thao',
    name: 'Lộc Cốt Thảo',
    pillRecipeId: 'alchemy_pill_main_stat_qi_refining',
    realmId: 'qi_refining',
  },

  // ---- Trúc Cơ ----
  {
    baseId: 'cu_phuong_qua',
    name: 'Cử Phượng Quả',
    pillRecipeId: 'alchemy_pill_regen_foundation_establishment',
    realmId: 'foundation_establishment',
  },
  {
    baseId: 'dao_diem_lien',
    name: 'Đạo Điềm Liên',
    pillRecipeId: 'alchemy_pill_cultivation_foundation_establishment',
    realmId: 'foundation_establishment',
  },
  {
    baseId: 'van_tu_dang',
    name: 'Vạn Tự Đăng',
    pillRecipeId: 'alchemy_pill_insight_foundation_establishment',
    realmId: 'foundation_establishment',
  },
  {
    baseId: 'thien_cot_thao',
    name: 'Thiên Cốt Thảo',
    pillRecipeId: 'alchemy_pill_main_stat_foundation_establishment',
    realmId: 'foundation_establishment',
  },
]

export const THANH_VAN_GROTTO_HERBS: readonly GrottoHerbDefinition[] =
  THANH_VAN_GROTTO_HERB_BASES.flatMap((base) =>
    HERB_AGES.map((age) => ({
      materialId: `${base.baseId}_${age}`,
      realmId: base.realmId,
      pillRecipeId: base.pillRecipeId,
      age,
    })),
  )

// =========================
// Validator (§3.1): từ chối Địa Giới thiếu nguồn/trùng loại/sai realm.
// =========================

export interface TerritoryValidationResult {
  valid: boolean

  errors: string[]
}

export function validateTerritory(
  territory: TerritoryDefinition,
  sites: readonly ProductionSiteDefinition[],
  forestRewards: readonly ForestRewardDefinition[],
  mineRewards: readonly MineRewardDefinition[],
  grottoHerbs: readonly GrottoHerbDefinition[],
): TerritoryValidationResult {
  const errors: string[] = []

  if (territory.realmIds.length !== 3) {
    errors.push(`Territory ${territory.id}: phải có đúng 3 cảnh giới`)
  }

  if (new Set(territory.realmIds).size !== territory.realmIds.length) {
    errors.push(`Territory ${territory.id}: cảnh giới trùng lặp`)
  }

  const territorySites = sites.filter((site) => site.territoryId === territory.id)

  for (const kind of PRODUCTION_SITE_KINDS) {
    const count = territorySites.filter((site) => site.kind === kind).length

    if (count !== 1) {
      errors.push(`Territory ${territory.id}: cần đúng 1 nguồn "${kind}", thấy ${count}`)
    }
  }

  const expectedSiteIds = new Set(Object.values(territory.productionSiteIds))

  for (const site of territorySites) {
    if (!expectedSiteIds.has(site.siteId)) {
      errors.push(`Territory ${territory.id}: site lạ ${site.siteId}`)
    }

    if (site.maxLevel < 1) {
      errors.push(`Site ${site.siteId}: maxLevel phải ≥ 1`)
    }
  }

  // Rewards phải phủ đủ 3 realm tier của Địa Giới.
  for (const realmId of territory.realmIds) {
    if (!forestRewards.some((reward) => reward.realmId === realmId)) {
      errors.push(`Lâm ${territory.id}: thiếu gỗ cho tier ${realmId}`)
    }

    if (!mineRewards.some((reward) => reward.realmId === realmId)) {
      errors.push(`Quáng ${territory.id}: thiếu quáng cho tier ${realmId}`)
    }

    if (!grottoHerbs.some((herb) => herb.realmId === realmId)) {
      errors.push(`Động Thiên ${territory.id}: thiếu thảo cho tier ${realmId}`)
    }
  }

  // Realm của reward phải thuộc Địa Giới.
  for (const reward of [...forestRewards, ...mineRewards, ...grottoHerbs]) {
    if (!territory.realmIds.includes(reward.realmId)) {
      errors.push(`${territory.id}: reward ${reward.materialId} ngoài phạm vi Địa Giới`)
    }
  }

  return { valid: errors.length === 0, errors }
}

/** Kiểm tra bất biến trọng số giảm dần (§5.3/§6.2) — gọi ở data integrity test. */
export function validateWeightOrdering(): string[] {
  const errors: string[] = []

  for (let index = 1; index < ORE_QUALITIES.length; index++) {
    const previous = ORE_QUALITY_WEIGHTS[ORE_QUALITIES[index - 1]!]

    const current = ORE_QUALITY_WEIGHTS[ORE_QUALITIES[index]!]

    if (current >= previous) {
      errors.push(`Phẩm Quáng ${ORE_QUALITIES[index]} phải có trọng số thấp hơn ${ORE_QUALITIES[index - 1]}`)
    }
  }

  for (let index = 1; index < HERB_AGES.length; index++) {
    const previous = HERB_AGE_WEIGHTS[HERB_AGES[index - 1]!]

    const current = HERB_AGE_WEIGHTS[HERB_AGES[index]!]

    if (current >= previous) {
      errors.push(`Niên đại ${HERB_AGES[index]} phải có trọng số thấp hơn ${HERB_AGES[index - 1]}`)
    }
  }

  return errors
}

/** Guard realm index dùng chung — tránh import vòng từ realmSystem ở vài nơi. */
export function realmSortKey(realmId: string): number {
  try {
    return getRealmIndex(realmId)
  } catch {
    return Number.MAX_SAFE_INTEGER
  }
}
