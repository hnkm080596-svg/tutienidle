# Panel: Component dùng chung (shared chrome)

Branch `devin/artui-c0-foundation` @ 8ffc8e64. Scope: `components/common/SlotView.vue` + `SlotTypes.ts` + `common/art/*` + `GameButton` + `InkNineSlice` + `SceneDesignCanvas`, kèm MỌI global chrome đè lên các class của scope. Bản adjudicated: đã verify lại từng dòng trên code, sửa các claim sai của research gốc và bổ sung các sheet/kênh bị sót.

## 1. Mount chain — từ nav/route đến component gốc

- `src/main.ts:5-11` import THEO THỨ TỰ: `theme.css` → `huyen-kim.tokens.css` → `system-theme.css` → `tien-hiep-ui.css` → **`tien-hiep-secondary-ui.css`** → **`tien-hiep-auxiliary.css`** → **`pc-paper-production.css`** (sheet cuối, `@import './pc-paper-scene.css'` ở L1 → scene lại `@import './pc-paper-type.css'` L1 → cả chuỗi vào production). 4 sheet global cuối cùng chạm trực tiếp scope này.
- `src/main.ts:59` `installTienHiepUiAssets(document.documentElement)` inject 19 biến `--th-art-*` (`presentation/assets/TienHiepUiAssets.ts:4-22`) **+ 4 biến `--pc-*`** từ `pcPaperControlStyles()` (`PcPaperControls.ts:8-14`): `--pc-slot-art`, `--pc-primary-button`, `--pc-secondary-button`, `--pc-inspector-art` — kênh art thứ hai chạy song song `--th-art-*`.
- `src/App.vue` → `layout/GameRoot.vue` → `game/MainScene.vue` → `scenes/dong-fu/DongFuStage.vue` → `<SceneDesignCanvas>` tại `DongFuStage.vue:411` (`v-if="!stageActive"` — canvas nhà unmount khi panel stage mở). Rail nav thật = `.home-navigation-surface`/`.home-independent-navigation` scoped trong stage (446-448, 511-521), KHÔNG phải PaperPanelNavigation.
- Panels: `GameRoot.vue:15-23` lazy `defineAsyncComponent`. **`FunctionOverlayPanel.vue` có 3 đường mount** (research gốc chỉ thấy 1):
  - PAPER_MODES = stage_select/pill_room/equipment_hall/settings (định nghĩa :53-58, IMPERIAL_MODES :41-46) → mount TRẦN trong `<Transition name="th-panel-swap">` (:113-118) — tự mang chrome fidelity riêng.
  - `ImperialScrollScene` CHỈ bọc `exploration` → `ProductionPanel` (:122-155) — mode cuối còn trên shell cuộn.
  - `OverlayPanel` legacy → worker_lodge/scripture_pavilion/vendor (:158-195).
- `LeftPanel.vue` mount `InventoryPanel` khi `characterOverlayOpen`. Mỗi `scenes/*/XxxSurface.vue` = adapter production: `<SceneDesignCanvas overlay>` + `*FidelityScene` + panel thật (vd `InventorySurface.vue:28-30`). `ui-preview/*` = entry riêng (`game/ui-*.html` + `src/ui-preview/*.ts`), cũng gọi `installTienHiepUiAssets` nhưng KHÔNG phải production.

## 2. UI logic inventory — props/computed/emit đang feed DOM

### SlotView.vue (generic T, `components/common/SlotView.vue`)
- Props (26-91): `item`, `icon`, `label`, `description`, `amount`, `nameSegments`, `equipmentQualityRank` (Phẩm 1-10), `rarityRank` (Chất 1-5), `rarityRankScale` (5|10), `state` (SlotPresentationState), `badges`, `tooltip`, `accessibleLabel`, `showLabel`, `variant` (item|equipment|bag), `static`.
- Emit `click` (93-95); `handleClick` chặn `static`/`isBlocked` (213-217). `watch(props.icon)` reset `failedIconSrc` (107-109). `aria-busy` khi processing (246).
- Computed → DOM: `filled` (97→231); monogram chữ cái đầu khi icon lỗi (105-115→267-268); `rarityColor` map 5-step `rank*2-1` / 10-step `rank` (133-137→`--slot-rarity-color`+`--fx-beam-color` 241-242); `sealRank`/`sealOrdinal`→`PROFESSION_GRADE_SEAL_ORDINALS` (145-151→con dấu Hán 263); `isMaxRarityRank` (157→391-399); `qualityAuraTier` chỉ khi filled+scale5+rank≥3 (165-173→`--quality-fx-3/4/5` + `fx-border-beam--active` ≥4 ở 236-237/313); `isBlocked`(184)→`aria-disabled`(245); `showSelected`(186); `veil`(189-194→316-320 🔒/⊘/spinner); `validation` ép 'neutral' khi locked (196→272, CSS 452-486); `marker`(198→●275/'NEW'276); `comparison`(199→▲▼278-280); `badges` (282-284); tooltip fallback (219-221→`v-tooltip` 248); `static`→`role=img` tắt tooltip/click (226,244-248,636-646).
- DOM layers: InkNineSlice `frame-s-slot` CHỈ variant 'bag' (254-259) → seal → icon/monogram → validation glyph → marker/comparison/badges → amount/caption → hover-frame (306) → `fx-border-beam__fx` (313) → veil (316-320). Container query `<47px` giấu comparison/marker (627-632, `container-type:inline-size` :372); `prefers-reduced-motion` :808-819.
- Rebind `--slot-*`→`--hk-*` (334-342) NHƯNG thiếu `--slot-disabled-opacity` — đọc ở :787, vẫn sống nhờ `theme.css:263` → block paper `--slot-*` (theme.css:~250-266) "partially live", không chỉ cho out-of-scope reader.

