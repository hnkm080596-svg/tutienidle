# QA Review: Task 9.7 — isFinite guard on cultivationPerSecond in calculateOfflineProgress

- Date: 2026-09-03
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/core/idle/OfflineProgressSystem.ts`, `game/src/core/idle/OfflineProgressSystem.test.ts`

## Scope and Risk Map

Changed: pure-function guard in `calculateOfflineProgress` — cultivation is 0 when `cultivationPerSecond` is non-finite; all finite behavior unchanged. New tests: NaN and ±Infinity cases.

Mapper (`changed-risk-map.mjs` on the 2 task paths): domain `time-and-offline`; one-hop consumers "economy and progression accrual", "save timestamps and recovery"; `deepAuditCandidate: true` (reason: `critical state boundary: time-and-offline`); `unmappedPaths: []`.

Escalation decision (required because `deepAuditCandidate: true`): the flag is triggered by the generic idle-directory critical-boundary hotspot, not by a change to time ownership. The diff adds no clock, no elapsed-time calculation, no save-shape or accrual-semantics change — it only hardens an already-validated pure conversion. Manual inspection of every one-hop consumer bounds the risk:

- `game/src/stores/player.ts:305` — `restoreFromSave` feeds `save.player.cultivationPerSecond` (already rejected when non-finite/non-negative by `game/src/services/save/saveShapeValidation.ts:180`) into `calculateOfflineProgress`; result is added at `player.ts:331` and clamped `Math.min(cultivation, cultivationRequired)` at `player.ts:338`. Guard makes the function safe for future/other callers by construction.
- `game/src/App.vue:454` — consumes `offline.cultivation` for OfflineSummaryModal display only.

Quick mode is sufficient; no material cross-system risk remains unbounded.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-IDLE-1 | `OfflineProgressSystem.calculateOfflineProgress` | Offline conversion with NaN `cultivationPerSecond` | Boundedness: no NaN cultivation | Value mutation (NaN input) | `result.cultivation === 0` | Unit | High — this task's target (QA-2026-09-02-007) |
| INV-IDLE-2 | `OfflineProgressSystem.calculateOfflineProgress` | Offline conversion with ±Infinity `cultivationPerSecond` | Boundedness: no Infinity cultivation | Value mutation (±Inf input) | `result.cultivation === 0` | Unit | High — same defect class |
| INV-IDLE-3 | `OfflineProgressSystem.calculateOfflineProgress` | Finite inputs, incl. negative seconds | Regression: existing conversion unchanged | Value mutation (negative seconds) | elapsedSeconds/max(0), cultivation product identical | Unit (existing tests) | High — guard must not alter finite path |
| INV-IDLE-4 | `stores/player.ts` restoreFromSave (one-hop) | Boot restore with guarded conversion | Synchronization: no double-apply, clamp intact | Stale state / repeat | cultivation += offline.cultivation then Math.min clamp at :338 — unchanged | Inspection (pre-existing suite) | Medium — call graph unchanged by this diff |

INV-IDLE-1/2 were `Confirmed` defects before this fix (full-project deep QA 2026-09-02-007, ledger row INV-007); the new tests are the reproduction tests, now passing after the fix.

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm.cmd run test -- src/core/idle/OfflineProgressSystem.test.ts` (before fix, after adding tests) | FAIL: 2 failed / 5 passed (7) — NaN propagated (`expected NaN to be +0`), +Infinity propagated (`expected Infinity to be +0`) | RED runs of TDD; failed for the intended reason |
| Same command (after fix) | PASS: 7 passed (7) | GREEN; no warnings in output |
| `npm.cmd run test -- src/core/idle` (whole idle seam) | PASS: 7 passed (7) | Adjacent time/offline seam unaffected |
| `npm.cmd run type-check` (`vue-tsc --build`) | PASS, no output | No type regressions |
| `git diff` of `OfflineProgressSystem.ts` | 4-line guard + comment, Vietnamese encoding intact | Only task-owned hunks |
| One-hop consumer inspection (`stores/player.ts:298-339`, `App.vue:454`, `saveShapeValidation.ts:176-180`) | Unchanged; validator + clamp already in place | Static evidence, no new runtime path |

## Findings

None new. The audited defect (QA-2026-09-02-007, Confirmed in the 2026-09-02 full-project deep audit) is now resolved by this change; its reproduction tests are the two new tests added in this task.

## New or Changed QA Tests

`game/src/core/idle/OfflineProgressSystem.test.ts` — two tests in `describe('calculateOfflineProgress')`:

- `NaN cultivationPerSecond → cultivation 0, không poison kết quả` — proves INV-IDLE-1; failed before the guard (`NaN` propagated) and passes after.
- `+Infinity / -Infinity cultivationPerSecond → cultivation 0` — proves INV-IDLE-2; both infinities returned `Infinity` before, `0` after.

## Gaps and Residual Risk

- INV-IDLE-4 (restoreFromSave idempotency) remains an open finding from the deep audit (QA-2026-09-02-002, Suspected) — pre-existing, out of this task's scope, unchanged by this diff.
- Live-boot integration (browser restore with a crafted corrupt save) was not run; bounded by the unit seam + validator inspection since the guard is a pure-function change.

## Pre-existing Failures

None observed in the commands run.
