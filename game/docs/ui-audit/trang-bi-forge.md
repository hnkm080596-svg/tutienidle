# Panel: Trang Bị — 5 tab op (Khí Đường)

Adjudicated @ `devin/artui-c0-foundation` `8ffc8e64`, trong `game/`. Mọi Missed/Wrong đã được verify lại trên code.

## 1. Mount chain

- **Nav rail / building**: `usePaperNavigation.ts:55` map `equipment -> {kind:'left_panel', mode:'equipment_hall'}`; `navigate()` gọi `ui.openLeftPanel('equipment_hall')` (`usePaperNavigation.ts:128-140`). Đường thứ 2: hotspot/command wheel Động Phủ → `openBuilding('equipment_hall')` (`useBuildingNavigation.ts:137-155`, `DongFuStage.vue:229`) → `buildings.ts:128 functionType:'equipment_hall'` → `openLeftPanel`.
- **Overlay seam**: `FunctionOverlayPanel.vue` (nằm ở `src/components/layout/`): `mode` gate `isBetaLeftPanelMode` (`:69-77`) → `equipment_hall ∈ PAPER_MODES` (`:53-58`) → mount `<EquipmentHallPanel>` trong `Transition th-panel-swap` (`:116`). `equipment_hall` cũng nằm trong `IMPERIAL_MODES` (`:41-47`) nhưng `scrollMode` loại nó ra (`:82-84`) → đường ImperialScrollScene chết cho panel này; legacy `OverlayPanel` (`:158-195`) cũng chết. `TITLE_KEYS.equipment_hall` (`:28`) + `buildingId/header/artBroken` (`:89-100`) chỉ sống trên nhánh scroll/legacy → compute chết trên paper path.
- **Shell**: `EquipmentHallPanel.vue:10-15` — chỉ `import './equipment-hall/qi-hall.css'` + `<EquipmentSurface/>`. Comment `:6-9` khẳng định sheet "must be imported HERE"; guard test `qiHallLayoutOwnership.test.ts:55-100` scan cả `<style>` trong .vue.
- **Surface**: `EquipmentSurface.vue` → `SceneDesignCanvas overlay` (`:151`; canvas fixed-viewport scale + ResizeObserver, `SceneDesignCanvas.vue:7,20-21`) → `EquipmentFidelityScene` (`:152`, `@back=ui.closeHomeOverlays()`):
  - `#doll` → `.equipment-doll` abs 365/215/369×348 (`:158-160,228-234`) → `EquipmentPaperdollStage` → `EquipmentPaperdoll`.
  - `#summary` → `<dl>` vào `.equipment-summary` của scene (`EquipmentFidelityScene.vue:75`).
  - `#tabs` → `nav.equipment-tabs` abs 365/165 (`Surface:175-187`) — 6 nút: `equip` + 5 op.
  - `#workspace` → `section.equipment-workspace` abs 748/215/642×476 (`:189-219`): `<img class="furnace-art">` khi `activeWorkspace!=='equip'` (`:197-203`), `.equipment-workspace__body` chứa `EquipmentBagSection` (`:209-211`) hoặc `Enhance/Wash/Refine/Dissolve/DecomposeTab` (`:212-216`).
- **provide/inject**: `Surface:109` `provide(HALL_SELECTION_KEY, {selectedInstanceId, selectEquipped, clearSelection})`; chỉ `WashTab.vue:34-40` & `RefineTab.vue:36-42` inject (throw nếu thiếu). Enhance chọn theo SLOT; Dissolve/Decompose tự chọn.
- **Backdrop close**: `.equipment-scene` có `pointer-events:auto` (`EquipmentFidelityScene.vue:92`) + `@click.self` (`:54`) → click vùng trống ngoài sheet = `emit('back')` — LIVE.
- **Nhánh preview/dormant**: default slot của `EquipmentFidelityScene` (bag/forge fixture `EquipmentPaperItem`, `ForgeFidelityWorkspace`, `ForgeBatchBag`, `EquipmentPaperTooltip` `:70-85`) — production luôn truyền đủ slot nên nhánh này chỉ sống trong preview. **Preview KHÔNG orphan**: `legacy/ui-equipment.html` load `/src/ui-preview/equipment.ts` → `EquipmentPreview`; `legacy/ui-forge.html` load `/src/ui-preview/forge.ts` → `ForgePreview` (mount `ForgeFidelityScene`, `:5,14`); `previewRoutes.ts:2` map `/legacy/ui-*.html` và 17 file legacy html tồn tại (gồm `ui-dong-fu`). Chỉ 2 link chết thật: `<a href="/ui-equipment.html">` và `/ui-inventory.html` trong `ForgeFidelityScene.vue:10` — root-relative, thiếu `/legacy/`. Lưu ý phụ: `previewRoutes` không có key `forge`/`dong-fu` (15 keys) dù file html tồn tại.

