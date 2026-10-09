# Panel: Tâm Pháp

Audit read-only trên `devin/artui-c0-foundation` (commit 8ffc8e64), đã adjudicate bản gốc + skeptical review. Phạm vi 2 surface: **Tâm Pháp** (standalone `technique`) và **Tàng Kinh Các** (left-panel `scripture_pavilion`, quê cũ của catalog tâm pháp, giờ chỉ còn Lore).

## 1. Mount chain — từ nav/route đến component gốc

### A. Tâm Pháp (đường live duy nhất)

```
DongFuStage rail / PaperPanelNavigation rail
  → ui.openStandalonePanel('technique')
    → stores/ui.ts:244 gate isBetaStandalonePanel ('technique' → null feature → admit, core/betaScopeSurface.ts:142,165)
    → ui.standalonePanel = 'technique'
GameRoot.vue:78-100 watcher
    → PROGRESSION LOCK: isBetaTechniqueSurfaceUnlocked(player.$state) (core/betaScopeTechniqueDomain.ts:37-44: realm >= qi_refining && getActiveWay(player) !== undefined)
      · fail → notification.push warning t('panels.hkNav.techniqueLocked') + ui.standalonePanel = null (GameRoot.vue:89-95)
      · pass → mountedStandalone.add('technique')
<GameRoot.vue:172> <TechniquePanel v-if="mountedStandalone.has('technique')" /> (bọc trong v-if="!isFullSceneActive", :140; component là defineAsyncComponent :22)
panels/TechniquePanel.vue:14 <Transition name="th-panel-swap"><TechniqueSurface v-if="ui.standalonePanel === 'technique'" />
scenes/technique/TechniqueSurface.vue:130-140 <SceneDesignCanvas overlay><TechniqueFidelityScene :model :selected :notice @select @advance @back="ui.closeHomeOverlays()" />
scenes/technique/fidelity/TechniqueFidelityScene.vue:24-32 root .technique-paper-scene
    → TechniquePaperInfo (luôn render)
    → TechniquePaperArtifact + TechniquePaperUpgrade (chỉ khi model.hasTechnique, :27-30)
```

Điểm vào thật:
- **Rail Động Phủ (landscape chrome)**: `DongFuStage.vue:204-208` NAV_ITEMS có `'technique'`; `NAV_TARGET.technique :231` → `ui.openStandalonePanel('technique')`; icon `/assets/ui/tien-hiep-2026-10/icons/navigation-technique-v2.png` (:458, template `navigation-${id}-v2.png`); active-state qua `NAV_ACTIVE_STANDALONE.technique` (:258-264).
- **Rail giấy PaperPanelNavigation**: `usePaperNavigation.ts:29-41` PAPER_NAV_IDS có `'technique'` (:32) → `NAV_TARGETS.technique :48` → standalone 'technique'; khoá tiến trình dim tại :102-104,113, điều hướng từ chối :128-140. Production caller DUY NHẤT là `SettingsSurface.vue` — rail giấy chỉ reachable từ surface Cài Đặt.
- **`toggleStandalonePanel` là đường CHẾT**: định nghĩa `stores/ui.ts:320-331` nhưng 0 caller trong toàn repo.
- **Command wheel**: KHÔNG còn slot Tâm Pháp — `commandWheelCatalog.ts:88-110` ring 1 chỉ character/realm/skill (+quest :114); comment :79-82 vẫn ghi "Nhan Vat/Kho/Ky Nang/Tam Phap o 4 duong cheo" (stale). Kích hoạt slot qua `DongFuStage.activateSlot :330`.
- **Đóng**: Escape → `useDialogFocus` → emit('back') → `ui.closeHomeOverlays()` (TechniqueFidelityScene.vue:20-21; TechniqueSurface.vue:138). `@click.self` trên root (:24) là CODE CHẾT trong production: `tien-hiep-ui.css:393` set `.technique-paper-scene { pointer-events:none }` → click backdrop không bao giờ chạm root. Đường đóng-thật bằng click nền: pointer-events xuyên xuống canvas → `DongFuStage.onSceneClick :366-369` → `ui.closeHomeOverlays()`; thêm `GameRoot.closeSidePanels :130-132` khi click MainScene.
- Async + prefetch: `defineAsyncComponent` tại GameRoot.vue:22; idle prefetch `:115` `void import('../panels/TechniquePanel.vue')`.

### B. Tàng Kinh Các / ScripturePavilion (đường legacy)

