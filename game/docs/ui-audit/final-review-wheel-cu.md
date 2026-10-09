## Missed

1. **`toggleLeft` — store action chết trong cùng seam mở-panel của wheel** (`src/stores/ui.ts:199-224`). Grep toàn `src/` + `tests/`: không caller nào — chỉ định nghĩa và 1 comment ở `tests/architecture/betaScopeRenderedTokens.test.ts:145`. Là sibling legacy của `openLeftPanel` (:226-241) mà wheel/rail thực sự gọi. Report liệt kê `isCommandWheelOpen`/`toggleCommandWheel`/`closeCommandWheel`/`closeHomeOverlays`/`openLeftPanel` nhưng bỏ sót action chết này trong cùng cơ chế.

2. **`isEditableTarget` guard** (`DongFuStage.vue:371-378`, dùng ở :386) — chặn wheel/rail toggle khi đang gõ trong input/textarea/contenteditable. Bảng inventory §2 liệt kê `onKeydown` nhưng bỏ sub-guard này.

3. **Emit `upgrade` của `DongFuHomeContent` bắn vào hư không trong preview.** `DongFuFidelityScene.vue:33-35` chỉ bind `@action`/`@toggle-wheel`/`@toggle-board` — không ai nghe `upgrade` (declare HomeContent :35, fire :61-63). Nút `df-building__upgrade` (:54-64) click trong preview không làm gì; chỉ `DongFuHomeContent.test.ts` bind `onUpgrade` (:52). §4.10 nói union/badge consumer đúng nhưng không ghi emit chết này.

4. **Prop `occluded` chết** (HomeContent :23-27, dùng :86,:98): consumer duy nhất `DongFuFidelityScene` không truyền → luôn `false` → `v-show="!occluded"` luôn hiện. Report nhắc "`DongFuBoard` kèm `occluded`" nhưng không nói không ai feed.

5. **`tien-hiep-ui.css:69` `.df-node__orb img { width:36px }`** — lớp đè global thứ hai lên orb (icon scoped 40px → 36px), sót giữa cite :65-68 và :70 trong §3.

6. **`NAV_FEATURE_LOCKED` + `navLocked`** (`DongFuStage.vue:214-221`): 'formation' render locked qua `isBetaStandalonePanel('tran_phap')` → rail hiển thị **6** nút khóa (5 `NAV_LOCKED` + formation), không phải "5 locked" như §4.1. Kèm maps `NAV_TARGET`/`NAV_ACTIVE_PANEL`/`NAV_ACTIVE_STANDALONE` (:226-265) — bảng route rail↔panel mà claim "mở CÙNG panel" dựa vào — chưa được liệt kê.

7. **Lớp click-through thứ hai của overlay**: `.scene-viewport--overlay` + `.scene-design-canvas` `pointer-events:none` (`SceneDesignCanvas.vue:41-42`) — cùng cơ chế với rule rail-over-panels :381-411 nhưng ở tầng canvas; §3/§4.14 chỉ gán cho global CSS.

8. **`slotBadge` bỏ status `active`**: `getBuildingStatus` (`useBuildingNavigation.ts:80-104`) trả 'active' khi pill_room có job đan chạy, nhưng `slotBadge` (:144-153) chỉ map ready/upgradeable→'dot' → wheel không báo building đang chạy — khác biệt status coverage không được ghi.

