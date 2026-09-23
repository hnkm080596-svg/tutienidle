# M-UI-SYSTEM — "Xuyên không hệ thống" Interface Skin

Status: `DRAFT — awaiting coordinator spec-review`
Mission: `M-UI-SYSTEM` · Date: 2026-09-23 · Owner: agent-authored under coordinator design authority
Spec-review input: C2C round-11 verdict — all findings are incorporated; each is cited at the rule that resolves it.

## 1. Intent

Restyle the game's interface surfaces into a **"xuyên không hệ thống"** (transmigration-system)
aesthetic — the Solo-Leveling-style SYSTEM status window: dark holographic panels floating over
the world, cyan/azure glow lines, 1px hairline borders with L-corner brackets, animated light-line
edges, digital-display numerals, and system-readout stat bars.

The fiction: the ink-wash world (scene art, dong phủ, Phaser canvas, building sprites) is the
*world*; the interface the player opens is the *System* — a different substance entirely. The two
visual languages deliberately do not blend.

Hard constraints from the mission:

- **CSS-only effects.** No JS animation libraries, no `<canvas>` for UI FX, no new runtime deps.
- **Vietnamese-first UI stays legible.** All UI text still flows through `useI18n()` (P16).
- **Parallel theme, not replacement.** This is a skin layer added next to the existing
  `"Mực và Giấy Trắng"` theme — never a rewrite of it (§2).

## 2. Architecture — parallel skin, not a replacement

### 2.1 Layers

```
ink-wash (world / scene)          system skin (interface)
─────────────────────────         ─────────────────────────
theme.css   — --ink-* --paper-*   system-theme.css — --sys-*
.ink-drawer, .ornate-frame,       .sys-surface, .sys-* utilities,
.fx-border-beam, InkNineSlice     Sys* components (opt-in only)
Phaser canvas / scene art         (never painted inside canvas)
```

- New file `src/assets/system-theme.css`, imported in `src/main.ts` **immediately after**
  `import './assets/theme.css'`. Cascade order is the only mechanism that lets the system layer
  override ink-wash on opt-in surfaces.
- New component folder `src/components/common/system/` holding the `Sys*` primitives
  (`SysPanel`, `SysBar`, `SysTag`, `SysStat`, `SysModalBase`).
- Ink-wash keeps every world/scene surface. The system skin applies only to interface surfaces
  that explicitly opt in (§6).

### 2.2 Boundary contract (review finding M-2 — hard rules)

1. System styling is reached **only** through: (a) the `.sys-surface` class on a component root,
   (b) a `Sys*` primitive, or (c) an explicit `variant="system"` prop on a shared component.
2. `system-theme.css` defines `--sys-*` tokens only. It **never** defines or redefines
   `--ink-*`, `--gold-*`, `--paper-*`, `--surface-*`, `--chrome-*`, `--frame-*`, `--fx-*`,
   `--scrim*`, `--text-*`, `--rank-*`, `--grade-*`, `--el-*`, `--bar-*` or any other
  existing token.
3. Every selector in `system-theme.css` is anchored to `.sys-*` (or to a `*-variant--system`
   class it introduces). No selector may match `.ink-*`, `.paper-*`, `.ornate-*`,
   `.fx-*`, Phaser canvas elements, or bare element/type selectors that could descend into
   ink-wash-owned subtrees.
4. Shared components (`Bar`, `OverlayPanel`, …) gain an explicit `variant` prop; they are not
   globally restyled. A variant prop may only be added when every caller is unaffected by
   default (`variant` defaults to `'ink'`, the current look).
5. Per-surface re-tinting happens only by overriding `--sys-*` values **inside** an opted-in
   `.sys-*` subtree — never by writing to non-sys tokens.

### 2.3 Revert invariant (review finding M-2)

**Deleting the single `import './assets/system-theme.css'` line in `main.ts` restores
byte-identical pre-change visuals.**

Consequences:

- Opt-in is *additive*: `.sys-surface` is applied **alongside** the base class
  (`class="left-panel ink-drawer sys-surface"`). The owning SFC keeps its ink base styles; every
  system override lives in `system-theme.css`. With the import removed, only the base styles
  remain.
- `variant` props default to `'ink'`; the `'system'` branch emits a class
  (e.g. `bar--system`, `overlay-panel__card--system`) whose styles exist only in
  `system-theme.css`. With the import removed the class resolves to nothing and the default
  branch renders exactly as before.
