# QA Review: WaveSpawnTrigger (turn-based stage spawn/complete decision)

- Date: 2026-09-04
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/core/battle/turn/WaveSpawnTrigger.ts`, `game/src/core/battle/turn/WaveSpawnTrigger.test.ts` (+ QA-authored `WaveSpawnTrigger.adversarial.test.ts`). Không file sống nào bị sửa.

## Scope and Risk Map

- Changed systems: 2 pure decision functions (spawn/complete), port từ `StageWaveSystem.update()` với throttle `spawnCountdown` bỏ hẳn. Không state, không class, 0 production caller hiện tại.
- One-hop consumers (mapper): "combat presentation and controls", "loot/progression" — chưa tồn tại (chưa wire vào TurnBattleSystem, đúng phạm vi).
- Domain pack: combat-and-tribulation. `deepAuditCandidate: false`, `unmappedPaths: []`.
- Parity đã xác minh: victory-check `spawnedCount >= stage.totalEnemyCount && aliveCount === 0` tại `StageWaveSystem.ts:120` khớp `isStageComplete`.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-WST-1 | `shouldSpawnNextEnemy` | aliveCount âm (input lỗi) | Boundedness: giá trị không phải 0 → không spawn | value mutation | false | Unit (probe) | Medium |
| INV-WST-2 | `isStageComplete` | đầu vào âm | Boundedness: nhất quán với nghĩa `>=` (spawned âm → không complete) | value mutation | false / true theo `>=` | Unit (probe) | Medium |
| INV-WST-3 | `shouldSpawnNextEnemy` | boundary spawned = total-1 vs total | Determinism: ranh giới spawn đúng | timing boundary | true tại 4/5, false tại 5/5 | Unit (probe) | High |
| INV-WST-4 | cả 2 hàm | mọi trạng thái hợp lệ | Mutual exclusion: spawn ⇒ không complete (khi cùng alive) | reorder/exhaustive sweep | loop assert | Unit (probe) | High |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run src/core/battle/turn/WaveSpawnTrigger.test.ts` | 7/7 pass (TDD fail→pass) | — |
| `npx vitest run src/core/battle/turn/WaveSpawnTrigger.adversarial.test.ts` | 4/4 pass | — |
| `npm.cmd test` (full suite) | 2446/2447; 1 fail = `deadReferences.test.ts` flaky pre-existing (pass đơn lẻ 3/3 sau đó) | Flaky evidence đã rerun |
| `npm.cmd run type-check` | Pass, exit 0 | — |
| Parity check `StageWaveSystem.ts:120` vs `isStageComplete` | Khớp điều kiện victory-check thật | Static inspection |

## Findings

Không có Confirmed/Suspected defect.

## New or Changed QA Tests

- `game/src/core/battle/turn/WaveSpawnTrigger.adversarial.test.ts` — 4 probes INV-WST-1..4 (pass)

## Gaps and Residual Risk

- Chưa wire vào TurnBattleSystem (đúng phạm vi — Slice 5 theo roadmap overview).
- `pickEnemyForSpawn` boss-priority không port (đúng phạm vi plan — đã note trong "Not Covered").

## Pre-existing Failures

- `src/core/equipment/deadReferences.test.ts`: flaky khi full-suite (pass đơn lẻ) — tồn tại trên master từ trước, không do task.
