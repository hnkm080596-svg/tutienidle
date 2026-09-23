# M-UI-SYSTEM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `subagent-driven-development` (recommended)
> or `executing-plans` to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking. Do NOT start implementation until the coordinator relays spec/plan approval —
> this plan is written for review first.

**Goal:** Land the "xuyên không hệ thống" SYSTEM-window interface skin as a parallel,
opt-in CSS layer over wave-1 surfaces, with the revert invariant intact.

**Architecture:** One new stylesheet (`src/assets/system-theme.css`, imported after
`theme.css`) owns every `--sys-*` token and `.sys-*`/`--system` style. Five new `Sys*`
primitives under `components/common/system/` carry the skin; shared components get explicit
`variant="system"` props; wave-1 surfaces opt in by adding classes/props — base ink styles
never move.

**Tech stack:** Vue 3 `<script setup>` + TS, plain scoped CSS (no preprocessor, no UI lib),
Vitest + source-scanning architecture guards, Playwright for P14.

**Spec:** `game/docs/specs/m-ui-system-spec.md` — the plan argues from it; read both.

**Integration branch:** the implementation PR targets the shared mission branch
`p7/truc-co` (coordinator update 2026-09-23), NOT `master`. Branch the implementation
worktree from `origin/p7/truc-co`; the spec/plan docs themselves were authored on
`devin/<ts>-m-ui-system` off master.

## Global Constraints

(Copied verbatim from the spec — every task implicitly includes them.)

- CSS-only FX; no JS animation libs, no canvas, no new runtime deps.
- `--sys-*` tokens defined once, in `system-theme.css`; never redefine `--ink-*`, `--gold-*`,
  `--paper-*`, `--surface-*`, `--chrome-*`, `--frame-*`, `--fx-*`, `--scrim*`, `--text-*`,
  `--rank-*`, `--grade-*`, `--el-*`, `--bar-*`.
- Every selector in `system-theme.css` anchored to `.sys-*` / `*-variant--system` classes.
- Opt-in only: `.sys-surface`, `Sys*` components, `variant="system"` props. Base classes stay;
  system styles are additive overrides living only in `system-theme.css`.
- Revert invariant: deleting `import './assets/system-theme.css'` restores byte-identical
  visuals.
- Perf: at most one `.sys-rim--live` per screen; ≤ 2 concurrent sweeps; `.sys-fx-low` hatch.
- A11y: opaque floor ≥ .88 composite alpha; non-glow `focus-visible` ≥ 2px; no hue-only
  meaning; scanlines under text.
- Reduced motion: all `sys-*` animations off; static corners + border + one static glow kept.
- Comments ASCII English (P15); UI strings via `useI18n()` (P16); no `any` (P8).
- Commit/push only on explicit coordinator authorization (P7).

## File map

| File | Action | Responsibility |
|---|---|---|
| `src/assets/system-theme.css` | Create | All `--sys-*` tokens, `.sys-surface` recipe, `.sys-*` effect utilities, `variant--system` override styles, Chakra Petch `@import`, reduced-motion + `.sys-fx-low` blocks |
| `src/main.ts` | Modify | Add `import './assets/system-theme.css'` after `theme.css` |
| `src/components/common/system/SysPanel.vue` | Create | Surface container: corners, rim tiers, bloom |
| `src/components/common/system/SysBar.vue` | Create | System progress readout |
| `src/components/common/system/SysTag.vue` | Create | Status/rarity chip with glyph |
| `src/components/common/system/SysStat.vue` | Create | Label + tabular value row |
| `src/components/common/system/SysModalBase.vue` | Create | Scrim + primary SysPanel + dialog contract |
| `src/components/common/primitives/Bar.vue` | Modify | Add `variant?: 'ink' \| 'system'` (default `'ink'`) |
| `src/components/common/OverlayPanel.vue` | Modify | Add `variant?: 'ink' \| 'system'` — swaps nine-slice layers for system chrome |
| `src/components/layout/LeftPanel.vue` | Modify | `.sys-surface` opt-in on the drawer root |
| `src/components/layout/RightPanel.vue` | Modify | `.sys-surface` opt-in on the drawer root |
| `src/components/panels/CharacterDetailCard.vue` | Modify | `.sys-surface` opt-in (docked to LeftPanel) |
| `src/components/panels/CharacterPanel.vue` | Modify | Eyebrow/SysStat/SysTag adoption, panel-internal `--sys-*` remaps |
| `src/components/panels/RealmPanel.vue` | Modify | `OverlayPanel variant="system"` + bar/rows skinning |
| `src/components/panels/skill-path/NodeTreePanel.vue` | Modify | Node/route/readout skinning — **LAST, RESPEC-gated (§RESPEC)** |
| `src/components/common/ConfirmModal.vue` | Modify | Migrate to `SysModalBase` |
| `tests/architecture/systemThemeBoundary.test.ts` | Create | Boundary-contract guard (spec §2.4) |
| `tests/e2e/system-ui.spec.ts` | Create | Modal open/close, drawer skin, one-live-rim invariant |
| `docs/ui-components.md` | Modify | New "System layer" section documenting `Sys*` primitives |

