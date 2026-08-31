# Task 2.2 — MenuLogo

## Worktree
`E:\tutienidle\.agent-worktrees\tu-tien-redesign` (branch `feat/tu-tien-theme-redesign`)

## Files
- Created `game/src/components/menu/MenuLogo.vue`

## What changed
- New presentation component `MenuLogo` rendering `<h1>TIÊN HIỆP IDLE</h1>` with a gradient underline div.
- `useTheme()` provides `currentTheme`; a `computed` switch returns the theme-appropriate `font-family` (default/ink-minimal → `var(--font-display)`, landscape-shanshui → Ma Shan Zheng, xianxia-glow → Noto Serif SC, classical-imperial → ZCOOL XiaoWei).
- `xianxia-glow` adds the `menu-logo--glow` class which applies a `text-shadow` pulse animation using `var(--surface-glow-gold)`.
- Scoped styles use `var(--surface-text)`, `var(--surface-eyebrow)`, `var(--font-display)`, `var(--surface-glow-gold)`.

## Verification
- `npm.cmd run type-check` (vue-tsc --build) → PASS.
- No test required per spec (pure presentation component).

## Commit
- `189cb3a feat(menu): add MenuLogo with 4 font variants`

## Limitations
- Web fonts (Ma Shan Zheng / Noto Serif SC / ZCOOL XiaoWei) must be loaded elsewhere in the app shell; this component only declares the `font-family` values.
- No tests written (out of scope per spec).
