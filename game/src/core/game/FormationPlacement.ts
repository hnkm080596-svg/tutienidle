// FormationPlacement (Tran Phap spec sec6, 2026-09-05) - chuyen
// FormationLoadout da luu cua player thanh vi tri tuyet doi tren chien
// truong, hoac fallback ve DEFAULT_PARTY_FORMATION neu player chua tung
// cau hinh tran phap. Day la "diem noi" (seam) DUY NHAT ma ca Combat Art
// Pipeline spec lan Tran Phap spec deu tro vao buildTurnBattle() - duoc
// tach thanh pure function rieng o day de buildTurnBattle() (Task 19)
// chi dong vai tro caller mong.
import type { GridPosition } from '../battle/BattleGrid'
import { PLAYER_SIDE_REGION, standingSlotPosition } from '../battle/BattlefieldRegions'
import type { FormationLoadout, PlayerData } from '../player/Player'
import { DEFAULT_PARTY_FORMATION, type PartyFormationSlot } from './PartyFormation'
import { TRAN_PHAP_FORMATIONS } from '../../data/formation/TranPhap'
import { getRealmIndex } from '../realm/realmSystem'
import { isRealmAvailable } from '../realm/ReleasePolicy'
import { isBetaFeature } from '../betaScope'

// Formation unlock (P7-M9, decisions D3 + M9-F1) - D3 rules Tran Phap
// is not usable Mortal progression and gates it independently; M9-F1
// pins that gate at Tru Co. resolvePartyFormation() stays UNGATED so a
// grandfathered save's committed loadout still resolves in combat.
export const FORMATION_UNLOCK_REALM_ID = 'foundation_establishment'

export function isFormationUnlocked(realmId: string): boolean {
  // M-F-CEILING - composed with release policy (C2C-9 simple rule): NO
  // grandfathering beyond the ceiling - a persisted save whose realm is
  // unavailable hides the domain even though FORMATION_UNLOCK_REALM_ID
  // sits in-window.
  // BETA SCOPE LOCK v2 sec.14 - formation is scope-hidden in beta.
  return (
    isBetaFeature('formation') &&
    isRealmAvailable(FORMATION_UNLOCK_REALM_ID) &&
    isRealmAvailable(realmId) &&
    getRealmIndex(realmId) >= getRealmIndex(FORMATION_UNLOCK_REALM_ID)
  )
}

// Converts a local standing-slot index (0..STANDING_SLOT_COUNT-1 on each
// axis, within the player's own 3x3 grid) into an absolute battlefield
// position, via the single standingSlotPosition() anchor formula shared
// with enemy spawn placement (EnemySpawnPlacement.ts).
export function localCellToAbsolute(cell: { row: number; column: number }): GridPosition {
  return standingSlotPosition(PLAYER_SIDE_REGION, cell.row, cell.column)
}

// Neu player chua tung luu formationLoadout (null), tra ve doi hinh mac
// dinh (chi co player). Nguoc lai, quy doi tung assignment cuc bo da luu
// thanh PartyFormationSlot voi toa do tuyet doi.
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
  if (!isFormationUnlocked(player.realmId)) {
    return false
  }

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
