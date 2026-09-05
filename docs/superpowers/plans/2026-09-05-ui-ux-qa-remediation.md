# TutienIdle UI/UX and Browser QA Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục các lỗi UI/UX đã xác nhận và xây dựng browser QA coverage cho accessibility, responsive layout, localization, reduced motion, modal lifecycle, combat overlays và các luồng lỗi/recovery.

**Architecture:** Ưu tiên giữ nguyên component boundaries hiện có. Dùng các primitive/composable sẵn có (`GameButton`, `ConfirmModal`, `OverlayPanel`, `useDialogFocus`, `ResizeObserver`) thay vì tạo hệ thống UI song song. Browser QA sẽ kiểm tra hành vi người dùng thật; Vitest vẫn dùng cho logic component thuần và Playwright dùng cho viewport, focus, pointer, canvas/DOM overlay, network và visual contracts.

**Tech Stack:** Vue 3 Composition API, TypeScript, Vue I18n, Vitest, Playwright, Phaser 4.

**Spec:** Kế hoạch này tổng hợp audit UI/UX, responsive, gameplay UX và E2E ngày 2026-09-05.

## Global Constraints

- Không thay đổi architecture hoặc thêm dependency nếu không cần thiết.
- Không dùng `any` mới.
- Không dùng native `window.alert()`/`window.confirm()` cho luồng UI mới; dùng shared in-game feedback/modal primitives.
- Mọi interactive control phải có semantics native hoặc ARIA đầy đủ, keyboard activation và visible focus.
- Mọi modal blocking phải có dialog semantics, focus trap, focus restoration và background blocking.
- Grid/card layout phải fit theo container thật; không thêm hard-coded column count cho main content.
- User-facing strings phải đi qua Vue I18n, gồm cả visible text và aria labels.
- Animation phải có `prefers-reduced-motion: reduce` behavior.
- Mọi claim “fixed” phải có regression test hoặc browser evidence.
- QA chỉ được sửa test/QA docs trong QA phase; production fix phải quay lại development workflow.
- Không đọc hoặc ghi secret files.

## Verification Baseline

Audit worktree evidence:

- `npm.cmd run type-check` — PASS.
- `npm.cmd run build` — PASS, nhưng có warning chunk lớn.
- Full Vitest — **2528 passed, 1 failed**: `src/core/game/GameManager.actionPlayback.test.ts` tại line 140; failure: enemy HP không giảm như expectation.
- Playwright list — 10 tests.
- Playwright run — **9 passed, 1 failed**: `turn-combat-hud.spec.ts` không thấy `.combat-victory-panel` trong timeout 120s.
- Vitest output có nhiều missing i18n key warnings, đặc biệt trong Settings, Stage Select, Realm, Breakthrough và Home Resource Strip.

Các failure và warnings trên là baseline issues cần được tách khỏi UI fixes; không được làm cho test pass bằng cách nới timeout hoặc sửa expectation thiếu bằng chứng.

---

## Findings Map

| ID | Finding | Severity | Plan task |
|---|---|---:|---:|
| UI-001 | Missing/weak visible focus styles | High | 1 |
| UI-002 | Theme card div button lacks Space/selected semantics | High | 1 |
| UI-003 | Auth fake tablist semantics | High | 2 |
| UI-004 | Auth validation errors not associated/announced | High | 2 |
| UI-005 | Modal-like overlays lack dialog/focus semantics | High | 3 |
| UI-006 | Toast clickable div / loading/reduced-motion gaps | Medium | 4 |
| UI-007 | Native alert/confirm flows | Medium | 5 |
| UI-008 | Locked controls appear actionable | Medium | 5 |
| UI-009 | Localization key gaps and hard-coded combat strings | Medium | 6 |
| UI-010 | Fixed columns and narrow-panel overflow | High | 7 |
| UI-011 | 100vh/100vw and safe-area risks | High | 7 |
| UI-012 | Combat HUD fixed offset/short viewport overflow | High | 8 |
| UI-013 | Result countdown lacks explicit cancel auto action | Medium | 9 |
| UI-014 | Error “Try Again” only clears error | Medium | 9 |
| UI-015 | Reward committed/saved state unclear | Medium | 9 |
| QA-001 | E2E only desktop; no mobile/touch matrix | P1 | 10 |
| QA-002 | No console/pageerror/request-failure gate | P1 | 10 |
| QA-003 | No keyboard/dialog/reduced-motion/browser a11y coverage | P1 | 10 |
| QA-004 | Brittle real-time waits and text selectors | P1 | 10 |
| QA-005 | Screenshots are artifacts, not assertions | P2 | 11 |
| QA-006 | Full missing-save/network/canvas recovery coverage | P1 | 12 |

