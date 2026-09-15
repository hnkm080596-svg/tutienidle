import type { PlayerData } from '../player/Player'
import type { KiemPhoComboModifier } from './KiemPhoSystem'

// Kiem Tu Reimagined Task 6 seam — maps purchased capstone nodes to
// their KiemPhoComboModifier hooks (spec §4.2: the ONLY way a node may
// alter a combo). Task 11 authors the node tree and populates this
// collector; until then no node yields a modifier.
export function collectKiemPhoComboModifiers(_player: PlayerData): KiemPhoComboModifier[] {
  return []
}
