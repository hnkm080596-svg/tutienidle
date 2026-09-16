# QA Review: bag filter extension (equipment + pills) + Lane-E test coverage

- Date: 2026-09-16
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths:
  - `game/src/composables/useBagFilter.ts` (useEntryFilter + pill group constants)
  - `game/src/components/panels/bag-sections/EquipmentBagSection.vue`
  - `game/src/components/panels/bag-sections/PillBagSection.vue`
  - `game/src/components/panels/bag-sections/EquipmentBagSection.test.ts` (modified)
  - `game/src/components/panels/bag-sections/PillBagSection.test.ts` (new)
  - `game/src/locales/vi.json`, `game/src/locales/en.json`
  - `game/src/core/equipment/EquipmentDissolve.test.ts`, `EquipmentInstanceSnapshot.test.ts`, `EquipmentRefine.test.ts`, `EquipmentWash.test.ts` (new, QA-write allowlist)
  - `game/src/core/production/ProductionCycles.test.ts`, `ProductionOffline.test.ts` (new, QA-write allowlist)

## Scope and Risk Map

Mapper output: domains `economy-and-progression`, `inventory-equipment`, `ui-input-lifecycle`; `deepAuditCandidate: true` ("cross-system change: 3 domains"); unmapped paths = useBagFilter.ts, both locale files, both bag-section test files.

Manual routing of unmapped paths:

- `useBagFilter.ts` → ui-input-lifecycle. UI composable holding session-only filter refs; exports pure name/group matchers over caller-supplied entries. No domain writes.
- `vi.json`/`en.json` → ui-input-lifecycle (display strings only). `tests/architecture/i18nKeyParity.test.ts` pins vi/en parity — 10/10 green.
- bag-section test files → existing UI test seams, no production risk.

Escalation decision: `deepAuditCandidate` advisory overridden by code inspection — the production delta is ~200 lines of read-only filtering over already-materialized display entries (BagCell construction is unchanged; `filtered` returns the same entry references into the identical sort/pagination pipeline). Zero mutations to `EquipmentBag`/`MaterialBag`/`PillBag`/`GameManager`; no save, offline, combat, or persistence touchpoints. The economy/inventory domains enter the map only via *new test files* under `core/equipment|production` (read-only coverage additions). Risk confidently bounded → quick verdict.

