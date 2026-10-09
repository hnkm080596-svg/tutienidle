# Panel: Công Pháp (SkillPathPanel)

## 1. Mount chain

**Mở panel (4 đường):**
- Rail Động Phủ: `DongFuStage.vue:228` — `NAV_TARGET.skill = () => ui.openStandalonePanel('skill')` (rail click `NAV_TARGET[id]?.()` L290; wheel slot: `SLOT_SYMBOL.skill='skill'` L114 → `activateSlot` L330/L355 chạy cùng map nav).
- `ExplorationSurface.vue:86` — `openBuild()` ghi thẳng `ui.standalonePanel = 'skill'` (bypass `openStandalonePanel` + `closeHomeOverlays`, nhưng watcher GameRoot vẫn gate; `skill` luôn admit).
- `useTribulation.ts:104-108` — `ui.openStandalonePanel(result.standalonePanel)` khi `result.kind==='victory'` (seam deep-link; hiện chỉ 'quan_khi' được emit — TribulationOutcomeService:72,273).
- `PhapTuLabBridge.vue` — dev bridge `openSkillPanel: () => ui.openStandalonePanel('skill')` (~L40).
- `usePaperNavigation.ts:47` — `NAV_TARGETS['skill']={kind:'standalone',panel:'skill'}`; **`usePaperNavigation()` có 0 caller** — composable chết hoàn toàn (preview dùng `previewPaperNavigation()` riêng trong `ui-preview/paperNavigation.ts`); `PaperPanelNavigation` chỉ mount ở `ui-preview/PaperPreviewSurface.vue:19` (`ImperialScrollScene` comment R9 xác nhận đã gỡ khỏi shell).

**Gate:** `ui.standalonePanel` state `stores/ui.ts:151`; `openStandalonePanel` L244-255 kiểm `isBetaStandalonePanel` rồi `closeHomeOverlays()`; `toggleStandalonePanel` L320-331; `closeHomeOverlays` L258-263. `betaScopeSurface.ts` có đúng **2** entry `skill:null`: `BETA_WHEEL_SLOT_FEATURES` L67 (wheel admit) + `BETA_STANDALONE_PANEL_FEATURES` L133 (panel admit) → luôn được phép.

**Mount:** `GameRoot.vue:15` lazy `defineAsyncComponent(SkillPathPanel)`; watcher L78-100 `mountedStandalone.add(panel)` (L96) khi `isBetaStandalonePanel` (+bounce technique lock); `<SkillPathPanel v-if="mountedStandalone.has('skill')"/>` L156; idle prefetch `requestIdleCallback` L110-123.

**Rail highlight:** `NAV_ACTIVE_STANDALONE` `DongFuStage.vue:258-265` map `skill:'skill'`; `navActive` L267-278 check `ui.standalonePanel===standalone` (L274-275) → class `active` trên nút rail L453.

**Panel gate:** `SkillPathPanel.vue` (17 dòng) — `useUiStore()` + `<Transition name="th-panel-swap"><SkillSurface v-if="ui.standalonePanel==='skill'"/></Transition>` L16; comment ghi ruling S07 "skills auto-mount by pathway".

**Surface:** `SkillSurface.vue` (877 dòng) — adapter khổng lồ, wrap `<SceneDesignCanvas overlay>` chứa `<SkillFidelityScene>` + `<ConfirmModal>` respec.

**Chrome:** `SkillFidelityScene.vue` (85 dòng) — `.skill-paper-scene` `@click.self→emit('back')` (chết — xem §4); `.skill-sheet`; `.skill-head`; `<SkillConstellationPanel v-if="constellation">` else `<SkillPaperTree>`; `<SkillPaperDetails>`; footer insight + `.skill-respec v-if="isMaster"`; `.skill-preview-label` khi `preview`.

## 2. UI logic inventory

### SkillPathPanel.vue
- `ui.standalonePanel === 'skill'` (L16) — gate duy nhất. Không props/emits.

