# SDD ledger — plan: docs/superpowers/plans/2026-08-31-tu-tien-theme-redesign.md

## Rulings

**Ruling 1 (Task 1.6):** Brief hard-codes test expectation `index 2 → 'xianxia-glow'` but spec pins the registry order as `default, ink-minimal, landscape-shanshui, xianxia-glow, classical-imperial` — index 2 is `landscape-shanshui`. Implementer swapped the registry to make the test pass; that violates the spec. **Decision:** Revert the registry swap; fix the test to look up the `xianxia-glow` card by `data-theme-id` instead of array index. Cost if wrong: brief-driven test would have been misleading, not the registry (registry is the source of truth for every later consumer — store, composable, switcher, theme CSS).



### Cross-task contract table

| Producer task | Produces | Consumer task | Consumes | Verdict |
|---|---|---|---|---|
| 1.1 | `ThemeId` type, `THEME_REGISTRY` | 1.2, 1.3, 1.4, 1.6, 2.x, 3.1, 5.2 | `ThemeId`, `THEME_REGISTRY` | OK — consistent |
| 1.2 | 4 CSS files with `[data-theme="..."]` selectors | 1.7, 2-5 | CSS classes | OK — selectors match `ThemeId` values |
| 1.3 | `useThemeStore` with `{ currentTheme, setTheme, applyToDocument }` | 1.4, 1.5 | Pinia store | OK — signatures match |
| 1.4 | `useTheme()` returns `{ currentTheme, themes, setTheme }` | 1.6, 2.1, 2.2, 2.3, 5.1 | composable | OK — signatures match |
| 1.5 | calls `applyToDocument()` on mount | (none) | — | OK — terminal |
| 1.6 | `<ThemeSwitcher>` renders 5 cards | 5.6 | component | OK |
| 1.7 | imports 4 theme CSS files | (terminal) | — | OK |
| 2.1 | `<MenuButton variant label>` emits `click` | 2.4 | component | OK |
| 2.2 | `<MenuLogo>` | 2.4 | component | OK |
| 2.3 | `<MenuBackground>` | 2.4 | component | OK |
| 2.4 | `<MainMenu>` | router | component | OK |
| 2.5 | `<OnboardingChapter>` | (used in Phase 5 polish or later) | component | OK |
| 3.1 | `THEME_TINT_MAP`, `getTintForTheme`, `applyTintToScene` | 3.2, 3.7 | functions | OK — keys are `ThemeId` |
| 3.2 | `installThemePhaserSync(getActiveScene)` | 3.7 (called from Phaser scene init) | function | OK |
| 3.3-3.6 | refactor combat components to use theme tokens | 3.7 | — | OK — all use `var(--surface-*)`, `var(--chrome-*)` |
| 4.1-4.3 | refactor home components | 4.4 | — | OK |
| 5.1 | `<ThemedIcon name size>` | 5.2 | component | OK — `name` prop accepts string keys |
| 5.2 | `ICON_REGISTRY[ThemeId][iconName]` returns SVG path | 5.1 | registry | OK — 24 icons, 5 themes |
| 5.3-5.5 | refactor panel components | 5.7 | — | OK |
| 5.6 | integrate `<ThemeSwitcher>` into Settings | 5.7 | component | OK |

### Plan self-consistency check

- Task 1.1 test expects `THEME_REGISTRY[0]?.id` to be `'default'` — registry in Step 4 places `default` first. ✓
- Task 1.3 store action `applyToDocument` used by Task 1.5 — defined in Step 3, used in Step 2. ✓
- Task 3.1 `getTintForTheme` signature `(themeId: string)` accepts any string for fallback — used in `themePhaserSync` (Task 3.2) with the same wide signature. ✓
- Task 5.1 test mocks `@/composables/useTheme` via `useThemeStore` — composable wraps store (Task 1.4). ✓
- All paths in `theme.css` references are valid CSS variables.

**Scan result: CLEAN. No conflicts requiring rulings. Proceeding.**

## Task status

- [x] Task 1.1: theme registry — complete (commits d4ec83b..54634f3, review clean)
- [x] Task 1.2: 4 theme CSS files — complete (commits 54634f3..d416a2f, review clean)
- [x] Task 1.3: themeStore Pinia — complete (commits d416a2f..8c6704c, review clean; 3 minor findings parked: MemoryStorage inline definition, beforeEach order, Vietnamese comment)
- [x] Task 1.4: useTheme composable — complete (commits 8c6704c..e2ee685, review clean)
- [x] Task 1.5: mount theme on app startup — complete (commits e2ee685..7ccc061, review clean; pre-mount pattern instead of onMounted to prevent FOUC)
- [x] Task 1.6: ThemeSwitcher component — complete (commits 7ccc061..81ff8fa, fix round 1 addressed; registry order restored to spec, test uses data-theme-id lookup)
- [x] Task 1.7: import theme CSS files — complete (commits 81ff8fa..574b855, review clean)
- [x] Task 1.8: Phase 1 verification — complete (1503 tests PASS, typecheck PASS, build PASS, commit a34b622)
- [x] Task 2.1: MenuButton — complete (commits a34b622..9563797, fix rounds 1-2; final test uses parent-wrapper pattern to verify Vue emit)
- [x] Task 2.2: MenuLogo — complete (commits 9563797..189cb3a, review clean)
- [x] Task 2.3: MenuBackground — complete (commits 189cb3a..1e4a954, review clean)
- [x] Task 2.4: MainMenu + route — complete (commits 1e4a954..f031839, review clean)
- [x] Task 2.5: OnboardingChapter — complete (commits f031839..8d0fe51, review clean)
- [x] Task 2.6: Phase 2 verification — complete (1507 tests PASS, typecheck PASS, build PASS)
- [x] Task 3.1: phaserThemeBridge — complete (commits fbba725..c5fd665, fix round 1: import ThemeId from @/assets/themes; concerns 2&3 deferred to Phase 3 visual QA)
- [x] Task 3.2: themePhaserSync — complete (commits c5fd665..c9cf44a, review clean)
- [x] Task 3.3: CombatTopBar refactor — already using theme tokens, no changes needed
- [x] Task 3.4: CombatSkillSlot refactor — already using theme tokens, no changes needed
- [x] Task 3.5: CombatStatusBar/EventBar/ControlBar refactor — already using theme tokens, no changes needed
- [x] Task 3.6: CombatVictory/Defeat/ResultModal refactor — already using theme tokens, no changes needed (1510 tests PASS, build PASS)
- [x] Task 3.7: Phase 3 verification — complete (1510 tests PASS, build PASS, commit bb2e4b3)
- [x] Task 4.1: HomeResourceStrip refactor — already using theme tokens, no changes needed
- [x] Task 4.2: DongFuCommandWheel refactor — already using theme tokens, no changes needed
- [x] Task 4.3: DongFuBuildingSprite + BuildingDetailPopover refactor — removed hex fallbacks from BuildingDetailPopover (commit dd9aa40, 1510 tests PASS)
- [x] Task 4.4: Phase 4 verification — complete (1510 tests PASS, build PASS, commit 0e9d3bd)
- [ ] Task 5.1: ThemedIcon base
- [ ] Task 5.2: iconRegistry + 24 icons
- [ ] Task 5.3: StatRow/TabBar/GameButton/GamePanel refactor
- [ ] Task 5.4: SlotView refactor
- [ ] Task 5.5: panel files refactor
- [ ] Task 5.6: ThemeSwitcher integration
- [ ] Task 5.7: Phase 5 verification
