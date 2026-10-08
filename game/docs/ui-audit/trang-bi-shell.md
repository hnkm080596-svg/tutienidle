# Panel: Trang Bị (Khí Đường) — shell/sheet/tabs

Audit trên `devin/artui-c0-foundation` @ `8ffc8e64`. Scope: shell/sheet/tabs — live path + dormant fallback + legacy còn import/reachable. Chrome global: `src/assets/tien-hiep-ui.css`. Mọi claim có file:line. Bản đã adjudicate (xem `## Adjudication`).

## 1. Mount chain — từ nav/route đến component gốc

**Hai entry LIVE, một entry DORMANT — tất cả hội tụ `ui.leftPanelMode = 'equipment_hall'`:**

- **Rail sản xuất = `DongFuStage.vue` `home-navigation-surface` (KHÔNG phải usePaperNavigation):** `NAV_ITEMS` :205-208 gồm `'equipment'`; `NAV_TARGET.equipment = () => navigation.openBuilding('equipment_hall')` :228-229 (`navigation = useBuildingNavigation()` :49); marker active `equipment: 'equipment_hall'` :250; equipment không nằm trong `NAV_LOCKED` :209 hay `NAV_FEATURE_LOCKED` :215-217.
- **Command wheel**: `renderedSlots = betaWheelSlots().filter(available)` :110; catalog `data/ui/commandWheelCatalog.ts:222-225` (`buildingId:'equipment_hall'`); `SLOT_SYMBOL.equipment_hall='equipment'` :124 → cùng funnel `openBuilding`.
- **`openBuilding('equipment_hall')`**: `useBuildingNavigation.ts:137-155` — `isBetaBuildingSurface` fail-closed :142 (admission `betaScopeSurface.ts` `equipment_hall:null` :77/:112/:157) → `openLeftPanel(template.functionType)` :153. Building def `data/building/buildings.ts:114` (id) + `:128` (`functionType:'equipment_hall'`).
- **DORMANT — `usePaperNavigation.ts`**: importer sống duy nhất `ui-preview/paperNavigation.ts:1` (hit trong `SettingsSurface.vue:4` chỉ là comment). Toàn bộ `PAPER_NAV_IDS` :29-41 / `NAV_TARGETS.equipment→openLeftPanel` :55 / `LEFT_PANEL_NAV_ID` :78-84 / `navigate()` :128-140 là preview-only. Comment :51-54 kể "rail → left_panel, plaque/wheel → openBuilding" — đúng ý đồ nhưng mô tả rail prod sai (prod rail đi QUA openBuilding).
- **DORMANT — plaque `.df-building`**: `DongFuHomeContent.vue` chỉ được mount bởi `fidelity/DongFuFidelityScene.vue` (preview) + test → global pin `tien-hiep-ui.css:165` `.df-building[data-df-building='equipment_hall']` dormant-in-prod.
- **Write trực tiếp** `ui.leftPanelMode` — vẫn qua mount-seam dưới.

**Seam**: `GameRoot.vue:150` mount `FunctionOverlayPanel` thường trực → `mode` :69-77 (chặn `isBetaLeftPanelMode` + loại thêm `'character'`/`'inventory'`) → `paperMode` :79-81 (`PAPER_MODES` :53-58 gồm `equipment_hall`) → `<EquipmentHallPanel v-else-if>` :116 trong `<Transition name="th-panel-swap">` :113.

- `panels/EquipmentHallPanel.vue` — shell 16 dòng: `import './equipment-hall/qi-hall.css'` :10 + `<EquipmentSurface/>` :11,15. Comment :6-9 (tab bodies đọc `.qi-hall__*`) SAI sau reskin (§4.9).
- `scenes/equipment/EquipmentSurface.vue` — `<SceneDesignCanvas overlay>` :151 → `EquipmentFidelityScene` :152 + 4 slot `#doll #summary #tabs #workspace`.
- `SceneDesignCanvas.vue` — viewport `position:fixed;inset:0` :37 (canvas paper nằm trên stacking của DongFu stage, không trong panel DOM flow); `overlay` → transparent + `pointer-events:none` :41-42; ResizeObserver rescale :20-23.
- `fidelity/EquipmentFidelityScene.vue` — sheet chrome + fixture slot-defaults (dormant prod, live preview).
- Preview consumers: `ui-preview/EquipmentPreview.vue` (DongFuVista :7, parallax `--df-x/--df-y` @pointermove, fidelity scene fixture props :32); `ui-preview/ForgePreview.vue:14` → `ForgeFidelityScene` trong PaperPreviewSurface; `ui-preview/equipment/` = `EquipmentBagPreview.vue` (EquipmentArtSlot :69), `EquipmentForgePreview.vue` (:159), `EquipmentPaperdollPreview.vue` (:27), `equipmentPreviewData.ts`; `HomeEquipmentArtPanel.vue:53` → EquipmentPaperdollPreview.
- Test consumers: `EquipmentFidelityScene.test.ts` (mount fixture; prop `navigation:[]` stale :12); `EquipmentHallPanel.test.ts:101` 'fidelity surface: rail tabs + switching'; `betaScopeRenderedTokens.test.ts` pin `isBetaEquipmentTab(`/`visibleTabs` :148-149 + whitelist `equipment-forbidden-tab` BENIGN :176-199; `betaFrontendScopeExposure.test.ts:335` pin EquipmentSurface dùng `isBetaEquipmentTab`.

