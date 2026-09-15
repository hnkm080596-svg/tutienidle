import type { ElementType } from '../element/ElementType'

// Phap Tu Reimagined (spec 2026-09-14-phap-tu-reimagined-design) --
// the ONE persistent authority for the normal Phap Tu path choice.
// Both halves commit atomically via selectPhapTuElement() (INV-13):
// element != null implies route != null. 'phap_tu_an' is a separate
// CultivationPathId, not a mode of this state. currentThe is NOT here:
// it is battle-runtime state on CombatEntity, never persisted.
export type PhapTuRoute = 'dot' | 'no'

export interface PhapTuState {
  element: ElementType | null
  route: PhapTuRoute | null
}

export function createPhapTuState(): PhapTuState {
  return { element: null, route: null }
}