No test may be weakened; no existing file is deleted.

## Migration order

Tasks are ordered so every task leaves the app consistent and revert-clean. T1–T2 are inert
(nothing consumes them); T3+ progressively opt surfaces in.

### Task 1 — Token + utility foundation (inert)

**Files:** Create `src/assets/system-theme.css`; modify `src/main.ts:4` (add import line 5).

**Interfaces:**
- Produces: every `--sys-*` token from spec §3; classes `.sys-surface`, `.sys-corners`,
  `.sys-rim`, `.sys-rim--live`, `.sys-sweep`, `.sys-scanlines`, `.sys-bar`, `.sys-bloom`,
  `.sys-eyebrow`, `.sys-fx-low`, `bar--system`, `overlay-panel__card--system`.
- Consumes: nothing.

- [ ] **Step 1: write the stylesheet.** Core recipes (full code — the non-obvious parts):

```css
/* system-theme.css — "xuyen khong he thong" SYSTEM window skin.
   PARALLEL theme: loaded after theme.css; only .sys-* anchored rules here.
   Revert = delete the import in main.ts. */

@import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&display=swap');

@property --sys-rim-angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

:root {
  /* ... all tokens from spec §3.1-3.4 verbatim ... */
  /* Reads the existing noise token (reads are allowed; only redefinitions
     are forbidden by boundary rule 2). Cyan-tinted variant may replace it
     later without touching consumers. */
  --sys-grain: var(--surface-grain);
}

/* Surface recipe — opaque floor UNDER translucent tint (a11y spec 7.1). */
.sys-surface {
  background:
    var(--sys-grain) 0 0 / 160px 160px repeat,
    linear-gradient(180deg, rgba(56, 225, 255, .04), transparent 30%),
    var(--sys-surface),
    var(--sys-surface-solid);
  backdrop-filter: blur(10px);
  border: 1px solid var(--sys-line);
  box-shadow: var(--sys-shadow);
  color: var(--sys-text);
}

/* L-corner brackets — same pseudo-element pattern as .ornate-frame. */
.sys-corners { position: relative; }
.sys-corners::before,
.sys-corners::after {
  content: '';
  position: absolute;
  width: var(--sys-corner-size);
  height: var(--sys-corner-size);
  border: 0 solid var(--sys-corner);
  pointer-events: none;
  z-index: 2;
}
.sys-corners::before { top: 4px; left: 4px; border-top-width: var(--sys-corner-w); border-left-width: var(--sys-corner-w); }
.sys-corners::after { bottom: 4px; right: 4px; border-bottom-width: var(--sys-corner-w); border-right-width: var(--sys-corner-w); }

/* Light-line rim — conic gradient on a mask-composite border ring (technique
   identical to .fx-border-beam). The SPIN exists only under .sys-rim--live,
   and only one such element may exist per screen (spec 4.1). */
.sys-rim { position: relative; }
.sys-rim::before {
  content: '';
  position: absolute;
  inset: -1px;
  padding: 1px;
  background: conic-gradient(from var(--sys-rim-angle),
    transparent 0%, var(--sys-cyan) 8%, transparent 16%,
    transparent 50%, var(--sys-azure) 58%, transparent 66%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
  pointer-events: none;
  z-index: 2;
}
.sys-rim--live::before { animation: sys-rim-spin 4s linear infinite; }
@keyframes sys-rim-spin { to { --sys-rim-angle: 1turn; } }

/* Scan sweep — sheen band translated across; compositor-only (transform). */
.sys-sweep { position: relative; overflow: hidden; }
.sys-sweep::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(115deg, transparent 30%, rgba(56, 225, 255, .07) 46%, rgba(56, 225, 255, .16) 50%, rgba(56, 225, 255, .07) 54%, transparent 70%);
  transform: translateX(-120%);
  pointer-events: none;
  z-index: 1;
}
.sys-sweep--run::after { animation: sys-sweep 2.8s ease-in-out 1; }
@keyframes sys-sweep { to { transform: translateX(120%); } }

/* Scanlines — overlay BELOW text layer (z-index 0 under content z-index >= 1),
   alpha <= .04 so it can never cut text contrast (spec 7.4). */
.sys-scanlines::before {
  content: '';
  position: absolute; inset: 0;
  background: repeating-linear-gradient(0deg, rgba(56, 225, 255, .04) 0 1px, transparent 1px 4px);
  animation: sys-flicker 7s steps(12) infinite;
  pointer-events: none;
  z-index: 0;
}
@keyframes sys-flicker { 50% { opacity: .55; } }

/* Bar shimmer — background-position slide on the fill (cheap repaint, no layout). */
.sys-bar__fill {
  background: linear-gradient(90deg, var(--sys-bar-from, var(--sys-cyan)), var(--sys-bar-to, var(--sys-azure)));
  background-size: 200% 100%;
  animation: sys-bar-shimmer 2.4s linear infinite;
  box-shadow: 0 0 8px color-mix(in srgb, var(--sys-bar-from, var(--sys-cyan)) 55%, transparent);
}
@keyframes sys-bar-shimmer { to { background-position: -200% 0; } }

/* Hover bloom — transition only. */
.sys-bloom { transition: box-shadow .18s ease, filter .18s ease; }
.sys-bloom:hover { box-shadow: var(--sys-shadow), var(--sys-glow-bloom); }

/* Bracketed eyebrow. Brackets are CSS glyphs so locale text stays clean. */
.sys-eyebrow {
  font: 600 var(--text-sm) / var(--lh-tight) var(--sys-font-display);
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--sys-text-muted);
}
.sys-eyebrow::before { content: '[ '; color: var(--sys-cyan); }
.sys-eyebrow::after { content: ' ]'; color: var(--sys-cyan); }

/* Focus — non-glow, >= 2px, on every interactive sys control (spec 7.2). */
.sys-surface :is(button, [role='button'], a, input, select, [tabindex]):focus-visible,
.sys-modal :is(button, [role='button'], a, input, select, [tabindex]):focus-visible {
  outline: 2px solid var(--sys-focus);
  outline-offset: 2px;
}

/* Reduced motion (spec 4.2) + manual low-fx hatch (spec 4.1.4) — identical
   outcome: no flicker/sweep/shimmer/rim; static corners + border + glow kept. */
@media (prefers-reduced-motion: reduce) {
  .sys-rim--live::before,
  .sys-sweep--run::after,
  .sys-scanlines::before,
  .sys-bar__fill { animation: none; }
}
.sys-fx-low .sys-rim--live::before,
.sys-fx-low .sys-sweep--run::after,
.sys-fx-low .sys-scanlines::before,
.sys-fx-low .sys-bar__fill { animation: none; }
```