## 2. UI logic inventory — computed/store-read/emit/directive/props feed DOM

**EquipmentHallPanel** — không logic (import CSS + mount).

**EquipmentSurface.vue**:
- `TABS` :57-63 (5 op id); `visibleTabs` :70 = **plain const** `TABS.filter(isBetaEquipmentTab)` — đánh giá một lần lúc setup, KHÔNG reactive (không phải computed; flag tĩnh per boot nên vô hại, nhưng flip flag runtime sẽ không cập nhật nav). Beta-live `[enhance, dissolve]` (`betaScope.ts:410` `BETA_EQUIPMENT_TABS`; map feature :420-427; `isBetaEquipmentTab` :430-437 fail-closed).
- `workspaceModes` :72-79 — computed trên `visibleTabs` tĩnh; `locked` per op → nav :177-184 (`:aria-pressed` :179, `:disabled` :180, divider img :184).
- `activeWorkspace` :81 + `selectWorkspace` :83-89 — defense-in-depth từ chối id locked.
- `showFurnaceArt` :93 → `v-if` furnace img :197-203.
- `selectedInstanceId`/`selectEquipped`/`clearSelection` :97-107 → `provide(HALL_SELECTION_KEY)` :109. Inject chỉ bởi WashTab :34-40 & RefineTab :36-42 — cả hai scope-hidden trong beta → provide "viết không đọc" (§5).
- `SUMMARY_STATS` :111-118 (6 dòng + glyph); `summaryRows` :125-143 đọc `gameManager.equipmentOps.getEquipmentModifiers()` (`core/game/EquipmentOpsSystem.ts:450`), key `stateVersion` :126 → `#summary` dl :163-170.
- `@back → ui.closeHomeOverlays()` :155. Child emits: PaperdollStage `@select→selectEquipped` :159; EquipmentBagSection `@open-dissolve→selectWorkspace('dissolve')` :210; 5 op tab `v-else-if` :212-216.
- DEAD: `const player = usePlayerStore()` :49 không đọc lại; comment :5 stale (nói summary dùng `player.finalStats`, thực tế equipmentOps).

**EquipmentFidelityScene.vue**:
- props :13-19 (`notice` required; `sockets`/`items`/`characterImage`/`preview` chỉ nuôi dormant slot-defaults; prod truyền `notice=""` :154).
- emits `back`/`action` :21 — `action` unbound trong prod (preview bind ở EquipmentPreview :32).
- `useDialogFocus(rootRef, ()=>true, {onEscape→back})` :27 — card keydown (:65) + `document` mousedown containment (:79) — 2 listener live.
- Dormant state `inspecting`/`mode`/`selected`/`forgeItem`/`modes`/`BAG_COLUMNS`/`emptyBagCells` :29-40 → `EquipmentPaperTooltip v-if="inspecting"` :85.
- `@click.self→back` :54 DEAD dưới global pointer-events:none (§4.1); `@keydown.esc→inspecting=null` dormant.
- `BuildingUpgradeButton building-id="equipment_hall"` :65 — live, cùng `upgradeBuilding` authority với plaque chip.
- Slot-defaults fixture :70-83 (`#doll` sockets grid, `#summary` số cứng '18.200/1.260/840' :75, `#workspace` bag+forge nav 5 mode không beta-gate + `ForgeFidelityWorkspace`/`ForgeBatchBag`).
- `.equipment-notice` `<p role="status">` :87 luôn render rỗng prod.

**EquipmentPaperdoll.vue** (qua `#doll`/`EquipmentPaperdollStage`):
- `SLOT_COLUMNS` :52-55; `equippedBySlot` :58-68; `enhanceLevelBySlot` :73-83; `idleProfile`/`idleClip` :88-98; `itemName/AccessibleLabel/Description/Icon` :104-120; `nameSegmentsBySlot` :126-146; `tooltipBySlot` :151-187; `qualityRankBySlot`/`rarityRankBySlot` :193-215; `badgesBySlot` :217-227 (`+N`).
- `onSlotClick` :229-235: emit select + `cue('ui.equip')` + `unequip()` — click socket = tháo đồ trên MỌI workspace.
- `EntitySpriteCanvas` :241-253 — rAF loop :125-127 (interval sống) chạy idle anim `.paperdoll__figure`; mannequin fallback `.paperdoll__base` img :254.

