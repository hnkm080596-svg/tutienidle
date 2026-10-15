# Shared game UI frame

The design plane is 1440 x 810 (16:9). `GameUiFrame.ts` supplies screen-space geometry; `game-ui-frame.css` supplies the matching CSS frame variables. SceneDesignCanvas uniformly scales the design plane. GameRoot contains the Phaser canvas within that same frame.

- Scene and rail layout use design coordinates inside SceneDesignCanvas. Anchor to its edges or center, never to viewport vw/vh inside the scaled plane.
- Component instances own their art, fill, title, states and internal layout. Global frame rules own only the outer frame and overlay bounds.
- Body portals use screen coordinates derived from readGameUiFrame. Tooltips flip/shift/size against that rectangle; toasts map a design anchor and scale once. Never add the letterbox offset again to Phaser-local coordinates.
- Modal panels fit inside the shared frame. Screen-coordinate FX preserve their target positions and clip at the game frame. Existing overlay z-index authority remains in OverlayLayers.
- Legacy tien-hiep skin styles stop at GamePanel, combat content, GameCard, button, dropdown and SlotView boundaries. Keep asset/token fallback rules; new component layout belongs to its owner.
- Boot/fatal authority and developer tools remain application surfaces; gameplay panels must not use their window coordinate model.

Focused evidence: frame math tests cover 655x576, 800x600, 1920x1080 and 2560x1080; runtime resize and portal checks supplement unit evidence. No full QA claim follows from these checks.
