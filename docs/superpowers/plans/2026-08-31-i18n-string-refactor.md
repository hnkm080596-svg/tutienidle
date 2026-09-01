# Plan: i18n & String Refactor — TutiênIdle

**Spec:** `docs/superpowers/specs/2026-08-31-i18n-string-refactor.md`
**Branch:** `feat/i18n-string-refactor`
**Worktree:** `E:\tutienidle\.agent-worktrees\i18n-refactor`
**Base:** `070cdeb` (master: fix: MainMenu overlay + missing theme tokens)

## Global Constraints

1. **Stack:** Vue 3 + TypeScript + Pinia + Phaser + Vite + Vitest.
2. **Architecture:** No changes to game state, save system, or core loops. UI-only refactor.
3. **Dependencies:** Adding `vue-i18n` is APPROVED (user chose "Full P0+P1" option). No other new deps.
4. **No `any`** unless genuinely necessary.
5. **Don't change architecture** beyond adding i18n layer.
6. **Focused changes** to rewrites — minimize churn.
7. **Verification per task:** `npm.cmd run type-check` + relevant vitest files. Full suite for high-risk tasks.
8. **Save migration:** NOT required (dev build, per AGENTS.md).
9. **Tests:** Project uses `createApp`+`h` mounting (see `ThemeSwitcher.test.ts`). `@vue/test-utils` not installed.
10. **Commit cadence:** one commit per task. Do not amend prior commits. Do not push, do not merge to master.

## Task Index

| # | Title | Type | Estimated Touch |
|---|-------|------|-----------------|
| 1 | Extract `<RewardList>` component | P0 mechanical | 3 files |
| 2 | Centralize `"Linh Thạch"` fallback | P0 mechanical | 5 files |
| 3 | Adopt `formatStat()` everywhere (9 sites) | P0 mechanical | 9 files |
| 4 | Dedupe `CombatScene.ts` through `combatTextFormat.ts` | P0 mechanical | 2 files |
| 5 | Move `RESOURCE_TYPE_LABELS` to `core/skill/SkillResourceLabels.ts` | P0 mechanical | 4 files |
| 6 | `vue-i18n` setup + `vi.json`/`en.json` skeleton | P1 setup | 4 files + 1 dep |
| 7 | Externalize ~400 UI chrome strings | P1 large | ~50 files (batched) |
| 8 | `formatDuration()` central function | P1 mechanical | 7 files |
| 9 | `formatNumber` locale unify (`vi-VN` → default) | P1 mechanical | 2 files |
| 10 | `core/i18n/termGlossary.ts` + audit | P2 polish | 5 files |
| 11 | Final code review + merge prep | Final | branch only |

---

## Task 1: Extract `<RewardList>` component

**File(s) involved:**
- `game/src/components/game/combat/CombatVictoryPanel.vue:115-121` (8 lines)
- `game/src/components/game/combat/CombatDefeatPanel.vue:89-95` (8 lines, wrapped in `v-if="hasAnyReward"`)
- New: `game/src/components/game/combat/RewardList.vue` (the shared component)

**Spec compliance:** Both panels render identical 5-line reward list. Extract to one component consumed by both. Single source of truth.

**Contract:**

```ts
// RewardList.vue — props
interface Props {
  summary: CombatSummary  // has: techniqueInsight, skillInsight, artifactInsight, spiritStone, items[]
}
```

Accept `summary` of same shape used in both panels. Render the same 5 lines (techniqueInsight, skillInsight, artifactInsight, spiritStone, items). Caller wraps with class for styling (the only diff between the two original snippets is class name + v-if guard).

**Tests:** `game/src/components/game/combat/RewardList.test.ts`
- Mount with summary having all 5 fields → renders 5 `<p>` lines
- Mount with empty summary → renders 0 lines
- Use `createApp`+`h` pattern (no @vue/test-utils)
- Use `MemoryStorage` pattern if localStorage needed (not here)