- [ ] **Step 2: import after theme.css** in `main.ts`:

```ts
import './assets/theme.css'
import './assets/system-theme.css'
```

- [ ] **Step 3: verify inert.** `npm run type-check` + boot smoke: app renders unchanged (no
  `.sys-*` class is emitted by any component yet). Confirm revert by deleting the import —
  nothing should change visually either way at this point.

- [ ] **Step 4: commit** `feat(ui): M-UI-SYSTEM system-theme.css token + effect layer`.

### Task 2 — Sys* primitives (inert until consumed)

**Files:** Create the five components under `src/components/common/system/`.

**Interfaces (exact contracts — consumers in T4-T7 rely on these):**

```ts
// SysPanel.vue
withDefaults(defineProps<{
  variant?: 'primary' | 'interactive' | 'flat'
  corners?: boolean
  scanlines?: boolean
}>(), { variant: 'flat', corners: true, scanlines: false })
// root: <section class="sys-panel sys-surface sys-corners" :class="{
//   'sys-rim sys-rim--live': variant === 'primary',
//   'sys-bloom': variant === 'interactive',
//   'sys-scanlines': scanlines }"> + <slot />

// SysBar.vue — same aria contract as primitives/Bar.vue
withDefaults(defineProps<{
  value: number
  max: number
  height?: number          // default 10
  tone?: 'cyan' | 'hp' | 'mp' | 'exp' | 'warn'   // default 'cyan'
  label?: string           // visible text; meaning is never hue-only
}>(), { height: 10, tone: 'cyan' })
// root: <div class="sys-bar" role="progressbar" :aria-*> + .sys-bar__fill + optional
//   .sys-bar__label rendering `label`

// SysTag.vue
withDefaults(defineProps<{
  tone?: 'cyan' | 'violet' | 'warn' | 'danger' | 'success' | 'muted'  // default 'cyan'
}>(), { tone: 'cyan' })
// renders <span class="sys-tag sys-tag--{tone}"><span class="sys-tag__glyph" aria-hidden/>
//   <slot /></span> — glyph shape per tone (dot/hex/diamond), label bracketed

// SysStat.vue — mirrors StatRow.vue's prop contract for drop-in feel
withDefaults(defineProps<{
  label: string
  tone?: 'default' | 'positive' | 'negative' | 'warn' | 'muted'
  bordered?: boolean
}>(), { tone: 'default', bordered: false })
// renders <li class="sys-stat"><span class="sys-stat__label"/><span class="sys-stat__value"><slot/>

// SysModalBase.vue — dialog contract copied from OverlayPanel
withDefaults(defineProps<{
  open: boolean
  title: string
  width?: string   // default 'min(900px, 94vw)'
  height?: string  // default 'auto'
  layer?: number   // default OVERLAY_LAYERS.panel
}>(), { width: 'min(900px, 94vw)', height: 'auto', layer: OVERLAY_LAYERS.panel })
const emit = defineEmits<{ close: [] }>()
// reuse useDialogFocus(cardRef, open, { onEscape: close }); heading useId + aria-labelledby;
// outer root emits class 'sys-modal' (matches the :focus-visible rule in system-theme.css);
// card = <SysPanel variant="primary"> — the ONE permitted live rim when open (spec 4.1.1)
```

