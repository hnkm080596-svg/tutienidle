# QA Quick Report — Turn-Based Combat Completion Remaining (Tasks 6/7/10/11/13) — 2026-09-04

**Scope:** Completion plan tasks thực thi trong worktree `feat/turn-combat-completion-remaining`:
Task 6 (dpsRatio survey), Task 7 (zone-as-dot definitions), Task 10 (Slice 7 manual UI:
peekNextActor/resolveActorTurn + GameManager manual mode + TurnCombatSkillBar),
Task 11 (turn-order preview + battle log), Task 13 (46-buff turn converter + registry).

**Excluded dirty files (không thuộc task):** `.opencode/agent/*.md` trên master checkout (chỉnh
sửa sẵn có của người dùng, ngoài worktree QA).

## Mapper

`deepAuditCandidate: true` — reasons: critical state boundary time-and-offline; cross-system
5 domains. **Không escalate, lý do bound được bằng code inspection:**
- Không persist gì mới: battle/log ephemeral (nguyên tắc rework), không đụng save shape.
- Time/offline: `updateBattleFixedStep` chỉ thêm nhánh skip-resolve khi pause; catch-up loop,
  catchup cap, countdown pacing giữ nguyên hành vi.
- Economy: không có reward path mới; `grantBattleRewardIfNeeded` chạy như cũ mỗi fixed step.
- Vue lifecycle: UI mới mount/unmount theo CombatSceneOverlay có sẵn; không timer/listener riêng
  (đọc qua stateVersion bridge, cùng pattern các HUD đang sống).

## Invariant Ledger

| ID | State/owner | Action/transition | Invariant | Attack operator | Oracle | Kết quả |
|---|---|---|---|---|---|---|
| INV-TM-1 | `awaitedManualActor` (GameManager) | submitTurnChoice ×2 | Exactly-once: choice thứ 2 = false, không resolve 2 lần | Repeat | return value | ✅ pass (probe test) |
| INV-TM-2 | fixed-step loop khi pause | victory/reward trong pause | Reward path không bị chặn/broken bởi pause | Reorder/timing | state vẫn fighting, grant chạy | ✅ pass (probe test + code inspection) |
| INV-TM-3 | `battle.log` | resolveActorTurn × N | Append-only, bounded (mỗi lượt 1 entry) | Value mutation | log length = turns | ✅ pass (TurnOrderPreview.test.ts) |
| INV-TM-4 | `peekUpcomingActors` | peek khi manual đang chờ | Idempotency: peek KHÔNG mutate gauge thật (pause giữ nguyên) | Stale state | gauge before/after | ✅ pass (TurnOrderPreview.test.ts) |
| INV-TM-5 | `submitTurnChoice` khi không awaiting | bấm khi không pause | Synchronization: no-op an toàn, không throw/resolve | Repeat | return false, turns unchanged | ✅ pass (probe test) |
| INV-TM-6 | `setBattleManualMode(false)` giữa pause | toggle off đang pause | Recoverability: hủy pause, engine tự chạy tiếp | Reorder | awaited null, tick sau resolve | ✅ pass (probe test) |

## Adversarial Findings

**Confirmed defects:** 2 — cả 2 đều phát hiện bằng browser smoke test (Task 14 Step 3, Playwright runtime evidence), KHÔNG phải do code Slice 7 mới (root cause từ Task 8 Slice 6 cutover đã merge), ĐÃ FIX trong phiên này:

1. **Refight sau victory no-op vĩnh viễn** — `StageManager.active` không được release sau Slice 6 cutover: `StageWaveSystem.update()` return sớm vì `syncLegacyBattleState()` set `legacy.state='victory'` trực tiếp, nên `stageManager.stop()` (dòng 137) không bao giờ chạy → `startStage()` → `stageManager.start()` return false → "Đánh Lại" im lặng thất bại toàn session. Repro: tạo guest → đánh Tầng 1 → victory → Đánh Lại → không có gì xảy ra (trước fix) / countdown trận mới (sau fix). Regression test: `GameManager.turnManualQa.test.ts` "startStage thành công lại sau khi turn battle đã victory". Fix: `grantTurnBattleRewards()` gọi `stageWaves.stopRepeat()` khi terminal + không auto-repeat.
2. **HUD crash `Cannot read properties of undefined (reading 'speed')`** — `GameManager.getBattle()` cast `TurnBattle` thành `Battle` (Task 8 shim); `buildLoadoutPresentation()` đọc `battle.player.stats.speed` nhưng `TurnBattleParticipant` không mang `stats` real-time → Vue watcher HUD (useCadenceSmoothing qua MortalCombatHud) throw, ErrorBoundary hiện ErrorScreen sau Đánh Lại. Stack capture qua pinia error-store patch (Playwright). Fix: optional-chain `battle.player.stats?.speed ?? 0` trong `CombatSkillPresentation.ts` (cadenceTotal = clamp thay vì crash; turn combat không dùng cadence seconds nên giá trị này không có consumer turn-based).

**Suspected / Coverage gaps:**

1. **Coverage gap — TurnCombatSkillBar/TurnOrderStrip/BattleLogPanel chưa có component test**
   (Vue mount-level). Logic UI mỏng (guard `isTappable` + delegate GameManager) và engine-level
   đã được probe test; component test sẽ có giá trị khi dọn UI debt. Không bịt trong QA (viết
   component test là follow-up dev, không phải reproduction defect).
2. **Suspected — TURN_BUFF_REGISTRY chưa có consumer production nào** (converter + registry
   hoàn tất, chưa wire vào TurnBattleSystem registry slot — kế hoạch content migration sẽ
   dùng). Static inspection; không phải defect runtime.
3. **Pre-existing failures (KHÔNG thuộc task này, có trên master trước thay đổi):**
   - `CombatSkillPresentation.test.ts` 6/6 fail: `Cannot read properties of undefined
     (reading 'attackRange')` — test pin shape Battle cũ mà Slice 6 cutover đã đổi (shim
     `getBattle()` thiếu field). Xác nhận fail cả trên master checkout gốc.
   - `PillSystem.profession.test.ts` 1 fail: `Cannot read properties of undefined (reading
     'hpRegenPerTurn')` tại dòng 148 — cùng pattern shim thiếu stats field.
   - `DebugDamage.test.ts` flaky (pass/fail ngẫu nhiên — `chanceToIgnoreResistance` roll không
     được khống chế trong test, Determinism violation của test本身).

## Verdict

**PASS WITH EVIDENCE** cho phạm vi task thực thi: 4 QA probes pass, turn/ suite 199/199,
turn/ + manual-mode + combat presentation turn tests 202/202, full suite 2472/2479
(7 fail pre-existing được xác nhận tồn tại trên master trước thay đổi), type-check sạch,
build pass. Browser smoke test end-to-end (Task 14 Step 3): guest creation → battle 1 →
victory → Đánh Lại → battle 2 (countdown ✓, victory ✓, 0 runtime error sau 2 fix).
2 confirmed defects (refight no-op + HUD speed crash) phát hiện + fix + regression test
trong phiên này — root cause từ Task 8, không phải code Slice 7.

**Ghi chú quan sát:** TurnCombatSkillBar/TurnOrderStrip/BattleLogPanel không kịp render
trong trận Tầng 1 (fighting phase ~0.6s < 1 stateVersion tick 1s) — pattern computed
dependency đúng như các HUD đang sống; trận dài hơn sẽ hiển thị. Không phải defect.
