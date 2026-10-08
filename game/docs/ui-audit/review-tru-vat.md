# Review: Trữ Vật audit (branch devin/artui-c0-foundation @ 8ffc8e64)

## Missed

**Files/surfaces in scope, absent from report:**

- `src/components/scenes/inventory/fidelity/inventoryUi.ts:1-8` — `InventoryDisplay` interface định nghĩa contract props mà §5 phân tích; file không được kể.
- **Lớp tooltip — interaction duy nhất của material cell — hoàn toàn vắng**: `src/components/common/Tooltip.vue:161` (`#global-tooltip` tự wrap trong `InkNineSlice chrome-id="frame-xs-tooltip"` — report gán chrome-id này chỉ cho menu sort `BagPaginationControls.vue:185`); `ItemCardBody.vue:175` render `GradedItemTooltipContent`/`EquipmentTooltipContent` cho `cardContent`; `useTooltip.ts:100,137` (`slotPreview`); `useMaterialTooltip.ts` (`createMaterialTooltipBuilder`, gọi tại MaterialBagSection.vue:37); `useEquipmentTooltip.ts` (`buildEquipmentTooltip` — tooltip của ô trang bị không hề nhắc).
- **CSS tooltip rải 3 file đang được import** (report chỉ audit tien-hiep-ui.css): `tien-hiep-secondary-ui.css:30-46,128-130` (suppression/restore `#global-tooltip`), `pc-paper-production.css:20` (`--pc-inspector-art` bg), `tien-hiep-auxiliary.css:109` (tooltip max-width).
- `src/composables/useBagSort.ts` (`stableSort:8`, `withDirection:16`, `compareNumber:25`, `compareText:29`) và `useBagGridLayout.ts`/`core/ui/SlotSizes.ts` (`calculateBagGridLayout`) — report dùng tên hàm nhưng không kể file chủ.
- `src/components/common/SlotTypes.ts` — `SlotPresentationState` axes; `BagCell.selected` (BagCell.ts:23) sót khỏi field list.

**Global CSS trong tien-hiep-ui.css report không liệt kê:**

- `:25-27` — `:is(#app,body) .inventory-scene .inventory-paper` ghi đè geometry (`left:156px;width:1272px;border-image-width:52px`) — report liệt kê đè title/content nhưng bỏ đè chính tấm giấy.
- `:52-53` — `.inventory-scene .chip` base color + `.is-active` outline.
- `:54-55` — `.bag-section__search` light base (`#f5ead4`…) áp mọi scene; rule dark `:310-314` chỉ scoped inventory.
- `:56-59` — `.slot-view{--slot-bg-image:var(--th-art-slot-frame)}` — **`--th-art-slot-frame` (runtime/slot-frame) là nền mặc định dưới mọi ô**; art-map report không có `slot-frame`.
- `:309,:316` — `.filters`/`.chip` `flex-wrap:nowrap`.
- `:353-357` — `.paper-navigation` dark gradient + `panel-frame-v2` border-image — rail vẫn vẽ dưới overlay trong suốt (report chỉ ghi chung chung "nav medallion art"); cặp với `:10` `.scene-viewport` `#15221e` base.
- `:390-411` — `> *{pointer-events:auto}` re-enable cả `.inventory-paper` decorative div (FidelityScene.vue:40, `aria-hidden`) → giấy nuốt click đáng lẽ xuyên xuống backdrop/rail.

**Live hosts/consumers missed:**

- `src/components/panels/EquipmentHallPanel.vue:11,15` + `FunctionOverlayPanel.vue:116` (`paperMode==='equipment_hall'`, modes `:44,:56,:62`) — chain live thật của EquipmentBagSection là FunctionOverlayPanel→EquipmentHallPanel→EquipmentSurface:209-210. Report nhảy thẳng vào EquipmentSurface, không kể panel/mode.
- `src/components/panels/equipment-hall/DissolveTab.vue` — **consumer live thứ 3 của `BagPaginationControls`** (truyền sortOptions rỗng → sort cluster ẩn). Report chỉ kể 2 consumer.
- `BagPaginationControls.vue:2-3` — stale comment thứ hai ("dùng chung cho cả 3 bag-section" — equipment không có pagination), ngoài `:349-350` report đã flag.
- `PaperPanelNavigation` **không** được DongFuStage mount — nó sống trong SettingsSurface/`ImperialScrollScene` (vẫn live cho 'production'/'exploration' qua FunctionOverlayPanel.vue:51,122). Mount-chain report conflated `usePaperNavigation.ts:46,116-124` với rail pc riêng của DongFuStage (`NAV_TARGET:232`, `navActive:262-274`). Beta admission `betaScopeSurface` (`isBetaLeftPanelMode`, `isBetaStandalonePanel`) không nhắc.
- `ImperialScrollScene.vue` vẫn live — report paraphrase InventoryPanel comment "imperial-scroll shell is retired" thành chết toàn cục; chỉ inventory dùng nó là chết.

