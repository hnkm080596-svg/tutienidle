# QA Report — Phase 3 Slice 3.7: Consolidate CSS Cascade Layers & Final Phase 3 Gate (2026-10-15)

## Scope & Rulings
- **V6 — Consolidate Conflicting Global & Scoped CSS Cascade Layers**:
  - Consolidated all `.tran-phap-panel*` and `.queue-stand*` styling into a single authoritative stylesheet (`src/assets/tien-hiep-auxiliary.css`) and removed duplicate/conflicting `.tran-phap-panel*` and `.queue-stand*` declarations from `src/assets/tien-hiep-secondary-ui.css`.
  - Consolidated global `.game-button` paper overrides into `src/assets/pc-paper-production.css` and removed duplicate `.game-button`, `.hk-scroll`, and dead legacy `*-paper` / `*-title` rules from `src/assets/tien-hiep-ui.css`.
  - Merged duplicate same-selector declarations inside `src/assets/tien-hiep-ui.css`, `src/assets/tien-hiep-secondary-ui.css`, `src/assets/tien-hiep-auxiliary.css`, `src/assets/pc-paper-production.css`, and `src/components/game/combat/CombatSceneOverlay.vue` (`.combat-scene-overlay__battlefield`, `.combat-scene-overlay__ai-panel`, `.combat-scene-overlay__turn-order-strip`).
  - Added architecture guard test `tests/architecture/cssCascadeConsolidation.test.ts` (4/4 tests) enforcing single-file ownership of `.tran-phap-panel`, `.queue-stand`, and `.game-button` across global stylesheets and zero duplicate scoped selectors in `CombatSceneOverlay.vue`.
- **Full-Suite Determinism (`SaveSystem.conformance.test.ts`)**:
  - Fixed sub-millisecond `TimeAuthority` drift under heavy full-suite CPU load by mocking `performance.now()` (`vi.spyOn(performance, 'now').mockReturnValue(0)`) alongside `Date.now()` in `src/services/save/SaveSystem.conformance.test.ts`.
- **Playwright E2E Visual Smoke Alignment (`tests/e2e/ink-wash-ui.spec.ts`)**:
  - Updated `ink-wash-ui.spec.ts` for current `LoginOpening` (`auth-guest-button`, `login-opening`), `SettingsFidelityScene` (`GamePanel` `.game-panel` / `.game-panel__title`), `SettingsUiScaleSection` (`GameCard` `.game-card__title` + `#f3e4c4` text color), and awaited `.th-panel-swap-enter-active` transition completion before measuring `boundingBox()`.

## Verification Evidence
- **P3 Full Verification (`npm run verify`)**:
  - `npm run type-check`: PASS (0 errors).
  - `npm run build`: PASS (`dist/` built cleanly).
  - Full Vitest suite: **1,110/1,110 active test files passed (10,641 active tests passed, 0 failures)** (`4` skipped files, `16` todo/expected-fail).
  - Architecture test suite (`npx vitest run tests/architecture/`): **122/122 test files passed (1,034 tests)**.
- **P13 / P14 Runtime & Visual E2E Verification (Playwright inside implementation worktree)**:
  - `npx playwright test tests/e2e/presentation-routing.spec.ts`: **1/1 PASSED**.
  - `npx playwright test tests/e2e/ink-wash-ui.spec.ts`: **3/3 PASSED** (`desktop` 1600×900, `compact` 1280×800, `tall` 1440×900).

## Sequential Review Passes (P5)

```
Sequential Review Pass 1
  Reviewed state: post-implementation Slice 3.7 diff (tien-hiep-ui.css, tien-hiep-secondary-ui.css, tien-hiep-auxiliary.css, pc-paper-production.css, CombatSceneOverlay.vue, cssCascadeConsolidation.test.ts) + full verification run
  Findings:
    - [Medium] SaveSystem.conformance.test.ts exhibited a 0.00885 cultivation drift when run under heavy full-suite CPU load because TimeAuthority.now() adds performance.now() delta to Date.now(), and only Date.now() was mocked.
    - [Medium] tests/e2e/ink-wash-ui.spec.ts referenced legacy pre-Phase-3 selectors (.primary-action, [data-ink-slice="frame-xl-ceremony"], .settings-panel__ui-scale h4) and sampled .game-panel boundingBox during the .26s .th-panel-swap-enter-active translate(56px, -30px) transition.
  Fixes:
    - Added vi.spyOn(performance, 'now').mockReturnValue(0) in SaveSystem.conformance.test.ts beforeEach.
    - Updated ink-wash-ui.spec.ts selectors and awaited expect(page.locator('.th-panel-swap-enter-active')).toHaveCount(0) before measuring bounding boxes.
  Verification:
    - Re-ran src/services/save/ (97/97 active test files, 1,869 tests PASS) and npx playwright test tests/e2e/ink-wash-ui.spec.ts (3/3 PASS).

Sequential Review Pass 2
  Reviewed state after Pass 1 fixes: YES
  Findings:
    - Checked CSS cascade ownership boundaries (V6), @scope (:root) to (:is(.game-panel, ...)) isolation across all 4 global stylesheets, and Phase 3 aggregate invariants (Slices 3.1–3.7: 0 dead UI components, 1 activeHomeSurface owner in stores/ui.ts, 1 homeNavigationCatalog.ts owner, 0 domain formulas in Vue surfaces, 1 CombatAssetLoader presentation owner, unified button/card/panel primitives, and consolidated CSS cascade). Zero confirmed Medium-or-higher findings.
  Fixes: None required.
  Verification:
    - npx vitest run tests/architecture/ (122/122 test files PASS).

Sequential Review Pass 3
  Reviewed state after Pass 2 fixes: YES
  Findings:
    - Checked assembled runtime behavior in Chromium via Playwright across desktop (1600x900), compact (1280x800), and tall (1440x900) viewports: LoginOpening -> Guest start -> CharacterCreation -> HomeScene (Dong Fu) -> Dev radial wheel -> SettingsSurface (GamePanel + SettingsPanel + Display section GameCard) + presentation-routing E2E. Zero horizontal/vertical overflow, zero console/page errors, zero confirmed Medium-or-higher findings.
  Fixes: None required.
  Verification:
    - npm run type-check PASS; Playwright presentation-routing.spec.ts (1/1 PASS) and ink-wash-ui.spec.ts (3/3 PASS).
```