**Commit:** `refactor(combat): extract <RewardList> shared by victory/defeat panels`

---

## Task 2: Centralize `"Linh Thạch"` fallback

**File(s) involved (4 hardcoded fallbacks):**
- `game/src/components/panels/SpiritSpringPanel.vue:62` — `: 'Linh Thạch'`
- `game/src/components/panels/ProductionPanel.vue:173` — `: 'Linh Thạch'`
- `game/src/components/panels/EquipmentHallPanel.vue:645` — `: 'Linh Thạch'`
- `game/src/components/panels/bag-sections/MaterialBagSection.vue:44` — `spirit_stone: 'Linh Thạch'`

**Approach:** All 4 sites use the same `spirit_stone` material id. `core/presentation/labels.ts:16` `materialLabel(id, registry)` already returns the registered name from `MaterialRegistry`. Replace `?? 'Linh Thạch'` with `?? materialLabel('spirit_stone', registry)`. The fallback "Linh Thạch" itself becomes one constant in `labels.ts` so future renames touch one place.

**Steps:**
1. Add `SPIRIT_STONE_LABEL = 'Linh Thạch'` const at top of `core/presentation/labels.ts`.
2. Use it as the default in `materialLabel('spirit_stone', registry)` (the registry returns null/undefined when not registered).
3. In all 4 panel sites, import `materialLabel` and use `materialLabel('spirit_stone', registry) ?? SPIRIT_STONE_LABEL` (or just `materialLabel(...)` if the registry always returns a value).

**Tests:** `game/src/core/presentation/labels.test.ts` — add test for SPIRIT_STONE_LABEL constant.

**Commit:** `refactor(labels): centralize 'Linh Thạch' fallback via materialLabel()`

---

## Task 3: Adopt `formatStat()` everywhere

**9 bypass sites to migrate (per analysis):**

| # | File:line | Current code | Replacement |
|---|-----------|--------------|-------------|
| 1 | `core/skill/SkillResourceStatLabels.ts:53` | `${(value * 100).toFixed(1)}%` | `formatStat('manaShieldPercent', value)` (analogous) |
| 2 | `composables/useTechniqueSections.ts:69` | `${(tierEffect.maxMpPercent * 100).toFixed(1)}%` | `formatStat('maxMpPercent', tierEffect.maxMpPercent)` (new key) |
| 3 | `composables/useTechniqueSections.ts:73` | `${(tierEffect.manaRegenPercent * 100).toFixed(2)}%/s` | `formatStat('manaRegenPercent', tierEffect.manaRegenPercent) + '/s'` |
| 4 | `composables/useRealmStatPassives.ts:40` | `${((modifier.percent ?? 0) * 100).toFixed(1)}%` | new `formatStat('realmPassivePercent', percent)` |
| 5 | `components/panels/EquipmentHallPanel.vue:1003` | `{{ statRow.percent.toFixed(1) }}%` | new helper or pass through `formatStat` |
| 6 | `game/scenes/CombatScene.ts:147` | `tenth.toFixed(1)` | `formatDotDamageText()` (separate task 4) |
| 7 | `components/panels/ProductionPanel.vue:221,224` | `row.speedMultiplier.toFixed(2)` | `formatStat('speedMultiplier', ...)` |
| 8 | `components/panels/ArtifactPanel.vue:74` | `getArtifactGradeMultiplier(...).toFixed(2)` | new helper |
| 9 | `components/panels/bag-sections/PillBagSection.vue:65` | `(effect.cultivationPercent * 100).toFixed(1)` | `formatStat('cultivationPercent', ...)` |

