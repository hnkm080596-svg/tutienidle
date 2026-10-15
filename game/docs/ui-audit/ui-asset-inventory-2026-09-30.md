# UI Asset Inventory — TutienIdle

Audit toàn bộ hình ảnh liên quan đến UI: dùng hình gì, file ở đâu, kích thước bao nhiêu, ai load.
Ngày audit: 2026-09-30. Nguồn: scan header PNG/WebP/ICO của toàn bộ [`game/public/assets`](../../public/assets/) (1176 ảnh, 730.5 MB) + [`game/public/NEWSPRITE/.../ui`](../../public/NEWSPRITE/Assets/Resources/assets/ui/) (1378 ảnh, 531.6 MB) + grep toàn bộ ref trong `game/src`.

**Mọi tên file trong doc này là link tương đối — click mở được trong VS Code / GitHub preview.**

## 0. Bản đồ 4 tầng

| Tầng | Vị trí | Số ảnh | Dung lượng | Trạng thái |
|---|---|---|---|---|
| 1. UI chrome | [`public/assets/ui/`](../../public/assets/ui/) | 59 | 19.8 MB | Đang render (trừ mục orphan ở §5) |
| 2. Ảnh nội dung UI kéo từ data/scene | `public/assets/{skills,techniques,pills,materials,equipment,enemies,characters,backgrounds,buildings,…}` | 1117 | 710.7 MB | Đa số dùng; một phần staged |
| 3. Thư viện NEWSPRITE | [`public/NEWSPRITE/Assets/Resources/assets/ui/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/) | 1378 PNG (+1378 JSON meta) | 531.6 MB (cả tree NEWSPRITE ~1.1 GB) | **Zero code ref** — library tham khảo |
| 4. Source art | [`art-source/`](../../art-source/), [`art/`](../../art/) | ~88 | — | Input pipeline, không ship |

Cơ chế load: Vue dùng `<img src="/assets/…">` (bind động — literal `src="/assets/..."` bị @vitejs/plugin-vue rewrite thành import và phá jsdom test) hoặc CSS `url('/assets/…')`/`border-image`; Phaser dùng `load.image/spritesheet/atlas/multiatlas` qua [`AssetLoaderScene.ts`](../../src/game/scenes/AssetLoaderScene.ts) + [`AssetBundleCatalog.ts`](../../src/presentation/assets/AssetBundleCatalog.ts) + [`CombatPreload.ts`](../../src/game/support/CombatPreload.ts)/[`TribulationPreload.ts`](../../src/game/support/TribulationPreload.ts).

---

## 1. Tầng 1 — [`public/assets/ui/`](../../public/assets/ui/) (59 ảnh)

Nhóm lớn nhất là **ink-wash design system**: manifest 11 asset × @1x/@2x trong [`ink-wash-ui-slices.json`](../../src/assets/ink-wash-ui-slices.json) + [`inkWashUi.ts`](../../src/assets/inkWashUi.ts) (slice insets, center fill/transparent, tintable, min size). Từ 2026-08-30, [`InkNineSlice.vue`](../../src/components/common/primitives/InkNineSlice.vue) — primitive dùng bởi ~20 component (GamePanel/GameButton/OverlayPanel/Chip/Tooltip/ConfirmModal/OfflineSummaryModal/TutorialOverlay/AuthEntry/CharacterCreation/CombatVictory/Defeat/EquipmentHall/TechniqueSlotCard…) — **render bằng pure-CSS gradient/box-shadow**, không còn đọc PNG. PNG slices chỉ còn: (a) contract test, (b) nguồn dựng [`atlas/ink-wash-ui.png`](../../public/assets/ui/ink-wash/atlas/ink-wash-ui.png) (2048×840) mà Phaser TribulationScene load qua [`InkWashUiPhaser.ts`](../../src/game/support/InkWashUiPhaser.ts).

| File | W×H | Size | Consumer |
|---|---|---|---|
| [`alchemy-room.png`](../../public/assets/ui/Slot/alchemy-room.png) | 64x64 | 4.7 KB | **ORPHAN** — không ref |
| [`bag-slot-hover.png`](../../public/assets/ui/Slot/bag-slot-hover.png) | 1024x93 | 30.1 KB | [`SlotView.vue`](../../src/components/common/SlotView.vue) — `--slot-hover-image` (stretch 100%) |
| [`inv-slot-backdrop.png`](../../public/assets/ui/Slot/inv-slot-backdrop.png) | 128x128 | 0.6 KB | [`SlotView.vue`](../../src/components/common/SlotView.vue) — `--slot-bg-image` mặc định (cover) |
| [`seal-frame.png`](../../public/assets/ui/Slot/seal-frame.png) | 256x256 | 23.4 KB | [`SlotView.vue`](../../src/components/common/SlotView.vue) — khung con dấu (contain) |
| [`slot-backdrop.png`](../../public/assets/ui/Slot/slot-backdrop.png) | 126x126 | 5.1 KB | [`SlotView.vue`](../../src/components/common/SlotView.vue) — backdrop variant |
| [`slot-frame-hover.png`](../../public/assets/ui/Slot/slot-frame-hover.png) | 142x142 | 7.3 KB | [`SlotView.vue`](../../src/components/common/SlotView.vue) — hover frame variant |
| [`reward-gourd-v1.png`](../../public/assets/ui/combat/reward-gourd-v1.png) | 1254x1254 | 1021.6 KB | [`RewardGourd.ts`](../../src/game/support/RewardGourd.ts) → Phaser key `reward-gourd-v1` ([`combat-reward-gourd.ts`](../../src/game/scenes/combat/combat-reward-gourd.ts) trên HUD) |
| [`divider-glow.png`](../../public/assets/ui/divider-glow.png) | 1024x93 | 30.1 KB | [`theme.css`](../../src/assets/theme.css) `.ink-divider` — dải glow 100%×100% (byte-identical với bag-slot-hover.png) |
| [`banner-earth.png`](../../public/assets/ui/elements/banner-earth.png) | 475x154 | 140.3 KB | [`Tooltip.vue`](../../src/components/common/Tooltip.vue) — nền tooltip nguyên tố `earth` |
| [`banner-fire.png`](../../public/assets/ui/elements/banner-fire.png) | 470x152 | 138.4 KB | [`Tooltip.vue`](../../src/components/common/Tooltip.vue) — nền tooltip nguyên tố `fire` |
| [`banner-metal.png`](../../public/assets/ui/elements/banner-metal.png) | 465x172 | 119.5 KB | [`Tooltip.vue`](../../src/components/common/Tooltip.vue) — nền tooltip nguyên tố `metal` |
| [`banner-primordial.png`](../../public/assets/ui/elements/banner-primordial.png) | 342x88 | 37.0 KB | [`Tooltip.vue`](../../src/components/common/Tooltip.vue) — nền tooltip nguyên tố `primordial` |
| [`banner-water.png`](../../public/assets/ui/elements/banner-water.png) | 465x152 | 143.8 KB | [`Tooltip.vue`](../../src/components/common/Tooltip.vue) — nền tooltip nguyên tố `water` |
| [`banner-wood.png`](../../public/assets/ui/elements/banner-wood.png) | 445x175 | 141.3 KB | [`Tooltip.vue`](../../src/components/common/Tooltip.vue) — nền tooltip nguyên tố `wood` |
| [`el-earth.png`](../../public/assets/ui/elements/el-earth.png) | 180x180 | 56.1 KB | [`CharacterPanel.vue`](../../src/components/panels/CharacterPanel.vue) — đĩa ngũ hành `earth` (dynamic `el-${element}.png`) |
| [`el-fire.png`](../../public/assets/ui/elements/el-fire.png) | 180x180 | 59.1 KB | [`CharacterPanel.vue`](../../src/components/panels/CharacterPanel.vue) — đĩa ngũ hành `fire` (dynamic `el-${element}.png`) |
| [`el-formation-orbs.png`](../../public/assets/ui/elements/el-formation-orbs.png) | 276x276 | 83.0 KB | [`CharacterPanel.vue`](../../src/components/panels/CharacterPanel.vue) — vòng trận đồ (`formation-orbs`) |
| [`el-formation-ring.png`](../../public/assets/ui/elements/el-formation-ring.png) | 280x280 | 103.2 KB | [`CharacterPanel.vue`](../../src/components/panels/CharacterPanel.vue) — vòng trận đồ (`formation-ring`) |
| [`el-formation-star.png`](../../public/assets/ui/elements/el-formation-star.png) | 250x250 | 96.7 KB | [`CharacterPanel.vue`](../../src/components/panels/CharacterPanel.vue) — vòng trận đồ (`formation-star`) |
| [`el-metal.png`](../../public/assets/ui/elements/el-metal.png) | 180x180 | 54.5 KB | [`CharacterPanel.vue`](../../src/components/panels/CharacterPanel.vue) — đĩa ngũ hành `metal` (dynamic `el-${element}.png`) |
| [`el-primordial.png`](../../public/assets/ui/elements/el-primordial.png) | 140x140 | 32.1 KB | [`CharacterPanel.vue`](../../src/components/panels/CharacterPanel.vue) — đĩa Hỗn Nguyên (`primordialDiscUrl`) |
| [`el-water.png`](../../public/assets/ui/elements/el-water.png) | 180x180 | 60.8 KB | [`CharacterPanel.vue`](../../src/components/panels/CharacterPanel.vue) — đĩa ngũ hành `water` (dynamic `el-${element}.png`) |
| [`el-wood.png`](../../public/assets/ui/elements/el-wood.png) | 180x180 | 54.0 KB | [`CharacterPanel.vue`](../../src/components/panels/CharacterPanel.vue) — đĩa ngũ hành `wood` (dynamic `el-${element}.png`) |
| [`ink-wash-ui.png`](../../public/assets/ui/ink-wash/atlas/ink-wash-ui.png) | 2048x840 | 798.9 KB | [`InkWashUiPhaser.ts`](../../src/game/support/InkWashUiPhaser.ts) → `scene.load.atlas("ink-wash-ui")` → [`TribulationScene.ts`](../../src/game/scenes/TribulationScene.ts) (NineSlice) |
| [`seal-cinnabar-large.png`](../../public/assets/ui/ink-wash/overlays/seal-cinnabar-large.png) | 1024x1536 | 2.7 MB | [`InkWashBackdrop.vue`](../../src/components/common/InkWashBackdrop.vue) — con dấu lớn (mount: AuthEntry, CharacterCreation, CombatVictory/Defeat, SaveIncompatible) |
| [`seal-cinnabar-small.png`](../../public/assets/ui/ink-wash/overlays/seal-cinnabar-small.png) | 1254x1254 | 1.1 MB | [`InkWashBackdrop.vue`](../../src/components/common/InkWashBackdrop.vue) — con dấu nhỏ (mount: AuthEntry, CharacterCreation, CombatVictory/Defeat, SaveIncompatible) |
| [`wash-bamboo-right.png`](../../public/assets/ui/ink-wash/overlays/wash-bamboo-right.png) | 1024x1536 | 387.3 KB | [`InkWashBackdrop.vue`](../../src/components/common/InkWashBackdrop.vue) — tre phải (mount: AuthEntry, CharacterCreation, CombatVictory/Defeat, SaveIncompatible) |
| [`wash-bottom-mist.png`](../../public/assets/ui/ink-wash/overlays/wash-bottom-mist.png) | 1672x941 | 645.1 KB | [`InkWashBackdrop.vue`](../../src/components/common/InkWashBackdrop.vue) — mây đáy (mount: AuthEntry, CharacterCreation, CombatVictory/Defeat, SaveIncompatible) |
| [`wash-corner-mountain-left.png`](../../public/assets/ui/ink-wash/overlays/wash-corner-mountain-left.png) | 1672x940 | 547.8 KB | [`InkWashBackdrop.vue`](../../src/components/common/InkWashBackdrop.vue) — góc núi trái (mount: AuthEntry, CharacterCreation, CombatVictory/Defeat, SaveIncompatible) |
| [`wash-corner-mountain-right.png`](../../public/assets/ui/ink-wash/overlays/wash-corner-mountain-right.png) | 1672x940 | 540.6 KB | [`InkWashBackdrop.vue`](../../src/components/common/InkWashBackdrop.vue) — góc núi phải (mount: AuthEntry, CharacterCreation, CombatVictory/Defeat, SaveIncompatible) |
| [`ink-wash-ui-size-matrix.png`](../../public/assets/ui/ink-wash/review/ink-wash-ui-size-matrix.png) | 840x1500 | 354.3 KB | Doc artifact (size matrix), không load runtime |
| [`button-s-ink@1x.png`](../../public/assets/ui/ink-wash/slices/button-s-ink@1x.png) | 192x64 | 13.5 KB | Manifest [`ink-wash-ui-slices.json`](../../src/assets/ink-wash-ui-slices.json) + contract tests — Vue render CSS ([`InkNineSlice.vue`](../../src/components/common/primitives/InkNineSlice.vue)), PNG dormant |
| [`button-s-ink@2x.png`](../../public/assets/ui/ink-wash/slices/button-s-ink@2x.png) | 384x128 | 52.4 KB | Manifest [`ink-wash-ui-slices.json`](../../src/assets/ink-wash-ui-slices.json) + contract tests — Vue render CSS ([`InkNineSlice.vue`](../../src/components/common/primitives/InkNineSlice.vue)), PNG dormant |
| [`button-s-paper@1x.png`](../../public/assets/ui/ink-wash/slices/button-s-paper@1x.png) | 192x64 | 11.1 KB | Manifest [`ink-wash-ui-slices.json`](../../src/assets/ink-wash-ui-slices.json) + contract tests — Vue render CSS ([`InkNineSlice.vue`](../../src/components/common/primitives/InkNineSlice.vue)), PNG dormant |
| [`button-s-paper@2x.png`](../../public/assets/ui/ink-wash/slices/button-s-paper@2x.png) | 384x128 | 44.4 KB | Manifest [`ink-wash-ui-slices.json`](../../src/assets/ink-wash-ui-slices.json) + contract tests — Vue render CSS ([`InkNineSlice.vue`](../../src/components/common/primitives/InkNineSlice.vue)), PNG dormant |
| [`button-s-seal@1x.png`](../../public/assets/ui/ink-wash/slices/button-s-seal@1x.png) | 192x64 | 10.8 KB | Manifest [`ink-wash-ui-slices.json`](../../src/assets/ink-wash-ui-slices.json) + contract tests — Vue render CSS ([`InkNineSlice.vue`](../../src/components/common/primitives/InkNineSlice.vue)), PNG dormant |
| [`button-s-seal@2x.png`](../../public/assets/ui/ink-wash/slices/button-s-seal@2x.png) | 384x128 | 40.6 KB | Manifest [`ink-wash-ui-slices.json`](../../src/assets/ink-wash-ui-slices.json) + contract tests — Vue render CSS ([`InkNineSlice.vue`](../../src/components/common/primitives/InkNineSlice.vue)), PNG dormant |
| [`frame-l-landscape@1x.png`](../../public/assets/ui/ink-wash/slices/frame-l-landscape@1x.png) | 320x320 | 50.6 KB | Manifest [`ink-wash-ui-slices.json`](../../src/assets/ink-wash-ui-slices.json) + contract tests — Vue render CSS ([`InkNineSlice.vue`](../../src/components/common/primitives/InkNineSlice.vue)), PNG dormant |
| [`frame-l-landscape@2x.png`](../../public/assets/ui/ink-wash/slices/frame-l-landscape@2x.png) | 640x640 | 124.1 KB | Manifest [`ink-wash-ui-slices.json`](../../src/assets/ink-wash-ui-slices.json) + contract tests — Vue render CSS ([`InkNineSlice.vue`](../../src/components/common/primitives/InkNineSlice.vue)), PNG dormant |
| [`frame-m-seal-corner@1x.png`](../../public/assets/ui/ink-wash/slices/frame-m-seal-corner@1x.png) | 192x192 | 16.3 KB | Manifest [`ink-wash-ui-slices.json`](../../src/assets/ink-wash-ui-slices.json) + contract tests — Vue render CSS ([`InkNineSlice.vue`](../../src/components/common/primitives/InkNineSlice.vue)), PNG dormant |
| [`frame-m-seal-corner@2x.png`](../../public/assets/ui/ink-wash/slices/frame-m-seal-corner@2x.png) | 384x384 | 57.7 KB | Manifest [`ink-wash-ui-slices.json`](../../src/assets/ink-wash-ui-slices.json) + contract tests — Vue render CSS ([`InkNineSlice.vue`](../../src/components/common/primitives/InkNineSlice.vue)), PNG dormant |
| [`frame-s-slot@1x.png`](../../public/assets/ui/ink-wash/slices/frame-s-slot@1x.png) | 96x96 | 3.3 KB | Manifest [`ink-wash-ui-slices.json`](../../src/assets/ink-wash-ui-slices.json) + contract tests — Vue render CSS ([`InkNineSlice.vue`](../../src/components/common/primitives/InkNineSlice.vue)), PNG dormant |
| [`frame-s-slot@2x.png`](../../public/assets/ui/ink-wash/slices/frame-s-slot@2x.png) | 192x192 | 10.0 KB | Manifest [`ink-wash-ui-slices.json`](../../src/assets/ink-wash-ui-slices.json) + contract tests — Vue render CSS ([`InkNineSlice.vue`](../../src/components/common/primitives/InkNineSlice.vue)), PNG dormant |
| [`frame-xl-ceremony@1x.png`](../../public/assets/ui/ink-wash/slices/frame-xl-ceremony@1x.png) | 512x512 | 61.9 KB | Manifest [`ink-wash-ui-slices.json`](../../src/assets/ink-wash-ui-slices.json) + contract tests — Vue render CSS ([`InkNineSlice.vue`](../../src/components/common/primitives/InkNineSlice.vue)), PNG dormant |
| [`frame-xl-ceremony@2x.png`](../../public/assets/ui/ink-wash/slices/frame-xl-ceremony@2x.png) | 1024x1024 | 185.7 KB | Manifest [`ink-wash-ui-slices.json`](../../src/assets/ink-wash-ui-slices.json) + contract tests — Vue render CSS ([`InkNineSlice.vue`](../../src/components/common/primitives/InkNineSlice.vue)), PNG dormant |
| [`frame-xs-ink-line@1x.png`](../../public/assets/ui/ink-wash/slices/frame-xs-ink-line@1x.png) | 64x64 | 1.6 KB | Manifest [`ink-wash-ui-slices.json`](../../src/assets/ink-wash-ui-slices.json) + contract tests — Vue render CSS ([`InkNineSlice.vue`](../../src/components/common/primitives/InkNineSlice.vue)), PNG dormant |
| [`frame-xs-ink-line@2x.png`](../../public/assets/ui/ink-wash/slices/frame-xs-ink-line@2x.png) | 128x128 | 4.4 KB | Manifest [`ink-wash-ui-slices.json`](../../src/assets/ink-wash-ui-slices.json) + contract tests — Vue render CSS ([`InkNineSlice.vue`](../../src/components/common/primitives/InkNineSlice.vue)), PNG dormant |
| [`surface-l-ink-data@1x.png`](../../public/assets/ui/ink-wash/slices/surface-l-ink-data@1x.png) | 320x320 | 127.7 KB | Manifest [`ink-wash-ui-slices.json`](../../src/assets/ink-wash-ui-slices.json) + contract tests — Vue render CSS ([`InkNineSlice.vue`](../../src/components/common/primitives/InkNineSlice.vue)), PNG dormant |
| [`surface-l-ink-data@2x.png`](../../public/assets/ui/ink-wash/slices/surface-l-ink-data@2x.png) | 640x640 | 522.8 KB | Manifest [`ink-wash-ui-slices.json`](../../src/assets/ink-wash-ui-slices.json) + contract tests — Vue render CSS ([`InkNineSlice.vue`](../../src/components/common/primitives/InkNineSlice.vue)), PNG dormant |
| [`surface-m-paper@1x.png`](../../public/assets/ui/ink-wash/slices/surface-m-paper@1x.png) | 192x192 | 46.6 KB | Manifest [`ink-wash-ui-slices.json`](../../src/assets/ink-wash-ui-slices.json) + contract tests — Vue render CSS ([`InkNineSlice.vue`](../../src/components/common/primitives/InkNineSlice.vue)), PNG dormant |
| [`surface-m-paper@2x.png`](../../public/assets/ui/ink-wash/slices/surface-m-paper@2x.png) | 384x384 | 190.0 KB | Manifest [`ink-wash-ui-slices.json`](../../src/assets/ink-wash-ui-slices.json) + contract tests — Vue render CSS ([`InkNineSlice.vue`](../../src/components/common/primitives/InkNineSlice.vue)), PNG dormant |
| [`surface-xl-paper-scroll@1x.png`](../../public/assets/ui/ink-wash/slices/surface-xl-paper-scroll@1x.png) | 512x512 | 366.9 KB | Manifest [`ink-wash-ui-slices.json`](../../src/assets/ink-wash-ui-slices.json) + contract tests — Vue render CSS ([`InkNineSlice.vue`](../../src/components/common/primitives/InkNineSlice.vue)), PNG dormant |
| [`surface-xl-paper-scroll@2x.png`](../../public/assets/ui/ink-wash/slices/surface-xl-paper-scroll@2x.png) | 1024x1024 | 1.4 MB | Manifest [`ink-wash-ui-slices.json`](../../src/assets/ink-wash-ui-slices.json) + contract tests — Vue render CSS ([`InkNineSlice.vue`](../../src/components/common/primitives/InkNineSlice.vue)), PNG dormant |
| [`panel-drawer-bg.png`](../../public/assets/ui/panel-drawer-bg.png) | 1024x521 | 453.6 KB | [`theme.css`](../../src/assets/theme.css) `.ink-drawer` — nền cover |
| [`panel-drawer-ink.png`](../../public/assets/ui/panel-drawer-ink.png) | 249x362 | 24.5 KB | [`theme.css`](../../src/assets/theme.css) `.ink-drawer` — `border-image … 16 / 14px` |
| [`ink-go-board-19x19-v1.png`](../../public/assets/ui/skill/ink-go-board-19x19-v1.png) | 2048x2048 | 5.2 MB | **ORPHAN** — không ref |
| [`stat-meridian-figure.png`](../../public/assets/ui/stat-meridian-figure.png) | 904x1024 | 700.1 KB | [`CharacterPanel.vue`](../../src/components/panels/CharacterPanel.vue) — hình kinh mạch (`MERIDIAN_FIGURE_SRC`, bind động) |
| [`talent-card-scroll-hover.png`](../../public/assets/ui/talent-card-scroll-hover.png) | 486x830 | 440.6 KB | [`CharacterPanel.vue`](../../src/components/panels/CharacterPanel.vue) `.talent-block:hover` |
| [`talent-card-scroll.png`](../../public/assets/ui/talent-card-scroll.png) | 486x830 | 382.0 KB | [`CharacterPanel.vue`](../../src/components/panels/CharacterPanel.vue) `.talent-block` nền cuộn (100%×100%) |

Slice insets (từ [`ink-wash-ui-slices.json`](../../src/assets/ink-wash-ui-slices.json)): xs-ink-line 12px · button-s-* 24/24/16/16 · frame-s-slot 20 · m-* 32 · l-* 48 · xl-* 80. Atlas frame offsets: xs@2,2 · buttons@70/266/462,2 · slot@658,2 · m@758/954,2 · l@1150/1474,2 · xl@2/518,326.

Còn lại trong root [`public/`](../../public/): [`favicon.ico`](../../public/favicon.ico) 32×32 ([`index.html`](../../index.html)), [`cultivate.png`](../../public/assets/cultivate.png) 1206×96 + [`idle.png`](../../public/assets/idle.png) 831×82 (strip + TexturePacker JSON, xem §2 characters). Font duy nhất: Chakra Petch qua Google Fonts `@import` trong [`system-theme.css`](../../src/assets/system-theme.css) — external request.

---

## 2. Tầng 2 — Ảnh nội dung UI ngoài `ui/`

### [`assets/skills/`](../../public/assets/skills/) — 10 ảnh, 11.9 KB

Icon kỹ năng — [`SkillIconManifest.ts`](../../src/data/skill/SkillIconManifest.ts) → [`CombatSkillSlot.vue`](../../src/components/game/combat/hud/CombatSkillSlot.vue) / [`TurnCombatSkillBar.vue`](../../src/components/game/combat/hud/TurnCombatSkillBar.vue) / tooltip

<details><summary>Full file list</summary>

| File | W×H | Size |
|---|---|---|
| [`da_phap_lien_tuyen.png`](../../public/assets/skills/da_phap_lien_tuyen.png) | 32x32 | 1.2 KB |
| [`diem_kim_thuat.png`](../../public/assets/skills/diem_kim_thuat.png) | 32x32 | 1.1 KB |
| [`doc_chuong.png`](../../public/assets/skills/doc_chuong.png) | 32x32 | 1.2 KB |
| [`hoa_cau_thuat.png`](../../public/assets/skills/hoa_cau_thuat.png) | 32x32 | 1.2 KB |
| [`huy_quyen.png`](../../public/assets/skills/huy_quyen.png) | 32x32 | 1.2 KB |
| [`linh_bao.png`](../../public/assets/skills/linh_bao.png) | 32x32 | 1.2 KB |
| [`tho_cau_thuat.png`](../../public/assets/skills/tho_cau_thuat.png) | 32x32 | 1.3 KB |
| [`thuy_tien_thuat.png`](../../public/assets/skills/thuy_tien_thuat.png) | 32x32 | 1.1 KB |
| [`tram.png`](../../public/assets/skills/tram.png) | 32x32 | 1.2 KB |
| [`van_phap_tuy_tam.png`](../../public/assets/skills/van_phap_tuy_tam.png) | 32x32 | 1.2 KB |
</details>

### [`assets/techniques/`](../../public/assets/techniques/) — 4 ảnh, 2.2 KB

Icon công pháp — [`Techniques.ts`](../../src/data/technique/Techniques.ts) → TechniqueSlotCard, TechniqueBand

<details><summary>Full file list</summary>

| File | W×H | Size |
|---|---|---|
| [`dai_ngu_hanh_chan_quyet.png`](../../public/assets/techniques/dai_ngu_hanh_chan_quyet.png) | 32x32 | 0.6 KB |
| [`iron_body_scripture.png`](../../public/assets/techniques/iron_body_scripture.png) | 32x32 | 0.6 KB |
| [`ngu_kiem.png`](../../public/assets/techniques/ngu_kiem.png) | 32x32 | 0.4 KB |
| [`van_kiem_quyet.png`](../../public/assets/techniques/van_kiem_quyet.png) | 32x32 | 0.6 KB |
</details>

### [`assets/pills/`](../../public/assets/pills/) — 8 ảnh, 621.3 KB

Icon đan dược — [`pills.ts`](../../src/data/pill/pills.ts) → BagGrid, PillRoomPanel, toast loot

<details><summary>Full file list</summary>

| File | W×H | Size |
|---|---|---|
| [`duong_than_dan.png`](../../public/assets/pills/duong_than_dan.png) | 256x256 | 81.6 KB |
| [`hoi_linh_dan.png`](../../public/assets/pills/hoi_linh_dan.png) | 256x256 | 76.3 KB |
| [`hoi_xuan_dan.png`](../../public/assets/pills/hoi_xuan_dan.png) | 256x256 | 81.8 KB |
| [`khai_linh_dan.png`](../../public/assets/pills/khai_linh_dan.png) | 256x256 | 81.8 KB |
| [`phi_van_dan.png`](../../public/assets/pills/phi_van_dan.png) | 256x256 | 72.3 KB |
| [`thoi_the_dan.png`](../../public/assets/pills/thoi_the_dan.png) | 256x256 | 76.3 KB |
| [`to_cot_dan.png`](../../public/assets/pills/to_cot_dan.png) | 256x256 | 77.3 KB |
| [`tu_linh_dan.png`](../../public/assets/pills/tu_linh_dan.png) | 256x256 | 73.9 KB |
</details>

### [`assets/materials/`](../../public/assets/materials/) — 42 ảnh, 3.3 MB

Icon nguyên liệu (+ herbs/<loại>/<niên đại>) — [`materials.ts`](../../src/data/materials/materials.ts)

<details><summary>Full file list</summary>

| File | W×H | Size |
|---|---|---|
| [`century.png`](../../public/assets/materials/herbs/duong_than_thao/century.png) | 256x256 | 93.3 KB |
| [`decade.png`](../../public/assets/materials/herbs/duong_than_thao/decade.png) | 256x256 | 49.8 KB |
| [`millennium.png`](../../public/assets/materials/herbs/duong_than_thao/millennium.png) | 256x256 | 84.8 KB |
| [`myriad_year.png`](../../public/assets/materials/herbs/duong_than_thao/myriad_year.png) | 256x256 | 91.7 KB |
| [`thuong_co.png`](../../public/assets/materials/herbs/duong_than_thao/thuong_co.png) | 256x256 | 49.8 KB |
| [`century.png`](../../public/assets/materials/herbs/hoi_linh_thao/century.png) | 256x256 | 82.9 KB |
| [`decade.png`](../../public/assets/materials/herbs/hoi_linh_thao/decade.png) | 256x256 | 50.5 KB |
| [`millennium.png`](../../public/assets/materials/herbs/hoi_linh_thao/millennium.png) | 256x256 | 80.6 KB |
| [`myriad_year.png`](../../public/assets/materials/herbs/hoi_linh_thao/myriad_year.png) | 256x256 | 97.1 KB |
| [`thuong_co.png`](../../public/assets/materials/herbs/hoi_linh_thao/thuong_co.png) | 256x256 | 50.5 KB |
| [`century.png`](../../public/assets/materials/herbs/hoi_xuan_thao/century.png) | 256x256 | 83.6 KB |
| [`decade.png`](../../public/assets/materials/herbs/hoi_xuan_thao/decade.png) | 256x256 | 67.1 KB |
| [`millennium.png`](../../public/assets/materials/herbs/hoi_xuan_thao/millennium.png) | 256x256 | 78.4 KB |
| [`myriad_year.png`](../../public/assets/materials/herbs/hoi_xuan_thao/myriad_year.png) | 256x256 | 96.0 KB |
| [`thuong_co.png`](../../public/assets/materials/herbs/hoi_xuan_thao/thuong_co.png) | 256x256 | 67.1 KB |
| [`century.png`](../../public/assets/materials/herbs/khai_linh_hoa/century.png) | 256x256 | 83.8 KB |
| [`decade.png`](../../public/assets/materials/herbs/khai_linh_hoa/decade.png) | 256x256 | 59.0 KB |
| [`millennium.png`](../../public/assets/materials/herbs/khai_linh_hoa/millennium.png) | 256x256 | 83.2 KB |
| [`myriad_year.png`](../../public/assets/materials/herbs/khai_linh_hoa/myriad_year.png) | 256x256 | 95.8 KB |
| [`thuong_co.png`](../../public/assets/materials/herbs/khai_linh_hoa/thuong_co.png) | 256x256 | 59.0 KB |
| [`century.png`](../../public/assets/materials/herbs/phi_van_thao/century.png) | 256x256 | 87.0 KB |
| [`decade.png`](../../public/assets/materials/herbs/phi_van_thao/decade.png) | 256x256 | 57.9 KB |
| [`millennium.png`](../../public/assets/materials/herbs/phi_van_thao/millennium.png) | 256x256 | 72.1 KB |
| [`myriad_year.png`](../../public/assets/materials/herbs/phi_van_thao/myriad_year.png) | 256x256 | 83.2 KB |
| [`thuong_co.png`](../../public/assets/materials/herbs/phi_van_thao/thuong_co.png) | 256x256 | 57.9 KB |
| [`century.png`](../../public/assets/materials/herbs/thoi_the_thao/century.png) | 256x256 | 110.0 KB |
| [`decade.png`](../../public/assets/materials/herbs/thoi_the_thao/decade.png) | 256x256 | 82.6 KB |
| [`millennium.png`](../../public/assets/materials/herbs/thoi_the_thao/millennium.png) | 256x256 | 91.7 KB |
| [`myriad_year.png`](../../public/assets/materials/herbs/thoi_the_thao/myriad_year.png) | 256x256 | 89.2 KB |
| [`thuong_co.png`](../../public/assets/materials/herbs/thoi_the_thao/thuong_co.png) | 256x256 | 82.6 KB |
| [`century.png`](../../public/assets/materials/herbs/to_cot_thao/century.png) | 256x256 | 91.8 KB |
| [`decade.png`](../../public/assets/materials/herbs/to_cot_thao/decade.png) | 256x256 | 87.0 KB |
| [`millennium.png`](../../public/assets/materials/herbs/to_cot_thao/millennium.png) | 256x256 | 79.0 KB |
| [`myriad_year.png`](../../public/assets/materials/herbs/to_cot_thao/myriad_year.png) | 256x256 | 88.7 KB |
| [`thuong_co.png`](../../public/assets/materials/herbs/to_cot_thao/thuong_co.png) | 256x256 | 87.0 KB |
| [`century.png`](../../public/assets/materials/herbs/tu_linh_thao/century.png) | 256x256 | 95.0 KB |
| [`decade.png`](../../public/assets/materials/herbs/tu_linh_thao/decade.png) | 256x256 | 58.5 KB |
| [`millennium.png`](../../public/assets/materials/herbs/tu_linh_thao/millennium.png) | 256x256 | 94.9 KB |
| [`myriad_year.png`](../../public/assets/materials/herbs/tu_linh_thao/myriad_year.png) | 256x256 | 96.5 KB |
| [`thuong_co.png`](../../public/assets/materials/herbs/tu_linh_thao/thuong_co.png) | 256x256 | 58.5 KB |
| [`linh_khoang.png`](../../public/assets/materials/linh_khoang.png) | 256x256 | 93.8 KB |
| [`linh_moc.png`](../../public/assets/materials/linh_moc.png) | 256x256 | 86.6 KB |
</details>

### [`assets/equipment/`](../../public/assets/equipment/) — 40 ảnh, 341.4 KB

Icon trang bị items — [`equipment.ts`](../../src/data/equipment/equipment.ts) → EquipmentBagSection, EquipmentPaperdoll

<details><summary>Full file list</summary>

| File | W×H | Size |
|---|---|---|
| [`bao-01.png`](../../public/assets/equipment/items/base-bao/bao-01.png) | 64x64 | 9.9 KB |
| [`bao-02.png`](../../public/assets/equipment/items/base-bao/bao-02.png) | 64x64 | 11.9 KB |
| [`bao-03.png`](../../public/assets/equipment/items/base-bao/bao-03.png) | 64x64 | 10.0 KB |
| [`bao-04.png`](../../public/assets/equipment/items/base-bao/bao-04.png) | 64x64 | 10.1 KB |
| [`bao-05.png`](../../public/assets/equipment/items/base-bao/bao-05.png) | 64x64 | 12.1 KB |
| [`chau-01.png`](../../public/assets/equipment/items/base-chau/chau-01.png) | 64x64 | 8.3 KB |
| [`chau-02.png`](../../public/assets/equipment/items/base-chau/chau-02.png) | 64x64 | 8.5 KB |
| [`chau-03.png`](../../public/assets/equipment/items/base-chau/chau-03.png) | 64x64 | 8.3 KB |
| [`chau-04.png`](../../public/assets/equipment/items/base-chau/chau-04.png) | 64x64 | 9.3 KB |
| [`chau-05.png`](../../public/assets/equipment/items/base-chau/chau-05.png) | 64x64 | 9.5 KB |
| [`gioi-01.png`](../../public/assets/equipment/items/base-gioi/gioi-01.png) | 64x64 | 10.9 KB |
| [`gioi-02.png`](../../public/assets/equipment/items/base-gioi/gioi-02.png) | 64x64 | 10.4 KB |
| [`gioi-03.png`](../../public/assets/equipment/items/base-gioi/gioi-03.png) | 64x64 | 10.8 KB |
| [`gioi-04.png`](../../public/assets/equipment/items/base-gioi/gioi-04.png) | 64x64 | 9.6 KB |
| [`gioi-05.png`](../../public/assets/equipment/items/base-gioi/gioi-05.png) | 64x64 | 11.4 KB |
| [`hai-01.png`](../../public/assets/equipment/items/base-hai/hai-01.png) | 64x64 | 10.3 KB |
| [`hai-02.png`](../../public/assets/equipment/items/base-hai/hai-02.png) | 64x64 | 9.9 KB |
| [`hai-03.png`](../../public/assets/equipment/items/base-hai/hai-03.png) | 64x64 | 10.0 KB |
| [`hai-04.png`](../../public/assets/equipment/items/base-hai/hai-04.png) | 64x64 | 10.2 KB |
| [`hai-05.png`](../../public/assets/equipment/items/base-hai/hai-05.png) | 64x64 | 9.9 KB |
| [`kiem-01.png`](../../public/assets/equipment/items/base-kiem/kiem-01.png) | 64x64 | 6.0 KB |
| [`kiem-02.png`](../../public/assets/equipment/items/base-kiem/kiem-02.png) | 64x64 | 4.6 KB |
| [`kiem-03.png`](../../public/assets/equipment/items/base-kiem/kiem-03.png) | 64x64 | 5.3 KB |
| [`kiem-04.png`](../../public/assets/equipment/items/base-kiem/kiem-04.png) | 64x64 | 5.1 KB |
| [`kiem-05.png`](../../public/assets/equipment/items/base-kiem/kiem-05.png) | 64x64 | 5.8 KB |
| [`quan-01.png`](../../public/assets/equipment/items/base-quan/quan-01.png) | 64x64 | 8.9 KB |
| [`quan-02.png`](../../public/assets/equipment/items/base-quan/quan-02.png) | 64x64 | 8.5 KB |
| [`quan-03.png`](../../public/assets/equipment/items/base-quan/quan-03.png) | 64x64 | 10.2 KB |
| [`quan-04.png`](../../public/assets/equipment/items/base-quan/quan-04.png) | 64x64 | 8.5 KB |
| [`quan-05.png`](../../public/assets/equipment/items/base-quan/quan-05.png) | 64x64 | 8.4 KB |
| [`quyen-01.png`](../../public/assets/equipment/items/base-quyen/quyen-01.png) | 64x64 | 6.7 KB |
| [`quyen-02.png`](../../public/assets/equipment/items/base-quyen/quyen-02.png) | 64x64 | 8.7 KB |
| [`quyen-03.png`](../../public/assets/equipment/items/base-quyen/quyen-03.png) | 64x64 | 9.4 KB |
| [`quyen-04.png`](../../public/assets/equipment/items/base-quyen/quyen-04.png) | 64x64 | 7.9 KB |
| [`quyen-05.png`](../../public/assets/equipment/items/base-quyen/quyen-05.png) | 64x64 | 9.5 KB |
| [`truy-01.png`](../../public/assets/equipment/items/base-truy/truy-01.png) | 64x64 | 6.0 KB |
| [`truy-02.png`](../../public/assets/equipment/items/base-truy/truy-02.png) | 64x64 | 5.5 KB |
| [`truy-03.png`](../../public/assets/equipment/items/base-truy/truy-03.png) | 64x64 | 5.3 KB |
| [`truy-04.png`](../../public/assets/equipment/items/base-truy/truy-04.png) | 64x64 | 4.7 KB |
| [`truy-05.png`](../../public/assets/equipment/items/base-truy/truy-05.png) | 64x64 | 5.3 KB |
</details>

### [`assets/equipment-slots/`](../../public/assets/equipment-slots/) — 6 ảnh, 99.5 KB

**ORPHAN** — glyph ô trang bị, không ref trong src

<details><summary>Full file list</summary>

| File | W×H | Size |
|---|---|---|
| [`armor.png`](../../public/assets/equipment-slots/armor.png) | 156x156 | 16.6 KB |
| [`boots.png`](../../public/assets/equipment-slots/boots.png) | 156x156 | 16.6 KB |
| [`helmet.png`](../../public/assets/equipment-slots/helmet.png) | 156x156 | 16.6 KB |
| [`necklace.png`](../../public/assets/equipment-slots/necklace.png) | 156x156 | 16.6 KB |
| [`ring.png`](../../public/assets/equipment-slots/ring.png) | 156x156 | 16.6 KB |
| [`weapon.png`](../../public/assets/equipment-slots/weapon.png) | 156x156 | 16.6 KB |
</details>

### [`assets/enemies/`](../../public/assets/enemies/) — 67 ảnh, 91.4 MB

Portrait/sprite enemy — [`EnemyArt.ts`](../../src/game/support/EnemyArt.ts) (mortal 1254²) + [`MonsterArt.ts`](../../src/game/support/MonsterArt.ts) (animated atlases, combat)

<details><summary>Full file list</summary>

| File | W×H | Size |
|---|---|---|
| [`avatar.png`](../../public/assets/enemies/animated/blood-locust-elder/avatar.png) | 150x150 | 38.5 KB |
| [`blood-locust-elder-sheet-1.png`](../../public/assets/enemies/animated/blood-locust-elder/blood-locust-elder-sheet-1.png) | 3780x2583 | 6.6 MB |
| [`avatar.png`](../../public/assets/enemies/animated/bloodarm-ox-demon-ferocious/avatar.png) | 148x150 | 40.6 KB |
| [`bloodarm-ox-demon-ferocious-sheet-1.png`](../../public/assets/enemies/animated/bloodarm-ox-demon-ferocious/bloodarm-ox-demon-ferocious-sheet-1.png) | 3897x716 | 1.0 MB |
| [`avatar.png`](../../public/assets/enemies/animated/bloodarm-ox-demon/avatar.png) | 148x150 | 40.6 KB |
| [`bloodarm-ox-demon-sheet-1.png`](../../public/assets/enemies/animated/bloodarm-ox-demon/bloodarm-ox-demon-sheet-1.png) | 3897x716 | 1.0 MB |
| [`avatar.png`](../../public/assets/enemies/animated/bloodflower-tree-fiend-mudboss-ferocious/avatar.png) | 81x78 | 13.7 KB |
| [`bloodflower-tree-fiend-mudboss-ferocious-sheet-1.png`](../../public/assets/enemies/animated/bloodflower-tree-fiend-mudboss-ferocious/bloodflower-tree-fiend-mudboss-ferocious-sheet-1.png) | 3612x2735 | 8.4 MB |
| [`avatar.png`](../../public/assets/enemies/animated/bloodflower-tree-fiend-mudboss/avatar.png) | 81x78 | 13.7 KB |
| [`bloodflower-tree-fiend-mudboss-sheet-1.png`](../../public/assets/enemies/animated/bloodflower-tree-fiend-mudboss/bloodflower-tree-fiend-mudboss-sheet-1.png) | 3612x2735 | 8.5 MB |
| [`avatar.png`](../../public/assets/enemies/animated/drybranch-treant-ferocious/avatar.png) | 102x102 | 17.2 KB |
| [`drybranch-treant-ferocious-sheet-1.png`](../../public/assets/enemies/animated/drybranch-treant-ferocious/drybranch-treant-ferocious-sheet-1.png) | 3768x1884 | 2.2 MB |
| [`avatar.png`](../../public/assets/enemies/animated/drybranch-treant/avatar.png) | 102x102 | 17.2 KB |
| [`drybranch-treant-sheet-1.png`](../../public/assets/enemies/animated/drybranch-treant/drybranch-treant-sheet-1.png) | 3768x1884 | 2.2 MB |
| [`avatar.png`](../../public/assets/enemies/animated/graymane-wolf-ferocious/avatar.png) | 147x150 | 46.3 KB |
| [`graymane-wolf-ferocious-sheet-1.png`](../../public/assets/enemies/animated/graymane-wolf-ferocious/graymane-wolf-ferocious-sheet-1.png) | 4064x574 | 887.7 KB |
| [`avatar.png`](../../public/assets/enemies/animated/graymane-wolf/avatar.png) | 147x150 | 46.3 KB |
| [`graymane-wolf-sheet-1.png`](../../public/assets/enemies/animated/graymane-wolf/graymane-wolf-sheet-1.png) | 4064x574 | 847.7 KB |
| [`avatar.png`](../../public/assets/enemies/animated/mudbelly-green-toad-ferocious/avatar.png) | 512x512 | 1.1 KB |
| [`mudbelly-green-toad-ferocious-sheet-1.png`](../../public/assets/enemies/animated/mudbelly-green-toad-ferocious/mudbelly-green-toad-ferocious-sheet-1.png) | 3832x698 | 2.3 MB |
| [`avatar.png`](../../public/assets/enemies/animated/mudbelly-green-toad/avatar.png) | 512x512 | 1.1 KB |
| [`mudbelly-green-toad-sheet-1.png`](../../public/assets/enemies/animated/mudbelly-green-toad/mudbelly-green-toad-sheet-1.png) | 3832x698 | 2.2 MB |
| [`avatar.png`](../../public/assets/enemies/animated/spore-flower-spirit-ferocious/avatar.png) | 102x102 | 21.9 KB |
| [`spore-flower-spirit-ferocious-sheet-1.png`](../../public/assets/enemies/animated/spore-flower-spirit-ferocious/spore-flower-spirit-ferocious-sheet-1.png) | 3952x436 | 875.3 KB |
| [`avatar.png`](../../public/assets/enemies/animated/spore-flower-spirit/avatar.png) | 102x102 | 21.9 KB |
| [`spore-flower-spirit-sheet-1.png`](../../public/assets/enemies/animated/spore-flower-spirit/spore-flower-spirit-sheet-1.png) | 3952x436 | 889.7 KB |
| [`avatar.png`](../../public/assets/enemies/animated/streamgrudge-nymph/avatar.png) | 138x150 | 48.3 KB |
| [`streamgrudge-nymph-sheet-1.png`](../../public/assets/enemies/animated/streamgrudge-nymph/streamgrudge-nymph-sheet-1.png) | 3728x1094 | 1.8 MB |
| [`avatar.png`](../../public/assets/enemies/animated/streamscale-forkman-floodserpent-ferocious/avatar.png) | 142x150 | 44.6 KB |
| [`streamscale-forkman-floodserpent-ferocious-sheet-1.png`](../../public/assets/enemies/animated/streamscale-forkman-floodserpent-ferocious/streamscale-forkman-floodserpent-ferocious-sheet-1.png) | 3626x928 | 1.3 MB |
| [`avatar.png`](../../public/assets/enemies/animated/streamscale-forkman-floodserpent/avatar.png) | 142x150 | 44.6 KB |
| [`streamscale-forkman-floodserpent-sheet-1.png`](../../public/assets/enemies/animated/streamscale-forkman-floodserpent/streamscale-forkman-floodserpent-sheet-1.png) | 3626x928 | 1.3 MB |
| [`avatar.png`](../../public/assets/enemies/animated/tusked-mountain-boar-ferocious/avatar.png) | 102x102 | 16.7 KB |
| [`tusked-mountain-boar-ferocious-sheet-1.png`](../../public/assets/enemies/animated/tusked-mountain-boar-ferocious/tusked-mountain-boar-ferocious-sheet-1.png) | 3930x316 | 803.0 KB |
| [`avatar.png`](../../public/assets/enemies/animated/tusked-mountain-boar/avatar.png) | 102x102 | 16.7 KB |
| [`tusked-mountain-boar-sheet-1.png`](../../public/assets/enemies/animated/tusked-mountain-boar/tusked-mountain-boar-sheet-1.png) | 3930x316 | 823.8 KB |
| [`avatar.png`](../../public/assets/enemies/animated/whiteshell-venom-beetle-ferocious/avatar.png) | 512x512 | 1.1 KB |
| [`whiteshell-venom-beetle-ferocious-sheet-1.png`](../../public/assets/enemies/animated/whiteshell-venom-beetle-ferocious/whiteshell-venom-beetle-ferocious-sheet-1.png) | 3600x446 | 1.1 MB |
| [`avatar.png`](../../public/assets/enemies/animated/whiteshell-venom-beetle/avatar.png) | 512x512 | 1.1 KB |
| [`whiteshell-venom-beetle-sheet-1.png`](../../public/assets/enemies/animated/whiteshell-venom-beetle/whiteshell-venom-beetle-sheet-1.png) | 3600x446 | 1.0 MB |
| [`avatar.png`](../../public/assets/enemies/animated/witherfir-vineman/avatar.png) | 132x150 | 38.5 KB |
| [`witherfir-vineman-sheet-1.png`](../../public/assets/enemies/animated/witherfir-vineman/witherfir-vineman-sheet-1.png) | 3872x1152 | 1.6 MB |
| [`avatar.png`](../../public/assets/enemies/animated/wugu-demon-king/avatar.png) | 150x150 | 45.8 KB |
| [`wugu-demon-king-sheet-1.png`](../../public/assets/enemies/animated/wugu-demon-king/wugu-demon-king-sheet-1.png) | 3640x1842 | 2.2 MB |
| [`wugu-demon-king-sheet-2.png`](../../public/assets/enemies/animated/wugu-demon-king/wugu-demon-king-sheet-2.png) | 3640x3070 | 3.9 MB |
| [`wugu-demon-king-sheet-3.png`](../../public/assets/enemies/animated/wugu-demon-king/wugu-demon-king-sheet-3.png) | 3640x2456 | 3.4 MB |
| [`wugu-demon-king-sheet-4.png`](../../public/assets/enemies/animated/wugu-demon-king/wugu-demon-king-sheet-4.png) | 3640x3070 | 4.5 MB |
| [`mortal-feral-dog-v1.png`](../../public/assets/enemies/mortal/mortal-feral-dog-v1.png) | 1254x1254 | 912.1 KB |
| [`mortal-ferocious-feral-dog-v1.png`](../../public/assets/enemies/mortal/mortal-ferocious-feral-dog-v1.png) | 1254x1254 | 1.2 MB |
| [`mortal-ferocious-giant-crocodile-v1.png`](../../public/assets/enemies/mortal/mortal-ferocious-giant-crocodile-v1.png) | 1254x1254 | 1.7 MB |
| [`mortal-ferocious-iron-boar-v1.png`](../../public/assets/enemies/mortal/mortal-ferocious-iron-boar-v1.png) | 1254x1254 | 1.4 MB |
| [`mortal-ferocious-mountain-bandit-v1.png`](../../public/assets/enemies/mortal/mortal-ferocious-mountain-bandit-v1.png) | 1254x1254 | 1.4 MB |
| [`mortal-ferocious-mud-ox-v1.png`](../../public/assets/enemies/mortal/mortal-ferocious-mud-ox-v1.png) | 1254x1254 | 1.7 MB |
| [`mortal-ferocious-savage-tiger-v1.png`](../../public/assets/enemies/mortal/mortal-ferocious-savage-tiger-v1.png) | 1254x1254 | 2.0 MB |
| [`mortal-ferocious-silver-fox-v1.png`](../../public/assets/enemies/mortal/mortal-ferocious-silver-fox-v1.png) | 1254x1254 | 1.6 MB |
| [`mortal-ferocious-stone-lynx-v1.png`](../../public/assets/enemies/mortal/mortal-ferocious-stone-lynx-v1.png) | 1254x1254 | 1.9 MB |
| [`mortal-ferocious-water-wolf-v1.png`](../../public/assets/enemies/mortal/mortal-ferocious-water-wolf-v1.png) | 1254x1254 | 1.4 MB |
| [`mortal-ferocious-wild-boar-v1.png`](../../public/assets/enemies/mortal/mortal-ferocious-wild-boar-v1.png) | 1254x1254 | 1.5 MB |
| [`mortal-giant-crocodile-v1.png`](../../public/assets/enemies/mortal/mortal-giant-crocodile-v1.png) | 1254x1254 | 1.6 MB |
| [`mortal-iron-boar-v1.png`](../../public/assets/enemies/mortal/mortal-iron-boar-v1.png) | 1254x1254 | 1.4 MB |
| [`mortal-mountain-bandit-v1.png`](../../public/assets/enemies/mortal/mortal-mountain-bandit-v1.png) | 1254x1254 | 1.4 MB |
| [`mortal-mud-ox-v1.png`](../../public/assets/enemies/mortal/mortal-mud-ox-v1.png) | 1254x1254 | 1.6 MB |
| [`mortal-savage-tiger-v1.png`](../../public/assets/enemies/mortal/mortal-savage-tiger-v1.png) | 1254x1254 | 1.6 MB |
| [`mortal-silver-fox-v1.png`](../../public/assets/enemies/mortal/mortal-silver-fox-v1.png) | 1254x1254 | 1.5 MB |
| [`mortal-stone-lynx-v1.png`](../../public/assets/enemies/mortal/mortal-stone-lynx-v1.png) | 1254x1254 | 1.3 MB |
| [`mortal-water-wolf-v1.png`](../../public/assets/enemies/mortal/mortal-water-wolf-v1.png) | 1254x1254 | 1.1 MB |
| [`mortal-wild-boar-v1.png`](../../public/assets/enemies/mortal/mortal-wild-boar-v1.png) | 1254x1254 | 1.2 MB |
</details>

### [`assets/characters/`](../../public/assets/characters/) — 146 ảnh, 151.0 MB

Player profiles + animated roster — [`PlayerVisualProfiles.ts`](../../src/presentation/art/PlayerVisualProfiles.ts), [`CharacterArt.ts`](../../src/game/support/CharacterArt.ts) → combat + [`TranPhapPanel.vue`](../../src/components/panels/TranPhapPanel.vue) `<img>`; `*/{portrait,closeup,radar-chart,avatar/}` staged chưa load

<details><summary>Full file list</summary>

| File | W×H | Size |
|---|---|---|
| [`avatar.png`](../../public/assets/characters/animated/fenli/avatar.png) | 395x512 | 93.7 KB |
| [`fenli-battle-card-avatar.png`](../../public/assets/characters/animated/fenli/avatar/fenli-battle-card-avatar.png) | 234x235 | 46.9 KB |
| [`fenli.png`](../../public/assets/characters/animated/fenli/avatar/fenli.png) | 102x102 | 21.0 KB |
| [`fenli-sheet-1.png`](../../public/assets/characters/animated/fenli/fenli-sheet-1.png) | 3880x3000 | 6.0 MB |
| [`fenli-full-body.png`](../../public/assets/characters/animated/fenli/portrait/fenli-full-body.png) | 674x874 | 333.0 KB |
| [`fenli-half-body.png`](../../public/assets/characters/animated/fenli/portrait/fenli-half-body.png) | 674x874 | 302.1 KB |
| [`fenli-queue.png`](../../public/assets/characters/animated/fenli/portrait/fenli-queue.png) | 303x309 | 147.0 KB |
| [`avatar.png`](../../public/assets/characters/animated/gaosheng/avatar.png) | 512x512 | 232.2 KB |
| [`gaosheng-action-bar-avatar.png`](../../public/assets/characters/animated/gaosheng/avatar/gaosheng-action-bar-avatar.png) | 74x76 | 9.7 KB |
| [`gaosheng-battle-card-avatar.png`](../../public/assets/characters/animated/gaosheng/avatar/gaosheng-battle-card-avatar.png) | 234x235 | 57.0 KB |
| [`gaosheng-battle-status-avatar.png`](../../public/assets/characters/animated/gaosheng/avatar/gaosheng-battle-status-avatar.png) | 242x200 | 47.8 KB |
| [`gaosheng-roster-avatar.png`](../../public/assets/characters/animated/gaosheng/avatar/gaosheng-roster-avatar.png) | 280x131 | 67.6 KB |
| [`gaosheng.png`](../../public/assets/characters/animated/gaosheng/avatar/gaosheng.png) | 102x102 | 24.9 KB |
| [`gaosheng-bloodfate-unyielding-closeup.png`](../../public/assets/characters/animated/gaosheng/closeup/gaosheng-bloodfate-unyielding-closeup.png) | 1254x1254 | 1.2 MB |
| [`gaosheng-sheet-1.png`](../../public/assets/characters/animated/gaosheng/gaosheng-sheet-1.png) | 3732x2468 | 4.4 MB |
| [`gaosheng-sheet-2.png`](../../public/assets/characters/animated/gaosheng/gaosheng-sheet-2.png) | 3732x2468 | 4.5 MB |
| [`gaosheng-full-body.png`](../../public/assets/characters/animated/gaosheng/portrait/gaosheng-full-body.png) | 1254x1254 | 1.5 MB |
| [`gaosheng-half-body.png`](../../public/assets/characters/animated/gaosheng/portrait/gaosheng-half-body.png) | 883x662 | 640.9 KB |
| [`gaosheng-queue.png`](../../public/assets/characters/animated/gaosheng/portrait/gaosheng-queue.png) | 325x327 | 249.5 KB |
| [`gaosheng-main-menu-radar.png`](../../public/assets/characters/animated/gaosheng/radar-chart/gaosheng-main-menu-radar.png) | 331x318 | 126.2 KB |
| [`gaosheng-zhenmosi-radar.png`](../../public/assets/characters/animated/gaosheng/radar-chart/gaosheng-zhenmosi-radar.png) | 344x340 | 178.2 KB |
| [`avatar.png`](../../public/assets/characters/animated/jinglian/avatar.png) | 395x512 | 94.0 KB |
| [`jinglian-battle-card-avatar.png`](../../public/assets/characters/animated/jinglian/avatar/jinglian-battle-card-avatar.png) | 234x235 | 45.8 KB |
| [`jinglian.png`](../../public/assets/characters/animated/jinglian/avatar/jinglian.png) | 102x102 | 21.8 KB |
| [`jinglian-sheet-1.png`](../../public/assets/characters/animated/jinglian/jinglian-sheet-1.png) | 3888x1264 | 3.4 MB |
| [`jinglian-full-body.png`](../../public/assets/characters/animated/jinglian/portrait/jinglian-full-body.png) | 674x874 | 323.3 KB |
| [`jinglian-half-body.png`](../../public/assets/characters/animated/jinglian/portrait/jinglian-half-body.png) | 674x874 | 296.2 KB |
| [`jinglian-queue.png`](../../public/assets/characters/animated/jinglian/portrait/jinglian-queue.png) | 303x309 | 184.9 KB |
| [`avatar.png`](../../public/assets/characters/animated/ngu_hanh/avatar.png) | 512x512 | 231.8 KB |
| [`ngu_hanh-sheet-1.png`](../../public/assets/characters/animated/ngu_hanh/ngu_hanh-sheet-1.png) | 3766x2745 | 4.5 MB |
| [`ngu_hanh-sheet-2.png`](../../public/assets/characters/animated/ngu_hanh/ngu_hanh-sheet-2.png) | 3766x2745 | 4.1 MB |
| [`ngu_hanh-sheet-3.png`](../../public/assets/characters/animated/ngu_hanh/ngu_hanh-sheet-3.png) | 3766x1647 | 2.4 MB |
| [`avatar.png`](../../public/assets/characters/animated/ngu_kiem/avatar.png) | 512x512 | 196.4 KB |
| [`ngu_kiem-sheet-1.png`](../../public/assets/characters/animated/ngu_kiem/ngu_kiem-sheet-1.png) | 3978x3832 | 6.8 MB |
| [`avatar.png`](../../public/assets/characters/animated/pham_nhan/avatar.png) | 512x512 | 169.1 KB |
| [`pham_nhan-sheet-1.png`](../../public/assets/characters/animated/pham_nhan/pham_nhan-sheet-1.png) | 3752x2690 | 3.2 MB |
| [`pham_nhan-sheet-2.png`](../../public/assets/characters/animated/pham_nhan/pham_nhan-sheet-2.png) | 3752x2690 | 3.0 MB |
| [`avatar.png`](../../public/assets/characters/animated/pham_nhan_unarmed/avatar.png) | 512x512 | 155.1 KB |
| [`pham_nhan_unarmed-sheet-1.png`](../../public/assets/characters/animated/pham_nhan_unarmed/pham_nhan_unarmed-sheet-1.png) | 4016x3640 | 4.4 MB |
| [`pham_nhan_unarmed-sheet-2.png`](../../public/assets/characters/animated/pham_nhan_unarmed/pham_nhan_unarmed-sheet-2.png) | 4016x2600 | 3.2 MB |
| [`avatar.png`](../../public/assets/characters/animated/qingshuangzi/avatar.png) | 512x512 | 210.9 KB |
| [`qingshuangzi-action-bar-avatar.png`](../../public/assets/characters/animated/qingshuangzi/avatar/qingshuangzi-action-bar-avatar.png) | 74x76 | 9.1 KB |
| [`qingshuangzi-battle-card-avatar.png`](../../public/assets/characters/animated/qingshuangzi/avatar/qingshuangzi-battle-card-avatar.png) | 234x235 | 62.7 KB |
| [`qingshuangzi-battle-status-avatar.png`](../../public/assets/characters/animated/qingshuangzi/avatar/qingshuangzi-battle-status-avatar.png) | 242x200 | 84.9 KB |
| [`qingshuangzi-roster-avatar.png`](../../public/assets/characters/animated/qingshuangzi/avatar/qingshuangzi-roster-avatar.png) | 280x131 | 58.9 KB |
| [`qingshuangzi.png`](../../public/assets/characters/animated/qingshuangzi/avatar/qingshuangzi.png) | 102x102 | 22.9 KB |
| [`qingshuangzi-sky-thunder-prison-closeup.png`](../../public/assets/characters/animated/qingshuangzi/closeup/qingshuangzi-sky-thunder-prison-closeup.png) | 1254x1254 | 1.8 MB |
| [`qingshuangzi-full-body.png`](../../public/assets/characters/animated/qingshuangzi/portrait/qingshuangzi-full-body.png) | 1254x1254 | 1.2 MB |
| [`qingshuangzi-half-body.png`](../../public/assets/characters/animated/qingshuangzi/portrait/qingshuangzi-half-body.png) | 883x662 | 463.6 KB |
| [`qingshuangzi-queue.png`](../../public/assets/characters/animated/qingshuangzi/portrait/qingshuangzi-queue.png) | 325x327 | 225.2 KB |
| [`qingshuangzi-sheet-1.png`](../../public/assets/characters/animated/qingshuangzi/qingshuangzi-sheet-1.png) | 3672x3822 | 10.4 MB |
| [`qingshuangzi-main-menu-radar.png`](../../public/assets/characters/animated/qingshuangzi/radar-chart/qingshuangzi-main-menu-radar.png) | 331x317 | 126.0 KB |
| [`qingshuangzi-zhenmosi-radar.png`](../../public/assets/characters/animated/qingshuangzi/radar-chart/qingshuangzi-zhenmosi-radar.png) | 344x340 | 178.6 KB |
| [`avatar.png`](../../public/assets/characters/animated/weiqi/avatar.png) | 395x512 | 90.4 KB |
| [`weiqi-battle-card-avatar.png`](../../public/assets/characters/animated/weiqi/avatar/weiqi-battle-card-avatar.png) | 234x235 | 55.6 KB |
| [`weiqi.png`](../../public/assets/characters/animated/weiqi/avatar/weiqi.png) | 102x102 | 23.7 KB |
| [`weiqi-full-body.png`](../../public/assets/characters/animated/weiqi/portrait/weiqi-full-body.png) | 674x874 | 328.1 KB |
| [`weiqi-half-body.png`](../../public/assets/characters/animated/weiqi/portrait/weiqi-half-body.png) | 674x874 | 307.7 KB |
| [`weiqi-queue.png`](../../public/assets/characters/animated/weiqi/portrait/weiqi-queue.png) | 303x309 | 222.0 KB |
| [`weiqi-sheet-1.png`](../../public/assets/characters/animated/weiqi/weiqi-sheet-1.png) | 4088x939 | 2.1 MB |
| [`avatar.png`](../../public/assets/characters/animated/xuandao/avatar.png) | 395x512 | 140.7 KB |
| [`xuandao-battle-card-avatar.png`](../../public/assets/characters/animated/xuandao/avatar/xuandao-battle-card-avatar.png) | 234x235 | 29.5 KB |
| [`xuandao.png`](../../public/assets/characters/animated/xuandao/avatar/xuandao.png) | 102x102 | 12.3 KB |
| [`xuandao-full-body.png`](../../public/assets/characters/animated/xuandao/portrait/xuandao-full-body.png) | 674x874 | 502.7 KB |
| [`xuandao-half-body.png`](../../public/assets/characters/animated/xuandao/portrait/xuandao-half-body.png) | 674x874 | 502.7 KB |
| [`xuandao-queue.png`](../../public/assets/characters/animated/xuandao/portrait/xuandao-queue.png) | 303x309 | 138.0 KB |
| [`xuandao-sheet-1.png`](../../public/assets/characters/animated/xuandao/xuandao-sheet-1.png) | 3912x1865 | 3.6 MB |
| [`avatar.png`](../../public/assets/characters/animated/youzhu/avatar.png) | 512x512 | 192.9 KB |
| [`youzhu-action-bar-avatar.png`](../../public/assets/characters/animated/youzhu/avatar/youzhu-action-bar-avatar.png) | 74x76 | 9.7 KB |
| [`youzhu-battle-card-avatar.png`](../../public/assets/characters/animated/youzhu/avatar/youzhu-battle-card-avatar.png) | 234x235 | 50.7 KB |
| [`youzhu-battle-status-avatar.png`](../../public/assets/characters/animated/youzhu/avatar/youzhu-battle-status-avatar.png) | 242x200 | 42.9 KB |
| [`youzhu-roster-avatar.png`](../../public/assets/characters/animated/youzhu/avatar/youzhu-roster-avatar.png) | 280x131 | 54.2 KB |
| [`youzhu.png`](../../public/assets/characters/animated/youzhu/avatar/youzhu.png) | 102x102 | 23.0 KB |
| [`youzhu-greenwood-revival-closeup.png`](../../public/assets/characters/animated/youzhu/closeup/youzhu-greenwood-revival-closeup.png) | 1254x1254 | 1.7 MB |
| [`youzhu-full-body.png`](../../public/assets/characters/animated/youzhu/portrait/youzhu-full-body.png) | 1254x1254 | 1.1 MB |
| [`youzhu-half-body.png`](../../public/assets/characters/animated/youzhu/portrait/youzhu-half-body.png) | 883x662 | 503.5 KB |
| [`youzhu-queue.png`](../../public/assets/characters/animated/youzhu/portrait/youzhu-queue.png) | 325x327 | 210.3 KB |
| [`youzhu-main-menu-radar.png`](../../public/assets/characters/animated/youzhu/radar-chart/youzhu-main-menu-radar.png) | 331x317 | 125.9 KB |
| [`youzhu-zhenmosi-radar.png`](../../public/assets/characters/animated/youzhu/radar-chart/youzhu-zhenmosi-radar.png) | 344x340 | 178.5 KB |
| [`youzhu-sheet-1.png`](../../public/assets/characters/animated/youzhu/youzhu-sheet-1.png) | 3564x2508 | 4.9 MB |
| [`youzhu-sheet-2.png`](../../public/assets/characters/animated/youzhu/youzhu-sheet-2.png) | 3564x2508 | 5.2 MB |
| [`avatar.png`](../../public/assets/characters/animated/yuejianxin/avatar.png) | 512x512 | 268.4 KB |
| [`yuejianxin-action-bar-avatar.png`](../../public/assets/characters/animated/yuejianxin/avatar/yuejianxin-action-bar-avatar.png) | 74x76 | 9.6 KB |
| [`yuejianxin-battle-card-avatar.png`](../../public/assets/characters/animated/yuejianxin/avatar/yuejianxin-battle-card-avatar.png) | 234x235 | 62.7 KB |
| [`yuejianxin-battle-status-avatar.png`](../../public/assets/characters/animated/yuejianxin/avatar/yuejianxin-battle-status-avatar.png) | 242x200 | 65.4 KB |
| [`yuejianxin-roster-avatar.png`](../../public/assets/characters/animated/yuejianxin/avatar/yuejianxin-roster-avatar.png) | 280x131 | 69.1 KB |
| [`yuejianxin.png`](../../public/assets/characters/animated/yuejianxin/avatar/yuejianxin.png) | 102x102 | 22.7 KB |
| [`yuejianxin.png`](../../public/assets/characters/animated/yuejianxin/closeup/yuejianxin.png) | 1254x1254 | 1.4 MB |
| [`yuejianxin-full-body.png`](../../public/assets/characters/animated/yuejianxin/portrait/yuejianxin-full-body.png) | 1254x1254 | 1.6 MB |
| [`yuejianxin-half-body.png`](../../public/assets/characters/animated/yuejianxin/portrait/yuejianxin-half-body.png) | 883x662 | 475.8 KB |
| [`yuejianxin-queue.png`](../../public/assets/characters/animated/yuejianxin/portrait/yuejianxin-queue.png) | 325x327 | 230.3 KB |
| [`yuejianxin-main-menu-radar.png`](../../public/assets/characters/animated/yuejianxin/radar-chart/yuejianxin-main-menu-radar.png) | 331x318 | 125.8 KB |
| [`yuejianxin-zhenmosi-radar.png`](../../public/assets/characters/animated/yuejianxin/radar-chart/yuejianxin-zhenmosi-radar.png) | 344x340 | 177.7 KB |
| [`yuejianxin-sheet-1.png`](../../public/assets/characters/animated/yuejianxin/yuejianxin-sheet-1.png) | 3720x2064 | 3.2 MB |
| [`yuejianxin-sheet-2.png`](../../public/assets/characters/animated/yuejianxin/yuejianxin-sheet-2.png) | 3720x2752 | 3.6 MB |
| [`avatar.png`](../../public/assets/characters/animated/ziyuan/avatar.png) | 395x512 | 115.4 KB |
| [`ziyuan-battle-card-avatar.png`](../../public/assets/characters/animated/ziyuan/avatar/ziyuan-battle-card-avatar.png) | 234x235 | 75.4 KB |
| [`ziyuan.png`](../../public/assets/characters/animated/ziyuan/avatar/ziyuan.png) | 102x102 | 20.9 KB |
| [`ziyuan-full-body.png`](../../public/assets/characters/animated/ziyuan/portrait/ziyuan-full-body.png) | 674x874 | 412.6 KB |
| [`ziyuan-half-body.png`](../../public/assets/characters/animated/ziyuan/portrait/ziyuan-half-body.png) | 674x874 | 389.1 KB |
| [`ziyuan-queue.png`](../../public/assets/characters/animated/ziyuan/portrait/ziyuan-queue.png) | 303x309 | 176.2 KB |
| [`ziyuan-sheet-1.png`](../../public/assets/characters/animated/ziyuan/ziyuan-sheet-1.png) | 4043x1380 | 2.8 MB |
| [`avatar.png`](../../public/assets/characters/animated/zuofeng/avatar.png) | 512x512 | 200.6 KB |
| [`zuofeng-action-bar-avatar.png`](../../public/assets/characters/animated/zuofeng/avatar/zuofeng-action-bar-avatar.png) | 74x76 | 9.3 KB |
| [`zuofeng-battle-card-avatar.png`](../../public/assets/characters/animated/zuofeng/avatar/zuofeng-battle-card-avatar.png) | 234x235 | 51.9 KB |
| [`zuofeng-battle-status-avatar.png`](../../public/assets/characters/animated/zuofeng/avatar/zuofeng-battle-status-avatar.png) | 242x200 | 69.2 KB |
| [`zuofeng-roster-avatar.png`](../../public/assets/characters/animated/zuofeng/avatar/zuofeng-roster-avatar.png) | 280x131 | 68.4 KB |
| [`zuofeng.png`](../../public/assets/characters/animated/zuofeng/avatar/zuofeng.png) | 102x102 | 22.9 KB |
| [`zuofeng-sky-sword-closeup.png`](../../public/assets/characters/animated/zuofeng/closeup/zuofeng-sky-sword-closeup.png) | 1254x1254 | 1.0 MB |
| [`zuofeng-full-body.png`](../../public/assets/characters/animated/zuofeng/portrait/zuofeng-full-body.png) | 1254x1254 | 1.2 MB |
| [`zuofeng-half-body.png`](../../public/assets/characters/animated/zuofeng/portrait/zuofeng-half-body.png) | 883x662 | 451.5 KB |
| [`zuofeng-queue.png`](../../public/assets/characters/animated/zuofeng/portrait/zuofeng-queue.png) | 325x327 | 234.7 KB |
| [`zuofeng-main-menu-radar.png`](../../public/assets/characters/animated/zuofeng/radar-chart/zuofeng-main-menu-radar.png) | 331x318 | 127.4 KB |
| [`zuofeng-zhenmosi-radar.png`](../../public/assets/characters/animated/zuofeng/radar-chart/zuofeng-zhenmosi-radar.png) | 344x340 | 178.2 KB |
| [`zuofeng-sheet-1.png`](../../public/assets/characters/animated/zuofeng/zuofeng-sheet-1.png) | 3540x1822 | 2.5 MB |
| [`zuofeng-sheet-2.png`](../../public/assets/characters/animated/zuofeng/zuofeng-sheet-2.png) | 3540x2733 | 6.5 MB |
| [`zuofeng-sheet-3.png`](../../public/assets/characters/animated/zuofeng/zuofeng-sheet-3.png) | 3540x2733 | 4.7 MB |
| [`combat-anim-32frame.png`](../../public/assets/characters/placeholder/combat-anim-32frame.png) | 776x1128 | 122.1 KB |
| [`entity-placeholder.png`](../../public/assets/characters/placeholder/entity-placeholder.png) | 128x128 | 2.5 KB |
| [`player-kiem-tu-cultivate-v1.png`](../../public/assets/characters/player/kiem-tu/player-kiem-tu-cultivate-v1.png) | 1312x1199 | 1.9 MB |
| [`player-kiem-tu-equipment-set-04-no-guan-concept-v2.png`](../../public/assets/characters/player/kiem-tu/player-kiem-tu-equipment-set-04-no-guan-concept-v2.png) | 1218x1292 | 1.4 MB |
| [`player-kiem-tu-one-sword-black-white-concept-v2.png`](../../public/assets/characters/player/kiem-tu/player-kiem-tu-one-sword-black-white-concept-v2.png) | 1268x1241 | 1.5 MB |
| [`player-kiem-tu-one-sword-black-white-concept-v3.png`](../../public/assets/characters/player/kiem-tu/player-kiem-tu-one-sword-black-white-concept-v3.png) | 1230x1278 | 1.4 MB |
| [`player-kiem-tu-seven-swords-concept-v5.png`](../../public/assets/characters/player/kiem-tu/player-kiem-tu-seven-swords-concept-v5.png) | 1254x1254 | 1.7 MB |
| [`player-kiem-tu-v1.png`](../../public/assets/characters/player/kiem-tu/player-kiem-tu-v1.png) | 744x744 | 63.1 KB |
| [`player-mortal-idle-v1-frame-00.png`](../../public/assets/characters/player/mortal/idle/player-mortal-idle-v1-frame-00.png) | 256x256 | 70.3 KB |
| [`player-mortal-idle-v1-frame-01.png`](../../public/assets/characters/player/mortal/idle/player-mortal-idle-v1-frame-01.png) | 256x256 | 41.8 KB |
| [`player-mortal-idle-v1-frame-02.png`](../../public/assets/characters/player/mortal/idle/player-mortal-idle-v1-frame-02.png) | 256x256 | 40.9 KB |
| [`player-mortal-idle-v1-frame-03.png`](../../public/assets/characters/player/mortal/idle/player-mortal-idle-v1-frame-03.png) | 256x256 | 39.9 KB |
| [`player-mortal-idle-v1-frame-04.png`](../../public/assets/characters/player/mortal/idle/player-mortal-idle-v1-frame-04.png) | 256x256 | 39.0 KB |
| [`player-mortal-idle-v1.png`](../../public/assets/characters/player/mortal/idle/player-mortal-idle-v1.png) | 1280x256 | 158.5 KB |
| [`player-mortal-combat-atlas-v1.png`](../../public/assets/characters/player/mortal/player-mortal-combat-atlas-v1.png) | 1280x896 | 177.4 KB |
| [`player-mortal-combat-atlas-v2.png`](../../public/assets/characters/player/mortal/player-mortal-combat-atlas-v2.png) | 850x1265 | 901.6 KB |
| [`player-mortal-cultivate-v1.png`](../../public/assets/characters/player/mortal/player-mortal-cultivate-v1.png) | 1233x1275 | 1.4 MB |
| [`player-mortal-cultivate-v2.png`](../../public/assets/characters/player/mortal/player-mortal-cultivate-v2.png) | 1254x1254 | 1.7 MB |
| [`player-mortal-ink-sword-concept-v2.png`](../../public/assets/characters/player/mortal/player-mortal-ink-sword-concept-v2.png) | 1312x1199 | 1.5 MB |
| [`player-mortal-pham-nhan-v1.png`](../../public/assets/characters/player/mortal/player-mortal-pham-nhan-v1.png) | 744x744 | 60.6 KB |
| [`player-mortal-v1.png`](../../public/assets/characters/player/mortal/player-mortal-v1.png) | 1244x1264 | 1.4 MB |
| [`player-mortal-sword-ready-v1.png`](../../public/assets/characters/player/mortal/poses/player-mortal-sword-ready-v1.png) | 256x256 | 50.3 KB |
| [`player-mortal-unarmed-ready-v1.png`](../../public/assets/characters/player/mortal/poses/player-mortal-unarmed-ready-v1.png) | 256x256 | 45.0 KB |
| [`player-phap-tu-an-cultivate-van-dao-v1.png`](../../public/assets/characters/player/phap-tu/player-phap-tu-an-cultivate-van-dao-v1.png) | 1254x1254 | 2.2 MB |
| [`player-phap-tu-cultivate-ngu-hanh-v1.png`](../../public/assets/characters/player/phap-tu/player-phap-tu-cultivate-ngu-hanh-v1.png) | 1254x1254 | 2.0 MB |
| [`player-phap-tu-ngu-hanh-v1.png`](../../public/assets/characters/player/phap-tu/player-phap-tu-ngu-hanh-v1.png) | 732x756 | 82.9 KB |
| [`player-phap-tu-v1.png`](../../public/assets/characters/player/phap-tu/player-phap-tu-v1.png) | 1293x1216 | 1.7 MB |
| [`spell-cultivator.png`](../../public/assets/characters/spell-cultivator/spell-cultivator.png) | 941x1672 | 1.3 MB |
| [`sword-cultivator.png`](../../public/assets/characters/sword-cultivator/sword-cultivator.png) | 941x1672 | 1.3 MB |
</details>

### [`assets/backgrounds/`](../../public/assets/backgrounds/) — 115 ảnh, 200.5 MB

Màn nền modular — [`DongFuScene.vue`](../../src/components/game/DongFuScene.vue) (dong-fu `<img>` stack), [`ThanhVanBackdropArt.ts`](../../src/presentation/background/ThanhVanBackdropArt.ts) (thanh-van 7 lớp CombatScene)

<details><summary>Full file list</summary>

| File | W×H | Size |
|---|---|---|
| [`dong-fu-layout-preview.png`](../../public/assets/backgrounds/dong-fu/dong-fu-layout-preview.png) | 1672x941 | 2.6 MB |
| [`all-16-contact-sheet.png`](../../public/assets/backgrounds/dong-fu/modular/previews/all-16-contact-sheet.png) | 1696x1084 | 2.2 MB |
| [`autumn-evening.png`](../../public/assets/backgrounds/dong-fu/modular/previews/autumn-evening.png) | 1672x941 | 2.7 MB |
| [`autumn-morning.png`](../../public/assets/backgrounds/dong-fu/modular/previews/autumn-morning.png) | 1672x941 | 2.7 MB |
| [`autumn-night.png`](../../public/assets/backgrounds/dong-fu/modular/previews/autumn-night.png) | 1672x941 | 2.5 MB |
| [`autumn-noon.png`](../../public/assets/backgrounds/dong-fu/modular/previews/autumn-noon.png) | 1672x941 | 2.7 MB |
| [`spring-evening.png`](../../public/assets/backgrounds/dong-fu/modular/previews/spring-evening.png) | 1672x941 | 2.8 MB |
| [`spring-morning.png`](../../public/assets/backgrounds/dong-fu/modular/previews/spring-morning.png) | 1672x941 | 2.7 MB |
| [`spring-night.png`](../../public/assets/backgrounds/dong-fu/modular/previews/spring-night.png) | 1672x941 | 2.5 MB |
| [`spring-noon.png`](../../public/assets/backgrounds/dong-fu/modular/previews/spring-noon.png) | 1672x941 | 2.7 MB |
| [`summer-evening.png`](../../public/assets/backgrounds/dong-fu/modular/previews/summer-evening.png) | 1672x941 | 2.7 MB |
| [`summer-morning.png`](../../public/assets/backgrounds/dong-fu/modular/previews/summer-morning.png) | 1672x941 | 2.7 MB |
| [`summer-night.png`](../../public/assets/backgrounds/dong-fu/modular/previews/summer-night.png) | 1672x941 | 2.5 MB |
| [`summer-noon.png`](../../public/assets/backgrounds/dong-fu/modular/previews/summer-noon.png) | 1672x941 | 2.7 MB |
| [`winter-evening.png`](../../public/assets/backgrounds/dong-fu/modular/previews/winter-evening.png) | 1672x941 | 2.8 MB |
| [`winter-morning.png`](../../public/assets/backgrounds/dong-fu/modular/previews/winter-morning.png) | 1672x941 | 2.7 MB |
| [`winter-night.png`](../../public/assets/backgrounds/dong-fu/modular/previews/winter-night.png) | 1672x941 | 2.5 MB |
| [`winter-noon.png`](../../public/assets/backgrounds/dong-fu/modular/previews/winter-noon.png) | 1672x941 | 2.7 MB |
| [`03-far-mountains.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/autumn/03-far-mountains.png) | 1672x941 | 610.2 KB |
| [`04-distant-ledges.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/autumn/04-distant-ledges.png) | 1672x941 | 679.8 KB |
| [`05-mid-landscape.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/autumn/05-mid-landscape.png) | 1672x941 | 1.2 MB |
| [`06-water-valley.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/autumn/06-water-valley.png) | 1672x941 | 1.1 MB |
| [`07-sect-ground.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/autumn/07-sect-ground.png) | 1672x941 | 2.5 MB |
| [`08-low-mist.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/autumn/08-low-mist.png) | 1672x941 | 1.4 MB |
| [`09-foreground.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/autumn/09-foreground.png) | 1672x941 | 695.4 KB |
| [`03-far-mountains.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/spring/03-far-mountains.png) | 1672x941 | 486.0 KB |
| [`04-distant-ledges.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/spring/04-distant-ledges.png) | 1672x941 | 765.7 KB |
| [`05-mid-landscape.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/spring/05-mid-landscape.png) | 1672x941 | 1.3 MB |
| [`06-water-valley.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/spring/06-water-valley.png) | 1672x941 | 1.1 MB |
| [`07-sect-ground.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/spring/07-sect-ground.png) | 1672x941 | 2.5 MB |
| [`08-low-mist.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/spring/08-low-mist.png) | 1672x941 | 1.1 MB |
| [`09-foreground.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/spring/09-foreground.png) | 1672x941 | 855.4 KB |
| [`03-far-mountains.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/summer/03-far-mountains.png) | 1672x941 | 527.5 KB |
| [`04-distant-ledges.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/summer/04-distant-ledges.png) | 1672x941 | 623.5 KB |
| [`05-mid-landscape.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/summer/05-mid-landscape.png) | 1672x941 | 1.2 MB |
| [`06-water-valley.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/summer/06-water-valley.png) | 1672x941 | 956.6 KB |
| [`07-sect-ground.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/summer/07-sect-ground.png) | 1672x941 | 2.6 MB |
| [`08-low-mist.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/summer/08-low-mist.png) | 1672x941 | 1.8 MB |
| [`09-foreground.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/summer/09-foreground.png) | 1672x941 | 690.9 KB |
| [`03-far-mountains.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/winter/03-far-mountains.png) | 1672x941 | 491.4 KB |
| [`04-distant-ledges.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/winter/04-distant-ledges.png) | 1672x941 | 598.6 KB |
| [`05-mid-landscape.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/winter/05-mid-landscape.png) | 1672x941 | 1.1 MB |
| [`06-water-valley.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/winter/06-water-valley.png) | 1672x941 | 918.7 KB |
| [`07-sect-ground.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/winter/07-sect-ground.png) | 1672x941 | 2.4 MB |
| [`08-low-mist.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/winter/08-low-mist.png) | 1672x941 | 1.3 MB |
| [`09-foreground.png`](../../public/assets/backgrounds/dong-fu/modular/seasons/winter/09-foreground.png) | 1672x941 | 791.4 KB |
| [`00-sky.png`](../../public/assets/backgrounds/dong-fu/modular/times/evening/00-sky.png) | 1672x941 | 2.1 MB |
| [`01-high-clouds.png`](../../public/assets/backgrounds/dong-fu/modular/times/evening/01-high-clouds.png) | 1672x941 | 675.6 KB |
| [`02-light-veil.png`](../../public/assets/backgrounds/dong-fu/modular/times/evening/02-light-veil.png) | 1672x941 | 1.6 MB |
| [`00-sky.png`](../../public/assets/backgrounds/dong-fu/modular/times/morning/00-sky.png) | 1672x941 | 1.6 MB |
| [`01-high-clouds.png`](../../public/assets/backgrounds/dong-fu/modular/times/morning/01-high-clouds.png) | 1672x941 | 686.1 KB |
| [`02-light-veil.png`](../../public/assets/backgrounds/dong-fu/modular/times/morning/02-light-veil.png) | 1672x941 | 678.2 KB |
| [`00-sky.png`](../../public/assets/backgrounds/dong-fu/modular/times/night/00-sky.png) | 1672x941 | 2.0 MB |
| [`01-high-clouds.png`](../../public/assets/backgrounds/dong-fu/modular/times/night/01-high-clouds.png) | 1672x941 | 664.9 KB |
| [`02-light-veil.png`](../../public/assets/backgrounds/dong-fu/modular/times/night/02-light-veil.png) | 1672x941 | 747.6 KB |
| [`00-sky.png`](../../public/assets/backgrounds/dong-fu/modular/times/noon/00-sky.png) | 1672x941 | 1.4 MB |
| [`01-high-clouds.png`](../../public/assets/backgrounds/dong-fu/modular/times/noon/01-high-clouds.png) | 1672x941 | 600.2 KB |
| [`02-light-veil.png`](../../public/assets/backgrounds/dong-fu/modular/times/noon/02-light-veil.png) | 1672x941 | 729.9 KB |
| [`thanh-van-dong-fu-base.png`](../../public/assets/backgrounds/dong-fu/thanh-van-dong-fu-base.png) | 1672x941 | 2.6 MB |
| [`thanh-van-dong-fu-master-buildings-v1.png`](../../public/assets/backgrounds/dong-fu/thanh-van-dong-fu-master-buildings-v1.png) | 1672x941 | 2.8 MB |
| [`all-16-contact-sheet.png`](../../public/assets/backgrounds/thanh-van/modular/previews/all-16-contact-sheet.png) | 1664x1188 | 8.4 MB |
| [`autumn-evening.png`](../../public/assets/backgrounds/thanh-van/modular/previews/autumn-evening.png) | 1672x941 | 2.4 MB |
| [`autumn-morning.png`](../../public/assets/backgrounds/thanh-van/modular/previews/autumn-morning.png) | 1672x941 | 2.5 MB |
| [`autumn-night.png`](../../public/assets/backgrounds/thanh-van/modular/previews/autumn-night.png) | 1672x941 | 1.9 MB |
| [`autumn-noon.png`](../../public/assets/backgrounds/thanh-van/modular/previews/autumn-noon.png) | 1672x941 | 2.5 MB |
| [`seasons-contact-sheet.png`](../../public/assets/backgrounds/thanh-van/modular/previews/seasons-contact-sheet.png) | 1448x950 | 6.3 MB |
| [`spring-evening.png`](../../public/assets/backgrounds/thanh-van/modular/previews/spring-evening.png) | 1672x941 | 2.3 MB |
| [`spring-morning.png`](../../public/assets/backgrounds/thanh-van/modular/previews/spring-morning.png) | 1672x941 | 2.3 MB |
| [`spring-night.png`](../../public/assets/backgrounds/thanh-van/modular/previews/spring-night.png) | 1672x941 | 1.8 MB |
| [`spring-noon.png`](../../public/assets/backgrounds/thanh-van/modular/previews/spring-noon.png) | 1672x941 | 2.4 MB |
| [`summer-evening.png`](../../public/assets/backgrounds/thanh-van/modular/previews/summer-evening.png) | 1672x941 | 2.5 MB |
| [`summer-morning.png`](../../public/assets/backgrounds/thanh-van/modular/previews/summer-morning.png) | 1672x941 | 2.6 MB |
| [`summer-night.png`](../../public/assets/backgrounds/thanh-van/modular/previews/summer-night.png) | 1672x941 | 1.9 MB |
| [`summer-noon.png`](../../public/assets/backgrounds/thanh-van/modular/previews/summer-noon.png) | 1672x941 | 2.6 MB |
| [`winter-evening.png`](../../public/assets/backgrounds/thanh-van/modular/previews/winter-evening.png) | 1672x941 | 2.4 MB |
| [`winter-morning.png`](../../public/assets/backgrounds/thanh-van/modular/previews/winter-morning.png) | 1672x941 | 2.5 MB |
| [`winter-night.png`](../../public/assets/backgrounds/thanh-van/modular/previews/winter-night.png) | 1672x941 | 1.8 MB |
| [`winter-noon.png`](../../public/assets/backgrounds/thanh-van/modular/previews/winter-noon.png) | 1672x941 | 2.5 MB |
| [`01-far-mountains.png`](../../public/assets/backgrounds/thanh-van/modular/seasons/autumn/01-far-mountains.png) | 1672x941 | 1.4 MB |
| [`02-midground.png`](../../public/assets/backgrounds/thanh-van/modular/seasons/autumn/02-midground.png) | 1672x941 | 1.9 MB |
| [`03-battle-ground.png`](../../public/assets/backgrounds/thanh-van/modular/seasons/autumn/03-battle-ground.png) | 1672x941 | 1.2 MB |
| [`04-foreground-left.png`](../../public/assets/backgrounds/thanh-van/modular/seasons/autumn/04-foreground-left.png) | 1672x941 | 1.7 MB |
| [`05-foreground-right.png`](../../public/assets/backgrounds/thanh-van/modular/seasons/autumn/05-foreground-right.png) | 1672x941 | 706.3 KB |
| [`06-atmosphere.png`](../../public/assets/backgrounds/thanh-van/modular/seasons/autumn/06-atmosphere.png) | 1672x941 | 780.3 KB |
| [`01-far-mountains.png`](../../public/assets/backgrounds/thanh-van/modular/seasons/spring/01-far-mountains.png) | 1672x941 | 1.2 MB |
| [`02-midground.png`](../../public/assets/backgrounds/thanh-van/modular/seasons/spring/02-midground.png) | 1672x941 | 1.7 MB |
| [`03-battle-ground.png`](../../public/assets/backgrounds/thanh-van/modular/seasons/spring/03-battle-ground.png) | 1672x941 | 1.8 MB |
| [`04-foreground-left.png`](../../public/assets/backgrounds/thanh-van/modular/seasons/spring/04-foreground-left.png) | 1672x941 | 1.5 MB |
| [`05-foreground-right.png`](../../public/assets/backgrounds/thanh-van/modular/seasons/spring/05-foreground-right.png) | 1672x941 | 1.3 MB |
| [`06-atmosphere.png`](../../public/assets/backgrounds/thanh-van/modular/seasons/spring/06-atmosphere.png) | 1672x941 | 576.0 KB |
| [`01-far-mountains.png`](../../public/assets/backgrounds/thanh-van/modular/seasons/summer/01-far-mountains.png) | 1672x941 | 1.3 MB |
| [`02-midground.png`](../../public/assets/backgrounds/thanh-van/modular/seasons/summer/02-midground.png) | 1672x941 | 1.4 MB |
| [`03-battle-ground.png`](../../public/assets/backgrounds/thanh-van/modular/seasons/summer/03-battle-ground.png) | 1672x941 | 1.2 MB |
| [`04-foreground-left.png`](../../public/assets/backgrounds/thanh-van/modular/seasons/summer/04-foreground-left.png) | 1672x941 | 934.2 KB |
| [`05-foreground-right.png`](../../public/assets/backgrounds/thanh-van/modular/seasons/summer/05-foreground-right.png) | 1672x941 | 665.8 KB |
| [`06-atmosphere.png`](../../public/assets/backgrounds/thanh-van/modular/seasons/summer/06-atmosphere.png) | 1672x941 | 772.5 KB |
| [`01-far-mountains.png`](../../public/assets/backgrounds/thanh-van/modular/seasons/winter/01-far-mountains.png) | 1672x941 | 1.4 MB |
| [`02-midground.png`](../../public/assets/backgrounds/thanh-van/modular/seasons/winter/02-midground.png) | 1672x941 | 2.0 MB |
| [`03-battle-ground.png`](../../public/assets/backgrounds/thanh-van/modular/seasons/winter/03-battle-ground.png) | 1672x941 | 1.9 MB |
| [`04-foreground-left.png`](../../public/assets/backgrounds/thanh-van/modular/seasons/winter/04-foreground-left.png) | 1672x941 | 1.6 MB |
| [`05-foreground-right.png`](../../public/assets/backgrounds/thanh-van/modular/seasons/winter/05-foreground-right.png) | 1672x941 | 773.2 KB |
| [`06-atmosphere.png`](../../public/assets/backgrounds/thanh-van/modular/seasons/winter/06-atmosphere.png) | 1672x941 | 873.7 KB |
| [`00-sky.png`](../../public/assets/backgrounds/thanh-van/modular/times/evening/00-sky.png) | 1672x941 | 1.7 MB |
| [`00-sky.png`](../../public/assets/backgrounds/thanh-van/modular/times/morning/00-sky.png) | 1672x941 | 1.4 MB |
| [`00-sky.png`](../../public/assets/backgrounds/thanh-van/modular/times/night/00-sky.png) | 1672x941 | 1.8 MB |
| [`00-sky.png`](../../public/assets/backgrounds/thanh-van/modular/times/noon/00-sky.png) | 1672x941 | 1.4 MB |
| [`00-sky.png`](../../public/assets/backgrounds/thanh-van/spring/morning/00-sky.png) | 1672x941 | 1.4 MB |
| [`01-far-mountains.png`](../../public/assets/backgrounds/thanh-van/spring/morning/01-far-mountains.png) | 1672x941 | 1.2 MB |
| [`02-midground.png`](../../public/assets/backgrounds/thanh-van/spring/morning/02-midground.png) | 1672x941 | 1.7 MB |
| [`03-battle-ground.png`](../../public/assets/backgrounds/thanh-van/spring/morning/03-battle-ground.png) | 1672x941 | 1.8 MB |
| [`04-foreground-left.png`](../../public/assets/backgrounds/thanh-van/spring/morning/04-foreground-left.png) | 1672x941 | 1.5 MB |
| [`05-foreground-right.png`](../../public/assets/backgrounds/thanh-van/spring/morning/05-foreground-right.png) | 1672x941 | 1.3 MB |
| [`06-atmosphere.png`](../../public/assets/backgrounds/thanh-van/spring/morning/06-atmosphere.png) | 1672x941 | 576.0 KB |
| [`preview-composite.png`](../../public/assets/backgrounds/thanh-van/spring/morning/preview-composite.png) | 1672x941 | 2.3 MB |
| [`thanh-van-spring-morning-master.png`](../../public/assets/backgrounds/thanh-van/spring/morning/thanh-van-spring-morning-master.png) | 1672x941 | 2.5 MB |
</details>

### [`assets/buildings/`](../../public/assets/buildings/) — 99 ảnh, 73.7 MB

Công trình — [`DongFuBuildingSprite.vue`](../../src/components/game/DongFuBuildingSprite.vue), [`HomeBuildingIcons.vue`](../../src/components/game/HomeBuildingIcons.vue), [`useBuildingHeaderState.ts`](../../src/composables/useBuildingHeaderState.ts) → FunctionOverlayPanel header

<details><summary>Full file list</summary>

| File | W×H | Size |
|---|---|---|
| [`buildings-contact-sheet.png`](../../public/assets/buildings/dong-fu/buildings-contact-sheet.png) | 1320x986 | 2.9 MB |
| [`dong-fu-layout-preview-v2.png`](../../public/assets/buildings/dong-fu/dong-fu-layout-preview-v2.png) | 1672x941 | 2.7 MB |
| [`dong-fu-layout-preview-v3.png`](../../public/assets/buildings/dong-fu/dong-fu-layout-preview-v3.png) | 1672x941 | 2.6 MB |
| [`equipment_hall.png`](../../public/assets/buildings/dong-fu/equipment_hall.png) | 1254x1254 | 1.8 MB |
| [`equipment_hall_stone_v2.png`](../../public/assets/buildings/dong-fu/equipment_hall_stone_v2.png) | 1391x1028 | 1.7 MB |
| [`gathering_outpost.png`](../../public/assets/buildings/dong-fu/gathering_outpost.png) | 1254x1254 | 2.0 MB |
| [`gathering_outpost_stone_v2.png`](../../public/assets/buildings/dong-fu/gathering_outpost_stone_v2.png) | 1467x874 | 1.9 MB |
| [`artisan_workshop.png`](../../public/assets/buildings/dong-fu/master-v1-crops/artisan_workshop.png) | 420x390 | 322.5 KB |
| [`contact-sheet-v2.png`](../../public/assets/buildings/dong-fu/master-v1-crops/contact-sheet-v2.png) | 636x1405 | 3.5 MB |
| [`contact-sheet.png`](../../public/assets/buildings/dong-fu/master-v1-crops/contact-sheet.png) | 636x1405 | 3.6 MB |
| [`equipment_hall.png`](../../public/assets/buildings/dong-fu/master-v1-crops/equipment_hall.png) | 410x310 | 253.7 KB |
| [`formation_altar.png`](../../public/assets/buildings/dong-fu/master-v1-crops/formation_altar.png) | 385x330 | 249.9 KB |
| [`gathering_outpost.png`](../../public/assets/buildings/dong-fu/master-v1-crops/gathering_outpost.png) | 275x225 | 114.7 KB |
| [`herb_garden.png`](../../public/assets/buildings/dong-fu/master-v1-crops/herb_garden.png) | 460x260 | 245.9 KB |
| [`pill_room.png`](../../public/assets/buildings/dong-fu/master-v1-crops/pill_room.png) | 335x275 | 181.5 KB |
| [`smelter.png`](../../public/assets/buildings/dong-fu/master-v1-crops/smelter.png) | 390x335 | 254.3 KB |
| [`spirit_spring.png`](../../public/assets/buildings/dong-fu/master-v1-crops/spirit_spring.png) | 360x275 | 184.8 KB |
| [`talisman_institute.png`](../../public/assets/buildings/dong-fu/master-v1-crops/talisman_institute.png) | 250x210 | 102.3 KB |
| [`teleport_gate.png`](../../public/assets/buildings/dong-fu/master-v1-crops/teleport_gate.png) | 360x310 | 188.8 KB |
| [`artisan_workshop-mask.png`](../../public/assets/buildings/dong-fu/master-v1-masks/artisan_workshop-mask.png) | 420x390 | 15.4 KB |
| [`equipment_hall-mask.png`](../../public/assets/buildings/dong-fu/master-v1-masks/equipment_hall-mask.png) | 410x310 | 16.8 KB |
| [`formation_altar-mask.png`](../../public/assets/buildings/dong-fu/master-v1-masks/formation_altar-mask.png) | 385x330 | 13.3 KB |
| [`gathering_outpost-mask.png`](../../public/assets/buildings/dong-fu/master-v1-masks/gathering_outpost-mask.png) | 275x225 | 8.4 KB |
| [`herb_garden-mask.png`](../../public/assets/buildings/dong-fu/master-v1-masks/herb_garden-mask.png) | 460x260 | 12.0 KB |
| [`pill_room-mask.png`](../../public/assets/buildings/dong-fu/master-v1-masks/pill_room-mask.png) | 335x275 | 10.6 KB |
| [`smelter-mask.png`](../../public/assets/buildings/dong-fu/master-v1-masks/smelter-mask.png) | 390x335 | 14.0 KB |
| [`spirit_spring-mask.png`](../../public/assets/buildings/dong-fu/master-v1-masks/spirit_spring-mask.png) | 360x275 | 11.8 KB |
| [`talisman_institute-mask.png`](../../public/assets/buildings/dong-fu/master-v1-masks/talisman_institute-mask.png) | 250x210 | 8.8 KB |
| [`teleport_gate-mask.png`](../../public/assets/buildings/dong-fu/master-v1-masks/teleport_gate-mask.png) | 360x310 | 18.9 KB |
| [`pill_room.png`](../../public/assets/buildings/dong-fu/pill_room.png) | 1254x1254 | 1.9 MB |
| [`pill_room_stone_v2.png`](../../public/assets/buildings/dong-fu/pill_room_stone_v2.png) | 1356x1020 | 1.5 MB |
| [`scripture_pavilion.png`](../../public/assets/buildings/dong-fu/scripture_pavilion.png) | 1254x1254 | 2.1 MB |
| [`artisan_workshop.png`](../../public/assets/buildings/dong-fu/separated-v1/artisan_workshop.png) | 323x302 | 159.1 KB |
| [`contact-sheet.png`](../../public/assets/buildings/dong-fu/separated-v1/contact-sheet.png) | 672x1280 | 1.9 MB |
| [`equipment_hall.png`](../../public/assets/buildings/dong-fu/separated-v1/equipment_hall.png) | 361x233 | 122.8 KB |
| [`formation_altar.png`](../../public/assets/buildings/dong-fu/separated-v1/formation_altar.png) | 315x213 | 92.3 KB |
| [`gathering_outpost.png`](../../public/assets/buildings/dong-fu/separated-v1/gathering_outpost.png) | 170x123 | 32.3 KB |
| [`herb_garden.png`](../../public/assets/buildings/dong-fu/separated-v1/herb_garden.png) | 355x169 | 110.4 KB |
| [`pill_room.png`](../../public/assets/buildings/dong-fu/separated-v1/pill_room.png) | 265x218 | 88.8 KB |
| [`artisan_workshop.png`](../../public/assets/buildings/dong-fu/separated-v1/preview-cells/artisan_workshop.png) | 320x240 | 216.3 KB |
| [`equipment_hall.png`](../../public/assets/buildings/dong-fu/separated-v1/preview-cells/equipment_hall.png) | 320x240 | 228.2 KB |
| [`formation_altar.png`](../../public/assets/buildings/dong-fu/separated-v1/preview-cells/formation_altar.png) | 320x240 | 225.2 KB |
| [`gathering_outpost.png`](../../public/assets/buildings/dong-fu/separated-v1/preview-cells/gathering_outpost.png) | 320x240 | 225.5 KB |
| [`herb_garden.png`](../../public/assets/buildings/dong-fu/separated-v1/preview-cells/herb_garden.png) | 320x240 | 206.3 KB |
| [`pill_room.png`](../../public/assets/buildings/dong-fu/separated-v1/preview-cells/pill_room.png) | 320x240 | 215.1 KB |
| [`smelter.png`](../../public/assets/buildings/dong-fu/separated-v1/preview-cells/smelter.png) | 320x240 | 216.3 KB |
| [`spirit_spring.png`](../../public/assets/buildings/dong-fu/separated-v1/preview-cells/spirit_spring.png) | 320x240 | 192.8 KB |
| [`talisman_institute.png`](../../public/assets/buildings/dong-fu/separated-v1/preview-cells/talisman_institute.png) | 320x240 | 183.0 KB |
| [`teleport_gate.png`](../../public/assets/buildings/dong-fu/separated-v1/preview-cells/teleport_gate.png) | 320x240 | 219.8 KB |
| [`recomposite-validation.png`](../../public/assets/buildings/dong-fu/separated-v1/recomposite-validation.png) | 1672x941 | 2.8 MB |
| [`smelter.png`](../../public/assets/buildings/dong-fu/separated-v1/smelter.png) | 327x260 | 123.1 KB |
| [`spirit_spring.png`](../../public/assets/buildings/dong-fu/separated-v1/spirit_spring.png) | 296x149 | 68.7 KB |
| [`talisman_institute.png`](../../public/assets/buildings/dong-fu/separated-v1/talisman_institute.png) | 174x163 | 42.9 KB |
| [`teleport_gate.png`](../../public/assets/buildings/dong-fu/separated-v1/teleport_gate.png) | 281x208 | 80.1 KB |
| [`spirit_spring.png`](../../public/assets/buildings/dong-fu/spirit_spring.png) | 1254x1254 | 1.9 MB |
| [`spirit_spring_stone_v2.png`](../../public/assets/buildings/dong-fu/spirit_spring_stone_v2.png) | 1430x903 | 1.7 MB |
| [`teleport_array.png`](../../public/assets/buildings/dong-fu/teleport_array.png) | 1254x1254 | 1.2 MB |
| [`teleport_array_stone_v2.png`](../../public/assets/buildings/dong-fu/teleport_array_stone_v2.png) | 1412x1050 | 1.3 MB |
| [`base.png`](../../public/assets/buildings/dong-fu/v2/chi_hien_quan/base.png) | 1254x1254 | 797.8 KB |
| [`ground-shadow.png`](../../public/assets/buildings/dong-fu/v2/chi_hien_quan/ground-shadow.png) | 1254x1254 | 12.1 KB |
| [`locked-overlay.png`](../../public/assets/buildings/dong-fu/v2/chi_hien_quan/locked-overlay.png) | 1254x1254 | 594.5 KB |
| [`silhouette-mask.png`](../../public/assets/buildings/dong-fu/v2/chi_hien_quan/silhouette-mask.png) | 1254x1254 | 16.8 KB |
| [`base.png`](../../public/assets/buildings/dong-fu/v2/equipment_hall/base.png) | 1254x1254 | 923.8 KB |
| [`ground-shadow.png`](../../public/assets/buildings/dong-fu/v2/equipment_hall/ground-shadow.png) | 1254x1254 | 12.2 KB |
| [`locked-overlay.png`](../../public/assets/buildings/dong-fu/v2/equipment_hall/locked-overlay.png) | 1254x1254 | 648.9 KB |
| [`silhouette-mask.png`](../../public/assets/buildings/dong-fu/v2/equipment_hall/silhouette-mask.png) | 1254x1254 | 15.2 KB |
| [`base.png`](../../public/assets/buildings/dong-fu/v2/gathering_outpost/base.png) | 1254x1254 | 1008.1 KB |
| [`ground-shadow.png`](../../public/assets/buildings/dong-fu/v2/gathering_outpost/ground-shadow.png) | 1254x1254 | 13.1 KB |
| [`locked-overlay.png`](../../public/assets/buildings/dong-fu/v2/gathering_outpost/locked-overlay.png) | 1254x1254 | 694.1 KB |
| [`silhouette-mask.png`](../../public/assets/buildings/dong-fu/v2/gathering_outpost/silhouette-mask.png) | 1254x1254 | 14.1 KB |
| [`base.png`](../../public/assets/buildings/dong-fu/v2/pill_room/base.png) | 1254x1254 | 903.0 KB |
| [`ground-shadow.png`](../../public/assets/buildings/dong-fu/v2/pill_room/ground-shadow.png) | 1254x1254 | 12.6 KB |
| [`locked-overlay.png`](../../public/assets/buildings/dong-fu/v2/pill_room/locked-overlay.png) | 1254x1254 | 646.1 KB |
| [`silhouette-mask.png`](../../public/assets/buildings/dong-fu/v2/pill_room/silhouette-mask.png) | 1254x1254 | 14.2 KB |
| [`gameplay-scale.png`](../../public/assets/buildings/dong-fu/v2/previews/gameplay-scale.png) | 2016x316 | 70.1 KB |
| [`night-readability.png`](../../public/assets/buildings/dong-fu/v2/previews/night-readability.png) | 1672x941 | 2.4 MB |
| [`redesign-contact-sheet.png`](../../public/assets/buildings/dong-fu/v2/previews/redesign-contact-sheet.png) | 948x592 | 269.3 KB |
| [`redesign-scene-morning.png`](../../public/assets/buildings/dong-fu/v2/previews/redesign-scene-morning.png) | 1672x941 | 2.7 MB |
| [`redesign-scene-night.png`](../../public/assets/buildings/dong-fu/v2/previews/redesign-scene-night.png) | 1672x941 | 2.6 MB |
| [`redesign-scene-placement.png`](../../public/assets/buildings/dong-fu/v2/previews/redesign-scene-placement.png) | 1672x941 | 2.7 MB |
| [`scene-placement.png`](../../public/assets/buildings/dong-fu/v2/previews/scene-placement.png) | 1672x941 | 2.7 MB |
| [`seasons.png`](../../public/assets/buildings/dong-fu/v2/previews/seasons.png) | 1672x954 | 2.9 MB |
| [`states.png`](../../public/assets/buildings/dong-fu/v2/previews/states.png) | 1056x1584 | 588.9 KB |
| [`autumn.png`](../../public/assets/buildings/dong-fu/v2/shared/seasons/autumn.png) | 1672x941 | 708.0 KB |
| [`spring.png`](../../public/assets/buildings/dong-fu/v2/shared/seasons/spring.png) | 1672x941 | 618.4 KB |
| [`summer.png`](../../public/assets/buildings/dong-fu/v2/shared/seasons/summer.png) | 1672x941 | 821.3 KB |
| [`winter.png`](../../public/assets/buildings/dong-fu/v2/shared/seasons/winter.png) | 1672x941 | 582.8 KB |
| [`base.png`](../../public/assets/buildings/dong-fu/v2/spirit_spring/base.png) | 1254x1254 | 797.8 KB |
| [`ground-shadow.png`](../../public/assets/buildings/dong-fu/v2/spirit_spring/ground-shadow.png) | 1254x1254 | 12.1 KB |
| [`locked-overlay.png`](../../public/assets/buildings/dong-fu/v2/spirit_spring/locked-overlay.png) | 1254x1254 | 594.5 KB |
| [`silhouette-mask.png`](../../public/assets/buildings/dong-fu/v2/spirit_spring/silhouette-mask.png) | 1254x1254 | 16.8 KB |
| [`base.png`](../../public/assets/buildings/dong-fu/v2/teleport_array/base.png) | 1254x1254 | 562.9 KB |
| [`ground-shadow.png`](../../public/assets/buildings/dong-fu/v2/teleport_array/ground-shadow.png) | 1254x1254 | 10.6 KB |
| [`locked-overlay.png`](../../public/assets/buildings/dong-fu/v2/teleport_array/locked-overlay.png) | 1254x1254 | 417.4 KB |
| [`silhouette-mask.png`](../../public/assets/buildings/dong-fu/v2/teleport_array/silhouette-mask.png) | 1254x1254 | 11.6 KB |
| [`base.png`](../../public/assets/buildings/dong-fu/v2/vendor/base.png) | 1254x1254 | 749.3 KB |
| [`ground-shadow.png`](../../public/assets/buildings/dong-fu/v2/vendor/ground-shadow.png) | 1254x1254 | 13.0 KB |
| [`locked-overlay.png`](../../public/assets/buildings/dong-fu/v2/vendor/locked-overlay.png) | 1254x1254 | 535.5 KB |
| [`silhouette-mask.png`](../../public/assets/buildings/dong-fu/v2/vendor/silhouette-mask.png) | 1254x1254 | 14.2 KB |
</details>

### [`assets/combat/`](../../public/assets/combat/) — 9 ảnh, 15.7 MB

**ORPHAN** — combat/thanh-van staged, đã thay bằng backgrounds/thanh-van/modular

<details><summary>Full file list</summary>

| File | W×H | Size |
|---|---|---|
| [`combat-bg-thanh-van-v1.png`](../../public/assets/combat/thanh-van/combat-bg-thanh-van-v1.png) | 2560x1440 | 3.7 MB |
| [`combat-bg-thanh-van-v2.png`](../../public/assets/combat/thanh-van/combat-bg-thanh-van-v2.png) | 1672x941 | 1.6 MB |
| [`combat-foreground-mist-thanh-van-v1.png`](../../public/assets/combat/thanh-van/combat-foreground-mist-thanh-van-v1.png) | 2560x1440 | 967.3 KB |
| [`enemy-seat-right-thanh-van-v1.png`](../../public/assets/combat/thanh-van/enemy-seat-right-thanh-van-v1.png) | 1024x1536 | 1.1 MB |
| [`go-board-frame-thanh-van-v1.png`](../../public/assets/combat/thanh-van/go-board-frame-thanh-van-v1.png) | 2048x2048 | 1.1 MB |
| [`go-board-frame-thanh-van-v2.png`](../../public/assets/combat/thanh-van/go-board-frame-thanh-van-v2.png) | 1254x1254 | 266.1 KB |
| [`go-board-surface-thanh-van-v1.png`](../../public/assets/combat/thanh-van/go-board-surface-thanh-van-v1.png) | 2048x2048 | 4.2 MB |
| [`go-board-surface-thanh-van-v2.png`](../../public/assets/combat/thanh-van/go-board-surface-thanh-van-v2.png) | 1254x1254 | 1.7 MB |
| [`player-seat-left-thanh-van-v1.png`](../../public/assets/combat/thanh-van/player-seat-left-thanh-van-v1.png) | 1024x1536 | 1.3 MB |
</details>

### [`assets/vfx/`](../../public/assets/vfx/) — 569 ảnh, 174.2 MB

**STAGED** — spritesheet library ~178 MB; [`PhaserSkillVfxDriver.ts`](../../src/game/support/skill-vfx/PhaserSkillVfxDriver.ts) hiện procedural, không load file nào

<details><summary>Full file list</summary>

| File | W×H | Size |
|---|---|---|
| [`yin-yang-dragon-sword-vfx-concept-v3.png`](../../public/assets/vfx/kiem-tu/yin-yang-dragon-sword-vfx-concept-v3.png) | 941x1672 | 467.9 KB |
| [`002.png`](../../public/assets/vfx/spritesheets/002.png) | 1600x600 | 135.3 KB |
| [`004.png`](../../public/assets/vfx/spritesheets/004.png) | 1600x600 | 40.6 KB |
| [`007.png`](../../public/assets/vfx/spritesheets/007.png) | 1600x600 | 23.2 KB |
| [`008.png`](../../public/assets/vfx/spritesheets/008.png) | 1600x600 | 85.2 KB |
| [`24.png`](../../public/assets/vfx/spritesheets/24.png) | 1600x750 | 27.3 KB |
| [`2D Cartoon FX (Blobs & Blotches) #2.png`](../../public/assets/vfx/spritesheets/2D Cartoon FX (Blobs & Blotches) #2.png) | 1600x1200 | 159.4 KB |
| [`2D Cartoon FX (Blobs & Blotches) #3.png`](../../public/assets/vfx/spritesheets/2D Cartoon FX (Blobs & Blotches) #3.png) | 1600x1200 | 60.1 KB |
| [`2D Cartoon FX (Blobs & Blotches) #4.png`](../../public/assets/vfx/spritesheets/2D Cartoon FX (Blobs & Blotches) #4.png) | 1600x1200 | 107.9 KB |
| [`2D Cartoon FX (Blobs & Blotches) #5.png`](../../public/assets/vfx/spritesheets/2D Cartoon FX (Blobs & Blotches) #5.png) | 1600x1200 | 156.0 KB |
| [`2D Cartoon FX (Energy Explosion) #15.png`](../../public/assets/vfx/spritesheets/2D Cartoon FX (Energy Explosion) #15.png) | 1600x600 | 133.8 KB |
| [`2D Cartoon FX (Energy Explosion) #6.png`](../../public/assets/vfx/spritesheets/2D Cartoon FX (Energy Explosion) #6.png) | 1600x600 | 101.7 KB |
| [`2D Cartoon FX (Field Lines) #1.png`](../../public/assets/vfx/spritesheets/2D Cartoon FX (Field Lines) #1.png) | 1600x600 | 94.5 KB |
| [`2D Cartoon FX (Fume) #1.png`](../../public/assets/vfx/spritesheets/2D Cartoon FX (Fume) #1.png) | 1600x600 | 258.7 KB |
| [`2D Cartoon FX (Fume) #2.png`](../../public/assets/vfx/spritesheets/2D Cartoon FX (Fume) #2.png) | 1600x600 | 290.1 KB |
| [`2D Cartoon FX (Shapes) #13.png`](../../public/assets/vfx/spritesheets/2D Cartoon FX (Shapes) #13.png) | 1600x1200 | 139.0 KB |
| [`2D Cartoon FX (Shapes) #14.png`](../../public/assets/vfx/spritesheets/2D Cartoon FX (Shapes) #14.png) | 1600x1200 | 127.5 KB |
| [`2D Cartoon FX (Shapes) #20.png`](../../public/assets/vfx/spritesheets/2D Cartoon FX (Shapes) #20.png) | 1600x600 | 36.7 KB |
| [`2D Cartoon FX (Shapes) #22.png`](../../public/assets/vfx/spritesheets/2D Cartoon FX (Shapes) #22.png) | 1600x600 | 28.2 KB |
| [`2D Cartoon FX (Shapes) #3.png`](../../public/assets/vfx/spritesheets/2D Cartoon FX (Shapes) #3.png) | 1600x600 | 124.5 KB |
| [`2D Cartoon FX (Shapes) #7.png`](../../public/assets/vfx/spritesheets/2D Cartoon FX (Shapes) #7.png) | 1600x1200 | 228.2 KB |
| [`2D Cartoon FX (Slashes) #18.png`](../../public/assets/vfx/spritesheets/2D Cartoon FX (Slashes) #18.png) | 1600x600 | 319.9 KB |
| [`2D Cartoon FX (Streak Strikes) #14.png`](../../public/assets/vfx/spritesheets/2D Cartoon FX (Streak Strikes) #14.png) | 1600x600 | 57.4 KB |
| [`2D Cartoon FX (Streak Strikes) #24.png`](../../public/assets/vfx/spritesheets/2D Cartoon FX (Streak Strikes) #24.png) | 1600x600 | 18.4 KB |
| [`2D Cartoon FX (Streak Strikes) #27.png`](../../public/assets/vfx/spritesheets/2D Cartoon FX (Streak Strikes) #27.png) | 1600x600 | 11.7 KB |
| [`2D Cartoon FX (Streak Strikes) #3.png`](../../public/assets/vfx/spritesheets/2D Cartoon FX (Streak Strikes) #3.png) | 1600x600 | 24.0 KB |
| [`2D Cartoon FX (Streak Strikes) #4.png`](../../public/assets/vfx/spritesheets/2D Cartoon FX (Streak Strikes) #4.png) | 1600x600 | 37.3 KB |
| [`Air_01.png`](../../public/assets/vfx/spritesheets/Air_01.png) | 1600x150 | 13.9 KB |
| [`Air_03_asset.png`](../../public/assets/vfx/spritesheets/Air_03_asset.png) | 1600x300 | 11.6 KB |
| [`Air_11_asset.png`](../../public/assets/vfx/spritesheets/Air_11_asset.png) | 1600x150 | 18.8 KB |
| [`Air_15_asset.png`](../../public/assets/vfx/spritesheets/Air_15_asset.png) | 1600x300 | 46.7 KB |
| [`Air_17.png`](../../public/assets/vfx/spritesheets/Air_17.png) | 1600x300 | 43.0 KB |
| [`Air_18_asset.png`](../../public/assets/vfx/spritesheets/Air_18_asset.png) | 1600x300 | 49.4 KB |
| [`Basic_16.png`](../../public/assets/vfx/spritesheets/Basic_16.png) | 1600x300 | 29.0 KB |
| [`Basic_20.png`](../../public/assets/vfx/spritesheets/Basic_20.png) | 1600x1050 | 43.4 KB |
| [`Basic_21.png`](../../public/assets/vfx/spritesheets/Basic_21.png) | 1600x1200 | 59.9 KB |
| [`Basic_22.png`](../../public/assets/vfx/spritesheets/Basic_22.png) | 1600x450 | 36.5 KB |
| [`Basic_28.png`](../../public/assets/vfx/spritesheets/Basic_28.png) | 1600x750 | 46.3 KB |
| [`Basic_29.png`](../../public/assets/vfx/spritesheets/Basic_29.png) | 1600x750 | 24.8 KB |
| [`Basic_30.png`](../../public/assets/vfx/spritesheets/Basic_30.png) | 1600x300 | 29.6 KB |
| [`Basic_31.png`](../../public/assets/vfx/spritesheets/Basic_31.png) | 1600x450 | 84.1 KB |
| [`Cast_16.png`](../../public/assets/vfx/spritesheets/Cast_16.png) | 1600x450 | 222.2 KB |
| [`Cast_17.png`](../../public/assets/vfx/spritesheets/Cast_17.png) | 1600x300 | 130.2 KB |
| [`Cast_18.png`](../../public/assets/vfx/spritesheets/Cast_18.png) | 1600x300 | 146.2 KB |
| [`Cast_21.png`](../../public/assets/vfx/spritesheets/Cast_21.png) | 1600x450 | 181.9 KB |
| [`Cast_22.png`](../../public/assets/vfx/spritesheets/Cast_22.png) | 1600x450 | 173.1 KB |
| [`Cast_23.png`](../../public/assets/vfx/spritesheets/Cast_23.png) | 1600x300 | 100.3 KB |
| [`Cast_24.png`](../../public/assets/vfx/spritesheets/Cast_24.png) | 1600x300 | 78.5 KB |
| [`Cast_25.png`](../../public/assets/vfx/spritesheets/Cast_25.png) | 1600x300 | 79.4 KB |
| [`Cast_26.png`](../../public/assets/vfx/spritesheets/Cast_26.png) | 1600x300 | 65.9 KB |
| [`Cast_28.png`](../../public/assets/vfx/spritesheets/Cast_28.png) | 1600x300 | 258.9 KB |
| [`Cast_29.png`](../../public/assets/vfx/spritesheets/Cast_29.png) | 1600x300 | 104.2 KB |
| [`Cast_30.png`](../../public/assets/vfx/spritesheets/Cast_30.png) | 1600x300 | 103.9 KB |
| [`Color Flame 09.png`](../../public/assets/vfx/spritesheets/Color Flame 09.png) | 1600x600 | 91.3 KB |
| [`Combined Element 01 Color.png`](../../public/assets/vfx/spritesheets/Combined Element 01 Color.png) | 1600x750 | 678.6 KB |
| [`Combined Element 02 Color.png`](../../public/assets/vfx/spritesheets/Combined Element 02 Color.png) | 1600x900 | 1.1 MB |
| [`Combined Element 04 Color.png`](../../public/assets/vfx/spritesheets/Combined Element 04 Color.png) | 1600x1050 | 1.6 MB |
| [`Combined Element 05 Color.png`](../../public/assets/vfx/spritesheets/Combined Element 05 Color.png) | 1600x750 | 323.3 KB |
| [`Combined Element 06 Color.png`](../../public/assets/vfx/spritesheets/Combined Element 06 Color.png) | 1600x1050 | 404.5 KB |
| [`Combined Element 07 Color.png`](../../public/assets/vfx/spritesheets/Combined Element 07 Color.png) | 1600x900 | 384.7 KB |
| [`Combined Element 08 Color.png`](../../public/assets/vfx/spritesheets/Combined Element 08 Color.png) | 1600x900 | 1.0 MB |
| [`Combined Element 09 Color.png`](../../public/assets/vfx/spritesheets/Combined Element 09 Color.png) | 1600x900 | 348.1 KB |
| [`Combined Element 10 Color.png`](../../public/assets/vfx/spritesheets/Combined Element 10 Color.png) | 1600x900 | 240.5 KB |
| [`Combined Element 11 Color.png`](../../public/assets/vfx/spritesheets/Combined Element 11 Color.png) | 1600x450 | 219.5 KB |
| [`Combined Element 12 Color.png`](../../public/assets/vfx/spritesheets/Combined Element 12 Color.png) | 1600x750 | 128.4 KB |
| [`Combined Element 13 Color.png`](../../public/assets/vfx/spritesheets/Combined Element 13 Color.png) | 1600x450 | 146.7 KB |
| [`Combined Element 15 Color.png`](../../public/assets/vfx/spritesheets/Combined Element 15 Color.png) | 1600x750 | 237.3 KB |
| [`EEXP 14.png`](../../public/assets/vfx/spritesheets/EEXP 14.png) | 1600x1050 | 583.1 KB |
| [`EEXP 15.png`](../../public/assets/vfx/spritesheets/EEXP 15.png) | 1600x900 | 187.1 KB |
| [`EEXP 16.png`](../../public/assets/vfx/spritesheets/EEXP 16.png) | 1600x1500 | 674.5 KB |
| [`EEXP 17.png`](../../public/assets/vfx/spritesheets/EEXP 17.png) | 1600x1350 | 371.1 KB |
| [`EEXP 18.png`](../../public/assets/vfx/spritesheets/EEXP 18.png) | 1600x1200 | 273.8 KB |
| [`EEXP 22.png`](../../public/assets/vfx/spritesheets/EEXP 22.png) | 1600x1200 | 1.3 MB |
| [`ELECTRICLE_07.png`](../../public/assets/vfx/spritesheets/ELECTRICLE_07.png) | 1600x300 | 36.0 KB |
| [`Earth_07.png`](../../public/assets/vfx/spritesheets/Earth_07.png) | 1600x300 | 84.1 KB |
| [`Earth_11.png`](../../public/assets/vfx/spritesheets/Earth_11.png) | 1600x300 | 91.8 KB |
| [`Element 12.png`](../../public/assets/vfx/spritesheets/Element 12.png) | 1600x450 | 213.6 KB |
| [`Element 37.png`](../../public/assets/vfx/spritesheets/Element 37.png) | 1600x750 | 314.9 KB |
| [`Element 38.png`](../../public/assets/vfx/spritesheets/Element 38.png) | 1600x600 | 51.0 KB |
| [`Energy 01.png`](../../public/assets/vfx/spritesheets/Energy 01.png) | 1600x450 | 122.5 KB |
| [`Energy 02.png`](../../public/assets/vfx/spritesheets/Energy 02.png) | 1600x600 | 143.4 KB |
| [`Energy 03.png`](../../public/assets/vfx/spritesheets/Energy 03.png) | 1600x450 | 106.7 KB |
| [`Energy 04.png`](../../public/assets/vfx/spritesheets/Energy 04.png) | 1600x300 | 116.3 KB |
| [`Energy 05.png`](../../public/assets/vfx/spritesheets/Energy 05.png) | 1600x300 | 32.6 KB |
| [`Energy 06.png`](../../public/assets/vfx/spritesheets/Energy 06.png) | 1600x300 | 112.7 KB |
| [`Energy 07.png`](../../public/assets/vfx/spritesheets/Energy 07.png) | 1600x450 | 99.6 KB |
| [`Energy 08.png`](../../public/assets/vfx/spritesheets/Energy 08.png) | 1600x600 | 179.5 KB |
| [`Energy 09.png`](../../public/assets/vfx/spritesheets/Energy 09.png) | 1600x450 | 89.1 KB |
| [`Energy 10.png`](../../public/assets/vfx/spritesheets/Energy 10.png) | 1600x300 | 92.0 KB |
| [`Energy Impact Explosion 04.png`](../../public/assets/vfx/spritesheets/Energy Impact Explosion 04.png) | 1600x1350 | 1015.5 KB |
| [`Energy Impact Explosion 06.png`](../../public/assets/vfx/spritesheets/Energy Impact Explosion 06.png) | 1600x1350 | 860.8 KB |
| [`Energy Impact Explosion 07.png`](../../public/assets/vfx/spritesheets/Energy Impact Explosion 07.png) | 1600x1650 | 3.1 MB |
| [`Energy Impact Explosion 11.png`](../../public/assets/vfx/spritesheets/Energy Impact Explosion 11.png) | 1600x1200 | 1.3 MB |
| [`Energy Impact Explosion 12.png`](../../public/assets/vfx/spritesheets/Energy Impact Explosion 12.png) | 1600x1050 | 545.5 KB |
| [`Energy_10.png`](../../public/assets/vfx/spritesheets/Energy_10.png) | 1600x600 | 195.1 KB |
| [`Energy_16.png`](../../public/assets/vfx/spritesheets/Energy_16.png) | 1600x600 | 353.8 KB |
| [`Energy_17.png`](../../public/assets/vfx/spritesheets/Energy_17.png) | 1600x600 | 241.2 KB |
| [`Energy_18.png`](../../public/assets/vfx/spritesheets/Energy_18.png) | 1600x450 | 150.9 KB |
| [`Energy_19.png`](../../public/assets/vfx/spritesheets/Energy_19.png) | 1600x300 | 168.8 KB |
| [`Energy_20.png`](../../public/assets/vfx/spritesheets/Energy_20.png) | 1600x450 | 105.5 KB |
| [`Energy_21.png`](../../public/assets/vfx/spritesheets/Energy_21.png) | 1600x450 | 208.1 KB |
| [`Energy_22.png`](../../public/assets/vfx/spritesheets/Energy_22.png) | 1600x300 | 140.1 KB |
| [`Energy_23.png`](../../public/assets/vfx/spritesheets/Energy_23.png) | 1600x450 | 263.1 KB |
| [`Energy_24.png`](../../public/assets/vfx/spritesheets/Energy_24.png) | 1600x450 | 262.9 KB |
| [`Energy_25.png`](../../public/assets/vfx/spritesheets/Energy_25.png) | 1600x450 | 206.5 KB |
| [`Energy_26.png`](../../public/assets/vfx/spritesheets/Energy_26.png) | 1600x450 | 126.8 KB |
| [`Energy_27.png`](../../public/assets/vfx/spritesheets/Energy_27.png) | 1600x600 | 286.2 KB |
| [`Energy_3.png`](../../public/assets/vfx/spritesheets/Energy_3.png) | 1600x450 | 204.7 KB |
| [`Energy_4.png`](../../public/assets/vfx/spritesheets/Energy_4.png) | 1600x300 | 140.1 KB |
| [`Energy_6.png`](../../public/assets/vfx/spritesheets/Energy_6.png) | 1600x450 | 860.2 KB |
| [`Energy_7.png`](../../public/assets/vfx/spritesheets/Energy_7.png) | 1600x450 | 203.1 KB |
| [`Energy_9.png`](../../public/assets/vfx/spritesheets/Energy_9.png) | 1600x600 | 281.5 KB |
| [`Explosion_10.png`](../../public/assets/vfx/spritesheets/Explosion_10.png) | 1600x750 | 1.2 MB |
| [`Explosion_11.png`](../../public/assets/vfx/spritesheets/Explosion_11.png) | 1600x600 | 1.1 MB |
| [`Explosion_12.png`](../../public/assets/vfx/spritesheets/Explosion_12.png) | 1600x750 | 1.2 MB |
| [`Explosion_13.png`](../../public/assets/vfx/spritesheets/Explosion_13.png) | 1600x750 | 1.5 MB |
| [`Explosion_14.png`](../../public/assets/vfx/spritesheets/Explosion_14.png) | 1600x600 | 875.8 KB |
| [`Explosion_15.png`](../../public/assets/vfx/spritesheets/Explosion_15.png) | 1600x750 | 829.4 KB |
| [`FE_C 03.png`](../../public/assets/vfx/spritesheets/FE_C 03.png) | 1600x1200 | 2.4 MB |
| [`FE_C 08.png`](../../public/assets/vfx/spritesheets/FE_C 08.png) | 1600x1800 | 460.3 KB |
| [`FE_C 14.png`](../../public/assets/vfx/spritesheets/FE_C 14.png) | 1600x1350 | 198.1 KB |
| [`FE_C 15.png`](../../public/assets/vfx/spritesheets/FE_C 15.png) | 1600x900 | 2.7 MB |
| [`FE_C 16.png`](../../public/assets/vfx/spritesheets/FE_C 16.png) | 1600x900 | 3.3 MB |
| [`FE_C 17.png`](../../public/assets/vfx/spritesheets/FE_C 17.png) | 1600x900 | 447.7 KB |
| [`FE_C 23.png`](../../public/assets/vfx/spritesheets/FE_C 23.png) | 1600x750 | 2.1 MB |
| [`FE_C 25.png`](../../public/assets/vfx/spritesheets/FE_C 25.png) | 1600x1800 | 214.1 KB |
| [`FE_S 03.png`](../../public/assets/vfx/spritesheets/FE_S 03.png) | 1600x2100 | 62.2 KB |
| [`FE_S 07.png`](../../public/assets/vfx/spritesheets/FE_S 07.png) | 1600x900 | 12.3 KB |
| [`FE_S 09.png`](../../public/assets/vfx/spritesheets/FE_S 09.png) | 1600x1500 | 69.4 KB |
| [`FE_S 10.png`](../../public/assets/vfx/spritesheets/FE_S 10.png) | 1600x1050 | 29.5 KB |
| [`FE_S 26.png`](../../public/assets/vfx/spritesheets/FE_S 26.png) | 1600x1350 | 10.5 KB |
| [`FE_S 27.png`](../../public/assets/vfx/spritesheets/FE_S 27.png) | 1600x900 | 19.2 KB |
| [`FE_S 29.png`](../../public/assets/vfx/spritesheets/FE_S 29.png) | 1600x2400 | 385.8 KB |
| [`FE_S 32.png`](../../public/assets/vfx/spritesheets/FE_S 32.png) | 1600x1800 | 42.1 KB |
| [`FE_S 33.png`](../../public/assets/vfx/spritesheets/FE_S 33.png) | 1600x1050 | 222.8 KB |
| [`FX 01.png`](../../public/assets/vfx/spritesheets/FX 01.png) | 1600x900 | 60.3 KB |
| [`FX 03.png`](../../public/assets/vfx/spritesheets/FX 03.png) | 1600x600 | 56.7 KB |
| [`FX 04.png`](../../public/assets/vfx/spritesheets/FX 04.png) | 1600x600 | 59.4 KB |
| [`FX 05.png`](../../public/assets/vfx/spritesheets/FX 05.png) | 1600x450 | 49.1 KB |
| [`FX 07.png`](../../public/assets/vfx/spritesheets/FX 07.png) | 1600x750 | 250.9 KB |
| [`FX 08.png`](../../public/assets/vfx/spritesheets/FX 08.png) | 1600x300 | 34.2 KB |
| [`FX 09.png`](../../public/assets/vfx/spritesheets/FX 09.png) | 1600x750 | 149.5 KB |
| [`FX 100.png`](../../public/assets/vfx/spritesheets/FX 100.png) | 1600x1050 | 98.7 KB |
| [`FX 11.png`](../../public/assets/vfx/spritesheets/FX 11.png) | 1600x900 | 62.3 KB |
| [`FX 13.png`](../../public/assets/vfx/spritesheets/FX 13.png) | 1600x1350 | 403.8 KB |
| [`FX 15.png`](../../public/assets/vfx/spritesheets/FX 15.png) | 1600x600 | 89.6 KB |
| [`FX 16.png`](../../public/assets/vfx/spritesheets/FX 16.png) | 1600x750 | 56.3 KB |
| [`FX 17.png`](../../public/assets/vfx/spritesheets/FX 17.png) | 1600x1050 | 87.6 KB |
| [`FX 19.png`](../../public/assets/vfx/spritesheets/FX 19.png) | 1600x900 | 46.0 KB |
| [`FX 21.png`](../../public/assets/vfx/spritesheets/FX 21.png) | 1600x750 | 192.6 KB |
| [`FX 22.png`](../../public/assets/vfx/spritesheets/FX 22.png) | 1600x900 | 526.5 KB |
| [`FX 23.png`](../../public/assets/vfx/spritesheets/FX 23.png) | 1600x1050 | 727.6 KB |
| [`FX 25.png`](../../public/assets/vfx/spritesheets/FX 25.png) | 1600x750 | 297.9 KB |
| [`FX 26.png`](../../public/assets/vfx/spritesheets/FX 26.png) | 1600x600 | 51.2 KB |
| [`FX 27.png`](../../public/assets/vfx/spritesheets/FX 27.png) | 1600x3900 | 280.0 KB |
| [`FX 28.png`](../../public/assets/vfx/spritesheets/FX 28.png) | 1600x750 | 83.6 KB |
| [`FX 29.png`](../../public/assets/vfx/spritesheets/FX 29.png) | 1600x1200 | 245.6 KB |
| [`FX 30.png`](../../public/assets/vfx/spritesheets/FX 30.png) | 1600x1650 | 811.0 KB |
| [`FX 32.png`](../../public/assets/vfx/spritesheets/FX 32.png) | 1600x750 | 177.1 KB |
| [`FX 33.png`](../../public/assets/vfx/spritesheets/FX 33.png) | 1600x1200 | 124.6 KB |
| [`FX 34.png`](../../public/assets/vfx/spritesheets/FX 34.png) | 1600x1200 | 76.8 KB |
| [`FX 35.png`](../../public/assets/vfx/spritesheets/FX 35.png) | 1600x900 | 95.2 KB |
| [`FX 36.png`](../../public/assets/vfx/spritesheets/FX 36.png) | 1600x1200 | 131.8 KB |
| [`FX 37.png`](../../public/assets/vfx/spritesheets/FX 37.png) | 1600x1200 | 63.2 KB |
| [`FX 38.png`](../../public/assets/vfx/spritesheets/FX 38.png) | 1600x1950 | 134.3 KB |
| [`FX 39.png`](../../public/assets/vfx/spritesheets/FX 39.png) | 1600x750 | 191.1 KB |
| [`FX 40.png`](../../public/assets/vfx/spritesheets/FX 40.png) | 1600x750 | 61.1 KB |
| [`FX 41.png`](../../public/assets/vfx/spritesheets/FX 41.png) | 1600x1500 | 689.1 KB |
| [`FX 43.png`](../../public/assets/vfx/spritesheets/FX 43.png) | 1600x1500 | 222.4 KB |
| [`FX 47.png`](../../public/assets/vfx/spritesheets/FX 47.png) | 1600x1050 | 189.5 KB |
| [`FX 48.png`](../../public/assets/vfx/spritesheets/FX 48.png) | 1600x1350 | 181.0 KB |
| [`FX 49.png`](../../public/assets/vfx/spritesheets/FX 49.png) | 1600x900 | 105.4 KB |
| [`FX 51.png`](../../public/assets/vfx/spritesheets/FX 51.png) | 1600x1050 | 113.4 KB |
| [`FX 56.png`](../../public/assets/vfx/spritesheets/FX 56.png) | 1600x750 | 119.0 KB |
| [`FX 57.png`](../../public/assets/vfx/spritesheets/FX 57.png) | 1600x900 | 138.2 KB |
| [`FX 58.png`](../../public/assets/vfx/spritesheets/FX 58.png) | 1600x750 | 71.2 KB |
| [`FX 59.png`](../../public/assets/vfx/spritesheets/FX 59.png) | 1600x1650 | 237.8 KB |
| [`FX 61.png`](../../public/assets/vfx/spritesheets/FX 61.png) | 1600x2100 | 141.7 KB |
| [`FX 62.png`](../../public/assets/vfx/spritesheets/FX 62.png) | 1600x1350 | 184.9 KB |
| [`FX 64.png`](../../public/assets/vfx/spritesheets/FX 64.png) | 1600x900 | 136.9 KB |
| [`FX 65.png`](../../public/assets/vfx/spritesheets/FX 65.png) | 1600x900 | 96.1 KB |
| [`FX 66.png`](../../public/assets/vfx/spritesheets/FX 66.png) | 1600x900 | 105.7 KB |
| [`FX 67.png`](../../public/assets/vfx/spritesheets/FX 67.png) | 1600x750 | 118.0 KB |
| [`FX 68.png`](../../public/assets/vfx/spritesheets/FX 68.png) | 1600x750 | 22.0 KB |
| [`FX 69.png`](../../public/assets/vfx/spritesheets/FX 69.png) | 1600x1050 | 134.1 KB |
| [`FX 70.png`](../../public/assets/vfx/spritesheets/FX 70.png) | 1600x1050 | 179.9 KB |
| [`FX 71.png`](../../public/assets/vfx/spritesheets/FX 71.png) | 1600x1050 | 100.3 KB |
| [`FX 72.png`](../../public/assets/vfx/spritesheets/FX 72.png) | 1600x1350 | 169.1 KB |
| [`FX 73.png`](../../public/assets/vfx/spritesheets/FX 73.png) | 1600x750 | 34.5 KB |
| [`FX 75.png`](../../public/assets/vfx/spritesheets/FX 75.png) | 1600x900 | 163.4 KB |
| [`FX 76.png`](../../public/assets/vfx/spritesheets/FX 76.png) | 1600x1200 | 111.5 KB |
| [`FX 77.png`](../../public/assets/vfx/spritesheets/FX 77.png) | 1600x600 | 102.4 KB |
| [`FX 78.png`](../../public/assets/vfx/spritesheets/FX 78.png) | 1600x750 | 138.1 KB |
| [`FX 79.png`](../../public/assets/vfx/spritesheets/FX 79.png) | 1600x750 | 123.5 KB |
| [`FX 82.png`](../../public/assets/vfx/spritesheets/FX 82.png) | 1600x600 | 362.0 KB |
| [`FX 83.png`](../../public/assets/vfx/spritesheets/FX 83.png) | 1600x600 | 114.2 KB |
| [`FX 84.png`](../../public/assets/vfx/spritesheets/FX 84.png) | 1600x600 | 93.5 KB |
| [`FX 85.png`](../../public/assets/vfx/spritesheets/FX 85.png) | 1600x1200 | 125.5 KB |
| [`FX 87.png`](../../public/assets/vfx/spritesheets/FX 87.png) | 1600x1050 | 176.0 KB |
| [`FX 88.png`](../../public/assets/vfx/spritesheets/FX 88.png) | 1600x1350 | 329.5 KB |
| [`FX 89.png`](../../public/assets/vfx/spritesheets/FX 89.png) | 1600x600 | 98.3 KB |
| [`FX 90.png`](../../public/assets/vfx/spritesheets/FX 90.png) | 1600x1200 | 1.6 MB |
| [`FX 91.png`](../../public/assets/vfx/spritesheets/FX 91.png) | 1600x1050 | 121.4 KB |
| [`FX 92.png`](../../public/assets/vfx/spritesheets/FX 92.png) | 1600x1050 | 469.4 KB |
| [`FX 93.png`](../../public/assets/vfx/spritesheets/FX 93.png) | 1600x1050 | 165.8 KB |
| [`FX 95.png`](../../public/assets/vfx/spritesheets/FX 95.png) | 1600x900 | 105.4 KB |
| [`FX 96.png`](../../public/assets/vfx/spritesheets/FX 96.png) | 1600x750 | 94.5 KB |
| [`FX 97.png`](../../public/assets/vfx/spritesheets/FX 97.png) | 1600x2400 | 128.9 KB |
| [`FX 98.png`](../../public/assets/vfx/spritesheets/FX 98.png) | 1600x1050 | 141.4 KB |
| [`FX 99.png`](../../public/assets/vfx/spritesheets/FX 99.png) | 1600x600 | 117.8 KB |
| [`Fire_16.png`](../../public/assets/vfx/spritesheets/Fire_16.png) | 1600x450 | 850.7 KB |
| [`Fire_17.png`](../../public/assets/vfx/spritesheets/Fire_17.png) | 1600x1050 | 358.7 KB |
| [`Fire_18.png`](../../public/assets/vfx/spritesheets/Fire_18.png) | 1600x750 | 435.4 KB |
| [`Fire_19.png`](../../public/assets/vfx/spritesheets/Fire_19.png) | 1600x750 | 997.2 KB |
| [`Fire_2.png`](../../public/assets/vfx/spritesheets/Fire_2.png) | 1600x750 | 227.5 KB |
| [`Fire_20.png`](../../public/assets/vfx/spritesheets/Fire_20.png) | 1600x600 | 195.1 KB |
| [`Fire_21.png`](../../public/assets/vfx/spritesheets/Fire_21.png) | 1600x600 | 202.7 KB |
| [`Fire_22.png`](../../public/assets/vfx/spritesheets/Fire_22.png) | 1600x750 | 1.2 MB |
| [`Fire_24.png`](../../public/assets/vfx/spritesheets/Fire_24.png) | 1600x750 | 222.3 KB |
| [`FireworksFX_13.png`](../../public/assets/vfx/spritesheets/FireworksFX_13.png) | 1600x900 | 258.0 KB |
| [`FireworksFX_4.png`](../../public/assets/vfx/spritesheets/FireworksFX_4.png) | 1600x750 | 180.6 KB |
| [`FireworksFX_6.png`](../../public/assets/vfx/spritesheets/FireworksFX_6.png) | 1600x750 | 639.4 KB |
| [`FireworksFX_7.png`](../../public/assets/vfx/spritesheets/FireworksFX_7.png) | 1600x750 | 207.4 KB |
| [`FireworksFX_8.png`](../../public/assets/vfx/spritesheets/FireworksFX_8.png) | 1600x750 | 1.2 MB |
| [`FireworksFX_9.png`](../../public/assets/vfx/spritesheets/FireworksFX_9.png) | 1600x750 | 159.4 KB |
| [`Flash FX Simple Element 30.png`](../../public/assets/vfx/spritesheets/Flash FX Simple Element 30.png) | 1600x1350 | 63.3 KB |
| [`Flash FX Simple Element 33.png`](../../public/assets/vfx/spritesheets/Flash FX Simple Element 33.png) | 1600x1050 | 242.3 KB |
| [`HuDung.png`](../../public/assets/vfx/spritesheets/HuDung.png) | 1600x600 | 268.1 KB |
| [`HuDungDJ.png`](../../public/assets/vfx/spritesheets/HuDungDJ.png) | 1600x600 | 722.1 KB |
| [`HuDungSL.png`](../../public/assets/vfx/spritesheets/HuDungSL.png) | 1600x600 | 998.6 KB |
| [`Lightning_10.png`](../../public/assets/vfx/spritesheets/Lightning_10.png) | 1600x300 | 66.0 KB |
| [`Lightning_16.png`](../../public/assets/vfx/spritesheets/Lightning_16.png) | 1600x300 | 39.4 KB |
| [`Lightning_17.png`](../../public/assets/vfx/spritesheets/Lightning_17.png) | 1600x300 | 66.0 KB |
| [`Lightning_20.png`](../../public/assets/vfx/spritesheets/Lightning_20.png) | 1600x600 | 75.6 KB |
| [`Lightning_21.png`](../../public/assets/vfx/spritesheets/Lightning_21.png) | 1600x600 | 114.0 KB |
| [`Lightning_23.png`](../../public/assets/vfx/spritesheets/Lightning_23.png) | 1600x300 | 73.8 KB |
| [`Lightning_24.png`](../../public/assets/vfx/spritesheets/Lightning_24.png) | 1600x300 | 57.1 KB |
| [`Lightning_25.png`](../../public/assets/vfx/spritesheets/Lightning_25.png) | 1600x300 | 27.5 KB |
| [`Lightning_26.png`](../../public/assets/vfx/spritesheets/Lightning_26.png) | 1600x300 | 44.3 KB |
| [`Lightning_27.png`](../../public/assets/vfx/spritesheets/Lightning_27.png) | 1600x300 | 50.8 KB |
| [`Lightning_28.png`](../../public/assets/vfx/spritesheets/Lightning_28.png) | 1600x300 | 40.0 KB |
| [`Lightning_29.png`](../../public/assets/vfx/spritesheets/Lightning_29.png) | 1600x300 | 49.1 KB |
| [`Lightning_30.png`](../../public/assets/vfx/spritesheets/Lightning_30.png) | 1600x300 | 48.6 KB |
| [`Lôi Kiếp.png`](../../public/assets/vfx/spritesheets/Lôi Kiếp.png) | 1600x300 | 96.2 KB |
| [`Lôi Trảm.png`](../../public/assets/vfx/spritesheets/Lôi Trảm.png) | 1600x750 | 106.5 KB |
| [`Magic FX Pack Element 01 Color.png`](../../public/assets/vfx/spritesheets/Magic FX Pack Element 01 Color.png) | 1600x1200 | 61.1 KB |
| [`Magic FX Pack Element 02 Color.png`](../../public/assets/vfx/spritesheets/Magic FX Pack Element 02 Color.png) | 1600x1200 | 67.8 KB |
| [`Magic FX Pack Element 03 Color.png`](../../public/assets/vfx/spritesheets/Magic FX Pack Element 03 Color.png) | 1600x750 | 38.9 KB |
| [`Magic FX Pack Element 05 Color.png`](../../public/assets/vfx/spritesheets/Magic FX Pack Element 05 Color.png) | 1600x750 | 27.5 KB |
| [`Magic FX Pack Element 06 Color.png`](../../public/assets/vfx/spritesheets/Magic FX Pack Element 06 Color.png) | 1600x600 | 32.6 KB |
| [`Magic FX Pack Element 10 Color.png`](../../public/assets/vfx/spritesheets/Magic FX Pack Element 10 Color.png) | 1600x750 | 35.6 KB |
| [`Magic FX Pack Element 11 Color.png`](../../public/assets/vfx/spritesheets/Magic FX Pack Element 11 Color.png) | 1600x750 | 37.8 KB |
| [`Magic FX Pack Element 12 Color.png`](../../public/assets/vfx/spritesheets/Magic FX Pack Element 12 Color.png) | 1600x1200 | 32.7 KB |
| [`MagicFX - 16.png`](../../public/assets/vfx/spritesheets/MagicFX - 16.png) | 1600x1050 | 411.9 KB |
| [`MagicFX - 17.png`](../../public/assets/vfx/spritesheets/MagicFX - 17.png) | 1600x600 | 396.7 KB |
| [`MagicFX - 18.png`](../../public/assets/vfx/spritesheets/MagicFX - 18.png) | 1600x1050 | 278.9 KB |
| [`MagicFX - 19.png`](../../public/assets/vfx/spritesheets/MagicFX - 19.png) | 1600x1200 | 468.4 KB |
| [`MagicFX - 20.png`](../../public/assets/vfx/spritesheets/MagicFX - 20.png) | 1600x750 | 254.2 KB |
| [`MagicFX - 21.png`](../../public/assets/vfx/spritesheets/MagicFX - 21.png) | 1600x900 | 381.9 KB |
| [`MagicFX - 22.png`](../../public/assets/vfx/spritesheets/MagicFX - 22.png) | 1600x1050 | 2.2 MB |
| [`MagicFX - 24.png`](../../public/assets/vfx/spritesheets/MagicFX - 24.png) | 1600x600 | 458.1 KB |
| [`MagicFX - 25.png`](../../public/assets/vfx/spritesheets/MagicFX - 25.png) | 1600x450 | 80.4 KB |
| [`MagicFX - 26.png`](../../public/assets/vfx/spritesheets/MagicFX - 26.png) | 1600x750 | 214.1 KB |
| [`MagicFX - 27.png`](../../public/assets/vfx/spritesheets/MagicFX - 27.png) | 1600x900 | 161.5 KB |
| [`MagicFX - 28.png`](../../public/assets/vfx/spritesheets/MagicFX - 28.png) | 1600x1200 | 483.8 KB |
| [`Mix_17.png`](../../public/assets/vfx/spritesheets/Mix_17.png) | 1600x600 | 293.0 KB |
| [`Muzzle Flash_17.png`](../../public/assets/vfx/spritesheets/Muzzle Flash_17.png) | 1600x750 | 312.1 KB |
| [`Pre-comp 111.png`](../../public/assets/vfx/spritesheets/Pre-comp 111.png) | 1600x900 | 3.5 MB |
| [`Pre-comp 118.png`](../../public/assets/vfx/spritesheets/Pre-comp 118.png) | 1600x750 | 75.8 KB |
| [`Pre-comp 132.png`](../../public/assets/vfx/spritesheets/Pre-comp 132.png) | 1600x1050 | 212.5 KB |
| [`Pre-comp 133.png`](../../public/assets/vfx/spritesheets/Pre-comp 133.png) | 1600x900 | 169.4 KB |
| [`Pre-comp 134.png`](../../public/assets/vfx/spritesheets/Pre-comp 134.png) | 1600x1200 | 465.0 KB |
| [`Pre-comp 148.png`](../../public/assets/vfx/spritesheets/Pre-comp 148.png) | 1600x1350 | 262.9 KB |
| [`Pre-comp 149.png`](../../public/assets/vfx/spritesheets/Pre-comp 149.png) | 1600x1050 | 161.6 KB |
| [`Pre-comp 304.png`](../../public/assets/vfx/spritesheets/Pre-comp 304.png) | 1600x1650 | 96.3 KB |
| [`Pre-comp 31.png`](../../public/assets/vfx/spritesheets/Pre-comp 31.png) | 1600x750 | 1.1 MB |
| [`Pre-comp 311.png`](../../public/assets/vfx/spritesheets/Pre-comp 311.png) | 1600x1050 | 174.2 KB |
| [`Pre-comp 350.png`](../../public/assets/vfx/spritesheets/Pre-comp 350.png) | 1600x1200 | 109.1 KB |
| [`Pre-comp 359.png`](../../public/assets/vfx/spritesheets/Pre-comp 359.png) | 1600x1500 | 171.1 KB |
| [`Pre-comp 383.png`](../../public/assets/vfx/spritesheets/Pre-comp 383.png) | 1600x1050 | 30.1 KB |
| [`Pre-comp 390.png`](../../public/assets/vfx/spritesheets/Pre-comp 390.png) | 1600x1500 | 153.9 KB |
| [`Pre-comp 393.png`](../../public/assets/vfx/spritesheets/Pre-comp 393.png) | 1600x1350 | 70.7 KB |
| [`Pre-comp 404.png`](../../public/assets/vfx/spritesheets/Pre-comp 404.png) | 1600x900 | 679.7 KB |
| [`Pre-comp 423.png`](../../public/assets/vfx/spritesheets/Pre-comp 423.png) | 1600x1200 | 361.6 KB |
| [`Pre-comp 473.png`](../../public/assets/vfx/spritesheets/Pre-comp 473.png) | 1600x1500 | 161.1 KB |
| [`Pre-comp 475.png`](../../public/assets/vfx/spritesheets/Pre-comp 475.png) | 1600x1200 | 361.6 KB |
| [`Pre-comp 81.png`](../../public/assets/vfx/spritesheets/Pre-comp 81.png) | 1600x1200 | 222.5 KB |
| [`Punches_16.png`](../../public/assets/vfx/spritesheets/Punches_16.png) | 1600x300 | 158.1 KB |
| [`Punches_17.png`](../../public/assets/vfx/spritesheets/Punches_17.png) | 1600x300 | 82.6 KB |
| [`Punches_18.png`](../../public/assets/vfx/spritesheets/Punches_18.png) | 1600x450 | 267.3 KB |
| [`Punches_19.png`](../../public/assets/vfx/spritesheets/Punches_19.png) | 1600x300 | 226.4 KB |
| [`Punches_21.png`](../../public/assets/vfx/spritesheets/Punches_21.png) | 1600x450 | 62.5 KB |
| [`Punches_22.png`](../../public/assets/vfx/spritesheets/Punches_22.png) | 1600x450 | 85.6 KB |
| [`Punches_24.png`](../../public/assets/vfx/spritesheets/Punches_24.png) | 1600x300 | 109.7 KB |
| [`Punches_26.png`](../../public/assets/vfx/spritesheets/Punches_26.png) | 1600x300 | 66.1 KB |
| [`Punches_27.png`](../../public/assets/vfx/spritesheets/Punches_27.png) | 1600x300 | 106.2 KB |
| [`Punches_4.png`](../../public/assets/vfx/spritesheets/Punches_4.png) | 1600x300 | 65.9 KB |
| [`Punches_5.png`](../../public/assets/vfx/spritesheets/Punches_5.png) | 1600x300 | 66.1 KB |
| [`Punches_9.png`](../../public/assets/vfx/spritesheets/Punches_9.png) | 1600x300 | 106.4 KB |
| [`SFFXEP 01.png`](../../public/assets/vfx/spritesheets/SFFXEP 01.png) | 1600x600 | 212.2 KB |
| [`SFFXEP 03.png`](../../public/assets/vfx/spritesheets/SFFXEP 03.png) | 1600x600 | 2.9 MB |
| [`SFFXEP 06.png`](../../public/assets/vfx/spritesheets/SFFXEP 06.png) | 1600x750 | 1016.8 KB |
| [`SFFXEP 07.png`](../../public/assets/vfx/spritesheets/SFFXEP 07.png) | 1600x450 | 385.9 KB |
| [`SFFXEP 08.png`](../../public/assets/vfx/spritesheets/SFFXEP 08.png) | 1600x450 | 319.7 KB |
| [`SFFXEP 09.png`](../../public/assets/vfx/spritesheets/SFFXEP 09.png) | 1600x450 | 161.7 KB |
| [`SFFXEP 16.png`](../../public/assets/vfx/spritesheets/SFFXEP 16.png) | 1600x900 | 248.5 KB |
| [`SFFXEP 22.png`](../../public/assets/vfx/spritesheets/SFFXEP 22.png) | 1600x600 | 102.2 KB |
| [`SFFXEP 23.png`](../../public/assets/vfx/spritesheets/SFFXEP 23.png) | 1600x300 | 168.0 KB |
| [`SFFXEP 24.png`](../../public/assets/vfx/spritesheets/SFFXEP 24.png) | 1600x450 | 144.8 KB |
| [`SFFXEP 27.png`](../../public/assets/vfx/spritesheets/SFFXEP 27.png) | 1600x450 | 136.3 KB |
| [`SFFXEP 29.png`](../../public/assets/vfx/spritesheets/SFFXEP 29.png) | 1600x300 | 44.0 KB |
| [`SFFXEP 30.png`](../../public/assets/vfx/spritesheets/SFFXEP 30.png) | 1600x300 | 140.5 KB |
| [`SFFXEP 31.png`](../../public/assets/vfx/spritesheets/SFFXEP 31.png) | 1600x300 | 80.5 KB |
| [`Sh013.png`](../../public/assets/vfx/spritesheets/Sh013.png) | 1600x1050 | 14.4 KB |
| [`Simple Colorful Cartoon Element 04 Color.png`](../../public/assets/vfx/spritesheets/Simple Colorful Cartoon Element 04 Color.png) | 1600x900 | 1009.2 KB |
| [`Simple Colorful Cartoon Element 05 Color.png`](../../public/assets/vfx/spritesheets/Simple Colorful Cartoon Element 05 Color.png) | 1600x1050 | 500.6 KB |
| [`Simple Colorful Cartoon Element 06 Color.png`](../../public/assets/vfx/spritesheets/Simple Colorful Cartoon Element 06 Color.png) | 1600x2850 | 466.4 KB |
| [`Simple Colorful Cartoon Element 07 Color.png`](../../public/assets/vfx/spritesheets/Simple Colorful Cartoon Element 07 Color.png) | 1600x2400 | 317.8 KB |
| [`Simple Colorful Cartoon Element 09 Color.png`](../../public/assets/vfx/spritesheets/Simple Colorful Cartoon Element 09 Color.png) | 1600x1500 | 50.5 KB |
| [`Simple Colorful Cartoon Element 10 Color.png`](../../public/assets/vfx/spritesheets/Simple Colorful Cartoon Element 10 Color.png) | 1600x450 | 39.1 KB |
| [`Simple Colorful Cartoon Element 13 Color.png`](../../public/assets/vfx/spritesheets/Simple Colorful Cartoon Element 13 Color.png) | 1600x450 | 103.5 KB |
| [`Simple Colorful Cartoon Element 14 Color.png`](../../public/assets/vfx/spritesheets/Simple Colorful Cartoon Element 14 Color.png) | 1600x1200 | 1.4 MB |
| [`Simple Colorful Cartoon Element 15 Color.png`](../../public/assets/vfx/spritesheets/Simple Colorful Cartoon Element 15 Color.png) | 1600x900 | 3.2 MB |
| [`Simple Colorful Cartoon Element 16 Color.png`](../../public/assets/vfx/spritesheets/Simple Colorful Cartoon Element 16 Color.png) | 1600x900 | 2.8 MB |
| [`Simple Colorful Cartoon Element 17 Color.png`](../../public/assets/vfx/spritesheets/Simple Colorful Cartoon Element 17 Color.png) | 1600x750 | 115.9 KB |
| [`Simple Colorful Cartoon Element 18 Color.png`](../../public/assets/vfx/spritesheets/Simple Colorful Cartoon Element 18 Color.png) | 1600x1050 | 220.7 KB |
| [`Simple Colorful Cartoon Element 19 Color.png`](../../public/assets/vfx/spritesheets/Simple Colorful Cartoon Element 19 Color.png) | 1600x900 | 191.8 KB |
| [`Simple Colorful Cartoon Element 20 Color.png`](../../public/assets/vfx/spritesheets/Simple Colorful Cartoon Element 20 Color.png) | 1600x450 | 46.6 KB |
| [`Simple Colorful Cartoon Element 21 Color.png`](../../public/assets/vfx/spritesheets/Simple Colorful Cartoon Element 21 Color.png) | 1600x1800 | 117.7 KB |
| [`Simple Colorful Cartoon Element 22 Color.png`](../../public/assets/vfx/spritesheets/Simple Colorful Cartoon Element 22 Color.png) | 1600x1650 | 95.2 KB |
| [`Simple Colorful Cartoon Element 26 Color.png`](../../public/assets/vfx/spritesheets/Simple Colorful Cartoon Element 26 Color.png) | 1600x750 | 135.2 KB |
| [`Simple Colorful Cartoon Element 27 Color.png`](../../public/assets/vfx/spritesheets/Simple Colorful Cartoon Element 27 Color.png) | 1600x450 | 108.1 KB |
| [`Simple Colorful Cartoon Element 28 Color.png`](../../public/assets/vfx/spritesheets/Simple Colorful Cartoon Element 28 Color.png) | 1600x1050 | 154.6 KB |
| [`Simple Colorful Cartoon Element 29 Color.png`](../../public/assets/vfx/spritesheets/Simple Colorful Cartoon Element 29 Color.png) | 1600x900 | 113.2 KB |
| [`Simple Colorful Cartoon Element 30 Color.png`](../../public/assets/vfx/spritesheets/Simple Colorful Cartoon Element 30 Color.png) | 1600x900 | 220.7 KB |
| [`Simple Colorful Cartoon Element 31 Color.png`](../../public/assets/vfx/spritesheets/Simple Colorful Cartoon Element 31 Color.png) | 1600x600 | 283.6 KB |
| [`Simple Colorful Cartoon Element 32 Color.png`](../../public/assets/vfx/spritesheets/Simple Colorful Cartoon Element 32 Color.png) | 1600x450 | 165.3 KB |
| [`Simple Colorful Cartoon Element 33 Color.png`](../../public/assets/vfx/spritesheets/Simple Colorful Cartoon Element 33 Color.png) | 1600x600 | 56.0 KB |
| [`Simple Element 02 Color.png`](../../public/assets/vfx/spritesheets/Simple Element 02 Color.png) | 1600x150 | 29.8 KB |
| [`Simple Element 03 Color.png`](../../public/assets/vfx/spritesheets/Simple Element 03 Color.png) | 1600x450 | 46.5 KB |
| [`Simple Element 04 Color.png`](../../public/assets/vfx/spritesheets/Simple Element 04 Color.png) | 1600x300 | 66.3 KB |
| [`Simple Element 05 Color.png`](../../public/assets/vfx/spritesheets/Simple Element 05 Color.png) | 1600x450 | 109.4 KB |
| [`Simple Element 06 Color.png`](../../public/assets/vfx/spritesheets/Simple Element 06 Color.png) | 1600x450 | 63.9 KB |
| [`Simple Element 07 Color.png`](../../public/assets/vfx/spritesheets/Simple Element 07 Color.png) | 1600x450 | 66.9 KB |
| [`Simple Element 12 Color.png`](../../public/assets/vfx/spritesheets/Simple Element 12 Color.png) | 1600x300 | 578.6 KB |
| [`Simple Element 13 Color.png`](../../public/assets/vfx/spritesheets/Simple Element 13 Color.png) | 1600x600 | 775.9 KB |
| [`Simple Element 14 Color.png`](../../public/assets/vfx/spritesheets/Simple Element 14 Color.png) | 1600x300 | 84.0 KB |
| [`Simple Element 15 Color.png`](../../public/assets/vfx/spritesheets/Simple Element 15 Color.png) | 1600x300 | 79.8 KB |
| [`Simple Element 17 Color.png`](../../public/assets/vfx/spritesheets/Simple Element 17 Color.png) | 1600x300 | 88.2 KB |
| [`Simple Element 18 Color.png`](../../public/assets/vfx/spritesheets/Simple Element 18 Color.png) | 1600x450 | 29.5 KB |
| [`Simple Element 21 Color.png`](../../public/assets/vfx/spritesheets/Simple Element 21 Color.png) | 1600x450 | 121.2 KB |
| [`Simple Element 22 Color.png`](../../public/assets/vfx/spritesheets/Simple Element 22 Color.png) | 1600x900 | 913.7 KB |
| [`Simple Element 23 Color.png`](../../public/assets/vfx/spritesheets/Simple Element 23 Color.png) | 1600x450 | 62.8 KB |
| [`Simple Element 24 Color.png`](../../public/assets/vfx/spritesheets/Simple Element 24 Color.png) | 1600x450 | 28.6 KB |
| [`Simple Element 25 Color.png`](../../public/assets/vfx/spritesheets/Simple Element 25 Color.png) | 1600x450 | 43.8 KB |
| [`Simple Element 27 Color.png`](../../public/assets/vfx/spritesheets/Simple Element 27 Color.png) | 1600x600 | 51.0 KB |
| [`Simple Element 28 Color.png`](../../public/assets/vfx/spritesheets/Simple Element 28 Color.png) | 1600x450 | 121.6 KB |
| [`Simple Element 29 Color.png`](../../public/assets/vfx/spritesheets/Simple Element 29 Color.png) | 1600x450 | 74.9 KB |
| [`Simple Element 31 Color.png`](../../public/assets/vfx/spritesheets/Simple Element 31 Color.png) | 1600x450 | 798.8 KB |
| [`Slash_10.png`](../../public/assets/vfx/spritesheets/Slash_10.png) | 1600x300 | 31.6 KB |
| [`Slash_13.png`](../../public/assets/vfx/spritesheets/Slash_13.png) | 1600x300 | 54.9 KB |
| [`Slash_16.png`](../../public/assets/vfx/spritesheets/Slash_16.png) | 1600x300 | 71.5 KB |
| [`Slash_17.png`](../../public/assets/vfx/spritesheets/Slash_17.png) | 1600x300 | 54.3 KB |
| [`Slash_18.png`](../../public/assets/vfx/spritesheets/Slash_18.png) | 1600x300 | 121.8 KB |
| [`Slash_19.png`](../../public/assets/vfx/spritesheets/Slash_19.png) | 1600x450 | 90.7 KB |
| [`Slash_20.png`](../../public/assets/vfx/spritesheets/Slash_20.png) | 1600x300 | 50.3 KB |
| [`Slash_21.png`](../../public/assets/vfx/spritesheets/Slash_21.png) | 1600x300 | 65.2 KB |
| [`Slash_23.png`](../../public/assets/vfx/spritesheets/Slash_23.png) | 1600x300 | 61.4 KB |
| [`Slash_24.png`](../../public/assets/vfx/spritesheets/Slash_24.png) | 1600x300 | 50.3 KB |
| [`Slash_25.png`](../../public/assets/vfx/spritesheets/Slash_25.png) | 1600x450 | 110.4 KB |
| [`Slash_26.png`](../../public/assets/vfx/spritesheets/Slash_26.png) | 1600x300 | 72.1 KB |
| [`Slash_5.png`](../../public/assets/vfx/spritesheets/Slash_5.png) | 1600x300 | 91.8 KB |
| [`Slash_6.png`](../../public/assets/vfx/spritesheets/Slash_6.png) | 1600x300 | 61.4 KB |
| [`Slash_7.png`](../../public/assets/vfx/spritesheets/Slash_7.png) | 1600x300 | 50.3 KB |
| [`Slash_8.png`](../../public/assets/vfx/spritesheets/Slash_8.png) | 1600x450 | 110.4 KB |
| [`Slash_9.png`](../../public/assets/vfx/spritesheets/Slash_9.png) | 1600x300 | 72.1 KB |
| [`Smoke 004 Impact Explosion Radial.png`](../../public/assets/vfx/spritesheets/Smoke 004 Impact Explosion Radial.png) | 1600x450 | 79.2 KB |
| [`Smoke 005 Trail Right.png`](../../public/assets/vfx/spritesheets/Smoke 005 Trail Right.png) | 1600x600 | 68.2 KB |
| [`Smoke 007 Trail Right.png`](../../public/assets/vfx/spritesheets/Smoke 007 Trail Right.png) | 1600x600 | 38.3 KB |
| [`Smoke 009 Impact Explosion Up.png`](../../public/assets/vfx/spritesheets/Smoke 009 Impact Explosion Up.png) | 1600x450 | 60.2 KB |
| [`Smoke 018 Impact Right.png`](../../public/assets/vfx/spritesheets/Smoke 018 Impact Right.png) | 1600x600 | 63.6 KB |
| [`Smoke 041 Explosion Up MIX.png`](../../public/assets/vfx/spritesheets/Smoke 041 Explosion Up MIX.png) | 1600x750 | 211.9 KB |
| [`Smoke 050 Trail Right.png`](../../public/assets/vfx/spritesheets/Smoke 050 Trail Right.png) | 1600x750 | 152.2 KB |
| [`Smoke 056 Ray Right.png`](../../public/assets/vfx/spritesheets/Smoke 056 Ray Right.png) | 1600x600 | 58.2 KB |
| [`Smoke_16.png`](../../public/assets/vfx/spritesheets/Smoke_16.png) | 1600x750 | 122.7 KB |
| [`Smoke_17.png`](../../public/assets/vfx/spritesheets/Smoke_17.png) | 1600x750 | 104.9 KB |
| [`Smoke_18.png`](../../public/assets/vfx/spritesheets/Smoke_18.png) | 1600x750 | 137.3 KB |
| [`Smoke_20.png`](../../public/assets/vfx/spritesheets/Smoke_20.png) | 1600x750 | 65.3 KB |
| [`Smoke_22.png`](../../public/assets/vfx/spritesheets/Smoke_22.png) | 1600x600 | 157.7 KB |
| [`Smoke_23.png`](../../public/assets/vfx/spritesheets/Smoke_23.png) | 1600x750 | 71.8 KB |
| [`Smoke_24.png`](../../public/assets/vfx/spritesheets/Smoke_24.png) | 1600x600 | 127.3 KB |
| [`Smoke_26.png`](../../public/assets/vfx/spritesheets/Smoke_26.png) | 1600x600 | 61.7 KB |
| [`Smoke_27.png`](../../public/assets/vfx/spritesheets/Smoke_27.png) | 1600x600 | 730.7 KB |
| [`Smoke_28.png`](../../public/assets/vfx/spritesheets/Smoke_28.png) | 1600x450 | 63.1 KB |
| [`Smoke_29.png`](../../public/assets/vfx/spritesheets/Smoke_29.png) | 1600x750 | 99.5 KB |
| [`Sparks 044 Shot Right Loop.png`](../../public/assets/vfx/spritesheets/Sparks 044 Shot Right Loop.png) | 1600x300 | 33.2 KB |
| [`Sparks 045 Shot Right Loop.png`](../../public/assets/vfx/spritesheets/Sparks 045 Shot Right Loop.png) | 1600x300 | 102.2 KB |
| [`Sparks 049 Shot Right.png`](../../public/assets/vfx/spritesheets/Sparks 049 Shot Right.png) | 1600x300 | 55.2 KB |
| [`Sparks 050 Shot Right.png`](../../public/assets/vfx/spritesheets/Sparks 050 Shot Right.png) | 1600x300 | 19.5 KB |
| [`Sparks 053 Shot Ray Right.png`](../../public/assets/vfx/spritesheets/Sparks 053 Shot Ray Right.png) | 1600x300 | 57.4 KB |
| [`Sparks 054 Shot Ray Right.png`](../../public/assets/vfx/spritesheets/Sparks 054 Shot Ray Right.png) | 1600x300 | 33.6 KB |
| [`Sparks 055 Shot Right.png`](../../public/assets/vfx/spritesheets/Sparks 055 Shot Right.png) | 1600x300 | 50.7 KB |
| [`Sparks 058 Shot Right.png`](../../public/assets/vfx/spritesheets/Sparks 058 Shot Right.png) | 1600x300 | 15.5 KB |
| [`Sparks 065 Shot Right Loop.png`](../../public/assets/vfx/spritesheets/Sparks 065 Shot Right Loop.png) | 1600x450 | 87.5 KB |
| [`Sparks 069 Impact Explosion Radial.png`](../../public/assets/vfx/spritesheets/Sparks 069 Impact Explosion Radial.png) | 1600x450 | 235.3 KB |
| [`Sparks 072 Shot Ray Impact Explosion Right.png`](../../public/assets/vfx/spritesheets/Sparks 072 Shot Ray Impact Explosion Right.png) | 1600x300 | 137.6 KB |
| [`Sparks 078 Ray Left.png`](../../public/assets/vfx/spritesheets/Sparks 078 Ray Left.png) | 1600x300 | 34.3 KB |
| [`Sparks 087 Impact Explosion Radial MIX.png`](../../public/assets/vfx/spritesheets/Sparks 087 Impact Explosion Radial MIX.png) | 1600x300 | 267.8 KB |
| [`Sparks 092 Right MIX.png`](../../public/assets/vfx/spritesheets/Sparks 092 Right MIX.png) | 1600x450 | 200.7 KB |
| [`SparksFX - 10.png`](../../public/assets/vfx/spritesheets/SparksFX - 10.png) | 1600x900 | 236.1 KB |
| [`SparksFX - 16.png`](../../public/assets/vfx/spritesheets/SparksFX - 16.png) | 1600x600 | 177.5 KB |
| [`SparksFX - 17.png`](../../public/assets/vfx/spritesheets/SparksFX - 17.png) | 1600x450 | 165.0 KB |
| [`SparksFX - 18.png`](../../public/assets/vfx/spritesheets/SparksFX - 18.png) | 1600x600 | 108.6 KB |
| [`SparksFX - 19.png`](../../public/assets/vfx/spritesheets/SparksFX - 19.png) | 1600x600 | 107.6 KB |
| [`SparksFX - 20.png`](../../public/assets/vfx/spritesheets/SparksFX - 20.png) | 1600x600 | 134.4 KB |
| [`SparksFX - 21.png`](../../public/assets/vfx/spritesheets/SparksFX - 21.png) | 1600x600 | 167.5 KB |
| [`SparksFX - 22.png`](../../public/assets/vfx/spritesheets/SparksFX - 22.png) | 1600x600 | 145.6 KB |
| [`SparksFX - 23.png`](../../public/assets/vfx/spritesheets/SparksFX - 23.png) | 1600x750 | 113.7 KB |
| [`SparksFX - 24.png`](../../public/assets/vfx/spritesheets/SparksFX - 24.png) | 1600x750 | 213.8 KB |
| [`SparksFX - 25.png`](../../public/assets/vfx/spritesheets/SparksFX - 25.png) | 1600x600 | 105.3 KB |
| [`SparksFX - 26.png`](../../public/assets/vfx/spritesheets/SparksFX - 26.png) | 1600x600 | 127.1 KB |
| [`SparksFX - 8.png`](../../public/assets/vfx/spritesheets/SparksFX - 8.png) | 1600x600 | 352.6 KB |
| [`Untitled-1-100.png`](../../public/assets/vfx/spritesheets/Untitled-1-100.png) | 1600x450 | 4.5 KB |
| [`Untitled-4-100.png`](../../public/assets/vfx/spritesheets/Untitled-4-100.png) | 1600x450 | 9.6 KB |
| [`Water FX 01.png`](../../public/assets/vfx/spritesheets/Water FX 01.png) | 1600x750 | 170.3 KB |
| [`Water FX 02.png`](../../public/assets/vfx/spritesheets/Water FX 02.png) | 1600x2850 | 387.5 KB |
| [`Water FX 03.png`](../../public/assets/vfx/spritesheets/Water FX 03.png) | 1600x750 | 230.8 KB |
| [`Water FX 04.png`](../../public/assets/vfx/spritesheets/Water FX 04.png) | 1600x900 | 333.6 KB |
| [`Water FX 05.png`](../../public/assets/vfx/spritesheets/Water FX 05.png) | 1600x1200 | 200.5 KB |
| [`Water FX 06.png`](../../public/assets/vfx/spritesheets/Water FX 06.png) | 1600x450 | 228.3 KB |
| [`Water FX 07.png`](../../public/assets/vfx/spritesheets/Water FX 07.png) | 1600x750 | 259.7 KB |
| [`Water FX 08.png`](../../public/assets/vfx/spritesheets/Water FX 08.png) | 1600x1050 | 492.0 KB |
| [`Water FX 09.png`](../../public/assets/vfx/spritesheets/Water FX 09.png) | 1600x1050 | 244.1 KB |
| [`Water FX 10.png`](../../public/assets/vfx/spritesheets/Water FX 10.png) | 1600x1050 | 733.9 KB |
| [`Water FX 11.png`](../../public/assets/vfx/spritesheets/Water FX 11.png) | 1600x1050 | 426.0 KB |
| [`Water FX 12.png`](../../public/assets/vfx/spritesheets/Water FX 12.png) | 1600x600 | 163.2 KB |
| [`Water FX 13.png`](../../public/assets/vfx/spritesheets/Water FX 13.png) | 1600x750 | 657.2 KB |
| [`Water FX 14.png`](../../public/assets/vfx/spritesheets/Water FX 14.png) | 1600x1350 | 843.4 KB |
| [`Water FX 15.png`](../../public/assets/vfx/spritesheets/Water FX 15.png) | 1600x1050 | 388.7 KB |
| [`Water FX 16.png`](../../public/assets/vfx/spritesheets/Water FX 16.png) | 1600x1050 | 258.2 KB |
| [`Water FX 17.png`](../../public/assets/vfx/spritesheets/Water FX 17.png) | 1600x900 | 472.5 KB |
| [`Water FX 18.png`](../../public/assets/vfx/spritesheets/Water FX 18.png) | 1600x1500 | 706.3 KB |
| [`Water FX 19.png`](../../public/assets/vfx/spritesheets/Water FX 19.png) | 1600x1200 | 352.3 KB |
| [`Water FX 20.png`](../../public/assets/vfx/spritesheets/Water FX 20.png) | 1600x1050 | 392.3 KB |
| [`Water FX 21.png`](../../public/assets/vfx/spritesheets/Water FX 21.png) | 1600x300 | 43.7 KB |
| [`Water FX 22.png`](../../public/assets/vfx/spritesheets/Water FX 22.png) | 1600x450 | 111.7 KB |
| [`Water FX 24.png`](../../public/assets/vfx/spritesheets/Water FX 24.png) | 1600x1200 | 254.3 KB |
| [`Water_bubbles_07.png`](../../public/assets/vfx/spritesheets/Water_bubbles_07.png) | 1600x900 | 58.1 KB |
| [`chuizi.png`](../../public/assets/vfx/spritesheets/chuizi.png) | 1600x1200 | 551.3 KB |
| [`chuizizhong.png`](../../public/assets/vfx/spritesheets/chuizizhong.png) | 1600x300 | 67.9 KB |
| [`dao.png`](../../public/assets/vfx/spritesheets/dao.png) | 1600x1200 | 512.9 KB |
| [`daozhong.png`](../../public/assets/vfx/spritesheets/daozhong.png) | 1600x300 | 60.4 KB |
| [`ding1.png`](../../public/assets/vfx/spritesheets/ding1.png) | 1600x450 | 60.9 KB |
| [`dunpai.png`](../../public/assets/vfx/spritesheets/dunpai.png) | 1600x1050 | 1.9 MB |
| [`fan.png`](../../public/assets/vfx/spritesheets/fan.png) | 1600x1200 | 718.6 KB |
| [`feisheng.png`](../../public/assets/vfx/spritesheets/feisheng.png) | 1600x750 | 399.2 KB |
| [`fire vihr.png`](../../public/assets/vfx/spritesheets/fire vihr.png) | 1600x750 | 70.4 KB |
| [`futou.png`](../../public/assets/vfx/spritesheets/futou.png) | 1600x1200 | 716.5 KB |
| [`futouzhong.png`](../../public/assets/vfx/spritesheets/futouzhong.png) | 1600x300 | 96.6 KB |
| [`huluo.png`](../../public/assets/vfx/spritesheets/huluo.png) | 1600x1200 | 882.0 KB |
| [`jingzi.png`](../../public/assets/vfx/spritesheets/jingzi.png) | 1600x1200 | 1.1 MB |
| [`lingdang.png`](../../public/assets/vfx/spritesheets/lingdang.png) | 1600x1200 | 769.2 KB |
| [`liq-50.png`](../../public/assets/vfx/spritesheets/liq-50.png) | 1600x750 | 6.2 KB |
| [`mianju.png`](../../public/assets/vfx/spritesheets/mianju.png) | 1600x1200 | 1.2 MB |
| [`park-19.png`](../../public/assets/vfx/spritesheets/park-19.png) | 1600x450 | 15.0 KB |
| [`qiang.png`](../../public/assets/vfx/spritesheets/qiang.png) | 1600x1200 | 566.7 KB |
| [`qiangzhong.png`](../../public/assets/vfx/spritesheets/qiangzhong.png) | 1600x300 | 116.0 KB |
| [`qin.png`](../../public/assets/vfx/spritesheets/qin.png) | 1600x1200 | 719.6 KB |
| [`shanzi.png`](../../public/assets/vfx/spritesheets/shanzi.png) | 1600x1200 | 793.9 KB |
| [`smokeS11.png`](../../public/assets/vfx/spritesheets/smokeS11.png) | 1600x450 | 20.5 KB |
| [`starle.png`](../../public/assets/vfx/spritesheets/starle.png) | 1600x1650 | 74.9 KB |
| [`yul2 (17).png`](../../public/assets/vfx/spritesheets/yul2 (17).png) | 1600x300 | 15.9 KB |
| [`yul2 (23).png`](../../public/assets/vfx/spritesheets/yul2 (23).png) | 1600x450 | 36.3 KB |
| [`yul2 (3).png`](../../public/assets/vfx/spritesheets/yul2 (3).png) | 1600x450 | 21.1 KB |
| [`yulfx (24).png`](../../public/assets/vfx/spritesheets/yulfx (24).png) | 1600x300 | 26.8 KB |
| [`yulfx (8).png`](../../public/assets/vfx/spritesheets/yulfx (8).png) | 1600x300 | 37.3 KB |
| [`zhong.png`](../../public/assets/vfx/spritesheets/zhong.png) | 1600x1200 | 1002.9 KB |
| [`СFFXEP 01.png`](../../public/assets/vfx/spritesheets/СFFXEP 01.png) | 1600x600 | 2.0 MB |
| [`СFFXEP 05.png`](../../public/assets/vfx/spritesheets/СFFXEP 05.png) | 1600x450 | 297.8 KB |
| [`СFFXEP 12.png`](../../public/assets/vfx/spritesheets/СFFXEP 12.png) | 1600x600 | 62.2 KB |
| [`СFFXEP 14.png`](../../public/assets/vfx/spritesheets/СFFXEP 14.png) | 1600x600 | 1.5 MB |
| [`СFFXEP 16.png`](../../public/assets/vfx/spritesheets/СFFXEP 16.png) | 1600x450 | 590.9 KB |
| [`СFFXEP 17.png`](../../public/assets/vfx/spritesheets/СFFXEP 17.png) | 1600x900 | 900.5 KB |
| [`СFFXEP 19.png`](../../public/assets/vfx/spritesheets/СFFXEP 19.png) | 1600x450 | 285.3 KB |
| [`СFFXEP 22.png`](../../public/assets/vfx/spritesheets/СFFXEP 22.png) | 1600x600 | 540.8 KB |
| [`合成 3.png`](../../public/assets/vfx/spritesheets/合成 3.png) | 1600x900 | 209.8 KB |
| [`合成 4.png`](../../public/assets/vfx/spritesheets/合成 4.png) | 1600x1050 | 239.3 KB |
| [`合成 5.png`](../../public/assets/vfx/spritesheets/合成 5.png) | 1600x750 | 203.8 KB |
| [`合成 7.png`](../../public/assets/vfx/spritesheets/合成 7.png) | 1600x750 | 49.0 KB |
| [`合成-1.png`](../../public/assets/vfx/spritesheets/合成-1.png) | 1600x750 | 440.7 KB |
| [`合成-2.png`](../../public/assets/vfx/spritesheets/合成-2.png) | 1600x900 | 506.4 KB |
| [`合成-3.png`](../../public/assets/vfx/spritesheets/合成-3.png) | 1600x750 | 154.7 KB |
| [`合成.png`](../../public/assets/vfx/spritesheets/合成.png) | 1600x600 | 151.5 KB |
| [`法阵3.png`](../../public/assets/vfx/spritesheets/法阵3.png) | 1600x2250 | 690.2 KB |
| [`流苏.png 合成 1.png`](../../public/assets/vfx/spritesheets/流苏.png 合成 1.png) | 1600x1650 | 937.1 KB |
| [`混合装饰 (10).png`](../../public/assets/vfx/spritesheets/混合装饰 (10).png) | 1600x600 | 1.5 MB |
| [`混合装饰 (12).png`](../../public/assets/vfx/spritesheets/混合装饰 (12).png) | 1600x300 | 55.7 KB |
| [`混合装饰 (13).png`](../../public/assets/vfx/spritesheets/混合装饰 (13).png) | 1600x600 | 95.2 KB |
| [`混合装饰 (14).png`](../../public/assets/vfx/spritesheets/混合装饰 (14).png) | 1600x600 | 162.6 KB |
| [`混合装饰 (16).png`](../../public/assets/vfx/spritesheets/混合装饰 (16).png) | 1600x750 | 143.8 KB |
| [`火 (1).png`](../../public/assets/vfx/spritesheets/火 (1).png) | 1600x600 | 181.9 KB |
| [`火 (10).png`](../../public/assets/vfx/spritesheets/火 (10).png) | 1600x450 | 386.7 KB |
| [`火 (11).png`](../../public/assets/vfx/spritesheets/火 (11).png) | 1600x600 | 208.4 KB |
| [`火 (12).png`](../../public/assets/vfx/spritesheets/火 (12).png) | 1600x600 | 149.7 KB |
| [`火 (13).png`](../../public/assets/vfx/spritesheets/火 (13).png) | 1600x600 | 199.6 KB |
| [`火 (14).png`](../../public/assets/vfx/spritesheets/火 (14).png) | 1600x1800 | 566.6 KB |
| [`火 (15).png`](../../public/assets/vfx/spritesheets/火 (15).png) | 1600x600 | 202.3 KB |
| [`火 (16).png`](../../public/assets/vfx/spritesheets/火 (16).png) | 1600x1950 | 2.0 MB |
| [`火 (17).png`](../../public/assets/vfx/spritesheets/火 (17).png) | 1600x600 | 176.0 KB |
| [`火 (18).png`](../../public/assets/vfx/spritesheets/火 (18).png) | 1600x600 | 169.8 KB |
| [`火 (19).png`](../../public/assets/vfx/spritesheets/火 (19).png) | 1600x750 | 648.0 KB |
| [`火 (2) 3.png`](../../public/assets/vfx/spritesheets/火 (2) 3.png) | 1600x600 | 111.2 KB |
| [`火 (20).png`](../../public/assets/vfx/spritesheets/火 (20).png) | 1600x600 | 865.0 KB |
| [`火 (3).png`](../../public/assets/vfx/spritesheets/火 (3).png) | 1600x1500 | 2.8 MB |
| [`火 (4).png`](../../public/assets/vfx/spritesheets/火 (4).png) | 1600x600 | 265.9 KB |
| [`火 (5).png`](../../public/assets/vfx/spritesheets/火 (5).png) | 1600x600 | 256.1 KB |
| [`火 (6).png`](../../public/assets/vfx/spritesheets/火 (6).png) | 1600x600 | 191.4 KB |
| [`火 (7).png`](../../public/assets/vfx/spritesheets/火 (7).png) | 1600x600 | 969.6 KB |
| [`火 (8).png`](../../public/assets/vfx/spritesheets/火 (8).png) | 1600x600 | 197.3 KB |
| [`火 (9).png`](../../public/assets/vfx/spritesheets/火 (9).png) | 1600x600 | 139.1 KB |
| [`灵田效果 合成 1.png`](../../public/assets/vfx/spritesheets/灵田效果 合成 1.png) | 1600x600 | 985.2 KB |
| [`特效元素-1.png`](../../public/assets/vfx/spritesheets/特效元素-1.png) | 1600x450 | 24.7 KB |
| [`特效元素-2.png`](../../public/assets/vfx/spritesheets/特效元素-2.png) | 1600x300 | 57.6 KB |
| [`特效元素-3.png`](../../public/assets/vfx/spritesheets/特效元素-3.png) | 1600x600 | 87.8 KB |
| [`特效元素-5.png`](../../public/assets/vfx/spritesheets/特效元素-5.png) | 1600x450 | 103.7 KB |
| [`电流放电 01.png`](../../public/assets/vfx/spritesheets/电流放电 01.png) | 1600x300 | 248.8 KB |
| [`电流放电10.png`](../../public/assets/vfx/spritesheets/电流放电10.png) | 1600x600 | 275.2 KB |
| [`电流放电11.png`](../../public/assets/vfx/spritesheets/电流放电11.png) | 1600x1050 | 1.2 MB |
| [`电流放电13.png`](../../public/assets/vfx/spritesheets/电流放电13.png) | 1600x750 | 126.6 KB |
| [`电流放电14.png`](../../public/assets/vfx/spritesheets/电流放电14.png) | 1600x600 | 182.0 KB |
| [`电流放电17.png`](../../public/assets/vfx/spritesheets/电流放电17.png) | 1600x450 | 139.3 KB |
| [`电流放电19.png`](../../public/assets/vfx/spritesheets/电流放电19.png) | 1600x750 | 301.0 KB |
| [`电流放电2.png`](../../public/assets/vfx/spritesheets/电流放电2.png) | 1600x450 | 135.7 KB |
| [`电流放电20.png`](../../public/assets/vfx/spritesheets/电流放电20.png) | 1600x450 | 130.1 KB |
| [`电流放电3.png`](../../public/assets/vfx/spritesheets/电流放电3.png) | 1600x450 | 152.5 KB |
| [`电流放电4.png`](../../public/assets/vfx/spritesheets/电流放电4.png) | 1600x300 | 155.1 KB |
| [`电流放电5.png`](../../public/assets/vfx/spritesheets/电流放电5.png) | 1600x450 | 188.9 KB |
| [`电流放电6.png`](../../public/assets/vfx/spritesheets/电流放电6.png) | 1600x600 | 186.1 KB |
| [`电流放电7.png`](../../public/assets/vfx/spritesheets/电流放电7.png) | 1600x600 | 229.1 KB |
| [`素材 4.png`](../../public/assets/vfx/spritesheets/素材 4.png) | 1600x450 | 137.0 KB |
| [`素材.png`](../../public/assets/vfx/spritesheets/素材.png) | 1600x1200 | 487.6 KB |
| [`能量1.png`](../../public/assets/vfx/spritesheets/能量1.png) | 1600x300 | 135.8 KB |
| [`能量10.png`](../../public/assets/vfx/spritesheets/能量10.png) | 1600x150 | 32.8 KB |
| [`能量11.png`](../../public/assets/vfx/spritesheets/能量11.png) | 1600x300 | 103.3 KB |
| [`能量12.png`](../../public/assets/vfx/spritesheets/能量12.png) | 1600x450 | 132.3 KB |
| [`能量13.png`](../../public/assets/vfx/spritesheets/能量13.png) | 1600x300 | 76.0 KB |
| [`能量14.png`](../../public/assets/vfx/spritesheets/能量14.png) | 1600x150 | 66.6 KB |
| [`能量15.png`](../../public/assets/vfx/spritesheets/能量15.png) | 1600x300 | 204.0 KB |
| [`能量20.png`](../../public/assets/vfx/spritesheets/能量20.png) | 1600x300 | 72.8 KB |
| [`能量3.png`](../../public/assets/vfx/spritesheets/能量3.png) | 1600x150 | 96.8 KB |
| [`能量4.png`](../../public/assets/vfx/spritesheets/能量4.png) | 1600x450 | 123.3 KB |
| [`能量7.png`](../../public/assets/vfx/spritesheets/能量7.png) | 1600x150 | 45.8 KB |
| [`能量8.png`](../../public/assets/vfx/spritesheets/能量8.png) | 1600x300 | 79.9 KB |
| [`进入战斗.png`](../../public/assets/vfx/spritesheets/进入战斗.png) | 1600x750 | 1.4 MB |
| [`闪电电流能量 (1).png`](../../public/assets/vfx/spritesheets/闪电电流能量 (1).png) | 1600x600 | 205.0 KB |
| [`闪电电流能量 (12).png`](../../public/assets/vfx/spritesheets/闪电电流能量 (12).png) | 1600x600 | 275.8 KB |
| [`闪电电流能量 (13).png`](../../public/assets/vfx/spritesheets/闪电电流能量 (13).png) | 1600x900 | 570.6 KB |
| [`闪电电流能量 (14).png`](../../public/assets/vfx/spritesheets/闪电电流能量 (14).png) | 1600x600 | 214.3 KB |
| [`闪电电流能量 (15).png`](../../public/assets/vfx/spritesheets/闪电电流能量 (15).png) | 1600x750 | 582.2 KB |
| [`闪电电流能量 (16).png`](../../public/assets/vfx/spritesheets/闪电电流能量 (16).png) | 1600x750 | 480.2 KB |
| [`闪电电流能量 (17).png`](../../public/assets/vfx/spritesheets/闪电电流能量 (17).png) | 1600x750 | 336.3 KB |
| [`闪电电流能量 (2).png`](../../public/assets/vfx/spritesheets/闪电电流能量 (2).png) | 1600x600 | 108.7 KB |
| [`闪电电流能量 (25).png`](../../public/assets/vfx/spritesheets/闪电电流能量 (25).png) | 1600x600 | 253.4 KB |
| [`闪电电流能量 (4).png`](../../public/assets/vfx/spritesheets/闪电电流能量 (4).png) | 1600x600 | 147.8 KB |
| [`闪电电流能量 (5).png`](../../public/assets/vfx/spritesheets/闪电电流能量 (5).png) | 1600x600 | 290.9 KB |
| [`闪电电流能量 (6).png`](../../public/assets/vfx/spritesheets/闪电电流能量 (6).png) | 1600x600 | 208.5 KB |
| [`阴阳鱼动效.png`](../../public/assets/vfx/spritesheets/阴阳鱼动效.png) | 1600x600 | 1.2 MB |
| [`预合成 1.png`](../../public/assets/vfx/spritesheets/预合成 1.png) | 1600x150 | 164.1 KB |
| [`黑色 纯色 1 合成 1.png`](../../public/assets/vfx/spritesheets/黑色 纯色 1 合成 1.png) | 1600x600 | 1.3 MB |
</details>


---

## 3. Tầng 3 — NEWSPRITE UI library

[`public/NEWSPRITE/Assets/Resources/assets/ui/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/) — 1378 PNG, 531.6 MB. Export từ project Unity gốc; **không một ref nào trong `src/`** (NEWSPRITE chỉ xuất hiện trong comment). Lưu ý: nằm trong `public/` nên **được copy nguyên vào `dist/` mỗi lần build** (`dist/NEWSPRITE` tồn tại); hiện untracked trong git.

| Khu (first-level dir) | Ảnh | Dung lượng |
|---|---|---|
| [`alchemy-room/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/) | 41 | 12.7 MB |
| [`battle-ui/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/) | 53 | 4.6 MB |
| [`blacksmith/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/) | 83 | 24.2 MB |
| [`cultivation-room/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/) | 29 | 9.2 MB |
| [`dialog-box/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/dialog-box/) | 4 | 2.0 MB |
| [`dungeon-detail/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/dungeon-detail/) | 10 | 8.4 MB |
| [`general-store/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/general-store/) | 24 | 14.2 MB |
| [`hover/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/) | 64 | 1.5 MB |
| [`hover-new/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/) | 23 | 2.1 MB |
| [`icon/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/) | 273 | 20.5 MB |
| [`jingshui-city/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/) | 27 | 10.3 MB |
| [`level-detail/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/level-detail/) | 8 | 4.6 MB |
| [`lord-manor/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/) | 29 | 17.1 MB |
| [`menu/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/) | 180 | 72.7 MB |
| [`quest-tracker/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/quest-tracker/) | 10 | 202.7 KB |
| [`region-scene/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-scene/) | 22 | 766.6 KB |
| [`region-select/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/) | 80 | 209.7 MB |
| [`slot/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/) | 28 | 1.0 MB |
| [`start-screen/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/) | 40 | 11.4 MB |
| [`territory/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/) | 35 | 17.4 MB |
| [`treasure-altar/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-altar/) | 21 | 16.7 MB |
| [`treasure-pavilion/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-pavilion/) | 14 | 8.5 MB |
| [`trial-tower/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/) | 230 | 38.8 MB |
| [`zhenmosi/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/) | 50 | 22.9 MB |

Mỗi PNG đi kèm 1 `.json` meta (format Unity `m_AtlasRD`/`m_Sprite` rect).

<details><summary>Full file list — toàn bộ 1378 ảnh theo thư mục</summary>


#### [`alchemy-room/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/) — 26 file

| File | W×H | Size |
|---|---|---|
| [`alchemy-room-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/alchemy-room-frame.png) | 2048x1155 | 4.4 MB |
| [`alchemy-room-max-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/alchemy-room-max-button.png) | 96x59 | 12.8 KB |
| [`alt-filter-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/alt-filter-button.png) | 126x64 | 17.9 KB |
| [`bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/bar.png) | 29x893 | 46.6 KB |
| [`bg-texture.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/bg-texture.png) | 2048x1152 | 2.7 MB |
| [`checkbox-checked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/checkbox-checked.png) | 33x30 | 2.7 KB |
| [`checkbox-unchecked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/checkbox-unchecked.png) | 30x29 | 2.2 KB |
| [`close-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/close-button.png) | 120x119 | 28.9 KB |
| [`effect-text-bg-bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/effect-text-bg-bar.png) | 552x40 | 5.8 KB |
| [`filter-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/filter-box.png) | 404x308 | 239.7 KB |
| [`filter-side-decor.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/filter-side-decor.png) | 576x64 | 75.3 KB |
| [`heat-control-button-selected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/heat-control-button-selected.png) | 187x68 | 19.4 KB |
| [`heat-control-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/heat-control-button.png) | 187x68 | 15.7 KB |
| [`heat-text-shadow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/heat-text-shadow.png) | 597x40 | 6.2 KB |
| [`material-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/material-box.png) | 195x161 | 45.9 KB |
| [`material-count-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/material-count-slot.png) | 187x44 | 18.3 KB |
| [`minus-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/minus-button.png) | 67x47 | 6.3 KB |
| [`plus-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/plus-button.png) | 64x47 | 6.1 KB |
| [`quantity-input.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/quantity-input.png) | 311x63 | 43.7 KB |
| [`quick-buy-material-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/quick-buy-material-button.png) | 34x35 | 3.0 KB |
| [`recipe-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/recipe-slot.png) | 554x163 | 198.8 KB |
| [`refine-pill-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/refine-pill-button.png) | 350x91 | 69.7 KB |
| [`roller.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/roller.png) | 14x559 | 10.9 KB |
| [`tab-button-selected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/tab-button-selected.png) | 155x76 | 28.3 KB |
| [`tab-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/tab-button.png) | 160x73 | 20.3 KB |
| [`yield-text-bg-bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/yield-text-bg-bar.png) | 552x40 | 5.8 KB |

#### [`alchemy-room/pill-label-bg/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/pill-label-bg/) — 9 file

| File | W×H | Size |
|---|---|---|
| [`battle-pill-effect-label-blue.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/pill-label-bg/battle-pill-effect-label-blue.png) | 110x35 | 10.1 KB |
| [`battle-pill-effect-label-green.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/pill-label-bg/battle-pill-effect-label-green.png) | 110x35 | 10.3 KB |
| [`battle-pill-effect-label-red.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/pill-label-bg/battle-pill-effect-label-red.png) | 110x35 | 9.7 KB |
| [`battle-pill-effect-label-yellow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/pill-label-bg/battle-pill-effect-label-yellow.png) | 109x35 | 10.4 KB |
| [`battle-pill-type-label.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/pill-label-bg/battle-pill-type-label.png) | 146x39 | 11.9 KB |
| [`cultivation-pill-effect-label.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/pill-label-bg/cultivation-pill-effect-label.png) | 163x43 | 20.7 KB |
| [`cultivation-pill-type-label.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/pill-label-bg/cultivation-pill-type-label.png) | 146x39 | 13.4 KB |
| [`stat-pill-effect-label.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/pill-label-bg/stat-pill-effect-label.png) | 169x43 | 19.7 KB |
| [`stat-pill-type-label.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/pill-label-bg/stat-pill-type-label.png) | 146x39 | 13.8 KB |

#### [`alchemy-room/refine-submenu/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/refine-submenu/) — 6 file

| File | W×H | Size |
|---|---|---|
| [`batch-refine-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/refine-submenu/batch-refine-frame.png) | 2048x1153 | 4.2 MB |
| [`leave-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/refine-submenu/leave-button.png) | 527x109 | 121.1 KB |
| [`progress-empty.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/refine-submenu/progress-empty.png) | 1064x36 | 70.4 KB |
| [`progress-full.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/refine-submenu/progress-full.png) | 1062x36 | 69.8 KB |
| [`refine-log-divider.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/refine-submenu/refine-log-divider.png) | 1456x4 | 19.0 KB |
| [`stop-refine-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/alchemy-room/refine-submenu/stop-refine-button.png) | 527x109 | 120.2 KB |

#### [`battle-ui/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/) — 32 file

| File | W×H | Size |
|---|---|---|
| [`1.5x-battle-speed-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/1.5x-battle-speed-icon.png) | 45x25 | 2.8 KB |
| [`1x-battle-speed-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/1x-battle-speed-icon.png) | 45x25 | 2.2 KB |
| [`2x-battle-speed-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/2x-battle-speed-icon.png) | 45x25 | 3.4 KB |
| [`action-bar-avatar-bg-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/action-bar-avatar-bg-frame.png) | 150x150 | 27.1 KB |
| [`action-bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/action-bar.png) | 675x7 | 15.2 KB |
| [`all-enemies-down.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/all-enemies-down.png) | 463x140 | 68.6 KB |
| [`battle-defeat.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/battle-defeat.png) | 463x140 | 69.0 KB |
| [`battle-result-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/battle-result-button.png) | 280x76 | 30.7 KB |
| [`battle-result-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/battle-result-frame.png) | 1785x1038 | 2.9 MB |
| [`battle-settings-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/battle-settings-bg.png) | 332x66 | 53.6 KB |
| [`battle-settings-button-disabled.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/battle-settings-button-disabled.png) | 27x28 | 2.5 KB |
| [`battle-settings-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/battle-settings-icon.png) | 37x24 | 2.1 KB |
| [`battle-settings-open-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/battle-settings-open-bg.png) | 439x166 | 147.6 KB |
| [`battle-speed-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/battle-speed-icon.png) | 26x31 | 2.2 KB |
| [`battle-start.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/battle-start.png) | 755x219 | 214.0 KB |
| [`buff-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/buff-box.png) | 210x207 | 58.3 KB |
| [`crit-number-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/crit-number-bg.png) | 253x80 | 26.6 KB |
| [`debuff-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/debuff-box.png) | 39x39 | 1.1 KB |
| [`dps-panel-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/dps-panel-bg.png) | 423x479 | 66.3 KB |
| [`enable-battle-settings-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/enable-battle-settings-button.png) | 27x28 | 2.5 KB |
| [`enemy-name-black-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/enemy-name-black-bg.png) | 200x30 | 3.6 KB |
| [`exit-battle-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/exit-battle-icon.png) | 32x33 | 3.1 KB |
| [`exp-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/exp-icon.png) | 97x98 | 23.4 KB |
| [`heal-crit-texture.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/heal-crit-texture.png) | 328x92 | 30.8 KB |
| [`hourglass-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/hourglass-icon.png) | 55x82 | 10.6 KB |
| [`mob-action-bar-avatar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/mob-action-bar-avatar.png) | 32x24 | 2.1 KB |
| [`return-territory-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/return-territory-icon.png) | 53x34 | 4.0 KB |
| [`scene-title-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/scene-title-box.png) | 654x100 | 160.5 KB |
| [`selection-cursor.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/selection-cursor.png) | 54x6 | 0.6 KB |
| [`settings-toprow-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/settings-toprow-bg.png) | 681x73 | 115.2 KB |
| [`timed-challenge-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/timed-challenge-box.png) | 322x125 | 60.3 KB |
| [`wave-title-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/wave-title-icon.png) | 480x41 | 39.0 KB |

#### [`battle-ui/hp-bar/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/hp-bar/) — 21 file

| File | W×H | Size |
|---|---|---|
| [`boss-buffer-hp-bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/hp-bar/boss-buffer-hp-bar.png) | 668x51 | 76.3 KB |
| [`boss-full-hp-bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/hp-bar/boss-full-hp-bar.png) | 668x51 | 72.0 KB |
| [`boss-hp-bar-base.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/hp-bar/boss-hp-bar-base.png) | 981x208 | 80.6 KB |
| [`boss-shield-bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/hp-bar/boss-shield-bar.png) | 668x51 | 66.2 KB |
| [`card-energy-empty.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/hp-bar/card-energy-empty.png) | 135x14 | 1.7 KB |
| [`card-energy-full.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/hp-bar/card-energy-full.png) | 135x14 | 5.2 KB |
| [`card-hp-empty.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/hp-bar/card-hp-empty.png) | 213x18 | 3.4 KB |
| [`card-hp-full.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/hp-bar/card-hp-full.png) | 213x18 | 8.5 KB |
| [`card-shield-bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/hp-bar/card-shield-bar.png) | 213x18 | 10.2 KB |
| [`character-card-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/hp-bar/character-card-frame.png) | 471x136 | 93.1 KB |
| [`e39371ebe903780be20d45056b155ad1.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/hp-bar/e39371ebe903780be20d45056b155ad1.png) | 22x32 | 1.8 KB |
| [`hp-bar-base.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/hp-bar/hp-bar-base.png) | 419x126 | 22.8 KB |
| [`overhead-empty-hp.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/hp-bar/overhead-empty-hp.png) | 149x12 | 1.8 KB |
| [`overhead-full-hp.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/hp-bar/overhead-full-hp.png) | 149x12 | 4.4 KB |
| [`overhead-hp-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/hp-bar/overhead-hp-frame.png) | 217x24 | 8.0 KB |
| [`overhead-shield-hp.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/hp-bar/overhead-shield-hp.png) | 149x12 | 5.4 KB |
| [`shield-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/hp-bar/shield-icon.png) | 22x32 | 1.8 KB |
| [`status-energy-bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/hp-bar/status-energy-bar.png) | 346x27 | 13.4 KB |
| [`status-hp-bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/hp-bar/status-hp-bar.png) | 346x27 | 12.9 KB |
| [`ult-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/hp-bar/ult-box.png) | 122x112 | 24.6 KB |
| [`ultimates-hotkey-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/battle-ui/hp-bar/ultimates-hotkey-box.png) | 43x40 | 1.3 KB |

#### [`blacksmith/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/) — 18 file

| File | W×H | Size |
|---|---|---|
| [`attribute-filter-box-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/attribute-filter-box-button.png) | 185x53 | 19.8 KB |
| [`attribute-filter-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/attribute-filter-button.png) | 77x66 | 12.7 KB |
| [`blacksmith-attribute-filter.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/blacksmith-attribute-filter.png) | 486x658 | 545.6 KB |
| [`blacksmith-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/blacksmith-bg.png) | 2048x1152 | 3.2 MB |
| [`close-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/close-button.png) | 97x95 | 18.9 KB |
| [`feature-entry-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/feature-entry-button.png) | 422x195 | 109.1 KB |
| [`forge-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/forge-button.png) | 298x370 | 231.3 KB |
| [`inventory-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/inventory-button.png) | 233x66 | 37.4 KB |
| [`inventory-page-black-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/inventory-page-black-bg.png) | 344x60 | 21.1 KB |
| [`leave-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/leave-button.png) | 279x84 | 49.1 KB |
| [`main-screen.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/main-screen.png) | 2048x1197 | 4.7 MB |
| [`page-left-arrow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/page-left-arrow.png) | 41x29 | 2.7 KB |
| [`page-right-arrow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/page-right-arrow.png) | 41x29 | 2.7 KB |
| [`reroll-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/reroll-button.png) | 295x368 | 237.0 KB |
| [`socket-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/socket-button.png) | 297x370 | 232.4 KB |
| [`tab-button-selected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/tab-button-selected.png) | 148x70 | 21.9 KB |
| [`tab-button-unselected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/tab-button-unselected.png) | 130x64 | 15.6 KB |
| [`team-list-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/team-list-frame.png) | 475x883 | 897.5 KB |

#### [`blacksmith/character-equipment/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/character-equipment/) — 3 file

| File | W×H | Size |
|---|---|---|
| [`character-equipment.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/character-equipment/character-equipment.png) | 640x826 | 1.2 MB |
| [`left-arrow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/character-equipment/left-arrow.png) | 46x25 | 2.3 KB |
| [`right-arrow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/character-equipment/right-arrow.png) | 46x25 | 2.3 KB |

#### [`blacksmith/equipment-refine/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/equipment-refine/) — 15 file

| File | W×H | Size |
|---|---|---|
| [`batch-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/equipment-refine/batch-button.png) | 139x59 | 17.6 KB |
| [`batch-select-checked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/equipment-refine/batch-select-checked.png) | 30x31 | 3.0 KB |
| [`batch-select-unchecked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/equipment-refine/batch-select-unchecked.png) | 30x31 | 2.6 KB |
| [`equipment-display-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/equipment-refine/equipment-display-box.png) | 542x507 | 522.4 KB |
| [`evolution-label.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/equipment-refine/evolution-label.png) | 63x61 | 8.8 KB |
| [`fusion-label.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/equipment-refine/fusion-label.png) | 68x61 | 9.5 KB |
| [`guide-qmark.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/equipment-refine/guide-qmark.png) | 33x32 | 3.0 KB |
| [`main-attribute-mark.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/equipment-refine/main-attribute-mark.png) | 19x19 | 1.1 KB |
| [`main-sub-gear-mark.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/equipment-refine/main-sub-gear-mark.png) | 44x43 | 2.9 KB |
| [`plus.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/equipment-refine/plus.png) | 50x52 | 2.5 KB |
| [`refine-equipment-display.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/equipment-refine/refine-equipment-display.png) | 352x507 | 353.7 KB |
| [`refine-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/equipment-refine/refine-frame.png) | 772x1076 | 1.5 MB |
| [`refine-tab-selected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/equipment-refine/refine-tab-selected.png) | 218x63 | 32.7 KB |
| [`refine-tab-unselected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/equipment-refine/refine-tab-unselected.png) | 217x63 | 29.4 KB |
| [`weapon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/equipment-refine/weapon.png) | 318x61 | 42.5 KB |

#### [`blacksmith/forge/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/forge/) — 23 file

| File | W×H | Size |
|---|---|---|
| [`alt-filter-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/forge/alt-filter-button.png) | 126x64 | 18.5 KB |
| [`back-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/forge/back-button.png) | 111x109 | 24.4 KB |
| [`bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/forge/bar.png) | 27x830 | 42.1 KB |
| [`decor-bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/forge/decor-bar.png) | 461x12 | 8.1 KB |
| [`exclusive-recipe-slot-1.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/forge/exclusive-recipe-slot-1.png) | 130x130 | 30.2 KB |
| [`exclusive-recipe-slot-2.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/forge/exclusive-recipe-slot-2.png) | 131x124 | 26.1 KB |
| [`filter-side-decor.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/forge/filter-side-decor.png) | 576x64 | 78.2 KB |
| [`forge-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/forge/forge-button.png) | 281x84 | 49.4 KB |
| [`forge-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/forge/forge-frame.png) | 1832x1259 | 4.6 MB |
| [`gold-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/forge/gold-icon.png) | 46x49 | 6.1 KB |
| [`max-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/forge/max-button.png) | 94x59 | 10.5 KB |
| [`minus-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/forge/minus-button.png) | 60x59 | 7.3 KB |
| [`number-shadow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/forge/number-shadow.png) | 101x29 | 0.3 KB |
| [`plus-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/forge/plus-button.png) | 60x59 | 8.3 KB |
| [`possible-affix-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/forge/possible-affix-box.png) | 547x784 | 59.6 KB |
| [`random-affix-qmark.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/forge/random-affix-qmark.png) | 33x32 | 2.6 KB |
| [`recipe-list-entry.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/forge/recipe-list-entry.png) | 667x141 | 219.1 KB |
| [`recipe-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/forge/recipe-slot.png) | 130x123 | 25.7 KB |
| [`roller.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/forge/roller.png) | 13x680 | 12.1 KB |
| [`soft-glow-circle.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/forge/soft-glow-circle.png) | 500x500 | 211.4 KB |
| [`tab-button-selected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/forge/tab-button-selected.png) | 148x70 | 21.9 KB |
| [`tab-button-unselected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/forge/tab-button-unselected.png) | 130x64 | 15.6 KB |
| [`text-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/forge/text-box.png) | 165x55 | 15.1 KB |

#### [`blacksmith/inscription/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/inscription/) — 7 file

| File | W×H | Size |
|---|---|---|
| [`dismantle-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/inscription/dismantle-button.png) | 325x92 | 75.8 KB |
| [`guide-qmark.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/inscription/guide-qmark.png) | 35x34 | 3.2 KB |
| [`inscription-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/inscription/inscription-frame.png) | 772x1076 | 1.7 MB |
| [`inscription-mark.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/inscription/inscription-mark.png) | 19x20 | 0.9 KB |
| [`inscription-prefix-decor.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/inscription/inscription-prefix-decor.png) | 35x32 | 2.4 KB |
| [`inscription-socket-selected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/inscription/inscription-socket-selected.png) | 189x173 | 55.9 KB |
| [`inscription-socket.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/inscription/inscription-socket.png) | 163x145 | 43.1 KB |

#### [`blacksmith/reroll/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/reroll/) — 17 file

| File | W×H | Size |
|---|---|---|
| [`affix-bg-bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/reroll/affix-bg-bar.png) | 627x56 | 17.5 KB |
| [`affix-dot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/reroll/affix-dot.png) | 12x12 | 0.6 KB |
| [`affix-locked-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/reroll/affix-locked-icon.png) | 23x30 | 1.9 KB |
| [`affix-reroll-arrow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/reroll/affix-reroll-arrow.png) | 63x34 | 3.7 KB |
| [`affix-text-input.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/reroll/affix-text-input.png) | 133x41 | 10.1 KB |
| [`affix-unlocked-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/reroll/affix-unlocked-icon.png) | 24x30 | 1.7 KB |
| [`auto-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/reroll/auto-button.png) | 100x51 | 11.8 KB |
| [`one-click-reroll-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/reroll/one-click-reroll-frame.png) | 605x862 | 876.2 KB |
| [`random-affix-qmark.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/reroll/random-affix-qmark.png) | 33x32 | 2.6 KB |
| [`replace-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/reroll/replace-button.png) | 216x62 | 32.4 KB |
| [`reroll-bar-20-png.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/reroll/reroll-bar-20-png.png) | 94x15 | 3.5 KB |
| [`reroll-bar-50.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/reroll/reroll-bar-50.png) | 94x15 | 3.6 KB |
| [`reroll-bar-empty.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/reroll/reroll-bar-empty.png) | 94x15 | 2.6 KB |
| [`reroll-bar-full.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/reroll/reroll-bar-full.png) | 94x15 | 3.6 KB |
| [`reroll-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/reroll/reroll-button.png) | 216x62 | 32.4 KB |
| [`reroll-cost-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/reroll/reroll-cost-bg.png) | 627x66 | 17.5 KB |
| [`reroll-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/blacksmith/reroll/reroll-frame.png) | 772x1076 | 1.7 MB |

#### [`cultivation-room/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/) — 29 file

| File | W×H | Size |
|---|---|---|
| [`bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/bar.png) | 37x903 | 65.4 KB |
| [`bg-texture.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/bg-texture.png) | 2048x1152 | 2.8 MB |
| [`close-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/close-button.png) | 94x93 | 20.1 KB |
| [`cultivation-room-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/cultivation-room-frame.png) | 2048x1057 | 4.0 MB |
| [`gold-bg-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/gold-bg-frame.png) | 260x63 | 13.9 KB |
| [`gold-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/gold-icon.png) | 88x85 | 19.7 KB |
| [`invest-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/invest-button.png) | 167x57 | 22.3 KB |
| [`invest-spirit-stone-bg-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/invest-spirit-stone-bg-frame.png) | 651x605 | 850.0 KB |
| [`invest-stone-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/invest-stone-button.png) | 295x80 | 57.5 KB |
| [`invest-stone-max-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/invest-stone-max-button.png) | 76x56 | 8.1 KB |
| [`minor-bg-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/minor-bg-frame.png) | 651x564 | 801.2 KB |
| [`minor-locked-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/minor-locked-button.png) | 153x52 | 18.4 KB |
| [`minor-skill-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/minor-skill-box.png) | 151x132 | 30.7 KB |
| [`minor-skill-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/minor-skill-button.png) | 153x52 | 19.1 KB |
| [`minus-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/minus-button.png) | 57x51 | 6.7 KB |
| [`per-upgrade-button-selected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/per-upgrade-button-selected.png) | 95x43 | 9.9 KB |
| [`per-upgrade-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/per-upgrade-button.png) | 95x43 | 6.0 KB |
| [`plus-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/plus-button.png) | 57x51 | 6.7 KB |
| [`qi-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/qi-icon.png) | 44x45 | 5.1 KB |
| [`reset-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/reset-button.png) | 100x49 | 9.5 KB |
| [`roller.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/roller.png) | 18x757 | 17.9 KB |
| [`roster-slot-selected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/roster-slot-selected.png) | 340x130 | 58.3 KB |
| [`roster-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/roster-slot.png) | 340x130 | 50.3 KB |
| [`skill-box-locked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/skill-box-locked.png) | 139x120 | 38.8 KB |
| [`skill-upgrade-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/skill-upgrade-button.png) | 171x58 | 23.2 KB |
| [`spirit-altar-decor-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/spirit-altar-decor-icon.png) | 253x320 | 170.2 KB |
| [`switch-off.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/switch-off.png) | 253x77 | 40.4 KB |
| [`switch-on.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/switch-on.png) | 252x78 | 47.9 KB |
| [`text-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/cultivation-room/text-box.png) | 116x47 | 11.7 KB |

#### [`dialog-box/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/dialog-box/) — 4 file

| File | W×H | Size |
|---|---|---|
| [`continue-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/dialog-box/continue-icon.png) | 55x46 | 5.8 KB |
| [`dialog-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/dialog-box/dialog-box.png) | 2048x517 | 1.8 MB |
| [`nameplate.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/dialog-box/nameplate.png) | 324x81 | 65.5 KB |
| [`option-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/dialog-box/option-button.png) | 442x99 | 92.2 KB |

#### [`dungeon-detail/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/dungeon-detail/) — 5 file

| File | W×H | Size |
|---|---|---|
| [`battle-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/dungeon-detail/battle-button.png) | 442x97 | 107.7 KB |
| [`battle-config-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/dungeon-detail/battle-config-button.png) | 100x94 | 18.3 KB |
| [`bg-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/dungeon-detail/bg-frame.png) | 1746x1079 | 3.8 MB |
| [`close-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/dungeon-detail/close-button.png) | 106x104 | 22.3 KB |
| [`hint-dot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/dungeon-detail/hint-dot.png) | 8x7 | 0.3 KB |

#### [`dungeon-detail/demon-tide/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/dungeon-detail/demon-tide/) — 5 file

| File | W×H | Size |
|---|---|---|
| [`bg-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/dungeon-detail/demon-tide/bg-frame.png) | 1746x1079 | 3.8 MB |
| [`challenge-time-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/dungeon-detail/demon-tide/challenge-time-bg.png) | 423x53 | 41.9 KB |
| [`demon-tide-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/dungeon-detail/demon-tide/demon-tide-bg.png) | 858x409 | 666.2 KB |
| [`time-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/dungeon-detail/demon-tide/time-icon.png) | 37x38 | 3.6 KB |
| [`time-limit-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/dungeon-detail/demon-tide/time-limit-icon.png) | 122x123 | 26.3 KB |

#### [`general-store/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/general-store/) — 24 file

| File | W×H | Size |
|---|---|---|
| [`buy-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/general-store/buy-button.png) | 250x65 | 39.7 KB |
| [`close-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/general-store/close-button.png) | 118x119 | 28.9 KB |
| [`copper-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/general-store/copper-icon.png) | 49x50 | 6.4 KB |
| [`delete-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/general-store/delete-button.png) | 48x49 | 5.8 KB |
| [`hover-minus-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/general-store/hover-minus-button.png) | 57x59 | 7.0 KB |
| [`hover-plus-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/general-store/hover-plus-button.png) | 57x59 | 7.1 KB |
| [`hover-text-input.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/general-store/hover-text-input.png) | 251x59 | 30.8 KB |
| [`max-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/general-store/max-button.png) | 57x59 | 6.6 KB |
| [`minus-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/general-store/minus-button.png) | 42x39 | 3.9 KB |
| [`plus-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/general-store/plus-button.png) | 40x39 | 3.8 KB |
| [`product-entry-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/general-store/product-entry-box.png) | 839x144 | 279.8 KB |
| [`product-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/general-store/product-slot.png) | 379x456 | 376.4 KB |
| [`pulley.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/general-store/pulley.png) | 29x483 | 4.7 KB |
| [`quantity-input.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/general-store/quantity-input.png) | 194x50 | 20.8 KB |
| [`scrollbar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/general-store/scrollbar.png) | 44x966 | 41.3 KB |
| [`sell-bg-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/general-store/sell-bg-frame.png) | 2048x1283 | 5.1 MB |
| [`sell-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/general-store/sell-button.png) | 312x92 | 30.0 KB |
| [`sell-max-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/general-store/sell-max-button.png) | 65x46 | 6.8 KB |
| [`shop-bg-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/general-store/shop-bg-frame.png) | 2048x1283 | 5.2 MB |
| [`shop-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/general-store/shop-bg.png) | 2048x1152 | 2.8 MB |
| [`slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/general-store/slot.png) | 115x114 | 21.3 KB |
| [`tab-decor-bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/general-store/tab-decor-bar.png) | 756x61 | 114.0 KB |
| [`tab-selected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/general-store/tab-selected.png) | 313x90 | 70.6 KB |
| [`tab-unselected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/general-store/tab-unselected.png) | 297x89 | 56.5 KB |

#### [`hover-new/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/) — 2 file

| File | W×H | Size |
|---|---|---|
| [`button-hover-tip.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/button-hover-tip.png) | 193x56 | 1.6 KB |
| [`guide-arrow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/guide-arrow.png) | 73x70 | 7.3 KB |

#### [`hover-new/hint-box/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/hint-box/) — 2 file

| File | W×H | Size |
|---|---|---|
| [`box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/hint-box/box.png) | 547x249 | 36.7 KB |
| [`divider.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/hint-box/divider.png) | 526x22 | 19.2 KB |

#### [`hover-new/hover-inner-slot/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/hover-inner-slot/) — 5 file

| File | W×H | Size |
|---|---|---|
| [`hover-blue-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/hover-inner-slot/hover-blue-slot.png) | 123x130 | 32.9 KB |
| [`hover-gold-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/hover-inner-slot/hover-gold-slot.png) | 123x130 | 33.1 KB |
| [`hover-green-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/hover-inner-slot/hover-green-slot.png) | 123x130 | 32.7 KB |
| [`hover-purple-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/hover-inner-slot/hover-purple-slot.png) | 123x130 | 32.8 KB |
| [`hover-white-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/hover-inner-slot/hover-white-slot.png) | 123x130 | 31.9 KB |

#### [`hover-new/item/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/item/) — 14 file

| File | W×H | Size |
|---|---|---|
| [`blue-title-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/item/blue-title-bg.png) | 545x579 | 325.4 KB |
| [`bottom-decor-bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/item/bottom-decor-bar.png) | 269x17 | 7.4 KB |
| [`bottom-divider.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/item/bottom-divider.png) | 526x22 | 19.2 KB |
| [`center-doodle.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/item/center-doodle.png) | 538x539 | 172.3 KB |
| [`equipped-mark.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/item/equipped-mark.png) | 377x20 | 7.2 KB |
| [`gem-empty.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/item/gem-empty.png) | 59x52 | 7.3 KB |
| [`gold-title-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/item/gold-title-bg.png) | 545x579 | 327.1 KB |
| [`green-title-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/item/green-title-bg.png) | 545x579 | 341.0 KB |
| [`main-info.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/item/main-info.png) | 352x40 | 12.0 KB |
| [`mid-divider.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/item/mid-divider.png) | 526x24 | 19.0 KB |
| [`purple-title-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/item/purple-title-bg.png) | 545x579 | 336.8 KB |
| [`top-divider.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/item/top-divider.png) | 526x22 | 17.6 KB |
| [`type-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/item/type-box.png) | 42x45 | 3.2 KB |
| [`white-title-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover-new/item/white-title-bg.png) | 545x579 | 308.4 KB |

#### [`hover/equipment-hover/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/equipment-hover/) — 7 file

| File | W×H | Size |
|---|---|---|
| [`equipment-hover-bottom.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/equipment-hover/equipment-hover-bottom.png) | 494x170 | 2.5 KB |
| [`equipment-hover-mid.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/equipment-hover/equipment-hover-mid.png) | 494x429 | 4.8 KB |
| [`equipment-hover-top.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/equipment-hover/equipment-hover-top.png) | 494x260 | 3.6 KB |
| [`equipment-hover-ui.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/equipment-hover/equipment-hover-ui.png) | 494x859 | 11.6 KB |
| [`gem-socket.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/equipment-hover/gem-socket.png) | 38x38 | 2.4 KB |
| [`gold-gear-hover-top.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/equipment-hover/gold-gear-hover-top.png) | 486x50 | 26.1 KB |
| [`gold-gear-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/equipment-hover/gold-gear-slot.png) | 170x170 | 35.1 KB |

#### [`hover/equipment-hover/title/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/equipment-hover/title/) — 4 file

| File | W×H | Size |
|---|---|---|
| [`blue-gear-title-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/equipment-hover/title/blue-gear-title-bg.png) | 486x50 | 27.1 KB |
| [`green-gear-title-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/equipment-hover/title/green-gear-title-bg.png) | 486x50 | 26.8 KB |
| [`purple-gear-title-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/equipment-hover/title/purple-gear-title-bg.png) | 486x50 | 29.1 KB |
| [`white-gear-title-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/equipment-hover/title/white-gear-title-bg.png) | 486x50 | 24.8 KB |

#### [`hover/hint-box/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/hint-box/) — 5 file

| File | W×H | Size |
|---|---|---|
| [`choice-dialog-buttons.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/hint-box/choice-dialog-buttons.png) | 440x44 | 0.8 KB |
| [`choice-dialog-content.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/hint-box/choice-dialog-content.png) | 440x118 | 1.5 KB |
| [`confirm-dialog-buttons.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/hint-box/confirm-dialog-buttons.png) | 440x44 | 0.7 KB |
| [`confirm-dialog-content.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/hint-box/confirm-dialog-content.png) | 440x118 | 1.5 KB |
| [`hint-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/hint-box/hint-box.png) | 440x121 | 1.6 KB |

#### [`hover/item/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/item/) — 8 file

| File | W×H | Size |
|---|---|---|
| [`blue-item-title-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/item/blue-item-title-bg.png) | 486x50 | 21.7 KB |
| [`gold-item-title-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/item/gold-item-title-bg.png) | 486x50 | 19.8 KB |
| [`green-item-title-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/item/green-item-title-bg.png) | 486x50 | 21.0 KB |
| [`inscription-embed-bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/item/inscription-embed-bar.png) | 490x36 | 0.5 KB |
| [`inscription-hover-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/item/inscription-hover-bg.png) | 494x344 | 142.8 KB |
| [`item-hover-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/item/item-hover-bg.png) | 494x299 | 4.2 KB |
| [`purple-item-title-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/item/purple-item-title-bg.png) | 486x50 | 22.0 KB |
| [`white-item-title-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/item/white-item-title-bg.png) | 486x50 | 18.8 KB |

#### [`hover/new-hover/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/) — 10 file

| File | W×H | Size |
|---|---|---|
| [`cancel-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/cancel-button.png) | 190x63 | 21.7 KB |
| [`confirm-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/confirm-button.png) | 190x63 | 23.7 KB |
| [`decorated-divider.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/decorated-divider.png) | 481x25 | 9.2 KB |
| [`generic-hover-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/generic-hover-box.png) | 547x497 | 325.8 KB |
| [`item-equipment-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/item-equipment-slot.png) | 175x176 | 30.8 KB |
| [`plain-divider-mid.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/plain-divider-mid.png) | 481x5 | 4.3 KB |
| [`plain-divider-small.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/plain-divider-small.png) | 481x5 | 1.6 KB |
| [`plain-divider.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/plain-divider.png) | 481x5 | 7.3 KB |
| [`subtitle-decor.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/subtitle-decor.png) | 21x22 | 1.2 KB |
| [`thin-divider.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/thin-divider.png) | 223x3 | 2.7 KB |

#### [`hover/new-hover/equipment-hover/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/equipment-hover/) — 7 file

| File | W×H | Size |
|---|---|---|
| [`affix-prefix-decor.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/equipment-hover/affix-prefix-decor.png) | 21x22 | 1.4 KB |
| [`bonus-affix-prefix-decor.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/equipment-hover/bonus-affix-prefix-decor.png) | 15x19 | 0.7 KB |
| [`enhance-affix-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/equipment-hover/enhance-affix-box.png) | 362x49 | 31.8 KB |
| [`equipment-tier-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/equipment-hover/equipment-tier-box.png) | 42x48 | 4.3 KB |
| [`equipped-stamp.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/equipment-hover/equipped-stamp.png) | 73x75 | 13.2 KB |
| [`evolved-equipment-badge.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/equipment-hover/evolved-equipment-badge.png) | 107x111 | 11.9 KB |
| [`exclusive-equipment-badge.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/equipment-hover/exclusive-equipment-badge.png) | 107x111 | 18.2 KB |

#### [`hover/new-hover/skill-hover/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/skill-hover/) — 3 file

| File | W×H | Size |
|---|---|---|
| [`hover-skill-icon-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/skill-hover/hover-skill-icon-slot.png) | 166x163 | 9.0 KB |
| [`move-element-label.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/skill-hover/move-element-label.png) | 90x42 | 7.7 KB |
| [`ultimates-label.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/skill-hover/ultimates-label.png) | 90x42 | 8.2 KB |

#### [`hover/new-hover/title-box/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/title-box/) — 9 file

| File | W×H | Size |
|---|---|---|
| [`blue.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/title-box/blue.png) | 319x64 | 35.8 KB |
| [`exclusive-equipment.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/title-box/exclusive-equipment.png) | 319x64 | 33.2 KB |
| [`gold.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/title-box/gold.png) | 319x64 | 36.4 KB |
| [`green.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/title-box/green.png) | 319x64 | 34.8 KB |
| [`purple.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/title-box/purple.png) | 319x64 | 34.9 KB |
| [`skill.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/title-box/skill.png) | 341x68 | 41.7 KB |
| [`system-hint.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/title-box/system-hint.png) | 319x64 | 34.7 KB |
| [`weapon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/title-box/weapon.png) | 318x61 | 42.5 KB |
| [`white.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/new-hover/title-box/white.png) | 319x64 | 29.8 KB |

#### [`hover/skill/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/skill/) — 6 file

| File | W×H | Size |
|---|---|---|
| [`martial-hover-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/skill/martial-hover-bg.png) | 690x746 | 12.6 KB |
| [`skill-hover-bg-1.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/skill/skill-hover-bg-1.png) | 690x204 | 3.6 KB |
| [`skill-hover-bg-2.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/skill/skill-hover-bg-2.png) | 690x179 | 2.8 KB |
| [`skill-hover-bg-3.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/skill/skill-hover-bg-3.png) | 690x143 | 2.3 KB |
| [`skill-hover-bg-4.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/skill/skill-hover-bg-4.png) | 690x220 | 3.9 KB |
| [`skill-title-hover-top.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/skill/skill-title-hover-top.png) | 682x50 | 34.8 KB |

#### [`hover/slot/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/slot/) — 5 file

| File | W×H | Size |
|---|---|---|
| [`blue-gear-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/slot/blue-gear-slot.png) | 172x170 | 34.1 KB |
| [`gold-gear-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/slot/gold-gear-slot.png) | 170x170 | 35.1 KB |
| [`green-gear-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/slot/green-gear-slot.png) | 170x172 | 36.2 KB |
| [`purple-gear-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/slot/purple-gear-slot.png) | 172x170 | 35.7 KB |
| [`white-gear-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/hover/slot/white-gear-slot.png) | 172x170 | 19.2 KB |

#### [`icon/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/) — 1 file

| File | W×H | Size |
|---|---|---|
| [`game-icon-1024.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/game-icon-1024.png) | 1024x1024 | 1.7 MB |

#### [`icon/attribute-icon/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/attribute-icon/) — 7 file

| File | W×H | Size |
|---|---|---|
| [`agility.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/attribute-icon/agility.png) | 100x100 | 8.0 KB |
| [`aptitude.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/attribute-icon/aptitude.png) | 100x100 | 9.6 KB |
| [`health.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/attribute-icon/health.png) | 100x100 | 6.5 KB |
| [`physical-attack.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/attribute-icon/physical-attack.png) | 100x100 | 5.4 KB |
| [`spell-attack.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/attribute-icon/spell-attack.png) | 100x100 | 7.6 KB |
| [`spirit.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/attribute-icon/spirit.png) | 100x100 | 6.3 KB |
| [`strength.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/attribute-icon/strength.png) | 100x100 | 7.1 KB |

#### [`icon/buff-icon/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/) — 1 file

| File | W×H | Size |
|---|---|---|
| [`test-buff-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/test-buff-icon.png) | 268x268 | 6.8 KB |

#### [`icon/buff-icon/buff/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/buff/) — 10 file

| File | W×H | Size |
|---|---|---|
| [`crit-damage-up.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/buff/crit-damage-up.png) | 127x128 | 28.4 KB |
| [`crit-rate-up.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/buff/crit-rate-up.png) | 127x128 | 27.0 KB |
| [`damage-up.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/buff/damage-up.png) | 127x128 | 22.0 KB |
| [`dodge-up.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/buff/dodge-up.png) | 127x128 | 28.4 KB |
| [`haste.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/buff/haste.png) | 127x128 | 28.4 KB |
| [`healing-up.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/buff/healing-up.png) | 127x128 | 24.2 KB |
| [`physical-attack-up.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/buff/physical-attack-up.png) | 127x128 | 25.0 KB |
| [`physical-defense-up.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/buff/physical-defense-up.png) | 127x128 | 26.0 KB |
| [`spell-attack-up.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/buff/spell-attack-up.png) | 127x128 | 26.3 KB |
| [`spell-defense-up.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/buff/spell-defense-up.png) | 127x128 | 26.7 KB |

#### [`icon/buff-icon/debuff/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/debuff/) — 12 file

| File | W×H | Size |
|---|---|---|
| [`bleed.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/debuff/bleed.png) | 127x128 | 20.0 KB |
| [`burn.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/debuff/burn.png) | 127x128 | 19.9 KB |
| [`damage-down.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/debuff/damage-down.png) | 127x128 | 24.6 KB |
| [`healing-received-down.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/debuff/healing-received-down.png) | 127x128 | 21.0 KB |
| [`physical-attack-down.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/debuff/physical-attack-down.png) | 127x128 | 20.9 KB |
| [`physical-defense-down.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/debuff/physical-defense-down.png) | 127x128 | 23.4 KB |
| [`poison.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/debuff/poison.png) | 127x128 | 23.7 KB |
| [`slow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/debuff/slow.png) | 127x128 | 24.2 KB |
| [`spell-attack-down.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/debuff/spell-attack-down.png) | 127x128 | 22.0 KB |
| [`spell-defense-down.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/debuff/spell-defense-down.png) | 127x128 | 24.5 KB |
| [`stun.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/debuff/stun.png) | 127x128 | 24.7 KB |
| [`taunt.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/debuff/taunt.png) | 127x128 | 24.5 KB |

#### [`icon/buff-icon/exclusive/boss/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/exclusive/boss/) — 3 file

| File | W×H | Size |
|---|---|---|
| [`wugu-enrage.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/exclusive/boss/wugu-enrage.png) | 127x128 | 40.4 KB |
| [`wugu-grows-stronger.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/exclusive/boss/wugu-grows-stronger.png) | 127x128 | 35.0 KB |
| [`wugu-thick-armor.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/buff-icon/exclusive/boss/wugu-thick-armor.png) | 127x128 | 40.4 KB |

#### [`icon/item-icon/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/) — 2 file

| File | W×H | Size |
|---|---|---|
| [`gold.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/gold.png) | 154x139 | 50.8 KB |
| [`test-sword.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/test-sword.png) | 64x64 | 6.6 KB |

#### [`icon/item-icon/equipment/accessory/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/accessory/) — 12 file

| File | W×H | Size |
|---|---|---|
| [`1-redgold-loop.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/accessory/1-redgold-loop.png) | 183x180 | 30.7 KB |
| [`1-ward-pattern-pendant.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/accessory/1-ward-pattern-pendant.png) | 183x180 | 40.5 KB |
| [`1.2-crack-charm.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/accessory/1.2-crack-charm.png) | 182x180 | 24.8 KB |
| [`1.2-flowing-cloud-pendant.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/accessory/1.2-flowing-cloud-pendant.png) | 183x180 | 32.0 KB |
| [`1.5-cold-jade-pendant.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/accessory/1.5-cold-jade-pendant.png) | 183x180 | 37.4 KB |
| [`1.5-edge-pattern-pendant.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/accessory/1.5-edge-pattern-pendant.png) | 183x180 | 31.4 KB |
| [`1.9-still-jade-ring.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/accessory/1.9-still-jade-ring.png) | 183x180 | 32.1 KB |
| [`1.9-ward-charm.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/accessory/1.9-ward-charm.png) | 183x180 | 37.2 KB |
| [`2.4-jade-ring.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/accessory/2.4-jade-ring.png) | 183x180 | 32.4 KB |
| [`2.4-prime-anchor-charm.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/accessory/2.4-prime-anchor-charm.png) | 183x180 | 34.0 KB |
| [`3-mystic-edge-pendant.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/accessory/3-mystic-edge-pendant.png) | 182x180 | 30.2 KB |
| [`3-spirit-glow-ring.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/accessory/3-spirit-glow-ring.png) | 183x180 | 30.3 KB |

#### [`icon/item-icon/equipment/clothes/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/clothes/) — 6 file

| File | W×H | Size |
|---|---|---|
| [`1-iron-lining.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/clothes/1-iron-lining.png) | 183x180 | 45.1 KB |
| [`1.2-cloud-pattern-robe.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/clothes/1.2-cloud-pattern-robe.png) | 183x180 | 44.4 KB |
| [`1.5-heartguard-armor.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/clothes/1.5-heartguard-armor.png) | 183x180 | 48.1 KB |
| [`1.9-rockbreath-robe.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/clothes/1.9-rockbreath-robe.png) | 182x180 | 51.6 KB |
| [`2.4-plain-scale-robe.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/clothes/2.4-plain-scale-robe.png) | 183x180 | 47.5 KB |
| [`3-stillmountain-robe.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/clothes/3-stillmountain-robe.png) | 183x180 | 39.9 KB |

#### [`icon/item-icon/equipment/exclusive-equipment/dungeon/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/dungeon/) — 4 file

| File | W×H | Size |
|---|---|---|
| [`frost-shock-sword.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/dungeon/frost-shock-sword.png) | 183x180 | 23.6 KB |
| [`gold-edge-sword.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/dungeon/gold-edge-sword.png) | 182x180 | 30.6 KB |
| [`jade-spirit-staff.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/dungeon/jade-spirit-staff.png) | 183x180 | 27.9 KB |
| [`peak-sever-saber.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/dungeon/peak-sever-saber.png) | 183x180 | 37.0 KB |

#### [`icon/item-icon/equipment/exclusive-equipment/monster-exclusive/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/monster-exclusive/) — 15 file

| File | W×H | Size |
|---|---|---|
| [`bronze-stele-armor.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/monster-exclusive/bronze-stele-armor.png) | 183x180 | 60.1 KB |
| [`dryvine-staff.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/monster-exclusive/dryvine-staff.png) | 183x180 | 30.0 KB |
| [`fang-split-dagger.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/monster-exclusive/fang-split-dagger.png) | 183x180 | 26.9 KB |
| [`mushroom-rock-armor.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/monster-exclusive/mushroom-rock-armor.png) | 183x180 | 65.0 KB |
| [`rage-ring.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/monster-exclusive/rage-ring.png) | 183x180 | 45.1 KB |
| [`rotbone-saber.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/monster-exclusive/rotbone-saber.png) | 183x180 | 34.1 KB |
| [`savage-horn-charm.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/monster-exclusive/savage-horn-charm.png) | 183x180 | 39.6 KB |
| [`scale-necklace.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/monster-exclusive/scale-necklace.png) | 182x180 | 52.5 KB |
| [`shadow-chase-boots.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/monster-exclusive/shadow-chase-boots.png) | 182x180 | 59.2 KB |
| [`shadow-chase-claw.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/monster-exclusive/shadow-chase-claw.png) | 183x180 | 31.4 KB |
| [`shroud-wrap.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/monster-exclusive/shroud-wrap.png) | 183x180 | 55.5 KB |
| [`spider-fang-sword.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/monster-exclusive/spider-fang-sword.png) | 183x180 | 39.2 KB |
| [`spike-helm.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/monster-exclusive/spike-helm.png) | 183x180 | 61.4 KB |
| [`toad-leap-boots.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/monster-exclusive/toad-leap-boots.png) | 183x180 | 61.1 KB |
| [`vinewrap-charm.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/monster-exclusive/vinewrap-charm.png) | 183x180 | 55.8 KB |

#### [`icon/item-icon/equipment/exclusive-equipment/trial-tower/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/trial-tower/) — 11 file

| File | W×H | Size |
|---|---|---|
| [`relic-bloodfate-armor.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/trial-tower/relic-bloodfate-armor.png) | 183x180 | 69.8 KB |
| [`relic-browbone-helm.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/trial-tower/relic-browbone-helm.png) | 183x180 | 47.9 KB |
| [`relic-cloudsever-sword.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/trial-tower/relic-cloudsever-sword.png) | 183x180 | 19.6 KB |
| [`relic-dread-bell.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/trial-tower/relic-dread-bell.png) | 183x180 | 43.5 KB |
| [`relic-exquisite-ring.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/trial-tower/relic-exquisite-ring.png) | 183x180 | 44.4 KB |
| [`relic-feather-boots.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/trial-tower/relic-feather-boots.png) | 183x180 | 56.4 KB |
| [`relic-five-elements-stone.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/trial-tower/relic-five-elements-stone.png) | 183x180 | 48.5 KB |
| [`relic-peak-sword.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/trial-tower/relic-peak-sword.png) | 183x180 | 17.3 KB |
| [`relic-peak-ward-armor.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/trial-tower/relic-peak-ward-armor.png) | 183x180 | 66.7 KB |
| [`relic-spirit-pendant.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/trial-tower/relic-spirit-pendant.png) | 183x180 | 36.2 KB |
| [`relic-thunder-prison-jade.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/trial-tower/relic-thunder-prison-jade.png) | 183x180 | 48.4 KB |

#### [`icon/item-icon/equipment/exclusive-equipment/vault/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/vault/) — 7 file

| File | W×H | Size |
|---|---|---|
| [`army-breaker-talisman.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/vault/army-breaker-talisman.png) | 183x180 | 39.2 KB |
| [`martial-jade-pendant.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/vault/martial-jade-pendant.png) | 183x180 | 52.5 KB |
| [`pine-pattern-robe.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/vault/pine-pattern-robe.png) | 183x180 | 62.9 KB |
| [`scale-split-battlegear.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/vault/scale-split-battlegear.png) | 183x180 | 68.1 KB |
| [`swan-ring-magic.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/vault/swan-ring-magic.png) | 183x180 | 48.4 KB |
| [`swan-ring-war.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/vault/swan-ring-war.png) | 183x180 | 48.4 KB |
| [`tribulation-garb.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/exclusive-equipment/vault/tribulation-garb.png) | 183x180 | 62.8 KB |

#### [`icon/item-icon/equipment/head/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/head/) — 6 file

| File | W×H | Size |
|---|---|---|
| [`1-iron-browband.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/head/1-iron-browband.png) | 183x180 | 35.3 KB |
| [`1.2-hair-crown.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/head/1.2-hair-crown.png) | 183x180 | 52.3 KB |
| [`1.5-hardhide-helm.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/head/1.5-hardhide-helm.png) | 183x180 | 37.0 KB |
| [`1.9-face-veil.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/head/1.9-face-veil.png) | 182x180 | 45.6 KB |
| [`2.4-rockhorn-helm.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/head/2.4-rockhorn-helm.png) | 183x180 | 37.5 KB |
| [`3-head-ward-crown.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/head/3-head-ward-crown.png) | 183x180 | 38.8 KB |

#### [`icon/item-icon/equipment/shoes/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/shoes/) — 6 file

| File | W×H | Size |
|---|---|---|
| [`1-swiftstep-boots.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/shoes/1-swiftstep-boots.png) | 183x180 | 51.4 KB |
| [`1.2-lightcloth-treads.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/shoes/1.2-lightcloth-treads.png) | 183x180 | 51.0 KB |
| [`1.5-earthpress-boots.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/shoes/1.5-earthpress-boots.png) | 183x180 | 45.5 KB |
| [`1.9-wind-chase-treads.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/shoes/1.9-wind-chase-treads.png) | 182x180 | 49.1 KB |
| [`2.4-ankle-wrap-boots.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/shoes/2.4-ankle-wrap-boots.png) | 183x180 | 42.4 KB |
| [`3-stilldust-treads.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/shoes/3-stilldust-treads.png) | 183x180 | 38.8 KB |

#### [`icon/item-icon/equipment/weapon-type/club/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/club/) — 6 file

| File | W×H | Size |
|---|---|---|
| [`1-wooden-stick.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/club/1-wooden-stick.png) | 183x180 | 11.3 KB |
| [`1.2-handpress-staff.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/club/1.2-handpress-staff.png) | 183x180 | 12.7 KB |
| [`1.5-heavy-staff.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/club/1.5-heavy-staff.png) | 183x180 | 13.3 KB |
| [`1.9-stone-crush-staff.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/club/1.9-stone-crush-staff.png) | 182x180 | 15.5 KB |
| [`2.4-stele-break-staff.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/club/2.4-stele-break-staff.png) | 183x180 | 15.3 KB |
| [`3-stone-shaker-staff.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/club/3-stone-shaker-staff.png) | 183x180 | 14.3 KB |

#### [`icon/item-icon/equipment/weapon-type/saber/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/saber/) — 6 file

| File | W×H | Size |
|---|---|---|
| [`1-iron-saber.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/saber/1-iron-saber.png) | 183x180 | 16.7 KB |
| [`1.2-thickback-saber.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/saber/1.2-thickback-saber.png) | 183x180 | 18.6 KB |
| [`1.5-bone-crack-saber.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/saber/1.5-bone-crack-saber.png) | 182x180 | 22.9 KB |
| [`1.9-tendon-sever-blade.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/saber/1.9-tendon-sever-blade.png) | 183x180 | 15.0 KB |
| [`2.4-rock-crush-saber.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/saber/2.4-rock-crush-saber.png) | 183x180 | 18.0 KB |
| [`3-bone-ward-heavy-saber.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/saber/3-bone-ward-heavy-saber.png) | 183x180 | 19.1 KB |

#### [`icon/item-icon/equipment/weapon-type/staff/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/staff/) — 6 file

| File | W×H | Size |
|---|---|---|
| [`1-stone-pattern-staff.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/staff/1-stone-pattern-staff.png) | 182x180 | 12.3 KB |
| [`1.2-greenwood-staff.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/staff/1.2-greenwood-staff.png) | 183x180 | 10.0 KB |
| [`1.5-redfire-short-staff.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/staff/1.5-redfire-short-staff.png) | 183x180 | 10.6 KB |
| [`1.9-wave-staff.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/staff/1.9-wave-staff.png) | 183x180 | 11.2 KB |
| [`2.4-thick-earth-staff.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/staff/2.4-thick-earth-staff.png) | 183x180 | 13.5 KB |
| [`3-forgegold-staff.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/staff/3-forgegold-staff.png) | 183x180 | 18.3 KB |

#### [`icon/item-icon/equipment/weapon-type/sword/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/sword/) — 12 file

| File | W×H | Size |
|---|---|---|
| [`1-green-edge-sword.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/sword/1-green-edge-sword.png) | 183x180 | 11.6 KB |
| [`1-water-guide-sword.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/sword/1-water-guide-sword.png) | 183x180 | 11.8 KB |
| [`1.2-sand-shard-sword.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/sword/1.2-sand-shard-sword.png) | 183x180 | 15.0 KB |
| [`1.2-straight-sword.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/sword/1.2-straight-sword.png) | 183x180 | 13.5 KB |
| [`1.5-armor-pierce-sword.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/sword/1.5-armor-pierce-sword.png) | 183x180 | 10.9 KB |
| [`1.5-brushwood-sword.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/sword/1.5-brushwood-sword.png) | 183x180 | 12.2 KB |
| [`1.9-goldfall-sword.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/sword/1.9-goldfall-sword.png) | 183x180 | 12.0 KB |
| [`1.9-leaf-pierce-sword.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/sword/1.9-leaf-pierce-sword.png) | 183x180 | 11.7 KB |
| [`2.4-branch-burn-sword.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/sword/2.4-branch-burn-sword.png) | 182x180 | 17.0 KB |
| [`2.4-iron-cleave-sword.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/sword/2.4-iron-cleave-sword.png) | 183x180 | 17.6 KB |
| [`3-riversink-sword.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/sword/3-riversink-sword.png) | 183x180 | 15.4 KB |
| [`3-steel-sever-sword.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/equipment/weapon-type/sword/3-steel-sever-sword.png) | 183x180 | 18.2 KB |

#### [`icon/item-icon/inscription/body-realm-inscriptions/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/inscription/body-realm-inscriptions/) — 16 file

| File | W×H | Size |
|---|---|---|
| [`01-blood-clot-stone.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/inscription/body-realm-inscriptions/01-blood-clot-stone.png) | 183x180 | 33.0 KB |
| [`02-hone-strength-stone.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/inscription/body-realm-inscriptions/02-hone-strength-stone.png) | 183x180 | 26.3 KB |
| [`03-spirit-infused-stone.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/inscription/body-realm-inscriptions/03-spirit-infused-stone.png) | 183x180 | 22.1 KB |
| [`04-shadow-chase-stone.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/inscription/body-realm-inscriptions/04-shadow-chase-stone.png) | 182x180 | 21.8 KB |
| [`05-bone-forge-stone.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/inscription/body-realm-inscriptions/05-bone-forge-stone.png) | 183x180 | 34.3 KB |
| [`06-edge-break-stone.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/inscription/body-realm-inscriptions/06-edge-break-stone.png) | 183x180 | 20.3 KB |
| [`07-mystic-curse-stone.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/inscription/body-realm-inscriptions/07-mystic-curse-stone.png) | 183x180 | 28.6 KB |
| [`08-longevity-stone.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/inscription/body-realm-inscriptions/08-longevity-stone.png) | 183x180 | 22.7 KB |
| [`09-keen-stone.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/inscription/body-realm-inscriptions/09-keen-stone.png) | 183x180 | 28.7 KB |
| [`10-vein-corrode-stone.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/inscription/body-realm-inscriptions/10-vein-corrode-stone.png) | 183x180 | 20.5 KB |
| [`11-spring-return-stone.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/inscription/body-realm-inscriptions/11-spring-return-stone.png) | 182x180 | 27.3 KB |
| [`12-soul-sever-stone.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/inscription/body-realm-inscriptions/12-soul-sever-stone.png) | 183x180 | 27.8 KB |
| [`13-swiftwalk-stone.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/inscription/body-realm-inscriptions/13-swiftwalk-stone.png) | 183x180 | 27.9 KB |
| [`15-drift-feather-stone.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/inscription/body-realm-inscriptions/15-drift-feather-stone.png) | 183x180 | 25.7 KB |
| [`16-armor-crack-stone.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/inscription/body-realm-inscriptions/16-armor-crack-stone.png) | 183x180 | 23.9 KB |
| [`17-law-break-stone.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/inscription/body-realm-inscriptions/17-law-break-stone.png) | 183x180 | 22.4 KB |

#### [`icon/item-icon/material/alchemy-materials/body-realm-pill-materials/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/alchemy-materials/body-realm-pill-materials/) — 16 file

| File | W×H | Size |
|---|---|---|
| [`01-cyan-spirit-herb.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/alchemy-materials/body-realm-pill-materials/01-cyan-spirit-herb.png) | 183x180 | 38.0 KB |
| [`02-red-sun-flower.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/alchemy-materials/body-realm-pill-materials/02-red-sun-flower.png) | 183x180 | 47.4 KB |
| [`03-calmheart-leaf.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/alchemy-materials/body-realm-pill-materials/03-calmheart-leaf.png) | 183x180 | 48.8 KB |
| [`04-windwalk-leaf.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/alchemy-materials/body-realm-pill-materials/04-windwalk-leaf.png) | 182x180 | 35.8 KB |
| [`05-thick-earth-powder.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/alchemy-materials/body-realm-pill-materials/05-thick-earth-powder.png) | 183x180 | 48.4 KB |
| [`06-stone-milk.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/alchemy-materials/body-realm-pill-materials/06-stone-milk.png) | 183x180 | 44.5 KB |
| [`07-star-mango.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/alchemy-materials/body-realm-pill-materials/07-star-mango.png) | 183x180 | 44.8 KB |
| [`08-iron-bone-sand.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/alchemy-materials/body-realm-pill-materials/08-iron-bone-sand.png) | 183x180 | 52.1 KB |
| [`09-origin-return-vine.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/alchemy-materials/body-realm-pill-materials/09-origin-return-vine.png) | 183x180 | 48.5 KB |
| [`10-jade-bamboo-ginseng.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/alchemy-materials/body-realm-pill-materials/10-jade-bamboo-ginseng.png) | 183x180 | 30.2 KB |
| [`11-dew-flower.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/alchemy-materials/body-realm-pill-materials/11-dew-flower.png) | 182x180 | 47.3 KB |
| [`12-roaming-dragon-leaf.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/alchemy-materials/body-realm-pill-materials/12-roaming-dragon-leaf.png) | 183x180 | 37.9 KB |
| [`13-mystic-armor-fungus.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/alchemy-materials/body-realm-pill-materials/13-mystic-armor-fungus.png) | 183x180 | 43.6 KB |
| [`14-red-jade-fungus.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/alchemy-materials/body-realm-pill-materials/14-red-jade-fungus.png) | 183x180 | 44.8 KB |
| [`15-earth-vein-marrow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/alchemy-materials/body-realm-pill-materials/15-earth-vein-marrow.png) | 183x180 | 51.6 KB |
| [`16-mystic-marrow-cinnabar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/alchemy-materials/body-realm-pill-materials/16-mystic-marrow-cinnabar.png) | 183x180 | 48.3 KB |

#### [`icon/item-icon/material/equipment-material/body-realm-gear-materials/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/equipment-material/body-realm-gear-materials/) — 16 file

| File | W×H | Size |
|---|---|---|
| [`01-cotton-padding.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/equipment-material/body-realm-gear-materials/01-cotton-padding.png) | 183x180 | 55.1 KB |
| [`02-coarse-cloth-lining.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/equipment-material/body-realm-gear-materials/02-coarse-cloth-lining.png) | 183x180 | 54.1 KB |
| [`04-jade-heart-drop.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/equipment-material/body-realm-gear-materials/04-jade-heart-drop.png) | 183x180 | 32.4 KB |
| [`06-beast-hide-headguard.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/equipment-material/body-realm-gear-materials/06-beast-hide-headguard.png) | 183x180 | 41.2 KB |
| [`07-coarse-cloth-cut.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/equipment-material/body-realm-gear-materials/07-coarse-cloth-cut.png) | 183x180 | 53.0 KB |
| [`08-soft-leather-sole.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/equipment-material/body-realm-gear-materials/08-soft-leather-sole.png) | 182x180 | 50.0 KB |
| [`09-ox-tendon-rope.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/equipment-material/body-realm-gear-materials/09-ox-tendon-rope.png) | 183x180 | 56.1 KB |
| [`10-copper-wire-fastener.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/equipment-material/body-realm-gear-materials/10-copper-wire-fastener.png) | 183x180 | 48.9 KB |
| [`12-face-guard-plate.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/equipment-material/body-realm-gear-materials/12-face-guard-plate.png) | 183x180 | 51.5 KB |
| [`13-fine-linen.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/equipment-material/body-realm-gear-materials/13-fine-linen.png) | 183x180 | 56.2 KB |
| [`14-light-leather.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/equipment-material/body-realm-gear-materials/14-light-leather.png) | 183x180 | 50.0 KB |
| [`15-warm-jade-chip.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/equipment-material/body-realm-gear-materials/15-warm-jade-chip.png) | 183x180 | 46.3 KB |
| [`16-forge-marked-sand.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/equipment-material/body-realm-gear-materials/16-forge-marked-sand.png) | 183x180 | 57.9 KB |
| [`hematite-ore.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/equipment-material/body-realm-gear-materials/hematite-ore.png) | 183x180 | 53.5 KB |
| [`spirit-vein-ore.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/equipment-material/body-realm-gear-materials/spirit-vein-ore.png) | 183x180 | 51.8 KB |
| [`veined-iron-ore.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/material/equipment-material/body-realm-gear-materials/veined-iron-ore.png) | 183x180 | 54.6 KB |

#### [`icon/item-icon/pill/body-realm-pills/cultivation-pills/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/pill/body-realm-pills/cultivation-pills/) — 15 file

| File | W×H | Size |
|---|---|---|
| [`01-ox-strength-powder.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/pill/body-realm-pills/cultivation-pills/01-ox-strength-powder.png) | 183x180 | 46.8 KB |
| [`02-tiger-bone-pill.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/pill/body-realm-pills/cultivation-pills/02-tiger-bone-pill.png) | 183x180 | 49.7 KB |
| [`03-dragon-tiger-pill.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/pill/body-realm-pills/cultivation-pills/03-dragon-tiger-pill.png) | 183x180 | 40.6 KB |
| [`04-qi-nourish-powder.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/pill/body-realm-pills/cultivation-pills/04-qi-nourish-powder.png) | 182x180 | 38.6 KB |
| [`05-origin-return-pill.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/pill/body-realm-pills/cultivation-pills/05-origin-return-pill.png) | 183x180 | 44.2 KB |
| [`06-breath-condense-pill.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/pill/body-realm-pills/cultivation-pills/06-breath-condense-pill.png) | 183x180 | 40.8 KB |
| [`07-lightbody-powder.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/pill/body-realm-pills/cultivation-pills/07-lightbody-powder.png) | 183x180 | 38.8 KB |
| [`08-roaming-dragon-pill.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/pill/body-realm-pills/cultivation-pills/08-roaming-dragon-pill.png) | 183x180 | 39.4 KB |
| [`09-wind-chase-pill.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/pill/body-realm-pills/cultivation-pills/09-wind-chase-pill.png) | 183x180 | 50.3 KB |
| [`10-bone-forge-powder.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/pill/body-realm-pills/cultivation-pills/10-bone-forge-powder.png) | 183x180 | 45.9 KB |
| [`11-gold-marrow-pill.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/pill/body-realm-pills/cultivation-pills/11-gold-marrow-pill.png) | 182x180 | 46.6 KB |
| [`12-golden-body-pill.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/pill/body-realm-pills/cultivation-pills/12-golden-body-pill.png) | 183x180 | 43.1 KB |
| [`13-blood-nourish-powder.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/pill/body-realm-pills/cultivation-pills/13-blood-nourish-powder.png) | 183x180 | 41.3 KB |
| [`14-red-prime-pill.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/pill/body-realm-pills/cultivation-pills/14-red-prime-pill.png) | 183x180 | 53.3 KB |
| [`15-life-prime-pill.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/pill/body-realm-pills/cultivation-pills/15-life-prime-pill.png) | 183x180 | 38.4 KB |

#### [`icon/item-icon/resource-pack/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/resource-pack/) — 12 file

| File | W×H | Size |
|---|---|---|
| [`coin-pouch-large.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/resource-pack/coin-pouch-large.png) | 183x180 | 57.6 KB |
| [`coin-pouch-medium.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/resource-pack/coin-pouch-medium.png) | 183x180 | 48.8 KB |
| [`coin-pouch-small.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/resource-pack/coin-pouch-small.png) | 183x180 | 42.0 KB |
| [`iron-pack-large.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/resource-pack/iron-pack-large.png) | 183x180 | 61.9 KB |
| [`iron-pack-medium.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/resource-pack/iron-pack-medium.png) | 183x180 | 51.7 KB |
| [`iron-pack-small.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/resource-pack/iron-pack-small.png) | 183x180 | 45.6 KB |
| [`stone-pack-large.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/resource-pack/stone-pack-large.png) | 183x180 | 61.4 KB |
| [`stone-pack-medium.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/resource-pack/stone-pack-medium.png) | 183x180 | 53.2 KB |
| [`stone-pack-small.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/resource-pack/stone-pack-small.png) | 183x180 | 44.5 KB |
| [`wood-pack-large.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/resource-pack/wood-pack-large.png) | 183x180 | 64.3 KB |
| [`wood-pack-medium.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/resource-pack/wood-pack-medium.png) | 183x180 | 55.2 KB |
| [`wood-pack-small.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/resource-pack/wood-pack-small.png) | 183x180 | 49.1 KB |

#### [`icon/item-icon/special-item/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/special-item/) — 10 file

| File | W×H | Size |
|---|---|---|
| [`demon-rift-ticket.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/special-item/demon-rift-ticket.png) | 183x180 | 38.8 KB |
| [`evolution-stone.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/special-item/evolution-stone.png) | 183x180 | 34.9 KB |
| [`fusion-stone.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/special-item/fusion-stone.png) | 183x180 | 41.3 KB |
| [`recruit-token.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/special-item/recruit-token.png) | 183x180 | 28.5 KB |
| [`reroll-stone.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/special-item/reroll-stone.png) | 183x180 | 37.4 KB |
| [`spirit-seal-stone.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/special-item/spirit-seal-stone.png) | 183x180 | 40.9 KB |
| [`spirit-stone-large.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/special-item/spirit-stone-large.png) | 183x180 | 41.1 KB |
| [`spirit-stone-mid.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/special-item/spirit-stone-mid.png) | 183x180 | 38.9 KB |
| [`spirit-stone-small.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/special-item/spirit-stone-small.png) | 183x180 | 32.7 KB |
| [`treasure-seek-token.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/item-icon/special-item/treasure-seek-token.png) | 182x180 | 32.1 KB |

#### [`icon/skill-icon/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/) — 1 file

| File | W×H | Size |
|---|---|---|
| [`test-skill-icon-taiyi-sword-sutra.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/test-skill-icon-taiyi-sword-sutra.png) | 89x89 | 16.2 KB |

#### [`icon/skill-icon/character-skill-icon/gaosheng/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/gaosheng/) — 7 file

| File | W×H | Size |
|---|---|---|
| [`gaosheng-bloodbody-will.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/gaosheng/gaosheng-bloodbody-will.png) | 400x400 | 300.1 KB |
| [`gaosheng-bloodfate-berserk.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/gaosheng/gaosheng-bloodfate-berserk.png) | 400x400 | 307.2 KB |
| [`gaosheng-bloodfate-iron-body.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/gaosheng/gaosheng-bloodfate-iron-body.png) | 400x400 | 312.1 KB |
| [`gaosheng-bloodfate-unyielding.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/gaosheng/gaosheng-bloodfate-unyielding.png) | 400x400 | 314.2 KB |
| [`gaosheng-splitblood-heavy-slash.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/gaosheng/gaosheng-splitblood-heavy-slash.png) | 400x400 | 304.8 KB |
| [`gaosheng-splitblood-slash.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/gaosheng/gaosheng-splitblood-slash.png) | 400x400 | 299.8 KB |
| [`gaosheng-splitblood-sweep.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/gaosheng/gaosheng-splitblood-sweep.png) | 400x400 | 307.9 KB |

#### [`icon/skill-icon/character-skill-icon/gaosheng/battle-card/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/gaosheng/battle-card/) — 1 file

| File | W×H | Size |
|---|---|---|
| [`gaosheng-bloodfate-unyielding.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/gaosheng/battle-card/gaosheng-bloodfate-unyielding.png) | 96x98 | 22.7 KB |

#### [`icon/skill-icon/character-skill-icon/qingshuangzi/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/qingshuangzi/) — 7 file

| File | W×H | Size |
|---|---|---|
| [`qingshuangzi-sky-thunder-annihilation.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/qingshuangzi/qingshuangzi-sky-thunder-annihilation.png) | 400x400 | 321.8 KB |
| [`qingshuangzi-sky-thunder-myriad-shocks.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/qingshuangzi/qingshuangzi-sky-thunder-myriad-shocks.png) | 400x400 | 309.3 KB |
| [`qingshuangzi-sky-thunder-prison.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/qingshuangzi/qingshuangzi-sky-thunder-prison.png) | 400x400 | 300.6 KB |
| [`qingshuangzi-thunder-tide.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/qingshuangzi/qingshuangzi-thunder-tide.png) | 400x400 | 292.1 KB |
| [`qingshuangzi-thundercall-barrier-break.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/qingshuangzi/qingshuangzi-thundercall-barrier-break.png) | 400x400 | 348.5 KB |
| [`qingshuangzi-thundercall-charge.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/qingshuangzi/qingshuangzi-thundercall-charge.png) | 400x400 | 338.1 KB |
| [`qingshuangzi-thundercall.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/qingshuangzi/qingshuangzi-thundercall.png) | 400x400 | 296.2 KB |

#### [`icon/skill-icon/character-skill-icon/qingshuangzi/battle-card/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/qingshuangzi/battle-card/) — 1 file

| File | W×H | Size |
|---|---|---|
| [`qingshuangzi-sky-thunder-prison.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/qingshuangzi/battle-card/qingshuangzi-sky-thunder-prison.png) | 97x98 | 23.6 KB |

#### [`icon/skill-icon/character-skill-icon/youzhu/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/youzhu/) — 7 file

| File | W×H | Size |
|---|---|---|
| [`youzhu-greenwood-blessing.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/youzhu/youzhu-greenwood-blessing.png) | 400x400 | 328.5 KB |
| [`youzhu-greenwood-grand-blessing.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/youzhu/youzhu-greenwood-grand-blessing.png) | 400x400 | 335.8 KB |
| [`youzhu-greenwood-revival.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/youzhu/youzhu-greenwood-revival.png) | 400x400 | 327.8 KB |
| [`youzhu-lifebreath-rejuvenation.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/youzhu/youzhu-lifebreath-rejuvenation.png) | 400x400 | 275.5 KB |
| [`youzhu-rejuvenation-dense-sprout.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/youzhu/youzhu-rejuvenation-dense-sprout.png) | 400x400 | 313.1 KB |
| [`youzhu-rejuvenation-split.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/youzhu/youzhu-rejuvenation-split.png) | 400x400 | 304.8 KB |
| [`youzhu-spring-breeze.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/youzhu/youzhu-spring-breeze.png) | 400x400 | 297.6 KB |

#### [`icon/skill-icon/character-skill-icon/youzhu/battle-card/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/youzhu/battle-card/) — 1 file

| File | W×H | Size |
|---|---|---|
| [`youzhu-greenwood-revival.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/youzhu/battle-card/youzhu-greenwood-revival.png) | 98x98 | 24.2 KB |

#### [`icon/skill-icon/character-skill-icon/yuejianxin/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/yuejianxin/) — 7 file

| File | W×H | Size |
|---|---|---|
| [`yuejianxin-flowedge-chain-slash.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/yuejianxin/yuejianxin-flowedge-chain-slash.png) | 400x400 | 313.1 KB |
| [`yuejianxin-flowedge-roam.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/yuejianxin/yuejianxin-flowedge-roam.png) | 400x400 | 320.5 KB |
| [`yuejianxin-flowedge-sword-form.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/yuejianxin/yuejianxin-flowedge-sword-form.png) | 400x400 | 305.9 KB |
| [`yuejianxin-sword-domain-extreme-edge.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/yuejianxin/yuejianxin-sword-domain-extreme-edge.png) | 400x400 | 303.6 KB |
| [`yuejianxin-sword-domain-stack.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/yuejianxin/yuejianxin-sword-domain-stack.png) | 400x400 | 300.0 KB |
| [`yuejianxin-sword-domain-unrivaled.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/yuejianxin/yuejianxin-sword-domain-unrivaled.png) | 400x400 | 254.7 KB |
| [`yuejianxin-unrivaled-sword-force.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/yuejianxin/yuejianxin-unrivaled-sword-force.png) | 400x400 | 283.8 KB |

#### [`icon/skill-icon/character-skill-icon/yuejianxin/battle-card/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/yuejianxin/battle-card/) — 1 file

| File | W×H | Size |
|---|---|---|
| [`yuejianxin-sword-domain-unrivaled.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/yuejianxin/battle-card/yuejianxin-sword-domain-unrivaled.png) | 97x97 | 19.8 KB |

#### [`icon/skill-icon/character-skill-icon/zuofeng/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/zuofeng/) — 7 file

| File | W×H | Size |
|---|---|---|
| [`zuofeng-sky-sword-full-will.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/zuofeng/zuofeng-sky-sword-full-will.png) | 400x400 | 318.6 KB |
| [`zuofeng-sky-sword-veiled.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/zuofeng/zuofeng-sky-sword-veiled.png) | 400x400 | 326.5 KB |
| [`zuofeng-sky-sword.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/zuofeng/zuofeng-sky-sword.png) | 400x400 | 331.8 KB |
| [`zuofeng-sword-will-endure.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/zuofeng/zuofeng-sword-will-endure.png) | 400x400 | 352.8 KB |
| [`zuofeng-swordride-art.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/zuofeng/zuofeng-swordride-art.png) | 400x400 | 308.3 KB |
| [`zuofeng-swordride-edge-rise.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/zuofeng/zuofeng-swordride-edge-rise.png) | 400x400 | 313.9 KB |
| [`zuofeng-swordride-nurture-will.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/zuofeng/zuofeng-swordride-nurture-will.png) | 400x400 | 292.8 KB |

#### [`icon/skill-icon/character-skill-icon/zuofeng/battle-card/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/zuofeng/battle-card/) — 1 file

| File | W×H | Size |
|---|---|---|
| [`zuofeng-sky-sword.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/character-skill-icon/zuofeng/battle-card/zuofeng-sky-sword.png) | 97x98 | 20.6 KB |

#### [`icon/skill-icon/minor-skill-icon/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/minor-skill-icon/) — 14 file

| File | W×H | Size |
|---|---|---|
| [`armor-break-art.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/minor-skill-icon/armor-break-art.png) | 139x120 | 42.4 KB |
| [`corrode-wound-art.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/minor-skill-icon/corrode-wound-art.png) | 139x120 | 40.3 KB |
| [`earth-truth.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/minor-skill-icon/earth-truth.png) | 139x120 | 39.8 KB |
| [`fire-truth.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/minor-skill-icon/fire-truth.png) | 139x120 | 38.4 KB |
| [`focus-command-art.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/minor-skill-icon/focus-command-art.png) | 139x120 | 39.9 KB |
| [`inch-force-art.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/minor-skill-icon/inch-force-art.png) | 139x120 | 39.8 KB |
| [`iron-guard-art.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/minor-skill-icon/iron-guard-art.png) | 140x120 | 41.6 KB |
| [`lightbody-art.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/minor-skill-icon/lightbody-art.png) | 139x120 | 39.0 KB |
| [`metal-truth.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/minor-skill-icon/metal-truth.png) | 139x120 | 40.9 KB |
| [`resolve-art.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/minor-skill-icon/resolve-art.png) | 139x120 | 42.4 KB |
| [`root-firm-art.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/minor-skill-icon/root-firm-art.png) | 139x120 | 39.0 KB |
| [`spirit-command-art.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/minor-skill-icon/spirit-command-art.png) | 139x120 | 39.8 KB |
| [`water-truth.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/minor-skill-icon/water-truth.png) | 139x120 | 43.7 KB |
| [`wood-truth.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/icon/skill-icon/minor-skill-icon/wood-truth.png) | 139x120 | 42.4 KB |

#### [`jingshui-city/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/) — 18 file

| File | W×H | Size |
|---|---|---|
| [`bottom-nav-text-tray.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/bottom-nav-text-tray.png) | 182x75 | 27.9 KB |
| [`gold-bg-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/gold-bg-frame.png) | 260x63 | 13.9 KB |
| [`gold-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/gold-icon.png) | 88x85 | 19.7 KB |
| [`item-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/item-icon.png) | 97x107 | 21.0 KB |
| [`jingshui-city-scene.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/jingshui-city-scene.png) | 2048x1152 | 4.1 MB |
| [`martial-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/martial-icon.png) | 100x94 | 18.3 KB |
| [`name-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/name-bg.png) | 343x134 | 68.7 KB |
| [`quest-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/quest-icon.png) | 97x94 | 15.6 KB |
| [`queue-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/queue-icon.png) | 90x110 | 14.6 KB |
| [`realm-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/realm-icon.png) | 90x94 | 15.2 KB |
| [`region-title-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/region-title-box.png) | 886x125 | 230.0 KB |
| [`rep-bar-current.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/rep-bar-current.png) | 150x39 | 0.4 KB |
| [`rep-bar-upgrade.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/rep-bar-upgrade.png) | 201x39 | 0.5 KB |
| [`rep-bg-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/rep-bg-frame.png) | 381x63 | 19.5 KB |
| [`rep-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/rep-icon.png) | 94x92 | 21.5 KB |
| [`rep-nav-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/rep-nav-icon.png) | 72x134 | 17.7 KB |
| [`return-territory-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/return-territory-button.png) | 273x103 | 65.2 KB |
| [`settings-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/settings-icon.png) | 133x106 | 30.1 KB |

#### [`jingshui-city/building/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/building/) — 9 file

| File | W×H | Size |
|---|---|---|
| [`general-store-click.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/building/general-store-click.png) | 889x542 | 706.8 KB |
| [`general-store-glow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/building/general-store-glow.png) | 889x542 | 705.8 KB |
| [`general-store.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/building/general-store.png) | 889x542 | 770.0 KB |
| [`trial-tower-click.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/building/trial-tower-click.png) | 433x482 | 201.7 KB |
| [`trial-tower-glow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/building/trial-tower-glow.png) | 433x482 | 202.9 KB |
| [`trial-tower.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/building/trial-tower.png) | 433x482 | 225.0 KB |
| [`zhenmosi-click.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/building/zhenmosi-click.png) | 1014x652 | 994.7 KB |
| [`zhenmosi-glow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/building/zhenmosi-glow.png) | 1014x652 | 991.3 KB |
| [`zhenmosi.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/jingshui-city/building/zhenmosi.png) | 1014x652 | 1021.9 KB |

#### [`level-detail/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/level-detail/) — 8 file

| File | W×H | Size |
|---|---|---|
| [`battle-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/level-detail/battle-button.png) | 442x97 | 107.7 KB |
| [`close-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/level-detail/close-button.png) | 97x95 | 18.9 KB |
| [`level-detail-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/level-detail/level-detail-frame.png) | 1650x989 | 3.8 MB |
| [`recipe-unlock-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/level-detail/recipe-unlock-icon.png) | 247x248 | 112.0 KB |
| [`scene-image-black-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/level-detail/scene-image-black-bg.png) | 724x378 | 16.8 KB |
| [`scene-texture.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/level-detail/scene-texture.png) | 724x378 | 554.1 KB |
| [`scroll-hint-arrow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/level-detail/scroll-hint-arrow.png) | 73x75 | 3.7 KB |
| [`shadow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/level-detail/shadow.png) | 147x44 | 1.6 KB |

#### [`lord-manor/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/) — 20 file

| File | W×H | Size |
|---|---|---|
| [`building-detail-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/building-detail-frame.png) | 1308x927 | 2.2 MB |
| [`building-list-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/building-list-slot.png) | 364x520 | 363.0 KB |
| [`close-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/close-button.png) | 97x95 | 18.9 KB |
| [`diamond-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/diamond-icon.png) | 24x24 | 1.6 KB |
| [`gold-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/gold-icon.png) | 45x42 | 5.0 KB |
| [`left-arrow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/left-arrow.png) | 36x36 | 3.1 KB |
| [`lord-manor-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/lord-manor-bg.png) | 2048x1152 | 3.0 MB |
| [`lord-manor-plaque.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/lord-manor-plaque.png) | 608x191 | 263.7 KB |
| [`name-bg-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/name-bg-frame.png) | 260x63 | 15.5 KB |
| [`resource-list-label.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/resource-list-label.png) | 1012x90 | 73.9 KB |
| [`right-arrow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/right-arrow.png) | 36x36 | 3.1 KB |
| [`storage-bg-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/storage-bg-frame.png) | 1939x1197 | 3.8 MB |
| [`storage-deposit-withdraw-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/storage-deposit-withdraw-button.png) | 153x62 | 20.7 KB |
| [`storage-entry-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/storage-entry-icon.png) | 170x174 | 58.6 KB |
| [`storage-inventory-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/storage-inventory-frame.png) | 812x1018 | 1.5 MB |
| [`storage-inventory-tab-arrow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/storage-inventory-tab-arrow.png) | 20x25 | 1.6 KB |
| [`storage-sort-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/storage-sort-button.png) | 153x62 | 20.6 KB |
| [`territory-detail-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/territory-detail-frame.png) | 1939x1197 | 4.1 MB |
| [`upgrade-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/upgrade-button.png) | 260x90 | 48.9 KB |
| [`view-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/view-button.png) | 198x69 | 31.2 KB |

#### [`lord-manor/detail-texture/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/detail-texture/) — 9 file

| File | W×H | Size |
|---|---|---|
| [`alchemy-room.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/detail-texture/alchemy-room.png) | 352x221 | 179.9 KB |
| [`blacksmith.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/detail-texture/blacksmith.png) | 352x221 | 190.2 KB |
| [`cultivation-room.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/detail-texture/cultivation-room.png) | 352x221 | 186.0 KB |
| [`mine.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/detail-texture/mine.png) | 352x221 | 182.5 KB |
| [`quarry.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/detail-texture/quarry.png) | 352x221 | 189.3 KB |
| [`territory.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/detail-texture/territory.png) | 352x221 | 186.2 KB |
| [`treasure-altar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/detail-texture/treasure-altar.png) | 352x221 | 177.4 KB |
| [`treasure-pavilion.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/detail-texture/treasure-pavilion.png) | 352x221 | 194.8 KB |
| [`woodlot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/lord-manor/detail-texture/woodlot.png) | 352x221 | 186.5 KB |

#### [`menu/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/) — 23 file

| File | W×H | Size |
|---|---|---|
| [`arrow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/arrow.png) | 48x21 | 0.4 KB |
| [`back-ui.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/back-ui.png) | 109x107 | 24.2 KB |
| [`bonus-attribute-inner-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/bonus-attribute-inner-box.png) | 664x327 | 143.3 KB |
| [`character-avatar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/character-avatar.png) | 98x143 | 28.8 KB |
| [`main-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/main-bg.png) | 2048x1152 | 4.3 MB |
| [`main-menu-close-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/main-menu-close-button.png) | 112x91 | 20.7 KB |
| [`main-menu-cursor.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/main-menu-cursor.png) | 212x99 | 51.6 KB |
| [`menu-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/menu-bg.png) | 2048x1148 | 441.7 KB |
| [`menu-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/menu-button.png) | 216x79 | 26.6 KB |
| [`queue-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/queue-bg.png) | 1940x1346 | 116.7 KB |
| [`rep-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/rep-box.png) | 543x177 | 18.8 KB |
| [`roster-bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/roster-bar.png) | 294x163 | 21.7 KB |
| [`skill-config-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/skill-config-bg.png) | 1838x501 | 60.1 KB |
| [`slider-bar-1.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/slider-bar-1.png) | 523x67 | 48.5 KB |
| [`slider-bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/slider-bar.png) | 27x879 | 9.4 KB |
| [`slider.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/slider.png) | 24x564 | 7.7 KB |
| [`sort-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/sort-box.png) | 287x199 | 20.3 KB |
| [`sort-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/sort-button.png) | 145x54 | 10.5 KB |
| [`sort-check-ticked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/sort-check-ticked.png) | 32x32 | 2.2 KB |
| [`sort-check.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/sort-check.png) | 32x32 | 1.9 KB |
| [`team-attribute-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/team-attribute-box.png) | 666x427 | 115.6 KB |
| [`top-bar-option-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/top-bar-option-button.png) | 206x66 | 19.3 KB |
| [`top-bar-selected-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/top-bar-selected-button.png) | 230x102 | 41.9 KB |

#### [`menu/character-list/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/character-list/) — 7 file

| File | W×H | Size |
|---|---|---|
| [`character-card-123.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/character-list/character-card-123.png) | 422x135 | 95.5 KB |
| [`roster-box-selected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/character-list/roster-box-selected.png) | 429x139 | 111.8 KB |
| [`roster-box-unselected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/character-list/roster-box-unselected.png) | 429x139 | 112.6 KB |
| [`roster-selected-frame-123.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/character-list/roster-selected-frame-123.png) | 422x135 | 109.1 KB |
| [`slider-bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/character-list/slider-bar.png) | 37x929 | 70.9 KB |
| [`slider.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/character-list/slider.png) | 18x757 | 17.9 KB |
| [`team-list-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/character-list/team-list-frame.png) | 551x1212 | 1.2 MB |

#### [`menu/item/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/) — 33 file

| File | W×H | Size |
|---|---|---|
| [`agility-swatch.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/agility-swatch.png) | 6x6 | 0.2 KB |
| [`aptitude-swatch.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/aptitude-swatch.png) | 6x6 | 0.2 KB |
| [`attribute-filter-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/attribute-filter-box.png) | 486x615 | 507.4 KB |
| [`character-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/character-bg.png) | 1104x242 | 566.2 KB |
| [`checkbox-checked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/checkbox-checked.png) | 41x38 | 4.2 KB |
| [`checkbox-unchecked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/checkbox-unchecked.png) | 38x36 | 3.2 KB |
| [`copper-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/copper-icon.png) | 49x50 | 6.4 KB |
| [`exp-bar-empty.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/exp-bar-empty.png) | 894x31 | 72.5 KB |
| [`exp-bar-full.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/exp-bar-full.png) | 894x29 | 62.5 KB |
| [`exp-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/exp-icon.png) | 97x98 | 23.4 KB |
| [`filter-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/filter-box.png) | 401x286 | 237.5 KB |
| [`filter-open-arrow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/filter-open-arrow.png) | 35x28 | 2.4 KB |
| [`filter-screen-button-selected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/filter-screen-button-selected.png) | 163x53 | 21.1 KB |
| [`filter-screen-button-unselected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/filter-screen-button-unselected.png) | 163x53 | 18.6 KB |
| [`filter-screen-reset-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/filter-screen-reset-button.png) | 163x53 | 20.0 KB |
| [`filter-sort-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/filter-sort-frame.png) | 633x639 | 807.9 KB |
| [`health-swatch.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/health-swatch.png) | 6x6 | 0.2 KB |
| [`item-bar-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/item-bar-frame.png) | 805x1212 | 2.1 MB |
| [`item-menu-cursor.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/item-menu-cursor.png) | 112x56 | 14.2 KB |
| [`item-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/item-slot.png) | 101x101 | 25.1 KB |
| [`left-arrow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/left-arrow.png) | 22x24 | 1.6 KB |
| [`left-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/left-button.png) | 171x79 | 28.1 KB |
| [`lock-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/lock-icon.png) | 34x34 | 3.1 KB |
| [`portrait-area-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/portrait-area-frame.png) | 1145x1211 | 2.4 MB |
| [`portrait-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/portrait-bg.png) | 1097x524 | 1.3 MB |
| [`radar-divider.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/radar-divider.png) | 188x3 | 0.3 KB |
| [`right-arrow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/right-arrow.png) | 22x24 | 1.6 KB |
| [`selected-attribute-tab-outer-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/selected-attribute-tab-outer-frame.png) | 243x53 | 34.5 KB |
| [`sell-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/sell-button.png) | 61x60 | 8.8 KB |
| [`sort-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/sort-button.png) | 160x51 | 21.7 KB |
| [`spirit-swatch.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/spirit-swatch.png) | 6x6 | 0.2 KB |
| [`strength-swatch.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/strength-swatch.png) | 6x6 | 0.2 KB |
| [`unselected-state-attribute-tab-outer-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/unselected-state-attribute-tab-outer-frame.png) | 249x50 | 28.1 KB |

#### [`menu/item/sell-screen/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/sell-screen/) — 10 file

| File | W×H | Size |
|---|---|---|
| [`checkbox-checked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/sell-screen/checkbox-checked.png) | 41x38 | 4.2 KB |
| [`relic-quick-sell-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/sell-screen/relic-quick-sell-button.png) | 198x53 | 27.9 KB |
| [`sell-blue.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/sell-screen/sell-blue.png) | 147x101 | 31.5 KB |
| [`sell-dropdown-bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/sell-screen/sell-dropdown-bar.png) | 276x42 | 26.6 KB |
| [`sell-gold.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/sell-screen/sell-gold.png) | 147x101 | 32.3 KB |
| [`sell-green.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/sell-screen/sell-green.png) | 146x101 | 32.0 KB |
| [`sell-purple.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/sell-screen/sell-purple.png) | 146x101 | 32.2 KB |
| [`sell-screen.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/sell-screen/sell-screen.png) | 568x701 | 674.8 KB |
| [`sell-white.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/sell-screen/sell-white.png) | 146x101 | 31.7 KB |
| [`weapon-quick-sell-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/item/sell-screen/weapon-quick-sell-button.png) | 198x53 | 27.5 KB |

#### [`menu/martial/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/martial/) — 15 file

| File | W×H | Size |
|---|---|---|
| [`branch-active-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/martial/branch-active-frame.png) | 548x126 | 82.6 KB |
| [`branch-active-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/martial/branch-active-icon.png) | 38x39 | 4.1 KB |
| [`branch-locked-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/martial/branch-locked-icon.png) | 107x101 | 25.2 KB |
| [`character-martial-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/martial/character-martial-frame.png) | 475x274 | 250.0 KB |
| [`core-passive-title.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/martial/core-passive-title.png) | 941x53 | 107.0 KB |
| [`gradient-mask.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/martial/gradient-mask.png) | 500x500 | 67.7 KB |
| [`main-menu-martial.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/martial/main-menu-martial.png) | 2048x1152 | 4.5 MB |
| [`martial-frame-new.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/martial/martial-frame-new.png) | 1953x1211 | 4.2 MB |
| [`martial-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/martial/martial-frame.png) | 1966x1211 | 4.7 MB |
| [`move-title-bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/martial/move-title-bar.png) | 960x53 | 111.4 KB |
| [`skill-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/martial/skill-box.png) | 104x102 | 25.0 KB |
| [`skill-level-black-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/martial/skill-level-black-bg.png) | 54x24 | 0.3 KB |
| [`talent-icon-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/martial/talent-icon-frame.png) | 117x133 | 20.5 KB |
| [`ultimates-title-bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/martial/ultimates-title-bar.png) | 1125x53 | 130.5 KB |
| [`view-talent-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/martial/view-talent-button.png) | 202x69 | 34.0 KB |

#### [`menu/quest/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/quest/) — 15 file

| File | W×H | Size |
|---|---|---|
| [`abandon-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/quest/abandon-button.png) | 366x92 | 81.8 KB |
| [`checked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/quest/checked.png) | 49x48 | 5.5 KB |
| [`complete-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/quest/complete-button.png) | 366x94 | 84.3 KB |
| [`copper-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/quest/copper-icon.png) | 49x50 | 6.4 KB |
| [`quest-box-selected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/quest/quest-box-selected.png) | 425x97 | 80.2 KB |
| [`quest-box-unselected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/quest/quest-box-unselected.png) | 425x97 | 81.3 KB |
| [`quest-detail-divider.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/quest/quest-detail-divider.png) | 1720x3 | 20.2 KB |
| [`quest-detail-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/quest/quest-detail-frame.png) | 1936x1218 | 3.8 MB |
| [`quest-goal-box-unchecked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/quest/quest-goal-box-unchecked.png) | 50x46 | 5.6 KB |
| [`quest-goal-checked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/quest/quest-goal-checked.png) | 55x52 | 6.5 KB |
| [`quest-goal-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/quest/quest-goal-frame.png) | 298x72 | 42.9 KB |
| [`quest-list-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/quest/quest-list-frame.png) | 574x1217 | 1.4 MB |
| [`reward-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/quest/reward-frame.png) | 469x78 | 75.7 KB |
| [`right-arrow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/quest/right-arrow.png) | 27x34 | 2.3 KB |
| [`unchecked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/quest/unchecked.png) | 42x43 | 4.3 KB |

#### [`menu/queue/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/queue/) — 17 file

| File | W×H | Size |
|---|---|---|
| [`attribute-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/queue/attribute-bg.png) | 308x211 | 3.3 KB |
| [`character-box-cancel-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/queue/character-box-cancel-button.png) | 53x55 | 8.4 KB |
| [`character-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/queue/character-box.png) | 339x566 | 362.4 KB |
| [`delete-skill-config-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/queue/delete-skill-config-button.png) | 36x36 | 1.5 KB |
| [`deployed-bookmark.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/queue/deployed-bookmark.png) | 98x64 | 12.8 KB |
| [`hp-bar-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/queue/hp-bar-bg.png) | 308x109 | 19.5 KB |
| [`hp-bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/queue/hp-bar.png) | 288x34 | 20.2 KB |
| [`queue-frame-new.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/queue/queue-frame-new.png) | 1935x1215 | 3.9 MB |
| [`queue-main-screen.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/queue/queue-main-screen.png) | 1935x1215 | 4.0 MB |
| [`reset-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/queue/reset-button.png) | 254x87 | 54.2 KB |
| [`skill-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/queue/skill-box.png) | 132x131 | 40.6 KB |
| [`tactics-config-add-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/queue/tactics-config-add-button.png) | 122x122 | 34.3 KB |
| [`tactics-config-checked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/queue/tactics-config-checked.png) | 49x49 | 6.5 KB |
| [`tactics-config-unchecked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/queue/tactics-config-unchecked.png) | 49x49 | 5.8 KB |
| [`team-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/queue/team-box.png) | 339x567 | 364.2 KB |
| [`ultimates-list-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/queue/ultimates-list-box.png) | 425x327 | 259.5 KB |
| [`undeployed-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/queue/undeployed-slot.png) | 339x566 | 388.1 KB |

#### [`menu/radar-icon/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/radar-icon/) — 6 file

| File | W×H | Size |
|---|---|---|
| [`agility-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/radar-icon/agility-icon.png) | 45x43 | 3.9 KB |
| [`aptitude-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/radar-icon/aptitude-icon.png) | 40x43 | 3.2 KB |
| [`health-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/radar-icon/health-icon.png) | 37x35 | 2.5 KB |
| [`radar-entry.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/radar-icon/radar-entry.png) | 266x41 | 19.6 KB |
| [`spirit-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/radar-icon/spirit-icon.png) | 34x47 | 3.0 KB |
| [`strength-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/radar-icon/strength-icon.png) | 34x40 | 3.0 KB |

#### [`menu/realm/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/) — 18 file

| File | W×H | Size |
|---|---|---|
| [`blood-progress.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/blood-progress.png) | 216x21 | 14.1 KB |
| [`body-progress.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/body-progress.png) | 218x20 | 14.0 KB |
| [`breakthrough-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/breakthrough-button.png) | 364x71 | 63.4 KB |
| [`breakthrough-condition-text-black-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/breakthrough-condition-text-black-bg.png) | 423x210 | 13.5 KB |
| [`close-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/close-button.png) | 51x49 | 4.8 KB |
| [`cultivation-item-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/cultivation-item-frame.png) | 322x141 | 102.8 KB |
| [`frame-bg-corner-ornament.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/frame-bg-corner-ornament.png) | 1966x1215 | 5.5 MB |
| [`guide-hover-title-divider.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/guide-hover-title-divider.png) | 454x22 | 16.1 KB |
| [`guide-hover-ui.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/guide-hover-ui.png) | 483x206 | 21.9 KB |
| [`movement-progress.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/movement-progress.png) | 217x20 | 14.0 KB |
| [`progress-empty.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/progress-empty.png) | 219x20 | 11.1 KB |
| [`progress-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/progress-frame.png) | 290x47 | 26.5 KB |
| [`qi-progress.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/qi-progress.png) | 217x21 | 14.7 KB |
| [`realm-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/realm-frame.png) | 1966x1215 | 5.3 MB |
| [`realm-locked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/realm-locked.png) | 164x77 | 30.2 KB |
| [`realm-unlocked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/realm-unlocked.png) | 164x77 | 30.4 KB |
| [`tendon-progress.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/tendon-progress.png) | 218x20 | 14.1 KB |
| [`view-talent-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/view-talent-button.png) | 151x53 | 18.6 KB |

#### [`menu/realm/silhouette/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/silhouette/) — 5 file

| File | W×H | Size |
|---|---|---|
| [`blood-silhouette.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/silhouette/blood-silhouette.png) | 617x593 | 389.0 KB |
| [`body-silhouette.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/silhouette/body-silhouette.png) | 700x746 | 532.5 KB |
| [`movement-silhouette.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/silhouette/movement-silhouette.png) | 698x757 | 591.9 KB |
| [`qi-silhouette.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/silhouette/qi-silhouette.png) | 708x713 | 494.9 KB |
| [`tendon-silhouette.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/silhouette/tendon-silhouette.png) | 700x746 | 322.3 KB |

#### [`menu/realm/submenu/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/submenu/) — 8 file

| File | W×H | Size |
|---|---|---|
| [`bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/submenu/bg.png) | 1811x1311 | 4.6 MB |
| [`cultivation-progress-black-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/submenu/cultivation-progress-black-bg.png) | 807x70 | 131.9 KB |
| [`guide-qmark.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/submenu/guide-qmark.png) | 35x35 | 1.3 KB |
| [`minus-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/submenu/minus-button.png) | 44x41 | 4.6 KB |
| [`pill-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/submenu/pill-box.png) | 258x324 | 193.8 KB |
| [`plus-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/submenu/plus-button.png) | 44x41 | 4.6 KB |
| [`start-cultivation-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/submenu/start-cultivation-button.png) | 504x97 | 114.7 KB |
| [`text-input.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/realm/submenu/text-input.png) | 202x50 | 25.0 KB |

#### [`menu/reputation/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/reputation/) — 8 file

| File | W×H | Size |
|---|---|---|
| [`rare-enemy-avatar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/reputation/rare-enemy-avatar.png) | 87x106 | 23.9 KB |
| [`rare-enemy-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/reputation/rare-enemy-slot.png) | 122x119 | 32.6 KB |
| [`rep-bar-empty.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/reputation/rep-bar-empty.png) | 1010x59 | 50.3 KB |
| [`rep-bar-full.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/reputation/rep-bar-full.png) | 1010x59 | 69.4 KB |
| [`rep-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/reputation/rep-bg.png) | 2048x1148 | 1.5 MB |
| [`rep-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/reputation/rep-icon.png) | 154x157 | 62.2 KB |
| [`rep-list-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/reputation/rep-list-box.png) | 609x192 | 64.8 KB |
| [`rep-list-image.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/reputation/rep-list-image.png) | 578x164 | 262.1 KB |

#### [`menu/reputation/output-slot/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/reputation/output-slot/) — 2 file

| File | W×H | Size |
|---|---|---|
| [`darkgold-item-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/reputation/output-slot/darkgold-item-slot.png) | 99x99 | 17.5 KB |
| [`purple-item-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/reputation/output-slot/purple-item-slot.png) | 100x99 | 17.4 KB |

#### [`menu/settings/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/settings/) — 13 file

| File | W×H | Size |
|---|---|---|
| [`checkbox-checked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/settings/checkbox-checked.png) | 44x43 | 5.0 KB |
| [`checkbox-unchecked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/settings/checkbox-unchecked.png) | 44x43 | 4.5 KB |
| [`display-mode-dropdown.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/settings/display-mode-dropdown.png) | 438x227 | 195.2 KB |
| [`drag-circle-roller.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/settings/drag-circle-roller.png) | 47x46 | 5.6 KB |
| [`main-menu-quit-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/settings/main-menu-quit-button.png) | 352x78 | 73.3 KB |
| [`resolution-display-option-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/settings/resolution-display-option-box.png) | 438x68 | 74.7 KB |
| [`resolution-dropdown-bottom.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/settings/resolution-dropdown-bottom.png) | 438x47 | 46.9 KB |
| [`resolution-dropdown-mid.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/settings/resolution-dropdown-mid.png) | 438x58 | 49.6 KB |
| [`resolution-dropdown-top.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/settings/resolution-dropdown-top.png) | 438x62 | 49.2 KB |
| [`restore-defaults-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/settings/restore-defaults-button.png) | 494x82 | 103.8 KB |
| [`settings-screen-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/settings/settings-screen-frame.png) | 2048x1191 | 5.7 MB |
| [`volume-bar-empty.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/settings/volume-bar-empty.png) | 415x22 | 25.8 KB |
| [`volume-bar-full.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/menu/settings/volume-bar-full.png) | 415x22 | 24.7 KB |

#### [`quest-tracker/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/quest-tracker/) — 10 file

| File | W×H | Size |
|---|---|---|
| [`accept-all-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/quest-tracker/accept-all-button.png) | 107x39 | 9.6 KB |
| [`complete-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/quest-tracker/complete-button.png) | 70x36 | 5.8 KB |
| [`quest-checked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/quest-tracker/quest-checked.png) | 50x49 | 5.0 KB |
| [`quest-collapse-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/quest-tracker/quest-collapse-button.png) | 23x30 | 1.7 KB |
| [`quest-collapse.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/quest-tracker/quest-collapse.png) | 78x191 | 31.8 KB |
| [`quest-complete-mark.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/quest-tracker/quest-complete-mark.png) | 93x90 | 19.7 KB |
| [`quest-divider.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/quest-tracker/quest-divider.png) | 339x3 | 4.1 KB |
| [`quest-expand-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/quest-tracker/quest-expand-button.png) | 23x30 | 1.7 KB |
| [`quest-expand.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/quest-tracker/quest-expand.png) | 396x177 | 119.3 KB |
| [`quest-unchecked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/quest-tracker/quest-unchecked.png) | 50x49 | 4.1 KB |

#### [`region-scene/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-scene/) — 22 file

| File | W×H | Size |
|---|---|---|
| [`back-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-scene/back-button.png) | 106x105 | 23.8 KB |
| [`copper-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-scene/copper-icon.png) | 49x50 | 6.4 KB |
| [`demon-gate-rift-label.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-scene/demon-gate-rift-label.png) | 303x65 | 40.3 KB |
| [`demon-gate-rift-marker.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-scene/demon-gate-rift-marker.png) | 157x212 | 31.1 KB |
| [`dungeon-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-scene/dungeon-icon.png) | 303x63 | 35.6 KB |
| [`dungeon-pin.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-scene/dungeon-pin.png) | 68x52 | 6.0 KB |
| [`gold-bg-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-scene/gold-bg-frame.png) | 260x63 | 13.9 KB |
| [`level-name-box-locked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-scene/level-name-box-locked.png) | 295x75 | 38.3 KB |
| [`level-name-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-scene/level-name-box.png) | 295x75 | 44.3 KB |
| [`location-pin-locked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-scene/location-pin-locked.png) | 60x83 | 7.7 KB |
| [`location-pin.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-scene/location-pin.png) | 69x95 | 11.2 KB |
| [`main-city-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-scene/main-city-icon.png) | 348x96 | 65.6 KB |
| [`material-dungeon-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-scene/material-dungeon-icon.png) | 312x65 | 40.0 KB |
| [`material-dungeon-pin.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-scene/material-dungeon-pin.png) | 116x112 | 30.6 KB |
| [`official-rank-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-scene/official-rank-icon.png) | 71x99 | 13.2 KB |
| [`region-title-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-scene/region-title-box.png) | 888x127 | 237.1 KB |
| [`rep-bar-current.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-scene/rep-bar-current.png) | 150x39 | 0.4 KB |
| [`rep-bar-upgrade.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-scene/rep-bar-upgrade.png) | 201x39 | 0.5 KB |
| [`rep-bg-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-scene/rep-bg-frame.png) | 381x63 | 19.5 KB |
| [`return-jingshui-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-scene/return-jingshui-button.png) | 89x97 | 17.3 KB |
| [`return-territory-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-scene/return-territory-button.png) | 273x103 | 65.2 KB |
| [`return-town-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-scene/return-town-button.png) | 104x105 | 18.8 KB |

#### [`region-select/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/) — 12 file

| File | W×H | Size |
|---|---|---|
| [`depart-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/depart-button.png) | 388x98 | 81.6 KB |
| [`left-arrow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/left-arrow.png) | 113x114 | 20.4 KB |
| [`level-select-black-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/level-select-black-bg.png) | 2048x392 | 179.0 KB |
| [`name-decor-left.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/name-decor-left.png) | 107x18 | 2.7 KB |
| [`name-decor-right.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/name-decor-right.png) | 107x18 | 2.7 KB |
| [`region-box-selected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/region-box-selected.png) | 527x342 | 158.2 KB |
| [`region-box-unselected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/region-box-unselected.png) | 513x318 | 154.4 KB |
| [`region-detail-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/region-detail-box.png) | 647x803 | 1.2 MB |
| [`region-drop-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/region-drop-slot.png) | 76x76 | 13.1 KB |
| [`region-selected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/region-selected.png) | 524x299 | 148.8 KB |
| [`region-unselected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/region-unselected.png) | 524x289 | 132.6 KB |
| [`right-arrow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/right-arrow.png) | 113x114 | 20.3 KB |

#### [`region-select/battle-bg/map-1/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-1/) — 12 file

| File | W×H | Size |
|---|---|---|
| [`map-1-dungeon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-1/map-1-dungeon.png) | 2048x1152 | 2.2 MB |
| [`map-1-level-1.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-1/map-1-level-1.png) | 2048x1152 | 2.9 MB |
| [`map-1-level-10.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-1/map-1-level-10.png) | 2048x1152 | 2.6 MB |
| [`map-1-level-2.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-1/map-1-level-2.png) | 2048x1152 | 3.0 MB |
| [`map-1-level-3.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-1/map-1-level-3.png) | 2048x1152 | 3.7 MB |
| [`map-1-level-4.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-1/map-1-level-4.png) | 2048x1152 | 2.9 MB |
| [`map-1-level-5.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-1/map-1-level-5.png) | 2048x1152 | 2.8 MB |
| [`map-1-level-6.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-1/map-1-level-6.png) | 2048x1152 | 3.4 MB |
| [`map-1-level-7.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-1/map-1-level-7.png) | 2048x1152 | 3.5 MB |
| [`map-1-level-8.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-1/map-1-level-8.png) | 2048x1152 | 3.0 MB |
| [`map-1-level-9.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-1/map-1-level-9.png) | 2048x1152 | 2.6 MB |
| [`map-1-material-dungeon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-1/map-1-material-dungeon.png) | 2048x1152 | 2.6 MB |

#### [`region-select/battle-bg/map-2/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-2/) — 10 file

| File | W×H | Size |
|---|---|---|
| [`map-2-level-1.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-2/map-2-level-1.png) | 2048x1152 | 2.9 MB |
| [`map-2-level-10.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-2/map-2-level-10.png) | 2048x1152 | 2.5 MB |
| [`map-2-level-2.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-2/map-2-level-2.png) | 2048x1152 | 2.8 MB |
| [`map-2-level-3.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-2/map-2-level-3.png) | 2048x1152 | 2.7 MB |
| [`map-2-level-4.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-2/map-2-level-4.png) | 2048x1152 | 2.6 MB |
| [`map-2-level-5.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-2/map-2-level-5.png) | 2048x1152 | 2.9 MB |
| [`map-2-level-6.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-2/map-2-level-6.png) | 2048x1152 | 3.3 MB |
| [`map-2-level-7.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-2/map-2-level-7.png) | 2048x1152 | 3.1 MB |
| [`map-2-level-8.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-2/map-2-level-8.png) | 2048x1152 | 3.3 MB |
| [`map-2-level-9.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-2/map-2-level-9.png) | 2048x1152 | 3.4 MB |

#### [`region-select/battle-bg/map-3/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-3/) — 10 file

| File | W×H | Size |
|---|---|---|
| [`map-3-level-1.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-3/map-3-level-1.png) | 2048x1152 | 3.0 MB |
| [`map-3-level-10.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-3/map-3-level-10.png) | 2048x1152 | 2.7 MB |
| [`map-3-level-2.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-3/map-3-level-2.png) | 2048x1152 | 4.0 MB |
| [`map-3-level-3.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-3/map-3-level-3.png) | 2048x1152 | 3.1 MB |
| [`map-3-level-4.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-3/map-3-level-4.png) | 2048x1152 | 2.9 MB |
| [`map-3-level-5.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-3/map-3-level-5.png) | 2048x1152 | 2.6 MB |
| [`map-3-level-6.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-3/map-3-level-6.png) | 2048x1152 | 2.9 MB |
| [`map-3-level-7.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-3/map-3-level-7.png) | 2048x1152 | 2.7 MB |
| [`map-3-level-8.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-3/map-3-level-8.png) | 2048x1152 | 3.4 MB |
| [`map-3-level-9.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-3/map-3-level-9.png) | 2048x1152 | 3.8 MB |

#### [`region-select/battle-bg/map-4/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-4/) — 10 file

| File | W×H | Size |
|---|---|---|
| [`map-4-level-1.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-4/map-4-level-1.png) | 2048x1152 | 3.2 MB |
| [`map-4-level-10.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-4/map-4-level-10.png) | 2048x1152 | 2.6 MB |
| [`map-4-level-2.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-4/map-4-level-2.png) | 2048x1152 | 2.9 MB |
| [`map-4-level-3.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-4/map-4-level-3.png) | 2048x1152 | 3.0 MB |
| [`map-4-level-4.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-4/map-4-level-4.png) | 2048x1152 | 3.0 MB |
| [`map-4-level-5.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-4/map-4-level-5.png) | 2048x1152 | 2.8 MB |
| [`map-4-level-6.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-4/map-4-level-6.png) | 2048x1152 | 2.5 MB |
| [`map-4-level-7.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-4/map-4-level-7.png) | 2048x1152 | 2.8 MB |
| [`map-4-level-8.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-4/map-4-level-8.png) | 2048x1152 | 3.0 MB |
| [`map-4-level-9.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-4/map-4-level-9.png) | 2048x1152 | 2.5 MB |

#### [`region-select/battle-bg/map-5/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-5/) — 10 file

| File | W×H | Size |
|---|---|---|
| [`map-5-level-1.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-5/map-5-level-1.png) | 2048x1152 | 2.9 MB |
| [`map-5-level-10.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-5/map-5-level-10.png) | 2048x1152 | 3.5 MB |
| [`map-5-level-2.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-5/map-5-level-2.png) | 2048x1152 | 3.3 MB |
| [`map-5-level-3.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-5/map-5-level-3.png) | 2048x1152 | 2.9 MB |
| [`map-5-level-4.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-5/map-5-level-4.png) | 2048x1152 | 2.9 MB |
| [`map-5-level-5.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-5/map-5-level-5.png) | 2048x1152 | 2.9 MB |
| [`map-5-level-6.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-5/map-5-level-6.png) | 2048x1152 | 3.2 MB |
| [`map-5-level-7.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-5/map-5-level-7.png) | 2048x1152 | 3.8 MB |
| [`map-5-level-8.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-5/map-5-level-8.png) | 2048x1152 | 2.7 MB |
| [`map-5-level-9.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-5/map-5-level-9.png) | 2048x1152 | 2.7 MB |

#### [`region-select/battle-bg/map-6/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-6/) — 10 file

| File | W×H | Size |
|---|---|---|
| [`map-6-level-1.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-6/map-6-level-1.png) | 2048x1152 | 2.7 MB |
| [`map-6-level-10.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-6/map-6-level-10.png) | 2048x1152 | 2.8 MB |
| [`map-6-level-2.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-6/map-6-level-2.png) | 2048x1152 | 3.0 MB |
| [`map-6-level-3.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-6/map-6-level-3.png) | 2048x1152 | 3.0 MB |
| [`map-6-level-4.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-6/map-6-level-4.png) | 2048x1152 | 2.9 MB |
| [`map-6-level-5.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-6/map-6-level-5.png) | 2048x1152 | 3.8 MB |
| [`map-6-level-6.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-6/map-6-level-6.png) | 2048x1152 | 2.9 MB |
| [`map-6-level-7.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-6/map-6-level-7.png) | 2048x1152 | 3.5 MB |
| [`map-6-level-8.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-6/map-6-level-8.png) | 2048x1152 | 2.9 MB |
| [`map-6-level-9.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/battle-bg/map-6/map-6-level-9.png) | 2048x1152 | 3.6 MB |

#### [`region-select/region-bg/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/region-bg/) — 6 file

| File | W×H | Size |
|---|---|---|
| [`blood-fir-forest-art.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/region-bg/blood-fir-forest-art.png) | 1672x941 | 2.6 MB |
| [`hong-lake.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/region-bg/hong-lake.png) | 2048x1152 | 4.4 MB |
| [`map-1.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/region-bg/map-1.png) | 2048x1152 | 3.8 MB |
| [`qushui-ridge.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/region-bg/qushui-ridge.png) | 2048x1152 | 3.2 MB |
| [`south-sea.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/region-bg/south-sea.png) | 2048x1152 | 3.7 MB |
| [`west-mountain.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/region-select/region-bg/west-mountain.png) | 2048x1152 | 4.1 MB |

#### [`slot/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/) — 9 file

| File | W×H | Size |
|---|---|---|
| [`blue-item-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/blue-item-slot.png) | 114x112 | 21.3 KB |
| [`exclusive-equipment-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/exclusive-equipment-slot.png) | 114x112 | 22.1 KB |
| [`fusion-relic-item-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/fusion-relic-item-slot.png) | 114x112 | 21.8 KB |
| [`gold-item-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/gold-item-slot.png) | 114x112 | 22.2 KB |
| [`green-item-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/green-item-slot.png) | 114x112 | 21.8 KB |
| [`purple-item-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/purple-item-slot.png) | 114x112 | 22.8 KB |
| [`skill-icon-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/skill-icon-frame.png) | 104x99 | 23.5 KB |
| [`weapon-item-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/weapon-item-slot.png) | 114x112 | 23.9 KB |
| [`white-item-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/white-item-slot.png) | 114x112 | 22.9 KB |

#### [`slot/menu-empty-gear-slot/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/menu-empty-gear-slot/) — 9 file

| File | W×H | Size |
|---|---|---|
| [`accessory-slot-1.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/menu-empty-gear-slot/accessory-slot-1.png) | 114x112 | 24.1 KB |
| [`accessory-slot-2.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/menu-empty-gear-slot/accessory-slot-2.png) | 114x112 | 24.4 KB |
| [`armor-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/menu-empty-gear-slot/armor-slot.png) | 114x112 | 25.4 KB |
| [`boots-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/menu-empty-gear-slot/boots-slot.png) | 114x112 | 24.8 KB |
| [`club-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/menu-empty-gear-slot/club-slot.png) | 114x112 | 23.7 KB |
| [`helm-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/menu-empty-gear-slot/helm-slot.png) | 114x112 | 24.1 KB |
| [`saber-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/menu-empty-gear-slot/saber-slot.png) | 114x112 | 23.8 KB |
| [`staff-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/menu-empty-gear-slot/staff-slot.png) | 114x112 | 23.9 KB |
| [`sword-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/menu-empty-gear-slot/sword-slot.png) | 114x112 | 24.2 KB |

#### [`slot/set-1-slot/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/set-1-slot/) — 5 file

| File | W×H | Size |
|---|---|---|
| [`set-1-blue-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/set-1-slot/set-1-blue-slot.png) | 101x98 | 20.4 KB |
| [`set-1-gold-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/set-1-slot/set-1-gold-slot.png) | 103x98 | 21.3 KB |
| [`set-1-green-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/set-1-slot/set-1-green-slot.png) | 102x98 | 20.7 KB |
| [`set-1-purple-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/set-1-slot/set-1-purple-slot.png) | 102x98 | 21.2 KB |
| [`set-1-white-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/set-1-slot/set-1-white-slot.png) | 102x98 | 21.3 KB |

#### [`slot/set-2-slot/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/set-2-slot/) — 5 file

| File | W×H | Size |
|---|---|---|
| [`set-2-blue-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/set-2-slot/set-2-blue-slot.png) | 226x226 | 104.1 KB |
| [`set-2-gold-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/set-2-slot/set-2-gold-slot.png) | 226x226 | 108.1 KB |
| [`set-2-green-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/set-2-slot/set-2-green-slot.png) | 226x226 | 100.4 KB |
| [`set-2-purple-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/set-2-slot/set-2-purple-slot.png) | 226x226 | 107.0 KB |
| [`set-2-white-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/slot/set-2-slot/set-2-white-slot.png) | 226x226 | 106.8 KB |

#### [`start-screen/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/) — 31 file

| File | W×H | Size |
|---|---|---|
| [`LOGO.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/LOGO.png) | 1000x516 | 475.4 KB |
| [`blink-vfx.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/blink-vfx.png) | 2048x1152 | 177.0 KB |
| [`close-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/close-button.png) | 111x108 | 25.9 KB |
| [`delete-save.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/delete-save.png) | 63x63 | 9.2 KB |
| [`dot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/dot.png) | 35x35 | 1.6 KB |
| [`game-logo-screen.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/game-logo-screen.png) | 2048x1152 | 413.9 KB |
| [`join-group-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/join-group-button.png) | 164x236 | 36.6 KB |
| [`mouse-cursor.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/mouse-cursor.png) | 45x45 | 4.2 KB |
| [`resolution-option-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/resolution-option-box.png) | 376x60 | 54.8 KB |
| [`restore-defaults-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/restore-defaults-button.png) | 422x70 | 72.0 KB |
| [`save-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/save-button.png) | 284x82 | 56.8 KB |
| [`save-close-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/save-close-button.png) | 420x105 | 89.4 KB |
| [`save-entry-new.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/save-entry-new.png) | 1256x200 | 248.7 KB |
| [`save-entry.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/save-entry.png) | 1256x200 | 435.5 KB |
| [`save-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/save-frame.png) | 1498x1018 | 1.1 MB |
| [`selected-button-click.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/selected-button-click.png) | 540x226 | 134.3 KB |
| [`selected-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/selected-button.png) | 540x226 | 145.6 KB |
| [`settings-checked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/settings-checked.png) | 60x60 | 5.9 KB |
| [`settings-divider.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/settings-divider.png) | 925x4 | 10.0 KB |
| [`settings-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/settings-frame.png) | 1539x1180 | 2.2 MB |
| [`settings-toggle-selected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/settings-toggle-selected.png) | 294x123 | 63.1 KB |
| [`settings-toggle.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/settings-toggle.png) | 299x125 | 46.1 KB |
| [`settings-unchecked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/settings-unchecked.png) | 60x60 | 5.5 KB |
| [`slider-bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/slider-bar.png) | 37x653 | 22.3 KB |
| [`slider.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/slider.png) | 24x226 | 6.5 KB |
| [`start-screen-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/start-screen-bg.png) | 2048x1152 | 4.7 MB |
| [`studio-logo.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/studio-logo.png) | 1448x403 | 69.2 KB |
| [`unselected-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/unselected-button.png) | 425x106 | 88.5 KB |
| [`volume-bar-full.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/volume-bar-full.png) | 415x27 | 10.7 KB |
| [`volume-bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/volume-bar.png) | 415x27 | 16.2 KB |
| [`volume-wheel.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/volume-wheel.png) | 44x47 | 4.6 KB |

#### [`start-screen/dropdown/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/dropdown/) — 5 file

| File | W×H | Size |
|---|---|---|
| [`divider.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/dropdown/divider.png) | 390x2 | 2.3 KB |
| [`dropdown-expanded.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/dropdown/dropdown-expanded.png) | 403x278 | 172.0 KB |
| [`dropdown-selected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/dropdown/dropdown-selected.png) | 393x54 | 35.6 KB |
| [`dropdown.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/dropdown/dropdown.png) | 404x63 | 51.4 KB |
| [`unselected-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/dropdown/unselected-box.png) | 386x54 | 26.4 KB |

#### [`start-screen/loading-screen/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/loading-screen/) — 4 file

| File | W×H | Size |
|---|---|---|
| [`dot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/loading-screen/dot.png) | 35x35 | 1.9 KB |
| [`hint-text.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/loading-screen/hint-text.png) | 1135x179 | 289.4 KB |
| [`loading-decor-bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/loading-screen/loading-decor-bar.png) | 680x73 | 69.4 KB |
| [`loading-text.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/start-screen/loading-screen/loading-text.png) | 197x71 | 21.5 KB |

#### [`territory/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/) — 17 file

| File | W×H | Size |
|---|---|---|
| [`bamboo-1.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/bamboo-1.png) | 80x347 | 32.9 KB |
| [`bamboo-2.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/bamboo-2.png) | 52x248 | 13.6 KB |
| [`bamboo-3.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/bamboo-3.png) | 56x297 | 17.7 KB |
| [`bamboo-4.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/bamboo-4.png) | 100x354 | 40.1 KB |
| [`copper-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/copper-icon.png) | 49x50 | 6.4 KB |
| [`green-tree.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/green-tree.png) | 109x117 | 25.5 KB |
| [`iron-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/iron-icon.png) | 68x48 | 8.0 KB |
| [`jingshui-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/jingshui-button.png) | 503x180 | 121.4 KB |
| [`pink-tree.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/pink-tree.png) | 126x123 | 31.4 KB |
| [`region-title-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/region-title-box.png) | 887x126 | 226.3 KB |
| [`resource-bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/resource-bar.png) | 1125x143 | 154.1 KB |
| [`stone-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/stone-icon.png) | 61x50 | 7.7 KB |
| [`territory-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/territory-bg.png) | 2048x1148 | 3.0 MB |
| [`text-tray.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/text-tray.png) | 343x131 | 68.0 KB |
| [`treasure-pavilion.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/treasure-pavilion.png) | 1019x655 | 1.1 MB |
| [`venture-out-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/venture-out-button.png) | 646x222 | 194.8 KB |
| [`wood-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/wood-icon.png) | 68x50 | 8.1 KB |

#### [`territory/building/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/building/) — 18 file

| File | W×H | Size |
|---|---|---|
| [`alchemy-room-click.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/building/alchemy-room-click.png) | 614x770 | 591.7 KB |
| [`alchemy-room-hover.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/building/alchemy-room-hover.png) | 614x770 | 624.6 KB |
| [`alchemy-room.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/building/alchemy-room.png) | 614x770 | 638.7 KB |
| [`blacksmith-click.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/building/blacksmith-click.png) | 1112x790 | 1.1 MB |
| [`blacksmith-hover.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/building/blacksmith-hover.png) | 1112x790 | 1.1 MB |
| [`blacksmith.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/building/blacksmith.png) | 1112x790 | 1.2 MB |
| [`cultivation-room-click.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/building/cultivation-room-click.png) | 462x360 | 202.5 KB |
| [`cultivation-room-hover.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/building/cultivation-room-hover.png) | 462x360 | 211.7 KB |
| [`cultivation-room.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/building/cultivation-room.png) | 462x360 | 210.0 KB |
| [`lord-manor-click.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/building/lord-manor-click.png) | 1077x617 | 878.1 KB |
| [`lord-manor-hover.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/building/lord-manor-hover.png) | 1077x617 | 915.1 KB |
| [`lord-manor.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/building/lord-manor.png) | 1077x617 | 932.9 KB |
| [`treasure-altar-click.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/building/treasure-altar-click.png) | 426x371 | 210.6 KB |
| [`treasure-altar-hover.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/building/treasure-altar-hover.png) | 426x371 | 217.7 KB |
| [`treasure-altar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/building/treasure-altar.png) | 426x371 | 211.8 KB |
| [`treasure-pavilion-click.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/building/treasure-pavilion-click.png) | 1101x739 | 1.0 MB |
| [`treasure-pavilion-hover.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/building/treasure-pavilion-hover.png) | 1101x739 | 1.1 MB |
| [`treasure-pavilion.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/territory/building/treasure-pavilion.png) | 1101x739 | 1.1 MB |

#### [`treasure-altar/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-altar/) — 21 file

| File | W×H | Size |
|---|---|---|
| [`checkbox-checked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-altar/checkbox-checked.png) | 41x36 | 3.8 KB |
| [`checkbox-unchecked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-altar/checkbox-unchecked.png) | 37x36 | 3.1 KB |
| [`close-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-altar/close-button.png) | 97x95 | 18.9 KB |
| [`cost-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-altar/cost-slot.png) | 148x143 | 40.5 KB |
| [`enshrined-label.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-altar/enshrined-label.png) | 160x58 | 14.2 KB |
| [`leave-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-altar/leave-button.png) | 288x89 | 62.4 KB |
| [`locked-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-altar/locked-slot.png) | 277x354 | 184.6 KB |
| [`open-vault-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-altar/open-vault-button.png) | 591x121 | 184.2 KB |
| [`plaque.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-altar/plaque.png) | 953x109 | 262.5 KB |
| [`plus.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-altar/plus.png) | 70x70 | 5.3 KB |
| [`roller.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-altar/roller.png) | 19x551 | 12.3 KB |
| [`scrollbar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-altar/scrollbar.png) | 33x707 | 45.2 KB |
| [`treasure-display-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-altar/treasure-display-frame.png) | 1627x997 | 3.7 MB |
| [`treasure-effect-shadow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-altar/treasure-effect-shadow.png) | 243x64 | 0.7 KB |
| [`treasure-filled-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-altar/treasure-filled-slot.png) | 277x354 | 205.1 KB |
| [`treasure-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-altar/treasure-frame.png) | 721x184 | 354.4 KB |
| [`treasure-pavilion-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-altar/treasure-pavilion-bg.png) | 2048x1152 | 2.7 MB |
| [`treasure-select-screen.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-altar/treasure-select-screen.png) | 1637x1081 | 4.6 MB |
| [`treasure-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-altar/treasure-slot.png) | 277x354 | 206.5 KB |
| [`vault-screen.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-altar/vault-screen.png) | 1623x1115 | 4.0 MB |
| [`vault-treasure-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-altar/vault-treasure-slot.png) | 378x137 | 121.6 KB |

#### [`treasure-pavilion/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-pavilion/) — 14 file

| File | W×H | Size |
|---|---|---|
| [`bg-image.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-pavilion/bg-image.png) | 2048x1148 | 3.2 MB |
| [`button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-pavilion/button.png) | 246x67 | 38.9 KB |
| [`buy-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-pavilion/buy-button.png) | 298x82 | 51.4 KB |
| [`gold-bg-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-pavilion/gold-bg-frame.png) | 260x63 | 13.9 KB |
| [`gold-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-pavilion/gold-icon.png) | 88x85 | 19.7 KB |
| [`refresh-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-pavilion/refresh-button.png) | 651x195 | 295.1 KB |
| [`refresh-region.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-pavilion/refresh-region.png) | 498x154 | 180.5 KB |
| [`roller.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-pavilion/roller.png) | 18x513 | 12.4 KB |
| [`scrollbar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-pavilion/scrollbar.png) | 66x826 | 23.8 KB |
| [`soldout-cover.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-pavilion/soldout-cover.png) | 333x400 | 4.4 KB |
| [`treasure-pavilion-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-pavilion/treasure-pavilion-frame.png) | 2048x1539 | 4.4 MB |
| [`treasure-pavilion-name-black-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-pavilion/treasure-pavilion-name-black-bg.png) | 236x38 | 2.6 KB |
| [`treasure-product-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-pavilion/treasure-product-slot.png) | 399x441 | 309.2 KB |
| [`treasure-token-currency-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/treasure-pavilion/treasure-token-currency-icon.png) | 104x127 | 16.2 KB |

#### [`trial-tower/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/) — 40 file

| File | W×H | Size |
|---|---|---|
| [`bond-area-black-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/bond-area-black-bg.png) | 672x1440 | 326.0 KB |
| [`bond-hover-dot-gray.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/bond-hover-dot-gray.png) | 42x42 | 3.1 KB |
| [`bond-hover-dot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/bond-hover-dot.png) | 48x48 | 3.8 KB |
| [`bond-row-bright-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/bond-row-bright-box.png) | 493x77 | 55.6 KB |
| [`bond-row-dark-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/bond-row-dark-box.png) | 493x77 | 49.7 KB |
| [`buff-icon-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/buff-icon-frame.png) | 154x142 | 9.4 KB |
| [`character-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/character-frame.png) | 428x683 | 635.8 KB |
| [`clear-mark.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/clear-mark.png) | 143x79 | 22.6 KB |
| [`creation-card.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/creation-card.png) | 534x757 | 670.6 KB |
| [`creation-choice-title.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/creation-choice-title.png) | 1362x128 | 255.8 KB |
| [`creation-icon-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/creation-icon-box.png) | 190x197 | 19.4 KB |
| [`current-tab-gray.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/current-tab-gray.png) | 216x148 | 48.6 KB |
| [`current-tab.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/current-tab.png) | 216x148 | 52.0 KB |
| [`draw-fortune-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/draw-fortune-button.png) | 467x103 | 106.9 KB |
| [`dream-fortune-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/dream-fortune-box.png) | 581x679 | 701.5 KB |
| [`enemy-avatar-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/enemy-avatar-frame.png) | 125x131 | 8.8 KB |
| [`enemy-count-circle.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/enemy-count-circle.png) | 46x46 | 4.4 KB |
| [`enemy-lineup-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/enemy-lineup-box.png) | 627x324 | 316.2 KB |
| [`enhance-select-bar-texture.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/enhance-select-bar-texture.png) | 2048x203 | 780.3 KB |
| [`exit-button-1.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/exit-button-1.png) | 82x71 | 14.5 KB |
| [`exit-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/exit-button.png) | 345x98 | 74.6 KB |
| [`fortune-cost-info-black-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/fortune-cost-info-black-bg.png) | 439x55 | 12.3 KB |
| [`inner-demon-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/inner-demon-icon.png) | 54x72 | 9.0 KB |
| [`inner-demon-lock-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/inner-demon-lock-icon.png) | 54x72 | 9.1 KB |
| [`level-detail-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/level-detail-box.png) | 627x988 | 788.9 KB |
| [`level-tab-unselected-gray.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/level-tab-unselected-gray.png) | 189x130 | 45.4 KB |
| [`level-tab-unselected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/level-tab-unselected.png) | 189x130 | 47.3 KB |
| [`luck-value-black-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/luck-value-black-bg.png) | 251x67 | 6.7 KB |
| [`pill-screen-close-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/pill-screen-close-button.png) | 136x110 | 28.8 KB |
| [`pill-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/pill-slot.png) | 103x95 | 5.7 KB |
| [`redraw-creation-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/redraw-creation-button.png) | 548x114 | 133.6 KB |
| [`refresh-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/refresh-button.png) | 147x132 | 34.2 KB |
| [`start-challenge-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/start-challenge-button.png) | 478x110 | 102.7 KB |
| [`subscreen-close-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/subscreen-close-icon.png) | 149x147 | 29.5 KB |
| [`swap-pill-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/swap-pill-box.png) | 1229x1089 | 2.3 MB |
| [`team-config-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/team-config-button.png) | 69x77 | 12.7 KB |
| [`team-config-gear.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/team-config-gear.png) | 107x102 | 21.3 KB |
| [`title-box-tl.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/title-box-tl.png) | 562x175 | 185.7 KB |
| [`trial-tower-attr-hover.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/trial-tower-attr-hover.png) | 605x920 | 820.8 KB |
| [`trial-tower-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/trial-tower-bg.png) | 2048x1152 | 3.5 MB |

#### [`trial-tower/auto-challenge/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/auto-challenge/) — 9 file

| File | W×H | Size |
|---|---|---|
| [`auto-challenge-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/auto-challenge/auto-challenge-frame.png) | 869x1206 | 2.0 MB |
| [`cancel-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/auto-challenge/cancel-button.png) | 300x68 | 47.0 KB |
| [`close-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/auto-challenge/close-button.png) | 50x46 | 6.1 KB |
| [`idle-settings-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/auto-challenge/idle-settings-button.png) | 91x92 | 19.5 KB |
| [`power-switch.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/auto-challenge/power-switch.png) | 180x46 | 15.8 KB |
| [`save-settings-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/auto-challenge/save-settings-button.png) | 321x68 | 51.4 KB |
| [`selected-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/auto-challenge/selected-button.png) | 37x38 | 4.1 KB |
| [`toggle-on.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/auto-challenge/toggle-on.png) | 87x40 | 7.3 KB |
| [`unselected-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/auto-challenge/unselected-button.png) | 37x38 | 3.4 KB |

#### [`trial-tower/bonds/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/bonds/) — 19 file

| File | W×H | Size |
|---|---|---|
| [`1-longevity.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/bonds/1-longevity.png) | 83x95 | 20.7 KB |
| [`10-divine-manifest.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/bonds/10-divine-manifest.png) | 84x94 | 19.9 KB |
| [`11-extinguish-momentum.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/bonds/11-extinguish-momentum.png) | 84x94 | 20.9 KB |
| [`12-mystic-armor-guard.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/bonds/12-mystic-armor-guard.png) | 84x93 | 20.2 KB |
| [`13-armor-crack-edge.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/bonds/13-armor-crack-edge.png) | 82x95 | 20.7 KB |
| [`14-void-tread.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/bonds/14-void-tread.png) | 84x93 | 19.3 KB |
| [`15-bone-corrode-heartburn.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/bonds/15-bone-corrode-heartburn.png) | 81x94 | 19.8 KB |
| [`16-thousand-spider-gu.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/bonds/16-thousand-spider-gu.png) | 85x95 | 21.3 KB |
| [`17-heart-pact.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/bonds/17-heart-pact.png) | 84x93 | 20.5 KB |
| [`2-qi-sea-tide.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/bonds/2-qi-sea-tide.png) | 84x97 | 21.7 KB |
| [`3-sky-edge.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/bonds/3-sky-edge.png) | 82x95 | 19.4 KB |
| [`4-army-breaker.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/bonds/4-army-breaker.png) | 82x96 | 19.3 KB |
| [`5-unmoving-peak.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/bonds/5-unmoving-peak.png) | 83x93 | 20.0 KB |
| [`6-blooddrink-art.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/bonds/6-blooddrink-art.png) | 84x98 | 20.5 KB |
| [`7-gale-step.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/bonds/7-gale-step.png) | 85x94 | 20.6 KB |
| [`8-mystic-chain.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/bonds/8-mystic-chain.png) | 85x94 | 21.1 KB |
| [`9-rejuvenation-art.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/bonds/9-rejuvenation-art.png) | 83x92 | 19.9 KB |
| [`fortune-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/bonds/fortune-frame.png) | 424x95 | 25.2 KB |
| [`luck-value-black-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/bonds/luck-value-black-bg.png) | 199x53 | 5.2 KB |

#### [`trial-tower/endless-trial/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/endless-trial/) — 11 file

| File | W×H | Size |
|---|---|---|
| [`TAB.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/endless-trial/TAB.png) | 66x39 | 5.2 KB |
| [`attack-up.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/endless-trial/attack-up.png) | 482x483 | 199.6 KB |
| [`defense-up.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/endless-trial/defense-up.png) | 482x484 | 207.0 KB |
| [`hp-up.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/endless-trial/hp-up.png) | 482x483 | 202.1 KB |
| [`next-round-inner-demon-effect.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/endless-trial/next-round-inner-demon-effect.png) | 464x98 | 58.2 KB |
| [`prebattle-choice-card.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/endless-trial/prebattle-choice-card.png) | 457x779 | 462.9 KB |
| [`prebattle-choice.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/endless-trial/prebattle-choice.png) | 1028x150 | 100.4 KB |
| [`purify-inner-demon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/endless-trial/purify-inner-demon.png) | 255x251 | 142.2 KB |
| [`revive-ally.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/endless-trial/revive-ally.png) | 253x251 | 133.3 KB |
| [`team-buff.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/endless-trial/team-buff.png) | 248x251 | 127.8 KB |
| [`team-heal.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/endless-trial/team-heal.png) | 247x251 | 129.3 KB |

#### [`trial-tower/fortune-frame/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/fortune-frame/) — 9 file

| File | W×H | Size |
|---|---|---|
| [`blue-card.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/fortune-frame/blue-card.png) | 439x709 | 645.6 KB |
| [`fortune-choice.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/fortune-frame/fortune-choice.png) | 872x100 | 119.1 KB |
| [`gold-card.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/fortune-frame/gold-card.png) | 438x708 | 669.0 KB |
| [`green-card.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/fortune-frame/green-card.png) | 439x708 | 644.5 KB |
| [`icon-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/fortune-frame/icon-frame.png) | 199x201 | 15.2 KB |
| [`purple-card.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/fortune-frame/purple-card.png) | 439x708 | 674.3 KB |
| [`select-obtain-black-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/fortune-frame/select-obtain-black-bg.png) | 464x59 | 16.7 KB |
| [`weapon-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/fortune-frame/weapon-frame.png) | 200x205 | 25.0 KB |
| [`weapon-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/fortune-frame/weapon-icon.png) | 259x73 | 44.1 KB |

#### [`trial-tower/frame-character-bg-image/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/frame-character-bg-image/) — 10 file

| File | W×H | Size |
|---|---|---|
| [`fenli-trial-tower-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/frame-character-bg-image/fenli-trial-tower-bg.png) | 381x444 | 342.8 KB |
| [`gaosheng-trial-tower-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/frame-character-bg-image/gaosheng-trial-tower-bg.png) | 381x444 | 336.6 KB |
| [`jinglian-trial-tower-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/frame-character-bg-image/jinglian-trial-tower-bg.png) | 381x444 | 334.0 KB |
| [`qingshuangzi-trial-tower-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/frame-character-bg-image/qingshuangzi-trial-tower-bg.png) | 381x444 | 337.5 KB |
| [`weiqi-trial-tower-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/frame-character-bg-image/weiqi-trial-tower-bg.png) | 381x444 | 287.4 KB |
| [`xuandao-trial-tower-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/frame-character-bg-image/xuandao-trial-tower-bg.png) | 381x444 | 338.1 KB |
| [`youzhu-trial-tower-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/frame-character-bg-image/youzhu-trial-tower-bg.png) | 381x444 | 313.1 KB |
| [`yuejianxin-trial-tower-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/frame-character-bg-image/yuejianxin-trial-tower-bg.png) | 381x444 | 338.0 KB |
| [`ziyuan-trial-tower-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/frame-character-bg-image/ziyuan-trial-tower-bg.png) | 381x444 | 334.5 KB |
| [`zuofeng-trial-tower-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/frame-character-bg-image/zuofeng-trial-tower-bg.png) | 381x444 | 343.7 KB |

#### [`trial-tower/icon/creation-icon/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/creation-icon/) — 25 file

| File | W×H | Size |
|---|---|---|
| [`01-steady-mastery.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/creation-icon/01-steady-mastery.png) | 210x208 | 82.0 KB |
| [`02-pocket-universe.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/creation-icon/02-pocket-universe.png) | 203x208 | 75.1 KB |
| [`03-wise-eye-fate.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/creation-icon/03-wise-eye-fate.png) | 200x208 | 73.8 KB |
| [`04-early-harvest.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/creation-icon/04-early-harvest.png) | 201x208 | 74.2 KB |
| [`05-war-feeds-war.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/creation-icon/05-war-feeds-war.png) | 201x208 | 79.5 KB |
| [`06-late-bloomer.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/creation-icon/06-late-bloomer.png) | 206x208 | 71.8 KB |
| [`07-peak-then-decline.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/creation-icon/07-peak-then-decline.png) | 200x208 | 79.2 KB |
| [`08-fate-and-doom.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/creation-icon/08-fate-and-doom.png) | 199x208 | 77.8 KB |
| [`09-heartfire-melts-arms.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/creation-icon/09-heartfire-melts-arms.png) | 205x208 | 76.0 KB |
| [`10-wealth-moves-gods.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/creation-icon/10-wealth-moves-gods.png) | 206x208 | 74.6 KB |
| [`11-all-streams-one.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/creation-icon/11-all-streams-one.png) | 212x208 | 79.4 KB |
| [`12-baleful-qi-fortune.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/creation-icon/12-baleful-qi-fortune.png) | 212x208 | 79.1 KB |
| [`13-break-to-rebuild.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/creation-icon/13-break-to-rebuild.png) | 202x208 | 77.3 KB |
| [`14-heaven-sent-weapon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/creation-icon/14-heaven-sent-weapon.png) | 202x208 | 74.8 KB |
| [`15-risk-life-for-luck.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/creation-icon/15-risk-life-for-luck.png) | 204x208 | 73.7 KB |
| [`16-luck-burning.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/creation-icon/16-luck-burning.png) | 204x208 | 78.3 KB |
| [`17-heaven-sent-fortune.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/creation-icon/17-heaven-sent-fortune.png) | 199x208 | 77.9 KB |
| [`18-luck-to-trickle.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/creation-icon/18-luck-to-trickle.png) | 199x208 | 73.1 KB |
| [`19-quick-hands-grab-all.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/creation-icon/19-quick-hands-grab-all.png) | 205x208 | 82.7 KB |
| [`20-twin-bond.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/creation-icon/20-twin-bond.png) | 199x208 | 76.9 KB |
| [`21-four-symbols-scroll.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/creation-icon/21-four-symbols-scroll.png) | 206x208 | 81.6 KB |
| [`22-charge-and-release.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/creation-icon/22-charge-and-release.png) | 212x208 | 76.8 KB |
| [`23-luck-returns.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/creation-icon/23-luck-returns.png) | 213x208 | 78.0 KB |
| [`24-hold-fast-the-good.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/creation-icon/24-hold-fast-the-good.png) | 203x208 | 73.6 KB |
| [`25-reverse-hand-flip.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/creation-icon/25-reverse-hand-flip.png) | 201x208 | 78.5 KB |

#### [`trial-tower/icon/fortune-icon/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/) — 79 file

| File | W×H | Size |
|---|---|---|
| [`01-longevity.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/01-longevity.png) | 180x184 | 60.7 KB |
| [`02-tide-breath.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/02-tide-breath.png) | 179x184 | 60.5 KB |
| [`03-first-edge.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/03-first-edge.png) | 178x184 | 65.0 KB |
| [`04-array-breaker-will.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/04-array-breaker-will.png) | 178x184 | 66.8 KB |
| [`05-rock-core.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/05-rock-core.png) | 179x184 | 58.3 KB |
| [`06-blood-will.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/06-blood-will.png) | 181x184 | 55.5 KB |
| [`07-wind-shadow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/07-wind-shadow.png) | 179x184 | 60.7 KB |
| [`08-spirit-chance.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/08-spirit-chance.png) | 180x184 | 59.3 KB |
| [`09-lifebreath.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/09-lifebreath.png) | 182x184 | 59.1 KB |
| [`10-spirit-response.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/10-spirit-response.png) | 182x184 | 60.3 KB |
| [`11-sever-momentum.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/11-sever-momentum.png) | 179x184 | 61.4 KB |
| [`12-iron-garb.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/12-iron-garb.png) | 177x184 | 68.3 KB |
| [`13-shatter-armor.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/13-shatter-armor.png) | 179x184 | 57.9 KB |
| [`14-floating-trace.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/14-floating-trace.png) | 178x184 | 59.7 KB |
| [`15-heartfire.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/15-heartfire.png) | 179x184 | 49.1 KB |
| [`16-spider-silk-gu.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/16-spider-silk-gu.png) | 178x184 | 64.7 KB |
| [`17-heart-seal.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/17-heart-seal.png) | 183x184 | 59.6 KB |
| [`18-longevity-mountain.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/18-longevity-mountain.png) | 184x184 | 60.2 KB |
| [`19-green-sprout-renewal.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/19-green-sprout-renewal.png) | 181x184 | 58.0 KB |
| [`20-hidden-life-armor.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/20-hidden-life-armor.png) | 182x184 | 63.6 KB |
| [`21-tide-wind.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/21-tide-wind.png) | 180x184 | 62.5 KB |
| [`22-vast-sea-response.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/22-vast-sea-response.png) | 179x184 | 61.1 KB |
| [`23-wave-shadow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/23-wave-shadow.png) | 178x184 | 60.0 KB |
| [`24-star-blade-array-break.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/24-star-blade-array-break.png) | 178x184 | 66.0 KB |
| [`25-edge-chill.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/25-edge-chill.png) | 179x184 | 53.2 KB |
| [`26-split-edge.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/26-split-edge.png) | 180x184 | 54.8 KB |
| [`27-marrow-corrode-edge.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/27-marrow-corrode-edge.png) | 179x184 | 58.2 KB |
| [`28-array-sever.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/28-array-sever.png) | 179x184 | 56.3 KB |
| [`29-armor-crush.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/29-armor-crush.png) | 181x184 | 55.3 KB |
| [`30-mountain-armor.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/30-mountain-armor.png) | 181x184 | 59.3 KB |
| [`31-mountain-green.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/31-mountain-green.png) | 182x184 | 62.5 KB |
| [`32-rock-spider.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/32-rock-spider.png) | 182x184 | 62.1 KB |
| [`33-blood-net.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/33-blood-net.png) | 181x184 | 52.4 KB |
| [`34-blood-shadow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/34-blood-shadow.png) | 181x184 | 53.2 KB |
| [`35-bloodflame-heart-corrode.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/35-bloodflame-heart-corrode.png) | 181x184 | 57.0 KB |
| [`36-wind-turn.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/36-wind-turn.png) | 181x184 | 58.2 KB |
| [`37-swiftwind-response.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/37-swiftwind-response.png) | 181x184 | 58.2 KB |
| [`38-mystic-flame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/38-mystic-flame.png) | 181x184 | 56.8 KB |
| [`39-wonderedge-pierce.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/39-wonderedge-pierce.png) | 179x184 | 58.8 KB |
| [`40-green-armor.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/40-green-armor.png) | 179x184 | 61.6 KB |
| [`41-sever-shadow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/41-sever-shadow.png) | 175x184 | 58.3 KB |
| [`42-cloud-stepper.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/42-cloud-stepper.png) | 174x184 | 60.3 KB |
| [`43-green-silk-gu.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/43-green-silk-gu.png) | 175x184 | 60.8 KB |
| [`44-bone-crack-flame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/44-bone-crack-flame.png) | 175x184 | 55.2 KB |
| [`45-fate-thread-bind.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/45-fate-thread-bind.png) | 179x184 | 60.7 KB |
| [`46-longevity-peak-mystic-armor.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/46-longevity-peak-mystic-armor.png) | 180x184 | 59.5 KB |
| [`47-green-cloud-life-extend.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/47-green-cloud-life-extend.png) | 181x184 | 62.3 KB |
| [`48-twin-tide-manifest.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/48-twin-tide-manifest.png) | 181x184 | 64.2 KB |
| [`49-wind-tide-one-heart.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/49-wind-tide-one-heart.png) | 180x184 | 64.9 KB |
| [`50-twin-edge-split-armor.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/50-twin-edge-split-armor.png) | 181x184 | 60.5 KB |
| [`51-sky-blade-army-break.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/51-sky-blade-army-break.png) | 179x184 | 61.7 KB |
| [`52-army-breaker-shatter.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/52-army-breaker-shatter.png) | 179x184 | 58.9 KB |
| [`53-blood-spider-net.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/53-blood-spider-net.png) | 180x184 | 53.1 KB |
| [`54-twin-wind-turn.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/54-twin-wind-turn.png) | 181x184 | 62.5 KB |
| [`55-wondrous-divine.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/55-wondrous-divine.png) | 180x184 | 55.4 KB |
| [`56-spirit-response-sever.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/56-spirit-response-sever.png) | 181x184 | 59.6 KB |
| [`57-armor-wipe-mark.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/57-armor-wipe-mark.png) | 182x184 | 52.2 KB |
| [`58-void-edge-corrode.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/58-void-edge-corrode.png) | 181x184 | 52.5 KB |
| [`59-one-heart-burn-shadow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/59-one-heart-burn-shadow.png) | 181x184 | 57.4 KB |
| [`60-holy-gu-heart-corrode.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/60-holy-gu-heart-corrode.png) | 180x184 | 58.4 KB |
| [`61-divine-tribulation-sever.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/61-divine-tribulation-sever.png) | 183x184 | 54.4 KB |
| [`62-mystic-armor-blooddrink.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/62-mystic-armor-blooddrink.png) | 182x184 | 51.8 KB |
| [`63-twin-edge-army-breaker.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/63-twin-edge-army-breaker.png) | 184x184 | 53.4 KB |
| [`64-tide-rise-law-end.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/64-tide-rise-law-end.png) | 183x184 | 62.2 KB |
| [`65-longevity-spider-shadow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/65-longevity-spider-shadow.png) | 181x184 | 55.0 KB |
| [`66-spider-fire-split-armor.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/66-spider-fire-split-armor.png) | 181x184 | 50.1 KB |
| [`67-wind-blade-bone-trap.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/67-wind-blade-bone-trap.png) | 185x184 | 55.3 KB |
| [`68-shadow-spider-heartburn.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/68-shadow-spider-heartburn.png) | 184x184 | 53.4 KB |
| [`69-peak-cleaver.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/69-peak-cleaver.png) | 182x184 | 67.5 KB |
| [`70-city-breaker-spear.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/70-city-breaker-spear.png) | 181x184 | 66.7 KB |
| [`71-sun-chaser-bow.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/71-sun-chaser-bow.png) | 181x184 | 68.3 KB |
| [`72-star-burner-wheel.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/72-star-burner-wheel.png) | 182x184 | 63.6 KB |
| [`73-thundershock-mace.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/73-thundershock-mace.png) | 181x184 | 59.6 KB |
| [`74-mystic-peak-armor.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/74-mystic-peak-armor.png) | 179x184 | 67.3 KB |
| [`75-wave-return-pendant.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/75-wave-return-pendant.png) | 180x184 | 62.8 KB |
| [`76-abyss-ward-shield.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/76-abyss-ward-shield.png) | 180x184 | 64.8 KB |
| [`77-origin-seal.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/77-origin-seal.png) | 181x184 | 68.7 KB |
| [`78-cloud-walk-boots.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/78-cloud-walk-boots.png) | 181x184 | 67.3 KB |
| [`79-heaven-secret-disc.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/icon/fortune-icon/79-heaven-secret-disc.png) | 182x184 | 67.6 KB |

#### [`trial-tower/result-screen/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/result-screen/) — 6 file

| File | W×H | Size |
|---|---|---|
| [`back-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/result-screen/back-button.png) | 410x74 | 67.0 KB |
| [`bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/result-screen/bg.png) | 1829x1028 | 2.6 MB |
| [`claim-reward-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/result-screen/claim-reward-button.png) | 410x74 | 66.8 KB |
| [`clear-banner-decor.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/result-screen/clear-banner-decor.png) | 930x33 | 19.1 KB |
| [`decor-dot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/result-screen/decor-dot.png) | 7x7 | 0.2 KB |
| [`fortune-slot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/result-screen/fortune-slot.png) | 84x83 | 12.7 KB |

#### [`trial-tower/trial-tower-entry/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/trial-tower-entry/) — 15 file

| File | W×H | Size |
|---|---|---|
| [`battle-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/trial-tower-entry/battle-button.png) | 392x86 | 82.5 KB |
| [`battle-config-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/trial-tower-entry/battle-config-button.png) | 90x84 | 15.1 KB |
| [`close-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/trial-tower-entry/close-button.png) | 108x106 | 23.2 KB |
| [`corner-ornament-br.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/trial-tower-entry/corner-ornament-br.png) | 122x98 | 17.0 KB |
| [`decor-dot.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/trial-tower-entry/decor-dot.png) | 13x13 | 0.3 KB |
| [`difficulty-box-selected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/trial-tower-entry/difficulty-box-selected.png) | 161x60 | 23.2 KB |
| [`difficulty-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/trial-tower-entry/difficulty-box.png) | 161x60 | 19.7 KB |
| [`entry-screen.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/trial-tower-entry/entry-screen.png) | 1785x1167 | 2.3 MB |
| [`exchange-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/trial-tower-entry/exchange-button.png) | 403x94 | 83.8 KB |
| [`illustration.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/trial-tower-entry/illustration.png) | 1325x656 | 1.5 MB |
| [`layer-5.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/trial-tower-entry/layer-5.png) | 90x88 | 17.3 KB |
| [`trial-button-locked.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/trial-tower-entry/trial-button-locked.png) | 367x139 | 105.3 KB |
| [`trial-button-selected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/trial-tower-entry/trial-button-selected.png) | 367x137 | 118.1 KB |
| [`trial-button-unselected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/trial-tower-entry/trial-button-unselected.png) | 367x137 | 108.0 KB |
| [`trial-stone.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/trial-tower-entry/trial-stone.png) | 183x180 | 45.5 KB |

#### [`trial-tower/trial-tower-entry/exchange-shop/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/trial-tower-entry/exchange-shop/) — 7 file

| File | W×H | Size |
|---|---|---|
| [`exchange-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/trial-tower-entry/exchange-shop/exchange-button.png) | 170x74 | 25.9 KB |
| [`shop-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/trial-tower-entry/exchange-shop/shop-frame.png) | 1645x1262 | 2.6 MB |
| [`slider-bar.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/trial-tower-entry/exchange-shop/slider-bar.png) | 28x819 | 6.8 KB |
| [`slider.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/trial-tower-entry/exchange-shop/slider.png) | 12x423 | 2.3 KB |
| [`switch-selected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/trial-tower-entry/exchange-shop/switch-selected.png) | 241x90 | 47.4 KB |
| [`switch.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/trial-tower-entry/exchange-shop/switch.png) | 239x81 | 37.1 KB |
| [`trial-tower-product-entry.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/trial-tower/trial-tower-entry/exchange-shop/trial-tower-product-entry.png) | 657x195 | 218.4 KB |

#### [`zhenmosi/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/) — 38 file

| File | W×H | Size |
|---|---|---|
| [`accept-task-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/accept-task-button.png) | 397x122 | 105.3 KB |
| [`accepted-stamp-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/accepted-stamp-icon.png) | 95x96 | 22.1 KB |
| [`blue-uncommon-quest-label.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/blue-uncommon-quest-label.png) | 125x46 | 13.0 KB |
| [`burst-label.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/burst-label.png) | 96x46 | 8.5 KB |
| [`character-card-mask.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/character-card-mask.png) | 249x389 | 16.2 KB |
| [`character-card.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/character-card.png) | 920x399 | 645.4 KB |
| [`character-token.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/character-token.png) | 46x86 | 8.3 KB |
| [`close-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/close-button.png) | 111x108 | 25.5 KB |
| [`defense-label.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/defense-label.png) | 94x45 | 9.0 KB |
| [`duration-label.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/duration-label.png) | 94x45 | 9.0 KB |
| [`errand-bg-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/errand-bg-frame.png) | 2048x1099 | 4.0 MB |
| [`errand-box-selected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/errand-box-selected.png) | 1100x171 | 438.5 KB |
| [`errand-box-unselected.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/errand-box-unselected.png) | 1056x171 | 417.6 KB |
| [`errand-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/errand-icon.png) | 42x42 | 4.6 KB |
| [`exchange-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/exchange-button.png) | 188x64 | 25.0 KB |
| [`gold-legend-quest-label.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/gold-legend-quest-label.png) | 125x46 | 13.2 KB |
| [`green-common-quest-label.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/green-common-quest-label.png) | 125x46 | 13.1 KB |
| [`heal-label.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/heal-label.png) | 92x45 | 8.4 KB |
| [`merit-bg-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/merit-bg-frame.png) | 2048x1099 | 4.1 MB |
| [`merit-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/merit-icon.png) | 140x137 | 27.1 KB |
| [`name-black-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/name-black-bg.png) | 233x48 | 5.9 KB |
| [`physical-label.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/physical-label.png) | 96x46 | 8.5 KB |
| [`product-entry-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/product-entry-box.png) | 898x195 | 414.8 KB |
| [`progress-full.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/progress-full.png) | 1014x44 | 111.8 KB |
| [`pulley.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/pulley.png) | 20x572 | 5.3 KB |
| [`purple-rare-quest-label.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/purple-rare-quest-label.png) | 125x46 | 13.0 KB |
| [`rare-errand-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/rare-errand-icon.png) | 46x42 | 3.9 KB |
| [`recruit-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/recruit-button.png) | 244x74 | 39.6 KB |
| [`retainer-bg-box.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/retainer-bg-box.png) | 2048x1099 | 4.0 MB |
| [`retainer-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/retainer-bg.png) | 228x369 | 230.2 KB |
| [`retainer-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/retainer-icon.png) | 52x41 | 5.3 KB |
| [`salary-icon.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/salary-icon.png) | 60x40 | 6.1 KB |
| [`slide-track.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/slide-track.png) | 32x738 | 22.7 KB |
| [`spell-label.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/spell-label.png) | 94x45 | 8.9 KB |
| [`support-label.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/support-label.png) | 92x45 | 8.6 KB |
| [`vault-bg-frame.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/vault-bg-frame.png) | 2048x1099 | 4.0 MB |
| [`zhenmosi-bg-image.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/zhenmosi-bg-image.png) | 2048x1152 | 2.8 MB |
| [`zuofeng-name-black-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/zuofeng-name-black-bg.png) | 438x83 | 77.3 KB |

#### [`zhenmosi/button-area/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/button-area/) — 8 file

| File | W×H | Size |
|---|---|---|
| [`errand-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/button-area/errand-button.png) | 412x180 | 102.2 KB |
| [`errand-click.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/button-area/errand-click.png) | 412x180 | 108.0 KB |
| [`merit-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/button-area/merit-button.png) | 412x180 | 104.4 KB |
| [`merit-click.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/button-area/merit-click.png) | 412x180 | 110.4 KB |
| [`retainer-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/button-area/retainer-button.png) | 412x180 | 106.0 KB |
| [`retainer-click.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/button-area/retainer-click.png) | 412x180 | 112.3 KB |
| [`vault-button.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/button-area/vault-button.png) | 412x180 | 107.1 KB |
| [`vault-click.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/button-area/vault-click.png) | 412x180 | 113.2 KB |

#### [`zhenmosi/retainer-bg/`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/retainer-bg/) — 4 file

| File | W×H | Size |
|---|---|---|
| [`gaosheng-retainer-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/retainer-bg/gaosheng-retainer-bg.png) | 228x369 | 169.2 KB |
| [`qingshuangzi-retainer-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/retainer-bg/qingshuangzi-retainer-bg.png) | 228x369 | 169.3 KB |
| [`youzhu-retainer-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/retainer-bg/youzhu-retainer-bg.png) | 228x369 | 165.9 KB |
| [`yuejianxin-retainer-bg.png`](../../public/NEWSPRITE/Assets/Resources/assets/ui/zhenmosi/retainer-bg/yuejianxin-retainer-bg.png) | 228x369 | 153.3 KB |
</details>

---

## 4. Tầng 4 — Source art & file rời

- [`art-source/ui/ink-wash/approved/`](../../art-source/ui/ink-wash/approved/) — 11 master @4x + 6 overlay PNG gốc → [`scripts/build-ink-wash-assets.mjs`](../../scripts/build-ink-wash-assets.mjs) → atlas + slices + manifest JSON.
- [`art-source/backgrounds/dong-fu/`](../../art-source/backgrounds/dong-fu/) ({layer-masks,seasonal-masters,approved}), [`art-source/buildings/dong-fu/v2/`](../../art-source/buildings/dong-fu/v2/) ({masters,masters-redesign,extraction-plates,concepts,references,shared/seasons-chroma}) — source của backgrounds/buildings.
- [`art/contact-sheets/`](../../art/contact-sheets/), [`art/animation-impact-markers.json`](../../art/animation-impact-markers.json) — QA/pipeline artifacts.
- [`asset-drop/`](../../asset-drop/) — chỉ README (điểm hạ cánh asset tương lai).
- Root `game/`: [`home.png`](../../home.png), [`panel-nhanvat.png`](../../panel-nhanvat.png), [`probe-ritual.png`](../../probe-ritual.png), `verify-*.png`, `re-*.png` — screenshot QA, không ship.

---

## 5. Orphan & findings

| # | Item | Size | Ghi chú |
|---|---|---|---|
| 1 | [`ink-go-board-19x19-v1.png`](../../public/assets/ui/skill/ink-go-board-19x19-v1.png) 2048² | 5.4 MB | Zero ref — orphan nặng nhất tầng 1 |
| 2 | [`combat/thanh-van/`](../../public/assets/combat/thanh-van/) 9 file (bg 2560×1440/1672×941, go-board frame+surface, seats 1024×1536, mist) | ~16 MB | Đã thay bằng `backgrounds/thanh-van/modular` |
| 3 | [`equipment-slots/`](../../public/assets/equipment-slots/) 6 file 156² (armor/boots/helmet/necklace/ring/weapon) | ~100 KB | Zero ref — EquipmentPaperdoll không dùng |
| 4 | [`alchemy-room.png`](../../public/assets/ui/Slot/alchemy-room.png) 64² | 4.8 KB | Zero ref |
| 5 | [`vfx/`](../../public/assets/vfx/) spritesheets 568 file + kiem-tu | ~178 MB | Staged — driver VFX procedural |
| 6 | `characters/animated/*/{portrait,closeup,radar-chart,avatar/}` | — | "staged" theo [`CharacterArt.ts`](../../src/game/support/CharacterArt.ts) |
| 7 | [`ui/ink-wash/slices/`](../../public/assets/ui/ink-wash/slices/) 22 file | ~4.1 MB | Dormant ở Vue; atlas còn sống ở Phaser |
| 8 | [`NEWSPRITE/`](../../public/NEWSPRITE/) toàn bộ | ~1.1 GB | Unreferenced, vẫn copy vào dist mỗi build |
| 9 | [`divider-glow.png`](../../public/assets/ui/divider-glow.png) ≡ [`bag-slot-hover.png`](../../public/assets/ui/Slot/bag-slot-hover.png) | 2×30 KB | Byte-identical duplicate |
| 10 | [`ink-wash-ui-size-matrix.png`](../../public/assets/ui/ink-wash/review/ink-wash-ui-size-matrix.png) 840×1500 | 355 KB | Doc artifact trong public |

---

## 6. Ai load cái gì — consumption map

| Surface | File/Component | Ảnh dùng |
|---|---|---|
| HUD drawers | [`theme.css`](../../src/assets/theme.css) `.ink-drawer` | [`panel-drawer-ink.png`](../../public/assets/ui/panel-drawer-ink.png) (border-image), [`panel-drawer-bg.png`](../../public/assets/ui/panel-drawer-bg.png) (cover) |
| Divider | [`theme.css`](../../src/assets/theme.css) | [`divider-glow.png`](../../public/assets/ui/divider-glow.png) |
| Bag/inventory | [`SlotView.vue`](../../src/components/common/SlotView.vue) | [`inv-slot-backdrop`](../../public/assets/ui/Slot/inv-slot-backdrop.png), [`bag-slot-hover`](../../public/assets/ui/Slot/bag-slot-hover.png), [`slot-backdrop`](../../public/assets/ui/Slot/slot-backdrop.png), [`slot-frame-hover`](../../public/assets/ui/Slot/slot-frame-hover.png), [`seal-frame`](../../public/assets/ui/Slot/seal-frame.png) |
| Màn nền overlay | [`InkWashBackdrop.vue`](../../src/components/common/InkWashBackdrop.vue) | [`ink-wash/overlays/`](../../public/assets/ui/ink-wash/overlays/) ×5 |
| Character panel | [`CharacterPanel.vue`](../../src/components/panels/CharacterPanel.vue) | [`stat-meridian-figure`](../../public/assets/ui/stat-meridian-figure.png), [`el-*`](../../public/assets/ui/elements/) ×9, [`talent-card-scroll`](../../public/assets/ui/talent-card-scroll.png) ×2 |
| Tooltip nguyên tố | [`Tooltip.vue`](../../src/components/common/Tooltip.vue) | [`elements/banner-*`](../../public/assets/ui/elements/) ×6 |
| Nút/panel chrome | [`InkNineSlice.vue`](../../src/components/common/primitives/InkNineSlice.vue) | **CSS only** (PNG dormant) |
| Phaser 9-slice | [`InkWashUiPhaser.ts`](../../src/game/support/InkWashUiPhaser.ts) → [`TribulationScene.ts`](../../src/game/scenes/TribulationScene.ts) | [`ink-wash-ui.png`](../../public/assets/ui/ink-wash/atlas/ink-wash-ui.png)+json |
| Combat HUD | [`combat-reward-gourd.ts`](../../src/game/scenes/combat/combat-reward-gourd.ts) | [`reward-gourd-v1.png`](../../public/assets/ui/combat/reward-gourd-v1.png) |
| Portrait player | [`PlayerPortrait.vue`](../../src/components/common/PlayerPortrait.vue), [`PlayerVisualProfiles.ts`](../../src/presentation/art/PlayerVisualProfiles.ts) | [`cultivate.png`](../../public/assets/cultivate.png)/[`idle.png`](../../public/assets/idle.png) strip, [`characters/player/*`](../../public/assets/characters/player/) |
| Item icons | data manifests → [`SlotView.vue`](../../src/components/common/SlotView.vue)/[`ItemCardBody.vue`](../../src/components/common/ItemCardBody.vue)/[`ToastContainer.vue`](../../src/components/common/ToastContainer.vue) | [`skills`](../../public/assets/skills/) \| [`techniques`](../../public/assets/techniques/) \| [`pills`](../../public/assets/pills/) \| [`materials`](../../public/assets/materials/) \| [`equipment/items`](../../public/assets/equipment/items/) |
| Scene nền | [`DongFuScene.vue`](../../src/components/game/DongFuScene.vue), [`ThanhVanBackdropArt.ts`](../../src/presentation/background/ThanhVanBackdropArt.ts) | [`backgrounds/*`](../../public/assets/backgrounds/) (1672×941 layers) |
| Building art | [`DongFuBuildingSprite.vue`](../../src/components/game/DongFuBuildingSprite.vue), [`HomeBuildingIcons.vue`](../../src/components/game/HomeBuildingIcons.vue), [`useBuildingHeaderState.ts`](../../src/composables/useBuildingHeaderState.ts) | [`buildings/dong-fu/v2/*`](../../public/assets/buildings/dong-fu/v2/) |
| Combat sprites | [`CombatPreload.ts`](../../src/game/support/CombatPreload.ts), [`EnemyArt.ts`](../../src/game/support/EnemyArt.ts), [`MonsterArt.ts`](../../src/game/support/MonsterArt.ts), [`CharacterArt.ts`](../../src/game/support/CharacterArt.ts) | [`enemies/*`](../../public/assets/enemies/), [`characters/animated/*`](../../public/assets/characters/animated/) |
| Battle preview | [`TranPhapPanel.vue`](../../src/components/panels/TranPhapPanel.vue), [`TranPhapCombatPreviewScene.ts`](../../src/game/scenes/TranPhapCombatPreviewScene.ts) | combatTextureUrl / avatarUrl |

*Audio (`assets/audio/ui`, sfx…) nằm ngoài scope audit hình ảnh.*