### SlotTypes.ts
- Axes availability/interaction/validation/marker/comparison (5-17); `SlotVariant` item|equipment|bag (41); `SlotBadge` kinds+tone (45-51); `SlotPreviewProps` (57-68). Doc :25-32 STALE: gán 'equipment' cho paperdoll nhưng paperdoll đã `variant="bag"` (EquipmentPaperdoll.vue:266, comment ruling :432).
- Producer matrix (verified): `bag`→EquipmentBagSection.vue:325, MaterialBagSection.vue:366, PillBagSection.vue:543, EquipmentPaperdoll.vue:266. `equipment`→**0** (chỉ test). `item`→EquipmentBagRail:84, DissolveTab:346, LoreCodex:69, TechniqueSlotCard:125, ExplorationPaperDetails:26, CombatSkillSlot:141. `locked`→chỉ CombatSkillSlot:90. `disabled`/`processing`/`validation`/`marker:'new'`/`comparison`→**0 producer**. `equipped`→EquipmentBagSection:113. `selected`→PillBagSection:376, DissolveTab:356. `badges`→chỉ EquipmentPaperdoll:223 `{kind:'enhance'}`. `static`→chỉ ItemCardBody:60-62 (`:item="{}"` fake). `nameSegments`→5 sites. `rarityRankScale:10`→chỉ MaterialBagSection:375. `showLabel`→CombatSkillSlot:148, ExplorationPaperDetails:26. `BagCell` contract: `bag-sections/BagCell.ts:9-58`. DissolveTab kênh song song `.dissolve-slot-wrap`+tick+`--grade-mismatch` (342-343,462-466).

### GameButton.vue
- Props (12-31): variant primary|secondary|danger|ghost, size sm|md|lg, shape rect|circle, `accentVar`, disabled, loading, type, `sound` (mặc định bật). `AudioManager.getInstance()` (38); `handleClick` unlock ctx + `ui.click` + emit (43-49).
- `CHROME_SLOT_BY_SIZE` sm→button-compact / md→button-standard / lg→button-ceremonial (51-55); circle→`icon-button-utility`, ghost→không slice (57-64). `sliceTint`: danger→`--hk-cinnabar`, primary→`--hk-gold` (66-72). **`button-danger` KHÔNG nằm trong map → manifest orphan.**
- **Render thật trong prod (đã adjudicate):** `.game-button>.ink-nine-slice{display:none}` (`pc-paper-production.css:12`, specificity (1,2,0), scoped không khai `display`) → slice mount nhưng KHÔNG BAO GIỜ VẼ. Art nút = `::before` border-image `--pc-primary-button`/`--pc-secondary-button` (pc :6,:9,:10) = `controls/button-{primary,secondary}-v1.png`. Màu chữ: `tien-hiep-ui.css:80-83` THẮNG nhờ selector 3-class (`(1,3,0)` > pc `(1,1,0)`): primary `#352713`, secondary `#eddeb6`, danger `#ffebc8`; riêng ghost lấy `#f2e1ba` (pc :11, không đối thủ). Shape: pc :5 (radius 0, `overflow:visible` đè scoped `overflow:hidden`, font `--pc-font-body`). Min-width: th :224-225. Disabled: scoped `opacity:.55` + th :84 `grayscale(.7)`. Focus: pc :14 outline `#b28a43` + scoped gold glow (không ai đè box-shadow). Hover: pc :13 `brightness(1.08);transform:none` đè scoped `:active translateY(1px)` khi đang hover.
- Usage (đếm lại): `variant="primary"` 12, `"secondary"` **42 prod (62 gồm preview)**, `"danger"` 10, `"ghost"` **12 — ngang primary, không hiếm**. `shape="circle"`: 5 sites (CreationBackButton:18, CharacterMainStatRow:86, CombatTopBar:163, ToastContainer:132, OverlayPanel:86). `:sound="false"`: **12 sites / 8 files** (BetaCompletionModal:54, ConfirmModal:97+98, OfflineSummaryModal:77, ToastContainer:135, CombatExitConfirmModal:112+113, GuestAbandonDialog:53+56+59+62, LoreCodexModal:38). `accentVar`/`has-accent`/`--button-accent`: **0 caller** (MaterialBagSection `accentVar` là prop khác của BagCell, không liên quan). `is-loading` class emit :79 → **0 style ở mọi sheet**.

