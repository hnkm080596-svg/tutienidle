# QA Review: M-F-TECHNIQUE frozen-cycle model

- Date: 2026-09-23
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `src/core/technique/{Technique,TechniqueProgression,TechniqueSystem}.ts`, `src/core/tribulation/TribulationOutcomeService.ts`, `src/core/game/{GameManagerRealmAdvanceOps,GameManagerSaveRestore,BattleLootSystem,battleLootTestSetup}.ts`, `src/core/progression/{NodeSystem,ProgressionNode}.ts`, `src/components/common/BreakthroughRequirementPanel.vue`, `src/services/save/saveVersion.ts`, `src/data/technique/Techniques.ts`, `src/locales/{en,vi}.json`, plus the 22 task-owned test files listed in the branch diff.

## Scope and Risk Map

changed-risk-map.mjs routed `combat-and-tribulation`, `economy-and-progression`, `save-and-cloud`, `ui-input-lifecycle` and returned `deepAuditCandidate: true` (critical state boundary: save-and-cloud; 4-domain change). Escalation decision: NOT escalated to deep — the save-surface change is strictly additive (`gradeHistory` required field) plus strictly stronger rejection inside the existing v75 reject-old boundary; no recovery/migration flow changed, and the persisted semantics are pinned by the C2C-approved spec r36 + a dedicated coherence-preflight rejection suite. Manual routing for the `unmappedPaths` items: all are the mission's own technique/save/test files — already routed by the four mapped domains; no item carried unroutable risk.

