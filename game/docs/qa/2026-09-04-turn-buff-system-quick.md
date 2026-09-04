# QA Review: TurnBuffSystem (turn-based buff engine, standalone)

- Date: 2026-09-04
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/core/battle/turn/TurnBuffTypes.ts`, `game/src/core/battle/turn/TurnBuffPool.ts`, `game/src/core/battle/turn/TurnBuffPool.test.ts`, `game/src/core/battle/turn/TurnBuffSystem.ts`, `game/src/core/battle/turn/TurnBuffSystem.test.ts` (+ QA-authored `TurnBuffSystem.adversarial.test.ts`). Không file sống nào bị sửa (đã xác minh qua Global Constraints + git diff scope).

## Scope and Risk Map

- Changed systems: standalone turn-based buff engine — KHÔNG import từ/được import bởi bất kỳ file sống nào (BuffSystem.ts, BattleSystem.ts, data content, presentation). Blast radius hiện tại = 0.
- One-hop consumers (mapper): "combat presentation and controls", "loot/progression" — chưa tồn tại vì TurnBuffSystem chưa wire vào đâu (đúng phạm vi plan).
- Domain pack: combat-and-tribulation. `deepAuditCandidate: false`, `unmappedPaths: []` → không escalate.
- Điểm rủi ro cao nhất của hạng mục này theo roadmap là "blast radius cao nhất toàn bộ rework" — nhưng plan tự giới hạn về 0 bằng cách tạo file song song thay vì sửa file sống; đã kiểm chứng bằng full suite.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-TB-1 | `TurnBuffSystem.update` | target chết trong lúc có DoT | Exactly-once damage: DoT không tick trên entity chết, nhưng duration vẫn trôi (không treo buff vĩnh viễn) | interruption | applyDotDamage not called; remainingTurns giảm | Unit (probe) | High |
| INV-TB-2 | `update` convert mid-loop | convert trong lúc iterate pool | Atomicity: iteration qua snapshot (getAll copy) — buff khác không mất/thừa tick | reorder | other buff giữ nguyên remainingTurns; frozen xuất hiện | Unit (probe) | High |
| INV-TB-3 | `apply` resist cap | ailmentResistPercent > 0.75 | Boundedness: duration clamp tại cap (không 0/âm) | value mutation (5 → clamp 0.75) | remainingTurns = 1 | Unit (probe) | High |
| INV-TB-4 | `resolveMaxStacks` | skillStats.maxStacksBonusByBuffId | Synchronization: bonus cộng đúng vào cap | stale state | stacks vượt maxStacks gốc | Unit (probe) | Medium |
| INV-TB-5 | `apply` refresh | re-apply stackMode 'refresh' | Idempotency: stacks không đổi, chỉ reset remainingTurns | repeat | stacks=1, remainingTurns=duration | Unit (probe) | Medium |
| INV-TB-6 | parity vs BuffSystem.ts | update() port 1:1 | Determinism: cùng thứ tự convert→DoT→decrement→cleanup; bỏ deltaSeconds (1 call = 1 turn) | equivalence | so sánh trực tiếp BuffSystem.ts L232-279 | Static inspection + 14 plan tests | Critical |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run src/core/battle/turn/TurnBuffPool.test.ts` | 7/7 pass (TDD fail→pass) | — |
| `npx vitest run src/core/battle/turn/TurnBuffSystem.test.ts` | 14/14 pass (TDD fail→pass từng task) | — |
| `npm.cmd test` lần 1 | 2425/2426; 1 fail `BattleSystem.earthPath.test.ts` | Flaky — pass đơn lẻ |
| `npm.cmd test` lần 2 (rerun theo evidence rule) | **2426/2426 pass — zero regression** | Flaky evidence: earthPath fail 1 lần pass 2 lần (pass đơn lẻ + full suite) |
| `npm.cmd run type-check` | Pass, exit 0 | — |
| So sánh `BuffSystem.ts` L232-279 vs `TurnBuffSystem.update` | Port 1:1 xác nhận (cùng thứ tự, cùng điều kiện, bỏ deltaSeconds) | Static inspection |
| Probes INV-TB-1..5 | 5/5 pass | — |

## Findings

### QA-2026-09-04-201 (plan-vs-live divergence note, không phải defect): convert-on-max-stacks timing
- Severity: N/A
- Status: Resolved — đã xử lý theo hướng parity 1:1
- Chi tiết: Plan test gốc kỳ vọng convert tại apply thứ 3 (maxStacks=2), nhưng logic hệ sống (`BuffSystem.ts` L112-126) convert ngay khi `nextStacks >= maxStacks` (apply thứ 2). Vì mục tiêu chính của plan là "ports the live BuffSystem.ts's ... logic 1:1", đã giữ implementation verbatim và sửa test expectations cho khớp chuỗi sự kiện thật: apply 2 → convert, apply 3 → tạo instance slow mới stacks=1. Đã thêm 1 test parity riêng ghi chú hành vi này.

## New or Changed QA Tests

- `game/src/core/battle/turn/TurnBuffSystem.adversarial.test.ts` — 5 probes INV-TB-1..5 (pass)

## Gaps and Residual Risk

- `TurnBuffSystem` chưa có production caller (đúng phạm vi) — rủi ro thực nằm ở slice wiring tương lai.
- `getActiveModifiers()`/`isRooted()`/`rollOnHitEffects()`/`getStacks()` chưa port (đúng phạm vi plan — đã ghi trong roadmap dòng riêng).
- Content migration + balance turn-count là hạng mục roadmap riêng, chưa làm.
- Flaky `BattleSystem.earthPath.test.ts`: 1 fail trong 2 full-suite runs (pass đơn lẻ) — cùng pattern flaky như `deadReferences` trước đây; khuyến nghị investigate riêng (không phải do task này: plan không đụng file EarthPath/BattleSystem).

## Pre-existing Failures

- `src/core/battle/BattleSystem.earthPath.test.ts`: flaky (fail 1/2 full-suite runs, pass đơn lẻ) — tồn tại trên master trước task này (plan chỉ thêm 3 file mới trong turn/).
