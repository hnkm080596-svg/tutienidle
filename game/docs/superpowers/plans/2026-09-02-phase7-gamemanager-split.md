# Phase 7 — GameManager.ts domain extraction + deferred remainders

> Nguồn: `roadmap.md` §4 ("Phase 7 (LATER)... chỉ bắt đầu sau khi worktree-task-9-1 và worktree-chi-hien-quan đã merge") — cả 2 đã merge vào master (`831f7c8`, `84d28bb`). Đồng thời gộp 2 phần deferred từ đợt trước: Task 7 (BattleSystem.ts: resolveSkillEffects/cast-channel FSM/hazard zones chưa tách) và Task 9 (EquipmentSystem.ts: wash/refine chưa tách) của `2026-09-02-perf-optimize-pass.md`.
> Toàn bộ là refactor thuần — KHÔNG đổi hành vi quan sát được, trừ khi task nói rõ khác.

## Global Constraints

- KHÔNG dùng `any` trừ khi thật sự cần thiết; không thêm dependency mới; không đổi architecture ngoài phạm vi task; không sửa file ngoài phạm vi task; ưu tiên sửa code hiện tại thay vì viết lại.
- Đây là refactor/mechanical-split thuần túy — test hiện có phải xanh KHÔNG SỬA (trừ khi 1 test thật sự cần di chuyển sang file mới, nội dung giữ nguyên y hệt — không đổi assertion).
- Verify theo AGENTS.md: `npm.cmd run type-check` sau mỗi task có đổi TS; `npm.cmd run test` phạm vi liên quan; `npm.cmd run build` cho task ảnh hưởng production.
- Escape hatch (giống đợt perf-optimize-pass trước): nếu 1 phần của brief quá đan xen/rủi ro để tách an toàn trong 1 lượt, được phép tách 1 phần nhỏ hơn đã verify kỹ + báo cáo rõ phần còn lại và lý do, thay vì ép 1 diff lớn rủi ro.
- `GameManager.ts` hiện 3405 dòng — đây là file rủi ro cao nhất trong project (facade lớn nhất). Method `update()` (section TICK, cuối file) là orchestrator chính — KHÔNG tách, chỉ delegate.
- KHÔNG động vào section MODIFIER AGGREGATION / RUNTIME MODIFIER AUTHORITY (`getAggregatedModifiers()` và các method liên quan) — đây là surface đã được `stores/player.ts`'s `setExternalModifiers` dirty-check dựa vào ở đợt perf-optimize-pass trước (xem `game/src/stores/player.ts`); đổi behavior hoặc signature ở đây có thể phá memoization đó một cách âm thầm. Chỉ đọc để hiểu, không sửa.

## Task 1 — Extract EquipmentOps từ GameManager.ts

**Mục tiêu:** Tách toàn bộ method thuộc section `// EQUIPMENT` (hiện ~dòng 1746-2134, ~388 dòng — SỐ DÒNG CÓ THỂ LỆCH, đọc file thật) thành 1 module riêng.

**Yêu cầu:**
1. Đọc toàn bộ section EQUIPMENT trong `GameManager.ts` trước — liệt kê method (equip/unequip, enhance, wash, refine, dissolve wrapper, obtain/roll, breakthrough-unequip-guard mới từ task-9-1...).
2. Tạo `game/src/core/game/GameManagerEquipmentOps.ts` (hoặc tên phù hợp theo convention sẵn có — kiểm tra `TribulationSystem.ts`/`StageWaveSystem.ts` đã tách trước đó để theo đúng pattern DI: constructor nhận dependency tường minh — `equipmentSystem`, `equipmentBag`, event bus, v.v. — không tự ý `import GameManager` ngược).
3. `GameManager` giữ các method public cũ làm thin delegate gọi vào module mới (giữ nguyên public API — mọi call site ngoài GameManager.ts KHÔNG được đổi).
4. Nếu phát hiện phần nào đan xen quá sâu với state khác của GameManager (ví dụ cần gọi chéo sang building/production), dùng escape hatch — tách phần an toàn, báo cáo phần còn lại.