**Art/state missed:**

- `DongFuStage.vue:191` — `world-vista-warm` scene background lộ qua overlay canvas trong suốt = backdrop nhìn thấy của Kho Vật; art-map chỉ có `world-vista` (rule chết `:179`/`:253`).
- Pill cells feed **cả** `equipmentQualityRank` (`professionGradeRank` → seal/frame) lẫn `rarityRank` (PillBagSection.vue:352-354 area) — report bỏ trục quality của ô đan.
- EquipmentBagSection static `gridStyle {--grid-columns:8}` (:27-28) — **không** `useBagGridLayout`/ResizeObserver như material/pill; khác biệt cấu trúc không ghi.
- Equipment `direction` state dead-end: footer chỉ 2 select (:341-355), không control nào đổi `ui.bagSorts.equipment.direction` dù `withDirection` consume nó.
- `inventoryMessages.ts`/`inventoryPreviewMessages.ts` — locale bundle riêng của preview lane (inventory.ts:5).
- `ui-landscape-design.html` ở `game/` ROOT (không phải `legacy/`) và **không** nằm trong `previewRoutes.ts` — report ngụ ý nó là route preview chuẩn.
- Test inventory không liệt kê: `InventorySort.test.ts:12-14` mount cả MaterialBagSection + EquipmentBagSection + BagGrid (không chỉ BagGrid); `MaterialBagFilter.test.ts`, `PillBagSection.test.ts` (+ `.betaScope.qa.test.ts`), `EquipmentBagSection.test.ts`, `useBagGridLayout.test.ts`.

## Wrong

**Fabricated symbols/behavior (đọc code không thấy):**

- MaterialBagSection `useDebounce(250)` + restore `ui.storeQuery.material` — **bịa**: `searchQuery=ref('')` :174, v-model trần :339; repo không có debounce/store-query cho bag search.
- `getBagComparator` — không tồn tại; thật là `MATERIAL_COMPARATORS` :264 / `PILL_COMPARATORS` :416-426 / `EQUIPMENT_COMPARATORS`.
- `displayMaterials` — tên thật `entries` :123 + `filterInput` :179 → `useBagFilter` :183.
- `MaterialTooltipContent` + `craftSourceLabel` — không tồn tại; builder trả `GradedItemTooltipContent` (useMaterialTooltip.ts), `craftSourceLabel` vắng repo-wide.
- PillBagSection: `inventoryStacks` (tên thật `entries` :312); `activePillNameRefs` không tồn tại; `usePillStack` (thật `onPillClick` :283-301); `rollCounts` trong GROUP_CHIPS — **bịa** (:402-408 không có); `isTimedPill`/`alchemy_*_{realm}`/seal 'Đang kích hoạt' — **không tồn tại** (UI timed duy nhất là block `.pill-active` hiệu ứng đang chạy :458-470,:502-510); `formatEffectValue`/`effectKind`/`pinyinName` — vắng repo-wide.
- EquipmentBagSection "nút direction" — không tồn tại (:341-355 chỉ 2 select).
- BagGrid `sortModeOptions`/`TAB_LABELS` — không tồn tại (:47-51 chỉ computed `bagTabs`).
- BagPaginationControls `pageButtons`/`jump-to-end` — **bịa**; template `v-for page in totalPages` :132-146 + prev/next, không jump-to-end.
- `BagCell.state.focused` — field không tồn tại trong `SlotPresentationState` (axes: availability/interaction/validation/marker/comparison).
- "sections không set state ngoài armed pill" — sai: EquipmentBagSection set `state.marker='equipped'` :113 (comment :106-110 chỉ nói `comparison` dormant — phần đó đúng).
- `fx-border-beam` "tier 3-5" — imprecise: `fx-border-beam--active` chỉ tier≥4 (SlotView.vue:237); tier 3 render ring tĩnh, aura tier cần scale-5 & rank≥3 (:165-173).
- "nameSegments — sections không truyền" — sai: cả Material :376 lẫn Pill :547 đều bind `:name-segments`; cái không truyền là `showLabel` (gate caption, SlotView.vue:291 — caption ẩn mặc định :742-746).

