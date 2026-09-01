# Spec: i18n & String Refactor — TutiênIdle

## Overview

Refactor the game's string layer to eliminate hardcoded Vietnamese text, remove duplicated rendering logic, and establish a real i18n foundation. No changes to game state, combat balance, or save system.

## Scope

### In scope
- Extract duplicated UI rendering blocks (e.g. `<RewardList>`)
- Centralize hardcoded label fallbacks (e.g. `"Linh Thạch"`)
- Route all stat/number formatting through central functions (`formatStat()`, `formatNumber()`, `formatDuration()`)
- Remove dead code duplication (CombatScene duplicate formatter)
- Move fragmented label registries to canonical locations
- Install `vue-i18n` and create locale files
- Externalize UI chrome strings (panel titles, button labels, error messages, action feedback) into locale files
- Standardize terminology via `termGlossary.ts`

### Out of scope
- Data content strings (`data/**/*.ts` — item names, skill descriptions, lore)
- Stat label registries already in `core/stats/StatLabels.ts`
- Game logic, save system, combat balance, Phaser scene code
- Adding new features or changing behavior

## Constraints

1. No `any` unless genuinely necessary.
2. No new deps except `vue-i18n@^9`.
3. No architecture changes beyond adding i18n layer.
4. Each task: implementation + relevant tests + type-check + build.
5. No `vue-i18n` breaking changes (same `createI18n` API, `legacy: false`).
6. All locale strings use namespaced keys: `panels.<name>.<element>`.

## Acceptance Criteria

| # | Criterion |
|---|-----------|
| 1 | `<RewardList>` renders in both `CombatVictoryPanel` and `CombatDefeatPanel` without duplication |
| 2 | `"Linh Thạch"` string appears in exactly one place in source |
| 3 | All 9 identified bypass sites use central formatting functions |
| 4 | `CombatScene.ts` uses `formatDotDamageText()` from `combatTextFormat.ts` — no duplicate |
| 5 | `RESOURCE_TYPE_LABELS` is consumed from `core/skill/SkillResourceLabels.ts` in all callers |
| 6 | `vue-i18n` is installed, `i18n` instance created, both `vi.json` and `en.json` exist |
| 7 | All ~400 UI chrome strings are keys in `vi.json`, referenced via `t('...')` in source |
| 8 | `formatDuration()` in `core/format/` covers all time-display use cases |
| 9 | `VendorPanel` and `SpiritSpringPanel` use `formatNumber()` (en-US) |
| 10 | `termGlossary.ts` defines canonical terms; no new hardcoded literals for the listed concepts |
| 11 | `npm.cmd run type-check` passes after every task |
| 12 | Full vitest suite passes after every task |
| 13 | Full e2e suite passes after task 7 (UI strings extracted) |