---

## Task 1: Establish reliable focus and native interaction semantics

**Files:**

- Modify: `game/src/components/common/GameButton.vue`
- Modify: `game/src/components/settings/ThemeSwitcher.vue`
- Modify: `game/src/components/onboarding/AuthEntryScreen.vue`
- Modify: `game/src/components/onboarding/CharacterCreationScreen.vue`
- Test: related component tests; add focused tests where missing

- [ ] Add failing tests for visible `:focus-visible` on `GameButton`, auth inputs, name input, and theme controls.
- [ ] Replace `ThemeSwitcher` card `<div role="button">` with native `<button type="button">` while preserving test IDs and visual classes.
- [ ] Add `aria-pressed` for mutually exclusive theme buttons, or implement a complete radio group if that matches existing product semantics.
- [ ] Add Space activation coverage and verify Enter/Space do not double-trigger.
- [ ] Preserve a focus-ring fallback in `GameButton` even if `--focus-ring-chrome` is missing.
- [ ] Ensure disabled/loading buttons remain native `disabled` and expose `aria-busy` when loading.
- [ ] Add reduced-motion behavior for the shared button spinner.
- [ ] Run focused Vitest and browser keyboard smoke checks.

## Task 2: Correct auth tabs, form errors and onboarding feedback

**Files:**

- Modify: `game/src/components/onboarding/AuthEntryScreen.vue`
- Modify: `game/src/components/onboarding/CharacterCreationScreen.vue`
- Modify: `game/src/locales/vi.json`
- Modify: `game/src/locales/en.json`
- Test: auth/character creation component tests and E2E onboarding flow

- [ ] Decide whether auth mode controls are true tabs or a mode switch. If tabs, add `role="tab"`, `aria-selected`, `aria-controls`, linked tabpanel, and arrow-key navigation. If not, remove `role="tablist"`.
- [ ] Give each auth input stable IDs, labels, `aria-invalid`, `aria-describedby`, and field-specific error IDs.
- [ ] Mark submit-level errors as an appropriate live region and focus the first invalid field or error summary after failed submission.
- [ ] Add `aria-live` status for talent loading/reroll/error states and explicit retry copy.
- [ ] Disable attribute minus at zero and plus when no points remain; preserve handler guards.
- [ ] Add tests for keyboard-only onboarding and validation announcement semantics.
- [ ] Verify English/Vietnamese text lengths do not clip controls.

## Task 3: Normalize modal/dialog semantics and focus lifecycle

**Files:**

- Modify: `game/src/components/common/ConfirmModal.vue`
- Modify: `game/src/components/common/OverlayPanel.vue`
- Modify: `game/src/components/common/TutorialOverlay.vue`
- Modify: `game/src/components/common/OfflineSummaryModal.vue`
- Modify: `game/src/components/game/combat/CombatExitConfirmModal.vue`
- Modify: `game/src/composables/useDialogFocus.ts` only when tests demonstrate a gap
- Test: dialog focus tests plus Playwright dialog scenarios

- [ ] Add failing tests for accessible name/description and focus containment for each modal-like overlay.
- [ ] Generate stable per-instance IDs and connect visible headings/messages using `aria-labelledby`/`aria-describedby`.
- [ ] Add `role="dialog"` and `aria-modal="true"`; use `alertdialog` only for genuinely urgent/destructive confirmation.
- [ ] Reuse `useDialogFocus` for Tutorial and Offline Summary instead of duplicating incomplete overlay behavior.
- [ ] Add a visible heading and consequence text to CombatExitConfirmModal, or make it use the shared confirmation primitive.
- [ ] Test Escape behavior, click-outside behavior where supported, zero-focusable-content, nested dialogs, rapid reopen, and trigger removal before restore.
- [ ] Ensure modal overlays have scrollable content and safe-area padding on short/mobile viewports.

## Task 4: Fix notifications, loading states and motion preferences

**Files:**

- Modify: `game/src/components/common/ToastContainer.vue`
- Modify: `game/src/components/common/LoadingScreen.vue`
- Modify: `game/src/components/common/ActionFeedbackLog.vue`
- Modify: `game/src/components/panels/RealmPanel.vue`
- Modify: `game/src/components/menu/MenuLogo.vue`
- Test: relevant component tests and reduced-motion browser tests

