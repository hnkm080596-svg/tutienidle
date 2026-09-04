# QA Review: Turn Battle System Slice 2 — 3-Skill Action Model

- Date: 2026-09-04
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/core/battle/turn/TurnSkillAction.ts`, `game/src/core/battle/turn/TurnSkillAction.test.ts`, `game/src/core/battle/turn/TurnBattleSystem.ts`, `game/src/core/battle/turn/TurnBattleSystem.test.ts` (+ QA-authored `TurnSkillAction.adversarial.test.ts`). Không file sống nào khác bị sửa.

## Scope and Risk Map

- Changed systems: TurnBattleSystem mở rộng — 3-skill action model (basic/special/ultimate), resource gating (mana/sword_intent/momentum), cooldown đếm theo lượt của chính actor, AOE targeting qua shape system đã có, và API mới `resolveNextStep()` (step-oriented, production entry point cho Slice 3-7). `runToCompletion()` giờ là thin wrapper.
- Backward compatibility: mọi Slice 1 test giữ nguyên pass (11/11) — `basic`/`special`/`ultimate` đều optional, fallback hardcoded basic attack đúng Slice 1.
- One-hop consumers: chưa có production caller (headless như trước); `TurnSkillAction.ts` ↔ `TurnBattleSystem.ts` circular type-only import đã type-check sạch (runtime không có cycle).
- Domain pack: combat-and-tribulation. `deepAuditCandidate: false`, `unmappedPaths: []`.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-S2-1 | `selectAction` | ultimate CD + special hết resource | Boundedness: fallback basic_attack, không crash/thụt lề | value mutation | skillId='basic_attack' | Unit (probe) | High |
| INV-S2-2 | `tickCooldowns` | tick khi đã 0 | Boundedness: floor 0, không âm | repeat | vẫn 0 sau 3 tick | Unit (probe) | Medium |
| INV-S2-3 | select vs commit | chọn action không tiêu resource | Atomicity: resource chỉ trừ khi cast thật (commitAction) | reorder | mp giữ 50 sau select, 30 sau commit | Unit (probe) | High |
| INV-S2-4 | `collectTurnTargets` | cross radius 0 | Boundedness: chỉ anchor cell, trả [primary] khi không ai khớp | timing boundary | ['primary'] | Unit (probe) | Medium |
| INV-S2-5 | `resolveNextStep` | AOE multi-target | Exactly-once damage per target: step report đủ targetIds, mọi target trúng | value mutation | 2 targets hit, hp giảm cả 2 | Unit (probe) | High |
| INV-S2-6 | full loop | special CD → basic thay thế | Determinism: combat không dừng, victory đúng | reorder | runToCompletion='victory' | Unit (probe) | High |
| INV-S2-7 | Slice 1 compat | participant không có skill fields | Synchronization: fallback path = Slice 1 behavior nguyên văn | stale state | 11/11 test cũ pass unmodified | Unit (plan Task 4 Step 4) | Critical |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run src/core/battle/turn/TurnSkillAction.test.ts` | 22/22 pass (TDD fail→pass từng task: 8→17→22) | — |
| `npx vitest run` TurnBattleSystem.test.ts + adversarial | 15/15 pass — Slice 1 cases giữ nguyên pass | — |
| `npx vitest run src/core/battle/turn/TurnSkillAction.adversarial.test.ts` | 6/6 pass | — |
| `npm.cmd test` (full suite) | 2474/2476; 2 fail = `deadReferences.test.ts` flaky pre-existing (pass đơn lẻ 3/3) | Flaky evidence đã rerun |
| `npm.cmd run type-check` | Pass, exit 0 — không circular import runtime | — |

## Findings

Không có Confirmed/Suspected defect.

## New or Changed QA Tests

- `game/src/core/battle/turn/TurnSkillAction.adversarial.test.ts` — 6 probes INV-S2-1..6 (pass)

## Gaps and Residual Risk

- Content migration (skill thật vào 3 slot, enemy `specialAttacks[]` conversion) — được plan ghi rõ ngoài phạm vi, theo roadmap.
- `resolveNextStep` chưa có production caller — rủi ro thực nằm ở Slice 6 cutover (GameManager contract).
- Không buff/reaction ở slice này (Slice 3) — skill damage thuần.

## Pre-existing Failures

- `src/core/equipment/deadReferences.test.ts`: flaky (pass đơn lẻ) — tồn tại trên master từ trước.
