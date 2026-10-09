# Panel: Trang Bị — túi (EquipmentBagSection)

Scope: túi trang bị (lưới đồ chưa mặc + chip lọc + footer select) trong Khí Đường Trang Bị, kèm các đường UI legacy/preview còn sống trong import graph.

## 1. Mount chain

**Đường live (production):**

- Rail navigation production là rail riêng của `DongFuStage.vue` — `home-navigation-surface` aside :446-450 render `NAV_ITEMS` :204-208 (gồm 'equipment'); click → `NAV_TARGET.equipment` :229 → `navigation.openBuilding('equipment_hall')` (id rail 'equipment' trùng id building). Command wheel cùng đường: `commandWheelCatalog.ts:222-225` slot equipment_hall → `DongFuStage.activateSlot` :330-345 → `openBuilding`.
- `useBuildingNavigation.ts:151-153` map functionType (`buildings.ts:114` phap_bao→'equipment', :128 equipment_hall→'equipment') → `ui.openLeftPanel('equipment_hall')`.
- `layout/GameRoot.vue:149-150` mount `<LeftPanel />` + `<FunctionOverlayPanel />`.
- `FunctionOverlayPanel.vue:41-58` — `equipment_hall` ∈ IMPERIAL_MODES ∩ PAPER_MODES → `:116` render `EquipmentHallPanel`.
- `EquipmentHallPanel.vue` (16 dòng) — `import './equipment-hall/qi-hall.css'` :10 + mount `EquipmentSurface` :11,:15.
- `EquipmentSurface.vue:209-211` — `<div v-if="activeWorkspace === 'equip'" class="bag-anchor">` chứa `<EquipmentBagSection @open-dissolve="selectWorkspace('dissolve')" />` (:210). `.bag-anchor` khai `container-type: inline-size` + `container-name: bag-panel` :355-356.
- `EquipmentSurface.vue:32` import section; `activeWorkspace` :81; guard `selectWorkspace` :85-87; `workspaceModes` :72-79 gắn label `equipment.workspace.equip` ('Trang Bị', vi.json:2252) + op tabs từ `BETA_EQUIPMENT_TABS=['enhance','dissolve']` (betaScope.ts:410).
- `EquipmentBagSection.vue:321-338` — `.bag-section__grid` render `SlotView variant="bag"` per cell; click → `handleClick` :41-43 → `useEquipmentActions.equip` :99-100 → `gameManager.equipmentOps.equipItem` qua `withSyncAndResult` + actionFeedback.

**Đường dormant/preview:**

- `usePaperNavigation.ts` — `equipment: { kind:'left_panel', mode:'equipment_hall' }` :55 mirror cùng target, nhưng file KHÔNG có production importer nào (chỉ `ui-preview/paperNavigation.ts` → `PaperPreviewSurface.vue`; `SettingsSurface.vue:4` chỉ nhắc tên trong comment). Rail production thật là `NAV_TARGET` ở trên — usePaperNavigation là bản mirror cho preview.
- Route preview thứ nhất: entry `src/ui-preview/equipment.ts` → `EquipmentPreview.vue` → `EquipmentFidelityScene` với `:preview="true"`, không slot → fixture DOM `.equipment-bag`/`.bag-tabs`/`.bag-grid` SỐNG ở route này (vẫn chết trong production).
- Route preview thứ hai: `src/ui-preview/equipment/EquipmentBagPreview.vue` — implementation túi THỨ BA hoàn toàn riêng (`.equipment-bag-workspace`/`.equipment-bag-filters`/`.equipment-bag-grid`, `EquipmentArtSlot`/`EquipmentArtButton`), mount bởi `HomeEquipmentArtPanel.vue:7,:55-57` trong `LandscapeDesignPreview.vue:65`. Hardcode '18/100' :41.

**Đường chết còn trong repo:**