### InkNineSlice.vue (`common/primitives/`)
- Props (18-34): `assetId` (inkWashUi legacy), `chromeId` (thắng assetId), `layer`, `opacity`, `tintVar`, `thickness`. **Manifest = 44 assets, tất cả `status:'ready'`** (`huyen-kim-chrome.json`) → nhánh `pending` của `chromeSlice()` (huyenKimChrome.ts:60) + `pendingChromeIds()` (:65) dormant; `chromeFallbackClass` hk-fill/hk-frame (48-53) luôn render dưới art ready (resilience).
- `chromeArtStyle` (59-90): tintable→`-webkit-mask-box-image` (grayscale sheet làm alpha); không tint→`border-image` PNG gốc; `tintable:false` bỏ `tintVar`.
- `assetId`+`thickness`: **0 caller** → toàn bộ class block `ink-nine-slice--*` (CSS 169-267) + `assets/inkWashUi.ts` + slices JSON dormant ở DOM path (nhưng xem §6 ink-wash atlas).
- **`hkChromeUrl()` (huyenKimChrome.ts:73-78) — kênh render chrome THỨ HAI mà research gốc bỏ sót**: trả URL cho `<img>` trực tiếp (roller/plaque/node/ornament không nine-slice). 38 usage trong 15 files: ImperialScrollScene.vue:38-42 (roller, scroll-title-plaque, paper-grain-tile, corner-ornament, cloud-ornament — 5 ornament cuộn đều qua `<img>`, KHÔNG phải slice), CombatPlayerCard, TurnCombatSkillBar, TurnOrderStrip, SettingsPanel, SettingsAudioSection, CharacterIdentityHeader, DongFuHomeContent, DongFuHud, RealmAscentNode, TribulationChapterTracker, TribulationMindCard, TribulationStatusCard, VictorySectionPlaque (14 prod) + PaperPanelNavigation (đường chết).
- Consumer `chrome-id=`: 89 literal trong prod `.vue` + 1 bound ternary (`primitives/Chip.vue:50-51` `isTab?'tab-seal':'seal-chip'`) + 1 trong ui-preview = 91 usages. 54 file prod mount InkNineSlice. Nổi bật: SlotView `frame-s-slot`, Tooltip `frame-xs-tooltip` (:161), ImperialScrollScene (chỉ `imperial-scroll-body`+`frame-xl-ceremony`, ornament đã qua img), VictoryRewardSlot:29, CombatDefeatPanel (:156 scroll-title-plaque, :163 imperial-scroll-body, :164 frame-xl-ceremony), Realm/Tribulation/Quest/DongFu/Login/CharacterCreation…
- **5 slot ready nhưng không render (manifest orphans)**: `boss-seal`, `toggle-track`, `button-danger` (0 ref), `ceremony-ribbon` (chỉ path trong AssetBundleCatalog:608-609), `nav-seal-vertical` (chỉ PaperPanelNavigation.vue:15 — đường chết).

### SceneDesignCanvas.vue
- Props (**3**, :4): width/height (mặc định 1440×810), `overlay`. `measure()` 12-15 scale=min(vw/w,vh/h) qua ResizeObserver (16-25); `canvasStyle` translate+scale (8-11); `:data-scale` attr. Overlay=transparent+click-through (39-43). Scoped bg `#111c21` bị global `.scene-viewport:not(--overlay){background:#15221e}` (tien-hiep-ui.css:10) đè.
- Mount: DongFuStage:411, mọi `*Surface.vue`, OnboardingStage, ~25 ui-preview.

### common/art/* (pack `tien-hiep-2026-10/controls/`)
- `equipmentArt.ts:5-7` resolver. `EquipmentArtButton` (4-state filter PNG + gold/level-seal): live DissolveTab:386, EnhanceTab:364, RefineTab (344/382/385/388), WashTab (328/331), BodyFidelityScene:45, BodyPaperDetails:58 (+ nội bộ ProductionSourceArtCard).
- `EquipmentArtCard` (border-image `character-card-nine-slice-v2`): **prod mount duy nhất BodyPaperDetails.vue:20** — `EquipmentSurface.vue:43` chỉ là comment, nó tự resolve art :44; mọi mount khác = ui-preview.
- `EquipmentArtSlot` (`item-slot-v1`/`equipment-circle-frame-v1` + hue-rotate): live EnhanceTab:339/351, RefineTab:375, WashTab:320 — display-only, không select wiring.
- `EquipmentEnergyTube`: live RefineTab:336, BodyPaperDetails:32.
- `ProductionSourceArtCard`, `QuestObjectiveArt`, `SkillNodeArtButton`: **preview-only** (keystone/spare kinds không map → 2 file art mồ côi).
- `QuestCategoryArtButton`: live lạ — `SettingsNavRail.vue:5,33` dùng nút "quest" làm nav cài đặt.

## 3. Art map — file art → element dùng