**Note:** Some sites (#5, #8) format a number that isn't a stat key — they're displaying a multiplier. The cleanest refactor: extend `formatStat()` to accept either a known `StatKey` OR a `{ multiplier: true }` option, OR add a sibling `formatMultiplier(value, decimals=2)`. Decide in implementation: prefer adding `formatMultiplier()` to `core/format/NumberFormatter.ts` for non-stat multipliers, and add new stat keys (e.g. `speedMultiplier`, `cultivationPercent`) to `StatMetadata` for true stats.

**Tests:** Add test cases for any new stat keys in `StatMetadata.test.ts` and `StatLabels.test.ts`. Ensure each migration site has either an existing test (if it has a test file) or a snapshot/visual check.

**Commit:** `refactor(stats): adopt formatStat() at 9 bypass sites`

---

## Task 4: Dedupe `CombatScene.ts` through `combatTextFormat.ts`

**File(s) involved:**
- `game/src/game/scenes/CombatScene.ts:142-147` — inline `tenth.toFixed(1)` damage text logic
- `game/src/game/scenes/combat/combatTextFormat.ts:10-20` — `formatDotDamageText()` already extracted (fix from 2026-08-26)

**Spec compliance:** The bug fix that created `combatTextFormat.ts` was never propagated. Replace inline logic with `formatDotDamageText()` import.

**Steps:**
1. Read `CombatScene.ts:142-147` to confirm logic mirrors `formatDotDamageText()`.
2. Import `formatDotDamageText` from `combatTextFormat.ts`.
3. Replace inline template with `formatDotDamageText(value)`.
4. If inline logic differs (e.g. different rounding), call out the difference in the report and migrate to the canonical formatter.

**Tests:** `game/src/game/scenes/combat/combatTextFormat.test.ts` — if not present, add unit test for `formatDotDamageText` covering integer, decimal, and large values.

**Commit:** `refactor(combat): use formatDotDamageText from combatTextFormat.ts`

---

## Task 5: Move `RESOURCE_TYPE_LABELS` to `core/skill/SkillResourceLabels.ts`

**File(s) involved:**
- New: `game/src/core/skill/SkillResourceLabels.ts` — centralized resource labels
- `game/src/components/game/skill/SkillDetailView.vue:26-30` — current local definition
- `game/src/components/game/combat/CombatStatusBar.vue:163` — uses "Linh lực" hardcoded
- (Possibly) `game/src/components/game/skill/NodeInspector.vue` — needs verification

**Approach:**
1. Create `core/skill/SkillResourceLabels.ts` with `RESOURCE_TYPE_LABELS: Record<ResourceType, string>` and `resourceTypeLabel(type)` accessor.
2. Move the local definition from `SkillDetailView.vue:26-30` into the new file.
3. Update `SkillDetailView.vue` to import from new file.
4. Update `CombatStatusBar.vue:163` to use the same accessor instead of hardcoded "Linh lực".
5. Audit any other "Linh lực", "Kiếm Ý", "Đà Thế" hardcoded usages (grep `grep -rn "Linh lực\|Kiếm Ý\|Đà Thế" game/src`) and update.

**Tests:** `game/src/core/skill/SkillResourceLabels.test.ts` — unit test for `resourceTypeLabel()` mapping.

**Commit:** `refactor(skill): centralize RESOURCE_TYPE_LABELS in core/skill/`

---

## Task 6: `vue-i18n` setup + locale skeleton

**File(s) involved:**
- `game/package.json` — add `vue-i18n` to `dependencies`
- New: `game/src/locales/vi.json` — Vietnamese (default)
- New: `game/src/locales/en.json` — English (fallback / future)
- New: `game/src/i18n/index.ts` — `createI18n` config, register locales
- `game/src/main.ts` — `app.use(i18n)`

**Setup:**
1. `npm.cmd install vue-i18n@^9` (Vue 3 compatible).
2. Create `src/locales/vi.json` with empty object `{}` (Task 7 fills it).
3. Create `src/locales/en.json` with empty object `{}`.
4. Create `src/i18n/index.ts`:
   ```ts
   import { createI18n } from 'vue-i18n'
   import vi from '@/locales/vi.json'
   import en from '@/locales/en.json'
   
   export const i18n = createI18n({
     legacy: false,
     locale: 'vi',
     fallbackLocale: 'en',
     messages: { vi, en }
   })
   ```
5. Register in `main.ts`: `app.use(i18n)`.
6. Add `vi.stubGlobal` in test setup if needed for `useI18n()` to work in tests.

**Tests:** `game/src/i18n/index.test.ts` — i18n instance created, locale switching works.

**Commit:** `feat(i18n): install vue-i18n, create vi/en locale skeleton`

---

## Task 7: Externalize ~400 UI chrome strings

**Scope:** Extract user-facing strings from ~50 .vue files into `vi.json`/`en.json`. This is the largest task. Batch by panel family to limit review surface.

**Approach (batch by panel):**
- 7a: `EquipmentHallPanel.vue` (largest, 1364 VN chars)
- 7b: `CharacterPanel.vue` (652 VN chars)
- 7c: `NodeTreePanel.vue`, `SkillPathPanel.vue` (480+322)
- 7d: `QuanKhiPanel.vue`, `StageSelectPanel.vue` (363+345)
- 7e: Remaining panels (LuyenThePanel, MaterialBagSection, VendorPanel, SpiritSpringPanel, etc.)

**Pattern (per string):**
1. Identify hardcoded string in `.vue` `<template>` or `<script>`.
2. Add to `vi.json` under namespaced key: `panels.equipmentHall.tabs.enhance = 'Cường Hóa'`.
3. Add English version to `en.json`.
4. In `.vue`, replace literal with `{{ t('panels.equipmentHall.tabs.enhance') }}` or `t(...)` in script.
5. Test that translation renders.

**Constraints:**
- DO NOT touch data files (`data/**/*.ts`) — those are content (item names, lore) and are correctly localized via different mechanism.
- DO NOT touch tooltip text in `useEquipmentTooltip.ts` until Task 7's batch reaches it.
- DO NOT touch combat formulas, stat labels (already in `core/stats/StatLabels.ts`).
- Verify with: `npm.cmd run type-check`, then spot-check 2-3 panels visually.

**Test:** Add `game/src/locales/vi.test.ts` that asserts all keys referenced via `t('...')` exist in `vi.json` (lint the locale file vs scan code).

**Commit (batched):** `refactor(i18n): externalize equipment hall chrome strings (7a)` × 5.

---

## Task 8: `formatDuration()` central function

**File(s) involved (5 ad-hoc time formatters):**
- `game/src/components/panels/ProductionPanel.vue:130` — `${minutes}p ${padStart(s,2)}s`
- `game/src/components/menu/OfflineSummaryModal.vue:21-30` — `formatDuration()` already named but local
- `game/src/components/game/combat/CombatVictoryPanel.vue:130` — `{{ countdown }}s`
- `game/src/components/game/combat/CombatDefeatPanel.vue:105` — `{{ retryCountdown }}s`
- `game/src/components/game/combat/hud/KiemTuCombatHud.vue:64` — `elapsed.toFixed(1)/{{ tickSeconds }}s`
- `game/src/game/scenes/TribulationScene.ts` (verify)

**Approach:**
1. Create `game/src/core/format/formatDuration.ts` with signature:
   ```ts
   export function formatDuration(
     seconds: number,
     style: 'compact' | 'precise' | 'countdown' = 'compact'
   ): string
   ```
   - `compact`: `"2h 30p"` (matches current OfflineSummaryModal)
   - `precise`: `"2h 30m 15s"`
   - `countdown`: `"15s"` (matches combat countdowns)
2. Migrate all 5+ sites to use it.
3. Delete the local `formatDuration` in `OfflineSummaryModal.vue`.

**Tests:** `game/src/core/format/formatDuration.test.ts` — cover each style with multiple inputs.

**Commit:** `refactor(format): centralize formatDuration() in core/format/`

---

## Task 9: `formatNumber` locale unify

**File(s) involved (2 sites use wrong locale):**
- `game/src/components/panels/VendorPanel.vue:186,187,188,218,243,262,263` — `toLocaleString('vi-VN')`
- `game/src/components/panels/SpiritSpringPanel.vue:90,92` — `toLocaleString('vi-VN')`

**Approach:** Both sites display currency amounts (Linh Thạch). Replace `value.toLocaleString('vi-VN')` with `formatNumber(value)` from `core/format/NumberFormatter.ts` (which uses `en-US` + K/M/B/T suffix). Note: this changes display from `"5.000"` to `"5K"` — intentional consistency with rest of UI.

**Risk:** Visual regression for currency display. The user chose to prioritize consistency (option P0/P1) — record the visual change in commit message and ledger.

**Tests:** No new tests needed; existing `NumberFormatter.test.ts` covers `formatNumber`.

**Commit:** `refactor(format): use formatNumber() in VendorPanel and SpiritSpringPanel`

---

## Task 10: `core/i18n/termGlossary.ts` + audit

**File(s) involved (5+ files with terminology drift):**
- `game/src/core/i18n/termGlossary.ts` (new) — constants
- `game/src/components/panels/CharacterPanel.vue` — `Cấp`/`Tầng` mixed
- `game/src/components/panels/ArtifactPanel.vue` — `Cấp`/`Đẳng cấp` mixed
- `game/src/components/panels/LuyenThePanel.vue` — `Tầng` vs `cảnh giới`
- `game/src/composables/useRealmStatPassives.ts:20` — comment uses `cảnh giới`

**Glossary (constants in `core/i18n/termGlossary.ts`):**
```ts
export const TERMS = {
  // level/tier
  skillLevel: 'Cấp',        // for skill levels
  realmLevel: 'Tầng',       // for realm levels
  itemTier: 'Bậc',          // for equipment/skill tier
  // damage
  damage: 'Sát Thương',     // full
  damageAbbrev: 'ST',       // tight tables only
  // stat
  stat: 'Chỉ số',
  // attack/defense
  attack: 'Công Kích',
  defense: 'Phòng Thủ',
  // etc.
} as const
```

**Approach:** Add glossary, then update 5 files to import and use the constants instead of literals. Document the choice in `termGlossary.ts` JSDoc.

**Tests:** No new tests; visual consistency check.

**Commit:** `refactor(i18n): add termGlossary, fix level/tier drift`

---

## Task 11: Final code review + merge prep

**Steps:**
1. Run full verification: `npm.cmd run type-check`, full vitest, full playwright e2e.
2. Dispatch final code reviewer (most capable model) with branch diff.
3. Apply any fix findings.
4. Confirm all 10 prior tasks are `complete` in ledger.
5. Do NOT push or merge — user makes that decision per AGENTS.md.

**No commit** — this task is review-only and produces a final report.

---

## Execution Order

Tasks 1-5 are P0 mechanical, can run in any order (no inter-dependencies). Tasks 6-10 are P1, mostly sequential. Task 11 final.

Recommended order: 1 → 2 → 3 → 4 → 5 → 6 → 7a-7e → 8 → 9 → 10 → 11.

## Risk Notes

- **Task 6 (`vue-i18n`):** Adds dependency. Approved by user choice. Need to confirm with `npm.cmd install vue-i18n@^9` actually works in this npm setup.
- **Task 7 (large extraction):** 50 files touched. Risk of regression. Batch by panel to limit blast radius. Each batch is a separate commit.
- **Task 9 (locale change):** Visible display change `"5.000"` → `"5K"`. Documented in commit + ledger.
- **Task 3 (formatStat):** Adding new stat keys to `StatMetadata` may require updating tests. Implementer must run all `StatMetadata`/`StatLabels` tests.
