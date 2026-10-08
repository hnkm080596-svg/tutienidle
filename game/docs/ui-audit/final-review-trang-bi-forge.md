# Final review — Trang Bị forge/ops @ 8ffc8e6

Mọi claim file:line spot-check được đều đúng (mount chain, 5 tab, Surface, FidelityScene, Paperdoll, BagSection, useEquipmentActions, qi-hall.css, global chrome, guard test, preview tree). Phần còn sót toàn là gap nhỏ, không có claim sai lớn.

## Missed

1. **5 file scope chết chưa vào danh sách §4.4** — §4.4 chỉ liệt kê `EquipmentBagRail.vue`/`EquipmentBagPanel.vue`/`EquipmentItemDetail.vue`. Thực tế còn:
   - `src/components/panels/equipment-hall/EquipmentPanel.vue` — 0 importer toàn repo (panel cũ, bị `EquipmentHallPanel.vue` thay).
   - `src/components/panels/equipment-hall/EquipmentSlotView.vue` — 0 importer (kể cả kebab `equipment-slot-view`).
   - `src/components/panels/equipment-hall/EquipmentFidelityPreviewBag.vue` + `EquipmentFidelityPreviewItem.vue` — 0 importer kể cả trong `ui-preview/` (không phải preview sống mà là orphan).
   - `src/components/panels/BagGrid.vue` — chỉ được mount bởi dead `EquipmentBagPanel.vue:12,28` (`<BagGrid>`); live Kho Vật (`InventorySurface.vue:94-95`) mount trực tiếp `MaterialBagSection`/`PillBagSection`, không qua `BagGrid` → transitively dead, cần vào dead-file list.

2. **`EquipmentPaperdoll.vue:41` `bumpState` destructure không dùng** — `useStateVersion()` trả `{stateVersion, bumpState}`; `bumpState` 0 ref trong file. Cùng loại dead-symbol với `player` (Surface:49) đã được flag nhưng sót chỗ này.

3. **§2 inventory sót nhiều symbol sống** (gaps, không phải bug logic): EnhanceTab `selectedEnhanceRow` (:127-129)/`selectEnhanceSlot` (:131-133)/`statGlyph` (:158-160); WashTab `pendingWashAffixDisplay` (:150-158)/`selectedAffixes` (:160-180); RefineTab `clearPendingRefinePreview` (:58-62)/`selectHallSlotForAction` (:64-74)/`selectedAffixes` (:78-108)/`refineSpiritStoneCostName`+`Owned`+`refineEssenceOwned` (:143-163)/`refineRenAfter` (:222-224); DecomposeTab `oreLabel` (:68-70 — lần gọi `.has()`-guarded `materialLabel` thứ 2 ngoài DissolveTab); EquipmentPaperdoll `SLOT_COLUMNS` (:52-56) + helpers `itemName`/`itemAccessibleLabel`/`itemDescription`/`itemIcon` (:104-120); EquipmentBagSection `EQUIPMENT_BAG_COLUMNS`/`EQUIPMENT_BAG_MIN_CELLS`/`gridStyle` (:25-29), `toggleGroup` (:186-188), `toneMatches` (:197-203), `cells` sorted projection (:249-262), `sortMode` computed (:265-268), `useUiStore` (:33).

4. **`enhanceLevelBySlot` (`EquipmentPaperdoll.vue:73-83`) transitively dead-output** — chỉ nuôi `badgesBySlot` → seal/badge `display:none` (:410-412). §5 flag 3 rank computed nhưng không truy nguồn enhance-level vào cùng nhánh vô hình.

5. **Forge-* scoped vocabulary nhân bản nguyên khối qua 4 tab** — `.equipment-forge-workspace`/`.equipment-forge-divider`/`.equipment-forge-materials`/`.equipment-material`/`.equipment-forge-actions` copy ~50-80 dòng mỗi file (EnhanceTab :377-465, WashTab :338-434, RefineTab :355-445, DissolveTab :381-435, comment "copied verbatim from the approved preview"). Cùng pattern ownership report phân tích cho qi-hall.css nhưng không ghi cho forge vocabulary — không conflict, chỉ là duplication ồ ạt nếu sau này đổi art.

6. **Dead scoped styles của nhánh default-slot trong `EquipmentFidelityScene.vue`** — `.equipment-bag`/`.bag-tabs`/`.bag-grid`/`.empty-bag-cell`/`.equipment-bag footer`/`.equipment-forge`/`.equipment-forge nav,header`/`.character-stage`/`.character-image`/`.equipment-sockets`/`.equipment-socket(+::before,+span,:deep(gear-item))` (~:112-145) chỉ thắng DOM nhánh preview chết ở prod. Report ghi dead DOM branch (§6) nhưng không itemize ~12 rule CSS chết cùng nhánh.

