# Trữ Vật audit (final, đã đối chiếu)

Scope: `panels/InventoryPanel.vue` + `panels/bag-sections/*` + chrome global `src/assets/tien-hiep-ui.css` (rule match class trong scope). Repo `game/` @ `devin/artui-c0-foundation`.

## 1. Mount chain

Chain production (duy nhất hiển thị màn "Kho Vật" bên trái):

- `GameRoot.vue:149` → `LeftPanel.vue` (`<Transition name="th-panel-swap">` :16, `<InventoryPanel v-else-if="ui.leftPanel === 'inventory'">` :18)
- `InventoryPanel.vue` — wrapper `.inventory-overlay` fixed inset:0 `pointer-events:none`, mount `InventorySurface` kèm comment nói imperial-scroll shell đã retire.
- `InventorySurface.vue` — `SceneDesignCanvas overlay` (`scene-viewport--overlay` = nền transparent + `pointer-events:none`, SceneDesignCanvas.vue:41-42) + `InventoryFidelityScene` (props `items=[]`, `selected=undefined`, `filter=material`, `query=''`, `notice=''` :71 — kênh self-contained dead) + slot `#toolbar/#grid/#count` + `.bag-anchor` (container-name `bag-panel` :156-157).
- Trong `bag-anchor`: `MaterialBagSection` / `PillBagSection` theo `ui.activeBagTab` (không mount EquipmentBagSection — tab 'equipment' normalize về 'material' :39).

Chain sống thứ hai của `EquipmentBagSection` (missed trong report gốc): `FunctionOverlayPanel.vue:116` mount `EquipmentHallPanel` khi `paperMode === 'equipment_hall'`; `EquipmentHallPanel.vue:15` mount `EquipmentSurface.vue`; `EquipmentSurface.vue:210` `<EquipmentBagSection @open-dissolve="selectWorkspace('dissolve')">` trong `.bag-anchor` :351-357 (container-name `bag-panel`).

Consumer sống thứ ba của `BagPaginationControls` (missed): `DissolveTab.vue:365-373` (trong cùng EquipmentSurface) truyền `:sort-options="[]"` → cluster sort bị ẩn theo `v-if="sortOptions.length"` :160. DissolveTab không nằm trong container `bag-panel` → rule `@container bag-panel` :353 không khớp, rơi về fallback `@media (max-width:480px)` :364.

Dead/dormant còn tồn tại:

- `EquipmentBagPanel.vue` + `BagGrid.vue` — chỉ EquipmentBagPanel import BagGrid và không ai mount EquipmentBagPanel (equipment hall mới dùng EquipmentBagSection trực tiếp). `EquipmentFidelityScene` chỉ nhắc "canonical BagGrid" trong comment — không mount thật.
- `EquipmentBagRail.vue` — rail "compact bag" bên paperdoll, **0 importer** trong `src/` — file chết.
- `PaperPanelNavigation.vue` — mount **chỉ** trong `PaperPreviewSurface.vue` (preview). Report gốc nói nó nằm trong mount chain live là sai; reviewer bổ sung "sống trong SettingsSurface/ImperialScrollScene" cũng sai — `ImperialScrollScene.vue` còn live nhưng chỉ chứa component trong comment, `SettingsSurface` cũng chỉ comment.
- `usePaperNavigation()` composable — **không ai gọi** trong `src/` (chỉ export `PAPER_NAV_IDS` được `ui-preview/paperNavigation.ts` import). NAV rail live thật là `NAV_ITEMS`/`NAV_TARGET` của `DongFuStage.vue` :203-281 (`inventory` → `ui.openLeftPanel`).
- `ImperialScrollScene` vẫn được mount live qua `FunctionOverlayPanel.vue:122` cho `scrollMode`, nhưng `PAPER_MODES` :53-58 chỉ còn stage_select/pill_room/equipment_hall/settings — inventory không đi qua đây nữa.

Entry point: `DongFuStage.vue` NAV_ITEMS :204-209 → `NAV_TARGET.inventory` :233 → `ui.openLeftPanel('inventory')` (ui.ts :226-237 set `activeBagTab='material'`). Đóng: click vùng trống DongFuStage (`onSceneClick` :366-369, bỏ qua khi target khớp `button/a/input/.../[data-df-ui]`), `ui.toggleLeft` / `ui.closeHomeOverlays`.

