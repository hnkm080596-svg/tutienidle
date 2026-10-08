# Panel: Overlay/scene host (FunctionOverlayPanel + host shell toàn cục)

Phạm vi: branch `devin/artui-c0-foundation` (snapshot `8ffc8e64`), `game/src`. Audit read-only — mọi claim có cite file:line. Bản này đã gồm adjudication của review pass 1, verify lại từng finding trên code.

## 1. Mount chain — từ nav/route đến component gốc

**Đỉnh cây:**
- `main.ts:5-11` nạp CSS global theo thứ tự: `theme.css` → `huyen-kim.tokens.css` → `system-theme.css` → `tien-hiep-ui.css` → `tien-hiep-secondary-ui.css` → `tien-hiep-auxiliary.css` → `pc-paper-production.css`. Sheet cuối kéo theo chuỗi `@import`: `pc-paper-production.css:1` → `pc-paper-scene.css` → `pc-paper-scene.css:1` → `pc-paper-type.css` — cả hai thực chất nằm trong global production, không chỉ preview/DongFuStage.
- CSS ngoài chuỗi main.ts nhưng CÓ đường production: `qi-hall.css` (chỉ `EquipmentHallPanel.vue:10`; RefineTab/WashTab chỉ nhắc trong comment nói *không* phụ thuộc nó), `tien-hiep-entry.css` (`AuthEntryScreen.vue:12`, mount `App.vue:1263`). CSS mồ côi hoàn toàn (0 importer): `tien-hiep-collections.css`, `tien-hiep-outcomes.css`, `tien-hiep-forge.css`, `tien-hiep-progression.css`, `pc-paper-auxiliary-production.css`.
- `main.ts:59` `installTienHiepUiAssets(document.documentElement)` — nguồn inject toàn bộ biến `--th-art-*` + `pcPaperControlStyles()` mà global rules dùng (`TienHiepUiAssets.ts:25-31` setProperty trên root).
- `App.vue:1293` `<GameRoot :inert="authorityOverlayActive">` — `inert` không phải prop khai báo của GameRoot → fallthrough attribute lên `.game-viewport`; là HTML attr thật (Chrome 102+ hỗ trợ) → authority overlay thực sự khoá cây game.
- Các overlay mount NGOÀI GameRoot trong App.vue: `BetaCompletionModal :1303-1306` (trong ErrorBoundary `:1286-1307` — KHÔNG trong GameRoot), `CombatPauseOverlay :1314` (`:inert`, `@continue`), `PresentationTransitionOverlay :1318-1328` (`:inert` bind `:1320` — xem §4.14), `.authority-overlay` ×4 (`:1336,:1345,:1364,:1380`, style `:1440`, z=authority 1950), `UpdateBanner :1391`, `PhapTuLabBridge :1393` (mount bất điều kiện, tự gate `import.meta.env.DEV`+mock `PhapTuLabBridge.vue:30-31`), `ErrorScreen :1395`, `SaveIncompatibleScreen :1275` (saveGate 4000), `LoadingScreen :1289` (game branch) + `:1250` (boot RouteMount), `OnboardingStage/AuthEntry/CharacterCreation :1262-1264`, `DevToolsPanel :1297` (self-gate `isMaster` `DevToolsPanel.vue:287,:290`).
- `RouteMount` witness ×3 ở App.vue `:1249,:1258,:1268` (boot/auth+character/error) + 1 trong `GameRoot.vue:205` — tổng 4; renderless, báo `markRouteMounted`/`markRouteUnmounted` qua routeAdapter.
- `GameRoot.vue:136-207`: `.game-viewport > .game-root >` `MainScene` (`@click="closeSidePanels"` `:138` → `ui.closeHomeOverlays()` `:130-132`) + khối `v-if="!isFullSceneActive"` `:140-175` chứa `LeftPanel :149`, `FunctionOverlayPanel :150`, 9 standalone panel lazy (`:156-174`); `CombatSceneOverlay :177` / `TribulationSceneOverlay :178` (đích `isFullSceneActive` phục vụ); chrome block `:180-203` (`Tooltip/ToastContainer/ActionFeedbackLog/WorldAnnouncementOverlay/OfflineSummaryModal/TalentEntitlementModal/BreakthroughRequirementPanel/TutorialOverlay`) nằm **NGOÀI** v-if — luôn mount kể cả route combat; `RouteMount :205`.
- `isFullSceneActive` = route 'combat'|'tribulation' (`GameRoot.vue:70-72`, `useCombatSceneActive.ts:19`, `useStageActive.ts:16-19`) — authority duy nhất là `routeAdapter.activeRoute`, không còn flag ui-store.
- `MainScene.vue:18` mount `DongFuStage` (sibling `PhaserCanvas :20`) — DongFuStage KHÔNG phải con trực tiếp `.game-root`.