**EquipmentBagSection.vue** (tab Trang Bị):
- `entries` :53-170 (`filter(!equipped)` :57, compare tooltip :145-162, `onClick→equip` :41-43/:166).
- `activeGroup`+`GROUP_CHIPS`+`toggleGroup` :176-188 → chips :309-318 mount `Chip.vue` (class `.chip`/`.is-active`, `AudioManager` `ui.tab` cue :33-38) — chịu global `.chip.chip` recolor (§4.3).
- `qualityTone`/`QUALITY_TONES`/`toneMatches` :194-203 → select :344-348.
- `filtered` :205-215; `BAG_DISPLAY_CAPACITY=100` :220 display-only (:218-219) → `{{visibleCount}}/100` :295.
- `EQUIPMENT_COMPARATORS` :224-244 — `Record<Exclude<EquipmentSortMode,'default'>, …>` gồm 6 comparator (quality, rarity, realm, slot, name, forge); `cells` :249-262 sort qua `ui.bagSorts.equipment`; `sortMode` :265-268 → select :350-356 chỉ render `'default'` + `'quality'` → **5/6 comparator unreachable** (rarity, realm, slot, name, forge — sửa từ "4/6"; `default` không phải comparator).
- `gridCells` :272-281 pad 40 ô 8×5 :25-29. `'＋'` :296-301 KHÔNG `@click`. `@open-dissolve` :302-306. `ITEM_SLOT_SRC` :286 → `--equipment-item-slot` :290; cell chrome override :447-459.

**Op tabs** (beta-live enhance+dissolve):
- `EnhanceTab.vue` — `useEquippedRows()` :28,:41 **LIVE** (sửa: không dormant) → `enhanceRows` :75-123 đọc `player.$state.realmId` :81 — op tab duy nhất KHÔNG inject `HALL_SELECTION_KEY`, tự chủ slot-state. `selectedEnhanceSlot` :125-133; slot strip :272-288 (circle-frame :284); seal +N→+N+1 `equipmentArt('equipment-level-seal-v1')` :175,:291-300; compare table :304-324; `MATERIAL_CATEGORY_ART` essence/crystal :164-167; `EquipmentArtSlot` non-circular :339,:351-355; `EquipmentArtButton` :364-369.
- `WashTab.vue` — inject `HALL_SELECTION_KEY` :34-40 (throw khi thiếu); `useHallSlotRows` :44; `useItemRenState` :46; `onBeforeUnmount(discardPendingTicket)` :82; `washCost`/owned :84-106; tier redefs `.qi-hall__tier-1..5` :410-414 (§4.9).
- `RefineTab.vue` — inject :36-42; `onBeforeUnmount(clearPendingRefinePreview)` :76; `EquipmentEnergyTube` :336; lock toggle :110-123 (`square-art` button :344-355); `TIER_COLORS` :240; tier redefs :451-455.
- `DissolveTab.vue` — self-contained multi-select (không inject; comment :4): `usePanelPagination(count,80,{columnWidth:72})` :188-198 → `BagPaginationControls v-if="dissolveTotalPages>1"` :365-373 (`:sort-options="[]"` ẩn cụm sort); filters :288-336; `.dissolve-grid` SlotView `class="dissolve-slot"` :346-357 **default variant, không scoped suppress** → global slot-frame paints (§4.12); preview :375-383; `EquipmentArtButton gold` :385-393.
- `DecomposeTab.vue` — `.decompose-tab__*` :119+; `watch(stateVersion)` mirror :51-59.
- Shared: `useEquippedRows.ts` (:56-127 live Enhance; `useHallSlotRows` :140-146, `useItemRenState` :151-175 dormant-by-flag); `equipmentHallDisplay.ts` `tierClass` :17-19 → `qi-hall__tier-N`, `affixDisplayLabel` :21-27, `formatAffixValue` :34-40.

**Live listeners / intervals (mọi lúc panel mở)**:
- `SceneDesignCanvas` ResizeObserver viewport :7,:20-23.
- `usePanelPagination` ResizeObserver :41,:52-59 (watch `containerEl` :47-61; `FALLBACK_ROWS_WHEN_UNMEASURED=6` :86) — live khi DissolveTab mount `BagPaginationControls`.
- `BagPaginationControls` document `pointerdown`+`keydown` :106-116.
- `EntitySpriteCanvas` `requestAnimationFrame` :125-127.
- `useDialogFocus` card `keydown` :65 + `document` `mousedown` :79.
- Chip `ui.tab` cue :33-38; Paperdoll `ui.equip` cue :229-235.

