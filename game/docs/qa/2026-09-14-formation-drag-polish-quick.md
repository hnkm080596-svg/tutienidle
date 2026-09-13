# QA — Formation drag polish (queue art + cell->cell move + beam cost)

- **Date:** 2026-09-14
- **Mode:** quick
- **Scope:** user report — formation queue card shows a generic slot instead of character art; attach + detach "freezes" the game; dragging a unit cell->cell "causes an error".
- **Task-owned paths:** `game/src/assets/theme.css`, `game/src/components/panels/TranPhapPanel.vue`, `game/src/game/scenes/TranPhapCombatPreviewScene.ts`, plus their two test files.
- **Excluded dirty paths:** `CombatDefeatPanel.vue/.test.ts`, `en.json`, `vi.json` (parallel session's uncommitted work — not task-owned, not reviewed).
- **Risk map:** `pinia-phaser-sync`, `ui-input-lifecycle`; `deepAuditCandidate: true` on domain count alone.

## Verdict: PASS WITH GAPS

The mapper's deep-escalation flag is domain-count-driven; code inspection bounds the risk confidently: no store write, no event-contract change, no scene lifecycle/subscription change, no persistence. The verdict is quick but the freeze leg is explicitly gapped below.

## Findings

### Confirmed — fixed in this change

1. **Queue card rendered monogram, not art.** `combatantCards()` passed only `label`; `SlotView` fell back to the monogram. Player card now passes `icon: PLAYER_VISUAL_PROFILES[player.visualProfileId].combatTextureUrl` — the same PNG CombatScene/previews draw, derived from the entity via the store getter. Companions keep monogram (no companion art exists — declared fallback). Covered by new panel test asserting the card's `img.slot-view__item-icon` src.

2. **Cell->cell move projected the stale row.** `CombatGridView.getOrCreateSprite` early-returns the existing sprite and ignores the `row` argument; `positionSprite` projects `gridToScreen(sprite.row, column)`. A cell->cell drag therefore kept the unit drawing in its OLD row while the DOM cell showed the new one — matching the user's "kéo vào ô khác gây lỗi". `syncAssignments` now refreshes `sprite.row` before `positionSprite`. Covered by new scene test (`row` 0->2).

3. **Beam animation ran 24/7 at opacity 0.** `animation:` sat on the base `.fx-border-beam__fx` rule — every slot in the game (all `SlotView`s + 9 trapezoid cells) re-rasterized a masked `conic-gradient` each frame whether visible or not. Animation moved into the `:hover`/`--active` selector: invisible beams now cost nothing. `prefers-reduced-motion` override unaffected.

### Suspected — not reproduced

4. **"Game đơ" freeze on attach/detach.** Extensive live reproduction on Edge (real mouse + synthetic `DragEvent`/`DataTransfer`): queue->cell, cell->queue via click and via drop, cell->cell move, 15 rapid attach/detach cycles — all stayed ~143fps with a clean console. No unbounded loop exists in the sync path (`syncAssignments`, `getOrCreateSprite`, `destroyEntitySprite`, `updateEntityDepths` all bounded; the region dispatch queue is gated by `regionReady`). Two plausible non-code contributors observed during the session itself: (a) the dev page **auto-reloaded mid-test twice** because a parallel session was live-editing `locales/*.json` + `CombatDefeatPanel.vue` on master — Vite `page reload` mid-drag returns to the auth screen, which reads exactly like "đơ"; (b) the always-on beam paint cost (fixed above) is heavier on weaker GPUs. If the freeze persists on a clean build without parallel edits, it needs a companion-bearing save as the next repro axis — single-combatant paths are verified clean.

## Evidence

- `TranPhapCombatPreviewScene.test.ts`: 8 tests incl. new stale-row regression — green.
- `TranPhapPanel.test.ts`: 4 tests incl. new queue-icon assertion — green.
- `vue-tsc --build`: clean.
- Live Edge session (port 5179): occupied/unoccupied transitions, cell->cell move landing on the target cell, fps probe 143 during drags, console clean.
- Learned-ledger note QA-2026-09-12-012 (duplicate combatantId in persisted loadout) reviewed — unchanged by this diff; commit validation still owned by `commitFormationLoadout`.

## Gaps / follow-ups

- The hard freeze was not reproduced deterministically; the user's save likely has companions (multi-combatant swap path). `onDrop`'s drop-onto-occupied-cell path is statically sound (occupant returns to queue via `combatantCards` complement) but lacks a live multi-combatant run.
- `getOrCreateSprite`'s stale-`row` early-return is shared with real `CombatScene` — the preview scene now self-corrects; whether real combat has an equivalent stale-row surface was not in scope.
