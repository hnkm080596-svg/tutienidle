// Combat UI Redesign — trước đây không có nơi nào gom lại "trận này
// kiếm được gì": GameManager.grantItemDrops()/giveReward() cộng thẳng
// vào bag/player mỗi lần quái chết, chỉ để lại toast rời rạc
// (pendingNotifications, bị xoá mỗi tick). CombatVictoryPanel/
// CombatDefeatPanel cần 1 bản TÍCH LUỸ theo từng trận để hiện lại lúc
// kết thúc — accumulator này sống trong GameManager, reset mỗi khi 1
// trận mới bắt đầu (xem GameManager.startBattle()).
export interface BattleRewardSummary {
  techniqueInsight: number

  skillInsight: number

  spiritStone: number

  // Bản Mệnh Pháp Bảo (doc §5.2/§12.2) — EXP artifact cấp khi reward
  // của quái chết được xử lý thành công, cùng nguồn/nhịp với
  // skillInsight (BattleLootSystem.processDefeatedEnemies()). Đoán Bảo
  // Thạch KHÔNG có field riêng — đi qua `items[]` với kind 'material'.
  artifactInsight: number

  items: BattleRewardItem[]
}

export type BattleRewardItemKind = 'material' | 'pill' | 'equipment' | 'technique'

export interface BattleRewardItem {
  itemId: string

  kind: BattleRewardItemKind

  name: string

  amount: number
}

export function createEmptyBattleRewardSummary(): BattleRewardSummary {
  return { techniqueInsight: 0, skillInsight: 0, spiritStone: 0, artifactInsight: 0, items: [] }
}