## 2. UI logic inventory

### MaterialBagSection.vue
- `buildTooltip = createMaterialTooltipBuilder(t)` :37 (→ `GradedItemTooltipContent`, `useMaterialTooltip.ts:86` — **không có** `MaterialTooltipContent`/`craftSourceLabel` như report gốc).
- `searchQuery = ref('')` :174, `v-model` trần vào `Chip-search`/`text-field` :339 — **không debounce**, không `ui.storeQuery.material`.
- `entries` :124 — `useBagFilter(filterInput,{searchQuery,activeGroup})` :183; filter ẩn stack beta qua `betaMaterialStackVisible` :137; sắp xếp qua `MATERIAL_COMPARATORS` :264-276 + `withDirection` (useBagSort.ts); chip nhóm `GROUP_CHIPS` từ `MATERIAL_GROUPS`/`GROUP_LABEL_KEYS` (useBagFilter.ts :15,:252-255); `familyCell`/`familyBadgeLabel`/`representativeMaterial` :187-247 gộp thảo dược cùng family.
- `useBagGridLayout` :95 (ResizeObserver → `calculateBagGridLayout` trong `core/ui/SlotSizes.ts`, `pageSize = columns*rows` :56, `gridStyle` :61-64) → `useBagPagination` :322 pad ô trống tới `pageSize`.
- Không `onClick` trên cell — chỉ tooltip (`v-tooltip` builder). `rarityRankScale:10` :164 (thang Phẩm 10 bậc).
- Chrome: `InkNineSlice chrome-id="text-field"` :337 (search), `"resource-pill"` :358 (count), `tab-seal` trên tab active (Chip role=tab). `:name-segments` :376 **được bind**; `accentVar` :377 tô màu monogram cho danh mục không icon (CATEGORY_ACCENT :49-58).

### PillBagSection.vue
- `nowMs` + `setInterval(1000)` :43-51 — timer sống duy nhất trong scope, feed `activeTimedEffects` :458-495 (đọc `player.$state.persistentTimedEffects`, countdown m:ss, hàng HP/MP regen `.pill-active` :502-510).
- `buildTooltip` :68-185 → `GradedItemTooltipContent` với `slotPreview {icon,label,accessibleLabel,equipmentQualityRank,rarityRank}` :160-168 — cell đan **feed cả hai** `equipmentQualityRank` (professionGradeRank :352-354) **và** `rarityRank` (:356), bind :548-549. Kèm `nameColorVar`/`gradeKey`/`gradeLine`/`ownedCount`.
- `drinkPill` :192-250 → `gameManager.pillOps.usePillDetailed` :222 + notify 'loot'/'warning' :227,:249 (`reasonKeys` map :237-247).
- Uống 2 pha: `armedPillId` :268, `ARM_TIMEOUT_MS=4000` :270, `onPillClick` :283-301 (click 1 arm → click 2 uống), `disarmPill` on unmount :303. Pill `type==='material'` → `onClick:undefined` :368-371 (không uống được, chỉ tooltip). Armed → `state={interaction:'selected'}` :376.
- `SORT_OPTIONS` hardcode tiếng Việt :305-310 ('Phẩm đan','Loại hiệu ứng','Số lượng','Tên'); `PILL_COMPARATORS` :416-426; `GROUP_CHIPS` từ `PILL_EFFECT_GROUPS` + `PILL_EFFECT_GROUP_LABEL_KEYS` (useBagFilter.ts :382,:386; filter group = `pill.effects[0]?.type` :391-398). `entries` :312 lọc `scopeHiddenPillFamilyOfId` :320.
- Chrome: `text-field` :514, `resource-pill` :535; cell `@click="cell?.onClick?.()"` :555. `:name-segments` :547 **được bind**.

