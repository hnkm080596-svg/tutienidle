# Perf/File-size Optimization Pass — 2026-09-02

> Nguồn: audit 2 agent Explore (file-size + runtime performance) + 1 agent Plan, duyệt bởi user qua ExitPlanMode. Bản đầy đủ (context, audit chi tiết, lý do loại GameManager.ts) ở `C:\Users\hnkm0\.claude\plans\audit-l-i-c-c-file-proud-token.md` — file này là bản chuyển thể task-numbered để `subagent-driven-development` xử lý được.

## Global Constraints

- KHÔNG được sửa `game/src/core/game/GameManager.ts`, `game/src/core/production/ProductionSystem.ts`, `game/src/core/building/BuildingSystem.ts`, `game/src/core/production/WorkerCapacity.ts`, `game/src/services/save/saveVersion.ts`, `game/src/locales/*.json`, `game/src/components/game/HomeBuildingIcons.vue`, `game/src/components/layout/FunctionOverlayPanel.vue`, `game/src/composables/useTribulation.ts` — hai worktree khác (`worktree-task-9-1`, `worktree-chi-hien-quan`) đang sửa các file này đồng thời. Vi phạm = merge conflict chắc chắn.
- Đây là refactor/optimize thuần — KHÔNG đổi hành vi người chơi quan sát được trừ khi task nói rõ (Phase 2/3 chỉ được thay đổi *khi nào* recompute chạy, không đổi *kết quả* recompute).
- Test hiện có phải xanh không cần sửa nội dung test (trừ khi task yêu cầu thêm test mới). Nếu 1 test cần sửa để phản ánh hành vi mới, phải giải thích rõ trong report tại sao.
- Verify theo AGENTS.md: `npm.cmd run type-check` sau mỗi task có đổi TS/Vue; `npm.cmd run test` phạm vi liên quan; `npm.cmd run build` cho task ảnh hưởng production/bundle; KHÔNG dùng `any` trừ khi thật sự cần thiết; KHÔNG thêm dependency mới; KHÔNG sửa file ngoài phạm vi task.
- Baseline: 1 test đã biết fail từ trước (`GameManager.realmAdvanceUnequip.test.ts` — QA-2026-09-02-001, thuộc task-9-1 đang làm ở worktree khác) — KHÔNG sửa, KHÔNG tính là regression do task này gây ra. `deadReferences.test.ts` có timeout 5s flaky quan sát 1 lần (pass lại lần sau) — nếu gặp lại, re-run trước khi báo cáo là fail thật.
- Không commit/push/merge lên nhánh chính — chỉ commit trong worktree này.

## Task 1 — Safety-net tests cho reactivity (Phase 0)

**Mục tiêu:** Viết test khóa hành vi `finalStats` / `enhanceRows` trước khi Task 4 đụng vào `stateVersion`/`externalModifiers`, để nếu Task 4 phá reactivity thì test đỏ ngay.

**File tạo mới:**
- `game/src/stores/player.finalStats.test.ts` (kiểm tra `game/src/stores/player.ts` — đọc field `finalStats` getter và `externalModifiers`).

**Yêu cầu cụ thể:**
1. Test: khi gọi `player.setExternalModifiers([...])` với modifier mới có giá trị khác modifier cũ, `player.finalStats` phải phản ánh giá trị mới (đọc lại sau khi set).
2. Test: gọi `player.setExternalModifiers(...)` hai lần liên tiếp với modifier **giống hệt nội dung** (nhưng có thể khác object reference) — `finalStats` vẫn phải trả kết quả đúng cả hai lần (không được throw, không NaN).
3. Test cho `game/src/components/panels/equipment-hall/EnhanceTab.vue` — đọc file để hiểu cách `enhanceRows` computed hiện lấy dữ liệu (`gameManager.getAllSlotStates()`, `gameManager.equipmentBag.getEquippedInSlot()`, `gameManager.getEnhanceCost()`), viết 1 test (dùng pattern test Vue component sẵn có trong repo, ví dụ tìm test khác cùng thư mục `equipment-hall/` hoặc `panels/` dùng `@vue/test-utils`) xác nhận: khi equipment bag thay đổi (ví dụ trang bị mới được equip vào 1 slot), `enhanceRows` phản ánh đúng slot đó sau lần recompute kế tiếp.

