// FormationPlacement (Trận Pháp spec §6, 2026-09-05) — chuyển
// FormationLoadout đã lưu của player thành vị trí tuyệt đối trên chiến
// trường, hoặc fallback về DEFAULT_PARTY_FORMATION nếu player chưa từng
// cấu hình trận pháp. Đây là "điểm nối" (seam) DUY NHẤT mà cả Combat Art
// Pipeline spec lẫn Trận Pháp spec đều trỏ vào buildTurnBattle() — được
// tách thành pure function riêng ở đây để buildTurnBattle() (Task 19)
// chỉ đóng vai trò caller mỏng.
import type { GridPosition, LaneIndex } from '../battle/BattleGrid'
import { PLAYER_SIDE_REGION } from '../battle/BattlefieldRegions'
import type { PlayerData } from '../player/Player'
import { DEFAULT_PARTY_FORMATION, type PartyFormationSlot } from './PartyFormation'

// Quy đổi một ô cục bộ (local cell, trong hệ tọa độ 6x6 riêng của phe
// người chơi) thành vị trí tuyệt đối trên lưới chiến trường, bằng cách
// cộng offset của PLAYER_SIDE_REGION (rowMin/columnMin).
export function localCellToAbsolute(cell: { row: number; column: number }): GridPosition {
  return {
    row: (PLAYER_SIDE_REGION.rowMin + cell.row) as LaneIndex,
    column: PLAYER_SIDE_REGION.columnMin + cell.column,
  }
}

// Nếu player chưa từng lưu formationLoadout (null), trả về đội hình mặc
// định (chỉ có player). Ngược lại, quy đổi từng assignment cục bộ đã lưu
// thành PartyFormationSlot với tọa độ tuyệt đối.
export function resolvePartyFormation(player: PlayerData): PartyFormationSlot[] {
  if (!player.formationLoadout) {
    return DEFAULT_PARTY_FORMATION
  }

  return player.formationLoadout.assignments.map((assignment) => {
    const absolute = localCellToAbsolute(assignment)

    return { combatantId: assignment.combatantId, row: absolute.row, column: absolute.column }
  })
}
