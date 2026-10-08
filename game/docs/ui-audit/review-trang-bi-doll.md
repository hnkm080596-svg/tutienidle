# Review: audit Trang Bị — doll/sockets

Audit trên `devin/artui-c0-foundation` (8ffc8e64). Mọi claim đã đối chiếu code thật.

## Missed

1. **`src/assets/tien-hiep-collections.css` — dead stylesheet nguyên file đè lên scope này.** Chứa rule `.th-collection`/`.pc-collection` override `.equipment-doll` (left:200px/top:229px/465×355 ở :117; 96/174/490×410 ở :246), `.equipment-sockets` (:119), `.equipment-subtitle` (:115), `.equipment-upgrade` (:116,:211), `.equipment-summary` (:120-124,:247-249), `.equipment-workspace`/`.equipment-bag`/`.equipment-forge` (:125-136,:250-252), `.equipment-preview`/`.equipment-notice` (:24,:31,:209-210). File KHÔNG được import bởi main.ts (:5-11 chỉ load theme/huyen-kim.tokens/system-theme/tien-hiep-ui/tien-hiep-secondary-ui/tien-hiep-auxiliary/pc-paper-production), không `@import` chain, không element nào mang class `th-collection`/`pc-collection` → hoàn toàn chết, nhưng là mìn: wire nó lên là reskin toàn bộ doll region. Report chỉ audit tien-hiep-ui.css.

2. **`scenes/equipment/bag/EquipmentBagPanel.vue` — dead file thứ ba.** 0 importers kể cả preview (grep toàn src). Mount InkNineSlice `chrome-id="surface-m-panel"` + BagGrid + `data-hk-region="bag-grid"`. Report chỉ liệt kê EquipmentBagRail + EquipmentItemDetail.

3. **`scenes/equipment/fidelity/ForgeFidelityScene.vue` — scene fidelity thứ hai trong scope dir**, mount bởi `ui-preview/ForgePreview.vue` ← `legacy/ui-forge.html` (`ui-preview/forge.ts`). Inventory fixture của report nêu ForgeFidelityWorkspace/ForgeBatchBag nhưng bỏ scene cha này.

4. **`BuildingUpgradeButton` — component LIVE trong scene bị bỏ qua.** `EquipmentFidelityScene.vue:8` import, `:65` mount `<BuildingUpgradeButton building-id="equipment_hall" class="equipment-upgrade">`, pin `.equipment-upgrade` left:1260/top:124 (:106) + `:deep(.building-heading__cost)` (:109). Nó render nút nâng cấp thật trên production surface — không nằm trong report.

5. **`.equipment-subtitle`** — dòng i18n live `t('equipment.subtitle')` tại FidelityScene :62, CSS :105. Không được nhắc.

6. **Live listeners/intervals — report không liệt kê cái nào:**
   - `EntitySpriteCanvas` chạy `requestAnimationFrame` loop vĩnh viễn (:125-127) trong doll mỗi khi `idleClip` resolve (gần như luôn, mortal fallback :89).
   - `SceneDesignCanvas` gắn `ResizeObserver` (:7,:16-21) drive `scale`.
   - `v-tooltip` directive gắn pointerenter/leave/focusin/out/keydown trên mỗi socket (directives/tooltip.ts:91-95) + document listener :40-44.
   - `useDialogFocus` gắn keydown + Tab-trap lên `.equipment-scene` root (FidelityScene:27 → useDialogFocus.ts:38-62).
   - `watch(() => props.icon)` reset icon-fail (SlotView:107-109).

7. **`qi-hall.css` chết toàn bộ — claim của report ngược.** Report nói `.qi-hall__slot-grid` (:59-72) "render bởi Enhance/Wash/Refine qua useEquippedRows (:140-144) — socket list song song". Thực tế: 27 class `qi-hall__*` trong sheet có 0 DOM consumer trong src (grep toàn bộ .vue/.ts); op tabs dùng class scoped riêng (`enhance-slot-strip`/`enhance-slot`, EnhanceTab.vue:272-277). Riêng `qi-hall__tier-N` được emit bởi `tierClass()` (equipmentHallDisplay.ts:18) nhưng mỗi tab tự định nghĩa lại scoped (WashTab.vue:410-414, RefineTab.vue:451-455) → bản global match rồi thua. Sheet chỉ sống nhờ ownership-guard test (EquipmentHallPanel.vue:7). Vẫn có "socket list song song" ở mỗi op tab nhưng CSS gán vào là sai.

