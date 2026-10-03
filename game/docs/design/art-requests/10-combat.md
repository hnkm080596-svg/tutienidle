# Art Requests — Scene 10 · Combat / Turn Battle (Huyền Kim)

One row per art asset Minh must draw or confirm. Every scaffold surface marked `class="art-needed"` carries the same `data-art-id` shown here.

Reference: `game/docs/design/references/huyen-kim/scenes/10-combat.jpg`.
Design space: 1672×941 (runtime 1280×720, ×0.7655). Scene regions per `huyen-kim-scene-layout-spec.json` **scene 13 "Combat"** (ref file is named `10-combat.jpg`; spec `scene_id "10"` is Exploration). World shell, full-bleed vista.
Palette anchors: ink `#101718` · jade `#315f55` · muted gold `#b99a55` · ivory paper.

## Region → component map

| Spec region (scene 13) | Box (design px) | Component |
|---|---|---|
| combat-top-bar | 0/0/1672/56 z15 | `CombatTopRail` → `CombatTopBar` |
| turn-strip | 436/64/800/96 z14 | `CombatTurnRail` → `TurnOrderStrip` |
| ai-panel | 16/140/228/280 z12 | `CombatAiRail` → `CombatAiPanel` (surface-m-panel) |
| skill-dock | 1540/80/132/560 z12 | `CombatActionDock` → `CombatSkillDockPanel` → `TurnCombatSkillBar` |
| player-hud | 16/72/330/130 z11 | `PlayerHudLayer` — **canvas** (DOM parity target, flagged below) |
| enemy-bars | over-actors z8 | enemy `entity-bar` — **canvas** |
| battle-log | 1330/620/326/280 z11 | `CombatLogFeed` → `BattleLogPanel` |
| modals | 436/220/800/500 z30 | `CombatModalLayer` (intro, countdown, exit-confirm, result) |
| battlefield | 0/0/1672/941 z0 | Phaser canvas — gameplay art, excluded |

## Art inventory

| # | Component | data-art-id | Design-px size (w×h) | Type | Visual description (per ref) | Layer / stack order |
|---|-----------|-------------|----------------------|------|------------------------------|---------------------|
| 1 | `CombatTopRail` → `CombatTopBar` | `combat-title-plaque` | ~314×44 (runtime 240×34) | chrome | Ornate golden swallowtail stage-banner plaque behind the zone·stage title ("Chương 3 · Linh Vân Sơn / 3-8 Tuyết Phong Đài") | Top bar, under title text |
| 2 | `CombatTurnRail` | `combat-turn-rail-band` | ~810×96 region | chrome | Dark capsule/scroll rail band behind the ATB turn chips (ref's ornate dark band with gold edge) | turn-strip region, under chips |
| 3 | `TurnOrderStrip` items | `combat-turn-portrait` (suggestion) | ~44×44 | prop | Ref shows character/enemy portrait medallions per upcoming actor; runtime renders generic `turn-token` + actor name | Inside each turn-chip, behind gauge |
| 4 | `PlayerHudLayer` | `combat-player-plate` (suggestion) | 330×130 | prop | Player plate: avatar ring, HP/MP bars, resource sub-bars, buff strip, Thế pips — canvas-drawn today per audit EXACT; DOM-parity surface is a target, not built | player-hud region |
| 5 | Enemy `entity-bar` | `combat-enemy-plate` (suggestion) | ~150×30 per actor | prop | Over-actor enemy HP plates + damage numbers — canvas-drawn today per audit EXACT | enemy-bars region over actors |
| 6 | Phaser battlefield | `combat-vista` (suggestion) | 1672×941 | vista | Battle vista ink-wash background per stage — **gameplay canvas, excluded from DOM scaffold** | z0 under all DOM |

## Covered by delivered chrome (no drawing needed)

| Component surface | Delivered asset |
|---|---|
| AI panel shell | `surface-m-panel` via `InkNineSlice` (ready) |
| AI option rows | `list-row` (ready) |
| Turn chips | `turn-token` (ready) |
| Skill orbs | `skill-orb-frame` ring in `TurnCombatSkillBar` (ready) |
| Auto/manual toggle | `toggle-track` + `slider-thumb` (ready) |
| Victory/defeat ribbons | `ceremony-ribbon` (ready) |
| Exit / modal CTAs | `GameButton` family (ready) |

## Audit blocks NOT scaffolded

| Ref element | Verdict | Action |
|---|---|---|
| x2 battle-speed chip (top-right) | INVALID — no battle-speed feature | Not scaffolded |
| Q/W hotkey badges on skill orbs | RESERVED (unverified) | Not scaffolded |

## Flagged ambiguities — coordinator decisions needed (not self-decided)

| Ref element | Finding | Action taken |
|---|---|---|
| Player HUD (avatar + HP/MP + buffs, top-left) | Audit EXACT but implementation is `PlayerHudLayer` **canvas**; spec says "DOM parity target". A parallel DOM plate would duplicate authoritative canvas state. | Kept canvas; suggestion row only. Needs coordinator call on DOM parity scope. |
| Enemy HP plates + damage numbers | Audit EXACT, canvas-rendered (`enemy-bars` region "over actors"). | Kept canvas; suggestion row only. |
| AI panel visibility | `CombatAiPanel` exists in DOM (5 strategies radiogroup) but doesn't render in all battle states — in capture it's absent during early fighting. Placement left-mid matches spec; verify intended visibility gating vs ref (ref shows it always). | Kept canonical gating; flagged. |
| Ref round counter "Hiệp 2/20" inside stage banner vs our `TurnOrderStrip.__round` | Canonical round label lives on the turn strip (`Hiệp n/m`); ref draws it under the stage banner. Kept canonical location. | Flagged — if ref-fidelity requires the counter inside the top bar, that's a `TurnOrderStrip` → `CombatTopBar` data move. |
| Battle vista | Spec marks battlefield "Gameplay art"; Phaser canvas owns it. | Excluded; vista row is suggestion only. |
