# Static system-state design handoff

Worktree: `E:/tutienidle/.agent-worktrees/hoa-cau-fireball-vfx`. Branch: `codex/tien-hiep-ui-redesign`. App root: `game/`. No production wiring, commit or push.

## Files

- New `src/components/common/PcPaperDialog.vue`: compact content-flow host with title/body/footer slots, shared paper, fine-frame recipe and `pcPaperControlStyles`. Paper fill occupies exactly the frame's 5px inset; no opaque cream background is placed outside the fine border. Uses the shared artwork without scaling an entire full-page scene into a modal.
- New `src/ui-preview/SystemDesignPreview.vue`, `src/ui-preview/system-design.ts`, `ui-system-design.html`.
- Updated only the owned retreat example in `src/ui-preview/AuxiliaryDesignPreview.vue` to use the same compact host. Existing full-page auxiliary examples and all production modal hosts remain untouched. The prior auxiliary handoff's full-page-shell compact recipe is superseded by this host.

## Examples

At `http://127.0.0.1:5449/ui-system-design.html?example=feedback|confirm|entitlement|incompatible|loading` with one example value:

- Feedback: source-consumer category, description, reproduction steps, optional contact, diagnostic opt-in, local report preview/status and footer actions. Inputs change local preview state only. No storage, submission, export, external message, diagnostic collection or service call.
- Confirm: compact question/detail and two action samples.
- Entitlement: three actual talent names/rarities and shortened source-consistent descriptions (Kiếm Quang, Phá Giáp, Tật Phong), a distinct owned Thạch Giáp upgrade sample, and one decision CTA. No close button, scrim action or dismiss event. The displayed offers are a static illustration, not a domain-drawn eligible set; no grant or resolution occurs.
- Incompatible: format message, preservation guidance, status and export/import/recheck samples. Reads or changes no save bytes.
- Loading: quiet approved warm opening landscape, ink title/status and explicit static progress illustration. It does not report real boot percentage.

No new per-modal art, shared CSS edits, stores, domain/service imports or introduced `any`. UI text goes through the preview i18n gateway. Existing FeedbackDialog, ConfirmModal, TalentEntitlementModal, SaveIncompatibleScreen and LoadingScreen informed content kinds only; their ownership and behavior are unchanged.

## Visual evidence

Captured and visually inspected at 1672×941 and 1280×720:

- `runtime-evidence/design-system-feedback-{1672,1280}.png`
- `runtime-evidence/design-system-confirm-{1672,1280}.png`
- `runtime-evidence/design-system-entitlement-{1672,1280}.png`
- `runtime-evidence/design-system-incompatible-{1672,1280}.png`
- `runtime-evidence/design-system-loading-{1672,1280}.png`
- Refreshed `runtime-evidence/design-aux-dialog-{1672,1280}.png` after host migration.

Inspection confirmed contained paper fill, clear action separation, readable report/stat groups, aligned talent-card heading/content regions, and no clipped field/CTA text at either size. Loading was changed from the busy home vista to the quiet opening landscape and re-inspected. Talent upgrade uses a different sample identity from the new offers, preserving the source distinction visually.

Final `npm run type-check`: exit 0. Latest inspected browser console: 0 errors, 0 warnings. Browser closed and owned scratch snapshot removed. No function tests or production runtime claims: this is static implementer self-review. Coordinator owns independent visual acceptance and aggregate status. Common host supplies appearance and slots only, not modal focus trapping, escape policy, action eligibility, persistence or command wiring. No all-UI functional completion or QA fixed-point claim.