- [ ] Replace clickable toast `div` behavior with an explicit dismiss button or keyboard-equivalent control.
- [ ] Separate toast live-region message from dismissal action so screen readers do not announce confusing interactive text.
- [ ] Add `role="status"`/localized loading text and `aria-busy` where appropriate.
- [ ] Add `prefers-reduced-motion: reduce` rules for loading spinner, action feedback transitions, realm aura, menu glow and shared button spinner.
- [ ] Add `:focus-visible` styling for feedback-log controls.
- [ ] Add wrapping/overflow rules for long localized toast and feedback messages.
- [ ] Test reduced motion with Playwright `page.emulateMedia({ reducedMotion: 'reduce' })`.

## Task 5: Make locked and destructive actions truthful

**Files:**

- Modify: `game/src/components/panels/StageSelectPanel.vue`
- Modify: `game/src/components/game/DongFuCommandWheel.vue`
- Modify: `game/src/components/onboarding/CharacterCreationScreen.vue`
- Modify: `game/src/components/panels/BuildingConstructionGate.vue`
- Modify: `game/src/components/panels/SettingsPanel.vue`
- Modify: `game/src/components/common/SaveIncompatibleScreen.vue`
- Test: component tests and E2E interaction tests

- [ ] Make locked stage nodes native-disabled when they are not meant to be selectable; otherwise keep them focusable only to expose a lock reason and prevent selection.
- [ ] Decide command-wheel locked-slot behavior: native `disabled`, or intentionally focusable explanatory control. In either case, ensure keyboard/pointer activation produces correct feedback.
- [ ] Replace `window.confirm()` in BuildingConstructionGate with shared in-game confirmation.
- [ ] Replace `window.alert()` in SettingsPanel with inline error/toast/alert modal and preserve focus for retry.
- [ ] Replace empty-callback confirmation in SaveIncompatibleScreen with a close-only alert/error state and reset file input where needed.
- [ ] Add tests proving locked actions cannot start gameplay and that error recovery can retry.

## Task 6: Complete localization and remove hard-coded user-facing UI strings

**Files:**

- Modify: `game/src/components/common/LoadingScreen.vue`
- Modify: `game/src/components/common/ErrorScreen.vue`
- Modify: `game/src/components/game/combat/hud/TurnCombatSkillBar.vue`
- Modify: other components identified by locale-key warnings
- Modify: `game/src/locales/vi.json`, `game/src/locales/en.json`
- Test: `game/src/i18n/index.test.ts` and locale smoke tests

- [ ] Inventory every missing key from Vitest output, beginning with Settings, Stage Select, Realm, Breakthrough and Home Resource Strip.
- [ ] Add matching keys to both `vi.json` and `en.json`; do not use raw key fallback as visible product copy.
- [ ] Move combat role labels, toggle labels, awaiting-choice text, Loading, Error, and recovery copy to i18n.
- [ ] Add parity test that recursively compares locale key paths and fails on missing keys.
- [ ] Add Playwright smoke flow in both locales and assert major accessible names are translated.
- [ ] Test long English strings for wrapping and no horizontal overflow.

## Task 7: Replace fixed layout assumptions with container-fit layouts

**Files:**

- Modify: `game/src/components/layout/GameRoot.vue`
- Modify: `game/src/components/layout/LeftPanel.vue`, `RightPanel.vue`
- Modify: `game/src/components/panels/EquipmentPaperdoll.vue`
- Modify: `game/src/components/panels/EquipmentHallPanel.vue`
- Modify: `game/src/components/panels/StageSelectPanel.vue`
- Modify: `game/src/components/panels/VendorPanel.vue`
- Modify: `game/src/components/onboarding/CharacterCreationScreen.vue`
- Modify: `game/src/components/onboarding/OnboardingChapter.vue`
- Modify: `game/src/components/menu/MainMenu.vue`, `MenuButton.vue`
- Modify: `game/src/App.vue`, `LoadingScreen.vue`, `AuthEntryScreen.vue` for viewport units
- Test: responsive component tests and Playwright viewport matrix

- [ ] At 621–900px, prevent two full side drawers from consuming the entire game viewport; use one shared character drawer/tabs or a constrained single-pane mode below the fit threshold.
- [ ] Replace hard-coded main-content grids such as 3-column paperdoll, 4-column tabs, 5-column stages and 3-column vendor cards with `auto-fit/auto-fill/minmax` or measured layout.
- [ ] Add compact breakpoints/container queries for 320–480px and large UI scale.
- [ ] Use `min-height: 100dvh` with fallback and `env(safe-area-inset-*)` padding for full-screen roots and bottom controls.
- [ ] Replace nested `100vw` where `width: 100%` is sufficient.
- [ ] Ensure onboarding cards and menu buttons use `box-sizing: border-box`, max inline size and vertical scroll on short screens.
- [ ] Add responsive tests for 320x568, 375x667, 768x1024, 900x600, 1366x768 and 1600x900.

