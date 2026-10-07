# Auxiliary static design handoff

Worktree: `E:/tutienidle/.agent-worktrees/hoa-cau-fireball-vfx`. Branch: `codex/tien-hiep-ui-redesign`. App root: `game/`. No commit/push. Design-only deliverable; no production migration or gameplay wiring.

## Files and examples

- `src/ui-preview/AuxiliaryDesignPreview.vue`
- `src/ui-preview/auxiliary-design.ts`
- `ui-auxiliary-design.html`
- Open `http://127.0.0.1:5449/ui-auxiliary-design.html?example=formation|tooltip|dialog|settings` with one example value.

Formation has five equipped-item sample positions, a percentage-aligned diagram, and right inspector with effects, materials, and an action sample. The displayed diagram is explicitly not the actual combat placement model. Production `TranPhapPanel.vue` uses the standing-slot authority; this preview imports none of that logic.

Tooltip uses the shared 12-column Kho Vật composition, a persistent initial sword hover sample, grouped base/bonus stats, item metadata, and equipped status. Hovering/focusing the sword shows the sample tooltip; other slots hide it. It is a visual recipe, not a real equipment read-model.

Dialog uses a compact instance of `PcPaperScene` over a dimmed paper backdrop, with duration, cultivation, realm, and two sample CTAs. The compact recipe clips at the shared fine frame inset, so no cream rectangle extends beyond the border. The metric values are static illustrations and do not represent a resolved retreat result.

Settings uses left categories and a shared inspector on the right. Audio ranges, display select/toggle, storage buttons, and support action show the control layouts. Category selection and the control widgets change local preview state only; nothing saves, exports, imports, submits feedback, or changes production preferences.

## Shared-family boundary

Uses `SceneDesignCanvas`, `PcPaperScene`, `PcPaperTabs`, `PcPaperButton`, `pc-paper-slot`, `pc-paper-inspector`, `PcPaperIcons`, and existing item art. Inherits the latest authored item-slot, button, and charcoal rock inspector assets through `PcPaperScene`. No shared CSS edits, new frame family, generated art, gameplay imports, stores, or new authoritative rules. Vietnamese UI copy lives in the preview i18n gateway. No introduced `any`.

## Verification and limits

- `npm run type-check`: exit 0 after template/layout refinements. No function or gameplay tests run, matching design-only scope. Subsequent small sample corrections only changed audio icon choice and limited tooltip activation to its sword sample.
- Edge capture and visual inspection: all four examples at 1672×941 and 1280×720. Evidence: `runtime-evidence/design-aux-{formation,tooltip,dialog,settings}-{1672,1280}.png`; display category also captured as `design-aux-settings-display-{1672,1280}.png`.
- Formation diagram was corrected after the first capture so SVG vertices and item centers use the same percentage coordinates; resulting captures were inspected.
- Confirmed readable inspector/tooltip groups, no clipped metric or CTA text, no dialog paper outside its fine border, and no obvious overlapping labels at both sizes. Current shared assets supply the carved slots/buttons and rock-textured charcoal inspector.
- Browser console: 0 errors, 0 warnings in the inspected final settings page. Browser closed; scratch snapshot removed. Screenshots are intentional design evidence.
- Known shared asset detail: the formation icon contains three small stray marks above the main glyph. Reported to the coordinator/asset owner; no local masking or recoloring added.
- This is implementer self-review of static examples. Coordinator owns independent design comparison and aggregate acceptance. No production acceptance, QA fixed-point, runtime function readiness, or complete gameplay-state coverage is claimed.
