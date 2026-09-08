# QA Review: R7 Worker Allocation & Decompose Authority

- Date: 2026-09-08
- Mode: deep (mandatory escalation from quick: mapper returned `deepAuditCandidate: true` — save-and-cloud + time-and-offline critical boundaries crossed by the new decompose persistence slice + offline settle)
- Verdict: PASS WITH EVIDENCE (after dev-workflow remediation of QA-2026-09-08-R7-001, re-verified)
- Task-owned paths:
  - `game/src/core/production/WorkerAllocator.ts` (+test)
  - `game/src/core/production/ProductionSystem.ts` (tickWorkers, settleWorkersOffline)
  - `game/src/core/production/DecomposeSystem.ts` (+2 test files)
  - `game/src/core/game/GameManager.ts` (shared-pool tick split, deliverDecomposeOutput)
  - `game/src/core/game/GameManagerSaveRestore.ts` (decompose restore + offline settle wiring)
  - `game/src/services/save/SaveSystem.ts` (decompose slice)
  - `game/src/services/save/saveShapeValidation.ts` (slice validation)
  - `game/src/components/panels/equipment-hall/DecomposeTab.vue` (slider max binding)

## Scope and Risk Map

Changed systems: workforce allocation (new pure allocator), decompose capacity/persistence/offline, save schema (+1 optional slice), GameManager tick orchestration, one Vue panel binding.

One-hop consumers inspected: GameManager.update full tick order, restore path, DecomposeTab UI mirror, save round-trip, production worker settlement parity, collect-quest material hook on decompose delivery (offline delivery path currently bypasses `notifyQuestMaterialGained` — see QA-R7-002, Suspected).

Escalation decision: deep per mandatory rule (save-and-cloud + time-and-offline critical boundaries; `deepAuditCandidate: true` from mapper; 6 domains mapped).

