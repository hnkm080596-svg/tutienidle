# Full-suite execution at wave tip (b76cc97b) — EXECUTED evidence

Command: `npx vitest run` in game/ (worktree wave-target @ b76cc97b, npm ci clean).
Result: 762 files passed / 3 failed; 7188 tests passed, 3 failed, 4 expected-fail. Duration 262s.

Failures:
1. `src/assets/dongFuBackgroundAssets.test.ts` — `spawnSync magick ENOENT` (env-only: no ImageMagick on this VM; same failure class as master runs).
2. `src/assets/dongFuBuildingPipeline.test.ts` — same `magick` ENOENT (env-only).
3. `src/components/panels/SettingsPanel.test.ts > reset save` — `container.querySelector('.confirm-modal__confirm')` returns null. **Passes on master** (verified same VM, wave-qa-artifacts @ origin/master, 2/2 green). Wave-introduced.

## Root cause (source-verified)

M-UI-SYSTEM (a2dd7cfb) re-based `ConfirmModal.vue` onto `SysModalBase.vue`, which renders via
`<Teleport to="body">` (SysModalBase.vue:55). The old ConfirmModal rendered inline inside the caller's
subtree, so `container.querySelector('.confirm-modal__confirm')` in SettingsPanel.test.ts:38 found the
button. Post-rework the button teleports to `document.body`; the test still queries `container` → null.
The component itself is functional — this is a TEST_DEFECT (stale query scope), not a UI break.
