# Review kết quả: audit "Trang Bị — 5 tab op" (Khí Đường)

Soi lại report trên `devin/artui-c0-foundation` @ `8ffc8e64`, trong `game/`. Đa số claim file:line chính xác; report bỏ sót một nhóm rule global vẫn sống đụng panel, một export chết thứ hai, một vài listener/observer đang chạy, và sai vắng một claim lớn (preview "orphan").

## Missed

**Code chết report chưa liệt:**

1. `useEquipmentActions.ts:113-114` — `refine()` cũng có **0 caller** giống `wash()` (:109-110). Flow sống là `refinePreview`/`refineCommit`/`discardPendingRefinePreview` (:158-176). Report chỉ ghi `wash` — sót một export cùng họ.
2. `EquipmentPaperdoll.vue:217-227` + `:410-412` — `badgesBySlot` tính badge `+N` nhưng `.slot-view__badge` (và `.slot-view__seal` — output của `qualityRankBySlot` :193-202 / `rarityRankBySlot` :205-215) bị `display:none` trong chính scoped style → 3 computed chạy mỗi `stateVersion` tick mà render ra gì cũng không nhìn thấy.
3. `EquipmentBagSection.vue:41-43` — `handleClick` (click cell → `equip`) là tương tác chính của grid, không nằm trong inventory của report.
4. `EquipmentBagSection.vue:216` — `visibleCount` đếm `filteredEntries` (sau chip filter), nên nhãn `x/100` co lại khi filter — report chỉ ghi cap trưng bày `BAG_DISPLAY_CAPACITY=100` (:219-220), chưa ghi nhãn còn sai theo filter.
5. 5 comparator dormant là **unreachable hoàn toàn**, mạnh hơn "có thể bị set nơi khác": `setBagSortMode('equipment',…)` chỉ được gọi từ chính `EquipmentBagSection.vue:267` (Material/PillBagSection viết bag riêng) → `rarity/realm/slot/name/forge` (:232-244) không đường nào set được; `direction` cũng không ui nào chỉnh.
6. `equipment-hall/*.test.ts` (5 file test của các tab) + `useEquipmentTooltip.ts` (build mọi tooltip của doll/bag/dissolve — sống) + `useBagSort.ts` (comparator store) — file trong scope report không liệt.
7. `EquipmentFidelityScene` props `sockets`/`items` (:13-14) trong prod luôn nhận default `[]` — Surface không truyền; report liệt props nhưng không ghi chúng chỉ sống ở nhánh preview.
8. `EquipmentArtCard` không được equipment scene nào dùng — chỉ `BodyPaperDetails.vue` + các preview; trong scope này nó là preview-only (pattern card được inline qua `--equipment-card-art`).

**Art/chưa map:**

9. `EquipmentPaperdoll.vue:34,263` — `equipment-circle-frame-v1` còn dùng to nhất trên `.paperdoll__frame` (6 socket doll) + glow `:374-376` (glow kể cả slot trống). Art-map ghi socket `::before` :49,:116 của scene (nhánh default-slot chết) mà sót consumer live này.
10. `EquipmentEnergyTube.vue` — component RefineTab mount (:17,:336); animation CSS `equipment-energy-flow` chạy liên tục trên mọi refine row khi tab mở. Report gọi "fill tube" chưa map component/asset. `EquipmentArtButton` prop `filterArt` cũng chỉ sống trong preview (`EquipmentBagPreview.vue:49,59`).

**Global CSS vẫn sống đụng panel — sót hết:**

11. `tien-hiep-ui.css:56-58` `:is(#app,body) .slot-view` phủ `--th-art-slot-frame` lên MỌI SlotView: doll socket bị chặn bằng trick `:is(#app)` (`EquipmentPaperdoll.vue:380-399`, specificity 1,2,0 — chính là chiến tranh specificity report không ghi), bag cell bị override `--equipment-item-slot` (:450-456), nhưng `.dissolve-slot` `DissolveTab.vue:347` **không bị chặn** → candidate dissolve vẫn mang frame nine-slice global.
12. `tien-hiep-ui.css:50-51` `.paperdoll .paperdoll__base` (width:85%, opacity:1, display:flex — specificity 1,2,0) thắng scoped `.paperdoll__base` (`EquipmentPaperdoll.vue:318-332`: width:auto, opacity:0.55) — khi `idleClip` vắng, mannequin fallback render sáng/khác kích thước thiết kế scoped. Conflict live không được ghi.
13. `tien-hiep-ui.css:52-53` `.chip`/`.chip.is-active` — Chip trong `EquipmentBagSection.vue:309-318` (`Chip.vue:44,82`) bị global recolor + outline — hit sống.
14. `tien-hiep-secondary-ui.css:85-91,94` — `.dissolve-filters select/.dissolve-filters__bulk` + `.bag-pagination__*` nhận dark-ramp vars + `color:#eddeb6`/`#30291d` — recolor sống `DissolveTab.vue:289-335` + `BagPaginationControls` (:365-373). Report chỉ ghi `:65` chết, sót phần sống.
15. `tien-hiep-ui.css:165` `.df-building[data-df-building='equipment_hall']` — đặt plaque Khí Đường trên bàn cờ Động Phủ (`DongFuHomeContent.vue:46`) — chrome sống trên mount path.
16. `tien-hiep-collections.css:125,250` selector `.th-collection .equipment-workspace`/`equipment-bag`/`equipment-forge` — dormant hôm nay (không có `.th-collection`/`pc-collection` ancestor nào, sheet chỉ import bởi AuthEntryScreen/AuthInteractivePreview) nhưng là selector armed nhắm rect workspace — rủi ro hijack tiềm ẩn report chưa nhìn.

