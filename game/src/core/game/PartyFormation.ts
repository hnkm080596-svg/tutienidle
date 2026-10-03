// PartyFormation (Combat Art Pipeline spec sec7, 2026-09-05) - data-driven
// party placement, replacing the hardcoded players: [playerParticipant].
// combatantId la 'player' hoac definitionId cua companion (Companion Roster
// spec sec5) - KHONG phai numeric index, vi tinh nang that (Tran Phap) tron
// player voi companion theo id, khong phai danh sach thu tu co the hoan doi.
// DEFAULT_PARTY_FORMATION la fallback cho player CHUA tung cau hinh Tran
// Phap - byte-identical voi truong hop that duy nhat hien tai (1 player).
import type { LaneIndex } from '../battle/BattleGrid'
import { HERO_LANE_INDEX, HERO_COLUMN } from '../battle/BattleLane'

export interface PartyFormationSlot {
  combatantId: string
  row: LaneIndex
  column: number
}

export const DEFAULT_PARTY_FORMATION: PartyFormationSlot[] = [
  { combatantId: 'player', row: HERO_LANE_INDEX, column: HERO_COLUMN },
]
