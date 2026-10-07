This packages the PC xianxia UI art and interactive authoring previews in the approved warm parchment, ink landscape and antique-gold style. The home preview opens the scene panels directly through a shared independent navigation tree; auth has interactive drawers and a separate character-creation preview.

The final deliverable is component art and mock UI interactions. Existing item/character art is reused. Combat and tribulation component packs are split into separate transparent PNGs with manifests (21 and 12 assets respectively); their final scene assembly remains for later work. Mobile is deferred. Earlier production presentation changes are also present and need integration review.

### Review locally

From `game/`, run `npm install` and `npm run dev`, then open the printed port with:

- `/ui-auth-preview.html`
- `/ui-landscape-design.html?example=home`

Handoff: `game/docs/design/tien-hiep-ui-redesign-2026-10-05/PR-HANDOFF-2026-10-06.md`.
Wiring constraints: `ART-PREVIEW-WIRING-SPEC.md` in the same folder.

### Validation and draft status

- Type-check and Vite production build passed.
- Browser checks exercised the integrated preview navigation and local controls; recent Quest, Settings/Help and Production checks confirmed no localStorage mutation.
- Full Vitest did not pass: observed failures in i18n key parity, screen-shake authority, DOM-art bundle coverage, beta-scope rendered tokens and InkWashBackdrop. The suite was stopped after failures. Baseline attribution is not yet established.
- Final aggregate OCR, independent adversarial QA and fixed-point review are not complete. This PR is a draft for preserving the approved design package and subsequent integration, not a merge-ready release.
- The branch was authored from `f8af8007`; master has since advanced. No merge or deployment is requested.