**Điểm vào (writers vào ui store):**
- Rail trái (production chrome chính): `DongFuStage.vue` `NAV_ITEMS :204-208` → `NAV_TARGET :226-245` → `openLeftPanel('character'/'inventory'/'stage_select'/'settings')`, `openStandalonePanel('skill'/'body'/'technique'/'realm'/'quest'/'tran_phap')`, `navigation.openBuilding('equipment_hall'/'pill_room'/'gathering_outpost'/'vendor')`, feedback→local `feedbackOpen :241-244`; `navAction :280-291` (home → `closeHomeOverlays :287`; cue trực tiếp `cue('ui.wheel.select') :282`). `NAV_LOCKED` cứng `['artifact','companion','guild','sect','portal'] :203`, `NAV_FEATURE_LOCKED :214-216` (formation→tran_phap). Active-state mirror: `NAV_ACTIVE_PANEL :249-256` + `NAV_ACTIVE_STANDALONE :258-265` → `navActive :267-278`.
- Command wheel (Backquote): `DongFuWheel` mount `:480-485`, `activateSlot :330-345` (cue `:332`, `ui.closeCommandWheel() :333` — KHÔNG qua closeHomeOverlays vì wheel đang mở thì panel đã null) → `openBuilding`/`openLeftPanel`/`openStandalonePanel`; catalog `commandWheelCatalog.ts:88-246`; slot list bị beta-filter `betaWheelSlots() :109` (`betaScopeSurface.ts:92`; `BETA_WHEEL_SLOT_FEATURES :64-78` bind phap_bao→artifact / formation_slot→formation / companion_roster→companion / chi_hien_quan→manualWorkforce — tất cả `false` trong `betaFeatureFlags.ts:31-42`).
- Board Thien Co Bang `DongFuBoard :486-491` (`boardOpen :61`, entries `:178-188`) + action router `onWheelAction :347-359` (entry.run() → slot fallback → `flashNotice(t('dongFu.unhandled')) :358`).
- Building hotspot → `useBuildingNavigation.openBuilding` (`:137-155`): `isBetaBuildingSurface` fail-closed `:141` → `template.functionType :152` → `openLeftPanel :153`.
- Thien Co entries: `useThienCoEntries.ts:77,94` → `openStandalonePanel('realm'/'quest')`, CTA building `:120,:134,:145`.
- Quest tracker card `DongFuStage.vue:433-445` → `openStandalonePanel('quest') :439`.
- Tribulation receipt `useTribulation.ts:104-109` → `openStandalonePanel(result.standalonePanel) :108` — chỉ 'quan_khi' hợp lệ (pinned `saveShapeValidation.ts:4818-4832`).
- Writer thứ hai cho 'quan_khi': `RealmSurface.vue:108-109` `onQuanKhi()` → `openStandalonePanel('quan_khi')`, wired `@quan-khi :122`.
- Dev seam: `PhapTuLabBridge.vue:40` → `openStandalonePanel('skill')`; `DevToolsPanel` App.vue:1297.
- `usePaperNavigation.navigate` (`usePaperNavigation.ts:128-140`) → cùng 3 đích — KHÔNG có consumer production (§5).

**State machine đóng/mở (`stores/ui.ts`):**
- 4 trường: `leftPanelMode :123`, `characterOverlayOpen+characterSceneTab :125,:130`, `standalonePanel :151`, `isCommandWheelOpen :135`. `closeHomeOverlays()` null hết 4 (`:258-263`). Mutual exclusion theo contract — nhưng KHÔNG tuyệt đối: `toggleStandalonePanel :320-331` không gọi `closeHomeOverlays`. Không sập vì `toggleStandalonePanel` và `toggleLeft` đều là **dead actions** (0 caller trong src — chỉ `toggleCommandWheel` được gọi `DongFuStage.vue:399`; `toggleLeft` cũng có `closeHomeOverlays :209,:219` nên dù có caller vẫn an toàn — `toggleStandalonePanel` thì không).
- `openLeftPanel :226-242`: 'character'/'inventory' đi nhánh `characterOverlayOpen+characterSceneTab`; `openStandalonePanel :244-255`; tất cả qua `isBetaLeftPanelMode`/`isBetaStandalonePanel` fail-closed (`betaScopeSurface.ts:165,169`; maps `:132,:152` — worker_lodge→manualWorkforce `:159`, artifact/tran_phap/companion scope-hidden).
- Seam phụ `mountedStandalone` `GameRoot.vue:77-100` — lazy-once Set: mount lần đầu khi mở, wrapper KHÔNG unmount khi đóng (panel sống với `open=false`); gate progression Tam Phap `:89-95` (bounce + toast `panels.hkNav.techniqueLocked`). Toàn bộ block panel nằm trong `v-if="!isFullSceneActive"` nên combat route vẫn unmount panel — nhưng Set sống trong GameRoot (GameRoot không unmount khi combat), nên về home panel remount ngay với chunk đã warm.
- Idle warm-up chunk `:110-123`. Chokepoint thứ 2: `FunctionOverlayPanel.vue:69-77` `mode` computed re-derive từ `leftPanelMode`, loại 'character'/'inventory' và mode scope-hidden.
- `enterCombatScene :350-352` chỉ ghi `combatOrigin` — panel state sống qua combat (§4.10). Không nơi nào reset panel state khi route rời home (grep `closeHomeOverlays` toàn src: chỉ close path, không có route watcher).

**3 host shell cạnh nhau:**
- `LeftPanel.vue:16-19` — `th-panel-swap` + `CharacterSurface`/`InventoryPanel`.
- `FunctionOverlayPanel.vue:113-118` — `th-panel-swap` cho 4 paperMode: StageSelect→`StageSelectPanel :114`, PillRoom→`PillRoomPanel :115`, EquipmentHall→`EquipmentHallPanel :116`, settings→`SettingsSurface :117`.
- `FunctionOverlayPanel.vue:122-155` — `ImperialScrollScene` cho scrollMode (chỉ 'exploration' → `ProductionPanel :152-154`).
- `FunctionOverlayPanel.vue:158-195` — `OverlayPanel` legacy: worker_lodge→WorkerLodgePanel, scripture_pavilion→ScripturePavilionPanel, vendor→VendorPanel `:190-194`.
- Standalone: `SkillPathPanel.vue:16`, `RealmPanel.vue:14`, `TechniquePanel.vue:14`, `BodyPanel.vue:14`, `QuestPanel.vue:30` (th-panel-swap + fidelity surface); `QuanKhiPanel.vue:316`, `ArtifactPanel.vue:140`, `TranPhapPanel.vue:348`, `CompanionPanel.vue:317` (OverlayPanel legacy).
- Teleport-to-body (ngoài `.game-root` stacking): `FeedbackDialog.vue:362` (OverlayPanel `variant="paper" :366`), `ConfirmModal.vue:78-103`, `LoreCodexModal.vue:30-42`, `GuestAbandonDialog.vue:34-69` — hai cái cuối nằm ở `components/panels/`.

## 2. UI logic inventory

