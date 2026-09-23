# M-UI-OVERHAUL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `subagent-driven-development` (recommended)
> or `executing-plans` to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking. Do NOT start implementation until the coordinator relays spec/plan approval —
> this plan is written for review first.

**Goal:** Adopt the "Hệ Thống" system-window language (spec §2) across every DOM interface
surface — all overlay panels, drawers, dialogs, HUD, combat chrome, boot/onboarding — while
keeping painted art and the safe-degrade invariant.

**Architecture:** Extend the proven M-UI-SYSTEM chassis in place: `system-theme.css` gains the
v2 grammar (chamfer geometry, boot build, edge trace, header rail, domain accents, T3/T4/T5
recipes); `Sys*` primitives and `variant="system"` seams stay; adoption happens in waves —
shared chrome first, then interiors, HUD, combat, onboarding, polish.

**Tech stack:** Vue 3 `<script setup>` + TS, plain scoped CSS (no preprocessor/UI lib), Vitest +
source-scanning architecture guards, Playwright for P14.

**Spec:** `game/docs/specs/m-ui-overhaul-spec.md` — read both; the plan argues from it.

**Integration branch:** `p7/truc-co`. PR is STANDALONE — user merges personally; coordinator
does not gate-merge it. Branch the implementation worktree from `origin/p7/truc-co`.

## Global Constraints

(From spec — every task implicitly includes them.)

- CSS/DOM-only: no gameplay logic, no save schema, no i18n key removal (keys may be added).
- CSS-only FX: transform / opacity / background-position / `@property` angles only. No JS
  animation libs, no canvas UI FX, no new runtime deps.
- Canonical `--sys-*` `:root` definitions exactly once, in `system-theme.css`; scoped
  `--sys-*` re-assignments only inside `.sys-`/`--system`-anchored subtrees or inline on
  opted-in elements (domain accents). Never redefine non-sys tokens.
- Every ordinary selector in `system-theme.css` anchored to `.sys-*` / `--system`.
- Perf: ≤1 `.sys-rim--live`; ≤2 concurrent sweeps; boot builds staggered; `.sys-fx-low` and
  `prefers-reduced-motion` kill all animation.
- A11y: ≥.88 composite alpha floor; 2px non-glow focus rings; no hue-only meaning; dialog
  aria/focus/Escape contracts preserved.
- Vietnamese stays legible: Chakra Petch display + Be Vietnam Pro body, tabular-nums numerals.
- Painted art (scene, backdrops, character/item art) untouched — only chrome restyles.
- Comments ASCII English (P15); no `any` (P8); commit/push only on explicit authorization (P7).

## File map

| File | Action | Responsibility |
|---|---|---|
| `src/assets/system-theme.css` | Modify | v2 grammar: chamfer recipe, `.sys-boot`, `.sys-trace`, `.sys-energy`, corner snap, T3 rail, T4 widget, T5 ephemeral, domain-accent hooks |
| `src/components/common/system/*.vue` | Modify (5) | primitives gain chamfer/boot props per spec §2.4 |
| `src/components/common/OverlayPanel.vue` | Modify | `variant="system"` card gains chamfer + boot build + header-rail slot styling |
| `src/components/common/system/SysModalBase.vue` | Modify | scrim blur + boot build + chamfer card |
| `src/components/common/GameButton.vue` | Modify | `variant="system"` chamfered button; default-flip decision §9.1 |
| `src/components/common/TabBar.vue` | Modify | `variant="system"` rail + sliding underline |
| `src/components/common/{Tooltip,ToastContainer,ActionFeedbackLog,NotificationBadge,WorldAnnouncementOverlay}.vue` | Modify | T5 sys forms |
| `src/components/common/{OfflineSummaryModal,TalentEntitlementModal,TutorialOverlay,SaveIncompatibleScreen,ErrorScreen}.vue`, `src/components/panels/LoreCodexModal.vue` | Modify | → `SysModalBase` / sys console |
| `src/App.vue` | Modify | `.boot-error` sys console fallback |
| `src/components/layout/FunctionOverlayPanel.vue` | Modify | `variant="system"` |
| `src/components/panels/{SkillPathPanel,QuestPanel,ArtifactPanel,CompanionPanel,QuanKhiPanel,TranPhapPanel}.vue`, `common/BreakthroughRequirementPanel.vue` | Modify | `variant="system"` + header rails |
| `src/components/panels/**` interiors | Modify (~35 files) | T4/rows/tags/stats per §6.3 |
| `src/components/layout/{LeftPanel,RightPanel}.vue` interiors + `CharacterDetailCard`, `InventoryPanel`, `BagGrid`, `bag-sections/*`, `EquipmentPaperdoll` | Modify | drawer interior upgrade |
| `src/components/game/{AutoFarmIndicator,BuildingDetailPopover,DongFuCommandWheel,HomeBuildingIcons,DongFuScene}.vue` | Modify | sys HUD/popover/wheel/markers |
| `src/components/game/combat/*` (11 files) + `game/tribulation/TribulationSceneOverlay.vue` | Modify | combat chrome |
| `src/components/onboarding/{AuthEntryScreen,CharacterCreationScreen}.vue`, `common/LoadingScreen.vue`, `game/PresentationTransitionOverlay.vue` | Modify | boot/onboarding consoles |
| `src/components/panels/SettingsPanel.vue` | Modify | `.sys-fx-low` toggle wiring |
| `tests/architecture/systemThemeBoundary.test.ts` | Modify | extended guards (spec §8) |
| `tests/e2e/system-ui.spec.ts` | Modify | v2 evidence spec |
| `docs/ui-components.md` | Modify | v2 grammar docs |