```
Command wheel ring 4 slot 'scripture_pavilion' (commandWheelCatalog.ts:231-236, ALWAYS_AVAILABLE, label 'Tàng Kinh Các')
  → DongFuStage.activateSlot → ui.openLeftPanel('scripture_pavilion')
    → stores/ui.ts:226 gate isBetaLeftPanelMode ('scripture_pavilion' → null feature → admit, betaScopeSurface.ts:160,169)
FunctionOverlayPanel.vue
    → mode :69-77 → legacyMode :85-87 (không nằm trong IMPERIAL_MODES :41-47, không PAPER_MODES :53-58)
    → <OverlayPanel> legacy micro-overlay :158-195 (variant mặc định 'ink', KHÔNG phải paper canvas)
      · BUILDINGS :60-67 KHÔNG có 'scripture_pavilion' → buildingId undefined
        → slot #heading/#header-actions :170-188 bỏ qua → chỉ còn title text t(TITLE_KEYS) :31 + <div class="function-overlay">
      · <ScripturePavilionPanel v-else-if="legacyMode === 'scripture_pavilion'" /> :192
panels/ScripturePavilionPanel.vue:9-13 → <LoreCodex />
panels/scripture/LoreCodex.vue:57-89 → grid SlotView + <LoreCodexModal> (import từ '../LoreCodexModal.vue' = panels/LoreCodexModal.vue, :12)
```

`scripture_pavilion` KHÔNG trong `PAPER_NAV_IDS`/`NAV_TARGETS` → rail giấy không bao giờ active nó. Không có building thật: 0 record trong `data/building/` → `buildings/dong-fu/scripture_pavilion.png` mồ côi.

### C. Preview (preview-only, CÓ đường vào — sửa từ bản gốc)

- `game/legacy/ui-technique.html` TỒN TẠI, mount `/src/ui-preview/technique.ts` → `TechniquePreview.vue` (fidelity scene + fixture + DongFuVista). `previewRoutes.ts:2` `technique:'/legacy/ui-technique.html'` resolve đúng; previewRoutes được import bởi `InventoryPreview.vue:8`, `PaperPreviewSurface.vue:9` (navigate :15), `QuestPreview.vue:8`. Nút back preview → `/legacy/ui-dong-fu.html` (TechniquePreview.vue:37, file có thật).
- `ui-preview/landscape-design.ts` → `LandscapeDesignPreview.vue:66` `<HomeTechniqueArtPanel v-if="activePanel === 'technique'" />` — mock nghệ thuật thứ hai.
- `ui-preview/character-progression-design.ts` → `CharacterProgressionDesignPreview.vue:43` `.cp-technique` mock thứ ba (catalog + art + inspector), linked `DesignReviewIndex.vue:21`.
- `ui-preview/secondary.ts:16-19` import đủ `tien-hiep-ui.css` + `tien-hiep-secondary-ui.css` + `tien-hiep-auxiliary.css` → preview `LoreCodexModal` (`SecondaryPreview.vue:64` fixture) có parity global CSS gần production.

## 2. UI logic inventory — mọi computed/store-read/emit/directive/props đang feed DOM

### TechniquePanel.vue (vỏ)
- `ui.standalonePanel === 'technique'` điều khiển render (:14); `Transition th-panel-swap`. Panel là `defineAsyncComponent` (GameRoot.vue:22).

### TechniqueSurface.vue (adapter production)
- Store/composables: `useUiStore :29`, `usePlayerStore :30`, `useGameManager :31`, `useStateVersion :32` (bump để model recompute).
- `surface` computed :44-47 → `gameManager.realmAdvanceOps.getBetaTechniqueSurfaceModel(player.$state)` (GameManagerRealmAdvanceOps.ts:886-896 → `betaTechniqueSurfaceFor`, core/betaScopeTechniqueDomain.ts:225-266).
- `disabledReasonLabel` :49-58 map 5 reason → i18n `panels.skillPath.technique.reason*/emptyNoTechnique`.
- `model` computed :60-107 → `TechniqueUiModel` (fidelity/techniqueUi.ts): hasTechnique/name/quality(`ITEM_QUALITY_LABELS` :69)/description(fallback `emptyNoTechnique` :70)/art(`FALLBACK_ART` :26,74 — BỎ QUA `m.icon`, comment :71-73 giải thích icon 32px xẹp khi phóng 433×404)/sections :75-79/stages từ `TIER_ORDER` :80-86/rankLabel :87-89/masteryLabel+masteryPercent :90-95/currentGrade+nextGrade :96-97/material :98-101/`materialNote:''` :102/`advanceDisabled:!advance.available` :103/disabledReason :104/`artTemporary:true` :105.
- `selected` ref :34 — chỉ đổi outline + flash notice (`onSelect` :109-114 `technique.stageNotice`); không đổi nội dung.
- `notice` ref :35-42 auto-clear 3.2s; `onAdvance` :116-126 → `tryAdvanceTechniqueGrade` + `bumpState()` + flash `technique.advanceNotice`. **Không phát audio cue nào** — khác LoreCodexModal (:23-24 `ui.cancel`+`ui.modal.close`) và wheel (`ui.wheel.select`); nâng cảnh thành công là hành động lớn không có feedback âm.
- Emits lên scene: `@select`/`@advance`/`@back` (:136-138).

