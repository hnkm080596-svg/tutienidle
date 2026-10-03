# Huyền Kim Sơn Thủy — Scene Layout Spec

Baseline `devin/frontend-ready @ e9cb0dd6`. Design space **1672 × 941**, 8px grid where practical. Companion: `huyen-kim-scene-layout-spec.json` (canonical machine form — every region carries x/y/w/h in design px plus % for runtime mapping).

**Runtime mapping note:** the shipped fit engine is `HD_VIEWPORT 1280×720` (uniform scale + letterbox, `presentation/viewport/HDViewport.ts`). Design px → logical stage = ×0.7655 (1280/1672). All regions also carry `%` so the implementation can live in `--game-vw/--game-vh` regardless of the stage decision (audit §6.1).

**Shell families:** `world` (full-bleed) · `imperial-scroll` · `ceremonial-scroll` · `micro-overlay`.

## Shared shell geometry

### Global top bar (world scenes, z-index 9)

| region | x | y | w | h |
|---|---|---|---|---|
| identity-plate | 16 | 10 | ~372 | 58 |
| resource cluster | centered | 10 | ≤520 | 48 |
| utility seals | right 16 | 10 | ~230 | 48 |
Translucent edge gradient (88%→0%), pointer-events only on children.

### Imperial scroll envelope (major panels)

```
 y=34  ┌ roller-L 96w                     roller-R 96w ┐
 y=50  │┌─────────────── frame ring 1480×824 ──────────┐│
 y=90  ││ content safe area 1416×760                    ││
       ││  nav rail 132w │ header band │ close zone    ││
       ││               │ content grid                ││
 y=850 ││               │ footer safe 1244×56         ││
 y=890 │└─────────────────────────────────────────────┘│
       └────────────────────────────────────────────────┘
 x=50/66 → 1606/1622
```

| region | x | y | w | h | notes |
|---|---|---|---|---|---|
| envelope | 66 | 50 | 1540 | 840 | 92.1% × 89.3% — world visible around edges |
| roller-left | 50 | 34 | 96 | 872 | mirrors to right (1510…1622 zone) |
| roller-right | 1526 | 34 | 96 | 872 | mirrored copy |
| frame ring | 96 | 58 | 1480 | 824 | frame-xl-ceremony, ~32px visible band |
| title plaque | 676 | 30 | 320 | 88 | hangs over top frame, EMPTY text-safe 232×40 |
| close seal | 1500 | 66 | 48 | 48 | ✕ utility seal, z top |
| nav rail | 140 | 140 | 132 | 698 | nav-seal-vertical stack, gap 8, scrollfade |
| header band | 288 | 100 | 1244 | 68 | breadcrumb/identity/context + header actions |
| content grid | 288 | 176 | 1244 | 610 | scene regions live here |
| footer safe | 288 | 794 | 1244 | 56 | primary CTA + secondary actions |

Scroll open animation: closed at center → rollers separate horizontally → body reveal-mask center→edges, 450–550ms open (`--hk-motion-scene` 450ms token exists), 300–380ms close, reduced-motion = cross-fade. Roller travel ≈ ±770px.

### Ceremonial scroll envelope

| region | x | y | w | h |
|---|---|---|---|---|
| envelope | 456 | 110 | 760 | 720 |
| roller-left/right | 440 / 1200 | 94 | 96 | 752 |
| frame ring | 486 | 118 | 700 | 704 |
| title flourish | 576 | 140 | 520 | 96 | ceremony-ribbon + app-rendered title |
| content | 526 | 240 | 620 | 430 | reward rows / growth / hint |
| actions | 526 | 690 | 620 | 80 | two CTAs |

### Micro overlay

Tooltip ≤ frame-xs-tooltip 96-src (effective ~220–480px); confirm/dialog = frame-m-modal card ~420–560px; popovers (building) ~320–400px anchored to building anchor.

## Scene 01 — Login `world`

