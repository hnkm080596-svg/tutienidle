// Scoped events a shell may send to a dynamic region.
//
// §3.6 surface two of
// docs/superpowers/specs/2026-09-11-frontend-static-dynamic-boundary-design.md.
//
// V10: `TranPhapPanel.vue` used to hold a `TranPhapCombatPreviewScene` and call
// `syncAssignments()` on it. A shell holding a scene can call every public
// method on that scene, and nobody reviews which ones it chose. A shell holding
// a `DynamicRegion` can send the events named here, and adding one is an edit
// to this file.

/** The Formation preview's assignments changed. Payload: FormationSlotAssignment[]. */
export const FORMATION_ASSIGNMENTS_EVENT = 'region:formation:assignments'
