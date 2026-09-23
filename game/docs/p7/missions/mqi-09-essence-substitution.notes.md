# M-QI-09 — Essence Substitution Contract + Sim — implementation notes

Spec: `mqi-09-essence-substitution.spec.md` v2 (C2C round-10 rulings incorporated).
Plan: `mqi-09-essence-substitution.plan.md`.

## Implementation summary

- `src/data/realm/PhysiqueEssence.ts`: `PHYSIQUE_ESSENCE_CONVERSION_RATIO
  = { bao: 2, phap: 2 }` - the sim-locked adjacent ratios keyed by the
  higher grade, plus `physiqueEssenceConversionRatio`. Both hops carry
  the same locked value; `pham` absent by construction.
- `src/core/realm/body/BodyChapterEssenceSubstitution.ts` (new): pure
  resolver. `essenceSubstitutionYield` = per-hop integer product of
  adjacent ratios (integer ratios => the product IS the
  floor-at-each-hop result, C2C 1); 1 same grade, 0 lower/broken.
  `essenceSubstitutionCoverage(cost, ownedOf)` takes the full typed
  `BodyChapterCurrency` and refuses non-material bags / non-family ids
  internally (C2C 6 - the gate lives in the resolver, not only in the
  lookup helper). `planEssenceSubstitution(consumed, cost, ownedOf)`
  returns `{ debits, covered, change? }` or undefined on refusal:
  required currency first, then ascending rungs at minimum whole units
  `min(owned, ceil(shortfall / yield))`; `change` credits the last
  hop's whole-unit overpay back in required units inside the same
  transaction (C2C 2 - exact value, never silently discarded).
- `src/core/game/GameManagerRealmAdvanceOps.ts`: `investBodyChapter`
  widens `available` to owned + substitution coverage before
  `investBodyChapterState`; on `consumed > 0` it preflights every
  planned debit via `bag.has` (C2C 3) then commits debits + change
  credit; refusal or unsatisfiable plan => zero mutations, legacy path
  untouched. Deps gained `materialRegistry`; `bodyChapterBag` widened
  to expose `has`.
- `src/core/game/GameManager.ts`: passes `materialRegistry` into the
  ops deps.
- `src/core/simulation/earlygame/EssenceSubstitutionEconomy.ts` (new):
  `driveToBandBoundary`, `measureBandResidency`,
  `expectedBandEssencePerKill`/`expectedBandEssence`,
  `bodyChapterRequirement`, `ESSENCE_RATIO_CANDIDATES = [2..6]` +
  `lockConversionRatio`, `measureEssenceRatioLock`,
  `measureStrandedCompletion` (boundary -> chapter reset ->
  bounded-stack feed-drain -> invest loop, verdict per seed).

## Locked ratio derivation (authored parity)

`residual = sum(BODY_REFINEMENT_TIERS.cap) = 36,790` Pham-equivalent.
The chapter caps were tuned so one residency of the required band's
own essence income covers them (`BodyRefinement.ts` comment), so the
authored residency `ceil(residual / 1.4) = 26,279` kills at the
pinned rate yields `surplus = 36,790.6` - parity within one kill's
essence. Candidate selection (C2C 4) evaluates `surplus * c >=
residual`; every candidate passes at parity, so the spec's `>= 2`
premium floor binds: lockedRatio = 2 on both authored hops (compound
Phap->Pham = 4).

End-to-end contract check: `measureStrandedCompletion` feeds
`ceil(residual / 2) = 18,395` Bao through the real seams on seeds
11/22/33/44 - all six tiers retire; 18,394 does not. The lock is
tight, not just sufficient.

## Why scripted kills are not the income proxy

A scripted journey measures ~209-336 kills to the mortal->LQ boundary
because the harness sprint refarms little; a real residency runs an
order of magnitude longer. Using scripted kills as the surplus proxy
inflated the lock to ~126 and falsified the spec's "never free"
intent - one residency at rate 2 produces 292 essence against a
36,790 residual, NOT a full redemption. The authored-parity proxy
(the residency the chapter caps were tuned around) is the only
income anchor consistent with authored data; scripted residency is
retained purely as determinism evidence (boundary reached on all
lock seeds).

## C2C round-10 rulings (all six applied)

1. Per-hop integer conversion + lowest-first upward traversal -
  inherent in integer-product yield + ascending plan order.
2. Minimum whole higher units + exact integer surplus back to the
  required balance in the same transaction - `change` credit.
3. Preflight apply-side failures before bag mutation - gates live
  inside `investBodyChapterState` (consumed=0 => no debit) + explicit
  `bag.has` per-debit preflight; rejection tests cover tier-lock and
  completed-chapter paths.
4. Sim ordering - candidates -> deterministic selection -> production
  write -> regression test reads PRODUCTION `PHYSIQUE_ESSENCE_CONVERSION_RATIO`
  and asserts it equals the recomputed lock. No placeholder shipped.
5. No-arbitrage - data test asserts every authored ratio integer >= 2
  and multi-hop yield === product of adjacent hops.
6. Namespace gate inside the resolver - typed `BodyChapterCurrency`
  in; non-material bag or unrecognized id => refusal (coverage 0 /
  plan undefined), tested via colliding pill id + meridian seam.

## C2C impl review round 17 - seam restructure

1. Transaction order hardened to validate -> consume -> apply:
   for essence currencies the state function now runs on a
   detached plain-data probe first (JSON round-trip - r24:
   structuredClone throws DataCloneError on the reactive Pinia
   $state real callers pass; never use it here); the debit
   plan is validated
   (all debits satisfiable + change credit committable) before
   any mutation; bags commit; only then does the real player
   apply. Failure anywhere returns 0 with zero state change.
   Non-essence currencies keep the legacy compute-then-debit
   path - a single-currency `remove` cannot fail once
   `consumed <= owned`, and cloning every meridian invest would
   be pure cost.
2. Change credit is fail-closed: the seam checks the
   post-debit required balance + change <= stackLimit before
   committing; an uncommittable credit aborts the whole invest
   (previously `MaterialBag.add` would have clamped silently).
   Tested with a stackLimit-1 fixture + a 2-unit Phap->Pham
   overpay.
3. Downstream-hop rule made explicit (spec 3.4): authored hops
   carry the first-hop lock BY RULE until a band-specific arc
   is driveable; the regression test pins `phap === lockedRatio`
   (measured, not copied) and a `foundation_establishment`
   stranded run exercises the Phap->Pham compound e2e.

## Known limitations / deferred

- Seven unauthored ladder rungs contribute no substitution (no
  material id, no ratio) - by design.
- Only the Pham-requiring chapter exists; Phap->Bao carries the
  first-hop lock by explicit rule and re-locks if a
  Bao-demanding chapter (or driveable TC arc) lands.
- The probe clone runs on every essence-currency invest call
  (incl. the auto-invest tick) - bounded to the essence branch
  and the player payload, accepted for strict atomicity.
- Bidirectional exchange stays out of scope (QI-D4c).