### EquipmentBagSection.vue
- Grid tĩnh: `EQUIPMENT_BAG_COLUMNS=8` :25, `MIN_CELLS=40` :26, `gridStyle` **tĩnh** `{--grid-columns:8}` :27-29 — **không** `useBagGridLayout`/ResizeObserver (khác 2 section kia), nên không theo width container.
- `entries` :53-170 chỉ `!instance.equipped`; `state.marker='equipped'` :112-114 (**report gốc nói "không set state" — sai**); `state.comparison` dormant theo comment :105-110.
- `equip` qua `useEquipmentActions` :39-43; `emit('open-dissolve')` :31 (nút 'Hoa Luyen' :302-306).
- `buildEquipmentTooltip` :146-161 (useEquipmentTooltip.ts) + compare pair + `mainStatRangeQuote` (registry miss → không tooltip).
- `equipmentQualityRank=professionGradeRank(instance.grade)` :134 + `rarityRank=itemQualityRank(instance.quality)` :136 — hai trục ấn/quần sáng.
- `GROUP_CHIPS` all/weapon/armor/jewelry :178-183; select `QualityTone` :193-203 (gold≥5/purple≥3/blue≤2); `EQUIPMENT_COMPARATORS` :224-244 (6 mode) nhưng select `sortMode` chỉ 'default'/'quality' :265-268 + :352-355; **`direction` không có control nào** (dead-end UI — `withDirection` vẫn nhận direction asc mặc định).
- `BAG_DISPLAY_CAPACITY=100` :220 — capacity giả (comment :218-219); header `{{visibleCount}}/{{100}}` :295; nút `＋` :296-301 **không @click** (dead affordance).
- `ITEM_SLOT_SRC item-slot-v1.png` :286 → `--equipment-item-slot` :290; `:deep` giấu `.slot-view__frame-art` :457-458; grid `overflow:auto` :442.

### BagPaginationControls.vue
- `v-for page in totalPages` :132-146 render toàn bộ số trang + prev/next — **không** `pageButtons`/jump-to-end (report gốc bịa).
- `divider-ornament` spacer :124; `button-compact` :128,:141,:153,:172; sort btn `v-tooltip` :167; menu `frame-xs-tooltip` :185; đóng bằng document `pointerdown` + Escape :90-104.
- `select('default') → emit('resetSort')` :75-76; `select('direction') → emit('toggleDirection')` :81-82 (ui.store `toggleBagSortDirection` :302).
- 2 comment cũ: :2-3 nói "cả 3 bag-section" (equipment không dùng), :349-350 nói "InventoryPanel declares container-name" (thật ra `.bag-anchor` trên InventorySurface/EquipmentSurface).

### BagGrid.vue (dead)
- Import cả 3 section + TabBar; `BAG_COUNTS` 3 tab gồm equipment :25-39; `bagTabs` :47-51 (computed duy nhất — **không** `sortModeOptions`/`TAB_LABELS`); `TabBar art-id="tab-pill"` :63; mount Equipment/Material/PillBagSection :68-72.

### Tooltip layer (report gốc bỏ sót cả lớp này — interaction duy nhất của cell material)
- `useTooltip.ts` — singleton module-level, `TOOLTIP_HIDE_DELAY_MS=30`, track owner qua `aria-describedby`; `TooltipContent` union + `GradedItemTooltipContent` (slotPreview :100) + `EquipmentTooltipContent` (`compareWith` :157).
- `directives/tooltip.ts` — `vTooltip`, WeakMap binding :25, keyboardModality :32-45, Escape dismiss :85; register `app.directive('tooltip', vTooltip)` main.ts :66.
- `Tooltip.vue` — `#global-tooltip` :152; `InkNineSlice chrome-id="frame-xs-tooltip"` :161 khi `!contained`; `ItemCardBody.vue:58-64` render `SlotView` tĩnh `v-bind="content.slotPreview"`; `itemAuraColor` :130-139; `maxWidthForKind` :66-71.
- Builder: `createMaterialTooltipBuilder` (useMaterialTooltip.ts:86), `buildEquipmentTooltip` (useEquipmentTooltip.ts:94+), builder đan inline trong PillBagSection :68-185.