## 2. UI logic inventory

**EquipmentSurface.vue** (`:48-143`): `TABS` 5 id (`:57-63`); `visibleTabs=TABS.filter(isBetaEquipmentTab)` (`:70`, non-reactive, flags tĩnh — `BETA_EQUIPMENT_TABS=['enhance','dissolve']` ở `betaScope.ts:410`); `workspaceModes` = equip + 5 tab với `locked` (`:72-79`); `activeWorkspace` ref `'equip'` (`:81`); `selectWorkspace` từ chối tab locked (`:83-89`); `showFurnaceArt` (`:93`); `selectedInstanceId/selectEquipped/clearSelection` + provide (`:97-109`); `SUMMARY_STATS` 6 glyph (`:111-118`); `summaryRows` đọc `equipmentOps.getEquipmentModifiers()` cộng flat/% (`:125-143`). Dead: `usePlayerStore()` gán `player` không dùng (`:49`).

**EquipmentFidelityScene.vue**: props `sockets/items` default `[]` (`:13-14`) — prod `Surface` KHÔNG truyền → luôn `[]`; `notice/characterImage/preview` (`:15-19`); emits `back` (Esc qua `useDialogFocus:27`, `@click.self :54`), `action` (`:21` — listener duy nhất `EquipmentPreview.vue:32`, prod không ai nghe); preview-only state `inspecting/mode/selected/forgeItem/BAG_COLUMNS/emptyBagCells` (`:29-40`). `BuildingUpgradeButton building-id="equipment_hall"` live (`:65`).

**EquipmentPaperdollStage.vue**: forward `select` (`:13-17`); plinth `art-needed` (`:22-27`).

**EquipmentPaperdoll.vue**: `equippedBySlot` (`:58-68`), `enhanceLevelBySlot` (`:73-83`), `idleProfile/idleClip` (`:88-98`), `nameSegmentsBySlot` (`:126-146`), `tooltipBySlot` (`:151-187`), `qualityRankBySlot` (`:193-203`), `rarityRankBySlot` (`:205-215`), `badgesBySlot` (`:217-227`); `onSlotClick` = `emit('select')` + `cue('ui.equip')` + `unequip` (`:229-235`). Nuance: `.slot-view__seal` + `.slot-view__badge` bị `display:none` trong chính scoped (`:410-412`) → phần output seal/badge của 3 computed trên vô hình; nhưng `qualityAuraTier`/`fx-border-beam` (rank≥4) vẫn render — "compute chạy, hiển thị một phần".

**EquipmentBagSection.vue**: `handleClick` → `equip` (`:41-43` — tương tác chính của grid, draft sót); `entries` lọc `!equipped` (`:53-70` → nhánh `instance.equipped` `:101-114` unreachable); chips `GROUP_CHIPS`/`activeGroup` (`:178-188`); `qualityTone` (`:193-203`); `filtered` (`:205-215`); `visibleCount` đếm FILTERED (`:216`) → nhãn `x/100` co theo filter (sai nhãn, không chỉ cap trưng); `BAG_DISPLAY_CAPACITY=100` (`:219-220`); `EQUIPMENT_COMPARATORS` 6 mode (`:224-244`) — chỉ `default/quality` reachable qua select (`:352-356`); `setBagSortMode('equipment')` chỉ được gọi ở chính file này (`:267`, Material/PillBagSection viết bag riêng) + `direction` không UI nào chỉnh → 4 comparator + direction **unreachable hoàn toàn**; `gridCells` pad 40 (`:272-281`); `＋` không handler (`:296-301`); emit `open-dissolve` (`:31,:305`) — bind ở `Surface:210` nhưng KHÔNG bind ở `BagGrid.vue:68` (mount thứ 2 trong Kho Vật → nút "Hóa Luyện" `:302-306` chết tại đó).

**EnhanceTab.vue**: `enhanceRows` (`:75-123`), `selectedEnhanceSlot` (`:125`), `canEnhance/doEnhance` (`:135-145`), `STAT_GLYPHS` (`:149-156`), `MATERIAL_CATEGORY_ART`+`materialIcon` (`:164-173` — unguarded, xem §4), `levelSealSrc/circleFrameSrc` (`:175-177`), `enhancePreviewRows` (`:209-262`). Comment thối `:66-70` (kể mount chain shell cũ).

**WashTab.vue**: inject hallSelection (`:34-40`); `equippedRows/hallSlotRows/itemRenState` (`:42-46`); `selectedRow` (`:48-50`); `pendingWashTicket`/`pendingWashAffixes` (`:56-60`); `selectHallSlotForAction/discardPendingTicket` (`:62-82`, cleanup `onBeforeUnmount` :82); `washCost` (`:84-88`); `washSpiritStoneCostName` **có guard** `.has()` (`:90-93` — contrast với `materialIcon`); `washSpiritStoneOwned/washEssenceOwned` (`:96-106`); `canWash/doWashPreview/doWashKeep` (`:108-148`); `washAffixCompareRows` (`:203-221`); `washRenAfter` (`:223-225`); `washMaterials` (`:240-255`).