- `scenes/equipment/bag/EquipmentBagPanel.vue` (53 dòng) — ZERO importer kể cả test → dead. Mount `BagGrid.vue` → `EquipmentBagSection` (BagGrid.vue:68) KHÔNG kèm `@open-dissolve` → nút 'Hóa Luyện' emit vào hư không nếu chain sống lại. BagGrid chỉ còn importer test (`InventorySort.test.ts:14`, `b18ConsumerHonesty.qa.test.ts:21`, `betaConsumerSeamsB8.qa.test.ts:36`).
- `panels/equipment-hall/EquipmentBagRail.vue` (148 dòng) — zero importer → dead; chứa text 'Chưa có trang bị dự trữ' :98-100 — empty-state copy duy nhất của scope, locale `panels.equipmentHall.bagRail` (vi.json:86-89) chết theo.
- `scenes/equipment/detail/EquipmentItemDetail.vue` (241 dòng) — zero importer → dead.
- Inventory route: `ui.openLeftPanel('inventory')` set `activeBagTab='material'` (ui.ts:236) → InventoryPanel/InventorySurface — túi trang bị đã rút khỏi inventory (ruling 2026-10-04); `BagTab` union vẫn giữ 'equipment' (ui.ts:47), `InventorySurface` normalize về 'material' :39.

## 2. UI logic inventory

**EquipmentBagSection.vue (live, 496 dòng):**

- Emit: `'open-dissolve'` :31 — nút 'Hóa Luyện' :302-306 (workspace dissolve live, ∈ BETA_EQUIPMENT_TABS).
- Store: `ui.bagSorts.equipment` (:250,:258,:265-268 qua `sortMode` get/set → `ui.setBagSortMode` ui.ts:286-300); `useStateVersion()` :37/:54 reactive dep.
- Game reads per item: `equipmentBag.getAll().filter(!equipped)` :57; `equipmentOps.getEquipmentTemplate` :63/:71; `equipmentBag.getEquippedInSlot` :65; `equipmentSystem.quoteMainStatRange` :80/:85; `zoneRegistry` :98/:151; `affixRegistry` :149; `equipmentOps.getSlotState` :150/:156.
- Computeds: `entries` :53-170; `GROUP_CHIPS` :178-183 (4 chip: all/weapon/armor/jewelry — jewelry = necklace|ring :208-212); `filtered` :205-215 (group + tone); `visibleCount` :216; `cells` :249-262 (sort trên copy); `gridCells` :272-281 (pad ≥ `EQUIPMENT_BAG_MIN_CELLS` = 8×5 = 40).
- Refs local: `activeGroup` :176, `qualityTone` :194 — KHÔNG persist (mất khi đổi workspace/remount), khác sort persist trong store → filter/sort không nhất quán.
- Constants: `EQUIPMENT_BAG_COLUMNS=8` :25; `EQUIPMENT_BAG_MIN_CELLS` :26 (không phải `MIN_CELLS`); `BAG_DISPLAY_CAPACITY=100` :220-221; `ITEM_SLOT_SRC` :286.
- Template: header (`:293-307`: title, `{{visibleCount}}/{{BAG_DISPLAY_CAPACITY}}` :295, nút '＋' :296-301, 'Hóa Luyện' :302-306) → chips nav :309-318 → grid :320-339 → footer 2 select :341-357 (`v-model` qualityTone :344 / sortMode :352).
- Scoped CSS: `.bag-section__grid :deep(.slot-view--bag)` background `var(--equipment-item-slot)` :450-456; `display:none` `.slot-view__frame-art` :457-459; `.bag-section__slot` aspect-ratio :461-464.

**DEAD bên trong file live:**

- :101-103 push `'(đang mặc)'` và :112-114 `state.marker='equipped'` unreachable — :57 đã filter `!instance.equipped`.
- :150 `instance.equipped ? getSlotState(...) : null` — luôn null.
- `nameSegments` :97-99/:130/:329 — `composeEquipmentNameSegments` chạy zoneRegistry lookup cho MỌI item nhưng `SlotView` chỉ render caption khi `showLabel` (gate :291-300); section không truyền → tên ghép không bao giờ hiện (aria dùng `accessibleLabel` :128). Tính toán chết.

**Bugs/gaps logic xác nhận:**

