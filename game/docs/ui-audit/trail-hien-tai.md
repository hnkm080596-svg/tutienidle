# Panel: Trail / Điều hướng hiện tại (home nav rail + command wheel + seams + quest tracker + panel open flow)

Audit trên branch `devin/artui-c0-foundation` @ `8ffc8e64`, thư mục `game/`. Đường dẫn là `game/src/` trừ khi ghi chú. Đã adjudicate: mọi cite đã re-verify trên snapshot này.

## 1. Mount chain

Từ route đến DOM:

- `App.vue:63` import + `App.vue:1293` `<GameRoot v-if="isBooted" :inert="authorityOverlayActive" />` — hai gate ở TRÊN GameRoot: `isBooted` (:147, set :1084) và `authorityOverlayActive` (:820-821, inert khi reconnect/terminal overlay).
- `GameRoot.vue:138` mount `<MainScene @click="closeSidePanels">`; `GameRoot.vue:140` bọc toàn bộ panel chrome trong `v-if="!isFullSceneActive"` — `isFullSceneActive` = route `combat | tribulation` (`useCombatSceneActive` :66 + routeAdapter :67-72).
- `MainScene.vue:18-20`: `.main-scene` chứa đúng 2 thứ — `<DongFuStage />` (overlay DOM `position:fixed` qua `SceneDesignCanvas`) và `<PhaserCanvas />` nằm DƯỚI stage (comment `MainScene.vue:12-17`). Không còn `df-grid`/`left-panel`/`right-panel` legacy DOM.
- `SceneDesignCanvas.vue` — cơ chế scale chung cho MỌI "scene nhìn như design": viewport `position:fixed; inset:0` (:37), canvas 1440×810 đặt giữa + `transform: translate(-50%,-50%) scale(...)` (:8-11) đo bằng `ResizeObserver` (:16-24). Variant `--overlay` transparent + click-through (:41-42) — home canvas KHÔNG overlay, panel canvas overlay.
- `DongFuStage.vue:412-496`: `<SceneDesignCanvas v-if="!stageActive">` (`useStageActive` = route combat/tribulation, `useStageActive.ts:16-19`) → `<main class="df-scene hk-art-scene landscape-design">` (:413-419) chứa TOÀN BỘ chrome home:
  - profile card `.home-design-profile` (:421-427, `data-df-ui`)
  - currency chips `.home-design-currencies` → `PcPaperButton` (:428-432, `data-df-ui`)
  - quest tracker card `.home-design-quest` (:433-445)
  - nav rail `<aside class="home-navigation-surface">` (:446-470, `data-df-ui`) + seam img (:471) + toggle `»` (:472-479)
  - `<DongFuWheel>` (:480-485) + `<DongFuBoard>` (:486-491) + `<AutoFarmIndicator>` (:492) + `.df-notice` (:493, `data-df-ui`) + `.pc-paper-scene__frame` (:494)
  - `<FeedbackDialog>` (:497) mount NGOÀI `SceneDesignCanvas` (viewport-level, `open=feedbackOpen`).
- Panel host (ngoài stage, trong GameRoot):
  - `LeftPanel.vue:16-19`: `Transition th-panel-swap` → `CharacterSurface` khi `ui.characterOverlayOpen && ui.characterSceneTab === 'character'`, ngược lại `InventoryPanel` khi `characterOverlayOpen`.
  - `FunctionOverlayPanel.vue`: `mode` = `ui.leftPanelMode` beta-gated + bỏ character/inventory (:69-77). Ba lớp render: `paperMode` Transition (stage_select/pill_room/equipment_hall/settings → surface riêng, :79-81 + :113-118), `ImperialScrollScene` cho `scrollMode` (chỉ còn `exploration`, :82-84 + :122-155, `ProductionPanel` :153), `OverlayPanel` cho `legacyMode` (worker_lodge/scripture_pavilion/vendor, :85-87 + :158-195).
  - Standalone panels: `GameRoot.vue:15-23` `defineAsyncComponent` ×9; `mountedStandalone` Set lazy-once (:77) + watch (:78-100) — mount seam kèm beta-gate `isBetaStandalonePanel` (:85) + technique bounce toast `panels.hkNav.techniqueLocked` (:89-95). `v-if="mountedStandalone.has('<id>')"` :156-174; mỗi panel tự gate `ui.standalonePanel === '<id>'` trong `Transition th-panel-swap` (vd `QuestPanel.vue:30`). Idle prefetch 9 chunks :110-123.
  - `RouteMount` :205 — renderless mount witness (báo route đã render cho coordinator, `RouteMount.vue`).
  - `CombatSceneOverlay` :177 / `TribulationSceneOverlay` :178 — overlay riêng ngoài block `!isFullSceneActive`... thực ra `v-if`/`v-else-if` độc lập (:177-178).
- Store keys (`stores/ui.ts`): `leftPanelMode` :123, `characterOverlayOpen` :125, `characterSceneTab` :130, `isCommandWheelOpen` :135, `standalonePanel` :151. Union định nghĩa ở `presentation/contracts/panelIds.ts:19-47`.

## 2. UI logic inventory

### DongFuStage.vue (trung tâm trail)

