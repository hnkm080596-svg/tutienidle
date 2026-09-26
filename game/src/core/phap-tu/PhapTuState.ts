import type { ElementType } from '../element/ElementType'

// Phap Tu Reimagined (spec phap-tu-reimagine-design) --
// the ONE persistent authority for the normal Phap Tu path choice.
// The route half of the legacy {element, route} commit is retired
// (route machinery deleted): element alone commits via
// selectSpellPathElement(). 'hidden_spell_pathway' is a separate WAY of
// the spell path, not a mode of this state. currentThe is NOT here:
// it is battle-runtime state on CombatEntity, never persisted.
export interface SpellPathState {
  element: ElementType | null
}

export function createSpellPathState(): SpellPathState {
  return { element: null }
}

/**
 * M9 -- the atomic {element} commit is owned HERE, on
 * the state authority, not inline in the orchestrator: every writer of
 * player.spellPath goes through this so the state can never half-commit.
 */
export function commitSpellPathElement(
  player: { spellPath: SpellPathState },
  element: ElementType,
): void {
  player.spellPath = { element }
}
