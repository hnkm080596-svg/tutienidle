# Panel: Tu Sĩ (Nhân Vật / scene 04)

## 1. Mount chain — từ nav/route đến component gốc

**Đường LIVE (đang hiển thị cho người chơi):**

- `main.ts` → `App.vue` L1293 `<GameRoot v-if="isBooted">` → `components/layout/GameRoot.vue` L149 `<LeftPanel />` (mount trong khối `!isFullSceneActive`, L140).
- `components/layout/LeftPanel.vue` L17: `<CharacterSurface v-if="ui.characterOverlayOpen && ui.characterSceneTab === 'character'" />` trong `<Transition name="th-panel-swap">` (L16); L18 `InventoryPanel` cho tab còn lại.
- `components/scenes/character/CharacterSurface.vue` L276-284 → `<SceneDesignCanvas overlay>` → `fidelity/CharacterFidelityScene.vue` → 3 con: `CharacterFidelityIdentity` (chứa `CharacterFidelityFigure`) + `CharacterFidelityStats` + `CharacterFidelityDetails` (FidelityScene L36-38).

**Cổng mở — chỉ còn 2 đường live (cùng qua `ui.openLeftPanel('character')`):**

- Thanh nav trái Động Phủ: `DongFuStage.vue` L227 `NAV_TARGET.character → ui.openLeftPanel('character')`; icon render động `navigation-${id}-v2.png` L458 (→ `navigation-character-v2.png`), id trong `NAV_ITEMS` L205.
- Vòng wheel (phím `` ` ``): slot `character` ring 1 `src/data/ui/commandWheelCatalog.ts` L90-96 → `activateSlot` `DongFuStage.vue` L330-345 → `openLeftPanel` L341.

**Đường CHẾT từng được tưởng là cổng mở:**

- Rail giấy `usePaperNavigation` (`src/composables/usePaperNavigation.ts`): NAV_TARGETS `character → left_panel/character` L45, `navigate()` ~L128-140 — **0 caller production**; chỉ còn trong comments (ImperialScrollScene.vue:29, CharacterFidelityScene.vue:5, SettingsSurface.vue:4) và `ui-preview/PaperPreviewSurface.vue` L6/L19 (mount `PaperPanelNavigation` duy nhất). `PcPaperSceneActions.vue` có **0 importer ở mọi nơi** (component chết hoàn toàn; nó chỉ import type `PaperNavigationItem` L5). `ui-preview/paperNavigation.ts` chỉ re-export ids.

**Store state:** `stores/ui.ts` — `characterOverlayOpen` L125 + `characterSceneTab` L130 (KHÔNG phải `leftPanelMode`); `toggleLeft` L199-224 (nhánh character L206-216), `openLeftPanel` L226-242 (nhánh character L232-238); `closeHomeOverlays()` L258-263 đóng cả wheel. 'character' nằm trong union `LeftPanelMode` (`src/presentation/contracts/panelIds.ts` L19-20) nhưng không bao giờ được gán vào `leftPanelMode` — `FunctionOverlayPanel` lọc thủ công (`FunctionMode` Exclude L23, filter L74).

**Đường NGỦ (dormant — code chết, không còn mount):**

- `panels/CharacterPanel.vue` → `scenes/character/CharacterScene.vue` (grid L17-26) → 6 vùng: `CharacterIdentityHeader`, `CharacterTalentSeals`, `CharacterFigureWheel`, `CharacterMainStats` (→`CharacterMainStatRow`), `CharacterElementSummary`, `CharacterDerivedStats`, cộng `CharacterSectionPlaque` dùng chung.
- Không file production nào import `CharacterPanel.vue` — chỉ test (xem §4.4). `panels/CharacterDetailCard.vue` (ngăn Chi Tiết cũ): production không import, nhưng `tests/architecture/b19ConsumerScopeLeak.qa.test.ts` L12/L64 mount nó.
- Lịch sử: commit `3bfa682a` (2026-10-02) LeftPanel mount CharacterPanel + CharacterDetailCard TRONG `ImperialScrollScene`; `83f84eb5` (2026-10-03) đưa `CharacterSurface` lên LeftPanel. `ImperialScrollScene` nay chỉ còn `exploration`/ProductionPanel (`FunctionOverlayPanel.vue` L122-155, comment L120-121 "San Xuat is the last surface still on the shared scroll shell").

**Đường PREVIEW (không production):**

- `ui-preview/character.ts` → `CharacterPreview.vue` L6/L96: mount `CharacterFidelityScene` với model giả + `DongFuVista` L95 + prop `preview` (tem BẢN DUYỆT).
- `ui-preview/character-progression-design.ts` → `CharacterProgressionDesignPreview.vue`: mock tĩnh trên `PcPaperScene` + `PcPaperTabs` + `PcPaperLock` + `PcBodyDiagram` (ví dụ meridian/zhou L8/L44) — DOM khác hẳn, không store.
- `ui-preview/LandscapeDesignPreview.vue` L15/L64 → `HomeCharacterArtPanel.vue` L17-28: mock tĩnh copy class `character-*` của scene thật, số liệu hardcode (power 125.680, 3 nhóm detail).

## 2. UI logic inventory — computed/store-read/emit/directive/props feed DOM

**LIVE — `CharacterSurface.vue` (adapter đọc store):**

- Store/composable: `usePlayerStore` L40, `useUiStore` L39, `useGameManager` L41, `useStateVersion` L42, `useProgressionActions.allocateAttributePoint` L43, `useTurnBattleInfo.isBattleInProgress` L44, `useI18n` L38.
- `notice` ref L46-53 + timer 3.2s (L51) → flash qua `.cf-notice`; clear onBeforeUnmount L53.
- `POWER_TERMS` L111-119 (might×2, defense×1.5, maxHp×0.1, maxMp×0.05, critRate×500, critDmg×300, speed×200) → `combatPower` L120-125.
- `daoIdentity` L134-136 (`daoIdentityFor`), `pathName` L138-152 (đạo committed → tên; mortal → `return undefined` L148 dù comment L144-147 nói "a mortal reads 'Pham Nhan'" — mâu thuẫn comment/behavior), `pathVerse` L154-156.
- `detailRows` L158-172: filter `BASE_STAT_LABELS` + `isBetaStatLabelVisible` → `offense`/`defense` (nhóm chủ quan `DETAIL_OFFENSE` L68-82 / `DETAIL_DEFENSE` L83-107 — ruling "Công/Thủ" comment L66-67).
- `model` computed L174-248: mọi field `CharacterUiModel`; stats(fill,capped,`allocatable` L212), elements L216-237, talents beta-filter L238-243, `attributePoints` L246; `resolvePlayerStatAssembly` + `buildStatSources` feed tooltip L181-196.
- Handlers: `onSelect` L250-261 (talent → flash mô tả; element → `onElement` L263-268; id lạ → `flashNotice(id)` L260 — in nguyên id lên notice, debug-artifact), `onAllocate` L270-272.
- Emits xuống: `@select`, `@allocate`, `@back → ui.closeHomeOverlays()` L282.

**LIVE — `CharacterFidelityScene.vue` (vỏ):** props `model/notice/preview` L15-19; emits select/allocate/back L20-24; `useDialogFocus` L29 (Escape → back); `@click.self → emit('back')` L32 (CHẾT — xem §4.3); CSS vars `--character-paper/--character-card` L33; comment L46-48 nói "@click.self doubles as outside-paper close" — nay sai.

**LIVE — `CharacterFidelityIdentity.vue`:** `powerTooltip` L11-16, `couplet` L20-26 (tách `pathVerse` theo '·' → 2 cột dọc); render tên/realm/path L30-31, figure L32, couplet L33-36, thẻ Sức Mạnh L37-40.

**LIVE — `CharacterFidelityFigure.vue`:** `profile` L19-21 (`PLAYER_VISUAL_PROFILES`), `idle` L26-33 (`resolvePlayerEntityKey` + `animatedArtFormFor`, armed theo `player.visualArmed`); `EntitySpriteCanvas` `v-if="idle"` L38-48 — idle undefined → vùng trống, không fallback tĩnh. Comment L5-6: "the_tu keeps the zuofeng placeholder until its art lands".

**LIVE — `CharacterFidelityStats.vue`:** `symbolUrl` import từ `../../dong-fu/fidelity/dongFuUi` L7 (phụ thuộc chéo module UI Động Phủ); `statTooltip` L18-19, `talentTooltip` L20-23, `talentIconError` L24-30 (fallback `symbolUrl('technique')`); 5 `character-stat-row` L36-51 (tube fill, nút `character-allocate` `v-if stat.allocatable` L44-49, `<em>MAX` L50); card Thiên Phú L53-62; card Ngũ Hành L63-74 (puck `elementArt`, share, `:title` native L70). Gold-tube ruling comment ~L84-85 ("one shared metallic gradient - the old per-stat colors went away").

**LIVE — `CharacterFidelityDetails.vue`:** 2 card `offense`/`defense` L16, row tooltip L19, `data-testid="character-detail-scroll"` L15.

**LIVE — `fidelity/statSources.ts`:** `resolveStatSourceName` L69-136 (attribute/equipment/technique/talent/realm/skill/pill/talisman/formation/`buff|debuff` L118-119 → tên nguồn VN); `buildStatSources` L139-172; `buildStatSourceTooltip` L216-258.

**LIVE — listeners/timers trong scope:** `EntitySpriteCanvas.vue` L125-127 `requestAnimationFrame` loop suốt lúc panel mở; `SceneDesignCanvas.vue` L7/L20-21 `ResizeObserver` trên overlay canvas; `useDialogFocus.ts` L79 `document.mousedown` preventDefault + `keydown` L65 khi panel mở.

**NGỦ — tree CharacterScene:**

- `CharacterIdentityHeader.vue`: `realm` L16, `combatPower` L20-31 (CÙNG công thức POWER_TERMS viết lại tay — bản sao), `avatarFrameUrl` L17 (`hkChromeUrl('avatar-frame')`); render avatar+seal+power plaque L35-75.
- `CharacterTalentSeals.vue`: `selectedTalents` L19-26 (beta filter), `TALENT_RARITY_TONE` L30-36 → `SysTag`; `v-tooltip="buildTalentTooltip"` L53; `HuyenKimSymbol` qua `talentSymbolId` L56; `v-if selectedTalents.length` L41.
- `CharacterFigureWheel.vue`: `chosenKit` L27-33 (gate `isBetaWay`), `characterAuraColor` L36-38 (`--aura`), `heroElement`/`heroDiscUrl` L39-44, `elementRows` L49-58, primordial `v-tooltip kind:'element' element:'primordial'` L112-117 (→ `banner-primordial.png` qua Tooltip.vue:76-78), 3 vòng trận L65-67/L83-85; `PlayerPortrait` L105-109.
- `CharacterMainStats.vue`: `attributeStats` L15-17, điểm còn lại L23-25.
- `CharacterMainStatRow.vue`: `isMain` L28, `capped` L29-32, `barRatio` L33-37, `inBattle` L25 disable nút +, `allocateAttributePoint` L90; `STAT_GLYPH` L41-47 (TOÀN chuỗi rỗng → render '·' L65), `STAT_HUE` L48-54.
- `CharacterElementSummary.vue`: `elementRows` L14-25; tooltip `elementShare` L38; disc `el-<e>.png` L42.
- `CharacterDerivedStats.vue`: `derivedStats` L15-17; tooltip description L30.
- `CharacterSectionPlaque.vue`: `InkNineSlice chrome-id="section-plaque"` L12.
- `panels/CharacterDetailCard.vue`: `statGroups` L29-37 (4 category + beta filter); `class="character-detail sys-surface"` L41.

**Directive/tooltip/aria:** `v-tooltip` ở mọi row/stat/talent/element cả 2 tree; `useDialogFocus` chỉ fidelity; `data-hk-region` ×7 ở tree ngủ (identity-header L35, talent-seals L43, figure-wheel L73, main-stats L21, element-summary L29, derived-stats L21, chi-tiet-drawer trên DetailCard L41).

## 3. Art map — file art + element dùng

**LIVE (production):**

- `assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png` → nền `.cf-panel` (`CHARACTER_ART.paper`, characterUi.ts L4 → FidelityScene L33/L59).
- `controls/character-card-nine-slice-v2.png` → khung `.character-card::before` border-image (characterUi L5 → FidelityScene L33/L67) — CHIA SẺ với `EquipmentArtCard.vue` L3, `EquipmentSurface.vue` L44, `EquipmentFidelityScene.vue` L48.
- `controls/attribute-plus-v2.png` → nút allocate (characterUi L6 → Stats L49).
- `icons/element-{metal|wood|water|fire|earth}-ivory-v1.png` → puck Ngũ Hành (characterUi L9 → Stats L72).
- `assets/ui/huyen-kim/symbols/talent-<id>.svg` → glyph Thiên Phú (characterUi L11 → Stats L61); fallback `symbols/technique.svg` (Stats L28).
- `icons/character.png` (pc-paper pack) → `pcPaperIconUrl('character')` → avatar chip header `DongFuStage.vue` L422.
- `icons/navigation-character-v2.png` → nút nav trái (DongFuStage L458, render động theo id).
- Sprite idle theo path: sheet/atlas qua `PLAYER_VISUAL_PROFILES` + `CombatPresentationCatalogue` (Figure L19-33) → `EntitySpriteCanvas` L37-49.
- Font `UTM OngDoGia` + gradient shine → `.cf-panel__header h1` (tien-hiep-ui.css L135-148).

**NGỦ (chỉ render nếu tree cũ mount):**

- `runtime/avatar-frame@1x/2x.png` (manifest `src/ui/huyen-kim-chrome.json` L526-530, ready) → `.identity-header__avatar-frame` L37-43. LƯU Ý: art này SỐNG ngoài scope — `CombatPlayerCard.vue` L44 + `DongFuHud.vue` L7/L16 cũng dùng; chỉ consumer Tu Sĩ chết.
- `assets/ui/elements/el-{fire|wood|water|earth|metal}.png` → disc medallion (FigureWheel L43/L99) + disc ElementSummary L42; `el-primordial.png` L62/L116; `el-formation-{orbs,ring,star}.png` L65-67/L83-85. `banner-{element,primordial}.png` qua `Tooltip.vue` L76-78 khi tooltip kind:'element' — live Stats dùng `:title` native nên banner không render trong live path này.
- `InkNineSlice chrome-id="section-plaque"` → nền plaque (SectionPlaque L12); `HuyenKimSymbol` `talent-*` (TalentSeals L56).
- Temp-CSS-art (không file): `art-needed`/`data-art-id` — name seal (IdentityHeader L55-56), combat-power plaque+emblem (L65-66), figure backdrop (FigureWheel L75), stat seals `character-stat-seal-*` (MainStatRow L60-61).
- `aside.character-detail.sys-surface` trên DetailCard L41 được `src/assets/system-theme.css` L316-319 style (file được main.ts:7 import) — rule global nạp cho thẻ chết.

**PREVIEW-only art:** `characters/player/mortal/player-mortal-ink-sword-concept-v2.png` (CharacterProgressionDesignPreview L22, HomeCharacterArtPanel L14); `icons/*.png` pc-paper (`pcPaperIconUrl`); `controls/landmark-v1.png` (PcPaperLandmark — chết); `source/shared-title-cloud-v1.png` (PcPaperScene).

**Art chết trong pack:** `controls/attribute-plus-v1.png`, `controls/character-card-nine-slice-v1.png` — 0 reference (v2 thay thế).

**pc-paper chrome trong scope:** `PcPaperScene/Tabs/Lock/Dialog` chỉ có consumer ở `ui-preview/` cho scene Tu Sĩ; `PcPaperChrome` chỉ qua PcPaperDialog; `PcPaperSceneActions` + `PcPaperLandmark` **0 importer ở mọi nơi** (chết hoàn toàn); `PcBodyDiagram` chỉ 2 preview dùng. `PcPaperButton` NGOẠI LỆ: có consumer production — `AuthEntryScreen`, `CharacterCreationScreen`, `LoginOpening`, `DongFuStage` L429-431. Production Tu Sĩ KHÔNG dùng pc-paper (dùng `.cf-panel` riêng). `pc-paper-scene.css` vào production qua 2 đường: `DongFuStage.vue` L33 import + `@import './pc-paper-scene.css'` trong `pc-paper-production.css` L1 (file được main.ts:11 import); thêm import tĩnh ở `PcPaperScene.vue` L2, `PcPaperDialog.vue` L3, `PcPaperChrome.vue` L2 (đều chết).

## 4. Conflicts / layers — 2 phiên bản UI cùng tồn tại

1. **Hai panel Tu Sĩ hoàn chỉnh song song:** live `CharacterSurface`+`fidelity/*` vs ngủ `CharacterPanel`+`CharacterScene`+6 vùng (~1.200 dòng). Comment `CharacterPanel.vue` L4-6 tự nhận "mount point scene 04" nhưng không còn mount; `LeftPanel.vue` L8-12 xác nhận "old dual ink-drawer AND shared imperial scroll are both retired".
2. **CSS global chết cho đời cf cũ — 3 file:** (a) `tien-hiep-ui.css` ~40 rule `.cf-scene .cf-paper/.cf-name/.cf-identity/.cf-person/.cf-aura/.cf-stats/.cf-details/.cf-section/.cf-power/.cf-title/.cf-talent/.cf-stat` (L25-49, L93-99, L177-184, L207-215, L253-256, L278-284, L344-350, ~L380) — 0 emitter. Bẫy đặt tên: `.cf-paper` nằm trong nhóm pin `left:156/w:1272/border-image` (L25, L177, L253-256, L278-284, L344-350) — đúng bẫy `*-paper` mà comment `EquipmentFidelityScene.vue` L43-46 cảnh báo ("global rules pin *-paper elements to the legacy 156/1272 nine-slice band"). Scene hiện thoát bẫy bằng tên `.cf-panel`. (b) `tien-hiep-collections.css`: file global THỨ 2 mang bẫy `.cf-*` dưới ancestor `.th-collection` (cf-paper L11, cf-title L18, cf-notice L24, cf-preview L31, character-study L36, cf-identity L41, cf-name L44, cf-realm L47, cf-path L48, cf-power L49, cf-person L54, cf-aura L55, cf-stats L60, cf-section L61, cf-details L66) — file KHÔNG được import ở đâu (0 importer, kể cả main.ts) VÀ `.th-collection`/`.pc-collection` có 0 emitter → double-dead. (c) `system-theme.css` L316-319 rule `aside.character-detail.sys-surface` nạp cho DetailCard chết.
3. **pointer-events đấu nhau — CỐ Ý:** scoped `.cf-scene{pointer-events:auto}` (FidelityScene L49) vs global `:is(#app,body) .cf-scene{pointer-events:none}` + `.cf-scene > *{auto}` (tien-hiep-ui.css L390-411, comment giải thích L382-388: fix rail click-through — "Backdrop clicks now fall through to DongFuStage's own empty-space handler, which also closes overlays - same dismiss, working rail"). Global thắng → `@click.self` trên `.cf-scene` (L32) là code chết + comment scoped L46-48 sai; click rơi qua `.scene-viewport--overlay{pointer-events:none}` (SceneDesignCanvas L41-42) xuống `DongFuStage.onSceneClick` L366-369 → `closeHomeOverlays`. Cùng kết quả nhưng emit/back path không chạy — và đây là thiết kế chủ đích, không phải bug.
4. **5 file test pin tree chết (không phải 2):** `CharacterPanel.stats.test.ts` L10/L27 + `betaScope.test.ts` L15/L39 (unit, mount CharacterPanel assert `.main-stat`/`.element-node`/`--aura`); `tests/architecture/b18ConsumerHonesty.qa.test.ts` L20/L232 + `betaConsumerSeamsB8.qa.test.ts` L39/L317+ (mount CharacterPanel); `b19ConsumerScopeLeak.qa.test.ts` L12/L64 (mount `CharacterDetailCard` — bác claim "không ai import"); `betaFrontendScopeExposure.test.ts` L204/L209 (string-ref `CharacterFigureWheel.vue`/`CharacterSurface.vue`). CI xanh cho code người chơi không thấy; fidelity live có **0 test** (grep `CharacterFidelity|statSources|characterUi` trong *.test.ts = 0).
5. **Duplicate combatPower:** `POWER_TERMS` (Surface L111-119) vs `IdentityHeader` L20-31 — cùng hệ số, 2 bản copy. Comment `paperdoll/EquipmentPaperdollStage.vue` L9: "Chien Luc is a CharacterPanel-local display heuristic" — không phải shared.
6. **Double vocabulary `.character-*`:** class giống nhau ở 3 nơi — tree ngủ (`character-panel__figure`/`.main-stats`), live (`character-card`/`.character-power`/`.character-stat-row` scoped FidelityScene L63-68, Stats L81-108) và mock (`HomeCharacterArtPanel` L17-42 — copy tay, đã lệch: detail 3 nhóm basic/combat/other L10 vs live 2 Công/Thủ; `.character-icon-tree` CSS L33-34 không có DOM).
7. **State kép cho cùng "panel":** `characterOverlayOpen`+`characterSceneTab` (ui.ts L125-130) vs `leftPanelMode` — 'character' trong union `panelIds.ts` L20 nhưng bypass khỏi field cùng tên; `navActive` DongFuStage L267-271 đọc đúng cặp flag.
8. **Scroll legacy sót vai trò khác:** `ImperialScrollScene` từng là vỏ scene 04 — nay chỉ `exploration` (FunctionOverlayPanel L122-155); rule `.hk-scroll*` trong tien-hiep-ui.css vẫn live cho scene đó, không còn cho Tu Sĩ.
9. **`th-panel-swap` Transition (LeftPanel L16)** — Tu Sĩ đi qua nó, nhưng không riêng: `FunctionOverlayPanel.vue` ~L113 dùng chung Transition này cho các paper modes; css `th-panel-swap-*` global L373-378.
10. **Cross-scene dependency ngầm:** `CharacterFidelityStats.vue` L7 import `symbolUrl` từ `../../dong-fu/fidelity/dongFuUi` — fidelity Tu Sĩ phụ thuộc module UI Động Phủ cho glyph fallback.

## 5. Logic không có hình ảnh — state/logic không render ra gì

- `model.stats[].color` + `symbol` (characterUi.ts L53-54): map symbol 'body/equipment/...' + màu từng stat — `CharacterFidelityStats` không đọc (tube vàng đồng nhất, ruling comment ~L84). Field chết trong live skin.
- `model.attributePoints` L246: chỉ gate `allocatable` L212 — KHÔNG hiển thị số điểm còn lại ở live surface. Comment `characterUi.ts` L104 hứa "drives the (+) affordance + points badge" — badge không tồn tại. Tree ngủ có text "điểm còn lại" (MainStats L23-25); cả 2 mock đều hiển thị points (HomeCharacterArtPanel L23 `t('points')`, cp-stats `t('points')`). Người chơi không biết còn bao nhiêu điểm.
- `onSelect` fallback `flashNotice(id)` (Surface L260): id lạ → in nguyên id lên notice (debug-artifact).
- `idle === undefined` → `CharacterFidelityFigure` render vùng trống (v-if L38): path không có clip idle mất hình nhân vật hoàn toàn, không fallback tĩnh.
- `pathName` comment L144-147 nói "a mortal reads 'Pham Nhan'" nhưng code `return undefined` L148 → plate chỉ hiện realm, không 'Phàm Nhân'. Mâu thuẫn comment/behavior.
- `@click.self` emit('back') trên `.cf-scene` L32 + comment L46-48: chết do global pointer-events fix (§4.3, cố ý).
- Toàn bộ tree ngủ = logic không có mount: combatPower L20-31, talent seals, wheel, main stats, element summary, derived stats, detail card — tất cả chỉ sống trong test jsdom.
- `art-needed` + `data-art-id` slots (IdentityHeader L55-56/L65-66, FigureWheel L75, MainStatRow L60-61): chỗ giữ art chưa bao giờ được gán art thật; `STAT_GLYPH` rỗng → hiện '·'.
- `PcPaperSceneActions`, `PcPaperLandmark`: **0 importer ở mọi nơi** (chết hoàn toàn). `PcPaperChrome` chỉ qua `PcPaperDialog`; `PcPaperDialog`/`PcPaperScene`/`PcPaperTabs`/`PcPaperLock`/`PcBodyDiagram` chỉ ui-preview.
- `PcPaperScene.test.ts`: file test cho component preview-only.
- `usePaperNavigation` + `PaperPanelNavigation` + rail giấy: composable + component sống nhưng chỉ render trong preview; `navigate()` không bao giờ chạy production.
- `banner-*.png` (public/assets/ui/elements, gồm primordial): tooltip kind:'element' của tree ngủ — live Stats dùng `:title` nên banner không render trong live path này.
- `.character-icon-tree` styles trong `HomeCharacterArtPanel.vue` L33-34: CSS cho DOM không tồn tại trong mock.
- `tien-hiep-collections.css`: toàn file chết — 0 importer + ancestor 0 emitter.

## 6. Hình ảnh không có logic — art/DOM trưng bày, unwired

- Header `.cf-panel__header h1` (FidelityScene L34): "Nhân Vật" tĩnh + shine animation — display-only, đúng spec.
- `.cf-preview` stamp (L40): chỉ prop preview — live không truyền.
- `.cf-notice` (L41): wired.
- Mock `HomeCharacterArtPanel` (L17-28) + `CharacterProgressionDesignPreview` (PcPaperScene shell + cp-* cards + PcBodyDiagram meridian/zhou): 100% DOM trưng bày — nút `+`, puck hành, talent lock, nút circulate/openMeridian không handler.
- Disc hero `figure-wheel__disc` + 3 vòng trận + pentagram + backdrop moon/clouds/dais (FigureWheel L75-104): trang trí thuần, chỉ `--aura`/`heroElement`/`primordial` có logic.
- `element-node__tag` tên hành (L100): display.
- `PcPaperChrome`/`PcPaperScene__frame`/`title-cloud`/`landmark`: khung trang trí — khi dùng, không hành vi.
- `PcPaperButton` variant secondary trong DongFuStage L429-431: hiển thị chip tiền tệ — art + số liệu real, nhưng click KHÔNG có handler (chip là nút trưng bày).

## 7. Open questions — cần chủ dự án quyết

1. Xoá hẳn `CharacterPanel.vue` + `scenes/character/` (trừ fidelity) + `CharacterDetailCard.vue` + **5 file test** pin code chết — hay giữ làm scaffold cho reskin tiếp? Hiện trạng: 5 test xanh cho UI không ai thấy, fidelity live không có coverage tương đương (0 test).
2. Dọn ~40 rule `.cf-*` đời cũ trong `tien-hiep-ui.css` + toàn bộ `tien-hiep-collections.css` (file mồ côi, 0 importer) + rule `aside.character-detail.sys-surface` trong `system-theme.css` — đặc biệt entry `.cf-paper` trong nhóm pin-geometry: giữ lại là bẫy đặt tên cho mọi reskin tương lai.
3. Chrome chuẩn cho Tu Sĩ là gì: `.cf-panel` (live), `.pc-paper-scene` (mock `CharacterProgressionDesignPreview`), hay `.home-character-panel` (mock landscape)? Ba vỏ song song cùng vẽ scene 04.
4. Số điểm thuộc tính còn lại: cố ý ẩn ở live surface hay sót? Comment `characterUi.ts` L104 hứa "points badge" không tồn tại; tree ngủ + cả 2 mock đều hiển thị.
5. `pathName` trả `undefined` cho mortal nhưng comment nói hiện 'Phàm Nhân' (Surface L144-151): theo comment (hiện chữ) hay theo code (ẩn)?
6. Backdrop-close: theo comment global L382-388, click rơi xuống DongFuStage là **thiết kế chủ đích** (fix rail). Precedent Cong Phap (ruling 2026-10-08): "xóa handler chết thay vì mở lại" — áp dụng tương tự: xoá `@click.self` L32 + sửa comment scoped L46-48 cho khớp thực tế?
7. `CharacterFidelityFigure` không có fallback tĩnh khi `idle` undefined — cần fallback PNG cho path chưa có clip (the_tu đang placeholder zuofeng, comment L5-6)?
8. Rail giấy `usePaperNavigation`/`PaperPanelNavigation`/`PcPaperSceneActions`: code chết hoàn toàn trong production — xoá hay giữ cho reskin tương lai (R9 ruling hiện tại nói "no PaperPanelNavigation")?

## Adjudication — accepted/rejected findings của skeptical pass

**Accepted (Missed) — tất cả 12, đã verify trên snapshot 8ffc8e64:**

1. Rail giấy chết — ACCEPT. `usePaperNavigation` 0 caller production (chỉ comments + ui-preview); `PaperPanelNavigation` chỉ mount ở `PaperPreviewSurface.vue` L19; `PcPaperSceneActions` 0 importer kể cả preview.
2. 3 architecture test thêm pin tree chết — ACCEPT. b18ConsumerHonesty L20/L232, betaConsumerSeamsB8 L39/L317+, b19ConsumerScopeLeak L12/L64 (mount DetailCard — bác claim "không ai import"), betaFrontendScopeExposure L204/L209. Tổng 5 file test chạm scope.
3. `system-theme.css` L316-319 `aside.character-detail.sys-surface` — ACCEPT. main.ts:7 import file; DetailCard L41 có class đúng.
4. Listeners/timers live — ACCEPT. EntitySpriteCanvas L125-127 rAF; SceneDesignCanvas L7/20-21 ResizeObserver + L41-42 overlay pointer-events:none (tổ tiên thật sự của click-fallthrough); useDialogFocus L79 mousedown + L65 keydown.
5. avatar-frame sống ngoài scope — ACCEPT. CombatPlayerCard L44 + DongFuHud L7/L16 dùng; manifest L526-530. Đã sửa §3: chỉ consumer Tu Sĩ chết.
6. PcPaperButton có consumer production — ACCEPT. AuthEntryScreen, CharacterCreationScreen, LoginOpening, DongFuStage.
7. PcBodyDiagram vắng khỏi inventory — ACCEPT. Import bởi CharacterProgressionDesignPreview L8 + DesignSystemPreview L8 (đều preview).
8. Art chết + icons/character.png — ACCEPT. v1 files 0 ref; v2 card share EquipmentArtCard L3/EquipmentSurface L44/EquipmentFidelityScene L48; icon character → DongFuStage L422.
9. `resolveStatSourceName` xử lý 'debuff' — ACCEPT. fidelity/statSources.ts case `buff|debuff` L118-119.
10. Cross-scene import `symbolUrl` từ dongFuUi — ACCEPT. Stats L7. Đã thêm thành conflict §4.10.
11. `tien-hiep-collections.css` mang vocab `.cf-*` — ACCEPT, mạnh hơn reviewer nói: file có **0 importer** (kể cả main.ts — main.ts chỉ nạp 7 css khác) VÀ `.th-collection`/`.pc-collection` 0 emitter → toàn file double-dead, liệt kê đầy đủ selectors cf-* ở §4.2b.
12. Không test nào cho live fidelity — ACCEPT. 0 `.test.ts` reference `CharacterFidelity|statSources|characterUi`; điểm nghịch lý đã nhấn ở §4.4 + OQ1.

**Accepted (Wrong) — tất cả 6, với 1 bổ sung:**

1. "3 cổng mở" → chỉ 2 đường live — ACCEPT, §1 đã viết lại.
2. `PcPaperSceneActions` "chỉ ui-preview" → 0 importer ở mọi nơi — ACCEPT.
3. `EquipmentPaperdollScene.vue` không tồn tại; comment bẫy `*-paper` ở `fidelity/EquipmentFidelityScene.vue` L43-46 — ACCEPT (lưu ý `paperdoll/EquipmentPaperdollStage.vue` L9 có tồn tại — đó là file khác, report cite đúng ở §4.5).
4. "chỉ 2 test" → 5 file — ACCEPT.
5. Trôi line — ACCEPT: pointer-events rules L390-411 (comment L382-388); th-panel-swap L373-378; cf-paper pins L253-256 + L278-284 + L344-350; toggleLeft L199-224 (nhánh 206-216); openLeftPanel L226-242 (nhánh 232-238).
6. `pc-paper-scene.css` "chỉ qua DongFuStage L33" — ACCEPT + AMPLIFY: ngoài 3 import chết reviewer nêu (PcPaperScene L2, PcPaperDialog L3, PcPaperChrome L2), file còn vào production qua `@import './pc-paper-scene.css'` tại `pc-paper-production.css` L1 (được main.ts:11 nạp) — reviewer sót đường này.

**Path corrections thêm (không phải finding của reviewer):** `statSources.ts` thực tế ở `fidelity/statSources.ts`; `panelIds.ts` ở `src/presentation/contracts/panelIds.ts` L19-20; `commandWheelCatalog.ts` ở `src/data/ui/commandWheelCatalog.ts` L90-96; icon nav render động `navigation-${id}-v2.png` L458 không phải literal.

**Reviewer verified-ok, tái xác nhận trên code:** mount chain (App L1293 → GameRoot L140/149 → LeftPanel L16-18 → Surface L276-284 → FidelityScene L36-38); store flags ui.ts L125/130/258-263; POWER_TERMS L111-119; allocatable L212 + attributePoints L246; onSelect/onElement/onAllocate L250-272; mortal→undefined L148 vs comment L144-147; @click.self L32 + scoped L49 vs global L390-411; dormant tree + data-hk-region ×7 + art-needed + STAT_GLYPH rỗng L41-47→'·' L65; art live trên disk; banner qua Tooltip L76-78 chỉ dormant; Stats statTooltip L18-19/talentTooltip L20-23/fallback L24-30/:title L70; CharacterScene grid L17-26; CharacterPanel comment L4-6; LeftPanel comment L8-12; ImperialScrollScene chỉ exploration L122-155; previews (CharacterPreview L96 preview+DongFuVista L95; CPDesignPreview PcPaperScene+PcBodyDiagram; HomeCharacterArtPanel hardcode 3 nhóm L10/125.680 + icon-tree CSS L33-34 không DOM); PcPaperScene.test.ts tồn tại; commit history 3bfa682a/83f84eb5.
