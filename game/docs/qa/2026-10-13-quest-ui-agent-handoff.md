# Agent handoff — Quest Scene 18 / Dong Phu tracker

Date: 2026-10-13. State: **HANDOFF / QA_UNVERIFIED**. This is an implementation-and-evidence handoff, **not** a completion or merge approval.

## 0. Entry coordinates and constraints (read first)

| Field | Value |
| --- | --- |
| Workspace/worktree | `E:\tutienidle\.agent-worktrees\quest-ui-review` |
| Git branch | `codex/quest-ui-review` |
| HEAD at handoff | `e36ccec9324f404c798b2d8906d5f431dd4dcc50` |
| App root (commands) | `E:\tutienidle\.agent-worktrees\quest-ui-review\game` |
| Remote state | **No commit or push** for the work described here; all task changes remain local/uncommitted |
| User authorization | Continue within this worktree; **NEVER DELETE ANY FILE**, including generated scratch and test artifacts; do not truncate, reset, clean, or stash work to simulate deletion |
| Integration restrictions | **No commit, push, merge, deployment, or main-checkout edits** without separate explicit user authorization |
| Neighbor checkout | `E:\tutienidle` has other uncommitted work. Do not overwrite or use it to run the quest task. |

At handoff, `git diff --check` passed; working tree is intentionally dirty. Check `git status --short`, actual branch and HEAD before editing; notify the user if another worker has modified the same files. Do not infer the remote branch contains these changes. Only the worktree above carries this implementation.

## 1. Mission, visible behavior and ownership

Finish and verify the UI repair for **Scene 18 — Nhiem Vu** and the **Dong Phu home quest tracker**, preserving the existing xianxia paper-sheet scene composition.

- Locked quest previews remain visible with their unlock requirements but cannot be selected by click or keyboard; a locked-only list displays localized explanatory detail.
- Quest rows distinguish `pending` (locked), `doing` (active), `ready` (reward claimable) and `complete` (claimed); `en` and `vi` locale keys stay in parity.
- Selection prefers the unlocked quest tracked at home and preserves an existing valid unlocked selection. The home tracker prefers an available reward, then an unfinished unlocked quest; it hides if there is none.
- A successful claim is delegated to `gameManager.questOps.claimQuest(questId)`, followed by a reactive `bumpState()`. Vue is display/input only; **do not move quest progress or reward authority into the UI**.
- Keyboard focus leaves the claim button before it becomes disabled, allowing the overlay Escape shortcut to keep working; reopening after a successful claim selects the next quest.

Canonical source owner: `game/src/core/game/GameManagerQuestOps.ts`; read-only model: `game/src/core/betaScopeQuestDomain.ts`. Roadmap R8.1 requires quest lifecycle activation to be independent of opening a UI panel. The main consumers are `QuestPanel.vue` and `DongFuStage.vue`. Follow `AGENTS.md`, `game/docs/roadmap.md` (R8.1), `game/docs/architecture/architecture-worker-workflow.md`, and `game/docs/qa/protocol/README.md` before any new production changes.

## 2. Current task-owned changes (uncommitted)

Modified, relative to worktree root:

- `game/src/components/scenes/dong-fu/DongFuStage.vue` — uses shared `trackedHomeQuest()`.
- `game/src/components/scenes/quest/QuestScene.vue` — selection fallback, locked-only detail, claim refresh.
- `game/src/components/scenes/quest/detail/QuestClaimCta.vue` — focus transfer before claim.
- `game/src/components/scenes/quest/detail/QuestDetailPanel.vue` — localized locked-only empty state.
- `game/src/components/scenes/quest/list/QuestRow.vue` — status projection, ready badge.
- `game/src/locales/en.json`, `game/src/locales/vi.json` — parity for ready/locked detail strings.
- `game/playwright.config.ts` — starts Vite using `npm run dev`, which works in this worktree with parent-resolved dependencies.
- `game/tests/e2e/huyen-kim-imperial-shell.spec.ts` — quest-scene interaction and claim/tracker browser journeys.