- [ ] **Step 1:** scaffold all five SFCs with the contracts above; component `<style scoped>`
  holds only layout/structure — every color/glow/border value references `--sys-*` (or lands
  in `system-theme.css` if it must override base tokens).
- [ ] **Step 2:** `npm run type-check` + `npx vitest run tests/architecture` (guards unaffected:
  no consumer yet).
- [ ] **Step 3:** commit `feat(ui): M-UI-SYSTEM Sys* primitives`.

### Task 3 — Shared-component variants (additive)

**Files:** Modify `src/components/common/primitives/Bar.vue`,
`src/components/common/OverlayPanel.vue`.

**Interfaces:**
- `Bar` gains `variant?: 'ink' | 'system'` (default `'ink'`); `'system'` adds `bar--system` on
  the root — its styles live ONLY in `system-theme.css` (spec §5).
- `OverlayPanel` gains `variant?: 'ink' | 'system'` (default `'ink'`); `'system'` skips both
  `InkNineSlice` layers and adds `overlay-panel__card--system` + `.sys-rim sys-rim--live` on
  the card (it is the modal's live rim while `SysModalBase` adoption is still partial — see
  §RESPEC note on T6). Same props/slots/aria/focus contract.

- [ ] **Step 1:** add props + class bindings; keep every default identical.
- [ ] **Step 2:** add `bar--system` / `overlay-panel__card--system` rules to
  `system-theme.css` (anchored — §2.2 rule 3).
