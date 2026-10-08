# Panel: Trợ Giúp + panels khóa (feedback / formation·vendor·artifact·companion·guild·sect·portal·worker_lodge)

Audit trên branch `devin/artui-c0-foundation` (`game/`). Tất cả tính năng beta đang OFF: `BETA_FEATURES` toàn `false` tại `src/core/betaFeatureFlags.ts:31-43` — artifact, companion, formation, manualWorkforce v.v. đều scope-hidden; `featureAdmits` fail-closed (betaScopeSurface.ts:41-46).

## 1. Mount chain — từ nav/route đến component gốc

### Rail trái (production)
- `MainScene.vue:18` mount `DongFuStage.vue` — rail trái `.home-navigation-surface` render `NAV_ITEMS` = 21 id (203-208): 16 id thường + `NAV_LOCKED = ['artifact','companion','guild','sect','portal']` (203). Nút bị khóa: `:class="{locked: navLocked(id)}"` + `:disabled="navLocked(id)"` tại template **449-460** (class 453, disabled 454); CSS grayscale `.locked` tại scoped 539.
- `NAV_FEATURE_LOCKED = { formation: 'tran_phap' }` (214-216) → `navLocked('formation')` = `!isBetaStandalonePanel('tran_phap')` = true → formation render khóa-xám y như 5 nút cứng (217-221).
- `NAV_TARGET` (226-245): `vendor → navigation.openBuilding('vendor')` (239), `feedback → ui.closeHomeOverlays(); feedbackOpen = true` (241-244), `formation → ui.openStandalonePanel('tran_phap')` (235, no-op vì gated).
- `feedbackOpen` ref local (60) → `<FeedbackDialog :open>` mount 497. `NAV_ACTIVE_PANEL`/`NAV_ACTIVE_STANDALONE` (249-265) tô active; `navAction` (280-291) đóng feedback khi bấm nút khác (285); watcher `surfaceOpen` (56-58, 67-69) đóng dialog khi surface khác mở.

### FeedbackDialog — 3 điểm mount production + 1 preview (mỗi nơi ref riêng)
1. `DongFuStage.vue:60,497` — nút rail "Trợ Giúp" (`dongFu.nav.feedback` = "Trợ Giúp", vi.json:2044).
2. `SettingsPanel.vue:83,382` — tab `support` (navSections 295-309, push 307) → `SettingsFeedbackSection` emit `open` → `feedbackOpen`. Tab support còn render `SettingsBuildSection` (377) — 2 section, không chỉ feedback.
3. `ErrorScreen.vue:69,192-196` — nút `error-feedback` (160-161), truyền `:layer="OVERLAY_LAYERS.appError + 1"` + `:initial-description` prefilled error text.
4. `ui-preview/SecondaryPreview.vue:57,63` — fixture qua `dialog==='feedback'`.

### LoreCodexModal — KHÔNG phải "Trợ Giúp"
- Chỉ mount trong `panels/scripture/LoreCodex.vue:88` + `SecondaryPreview.vue:64` (fixture 'lore').
- Chuỗi vào production: LoreCodex ← `ScripturePavilionPanel.vue:11` ← left-panel mode `scripture_pavilion` ← wheel ring-4 slot (commandWheelCatalog.ts:230-237, admitted null). Rail KHÔNG có nút Tàng Kinh Các — vào được duy nhất qua wheel.
- `OverlayLayers.ts:30-31`: `modal: 1900` (LoreCodexModal là ví dụ blocking modal).

### Panels khóa (standalone, đủ code nhưng không bao giờ mount)
- `GameRoot.vue:15-23` lazy `defineAsyncComponent`; `mountedStandalone` Set + watcher 77-100: chỉ `mountedStandalone.add(panel)` khi `isBetaStandalonePanel(panel)` true → fail-closed kể cả ghi trực tiếp `ui.standalonePanel` (có thêm bounce riêng cho 'technique' 89-95, tới toast lock).
- `ui.ts:244-255` `openStandalonePanel` no-op khi scope-hidden; `openLeftPanel` cùng kiểu (226-242); `toggleLeft` cũng no-op (199-204).
- `betaScopeSurface.ts:132-144` standalone map: artifact→'artifact' (137), tran_phap→'formation' (138), companion→'companion' (139) — tất cả flag OFF.
- Chunk-warm trên idle VẪN import 3 panel bị khóa (GameRoot.vue:110-123: Artifact 119, TranPhap 120, Companion 121) cùng 6 chunk live.

