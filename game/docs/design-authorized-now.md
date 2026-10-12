# Design Note — Authorized Now cho toàn bộ tick chain (GP-01)

Ngày: 2026-10-12 · Branch: `devin/dot1-authorized-now-design` (tách từ `devin/khai-mach`)
Trạng thái: DESIGN ONLY — chưa đụng production code. Câu trả lời cho "ai own authorized now"
phải chốt trước khi ai code.

## 0. Vấn đề (GP-01 — wall-clock exploit)

Người chơi chỉnh đồng hồ hệ thống là mọi đọc `Date.now()` trong core tin theo giá
trị giả. Hai hướng exploit:

- **Chỉnh TIẾN (+24h):** `tickAutoFarm` thấy `elapsedMs = 24h` → mint trọn một ngày
  farm cycles ngay lập tức (cap `DEFAULT_MAX_OFFLINE_SECONDS` chỉ giới hạn ở 24h —
  tức exploit vẫn ăn trọn cap). Cùng lúc: production worker lanes xong hết, alchemy
  jobs hoàn thành sớm, building accrual trả đầy kho, timed effects hết hạn,
  `dayBucket` nhảy ngày → quota insight + daily quest reset sớm (thêm một ngày
  quota miễn phí), tribulation cooldown hết.
- **Chỉnh LÙI:** mọi anchor persist (`lastCheckedMs`, `lastDailyResetAtMs`,
  `lastCollectedAt`) bỗng nằm ở "tương lai" → các guard `> now` re-anchor về now —
  hướng deny (không mint) nhưng đóng băng feature đến khi giờ thật đuổi kịp.

Điểm mấu chốt: `deltaSeconds` của chính vòng tick cũng sinh từ `Date.now()`
(`GameClock.update(timestamp = Date.now())`, App.vue `tick()` → `clock.update()`).
Kẻ tấn công không cần đụng từng callsite — chỉnh đồng hồ là thắng cả chuỗi.

### Seam ĐÃ CÓ nhưng chỉ nằm trong save/session layer

| Seam | Vị trí | Phạm vi hiện tại |
|---|---|---|
| `monotonicNow` (dep, default `performance.now()`) | `SupabaseCloudSaveService`, `OnlineSessionController` | Health lease 40s, `elapsedMonotonicMs` cho `write_character_save` checkpoint — KHÔNG chạm gameplay |
| `parseRemoteTimeCheckpoint` → `RemoteTimeCheckpoint{checkpointId, anchorAt, leaseExpiresAt, receivedAtMonotonicMs}` | `BackendStatus.ts`, `SupabaseCloudSaveService` | Checkpoint server gửi kèm heartbeat/load/write ACK |
| `serverAuthority{cutoffMs, serverNowMs}` | `CloudSaveService.ts` load result | Server stamps từ `load_game_state` (`serverTimeUtc`, `progressionCutoffAt`) |
| `RestoreTimeAuthority` (`cold-boot`/`live-replacement`) + `restoreAuthorityNowMs` + `sanitizeRestoreAuthority` | `saveTypes.ts` | One-shot context lúc restore — bound cửa sổ offline accrual; KHÔNG phải đồng hồ sống |
| `utcDayBucket(ms)` + `calculateOfflineTime` (pure) | `GameClock.ts` | Convention dùng chung quest daily reset + insight ledger; elapsed offline một nguồn |
| `fieldEpochShiftMs` | `ProductionOffline.ts:184` | Rebase seed-rooted cycle heads về "field epoch" (`Date.now()`) — cơ chế vá lệch epoch |

Kết luận inventory seam: phần khó (server anchor, monotonic, rebase) đều đã tồn
tại — chỉ thiếu MỘT owner đưa chúng vào tick chain.

## 1. Inventory — mọi callsite `Date.now()` trong `src/core` + `src/services` (non-test)

Vai trò:

- **mint** — deadline/payout trực tiếp sản sinh tài nguyên, buff, hoặc quyền thực hiện.
- **quota** — cap xoay theo ngày (day-bucket) hoặc đếm lượt có hạn.
- **elapsed** — đo khoảng thời gian, không persist epoch.
- **epoch** — ghi mốc persist để đọc trừ ngược sau (stamp) hoặc clamp mốc restore.
- **id** — uniquifier (`..._${Date.now().toString(36)}_...`), không phải clock read.
- **transport** — ngoài gameplay (auth token, filename); ghi nhận nhưng ngoài scope GP-01.