### SkillSurface.vue (adapter — toàn bộ logic nghiệp vụ)
- `CANVAS_W=710`/`CANVAS_H=445` L54-55; `FALLBACK_ICON='/assets/ui/huyen-kim/symbols/skill.svg'` L56.
- `CHILD_D = edgeLinkLength(1)` L68-69 — spacing layout, tàn dư kỷ nguyên pipe art.
- `FIRE_DESIGN_POS`/`FIRE_DESIGN_EDGES` L85-144: bố cục tay ngọn lửa.
- `ELEMENT_SPECIAL_SKILL_IDS` L148: `SPELL_KIT_IDS[*][1]` → ghế passive.
- `inBattle = useTurnBattleInfo().isBattleInProgress` L155 — gate `actionDisabled` (L651,664), `onUpgrade` early-return L809, `respecDisabled` L835, `watch(inBattle)` hủy `pendingRespec` L836, `confirmRespec` guard L841.
- `notice` + `flashNotice` L158-165: `noticeTimer` setTimeout 3200ms, clear `onBeforeUnmount`.
- `skillTree` L167-173: `progressionOps.betaSkillTreeFor(...)`.
- `pathwayRows` L197-226: lọc `state!=='scope-hidden'` + `!revealHidden` + mortal precursor theo ruling Minh.
- `visibleElements` L228-235 + `selectedElement` ref+watch L237-246 + `elements` computed L248-253 — feed props FidelityScene.
- `unlockingId` + `flagUnlock` L260-270: `unlockTimer` 1500ms, clear `onBeforeUnmount` — chỉ feed `unlocking` prop cho constellation (dormant).
- `graph` L275-299; `layout` L301-347: `base = layoutRadialGraph(...)` L302 **luôn tính** nhưng chỉ dùng khi `mortal || entries<=1` (L303); mọi element tree ghi đè toàn bộ bằng `FIRE_DESIGN_POS` (fire, L319-326) hoặc parked-column+anchor (non-fire, L327-334) → **radial compute bỏ phí cho mọi cây hành**.
- `mortalSolo`/`graphSize`/`graphFit` L354-362 (3× zoom mortal đơn lẻ; `renderExtent` ref từ `@extent`).
- `prereqReason`/`unmetReasons` L382-414 — switch chỉ emit case `node/realm/nodeCount/excludesNode/skill(+Level/CastCount/Join)/techniqueRank/techniqueGrade/skillUpgrade/cost` (L384-397,653): `lockedReasons.element/.elementMismatch/.wayMismatch` không bao giờ được gọi.
- `nodeIcon`/`nodeArtIcon`/`grantIcon` L416-439: `NODE_ICON_MANIFEST` → `SKILL_ICON_MANIFEST` (qua `turnSkillDisplayMetaOf` iconKey) → element orb `el-${tag}.png` → `FALLBACK_ICON`.
- `skillStatRows` L444-489; `infoUiNode` L494-541; `grantUiNode` L546-573; `levelContribs`/`buildLevelEffects` L580-624; `toUiNode` L626-703 (`emphasis:'normal'` L679 — live luôn normal, như mọi site L521/557/720/745).
- `basicUiNode` L709-735: **learned** (`state:'learned'` L724), tên+icon+desc thật từ `SPELL_KIT_IDS[element][0]` (Ly Hỏa Thuật); `ultimateUiNode` L736-760: mới là placeholder locked (`skill.designMode.ultimatePlaceholder`/`ultimateLocked`, `FALLBACK_ICON`).
- `nodes`/`edges` L761-789: fire → `FIRE_DESIGN_EDGES` lọc theo id render thật (L773-777); path khác → 3 pipeline `root→{DESIGN_BASIC, ULTIMATE, special}`.
- `selectedId` watch L791-796 (auto-pick `prominent`); `insightLabel` L798; `onSelectElement` L800-803; `onSelect`/`onUpgrade` L804-813 (purchase/upgrade + `flagUnlock` + `flashNotice` `skill.actionDone/actionFailed`).
- Respec L815-842: `pendingRespec`, `respecPreview` (`previewNodeRespec`), `clawbackDetailText`, `hasOwnedNodes`, `respecDisabled`, `onRespec`, `confirmRespec` + `<ConfirmModal>` (template L866-871).
- Template L846-874: `<SkillFidelityScene :nodes :edges :elements :element :selected :notice :identity :insight-label :respec-disabled :graph-size :graph-fit :unlocking>` + `@select @element @upgrade @extent @respec @back=ui.closeHomeOverlays()` — **không truyền `:constellation`**.

