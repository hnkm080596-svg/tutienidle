# Nhóm 1+2+3 — Bugfix + Optimize + Game Design — Design Spec (v2 — Mộc/Khoáng đổi age axis)

**Ngày:** 2026-09-03 (v2 — user chốt: Mộc/Khoáng đổi CẢ ID lẫn tên sang age; bỏ plain wood; Linh Mộc/Khoáng/Thảo = cùng hệ phẩm(age) + chất riêng)
**Phạm vi:** Roadmap Giai đoạn 9 (9.4, 9.6, 9.8, 9.9, 9.10, 9.11), mục 8.3 (OPT-04, OPT-06), Giai đoạn 4 (6E, 6F, 6G). 12 items khảo sát; OPT-05 đã đóng.
**Roadmap:** `game/docs/roadmap.md` mục 8.1, 8.3, 7.5.
**UI/UX:** ui-ux-pro-max chạy riêng cho 6G Vendor UI khi viết plan.

## 0. Quyết định user chốt (2026-09-03)

1. **9.4 Kiếm bar: poll per-tick** (không emit event).
2. **3 mục low-value VẪN LÀM** (9.11, OPT-04, OPT-06).
3. **6E: Mộc + Khoáng đổi CẢ ID lẫn TÊN sang age** — không còn 2 trục age/quality riêng. Mapping 1:1 như herb: `decade/century/millennium/myriad_year` (+ bậc 5 'Thượng Cổ' — xem 3.1). Save v55 → **v56 bump** (dev phase — không migration, save cũ bị reject theo policy).
4. **Bỏ plain wood** (`<realm>_wood` không quality). **Wood xây dựng = wood cùng cảnh giới, chất tier 1 (decade).** Linh Mộc là nguyên liệu chung như Khoáng/Thảo — có phẩm (realm) và chất (age) riêng.
5. **6G: ẩn tab Cửa hàng** (chờ 6H).

## 1. Nhóm 1 — Bugfix (như v1, không đổi)

### 1.1. 9.4 Kiếm bar (poll per-tick)
CombatScene poll mỗi frame: `battle.player.currentKiemThe ?? 0` (route kiem_tran, max = MAX_KIEM_THE 100) hoặc `currentKiemYTemp + getKiemYPermanent()` (bat_kiem, max = kiemYTempMaxFor()). Label `Kiếm Thế` / `Kiếm Ý T.{tier}`. Gọi `playerHud?.updateKiem(current, max, label)` trong update loop. Mở rộng fake `CombatScene.hudWiring.test.ts`. KHÔNG đụng core battle.

### 1.2. 9.6 DefeatPanel 10s auto-return
`useAutoRetryCountdown(10, returnHome)` song song 3s refight; clear cả 2 trong clearTimers() + khi một cái fire.

### 1.3. 9.8 Overflow surfacing (model `BattleLootSystem.overflowParts`)
Call sites bỏ qua (audit 2026-09-03):
1. `GameManagerSaveRestore.ts:154,184` (restore materials + essence) — notify/log
2. `GameManagerBuildingOps.ts:211` (building claim) — quest hook trừ overflow + notification
3. `QuestSystem.ts:129-134` — quest progress clamp theo amount-delivered
4. `GameManager.ts:2330` (rewardReceiver) + `:2688` (decompose drainOutput — notification đang claim sai +N)
5. `EquipmentOpsSystem.ts:100,345` (auto-dissolve) — notification
6. `BattleLootSystem.ts:665` — kiểm tra pattern, thêm nếu thiếu
Bỏ qua: `App.vue:505` starter pack (bag trống).

### 1.4. 9.9 countdown guard — `stop()` đầu `start()`. Test: start→start→stop = 1 interval, onComplete 1 lần.

### 1.5. 9.10 slot-enum — `EquipmentSlotManager.restore()` skip entry nếu `!EQUIPMENT_SLOTS.includes(entry.slot)`. Test: slot lạ → skip.

### 1.6. 9.11 cloud revision-first — ghi SAVE_REVISION_KEY TRƯỚC SAVE_KEY; save fail sau revision → rollback revision cũ + report failure. Coordinator CAS test xanh nguyên trạng. Test: setItem throw giữa → rollback + failure.