Nguồn cần: **A** = authorized-wall (theo contract §2), **M** = monotonic (elapsed thuần),
**—** = không đổi.

### 1.1 Mint — đọc deadline trực tiếp quyết định payout

| Callsite | Cơ chế | Nguồn cần |
|---|---|---|
| `GameManagerTickOps.ts:161` `productionSystem.tickWorkers(Date.now(), ...)` | Worker lanes complete theo `completesAtMs <= nowMs` → vật liệu | A |
| `GameManagerTickOps.ts:205` `alchemySystem.tick(Date.now(), ...)` | Alchemy units due → pill mint | A |
| `GameManagerAutoFarmOps.ts:269` `settleAutoFarmOffline` `const now = Date.now()` | Anchor gap + re-stamp `lastCheckedMs` → idle reward cycles | A |
| `GameManagerAutoFarmOps.ts:341` `tickAutoFarm` `const now = Date.now()` | Cycle floor `(now - lastCheckedMs)/cycleMs` → idle mint mỗi tick | A |
| `GameManagerAutoFarmOps.ts:111` `startAutoFarm` `lastCheckedMs: Date.now()` | Stamp khởi tạo anchor (epoch write, nuôi mint) | A |
| `GameManagerAlchemyOps.ts:201` `startJob(..., Date.now(), ...)` | `completesAtMs = nowMs + batchSeconds` | A |
| `GameManagerAlchemyOps.ts:234` `cancelJob(..., Date.now())` | Deadline quyết định phần refund | A |
| `AlchemySystem.ts:551` `restoreJobs(..., restoreNowMs = Date.now())` | Re-anchor began-pairs lúc restore | A |
| `AlchemySystem.ts:1100` `cancelJob(..., nowMs = Date.now())` | Như trên (domain-level default) | A |
| `AlchemySystem.ts:1372` `settleOffline(..., nowMs = Date.now())` | Offline settle → tick | A |
| `ProductionSystem.ts:129` `restoreStates(..., restoreNowMs = Date.now())` | Re-anchor lane heads lúc restore | A |
| `ProductionSystem.ts:512` `settleOffline(..., nowMs = Date.now())` | Offline settle budget window | A |
| `ProductionOffline.ts:55` `settleProductionOffline(..., nowMs = Date.now())` | Như trên | A |
| `ProductionOffline.ts:184` `fieldEpochShiftMs = Math.max(0, Date.now() - nowMs)` | Rebase về field epoch — xem §4 | A (collapse) |
| `GameManagerBuildingOps.ts:244` `collectBuilding(..., Date.now()/1000)` | Claim accrual (seconds domain) | A |
| `GameManagerBuildingOps.ts:285` `getBuildingStoredAmount(..., Date.now()/1000)` | Preview accrual cho UI | A |
| `GameManagerBuildingOps.ts:328` `isBuildingStorageFull(..., Date.now()/1000)` | Preview | A |
| `GameManagerBuildingOps.ts:347` `getProductionViews(nowMs = Date.now())` | Read-model deadline views | A |
| `SaveSystem.ts:312` `reconcileBuildings(..., Date.now()/1000)` | Grant stamp building mới (epoch write) | A |
| `BuildingManager.ts:43` `restore` `nowSeconds = Date.now()/1000` | Clamp `lastCollectedAt` tương lai | A |
| `GameManagerPersistentEffectOps.ts:279` `getActiveTimedModifiers(now = Date.now())` | Buff liveness → stat grant | A |
| `GameManagerPersistentEffectOps.ts:290` `getActiveRuntimeModifiers(...)` | Như trên | A |
| `GameManagerPersistentEffectOps.ts:317` `expiresCeiling` TLT | Bound khi ghi expiry (epoch) | A |
| `GameManagerPersistentEffectOps.ts:344` `Math.max(Date.now(), expires) + dur` | Ghi expiry (epoch) | A |
| `GameManagerPersistentEffectOps.ts:402` `appliedCeiling = Math.min(2**52-1, Date.now())` | Ghi appliedAt (epoch) | A |
| `GameManagerPersistentEffectOps.ts:416` `tickTimedEffects(now = Date.now())` | Drop expired mỗi tick | A |
| `GameManagerPersistentEffectOps.ts:434` `activateTuLinhTran(now = Date.now())` | Đếm stack active → giá (quota-ish) | A |
| `PillSystem.ts:270` `const now = Date.now()` (regen effect id + stamp) | Buff regen deadline | A |
| `TribulationDirector.ts:670` `cooldownUntil = Date.now() + CD*1000` | Retry gate sau defeat | A |
| `TribulationDirector.ts:802` `getCooldownSeconds(now = Date.now())` | Đọc cooldown cho UI/claim | A |
| `TribulationDirector.ts:843` `restoreRuntime(..., restoreNowMs = Date.now())` | Re-anchor cooldown lúc restore | A |

