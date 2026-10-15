# QA Report — Phase 3 Slice 3.6: Consolidate Button/Card/Panel Primitives & Remove Hidden Fidelity Headers (2026-10-15)

## Scope & Rulings
- **R10 — Unified Button Click Audio**:
  - Created `src/presentation/audio/buttonClickAudio.ts` exporting `playUiButtonClick({ sound, silent })` which unlocks `AudioManager.getInstance()` on user gesture and plays `ui.click` by default unless `sound === false` or `silent === true`.
  - Wired `playUiButtonClick` and `sound?: boolean` / `silent?: boolean` props into all canonical UI button primitives:
    - `src/components/common/GameButton.vue`
    - `src/components/common/art/OrnateButton.vue`
    - `src/components/common/art/EquipmentArtButton.vue`
    - `src/components/common/GameActionButton.vue` (forwards `:sound="sound" :silent="silent"` to `EquipmentArtButton` so click SFX never fires twice)
    - `src/components/common/GameTabButton.vue`
    - `src/components/common/PcPaperButton.vue`
    - `src/components/scenes/combat/CombatControlButton.vue`
- **D8 — Consolidate Card & Panel/Dialog Primitives**:
  - Migrated all callers of `EquipmentArtCard.vue` (`BodyPaperDetails.vue`, `QuestFidelityScene.vue`, and 9 preview panels under `src/ui-preview/`) to `GameCard.vue` and removed `src/components/common/art/EquipmentArtCard.vue`.
  - Folded `RailPanelDialog.vue` and `RailPanelChrome.vue` into `src/components/common/GamePanel.vue` via optional `dialog?: boolean`, `open?: boolean`, and `layer?: number` props; migrated `src/components/common/FeedbackDialog.vue` to `<GamePanel :dialog="rail ? true : undefined">` and removed `RailPanelDialog.vue` and `RailPanelChrome.vue`.
  - Removed dead `variant="system"` and `src/components/common/system/SysPanel.vue` from `src/components/common/OverlayPanel.vue` while keeping `src/assets/system-theme.css` intact per `systemThemeBoundary.test.ts`.
- **V5 — Remove Dead Hidden Fidelity Headers**:
  - Removed dead `:deep(.game-panel__content ...) { display: none; }` rules, dead `<img class="...-sheet">` / `<header class="...-head">` markup, and unused `paper` / `titleDivider` asset constants across `ProductionPanel.vue` and all 11 `*FidelityScene.vue` components (`AlchemyFidelityScene`, `BodyFidelityScene`, `CharacterFidelityScene`, `EquipmentFidelityScene`, `ExplorationFidelityScene`, `InventoryFidelityScene`, `QuestFidelityScene`, `RealmFidelityScene`, `SettingsFidelityScene`, `SkillFidelityScene`, `TechniqueFidelityScene`).
  - Updated `tests/e2e/ink-wash-ui.spec.ts` to query `.game-panel` and `.game-panel__title` inside `.settings-scene`.

## Verification Evidence
- **P3 Verification**:
  - `npm run type-check`: PASS (0 errors).
  - `npm run build`: PASS.
  - Architecture & Component Vitest (`tests/architecture/`, `src/components/common/`, `src/components/scenes/`, `src/components/panels/`): **196/196 test files passed (1,379 tests passed)**.

## Sequential Review Passes (P5)

```
Sequential Review Pass 1
  Reviewed state: post-implementation Slice 3.6 diff (button primitives, GamePanel, OverlayPanel, FeedbackDialog, 12 Fidelity/Panel components, uiPrimitiveConsolidation.test.ts)
  Findings:
    - [Low] Initial assertion in uiPrimitiveConsolidation.test.ts checked z-index on .rail-panel-dialog instead of .scene-viewport (the root element of SceneDesignCanvas).
  Fixes:
    - Updated uiPrimitiveConsolidation.test.ts to query .scene-viewport for the forwarded z-index style.
  Verification:
    - Re-ran uiPrimitiveConsolidation.test.ts (5/5 PASS) and src/components/common/ + src/components/scenes/ + src/components/panels/ (75 files, 349 tests PASS).

Sequential Review Pass 2
  Reviewed state after Pass 1 fixes: YES
  Findings:
    - Checked ownership boundaries (A1, A2, A5, R10, D8, V5): GameActionButton delegates click audio to EquipmentArtButton via :sound/:silent props (no double-trigger); GamePanel owns both inline rail-panel chrome and dialog overlay framing; zero hidden duplicate header elements remain in Fidelity scenes. Zero confirmed Medium-or-higher findings.
  Fixes: None required.
  Verification: npm run type-check && npm run build PASS.

Sequential Review Pass 3
  Reviewed state after Pass 2 fixes: YES
  Findings:
    - Checked audioBoundary.test.ts allowlist compatibility (buttonClickAudio.ts lives under src/presentation/audio/, which is inside the Pinia-free allowlist), overlayLayers.test.ts z-index contract, and systemThemeBoundary.test.ts. Zero confirmed Medium-or-higher findings.
  Fixes: None required.
  Verification: tests/architecture/ (121/121 test files PASS).
```
