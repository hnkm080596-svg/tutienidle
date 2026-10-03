# Huyền Kim Sơn Thủy — UI Asset Inventory

Baseline `devin/frontend-ready @ e9cb0dd6`. Design space **1672×941**. Companion JSON: `huyen-kim-ui-asset-inventory.json` (canonical machine form).

Rules in force (from `huyen-kim-chrome-art-spec.md` + `huyen-kim-component-state-matrix.md`):
- Transparent PNG, no baked gameplay text, `tintable` sheets drawn grayscale, states = runtime (tint/opacity/mask/glow) — one base art per shape.
- `scrollbar` is **HOLD** (app hides scrollbars; draw only if chrome is reinstated). `frame-s-slot` was released from HOLD by Ruling 03 — **P0, shared, drawable**.
- `alchemy-cauldron-prop` is a **UI scene prop** (Ruling 02) — UI Art Agent owned, no gameplay/item/world identity.
- Gameplay art (characters, enemies, items, skills, VFX, world backgrounds) is **excluded** — occupied rectangles are measured in the layout spec only.

## 1. Component families (14)

| family | members | used by scenes |
|---|---|---|
| `shell-scroll` | imperial-scroll-body, imperial-scroll-roller, scroll-title-plaque, section-plaque, surface-xl-scroll, frame-xl-ceremony | 01,02,04–12,15–18 |
| `shell-panel` | surface-m-panel, frame-m-modal, surface-l-drawer, frame-xs-tooltip | micro overlays, drawers, popovers |
| `navigation` | tab-seal, nav-seal-vertical, divider-ornament | all scroll scenes, tabs |
| `button` | button-compact, button-standard, button-ceremonial, icon-button-utility | global |
| `form` | text-field, toggle-track, slider-track, slider-thumb | 01,02,17 |
| `list` | list-row | 08–12,17,18 rows |
| `slot` | frame-s-slot (equip sockets, reward slots, material chips, inventory cells, requirements) | 09,12,15,16,11 |
| `hud` | resource-pill, avatar-frame, identity-plate, entity-bar | 03,13,15,16 |
| `badge` | seal-chip, boss-seal, stage-node | 04,10,18 |
| `node` | dao-luan-center, dao-luan-node, rune-node | 03 wheel, 05,07,08,14 |
| `combat` | skill-orb-frame, turn-token, timer-ring | 13,14 |
| `settings` | toggle-track, slider set, option rows (list-row) | 17 |
| `ornament` | corner-ornament, cloud-ornament, ceremony-ribbon, paper-grain-tile | scroll edges, ceremonial |
| `runtime-css` | (no art) dots, glows, masks, orbit lines, scrollfade, gauges | all |

## 2. Asset table (summary — full schema in JSON)

`M##` = manifest slot already in `huyen-kim-chrome.json`; `N##` = new request.