Exclusions: the earlier presentation-debt change set (route authority, deadline scale, preload net) is covered by `2026-09-16-presentation-debt-quick.md` and its code review; not re-audited here.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-BAG-1 | filter refs (component-local) | type query / toggle chip → `filtered` recomputed | Boundedness: filtered ⊆ entries, never superset | Value mutation (empty/unicode/huge query) | rendered cells + count | Component | Medium — cosmetic only, no persisted state |
| INV-BAG-2 | pagination (`useBagPagination`) | filter while on page N>1 | Synchronization: page resets to 1, no out-of-range empty grid | Reorder | `gridCells` after filter | Component | Medium — watch mirrors proven sort watch; not directly asserted |
| INV-BAG-3 | `entries` (stateVersion-driven) | bag mutation while filter active (equip/drink) | Stale state: filtered recomputes off fresh entries | Stale state | cells drop consumed item | Component | Low — `filtered` is a computed over `entries`; recompute is structural |
| INV-BAG-4 | chip toggle | re-click active chip | Idempotency: group resets to 'all' | Repeat | all cells restored | Component (tested both sections) | Low |
| INV-BAG-5 | pill group axis | pill with effects[] → 'other'; multi-effect pill groups under effects[0].type | Boundedness | Value mutation | chip filtering | Component + inspection | Low — axis mirrors existing 'effect' sort comparator |
| INV-BAG-6 | locale keys | render chips/search aria | Recoverability: missing key → raw key + warn | Degraded environment | i18nKeyParity test | Architecture test | Low — 10/10 green |
| INV-BAG-7 | `BagCell.onClick` | click filtered cell → equip/drink | Exactly-once: same cell objects flow through filter | Repeat/reorder | click handler identity | Inspection | Low — filter returns same T references into identical cell mapping |
| INV-E-1..6 | new core test files | deterministic execution | Determinism: seeded rolls, frozen clocks | Degraded environment | scoped vitest runs | Unit | Low — all 6 files self-contained, no production edits |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run` scoped: 6 new core tests + bag-section tests + MaterialBagFilter + i18nKeyParity + catalogPreloadParity | 11 files / 115 tests PASS | Recorded run; deterministic |
| `npm run type-check` (vue-tsc --build) | exit 0, clean | Full project including all agent edits |
| Component tests: search narrows cells (diacritic-insensitive), slot/effect chip filters, re-click resets to 'all' | 3/3 pill + 6/6 equipment | Real GameManager mount harness, vi-locale aria assertions |
| Lane-E audits (per-module coverage maps) | Genuine gaps filled; no duplicate coverage | Each agent audited existing system-level tests first |

## Findings

No Confirmed findings. Two Suspected/Coverage-gap items recorded below.

### QA-2026-09-16-BAG-1: filter→pagination reset is unwatched-behavior parity, not directly asserted

- Severity: Low
- Status: Coverage gap
- Invariant: Synchronization — filtering while on page N>1 must not leave an out-of-range empty grid.
- Preconditions: >1 page of items, user on page ≥2, then applies a filter reducing results below the current page.
- Reproduction: not authored (assertion would need a >pageSize seeded bag in the mount harness).
- Expected: `watch([searchQuery, activeGroup], resetPage)` returns to page 1 — identical contract to the proven sort watch.
- Actual: code inspection shows the watch mirrors the sort watch exactly; no direct test asserts the reset for filters.
- Evidence: code inspection only.
- Test file: none
- Owner subsystem: UI/input-lifecycle
- Blast radius: cosmetic — empty grid until next interaction; self-corrects on any page change.

### QA-2026-09-16-BAG-2: equipment/pill search axes are asymmetric

- Severity: Low
- Status: Suspected (cosmetic inconsistency, not a defect)
- Invariant: n/a — UX consistency.
- Equipment searches `entry.name` (template name / itemId fallback); pills search the composed `displayName` ("{Chat} - {Name}"). A query matching the equipment grade/set prefix visible in `nameSegments` will not match; the equivalent query does match on pills.
- Evidence: code inspection of both matchers.
- Owner subsystem: UI/input-lifecycle
- Blast radius: cosmetic; both axes are reasonable interpretations of "search by name".

## New or Changed QA Tests

- `EquipmentBagSection.test.ts` (+3): search narrows by name, slot chip filters, 'all'/re-click restore — proves INV-BAG-1/4 at component level.
- `PillBagSection.test.ts` (new, 3): same invariants for the pill section incl. diacritic-insensitive match.
- `EquipmentDissolve.test.ts` (13): commit-side guard ordering, per-quality reward boundaries, preview-discard contract.
- `EquipmentInstanceSnapshot.test.ts` (12): detach/value-contract, affix-removal direction, purity.
- `EquipmentRefine.test.ts` (20): deps-seam branches, slot-scoped discard semantics, consume-on-attempt.
- `EquipmentWash.test.ts` (15): pending accessor contract, deps-only guard branches, exalted edge cases.
- `ProductionCycles.test.ts` (10): factory contract — version stamp, cycleId uniqueness under frozen clock, rollSeed bounds, level clamping.
- `ProductionOffline.test.ts` (18): earliest-deadline ordering, shared-budget handoff, starvation semantics, iteration guard.

## Gaps and Residual Risk

- INV-BAG-2/BAG-1: filter→pagination reset not directly asserted (mirrors proven sort watch).
- INV-BAG-3: mutation-while-filtered recompute not directly asserted (structurally guaranteed by computed-over-entries).
- No visual/browser check — worktree, P14 isolated-worktree exception; verify on main checkout at branch finishing.
- Filter-bar markup + scoped styles now triplicated across 3 sections — maintainability note for a shared `BagFilterBar` primitive (reported in code review, not a QA finding).
- Lane-E test files are QA-write additions only; they assert current semantics (e.g. ProductionOffline starvation order) without adjudicating them.

## Pre-existing Failures

None observed in scoped runs. Vue `tooltip`-directive mount warnings in test output are pre-existing noise, unchanged.