### TechniqueFidelityScene.vue (chrome)
- Props `{ model, selected, notice, preview? }` :10-13; emits `back/select/advance` :14.
- `paper` :16 → `paper-nine-slice.png` làm `borderImageSource` của `.technique-paper` (:25).
- `useDialogFocus(rootRef, ()=>true, { onEscape → emit('back') })` :20-21 — ngoài Escape còn Tab-trap containment (focus-on-open :36, chặn Tab thoát :44-60) + mousedown containment ngoài card (document-level :73-79).
- `@click.self` → back :24 — DEAD trong production (xem §4.1 pointer-events).
- `v-if="model.hasTechnique"` :27-30 gate Artifact+Upgrade; `preview` label :31.

### TechniquePaperInfo.vue
- Props `model` :4; render eyebrow :9, `h1` chỉ khi hasTechnique :10, quality chip :11, description :12, `v-for` sections dl :13-16. Không emit.

### TechniquePaperArtifact.vue
- Props `model, selected` :5; emit `select` :6.
- `fill` computed :8 clamp masteryPercent 0-100 → progressbar :21.
- Stage buttons `v-for model.stages` :18 — class `reached/current/next` + `selected`, `aria-pressed`, `aria-current`.
- `model.art` img :13; caption khi `artTemporary` :14; rankLabel+masteryLabel :20.

### TechniquePaperUpgrade.vue
- Props `model, notice` :5; emit `advance` :6; `symbol` :8 → `symbols/technique.svg` (icon ô nguyên liệu :16).
- Compare currentGrade/nextGrade :13; `materialNote` chỉ render khi khác '' :17 (production luôn '' → dòng chết tại runtime); nút `.technique-advance` :disabled=`advanceDisabled` :18; `notice || disabledReason` :19.

### ScripturePavilionPanel.vue + LoreCodex.vue + LoreCodexModal.vue
- ScripturePavilionPanel: thụ động, shell + `<LoreCodex/>` (:9-13).
- LoreCodex: `loreItems` computed :25-42 — `materialBag.getAll()` → lọc `category==='other'` :29 → `betaMaterialStackVisible(stack.material, player.realmId)` :32 (re-read qua `stateVersion` :26) → map {key,label,description,amount,onClick→openedContent} :33-41.
- `usePanelPagination(count,62,{columnWidth:62})` :46-52 → `lorePage/lorePages/loreGoTo/loreRange` → `pagedLoreItems` :54; pagination UI :81-85. Composable cài `ResizeObserver` trên container (usePanelPagination.ts:41-52, cleanup onBeforeUnmount :63) — drive pageSize mỗi lần resize.
- `EmptyState` khi rỗng :62-65 (`panels.scripture.empty/emptyHint`, vi.json:955-957).
- `SlotView` :69-78 nhận `:item/:label/:description/:amount` — KHÔNG truyền `icon` → monogram chữ cái (SlotView.vue:111,266-267).
- `openedContent` :23 → `<LoreCodexModal :content @close>` :88; Modal Teleport body, z-index `OVERLAY_LAYERS.modal`=1900 (:32; OverlayLayers.ts:31), đóng phát `ui.cancel`+`ui.modal.close` (:23-24).

### Dead/dormant nhưng còn import được (không mount đâu trong production)
- `panels/skill-path/TechniqueSlotCard.vue` — importer duy nhất là test `common/InkWashMediumSurfaces.test.ts:7,41`. Comment :2-5,:30-31 vẫn khẳng định "nguoi dung duy nhat con lai la TechniquePanel.vue (hero variant)" — STALE. Chứa: `model` computed :44-48, `currentTierLabel` :56-62, `tierExpValue/Max/Label` :66-90, `tooltipContent` :92-112 → `v-tooltip` :116 + `TechniqueRuneRing :lit=rank` :120-124 + `SlotView :icon=technique.icon` :125-130 (nơi DUY NHẤT `m.icon` từng được render, cùng `ELEMENT_LABELS` :106).
- `panels/skill-path/TechniqueRuneRing.vue` — chỉ qua SlotCard → chết theo.
- `Tooltip.vue` nhánh technique: `techniqueContent` :48-50, header :177-186, description :234 — không còn producer (`kind:'technique'` chỉ ở useTooltip.ts:58 + SlotCard :100).
- `composables/useTooltip.ts` `TechniqueTooltipContent` :57-73 — interface mồ côi (comment :51-55 vẫn trỏ TechniqueSlotCard làm builder).
- `PcPaperSceneActions.vue` — 0 importer trong repo.
- `ui-preview/TechniquePreview.vue` flag `navLocked` :18 khai báo nhưng không dùng (comment :14 hứa "dims the rail item" — preview không render rail).