| id | impl | nominal px | 9-slice | tint | priority | scenes |
|---|---|---|---|---|---|---|
| M01 frame-xs-tooltip | 9-slice | 96×96 | 20/20/20/20 | ✓ | P1 | tooltips all |
| M02 frame-s-slot | 9-slice | 96×96 | 20/20/20/20 | ✓ | P0 | 09,11,12,15,16 |
| M03 surface-m-panel | 9-slice | 256×256 | 32/32/32/32 | — | P0 | all panel bodies |
| M04 frame-m-modal | 9-slice | 256×256 | 40/40/40/40 | — | P0 | modals, detail cards |
| M05 surface-l-drawer | 9-slice | 384×384 | 48/48/48/48 | — | P0 | Thiên Cơ, rails |
| M06 surface-xl-scroll | 9-slice | 512×640 | 64/64/96/96 | — | P0 | 15,16 + ceremonial |
| M07 frame-xl-ceremony | 9-slice | 512×512 | 72/72/72/72 | — | P0 | scroll outer frame |
| M08 button-compact | 9-slice | 160×56 | 28/28/16/16 | ✓ | P0 | combat rail, chips |
| M09 button-standard | 9-slice | 192×72 | 32/32/20/20 | ✓ | P0 | everywhere |
| M10 button-ceremonial | 9-slice | 256×96 | 40/40/24/24 | ✓ | P0 | Đột Phá/Nhập Trận CTAs |
| M11 icon-button-utility | 9-slice | 96×96 | 30/30/30/30 | ✓ | P0 | top bar seals |
| M12 seal-chip | 9-slice | 128×48 | 24/24/14/14 | ✓ | P1 | tags, requirements |
| M13 resource-pill | 9-slice | 160×48 | 24/24/14/14 | — | P0 | top bar currency |
| M14 entity-bar | 9-slice | 192×32 | 20/20/10/10 | ✓ | P0 | HP/progress bars |
| M15 divider-ornament | 9-slice | 256×16 | 96/96/4/4 | ✓ | P1 | section dividers |
| M16 scrollbar | 9-slice | 32×128 | 12/12/24/24 | ✓ | HOLD | (hidden scrollbars) |
| M17 dao-luan-center | raster | 192×192 | none | — | P0 | wheel hub, dais |
| M18 dao-luan-node | raster | 96×96 | none | ✓ | P0 | wheel/meridian/chapter nodes |
| M19 rune-node | raster | 64×64 | none | ✓ | P0 | skill/realm/stage vertices |
| M20 tab-seal | 9-slice | 96×64 | 20/20/16/16 | ✓ | P1 | tabs, nav markers |
| N01 imperial-scroll-body | 9-slice | 768×512 | 56/56/48/48 | — | P0 | imperial scenes |
| N02 imperial-scroll-roller | raster | 96×896 | none | — | P0 | scroll edges (mirror) |
| N03 scroll-title-plaque | raster | 320×88 | none | — | P0 | scroll titles (empty) |
| N04 section-plaque | 9-slice | 240×56 | 24/24/16/16 | — | P1 | section headers |
| N05 nav-seal-vertical | raster | 96×128 | none | ✓ | P0 | scroll side rail |
| N06 list-row | 9-slice | 384×64 | 16/16/12/12 | ✓ | P0 | all lists |
| N07 avatar-frame | raster | 96×96 | none | — | P0 | identity, HUD |
| N08 identity-plate | 9-slice | 384×96 | 24/24/20/20 | ✓ | P0 | top-left player card |
| N09 text-field | 9-slice | 320×56 | 20/20/16/16 | ✓ | P0 | 01,02 inputs |
| N10 toggle-track | raster | 96×48 | none | ✓ | P1 | settings toggles |
| N11 slider-track | 9-slice | 256×24 | 16/16/8/8 | ✓ | P1 | settings sliders |
| N12 slider-thumb | raster | 40×40 | none | ✓ | P1 | slider knob |
| N13 skill-orb-frame | raster | 96×96 | none | ✓ | P0 | combat skill dock |
| N14 turn-token | raster | 64×64 | none | ✓ | P1 | turn-order strip |
| N15 boss-seal | raster | 80×104 | none | — | P1 | boss/BOSS markers |
| N16 stage-node | raster | 80×80 | none | ✓ | P0 | exploration map |
| N17 building-plaque | raster | 96×160 | none | — | P1 | dong-fu hotspots |
| N18 corner-ornament | raster | 64×64 | none | ✓ | P2 | scroll corners |
| N19 cloud-ornament | raster | 256×128 | none | ✓ | P3 | scroll dressing |
| N20 timer-ring | raster | 128×128 | none | ✓ | P1 | countdown ring |
| N21 ceremony-ribbon | raster | 320×96 | none | — | P1 | victory/defeat flourish |
| N22 paper-grain-tile | tileable | 256×256 | none | ✓ | P3 | scroll interiors |
| N23 alchemy-cauldron-prop | raster | 384×320 | none | — | P2 | 11 focal prop (Ruling 02) |

Totals: **43 asset entries** (20 manifest + 23 new) — **42 drawable** (1 HOLD: scrollbar).

## 3. Existing reusable UI assets (kept, no new art)

`game/public/assets/ui/`:

- `ink-wash/slices/` — 11 9-slice ids @1x/@2x (button-s-ink/-paper/-seal, frame-l-landscape, frame-m-seal-corner, frame-s-slot, frame-xl-ceremony, frame-xs-ink-line, surface-l-ink-data, surface-m-paper, surface-xl-paper-scroll) + `ink-wash-ui-slices.json` + atlas. *Note: `InkNineSlice` currently renders CSS fallbacks for these ids (PNG path permanently hidden); they remain available for direct `background`/`<img>` reuse where appropriate.*
- `ink-wash/overlays/` — seal-cinnabar-large, seal-cinnabar-small, wash-bamboo-right, wash-bottom-mist, wash-corner-mountain-left/right (6).
- `elements/` — el-{earth,fire,metal,primordial,water,wood} icons (6) + banner-{same 6} (6) + el-formation-orbs, el-formation-ring, el-formation-star (3) — powers Ngũ Hành wheel + element seals.
- `Slot/` — slot-backdrop, slot-frame-hover, bag-slot-hover, inv-slot-backdrop, seal-frame (5).
- misc — divider-glow, panel-drawer-bg, panel-drawer-ink, stat-meridian-figure, talent-card-scroll(+hover), combat/reward-gourd-v1 (7).

→ **45 existing asset entries** (canonical list in JSON `existing_reusable_assets`); reused as-is or as interim/secondary dressing.

## 4. Runtime-only (no art needed)

notification dot, focus ring (`--hk-focus-*`), orbit guide circles, node-graph edge strokes, cooldown sweep mask, ATB gauge fill, Thế pips, selection halo (`hk-breath`), `scrollfade` gradients, mist vignette, lock desaturation, pressed scale. ~12 effects — all token-driven.

## 5. Gameplay-art items intentionally excluded (measured, not requested)

player portraits/sprites, enemy + boss portraits, technique book artifact, skill icons, item/equipment/pill/material icons, talent card art, stage/zone paintings (incl. **Sơn Hà Đồ map substrate — Ruling 04, gameplay/world pipeline**), dong-fu world layers, combat VFX. → **15 categories**. The alchemy cauldron is now a UI prop (Ruling 02), not excluded.