### 1.2 Quota — day-bucket / per-day cap

| Callsite | Cơ chế | Nguồn cần |
|---|---|---|
| `BattleLootSystem.ts:362` `settleIdleSkillInsightMint(..., Date.now())` | `utcDayBucket` → insight daily ledger | A |
| `QuestSystem.ts:474` `checkAndResetDaily(..., now = Date.now())` | `dayBucket(now) > dayBucket(marker)` → reset | A |
| `QuestManager.ts:147` `restore(state, nowMs = Date.now())` | Clamp `lastDailyResetAtMs` tương lai | A |

### 1.3 Elapsed — đo khoảng thời gian

| Callsite | Cơ chế | Nguồn cần |
|---|---|---|
| `GameClock.ts:164` `update(timestamp = Date.now())` | **NGUỒN deltaSeconds của toàn tick chain** | A |
| `GameClock.ts:117/129` ctor + `start(timestamp = Date.now())` | Anchor clock | A |
| `GameClock.ts:81/217` `calculateOfflineTime(..., timestamp = Date.now())` | Offline elapsed | A (callers truyền) |
| `GameManagerBattleRewardOps.ts:237` `clearSeconds = (Date.now() - startedAtMs)/1000` | → `perfectClearSeconds` = cycle rate của auto-farm (mint-adjacent) | A |
| `GameManagerTurnBattleOps.ts:2596` `turnBattleStartedAtMs = Date.now()` | Cặp stamp của dòng trên | A |
| `stores/player.ts:299` `cultivateTick(this, delta, Date.now())` | `nowMs` đọc TLT percent → cultivation rate | A |
| `AudioManager.ts:546` cue cooldown gap | Chống spam SFX | M (không mint) |
| `AudioManager.ts:805` `applyDuck` | Duck window | M (không mint) |

### 1.4 Epoch — ghi/clamp mốc persist

| Callsite | Cơ chế | Nguồn cần |
|---|---|---|
| `stores/player.ts:360` `this.lastSavedAt = Date.now()` | Marker chính của save | A |
| `Player.ts:514` `createDefaultPlayer` `lastSavedAt: Date.now()` | Marker khởi tạo | A |
| `SaveSystem.ts:352` `buildGameSave` `lastSavedAt: Date.now()` | Marker ghi vào payload | A |
| `stores/player.ts:138,160` `boundTimedEffectClocks` clamps | Bound appliedAt/expires theo field epoch | A |
| `stores/player.ts:421-422` `effectProvenanceMs` clamp | Provenance bound | A |
| `GameManagerSaveRestore.ts:365-366` `restoreClockMs = min(lastSavedAt, Date.now())` | Re-domain bound cho deadline channels | A |
| `GameManagerSaveRestore.ts:379` `questManager.restore(..., Date.now())` | Clamp daily marker | A |
| `GameManagerSaveRestore.ts:420-421,445-447,470-473` | `settleNowMs`/`offlineSinceMs` clamps | A |
| `saveTypes.ts:285` `restoreAuthorityNowMs` fallback `Date.now()` | Legacy local now | A |
| `saveTypes.ts:317,331` `sanitizeRestoreAuthority` deny-anchor `Date.now()` | Zero-accrual anchor | A |
| `useAppLifecycle.ts:546` `{kind:'live-replacement', nowMs: Date.now()}` | Fail-closed boot anchor | A |
| `App.vue:751` `nowMs: serverAuthority?.serverNowMs ?? Date.now()` | Live-replacement resume anchor | A |

