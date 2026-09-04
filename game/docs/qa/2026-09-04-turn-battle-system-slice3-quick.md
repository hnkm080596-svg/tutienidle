# QA Review: Turn Battle System Slice 3 — Buff/CC Wiring + Zone-as-dot

- Date: 2026-09-04
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/core/battle/turn/TurnBattleSystem.ts`, `game/src/core/battle/turn/TurnSkillAction.ts`, `game/src/core/battle/turn/TurnBattleSystem.test.ts` (+ fixture updates trong 4 test file khác, + QA-authored `TurnBattleSystem.slice3qa.test.ts`). Không file sống nào ngoài turn/ bị sửa (đã xác minh Global Constraints).

## Scope and Risk Map

- Changed systems: TurnBattleSystem wire TurnBuffSystem (đã merge Milestone 1): mỗi participant có `buffs: TurnBuffPool` riêng; buff tick tại lượt holder TRƯỚC khi hành động; stun/freeze block hành động; skill `appliesBuff` áp buff lên target set (zone-as-dot proof — AOE skill + dot buff = thay Lava/Sword Zone, không cần zone entity).
- Domain pack: combat-and-tribulation. `deepAuditCandidate: false`, `unmappedPaths: []`.
- Deviation khỏi plan: plan code block tick buffs TRƯỚC CC check nhưng plan tests kỳ vọng stun duration-1 vẫn block 1 lượt — 2 điều này mâu thuẫn (tick trước làm stun expire trước khi block). Đã resolve theo tests (nguồn sự thật intent): CC check TRƯỚC tick, kèm comment giải thích. Kết quả: stun duration-N block đúng N lượt (probe INV-S3-1 chứng minh).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-S3-1 | `resolveNextStep` CC timing | stun duration-2 | Exactly-once block: block đúng 2 lượt rồi hết, không block vĩnh viễn | timing boundary | ccBlocked true,true,false + targetIds > 0 | Unit (probe) | Critical |
| INV-S3-2 | buff tick ownership | holder burn tick tại lượt holder | Synchronization: damage lên holder, không lên source | reorder | holder hp giảm, source hp giữ | Unit (probe) | High |
| INV-S3-3 | dead holder | holder chết với buff còn lại | Boundedness: dead không được chọn làm actor → buff không tick, không crash | interruption | victory, buff còn nguyên | Unit (probe) | Medium |
| INV-S3-4 | CC + DoT đồng buff | stun+dot cùng buff | Determinism: DoT vẫn tick dù CC blocked (update() chạy trước block logic) | reorder | ccBlocked=true, hp vẫn giảm | Unit (probe) | High |
| INV-S3-5 | self-appliesBuff | target='self' | Synchronization: buff vào pool của actor, sourceId=actor | value mutation | pool 1 buff, sourceId đúng | Unit (probe) | Medium |
| INV-S3-6 | no-registry guard | appliesBuff set, registry undefined | Recoverability: không throw, không áp buff | missing dependency | not.toThrow, pool rỗng | Unit (plan Task 3) | High |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run src/core/battle/turn/` | 23 files / 138/138 pass (TDD fail→pass từng task) | — |
| `npx vitest run src/core/battle/turn/TurnBattleSystem.slice3qa.test.ts` | 5/5 probes pass | — |
| `npm.cmd test` (full suite) | 2 flaky quen thuộc (earthPath + deadReferences) fail khi full-suite, pass đơn lẻ 9/9 sau đó — không phải regression (chỉ thêm file turn/) | Flaky evidence đã rerun |
| `npm.cmd run type-check` | Pass, exit 0 | — |

## Findings

### QA-2026-09-04-301 (plan deviation note, không phải defect): CC check trước tick
- Severity: N/A
- Status: Resolved trong phiên
- Chi tiết: plan Step 3 code block đặt `actorBuffSystem.update()` trước CC check — làm stun duration-1 expire trước khi kịp block (vi phạm intent của chính plan tests). Implementation đặt CC check trước, tick sau; probe INV-S3-1 chứng minh stun duration-2 block đúng 2 lượt. Đây là thứ tự đúng theo spec intent ("buffs tick at their holder's own turn" + "stun/freeze block the holder's next action").

## New or Changed QA Tests

- `game/src/core/battle/turn/TurnBattleSystem.slice3qa.test.ts` — 5 probes INV-S3-1..5 (pass)

## Gaps and Residual Risk

- `statModifier`/`onHitProc` chưa wire (đúng phạm vi — cần stats-recompute pass, future slice).
- Content migration (Dung Nham/Kiếm Trận → dpsRatio buffs) — future work theo roadmap.
- Buff tick chỉ xảy ra khi holder được resolveNextTurn chọn làm actor — holder chết giữ buff đông lạnh (probe INV-S3-3), chấp nhận được ở giai đoạn này, cần xem lại khi Slice 6 cutover.

## Pre-existing Failures

- `BattleSystem.earthPath.test.ts` + `deadReferences.test.ts`: flaky khi full-suite (pass đơn lẻ) — tồn tại trên master từ trước.
