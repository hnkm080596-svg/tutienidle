# QA Quick Report — Gameplay Fixes (pacing/refight/pill) — 2026-09-05

**Scope:** `feat/gameplay-fixes` branch — 4 player-reported issues + 1 removal request:
1. Battle ends in a blink (no time for anything)
2. No spawn/countdown animations visible
3. No animations on screen at all (only item notifications)
4. 2nd "Đánh Lại" (refight) errors
+ Remove HP-regen pills (user request)

## Root Causes (all confirmed by failing-test-first TDD)

1. **Pacing (bugs 1-3):** `updateBattleFixedStep` called `resolveNextStep()` every
   0.1s tick; `resolveNextTurn`'s inner loop advances gauges to ready WITHIN one
   call → 1 tick = 1 full turn. A 10-turn battle finished in ~1s. Compounded by
   enemy speed unit mismatch: enemy speed 0.8-2.5 (attacks/sec scale) vs player
   ~100 (HSR scale) — enemies effectively never acted.
   **Fix:** `tickPacing()` — 1 tick = 1 gauge step; resolve only on ready; enemy
   speed ×100 (80-250) matching player scale (1 turn/sec at attackSpeed 1).
2. **Refight (bug 4):** `turnBattleEndEmitted` + rewards set + awaitedManualActor
   only reset in `restartTurnBattleCycle`, NOT in `startStage` — 2nd battle
   inherited emitted=true; victory terminal never fired; stopRepeat never released
   StageManager → 3rd refight's startStage returned false.
   **Fix:** per-battle flags reset in `startStage` (repro test: 3 consecutive
   victory rounds).
3. **Pill hpRegen:** removed `hpRegenPerTurn` modifier registration (user request —
   meaningless under turn pacing). MP regen pills unaffected.

## Invariant Ledger

| ID | State/owner | Action/transition | Invariant | Attack operator | Oracle | Kết quả |
|---|---|---|---|---|---|---|
| INV-GF-1 | TurnBattle gauges | tickPacing × 5 (speed 100) | Boundedness: gauge < MAX → không turn | Timing boundary | turnsElapsed=0, HP unchanged | ✅ pass |
| INV-GF-2 | tickPacing × 10 | Gauge đầy → resolve đúng 1 turn | Pacing: 1 turn/giây tại speed 100 | Timing boundary | turnsElapsed=1 | ✅ pass |
| INV-GF-3 | tickPacing return | Actor ready → return actor cho pause check | Synchronization | — | returns player | ✅ pass |
| INV-GF-4 | refight × 3 rounds | startStage → victory × 3 | Exactly-once terminal per battle; StageManager release mỗi round | Repeat | round 3 startStage=true | ✅ pass (repro test) |
| INV-GF-5 | autoFarm cycle | fake-time 60s trôi | Leftover carry-over (lastCheckedMs +50s chính xác) | Timing boundary | lastCheckedMs exact | ✅ pass (existing) |
| INV-GF-6 | offline settle 120s | 2 cycles roll, 20s dư giữ lại | Recoverability offline | Interruption | lastCheckedMs boundary | ✅ pass (existing) |
| INV-GF-7 | regen pill use | modifiers[] không chứa hpRegenPerTurn | Removal complete | Value mutation | filter length=0 | ✅ pass |

## Evidence
- Full suite **2510/2510 pass, 0 failures** (pre-existing PillSystem gap retired
  together with its feature), type-check 0 errors, build pass.
- Mapper flagged `deepAuditCandidate` (time-and-offline) — NOT escalated: the
  time-boundary invariants (INV-GF-5/6) have direct fake-timer tests at the
  carry-over boundary; offline/online paths both exercised.

## Suspected / Coverage gaps
1. **Spawn/countdown VFX animations là feature gap có trước** (turn engine spawn
   đứng yên — roadmap ghi từ Slice 6). Pacing fix cho trận có thời gian thực →
   damage/status VFX hiện có giờ có thời gian render. Spawn animation cần
   feature mới (roadmap), KHÔNG phải bugfix.
2. `Enemies.test.ts` speed range assertion updated (0.8-2.5 → 80-250) — pin mới
   theo thang pacing; nếu tương lai đổi thang lần nữa cần update lại.

## Verdict
**PASS WITH EVIDENCE** — mọi player-reported regression có repro test trước/sau;
full suite xanh tuyệt đối; không có defect mới phát hiện thêm.
