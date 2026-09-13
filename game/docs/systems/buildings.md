# Công trình (Building)

**Trạng thái:** Live — 6 công trình.

Core: `core/building/BuildingSystem.ts`, `BuildingManager.ts`, `BuildingRegistry.ts`, `BuildingLevelEffect.ts`. Data: `data/building/buildings.ts`. UI: icon trên Home Scene (`HomeBuildingIcons.vue`) + `BuildingConstructionGate.vue`; không còn panel "Kiến Trúc" riêng.

## Danh sách

| id | Tên | maxLevel | functionType | Vai trò |
|---|---|---|---|---|
| `gathering_outpost` | Khai Vật Đường | 9 | `exploration` | **Linh mạch** — ngưng tụ Linh Thạch theo thời gian (engine Linh Tuyền cũ), mở panel Sản Xuất |
| `equipment_hall` | Khí Đường | 9 | `equipment_hall` | gate 5 tab trang bị ([equipment.md](./equipment.md)); level giảm chi phí thao tác |
| `pill_room` | Đan Phòng | 9 | `pill_room` | gate luyện đan; `concurrentJobSlots` theo level ([alchemy.md](./alchemy.md)) |
| `teleport_array` | Truyền Tống Trận | 1 | `stage_select` | gate Thám Hiểm — mở StageSelectPanel |
| `vendor` | Ký Bảo Các | 1 | `vendor` | gate Hóa Bán + quy đổi phẩm Linh Thạch/nguyên liệu ([vendor.md](./vendor.md)) |
| `chi_hien_quan` | Chiêu Hiền Quán | 9 | — | **nguồn nhân công duy nhất**: `capacity = 1 + level × 2` (L1→3, L9→19, chưa xây = 0) — `getWorkerCapacityForLevel` trong `core/production/WorkerCapacity.ts` |

## Xây & nâng

- `upgradeCost` — mảng theo level đích; `extendCosts` sinh cost cho tier 4+ theo công thức `base × 1.65^(tier−3)` bằng gỗ + khoáng `<realm>_wood/ore_<age>`.
- `BuildingSystem.build()` → reject reason: `unknown_building | already_built | realm_locked | missing_materials` (UI popover báo rõ).
- `BuildingInstance`: `buildingId`, `level`, `lastCollectedAt`… trong `GameSave.buildings`.
- **Dev flag:** `isTestModeUnlockAll()` (`core/dev/DevMode.ts`) — localStorage `dev.testModeUnlockAll=1`, **chỉ dev build** (`import.meta.env.DEV`), bypass mọi gate cảnh giới/chi phí khi build. Mặc định tắt.

## Khai Vật Đường — linh mạch

- `getSpiritSpringRatePerSecond` — rate neo realm (`SPIRIT_SPRING_TARGET_PER_MINUTE`: mortal 5.5, LK 31, TC 93 thạch/phút — ~5% farm online), +20%/level (`LEVEL_BONUS_PER_LEVEL`), realm trên Trúc Cơ ×3/bậc.
- `getEffectiveCapacity` — storage = đúng 10h sản lượng (đồng cap `PRODUCTION_OFFLINE_CAP_SECONDS`, không bao giờ đầy trước cap thời gian).
- `getStoredAmount(instance, now, realmId)` — thuần tính từ `lastCollectedAt` (observational, dùng cho cả UI lẫn claim).
- `claim()`/`collectBuilding` — floor sản lượng → Linh Thạch đúng phẩm theo realm hiện tại (`getSpiritStoneMaterialIdForRealmTier`), reset mốc sau khi material resolve được.

## Level effects (`CraftModifiers`)

`BuildingLevelEffect.ts`: `timeReductionPercent`, `qualityBonusPercent`, `concurrentJobSlots`, `equipmentCostDiscountPercent` — đọc bởi alchemy/equipment hall.

## Liên quan

- [production.md](./production.md) — nhân công, 3 site.
- [vendor.md](./vendor.md) — Ký Bảo Các.
- [alchemy.md](./alchemy.md) — Đan Phòng.