## Migration order

Chrome-first, then per-domain interior waves; onboarding early for first-impression value;
combat late (largest edge-case surface); polish last. Every task leaves the app consistent and
revert-clean; tasks within a wave are independently landable.

### Task 1 — v2 grammar foundation (inert)

**Files:** `src/assets/system-theme.css` (+ no consumer changes).

**Interfaces — produces (all new classes anchored; tokens under `:root`):**

```css
/* Chamfered console geometry — corners cut, glow follows the cut shape
   (drop-shadow, NOT box-shadow; spec §2.1). */
.sys-chamfer {
  --sys-cut: 12px;
  clip-path: polygon(var(--sys-cut) 0, 100% 0, 100% calc(100% - var(--sys-cut)),
    calc(100% - var(--sys-cut)) 100%, 0 100%, 0 var(--sys-cut));
}
.sys-chamfer--hard { --sys-cut: 18px; }

/* Boot build — materialize on open; runs once, compositor-only. */
.sys-boot { animation: sys-boot-in .38s cubic-bezier(.2,.9,.25,1) both; }
@keyframes sys-boot-in {
  from { clip-path: inset(0 0 92% 0); opacity: 0; transform: translateY(-6px); }
  to   { clip-path: inset(0 0 0 0);   opacity: 1; transform: none; }
}

/* Edge trace — light band sweeps one edge once on open. */
.sys-trace::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, var(--sys-line-hot), transparent);
  transform: translateX(-110%); pointer-events: none; height: 1px; z-index: 3;
}
.sys-trace--run::after { animation: sys-trace 1.1s ease-out 1; }
@keyframes sys-trace { to { transform: translateX(110%); } }

/* Header rail energy line — slow drift, cheap repaint. */
.sys-rail { border-bottom: 1px solid var(--sys-line-soft); }
.sys-energy {
  background: linear-gradient(90deg, var(--sys-cyan), var(--sys-azure) 60%, transparent);
  background-size: 200% 100%;
  animation: sys-energy-drift 6s linear infinite;
  height: 1px;
}
@keyframes sys-energy-drift { to { background-position: -200% 0; } }

/* Corner snap — brackets ease outward on hover/focus (spec §2.3). */
.sys-snap:hover::before, .sys-snap:focus-visible::before { transform: translate(-2px,-2px); }
.sys-snap:hover::after,  .sys-snap:focus-visible::after  { transform: translate( 2px, 2px); }

/* T4 readout widget — inset, hairline, quiet. */
.sys-widget {
  background: linear-gradient(180deg, rgba(56,225,255,.03), transparent 40%),
              var(--sys-bg-1);
  border: 1px solid var(--sys-line-soft);
}

/* Domain accent hook — legal scoped remap (boundary §3.3-5). */
.sys-accent-domain { --sys-accent: var(--sys-accent-domain, var(--sys-cyan)); }

/* Reduced-motion + fx-low extend to every new animation (spec §4.5). */
@media (prefers-reduced-motion: reduce) {
  .sys-boot, .sys-trace--run::after, .sys-energy { animation: none; }
}
.sys-fx-low .sys-boot, .sys-fx-low .sys-trace--run::after, .sys-fx-low .sys-energy {
  animation: none;
}
```

- [ ] **Step 1:** add the blocks above + any new tokens (`--sys-cut`, `--sys-scrim` blur var)
  to `system-theme.css` at `:root`/utility sections.
