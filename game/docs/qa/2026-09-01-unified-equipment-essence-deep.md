# QA Review: unified equipment essence material

- Date: 2026-09-01
- Mode: deep (economy/material identity changes cross manual dissolve, auto-dissolve, refinement, preview, UI binding, and persisted inventory)
- Verdict: PASS WITH GAPS
- Task-owned production paths: `game/src/core/equipment/TinhHoaMaterial.ts`, `game/src/data/materials/materials.ts`, `game/src/core/equipment/RefinementBalance.ts`, `game/src/core/equipment/EquipmentBag.ts`, `game/src/core/equipment/EquipmentSystem.ts`, `game/src/core/game/GameManager.ts`, `game/src/components/panels/EquipmentHallPanel.vue`, `game/src/core/economy/VendorBalance.ts`

## Scope and Risk Map

The task removes the realm-specific equipment essence materials and routes every current equipment dissolve/refine consumer through the single `luyen_khi_tinh_hoa` identity. Reward quantities now come from `ITEM_QUALITY_ESSENCE_RANGE`, while the unrelated body-cultivation material `tinh_hoa_pham_the` remains registered. The equipment-hall presentation is unchanged; only its existing computed owned-amount binding now reads the unified material. Fix round 1 raises the unified stack limit from the unsafe reachable cap `9,999` to `Number.MAX_SAFE_INTEGER`, matching the existing spirit-stone currency convention.

The changed-risk mapper routed the exact task-owned paths to combat, economy/progression, inventory/equipment, Pinia/Phaser synchronization, time/offline, and UI consumers and marked the change as a deep-audit candidate. Static one-hop inspection narrowed the material paths to material registration, manual/automatic dissolve, refinement costs, preview aggregation, vendor valuation, the material bag, the equipment-hall computed binding, and current-save serialization. The broad `GameManager` mapping also reaches unrelated time/combat code, but this task does not add a clock, async boundary, network owner, or tick-driven mutation.

Pre-existing Task 1-7 changes in the shared worktree were excluded except where Task 12 intentionally consumes the already-established item-quality range. The fix-round risk mapper routed the exact production repair to inventory/equipment. Its three GameManager test paths were unmapped by filename, then manually routed to inventory/equipment, economy conservation, and current-save persistence after code inspection. Old-save migration is explicitly out of scope under the development-build policy.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-ESS-1 | Material registry | Register all material definitions at boot | The equipment essence catalog contains exactly `luyen_khi_tinh_hoa`; none of the nine retired equipment IDs survive; `tinh_hoa_pham_the` remains | Stale identity, cross-system chain | Exact catalog ID assertions and registration lookup | Vitest unit | Critical |
| INV-ESS-2 | Equipment bag + material bag | Manually dissolve one or more unprotected instances | Every accepted instance is removed once and grants only unified essence in its quality range | Repeat, duplicate input, value mutation | Reward aggregation, bag removal, material credit | Vitest unit/integration | Critical |
| INV-ESS-3 | Protected/equipped equipment | Request a mixed invalid dissolve | Protected/equipped constraints remain atomic and do not silently destroy or reward an ineligible item | Reorder, interruption | Existing dissolve rejection/conservation assertions | Vitest unit | Critical |
| INV-ESS-4 | Auto-dissolve policy | Insert an item above the soft cap | Auto-dissolve emits the unified material with the deterministic minimum for that quality and preserves protected items | Boundary, policy race | Reward identity/amount and retained protected item | Vitest unit | High |
| INV-ESS-5 | Preview projection | Preview multiple grades/qualities | Preview aggregates all accepted rewards under one material key and preserves the summed minimum/maximum quality ranges | Reorder, aggregation | One preview row with exact combined range | Vitest unit | High |
| INV-ESS-6 | Refinement transaction | Refine equipment of every grade | Essence cost always reads/removes `luyen_khi_tinh_hoa`; grade-specific spirit-stone pricing and failure atomicity remain intact | Boundary, partial failure | Cost ownership, unchanged balances on rejection, result state | Vitest unit | Critical |
| INV-ESS-7 | Game-manager application + save | Submit a duplicate instance ID, dissolve, build and validate a save | The instance is consumed and rewarded once, the unified stack is persisted, and the current save shape remains valid | Duplicate, repeat, persistence chain | Real manager/material bag plus serialized validated snapshot | Vitest integration | Critical |
| INV-ESS-8 | Equipment-hall derived state | Material amount changes and UI state version advances | Existing panel displays the current unified essence amount through computed derived state without layout or interaction changes | Stale reactive state | Rendered owned amount | Vue component test | High |
| INV-ESS-9 | Vendor valuation | Value unified essence in each grade/realm context | Removing material-tier identity does not remove the caller's realm-context price scaling | Boundary, stale lookup | Explicit per-realm price expectations using the unified ID | Vitest unit | High |
| INV-ESS-10 | Equipment bag + material bag + save | Credit manual, normal auto-dissolve, and restore auto-dissolve rewards at the former `9,999` boundary | An accepted destructive dissolve must credit its full reward after removing equipment; the resulting finite amount must remain current-save valid | Boundary, overflow, interruption, persistence | Three former-cap transition assertions plus serialized shape validation | Vitest integration | Critical |