**RefineTab.vue**: giống Wash + `lockedIndices` (`:54`), `pendingRefineValues` (`:56`), `toggleLock` max3/`affix.length` (`:110-123`), `refineCost/refineSpiritStoneCostMaterialId` **động** (`:125-163`, gồm `:137-141`), `canRefine/doRefinePreview/doRefineKeep/doRefineDiscard` (`:165-210`), `pendingRefineByIndex` (`:212-220`), `TIER_COLORS`+`refineRows` fill tube (`:240-276`), `refineMaterials` (`:278-293`). Mount `EquipmentEnergyTube` (`:17,:336`).

**DissolveTab.vue**: `dissolveFilterGrade/Quality` (`:77-94`); `nowTick` (`:98`); `dissolveCandidates` (`:100-180`); `usePanelPagination` (`:188-198` — ResizeObserver trong composable `:41-52` trên `.dissolve-grid` `:338`); `dissolveSelected` Set + watch reconcile (`:200-217`); **watch thứ hai** `:256-258` reset `dissolveConfirming` (draft sót); `toggleDissolve/selectAllDissolveByFilter/clearDissolveSelection` (`:219-242`); `dissolvePreview` (`:244-248`); 2-step `dissolveConfirming` + `doDissolve` (`:250-278`); `BagPaginationControls` (`:365-373`).

**DecomposeTab.vue**: `settingsMirror/capacityMirror/matchingOres` + watch stateVersion (`:34-59`); `applySetting` (`:61-66`); `emptyHintKey` (`:75-81`); `estimate` (`:84-95`); handlers grade/age/workers (`:97-115`).

**Shared/scope files (bổ sung)**: `useEquippedRows.ts` (`useEquippedRows:56`, `useHallSlotRows:140`, `useItemRenState:151`); `hallSelection.ts:15` key; `equipmentHallDisplay.ts` (`tierClass:17-19` → `qi-hall__tier-N`, `affixDisplayLabel:21-27`, `formatAffixValue:34-40`); `useEquipmentTooltip.ts` (`getEquipmentComparisonTone:48`, `buildEquipmentTooltip:95` — LIVE, build tooltip cho doll/bag/dissolve); `useBagSort.ts` (comparator store); test files `equipment-hall/*.test.ts` (5 file) + `tests/architecture/qiHallLayoutOwnership.test.ts`.

**useEquipmentActions.ts**: live flow = `washPreview:125-139` / `washPreviewAffixes:142` / `washDiscard:146-148` / `washCommit:154-155` / `refinePreview:158-172` / `refineCommit:175-176` / `refineDiscard:179` / `dissolve:75-96` / `equip/unequip/enhance`. **`wash()` `:109-110` VÀ `refine()` `:113-114` đều 0 caller** (draft chỉ ghi `wash`).

**Listener/observer/timer live trên panel**: `useDialogFocus` (keydown Esc→back `EquipmentFidelityScene.vue:27`+composable `:37-65`, document `mousedown` preventDefault `:73-79`, focus-trap, cleanup `:80-100`); `usePanelPagination` ResizeObserver (`:41-52`); `SceneDesignCanvas` ResizeObserver (`:7,:20`); `EntitySpriteCanvas` rAF loop (`:125-127` — chạy figure doll liên tục khi panel mở); `EquipmentEnergyTube` CSS animation `equipment-energy-flow` infinite (`:35-37`) mỗi refine row; `.bag-anchor` container contract `container-type:inline-size; container-name:bag-panel` (`Surface:351-357`) — LIVE, `BagPaginationControls` viết cho container này.

## 3. Art map

