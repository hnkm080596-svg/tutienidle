# QA Review: wave B — attach drawn chrome

- Date: 2026-10-04
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: 29 files under `game/src/components/**` (+1 deletion `TalentCardEmblem.vue`, +1 test selector update `DissolveTab.test.ts`), all listed on PR #129.

## Scope and Risk Map

`changed-risk-map.mjs` returned every task-owned path as `unmappedPaths`
(the mapper has no UI-component table). Manual route: every path maps to
domain pack `ui-input-lifecycle.md` (Vue component chrome/surface only).
No domain-state, persistence, economy, or combat-logic transition was
touched — the diff is presentational (which drawn slice paints a shell)
plus one behavior change explicitly requested (AI panel closed by
default). No deep-escalation trigger applies: no save/cloud, clock,
economy, or Vue/Pinia/Phaser ownership change; all component-level.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-B-1 | InkNineSlice overlay vs sibling content | click/focus passes through slice to the real control | Synchronization (visual layer must not block input) | Degraded env (slice covers hit target) | pointer reaches button/input | code inspection (slice is `pointer-events:none`) | high reachability, low impact if blocked |
| INV-B-2 | i18n key usage | reopen chip + close aria-label resolve | Recoverability | Missing key → literal text | `panels.common.close`, `combat.overlay.aiPanel.title`, `onboarding.creation.back` exist in vi+en | code inspection | high |
| INV-B-3 | Slice minimum sizes | control must be >= slice min or art squishes | Boundedness | Value mutation (box < slices) | per-slot minSize/slices vs element box | code inspection | medium |
| INV-B-4 | `.df-building` name on plaque | Vietnamese names render without truncation | Boundedness | Value mutation (long names) | 'Truyen Tong Tran' (15 glyphs) fits the tag | computed layout | medium |
| INV-B-5 | DissolveTab pagination reuse | `BagPaginationControls` with `:sort-options="[]"` renders pages without sort cluster | Lifecycle | Missing prop default | sort cluster `v-if="sortOptions.length"` hides; pages still emit `goToPage` | unit (DissolveTab.test.ts) | medium |
| INV-B-6 | TalentCard emblem removal | `CreationChoiceTile` default `#icon` slot renders `HuyenKimSymbol` for `:symbol` | Synchronization | Reorder (slot fallback path) | tile renders `HuyenKimSymbol :name="symbol"` when no override | code inspection | low |
| INV-B-7 | CombatAiRail collapsed default | battle start shows reopen chip, not open panel | Lifecycle | Stale state (panel auto-open regression) | `aiOpen = shallowRef(false)`; chip toggles | code inspection | medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `vue-tsc --noEmit` | clean | no type errors |
| scoped `vitest run` (24 files, 123 tests: login/dong-fu/bag/dissolve/equipment-hall/combat/creation/dialog/architecture) | green | includes updated `DissolveTab.test.ts` selectors |
| `panels.common.close` / `combat.overlay.aiPanel.title` / `onboarding.creation.back` | exist in vi + en | i18nKeyParity preserved (no new keys) |
| manifest tintable flags for tab-seal/seal-chip/button-compact/icon-button-utility | all `tintable: true` | active-tint logic lands on tintable sheets |
| DissolveTab select query (`select:nth-of-type(n)` → `.dissolve-filters__field:nth-of-type(n) select`) | test updated | asserted the same behavior, new wrapper DOM |

## Findings (both fixed inside the review loop, verified after)

### QA-2026-10-04-1: `.df-building__name` vertical column overflow
- Severity: Medium
- Status: Confirmed → **fixed** (commit `6001fe62`)
- Invariant: Boundedness — text must fit its plaque.
- Preconditions: any building with a long Vietnamese label.
- Reproduction: 'Truyen Tong Tran' = 15 glyphs; `writing-mode:vertical-rl` at 14px+3px spacing ≈ 255px column vs `max-height:78px` + `overflow:hidden` → truncated to ~5 glyphs.
- Expected: full name readable on the tag.
- Actual (pre-fix): clipped column.
- Evidence: layout arithmetic on current CSS; label values from `src/locales/vi.json`.
- Test file: none (layout; covered by visual inspection).
- Owner subsystem: DongFuHomeContent.vue.
- Blast radius: all six building plaques.
- Fix: name wraps horizontally (2–3 lines) inside the 72px tag.

### QA-2026-10-04-2: `.combat-ai-rail__close` below slice minimum
- Severity: Medium
- Status: Confirmed → **fixed** (commit `6001fe62`)
- Invariant: Boundedness — element box must clear the slice minimum.
- Reproduction: 24px box vs icon-button-utility's 30px slices → squished seal.
- Expected: 32px+.
- Actual (pre-fix): 24px.
- Evidence: manifest slices vs CSS box.
- Test file: none.
- Owner subsystem: CombatAiRail.vue.
- Blast radius: AI panel close affordance only.
- Fix: 32px.

## New or Changed QA Tests

`DissolveTab.test.ts` — select queries rerouted through the new
`.dissolve-filters__field` wrappers; same assertions, new DOM path.
No new reproduction tests (both defects are layout proofs, fixed inline).

## Gaps and Residual Risk

- Slot/surface size mismatches flagged on the PR (nav-seal-vertical
  rendered small, building-plaque anchors tuned for old chip positions,
  avatar-frame on a 78px circle, frame-xl-ceremony band stretched over a
  ~640px modal): cosmetic, reported to coordinator for art-side follow-up.
- Visual pixel-level confirmation of the new chrome surfaces is not in
  scope of this quick pass (no browser run); rely on slice geometry +
  manifest status 'ready' for every consumed id.

## Pre-existing Failures

None observed in the scoped run.
