import type { ElementType } from '../element/ElementType'

// Phap Tu Reimagined (spec 2026-09-14-phap-tu-reimagined-design) --
// the ONE persistent authority for the normal Phap Tu path choice.
// Both halves commit atomically via selectPhapTuElement() (INV-13):
// element != null implies route != null. 'ngo_dao' is a separate WAY of
// the phap_tu path, not a mode of this state. currentThe is NOT here:
// it is battle-runtime state on CombatEntity, never persisted.
export type PhapTuRoute = 'dot' | 'no'

export interface PhapTuState {
  element: ElementType | null
  route: PhapTuRoute | null
}

export function createPhapTuState(): PhapTuState {
  return { element: null, route: null }
}

/**
 * M9 — the atomic {element, route} commit (INV-13) is owned HERE, on
 * the state authority, not inline in the orchestrator: every writer of
 * player.phapTu goes through this so the pair can never half-commit.
 */
export function commitPhapTuElementRoute(
  player: { phapTu: PhapTuState },
  element: ElementType,
  route: PhapTuRoute,
): void {
  player.phapTu = { element, route }
}
