# Stage Auto-Farm ("Hoàn Mỹ") — Design Spec

Date: 2026-09-04
Status: Approved (design)

## 1. Motivation

Ban đầu người dùng đề xuất mang lại battle-speed-toggle (x1/x2/x4) cho
turn-based combat. Sau brainstorm, ý này bị huỷ hoàn toàn và thay bằng
một cơ chế khác: khi người chơi đủ mạnh để hoàn thành 1 stage ở mức
**"Hoàn Mỹ"** (điều kiện nhị phân, không phải thang sao 1-2-3), stage
đó mở khoá 1 chế độ auto-farm tốc độ gấp đôi, không hoạt ảnh — giải
quyết bài toán "người chơi đã outlevel 1 stage từ lâu, không cần xem
lại trận đấu mỗi lần farm nguyên liệu".

Đây là **cơ chế auto thứ 3**, bổ sung bên cạnh 2 cơ chế auto đã có từ
trước rework turn-based (không đổi):

1. **Auto vượt ải** (`progress` mode) — tự leo lên ải cao nhất phù hợp
   sức mạnh.
2. **Auto repeat** (`repeat` mode) — lặp lại 1 stage thật (chạy trận
   thật, có thể thua), dành cho người CHƯA đạt Hoàn Mỹ nhưng vẫn thắng
   được, cần farm nguyên liệu.
3. **Auto-farm Hoàn Mỹ** (`perfect_farm` mode, MỚI — phạm vi spec này)
   — chỉ mở khoá khi stage đã Hoàn Mỹ, mỗi chu kỳ tốn 1/2 thời gian
   Hoàn Mỹ lần đầu, không chạy trận thật, không hoạt ảnh.

## 2. Khảo sát hiện trạng (2026-09-04)