### WorkerLodgePanel — panel khóa thứ 4 (dạng left-panel, không standalone)
- `worker_lodge → 'manualWorkforce'` (betaScopeSurface.ts:159) → `isBetaLeftPanelMode('worker_lodge')` = false.
- Mount-seam thật: `FunctionOverlayPanel.vue:191` `<WorkerLodgePanel v-if="legacyMode === 'worker_lodge'">` trong vỏ OverlayPanel legacy — mode computed (69-77) lọc trước nên không bao giờ chạy tới.
- 4 tab TabBar: nhan_cong / qua_tang / chieu_mo / duyen_phan (WorkerLodgePanel.vue:37-40), `visibleTabs` còn lọc theo companion verdict (45-51). 3 tab con ChieuMoTab/DuyenPhanTab/QuaTangTab mount trực tiếp ở `SecondaryPreview.vue:8-10,51-53`.

### Thương Hội / vendor — LIVE (không khóa)
- `src/data/building/buildings.ts`: `id:'vendor'` (205), `functionType:'vendor'` (222); `betaScopeSurface.ts:113` building map vendor→null = admitted; `:162` left-panel vendor→null.
- `useBuildingNavigation.ts:137-155` openBuilding → `openLeftPanel(functionType)` (fail-closed qua `isBetaBuildingSurface` 141-143).
- `FunctionOverlayPanel.vue`: TITLE_KEYS 'vendor' (33), BUILDINGS 'vendor' (66); `legacyMode` computed **85-87** (line 89 là `buildingId`); render `VendorPanel` trong OverlayPanel shell tại **193** (`v-else-if="legacyMode === 'vendor'"`).

### Bang Hội / Tông Môn / Bí Cảnh — stub thuần hình
- Không component/code domain nào — chỉ id trong NAV_LOCKED + icon `navigation-{guild,sect,portal}-v2.png` + label `dongFu.nav.*` (vi.json:2047-2049).

### Wheel (DongFuWheel) — loại khóa khác: slot biến mất hẳn
- `DongFuStage.vue:109` `renderedSlots = betaWheelSlots().filter(s => s.available())`: `betaWheelSlots()` (betaScopeSurface.ts:92-94) đã loại slot gated qua `BETA_WHEEL_SLOT_FEATURES` (64-80): phap_bao→'artifact', formation_slot→'formation', companion_roster→'companion', chi_hien_quan→'manualWorkforce'.
- Ring-3 gồm 5 building slot **193-227** (teleport_array 193-199, pill_room 200-206, gathering_outpost 207-213, chi_hien_quan 214-220, equipment_hall 221-227) — KHÔNG có vendor.
- `talisman_slot` (150-155) = loại khóa thứ 3: admitted trong map (feature null) nhưng `available: NEVER_AVAILABLE` → qua được scope filter rồi chết ở `available()`.
- `DongFuWheel.vue`: `is-disabled` class (40), `:title` tooltip (47), CSS 75-77 — dead path, slot gated bị filter trước khi render nên `disabledReason` ('Cần đạt Kim Đan' 139, 'Cần đạt Trúc Cơ' 171, 188; `RELEASE_UNAVAILABLE_REASON` 75) không bao giờ hiện.
- `RING_3_BUILDING_IDS` export (247-250) — danh sách building dùng chung cho hotspot layer.

### Chrome live cạnh rail
- `DongFuBoard` (Thiên Cơ bảng) 486-491 + `AutoFarmIndicator` 492 + `df-notice` 493: chrome live cùng stage. `onWheelAction` (347-359) dispatch `entry.run()` (350) cho board CTA — cùng seam đóng feedback.
- Listener/timer sống: `window.keydown` 380-401, mount/unmount 403-408 — Backquote bị `!feedbackOpen` chặn (397), Tab toggle rail (389); `noticeTimer` setTimeout 3.2s (83-95); `onRailTransitionEnd` (78-80); `onSceneClick` 366-369 đóng overlays khi click nền.
- Preview cũ: `DongFuFidelityScene` + `DongFuHomeContent.vue` (plaque `.df-building` 41-67) chỉ còn qua `ui-preview/DongFuPreview.vue:4,42`; DongFuBoard cũng được mount lần nữa trong DongFuHomeContent (nhánh dormant).

