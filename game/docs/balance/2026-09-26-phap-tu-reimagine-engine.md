# Phap Tu Reimagined — Engine-Slice Baseline Delta — 2026-09-26

Fingerprint-table update for `phap_tu_ngu_hanh` (all 5 benchmarks x 8
seeds). Cause: the engine slice retired the route axis + legacy
empowerment@100 god-ult and rewired the recipe's kit to the reimagined
contract — `{special}` only (no ultimate slot), flat-5 The cap, +1 The
on landed basic primaries, Phap The rider attached at commit
(`empowerment{theThreshold:5, empowered:<element variant>}`).

The recipe still runs the beta skill data (`SPELL_KIT_IDS` triples,
legacy chain kit defs) — the data slice reworks those next. Under the
interim composition the recipe loses a full castable slot, which is
why its fingerprints drifted.

## Gate delta

`exit-2 (strengths)` no longer passes for `phap_tu_ngu_hanh`: the
recipe has an identifiable weakness (attrition, strictly worst) but no
benchmark where it is best-or-tied-first. This is a deliberate interim
state, pinned explicitly in `BalanceMatrix.test.ts`
(`perRecipe.phap_tu_ngu_hanh = { hasStrength: false, hasWeakness: true }`)
so a later data-slice rebalance flips it loudly rather than rotting.

All other recipes' fingerprints are byte-identical — the delta is
isolated to the spell_pathway recipe.

## Outcome summary (new baseline, whole-battery means)

| Benchmark | Outcomes (8 seeds) | Player DPS |
|---|---|---|
| single_target | 4 victory / 4 defeat | ~25 |
| multi_enemy | 8 victory | ~17 |
| durable_target | 8 victory | ~44 |
| burst_pressure | 6 victory / 2 defeat | ~22 |
| attrition | 8 defeat | ~36 |

Data slice TODO: rebalance the reimagined kit defs (new 5-basics +
5-specials pair catalog), then restore `hasStrength` coverage and
regenerate this recipe's fingerprints.
