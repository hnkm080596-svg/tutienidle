# Scene 03: isolated UI approval surface

2026-10-03. Worktree `E:\tutienidle\.agent-worktrees\hk-login-fidelity`, branch `codex/hk-login-fidelity`.

## G0 / approved scope

User approved a separate preview URL, sample data, UI only, no gameplay hookup. Target is `03-dong-fu.jpg`, with invented reference features removed. Stop after showing Scene 03 for grading. No main-entry, save, gameplay, dependency or routing changes. Broad QA and release readiness are outside this visual-approval delivery; do not claim fixed-point completion.

Component map: preview host owns sample data and action feedback; scene composes children; vista owns decorative layers; HUD renders identity/resources; wheel renders action buttons; board renders opportunities; shared scene-local frame renders the approved nine-slice asset. Existing `SceneDesignCanvas` owns uniform scaling. Props down, typed semantic events up. No Pinia or GameManager in this preview.

## G1 / responsibility evidence

- Q1/Q12: 1440x810 composition remains proportional on resize, reference-like scenery/HUD/wheel/board, interactive visual feedback, nine-slice frames. Browser screenshots and narrow type validation planned, not full game QA.
- Q2/Q3: scene-local refs own hover/panel visibility only; reset on remount, no persistence or network work.
- Q4/Q11: `ui-dong-fu.html -> src/ui-preview/dong-fu.ts -> preview host -> scene`. Existing `GameRoot.vue` remains live and unchanged. Preview is explicitly not a production migration.
- Q5: reuse `SceneDesignCanvas`, `resolveAssetUrl`, existing symbol SVGs, approved PNG+JSON nine-slice and generated parallax planes. Existing manifest-backed `InkNineSlice` assumes native slice pixels equal display border widths; a scene-local art presenter consumes the new metadata without changing existing consumers.
- Q6/Q7/Q8/Q9: imports point to presentation helpers and Vue/i18n, never gameplay. Display fixture is clearly synthetic, not a domain query or authority. Button events cannot grant, spend, save or progress.
- Q10: no timers/network tasks; pointer presentation resets on leave, reduced-motion stops parallax; all controls use native buttons and focus styles.
- U1/U2: design canvas is shared by art and hit targets; no Phaser projection. U3: one local asset catalogue. U4: CSS owns visual motion. U5: preview i18n messages. U6: inspect actual preview in this worktree at multiple sizes.

## Filtered reference content

No chat, VIP, store/event buttons, fourth invented currency or invented building upgrades. Six building names verified against `src/data/building/buildings.ts`. Replace home-screen 'Create Character' node with Realm. Only preview actions; implementer supplies actual availability and data later.

## UI approval delivery / G5 scoped evidence

- Preview entry: `http://127.0.0.1:5606/ui-dong-fu.html` (Vite dev entry only, no production build/route registration changed).
- Added `src/ui-preview/` host, messages and entry plus `scenes/dong-fu/fidelity/` model/art catalogue, frame, vista, HUD, wheel, board and scene composer. No gameplay owners changed; existing live scene remains intact.
- `npm run type-check`: exit 0. No full QA, OCR, adversarial/release or gameplay certification claimed for this user-directed visual review.
- Real browser: board collapse produces `aria-expanded=false`, height 68 design px; reopen works. Skill click sets selected label and reserved notice, without a domain operation.
- Uniform resize: 1280x720 scale 0.888889, wheel orb 64.8889 px, board 279.1111 px; 1920x1080 scale 1.333333, orb 97.3333 px, board 418.6667 px. Both dimensions scale exactly 1.5 between those viewports. Screenshots inspected; final typography refined at 1440x810.
- Parallax observed in browser: rear translate (-0.417417, 0.312444), front (-1.11311, 0.781111) at the same pointer position. CSS reduced-motion guards present; emulated reduced-motion not separately exercised.
- Nine-slice frames displayed on all intended surfaces. Fixed a style collision where content span selectors also selected the frame span; explicitly excluded `.df-art-frame` from content positioning.
- Evidence: `docs/qa/huyen-kim-reference-fidelity/evidence/dong-fu-v2-review.png`, `dong-fu-v2-1280.png`, `dong-fu-v2-1920.png`. Browser console after final reload: zero errors/warnings.
- Remaining: user visual grading, then implementer hookup through UI-12..17. Fixture currency values and availability are not domain truth. Existing symbol icons remain replaceable. No commit/push or live-scene replacement.
