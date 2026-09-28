# creation-meta — Fix Report

Branch: `devin/ui-fix-creation-meta` · Base: `origin/master`
Evidence screenshots: `fixed/*.jpg` (1280px, dev server :5566). QA ledger entry: `docs/qa/2026-09-28-creation-meta-ui-quick.md`.

Verification run: `npm run type-check` clean; `npx vitest run` scoped (architecture + components + composables + onboarding + locales + data) 177/177 green; runtime verified via Playwright screenshots on a live dev server.

## FIXED

### [High] Dark-on-dark headings across meta surface — FIXED
Confirmed in code + screenshots (`04`,`05`,`25`,`60`,`70`,`12`,`45`): every paper-art surface
uses `--paper-text` (dark ink) for headings while the InkNineSlice art renders dark. Root cause
needed *two* owners: (a) a token remap for the paper family onto the surface palette, (b) an
explicit `color` on the container, because bare `h1/h2/p` inherit `color` computed on the
screen root where `--paper-text` was still the light-theme value.
- New utility `.paper-on-dark` in `theme.css` (extracts the `.ink-drawer` remap contract without
  the drawer art) + `color: var(--surface-text)` for the inheritance path.
- Applied at: `.auth-card`, `.creation-panel`, `.tutorial-overlay__panel`,
  `.offline-summary__panel`, `.save-incompatible__panel`, `.error-screen__panel`,
  `.settings-panel`, `.confirm-modal__panel`.
- Verified: `fixed/01-auth-card.jpg` (h1 + active tab readable), `02-creation.jpg` (both h2s),
  `03-tutorial.jpg`, `06-settings.jpg`, `10-offline-summary.jpg`, `16-save-incompatible.jpg`.

### [High] Tutorial copy references removed UI — FIXED
Confirmed: step 1 said "Bấm Menu", step 7 referenced the removed "CHIẾN ĐẤU" bottom bar.
Re-authored all 9 steps in `vi.json`/`en.json` against current chrome (character figure / `Tab`
→ Bảng Lệnh; wheel destinations; teleport-array combat entry). `tutorialSteps.ts` now stores
`titleKey`/`bodyKey`; `TutorialOverlay` resolves through `t()`. Verified: `fixed/03-tutorial.jpg`
(step 1 reads "Bấm vào nhân vật đang tu luyện (hoặc phím Tab)"), `13-tutorial-en.jpg`.

