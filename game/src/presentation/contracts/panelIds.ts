// Panel identifiers — the names the static layer's panels are addressed by.
//
// V2 of docs/superpowers/specs/2026-09-11-frontend-static-dynamic-boundary-design.md.
//
// These two unions were declared inside `stores/ui.ts`, and
// `src/game/support/commandWheelCatalog.ts` imported them from there — a
// dynamic-layer file reaching up into a Pinia store. Type-only, so there was no
// runtime edge, but §3.2 governs direction rather than emitted code, and a
// type-only import is exactly how a runtime one later arrives without anyone
// noticing the direction was already wrong.
//
// They live here because `presentation/` is where the layers legitimately meet.
// `stores/ui.ts` re-exports both, so every existing `from '@/stores/ui'` import
// continues to resolve unchanged; this moves the declaration, nothing else.

/**
 * A page that occupies the whole left panel. `null` means no panel is open.
 */
export type LeftPanelMode =
  | 'character'
  | 'inventory'
  | 'exploration'
  | 'settings'
  | 'equipment_hall'
  | 'pill_room'
  | 'worker_lodge'
  | 'scripture_pavilion'
  | 'stage_select'
  | 'vendor'
  | null

/**
 * A full-screen overlay panel, mounted directly in `GameRoot.vue` rather than
 * through `leftPanelMode`. A separate union on purpose — these are not "a page
 * filling the left panel", and merging the two would blur that distinction.
 */
export type StandalonePanel =
  | 'skill'
  | 'realm'
  | 'quan_khi'
  | 'quest'
  | 'artifact'
  | 'tran_phap'
  | 'companion'
  | null