**Listener/observer/timer đang chạy — sót hết:**

17. `useDialogFocus.ts:16,:37,:65` keydown Esc + `:79-94` document `mousedown` — live trên scene.
18. `usePanelPagination.ts:41-52` ResizeObserver trên `.dissolve-grid` (`DissolveTab.vue:188-198,338`) — tính lại column count theo bề rộng.
19. `SceneDesignCanvas.vue` ResizeObserver — scale canvas theo viewport liên tục.
20. `EntitySpriteCanvas.vue:70,:125-127` `requestAnimationFrame` loop — chạy figure doll liên tục khi panel mở.
21. `EquipmentEnergyTube` animation CSS (điểm 10) + `DissolveTab.vue:256-258` watch `dissolveSelected` reset `dissolveConfirming` (report ghi watch reconcile :206-217 nhưng sót watch thứ hai).

**Khác:**

22. `EquipmentSurface.vue:351-357` `.bag-anchor` khai `container-type:inline-size; container-name:bag-panel` — contract container query sống (BagPaginationControls được viết cho container `bag-panel`); report bàn `@container equipment-ops` chết mà sót contract live.
23. `materialIcon()` gọi `materialRegistry.get()` **không guard** — `MaterialRegistry.get` throw `Material not found` (`MaterialRegistry.ts:18`); `EnhanceTab.vue:170`, `WashTab.vue:235`, `RefineTab.vue:235` (kèm `refineSpiritStoneCostMaterialId` động :137-141). Cùng họ crash với `getEquipmentTemplate` mà code đã guard — latent crash sót.
24. `FunctionOverlayPanel.vue:28` `TITLE_KEYS.equipment_hall` — key i18n chết cùng nhánh scroll/legacy (report ghi header/artBroken nhưng sót key).
25. `EquipmentFidelityScene.vue:93` `:deep(*) { box-sizing:border-box }` — scoped-global re-box mọi descendant gồm 5 op tab — rule sống sót.

## Wrong

1. **Preview KHÔNG orphan** — claim "KHÔNG có `ui-equipment.html`/`ui-forge.html`" sai: `game/legacy/ui-equipment.html` load `/src/ui-preview/equipment.ts`, `game/legacy/ui-forge.html` load `/src/ui-preview/forge.ts`; `previewRoutes.ts:2` map `/legacy/ui-*.html` và toàn bộ 17 file legacy html tồn tại (gồm `ui-dong-fu`). Phần đúng duy nhất: `<a href="/ui-equipment.html">` và `/ui-inventory.html` trong `ForgeFidelityScene.vue:10` là root-relative thiếu `/legacy/` → 2 link đó vẫn chết.
2. §6: "`equipment-preview` stamp … render rỗng trong prod" — stamp không render rỗng mà **không render** (`v-if="preview"` :87; prod không truyền `preview`). `.equipment-notice` thì đúng là render rỗng.
3. §4.1 nói `@container` unnamed `:260` "bám container overlay-panel" — đúng chiều, nhưng điểm chết thật là `.qi-hall__split/*` không còn element nào → block chết kể cả container resolve được.
4. §4.9 gộp `--equipment-tab-brush`/`--equipment-divider` "không consumer" — đúng cho 2 var đó trên workspace :192, nhưng `--equipment-card-art` cùng dòng thì **có** consumer (chính `.equipment-workspace` bg :252). Câu đọc dễ gây hiểu nhầm cả 3 đều chết.
5. §2 nói `EquipmentPaperdoll` click = "unequip + emit select" với "pre-existing" — đúng, nhưng lưu ý click này còn `cue('ui.equip')` chơi cho hành động **tháo** (:229-235) — chi tiết report có ghi, verify đúng.
6. Art-map hàng `.equipment-sheet` bg ghi "`:46,96`" — :46 là khai var trong script, DOM dùng tại :55 (style binding), rule tại :96. Precision nhỏ.

