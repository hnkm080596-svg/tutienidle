# Review: Trang Bị (Khí Đường) — shell/sheet/tabs

Đã đối chiếu code @ `devin/artui-c0-foundation` `8ffc8e64` (đúng commit báo cáo pin). Phần lớn claim verify khớp; bỏ sót tập trung ở global CSS đè live elements, art pack button, live listeners, và preview consumers.

## Missed

### Global chrome (`src/assets/tien-hiep-ui.css`) đè lên LIVE elements — báo cáo chỉ soi ghost rules

1. **`tien-hiep-ui.css:50-51` `.paperdoll .paperdoll__base`** — global `:is(#app,body)` selector (specificity 1,2,0) set `width:85%; height:92%; opacity:1; display:flex` trên mannequin fallback, đè thẳng scoped `EquipmentPaperdoll.vue:318-332` (`opacity:.55`, `width:auto`). Đây là LIVE element mỗi khi `idleClip` null (`EquipmentPaperdoll.vue:88-98,254`) — báo cáo soi `.equipment-paper`/`.equipment-title` ghost nhưng bỏ qua rule global đang tác động thật trên doll.
2. **`tien-hiep-ui.css:32-34` `.paperdoll__base .player-portrait__*`** — suppress legacy portrait chrome bên trong paperdoll base; không còn `.player-portrait__*` nào trong `.paperdoll__base` → dormant global rules (không được kể ở §4).
3. **`tien-hiep-ui.css:52-53` `.chip.chip` + `.chip.chip.is-active`** — global recolor chạm trực tiếp `GROUP_CHIPS` của EquipmentBagSection (:309-318) và chip filters Wash/Refine/Decompose — mực tối trên nền card tối. Báo cáo liệt chips ở logic inventory nhưng không note chrome global chi phối màu/background thật.
4. **`tien-hiep-ui.css:54-55` `.bag-section__search`** — dead selector trong scope (EquipmentBagSection không render search input nào).
5. **`tien-hiep-ui.css:232,264-269` `.gear-tooltip`** — global force `border-image-slice:240 320` (lần 2 tại :264-269), đè scoped `EquipmentPaperTooltip.vue:16` (`360 fill`). Tooltip dormant-in-prod nhưng vẫn là live override nếu `inspecting` được set.
6. **`--th-art-slot-frame` vẽ LIVE trên dissolve slots**: `tien-hiep-ui.css:56-59` `.slot-view { --slot-bg-image: var(--th-art-slot-frame); background-image: var(--slot-bg-image) }` áp cho mọi SlotView. Báo cáo §4.6 chỉ kể 2 nơi suppress (paperdoll :380-413, bag :447-459) — còn `.dissolve-slot` (DissolveTab.vue:347) KHÔNG có scoped override nào (không rule `.dissolve-slot` trong <style>; chỉ `.dissolve-slot-wrap` :462+) → drawn slot frame hiển thị trên lưới dissolve. Art map §3 không kể frame này ở đâu. Tương tự `.dissolve-cell` preview pane dùng `var(--th-art-slot-frame), var(--th-art-filled-v1)` (DissolveTab.vue ~:400).

### Art không được map

7. **Bộ art `equipment-filter-*-v2` của nút CTA chính** — `EquipmentArtButton.vue` `::before` dùng `equipment-filter-normal-v2.png` (:33), `gold` → `equipment-filter-selected-v2.png` (:38), hover → `equipment-filter-hover-v2.png` (:41), active → `equipment-filter-pressed-v2.png` (:47), `square-art` → `equipment-level-seal-v1.png` (~:56-60). Đây là nút action chính của MỌI op tab live (Enhance :364, Wash :328-337, Refine :382-390, Dissolve :385-393) — §3 map `equipment-level-seal-v1` chỉ cho seal ±N, bỏ 4 file filter art hoàn toàn.
8. **`EquipmentArtSlot` non-circular dùng `item-slot-v1`** (components/common/art/EquipmentArtSlot.vue:30) — art map gán `item-slot-v1` cho bag cell (:286,290) nhưng bỏ consumer EquipmentArtSlot trong Enhance/Wash/Refine material slots.
9. **`DongFuVista` + pointer parallax trong preview** — `ui-preview/EquipmentPreview.vue` mount `<DongFuVista/>` + `--df-x/--df-y` parallax (@pointermove :26-30, template :32) — không kể trong §3 khi nói về preview surface.
10. **`characterImage` dùng `equipment-paperdoll-base @1x`** (EquipmentPreview.vue:15) vs prod mannequin `@2x` (EquipmentPaperdoll.vue:30) — 2 density của cùng asset, không note.

