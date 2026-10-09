# Panel: Sản Xuất (ProductionPanel) + Chiêu Hiền Quán (WorkerLodgePanel)

Branch: devin/artui-c0-foundation @ 8ffc8e64, read-only audit — bản đã adjudicate (mọi số dòng đã đối chiếu lại với code trong pass này).

## 1. Mount chain — từ nav/route đến component gốc

### Đường sống (Sản Xuất = mode `exploration`)

`DongFuStage` mount trong `components/game/MainScene.vue:18`; `FunctionOverlayPanel` mount mọi lúc trong `components/layout/GameRoot.vue:150` (import `:10`).

**Cửa vào từ Động Phủ home:**
- Thanh nav trái icon `production` (ảnh `navigation-production-v2.png`): `DongFuStage.vue` NAV_ITEMS `:204-208` → `NAV_TARGET.production` `:238` gọi `navigation.openBuilding('gathering_outpost')`. Highlight nhờ `NAV_ACTIVE_PANEL.production='exploration'` `:253`.
- Vòng wheel Backquote: slot ring-3 `gathering_outpost` (`commandWheelCatalog.ts:207-213`, symbol `auto-farm` qua `SLOT_SYMBOL` — số ít — `DongFuStage.vue:122`; slot `chi_hien_quan` `:215-221`, symbol `'home'` `:123`). `renderedSlots = betaWheelSlots().filter(available)` `:109` — `BETA_WHEEL_SLOT_FEATURES.gathering_outpost=null` (`betaScopeSurface.ts:75`) admit, `chi_hien_quan='manualWorkforce'` `:76` bị lọc. Bấm → `activateSlot` `:330-344` (cue `ui.wheel.select` `:332`) → `openBuilding` `:335`.
- Keyboard `DongFuStage.vue`: `window.addEventListener('keydown', onKeydown)` `:404` (gỡ `:407`). Esc đóng wheel **vô điều kiện** `:381-384` (đứng trước mọi gate); Tab toggle rail chỉ khi `!stageActive && !surfaceOpen` `:389`; Backquote mở wheel chỉ khi `!stageActive && !surfaceOpen && !feedbackOpen` `:397` → **khi Sản Xuất mở, wheel không bật được**.
- Thiên Cơ board: `useThienCoEntries.ts` vòng `DONG_FU_BUILDING_IDS` `:100` + fail-closed `isBetaBuildingSurface` `:104`; status `'ready'` khi `template.producesMaterialId` + `isBuildingStorageFull` (`useBuildingNavigation.ts:91` → `GameManagerBuildingOps.ts:331`); `'upgradeable'` qua `quoteBuildingUpgrade` `useBuildingNavigation.ts:99-103` → CTA `ready:`/`upgradeable:` → `openBuilding`. Nút upgrade trên header panel cũng đi qua `useBuildingNavigation.upgradeBuilding` `:116-135` (write path duy nhất, gate bằng `quoteBuildingUpgrade`).
- `useBuildingNavigation.openBuilding` `:136-155`: fail-closed `!isBetaBuildingSurface` `:141` → đọc `functionType:'exploration'` (`buildings.ts:102`) → `ui.openLeftPanel('exploration')` `:153`.
- `stores/ui.ts`: `openLeftPanel` `:226-241` gate `isBetaLeftPanelMode` `:228` ('exploration' null-admit `betaScopeSurface.ts` map `:152-159`); `toggleLeft` cùng gate `:199-202`.

**Shell:** `FunctionOverlayPanel.vue` — `mode` computed `:69-77` (gate lần 2 `isBetaLeftPanelMode` `:74`); 'exploration' ∈ `IMPERIAL_MODES` `:41-47` nhưng ∉ `PAPER_MODES` `:53-58` → `scrollMode='exploration'` `:83` → `ImperialScrollScene` `:122-155`, title `TITLE_KEYS.exploration` `:26` = 'Sản Xuất' (vi.json:1626), mount `<ProductionPanel/>` `:153`. Slot `#header` `:131-150` = `.building-heading--imperial` `:132` (ảnh `v2/<id>/base.png` qua `useBuildingHeaderState.ts:36` + tên 'Khai Vật Đường' + Lv x/9 + `BuildingUpgradeButton` `:144-148`).

`ImperialScrollScene` a11y: `useDialogFocus` focus-trap + `onEscape`→close `:33`; `@click.self` scrim-close `:47`.

**KHÔNG có đường nào khác vào Sản Xuất:** `PAPER_NAV_IDS` (`usePaperNavigation.ts:29-41`) không chứa 'production' — scene giấy không có rail item tới Sản Xuất; muốn vào phải về home bấm nav/wheel/CTA.

### Đường ngủ đông (Chiêu Hiền Quán = mode `worker_lodge`) — 7 lớp chặn

`buildings.ts:230-253`: `chi_hien_quan` 'Chiêu Hiền Quán', `functionType:'worker_lodge'` `:247`, maxLevel 9, upgradeCost `mortal_ore_decade`/`qi_refining_wood_decade` `:248-252` (sink khác gỗ của gathering_outpost `:104-107`). Beta `manualWorkforce:false` (`betaFeatureFlags.ts:38`):