**Dormant/dead (0 importer hoặc preview-only)**:
- `scenes/equipment/bag/EquipmentBagPanel.vue` — 0 importer.
- `scenes/equipment/detail/EquipmentItemDetail.vue` — 0 importer.
- `panels/equipment-hall/EquipmentBagRail.vue` — 0 importer.
- `fidelity/ForgeFidelityScene.vue` — chỉ `ForgePreview.vue:14` + test; `<a href="/ui-equipment.html">` :10; `+12` cứng :10.
- `usePaperNavigation.ts` — 0 production importer (§1).
- `qi-hall.css` — import live, không consumer class ngoài `tierClass()` (§4.9).

## 3. Art map — file art + element dùng

**Cơ chế `--th-art-*` (quan trọng):** các var KHÔNG khai trong CSS tĩnh — `installTienHiepUiAssets` (`src/presentation/assets/TienHiepUiAssets.ts:28`) inject `root.style.setProperty('--th-art-*', url(...))` lúc boot (manifest có `'slot-frame'` :8). Mọi rule dùng `var(--th-art-*)` chỉ resolve sau init; thiếu init (test/preview chưa install) → guaranteed-invalid → fallback/initial.

**Live:**
- `source/shared-paper-page-v1.png` → `.equipment-sheet` bg (FidelityScene :55,:96) + `border:3px double #b28a43`.
- `controls/equipment-divider-v1.png` → heading divider `<img>` (:56,104) + underline tab active (Surface :184,:297-305) + `--equipment-divider` :192 (không consumer — dead var).
- `controls/character-card-nine-slice-v2.png` → `.equipment-workspace` `background:center/100% 100%` STRETCH (Surface :192,:252) VÀ `border-image:…90 fill/15px` trên `.equipment-summary`/dormant `.equipment-bag`/`.equipment-forge` (FidelityScene :124,131,147). Cùng asset, 2 cơ chế (§4.14).
- `controls/equipment-tab-brush-v1.png` → tab active `::before` (Surface :175,:309-316) + dormant `.bag-tabs .active`/forge nav (FidelityScene :137,153).
- `controls/equipment-circle-frame-v1.png` → `<img>` frame socket doll (Paperdoll :34,263,:366-372) + dormant socket `::before` (FidelityScene :116) + Enhance :177,:284 / Wash :278 / Refine :317.
- `controls/equipment-brush-circle-v1.png` → `.paperdoll__ring` (Paperdoll :35,240,:441-451).
- `stableSceneArtUrl('equipment-paperdoll-base','@2x')` → `.paperdoll__base` mannequin prod (Paperdoll :30,254); `@1x` cho `characterImage` trong EquipmentPreview :15 — 2 density cùng asset.
- `controls/item-slot-v1.png` → bag cell bg `--equipment-item-slot` (BagSection :286,290,:450-456) VÀ `EquipmentArtSlot` non-circular (`equipmentArt('item-slot-v1')` :28) — material slots Enhance/Wash/Refine.
- **Pack `equipment-filter-*-v2`** (`EquipmentArtButton.vue` — CTA chính mọi op tab): `::before` → `equipment-filter-normal-v2.png` :33; `.gold` → `equipment-filter-selected-v2.png` :38; hover → `equipment-filter-hover-v2.png` :41; active → `equipment-filter-pressed-v2.png` :49; `.square-art` → `equipment-level-seal-v1.png` :56-60. Consumers: Enhance :364-369, Wash :328-337, Refine :344-355 (square-art lock) + :382-390, Dissolve :385-393.
- `equipment-level-seal-v1` → seal +N→+N+1 (Enhance :175,293-298).
- `controls/resource-essence-v1.png`/`resource-crystal-v1.png` → `MATERIAL_CATEGORY_ART` (Enhance :164-167; cùng pattern Wash/Refine).
- `scene/forge-v2/furnace-v1.png` → `.furnace-art` (Surface :197-203,:260-270, chỉ khi workspace≠equip) + dormant `ForgeFidelityWorkspace` focus-item (:15).
- **`--th-art-slot-frame` → drawn slot-frame trên SlotView chưa suppress**: global `.slot-view{--slot-bg-image:var(--th-art-slot-frame);background-image:var(--slot-bg-image)}` (`tien-hiep-ui.css:56-59`) áp mọi SlotView. Paperdoll suppress (`:is(#app)` trick + ẩn `__frame-art` :380-418); bag grid override bg+ẩn `__frame-art` (:447-459); **`.dissolve-slot` (DissolveTab :346-357) KHÔNG suppress** → runtime `slot-frame.png` paints trên lưới dissolve. (`.slot-view__frame-art` chỉ render `variant==='bag'` :255; dissolve dùng default `'item'` :230 → chỉ bg-image.) Fallback `inv-slot-backdrop.png` khi var chưa resolve (SlotView :360-361,:377-378; `:564` re-set `--slot-bg-image` nhưng thua specificity).
- `BagPaginationControls` chrome (live trong DissolveTab khi >80 items): InkNineSlice `panel-frame-xs-tooltip` + `divider-ornament-v1` + `button-compact-v1` prev/next.
- Idle sprite sheet+atlas → `.paperdoll__figure` `EntitySpriteCanvas` (Paperdoll :241-253).
- Global: `--th-art-navigation-rail` (rail `tien-hiep-ui.css:11-24`); `--th-art-world-vista`/`-paper-surface`/`-panel-frame-v2`/`-title-plaque` — dead với equipment (§4.7/§4.8).