### SkillFidelityScene.vue (chrome — 85 dòng)
- Props đầy đủ (gồm `elements` **required**, `element` required); `constellationAccent = ELEMENT_COLOR_VARS[element]`; `isMaster` masterAccess (comment L46-47: "respec is a dev tool"); `paper = shared-paper-page-v1.png`; `useDialogFocus(rootRef, ()=>true, {onEscape→emit('back')})` L54 — contract gồm focus-on-open, Escape, Tab containment cycle, mousedown pointer-containment, focus restore (`useDialogFocus.ts:24-99`).
- **Dead:** prop `elements` + `emit('element')` declared L44 — không DOM render pill, không emit nào bắn `element`; `@element="onSelectElement"` ở SkillSurface dead-bound end-to-end (SkillPreview cũng không nút nào).

### SkillPaperTree.vue (production tree — 518 dòng)
- Backdrop `character-card-nine-slice-v2.png` L26; ruling L27: "no pipe art on links - a plain line joins each pair".
- Computeds: `connections` (lit/muted, comet), `paintNodes` (descending-y — **comment L166-168 còn nói "name/level label hangs below its disc" nhưng SkillPaperNode không render label DOM** → comment stale), `renderExtent`+`extentFreeze`, `frozenScale`/`OPEN_VIEW_SCALE=0.91`.
- `onMounted` L283-288: seed `frozenScale`, `resetViewToRoot`, emit `select` mainNode (detail card đọc ngay).
- Interactions: pointer pan (`onPointerDown/Move/Up` + capture retarget L290+), `@wheel` zoom 0.3-4, `@dblclick` reset, `@scroll="onScrollReset"` L444 (snap scrollTop/Left về 0 — tránh focus-scroll lệch vantage L276-280), `@contextmenu="onContextMenu"` L443 xóa design spawn khi `designMode` (L112-124).
- Design mode (master): `designMode = isMaster && skillDesignMode` L42-45; **`designOffsets`/`designSpawns` đọc localStorage cho MỌI user** (`skill-tree-design-pos-v1` L47-48, `skill-tree-design-spawns-v1` L94) — `spawnNodes` L125-147 trộn vào `paintNodes` L170 luôn render → key cũ lọt sẽ hiện node đóng dấu cho cả non-master.
- `.design-tools` container L468 render **vô điều kiện** (chỉ nút con gate `isMaster`/`designMode`); literals không i18n: 'Thiết Kế'/'+ Node…'/'Đã Chép'/'Xuất Bố Cục'/'Về Mặc Định' L469-476 + `DESIGN_NODE_TYPES` **13** label VN cứng L78-92. `spawnIcon = skill.svg` L95.
- Edges `.edge-line` + `.edge-flow` comet (lit); `accent` prop → `--streak`/`--streak-head` L419-425 (live, tô comet theo hành). Emits: `extent`/`select`/`activate`.
- `.skill-paper-tree` left:365/top:198/600×487 (L485).

### SkillPaperNode.vue (181 dòng)
- Frame `skill-node-${shownKind}-v1.png` L22 (kind: parent/sub/main/keystone/passive — `ICON_FIT` L30-36, `GROOVE_R` L42-48); `lock.svg` L24.
- Hold-to-activate: `pointerdown` → `window.addEventListener(pointermove/pointerup/pointercancel)` L111-113 (remove L99-101), cancel nếu move >4px (L104-105) — window-listener lifecycle đầy đủ; hold ring 0.85s → `onHoldComplete` → `suppressNextFill`.
- Selected streak 3-circle comet; upgrade fill 0.85s → `onFillEnd` → burst; `.skill-node-can` mũi xanh `!actionDisabled`; grayscale filters. Emits `select`/`activate` (click select lúc PRESS, pointer capture retarget).

### SkillPaperDetails.vue (73 dòng)
- `.skill-detail-card` left:985/top:198/400×487 (L51), `.skill-card-frame` cùng nine-slice; header icon+name+level·state; locked→'Điều Kiện' else `nextCost` (`skill.insightNeeded`) + `levelEffects` 'Hiệu Quả' `.met` gold (transition gray→gold L65-66); footer costLabel/actionHint/`skill.holdToAct`; `.skill-notice` aria-live.
- **Không `defineEmits`** → listener `@upgrade` trên `<SkillPaperDetails>` (FidelityScene L71) chết; upgrade thật đi qua hold-to-act node (`activate`→`emit('upgrade')`→`onUpgrade`).

