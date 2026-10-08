# Review findings — audit report 'Wheel cũ' @ devin/artui-c0-foundation (8ffc8e64)

Review read-only, đối chiếu từng claim với code tại snapshot.

## Wrong

1. **`data-wheel-slot` KHÔNG phải "marker chết"** — report ghi "không consumer nào grep được" (§2) và hỏi "cần cho test/tương lai hay xoá?" (§7.7). Thực tế nó là test hook chính của cả suite: ~40 locator trong `tests/e2e/*.spec.ts` (helpers.ts:113, beta-journey.spec.ts:144,159,249, create-to-combat.spec.ts:28, presentation-routing.spec.ts:25, save-reload.spec.ts:108, system-ui.spec.ts:33, ui-audit-progression-fixed.spec.ts:83, v.v.) + `tests/architecture/betaConsumerLeak.probes.test.ts:127` (`[data-wheel-slot="character"] .df-node__badge`) mount **DongFuStage thật** (:21) để test badge breakthrough. Xoá attr này = gãy hàng chục e2e/arch test. Đây là lỗi sai nặng nhất vì nó đổi kết luận "dead code" của report.
2. **Sai số lượng slot catalog**: `COMMAND_WHEEL_SLOTS` có **15 slot** (commandWheelCatalog.ts:88-245: 3 ring1 + 5 ring2 + 5 ring3 + 2 ring4), report ghi "13 slot". Phần kết luận "live wheel = 10 slot" thì đúng (15 − 4 feature-bound bị `betaWheelSlots` lọc − `talisman_slot` NEVER_AVAILABLE).
3. **Sai số item rail**: `NAV_ITEMS` = 16 + 5 locked = **21 item** (DongFuStage.vue:203-208), report ghi "20 item".
4. **Cite lệch (claim đúng, dòng sai)**: bằng chứng "orb character không is-active" được gán `ui.ts:206-216` — đó là nhánh `toggleLeft`; nhánh tương đương trong `openLeftPanel` (thứ wheel thật sự gọi qua `activateSlot`→`ui.openLeftPanel`) nằm ở ui.ts:228-237. Kết luận đúng (`leftPanelMode==='character'` không bao giờ true vì 'character' route qua `characterOverlayOpen`), chỉ số dòng trỏ sai hàm.
5. **`useStageActive.ts` trích dẫn ":1-30"** — file chỉ 20 dòng; nội dung claim (route combat/tribulation) đúng.
6. **Nuance bị phóng**: `badge:'upgrade'` trong union `DongFuUiAction` (dongFuUi.ts:23) không hẳn "góc chết trong type union" — comment type tự ghi "(building plaques only)" và `DongFuUiBuilding extends DongFuUiAction` (:27) dùng nó cho `df-building__upgrade` (DongFuHomeContent.vue:55-64, có test DongFuHomeContent.test.ts). Phần đúng: `slotBadge` (DongFuStage.vue:144-153) không bao giờ trả 'upgrade' + `DongFuWheel.vue:67-69` không có CSS `--upgrade` → trên node wheel nó unreachable. Kết luận thực tế của report đứng, nhưng diễn giải "type union chết" hơi quá.
7. **`DongFuFidelityScene.vue:5` cũng ghi sai giống HomeContent**: comment "Production mounts the same content through DongFuStage" — production không mount (DongFuStage.vue:39-41 chỉ import Wheel/Board/type). Report bắt được comment sai của DongFuHomeContent.vue:3-4 nhưng sót comment sai cùng ý ở file wrapper.

## Missed

