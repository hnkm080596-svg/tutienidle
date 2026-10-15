# S6 recurring scheduler — G5 handoff (2026-10-14)

## G0: Task card and boundaries

- Worktree: `E:\tutienidle\.agent-worktrees\quest-v2-recurring`.
- Branch: `codex/quest-v2-recurring`; initial HEAD `c516dab9cb99403524b5806e84d675443b20b200`.
- Responsibility: domain-local daily/weekly board assignment, quota, synchronous claim reservation, detached snapshots, validation, and 14 proposed content definitions.
- Allowed production files: `game/src/core/quest/recurring/RecurringSchedule.ts` and `game/src/data/quest/recurringV2.ts`; two adjacent tests. This G5 note is the permitted optional document.
- Non-goals: RewardSystem, QuestSystem, QuestManager, UI, S1/S2, producer receipts, actual save/integration, beta release switch, server-clock enforcement. No agents dispatched; all existing cache and unrelated files preserved.
- Source contract: `game/docs/design/thanh-van-di-mach-v2/{IMPLEMENTATION.md,ACHIEVEMENTS-DAILY-WEEKLY.md}`, `game/docs/roadmap.md`, architecture worker workflow, internal QA protocol.

## G1: Authority and Q1–Q12

| Question | Status and evidence |
| --- | --- |
| Q1 observable behavior | PASS for isolated scheduler: 3 offers/period, 2 successful claims, daily UTC and Monday weekly reset, duplicate/expired/invalid input rejection, no quota on failed grant; `RecurringSchedule.test.ts`. |
| Q2 single rule owner | PASS within this slice: `RecurringSchedule` owns selection, boards and quota; external atomic reward contract required. |
| Q3 state lifecycle | PARTIAL: `getBoard`/`getState` detach copies, `restore` validates and replaces both boards atomically. No persisted-game adapter in scope. |
| Q4 live production chain | GAP: repository search found no imports/consumers beyond the four scoped modules; scheduler currently test-only. |
| Q5 stable primitive | PASS: daily buckets reuse `GameClock.utcDayBucket`; `TimeAuthority.now()` supports fractional milliseconds. |
| Q6 dependency direction | PASS: pure domain imports only clock primitive; data imports domain types and Reward type; no Vue/Phaser dependency. |
| Q7 time/gameplay/presentation | PARTIAL: scheduler consumes a passed `nowMs`, does not read browser clock, owns no rendering; integration with authenticated time not demonstrated. |
| Q8 consumers preserve semantics | GAP: there are no real consumers or producer-eligibility adapters to exercise in this task. |
| Q9 query purity | PASS: `getBoard`/`getState` are detached reads; assignment and claim require commands. |
| Q10 duplicate/stale/failure | PASS within the synchronous scheduler: nested claim and reconcile/restore blocked during reservation, failed/throwing grants release reservation, stale periods and corrupt restore rejected. Cross-process exactly-once reward is BLOCKED. |
| Q11 alternate path | GAP by design: existing daily/beta path remains untouched and disabled for this release. |
| Q12 scope/proof | PARTIAL: 18 focused tests and type-check passed; full app, runtime, independent review and atomic persistence proof missing. |

Triggered domain checks: Save S1–S3 PASS at the isolated board-value boundary (detached copies, repeated replacement restore, reject-malformed-without-mutation); S4–S6 GAP until runtime save and receipt coordination. Time/rollback PASS for injected UTC clock tests; trust of authenticated server anchor is UNVERIFIED at actual S6 callsites. Economy E1/transaction PASS only for local reservation state; actual reward/bag durability BLOCKED. UI/Phaser and combat checks N/A for untouched/unwired presentation.

## G2–G4: Evidence and sequential review

- G2 invariant pins: 18 Vitest tests across two files, including 100 deterministic shuffles, 15-day daily/weekly simulation, hostile restore payloads, atomic reservations, callback false/throw/Promise rejection, quota rollover, and fractional authorized-clock timestamps.
- G3 migrated production consumers: **none**, intentionally; this slice remains unintegrated. Release switch stays off. No server clock claim is made: `TimeAuthority.anchorFromServer()` exists, but S6 has no proven authenticated runtime wiring.
- G4 P3 quick: from `game/`, `npm run type-check` PASS; `npx vitest run src/core/quest/recurring/RecurringSchedule.test.ts src/data/quest/recurringV2.test.ts` PASS **2 files / 18 tests**. TEMP/TMP/TMPDIR redirected to pre-existing `game/.local-test-tmp`, without deletion. Full verify not claimed.
- P18: scoped `ocr delegate preview -f json` identified **4 reviewable source/test files**, all inspected (4/4, 100% accounting). **535 binary Node compile-cache files** excluded as generated test cache, preserved. Rule mapping succeeded earlier in this task; an attempted repeat of rule output was subsequently blocked by a platform safety classifier. Host-model reasoning reviewed current four files; no independent OCR model result claimed.
- P4 attack evidence: failure/duplicate/reentrant grant, insufficient pool, corrupt and repeated restore, period edges, realm freeze, and shuffled input all exercised in focused Vitest. The P4 **deep**, real-owner reward/persistence and aggregate protocol requirements remain **BLOCKED** by integration authority and absent runtime chain; do not claim `PASS WITH EVIDENCE` for the full S6 feature.

Sequential review (same agent, ordered; **not** independent contexts):

1. **Pass 1 — correctness/regression**, after the scoped OCR selection: examined input guards, rollback-on-throw, claim reservations and UTC rollover. Found fractional milliseconds rejected despite `TimeAuthority.now()` returning a floating-point value (Medium); added failing regression test, changed timestamp validation to finite numeric range, and re-ran 18 tests plus type-check successfully. Latest state has no confirmed local Medium+ findings.
2. **Pass 2 — architecture/ownership**, on Pass 1 resulting code: checked clock reuse, domain state authority, read purity and reward delegation. No production scope change. Recorded unproven reward transaction and runtime persistence as BLOCKED dependencies.
3. **Pass 3 — adversarial integration**, on Pass 2 resulting code: inspected empty/duplicate/malformed pools, same/different cadence nested claims, forced callback failures, two-week-plus rollover, restore replacements and exact consumers search. No new local defect confirmed. The crucial crash/replay case (reward committed but claim receipt not durably committed, or old snapshot restored) has no valid integrated oracle and remains **BLOCKED**; no production runtime/E2E exercised.

## G5: Handoff and blockers

- Four task-owned source/test files remain preserved; the cache directory remains present. No files were deleted, cleaned or reset; no other worktrees edited.
- The local domain scheduler is test-verified. **QA_UNVERIFIED** for aggregate S6, with explicit **BLOCKED_SCOPE dependency** on the external atomic reward owner and durable receipt/save transaction. This document is a handoff, not `QA_FIXED_POINT_REACHED` or permission to integrate or ship.
- The coordinator must establish producer eligibility, genuine `TimeAuthority` runtime sourcing and grant+receipt atomic persistence, then run full verify, actual save/restore/claim E2E, fresh P4 deep and aggregate protocol gates. Existing beta daily switch must remain disabled until release authorization.