- `StageManager` (`game/src/core/stage/StageManager.ts:20-53`) chỉ hỗ
  trợ **1 active stage tại 1 thời điểm** ("Chỉ 1 slot đang chạy tại 1
  thời điểm" — cùng cardinality với `Battle`).
- `ui.battleRunMode: 'manual' | 'repeat' | 'progress'`
  (`stores/ui.ts:78`), chọn qua 3 chip ở `StageSelectPanel.vue:284-292`.
- **Auto repeat**: `GameManager.startStage()` (`GameManager.ts:2808-2820`)
  nhận `repeatContinuously`, lưu vào `turnBattleRepeatContinuously`;
  khi `turnBattle.state === 'victory'`, tự gọi
  `restartTurnBattleCycle()` (`GameManager.ts:2424`, dùng tại
  `GameManager.ts:3077-3085`) ngay trong cùng tick.
- **Auto vượt ải**: sống hoàn toàn ở `CombatVictoryPanel.vue:56-102`,
  gọi `resolveNextProgressStage()` (`ProgressStageResolver.ts:12-33`,
  chỉ đọc `completedStageIds`/`isStageUnlocked`) rồi `startBattle()`
  lại — không biết gì về battle tick model.
- **Slice 6 cutover đã xong thật** (không phải đang chờ) —
  `GameManager.ts:3051-3053`'s comment xác nhận `TurnBattle` là engine
  combat duy nhất, real-time `BattleSystem.update()` không còn chạy.
- **Không có khái niệm rating/star nào tồn tại** ở combat/stage hiện
  tại — hoàn toàn mới.
- **Completion tracking hiện tại phẳng**: `PlayerData.completedStageIds: string[]`
  (`game/src/core/player/Player.ts:200`) — không có object state riêng
  theo từng stage.
- **Offline/catch-up pattern tái dùng được** (`ProductionSystem`):
  `GameClock.calculateOfflineTime(state, timestamp, maxOfflineSeconds)`
  (`game/src/core/idle/GameClock.ts:57-77`) tính elapsed real-seconds
  từ `GameClockState.lastOnlineAt`; `ProductionSystem.settleWorkersOffline`
  (`ProductionSystem.ts:478-520+`) chain cycle liên tiếp trong khoảng
  offline, reroll reward mỗi cycle bằng seed mới, cap bởi
  `PRODUCTION_OFFLINE_CAP_SECONDS` (`ProductionBalance.ts:115`).
- **Combat vốn hoàn toàn ephemeral khi offline**: không field battle
  nào trong `GameManagerSaveRestoreDeps`; `StageManager`/`StageWaveSystem`
  dùng `deltaSeconds` (không phải `Date.now()`) — nghĩa là `manual`/
  `repeat`/`progress` vốn KHÔNG BAO GIỜ chạy khi app đóng, chỉ chạy khi
  tick loop thật đang chạy (app mở). Đây là hành vi hiện tại, spec này
  không đổi gì — chỉ đảm bảo auto-farm mới không vô tình phá vỡ nó.

## 3. Quyết định

### 3.1 Terminology: "Hoàn Mỹ" thay cho "3-sao"

Không dùng thang điểm sao (1/2/3 sao) vì game không có khái niệm "1
sao"/"2 sao" nào — chỉ có 1 điều kiện nhị phân: **đạt Hoàn Mỹ hay
không**. Toàn bộ field/tên biến dùng "perfectClear..." thay vì
"star"/"stars".

### 3.2 Điều kiện Hoàn Mỹ

Đúng 2 điều kiện, cả hai đều phải đạt:

- Tổng HP đội mất không quá 75% (`teamHpLossPercent <= 75`) — tính từ
  lúc bắt đầu stage đến lúc thắng.
- Số turn hoàn thành < `stage.perfectClearTurnLimit` — field content
  mới trên `Stage` (`game/src/core/stage/Stage.ts`), tự định theo từng
  stage (giống cách các thông số balance khác trong game được set thủ
  công theo nội dung).

Không có điều kiện thứ 3.

### 3.3 Data model mới trên `PlayerData`

```ts
perfectClearStageIds: string[]          // ghi 1 lần khi đạt Hoàn Mỹ lần đầu
perfectClearSeconds: Record<string, number>  // wall-clock giây của lần đạt đó — KHÔNG cập nhật lại sau
autoFarmStage: { stageId: string; lastCheckedMs: number } | null
```

`perfectClearSeconds[stageId]` chỉ ghi một lần (lần đầu tiên đạt Hoàn
Mỹ) — nếu người chơi clear nhanh/chậm hơn ở các lần sau, giá trị không
đổi. Giữ đơn giản, tránh phức tạp không cần thiết (YAGNI).

### 3.4 Nơi tính điều kiện Hoàn Mỹ

Hook vào `StageWaveSystem.ts:120-127` — đúng chỗ `completedStageIds.push`
hiện tại khi thắng (`aliveCount === 0`, trước khi set `battle.state =
'victory'`). Cần thêm:

- Tracking `teamHpLossPercent`: tổng HP mất / tổng maxHP đội, đo từ
  lúc `StageWaveSystem.start()` gọi đến lúc thắng — cần snapshot
  maxHP lúc bắt đầu (`activeStagePlayer`/`playerStats` đã có sẵn trong
  scope của `start()`/`update()`).
- Tracking số turn: dùng `TurnBattle`'s bộ đếm turn hiện có (turn-based
  combat vốn đã đếm turn cho Sudden Death — mục 6 roadmap — tái dùng
  cùng nguồn, không đếm lại từ đầu).
- Nếu cả 2 điều kiện đạt VÀ `stageId` chưa có trong
  `perfectClearStageIds`: push vào `perfectClearStageIds`, ghi
  `perfectClearSeconds[stageId] = wallClockElapsedSeconds` (đo từ
  `Date.now()` lúc `start()` đến lúc thắng — đây là điểm DUY NHẤT
  trong toàn bộ combat cần đọc `Date.now()`, mọi nơi khác vẫn dùng
  `deltaSeconds` như hiện tại).

### 3.5 Cơ chế Auto-farm

Bật auto-farm (chip `perfect_farm` mới, chỉ enable khi
`perfectClearStageIds.includes(selectedStage.id)`):

- Gán `PlayerData.autoFarmStage = { stageId, lastCheckedMs: Date.now() }`.
- `cycleSeconds = perfectClearSeconds[stageId] / 2`.
- **Không gọi `StageWaveSystem.start()`/`TurnBattleSystem` — không có
  trận thật, không có hoạt ảnh.** Đây là khác biệt cốt lõi so với
  `repeat` mode (vẫn chạy trận thật, có thể thua).
- Mỗi khi đủ 1 `cycleSeconds` trôi qua (đo bằng elapsed real-time,
  online), roll thẳng 1 lần reward qua `BattleLootSystem`'s cơ chế
  drop hiện có cho stage đó (tương đương 1 lần thắng bình thường,
  không cần mô phỏng trận đấu).

