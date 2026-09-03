# Nhóm 1+2+3 — Bugfix + Optimize + Game Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Đóng 6 bugfix (9.4/9.6/9.8/9.9/9.10/9.11) + 2 optimize (OPT-04/06) + 3 game design (6E data migration age axis + 6F simulation + 6G vendor rework).

**Architecture:** 5 phase tuần tự — (A) bugfix nhỏ, (B) optimize, (C) data migration Mộc/Khoáng → age axis (lớn nhất, save v56), (D) 6F simulation trên data mới, (E) 6G vendor. Full verify cuối mỗi phase.

**Tech Stack:** TypeScript, Vitest (+jsdom), Vue 3 SFC, vue-i18n v11.

**Spec:** `game/docs/superpowers/specs/2026-09-03-gp123-bugfix-optimize-design.md` (v2) — plan lập luận từ spec; executors đọc CẢ HAI file.

## Global Constraints

- Không `any`; không dependency mới; không migration save (dev phase — v56 bump, save cũ reject).
- UI Layout Rule: VendorPanel rewrite dùng pattern panel hiện có; không hardcode px.
- vi strings mới byte-fidelity với copy gốc; keys mới ở CẢ vi.json/en.json.
- Core/composable không import i18n (key-mapping pattern).
- Encoding: file UTF-8; console mojibake là display artifact — verify bằng đọc file.
- Verify chuẩn: `npm.cmd run type-check` + vitest liên quan + `npm.cmd run build` khi đụng production; full suite + e2e cuối mỗi phase.

---

## PHASE A — Bugfix

### Task A1: 9.9 countdown double-start guard

**Files:**
- Modify: `game/src/composables/useAutoRetryCountdown.ts` (`start()` ~50-56)
- Test: `game/src/composables/useAutoRetryCountdown.test.ts`

**Interfaces:**
- Produces: `start()` idempotent-safe — gọi khi đang chạy = restart sạch (clear cũ trước)

- [ ] **Step 1: Failing test** — start → start (sau 500ms fake time) → advance quá deadline: onComplete gọi ĐÚNG 1 lần; stop() sau đó: KHÔNG interval nào còn (spy clearInterval nhận handle thứ 2). Dùng fake timers (pattern test hiện có).
- [ ] **Step 2: FAIL → Implement:** dòng đầu `start()`: `stop()` — sau đó set state mới. Ghi comment: "9.9 — restart an toàn, không orphan interval".
- [ ] **Step 3: PASS** — chạy test file + `npm.cmd run type-check`.
- [ ] **Step 4: Commit** `fix(composables): useAutoRetryCountdown.start clears prior interval (9.9)`

### Task A2: 9.10 slot-enum defense-in-depth

**Files:**
- Modify: `game/src/core/equipment/EquipmentSlotManager.ts` (`restore()` ~31-35)
- Test: `game/src/core/equipment/EquipmentSlotManager.test.ts` (tạo nếu chưa có — grep)

**Interfaces:**
- Produces: `restore(entries)` skip entry có slot không thuộc `EQUIPMENT_SLOTS` (import đã có :3)

- [ ] **Step 1: Failing test** — restore([{slot:'weapon',...}, {slot:'khong_hop_le',...}]) → weapon restored, slot lạ bị skip, KHÔNG throw, slots.length giữ nguyên default set.
- [ ] **Step 2: FAIL → Implement:** guard `if (!EQUIPMENT_SLOTS.includes(entry.slot)) continue` + comment "9.10 defense-in-depth (validator v55 là gate chính)".
- [ ] **Step 3: PASS** + type-check.
- [ ] **Step 4: Commit** `fix(equipment): EquipmentSlotManager.restore rejects unknown slot ids (9.10)`

### Task A3: 9.6 DefeatPanel 10s auto-return

**Files:**
- Modify: `game/src/components/game/combat/CombatDefeatPanel.vue`
- Test: test file hiện có của panel (grep `CombatDefeatPanel.test.ts`) — jsdom