## Verified-ok

- **Mount chain đúng hết**: `usePaperNavigation.ts:55` nav→`{left_panel,equipment_hall}` (:128-140 navigate→openLeftPanel); `DongFuStage.vue:229`→`openBuilding` (`useBuildingNavigation.ts:137-155`)→`buildings.ts:128 functionType:'equipment_hall'`; `FunctionOverlayPanel.vue:69-77` gate, `:53-58` PAPER_MODES, `:41-47` IMPERIAL + `:82-84` scrollMode loại → scroll/legacy chết cho mode này; mount trong `Transition th-panel-swap` :113-118.
- `EquipmentHallPanel.vue:10-15` đúng: chỉ import `qi-hall.css` + `<EquipmentSurface>`; guard test tồn tại (`qiHallLayoutOwnership.test.ts:62-100` scan cả `<style>` trong .vue).
- `EquipmentSurface.vue` inventory đúng: TABS :57-63, visibleTabs :70 non-reactive, workspaceModes :72-79, activeWorkspace :81, selectWorkspace refuse locked :83-89, provide :109, SUMMARY_STATS :111-118, summaryRows :125-143, `player` unused :49, slot geometry :158-234, workspace :189-219.
- `qi-hall.css` gần như chết đúng: không template nào dùng `.qi-hall__body/split/...`; chỉ `.qi-hall__tier-N` sống qua `tierClass()` (`equipmentHallDisplay.ts:18`); `@container equipment-ops` :276 không có container; block :260 bám overlay-panel đã rời mode này.
- Guard violation: `WashTab.vue:410-414` + `RefineTab.vue:451-455` re-define `.qi-hall__tier-1..5` = 10 token → 10 violation; tier-5 gradient `qi-hall.css:232-238` vs flat `--affix-tier-5` scoped — scoped thắng (attribute-boosted), hiển thị flat.
- Dead files đúng: `EquipmentBagRail.vue`, `EquipmentBagPanel.vue`, `EquipmentItemDetail.vue` 0 importer; `tien-hiep-forge.css` không được import (`main.ts:5-11`).
- Emit lủng đúng: `emit('action')` chỉ có listener ở `EquipmentPreview.vue:32`; `open-dissolve` bind ở `Surface:210`, không bind ở `BagGrid.vue:68` (mount thứ hai trong Kho Vật).
- Doll socket click `:229-235` unequip+select trên mọi workspace, cue 'ui.equip' cho tháo — "pre-existing" note `Surface:99-103` đúng.
- Dead CSS đúng: `.equipment-workspace__divider` :324-331 no element; `.equipment-workspace nav button:focus-visible` :332-335 unreachable (nav là sibling slot #tabs); `.equipment-hall__tabs` secondary:65 chết.
- Esc kép đúng: `useDialogFocus:27` Esc→back + `@keydown.esc` :54 (inspecting luôn null prod).
- Comment thối `EnhanceTab.vue:66-70` đúng (kể chain shell cũ).
- Logic-no-visual đúng: `notice=""` :154; preview state :29-40 inert prod; `FunctionOverlayPanel.vue:89-100` header compute chết cho paper path; `EquipmentBagSection.vue:101-114` dead branch sau filter :57; `wash()` :109-110 no caller.
- Visual-no-logic đúng: `＋` :296-301 no handler; `x/100` display cap; furnace/plinth décor; `EquipmentArtSlot` prod luôn `empty` (`EnhanceTab.vue:339,351`, `WashTab.vue:320`, `RefineTab.vue:375`).
- i18n dead keys đúng (spot-check): `bagRail.*`/`scene.*` chỉ dùng bởi file chết; `tooltips.*`, `pityCounter`, `guaranteed`, `rowLine`, `levelPrefix`, `costPerUse`, `table.header.stat/before/after`, `aria.washComparison`/`refineComparison` zero ref sống; `equipment.forgeTitle/bagTabs/sort/filter` chỉ nhánh default slot.
- `BETA_EQUIPMENT_TABS=['enhance','dissolve']` (`betaScope.ts:410`) → wash/refine/decompose locked-shell :77 + :317-319.
- `ForgeFidelityWorkspace.vue:12` hardcode `'1.260'→'1.386'` đúng; `EquipmentPreview.vue:32` là listener `action` duy nhất (preview).
- `useEquippedRows.ts:56-175`, `hallSelection.ts:15`, `equipmentHallDisplay.ts:17-39`, `useEquipmentActions.ts` line refs khớp.
