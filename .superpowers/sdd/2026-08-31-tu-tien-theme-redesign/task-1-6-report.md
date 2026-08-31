# Task 1.6 Report — ThemeSwitcher component

## Status
DONE

## Commits
- `1565bb9` — `feat(theme): add ThemeSwitcher component`
- `81ff8fa` — `fix(theme): restore registry order, locate xianxia-glow card by data-theme-id`

## Changed files
- `game/src/components/settings/ThemeSwitcher.vue` (new) — verbatim per brief
- `game/src/components/settings/ThemeSwitcher.test.ts` (new) — adapted to project
  pattern (no `@vue/test-utils` dependency); card lookup uses `data-theme-id`
  selector instead of index
- `game/src/assets/themes/index.ts` — unchanged from `7ccc061`; spec order preserved

## Fix round 1

**Ruling:** Brief hard-codes `findAll('[data-testid="theme-card"]')[2]` → expects `xianxia-glow`
at index 2, but the spec defines registry order as: default, ink-minimal, landscape-shanshui,
xianxia-glow, classical-imperial — index 2 is `landscape-shanshui`. The previous commit
swapped the registry to make the test pass; that violated the spec.

**Reverted:** `game/src/assets/themes/index.ts` — restored `THEME_REGISTRY` order to match
commit `7ccc061` (default → ink-minimal → landscape-shanshui → xianxia-glow → classical-imperial).
Verified: `git diff 7ccc061 -- game/src/assets/themes/index.ts` returns empty.

**Changed:** `game/src/components/settings/ThemeSwitcher.test.ts` — replaced index-based card
lookup in "clicking a card calls setTheme" with `data-theme-id` selector:

```diff
- const card = cards[2]
- card?.click()
+ const card = container.querySelector<HTMLElement>(
+   '[data-testid="theme-card"][data-theme-id="xianxia-glow"]'
+ )
+ card?.click()
```

**Verification:**
- `npm.cmd run test -- --run src/components/settings/ThemeSwitcher.test.ts src/assets/themes/index.test.ts` → 7 PASS (3 + 4)
- `npm.cmd run type-check` → PASS
- `git log --oneline -3` → `81ff8fa fix(theme): restore registry order, locate xianxia-glow card by data-theme-id` on top of `1565bb9`

**New commit:** `81ff8fa`

**Concerns fixed:** Concerns #1 and #2 from the original report are both resolved by this round.
The registry is back to spec order; the test locates the card by `data-theme-id` rather than
relying on positional assumptions.

## Remaining limitations
- No visual regression check (no screenshot tooling in this task). The card
  layout relies on CSS variables (`--surface-line-soft`, `--chrome-300`,
  `--surface-eyebrow`, `--surface-800`, `--font-body`, `--text-body`,
  `--surface-text`) that are defined in each theme's CSS file (verified
  `ink-minimal`, `landscape-shanshui`, `xianxia-glow`, `classical-imperial`).
  Default theme uses the base `theme.css` palette.
- Preview `<img>` sources are data-URI SVGs from the registry, so no external
  asset fetch is required at test time.
