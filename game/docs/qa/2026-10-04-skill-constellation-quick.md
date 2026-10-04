# QA Review: Phap Tu skill constellation (fire glyph)

- Date: 2026-10-04
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `game/src/data/progression/SkillConstellationLayouts.ts`
  - `game/src/data/progression/SkillConstellationLayouts.test.ts`
  - `game/src/components/panels/skill-constellation/SkillConstellationPanel.vue`
  - `game/src/components/panels/skill-constellation/ConstellationConnections.vue`
  - `game/src/components/panels/skill-constellation/ConstellationNode.vue`
  - `game/src/components/panels/skill-constellation/ConstellationBackdrop.vue`
  - `game/src/components/panels/skill-constellation/SkillConstellationPanel.test.ts`
  - `game/src/components/scenes/skill/SkillSurface.vue`
  - `game/src/components/scenes/skill/fidelity/SkillFidelityScene.vue`
  - `game/src/components/scenes/skill/fidelity/skillUi.ts`
  - `game/src/core/betaScopeSkillDomain.ts`
  - `game/src/locales/vi.json`
  - `game/src/locales/en.json`
  - `game/src/ui-preview/SkillPreview.vue`
  - `game/src/ui-preview/skillMessages.ts`

## Scope and Risk Map

`changed-risk-map.mjs` left every task-owned path unmapped, so domain routing
was done manually: `ui-input-lifecycle` for the panel/scene components
(timers, watchers, i18n, keyboard) and `economy-and-progression` for
`betaScopeSkillDomain.ts` + the progression layout data + the
purchase/upgrade call sites they feed. No save/cloud, combat, time/offline,
or Pinia/Phaser boundary was touched; the mapper's `deepAuditCandidate` was
false and code inspection bounds the change to presentation + data.

The `betaSkillTreeFor` change is a semantics-preserving extraction: the
grant-only verdict moved into `betaNodeTreeRenderable` so the layout
validation shares the authoritative predicate instead of duplicating it.
`NodeSystem.ts` holds different `levelsSkillId`/`grantedOnly` mechanics
(core leveling, waives) - not consumers of the tree-surface verdict.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-const-1 | `SkillConstellationLayouts` / registry | Layout is consumed by the tree surface | Every renderable fire node owns exactly one point; strokes reference only existing points; real prereq edges sit on strokes | Missing/duped nodeId, dangling stroke, off-stroke prereq | 7 assertions in `SkillConstellationLayouts.test.ts` | Vitest | High: silent node drop would hide gameplay |
| INV-const-2 | `SkillConstellationPanel` | Player selects a node by pointer or keyboard | `select` event carries the same node-id contract as `SkillPaperTree`; DOM order follows authored stroke order | Input-order shuffle, click | 6 assertions in `SkillConstellationPanel.test.ts` + runtime click check | Vitest + dev server | High |
| INV-const-3 | `SkillSurface` / `SkillFidelityScene` | Element pill switch | Only authored-glyph elements render the constellation; other branches keep the radial tree; accent comes from `ELEMENT_COLOR_VARS` | Switch fire <-> wood in preview | Runtime observation: fire = glyph, wood = radial | Runtime | High: fallback rule is the beta contract |
| INV-const-4 | `SkillSurface` timers | purchase/upgrade success, element switch, respec, unmount | `unlockTimer` never outlives the component and is reset per flag; `unlocking` clears on element switch and respec confirm | Rapid purchases, switch mid-animation, unmount mid-timer | Timer cleanup code inspection + same pattern as `noticeTimer` | Code review | Medium |
| INV-const-5 | purchase surface | Buy/upgrade/respec | `NodeInspector` (SkillPaperDetails) remains the only purchase surface; `purchaseNode`/`upgradeNode`/`respecNodeTree` wiring unchanged | Select every node state in preview | Runtime observation: inspector + CTA intact | Runtime + existing suite | High |
| INV-const-6 | `betaSkillTreeFor` | grant-only verdict | `rewardOnly`/`grantedOnly`/`levelsSkillId` nodes still yield `scope-hidden` + `grant-only-node` | Extraction diff + predicate reuse | `betaNodeTreeRenderable` shared; existing domain tests green | Existing suite | High |

## Evidence

| Check | Result | Evidence |
| --- | --- | --- |
| `npx vitest run src/data/progression/SkillConstellationLayouts.test.ts src/components/panels/skill-constellation/` | Pass | 13 tests: dup/stroke/coverage/scope/viewBox/prereq-on-stroke + panel order/select/layers/related/unlock-flow/position |
| `npm run type-check` | Pass | `vue-tsc --build` exits clean |
| `npx vitest run src/components/panels/SkillPathPanel.test.ts src/ui-preview/remainingPreview.test.ts tests/architecture/asciiComments.test.ts` | Pass | 15 tests; P15 ratchet clean after fixing one em-dash comment |
| Runtime `/ui-skill.html` (vite dev, preview) | Pass | Fire renders the authored glyph: root at junction, mutex capstones ending both legs, two top marks; learned edges glow `var(--el-fire)`; locked edges dashed; legend present; node labels on hover/selected; select updates inspector + related-edge highlight; wood switches back to radial tree |
| `betaScopeSkillDomain` extraction diff | Pass | Inline condition replaced by identical predicate body; sole production caller updated; domain tests still green |