1. `openBuilding` fail-closed `!isBetaBuildingSurface` — `useBuildingNavigation.ts:141` + `BETA_BUILDING_FEATURES.chi_hien_quan='manualWorkforce'` `betaScopeSurface.ts:114`.
2. Slot wheel `chi_hien_quan` bị `betaWheelSlots()` lọc — `betaScopeSurface.ts:76`, `renderedSlots` `DongFuStage.vue:109`.
3. `toggleLeft`/`openLeftPanel` `ui.ts:202,:228` + `BETA_LEFT_PANEL_FEATURES.worker_lodge='manualWorkforce'` `betaScopeSurface.ts:159`.
4. `mode` computed `FunctionOverlayPanel.vue:69-77` chặn lần cuối trước khi render.
5. `getWorkerLodgeSurfaceModel` (`GameManagerBuildingOps.ts:152-181`) cho cả 4 tab verdict `scope-hidden` (`WORKER_LODGE_TAB_FEATURE` `betaScope.ts:551-558` trên `BETA_WORKER_LODGE_TABS` `:534-539`: nhan_cong→manualWorkforce, qua_tang/chieu_mo/duyen_phan→companion) → `visibleTabs=[]` → `v-if="visibleTabs.length>0"` `WorkerLodgePanel.vue:100` render rỗng.
6. `upgradeBuilding` fail-closed `!isBetaBuildingSurface(existing.buildingId)` — `GameManagerBuildingOps.ts:221-228`: instance kéo theo save cũ cũng không upgrade được (nhánh `refreshAutoWorkerCapacity` `:239` bất khả đạt qua UI).
7. Save-level: `unsupportedReleaseReason` `betaScopeSurface.ts:327` trả `'manual_workforce_state'` `:365-370` khi `autoWorkerCapacity > BETA_BASELINE_WORKER_CAPACITY` (=3, `core/production/WorkerCapacity.ts:58`; union member `:290`) — save mang lodge đã nâng cấp bị flag unsupported-scope.

Nếu sống: `legacyMode` `:85-87` → `OverlayPanel` variant ink (vỏ tối `surface-m-panel` + `frame-m-modal`, `OverlayPanel.vue:66-68`) với `WorkerLodgePanel` `FunctionOverlayPanel.vue:191` — **chrome khác hẳn vỏ cuộn sáng của Sản Xuất**.

### Biên giới scope

Mode `exploration` ở đây = **Sản Xuất** (Khai Vật Đường), KHÔNG phải bản đồ. `scenes/exploration/*` (ExplorationSurface/ExplorationFidelityScene) là scope 'ban-do': `StageSelectPanel` mount khi `paperMode==='stage_select'` (`FunctionOverlayPanel.vue:114`) và render `ExplorationSurface` (`StageSelectPanel.vue:11,:17`; live mount ExplorationFidelityScene `ExplorationSurface.vue:457`). Repo không có `scenes/production*`.

`DongFuHomeContent.vue` (layer `.df-building` + `building-plaque` chrome) chỉ mount trong `DongFuFidelityScene.vue:27` ← chỉ `ui-preview/DongFuPreview.vue:4,:42` — **không phải đường vào production**.

## 2. UI logic inventory — mọi computed/store-read đang feed DOM

### ProductionPanel.vue (sống)

- `nowMs` ref + `setInterval 500ms` `:57-69`; `stateVersion` chạm ở `:106,:171,:231,:282` — hai nguồn refresh chồng nhau.
- `rows` `:105-162` ← `getProductionViews(nowMs)` (`GameManagerBuildingOps.ts:350-368`: definition/state/productionSpeedMultiplier/next/cycleRemainingMs/cycleTotalMs) map `SiteRow` `:71-103` {siteId,kind,kindLabel,sigil 木/礦/藥 (`KIND_META:24-28`),name,description,level,maxLevel,productionSpeedMultiplier,next,autoRestart,activeWorkerSlots,assignedWorkers?,isProducing `:98`,progress,remainingLabel `:102`} — **không có field `reachLabel`**.
- `toggleAuto` `:164-168` → `setProductionAutoRestart` `:370-372`; `upgrade` `:214-218` → `upgradeProductionSite` `:375-378`; `upgradeCostRows` `:170-204` + `canUpgrade` `:206-212` → `quoteProductionUpgrade` `:384-390` → `quoteSiteUpgrade` (`ProductionSystem.ts` ~`:352-396`) shape thật **`{upgradable, reasons[], cost|undefined}`** — panel đọc `quote.cost` `:177` và `.upgradable` `:211`.
- `workerSurfaceVisible = betaSurfaceVisible('manualWorkforce')` `:53` = **false** → block `.worker-allocation` `:334-387` (radio auto/manual, slider/site, đếm nhàn rỗi) không render; logic phục vụ chết theo: `workforce` `:230-239` → `getWorkforceView` (tự kiểm duyệt: hidden → `assignedWorkers=undefined`, decompose workers→0), `workerMode` `:241-243`, `assignedTotal` `:245-247`, `effectiveTotal` `:249-251`, `setWorkerMode` `:253-269`, `assign` `:271-275` → `assignWorkers` (`GameManagerBuildingOps.ts:188-206`) no-op sớm khi `isScopeHidden` `:189-194`.
- `OUTPOST_ID='gathering_outpost'` `:279`; `outpostInstance` `:281-285`; `linMachStored` `:287-295`, `linMachCapacity` `:297-299`, `linMachRatePerMinute` `:301-303`, `linMachOutputName` `:305-311` (tên Linh Thạch theo realm tier) ← `getBuildingStoredAmount/getBuildingCapacity/getBuildingRatePerMinute` (`:288-330`). Backend đặc thù: `gathering_outpost` là building `producesMaterialId` duy nhất — special-case trong `BuildingSystem.ts` `:283` (rate), `:304` (capacity 10h-yield), `resolveProducesMaterialId` realm-tier `:395-398`.
- `collectLinMach` `:313-321` — early-return khi `stored<=0` `:314-316` → `collectBuilding` (`GameManagerBuildingOps.ts:247-284`): pre-check `resolveProducesMaterialId` `:255-261` → `claim` → `materialBag.add` (clamp stackLimit) `:273` → `notifyMaterialGained` `:276` = `questOps.notifyMaterialGained` (`GameManager.ts:592-593` → `GameManagerQuestOps.ts:71-82`: **quest tracking, không toast**) → **chỉ** push `createBagOverflowEvent` `:278-281` khi tràn bag. **Thu hoạch Linh Mạch im lặng** — không toast `kind:'loot'`, không key `lingThach.collect` (grep zero hit trong src), không warning 'empty'.
- `rewardSummary` `:30-41`: forest/mine text tĩnh; grotto đếm `PILL_FAMILIES.filter(f => betaRecipeFamilyOfId(f.id) !== null).length` `:39` (`betaRecipeFamilyOfId` `betaScope.ts:359`).
- `isProducing` `:154`: `workerCycles?.length>0 || activeWorkerSlots>0` — dưới beta auto pool vẫn cấp công nên site hiện đang chạy.
- GameButton: `.lin-mach__collect` `:406-412` không truyền variant → default `'primary'` (`GameButton.vue:23`) → class `game-button--primary`; `.site-card__upgrade-button` `variant='ghost'` `:475-477`. Mọi GameButton phát `ui.click` qua AudioManager singleton (`GameButton.vue:43-49`, gated `props.sound`).

