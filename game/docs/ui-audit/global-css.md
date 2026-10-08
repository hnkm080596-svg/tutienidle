# Audit — Scope: Global CSS / Traps

## 1. Mount chain

`main.ts` L5–11 import đúng 1 chuỗi global sheets (thứ tự = thứ tự thắng cascade):
`theme.css` → `huyen-kim.tokens.css` → `system-theme.css` → `tien-hiep-ui.css` → `tien-hiep-secondary-ui.css` → `tien-hiep-auxiliary.css` → `pc-paper-production.css` (nội dung `@import './pc-paper-scene.css'` L1, rồi scene `@import './pc-paper-type.css'` L1 — 2 sheet "con" vẫn vào bundle prod).
`main.ts:59` gọi `installTienHiepUiAssets(document.documentElement)` → inject 17 biến `--th-art-*` (map `SKIN_ART` trong `TienHiepUiAssets.ts`) + 4 biến `--pc-*` (`PcPaperControls.ts`). `--pc-font-body`/`--pc-font-title` KHÔNG inject bằng JS — định nghĩa trong `pc-paper-type.css:16-17`.

Nguồn style ngoài chuỗi main.ts:
- `<style>` UN-SCOPED trong `App.vue:1398` — reset `html,body` (margin 0, overflow hidden, font/paper var) + `.boot-error` + `.authority-overlay` globals.
- `<style scoped src="./loginFields.css">` — shared import vào `LoginIdField.vue:24` + `LoginPasswordField.vue:27` (scoped, không lọt global).
- `game/art/vfx/pc-paper-meridian/acupoint-aura.css` — sheet NGOÀI `src/`, import từ `PcBodyDiagram.vue:3`; keyframes sprite 32-frame `@keyframes pc-acupoint-breathe`, class `.pc-acupoint-aura` emit tại :13 trong `<foreignObject>` SVG.
- `qi-hall.css` — import `EquipmentHallPanel.vue:10`, có guard test `qiHallLayoutOwnership.test.ts` — nhưng 0 template emit `.qi-hall__*` (xem §5).
- `art-needed.css` — ORPHAN: comment tự nhận "imported by CharacterCreationScreen" nhưng 0 importer thật; `.art-needed` class đang live ~27 file (TabBar.vue:74, DefeatHintBlock.vue:17…) → marker outline chưa bao giờ render.
- Preview-only: `ui-preview/*` mount PaperPreviewSurface/DongFuPreview/ForgePreview + `.pc-paper-inspector`/`.pc-paper-slot` (8 file mỗi cái, toàn ui-preview).

Orphan sheets hoàn toàn (0 importer): `tien-hiep-outcomes.css`, `tien-hiep-collections.css`, `tien-hiep-forge.css`, `tien-hiep-progression.css`, `pc-paper-auxiliary-production.css`, `art-needed.css` — 6 file.

## 2. Inventory per file

### theme.css (649L)
- L10 Google Fonts @import; L12-17 `@font-face UTM OngDoGia`.
- L268 `--font-display:'Playfair Display'` — chủ font THỨ NHẤT.
- DEAD (0 DOM consumer mỗi cụm): `.ornate-frame` L380-413; `.paper-drawer-fill`/`.dark-drawer-fill`/`.dark-panel-fill`/`.dark-raised-fill` L419-451; `.paper-on-sys` L478-485; `.ink-divider`+sweep L492-524.
- LIVE: `.ghost-on-paper` (4 file), `*{scrollbar-width:none}` L529-535, `.scrollfade` (16 file), `.fx-border-beam` L575-649 (2 file prod: `SlotView.vue`, `TranPhapPanel.vue`).

### huyen-kim.tokens.css (131L)
- `--hk-*` tokens live khắp repo.
- DEAD: `.hk-state-*` L96-114, `@keyframes hk-breath` + `.hk-attention` L118-131 (0 DOM emit tất cả).