**FunctionOverlayPanel.vue:**
- `mode :69-77` (chokepoint beta-gate); `PAPER_MODES :53-58`; `IMPERIAL_MODES :41-47` (thêm 'exploration'); `paperMode/scrollMode/legacyMode :79-87`.
- `BUILDINGS :60-67` → `buildingId :89` → `useBuildingHeaderState :91` (`useBuildingHeaderState.ts:9-71`, artPath `/assets/buildings/dong-fu/v2/<id>/base.png :28`); chỉ render trong `#header` scroll `:131-150` và `#heading`/`#header-actions` legacy `:170-188`.
- `BuildingUpgradeButton` `:6` — CTA nâng cấp render trong cả scroll `#header :144` và legacy `#header-actions :187`.
- `artBroken :96` + `watch :98-100` (ẩn img khi 404); `TITLE_KEYS :25-34`; `close() :102-104`; `@close :127,:164`; `@error :138,:177`.
- Scoped `.building-heading* :201-236`, `@container (max-width:640px) :242-244`; testid `function-overlay-panel` trùng trên 2 shell `:126,:163`.

**Shells:**
- `OverlayPanel.vue`: props `:11-27` (layer default `OVERLAY_LAYERS.panel`=1800, variant 'ink'|'system'|'paper'); `useDialogFocus :39` qua `cardEl` computed (SysPanel instance → `$el`) `:33-38`; scrim `@click.self :53`; `InkNineSlice :66-68` (ink→surface-m-panel, paper→surface-xl-scroll, non-system→frame-m-modal); close `GameButton :84-91`; scrim 78% ink+blur `:98`; `overlay-fade :120-123`; `container-name: overlay-panel` trên card `:99` — nhưng FunctionOverlayPanel dùng `@container` **không tên** `:242` (comment `:238-241` thừa nhận named container không tồn tại trong scene shell).
- `ImperialScrollScene.vue`: props `:17-25`; `useDialogFocus :33`; scrim `@click.self :47` + `rgba(6,8,12,.34)`+blur `:140`; slots `#header :109-111`, `#footer :115-117` (**dead — 0 caller truyền**), `#overlay :123-125` (**dead**, pointer passthrough `:307-315`); transition `hk-scroll` `:319-365` (clip-path center-out + roller travel) + reduced-motion `:374-397`; `data-hk-scene :47`; R9 comment `:29-30` (no PaperPanelNavigation in scroll).
- `SceneDesignCanvas.vue`: `overlay` prop → `.scene-viewport--overlay` transparent + `pointer-events:none :41-42`; `isolation:isolate :43`; non-overlay bg `#111c21 :37` bị global `tien-hiep-ui.css:10` đè `#15221e`; ResizeObserver scale `:12-24`.
- Fidelity scenes (11 file): `useDialogFocus(rootRef, () => true, {onEscape: emit('back')})` + `@click.self="emit('back')"` trên root (dead, xem §4.2); `EquipmentFidelityScene.vue:54` thêm `@keydown.esc` reset `inspecting`; `CharacterFidelityScene.vue:46-49` comment lạc hậu ("doubles as the outside-paper close").
- `useDialogFocus.ts`: Escape `stopPropagation :38-41`; **Tab cũng `preventDefault`+`stopPropagation :48-49`** (focus trap thật, comment `:46-47` nói rõ để chặn window-level Tab của DongFuStage); mousedown-outside guard `:73-79` (document listener, chỉ preventDefault — click vẫn fire); restore trigger focus `:87,:99`.

**Đường đóng panel thật:** surfaces forward `emit('back')` → `ui.closeHomeOverlays()` tại `SettingsSurface.vue:17`, `BodySurface.vue:230`, `TechniqueSurface.vue:138`, `SkillSurface.vue:865`, `CharacterSurface.vue:282`, `InventorySurface.vue:71`, `QuestScene.vue:81`, `RealmSurface.vue:123`, `AlchemySurface.vue:490`, `EquipmentSurface.vue:155`, `ExplorationSurface.vue:468`. Đây là cầu close production chính của paper scenes.
- Adapter pattern: scenes mount với **props rỗng** + named slots — `QuestScene.vue:81` (`:quests="[]" :rewards="[]"`, data thật qua slots), `InventorySurface.vue:71` (`:items="[]"`), `SettingsSurface.vue:17` (`:groups="[]"` + `#workspace` chứa SettingsPanel; comment `:4` nhắc "usePaperNavigation wiring" nhưng không import — stale). Ngoại lệ: `QuestPanel.vue:30` truyền `:rows="rows"` thật — standalone shell duy nhất cấp data cho surface.

**GameRoot/DongFuStage:**
- `mountedStandalone` + watcher `:77-100`; `mountedGameRoute :103-106`; warm `:110-123`; `MainScene @click :138`.
- `DongFuStage.vue`: `surfaceOpen :56-58` → class `df-scene--covered :416` (**chỉ** ẩn `.df-board`/`.df-notice :566-567` — profile/currencies/quest/rail vẫn hiện+bấm được, xem §4.12); `watch(surfaceOpen) :67-69` — mở surface tự dismiss `feedbackOpen` (mutual exclusion với dialog); `boardOpen :61`; rail `:62-63,71-80` (`toggleRail`, `onRailTransitionEnd` indicator); `flashNotice`+`noticeTimer :82-95` + `.df-notice:empty{display:none} :569`; `navActive :267-278`; `onWheelAction :347-359`; `INTERACTIVE_SELECTOR :364` (`button,a,input,select,textarea,[role=button],[data-df-ui]`) → `onSceneClick :366-369`; keydown `:380-401` (Escape→closeCommandWheel `:381-384`; Tab→toggleRail `:389-393`; Backquote→wheel `:397-400` — cả hai gate `!stageActive && !surfaceOpen`, wheel thêm `!feedbackOpen`) + window bubble listener `:403-408`; `slotActive`/`slotBadge :133-153`; `DongFuBoard :486-491`; `AutoFarmIndicator :492`; `FeedbackDialog :497`.
- `data-df-ui` marker: profile `:421`, currencies `:428`, rail `:446`, notice `:493` — vùng ngoại lệ trong onSceneClick.
- `uiAudioBinding.ts:44-69` — `$subscribe` flush sync → `ui.panel.open/close` + `ui.wheel.open/close`; bind `App.vue:299`, unbind `:1237`. Cue `ui.wheel.select` gọi trực tiếp `DongFuStage.vue:282,:332` ngoài binding.
- `RouteMount.vue` renderless witness (`markRouteMounted` onMounted + watch route re-marks).
- `PresentationTransitionOverlay.vue`: props `:20-34` (phase/isLocked/error/canReturnHome/paintSuppressed — không có `inert` → bind `App.vue:1320` là DOM attr trên root `.presentation-overlay :186`); `transitionend` ×2 + `safetyTimeout` 600ms `:86-137`; `lastActiveElement` save `:141-143`/restore `:149-151`; keydown **capture-phase** window listener `:170` (chạy trước bubble handler của DongFuStage `:404-408`; early-return khi unlocked+opened+no error `:155-157`; error card passthrough `:160-162`); `defineExpose :177-181` (close/open/curtainState); root `pointer-events:none` trừ khi `.is-locked :261-267`; curtain panels ink-950 flat `:272-290`; error card `:351-383`.
- `FeedbackDialog` 3 mount site: `DongFuStage.vue:497`, `SettingsPanel.vue:382`, `ErrorScreen.vue:192`.

