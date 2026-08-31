# Task 1.5 Report — Mount theme on app startup

## Status
DONE

## Commit
- `7ccc061` — `feat(theme): apply theme to document on app mount`

## File modified
- `game/src/main.ts` (not `App.vue`)

## Why main.ts, not App.vue
The brief said "if using main.ts, add the same at the end of the file before
the mount." The pre-mount call is the stronger pattern: `applyToDocument()`
runs before `app.mount('#app')` and the very first Vue render therefore already
sees the correct `data-theme` attribute. An `onMounted` in `App.vue` would
run AFTER the first paint and reintroduce the flash of unstyled content that
the task exists to prevent. This mirrors the existing `initUiScale()` call
right above (same intent: "apply user preference before mount to avoid
flicker"). `useThemeStore(pinia)` is invoked with the explicit `pinia`
instance for the same reason the sibling `useErrorStore(pinia)` line a few
lines above does it — it runs outside any component's `setup()` context so
there is no implicit active pinia to resolve the store against.

## Verification
- `npm.cmd run type-check` (in `game/`): PASS — no errors, no warnings.
- `git log --oneline -3` shows the new commit on top of `e2ee685`.
- No `any` used; no new dependencies added; only `game/src/main.ts` touched.
- Manual dev-server probe (Step 5) was not run: the env is headless
  (no browser), and Step 5 is a visual check of the rendered DOM. The
  behavior is unit-covered by `themeStore.test.ts` (read/write of
  `data-theme`), and the call site passes the same `applyToDocument()`
  that those tests exercise.

## Concerns
- None. The change is the minimum required and matches the file's
  existing pre-mount preference-application pattern.