**Interfaces:**
- Consumes: `useAutoRetryCountdown` (A1), `returnHome()` (:70-75 — exit pattern chuẩn)
- Produces: 10s không tương tác → returnHome tự động

- [ ] **Step 1: Failing test** — mount panel → advance 10s (fake timers) → `ui.exitCombatScene` / `combat_scene_exit` emit đúng (spy); advance 3s KHÔNG trigger returnHome (chỉ refight prep). Nếu panel hiện test qua refight count — assert theo oracle có sẵn.
- [ ] **Step 2: FAIL → Implement:** `const returnCountdown = useAutoRetryCountdown(10, returnHome)`; start trong onMounted cạnh retry countdown; clear trong `clearTimers()` + đầu `retryNow()`/`returnHome()`. Comment 9.6.
- [ ] **Step 3: PASS** + regression tests combat panels + type-check.
- [ ] **Step 4: Commit** `feat(combat): CombatDefeatPanel 10s auto-return-home fallback (9.6)`

### Task A4: 9.4 Kiếm bar poll per-tick

**Files:**
- Modify: `game/src/game/scenes/CombatScene.ts` (update loop nơi đã đọc battle state — tìm `positions` fast-path hoặc update() scene)
- Test: `game/src/game/scenes/CombatScene.hudWiring.test.ts` (mở rộng)

**Interfaces:**
- Consumes: `battle.player.currentKiemThe` / `currentKiemYTemp` (CombatTypes.ts:67-68 optional), `BattleSystem.getKiemYPermanent()`, `kiemYTempMaxFor()`, `getKiemTuRoute()` — verify tên thật bằng grep trước khi dùng
- Produces: HUD Kiếm bar hiển thị theo route

- [ ] **Step 1: Grep xác nhận tên method thật** trong BattleSystem (`getKiemYPermanent|kiemYTempMaxFor|getKiemTuRoute`) + MAX_KIEM_THE constant location. Không tin survey mù quáng.
- [ ] **Step 2: Failing test (hudWiring)** — battle fake có route 'kiem_tran' + `currentKiemThe: 30` → sau 1 update() scene → fake hud `updateKiem` nhận (30, 100, 'Kiếm Thế'); route 'bat_kiem' + temp 20 + permanent tier 2 (20) → updateKiem(40, expectedMax, 'Kiếm Ý T.2'); battle null / player thiếu field → updateKiem(0, 0, '') (bar ẩn).
- [ ] **Step 3: FAIL → Implement:** trong CombatScene update (nơi gọi updateHp/updateMp per-frame hoặc nơi nhận positions event — chọn nơi battle đã available), poll: route kiem_tran → `updateKiem(currentKiemThe ?? 0, MAX_KIEM_THE, 'Kiếm Thế')`; bat_kiem → `current = temp + permanent; max = kiemYTempMaxFor(); label = Kiếm Ý T.${tier}`. Gọi `this.playerHud?.updateKiem(...)` (optional-chain như hp/mp). Comment 9.4.
- [ ] **Step 4: PASS** — hudWiring + PlayerHudLayer.test + CombatScene lifecycle tests + type-check.
- [ ] **Step 5: Commit** `feat(combat): wire Kiem bar into PlayerHudLayer via per-tick poll (9.4)`

### Task A5: 9.11 LocalCloudSaveService revision-first

**Files:**
- Modify: `game/src/services/cloudSave/LocalCloudSaveService.ts` (save() 17-33)
- Test: test file hiện có (grep `LocalCloudSaveService.test.ts`)

**Interfaces:**
- Produces: save() ghi SAVE_REVISION_KEY trước SAVE_KEY; save write fail → rollback revision + return failure (không fabricate success)