### Rail thứ 2 — PaperPanelNavigation (preview-only)
- `PaperPanelNavigation.vue` có class `.is-locked` riêng (21) + CSS 45; mount DUY NHẤT ở `ui-preview/PaperPreviewSurface.vue:19`. Không một element production nào mang class `paper-navigation` (ImperialScrollScene chỉ nhắc trong comment R9 "no PaperPanelNavigation"; `.hk-scroll .paper-navigation.hk-scroll__rail` selector tại tien-hiep-ui.css:185-186 không có target).
- `usePaperNavigation()` composable — adapter beta-admission + `progressionLocked` (technique khóa dưới Luyện Khí, 102-104) — **0 caller thật**: preview chỉ import `PAPER_NAV_IDS` const (paperNavigation.ts:1), `previewPaperNavigation` nhận `lockedIds=[]` mặc định và PaperPreviewSurface không truyền → `is-locked` không render ở đâu kể cả preview.

## 2. UI logic inventory — mọi computed/store-read/emit/directive/props đang feed DOM

### FeedbackDialog.vue (733 ln)
- Props: `open`, `layer` (default `OVERLAY_LAYERS.modal`, 52), `initialDescription` (42-54); emit `close` (56).
- Refs: `category` 71, `description` 72, `steps` 73, `contact` 74, `attachDiagnostics` 75, `idempotencyKey` 80, `idempotencyFingerprint` 81, `submitting` 82, `result` 83, `fieldError` 84, `exported` 85, `copied` 86, `recorder` = `getDiagnosticRecorder()` 88.
- Computed feed DOM: `attachEvents` (95-108), `diagnosticCount` 109, `diagnosticReportId` 110, `previewDraft` 236, `previewBytes` 241, `previewEvents` 243, `canSubmit` 249, `statusMessage` 339-356, `title` 358.
- Draft sessionStorage key `tien-hiep-idle-feedback-draft` (58): `restoreDraft` 120-147 (đọc cả idempotencyKey+fingerprint 137-142), `persistDraft` 149-165, `clearDraft` 167-173. Watch `open` (175-191, immediate) CHỈ restore draft + reset trạng thái — KHÔNG mint key mới; mint xảy ra trong `keyFor` (254-260, khi content đổi fingerprint) và sau khi accepted (286). Watch fields → `persistDraft` khi chưa accepted (193-195).
- `buildContext`/`buildDraftInput` (209-234) gom route/saveRevision/`diagnosticReportId`; `onSubmit` 262-298 idempotent qua `keyFor`+`serializeFeedbackReport`; `onExport` 302-322 tải JSON; `copyReportId` 324-332; `eventLine` 245-247 + list preview `feedback-dialog__events` 487-492; success-state UI 375-387 (reportId + copy + close); `Teleport to="body"` 362 → `OverlayPanel variant="paper"`.
- SettingsFeedbackSection: `SettingsSectionFrame` + `GameButton` emit `open`.

### LoreCodexModal.vue (104 ln)
- Props `content:{title,description}|null` (12-14), emit `close`; `onClose` cue `ui.cancel`+`ui.modal.close` (22-26); Teleport `.lore-modal` zIndex modal (30-42). Không state nội bộ khác. Host `LoreCodex.vue`: `loreItems` filter `betaMaterialStackVisible` (32 — scope-gate riêng), pagination `usePanelPagination` (46-52).

### TranPhapPanel.vue (650 ln) — gated, unreachable
- `OverlayPanel :open="ui.standalonePanel === 'tran_phap'"` (348); draft `slotStateAt`, `combatantCards`, drag-drop `onDrop`/`removeAssignment`, `onConfirm` → `turnBattleOps.setFormationLoadout`; preview Phaser qua `useDynamicRegion` + dynamic import `TranPhapCombatPreviewScene` (276-304, file tồn tại `src/game/scenes/`).
- Watch/timer: watch `player.formationLoadout` → resync draft (308-311); `onMounted` syncDraft + `previewRegion.start()` (322-325); watch `standalonePanel==='tran_phap'` start/destroy (327-338); watch `[currentAssignments, visualProfileId]` → `previewRegion.dispatch` (342-344).
- Template: grid/queue 351-427; formation-button chỉ render `{{ formation.name }}` (382-386) — không còn `__formation-pattern`/`__formation-copy`/`__section-title`/`__queue-title` element.

### ArtifactPanel.vue (197 ln) — gated
- `ui.standalonePanel === 'artifact'` (140); computeds artifact/definition + grade/exp/path; 2 `EmptyState` fallback (141-147) + ArtifactOverview/ArtifactExperienceBar/ArtifactGradeSection/ArtifactPathCards (13-16, 149-183).

### CompanionPanel.vue (816 ln) — gated
- `ui.standalonePanel === 'companion'` (317-323); groups by grade, selected/stats/exp/kit, perks/pips, feed; `formationHint` tại 509 (`vi.json:1136` — chỉ người chơi mở panel bằng wheel Trận, nhưng panel không bao giờ mở).

