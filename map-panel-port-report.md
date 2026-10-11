# MAP-PANEL port report — Bản Đồ → Landscape preview

Child: map-panel port of the live Bản Đồ panel to Codex's LANDSCAPE preview
(`ui-preview/LandscapeDesignPreview.vue` + `HomeExplorationArtPanel.vue` +
`PaperSceneDesigns.vue kind="map"`). UI-only — no domain logic rewired.

## 1. Mount chain (audited — what actually renders the live Bản Đồ)

`FunctionOverlayPanel.vue` (paperMode `stage_select`) →
`components/panels/StageSelectPanel.vue` →
`components/scenes/exploration/ExplorationSurface.vue` →
`SceneDesignCanvas` (overlay variant, 1440×810 design px) →
`fidelity/ExplorationFidelityScene.vue` (shell + header + chapter rail + grid) →
`fidelity/ExplorationPaperMap.vue` (vista + node band) +
`fidelity/ExplorationPaperDetails.vue` (inspector).

`ExplorationPreview.vue` is a standalone fixture (not the live panel) — left alone.

## 2. Element diff table (preview-declared vs canonical-rendered)

| # | Preview element (Landscape/PaperSceneDesigns) | Canonical before port | Port decision |
|---|---|---|---|
| 1 | `.home-map-art` sheet @ 24%/12.5%/74%/75% of 1440×810, `shared-paper-page-v1` bg, `3px double #b28a43` | `.exploration-scene .paper` sheet, different paper art/geometry | Ported: `.map-sheet` @ 345/101/1065/608 px (= same %), `shared-paper-page-v1.png`, `3px double #b28a43` |
| 2 | Panel header `h1` "Sơn Hà Đồ" + zone·realm identity line | `.exploration-title` + zone pills row + `.exploration-progress` bar | Ported: `.map-head` — h1 uses live i18n `dongFu.nav.exploration` ("Bản Đồ"), `.map-identity` = `model.title` + `model.subtitle` ("Thanh Vân · Phàm Nhân"). Zone pills kept but `v-if zones.length > 1` (hidden in 1-zone beta). Bottom progress bar removed → orphan list |
| 3 | `.paper-map-scene` grid `145px minmax(0,1fr) 235px` | 3 horizontal chapter bands stacked vertically | Ported: `.map-grid` `145px minmax(0,1fr) 235px` — rail / vista / inspector columns |
| 4 | Chapter rail: `Chương` h2 + buttons `Chương N / label / progress or Chưa Mở`, `.selected`, `is-locked` | None (all 30 nodes rendered at once) | Ported: `.map-chapters` rail bound to `chapterOptions`; click emits `chapter` → surface re-picks first unlocked stage in that chapter (mirrors `selectFirstStageInZone`) |
| 5 | `.paper-map-scene__landscape` vista cell w/ terrain art + floating chapter label | `.chapter-band` per chapter (3 bands, banded terrain slices) | Ported: `.exploration-map` grid cell, `3px double #b28b46`, terrain `object-fit:cover`, `.map-name` label |
| 6 | Single horizontal node row, dark medallions (46px, `3px double #b28b46`, `#2c2b21` bg, `#ebd5a2` num) | `.stage-node` light parchment squares, 3 rows | Ported: dark medallion + all canonical state marks kept (selected `#a47b2c` + `0 0 12px #ffd887`, cleared ✓, perfect ★, lock icon, BOSS, enemy name under node). Node x-position now `%`-based (`x/7.2`) so the single band is resolution-independent |
| 7 | Bottom caption strip `#f4e4cabd` "Chọn một ải trên bản đồ." | `.exploration-empty` | Ported: `.map-caption` bottom strip, `exploration.empty` i18n |
| 8 | Dark inspector: `character-card-nine-slice-v2.png` border-image 160, black `#000000d9` backing, light `#efdfb9` text | `.exploration-details` cream parchment (global tien-hiep-ui.css paper skin) | Ported with `:is(#app,body) .exploration-details.exploration-details` (1,2,1) — beats the global `:is(#app,body)` (1,1,0) paper skin + kills its `::before`/`::after` paint. All canonical rows kept: chapter-name, stage-title, vista, description, state-line, disabled-line, enemy, rewards (52px cells), mode-chips (2-col grid), mode-hint, armedFarm, notice, build-link, challenge CTA (`equipment-filter-normal-v2.png`, 700 19px, `#efdcb6`) |
| 9 | CTA button art `equipment-filter-normal-v2.png` `center/100% 100%` | `--th-art-button-primary` global | Ported on `.challenge` — NOTE: `tien-hiep-ui.css:252` also re-skins `.challenge` (1,2,0). Scoped `.challenge` (0,1,1) loses the `background` shorthand war, but `:style` inline backgroundImage + rule keeps the preview CTA art visible; verified live |
| 10 | Locked chapter: rail shows `Chưa Mở`; browsing a locked chapter renders locked nodes + dimmed inspector | n/a (all chapters always visible) | Ported: rail `is-locked` styling + `exploration.state.locked` label; locked chapter selectable for browse (same as preview) |
| 11 | `exploration.chapters` rail heading | key did not exist | Added `"chapters": "Chương"/"Chapters"` to `locales/vi.json` + `en.json` under `exploration` |

## 3. Files changed + what ported

