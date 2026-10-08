## Missed

1. **3 stylesheet global chưa hề được audit** — `main.ts:8-11` import 4 file global trong production: `tien-hiep-ui.css` (đã cover) + `tien-hiep-secondary-ui.css` + `tien-hiep-auxiliary.css` + `pc-paper-production.css`. Report chỉ map file đầu, bỏ cả mảng chrome đang restyle đúng scope:
   - `tien-hiep-secondary-ui.css`: `.tran-phap-panel` grid 3-cột (48-62,112-119), `.artifact-panel`/`.artifact-path-cards__*` (75-80,91,120-121), `.vendor-panel__card`/`.vendor-panel__description` (67,70), `.feedback-dialog` inputs (92-93) + `.feedback-dialog__events` (85), `.lore-modal__panel/title/description` (3,23,25-28,124-135), `.lore-codex__grid`/`.lore-codex__pagination` (84-85), `.companion-panel__card`/`.companion-panel__detail` (67,95-97).
   - `tien-hiep-auxiliary.css` (116 dòng, gần như toàn bộ in-scope): `.tran-phap-panel__*` (2-44,73-76,112-116), `.companion-panel__*` (45-72,81), `.artifact-panel`/`.artifact-path-cards__*` (65,82-86), `.vendor-panel`/`.resource-card__*` (90-93), `.lore-modal__panel::before` (77-80), worker-lodge `.chieu-mo`/`.duyen-phan`/`.qua-tang` (94-104).
   - `pc-paper-production.css`: `.feedback-dialog` font/inputs/chip border-image/sticky actions bar (52-61) — LIVE trên dialog thật.
   - Dead CSS: `__formation-pattern`, `__formation-copy`, `__section-title`, `__queue-title` (secondary 113-118; auxiliary 18-21,36-39) — không element nào còn trong TranPhapPanel.vue template (377-388 chỉ render nút tên formation).
   - `pc-paper-auxiliary-production.css` không có importer nào trong `src/` (file chết hoàn toàn; `.pc-auxiliary` không component nào set).
2. **WorkerLodgePanel — panel khóa thứ 4 bị bỏ sót**: `worker_lodge → manualWorkforce` (betaScopeSurface.ts:159), mount tại FunctionOverlayPanel.vue:191 trong legacyMode (chết như 3 standalone panels), 3 tab ChieuMoTab/DuyenPhanTab/QuaTangTab mount trực tiếp ở SecondaryPreview.vue:8-10,51-53. Report chỉ nói chi_hien_quan badge/wheel, không kể panel này.
3. **Fail-closed lớp thứ 3**: `mode` computed tại FunctionOverlayPanel.vue:69-77 lọc `isBetaLeftPanelMode` ngay mount-seam của left panels — report chỉ liệt "hai lớp". `toggleLeft` cũng no-op khi scope-hidden (ui.ts:202-204).
4. **PaperPanelNavigation.vue — rail thứ 2 có `is-locked` riêng** (line 21): chỉ mount trong `ui-preview/PaperPreviewSurface.vue:19` → toàn bộ block `.paper-navigation` của tien-hiep-ui.css (11-24,202-206,353-357) là DORMANT, không phải CSS rail production (rail production = `.home-independent-navigation` scoped, DongFuStage.vue:448-539). Report gán nhầm chúng vào mục "Rail medallion art".
5. **Live listeners/timers không hề liệt**: DongFuStage `window.keydown` (380-401, mount 403-408 — Backquote bị `!feedbackOpen` chặn ở 397), `noticeTimer` setTimeout 3.2s (83-95), `onRailTransitionEnd` (78-80); TranPhapPanel watch `player.formationLoadout` (308-311), watch assignments → `previewRegion.dispatch` (342-344), `onMounted` start preview (322-325); GameRoot `requestIdleCallback` (110-123).
6. **DongFuBoard + AutoFarmIndicator** mount tại DongFuStage:486-492 — chrome live cạnh rail; `entry.run()` qua `onWheelAction` (347-359) cũng là seam mở surface đóng feedback.
7. **SettingsBuildSection** cũng render trong tab `support` (SettingsPanel.vue:377) — tab support có 2 section, không chỉ feedback.
8. **`RING_3_BUILDING_IDS` export** (commandWheelCatalog.ts:247-250, hotspot layer dùng chung) + `talisman_slot` `NEVER_AVAILABLE` (150-155) — loại "khóa" thứ 3 (future slot không bao giờ render).
9. **LoreCodex nội bộ cũng có scope-gate**: `betaMaterialStackVisible` filter (LoreCodex.vue:32). LoreCodex sống trong ScripturePavilionPanel.vue:11 → reachable qua wheel ring-4 `scripture_pavilion` (catalog 230-237, admitted null).
10. **SecondaryPreview mount 3 gated panel bằng `v-if` trực tiếp** (47-49) VÀ `select()` ghi `ui.standalonePanel` (SecondaryPreview.vue:38) — report chỉ nói secondary.ts:33.
11. **`navigation-forge-v2.png` icon tồn tại** (public/assets/ui/tien-hiep-2026-10/icons/) nhưng 'forge' không có trong NAV_ITEMS — art chưa map.
12. **FeedbackDialog internals chưa kể**: `getDiagnosticRecorder` (88), `diagnosticReportId` → context (110,215), `previewEvents`/`eventLine` + events preview list (243-247,487-492), `copyReportId` (324-332), success-state UI (375-387), Teleport-to-body (362).
13. **`useTooltip.ts:161-176`** comment xác nhận plaque layer là caller duy nhất của building tooltips — tooltip path dormant cùng `.df-buildings`.