8. **Asset plumbing chết/lệch report bỏ qua:**
   - `bag-slot-hover.png` vẫn là default của `--slot-hover-image` (SlotView:532) nhưng mọi variant đều override bằng slot-frame-hover.png (:555-561) → default chết; vẫn preload (AssetBundleCatalog:542). SlotTypes.ts doc cũng stale (ghi item hover = bag-slot-hover).
   - Preload của art chết: `slot-backdrop.png` (:544, variant equipment dead), `inv-slot-backdrop.png` (:541, bị --th-art-slot-frame shadow — xem Wrong #6), `seal-frame.png`/`slot-frame-hover.png` (:543,:545) — report flag variant dead nhưng không nói bundle vẫn warm.
   - `--equipment-divider` var set trên `.equipment-workspace` (Surface:192) chỉ feed rule chết `.equipment-workspace__divider` (:324-331) → var chết theo; report flag rule nhưng không flag var.

9. **Dead family `.equipment-paper` lớn hơn `.equipment-title` report bắt được.** Cùng rename (FidelityScene:43-45 comment nói cố ý đổi class) nhưng report chỉ nêu title; còn sót: :25 (band 156/1272), :177-180 (border-image+bg), :253-256 (::before/::after paint), :278-280 (::before bg), :344-346 (::before inset) — tất cả `:is(.equipment-paper)` chết.

10. **`.equipment-scene` scoped `pointer-events:auto` tự nó là rule chết** (FidelityScene:92 — (0,1,0) thua global (1,1,0) :397). Và global :381-389 *comment giải thích cố ý* (rail-click fix) — report framed như "conflict", thực tế là documented design.

11. **`.equipment-hall__tabs` branch chết** trong tien-hiep-secondary-ui.css:65 (`:is(.tab-bar,.equipment-hall__tabs,.worker-lodge__tabs)`) — không element nào tồn tại.

12. **Global hits lên nửa workspace của scope mà report không ghi:** `.chip`/`.chip.is-active` (tien-hiep-ui.css:52-53) đánh chip filter của EquipmentBagSection; `.bag-section__search` (:54-55); `.ink-nine-slice--hk-frame { box-shadow:none }` (:85) đánh mọi frame-art `slot-view--bag` live (socket đã suppression, BagSection cells thì thật).

13. **Preview siblings sót:** `EquipmentBagPreview.vue` + `EquipmentForgePreview.vue` mount cạnh paperdoll preview (HomeEquipmentArtPanel.vue:55-57) — hai nửa workspace của composition preview.

14. **`useBuildingHeaderState(buildingId)` chạy cho paper mode nhưng header UI không bao giờ mount** trên path equipment_hall (FunctionOverlayPanel:91, header chỉ render trong scroll/legacy :131-149,:170-188) — plumbing chết trên path này. Minor.

## Wrong

1. **`equippedBySlot` đọc `equipmentBag.getAll()` — sai API.** Thực tế `gameManager.equipmentBag.getEquippedInSlot(slot)` per slot (EquipmentPaperdoll.vue:64; method EquipmentBag.ts:157). `getAll` tồn tại (:149) nhưng không dùng ở đây.

2. **`emit('select', {slot, instanceId})` — sai payload.** Emit `instance.instanceId` string trần: declare `select: [instanceId: string]` (:46), emit :231; Stage forward string (:15-17); Surface `selectEquipped(instanceId)` (:99-103).

3. **"Không truyền `icon`" — sai.** `:icon` IS bound (:278) qua `itemIcon()` (:118-120, `instance.icon ?? template.icon`) — helper này report cũng không liệt kê trong inventory.

4. **`v-tooltip` nằm trong danh sách props paperdoll truyền — sai.** Template :264-280 không có v-tooltip; directive nằm TRONG SlotView (:248), feed bởi `:tooltip` prop.

5. **`TABS` 6 entry — sai.** `TABS` (:57-63) chỉ 5 op; `equip` prepend trong `workspaceModes` (:72-79); default 'equip' là `activeWorkspace` (:81) chứ không phải `activeTab` (:89-91) như report ghi.

6. **`useDialogFocus` Escape→emit('back') "(:145-148)" trong EquipmentSurface — sai file.** Nó ở EquipmentFidelityScene.vue:7,:27; Surface chỉ bind `@back="ui.closeHomeOverlays()"` (:155). Report cũng sót Tab-trap + keydown listener (useDialogFocus.ts:38-62).

7. **"`description` prop — nhánh fallback chết" — sai.** `tooltipContent` (SlotView:219-221) fallback `{title: label, description}` mỗi khi `tooltip` undefined — tức MỌI socket trống (label = tên slot → hover hiện tooltip tên slot) và item registry-miss. Fallback live trên surface này.

8. **"`.qi-hall__slot-grid` render bởi op tabs" — sai** (xem Missed #7): sheet chết, tabs dùng class khác.

9. **Line ref hàng loạt trong script section lệch revision cũ.** useEquipmentActions `:22`→thật :6/:42; unequip `:185-188`→:233; buildEquipmentTooltip `:39`→:10/:171; equippedBySlot `:58-62`→:58-68; enhanceLevelBySlot `:64-69`→:73-83; nameSegmentsBySlot `:71-93`→:126-146; tooltipBySlot `:95-117`→:151-187; qualityRankBySlot `:119-137`→:193-203; rarityRankBySlot `:139-158`→:205-215; badgesBySlot `:160-227`→:217-227; idleClip `:88-98`→:91-98. Art map cũng lệch: base `:31,273`→:30,:254; circle-frame `:35,266`→:34,:263; brush-circle `:30,271`→:35,:240; EntitySpriteCanvas `:241-253`→:242-252. Template/CSS refs (:264-280,:380-422,:436,:52-56) thì đúng — pattern như audit trên rev cũ của file.

10. **`badgesBySlot` shape `[{kind:'enhance', level}]` — sai field.** Thật `{kind:'enhance', text:`+${level}`}` (:223); badge render `badge.text` (SlotView:283).

11. **Order `unequip`/`cue` ngược.** Thật: emit → `useAudioStore().cue('ui.equip')` (:232) → `unequip` (:233).

12. **`EquipmentPaperItem 74px` trong fixture socket — sai số.** Item render 64×64 (`:deep(.gear-item)` FidelityScene:117); 74px là grid column (:114) / base `.gear-item` (EquipmentPaperItem:14) bị override.

13. **Specificity "(1,1,0)" cho `.paperdoll__base` global — sai nhỏ.** `:is(#app, body) .paperdoll .paperdoll__base` (tien-hiep-ui.css:50) = (1,2,0). Kết luận đúng.

14. **Hotspot attribution + cite.** `.df-building` button render trong `DongFuHomeContent.vue:45-53` (emit('action') → DongFuStage route), không phải "trong DongFuStage.vue"; pin `left:1000px;top:172px !important` là 1 dòng :165 (block :152-176), report ghi :165-172.

15. **`equipmentArt.ts:5-8` cite cho từng control art — sai nghĩa.** File chỉ là resolver (root :5, fn :6-8); ref thật: EquipmentPaperdoll.vue:34-35, FidelityScene.vue:49-50, EquipmentArtSlot.vue:28.

16. **`inv-slot-backdrop.png` map như bg của bag variant — misleading.** `.slot-view` default `var(--slot-bg-image, url(inv-slot-backdrop))` (:361,:378) nhưng global set `--slot-bg-image: var(--th-art-slot-frame)` cho mọi slot-view (:56-59) → PNG này không bao giờ paint; bg thật của bag cells là runtime/slot-frame.png (socket bị `none`).

## Verified-ok

- **Mount chain:** 4 đường vào đúng — rail `openBuilding('equipment_hall')` (DongFuStage.vue:229), wheel ring-3 `buildingId` (commandWheelCatalog.ts:221-227) qua `activateSlot`→`openBuilding` (DongFuStage.vue:335), hotspot `.df-building` (DongFuHomeContent.vue:45-53), paper nav `equipment`→left_panel (usePaperNavigation.ts:55,136-141). Beta gates `isBetaBuildingSurface` (useBuildingNavigation.ts:137-153) + `isBetaLeftPanelMode` (betaScopeSurface.ts:169; `equipment_hall: null` :157); store ui.ts:123, openLeftPanel :226-241; GameRoot.vue:150 → FunctionOverlayPanel PAPER_MODES :53-58, mount :116, `.th-panel-swap` CSS :373-379; EquipmentHallPanel :10-15 load qi-hall.css + mount Surface; buildings.ts:114/:128 functionType 'equipment_hall'.
- **Suppression socket:** `:is(#app) .paperdoll__slot-wrap .paperdoll__slot` :380-399 vs global slot-view :56-59 — cơ chế specificity đúng; `:deep` display:none frame-art/hover-frame/seal/badge :400-413; icon-wrap inset:20% :416-418; `.paperdoll__slot{border-radius:50%}` :436 chết (bị border-radius:0 :388); comment :432-435 mâu thuẫn thật (hover-frame đã ẩn).
- **SlotView machinery:** props :26-91; 'bag' InkNineSlice :254-259; seal :263/:598-622; badge :282-284/:709-714; max-rank ::before :391-399; ::after tint :405-412; aura :165-173/:496-512; hover art chung :528-561; v-tooltip :248. `variant='equipment'` 0 importers → dead (SlotTypes doc :27-30 đúng như report trích). `showLabel` không truyền → nameSegments không render (:291-300) — đúng.
- **Global đè scoped:** `.paperdoll .paperdoll__base` :50 thắng scoped :318-332 (mannequin fallback 85%/opacity 1); `.paperdoll__base .player-portrait__*` :51+:32-33 chết (img lá); `.equipment-title` chết :99-103,:135-148,:358-361; `.equipment-workspace__divider` :324-331 chết; `.equipment-workspace nav button:focus-visible` :332-335 chết (nav bag-section__chips BagSection:309 tồn tại nhưng scoped selector không tới được child-component elements — kết luận đúng dù lý do report nói hơi nông); pointer-events :397-411 giết `@click.self` :54 (đúng, và là chủ đích theo comment :381-389); `@keydown.esc` :54 chết vì inspecting chỉ set ở fixture path; `.equipment-notice` rỗng :87 + `notice=""` Surface:154.
- **Hành vi:** click socket emit select + cue + unequip mọi tab (:229-235); select→HALL_SELECTION provide :109, consumer duy nhất WashTab:34-37/RefineTab:36 (Enhance tự quản :4-5, Dissolve :4) — đúng; tooltip equipped-only không compareWith :170-183 + pinned test EquipmentPaperdoll.test.ts:99-123; enhance gắn slot `getSlotState` :79 + EquipmentSlotState.ts interface; `bumpState` destructure không dùng :41; spec 380×610 (Stage:2, asset StableSceneArt:185 380×610) vs mount 369×348 (Surface:230-233) — Q6 hợp lệ; stage Chien LUC absent :8-10; plinth art-needed :44-59.
- **Art map lõi:** paperdoll-base@2x (StableSceneArt:183-186, preload AssetBundleCatalog:778-780, dùng :30/:254), circle-frame (:34/:263 + fixture ::before FidelityScene:116 + ArtSlot:28), brush-circle (:35/:240), idle atlas (:91-98/:242-252 + CombatPresentationCatalogue:713/791), shared-paper-page (:46/:55), divider (:47/:56), nine-slice-v2 (--equipment-card-art Surface:44,:192,:252 + summary border-image FidelityScene:124), tab-brush (:45/:175,:314), furnace (:41/:197-203), --th-art-slot-frame→runtime/slot-frame.png (TienHiepUiAssets:8→:56-59), fixture equipment-paperdoll-base@1x (EquipmentPreview.vue:15), EquipmentPaperdollPreview 91px qua HomeEquipmentArtPanel:53←LandscapeDesignPreview:65, legacy/ui-equipment.html→ui-preview/equipment.ts. Dead files EquipmentBagRail + EquipmentItemDetail = 0 importers — đúng.