- `Sys*` components render their own base markup; their look is fully contained in
  `system-theme.css` + scoped fallbacks that degrade to a legible unstyled panel if the import
  is absent (acceptable: Sys* usage is itself opt-in and ships in the same wave).

### 2.4 Guard test

`tests/architecture/systemThemeBoundary.test.ts` (new, same source-scanning convention as
`tests/architecture/inkDrawerSurface.test.ts`) polices §2.2/§2.3 mechanically:

1. Each `--sys-*` token is defined exactly once, in `system-theme.css`.
2. `system-theme.css` contains no left-hand definition of any non-sys token
   (`--ink-`, `--gold-`, `--paper-`, `--surface-`, `--chrome-`, `--frame-`, `--fx-`,
   `--scrim`, `--text-`, `--rank-`, `--grade-`, `--el-`, `--bar-`).
3. Every selector in `system-theme.css` contains a `.sys-` or `--system` anchor.
4. `main.ts` still imports `theme.css` before `system-theme.css` (order check on the file text).

## 3. Design tokens — `--sys-*`

All values below are the token contract. `--sys-*` tokens are defined once, in
`system-theme.css` under `:root` (and scoped remaps where noted).

### 3.1 Color

| Token | Value | Role |
|---|---|---|
| `--sys-bg-0` | `#050a12` | deepest backdrop (behind scrims) |
| `--sys-bg-1` | `#071121` | panel floor tint |
| `--sys-surface` | `rgba(10, 22, 38, .72)` | translucent holographic body layer |
| `--sys-surface-solid` | `#0a1524` | opaque panel floor (a11y — §7.1) |
| `--sys-cyan` | `#38e1ff` | primary accent — light lines, active state |
| `--sys-azure` | `#4f7fff` | secondary accent — gradients, borders |
| `--sys-violet` | `#8b6cff` | rare/special system accents |
| `--sys-warn` | `#ffb84f` | warning |
| `--sys-danger` | `#ff5470` | danger / destructive |
| `--sys-success` | `#37e6a3` | success / met-requirement |
| `--sys-text` | `#d8ecff` | primary readout text |
| `--sys-text-muted` | `#7ea2c4` | labels, secondary |
| `--sys-text-dim` | `#4e6d8f` | disabled / locked |
| `--sys-focus` | `#8fe9ff` | keyboard focus ring |

### 3.2 Lines, corners, glow

| Token | Value | Role |
|---|---|---|
| `--sys-line` | `rgba(90, 190, 255, .28)` | 1px hairline border |
| `--sys-line-soft` | `rgba(90, 190, 255, .14)` | inner hairline / dividers |
| `--sys-line-hot` | `rgba(56, 225, 255, .65)` | focused / primary edge |
| `--sys-corner` | `#38e1ff` | L-corner bracket color |
| `--sys-corner-size` | `12px` | bracket arm length |
| `--sys-corner-w` | `1.5px` | bracket stroke width |
| `--sys-glow-sm` | `0 0 10px rgba(56, 225, 255, .22)` | small halo |
| `--sys-glow-md` | `0 0 18px rgba(56, 225, 255, .28), 0 0 42px rgba(79, 127, 255, .14)` | panel halo |
| `--sys-glow-bloom` | `0 0 24px rgba(56, 225, 255, .42)` | hover bloom |
| `--sys-shadow` | `0 12px 40px rgba(0, 0, 0, .6)` | panel drop shadow |

### 3.3 Surfaces (composite recipe)

System panel background = **opaque floor → translucent tint → noise**, so text contrast never
depends on scene brightness (§7.1):

```css
background:
  var(--sys-grain) 0 0 / 160px 160px repeat,
  linear-gradient(180deg, rgba(56, 225, 255, .04), transparent 30%),
  linear-gradient(180deg, var(--sys-surface), var(--sys-surface)),
  var(--sys-surface-solid);
backdrop-filter: blur(10px);
```

`--sys-grain` aliases `var(--surface-grain)` initially (reading existing tokens is allowed;
only redefining them is forbidden) — a cyan-tinted noise variant may replace it later without
touching consumers.

### 3.4 Typography

| Token | Value | Role |
|---|---|---|
| `--sys-font-display` | `'Chakra Petch', 'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif` | headers, eyebrows, numerals |
| `--sys-font-body` | `var(--font-body)` (Be Vietnam Pro stack) | body text — unchanged |

- **Chakra Petch** is the display/numeral face: tech-angular, and it ships a Vietnamese subset
  on Google Fonts, so headers keep Vietnamese diacritics. It is loaded by adding it to the font
  `@import` inside **`system-theme.css`** (not `theme.css`) — removing the import removes the
  font request too (revert invariant §2.3).