### Composables/types trong scope
- `useBagSort.ts` — `stableSort` :8, `withDirection` :16, `compareNumber` :25, `compareText` :29 (`localeCompare 'vi'`).
- `useBagGridLayout.ts` — ResizeObserver → `calculateBagGridLayout` :41, `pageSize=columns*rows` :56, `gridStyle` :61-64. Chỉ material/pill dùng.
- `useBagPagination.ts` — currentPage/totalPages/goToPage/resetPage + pad ô.
- `useBagFilter.ts` — export `MATERIAL_GROUPS` :15, `GROUP_LABEL_KEYS` :17, `useBagFilter` :225, `useEntryFilter` :338, `PILL_EFFECT_GROUPS` :382, `PILL_EFFECT_GROUP_LABEL_KEYS` :386; `familyKeyFor` :139 và `badgeFor` :209 là **module-private** (không export — reviewer đúng, report gốc sai).
- `inventory/fidelity/inventoryUi.ts` (8 dòng) — interface `InventoryDisplay` (missed trong report gốc).
- `SlotTypes.ts` — `SlotPresentationState` axes :11-17 (availability/interaction/validation/marker/comparison — **không có `focused`**); `SlotVariant` :41; `SlotPreviewProps` :57-68.
- ui.store: `BagTab` :47, `activeBagTab` :137, `bagSorts` 3 tab :141-145, `setBagSortMode` :286 reset direction asc :299, `toggleBagSortDirection` :302, `resetBagSort` :309, `openLeftPanel` :226.

## 3. Art map

| Surface | Art | Source |
|---|---|---|
| `inventory-paper` (::before) | `paper-surface.png` repeat | `--th-art-paper-surface`, css :278-280 (override ::before vista :254) |
| `inventory-paper` ::after | `border-image: inherit` (paper-nine-slice slice 300 fill, `border-image-width:83px`) | resolveAssetUrl :30 → `data-hk-paper-frame` :37; global set slice `240 320`/w52 :177-180 |
| `inventory-paper` geometry | left 156 / w 1272 / biw 52 | css :25-27 (**missed** — thay scoped l94/1334) |
| `inventory-title` | `--th-art-title-plaque` | :99-103 — nhưng :286-289 set `background:none` → **plaque không vẽ**; chữ còn `color:#30210f` font brush 43px (:137,:289), gradient-clip animation :135-149 cũng bị :288 `background:none` tắt |
| `inventory-landscape` | `--th-art-warm-landscape-header` | :281-285 — **không có DOM trong InventoryFidelityScene** |
| `inventory-branch` | `--th-art-warm-branch-corner` | :347-351 — **không có DOM** |
| `inventory-content` | left 207 / top 210 / 1170×530 | :291-293 (override scoped 234/227/1143×465 :66) |
| `.bag-section__toolbar` | height 43px + border-bottom | :294-296 |
| `.bag-section__toolbar button` | 23px | :299-305 |
| `.bag-section__search` | base sáng `#f5ead4` (mọi scene) :54-55, gradient tối opaque trong inventory | :310-314 — **che hẳn art text-field của InkNineSlice** |
| `.bag-section__filters`/`.chips` | `flex-wrap:nowrap` | :309,:316 (scroll xếp) |
| `.chip` base | màu + `.is-active` outline | :52-53 |
| `.chip > .ink-nine-slice` | `visibility:hidden` | :322 — seal-chip art **chỉ hiện qua tint-var**, frame bị ẩn |
| `.chip.is-active` | gold gradient | :323-326 |
| `.bag-section__count` / `.count` | font-size, `margin-top:8px` | :327,:341 |
| `.bag-pagination` | `min-height:47px` + `border-top` | :328 |
| `.bag-pagination` buttons / pages `.is-active` | gradient tối phẳng / gold | :329-338 |
| `.bag-sort`/`menu button` | min-width 140px / transparent | :339-340 |
| `.slot-view` (mọi scene) | `--slot-bg-image:var(--th-art-slot-frame)` (runtime slot-frame.png) | **:56-59 — missed trong report gốc**: underlay mặc định dưới mọi ô |
| `.inventory-scene .slot-view` | `border-image: var(--th-art-panel-frame-v2) 240 320` + radial bg | :362-365 — double frame (cell 'bag' đã vẽ `frame-s-slot`) |
| `.bag` trong inventory | `overflow:auto` :106 rồi `overflow:visible` :307 | scoped `overflow:hidden` (FidelityScene:83) thua cả hai |
| `.inventory-scene .bag-section` | `gap:9px`, workspace `gap:18px` | :306,:308 |
| `th-panel-swap` | keyframes transition | :373-379 |
| `.scene-viewport` | bg `#15221e` | :10 (overlay mode transparent) |
| `.paper-navigation` | `--th-art-navigation-rail` :14, dark gradient + `panel-frame-v2` border :353-357 | chỉ chạm rail imperial/preview, **không phải rail pc DongFuStage** |
| DongFuStage dưới overlay | `world-vista-warm-v1.png` :191, `navigation-medallion-v1` :196, `navigation-backing-dark-v3` :197, `navigation-landscape-seam-v1` :198 (`v-if surfaceOpen` :471) | backdrop nhìn xuyên qua canvas transparent |
| Tooltip `#global-tooltip` | secondary-ui :30-46 dark + ẩn `.ink-nine-slice`; :128-130 restore `visibility:visible` + `::after` dark `#15221e` + tắt border-image; pc-paper-production :20 `background-image:var(--pc-inspector-art)`; auxiliary :109 `max-width:min(410px,...)` | 3 file CSS chồng lên cùng một tooltip — frame-xs-tooltip hiện **chỉ khi pc skin thua** |
| `ink-nine-slice--hk-frame` | `box-shadow:none` | :85 (kill CSS fallback dưới art 'ready') |
| SlotView internals | `frame-s-slot` chrome chỉ variant 'bag' :255-257; seal `PROFESSION_GRADE_SEAL_ORDINALS` :4,:151; monogram `chu cai dau` :99,:268 (fallback khi icon 404 :103); `showLabel` gate caption :291; hover `--slot-hover-image slot-frame-hover.png` :559; 'item' dùng `inv-slot-backdrop.png` :361, 'equipment' dùng `slot-backdrop.png` :564; `fx-border-beam` aura: cần `rarityRankScale===5` + rank≥3 :165-173, `--active` chỉ tier≥4 :237; `border-color:transparent` variant bag :573 | report gốc nói aura "tier 3-5" — không chính xác |

