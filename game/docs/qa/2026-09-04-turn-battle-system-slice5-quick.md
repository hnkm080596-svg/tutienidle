# QA Review: Turn Battle System Slice 5 — Wave / Stage

- Date: 2026-09-04
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/core/battle/turn/TurnBattleSystem.ts`, `game/src/core/battle/turn/TurnBattleSystem.test.ts` (+ QA-authored `TurnBattleSystem.slice5qa.test.ts`). Không file sống nào ngoài turn/ bị sửa.

## Scope and Risk Map

- Changed systems: TurnBattleSystem wire 2 Foundation pure functions — `WaveSpawnTrigger.shouldSpawnNextEnemy` (spawn enemy kế NGAY khi sân trống, không throttle) và `isStageComplete` (victory chỉ khi mọi wave enemy đã spawn + chết). `TurnBattle.wave?` optional state + constructor `spawnEnemy?` factory (thứ 4, optional).
- Backward compat: khi `wave` không set, win-condition branch cũ `enemies.every(dead)` giữ nguyên — mọi test Slice 1-4 pass unmodified.
- Domain pack: combat-and-tribulation. `deepAuditCandidate: false`, `unmappedPaths: []`.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-S5-1 | `runToCompletion` + wave | stalemate (1 dmg vs 1M hp) với spawn factory | Boundedness: maxTurns cap terminate, không treo/spam spawn vô hạn | value mutation | defeat sau cap, enemies length bounded | Unit (probe) | Critical |
| INV-S5-2 | spawnEnemy factory | enemy mới spawn giữa trận | Isolation: participant mới có TurnBuffPool riêng, không share với enemy cũ | stale state | pool reference khác | Unit (probe) | High |
| INV-S5-3 | wave 0/0 + sân trống | edge case totalEnemyCount=0 | Determinism: isStageComplete(true) ngay → victory | timing boundary | state='victory' | Unit (probe) | Medium |
| INV-S5-4 | spawn timing | arena empty cùng step kill | Exactly-once spawn: spawn đúng 1 enemy/step khi điều kiện khớp, spawnedCount tăng đúng | repeat | enemies length 2, spawnedCount=2 | Unit (plan Task 2) | High |
| INV-S5-5 | victory gating | enemyB spawn còn sống | Monotonicity: không victory sớm khi còn enemy sống dù spawnedCount=total | reorder | state='fighting' rồi 'victory' | Unit (plan Task 2) | Critical |
| INV-S5-6 | no-spawnEnemy guard | wave set, factory undefined | Recoverability: không throw, không spawn | missing dependency | not.toThrow, spawnedCount giữ | Unit (plan Task 2) | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run src/core/battle/turn/` | 25 files / 161/161 pass (TDD fail→pass từng task) | — |
| `npx vitest run src/core/battle/turn/TurnBattleSystem.slice5qa.test.ts` | 3/3 probes pass | — |
| `npm.cmd test` (full suite) | 2510/2512; 2 fail = `deadReferences.test.ts` flaky pre-existing (pass đơn lẻ ở lần xác minh Slice 4 cùng phiên) | Flaky evidence |
| `npm.cmd run type-check` | Pass, exit 0 | — |

## Findings

Không có Confirmed/Suspected defect.

## New or Changed QA Tests

- `game/src/core/battle/turn/TurnBattleSystem.slice5qa.test.ts` — 3 probes INV-S5-1..3 (pass)

## Gaps and Residual Risk

- `pickEnemyForSpawn` real content (enemy pool/elite/boss-priority) là future cutover work (Slice 6) — factory hiện chỉ fixture.
- `runToCompletion` với wave + maxTurns cap trả 'defeat' khi stalemate (probe INV-S5-1) — hành vi fail-safe đúng spec Slice 1, caller Slice 6 cần biết.

## Pre-existing Failures

- `deadReferences.test.ts`: flaky khi full-suite (pass đơn lẻ) — tồn tại trên master từ trước.
