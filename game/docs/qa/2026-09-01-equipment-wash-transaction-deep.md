# QA Review: equipment Wash transaction rework

- Date: 2026-09-01
- Mode: deep (the Wash path mutates equipment, two inventory currencies, the remaining forge budget, equipped stat projection, preview/commit state, and persisted save data)
- Verdict: PASS WITH GAPS
- Task-owned production paths: `game/src/core/equipment/EquipmentSystem.ts`, `game/src/core/equipment/RefinementBalance.ts`, `game/src/core/game/GameManager.ts`, `game/src/composables/useEquipmentActions.ts`, `game/src/components/panels/EquipmentHallPanel.vue`, `game/src/core/presentation/ActionAvailability.ts`

## Scope and Risk Map

Task 8 removes ore from the executable Wash contract and replaces the retired nine-grade balance tables with five `ItemQuality` tables. A successful Wash now spends quality-scaled `luyen_khi_tinh_hoa`, 100 generic spirit stones, and one forge use, while rerolling only affixes. The existing ore selector remains visible but disconnected by the recorded Task 19 ownership ruling; this audit treats that presentation debt as intentional and verifies that neither availability nor runtime mutation depends on it.

The changed-risk mapper routed the task-owned paths to inventory/equipment, economy/progression, persistence, UI-derived state, and the broad `GameManager` synchronization surface, and marked the change as a deep-audit candidate. Static caller inspection covered direct and preview calls from `GameManager`, the equipment action composable, and the equipment-hall panel. No timer, autonomous loop, network writer, or asynchronous mutation boundary was added.

Pre-existing Tasks 1-7/12 changes in the shared worktree were excluded except where Task 8 intentionally consumes the established `ItemQuality`, forge-budget, and unified-essence contracts. Old-save migration is explicitly out of scope under the repository's development-build policy.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-WASH-1 | Equipment, material bag, spirit stones | Reject locked, favorite, exhausted, missing-essence, or missing-stone requests | Every rejection is atomic: affixes, forge budget, unified essence, and spirit stones remain unchanged | Boundary, interruption | Exact result reason plus before/after state | Vitest unit | Critical |
| INV-WASH-2 | Material bag + player currency | Accept Wash for each quality | Spend exactly the quality cost `2/5/9/13/18`, exactly 100 stones, no ore, and exactly one forge use | Value mutation, stale dependency | Exact deltas and unchanged ore sentinel | Vitest unit/integration | Critical |
| INV-WASH-3 | Preview state + equipment instance | Preview then commit the selected roll | Preview spends once and does not install affixes; commit installs that preview without spending a second time or decrementing forge uses again | Repeat, reorder | Cost/forge snapshots before preview and after commit | Vitest unit/integration | Critical |
| INV-WASH-4 | Equipment affix projection | Reroll every line-count bin and tier threshold for all qualities | Every count in `[0, quality.max]` is reachable; literal cumulative tier boundaries use the quality table; output belongs to an unlocked pool and honors declared slot compatibility | Boundary, deterministic RNG, value mutation | Exact count/tier/pool/slot/stat/value assertions plus mutation probes | Vitest unit | Critical |
| INV-WASH-5 | Tiên-quality equipment | Hit the 15% Exalted branch at adjacent boundaries | `0.149999` adds exactly one compatible tier-5 supreme affix; exactly `0.15` does not; non-Tiên qualities never enter the bonus branch | RNG boundary, pool exhaustion, wrong-quality branch | Exact base-plus-one count and supreme tier | Vitest unit | High |
| INV-WASH-6 | Equipment identity and equipped modifiers | Complete direct Wash or preview then commit on a genuinely equipped item | Old affix modifiers are removed; main/new modifiers exist exactly once; preview alone leaves the old projection unchanged | Cross-system chain, stale projection, repeat | Exact source-scoped modifier IDs before/preview/commit | Vitest unit/integration | Critical |
| INV-WASH-7 | Equipment-hall derived state | Select a Hoang item while the obsolete ore UI has no usable ore | Availability is based on forge uses, unified essence, and generic stones rather than the displayed ore selector | Stale derived state | Enabled Wash control and current forge caption | Vue component | High |
| INV-WASH-8 | Real GameManager + current save | Preview, commit, build a save, JSON round-trip, validate, and restore into a freshly registered manager | Final affixes/forge use, zero spent currencies, a nonzero ore sentinel, and the equipped modifier projection survive the current-save restore chain | Persistence, repeat, stale in-memory projection | Fresh manager bags, instance, and exact source-scoped modifiers | Vitest integration | Critical |
| INV-WASH-9 | Type/API surface | Compile and scan all callers | Removed ore arguments/errors and retired balance constants have no executable references | Stale symbol, partial migration | Type-check and literal `rg` scans | Static | High |
| INV-WASH-10 | Timing/lifecycle | Review transaction ownership | Wash is synchronous and manager-owned; no elapsed-time, frame-loop, offline, tab, or network transition is introduced | Low FPS, clock rollback, two tabs | Static ownership inspection | Inspection | Low |