| Asset (public/assets/) | Element dùng |
|---|---|
| `ui/tien-hiep-2026-10/source/shared-paper-page-v1.png` | `.equipment-sheet` bg — var khai `EquipmentFidelityScene.vue:46`, DOM bind `:55`, rule `:96` |
| `controls/equipment-divider-v1.png` | `.equipment-divider` header img `:47,:56`; `dividerBrush` underline tab active — `Surface:46,:184` |
| `controls/character-card-nine-slice-v2.png` | border-image `.equipment-summary` `:48,:124`, `.equipment-bag`/`.equipment-forge` `:131,:147`; `--equipment-card-art` workspace bg `Surface:44,:192,:252` (var này CÓ consumer) |
| `controls/equipment-circle-frame-v1.png` | **consumer live chính**: `.paperdoll__frame` img trên 6 socket doll (`EquipmentPaperdoll.vue:34,:263`) + hover glow `:374-376` (glow kể cả slot trống); slot strips `circleFrameSrc` — Enhance:177,:284 / Wash:227,:278 / Refine:226,:317; `EquipmentArtSlot` frame; scene `::before` `:49,:116` chỉ thuộc default-slot (nhánh chết prod) |
| `controls/equipment-tab-brush-v1.png` | `--equipment-tab-brush` active states — scene `:50,:137,:153`; prod `Surface:45,:175,:306-316` |
| `huyen-kim/scene/forge-v2/furnace-v1.png` | `.furnace-art` hearth — `Surface:41,:197-203,:260-270`; `ForgeFidelityWorkspace.vue:15` |
| `controls/equipment-brush-circle-v1.png` | `.paperdoll__ring` — `EquipmentPaperdoll.vue:35,:240,:441-451` |
| stable art `equipment-paperdoll-base` | `.paperdoll__base` mannequin fallback — `:30,:254,:318-332` (bị global override — §4) |
| `controls/item-slot-v1.png` | `--equipment-item-slot` bag cell bg — `EquipmentBagSection.vue:286,:450-456` — **đang THUA global rule, không paint** (§4.3a); `EquipmentArtSlot` frame mặc định |
| `controls/equipment-level-seal-v1.png` | level seal `+N»+N+1` — `EnhanceTab.vue:175,:292-298`; `square-art` `EquipmentArtButton` bg (nút khóa Refine:344-355) |
| `controls/resource-essence-v1.png` / `resource-crystal-v1.png` | `MATERIAL_CATEGORY_ART` fallback icon — Enhance:164-167, Wash:229-232, Refine:228-231 |
| `controls/equipment-filter-*-v2.png` (normal/selected/hover/pressed) | `EquipmentArtButton` `::before` states — **url() cứng, KHÔNG qua `resolveAssetUrl`**; prop `filterArt` chỉ sống preview (`EquipmentBagPreview.vue:49,59`) |
| `equipment-energy-tube*` (bg/flow) | `EquipmentEnergyTube` mỗi refine row (RefineTab:336), animation infinite |
| `equipment/items/**` icon | `instance.icon ?? template.icon` — SlotView/slot strips |
| player idle sprite sheet | `.paperdoll__figure` `EntitySpriteCanvas` — `EquipmentPaperdoll.vue:241-253` (rAF live) |
| `--th-art-*` (paper-panel/world-vista/paper-surface) | `tien-hiep-ui.css:115,254,279` — ARMED cho `*-paper` nhưng không DOM nào dùng `equipment-paper` (đổi tên cố ý, `EquipmentFidelityScene.vue:41-45`) |
| `--th-art-slot-frame` (`runtime/slot-frame.png`) | `tien-hiep-ui.css:56-58` phủ lên MỌI `.slot-view` trong panel — xem §4.3a |
| `EquipmentArtCard` | KHÔNG dùng trong scope này — chỉ `BodyPaperDetails.vue` + ui-preview; pattern card inline qua `--equipment-card-art` |

## 4. Conflicts / layers