### WorkerLodgePanel.vue + 3 tab (ngủ đông)

- `BUILDING_ID='chi_hien_quan'` `:20`; `TabBar` import `:15` (chỉ render trong v-if — imported-nhưng-không-render); `TABS` 4 cái `:36-41` label `workerLodge.tabs.*`.
- `visibleTabs` `:45-56` ← `getWorkerLodgeSurfaceModel`; `activeTab` + watch fallback `:58-71`; `instance/template/capacity/nextCapacity` `:73-93` ← `getBuildingDefinitions`/`getWorkerCapacityForLevel` (1+level×2).
- `ChieuMoTab.vue`: token `COMPANION_PULL_TOKEN_ID` `:14`, `PITY_THRESHOLD` `:16`, `pullsSinceRare` `:41`, `pullInFlight` ref `:45` (pull sync `:78-93` → cờ gần như trưng), `poolEnabled` `:51`, banner `chieu-mo__unavailable` `:117` + `chieu-mo__status--parked` `:105`; `useNotificationStore().push('warning', ...)` khi fail `:84`.
- `DuyenPhanTab.vue`: nhóm theo grade, `EXCHANGE_COST` `:15`, `MAX_CONSTELLATION_RANK` `:17`, `exchangeCompanion`; `v-tooltip` trên `disabledReason` `:148`; warning push `:118`.
- `QuaTangTab.vue`: `companionGifts` pending/claimed + `COMPANION_GIFT_MOMENTS` + `claimCompanionGift` `:94`; warning push `:97`; ops `claimCompanionGift`/`pullCompanion`/`exchangeCompanion` là chủ toast `kind:'loot'` duy nhất của surface này (`GameManagerCompanionOps.ts:153,:212,:221,:295`).

### Stores/directives đụng DOM khác

- `LeftPanelMode` union `panelIds.ts:18-28` (`'exploration'` `:21`, `'worker_lodge'` `:25`); `TITLE_KEYS` `FunctionOverlayPanel.vue:25-34`; `BUILDINGS` map `:60-67`.
- `useCurrencyChips.spiritStoneChips` `:32-41` → `chips` → `DongFuStage` `currencyChips` `:299` render `PcPaperButton` `:429-431` — nơi Linh Thạch thu được hiển thị. `PcPaperButton` emit class `pc-paper-button` (`PcPaperButton.vue:7`) → art nút lấy từ `pc-paper-scene.css:33-39` (xem mục CSS).
- `df-notice` `role="status" aria-live="polite"` `DongFuStage.vue:493` — nơi wheel/board notices hiển thị.

## 3. Art map

| Art | Đường dẫn | Dùng bởi |
|---|---|---|
| Cuộn trục ×2 | `/assets/ui/tien-hiep-2026-10/runtime/imperial-scroll-roller@{1x,2x}.png` | `ImperialScrollScene` rollerUrl `:38` → img `:57-70` |
| Thân cuộn nine-slice | `runtime/imperial-scroll-body@{1x,2x}.png` | InkNineSlice `:74` |
| Khung nghi lễ | `runtime/frame-xl-ceremony@{1x,2x}.png` | InkNineSlice `:80` |
| Nền vân giấy | `runtime/paper-grain-tile@{1x,2x}.png` | `:75-79` |
| Góc trang trí ×4 | `runtime/corner-ornament@{1x,2x}.png` | `:81-86` |
| Mây ×2 | `runtime/cloud-ornament@{1x,2x}.png` | `:87-88` |
| Bảng tiêu đề cuộn | `runtime/scroll-title-plaque@{1x,2x}.png` | `:94` |
| Nút đóng | `runtime/icon-button-utility@{1x,2x}.png` + HuyenKimSymbol 'close' | `:98-106` |
| Ảnh đầu building | `/assets/buildings/dong-fu/v2/gathering_outpost/base.png` | building-heading (`useBuildingHeaderState.ts:36` → `:135-139`) |
| Icon nav | `/assets/ui/tien-hiep-2026-10/icons/navigation-production-v2.png` | rail `DongFuStage.vue:458` |
| Symbol wheel | `/assets/ui/huyen-kim/symbols/auto-farm.svg` | slot gathering_outpost (`SLOT_SYMBOL:122`) |
| Nút art | `game-button::before` border-image pc-primary/secondary (`pc-paper-production.css:5-11`); `.game-button>.ink-nine-slice{display:none}` `:12` | mọi GameButton trong panel |
| Nút chip linh thạch | `pc-paper-button` + `::before` border-image `--pc-primary-button`/`--pc-secondary-button` (`pc-paper-scene.css:33-39`, vào production qua `@import` `pc-paper-production.css:1`) | currency chips `DongFuStage.vue:429-431` |
| Sigil tròn 木/礦/藥 | **TEXT, không file** | `.site-card__art` `:419-421` + `data-kind` |
| Bar progress | component `Bar.vue` | lin-mach `:394-400` + site-card `:449` |

