# QA Review: turn-based combat foundation primitives

- Date: 2026-09-04
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/core/battle/turn/` (ActionGauge.ts, TurnQueue.ts, ChannelQueue.ts, AoeShape.ts, BounceChain.ts, TrueShot.ts, BossTurnTriggers.ts, MomentumBreak.ts, ResourceTurnHook.ts + 13 test files) — toàn bộ là file MỚI, không file production nào bị sửa.

## Scope and Risk Map

- Changed systems: combat primitives (standalone, chưa wire vào BattleSystem/CombatSystem — đúng phạm vi plan "Not Covered").
- One-hop consumers (mapper): "combat presentation and controls", "loot, progression, and persistence after combat" — hiện chưa có consumer nào vì đây là scaffolding thuần; risk thực nằm ở follow-up wiring plan.
- Domain pack: combat-and-tribulation. Escalation: không cần — mapper `deepAuditCandidate: false`, `unmappedPaths: []`, mọi module đều pure-function có oracle unit rõ ràng.
- Exclusions: `game/docs/combat-ui-controls-survey.md`, `package-lock.json` (root, untracked) — không thuộc task.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-TURN-1 | `ActionGauge` (refundGauge) | Caller truyền amount âm (value mutation) | Boundedness: gauge ∈ 0..GAUGE_MAX | amount=-9999 | `actor.actionGauge >= 0` | Unit | High (primitive công khai, sẽ bị caller tương lai dùng) |
| INV-TURN-2 | `TurnQueue.resolveNextTurn` | Toàn bộ actor speed 0/âm (Break/CC) | Boundedness/determinism: vòng lặp terminate | speed=0, speed=-5 | trả về null, không treo | Unit | High (comment trong code tự nhận kịch bản này) |
| INV-TURN-3 | `MomentumBreak.onHitLanded` | gain âm | Boundedness: stack không âm | gain=-50 | `stack >= 0` | Unit | Medium |
| INV-TURN-4 | `ResourceTurnHook.applyTurnStartDeltas` | NaN/Infinity amount | Boundedness: stat hữu hạn sau clamp | NaN, Infinity | `Number.isFinite`, clamp max | Unit | Medium |
| INV-TURN-5 | `TurnQueue` tie-break + dead-filter | speed bằng nhau, actor chết | Determinism: priority thấp đi trước; dead bị loại | reorder | winner id | Unit (đã có trong plan suite) | High |
| INV-TURN-6 | `ChannelQueue` charge lifecycle | tick đến 0 và multi-charge độc lập | Exactly-once resolve | repeat tick | resolved/remaining lists | Unit (đã có trong plan suite) | High |
| INV-TURN-7 | `AoeShape` shapes vs bounding box | cross không được là khối vuông; row/column clamp biên | Determinism targeting | boundary cells | isCellInShape boolean | Unit (đã có trong plan suite) | High |
| INV-TURN-8 | `BounceChain` chain | dead/visited/out-of-area | Boundedness: chain dừng sớm, không loop | bounceCount lớn hơn số candidate | chain array | Unit (đã có trong plan suite) | High |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run src/core/battle/turn/` (worktree) | 44/44 pass (9 files, gồm 4 adversarial test mới) | Focused, deterministic |
| `npm.cmd test` (full suite, worktree) | 2384/2386 pass; 2 fail = `deadReferences.test.ts` (pre-existing flaky, xem section riêng) | Flaky evidence đã rerun: file này pass đơn lẻ cả trên master lẫn worktree |
| `npm.cmd run type-check` | Pass, 0 error | — |
| Probe `ActionGauge.adversarial.test.ts` | FAIL đúng lý do → Confirmed QA-2026-09-04-001 | reproduction test trong allowlist |
| Probe `MomentumBreak.adversarial.test.ts` | FAIL đúng lý do → Confirmed QA-2026-09-04-002 | reproduction test trong allowlist |
| Probe `ResourceTurnHook.adversarial.test.ts` | 1/2 fail đúng lý do → Confirmed QA-2026-09-04-003 | reproduction test trong allowlist |
| Probe `TurnQueue.adversarial.test.ts` | 2/2 pass → INV-TURN-2 resolved, không defect | — |

## Findings

