# Task 3.2 Report — Vue→Phaser theme sync

## Status
DONE

## Commit
- SHA: `c9cf44a`
- Message: `feat(theme): add Vue→Phaser theme sync`

## Changed Files
- `game/src/game/support/themePhaserSync.ts` (new, 18 lines)

## Verification
- `npm.cmd run type-check` (run from `game/`) → PASS (no errors)

## What Changed
Created a thin wiring function `installThemePhaserSync` that takes a scene accessor and uses a Pinia store watcher to call `applyTintToScene` whenever `currentTheme` changes.

## Remaining Limitations
- No automated test (per task brief — thin wiring; type-check is sufficient).
- Watcher will only fire on changes after `installThemePhaserSync` is called; the initial scene tint is not applied by this function. If needed, the caller should trigger an initial `applyTintToScene` separately.