| Art | Nơi dùng | Trạng thái |
|---|---|---|
| `tien-hiep-2026-10/runtime/slot-frame.png` | `--th-art-slot-frame` → nền THẬT mọi `.slot-view` (tien-hiep-ui.css:56-59) | live |
| `runtime/panel-frame-v2.png` | `.inventory-scene .slot-view` bg (:363-366), `.toast-item` border-image (secondary-ui:101), victory/defeat reskin (th-ui:231), khung paper (th-ui:254-256) | live |
| `ui/Slot/inv-slot-backdrop.png` | SlotView:361,378 fallback `--slot-bg-image` | **chết trong prod** (bị global đè var) — vẫn trong AssetBundleCatalog:541 |
| `ui/Slot/slot-backdrop.png` | `.slot-view--equipment` :564 | **chết kép** — variant 0 consumer + bị đè (catalog:544) |
| `ui/Slot/bag-slot-hover.png` | SlotView:532 fallback | **chết** — mọi variant set var sang slot-frame-hover (:559) (catalog:542) |
| `ui/Slot/slot-frame-hover.png` | `--slot-hover-image` mọi variant (:559) | live |
| `ui/Slot/seal-frame.png` | `slot-view__seal` bg (:608) + font chain (:615-616) | live |
| `controls/button-primary-v1.png`, `button-secondary-v1.png` | `--pc-primary/secondary-button` → `::before` MỌI `.game-button` (pc :6,:9,:10) | **live — art nút người chơi thực sự thấy** |
| `controls/inspector-v1.png` | `--pc-inspector-art` → `#global-tooltip` bg (pc :20), `.settings-panel__workspace` (pc :30) | live |
| `controls/item-slot-v1.png` | `--pc-slot-art` + EquipmentArtSlot | live |
| `controls/equipment-circle-frame-v1.png` | EquipmentArtSlot + `paperdoll__frame` img (EquipmentPaperdoll.vue:34,263) | live |
| `controls/equipment-brush-circle-v1.png` | `paperdoll__ring` (EquipmentPaperdoll.vue:35,240) | live (ornament) |
| `controls/equipment-tab-brush-v1.png`, `equipment-divider-v1.png` | EquipmentSurface.vue:45-46 (url trực tiếp) | live |
| `controls/equipment-filter-*-v2.png`, `equipment-level-seal-v1.png` | EquipmentArtButton ::before | live |
| `controls/character-card-nine-slice-v2.png` | EquipmentArtCard:3, characterUi.ts:5, EquipmentSurface.vue:44 | live |
| `controls/trial-creation-panel-v2.png` | CharacterCreationScreen.vue:161 | live |
| `controls/attribute-plus-v2.png` | characterUi.ts:6 | live |
| `controls/resource-{jade,coin,crystal,essence}-v1.png` | `pcPaperResourceUrl()` → DongFuStage.vue:430 currency chips | live |
| `source/shared-paper-page-v1.png` | PcPaperChrome:4, PcPaperScene:7, BodyFidelityScene:21, characterUi.ts:4, EquipmentFidelityScene:46, SkillFidelityScene:49 + catalog:578 — resolveAssetUrl TRỰC TIẾP (không qua var) | live |
| `controls/navigation-medallion-v1.png` | DongFuStage.vue:195 (`--home-nav-art`), QuestCategoryArtButton.vue:6 | live |
| `controls/navigation-backing-dark-v3.png`, `navigation-landscape-seam-v1.png` | DongFuStage.vue:197-198 rail nhà | live |
| `runtime/navigation-rail.png` | `--th-art-navigation-rail` → `.paper-navigation` (th-ui:14) | **chết** — PaperPanelNavigation preview-only |
| chrome `button-compact/standard/ceremonial`, `icon-button-utility` | GameButton chromeSlot map → slice bị `display:none` (pc :12) | **mount-nhưng-không-vẽ** trong prod |
| chrome `frame-s-slot` | SlotView 'bag' :257, VictoryRewardSlot:29 | live |
| chrome `seal-chip`, `tab-seal` | Chip.vue:51 + QuestGroupTabs/RealmRequirementChips… | live |
| chrome `frame-xs-tooltip` | Tooltip.vue:161 (slice visible net sau secondary-ui :38→:130) | live |
| chrome `imperial-scroll-body`, `frame-xl-ceremony` | ImperialScrollScene (InkNineSlice), CombatDefeatPanel :163-164 | live |
| chrome `imperial-scroll-roller`, `scroll-title-plaque`, `paper-grain-tile`, `corner-ornament`, `cloud-ornament` | ImperialScrollScene.vue:38-42 qua `hkChromeUrl` `<img>` (plaque cũng InkNineSlice ở CombatDefeatPanel:156) | live |
| chrome `surface-l-drawer/surface-m-panel/surface-xl-scroll/list-row/entity-bar/divider-ornament/section-plaque/resource-pill/…` | LoginSideDrawer, Tribulation*, Realm*, QuestRow, InventorySurface:77/85, DongFuResourcePill, CharacterSectionPlaque… | live |
| `ui/ink-wash/atlas/ink-wash-ui.{png,json}` | Phaser atlas `queueInkWashUiAtlas` (TribulationScene.ts preload :106, scene đăng ký PhaserCanvas.vue:156/162/165) | **fetch runtime nhưng `addInkWashNineSlice` 0 caller prod → dead-weight preload** |
| `ui/ink-wash/slices/*` + `ink-wash-ui-slices.json` + `assets/inkWashUi.ts` | đường `assetId` InkNineSlice | dormant (0 caller) |
| `controls/navigation-connector-v1`, `navigation-backing-v1`, `navigation-backing-dark-v2`, `attribute-plus-v1`, `character-card-nine-slice-v1`, `skill-connection-pipe-v2` | chỉ AssetBundleCatalog | **mồ côi — ship+preload, không vẽ** (skill-connection-pipe-v1 còn preview qua HomeSkillArtPanel:42) |
| `controls/skill-node-{parent,main,sub,passive}-v1` | SkillNodeArtButton | preview-only |
| `controls/skill-node-{keystone,spare}-v1` | không kind nào map | **mồ côi** |
| `controls/landmark-v1.png`, manifest jsons | PcPaperLandmark (chết), manifest loaders | dormant |

