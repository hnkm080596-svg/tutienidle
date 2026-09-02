# QA Review: Item grade/quality drop pipeline

- Date: 2026-09-01
- Mode: deep (mandatory escalation from quick)
- Verdict: PASS WITH GAPS
- Task-owned paths:
  - `game/src/core/equipment/EquipmentSystem.ts`
  - `game/src/core/equipment/EquipmentSystem.test.ts`
  - `game/src/core/profession/ProfessionGrade.ts`
  - `game/src/core/profession/ProfessionGrade.test.ts`

## Scope and Risk Map

`changed-risk-map.mjs` mapped the two task-owned production paths to
`inventory-equipment` and `economy-and-progression`, with no unmapped paths.
The mapper marked the change as a deep-audit candidate because the drop
constructor feeds combat loot, persisted bag ownership, equipment stats, and
economy consumers. The quick review therefore escalated under the mandatory
loot/economy rule.

Current-code inspection followed `EquipmentSystem.createInstance()` into both
equipment-drop branches in `BattleLootSystem`, `EquipmentBag.add()`, the
GameManager equipment facade, stat application, and the current-save
validator/round trip. The changed constructor is otherwise synchronous and
stateless: it owns no clock, retry, tab, scene, or persistence lifecycle. Repeat,
reorder, low-FPS, interruption, and two-tab risks become reachable only in the
existing combat reward and save owners; their focused integration seams were
included below. All other dirty worktree paths belong to earlier rework tasks
and were excluded from the risk-map input and finding attribution.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-DROP-1 | Player realm / `ProfessionGrade` and `EquipmentSystem` | Create a drop at Mortal or Tribulation | Determinism: every roll keeps the realm's fixed grade; an unknown runtime mapping fails explicitly | Repeat, invalid value | Instance grade on 100 repeated rolls; explicit invalid-grade error | Unit | High: grade gates later equipment use and persistence |
| INV-DROP-2 | Drop RNG / `EquipmentSystem` | Roll one of five qualities | Determinism and boundedness: literal RNG values around 75/15/8/1.99/0.01 boundaries select the intended bucket | Boundary values, fixed sequence | Returned `instance.quality`; deterministic 2,000-roll common-tier frequencies | Unit | High: quality controls every downstream power/economy table |
| INV-DROP-3 | Affix roll / `EquipmentSystem` | Select random count, split prefix/suffix, optionally add Exalted | Boundedness: Hoàng has 0–1 and Tiên 0–5 base lines, all reachable; odd counts favor prefix; Exalted is one supreme tier-5 line only below 15% | Zero/max, threshold ±epsilon, repeated rolls | Exact affix count, pool, and tier on controlled RNG | Unit | High: prevents power inflation or unreachable roll outcomes |
| INV-DROP-4 | Item power/budget / `EquipmentSystem` | Roll implicit and initialize forge uses | Conservation/boundedness: implicit uses the selected quality multiplier before realm scale; total and remaining budgets equal 5/10/20/40/80 | Every quality, fixed main-stat range | Literal final stat and both forge-use fields | Unit | High: persisted combat power and refinement economy |
| INV-DROP-5 | Combat reward / `BattleLootSystem` and `EquipmentBag` | Enemy death creates and inserts equipment | Exactly-once: one eligible death produces one owned item and one reward/notification record | Repeat/update boundary, fixed RNG | Real GameManager bag, battle summary, and notification | Integration | High: combat-to-economy handoff |
| INV-DROP-6 | Current save / `SaveSystem` validator | Persist a populated current-schema equipment bag and reload/validate | Recoverability: new grade/quality/forge fields survive current-shape JSON round trip | Serialization interruption/corrupt shape boundary | Accepted normalized equipment entry; invalid shape rejection | Integration | High: persisted ownership |
| INV-DROP-7 | Existing equipment operations / `EquipmentSystem` | Wash/refine/dissolve a new-quality item | Isolation: Task 5 removes legacy drop rolls without removing the Task 8/9 compatibility adapter | Cross-system chain, regression | Focused EquipmentSystem operation tests and full suite | Unit/integration | Medium: later tasks explicitly own adapter removal |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `node .../changed-risk-map.mjs game/src/core/equipment/EquipmentSystem.ts game/src/core/profession/ProfessionGrade.ts` | Deep candidate | Two mapped domains, no unmapped paths |
| Focused RED before implementation | Expected failure | 22 failed, 39 passed; non-Hoàng controlled rolls were consumed by the hidden legacy roll and `realmFromGrade` was absent |
| `npm.cmd test -- src/core/equipment/EquipmentSystem.test.ts src/core/profession/ProfessionGrade.test.ts` | Passed | 2 files, 61 tests |
| Cross-system focused matrix (`EquipmentSystem`, `ProfessionGrade`, `ItemRoll`, real GameManager random equipment drop, `SaveRoundTrip`, `saveShapeValidation`) | Passed | 6 files, 122 tests |
| First complete `npm.cmd test` run | Passed | 276 files, 1,652 tests |
| Deep-matrix `npm.cmd run test` and required rerun | Pre-existing failure | Both later runs: 275 files/1,651 tests passed; untouched `src/assets/dongFuBuildingAssets.test.ts:66` timed out at 5 seconds |
| `npm.cmd run type-check` | Passed | Exit 0 |
| `npm.cmd run build` | Passed | Type-check plus Vite production build; 647 modules transformed |
| `npm.cmd run test:e2e` | Not verified as a complete suite | Success output was observed for create-to-combat, save-reload, and two visual variants; artifacts existed for all three visual variants and browser workers exited, but the runner never printed its final summary or tore down and was terminated after the hang |
| `git diff --check` | Passed | No whitespace errors; only repository line-ending warnings |