(Chrome ids resolve qua `src/ui/huyen-kim-chrome.json`, vd imperial-scroll-roller `:426-430`.)

### Art ngủ đông / preview-only

- `dong-fu/v2/<id>/{ground-shadow,locked-overlay,silhouette-mask}.png` + toàn bộ `v2/chi_hien_quan/*` (4 file đủ bộ) — preload qua vòng `DONG_FU_BUILDING_ART` `AssetBundleCatalog.ts:803-806` + `dongFuBuildingAssetUrls` (`DongFuBuildingArt.ts:141-143`; chi_hien_quan entry `:120-133` 'placeholder layout tại đúng entry Linh Tuyền cũ'). Lớp `.df-building` đặt công trình lên home là preview-only (DongFuFidelityScene chỉ DongFuPreview import).
- `public/assets/buildings/dong-fu/v2/spirit_spring/` — art **mồ côi**: building spirit_spring đã xóa khỏi data (comment `BuildingSystem.ts:282` 'building spirit_spring da xoa khoi data'), nay là logic bên trong gathering_outpost.
- `pc-paper-auxiliary-production.css` — file reskin hoàn chỉnh (`.production-panel.pc-auxiliary` card tối + viền vàng kép `:27-52`, `.worker-lodge-panel.pc-auxiliary`, `.chieu-mo/.duyen-phan/.qua-tang` rows) — **không ai import, `.pc-auxiliary` zero usage**.
- `tien-hiep-collections.css` — file mồ côi toàn cục: 0 importer, wrapper `.th-collection` 0 emitter trong src (kể cả `.exploration-paper` bên trong không ai phát).
- Mock art: `shared-paper-page-v1.png` nền, `world-vista-warm-v1.png`/`landscape-3-v1.png`/`opening-vista-warm-v1.png` landscape, `linh_moc.png`/`linh_khoang.png`/`tu_linh_thao/decade.png` medallion, `navigation-exploration-v2.png` làm icon Linh Mạch, `navigation-production-v2.png` heading — chỉ trong `HomeProductionArtPanel.vue:10-17` + `ProductionSourceArtCard.vue` (fixture `pp.*` `productionArtMessages.ts`; preview `landscape-design`).

### CSS global đụng scope — 4 file trực tiếp + chuỗi @import

Import order `main.ts:5-11`: theme.css → huyen-kim.tokens.css → system-theme.css → **tien-hiep-ui.css(8) → tien-hiep-secondary-ui.css(9) → tien-hiep-auxiliary.css(10) → pc-paper-production.css(11)**; pc-paper-production.css `@import './pc-paper-scene.css'` `:1` → `@import './pc-paper-type.css'` (scene:1).

- `tien-hiep-ui.css`: `.production-panel{background:transparent;font-family:var(--font-display);padding:8px 12px;scrollbar-*}` `:191`; `.site-card{flex-shrink:0}` `:192`; `__reward{color:#287257}` `:193`; `__stats{color:#675637}` `:194`; `__art{background:radial-gradient(ellipse,#d1bd8550,transparent 70%),#e4d5b1;border-bottom:1px solid #b39a6860}` `:195`; `__art span{color:#375a42;border-color:#aa8d54;background:#f0e4c8}` `:196` — **sigil phẳng xanh lá trên đĩa giấy, không theo `--scene-*-accent`** (và scoped `:644-655` vốn cũng chỉ dùng forest-accent cho cả 3 loại). Cuộn cũng bị re-chrome: `__inner` light-ramp `--hk-text-*/--surface-*` `:86-91`; `__clip{background:#efe4ca}` `:92` rồi `:262` `background:transparent` (sau thắng); `__main{overflow:auto}` `:104`; `__inner .game-button--secondary{color:#eddeb6}` `:105` (không đụng nút panel — upgrade là ghost); `__grain{opacity:1;mix-blend-mode:normal;inset:18px;border-radius:24px;background-color:#efe4ca}` `:263`; `__plaque{left:16cqw;top:-22px;width:360px}` `:187` + `__title{font:29px}` `:188` + `__inner{top:14cqh;bottom:5cqh}` `:189` + `__header{padding-top:2cqh}` `:190` + rail `:185-186`. Nút: `.game-button:not(--circle){min-width:110px;padding:0 22px}` `:224` + `--sm{min-width:94px}` `:225`; `.game-button.game-button.game-button--primary{color:#352713}` `:80` (specificity `:is(#app,body)`+3 class). `.df-building[data-df-building='gathering_outpost']{left:44px;top:486px !important}` `:164`. `.exploration-*` pins `:239-241,:400-411` — scope ban-do.
- `tien-hiep-secondary-ui.css`: `.tab-bar`(gồm `.worker-lodge__tabs`) `:65-66`; `:is(.site-card,.lin-mach__card,...){border:1px solid #b39a6870;background:#f6edda80;border-radius:0;padding:18px}` `:67` — **giết luôn gradient của site-card lẫn water-gradient của lin-mach card**; `__grid{gap:18px}` `:68`; `__name{21px,#352a1b}` `:69`; `__description,.production-panel__summary{#675637}` `:70`; `__stats{padding:12px 0;border-block:1px solid #b39a6840}` `:71` (thêm 2 vạch kẻ); `.building-heading{gap:20px}` `__name{#352a1b;27px}` `__level{#675637}` `:72-74` — **đè cả `.building-heading--imperial` scoped** (`FunctionOverlayPanel.vue:226-227`). Skin dormant `:is(.worker-lodge-panel,.chieu-mo,.duyen-phan,.qua-tang)` `:81` + card row `:82` — **chứa 2 selector chết** `.chieu-mo__card`/`.duyen-phan__result` (class thật `chieu-mo__result` `ChieuMoTab.vue:125` / `duyen-phan__row` `DuyenPhanTab.vue:146`); `__row margin` `:83`. Toast: `.toast-item` frame-v2 border-image + colors `:99-107` (áp lên overflow event của collectBuilding + warning pushes của dormant tabs).
- `tien-hiep-auxiliary.css` (import sau cùng trong bộ ba th): `.production-panel__grid{grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:24px}` `:87` — **thắng scoped 220px/10px**; `.site-card{flex-col;gap:10px;padding:22px;background:#faf0dcb3;border-color:#ac854a70}` `:88`; `__stats{margin-top:auto}` `:89`. Layout dormant: `.chieu-mo` grid 2 cột `:94`, `__status` 3 cột `:95`, `__unavailable/__pull/__result` `:97-99`, `.duyen-phan__group/__grade/__row/__reason` `:100-103`, `.qua-tang__row` `:104`; `#global-tooltip{max-width;padding}` `:109`.
- `pc-paper-production.css` (`main.ts:11`): `@import './pc-paper-scene.css'` `:1` (→ `pc-paper-type.css`); `:root` remap `--font-display/--font-body/--hk-font-display/--hk-font-ui` → `--pc-*` `:4`; game-button art `:5-14`; `.overlay-panel__card...` paper restyle `:15-19` — đụng `worker_lodge` nếu nó sống; `#global-tooltip` inspector-art skin `:20` — áp lên `v-tooltip` `DuyenPhanTab.vue:148` (dormant); `.pc-paper-scene{pointer-events:auto}` `:21`.
- `pc-paper-scene.css` (qua @import): `.pc-paper-button` + variants `:33-39` — **nền nút của currency chips sống** trong Động Phủ; các selector `.pc-paper-scene*`/`.pc-paper-tabs`/`.pc-paper-inspector` chỉ phục vụ paper scenes (scope khác), `.pc-paper-scene` không xuất hiện trong panel này.
- `theme.css`: `--scene-water-*` `:102-104`, `--scene-forest/mine/grotto-*` `:107-115` — chỉ còn feed scoped đã chết (sigil giờ phẳng theo ui.css:196); `.scrollfade` mask `:541-545` (`--scrollfade-color:var(--ink-900)`) trên `.production-panel` `:326`.