## 4. Conflicts / layers — nơi 2+ phiên bản UI cùng tồn tại

1. **3 sheet global chồng lên GameButton + scoped CSS** (đã lần cascade đầy đủ): scoped (0,2-3,0) < pc-paper (1,1-2,0) ≈ tien-hiep-ui (1,1-3,0). Kết quả: art = pc `::before`, màu chữ = th (trừ ghost=pc), shape/font/radius = pc :5, min-width = th, slice = pc giấu. Một nút = 4 chủ sở hữu.
2. **`::before` vuông lên nút circle**: pc :6 áp MỌI `.game-button` → 5 nút circle (OverlayPanel:86…) render khung `button-primary` vuông quanh nút tròn (overflow:visible không clip). Đồng thời scoped fallback `.game-button--circle:not(:has(>.ink-nine-slice)){border}` KHÔNG BAO GIỜ chạy vì slice vẫn trong DOM (display:none vẫn match `:has`) → nút circle mất cả 2 cơ chế vẽ viền của nó.
3. **Global CSS giết hệ variant backdrop SlotView**: `:is(#app,body) .slot-view` (th-ui:56-59) (1,1,0) > scoped (0,2,0) → `inv-slot-backdrop`/`slot-backdrop` chết; mọi ô = `slot-frame.png` kéo giãn; `.inventory-scene .slot-view` (:363-366) đè tiếp = `panel-frame-v2`+radial. 'bag' thêm InkNineSlice frame-s-slot trên nền đó (:571-574 tắt border); paperdoll lồng `<img>` circle-frame dưới SlotView (:263) → tới 4 lớp frame/ô.
4. **Variant 'equipment' chết kép** (doc SlotTypes:27-30 vẫn gán paperdoll, thực tế đã 'bag'): 0 producer, `.slot-view--equipment` + art vẫn ship+test.
5. **3 hệ nút + 1 hybrid**: GameButton (~40 file), PcPaperButton (AuthEntryScreen, CharacterCreationScreen, DongFuStage:429, LoginOpening + PcPaperSceneActions-chết), EquipmentArtButton (equipment-hall tabs + Body*), Chip filter. **`AuthSubmitButton.vue:9` = GameButton `variant="ghost"` + class `pc-paper-button pc-paper-button--secondary` trên cùng element** — chạy 2 hệ cùng lúc.
6. **3 hệ ô slot**: SlotView (chính), EquipmentArtSlot (cost slots, display-only), VictoryRewardSlot (InkNineSlice trực tiếp :29 — không axis state/rank/seal/tooltip nào của SlotView).
7. **Nav kép**: `.paper-navigation` + `usePaperNavigation` + `navigation-rail.png` chỉ sống qua preview (`PaperPreviewSurface.vue:19`); rail thật scoped trong DongFuStage. `usePaperNavigation.ts` chỉ được nhắc trong comment SettingsSurface:4.
8. **Suppression global lẻ**: `.inventory-scene .chip>.ink-nine-slice{visibility:hidden}` (th-ui:322); `.ink-nine-slice--hk-frame{box-shadow:none}` (:85); secondary-ui :17 giấu slice trong 9 modal classes; `.pc-settings-content .chip>.ink-nine-slice` (pc :47), `.feedback-dialog .chip` (pc :61); `.toast-item>.ink-nine-slice` (secondary-ui:102).
9. **Tooltip 3 chủ**: `frame-xs-tooltip` slice (hidden :38 → re-visible :130 net VISIBLE) + `--pc-inspector-art` bg (pc :20) + `::after` paper (secondary-ui:129) + max-width/padding (auxiliary:109).
10. **Click-through mesh**: th-ui:390-411 tắt pointer-events 11 `*-scene` roots rồi bật con trực tiếp + `.pc-paper-scene{pointer-events:auto}` (pc :21). Scene mới phải nhớ thêm vào list.
11. **`--slot-*` khai 2 nơi + 1 var rò**: theme.css:~250-266 (paper) vs rebind `--hk-*` (SlotView:334-342); `--slot-disabled-opacity` không nằm trong rebind → theme.css:263 vẫn nuôi :787.
12. **DissolveTab kênh trạng thái song song**: `.dissolve-slot-wrap--grade-mismatch`+tick ✓ (:342-343) ngoài trục `state.marker`/`state.validation`.
13. **`fx-border-beam` hai ngữ nghĩa**: aura Chất ≥4 trong SlotView (:237,313) + drag-hover formation (TranPhapPanel, theme.css:567).
14. **`ItemCardBody :item="{}"` fake-filled** (:60): `SlotPreviewProps` không có field item → hack object rỗng.
15. **Victory/defeat reskin chồng**: th-ui:112-118+231+264-269 đè `.victory-scene`/`.combat-defeat-panel` (paper bg, ẩn `.victory-title__flourish`/`.victory-roller` :122) trên chrome ImperialScroll của chính các panel đó.
16. **`tien-hiep-auxiliary.css` (main.ts:10) — sheet global thứ 4 research sót**: chủ yếu tran-phap/companion nhưng chạm `#global-tooltip` (:109). Orphan `tien-hiep-outcomes.css` chứa sẵn rule giết slice trong `.quest-scene` (:8), `.victory-scene` (:20), `.combat-defeat-panel` (:27), `.tribulation-scene` (:72,:111) + victory-slot/slot-view aura reskin — nếu ai import lại là đổi hình một loạt scene.