### 1.5 Không phải clock read (liệt kê để khỏi migrate nhầm)

| Callsite | Vai trò |
|---|---|
| `AlchemySystem.ts:491` `alchemy_${Date.now().toString(36)}_${jobCounter}` | id uniquifier (counter đã đảm uniqueness) |
| `ProductionCycles.ts:19` `cycle_${siteId}_${Date.now().toString(36)}_${cycleCounter}` | id uniquifier |
| `SaveSystem.ts:737` `exportFilename(..., Date.now())` | filename uniquifier |
| `SupabaseAuthService.ts:162`, `SupabaseSession.ts:247,272` | token `expiresAtMs` bookkeeping — transport, ngoài GP-01 |
| `useAutoRetryCountdown.ts`, `useThienCoEntries.ts` | UI countdown/view — ngoài tick chain |

## 2. Thiết kế — MỘT nguồn thời gian duy nhất

### 2.1 Quyết định đề xuất: `TimeAuthority` mới tại `src/core/idle/TimeAuthority.ts`

**Owner: `TimeAuthority`. GameClock trở thành consumer, không phải authority.**

Đã cân nhắc mở rộng `GameClock` và loại: `GameClock` có `stop()/start()/restore(ts)`
bị pause/resume/reset theo lifecycle (suspend, authority-pause, boot) — semantics
"đồng hồ có thể neo lại tùy ý" mâu thuẫn trực tiếp với một authority phải liên tục,
không-decreasing, chỉ rebase bằng server stamp. Giữ `GameClock` làm máy đo delta
thuần, feed bởi authority — đúng phân lớp hiện có (`RestoreTimeAuthority` cũng là
concept riêng chứ không nhét vào GameClock).

Module singleton bị loại vì phá test isolation (tests tạo `new GameManager()` trần
và Pinia store mới mỗi test); codebase đã theo pattern inject-dep (`sessionRng`
vào `TickOps`, `monotonicNow` vào session/cloud deps).

### 2.2 Contract

```ts
export interface TimeAuthorityDeps {
  /** Wall clock nền — CHỈ đọc lúc anchor, KHÔNG đọc mỗi now(). Test seam. */
  wallNow?: () => number        // default: Date.now
  /** Đồng hồ monotonic đo elapsed. Test seam. */
  monotonicNow?: () => number   // default: performance.now
}

export class TimeAuthority {
  constructor(deps?: TimeAuthorityDeps)

  /** Authorized wall-clock ms epoch. Không bao giờ giảm. */
  now(): number
  /** now()/1000 — cho các field seconds-domain (buildings). */
  nowSeconds(): number
  /** Đồng hồ monotonic thô — elapsed thuần (lease, debounce). */
  monotonic(): number
  /** utcDayBucket(now()) — quota/quest day boundary, MỘT nguồn duy nhất. */
  dayBucket(): number
  /** Neo lại epoch bằng stamp server (authenticated surface only). */
  rebase(serverWallMs: number): void
}
```

Ngữ nghĩa `now()` — "server-anchored khi online, monotonic-rebase khi offline":

- Bên trong giữ `{ anchorWallMs, anchorMonoMs }`; `now() = anchorWallMs + (mono - anchorMono)`,
  kẹp non-decreasing (track `lastNow` — `max(lastNow, computed)`).
- **Không đọc `Date.now()` trên đường nóng.** Chỉnh đồng hồ hệ thống sau khi anchor
  → `now()` không hề nhúc nhích. Exploit GP-01 chết tại gốc, không cần vá từng callsite.
- `rebase(serverWallMs)`: chỉ gọi từ các surface authenticated (xem §4). Anchor mới
  = `max(now(), serverWallMs)` tại monotonic hiện tại → clock chỉ tiến bằng real
  elapsed hoặc nhảy tới server-bound, KHÔNG BAO GIỜ lùi. Lùi sẽ để các stamp đã ghi
  trong session này "future-dated" → freeze deny-direction (đúng bài `r10-INT`
  `lastCheckedMs > now` đã gặp).