- **PURPOSE**: auth entry — login/register/resume/guest.
- **OWNED**: credentials form, session resume, guest path, locale pick, guest upgrade.
- **FULL-PRODUCT**: none beyond beta. **BETA**: all visible features live.
- **KEPT**: right scroll card over vista, tabs, two buttons, language.
- **CORRECTED**: no remember-me/forgot-password; locale = chips.
- **REMOVED**: social login (none in ref anyway).
- **REGIONS**: `vista` 0/0/1672/941 · `auth-scroll` 1016/120/560/700 · `logo` 1016+96/168/368/120 · `locale-chips` 1336/138/224/36 · `tabs` 1048/300/496/44 · `form` 1048/352/496/240 · `divider` 1048/612/496/24 · `secondary-actions` 1048/644/496/120 · `upgrade-card` 1048/468/496/~140 (conditional).
- **FAMILIES**: imperial-scroll (half-width), text-field, button-standard/ceremonial, seal-chip, divider-ornament.
- **ART**: scroll card, input frames, buttons; vista = excluded.
- **INTERACTION**: tabs (arrow-key nav), submit, guest, resume, upgrade confirm modal.
- **OVERFLOW**: card scrolls internally if height < content; scrollfade.
- **A11Y**: role=tablist, aria-invalid + live errors, focus-trap on confirm.

## Scene 02 — Character Creation `world`

- **PURPOSE**: create character — name + 1 talent (roll 9).
- **OWNED**: name validation, talent offer grid, reroll, finish.
- **FULL-PRODUCT**: starter-skill selector RESERVED.
- **BETA**: fixed starter (`linh_bao`), 9-card roll.
- **KEPT**: art-left/scroll-right split, name row, talent cards, CTA.
- **CORRECTED**: 9 talent cards (3×3), no dice button; starter box hidden (RESERVED slot retained in spec).
- **REGIONS**: `vista` 0/0/940/941 (56%) · `creation-scroll` 940/90/660/760 · `back-btn` 24/24/96/40 · `name-section` 988/150/564/170 · `talent-grid` 988/340/564/360 (3 cols, card 176×112) · `starter-slot(reserved)` 988/716/564/56 hidden · `footer` 988/780/564/60 · `summary-line` above CTA.
- **FAMILIES**: imperial-scroll, text-field, talent card (talent-card-scroll existing), button-ceremonial.
- **INTERACTION**: reroll replaces grid (aria-busy), single-select, finish disabled until valid.
- **A11Y**: radio-group semantics on talents, live region on errors.

## Scene 03 — Động Phủ `world` (home)

- **PURPOSE**: home world — cultivation identity, building hotspots, wheel nav, HUD, Thiên Cơ.
- **OWNED**: world scene, hotspots (5 beta buildings), command wheel (2 orbits), resource HUD, identity, Thiên Cơ, quest tracker.
- **FULL-PRODUCT**: phap_bao/formation/companion wheel slots, chi_hien_quan building — hidden.
- **BETA**: wheel = `betaWheelSlots()`; buildings = `isBetaBuildingSurface`.
- **KEPT**: vista dominance ≥70%, building plaques, center dais + radial wheel, Thiên Cơ drawer, quest chip.
- **REMOVED**: chat strip, VIP badge, 4th currency, invented utility buttons.
- **REGIONS**: `top-bar` full width (see shell) · `vista` 0/0/1672/941 · `hotspot.pill_room` center(217,545) hitbox ~240×160 · `hotspot.equipment_hall` (418,423) ~230×140 · `hotspot.gathering_outpost` (1145,428) ~200×110 · `hotspot.vendor` (1338,433) ~180×110 · `hotspot.teleport_array` (1505,753) ~250×150 · `dao-luan-hub` center (836,620) r=96 · `wheel-inner-orbit` r=185 (3 slots: character/realm/skill) · `wheel-outer-orbit` r=264 (≤9 slots) · `thien-co` collapsed 1388/856/268/52 → open 1296/140/360/640 · `quest-tracker` 1232/872/424/48 · `auto-farm` inside top-bar utilities.
- **FAMILIES**: dao-luan-center/node, building-plaque, surface-l-drawer, resource-pill, avatar-frame, identity-plate, icon-button-utility, seal-chip.
- **INTERACTION**: portrait click/Alt+M opens wheel (sweep anim per slot), Esc/close; hotspots → `BuildingDetailPopover` → panel.
- **OVERFLOW**: wheel slots distribute on outer orbit w/ 180/n offset; ≥10 slots → second tier spacing (cap by scope list).
- **A11Y**: aria-expanded on trigger/drawer, wheel slots are buttons w/ labels, Esc closes, focus returns.

