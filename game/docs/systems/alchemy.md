# Đan Phòng — Luyện Đan (Alchemy)

**Trạng thái:** Live.

Core: `core/alchemy/AlchemySystem.ts`. Data recipe: `data/alchemy/` (generated từ `PILL_FAMILIES` + recipe đặc biệt). Gate: building `pill_room` (Đan Phòng). UI: `AlchemyView.vue` / `PillRoomPanel.vue` (`leftPanelMode = 'pill_room'`). Đan: [pills.md](./pills.md).

## Recipe (`AlchemyRecipe`)

- Mỗi đan phương nhận **đúng 1 loại linh thảo** (`herbVariants` — các biến thể niên đại của cùng herbId); không cho thay thảo khác dù cùng realm/niên đại → `wrong_herb`.
- Nhiên liệu: **gỗ cùng realm với recipe VÀ cùng age với thảo đã chọn** — `resolveFuelWood` chỉ chấp nhận `${fuelWoodRealmId}_wood_${variant.age}`; thiếu → `missing_fuel_wood` (không cheapest-first, không xuyên realm).
- `herbAmount`, `fuelWoodAmount`, `spiritStoneCost`, `baseDurationSeconds`, `specialIngredients?` (vd Yêu Đan cho Thông Mạch Đan/Trúc Cơ Đan).

## Job lifecycle — `ActiveAlchemyJob`

`startJob` — validate TOÀN BỘ trước, rồi **reserve atomic** (trừ thảo + gỗ + special sau khi mọi check pass — một stack không nuôi 2 job):

- `job_slots_full` khi `jobs.length >= maxConcurrentJobs` (từ `concurrentJobSlots` của Đan Phòng level).
- `missing_herb` / `missing_spirit_stone` / `missing_special_ingredient`.
- Job snapshot `roomLevelAtStart`, `herbMaterialId`, `completesAtMs = now + alchemySecondsFor(recipe, roomLevel)×1000` — nâng phòng giữa job chỉ ảnh hưởng job kế.
- `cancelJob` xoá job, **không** hoàn nguyên liệu (lò đã khởi động).

## Tốc độ & tỷ lệ thành

- `alchemySecondsFor = ceil(baseDurationSeconds / ALCHEMY_SPEED_MULTIPLIERS[level])` — ×1.0→×3.06 qua level 1–9.
- `jobSuccessPercent = HERB_AGE_BASE_SUCCESS_PERCENT[variant.age] + alchemyRoomSuccessBonus(roomLevel) + bonus khác` (talent Đan Duyên…), cap 300:
  - Tuổi thảo: decade 30 / century 50 / millennium 75 / myriad_year 100 / thuong_co 100.
  - Phòng: `ALCHEMY_SUCCESS_BONUS_PERCENT` = 0/5/10/15/20/25/30/35/40 theo level 1–9.
- Một bảng `alchemyRoomSuccessBonus` là nguồn sự thật cho cả settle lẫn `GameManager.previewAlchemyOutcome` (A9 — preview/settle không lệch).

## Settle (`tick`)

`totalPercent` → `guaranteedPills = floor(total/100)` viên chắc chắn + roll 1 lần `extraPillChance = total % 100` cho thêm 1 viên. Settle **xoá job trước** khi cộng `PillBag` (idempotent — restore/tick lặp không nhân đôi đan). `AlchemySettlementEvent` mang `delivered` + `overflow` (receipt, túi đan đầy báo rõ).

## Persist

`GameSave.alchemyJobs: AlchemyJobSave[]` → `restoreJobs()` nạp lại, tick tiếp theo `completesAtMs` (offline qua settle chung).

## Liên quan

- [pills.md](./pills.md) — sản phẩm.
- [production.md](./production.md) — nguồn thảo/gỗ.
- [buildings.md](./buildings.md) — Đan Phòng level.
- [profession-grades.md](./profession-grades.md) — phẩm đan phương.
