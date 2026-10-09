# Skeptical review — audit Tâm Pháp (commit 8ffc8e64)

## Wrong

1. **§1.C "entry mồ côi / link chết" — SAI.** Report khẳng định "không có `ui-technique.html` nào trong `game/*.html`" và `previewRoutes.ts:2` trỏ link chết. Thực tế `game/legacy/ui-technique.html` tồn tại và mount `/src/ui-preview/technique.ts` — preview vẫn vào được qua `/legacy/ui-technique.html`. Hơn nữa `previewRoutes.ts` không mồ côi: được import bởi `ui-preview/InventoryPreview.vue`, `ui-preview/PaperPreviewSurface.vue`, `ui-preview/QuestPreview.vue` (đều link tới `/legacy/ui-technique.html`). `TechniquePreview.vue:37` `back()` → `/legacy/ui-dong-fu.html` cũng resolve (file có thật trong `legacy/`). Toàn bộ đoạn §6 "preview mồ côi … không có đường vào" cần viết lại: preview đúng là preview-only nhưng **có đường vào**.

2. **§4.1 mô tả `::before` đã cũ — SAI về layer thật.** Report nói `tien-hiep-ui.css:253-254` đặt `.technique-paper::before` = "linear-gradient + world-vista inset 14px". Hai rule sau đó ghi đè trong CÙNG file: `:278-279` đổi background thành `var(--th-art-paper-surface)` tile 512×384 (world-vista không bao giờ vẽ), và `:344-345` thu `inset: 2px; border-radius: 3px`. Kết quả thật: nền giấy tile ở inset 2px, không phải world-vista 14px. Kết luận "global đè scoped" vẫn đúng, nhưng mô tả lớp art cụ thể là sai.

3. **Mount chain liệt kê `ui.toggleStandalonePanel('technique')` như entry — SAI/đường chết.** `stores/ui.ts:320-331` định nghĩa `toggleStandalonePanel` nhưng **0 caller trong repo** (grep toàn src chỉ có định nghĩa). Đường vào live duy nhất là `openStandalonePanel` (DongFuStage.vue:231, usePaperNavigation.ts:48).

4. **§1.A đường đóng "`@click.self`/Escape → emit('back')" — `@click.self` là code chết trong production.** `tien-hiep-ui.css:393` set `.technique-paper-scene { pointer-events: none }` → click vào backdrop root không bao giờ chạm element (không thể phát `click.self`). Escape vẫn live qua `useDialogFocus` (TechniqueFidelityScene.vue:21). Click ngoài đóng panel thật sự đi đường khác: pointer-events xuyên xuống canvas → `DongFuStage.onSceneClick :366-369` → `ui.closeHomeOverlays()`. Comment tại `tien-hiep-ui.css:381-389` mô tả đúng cơ chế này.

## Missed

