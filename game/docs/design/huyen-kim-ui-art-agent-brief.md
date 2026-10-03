# Huyền Kim Sơn Thủy — UI Art Agent Brief

Baseline `devin/frontend-ready @ e9cb0dd6`. You are drawing **UI chrome only** — no gameplay art (no characters, enemies, items, skill icons, skill content icons, VFX, world backgrounds, sprites). Those are excluded by mission §20 and are someone else's pipeline.

Source of truth for this pack:
- `huyen-kim-ui-asset-inventory.json` — canonical asset list + schema (dims, insets, safe rects, states)
- `huyen-kim-scene-layout-spec.json` — where each asset lives at 1672×941
- `huyen-kim-reference-audit.md` — which reference blocks are real vs invented
- `huyen-kim-chrome-art-spec.md` — binding chrome rules (grayscale tintable sheets, no baked text, corner/edge discipline)

Design viewport: **1672×941**. All sizes below are design px (final raster). Export **@1x and @2x** PNG with transparency into `game/public/assets/ui/huyen-kim/` (a per-id folder structure matching `huyen-kim-chrome.json` bindings will be decided by the implementation agent — ask if unset).

## 0. Hard rules (repeat of chrome spec, binding)

1. **No baked text, ever.** No labels, numbers, runes-with-meaning, button text, tab text, logo text. The only exception is a separately-approved logo (not in this pack).
2. **Tintable sheets are grayscale.** Anything marked `tintable` ships as a luminance/alpha sheet; runtime colors it with `-webkit-mask-box-image`. Do not paint gold/jade/cinnabar into tintable art.
3. **One base art, states are runtime.** Do not draw hover/pressed/disabled variants. Idle sheet + spec'd state strategy only.
4. **9-slice discipline.** Corners carry ornament; edge mid-sections must tile/stretch cleanly; the interior slice may be plain paper/lacquer. Marked insets below are in source px.
5. **Transparent margins** listed must remain empty alpha (drop shadows may live there but the content rect must be clean).
6. **Materials**: deep ink, dark lacquer, engraved metal, antique gold, jade, aged ivory/ivory parchment, subtle cinnabar, ink-wash mist. **Avoid**: neon, glossy MMO chrome, Western stone frames, sci-fi purple, generic web cards. Elemental colors are accents only.
7. **Density hierarchy**: ceremonial > functional > utility. Corners dense, centers quiet. The scroll interiors must stay text-friendly (contrast-safe for dark ink text on light parchment, light text on dark lacquer).

## 1. P0 — required first (blocks implementation)