- [ ] **Step 3:** `npm run type-check` + `npx vitest run tests/architecture src/components/common`
- [ ] **Step 4:** commit `feat(ui): M-UI-SYSTEM variant=system for Bar + OverlayPanel`.

### Task 4 — HUD drawers + CharacterPanel

**Files:** `components/layout/LeftPanel.vue`, `components/layout/RightPanel.vue`,
`components/panels/CharacterDetailCard.vue`, `components/panels/CharacterPanel.vue`,
`system-theme.css` (drawer overrides), `src/assets/ink-wash-ui-slices.json` — NOT touched.

**Interfaces:** Consumes SysPanel/SysStat/SysTag/SysBar from T2. LeftPanel's drawer is the
home-primary surface (`.sys-rim--live` only when no modal open — the modifier lives on the
modal card while one is open; coordinate via the shared rule "modal trumps drawer" implemented
by gating the drawer modifier on `!ui.standalonePanel`).

- [ ] **Step 1:** `class="left-panel ink-drawer sys-surface sys-corners sys-scanlines"` (same
  for RightPanel minus the primary rim; CharacterDetailCard gets `.sys-surface`). In
  `system-theme.css`, `.sys-surface.ink-drawer` overrides the shell: `border-image: none`,
  ink art background replaced by the sys recipe. **Constraint:** boundary rule §2.2-2 forbids
  remapping `--paper-*`/`--surface-*` inside the drawer subtree (`.ink-drawer` already does
  that remap and its values stay authoritative) — drawer interiors instead re-style
  per-component via `.sys-*` usage below, and text color comes from `.sys-surface`'s own
  `color` declaration.
- [ ] **Step 2:** CharacterPanel — stat rows → `SysStat` (meridian node rows + main-stat rows),
  talent rarity tags → `SysTag` (glyph carries tier, color only reinforces), section titles →
  `.sys-eyebrow`, power readout → `--sys-font-display` tabular numerals. Keep figure/meridian/
  element-wheel art untouched (world art).
- [ ] **Step 3:** `npm run type-check` + `npx vitest run tests/architecture src/components/panels`
- [ ] **Step 4:** P14 spot-check (drawer + panel open over scene art): screenshot, one live
  rim, focus ring, Vietnamese labels legible. Evidence attached to the worklog.
- [ ] **Step 5:** commit `feat(ui): M-UI-SYSTEM skin HUD drawers + CharacterPanel`.

### Task 5 — RealmPanel via OverlayPanel variant

**Files:** `components/panels/RealmPanel.vue`, `system-theme.css` (requirement-row +
realm-node re-skin, anchored under `.overlay-panel__card--system` / `.sys-surface`).

- [ ] **Step 1:** `<OverlayPanel variant="system" …>`; cultivation `<Bar variant="system">`.
- [ ] **Step 2:** requirement rows: `✓/✗` markers keep text semantics; colors → `--sys-success` /
  `--sys-text-dim` via sys-anchored overrides. Realm nodes: keep shield shape, border colors →
  `--sys-line` / `--sys-line-hot` (current) / `--sys-success` (complete); `is-locked` keeps
  shape+text cue (grayscale alone is hue-adjacent — keep the "locked" text label).
- [ ] **Step 3:** verify + commit `feat(ui): M-UI-SYSTEM RealmPanel on system modal chrome`.

### Task 6 — NodeTreePanel (RESPEC-gated — see §RESPEC)

**Files:** `components/panels/skill-path/NodeTreePanel.vue`, `system-theme.css`.

- [ ] **Step 0 (gate):** `git merge-base --is-ancestor <respec-head> origin/p7/truc-co` —
  if RESPEC is merged, the skin pass also covers the new `.node-tree__respec` control;
  if not, implement on current base and record the respec-control restyle as a named
  rebase follow-up for whichever branch lands second.
- [ ] **Step 1:** node cards → `.sys-surface` node recipe (1px line + corner accent; state
  colors `--sys-line`/`--sys-line-hot`/`--sys-success`/`--sys-violet` + existing text/level
  cues unchanged); route tags → `SysTag`; insight counter → `--sys-font-display` numerals;
  zoom controls get sys focus ring (inherited from `.sys-surface` scope if the header opts in).
