# M-UI-OVERHAUL — "Hệ Thống" Full Interface Overhaul

Status: `DRAFT — awaiting coordinator spec-review`
Mission: `M-UI-OVERHAUL` · Date: 2026-09-23 · Owner: agent-authored under coordinator design authority
Base: `origin/p7/truc-co` · Supersedes: the *scope* of M-UI-SYSTEM (merged PR #8). The M-UI-SYSTEM
scaffold (`system-theme.css`, `Sys*` primitives, `variant="system"`, `useSystemRimAuthority`,
`systemThemeBoundary.test.ts`) is **kept and extended**, not replaced — §3.1.

**Track note (coordinator update, 2026-09-23):** this is a FULL CREATIVE OVERHAUL, not a
scaffold-extension task. All design constraints from M-UI-SYSTEM are lifted: the spec defines a
new flagship design language, old UI chrome assets may be dropped (UI assets only — game art,
character sprites, painted backgrounds, and all game logic stay). The PR is STANDALONE — the
coordinator will not merge it; the user merges personally when satisfied.

## 1. Intent

Restyle **every DOM-rendered interface surface** of the game into one authored "xuyên không hệ
thống" language — not a skin on a few panels, but the game's entire chrome: panels, drawers,
modals, toasts, tooltips, HUD, combat overlays, radial menu, login, character creation, boot,
error and transition screens. M-UI-SYSTEM skinned ~6 surfaces; this mission covers all ~80
components enumerated in §6.

The fiction stays and is sharpened: the ink-wash world (scene art, dong phủ, Phaser canvas,
painted backdrops, character/item art) is the *world*; every interface surface is the *System* —
the holographic console that carried the player across worlds. The two visual languages
deliberately do not blend, and the System is now **the only interface language**: ink-wash chrome
(paper-scroll nine-slice frames, ornate seal borders, drawer fills) is retired as UI chrome,
surviving only as world art.

Design ambition: flagship-quality — the visual identity of the project, not a reskin pass.

### 1.1 Design references (researched)

| Reference | Link | What we take |
|---|---|---|
| **Solo Leveling "System" windows** — the genre anchor; fan-built implementation guide with extracted palette/type/glow specs | https://github.com/pradeep583/Solo_levelling/blob/main/SOLO_LEVELING_UI_GUIDE.md | Cyan/azure hologram palette over near-black blue (`#00d4ff`-class accent, `rgba(5,20,40,.95)` floors); layered glow built from stacked borders at decreasing opacity; heavy letterspaced headers; monospace-flavored numeric readouts; scanline overlay as texture, not decoration |
| **Cyberpunk chamfered-corner technique** — CSS art recipe | https://codefronts.com/components/css-glowing-border-buttons/cyberpunk-sci-fi-glowing-corner-border-button/ | `clip-path` chamfered geometry (cut corners instead of rounded rects — the single strongest "not a webpage" signal); `drop-shadow()` glow that follows the clipped shape exactly (box-shadow can't); corner brackets that snap outward on hover; scanline flicker across the face |
| **Arknights UI/UX analysis** — flat-sci-fi hierarchy discipline | https://ldt.indienova.com/indie-game-development/arknights-ui-ux-design/ | Extreme hierarchy contrast (one bright accent against disciplined neutrals); backdrop-blur stratification so a covered page stays "visible beneath" its overlay — depth comes from layering, not ornament; single-family typography with strict per-role weight/spacing rules; the interface is diegetic — the player is operating the System's console |

## 2. Design language — "HỆ THỐNG" v2

### 2.1 Visual grammar

**Geometry.** Chamfered octagon cuts replace rounded/painted frames: primary cards get a
`clip-path` polygon with 2–4 cut corners (asymmetric cuts allowed — e.g. top-right + bottom-left).
Hairline 1px strokes everywhere; L-corner brackets (`--sys-corner-*`, kept) only on primary
consoles and dialogs. Interactive edges may carry a "pin notch" (a small diamond mid-edge,
`::before`/`::after` shapes only — no images).

**Depth tiers** (the Arknights lesson — depth from stratification, not ornament):

| Tier | Name | Surfaces | Recipe |
|---|---|---|---|
| T0 | World | Phaser canvas, scene art, painted backdrops, character/item art | untouched ink |
| T1 | Scrim | modal/overlay dim layer | `--sys-scrim` rgba(3,7,14,.62) + `backdrop-filter: blur(6px)` — covered page stays legible beneath |
| T2 | Console | overlay panels, dialogs, drawers | opaque floor + translucent tint + grain + scanlines (the existing `.sys-surface` recipe, kept) |
| T3 | Chrome | header rails, tab rails, toolbars inside consoles | hairline-ruled bands, slightly raised |
| T4 | Readout | stat rows, tags, bars, slots, cards-in-panel | flat/inset widgets with own border grammar |
| T5 | Ephemeral | toasts, tooltips, announcements, countdowns | sharpest, brightest, most animated; never corners+scanlines full recipe — they must read at a glance |

**Domain accents.** One spine (cyan/azure) + scoped per-domain accent via `--sys-accent` remap
inside the opted-in subtree (boundary §3.3-5 — re-tints on sys selectors are legal): realm/cultivation
`--sys-azure`, alchemy/pill `--sys-success`-family jade, artifact/treasure `--sys-violet`,
combat `--sys-danger`-leaning amber-red reserved for damage/defeat, utility stays cyan. The accent
may tint borders, glows, bracket glyphs and the header energy line — never body text (contrast, §7).

### 2.2 Typography

- Display/headers/eyebrows/numerals: **Chakra Petch** (kept — Vietnamese subset confirmed,
  loaded inside `system-theme.css`; fallback stack Be Vietnam Pro → Segoe UI → system-ui).
- Body: **Be Vietnam Pro** unchanged (`--font-body`).
- Readouts: `tabular-nums` + display face — the digital-register look without a second font
  family to maintain.
- Eyebrows: bracketed uppercase `[ THÔNG SỐ ]` — brackets emitted by CSS `::before/::after`
  (kept from v1; locale text stays punctuation-free).
- Discipline (Arknights): exactly two type roles per surface — one display voice (headers,
  eyebrows, numerals) and one body voice; no third decorative face.

### 2.3 Motion language

Signature: **light traveling along edges**, the System "waking" a surface.

| Effect | Mechanism | Perf class |
|---|---|---|
| Rim light-line (kept) | `.sys-rim` conic-gradient ring masked to the border, `@property --sys-rim-angle` spin | repaint/frame — **still capped at ONE live rim per screen** via `useSystemRimAuthority` |
| Edge trace (new) | `.sys-trace` — bright band sweeping a single edge on open (`transform: translateX`) | compositor-only; runs once per open |
| Boot build (new) | `.sys-boot` — card materializes via `clip-path` inset wipe + `opacity`, staggered: scrim → chassis → content | compositor-only; one-shot per open |
| Scan sweep (kept) | `.sys-sweep` sheen band | compositor-only; ≤2 concurrent |
| Scanlines (kept) | `.sys-scanlines` repeating gradient + faint flicker | near-static |
| Bar shimmer (kept) | `.sys-bar__fill` background-position slide | cheap repaint |
| Hover bloom (kept) | shadow/filter transition | transition only |
| Corner snap (new, from ref 2) | corner brackets translate outward 2–3px on `:hover`/`:focus-visible` | transition only |
| Header energy line (new) | thin bar under header rail, `background-position` drift | cheap repaint; may be disabled under `.sys-fx-low` |

Perf budget (hard): only `transform`, `opacity`, `background-position`, registered `@property`
angles animate. At most 1 live rim, ≤2 concurrent sweeps, boot builds staggered ≥40ms when panels
open together. `.sys-fx-low` and `@media (prefers-reduced-motion: reduce)` both kill every
animation while keeping the static skin — corners, single border, one static glow remain.

### 2.4 Chrome vocabulary (per element)

| Element | System form |
|---|---|
| Primary console (overlay panels, dialogs) | T2 recipe + chamfer clip-path + L-corners + rim-eligible + boot build on open |
| Header rail | eyebrow + display title + tabular readout slot + actions; hairline base rule + energy line |
| Buttons | chamfered clip-path + hairline + hover bloom + corner snap; `--sys-accent` per domain |
| Tabs | rail + sliding underline energy indicator (transform) |
| Bars | `SysBar` / `Bar variant="system"` — segmented gradient + shimmer + label |
| Tags/chips | `SysTag` bracketed chip + glyph (shape carries tone) |
| Stat rows | `SysStat` label/value + tabular numerals |
| Slots/cards | T4 inset widget: 1px line, corner notch, icon art untouched |
| Tooltips/toasts/announcements | T5: small chamfered card, single accent edge, no scanlines |
| Radial menu | ring of sys chips over a dim+blur lens; center badge |
| Boot/gate screens | full T2 console over kept painted art; stepper = segmented progress rail |

## 3. Architecture

### 3.1 Keep-and-extend decision

The M-UI-SYSTEM scaffold is **kept as the chassis**: `--sys-*` token contract, `.sys-surface`
recipe, `Sys*` primitives, `variant="system"` on `Bar`/`OverlayPanel`, `useSystemRimAuthority`,
and the mechanical boundary guard all remain — they are proven and boundary-tested. The overhaul
extends them with: the chamfer geometry layer, boot build + edge trace + energy line + corner
snap effects, domain-accent remaps, the header-rail recipe, and per-tier recipes for T3/T4/T5.
Justification: rebuilding the primitive layer would re-derive what already passes guards; the
missing quality is in grammar coverage and surface adoption, which is additive work.

`system-theme.css` remains the single stylesheet for the language (one canonical `--sys-*`
`:root` site). It will grow; that is expected — the file is the design system.

### 3.2 The ink layer's role after overhaul

`theme.css` and the ink primitives are **not deleted at architecture level** — they remain the
world layer (scene art styling, painted backdrops, art-bearing elements) and the safe-degrade
fallback. What changes: ink **UI chrome** (nine-slice panel surfaces, ornate frames, ink-drawer
fills, seal-corner dialog frames) loses every UI consumer. `InkNineSlice`/`InkWashBackdrop`
survive only where they render art (combat victory/defeat backdrops, onboarding background art —
see §6 "stays painted" column). Once the last wave lands, `InkNineSlice` has zero UI consumers;
its removal is a named cleanup task, not a requirement of this mission.

### 3.3 Revert / boundary contract (carried from v1, tightened where needed)

1. System styling is reached only through `.sys-*` classes, `Sys*` primitives, or
   `variant="system"` props — same three seams.
2. `system-theme.css` defines `--sys-*` tokens only; never redefines `--ink-*`/`--gold-*`/
   `--paper-*`/`--surface-*`/`--chrome-*`/`--frame-*`/`--fx-*`/`--scrim*`/`--text-*`/
   `--rank-*`/`--grade-*`/`--el-*`/`--bar-*`.
3. Every ordinary selector in `system-theme.css` anchored to `.sys-` / `--system` (at-rule
   allowlist unchanged). Selectors nested in `@media`/`@supports` still need the anchor.
4. Shared components gain `variant` props, never global restyles — **with one scoped
   exception**: in the final polish wave, `GameButton`'s default variant may flip to `system`
   once every consumer surface is adopted (§9 records the decision point).
5. Scoped `--sys-*` re-assignments inside opted-in subtrees remain legal (domain accents).
6. Revert invariant (safe degrade): deleting the `system-theme.css` import leaves every surface
   functional and legible. Full overhaul raises the stakes — the guard test gains a rule that
   every adopted surface must keep working classless (base markup sane without the skin).

`systemThemeBoundary.test.ts` is extended, not rewritten: same 4 rules + the adoption-matrix
check in §6.4.

## 4. Effects contract (perf budget — hard)

1. Animate only `transform`, `opacity`, `background-position`, registered `@property` angles.
2. ONE `.sys-rim--live` per screen via `useSystemRimAuthority` — claim set expands to every
   sys console (all `variant="system"` overlays, all `SysModalBase` dialogs, both drawers);
   claim = become visible-primary (`open`, `characterOverlayOpen`), release on hide/unmount,
   promote on re-activation. Non-claimant surfaces keep the static rim.
3. ≤2 concurrent `.sys-sweep`; boot builds staggered when surfaces open together.
4. `.sys-fx-low` subtree/root switch kills all sys animation (independent of OS setting).
   Wiring it to a Settings toggle IS in scope this time (plan Task 6).
5. `@media (prefers-reduced-motion: reduce)`: every animation `none`; static skin retained.
6. Invisible effects cost nothing — animation declarations live only on visible/active states.

## 5. i18n & content

- All strings through `useI18n()` (P16); keys are added, never removed or re-keyed.
- Brackets around eyebrows stay CSS glyphs — locale text unpunctuated.
- Vietnamese must be exercised in P14 evidence on the heaviest new surfaces (auth card title,
  creation stepper labels, panel eyebrows, combat result titles) at 90–125% ui-scale, with
  Chakra Petch both loaded and network-blocked.
- Comments in code: ASCII English (P15).

## 6. Surface census + adoption matrix

Complete inventory (86 files surveyed). "Path" = the migration move; "stays painted" marks art
that keeps ink/none — only chrome changes.

### 6.1 Already adopted (M-UI-SYSTEM, kept)

| Surface | File | State |
|---|---|---|
| Left drawer chrome | `components/layout/LeftPanel.vue` | `.sys-surface`+corners+rim+scanlines, rim claimant `hud-left` |
| Right drawer chrome | `components/layout/RightPanel.vue` | `.sys-surface`+corners+scanlines |
| Nhân Vật interior | `components/panels/CharacterPanel.vue` | SysStat/SysTag/sys-eyebrow (upgrade to v2 grammar) |
| Detail card | `components/panels/CharacterDetailCard.vue` | `.sys-surface` |
| Cảnh Giới | `components/panels/RealmPanel.vue` | `OverlayPanel variant="system"` + `Bar variant="system"` |
| Node tree interior | `components/panels/skill-path/NodeTreePanel.vue` | `.sys-surface` recipe + SysTag routes |
| Confirm dialog | `components/common/ConfirmModal.vue` | on `SysModalBase` — every caller inherits |
| Shared variants | `primitives/Bar.vue`, `common/OverlayPanel.vue` | `variant="system"` prop exists |

### 6.2 OverlayPanel consumers → `variant="system"` (+ v2 chrome)

| Surface | File | Path | Notes |
|---|---|---|---|
| Function overlay host | `components/layout/FunctionOverlayPanel.vue` | `variant="system"` once | covers all 8 hosted interiors' chrome: Sản Xuất, Cài Đặt, Đan Phòng, Khí Đường, Tàng Kinh Các, Truyền Tống, Đồng Đội, Thương Nhân |
| Kỹ Năng | `components/panels/SkillPathPanel.vue` | `variant="system"` + header rail | header-actions insight readout → tabular |
| Nhiệm Vụ | `components/panels/QuestPanel.vue` | `variant="system"` | |
| Pháp Bảo | `components/panels/ArtifactPanel.vue` | `variant="system"` | violet domain accent |
| Đồng Đội | `components/panels/CompanionPanel.vue` | `variant="system"` | |
| Quán Khí | `components/panels/QuanKhiPanel.vue` | `variant="system"` | |
| Trận | `components/panels/TranPhapPanel.vue` | `variant="system"` | preview canvas inside stays DOM art, chrome sys |
| Breakthrough requirements | `components/common/BreakthroughRequirementPanel.vue` | `variant="system"` | |

### 6.3 Interior surfaces → sys grammar (inside adopted shells)

| Surface | File(s) | Path |
|---|---|---|
| Drawer interiors | `panels/InventoryPanel.vue`, `panels/BagGrid.vue`, `panels/bag-sections/*` (4), `panels/EquipmentPaperdoll.vue` | T4 widget recipe: slots/cards keep art, chrome re-styles |
| Skill-path interiors | `panels/skill-path/{NodeInspector,SkillPathList,SkillDetailView,SkillConnections,SkillRoleStrip,TechniqueBand,TechniqueSlotCard,NativeCoreDetail}.vue` | SysStat/SysTag/T4 rows; TechniqueSlotCard drops InkNineSlice |
| Realm interiors | `panels/realm/{BodyPerfectionSection,BodyRefinementSection,MeridianSection,ZhouTianSection}.vue` | stat rows + section eyebrows |
| Artifact interiors | `panels/artifact/{ArtifactOverview,ArtifactGradeSection,ArtifactPathCards,ArtifactExperienceBar}.vue` | violet accent remap |
| Khí Đường tabs | `panels/equipment-hall/{EnhanceTab,RefineTab,WashTab,DecomposeTab,DissolveTab}.vue` | T4 recipes |
| Đồng Đội tabs | `panels/worker-lodge/{ChieuMoTab,DuyenPhanTab,QuaTangTab}.vue` | T4 recipes |
| Function interiors | `panels/{ProductionPanel,VendorPanel,SettingsPanel,StageSelectPanel,PillRoomPanel,AlchemyView,ScripturePavilionPanel}.vue`, `panels/scripture/LoreCodex.vue` | header rail + T4; SettingsPanel gains `.sys-fx-low` toggle wiring |
| Build gate | `panels/BuildingConstructionGate.vue` | gate card → T4 |

### 6.4 Dialogs / modal-equivalents → `SysModalBase` or sys chrome

| Surface | File | Path |
|---|---|---|
| Offline summary | `common/OfflineSummaryModal.vue` | migrate to `SysModalBase` |
| Talent entitlement | `common/TalentEntitlementModal.vue` | migrate to `SysModalBase` |
| Lore codex reader | `panels/LoreCodexModal.vue` | `SysModalBase` (Teleport retained) |
| Tutorial | `common/TutorialOverlay.vue` | `SysModalBase` + stepper → segmented rail |
| Combat exit confirm | `game/combat/CombatExitConfirmModal.vue` | `SysModalBase` |
| Combat result | `game/combat/CombatResultModal.vue` + `CombatVictoryPanel.vue` + `CombatDefeatPanel.vue` + `RewardList.vue` | painted `InkWashBackdrop` **stays**; nine-slice chrome → sys card (victory cyan / defeat danger accent); rewards → sys rows |
| Combat pause | `game/combat/CombatPauseOverlay.vue` | sys chrome (keeps `role="dialog"` contract) |
| Save gate | `common/SaveIncompatibleScreen.vue` | T2 console; nested ConfirmModal already sys |
| Error screen | `common/ErrorScreen.vue` + `App.vue` `.boot-error` | T2 console, danger accent |
| World announcement | `common/WorldAnnouncementOverlay.vue` | T5 sys alert banner |
| Transition curtain | `game/PresentationTransitionOverlay.vue` | sys boot wipe (keeps lock/route semantics) |

### 6.5 Boot & onboarding → sys consoles over kept art

| Surface | File | Path |
|---|---|---|
| Loading | `common/LoadingScreen.vue` | sys boot pulse + segmented progress |
| Login (NHẤT NIỆM NHẬP ĐẠO) | `onboarding/AuthEntryScreen.vue` | painted `InkWashBackdrop` **stays**; nine-slice card → chamfered sys console; tabs → sys rail |
| Character creation (3 bước) | `onboarding/CharacterCreationScreen.vue` | backdrop **stays**; stepper → segmented rail; step cards → sys consoles |
| Menu primitives | `components/menu/{MenuBackground,MenuButton,MenuLogo}.vue` | **dead code** (zero consumers) — remove or leave dormant; recorded, not required |

### 6.6 HUD & ephemeral → T5/sys chrome

| Surface | File | Path |
|---|---|---|
| Tooltip | `common/Tooltip.vue` (+ `directives/tooltip`) | sys tooltip, drops InkNineSlice |
| Toasts | `common/ToastContainer.vue` | T5 sys toasts |
| Feedback log | `common/ActionFeedbackLog.vue` | sys feed rows |
| Badge | `common/NotificationBadge.vue` | sys chip (drops nine-slice frame) |
| Tab bar | `common/TabBar.vue` | sys rail + sliding underline (3 consumers: EquipmentHall, WorkerLodge, BagGrid) |
| Auto-farm indicator | `game/AutoFarmIndicator.vue` | sys status chip |
| Command wheel | `game/DongFuCommandWheel.vue` | sys radial: dim+blur lens + chip ring + center badge |
| Building popover | `game/BuildingDetailPopover.vue` | sys popover, drops InkNineSlice |
| Building hotspots | `game/HomeBuildingIcons.vue`, `game/DongFuScene.vue` | DOM overlay over canvas → sys "scan marker" rings on hotspots; building sprites stay art |
| GameButton | `common/GameButton.vue` | `variant="system"` per-surface during waves; default-flip decision point §9 |

### 6.7 Combat chrome → sys

| Surface | File | Path |
|---|---|---|
| Scene host | `game/combat/CombatSceneOverlay.vue` | layout unchanged; children adopt |
| Top bar | `game/combat/CombatTopBar.vue` | sys bar: eyebrow + tabular progress |
| AI panel | `game/combat/CombatAiPanel.vue` | sys radio group |
| Skill dock | `game/combat/CombatSkillDockPanel.vue` + `hud/TurnCombatSkillBar.vue` + `hud/CombatSkillSlot.vue` | sys dock + slots (cooldown mask readable on dark) |
| Battle log | `game/combat/BattleLogPanel.vue` | sys drawer + rows |
| Turn order | `game/combat/TurnOrderStrip.vue` | sys strip |
| Intro/countdown | `game/combat/CombatIntroOverlay.vue`, `CombatCountdownOverlay.vue` | T5 transient, display numerals |
| Tribulation | `game/tribulation/TribulationSceneOverlay.vue` | sys header rail + progress |

### 6.8 Stays painted / untouched (T0)

PhaserCanvas, MainScene, DongFuScene canvas, RouteMount; all sprite/art components
(`AtlasIdleSprite`, `EntitySpriteCanvas`, `DongFuBuildingSprite` art, `PlayerPortrait`,
character figure/meridian/element-wheel art, item icons, `ItemCardBody` art region, building
art, map art); `InkWashBackdrop` painted art where retained (auth, creation, victory, defeat).
`ErrorBoundary` and `EmptyState` get only minimal sys text chrome (they're error/empty frames,
not art).

## 7. Accessibility contract (hard)

1. Opaque floor under every `.sys-surface`: composite alpha ≥ .88 over the brightest scene
   (tribulation glow); body text ≥ 4.5:1, display text ≥ 3:1 — measured in P14, not eyeballed.
2. `:focus-visible` non-glow indicator ≥ 2px on every interactive sys control
   (`outline: 2px solid var(--sys-focus); outline-offset: 2px`); chamfered controls keep the
   outline (clip-path does not clip outlines — verify per control in P14).
3. No hue-only meaning: tone always pairs color + text/glyph/shape.
4. Scanlines under text, ≤ .04 alpha.
5. `--tap-min` unchanged; focus order unchanged; `role="dialog"`/`aria-modal`/focus-trap/
   Escape contracts preserved by every modal migration (SysModalBase owns them).
6. Scrim: click-to-close behavior per existing modal contract; scrim must not eat the
   close affordance — explicit close control on every dialog.
7. Domain accents never render body text below `--sys-text` contrast.

## 8. Verification & acceptance

- **P3:** `quick` per task (`npm run type-check` + scoped `npx vitest run`); final
  `npm run verify` (full — broad surface + config-adjacent CSS).
- **Boundary guards:** extended `systemThemeBoundary.test.ts` green — v1 rules + new rules:
  every new utility class enumerated; the `GameButton` default flip (if taken) gated to the
  final wave; all 86 census rows classified (a surface is `sys`, `painted`, or `dead`).
- **P14 Playwright (mandatory per touched surface):** `tests/e2e/system-ui.spec.ts` extended —
  dense-screen shot; one `.sys-rim--live`; drawer↔modal↔combat chrome handoffs; boot build +
  reduced-motion emulation; Vietnamese diacritics + font-blocked fallback; scrim blur check;
  measured contrast on brightest scene; focus-ring sweep through one representative surface
  per tier.
- **Gates:** P18 `ocr` delegation → P4 quick adversarial QA → P5 ≥3 sequential passes over the
  aggregate diff.
- **Acceptance:** every §6 row lands its path; zero confirmed Medium+ at final pass; the
  safe-degrade invariant holds (import removed → everything functional/legible).

## 9. Recorded decision points (coordinator-visible)

1. `GameButton` default variant flip to `system` in the final wave — take it iff every button
   consumer sits inside an adopted surface; else keep per-callsite opt-in.
2. `InkNineSlice`/`Menu*` removal after zero consumers — named cleanup, not mission-blocking.
3. `useSystemRimAuthority` claim-set expansion: drawers + all sys consoles; combat HUD elements
   (top bar, dock) are **not** rim-eligible (secondary surfaces keep static rim).
4. Scrollbar skinning still deferred; `.sys-fx-low` Settings toggle promoted into scope.
