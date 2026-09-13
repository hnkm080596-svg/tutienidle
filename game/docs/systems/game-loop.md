# Vòng đời game: boot → tick → save → offline

**Trạng thái:** Live.

## Boot

`App.vue` mount → `useAppLifecycle.ts` (`composables/useAppLifecycle.ts`) điều phối toàn bộ vòng đời. Composable này được viết để **idempotent**:

- `bootGame()` gọi 2 lần khi đang pending chỉ chạy 1 lần (`bootInFlight` guard).
- `startTickLoop()`/`startAutosave()` gọi nhiều lần chỉ tạo đúng 1 interval.
- `stopAll()`/unmount gỡ symmetric mọi event-bus handler + DOM listener.

Boot flow (state ở `useBootFlow.ts`): `startSaveLoad` → load cloud save qua `CloudSaveCoordinator.load()` → nếu có save hợp lệ restore (xem [save-load.md](./save-load.md)) → `enterGame` hoặc `requireCharacter`/`showAuth` tùy trạng thái.

Sau restore, offline progress được settle (xem mục Offline bên dưới) và `offlineSummary` store hiện popup tổng kết nếu có.

## Tick loop

Interval mỗi giây (do `useAppLifecycle` sở hữu), mỗi tick gọi `App.vue`'s `tick()`:

1. `gameManager.update(deltaSeconds)` — clock domain (`core/idle/GameClock.ts`) tính `deltaSeconds` từ `lastOnlineAt`.
2. Tu luyện: nếu `player.isCultivating`, cộng `cultivationPerSecond × delta` qua `CultivationSystem.addCultivation()` (capped ở required — không tràn).
3. Cập nhật battle đang chạy (turn engine, xem [combat-overview.md](./combat-overview.md)).
4. Production tick — site nào có cycle active thì check `completesAtMs`.
5. `gameManager.drainNotifications()` → đẩy vào `stores/notification.ts` hiển thị toast.

**Fixed-step trong combat:** engine turn bên trong battle chạy `COMBAT_STEP_SECONDS = 0.1` trên `CombatClock` riêng (xem [combat-overview.md](./combat-overview.md)) — combat không kế thừa cadence của App tick.

## Autosave

`startAutosave()` — interval riêng, gọi `player.save(gameManager)` rồi `CloudSaveCoordinator.save(snapshot)`. `saveInFlight` flag ngăn 2 save chồng nhau.

## Offline progress

Khi boot, `GameClock` tính `elapsedOffline = now − lastOnlineAt`, cap ở `DEFAULT_MAX_OFFLINE_SECONDS`. Các settle:

- **Tu luyện**: cộng `cultivationPerSecond × elapsed` (vẫn capped ở required).
- **Production**: settle từng site theo `ProductionSystem` offline path, cap `PRODUCTION_OFFLINE_CAP_SECONDS` (`core/production/ProductionBalance.ts`).
- **Auto farm**: `GameManager.settleAutoFarmOffline(player, elapsed)` — stage đang farm chạy mô phỏng offline nếu đủ điều kiện (`player.autoFarmStage` tồn tại).
- **Decompose**: chu kỳ phân giải settle theo cùng offline cap.

Kết quả tổng hợp đưa vào `stores/offlineSummary.ts` hiện popup "Kết quả tu luyện ngoại tuyến".

## Notification flow

Domain emit `NotificationEvent` (kind: loot/craft/upgrade/error/warning/save) vào `NotificationQueue` trong `GameManager`. `App.vue` mỗi tick rút ra → `stores/notification.ts` → toast UI. Nguồn toast đã ở Vue layer (upgrade/save…) gọi thẳng `notificationStore`, không đi qua GameManager.

## Liên quan

- [save-load.md](./save-load.md) — snapshot format + restore.
- [cultivation.md](./cultivation.md) — tu vi tích lũy.
- [production.md](./production.md) — production cycle + offline settle.