One-hop consumers inspected in current code: `GameManager.realmAdvanceOps.applyTechniqueRealmTransition` (freeze seam), `GameManager.techniqueSystem` mirror sink → `activePlayer.techniqueProgress` (NodeSystem gates), `useStateVersion` refresh contract for the panel, `saveShapeValidation` version gate (upstream of preflight).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-MFT-1 | TechniqueSystem.gainMastery | Realm-scaled ceiling cascade | Boundedness + Conservation | Value mutation (amount 0/huge, realmLevel 0/huge, mortal) | rank clamps at min(18, realmLevel), mastery clamps/discards overflow, ceiling 0 gains 0 | unit | High: persisted progression corruption |
| INV-MFT-2 | TechniqueSystem.sealFrozenCycle | Realm-exit freeze seam | Idempotency + Exactly-once | Repeat (double exit, re-freeze) | existing sealed record never overwritten; in-band exit no-op | unit + tribulation integration | High |
| INV-MFT-3 | advanceTechniqueGrade | Catch-up transaction | Atomicity + Monotonicity | Reorder + repeat | pinned order: defensive seal -> grade+1 -> skipped-entry seal -> rank/mastery 0 -> inheritance -> mirror; second advance refuses | unit | High |
| INV-MFT-4 | GameManagerSaveRestore preflight | v75 key-set coherence | Recoverability + Boundedness | Value mutation (missing field, bad state/rank, stray key, non-integer, in-band sealed record, huge grade) | canonical key set `{1..grade-1} + {grade iff lagging}` enforced; non-integer/huge grade rejects without RangeError | boundary unit | High: save corruption surface |
| INV-MFT-5 | projectTechniqueCompletion | Panel projection | Synchronization | Stale state | sealed record returned verbatim; live cycles project via resolve | unit + component | Medium |
| INV-MFT-6 | getEffectiveTechniqueRank | Gate authority | Monotonicity | Cross-system | lagging holder contributes rank 0 to gates; owned surplus levels legal | authored node + NodeSystem tests | High: progression gating |
| INV-MFT-7 | TribulationOutcomeService seam | Freeze before realmLevel write | Timing boundary + Determinism | Timing boundary | `{12,'dai_thanh'}` sealed using departing realmLevel=12 before reset | integration | High |
| INV-MFT-8 | BreakthroughRequirementPanel | Unperfected warning | Synchronization | Degraded env (no technique), sealed vs live | warning iff `.completionState !== 'vien_man'`; hidden at rank 18 | component | Medium |
| INV-MFT-9 | advanceTechniqueGrade floor | Forged grade-0 holder | Boundedness | Value mutation (grade 0) | refuses; never writes key-0 record | unit | Medium: unreachable via ops precondition; defense-in-depth |
| INV-MFT-10 | BattleLootSystem.settleTechniqueMastery | Realm-context args | Synchronization | Missing player | `?? 'mortal'`/`?? 0` fail-closed when player null | unit | Low |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run src/core/technique src/core/tribulation src/core/progression src/components/common src/components/panels/skill-path src/core/game src/services/save src/data/progression src/core/simulation` | PASS (all scoped files green) | ran after every fixture fix; counts recorded in worklog |
| `npm run type-check` (vue-tsc --build) | PASS | 0 errors |
| `npm run verify` | FAIL on 8 pre-existing/env items only | 6 failures verified pre-existing on `origin/p7/truc-co` via `git show` blob grep (P15 em-dash ratchet on untouched files, SkillPathPanel `getTurnBattle` mocks on base-only file); 2 dongFu asset tests need `magick` binary (absent on this VM). Not task-caused. |
| Code inspection: `player.realmId =` writes in production | 3 sites | `GameManagerRealmAdvanceOps:321` (mortal->qi_refining grant seam — no holder can exist pre-grant), `TribulationOutcomeService:208` (frozen seam present), `BalanceBaselines.ts` dev fixture. No unseamed realm write. |
| New regression: forged grade-0 `advanceTechniqueGrade` | FAIL pre-fix, PASS post-fix | see QA-2026-09-23-MFT-1 |

## Findings

### QA-2026-09-23-MFT-1: `advanceTechniqueGrade` had no grade floor — forged grade-0 holder seals non-canonical key-0 record

- Severity: Low
- Status: Confirmed (static + reproduction; fixed during implementation pass)
- Invariant: Boundedness — `gradeHistory` keys must be in `{1..grade-1} + {grade iff lagging}`
- Preconditions: a `techniqueProgress`/holder with `grade: 0` (unreachable via `canAdvanceTechniqueGrade`, which requires `grade >= 1`; system entry point trusted the ops precondition)
- Reproduction: grant at qi_refining, force `active.grade = 0`, call `advanceTechniqueGrade('foundation_establishment')` -> pre-fix wrote `gradeHistory[0]`; post-fix returns false and writes nothing
- Expected: refuse
- Actual (pre-fix): proceeded, wrote key-0 record
- Evidence: `src/core/technique/TechniqueSystem.test.ts` 'refuses a forged grade-0 holder and seals no key-0 record' (green post-fix; suite 38/38)
- Test file: `src/core/technique/TechniqueSystem.test.ts`
- Owner subsystem: technique
- Blast radius: none reachable today — ops precondition blocks grade 0; fix is defense-in-depth consistent with the `realmIndex > 0` guards in `getTechniqueRankCeiling`/`getEffectiveTechniqueRank`

### QA-2026-09-23-MFT-2: `tribulation.unperfectedTechnique.state.vien_man` i18n key absent

- Severity: Nit
- Status: Coverage gap (non-material; unreachable)
- Invariant: Synchronization — every rendered interpolation resolves
- Preconditions: `projectTechniqueCompletion` returns `vien_man` while the warning renders — impossible by construction (`!== 'vien_man'` gate precedes render)
- Reproduction: none reachable; would only surface if the field comparison is ever removed
- Expected: key exists or path provably dead
- Actual: path dead by contract; key intentionally omitted
- Evidence: `BreakthroughRequirementPanel.vue` computed guards the render; component test 'does not warn on a perfected (vien_man) live cycle' asserts hidden at rank 18
- Test file: none (dead path)
- Owner subsystem: UI copy
- Blast radius: none

## New or Changed QA Tests

- `src/core/technique/TechniqueSystem.test.ts` — 'refuses a forged grade-0 holder and seals no key-0 record': proves the transaction floor is self-contained and never writes a non-canonical key.

## Gaps and Residual Risk

- `advanceTechniqueGrade`'s ops-level caller chain (`tryAdvanceTechniqueGrade` material spend + combat guard) is not re-exercised end-to-end in the browser; component/integration tests cover the system contract and the ops preconditions separately. Non-material.
- Inheritance payload is `Record<string, never>` by design (coefficients deferred to a balance pass); monotonic ordering is contract-tested but no live coefficient path exists to attack.
- The `dai_thanh` state label renders Vietnamese `đại thành` / English `great accomplishment` — copy wording is a UX choice deferred to M-F-CONTENT-TC.

## Pre-existing Failures

- 6 full-suite failures verified on `origin/p7/truc-co` base blobs (`git show` non-ASCII line counts confirmed per file): P15 comment ratchet in `NodeTreePanel.vue`, `useProgressionActions.ts`, `GameManagerProgressionOps.*`, `NodeSystem.*`; `SkillPathPanel.test.ts` mocks missing `getTurnBattle` used by base `NodeTreePanel.vue:107`.
- 2 dongFu asset tests fail with `ENOENT magick` — binary absent on this VM.
