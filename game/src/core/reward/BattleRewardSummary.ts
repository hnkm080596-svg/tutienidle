// Combat UI Redesign - truoc day khong co noi nao gom lai "tran nay
// kiem duoc gi": GameManager.grantItemDrops()/giveReward() cong thang
// vao bag/player moi lan quai chet, chi de lai toast roi rac
// (pendingNotifications, bi xoa moi tick). CombatVictoryPanel/
// CombatDefeatPanel can 1 ban TICH LUY theo tung tran de hien lai luc
// ket thuc - accumulator nay song trong GameManager, reset moi khi 1
// tran moi bat dau (xem GameManager.startBattle()).
export interface BattleRewardSummary {
  techniqueMastery: number

  skillInsight: number

  spiritStone: number

  // Ban Menh Phap Bao (doc sec5.2/sec12.2) - EXP artifact cap khi reward
  // cua quai chet duoc xu ly thanh cong, cung nguon/nhip voi
  // skillInsight (BattleLootSystem.processDefeatedEnemies()). Doan Bao
  // Thach KHONG co field rieng - di qua `items[]` voi kind 'material'.
  artifactInsight: number

  items: BattleRewardItem[]
}

export type BattleRewardItemKind = 'material' | 'pill' | 'equipment'

export interface BattleRewardItem {
  itemId: string

  kind: BattleRewardItemKind

  name: string

  amount: number
}

export function createEmptyBattleRewardSummary(): BattleRewardSummary {
  return { techniqueMastery: 0, skillInsight: 0, spiritStone: 0, artifactInsight: 0, items: [] }
}