1. **qi-hall.css gần như chết nhưng vẫn load**: `EquipmentHallPanel.vue:10` import sheet 288 dòng; không template nào dùng `.qi-hall__body/split*/slot-grid/slot/preview-card/col-title/compare-table/compare-arrow/up-arrow/empty/owned/costline/warning/primary-action/info-row/button-row/dissolve/decompose` (tabs dùng `.equipment-forge-workspace` + `.forge-*/.*-slot` riêng). Chỉ `.qi-hall__tier-N` sống qua `tierClass()` (`equipmentHallDisplay.ts:18`). Hai `@container` đều chết: `equipment-ops` (`:276-287`) — không container nào khai tên này; block unnamed `max-width:760px` (`:260-272`) — **điểm chết thật là `.qi-hall__split*` không còn element** (container `overlay-panel` chỉ là vấn đề phụ).
2. **Vi phạm ownership guard**: `qiHallLayoutOwnership.test.ts:55-100` scan `.qi-hall__*` trong cả `<style>` .vue; `WashTab.vue:410-414` + `RefineTab.vue:451-455` tái định nghĩa `.qi-hall__tier-1..5` → 10 violation nếu chạy. Hệ quả visual: sheet `.qi-hall__tier-5` = gradient `background-clip` (`qi-hall.css:232-238`) vs scoped flat `color: var(--affix-tier-5)` — scoped thắng (data-attr boost) → tier-5 render phẳng.
3. **Specificity war với global chrome — LIVE trong panel**:
   a. `tien-hiep-ui.css:56-58` `:is(#app,body) .slot-view {--slot-bg-image: var(--th-art-slot-frame); background-image…}` (specificity 1,0,1): doll socket bị chặn bằng trick `:is(#app) .paperdoll__slot-wrap .paperdoll__slot` (1,2,0) `EquipmentPaperdoll.vue:380-399`; `.dissolve-slot` (`DissolveTab.vue:347`) **không bị chặn** → candidate dissolve vẫn mang nine-slice `slot-frame.png`; **bag cell**: scoped deep `.bag-section__grid :deep(.slot-view--bag)` ghi `--equipment-item-slot` (0,3,0) THUA background-image global (1,1,0) → `item-slot-v1.png` **không paint**, cell thực tế render `slot-frame.png` (reviewer nói đúng rule đụng nhưng sai chiều thắng).
   b. `tien-hiep-ui.css:50-51` `.paperdoll .paperdoll__base` (width:85%, opacity:1, display:flex) (1,2,0) thắng scoped `.paperdoll__base` (`EquipmentPaperdoll.vue:318-332`: width:auto, opacity:.55) — khi `idleClip` vắng, mannequin fallback sáng/sai kích thước so với thiết kế scoped.
   c. `tien-hiep-ui.css:52-53` `.chip`/`.chip.is-active` recolor + outline — hit sống trên chips `EquipmentBagSection.vue:309-318` (`Chip.vue:44,82`).
   d. `tien-hiep-ui.css:165` `.df-building[data-df-building='equipment_hall'] {left:1000px;top:172px}` — plaque Khí Đường trên bàn cờ Động Phủ (`DongFuHomeContent.vue:46`), chrome live trên mount path.
   e. `tien-hiep-secondary-ui.css:85-91,94` — `.dissolve-filters select/.dissolve-filters__bulk` + `.bag-pagination__pages button/.bag-pagination__sort-btn/.bag-pagination__menu` nhận dark-ramp vars + `color:#eddeb6`/`#30291d` — LIVE trên `DissolveTab.vue:289-335` + `BagPaginationControls`. Draft chỉ ghi `:65` chết, sót phần sống.
   f. `tien-hiep-collections.css:120-135,:245-255` selector `.th-collection`/`.pc-collection` × `.equipment-workspace/.equipment-bag/.equipment-forge/.equipment-summary/.equipment-doll` — ARMED nhưng dormant kép: sheet **0 importer toàn repo** (reviewer ghi AuthEntryScreen/AuthInteractivePreview import là SAI — hai file đó import `tien-hiep-entry.css`) VÀ không ancestor `.th-collection`/`pc-collection` nào tồn tại.
   g. `EquipmentPaperdoll.vue:436` `.paperdoll__slot{border-radius:50%}` bị rule `:is(#app)` (1,2,0) ép `border-radius:0` — hit-area vuông dưới ring art tròn.
4. **Dead components/files**: `equipment-hall/EquipmentBagRail.vue` (0 importer); `scenes/equipment/bag/EquipmentBagPanel.vue` (0 importer); `scenes/equipment/detail/EquipmentItemDetail.vue` (0 importer). Sheet census mở rộng: `tien-hiep-forge.css`, `tien-hiep-collections.css`, `tien-hiep-outcomes.css`, `tien-hiep-progression.css`, `pc-paper-auxiliary-production.css` đều **0 importer** (`main.ts:5-11` chỉ load theme/huyen-kim.tokens/system-theme/tien-hiep-ui/secondary/auxiliary/pc-paper-production).
5. **Preview mock trùng vai trò**: `ForgeFidelityScene`/`ForgeFidelityWorkspace`/`ForgeBatchBag` mô phỏng 5 op fake data (`ForgeFidelityWorkspace.vue:12` hardcode `'1.260'→'1.386'`); sống ở default slot `EquipmentFidelityScene:80-83` hoặc `ForgePreview`/`EquipmentPreview` (qua legacy html entries — KHÔNG orphan). `EquipmentPaperItem`/`EquipmentPaperTooltip` cùng nhánh default slot.
6. **Selector global armed không target**: `tien-hiep-ui.css:25` `.equipment-scene .equipment-paper`, `:99,:135,:148,:358` `.equipment-title`, `:179,:253-256` `*-paper` — component đổi tên cố ý; `tien-hiep-secondary-ui.css:65` `.equipment-hall__tabs` chết cùng shell cũ.
7. **Emit lủng**: `emit('action')` không listener prod; `open-dissolve` bind `Surface:210`, không bind `BagGrid.vue:68`.
8. **Doll socket click**: `EquipmentPaperdoll.vue:229-235` unequip + select + `cue('ui.equip')` (cue chơi cho hành động THÁO) — trong Wash/Refine item vừa chọn bị tháo → `selectedRow=null` → tab rơi empty state. Note "pre-existing" `Surface:99-103`.
9. **CSS/var chết trong Surface**: `.equipment-workspace__divider` `:324-331` không element; `.equipment-workspace nav button:focus-visible` `:332-335` unreachable kép (nav là sibling qua slot `#tabs` + scoped last-selector attr không với tới child nav); `:192` gán `--equipment-tab-brush`/`--equipment-divider` không consumer — nhưng `--equipment-card-art` cùng dòng CÓ consumer (`:252`).
10. **Esc kép**: `useDialogFocus` Escape→`back` (`:27`) + `@keydown.esc="inspecting=null"` (`:54`) — prod `inspecting` luôn null.
11. **Comment thối**: `EnhanceTab.vue:66-70` kể chain shell cũ `EquipmentHallPanel v-if="activeTab"`.
12. **Container contract live sót**: `.bag-anchor` `container-name:bag-panel` (`Surface:351-357`) — đối lập `@container equipment-ops` chết (mục 1).
13. **Latent crash**: `materialIcon()` gọi `materialRegistry.get()` KHÔNG guard — `MaterialRegistry.get` throw `'Material not found'` (`MaterialRegistry.ts:18`): `EnhanceTab.vue:169-170`, `WashTab.vue` (materials list ~:233-235), `RefineTab.vue:233-234` + `refineSpiritStoneCostMaterialId` động `:137-141`. Contrast: `washSpiritStoneCostName` (`WashTab:90-93`) và `materialLabel` (`DissolveTab:372`) đều `.has()`-guarded — pattern sống vs pattern crash trong cùng file.
14. **`:deep(*)` box-sizing** (`EquipmentFidelityScene.vue:93`) — re-box mọi descendant gồm 5 op tab, rule live.