### system-theme.css (353L) — report gốc bỏ sót toàn bộ
- L6 @import Chakra Petch; L47 `--sys-font-display:'Chakra Petch'`.
- Recipe family `.sys-*`: `.sys-surface` L55-69 (live — `SysPanel.vue`, `CharacterDetailCard.vue`), `.sys-corners` L72-84 (live), `.sys-rim`+`--live` L89-109 (live — `useSystemRimAuthority`), `.sys-sweep` L113-123 (DEAD), `.sys-scanlines` L127-139 (live), `.sys-bar` L142-175 (live — `SysBar.vue`), `.sys-bloom` L178-179 (live), `.sys-eyebrow` L182-189 (DEAD), `.sys-tag` L192-223 (live — `SysTag.vue`, `CharacterTalentSeals.vue`), `.sys-stat` L226-246 (live — `SysStat.vue`).
- `.bar.bar--system` L260-274 — live (`Bar.vue` variant=system).
- `.overlay-panel.overlay-panel--system` L280-289 + `section.overlay-panel__card--system .realm-*` L295-314 — LIVE nhưng chỉ qua 1 surface: `OverlayPanel.vue:53` emit `:class="overlay-panel--${variant}"`, consumer duy nhất `RealmCultivationBar.vue:37` `variant="system"` (SysPanel thay InkNineSlice). `.sys-fx-low` + reduced-motion L341-353 (fx-low DEAD).

### tien-hiep-ui.css (411L)
- L2-9 `:root` legacy: `--th-paper/--th-ink/--th-gold/--th-copy/--th-soft` = 0 consumer `var()` → DEAD; `--font-display` L8 live nhưng bị `pc-paper-production.css:4` đè (chủ thứ 3).
- LIVE geometry/paper: `.scene-viewport` L10; paper band pin L25-26 + L133-134 (11 scene: inventory/realm/technique/quest/settings + body/skill/exploration/alchemy/equipment + cf); `.paperdoll` skin L50-51 (`EquipmentPaperdoll.vue:239/254` — report gốc ghi nhầm dead); chip/slot-view L52-59 (`primitives/Chip.vue:44`, `SlotView.vue:228`); `.bag-section__search` L54.
- df-* Động Phủ LIVE: `.df-vista__front` L62 (`DongFuVista.vue:8`), `.df-node__orb` L66 (`DongFuWheel.vue:44`), `.df-location` L71/L226 (`DongFuHomeContent.vue:92`), `.df-board__go` L79, `.df-quest` L99, `.df-cultivator/__identity/__resources` (`DongFuHud`/`DongFuHomeContent`), `.df-building` L155, `.df-resource` L167, `.df-identity` L169, `.df-art-frame` L228+L352, `.df-node__label` L352.
- game-button L80-85 + `>.ink-nine-slice{display:none}` — slice ẩn nhưng node còn trong DOM.
- `.hk-scroll*` L86-92/L185-190 — live (`ImperialScrollScene.vue:47+`).
- Title plaque L93-103; scrollbars L104-106; login L107-111 + `::before` L257-259 (`LoginScrollCard`/`LoginSceneVista`).
- Victory/defeat L112-129+L231: `.victory-scene`/`.combat-defeat-panel`/`__title`/`__title-band img`/`__hint-block`/`__hint` live (`VictoryScene.vue:37`, `CombatDefeatPanel.vue:150`, `DefeatHintBlock.vue:15/20`); `.victory-title__*`/`.victory-roller`/`.combat-defeat-panel__subtitle` DEAD (thực tế emit `__flavor`/`__stage` và `.victory-plaque__*`/`.victory-growth-card__*`).
- Shine title L135-149: 12 selector — `.cf-panel__header h1` live (`CharacterFidelityScene:34`), phần lớn scene-title selector live.
- `.body-heading p` L150 LIVE — bắn `.body-subtitle` (`BodyFidelityScene.vue:41`).
- `*-paper` slice L177-180 + override chain L253-269 (world-vista → transparent + paper-surface `::before` + panel-frame-v2 `::after` kế thừa border-image).
- `.production-panel`/`.site-card` L191-201 live (`ProductionPanel`, `VendorPanel`, `WorkerLodgePanel`, `TabBar`).
- skill-* L218-225: chỉ `.skill-respec` L223 live (`SkillFidelityScene`); `.skill-heading`/`.skill-elements`/`.skill-meta`/`.skill-info-frame`/`.skill-paper-details` DEAD.
- Inventory L286-341: LIVE = `.inventory-title` L286-290, `.inventory-content` L291-293, `.toolbar` L294-305, `.workspace` L306, `.bag` L307. DEAD-trong-context = `.bag-section*` L308-327, `.chip*` L317-326, `.bag-pagination*` L328-340, `.count` L341, `.slot-view` L362-365 — `InventoryFidelityScene` emit `.item-grid`+`.corners`, KHÔNG emit bag-section/chip/pagination/slot-view (selector `.inventory-scene X` không bao giờ match).
- chrome-split `::before/::after` L253-256+344-346 + L260-274; pointer-events inversion L390-411 + intent comment L381-389 (click trống rơi xuống `DongFuStage` empty-space handler = dismiss).
- `.th-panel-swap` L367-379 live (7 file).