## Scene 04 — Character `imperial-scroll`

- **PURPOSE**: identity, realm summary, combat power, 5 main attributes (+allocate), talents, Ngũ Hành, derived stats.
- **OWNED**: stats/talents/elements/power — NOT meridian/body/technique/skill (live elsewhere).
- **FULL-PRODUCT**: titles/sect fields RESERVED. **BETA**: all owned content visible.
- **KEPT**: portrait+wheel center-left, stat columns, Chi Tiết drawer.
- **CORRECTED**: no Môn Phái/Danh Hiệu; Ngũ Hành % = real element affinities.
- **REGIONS** (inside content grid): `identity-header` 288/176/1244/84 (figure + name + realm + power plaque) · `talent-seals` 288/268/1244/88 · `figure+wheel` 288/368/400/418 · `main-stats` 704/368/560/418 (5 stat rows + allocate + MAX) · `element-summary` 1280/368/252/200 (5 discs + %) · `derived-stats` 1280/576/252/210 · `chi-tiet-drawer` overlay 1140/96/404/800 (toggle).
- **FAMILIES**: section-plaque, list-row, seal-chip (talents), avatar-frame, entity-bar (stat bars), existing el-formation-* wheel assets.
- **A11Y**: stat allocate buttons labeled; element discs have text labels, not color-only.

## Scene 05 — Realm `imperial-scroll`

- **PURPOSE**: realm ladder (18 tầng), cultivation progress, rate/ETA, passive, breakthrough + requirements.
- **OWNED**: realm/level/cultivation/breakthrough — body progression does NOT live here.
- **FULL-PRODUCT**: post-ceiling realms exist architecturally — render stops at release ceiling (`betaRealmLadderNodes`, `betaNextRealmSurfaceFor` → null = no teaser).
- **KEPT**: vertical ascent node track over vista-inside-scroll, right detail card.
- **CORRECTED**: stat grid = real realm passive rows; ladder rungs = canonical list (mortal + release-window realms).
- **REGIONS**: `ascent-map` 288/176/812/610 (vista + 18-node path, bottom realm track) · `realm-rail` 1116/176/416/610: realm card (icon, Tầng n/18) · progress bar · rate/ETA rows · passive list · `requirements` block · `breakthrough-cta` 1116/730/416/56.
- **FAMILIES**: rune-node (18 nodes + realm rungs), entity-bar (cultivation), seal-chip (requirements), button-ceremonial, section-plaque.
- **INTERACTION**: node = inspect level state (locked/current/complete); CTA fires `realmAdvanceOps`; at ceiling no CTA tease.
- **OVERFLOW**: passive/requirement lists scroll inside rail (scrollfade).

## Scene 06 — Technique `imperial-scroll`

- **PURPOSE**: the character's CURRENT active technique — grade, effects, rank progress, upgrade.
- **OWNED**: active technique only; NO way browsing (Sword/Spell/Body tabs = invalid IA).
- **FULL-PRODUCT**: multiple techniques/grades exist in domain; Tàng Kinh Các lore = separate surface.
- **KEPT**: technique card left, artifact centerpiece, grade track, upgrade compare right.
- **CORRECTED**: grade track labels = technique grades (not realm names); effects from real technique data.
- **REGIONS**: `tech-card` 288/176/400/610 (name, Phẩm chip, effects, desc) · `artifact-vista` 704/176/448/480 (content illustration — excluded art; frame only) · `grade-track` 288/668/864/118 (N grade nodes horizontal, dao-luan-node family) · `upgrade-panel` 1168/176/364/610 (compare stats, material rows, stone cost, CTA).
- **FAMILIES**: frame-m-modal card, dao-luan-node (grade track), seal-chip (rank/materials), button-ceremonial.
- **INTERACTION**: grade node click = inspect; upgrade CTA gated w/ reasons.

## Scene 07 — Skill `imperial-scroll`