- `toneMatches` :197-203 — comment :190-192 'Tử (Địa+Thiên), Kim (Tiên)' nhưng `purple` dùng `rank >= 3` trên `itemQualityRank` (1-5, tien=5) → Tiên cũng match 'Tử'; 'Kim' (`rank>=5`) ⊂ 'Tử'.
- Coverage chip: `EquipmentSlot` union 6 giá trị (weapon|helmet|armor|boots|ring|necklace, EquipmentTypes.ts:1) nhưng GROUP_CHIPS không có helmet/boots → chỉ lọc được qua 'Tất cả'. Preview `EquipmentBagPreview` mirror y hệt: có filter 'other' (boots+helmet) trong data nhưng bị filter OUT khỏi chips :58.
- `EQUIPMENT_COMPARATORS` :224-244 định nghĩa 6 mode khớp union `EquipmentSortMode` (ui.ts:97-98: default|quality|rarity|realm|slot|name|forge) — nhưng `quality` (:225-228) và `realm` (:229-230) cùng = chênh lệch `indexOf` trong `PROFESSION_GRADE_ORDER` → thực chất 5 mode khác nhau. Footer :352-355 chỉ expose 'default'/'quality'.
- `withDirection` đọc `sortState.direction` :258 nhưng không UI flip trong section (`toggleBagSortDirection` ui.ts:302 / `resetBagSort` :309 chỉ còn consumer ở MaterialBagSection :389-390 / PillBagSection :567-568 + tests).
- Hai trục cùng tên 'Phẩm Chất': select lọc tone :341-344 (`equipment.quality`='Phẩm Chất', vi.json:2234) lọc theo `itemQualityRank` (Chất 1-5); option sort 'Theo Phẩm Chất' :354-355 (`equipment.qualityOrder`, :2244) sort theo `professionGradeRank` (Phẩm 1-10) — cùng label, khác semantics.
- Empty state: entries rỗng → `gridCells` vẫn pad 40 ô trống :272-281, KHÔNG text 'túi trống' nào (khác EquipmentBagRail có 'Chưa có trang bị dự trữ').

**Shared machinery section BỎ không dùng** (vẫn live cho material/pill): `useBagGridLayout` (ResizeObserver), `useBagPagination`, `BagPaginationControls` (chrome divider-ornament/button-compact/frame-xs-tooltip + `@container bag-panel (max-width:420px)` :353), search `.bag-section__search`, `useBagSort` UI đầy đủ. Comment :270-271 'no pagination … overflow scrolls'.

**Scope lân cận trong cùng surface:**

- `EquipmentFidelityScene.vue` (154 dòng): `useDialogFocus` :27 — Escape → `emit('back')` LIVE kể cả production; document mousedown preventDefault. `BuildingUpgradeButton` :8 render live :65. `@click.self="emit('back')"` :54 dead (xem §4). Fixture DOM `.equipment-bag`/`.bag-tabs`/`.bag-grid` + refs `mode`/`inspecting`/`selected`/`emptyBagCells`/`forgeItem` — dead ở production (mọi slot được fill bởi EquipmentSurface), live ở preview route.
- `useEquippedRows.ts` feed doll rows cho Enhance/Wash/Refine; `EquipmentPaperdollStage` → `EquipmentPaperdoll` slot click → `unequip(instanceId)` :229-233 — nhánh data-path thứ hai của surface.
- `DissolveTab.vue:365-373` mount `BagPaginationControls` với `sortOptions=[]` (sort cluster ẩn) bên trong `.equipment-workspace__body` — NGOÀI `.bag-anchor` → `@container bag-panel` :353 cũng không resolve ở dissolve tab.
- `qi-hall.css:276` `@container equipment-ops (max-width:560px)` — không element nào khai `container-name: equipment-ops` trong repo → dead block.

## 3. Art map

