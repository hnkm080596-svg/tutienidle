# Panel: Trang Bị — doll/sockets (EquipmentPaperdoll)

Audit trên `devin/artui-c0-foundation` @ 8ffc8e64, clone `game/`. Read-only, mọi claim kèm file:line.

## 1. Mount chain

4 đường vào, tất cả quy về `ui.leftPanelMode = 'equipment_hall'`:

- Nav rail dọc DongFuStage: icon `equipment` → `navigation.openBuilding('equipment_hall')` (`src/components/scenes/dong-fu/DongFuStage.vue:229`); active-state qua `NAV_ACTIVE_PANEL` `equipment: 'equipment_hall'` (:250) → `ui.leftPanelMode === left` (:268-272).
- Command wheel ring-3: entry `equipment_hall` có `buildingId` (`src/data/ui/commandWheelCatalog.ts:222-226`) → `activateSlot` → `openBuilding` (DongFuStage.vue:330-335) → `useBuildingNavigation.openBuilding` (`src/composables/useBuildingNavigation.ts:136-153`): fail-closed nếu `!isBetaBuildingSurface` (:140-142), rồi `presentation.template.functionType` (:150) → `ui.openLeftPanel` (:152). `functionType: 'equipment_hall'` khai ở `src/data/building/buildings.ts:114,:128`.
- Hotspot building: `.df-building[data-df-building='equipment_hall']` render bởi `fidelity/DongFuHomeContent.vue:42-53` (`@click="emit('action', building.id)"` :49 → DongFuStage route), pin `left:1000px;top:172px !important` 1 dòng `tien-hiep-ui.css:165` (block :152-176; bg `var(--th-art-building-plaque)` :155).
- Paper panel nav: `NAV_TARGETS.equipment` → `{kind:'left_panel', mode:'equipment_hall'}` (`src/composables/usePaperNavigation.ts:55`) → `ui.openLeftPanel` (:136).

Store: `ui.leftPanelMode` (`src/stores/ui.ts:123`, setter `openLeftPanel` :226-241), beta-gate bởi `isBetaLeftPanelMode` (`src/core/betaScopeSurface.ts:169`; `equipment_hall: null` :157) + mode chokepoint FunctionOverlayPanel:74.

Mount tree (production):

```
GameRoot.vue:150 <FunctionOverlayPanel />   (src/components/layout/)
└─ FunctionOverlayPanel.vue
   ├─ PAPER_MODES chứa 'equipment_hall' (:53-58); mode beta-gate :69-77; paperMode :79-81
   ├─ Transition.th-panel-swap :113-118 → EquipmentHallPanel :116
   │   (.th-panel-swap CSS tien-hiep-ui.css:373-379)
   └─ useBuildingHeaderState(buildingId) :91 — header chỉ render trong scroll
       (:131-149) + legacy (:170-188) → plumbing chết trên paper path
└─ EquipmentHallPanel.vue (16 dòng, src/components/panels/)
   └─ :9 import './equipment-hall/qi-hall.css' (guard test
       tests/architecture/qiHallLayoutOwnership.test.ts) + mount EquipmentSurface
└─ EquipmentSurface.vue (359 dòng, src/components/scenes/equipment/)
   ├─ SceneDesignCanvas overlay :151 (ResizeObserver :7,:20-21 → scale :14)
   └─ EquipmentFidelityScene (fidelity/EquipmentFidelityScene.vue)
       ├─ .equipment-sheet bg :55 (shared-paper-page-v1)
       ├─ .equipment-heading h1 + .equipment-divider img :56
       ├─ #tabs → nav.equipment-tabs (Surface :174-187; rect 365/165/620x42 :275-280)
       ├─ .equipment-subtitle :62 (i18n; CSS :105) — LIVE
       ├─ BuildingUpgradeButton .equipment-upgrade :65 (pin :106 — 1260/124/110px;
       │   :deep(.building-heading__cost) :109) — LIVE, ngoài mọi slot
       ├─ #doll → .equipment-doll (Surface :158-160; rect 365/215/369x348 :229-233)
       │   → EquipmentPaperdollStage (.equipment-paperdoll-stage,
       │     data-hk-region="paperdoll" :21) → EquipmentPaperdoll .paperdoll
       │     → 6x SlotView variant="bag"
       ├─ #summary → .equipment-summary (rect 365/572/369x119 :124, border-image dark card)
       ├─ #workspace → .equipment-workspace (Surface :190-218; rect 748/215/642x476
       │   :243-247) chứa EquipmentBagSection | EnhanceTab | WashTab | RefineTab
       │   | DissolveTab | DecomposeTab theo activeWorkspace
       ├─ .equipment-notice <p role=status> :87 — luôn render, prod notice="" (:154)
       ├─ @click.self + @keydown.esc trên .equipment-scene :54 — click.self chết
       │   (global pointer-events:none :397, chủ đích theo comment :381-389);
       │   esc chết vì `inspecting` chỉ set qua fixture path
       └─ EquipmentPaperTooltip :85 — chỉ render khi inspecting (dormant prod)
```