## 4. Conflicts / layers — chỗ 2 phiên bản UI cùng tồn tại

1. **Ba stylesheet global đè scoped trên chính panel sống** (import order main.ts:8→10): `.production-panel` gradient giấy scoped `:501-505` → `ui.css:191` transparent thắng. `.site-card` gradient rừng + radius `:619-627` và `.lin-mach__card` water-gradient `:580-588` → `secondary:67` card giấy phẳng thắng → `aux:88` tinh chỉnh thêm. `.site-card__art` gradient tối per-kind `:629-643` → `ui.css:195` đĩa giấy + border-bottom thắng; span `:644-655` → `:196` phẳng (không per-kind accent — scoped vốn cũng chỉ forest cho cả 3). `__stats`/`__reward` màu scoped → `:193-194` + border-block `secondary:71` + `margin-top:auto` `aux:89`. Grid 220px/gap10 `:613-617` → `secondary:68` gap18 → `aux:87` 250px/gap24. `.building-heading--imperial` color scoped `FunctionOverlayPanel.vue:226-227` → `secondary:72-74`.
2. **Nút collect 3 lớp chồng:** scoped `background:var(--scene-water-accent);border:0;color:var(--ink-950)` `:595-601` → toàn bộ chết: `game-button::before` border-image `--pc-primary-button` `pc-paper-production.css:6` vẽ nút; text thật **`#352713`** (`ui.css:80`, specificity `:is(#app,body)`+3 class thắng `pc-paper-production.css:7` `#302718` và scoped); min-width 94px (`ui.css:225`). Kết quả 'chữ tối trên nút vẽ sáng' đứng, nhưng màu do global quyết chứ không phải `--ink-950`.
3. **`variant='ghost'` đổi nghĩa** (`:475-477`): global map ghost→pc-secondary art + chữ `#f2e1ba` sáng (`pc-paper-production.css:10-11`) — khác ý đồ scoped (upgrade-button chỉ `width:100%` `:735-737`).
4. **Trùng id 'exploration' — tam trùng verified:** mode `exploration`='Sản Xuất' (title vi.json:1626) vs nav `exploration`='Bản Đồ' (`dongFu.nav` :2039)/'Thám Hiểm' (`paperNav` :2062) trỏ `teleport_array`/`stage_select` (`usePaperNavigation.ts:56`; `NAV_TARGET.exploration`→`openLeftPanel('stage_select')` `DongFuStage.vue:236`) vs nav `production`='Sản Xuất' (:2041) trỏ `gathering_outpost`. `LEFT_PANEL_NAV_ID` map **cả** `stage_select` `:79` **lẫn** `exploration` `:82` về nav id `'exploration'` → rail giấy sẽ highlight 'Thám Hiểm' khi Sản Xuất mở (scroll shell hiện không vẽ rail nên chưa lộ mặt; contract đã nhập nhằng).
5. **Hai UI phân nhân công:** `.worker-allocation` `:334-387` vs tab `nhan_cong` WorkerLodgePanel — cùng write path `assignWorkers`, cùng ẩn.
6. **Ba ngôn ngữ hình ảnh một miền:** Sản Xuất (cuộn sáng) vs Chiêu Hiền Quán (vỏ ink tối) vs mock production (giấy + landscape+medallion).
7. **Hai tiêu đề xếp chồng:** plaque 'Sản Xuất' + heading 'Khai Vật Đường Lv x/9'.
8. **Copy hứa tính năng ẩn:** `panels.production.summary` 'Khai Vật Đường khai thác nguyên liệu mọi cảnh giới — phân nhân công cho nguồn, nhận thẳng vào Túi.' (vi.json:652) hiện trên panel sống trong khi `manualWorkforce` khóa; thêm `workerLodge` hint ':1012' 'Nhân công được phân bổ vào các nguồn khai thác ở panel Sản Xuất'.
9. **Skin thừa:** `pc-paper-auxiliary-production.css` hoàn chỉnh, không import, `.pc-auxiliary` zero usage — song song với 4-file global đang đè panel. Kèm `tien-hiep-collections.css` mồ côi toàn file.
10. **Preview nhập nhằng nguồn 'art đã duyệt':** `ExplorationPreview.vue`/`legacy/ui-exploration.html` là preview ban-do; preview sản xuất ở `LandscapeDesignPreview.vue:66` (`activePanel==='production'`).
11. **Skin ngủ đông tự mục:** selector `.chieu-mo__card`/`.duyen-phan__result` trong `secondary:82` trỏ class không tồn tại (thật `chieu-mo__result`/`duyen-phan__row`) — kể cả khi lodge quay lại, một phần skin sẽ không khớp.
12. **Hai nguồn toạ độ preview:** `DongFuPreview.vue:24` model `x:44 y:448` vs `ui.css:164` pin `top:486px !important` — CSS thắng trong preview.

