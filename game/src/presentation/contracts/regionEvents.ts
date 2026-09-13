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

import type { FormationSlotAssignment } from '@/core/player/Player'
import type { PlayerVisualProfileId } from '@/core/player/PlayerVisualForm'

/** The Formation preview's assignments changed. */
export const FORMATION_ASSIGNMENTS_EVENT = 'region:formation:assignments'

/**
 * Payload of {@link FORMATION_ASSIGNMENTS_EVENT} — one atomic snapshot: the
 * slot contents AND which visual form the player entity is currently in
 * (derived on the player entity, see `core/player/PlayerVisualForm.ts`).
 * The preview scene resolves art from it through the shared combat
 * catalogue; without it the scene would have to guess or hardcode.
 *
 * `playerProfileId` is optional only so older senders/tests passing a bare
 * `FormationSlotAssignment[]` keep working — the scene accepts both shapes.
 */
export interface FormationAssignmentsPayload {
  assignments: FormationSlotAssignment[]

  playerProfileId?: PlayerVisualProfileId
}
