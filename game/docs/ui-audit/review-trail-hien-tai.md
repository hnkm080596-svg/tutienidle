# Review: Trail / Điều hướng hiện tại

Skeptical review của audit report scope Trail. Branch `devin/artui-c0-foundation` @ `8ffc8e64`, thư mục `game/`, đường dẫn tương đối `src/`.

## Missed

### Cơ chế & listeners (quan trọng nhất)

1. **Block CSS "Rail over panels" — cơ chế khiến rail bấm được trên panel, report không tìm thấy**: `assets/tien-hiep-ui.css:381-411`. Root mọi fidelity overlay scene (`.cf-scene`, `.skill-paper-scene`, `.realm-paper-scene`, `.technique-paper-scene`, `.body-paper-scene`, `.alchemy-scene`, `.inventory-scene`, `.equipment-scene`, `.quest-scene`, `.settings-scene`, `.exploration-scene`) bị `pointer-events:none` (:389-400), con trực tiếp `> *` giữ `pointer-events:auto` (:401-411). Comment :381-388 mô tả đúng vấn đề report chỉ đoán ở claim #6: rail không out-z được overlay canvas nên fix bằng hit-test — click nền panel rơi xuống `onSceneClick` của DongFuStage. Claim #6 kết luận "rail clickable trên panel = có chủ đích / nghi vấn" mà không cite rule chứng minh intent.

2. **`@click.self` backdrop-dismiss của fidelity scenes = dead code hệ quả của #1**: `components/scenes/character/fidelity/CharacterFidelityScene.vue:32` `@click.self="emit('back')"` — root `.cf-scene` nằm trong list pointer-events:none → `click.self` không bao giờ fire; Escape vẫn live qua `useDialogFocus` (:29); click-outside thực tế chạy bằng fall-through → `DongFuStage.onSceneClick` (DongFuStage.vue:366-369). Report không nhận ra dialog contract đã chuyển chủ quyền.

3. **`data-df-ui` = marker của `INTERACTIVE_SELECTOR`, không phải hit-test**: `DongFuStage.vue:364` `button,a,input,[role=button],[data-df-ui]` — chỉ để `onSceneClick` quyết "vùng trống hay không". Report gán `data-df-ui` cho quest card và hiểu nhầm vai trò.

4. **Live ticker 30s của Thiên Cơ Bảng**: `composables/useThienCoEntries.ts:29` `TICKER_MS=30_000` + `:47-53` `setInterval` recompute `nowMs` phục vụ countdown alchemy — chạy thường trực kể cả board collapsed/panel mở. Report chỉ cite `:100` vòng lặp `DONG_FU_BUILDING_IDS`, bỏ qua `MAX_ENTRIES=4` (:28) và `PRIORITY` order (:31-37).

5. **Timer + window listener trong DongFuStage**: `noticeTimer` `setTimeout` 3200ms (:83-95) cho `.df-notice`; `onMounted` gắn `window.addEventListener('keydown', onKeydown)` (:403-408) — report cite handler :380-401 nhưng không nói đó là window-level; và Escape xử trước check `isEditableTarget` (:381-388) → Escape trong input vẫn đóng wheel.

6. **`SceneDesignCanvas` ResizeObserver + scale transform**: `components/common/SceneDesignCanvas.vue:20-23` observer resize đo viewport → `transform: translate(-50%,-50%) scale(...)` (:10) cho canvas 1440×810; `.scene-viewport` fixed inset:0 (:37); variant `--overlay` click-through hoàn toàn (:41-42). Mọi panel "trông như scene" đều scale qua đây — mount chain của report không đề cập.

