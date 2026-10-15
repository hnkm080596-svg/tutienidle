# QA Report — Phase 3 Slice 3.5: Move Combat `ui-assets` Readiness to Presentation Layer (2026-10-15)

## Scope & Rulings
- **V4b (`CombatSceneOverlay.vue` Freeze-Latch & Asset Readiness)**:
  - Extracted the `'ui-assets'` combat clock freeze latch (`registerFreezeLatchTruth`, `freezeCombat`, `resumeCombat`), DOM image/CSS background URL collection, active battle skill icon URL enumeration (`basic`, `special`, `ultimate`), `Image.decode()` batching, and `document.fonts.ready` wait out of `src/components/game/combat/CombatSceneOverlay.vue` into `src/presentation/combat/CombatChromeAssetGate.ts` (`bindCombatChromeAssetGate` + `mountCombatChromeRoot`).
  - Wired `bindCombatChromeAssetGate(coordinator, gameManager)` in `src/App.vue` alongside `bindPresentationActive(coordinator, gameManager)`, with symmetric teardown in `onUnmounted`.
  - Removed `'components/game/combat/CombatSceneOverlay.vue'` from the `ultimate` scope-token exception lists in `tests/architecture/betaFrontendScopeExposure.test.ts` and `tests/architecture/betaScopeRenderedTokens.test.ts`.
  - Updated `tests/e2e/presentation-routing.spec.ts` and `tests/e2e/combat-vertical-slice.spec.ts` to match `.exploration-scene` (`ExplorationSurface`) and assert live `.combat-scene-overlay` mount + `'ui-assets'` release.

## Verification Evidence
- **P3 Verification**:
  - `npm run type-check`: PASS (0 errors).
  - `npm run build`: PASS (`built in 9.48s`).
  - Focused + Architecture Vitest (`src/presentation`, `tests/architecture`, `src/components/game/combat`, `src/App.routeMountWitness.test.ts`): **176/176 test files passed (1,421 tests passed)**.
- **P13/P14 Runtime & Browser Verification**:
  - `npx playwright test tests/e2e/presentation-routing.spec.ts`: **1 passed (43.8s)** — verified full guest boot -> character creation -> home -> exploration stage start -> Phaser `CombatScene` active -> `.combat-scene-overlay` visible -> `manager.getFreezeReasons().includes('ui-assets') === false`.

## Sequential Review Passes (P5)

```
Sequential Review Pass 1
  Reviewed state: post-implementation Slice 3.5 diff (CombatChromeAssetGate.ts, CombatSceneOverlay.vue, App.vue, architecture & E2E tests)
  Findings:
    - [Low] Initial run of betaScopeRenderedTokens.test.ts flagged stale BENIGN entry for CombatSceneOverlay.vue :: ultimate because CombatSceneOverlay.vue no longer references ultimate.
    - [Low] CombatChromeAssetGate.test.ts required // @vitest-environment jsdom directive.
  Fixes:
    - Removed stale BENIGN entry in tests/architecture/betaScopeRenderedTokens.test.ts and added // @vitest-environment jsdom to CombatChromeAssetGate.test.ts.
  Verification:
    - Re-ran CombatChromeAssetGate.test.ts, betaScopeRenderedTokens.test.ts, betaFrontendScopeExposure.test.ts, and noVueGameplayFormulas.test.ts (4 files, 26 tests PASS).

Sequential Review Pass 2
  Reviewed state after Pass 1 fixes: YES
  Findings:
    - Checked ownership boundaries (A5, A7, P17): CombatSceneOverlay.vue no longer imports useGameManager, skillIconPath, turnSkillDisplayMetaOf, or resolveAssetUrl; presentation layer owns the freeze latch and asset readiness lifecycle. Zero confirmed Medium-or-higher findings.
  Fixes: None required.
  Verification: npm run type-check && npm run build PASS.

Sequential Review Pass 3
  Reviewed state after Pass 2 fixes: YES
  Findings:
    - Checked combat refight session rebind and unmount race handling in CombatChromeAssetGate.ts (generation counter invalidates in-flight decode on unmount or session switch) and live browser transition in presentation-routing.spec.ts. Zero confirmed Medium-or-higher findings.
  Fixes: None required.
  Verification: Playwright E2E presentation-routing.spec.ts PASS (1/1).
```
