# Perfect Clear (Hoàn Mỹ) + Stage Tinh Anh — Design Spec

- **Ngày:** 2026-09-11
- **Trạng thái:** CHỜ USER REVIEW (các quyết định D1–D6 đã chốt qua chat; bản spec này tổng hợp thành văn — duyệt trước khi viết implementation plan)
- **Nguồn yêu cầu:** user request 2026-09-11 + các chốt product qua 2 vòng question
- **Việc roadmap tương ứng:** 9.5 #4 (perfectClearTurnLimit 0/30) + thay thế cơ chế `eliteChance` random kiểu realtime; mở đầu Phase B1 (Perfect Clear / Auto-farm completion)

---

## 0. Quyết định đã chốt (không mở lại)

| # | Quyết định | Nguồn |
|---|---|---|
| D1 | Điều kiện Hoàn Mỹ = **mọi member trong `players[]` còn `alive` lúc victory** + turns < X. Bỏ "HP-mất ≤75% của players[0]". "Cuối trận còn sống là được" — chết rồi hồi sinh vẫn OK (Kiếm Tu revive / Tử Sinh Ngô chống-chết đều hợp lệ). | user chat |
| D2 | Tinh Anh là **stage thật trong tuyến chính**: floor **3/6/9** của mỗi chương là stage Tinh Anh, floor 10 là boss. Không phải optional endgame. | user chat |
| D3 | X cho Tinh Anh **hard-code 3/5/7** theo floor 3/6/9 — không công thức. | user chat |
| D4 | X cho stage thường + boss = **placeholder** (`totalEnemyCount × 2` cho thường, `14` cho boss), "không quan trọng, balance sau". | user chat |
| D5 | Thưởng Tinh Anh = `eliteRewards` nguyên văn từ quái Elite + **first-clear bonus** per stage. | user question |
| D6 | Retire `eliteChance` (roll random) khỏi mọi stage — stage Tinh Anh là nguồn elite deterministic duy nhất. | user chat (cơ chế realtime không hợp turn-based) |

---

## 1. Hiện trạng (evidence)

