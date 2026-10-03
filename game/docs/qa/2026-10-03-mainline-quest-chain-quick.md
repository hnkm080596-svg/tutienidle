# QA Review: mainline (chính tuyến) quest chain

- Date: 2026-10-03
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths: `game/src/core/quest/Quest.ts`, `game/src/core/quest/QuestManager.ts`, `game/src/core/quest/QuestSystem.ts`, `game/src/core/game/GameManagerQuestOps.ts`, `game/src/core/game/GameManagerTickOps.ts`, `game/src/services/character/initializeCharacter.ts`, `game/src/services/save/saveShapeValidation.ts`, `game/src/data/quest/quests.ts`, `game/src/components/panels/QuestPanel.vue`, `game/src/locales/{vi,en}.json`, `game/docs/design/mainline-quest-design.md`, tests `GameManager.mainline.test.ts` + touched `*.test.ts`.

## Scope and Risk Map

`changed-risk-map.mjs` → domains: economy-and-progression, save-and-cloud, ui-input-lifecycle; `deepAuditCandidate: true` on save boundary + 3-domain spread.

**Escalation decision: stay quick — risk bounded by inspection.** The save-surface change is one OPTIONAL field (`questFlags?: string[]`) on `QuestManagerState`: additive, no version bump needed, validator + restore-normalizer + round-trip covered (`buildGameSave` serializes `getState()` verbatim — `SaveSystem.ts:389`). No recovery path changes, no cloud revision semantics touched. Economy surface is a read-mostly append (flag witness) plus standard reward grants through the existing claim path — no new reward kinds, no new persistence boundary. UI surface is computed-read-only; no subscription/lifecycle additions. Unmapped paths routed manually: `GameManagerQuestOps.ts`/`GameManagerTickOps.ts` → economy-and-progression (claim seam + tick drain); locales + panel → ui-input-lifecycle; test/doc files → inert.

Learned-ledger matches reviewed: QA-2026-09-14-001 (persisted gated field → restore recompute) — considered: `questFlags` is not recomputed through any gate on restore; normalization is type+dedup only, tested. QA-2026-09-12-010 (set/restore flag across throws) — not applicable, no transient flag window.

## Invariant Ledger

| # | Invariant | Attack operator | Evidence |
|---|---|---|---|
| 1 | Claim of chain member N admits N+1 exactly once, in the same gesture; second claim rejected | claim main_01 via real kill events → assert main_02 active; re-claim; double reconcile | `GameManager.mainline.test.ts` #2/#5 — EXECUTED |
| 2 | Realm-gated member stays locked while realm below requirement even with chain satisfied | complete mortal act at mortal realm, reconcile → main_07 absent; set qi_refining + transition tick → present | `GameManager.mainline.test.ts` #3 — EXECUTED; repeated live in browser poke (beforeRealm false/false → post-transition active) — EXECUTED_RUNTIME |
| 3 | Flag progress counts only landings while the quest is ACTIVE (no retroactive credit); witness persists across claim | settle-event drain emits `alchemy.crafted`; progress 0→1; claim; witness retained | `GameManager.mainline.test.ts` #4 (spied `drainSettlementEvents` through the REAL tick drain) — EXECUTED; pre-activation landing earns no credit by construction (`onFlag` iterates `getActive()` only) — SOURCE_PROOF |
| 4 | Fresh creation admits exactly the chain head | real `initializeCharacter` on wired manager | `GameManager.mainline.test.ts` #1 — EXECUTED + browser (fresh char panel shows only main_01 active) — EXECUTED_RUNTIME |
| 5 | `questFlags` persists and tolerates malformed payloads | restore with non-array / non-string / dupes; save-shape rejects dupes | `QuestManager.test.ts` flag cases + `saveShapeValidation.test.ts` questFlags cases — EXECUTED |
| 6 | Chain data is a linear walk: 15 members, one head, no cycles, every `unlocksAfterQuestId` resolves inside the chain | data guard pins exact order | `quests.test.ts` chain describe — EXECUTED |
| 7 | Inverse pass deactivates only genuinely ineligible entries; nothing double-activates | reconcile ×2, claimed entries stable | `GameManager.mainline.test.ts` #5 — EXECUTED |
| 8 | UI preview is read-only and recompute-bridged by `stateVersion` | lockedPreview reads `stateVersion.value` same as `rows`; no mutation in computed | source inspection + browser screenshots (`docs/qa/audit-playwright-artifacts/mainline-quest-panel/*.png`) — EXECUTED_RUNTIME |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| `npm run type-check` (vue-tsc --build) | clean, exit 0 | full project |
| `npx vitest run src/core/quest src/data/quest src/core/game/GameManager.mainline.test.ts src/core/game/GameManager.questLifecycle.test.ts src/services/character src/services/save/saveShapeValidation.test.ts` | 11 files / 464 tests pass | scoped suite per P3 quick |
| Browser drive: guest auth → create character → open quest panel | `Chính Tuyến` group on top; main_01 active with gold chip; greyed `Lâm Chi Sản` preview with `Hoàn thành: Săn Mồi Đầu Tiên`; no console/page errors | screenshot `docs/qa/audit-playwright-artifacts/mainline-quest-panel/2026-10-03-mainline-fresh.png` |
| Browser poke: witness mortal act → realm transition → chain to main_10 | `beforeRealm {main07:false, main10:false}`; post-transition main_07 active; post-witness main_10 active with flag label `Luyện Tụ Linh Đan · 0/1`; locked preview advances to `Thu Thập Thập Niên Linh Khoáng` | screenshot `docs/qa/audit-playwright-artifacts/mainline-quest-panel/2026-10-03-mainline-main10.png` |