### skill-constellation/* (production-dormant, chỉ SkillPreview dùng)
- `SkillConstellationPanel.vue` (290 dòng): `.constellation-panel` left:228/top:259/710×445 (L228-233 — **khác** slot `.skill-paper-tree` 365/198/600×487); percent positioning theo `layout.viewBox` (L51-52,73-76); `orderedNodes` theo stroke rank; design drag ghi `skillDesignOverrides['${layout.id}:${nodeId}']` + `persistSkillDesignOverrides` (L103-145); export chip `v-if=designOn` L206-211 → clipboard+console.log, label `t('devPanel.exported')` — **key thiếu trong cả 2 locale** (`devPanel` block chỉ có `exportLayout`; "exported" L1953 thuộc namespace bug-report) → render raw key; legend glyph/prereq L214-219; emit duy nhất `select` L37 — **không affordance activate/upgrade**.
- `ConstellationBackdrop.vue`: `stableParallaxStack('skill-tree')` 4 lớp (sky/far-mountains/celestial-field/atmosphere — `StableSceneArt.ts` L66,141-162) + glyph watermark + vignette, bg #0b1220.
- `ConstellationConnections.vue`: glyph-stroke paths `#d8c080`; `.connection` theo state; comet head+tail; `.unlock-flow`.
- `ConstellationNode.vue`: disc `rune-node@2x`/`dao-luan-node@2x`/`dao-luan-center@2x`; ring `scene/skill-v2/node-ring-v1.png` hoặc `controls/skill-node-passive-v1.png`; `lock.svg`, badge '✓'; label opacity 0 tới hover/focus/selected; emit duy nhất `select` (L18).

### skill-path/* remnants
- `TechniqueRuneRing.vue`: 10-rune SVG ring — chỉ import bởi `TechniqueSlotCard.vue`.
- `TechniqueSlotCard.vue`: comment L3-4 "nguoi dung duy nhat con lai la TechniquePanel.vue" — **stale**, production importer không còn (chỉ `InkWashMediumSurfaces.test.ts`; `useTooltip.ts` chỉ nhắc trong comment).
- `skillGraphLayout.ts`: `layoutRadialGraph` vẫn import L41/tính L302 nhưng kết quả bị ghi đè cho element trees (xem trên).

### Stores/state
- `ui.ts`: `standalonePanel` L151, `openStandalonePanel` L244-255, `toggleStandalonePanel` L320-331, `closeHomeOverlays` L258-263.
- `services/master/masterAccess.ts`: `MASTER_LOGIN_IDS={'admin'}`; `skill-tree-design-mode-v1` + `skill-tree-design-const-pos-v1` (`skillDesignOverrides`, `persistSkillDesignOverrides`).

### CSS global (tien-hiep-ui.css, 411 dòng)
- **Live đè lên scene mới:** `.skill-head h1` trong selector gradient-shine L135-148: `width:370px;height:58px;font-size:72px;line-height:58px` + animation `th-title-shine` (prefers-reduced-motion → `color:#8a6420` L148); `.skill-respec{border-radius:0;min-height:32px}` L223 đè scoped `border-radius:5px`; `.skill-paper-scene{pointer-events:none}>*{pointer-events:auto}` L390-411 + `SceneDesignCanvas` overlay `pointer-events:none` L41-42 → `@click.self` backdrop-dismiss **chết 2 lớp**.
- **Live:** `.th-panel-swap-*` L373-378 — dùng bởi `<Transition name="th-panel-swap">` SkillPathPanel L16 (KHÔNG phải dead rule).
- **Dead (không DOM match — exact-class grep 0 hit):** `.skill-paper` L25/133/177/253-256/278/344; `.skill-heading` L134/150/217; `.skill-elements` L216; `.skill-paper-details` (+`.skill-detail-body` compound) L218/221; `.skill-info-frame` L219; `.skill-meta` L222; `.skill-upgrade` L237-238.