New, not yet tracked by Git:

- `game/src/presentation/questUi.ts` and `questUi.test.ts` — pure projections and unit coverage.
- `game/src/components/scenes/quest/list/QuestRow.test.ts` — component-level guards and badge.
- `game/scripts/qa/run-worktree-verification.ps1` — verification runner; `Quest`, `Full`, `E2E` modes.
- `game/docs/qa/2026-10-13-quest-ui-task.json`, `2026-10-13-quest-ui-brief.json` — task/QA intake.
- `game/docs/qa/2026-10-13-quest-ui-quick.md`, `2026-10-13-quest-ui-verification.md` — risk ledger, review chronology and verification evidence.
- `game/.qa-tmp/` — intentionally retained generated artifacts/profiles, **preserve** them under the user's no-deletion rule.
- This handoff document.

The `QuestScene.vue` implementation still renders the existing group rail, cadence strip, list and detail panels. There is no approved new skill/quest gameplay flow or asset redesign in scope.

## 3. Evidence already obtained (do not present as a fresh run)

| Gate | Latest recorded evidence | Interpretation |
| --- | --- | --- |
| TypeScript | `npm run type-check` **PASS** | Checked at prior implementation state; no production code changes since. |
| Build | `npm run build` **PASS**; Vite transformed 2263 modules | Same limitation. |
| Focused Vitest | **21/21 PASS** across `questUi`, `QuestRow`, `QuestPreviewLocaleGap`, `i18nKeyParity` (4 test files) | Covers read-side projection, Vue row behavior and locale parity. |
| Real worktree Chromium | Scene 18 quest cases **3/3 PASS**; separate beta-journey quest-absence case **1/1 PASS** | Verifies locked click, 1024x768 render, reward-ready badge, claim, next-task unlock, tracker refresh, focus/Escape and reopen. |
| P14 screenshots | Previously inspected `game/test-results/huyen-kim/18-quest-tracker-1024.png`, `18-quest-after-claim-1024.png` | No obvious panel clipping at 1024x768 landscape; images were letterboxed. Confirm files still exist when reusing them. |
| `git diff --check` | **PASS** on 2026-10-13 at handoff | No whitespace errors in tracked diff. |
| P18 OCR selection | Preview JSON `game/node_modules/.qa-runtime/ocr-quest-20261013-1230.json`: 15 reviewable paths, 1141 excluded scratch/dependency/other paths | Host read rules for 15/15 and inspected task changes, with no confirmed Medium+ issue. This is **host reasoning in delegation mode**, not an independent external OCR-model verdict. Re-preview if the diff changes; preserve exclusion accounting. |
| P4/P5 | `2026-10-13-quest-ui-quick.md`: scoped P4 **PASS WITH GAPS**, 3 ordered documented reviews with no production fixes | Provisional; cannot assert overall fixed point. |
| Independent reviewer | Goodall subagent `01a1339d-68df-7d50-8902-10c6bfad6e09` accepted assignment but repeated 30-second waits returned no verdict | Independence evidence **missing**; do not report PASS by inference. |

The E2E claim test injects **three quest-domain enemy-defeat events as a fixture**; it does not demonstrate a live combat kill-to-quest pipeline, persisted quest state, reward exactly-once after restore or narrow-device responsive behavior. Do not inflate its coverage.

## 4. Open gates and failures