## 2. UI logic inventory

### EquipmentPaperdoll.vue (452 dòng, `src/components/panels/`)

Inject: `useI18n` :38, `useGameManager` :39, `usePlayerStore` :40, `useStateVersion` → `{ stateVersion, bumpState }` :41 (**bumpState không dùng** — unequip tự bump qua `withSync` useEquipmentActions.ts:57), `useEquipmentActions` → `unequip` :6,:42 (wrap `equipmentOps.unequipItem` :102), `buildEquipmentTooltip` :10 (dùng :171), `useAudioStore` :23.

- `SLOT_COLUMNS = [[weapon,armor,boots],[helmet,necklace,ring]]` :52-55 → flatten `SLOT_SLOTS` :56; cell `--right` khi `index > 2` :259; `top: (index%3)*33.33%` :260.
- `equippedBySlot` :58-68: `gameManager.equipmentBag.getEquippedInSlot(slot)` per slot (:64; method EquipmentBag.ts:157 — `getAll` :149 tồn tại nhưng không dùng ở đây).
- `enhanceLevelBySlot` :73-83: `equipmentOps.getSlotState(slot).enhanceLevel` (:79; EquipmentOpsSystem.ts:436) — enhance gắn theo SLOT (EquipmentSlotState.ts:13-19 chỉ có `enhanceLevel` + `enhanceFailStreak`; docstring :5-11 nhắc Formation/Yem Phu nhưng interface chưa có field).
- `nameSegmentsBySlot` :126-146: `composeEquipmentNameSegments` + registry-miss fallback `[{text: itemId}]` :141 — **không render**: SlotView chỉ in nameSegments khi `showLabel` (SlotView.vue:291-300), prop không truyền.
- `tooltipBySlot` :151-187: `buildEquipmentTooltip(instance, template, affixRegistry, getSlotState(slot), zoneRegistry, undefined, mainStatRangeQuote)` :170-182 — equipped-only, `compareWith: undefined`; pinned test EquipmentPaperdoll.test.ts:99-122.
- `qualityRankBySlot` :193-203 → `professionGradeRank` (seal Phẩm); `rarityRankBySlot` :205-215 → `itemQualityRank` (aura/tint); `badgesBySlot` :217-227 → `[{kind:'enhance', text:`+${level}`}]` (:223). Seal + badge đều bị CSS ẩn (mục 4).
- Helpers: `itemName` :104-106 (registry-miss → itemId), `itemAccessibleLabel` :110-112 ("{name}, {grade}" spec 5b), `itemDescription` :114-116, `itemIcon` :118-120 (`instance.icon ?? template.icon`).
- `idleProfile` :88-90 (mortal fallback :89) + `idleClip` :91-98 (`resolvePlayerEntityKey` + `animatedArtFormFor`, CombatPresentationCatalogue.ts ~:713,:~791) → `.paperdoll__figure` EntitySpriteCanvas :241-253 (rAF loop EntitySpriteCanvas.vue:125-127, cancel :136) thay hẳn `.paperdoll__base` img :254 (v-else).
- `onSlotClick` :229-235: `emit('select', instance.instanceId)` (:231 — payload string trần, declare :46) → `useAudioStore().cue('ui.equip')` (:232) → `unequip` (:233). Click socket = tháo trang bị trên mọi workspace tab.
- `select` → Stage forward :15-17 → Surface `selectEquipped` :99-103 → `provide(HALL_SELECTION_KEY)` :109 — consumer duy nhất: WashTab (inject :34, guard :37) + RefineTab (:36,:39); EnhanceTab tự quản theo slot (comment :4-5, EnhanceTab.test.ts:4); DissolveTab tự quản (comment :4).

Props truyền mỗi SlotView socket :264-280: `variant="bag"`, `:item`, `:label` (slot name khi trống :268), `:accessible-label`, `:name-segments`, `:description`, `:equipment-quality-rank`, `:rarity-rank`, `:badges`, `:tooltip`, `:icon` (:278), `@click`. **Không truyền** `state`, `showLabel`, `amount`, `static`, `rarityRankScale`. (`v-tooltip` không phải prop truyền từ đây — directive nằm TRONG SlotView :248, feed bởi `:tooltip` + fallback `tooltipContent` :219-221.)