## Findings

No confirmed or suspected Task 5 defect remained after the focused and
cross-system checks. No QA reproduction test was added.

## New or Changed QA Tests

- `game/src/core/equipment/EquipmentSystem.test.ts`: Task TDD coverage for
  deterministic grade, literal quality boundaries, CI-stable common-tier
  distribution, complete Hoàng/Tiên substat-count reachability, forge budgets,
  implicit multipliers, and the Exalted threshold.
- `game/src/core/profession/ProfessionGrade.test.ts`: reverse mapping and
  explicit invalid-runtime boundary coverage.

## Gaps and Residual Risk

- The Playwright command did not provide a final suite exit/result because its
  runner hung after browser work. This is non-material to the non-UI,
  synchronous constructor change, but prevents an unqualified deep pass.
- Playwright emitted extensive existing missing-i18n-key and root-route warning
  noise. No UI/UX oracle was needed for this task.
- The full suite's asset-silhouette test is environment-sensitive: it passed in
  the first full run, then exceeded its unrelated 5-second timeout twice during
  the deep matrix. It does not share task-owned code or consumers.

## Pre-existing Failures

- `src/assets/dongFuBuildingAssets.test.ts:66` —
  `keeps every painted silhouette inside its registered bounds and on its baseline`
  timed out at 5 seconds in both the deep-matrix run and its mandatory rerun.
  Task 5 does not touch assets, canvas decoding, or this test.

## Fix Round 1 Addendum — affix capacity and Exalted reservation

The reviewer identified two confirmed defects in the initial Task 5 affix
allocator. Intended failing regressions reproduced both before the production
fix: kind-local allocation truncated valid counts, and a successful Exalted
chance could either choose an incompatible kind or lose its only compatible
stat to the base roll. The regressions now remain green.

