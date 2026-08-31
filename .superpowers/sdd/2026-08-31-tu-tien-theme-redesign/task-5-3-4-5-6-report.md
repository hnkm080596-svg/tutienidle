# Task 5.3–5.6 Report — Common & Panels Theme Token Refactor

**Worktree:** `E:\tutienidle\.agent-worktrees\tu-tien-redesign`
**Branch:** `feat/tu-tien-theme-redesign`

## Status: DONE_WITH_CONCERNS

## Commit SHA: `30e9b52`

## Test Summary
type-check PASS, build PASS, vitest 252 files / 1510 tests ALL PASS.

## Per-file Summary

### Task 5.3 — Common components
- `game/src/components/common/primitives/StatRow.vue` — no hex found, no changes (already uses `--paper-*`, `--jade`, `--crimson`, `--gold-700` tokens).
- `game/src/components/common/TabBar.vue` — no hex found, no changes (pure layout CSS).
- `game/src/components/common/GameButton.vue` — replaced hardcoded `#fff` (secondary hover, danger default) with `var(--chrome-100)`.
- `game/src/components/common/GamePanel.vue` — no hex found, no changes (already uses `--surface-*`, `--font-*` tokens).

### Task 5.4 — SlotView
- `game/src/components/common/SlotView.vue` — already uses `--slot-*` tokens (`--slot-surface`, `--slot-border`, `--slot-valid`, etc.) plus `--rank-*` data tokens; no hex to replace, no changes.

### Task 5.5 — Panels
- `CharacterPanel.vue` — removed redundant hex fallbacks: `var(--paper-text, #211f1a)` → `var(--paper-text)`; `var(--paper-line, rgba(42,41,36,0.42))` → `var(--paper-line)`; gradient end `#fffdf7` → `var(--paper-50)`. Left `box-shadow: 0 2px 8px rgba(20,16,8,0.12)` as-is — no matching shadow token exists (only `--shadow-panel`, `--shadow-glow-chrome`, `--surface-shadow-*` which are visually different depths).
- `EquipmentHallPanel.vue` — removed 10 legacy hex/rgba fallbacks (`#211f1a`, `#5e5a50`, `rgba(42,41,36,0.42)` in var() fallbacks) → plain `var(--paper-text)`, `var(--paper-text-soft)`, `var(--paper-line)`; compare-table color-mix border → `var(--paper-line)`; dissolve page-dot shadow `rgba(0,0,0,0.35)` → `var(--surface-shadow-soft)`.
- `loadout-sections/TechniqueSlotCard.vue` — removed hex fallbacks (`#211f1a`, `#5e5a50`, `#b79653`) → `var(--paper-text)`, `var(--paper-text-soft)`, `var(--mineral-gold)`.
- `SkillPathPanel.vue` — `#000` in `mask-image` gradient left as-is: it is mask alpha channel control (opaque stop), not a visual color; no token maps cleanly to it. Noted, unchanged.
- Other panels (VendorPanel, TechniquePanel, StageSelectPanel, SpiritSpringPanel, QuestPanel, QuanKhiPanel, ProductionPanel, PillRoomPanel, LuyenThePanel, LoreCodexModal, ArtifactPanel, AlchemyView, InventoryPanel, EquipmentPaperdoll, BagGrid, BuildingConstructionGate) — no hex found, no changes.

### Task 5.6 — ThemeSwitcher integration into Settings
**BLOCKED / NOT DONE.** `game/src/components/settings/ThemeSwitcher.vue` does not exist anywhere in the repo (glob across worktree returned nothing; no `useTheme`/theme composable exists either). The task instruction assumes this component was created by an earlier task in the 36-task batch, but it is not present on this branch. Creating a new ThemeSwitcher component + theme store from scratch is outside the "only change hardcoded hex to tokens, no new imports" scope of this batch, so it was not fabricated. The SettingsPanel itself (`SettingsPanel.vue`) has no hardcoded hex — all colors are tokens — so it needs no refactor beyond the missing ThemeSwitcher mount.

## Remaining Limitations
1. **ThemeSwitcher does not exist** — Task 5.6 could not be completed. Whoever owns the task that creates `ThemeSwitcher.vue` (and its backing composable/store) must land it first; then SettingsPanel needs the import + `<ThemeSwitcher />` mount (one-line additions).
2. `CharacterPanel.vue` talent-block box-shadow rgba left hardcoded (no clean token match).
3. `SkillPathPanel.vue` mask-image `#000` left as-is (mask alpha control, not visual color).
4. Note: my first round of edits accidentally landed in the main checkout `E:\tutienidle\game` instead of the worktree — I re-applied all edits to the correct worktree paths and verified the main checkout files were restored to HEAD state (git status in main checkout is clean apart from pre-existing unrelated work; the accidental main-checkout edits were reverted via `git checkout --` on those 4 files before committing the worktree). **Verification confirms the final committed diff only touches the 4 intended files in the worktree.**

## Verification Evidence
- `npm.cmd run type-check` → PASS (vue-tsc --build, no errors)
- `npm.cmd run build` → PASS (615 modules, built in 7.16s)
- `npm.cmd run test` → 252 files, 1510 tests passed
