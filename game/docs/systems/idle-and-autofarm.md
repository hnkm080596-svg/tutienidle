# Idle, thời gian offline & Auto-farm

**Trạng thái:** Live.

Core: `core/idle/{GameClock,OfflineProgressSystem,SpeedSettings}.ts`. Auto-farm: `GameManagerTurnBattleOps` (`startAutoFarm`/`stopAutoFarm`/`tickAutoFarm`/`settleAutoFarmOffline`/`rollAutoFarmCycleReward`).

## GameClock — nguồn thời gian duy nhất

- `GameClockState { lastOnlineAt }` — timestamp lần cuối online, persist trong save.
- `calculateOfflineTime(state, now, maxOfflineSeconds)` — **hàm thuần, nguồn duy nhất** tính offline-seconds cho toàn game (A9): clamp `[0, DEFAULT_MAX_OFFLINE_SECONDS]` với `DEFAULT_MAX_OFFLINE_SECONDS = 24h`. Mọi consumer (store lúc load save, GameClock instance) gọi hàm này — không tự đếm elapsed.
- `TICK_INTERVAL_MS = 100` (`SpeedSettings.ts`) — nhịp timer thật của `App.vue`, chỉ quyết định **độ mịn**, không quyết định tốc độ mô phỏng (pace lấy từ `deltaSeconds` đo thật giữa 2 tick). Không còn chọn tốc độ x1/x2/x4. Khớp `BATTLE_FIXED_STEP_SECONDS = 0.1`; khi timer bị throttle/tab ẩn, 1 outer tick chứa nhiều fixed-step — `CombatScene.applyPendingPositions()` coalesce đúng.

## OfflineProgressSystem

`calculateOfflineProgress(offlineSeconds, cultivationPerSecond)` — quy đổi thời gian offline đã clamp thành tu vi. Guard `Number.isFinite` (QA-007): cultivationPerSecond NaN/±Infinity → 0. KHÔNG tự tính elapsed — nhận từ `calculateOfflineTime`.

Các kênh offline settle khác (production, alchemy, building, auto-farm) mỗi kênh dùng clock chung nhưng rule riêng — xem [save-load.md](./save-load.md).

## Auto-farm (spec 2026-09-04)

State: `player.autoFarmStage: { stageId, lastCheckedMs } | null` — persist.

- **Gate:** `startAutoFarm` chỉ nhận stage đã **Hoàn Mỹ** (`player.perfectClearStageIds`), stage template tồn tại, và `StageManager` slot đang trống — auto-farm **dùng chung single-slot StageManager** với manual/repeat/progress (loại trừ lẫn nhau đồng nhất). `stopAutoFarm` clear state + giải phóng slot.
- **Cycle time:** `perfectClearSeconds[stageId] / 2` — thời gian clear hoàn mỹ chia đôi.
- **Không mô phỏng:** không `TurnBattleSystem`, không animation. Mỗi cycle hoàn thành → `rollAutoFarmCycleReward`: dựng shim "dead enemies" từ `stage.enemyPool` (số lượng = `effectiveTotalEnemyCount(stage)`, spawn qua `enemySystem` + `pickEnemyForTurnSpawn` cho final/boss), rồi tái dùng `BattleLootSystem.processDefeatedEnemies` — bounty/heal-on-kill/talent/drop giống hệt trận thật, channel `'idle'`. `try/finally` restore channel `'active'` để exception không rò state sang trận kế.
- **Online:** `tickAutoFarm` trong fixed-step loop — `floor((now − lastCheckedMs) / cycleMs)` cycle, `lastCheckedMs += completed × cycleMs` (dư thời gian carry, không mất).
- **Offline:** `settleAutoFarmOffline` — đây là **exception duy nhất** cấp combat reward khi offline; elapsed clamp bởi `DEFAULT_MAX_OFFLINE_SECONDS` (24h, dùng chung GameClock, không cap riêng); `cycleSeconds <= 0`/non-finite → no-op an toàn (chặn infinite-loop từ save hỏng). `lastCheckedMs` chỉ advance đúng phần đã settle.

## Liên quan

- [game-loop.md](./game-loop.md) — fixed step, combat clock freeze.
- [drops-loot.md](./drops-loot.md) — channel active/idle.
- [save-load.md](./save-load.md) — offline settlement tổng.
- [enemies-stages.md](./enemies-stages.md) — perfectClear, StageManager slot.
