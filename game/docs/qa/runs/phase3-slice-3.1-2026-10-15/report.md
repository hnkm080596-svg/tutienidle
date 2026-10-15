# QA Run Report — Phase 3 Slice 3.1: Prune Dead Code & Isolate Preview Scenes

- **Date**: 2026-10-15
- **Branch**: `slice-3.1-prune-dead-code`
- **Worktree**: `E:\tutienidle\.agent-worktrees\phase-1-beta-fixes`
- **Base Commit**: `26d81f349` (`master`)
- **Rulings Covered**: `R9` (delete dead UI code; move preview-only `FidelityScene` components to `src/ui-preview/`), `D5` (delete orphan `art-needed.css` while preserving `.art-needed` class markers), `D8` (delete `PcPaperScene` and `ImperialScrollScene`, inline preview wrappers).

## 1. Summary of Changes
1. **Deleted 59 Dead UI Files**:
   - Legacy duplicated panels & subtrees: `CharacterPanel.vue` + tests, `CharacterDetailCard.vue`, `BagGrid.vue`, `src/components/scenes/character/Character*.vue` (8 files), `src/components/scenes/realm/legacy/*` (14 files), `src/components/scenes/creation/*.vue` (14 files) + `art-needed.css`.
   - Dead shells & HUD widgets: `TabBar.vue`, `ImperialScrollScene.vue`, `PcPaperScene.vue` + `PcPaperSceneActions.vue` + `PcPaperScene.test.ts`, `CurrencyHud.vue` + test, `AutoFarmIndicator.vue` + test, `DongFuResourcePill.vue`, `usePaperNavigation.ts`.
   - 5 orphan CSS stylesheets in `src/assets/`: `pc-paper-auxiliary-production.css`, `tien-hiep-collections.css`, `tien-hiep-forge.css`, `tien-hiep-outcomes.css`, `tien-hiep-progression.css`.
   - Unused store actions in `src/stores/ui.ts`: `toggleLeft` and `toggleStandalonePanel`.
   - Dead `ImperialScrollScene` mount branch (`IMPERIAL_MODES`, `scrollMode`) in `src/components/layout/FunctionOverlayPanel.vue`.
2. **Isolated Preview-Only Components into `src/ui-preview/`**:
   - Moved `PaperPanelNavigation.vue` and 25 preview-only scene/subcomponent files (`CombatFidelity*`, `CreationSkillSymbol.vue`, `VictoryFidelity*`, `DefeatFidelityScene.vue`, `TribulationFidelity*`, `DongFuFidelityScene.vue`, `DongFuVista.vue`, `DongFuHud.vue`, `DongFuHomeContent*`, `DongFuArtFrame.vue`, `ForgeFidelityScene*`, `ForgeFidelityWorkspace.vue`, `ForgeBatchBag*`, `InventoryFidelityDetail.vue`, `QuestFidelityDetail.vue`) into `src/ui-preview/scenes/**`.
   - Decoupled shared production scene shells (`EquipmentFidelityScene.vue`, `InventoryFidelityScene.vue`, `QuestFidelityScene.vue`) from preview-only children by exposing `#forge` and `#detail` slots filled by `EquipmentPreview.vue`, `InventoryPreview.vue`, and `QuestPreview.vue`.
3. **Production Bug Fix Uncovered by Migrating Tests to Live `CharacterSurface.vue`**:
   - Fixed a beta-scope leak in `src/components/scenes/character/CharacterSurface.vue`: `daoIdentity` and `pathName` now gate on `isBetaWay` and `CULTIVATION_PATH_WAY_IDS[pathId]?.some(isBetaWay)` so a save carrying a dormant path/way (`sword`, `body`, `hidden_spell_pathway`) renders no non-beta identity on the character plate.
   - Added `:data-stat="stat.id"` in `src/components/scenes/character/fidelity/CharacterFidelityStats.vue`.
4. **Architecture Guard**:
   - Added `tests/architecture/uiPreviewIsolation.test.ts` pinning that no production file outside `src/ui-preview/**` imports from `ui-preview`, none of the deleted dead files exist, and all preview-only scenes reside in `src/ui-preview/scenes/**`.