| Art file | Đường dùng | Trạng thái |
|---|---|---|
| `tien-hiep-2026-10/controls/item-slot-v1.png` | `ITEM_SLOT_SRC` :286 → var `--equipment-item-slot` :290 → intended bg :450-456 | **Double-dead**: PNG + var + rule đều mồ (thua specificity, xem §4) |
| `tien-hiep-2026-10/runtime/slot-frame.png` | `--th-art-slot-frame` (TienHiepUiAssets.ts:8, install :25-29) → global `:is(#app,body) .slot-view` tien-hiep-ui.css:56-58 | **THẮNG** — bg thật của mọi ô |
| `tien-hiep-2026-10/runtime/frame-s-slot@1x.png` | `InkNineSlice chrome-id="frame-s-slot"` (SlotView 'bag' :254-259, `.slot-view__frame-art`) → `chromeSlice` (huyenKimChrome.ts:4,42,58) → `huyen-kim-chrome.json:26-30` (slices 25, minWidth 32) | Rendered rồi `display:none` :457-459. Entry `ink-wash-ui-slices.json:57-59` (20px/40) là manifest cũ sót lại — assetId path map sang CSS classes, ink-wash PNG permanently disabled per comment :6-11 |
| `/assets/ui/Slot/seal-frame.png` | `.slot-view__seal` (SlotView.vue:608) — seal phẩm PROFESSION_GRADE_SEAL_ORDINALS | Live trên ô có grade |
| `/assets/ui/Slot/slot-frame-hover.png` | `--slot-hover-image` mọi variant (SlotView.vue:555-560) | Live hover |
| `/assets/ui/Slot/inv-slot-backdrop.png` | fallback `--slot-bg-image` (SlotView.vue:361,:378) | Bị shadow bởi rule global |
| Chip chrome `seal-chip`/`tab-seal` | `Chip.vue:51` → 4 chip :310-317 | Live (kèm global `.chip` rules :52-53) |
| `equipment-tab-brush-v1.png` (tabBrush) | EquipmentSurface :45 → var `--equipment-tab-brush` :192 → `::before` tab active :309-316; FidelityScene :50 (:81,:137,:153) | Live (surface) + live preview-only (fidelity) |
| `equipment-divider-v1.png` (dividerBrush) | EquipmentSurface :46 → var `--equipment-divider` :192 | **Dead** — consumer duy nhất là rule `.equipment-workspace__divider` :324-331 không khớp DOM |
| `equipment-circle-frame-v1.png` (circleFrame) | FidelityScene :49 → socket `::before` :116 | Preview-route only |
| paper/darkCard/heading imgs (FidelityScene :46-55) | `.equipment-sheet`, `.equipment-doll`, `.equipment-toolbar` chrome | Live bọc ngoài scope |
| `furnace-v1.png` | EquipmentSurface `showFurnaceArt` :93 — chỉ khi workspace ≠ 'equip' | Live, ẩn khi xem túi |
| `surface-m-panel` chrome | `EquipmentBagPanel.vue` (+ prop `art-needed` :24 không tồn tại trên InkNineSlice → rơi vào attrs) | Dead chain |
| `tab-pill` art-id | TabBar trong `BagGrid.vue` | Dead chain |
| EquipmentArtSlot/EquipmentArtButton pipeline | `EquipmentBagPreview.vue` | Preview only |

Global CSS chạm scope: `.chip.chip` color + `.chip.is-active` outline (tien-hiep-ui.css:52-53) áp lên 4 chip; `.bag-section__search` (:54-55, :310-315) không còn element ở equipment (vẫn live cho material/pill); `.inventory-scene` block (:281-341) + `.inventory-scene .slot-view` (:362-365, đè bg bằng `panel-frame-v2`) chỉ áp InventorySurface; `.equipment-scene` pointer-events (:396-411).

## 4. Conflicts / layers