## 3. Art map

| Asset | Element | Trạng thái |
|---|---|---|
| `source/shared-paper-page-v1.png` | `.skill-sheet` bg | live |
| `controls/character-card-nine-slice-v2.png` | `.skill-paper-backdrop`, `.skill-card-frame` | live |
| `controls/skill-node-{parent,sub,main,keystone,passive}-v1.png` | `.skill-node-frame` (`frameKind`) | live |
| `controls/skill-node-spare-v1.png` | — không `frameKind`/code nào map 'spare' | dead art |
| `controls/skill-connection-pipe-v1.png` | warmed `AssetBundleCatalog` L663; render bởi `ui-preview/HomeSkillArtPanel` | preview-live, production-dead |
| `controls/skill-connection-pipe-v2.png` | warmed L664, 0 ref khác | dead hoàn toàn |
| `icons/navigation-skill-v2.png` | rail icon `icons/navigation-${id}-v2.png` `DongFuStage.vue:458` | live |
| `huyen-kim/symbols/skill.svg` | wheel glyph (`SLOT_SYMBOL`→`symbolUrl`), `FALLBACK_ICON`, `spawnIcon` | live — 3 vai trò |
| `huyen-kim/nodes/{rune-node,dao-luan-node,dao-luan-center}@2x.png` | `ConstellationNode` disc | dormant |
| `huyen-kim/scene/skill-v2/node-ring-v1.png` | `ConstellationNode` ring | dormant |
| `controls/skill-node-passive-v1.png` | `ConstellationNode` passive ring + paper frame kind 'passive' | dormant + live |
| `stableParallaxStack('skill-tree')` 4 layer | `ConstellationBackdrop` | dormant |
| `skills/nodes/*` (11 file) | `NODE_ICON_MANIFEST` (23 entry, kể cả reuse art cho minor) | live |
| `skills/*.png` (`SKILL_ICON_MANIFEST` 15 key: 3 precursor + 5 basic + 5 special + 2 ẩn) | grant/info icon | live phần lớn; **`hoa_an.png`, `hoa_cau_thuat_empowered.png`, `tam_muoi.png` không manifest nào trỏ** |
| `elements/el-*.png` | element orb fallback `nodeIcon` + `elements` pills feed (không render) | live (orb) / dead-bound (pill) |
| `huyen-kim/symbols/lock.svg` | `.skill-node-lock`, `ConstellationNode` | live + dormant |

(`SkillIconManifest.ts`: `SKILL_ICON_MANIFEST` 15 key L6-30, `NODE_ICON_MANIFEST` 23 entry L36-65, `skillIconPath()` helper L67-73.)

## 4. Conflicts / layers