### VendorPanel.vue (326 ln) — live
- `sellableRows` từ economyOps (38, render 182), qty inputs, `saleQuote`/preview, `confirmAllRow` + `ConfirmModal` (212); nền paper-grain + `--paper-text` (234-237).

### WorkerLodgePanel.vue — gated
- TabBar 4 tab + `visibleTabs` filter theo verdict (37-51) — render no tab nào trong beta.

## 3. Art map — file art + element dùng

- Rail icons: `/assets/ui/tien-hiep-2026-10/icons/navigation-{id}-v2.png` — 22 file trên disk cho 21 id đủ cả locked (artifact/companion/guild/sect/portal/formation/vendor/feedback); **thừa `navigation-forge-v2.png`** — 'forge' không có trong NAV_ITEMS → art chưa map.
- Rail medallion/backing/seam: `--home-nav-art` → `controls/navigation-medallion-v1.png` (195), `navigation-backing-dark-v3.png` (197), `navigation-landscape-seam-v1.png` (198) — CSS scoped `.home-independent-navigation` (DongFuStage 511-539), KHÔNG phải block `.paper-navigation` global.
- FeedbackDialog chrome: `OverlayPanel` variant `paper` → InkNineSlice `surface-xl-scroll` + `frame-m-modal` (OverlayPanel.vue:67-68); input frames InkNineSlice `text-field` (414, 439, 457); `Chip` cho category chips (395-405); `GameButton`; Teleport body. **Không dùng PcPaperIcons** — rail mới dùng `navigation-feedback-v2.png`; `pcPaperIconUrl('character')` chỉ xuất hiện ở avatar rail (DongFuStage:422) + previews.
- LoreCodexModal: `.lore-modal` teleport, art tối thiểu (panel + title + description + GameButton).

### 4 stylesheet global production (main.ts:8-11) — audit scope
- `tien-hiep-ui.css`: `.chip` 52-53, `.game-button` 80-84/224-225, `.df-building` + `[data-df-building='vendor']` 152-166 (dormant), `.settings-*` 99/135/244-246/358, `.th-panel-swap` 373-379, scene pointer-events 396-411, `.df-node__orb` 65-70; **toàn bộ block `.paper-navigation` (11-24, 202-206, 353-357, 185-186) DORMANT** — consumer duy nhất là preview.
- `tien-hiep-secondary-ui.css`: `.tran-phap-panel` grid 3 cột (48-62) + formation-button (53-58,112-119), `.artifact-panel`/`.artifact-path-cards__*` (75-80,91,120-121), `.vendor-panel__card`/`.vendor-panel__description` (67,70), `.feedback-dialog` inputs (92-93) + `__events` (85) — LIVE trên dialog thật, `.lore-modal__*` trong các selector chung (3,23,25-28,124-136), `.lore-codex__grid`/`__pagination` (84-85), `.companion-panel__*` (67,95-97).
- `tien-hiep-auxiliary.css` (116 ln, gần như toàn bộ in-scope): `.tran-phap-panel__*` (2-44,73-76,112-116), `.companion-panel__*` (45-72,81), `.artifact-panel`/`__path-cards` (65,82-86), `.vendor-panel`/`.resource-card__*` (90-93), `.lore-modal__panel::before` (77-80), worker-lodge `.chieu-mo`/`.duyen-phan`/`.qua-tang` (94-104).
- `pc-paper-production.css`: `@import './pc-paper-scene.css'` tại L1 (đường thứ 2 vào production sau import trực tiếp DongFuStage.vue:33) + `.feedback-dialog` font/inputs/chip border-image/sticky actions bar (52-61) LIVE.
- `pc-paper-auxiliary-production.css`: **0 importer trong toàn repo**, `.pc-auxiliary` không component nào set — file chết hoàn toàn.
- Dead CSS (không element nào còn trong template): `.tran-phap-panel__formation-pattern`, `__formation-copy`, `__section-title`, `__queue-title` (secondary 113-119; auxiliary 18-21,36-39).

