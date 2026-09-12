# QA Review: Khí Đường `.qi-hall__*` layout ownership consolidation (R11)

- Date: 2026-09-12
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths:
  - `src/components/panels/EquipmentHallPanel.vue`
  - `src/components/panels/equipment-hall/EnhanceTab.vue`
  - `src/components/panels/equipment-hall/WashTab.vue`
  - `src/components/panels/equipment-hall/RefineTab.vue`
  - `src/components/panels/equipment-hall/DissolveTab.vue`
  - `src/components/panels/equipment-hall/qi-hall.css` (new)
  - `tests/architecture/qiHallLayoutOwnership.test.ts` (new)

## Scope and Risk Map

Changed systems: Equipment Hall (Khí Đường) panel shell + four tab components. The change
moves the shared `.qi-hall__*` layout vocabulary out of five scoped `<style>` blocks into
one unscoped sheet (`qi-hall.css`) imported by `EquipmentHallPanel.vue`, plus an
architecture guard test. **No template, script, state, or domain logic changed.**

Mapper output: domains `inventory-equipment` + `ui-input-lifecycle`;
`deepAuditCandidate: true` ("cross-system: 2 domains"); `unmappedPaths` = `qi-hall.css`
and the new test file.

- `unmappedPaths` disposition: both inspected directly. `qi-hall.css` is a pure stylesheet
  → routed manually to `ui-input-lifecycle`. The test file is a static architecture guard
  → self-evidencing, no domain risk.
- Escalation decision: **not escalating to deep**. The "2 domains" flag comes from file
  paths living under `equipment-hall/`; code inspection shows zero inventory/equipment
  rule, state, or transaction contact — every changed line is CSS or a comment/import.
  Material risk is confidently bounded to presentation cascade order.
- One-hop consumers checked: no file outside `EquipmentHallPanel.vue` renders any of the
  four tabs (`grep` over `src/**` confirms single consumer), so no view can lose styles by
  relying on the sheet. `DecomposeTab.vue` (unmodified) never owned `.qi-hall__*` rules;
  its wrapper classes are served by the sheet via the shell, same as before.
- Exclusions: none (all dirty paths in the worktree are task-owned).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-QH-1 | `.qi-hall__*` vocabulary / `qi-hall.css` | Any tab mounts; cascade resolves | Determinism: split = `row`, dissolve/decompose `gap:8`, narrow `@container` = `column` — independent of mount/bundle order | Reorder | Emitted CSS order: `body`(102255) < `split`(102386) < `dissolve,decompose`(105836) < `@container`(105894) in `dist` bundle | Build artifact inspection | High reachability (every hall visit) — resolved |
| INV-QH-2 | Declarations parity | All prior `.qi-hall*` rules carried over | Conservation: no declaration dropped or altered | Value mutation (per-rule diff) | Scripted comparison: 100 old rule instances → 37 unique rules, **0 missing/divergent** | Static check (scripted) | High — resolved |
| INV-QH-3 | Tab private styles | `.enhance-row__costs`, `.dissolve-*` still override shared rules | Determinism: scoped (0,2,0) > global (0,1,0) always wins | Reorder | Selector specificity math + emitted scoped selectors keep `[data-v-*]` | Static analysis | Medium — resolved |
| INV-QH-4 | Sheet load boundary | Panel unmount/remount, HMR | Lifecycle: imported CSS persists (Vite never unloads module CSS) | Repeat / Interruption | Rendered layout after tab switches and remounts | Browser — **deferred (P14 worktree exception)** | Medium |
| INV-QH-5 | `@container overlay-panel (width<=760px)` | Overlay narrows below 760px | Boundedness: split collapses to column | Degraded environment | Emitted query verified at dist position 105894 wrapping the 3 overrides | Build artifact + browser deferred | Medium — statically resolved |
| INV-QH-6 | Reintroduction of competing owners | Future edit re-adds scoped `.qi-hall__*` | Guard fails | — | `qiHallLayoutOwnership.test.ts` green; proven RED before the fix | Vitest architecture guard | Resolved |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run tests/architecture/qiHallLayoutOwnership.test.ts` + 6 panel/tab test files | 7 files / 33 tests pass | Guard failed RED (2/2) before implementation, green after |
| `npm run type-check` | exit 0 | clean |
| `npm run build` | success | `dist/assets/index-*.css` contains the full sheet once, in designed order |
| Scripted declaration parity (git HEAD vs sheet) | 0 missing / 0 divergent of 100 rule instances | naive CSS parser; declarations compared whitespace-normalized |
| Consumer scan for tab components | `EquipmentHallPanel.vue` is the only importer | no standalone render path can lose styles |
| Emitted order probe | `body` < `split` < `dissolve,decompose` < `@container` | deterministic single-file cascade — the original race is structurally gone |
| Live browser visual check | **Not verified** | P14 isolated-worktree exception: browser launch unreliable inside `.agent-worktrees/`; deferred to main-checkout finishing |

## Findings

None.

## New or Changed QA Tests

- `tests/architecture/qiHallLayoutOwnership.test.ts` — asserts `qi-hall.css` exists and owns
  the `.qi-hall__*` vocabulary, and that no Vue/CSS file outside the sheet (except the
  shell's `.qi-hall` / `.qi-hall__tabs`) defines a `qi-hall*` selector. Fails RED on the
  pre-fix tree; regression-guards the ownership boundary.

## Gaps and Residual Risk

- **P14 live-browser visual confirmation deferred** (worktree exception): computed-style
  proof of `flex-direction: row` at wide width and column at ≤760px container, plus
  tab-switch remount behavior, should be visually confirmed from the main checkout during
  branch finishing. Bounded and non-blocking: the emitted production bundle demonstrably
  contains every prior declaration exactly once, in the intended cascade order, and the
  four tabs have a single render consumer.
- intlify missing-key warnings (`panels.equipmentHall.*`) during component tests —
  pre-existing, recorded in prior QA notes; not task-owned.

## Pre-existing Failures

- Vue i18n missing-key warnings in `DissolveTab`/`EquipmentHallPanel` component tests
  (warnings only; all assertions pass).