## 2. Nhóm 2 — Optimize

### 2.1. OPT-04 EquipmentBag slot index
Bag không own equip mutation → thêm `setEquippedInternal(instanceId, equipped)`; EquipmentSystem.equip/unequip gọi thay gán trực tiếp; bag maintain `Map<EquipmentSlot, EquipmentInstance>`; `getEquipped()`/`getEquippedInSlot()` O(1). Test hiện có xanh nguyên trạng + consistency test (add/equip/swap/unequip/remove). **Fallback** nếu direct-assignment `instance.equipped =` quá lan (grep > 5 sites ngoài EquipmentSystem): lazy-reindex dirty-flag. Ghi quyết định vào report.

### 2.2. OPT-06 lazy handoff read
`SaveSystem.loadGame`: dời handoff `getItem/removeItem` xuống SAU shape-validation pass (trước restore), giữ comment ý đồ (:666-67). Gain nhỏ.

## 3. Nhóm 3 — Game design

### 3.1. 6E + DATA MIGRATION — Linh Mộc/Khoáng chuyển trục age (lớn nhất task)

**Hiện tại (verify `fe49848`):**
- Herb: `<herbBase>_<realm>_<age>` — age ∈ decade/century/millennium/myriad_year, `years` 10/100/1000/10000, nhãn Thập Niên/Bách Niên/Thiên Niên/Vạn Niên.
- Wood: PLAIN `<realm>_wood` (nhãn 'Thập Niên', chỉ 3 realms Lâm) + scaffold `<realm>_wood_<quality>` 9 realms × 5 quality (hoang..tien).
- Ore: `<realm>_ore_<quality>` 6+ realms × 5 quality.
- Labels: ORE_QUALITY_LABELS hoang→'Thập Niên', huyền→'Bách Niên', địa→'Thiên Niên', thiên→'Vạn Niên', tiên→'Thượng Cổ' — **cùng hệ tuổi hiển thị nhưng 2 enum key khác nhau** (age vs quality). User chốt: thống nhất age, đổi cả ID.

**Data mới (materials.ts):**
- Wood: `<realm>_wood_<age>` — age ∈ decade/century/millennium/myriad_year/thuong_co (5 bậc — thay hoang..tien), `years` mirror HERB_AGE_YEARS + thuong_co. Name = `HERB_AGE_LABELS[age] Linh Mộc <realm>`.
- Ore: `<realm>_ore_<age>` — cùng 5 age. Name tương tự 'Linh Khoáng'.
- **XÓA plain wood** `<realm>_wood` (3 entries).
- **Bậc 5 'Thượng Cổ' cho CẢ 3 loại nguyên liệu (user chốt 2026-09-03):** Herb thêm age `thuong_co` (bậc 5): `HerbAge` union + `HERB_AGES` + `isHerbAge` (ProductionTypes.ts:30-39), `HERB_AGE_YEARS.thuong_co` = **100000** (user chốt), `HERB_AGE_LABELS.thuong_co` = 'Thượng Cổ', weights `HERB_AGE_WEIGHTS.thuong_co` (nhỏ hơn myriad 5 — đề xuất 2, tổng weights không cần =100 vì engine enforce), `HERB_AGE_BASE_SUCCESS_PERCENT.thuong_co` (đề xuất 100), herb generation `<herbBase>_<age>` (materials.ts buildReworkPillHerbs), icon placeholder `thuong_co.png` cho MỌI herb family (`public/assets/materials/herbs/<family>/` — hiện mỗi family 4 file decade..myriad_year; ProfessionDataIntegrity.test.ts:100 regex icon mở rộng), locale keys `bag.filter.age.thuongCo` + `panels.bag.tooltip.ages.thuongCo` (vi 'Thượng Cổ' / en 'Primeval' — đối chiếu 'Thượng Cổ' hiện có trong ORE_QUALITY_LABELS), useBagFilter ageLabel + age ordering case (:89 — thuong_co = 4), vendor price `VendorBalance.ts:29` area (thuong_co > 16), quests không bắt buộc thêm (chỉ 2 quests dùng decade). Wood/ore bậc 5 `thuong_co` cùng lúc ấy tạo (thay 'tien' cũ).
- ORE_QUALITY_LABELS đổi key hoang→decade... hoặc REUSE age enum — chọn: **ORE_QUALITY_LABELS → MATERIAL_AGE_LABELS** (5 keys: decade/century/millennium/myriad_year/thuong_co).
- `Material.age?: HerbAge | 'thuong_co'` field (kế thừa `profession.age` cho herb — thống nhất field). Herb giữ nguyên ID (`_decade`... đã đúng).