### Art khác
- Vendor header art: literal `/assets/buildings/dong-fu/v2/{id}/base.png` trong `useBuildingHeaderState.ts:36` — KHÔNG qua `DongFuBuildingArt.ts` (entries trong đó phục vụ hotspot layer Phaser dormant, không feed header).
- TranPhapPanel: `fx-border-beam` base class ở **theme.css** (581+; panel chỉ set `--fx-beam-fill` 546 trong cell-state rules 521-547, comment 541 cite theme.css); preview Phaser `TranPhapCombatPreviewScene`.
- `PcPaperIcons.ts:3`: PC_PAPER_ICON_IDS đủ id kể cả locked + 'forge' + body-* — asset sẵn sàng, phục vụ avatar/DesignPreview; rail dùng file `navigation-*-v2.png` riêng.
- `SettingsNavRail.vue` SECTION_ICON (17-24): general→settings, display→realm, **audio→feedback**, account→character, update→production, **support→guild** — icon của domain khóa recycle vào UI live.
- `PcPaperLock.vue` chỉ trong ui-preview (CharacterProgressionDesignPreview.vue:9, PaperSceneDesigns.vue:4).

## 4. Conflicts / layers — nơi 2 phiên bản UI cùng tồn tại

1. **"Trợ Giúp" ≠ nội dung.** Label rail `dongFu.nav.feedback`="Trợ Giúp" (vi.json:2044) mở dialog title `betaFeedback.title`="Gửi Phản Hồi" (1907) — form báo lỗi có draft/idempotency/diagnostics, không phải trang hướng dẫn. Mock `HomeSupportArtPanel` phục vụ CẢ `kind='settings'|'feedback'` (LandscapeDesignPreview.vue:66: `v-if="activePanel === 'settings' || activePanel === 'feedback'" :kind="activePanel"`) — nhánh feedback có help-banner/help-copy/tips thật nhưng chỉ sống trong preview.
2. **FeedbackDialog 3 mount production, 3 ref riêng** (`feedbackOpen` DongFuStage:60, SettingsPanel:83, ErrorScreen:69) + preview — ba instance teleport-to-body độc lập, không share state ngoài sessionStorage draft; ErrorScreen còn truyền `initialDescription`.
3. **Hai (nửa) UX "khóa" khác nhau**: rail giữ nút locked-grayscale (DongFuStage 203,453-454,539) còn wheel XÓA hẳn slot (`betaWheelSlots` filter + `.filter(available)` 109). Loại thứ 3 nữa: `talisman_slot` admitted nhưng `NEVER_AVAILABLE` (150-155) — qua scope filter rồi chết ở available(). `disabledReason`/tooltip/`is-disabled` của catalog + DongFuWheel (40,47,75-77) là dead code hoàn chỉnh.
4. **Fail-closed nhiều lớp**: standalone = 2 lớp (`openStandalonePanel` no-op ui.ts:248-250 + watcher mount GameRoot:77-100); left-panel = 3 lớp (`toggleLeft` 199-204 + `openLeftPanel` 226-230 + `mode` computed FunctionOverlayPanel:69-77 lọc `isBetaLeftPanelMode` ngay mount-seam). `secondary.ts:33` `ui.standalonePanel='tran_phap'` + `SecondaryPreview.vue:38` `select()` ghi cùng field + mount `v-if` trực tiếp (47-49) — bypass mọi lớp, chỉ trong preview.
5. **Vendor trên shell legacy**: VendorPanel live nhưng qua `legacyMode` → `OverlayPanel` (FunctionOverlayPanel 85-87,193) — vỏ ink-overlay tự vẽ paper bên trong (`--paper-text` + `--paper-grain` 234-237), không phải paper-scene như các surface đã migrate (PAPER_MODES 53-58).
6. **Lớp plaque `.df-building` dormant**: tien-hiep-ui.css:152-166 (gồm `[data-df-building='vendor']` 166) + `DongFuHomeContent.vue:41-67` chỉ còn trong preview → vendor vào được DUY NHẤT qua rail (không wheel slot, không hotspot). `BuildingTooltipContent`/`kind:'building'` (useTooltip.ts:164-178, Tooltip.vue:188 render) có **0 producer** — plaque layer chỉ dùng `:title` native (DongFuHomeContent:48); comment "caller duy nhất là plaque layer" đã lạc hậu.
7. **Chunk-warm chết**: GameRoot 110-123 idle-import Artifact/TranPhap/Companion — tải bundle 3 panel không bao giờ mount.
8. **Icon tái dùng**: SECTION_ICON (SettingsNavRail 17-24) gán `guild`→support, `feedback`→audio (+ realm→display, character→account, production→update) — cùng asset 2 nghĩa.
9. **LoreCodexModal vs Trợ Giúp**: prompt ghép hai cái; thực tế LoreCodexModal chỉ là reader lore 1 item trong Tàng Kinh Các (mount LoreCodex.vue:88), không liên quan help/feedback.
10. **Rail mock nguồn còn sống trong preview**: `LandscapeDesignPreview.vue:61` render rail `.home-independent-navigation` + `locked`/`disabled` y hệt production (nguồn mock được port), kèm `HomeFormationArtPanel`/`HomeSupportArtPanel` mock.

