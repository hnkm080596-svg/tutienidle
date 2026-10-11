// Truc chat dan (M-PILL-GRADE, ruling 2026-10-11): moi vien dan luyen
// xong roll chat (ItemQuality) DOC LAP theo ITEM_QUALITY_DROP_WEIGHT -
// realm KHONG anh huong. Thao duoc chi DAY chat san pham: van_nien +1
// bac, thuong_co +2 bac, duoi do +0, tran tien. Chat tang hieu luc hieu
// ung vien dan (hoang 100% ... tien 200%) - ap dung ca permanent_stat
// (Khai Linh) va % bat mach cua Thong Mach Dan.
import type { HerbAge } from '../production/ProductionTypes'
import type { ItemQuality } from '../item/ItemQuality'
import { ITEM_QUALITY_ORDER } from '../item/ItemQuality'
import { ITEM_QUALITY_DROP_WEIGHT, applyQualityBonusSteps } from '../equipment/ItemQualityBalance'
import { weightedRandom } from '../reward/DropRoll'

// Hieu luc hieu ung theo chat dan (ruling 4).
export const PILL_QUALITY_EFFECT_UPLIFT: Record<ItemQuality, number> = {
  hoang: 1,
  huyen: 1.25,
  dia: 1.5,
  thien: 1.75,
  tien: 2,
}

// Bac chat cong them tu dot thao duoc (ruling 2): +1 van nien, +2
// thuong co, duoi do +0. Cap o tien qua applyQualityBonusSteps.
export const PILL_HERB_AGE_GRADE_STEPS: Record<HerbAge, number> = {
  decade: 0,
  century: 0,
  millennium: 0,
  myriad_year: 1,
  thuong_co: 2,
}

// Chat mac dinh cua vien dan khong mang truong quality (save cu, drop,
// qua tang): tinh nhu hoang - KHONG migration.
export const BASE_PILL_QUALITY: ItemQuality = 'hoang'

// Roll chat 1 vien dan theo trong so roi trang bi. Nguon rng doc lap
// voi roll thanh cong; chi tieu 1 lan rng khi don vi do mint thanh cong.
export function rollPillQuality(rng: () => number): ItemQuality {
  return weightedRandom(
    ITEM_QUALITY_ORDER.map((quality) => ({
      value: quality,
      weight: ITEM_QUALITY_DROP_WEIGHT[quality],
    })),
    rng,
  )
}

// Chat + dot thao duoc -> chat cuoi cung cua vien dan (cap tien).
export function rollPillQualityWithHerb(rng: () => number, herbAge: HerbAge): ItemQuality {
  return applyQualityBonusSteps(rollPillQuality(rng), PILL_HERB_AGE_GRADE_STEPS[herbAge])
}

// He so hieu luc cua mot chat; undefined (dan cu/khong roll) = hoang.
export function pillQualityUplift(quality: ItemQuality | undefined): number {
  return PILL_QUALITY_EFFECT_UPLIFT[quality ?? BASE_PILL_QUALITY]
}
