# Collection and craft static design handoff

Worktree: `E:/tutienidle/.agent-worktrees/hoa-cau-fireball-vfx`. Branch: `codex/tien-hiep-ui-redesign`. App root: `game/`. No commit/push or production wiring.

New files: `src/ui-preview/CollectionCraftDesignPreview.vue`, `src/ui-preview/collection-craft-design.ts`, `ui-collection-craft-design.html`. Examples at `http://127.0.0.1:5449/ui-collection-craft-design.html?example=alchemy|forge|companion|artifact|vendor|quest` with one example value.

## Distinct workspaces

- Alchemy: recipe catalogue, balanced existing bronze cauldron illustration, selected herb, material/fuel and duration/output inspector.
- Forge: operation tabs, selected equipment and small equipment catalogue, separate before/after stat table, ore/spirit-stone cost inspector.
- Companion: existing owned roster, central shared companion brush glyph in a restrained gold medallion, stats, feeding material, EXP and feeding CTA. No recruitment composition.
- Artifact: one focal bản mệnh orb, five-grade track, three existing Ngũ Hành Châu path names, EXP and grade-upgrade cost inspector. No invented owned artifact bag or equipment slots.
- Vendor: material sales list with owned amounts and prices, quantity and sales summary. No purchase shop. Currency uses the shared authored jade glyph; material icons remain real item art.
- Quest: category tabs, objective/status list, detailed objective, rewards and claim composition.

The source consumer map, TranPhap/Artifact/Companion/Vendor consumers, enhancement cost interface, alchemy preview labels and quest detail regions informed the region kinds. These are illustrative samples, not validated production eligibility, formulas, costs or outcomes. Tabs expose active visual state only. Quantity updates a local illustrative total. CTAs issue no command. All UI copy uses the preview i18n gateway.

## Shared family

Reuses `SceneDesignCanvas`, `PcPaperScene`, `PcPaperTabs`, `PcPaperButton`, shared slot/charcoal inspector classes, brush icons, resource controls and existing cauldron/item assets. No shared CSS edits, new frame assets, art generation, store imports, gameplay imports, or authoritative rule changes. No introduced `any`.

## Evidence

- Final `npm run type-check`: exit 0 after material/currency and layout refinements.
- All six examples captured and visually inspected at 1672×941 and 1280×720. Evidence: `runtime-evidence/design-craft-{alchemy,forge,companion,artifact,vendor,quest}-{1672,1280}.png`.
- First captures exposed intrinsic companion-image overflow, the feeding CTA escaping the inspector, native gray button fills, and footer-note overlap. Corrected fixed grid sizing, contained image sizing, denser companion details, transparent list rows and footer positioning; recaptured and inspected the resulting layouts. Latest companion CTA remains inside the shared inspector frame.
- Latest browser console: 0 errors and 0 warnings. Browser closed; scratch snapshot removed.
- No function tests, production interactions or aggregate acceptance claimed. Coordinator owns independent visual acceptance.

## Remaining design limits

Independent visual review rejected the large gray question-mark fallback as a Medium family mismatch. Replaced it with the shared companion brush glyph in a restrained gold medallion and a localized note that companion illustration is pending. Refreshed and visually inspected both companion captures after the shared typography update; the CTA, labels and placeholder stay inside their layout regions. Type-check passed. This closes the question-mark mismatch but still does not establish authored companion hero-art acceptance. No enemy or player artwork was substituted to imply a new companion identity. Shared brush glyphs still contain some small stray marks; asset-owner cleanup is separate. Recipe/forge tabs and alternative roster/quest rows do not supply all distinct state designs or real commands. These are static baselines for visual review, not a migration-ready functional contract or QA fixed-point claim.
