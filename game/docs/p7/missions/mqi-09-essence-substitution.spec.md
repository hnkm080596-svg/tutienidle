# P7 M-QI-09 — Essence Substitution Contract + Sim — Spec

Status: v1 — draft (worker-authored)
Depends on: M-QI-08 (essence family + pinned band drops — merged at
`9343215e`), QI-D4b + QI-D4c + QI-S (decisions.md:179-203).
Mission-graph scope: adjacent-grade `conversionRatio` data (locked by
deterministic sim), downward-only automatic substitution resolved at the
Body chapter invest seam, atomically. NOT in scope: the live drop-band
swap (M-QI-10), any exchange UI, bidirectional/upward exchange, balance
authoring beyond the locked ratios, any save/schema migration (QI-S).

## 1. Intent

QI-D4b pins the band map: Mortal → Phàm, Luyện Khí → Bảo, Trúc Cơ →
Pháp. Today a player can enter LQ with the Mortal Body chapter
(Luyện Thể) unfinished — the chapter is back-loaded (tier 6 alone is
71% of the 36,790-unit requirement) so essentially every player crossing
the ritual carries a ~36k residual. When M-QI-10 later swaps the live
drop bands upward, Phàm essence stops dropping in the player's own
band; without substitution the lower-grade requirement is completable
only by niche sources (the `huyet_mong` signature valve, deliberate
backfarming) and the dominant play path produces Bảo/Pháp units with no
demand at all.

QI-D4c rules that a Body cost check must accept higher-grade essence
automatically — no exchange UI, no player action — at a data-driven
adjacent ratio that is monotonic, no-arbitrage, and locked by
deterministic economy simulation before it reaches production data.

## 2. Decision — contract shape

- **Downward-only, adjacent-only.** One unit of grade `g` substitutes
  for `conversionRatio[g]` units of grade `g-1`. Grade-`g` units cover
  lower-grade requirements through the chain at the product of the
  ratios between them — there is no authored skip rate; the compound
  IS the skip rate, so no conversion path can beat the chain
  (no-arbitrage by construction, pinned by a data test).
- **Monotonic / strictly more valuable.** Every authored ratio is an
  integer `>= 2`: one higher unit covers strictly more than one lower
  unit. A uniform ratio across authored hops trivially satisfies any
  non-decreasing reading of monotonic.
- **Required-currency-first, then nearest-higher cascade.** The spec's
  atomic rule — "lower-grade-first spend, then adjacent downward
  substitution for the shortfall" — also minimizes rounding loss:
  coverage is spent from the nearest grade first, each hop debiting
  `ceil(shortfall / yield)` units (overshoot `< 1` unit per hop is
  inherent conversion loss on integer units).
- **Automatic at the cost check, never a UI.** Substitution is computed
  inside the existing `investBodyChapter` seam — the same call driven
  by per-tick auto-invest and by `EarlyGameSession.investRefinement`.
  No exchange action exists anywhere.

## 3. Contract

### 3.1 Data (new on the essence family)

`PHYSIQUE_ESSENCE_CONVERSION_RATIO` in `data/realm/PhysiqueEssence.ts` —
`Partial<Record<PhysiqueGradeId, number>>` keyed by the HIGHER grade of
each adjacent pair: `{ bao: R, phap: R }` where `R` is the sim-locked
integer. `pham` is absent (nothing below it). Seven unauthored ladder
rungs contribute no substitution (they have no material id and no
ratio) — absence is the contract, not an error.

Data invariants (pinned by test):
- every authored ratio is an integer `>= 2` (monotonic, strictly more
  valuable);
- coverage for a hop skips exactly one rung (adjacent-only authoring);
- the derived multi-hop yield equals the product of the hop ratios —
  `yield(phap->pham) === ratio[phap] * ratio[bao]` — so no skip edge
  can exist to arbitrage (if a future change ever authors one, it must
  be `> ` the compound it replaces — recorded here as the no-arb rule);
- every ratio key has an authored essence material (a ratio on a
  material-less rung is unreachable and rejected).