1. **Specificity war — cell art (nặng nhất):** scoped `.bag-section__grid :deep(.slot-view--bag)` → (0,3,0); global `:is(#app,body) .slot-view` → (1,1,0). Global thắng background-image/size/repeat → mọi ô hiện `slot-frame.png` runtime thay vì `item-slot-v1.png` (comment :283-285,:447-449 'item-slot-v1 IS the cell' không bao giờ đến DOM). `.slot-view__frame-art` (nine-slice frame-s-slot, re-admit riêng cho dense inventory 2026-10-04, SlotView.vue:20-24) bị `display:none` :457-459 → cell mất cả art dự kiến lẫn nine-slice chrome.
2. **Ba thế hệ "túi trang bị" cùng tồn tại:** `EquipmentBagSection` (live production) / `BagGrid`+`EquipmentBagPanel`+`EquipmentBagRail` (dead) / `EquipmentBagPreview` (preview-only). Nếu BagGrid mount lại, `@open-dissolve` emit vào hư không (BagGrid.vue:68).
3. **Stale test:** `EquipmentBagSection.test.ts` describe :127-239 query `.bag-section__count` :166 / `.bag-section__search` :179 — không còn trong template → fail khi chạy. Query chip 'Đạo Bào' :200,:218 vẫn pass (armor chip render `panels.bag.paperdoll.slots.armor`='Đạo Bào', vi.json:553). Describe :73-126 (aria/tooltip) còn đúng.
4. **Locale zombie:** `equipment.workspace.bag` ('Túi Đồ', :2253) — không workspace 'bag'; `panels.bag.search.equipmentPlaceholder/equipmentAria` :560-561 — không còn search input; `panels.equipmentHall.bagRail` :86-89 chết cùng rail; `panels.bag.countSuffix` :540 chỉ phục vụ BagGrid dead-chain. `equipment.bagTabs` :2245-2250 dead ở production NHƯNG live ở preview route (fixture `mode` tabs).
5. **Fixture DOM trong production file:** `EquipmentFidelityScene` giữ default-slot DOM + refs — dead khi mount qua EquipmentSurface, live khi mount qua `ui-preview/equipment.ts` (entry vẫn load `tien-hiep-ui.css` :9 nên contract pointer-events áp luôn preview).
6. **CSS mồ hoàn toàn:** `tien-hiep-collections.css` — zero importer, zero `th-collection`/`pc-collection` usage → không page nào load (kể cả preview), không phải chỉ "preview-scope".
7. **Container queries không resolve:** `qi-hall.css:276` `@container equipment-ops (max-width:560px)` — không ai khai `container-name: equipment-ops`. `BagPaginationControls.vue:353` `@container bag-panel` — control không mount trong `.bag-anchor` (equipment bag bỏ pagination), còn ở DissolveTab :365-373 mount NGOÀI `.bag-anchor` → query chết cả hai nơi; `container-name: bag-panel` :356 tồn tại không consumer.
8. **Pointer-events:** FidelityScene scoped `:not([data-preview]){pointer-events:auto}` :90-93 thua global (1,1,0) → root `.equipment-scene` giữ `pointer-events:none` → `@click.self` :54 dead ở cả production lẫn preview; Escape qua `useDialogFocus` vẫn live (keydown không chịu pointer-events).
9. **Nhãn 'Phẩm Chất' hai trục:** filter tone (itemQualityRank 1-5) vs sort option 'Theo Phẩm Chất' (professionGradeRank 1-10) — cùng cụm từ, khác semantics, đặt cạnh nhau trong footer :341-355.
10. **`usePaperNavigation` dormant:** file mirror rail (equipment→equipment_hall :55) nhưng chỉ preview dùng — source of truth production là `NAV_TARGET` DongFuStage; hai bản có thể drift.

## 5. Logic không có hình ảnh

- `EQUIPMENT_COMPARATORS` rarity/realm/slot/name/forge :228-244 — implement đủ (trừ quality≡realm), không option UI.
- `ui.toggleBagSortDirection` / `ui.resetBagSort` (ui.ts:302,:309) + `sortState.direction` :258 — không control trong section.
- `nameSegments` + nhánh '(đang mặc)' :97-103/:130/:329 — tính rồi không hiển thị (thiếu `showLabel`).
- `state.marker='equipped'` :112-114 — SlotView hỗ trợ marker nhưng branch chết.
- `activeGroup`/`qualityTone` :176,:194 — filter state không persist, khác sort persist → reset trắng khi đổi workspace.
- `container-name: bag-panel` (EquipmentSurface:356) — không consumer trong scope.
- `EquipmentSortMode` union 7 giá trị vs UI 2 option.
- Preview `EquipmentBagPreview` filter 'other' (boots+helmet) — tồn tại trong FILTERS data nhưng bị loại khỏi chips :58.
- `DissolveTab.vue:367` truyền `sortOptions=[]` — BagPaginationControls sort cluster bị tắt hẳn ở đó.

## 6. Hình ảnh không có logic