Art request id còn pending: `tab-pill` (TabBar :63 — vắng mặt trong `huyen-kim-chrome.json`, `TabBar.vue:74-75` vẫn stamp `art-needed` + `data-art-id`). Manifest: mọi chrome-id trong scope (`frame-xs-tooltip`, `frame-s-slot`, `surface-m-panel`, `button-compact`, `seal-chip`, `resource-pill`, `divider-ornament`, `tab-seal`, `text-field`, `navigation-rail` qua --th-art) đều `status:"ready"` — không còn pending nào khác trong scope.

## 4. Conflicts / layers

1. **Pointer-events global nuốt click**: `InventorySurface`/SceneDesignCanvas overlay `pointer-events:none`, nhưng `tien-hiep-ui.css :390-411` bật lại `pointer-events:auto` cho **mọi** con trực tiếp `.inventory-scene > *` — kể cả `.inventory-paper` `aria-hidden` trang trí → giấy trang trí hứng click thay vì rơi xuống DongFuStage backdrop. `@click.self="emit('back')"` (FidelityScene :39) vẫn dead vì scene container itself `pointer-events:none`; dismiss thật sống ở `DongFuStage.onSceneClick` :366-369 (click vùng trống → `closeHomeOverlays`) — nuance của reviewer đúng.
2. **Double frame slot**: variant 'bag' vẽ `frame-s-slot` drawn (SlotView :255) + global `:362-365` đè thêm `panel-frame-v2` border-image + radial — hai khung chồng.
3. **Paper 3 lớp**: scoped `border-image` paper-nine-slice + `::before` vista :254 bị `::before` paper-surface :278-280 đè; `background` vista :179 bị `:253 background:transparent` tắt — `--th-art-world-vista` chết cả 2 chỗ.
4. **Title**: plaque art + gradient-clip animation đều bị `background:none` :288 tắt → còn chữ đen brush.
5. **Search field**: InkNineSlice `text-field` bị CSS opaque dark :310-314 phủ lên → art bị che, nền sáng :54-55 cũng thua.
6. **Chip seal**: `visibility:hidden` :322 — `seal-chip`/`tab-seal` frame art không vẽ, chỉ tint-var còn tác dụng.
7. **Tooltip ba skin**: secondary-ui :30-46 style dark + ẩn slice; :128-130 lại hiện slice + `::after` dark + tắt border-image; pc-paper-production :20 đổi sang `--pc-inspector-art` — kết quả phụ thuộc thứ tự cascade giữa 3 file (main.ts import: theme, huyen-kim.tokens, system-theme, tien-hiep-ui, secondary-ui, auxiliary, pc-paper-production :5-11 — pc-paper-production đứng **cuối** và còn `@import pc-paper-scene.css` :1).
8. **Equipment grid tĩnh vs container**: `bag-anchor` là container `bag-panel`, `BagPaginationControls :353` dùng `@container` — nhưng `gridStyle` tĩnh 8 cột :27-29 không co theo container (không ResizeObserver như material/pill) → tràn/ngắt lộn xộn ở panel hẹp.
9. **Direction dead-end**: `withDirection` tiêu thụ direction, store có `toggleBagSortDirection` :302, `BagPaginationControls` emit `toggleDirection` :81-82 — nhưng EquipmentBagSection không dùng BagPaginationControls (không nút direction nào trong section) và select direction không tồn tại.
10. **`＋` button** :296-301 — render như button 'mở rộng túi' nhưng không `@click`.
11. **Fake capacity** `BAG_DISPLAY_CAPACITY=100` :220 vs store không giới hạn.