### tien-hiep-secondary-ui.css (137L)
- Modal card family L3-17 = **10 member** gồm `.lore-modal__panel`; nhưng hide-list `>.ink-nine-slice` L17 chỉ 9 (thiếu lore-modal — vô hại vì `LoreCodexModal` mount 0 InkNineSlice).
- Overlay chrome L18-28; `#global-tooltip:not(.tooltip--element)` L30-46 + L128-130 — guard `:not()` hỏng: `Tooltip.vue:157` chỉ emit `tooltip--element-${element}`, bare `tooltip--element` 0 → mọi element tooltip đều ăn skin này; scoped `.tooltip--element` (Tooltip.vue:311-312,326-327) cũng dead.
- `.tran-phap` light 3-col L48-63 + `__confirm` L61 live; L112-122 = `__formation-button` LIVE (`TranPhapPanel.vue`) + `__formation-pattern`/`__formation-copy` DEAD + `artifact-path-cards__milestone-*` live + toast — KHÔNG phải dead queue/section titles như report gốc (hai class đó nằm ở auxiliary).
- tab-bar/surfaces L65-74; dark remap L75-97; toast/banner/loading L99-111 — `.loading-screen` là consumer DUY NHẤT còn sống của `world-vista` art.
- `.item-card__name` L41 DEAD; `#global-tooltip .item-card__*` L42-46 LIVE (`ItemCardBody` mount trong tooltip qua `Tooltip.vue:168-175`).
- Chrome-split wave 2 L124-137.

### tien-hiep-auxiliary.css (116L)
- `.tran-phap` dark 2-col L2-44 THẮNG (import sau secondary): `__section-title` L18-21 + `__queue-title` L36-39 DEAD đúng file; `__cell--enabled/occupied/hover` L73-75 live; `queue-stand__base` L76 live.
- `.companion-panel*` L45-67 live; `chieu-mo__*`/`duyen-phan__*`/`qua-tang*`/`quan-khi*` L94-108 live; modal `::before` warm-landscape-header L77-80; `.offline-summary__actions` L111 DEAD; @media 1300px L112-116 live.

### pc-paper-production.css (69L) + scene + type
- L4 `:root` re-alias `--font-display:var(--pc-font-title)` → chủ font thứ 3, cuối cùng thắng.
- L5-14 `.game-button::before` art + `>.ink-nine-slice{display:none}`.
- L15-19 modal→`.pc-paper-chrome` positioning — `.pc-paper-chrome` chỉ mount bên trong `PcPaperDialog.vue:14`.
- L20 `#global-tooltip` → `--pc-inspector-art`.
- `.pc-settings-content`/`.pc-settings-root` L24-49 DEAD (0 DOM).
- `.pc-paper-scene{pointer-events:auto}` L21 live; `.feedback-dialog` L52-61; `.hk-art-scene` box-sizing L67-69 live.
- pc-paper-scene.css: `.pc-paper-scene` live (12 file prod gồm `DongFuStage`), `.pc-paper-button` LIVE prod (17 file: `PcPaperButton`, `PcPaperDialog`, `PcPaperSceneActions`, `AuthEntryScreen`, `CharacterCreationScreen`, `DongFuStage`…) — report gốc ghi "preview-only" là SAI; `.pc-paper-inspector`/`.pc-paper-slot` đúng là preview-only.

### tien-hiep-entry.css (46L)
- `.th-entry-scene`/`.auth-*` live (`AuthEntryScreen`); `.pc-creation-*` DEAD (0 DOM); `.th-entry-scene .pc-paper-button` hover live.