- **Hai hệ cây kỹ năng cùng tồn tại:** production đi `SkillPaperTree` (đường thẳng + comet); `SkillConstellationPanel` (glyph 火, viewBox 480×300, **23 point / 21 stroke**) chỉ sống trong `ui-preview/SkillPreview.vue` — `SkillSurface` không truyền `:constellation`; `skillConstellationLayoutFor` (L122-127) có **0 caller toàn repo** (probe test + SkillPreview import thẳng `SKILL_CONSTELLATION_LAYOUTS`). Probe test ghi "(SkillSurface only renders the paper tree)".
- **Hai bố cục lửa song trùng:** `FIRE_DESIGN_POS`/`FIRE_DESIGN_EDGES` (SkillSurface L85-144, live) vs `FIRE_CONSTELLATION` (`SkillConstellationLayouts.ts` L48-114, dormant) — cùng nodeId, tọa độ khác nhau.
- **Global đè scoped (live):** `.skill-respec` global `border-radius:0` thắng scoped `5px`; `.skill-head h1` global 370×58px/72px ngồi trong `.skill-head` band scoped 1011×61 — box vừa chiều cao (58<61), title cố định 370px trong dải 1011px.
- **Rừng luật chết cho DOM đã đổi tên** — exact-class 0 hit: `.skill-paper` (6+ rule), `.skill-heading`, `.skill-elements`, `.skill-paper-details`+`.skill-detail-body`, `.skill-info-frame`, `.skill-meta`, `.skill-upgrade`. (`.skill-detail-body` tồn tại trong DOM nhưng selector compound `.skill-paper-details .skill-detail-body` vẫn chết.)
- **Backdrop-dismiss câm 2 lớp:** `.skill-paper-scene{pointer-events:none}` (css L391) + `SceneDesignCanvas` overlay viewport/canvas `pointer-events:none` (L41-42) → `@click.self` L57 không bao giờ fire; `.skill-sheet`/`>*{auto}` nuốt click lên giấy không dismiss. Chỉ Escape + click nền DongFuStage đóng được (đúng ý đồ rail fix L385-389).
- **Slot lệch:** `.constellation-panel` left:228 < sheet left:345 → nếu nối sẽ tràn trái khỏi giấy; comment "Same frame slot as .skill-paper-tree" trong file là stale.
- **Hai design-mode store:** paper `skill-tree-design-pos-v1`/`spawns-v1` (đọc ungated cho mọi user) vs masterAccess `skill-tree-design-mode-v1`/`skill-tree-design-const-pos-v1` — song song, không merge.
- **Orphaned components:** `TechniqueSlotCard`+`TechniqueRuneRing` — chỉ test giữ sống; comment "TechniquePanel.vue" stale.
- **Locale mồ côi (tồn tại nhưng 0 caller):** `panels.skillPath.colTitles/elementTabs/centerTabs/list/detail/roleStrip`, `nodeInspector.upgradeGateHeader`, `nodeInspector.lockedReasons.element/.elementMismatch/.wayMismatch` (switch không emit case tương ứng), `skill.elements/infoCasts/levelLabel/navigation`. **`devPanel.exported` thiếu hẳn** → raw key leak khi export chip bấm (dormant+master).
- **`usePaperNavigation` chết hoàn toàn** (0 caller) — rail preview dùng `previewPaperNavigation()` riêng.

## 5. Logic không có hình ảnh

- **`elements` prop (required) + `emit('element')` + `onSelectElement` + `visibleElements`/`selectedElement`/`elements` computed:** feed đủ nhưng không DOM pill nào (kể cả SkillPreview — `chooseElement` L62 dead-bound) → không đổi element được trong UI; `.skill-elements` global treo không.
- **`unlockingId`/`flagUnlock`/`unlockTimer`:** chỉ feed `unlocking` → `SkillConstellationPanel` (dormant); `SkillPaperTree` không nhận — unlock animation live chạy theo level change của node, không theo unlockingId.
- **`emit('element')` declared L44:** không emit nào gọi.
- **`@upgrade` listener FidelityScene L71:** `SkillPaperDetails` không `defineEmits` → listener chết.
- **`emphasis`:** live luôn 'normal' (5 site); 'major'/'root' chỉ từ constellation points.
- **`basicUiNode`:** seat learned với data thật (Ly Hỏa Thuật) — không phải placeholder; **`ultimateUiNode`:** locked placeholder không data.
- **`edgeLinkLength`/`EDGE_PIPE_*` (skillUi.ts L59-70):** chỉ cho `CHILD_D` spacing, không vẽ gì (comment còn nói "pipe art" — tàn dư).
- **`constellationAccent`/`accent`:** live cho `--streak`/`--streak-head` (comet node trên paper tree); `--constellation-accent` chỉ constellation panelStyle (dormant).
- **`layoutRadialGraph` compute:** bỏ phí cho mọi element tree (vị trí ghi đè hết).
- **`spawnNodes`/`designOffsets` load ungated:** render cho mọi user nếu key localStorage còn — logic design-mode lộ ra ngoài master.
- **Respec `v-if="isMaster"`:** toàn chuỗi pendingRespec/preview/clawback/ConfirmModal render-ready nhưng player thường không thấy nút — dormant với non-admin.
- **`useTribulation` seam:** `openStandalonePanel(result.standalonePanel)` — 'skill' không trong outcome hiện nay (chỉ 'quan_khi'), seam lý thuyết.
- **`skillConstellationLayoutFor`/`usePaperNavigation`:** 0 caller — logic export chết.

## 6. Hình ảnh không có logic