7. **`dissolve-workspace` class-root không có rule riêng** — nhỏ: `.dissolve-workspace` (:285) dùng làm root class nhưng scoped block không định nghĩa `.dissolve-workspace` (chỉ `.dissolve-list/.dissolve-slot*`). Harmless, nhưng class-trống trong tab live.

## Wrong

1. **"4 comparator + direction unreachable" — đếm sai** — `EQUIPMENT_COMPARATORS` có **6** keys (`EquipmentBagSection.vue:224-244`: quality, rarity, realm, slot, name, forge). Sort select chỉ expose `default`/`quality` (:352-355); `cells` short-circuit `default` trước khi gọi comparator (:252-254) → **5 comparator unreachable** (rarity/realm/slot/name/forge), không phải 4. Direction unreachable vẫn đúng (`toggleBagSortDirection` chỉ được gọi ở Material/Pill sections, `sort-direction` computed nhận 'equipment' không trigger).

2. **"mount thứ 2 trong Kho Vật" cho `BagGrid.vue:68` — framing sai vị trí** — `open-dissolve` không bind ở BagGrid là đúng, nhưng BagGrid KHÔNG phải surface sống: importer duy nhất là dead `EquipmentBagPanel.vue`; `InventorySurface.vue` (Kho Vật thật, mount từ `InventoryPanel.vue:12`) không có tab equipment nào cả. "Nút Hóa Luyện chết tại đó" đúng theo nghĩa emit-unbound, nhưng không có live mount thứ hai nào tồn tại — nó nằm trong dead subtree, không phải chrome Kho Vật đang render.

3. **`materialLabel` cite sai dòng** — report ghi `DissolveTab:372`; call thật ở **`DissolveTab.vue:379`** (`dissolve-preview` loop). `:372` là `@go-to-page` của pagination. Line drift nhỏ.

4. **`.equipment-notice` "chiếm chỗ ~13px" — hơi lệch** — element `position:absolute` (`EquipmentFidelityScene.vue:146`), không occupy layout flow; là strip 640×13 vô hình (empty text) chồng ở top:692 chứ không đẩy nội dung. "Render rỗng" đúng; "chiếm chỗ" không đúng nghĩa layout. Nit.

5. **`filterArt` "chỉ sống preview (`EquipmentBagPreview.vue:49,59`)" — citation thiếu** — cũng mount ở `HomeInventoryArtPanel.vue:90,:146`. Verdict preview-only vẫn đúng, chỉ thiếu 2 call-site. Nit.

## Verified-ok