- [ ] **Step 2:** verify + commit `feat(ui): M-UI-SYSTEM NodeTreePanel system skin`.

### Task 7 — ConfirmModal → SysModalBase

**Files:** `components/common/ConfirmModal.vue`. Audit its caller set first
(`grep -rn "ConfirmModal" src`) — expected: ui-store confirm flow only; if additional callers
exist, list them in the worklog before migrating.

- [ ] **Step 1:** re-render on `SysModalBase` keeping the existing confirm/cancel emit contract
  and i18n keys; focus trap + Escape come from `SysModalBase`.
- [ ] **Step 2:** `npx vitest run` the modal's existing tests (`CombatExitConfirmModal*.test.ts`
  pattern as reference — run any test file importing ConfirmModal).
- [ ] **Step 3:** commit `feat(ui): M-UI-SYSTEM ConfirmModal on SysModalBase`.

### Task 8 — Guards, e2e, docs, gate chain

**Files:** `tests/architecture/systemThemeBoundary.test.ts` (new),
`tests/e2e/system-ui.spec.ts` (new), `docs/ui-components.md` (system-layer section).

- [ ] **Step 1:** boundary test per spec §2.4 (single `--sys-*` definition site; forbidden-LHS
  scan; `.sys-`/`--system` selector anchor scan; import-order check). Reference regex style:
  `tests/architecture/inkDrawerSurface.test.ts`.
- [ ] **Step 2:** e2e spec: open character drawer → assert `.sys-surface` present; open a
  system modal → assert `document.querySelectorAll('.sys-rim--live').length === 1`; Escape
  closes; reduced-motion emulation → no `animation-name` on sys layers (or
  `getComputedStyle(...)animationName === 'none'`).
- [ ] **Step 3:** `npm run verify` (full — new files + main.ts + broad surface).
- [ ] **Step 4:** P14 dense-screen run (spec §10 checklist, including the respec-button state
  actually merged at that point).
- [ ] **Step 5:** P18 `ocr` delegation pass → P4 quick QA → P5 sequential review (≥3 passes).
- [ ] **Step 6:** update `docs/ui-components.md` + commit `test(ui): M-UI-SYSTEM boundary
  guard + e2e` / `docs(ui): M-UI-SYSTEM system layer section`.

## §RESPEC — NodeTreePanel sequencing

In-flight PR branch `devin/1790128721-m-f-respec` touches `NodeTreePanel.vue` (+97/-…, adds
`.node-tree__respec` control + styles) and is **not merged** at plan time.

- **Default (recommended):** wave-1 merges into `p7/truc-co` only after RESPEC lands there.
  Task 6 runs on the rebased file and skins `.node-tree__respec` in the same pass — one
  coherent diff, no stale skin.
- **If the coordinator elects UI-first:** Task 6 proceeds on the pre-RESPEC file; the skin
  pass leaves the header control area structurally untouched (skin via classes/styles only),
  and a named follow-up task ("skin `.node-tree__respec`", owner = whichever merge lands
  second) is recorded in the mission ledger. Either way, Task 6's Step-0 gate check runs first.

## Verification plan (aggregate)

| Gate | Evidence |
|---|---|
| P3 | `npm run verify` final; per-task `type-check` + scoped vitest |
| Boundary | `systemThemeBoundary.test.ts` green |
| Revert | manual: delete the `system-theme.css` import → pre-change visuals, then restore |
| P13/P14 | `tests/e2e/system-ui.spec.ts` + dense-screen Playwright evidence per spec §10 (one live rim, focus ring, reduced-motion, Vietnamese diacritics, blocked-font fallback, brightest-scene contrast) |
| P18 | `ocr` delegation pass on the aggregate diff |
| P4 | `tutienidle-adversarial-qa` quick |
| P5 | ≥3 sequential review passes over the aggregate diff |

## Revert procedure

Single-step: remove `import './assets/system-theme.css'` from `src/main.ts`. All opt-in
classes become inert; all `variant="system"` branches render their `ink` default; `Sys*`
components degrade to unstyled-but-legible containers (only reachable where opted in).