## 5. Logic không có hình ảnh

- Toàn bộ nhanh tay ProductionPanel: `workerSurfaceVisible` `:53` ẩn block `:334-387` → `getWorkforceView`, `workerMode`/`assignedTotal`/`effectiveTotal` `:241-251`, `setWorkerMode` `:253-269`, `assign` `:271-275` chạy compute rồi đổ đi; `row.assignedWorkers` + slider never bind.
- `getWorkerLodgeSurfaceModel` `:152-181` + `WORKER_LODGE_TAB_FEATURE` `:551-558` + `manualAssignOffered` — verdict đúng, DOM không render (`WorkerLodgePanel.vue:100`).
- `assignWorkers` no-op sớm khi hidden `:189-194`.
- `chi_hien_quan` instance lv1 default-built nuôi `autoWorkerCapacity` baseline 3 — restore re-derive `GameManagerSaveRestore.ts:342-345`, `refreshAutoWorkerCapacity` chỉ nhận CHQ `:86-91` — production chạy nền nhờ pool này nhưng không surface nào cho thấy/upgrade (upgrade fail-closed `:221-228`; save mang lodge nâng cấp flag `'manual_workforce_state'` `betaScopeSurface.ts:365-370`).
- `getProductionUpgradeCost` `:392-394` — **zero caller toàn repo** (kể cả test), export chết hoàn toàn.
- `pullInFlight` `ChieuMoTab.vue:45` — pull sync nên cờ trưng.
- `TabBar` import `WorkerLodgePanel.vue:15` — imported-nhưng-không-render.
- Keys `workerLodge.*`, `chieuMo.*`, `duyenPhan.*`, `quaTang.*`, `panels.production.workers*/workerMode*/workerAssignAria/workerAutoHint` — chuỗi dormant.
- `BUILDINGS.worker_lodge` + `TITLE_KEYS.worker_lodge` + slot config `commandWheelCatalog.ts:215-221` + `SLOT_SYMBOL.chi_hien_quan='home'` `:123` — có cấu trúc, không render.
- `notifyMaterialGained` path của `collectBuilding` = quest tracking thầm lặng (không chrome trừ overflow toast).
- `stateVersion` bumps chồng interval 500ms — nhẹ, không hại.

## 6. Hình ảnh không có logic

- Sigil 木/礦/藥 `.site-card__art` — text trang trí, dưới global là đĩa giấy chữ xanh phẳng (`ui.css:196`), `data-kind` không còn tác dụng màu (và scoped cũng chỉ forest-accent).
- `.df-building__dot/__upgrade` badges + `building-plaque` chrome `DongFuHomeContent.vue` — preview-only.
- Mock `ProductionSourceArtCard`/`HomeProductionArtPanel` — fixture `pp.*`, chỉ sống `landscape-design`.
- `navigation-exploration-v2.png` dùng làm icon Linh Mạch trong mock — icon bản đồ mượn làm mạch.
- Trạng thái `--parked`, `--pity`, rows `duyen-phan/qua-tang/chieu-mo` + layout `aux:94-104` — style đầy đủ, không tới được.
- `spirit_spring/` v2 art dir — mồ côi (building đã xóa khỏi data).
- Selector chết trong skin sống (`secondary:82`).
- `tien-hiep-collections.css` — toàn file mồ côi.
- `icon-button-utility` + symbol 'close' cuộn sống; heading thumb v2/base.png sống (44×38).

## 7. Open questions — cần chủ dự án quyết

1. Sản Xuất là consumer cuối cùng của ImperialScrollScene (comment `FunctionOverlayPanel.vue:51`: 'exploration is the last mode still on the scroll'), trong khi mock `HomeProductionArtPanel` đã có trong landscape-design. **Port mock sang paper surface (card landscape+medallion) hay giữ cuộn?** Quyết luôn số phận các global `.production-panel` overrides.
2. `pc-paper-auxiliary-production.css` (skin tối hoàn chỉnh, chưa import) — **adopt, import, hay xóa?** (Kèm quyết `tien-hiep-collections.css` mồ côi.)
3. Summary/hint copy hứa 'phân nhân công' dưới beta đã ẩn (vi.json:652,:1012) — **sửa chữ hay mở feature?**
4. Id `exploration` tam trùng (Sản Xuất mode vs Bản Đồ/Thám Hiểm nav; `LEFT_PANEL_NAV_ID` gộp cả hai) — **đổi mode thành `production` khớp nav 'production'?**
5. Khi `manualWorkforce` quay lại: **phân công ở ProductionPanel (block ẩn) hay tab Nhân Công Chiêu Hiền Quán?** Cả hai viết cùng `assignWorkers`.
6. Art v2 `{base,ground-shadow,locked-overlay,silhouette-mask}` 2 building + `v2/chi_hien_quan/*` + `v2/spirit_spring/*` mồ côi — renderer home chỉ còn trong preview; **giữ cho reskin home tới hay prune?**
7. `getProductionUpgradeCost` — zero caller; **xóa khỏi contract?**
8. Selector chết `secondary:82` (`.chieu-mo__card`/`.duyen-phan__result`) — **sửa tên khớp class thật hay drop?** (Ảnh hưởng ngay khi lodge quay lại.)
9. Thu hoạch Linh Mạch **im lặng** (không toast thành công; chỉ overflow event) trong khi mọi ops khác (loot/gift/exchange) đều toast — **cố ý hay thiếu feedback?**

