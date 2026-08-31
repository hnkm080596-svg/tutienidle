# Task 3.1 Report — phaserThemeBridge

## Status
DONE_WITH_CONCERNS

## Commit SHA(s)
- `020d4db` — feat(theme): add phaserThemeBridge with tint map

## One-line test summary
3/3 tests PASS (THEME_TINT_MAP has 5 entries, getTintForTheme returns number for known theme, falls back to 0xffffff for unknown).

## What changed
- `game/src/game/support/phaserThemeBridge.ts` — exports `THEME_TINT_MAP` (5 theme-to-tint entries), `getTintForTheme(themeId: string): number`, and `applyTintToScene(scene, themeId)`.
- `game/src/game/support/phaserThemeBridge.test.ts` — 3 vitest tests covering map size, known-theme return, and unknown fallback.

## Verification
- `npm.cmd run test -- --run src/game/support/phaserThemeBridge.test.ts` → 3 passed
- `npm.cmd run type-check` → PASS
- `git log --oneline -3` → 020d4db on top of fbba725

## Concerns
1. **Missing `ThemeId` source**: The brief references `import type { ThemeId } from '@/assets/themes'` but `@/assets/themes` does not exist in this worktree at base `fbba725`. Theme-related commits (54634f3, d416a2f, etc.) exist on a parallel branch but are not merged. I inlined `ThemeId` as a local union type in `phaserThemeBridge.ts` to keep the task shippable independently. When Task 1.1's `ThemeId` lands, the import should be updated to point to `@/assets/themes` and the local type removed.
2. No integration with the actual theme store/Pinia yet — `applyTintToScene` is a stub that iterates scene children; it needs to be wired into a Phaser scene lifecycle to be useful.
3. The `THEME_TINT_MAP` tint values are estimated approximations of each theme's dominant background color. These may need adjustment after visual QA.

## Fix round 1

**Issue:** Replace the locally inlined `ThemeId` type with `import type { ThemeId } from '@/assets/themes'` (the module now exists in this worktree, so the import is resolvable).

**Diff summary** (`game/src/game/support/phaserThemeBridge.ts`, +3/−6):
- Removed the local `export type ThemeId = ...` union block (6 lines).
- Added `import type { ThemeId } from '@/assets/themes'`.
- Added `export { type ThemeId }` to re-export the type for existing consumers without changing the module's public surface.
- `THEME_TINT_MAP` now uses the imported `ThemeId`; all other code unchanged.

**Verification:**
- `npm.cmd run test -- --run src/game/support/phaserThemeBridge.test.ts` → 3 passed (3/3 PASS)
- `npm.cmd run type-check` → PASS
- `git log --oneline -3` → `c5fd665` (fix) on top of `020d4db` / `fbba725`

**New commit SHA:** `c5fd665` — fix(theme): import ThemeId from @/assets/themes in phaserThemeBridge

**Remaining concerns:** Concerns 2 and 3 from the original report still apply (scene lifecycle wiring and tint value visual QA). Concern 1 is now resolved by this fix.