- Local/offline mode (không remote authority): anchor = `Date.now()` đúng MỘT lần
  lúc construct — đây là lần đọc wall clock duy nhất còn sót lại trong design.
  Sau đó `now()` chạy thuần monotonic → chỉnh đồng hồ vô lực cả offline.

### 2.3 Inject vào core — theo convention hiện có

1. Composition root (`App.vue`) tạo `const time = new TimeAuthority()` một lần.
2. `new GameManager({ time })` — GameManager ctor nhận optional `deps.time`
   (default `new TimeAuthority()` để `new GameManager()` trần trong tests không vỡ).
   GameManager giữ `readonly time: TimeAuthority` public, truyền vào `deps` của
   mọi Ops class — đúng pattern `sessionRng` đã dùng ở `TickOps`.
3. `tick()` đổi `clock.update()` → `clock.update(time.now())` — nguồn
   `deltaSeconds` của toàn tick chain trở thành authorized (đây là hàng quan trọng
   nhất: delta cũng là mint input).
4. Ops classes: `deps.time.now()` thay `Date.now()`; các domain-level `nowMs`
   param giữ nguyên (test seam có sẵn) — chỉ đổi nơi INJECT giá trị.
5. Pinia `player` store (`cultivate`, `save`, `restoreFromSave`): đọc
   `gameManager.time.now()` — `save(gameManager)` đã nhận GameManager;
   `cultivate(delta)` nhận thêm optional `nowMs` để caller (App.vue `tick()`)
   truyền, giữ signature tương thích test.
6. `useAppLifecycle`/`SaveSystem` free-functions: nhận `now` từ caller đã wire
   (`useAppLifecycle` giữ `time` từ composition root — nó đã nhận `clock` cùng cách).

`RestoreTimeAuthority` GIỮ NGUYÊN — nó là one-shot restore context (bound cửa sổ
accrual), khác lifetime với `TimeAuthority` (đồng hồ sống). Điểm giao duy nhất:
sau cold-boot restore, `time.rebase(untilMs)` để live clock chạy tiếp từ server
bound (xem §4).

### 2.4 Ranh giới rõ ràng (để reviewer không lẫn)

| Concept | Lifetime | Owner hiện tại | Thay đổi? |
|---|---|---|---|
| `TimeAuthority.now()` | Live, liên tục | MỚI | Tick chain chuyển sang đọc nó |
| `TimeAuthority.monotonic()` | Live, elapsed | MỚI | Audio/debounce/lease có thể adopt sau |
| `GameClock` | Live, đo delta | `App.vue` | Chỉ đổi nguồn timestamp input |
| `RestoreTimeAuthority` | One-shot restore | `saveTypes.ts` | Giữ nguyên |
| `monotonicNow` deps (session/cloud) | Transport | đã inject sẵn | Giữ nguyên (có thể reuse `time.monotonic`) |
| CombatClock / Phaser delta | Render cadence | game loop Phaser | KHÔNG đụng — ngoài tick chain |

## 3. Tác động save schema

**Không bump version, không migration.**

- `lastSavedAt` (ms epoch): giữ nguyên domain "mốc wall-clock ms". Dưới authorized
  epoch stamp này honest-by-construction (không ai chỉnh được). Mọi đọc giả
  (`restoreClockMs = min(lastSavedAt, now)`, admission pin `stamps <= lastSavedAt`)
  vẫn đúng vì cùng một epoch.
- `lastDailyResetAtMs` / `idleSkillInsightDaily.dayBucket`: day-bucket là số
  nguyên không-epoch (bucket index), marker ms chỉ bị bucket-hóa khi đọc. Đổi
  nguồn "ngày" từ `Date.now()` sang authorized không đổi shape — worst case là
  reset sớm/muộn ĐÚNG MỘT LẦN bằng đúng độ skew giữa anchor cũ và mới (≈0 tại
  first boot vì anchor khởi tạo = `Date.now()`).