## 2. Verification Evidence (P3 & Bundle Impact)
- **`npm run type-check`**: PASS (`0` errors).
- **`npm run build`**: PASS (`0` errors).
  - **Pre-Slice-3.1 Baseline**: `2,294` modules transformed; `index.css`: `365.73 kB` (`gzip: 68.11 kB`); `index.js`: `1,216.38 kB` (`gzip: 337.54 kB`).
  - **Post-Slice-3.1 Build**: `2,276` modules transformed (`-18` modules); `index.css`: `350.22 kB` (`gzip: 65.09 kB`, `-15.51 kB` raw / `-3.02 kB` gzip); `index.js`: `1,206.82 kB` (`gzip: 335.26 kB`, `-9.56 kB` raw / `-2.28 kB` gzip).
- **Vitest Suites**:
  - `tests/architecture` (116 test files, 996 tests): PASS.
  - `src/components`, `src/stores`, `src/composables` (137 test files, 725 tests): PASS.
  - `src/ui-preview` (7 test files, 14 tests): PASS.

## 3. Runtime / Browser Verification (P14)
- Booted Vite dev server from worktree `E:\tutienidle\.agent-worktrees\phase-1-beta-fixes\game` (`http://localhost:49814/`) and verified with Playwright Chromium:
  - Main app (`/`): rendered cleanly (`rootHtmlLen: 2252`), `0` console/page errors.
  - Preview routes (`legacy/ui-inventory.html`, `legacy/ui-equipment.html`, `legacy/ui-quest.html`, `legacy/ui-combat.html`): rendered cleanly with `#detail` and `#forge` slot fallbacks, `0` console/page errors.

## 4. P18 OCR, P4 Adversarial QA, and P5 Sequential Review Passes

```
Sequential Review Pass 1
  Reviewed state: Post-implementation diff across deleted files, moved src/ui-preview/scenes/**, and updated shared FidelityScene shells
  Findings:
    - [Medium] tests/architecture/uiPreviewIsolation.test.ts initially listed approximate paths for deleted CSS/component files rather than the exact repository paths (e.g. src/assets/pc-paper-auxiliary-production.css, src/components/panels/CharacterPanel.vue).
    - [Medium] src/ui-preview/EquipmentPreview.vue #forge slot initially checked only mode==='decompose' for ForgeBatchBag (missing mode==='dissolve') and omitted the compact prop on ForgeFidelityWorkspace.
  Fixes:
    - Updated deletedPaths in tests/architecture/uiPreviewIsolation.test.ts to match the exact deleted file paths.
    - Updated #forge slot in src/ui-preview/EquipmentPreview.vue to render ForgeBatchBag for both dissolve and decompose and pass compact to ForgeFidelityWorkspace.
  Verification:
    - Re-ran npm run type-check and npx vitest run tests/architecture/uiPreviewIsolation.test.ts src/ui-preview/remainingPreview.test.ts -> PASS.

Sequential Review Pass 2
  Reviewed state after Pass 1 fixes: YES
  Findings:
    - Checked ownership boundaries and import directions across src/components/scenes/{equipment,inventory,quest}/fidelity/* and src/ui-preview/**: zero imports from src/ui-preview/** exist in production code; shared FidelityScene shells own only production layout/slots.
    - No confirmed Medium-or-higher findings.
  Fixes: None required.
  Verification: tests/architecture/uiPreviewIsolation.test.ts + tests/architecture/frontendImportDirection.test.ts PASS.

Sequential Review Pass 3
  Reviewed state after Pass 2 fixes: YES
  Findings:
    - Adversarial integration check across migrated QA consumer tests (b18ConsumerHonesty, b19ConsumerScopeLeak, betaConsumerSeams, betaConsumerSeamsB8, InventorySort, CharacterSurface) and live browser preview routes: all consumer contracts hold on live production components.
    - No confirmed Medium-or-higher findings.
  Fixes: None required.
  Verification: Full architecture + component/store/composable + preview test suites PASS; P14 browser check PASS with 0 errors.
```