## 5. Logic không có hình ảnh

- `comparison` axis trong `SlotPresentationState` (SlotTypes :11-17) + `state.comparison` dormant path (EquipmentBagSection :105-110) — logic so-sánh trang bị có sẵn nhưng chưa render dấu hiệu nào.
- `toggleBagSortDirection`/direction — store + emit path sống nhưng không nút bấm nào trong equipment section (BagPaginationControls chỉ mount ở material/pill + DissolveTab[]).
- `BagGrid`/`EquipmentBagPanel`/`EquipmentBagRail`/`PaperPanelNavigation`/`usePaperNavigation()` — sống trong code, không mount.
- `selectWorkspace('dissolve')` emit path EquipmentBagSection → DissolveTab — cơ chế sống, nhưng UI Trữ Vật (left panel) không hiển thị tab equipment → người chơi không thấy nút 'Hoa Luyen' ở đây.
- `notice`/`query`/`sort`/`use`/`back` emit surface của `InventoryFidelityScene` :25 — cha truyền props tĩnh, không ai lắng các emit này trong production (chỉ InventoryPreview lắng).
- `useDebounce`/`storeQuery`/`getBagComparator`/`MaterialTooltipContent`/`inventoryStacks`/`usePillStack`/`rollCounts`/`isTimedPill`/`alchemy_*_{realm}`/seal 'Đang kích hoạt'/`formatEffectValue`/`effectKind`/`pinyinName`/`pageButtons`/`sortModeOptions`/`focused` state — **không tồn tại** (chi tiết ở Adjudication).

## 6. Hình ảnh không có logic

- `.inventory-landscape` (`warm-landscape-header` :281-285) và `.inventory-branch` (`warm-branch-corner` :347-351) — CSS sẵn, **không có element nào trong InventoryFidelityScene** render chúng.
- `--th-art-world-vista` — gán 2 chỗ (:179,:254) đều bị override chết (§4.3).
- `tab-pill` art-id — stamp `data-art-id` + `art-needed` trên TabBar (dead BagGrid) và chưa có trong manifest.
- `slot-frame-hover.png`/`fx-border-beam` — sẵn; hover beam 'active' chỉ tới tier≥4 (Dia trở lên), tier 3 render ring tĩnh.
- `item-detail` surface trong `InventoryFidelityDetail.vue` — component vẫn tồn tại với dark bg :232 + `border-image-slice:240 320`, nhưng `InventoryFidelityScene` không mount nó (panel chi tiết lẻn vào report gốc — hiện dead).
- Tooltip `frame-xs-tooltip` + `--pc-inspector-art` — cả hai css layer tồn tại cho cùng một box, layer nào thắng phụ thuộc pc skin (§4.7).
- `seal-chip`/`tab-seal` chrome art 'ready' nhưng `visibility:hidden` :322 trong bag — art không bao giờ hiện trên chip túi.