1. **Full-suite Vitest FAIL** after successful type-check/build. Latest bail-first attempt reported a failing expectation at `SkillPathPanel.test.ts:125` concerning a respec button for a way-less Mortal. Earlier broad run also encountered save, equipment, alchemy, art/canvas and other failures. **Whether any failure is pre-existing is not established**; compare against a clean baseline without altering/cleaning this task worktree. Logs: `game/node_modules/.qa-runtime/full-bail-20261013-104330.log` and `full-verify-20261013-103323.log`. Historical broad-run counts (85 failed files/80 failed tests) are exploratory, **not** the latest bail run.
2. **Independent review**: no verified Goodall verdict. Need an actual isolated reviewer result or explicitly retain the independence gap. Do not manufacture evidence.
3. **Integration**: real combat-generated quest progression, claim/reward exactly-once and save/restore, all-claimed/locked-only actual browser state, multi-filter selection and additional viewport sizes have no conclusive full journeys. Scope new tests proportionally to the affected behavior; do not change the authoritative domain merely to force a test green.
4. **Protocol fixed point**: `QA_UNVERIFIED`. Re-check complete QA ledger, scoped OCR on latest diff, production consumers, adversarial QA and sequential post-fix reviews. A green focused suite alone is insufficient to declare merge-ready.
5. **Native tool authorization history**: an earlier read of three QA/UX reference documents was initially auto-refused and subsequently **succeeded** after the user confirmed access. A **separate later combined read-only action** (additional ranges from `GameManagerQuestOps.ts`/`betaScopeQuestDomain.ts`, two screenshot path checks and `git diff --check`) received `Script error: This tool call was blocked by OpenAI because we couldn't determine the safety status of the request.` **Nothing in that combined request ran.** Existing earlier excerpts and previous `git diff --check` remain legitimate evidence for their own scope. Do not silently retry a refused action through alternative tools; use the applicable approval mechanism and obtain fresh user confirmation if needed. This refusal is not a demonstrated game defect.

## 5. Recommended takeover order

1. Adopt this exact branch/worktree; inspect `git status --short`, HEAD, task diff and existing QA documents. Retain all local/untracked files and generated artifacts. Read current AGENTS/roadmap/QA policy; do not trust older notes over current source.
2. Establish full-suite baseline causality against an isolated clean reference (or other valid unchanged checkout) **without modifying or deleting worktree contents**. Classify task regression versus pre-existing or environment failure. Record reproducible evidence.
3. Obtain actual independent review evidence if possible; inspect confirmed defects and update the task diff only for a coherent, task-owned repair. Re-run applicable tests, OCR, P14, P4 and sequential P5 as required for changes.
4. Address high-risk unproven UI/domain transitions with bounded browser tests where achievable: ordinary combat to quest progress, repeated claim, reload/restore, group/cadence filters and smaller viewport. Separate fixture tests from real-game tests in reporting.
5. Update the existing QA ledger and the handoff status with a defensible outcome (`QA_FIXED_POINT_REACHED` only if its full predicate truly holds; otherwise `QA_UNVERIFIED`, `QA_FINDINGS_OPEN` or another protocol-defined state). Present the final diff, proof and residual gaps for **user approval before commit or push**.

Useful commands from the **worktree's `game/` directory** (examples; **do not run blindly if another agent is modifying files**):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/qa/run-worktree-verification.ps1 -Mode Quest
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/qa/run-worktree-verification.ps1 -Mode Full
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/qa/run-worktree-verification.ps1 -Mode E2E -E2ESpec huyen-kim-imperial-shell.spec.ts -E2EGrep 'scene 18 quest'
```

The Playwright browser cache required `PLAYWRIGHT_BROWSERS_PATH` correction; the verification script supplies it when present. Chromium launch previously failed in the ordinary sandbox (`0xC0000022`) and **passed through an approved native escalation**. New agents must use their own valid approval flow where necessary; never treat a prior approval as universal permission to bypass runtime restrictions. Run the server and capture screenshots from this task worktree, on its actual printed port.

## 6. Expected continuation report

State the branch, worktree, actual HEAD, uncommitted versus committed/pushed changes, and all changed files. Report tests/visual proof **as PASS/FAIL/BLOCKED/UNTESTED**, independent reviewer status, each confirmed defect with severity and its resolution, fresh OCR coverage, and the protocol's final QA predicate. Explicitly preserve the no-deletion constraint and explain any unmet gate. Do not claim that the task is finished or safe to merge until the source/runtime evidence supports it.