## 3. Art map

- `ImperialScrollScene.vue:38-42` `hkChromeUrl`: `imperial-scroll-roller` ×2 `:57-70`, `scroll-title-plaque :93-96`, `paper-grain-tile :75-79`, `corner-ornament` ×4 `:81-86`, `cloud-ornament` ×2 `:87-88`; `InkNineSlice` `imperial-scroll-body`+`frame-xl-ceremony` `:74,:80`; `icon-button-utility` `:104`. Manifest `huyen-kim-chrome.json`: **44** asset, tất cả `status:'ready'` — `huyenKimChrome.ts` `hkChromeUrl` trả null cho non-ready → nhánh v-if bỏ qua (`pendingChromeIds` giờ rỗng).
- `OverlayPanel.vue:66-68` — `InkNineSlice` `surface-m-panel`/`surface-xl-scroll`/`frame-m-modal`; `SysPanel` chrome variant='system' `:55-59` (dormant).
- Building header art `useBuildingHeaderState.ts:28` (`v2/<id>/base.png`); `locked-overlay.png` tồn tại trong public + pipeline (`DongFuBuildingArt.ts:143`) nhưng overlay-host không tham chiếu.
- DongFuStage: `world-vista-warm-v1.png :191`, `navigation-medallion-v1.png :195` (var `--home-nav-art` dùng `button::before :538`), `navigation-backing-dark-v3.png :197,:447`, `navigation-landscape-seam-v1.png :198,:471` (chỉ khi surfaceOpen), `icons/navigation-<id>-v2.png :458`, `pcPaperIconUrl('character') :422`, `pcPaperResourceUrl` chip `:430`, `.pc-paper-scene__frame :494` (aria-hidden).
- Global chrome đè shell:
  - `tien-hiep-ui.css:86-91` `.hk-scroll__inner` remap text/surface ramp sang paper; `:92`→`:262` `__clip` `#efe4ca`→transparent; `:263` `__grain` thành nền giấy đặc; `:104` `__main` scrollbar vàng; `:105` `__inner .game-button--secondary` (nơi `BuildingUpgradeButton` render); `:187-190` `__plaque/__title/__inner/__header` vị trí+font đè scoped; `:185-186` `__rail` dead; `:191-196` `.production-panel` (consumer duy nhất của scroll); `:322` `.inventory-scene .chip>.ink-nine-slice{visibility:hidden}`; `:367-379` `.th-panel-swap` (enter z30, leave z29 — comment `:367-372`); `:381-389` comment giải thích rail-over-panel; `:390-411` pointer pass-through 11 scene roots + `>*` restore.
  - `tien-hiep-secondary-ui.css:3-16` reskin `.overlay-panel__card`+9 `*-modal__panel` (gồm `lore-modal`) sang paper (`border-image: panel-frame-v2 :14`); `:17` `> .ink-nine-slice{visibility:hidden}` (dead DOM); `:18` scrim `#07120e85`+blur(3px); `:19-22` header/close; `:72-74` `.building-heading*` (đè scoped FunctionOverlayPanel `:201-236`); `:124-137` `::before` paper-fill + `::after{border-image:inherit} :127`.
  - `tien-hiep-auxiliary.css:77-80` `::before` art `var(--th-art-warm-landscape-header), var(--th-art-paper-surface)` trên `.overlay-panel__card`+9 modals (gồm `lore-modal`); `.tran-phap-panel* :2-40+`, `.artifact-panel :82`.
  - `pc-paper-production.css` (stylesheet CUỐI, `main.ts:11`): `:3` remap `--font-display/--font-body/--hk-font-display/--hk-font-ui` toàn app; `:5-14` restyle mọi `.game-button` + `:12` `.game-button>.ink-nine-slice{display:none}` (dead DOM lớp 2); `:15-18` `.overlay-panel__card:not(--system)`+8 modals (KHÔNG gồm `lore-modal`) → `background:none;border:0;border-image:none;isolation:isolate` — **đè `border-image:panel-frame-v2` của secondary `:14`** → `::after{border-image:inherit}` kế thừa `none` (khung nine-slice thực tế tắt trên 9 selector đó); `:20` reskin `#global-tooltip` lần 3; `:21` `.pc-paper-scene{pointer-events:auto}`; `:24-49` `.pc-settings-content .settings-panel*`; `:52-61` `.feedback-dialog*`; `:67-69` `.hk-art-scene` box-sizing (đè `.df-scene.hk-art-scene` DongFuStage + mọi art-scene port).

## 4. Conflicts / layers — nhiều phiên bản UI cùng tồn tại

