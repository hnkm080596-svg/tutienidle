# Scene 04 - Character visual approval

2026-10-03. Same assigned worktree/branch as Scene 03. User approved continuing to the next scene after Dong Fu. Scope: independent `/ui-character.html` preview, exact reference composition, readonly fixture, no gameplay/save/store wiring, one scene for user grading. No commit/push or file removal.

G0/G1: Q1/Q12 = reference-like scroll composition, nine-slice frames, uniform 1440x810 design canvas; Q2/Q3 = preview host owns temporary selection/notice, detail visibility owned by presentation; Q4/Q11 = new preview entry only, old CharacterScene stays live and unchanged; Q5 = reuse SceneDesignCanvas, approved dark nine-slice, element discs and asset resolver; Q6-Q9 = presentation dependencies only, values are formatted fixture data, no domain computation or commands; Q10 = no persistence/async jobs, scoped pointer handlers and reduced-motion CSS. UI module applies; combat/save/economy modules not touched.

Component map: host fixture and notice; scene composer reusing the approved DongFuVista; identity; figure and element selector; main stats/talent/element summary; detail drawer. Props in and typed events out. Generation: new transparent figure and ivory nine-slice paper ONLY. Existing five elemental discs are reused.

User correction, final hierarchy: Login, Dong Fu, Tribulation and Combat are the four main scenes owning backgrounds. Secondary screens belong to their respective main scene; they do not own new backgrounds. Character belongs to Dong Fu, and its entire panel surface is paper. Creation belongs to Login. Do not infer every secondary screen's parent without checking its function. The already-finished extra Character background generation is rejected and is not copied into the project or consumed. Preview host reuses DongFuVista with the same rear/foreground layers and parallax; CharacterFidelityScene owns only paper and controls.

Source filtering: `StatLabels.ts` defines actual five main attributes (Can Cot/Than Phap/Than Thuc/Linh Can/The Chat); `ElementLabels.ts` has five elements. No invented sect/title/level label. No 'hut MP' absent from current stat catalog. Primordial power is retained as a detail entry, not a sixth element. Side navigation excludes unsupported companion reference button.

Verification planned: type-check, real browser composition/resize/selection/detail toggle. Full QA and production integration remain outside this user-directed UI approval. Do not claim release readiness.

## Current visual delivery

User visual correction implemented: removed the scroll roller; Character now uses a flat paper panel. Removed the separate dark combat-power plaque and emblem; label/value are printed directly on paper. Removed the dark details frame; detail text uses ink colors on the same paper, separated only by a thin vertical rule. No background changes. Evidence: `character-v2-paper-unified.png`.

`npm run type-check` passed (exit 0). Actual browser loaded `/ui-character.html` in this worktree; screenshot `docs/qa/huyen-kim-reference-fidelity/evidence/character-v2-review.png` inspected at 1440x810. Paper, figure, five elements, main attributes, talent placeholder and detail list are visible; exterior is exactly DongFuVista, not generated Character scenery. Detail list intentionally scrolls for overflow. Independent responsive/interaction checks are not yet reported as executed. Shared SceneDesignCanvas is reused unchanged. This is visual-approval evidence only, not full game QA or integration.
