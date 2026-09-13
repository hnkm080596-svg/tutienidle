// FormationPlacement (Trận Pháp spec §6, 2026-09-05) — chuyển
// FormationLoadout đã lưu của player thành vị trí tuyệt đối trên chiến
// trường, hoặc fallback về DEFAULT_PARTY_FORMATION nếu player chưa từng
// cấu hình trận pháp. Đây là "điểm nối" (seam) DUY NHẤT mà cả Combat Art
// Pipeline spec lẫn Trận Pháp spec đều trỏ vào buildTurnBattle() — được
// tách thành pure function riêng ở đây để buildTurnBattle() (Task 19)
// chỉ đóng vai trò caller mỏng.
import type { GridPosition } from '../battle/BattleGrid'
import { PLAYER_SIDE_REGION, standingSlotPosition } from '../battle/BattlefieldRegions'
import type { FormationLoadout, PlayerData } from '../player/Player'
import { DEFAULT_PARTY_FORMATION, type PartyFormationSlot } from './PartyFormation'
import { TRAN_PHAP_FORMATIONS } from '../../data/formation/TranPhap'

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

// F4 (architecture-qa-repairs, 2026-09-13) - validating commit for
// PlayerData.formationLoadout. TranPhapPanel used to write the field
// directly from a local draft, so a stale or hand-assembled draft could
// persist rows that resolvePartyFormation()/buildTurnBattle() then skip
// silently (unknown combatant, off-pattern cell). The commit now validates
// against exactly the contract battle construction assumes:
//
//   - formationId exists in TRAN_PHAP_FORMATIONS;
//   - every combatantId is 'player' or an owned companion definitionId;
//   - every cell is inside the formation's cellPattern;
//   - no combatantId repeats, and no two combatants share a cell (the
//     panel's own "one slot per combatant, one combatant per slot"
//     invariant).
//
// Returns false WITHOUT touching player.formationLoadout on any violation.
// On success stores a detached copy so later edits of the caller's draft
// cannot mutate the committed loadout.
export function commitFormationLoadout(player: PlayerData, loadout: FormationLoadout): boolean {
  const formation = TRAN_PHAP_FORMATIONS.find((entry) => entry.id === loadout.formationId)

  if (!formation) {
    return false
  }

  const seenCombatants = new Set<string>()
  const seenCells = new Set<string>()

  for (const assignment of loadout.assignments) {
    const isKnownCombatant =
      assignment.combatantId === 'player' ||
      player.companions.some((instance) => instance.definitionId === assignment.combatantId)

    if (!isKnownCombatant) {
      return false
    }

    const inPattern = formation.cellPattern.some(
      (cell) => cell.row === assignment.row && cell.column === assignment.column,
    )

    if (!inPattern) {
      return false
    }

    const cellKey = `${assignment.row}:${assignment.column}`

    if (seenCombatants.has(assignment.combatantId) || seenCells.has(cellKey)) {
      return false
    }

    seenCombatants.add(assignment.combatantId)
    seenCells.add(cellKey)
  }

  player.formationLoadout = {
    formationId: formation.id,
    assignments: loadout.assignments.map((assignment) => ({
      row: assignment.row,
      column: assignment.column,
      combatantId: assignment.combatantId,
    })),
  }

  return true
}