Exclusions: none (all changed paths task-owned). `unmappedPaths: GameManagerSaveRestore.ts` was manually routed to save-and-cloud + time-and-offline packs.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-R7-1 | DecomposeSystem offline settle (GameManagerSaveRestore) | restoreFromSave(same save) twice | Exactly-once: second restore of the same payload must not re-award decompose output | Repeat | bag tinh hoa amount | integration | Critical |
| INV-R7-2 | Shared pool split (GameManager.update) | decompose workers + production manual assignments overcommit capacity | Boundedness: decompose + production slots never exceed total capacity | Value mutation | sum of activeWorkerSlots + decompose workers | integration | High |
| INV-R7-3 | Save round-trip (SaveSystem + shape validation) | build → write → load with decompose slice; malformed slice variants | Recoverability/Synchronization: valid slice round-trips; malformed slice rejected without boot crash | Corruption | load outcome + restore result | integration | High |
| INV-R7-4 | Decompose offline window (DecomposeSystem.settleOffline) | offline 100h with workers | Boundedness: settled cycles ≤ cap window | Timing boundary | settled count | unit (covered: DecomposeSystem.saveRestore.test.ts) | Medium |
| INV-R7-5 | Production tickWorkers (old AR-07 crash) | all-manual sites + spare capacity | No exception; remainder idle | Reorder | no throw + slot map | unit+integration (covered: ProductionSystem.workers.test.ts, GameManager.workerCapacity guard) | High |
| INV-R7-6 | DecomposeTab slider max | CHQ capacity change mid-session | Synchronization: slider max == live capacity | Stale state | slider.max attribute | unit (covered: DecomposeTab.test.ts) | Medium |
| INV-R7-7 | Offline decompose delivery → collect-quest hook | offline settle delivers tinh hoa | Parity: offline delivery must feed the same material-gained hook as the online tick | Cross-system chain | quest collect progress | integration | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx.cmd vitest run` (full suite) | 418 files / 2873 tests PASS | after Task 7, pre-QA-tests |
| `npm.cmd run type-check` | PASS | vue-tsc --build |
| `npm.cmd run build` | PASS | vite build 4.23s |
| `npx.cmd vitest run src/core/game/GameManager.r7qa.test.ts` | 1 PASS, 1 FAIL for the intended reason | INV-R7-1 double-award confirmed (pre-fix) |
| Remediation (dev workflow): `DecomposeSystem.restore` timer merge + `GameManagerSaveRestore` capacity-before-restore ordering | `GameManager.r7qa.test.ts` 2/2 PASS | post-fix re-verification |
| `npx.cmd vitest run` (production + save + GameManager scope, 18 files) | 200/200 PASS | post-fix |
| Playwright browser (P14) | Not verified | isolated-worktree exception (`.agent-worktrees/`); deferred to integration checkout |

## Findings

### QA-2026-09-08-R7-001: Repeated restore of the same save double-awards offline decompose output

- Severity: High
- Status: Confirmed
- Invariant: Exactly-once / idempotent restore (A3: repeat-application semantics for restore)
- Preconditions: a save whose `decompose.started` is true with `nextCycleAt` in the past (offline window elapsed > 60s), workers > 0, ore in the bag, capacity > 0.
- Reproduction: call `GameManager.restoreFromSave(save)` twice with the same save object (retry-load path / two tabs / double boot). The first restore settles the window and delivers tinh hoa; the second restore re-reads the SAME `save.decompose.nextCycleAt` from the past, replays the settle window, and delivers the output a second time.
- Expected: the second restore of the same payload must not duplicate rewards (restore has repeat-application semantics per A3; compare `DecomposeSystem.settleOffline` in-place idempotence which correctly returns 0 the second time on the SAME system instance — the hole is that `restore()` resets the timer from the payload each time).
- Actual: tinh hoa credited twice (12 vs expected 6 in the reproduction).
- Evidence: failing reproduction test `game/src/core/game/GameManager.r7qa.test.ts` ("restore twice from the same save does not double-award decompose output") — fails for the intended reason (assertion `tinhHoaAfterSecond === tinhHoaAfterFirst`).
- Test file: `game/src/core/game/GameManager.r7qa.test.ts`
- Owner subsystem: `DecomposeSystem.restore` + `GameManagerSaveRestore` (restore/repeat-application contract)
- Blast radius: any repeated restore of one save payload (boot retry, reload race, two tabs, import replay) duplicates decompose output — economy duplication, bounded by ore stock and the offline cap per replay.
- **Remediation (dev workflow, post-QA):** (1) `DecomposeSystem.restore` now MERGES the cycle timer (`max(live, saved)`) and ORs `started`, so a repeated restore cannot rewind an already-settled window; (2) `GameManagerSaveRestore` now calls `updateCapacity` BEFORE `restore` so saved workers clamp against the real CHQ ceiling instead of the fresh-instance default 0 (a second latent defect the reproduction exposed — saved workers silently zeroed on every boot). Both fixes are covered by the reproduction test, which now passes and stays as a regression guard.

### QA-2026-09-08-R7-002: Offline decompose delivery skips the collect-quest material hook

- Severity: Medium
- Status: Suspected (static inspection; no reproduction test — offline tinh hoa delivery in `GameManagerSaveRestore` calls `deliverDecomposeOutput` which adds to the bag but does not call `notifyQuestMaterialGained`, unlike the production-settle path in the same restore flow which does feed quest progress. Online decompose delivery has the same gap (pre-existing: the old inline tick block also never fed the quest hook), so this is not a regression of this mission but the new shared `deliverDecomposeOutput` preserved it.)
- Invariant: shared semantic rule — every material entering the bag feeds the collect-quest hook (GameManager comment at the production settle: "collect-quest hook — gọi MỖI KHI material vào túi").
- Expected: offline (and online) decompose tinh hoa deliveries increment matching collect-quest progress.
- Actual: no quest hook on either path (pre-existing online; new offline path inherited it).
- Evidence: static code path comparison (`GameManagerSaveRestore` production settle calls `notifyQuestMaterialGained` via drain events; decompose delivery path has no call).
- Test file: none (would need a quest-fixture integration test; left as follow-up)
- Owner subsystem: `GameManager.deliverDecomposeOutput` / quest ops wiring
- Blast radius: collect-quests tracking refined essence never progress from decompose output (pre-existing behavior; not a regression).

## New or Changed QA Tests

- `game/src/core/game/GameManager.r7qa.test.ts`
  - "decompose + production slots never exceed total capacity (overcommit)" — proves INV-R7-2 at the real tick boundary (passes).
  - "restore twice from the same save does not double-award decompose output" — fails for the intended reason, confirming QA-2026-09-08-R7-001. Must stay green after the dev-workflow fix.

## Gaps and Residual Risk

- P14 browser verification deferred (isolated-worktree exception) — slider max binding and decompose tab visuals need a main-checkout pass at integration.
- QA-R7-002 needs an integration test after the fix decision (hook tinh hoa into quest progress or document tinh hoa as quest-exempt).
- Two-tab concurrent autosave interplay with the new slice follows the existing coordinator revision policy; not re-audited here (no cloud adapter change in this mission).

## Pre-existing Failures

None observed in the full suite (418 files / 2873 tests green at audit start).