- **PURPOSE**: active way's skill tree — pre-commitment shows Ngũ Hành initiation; post-commitment shows element branch.
- **OWNED**: skill tree, role grammar (Basic/Special/Ultimate/Passive), insight currency, upgrades.
- **FULL-PRODUCT**: ultimate role exists (hidden beta); other ways' trees exist architecturally.
- **BETA**: `betaCombatRolesFor`/skill-domain models — committed element only.
- **KEPT**: radial tree (core + orbiting branch nodes), left way/element card, right detail.
- **CORRECTED**: real node set + costs from skill read-models; insight counter in header.
- **REGIONS**: `way-card` 288/176/212/610 · `element-tabs` 516/176/640/48 (hidden once committed) · `tree-canvas` 516/232/640/470 (center node + orbit positions) · `mode-tabs` 516/708/640/44 (tree/detail) · `detail-panel` 1172/176/360/610 (role tag, Lv n/N, current/next, costs, upgrade CTA) · `active-arts` bottom strip optional.
- **FAMILIES**: rune-node (branch), dao-luan-node (core), list-row (arts), button-standard/ceremonial, tab-seal.
- **A11Y**: tree nodes keyboard-focusable (roving), edge state mirrored by text.

## Scene 08 — Body `imperial-scroll`

- **PURPOSE**: Luyện Thể → Bát Mạch → Chu Thiên progression.
- **OWNED**: 3 chapters (body_refinement / meridian / zhou_tian), tiers, invest.
- **FULL-PRODUCT**: Nghịch Chu Thiên = DISCOVERY-HIDDEN sub-state; future chapters append.
- **KEPT**: chapter rail, central figure + meridian orb ring, tier chips, right detail.
- **CORRECTED**: orb labels = real meridian/page names; requirements = real currencies.
- **REGIONS**: `chapter-rail` 288/176/132/610 (3 nav-seal-vertical) · `figure-focus` 436/176/640/520 (silhouette + 8-orb ring) · `tier-chips` 436/704/640/56 · `detail-panel` 1092/176/440/610 (stats gained, requirements rows, invest CTA).
- **FAMILIES**: nav-seal-vertical, dao-luan-node (orbs), seal-chip (tiers), list-row (requirements), button-ceremonial.
- **A11Y**: meridian orbs labeled by name not position-only.

## Scene 09 — Inventory `imperial-scroll`

- **PURPOSE**: bag — Equipment / Material / Pill sections.
- **OWNED**: 3 categories, slots, capacity, sort/filter, item detail.
- **FULL-PRODUCT**: future categories RESERVED; no technique category.
- **KEPT** (from R16 grammar): tab row + dense grid + capacity footer.
- **CORRECTED**: categories = real 3; slots use slice-free SlotView w/ rarity tint.
- **REGIONS**: `category-tabs` 288/176/640/44 · `grid-tools` 1180/176/352/44 (sort/filter) · `slot-grid` 288/232/1244/520 (cells ~84px, gap 8) · `capacity+actions` 288/760/1244/48 · `item-detail` popover anchored.
- **FAMILIES**: tab-seal, SlotView (existing slot art), frame-xs-tooltip, button-compact.
- **OVERFLOW**: internal pagination/scroll per BagGrid pattern.

## Scene 10 — Exploration / Sơn Hà Đồ `imperial-scroll`

- **PURPOSE**: zone → chapter → stage → battle mode.
- **OWNED**: 1 zone `thanh_van`, 3 chapters ×10 stages (boss on 10), stage detail, 4 modes.
- **FULL-PRODUCT**: multi-zone rail RESERVED; chest milestones RESERVED.
- **KEPT**: painted map bands w/ numbered nodes + boss seals, right detail, mode radios.
- **CORRECTED**: mode labels manual/repeat/progress/perfect_farm; no attempt counter.
- **REGIONS**: `zone-rail` 288/176/140/560 (1 zone card now; reserved for more) · `chapter-tabs` 444/176/680/44 · `map-canvas` 444/228/700/524 (3 chapter bands ~168h each: 10 nodes + boss node, connecting path — **painted substrate = gameplay/world art pipeline, Ruling 04**; UI owns chrome only: frame/route-lines/nodes/markers/labels/masks/edge-treatment) · `detail-panel` 1160/176/372/610 (stage info, enemies, rewards, power compare, 4 mode radios, `Khiêu Chiến` CTA) · `progress-footer` 288/792/1244/56 (zone 12/30 + milestone marks — chests RESERVED).
- **FAMILIES**: stage-node, boss-seal, rune-node (path), list-row (enemies/rewards), tab-seal, button-ceremonial.
- **INTERACTION**: locked nodes → reason tooltip; mode pick persists `battleRunMode`; start → combat.

