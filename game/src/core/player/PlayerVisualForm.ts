// PlayerVisualForm (2026-09-14) — the character's visual form, derived
// FROM the entity itself (cultivationPath). This is domain data: every
// place the character appears (PhaserCanvas gate -> CombatScene/MainScene,
// Tran Phap preview, future portrait/paperdoll surfaces) reads the SAME
// answer instead of re-deriving it. The profile contents (texture keys,
// anchors, ...) stay presentation — see
// presentation/art/PlayerVisualProfiles, looked up by this id.
export type PlayerVisualProfileId = 'mortal' | 'phap_tu' | 'kiem_tu'

/**
 * Pick the visual form from entity state:
 * - `cultivationPath` decides once the character has entered a path
 *   (phap_tu/kiem_tu);
 * - still mortal (no path) or an unknown value -> `mortal`;
 * - `kiem_tu` returns its own id (the logical form) — the art layer
 *   falls back to mortal while no dedicated art exists.
 */
export function resolvePlayerVisualProfileId(input: {
  realmId?: string
  cultivationPath?: string
}): PlayerVisualProfileId {
  switch (input?.cultivationPath) {
    case 'phap_tu':
      return 'phap_tu'

    case 'kiem_tu':
      return 'kiem_tu'

    default:
      return 'mortal'
  }
}