- Nút '＋' :296-301 — aria 'Mở rộng túi' (`equipment.capacity`, vi.json:2231) nhưng KHÔNG `@click` → trưng bày; icon là ký tự fullwidth '＋'.
- Nhãn `N/100` :295 — `BAG_DISPLAY_CAPACITY=100` hằng trưng bày (comment :218-219 thừa nhận domain không cap); tử số `visibleCount` = số SAU lọc → lọc 'Kim' hiện '2/100', đánh lừa như capacity thật.
- `.equipment-workspace__divider` CSS + `nav button:focus-visible` scoped (EquipmentSurface:324-335) — selector không khớp DOM hiện tại (nav nằm ngoài workspace), dead rules; kéo theo `--equipment-divider` var + `equipment-divider-v1.png` mồ.
- `.bag-section__search` global rules (tien-hiep-ui.css:54-55, :310-315) — dead cho equipment (live cho material/pill).
- `EquipmentItemDetail.vue`, `EquipmentBagRail.vue`, `BagGrid.vue`+`EquipmentBagPanel.vue` — UI đầy đủ, zero production mount.
- Empty bag: 40 ô `.slot-view--empty` trống trơn, không text — `EquipmentBagRail` 'Chưa có trang bị dự trữ' là copy duy nhất nhưng file dead.
- `tien-hiep-collections.css` — art overrides mồ hoàn toàn.

## 7. Open questions

1. 'Tử' nên là Địa+Thiên (rank 3-4, khớp comment) hay Địa trở lên (code hiện)? 'Kim' hiện nằm gọn trong 'Tử'.
2. Chip coverage: thêm chip helmet/boots (hoặc 'other' như preview data đã có sẵn), hay cố ý gom vào 'Tất cả'?
3. Capacity 'N/100': giữ hằng giả, đổi thành đếm thật (`entries.length` trước lọc), hay xóa?
4. Nút '＋ Mở rộng túi': wire vào chức năng nào (chưa có API mở rộng túi) hay gỡ khỏi template?
5. 5 sort mode ẩn + direction toggle: expose trong footer, dedupe quality/realm, hay bỏ comparator thừa?
6. 'Phẩm Chất' đặt cạnh nhau ở 2 select nhưng 2 trục khác nhau — đổi tên một trong hai (vd. 'Phẩm Giai' cho professionGrade)?
7. nameSegments/'(đang mặc)'/marker 'equipped' + arm :150 — dọn dead branch hay khôi phục bằng cách hiện item đang mặc (bỏ filter :57)?
8. Xóa hay giữ: `BagGrid.vue`, `EquipmentBagPanel.vue`, `EquipmentBagRail.vue`, `EquipmentItemDetail.vue`, nhánh 'equipment' trong `BagTab` (ui.ts:47), `usePaperNavigation.ts` mirror, `tien-hiep-collections.css`, locale zombie (`equipment.workspace.bag`, `panels.bag.search.equipment*`, `equipmentHall.bagRail`, `panels.bag.countSuffix`)?
9. `EquipmentBagSection.test.ts` describe :127-239 — viết lại theo contract mới (4 chip + 2 select) hay xóa?
10. Cell art: nâng specificity scoped hay variant-scoped rule global `:is(#app,body) .slot-view`? Quyết định global — ảnh hưởng mọi slot-view khác; đồng thời `@container bag-panel` của BagPaginationControls không resolve ở cả equipment lẫn dissolve — intended container nên đặt ở đâu?
11. `qi-hall.css:276` `@container equipment-ops` — container dự kiến ở `.equipment-workspace`/`ops-tabs` chưa khai báo, hay block stale nên xóa?

## Adjudication

**Missed (15) — Accept 12, Partial 2, Reject 1:**

