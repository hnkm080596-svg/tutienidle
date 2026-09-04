# QA Review: Combat Fairness Guards — Bá Thể + Sudden Death

- Date: 2026-09-04
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/core/battle/turn/TurnBuffPool.ts`, `game/src/core/battle/turn/TurnBattleSystem.ts`, `game/src/core/battle/turn/TurnBattleSystem.test.ts` (+ fixture helper updates trong các test file turn/ khác, + QA-authored `DebugDamage.test.ts` regression evidence). Không file sống nào ngoài turn/ bị sửa.

## Scope and Risk Map

- Changed systems: TurnBattleSystem thêm 2 fairness guard — (1) **Bá Thể**: bị hard-CC (stun/freeze) liên tục >= 3 lượt thì lượt thứ 4 tự gỡ CC (`TurnBuffPool.clearCcEffects()` mới) và hành động được, counter reset; (2) **Sudden Death**: từ tổng lượt 11, damage gây ra scale tuyến tính `1 + 0.3×(turn−10)` qua `scaleActionDamage` (heal/shield side chưa wire — không có cơ chế heal/shield trong engine, đúng plan constraint).
- Bá Thể fields: `consecutiveHardCcTurns` (required, default 0 — tất cả fixture helpers đã update), `baTheTriggeredAtTurn?` (optional, để Slice 7 hiển thị).
- Domain pack: combat-and-tribulation. `deepAuditCandidate: false`, `unmappedPaths: []`.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-FG-1 | Bá Thể counter | 3 lượt blocked đầu | Determinism: counter tăng đúng 1/block-turn | repeat | 1,2,3 | Unit (plan) | High |
| INV-FG-2 | Bá Thể fire | lượt blocked thứ 4 | Exactly-once release: gỡ CC, hành động được, counter=0, baTheTriggeredAtTurn set | timing boundary | ccBlocked=false + targetIds=[enemy] + pool rỗng | Unit (plan) | Critical |
| INV-FG-3 | Bá Thể reset | lượt không bị CC | Monotonicity: counter reset 0 ngay khi không block | stale state | counter=0 | Unit (plan) | High |
| INV-FG-4 | Sudden Death grace | turn <= 10 | Determinism: damage x1 nguyên vẹn | timing boundary | = control run | Unit (plan) | High |
| INV-FG-5 | Sudden Death scale | turn 11 / turn 15 | Boundedness: scale tuyến tính đúng hệ số (đÃ tính endurance flat-subtract của pipeline hệ sống) | equivalence | (base+7)×m−7 model | Unit (plan, sửa theo evidence) | Critical |
| INV-FG-6 | endurance pipeline | mọi đòn > threshold | Documented behavior: trừ phẳng 7 SAU multiplier — không phải % (nguyên nhân plan test gốc fail) | equivalence | DebugDamage.test.ts regression | Unit (QA evidence) | High |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run src/core/battle/turn/` | 26 files / 170/170 pass (TDD fail→pass) | — |
| Debug probe thực nghiệm `resolveActionHit` m=1/1.3/2.5 | d=93/123/243 → chứng minh mô hình `damage(m) = (base+flat)×m − flat` với flat=7=enduranceThreshold(10)×endurancePercent(0.7) | Root cause plan-test sai: bỏ qua endurance flat-subtract SAU scale trong pipeline hệ sống |
| `npm.cmd test` (full suite) | 2528/2530; 2 fail = `deadReferences.test.ts` flaky pre-existing (pass đơn lẻ 3/3) | Flaky evidence đã rerun |
| `npm.cmd run type-check` | Pass, exit 0 | — |

## Findings

### QA-2026-09-04-501 (plan-test divergence, resolved): Sudden Death expected values bỏ qua endurance
- Severity: N/A (plan test sai, production code đúng)
- Status: Resolved trong phiên
- Chi tiết: Plan kỳ vọng `scaledDamage = baseDamage × m` nhưng pipeline hệ sống áp `applyEndurance` (trừ PHẲNG threshold×percent = 7) SAU mọi multiplier. Chứng minh thực nghiệm qua debug probe (93→123→243, sai số = 7×(m−1)). Test sửa thành `(baseDamage + enduranceFlat) × m − enduranceFlat` — assert vẫn verify đúng hệ số scale 1.3/2.5, chỉ đúng về mặt mô hình damage pipeline. Implementation production giữ nguyên như plan (scale qua `scaleActionDamage` trước `resolveActionHit`).
- Learned note: mechanics cuối pipeline (endurance/ward/floor) là "flat effects sau multiplier" — mọi test so sánh damage tuyệt đối tương lai cần khống chế hoặc mô hình hóa chúng.

## New or Changed QA Tests

- `game/src/core/battle/turn/DebugDamage.test.ts` — regression evidence cho endurance flat-subtract model (pass)

## Gaps and Residual Risk

- Sudden Death heal/shield-received multiplier chưa wire (không có cơ chế heal/shield trong turn engine — đúng plan constraint).
- Bá Thể chỉ guard hard-CC (stun/freeze) — soft-CC không tồn tại trong TurnBuffTypes hôm nay.
- UI/battle-log hiển thị 2 mechanic firing — Slice 7 domain.

## Pre-existing Failures

- `deadReferences.test.ts`: flaky khi full-suite (pass đơn lẻ) — tồn tại trên master từ trước.