### qi-hall.css (288L) — dead-but-owned
- `class="qi-hall__*"` không emit từ template nào; `tierClass()` emit `.qi-hall__tier-N` nhưng `RefineTab.vue:449-455`/`WashTab.vue:408-411` re-declare scoped (ghi chú trong RefineTab xác nhận cố ý tách khỏi bundle). File chỉ "sống" nhờ import + ownership-guard test.

## 3. Art map (var → consumer) — đã sửa

| Var | Consumer | Status |
|---|---|---|
| `--th-art-navigation-rail` | ui.css:14 `.paper-navigation` | preview-only |
| `--th-art-title-plaque` | ui.css:71 `.df-location`; secondary:111 `.loading-screen__title` | LIVE ×2 |
| `--th-art-section-header` | ui.css:41 `.cf-section`/`.cf-details__heading` | DEAD |
| `--th-art-power-ribbon` | ui.css:45 `.cf-power` | DEAD |
| `--th-art-slot-frame` | ui.css:57 `.slot-view` (scope `.inventory-scene` L362 dead-in-context) | LIVE |
| `--th-art-orb-frame` | ui.css:66 `.df-node__orb` → `DongFuWheel.vue` | LIVE |
| `--th-art-paper-panel` | ui.css:75 (đè L228/352 `!important`), ui.css:115 (đè L231+L264-269) | DEAD (2 kênh đều bị đè) |
| `--th-art-button-primary` | ui.css:79 `.df-board__go`, L237 multi-selector (`.technique-advance`/`.body-invest`/`.brew-button`/`.realm-cta`/`.inventory-scene .item-detail button` live; `.skill-upgrade` dead), L251-252 `.challenge` (`ExplorationPaperDetails:32`), secondary:61 `__confirm` | LIVE |
| `--th-art-building-plaque` | ui.css:155 `.df-building` | LIVE |
| `--th-art-resource-pill-1x` | ui.css:167 `.df-resource` | LIVE |
| `--th-art-identity-plate-1x` | ui.css:169 `.df-identity` | LIVE |
| `--th-art-paper-surface` | ui.css:257 `.login-scroll::before`, L279 `*-paper::before`, secondary:12→125 modal `::before`, aux:78 `::before` | LIVE |
| `--th-art-panel-frame-v2` | ui.css:228/352 `.df-art-frame`, L231 victory/defeat, L353 paper-navigation, secondary:14/35/101/127/134 modal+tooltip+toast | LIVE |
| `--th-art-world-vista` | chỉ secondary:110 `.loading-screen` còn render (L179→253, L254→279 bị đè) | LIVE 1 kênh |
| `--th-art-world-vista-warm` | chỉ `tien-hiep-outcomes.css:17` (orphan) | DEAD var |
| `--th-art-warm-landscape-header` | aux:78 modal `::before` live; ui.css:283 `.inventory-landscape` dead | LIVE (qua aux) |
| `--th-art-warm-branch-corner` | ui.css:349 `.inventory-branch` (0 DOM) | DEAD var |
| `--pc-primary-button`/`--pc-secondary-button` | `.game-button::before` L6-10 + `.pc-paper-button::before` scene:34-36 | LIVE |
| `--pc-inspector-art` | `#global-tooltip` L20 | LIVE |
| `--pc-slot-art` | `.pc-paper-slot` scene:47 | preview-only |

Font chain: Google Fonts (theme L10) + Chakra Petch (system L6) + UTM OngDoGia (theme L12-17, `--font-body`?) + PC Paper Serif (pc-paper-type L1-14). `--font-display`: Playfair (theme:268) → Noto Serif (ui:8) → `var(--pc-font-title)` (production:4) — owner cuối thắng. `--sys-font-display:'Chakra Petch'` chạy song song, scoped `.sys-*`.

## 4. Conflicts / layers