- Các deadline persist (`workerCycles[].startedAtMs/completesAtMs`, `alchemyJobs`,
  `tribulation.cooldownUntil`, `autoFarmStage.lastCheckedMs`,
  `persistentTimedEffects[].expiresAtMs`, `buildings[].lastCollectedAt` seconds):
  toàn bộ nằm "field epoch". Một khi writer+reader cùng đọc `time.now()`, field
  epoch ≡ authority epoch → self-consistent. Hệ quả lớn: **cả họ bug
  "field epoch vs authority epoch" (`r15-COR-E`, `r16-INT-02/04`, `r24-INT-01`,
  `r25-AUT-1`, `r32-AUT-4`) mất nền tảng** — vì không còn hai epoch để lệch. Giữ
  nguyên các clamp/pin làm defense-in-depth; chúng trở thành no-op invariant chứ
  không phải dead code cần xóa vội.

## 4. Rebase / skew — khi server time lệch local

### 4.1 Nguồn anchor được chấp nhận (whitelist, đều authenticated)

| Sự kiện | Stamp | Điểm gọi `rebase` |
|---|---|---|
| Boot cold-boot | `RestoreTimeAuthority.untilMs` (= `serverNowUtc`) | sau `restoreGameSession` trong `useAppLifecycle` |
| Reconnect resume | `serverAuthority.serverNowMs` (onResume 'replaced'/'same') | `App.vue` onResume |
| Write ACK | `serverTimeUtc` response `write_character_save` | save queue success path |
| Heartbeat | `checkpoint.anchorAt` (đã parse sẵn) | `storeCheckpoint` — optional, tham gia sau |

TUYỆT ĐỐI không anchor bằng stamp lấy từ payload save (payload editable — đó là
input của `RestoreTimeAuthority`, không phải authority).

### 4.2 Ma trận skew

| Tình huống | Hành vi authorized-now | Hệ quả |
|---|---|---|
| Server = local (honest) | `now()` ≈ `Date.now()` | parity hoàn toàn |
| Server TRƯỚC local (+skew) | rebase nhảy tới server bound; `now()` chạy nhanh hơn local wall đúng skew | Stamps + `lastSavedAt` cùng epoch → admission pin giữ; exploit không sinh ra vì mọi đọc cùng một đồng hồ |
| Server SAU local (−skew) | `max(now(), server)` giữ anchor hiện tại, clock tiếp bằng real elapsed | Không lùi → không freeze deny-direction |
| Device chỉnh tiến TRƯỚC boot | anchor khởi tạo = wall giả; dưới remote-authority cold-boot `untilMs` rebase về server — nhưng `max()` giữ anchor giả | Residual: `dayBucket` có thể sớm ≤ skew → tối đa 1 quota reset sớm/phiên. Chấp nhận được, ghi rõ; nếu muốn triệt để, remote mode cho `rebase` override không-max (trade-off: stamps trong phiên có thể future-dated) |
| `fieldEpochShiftMs` (`ProductionOffline:184`) | `settleNow ≤ time.now()` cùng epoch → shift ≡ 0 | Cơ chế collapse thành no-op invariant — giữ code làm guard, simplify ở phase cleanup cuối |

### 4.3 Quan hệ với `RestoreTimeAuthority`

Cold-boot vẫn cần `cold-boot{sinceMs,untilMs}` để bound offline accrual (server
duyệt cửa sổ, không phải đồng hồ duyệt). `TimeAuthority` chỉ own "now sống" SAU
khi window đó settle xong: `time.rebase(untilMs)` → `now()` tiếp tục từ
server-approved bound + real elapsed. Hai concept một chuỗi: server duyệt quá
khứ (RestoreTimeAuthority), authority nuôi tương lai (TimeAuthority).

## 5. Kế hoạch migrate (thứ tự an toàn: mint → quota → epoch)

Mỗi batch = 1 PR nhỏ, test riêng, rollback độc lập.

- **B0 — skeleton (no-op):** thêm `TimeAuthority` + wire `GameManager.deps.time` +
  `clock.update(time.now())`. Anchor = `Date.now()`, chưa rebase server →
  **zero behavior change**. Toàn bộ test hiện hữu phải xanh không đổi.
