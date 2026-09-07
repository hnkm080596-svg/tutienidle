// FormationPlacement (Trận Pháp spec §6, 2026-09-05) — chuyển
// FormationLoadout đã lưu của player thành vị trí tuyệt đối trên chiến
// trường, hoặc fallback về DEFAULT_PARTY_FORMATION nếu player chưa từng
// cấu hình trận pháp. Đây là "điểm nối" (seam) DUY NHẤT mà cả Combat Art
// Pipeline spec lẫn Trận Pháp spec đều trỏ vào buildTurnBattle() — được
// tách thành pure function riêng ở đây để buildTurnBattle() (Task 19)
// chỉ đóng vai trò caller mỏng.
import type { GridPosition } from '../battle/BattleGrid'
import { PLAYER_SIDE_REGION, standingSlotPosition } from '../battle/BattlefieldRegions'
import type { PlayerData } from '../player/Player'
import { DEFAULT_PARTY_FORMATION, type PartyFormationSlot } from './PartyFormation'

// Converts a local standing-slot index (0..STANDING_SLOT_COUNT-1 on each
// axis, within the player's own 3x3 grid) into an absolute battlefield
// position, via the single standingSlotPosition() anchor formula shared
// with enemy spawn placement (EnemySpawnPlacement.ts).
export function localCellToAbsolute(cell: { row: number; column: number }): GridPosition {
  return standingSlotPosition(PLAYER_SIDE_REGION, cell.row, cell.column)
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