- [ ] **Step 2:** `npm run type-check` + `npx vitest run tests/architecture` — boundary guard
  must stay green (all new selectors anchored).
- [ ] **Step 3:** commit `feat(ui): M-UI-OVERHAUL v2 grammar layer in system-theme.css`.

### Task 2 — Primitives + shared-chrome upgrade

**Files:** `common/system/SysPanel.vue`, `SysModalBase.vue`, `common/OverlayPanel.vue`,
`primitives/Bar.vue`, `common/GameButton.vue`, `common/TabBar.vue`.

**Interfaces:**
- `SysPanel` gains `chamfer?: boolean` (default `true` — emits `.sys-chamfer`),
  `boot?: boolean` (default `true` on `variant="primary"` — emits `.sys-boot` on mount-open).
- `SysModalBase`: scrim → `--sys-scrim` + `blur(6px)`; card = `SysPanel variant="primary"
  chamfer boot` (`:rim-active="open"` unchanged).
- `OverlayPanel variant="system"`: card gains `.sys-chamfer .sys-boot`; header row gains
  `.sys-rail` + `.sys-energy` line; props/slots/aria unchanged.
- `GameButton`: `variant` union gains `'system'` — `.game-button--system` chamfer + hairline +
  `.sys-snap`; default stays `'ink'` until §9.1 decision.
- `TabBar`: `variant?: 'ink' | 'system'` — `'system'` emits `.tab-bar--system` rail + sliding
  underline via transform on the active indicator.

- [ ] **Step 1:** failing test first — extend `tests/architecture/systemThemeBoundary.test.ts`
  to enumerate the new utility classes (each must exist and be anchored) BEFORE wiring.
- [ ] **Step 2:** implement props/classes; styles into `system-theme.css`.
- [ ] **Step 3:** `npm run type-check` + `npx vitest run tests/architecture src/components/common`.
- [ ] **Step 4:** commit `feat(ui): M-UI-OVERHAUL Sys* + shared-chrome v2`.

### Task 3 — Modal layer → SysModalBase

**Files:** `common/OfflineSummaryModal.vue`, `common/TalentEntitlementModal.vue`,
`common/TutorialOverlay.vue`, `panels/LoreCodexModal.vue`,
`game/combat/CombatExitConfirmModal.vue`, `game/combat/CombatPauseOverlay.vue`,
`common/SaveIncompatibleScreen.vue`, `common/ErrorScreen.vue`, `App.vue` `.boot-error`.

**Interfaces:** consume `SysModalBase` contract (`open`, `title`, `width?`, `height?`,
`layer?`, emits `close`; owns `role="dialog"`/aria/focus-trap/Escape).

- [ ] **Step 1:** migrate each modal root to `SysModalBase`; TutorialOverlay keeps its
  step state, swaps panel chrome + stepper → segmented rail (`.sys-widget` segments).
- [ ] **Step 2:** SaveIncompatibleScreen/ErrorScreen/boot-error → T2 `.sys-surface .sys-chamfer
  .sys-corners` console + `.sys-accent-domain` danger remap (they are full-screen gates, not
  modal dialogs — SysModalBase only where the open/close contract fits).
- [ ] **Step 3:** `npx vitest run` affected dialog tests (`dialogFocus`, `dialogLabeling`,
  `CombatExitConfirmModal*`, `combat-pause` specs).
- [ ] **Step 4:** commit `feat(ui): M-UI-OVERHAUL modal layer on SysModalBase`.

### Task 4 — Overlay chrome: every OverlayPanel consumer → `variant="system"`

**Files:** `layout/FunctionOverlayPanel.vue`, `panels/SkillPathPanel.vue`, `QuestPanel.vue`,
`ArtifactPanel.vue`, `CompanionPanel.vue`, `QuanKhiPanel.vue`, `TranPhapPanel.vue`,
`common/BreakthroughRequirementPanel.vue`.

- [ ] **Step 1:** one-line prop per consumer + header-action readouts → `tabular-nums`
  display face; `SkillPathPanel` subtitle/points slots styled via `.sys-rail` header.
- [ ] **Step 2:** verify each opens (`ui.standalonePanel` / `leftPanelMode` drives `open`) —
  rim handoff: drawer rim → opened console → back to drawer on close.
- [ ] **Step 3:** `npm run type-check` + `npx vitest run tests/architecture src/components/panels`.
- [ ] **Step 4:** commit `feat(ui): M-UI-OVERHAUL all overlay panels on system chrome`.

