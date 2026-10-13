# Quest Scene 18 / DongFu tracker — provisional QA record (2026-10-13)

**Task:** `quest-ui-review-20261013`. **Worktree:** `E:\tutienidle\.agent-worktrees\quest-ui-review`. **Branch:** `codex/quest-ui-review`. **HEAD:** `e36ccec9324f404c798b2d8906d5f431dd4dcc50`. No commit, push, merge, deployment or file deletion.

**Mode:** quick adversarial QA (P4). **Scoped verdict:** `PASS WITH GAPS`. **Aggregate decision:** `QA_UNVERIFIED`. The tested quest UI paths pass; full-suite baseline attribution, independent reviewer feedback, real-combat and persisted-restore journeys, and the internal fixed-point predicate remain unverified.

## Changed-surface census and risk routing

- Read projection `src/presentation/questUi.ts` and corresponding unit test: quest badge, selected row, active home tracker; no authoritative mutation.
- UI consumers: `QuestScene.vue`, `QuestRow.vue`, `QuestDetailPanel.vue`, `QuestClaimCta.vue`, `DongFuStage.vue`. Domain owner still performs `gameManager.questOps.claimQuest()`, after which `bumpState()` refreshes read-side models.
- Locales `vi.json` and `en.json`: matching locked-detail and ready-to-claim keys.
- Tooling and proof: `playwright.config.ts`, focused `QuestRow.test.ts`, `huyen-kim-imperial-shell.spec.ts`, worktree verification script, and task/brief JSON.
- The risk mapper identified `ui-input-lifecycle` (keyboard, pointer, focus, overlay, observable domain-state feedback). Unmapped `playwright.config.ts` is test tooling; `questUi.ts` is pure presentation projection; the changed E2E spec supplies fixture-driven coverage. The authoritative quest domain, reward transaction and save schema were not edited. No deep-risk trigger was confirmed from this change set.
- Task-owned OCR preview saved under `game/node_modules/.qa-runtime/ocr-quest-20261013-1230.json`: **15 reviewable paths**, **1141 excluded paths** (mostly scratch/dependency artifacts; the separate QA Markdown reports are not part of the OCR preview). The 15 task-owned paths consist of 9 modified files and 6 newly added source/test/tooling/JSON files. OCR delegation-mode rules were resolved for all 15 paths, then the host inspected all 15 changes against their corresponding rule types. **P18 host coverage: previewed 15 / reviewed 15 / skipped 0 = 100%; 0 confirmed Medium+ defects in the inspected task diff.** This is a host-model review using OCR's file/rule selection, not an external model verdict or a claim that runtime/QA gates passed.

## Invariant / attack ledger

The entries below record **state owner / attempted action / invariant / oracle / evidence layer / priority**. The production domain owner remains `GameManagerQuestOps`; all added projections are read-side.

| ID | State owner / attack | Invariant and oracle | Layer / priority |
| --- | --- | --- | --- |
| Q-01 | `QuestScene` selection; dispatch pointer/keyboard activation on locked row | Locked preview must never become selected; `.is-selected` stays on unlocked row and locked row exposes `aria-disabled` | projection + Vue + Chromium / High |
| Q-02 | `questUi.ts`; mark an unlocked row claimable | Badge becomes `ready`, not `doing` or `pending`; i18n keys resolve | projection + Vue + browser / Medium |
| Q-03 | `GameManagerQuestOps`; click claim then repeat/reopen | UI delegates domain mutation and shows claimed/disabled; exact-once reward after restore is a **remaining oracle gap** | browser fixture + source / High |
| Q-04 | Quest domain event fixture; complete first quest | Tracker updates to next active quest and reopening selects the successor | Chromium / High |
| Q-05 | Quest overlay; claim while CTA has keyboard focus | Focus stays within overlay; Escape still closes | Chromium + source / Medium |
| Q-06 | Presentation projection; pass empty, locked-only, all-claimed rows | Tracker absent and locked detail unavailable; browser locked-only screen not exercised | unit + source / Medium |
| Q-07 | Scene filters and selection watcher; change visible row set | Keep valid unlocked selection, never preserve stale/locked selection; multi-filter browser state remains untested | unit + source / Medium |
| Q-08 | Save/combat/viewport integration; reload or real kill and claim | Restore must be idempotent; full combat must count; narrow layout must remain usable; no conclusive end-to-end oracle yet | open integration gap / High |

