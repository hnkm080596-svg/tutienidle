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

## Pre-existing Failures

None observed in the focused suite or type-check.
