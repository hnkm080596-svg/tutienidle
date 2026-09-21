// ENTITY_ART_MODE - the ONE switch deciding what every combat entity's art IS.
//
// Uniformity contract (locked 2026-09-19): 'static' = every entity is one PNG
// plus procedural motion (bob/lunge/pulse/rotate-fade); 'animated' = every
// entity is a clip set (idle/standby/death + optional transitions + cultivate).
// The catalogue emits each entity's `kind` from this constant, so the whole
// tree - combat, panels, previews - moves together. Compile-time by design:
// shipping a runtime toggle would mean producing BOTH art forms forever.
export type EntityArtMode = 'static' | 'animated'

export const ENTITY_ART_MODE: EntityArtMode = 'static'
