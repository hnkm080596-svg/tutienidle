# M-QI-09 — Essence Substitution Contract + Sim — plan

Spec: `mqi-09-essence-substitution.spec.md` (v2 — C2C round-10 amendments incorporated). Implements QI-D4c: adjacent `conversionRatio` data on the essence family, the pure substitution resolver, the atomic invest-seam wiring with exact change-back, and the deterministic economy sim that selected and now pins the locked ratio 2 on both authored hops. No live drop changes (M-QI-10), no exchange UI, no upward exchange, no migration (QI-S).

## Step 0 — seam census (done during spec)

- `data/realm/PhysiqueEssence.ts`: family registry owns `PHYSIQUE_ESSENCE_CONVERSION_RATIO` — the material-id↔grade authority is also the economics authority.
- `core/realm/body/BodyChapter.ts`: `bodyChapterEssenceGrade(currency)` is the only currency→grade read; the resolver calls it internally (C2C 6).
- `core/realm/body/BodyRefinementChapter.ts:37`: `investBodyChapterState` is PlayerData-pure; all apply-side gates (tier lock, physique source grade, completion) run before mutation and surface as `consumed = 0` — preflight by construction (C2C 3).
- `core/game/GameManagerRealmAdvanceOps.ts:475`: `investBodyChapter` owns the bags; the only mutation point. Deps gain `materialRegistry` (for the change-back `Material` get) and `bodyChapterBag` widens to expose `has` (debit preflight).
- `core/material/MaterialBag.ts`: `getAmount/has/remove/add` — `add` clamps at `stackLimit ?? MAX_STACK_AMOUNT`; change-back is therefore bounded `< last hop yield` (always << a stack), documented in the resolver.
- `core/simulation/earlygame/`: `EarlyGameSession` + `PerfectionEconomy` conventions — sim lives in `core/simulation/earlygame`, nothing on the gameplay path may import it; candidate selection precedes production write (C2C 4).
- Save shape: untouched — substitution is a spend mechanic; QI-S governs.

## Step 1 — TDD failing tests first

1. `BodyChapterEssenceSubstitution.test.ts` (new): yield same/adjacent/multi-hop/lower/broken; coverage sums + refusal (pill bag, colliding pill id, foreign id); plan order required-first then ascending; min whole units + exact `change` (odd shortfall); multi-hop cascade; insufficient coverage.
2. `PhysiqueEssence.test.ts`: ratio keys have material + adjacent lower rung; integer >= 2; multi-hop yield === product (no-arb — C2C 5).
3. `GameManager.essenceSubstitution.test.ts` (new): Bảo substitutes a Phàm shortfall at ratio 2; required-first spend; odd shortfall credits exact change; Pháp compounds at product rate; insufficient drains only what exists; apply-side rejection debits nothing (mortal-locked tier + completed chapter — C2C 3); meridian pill currency refuses substitution (C2C 6).
4. `EssenceSubstitutionEconomy.test.ts` (new): deterministic boundary across seeds; pinned drop-rate math; candidate selection recomputed from production data equals authored ratio (C2C 4); locked budget retires all six tiers on every seed; budget-1 fails — the lock is tight.

## Step 2 — data + resolver

- `PhysiqueEssence.ts`: `PHYSIQUE_ESSENCE_CONVERSION_RATIO = { bao: 2, phap: 2 }` (sim-locked; candidate loop + production-read pin per C2C 4) + `physiqueEssenceConversionRatio`.
- `BodyChapterEssenceSubstitution.ts` (new): `essenceSubstitutionYield`, `essenceSubstitutionCoverage(cost, ownedOf)`, `planEssenceSubstitution(consumed, cost, ownedOf)` — typed cost in, `undefined` on refusal; lowest-first upward minimum-whole-units; `change` = covered-consumed in required units.

## Step 3 — seam wiring

- `GameManagerRealmAdvanceOps.investBodyChapter`: `effectiveAvailable = owned + coverage`; on `consumed > 0` the plan is preflighted (`bag.has` per debit) then committed (debits + change credit); refusal path unchanged.
- `GameManager.ts`: `materialRegistry` into the ops deps.

## Step 4 — sim

- `EssenceSubstitutionEconomy.ts` (new): `driveToBandBoundary` (canonical scripted journey to `realmId` boundary), `measureBandResidency` (thin wrapper — determinism evidence only, NOT the income proxy), `expectedBandEssencePerKill`/`expectedBandEssence`/`bodyChapterRequirement`, `ESSENCE_RATIO_CANDIDATES` + `lockConversionRatio` (spec rule), `measureEssenceRatioLock` (authored-parity surplus → smallest passing candidate = authored value), `measureStrandedCompletion` (boundary → zero chapter → bounded-stack feed-drain → invest loop; verdict per seed).

## Step 5 — gates

- P3 full `npm run verify` (economy/progression touch).
- E3 code-simplifier → P18 OCR → P4 adversarial QA deep mode (economy/progression vectors) → P5 sequential >= 3 passes → commit + push + PR + ledger.
- P15 ASCII scan on new comments. No P13/P14 trigger: no UI, no wiring, no rendering path changed.
