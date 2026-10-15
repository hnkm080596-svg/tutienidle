// PartyFormation (Combat Art Pipeline spec sec7, 2026-09-05) - data-driven
// party placement, replacing the hardcoded players: [playerParticipant].
// combatantId la 'player' hoac definitionId cua companion (Companion Roster
// spec sec5) - KHONG phai numeric index, vi tinh nang that (Tran Phap) tron
// player voi companion theo id, khong phai danh sach thu tu co the hoan doi.
// The default player occupies the center standing slot of its own 3x3 grid.
import type { LaneIndex } from '../battle/BattleGrid'
import { DEFAULT_PLAYER_STANDING_POSITION } from '../battle/BattlefieldRegions'

export interface PartyFormationSlot {
  combatantId: string
  row: LaneIndex
  column: number
}

export const DEFAULT_PARTY_FORMATION: PartyFormationSlot[] = [
  { combatantId: 'player', ...DEFAULT_PLAYER_STANDING_POSITION },
]