7. **Gate mount `GameRoot` trong App**: `App.vue:1293` `<GameRoot v-if="isBooted" :inert="authorityOverlayActive">` — hai gate (boot + inert) vắng trong mount chain (và cite sai dòng — xem Wrong #3).

### Logic/UI còn sống trong scope

8. **Currency chips = dead affordance**: `PcPaperButton` trong `.home-design-currencies` (`DongFuStage.vue:429-431`) emit 'click' nhưng không handler — nút ＋ vô dụng; component chỉ forward (`PcPaperButton.vue:3`).

9. **Tutorial dạy gesture chết**: `locales/vi.json:1847` "Bấm vào nhân vật đang tu luyện (hoặc phím Tab) … mở Bảng Lệnh" — không còn cultivator hitbox trong prod; Tab giờ toggle rail, wheel = Backquote. `:1867` "bấm trực tiếp công trình trên bản đồ" — building hotspot không tồn tại trong DOM prod (chỉ còn comment `commandWheelCatalog.ts:83`).

10. **Dead locale keys trail**: `home.commandWheel.hint`/`openAria` (`vi.json:1785-1788`) không consumer prod; `home.daoLuan.center` (:1789-1791); `home.topBar.*` (:1792+) — `topBar.realmLine` vẫn live nhưng ở `CombatPlayerCard.vue:86`, không phải home chrome.

11. **`navAction('home')` = đóng overlay về nhà**: `NAV_TARGET` :230 + `navAction` :282 — item `home` là nút "close overlays"; summary của report không nêu case.

12. **`RouteMount` sibling trong chrome chain**: `GameRoot.vue:205` — route-host nằm cùng cấp panel chrome, không được nhắc.

### Art & CSS

13. **Building header art LIVE vắng trong art map**: `composables/useBuildingHeaderState.ts:35` `artPath = /assets/buildings/dong-fu/v2/{id}/base.png` → `.building-heading__art` trong `FunctionOverlayPanel.vue:133-139` + fallback `artBroken` 404 (:96-100). Report gom building art vào "preview-only" — `base.png` thực tế live ở header legacy/imperial panels.

14. **Dead-DOM art vẫn ship + prefetch**: `presentation/assets/AssetBundleCatalog.ts` vẫn prefetch plaque `DONG_FU_BUILDING_ART` (:803-804), toàn bộ `THANH_VAN_SEASONS` overlay (:807), `navigation-connector-v1.png` (:652), `navigation-backing-dark-v3.png` (:650). Report có connector nhưng sót plaque + season overlays.

15. **`BuildingTooltipContent` dead**: `composables/useTooltip.ts:155-180` — tooltip content cho plaque, consumer duy nhất nằm trong preview chain.

16. **`DongFuResourcePill` dead qua trung gian, không phải "preview chain"**: importer duy nhất là `CurrencyHud.vue` (dead — chỉ `CurrencyHud.test.ts` dùng) → pill dead theo; report xếp nhầm vào chuỗi preview.

17. **`.th-panel-swap` transition spec**: `tien-hiep-ui.css:373-379` — định nghĩa animation swap cho mọi panel trong open flow (`LeftPanel.vue:16-19`, standalone panels, `QuestPanel.vue:30`) — report dùng class khắp nơi mà không cite rule.

18. **`.df-quest` rules dead**: `tien-hiep-ui.css:235` + `::before` :271 — style tracker cũ đã thay bằng `.home-design-quest`.

19. **`donFuBuildingTimeClass` dead fn**: `presentation/background/DongFuBuildingArt.ts:151` export không caller.

20. **Orphan icon + id**: `public/assets/ui/tien-hiep-2026-10/icons/` có 22 file `navigation-*-v2.png` — thừa `navigation-forge-v2.png` (`forge` không có trong `NAV_ITEMS` :204-208). `PcPaperIconIds` còn 'compass'/'opportunity'/'body-*' không dùng cho rail (`PcPaperIcons.ts:4-6`).

21. **`CHIP_ICON` gán icon theo index**: `DongFuStage.vue:298-307` — reorder `SPIRIT_STONE_MATERIALS` (`useCurrencyChips.ts:32-40`) là icon lệch.

22. **Tab bị hijack**: `onKeydown` `preventDefault` Tab (:389-395) để toggleRail — mất focus navigation chuẩn khi home hiển thị.

## Wrong

1. **`NAV_ITEMS` = 21, không phải 20**: `DongFuStage.vue:204-208` = 16 id thường (home, character, skill, equipment, body, technique, realm, inventory, alchemy, formation, exploration, quest, production, vendor, settings, feedback) + `...NAV_LOCKED` 5 id (:203) = **21**.

2. **Icon rail ×21 + 1 orphan = 22 file, không phải ×20**: `:458` render `navigation-${id}-v2.png` cho 21 items; `icons/` chứa 22 file `navigation-*-v2.png`.

3. **`App.vue:4`**: `GameRoot` mount ở `App.vue:1293` (`v-if="isBooted" :inert="authorityOverlayActive"`), import :63 — không phải dòng 4.

4. **Quest card "(z cao, `data-df-ui`)" — sai cả hai**: `.home-design-quest` không `z-index` (DongFuStage.vue:552) và không `data-df-ui` (:433). Nó clickable trên panel vì `.df-scene` KHÔNG nằm trong list pointer-events:none và `.df-scene--covered` chỉ giấu board+notice (:566-567). Kết luận "nổi trên panel" đứng, nhưng bằng chứng cite sai; và click vào nó không bị `onSceneClick` nuốt vì `button` đã có trong `INTERACTIVE_SELECTOR` (:364).

5. **`PaperPanelNavigation` "mounted at `CharacterFidelityScene.vue`" — sai**: file chỉ chứa comment R9 (`CharacterFidelityScene.vue:5` "no PaperPanelNavigation"), không import/mount. Mount duy nhất `ui-preview/PaperPreviewSurface.vue:19`. (`usePaperNavigation` không caller prod — đúng: chỉ `ui-preview/paperNavigation.ts`.)

6. **`BUILDING_ANCHORS` không tồn tại**: không symbol nào tên đó — chỉ comment `DongFuHomeContent.vue:117`. Data thật là `DONG_FU_BUILDING_ART[id].scenePlacement/hitbox` (`DongFuBuildingArt.ts:48-134`).

7. **`settings` không "chỉ reachable qua wheel"**: claim gom `scripture_pavilion`+`settings` thành buried — `settings` CÓ trên rail (`NAV_ITEMS` :208, `NAV_TARGET` :243 → paperMode). Chỉ `scripture_pavilion` thực sự wheel-only (catalog :230-237).

8. **Drift cite ±1-4 dòng** (không sai nội dung nhưng off hàng loạt): `dongFuUi.ts` `symbolUrl` :12-14 (report :13-15), `badge 'upgrade'` :23 (:24); `DongFuWheel` consts :14-16 (:11-13), nodes :17-27 (:15-25), activate :28-31 (:26-29), `v-show` :34 (:31), orbit :35 (:32); `DongFuBoard` props :5 (:4), emits :6 (:5); `BETA_WHEEL_SLOT_FEATURES` :64-80 (:75-80); `FunctionOverlayPanel` `TITLE_KEYS` :25-34 (:25-33), `IMPERIAL_MODES` :41-47 (:40-46), `PAPER_MODES` :53-58 (:50-55), `BUILDINGS` :60-67 (:57-64), `mode` :69-77 (:67-76), paperMode :113-118 (:110-116); `panelIds.ts` unions :19-47 (:19-40); `LandscapeDesignPreview` rail mock ~:59-78 (:61-72); `commandWheelOrbit` :4-9 (:4-7).

## Verified-ok

### Mount chain & host

- `GameRoot.vue:138` `<MainScene @click="closeSidePanels">` + `:140` `v-if="!isFullSceneActive"` (route combat|tribulation qua `useCombatSceneActive` :66-72) — đúng.
- `MainScene.vue:18-20` chỉ `DongFuStage` + `PhaserCanvas` (comment stacking :12-17) — đúng, hết `df-grid`/left/right-panel legacy.
- `SceneDesignCanvas v-if="!stageActive"` :412 + `useStageActive.ts:9-22` — đúng.
- Template `.df-scene` :413-419: profile :421-427 (data-df-ui), currencies :428-432 (data-df-ui), quest :433-445, rail :446-470 (data-df-ui), seam :471, toggle :472-479, wheel :480-485, board :486-491, AutoFarmIndicator :492, notice :493 (data-df-ui), frame :494, `FeedbackDialog` :497 ngoài canvas — đúng.
- `LeftPanel.vue:16-19` th-panel-swap + nhánh CharacterSurface/InventoryPanel — đúng.
- `FunctionOverlayPanel` 3 lớp (paperMode :113-118 / ImperialScrollScene :122-155 chỉ exploration / OverlayPanel legacy :158-195); `close`→`closeHomeOverlays` :102-104 — đúng.
- Standalone: 9 `defineAsyncComponent` :15-23, `mountedStandalone` lazy-once + technique bounce toast `panels.hkNav.techniqueLocked` :77-100, idle prefetch :110-123, `closeSidePanels` :130-132 — đúng.
- `stores/ui.ts`: `leftPanelMode` :123, `characterOverlayOpen` :125, `characterSceneTab` :130, `isCommandWheelOpen` :135, `standalonePanel` :151; `toggleLeft` :199-224, `openLeftPanel` :226-242, `openStandalonePanel` :244-255, `closeHomeOverlays` :258-263, `toggleCommandWheel` :265-274, `closeCommandWheel` :276-278 — đúng.

### DongFuStage logic

- `surfaceOpen` :56-58, `feedbackOpen` :60 + watch :67-69, `boardOpen` :61, `railCollapsed`/`railIndicator` :62-63, `toggleRail` :71-76, `onRailTransitionEnd` :78-80, `flashNotice` :85-92 — đúng.
- `renderedSlots` filter `available()` :109; `SLOT_SYMBOL` :111-127; `slotDisabledReason` :129-131; `slotActive` :133-142; `slotBadge` :144-153; `KIND_SYMBOL` :170-176; `boardEntries` :178-188 — đúng.
- `NAV_LOCKED` :203; `NAV_FEATURE_LOCKED` formation→tran_phap :214-216; `navLocked` :217-221; `NAV_TARGET` :226-245 (feedback local dialog); `NAV_ACTIVE_PANEL` :249-256 (`production:'exploration'` :253 hardcode vs `buildings.ts:102` — drift risk đúng); `NAV_ACTIVE_STANDALONE` :258-265; `navActive` :267-278; `navAction` :280-291 (cue `ui.wheel.select` :282) — đúng.
- `currencyChips` :299-307; `trackedQuest`/`questCard` :309-325 qua `questOps.getBetaQuestSurfaceModels`; `profileProgress` :327 — đúng.
- `activateSlot` :330-345; `onWheelAction` :347-359 entry→slot→notice `dongFu.unhandled` :358 — đúng.
- `onSceneClick` :366-369 + `INTERACTIVE_SELECTOR` :364 — đúng và LIVE: `.df-scene` không bị pointer-events:none, `@click.stop` nuốt propagation → claim #7 "đường GameRoot gần như không chạy" đúng.
- `onKeydown` :380-401 Escape→wheel only / Tab→rail / Backquote→wheel, gates `!stageActive && !surfaceOpen` (+`!feedbackOpen` wheel) — đúng.
- `.df-scene--covered` chỉ ẩn `.df-board`+`.df-notice` :566-567 — đúng.

### Wheel & board & composables

- `DongFuWheel` props :5 / emit :6 / single-ring comment :8-13 / `v-show` mount thường tr���c :34 / `:selected="null"` :483 → `is-selected`,`aria-pressed` dead — đúng.
- `DongFuBoard` `InkNineSlice chrome-id="surface-l-drawer"` :11 (asset `huyen-kim-chrome.json:86-90`), heading toggle :12, `.df-board__go` :18 — đúng.
- `commandWheelCatalog`: 15 slots, `talisman_slot` `NEVER_AVAILABLE` :150-155 (zombie qua feature `null` `betaScopeSurface.ts:70`), ring4 scripture_pavilion+settings :230-244, `RING_3_BUILDING_IDS` :248-250 — đúng.
- `betaScopeSurface`: `featureAdmits` :41-46, map :64-80, `isBetaWheelSlot` :83-85, `betaWheelSlots` :92-94, `isBetaBuildingSurface` :118-120, `isBetaStandalonePanel` :165-167, `isBetaLeftPanelMode` :169-171 — đúng.
- `useBuildingNavigation`: status priority :81-107 (`slotBadge` chỉ vẽ ready/upgradeable — đúng); `openBuilding` fail-closed :137-155 → `openLeftPanel(functionType)` :152-153 — đúng.

### Conflicts & dead code

- Hai hệ icon song song (rail PNG v2 vs huyen-kim SVG `SLOT_SYMBOL`/`KIND_SYMBOL`) — đúng.
- Rail hiện-locked vs wheel ẩn-hẳn — đúng.
- Global CSS đè scoped: `df-board__go` (`tien-hiep-ui.css:79` tắt clip-path scoped `DongFuBoard.vue:44`), cream :74-78/:260-261/:228-230, `.df-node__orb` :65-69 + `transition:none` :197-199 — đúng.
- Dead code: `commandWheelOrbit.ts:4-9` không caller; `PcPaperSceneActions.vue` không importer; `CurrencyHud.vue` chỉ test; chuỗi preview DongFuHomeContent/FidelityScene/Vista/Hud/ArtFrame; `usePaperNavigation` chỉ `ui-preview/paperNavigation.ts` — đúng.
- Dead CSS/DOM: `.paper-navigation` :11-24/:185-186/:202-206/:353-357; `.df-vista*`,`.df-cultivator` :60-64; `.df-location` :71-73/:176/:226-227; `.df-building` :152-166; `.df-resources/.df-identity/.df-utilities` :167-175; `.df-board .df-art-frame` :75/:228/:352; `.df-quest` :235/:271 — đúng.
- `Escape` không đồng nhất: stage chỉ đóng wheel; panels tự xử `useDialogFocus` onEscape (`OverlayPanel.vue:39`, `ImperialScrollScene.vue:33`) — đúng.
- `feedbackOpen` ngoài `closeHomeOverlays` (xử tay :285 + watch :67-69) — đúng.
- Locale cites đúng: `toggleWheel` :2020, `railOpen` :2021, `railClose` :2022, `buildingHint` :2023, `sceneTitle`/`sceneSubtitle` :2024-2025, `unhandled` :2027, `nav.guild/sect/portal` :2047-2049, `questTracker.aria` :1836 (buildingHint/sceneTitle/sceneSubtitle chỉ preview dùng — đúng).
- Art cites đúng: `navBackingUrl` :197→:447, `--home-nav-art` :195→`::before` :538, `navSeamUrl` :198→:471, `world-vista` :191-193, avatar `character.png` :422, `CHIP_ICON` :298-307 — đúng.
- `ImperialScrollScene.vue:29` comment R9 — đúng.