## Scene 11 — Alchemy `imperial-scroll`

- **PURPOSE**: recipe → herb variant → fuel/stone cost → preview → brew job queue.
- **OWNED**: recipes (current realm, non-retired), variants, jobs (cap = building level).
- **FULL-PRODUCT**: recipe categories RESERVED; sibling professions RESERVED.
- **KEPT**: list-left/detail-right, queue strip, grade header.
- **CORRECTED**: no quantity stepper, no fast-forward, no paid slot unlock; outcome = guaranteed + chance%.
- **REGIONS**: `recipe-list` 288/176/380/540 (scrollfade) · `focal-cauldron` 684/176/420/360 (UI scene prop — `alchemy-cauldron-prop`, Ruling 02; decorative only, no gameplay identity) · `detail-panel` 1120/176/412/610 (preview, herb variants radio, costs, brew CTA, block reason) · `job-queue` 288/724/824/118 (job cards + cancel; slots from building).
- **FAMILIES**: list-row, section-plaque, seal-chip, button-ceremonial, entity-bar (job progress), frame-s-slot (pending) for material chips.
- **A11Y**: variants = radiogroup; block reason as text under CTA (exists today).

## Scene 12 — Equipment / Khí Đường `imperial-scroll`

- **PURPOSE**: paperdoll + operations (enhance/wash/refine/dissolve/decompose) + bag.
- **OWNED**: 6 slots (helmet/necklace/ring/weapon/armor/boots), 5 ops (beta: enhance+dissolve), item detail, equipped enhance levels.
- **FULL-PRODUCT**: hidden tabs preserved; set bonuses RESERVED.
- **KEPT**: ops rail, paperdoll figure w/ socket ring, item card, grid.
- **CORRECTED**: 6 sockets; op labels = domain names.
- **REGIONS**: `ops-rail` 288/176/132/610 (5 nav seals; hidden tabs absent) · `paperdoll` 436/176/380/610 (figure + 6 sockets) · `item-card` 832/176/330/610 · `bag-grid` 1178/176/354/610 (compact grid + filter) · `stats-strip` 436/794/1096/52 (RESERVED secondary).
- **FAMILIES**: nav-seal-vertical, frame-s-slot (equip sockets — released P0, Ruling 03), list-row, section-plaque, button-standard/ceremonial.
- **INTERACTION**: socket select → item card + op actions; locked slot = silhouette not "empty".

## Scene 13 — Combat `world`

- **PURPOSE**: turn battle — battlefield dominant ≥75%.
- **OWNED**: top bar (zone•stage, progress, exit), AI panel (5 strategies), right skill dock (role slots + manual toggle), turn strip (ATB + round/PC limit), battle log, player HUD (canvas), result/intro/countdown/exit-confirm modals.
- **FULL-PRODUCT**: ultimate slot, sword orb picker, Ẩn emblem — hidden; companion party UI.
- **KEPT**: HUD at edges, circular skill buttons right, portrait strip top-center, AI card left.
- **CORRECTED**: progress = spawned/total + round counter; NO speed control; exit → confirm modal.
- **REGIONS**: `top-bar` 0/0/1672/56 (z15) · `turn-strip` 436/64/800/96 center · `ai-panel` 16/140/228/280 · `skill-dock` 1540/80/132/auto (orbs 96 + captions, vertical gap 12) · `player-hud` canvas-left 16/72/330/130 (HP/MP/Thế pips) · `battle-log` 1330/620/326/280 · `modals` centered · `enemy-bars` canvas over actors.
- **FAMILIES**: skill-orb-frame, turn-token, entity-bar, avatar-frame, frame-m-modal, button-compact, combat-AI = list-row variant.
- **A11Y**: dock buttons labeled w/ role+key, awaiting-choice pulse = gold (not color-only — outline), exit confirm focus-trapped.

## Scene 14 — Tribulation `world`

