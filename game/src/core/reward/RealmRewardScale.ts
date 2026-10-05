import { getRealmIndex } from '../realm/realmSystem'

// Scale phan thuong quai theo canh gioi cua stage (2026-08-28, balance
// playtest) - Truc Co hien tai su dung enemyPool Luyen Khi (Stages.ts
// foundationStages chi override realmId), khien thu nhap Linh Thach/Cam
// ngo o Truc Co bi "khung" bang Luyen Khi trong khi chi phi token/enhance
// tang. Nhan thuong theo bac canh gioi de tien trinh co y nghia.
//
// Convention: mortal & Luyen Khi x1 (baseline); Foundation+ x3 per
// realm tier (matching the ~x3/realm time/effort curve). enemy.realmId
// was already overridden by StageWaveSystem to stage.requiredRealmId at
// spawn, so reading enemy.realmId matches the stage being fought
// (consistent with the doan_bao_thach drop-table gate).
const REALM_REWARD_GROWTH_BASE = 3

// 2026-10-05 pace retune: the x3 multiplier was authored when Truc Co
// re-used the Luyen Khi enemy pool (currency then paid at qi band).
// Foundation stages now drop their own authored band (25-35 stones,
// 90-120 mastery - already ~x3 the qi band), so the multiplier
// double-counted the realm jump and pushed TC income ~9x above LK,
// outrunning every cost table. Truc Co pays its authored band at x1;
// tiers with no authored band yet (golden_core+) keep the x3 growth.
export function getRealmRewardMultiplier(realmId: string): number {
  const realmIndex = getRealmIndex(realmId)

  if (realmIndex <= 2) {
    return 1
  }

  return Math.pow(REALM_REWARD_GROWTH_BASE, realmIndex - 2)
}