### 3.6 Offline/catch-up — CHỈ auto-farm được nhận reward offline

Đây là ràng buộc quan trọng nhất của spec này: **`manual`/`repeat`/
`progress` không được và không thể nhận reward khi offline** (giữ
nguyên hành vi hiện tại — combat ephemeral, tick loop chỉ chạy khi app
mở). **Auto-farm Hoàn Mỹ là ngoại lệ DUY NHẤT** trong toàn bộ combat
được phép tính reward cho khoảng thời gian offline, theo đúng pattern
`ProductionSystem.settleWorkersOffline`:

- Lúc app khởi động lại, nếu `PlayerData.autoFarmStage !== null`: dùng
  `GameClock.calculateOfflineTime` để lấy elapsed real-seconds từ
  `autoFarmStage.lastCheckedMs` đến hiện tại.
- Chia nguyên elapsed cho `cycleSeconds` để tính số chu kỳ hoàn thành,
  roll reward từng chu kỳ (fresh seed mỗi lần, giống
  `ProductionCycle.rollSeed`).
- Cap bởi cùng hằng số `PRODUCTION_OFFLINE_CAP_SECONDS`
  (`ProductionBalance.ts:115`) — không cần hằng số riêng.
- Cập nhật `autoFarmStage.lastCheckedMs` sau khi settle.
- Khi app đang mở (foreground), auto-farm vẫn tiếp tục tick theo cùng
  cơ chế elapsed-real-seconds (không phải `deltaSeconds` như
  `manual`/`repeat`/`progress`) — nhất quán, không cần 2 code path
  khác nhau cho online/offline của riêng auto-farm.

### 3.7 Độc quyền slot

Chỉ 1 stage auto-farm tại 1 thời điểm — khớp `StageManager` vốn đã chỉ
hỗ trợ 1 active stage. Bật auto-farm cho stage A chặn việc bắt đầu
`manual`/`repeat`/`progress` ở stage B cho đến khi tắt auto-farm A
trước. Không xây cơ chế "nhiều slot farm song song" kiểu
`ProductionSystem` — YAGNI, giữ đúng cardinality hiện có của combat.

### 3.8 UI

- Thêm giá trị mới vào `BattleRunMode`
  (`game/src/stores/ui.ts:78`): `'manual' | 'repeat' | 'progress' | 'perfect_farm'`.
- `uiFlagsPersistence.ts`'s `BATTLE_RUN_MODES` cần thêm `'perfect_farm'`.
- Chip thứ 4 ở `StageSelectPanel.vue:284-292`, cạnh 3 chip hiện có —
  chỉ enable khi `selectedStage` đã có trong `perfectClearStageIds`.

## 4. Ngoài phạm vi

- UI hiển thị trạng thái Hoàn Mỹ cụ thể trên stage map (badge/icon) —
  UI polish riêng, làm khi tới lượt implement UI thật.
- Balance `perfectClearTurnLimit` cho từng stage — content work, làm
  sau khi cơ chế mechanism chạy được (theo đúng pattern các mục khác
  trong roadmap — mechanism trước, content sau).
- Việc auto-farm có tự tắt khi nào đó hay không (không có khái niệm
  "thua" vì roll-thẳng luôn thành công) — không áp dụng.
- Đổi `manual`/`repeat`/`progress` sang cho phép offline — **rõ ràng
  KHÔNG làm**, đây là ràng buộc cố ý (§3.6), không phải thiếu sót.

## 5. Rủi ro / lưu ý cho plan

- Đo `teamHpLossPercent` cần snapshot maxHP đội lúc bắt đầu stage —
  cần đọc code `StageWaveSystem.start()`/`TurnBattleSystem` thật (chưa
  đọc chi tiết trong spec này) trước khi viết task cụ thể, không đoán
  tên field.
- `Date.now()` chỉ xuất hiện ở đúng 2 chỗ mới: lúc ghi
  `perfectClearSeconds` và lúc track `autoFarmStage.lastCheckedMs` —
  plan cần chỉ rõ KHÔNG lan `Date.now()` ra chỗ khác trong combat
  (giữ nguyên tinh thần `deltaSeconds`-driven cho phần còn lại).
- Save-version bump cần thiết (3 field mới trên `PlayerData`) — theo
  quy ước hiện có (`game/src/services/save/saveVersion.ts`, tăng
  const + changelog comment, không viết migration).