- **B1 — mint (đóng exploit chính):**
  `GameManagerTickOps`(:161,:205) → `GameManagerAutoFarmOps`(:111,:269,:341) →
  `GameManagerAlchemyOps`(:201,:234) + `AlchemySystem` defaults →
  `ProductionSystem`/`ProductionOffline` defaults → `BuildingOps`+`BuildingManager`+
  `SaveSystem.reconcileBuildings` → `GameManagerPersistentEffectOps`(:279-434) →
  `TribulationDirector`(:670,:802,:843) → `PillSystem`(:270) →
  `BattleRewardOps`+`TurnBattleOps` pair(:237,:2596).
- **B2 — quota (ngày):** `BattleLootSystem`(:362 insight gate) →
  `QuestSystem.checkAndResetDaily` → `QuestManager.restore` clamp — đọc
  `time.dayBucket()`/`time.now()`.
- **B3 — epoch (stamp cuối):** `stores/player` (:299,:360,:138,:160,:421) →
  `GameManagerSaveRestore` clamps → `SaveSystem.buildGameSave` stamp →
  `saveTypes` fallbacks (:285,:317,:331) → `useAppLifecycle`/`App.vue` resume
  anchors (:546,:751) → `createDefaultPlayer`(:514).
- **B4 — server rebase feeds:** nối `rebase` vào cold-boot/onResume/write-ACK
  (+heartbeat optional) → khi đó `now()` thực sự server-anchored; B0-B3 đã đóng
  exploit kể cả chưa có rebase (monotonic-driven).
- **B5 — dọn (cuối):** `fieldEpochShiftMs` collapse, `AudioManager` + transport
  `monotonic` adopt, rà soát `Date.now()` còn sót trong non-test core = chỉ
  trong `TimeAuthority` internals.

### Test strategy

Convention: theo probe-test hiện có (`auditR*.probe.test.ts` / `*.qa.test.ts`).

1. **Unit `TimeAuthority`:** non-decreasing invariant; rebase tiến được, lùi bị
   giữ; `nowSeconds()`/`dayBucket()` khớp `utcDayBucket`; anchor `Date.now()`
   đúng một lần (fake `wallNow` đếm số lần gọi).
2. **Probe chỉnh đồng hồ (tiêu đề exploit):** boot game bình thường → fake
   `Date.now()` +24h (wall jump, monotonic giữ nguyên) → `tick()` +
   `settleAutoFarmOffline`/`tickWorkers`/`alchemy tick`/`collectBuilding`/
   `settleIdleSkillInsightMint`/`checkAndResetDaily`/`tickTimedEffects`/
   `getCooldownSeconds` — expect **0 mint ngoài real elapsed**, 0 quota roll,
   0 expiry sớm. Lùi −24h: anchors nguyên, không NaN, không reset refire.
3. **Skew probes:** server ±skew vs device — persisted stamps luôn ≤ next
   `lastSavedAt` (không self-brick ở write admission); honest window trả đủ.
4. **Restore integration:** cold-boot → `rebase(untilMs)` → live tick mint chỉ
   phần sau bound; `live-replacement` → zero-accrual giữ nguyên.
5. **Parity:** toàn bộ suite hiện hữu xanh sau B0 (bắt buộc trước khi B1).

## 6. Câu hỏi cần Minh chốt (trước khi code)

1. Owner: **`TimeAuthority` mới** (đề xuất) hay mở rộng `GameClock`? (§2.1 đã
   phân tích; đề xuất TimeAuthority vì GameClock bị pause/re-anchor theo
   lifecycle.)
2. Rebase `max(now(), server)` (không lùi, residual = 1 quota reset sớm khi
   device chỉnh tiến pre-boot) hay cho phép lùi theo server (triệt hơn nhưng
   stamps trong phiên có thể future-dated = freeze deny)?
3. Inject qua **`GameManager.deps.time` + `gameManager.time` public** (đề xuất,
   theo pattern `sessionRng`) — đồng ý không?
4. `player` store đọc time qua `gameManager` arg (save) + param `nowMs` optional
   (cultivate) — chấp nhận được hay muốn `setTimeAuthority` trên store?
