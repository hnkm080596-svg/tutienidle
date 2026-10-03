# Scene 03 — Động Phủ / Home — Art Inventory

Component scaffold: `src/components/scenes/dong-fu/`. Design space
1672x941 (spec `huyen-kim-scene-layout-spec.json` scene `03 Dong Phu`).
Every temporary surface carries `art-needed` + `data-art-id` in the DOM;
the id below matches `data-art-id` exactly. `chrome` = sliceable UI
chrome (nine-slice); `prop` = composed scene object; `vista` = painted
scene layer.

Chrome slots marked *(ready)* already resolve through
`src/ui/huyenKimChrome.ts` + `huyen-kim-chrome.json` and render real PNG
nine-slices — the row is kept so the CSS fallback underneath can be
retired once the painted asset is final.

## Vista (painted scene layers, bottom-up)

| # | data-art-id | Component | design-px | Type | Layer | Description |
|---|---|---|---|---|---|---|
| 1 | `dong-fu-vista-sky` | `vista/DongFuVistaFallback.vue` | 1672x941 (inset 0) | vista | L0 stack L1 | Sky gradient backdrop — load-time fallback for the real vista stack; replace with painted sky or remove once the parallax PNGs always cover first paint. |
| 2 | `dong-fu-vista-mountains-far` | `vista/DongFuVistaFallback.vue` | 1672x941 clip-path silhouette | vista | L0 stack L2 | Far mountain range silhouette (cool ink wash, faint). Fallback only. |
| 3 | `dong-fu-vista-mountains` | `vista/DongFuVistaFallback.vue` | 1672x941 clip-path silhouette | vista | L0 stack L3 | Mid mountain range silhouette (deeper ink). Fallback only. |
| 4 | `dong-fu-vista-ground` | `vista/DongFuVistaFallback.vue` | 1672x941 clip-path | vista | L0 stack L4 | Ground plane gradient. Fallback only — real ground is parallax layer `07-sect-ground`. |
| 5 | `dong-fu-season-veil` | `vista/DongFuSeasonVeil.vue` | 1672x941 fill | vista | L3 (z40 above hotspots) | Seasonal tint overlay over buildings. Already loads real PNGs via `dongFuSeasonOverlayUrl` — listed so the veil asset stays in the inventory. |
| 6 | `dong-fu-spirit-motes` | `vista/DongFuSpiritMotes.vue` | 4 particles ~3px, viewport region | vista | L5 | Lingqi motes drifting around the cultivator. Currently CSS dots + keyframe drift; could become a particle sprite sheet. |
| 7 | `dong-fu-dais-formation` | `dais/DongFuLinhNhanFormation.vue` | ~300x140 ellipse at (50%, 66%) | prop | L5 | Linh Nhan cultivation formation: glow + 3 concentric rotating rings under the seated figure. Temp CSS borders/rings. |
| 8 | `dong-fu-focus-dim` | `vista/DongFuFocusDim.vue` | 1672x941, 30%x26% clear window | vista | L6 (above hotspots, below player) | SS14.5 context dim — radial ink mask that darkens everything except the focused building. Temp CSS mask. |
| 9 | `dong-fu-vignette` | `vista/DongFuVignette.vue` | 1672x941 | vista | top of scene | Soft corner/edge ink vignette. Temp CSS radial gradient. |

## Building hotspots (world-anchored ornaments)

Buildings render real layered PNGs via `DongFuBuildingSprite` (pipeline
`dongFuBuildingPipeline`) — not part of this inventory except the plaque.

| # | data-art-id | Component | design-px | Type | Layer | Description |
|---|---|---|---|---|---|---|
| 10 | `building-plaque` | `hotspots/DongFuBuildingPlaque.vue` | ~56x180 vertical plate | chrome *(ready)* | above sprite | Vertical nameplate behind each building label (status dot + vertical-rl name + level). Wired: `chromeSlice('building-plaque')`. |

## Dao Luan command wheel (opens from the seated figure)