## Findings

### QA-2026-10-03-1: Folded collect quests evict partial progress on carried saves
- Severity: Low
- Status: Confirmed (SOURCE_PROOF — static proof, consistent with existing inverse-pass contract)
- Invariant: none broken — this is the designed lifecycle (ineligible entries deactivate; progress re-arms at zero)
- Preconditions: a save from before this change where `collect_tu_linh_thao_1` or `collect_qi_refining_ore_decade_1` sits ACTIVE-but-incomplete
- Reproduction: restore such a save → next `reconcileActiveQuests` inverse pass calls `deactivate()` because `unlocksAfterQuestId` (main_08 / main_10) is not yet in `completedOnceIds`
- Expected: per design fold, the quest re-enters the chain at its slot and progress restarts there
- Actual: partial progress is dropped; the quest reactivates fresh once the chain reaches it
- Evidence: `QuestSystem.reconcileActiveQuests` inverse pass deactivates `!isUnlocked` entries; `ensureActive` re-arms progress at 0
- Test file: none (asserted behavior of the inverse pass is already covered; folding was sanctioned by the approved design)
- Owner subsystem: `core/quest`
- Blast radius: bounded to partial progress on two collect quests; completed-claims survive via `completedOnceIds`; no currency/state corruption

## New or Changed QA Tests

- `game/src/core/game/GameManager.mainline.test.ts` (new): creation admission, same-gesture claim successor, realm-gate composition, flag emission through the real alchemy-drain seam, dedup.
- `game/src/data/quest/quests.test.ts`: chain data guards (15 members, single head, linear walk pins exact order, cadence/realm gates, flag-id census); foundation count narrowed to exclude mainline members.
- `game/src/core/quest/QuestManager.test.ts`: `markQuestFlag` dedup + `restore` normalization of `questFlags`.
- `game/src/services/save/saveShapeValidation.test.ts`: `questFlags` optional-accept + reject cases.
- `game/src/services/character/initializeCharacter.test.ts`: mock gains `tickOps.reconcileQuestLifecycle`; asserts call ordering after `setActivePlayer`.
- `game/src/core/game/GameManager.questLifecycle.test.ts`: realm-transition test now witnesses `main_13` before asserting realm-gated activation (chain gate composes with realm gate).

## Gaps and Residual Risk

- Flag witness emits on any successful alchemy settle including a fully-overflowed delivery (pill crafted then lost to a full pill bag). Crafting succeeded — judged correct for the "luyện thành công 1 viên" beat; noted as a design-visible choice, not a defect.
- E2e coverage of the panel uses a scripted Playwright drive, not a committed spec — acceptable for this UI surface (the panel itself is exercised; no `tests/e2e` addition requested).
- `qa:internal prepare`/`preflight` subcommands are absent from this checkout's cli.mjs (only init|snapshot|record|validate|decide|render|qualify); intake ran against code inspection instead. Non-material tooling gap.

## Pre-existing Failures

None observed in scope.