**Migration surfaces (scan `fe49848`):**
| Surface | Việc |
|---|---|
| `data/materials/materials.ts` | buildProfessionMaterials: wood/ore generation mới theo age; XÓA plain wood; MATERIAL_AGE_LABELS |
| `data/building/buildings.ts` | Wood cost plain → `_wood_decade`; ore `hoang`→`decade` (entries :122,:154,:234, generator :15-16); **wood xây = realm ngang + tier 1 (decade)** |
| `data/enemy/Enemies.ts` | drops `qi_refining_ore_hoang` → `qi_refining_ore_decade` (grep 6+ entries) |
| `data/equipment/affixes.ts` | ore-gated affix ids nếu có |
| `core/production/DecomposeSystem.ts` | regex `^(.+)_ore_(hoang|...)` → age enum; parse helper |
| `core/production/ProductionCatalog.ts` | wood plain entries (:44,:100-103) → `_wood_decade`; ore refs |
| `core/production/ProductionBalance.ts` | ORE_QUALITY_WEIGHTS/AMOUNTS keys → age enum (renamed AGE weights? giữ tên ORE_*, đổi key type); HERB_AGE_* giữ |
| `core/alchemy/AlchemySystem.ts` | resolveFuelWood: quality list → age list; startJob thread herbAge (3.2) |
| `core/material/MaterialTierConversionBalance.ts` | id mapping cũ → mới; HOẶC xóa luôn (6G sẽ remove conversion — xem 3.3; tạm update id) |
| `core/profession/ProfessionValidators.ts` | id regex wood/ore |
| `core/profession/ProfessionMaterial.ts` | doc + parse helpers |
| `core/equipment/EquipmentOperationCostCatalog.ts` | ore refs (wash/refine cost) |
| `App.vue:496-505` | starter pack mortal_wood → mortal_wood_decade, mortal_ore_hoang → decade |
| Tests | 29 files grep-hit: convertMaterialTier, DecomposeSystem, EconomySimulation, ProfessionValidators, MaterialBagFilter, buildings.rework, Enemies, WashTab, EquipmentOperationCostCatalog, EquipmentSystem.(dissolve|wash), ProductionSystem, ProductionCatalog, ChiHienQuan.integration, LeftPanel.building, AlchemySystem |
| Save | **CURRENT_SAVE_VERSION 55 → 56** (dev phase — save cũ reject, không migration) |
| Docs | `game/docs/item-design-reference.md` (mục Linh Mộc/Khoáng), `game-guide.md` nếu nhắc |

**6E rule (chốt design):** Nhiên liệu lò = wood CÙNG realm (phẩm ngang cảnh giới recipe) + CÙNG age với herb được chọn. `resolveFuelWood(bag, realmId, amount, requiredAge)`: chỉ nhận `<realmId>_wood_<requiredAge>`; không cheapest-first; không xuyên bậc. Không có wood đúng age → job từ chối (`missing_fuel_wood` với age cụ thể trong message).

### 3.2. 6F — Rate table + simulation

- Export `PRODUCTION_RATE_TABLE` từ ProductionBalance.ts (per-site cycle seconds × yields × worker model 1+level×2).
- Simulation test `ProductionBalance.simulation.test.ts`: 3 chuỗi (herb→đan, wood→nhiên liệu, ore→khí đường) × 1 worker × 24h fixed-seed: assert sản xuất ≤ tiêu thụ per chain + yield bounds.
- LƯU Ý: sau data migration 3.1, balance weights dùng age enum mới — simulation khóa cả mapping.

### 3.3. 6G — Vendor rework