## Attack Coverage

- Repeat/duplicate: duplicate instance IDs are rewarded once. A controlled pre-fix diagnostic proved the old `9,999` cap lost value after accepted destructive transitions; fix-round regressions now cross that boundary through manual, normal auto, and restore auto-dissolve.
- Reorder/interruption: manual dissolve/refine rejection and conservation tests retain their atomicity oracles; no new intermediate persisted state was introduced.
- Boundary/value mutation: quality minimum/maximum reward ranges, protected items, insufficient resources, and per-realm vendor contexts are covered.
- Stale/reactive state: the panel reads the shared constant inside its existing computed/state-version convention, and the component assertion observes the changed amount.
- Persistence/cross-system: a real `GameManager` dissolve reaches `MaterialBag`, then `buildGameSave`, JSON round-trip, and current-shape validation after the amount crosses `9,999`.
- Concurrency, cross-tab, low-FPS, clock rollback, offline delta, and soak: no timer, network, tab-coordination, frame-loop, or elapsed-time behavior changed. They were reviewed as non-material for this identity migration rather than simulated.

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| Temporarily restore only the pre-fix `stackLimit: 9999`, then run `npm.cmd run test -- src/core/game/GameManager.dissolveUnifiedEssence.test.ts` | EXPECTED FAIL | Post-takeover diagnostic, not claimed as original RED: 1 requested file, 4 own tests; manual, normal auto, and restore auto-dissolve each remained at `9,999` instead of `10,000`. The single production value was immediately restored to `Number.MAX_SAFE_INTEGER`. |
| `npm.cmd run test -- src/core/game/GameManager.dissolveUnifiedEssence.test.ts` | PASS | 1 requested file, exactly 4 own tests; duplicate exactly-once persistence plus manual, normal auto, and restore auto-dissolve across the former cap |
| `npm.cmd run test -- src/data/materials/materials.test.ts src/core/equipment/EquipmentInstance.test.ts src/core/equipment/EquipmentBag.autoDissolve.test.ts src/core/equipment/EquipmentSystem.test.ts src/core/game/GameManager.buildSnapshot.test.ts src/core/game/GameManager.previewDissolveRewards.test.ts src/core/game/GameManager.dissolveUnifiedEssence.test.ts src/components/panels/EquipmentHallPanel.test.ts src/components/panels/EquipmentPaperdoll.test.ts src/composables/useEquipmentTooltip.test.ts` | PASS | 10 files, 113 tests; all migrated factory consumers plus unified catalog/dissolve/save behavior |
| `npm.cmd run test` | PASS | 278 files, 1681 tests; removing executable test-module imports also removed five unintended transitive suite collections |
| `npm.cmd run type-check` | PASS | `vue-tsc --build`, zero errors |
| `npm.cmd run build` | PASS | 648 modules transformed; existing large-chunk warning and plugin timing output only |
| `npm.cmd run test:e2e` | HISTORICAL NOT VERIFIED | The earlier suite run produced passing-case output and visual artifacts but did not terminate or print a final summary; it was stopped after output ceased. Fix round 1 did not rerun it, per takeover instruction. |
| `npm.cmd run test:e2e -- --workers=1 --reporter=line` | HISTORICAL NOT VERIFIED | The earlier isolation retry advanced through browser cases, emitted existing router/i18n warnings, then stopped producing output without a final summary; it was terminated safely. Fix round 1 retained this runner gap. |
| `rg` stale-symbol and import scans | PASS | No obsolete helper/table/generator references and no import from `EquipmentInstance.test`; retired IDs occur only in the catalog test's explicit negative list |