## 5. Logic không có hình ảnh

- `EquipmentSurface.vue:49` `player` unused; `:154` `notice=""` cố định → `.equipment-notice` render rỗng (không có rule `:empty` collapse — chỉ `.exploration-details .notice:empty` tồn tại → strip trống ~13px vẫn chiếm chỗ); `visibleTabs` filter 1 lần (`:70`).
- `EquipmentFidelityScene.vue:29-40` preview state compute nhưng inert prod; props `sockets/items` prod luôn `[]` (`:13-14`, Surface không truyền); stamp `equipment-preview` **không render** (`v-if="preview"` :87, prod không truyền — không phải "render rỗng").
- `FunctionOverlayPanel.vue:89-100` `buildingId/header/artBroken` + `:28` `TITLE_KEYS.equipment_hall` — compute/key chết trên paper path (scroll/legacy mới dùng).
- `EquipmentBagSection.vue:101-114` nhánh equipped unreachable; `visibleCount` đếm filtered → nhãn `x/100` sai khi filter (`:216`); 4 comparator + direction unreachable hoàn toàn (`:267` chỉ gọi 'equipment').
- `useEquipmentActions.ts`: `wash()` `:109-110` + `refine()` `:113-114` đều 0 caller.
- `EquipmentPaperdoll.vue`: `badgesBySlot`/`qualityRankBySlot`/`rarityRankBySlot` (`:193-227`) compute mỗi tick nhưng `.slot-view__seal`/`.slot-view__badge` `display:none` (`:410-412`) — chỉ aura/`fx-border-beam` còn lộ.
- `.equipment-workspace__divider` rule không element (`Surface:324-331`); `--equipment-tab-brush`/`--equipment-divider` var trên `:192` không consumer.
- i18n chết `panels.equipmentHall`: `bagRail.*`, `rail.aria`, `scene.*` (file chết), `tooltips.*`, `enhance.pityCounter`, `enhance.guaranteed`, `labels.rowLine`, `labels.costPerUse`, `table.header.stat/before/after`, `aria.washComparison`, `aria.refineComparison` (0 ref sống); `equipment.forgeTitle/bagTabs/sort/filter` chỉ default-slot preview. `labels.levelPrefix` collision là namespace khác (stageSelect).
- 2 link chết `ForgeFidelityScene.vue:10` (`/ui-equipment.html`, `/ui-inventory.html` thiếu `/legacy/`).

## 6. Hình ảnh không có logic

- `EquipmentBagSection.vue:296-301` nút `＋` (`bag-section__icon-btn`, aria "capacity") không `@click` — trưng bày ở CẢ 2 mount; nhãn `x/100` (`visibleCount`/`BAG_DISPLAY_CAPACITY`) cũng là décor (đếm filtered, không cap thật).
- `furnace-art` (`Surface:197-203`) + `equipment-paperdoll-stage__plinth` (`Stage:22-27`, `art-needed`) — trang trí.
- `EquipmentArtSlot` mọi usage prod truyền `empty` → `:disabled` thường trực = icon trang trí (`EnhanceTab.vue:339,:351`, `WashTab.vue:320`, `RefineTab.vue:375`); emit `select` không ai nghe.
- `equipment-level-seal` img (`EnhanceTab.vue:292-298`), `enhance-slot__frame`/`wash-slot__frame`/`refine-slot__frame` ring img — décor trong nút có handler cha; `.paperdoll__frame` circle-frame img + hover glow (`Paperdoll:263,:374-376`) décor trên socket.
- `EquipmentEnergyTube` animation infinite — décor mỗi refine row.
- Default slot fixture: `.bag-tabs` span, `emptyBagCells`, footer sort/filter buttons (`EquipmentFidelityScene.vue:81`) — demo only; `equipment-preview` stamp chỉ preview.
- `.equipment-notice` strip trống vẫn chiếm chỗ trong prod (không `:empty` rule).