| id | type | source px | insets / shape | tint | safe content | notes |
|---|---|---|---|---|---|---|
| `imperial-scroll-body` | 9-slice | 768×512 | l56 t48 r56 b48 | no | 656×416 interior | THE core surface. Aged ivory parchment, low-frequency grain, edges shade toward rollers. Center stretch must not show visible banding at 1460px wide. |
| `imperial-scroll-roller` | raster | 96×896 | fixed | no | n/a | Carved dark-lacquer roller, gold end caps with jade ring. One roller; we mirror. Caps at top AND bottom must be vertically symmetric so mirroring works. |
| `frame-xl-ceremony` | 9-slice | 512×512 | l72 t72 r72 b72 | no | transparent center | Heaviest frame; corners carry engraving+inlay. Same frame rings imperial scrolls and ceremonial scrolls. |
| `scroll-title-plaque` | raster | 320×88 | stretch x only | no | text-safe 232×40 centered | Hanging plaque overlapping the top frame edge. Draw with alpha above/below so it can overlap. EMPTY center — app renders title text. |
| `surface-m-panel` | 9-slice | 256×256 | l32 t32 r32 b32 | no | 192×192 | Workhorse dark panel (lacquer/ink). Must read at 80px and at 900px. |
| `surface-l-drawer` | 9-slice | 384×384 | l48 t48 r48 b48 | no | 288×288 | Vertical drawer/docked surface (Thiên Cơ, Chi Tiết). Left edge may carry a seam since drawers dock from screen edges. |
| `surface-xl-scroll` | 9-slice | 512×640 | l64 t96 r64 b96 | no | 384×448 | Ceremonial vertical scroll body (victory/defeat/offline). Parchment like imperial body but taller proportion; top/bottom edges carry the scroll curl shade. |
| `frame-m-modal` | 9-slice | 256×256 | l40 t40 r40 b40 | no | transparent center | Medium ornamental frame for dialogs/cards; lighter than xl-ceremony. |
| `frame-xs-tooltip` | 9-slice | 96×96 | l20 t20 r20 b20 | YES | 56×56 | Small tooltip/popover frame; grayscale, tinted gold/cinnabar at runtime. |
| `button-standard` | 9-slice | 192×72 | l32 t20 r32 b20 | YES | text 120×24 | THE default button. Grayscale. Horizontal stretch only. |
| `button-compact` | 9-slice | 160×56 | l28 t16 r28 b16 | YES | text 96×20 | Smaller button for chips/counters. Grayscale. |
| `button-ceremonial` | 9-slice | 256×96 | l40 t24 r40 b24 | YES | text 160×36 | The Đột Phá / Khiêu Chiến / Nhập Trận CTA. Grayscale, heaviest ornament of the button family; top/bottom 4px transparent margin for glow. |
| `icon-button-utility` | 9-slice | 96×96 | l30 t30 r30 b30 | YES | 48×48 glyph recess | Circular seal button (settings/bag/feedback/close). Grayscale; center recess holds runtime icon. |
| `nav-seal-vertical` | raster | 96×128 | fixed | YES | icon 64×56 top / text 56×44 bottom | Tall seal for the imperial-scroll side rail. Upper zone is an icon recess; lower zone is an EMPTY label column for app text. Grayscale. |
| `section-plaque` | 9-slice | 240×56 | l24 t16 r24 b16 | no | text 184×24 | Small header plaque inside scroll content. Fixed colors (lacquer+gold edge). |
| `list-row` | 9-slice | 384×64 | l16 t12 r16 b12 | YES | 344×40 | Selectable row (quests, recipes, settings options, AI options). Grayscale, near-flat — rows tile densely so ornament must be minimal (thin engraved edge only). |
| `seal-chip` | 9-slice | 128×48 | l24 t14 r24 b14 | YES | text 72×16 | Small tag/badge (talent, rank, requirement, type chips). Grayscale. |
| `resource-pill` | 9-slice | 160×48 | l24 t14 r24 b14 | no | icon 24px + text 84×20 | Top-bar currency capsule: dark jade body, gold rim, left circular icon recess. Fixed colors. |
| `identity-plate` | 9-slice | 384×96 | l24 t20 r24 b20 | YES | text 252×56 (left 90px reserved for avatar overlap) | Top-left player card backing. Grayscale. |
| `avatar-frame` | raster | 96×96 | fixed | no | inner 72×72 | Flat-top hexagonal portrait ring, engraved metal+gold. Portrait crops inside the hexagon. |
| `entity-bar` | 9-slice | 192×32 | l20 t10 r20 b10 | YES | track 152×12 | Thin bar chrome — fill is runtime gradient. Grayscale track; needs ally/enemy/neutral tint reads. |
| `text-field` | 9-slice | 320×56 | l20 t16 r20 b16 | YES | text 272×24 | Inset input field. Grayscale; focus/invalid tints runtime. |
| `dao-luan-center` | raster | 192×192 | fixed | no | glyph recess 112×112 | Ornate center medallion for the command wheel/dais. Radial symmetry, engraved metal + jade inlay. |
| `dao-luan-node` | raster | 96×96 | fixed | YES | icon 56×56; caption zone under node | Orbit node disc for command wheel, meridian rings, chapter trackers. Grayscale. |
| `rune-node` | raster | 64×64 | fixed | YES | icon recess 36×36 | Small graph vertex (skill tree, realm ladder, stage path). Grayscale; lock glyphs are runtime. |
| `skill-orb-frame` | raster | 96×96 | fixed | YES | icon 64×64 + caption strip 64×16 | Circular ornate combat skill button base. Grayscale; cooldown sweep is runtime mask. |
| `stage-node` | raster | 80×80 | fixed | YES | number 40×24 center | Circular map node; number is runtime text. Grayscale; locked/cleared states are tints + overlays. |
| `frame-s-slot` | 9-slice | 96×96 | l20 t20 r20 b20 | YES | icon 56×56 | **RULING 03 — released, P0.** One neutral base for inventory cells, equipment sockets, reward slots, material chips, requirement chips, compact sockets. Grayscale; rarity/state tints are runtime — do NOT draw per-state or per-rarity variants. An ink-wash `frame-s-slot` exists as interim. |

## 2. P1 — needed soon (first content pass)