- **Numerals**: `font-family: var(--sys-font-display)` + `font-variant-numeric: tabular-nums`
  on every stat/readout — the "digital display" register.
- **Eyebrows**: bracketed uppercase `[ THÔNG SỐ ]` — emitted by `SysStat`/`.sys-eyebrow`,
  letter-spacing `.12em`, `--sys-text-muted`.
- **Fallback stack** (review finding L-2): when Chakra Petch is unavailable (offline, blocked
  font CDN), the stack falls back to Be Vietnam Pro / Segoe UI / system-ui — all
  Vietnamese-complete. Chakra Petch metrics (wide, low x-height, cap-heavy) make Be Vietnam Pro
  the closest layout-stable substitute: headers and stat rows reserve height via
  `line-height: var(--lh-tight)` and `min-block-size` on eyebrow/stat rows rather than relying on
  the font's ascent, so a fallback swap does not reflow panel chrome.
- **Type scale**: the system skin **reuses** `--text-*` (which already multiplies
  `var(--ui-scale)` — WS8 setting keeps working) and `--space-*`/`--tap-min`. No new size scale.

## 4. Signature effects — CSS-only

All effects animate only `transform`, `opacity`, `background-position`, or a registered
`@property` angle. None animate layout properties. None require JS.

| Effect | Utility / mechanism | Perf class |
|---|---|---|
| Light-line rim | `.sys-rim` — rotating `conic-gradient(from var(--sys-rim-angle), …)` on a `mask-composite` border ring (same ring-masking technique as `.fx-border-beam`), animated via `@property --sys-rim-angle` | repaint-per-frame — **restricted, §4.1** |
| Scan sweep | `.sys-sweep` — a `::before` sheen band translated across the panel on open (`transform: translateX`) and on a slow loop for primaries | compositor-only |
| L-corner brackets | `.sys-corners` — two pseudo-elements drawing `border-top/left` + `border-bottom/right` arms (pattern lifted from `.ornate-frame`) | static |
| Scanlines | `.sys-scanlines` — `repeating-linear-gradient` overlay + subtle `opacity` flicker; rendered on a layer **below** text | near-static |
| Bar shimmer | `.sys-bar__fill` gradient + highlight band sliding via `background-position` | cheap repaint |
| Hover bloom | `.sys-bloom` — `box-shadow`/`filter` transition on `:hover` | transition only |

### 4.1 Performance policy (review finding M-1 — hard rule)

The rotating rim repaints its gradient **every frame** — it is not compositor-only. Therefore:

1. **At most ONE live rim per screen.** Only the focused/primary surface carries
   `.sys-rim--live` (the element whose animation runs). Wave-1 grants the live rim to: the open
   system modal (`SysModalBase` card) or, absent a modal, the primary open drawer
   (`LeftPanel`). A surface exposes `variant="primary"` to request it; `SysPanel` implementation
   must guarantee only one `.sys-rim--live` is mounted per screen — enforce by only ever applying
   the modifier in the two named places, and pin it in code comments + the boundary test.
2. Secondary surfaces use a **static** light-line border (same gradient, frozen angle) or, at
   most, a slow `opacity` pulse (≥ 3.6s period) on the rim layer — never the conic spin.
3. **Sweep cap:** at most 2 `.sys-sweep` animations may run simultaneously on a screen; sweeps
   on panels that open together must be staggered (`animation-delay`) or omitted on secondary
   panels.
4. **Low-effects escape hatch:** `.sys-fx-low` on any subtree (or root) sets every `sys-*`
   animation to `none` while keeping static skin — **independent of `prefers-reduced-motion`**
   so the effect budget can be cut without touching OS-level settings. Wave-1 ships it as a
   class convention; wiring it to a Settings toggle is a named follow-up (§6.3), not required
   for wave-1.
5. Invisible effects must cost nothing: animations live only on visible/active states (the
   lesson already encoded in `.fx-border-beam` — copy the pattern: animation declared inside the
   visible-state rule, not on the base layer).

### 4.2 Reduced motion (review finding L-1 — concrete)

Under `@media (prefers-reduced-motion: reduce)` inside `system-theme.css`:

- `.sys-rim` rotation, `.sys-sweep`, `.sys-scanlines` flicker, `.sys-bar` shimmer: **all
  `animation: none`**.
- Retained: static L-corners, a single static border, one static glow — the panel still reads
  "system", it just does not move.

## 5. Primitives — `src/components/common/system/`

