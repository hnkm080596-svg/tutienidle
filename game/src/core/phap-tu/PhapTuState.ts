import type { ElementType } from '../element/ElementType'

// Phap Tu Reimagined (spec 2026-09-14-phap-tu-reimagined-design) --
// the ONE persistent authority for the normal Phap Tu path choice.
// Both halves commit atomically via selectSpellPathElement() (INV-13):
// element != null implies route != null. 'hidden_spell_pathway' is a separate WAY of
// the spell path, not a mode of this state. currentThe is NOT here:
// it is battle-runtime state on CombatEntity, never persisted.
export type SpellPathRoute = 'dot' | 'no'

export interface SpellPathState {
  element: ElementType | null
  route: SpellPathRoute | null
}

export function createSpellPathState(): SpellPathState {
  return { element: null, route: null }
}

/**
 * M9 — the atomic {element, route} commit (INV-13) is owned HERE, on
 * the state authority, not inline in the orchestrator: every writer of
 * player.spellPath goes through this so the pair can never half-commit.
 */
export function commitSpellPathElementRoute(
  player: { spellPath: SpellPathState },
  element: ElementType,
  route: SpellPathRoute,
): void {
  player.spellPath = { element, route }
}