## 7. Open questions

1. qi-hall.css: giữ sheet 288 dòng chỉ vì tier-class + guard single-owner, hay xóa vocabulary chết? Tier-5 nên gradient (`qi-hall.css:232-238`) hay flat `--affix-tier-5` (scoped hai tab đang thắng)?
2. Global chrome war: `.dissolve-slot` giữ `slot-frame.png` global là ý đồ? Bag cell `item-slot-v1` đang thua global `slot-frame` (1,1,0 > 0,3,0) — có phải bug render? `.paperdoll__base` fallback cũng bị global override.
3. Doll socket click tháo đồ ngay cả trong Wash/Refine → selection mất luôn + cue 'ui.equip' chơi cho tháo. Ý đồ "pre-existing" (`Surface:100`) hay cần chặn trên op tabs?
4. 3 tab locked (wash/refine/decompose) hiển thị shell disabled — treatment chốt hay tạm chờ flag `BETA_EQUIPMENT_TABS`?
5. Cây preview (`ForgeFidelity*`, `EquipmentPaperItem/Tooltip`, `ForgePreview/EquipmentPreview` + `legacy/ui-*.html` + `tien-hiep-forge.css`/`collections.css`/`outcomes.css`/`progression.css`/`pc-paper-auxiliary-production.css` 0-importer) — xóa hay revive? Fix 2 link chết `ForgeFidelityScene.vue:10`?
6. File chết `EquipmentBagRail.vue`/`EquipmentBagPanel.vue`/`EquipmentItemDetail.vue` — xóa?
7. `wash()` + `refine()` trong `useEquipmentActions` không caller — xóa cả hai export?
8. Nút `＋` capacity + nhãn `x/100` giả — giữ décor hay nối capacity thật (và sửa `visibleCount` đếm filtered)?
9. `EquipmentArtSlot` emit `select` không ai dùng — có kế hoạch interactive?
10. `materialIcon()` unguarded tại 3 tab — registry thiếu material id là crash; guard `.has()` như `materialLabel`/`washSpiritStoneCostName`?

## Adjudication