**Không sửa code production trong task này** — chỉ viết test dựa trên hành vi HIỆN TẠI của code (test phải PASS với code hiện tại, đây là safety net cho các task sau, không phải TDD đỏ cho task này).

**Verify:** `npm.cmd run test -- player.finalStats` và test EnhanceTab mới, phải xanh với code hiện tại.

## Task 2 — Batch micro-fix rủi ro thấp (Phase 1, phần 1)

**Mục tiêu:** 3 fix nhỏ, cơ học, không đổi kết quả quan sát được — gộp 1 dispatch vì đều là "giảm work thừa, giữ nguyên output".

**File & thay đổi:**
1. `game/src/composables/useCadenceSmoothing.ts` (hàm `frame()`, dòng ~56-68): sửa để `frame()` KHÔNG gọi `window.requestAnimationFrame(frame)` tiếp khi `displayed.value <= 0 && <tổng cadence hiện tại> <= 0` (đọc kỹ context quanh biến `baseRemaining`/`elapsedSinceSyncMs`/tham số cadence "total" để biết tên biến đúng — mô tả khớp với logic hiện tại, không phải tên biến chính xác). Phải resume lại vòng lặp khi có giá trị mới cần advance (kiểm tra nơi hàm này được gọi lại / trigger lại khi cadence đổi).
2. `game/src/App.vue` — hàm `drainNotifications` liên quan (đọc quanh dòng ~284-286, gọi `gameManager.drainNotifications()`) VÀ `game/src/core/game/NotificationQueue.ts` hàm `drain()` (dòng ~16-22): sửa `drain()` để không tạo mảng rỗng mới (`this.items = []`) khi `this.items.length === 0` — trả về mảng hiện tại (hoặc 1 hằng số mảng rỗng dùng chung) thay vì alloc mới.
3. `game/src/App.vue` (dòng ~66-82, `ui.$subscribe(...)`): thay so sánh `JSON.stringify({ m: state.battleRunMode })` bằng so sánh trực tiếp `state.battleRunMode` với giá trị đã lưu lần trước (biến `lastAutomationSnapshot` hoặc tương đương — đọc code để giữ đúng semantics, chỉ đổi cách so sánh).