## 3. Art map — file art + element dùng nó

| Art | Đường dẫn | Ai dùng | Trạng thái |
|---|---|---|---|
| paper nine-slice | `public/assets/ui/huyen-kim/scene/character-v2/paper-nine-slice.png` | `TechniqueFidelityScene.vue:16,25` `borderImageSource` `.technique-paper` | LIVE (mượn từ scene character-v2) |
| fallback manual | `public/assets/ui/huyen-kim/scene/technique-v2/temporary-manual-v1.png` | `TechniqueSurface.vue:26,74` `model.art` → `TechniquePaperArtifact.vue:13`; preview `TechniquePreview.vue`, `CharacterProgressionDesignPreview.vue` | LIVE — thay thế hoàn toàn icon thật |
| symbol technique | `public/assets/ui/huyen-kim/symbols/technique.svg` | `TechniquePaperUpgrade.vue:8,16`; `symbolUrl('technique')` (dongFuUi.ts:12) cho rail giấy `usePaperNavigation.ts:112` | LIVE |
| nav icon v2 | `public/assets/ui/tien-hiep-2026-10/icons/navigation-technique-v2.png` | rail Động Phủ `DongFuStage.vue:458`; `HomeTechniqueArtPanel.vue:27,58` | LIVE (rail) + preview |
| icon technique.png | `public/assets/ui/tien-hiep-2026-10/icons/technique.png` | `pcPaperIconUrl('technique')` (PcPaperIcons.ts:3-8) — preview-only: `CharacterProgressionDesignPreview.vue:38`, `AuxiliaryDesignPreview.vue:37` | Preview-only |
| 4 icon tâm pháp thật | `public/assets/techniques/{dai_ngu_hanh_chan_quyet,ngu_kiem,van_kiem_quyet,iron_body_scripture}.png` | data `Techniques.ts:21,62,91,122,149,177` `icon:` → `model.icon` — surface live KHÔNG render (FALLBACK_ART cố định). **Lưu ý: cả 4 file chỉ 32×32 px** — đúng như comment :71-73 nói, xẹp khi phóng vista 433×404; chỉ còn SlotCard :129 + tooltip :104 (cả hai dead) | Art tồn tại nhưng chỉ là icon nhỏ; logic feed bị khoá bởi fallback |
| plinth v1 | `public/assets/ui/huyen-kim/scene/technique/technique-display-plinth@1x.png` + `@2x` | manifest `StableSceneArt.ts:177-181` (`parallax:null` → không nằm trong `stableParallaxStack` nào → không được bundle/render; chỉ test :49) | Art mồ côi của scene v1 đã xoá |
| building scripture | `public/assets/buildings/dong-fu/scripture_pavilion.png` | không building `scripture_pavilion` trong `data/building/`; không BUILDINGS map | Art mồ côi |
| `--th-art-*` (title-plaque, button-primary, paper-surface, warm-landscape-header) | `TienHiepUiAssets` qua global CSS | `.technique-paper::before` (tien-hiep-ui.css:278-279), `.technique-advance` :237, `.overlay-panel__card::before`+`.lore-modal__panel::before` (tien-hiep-auxiliary.css:77) | LIVE trên scene thật (chi tiết §4) |

## 4. Conflicts / layers — nơi 2 phiên bản UI cùng tồn tại