## Phụ lục — tệp chính đã đọc

ProductionPanel.vue (744l), WorkerLodgePanel.vue + worker-lodge/{ChieuMo,DuyenPhan,QuaTang}Tab.vue, FunctionOverlayPanel.vue, ImperialScrollScene.vue, OverlayPanel.vue, GameRoot.vue, MainScene.vue, stores/ui.ts, panelIds.ts, betaScopeSurface.ts (maps `:64-170`, `:327-370`), betaScope.ts:218-273,359,534-558, betaFeatureFlags.ts:38, commandWheelCatalog.ts:200-221, buildings.ts:95-110+228-253, useBuildingNavigation.ts:80-160, usePaperNavigation.ts:29-92, useThienCoEntries.ts:95-150, useBuildingHeaderState.ts:30-45, GameManagerBuildingOps.ts:76-400, GameManager.ts:592, GameManagerQuestOps.ts:65-85, GameManagerSaveRestore.ts:335-350, ProductionSystem.ts:350-396, WorkerCapacity.ts:58, BuildingSystem.ts:282-306+365+395-398, DongFuStage.vue:16-495, DongFuHomeContent.vue, DongFuFidelityScene.vue (50l), DongFuBuildingArt.ts, AssetBundleCatalog.ts:795-810, tien-hiep-ui.css (toàn cục đã rà), tien-hiep-secondary-ui.css:60-134, tien-hiep-auxiliary.css:85-110, pc-paper-production.css, pc-paper-scene.css, pc-paper-auxiliary-production.css (unimported), tien-hiep-collections.css (orphan), theme.css:102-115+537-560, GameButton.vue, PcPaperButton.vue, Bar.vue, useCurrencyChips.ts, StageSelectPanel.vue, ExplorationSurface.vue:457, ExplorationPreview.vue, DongFuPreview.vue, LandscapeDesignPreview.vue, HomeProductionArtPanel.vue, productionArtMessages.ts, vi.json (:525-526,:602,:651-652,:1012,:1626-1630,:2039-2062,:2191).

## Adjudication

Pass adjudication độc lập trên `8ffc8e64`: đối chiếu từng finding của skeptical review với code — **chấp nhận cả 14 Missed + cả 11 Wrong**, kèm hiệu chỉnh cite nhỏ và 3 delta mới phát hiện thêm.

### Missed — tất cả ACCEPTED