### EquipmentPaperdollStage.vue (66 dòng, `scenes/equipment/paperdoll/`)

`.equipment-paperdoll-stage` + `data-hk-region="paperdoll"` :21; `__plinth` span `art-needed data-art-id="equipment-stage-plinth"` :22-27 — radial-gradient jade placeholder :44-59; forward `select` :15-17; comment "Chien LUC plaque intentionally absent" :8-10; spec region 380x610 (:2 — khớp StableSceneArt :185 `width:380 height:610`) nhưng mount rect thật 369x348 (Surface :230-233).

### EquipmentSurface.vue (359 dòng)

`TABS` = 5 op ids :57-63 (enhance/wash/refine/dissolve/decompose); `visibleTabs` lọc `isBetaEquipmentTab` :70; `workspaceModes` prepend `{id:'equip'}` :72-79 → nav 6 nút; `activeWorkspace` ref mặc định `'equip'` :81; `selectWorkspace` refuse locked :83-89; `showFurnaceArt = activeWorkspace !== 'equip'` :93; `SUMMARY_STATS` 6 dòng :111-118 + `summaryRows` tổng `equipmentOps.getEquipmentModifiers` :125-143; `@back` → `ui.closeHomeOverlays()` :155. `useDialogFocus` (Escape→emit('back')) nằm ở **EquipmentFidelityScene.vue:7,:27**, không phải Surface (gắn keydown + Tab-trap lên `.equipment-scene` root, useDialogFocus.ts:37-60). Inline vars `--equipment-card-art`/`--equipment-tab-brush`/`--equipment-divider` :175,:192 — `--equipment-divider` chỉ feed rule chết `.equipment-workspace__divider` :324-331 → var chết theo.

### EquipmentBagSection.vue (`panels/bag-sections/`)

`nav.bag-section__chips` :309 → `<Chip>` :310-316 (Chip.vue:44 render `class="chip"` → ăn global `.chip` rules :52-53); grid `SlotView variant="bag"` đầy đủ chrome :321-336 (gồm `:state`, `:amount` — khác socket); click cell → `equip(instanceId)` :42; nút open-dissolve `emit('open-dissolve')` :305 (:31 declare). Không có search box (comment :24) → global `.bag-section__search` :54-55 KHÔNG chạm scope này.

### SlotView.vue (826 dòng, `src/components/common/`)

Props :26-91; variants 'item'|'equipment'|'bag' (SlotTypes.ts:37). 'bag' vẽ InkNineSlice `frame-s-slot` :254-259 trên bg `var(--slot-bg-image, url(inv-slot-backdrop.png))` :361,:378 — global :56-59 set `--slot-bg-image: var(--th-art-slot-frame)` cho mọi `.slot-view` → inv-slot-backdrop.png không bao giờ paint; hover-frame default `bag-slot-hover.png` :532 nhưng mọi variant override `slot-frame-hover.png` :555-561 → default chết (doc SlotTypes.ts:20-31 stale: ghi item hover = bag-slot-hover); seal `.slot-view__seal` :263 + seal-frame.png :598-622; badges :282-284 + `--enhance` :709-714; max-rank bar `::before` :391-399; `::after` rarity tint :405-412; quality aura tier 3/4/5 :165-173,:496-512 + `.fx-border-beam__fx` span :313 (class :237); `v-tooltip` :248 (tooltip.ts listeners :91-95 + document :40-44); `watch(() => props.icon)` reset icon-fail :107-109; `tooltipContent` fallback `{title: label, description}` :219-221 — **live**: mọi socket trống có tooltip tên slot; `showLabel` gate :291-300; `state` prop feed availability/interaction/validation/marker/comparison :181-208.

`variant="equipment"` (`--slot-bg-image: slot-backdrop.png` :563-565) có **0 importers** toàn src → dead variant; doc "ONLY the 6 worn slots" (SlotTypes.ts:27-30) stale vì paperdoll dùng 'bag' :266.

## 3. Art map

