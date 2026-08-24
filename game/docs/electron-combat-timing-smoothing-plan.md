# Plan sửa chuyển động và HUD nhịp đánh trong Electron

## 1. Kết luận kỹ thuật

`backgroundThrottling: false` chỉ ngăn Chromium giảm nhịp timer/rAF khi cửa sổ Electron ở nền. Nó không làm game logic chạy ở 60 FPS.

Hiện tại:

- Phaser render gần 60 FPS.
- `App.vue` gọi `GameManager.update()` mỗi 200 ms.
- `GameManager` chia delta thành fixed-step 100 ms và xử lý toàn bộ step trong cùng một callback.
- `BattleSystem` phát nhiều event `positions` đồng bộ trong một outer tick.
- `CombatScene` lập tức tạo lại đoạn nội suy cho từng event, nên event cuối ghi đè event trước bằng một đoạn rất ngắn.
- Vue HUD cũng chỉ nhận snapshot mới mỗi 200 ms, vì vậy vòng nhịp đánh của Trảm thay đổi theo nấc và CSS phải “đuổi theo”.

Không chuyển toàn bộ game loop sang 60 FPS. Giữ simulation độc lập với render và sửa presentation pipeline.

## 2. Mục tiêu

- Gameplay vẫn do `GameClock`, `GameManager` và `BattleSystem` quyết định.
- Phaser có thể render 60/120 FPS mà không làm thay đổi kết quả combat.
- Mỗi render frame chỉ áp dụng snapshot vị trí mới nhất của batch simulation.
- Mob di chuyển đều giữa hai snapshot, không teleport theo nhịp 200 ms.
- Ô Trảm hiển thị **nhịp đánh**, không giả làm `Skill.cooldown`.
- HUD có thể chuyển động mượt giữa các snapshot nhưng phải thường xuyên hiệu chỉnh về runtime thật.
- Pause, stun/freeze, resume, Electron background và delta lớn không làm presentation tự chạy lệch gameplay.

## 3. Nhịp simulation

### Thay đổi đề xuất

- Đổi `TICK_INTERVAL_MS` từ `200` xuống `100`.
- Giữ `BATTLE_FIXED_STEP_SECONDS = 0.1`.
- Không gọi toàn bộ game logic bằng Phaser `update()` hoặc `requestAnimationFrame()`.
- Không thay đổi tốc độ game: `GameClock` vẫn cung cấp delta thời gian thật.

100 ms là mức phù hợp cho simulation idle game và khớp fixed-step combat hiện tại. Trong điều kiện bình thường, một outer tick tương ứng một battle step; khi timer bị trễ, fixed-step vẫn catch up như cũ.

Không dựa riêng vào thay đổi 200 → 100 ms để che lỗi. Coalescing snapshot phía view vẫn bắt buộc vì một outer tick trễ vẫn có thể chứa nhiều fixed-step.

## 4. Coalesce event vị trí trong CombatScene

### Vấn đề hiện tại

`onPositions()` gọi ngay `setInterpolationTarget()` cho mọi event. Khi `GameManager.updateBattleFixedStep()` chạy nhiều step đồng bộ, Phaser nhận nhiều target trong cùng một frame và đoạn nội suy cuối cùng thay thế các đoạn trước.

### Thiết kế mới

`onPositions()` chỉ lưu event mới nhất:

```ts
private pendingPositions?: BattlePositionsEvent

private onPositions(event: BattlePositionsEvent) {
  this.pendingPositions = event
}
```

Trong `CombatScene.update()`:

1. Lấy `pendingPositions` mới nhất.
2. Xóa pending trước khi xử lý.
3. Reconcile sprite đúng một lần.
4. Đặt interpolation target đúng một lần cho mỗi entity.
5. Sau đó render vị trí nội suy như hiện tại.

Tách method để dễ test:

```ts
private applyPendingPositions(): void
private applyPositions(event: BattlePositionsEvent): void
```

`battle_start`, spawn hoặc reset scene cần snapshot ngay có thể dùng một trong hai chế độ rõ ràng:

- `snap`: dùng cho entity mới xuất hiện/reset trận.
- `interpolate`: dùng cho movement thông thường.

Không để cùng một event vừa snap vừa interpolate trong cùng frame.

## 5. Sửa thời lượng nội suy

Không dùng khoảng cách từ `now - existing.segmentStart` sau khi target vừa bị ghi đè nhiều lần.

Lưu thời điểm **snapshot đã được áp dụng gần nhất**:

```ts
interface PositionInterpolation {
  fromX: number
  toX: number
  segmentStart: number
  segmentDuration: number
  lastSnapshotAt: number
}
```