- `src/components/scenes/exploration/ExplorationSurface.vue` — added `activeChapterId` ref + `watch(selectedStage)` sync + `selectChapter(id)` (re-picks first unlocked stage of the chapter, `stagesInZone` filtered); passes `:chapter`/`@chapter` to the scene. All stores/emits/domain untouched.
- `src/components/scenes/exploration/fidelity/ExplorationFidelityScene.vue` — rewritten shell: `.map-sheet` geometry + shared paper art, `.map-head` (h1/nav title, identity, zones `v-if>1`), `.map-grid` + `.map-chapters` rail (`chapter` prop optional — preview fixture keeps working via local ref), emits `chapter`.
- `src/components/scenes/exploration/fidelity/ExplorationPaperMap.vue` — rewritten: single-chapter prop `chapter: ExplorationChapter | null`, vista cell + `.map-name`, centered `.band` (svg 720×140 non-uniform), dark medallion nodes with all state classes preserved + locked click-guard + aria contract, `.map-caption`.
- `src/components/scenes/exploration/fidelity/ExplorationPaperDetails.vue` — styles-only rewrite: dark nine-slice inspector + light text + all row restyles + preview CTA art; template rows unchanged.
- `src/components/scenes/exploration/fidelity/ExplorationPaperMap.test.ts` — mounts updated for single-chapter prop (same assertions).
- `src/components/panels/StageSelectPanel.test.ts` — 30-node assertion → 10 (single chapter in DOM); cross-chapter disarm test now clicks `[data-chapter-id="2"]` rail (which auto-picks `qi_refining_forest` — same invariant, better coverage).
- `src/locales/vi.json`, `src/locales/en.json` — `exploration.chapters` key.
- `poke-map-panel.mjs`, `poke-ch1.mjs`, `poke-where.mjs`, `poke-creation.mjs` — CDP verification scratch scripts (NOT for commit — see note).

## 4. Orphaned logic — awaiting owner ruling (nothing deleted silently)

1. **`.exploration-zones` pills** — kept in the scene but gated `v-if model.zones.length > 1`; invisible in the 1-zone beta. Preview has no zone picker (rail = chapters). Owner ruling: keep hidden / reintroduce as rail parent / drop when multi-zone ships.
2. **Bottom `.progress` bar** (`model.progress` + `progressLabel`) — removed from the scene; progress now surfaces only inside rail buttons (`x / 10`). Owner ruling: confirm removal or re-add as header chip.
3. **`model.subtitle` zone·realm line** — kept as `.map-identity` header text (preview shows it top-right). If owner wants preview-exact ("subtitle belongs to zone, not panel") can drop.
4. **`ExplorationPreview.vue` fixture** — still on the old scene API; scene keeps `chapter` optional so it renders, but its rail is local-only. Owner ruling: update fixture or retire.
5. **Locked-chapter browsing** — clicking a `Chưa Mở` chapter selects that chapter's first stage (a locked stage) so the inspector shows locked detail. Matches preview; if owner wants locked chapters non-clickable, gate `selectChapter`.
6. **Global skin conflict** — `tien-hiep-ui.css:252` re-skins `.challenge` + `:234` re-skins `.exploration-details` for ALL panels. This port beats them locally via specificity; if the global inspector skin is meant to be uniform, owner should reconcile (home panel now intentionally differs).

## 5. Verification evidence (live @ http://localhost:5999, 1600×900)

DOM audit (fresh char, `ui.leftPanelMode='stage_select'`):
- `.map-sheet` rect (383.3, 112.2, 1183.3×675.6) = design 345/101/1065×608 at scale 1.111 ✓
- `.map-grid` cols measured 161 / 677 / 261 px = design 145 / ~610 / 235 ✓
- h1 "Bản Đồ"; identity "Thanh Vân · Phàm Nhân" ✓
- rail: Chương 1 Phàm Nhân selected "0 / 10"; Chương 2 Luyện Khí + Chương 3 Trúc Cơ `is-locked` "Chưa Mở" ✓; clicks switch `.selected` (verified 2, 3)
- 10 `.stage-node` in ch1; states: dong_1 `current+selected`, dong_2-9 `locked`, dong_10 `locked+boss` ✓
- caption "Chọn một ải trên bản đồ."; inspector 261px: "Chương 1 · Phàm Nhân", "1-1 Động 1", 4 mode-chips, start CTA ✓
- dark inspector computed: `background-image:linear-gradient(rgba(0,0,0,.85))`, `border-image-slice:160`, `border-image-width:14px`, `::before` none ✓
- `.exploration-zones` absent (1 zone), `.exploration-scene .progress` absent ✓

Screenshots (Windows box): `/tmp/map-panel-live.png` (ch1), `/tmp/map-panel-ch2.png`, `/tmp/map-panel-ch3.png` (locked chapters render locked medallions + dimmed inspector + "Cần <realm> tầng 1").

Build/tests:
- `vue-tsc --noEmit` — clean.
- `vitest run src/components/scenes/exploration src/components/panels/StageSelectPanel.test.ts` — 3 files / 13 tests green.
- NOTE: `tests/architecture/i18nKeyParity.test.ts` fails on master baseline too (10 pre-existing violations in `ProductionSourceArtCard.vue` + `SkillConstellationPanel.vue`) — unrelated to this port.

## 6. Wiring needs left for owner

1. `chapter`/`@chapter` prop-emit contract between `ExplorationSurface` and `ExplorationFidelityScene` is new — owner may move `activeChapterId` into a store if other surfaces need it.
2. `selectChapter` picks `first unlocked ?? first stage` — confirm desired semantics vs "remember last picked node per chapter".
3. Rail `data-chapter-id` is a test/poke hook — keep or rename per repo conventions.
4. Locked-chapter browse: allowed now (preview parity). Gate in `selectChapter`/`pickChapter` if not wanted.
5. Multi-zone: when `zones.length > 1` returns, zone pills re-appear in `.map-head` — owner decides whether zones should become a rail row or filter instead.
6. Scratch poke scripts (`poke-*.mjs`) committed under `game/` for reuse — remove if repo policy forbids root-level scratch files.