Convention mirrors `common/primitives/`: props control behavior; visuals go through `--sys-*`
CSS vars overridable by consumers (`style="--sys-accent: var(--sys-violet)"`).

| Component | Contract |
|---|---|
| `SysPanel` | Slot container. Props: `variant?: 'primary' \| 'interactive' \| 'flat'` (default `'flat'`); `corners?: boolean` (default `true`). Emits the `.sys-surface` recipe + `.sys-corners`; `primary` adds `.sys-rim--live`, `interactive` adds `.sys-bloom` hover. |
| `SysBar` | System-readout progress bar. Props: `value: number`, `max: number`, `height?: number` (default 10), `tone?: 'cyan' \| 'hp' \| 'mp' \| 'exp' \| 'warn'` (mapped to `--sys-bar-from/--sys-bar-to`), `label?: string`. Segmented look via gradient stops + shimmer; `role="progressbar"` with aria values — same contract as `primitives/Bar.vue`. Label text (not color) carries meaning (§7.3). |
| `SysTag` | Status/rarity chip. Props: `tone?: 'cyan' \| 'violet' \| 'warn' \| 'danger' \| 'success' \| 'muted'`, `icon?: string`. Renders bracketed uppercase label + a left glyph — meaning is never hue-only (§7.3). |
| `SysStat` | Stat readout row. Props: `label: string`, `tone?: 'default' \| 'positive' \| 'negative' \| 'warn' \| 'muted'`, `bordered?: boolean`. Label `--sys-text-muted`, value `tabular-nums` in `--sys-font-display`. |
| `SysModalBase` | Modal chrome: `--sys-scrim` scrim + `SysPanel variant="primary"` card (the one allowed live rim). Owns the dialog contract: `role="dialog"`, `aria-modal`, `aria-labelledby` via `useId`, `useDialogFocus` focus trap + Escape — the same contract `OverlayPanel` holds today. Props: `open`, `title`, `width?`, `height?`, `layer?`; emits `close`. |

Shared-component variants (§2.2 rule 4):

- `primitives/Bar.vue`: `variant?: 'ink' | 'system'` — `'system'` emits `bar--system`; all
  visual overrides for it live in `system-theme.css`.
- `common/OverlayPanel.vue`: `variant?: 'ink' | 'system'` — `'system'` replaces the
  `InkNineSlice` surface/frame layers with `SysPanel` chrome (same props/slots/aria contract).
  Callers unchanged unless they opt in.

## 6. Scope

### 6.1 Wave-1 surfaces (affirmed by the round-11 verdict)

| Surface | File(s) | Skin move |
|---|---|---|
| Home HUD drawers | `components/layout/LeftPanel.vue`, `components/layout/RightPanel.vue`, docked `components/panels/CharacterDetailCard.vue` | add `.sys-surface` next to `.ink-drawer`; system CSS hides border-image/art and applies the panel recipe; `LeftPanel` may carry `variant="primary"` when no modal is open |
| CharacterPanel | `components/panels/CharacterPanel.vue` | section titles → bracketed `.sys-eyebrow`; stat readouts → `SysStat`; talent tags → `SysTag`; figure/wheel art kept (world art, not skin) |
| RealmPanel | `components/panels/RealmPanel.vue` | `OverlayPanel variant="system"`; cultivation `Bar variant="system"`; requirement rows adopt `SysStat`-style readout; realm nodes keep shield shape, re-tinted via `--sys-*` overrides inside the opted-in subtree |
| NodeTreePanel | `components/panels/skill-path/NodeTreePanel.vue` | node cards → `.sys-surface` node recipe (1px line + corner accent); route tags → `SysTag`; insight counter → numeral readout; zoom/route controls keep behavior, system skin only. **Sequenced last — RESPEC conflict, see plan.** |
| Shared progress bars | `components/common/primitives/Bar.vue` | `variant="system"` prop; wave-1 callers opt in (RealmPanel cultivation bar, NodeTreePanel node-level bar if present) |
| Modal chrome | `components/common/OverlayPanel.vue`, `components/common/ConfirmModal.vue` | `OverlayPanel` variant prop; `ConfirmModal` migrated to `SysModalBase` (single audited caller: `ui.confirm` flow) |

### 6.2 Deferred — named follow-ups, NOT wave-1

- Scrollbar skinning (scrollbars are app-hidden today).
- Rarity/element token remapping (`--rank-*`, `--grade-*`, `--el-*` stay ink-owned; SysTag
  tones cover wave-1 needs).
