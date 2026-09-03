# QA Review: AOE Shape Extension (ActionTargetingShape cross/row/column + 'area'→'square' rename)

- Date: 2026-09-04
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/core/battle/CombatAction.ts`, `game/src/core/battle/ActionTargetingSystem.ts`, `game/src/core/battle/SkillEffectResolver.ts`, `game/src/data/skill/Skills.ts`, `game/src/core/battle/ActionTargetingSystem.test.ts`, `game/src/core/battle/ActionImpactSystem.test.ts`, `game/src/core/battle/BattleSystem.castTime.test.ts`, `game/src/core/skill/SkillSystem.targeting.test.ts` (+ QA-authored `ActionTargetingSystem.adversarial.test.ts`)

## Scope and Risk Map

- Changed systems: combat targeting/shape resolution — lần đầu tiên trong rework này có production files SỐNG bị sửa (CombatAction/ActionTargetingSystem/SkillEffectResolver/6 skill definitions trong Skills.ts).
- One-hop consumers (mapper): "combat presentation and controls" (renderer đọc shape qua `action_impact`), "loot/progression" (không đổi — logic kết thúc trận không đụng).
- Domain pack: combat-and-tribulation. `deepAuditCandidate: false`, `unmappedPaths: []` → không escalate.
- Điểm rủi ro chính: behavior parity của 6 skill `'area'`→`'square'` trong Skills.ts — đã neutralize bằng thiết kế plan (square branch = byte-for-byte rectangle logic cũ) + probe INV-AOE-5 kiểm chứng trực tiếp.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-AOE-1 | `collectAffected` | `'cross'` (areaFor trả null) | Boundedness: cross KHÔNG rơi nhánh `!area → []`; filter per-cell qua isCellInShape | value mutation | arm cells được thu, corner bị loại | Unit (probe + plan test) | High |
| INV-AOE-2 | `collectAffected` | sort isPrimary-first với shape mới | Synchronization: primary đứng đầu mọi shape | reorder | affected[0] = primary | Unit (probe) | High |
| INV-AOE-3 | `collectAffected` | `'cross'` + maxTargets=1 | Boundedness: cắt đúng, primary luôn được giữ | value mutation | length 1, id=primary | Unit (probe) | Medium |
| INV-AOE-4 | `areaFor` | row/line/column equivalence | Determinism: row ≡ line (CellArea), column đúng chiều dọc | equivalence | CellArea bằng trực tiếp | Unit (probe) | Medium |
| INV-AOE-5 | Skills.ts parity | `'area'`→`'square'` rename | Exactly-once behavior: rectangle logic không đổi | equivalence check | corner-clamp test với shape 'square' | Unit (probe + 36 test renamed files) | Critical |
| INV-AOE-6 | `targetingForSkill` | fallback inference | Synchronization: caller thấy 'square', không còn 'area' literal nào sống | stale state | result.shape = 'square' | Unit (probe) | High |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run src/core/battle/ActionTargetingSystem.test.ts` | 15/15 (TDD: 3 new fail→pass; 3 old 'area' fail đúng lý do trước khi rename, sau rename pass) | Deterministic |
| `npx vitest run` (4 renamed test files, Task 2 Step 3) | 4 files / 36 tests pass | — |
| `npm.cmd test` (full suite) | 362 files / 2408/2408 pass — ZERO regression (kể cả deadReferences flaky pass lần này) | — |
| `npm.cmd run type-check` | Pass, exit 0 — không có switch exhaustiveness nào vỡ | — |
| Grep `'area'` toàn game/src sau rename | 0 match trong code (1 match duy nhất = comment lịch sử trong CombatAction.ts ghi chú chính rename đó) | — |
| Probes INV-AOE-1..6 | 6/6 pass | 1 probe lỗi cú pháp `await import` là lỗi probe QA (đã sửa bằng static import) |

## Findings

Không có Confirmed/Suspected defect. Không có Coverage gap mới ngoài những cái đã ghi nhận ở foundation trước (cross chưa gán cho skill nào — đúng phạm vi plan).

## New or Changed QA Tests

- `game/src/core/battle/ActionTargetingSystem.adversarial.test.ts` — 6 probes INV-AOE-1..6 (pass)

## Gaps and Residual Risk

- `'cross'`/`'row'`/`'column'` chưa được gán cho bất kỳ skill thật nào trong Skills.ts (đúng phạm vi — "this plan adds the shapes, it does not use them in content"). Khi content work gán shape mới, cần test VFX/renderer hiển thị đúng (presentation layer chưa có test cho cross).
- `AoeShape.ts` (Foundation) giờ được import bởi `ActionTargetingSystem.ts` — dependency hướng này là thiết kế chủ đích của spec survey; `AoeShape.ts` giữ nguyên, không modified (đã xác minh bằng git log).

## Pre-existing Failures

- Không có — full suite 2408/2408 pass.