**Line-number drift (substance đúng, cite lệch):**

- InventorySurface: props `:42`→thật :70-71; `#toolbar :63`→:72; `#count :132`→:98; `BAG_COUNTS :30-36`→:43-52; `selectTab :91`→:64-66; sections `:100-127`→:93-96; container-name `:157`→:156-157.
- FidelityScene: `@click.self :12`→:39; `useDialogFocus :14`→:35 (call site).
- BagPaginationControls: `button-compact :173`→:172.
- LeftPanel: `th-panel-swap :6`→:16.
- DongFuStage: `NAV_ITEMS :206`→:205-209; `NAV_TARGET :233`→:232.
- tien-hiep-ui.css `:344-346` — là `::before inset:2px`, không phải rule paper-surface (paper-surface là :278-280).

**Substance right, framing misleading:**

- Conflict #6: `@click.self` chết đúng, nhưng "chỉ còn Escape" thiếu — click xuyên xuống DongFuStage empty-space close (mục đích của pointer-events fix, comment :388-389) nên backdrop-dismiss vẫn sống qua đường khác.

## Verified-ok

- Mount chain production: DongFuStage NAV_ITEMS/NAV_TARGET/navActive :205-274 ✓; ui.ts `BagTab` :47, `activeBagTab:'material'` :137, `bagSorts` 3 tab :141-146, `openLeftPanel` :226, `toggleLeft` :199, `closeHomeOverlays` :258, `setActiveBagTab` :280, `setBagSortMode` :286, `toggleBagSortDirection` :302, `resetBagSort` :309 ✓; LeftPanel `<Transition name=th-panel-swap>` :16 + `<InventoryPanel v-else-if>` :18 ✓; InventoryPanel fixed inset:0 + pointer-events:none :17-23 + comment imperial-scroll retired ✓; InventorySurface normalize `'equipment'→'material'` :39 ✓, `<SceneDesignCanvas overlay>` + FidelityScene `:items=[]:selected=undefined` :70-71 ✓, slots toolbar/grid/count :72-98, `.bag-anchor` `container-name:bag-panel` :156-157 ✓; FidelityScene props/emits/fallback `filters` :16-27, `paper-nine-slice.png` :30, `.count` :50, scoped geometry :61-66 (dead dưới global) ✓; SceneDesignCanvas overlay → transparent + pointer-events:none :37-42 ✓.
- Preview chain: `legacy/ui-inventory.html` → `ui-preview/inventory.ts` → `InventoryPreview.vue` (preview prop :15, DongFuVista, SceneDesignCanvas non-overlay) + `previewRoutes.ts:2` + `finalPreviewFixtures.ts` ✓; `HomeInventoryArtPanel` qua `LandscapeDesignPreview.vue:9,66` + art `equipment-tab-brush-v1`/`equipment-divider-v1`/`shared-paper-page-v1.png` (:51,:52,:66,:78) ✓.
- Dead chain: `BagGrid.vue` chỉ `EquipmentBagPanel.vue` + test import; `EquipmentBagPanel` zero importers ✓; `TabBar art-id="tab-pill"` :63, `tab-pill` không có trong `huyen-kim-chrome.json` ✓; `BagGrid BAG_COUNTS` nhánh equipment :25-39 ✓; `EquipmentBagPanel` comment no-capacity-model :7-9, `chromeSlice('surface-m-panel')` :15 ✓.
- Manifest: mọi chrome-id trong scope (`frame-xs-tooltip`, `frame-s-slot`, `surface-m-panel`, `button-compact`, `seal-chip`, `resource-pill`, `divider-ornament`, `tab-seal`, `text-field`) = `status:"ready"`; `tab-pill` vắng ✓.
- MaterialBagSection: `createMaterialTooltipBuilder` :37, `SORT_OPTIONS` i18n computed :68, `useBagGridLayout` :95, `useBagFilter` :183, `comparePinned` pin spirit-stone/Linh Thạch :281-288, không onClick ô, `resource-pill` count :358, `BagPaginationControls` :381-390, watch resetPage :327-330 ✓.
- PillBagSection: `nowMs`+`setInterval 1000` :43-51 (**timer live duy nhất** trong scope), `armedPillId` :268 + `ARM_TIMEOUT_MS=4000` :270 + disarm `onUnmounted` :274,:303, two-click `onPillClick` :283-301, `drinkPill`→`pillOps.usePillDetailed` + notification push 'loot'/'warning' :222-249, armed→`{interaction:'selected'}` :376, `SORT_OPTIONS` hardcode tiếng Việt :305-310 (chuỗi verify khớp y hệt), ô pill `type==='material'` không onClick :368-371, `activeTimedEffects` từ `persistentTimedEffects` :458-470 → `.pill-active` rows :502-510, `GROUP_CHIPS` :402-408, `text-field` InkNineSlice :514, `resource-pill` count :535, cells `@click="cell?.onClick?.()"` :555, `.pill-active` dark `var(--ink-800)/var(--jade)` ~:581-582 ✓.
- EquipmentBagSection: `EQUIPMENT_BAG_COLUMNS=8` :25, `MIN_CELLS=40` :26, static grid :27-28 (no search/no pagination) ✓, `BAG_DISPLAY_CAPACITY=100` fake cap :220 + header N/100 :295, nút `＋` không @click :296-301, `emit('open-dissolve')` :302-305 wired ở EquipmentSurface :209-210, `equip` onClick :39, `GROUP_CHIPS` :178, `qualityTone` select :194-201, sortMode chỉ 'default'/'quality' :341-355, `ITEM_SLOT_SRC item-slot-v1.png` :286 + `:deep` giấu `.slot-view__frame-art` :450-458, `overflow:auto` :442, comment `state.comparison` dormant :106-110 ✓.
- BagPaginationControls: `divider-ornament` spacer :124, `button-compact` :128,:141,:153,:172, `frame-xs-tooltip` menu :185, `v-tooltip` sort btn :167, document `pointerdown`+Escape :90-115, `'default'→resetSort` :76, `'direction'→toggleDirection` :82, `@container bag-panel (max-width:420px)` :353 + `@media (max-width:480px)` :364, stale comment container-name :349-350 ✓.
- CSS conflicts §4 phần lớn verify: global `:is(#app,body) .inventory-scene` :286-341 thắng scoped (title 207/154 + background:none :286-289 vs scoped :62; content :291-293 vs :66; toolbar 43px+border-bottom :294-296; buttons 23px :299-305; `.count{margin-top:8px}` :341); `.inventory-scene .chip>.ink-nine-slice{visibility:hidden}` :322 giấu `seal-chip` ✓; search opaque gradient :310-315 phủ `text-field` ✓; paper slice `240 320`/width 52 :177-180 thắng scoped 300/83 :61 ✓; `::before` final = paper-surface :278-280, vista bg :179 chết dưới transparent :253-256 ✓; `.inventory-scene .slot-view` panel-frame-v2+radial :362-365 chồng frame-s-slot+backdrop+border-transparent :571-573 → double/triple frame ✓; `.bag` overflow:visible :306-307 đè cả `auto` :106 lẫn scoped `hidden` :83 ✓; `th-panel-swap` keyframes :373-379 + reduced-motion ✓; `.inventory-landscape`/`.inventory-branch` rules :281-285,:347-351 không DOM ✓; `--th-art-title-plaque` :99-103 bị `background:none` :288 tắt ✓; `.inventory-scene` `pointer-events:none` :390-400 ✓.
- Scoped `border-top … !important` :344 của BagPaginationControls fights global :328 ✓.
- main.ts imports chỉ 6 CSS (:6-11); `tien-hiep-collections.css`/`tien-hiep-outcomes.css` zero importers ✓; `installTienHiepUiAssets` :59; `vTooltip` :66 ✓.
- `useBagFilter.ts` exports: `MATERIAL_GROUPS` :15, `groupLabelKey` :25, `variantRank` :88, `baseNameFor` :128, `useBagFilter` :225, `useEntryFilter` :338, `PILL_EFFECT_GROUPS` :382 ✓ (nhưng `familyKeyFor` :139/`badgeFor` :209 là module-private — report liệt kê như exported API, sai nhỏ).
- Locale: `countSuffix "món"` vi.json:540, `countUnitSuffix "loại"` :541; `equipmentPlaceholder` :560/`equipmentAria` :561 verify unused (EquipmentBagSection dùng `filterAriaEquipment` :309, không input) ✓.
- Chip.vue: `isTab` qua `role==='tab'` :27, chrome `tab-seal`/`seal-chip` layer=frame :51, `AudioManager.getInstance()` cue `ui.tab` :33-37 ✓. SlotView: `variant=bag` → `frame-s-slot` :255-257, seal ordinals :151, backdrops `inv-slot-backdrop.png`/`slot-backdrop.png` :361,:378,:564, `slot-frame-hover.png` :559, monogram fallback :99,:268 ✓.