# QA Review: TurnBattleSystem Slice 1 (core turn loop)

- Date: 2026-09-04
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/core/battle/turn/TurnBattleSystem.ts`, `game/src/core/battle/turn/TurnBattleSystem.test.ts` (+ 2 QA-authored test files: `TurnBattleSystem.adversarial.test.ts`, `TurnBattleSystem.qadebug.test.ts`). Không file production hiện có nào bị sửa.

## Scope and Risk Map

- Changed systems: headless turn-based battle engine (new, 0 production caller — chưa wire vào BattleSystem/GameManager đúng phạm vi Slice 1).
- One-hop consumers (mapper): "combat presentation and controls", "loot, progression, and persistence after combat" — hiện tại không tồn tại vì TurnBattleSystem chưa được bất kỳ code nào import.
- Domain pack: combat-and-tribulation. Escalation: không cần — mapper `deepAuditCandidate: false`, `unmappedPaths: []`, mọi behavior có oracle unit trực tiếp.
- Exclusions: `docs/superpowers/specs/2026-09-03-turn-based-combat-design.md` (uncommitted docs edit của Claude), `game/docs/combat-ui-controls-survey.md`, `package-lock.json` root — không thuộc task.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-S1-1 | `runToCompletion` | Battle đến chết 1 bên | Exactly-once terminal state: victory/defeat set đúng 1 lần, battle.state được mutate đồng bộ | value mutation (lethal HP) | return value + battle.state | Unit (plan test: victory/defeat cases) | High |
| INV-S1-2 | `runToCompletion` | maxTurns=0 | Boundedness: cap=0 terminate ngay, không hang, không side effect | value mutation | return 'defeat', cả 2 bên còn sống | Unit (`TurnBattleSystem.adversarial.test.ts`) | High |
| INV-S1-3 | `selectTarget` | 2 candidate cùng Chebyshev | Determinism: cùng thứ tự input → cùng winner (first-min theo reduce) | reorder | winner id theo từng thứ tự | Unit (adversarial) | Medium |
| INV-S1-4 | `selectTarget` | same-row xa vs other-row gần hơn | Targeting rule: cùng hàng luôn ưu tiên trước Chebyshev toàn cờ | reorder | winner = sameRowFar | Unit (adversarial) | High |
| INV-S1-5 | `runToCompletion` | enemy chết giữa trận | Synchronization: wrapper.alive sync từ entity.alive mỗi vòng; dead không được chọn làm actor | stale state | terminal victory, không treo | Unit (adversarial) | High |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run src/core/battle/turn/TurnBattleSystem.test.ts` | 8/8 pass (TDD fail→pass từng task) | Deterministic |
| `npx vitest run src/core/battle/turn/` (toàn bộ, gồm Foundation + Slice 1 + QA probes) | 16 files, 63/63 pass | — |
| `npm.cmd test` (full suite) | 2399/2400 pass; 1 fail = `deadReferences.test.ts` flaky pre-existing (pass đơn lẻ) | Pre-existing, không do task |
| `npm.cmd run type-check` | Pass, exit 0 | — |
| Probe INV-S1-2/3/4/5 | 4/4 pass sau khi sửa probe-hygiene bug của chính QA | 2 fail ban đầu là lỗi trong probe QA (double `?.id` trên string; oracle determinism phóng đại), không phải defect production — đã xác minh qua debug replica pass |

## Findings

Không có Confirmed/Suspected defect nào trong production code của Slice 1.

### QA-2026-09-04-101 (process note, không phải defect): QA probe false-positive
- Severity: N/A (lỗi probe, không phải code production)
- Status: Resolved trong phiên (probe đã sửa, pass)
- Ghi chú: 2 probe ban đầu fail do lỗi của chính probe (double optional-chain `?.id` sau khi helper đã trả string; kỳ vọng determinism sai hướng). Debug flow chứng minh `selectTarget` hành vi đúng: cùng input → cùng output; same-row ưu tiên đúng luật. Đã giữ lại `TurnBattleSystem.qadebug.test.ts` làm regression test cho oracle hygiene.

## New or Changed QA Tests

- `game/src/core/battle/turn/TurnBattleSystem.adversarial.test.ts` — 4 probes: INV-S1-2/3/4/5 (pass)
- `game/src/core/battle/turn/TurnBattleSystem.qadebug.test.ts` — oracle-hygiene regression (pass)

## Gaps and Residual Risk

- TurnBattleSystem chưa có production caller — mọi rủi ro wiring/UI/loot là chủ đề của các slice sau (đúng phạm vi, non-material cho Slice 1).
- `resolveActionHit` dùng `Math.random()` nội bộ (hit/ignore-resistance) — các test đã neutralize bằng evasionRate/criticalRate = 0; random vẫn ảnh hưởng damage magnitude nhưng không ảnh hưởng oracle terminal-state của các probe hiện có. Coverage gap nhỏ, chấp nhận được ở Slice 1 (spec §5 ghi rõ không chứng minh skill/element variety).

## Pre-existing Failures

- `src/core/equipment/deadReferences.test.ts`: flaky khi chạy full suite (pass đơn lẻ cả trên master lẫn worktree). Không do task này.
