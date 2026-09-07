// Tr?n Ph?p (Formation) content - spec 2026-09-05, standing-slot rework
// 2026-09-07: local pattern space is 3x3 (9 standing slots), mapped onto
// PLAYER_SIDE_REGION absolutes via localCellToAbsolute() in
// FormationPlacement.ts. Each formation carries ONE shared buff - there
// is no per-cell role. All formations are unlocked from the start.
// Mechanism-only file (types + content array); real roster/buff content
// is a separate content pass.
export interface TranPhapCell {
  row: number
  column: number
}

export interface TranPhapDefinition {
  id: string
  name: string
  cellPattern: readonly TranPhapCell[]
  buff: { definitionId: string }
  description: string
}

// Hon Don Tran (2026-09-06, visual test tooling) -- TEST-ONLY: opens all
// 9 standing slots of the local 3x3 grid, used to test panel/wiring
// before real Tran Phap content exists. Remove once a real formation
// replaces this "stress-test every slot" role.
function allLocalCells(): TranPhapCell[] {
  const cells: TranPhapCell[] = []

  for (let row = 0; row <= 2; row++) {
    for (let column = 0; column <= 2; column++) {
      cells.push({ row, column })
    }
  }

  return cells
}

const HON_DON_TRAN: TranPhapDefinition = {
  id: 'hon_don_tran',
  name: 'H?n D?n Tr?n',
  cellPattern: allLocalCells(),
  buff: { definitionId: 'hon_don_tran_test_buff' },
  description: 'TEST-ONLY - m? to�n b? 9 � d? ki?m tra wiring d?i h�nh.',
}

export const TRAN_PHAP_FORMATIONS: readonly TranPhapDefinition[] = [HON_DON_TRAN]