### Task 5 — Boot & onboarding consoles

**Files:** `common/LoadingScreen.vue`, `onboarding/AuthEntryScreen.vue`,
`onboarding/CharacterCreationScreen.vue`, `game/PresentationTransitionOverlay.vue`.

- [ ] **Step 1:** auth/creation keep `InkWashBackdrop` painted art; replace nine-slice cards
  with `.sys-surface .sys-chamfer .sys-corners .sys-boot` consoles; auth tabs → sys rail;
  creation stepper → 3-segment `.sys-widget` rail (active segment gets energy line).
- [ ] **Step 2:** LoadingScreen → sys boot pulse (`--sys-*` pulse + segmented bar).
  PresentationTransitionOverlay → sys wipe (keep lock/route semantics + curtain layering).
- [ ] **Step 3:** `npx vitest run` onboarding/boot specs; P14 spot-check the login flow.
- [ ] **Step 4:** commit `feat(ui): M-UI-OVERHAUL boot + onboarding consoles`.

### Task 6 — Interiors wave 1: drawers + function-overlay family

**Files:** `panels/InventoryPanel.vue`, `panels/BagGrid.vue`, `panels/bag-sections/*` (4),
`panels/EquipmentPaperdoll.vue`, `panels/CharacterDetailCard.vue` interior pass,
`panels/{ProductionPanel,VendorPanel,SettingsPanel,StageSelectPanel,PillRoomPanel,
AlchemyView,ScripturePavilionPanel}.vue`, `panels/scripture/LoreCodex.vue`,
`panels/BuildingConstructionGate.vue`, `panels/equipment-hall/*` (5),
`panels/worker-lodge/*` (3).

- [ ] **Step 1:** section titles → `.sys-eyebrow`; stat/price/count rows → `SysStat`;
  requirement/rarity chips → `SysTag`; bars → `SysBar`/`Bar variant="system"`; cards/slots →
  `.sys-widget`; `ItemCardBody`/`SlotView` keep art region, chrome re-styles.
- [ ] **Step 2:** `SettingsPanel`: add Effects toggle wiring `.sys-fx-low` on `#app` root
  (new i18n key `panels.settings.effectsLow`; store field on ui settings — ui-store change is
  a DOM-behavior setting, allowed; no save-schema change beyond a new optional field).
- [ ] **Step 3:** `npm run type-check` + scoped `npx vitest run src/components/panels`.
- [ ] **Step 4:** commit `feat(ui): M-UI-OVERHAUL drawer + function interiors`.

### Task 7 — Interiors wave 2: standalone families

**Files:** `panels/realm/*` (4), `panels/artifact/*` (4),
`panels/skill-path/{NodeInspector,SkillPathList,SkillDetailView,SkillConnections,
SkillRoleStrip,TechniqueBand,TechniqueSlotCard,NativeCoreDetail}.vue`,
`panels/{QuestPanel,CompanionPanel,QuanKhiPanel,TranPhapPanel}.vue` interiors,
`panels/CharacterPanel.vue` v2 polish.

- [ ] **Step 1:** same recipe set as Task 6; `ArtifactPanel` subtree gets
  `--sys-accent-domain: var(--sys-violet)` on its `.sys-` root.
- [ ] **Step 2:** `TechniqueSlotCard`/`SlotView` drop `InkNineSlice` usage → `.sys-widget`
  (art image untouched).
- [ ] **Step 3:** `npm run type-check` + `npx vitest run src/components/panels`.
- [ ] **Step 4:** commit `feat(ui): M-UI-OVERHAUL standalone interiors`.

### Task 8 — HUD & ephemeral layer

**Files:** `common/Tooltip.vue`, `ToastContainer.vue`, `ActionFeedbackLog.vue`,
`NotificationBadge.vue`, `WorldAnnouncementOverlay.vue`, `game/AutoFarmIndicator.vue`,
`game/DongFuCommandWheel.vue`, `game/BuildingDetailPopover.vue`, `game/HomeBuildingIcons.vue`,
`game/DongFuScene.vue`.

- [ ] **Step 1:** T5 recipes — tooltip/toast/feed/badge/announcement: small chamfered card,
  single accent edge, no scanlines (spec §2.1 T5). `NotificationBadge` drops InkNineSlice →
  sys chip; `TabBar` consumers pass `variant="system"`.
- [ ] **Step 2:** `DongFuCommandWheel`: dim+blur lens backdrop + sys chip ring + center badge;
  badge slots → `NotificationBadge` sys form. `BuildingDetailPopover` → sys popover.