## Wrong

1. `.locked` + `:disabled` cite "472-476" — thực tế `:class`/`locked` ở 453 và `:disabled` ở 454 (button v-for 449-460).
2. `legacyMode==='vendor'` cite "(89)" — `legacyMode` computed ở 85-87; line 89 là `buildingId` (render check đúng ở 193).
3. Ring-3 slots cite "215-220" — 5 building slots nằm 193-227; 215-220 chỉ là chi_hien_quan. Nội dung (5 slots, không vendor) đúng.
4. FeedbackDialog ref names bịa: `error`, `copiedId`, `draftRestored` không tồn tại — thực tế `fieldError` (84), `copied` (86), `exported` (85), `idempotencyFingerprint` (81). Claim "watch open → regenerate idempotencyKey" sai: open chỉ restore key từ storage, không mint mới (175-191).
5. "DongFuBuildingArt entry vendor feed useBuildingHeaderState" — sai nguồn: header art là literal `/assets/buildings/dong-fu/v2/{id}/base.png` (useBuildingHeaderState.ts:29); entries trong DongFuBuildingArt.ts (vendor ở DONG_FU_BUILDING_IDS line 8) phục vụ hotspot layer Phaser, không feed header.
6. `HomeSupportArtPanel` "(kind='feedback')" — thực tế `:kind="activePanel"` với `activePanel === 'settings' || 'feedback'` (LandscapeDesignPreview.vue:66): mock phục vụ CẢ settings lẫn feedback.
7. Conflict #2 "hai cửa vào không share state" — thực tế 3 production mounts có `feedbackOpen` ref riêng (DongFuStage:60, SettingsPanel:83, ErrorScreen:69) + preview; ErrorScreen còn truyền `initialDescription`.
8. "CSS `fx-border-beam` (521-547)" — 521-547 là cell-state rules (có `--fx-beam-fill` 546); class `fx-border-beam*` base nằm ở theme.css (comment TranPhapPanel.vue:541), không phải CSS riêng của panel.
9. `getBuildingStatus` framed "cho chi_hien_quan" — function generic cho mọi building, vẫn LIVE cho pill_room/equipment_hall qua `slotBadge` (DongFuStage:149); chỉ nhánh chi_hien_quan chết.
10. `PcPaperIcons`/`Chip` cho FeedbackDialog: report nói "icon `feedback.png` trong PcPaperIcons (`PcPaperIcons.ts:3`)" — đúng id tồn tại, nhưng FeedbackDialog KHÔNG dùng PcPaperIcons; rail mới dùng `navigation-feedback-v2.png`, còn `.png` gốc (`pcPaperIconUrl`) phục vụ avatar/DesignPreview.

## Verified-ok