**Dormant-only:** `scene/dong-fu-v2/panel-nine-slice.png` → `.gear-tooltip` border-image (PaperTooltip :5,8,16); `materials/linh_khoang.png`/`linh_moc.png` → ForgeFidelityWorkspace outputs (:15), ForgeBatchBag output (:15). Preview vista: `DongFuVista` + parallax (EquipmentPreview :7,:32).

**Không drawn art:** tab buttons = mực + brush khi active (locked chỉ `opacity:.42` :317-320); `.equipment-heading h1` serif trần :103; `.equipment-summary h2` text.

## 4. Conflicts / layers — 2 phiên bản UI cùng tồn tại

1. **Global `pointer-events` đè scoped root**: `tien-hiep-ui.css:397` `.equipment-scene{none}` + `:408 > *{auto}` thắng scoped `pointer-events:auto` (FidelityScene :92) — fix rail có chủ đích (comment :381-389); `@click.self` :54 dead by design; đóng qua ESC/`useDialogFocus` + `DongFuStage.onSceneClick`.
2. **Global đè LIVE mannequin**: `:is(#app,body) .paperdoll .paperdoll__base` (`tien-hiep-ui.css:50`) set `width:85%;height:92%;opacity:1;display:flex` — thắng scoped `opacity:.55;width:auto` (Paperdoll :318-332). Mannequin fallback (idleClip null :88-98) luôn sáng/full theo global, spec scoped không bao giờ có hiệu lực.
3. **Global recolor chips**: `.chip.chip{,.is-active}{color:#30291d}` :52 + `.chip.is-active{outline:1px solid #9f7838}` :53 — chạm `GROUP_CHIPS` EquipmentBagSection :309-318 (mực tối trên card tối). Op tabs KHÔNG dùng `Chip` → không chạm.
4. **Dead selector `.bag-section__search`** :54-55 — EquipmentBagSection không render search input nào (variant `.inventory-scene .bag-section__search` :310-315 thuộc surface khác).
5. **Global đè `.gear-tooltip`**: `border-image-slice:240 320` :232 + restyle `background:var(--th-art-panel-frame-v2)` :264-266 + `::before{background:#15221e}` :267 + `::after` :268-269 — thắng scoped `360 fill` (PaperTooltip :16). Dormant-in-prod nhưng override thật khi `inspecting` được set.
6. **Dormant `.paperdoll__base .player-portrait__*`/`::before`** :32-33 + `.player-portrait__image` :51 — `.paperdoll__base` là `<img>` trần, không con → rules không target gì.
7. **Ghost `.equipment-paper`**: band cũ `left:156/w:1272` + nine-slice + ::before/::after (`tien-hiep-ui.css:25-27,177-180,253-256,278-280,344-346`) — sheet cố ý đổi tên `.equipment-sheet` (FidelityScene :41-45); reintroduce class → band tái xuất đè sheet.
8. **Ghost `.equipment-title`**: plaque (:99-103) + UTM shimmer (:135-148) + rect (:358-361) — cố ý né bằng cách bỏ class (comment :57-60). Hệ quả: h1 serif trần :103 trong khi scene anh em hưởng shimmer OngDoGia.
9. **`qi-hall.css` dead vocabulary + ownership guard hai chiều**: header (:2-18) + `EquipmentHallPanel.vue:6-9` khẳng định tab đọc `.qi-hall__*` — SAI: không template nào còn `.qi-hall__body/split/slot-grid/compare-table/empty/dissolve/decompose/button-row`. Consumer duy nhất = `qi-hall__tier-N` qua `tierClass()` (equipmentHallDisplay.ts:18) — và Wash/Refine re-define local (WashTab :410-414, RefineTab :451-455). `qiHallLayoutOwnership.test.ts` scan `<style>` mọi `.vue` + `.css` (`definedTokens` :61-76), chỉ cho phép qi-hall.css + `SHELL_TOKENS {'.qi-hall','.qi-hall__tabs'}` trong shell (:34,:79-101) → **local redefs Wash/Refine chính là violations guard này flag** (test scan text nguồn, không thể chạy verify — no node_modules — nhưng mechanism đủ rõ). Divergence: sheet `.qi-hall__tier-5` gradient (:232-238) vs local flat `var(--affix-tier-5)` (WashTab :414).
10. **Container queries dead**: `@container equipment-ops (max-width:560px)` (qi-hall.css :276-288) — không ai declare `container-name:equipment-ops`; `@container (max-width:760px)` unnamed :260-271 — op-tab subtree không có ancestor `container-type` → cũng không bắn trong scope.
11. **`.bag-anchor` `container-name:bag-panel`** (Surface :351-357): consumer `@container bag-panel` duy nhất là `BagPaginationControls.vue:353` — component này được mount bởi **DissolveTab** :365-373, nằm NGOÀI `.bag-anchor` (anchor chỉ bọc workspace equip) → query vẫn không bao giờ bắn trong scope. Kết luận "anchor chết" đứng; reasoning sửa: consumer tồn tại nhưng ở workspace khác. (`InventorySurface.vue:157` declare cùng tên — ngoài scope.)
12. **SlotView chrome: 2 nơi suppress, 1 nơi không**: paperdoll (:380-418) + bag (:447-459) tắt chrome mới; **dissolve grid để nguyên** → runtime slot-frame vẽ trên `.dissolve-slot` (§3). Ba thế hệ chrome xử lý không đồng nhất trên cùng primitive.
13. **Fixture dormant trong live shell**: slot-defaults `#doll` :70-73, `#summary` :75, `#workspace` :80-83 ship trong prod bundle (bag-tabs, sort/filter footer, `.equipment-forge` nav 5 mode không beta-gate + `ForgeFidelityWorkspace`/`ForgeBatchBag`) — chỉ preview/test chạm.
14. **Cùng asset 2 cơ chế**: `character-card-nine-slice-v2` stretch `100% 100%` (Surface :252) vs `border-image …90 fill/15px` (FidelityScene :124,131,147) — stretch méo nếu tỉ lệ khác.
15. **Dead CSS trong EquipmentSurface**: `.equipment-workspace__divider` :324-331 không element; `nav button:focus-visible` :332-335 không `nav` trong workspace; `--equipment-divider` :192 không consumer.
16. **HALL_SELECTION**: provide live :109, `selectedInstanceId` set mỗi click socket (→ Paperdoll :229-235) nhưng beta-live không tab nào inject → state viết mà không đọc.
17. `Transition th-panel-swap` :113 bao 4 paper panel — live, không conflict.
18. **`EquipmentBagPanel`/`EquipmentItemDetail`/`EquipmentBagRail`** — scaffold 0 importer, dead DOM nếu mount.
19. **`.df-building` pin dormant-in-prod**: `tien-hiep-ui.css:165` pin plaque `equipment_hall` — nhưng `.df-building` chỉ render trong `DongFuHomeContent` (preview-only). Rule chiếm chỗ như thể live.

