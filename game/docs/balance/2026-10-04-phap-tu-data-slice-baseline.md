# Phap Tu Data-Slice Baseline Delta — 2026-10-04

Fingerprint-table update for `phap_tu_ngu_hanh` AND `phap_tu_ngo_dao`
(5 benchmarks x 8 seeds each = 80 cells). Cause: the skill review's data
tune (see `skills-review.md`, section C) changed three authored numbers
that ride in these recipes' damage surface:

- `hoa_an` dot coefficient 0.15 -> 0.20 (`data/buff/LegacyBuffs.ts`)
- `TAM_MUOI_POTENCY_MULTIPLIER` 1.5 -> 2.0 (`data/skill/PhapTuSkills.ts`)
- `PHAP_TU_TRANG_COST_PERCENT_OF_MAX` 0.30 -> 0.15
  (`data/skill/PhapTuSkills.ts`)

`phap_tu_ngu_hanh` casts hoa_cau_thuat (hoa_an channel); `phap_tu_ngo_dao`
pools all five element basics so its hoa_cau_thuat picks drift too. Every
other recipe's 160 cells are byte-identical — the delta is isolated to
the two spell rows, matching the tune's blast radius (no body/kiem
data touched).

## Gate delta

No gate change. `phap_tu_ngu_hanh` keeps its pinned deviation
(`hasStrength: true`, `hasWeakness: false` — its attrition cell is still
not strictly-worst because `the_tu_hien` goes 0/8 there). The user's
exit-2 exception (`it.fails` marker) still applies to `the_tu_hien`.

## Outcome summary (new baseline, whole-battery means)

| Benchmark | Outcomes (8 seeds) | Player DPS |
|---|---|---|
| single_target | 7 victory / 1 defeat | ~26 |
| multi_enemy | 8 victory | ~17 |
| durable_target | 8 victory | ~45 |
| burst_pressure | 7 victory / 1 defeat | ~23 |
| attrition | 2 victory / 6 defeat | ~38 |

Versus the interim baseline (4/8 single, 5/8 burst, 0/8 attrition): the
stronger dot + cheaper window lift the weakest cells without creating a
dominance gate violation — `phap_tu_ngo_dao` stays the hidden-path
outlier by design, not an entry kit.

Real-stage caveat (skills-review.md "ngoai pham vi"): milestone builds
still lose `foundation_floor_1` at realmLevel 1 across ALL archetypes —
that is an enemy/stage-data question, not a kit-data one.