1. **BA hệ shell cạnh nhau**: fidelity paper scene (canvas overlay fixed, không scrim, không z — stack theo DOM), imperial scroll (z1800, scrim `rgba(6,8,12,.34)` `ImperialScrollScene.vue:140`), legacy OverlayPanel (z1800, scrim 78% ink+blur6 `:98` → global đè `#07120e85`+blur3 `secondary:18`). Không hiển thị đồng thời nhờ closeHomeOverlays, nhưng 3 code-path duy trì song song trong cùng một file.
2. **`@click.self` đóng backdrop của fidelity scenes ĐÃ CHẾT**: `tien-hiep-ui.css:390-400` `pointer-events:none` trên 11 scene root → root không bao giờ là event.target. Đóng thực tế: `DongFuStage.onSceneClick :366-369` + cầu `@back` của surfaces (§2). Comment `CharacterFidelityScene.vue:46-49` lạc hậu; global CSS tự ghi nhận (`:381-389`).
3. **Scoped CSS ImperialScrollScene bị global đè**: `__plaque` `top:-4.4cqh;left:50%` (`:218-229`) vs `left:16cqw;top:-22px` (`:187`); `__title` clamp (`:245`) vs `700 29px` (`:188`); `__inner` `6.5/10.5cqh` (`:274-277`) vs `14/5cqh` (`:189`); `__header` `4.2cqh` (`:289`) vs `2cqh` (`:190`). Scroll chỉ còn 1 consumer (exploration/ProductionPanel); spec-comment trong file mô tả geometry cũ.
4. **`IMPERIAL_MODES` chết 4/5** (`:41-47`): scrollMode chỉ có thể = 'exploration' (`:82-84`); `TITLE_KEYS :27-33` cho 4 paper mode unreachable.
5. **worker_lodge + BUILDINGS['worker_lodge']='chi_hien_quan' chết trong beta**: `BETA_LEFT_PANEL_FEATURES.worker_lodge='manualWorkforce' :159` (flag `manualWorkforce:false` `betaFeatureFlags.ts`) → legacy branch chỉ còn scripture_pavilion + vendor.
6. **Header state tính thừa cho paperMode**: `useBuildingHeaderState` chạy cho mọi mode kể cả 4 panel tự sở hữu chrome — logic không có hình; ngược lại paper panels mất building identity (không tên/cap/nút nâng cấp).
7. **`OverlayPanel` variant='system' không caller** (`:21,:55-59` + `system-theme.css`); variant='paper' chỉ `FeedbackDialog.vue:366`.
8. **testid `function-overlay-panel` trùng** `:126,:163` (2 shell khác nhau, chỉ 1 mount).
9. **`.hk-scroll__rail` rules chết** (`tien-hiep-ui.css:185-186`): không component nào mount PaperPanelNavigation trong scroll (R9 `:29-30`).
10. **Panel state sống qua route**: `isFullSceneActive` unmount home chrome (`:140-175`) nhưng `leftPanelMode/standalonePanel/characterOverlayOpen` không reset → vào combat lúc mở panel, về home panel hiện lại (enter transition chạy). `enterCombatScene` chỉ ghi `combatOrigin` (`useBattleActions.ts:85,:135`). Tuy nhiên chrome layer `:180-203` (tooltip/toast/modal) mount **ngoài** v-if — sống qua combat là đúng thiết kế.
11. **`th-panel-swap` z 29/30 giả định 1 stacking context**: wrappers nằm parent khác nhau; `scene-design-canvas` `isolation:isolate` (`SceneDesignCanvas.vue:43`) → swap giữa 2 surface khác parent không thực sự cùng tầng (comment `tien-hiep-ui.css:367-372` thừa nhận).
12. **Quest card/profile/currencies/rail clickable dưới overlay trong suốt**: `.df-scene` không trong list pointer-events:none (đúng thiết kế); `.df-scene--covered` chỉ ẩn `.df-board`/`.df-notice` (`:566-567`) → `.home-design-quest :433-445`, profile `:421`, currencies `:428`, rail `:446` vẫn hiện và ăn click khi vùng giấy overlay che trên (quest → `openStandalonePanel('quest') :439`).
13. **`mountedStandalone` lazy-once** (`:77-100`): wrapper sống mãi sau lần mount đầu với `open=false` (trong home; combat vẫn unmount qua v-if, Set persist) — layer ẩn, giữ state nội bộ giữa các lần mở.
14. **Layer ladder đầy đủ** (`OverlayLayers.ts:19-46`): combatPause 900 < feedback 1200 < panel 1800 < announcement 1850 < toast 1870 < modal 1900 < authority 1950 < tooltip 2200 < appError 3000 < saveGate 4000 < saveGateModal 4100 < curtain 5000. Curtain mount ngoài GameRoot; `:inert` bind `App.vue:1320` rơi xuống root `.presentation-overlay` (fallthrough, inert thật — root không nhận prop `inert` trong `:20-34`); keydown vẫn intercept vì listener gắn `window` capture (`PresentationTransitionOverlay.vue:170`) không bị inert chặn; root curtain `pointer-events:none` trừ khi `.is-locked` (`:261-267`).
15. **`closeSidePanels` trên MainScene** (`:138`) vs `@click.stop` trên `.df-scene` (`DongFuStage.vue:419`): chỉ click letterbox ngoài design canvas tới được MainScene — DongFuStage mount TRONG MainScene (`MainScene.vue:18`) nên bubble chain là scene→viewport→MainScene→game-root; onSceneClick là đường thật.
16. **paper-navigation chain mồ côi**: `usePaperNavigation.ts` đầy đủ nav model (`:29-59`, LEFT_PANEL_NAV_ID `:78-84` map stage_select→'exploration'+exploration→'exploration', technique lock `:102-104`, navigate `:128-140`) nhưng 0 caller production VÀ preview chỉ import const `PAPER_NAV_IDS` (`ui-preview/paperNavigation.ts:1,6`); `PaperPanelNavigation.vue` render duy nhất bởi `ui-preview/PaperPreviewSurface.vue:6,:19`; `PcPaperSceneActions.vue` 0 mount site kể cả preview (grep toàn src chỉ thấy `import type` `:5`); `.paper-navigation*` global (`tien-hiep-ui.css:11-24,:202-206,:353-357`) dead trong game build — rail production là `.home-navigation-surface` (`DongFuStage.vue:446`).
17. **Cascade pc-paper-production (stylesheet cuối) tắt khung nine-slice**: `:15-18` set `border-image:none` lên `.overlay-panel__card:not(--system)`+8 modals → `::after{border-image:inherit}` (`secondary:127`) kế thừa `none`. `lore-modal__panel` KHÔNG nằm trong nhóm production `:15` nhưng có trong nhóm secondary/auxiliary → giữ được khung.
18. **`data-df-ui` contract mỏng**: onSceneClick whitelist selector `:364` — mọi chrome tương tác trong scene phải tự gắn `data-df-ui` (profile `:421`, currencies `:428`, rail `:446`, notice `:493`) hoặc là native interactive, nếu không click bị nuốt thành close. Chi phí vận hành ngầm cho mọi feature mới trên home.