9. **Trivia-level**: `pc-paper-scene.css` import ở `DongFuStage.vue:33` (nguồn rule `.pc-paper-scene__frame` :15 dùng ở :494) chưa cite; `KIND_SYMBOL` (:170-176) + `ctaKey ?? 'dongFu.view'` fallback (`DongFuBoard.vue:18`) chưa liệt kê; `df-preview-stamp` (FidelityScene :37,:48-49); `realmName` (:296); e2e `helpers.ts:111` comment "Tab to open command wheel" trong khi :113 thực bấm `` ` `` — comment cũ trên chính đường mở wheel.

## Wrong

1. **Enumerate test-importer của `CharacterPanel` thiếu 2 file**: report ghi "chỉ `CharacterPanel.stats.test.ts:10` và `CharacterPanel.betaScope.test.ts:15`" — thực tế còn `tests/architecture/b18ConsumerHonesty.qa.test.ts:20` và `tests/architecture/betaConsumerSeamsB8.qa.test.ts:39` (cả hai đều `import CharacterPanel`). Kết luận "chết trong production" vẫn đúng, nhưng lập luận §4.8 "coverage ảo" thực ra còn rộng hơn report nói.

2. **`elementBannerUrl` cite lệch 2 dòng**: report ghi `Tooltip.vue:78` — khai báo computed ở **:76** (:77-79 là thân). Block CSS đã được adjudication sửa đúng (:304-325 ✓).

## Verified-ok

- **Mount chain production**: main.ts:59/:66/:82 → App.vue:1293 → GameRoot.vue:4 → MainScene.vue:18 → DongFuStage.vue:412 → DongFuWheel :480-485. `isCommandWheelOpen` (ui.ts:135) chỉ bị viết bởi 3 caller duy nhất trong DongFuStage (:333,:382,:399) — Backquote thật sự là đường mở duy nhất.
- **Wheel live = 10 slot**: catalog 15 slot (:88-245, đếm đúng), 4 feature-bound (`phap_bao`/`formation_slot`/`companion_roster`/`chi_hien_quan` — betaFeatureFlags.ts:35-38 false hết) + `talisman_slot` NEVER_AVAILABLE (:67,:154).
- **Cây character chết nguyên khối**: `CharacterPanel` chỉ có test-importer; `CharacterScene` chỉ được CharacterPanel mount (:2,:11); 7 sibling chỉ quay vòng trong cụm; `PlayerPortrait` 2 template consumer (CharacterFigureWheel:105, CharacterIdentityHeader:44) đều chết — ArtifactOverview.vue:4 chỉ là comment.
- **`slotActive` case 'character' unreachable**: `leftPanelMode` không bao giờ = 'character' (openLeftPanel :232-237 route qua `characterOverlayOpen`+`characterSceneTab`; không writer nào khác ngoài test gán trực tiếp) — §4.5 đúng, `navActive` :269-271 đã vá đúng chỗ.
- **Global CSS**: orb rule :65-68 (background/border/shadow — scoped :65 chỉ còn transition/hover/disabled sống), `.df-building` :152-166, `.df-board` 4 lớp, `.df-cultivator .player-portrait` :63-64 không trúng DOM, reduced-motion :197-199, rail-over-panels :381-411 (11 scene root), `pc-paper-production.css:67-69` (production-only vì preview root không có `hk-art-scene` — FidelityScene :25 chỉ `df-scene`).
- **Dead exports**: `commandWheelOrbit.ts` toàn file (0 importer), `RING_3_BUILDING_IDS` :247-250 (0 importer), `.ring` field :19 (0 reader).
- **Stale comments**: HomeContent :2-5, FidelityScene :4-5, catalog :5-7, ui.ts :132-134 — cả 4 đều xác nhận sai.
- **Test hook**: 45 hit `data-wheel-slot` trong tests/ (24 e2e spec + helpers.ts + `betaConsumerLeak.probes.test.ts:107,127` mount DongFuStage thật).
- **Audio**: `ui.wheel.open/close` binding (uiAudioBinding.ts:61-62, flush:'sync' :67), manifest :261-263, `ui.wheel.select` chỉ 2 caller (:282 rail, :332 wheel) — §4.11 đúng.
- **Art**: 53 symbols SVG (gồm technique.svg), el-*/banner-*/el-formation-* tồn tại, orb-frame ở SKIN_ART :9, medallion/backing/seam/icons rail, world-vista-warm :191, element art warm :547-555.
- **CharacterFigureWheel internals** (319 dòng): chosenKit :27-33, aura :36-38/:73, heroDisc :39-46, elementRows :49-58, 3 formation URL :65-67, pentagon :238-242, tooltip producers :97,:114 — là nơi duy nhất produce kind:'element' (Tooltip.vue :76,:157,:160,:200,:304-325 chờ producer).
- **Preview**: DongFuVista consumer nhiều hơn report ngụ ý (12 trang preview dùng nó làm nền) nhưng kết luận "preview-only" vẫn đúng — production dùng `world-vista-warm-v1.png` (:191).

**Đánh giá**: các sai sót còn lại đều nhỏ — 1 action chết sót (`toggleLeft`), vài chi tiết logic phụ chưa inventory, 2 cite lệch nhẹ. Không finding nào lật kết luận chính.