**Logic/listener sống trong DongFuStage.vue (file chính của scope, report chỉ inventory phần wheel):**
1. `notice`/`flashNotice`/`noticeTimer` — ref + `window.setTimeout` 3200ms (:82-95) + fallback `flashNotice(t('dongFu.unhandled'))` khi id không route được (:358) + style `.df-notice` scoped :568-569 + `:empty{display:none}` :569. Report nhắc element `.df-notice` :493 và covered-rule :566-567 nhưng sót cả producer (timer là "live interval" trong scope) lẫn nhánh unhandled — mà nhánh này chính là hệ quả của conflict #9 (router nuốt id).
2. `watch(surfaceOpen, open => feedbackOpen=false)` :67-69 — cơ chế loại-trừ-lẫn-nhau giữa dialog và panel.
3. `boardOpen = ref(true)` :61 — Thiên Cơ Bảng **mở sẵn** khi vào home (preview cũng `shallowRef(true)`, DongFuFidelityScene.vue:16) — trạng thái UI kề wheel bị bỏ qua.
4. Rail collapse: `railCollapsed`/`railIndicator` :62-63, `toggleRail` :71-76, `onRailTransitionEnd` :78-80 + listener `@transitionend` :446, nút `«`/`»` :462-479, Tab toggle :389-393 — report chỉ gom "Tab rail" một dòng.
5. **`INTERACTIVE_SELECTOR` + `data-df-ui`**: :364 định nghĩa vùng "interactive" (`button, a, input, select, textarea, [role=button], [data-df-ui]`); các chrome `home-design-profile`/`home-design-currencies`/`home-navigation-surface`/`df-notice` mang `data-df-ui` (:421,:428,:446,:493) → click lên chúng không đóng wheel/panel. Cơ chế quyết định đường đóng của wheel mà report không phân tích.
6. **Hit-test của wheel**: `.df-wheel` và `.df-node` đều `pointer-events:none`, chỉ `.df-node__orb` auto (DongFuWheel.vue:58,64,65) → click vào vùng trống BÊN TRONG vành wheel rơi xuống `<main>` → `onSceneClick` → `ui.closeHomeOverlays` → đóng wheel. Tức "click nền trống đóng" áp cả cho khoảng trống giữa các orb — nuance hành vi report không ghi.
7. Mounts trong scene bị sót: `AutoFarmIndicator` (:38, :492), `FeedbackDialog` (:37, :497, đi kèm `feedbackOpen` ref :60), `pc-paper-scene__frame` overlay trang trí (:494).