## 5. Logic không có hình ảnh — logic/state không render ra gì

- `disabledReason` của slot bị gate (`commandWheelCatalog.ts` 135-147,166-172,183-189) + `RELEASE_UNAVAILABLE_REASON` (75) + predicates `isArtifactDomainUnlocked`/`isCompanionDomainUnlocked`/`isFormationUnlocked` feed `disabledContext` (DongFuStage:100-107) — output không bao giờ vào DOM vì slot bị filter trước.
- `usePaperNavigation()` (composable 92-143): map `NAV_TARGETS`/`LEFT_PANEL_NAV_ID`/`progressionLocked`/`navigate()` — **0 caller production** (preview chỉ lấy `PAPER_NAV_IDS`); `PaperPanelNavigation.is-locked` không render ở đâu kể cả preview.
- `NAV_FEATURE_LOCKED` chỉ có formation; guild/sect/portal trong `NAV_LOCKED` cứng — sẵn sàng map sang flag nhưng chưa có cờ.
- FeedbackDialog invisible logic: `buildContext`/`buildDraftInput`/`safeProvide`, `idempotencyKey`+`fingerprint`, `keyFor`, `getFeedbackProviders` (route/saveRevision), `getDiagnosticRecorder` ring 200 events → cap maxDiagnosticsEvents/Bytes; DOM chỉ lộ `diagnosticCount` + list preview 8 dòng + `previewBytes` KB.
- `getBuildingStatus` (useBuildingNavigation 81-107) generic cho mọi building — vẫn LIVE cho teleport_array/pill_room/gathering_outpost/equipment_hall qua `slotBadge` (DongFuStage:144-153); chỉ nhánh chi_hien_quan chết.
- Toàn bộ domain logic của 4 panel gated: `setFormationLoadout`, artifact grade/path, companion feed/kit, worker-lodge tab verdicts — dead ở tầng UI.
- `BuildingTooltipContent` type + nhánh render `Tooltip.vue:188` — 0 producer toàn repo.

## 6. Hình ảnh không có logic — art/DOM trưng bày, unwired

- 6 nút rail locked (formation + artifact/companion/guild/sect/portal): icon v2 + medallion + label đầy đủ, `:disabled` — tem xám trang trí; guild/sect/portal không có một dòng domain code.
- `HomeSupportArtPanel` (nhánh `kind='feedback'` = trang hướng-dẫn thật: help-banner/help-copy/tips) + `HomeFormationArtPanel` — chỉ trong `LandscapeDesignPreview.vue:64-66`.
- `PcPaperLock`, PcPaperIcons ids locked-domain (`guild`,`sect`,`portal`,`forge`,...), `navigation-forge-v2.png` — asset sẵn sàng, consumer thật chưa tồn tại.
- `.df-building`/`data-df-building` CSS + `DongFuBuildingArt` scenePlacement/hitbox — chuẩn bị cho hotspot layer production không mount.
- `tien-hiep-ui.css` `.paper-navigation` block (11-24,185-186,202-206,353-357) + `.settings-*` rules style nhánh preview.
- Dead CSS selectors: `.tran-phap-panel__formation-pattern`/`__formation-copy`/`__section-title`/`__queue-title` (secondary-ui 113-119, auxiliary 18-21/36-39) — template chỉ còn nút tên formation.
- `pc-paper-auxiliary-production.css` — file mồ côi (0 importer).
- `DongFuWheel` `is-disabled` CSS + tooltip prop (40,47,75-77) — hiển thị sẵn sàng cho trạng thái không bao giờ tới.
- LoreCodexModal `.lore-modal` chrome — chỉ phục vụ lore scripture + nút fixture 'lore'.

## 7. Open questions — mâu thuẫn cần chủ dự án quyết