### 3.2 Resolver (new core module)

`core/realm/body/BodyChapterEssenceSubstitution.ts` — pure functions,
no bag/PlayerData access:

- `essenceSubstitutionYield(required, source)`: required-units covered
  per source unit — the per-hop integer product of ratios from
  `source` down to `required` (ratios are authored integers, so the
  product IS the floor-at-each-hop result — C2C 1); `1` when
  `source === required`; `0` when `source` is lower or the chain is
  broken (missing material or ratio on an intermediate rung).
- `essenceSubstitutionCoverage(cost, ownedOf)`: total required-units
  coverable from all higher grades — `Σ ownedOf(g) * yield(g)`.
  `cost` is the full typed `BodyChapterCurrency`; non-material bags
  and non-family ids return 0 (the gate lives inside the resolver —
  C2C 6).
- `planEssenceSubstitution(consumed, cost, ownedOf)`: deterministic
  debit plan — returns `undefined` when `cost` is not a material-bag
  physique essence. Spend order is lowest-grade-first, then the
  shortfall resolves grade-by-grade upward (`required -> required+1
  -> ...`), `units = min(owned, ceil(shortfall / yield))` — the
  MINIMUM whole units per hop (C2C 1-2). Returns `{ debits, covered,
  change? }`: `covered >= consumed` is guaranteed iff the caller
  scoped `consumed` within coverage, and `change` credits the last
  hop's whole-unit overpay back in the required material inside the
  same transaction (C2C 2 — exact value, never silently discarded,
  never fractional).

### 3.3 Seam wiring (the only mutation point)

`GameManagerRealmAdvanceOps.investBodyChapter` already owns the bags
(`investBodyChapterState` is PlayerData-pure). It now:

1. hands the chapter's full typed currency to the resolver —
   `essenceSubstitutionCoverage(chapter.currency, ownedOf)` over the
   material bag — and passes `effectiveAvailable = owned + coverage`
   into `investBodyChapterState` (non-essence currencies yield
   coverage 0, so availability is unchanged for them);
2. on `consumed > 0`, asks the resolver for the plan —
   `planEssenceSubstitution(consumed, chapter.currency, ownedOf)`;
   a refusal (`undefined`, non-material bag or non-family id) falls
   back to the legacy single-currency debit untouched;
3. preflights EVERY debit (`bag.has`) before any bag mutation
   (C2C 3), then commits: required spend first, the cascade, then
   the `change` credit in the required material. `consumed = 0` or
   any unsatisfiable debit means zero mutations — validate -> consume
   -> apply, all-or-nothing.

Apply-side rejection precedes every bag mutation: the chapter's own
gates (tier lock, physique source grade, completion) run inside
`investBodyChapterState` before it mutates and surface as
`consumed = 0`, so a rejected apply debits nothing. Chapters whose
currency is not material-bag essence (meridian's pill
`thong_mach_dan`, aux `thien_dia_chi_kieu`) can never see
substitution — the namespace gate holds inside the resolver.

### 3.4 Sim-locked ratios — band-redemption invariant (authored parity)

Lock rule: **the smallest candidate `>= 2` such that the stranded
band's expected essence income over one authored gate arc covers the
full authored lower-chapter requirement.**

- `residual` = `Σ BODY_REFINEMENT_TIERS.cap` = 36,790 — the worst-case
  stranded requirement; using the full authored cost guarantees
  completability for every stranded profile, not just the canonical
  one.
- `surplus` = expected essence income over the AUTHORED residency —
  `authoredResidencyKills * E[essence per kill]`, where
  `authoredResidencyKills = ceil(residual / E[per kill])` is the kill
  budget the chapter caps imply at the required band's own drop rate
  and `E[per kill]` derives from the pinned authored band drop
  (`PHYSIQUE_ESSENCE_BAND_DROPS[realm]`: chance × mean amount =
  0.7 × 2 = 1.4). The chapter caps were tuned so the required band's
  own essence income over its residency covers them
  (`BodyRefinement.ts` tuning comment), so the authored residency
  income ≈ `residual` — parity.