Khi áp snapshot mới:

```ts
const cadenceMs = clamp(now - existing.lastSnapshotAt, 50, 200)
```

- `fromX` là vị trí hình ảnh hiện tại tại `now`.
- `toX` là authoritative position mới nhất.
- `segmentDuration` dùng cadence snapshot vừa đo được.
- `lastSnapshotAt = now`.

Với tick 100 ms, view có tối đa khoảng một simulation-step độ trễ hình ảnh. Không dùng extrapolation ở phase này vì extrapolation có thể khiến sprite vượt qua vị trí dừng, root/freeze hoặc target range.

Khi entity dừng di chuyển, target cuối vẫn phải được áp và interpolation kết thúc chính xác tại authoritative `x`.

## 6. Giảm event thừa từ BattleSystem

Hiện `BattleSystem.update()` phát `positions` trước attack và một lần nữa cuối update. Cần audit mục đích của hai event:

- Snapshot trước attack tồn tại để projectile visual biết vị trí nguồn/đích.
- Snapshot cuối update tồn tại để cập nhật HP và state sau damage.

Không được xóa mù một trong hai nếu projectile spawn đang phụ thuộc thứ tự event.

Ở phase sửa tối thiểu, giữ cả hai event trong core nhưng để `CombatScene` coalesce target movement. Các consumer cần HP tức thời (`CombatStatusBar`, health bar) vẫn có thể nhận event cuối.

Sau khi có test event-order, có thể tách semantic về sau:

```ts
positions_changed
vitals_changed
```

Nhưng không bắt buộc cho bản sửa hiện tại.

## 7. Trảm là nhịp đánh, không phải cooldown kỹ năng

### Authority hiện tại

Trảm (`isBasicAttack`) chạy bằng:

```ts
battle.playerAttackTimer
```

Chu kỳ thật được reset trong `BattleSystem.updatePlayerAttack()` từ attack speed. `Skill.cooldown` của Trảm không tham gia quyết định thời điểm đánh.

Presentation cần đổi tên field để tránh nhầm:

```ts
interface BasicAttackPresentationState {
  kind: 'basic_attack'
  skillId: string
  cadenceRemaining: number
  cadenceTotal: number
  isAdvancing: boolean
}
```

Không tái sử dụng semantic `cooldownRemaining/cooldownTotal` cho basic attack. Active skill loadout vẫn dùng cooldown như hiện tại.

UI có thể dùng chung component vòng phủ, nhưng label/tooltip của Trảm phải là “Nhịp đánh” hoặc “Đòn kế tiếp”.

## 8. Làm HUD mượt mà không đổi gameplay

### Authoritative snapshot

Mỗi lần `stateVersion` thay đổi, composable nhận:

- `cadenceRemaining` thật.
- `cadenceTotal` thật.
- timestamp lúc nhận snapshot.
- `isAdvancing` — false khi pause, countdown, stun/freeze, battle không fighting hoặc không có target hợp lệ.

### Presentation estimate

Dùng một rAF **chỉ cho giá trị hiển thị** của HUD:

```ts
displayRemaining = isAdvancing
  ? Math.max(0, snapshotRemaining - elapsedSinceSnapshot)
  : snapshotRemaining
```

Mỗi snapshot mới phải thay thế anchor và hiệu chỉnh `displayRemaining` về runtime thật. rAF này:

- Không mutate `Battle`, `Skill` hoặc Pinia player state.
- Không phát lệnh cast.
- Không trừ mana.
- Không đặt cooldown.
- Dừng khi component unmount.
- Đóng băng khi `isAdvancing === false`.

Nếu chưa muốn thêm rAF composable, phương án đơn giản hơn là tick Vue 100 ms kết hợp CSS transition 100 ms. Tuy nhiên rAF presentation cho vòng tròn mượt hơn và vẫn an toàn nếu giữ nguyên nguyên tắc resync ở trên.

### Reset đúng lúc đánh

Khi event `attack` của player/Trảm xảy ra:

- Snapshot kế tiếp phải thấy cadence vừa reset.
- HUD bắt đầu vòng mới từ `cadenceTotal`.
- Không chờ một timer UI tự đoán thời điểm đòn đánh.

Nếu cần phản hồi tức thì, composable có thể subscribe event `attack` để yêu cầu refresh/bump presentation, nhưng vẫn đọc lại `playerAttackTimer` thay vì tự reset bằng hằng số.

## 9. Sửa công thức attack speed

Hiện cả player và enemy dùng:

```ts
1 / Math.max(1, attackSpeed)
```