## Task 8: Make combat overlay layout and controls resilient

**Files:**

- Modify: `game/src/components/game/combat/CombatSceneOverlay.vue`
- Modify: `game/src/components/game/combat/CombatTopBar.vue`
- Modify: `game/src/components/game/combat/hud/TurnCombatSkillBar.vue`
- Modify: `game/src/components/game/combat/BattleLogPanel.vue`
- Modify: `game/src/components/game/combat/CombatAiPanel.vue`
- Test: combat overlay component tests and Playwright interaction/geometry tests

- [ ] Replace independent absolute bottom offsets with a measured top/bottom HUD stack or publish measured inset CSS variables.
- [ ] Add short-height mode for 600–700px heights; ensure skill bar, turn order and build HUD do not overlap.
- [ ] Make the skill bar wrap, scroll or collapse predictably at 320–480px; preserve 44px touch targets.
- [ ] Constrain top-bar title and progress as independent flexible elements; allow safe wrapping/abbreviation.
- [ ] Anchor battle log above the measured bottom control stack; wrap long messages and provide collapse behavior.
- [ ] Give CombatAiPanel target selector an explicit label and verify every visible combat control is clickable despite root `pointer-events: none` layers.
- [ ] Add browser tests for pointer routing, canvas click-through prevention, mobile widths, short heights and long localized labels.

## Task 9: Clarify result, error recovery and reward persistence UX

**Files:**

- Modify: `game/src/components/game/combat/CombatVictoryPanel.vue`
- Modify: `game/src/components/game/combat/CombatDefeatPanel.vue`
- Modify: `game/src/components/common/ErrorScreen.vue`
- Modify: `game/src/components/common/OfflineSummaryModal.vue`
- Test: component and Playwright recovery flows

- [ ] Add explicit “Stop auto”/“Cancel auto” action during victory/defeat countdown and verify it stops the next automatic transition.
- [ ] Make reward state explicit: rewards added automatically, pending claim, or save pending; match actual domain behavior.
- [ ] Change ErrorScreen “Try Again” to actually retry/remount the failed operation, or rename it to “Dismiss” if it only clears the store.
- [ ] Make OfflineSummary a real blocking dialog with focus restoration and explicit Continue behavior.
- [ ] Test reload during stage selection, settings, confirmation, countdown and active combat; define safe recovery behavior.

## Task 10: Upgrade Playwright foundation and browser accessibility coverage

**Files:**

- Modify: `game/playwright.config.ts`
- Modify: `game/tests/e2e/helpers.ts`
- Create/modify: `game/tests/e2e/accessibility.spec.ts`
- Create/modify: `game/tests/e2e/responsive-input.spec.ts`
- Create/modify: `game/tests/e2e/error-recovery.spec.ts`
- Create/modify: `game/tests/e2e/localization.spec.ts`
- Create/modify: `game/tests/e2e/reduced-motion.spec.ts`

- [ ] Add desktop, compact desktop, mobile Chromium/touch and supported WebKit projects.
- [ ] Add a shared fixture that captures unexpected `pageerror`, console errors, failed requests and non-OK static responses; allowlist only documented intentional failures.
- [ ] Add keyboard-only journeys for auth, character creation, settings, command wheel, stage selection, combat exit, result and dialogs. Assert `document.activeElement`, Enter/Space, Shift+Tab, Escape and focus restoration.
- [ ] Add mobile/touch tests for tap, scroll, safe-area reachability and 320–480px layouts.
- [ ] Add accessibility role/name/state assertions for dialogs, buttons, tabs, progressbars, disabled controls and tooltips.
- [ ] Add `aria`/focus browser checks with `@axe-core/playwright` only if dependency policy explicitly permits it; otherwise use built-in role/name assertions and document the limitation.
- [ ] Add locale matrix for `vi` and `en`.
- [ ] Add reduced-motion browser scenarios.

## Task 11: Stabilize E2E timing, selectors and visual assertions

**Files:**

- Modify: `game/tests/e2e/create-to-combat.spec.ts`
- Modify: `game/tests/e2e/save-reload.spec.ts`
- Modify: `game/tests/e2e/turn-combat-hud.spec.ts`
- Modify: `game/tests/e2e/boot-fresh.spec.ts`
- Modify: `game/tests/e2e/combat-overlay-layout.spec.ts`
- Modify: `game/tests/e2e/ink-wash-ui.spec.ts`
- Create/modify: snapshot baselines only after independent visual approval