- `recordPerfectClearIfEligible` (`GameManagerTurnBattleOps.ts:1235`): điều kiện = HP-mất ≤75% **chỉ của `players[0]`** + turns < `stage.perfectClearTurnLimit`. Ghi 1 lần `perfectClearStageIds` + `perfectClearSeconds` (→ auto-farm cycle = giây/2).
- **0/30 stage** có `perfectClearTurnLimit` → chip Hoàn Mỹ trong `StageSelectPanel` disabled vĩnh viễn (9.5 #4).
- `eliteChance: 0.1` trong từng entry `enemyPool` của mọi stage — roll random lúc spawn (`StageWaveSystem.pickEnemyForSpawn:163`), nguồn `eliteRewards` (Phá Cảnh Tâm Pháp đầu game...) hoàn toàn may rủi.
- Tinh Anh nhân bản stat qua `createEliteVariant` (`EnemyStatInput.applyEliteMultiplier`): HP ×2.5, ATK ×1.35, DEF ×1.15, Accuracy ×1.1 — giữ nguyên.
- `totalTurnsElapsed` (`TurnBattleSystem.ts:595`) đếm **mọi actor action** (kể cả lượt quái), không phải "lượt người chơi".
- Unlock tuần tự: `isStageUnlocked` theo `completedStageIds` nối tiếp trong `Zones.ts stageIds` — stage Tinh Anh chèn vào sẽ **bắt buộc vượt qua** để tiến tiếp.

## 2. Target behavior

### 2.1 Điều kiện Hoàn Mỹ mới

```text
victory
→ MỌI member của turnBattle.players còn entity.alive === true
→ AND (turnBattle.totalTurnsElapsed ?? 0) < stage.perfectClearTurnLimit
→ record perfectClearStageIds + perfectClearSeconds (1 lần, không overwrite — giữ nguyên)
```

- Kiểm tra tại đúng thời điểm victory trong `grantTurnBattleRewards` victory block (vị trí hiện tại của `recordPerfectClearIfEligible` — không đổi flow, chỉ đổi predicate).
- Xóa nhánh HP-loss-75% (kèm hardcode 75 và comment cũ).
- Stage chưa author X (boss/placeholder chưa set): `undefined` → không bao giờ Hoàn Mỹ — behavior hiện có, giữ nguyên.

### 2.2 Cấu trúc 10 tầng mỗi chương

| Floor | Loại | totalEnemyCount / waves | perfectClearTurnLimit |
|---|---|---|---|
| 1, 2, 4, 5, 7, 8 | Thường | giữ nguyên (10-19 quái, waves hiện có) | **placeholder** = 2 × totalEnemyCount |
| **3** | **Tinh Anh** | **1 quái elite**, waves `[1]` | **3** |
| **6** | **Tinh Anh** | **2 quái elite**, waves `[2]` | **5** |
| **9** | **Tinh Anh** | **3 quái elite**, waves `[3]` | **7** |
| 10 | Boss | giữ nguyên (solo, `effectiveWaves` override `[1]`) | **placeholder = 14** |

- Nhịp X cho Tinh Anh: elite cần ~2 turn/con → floor 3 (1 con) X=3, floor 6 (2 con) X=5, floor 9 (3 con) X=7 — mỗi con dư đúng 1 turn buffer.
- Cả 3 chương (mortal / qi_refining / foundation_establishment) dùng cùng bộ 3/5/7.
- **Số quái floor 3/6/9 thay đổi** (từ 10-12 → 1/2/3 elite): tường khó sớm ở floor 3 là chủ đích (D2), đánh đổi giai đoạn đầu có thể chậm — chấp nhận theo quyết định user.
- Floor 3/6/9 hiện KHÔNG phải floor-10 nên không dính override `effectiveWaves`/`effectiveTotalEnemyCount` — hai hàm đó chỉ bắt `floor === 10 && bossEnemyId`.

### 2.3 Stage Tinh Anh — composition

- **Loài quái:** mỗi stage Tinh Anh dùng đúng loài "elite-eligible" trong chương đó — entry `enemyPool` hiện có đang khai `eliteChance` (loài có `eliteRewards` authored trong `Enemies.ts`). Author `enemyPool` của stage Tinh Anh chỉ chứa loài đó (weight 1), KHÔNG eliteChance (D6).
- **Spawn rule:** thêm `allElite?: boolean` (1 optional field) trên `Stage`. `StageWaveSystem.pickEnemyForSpawn`: `stage.allElite === true` → mọi spawn đi qua `createEliteVariant` (bỏ qua roll). Boss-floor logic không đổi.
- **isElite vẫn set ở spawn** (từ `createEliteVariant`) → `ArtifactProgression`, `BattleLootSystem` đếm elite, telegraph `spawnTelegraphTicks` keyed `isElite` — toàn bộ pipeline phụ trợ tự hoạt động, không đụng.
- **First-clear bonus:** thêm block reward nhỏ 1-lần duy nhất lần đầu thắng stage Tinh Anh — gate qua `completedStageIds` (pattern push-once đã có trong victory block), nội dung thưởng = `eliteRewards` gấp đôi của loài chủ đạo (data authored local trong Stages.ts, không mechanism mới — reward đi đúng `BattleLootSystem` kênh drop hiện có khi cần item, phần kỹ năng/linh thạch cộng thẳng qua reward grant path có sẵn). *Chi tiết enact trong implementation plan theo đúng reward API sẵn có — không dựng framework mới.*

### 2.4 Retire eliteChance

- Xóa `eliteChance` khỏi toàn bộ entry `enemyPool` (30 stage) + xóa logic roll trong `pickEnemyForSpawn` + xóa field `eliteChance` khỏi `Stage.StageEnemyEntry` + dọn test liên quan.
- `createEliteVariant` + `applyEliteMultiplier` GIỮ NGUYÊN (dùng cho allElite spawn).
- `eliteRewards`/`bossRewards` data trong `Enemies.ts` GIỮ NGUYÊN (D5).
- Kiểm tra consumer `eliteChance` còn lại (test/panel) — rà trong plan, không bỏ sót.

### 2.5 UI

- `StageSelectPanel`: chip Hoàn Mỹ tự kích hoạt được theo data mới (đã có logic `isSelectedStagePerfectClear` — không cần sửa); thêm badge/nhãn "Tinh Anh" cho 9 stage mới + phân biệt 3 loại (thường/Tinh Anh/boss) ở list; sweep kèm việc 10.4 ẩn `spawnIntervalSeconds` khỏi display (cùng panel, cùng đợt).
- i18n: mọi string mới qua locale keys (P16).

### 2.6 Save/compat

- Dev phase — không migration (E8). Save cũ thiếu stage mới trong `completedStageIds` → stage đó hiện "chưa vượt", hợp lệ.
- Không field save mới nào: `perfectClearTurnLimit`/`allElite` là registry data, `perfectClear*` giữ nguyên shape.

## 3. Placeholder X — ghi chú balance

- 24 stage thường: `X = 2 × totalEnemyCount` (mortal 10 quái → 20 ... foundation F9 18 quái → 36); 3 stage boss: `X = 14`. **Chỉ để field tồn tại + chip hoạt động — KHÔNG phải balance thật** (user: "không quan trọng, balance sau"). Ghi comment `// PLACEHOLDER - balance pass sau` tại từng số trong `Stages.ts` để đợt balance scan dễ tìm.
- Simulation/balance check KHÔNG thuộc mission này (user đã duyệt skip) — khi mở đợt balance sau sẽ tune lại toàn bộ bảng X bằng playtest/simulation thật.

## 4. Kiến trúc — owner & ranh giới

| Trách nhiệm | Owner | Ghi chú |
|---|---|---|
| Predicate Hoàn Mỹ | `GameManagerTurnBattleOps.recordPerfectClearIfEligible` | đọc `turnBattle.players[].entity.alive` — query thuần, không mutate (A3) |
| Định nghĩa stage | `data/stage/Stage.ts` + `Stages.ts` | data-driven như hiện có |
| Spawn all-elite | `StageWaveSystem.pickEnemyForSpawn` | mechanism 1 nhánh, không content-ID check (A8) |
| Elite stat | `EnemyStatInput.applyEliteMultiplier` + `createEliteVariant` | giữ nguyên 1 owner (A2) |
| First-clear | victory block qua `completedStageIds` gate | đúng reward path có sẵn |
| UI badge | `StageSelectPanel.vue` | presentation thuần (A7) |

Không đổi: damage/vitals (R1), stat (R2), skill (R3), buff (R4), runtime/presentation (R5), presentation coordinator (R12), QuestSystem (R8.1).

## 5. Verification strategy

- **TDD từng slice:** (a) predicate alive-for-all — RED test: 1 companion chết + victory → KHÔNG Hoàn Mỹ; mọi member sống → Hoàn Mỹ; (b) stage chưa author X → không ghi; (c) once-only regression (đã có); (d) `Stages.ts` data test: 9 stage Tinh Anh đúng floor 3/6/9, waves sum === totalEnemyCount (bất biến có sẵn), X=3/5/7 đúng chương nào cũng vậy, 0 eliteChance sót; (e) `StageWaveSystem` allElite spawn test; (f) first-clear đúng 1 lần.
- **P3:** quick cho từng task; full ít nhất 1 lần cuối mission (chạm data + core).
- **P14:** real-browser — vào trận stage Tinh Anh floor 3 thật, xác nhận 1 quái Elite (tên "Tinh Anh ...", telegraph), thắng dưới 3 turn với party sống → chip Hoàn Mỹ bật trong StageSelectPanel.
- **E2E note:** không thay đổi boot/combat wiring — spec e2e hiện có không phá; có thể thêm 1 case create-to-combat mở rộng sau (optional, ghi trong plan).
- **QA adversarial quick** cuối mission theo P4.

## 6. Out of scope

- Balance thật bảng X thường/boss (D4 — đợt balance sau).
- Rebalance `eliteRewards`/drop rate (giữ nguyên data authored).
- Stage Tinh Anh art riêng (R6 — telegraph `isElite` key có sẵn tạm).
- Xóa `battle/legacy/` (9.5 #9 — mission riêng).
- Companion/party content (B3), world map (B5).
- `eliteChance` field trong save cũ nếu từng persist (data registry, không persist — verify trong plan).

## 7. Risks

| Rủi ro | Mitigation |
|---|---|
| Floor 3 mortal thành tường khó sớm (1 elite ×2.5 HP cho người chơi mới) | Chủ đích user (D2); elite mortal stat thấp, node Kiếm/Pháp basic đủ đánh — playtest P14 xác nhận không softlock |
| Player 1 người + companion chết giữa trận khi chưa có companion content → party 1 member, điều kiện alive-for-all vô hại | Tự nhiên đúng: 1 member chết = thua rồi — không thay đổi outcome |
| `totalEnemyCount` giảm ở floor 3/6/9 làm lệch quest/stage-progress consumer | Rà consumer của `totalEnemyCount`/`completedStageIds` trong plan (quest progress theo stage-clear, không theo số quái) |
| Test cũ assert số quái/waves của floor 3/6/9 | Cập nhật đúng data mới trong cùng mission (task-caused, P12) |