**Verify:** toàn bộ `GameManager.*.test.ts` liên quan equipment (`EquipmentSystem.test.ts` không nằm trong GameManager, giữ nguyên) phải xanh KHÔNG SỬA; `npm.cmd run type-check`, `npm.cmd run build`.

## Task 2 — Extract BuildingOps + ProductionOps từ GameManager.ts

**Mục tiêu:** Section `// BUILDING` (~2241-2466, ~225 dòng) và `// PRODUCTION` (~2467-2509, ~42 dòng) — gộp 1 task vì Production nhỏ và liền kề, có khả năng share state (worker capacity — chú ý: đây là logic mới từ chi-hien-quan merge, đọc kỹ trước khi tách).

**Yêu cầu:**
1. Đọc cả 2 section, xác nhận ranh giới thật (số dòng có thể lệch).
2. Tạo `game/src/core/game/GameManagerBuildingOps.ts` — DI pattern giống Task 1.
3. Đặc biệt cẩn thận với logic worker capacity (`1 + cấp×2`, merge gần đây từ chi-hien-quan) — đọc kỹ trước khi di chuyển, đảm bảo không đổi công thức/thứ tự tính toán.
4. Escape hatch áp dụng nếu cần.

**Verify:** test building/production liên quan trong `GameManager.*.test.ts` (bao gồm `GameManager.workerCapacity.test.ts` nếu có) xanh KHÔNG SỬA; `type-check`, `build`.

## Task 3 — Extract AlchemyOps từ GameManager.ts

**Mục tiêu:** Section `// ALCHEMY` (~2510-2629, ~119 dòng).

**Yêu cầu:** Tương tự Task 1/2 — đọc, tách vào `game/src/core/game/GameManagerAlchemyOps.ts`, giữ public API, DI pattern nhất quán.

**Verify:** test alchemy trong `GameManager.*.test.ts` xanh KHÔNG SỬA; `type-check`, `build`.

## Task 4 — Extract QuestOps từ GameManager.ts

**Mục tiêu:** Section `// QUEST` (~2752-3001, ~249 dòng).

**Yêu cầu:** Tương tự — `game/src/core/game/GameManagerQuestOps.ts`.

**Verify:** test quest trong `GameManager.*.test.ts` xanh KHÔNG SỬA; `type-check`, `build`.

## Task 5 — Extract SaveRestore từ GameManager.ts

**Mục tiêu:** Section `// SAVE / LOAD` (~3021-3221, ~200 dòng) — LƯU Ý: đây là phần nhạy cảm nhất (liên quan restore save, đã có `saveShapeValidation.ts`/`SaveSystem.ts` riêng — không nhầm với chúng, đây là phần restore VÀO GameManager instance cụ thể).

**Yêu cầu:**
1. Đọc kỹ toàn bộ section trước khi tách — xác nhận đây thực sự là restore-into-GameManager logic (không phải serialize, đã ở `SaveSystem.ts`).
2. Tách vào `game/src/core/game/GameManagerSaveRestore.ts`.
3. Rủi ro cao hơn các task khác — nếu đan xen quá sâu (restore thường phải touch rất nhiều subsystem), escape hatch được ưu tiên dùng ở task này hơn các task khác.

**Verify:** TOÀN BỘ test có chữ "restore"/"save" trong `GameManager.*.test.ts` phải xanh KHÔNG SỬA (đây là nơi test phủ dày nhất, tận dụng làm lưới an toàn); `type-check`, `build`.

## Task 6 — BattleSystem.ts: tách cast/channel FSM + resolveSkillEffects (deferred từ đợt trước)

**Bối cảnh:** Task 7 của `2026-09-02-perf-optimize-pass.md` đã tách `EnemyAttackSystem` nhưng deliberately để lại `resolveSkillEffects`/`resolvePlayerSkillEffects` (14+ collaborator deps) và cast/channel FSM (10+ collaborators, mutate private BattleSystem field) vì rủi ro cao trong 1 lượt nhỏ. Giờ làm riêng, tập trung.

**File:** `game/src/core/battle/BattleSystem.ts` (đọc lại state hiện tại — đã qua Task 6/7 đợt trước, cache BuffSystem + EnemyAttackSystem extraction).