- [ ] **Step 1: Đọc contract hiện tại** — CloudSaveCoordinator.test expectations + SaveSystem quota tests (learned-defect ledger QA-2026-09-01-002 nhắc quota path). Ghi lại behavior contract TRƯỚC khi đổi.
- [ ] **Step 2: Failing test** — mock setItem throw ở lần gọi SAVE_KEY → save() trả failure + revision Rolled BACK về giá trị cũ (đọc SAVE_REVISION_KEY sau = expectedRevision cũ); mock throw ở revision write → failure, SAVE_KEY KHÔNG bị ghi (revision-first đảm bảo).
- [ ] **Step 3: FAIL → Implement:** đổi thứ tự: setItem(REVISION) → try setItem(SAVE) catch → rollback setItem(REVISION, oldRevision) + return failure. Comment 9.11 (crash giữa 2 key giờ để revision mới + save cũ → CAS mismatch → coordinator resync — an toàn hơn stale-revision).
- [ ] **Step 4: PASS** — cloud save test files + coordinator tests + type-check. Nếu coordinator/SaveSystem test giả định thứ tự key → cập nhật test theo contract mới (không weaken).
- [ ] **Step 5: Commit** `fix(cloudSave): revision-first write with rollback on save failure (9.11)`

### Task A6: 9.8 MaterialBag.add overflow surfacing

**Files:**
- Modify: `game/src/core/game/GameManagerSaveRestore.ts` (:154 materials restore, :184 essence)
- Modify: `game/src/core/game/GameManagerBuildingOps.ts` (:211 building claim)
- Modify: `game/src/core/quest/QuestSystem.ts` (:129-134)
- Modify: `game/src/core/game/GameManager.ts` (:2330 rewardReceiver, :2688 decompose drainOutput)
- Modify: `game/src/core/equipment/EquipmentOpsSystem.ts` (:100, :345)
- Modify: `game/src/core/battle/BattleLootSystem.ts` (:665 — kiểm tra pattern)
- Test: test files của từng owner (grep) + 1 integration test mới `game/src/core/game/GameManager.overflowSurfacing.test.ts`

**Interfaces:**
- Consumes: `materialBag.add()` overflow return; notification channel hiện có (grep pattern decompose/loot notification — dùng cùng channel)
- Produces: mọi caller reward-path surface overflow; quest progress clamp delivered

- [ ] **Step 1: Failing integration test** — bag gần cap: building claim yield vượt cap → notification "túi đầy mất X" (hoặc channel tương đương) + quest progress chỉ tính delivered; restore save với materials vượt cap → surface (notify) + bag không vượt limit.
- [ ] **Step 2: FAIL → Implement theo từng call site:**
  - Restore (:154,:184): capture overflow tổng → 1 notification cuối restore (không spam).
  - Building claim (:211): `const overflow = bag.add(...)`; quest hook `amount - overflow`; notify nếu overflow > 0.
  - QuestSystem (:129): clamp quest progress = delivered (amount - overflow).
  - RewardReceiver (:2330) + Decompose (:2688): notification số thực nhận (fix notification sai +N).
  - EquipmentOps (:100,:345): notification như decompose.
  - BattleLoot (:665): đọc — nếu đã dùng overflowParts thì bỏ qua, nếu không thì áp pattern.
  - Notification: grep channel decompose/loot dùng (`notificationStore`? `drainNotifications`?) — theo đúng pattern; i18n key mới `bag.overflow` vi/en ("Túi đầy — mất {amount} {name}").
- [ ] **Step 3: PASS** — owner tests + integration test + full suite Phase A.
- [ ] **Step 4: Commit** `fix(economy): surface MaterialBag.add overflow at every reward caller (9.8)`

### Phase A verify + commit checkpoint

- [ ] `npm.cmd run test` full + `npm.cmd run type-check` + `npm.cmd run build`.
- [ ] **Checkpoint commit** (nếu các task chưa commit rời) + ghi ledger Phase A complete.

---

## PHASE B — Optimize

### Task B1: OPT-06 lazy handoff read

**Files:**
- Modify: `game/src/services/save/SaveSystem.ts` (loadGame handoff block ~661-668)
- Test: `game/src/services/save/SaveSystem.test.ts` (handoff tests hiện có)