### Added invariant ledger entries

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-DROP-3A | Production affix registry / `EquipmentSystem` | Roll Hoàng count 1 or Tiên count 5 on each equipment slot | Boundedness: a requested base count is realized whenever the combined eligible unique-stat capacity can satisfy it; preferred prefix-first allocation falls back to the opposite kind without relaxing policy | Exhaust one kind, max count, all slots | Exact total and literal prefix/suffix composition; unique, non-main, policy-valid stats | Unit/integration | High: silent line loss changes item power and drop economy |
| INV-DROP-3B | Exalted selection / `EquipmentSystem` | Tiên chance succeeds before base allocation | Determinism: success yields exactly one compatible supreme tier-5 bonus and base allocation cannot consume its stat | Wrong-kind RNG, reorder/base consumption, custom minimal registry | Base count + one bonus, exact supreme pool/tier, unique stats | Unit | High: old effective chance was slot-dependent and at most half the contract |
| INV-DROP-3C | Quality/normal-affix boundaries / `EquipmentSystem` | Roll at cumulative quality thresholds and normal Tiên max counts | Boundedness: exact thresholds keep the preceding bucket; normal lines use an unlocked pool and do not exceed quality tier cap | Exact boundary, max value | Literal qualities at 0.75/0.90/0.98/0.9999; pool/tier assertions | Unit | Medium: prevents hidden boundary or integration drift |

### Resolved confirmed findings

#### QA-2026-09-01-003: Base affix count truncated at kind exhaustion

- Severity: Medium
- Status: Confirmed by intended RED, resolved in Fix Round 1
- Invariant: A realizable rolled count uses combined eligible unique-stat
  capacity while preserving the preferred kind where possible.
- Preconditions: Production slot has fewer preferred-kind candidates than the
  prefix-first target but sufficient opposite-kind candidates.
- Reproduction: Force Hoàng count 1 and Tiên count 5 across all six slots.
- Expected: Exact rolled count with literal slot-specific composition.
- Actual before fix: Hoàng helmet/boots returned 0; Tiên
  helmet/armor/boots/necklace returned 3/3/2/4.
- Evidence: Focused pre-fix run, 13 failures total; relevant regression table
  now passes.
- Test file: `game/src/core/equipment/EquipmentSystem.test.ts`
- Owner subsystem: `EquipmentSystem` base-affix allocator
- Blast radius: Drop power and downstream loot/economy value for four slots.

#### QA-2026-09-01-004: Exalted success could produce no bonus

- Severity: Medium
- Status: Confirmed by intended RED, resolved in Fix Round 1
- Invariant: A successful Tiên chance adds exactly one compatible supreme
  tier-5 line without duplicating the main/base stats.
- Preconditions: The random kind is incompatible with the slot, or a base
  Tiên line selects the slot's sole compatible supreme stat first.
- Reproduction: Force the old wrong-kind value on all six slots; use a
  two-affix registry with supreme registered before a normal prefix.
- Expected: Base count plus one compatible, unique tier-5 supreme bonus.
- Actual before fix: No Exalted line was added; the custom registry returned
  one total line instead of two.
- Evidence: Focused pre-fix run, all wrong-kind rows and consumption fixture
  failed; all now pass.
- Test file: `game/src/core/equipment/EquipmentSystem.test.ts`
- Owner subsystem: `EquipmentSystem` Exalted allocator
- Blast radius: Effective Exalted chance and Tiên item power on every slot.

### Fix-round verification evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| Pre-fix `npm.cmd test -- src/core/equipment/EquipmentSystem.test.ts` | Expected RED | 13 failed, 65 passed: exact count truncation, wrong-kind Exalted loss, and base-supreme consumption reproduced |
| Post-fix focused EquipmentSystem test | Passed | 1 file, 78 tests; all six slots and exact quality thresholds covered |
| Cross-system focused matrix | Passed | 6 files, 145 tests: EquipmentSystem, ProfessionGrade, ItemRoll, real GameManager random drop, SaveRoundTrip, save-shape validation |
| `npm.cmd run type-check` | Passed | Exit 0 |
| Full `npm.cmd test` | Passed | 276 files, 1,675 tests; the earlier unrelated asset timeout did not recur |
| `npm.cmd run build` | Passed | Type-check plus Vite production build; 647 modules transformed |
| `npm.cmd run test:e2e` | Passed scenarios; teardown gap remains | Playwright printed `6 passed (4.2m)` but again did not terminate; only the exact runner process tree was stopped, producing a non-zero shell exit from forced teardown |
| Fix-round risk map | Bounded | `inventory-equipment`, no unmapped paths, `deepAuditCandidate: false`; this addendum remains under the already-escalated deep audit |