## 5. Logic không có hình ảnh — logic/state không render ra gì

- SlotTypes axes **0 producer**: `validation` (glyph ✓/✕/!, ring 452-486), `comparison` (▲▼ 278-280,676-693), `interaction:'processing'` (spinner 766-806), `availability:'disabled'` (⊘ 318), `marker:'new'` (670-674). `SlotBadge` kinds `equipped`/`new`/`comparison`+tone (CSS 695-722) — chỉ `enhance` được sinh.
- GameButton: `accentVar`/`.has-accent`/`--button-accent` 0 caller; **`is-loading` class 0 style** (loading chỉ nhờ spinner element); `.game-button--circle:not(:has(>.ink-nine-slice))` fallback không bao giờ đạt điều kiện (xem Conflicts-2).
- InkNineSlice: `assetId`+`thickness` 0 caller → legacy class block + `inkWashUi.ts` + slices dormant; `chromeSlice()` nhánh pending + `pendingChromeIds()` dormant (44/44 ready).
- `hkChromeUrl`/`chrome-id` orphans: `boss-seal`, `toggle-track`, `button-danger`, `ceremony-ribbon`, `nav-seal-vertical`.
- `usePaperNavigation.ts`: 0 caller prod. `system/` family: SysBar.vue/SysStat.vue **0 importer** (file tồn tại, chỉ system-theme.css nhắc); SysTag chỉ CharacterTalentSeals; SysPanel chỉ OverlayPanel.
- **Common dead/preview-only**: PcPaperLandmark (0 importer), PcBodyMeridianOverlay (0 importer, chỉ PcPaperScene.test), PcBodyDiagram+PcPaperLock (ui-preview only), `primitives/Eyebrow.vue` (0 consumer — ItemCardBody chỉ nhắc trong comment CSS :170), PcPaperScene/PcPaperTabs/PcPaperDialog/PcPaperSceneActions/PaperPanelNavigation (0 mount prod).
- `EquipmentArtSlot` empty+cost slots: không select wiring → trưng bày.
- `pendingChromeIds`/pending path: dormant.
- DongFuFidelityScene: chỉ ui-preview.
- secondary-ui :27-28 màu nút trong modal: giá trị trùng th :80-82 → apply nhưng không đổi hình (dư thừa).

## 6. Hình ảnh không có logic — art/DOM trưng bày, unwired

- **5 sheet CSS mồ côi** (0 importer toàn repo): `tien-hiep-outcomes.css` (chứa rule giết slice quest/victory/defeat/tribulation + slot aura — "súng đã lên đạn"), `tien-hiep-collections.css` (0 importer + 0 emitter `.th-collection`/`.pc-collection`), `tien-hiep-forge.css`, `tien-hiep-progression.css`, **`pc-paper-auxiliary-production.css`** (`.pc-auxiliary` reskin — reviewer cũng sót).
- Orphan bundled art (catalog ship+preload, 0 renderer): `navigation-connector-v1`, `navigation-backing-v1`, `navigation-backing-dark-v2`, `attribute-plus-v1`, `character-card-nine-slice-v1`, `skill-connection-pipe-v2` (+ `inv-slot-backdrop`, `slot-backdrop`, `bag-slot-hover` ở §3).
- `navigation-rail.png` + ~40 dòng `.paper-navigation` CSS: art+chrome cho component preview-only.
- `ink-wash/atlas/ink-wash-ui.{png,json}`: fetch mỗi lần vào Lôi Kiếp nhưng `addInkWashNineSlice` chỉ có test dùng.
- `skill-node-keystone-v1`, `skill-node-spare-v1`: file tồn tại, `SkillNodeArtButton.kind` chỉ map 4 loại.
- `ProductionSourceArtCard` (i18n `pp.*`, checkbox, upgrade emit): chỉ HomeProductionArtPanel preview — logic emit không có prod consumer.
- `.victory-slot__glyph` KIND_GLYPH fallback (VictoryRewardSlot.vue:38): render được nhưng không rõ producer nào thiếu icon.
- `paperdoll__ring` (brush circle, :240): ornament trưng bày — live nhưng zero wiring.

