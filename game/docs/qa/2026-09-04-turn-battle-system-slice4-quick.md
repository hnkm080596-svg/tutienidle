# QA Review: Turn Battle System Slice 4 — Resource / Boss Triggers

- Date: 2026-09-04
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/core/battle/turn/TurnBattleSystem.ts`, `game/src/core/battle/turn/TurnBattleSystem.test.ts` (+ QA-authored `TurnBattleSystem.slice4qa.test.ts`). Không file sống nào ngoài turn/ bị sửa. `MomentumBreak.ts` KHÔNG được dùng (dropped theo quyết định khóa).

## Scope and Risk Map

- Changed systems: TurnBattleSystem wire 2 Foundation primitives — `ResourceTurnHook.applyTurnStartDeltas` (tick resource pool của actor tại đầu lượt chính nó, có min/max clamp) và `BossTurnTriggers.isTurnTriggerReady` (boss trigger fire 1 lần khi `totalTurnsElapsed >= afterTurns`, đếm tổng lượt toàn trận). Thêm `totalTurnsElapsed` counter tăng mỗi step.
- Timing chain trong `resolveNextStep()` hiện tại: counter → CC check → buff tick → resource tick → boss trigger → (nếu không blocked) action. Boss trigger và resource tick chạy cả khi CC blocked (đúng thiết kế — cơ chế gắn lượt, không phải hành động).
- Domain pack: combat-and-tribulation. `deepAuditCandidate: false`, `unmappedPaths: []`.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-S4-1 | resource decay | amount âm + min 0 | Boundedness: không xuống dưới min | value mutation | kim_the = 0 | Unit (probe) | High |
| INV-S4-2 | totalTurnsElapsed | actor bị CC blocked | Monotonicity: counter vẫn tăng mỗi step, không phụ thuộc block | interruption | totalTurnsElapsed = 1 dù blocked | Unit (probe) | High |
| INV-S4-3 | boss trigger vs ATB order | boss speed thấp hơn player | Synchronization: trigger chỉ fire khi CHÍNH boss làm actor (gắn lượt boss, đúng thiết kế) | reorder | fire đúng khi actorId='enemy' | Unit (probe) | High |
| INV-S4-4 | resource ownership | enemy tốc độ cao tới lượt trước | Isolation: pool của player KHÔNG tick khi player không làm actor | reorder | mana_pool giữ nguyên | Unit (probe) | High |
| INV-S4-5 | boss exactly-once | nhiều lượt sau khi fire | Idempotency: firedAlready chặn fire lần 2 | repeat | 6 steps → đúng 1 buff enrage | Unit (plan Task 3) | Critical |
| INV-S4-6 | boss no-registry | registry undefined | Recoverability: không throw, không fire | missing dependency | not.toThrow, firedAlready=false | Unit (plan Task 3) | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run src/core/battle/turn/` | 24 files / 151/151 pass (TDD fail→pass từng task) | — |
| `npx vitest run src/core/battle/turn/TurnBattleSystem.slice4qa.test.ts` | 4/4 probes pass (sau khi sửa probe S4-3: sai assumption ATB turn-order của chính QA, không phải code — enemy speed 5 hành động sau player speed 10 nhiều lần) | — |
| `npm.cmd test` (full suite) | 2500/2502; 2 fail = `deadReferences.test.ts` flaky pre-existing (pass đơn lẻ 3/3) | Flaky evidence đã rerun |
| `npm.cmd run type-check` | Pass, exit 0 | — |

## Findings

Không có Confirmed/Suspected defect trong production code.

### QA-2026-09-04-401 (probe note, không phải defect): probe S4-3 sai assumption turn-order
- Severity: N/A
- Status: Resolved — probe sửa lại, code giữ nguyên
- Chi tiết: probe ban đầu kỳ vọng boss trigger fire sau đúng 2 steps, nhưng ATB gauge (speed 10 vs 5) khiến player hành động nhiều lần trước enemy. Trigger gắn lượt boss là thiết kế đúng (spec §5: "counted as total turns elapsed", fire-check chạy trên lượt của boss). Probe sửa thành loop chờ `actorId === 'enemy'`.

## New or Changed QA Tests

- `game/src/core/battle/turn/TurnBattleSystem.slice4qa.test.ts` — 4 probes INV-S4-1..4 (pass)

## Gaps and Residual Risk

- `MomentumBreak.ts` dropped (không wire, không defer) — đúng quyết định khóa.
- Real content migration (resource rules thật, `TribulationPhase.BossEnrage` data) — future work theo roadmap.
- Boss trigger buff áp qua `TurnBuffSystem` — enrage dot tự tick trên boss ở các lượt sau (hành vi mới so với hệ cũ, đúng spec zone-as-dot direction).

## Pre-existing Failures

- `deadReferences.test.ts`: flaky khi full-suite (pass đơn lẻ) — tồn tại trên master từ trước.