### [High] No persistent navigation affordance — FIXED
Added a labeled caption pill under the character: `BẢNG LỆNH · TAB` (i18n'd), gold on hover,
hidden while the wheel is open (`.home-player__hint` in `DongFuScene.vue`). The trigger's
`aria-label` is localized. Verified: `fixed/04-home-hint.jpg`.

### [High] Language switch unreachable + EN half-translated — FIXED
- New `src/composables/locale.ts`: `LOCALE_OPTIONS`, `loadLocale`/`applyLocale`/`saveLocale`,
  `initLocale()` called in `main.ts` before mount (no VI flash); persisted at
  `tien-hiep-idle-locale`, storage-denial-safe.
- Switcher added in TWO places: auth card (`.auth-locale`, `data-testid="auth-locale-*"`) and
  SettingsPanel language section (`settings-locale-*` chips).
- Half-translation fixes: wheel slot labels moved to `labelKey` (15 keys, VI+EN), talent tag
  chips resolve `onboarding.creation.talentStep.tags.*` via `te()` with raw-key fallback,
  all hardcoded-VI template strings in shared components routed through `t()` (ToastContainer,
  TutorialOverlay, SaveIncompatibleScreen, ErrorScreen, ActionFeedbackLog, LoadingScreen,
  LoreCodex, App boot-error/autosave/reset toasts, DongFuScene aria/hint).
- Verified: `fixed/11-auth-en.jpg`, `12-creation-en.jpg`, `13-tutorial-en.jpg`, `14-wheel-en.jpg`
  (all slots English), `15-codex-empty.jpg`.
- Known boundary (documented, not a defect of this fix): talent/skill/quest *data content*
  stays Vietnamese under EN — that's content localization, out of slice scope; UI chrome is
  fully localized.

### [High] ConfirmModal theme clash + translucency — FIXED
Confirmed: SysModalBase chrome (navy/neon, translucent) inside ink surfaces. Rewrote
`ConfirmModal.vue` on the shared ink recipe: `Teleport`→body, opaque `--scrim` backdrop,
`surface-m-paper` + `frame-m-seal-corner` InkNineSlice + `.paper-on-dark`, `role="alertdialog"`
with `aria-labelledby/describedby`, `useDialogFocus` (Escape→cancel, no scrim-click), initial
focus lands on Cancel (safe default for destructive confirms). `SysModalBase.vue` deleted;
`.sys-modal` selector dropped from `GameButton`; e2e spec moved to `.confirm-modal`.
`layer` prop contract preserved (`saveGateModal` callers still pass it).
Verified: `fixed/07-confirm-modal.jpg`, `17-incompatible-confirm.jpg`.

### [Medium] SettingsPanel sparse column — FIXED
Sections now group into a responsive card grid (`.settings-panel__grid` → auto-fit ≥280px):
Lưu Trữ / Cỡ Chữ / Âm Thanh / Ngôn Ngữ. Verified: `fixed/06-settings.jpg`.

### [Medium] Wheel icons 404 — FIXED
Dropped the `<img>` icon pipeline (`public/assets/ui/wheel/` doesn't exist → every icon 404'd
then hid). Slots are labeled circles now — also the fix that makes labels i18n'd. Comment notes
how to restore when the art drop lands. Verified: `fixed/05-wheel.jpg`, `14-wheel-en.jpg`.

### [Medium] Wheel bottom slot clipped — FIXED
`outerOrbitRadius()` bottom margin 32px → 56px (half slot height + edge clearance; old margin
only accounted for edge space, not slot half-height). Verified: `fixed/05-wheel.jpg` —
"Truyền Tống Trận" fully visible at bottom apex.

### [Medium] Reload replays intro+auth, no continue — FIXED
`src/composables/resumeSession.ts`: `hasResumeCandidate()` (stored session OR resolvable save)
shortens the intro 3000ms→450ms in `App.vue`; `readResumeCandidate()` builds the continue
session (stored Supabase session verbatim, else fresh guest `{sessionId: crypto.randomUUID()}` —
same shape MockAuthService emits) + character name from the raw save. Auth card shows
`Tiếp Tục — {name}` (`data-testid="auth-continue-button"`). Verified: `fixed/08-auth-continue.jpg`
+ `09-after-continue.jpg` + `10-offline-summary.jpg` (continue → 3h offline modal fires).

### [Medium] Scripture codex empty dead end — FIXED
`LoreCodex` EmptyState now shows the drop source hint ("mảnh mối rơi ra khi thám hiểm và đánh
quái" / EN equivalent). Verified: `fixed/15-codex-empty.jpg`.

### [Medium] Talent tag chips raw keys — FIXED
`talentTagLabel()` maps `onboarding.creation.talentStep.tags.*` via `te()`/`t()` with raw-key
fallback for future tags. Verified: `fixed/02-creation.jpg` (VI: Phòng Thủ/Chiến Đấu/Tu Luyện),
`12-creation-en.jpg` (EN: Cultivation/Defense/Combat).

### [Low] Save-incompatible loses backdrop + heading contrast — FIXED
`InkWashBackdrop` added under the panel + `.paper-on-dark` (heading readable). Strings i18n'd.
Verified: `fixed/16-save-incompatible.jpg`.

### [Low] Post-reset no continuity — FIXED
`markResetNotice()` before reload (settings reset + incompatible reset);
`consumeResetNotice()` shows `onboarding.auth.saveCleared` on the auth card once
(sessionStorage, same-tab only — toasts can't render pre-boot). Implementation note in
`AuthEntryScreen.vue`.

### [Nit] Dead `components/menu/*` + `menu.main.*` keys — FIXED
MenuBackground/MenuButton(+test)/MenuLogo deleted (zero imports); `menu` group removed from
both locales.

### [Nit] Boot-error heading treatment — FIXED
`App.vue` boot-error block i18n'd (`errors.boot.*`); the block sits outside paper-art surfaces
so the dark-on-light default styling is correct for it — verified by code inspection
(cannot be exercised without a real boot failure; same treatment decision recorded).

### [Nit] "ĐẠO NAME" hybrid kicker — FIXED
`en.json` `nameStep.kicker` = "DAO TITLE" (matches EN step title "A title carried through the
immortal path"). Verified: `fixed/12-creation-en.jpg`.

## REJECTED

None — every finding verified true in code before fixing.

## DEFERRED / residual risks

- **Login-mode stored session without `userId`/`loginId`** (pre-Mission-F `sessionStorage`
  payloads only): `readResumeCandidate` emits it; `accountIdForSession` falls back to
  GUEST_ACCOUNT_ID, so continue lands on the guest save (or fresh game). Read-only resolution —
  cannot corrupt the user's real save; rare legacy edge. (Low)
- **EN data content** (talent/skill/quest names+descriptions) remains Vietnamese: content
  localization, outside this slice; documented as boundary.
- **`TalentEntitlementModal`** keeps its own inline paper→surface token copy (predates the new
  `.paper-on-dark` utility). Left untouched — other slices' surface; candidate for later
  consolidation onto the shared utility. (Nit)
- **Wheel icons** intentionally dropped, not shipped — art drop can restore the pipeline
  (git history has it).

## P5 sequential review evidence

Sequential Review Pass 1 (Local Correctness)
  Reviewed state: post-OCR implementation (all 26 reviewable files read against the diff).
  Findings: h1/h2 inherited-color gap (found during evidence capture, Medium) — fixed by
  `color: var(--surface-text)` in `.paper-on-dark`; legacy-session userId edge (Low, deferred).
  Verification: type-check + 177 scoped tests + full re-shoot of all 11 VI screens.

Sequential Review Pass 2 (Architecture / Authority / Ownership)
  Reviewed state after Pass 1 fixes: YES (theme.css re-review).
  Findings: none Medium+. Ownership preserved — locale owner mirrors uiScale.ts contract;
  resumeSession is read-only presentation assembly; catalogs keep data-as-keys; single token
  map owner. No orphan references to SysModalBase/.sys-modal/components-menu (grep-verified).
  Verification: type-check.

Sequential Review Pass 3 (Adversarial Integration)
  Reviewed state after Pass 2 fixes: YES (no Pass 2 changes needed).
  Findings: probed continue-double-submit (guarded by `submitting`), reset→continue with
  no save (routes to creation — desired), denied storage (try/catch everywhere), teleported
  modal z-index vs saveGate (callers pass `layer`; verified shot 07/17), e2e selector breakage
  ('Bỏ Qua' still matches vi.json), `te()` availability (vue-i18n 11). None confirmed.
  Verification: runtime screenshots 01-17, key-parity script over both locales.

Adversarial QA (P4, quick): PASS WITH EVIDENCE — `docs/qa/2026-09-28-creation-meta-ui-quick.md`.
OCR (P18): delegation-mode review over the full task diff, 26/26 files, clean pass on the
post-fix state.