- **PURPOSE**: sequential chapter trial — tank strikes + mind questions → result.
- **OWNED**: chapter tracker (dynamic chaptersTotal), HP (Đạo Tâm), strikes, question card + timer, result.
- **FULL-PRODUCT**: future chapter types append; hidden tribulations discovery-gated.
- **KEPT**: top chapter medallions, centered title band, bottom HP cluster, question card.
- **CORRECTED**: question card = right-side (ref) w/ dynamic answers; left status card shows timer/strikes; NO auto/skip/nav.
- **REGIONS**: `chapter-tracker` 536/44/600/66 (N medallions + connectors) · `title-band` 436/120/800/80 · `status-card` 60/560/420/220 · `mind-card` 1090/200/522/380 (question + answers grid + timer ring 96) · `hp-cluster` 616/736/440/84 · `result` centered 536/340/600/220.
- **FAMILIES**: dao-luan-node (chapter medallions), surface-m-panel (cards), timer-ring, button-standard (answers), entity-bar (HP).
- **A11Y**: answers keyboard-selectable; timer also rendered as text seconds.

## Scene 15 — Victory `ceremonial-scroll`

- **PURPOSE**: reward summary + refight/continue (+auto countdown variant).
- **REGIONS** (inside ceremonial envelope): `title` flourish+text y140-240 · `rewards` 526/280/620/120 (slot row) · `growth` 526/420/620/140 (reward-line cards — real kinds only) · `actions` 526/690/620/80 (Thử Lại + Tiếp Tục).
- **INTERACTION**: manual → both CTAs; auto → countdown on refight, continue hidden.
- **BETA note**: companion-intimacy growth row never renders.

## Scene 16 — Defeat `ceremonial-scroll`

- **PURPOSE**: hint + partial rewards + retry/return (countdowns).
- **REGIONS**: same envelope; `title` cinnabar variant · `hint` 526/260/620/80 · `rewards` 526/360/620/110 (if any) · `actions` 526/690/620/80 (danger retry + return w/ 10s label).
- **INTERACTION**: repeat-mode auto-retry 3s; any-click cancels; return always present.

## Scene 17 — Settings `imperial-scroll`

- **PURPOSE**: real settings only.
- **OWNED**: language chips, UI scale, audio 3-channel sliders, save ops (save/reload/export/import/reset), account (guest upgrade/logout/abandon), feedback, updates (electron), build info.
- **FULL-PRODUCT**: display/graphics section RESERVED; no invented controls.
- **KEPT**: left rail + sections grammar; sliders/toggles/dropdowns styled to family.
- **CORRECTED**: footer actions = per-action confirm (no global save); dropdowns → chip groups (locale/scale) except where a real select exists.
- **REGIONS**: nav rail (shared) · `sections-grid` 288/176/1244/610 two-column flow (section-plaque headers + option rows) · `confirm-modal` overlay.
- **FAMILIES**: nav-seal-vertical, section-plaque, list-row, slider-track+thumb, toggle-track, seal-chip, button-standard/danger.

## Scene 18 — Quest `imperial-scroll`

- **PURPOSE**: quest list + detail (objectives, progress, rewards, claim).
- **OWNED**: cadence `once` (beta), conditions (collect/kill), turn-in shortfall, claim.
- **FULL-PRODUCT**: daily cadence + categories RESERVED.
- **KEPT**: left list + right detail + objective checklist + reward row.
- **CORRECTED**: tabs = cadence groups only; CTA = claim (no deep-link yet — RESERVED).
- **REGIONS**: `group-tabs` 288/176/640/44 · `quest-list` 288/232/620/540 (rows ~64h) · `detail` 924/176/608/610 (type seal, objectives, rewards, claim CTA, shortfall line) · `empty-state` centered.
- **FAMILIES**: tab-seal, list-row, seal-chip, button-standard/ceremonial, entity-bar (progress).

## Cross-scene rules

- All scroll scenes share nav rail + header/footer safe areas; scene rail items = real panel ids only (hidden panels never render a rail entry).
- `scrollfade` masks, never visible scrollbars (scrollbar HOLD).
- 1366×768: scroll envelope → 92%×90% → padding shrinks (24→16), nav rail collapses to icon-only 96w, detail panels reduce to 340w min; no primary overlap. 1600×900: envelope scales proportionally (95% of canonical margins).