- Mount chain đầy đủ: `usePaperNavigation.ts:55`→`openLeftPanel` (:128-140); `DongFuStage.vue:229`→`useBuildingNavigation.ts:137-155`→`buildings.ts:128`; `FunctionOverlayPanel.vue` gate `isBetaLeftPanelMode` (:69-77), `PAPER_MODES` (:53-58), scroll-mode exclusion (:82-84), mount `<EquipmentHallPanel>` trong `th-panel-swap` (:113,:116); `TITLE_KEYS.equipment_hall` (:28) + `buildingId/header/artBroken` (:89-100) chết trên paper path.
- `EquipmentHallPanel.vue:10` import `qi-hall.css`; `qiHallLayoutOwnership.test.ts` scan cả `<style>` .vue → `WashTab.vue:410-414` + `RefineTab.vue:451-455` đúng là 10 violation nếu chạy; tier-5 gradient (qi-hall.css:232-238) vs scoped flat — scoped thắng.
- Specificity war: `tien-hiep-ui.css:56-58` `:is(#app,body) .slot-view` verified; doll chặn bằng `:is(#app)` trick (`EquipmentPaperdoll.vue:380-399`, gồm `border-radius:0` :389 ép `.paperdoll__slot{border-radius:50%}` :436-438, `box-shadow:none` :398); `.dissolve-slot` (`DissolveTab.vue:347`) không chặn → vẫn mang `slot-frame.png`; bag-cell `:deep(.slot-view--bag)` (0,3,0) thua global (1,1,0) → `item-slot-v1.png` không paint. Nuance rank-aura chính xác: `box-shadow:none` :398 kill bag-shadow nhưng `fx-border-beam__fx` span (SlotView:313, beam spin theme.css:581-646) vẫn mount cho rank≥4 — adjudicated nuance đứng.
- `tien-hiep-ui.css:50-51` `.paperdoll .paperdoll__base` (1,2,0) thắng scoped :318-332; `:52-53` chip recolor live (`EquipmentBagSection.vue:309-318`, `Chip.vue:44,:82`); `:165` plaque `equipment_hall` + `DongFuHomeContent.vue:46` (`fidelity/` subdir) live.
- `tien-hiep-secondary-ui.css:65` `.equipment-hall__tabs` chết + `:85-91,:94` recolor `.dissolve-filters*`/`.bag-pagination__*` live — claim draft-vs-fixed đúng.
- Sheet census 0-importer verified bằng grep: `tien-hiep-{forge,collections,outcomes,progression}.css`, `pc-paper-auxiliary-production.css` 0 import; `main.ts:5-11` đúng chỉ load 7 css như report.
- `wash()` :109-110 + `refine()` :113-114 trong `useEquipmentActions.ts` — 0 caller, verify qua mọi destructure site.
- `materialIcon` unguarded ×3 (`EnhanceTab.vue:169-173`, `WashTab.vue:234-238`, `RefineTab.vue:233-237` + dynamic `refineSpiritStoneCostMaterialId` :137-141); `MaterialRegistry.get` throw :18; `washSpiritStoneCostName` (:90-94) + `materialLabel` (:379) + `oreLabel` (DecomposeTab :68-70) đều `.has()`-guarded — đúng pattern "sống vs crash cùng file".
- Preview tree không orphan: `game/legacy/` 17 `ui-*.html`; `ui-equipment.html`→`src/ui-preview/equipment.ts`→`EquipmentPreview`; `ui-forge.html`→`forge.ts`→`ForgePreview` (mount `ForgeFidelityScene` :5,:14); `previewRoutes.ts` 15 keys, không key forge/dong-fu; 2 link chết `ForgeFidelityScene.vue:10` (`/ui-equipment.html`,`/ui-inventory.html` thiếu `/legacy/`). `ForgeFidelityWorkspace.vue:12` hardcode '1.260'→'1.386', `furnace-art` :15.
- EquipmentBagSection: `handleClick`→`equip` (:41-43), `!equipped` filter :57 → :101-114 unreachable, `visibleCount` đếm filtered (:216), `BAG_DISPLAY_CAPACITY` (:220), `＋` không @click (:296-301), `open-dissolve` emit (:31,:305) bind `Surface:210`.
- BagPaginationControls: sort cluster tự ẩn khi `sortOptions=[]` (`v-if` :160) → DissolveTab truyền `[]` là hợp lệ, không dead UI.
- Listeners live: `useDialogFocus` (Esc :37-41, doc mousedown :73-79, cleanup :80-100) + Esc kép `@keydown.esc` (:54) trong cùng component; `usePanelPagination` RO (:47-61); `SceneDesignCanvas` RO (:7,:20-22); `EntitySpriteCanvas` rAF; `EquipmentEnergyTube` animation infinite.
- Container contract `.bag-anchor container-name:bag-panel` (`Surface:351-357`) live vs `@container equipment-ops` (qi-hall.css:276-287) + unnamed (:260-272) chết.
- `emit('action')` listener duy nhất `EquipmentPreview.vue:32`; `sockets/items` default `[]` prod không truyền; `equipment-preview` stamp `v-if="preview"` :87.
- i18n spot: `pityCounter`/`washComparison`/`rowLine`/`bagRail.*` 0 ref ngoài locales+dead file; `equipment.forgeTitle/bagTabs/sort/filter` chỉ ở dead default-slot (`EquipmentFidelityScene.vue:81-82`).
- `.equipment-workspace__divider` (:324-331) + `nav button:focus-visible` (:332-335) dead; `--equipment-card-art` có consumer (:252) — adjudicated đúng; `player` unused (:49), `notice=""` (:154).
- `DissolveTab` 2 watch (:200-217 reconcile + :256-258 reset confirming), `usePanelPagination` (:188-198), 2-step dissolve (:250-278) — đúng.
- `DecomposeTab` settingsMirror/capacityMirror/matchingOres+watch (:34-59), `applySetting`, `estimate` — đúng.

**Kết luận**: không claim sai lớn; các lỗi còn lại = 5 dead file sót trong scope + đếm comparator 4→5 + vài cite/nuance drift. Bản chất các defect cốt lõi (specificity war, ownership violations, latent crash, dead emits/comparators) đều chính xác.