**Art chưa map (scope chrome):**
8. Backdrop production thật của wheel: `sceneBackground = world-vista-warm-v1.png` (:191, qua `sceneStyle` :418) — report map `rear.png/foreground.png` (đúng là preview-only) nhưng không map ảnh nền production mà wheel nổi lên.
9. Rail art (đối thủ song song của wheel, conflict #1): `navigation-medallion-v1.png` qua `--home-nav-art` (:195, dùng :538), `navigation-backing-dark-v3.png` (:197/:447), icon `navigation-{id}-v2.png` ×21 (:458) — report chỉ map seam (:198/:471).
10. Currency/avatar art: `pcPaperIconUrl('character')` avatar (:422), `pcPaperResourceUrl` crystal/jade/coin/essence (:298, :430).

**Global CSS sót:**
11. `pc-paper-production.css:67-69` — `:is(#app,body) :is(.hk-art-scene, .hk-art-scene *, ...::before/::after) { box-sizing: border-box }` — áp lên TOÀN cây scene vì root mang class `hk-art-scene` (DongFuStage.vue:414), import global ở main.ts:11. Report chỉ audit `tien-hiep-ui.css`.
12. `tien-hiep-ui.css` block "Rail over panels" (~:385-411): `:is(#app,body) .cf-scene,.skill-paper-scene,... { pointer-events:none }` + `> * { pointer-events:auto }` — đổi hit-test của MỌI overlay scene để click backdrop lọt xuống `onSceneClick` → `closeHomeOverlays` (đóng luôn wheel). Ảnh hưởng trực tiếp đường đóng trong scope.
13. `tien-hiep-ui.css:198` `.df-scene .df-node__orb { transition:none }` — nằm trong `@media (prefers-reduced-motion:reduce)` (:197-199) → không đè scoped transition :65 trong điều kiện thường; claim "transition sống" của report vẫn đúng nhưng nên ghi nhận rule này (tương đương scoped :78). Còn `.df-cultivator .player-portrait` :63-64 nhắm markup `PlayerPortrait` mà preview cultivator là `<img>` thuần — rule không trúng ai.

**Consumers/contract khác:**
14. `symbolUrl` (dongFuUi.ts:12-14) có consumer SỐNG ngoài cây wheel: `usePaperNavigation.ts:17`, `CharacterFidelityStats.vue:7` — file không thể xoá theo wheel; report gói dongFuUi.ts trong "wheel scope" mà không ghi nhận điều này.
15. `navActive` :270-271 đã xử lý đúng case character (`ui.characterOverlayOpen && ui.characterSceneTab === id`) — tức rail đã có fix cho chính bug mà report phát hiện ở `slotActive` (:133-142); đối chiếu này làm finding #5 sắc hơn.
16. Test consumers giữ wheel API sống: `src/stores/ui.test.ts` (isCommandWheelOpen/toggle), `src/presentation/audio/uiAudioBinding.test.ts` (wheel cues), `betaConsumerLeak.probes.test.ts`, ~30 e2e spec — report chỉ liệt kê DongFuWheel.test.ts + DongFuHomeContent.test.ts + 2 test CharacterPanel.
17. `RELEASE_UNAVAILABLE_REASON` (commandWheelCatalog.ts:75) có export cho boundary test `ReleasePolicy.artifactDeferred.test.ts` (comment :73-74) — UI path unreachable (đúng như report) nhưng symbol không chết hoàn toàn.
18. `DongFuBoard` mount ở CẢ hai đường: preview qua DongFuHomeContent.vue:85-91 (kèm emit `toggleBoard`, prop `occluded`) và production :486-491 — §1 của report liệt kê mount-chain preview chỉ có wheel (:76-81), sót board dù các mục khác coi nó là live.
19. `PlayerPortrait` (CharacterFigureWheel.vue:6,:105-109) vẫn live ở `ArtifactOverview.vue` — cụm chết là scene nhân vật cũ, component portrait không chết theo.
20. `data-hk-scene="dong-fu"` / `hk-art-scene` attrs (:414-415) — hook định danh scene chưa được liệt kê (liên quan #11).

## Verified-ok

Đã đối chiếu đúng file:dòng:

- Mount chain production: main.ts :59 (installTienHiepUiAssets), :66 (vTooltip), :61-81 mount; App.vue→GameRoot (:1293)→MainScene (:138) → `DongFuStage` components/game/MainScene.vue:18 → `SceneDesignCanvas v-if="!stageActive"` (DongFuStage.vue:412) → `<DongFuWheel>` :480-485 (`open=ui.isCommandWheelOpen` :483, `selected=null` :482) → `v-show` (DongFuWheel.vue:34). `useStageActive` trả route combat/tribulation.
- Đường mở duy nhất: Backquote `ui.toggleCommandWheel` (:397-400, gate `!stageActive&&!surfaceOpen&&!feedbackOpen`); `toggleCommandWheel`/`closeCommandWheel` chỉ được gọi từ DongFuStage (:333,:382,:399) — verified bằng grep; Escape :381-383; `onSceneClick`→`closeHomeOverlays` :366-369 + ui.ts:258-263; store `isCommandWheelOpen` ui.ts:135, comment cũ :132-133, `toggleCommandWheel` :265-274, `closeCommandWheel` :276-278.
- Preview chain: ui-preview/dong-fu.ts:14 mount → DongFuPreview.vue:42 `<DongFuFidelityScene>` → :27-36 `<DongFuHomeContent>` → :76-81 `<DongFuWheel>`; `wheelOpen=shallowRef(true)` :15; `df-cultivator` toggle :68-75; fixture `claimable:false` :34.
- DongFuHomeContent CHỈ preview: consumers = DongFuFidelityScene.vue:10,27 + test :12; DongFuStage.vue:39-41 chỉ import Wheel/Board/type — claim "comment :3-4 sai" đúng.
- Wheel B dead: CharacterPanel.vue (panels/) :2,:11 → CharacterScene.vue :4,:20 → CharacterFigureWheel; không importer production nào ngoài 2 test (stats.test.ts:10, betaScope.test.ts:15); mount thật = LeftPanel.vue:17 → CharacterSurface.vue:33,:277 → CharacterFidelityScene → CharacterFidelityIdentity.vue:32 → CharacterFidelityFigure (EntitySpriteCanvas :15,:37); comment "five element discs were removed" CharacterSurface.vue:8; CharacterPreview.vue:6,:96 dùng fidelity.
- DongFuWheel.vue inventory: 79 dòng; props :5, emit :6, nodes :17-27 (RING_RADIUS=187 :14, tâm 210 :15, step 360/N :18), activate :28-31, class bind :40, `:style` :41, symbolUrl :51, badge :51 + CSS chỉ dot/alert :67-69, `data-wheel-slot` :48, i18n :34,:53.
- DongFuStage adapter: disabledContext :100-107, renderedSlots :109, SLOT_SYMBOL :111-127, slotDisabledReason/slotActive/slotBadge :129-153, wheelActions :166, activateSlot :330-345 (cue :332, close :333), onWheelAction :347-359 (entry ưu tiên :348-352), keyboard :380-401, surfaceOpen :56-58, mount/unmount keydown :403-408.
- `slotBadge` alert qua `canTriggerBreakthrough` :145, dot qua building ready/upgradeable :148-151 — đúng.
- Orb character không is-active: catalog :94 `target={kind:'left_panel',mode:'character'}` → `slotActive` :135 so `leftPanelMode==='character'`; `openLeftPanel` route 'character'→`characterOverlayOpen` :228-237 → bất khả. Claim đúng.
- Rail/wheel song song: comment :5 "command wheel stays mounted alongside (Backquote) pending its redesign"; rail :448-461; cue `ui.wheel.select` dùng cho rail :282.
- dongFuUi.ts: DONG_FU_ART :5-10, frameMetadata :2,:11, symbolUrl :12-14, interfaces :15-59, badge union :23.
- Catalog: ring field :19, comment 4-vòng :77-87, header stale :5-7 ("hotspot layer" không còn — stage không render `df-building`), RING_3_BUILDING_IDS :248-250 không importer, `commandWheelOrbit.ts` dead (chỉ manifest QA + comment frontendImportDirection.test.ts:96), talisman NEVER_AVAILABLE :154 (def :67), RELEASE_UNAVAILABLE_REASON :75, realmReleaseUnreachable qua 3 slot scope-hidden :137,:171,:188 — unreachable trong beta.
- betaWheelSlots :~92-94 + BETA_WHEEL_SLOT_FEATURES :~64-80 (phap_bao/formation/companion/chi_hien bound); BETA_FEATURES all false (betaFeatureFlags.ts:31-43) → 10 slot live đúng như liệt kê.
- uiAudioBinding.ts:61-62 wheel open/close cue, flush:'sync' :67; cues `ui.wheel.*` tồn tại AudioCueManifest.ts:261-263.
- Art: 53 file .svg trong public/assets/ui/huyen-kim/symbols/ (gồm technique.svg, mọi id trong SLOT_SYMBOL resolve được); `orb-frame` TienHiepUiAssets.ts:9; global override `tien-hiep-ui.css:65-70` đè scoped orb (higher specificity) — đúng; `.df-building` !important :152-166; `.df-board` 4 lớp :74-79,:228-230,:260-261,:352; `.df-location` :71-73,:176,:226-227; `.df-quest` :235,:270-271; `.df-cultivator` :62-64; `.df-vista__front` display:none :61; `.df-scene--covered` ẩn board+notice :566-567, không có rule cho `.df-wheel` (đúng — wheel đóng qua store).
- Wheel B: el-*.png + el-formation-*.png + banner-*.png tồn tại (public/assets/ui/elements/), warm ở AssetBundleCatalog.ts:546-560; computed :27-67 đúng; v-tooltip 'element' ×6 (:97,:114); producer 'element' duy nhất — `ElementTooltipContent` useTooltip.ts:186-199 + CSS banner Tooltip.vue:~313-320 đúng là mồ côi producer.
- CurrencyHud.vue → DongFuResourcePill.vue (hud/) — không mount ngoài test (MaterialBagSection chỉ là comment :129); production strip = home-design-currencies + PcPaperButton :428-432.
- `useDialogFocus` Tab stopPropagation :46-48 — defensive đúng; consumers = mọi fidelity scene.
- `home-navigation-landscape-seam` v-if surfaceOpen :471; i18n keys `dongFu.*` + `panels.wheel.slots.*` (15 key) tồn tại trong vi.json.