1. **`:is(#app, body)` wrapper** trên global rules đẩy specificity ≥(1,1,0), thắng Vue scoped (0,2,x) — mọi rule trong 4 sheet main.ts đều đè được style scoped.
2. **Doubled class** `.chip.chip`, `paper-navigation.paper-navigation` → (1,2,0) — vũ khí chống đè trong chính chuỗi global.
3. **`.game-button` 3 lớp**: ui.css L80-85 (3-class selector 1,3,0 thắng pc-paper về màu chữ) → pc-production L5-14 (::before art + hide slice; PC chỉ thắng art/shape) → `GameButton.vue:182-183` scoped `.sys-surface`/`.overlay-panel__card--system` `:focus-visible` (lớp thứ 3 nằm trong component, không nằm system-theme.css). Slice ẩn nhưng node vẫn trong DOM → `:not(:has(.ink-nine-slice))` không bao giờ đạt (nút circle mất ring).
4. **`:root` font 3 chủ** (§3) — kèm `--sys-font-display` tách biệt.
5. **`.exploration-details .notice:empty`** collapse live (`ExplorationPaperDetails:35`) nhưng `.equipment-notice` scoped luôn render → chiếm 13px cố định (`EquipmentFidelityScene:146`) — bất đối xứng.
6. **Tooltip `:not(.tooltip--element)`** guard hỏng (bare class 0 emit) → mọi element tooltip ăn skin base; scope "element" mà code muốn carve-out không tồn tại.
7. **Modal strip 2 lớp**: secondary:14-17 family+hide → pc-production:15-18 strip+`.pc-paper-chrome` (chỉ hiệu lực trong `PcPaperDialog`-hosted). `.lore-modal__panel` trong family nhưng thiếu ở cả 2 hide/strip list — vô hại (0 slice).
8. **Paper band pin** L25-26+133-134: `background` shorthand reset `background-clip` về border-box; qualified selector spec cao hơn (vd `.settings-scene` L99 (1,2,0)) vẫn thắng → plaque band render đúng (cả 2 reviewer đọc sai visual).
9. **Text-override L358-361**: `.alchemy-title`/`.realm-title`/`.body-title`/`.equipment-title` DEAD (h1 không gán class — `EquipmentFidelityScene:58` chỉ là comment); `.quest-title`/`settings-title`/`.inventory-title` (L286) live.
10. **Pointer-events inversion** L390-411 + intent comment L381-389: click trống trên scene rơi xuống `DongFuStage` empty-space handler = dismiss (lý do `@click.self` vẫn đúng).
11. **tran-phap 2-pass**: secondary light 3-col (L48-63) rồi auxiliary dark 2-col (L2-44) thắng — dead-block đúng phải ghi auxiliary `__section-title`/`__queue-title`.
12. **fx-border-beam** (theme L575-649) — 2 consumer prod (`SlotView`, `TranPhapPanel`).

## 5. Logic without image (dead rules)

- ui.css: `:root` `--th-*` L2-9 (trừ `--font-display`); `.cf-*` block L28-49 trừ `.cf-panel__header h1` trong shine list; `.cf-section`/`.cf-details__heading` L41; `.cf-power` L45; `.skill-*` L218-225 trừ `.skill-respec` L223; title override dead classes §4.9; `.victory-title__*`/`.victory-roller`/`.combat-defeat-panel__subtitle` L119-129; `.inventory-landscape` L283; `.inventory-branch` L349; **`.inventory-scene .bag-section*/.chip*/.bag-pagination*/.count/.slot-view` L307-341+362-365 (dead-in-context)**.
- secondary.css: `.item-card__name` L41; `.tran-phap-panel__formation-pattern`/`__formation-copy` L118-120.
- auxiliary.css: `__section-title` L18-21, `__queue-title` L36-39, `.offline-summary__actions` L111, `.chieu-mo__card`, `.duyen-phan__result`.
- theme.css: `.ornate-frame`, 4 drawer-fills, `.paper-on-sys`, `.ink-divider`+sweep.
- huyen-kim.tokens.css: `.hk-state-*`, `.hk-attention`.
- system-theme.css: `.sys-sweep`, `.sys-eyebrow`, `.sys-fx-low`.
- pc-paper-production.css: `.pc-settings-content`/`.pc-settings-root` L24-49.
- entry.css: `.pc-creation-*`.
- Tooltip.vue scoped `.tooltip--element` L311-312/326-327 (bare class 0 emit).
- qi-hall.css toàn bộ (0 template emit).
- 6 orphan sheets (§1) + dead vars `--th-art-world-vista-warm`, `--th-art-warm-branch-corner`.

## 6. Image without logic (DOM/art chưa nối)