### Files/consumers trong scope bị bỏ

11. **`ui-preview/equipment/*` + `HomeEquipmentArtPanel.vue`** — EquipmentBagPreview.vue, EquipmentForgePreview.vue, EquipmentPaperdollPreview.vue (mount EquipmentPaperdoll/EquipmentArtSlot theo grep), HomeEquipmentArtPanel.vue — các preview consumer của fidelity/paperdoll mà §1 chỉ liệt EquipmentPreview:32 + ForgePreview:14.
12. **`EquipmentFidelityScene.test.ts` consumer khác** — ngoài stale prop `navigation:[]` (:12) báo cáo đã bắt, test này cũng là consumer thật của fixture path.
13. **`betaScopeRenderedTokens.test.ts:147-157,178-199`** — architecture test pin `isBetaEquipmentTab(` + `visibleTabs` signatures vào EquipmentSurface và whitelist `equipment-forbidden-tab` như BENIGN ở EquipmentFidelityScene/ForgeFidelityScene/ForgeFidelityWorkspace/ui-preview — trả lời một phần open question §7.3: dormant fixtures được test sanction là preview-only.
14. **`EquipmentHallPanel.test.ts:101`** — live test 'fidelity surface: rail tabs + switching' — báo cáo không enumerate test coverage nào của live shell.

### Live listeners / intervals — báo cáo không có section này dù đề bài yêu cầu

15. **`SceneDesignCanvas.vue:7,20-23`** — ResizeObserver quan sát viewport, rescale canvas khi panel resize (live mọi lúc panel mở).
16. **`usePanelPagination.ts:41,52`** — ResizeObserver trên grid; DissolveTab mount `BagPaginationControls` (:365-373, `v-if='dissolveTotalPages > 1'`) qua `usePanelPagination(...,80,{columnWidth:72})` :188-198 — listener live, component hoàn toàn vắng trong báo cáo (DissolveTab được mô tả chỉ qua filters/grid/preview/button).
17. **`EntitySpriteCanvas.vue:125-127`** — `requestAnimationFrame` loop chạy idle animation của `.paperdoll__figure` — interval sống, không kể.
18. **`useDialogFocus.ts:65,79`** — `keydown` trên card + `document`-level `mousedown` containment — báo cáo nói "Tab containment + ESC" nhưng không kể document listener.

### Khoảng trống logic khác

19. **`SceneDesignCanvas` `overlay` prop also neutralizes `:data-scale` interplay** — minor: `.scene-viewport--overlay` chỉ đổi bg + pointer-events (:41-42); report đúng, nhưng không nói `position:fixed;inset:0` viewport :37 nghĩa là paper canvas nằm trên cùng stacking với DongFu stage chứ không trong panel DOM flow.
20. **`visibleTabs`/`workspaceModes` non-reactive** (EquipmentSurface.vue:70,72-79) — plain computed-once over `isBetaEquipmentTab`; OK vì flag static per boot, nhưng nếu beta flags đổi runtime nav không cập nhật. Báo cáo không flag.
21. **`EnhanceTab` là op tab duy nhất không inject `HALL_SELECTION_KEY`** nhưng vẫn đọc `usePlayerStore`/`player.$state.realmId` (:81) — fine, chỉ đối lập với Wash/Refine; báo cáo đã kể inject của Wash/Refine mà không nói Enhance tự chủ.

## Wrong

1. **`EQUIPMENT_COMPARATORS` unreachable count sai**: §2 và §5 nói "4/6 entry (realm/slot/name/forge)" — thực tế **5/6 unreachable**: select :350-356 chỉ render `default` + `quality`, nên `rarity`, `realm`, `slot`, `name`, `forge` đều không chọn được (EquipmentBagSection.vue:224-244 vs :350-356). Report bỏ `rarity` khỏi danh sách.
2. **`useEquippedRows` KHÔNG dormant**: §5 ghi "`useEquippedRows`/`useHallSlotRows`/`useItemRenState` — chỉ live khi Wash/Refine được admit (dormant-by-flag)". Sai cho `useEquippedRows`: EnhanceTab (beta-live) gọi nó tại `EnhanceTab.vue:28,41` để build `enhanceRows` (:75-123). Chỉ `useHallSlotRows`+`useItemRenState` đúng là dormant-by-flag (Wash :44-46, Refine :36+).
3. **§4.10 "anchor chết" incomplete**: report viết "consumer `@container bag-panel` duy nhất là `BagPaginationControls.vue:353` — EquipmentBagSection KHÔNG mount nó". Đúng là EquipmentBagSection không mount, nhưng **DissolveTab mount** `BagPaginationControls` (:365-373) — chỉ là nó nằm NGOÀI `.bag-anchor` (anchor ở equip tab, :351-357) nên query vẫn không bắn. Kết luận "anchor chết" đúng nhưng lập luận thiếu: consumer có mount trong-scope, ở workspace khác.
4. **`EquipmentOpsSystem.ts` path**: report cite `EquipmentOpsSystem.ts:450` — file thật ở `core/game/EquipmentOpsSystem.ts:450` (không phải `core/equipment/`). Line đúng, path ngụ ý sai nếu đọc như core/equipment/.
5. **Off-by-2 nhỏ**: WashTab local tier redefs thực tế :410-414 (report :408-414); RefineTab :451-455 (report :449-455) — nội dung đúng, chỉ lệch biên.
6. **`qiHallLayoutOwnership.test.ts` mô tả không đầy đủ**: report nói test "bắt shell import, P13 check" — test còn cho phép shell định nghĩa `.qi-hall` + `.qi-hall__tabs` (SHELL_TOKENS :34) và cấm mọi file khác define `.qi-hall__*` (test :79-101) — tức nó police ownership cả hai chiều, không chỉ import wiring. Ảnh hưởng tới open question §7.3 (xóa file cần sửa cả test ownership, không chỉ import check).