- `BETA_FEATURES` toàn false (betaFeatureFlags.ts:31-43); 4 map scope chính xác: wheel (64-80), building (108-115), standalone (132-144), left-panel (152-163); `betaWheelSlots()` 92-94; `featureAdmits` fail-closed (41-46).
- DongFuStage: NAV_LOCKED 203, NAV_ITEMS 204-208 = 21 id, NAV_FEATURE_LOCKED 214-216, `navLocked` `!isBetaStandalonePanel` (217-221), NAV_TARGET 226-245 (vendor 239, feedback 241-244, formation 235), NAV_ACTIVE_* 249-265, `navAction` đóng feedback 285, `renderedSlots` filter `available()` 109, `disabledContext` 100-107, grayscale `.locked` 539, FeedbackDialog mount 497.
- GameRoot: `defineAsyncComponent` 15-23, `mountedStandalone` + watcher fail-closed (gồm direct-write) 77-100, idle warm 3 gated chunks 110-123 (Artifact 119/TranPhap 120/Companion 121).
- ui.ts: `openStandalonePanel` no-op 244-255, `openLeftPanel` 226-242.
- FunctionOverlayPanel: TITLE_KEYS có vendor (25-34), BUILDINGS có vendor (60-67), `v-else-if="legacyMode === 'vendor'"` 193.
- FeedbackDialog 733 dòng: props 42-54, storage key `tien-hiep-idle-feedback-draft` 58, restore/persist 120-165, watch open/fields 175-195, buildContext/buildDraftInput 209-234, `keyFor`/`onSubmit` 254-298, `onExport` 302-322; đúng 4 điểm mount (DongFuStage:497, SettingsPanel:382, ErrorScreen:192-197 `:layer` appError+1 + `initial-description`, SecondaryPreview:63).
- LoreCodexModal 104 dòng: props content/emit close/audio cues 21-26, Teleport `.lore-modal` 30-42; chỉ mount ở LoreCodex.vue:88 + SecondaryPreview:64 (grep xác nhận); OverlayLayers.ts:30-31 modal=1900.
- commandWheelCatalog: `RELEASE_UNAVAILABLE_REASON` 75, phap_bao 'Cần đạt Kim Đan' 124-148, formation_slot 'Cần đạt Trúc Cơ' 161-173, companion_roster 178-190, ring-3 chỉ 5 building (không vendor). DongFuWheel `is-disabled` class 40 + CSS 75-77 + tooltip `:title` 47 — dead path vì filter trước.
- Vendor live: buildings.ts:204-225 `functionType: 'vendor'` (222), `openBuilding` fail-closed → `openLeftPanel` (useBuildingNavigation.ts:137-155), vendor→null (betaScopeSurface.ts:113,162).
- VendorPanel 326 dòng: sellableRows 38-45, sellQuantities/qtyFor/onQtyInput 53-67, saleQuote/salePreviewText 82-94, confirmAllRow+ConfirmModal 97-170,212-221; nền paper-grain + `--paper-text` (226-238) trong vỏ OverlayPanel legacy.
- TranPhapPanel 650 dòng: standalone check 348, slotStateAt 123-137, combatantCards 142-177, onDrop/removeAssignment 189-216, onConfirm→`setFormationLoadout` 228-247, `useDynamicRegion` + dynamic import Phaser/`TranPhapCombatPreviewScene` 276-304 (file tồn tại src/game/scenes/), grid/queue 351-427.
- ArtifactPanel 197 dòng: standalone 140, computeds 39-132, EmptyState 141-147, 4 subcomponents 149-183.
- CompanionPanel 816 dòng: standalone 317-323, groups by grade 70-82, selected/stats/exp/kit 88-140, perkText/pipTooltip 170-217, feed 222-309, `formationHint` 509.
- vi.json: `dongFu.nav.feedback`="Trợ Giúp" (2044), `betaFeedback.title`="Gửi Phản Hồi" (1906-1907), guild/sect/portal (2047-2049), `companion.formationHint` (1136).
- SettingsNavRail SECTION_ICON 17-24 (audio→feedback 20, support→guild 23 — và còn display→realm 19, account→character 21, update→production 22, general→settings 18).
- SettingsPanel: `feedbackOpen` ref 83, navSections 295-309 (support 307), section mount 353, dialog mount 382.
- SettingsFeedbackSection: frame + GameButton emit 'open' (8,21-23).
- PcPaperIcons.ts:3 đủ id kể cả locked; 22 file `navigation-*-v2.png` trên disk (đủ 21 id + forge thừa).
- PcPaperLock chỉ trong ui-preview (CharacterProgressionDesignPreview.vue:9, PaperSceneDesigns.vue:4).
- tien-hiep-ui.css cites đúng dòng: `.paper-navigation` 11-24/202-206/353-357, `.chip` 52-53, `.game-button` 80-84/224-225, `.df-building` + `[data-df-building='vendor']` 152-166, `.settings-*` 99/135/244-246/358, `.th-panel-swap` 373-379, rail-over-panels pointer-events 390-411, `.df-node__orb` 65-70.
- MainScene.vue:18 mount DongFuStage; DongFuHomeContent.vue:41-67 plaques chỉ còn qua DongFuFidelityScene:10/27 ← DongFuPreview.vue:4,42.
- secondary.ts:33 `useUiStore(pinia).standalonePanel='tran_phap'` — direct-write bypass (đúng claim).
- OverlayPanel paper variant → InkNineSlice `surface-xl-scroll` + `frame-m-modal` (66-68).
- Bang Hội/Tông Môn/Bí Cảnh: không component nào — chỉ NAV_LOCKED + icon + label (đúng claim).