- candidate selection (C2C 4): `ESSENCE_RATIO_CANDIDATES = [2..6]` are
  evaluated against `surplus * c >= residual`; every candidate passes
  at parity, so the spec's `>= 2` premium floor binds —
  **`lockedRatio = 2`**, uniform across authored hops (only one
  lower-grade chapter is authored; the Pháp→Bảo hop takes the same
  locked value and re-locks if a Bảo-demanding chapter lands).

Symmetric-band proxy: the stranded band (qi_refining) is not
scripted-driveable in the harness — a fresh LQ player's
cultivationPerSecond and the authored floor difficulty stall the
canonical growth recipe (verified during implementation). The mortal
band IS driveable and structurally identical: same 10-floor zone
chain, same level-12 gate, same pinned essence rate. The scripted
residency measurement is retained as determinism evidence
(boundary reached across `ESSENCE_LOCK_SEEDS`), but scripted kills
are NOT the income proxy — a scripted journey refarms far less than
a real residency, which would inflate the lock by an order of
magnitude. Income parity is the authored anchor.

Contract verification (C2C 3-4): `measureStrandedCompletion` drives
the real seams end-to-end — boundary, chapter state zeroed, then a
feed-drain loop grants the substitute in bounded stacks (the bag
clamps at stackLimit) exactly as real drop income arrives — and the
minimal budget `ceil(residual / lockedRatio)` retires all six tiers
on every lock seed while `budget - 1` does not. The sim ordering is
pinned: candidates → deterministic selection → value written into
production data → this regression test reads PRODUCTION data and
pins results.

### 3.5 Number ownership

The drop entries (0.7 / 1-3 per band) are FIXED inputs pinned by
M-QI-08. Any later retune of drop numbers, tier caps, stage enemy
counts, or combat balance that shifts the authored residency or
`residual` invalidates the locked ratio unless the sim is re-run and
the ratio re-locked in the same change. The determinism test
recomputes the candidate selection from production data and compares
it to the authored value — drift is loud, not silent.

## 4. Consistency invariants

- `bodyChapterEssenceGrade` remains the only currency→grade read,
  invoked INSIDE the resolver (C2C 6): substitution never inspects
  MaterialBag essence for a PillBag requirement — the plan refuses
  non-material bags and non-family ids outright (namespace
  regression test stays).
- `PhysiqueEssence.ts` stays a pure material-id/grade registry + family
  economics; `BodyChapter.ts` stays the currency-contract owner; the
  resolver module holds only plan math — no state, no bags.
- `investBodyChapterState` signature and purity unchanged; only
  `available` widens from owned to owned+coverage.
- Save shape untouched: bags already persist stacks by id; nothing is
  persisted for the substitution itself. Save-version rejection (QI-S)
  governs.
- `investBodyChapter` returns required-units consumed — identical
  contract for callers (`update()` auto-invest, `investRefinement`,
  tests). Bag mutations commit only via the preflighted plan
  (debits + exact change-back); the plan always covers `consumed`
  because the call scoped it inside coverage.

## 5. Out of scope

- M-QI-10's live drop-band swap (production drops unchanged here).
- Exchange UI, manual conversion, upward/bidirectional exchange.
- Per-grade stat bonuses (QI-D4d), Body stat rework.
- Any balance retune of drops/costs; the sim only locks the ratio.
- Pill-bag or aux-currency substitution (namespace-gated out).

## 6. Acceptance

- `PHYSIQUE_ESSENCE_CONVERSION_RATIO` authored on the family with the
  sim-locked value, all data invariants tested.
- Resolver + seam: exact owned spend, shortfall via adjacent cascade
  (nearest-first), no substitution for non-essence/pill/aux currency,
  `consumed=0` → zero debits, plan coverage `>= consumed` invariant.
- Deterministic sim drives the canonical LQ gate arc and recomputes the
  lock = authored ratio; two runs of the same seed are byte-identical
  in the measurement fields.
- `npm run verify` green; mission-graph ledger row added.