| Asset | Phần tử | Nguồn |
|---|---|---|
| `scene/equipment/equipment-paperdoll-base@2x.png` (380x610) | `.paperdoll__base` img (mannequin fallback) | StableSceneArt.ts:183-187 → `stableSceneArtUrl` EquipmentPaperdoll.vue:30; preload AssetBundleCatalog.ts:780; dùng :254 |
| `controls/equipment-circle-frame-v1.png` | `.paperdoll__frame` img x6 + fixture `::before` 88px + preview `EquipmentArtSlot circular` | EquipmentPaperdoll.vue:34,:263; FidelityScene:49,:116; EquipmentArtSlot.vue:28; resolver equipmentArt.ts:5-8 |
| `controls/equipment-brush-circle-v1.png` | `.paperdoll__ring` img | EquipmentPaperdoll.vue:35,:240 |
| Idle atlas/sheet theo entity | `.paperdoll__figure` EntitySpriteCanvas | EquipmentPaperdoll.vue:91-98,:242-252; CombatPresentationCatalogue (resolvePlayerEntityKey/animatedArtFormFor) |
| `source/shared-paper-page-v1.png` | `.equipment-sheet` bg | FidelityScene.vue:46,:55 |
| `controls/equipment-divider-v1.png` | `.equipment-divider` img + active-tab underline img | FidelityScene:47,:56; Surface:46,:184 |
| `controls/character-card-nine-slice-v2.png` | `--equipment-card-art` → summary border-image + workspace bg | FidelityScene:48,:75,:124; Surface:44,:192,:252 |
| `controls/equipment-tab-brush-v1.png` | `--equipment-tab-brush` → tab active ::before + bag-tabs fixture | Surface:45,:175,:314; FidelityScene:50,:137,:153 |
| `huyen-kim/scene/forge-v2/furnace-v1.png` | `.furnace-art` (mọi tab ≠ equip) | Surface:41,:93,:197-203,:260-270 |
| `runtime/slot-frame.png` qua `--th-art-slot-frame` | mọi `.slot-view` bg | TienHiepUiAssets.ts:8 → tien-hiep-ui.css:56-59 — socket đè `none` :394-395 |
| `ui/Slot/slot-frame-hover.png` | `.slot-view__hover-frame` mọi variant | SlotView.vue:555-561 — socket ẩn :405-407; live trong BagSection |
| `ui/Slot/seal-frame.png` | `.slot-view__seal` | SlotView.vue:608 — socket ẩn :410-412; live trong BagSection |
| huyen-kim chrome `frame-s-slot` | `.slot-view__frame-art` variant bag | SlotView.vue:254-259 — socket ẩn :400-402; live trong BagSection |
| `ui/Slot/inv-slot-backdrop.png` | fallback `--slot-bg-image` | SlotView.vue:361,:378 — **không bao giờ paint** (override :57); preload :541 |
| `ui/Slot/bag-slot-hover.png` | fallback `--slot-hover-image` | SlotView.vue:532 — **dead default** (override :559); preload :542; doc stale SlotTypes.ts:26 |
| `ui/Slot/slot-backdrop.png` | variant 'equipment' bg | SlotView.vue:564 — **dead variant**; preload :544 |
| radial-gradient jade (chưa có art) | `.equipment-paperdoll-stage__plinth` `art-needed` | EquipmentPaperdollStage.vue:22-27,:44-59 |
| `--th-art-building-plaque` | `.df-building` plaque | TienHiepUiAssets.ts:12 → tien-hiep-ui.css:155 |
| `equipment-paperdoll-base@1x` | preview `.character-stage` img | EquipmentPreview.vue:15 |

## 4. Conflicts / layers

**Global đè scoped (LIVE):**
- `tien-hiep-ui.css:50` `:is(#app,body) .paperdoll .paperdoll__base { width:85%; height:92%; opacity:1; display:flex }` — specificity (1,2,0) thắng scoped `.paperdoll__base { width:auto; opacity:0.55 }` (EquipmentPaperdoll.vue:318-332) → mannequin fallback (khi không idleClip) render to 85%, đục full, display:flex thay vì nền mờ auto-width.
- `:51` + `:32-33` `.paperdoll__base .player-portrait__*` — **dead**: `__base` giờ là `<img>` lá :254.

**Chiến specificity có chủ đích:**
- `:is(#app,body) .slot-view { --slot-bg-image; background-image }` :56-59 đánh mọi slot-view; socket né bằng `:is(#app) .paperdoll__slot-wrap .paperdoll__slot { --slot-bg-image:none; background-image:none; box-shadow:none; border-radius:0 }` (:380-399). Hệ quả: `.paperdoll__slot { border-radius:50% }` (:436-438) bị đè thành 0 → rule chết.

**Suppression CSS tự đè component con** (:400-422): `:deep` display:none `__frame-art` :400-402, `__hover-frame` :405-407, `__seal`+`__badge` :410-413; icon-wrap `inset:20%` :416-418. Mâu thuẫn nội bộ: comment :432-435 khẳng định "max-rank bar and the shared pale-gold hover frame still ride on top" — nhưng hover-frame đã bị ẩn :405-407. `::before` max-rank bar :391-399 + `::after` rarity tint :405-412 + `.fx-border-beam__fx` :313 **không** bị ẩn → item Phẩm/Chất cao vẫn vẽ bar ngang, tint tròn và beam vuông quanh khung tròn.