1. **Hai stylesheet global sót — ACCEPTED.** `main.ts:9-10` import `tien-hiep-secondary-ui.css` + `tien-hiep-auxiliary.css`; verify từng rule: `secondary:67` giết cả gradient site-card lẫn lin-mach card; `aux:87` grid 250px/gap24 thắng nhờ import sau; `secondary:72-74` đè `.building-heading--imperial`. Dead-selector sub-claim verified: `.chieu-mo__card`/`.duyen-phan__result` chỉ tồn tại trong dòng CSS đó; class thật `chieu-mo__result`/`duyen-phan__row`.
2. **Các rule ui.css sót — ACCEPTED.** Verify `:191-196`, `:224-225`, `:104`, `:86-91`, `:262-263`, `:185-190`. Ghi chú: `__clip` khai báo 2 lần (`:92` #efe4ca, `:262` transparent thắng); `:105` còn rule `--secondary` trong scroll-inner nhưng không đụng nút panel.
3. **pc-paper font remap + tooltip — ACCEPTED.** `:4` remap, `:20` `#global-tooltip` skin; `v-tooltip` thật ở `DuyenPhanTab.vue:148`.
4. **Lớp chặn 6-7 — ACCEPTED.** `upgradeBuilding` fail-closed `:226-228` + `refreshAutoWorkerCapacity` call `:239`; `'manual_workforce_state'` union `:290`, check `:365-370` vs baseline 3 (`core/production/WorkerCapacity.ts:58`).
5. **isBuildingStorageFull — ACCEPTED.** `GameManagerBuildingOps.ts:331` → `useBuildingNavigation.ts:91` (producesMaterialId → 'ready').
6. **Listeners/hooks — ACCEPTED, 1 hiệu chỉnh.** Keydown `:404/407`, Tab `:389`, Backquote `:397`, `activateSlot` cue `:332`, `useDialogFocus`+`onEscape` `:33`, `@click.self` `:47`, GameButton `ui.click` `:43-49` — đúng. Nhưng reviewer nói 'tất cả gate `!surfaceOpen`' sai với Esc: handler Esc `:381-384` đóng wheel **vô điều kiện**, đứng trước mọi gate; `df-notice` đúng `:493` không phải `:487`.
7. **Currency chips — ACCEPTED + bổ sung.** `spiritStoneChips` `:32-41` → `PcPaperButton` `:429-431`. Delta mới: `PcPaperButton` emit class `pc-paper-button` → art thật lấy từ `pc-paper-scene.css:33-39`, file này vào production qua `@import` `pc-paper-production.css:1` (→ `pc-paper-type.css`) — reviewer không truy đường @import này.
8. **TabBar import — ACCEPTED.** `WorkerLodgePanel.vue:15`.
9. **Warning pushes + toast skin — ACCEPTED.** `ChieuMoTab:84`/`DuyenPhanTab:118`/`QuaTangTab:97`; `.toast-item` skin `secondary:99-107`.
10. **BuildingSystem special-cases — ACCEPTED.** `gathering_outpost` branch `:283` (kèm comment spirit_spring đã xóa `:282`), capacity 10h-yield `:304`, `resolveProducesMaterialId` realm-tier `:395-398`.
11. **spirit_spring orphan — ACCEPTED.** Dir tồn tại trong `public/assets/buildings/dong-fu/v2/`; zero building tham chiếu.
12. **CHQ upgradeCost — ACCEPTED.** `mortal_ore_decade`/`qi_refining_wood_decade` `:248-252` (khác sink gỗ gathering_outpost `:104-107`).
13. **Preview pin mismatch — ACCEPTED.** model `x:44 y:448` `DongFuPreview.vue:24` vs `top:486px !important` `ui.css:164`.
14. **df-notice — ACCEPTED** (substance; cite đúng `:493`).

### Wrong — tất cả ACCEPTED

1. **collectBuilding notify bịa — ACCEPTED.** Path thật: `notifyMaterialGained`→quest tracking `GameManagerQuestOps.ts:71-82` + `createBagOverflowEvent` chỉ-khi-tràn `:278-281` (push ở `:278-281`, notify ở `:276`). Grep `lingThach` zero hit trong src/; `kind:'loot'` chỉ ở BattleLootSystem:778/EquipmentOpsSystem:139/CompanionOps:153,212,221,295; `collectLinMach` early-return `:314-316`. Thu hoạch im lặng — open question 9.
2. **getProductionUpgradeCost zero caller — ACCEPTED.** Def `:392-394`, grep toàn repo (src+tests) không một callsite.
3. **Quote shape — ACCEPTED.** `{upgradable, reasons[], cost|undefined}` `ProductionSystem.ts` ~`:352-396`; panel đọc `.cost` `:177` + `.upgradable` `:211`.
4. **BETA_PILL_FAMILIES không tồn tại — ACCEPTED.** Thật: `PILL_FAMILIES.filter(betaRecipeFamilyOfId(f.id)!==null)` `:39`; predicate `betaScope.ts:359`.
5. **Sigil accent sai — ACCEPTED + bổ sung.** `ui.css:196` flatten `color:#375a42;background:#f0e4c8`. Verify sâu hơn: scoped span `:644-655` vốn dùng `--scene-forest-accent` cho **cả 3 loại** (không per-kind ngay từ đầu) — 'per-kind' chỉ đúng ở gradient nền `__art[data-kind]`.
6. **Cơ chế màu nút collect — ACCEPTED.** `variant` default `'primary'` `GameButton.vue:23` → `game-button--primary`; text thật `#352713` (`ui.css:80` `:is(#app,body)`+3class thắng `pc-paper-production.css:7` `#302718`).
7. **rewardSummary vị trí — ACCEPTED.** `:30-41` (`:94-103` là SiteRow interface).
8. **DongFuFidelityScene:72 — ACCEPTED.** File 50 dòng, mount `DongFuHomeContent` `:27`; chỉ `DongFuPreview.vue:42` import.
9. **ImperialScrollScene lệch dòng — ACCEPTED.** body `:74`, frame `:80`, grain `:75-79`, corners `:81-86`, clouds `:87-88`, close `:98-106`, plaque img `:94`.
10. **Lệch dòng nhỏ — ACCEPTED.** Re-verify: scrollfade `:326`, isProducing `:154`, stateVersion `:106,:171,:231,:282`, `SLOT_SYMBOL` số ít `:111` (auto-farm `:122`, home `:123`), upgrade `:214-218`, getWorkerLodgeSurfaceModel `:152-181`, getProductionUpgradeCost `:392-394`, `BETA_WORKER_LODGE_TABS` `:534-539` + `WORKER_LODGE_TAB_FEATURE` `:551-558`, NAV_ITEMS `:204-208`, activateSlot `:330-344`, betaWheelSlots `:109`. Riêng AssetBundleCatalog: cơ chế thật là vòng `DONG_FU_BUILDING_ART` `:803-806` + `dongFuBuildingAssetUrls` `DongFuBuildingArt.ts` (file catalog không chứa literal 'gathering_outpost').
11. **reachLabel — ACCEPTED.** SiteRow `:71-103` kết thúc `remainingLabel` `:102`; không field `reachLabel`.

### Delta mới của pass này (ngoài 25 finding)

- `pc-paper-scene.css` + `pc-paper-type.css` vào production qua chuỗi `@import` (`pc-paper-production.css:1` → `scene:1`); `.pc-paper-button` `:33-39` là art thật của currency chips sống — báo cáo gốc chỉ nói 'render PcPaperButton' chưa nói stylesheet nguồn.
- `tien-hiep-collections.css` mồ côi toàn file (0 importer; `.th-collection`/`.exploration-paper` 0 emitter) — thêm vào mục 'skin thừa'.
- `useBuildingNavigation.upgradeBuilding` `:116-135` — write path duy nhất phía sau `BuildingUpgradeButton` trên header cuộn (gate `quoteBuildingUpgrade`), thêm vào mount chain.

### Verified-ok (re-checked độc lập, giữ nguyên)

Mount chain đầy đủ + 5 lớp chặn gốc (nay 7), `workerSurfaceVisible`/`assignWorkers` no-op, shell IMPERIAL-vs-PAPER, BUILDINGS map, art paths chrome (`huyen-kim-chrome.json:426-430`), conflicts 1-10 của bản gốc, `pullInFlight` trưng, scrollfade `:326` + `theme.css:541-545`, tam trùng id 'exploration' (vi.json:1626/:2039/:2041/:2062 + `LEFT_PANEL_NAV_ID:79,:82`).