## 7. Open questions

1. `.inventory-landscape`/`.inventory-branch` vắng DOM — chủ đích bỏ cảnh trang trí hay chưa kịp mount? (art warm-* đã ready)
2. Equipment tab trong left-panel inventory normalize về 'material' (InventorySurface :39) — "Trang Bị" chỉ sống trong Equipment Hall; có phải thiết kế cuối?
3. `＋` (BAG_DISPLAY_CAPACITY=100) — có dự định capacity thật hay chỉ placeholder?
4. `PaperPanelNavigation`/`usePaperNavigation`/`BagGrid`/`EquipmentBagPanel`/`EquipmentBagRail`/`InventoryFidelityDetail` — giữ lại cho lane kế tiếp hay dọn?
5. `direction` sort cho equipment — cố tình ẩn hay thiếu control?
6. Tooltip skin cuối: frame-xs-tooltip (huyen-kim) hay `--pc-inspector-art` (pc-paper)? Cascade hiện để pc thắng.
7. Slot 'bag' cần cả `frame-s-slot` drawn lẫn `panel-frame-v2` global (:362-365) không — double frame có phải intent?

## Adjudication

### Wrong (report gốc bịa/sai — accept hết sau khi verify trên code)

| # | Claim report gốc | Thực tế (đã verify) | Verdict |
|---|---|---|---|
| W1 | `useDebounce(250)` + `ui.storeQuery.material` | `searchQuery=ref('')` :174, v-model trần :339; không `useDebounce`/`storeQuery` đâu trong repo | Accept — bịa |
| W2 | `displayMaterials` computed | Tên thật `entries` :124 + `filterInput`/`useBagFilter` :183 | Accept |
| W3 | `getBagComparator` | `MATERIAL_COMPARATORS`/`PILL_COMPARATORS`/`EQUIPMENT_COMPARATORS` + `withDirection` | Accept — bịa |
| W4 | `MaterialTooltipContent` + `craftSourceLabel` | `createMaterialTooltipBuilder` → `GradedItemTooltipContent` (useMaterialTooltip.ts:86) | Accept — bịa |
| W5 | `inventoryStacks`/`activePillNameRefs` | `entries` :312; `activeTimedEffects` :458 đọc `persistentTimedEffects` | Accept — bịa |
| W6 | `usePillStack`/`rollCounts`/`isTimedPill`/`alchemy_*_{realm}`/seal 'Đang kích hoạt'/`formatEffectValue`/`effectKind`/`pinyinName` | Không tồn tại repo-wide; cơ chế thật = `onPillClick` arm 2-pha :283-301, `drinkPill` :222, `pillOps.usePillDetailed` | Accept — bịa |
| W7 | EquipmentBagSection có "nút direction" | Chỉ 2 select :341-357 (QualityTone + sortMode); `direction` không có control | Accept — bịa |
| W8 | BagGrid `sortModeOptions`/`TAB_LABELS` | Chỉ `bagTabs` computed :47-51 | Accept — bịa |
| W9 | `pageButtons`/jump-to-end | `v-for page in totalPages` :132-146 + prev/next | Accept — bịa |
| W10 | `SlotPresentationState.focused` | Axes :11-17 không có focused | Accept — bịa |
| W11 | "sections không set state ngoài armed pill" | EquipmentBagSection set `state.marker='equipped'` :112-114 | Accept — report sai |
| W12 | fx-border-beam "tier 3-5" | Aura cần scale-5 + rank≥3 :165-173; `--active` chỉ tier≥4 :237 | Accept — không chính xác |
| W13 | `:name-segments` không được truyền | Bind ở Material :376, Pill :547; thứ không truyền là `showLabel` | Accept — report sai |
| W14 | sai số dòng (nhiều chỗ) | Đã rebase toàn bộ line cite trong bản final này | Accept |
| W15 | backdrop dismiss hoàn toàn dead | `@click.self` dead (pointer-events) nhưng dismiss sống qua `DongFuStage.onSceneClick` :366-369 | Accept — nuance đúng |

### Missed (report gốc bỏ sót — verify rồi accept)