| Invariant / proposed attack | Evidence | Classification |
| --- | --- | --- |
| Locked preview cannot become selected, through pointer or keyboard | Pure projection test; mounted QuestRow click guard; browser-dispatched locked click leaves the selected row unchanged; `aria-disabled` and `tabindex=-1` | Tested path PASS |
| Available unlocked quest gets a distinct claim-ready badge | Projection, mounted component test, actual browser claim-ready state | Tested path PASS |
| Claim remains domain-authoritative; UI cannot duplicate reward by visual effects | `QuestScene.onClaim()` delegates to `questOps.claimQuest`; browser verified claimed badge/button disables | Owner boundary inspected; repeat-reward/save exact-once not re-proven |
| Successful claim updates home tracker and opening scene selects next quest | Browser fixture dispatches three quest-domain kill events, claims, closes by Escape, observes updated tracker and reopens next quest | Tested path PASS |
| Claim button focus loss does not trap keyboard Escape | `QuestClaimCta` moves focused CTA to selected quest row before claim; browser Escape closes afterward | Tested path PASS |
| All-claimed, locked-only or empty model hides tracker / avoids locked detail | Pure projection tests cover all-claimed/locked-only/empty; `QuestDetailPanel` receives locked-only reason | Test/source evidence; visual locked-only not proven |
| Filtering and state refresh do not select a locked/stale quest | `selectVisibleQuestId` tests selection retention and locked exclusion; scene watcher runs on visible rows | Test/source evidence; multi-filter browser journey unproven |
| Full combat, save/restore, narrow/mobile layouts remain functional | Browser event injection is a test fixture, two retained 1024x768 screenshot inspections showed no obvious clipping; full Vitest fails outside scoped tests | **Coverage gaps** |

## Executed checks and limitations

- `type-check`: PASS. `build`: PASS. Focused Vitest: **21 tests / four files PASS**. `git diff --check`: PASS.
- Chromium E2E for Scene 18: **3/3 PASS**; separate beta-journey quest-absence E2E: **1/1 PASS**. Screenshot artifacts: `game/test-results/huyen-kim/18-quest-tracker-1024.png` and `18-quest-after-claim-1024.png` inspected. Visual proof is limited to rendered landscape scene at 1024x768 and tested interactions; kill events were injected through the game's quest domain, not generated through a real combat encounter.
- Full mode: type-check and build PASS; full Vitest FAIL with first bail-out at `SkillPathPanel.test.ts:125`. Earlier non-bail run also saw failures in unrelated-looking systems. Without a clean baseline comparison, their cause is **unattributed**. Retained logs: `game/node_modules/.qa-runtime/full-bail-20261013-104330.log`, `full-verify-20261013-103323.log`.
- Independent Goodall subagent: reviewer assignment was accepted; repeated 30-second polls timed out without a verdict. Independent findings cannot be invented, and the isolated-review requirement remains open.
- **Resolved transport incident:** the earlier native read of `.agents/skills/tutienidle-adversarial-qa/references/reporting-and-learning.md`, `.../domains/ui-input-lifecycle.md`, and `.agents/skills/ui-ux-pro-max/SKILL.md` was refused by an automatic safety assessment. After the user's explicit authorization, the same read was retried **successfully**, along with the QA reasoning and evidence-writing references. No current read block remains for those three files. A successful read does not unblock unrelated actions or waive QA requirements.
- **New, separate transport refusal:** a subsequent combined *read-only* request to inspect more of `GameManagerQuestOps.ts` and `betaScopeQuestDomain.ts`, check two previously captured screenshot paths, and recheck the diff was automatically refused (`couldn't determine the safety status of the request`). This request did **not** execute; previous successful source excerpts, runtime screenshots and `git diff --check` evidence remain valid for their actual scope. Further execution of this exact request needs explicit confirmation and tool approval. This is not evidence of an application regression.

## Sequential review chronology (P5 — provisional)

**Sequential Review Pass 1 — Correctness / Regression.** Reviewed state: the current 15-file task diff after P18 rule/host review. Examined status priority, locked-row event guard, selection fallback, focus transfer before claim, claim refresh, i18n parity and tests. Findings: 0 confirmed task-owned Medium+ in inspected paths; coverage gaps Q-03/Q-06/Q-07/Q-08 remain visible. Fixes: none. Verification: previously recorded type-check, four scoped Vitest files (21/21) and Chromium quest E2E (3/3); no production changes afterward.

**Sequential Review Pass 2 — Architecture / Authority.** Reviewed state after Pass 1: **YES, same code snapshot (Pass 1 made no fixes).** Inspected call-site/consumer census via `rg`: `QuestPanel` and `DongFuStage` consume `getBetaQuestSurfaceModels`; `QuestScene` uses `questOps.claimQuest`; quest lifecycle R8.1 states the query must remain read-only. Findings: no confirmed mutation-authority violation; a newer attempt to read larger domain-owner source ranges was refused by the transport, so this is **not** an exhaustive architecture sign-off. Fixes: none. Verification: no new code to verify.

**Sequential Review Pass 3 — Adversarial Integration.** Reviewed state after Pass 2: **YES, same code snapshot (Pass 2 made no fixes).** Inspected the quest-scene E2E interactions and previously executed worktree Chromium results for locked-row synthetic click, claimable-to-claimed transition, tracker refresh, focus/Escape and reopen; 1024x768 screenshots had been visually inspected. Findings: real combat, persisted restore and broader responsive states remain coverage gaps; no new task-owned defect demonstrated. Fixes: none. Verification: Chromium quest 3/3 plus separate beta-journey 1/1 previously passed; no claim of fresh browser execution during this reporting-only update.

**P5 status:** the three reviews above are ordered and record the resulting state after each no-fix pass, but the refused expanded domain read and absent independent Goodall verdict prevent treating this as a complete independent fixed-point certification. The P4 scoped result is **PASS WITH GAPS**, and the aggregate verdict remains **QA_UNVERIFIED**; full-suite cause attribution is also open. Do not mark the implementation merge-ready.