Công thức này khiến mọi giá trị attack speed dưới `1` vẫn đánh một lần/giây, làm debuff slow không có tác dụng ở baseline.

Tạo helper dùng chung:

```ts
const MIN_ATTACKS_PER_SECOND = 0.05

export function getAttackIntervalSeconds(attackSpeed: number): number {
  return 1 / Math.max(MIN_ATTACKS_PER_SECOND, attackSpeed)
}
```

Dùng helper tại:

- Reset `playerAttackTimer`.
- Reset enemy `attackTimer`.
- `buildBasicAttackPresentation()`.
- Tooltip/stat presentation liên quan.

Không để core và HUD tự lặp lại công thức.

## 10. Pause và lifecycle Electron

- `backgroundThrottling: false` tiếp tục giữ nguyên.
- `powerMonitor` suspend/resume tiếp tục chỉ xử lý lifecycle; không dùng làm nguồn animation.
- Khi `ui.isPaused`, simulation delta bằng 0 và HUD `isAdvancing` phải false.
- Khi resume, HUD anchor timestamp phải reset trước khi rAF tiếp tục để không trừ cả thời gian pause.
- Khi cửa sổ minimize nhưng game không pause, Electron có thể tiếp tục simulation; HUD khi render lại phải resync từ state hiện tại, không replay animation cũ.

## 11. Test bắt buộc

### Core timing

- Attack speed `1` tạo interval `1 giây`.
- Attack speed `2` tạo interval `0.5 giây`.
- Attack speed `0.7` tạo interval lớn hơn `1 giây`.
- Attack speed bằng 0 hoặc âm được clamp an toàn.
- Player và enemy dùng cùng helper.
- Với cùng tổng delta, nhiều step nhỏ và một outer delta catch-up tạo cùng số đòn trong giới hạn thiết kế.

### Basic attack presentation

- HUD đọc `playerAttackTimer`, không đọc `Skill.cooldown`.
- `cadenceTotal` dùng cùng helper với BattleSystem.
- Sau event đánh, cadence reset đúng chu kỳ hiện tại.
- Pause/stun/freeze làm `isAdvancing = false`.
- Snapshot mới hiệu chỉnh presentation estimate, không tích sai số qua nhiều chu kỳ.

### Position smoothing

- Nhiều `positions` event đồng bộ trước một Phaser frame chỉ áp target cuối cùng một lần.
- `reconcileEnemySprites()` chỉ chạy một lần cho batch.
- Snapshot kế tiếp dùng cadence hợp lý, không rơi về đoạn 16 ms do event đồng bộ.
- Entity mới snap đúng vị trí spawn.
- Entity đang di chuyển không teleport.
- Entity dừng/root/freeze kết thúc đúng authoritative target, không overshoot.
- Death/removal không bị pending snapshot tạo lại sprite đã chết.

### Verification tổng

Chạy:

```text
npm.cmd test -- --run
npm.cmd run type-check
npm.cmd run build
```

Sau đó kiểm tra thủ công trong Electron dev:

1. Mob thường đi từ spawn vào tầm đánh.
2. Mob tốc độ thấp và cao.
3. Root/freeze khi mob đang đi.
4. Trảm ở attack speed 0.7, 1, 2 và có buff/debuff giữa trận.
5. Pause/resume giữa một chu kỳ Trảm.
6. Minimize 5–10 giây rồi restore.
7. Một callback bị trễ/catch-up nhưng mob không giật thành nhiều bước trong một frame.

## 12. Thứ tự triển khai cho Claude

1. Viết helper `getAttackIntervalSeconds()` và test, thay toàn bộ công thức lặp.
2. Đổi tick ngoài từ 200 ms xuống 100 ms, giữ fixed-step 0.1 giây.
3. Coalesce `positions` trong `CombatScene` và test batch target.
4. Sửa interpolation cadence theo thời điểm snapshot được áp dụng.
5. Tách `BasicAttackPresentationState` khỏi cooldown active skill.
6. Thêm presentation rAF/resync cho vòng nhịp Trảm.
7. Bổ sung pause/stun/freeze/lifecycle guards.
8. Chạy toàn bộ verification và test thủ công Electron.

## 13. Không làm trong bản sửa này

- Không chuyển `GameManager.update()` sang 60 FPS.
- Không để Phaser quyết định hit, attack hoặc cooldown.
- Không dùng tween completion để phát đòn đánh.
- Không thay đổi damage balance của Trảm.
- Không viết lại toàn bộ EventBus hoặc BattleSystem.
- Không xử lý giật bằng cách tắt nội suy và snap thẳng vị trí.
