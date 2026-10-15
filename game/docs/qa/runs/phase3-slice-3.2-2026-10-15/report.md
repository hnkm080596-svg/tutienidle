# Phase 3 Slice 3.2 QA Report — Single Owner for `activeHomeSurface` (`stores/ui.ts`)

- **Date**: 2026-10-15
- **Worktree**: `E:\tutienidle\.agent-worktrees\phase-1-beta-fixes`
- **Branch**: `slice-3.2-single-home-surface-owner`
- **Governing Rulings**: `V1`, `D4`, `D7`, `R7`, `R8`

## 1. Summary of Changes
1. **Contract (`src/presentation/contracts/panelIds.ts`)**:
   - Declared `HomeSurfaceId = Exclude<LeftPanelMode, null> | Exclude<StandalonePanel, null> | 'feedback'` (all 20 mutually disjoint home surface IDs) and re-exported from `src/stores/ui.ts`.
2. **Single Owner in `src/stores/ui.ts`**:
   - Refactored `useUiStore` so `activeHomeSurface = ref<HomeSurfaceId | null>(null)` is the **single authoritative state ref** in `store.$state` owning which home overlay surface is open.
   - Added `hasHomeOverlayOpen = computed(() => activeHomeSurface.value !== null)` and `openHomeSurface(surface: HomeSurfaceId)`.
   - Converted `leftPanelMode`, `standalonePanel`, `characterOverlayOpen`, and `characterSceneTab` into writable `computed` projections derived strictly from `activeHomeSurface` (and `lastCharacterSceneTab`), guaranteeing mutual exclusion across all 20 home surfaces by construction while keeping 100% compatibility with existing callers, `$subscribe` audio bindings (`uiAudioBinding.ts`), and test suites.
3. **Eliminated Local `feedbackOpen` & `watch(surfaceOpen)` (`src/components/scenes/dong-fu/DongFuStage.vue`)**:
   - Replaced local `feedbackOpen = ref(false)` and manual `watch(surfaceOpen)` with `feedbackOpen = computed(() => ui.activeHomeSurface === 'feedback')`, `ui.openHomeSurface('feedback')`, and `ui.hasHomeOverlayOpen`.
   - Documented Ruling `D4` in `src/components/common/ErrorScreen.vue` (local `feedbackOpen` ref exception for crash screen when app/store is faulted).
4. **Folded `LeftPanel.vue` into `FunctionOverlayPanel.vue`**:
   - Mounted `CharacterSurface` (`ui.activeHomeSurface === 'character'`) and `InventoryPanel` (`ui.activeHomeSurface === 'inventory'`) inside `FunctionOverlayPanel.vue`'s single `<Transition name="th-panel-swap">`, removed `LeftPanel.vue` from `GameRoot.vue`, and deleted `src/components/layout/LeftPanel.vue`.
5. **Architecture Guard & Unit Tests**:
   - Expanded `src/stores/ui.test.ts` and added `tests/architecture/singleHomeSurfaceOwner.test.ts`.
   - Updated `tests/architecture/uiPreviewIsolation.test.ts` to use `srcCorpus` + `SCAN_TIMEOUT` from `./helpers/scanTs` to prevent worker-contention timeouts under full-suite runs.

## 2. Verification Evidence (P3 / P14 / P18 / P4 / P5)
- **P3 Verification**:
  - `npm run type-check`: PASS (`0` errors)
  - `npm run build`: PASS (`2,274` modules transformed)
  - `npx vitest run tests/architecture src/stores src/presentation src/components src/composables`: `298/298` test files PASS (`2,080` tests PASS)
- **P14 Browser Runtime Check**:
  - Headless Chromium against worktree Vite dev server (`http://localhost:5181/`): `0` page errors, `0` console errors.

## 3. Sequential Multi-Pass Review (P5)

```
Sequential Review Pass 1 — Local Correctness / Regression
  Reviewed state: post-implementation Slice 3.2 diff
  Findings:
    - [Medium] `tests/architecture/uiPreviewIsolation.test.ts` walked the filesystem with a default 5000ms timeout, which timed out under 298-file parallel worker contention.
  Fixes:
    - Migrated `tests/architecture/uiPreviewIsolation.test.ts` to use shared `srcCorpus(SRC_ROOT)` and `SCAN_TIMEOUT` from `tests/architecture/helpers/scanTs.ts`.
  Verification:
    - Re-ran `npx vitest run tests/architecture/uiPreviewIsolation.test.ts tests/architecture/singleHomeSurfaceOwner.test.ts src/stores/ui.test.ts` -> 3/3 files (8/8 tests) PASS.

Sequential Review Pass 2 — Architecture / Authority / Ownership
  Reviewed state after Pass 1 fixes: YES
  Findings:
    - Verified `Object.keys(ui.$state)` contains `activeHomeSurface` and does not contain parallel state fields (`leftPanelMode`, `standalonePanel`, `characterOverlayOpen`, `characterSceneTab`).
    - Verified `DongFuStage.vue` has zero local `feedbackOpen` ref or `watch(surfaceOpen)` synchronization glue.
    - Verified `ErrorScreen.vue` carries the documented Ruling D4 exception comment.
    - No confirmed Medium-or-higher findings.
  Fixes: none required.
  Verification: `singleHomeSurfaceOwner.test.ts` (3/3 PASS).

Sequential Review Pass 3 — Adversarial Integration
  Reviewed state after Pass 2 fixes: YES
  Findings:
    - Checked `uiAudioBinding.ts` (`$subscribe` with `flush: 'sync'`): confirmed writable computed setters mutate `activeHomeSurface` in `$state`, triggering `$subscribe` synchronously and emitting identical `ui.panel.open` / `ui.panel.close` cues (`uiAudioBinding.test.ts` 6/6 PASS).
    - Checked beta scope mount-seam tests (`betaConsumerSeamMounts.qa.test.ts`, `betaConsumerSeams.qa.test.ts`, `betaScopeRenderedTokens.test.ts`, `betaFrontendScopeExposure.test.ts`): all PASS.
    - No confirmed Medium-or-higher findings.
  Fixes: none required.
  Verification: P3 + P14 PASS.
```
