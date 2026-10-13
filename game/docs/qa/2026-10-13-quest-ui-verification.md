# Quest UI verification checkpoint — 2026-10-13

- Worktree: `E:\tutienidle\.agent-worktrees\quest-ui-review`.
- Branch: `codex/quest-ui-review`; baseline `e36ccec9324f404c798b2d8906d5f431dd4dcc50`.
- Scope: locked/available/claimed quest presentation, scene selection, and DongFu tracker only.
- Status: `QA_UNVERIFIED` — three focused P14 quest-scene browser cases pass, including claim/reopen; P18 task-diff host review has 15/15 paths accounted for, while independent review and aggregate QA remain incomplete; no fixed-point claim.

## Workflow remediation — 2026-10-13 (latest evidence)

- Added `scripts/qa/run-worktree-verification.ps1` with `Quest`, `Full`, and `E2E` modes. It sets `TEMP`/`TMP` inside this worktree's ignored `game/node_modules/.qa-runtime`, uses Vitest `--configLoader native`, and locates the existing user Playwright browser cache. E2E outputs use a new directory per run so previous evidence is retained. Full Vitest stops at the first failure (`--bail=1`) under the repository's QA stop-on-failure rule.
- Replaced the hard-coded `node node_modules/vite/bin/vite.js` E2E web-server command in `playwright.config.ts` with `npm run dev`. The worktree lacks `game/node_modules/vite/bin/vite.js` because its dependencies resolve through a parent checkout. The Playwright server now starts successfully from this worktree.
- Scoped verification: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/qa/run-worktree-verification.ps1 -Mode Quest` PASS (type-check; 4 Vitest files / 21 tests). The temporary rename `EPERM` did not recur.
- Browser investigation: the Playwright cache contained Chromium but the default sandbox lookup pointed elsewhere. With the cache set, sandboxed Chromium launch still exited `3221225506` (`0xC0000022`, access denied). An explicitly escalated Codex Native execution launched Chromium successfully (`BROWSER_SUCCESS quest`) with a persistent profile under ignored `node_modules/.qa-runtime`. Browser access therefore requires native sandbox escalation in this environment.
- Runtime verification (worktree server + actual Chromium): `huyen-kim-imperial-shell.spec.ts --grep 'scene 18 quest'` **PASS 3/3**, covering selected unlocked quest, locked preview, 1024x768 layout, domain kill-event test fixture, claim/unlock, home tracker refresh, Escape, and reopen selecting the successor; `beta-journey.spec.ts --grep 'quest panel carries no daily-quest'` **PASS 1/1**. Browser launch was approved via the native execution path. The initial attempt before the Vite-command repair failed with `MODULE_NOT_FOUND` for `node_modules/vite/bin/vite.js`; the rerun passed. Injected domain events do not constitute proof of a full real-combat kill-to-reward journey.
- Visual inspection of retained browser screenshots `test-results/huyen-kim/18-quest-tracker-1024.png` and `18-quest-after-claim-1024.png`: the three-column quest UI, badges, locked row, selected details, and post-claim list are visibly rendered without obvious panel clipping at 1024x768. Screenshots are letterboxed; broader responsive/device coverage is unverified.
- Full mode: `type-check` **PASS**, `build` **PASS**, Vitest **FAIL**. A pre-bail exploratory run encountered failures in beta scope, save, alchemy, art/canvas and other surfaces and was interrupted after the outcome was already known; retained log `node_modules/.qa-runtime/full-verify-20261013-103323.log`. The final `--bail=1` run exited 1 on `SkillPathPanel.test.ts:125` (way-less Mortal expected no respec button; actual button visible), test status `1 failed / 6 skipped` files, `2 failed / 1 passed` tests at stop point. Log: `node_modules/.qa-runtime/full-bail-20261013-104330.log`. These are NOT full-suite totals; baseline causality has not been established.
- The worktree QA workflow is operational for scoped tests and the tested browser journeys. The P18 preview enumerates **15 reviewable files** (`node_modules/.qa-runtime/ocr-quest-20261013-1230.json`), with 1141 excluded paths. Host OCR delegation-mode review accounted for **15/15 files**, with 0 confirmed Medium+ defects in the task diff; it does not replace independent review. Independent reviewer Goodall has not returned a verdict despite repeated 30-second polls. The three previously blocked QA/UX reference-file reads **succeeded when retried after user authorization**; the original refusal is resolved. Aggregate QA cannot claim a fixed point with incomplete independence and failing full Vitest. No file deletion, commit, push, merge or deploy performed.
- A later, separate combined native read of extended quest-domain source, screenshot path existence and diff whitespace check was refused by automatic safety assessment; no part of that combined request ran. Existing successful excerpts and screenshot review are reported only for their earlier verified scope; there is no claim that this additional read succeeded. The P5 report records three ordered inspection passes with no production fixes, while leaving this expanded source check unverified.

Re-run from `game/`: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/qa/run-worktree-verification.ps1 -Mode Quest`. For E2E, use `-Mode E2E -E2ESpec huyen-kim-imperial-shell.spec.ts -E2EGrep 'scene 18 quest'` in a Codex Native session where browser launch has been approved outside the sandbox.