## Attack Coverage

- Repeat/reorder: preview followed by commit proves that the cost and forge budget are consumed once, while direct Wash remains a single atomic transaction.
- Interruption/partial failure: all five resource/ownership rejection classes assert unchanged equipment and both resource owners. A forced incompatible registry proves `no_eligible_affix` also preserves affixes, forge use, essence, and stones.
- Boundary/value mutation: every count bin for every quality, the just-below/at cumulative tier thresholds, the maximum RNG boundary, exact `0.149999`/`0.15` Exalted split, non-Tiên exclusion, pool membership, and declared-slot compatibility are deterministic.
- Stale/reactive state: the Vue component proves Hoang Wash is not disabled by the retained ore selector and reflects the current forge count after action-state advancement.
- Persistence/cross-system: the deep test uses a real `GameManager`, genuine equip, a nonzero ore stack, preview/commit, serialized save, JSON round-trip, validation, then restore into a second freshly registered manager with exact equipment/material/modifier assertions.
- Concurrency, cross-tab, low-FPS, clock rollback, offline delta, and soak were reviewed as non-material because this change does not add an asynchronous writer, timer, frame-loop mutation, or elapsed-time calculation.

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm.cmd run test -- src/core/equipment/EquipmentSystem.test.ts src/core/equipment/RefinementBalance.test.ts src/components/panels/EquipmentHallPanel.test.ts` before production edits | EXPECTED FAIL | 3 failed files; 17 failed / 83 passed. The new no-ore calls reached the old ore-first signature, the five-quality balance exports were absent, and the panel remained ore-gated. |
| `npm.cmd run type-check` before production edits | EXPECTED FAIL | New no-ore call sites produced two argument-type errors and the two new balance exports were missing. |
| Same focused three-file test command after implementation | PASS | 3 files, 100 tests; guard atomicity, five-quality costs/tier validity, zero/max counts, preview/commit, Exalted, and component availability passed. |
| `npm.cmd run test -- src/core/game/GameManager.washTransaction.test.ts` | PASS | 1 file, 1 deep integration test; exact resources/forge use, no ore, main-stat preservation, preview/commit, build-save, JSON round-trip, and current-shape validation. |
| Focused ESLint on all Task 8 production/tests | PASS | Zero lint errors. |
| `npm.cmd run test` after the deep test was added | PASS | 280 files, 1691 tests. |
| `npm.cmd run type-check` after the deep test was added | PASS | `vue-tsc --build`, zero errors. |
| `npm.cmd run build` after the deep test was added | PASS | 648 modules transformed; existing large-chunk warning only. |
| `npm.cmd run test:e2e` | NOT CLEANLY VERIFIED | All 6 Playwright cases printed `ok`, including the last ink-wash visual case. After output ceased, the command did not terminate or print a final suite summary and was interrupted; the output contained extensive existing router/i18n warnings. No failing assertion implicated Wash. |
| `rg` caller/stale-symbol scans | PASS | All executable Wash callers use the no-ore API. No references remain to ore arguments/errors or the named retired Wash/refinement constants; the intentionally retained selector markup is presentation-only. |

## Findings

### Confirmed

None.

### Suspected

None.

### Coverage Gaps

- **QA-GAP-1 (Low, runner lifecycle):** the full Playwright command executed all six cases to printed `ok` results but did not terminate or emit its final summary. Because it required interruption and exited nonzero, the browser matrix is recorded as `Not cleanly verified`, not as a pass or a product defect. Task-specific behavior has unit, Vue component, real-manager integration, persistence, full Vitest, type-check, and build evidence.
- **QA-GAP-2 (Low, presentation debt):** the obsolete ore selector remains visible by the recorded Task 19 ruling. Task 8 proves it no longer gates or reaches runtime Wash, but does not add a browser click-through for the deliberately transitional panel.

## New or Changed QA Tests

- `game/src/core/game/GameManager.washTransaction.test.ts` now seeds real ore, genuinely equips the source item, verifies preview/commit projection, JSON-round-trips the save, and restores a fresh manager before asserting affixes, forge use, both spent currencies, unchanged ore, and exact modifiers.
- `game/src/core/equipment/EquipmentSystem.test.ts` now covers every count bin, literal tier thresholds, Exalted boundaries/non-Tiên exclusion, unlocked-pool/slot decoys, no-eligible atomicity, and direct plus preview/commit modifier refresh.
- `game/src/core/equipment/RefinementBalance.test.ts` and `game/src/components/panels/EquipmentHallPanel.test.ts` retain the five-quality balance and disconnected-ore UI contract coverage.

No production code was modified during the QA-only evidence and reporting phase.

## Gaps and Residual Risk

- The visible ore selector is intentionally deferred to Task 19 and can be confusing during this intermediate development state, although it is no longer executable input.
- Old save migration is intentionally unsupported during the development phase.
- The separate Task 10 plan remains the owner of removing the remaining transitional forge-budget scaling behavior; Task 8 only consumes one existing forge use as specified.
- Existing router/i18n warning volume and the Playwright runner teardown gap are outside Task 8 scope.

## Pre-existing Failures

No deterministic pre-existing assertion failure was observed. The non-terminating Playwright process is recorded as a verification gap because every case printed `ok` and no failing oracle or final suite result was emitted.

## Fix Round 1/5 — deterministic contract evidence

Production behavior required no repair. The first run of the new tests had four fixture-authoring failures: three decoy affixes declared a slot that rejected their stat during registry validation, and the manager assertion still named the replaced old affix. The fixtures were corrected to use `castSpeedPercent` on a valid-but-incompatible `boots` declaration and the actual `suffix_accuracy` source affix. These were test setup errors, not evidence against Wash.

### Controlled mutation evidence

Each probe changed one production condition, ran the narrowest relevant test, and was reverted immediately before confirming GREEN:

| Temporary mutation | Expected sensitivity result | Restored result |
| --- | --- | --- |
| Force `chosenTier = eligibleTiers[0]` | EXPECTED FAIL: 14 cumulative-boundary cases received tier 1 instead of tier 2/3 | `EquipmentSystem.test.ts`: 128/128 PASS |
| Disable the equipped refresh inside `commitWashAffixes` | EXPECTED FAIL: both unit projection tests retained the old accuracy modifier; manager integration also retained stale modifiers (3 failures total) | Focused two-file matrix: 129/129 PASS |
| Force `lineCount = maxLines` | EXPECTED FAIL: 29 cases failed, including all five every-bin rows and the zero-count contract | `EquipmentSystem.test.ts`: 128/128 PASS |
| Change Exalted comparison from `< 0.15` to `<= 0.15` | EXPECTED FAIL: the exact `0.15` case produced 6 affixes instead of 5 | Exalted boundary target: 2/2 PASS |
| Bypass `rolled.length !== lineCount` rejection | EXPECTED FAIL: `no_eligible_affix` returned success and would enter the spend path | Atomic rejection target: 1/1 PASS |
| Bypass unlocked-pool filtering | EXPECTED FAIL: Hoang/Huyen/Dia selected their locked-pool decoys (3 failures) | Eligibility target: 5/5 PASS after restoration |
| Bypass declared-slot filtering | EXPECTED FAIL: Thien/Tien selected their boots-only decoys on a weapon (2 failures) | Eligibility target: 5/5 PASS after restoration |

No mutation marker remains in production; literal scans and `git diff --check` passed after all restorations.

### Fix-round verification

- Focused Task 8 matrix: `npm.cmd run test -- src/core/equipment/EquipmentSystem.test.ts src/core/equipment/RefinementBalance.test.ts src/components/panels/EquipmentHallPanel.test.ts src/core/game/GameManager.washTransaction.test.ts` — PASS, 4 files / 139 tests.
- Final `npm.cmd run type-check` — PASS, zero errors. An initial fix-round check found one test-only narrow-array inference error; annotating the deterministic RNG queue as `number[]` resolved it.
- Focused ESLint — zero errors; two inherited `GameManager.ts` unused-symbol warnings outside Task 8 remain.
- Final full `npm.cmd run test` — PASS, 280 files / 1729 tests.
- Production build was not repeated: fix round 1 changed only tests and three `GameManager` comments, while the Task 8 executable build had already passed at 648 modules.
- Playwright was not repeated; the original all-six-printed-`ok` but non-terminating runner gap remains `Not cleanly verified`.

The clearly obsolete GameManager comments that still described Wash as ore/realm-tier based were corrected before the fix-round QA-only evidence phase. No executable production code changed, and no product defect or learned-defect entry was created.
