# Architecture cards

Final panel: Equipment Hall, Pill Room, Teleport Array, Spirit Mine, Blessed Land and Heavenly Grotto. The remaining building cards, top resource strip, back button and details dialogs are absent from this UI. Existing domain upgrade commands and saved building/site identities remain unchanged.

Three new assets generated with the built-in imagegen tool are in `game/public/assets/ui/tien-hiep-2026-10/architecture/`:

- `equipment_hall-background-v1.png`: ornate artisan forge hall with a glowing forge.
- `pill_room-background-v1.png`: alchemy pavilion with a bronze cauldron and herbs.
- `teleport_array-background-v1.png`: circular blue stone teleport formation among misty peaks.

Shared prompt: landscape 3:2; coordinated Chinese ink-wash and detailed hand-painted antique fantasy art; warm aged parchment haze, charcoal contours, muted jade and antique gold. Architectural focal point in the upper half, quiet shaded mist in the lower half for UI text. Edge-to-edge, no text, numerals, interface, frame, icons or people.

The three production cards reuse the newly generated production illustrations documented in `production-card-art-2026-10-13.md`. All six cards use GameCard, background opacity 0.8, shared information and button geometry, and no building icon. Eligible upgrade hover shows current effects, an arrow and next effects; disabled buttons do not preview. Quotes and commits remain with their domain owners.

Verification: TypeScript passed; three component tests passed for eligible hover, disabled upgrade rejection and eligibility changes while hovering. Browser visual acceptance remains with the user; no full QA was run.