- **`skill-node-spare-v1.png`:** file tồn tại, không `frameKind` nào map 'spare'.
- **Pipe art v2:** warmed nhưng 0 render; **v1** chỉ render trong preview `HomeSkillArtPanel`.
- **`.design-tools` row + `DESIGN_NODE_TYPES` palette:** render container luôn; nút chỉ master — tooling nội bộ, string VN cứng không i18n.
- **`.skill-preview-label`:** chỉ khi `preview` prop.
- **`.skill-node-can`:** mũi xanh bounce trang trí `!actionDisabled`.
- **`.skill-sheet`:** `aria-hidden` background; `pointer-events:auto` nuốt click không dismiss (xem §4).
- **`ConstellationBackdrop` 4 lớp parallax:** stack render tĩnh, motion metadata không ai tiêu thụ (panel dormant).
- **`HomeSkillArtPanel` (ui-preview):** cả skill tree thứ ba (pipe art + `SkillNodeArtButton` + element nav riêng) — demo thuần.
- **`paintNodes` descending-y comment:** nói về label DOM đã bị gỡ — comment-only artifact.
- **`devPanel.exported` chip:** UI render sẵn nhưng key locale thiếu → literal 'devPanel.exported' hiện khi bấm.

## 7. Open questions

1. **Constellation:** nối hay xóa? Nếu nối: sửa `.constellation-panel` về slot 365/198/600×487, chọn MỘT tọa độ (FIRE_DESIGN_POS ≠ FIRE_CONSTELLATION), **và bổ sung đường activate/upgrade** — hiện panel chỉ emit `select` (không hold-to-act).
2. **`.skill-respec` global `border-radius:0` đè scoped `5px`** — ý đồ hay rơi? `.skill-head h1` 72px/370px trong band 1011×61 (58px box vừa) — chấp nhận hay chỉnh?
3. **Luật chết global + locale mồ côi:** dọn `.skill-paper*`/`.skill-heading`/`.skill-elements`/`.skill-paper-details`/`.skill-info-frame`/`.skill-meta`/`.skill-upgrade` + orphan keys (`colTitles/elementTabs/centerTabs/list/detail/roleStrip/upgradeGateHeader/lockedReasons.element*/skill.elements/infoCasts/levelLabel/navigation`) hay giữ cho reskin kế? (`th-panel-swap-*` giữ — đang live.)
4. **Element pills:** có phải thiết kế định có pill hành trên scene? Logic feed đủ nhưng 0 DOM — không chuyển element được trong Công Pháp.
5. **Backdrop-dismiss:** `@click.self` chết — xóa handler hay đổi sang child overlay? `.skill-sheet` nuốt click — quyết hành vi click-ngoài-đóng.
6. **Respec gate `isMaster`:** ra player hay giữ dev-only? Chuỗi confirm+clawback đã nằm production.
7. **Orphan art/components:** `skill-node-spare-v1.png`, pipe v2 (v1 preview), `TechniqueSlotCard`+`TechniqueRuneRing`, `HomeSkillArtPanel` — dọn hay để preview?
8. **Design-mode song song + ungated load:** chuẩn hóa một store nếu constellation sống; và `skill-tree-design-pos/spawns-v1` đọc cho mọi user — gate theo `isMaster`?
9. **`devPanel.exported` thiếu key** + design strings VN cứng (13 type + toolbar) — thêm locale hay để literal?
10. **`usePaperNavigation` (0 caller) + `skillConstellationLayoutFor` (0 caller) + `layoutRadialGraph` compute bỏ phí:** dọn dead code?

## Adjudication

**Missed (18) — ACCEPT tất cả, 2 chỉnh số:**

