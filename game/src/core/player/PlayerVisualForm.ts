// PlayerVisualForm (2026-09-14) — the character's visual form, derived
// FROM the entity itself (cultivationPath). This is domain data: every
// place the character appears (PhaserCanvas gate -> CombatScene/MainScene,
// Tran Phap preview, future portrait/paperdoll surfaces) reads the SAME
// answer instead of re-deriving it. The profile contents (texture keys,
// anchors, ...) stay presentation — see
// presentation/art/PlayerVisualProfiles, looked up by this id.
import { isBetaWay, isScopeHidden } from '../betaScope'

export type PlayerVisualProfileId = 'mortal' | 'phap_tu' | 'kiem_tu' | 'the_tu'

/**
 * Pick the visual form from entity state:
 * - `cultivationPath` decides once the character has entered a path
 *   (spell/sword/body);
 * - still mortal (no path) or an unknown value -> `mortal`;
 * - `sword`/`body` return their own profile ids (the logical form) - the
 *   art layer falls back to mortal while no dedicated art exists.
 * - the hidden ways collapse into the base path + cultivationWay (save
 *   v66) - no hidden-path profile id exists here.
 *
 * BETA SCOPE LOCK - a carried way_out_of_scope save keeps its
 * (cultivationPath, cultivationWay) pair, but dormant claims stay inert
 * on live surfaces: a non-beta way, or a scope-hidden path whose way
 * record is absent, collapses the figure to mortal (pham_nhan).
 */
export function resolvePlayerVisualProfileId(input: {
  realmId?: string
  cultivationPath?: string
  cultivationWay?: string
}): PlayerVisualProfileId {
  if (input?.cultivationWay !== undefined && input.cultivationWay !== null) {
    return isBetaWay(input.cultivationWay)
      ? resolveProfileForPath(input.cultivationPath)
      : 'mortal'
  }

  return resolveProfileForPath(input?.cultivationPath)
}

function resolveProfileForPath(cultivationPath?: string): PlayerVisualProfileId {
  switch (cultivationPath) {
    case 'spell':
      return 'phap_tu'

    case 'sword':
      return isScopeHidden('swordPath') ? 'mortal' : 'kiem_tu'

    case 'body':
      return isScopeHidden('bodyPath') ? 'mortal' : 'the_tu'

    default:
      return 'mortal'
  }
}