- [ ] **Step 1: Test hiện tại** — đọc handoff tests (import flow :809-813 write, load đọc). Xác định: handoff chỉ có ý nghĩa khi save OK (comment :666-67 muốn preserve trên corruption — XÁC MINH lại: nếu corruption path CẦN handoff thì dời xuống sau validation sẽ phá — đọc kỹ 2 comment :666-667 và logic; nếu phá → chỉ dời removeItem xuống sau khi đọc thành công, giữ getItem nguyên vị trí; ghi quyết định).
- [ ] **Step 2: Implement theo kết quả Step 1** — tối thiểu: `removeItem` chỉ chạy khi đã consume; hoặc move cả block sau validation-pass nếu an toàn. Không đổi behavior import→load.
- [ ] **Step 3: PASS** — SaveSystem.test + bootRestore + import tests.
- [ ] **Step 4: Commit** `perf(save): defer equipment handoff read past validation (OPT-06)`

### Task B2: OPT-04 EquipmentBag slot index

**Files:**
- Modify: `game/src/core/equipment/EquipmentBag.ts`
- Modify: `game/src/core/equipment/EquipmentSystem.ts` (equip/unequip mutation sites — grep `\.equipped = `)
- Test: `game/src/core/equipment/EquipmentBag.test.ts` + EquipmentSystem tests nguyên trạng phải xanh

**Interfaces:**
- Produces: `getEquipped()`/`getEquippedInSlot()` O(1) qua index; `setEquippedInternal(instanceId, equipped)` bag API

- [ ] **Step 1: Grep `\.equipped = ` toàn game/src** — đếm sites ngoài EquipmentBag. ≤ 5 sites ngoài EquipmentSystem → rewiring; > 5 → FALLBACK lazy-reindex (dirty-flag, re-build index trong getEquipped/getEquippedInSlot khi dirty). Ghi quyết định + số đếm vào report.
- [ ] **Step 2: Implement chính (rewiring):** bag thêm slotIndex Map + `setEquippedInternal` (flip flag + update index) ; EquipmentSystem equip/unequip swap sites gọi bag API; add/remove maintain index. Fallback: dirty-flag + rebuild trong 2 getters.
- [ ] **Step 3: Tests** — consistency test mới (add→equip→swap slot→unequip→remove cycle × assert index = filter ground truth mọi bước); TOÀN BỘ EquipmentSystem/EquipmentBag tests hiện tại xanh NGUYÊN TRẠNG (không sửa assertion).
- [ ] **Step 4: PASS** + type-check + build.
- [ ] **Step 5: Commit** `perf(equipment): slot index for EquipmentBag equipped lookups (OPT-04)`

### Phase B verify

- [ ] Full suite + type-check + build. Ledger checkpoint.

---

## PHASE C — 6E Data Migration (age axis, save v56)

### Task C1: Age enum + constants mở rộng (thuong_co cho herb)

**Files:**
- Modify: `game/src/core/production/ProductionTypes.ts` (HerbAge union + HERB_AGES + isHerbAge :30-39 — thêm 'thuong_co')
- Modify: `game/src/data/materials/materials.ts` (HERB_AGE_YEARS.thuong_co = 100000; HERB_AGE_LABELS từ ORE_QUALITY_LABELS — xem C2)
- Modify: `game/src/core/production/ProductionBalance.ts` (HERB_AGE_WEIGHTS.thuong_co = 2; HERB_AGE_BASE_SUCCESS_PERCENT.thuong_co = 100)
- Modify: `game/src/locales/vi.json` + `en.json` (`bag.filter.age.thuongCo`: vi 'Thượng Cổ' / en 'Primeval'; `panels.bag.tooltip.ages.thuongCo` cùng cặp)
- Modify: `game/src/composables/useBagFilter.ts` (ageLabel key map + ordering case thuong_co = 4)
- Modify: `game/src/components/panels/bag-sections/MaterialBagSection.vue` (tooltip ages map)
- Modify: `game/src/core/economy/VendorBalance.ts` (thuong_co price > 16 — đề xuất 32)
- Test: SkillResourceStatLabels-style integrity — ProfessionDataIntegrity.test.ts icon regex + any age-typed Record exhaustiveness errors (type-check sẽ bắt)