**Yêu cầu:**
1. Đọc kỹ `resolveSkillEffects`/`resolvePlayerSkillEffects` và cast/channel FSM (cast_start/cast_complete/channel begin/update/finish/interrupt) — liệt kê chính xác dependency (private field nào bị đọc/ghi).
2. Nếu DI surface thực sự lớn (10-14+), CÓ THỂ tách theo cách khác an toàn hơn: ví dụ pass `this` (BattleSystem instance) làm 1 tham số duy nhất thay vì liệt kê 14 dependency riêng — miễn là module mới KHÔNG import ngược `BattleSystem` type gây circular import thật sự (kiểm tra bằng `npm.cmd run build`). Ưu tiên an toàn hành vi hơn thuần khiết kiến trúc.
3. Escape hatch: nếu cả 2 (cast/channel FSM VÀ resolveSkillEffects) đều quá rủi ro để tách trong 1 lượt, chỉ tách 1 trong 2 (ưu tiên cái ít collaborator hơn), báo cáo phần còn lại.

**Ràng buộc:** TOÀN BỘ ~29-30 file `BattleSystem.*.test.ts` phải xanh KHÔNG SỬA — đây là lưới an toàn duy nhất cho hot loop quan trọng nhất codebase.

**Verify:** `npm.cmd run test -- BattleSystem` toàn bộ pass; `type-check`, `build`.

## Task 7 — BattleSystem.ts: tách hazard zone logic còn lại (deferred từ đợt trước)

**File:** `game/src/core/battle/BattleSystem.ts` (chạy SAU Task 6 vì cùng file).

**Yêu cầu:**
1. Kiểm tra `LavaZone.ts`/`SwordZone.ts` (nếu tồn tại) đã cover hết logic hazard zone chưa — nếu `BattleSystem.ts` vẫn còn spawn/tick/damage logic inline cho lava/sword AoE, tách phần đó.
2. Nếu đã tách hết từ trước (giống phát hiện của Task 7 đợt trước với ChainStateSystem/KiemTranOnHitSystem), báo cáo "không còn gì để tách" — đó là kết quả hợp lệ.

**Verify:** toàn bộ `BattleSystem.*.test.ts` xanh KHÔNG SỬA; `type-check`, `build`.

## Task 8 — EquipmentSystem.ts: tách wash/refine (deferred từ đợt trước)

**Bối cảnh:** Task 9 đợt trước chỉ tách `dissolveInstances` (đã xong, `EquipmentDissolve.ts`), để lại wash/refine vì share roll-affix primitives với `createInstance` + `pendingRefinePreview`/`modifierSystem` (34 reference còn lại, verified).

**File:** `game/src/core/equipment/EquipmentSystem.ts` (hiện ~1622 dòng sau Task 9 đợt trước) và `EquipmentSystem.test.ts` (~2706 dòng).

**Yêu cầu:**
1. Đọc kỹ wash và refine — xác nhận chính xác cái gì share với `createInstance` (roll-affix primitives) và cái gì thực sự tách được.
2. Nếu roll-affix primitives cần dùng chung, tách chúng thành helper riêng trước (ví dụ `EquipmentRollPrimitives.ts`) rồi cả `createInstance`, wash, refine đều import từ đó — thay vì ép wash/refine tách nguyên khối kèm theo bản sao logic roll.
3. Escape hatch: nếu chỉ 1 trong 2 (wash HOẶC refine) tách an toàn được, làm 1 cái, báo cáo cái còn lại.

**Verify:** test equipment liên quan (wash/refine/createInstance) xanh KHÔNG SỬA (hoặc di chuyển y nguyên); `type-check`, `build`.

## Thứ tự thực thi

Tuần tự Task 1 → 8 (Task 6/7 cùng file BattleSystem.ts nên phải liền nhau; Task 1-5 đều trong GameManager.ts nên cũng phải tuần tự dù về lý thuyết độc lập theo domain — tránh 2 task cùng sửa file song song).

## Verify tổng thể

Sau mỗi task: `npm.cmd run type-check`, test phạm vi liên quan. Cuối cùng: full suite (`npm.cmd run test`), `npm.cmd run build`, rồi final whole-branch review + finishing-a-development-branch — giống quy trình đợt `perf-optimize-pass` trước.
