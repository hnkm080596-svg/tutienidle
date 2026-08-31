# Task 1.2 Report — Theme CSS files (4 new themes)

## What changed

- Created `game/src/assets/themes/ink-minimal.css`
- Created `game/src/assets/themes/landscape-shanshui.css`
- Created `game/src/assets/themes/xianxia-glow.css`
- Created `game/src/assets/themes/classical-imperial.css`
- Updated `game/src/assets/theme.css` line 10: expanded Google Fonts `@import` to include Ma Shan Zheng, Noto Serif SC, Noto Sans SC, Noto Sans TC, ZCOOL XiaoWei

## Verification

- `npm.cmd run type-check`: **PASS**
- `git log --oneline -3`: commit `d416a2f` present

## Constraints compliance

- No `any` used
- No new dependencies added
- No data tokens (`--rank-*`, `--grade-*`, `--affix-*`, `--el-*`, `--scene-*-*`) in new files — only theme-overridable tokens (`--ink-*`, `--paper-*`, `--chrome-*`, `--frame-*`, `--surface-*`, `--font-*`)
- All hex values verbatim from brief

## Commit

- SHA: `d416a2f`
- Message: `feat(theme): add 4 theme CSS files (ink-minimal/shanshui/xianxia/imperial)`

## Limitations / Notes

- CSS files are static; actual theme switching requires downstream task to load/link these CSS files and toggle `data-theme` attribute on `<html>` or `<body>`.
- Font availability from Google Fonts CDN is external; not verified at build time.