- `.art-needed` marker (27 file emit) nhưng `art-needed.css` 0 importer → outline không render.
- `.pc-paper-inspector`/`.pc-paper-slot` + `--pc-slot-art` chỉ preview.
- `.paper-navigation` chỉ preview (`PaperPreviewSurface.vue:19` mount `PaperPanelNavigation` — R9 comment trong `ImperialScrollScene.vue:29` + `CharacterFidelityScene.vue:5` xác nhận cố ý không nav ngang).
- Bare `tooltip--element` — guard carve-out cho element tooltip không bao giờ bắt.
- `.victory-plaque__*`/`.victory-growth-card__*` live nhưng KHÔNG có art var riêng (dùng token/inline).
- `LoginSettingsContent.vue` `<style scoped>` L23 + `:deep()` — đã xác nhận là scoped, không phải global trap.
- `body-panel`/`equipment-sheet`/`skill-sheet` root class đổi tên khỏi `*-title` cũ (comment `EquipmentFidelityScene:58` — `.equipment-title` chỉ tồn tại trong lịch sử).

## 7. Open questions

1. Xóa 6 orphan sheets + `art-needed.css` (hoặc import art-needed để marker live) — quyết định qua owner.
2. `.inventory-scene` interior rules (L307-341, L362-365): DOM thật là `.item-grid` — viết rule cho `.item-grid`/`.corners` hay đổi template emit `.bag-section`?
3. Bare `tooltip--element`: thêm bare class ở `Tooltip.vue:157` hay sửa guards thành `[class*="tooltip--element-"]`?
4. qi-hall.css: giữ file dead làm "layout contract" (guard test) hay xóa + đưa tier rules scoped duy nhất vào từng tab?
5. `.paper-navigation` (~25 rule, preview-only): giữ cho PaperPreviewSurface hay dead-delete?
6. `.hk-state-*`/`.hk-attention` keyframes: spec cho state còn thiếu DOM emitter — wired hay xóa?
7. `--font-display` 3 chủ — chuẩn hóa về 1 nguồn (pc-paper-type) khi reskin xong?

## Adjudication

**Missed (16) — Accept 14, Reject 1, Partial 1:**

- ACCEPT #1 system-theme.css unaudited: verify `.sys-surface` live (`SysPanel.vue`,`CharacterDetailCard.vue`,`aside.character-detail.sys-surface`→`CharacterFidelityDetails`); `.sys-tag`/`SysTag.vue`+`CharacterTalentSeals.vue`; `.sys-stat`/`SysStat.vue`; `.sys-bar`/`SysBar.vue`; `.sys-corners`/`.sys-bloom`/`.sys-scanlines`/`.sys-rim`+`useSystemRimAuthority`; `.bar--system`/`Bar.vue`; `.overlay-panel__card--system`/`OverlayPanel.vue` + consumer `RealmCultivationBar.vue:37` (variant="system"); `.realm-requirement`/`.realm-node` live; dead: `sys-fx-low`/`sys-sweep`/`sys-eyebrow`; font L47.
- ACCEPT #2 Chakra Petch `@import` L6.
- ACCEPT #3 `--font-display` 3 owner: theme:268→ui:8→production:4.
- ACCEPT #4 `:root` L2-9 — hiệu chỉnh: 5 `--th-*` có 0 `var()` consumer (dead); `--font-display` L8 là var live bị đè, không hẳn dead.
- ACCEPT #5 art-needed.css orphan: 0 importer, `.art-needed` live 27 file → marker không render.
- REJECT #6 "LoginSettingsContent unscoped": thực tế `<style scoped>` L23; `:deep()` compile thành scoped-descendant, không lọt global.
- ACCEPT #7 `App.vue:1398` unscoped `<style>`: reset html/body + `.boot-error` + `.authority-overlay`.
- ACCEPT #8 bare `tooltip--element` dead: `Tooltip.vue:157` chỉ emit `tooltip--element-${element}`; mọi `:not(.tooltip--element)` guard match element tooltip; scoped `.tooltip--element` rules dead.
- ACCEPT #9 `.body-heading p` live: ui.css:150 → `.body-subtitle` `BodyFidelityScene:41`. (Reviewer cite L217 sai: L217 chỉ `.skill-heading p`.)
- ACCEPT #10 `.paperdoll` live: ui.css:50-51 → `EquipmentPaperdoll.vue:239/254`.
- ACCEPT #11 auxiliary inventory thiếu: `__cell--*` L73-75, `queue-stand__base` L76, `chieu-mo__*`, `duyen-phan__*`, `quan-khi__*`, `companion-panel__*` live; dead: `__section-title` L18-21, `__queue-title` L36-39, `offline-summary__actions` L111.
- ACCEPT #12 `.pc-paper-button` prod: 17 file gồm `AuthEntryScreen`/`CharacterCreationScreen`/`DongFuStage`.
- ACCEPT #13 `acupoint-aura.css` ngoài src/: import `PcBodyDiagram.vue:3`, class emit :13.
- ACCEPT #14 `loginFields.css` scoped-src 2 importer (`LoginIdField.vue:24`, `LoginPasswordField.vue:27`).
- ACCEPT #15 `.game-button` lớp 3 — hiệu chỉnh: lớp đó là `GameButton.vue:182-183` scoped (`sys-surface`/`overlay-panel__card--system` focus rules), KHÔNG nằm trong system-theme.css.
- PARTIAL #16 `.lore-modal__panel` thiếu hide: đúng (L17 list 9/10) nhưng consequence=0 — `LoreCodexModal` mount 0 InkNineSlice; pc-production L15-18 cũng bỏ nó (giữ secondary skin) → chỉ là inconsistency vô hại.

