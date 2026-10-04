# Remaining UI fidelity previews

## Scope

2026-10-03. User approved Victory/Equipment and requested the remaining scenes in one batch. Worktree: `E:\tutienidle\.agent-worktrees\hk-login-fidelity`, branch `codex/hk-login-fidelity`. UI fixtures only, no gameplay, save, backend, router, Phaser runtime, background or dependency changes. No commit/push/merge/deletion.

- Defeat: companion to Victory, red-gold title, reason on the left, dynamic rewards on the right, retry/home below. Combat art already in the repository is displayed as context only.
- Settings: categories, audio sliders/toggles, display selectors, storage/support action surfaces on paper. Audio/locale/scale selectors demonstrate local control state only; they do not change runtime configuration. Actual canvas scaling always remains uniform.
- Quest: filtered list, landscape crop, objectives, reward slots and claim/follow request. Uses a crop of existing Dong Fu art temporarily; no new background authored. Once-only grouping reflects current fixture contract, not invented daily/weekly gameplay.
- Inventory: eight-column dark jade slots, query/filter/sort, selected-item detail on the right. Uses existing replaceable content icons. Empty results are supported.

Shared paper is CSS9-slice (`300 fill`), detail frame is CSS9-slice (`360 fill`). Paper secondary panels sit over Dong Fu using the same navigation component as Character. Notifications have reserved space. Four entry pages use the existing 1440×810 canvas with one uniform scale and letterboxing.

## Component / hookup map

See UI-69–77 in `huyen-kim-ui-plugin-list.md`. Hosts own fixture/local selection; feature components consume typed display props and emit requests by identity. Inventory and Quest contracts live beside their components. No commands execute domain operations and no mounting or visual completion grants resources.

## New raster art provenance

Only `public/assets/ui/huyen-kim/scene/defeat-v2/defeat-title-v1.png` was generated for this batch. Transparent PNG,2172×724. Original retained at `C:\Users\hnkm0\.codex\generated_images\01a0f7b5-053f-71d0-a72c-75577519a956\exec-78166c2a-5c59-44b3-9ca1-400176676253.png`.

Prompt:

> Use case: stylized-concept. Create a single isolated Vietnamese xianxia game defeat title on genuine transparent background. Exact text: "Thất Bại" with correct Vietnamese circumflex, acute and dot below. Two words on ONE horizontal line. Sweeping elegant hand-painted Latin brush calligraphy, strong readable letterforms, aged vermilion and ember orange highlights, slight antique gold edges, dark red ink bleed beneath strokes. Companion to a gold victory calligraphy title; emotional and dignified, not horror. Very wide centered composition, all strokes fully visible with transparent margin, around4:1 visual aspect. Few restrained sweeping ink flourishes directly around letters. NO skull, NO people, NO scenery, NO paper, NO card, NO background, NO other text or objects, NO watermark. Only the calligraphy title cutout.

## Scoped verification

- `npm run type-check`: passed.
- `npx vitest run src/ui-preview/remainingPreview.test.ts`:4 tests passed. Covers item identity requests without consuming quantities, quest claim request without changing completion, typed control events without prop mutation, and empty Defeat rewards/retry/home.
- Edge, server started inside this worktree, actual printed URL `http://127.0.0.1:5606/`. Screenshots visually inspected at1440×810 and1000×800, all4screens. No broken image or document horizontal overflow at1000×800.
- Browser interaction: search for Tụ Linh Đan returned4items; unmatched query showed empty state; use displayed fixture notice; completed-quest filter returned1quest; claim left its status unchanged; toggle changed true→false; storage action remained preview-only; retry showed reserved notice; home returned to Dong Fu.
- Browser console inspected:0errors/0warnings in the session.
- Screenshots: `docs/qa/huyen-kim-reference-fidelity/evidence/{settings,quest,inventory,defeat}-v2-{first,scaled}.png`.

## Handoff boundary

This is a UI-preview delivery, not QA_FIXED_POINT_REACHED or merge readiness. Full project QA, OCR/sequential aggregate approval, actual gameplay integration and production build packaging remain with the implementer as requested by the user. Vite dev serves these standalone preview entry pages; production multi-page packaging has not been modified or verified. Content icons and Quest banner remain replaceable fixtures. Do not mount new HUDs over old HUDs when integrating; replace presentation consumers deliberately while retaining their domain owners.