## 7. Open questions — cần chủ dự án quyết

1. `variant="equipment"` của SlotView: xóa hẳn (variant+`.slot-view--equipment`+slot-backdrop.png+catalog) hay giữ? Doc đang mô tả sai.
2. Trục `validation`/`comparison`/`processing`/`disabled`/`new`: mới định chưa nối, hay đã thay bằng kênh riêng của consumer? Nếu thứ hai → cắt khỏi SlotTypes/SlotView.
3. GameButton: hệ chrome nào là canonical — huyen-kim slice (đang mount-but-hidden) hay `::before` pc-paper? Nếu pc-paper → nên gỡ slice khỏi GameButton luôn (tiết kiệm 1 node/nút + xóa hiểu nhầm). Nút circle render khung vuông button-primary: chủ ý hay bug?
4. 5 manifest orphans (`boss-seal`, `toggle-track`, `button-danger`, `ceremony-ribbon`, `nav-seal-vertical`) + 6 orphan bundled art + 5 orphan CSS sheets (gồm `tien-hiep-outcomes` "súng lên đạn"): prune khỏi bundle hay giữ cho reskin tiếp theo?
5. 3 hệ nút + 3 hệ slot: lộ trình hợp nhất? VictoryRewardSlot chưa có axis nào của SlotView; AuthSubmitButton đang hybrid 2 hệ.
6. `usePaperNavigation`+`PaperPanelNavigation`+`.paper-navigation` CSS+`navigation-rail.png`: giữ cho preview harness hay prune khỏi bundle production?
7. Đường `assetId`/ink-wash InkNineSlice + atlas Phaser preload không consumer: xóa hay giữ API tương thích?
8. `ItemCardBody :item="{}"`: nên có đường "filled giả" chính thức trong `SlotPreviewProps`/`static`?
9. Badge `equipped` trùng ngữ nghĩa `marker:'equipped'` — giữ cái nào?
10. `.inventory-scene .slot-view` đè riêng (panel-frame thay slot-frame): chủ ý của reskin hay tàn dư?

## Adjudication

**Wrong findings — chấp nhận 15/15 (2 có chỉnh số):**
| # | Claim | Verdict |
|---|---|---|
| W1 | Manifest 44 slots (không phải 42) | ✅ — đếm lại: 44 assets, all ready |
| W2 | Slice GameButton bị `display:none` | ✅ — pc-paper-production.css:12, scoped InkNineSlice không khai `display` → chắc chắn ẩn. Bổ sung: hệ quả nút circle (Conflicts-2) reviewer chưa thấy |
| W3 | `button-danger` không trong chromeSlot map | ✅ — map chỉ compact/standard/ceremonial/icon-button-utility; id orphan |
| W4 | `nav-seal-vertical` orphan | ✅ — chỉ PaperPanelNavigation.vue:15 (đường chết) |
| W5 | EquipmentArtCard mount claim sai | ✅ — EquipmentSurface.vue:43 là comment; prod chỉ BodyPaperDetails.vue:20 |
| W6 | `:sound="false"` nhiều hơn 1 | ✅ nhưng số đúng là **12 sites / 8 files** (reviewer ghi 11 — sót ToastContainer:135 đã liệt kê lại ở chính list của họ) |
| W7 | ghost không hiếm | ✅ — 12 usage, ngang primary (12) |
| W8 | SceneDesignCanvas 3 props | ✅ — `:4` width/height/overlay |
| W9 | DongFuStage canvas :411 | ✅ — `<SceneDesignCanvas v-if="!stageActive">` ở :411 |
| W10 | Scroll chỉ bọc exploration | ✅ — :122-155; PAPER_MODES raw :113-118; legacy :158-195 |
| W11 | chrome-id ~90 không phải 93 | ✅ chỉnh: **89 literal prod + 1 bound (Chip:51) + 1 ui-preview** — "90 literal trong prod" của reviewer lệch 1 |
| W12 | tooltip.ts ~128 | ✅ — đúng 128 dòng |
| W13 | secondary 62/~42 | ✅ — đếm: 42 prod / 62 tổng |
| W14 | ink-wash chưa chết hẳn | ✅ — atlas queue tại TribulationScene preload (gọi `queueInkWashUiAtlas` ~:106) |
| W15 | theme.css block sớm hơn 257 | ✅ — comment :248, `--slot-surface` :251-252 |

