# QA Review: dong-fu wheel single-ring redesign

- Date: 2026-10-03
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths:
  - `src/components/scenes/dong-fu/fidelity/DongFuWheel.vue`
  - `src/components/scenes/dong-fu/fidelity/DongFuWheel.test.ts` (new)
  - `src/components/scenes/dong-fu/fidelity/dongFuUi.ts`
  - `src/components/scenes/dong-fu/DongFuStage.vue`
  - `src/ui-preview/DongFuPreview.vue`

## Scope and Risk Map

Layout-only redesign of the live home wheel: two painted orbit rings
(r143 inner, r187 outer) collapsed into one ring at r187 with even 360/N
spacing. Fixes the reported defect where outer-ring orbs (73 px diameter
on rings 44 px apart) overlapped inner-ring orbs and stole their clicks.

`changed-risk-map.mjs` returned all five paths as `unmappedPaths` with
`deepAuditCandidate: false`. Manual routing: every path is Vue
presentation/fixture code -> `ui-input-lifecycle` domain pack. One-hop
consumers inspected: `DongFuStage.vue` (slot->action adapter, open prop),
`DongFuHomeContent.vue` (mounts the wheel, v-show), `betaScopeSurface.ts`
(`betaWheelSlots` scope filter), `commandWheelCatalog.ts` (slot
availability closures). No save/cloud, clock/offline, economy/progression,
or Pinia/Phaser ownership transition is touched; mandatory deep
escalation does not apply. No non-task-owned dirty files were reviewed.

## Invariant Ledger

| Invariant | Oracle | Check | Result |
| --- | --- | --- | --- |
| Every orb center lies on the single painted ring (r=187, center 210,210) | unit test parses node offsets -> orb center | `DongFuWheel.test.ts` N in {1,5,10,14} | hold |
| Even angular spacing including wrap-around | unit test angular gaps == 2pi/N | `DongFuWheel.test.ts` N in {2,10,14} | hold |
| No two orbs overlap (adjacent chord > 73 px orb diameter) | unit test pairwise chord > 73 | `DongFuWheel.test.ts` N=14 worst case (~83 px) | hold |
| N can never exceed the overlap-safe bound | catalog inspection: 15 slots, `talisman_slot` = NEVER_AVAILABLE -> max 14; beta scope renders 10 | source proof `commandWheelCatalog.ts` | hold |
| Click on each orb emits that slot's own id (hit target matches visual) | unit test clicks every `.df-node__orb` | `DongFuWheel.test.ts` | hold |
| Only the orb disc accepts pointer input (node box/label click-through) | CSS contract unchanged: `.df-wheel`/`.df-node`/`.df-node__label` `pointer-events:none`, orb sole `auto`, z-index orb 2 > label 1 | source diff | hold |
| Disabled slots never activate | `activate()` early-returns on `disabledReason`; `.is-disabled` orb `pointer-events:none` | source diff | hold |
| Repeated/keyboard activation parity | orb remains a native `<button>`; unchanged | source diff | hold |
| Single visible orbit element | unit test `toHaveLength(1)` on `.df-wheel__orbit` | `DongFuWheel.test.ts` | hold |
| Resolution independence | coordinates are 1440x810 design-canvas px scaled uniformly by `SceneDesignCanvas`; unchanged mechanism | source | hold |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` | clean | vue-tsc --build |
| `npx vitest run src/components/scenes/dong-fu/fidelity/DongFuWheel.test.ts` | 9/9 pass | new single-ring contract tests |
| scoped `npx vitest run` (dong-fu, wheel, beta scope, i18n) | 145 tests pass | no regression in consumers |
| `npx vitest run tests/architecture/asciiComments.test.ts` | pass | new comments ASCII-only |
| e2e selector contract | `.df-wheel` count=1 assertion in `huyen-kim-scroll-lifecycle.qa.spec.ts` still satisfied; `data-wheel-slot` attributes preserved | not re-run (e2e requires browser env) |
| `rg` for `.df-wheel__orbit--inner/--outer`, `action.ring`, `ring:` literals | zero consumers remain outside catalog metadata + dead-code wheel | verified |

## Findings

### QA-2026-10-03-1: adjacent node label boxes can overlap at N >= 13
- Severity: Low
- Status: Suspected (coverage gap: no rendered screenshot at N=14)
- Invariant: controls remain visually distinct at maximum slot count.
- Preconditions: >= 13 wheel actions rendered (post-beta scope only; beta
  renders 10).
- Reproduction: mount the wheel with 14 actions; inspect label spacing
  near the top of the ring.
- Expected: labels do not visually collide.
- Actual: node boxes are 104 px wide while adjacent orb centers are ~83 px
  apart at N=14; the 104 px label boxes overlap ~21 px. Labels are
  centered text (~40-70 px wide), `pointer-events:none`, z-index below
  the orbs, so interaction is unaffected and visible text collision is
  unlikely; unverified visually.
- Evidence: geometry arithmetic; no failing test.
- Test file: none (needs visual/render evidence)
- Owner subsystem: `DongFuWheel.vue` styles
- Blast radius: cosmetic, non-beta slot counts only

## New or Changed QA Tests

- `src/components/scenes/dong-fu/fidelity/DongFuWheel.test.ts` (new):
  asserts exactly one `.df-wheel__orbit`; all orb centers on r=187 for
  N in {1,5,10,14}; angular step 2pi/N incl. wrap-around for N in
  {2,10,14}; every pairwise orb chord > 73 px; clicking each orb emits
  its own slot id.

## Gaps and Residual Risk

- No rendered (browser) screenshot of the N=10/N=14 layout; label
  proximity at N>=13 is arithmetic, not visual, evidence. Interaction
  safety is nevertheless proven by the pointer-events contract.
- e2e specs were not executed locally (no browser env); the selector
  contract they assert was preserved by inspection.

## Pre-existing Failures

None observed in scope.