| # | data-art-id | Component | design-px | Type | Layer | Description |
|---|---|---|---|---|---|---|
| 11 | `dao-luan-backdrop` | `wheel/DongFuWheelBackdrop.vue` | full viewport radial dim | vista | L7 bottom | Ink radial dim behind the open wheel. Temp CSS. |
| 12 | `dao-luan-orbit` | `wheel/DongFuWheelOrbitRing.vue` | inner 370x370 / outer 528x528 rings | prop | L7 | Two orbit circles around the hub. Temp CSS ring borders. |
| 13 | `dao-luan-center` | `wheel/DongFuWheelCenterSeal.vue` | ~92px hollow ring | prop | L7 center | HOLLOW ring around the seated cultivator (the ref shows the figure visible through the hub — do NOT produce a filled medallion; `dao-luan-center` chrome slot intentionally unwired for this reason). Temp CSS ring + label. |
| 14 | `dao-luan-node` | `wheel/DongFuWheelSlot.vue` | ~64px round node disc | chrome *(ready)* | L7 slots | Slot disc background per wheel node (rings 1-2 rendered; node glyph is `HuyenKimSymbol`). Wired: `hkChromeUrl('dao-luan-node')` as `--slot-art`. |
| 15 | `home-player-hint` | `dais/DongFuCultivatorFigure.vue` | ~120x28 pill under figure | chrome | L6 | "Tap to open the wheel" caption pill under the seated figure. Temp CSS pill. |

## Top bar (screen-space chrome, L8)

| # | data-art-id | Component | design-px | Type | Layer | Description |
|---|---|---|---|---|---|---|
| 16 | `identity-plate` | `hud/DongFuIdentityPlate.vue` | ~300x74, top-left | chrome *(ready)* | L8 | Identity card plate (avatar + name + realm + progress hairline). Wired: `chromeSlice('identity-plate')`. |
| 17 | `avatar-frame` | `hud/DongFuIdentityPlate.vue` | 46x46 ring over 38px portrait | chrome *(ready)* | L8 | Circular avatar frame overlay. Wired: `hkChromeUrl('avatar-frame')`. |
| 18 | `resource-pill` | `hud/DongFuResourcePill.vue` | 160x48 capsule x3 | chrome *(ready)* | L8 | Currency capsule (3 spirit-stone tiers + gated gacha pills). Wired: `chromeSlice('resource-pill')`. |
| 19 | `icon-button-utility` | `hud/DongFuUtilitySeals.vue` | ~48px round seal x3 | chrome *(ready, unwired)* | L8 | Circular icon seal for feedback/bag/settings. Slot is ready in the manifest but `GameButton` still paints its own surface — needs either a seal variant of GameButton or a dedicated seal component once the PNG is final. |
| 20 | `auto-farm-chip` | `hud/DongFuUtilitySeals.vue` (`AutoFarmIndicator`) | ~120x36 chip | chrome | L8 | Auto-farm status chip next to the seals. Temp CSS inside `AutoFarmIndicator`. |

## Right-edge HUD (L8/L11)

| # | data-art-id | Component | design-px | Type | Layer | Description |
|---|---|---|---|---|---|---|
| 21 | `quest-tracker-chip` | `hud/DongFuQuestTracker.vue` | 424x48 chip, bottom-right (above Thien Co) | chrome | L8 | Quest tracker pill (icon + name + progress). Temp CSS pill. |
| 22 | `thien-co-chip` | `thien-co/DongFuThienCoChip.vue` | 268x52 chip, bottom-right | chrome | L8 | Thien Co collapsed chip (seal glyph + title + count badge). Temp CSS pill. |
| 23 | `surface-l-drawer` | `thien-co/DongFuThienCoDrawer.vue` | 360x640 card, right edge | chrome *(ready)* | L8 (drawer z11 content) | Thien Co open drawer card. Wired: `chromeSlice('surface-l-drawer')`. |
| 24 | `list-row` | `thien-co/DongFuThienCoEntry.vue` | ~330x64 row | chrome *(ready)* | drawer list | Opportunity entry row surface (marker + title/detail + CTA). Wired: `chromeSlice('list-row')`. |

## Not built (per `huyen-kim-reference-audit.md`)

Chat strip bottom-left, VIP badge, 4th resource pill, Su Kien / Cua Hang
seals, the ~10 invented building nameplates, and the wheel labels "Tao
Nhan Vat"/"The Gioi" are RESERVED/INVALID — no components were created
for them. `chi_hien_quan` and `scripture_pavilion` follow the existing
`isBetaBuildingSurface` scope filter unchanged (the hotspots test
asserts chi_hien_quan renders; scripture_pavilion must never render).

## Layer order (bottom to top)

1. Vista parallax stack (L0) + vista fallback
2. Building hotspots art-space (L3, z5) incl. plaques + season veil
3. Linh Nhan formation + spirit motes (L5)
4. Focus dim (SS14.5, above hotspots)
5. Cultivator figure / dao-luan-hub (L4, z6)
6. Vignette
7. Dao Luan command wheel layer (z8)
8. Top bar + Thien Co rail + quest tracker (L8, z9)