- `surfaceOpen` :56-58 = `leftPanelMode || characterOverlayOpen || standalonePanel` — lái `.df-scene--covered` (:416), seam (:471), gate phím tắt (:389,:397).
- `feedbackOpen` ref :60 (ngoài store) + watch `surfaceOpen` tự đóng dialog (:67-69).
- `boardOpen` :61 (default true) → `DongFuBoard :open`.
- `railCollapsed` :62 + `railIndicator` :63 + `toggleRail` :71-76 + `onRailTransitionEnd` :78-80 → `.df-scene--rail-collapsed` (:416), nút `»` (:472-479), `«` (:462-469).
- `notice` + `noticeTimer` + `flashNotice` :82-95 — `setTimeout` 3200ms (:88-91), clear `onBeforeUnmount` (:93-95); nguồn duy nhất: `onWheelAction` fallback `t('dongFu.unhandled')` :358.
- Wheel: `disabledContext` :100-107 (artifact/companion/formation unlock + release-ceiling reads); `renderedSlots` = `betaWheelSlots().filter(s => s.available())` :109; `SLOT_SYMBOL` :111-127 (slot→symbol svg); `slotDisabledReason` :129-131; `slotActive` :133-142; `slotBadge` :144-153; `slotAction`/`wheelActions` :155-166.
- Board: `KIND_SYMBOL` :170-176 + `boardEntries` :178-188 (map `useThienCoEntries().entries` → `DongFuUiOpportunity`).
- Rail: `NAV_LOCKED` :203 (5 id: artifact/companion/guild/sect/portal luôn khóa); `NAV_ITEMS` :204-208 (**21 id** = 16 inline + `...NAV_LOCKED`); `NAV_FEATURE_LOCKED` :214-216 (`formation`→`tran_phap`); `navLocked` :217-221; `NAV_TARGET` :226-245 (id→mở surface; `feedback` đóng overlay + mở dialog local :241-244; **'home' KHÔNG có target** — `navAction` xử riêng :286-289 → `closeHomeOverlays`, tức item home là nút "về nhà/đóng overlay"); `NAV_ACTIVE_PANEL` :249-257 + `NAV_ACTIVE_STANDALONE` :258-265 + `navActive` :267-278 (home :268 + character/inventory special-case :271).
- `navAction` :280-291 (cue `ui.wheel.select` :282 — cue tồn tại trong `AudioCueManifest.ts`; đóng `feedbackOpen` khi bấm id ≠ feedback :285).
- `currencyChips` :298-307 (`useCurrencyChips` + `CHIP_ICON` :298 gán crystal/jade/coin/essence **theo index** — reorder `SPIRIT_STONE_MATERIALS` (`useCurrencyChips.ts:35-39`) là icon lệch); `trackedQuest`/`questCard` :309-325 (`questOps.getBetaQuestSurfaceModels`, ưu tiên claim.available); `profileProgress` :327.
- `activateSlot` :330-345 (wheel slot → openBuilding | openLeftPanel | openStandalonePanel, đóng wheel trước); `onWheelAction` :347-359 (ưu tiên entry Thiên Cơ → slot → notice "chưa mở").
- `INTERACTIVE_SELECTOR` :364 = `button, a, input, select, textarea, [role="button"], [data-df-ui]` — marker của `onSceneClick` :366-369: click KHÔNG trúng interactive → `ui.closeHomeOverlays()`. `data-df-ui` chỉ đánh dấu "vùng không-trống" cho hit-test này (chỉ 4 element: profile :421, currencies :428, rail :446, notice :493 — quest card là `<button>` nên đã nằm trong selector).
- `isEditableTarget` :371-378 + `onKeydown` :380-401 gắn ở `window` (:403-408): `Escape` → `closeCommandWheel` (:381-384, **chạy TRƯỚC** check `isEditableTarget` :386 → Escape trong input vẫn đóng wheel; KHÔNG đóng panel); `Tab` → `preventDefault` + `toggleRail` (:389-395, gate `!stageActive && !surfaceOpen` — native focus navigation trên home bị chiếm); `` ` `` → `ui.toggleCommandWheel` (:397-400, thêm gate `!feedbackOpen`).

### DongFuWheel.vue (`components/scenes/dong-fu/fidelity/`)

- Props `{actions, selected, open}` :5; emit `action[id]` :6.
- Single-ring geometry (comment R9 :8-13): `RING_RADIUS=187, RING_CENTER=210, ORB_HALF=36.5` :14-16; `nodes` :17-27 chia đều 360/N; `activate` :28-31 chặn `disabledReason`.
- `v-show="open"` :34 — mount thường trực, ẩn bằng CSS.
- Class state `is-selected / is-active / is-disabled` :40 + `aria-pressed` :45 + `.df-node__badge--alert|dot` :51 — `is-selected`/`aria-pressed` dead vì stage truyền `:selected="null"` (:482).

### DongFuBoard.vue (cùng thư mục)

- Props `{entries, open}` :5; emits `action/toggle` :6.
- `.df-board` + `is-collapsed` :10; `InkNineSlice chrome-id="surface-l-drawer"` :11 (asset `huyen-kim-chrome.json:86-97` → `runtime/surface-l-drawer@2x.png`, status ready); heading toggle :12; `v-show` entries :13; mỗi entry: symbol svg + label/detail i18n + `.df-board__go` CTA → emit action :18.

### Composable / store điều hướng

- `useThienCoEntries.ts`: `MAX_ENTRIES=4` :28, `TICKER_MS=30_000` :29 + `setInterval` recompute `nowMs` :49-53 (**live ticker 30s chạy thường trực** — kể cả board collapsed/panel mở — phục vụ countdown alchemy :124), `PRIORITY` order :31-37, duyệt `DONG_FU_BUILDING_IDS` :100, sort+slice :150-152.
- `useBuildingNavigation.ts`: `getBuildingPresentation` :44-64, `getBuildingStatus` :81-107 (locked>ready>active>upgradeable>default), `upgradeBuilding` :115-135, `openBuilding` :137-155 — fail-closed `isBetaBuildingSurface` :141, mở `openLeftPanel(template.functionType)` :152-153.
- `commandWheelCatalog.ts`: `CommandWheelSlot {id, ring, labelKey, buildingId?, target?{left_panel|standalone}, available, disabledReason}` :16-41; 15 slot gồm `talisman_slot` `available: NEVER_AVAILABLE` :150-155; ring 4 = scripture_pavilion (:230-237, comment "entry duy nhất là shortcut nay" :234) + settings (:238-241).
- `core/betaScopeSurface.ts`: `featureAdmits` :41-46 (unlisted→fail-closed, null→ship); `BETA_WHEEL_SLOT_FEATURES` :64-80 (`talisman_slot: null` :70 → được admit rồi bị `renderedSlots` :109 lọc — slot zombie; `chi_hien_quan: 'manualWorkforce'` :76); `isBetaWheelSlot` :83-85; `betaWheelSlots` :92-94; `BETA_BUILDING_FEATURES` :108-115 + `isBetaBuildingSurface` :118-120; `BETA_STANDALONE_PANEL_FEATURES` :132-144 + `isBetaStandalonePanel` :165-167; `BETA_LEFT_PANEL_FEATURES` :152-163 (`worker_lodge:'manualWorkforce'` :159) + `isBetaLeftPanelMode` :169-171.
- `stores/ui.ts`: `toggleLeft` :199-224 (toggle + special-case character/inventory :208-212), `openLeftPanel` :226-242 (character/inventory → `characterOverlayOpen`+`characterSceneTab`, phần còn lại → `leftPanelMode`; luôn `closeHomeOverlays` trước), `openStandalonePanel` :244-255, `closeHomeOverlays` :258-263 (đóng cả wheel :262), `toggleCommandWheel` :265-274 (đóng overlays rồi mở), `closeCommandWheel` :276-278.
- `FunctionOverlayPanel.vue`: `TITLE_KEYS` :25-34; `IMPERIAL_MODES` :41-47; `PAPER_MODES` :53-58 (4 mode tự sở hữu paper chrome); `BUILDINGS` :60-67 (mode→buildingId cho header); `useBuildingHeaderState` :91 (`artPath` = `/assets/buildings/dong-fu/v2/{id}/base.png`, `useBuildingHeaderState.ts:36` — LIVE qua `.building-heading__art` :133-139 + :172-178); `artBroken` :96-100; `close` → `closeHomeOverlays` :102-104.
- `GameRoot.vue`: `mountedStandalone` watch :78-100 (technique bounce + toast :89-95); idle prefetch :110-123; `closeSidePanels` :130-132.
- `useCurrencyChips.ts`: `spiritStoneChips` :32-40 (3 tier Linh Thạch theo `SPIRIT_STONE_MATERIALS`), `companionChips` :47-66 (beta-gated → luôn rỗng), `chips` :68.
- `SceneDesignCanvas.vue`: observer+scale :12-24, overlay click-through :41-42, `isolation:isolate` trên canvas :43 (mọi z-index trong canvas bị giam — chrome home không out-z được panel canvas).

### Dialog/focus contract

- `useDialogFocus.ts`: focus-on-open → Tab cycle trong card (Tab bị chặn luôn, :44-60) → Escape callback (:38-40) → restore. Các panel tự lo Escape: `ImperialScrollScene.vue:33`, `OverlayPanel.vue:39`, fidelity scenes qua `useDialogFocus` (vd `CharacterFidelityScene.vue:29`).
- **`tien-hiep-ui.css:381-411` — block "Rail over panels"**: 11 root fidelity scene (`.cf-scene`, `.skill-paper-scene`, `.realm-paper-scene`, `.technique-paper-scene`, `.body-paper-scene`, `.alchemy-scene`, `.inventory-scene`, `.equipment-scene`, `.quest-scene`, `.settings-scene`, `.exploration-scene`) bị `pointer-events:none` (:390-400), con trực tiếp `> *` giữ `pointer-events:auto` (:401-411). Comment :381-389 mô tả intent: rail không out-z được overlay canvas → fix bằng hit-test — backdrop click fall-through xuống `DongFuStage.onSceneClick` → đóng panel, còn rail vẫn bấm được.
- Hệ quả: **mọi `@click.self` backdrop-dismiss của 11 fidelity scene là dead** (`.cf-scene` CharacterFidelityScene.vue:32, skill :57, realm :20, technique :24, body :36, alchemy :43, inventory :39, equipment :54, quest :38, settings :33, exploration :21) — root không bao giờ là click target; scoped `pointer-events:auto` của từng scene (vd :49) bị đè bởi `:is(#app,body)` (specificity cao hơn) và comment local đã stale. `.hk-scroll` (`ImperialScrollScene` :47) và `.overlay-panel` (`OverlayPanel` :53) KHÔNG nằm trong list → `@click.self` của chúng vẫn live.
- `.th-panel-swap` spec `tien-hiep-ui.css:367-379` — transition dùng bởi LeftPanel/standalone/panels.

### Legacy/preview còn trong scope

- `usePaperNavigation.ts` (143 dòng): `PAPER_NAV_IDS` :29-41 + `NAV_TARGETS` adapter :43-59 — KHÔNG có caller production (chỉ `ui-preview/paperNavigation.ts:1`; `SettingsSurface.vue:4` chỉ comment).
- `PaperPanelNavigation.vue`: mount duy nhất ở `ui-preview/PaperPreviewSurface.vue:19`. `CharacterFidelityScene.vue:5` chỉ là comment R9 ("no PaperPanelNavigation"), không mount.
- `PcPaperSceneActions.vue`: không ai import → dead hoàn toàn.
- `commandWheelOrbit.ts` (7 dòng): `getCommandWheelOrbitDirection` không caller → dead (wheel giờ single-ring, `DongFuWheel.vue:8-13`).
- `CurrencyHud.vue`: không importer production (chỉ `CurrencyHud.test.ts` + comment `MaterialBagSection.vue:129`, `useCurrencyChips.ts:2`) → dead. Hệ quả: importer duy nhất của `DongFuResourcePill.vue` là CurrencyHud → pill dead theo (KHÔNG phải preview chain).
- Chuỗi preview `DongFuFidelityScene.vue` → `DongFuVista` + `DongFuHomeContent` → `DongFuHud`/`DongFuArtFrame`/`DongFuWheel`/`DongFuBoard`: `.df-buildings` plaques (:41-67), `.df-cultivator` wheel-toggle (:68-75), `.df-location` title (:92-95), `.df-quest` tracker cũ (:96-109), `.df-resources`/`.df-identity`/`.df-utilities`. Tất cả dormant trong prod. Comment `DongFuHomeContent.vue:2-6` + `DongFuFidelityScene.vue:2-4` còn nói "production mounts the same content through DongFuStage" — **stale**, DongFuStage không import chúng nữa.
- `LandscapeDesignPreview.vue:29-40,61-62` — mock mà rail production copy: cùng `.home-navigation-surface` + backing + seam + `home-independent-navigation`, nhưng logic `lockedNavigation`/`allNavigation`/`activePanel`/`openPreview` riêng (preview ≠ prod; không vendor panel).
- `ImperialScrollScene.vue:29` — comment R9 "no horizontal PaperPanelNavigation inside the shell"; chỉ còn serve `exploration` (ProductionPanel).
- `LeftPanel`+`FunctionOverlayPanel` mount khi `!isFullSceneActive` — trong combat/tribulation mọi panel unmount cùng lúc stage.
- `BuildingTooltipContent` (`useTooltip.ts:164-178`, union :245, render `Tooltip.vue:188-196`): **không producer nào** — comment chính nó nói caller duy nhất là plaque layer DongFuHomeContent, mà component đó dùng `:title` attr (:48), không emit tooltip → type + render branch dead.
- `dongFuBuildingTimeClass` (`DongFuBuildingArt.ts:151`): chỉ test gọi → dead fn.
- `PcPaperButton` trong `.home-design-currencies` (:429-431): component forward `click` (PcPaperButton.vue:3-6) nhưng không handler → nút ＋ là dead affordance.

## 3. Art map

| Art file | Element dùng | Cite |
|---|---|---|
| `tien-hiep-2026-10/source/world-vista-warm-v1.png` | nền `.df-scene` (`sceneStyle.backgroundImage`) | DongFuStage.vue:191-193 |
| `controls/navigation-backing-dark-v3.png` | `.home-navigation-backing` img trong rail | :197, :447 |
| `controls/navigation-medallion-v1.png` | `--home-nav-art` (bg `::before` mỗi nút rail) | :195, scoped :538 |
| `controls/navigation-landscape-seam-v1.png` | `.home-navigation-landscape-seam` (chỉ khi `surfaceOpen`) | :198, :471 |
| `icons/navigation-{id}-v2.png` ×21 | `<img>` trong nút rail | :458 (21 items; dir có **22 file** — `navigation-forge-v2.png` orphan, `forge` không có trong NAV_ITEMS) |
| `icons/character.png` (v1 qua `pcPaperIconUrl`) | avatar `.home-design-avatar` | :422, `PcPaperIcons.ts:4-9` |
| `PcPaperControls` resources (jade/coin/crystal/essence) | icon currency chip | :298-307, :430 |
| `huyen-kim/symbols/*.svg` | orb wheel `symbolUrl` + icon board | `dongFuUi.ts:12-14`, DongFuWheel :51, DongFuBoard :16 |
| `runtime/surface-l-drawer@2x.png` (huyen-kim chrome, ready) | `InkNineSlice` nền `.df-board` | DongFuBoard.vue:11, `huyen-kim-chrome.json:86-97`; cùng asset dùng ở `LoginSideDrawer.vue:23` |
| `huyen-kim/scene/dong-fu-v2/*` (`DONG_FU_ART`: rear/foreground/cultivator/frame+nine-slice.json) | chỉ preview chain (DongFuHomeContent/Vista/ArtFrame) | `dongFuUi.ts:4-10` — dormant prod (vẫn prefetch `AssetBundleCatalog.ts:627-629`) |
| `assets/buildings/dong-fu/v2/{id}/base.png` | `.building-heading__art` header imperial + legacy panel | `useBuildingHeaderState.ts:36`, FunctionOverlayPanel :133-139, :172-178 |
| `.pc-paper-scene__frame` | khung viền decorative | DongFuStage :494; `pc-paper-scene.css:15` |
| `--th-art-navigation-rail` = `runtime/navigation-rail.png` | `.paper-navigation` — component dead | `TienHiepUiAssets.ts:5`, `tien-hiep-ui.css:14` |
| `--th-art-title-plaque` = `runtime/title-plaque.png` | `.df-location` dead trong prod; **live** ở `.cf-title` :97, `.technique-title` :236, title :102 | `tien-hiep-ui.css:71` |
| `--th-art-button-primary` | `.df-board__go` (global đè scoped clip-path) | `tien-hiep-ui.css:79` |
| `--th-art-paper-panel` / `--th-art-panel-frame-v2` | `.df-board .df-art-frame` — dead (không có .df-art-frame trong board prod) | `tien-hiep-ui.css:75,228,352` |
| `controls/navigation-backing-v1.png`, `navigation-backing-dark-v2.png`, `navigation-connector-v1.png` | file tồn kho; connector chỉ trong prefetch `AssetBundleCatalog.ts:652` | không element |
| `runtime/navigation-rail.png`, `runtime/building-plaque.png`, `runtime/title-plaque.png` | vẫn prefetch `AssetBundleCatalog.ts:602,607,605` (title-plaque live chỗ khác) | — |
| `DONG_FU_BUILDING_ART` assets (base/silhouetteMask/groundShadow/lockedOverlay) + `THANH_VAN_SEASONS` overlays | dead DOM plaque/season — vẫn prefetch | `AssetBundleCatalog.ts:803-807`, :787-791 |
| `huyen-kim/symbols/lock.svg` | vẫn live ở panel khác (QuanKhi/Constellation/Exploration…), KHÔNG dùng trong rail (locked = class `locked` + `:disabled`, CSS grayscale :539) | DongFuStage :453-454 |
| `DONG_FU_BUILDING_ART[].scenePlacement/hitbox` (plaque art + vị trí) | chỉ preview `DongFuHomeContent.vue:41-67` | `DongFuBuildingArt.ts:48+` (không có symbol `BUILDING_ANCHORS` — chỉ là tên trong comment :117) |
| V1 icon set `icons/{name}.png` (home/quest/alchemy/… + `compass`,`opportunity`,`forge`,`body-*`) | `pcPaperIconUrl` live cho avatar + surface khác; `compass`/`opportunity`/`forge`/`body-*` không consumer rail; toàn bộ v1 prefetch qua `PC_PAPER_ICON_PATHS` | `PcPaperIcons.ts:4-9`, `AssetBundleCatalog.ts:782` |
| `icons/navigation-technique-v2.png` | prefetch literal riêng | `AssetBundleCatalog.ts:678` |

## 4. Conflicts / layers

1. **Hai hệ icon song song cho cùng đích**: rail dùng `navigation-*-v2.png` (:458); wheel+board dùng `huyen-kim/symbols/*.svg` qua 2 map tay `SLOT_SYMBOL` :111-127 / `KIND_SYMBOL` :170-176 (vd `phap_bao`→symbol `equipment`, `gathering_outpost`→`auto-farm`). Cùng một "Trang Bị" hiện 2 art khác nhau tùy trail.
2. **Global CSS đè scoped, nhiều lớp chồng**: `DongFuBoard.vue:44` scoped định nghĩa `df-board__go` hexagon `clip-path` + gradient, nhưng `tien-hiep-ui.css:79` tắt clip-path và thay bg bằng `--th-art-button-primary`; `:74` đổ nền cream `#efe4ca` + `:229-230` padding/heading; `:260-261` lại `background:transparent` + `::before` cream. Board hiện tại = composite của ≥3 đợt reskin + InkNineSlice scoped (:24-27). Tương tự `.df-node__orb` bị restyle :65-69 + `transition:none` :197-199 đè `DongFuWheel` scoped :65,:78.
3. **Rail vs wheel: hai chính sách scope-hidden khác nhau.** Rail HIỆN locked (`NAV_LOCKED` :203 + `navLocked` :217-221, disabled + grayscale :539 — kể cả `formation` khi `tran_phap` off :214-216); wheel ẨN hẳn (`betaWheelSlots` :92-94 → `renderedSlots` :109). Companion/artifact/guild/sect/portal: rail thấy xám, wheel không thấy.
4. **`NAV_ACTIVE_PANEL` hardcode trùng `functionType`**: `production→'exploration'` :253 tay-viết, trong khi authority là `buildings.ts:102` (`gathering_outpost.functionType='exploration'`). Đổi functionType building → rail `.active` lệch. Tương tự `usePaperNavigation` (preview) có map thứ ba (`NAV_TARGETS` :43-59 — `exploration→teleport_array` khác với stage `exploration→stage_select` trực tiếp :236).
5. **Wheel chỉ mở bằng phím** `` ` `` (:397-400) — không nút on-screen; comment :5 "pending its redesign". `scripture_pavilion` (catalog :230-237) là surface duy nhất chỉ reachable qua wheel → buried. (`settings` CÓ trên rail :207,:240 — không buried.)
6. **`.df-scene--covered` chỉ giấu `.df-board` + `.df-notice`** (:566-567). Profile, currencies, quest card, rail, AutoFarmIndicator, frame vẫn mount. Cơ chế thật: home canvas nằm DƯỚI overlay canvas (DOM order, `isolation:isolate` :43) → chrome home không out-z được panel; nó chỉ bấm/đọc được trên vùng panel canvas không phủ — rail lấn ra trái mép paper (18-353 vs paper 156+) nhờ block "Rail over panels" (`tien-hiep-ui.css:381-411`) nên strip đó bấm được **có chủ đích**. Quest card (right:30, nằm trong vùng paper 156-1428) bị paper che → thực tế không bấm được dù không display:none — hệ quả khác với rail.
7. **Asymmetry đóng-panel theo loại surface**: trên 11 fidelity scene (paper modes + standalone + character/inventory) backdrop click fall-through → `onSceneClick` đóng (vì root pointer-events:none); trên `ImperialScrollScene` (exploration) và `OverlayPanel` legacy (scripture_pavilion/vendor/quan_khi) root vẫn `@click.self` trực tiếp → cùng hành vi đóng nhưng 2 cơ chế khác nhau; rail strip chỉ bấm được trên nhóm đầu.
8. **Hai đường đóng panel khi click nền**: `MainScene @click → closeSidePanels` (GameRoot :138,:130-132) và `.df-scene @click.stop → onSceneClick` (:419,:366-369). `.df-scene` là fixed overlay phủ canvas nên đường GameRoot gần như không bao giờ chạy khi home.
9. **`Escape` không đồng nhất**: stage chỉ đóng wheel (:381-384), panel tự lo qua `useDialogFocus` (`ImperialScrollScene` :33, `OverlayPanel` :39, `CharacterFidelityScene` :29…). Bonus: Escape chạy trước `isEditableTarget` → Escape trong input đóng wheel nhưng không đóng gì khác — hành vi phím phân tán.
10. **`feedbackOpen` ngoài store**: `closeHomeOverlays` không đóng dialog → xử tay ở `navAction` :285 + watch :67-69. Một kênh nav bypass state layer. (Ngược lại `navAction('home')` = `closeHomeOverlays` — nút "về nhà" cũng là nút đóng.)
11. **Dead DOM / dormant chain**: `.paper-navigation` rules `tien-hiep-ui.css:11-24,:185-186,:202-206,:353-357`; `.df-vista__*`/`.df-cultivator` :60-64; `.df-location` :71-73,:176,:226-227; `.df-building` :152-166; `.df-resources`/`.df-identity`/`.df-utilities` :167-175; `.df-board .df-art-frame` :75/:228/:352; `.df-quest` :235,:270-271 — không có element prod.
12. **`usePaperNavigation` vs `NAV_TARGET` + `NAV_ACTIVE_PANEL`**: ba "bản đồ đích" tồn tại song song (composable preview-only, map target, map active) — không nguồn chung → drift.
13. **Dead code lẻ**: `PcPaperSceneActions.vue` (không importer); `commandWheelOrbit.ts` (không caller); `CurrencyHud.vue` → `DongFuResourcePill.vue` (dead theo chuỗi); `talisman_slot` zombie (admit qua feature `null` :70 nhưng `available:NEVER_AVAILABLE` :154); `BuildingTooltipContent` (không producer); `dongFuBuildingTimeClass` :151 (chỉ test).
14. **`PcPaperButton` currency chips không handler** (:429-431) — affordance `＋` hiển thị nhưng click không làm gì.
15. **Tutorial dạy gesture đã chết**: `vi.json:1847` "Bấm vào nhân vật đang tu luyện (hoặc phím Tab)… mở Bảng Lệnh" — cultivator hitbox chỉ còn preview (`DongFuHomeContent.vue:68-75`), Tab giờ toggle rail, wheel = Backquote; `:1867` + `:1871` "bấm trực tiếp công trình trên bản đồ" — building hotspot không tồn tại trong DOM prod (comment `commandWheelCatalog.ts:83` nói dual-entry nhưng hotspot layer không còn).
16. **Timers + listeners sót**: `useThienCoEntries` interval 30s chạy kể cả khi board ẩn/panel mở (:49-53); `DongFuStage` window keydown :403-408 + notice `setTimeout` :83-95; `SceneDesignCanvas` ResizeObserver mỗi canvas.
17. **Comment stale**: `DongFuHomeContent.vue:2-6`/`DongFuFidelityScene.vue:2-4` nói production dùng chung content (sai — chỉ preview); scoped `pointer-events:auto` + comment ở mọi fidelity scene (vd `CharacterFidelityScene.vue:46-49`) mô tả cơ chế đã bị global :390-400 đè.

## 5. Logic không có hình ảnh

- `usePaperNavigation.ts` toàn bộ — `PAPER_NAV_IDS`/`NAV_TARGETS`/`activeId`/`navigate`; sống chỉ trong preview (`ui-preview/paperNavigation.ts:1`).
- `commandWheelOrbit.ts` `getCommandWheelOrbitDirection` — không caller.
- `getBuildingStatus` trả 'locked'/'active'/'default' (`useBuildingNavigation.ts:86-106`) nhưng consumer duy nhất `slotBadge` (:148-152) chỉ render 'ready'/'upgradeable'→'dot' — 3 status tính mà không vẽ.
- `DongFuUiAction.badge` literal `'upgrade'` (`dongFuUi.ts:23`) — `slotBadge` không bao giờ trả; variant chỉ sống ở preview (`DongFuHomeContent.vue:55`).
- `ui.toggleCommandWheel` chỉ reachable qua Backquote — không button; `dongFu.toggleWheel` locale (`vi.json:2020`) chỉ dùng ở preview `DongFuHomeContent.vue:70` + `ui-preview/dongFuMessages.ts:18`.
- `dongFu.buildingHint` (`vi.json:2023`) + `sceneTitle`/`sceneSubtitle` (`vi.json:2024-2025`) — chỉ preview (`.df-location`, `.df-buildings` không tồn tại trong prod template). `questTracker.aria` (`vi.json:1836-1838`) live (:438).
- `home.commandWheel.openAria`/`hint` (`vi.json:1785-1788`) + `home.daoLuan.center` (:1789-1791) — không consumer prod. `home.topBar.*` (:1792-1801) chỉ `realmLine` live ở `CombatPlayerCard.vue:86` (combat, không phải home chrome).
- `dongFu.unhandled` :358 — chỉ phát khi wheel action id không khớp entry lẫn slot (edge).
- `wheelActions.selected` luôn `null` (:482) → `is-selected`/`aria-pressed` trong DongFuWheel (:40,:45) không bao giờ chạy.
- `FunctionOverlayPanel` `legacyMode` path (`OverlayPanel` :158-195): `worker_lodge` bị beta-gate (`BETA_LEFT_PANEL_FEATURES['worker_lodge']='manualWorkforce'` :159); `scripture_pavilion` + `vendor` mở được nhưng `scripture_pavilion` không có trail production nào dẫn tới ngoài wheel-Backquote (rail không có item; plaque không tồn tại; `NAV_TARGET` không map).
- `BuildingTooltipContent` + nhánh render `Tooltip.vue:188-196` — không producer nào trong codebase.
- `dongFuBuildingTimeClass` :151 — export chỉ test dùng.
- `@click.self` trên 11 fidelity scene root — handler vẫn khai báo nhưng không bao giờ fire (root pointer-events:none); chức năng đã chuyển sang `DongFuStage.onSceneClick`.
- `PcPaperButton` emit `click` trên currency chips — không listener.
- `RouteMount` :205 — mount witness cho route readiness (không vẽ gì).
- `FeedbackDialog` mount thường trực (:497) — chỉ vẽ khi `feedbackOpen`.

## 6. Hình ảnh không có logic

- `.home-navigation-landscape-seam` img (:471) — trang trí thuần, `pointer-events:none` (:514; mock `LandscapeDesignPreview.vue:62`).
- `.home-navigation-backing` (:447, :513 `pointer-events:none`), `.pc-paper-scene__frame` (:494; css :15), `.df-wheel__orbit` vòng vẽ CSS (`DongFuWheel` :35 + ::after :60).
- `navigation-backing-v1.png`, `navigation-backing-dark-v2.png`, `navigation-connector-v1.png`, `runtime/navigation-rail.png` — file orphan / chỉ phục vụ `.paper-navigation` dead (mục 3). `navigation-connector-v1` còn được prefetch (:652).
- `navigation-forge-v2.png` — file icon tồn kho, `forge` không phải nav id.
- Bộ `icons/{name}.png` v1 — `compass`/`opportunity`/`forge`/`body-*` không consumer trong rail; `character.png` vẫn live avatar; toàn bộ set prefetch qua `PC_PAPER_ICON_PATHS` (`AssetBundleCatalog.ts:782`).
- `.df-location` plaque + `--th-art-title-plaque` — chỉ preview (`DongFuHomeContent.vue:92-95`); title-plaque vẫn live ở scene title khác (:97,:236).
- `DongFuUiBuilding` interface + `DONG_FU_ART` (`dongFuUi.ts:4-10,27-30`) — plaque art + vị trí, không mount prod; data `scenePlacement/hitbox` `DongFuBuildingArt.ts:48+` chỉ phục vụ preview chain.
- `.df-quest` css (`tien-hiep-ui.css:235,:270-271`) + `.df-building` css (:152-166) — element chỉ trong preview.
- Preview art panels `HomeCharacterArtPanel`/`HomeSkillArtPanel`/… trong `LandscapeDesignPreview.vue:64-66` — mock surfaces, không state.

## 7. Open questions

1. Rail hiện-locked vs wheel ẩn-hẳn cho scope-hidden feature — chính sách nào là chuẩn? (artifact/companion/guild/sect/portal/formation)
2. Command wheel chỉ mở bằng Backquote, không affordance màn hình — giữ kiểu này tới redesign hay thêm trigger tạm? (`scripture_pavilion` phụ thuộc hoàn toàn vào nó)
3. `.df-scene--covered` chỉ giấu board+notice — quest card/profile/currencies/AutoFarm bị che bởi paper child (không bấm được) chứ không ẩn hẳn; rail strip cố ý bấm được. Có cần ẩn đồng nhất phần chrome không phải rail?
4. `NAV_ACTIVE_PANEL` tay-viết vs `building.functionType` authority (và map thứ ba `usePaperNavigation.NAV_TARGETS`) — gộp về 1 nguồn?
5. `usePaperNavigation`/`PaperPanelNavigation`/`PcPaperSceneActions`/`CurrencyHud`/`DongFuResourcePill`/`commandWheelOrbit`/`BuildingTooltipContent`/`dongFuBuildingTimeClass`/`talisman_slot` — xóa hay giữ cho wave sau?
6. Building plaques (`DONG_FU_BUILDING_ART` scenePlacement/hitbox, `.df-buildings`) — đã bỏ vĩnh viễn khỏi home hay chờ remount? `scripture_pavilion` hiện không có đường vào nào ngoài wheel-phím-tắt; tutorial vẫn dạy "bấm công trình trên bản đồ" (`vi.json:1867,:1871`).
7. `.df-location` ("THANH VÂN ĐỘNG THIÊN") + `sceneTitle/sceneSubtitle` — reskin mới cố ý bỏ title plaque?
8. `.df-board` đang bị 3 lớp global CSS chồng (`tien-hiep-ui.css:74-79,:228-230,:260-261,:352`) vs InkNineSlice scoped — lớp nào là hình đích?
9. `feedback` rail item mở dialog qua ref local thay vì store — có nên đưa vào `closeHomeOverlays`?
10. `@click.self` dead trên 11 fidelity scene — xóa handler + sửa comment stale, hay giữ làm documentation? Escape vẫn live qua `useDialogFocus` nên contract không hổng, chỉ là code dư.
11. Ticker 30s của Thiên Cơ chạy cả khi board collapsed/panel mở — có đáng gate không?
12. Tutorial (`vi.json:1847,:1867,:1871`) mô tả gesture chết — sửa text theo trail hiện tại (Backquote/rail) hay chờ gesture mới?

## Adjudication

Verify trên snapshot `8ffc8e64`. Tất cả 30 finding của reviewer được kiểm trực tiếp trên code.

### Missed — ACCEPTED (22/22)

1. **Block "Rail over panels" `tien-hiep-ui.css:381-411`** — accept. Root 11 fidelity scene `pointer-events:none` :390-400, `> *` auto :401-411, comment giải thích intent :381-389. Đây là cơ chế claim rail-clickable-trên-panel.
2. **`@click.self` dead** — accept, mở rộng: cả 11 fidelity scene đều có `@click.self="emit('back')"` (character :32, skill :57, realm :20, technique :24, body :36, alchemy :43, inventory :39, equipment :54, quest :38, settings :33, exploration :21); scoped `pointer-events:auto` bị đè (specificity `:is(#app,body)` (1,1,0) > `[data-v]` (0,2,0)); comment local stale. Escape live qua `useDialogFocus`.
3. **`data-df-ui` = marker `INTERACTIVE_SELECTOR`** — accept. Selector :364 gồm `button,a,input,select,textarea,[role=button],[data-df-ui]`; chỉ 4 element mang marker (:421,:428,:446,:493).
4. **Ticker 30s + MAX_ENTRIES + PRIORITY** — accept (`useThienCoEntries.ts:28-37,:46-53`).
5. **noticeTimer + window keydown + Escape trước editable-check** — accept (`DongFuStage.vue:83-95,:380-408`).
6. **SceneDesignCanvas ResizeObserver + scale** — accept (:8-24,:37,:41-42).
7. **Gate `App.vue:1293`** — accept (`v-if="isBooted" :inert="authorityOverlayActive"`).
8. **Currency chips dead affordance** — accept (:429-431 không handler).
9. **Tutorial dead gestures** — accept (`vi.json:1847,:1867,:1871` vs cultivator preview-only + Tab đổi nghĩa + không hotspot).
10. **Dead locale keys** — accept (`commandWheel` :1785-1788, `daoLuan` :1789-1791, `topBar` chỉ `realmLine` live ở `CombatPlayerCard.vue:86`).
11. **`navAction('home')` = đóng overlay** — accept (:286-289; home không có NAV_TARGET).
12. **`RouteMount` :205** — accept (mount witness).
13. **Building header art LIVE** — accept (`useBuildingHeaderState.ts:36` → FunctionOverlayPanel :133-139,:172-178). Nuance: chỉ reachable qua imperial (exploration) + legacy (scripture_pavilion/vendor; worker_lodge gated).
14. **Dead art vẫn prefetch** — accept (`AssetBundleCatalog.ts:803-807` plaques + :787-791/:807 seasons + :602/:607/:652).
15. **`BuildingTooltipContent` dead** — accept, mạnh hơn reviewer: không producer nào cả (DongFuHomeContent dùng `:title` attr).
16. **`DongFuResourcePill` dead qua CurrencyHud** — accept (importer duy nhất = CurrencyHud, không phải preview chain).
17. **`.th-panel-swap` spec** — accept (`tien-hiep-ui.css:367-379`).
18. **`.df-quest` rules dead** — accept (:235,:270-271).
19. **`dongFuBuildingTimeClass` dead** — accept (reviewer viết `donFu…`; tên đúng `dongFuBuildingTimeClass` :151, chỉ test caller).
20. **Orphan icon + ids** — accept (22 file nav-v2; `forge` orphan; `compass`/`opportunity`/`body-*` không consumer rail).
21. **`CHIP_ICON` gán theo index** — accept (:298-307 vs `SPIRIT_STONE_MATERIALS` order).
22. **Tab bị hijack** — accept (:389-395 `preventDefault` → mất focus nav trên home).

### Wrong — ACCEPTED (8/8)

1. **`NAV_ITEMS` = 21 không phải 20** — accept (16 inline + 5 `NAV_LOCKED` :203-208).
2. **Icon ×21 + 1 orphan = 22** — accept (đếm `icons/navigation-*-v2.png` = 22 file).
3. **`App.vue:4` → `:1293`** — accept.
4. **Quest card "z cao, data-df-ui" sai** — accept: `.home-design-quest` không z-index (:552) và không `data-df-ui` (:433-445); nó là `<button>` nên đã trong selector. Kết luận "bị che/chồng" đứng nhưng cơ chế là khác (panel child capture, không phải z-index).
5. **`PaperPanelNavigation` không mount ở `CharacterFidelityScene`** — accept (:5 chỉ comment; mount duy nhất `PaperPreviewSurface.vue:19`).
6. **`BUILDING_ANCHORS` không tồn tại** — accept (chỉ comment `DongFuHomeContent.vue:117`; data thật `DONG_FU_BUILDING_ART[].scenePlacement/hitbox`).
7. **`settings` không wheel-only** — accept (`settings` có trên rail :207 + `NAV_TARGET` :240; chỉ `scripture_pavilion` buried).
8. **Drift cite ±1-4 dòng** — accept; đã sửa toàn bộ cite trong report này (dongFuUi :12-14/:23; DongFuWheel :14-16/:17-27/:28-31/:34/:35; DongFuBoard :5/:6; BETA_WHEEL_SLOT_FEATURES :64-80; FunctionOverlayPanel các const :25-34/:41-47/:53-58/:60-67/:69-77/:113-118; panelIds :19-47; commandWheelOrbit toàn file 7 dòng).

### Wrong — REJECTED / PARTIAL

- Không có finding nào bị reject hoàn toàn. Một điểm cần nuance: reviewer nói "rail clickable trên panel = có chủ đích" — đúng trên 11 fidelity scene, nhưng trên `ImperialScrollScene`/legacy `OverlayPanel` rail strip vẫn bị root nuốt click (`.hk-scroll`/`.overlay-panel` không nằm trong pointer-events list) → hành vi rail không đồng nhất giữa các loại panel (đã ghi vào Conflicts #7).

### Reviewer-additional corrections bản thân mình phát hiện thêm khi verify

- `INTERACTIVE_SELECTOR` thực tế rộng hơn report trích (`select, textarea` có trong list) — đã sửa.
- `FeedbackDialog` mount ngoài canvas nhưng vẫn trong DongFuStage tree (:497) — đã ghi rõ.
- `DongFuHomeContent`/`DongFuFidelityScene` comment "production mounts the same content" là stale — thêm vào Conflicts #17.
- `.hk-scroll` + `.overlay-panel` `@click.self` vẫn live — phân biệt 2 cơ chế đóng-panel trong Conflicts #7.