1. Rail "Trợ Giúp": đổi label → "Gửi Phản Hồi" cho đúng nội dung, hay ship panel hướng-dẫn thật (mock `HomeSupportArtPanel` kind='feedback' đã vẽ xong)?
2. Locked rail items: giữ grayscale-teaser hay ẩn hẳn như wheel? (rail thấy icon xám, wheel không thấy gì; talisman_slot thì "admitted nhưng never-available" — 3 cách khóa khác nhau).
3. Formation nên vào `NAV_LOCKED` cứng như artifact/companion, hay mọi item qua feature-flag để flip cùng lúc?
4. Vendor: khi nào rời `legacyMode`/OverlayPanel sang paper scene? Có cần wheel slot + building hotspot (art đã có sẵn ở `.df-building` + DongFuBuildingArt) không?
5. LoreCodexModal: giữ làm scripture lore reader, hay refactor thành modal codex/help chung?
6. Pre-warm gated chunks (GameRoot 110-123): bỏ import khi flag OFF, hay giữ cho launch-day?
7. guild/sect/portal: teaser vô hạn hay cần ticket design? (Zero code phía sau.)
8. WorkerLodgePanel + 3 tab: giữ preview-only qua SecondaryPreview hay xóa sạch cùng cờ `manualWorkforce`?
9. Dọn dead code: `usePaperNavigation()` (0 caller), `PaperPanelNavigation` + `.paper-navigation` CSS block (preview-only), `BuildingTooltipContent`/`kind:'building'` (0 producer), `pc-paper-auxiliary-production.css`, dead selectors `__formation-pattern`/`__formation-copy`/`__section-title`/`__queue-title`, icon forge — xóa hay giữ cho reskin tiếp theo?

## Adjudication

### Missed — chấp nhận 13/13 (có chỉnh chi tiết ở #4, #9, #13)
1. **3 stylesheet global** — ĐÚNG: main.ts:8-11 import đủ 4 file; verify từng selector trong secondary/auxiliary/pc-paper-production đúng scope + dead CSS `__formation-pattern`/`__formation-copy`/`__section-title`/`__queue-title` (template TranPhapPanel:377-388 chỉ render tên) + `pc-paper-auxiliary-production.css` 0 importer. Bổ sung: `pc-paper-scene.css` vào production qua `@import` L1 của pc-paper-production.css (khớp note tu-si) VÀ import trực tiếp `DongFuStage.vue:33`.
2. **WorkerLodgePanel** — ĐÚNG: `worker_lodge→manualWorkforce` betaScopeSurface.ts:159; mount FunctionOverlayPanel:191 trong legacyMode; 3 tab tại SecondaryPreview 8-10,51-53. Panel là panel khóa thứ 4 (dạng left-panel).
3. **Fail-closed lớp 3** — ĐÚNG: `mode` computed FunctionOverlayPanel.vue:69-77 lọc `isBetaLeftPanelMode`; `toggleLeft` no-op ui.ts:199-204. Left-panel thực tế 3 lớp, standalone 2 lớp.
4. **PaperPanelNavigation** — ĐÚNG và còn sâu hơn: `is-locked` ở line 21; mount duy nhất PaperPreviewSurface:19 → `.paper-navigation` global CSS dormant. Bổ sung verify: `usePaperNavigation()` function **0 caller** (preview chỉ import PAPER_NAV_IDS), và `is-locked` không render kể cả preview (lockedIds mặc định [] và không được truyền).
5. **Listeners/timers** — ĐÚNG: keydown 380-408 (Backquote `!feedbackOpen` 397), noticeTimer 83-95, onRailTransitionEnd 78-80; TranPhapPanel watch formationLoadout 308-311, watch assignments→dispatch 342-344, onMounted 322-325 (thêm watch standalonePanel 327-338); GameRoot requestIdleCallback 110-123.
6. **DongFuBoard + AutoFarmIndicator** — ĐÚNG: mount 486-492; `entry.run()` 350 trong onWheelAction 347-359. Bổ sung: DongFuBoard cũng mount trong DongFuHomeContent (nhánh dormant); AutoFarmIndicator còn được import trong CurrencyHud chain.
7. **SettingsBuildSection trong tab support** — ĐÚNG: SettingsPanel.vue:377 cùng tab với SettingsFeedbackSection:353.
8. **RING_3_BUILDING_IDS + talisman_slot** — ĐÚNG: export 247-250, `NEVER_AVAILABLE` 150-155; là loại "khóa" thứ 3 (admitted nhưng available()=false).
9. **LoreCodex scope-gate + đường vào** — ĐÚNG: `betaMaterialStackVisible` LoreCodex.vue:32; LoreCodex ← ScripturePavilionPanel.vue:11 ← wheel ring-4 scripture_pavilion (catalog 230-237, admitted null). Rail không có nút scripture — vào chỉ qua wheel.
10. **SecondaryPreview bypass** — ĐÚNG: v-if trực tiếp 47-49 VÀ `select()` ghi `ui.standalonePanel` (38); secondary.ts:33 cũng direct-write.
11. **Icon forge thừa** — ĐÚNG: `navigation-forge-v2.png` tồn tại, 'forge' không có trong NAV_ITEMS (21 id vs 22 file).
12. **FeedbackDialog internals** — ĐÚNG: getDiagnosticRecorder 88, diagnosticReportId 110→215, previewEvents/eventLine + list 243-247/487-492, copyReportId 324-332, success UI 375-387, Teleport 362.
13. **Building tooltip dormant** — ĐÚNG với chỉnh mạnh hơn: comment useTooltip.ts:173-177 nói "plaque layer là caller duy nhất", nhưng verify cho thấy `kind:'building'`/`BuildingTooltipContent` có **0 producer toàn repo** — DongFuHomeContent chỉ dùng `:title` native (line 48). Nhánh render Tooltip.vue:188 sống nhưng không bao giờ được feed. Mức độ "chết" cao hơn finding mô tả.