1. **`tien-hiep-ui.css:390-411` — pointer-events kill trên `.technique-paper-scene`.** `:393` `pointer-events:none` đè scoped `pointer-events:auto` (TechniqueFidelityScene.vue:35); `:404` `> * { pointer-events:auto }` giữ children nhận click. Ngoài việc làm `@click.self` chết (Wrong #4), đây là rule live quan trọng nhất report bỏ qua hoàn toàn — nó quyết định hit-testing của toàn surface và là comment-doc'd deliberate behavior.

2. **`tien-hiep-ui.css:177-180` — override thứ ba trên `.technique-paper`.** Selector list bao gồm `.technique-paper`: `border-image-slice:240 320; border-image-width:52px; background:linear-gradient+world-vista`. Report chỉ liệt :133 và :253-254 — thiếu rule đặt slice 240/320 đè scoped `300 fill` và `border-image-width 52px` đè `83px` (TechniqueFidelityScene.vue:36). Đây là rule quyết định frame thật.

3. **`tien-hiep-ui.css:255-256` — `::after` là khung thật.** `:255` đẩy `::before` xuống `z-index:-2`; `:256` tạo `::after { border-image: inherit }` — element `.technique-paper` tự mang `border-image` và `::after` mới là lớp vẽ frame nhìn thấy. Report chưa ghi nhận stack 3 lớp (::before nền giấy, ::after frame, content).

4. **i18n keys chết hàng loạt — report không quét i18n.** Zero-usage keys: `technique.navigation` (vi.json:~2114 — xác của prop `navigation` đã gỡ khỏi TechniqueFidelityScene, cf. §4.9 test drift), `panels.skillPath.technique.{heroLabel, emptyNoBonus, qualityLine, gradeTrackTitle, materialsTitle, cardTitle, helpAria, gradeAction}` (vi.json:253-268 — xác của TechniqueSlotCard/hero band đã xoá). 8+ dead keys không ai đọc.

5. **Listener/timer sót:** `usePanelPagination.ts:41-52` tạo `ResizeObserver` (cleanup `onBeforeUnmount` :63) — drive `lorePage`/`pageSize` của LoreCodex mỗi lần container resize; report không nhắc listener này. `useDialogFocus.ts:37-60` ngoài Escape còn cài Tab-trap (focus-on-open :36, chặn Tab thoát containment :44-60) — hành vi live report cũng không ghi.

6. **`SLOT_SYMBOL.talisman_slot='technique'` (DongFuStage.vue:117).** `talisman_slot` là slot wheel LIVE (`commandWheelCatalog.ts:151-153`, ring thường, label `panels.wheel.slots.talisman_slot` vi.json:526) → symbol tâm pháp hiện trên **hai** slot wheel: `talisman_slot` và `scripture_pavilion` (:125). Report chỉ flag scripture_pavilion — thiếu talisman_slot (có thể chủ đích vì talisman~bùa, nhưng vẫn đáng ghi).

7. **`TechniquePanel.test.ts` không được nhắc.** File test mount component thật qua `createApp+pinia+i18n+GAME_MANAGER_KEY` (:6-15) — consumer thật của panel chain; comment :2-4 tự gọi là "imperial scene"/"scroll shell" — drift comment vì TechniquePanel giờ render SceneDesignCanvas, không phải ImperialScrollScene.

8. **`TechniqueSurface` không phát audio cue nào** — `onAdvance` (:116-126) flash notice nhưng không `cue('ui.*')`; so với LoreCodexModal (:22-26 `ui.cancel`+`ui.modal.close`) và wheel (`ui.wheel.select`). Nâng cảnh thành công là hành động lớn không có feedback âm — đáng note trong logic-inventory.

9. **`panels.hkNav.techniqueLocked` toast path dùng `notification.push` warning** — report đúng; nhưng sót chi tiết: DongFuStage rail giữ `technique` LUÔN sáng (không nằm trong `NAV_LOCKED` :203) nên bounce+toast là đường UX duy nhất báo khoá trên rail chính — cái report ghi ở §4.2 nhưng không nối ngược về phía navLocked ở đây. Minor.

10. **`secondary.ts` preview** (`ui-preview/secondary.ts:16-18`) import `tien-hiep-auxiliary.css` — là nơi duy nhất preview LoreCodexModal với CSS parity gần production (main.ts:10 cũng import). Report nhắc `SecondaryPreview.vue:64` fixture nhưng không ghi auxiliary.css đi kèm — rule `.lore-modal__panel` overlay đè preview khác màu với preview thiếu file đó.

11. **`TechniqueSurface.model` ghi `quality` qua `ITEM_QUALITY_LABELS` (:69)** — phụ thuộc `activeTechnique.quality` tồn tại trong `betaTechniqueSurfaceFor` — verified live; chỉ note thêm `m.icon` vẫn được đọc từ surface model (:74) rồi bị FALLBACK_ART bỏ qua — report đúng.

12. **`panels/scripture.emptyHint` i18n (vi.json:956)** — LoreCodex.vue:65 dùng `emptyHint` — verified. (Đặt ở Missed section không phải vì sai mà là report không check từng key tồn tại — tất cả key report cite đều có.)

13. **`useStateVersion`/`bumpState` wiring** (:32, :122) — mỗi advance `bumpState()` → `loreItems`/`model` recompute qua stateVersion — report nói "bump để model recompute" — đúng.

## Verified-ok (đối chiếu từng claim — đúng)

- Mount chain technique: DongFuStage NAV_ITEMS :204-208 → NAV_TARGET.technique :231 → `openStandalonePanel` ui.ts:244-255 (gate `isBetaStandalonePanel` :248 → `BETA_STANDALONE_PANEL_FEATURES.technique:null` betaScopeSurface.ts:142, fn :165-167) → `standalonePanel='technique'` → GameRoot watcher :78-100 (bounce `isBetaTechniqueSurfaceUnlocked` :89-95 → toast `panels.hkNav.techniqueLocked` — key tại vi.json:934) → `mountedStandalone` :77 → `<TechniquePanel v-if>` :172 dưới `v-if="!isFullSceneActive"` :140 → TechniquePanel.vue:14 Transition th-panel-swap → TechniqueSurface → SceneDesignCanvas+TechniqueFidelityScene :130-140. Idle prefetch :115 đúng.
- Unlock predicate `betaScopeTechniqueDomain.ts:37-44` (realmIndex>=qi_refining && getActiveWay!==undefined) đúng.
- ScripturePavilion chain: wheel ring4 `scripture_pavilion` commandWheelCatalog.ts:230-237 (ALWAYS_AVAILABLE, label `panels.wheel.slots.scripture_pavilion` vi.json:528) → `openLeftPanel` ui.ts:226-242 (gate `isBetaLeftPanelMode` → `BETA_LEFT_PANEL_FEATURES.scripture_pavilion:null` :160, fn :169-171; wheel-admit `BETA_WHEEL_SLOT_FEATURES.scripture_pavilion:null` :78) → FunctionOverlayPanel mode :69-77 → legacyMode :85-87 → `<OverlayPanel>` :158-195 → `ScripturePavilionPanel` :192 → LoreCodex. `TITLE_KEYS.scripture_pavilion` :31 có key (`layout.functionOverlay.titles.scripture_pavilion` vi.json:1631).
- `scripture_pavilion` KHÔNG trong `PAPER_NAV_IDS` (usePaperNavigation.ts:29-41) / `NAV_TARGETS` (:43-59) — đúng. KHÔNG trong `BUILDINGS` (FunctionOverlayPanel.vue:60-67) và không record trong `data/building/` (grep 0 hit) — `public/assets/buildings/dong-fu/scripture_pavilion.png` tồn tại nhưng đúng là orphan.
- `usePaperNavigation`: PAPER_NAV_IDS có technique :32; NAV_TARGETS.technique→standalone :48; progressionLocked dim :102-104, locked :113, navigate :128-140. Production caller chỉ `SettingsSurface.vue` (+ preview `paperNavigation.ts`) — rail giấy technique thật sự chỉ reachable từ Settings surface.
- TechniqueSurface: FALLBACK_ART :26 (file `public/assets/ui/huyen-kim/scene/technique-v2/temporary-manual-v1.png` tồn tại), art :74 bỏ `m.icon`, `materialNote:''` :102, `artTemporary:true` :105, notice timer 3.2s :35-42, onSelect flash-only :109-114, onAdvance :116-126 → `tryAdvanceTechniqueGrade` GameManagerRealmAdvanceOps.ts:851-877, surface computed :44-47 → `getBetaTechniqueSurfaceModel` :886-896 → `betaTechniqueSurfaceFor` betaScopeTechniqueDomain.ts:225-266.
- disabledReasonLabel map đủ 5 reason :49-58; keys `panels.skillPath.technique.reason*/emptyNoTechnique` tồn tại (vi.json:252-268). `disabledReason 'no-technique'` nhánh unreachable trên surface này đúng (Upgrade gate bởi `hasTechnique` :27-30).
- `BetaTechniqueSurfaceModel.icon` :154,256 bị bỏ qua; `.element` :156,258 không map vào `TechniqueUiModel` (interface không có field); `techniqueId` :147 chỉ dùng bởi `betaTechniqueAdmitted` filter — đúng.
- Fidelity scene: `paper` :16 → `character-v2/paper-nine-slice.png` (tồn tại) `borderImageSource` :25; useDialogFocus :20-21; `@click.self` :24 (nhưng inert — xem Wrong #4); gate `model.hasTechnique` :27-30; preview label :31; scoped `.technique-paper` :36.
- PaperInfo/Artifact/Upgrade props+emits+scoped geometry đúng như report.
- Dead components: `TechniqueSlotCard.vue` chỉ được import bởi `InkWashMediumSurfaces.test.ts:7,41` (verified); `TechniqueRuneRing.vue` chỉ qua SlotCard; Tooltip nhánh technique (:48-50,:177-186,:234) producer duy nhất là SlotCard :100 `kind:'technique'`; `TechniqueTooltipContent` useTooltip.ts:57-73 mồ côi. Stale comments SlotCard :2-5,:30-31 + ScripturePavilionPanel :2-4 — đúng drift.
- `PcPaperSceneActions.vue` — 0 importer (grep verified); file tồn tại, có Escape keydown + focus restore.
- `tien-hiep-progression.css` + `pc-paper-auxiliary-production.css` — 0 importer verified; `pc-paper-production.css` thì CÓ import (main.ts:11) nhưng không chứa rule technique/lore nào.
- Dead CSS selectors trong file live: `.technique-scene` (:25), `.technique-heading` (:134-150), `.technique-title` (:236), `.technique-slot-card` (secondary-ui.css:67) — không component nào render các class này (grep verified — `.technique-card` của SlotCard khác `.technique-slot-card`).
- Scripture hybrid reskin: `tien-hiep-secondary-ui.css:3,23-28,84-85,124-135` đè `.overlay-panel__card`/`.lore-codex__grid`/`.lore-codex__pagination`/`.lore-modal__panel`; `tien-hiep-auxiliary.css:77` `.lore-modal__panel::before` — verified đúng line.
- Art map: 4 icon `Techniques.ts:21,62,91,122,149,177` (dai_ngu_hanh×2, ngu_kiem, van_kiem, iron_body×2 — file đều tồn tại); plinth manifest `StableSceneArt.ts:177-181` có, nhưng 0 component render (chỉ test :49); `symbols/technique.svg` qua `symbolUrl` dongFuUi.ts:12-14 (rail giấy + upgrade slot icon); `icons/technique.png` qua `pcPaperIconUrl` PcPaperIcons.ts:3-8 (preview-only).
- LoreCodex: `loreItems` :25-42 (category 'other' :29, `betaMaterialStackVisible` :32 — fn tồn tại betaScope.ts:513), `usePanelPagination(count,62,{columnWidth:62})` :46-52, SlotView không icon → monogram (SlotView.vue:110-111, :266-267 `monogram(label)`), EmptyState :62-65 keys `panels.scripture.*` vi.json:954-957, modal Teleport `OVERLAY_LAYERS.modal`=1900 (OverlayLayers.ts:31), cues `ui.cancel`+`ui.modal.close` :22-26.
- Command wheel stale comment :79-82 (mô tả Tam Phap ở ring1 nhưng ring1 :90-110 chỉ character/realm/skill) — verified.
- `TechniqueFidelityScene.test.ts:18` truyền `navigation: []` — prop undeclared (component props :10-13) → fallthrough attr, drift đúng.
- DongFuStage: navLocked :217-221 (NAV_LOCKED :203 không có technique → luôn sáng); `df-scene--covered` :416; onSceneClick :366-369; keydown Tab/` gated `!surfaceOpen` :380-401.
- `technique.*` i18n keys production (vi.json:2112-2128) + `techniqueMessages.ts` mirror cho preview/test — đều tồn tại và được các fidelity component đọc.
- SceneDesignCanvas overlay :41-42 — `pointer-events:none` canvas — đúng như report §5.