| # | Item | Verify |
|---|---|---|
| M1 | Tooltip layer nguyên cụm (Tooltip.vue :152/:161, ItemCardBody :58-64, useTooltip, vTooltip main.ts:66, 3 builder) | Có thật — report gốc không nhắc dù tooltip là interaction duy nhất của cell material |
| M2 | Tooltip CSS 3 file (secondary-ui :30-46,:128-130; pc-paper-production :20; auxiliary :109) | Verified — §3/§4.7 |
| M3 | useBagSort.ts / useBagGridLayout.ts / SlotSizes.ts / useBagPagination.ts | Verified — §2 |
| M4 | inventoryUi.ts `InventoryDisplay` | Verified — §2 |
| M5 | SlotTypes.ts axes + `BagCell.selected` | Verified — §2 |
| M6 | tien-hiep-ui.css rules: :25-27 geometry, :52-55 chip/search base, :56-59 slot-frame underlay, :106/:307 overflow, :309/:316 nowrap, :353-357 paper-navigation, :10 viewport bg, :390-411 pointer-events `>` children (nuốt `.inventory-paper`) | Từng dòng đã đọc — §3/§4 |
| M7 | EquipmentHallPanel :11,:15 + FunctionOverlayPanel :116 (equipment_hall) — live chain 2 của EquipmentBagSection | Verified — §1 |
| M8 | DissolveTab :365-373 consumer thứ 3 của BagPaginationControls (`sortOptions=[]`) | Verified — §1 |
| M9 | Comment cũ thứ 2 BagPaginationControls :2-3 | Verified — §2 |
| M10 | DongFuStage :191 world-vista-warm backdrop + art nav :196-198 | Verified — §3 |
| M11 | Pill cells feed `equipmentQualityRank` + `rarityRank` (:352-356, :548-549) | Verified — §2 |
| M12 | EquipmentBagSection grid tĩnh :27-29, không ResizeObserver | Verified — §2/§4.8 |
| M13 | inventoryMessages.ts / inventoryPreviewMessages.ts (2 locale bundle preview) | Verified — inventoryMessages spread remainingMessages + override `panels.bag`, inventoryPreviewMessages chứa namespace `ip.*` cho HomeInventoryArtPanel |
| M14 | ui-landscape-design.html ở `game/` root, không qua previewRoutes | Verified — file nằm ở root, routes chỉ map `/legacy/*.html` |
| M15 | Tests mount: InventorySort.test.ts :12-14 (Material+Equipment+BagGrid) + MaterialBagFilter/PillBagSection(+betaScope.qa)/EquipmentBagSection/useBagGridLayout/useBagSort tests | Verified file tồn tại + import đúng |
| M16 | `familyKeyFor`/`badgeFor` module-private | Verified :139,:209 không export |

### Rejected (reviewer sai)

| # | Claim reviewer | Thực tế | Verdict |
|---|---|---|---|
| R1 | "`PaperPanelNavigation` sống trong SettingsSurface / `ImperialScrollScene` mount it — still live" | `PaperPanelNavigation` mount **chỉ** trong `PaperPreviewSurface.vue` (preview); trong SettingsSurface/ImperialScrollScene chỉ là comment. Report gốc (nói nó trong live mount chain inventory) sai; reviewer (nói nó live trong scroll/settings) cũng sai | Reject |
| R2 | (hàm ý) `usePaperNavigation()` vẫn được scene dùng | Composable **0 caller** trong `src/` — chỉ `PAPER_NAV_IDS` được `ui-preview/paperNavigation.ts` import. NAV live là `NAV_TARGET` riêng của DongFuStage | Reject phần "live", giữ phần "rail exists" |

### Findings mới của chính adjudication (ngoài list reviewer)

- `EquipmentBagRail.vue` — rail trang bị compact cạnh paperdoll, **0 importer** → dead file (liệt kê §1/§5).
- `pc-paper-scene.css` vẫn vào production qua `@import` ở `pc-paper-production.css:1` (đã đối chiếu note của phase tu-si).
- `tien-hiep-collections.css`/`tien-hiep-outcomes.css` — 0 importer trong `src/` + index.html (mồ côi hoàn toàn).
- `ImperialScrollScene` vẫn mount live :122 nhưng chỉ cho `scrollMode` 'exploration' — inventory không còn đi qua shell này.