| id | type | source px | shape | tint | notes |
|---|---|---|---|---|---|
| `tab-seal` | 9-slice | 96×64 | l20 t16 r20 b16 | YES | Horizontal tab backing; selected = runtime gold edge + jade fill. |
| `divider-ornament` | 9-slice | 256×16 | l96 t4 r96 b4 | YES | Thin engraved rule; the 96px end caps carry ornament, center stretches as a hairline with a small center ornament gap for optional text ("Hoặc"). |
| `toggle-track` | raster | 96×48 | fixed | YES | Pill track + knob recess; grayscale, jade tint for on. |
| `slider-track` | 9-slice | 256×24 | l16 t8 r16 b8 | YES | Groove with end caps; fill runtime. |
| `slider-thumb` | raster | 40×40 | fixed | YES | Jade/gold circular knob. |
| `timer-ring` | raster | 128×128 | fixed | YES | Ring frame for tribulation countdown; arc is runtime stroke. |
| `turn-token` | raster | 64×64 | fixed | YES | Turn-order portrait ring; faction tint runtime. |
| `boss-seal` | raster | 80×104 | stretch y | no | Vertical cinnabar ribbon for boss/critical nodes; overlaps node top edge. |
| `ceremony-ribbon` | raster | 320×96 | stretch x | no | Wide brush-ribbon flourish behind victory/defeat title text; needs gold (victory) and cinnabar (defeat) reads via runtime tint — draw balanced so tint works both ways. |
| `building-plaque` | raster | 96×160 | stretch y | no | Vertical hanging tag over Động Phủ buildings; vertical text column safe area 40×96 (app renders vertical text). |

## 3. P2/P3 — polish, optional

| id | type | source px | notes |
|---|---|---|---|
| `corner-ornament` | raster | 64×64 | L-shaped engraved corner; draw top-left once, we rotate. |
| `cloud-ornament` | raster | 256×128 | Ink-wash cloud wisp for scroll/scene edge dressing. Existing `wash-*` overlays may suffice — check first. |
| `paper-grain-tile` | tileable | 256×256 | Subtle ivory paper fiber; only if baked scroll texture bands at 2x. |
| `alchemy-cauldron-prop` | raster | 384×320 | **RULING 02 — UI scene prop (owned by you).** Focal centerpiece for the Alchemy scroll (region 684,176,420×360). Fixed colors; brewing = runtime ember/mist overlay, never a second raster. Must NOT gain gameplay/item/world-building identity or stats — decorative only. |
| `scrollbar` | 9-slice | 32×128 | **HOLD** — app hides scrollbars; draw only if scroll chrome is reinstated. |

## 4. Existing assets you may reuse/inspect (do not redraw)

`game/public/assets/ui/` already contains a full ink-wash kit: 11 nine-slice ids (`button-s-ink/paper/seal`, `frame-l-landscape`, `frame-m-seal-corner`, `frame-s-slot`, `frame-xl-ceremony`, `frame-xs-ink-line`, `surface-l-ink-data`, `surface-m-paper`, `surface-xl-paper-scroll`), 6 wash overlays, 15 element icons/banners/formation assets, 5 slot frames, and misc pieces (`divider-glow`, `panel-drawer-*`, `talent-card-scroll`, `reward-gourd-v1`, `stat-meridian-figure`). These are the interim/secondary dressing — match their ink-wash tonality so new chrome sits coherently next to them. The new Huyền Kim pack supersedes them where the inventory assigns the slot.

## 5. State strategy (draw once; runtime does the rest)

| state | runtime mechanism | what you must NOT do |
|---|---|---|
| hover | brightness/glow overlay | don't draw a hover sheet |
| pressed | scale 0.97 + shadow shift | don't draw pressed |
| selected | jade fill + gold edge tint | don't bake selection |
| locked | desaturate + ink veil + lock glyph (runtime) | don't bake a lock into node art |
| disabled | opacity 0.5 + desaturation | don't draw disabled |
| attention | gold halo breath anim | don't bake glow into base |
| cooldown | sweep mask + countdown text | don't bake a clock |
| insufficient | cinnabar flash | don't bake red |
| victory/defeat | tint ceremony-ribbon + frame overlay | don't draw two scrolls |

## 6. Deliverable checklist for the art agent

1. Every P0 id at @1x + @2x, transparent PNG, matching `huyen-kim-ui-asset-inventory.json` dims/insets exactly (insets are authoritative — implementation will slice on them).
2. Grayscale for all `tintable` sheets; verify a gold tint and a cinnabar tint both read correctly (test with `-webkit-mask-box-image` or multiply).
3. Report any id where a drawn detail collides with a safe rect (e.g., ornament inside `text_safe_rect`) — adjust the art, never the safe rect, unless the spec is wrong (then flag it).
4. Manifest companion file: emit a JSON (or YAML) alongside the pack listing `id → {file, slice, trim}` so the implementation agent can generate `huyen-kim-chrome.json` bindings mechanically.

## 7. NOT your job (excluded gameplay art)

Player/enemy/boss/companion art; skill and item icons; technique book art; pill/material art; stage/zone paintings — **including the Sơn Hà Đồ painted map substrate (Ruling 04): geography = gameplay/world pipeline; you own only map chrome (frame, route lines, stage/boss nodes, selected/locked treatment, chapter markers, zone labels, masks, edge treatment, stage-detail chrome)** — Động Phủ world layers; combat VFX; animations; sprite sheets. Occupied rectangles are already measured in the layout spec — your frames must leave room for them.