## 5. Logic không có hình ảnh — state/computed không render

- `player` store binding (Surface :49) — không đọc lần nào; comment :5 stale (`player.finalStats` vs thực tế `equipmentOps.getEquipmentModifiers()`).
- `usePaperNavigation` — module dormant (0 prod importer, §1): NAV_TARGETS/navigate/activeId tồn tại mà không chạy trong prod.
- `selectedInstanceId` + provide (§4.16) — viết không đọc trong beta-live.
- `inspecting`/`mode`/`selected`/`forgeItem`/`modes`/`BAG_COLUMNS`/`emptyBagCells` (FidelityScene :29-40) — chỉ nuôi dormant defaults.
- `emit('action')` (:21) — unbound prod. `@keydown.esc="inspecting=null"` (:54) chết cùng `inspecting`.
- `aria-describedby="equipment-tooltip"` (`EquipmentPaperItem.vue:7`) — id chỉ tồn tại khi tooltip mount (không bao giờ trong prod).
- Computeds của `EquipmentBagRail.vue:24-77`, `EquipmentItemDetail.vue:30-113` — file chết.
- **`useEquippedRows` LIVE** (EnhanceTab :28,:41); chỉ `useHallSlotRows`+`useItemRenState` dormant-by-flag (sửa từ bản gốc gộp cả ba).
- `visibleTabs`/`workspaceModes` static-after-setup — không reactive với flag flip runtime.
- Locale keys dead-in-prod (render chỉ trong dormant fixture/preview/file chết): `equipment.bagTabs.*`, `equipment.sort`, `equipment.filter`, `equipment.forgeTitle`, `equipment.navigation`, `equipment.workspace.bag` (chỉ `equip` được dùng :73), `panels.equipmentHall.bagRail.*`, `scene.equip/unequip/equipped/starsAria`, `forge.*`, `equipment.previewStamp`.
- `EQUIPMENT_COMPARATORS` **5/6 entry unreachable** (rarity/realm/slot/name/forge) — select chỉ lộ default/quality (:350-356).