- Vue `<Transition>` restyles (panel slide/fade transitions keep current motion).
- `SysModalBase` adoption by other modals (`OfflineSummaryModal`, `LoreCodexModal`,
  `CombatExitConfirmModal`, combat result panels).
- Combat-scene chrome (`CombatTopBar`, combat overlays, Phaser-adjacent HUD layers), command
  wheel, onboarding screens, SettingsPanel internals, Tooltip system.
- Phaser/canvas surfaces: never system-skinned (boundary contract §2.2-3).

### 6.3 Follow-up candidates (recorded, unscheduled)

Settings toggle emitting `.sys-fx-low` on the app root; `.sys-sweep` adoption on drawers;
tooltips/toasts as system chrome; combat HUD system pass.

## 7. Accessibility contract (review finding M-3 — hard rules)

1. **Opaque floor:** every `.sys-surface` panel composes the solid `--sys-surface-solid` layer
   under its translucent tint (§3.3), so composite background alpha ≥ .88 over any scene art —
   body text contrast ≥ 4.5:1, display/large text ≥ 3:1, verified on the brightest scene
   (tribulation glow) during P14.
2. **Focus:** every interactive control on a system surface gets `:focus-visible` with a
   **non-glow** indicator ≥ 2px: `outline: 2px solid var(--sys-focus); outline-offset: 2px`.
   Glow may be *added on top* but is never the only indicator.
3. **Not hue-only:** status/rarity/meeting-requirements meaning always pairs color with
   text/icon/shape — `SysTag` glyph, `✓/✗` markers (existing convention), bracketed labels,
   corner-notch shape. No wave-1 control may encode meaning in hue alone.
4. **Scanline discipline:** `.sys-scanlines` overlays sit below text layers (z-index under
   content) and cap at ~.04 alpha — they may never reduce measured text contrast or cross
   glyphs at visible opacity.
5. **Targets:** `--tap-min` floor unchanged; focus order unchanged; `aria-*` contracts of
   `OverlayPanel`/`Bar` preserved by the variants (§5).

## 8. i18n & typography legibility

- All strings through `useI18n()` (P16); bracketed eyebrows render `t()` output — brackets are
  CSS `::before/::after` glyphs (`[`, `]`), so locale text stays punctuation-free.
- Wave-1 P14 must exercise Vietnamese diacritics in headers + stat rows (e.g.
  `[ THÔNG SỐ ]`, `Cảnh Giới`, stat labels) under both Chakra Petch loaded and the fallback
  stack (network-blocked font request) — headers must not overflow or wrap-broken at 90–125%
  ui-scale.

## 9. Constraints (hard)

- CSS-only FX; no JS animation libs, no canvas for UI, no new runtime deps.
- Comments ASCII English (P15); Vietnamese only in localized strings/docs.
- One `--sys-*` definition site (`system-theme.css`), one `.sys-*` class owner per pattern.
- Perf policy §4.1 (one live rim, sweep cap, low-fx hatch) and boundary contract §2.2 are
  enforced by `systemThemeBoundary.test.ts`.
- Revert invariant §2.3 holds after every task — checked in the plan's verification steps.

## 10. Verification & acceptance

- **P3:** `quick` per task (`npm run type-check` + scoped `npx vitest run`); final aggregate
  `npm run verify` (new files + `main.ts` import + broad visual surface).
- **Architecture guards:** `systemThemeBoundary.test.ts` green (§2.4).
- **P14 runtime (mandatory):** real-browser evidence, captured on the densest reachable screen —
  all wave-1 surfaces visible simultaneously where the UI allows (HUD drawers + CharacterPanel
  open; a system modal over scene art; NodeTreePanel populated):
  - screenshot proof of the dense screen;
  - exactly one `.sys-rim--live` element mounted (`document.querySelectorAll` count = 1);
  - `:focus-visible` ring visible on tab through interactive controls;
  - `prefers-reduced-motion` emulation: no flicker/sweep/shimmer/rim motion;
  - Vietnamese diacritics correct in headers + stat rows; font-fallback check with font request
    blocked — no layout breakage;
  - contrast spot-check on the brightest scene (measured, not eyeballed).
- **E2E:** new `tests/e2e/system-ui.spec.ts` covering open/close of a system modal, drawer skin
  presence, and the one-live-rim invariant.
- **Gates:** P18 OCR on the diff → P4 adversarial QA (quick) → P5 sequential review (≥3
  passes). UI-skin surface = the full opt-in set plus the two shared-component variants.
- **Acceptance:** all wave-1 surfaces render the system skin with revert invariant intact;
  zero confirmed Medium+ findings at final pass.
