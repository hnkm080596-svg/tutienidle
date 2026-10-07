# PC UI art and interactive preview delivery

Branch: `codex/tien-hiep-ui-redesign`. Worktree: `E:/tutienidle/.agent-worktrees/hoa-cau-fireball-vfx`. App root: `game/`. Authoring baseline: `f8af8007`. This document supersedes earlier completion claims for the final delivery scope.

## Start the review

Run `npm install` and `npm run dev` from `game/`, use the port printed by Vite.

- `/ui-auth-preview.html`: auth, drawers and character creation mock.
- `/ui-landscape-design.html?example=home`: integrated PC home with independently scrolling navigation and approved panel geometry.
- Open Character, Skill, Equipment, Body, Technique, Realm, Storage, Alchemy, Formation, Map, Quest, Production, Settings and Help from the navigation.
- Unfinished Artifact, Companion, Guild, Sect and Secret Realm entries remain gray and locked.

## Art and integration boundary

Final workflow is art authoring and interactive preview, not gameplay implementation. Preview interactions use detached mock state; copy and eligibility are subject to later wiring. Existing character and item art is reused. Mobile is deferred. Earlier production presentation changes remain in this branch and require separate integration review.

Reusable art is under `public/assets/ui/tien-hiep-2026-10/`. CSS, SVG and Vue components are in source, not transient browser state. `tribulation/manifest-v1.json` describes 12 separate PNG components; `combat/manifest-v1.json` describes 21. Neither new component pack has been assembled into a final combat/tribulation preview. Existing dais, character, enemy and background art is outside the redraw scope.

`ART-PREVIEW-WIRING-SPEC.md` records transitions, detached interactions, naming and later wiring constraints. Current source and manifests are authoritative. The older `tien-hiep-ui-art-and-plan.zip` is a historical early export, not this final package.

## Current validation

- `npm run verify`: type-check passed; production Vite build passed (chunk-size warning). Full Vitest was stopped after observed failures; it did not pass.
- Observed failing suites: `i18nKeyParity`, `screenShakeAuthority`, `domArtLiteralCoverage`, `betaScopeRenderedTokens`, `InkWashBackdrop`. Root cause and baseline attribution are not fully established. Do not represent these as pre-existing without further evidence.
- Individual authoring checks previously passed type-check and browser interactions for the integrated panels. Recent browser checks exercised Quest, Settings/Help and Production, including unchanged localStorage. Screenshot evidence is in `runtime-evidence/`.
- Combat sheet alpha samples outside contours and inside portrait holes were zero. Tribulation source alpha range was 0..255. Crops retain original aspect ratios and alpha; visual crop acceptance still belongs to the consumer preview.
- No fresh aggregate OCR, independent adversarial QA or full sequential fixed-point review has been completed for the final delivery. Status: QA_UNVERIFIED / known test findings open. Draft PR is for preservation and review, not merge readiness.

No merge, deployment or gameplay integration is part of this delivery.