- [ ] **Step 3:** `HomeBuildingIcons` hotspots → sys scan-marker ring class on the DOM hotspot
  wrapper; `DongFuBuildingSprite` art untouched; `DongFuScene` overlay host unchanged.
- [ ] **Step 4:** `npm run type-check` + `npx vitest run src/components/common src/components/game`.
- [ ] **Step 5:** commit `feat(ui): M-UI-OVERHAUL HUD + ephemeral layer`.

### Task 9 — Combat chrome

**Files:** `game/combat/{CombatSceneOverlay,CombatTopBar,CombatAiPanel,CombatSkillDockPanel,
BattleLogPanel,TurnOrderStrip,CombatIntroOverlay,CombatCountdownOverlay,CombatResultModal,
CombatVictoryPanel,CombatDefeatPanel,RewardList}.vue`, `hud/TurnCombatSkillBar.vue`,
`hud/CombatSkillSlot.vue`, `game/tribulation/TribulationSceneOverlay.vue`.

- [ ] **Step 1:** top bar/AI panel/dock/log/turn-strip → sys bars/panels (T3/T4, static rim —
  NOT rim-eligible, spec §9.3). `CombatSkillSlot` cooldown mask readable on dark floor.
- [ ] **Step 2:** victory/defeat: keep `InkWashBackdrop` art, replace nine-slice card with
  `.sys-surface .sys-chamfer` (victory cyan, defeat `--sys-accent-domain` danger); rewards →
  sys rows. Intro/countdown → display numerals. Tribulation header → sys rail.
- [ ] **Step 3:** `npm run type-check` + `npx vitest run src/components/game tests/architecture`.
- [ ] **Step 4:** P14 combat pass: full fight screenshot + rim stays on drawer/console only.
- [ ] **Step 5:** commit `feat(ui): M-UI-OVERHAUL combat chrome`.

### Task 10 — Guards, e2e, GameButton decision, cleanup, docs, gate chain

**Files:** `tests/architecture/systemThemeBoundary.test.ts`, `tests/e2e/system-ui.spec.ts`,
`docs/ui-components.md`, `common/GameButton.vue` (decision), `components/menu/*` (optional
removal), `primitives/InkNineSlice.vue` (removal iff zero consumers).

- [ ] **Step 1:** boundary test extension — new utility classes enumerated; census coverage
  check (every §6 row sys/painted/dead); `GameButton` default flip gated to this wave.
- [ ] **Step 2:** §9.1 decision: if every GameButton consumer sits inside adopted surfaces,
  flip default to `system` and delete the per-callsite props; else keep opt-in. Record the
  call in the worklog.
- [ ] **Step 3:** remove `components/menu/*` (dead code); remove `InkNineSlice` iff the last
  consumer is gone — else record it as a named follow-up.
- [ ] **Step 4:** e2e extension — spec §8 checklist (dense screen, one live rim, handoffs,
  boot build, reduced-motion, Vietnamese + font-block, scrim blur, measured contrast,
  per-tier focus sweep).
- [ ] **Step 5:** `npm run verify` (full).
- [ ] **Step 6:** P14 dense-screen run across all tiers; P18 `ocr` pass → P4 quick QA →
  P5 ≥3 sequential passes.
- [ ] **Step 7:** `docs/ui-components.md` v2 section; commits `test(ui): … guards+e2e`,
  `docs(ui): …`, `chore(ui): remove dead menu primitives`.

## Verification plan (aggregate)

| Gate | Evidence |
|---|---|
| P3 | `npm run verify` final; per-task `type-check` + scoped vitest |
| Boundary | extended `systemThemeBoundary.test.ts` green |
| Revert | manual: delete the `system-theme.css` import → all surfaces functional/legible |
| P13/P14 | extended `tests/e2e/system-ui.spec.ts` + per-surface Playwright evidence (spec §8) |
| P18 | `ocr` delegation pass on the aggregate diff |
| P4 | `tutienidle-adversarial-qa` quick |
| P5 | ≥3 sequential review passes over the aggregate diff |

## Revert procedure

Two layers, matching spec §3.3-6:

1. **Safe degrade:** remove `import './assets/system-theme.css'` — every sys class inert;
   surfaces keep base markup and stay functional/legible.
2. **Prior appearance:** revert the adoption diff (file map above) — restores `variant`
   defaults, pre-overhaul chrome, and (if InkNineSlice was removed) requires restoring that
   file from history.