### Wrong — chấp nhận 10/10
1. `.locked`/`:disabled` — ĐÚNG: thực tế class 453 + disabled 454 trong button v-for 449-460 (report cite 472-476).
2. `legacyMode` cite 89 — ĐÚNG: computed ở 85-87; line 89 là `buildingId`; render check 193 đúng.
3. Ring-3 cite 215-220 — ĐÚNG: 5 building slots ở 193-227; 215-220 chỉ là entry chi_hien_quan. Nội dung (5 slot, không vendor) đúng.
4. Ref names bịa — ĐÚNG: không có `error`/`copiedId`/`draftRestored`; thực tế `fieldError` (84), `copied` (86), `exported` (85), `idempotencyKey` (80), `idempotencyFingerprint` (81). Watch `open` (175-191) chỉ restore key từ storage — mint mới xảy ra ở `keyFor` (254-260) + sau accepted (286).
5. DongFuBuildingArt feed header — ĐÚNG là sai nguồn: header art literal `/assets/buildings/dong-fu/v2/{id}/base.png` (useBuildingHeaderState.ts:36); DongFuBuildingArt phục vụ hotspot layer Phaser.
6. HomeSupportArtPanel "(kind='feedback')" — ĐÚNG là sai: prop `kind:'settings'|'feedback'` (7), mount `:kind="activePanel"` cho cả hai (LandscapeDesignPreview:66).
7. "hai cửa vào" — ĐÚNG là thiếu: 3 mount production có ref riêng (DongFuStage:60, SettingsPanel:83, ErrorScreen:69) + preview.
8. "CSS fx-border-beam (521-547)" — ĐÚNG là sai: 521-547 là cell-state rules (`--fx-beam-fill` 546); base class ở theme.css:581+ (comment TranPhapPanel:541 tự cite).
9. getBuildingStatus "cho chi_hien_quan" — ĐÚNG là quá hẹp: function generic (81-107), vẫn LIVE qua `slotBadge` (DongFuStage:149) cho mọi building slot; chỉ nhánh chi_hien_quan chết.
10. "icon feedback.png trong PcPaperIcons" cho FeedbackDialog — ĐÚNG là sai attribution: FeedbackDialog không import PcPaperIcons (imports: OverlayPanel/GameButton/Chip/InkNineSlice); rail dùng `navigation-feedback-v2.png`, `pcPaperIconUrl` phục vụ avatar/previews.

### Verified-ok — spot-check lại, giữ nguyên
- BETA_FEATURES toàn false (31-43); 4 map scope + `featureAdmits` fail-closed + `betaWheelSlots` 92-94.
- DongFuStage constants/handlers đúng số dòng đã sửa trong report.
- GameRoot lazy+watcher+idle-warm; ui.ts gates; FunctionOverlayPanel TITLE_KEYS/BUILDINGS/vendor render.
- FeedbackDialog 733 ln, storage key, 4 điểm mount; LoreCodexModal 104 ln, OverlayLayers modal=1900.
- commandWheelCatalog slot ranges + disabledReason strings; DongFuWheel is-disabled/tooltip dead path.
- Vendor live path (buildings.ts:205/222, useBuildingNavigation:137-155); VendorPanel internals; TranPhapPanel/ArtifactPanel/CompanionPanel chỉ số đã kiểm.
- vi.json 2044/1907/2047-2049/1136; SettingsNavRail SECTION_ICON 17-24; PcPaperIcons:3; 22 icon files; PcPaperLock preview-only; MainScene:18 mount DongFuStage; secondary.ts:33; OverlayPanel paper variant 67-68.