Verify từng finding trên code @ `8ffc8e64`. Kết quả: **accept 25/25 Missed** (4 cái cần nuance), **accept 6/6 Wrong** (Wrong#5 = xác nhận report đúng, không phải lỗi — chỉ thêm chi tiết). Phát hiện thêm 2 điểm reviewer cũng sót/sai (liệt kê cuối).

### Wrong — chi tiết

| # | Verdict | Ghi chú |
|---|---------|---------|
| 1 | ACCEPT | `legacy/ui-equipment.html` + `ui-forge.html` tồn tại, load `src/ui-preview/equipment.ts`/`forge.ts`; `previewRoutes.ts:2` map `/legacy/ui-*.html` hợp lệ với 17 file html. Preview KHÔNG orphan; chỉ 2 link `<a href>` root-relative trong `ForgeFidelityScene.vue:10` chết (thiếu `/legacy/`). |
| 2 | ACCEPT | `equipment-preview` stamp có `v-if="preview"` (:87) → prod không render (không phải "render rỗng"); `.equipment-notice` thì đúng render rỗng và không có `:empty` rule → chiếm ~13px. |
| 3 | ACCEPT | Block `@container (max-width:760px)` unnamed `:260-272` chết vì `.qi-hall__split*` không còn element — container resolution chỉ là phần phụ. |
| 4 | ACCEPT | `--equipment-card-art` trên `:192` CÓ consumer (`.equipment-workspace` bg `:252`); chỉ `--equipment-tab-brush`/`--equipment-divider` chết. |
| 5 | ACCEPT (non-finding) | Report gốc đã ghi đúng `cue('ui.equip')` cho tháo; reviewer chỉ xác nhận — giữ nguyên, không đếm là lỗi report. |
| 6 | ACCEPT | `.equipment-sheet`: var `:46`, DOM `:55`, rule `:96` — đã sửa art-map. |

### Missed — chi tiết

| # | Verdict | Ghi chú |
|---|---------|---------|
| 1 | ACCEPT | `refine()` `:113-114` = 0 caller, cùng họ `wash()` `:109-110`; đã kiểm tra mọi destructure site. |
| 2 | ACCEPT (nuance) | `badgesBySlot`/`qualityRankBySlot`/`rarityRankBySlot` compute nhưng seal+badge `display:none` `:410-412`; **khác reviewer**: aura `fx-border-beam` (rank≥4) vẫn render — "vô hình" chỉ đúng cho seal/badge. |
| 3 | ACCEPT | `handleClick` `:41-43` → `equip` là tương tác chính của grid; draft sót trong inventory. |
| 4 | ACCEPT | `visibleCount` `:216` đếm `filtered` → nhãn `x/100` co theo chip filter. |
| 5 | ACCEPT (nuance) | 4 comparator + direction unreachable HOÀN TOÀN (không chỉ dormant): `setBagSortMode('equipment')` chỉ gọi ở `:267`. |
| 6 | ACCEPT | Thêm vào inventory: 5 test file tab, `useEquipmentTooltip.ts` (live), `useBagSort.ts`. |
| 7 | ACCEPT | `sockets`/`items` prod luôn `[]` — Surface không truyền; chỉ preview truyền. |
| 8 | ACCEPT | `EquipmentArtCard` preview-only trong scope (còn `BodyPaperDetails.vue` dùng). |
| 9 | ACCEPT | `.paperdoll__frame` circle-frame img `Paperdoll:34,:263` + glow `:374-376` là consumer live chính của asset; scene `:49,:116` là nhánh chết. |
| 10 | ACCEPT | `EquipmentEnergyTube` mount `RefineTab:17,:336`, animation `equipment-energy-flow` infinite `:35-37`; `filterArt` prop chỉ preview. |
| 11 | ACCEPT (nuance) | Global `:is(#app,body) .slot-view` `:56-58` phủ `slot-frame` lên mọi SlotView: doll chặn bằng `:is(#app)` (1,2,0); dissolve-slot không chặn; **bag cell thực tế THUA global** (`item-slot-v1` không paint) — reviewer đúng rule đụng nhưng sai chiều thắng. |
| 12 | ACCEPT | `tien-hiep-ui.css:50-51` `.paperdoll .paperdoll__base` (1,2,0) thắng scoped `:318-332` — fallback mannequin render khác thiết kế. |
| 13 | ACCEPT | `.chip` global `:52-53` recolor chips bag section live. |
| 14 | ACCEPT | `secondary-ui.css:85-91,:94` recolor `.dissolve-filters*` + `.bag-pagination__*` live. |
| 15 | ACCEPT | `tien-hiep-ui.css:165` plaque `[data-df-building='equipment_hall']` live trên mount path. |
| 16 | ACCEPT (nuance) | Selector collections ARMED nhưng dormant kép: sheet **0 importer toàn repo** (reviewer sai khi nói AuthEntryScreen import — file đó import `tien-hiep-entry.css`) + không ancestor `.th-collection`/`pc-collection`. |
| 17 | ACCEPT | `useDialogFocus` keydown `:37-65` + document `mousedown` `:73-79` live. |
| 18 | ACCEPT | `usePanelPagination` ResizeObserver `:41-52` trên `.dissolve-grid` live. |
| 19 | ACCEPT | `SceneDesignCanvas` ResizeObserver `:7,:20` live. |
| 20 | ACCEPT | `EntitySpriteCanvas` rAF loop `:125-127` chạy khi panel mở. |
| 21 | ACCEPT | EnergyTube animation + watch thứ hai `DissolveTab:256-258` reset `dissolveConfirming` — đúng. |
| 22 | ACCEPT | `.bag-anchor` `container-name:bag-panel` `Surface:351-357` = contract live cho `BagPaginationControls`. |
| 23 | ACCEPT | `materialIcon` unguarded `registry.get` (throw `MaterialRegistry.ts:18`) tại EnhanceTab:169-170 / WashTab materials / RefineTab:233-234 + dynamic `:137-141`; đối chứng `washSpiritStoneCostName`/`materialLabel` có `.has()` guard. |
| 24 | ACCEPT | `TITLE_KEYS.equipment_hall` `:28` chết trên paper path. |
| 25 | ACCEPT | `:deep(*){box-sizing:border-box}` `:93` live, re-box mọi descendant. |

### Reviewer cũng sót/sai

- Bag-cell art (`item-slot-v1`) thua global `slot-frame` — Missed#11 ghi đúng phần rule nhưng nói "bag cell bị override --equipment-item-slot" ám chỉ scoped thắng; thực tế global thắng background-image → art intent không render.
- `tien-hiep-collections.css` 0 importer (không phải "chỉ import bởi AuthEntryScreen") — Missed#16.
- `.paperdoll__slot` `border-radius:50%` bị ép `0` bởi chính trick `:is(#app)` — hệ quả specificity-war không ai ghi (§4.3g).