## Implemented without commit

- `src/presentation/questUi.ts`: pure quest status, selection, tracker projections.
- `QuestScene.vue`: exclude locked previews from selection/detail, show localized locked-only detail.
- `QuestRow.vue`: visible ready-to-claim state, locked previews stay unselectable.
- `DongFuStage.vue`: select an available/active unlocked quest; hide tracker if none.
- `src/locales/{vi,en}.json`: parity for ready and locked detail.
- `src/presentation/questUi.test.ts`, `src/components/scenes/quest/list/QuestRow.test.ts`: pure and Vue behavior assertions.

## Evidence

- `npm run type-check`: PASS.
- `npm run build`: PASS, Vite transformed 2263 modules.
- Focused `vitest run` (questUi, QuestRow, QuestPreviewLocaleGap, i18nKeyParity, `--configLoader native`): 4 files / 21 tests PASS.
- `git diff --check`: PASS.
- Earlier unrestricted full-suite attempt: FAIL overall, `85 failed / 985 passed / 4 skipped` files, `80 failed / 9905 passed / 16 expected fail / 11 skipped` tests. Observed failures include Decompose save/restore, beta equipment scope, alchemy, Phaser canvas setup, and art tests. Clean-baseline comparison was not completed; failure attribution remains unresolved. Type-check and build stages succeeded.
- P18 `ocr delegate preview`: the newest JSON preview enumerates 15 reviewable task-owned files; delegation-mode rules were resolved for all 15 and the host inspected all changes, with coverage 15/15, 0 skips and 0 confirmed Medium+ defects. Earlier preview polling failed, but the later preview succeeded.
- P14: an earlier Edge launch failed, then Chromium worked through an authorized native escalation. Actual quest UI screenshots and interaction assertions now exist as described above.
- Independent QA agent: initial agent startup/transport failed (`Browser idle document did not commit`, HTTP 400); later Goodall reviewer dispatch succeeded but polling has not produced a verdict.

## Known checks and outstanding gates

- Source review confirmed the quest domain claims rewards in `gameManager.questOps.claimQuest`; rendering changes only consume read models. `getBetaQuestSurfaceModels` consumers are QuestPanel and DongFuStage; no additional quest tracker found in the searched presentation/components tree.
- P18 task-diff coverage is accounted for; the P4 quick report records `PASS WITH GAPS` and P5 sequential resulting-state reviews must be documented separately. At 1024x768 core quest transitions have real browser evidence; additional viewport/real-combat/full restore coverage remains limited.
- Unified QA ledger and final fixed-point predicate are not sealed. Do not label this branch merge-ready or fixed-point complete.
- No deletion, commit, push, merge or deploy performed. `.qa-tmp/` includes retained browser probe and artifacts per user no-deletion constraint.
- Dev server shutdown: Vite watcher later hit `EBUSY` on `.qa-tmp/quest-edge-profile-20261013/Default/Network/Cookies-journal`; process exited 1. All scratch/profile files retained.
