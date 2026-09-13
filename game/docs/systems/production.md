# Sản xuất — Lâm / Quáng / Động Thiên

**Trạng thái:** Live.

Core: `core/production/ProductionSystem.ts`, `ProductionCatalog.ts`, `ProductionBalance.ts`, `ProductionTypes.ts`, `WorkerAllocator.ts`. UI: `ProductionPanel.vue` (`leftPanelMode = 'exploration'`, label "Sản Xuất") + `WorkerLodgePanel.vue`. Worker gate: building Điều Phối Nhân Công ([buildings.md](./buildings.md)).

## Territory

`TERRITORY_THANH_VAN` — realmIds `[mortal, qi_refining, foundation_establishment]`, đúng 3 site:

| siteId | Tên | Kind | Sản phẩm |
|---|---|---|---|
| `thanh_van_lam` | Thanh Vân Lâm | forest | `<realm>_wood_<age>` (gỗ xây dựng + nhiên liệu đan lò) |
| `thanh_van_quang` | Huyền Thiết Quảng | mine | `<realm>_ore_<age>` (luyện trang bị, phân giải) |
| `thanh_van_dong_thien` | Thanh Vân Động Thiên | grotto | `<herbId>_<realm>_<age>` (1 loại thảo/đan phương) |

Mỗi site `maxLevel = 9`, nâng bằng gỗ cùng realm + Linh Thạch (`SITE_UPGRADE_COSTS`), **giữ level khi đột phá** realm.

## Cycle model

- Start cycle → **snapshot** `collectionRealmId`, `siteLevelAtStart`, `rewardTableVersion`, `rollSeed`, `completesAtMs = startedAtMs + cycleSeconds`. Nâng level giữa chừng **không** đổi cycle đang chạy.
- `cycleSeconds = ceil(CYCLE_BASE_SECONDS_BY_REALM[collectionRealmId] / getSiteSpeedMultiplier(level))` — base theo realm (mortal 100s, LK 300s, TC 900s, Kim Đan 2700s…), speed ×1.0→×4.6 theo level 1–9.
- `completesAtMs` tới → roll reward bằng `mulberry32(rollSeed)` — deterministic theo seed, mọi roll xảy ra **lúc complete** không phải lúc start.
- Delivery vào `MaterialBag` **idempotent** (cycle đã delivered không giao lại); overflow trả về `ProductionSettlementEvent.overflow`.
- `autoRestart` — cycle xong tự tạo cycle mới với seed mới.

## Reward roll

- **Realm tier của lô**: `getTierWeightProfile(collectionRealmId)` — low `[60,20,10]` / middle `[40,40,20]` / high `[20,40,40]` trọng số (chuẩn hoá trước khi roll).
- **Tuổi** gỗ/khoáng: `MATERIAL_AGE_WEIGHTS` {decade 50, century 25, millennium 14, myriad_year 8, thuong_co 3}; số lượng `MATERIAL_AGE_AMOUNTS` {3,2,2,1,1}.
- **Tuổi thảo** Động Thiên: `HERB_AGE_WEIGHTS` {55,28,12,5,2}; mỗi cycle đúng `GROTTO_HERB_AMOUNT = 1` thảo.
- Id theo convention `<realm>_wood_<age>` / `<realm>_ore_<age>` / `<herbBase>_<age>` ([inventory.md](./inventory.md)).

## Worker — `allocateWorkerSlots` (R7, single rule)

Dung lượng `player.autoWorkerCapacity` (từ building Điều Phối Nhân Công). Một pure function dùng chung cho **cả online tick lẫn offline settle** — không đường phân phối riêng:

1. `capacity` floor ≥ 0.
2. Site có assignment thủ công lấy `min(assigned, remaining)` theo thứ tự `activeSiteIds`.
3. Phần dư round-robin qua site **không** assignment; hết site nhận thì dư đứng yên (không invent rule).
4. Mọi site active đều có mặt trong kết quả (0 nếu không được cấp).

## Offline settle

Settle tuần tự từng cycle trong `PRODUCTION_OFFLINE_CAP_SECONDS = 10h`; mỗi auto-cycle seed riêng. Online tick và offline share một delivery path (A9).

## Site state trong save

`GameSave.productionSites`: `ProductionSiteSave[]` (siteId, level, autoRestart, active cycle kèm seed/snapshot) — restore khôi phục cycle đang chạy.

## Liên quan

- [decompose.md](./decompose.md) — cùng worker pool.
- [buildings.md](./buildings.md) — Điều Phối Nhân Công.
- [alchemy.md](./alchemy.md) — thảo → đan.
- [profession-grades.md](./profession-grades.md) — phẩm nguyên liệu.