1. **Global CSS đè scoped CSS của fidelity scene — stack 3 lớp (LIVE).** `tien-hiep-ui.css` (main.ts:8) dùng `:is(#app, body)` — ID specificity thắng scoped class:
   - Frame: `:177-180` `.technique-paper` nhận `border-image-slice:240 320; border-image-width:52px` (đè scoped `300 fill`/`83px`, TechniqueFidelityScene.vue:36); `:133` thêm `left:156px; width:1272px` (đè `left:94px; width:1334px`; `top:123px`+`height:633px` scoped vẫn giữ).
   - `::after` (khung nhìn thấy): `:256` `border-image:inherit; inset:0; z-index:-1` — lớp vẽ frame thật trên element.
   - `::before` (nền giấy): `:254` đặt world-vista inset 14px NHƯNG bị override ngay trong cùng file: `:255` `z-index:-2`, `:278-279` `background: linear-gradient(115deg,#f8ecd580,#f2dfbc55), var(--th-art-paper-surface) center/512px 384px repeat`, `:344-345` `inset:2px; border-radius:3px`. Kết quả thật: tile giấy ở inset 2px, KHÔNG phải world-vista 14px.
   - Element background: `:179` world-vista bị `:253` `background:transparent; isolation:isolate` override.
   - Nút Nâng Cảnh: `:237-238` `:is(.skill-upgrade,.technique-advance,...) { border:0; background:var(--th-art-button-primary); font-size:20px; color:#352713 }` đè scoped `TechniquePaperUpgrade.vue:26` (border 3px double #ba9a4e, gradient xanh, color #fff1ca, 23px). Nút trong game KHÔNG giống thiết kế scoped.
   - **Pointer-events kill**: `:393` `.technique-paper-scene { pointer-events:none }` đè scoped `auto` (:35); `:404` `> * { pointer-events:auto }` giữ children nhận click. Hệ quả: `@click.self` root chết (W4); hit-test backdrop rơi xuống `DongFuStage.onSceneClick`. Comment :381-389 mô tả deliberate: rail không out-z được overlay canvas nên sửa bằng hit-testing.
2. **Hai rail điều hướng, hai ngữ nghĩa khoá:** rail Động Phủ `navLocked :217-221` chỉ khoá `NAV_LOCKED`(:203 artifact/companion/guild/sect/portal) + `NAV_FEATURE_LOCKED`(:214 formation) — `'technique'` LUÔN sáng dù dưới Luyện Khí → bấm vào bị `GameRoot.vue:89-95` bounce + toast `techniqueLocked` (đường báo khoá duy nhất trên rail chính). Rail giấy `usePaperNavigation.ts:102-104,113` dim-khoá ngay trên item (nhưng rail này chỉ reachable từ Settings surface). Cùng một surface, hai UX lock khác nhau.
3. **Comment/catalog stale về command wheel:** `commandWheelCatalog.ts:79` mô tả ring 1 có Tâm Pháp — thực tế không slot nào `target panel:'technique'`. `SLOT_SYMBOL.scripture_pavilion='technique'` (DongFuStage.vue:125) — Tàng Kinh Các trên wheel mang icon tâm pháp (tàn dư khi pavilion là catalog tâm pháp). Thêm `SLOT_SYMBOL.talisman_slot='technique'` (:117) — nhưng `talisman_slot` là `NEVER_AVAILABLE` (commandWheelCatalog.ts:67,151-155, catalog "KHONG render nut") → mapping dormant, KHÔNG hiện trên wheel.
4. **Hai thế hệ UI Tàng Kinh Các — DOM legacy, chrome đã paper hoàn toàn:** ScripturePavilion đi qua `OverlayPanel` variant 'ink' (FunctionOverlayPanel.vue:158-195), nhưng lớp ink bị global reskin làm mờ hoàn toàn: `tien-hiep-secondary-ui.css:17` hide `.ink-nine-slice` (chrome `surface-m-panel` vẫn mount nhưng `visibility:hidden`), `:124-127` dựng stack `::before`/`::after` paper y hệt fidelity scene, `:135` inset 3px, `:3-5` remap text vars sang palette giấy, `:18` backdrop `#07120e85`+blur, `:19-22` reskin header/body/close; `tien-hiep-auxiliary.css:77` thêm `warm-landscape-header` vào `::before`; `pc-paper-production.css:15-16` strip `.overlay-panel__card:not(--system)` (bg/border/color/font). Ruột `lore-codex__grid`/`__pagination`/`lore-modal__panel` cũng bị sơn (secondary :84-85,:124-135). Kết luận: shell DOM là legacy OverlayPanel nhưng visual đã là paper — "dark-ink shell" không còn đúng về mặt hiển thị.
5. **3 bản mock + 1 bản live song song:** fidelity production (TechniqueFidelityScene), `HomeTechniqueArtPanel.vue` (SkillNodeArtButton + EquipmentArtCard — layout khác), `.cp-technique` catalog+inspector (`CharacterProgressionDesignPreview.vue:43`), và `TechniquePreview.vue` (preview fidelity, reachable qua `/legacy/ui-technique.html`). 4 "Tâm Pháp" khác nhau trong repo.
6. **CSS file chết nguyên khối — 2 file, 1 file double-dead:**
   - `src/assets/tien-hiep-progression.css` (0 importer): cả hệ `.pc-progression .technique-workspace/.technique-info/.technique-artifact/...` (:4,9,19,21,46-55) — layout grid thay thế cho đúng class scene mới. **Double-dead**: ngay cả khi import, mọi rule cần ancestor `.pc-progression` mà không component nào render.
   - `src/assets/pc-paper-auxiliary-production.css` (0 importer): `.scripture-pavilion.pc-auxiliary` + `.lore-modal__panel.pc-auxiliary` (:105-111) — modifier `.pc-auxiliary` không component nào gắn.
7. **Rule chết trong file live `tien-hiep-ui.css`:** `.technique-scene .technique-paper` (:25 — class `.technique-scene` 0 emitter), `.technique-heading` trong selector list LIVE :134,:135,:150 (styles class không ai render — per-heading h1/p rules vẫn execute nhưng no-op), `.technique-title` (:236 — 0 emitter).
8. **Rule chết trong `tien-hiep-secondary-ui.css`:** `.technique-slot-card` (:67 shared card rule) — class không tồn tại (SlotCard render `.technique-card`, component dead).
9. **Test drift ×2:** `TechniqueFidelityScene.test.ts:18` truyền `navigation: []` — prop undeclared → fallthrough attr (dấu vết interface `navigation` đã gỡ; xác của nó là i18n key `technique.navigation`, §5). `TechniquePanel.test.ts:2-5` comment gọi scene là "imperial scene"/"scroll shell" — panel giờ render SceneDesignCanvas.
10. **`usePanelPagination` cho lore grid**: `LoreCodex.vue:46-54` phân trang 62px/ô — hợp lệ, không conflict (nhưng thêm ResizeObserver runtime listener, §2).
11. **`.technique-upgrade` trùng 2 nơi**: `TechniquePaperUpgrade.vue` (aside cột phải) và `HomeTechniqueArtPanel.vue:91` (nút) — an toàn vì cả hai scoped; `tien-hiep-progression.css:9` style `.pc-progression .technique-upgrade` — chỉ cháy nếu cả file lẫn wrapper class được dùng (cả hai đều không).
12. **i18n keys chết hàng loạt:** `technique.navigation` (xác của prop navigation đã gỡ) + `panels.skillPath.technique.{title,heroLabel,emptyNoBonus,qualityLine,gradeTrackTitle,materialsTitle,cardTitle,helpAria,gradeAction}` — 10 key, 0 usage trong src (xác của TechniqueSlotCard/hero band đã xoá). Keys còn sống: `gradeNode`, `rankLine`, `emptyNoTechnique` (TechniqueSurface :55,70,88,96,122).

## 5. Logic không có hình ảnh — logic/state không render ra gì

- `BetaTechniqueSurfaceModel.icon` (betaScopeTechniqueDomain.ts:154,256) → `TechniqueSurface.vue:74` luôn trả `FALLBACK_ART`, `artTemporary:true` cố định (:105) → icon 32×32 của 4 tâm pháp không bao giờ lên hình.
- `BetaTechniqueSurfaceModel.element` (:156,258) — không map vào `TechniqueUiModel` → thông tin hệ/ngũ hành không render (chỉ dead SlotCard :106 từng dùng `ELEMENT_LABELS`).
- `BetaTechniqueSurfaceModel.techniqueId` (:147) — không surface nào đọc ngoài `betaTechniqueAdmitted` filter :233-239.
- `selected` tier-stage: `onSelect` :109-114 chỉ flash notice + đổi outline; không pane chi tiết nào đổi theo stage → click tia Sơ Nhập/Tiểu Thành… là no-op về dữ liệu.
- `model.materialNote` — production `''` cố định (:102); `v-if` render tại TechniquePaperUpgrade.vue:17 chết trong production (chỉ preview xài).
- `disabledReason` nhánh 'no-technique' (`disabledReasonLabel` :55) unreachable trên surface này: `hasTechnique=false` → `TechniquePaperUpgrade` không mount (TechniqueFidelityScene.vue:27-30).
- `toggleStandalonePanel` (ui.ts:320-331) — 0 caller; logic toggle hoàn chỉnh không đường kích hoạt.
- `SLOT_SYMBOL.talisman_slot='technique'` (DongFuStage.vue:117) — slot `NEVER_AVAILABLE` → mapping không bao giờ resolve ra DOM.
- `navLocked` flag `TechniquePreview.vue:18` — khai báo, không dùng (preview không render rail).
- GameRoot `mountedStandalone` lazy-once (:77-96) + idle prefetch (:115) + defineAsyncComponent (:22): panel đóng vẫn nằm trong DOM set — đúng thiết kế, ghi nhận.
- `BetaTechniqueGradeAdvance` quote `cost/owned/targetGrade` tính kể cả khi disabled (betaScopeTechniqueDomain.ts:190-215) → UI hiển thị cost trong nút disable — OK.
- `LoreCodex` `item.description` → SlotView `:description` (:75) chỉ dùng tooltip/aria; đồng thời lặp lại trong modal.
- `surfaceOpen` `DongFuStage.vue:56-58` + `df-scene--covered` (:416): che chrome home khi Tâm Pháp mở — hợp lệ.
- `overlay` prop `SceneDesignCanvas` (TechniqueSurface.vue:130): `.scene-viewport--overlay` tắt pointer-events canvas — vô hình, chỉ hành vi.
- `useDialogFocus` Tab-trap + mousedown containment (§2) — hành vi không hình ảnh.
- `ResizeObserver` của `usePanelPagination` (:41-52) — listener runtime không hình ảnh.

## 6. Hình ảnh không có logic — art/DOM trưng bày, unwired

- `TechniqueSlotCard.vue` + `TechniqueRuneRing.vue`: đầy đủ art/logic nhưng không mount (§2). Vòng rune 10 chấm `lit=rank` — hình ảnh "rank orbit" không còn đường hiển thị.
- `Tooltip.vue` nhánh technique :177-186,:234 + `TechniqueTooltipContent` — không producer.
- `TechniquePreview.vue` + `technique.ts`: preview-only (reachable qua `/legacy/ui-technique.html`, §1.C) — không phải production surface; `?empty`/`?locked` fixture flags.
- `HomeTechniqueArtPanel.vue:35` `.manual-art-space` — div trống tường vị chừng chỗ cho minh hoạ chưa bao giờ có.
- `technique-display-plinth@1x/2x.png` + manifest `StableSceneArt.ts:177-181` — `parallax:null` → không renderer, không bundle (§3).
- `public/assets/buildings/dong-fu/scripture_pavilion.png` — không building/instance (§1.B).
- `techniquePreviewMessages.ts` `tp.*` — chỉ nuôi `HomeTechniqueArtPanel` (preview).
- `PcPaperSceneActions.vue` — 0 importer.
- `.technique-preview-label` (TechniqueFidelityScene.vue:37) + key `technique.preview` — chỉ render khi `preview` prop (production không set).
- 10 i18n keys chết: `technique.navigation` + `panels.skillPath.technique.{title,heroLabel,emptyNoBonus,qualityLine,gradeTrackTitle,materialsTitle,cardTitle,helpAria,gradeAction}` (§4.12).
- CSS rules vắng chủ: `.technique-scene`, `.technique-heading`, `.technique-title`, `.technique-slot-card`, `.pc-auxiliary`, `.pc-progression` + toàn bộ `tien-hiep-progression.css`/`pc-paper-auxiliary-production.css` (§4.6-4.8,4.11).
- `.ink-nine-slice` của scripture overlay vẫn mount nhưng bị `visibility:hidden` (secondary-ui.css:17) — DOM trưng bày không hiển thị.

## 7. Open questions — mâu thuẫn cần chủ dự án quyết

1. **Nút Nâng Cảnh & khung giấy đang theo CSS global, không theo thiết kế scoped của fidelity scene** (§4.1). Chủ đích của reskin (một ramp thống nhất) hay đè nhầm? Nếu chủ đích: xoá/scoped-safe các giá trị trùng trong `TechniqueFidelityScene.vue:35-36` + `TechniquePaperUpgrade.vue:26` để khỏi đọc nhầm spec. Nếu nhầm: scope lại `:is(#app,body) .technique-*`.
2. **Vista tâm pháp giữ fallback đến bao giờ?** 4 file `public/assets/techniques/*.png` chỉ 32×32 — KHÔNG phải minh hoạ lớn, không dùng được cho slot 433×404. Câu hỏi thật: commission minh hoạ riêng từng tâm pháp, hay `temporary-manual-v1.png` là art chốt?
3. **Tàng Kinh Các nằm ngoài mọi cơ chế migrate:** không paper chrome DOM-path, không building header (không BUILDINGS map), không rail id trong `PAPER_NAV_IDS`, vẫn icon 'technique' trên wheel — dù chrome visual đã được global reskin thành paper (§4.4). Có ý định đưa panel lên paper scene/ImperialScroll, hay legacy OverlayPanel là trạng thái chốt?
4. **Khoá tiến trình hai hành vi:** rail Động Phủ bấm được rồi bounce+toast vs rail giấy dim-khoá (nhưng rail giấy chỉ reachable từ Settings — thực tế user chỉ gặp hành vi bounce). Chọn một UX thống nhất.
5. **Dọn lớp chết:** TechniqueSlotCard + TechniqueRuneRing + nhánh tooltip 'technique' + `toggleStandalonePanel` + `tien-hiep-progression.css` + `pc-paper-auxiliary-production.css` + `.technique-scene/.technique-heading/.technique-title/.technique-slot-card` rules + plinth art + `scripture_pavilion.png` + 10 dead i18n keys + `navLocked` flag + `PcPaperSceneActions`. Xoá hay giữ làm tham chiếu?
6. **Comment stale:** `TechniqueSlotCard` :2-5,:30-31 tuyên bố còn dùng bởi TechniquePanel; `ScripturePavilionPanel` :2-4 trỏ "SkillPathPanel band" (SkillPathPanel.vue giờ shell); `commandWheelCatalog.ts:79` ring1 Tam Phap; `TechniquePanel.test.ts:2-5` "imperial scene/scroll shell". Cần chốt tài liệu canonical.
7. **Stage rail** chỉ là chọn-xem (§5): ý đồ cuối là mỗi tier mở detail khác, hay chỉ trưng tiến độ? Nếu trưng, bỏ `selected`/`aria-pressed` khỏi button để khỏi hứa tương tác.
8. **Advance không có audio cue** (§2) — các hành động lớn khác đều phát `ui.*`; thêm cue cho nâng cảnh?

## Adjudication

Verify độc lập trên clone @ 8ffc8e64 (~/repos/tutienidle/game).

### Wrong — accepted (4/4)
- **W1 ACCEPT**: `game/legacy/ui-technique.html` tồn tại, mount `/src/ui-preview/technique.ts`; `previewRoutes.ts` được import bởi InventoryPreview/PaperPreviewSurface/QuestPreview; `back()` → `/legacy/ui-dong-fu.html` có file. Bản gốc sai khi gọi "mồ côi/link chết" — đã sửa §1.C,§6 (preview vẫn là preview-only, nhưng CÓ đường vào).
- **W2 ACCEPT**: cascade ::before thật = `paper-surface` tile 512×384 + soft gradient tại `inset:2px; radius:3px` (tien-hiep-ui.css:278-279,:344-345 override :254). Mô tả "world-vista inset 14px" của bản gốc là trạng thái bị đè — đã viết lại §4.1 theo stack 3 lớp.
- **W3 ACCEPT**: `toggleStandalonePanel` (ui.ts:320-331) 0 caller trong repo — gỡ khỏi mount chain, chuyển vào §5.
- **W4 ACCEPT**: `tien-hiep-ui.css:393` `pointer-events:none` trên `.technique-paper-scene` (+ `:404` children auto) → `@click.self` root chết; backdrop-close thật qua `DongFuStage.onSceneClick`. Comment :381-389 deliberate. Đã sửa §1.A.

### Missed — accepted (12/13), 1 partial
- **M1-M3 ACCEPT**: pointer-events block :390-413; `:177-180` là rule frame thật (slice 240/320 + width 52px); `:255-256` `::after` vẽ frame. Merge vào §4.1.
- **M4 ACCEPT+EXTEND**: dead i18n keys — ngoài 9 key reviewer liệt kê, verify thêm `panels.skillPath.technique.title` cũng 0 usage → 10 keys (§4.12).
- **M5 ACCEPT**: `ResizeObserver` (usePanelPagination.ts:41-52, cleanup :63) + Tab-trap/mousedown containment (useDialogFocus.ts:36-79) �� thêm vào §2,§5.
- **M6 PARTIAL**: `SLOT_SYMBOL.talisman_slot='technique'` (:117) đúng là tồn tại, nhưng reviewer gọi "LIVE" sai — slot là `NEVER_AVAILABLE` (commandWheelCatalog.ts:67,151-155, "KHONG render nut") → dormant mapping. Ghi vào §4.3,§5.
- **M7 ACCEPT**: `TechniquePanel.test.ts:2-5` comment "imperial scene"/"scroll shell" drift — §4.9.
- **M8 ACCEPT**: 0 `cue()` trong mọi component technique — §2 + open question §7.8.
- **M9 ACCEPT-as-merge**: đã có sẵn trong §4.2, bổ sung nốt "rail giấy chỉ reachable từ Settings".
- **M10 ACCEPT**: `secondary.ts:16-19` import auxiliary.css → preview LoreCodexModal parity — §1.C.
- **M11-M13 ACCEPT (verified-ok)**: `ITEM_QUALITY_LABELS`/`emptyHint`/`bumpState` đều đúng như bản gốc — không cần sửa.

### Rejected: 0 finding nào bị reject hoàn toàn.

### Corrections tự phát hiện ngoài review
- **E1**: `.overlay-panel__card` của scripture bị hide ink-slice + paper-reskin toàn bộ (secondary :17,:124-135; auxiliary :77; pc-paper :15-16) → "legacy dark-ink shell" của bản gốc sai về visual; DOM legacy nhưng chrome đã paper. Sửa §4.4.
- **E2**: 4 icon `assets/techniques/*.png` chỉ 32×32 px → fallback được biện minh bởi file thật; viết lại Q2.
- **E3**: `LoreCodexModal` nằm ở `panels/LoreCodexModal.vue` (không phải `panels/scripture/`).
- **E4**: `tien-hiep-progression.css` double-dead — rules cần ancestor `.pc-progression` không tồn tại.
- **E5**: `TechniquePanel` là `defineAsyncComponent` (GameRoot.vue:22) bên cạnh idle prefetch.