## Verified-ok

- **Commit pin**: HEAD = `8ffc8e64` đúng như report.
- **Mount chain**: `GameRoot.vue:150` → `FunctionOverlayPanel.vue` → `mode` :69-77 (`isBetaLeftPanelMode`) → `paperMode` :79-81 (`PAPER_MODES` :53-58) → `<EquipmentHallPanel>` :116 trong `<Transition name="th-panel-swap">` :113 — tất cả đúng.
- **Entry paths**: `usePaperNavigation.ts` `PAPER_NAV_IDS` :29-41 (equipment :38), `NAV_TARGETS.equipment` :55 → `left_panel equipment_hall`, `navigate` :128-140, `activeId` :78-84; `useBuildingNavigation.ts` `openBuilding` :137-155 → `openLeftPanel(template.functionType)` :153; `commandWheelCatalog.ts:222-225`; `buildings.ts:114,128` — đúng.
- **Beta gating**: `betaScope.ts:410` `BETA_EQUIPMENT_TABS=['enhance','dissolve']`; :421-427 feature map; :430-437 `isBetaEquipmentTab` fail-closed; `betaScopeSurface.ts` `equipment_hall:null` ở wheel (:77), building (:112), left-panel (:157) — đúng.
- **Shell**: `EquipmentHallPanel.vue` 16 dòng, import qi-hall.css :10, mount EquipmentSurface :11,15; comment :6-9 đúng là stale (không tab nào đọc `.qi-hall__*` ngoài tier-N).
- **EquipmentSurface**: TABS :57-63, visibleTabs :70, workspaceModes :72-79, activeWorkspace :81, selectWorkspace :83-89, showFurnaceArt :93, selection+provide :97-109, SUMMARY_STATS :111-118, summaryRows :125-143 đọc `equipmentOps.getEquipmentModifiers()` (:127 → `core/game/EquipmentOpsSystem.ts:450`), `const player` dead :49, stale comment :5, overlay :151, notice "" :154, @back :155, tab nav :175-186, workspace vars :192, furnace :197-203, v-else-if tabs :212-216, doll rect 369×348 :228-234, workspace `background:var(--equipment-card-art) center/100% 100%` :242-256, `.furnace-art` :260-270, tabs+brush :274-316, `disabled{opacity:.42}` :317-320, DEAD `.equipment-workspace__divider` :324-331 + `nav button:focus-visible` :332-335, `.bag-anchor container-name:bag-panel` :351-357 — đúng hết.
- **EquipmentFidelityScene**: props :13-19 (notice required), emits back/action :21 (action unbound prod), useDialogFocus :27, dormant state :29-40, `@click.self`+`@keydown.esc` :54 (dead/dormant như report), `.equipment-sheet` :55,:96 + `3px double #b28a43`, h1 serif trần :56,:103 + comment né `.equipment-title` :57-60, BuildingUpgradeButton :65, dormant slot-defaults :70-83, `EquipmentPaperTooltip v-if=inspecting` :85, `.equipment-notice` :87 luôn rỗng prod, scoped `pointer-events:auto` :92 bị global đè — đúng.
- **Staleness**: `EquipmentFidelityScene.test.ts:12` truyền `navigation:[]` — component không còn prop — đúng.
- **EquipmentPaperdoll**: SLOT_COLUMNS :52-55, equippedBySlot :58-68, enhanceLevelBySlot :73-83, idleProfile/idleClip :88-98, item helpers :104-120, nameSegmentsBySlot :126-146, tooltipBySlot :151-187, rank computeds :193-215, badgesBySlot :217-227, onSlotClick :229-235 (emit select + `cue('ui.equip')` + `unequip` mọi workspace), EntitySpriteCanvas :241-253, mannequin `.paperdoll__base` :254,:318-332 (opacity:.55), `:is(#app)` suppression :380-399 + `:deep` hides :400-413, `.paperdoll__ring` :441-451 — đúng.
- **EquipmentPaperdollStage**: comment spec `380 x 610` :2 vs live 369×348 — đúng mismatch; `data-hk-region="paperdoll"` :21; plinth `art-needed`/`data-art-id` :22-27.
- **EquipmentBagSection**: `entries` :53-170 (`filter(!equipped)` :57), handleClick→equip :41-43/:166, chips :176-188, qualityTone :194-203, filtered :205-215, `BAG_DISPLAY_CAPACITY=100` :220 display-only, comparators :224-244, cells :249-262, sortMode :265-268 → select :350-356 (chỉ default+quality), gridCells :272-281 pad 40 ô 8×5 (:25-29), `'＋'` không handler :296-301, `@open-dissolve` :302-306, ITEM_SLOT_SRC :286 → var :290, cell chrome override :447-459 — đúng.
- **Op tabs**: EnhanceTab `enhanceRows` :75-123 / strip :272-288 / seals :291-300 / table :304-324 / materials :331-362 / button :364-369; WashTab inject :34-40 + `onBeforeUnmount(discardPendingTicket)` :82 + washCost :84-106; RefineTab inject :36-42 + `onBeforeUnmount(clearPendingRefinePreview)` :76 + EquipmentEnergyTube :17,:336 + lock :110-123 + TIER_COLORS :240; DissolveTab filters :288-336 / `.dissolve-grid` :338-363 / preview :375-383 / button :385-393; DecomposeTab `.decompose-tab__*` :119+ + `watch(stateVersion)` :51-59 — đúng.
- **Shared helpers**: `useEquippedRows.ts` (:56-127,:140-146,:151-175), `equipmentHallDisplay.ts` `tierClass` :17-19 → `qi-hall__tier-N`, `affixDisplayLabel` :21-27, `formatAffixValue` :34-40 — đúng.
- **qi-hall.css**: `.qi-hall__tier-5` gradient :232-238 vs WashTab flat `var(--affix-tier-5)` :414 — divergence đúng; `@container (max-width:760px)` :260-271 unnamed + `@container equipment-ops` :276-288 — grep xác nhận KHÔNG ai declare `container-name:equipment-ops` → dead query đúng.
- **Ghost/override**: `tien-hiep-ui.css` `.equipment-paper` band :25-27,177-180,253-256,278-280,344-346; `.equipment-title` plaque :99-103 + UTM shimmer :135-148 + rect :358-361; `pointer-events:none` :390-400 (`:397` equipment-scene) + `> *{auto}` :401-411 (`:408`); `.df-building[data-df-building='equipment_hall']` :165; `.slot-view --slot-bg-image` :56-59; `.th-panel-swap` :373-379 — đúng.
- **SceneDesignCanvas**: `overlay` → transparent + pointer-events:none :41-42 — đúng.
- **Dormant 0-importer**: `scenes/equipment/bag/EquipmentBagPanel.vue`, `scenes/equipment/detail/EquipmentItemDetail.vue`, `panels/equipment-hall/EquipmentBagRail.vue` — grep xác nhận 0 import site ngoài chính chúng — đúng.
- **ForgeFidelityScene**: preview-only (ForgePreview.vue:14 mount đúng), `<a href="/ui-equipment.html">` :10, hardcoded `+12` :10 — đúng. ForgeFidelityWorkspace `rows` cứng :12 + furnace :15,19-20; ForgeBatchBag output linh_khoang :15 — đúng.
- **EquipmentPaperItem**: `aria-describedby` conditional :7 — đúng. `EquipmentPaperTooltip` panel-nine-slice :5,:16 — đúng.
- **Locale dead keys**: `equipment.bagTabs` :2245, `equipment.workspace.bag` :2253 (chỉ `equip` :2252 được dùng), `equipment.navigation`/`previewStamp` trong block equipment — đúng dead-in-prod.
- **`ui-preview/EquipmentPreview.vue:32`** mount fidelity với fixture props — đúng.
- **Test contracts**: `betaFrontendScopeExposure.test.ts:335` pin EquipmentSurface dùng `isBetaEquipmentTab` — đúng tồn tại.