**Verify:** test hiện có cho `useCadenceSmoothing` (tìm file test cùng tên nếu có) + `NotificationQueue.test.ts` nếu có + test liên quan `App.vue` nếu có; nếu không có test hiện có bao phủ, viết 1 test nhỏ mới cho mỗi thay đổi (đặc biệt: test rAF tự dừng khi idle cho #1). `npm.cmd run type-check`.

## Task 3 — SaveSystem double-serialize (Phase 1, phần 2 — rủi ro Trung bình, tách riêng)

**Mục tiêu:** Loại bỏ double-serialize trong autosave mà KHÔNG đổi shape dữ liệu lưu ra.

**File:** `game/src/services/save/SaveSystem.ts` (khu vực dòng ~575, ~583 — đọc rộng ra hàm chứa để hiểu full context: `structuredClone(gameManager.questManager.getState())` rồi sau đó `JSON.stringify(save)` cho toàn bộ object save).

**Yêu cầu:**
1. Xác nhận lý do `structuredClone` tồn tại (theo audit: để snapshot an toàn trước khi 1 async write khác có thể mutate `questManager` state live). Nếu đúng, KHÔNG được xóa `structuredClone` một cách ngây thơ — phải đảm bảo snapshot vẫn đúng thời điểm. Cách an toàn nhất: giữ `structuredClone` (rẻ hơn `JSON.stringify` + `JSON.parse` cho việc snapshot), chỉ loại bỏ việc `JSON.stringify` toàn bộ save 2 lần nếu có — đọc kỹ code thực tế trước khi quyết định hướng sửa, vì audit ghi "double serialize" nhưng cần verify chính xác đâu là 2 lần serialize thật (có thể là `structuredClone` (1 lần) + `JSON.stringify` cuối cùng để ghi `localStorage` (bắt buộc phải có, đó là format lưu) — nếu chỉ có 1 `JSON.stringify` thật sự cần thiết ở cuối, thì việc "double" nằm ở chỗ khác, hãy tìm đúng chỗ 2 lần serialize dư thừa hoặc báo cáo lại nếu audit sai).
2. Viết test round-trip: build 1 save, ghi, đọc lại (`loadGame`), so sánh sâu (deep equal) với dữ liệu trước khi lưu — đảm bảo không đổi shape.

**Verify:** test round-trip mới + toàn bộ `game/src/services/save/*.test.ts`; `npm.cmd run type-check`.

## Task 4 — PhaserCanvas bootstrap error handling (Phase 1, phần 3)

**File:** `game/src/components/game/PhaserCanvas.vue`.

**Yêu cầu:** Bọc try/catch quanh khối bootstrap async (`Promise.all([import('phaser'), ...])` rồi `setupGame(...)`). Khi lỗi (import reject hoặc `new Phaser.Game()` throw): dọn dẹp mọi EventBus handler đã đăng ký trước đó (nếu có), set 1 trạng thái lỗi hiển thị được (ví dụ 1 ref `bootError` component có thể dùng để hiện fallback UI đơn giản — nếu component chưa có chỗ hiển thị lỗi, thêm 1 đoạn template tối giản theo đúng style hiện có của component, KHÔNG thiết kế UI mới phức tạp — đây là error boundary tối thiểu, không phải task UI/UX; nếu việc thêm UI vượt quá phạm vi nhỏ, chỉ cần log lỗi + expose 1 ref/emit để component cha xử lý, ghi rõ trong report).

**Verify:** test mới mô phỏng import/`Phaser.Game` throw → xác nhận không có unhandled rejection và cleanup chạy đúng (dùng vi.mock cho `phaser` import nếu cần). `npm.cmd run type-check`.

## Task 5 — stateVersion / externalModifiers dirty-checking (Phase 2 — rủi ro Trung-Cao)

**Phụ thuộc:** Task 1 phải complete trước (dùng test đó làm lưới an toàn).

**File:**
- `game/src/App.vue` (tick handler, `bumpState`, dòng gọi `player.setExternalModifiers(gameManager.getAggregatedModifiers(...))` ~dòng 356-359).
- `game/src/stores/player.ts` (action/method `setExternalModifiers`).
- `game/src/components/panels/equipment-hall/EnhanceTab.vue` (`enhanceRows` computed, dòng ~63-111).

**KHÔNG đụng `GameManager.ts`** — `getAggregatedModifiers()` giữ nguyên signature và hành vi, chỉ xử lý phía caller.

**Yêu cầu:**
1. Trong `stores/player.ts`, sửa `setExternalModifiers` để so sánh nội dung modifier mới với modifier hiện tại (so sánh có ý nghĩa: length + từng entry theo key/value quan trọng — đọc kiểu `Modifier`/tương đương để biết field nào cần so sánh) TRƯỚC khi gán reference mới vào state. Nếu nội dung giống hệt, KHÔNG gán reference mới (giữ nguyên object cũ) để Pinia getter `finalStats` không bị buộc recompute.
2. `EnhanceTab.vue`: `enhanceRows` computed hiện đọc `stateVersion.value` vô điều kiện ở đầu hàm khiến nó recompute mỗi tick kể cả khi tab không hiển thị. Sửa để chỉ recompute khi tab đang active/visible (tìm prop hoặc composable kiểm soát visibility của tab trong component cha, hoặc dùng 1 local visibility flag nếu component tự quản lý tab state — đọc file để xác định đúng cơ chế hiện có).
3. `bumpState()` trong `App.vue`: audit đề xuất 2 hướng — (a) giữ `bumpState()` chạy mỗi tick cho UI cần cập nhật theo thời gian thật (đồng hồ, resource counter) NHƯNG decouple `finalStats`/`externalModifiers` khỏi nó hoàn toàn (đã làm ở bước 1), hoặc (b) thêm dirty-check cho chính `bumpState()`. **Chọn hướng (a)** — an toàn hơn vì `stateVersion` được nhiều nơi khác trong app tiêu thụ và đổi semantics của nó rủi ro cao hơn nhiều so với chỉ chặn reference churn ở `externalModifiers`. Không sửa `bumpState()` bản thân nó trong task này trừ khi bước 1+2 không đủ để giải quyết vấn đề — nếu vậy, dừng lại và ghi rõ trong report tại sao cần mở rộng phạm vi, đừng tự ý mở rộng.

**Verify:** Test Task 1 (`player.finalStats.test.ts`, test EnhanceTab) phải xanh KHÔNG SỬA. Toàn bộ test panel equipment/buff/stat liên quan (`npm.cmd run test -- <pattern liên quan đến player, equipment, buff, stat>`). `npm.cmd run type-check`, `npm.cmd run build`.

## Task 6 — BattleSystem hot-loop GC reduction (Phase 3 — rủi ro Trung bình)

**File:** `game/src/core/battle/BattleSystem.ts` — vùng `snapshotStatuses()` (gọi 2 lần mỗi step để diff cho VFX) và vùng tạo `new BuffSystem(...)` mới cho mỗi enemy mỗi step (~dòng 872-1521 và ~1438-1465 theo audit — XÁC NHẬN LẠI SỐ DÒNG THẬT vì file có thể đã đổi).

**Yêu cầu:**
1. Đọc kỹ vòng đời hiện tại: `BuffSystem` cho player và từng enemy được tạo mới (`new BuffSystem(...)`) mỗi lần `update()` chạy (10Hz khi có trận). Đổi sang: lưu 1 `BuffSystem` instance persistent trên entity (ví dụ field trên `battle.player`/`battleEnemy`), tái sử dụng qua các step, chỉ tạo lại nếu thật sự cần (ví dụ buff list bị thay thế hoàn toàn — kiểm tra logic hiện tại xem `BuffSystem` constructor nhận gì và có mutate list gốc không, để đảm bảo persistent instance vẫn đồng bộ đúng buff state).
2. `snapshotStatuses()` gọi trước VÀ sau update chỉ để diff phát VFX — giữ nguyên MỤC ĐÍCH (VFX vẫn phải bắn đúng khi buff thêm/gỡ) nhưng tránh việc allocate object mới cho mọi buff mọi entity nếu có thể (ví dụ: chỉ snapshot phần cần thiết, hoặc tái dùng buffer). Nếu việc tối ưu sâu hơn rủi ro cao, ít nhất đảm bảo không có allocation thừa ngoài những gì thực sự cần để diff.

**Ràng buộc:** Đây là vòng lặp có nhiều test nhất trong repo (~30 file `BattleSystem.*.test.ts`) — KHÔNG được sửa test hiện có, chúng phải xanh nguyên trạng để chứng minh hành vi giữ nguyên.

**Verify:** toàn bộ `BattleSystem.*.test.ts`; thêm 1 test mới xác nhận buff-wrapper (hoặc cơ chế thay thế) giữ identity ổn định qua nhiều step khi buff không đổi, và VFX vẫn bắn đúng khi buff thêm/gỡ giữa trận. `npm.cmd run test`, `type-check`, `build`.

## Task 7 — Tách BattleSystem.ts thành module (Phase 4, phần 1 — mechanical, sau Task 6)

**File:** `game/src/core/battle/BattleSystem.ts` (đọc lại kích thước/cấu trúc SAU Task 6, vì Task 6 đã sửa vùng liên quan).

**Yêu cầu:** Trước khi tách, kiểm tra xem hazard zone (lava/sword AoE) đã tách hết vào `LavaZone.ts`/`SwordZone.ts` (nếu 2 file này đã tồn tại) hay `BattleSystem.ts` vẫn còn logic inline — chỉ tách phần THẬT SỰ còn inline. Ứng viên tách tiếp theo (đọc code thực tế để xác nhận, không giả định số dòng cũ còn đúng): cast/channel skill state machine, chain-skill advancement, on-hit effect dispatch, `resolveSkillEffects`, enemy AI attack firing — tách theo pattern module sibling-file đã có trong thư mục `game/src/core/battle/` (ví dụ nếu đã có `ChainStateSystem.ts` hay tương tự, theo đúng convention đặt tên/DI đó).

**Nguyên tắc:** refactor thuần túy — không đổi hành vi. Test hiện có phải xanh KHÔNG SỬA, đó là bằng chứng extraction đúng.

**Verify:** toàn bộ `BattleSystem.*.test.ts` không đổi kết quả; `npm.cmd run type-check`; `npm.cmd run build`.

## Task 8 — Tách CombatScene.ts thành module (Phase 4, phần 2 — mechanical)

**File:** `game/src/game/scenes/CombatScene.ts` (2175 dòng, đã tách 6 module trước đó: `combat-damage-text.ts`, `combat-cast-bar.ts`, `combat-grid-view.ts`, `combat-vfx-spawner.ts`, `combat-reward-gourd.ts`, `combat-essence-stream.ts`).

**Yêu cầu:** Đọc code thực tế để xác nhận đúng vị trí (số dòng có thể lệch so với audit cũ): tách "sprite lifecycle + interpolation" (tạo/xóa/định vị/nội suy sprite) và "player visual-profile / body-anchor" logic thành 2 module mới trong `game/src/game/scenes/combat/`, theo đúng pattern đặt tên/cấu trúc của 6 module đã tách trước (constructor nhận `scene`/dependency tường minh, method public để `CombatScene` gọi lại).

**Nguyên tắc:** refactor thuần túy, không đổi hành vi. Test hiện có (`CombatScene.*.test.ts`, gồm cả `CombatScene.eventSubscriptionSymmetry.test.ts` mới thêm) phải xanh KHÔNG SỬA.

**Verify:** toàn bộ `CombatScene.*.test.ts`; `npm.cmd run type-check`; `npm.cmd run build`.

## Task 9 — EquipmentSystem sibling-split (Phase 5 — ưu tiên thấp)

**File:** `game/src/core/equipment/EquipmentSystem.ts` (1670 dòng) và `game/src/core/equipment/EquipmentSystem.test.ts` (2817 dòng).

**Yêu cầu:** Tách wash (roll/preview/commit), refine (roll/preview/commit), dissolve thành file sibling riêng (ví dụ `EquipmentWash.ts`, `EquipmentRefine.ts` — đặt tên theo convention hiện có cạnh `EquipmentOperationCostCatalog.ts`/`EquipmentStatPolicy.ts` nếu có, đọc thư mục để xác nhận convention thật). Tách test tương ứng theo cùng ranh giới (`EquipmentSystem.wash.test.ts`, v.v.) — refactor thuần túy, không đổi assertion nào, chỉ di chuyển.

**Verify:** test equipment liên quan (bao gồm `EquipmentBag.autoDissolve.test.ts` nếu liên quan) không đổi kết quả; `npm.cmd run type-check`; `npm.cmd run build`.

## Task 10 — Bundle/chunk optimization (Phase 6)

**File:** `game/vite.config.ts`; các import tĩnh data-table trong `game/src/App.vue` (dòng ~29-45).

**Yêu cầu:**
1. Thêm `build.rollupOptions.output.manualChunks` vào `vite.config.ts` để tách vendor (Vue/Pinia) và các bảng data tĩnh lớn (materials/skill/enemy/stage/equipment/pill/talisman/buff/formation/alchemy/building/progression/quest) ra khỏi chunk entry chính (~854KB hiện tại).
2. CHỈ chuyển data-table import sang dynamic `import()` nếu xác nhận được bảng đó KHÔNG cần thiết đồng bộ lúc boot (đọc luồng khởi tạo `GameManager`/`App.vue` để xác nhận trước khi đổi — nếu không chắc, chỉ làm bước 1 (`manualChunks`) và bỏ qua việc chuyển dynamic import, ghi rõ trong report lý do bỏ qua).

**Verify:** `npm.cmd run build` — so sánh kích thước chunk trước/sau (ghi số liệu vào report); toàn bộ test liên quan đến data-table consumer; smoke test không cần thiết bằng browser thật cho task này (không có UI thay đổi quan sát được), chỉ cần build + type-check + test pass là đủ bằng chứng.
