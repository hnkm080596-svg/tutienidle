// ENTITY_ART_MODE - the ONE switch deciding what every combat entity's art IS.
//
// Uniformity contract (locked 2026-09-19): 'static' = every entity is one PNG
// plus procedural motion (bob/lunge/pulse/rotate-fade); 'animated' = every
// entity is a clip set (idle/standby/death + optional transitions + cultivate).
// The catalogue emits each entity's `kind` from this constant, so the whole
// tree - combat, panels, previews - moves together. Compile-time by design:
// shipping a runtime toggle would mean producing BOTH art forms forever.
//
// Amendment (enemy-art-wave1, 2026-09-28): ANIMATED_ENEMY_KEYS in
// MonsterArt.ts is the single enumerated exception - entities in that set
// emit their authored clip set even under 'static'. The mode remains the
// roster default; the set, not scattered checks, decides who overrides it.
export type EntityArtMode = 'static' | 'animated'

export const ENTITY_ART_MODE: EntityArtMode = 'static'