1. EquipmentBagPreview thế hệ 3 — **Accept có sửa**: file đúng là implementation riêng ở `ui-preview/equipment/`; nhưng mount chain là `HomeEquipmentArtPanel.vue:7,:55-57` → `LandscapeDesignPreview.vue:65`. Reviewer suy ra "FidelityScene mount bởi HomeEquipmentArtPanel" — sai: FidelityScene preview mount qua `ui-preview/equipment.ts` → `EquipmentPreview.vue`. Kết luận "fixture DOM sống ở preview" vẫn đúng (qua route equipment preview).
2. tabBrush chưa map — **Accept** (`EquipmentSurface:45,:192,:309-316` + `FidelityScene:50,:81,:137,:153`).
3. circleFrame chưa map — **Accept** (`FidelityScene:49` → `::before` :116).
4. Imported-but-unrendered FidelityScene — **Partial**: `ForgeFidelityWorkspace:3`, `ForgeBatchBag:4`, `EquipmentPaperTooltip:10`, `EquipmentPaperItem:9` đúng chỉ trong dead slots; `BuildingUpgradeButton:8` render live :65 (đúng là report bỏ sót). NHƯNG reviewer ghi `EquipmentArtButton:9`, `EquipmentArtGridItem:11`, `EquipmentBagRail:6` — ba import này KHÔNG tồn tại trong file (imports thật: :3-10 như đã liệt kê). Line refs sai.
5. `@click.self` chết — **Accept** (global `.equipment-scene{pointer-events:none}` :397; scoped override :92-93 = (0,3,1) thua (1,1,0)).
6. `useDialogFocus` listener sống — **Accept** (:27, Escape→'back', mousedown preventDefault).
7. `@container equipment-ops` chết — **Accept có sửa**: đúng không ai khai `container-name`; width thật `560px` (qi-hall.css:276), reviewer ghi 520px sai.
8. Chip không phủ helmet/boots — **Accept** (`EquipmentTypes.ts:1` 6 slots vs GROUP_CHIPS :208-212); thêm chi tiết: preview mirror cùng gap.
9. `quality`≡`realm` comparator — **Accept** (cả hai = indexOf-diff trên `PROFESSION_GRADE_ORDER`; lines thật :225-230).
10. 'Phẩm Chất' hai trục — **Accept**.
11. `.bag-section__empty` không CSS — **Reject**: grep toàn repo không có `.bag-section__empty` lẫn `state.empty` — mechanism không tồn tại. Fact đúng kế cận: `.slot-view--empty` class áp lên ô trống nhưng không scope-specific styling; empty-state gap đã có ở Missed#15.
12. BagPaginationControls ở DissolveTab thiếu container — **Accept** (:365-373 ngoài `.bag-anchor` → `@container bag-panel` chết ở dissolve nữa).
13. useEquippedRows/equipItem/paperdoll chưa inventory — **Partial**: `equipItem` report gốc ĐÃ inventory (equip path §1). Gap thật: `useEquippedRows` (doll rows op tabs), `EquipmentPaperdollStage`→`unequip` (:229-233) — accept phần này.
14. `--equipment-item-slot` double-dead — **Accept**.
15. Empty state trống trơn — **Accept** (gridCells pad 40 ô, không text; chỉ `EquipmentBagRail` có copy, file dead).

**Wrong (8) — Accept 6, Partial 1, Reject 1:**

1. Manifest frame-s-slot — **Accept**: `chromeSlice` đọc `huyen-kim-chrome.json:26-30` → `runtime/frame-s-slot@1x.png` (slices 25/minWidth 32); entry `ink-wash-ui-slices.json:57-59` vestigial vì assetId path map CSS classes, ink-wash PNG disabled theo comment :6-11.
2. `MIN_CELLS` tên sai — **Accept**: `EQUIPMENT_BAG_MIN_CELLS` :26.
3. Claim 'Đạo Bào' chip mất — **Accept**: armor chip vẫn render 'Đạo Bào' (`panels.bag.paperdoll.slots.armor`, vi.json:553); test chỉ fail do `.bag-section__search`/`.bag-section__count`.
4. `tien-hiep-collections.css` — **Accept**: zero importer + zero class usage → dead hoàn toàn, không phải "preview-scope".
5. `equipment.bagTabs` — **Accept**: dead production, live preview route (fixture tabs `mode`).
6. "EquipmentBagPanel ngoài test" — **Accept**: zero importer kể cả test; test importer là của `BagGrid.vue`.
7. `layout/GameRoot.vue` — **Accept**.
8. Line drift — **Partial**: `workspaceModes` :72-79 và guard :85-87 đã sửa; nhưng `equipment.workspace.bag` reviewer ghi :2254 — thực tế vi.json:2253 (report gốc đúng). Reject riêng correction đó.

**Lỗi mới tự phát hiện (không có trong findings):** report gốc §1 gán rail production cho `usePaperNavigation.ts` — file này dormant (importer duy nhất `ui-preview/paperNavigation.ts`; `SettingsSurface.vue:4` chỉ là comment). Rail production thật là `NAV_ITEMS`/`NAV_TARGET` trong `DongFuStage.vue` :204-243 → `openBuilding`. Đã sửa trong §1.