**Interfaces:**
- Produces: `HerbAge = 'decade' | 'century' | 'millennium' | 'myriad_year' | 'thuong_co'`; mọi Record<HerbAge,...> exhaustive (type-check enforce)

- [ ] **Step 1: Viết failing test** — integrity: HERB_AGES length 5; weights giảm dần decade>...>thuong_co; herb generation tạo 5 variants mỗi family; icon path regex chấp nhận thuong_co.
- [ ] **Step 2: FAIL → Implement** từng surface (type-check dẫn đường — Record<HerbAge> thiếu key sẽ báo).
- [ ] **Step 3: Icon placeholder** — copy 1 icon age hiện có (vd decade.png) thành `thuong_co.png` cho MỌI family dir trong `game/public/assets/materials/herbs/*/` (PowerShell Copy-Item loop) — placeholder, art thật sau.
- [ ] **Step 4: PASS** — ProfessionDataIntegrity + ProductionSystem herb tests + parity.
- [ ] **Step 5: Commit** `feat(materials): add thuong_co age tier — 5-tier unified age axis (6E prep)`

### Task C2: Wood/Ore đổi ID sang age + xóa plain wood

**Files:**
- Modify: `game/src/data/materials/materials.ts` — buildProfessionMaterials:
  - Wood: bỏ plain `<realm>_wood` entries + bỏ PLAIN_WOOD_AGE_LABEL; scaffold đổi `id: ${realmId}_wood_${quality}` → `_${age}` (age enum 5 bậc; map cũ hoang→decade, huyền→century, địa→millennium, thiên→myriad_year, tiên→thuong_co); name = `${AGE_LABELS[age]} Linh Mộc <realm label>`; `profession: { resourceKind:'wood', realmId, age }`
  - Ore: tương tự `_ore_${age}`; profession field thêm `age` thay `quality`
  - Đổi `ORE_QUALITY_LABELS` → `MATERIAL_AGE_LABELS` (keys age enum; values giữ nguyên: 'Thập Niên'/'Bách Niên'/'Thiên Niên'/'Vạn Niên'/'Thượng Cổ'); `ORE_QUALITY_WEIGHTS`/`AMOUNTS` (ProductionBalance) keys → age (RENAME biến → `MATERIAL_AGE_WEIGHTS`/`AMOUNTS`? — quyết định: RENAME để tránh nhầm; grep consumers trước)
  - `years` field cho wood/ore materials (mirror HERB_AGE_YEARS — thống nhất data)
- Modify consumers theo grep (17+ files production code): buildings.ts (generator :15-16 + entries :92-93,:119-122,:154,:234 — wood plain → `_wood_decade`, ore hoang→decade), Enemies.ts (6+ drops), affixes.ts, DecomposeSystem.ts (regex :217 + doc :15), ProductionCatalog.ts (:44,:100-103 + ore refs), ProfessionValidators.ts, ProfessionMaterial.ts, EquipmentOperationCostCatalog.ts, App.vue (:496-505 starter pack), AlchemySystem.ts (resolveFuelWood — task C3), GameManager.ts:1766 (convertMaterialTier — task E sẽ xóa; TẠM update id mapping ở đây nếu test cũ còn chạy giữa phase)
- Tests sweep: 29 grep-hit files — đổi id literals theo bảng map; DECOMPOSE regex test, EconomySimulation, buildings.rework, Enemies.test, WashTab, EquipmentOperationCostCatalog.test, EquipmentSystem.(dissolve|wash), ProductionSystem, MaterialBagFilter, ChiHienQuan.integration, LeftPanel.building, ProfessionValidators, GameManager.phapTuWoodPath (16 hits — node tree cost dùng wood?)
- Save: `game/src/services/save/saveVersion.ts` CURRENT_SAVE_VERSION 55→56 + comment lý do (age axis unified)