### QA-2026-09-04-001: `refundGauge` nhận amount âm đẩy gauge xuống dưới 0
- Severity: Low (hiện tại) / High nếu wiring caller truyền giá trị không tin cậy
- Status: Confirmed
- Invariant: Boundedness — gauge ∈ 0..GAUGE_MAX (spec §3)
- Preconditions: primitive chưa có caller trong production
- Reproduction: `ActionGauge.adversarial.test.ts` — `refundGauge({actionGauge: 900}, -9999)` → `-9099`
- Expected: gauge không bao giờ rời miền 0..GAUGE_MAX
- Actual: -9099
- Evidence: failing test `game/src/core/battle/turn/ActionGauge.adversarial.test.ts`
- Test file: `game/src/core/battle/turn/ActionGauge.adversarial.test.ts`
- Owner subsystem: `game/src/core/battle/turn/ActionGauge.ts`
- Blast radius: chỉ module mới chưa wire; sẽ trở thành combat-state corruption khi wiring plan dùng nó với input không clamp

### QA-2026-09-04-002: `onHitLanded` nhận gain âm đẩy momentum stack âm
- Severity: Low (hiện tại)
- Status: Confirmed
- Invariant: Boundedness — stack không âm (decay đã clamp, gain chưa)
- Reproduction: `MomentumBreak.adversarial.test.ts` — `onHitLanded({stack:10}, -50)` → `-40`
- Expected: `stack >= 0`
- Actual: -40
- Evidence: failing test cùng file
- Test file: `game/src/core/battle/turn/MomentumBreak.adversarial.test.ts`
- Owner subsystem: `game/src/core/battle/turn/MomentumBreak.ts`
- Blast radius: như trên — chưa reach được production

### QA-2026-09-04-003: `applyTurnStartDeltas` lan truyền NaN vào stat
- Severity: Low (hiện tại)
- Status: Confirmed
- Invariant: Boundedness — stat hữu hạn sau clamp (NaN bypass cả min/max clamp)
- Reproduction: `ResourceTurnHook.adversarial.test.ts` — amount=NaN → `stat = NaN`
- Expected: stat hữu hạn hoặc bị clamp
- Actual: NaN
- Evidence: failing test cùng file (test Infinity-clamp pass)
- Test file: `game/src/core/battle/turn/ResourceTurnHook.adversarial.test.ts`
- Owner subsystem: `game/src/core/battle/turn/ResourceTurnHook.ts`
- Blast radius: như trên

## New or Changed QA Tests

- `game/src/core/battle/turn/ActionGauge.adversarial.test.ts` — proves INV-TURN-1 (đang fail = reproduction)
- `game/src/core/battle/turn/TurnQueue.adversarial.test.ts` — proves INV-TURN-2 terminate an toàn (pass)
- `game/src/core/battle/turn/MomentumBreak.adversarial.test.ts` — proves INV-TURN-3 (đang fail = reproduction)
- `game/src/core/battle/turn/ResourceTurnHook.adversarial.test.ts` — proves INV-TURN-4 (1 fail = reproduction)

## Gaps and Residual Risk

- REMEDIATION (cùng phiên, sau quick verdict đầu tiên): 3 Confirmed findings đã được sửa trong development workflow (in-scope — các file do task tạo ra):
  - QA-001: `refundGauge` clamp cả dưới (0) lẫn trên (GAUGE_MAX) — `ActionGauge.ts`
  - QA-002: `onHitLanded` clamp stack >= 0 — `MomentumBreak.ts`
  - QA-003: non-finite amount bị bỏ qua (coi là 0), stat không bao giờ thành NaN — `ResourceTurnHook.ts`
- Sau remediation: `npx vitest run src/core/battle/turn/` → 50/50 pass (13 files), `npm.cmd run type-check` → pass. Reproduction tests adversarial giờ đều pass như regression tests.
- Rủi ro cross-system (loot exactly-once, terminal collision, seed determinism của CombatScene) là chủ đề của follow-up wiring plan — Coverage gap có chủ đích, non-material cho foundation này.

## Original Verdict Note

Verdict đầu tiên của quick review là PASS WITH GAPS với 3 Confirmed Low-severity findings (boundedness). Sau khi remediation pass đầy đủ evidence, verdict nâng lên PASS WITH EVIDENCE.

## Pre-existing Failures

- `src/core/equipment/deadReferences.test.ts`: 2/3 test fail FLAKY khi chạy full suite (cả trên master checkout và worktree), pass khi chạy đơn lẻ. Không do task này gây ra — đã xác minh baseline trước khi implement. Đề xuất investigate riêng (file-scan test có race/parallel issue).
