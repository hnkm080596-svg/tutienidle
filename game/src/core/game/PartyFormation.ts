// PartyFormation (Combat Art Pipeline spec §7, 2026-09-05) — data-driven
// party placement, replacing the hardcoded players: [playerParticipant].
// combatantId là 'player' hoặc definitionId của companion (Companion Roster
// spec §5) — KHÔNG phải numeric index, vì tính năng thật (Trận Pháp) trộn
// player với companion theo id, không phải danh sách thứ tự có thể hoán đổi.
// DEFAULT_PARTY_FORMATION là fallback cho player CHƯA từng cấu hình Trận
// Pháp — byte-identical với trường hợp thật duy nhất hiện tại (1 player).
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