## Findings

No confirmed Medium-or-higher defects.

- **Low (fixed in Pass 1):** glyph/prereq overlap matching in
  `ConstellationConnections` was direction-sensitive - a brush stroke
  authored A->B covering a prereq edge authored B->A would double-draw,
  violating the plan's "prereq wins when overlapping" rule. Fixed with a
  direction-insensitive `pairKey` shared by both layers; regression test
  added (`reversed edge -> no glyph-stroke, no free`).

- **Coverage gap (recorded):** the unlock travel animation itself
  (dash-offset path + arrival pulse) has runtime evidence only for its
  DOM contract via the panel test (`unlock-flow` path exists for the
  flagged node); the full visual animation was not exercised because the
  ui-skill preview has no purchase path. Risk: animation could misfire
  visually though the contract is asserted - acceptable for beta,
  mitigated by `prefers-reduced-motion` disabling the flow entirely.
- **Coverage gap (recorded):** `prefers-reduced-motion` honored in CSS
  (pulse/flow/label transitions disabled) but not exercised in an
  emulated reduced-motion run.
- **Nit (deferred):** the legend always shows both swatches even when a
  glyph has no decorative-only strokes (fire today). Keeping a stable
  legend is a readability feature, not a defect.
- **Nit (deferred):** `flagUnlock` also fires on node upgrades (any
  successful action), not only first unlocks. Consistent energy-travel
  UX; noted so a stricter unlock-only semantic can be chosen later.

## New or Changed QA Tests

- `src/data/progression/SkillConstellationLayouts.test.ts` (7 tests):
  viewBox parse/shape, dup nodeId, stroke endpoints, renderable-node
  coverage (shares `betaNodeTreeRenderable`), branch-scope refs,
  prereq-on-stroke, helper resolution.
- `src/components/panels/skill-constellation/SkillConstellationPanel.test.ts`
  (6 tests): DOM order, select contract, two-layer connections,
  selected/related marking, unlock-flow path, percent positioning.

## Gaps and Residual Risk

- The two recorded coverage gaps above (visual unlock animation,
  reduced-motion run) stand until a purchase-capable preview exists.
- Pre-existing: `respecDisabled`/`hasOwnedNodes` is computed over the
  rendered (selected-element) graph, so a spell player's respec button
  reflects only the visible branch's ownership - unchanged by this task.

## Sequential Review Passes (P5)

Independence evidence: unavailable. Dispatching an isolated child-session
blind reviewer failed - the org's concurrent-session cap was exhausted
(HTTP 429) and the mode cap forbids a lower-mode child. The passes below
are self-review per the protocol's fallback; the missing independent
read is reported rather than fabricated.

Sequential Review Pass 1 - Local Correctness / Regression
  Reviewed state: post-implementation committed diff (150ed7c9), every
    changed file plus the component consumers.
  Findings: P1-F1 direction-sensitive overlap matching in
    ConstellationConnections (Low, doc-rule violation on reversed
    stroke/edge authoring); P1-F2 unlock flag fires on upgrades too
    (Nit, intentional); P1-F3 nodes missing a layout slot fall back to
    radial coordinates in percent space (Nit, unreachable while the
    layout test holds); P1-F4 aria/timer/purchase contracts verified
    clean.
  Fixes: direction-insensitive pairKey for both connection layers.
  Verification: +1 panel regression test; 14 constellation tests green,
    vue-tsc clean.

Sequential Review Pass 2 - Architecture / Authority / Ownership
  Reviewed state after Pass 1 fixes: YES
  Findings: none confirmed. Ownership boundaries hold - layout data is
    pure presentation keyed by nodeId (ProgressionNode carries no
    coordinates), betaNodeTreeRenderable is the single owner of the
    tree-surface verdict shared by domain and validation, SkillSurface
    remains the single surface-selection point, SkillPaperDetails keeps
    the purchase surface, accent resolves from ELEMENT_COLOR_VARS
    tokens rather than a hardcoded palette, additive optional props
    only (emphasis, constellation, unlocking).
  Fixes: none.
  Verification: scoped suite (82 tests incl. tests/architecture/beta*)
    green after Pass 1.

Sequential Review Pass 3 - Adversarial Integration
  Reviewed state after Pass 2 fixes: YES
  Findings: none confirmed. Attacked: successive purchases reset the
    flag/timer cleanly (newer unlock truncates the older pulse, then
    clears); element switch, respec confirm, and unmount all clear the
    unlock flag and timer (onBeforeUnmount); non-constellation branches
    take the radial fallback with identical node positions; stray
    edges referencing unrendered nodes drop gracefully; DOM order
    equals authored stroke order for Tab navigation; the svg layer is
    aria-hidden while each node button carries name/level/state.
  Fixes: none.
  Verification: re-ran touched-scope vitest + type-check on the final
    state (82 tests, 8 files, green).

## Pre-existing Failures

None observed in the focused suite or type-check.