## Findings

### QA-2026-09-01-006: reachable unified essence cap discarded accepted dissolve rewards

- Severity: High
- Status: Confirmed; resolved in fix round 1
- Invariant: An accepted destructive dissolve must credit its full reward after removing equipment.
- Preconditions: The unified essence stack contains `9,999`, the original registered limit, and an eligible item is manually dissolved, auto-dissolved during normal obtain, or auto-dissolved during restore.
- Reproduction: Temporarily restore only `stackLimit: 9999` and run `npm.cmd run test -- src/core/game/GameManager.dissolveUnifiedEssence.test.ts`.
- Expected: The item transition completes and unified essence becomes `10,000`.
- Actual: All three paths remove one item but the amount remains `9,999`; `MaterialBag.add()` returns overflow and each caller ignores it.
- Evidence: Controlled post-takeover diagnostic failed the three former-cap cases for the intended `expected 9999 to be 10000` reason; restoring `Number.MAX_SAFE_INTEGER` made all four file-local tests pass.
- Test file: `game/src/core/game/GameManager.dissolveUnifiedEssence.test.ts`
- Owner subsystem: `MaterialBag` capacity plus `GameManager`/`EquipmentBag` destructive reward application
- Blast radius: Manual dissolve, normal obtain-time auto-dissolve, and restore-time auto-dissolve at a reachable persisted amount.
- Resolution: The unified currency-like material now follows the spirit-stone `Number.MAX_SAFE_INTEGER` convention. The former-cap result also passes JSON round-trip and current-save validation.

### Suspected

None.

### Coverage Gaps

- **QA-GAP-1 (Low, runner lifecycle):** the full Playwright command did not produce a final result in either its normal or single-worker isolation run. Both attempts reached browser test execution and then became silent; no failing assertion or runtime evidence tied the stall to Task 12. Task-specific behavior is covered at unit, Vue component, real-manager integration, persistence-shape, full Vitest, type-check, and build layers. The browser matrix remains `Not verified`, not a production defect.

## New or Changed QA Tests

- `game/src/core/game/GameManager.dissolveUnifiedEssence.test.ts` now contains four isolated tests: duplicate exactly-once persistence, manual dissolve across `9,999` with JSON/current-save validation, normal auto-dissolve across `9,999`, and restore auto-dissolve across `9,999`.
- `game/src/core/equipment/EquipmentInstance.fixture.ts` is the side-effect-free shared factory used by this and the other migrated test consumers; focused execution no longer collects `EquipmentInstance.test.ts` transitively.

The production repair and fixture isolation were completed in the development fix round before this updated QA run; no production code was changed during the QA-only evidence/reporting phase.

## Gaps and Residual Risk

- Old saves containing the retired equipment essence IDs are not migrated. This is intentional under the repository's development-build rule.
- `Number.MAX_SAFE_INTEGER` is effectively unbounded for the game's currency model and is the existing spirit-stone convention, but it is still a numeric ceiling rather than a proof of mathematically unlimited storage. `MaterialBag` continues to report overflow at that ceiling; JavaScript/JSON cannot safely represent larger integer balances under the current number model.
- There is no browser-specific click-through for dissolve/refine in this audit. The unchanged panel layout and interaction surface are covered by the component binding test, while the economy and persistence transition is covered below the browser layer.
- The full Playwright runner lifecycle gap is recorded above. Existing router/i18n warnings and the large-bundle warning are outside Task 12 scope.

## Pre-existing Failures

No deterministic pre-existing test failure was observed. The two non-terminating Playwright attempts are recorded as a verification gap because neither emitted a failing test oracle or final suite result.