- [ ] Investigate the current `turn-combat-hud.spec.ts` timeout failure before changing timeout or expected result.
- [ ] Replace raw malformed/locale-specific text selectors with stable roles, test IDs or i18n-derived expected strings.
- [ ] Replace repeated `waitForTimeout` polling with event/state-based waits. Use Playwright clock control only where time is the subject.
- [ ] Add deterministic combat/test state hooks or fixture setup so result tests do not require 120–180 seconds of real gameplay.
- [ ] Convert static screenshots to `expect(page).toHaveScreenshot()` only for stable states; mask Phaser canvas/dynamic particles and define justified thresholds.
- [ ] Keep raw screenshots as diagnostics where useful, but ensure visual regressions can fail CI.

## Task 12: Add browser recovery coverage for save, network and canvas failures

**Files:**

- Create/modify: `game/tests/e2e/save-error-recovery.spec.ts`
- Create/modify: `game/tests/e2e/network-failure.spec.ts`
- Create/modify: `game/tests/e2e/canvas-failure.spec.ts`
- Modify production only in a separate development task if deterministic fault injection is missing

- [ ] Test malformed and incompatible local saves with visible recovery and re-import path.
- [ ] Test quota/save failure behavior using browser-controlled stubs where possible.
- [ ] Test auth/cloud-save failure and retry with mocked routes; never use real credentials or services.
- [ ] Test failed image/asset requests and usable fallback UI.
- [ ] Test Phaser/canvas bootstrap failure, visible error state, cleanup and recovery.
- [ ] Test Offline Summary presentation after reload/offline interval and ensure background controls are inaccessible.

## Task 13: Reproduce and isolate current baseline failures

This task must precede claiming the UI plan is complete.

- [ ] Investigate `GameManager.actionPlayback.test.ts:140` HP assertion failure. Determine whether it is a production regression, flaky fixture, target selection issue, or stale expectation. Do not change expectation without a behavior decision.
- [ ] Investigate `turn-combat-hud.spec.ts:45` missing victory panel. Capture trace/screenshot/logs and identify whether combat timing, random outcome, action playback, or selector is responsible.
- [ ] Convert each confirmed baseline defect into a focused reproduction test before production repair.
- [ ] Re-run the exact failing command after each fix.
- [ ] Record unrelated pre-existing failures separately from task-introduced failures.

## Final Verification Gates

For each production UI task:

1. Use `ui-ux-pro-max` guidance for the specific interaction/layout concern.
2. Load Vue best-practice guidance before editing `.vue` files.
3. Add a failing regression test when behavior is testable.
4. Implement the smallest scoped fix.
5. Run code simplifier before code review.
6. Run `npm.cmd run type-check` plus focused Vitest for quick verification.
7. Run Playwright focused browser scenarios for UI behavior.
8. Run `tutienidle-adversarial-qa` quick after implementation; escalate deep for broad lifecycle/save/time risk.
9. Run code review on the simplified diff and fix all findings at confidence ≥80.

Before UI milestone completion, use **full** verification:

```powershell
npm.cmd run type-check
npm.cmd run build
npx.cmd vitest run
npx.cmd playwright test --reporter=line
```

Stop on first failure, investigate systematically, fix the root cause, and rerun the same mode.

## Completion Criteria

- All P1 UI/UX findings have either a passing regression test or a documented product decision.
- No modal-like overlay lacks accessible name, modal semantics, focus containment and restoration unless explicitly non-blocking.
- No primary control relies on hover-only feedback.
- Theme, auth, dialogs, locked actions and combat controls work through keyboard and touch.
- No main content grid relies on a fixed column count where container-fit layout is required.
- Full-screen surfaces work with dynamic viewport height and safe-area padding.
- `vi` and `en` flows have complete keys for exercised UI.
- Reduced-motion mode is tested in browser for major animated surfaces.
- Playwright catches page errors, console errors and unexpected failed requests.
- E2E suite covers desktop, compact, mobile/touch, keyboard, localization and recovery flows.
- Current baseline failures are either fixed with evidence or documented as pre-existing blockers.

## Deferred / Notes

- Adding `@axe-core/playwright` requires explicit dependency authorization because dependency changes trigger full verification.
- Full visual redesign is out of scope; this plan targets correctness, accessibility, responsive behavior, feedback clarity and testability.
- Refactoring large components into smaller feature components is a follow-up unless needed to fix a concrete interaction defect.
- Removing unused Phaser physics bodies and optimizing bundle chunks belong to separate runtime/performance plans.