## 5. Logic không có hình ảnh

- `usePaperNavigation` function toàn bộ (`:92-140`) — 0 caller production, preview chỉ dùng `PAPER_NAV_IDS`.
- `PaperPanelNavigation.vue` (chỉ `PaperPreviewSurface.vue:19` render), `PcPaperSceneActions.vue` (0 mount site toàn repo), `PcPaperScene.vue`/`PcPaperDialog.vue`/`PcPaperChrome.vue` (chrome giấy hoàn chỉnh, consumer chỉ `ui-preview/*`; PcPaperChrome chỉ `PcPaperDialog.vue:14` mount; cả 3 import `pc-paper-scene.css` nhưng sheet đã có trong chuỗi global).
- `IMPERIAL_MODES` 4/5 phần tử + `TITLE_KEYS` tương ứng (`FunctionOverlayPanel.vue:27-33,41-47`).
- `BUILDINGS`+`useBuildingHeaderState`+`artBroken`/watch chạy cho paperMode (`:60-100`) — không slot render (paper panels không truyền #header).
- `toggleLeft`/`toggleStandalonePanel` — dead actions (0 caller, `stores/ui.ts:199-224,:320-331`).
- `mountedGameRoute` + `RouteMount` renderless; `useDialogFocus` mousedown guard + restore focus (không render); `uiAudioBinding` audio side-effect; idle warm imports (`GameRoot.vue:110-123`); `mountedStandalone` Set (giữ mount, không render).
- `PhapTuLabBridge` (`import.meta.env.DEV`+mock gate `:30-31`), `DevToolsPanel` (`isMaster` gate `:287,:290`).
- `notice`/`df-notice`+timer (`:82-95`) — thường rỗng (`:569` `display:none` khi empty).
- `railCollapsed`/`railIndicator`/`onRailTransitionEnd` — state nút collapse rail.
- Chrome sẵn mount render-theo-store: Tooltip(2200)/ToastContainer(1870)/ActionFeedbackLog(1200)/WorldAnnouncementOverlay(1850)/OfflineSummaryModal/TalentEntitlementModal/BreakthroughRequirementPanel/TutorialOverlay (`GameRoot.vue:180-203`, ngoài v-if — luôn sống); App.vue: `BetaCompletionModal`, `CombatPauseOverlay`(900), `UpdateBanner`, `ErrorScreen`(3000), `SaveIncompatibleScreen`(4000), `LoadingScreen`.
- `#footer`/`#overlay` slot ImperialScrollScene (`:115-125`) — v-if wrappers, 0 caller.
- `NAV_ACTIVE_PANEL`/`NAV_ACTIVE_STANDALONE` (`:249-265`) + `slotActive`/`slotBadge` (`:133-153`) — pure read-model, không emit.

## 6. Hình ảnh không có logic

- `home-navigation-landscape-seam` (`DongFuStage.vue:471`, chỉ khi surfaceOpen), `.pc-paper-scene__frame` (`:494`, aria-hidden), `home-design-avatar` (`:422`), `home-navigation-backing` (`:447`).
- Roller/corner/cloud/grain scroll — aria-hidden (`ImperialScrollScene.vue:57-88`).
- Dead-DOM layers (mount nhưng vô hình): `InkNineSlice` trong `.overlay-panel__card` (`secondary:17`), `.game-button>.ink-nine-slice` (`pc-paper-production:12`), `.chip>.ink-nine-slice` (`pc-paper-production:47,:61` + `tien-hiep-ui:322`), tooltip ink-nine-slice (`secondary:38,:130`+`production:20` reskin).
- `.hk-scroll__rail` CSS (`tien-hiep-ui.css:185-186`) — không DOM.
- Curtain panels ink-950 flat, không art (`PresentationTransitionOverlay.vue:272-290`); spinner CSS-only `:330-337`.
- `v2/<id>/locked-overlay.png` — overlay-host không dùng (hotspot pipeline `DongFuBuildingArt.ts:143`).
- CSS mồ côi: `tien-hiep-collections/outcomes/forge/progression.css`, `pc-paper-auxiliary-production.css` (0 importer).

## 7. Open questions

1. **Panel sống sót qua combat** (§4.10): mở panel → vào trận → về hiện lại. Cố ý hay phải `closeHomeOverlays` khi route rời home?
2. **worker_lodge/vendor/scripture_pavilion ở legacy** — migrate sang fidelity hay giữ vĩnh viễn? (worker_lodge đang scope-hidden nên branch chỉ còn 2 mode.)
3. **'exploration' đụng nghĩa**: leftPanelMode 'exploration' = San Xuat (ProductionPanel, building `gathering_outpost`) vs nav id 'exploration' = stage_select (Son Ha Do, building `teleport_array`); `LEFT_PANEL_NAV_ID` map `exploration→'exploration'` cho cả hai (`usePaperNavigation.ts:78-84`); `NAV_ACTIVE_PANEL` cũng map `exploration→'stage_select'` + `production→'exploration'` (`DongFuStage.vue:249-256`) — đổi tên?
4. **`IMPERIAL_MODES`/`TITLE_KEYS`/`BUILDINGS` paper-mode entries** — dọn để IMPERIAL_MODES={'exploration'} tường minh, hay giữ chờ quay lại scroll?
5. **`@click.self` chết trên scene roots** (§4.2): xóa handler+comment lạc hậu, hay phục hồi bằng bỏ pointer-events:none vùng ngoài paper?
6. **Chuỗi paper-nav + PcPaper\* shells** — chỉ sống ở preview (PcPaperSceneActions thậm chí 0 mount site): xóa production source hay có kế hoạch in-scene rail?
7. **OverlayPanel variant='system'+SysPanel** — dormant từ M-UI-SYSTEM; dọn hay giữ?
8. **`.hk-scroll__*` global overrides** (§4.3): scroll chỉ còn exploration/ProductionPanel — nếu exploration migrate sang paper scene thì ImperialScrollScene + toàn bộ rule thành dead; roadmap?
9. **Quest card/profile/currencies clickable xuyên overlay trong suốt** (§4.12): "rail vẫn bấm được" có bao gồm các nút này không, hay chỉ rail?
10. **`inert` fallthrough** — đã verify là HTML attr thật (Chrome 102+), authority overlay khoá được cây game; câu hỏi còn lại: combatPause (z900 < panel 1800) và curtain đều nhận `:inert` — combatPause có cần inert khi authority active? (hiện chung `authorityOverlayActive` — đúng hướng; curtain tự inert cả error card của mình vì attr rơi lên root `.presentation-overlay` chứa luôn card.)
11. **`data-df-ui` whitelist contract** (§4.18): mọi interactive mới quên gắn marker sẽ bị nuốt click thành đóng panel — giữ contract này hay đảo (default interactive, opt-out)?
12. **toggleLeft/toggleStandalonePanel dead actions** — xóa hay giữ cho caller tương lai? (toggleStandalonePanel thiếu `closeHomeOverlays` — nếu có caller mới sẽ vỡ mutual exclusion.)

## Adjudication

**Wrong findings — chấp nhận 8/9, bác 1:**

| # | Verdict | Verify |
|---|---------|--------|
| 1 | ACCEPT | `BetaCompletionModal` mount `App.vue:1303-1306` trong ErrorBoundary (`:1286-1307`), ngoài GameRoot — report §5 xếp sai host. Đã sửa §1/§5. |
| 2 | ACCEPT | `toggleStandalonePanel` `stores/ui.ts:320-331` không gọi `closeHomeOverlays`; `toggleLeft`+`toggleStandalonePanel` 0 caller (grep toàn src, ngoài `stores/ui.ts` chỉ `toggleCommandWheel` được gọi `DongFuStage.vue:399`). Claim invariant đã sửa §1 + §7.12. Bổ sung: `toggleLeft` CÓ `closeHomeOverlays :209,:219` — chỉ toggleStandalonePanel thiếu. |
| 3 | ACCEPT | Parse `huyen-kim-chrome.json`: **44** asset, tất cả ready (report ghi 43). Đã sửa §3. |
| 4 | ACCEPT + sửa chi tiết | `App.vue:1320` bind `:inert` lên curtain; `PresentationTransitionOverlay` props `:20-34` không khai báo `inert` → fallthrough DOM attr. Nhưng root class thật là `.presentation-overlay` (`:186`), không phải `.pt-overlay` — không chuỗi nào tên `pt-overlay` trong src. Keydown vẫn đúng vì listener là window capture. Đã sửa §4.14. |
| 5 | ACCEPT | `pc-paper-scene.css` còn được `PcPaperChrome.vue:2`, `PcPaperDialog.vue:3`, `PcPaperScene.vue:2` import + transitively qua `pc-paper-production.css:1` → global production. Đã sửa §1. |
| 6 | ACCEPT | `pc-paper-type.css` qua `pc-paper-scene.css:1` `@import`. Đã sửa §1. |
| 7 | ACCEPT | `PcPaperSceneActions.vue:5` là `import type`; `PaperPanelNavigation` chỉ `ui-preview/PaperPreviewSurface.vue:6,:19` render; `usePaperNavigation` function 0 caller kể cả preview (grep `usePaperNavigation(` = 0 ngoài export); chỉ `PAPER_NAV_IDS` được `ui-preview/paperNavigation.ts:1,6` dùng. Đã sửa §4.16. |
| 8 | ACCEPT | `OverlayLayers.ts:19-46` đủ 12 tầng: combatPause 900, feedback 1200, panel 1800, announcement 1850, toast 1870, modal 1900, authority 1950, tooltip 2200, appError 3000, saveGate 4000, saveGateModal 4100, curtain 5000. Đã sửa §4.14. |
| 9 | REJECT | Finding bảo report cite `FeedbackDialog.vue:362` lệch — thực tế `<Teleport to="body">` đúng ở `:362` (template mở `:361`, OverlayPanel `:363`, `variant="paper"` `:366`). Report gốc đã đúng; finding tự lệch 1 dòng. |

**Missed findings — chấp nhận 26/27, 1 partial:**

| # | Verdict | Verify |
|---|---------|--------|
| 1 | ACCEPT | `pc-paper-production.css:15-18` đè `border-image` secondary `:14`; `::after{inherit}` `secondary:127` → none. Verify thêm: `lore-modal__panel` KHÔNG trong nhóm production `:15` (nhưng có trong secondary `:3`/aux `:77`) → giữ khung. §4.17. |
| 2 | ACCEPT | `@import` chain `production:1`→`scene:1`→`type` — đã đọc đầu file. §1. |
| 3 | ACCEPT | Đọc toàn file 69 dòng: `:3` fonts, `:5-14` game-button (`:12` dead-DOM), `:15-18` card reskin, `:19` modal titles, `:20` tooltip, `:21` pc-paper-scene, `:24-49` settings, `:52-61` feedback, `:67-69` hk-art-scene. §3. |
| 4 | ACCEPT | `auxiliary.css:77-80` `::before` art vars trên `.overlay-panel__card`+9 modals (gồm lore-modal); `.tran-phap-panel* :2-40+`,`.artifact-panel :82`. §3. |
| 5 | ACCEPT | `tien-hiep-ui.css:10` viewport bg `#15221e`, `:105` scroll secondary btn, `:191-196` production-panel, `:322` inventory chip nine-slice. §3. |
| 6 | ACCEPT | `secondary-ui.css:72-74` `.building-heading*` override scoped `:201-236`. §3. |
| 7 | ACCEPT | `MainScene.vue:18` mount DongFuStage, sibling `PhaserCanvas :20`. §1/§4.15. |
| 8 | ACCEPT | `RealmSurface.vue:108-109` `onQuanKhi`→`openStandalonePanel('quan_khi')`, wire `@quan-khi :122`. §1. |
| 9 | ACCEPT | `GameRoot.vue:177-178` `CombatSceneOverlay`/`TribulationSceneOverlay` (ngoài v-if, theo route). §1. |
| 10 | ACCEPT | Verify từng cite: `:1314` CombatPauseOverlay (`:inert`, `@continue`), `:1303-1306` BetaCompletionModal (trong ErrorBoundary), `:1391` UpdateBanner, `:1395` ErrorScreen, `:1275` SaveIncompatibleScreen, `:1289` LoadingScreen, `:1262-1264` onboarding trio, `:1393` PhapTuLabBridge unconditional (gate `:30-31`), authority-overlay ×4 `:1336,:1345,:1364,:1380`, style `:1440`. §1. |
| 11 | ACCEPT | RouteMount ×3 `App.vue:1249,:1258,:1268` + `GameRoot.vue:205`. §1. |
| 12 | ACCEPT | Curtain internals: `transitionend` ×2 + `safetyTimeout` 600ms `:86-137`, focus save/restore `:141-151`, expose `:177-181`, keydown window capture `:170` (early-return `:155-157`, error-card pass `:160-162`). §2. |
| 13 | ACCEPT (đúng cite sửa) | Cầu `@back`→`closeHomeOverlays` verify tại 11 surface: Settings `:17`, Body `:230`, Technique `:138`, Skill `:865`, Character `:282`, Inventory `:71`, Quest `:81`, Realm `:123`, Alchemy `:490`, Equipment `:155`, Exploration `:468`. §2. |
| 14 | ACCEPT | Tab `preventDefault`+`stopPropagation` `useDialogFocus.ts:48-49` (block `:43-63`). §2. |
| 15 | ACCEPT | Empty-props adapter: `QuestScene.vue:81` (`:quests="[]" :rewards="[]"`), `InventorySurface.vue:71` (`:items="[]"`), `SettingsSurface.vue:17` (`:groups="[]"`+`#workspace` SettingsPanel + stale comment `:4` nhắc usePaperNavigation không import). Thêm: `QuestPanel.vue:30` ngoại lệ truyền `:rows="rows"` thật. §2. |
| 16 | ACCEPT | FeedbackDialog 3 site: `DongFuStage:497`,`SettingsPanel:382`,`ErrorScreen:192`. §2. |
| 17 | ACCEPT | `BuildingUpgradeButton` `FunctionOverlayPanel.vue:6,:144,:187`. §1/§2. |
| 18 | ACCEPT | `AutoFarmIndicator :492`; `cue('ui.wheel.select') :282,:332`; `bindUiAudio App.vue:299`/unbind `:1237`. §1/§2. |
| 19 | ACCEPT | `NAV_LOCKED :203`; `betaWheelSlots :109` filter → `betaScopeSurface.ts:92` (map `:64-78`: phap_bao→artifact, formation_slot→formation, companion_roster→companion, chi_hien_quan→manualWorkforce); flags false `betaFeatureFlags.ts`. §1. |
| 20 | ACCEPT | `.df-scene--covered` chỉ ẩn `.df-board`/`.df-notice` `:566-567`. §4.12. |
| 21 | ACCEPT | `#footer` slot `ImperialScrollScene.vue:115-117` dead (v-if `$slots.footer`, 0 caller) ngoài `#overlay :123-125`. §2/§5. |
| 22 | ACCEPT | `AuthEntryScreen.vue:12` import `tien-hiep-entry.css` (+ `ui-preview/AuthInteractivePreview.vue:17`), mount `App.vue:1262-1264`. §1. |
| 23 | ACCEPT | Grep 0 importer: collections, outcomes, forge, progression, pc-paper-auxiliary-production. §1/§6. |
| 24 | PARTIAL | `qi-hall.css` import thật chỉ `EquipmentHallPanel.vue:10`; `RefineTab.vue:449-450`/`WashTab.vue:408-409` chỉ là comment nói KHÔNG phụ thuộc (tự define `.qi-hall__tier-*` local); `equipmentHallDisplay.ts:18` emit class name chứ không import css. Nhận "stylesheet scoped theo panel", bác "+RefineTab/WashTab". §1. |
| 25 | ACCEPT | `main.ts:59` `installTienHiepUiAssets` → `TienHiepUiAssets.ts:25-31` setProperty `--th-art-*` + `pcPaperControlStyles()`. §1/§3. |
| 26 | ACCEPT | `flashNotice`/`noticeTimer :82-95` + `.df-notice:empty :569`. §2/§5. |
| 27 | ACCEPT | `PcPaperScene/Dialog/Chrome` consumer chỉ `ui-preview/*` + test (grep); `PcPaperChrome` chỉ `PcPaperDialog.vue:14`; `PcPaperSceneActions` **0 mount site toàn repo** (grep `PcPaperSceneActions` = 0 match ngoài tên file — mạnh hơn finding). §5. |

**Tự phát hiện thêm trong adjudication (không có trong findings):**
- `lore-modal__panel` nằm ngoài danh sách `pc-paper-production.css:15` nhưng trong secondary/auxiliary → giữ `border-image` (khung nine-slice chỉ chết trên 9 selector còn lại). §4.17.
- Chrome block `GameRoot.vue:180-203` mount **ngoài** `v-if="!isFullSceneActive"` (`:140-175`) — tooltip/toast/announcement/modal sống qua combat; chỉ LeftPanel/FunctionOverlayPanel/9 standalone bị gate. §1 (sửa phrasing report gốc gộp chrome vào khối v-if).
- `watch(surfaceOpen)` `DongFuStage.vue:67-69` — mở surface tự tắt feedbackOpen (mutual exclusion dialog↔surface). §2.
- `onWheelAction` `:347-359` — router 3 lớp (ThienCo entry.run → wheel slot → flashNotice 'unhandled'). §2.
- `activateSlot` gọi `ui.closeCommandWheel() :333`, không phải closeHomeOverlays (an toàn vì wheel mở ⇒ panel đã null). §1.
- `NAV_ACTIVE_PANEL`/`NAV_ACTIVE_STANDALONE` `:249-265` — mirror map cho trạng thái active rail. §1.
- Curtain root `pointer-events:none` trừ `.is-locked` (`:261-267`) — khi không lock click xuyên qua curtain. §2/§4.14.
- `QuestPanel.vue:30` ngoại lệ adapter: truyền `:rows="rows"` thật (không empty-props). §2.
- Open question mới §7.11 (data-df-ui contract), §7.12 (dead toggle actions).