**Missed findings — chấp nhận 16/16 (4 có correction):**
| # | Claim | Verdict |
|---|---|---|
| M1 | pc-paper-production.css quyết định chrome nút | ✅ cốt lõi. Corrections: `.pc-paper-toolbar` **không tồn tại** (chip rules thật là `.pc-settings-content .chip` :45-49); `--pc-paper-sheet` **không tồn tại** (art resolve trực tiếp); secondary+danger chung 1 rule :9; bổ sung `@import` chain scene→type ở :1 và cascade màu chữ (th triple-class THẮNG pc ở primary/secondary/danger — reviewer ngầm hiểu pc thắng toàn bộ là sai) |
| M2 | tien-hiep-secondary-ui.css | ✅ — corrections: :17 che slice trong **9** modal classes (không phải 10); `.loading-screen` ở :110 (không phải :109); toast reskin :132-134 |
| M3 | 4 orphan CSS sheets | ✅ + mở rộng: **`pc-paper-auxiliary-production.css` là orphan thứ 5**; `tien-hiep-auxiliary.css` NGƯỢC LẠI là live (main.ts:10, sheet global thứ 4) |
| M4 | `hkChromeUrl` kênh thứ hai | ✅ — 38 usage / 15 files (14 prod + PaperPanelNavigation chết). Danh sách consumer của reviewer có 3 tên không tồn tại (CombatTurnRail, CombatActionDock, ConstellationNode); danh sách đúng ở §2 |
| M5 | Orphan manifest slots | ✅ — đủ 5: boss-seal, toggle-track, button-danger, ceremony-ribbon, nav-seal-vertical |
| M6 | Orphan bundled art ×6 | ✅ — từng file verify: chỉ AssetBundleCatalog khớp (pipe-v1 còn preview) |
| M7 | Live art chưa map | ✅ trừ `--pc-paper-sheet` (không tồn tại — shared-paper-page-v1.png resolve trực tiếp, vẫn live 6 chỗ) |
| M8 | Dead components `common/` | ✅ — PcPaperLandmark 0, PcBodyMeridianOverlay chỉ test, PcBodyDiagram+PcPaperLock preview-only, Eyebrow 0 prod (ItemCardBody:170 chỉ comment) |
| M9 | Ink-wash atlas vẫn preload | ✅ — `atlas/ink-wash-ui.{png,json}` queue ở TribulationScene preload; `addInkWashNineSlice` 0 caller prod; scene register PhaserCanvas.vue:156/162/165 |
| M10 | CombatDefeatPanel mount scroll | ✅ chỉnh: có scroll-title-plaque+imperial-scroll-body+frame-xl-ceremony (:156/163/164), **không có roller**; `.victory-roller` hide :122 đúng |
| M11 | AuthSubmitButton hybrid | ✅ — path đúng là `scenes/login/AuthSubmitButton.vue:9` |
| M12 | Rule global khác chạm scope | ✅ — :10 viewport bg (đè scoped #111c21 bằng #15221e), :52-53 chip, :105 hk-scroll, :112-118/:231 victory, :373-379 th-panel-swap, `data-scale` |
| M13 | `--slot-disabled-opacity` rò rebind | ✅ — đọc :787, nuôi bởi theme.css:263 → paper block partially live |
| M14 | `is-loading` dead class | ✅ — emit :79, 0 rule ở mọi sheet |
| M15 | FunctionOverlayPanel 3 đường | ✅ — verified :53-58/:113-118/:122-155/:158-195 |
| M16 | Minors | ✅ — aria-busy :246, reduced-motion :808-819, icon watch :107-109, container-type :372, canvas v-if :411 |

**Phát hiện thêm của adjudicator (ngoài reviewer):**
- `tien-hiep-auxiliary.css` (main.ts:10): sheet global thứ 4 live, chạm `#global-tooltip` (:109) — cả research lẫn reviewer đều bỏ sót trong danh sách global.
- `pc-paper-auxiliary-production.css`: orphan thứ 5 (0 importer).
- Cascade thật của nút: màu chữ primary/secondary/danger do `tien-hiep-ui.css` (selector 3-class) thắng `pc-paper-production.css` — không phải "pc nằm trên bộ đè"; pc chỉ thắng ghost color, art, shape, slice-hide, hover/focus.
- Nút circle mất cả 2 cơ chế ring (slice ẩn + `:not(:has())` không bao giờ đạt) và nhận `::before` vuông — artifact có thể quan sát trên 5 sites.
- `tien-hiep-entry.css` live qua `App.vue`→AuthEntryScreen (46 dòng, không chạm scope).
- `pc-paper-scene.css`/`pc-paper-type.css` vào production qua chuỗi `@import` — không phải orphan.
- 54 file prod mount InkNineSlice; `chrome-id=` thực tế 89 literal + 1 bound.
