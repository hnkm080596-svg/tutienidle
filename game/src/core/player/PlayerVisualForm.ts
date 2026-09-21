// PlayerVisualForm (2026-09-14) — the character's visual form, derived
// FROM the entity itself (cultivationPath). This is domain data: every
// place the character appears (PhaserCanvas gate -> CombatScene/MainScene,
// Tran Phap preview, future portrait/paperdoll surfaces) reads the SAME
// answer instead of re-deriving it. The profile contents (texture keys,
// anchors, ...) stay presentation — see
// presentation/art/PlayerVisualProfiles, looked up by this id.
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
 */
export function resolvePlayerVisualProfileId(input: {
  realmId?: string
  cultivationPath?: string
}): PlayerVisualProfileId {
  switch (input?.cultivationPath) {
    case 'spell':
      return 'phap_tu'

    case 'sword':
      return 'kiem_tu'

    case 'body':
      return 'the_tu'

    default:
      return 'mortal'
  }
}