### Updated findings and verdict

The two allocator/Exalted defects addressed in Fix Round 1 no longer remained,
but the original statement that no coverage gap remained was too broad. That
round covered normal pool/tier integration only with Tiên production data and
production-derived expectations; it did not independently exercise lower
qualities or an affix with no tier eligible under the quality cap. Fix Round 2
below closes that gap and the defect it exposed. The deep verdict remains
**PASS WITH GAPS** because Playwright does not return a clean process exit
after all six scenarios report success.

The production fix changes only synchronous affix selection. It does not add a
new persistence field, transaction, timer, Vue/Pinia/Phaser owner, or save
migration. Existing combat-drop and current-save integration seams remain
green. The lower-quality/tier-eligibility coverage gap is tracked and resolved
in Fix Round 2 below.

## Fix Round 2 Addendum — lower-quality gates and no eligible tier

### Added invariant ledger entry

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-DROP-3D | Quality-gated affix candidates / `EquipmentSystem` | Roll a normal affix whose pool may be locked or whose first tier is above the quality cap | Boundedness: lower qualities use literal unlocked pools/caps, and a definition with no eligible tier is excluded before random selection so another candidate/kind may satisfy the count | Pool miswire, future/custom data, same-kind competitor, opposite-kind fallback | Literal selected pool/tier for Hoàng/Huyền/Địa/Thiên; exact valid affix ID instead of above-cap candidate | Unit | High: malformed/future data could bypass quality power gates and silently truncate fallback |

### Resolved confirmed finding

#### QA-2026-09-01-005: Normal affix could exceed quality tier cap

- Severity: Medium
- Status: Confirmed by intended RED, resolved in Fix Round 2
- Invariant: An affix with no tier at or below the quality cap is not a normal
  roll candidate and must not block another valid candidate or kind fallback.
- Preconditions: An allowed-pool affix has only tiers above `maxTier`.
- Reproduction: Register a basic prefix with only tier 5 for Hoàng, alongside
  either a valid tier-1 prefix or only a valid tier-1 suffix; force count 1 and
  the old candidate choice.
- Expected: The valid tier-1 line is emitted, using same-kind selection or
  opposite-kind fallback respectively.
- Actual before fix: Both fixtures emitted the invalid basic prefix at tier 5.
- Evidence: Pre-fix focused run failed 2/84 for the intended affix ID/tier
  mismatch; the same file now passes 84/84.
- Test file: `game/src/core/equipment/EquipmentSystem.test.ts`
- Owner subsystem: `EquipmentSystem` normal-affix candidate/tier selection
- Blast radius: Future/custom affix data, item power, and realizable substat
  counts for every quality below the affix's first tier.

### Fix-round verification evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| Pre-fix focused EquipmentSystem test | Expected RED | 1 file: 2 failed, 82 passed; both failures emitted the tier-5-only Hoàng affix |
| Post-fix focused EquipmentSystem test | Passed | 1 file, 84 tests; includes literal lower-quality pool/tier cases and both invalid-tier fallback paths |
| Cross-system focused matrix | Passed | 6 files, 151 tests |
| `npm.cmd run type-check` | Passed | Exit 0 |
| Full `npm.cmd test` | Passed | 276 files, 1,681 tests |
| `npm.cmd run build` | Passed | Type-check plus Vite production build; 647 modules transformed |

### Updated findings and verdict

No confirmed implementation defect remains from Fix Rounds 1–2. Pool and tier
coverage now uses literal independent lower-quality fixtures, while production
slot composition and Exalted guarantees remain covered. The verdict remains
**PASS WITH GAPS** only for the existing Playwright teardown limitation already
documented above; Fix Round 2 changes no UI or lifecycle boundary.