**Component trùng vai trò / phiên bản song song:**
- 3 implementation doll/sockets: production EquipmentPaperdoll (img frame + SlotView); fixture `.equipment-sockets` + EquipmentPaperItem (item render 64x64 — base `.gear-item` 74px bị override `:deep` FidelityScene:117; grid col 74px :114; `::before` circle 88px :116) dormant trong prod (slot #doll luôn được fill Surface :157-161), live ở preview `EquipmentPreview.vue:31` qua `legacy/ui-equipment.html` ← `ui-preview/equipment.ts`; và `ui-preview/equipment/EquipmentPaperdollPreview.vue` (slots 91px :78, `EquipmentArtSlot circular` :27) qua `HomeEquipmentArtPanel.vue:53` ← `LandscapeDesignPreview.vue:65` ← `ui-landscape-design.html`. HomeEquipmentArtPanel còn mount `EquipmentBagPreview` :55-56 + `EquipmentForgePreview` :57-61 — 2 nửa workspace của composition preview.
- `scenes/equipment/fidelity/ForgeFidelityScene.vue` — scene forge fixture thứ hai, mount bởi `ui-preview/ForgePreview.vue:5,14` ← `ui-preview/forge.ts` ← `legacy/ui-forge.html`.
- Fixture workspace (`inspecting` :29, `mode`/`modes` :30,:33, `selected` :31, `forgeItem` :32, `BAG_COLUMNS` :36, `emptyBagCells` :37-40, `ForgeFidelityWorkspace`, `ForgeBatchBag`, `EquipmentPaperTooltip` :85) — toàn bộ trong default slots, dormant trong prod.
- Dead family `.equipment-paper`: scene cố ý đổi tên class sang `equipment-sheet` (comment FidelityScene:41-45) → mọi rule `:is(.equipment-paper)` chết: :25 (band 156/1272), :177-180 (border-image+bg), :253-256 (::before/::after paint), :278-280 (::before bg), :344-346 (::before inset). `.equipment-title` cũng chết: :99-103 (plaque), :135-148 (shine), :358-361 (restyle).
- `.equipment-workspace__divider` :324-331 + var `--equipment-divider` :192 — dead (không element; var chỉ feed rule này).
- `.equipment-workspace nav button:focus-visible` :332-335 — dead: scoped selector không tới child-component elements (`nav.bag-section__chips` BagSection:309 tồn tại nhưng không mang data-v của Surface).
- `qi-hall.css` (`panels/equipment-hall/`) — vẫn import sống bởi EquipmentHallPanel.vue:9 (ownership-guard test) nhưng toàn bộ ~27 selector `qi-hall__*` structural (`__body/__split/__slot-grid/__slot/__preview-card/__compare-table/__empty/__owned/__costline/__warning/__primary-action/__info-row/__button-row`, :21-227) có **0 DOM consumer** trong src. `.qi-hall__slot-grid` :59-72 KHÔNG render bởi op tabs — mỗi tab tự dựng socket strip scoped riêng: `.enhance-slot-strip` (EnhanceTab.vue:272-286), `.wash-slot-strip` (WashTab.vue:266-279), `.refine-slot-strip` (RefineTab.vue:305-318) — "socket list song song" vẫn tồn tại trong cùng màn, chỉ CSS gán vào là riêng. Riêng `qi-hall__tier-N` được emit qua `tierClass()` (equipmentHallDisplay.ts:18) nhưng mỗi tab redefine scoped (WashTab.vue:410-414, RefineTab.vue:451-455) → bản global match rồi thua.
- `tien-hiep-collections.css` (`src/assets/`, 281 dòng) — **file mồ côi hoàn toàn**: không trong main.ts (:5-11), không `@import` chain, 0 element mang `.th-collection`/`.pc-collection`. Chứa sẵn override `.equipment-doll` (:117 — 200/229/465x355; :246 — 96/174/490x410), `.equipment-sockets` :119, `.equipment-subtitle` :115, `.equipment-upgrade` :116,:211, `.equipment-summary` :120-124,:247-249, `.equipment-workspace`/`.equipment-bag`/`.equipment-forge` :125-136,:250-252, `.equipment-preview`/`.equipment-notice` :24,:31,:209-210 — mìn: wire nó lên là reskin toàn bộ doll region.
- `.equipment-hall__tabs` — dead branch trong `:is(.tab-bar,.equipment-hall__tabs,.worker-lodge__tabs)` (tien-hiep-secondary-ui.css:65); không element nào mang class.
- Global khác chạm workspace: `.chip`/`.chip.is-active` :52-53 (đánh chips filter của BagSection qua Chip.vue:44); `.ink-nine-slice--hk.ink-nine-slice--hk-frame { box-shadow:none }` :85 (đánh frame-s-slot trong BagSection cells — socket đã suppression nên không ảnh hưởng socket).
- `.equipment-scene` scoped `pointer-events:auto` (FidelityScene:92) — dead: (0,1,0)+attr thua global (1,1,0) :397. Theo comment :381-389 đây là **documented design** (rail-click fix), không phải conflict — backdrop clicks fall through về DongFuStage empty-space handler.
- `useBuildingHeaderState(buildingId)` (FunctionOverlayPanel:91) — computed chạy nhưng header UI chỉ mount trong scroll/legacy templates (:131-149,:170-188) → dead plumbing trên paper path.

**Dead files (0 importers, kể cả preview):** `scenes/equipment/bag/EquipmentBagPanel.vue` (InkNineSlice `chrome-id="surface-m-panel"` :20-26 + BagGrid + `data-hk-region="bag-grid"` :19 — bị BagSection thay); `panels/equipment-hall/EquipmentBagRail.vue` (rail trang bị compact cạnh doll); `scenes/equipment/detail/EquipmentItemDetail.vue` (item-card detail — đích đến scaffold của emit `select`, chưa nối).

## 5. Logic không có hình ảnh

- `badgesBySlot` + `enhanceLevelBySlot` (:73-83,:217-227): enhance +N của slot tính đầy đủ → badge bị suppression :410-413 → mất bằng chứng hình ảnh của cơ chế "enhance gắn theo slot" (comment :70-72 tự nhận là minh chứng trực quan).
- `nameSegmentsBySlot` :126-146: computed 2-dòng caption không render vì `showLabel` không truyền (gate :291-300).
- `emit('select', instanceId)` :231: scaffold cho EquipmentItemDetail (dead); phần dùng thật là HALL_SELECTION (chỉ Wash/Refine inject) — nhưng click vừa select vừa unequip nên instance rời equipped list tức thì.
- `bumpState` destructure không dùng :41.
- `qualityRankBySlot`/`rarityRankBySlot` feed seal + aura — seal ẩn; aura box-shadow bị `box-shadow:none` :398; chỉ còn ::after tint + beam sót lại.
- `state` prop không truyền → socket không thể hiện marker/disabled/comparison (BagSection cells thì truyền :332). EquipmentSlotState.ts:13-19 chưa có locked/formation field để feed marker.
- Fixture state + fixture components (mục 4) — allocated mỗi mount, dormant trong prod.
- `.equipment-notice` `<p role=status>` luôn render rỗng (:87; `notice=""` Surface:154; CSS :146 chiếm 13px height — không được rule collapse-empty như `.exploration-details .notice:empty` :249).
- `@keydown.esc` trên `.equipment-scene` (:54) clear `inspecting` — `inspecting` không bao giờ set trong prod (chỉ qua `@inspect` của fixture EquipmentPaperItem :72,:81).
- `useBuildingHeaderState` :91 + var `--equipment-divider` :192 — plumbing/var chết trên path này.
- `data-hk-region="paperdoll"` :21 + `art-needed`/`data-art-id` — metadata pipeline art, không consumer runtime trong src.

## 6. Hình ảnh không có logic

- `.paperdoll__ring` brush-circle img :240 — trang trí thuần, hover/focus không đổi.
- `.paperdoll__frame` circle-frame img x6 :263 — khung trang trí; hover chỉ CSS filter brightness 1.65 + drop-shadow :374-376, không state.
- `.equipment-paperdoll-stage__plinth` :22-27 — gradient stand-in chờ art (`art-needed`), không logic.
- `.paperdoll__label` :282 — label tĩnh `panels.bag.paperdoll.slots.*` (vi.json:547-556: Đạo Quan/Linh Châu/Linh Giới/Đạo Khí/Đạo Bào/Đạo Hài), không phản ánh trạng thái slot.
- `.equipment-divider` img :56, `.equipment-subtitle` :62 — trang trí/tĩnh.
- `.furnace-art` :197-203 — decorative (v-if `showFurnaceArt`, không interactivity).
- Fixture `.equipment-sockets`/`.equipment-bag`/`.equipment-forge`/`.character-stage` DOM :71-82 — trưng bày preview page, production không tới.
- `.equipment-preview` stamp :87 — `preview` prop false trong prod → không render (render ở harness EquipmentPreview.vue:31).

## 7. Open questions

1. Variant `equipment` của SlotView 0 importers (paperdoll dùng 'bag' + ẩn chrome) — xoá variant + `slot-backdrop.png` + sửa doc SlotTypes.ts:20-37, hay giữ cho surface khác?
2. `tien-hiep-ui.css:50` đè scoped `.paperdoll__base` (85%/opacity 1/display:flex thay vì nền mờ) — cố ý legacy override hay rule sót cần xoá?
3. `emit select` → EquipmentItemDetail (dead) — detail card còn roadmap (giữ scaffold), hay bỏ emit để click = unequip thuần?
4. Click socket = unequip ngay trên mọi tab — kể cả đang ở Tẩy/Tinh Luyện (vốn cần item vẫn equipped để op); có cần chặn unequip ngoài tab 'equip'?
5. Suppression ẩn seal + enhance badge nhưng sót max-rank bar/::after tint/fx-beam trên socket tròn — bộ lọc suppression cần phủ hết hay chừa là ý đồ?
6. Spec region 380x610 (Stage :2 + StableSceneArt :185) vs mount rect 369x348 (Surface :230-233) — doll bị bóp theo bên nào?
7. Fixture doll/sockets nằm trong `EquipmentFidelityScene.vue` (production file) — tách sang preview-only component hay giữ default slot làm bảo hiểm?
8. `.paperdoll__label` hiển thị tên slot cố định — có muốn đổi thành tên item/enhance khi đã mặc (label prop đã feed sẵn)?
9. `qi-hall.css` chết toàn bộ nhưng được giữ bởi ownership-guard test + import sống tại EquipmentHallPanel.vue:9 — xoá sheet + test, hay giữ làm shared vocabulary?
10. `tien-hiep-collections.css` file mồ côi chứa sẵn override `.equipment-*` — xoá file, hay đó là reskin pending cần wire?
11. Dead preload art (inv-slot-backdrop :541, bag-slot-hover :542, slot-backdrop :544) — gỡ khỏi AssetBundleCatalog? (Giữ seal-frame :545 + slot-frame-hover :543 — live qua BagSection.)
12. `.equipment-scene` scoped `pointer-events:auto` (FidelityScene:92) + `@click.self` (:54) chết do global rail-fix :397 — xoá 2 cái dead này hay giữ như intent marker?

## Adjudication

Verify từng Missed/Wrong trên code 8ffc8e64. Kết quả: **chấp nhận 14/14 Missed + 16/16 Wrong**, 0 reject; 3 amplification tự thêm.

**Missed — tất cả chấp nhận:**

1. `tien-hiep-collections.css` chết: confirm — không import (main.ts:5-11), 0 emitter `.th-collection`/`.pc-collection`, chứa đúng overrides được trích (:115-136,:209-211,:246-252). Mìn reskin nếu wire lên.
2. `scenes/equipment/bag/EquipmentBagPanel.vue`: confirm 0 importers; file 53 dòng đúng mô tả (InkNineSlice surface-m-panel + BagGrid + data-hk-region :19-28).
3. `ForgeFidelityScene.vue`: confirm — mount bởi ui-preview/ForgePreview.vue:5,14 (chain forge.ts ← legacy/ui-forge.html).
4. `BuildingUpgradeButton` live: confirm import :8, mount :65, pin :106, deep cost :109 — render trên production surface, nằm ngoài mọi named slot.
5. `.equipment-subtitle` live: confirm :62 (i18n) + CSS :105.
6. Live listeners: confirm rAF EntitySpriteCanvas:125-127 (cancel :136); ResizeObserver SceneDesignCanvas:7,:20-21; v-tooltip listeners tooltip.ts:91-95 + document :40-44; useDialogFocus keydown+Tab-trap useDialogFocus.ts:37-60; `watch(props.icon)` SlotView:107-109.
7. `qi-hall.css` chết: confirm — 0 DOM consumer cho structural selectors; `qi-hall__tier-N` emit (equipmentHallDisplay.ts:18) nhưng scoped redefines thắng (WashTab:410-414, RefineTab:451-455); sheet sống nhờ import EquipmentHallPanel.vue:9 + guard test. Socket list song song có thật nhưng là `enhance/wash/refine-slot-strip` scoped riêng — report gán sai CSS.
8. Dead asset plumbing: confirm `bag-slot-hover.png` là default bị override (:532 vs :555-561; doc SlotTypes.ts:26 stale); preloads AssetBundleCatalog:541-545,:780; `--equipment-divider` var :192 chỉ feed rule chết :324-331.
9. `.equipment-paper` dead family: confirm :25,:177-180,:253-256,:278-280,:344-346 (rename cố ý FidelityScene:41-45).
10. `.equipment-scene` scoped `pointer-events:auto` chết (thua (1,1,0) :397) + :381-389 là documented design: confirm — không frame như "conflict".
11. `.equipment-hall__tabs` dead branch secondary-ui.css:65: confirm 0 usage toàn src.
12. `.chip` :52-53 + `.ink-nine-slice--hk-frame` :85 chạm BagSection (Chip.vue:44): confirm. **Sửa nhỏ**: `.bag-section__search` :54-55 KHÔNG chạm EquipmentBagSection (không search box :24) — rule đó chạm bag-section khác (inventory/material).
13. `EquipmentBagPreview` + `EquipmentForgePreview` preview siblings: confirm HomeEquipmentArtPanel.vue:55-61.
14. `useBuildingHeaderState` dead trên paper path: confirm :91 — header render chỉ trong scroll (:131-149) + legacy (:170-188) templates.

**Wrong — tất cả chấp nhận (đã re-check từng cái):**

1. `equippedBySlot` dùng `getEquippedInSlot(slot)` :64, không phải `getAll` (getAll tồn tại EquipmentBag.ts:149 nhưng không dùng).
2. Emit `select` payload = `instance.instanceId` string trần (:46,:231); Stage forward string :15-17.
3. `:icon` IS bound :278 qua `itemIcon()` :118-120 — helper này cũng đã sót khỏi inventory gốc.
4. `v-tooltip` nằm TRONG SlotView :248 feed bởi `:tooltip`, không nằm trong danh sách prop paperdoll truyền.
5. `TABS` = 5 op :57-63; `equip` prepend trong `workspaceModes` :72-79; default là `activeWorkspace` :81 (không có `activeTab`).
6. `useDialogFocus` ở EquipmentFidelityScene.vue:7,:27; Surface chỉ bind `@back` :155. Sót Tab-trap + keydown listener.
7. `tooltipContent` fallback :219-221 live — mọi socket trống có tooltip tên slot; "nhánh fallback chết" sai.
8. `.qi-hall__slot-grid` không render bởi op tabs (sheet chết; strips dùng class scoped riêng).
9. Hàng loạt line ref script lệch revision cũ (inject :27-28 thật :39-41; equippedBySlot :58-68; enhanceLevelBySlot :73-83; nameSegmentsBySlot :126-146; tooltipBySlot :151-187; qualityRankBySlot :193-203; rarityRankBySlot :205-215; badgesBySlot :217-227; idleClip :91-98; art map :30/:34/:35/:240/:254/:263; template refs đúng) — đã sửa toàn bộ trong report này.
10. Badge shape `{kind:'enhance', text:`+N`}` :223 (render `badge.text` SlotView:283), không phải `{level}`.
11. Order emit :231 → cue :232 → unequip :233.
12. Fixture item render 64x64 (`:deep(.gear-item)` FidelityScene:117); 74px là grid col :114 + base `.gear-item`.
13. Specificity global là (1,2,0) `:is(#app,body) .paperdoll .paperdoll__base`, không (1,1,0) — kết luận đè vẫn đúng.
14. `.df-building` render trong `fidelity/DongFuHomeContent.vue:42-53` (không phải "trong DongFuStage.vue"); pin là 1 dòng :165 (block :152-176).
15. `equipmentArt.ts` chỉ là resolver (root :5, fn :6-8); ref thật: EquipmentPaperdoll.vue:34-35, FidelityScene.vue:49-50, EquipmentArtSlot.vue:28.
16. `inv-slot-backdrop.png` không bao giờ paint (`--slot-bg-image` global :57 đè fallback :361,:378); bg thật mọi slot-view = `runtime/slot-frame.png`; socket bị `none`.

**Rejected: 0.**

**Amplifications tự thêm:**
- Missed #8 siết lại: chỉ 3 PNG thật sự warm-for-nothing (`inv-slot-backdrop` :541, `bag-slot-hover` :542, `slot-backdrop` :544); `seal-frame` :545 + `slot-frame-hover` :543 vẫn LIVE qua BagSection cells — không nên gỡ khỏi bundle.
- Mount tree report gốc sót 2 phần tử LIVE trên scene: `.equipment-subtitle` :62 + `BuildingUpgradeButton` :65 — đã bổ sung vào §1.
- `.equipment-notice` rỗng không chỉ là dead text: rule `:empty` collapse (:249) chỉ viết cho `.exploration-details .notice` — `.equipment-notice` (class khác) không được hưởng nên vẫn chiếm `height:13px` :146 dù trống.