| # | Finding | Verdict | Note |
|---|---|---|---|
| 1 | `skill.svg` fallback/spawn icon thiếu trong art map | ACCEPT | L56,419,716,741 SkillSurface + L95,131 PaperTree; thêm vai trò wheel glyph (`symbolUrl`) |
| 2 | Timers `noticeTimer`/`unlockTimer` | ACCEPT | 3200ms L163, 1500ms L265-269, clear cả hai onBeforeUnmount |
| 3 | `useTurnBattleInfo` gating | ACCEPT | L155; thêm `onUpgrade` guard L809 + `confirmRespec` L841 ngoài cites reviewer đưa |
| 4 | Window pointer listeners SkillPaperNode | ACCEPT | L99-113 |
| 5 | `onMounted` PaperTree (seed frozenScale + emit select) | ACCEPT | L283-288 |
| 6 | `@contextmenu`/`@scroll` handlers | ACCEPT | L443-444, L112-124, L276-280 |
| 7 | `devPanel.exported` thiếu key | ACCEPT | `devPanel` block không có `exported`; L1953 là namespace bug-report khác |
| 8 | Hardcoded VN strings | ACCEPT | nhưng `DESIGN_NODE_TYPES` = **13** type (reviewer ghi 12) |
| 9 | `layoutRadialGraph` tính-xong-bỏ | ACCEPT | L302-346 |
| 10 | `NAV_ACTIVE_STANDALONE` rail highlight | ACCEPT | L258-265,274-275,453 |
| 11 | `useDialogFocus` > Escape | ACCEPT | focus-on-open, Tab cycle, mousedown containment, restore |
| 12 | `.design-tools` container render luôn | ACCEPT | L468 |
| 13 | designOffsets/designSpawns load cho mọi user | ACCEPT | L47-48,94 — spawnNodes trộn paintNodes L170 không gate |
| 14 | `paintNodes` comment stale | ACCEPT | L166-168; SkillPaperNode chỉ aria-label, không label DOM |
| 15 | Constellation không activation affordance | ACCEPT | chỉ `select` emit (panel L37, node L18) |
| 16 | SkillPreview `@element` dead-bound | ACCEPT | L67 không nút element nào |
| 17 | SceneDesignCanvas overlay pointer-events:none | ACCEPT | L41-42 — kill 2 lớp |
| 18 | `SkillIconManifest.ts` chưa inventory | ACCEPT | nhưng `NODE_ICON_MANIFEST` = **23** entry (reviewer ghi 24) |

**Wrong (7) — ACCEPT 6, REJECT 1:**

| # | Claim | Verdict | Note |
|---|---|---|---|
| 1 | `betaScopeSurface` chỉ có 2 `skill:` (L67 wheel, L133 standalone) | ACCEPT | L165 cite invalid — report sửa thành "L67/L133" |
| 2 | FIRE_CONSTELLATION **23 point/21 stroke** | ACCEPT | đếm tay L53-82 / L87-112; report ghi "21 point 22 stroke" sai cả hai |
| 3 | `basicUiNode` = learned seat data thật | ACCEPT | L713-735 (`state:'learned'`, tên/icon/desc Ly Hỏa Thuật); chỉ `ultimateUiNode` là placeholder locked |
| 4 | Radial bị ghi đè cả non-fire | ACCEPT | L327-334 parked+anchor; radial chỉ sống khi `mortal \|\| entries<=1` |
| 5 | "Phantom locale keys không tồn tại" | **REJECT** | Keys TỒN TẠI tại `panels.skillPath.nodeInspector.lockedReasons.element/.elementMismatch/.wayMismatch` (vi:294-296, en cùng) và ĐÚNG là orphan — switch L384-397 không emit case tương ứng. Report giữ, sửa path thành `lockedReasons.*` |
| 6 | `pipe-v1` preview-live | ACCEPT | `HomeSkillArtPanel` `<image>` render v1; chỉ v2 dead hoàn toàn |
| 7 | Cite drift (ExplorationSurface L86, useTribulation L104-108, masterAccess path) | ACCEPT | sửa trong report |

**Lỗi reviewer tự gây (bắt được khi verify):**
- `th-panel-swap-*` L373-378 bị xếp "dead rules" — **SAI**: `<Transition name="th-panel-swap">` SkillPathPanel L16 đang dùng đúng các class đó → live. Report gốc chỉ liệt kê trung lập, không gọi là dead.
- `NODE_ICON_MANIFEST` "24 entries" → đếm thực 23; `DESIGN_NODE_TYPES` "12" → đếm thực 13.
- Reviewer không bắt được: `usePaperNavigation()` **0 caller** (dead composable, sâu hơn "preview-only") và `skillConstellationLayoutFor` **0 caller** (test cũng import map trực tiếp).
- Đã kiểm lại nghi vấn `navigation-skill-v2.png`: **live đúng** — `DongFuStage.vue:458` render `icons/navigation-${id}-v2.png`; wheel dùng `skill.svg` (route khác).