**Interfaces:**
- Produces: Material IDs `<realm>_wood_<age>` / `<realm>_ore_<age>`; `MATERIAL_AGE_LABELS`; plain wood KHÔNG TỒN TẠI; save v56

- [ ] **Step 1: Bảng map id cũ→mới** (viết ra trong report): `<r>_wood` → `<r>_wood_decade`; `<r>_wood_hoang` → `<r>_wood_decade`; huyền→century; địa→millennium; thiên→myriad_year; tiên→thuong_co; ore tương tự. (LƯU Ý: old plain wood = decade; old hoang = decade — CẢ HAI map về decade!)
- [ ] **Step 2: Failing tests trước cho integrity** — ProfessionDataIntegrity: mọi wood/ore id match `_<age>` enum; KHÔNG tồn tại id match `_(hoang|huyen|dia|thien|tien)$` cho wood/ore; không tồn tại plain `<r>_wood`.
- [ ] **Step 3: FAIL → Implement materials.ts + ProductionBalance rename** — type-check dẫn đường qua Record keys.
- [ ] **Step 4: Sweep consumers theo bảng map** — từng file một (grep từng id cũ), run focused test mỗi nhóm. App.vue starter pack: mortal_wood → mortal_wood_decade, mortal_ore_hoang → mortal_ore_decade. **Plain-wood consumers BẮT BUỘC liệt kê đầy đủ (grep `_wood\` và `_wood'`):** ProductionCatalog.ts THANH_VAN_FOREST_REWARDS (:100-106 — 3 rewards Forest), buildings.ts costs (:92-93,:119-122 + generator), resolveFuelWood base branch (AlchemySystem — C3 thay hoàn toàn), ProfessionMaterial.ts doc/regex. **Plain ore KHÔNG tồn tại trước migration — đảm bảo generation mới KHÔNG sinh plain ore (chỉ `_ore_<age>`).**
- [ ] **Step 5: Save bump v56** + saveShapeValidation: grep validator có hardcode quality enum cho wood/ore không (isEquipmentSlot-style checks) — cập nhật nếu có.
- [ ] **Step 6: Full suite + type-check + build.** Sweep grep cuối: 0 hits `_(hoang|huyen|dia|thien|tien)\b` trong context wood/ore (trừ locale/legacy docs), 0 hits plain `_wood\b` (cẩn thận `_wood_` vẫn hợp lệ).
- [ ] **Step 7: Docs** — item-design-reference.md (mục Linh Mộc/Khoáng — id convention mới), game-guide.md nếu nhắc.
- [ ] **Step 8: Commit** `feat(materials)!: unify wood/ore onto age axis — drop plain wood, save v56 (6E)`

### Task C3: 6E rule — nhiên liệu cùng realm + cùng age

**Files:**
- Modify: `game/src/core/alchemy/AlchemySystem.ts` (resolveFuelWood + startJob)
- Modify: `game/src/components/panels/AlchemyView.vue` (fuel requirement hiển thị theo herb variant)
- Test: `game/src/core/alchemy/AlchemySystem.test.ts` (resolveFuelWood suite 214-242 mở rộng)

**Interfaces:**
- Produces: `resolveFuelWood(bag, realmId, amount, requiredAge): string | null` — chỉ chấp nhận `<realmId>_wood_<requiredAge>`; startJob thread herb age từ herb variant

- [ ] **Step 1: Failing tests** — resolveFuelWood: đúng realm+age → id; sai age (bag có wood bậc khác) → null; sai realm → null; thiếu amount → null. startJob: herb myriad_year + wood myriad_year đủ → job start; wood bậc thấp hơn → reject `missing_fuel_wood` (message kèm age). Herb decade (base realm) + wood decade → OK.
- [ ] **Step 2: FAIL → Implement** — resolveFuelWood đơn giản hóa (không cheapest-first scan): `const candidate = `${realmId}_wood_${requiredAge}`; return bag.has(candidate, amount) ? candidate : null`. startJob: herb variant age → requiredAge param; fuel shortage error message kèm age (i18n nếu message lên UI — check REASON_LABELS path đã key hóa từ batch trước).
- [ ] **Step 3: AlchemyView** — hiển thị nhiên liệu yêu cầu: tên wood theo herb variant selected (`<realm>_wood_<age>` qua material registry name) — grep render fuel hiện tại, cập nhật.
- [ ] **Step 4: PASS** — AlchemySystem suite + EconomySimulation + type-check + build.
- [ ] **Step 5: Commit** `feat(alchemy): fuel wood must match herb realm AND age exactly (6E)`

### Phase C verify

- [ ] Full suite + type-check + build + **e2e** (save v56 — boot-fresh phải pass; save-reload e2e tạo save mới — pass).
- [ ] Ledger checkpoint Phase C.

---

## PHASE D — 6F Rate table + simulation

### Task D1: PRODUCTION_RATE_TABLE + simulation test

**Files:**
- Modify: `game/src/core/production/ProductionBalance.ts` (export bảng tổng hợp)
- Create: `game/src/core/production/ProductionBalance.simulation.test.ts`

**Interfaces:**
- Produces: `PRODUCTION_RATE_TABLE` — per-site: realm, cycle seconds, yield id+amount range, worker model; simulation test khóa balance

- [ ] **Step 1: Export table** — tổng hợp từ constants hiện có (CYCLE_BASE_SECONDS_BY_REALM × SITE_SPEED_MULTIPLIERS per level, yield constants GROTTO_HERB_AMOUNT/FOREST_WOOD_AMOUNTS/ORE_QUALITY_AMOUNTS/HERB_AGE weights). Pure re-export/derive — không đổi behavior.
- [ ] **Step 2: Simulation test** — 3 chuỗi × 1 worker × 24h (86400s) fixed-seed (pattern ProductionSystem.test offline harness): herb chain (Grotto → herb per age weights → AlchemySystem job thành công rate per age) assert sản xuất đan ≤ tiêu thụ herb; wood chain (Forest → wood amount → fuel consumption per job) assert wood sản xuất ≥ nhiên liệu cần cho herb jobs (cùng age distribution); ore chain (Quáng → ore → DecomposeSystem tinh hoa) assert ore sản xuất ≥ decompose tiêu thụ. Fixed seed từ ProductionBalance seeded RNG (:122-160). Mỗi chain: assert bất đẳng thức + in ra số liệu (console trong test cho debug).
- [ ] **Step 3: PASS** — nếu bất đẳng thức VIOLATE: KHÔNG tune ProductionBalance trong task này — report số liệu violation để user quyết (balance tuning là quyết định design).
- [ ] **Step 4: Commit** `test(production): 24h per-chain balance simulation + rate table export (6F)`

### Phase D verify — full suite + type-check. Ledger checkpoint.

---

## PHASE E — 6G Vendor rework

### Task E1: Kiểm tra dependency trước khi remove conversion

**Files:** read-only investigation
- [ ] **Step 1: Grep** recipe cost/fuel/production inputs dùng materials có thể up-tiered (wood/ore realm cao hơn site realm?) — với age axis mới, sites rơi đúng realm materials; conversion cũ là đường LÊN realm. Nếu buildings/recipes T3+ cần materials realm cao mà sites tương ứng có sẵn (REALM_TIERS.slice(3) scaffold ore tồn tại + Quáng site T3+?) → an toàn remove; nếu gap (site chưa có cho realm nào đó) → GHI NHẬN trong report + user quyết (defer removal hay remove kèm site gap).
- [ ] **Step 2: Báo cáo dependency** — return NEEDS_CONTEXT nếu gap nghiêm trọng, else DONE với evidence.

### Task E2: Remove conversions + gate thu mua + VendorPanel

**Files:**
- Modify: `game/src/core/game/GameManager.ts` (xóa convertSpiritStonesUp ~1721-1761, convertMaterialTier ~1771-1809)
- Modify: `game/src/core/economy/VendorSystem.ts` (sellMaterial + getUnitSellPrice nhận playerGrade gate)
- Modify: `game/src/core/game/GameManager.ts` (sellMaterialToVendor/getVendorSellableRows thread player realm grade)
- Delete: `game/src/core/material/MaterialTierConversionBalance.ts` + `game/src/core/material/SpiritStoneMaterial.ts` conversion ratio (nếu chỉ conversion dùng — grep; SpiritStoneMaterial còn có SPIRIT_STONE_MATERIAL_ID chính — chỉ xóa ratio)
- Modify: `game/src/components/panels/VendorPanel.vue` (bỏ 2 conversion cards; chỉ thu mua; gate message)
- Modify: `game/src/locales/vi.json` + `en.json` (gate message + xóa keys conversion)
- Delete tests: GameManager.convertSpiritStones.test.ts, GameManager.convertMaterialTier.test.ts; Modify: VendorSystem.test.ts, GameManager.vendor.test.ts, VendorPanel.test (nếu có)

**Interfaces:**
- Produces: `sellMaterial(materialId, amount, playerRealm)` — chỉ sellable khi `PROFESSION_GRADE_ORDER.indexOf(itemGrade) < indexOf(playerGrade)`; `getVendorSellableRows(playerRealm)` filter tương tự; KHÔNG còn conversion API

- [ ] **Step 1: Failing gate tests** — 3 chiều: item grade < player grade → sellable + giá đúng; = → rejected `grade_not_below` (reason mới); > → rejected. getVendorSellableRows filter. Material grade derive từ id realm-suffix (precedent DecomposeSystem.ts:223 regex — realm portion → PROFESSION_GRADE_BY_REALM).
- [ ] **Step 2: FAIL → Implement core gate** — VendorSystem nhận playerRealm/grade qua method param (không import GameManager); GameManager thread player.$state.realmId.
- [ ] **Step 3: Remove conversions** — xóa 2 methods + ratio constants (grep consumer trước: nếu MaterialTierConversionBalance còn consumer khác ngoài GameManager+tests → đánh giá; expectation: chỉ conversion dùng). Xóa test files conversion.
- [ ] **Step 4: VendorPanel rewrite** — bỏ 2 conversion cards + buildTierConversionRows; section thu mua giữ + gate message khi reject (toast qua channel hiện có — i18n key `vendor.gateNotBelow` vi/en); KHÔNG tab Cửa hàng (ẩn — user chốt).
- [ ] **Step 5: PASS** — VendorSystem.test + GameManager.vendor.test cập nhật + panel test + parity + type-check + build.
- [ ] **Step 6: Commit** `feat(vendor)!: gate sell-by-grade below player realm, remove tier conversions (6G)`

### Task E3: Roadmap sync + QA quick + final verify

- [ ] **Full matrix** từ `game/`: test full, type-check, build, test:e2e (9 e2e).
- [ ] **Roadmap edits:** 8.1 (9.4/9.6/9.8/9.9/9.10/9.11 ✅), 8.3 (OPT-04/06 ✅, OPT-05 note đã đóng), 7.5 (6E/6F/6G ✅ với commit refs), 7.7 Giai đoạn 4 row update.
- [ ] **QA quick report** `game/docs/qa/2026-09-03-gp123-quick.md` — verdict theo AGENTS.md rules.
- [ ] **Commit** `docs: roadmap sync + consolidated QA report (Groups 1-3)`

---

## Phase dependency notes

- C1 → C2 → C3 tuần tự (enum trước, id sau, rule cuối).
- E1 (investigation) TRƯỚC E2 — nếu gap → dừng hỏi user.
- A/B phases độc lập C/D/E — nhưng cùng branch tuần tự theo thứ tự A→B→C→D→E để review dễ.
- Conversion removal (E) PHẢI sau C (age ids) — MaterialTierConversionBalance chỉ xóa trong E.