1. REMOVE `GameManager.convertSpiritStonesUp` + `convertMaterialTier` + UI cards + tests. **TRƯỚC KHI remove:** kiểm tra wood/ore conversion có phải sink up-tier duy nhất mà recipes/production phụ thuộc (grep recipe cost/fuel ids) — với data age mới (3.1), materials KHÔNG còn up-tier conversion → recipe phải dùng đúng realm materials có sẵn từ sites. Nếu thiếu sink → GHI NHẬN risk trong report.
   - `MaterialTierConversionBalance.ts` — với 3.1 đổi id, conversion cân nhắc XÓA SẠCH (nó up-tier theo realm; user muốn material có phẩm+chất riêng, không quy đổi). Chốt: XÓA conversion (cả 2) trong 6G; 3.1 chỉ cập nhật id nếu file còn sống lúc đó (thứ tự: 6E migration trước, 6G xóa sau — 3.1 skip MaterialTierConversionBalance update nếu 6G xóa nó; plan sắp xếp 6E trước 6G trong cùng branch).
2. Gate thu mua: `PROFESSION_GRADE_ORDER.indexOf(itemGrade) < indexOf(playerRealmGrade)`; grade từ material id realm-suffix (precedent DecomposeSystem.ts:223); apply ở `VendorSystem.sellMaterial` + `getVendorSellableRows`; cùng phẩm/cao hơn → không bán được.
3. UI: VendorPanel — chỉ tab Thu mua (Cửa hàng ẨN, chờ 6H); gate message i18n ("Chỉ thu mua vật phẩm phẩm thấp hơn cảnh giới hiện tại"); i18n keys mới.
4. Tests: VendorSystem.test + GameManager.vendor.test (xóa conversion tests, thêm gate tests 3 chiều) + panel test.

## 4. Thứ tự thực thi (một branch, tuần tự)

1. **Phase A — bugfix:** 9.9 → 9.10 → 9.6 → 9.4 → 9.11 → 9.8 (S→M)
2. **Phase B — optimize:** OPT-06 → OPT-04
3. **Phase C — 6E data migration** (lớn nhất): materials.ts → building/enemies/affixes → DecomposeSystem/Catalog/Balance/Validators → AlchemySystem (resolveFuelWood + rule) → App.vue starter → save v56 → tests sweep → docs
4. **Phase D — 6F:** rate table + simulation (trên data age mới)
5. **Phase E — 6G:** remove conversions + gate + VendorPanel + tests
6. Final verify + roadmap sync + QA quick

Mỗi phase = nhóm task riêng trong plan; full verify cuối mỗi phase (type-check + vitest liên quan; build + e2e cuối branch).

## 5. Rủi ro

- **Data migration lan** (29+ test files grep-hit) — sweep theo grep, không bỏ sót; run full suite sau Phase C.
- **Save v56** — save cũ reject theo dev-phase policy (không migration); người chơi dev mất save hiện tại — chấp nhận (AGENTS.md development phase).
- **6G xóa conversion = mất sink up-tier** — với age mới, sites rơi đúng age theo weights (ORE/HERB/FOREST) — kiểm tra simulation 6F xác nhận chuỗi không gãy.
- **thuong_co cho cả 3 loại** (user chốt): Herb + Wood + Ore đều 5 bậc age. Icon herb bậc 5 dùng placeholder (asset art sau). Rule 6E: herb bậc 5 cần wood thuong_co cùng realm.
- **6G xóa conversion = mất sink up-tier** — với age mới, sites rơi đúng age theo weights (ORE/HERB/FOREST — weights thuong_co thấp nhất) — kiểm tra simulation 6F xác nhận chuỗi không gãy.
- **9.11 revision-first** đổi thứ tự ghi — coordinator CAS test phải xanh nguyên trạng.
- **OPT-04 fallback** lazy-reindex nếu rewiring lan > 5 sites ngoài EquipmentSystem.

## 6. Hệ thống liên quan (tóm tắt)

Như mục 3 surfaces + CombatScene/PlayerHud (9.4), CombatDefeatPanel/useAutoRetryCountdown (9.6/9.9), EquipmentSlotManager (9.10), LocalCloudSaveService (9.11), EquipmentBag/EquipmentSystem (OPT-04), SaveSystem (OPT-06), VendorPanel/VendorSystem/GameManager (6G), ProductionBalance/simulation (6F).