## 6. Hình ảnh không có logic — DOM/art trưng bày unwired

- Nút `'＋'` "Mở rộng túi" (BagSection :296-301): aria-label+title đầy đủ, KHÔNG `@click`.
- `"N/100"` count-capacity (:220,:295): mẫu số fake (bag unbounded — comment :218-219).
- `.equipment-notice` `<p role="status">` render rỗng (FidelityScene :87; prod `notice=""` :154).
- `.equipment-workspace__divider` + `--equipment-divider` — style cho element không tồn tại.
- Locked op tab = chỉ `opacity:.42`+`cursor:default` (:317-320); comment "disabled seal" (:12-15) nhưng không seal/lock art.
- Fixture display-only dormant: `.character-stage`, `.equipment-sockets`, `.bag-tabs`, sort/filter footer, `.empty-bag-cell` (FidelityScene :70-83); số summary cứng `'18.200/1.260/840'` :75; `ForgeFidelityScene` `+12` cứng :10.
- `ForgeFidelityWorkspace` `rows` cứng (:12) `'1.260','840','320','8,5%'`; `ForgeBatchBag` output linh_khoang (:15).
- `BuildingUpgradeButton` :65 — LIVE (không liệt kê): art + logic thật.

## 7. Open questions — cần chủ dự án quyết

1. h1 Trang Bị bỏ qua shimmer UTM OngDoGia của `.equipment-title` global — cố ý hay chưa kịp? (FidelityScene :56-60,:103 vs tien-hiep-ui.css :135-148,:358-361)
2. Workspace card art `background:100% 100%` stretch (Surface :252) — vi phạm luật không méo hình, hay đã duyệt verbatim? Normalize sang border-image như summary?
3. Dead scaffold (`EquipmentBagPanel`/`ItemDetail`/`BagRail`) + `qi-hall.css` dead + dormant fixtures — xóa hay giữ? `betaScopeRenderedTokens.test.ts` sanction fixtures preview-only; ownership test police `.qi-hall__*` cả hai chiều → xóa file = sửa test + gỡ hoặc rename tier redefs.
4. Nút `'＋'` Mở rộng túi không handler — ẩn đi hay làm feature?
5. `"N/100"` denominator fake — bỏ hay giữ?
6. Locked op tab chỉ mờ chữ, không seal — muốn padlock art theo convention?
7. Comment spec paperdoll `380×610` (`EquipmentPaperdollStage.vue:2`) vs live `369×348` (Surface :228-234) — comment cũ hay rect sai?
8. Click socket doll vừa select vừa unequip trên mọi workspace (Surface :99-103 → Paperdoll :229-235) — giữ nguyên cả tab Trang Bị?
9. `EQUIPMENT_COMPARATORS` **5 mode unreachable** (rarity/realm/slot/name/forge) — mở thêm option hay xóa comparator thừa?
10. **MỚI** `.paperdoll .paperdoll__base` global (`opacity:1;width:85%`) đè spec scoped (`opacity:.55`) — giữ override global hay để scoped thắng (sửa global selector)?
11. **MỚI** `usePaperNavigation` + `.df-building` pin :165 dormant-in-prod — dọn khỏi prod css/composable hay giữ cho preview?
12. **MỚI** WashTab/RefineTab local `.qi-hall__tier-N` vi phạm `qiHallLayoutOwnership` guard — nới test (exception tier-N) hay đổi tên class local (vd `.wash-tier-N`)?

## Adjudication