**Wrong (14) — Accept 13, Reject 1:**

- ACCEPT #1 `.equipment-title` dead: match duy nhất là comment `EquipmentFidelityScene.vue:58`; live override list = quest/settings + inventory L286.
- ACCEPT #2 title-plaque render: `.df-location` ui.css:71 + `.loading-screen__title` secondary:111.
- ACCEPT #3 `--th-art-orb-frame` LIVE: `.df-node__orb` ui.css:66 → `DongFuWheel.vue`.
- ACCEPT #4 `--th-art-paper-panel` DEAD: L75→đè L228/352 `!important`; L115→đè L231+L264-269.
- ACCEPT #5 button-primary citations sai: `.df-location` là title-plaque; `.skill-upgrade` dead; thiếu `.df-board__go` L79 + `__confirm` secondary:61.
- ACCEPT #6 world-vista consumers: chỉ `.loading-screen` secondary:110; L179→253, L254→279; L110 là img class không phải var consumer.
- ACCEPT #7 `--th-art-section-header` chỉ feed `.cf-section`/`.cf-details__heading` (dead).
- ACCEPT #8 tran-phap dead-block sai file: secondary L112-122 chứa `__formation-button` LIVE; dead pair nằm auxiliary L18-21/36-39.
- ACCEPT #9 modal family = 10 (có `.lore-modal__panel` L3-17).
- ACCEPT #10 `.item-detail` premise: `EquipmentItemDetail.vue:117` dùng `.equipment-item-detail` — khác class.
- ACCEPT #11 `.fx-border-beam` 2 file prod (`SlotView`,`TranPhapPanel`) + 1 test.
- ACCEPT #12 `@click.self` answered: comment ui.css:381-389 — click rơi xuống `DongFuStage` empty-space = dismiss.
- ACCEPT #13 line-number: victory hide=L122; `hk-scroll__rail`=L185-186; `Chip.vue` = `common/primitives/Chip.vue`; paper-navigation ~25 dòng/4 layer.
- REJECT #14 "CombatVictoryPanel:15": import `VictoryScene` ở **L16** — report gốc đúng.

**Phát hiện mới (ngoài reviewer):**
- `.inventory-scene` interior selectors dead-in-context (§2): template emit `.item-grid`+`.corners`, không emit `.bag-section*`/`.chip*`/`.bag-pagination*`/`.count`/`.slot-view` → ui.css:307-341+362-365 không bao giờ match; chỉ geometry L291-307 + `.inventory-title` L286 live.
- `.overlay-panel--system` emit động (`:class="overlay-panel--${variant}"` `OverlayPanel.vue:53`) → scrim system-theme L280+ live trên đúng 1 consumer `RealmCultivationBar.vue:37`.
- qi-hall.css = 100% dead vocab (xác nhận chéo với agent trang-bi-doll).
- `.equipment-notice` scoped render luôn 13px kể cả rỗng (`:empty` collapse chỉ viết cho `.exploration-details .notice`).
- `.pc-paper-chrome` positioning (production L15-19) chỉ hiệu lực trong `PcPaperDialog.vue:14`.
