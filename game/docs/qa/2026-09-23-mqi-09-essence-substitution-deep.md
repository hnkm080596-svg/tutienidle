# QA Review: M-QI-09 essence substitution contract + sim

- Date: 2026-09-23
- Mode: deep (coordinator-mandated: economy/progression vectors)
- Verdict: PASS WITH GAPS
- Task-owned paths:
  - `src/data/realm/PhysiqueEssence.ts` (+ `.test.ts`)
  - `src/core/realm/body/BodyChapterEssenceSubstitution.ts` (+ `.test.ts`)
  - `src/core/game/GameManagerRealmAdvanceOps.ts`
  - `src/core/game/GameManager.ts`
  - `src/core/game/GameManager.essenceSubstitution.test.ts`
  - `src/core/simulation/earlygame/EssenceSubstitutionEconomy.ts` (+ `.test.ts`)
  - `docs/p7/missions/mqi-09-essence-substitution.{spec,plan,notes}.md`

## Scope and Risk Map

Changed systems: essence-family data (adjacent `conversionRatio`), a new
pure substitution resolver, the `investBodyChapter` seam (availability
widening + plan-based debit + change-back), `GameManager` dep wiring, and
a simulation module under `core/simulation/earlygame` (non-gameplay-path
by convention). One-hop consumers: `GameManagerTickOps.investBodyChapter`
(auto-invest per update), the UI invest seam, `EarlyGameLoop`
`investRefinement` steps. Domains loaded: economy/progression (primary),
inventory-equipment (bag stack/clamp), save-cloud (no schema change),
time-offline (tick path), combat, Pinia/Phaser sync, UI lifecycle — the
last three have no surface in this diff. Deep audit chosen by
coordinator instruction (economy/progression vectors).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-SUB-1 | materialBag + bodyProgression (GameManagerRealmAdvanceOps) | invest with higher-grade essence | A higher unit debits only enough units to cover the shortfall; exact-value change returns in required units inside the same call | value mutation (odd shortfall, 1-unit overpay) | bag deltas + `consumed` + change credit | unit (`GameManager.essenceSubstitution.test.ts`) | High: value-creation vector |
| INV-SUB-2 | same | invest while tier-locked / chapter complete | An apply-side rejection mutates neither bag nor progress | repeat, gated state | `consumed === 0`, bag + progress unchanged | unit | High: atomicity (C2C 3) |
| INV-SUB-3 | same | invest meridian (pill currency) with essence stacks present | Non-material-bag currencies never substitute | cross-system chain | `consumed === 0`, essence bag untouched | unit | High: namespace gate (C2C 6) |
| INV-SUB-4 | data (`PhysiqueEssence`) | ratio authoring | Every ratio integer >= 2; multi-hop yield === product of hops | value mutation on data | data test assertions | unit | High: no-arbitrage (C2C 5) |
| INV-SUB-5 | seam | invest with mixed required + substitutes | Required currency spends first, then ascending grades minimum-whole-units | reorder | debit list shape + bag deltas | unit | Medium: deterministic order (C2C 1-2) |
| INV-SUB-6 | tickOps chain | `update()` auto-invest with only substitutes owned | Live tick path resolves substitution identically to direct seam | timing boundary | bag decrement + progress increment | unit | High: wiring (learned RR6/RR7) |
| INV-SUB-7 | sim module | `measureEssenceRatioLock` / `measureStrandedCompletion` | Lock recomputed from production data equals authored; minimal budget retires all 6 tiers on every seed; budget-1 fails | degraded environment (seed set) | deterministic measurements | unit (sim) | High: lock regression (C2C 4) |
| INV-SUB-8 | save shape | invest + substitution | No persisted field added; bags persist by id; save-version rejection governs (QI-S) | interruption (reload) | diff inspection - no save code touched | static | Medium: save drift |
| INV-SUB-9 | resolver | `planEssenceSubstitution(consumed > owned+coverage)` | Caller precondition violated => plan `covered < consumed` silently under-covers | value mutation (misuse) | plan.covered vs consumed | unit | Low: internal contract |
| INV-SUB-10 | change-back | change credit vs stackLimit | Whole-unit overpay bounded < last hop yield and lands in a drained required bag | value mutation | stack headroom reasoning + tests | unit | Low: bounded loss surface |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run src/core/realm/body/BodyChapterEssenceSubstitution.test.ts` | 12/12 pass | yield/coverage/plan/refusal matrix |
| `npx vitest run src/core/game/GameManager.essenceSubstitution.test.ts` | 9/9 pass | seam e2e incl. live `tickOps.update` oracle |
| `npx vitest run src/data/realm/PhysiqueEssence.test.ts` | 16/16 pass | data invariants + no-arb chain |
| `npx vitest run src/core/simulation/earlygame/EssenceSubstitutionEconomy.test.ts` | 7/7 pass | determinism, lock regression, stranded completion |
| `npm run verify` (full) | type-check + build green; 6637/6644 pass | 3 failures pre-existing env (`magick` ENOENT asset tests) + 1 task-caused P15 (Σ comment) fixed and re-verified |
| Sim import audit (`grep EssenceSubstitutionEconomy` in src) | no gameplay-path importer | convention holds |

## Findings

### QA-2026-09-23-001: under-coverage plan silently under-delivers when caller violates the documented precondition
- Severity: Low
- Status: Suspected
- Invariant: INV-SUB-9
- Preconditions: an internal caller invokes `planEssenceSubstitution` with `consumed > ownedOf(required) + coverage` — impossible through `investBodyChapter` (consumed is scoped inside `effectiveAvailable`).
- Reproduction: none reachable through production seams; direct API misuse only.
- Expected: hard refusal or a caller-visible under-coverage signal.
- Actual: returns a plan with `covered < consumed`; the seam commits debits that satisfy `has()` regardless, so a hypothetical misuse would over-credit progress by `consumed - covered`.
- Evidence: `src/core/realm/body/BodyChapterEssenceSubstitution.ts` plan contract; single production caller honours the bound.
- Test file: none (no reachable path; a guard would test dead code).
- Owner subsystem: body realm progression.
- Blast radius: none today; a future second caller could bypass the bound — mitigated by the documented precondition.

## New or Changed QA Tests

- `GameManager.essenceSubstitution.test.ts` > "the update() auto-invest tick resolves substitution through the same seam" — proves the live tick path (`tickOps.update` -> `deps.investBodyChapter` -> seam) consumes substitutes, closing the headless-vs-App wiring vector (learned defects RR6/RR7).

## Gaps and Residual Risk

- QA-2026-09-23-001 (Suspected/Low): dead-in-practice under-coverage contract; bounded to internal misuse.
- `measureStrandedCompletion` zeroes `completedTiers` on a player whose `physiqueGrade` may already be `bao`; the M-QI-07 exact-`from` guard prevents a second transform (verified by inspection) — residual risk none, behaviour already asserted by completion at budget on all seeds.
- Live Phàm-band production drops for LQ remain unwired (M-QI-10 scope); stranded-player need is exercised through sim seams, not a live arc — inherent to the contract-only mission.

## Pre-existing Failures

- `dongFuBuildingPipeline.test.ts`, `dongFuBackgroundAssets.test.ts`: `spawnSync magick ENOENT` — ImageMagick absent in this environment; unrelated to the diff.