**Missed — chấp nhận (đã tự verify trên code @8ffc8e64):**
- #1 global `.paperdoll__base` đè mannequin — verify `tien-hiep-ui.css:50` vs Paperdoll :318-332; element live khi idleClip null. ACCEPT.
- #2 `.paperdoll__base .player-portrait__*` dormant — base là `<img>` trần; sửa line về :32-33 + :51 (không phải :32-34; :34 là `.cf-person` ngoài scope). ACCEPT (line fix).
- #3 `.chip` recolor — đúng cho `GROUP_CHIPS` EquipmentBagSection (:309-318, Chip.vue :33-38). PARTIAL: phần "chip filters Wash/Refine/Decompose" sai — các tab đó không dùng `Chip` (grep 0 import).
- #4 `.bag-section__search` dead trong scope — ACCEPT.
- #5 `.gear-tooltip` override — ACCEPT; nuance: :232 set slice `240 320`, :264-269 restyle layer (không phải "lần 2" set slice).
- #6 slot-frame trên dissolve slots — ACCEPT phần chính: `.dissolve-slot` không scoped suppress (grep toàn file chỉ có `.dissolve-slot-wrap`/`--grade-mismatch`/`-tick`), global :56-59 áp + `--th-art-slot-frame` resolve runtime (`TienHiepUiAssets.ts:8,28`). **REJECT sub-claim**: `.dissolve-cell`/`var(--th-art-filled-v1)` (~:400) không tồn tại trong code — hallucination.
- #7 filter-*-v2 pack — ACCEPT (`EquipmentArtButton.vue` :33,:38,:41,:49,:56-60).
- #8 `EquipmentArtSlot` → `item-slot-v1` non-circular :28 — ACCEPT.
- #9 DongFuVista + parallax preview — ACCEPT (`EquipmentPreview.vue` :7,:32).
- #10 `@1x` vs `@2x` — ACCEPT (:15 vs Paperdoll :30).
- #11 preview consumers — ACCEPT (BagPreview :69, ForgePreview :159, PaperdollPreview :27, HomeEquipmentArtPanel :53); nuance: PaperdollPreview mount `EquipmentArtSlot`, không phải `EquipmentPaperdoll` như reviewer viết.
- #12 test consumer — ACCEPT (`EquipmentFidelityScene.test.ts` mount + stale `navigation:[]` :12).
- #13 `betaScopeRenderedTokens` pins — ACCEPT (:148-149 signatures; :176-199 whitelist BENIGN).
- #14 `EquipmentHallPanel.test.ts:101` — ACCEPT.
- #15 SceneDesignCanvas ResizeObserver — ACCEPT (:20-23).
- #16 usePanelPagination + BagPaginationControls — ACCEPT (DissolveTab :188-198,:365-373).
- #17 rAF EntitySpriteCanvas — ACCEPT (:125-127).
- #18 useDialogFocus listeners — ACCEPT (keydown :65 + document mousedown :79).
- #19 viewport `position:fixed` — ACCEPT (:37).
- #20 visibleTabs non-reactive — ACCEPT, nuance: nó là plain const (không phải "computed-once"); workspaceModes là computed trên nguồn tĩnh. Flag tĩnh per boot → rủi ro thấp.
- #21 EnhanceTab tự chủ — ACCEPT (`player.$state.realmId` :81; không inject).

**Missed — reject:**
- `.dissolve-cell`/`--th-art-filled-v1` phụ của #6 (không tồn tại).
- "chip filters Wash/Refine/Decompose" phụ của #3 (không tab nào import Chip).

**Wrong — chấp nhận tất cả:**
- #1 comparator count → sửa thành **5/6 unreachable** (rarity/realm/slot/name/forge); §2/§5/§7.9 đã cập nhật.
- #2 `useEquippedRows` live qua EnhanceTab :28,:41 → §2/§5 sửa; chỉ `useHallSlotRows`/`useItemRenState` dormant-by-flag.
- #3 `.bag-anchor` reasoning → sửa §4.11: BagPaginationControls mount trong-scope (DissolveTab) nhưng ngoài anchor.
- #4 path → `core/game/EquipmentOpsSystem.ts:450`.
- #5 line bounds → WashTab :410-414, RefineTab :451-455.
- #6 ownership test hai chiều → §4.9 viết lại; mở rộng: test scan `<style>` .vue nên local redefs bị flag.

**Tìm thêm trong adjudication (cả hai bên bỏ sót):**
- N1 `usePaperNavigation` dormant — rail prod là DongFuStage `NAV_TARGET` :229 → `openBuilding` (không phải `openLeftPanel` trực tiếp).
- N2 `.df-building[equipment_hall]` pin :165 dormant-in-prod (plaque = preview `DongFuHomeContent`).
- N3 `--th-art-*` vars define runtime qua `installTienHiepUiAssets` (`TienHiepUiAssets.ts:28`) — mechanism giải thích vì sao slot-frame vẽ được.
- N4 Wash/Refine local `.qi-hall__tier-N` vi phạm ownership guard (test scan .vue styles) — conflict mới chưa ai nói.
