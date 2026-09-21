# Three-Path Balance Delta — P7-M2 Realm-Passive Activation — 2026-09-21

Delta report against the committed baseline
`2026-09-23-three-path-baseline.md`. Same harness, same recipes, same
seed battery. The `EXPECTED_FINGERPRINTS` table in
`BalanceMatrix.test.ts` was regenerated in the same commit as the
causing change, per the oracle's deliberate-review contract.

## Cause

P7-M2 moved realm-entry passive ownership from
`Technique.passiveSkillIdsByRealm` to Way-owned
`realmRewards[realmId].passiveSkillId`. The canonical ladder was
authored on `tu_linh_quyet`, but `syncRealmPassive` read the
*equipped* technique — post-ritual players equip their Way technique,
so the ladder was dead content. Re-pointing the sync at the active
Way's reward record makes `passive_linh_khi_cam_ung`
(+0.5% might per landed hit, max 50 stacks) actually reach every
post-ritual player at qi_refining. This is the spec'd intentional
activation, not a regression.

## Drift scope

All 30 cells x 8 seeds (240/240 fingerprints) moved — every recipe
performs the ritual, so every player now carries the passive. The
mechanic is might-stacking on hit; cells shift through both
might-scaled damage and changed fight timing.

## New matrix

| Recipe | Benchmark | Win% | Defeat% | TTK (steps, median of wins) | Player DPS | HP taken | End-HP frac |
|---|---|---|---|---|---|---|---|
| kiem_tu_hien | single_target | 88 | 13 | 150 | 26.4 | 110 | 0.22 |
| kiem_tu_hien | multi_enemy | 100 | 0 | 166 | 19.3 | 38 | 0.87 |
| kiem_tu_hien | durable_target | 100 | 0 | 250 | 48.0 | 61 | 0.73 |
| kiem_tu_hien | burst_pressure | 50 | 50 | 121 | 20.0 | 125 | 0.04 |
| kiem_tu_hien | attrition | 100 | 0 | 220 | 40.9 | 115 | 0.26 |
| phap_tu_ngu_hanh | single_target | 88 | 13 | 160 | 24.9 | 93 | 0.28 |
| phap_tu_ngu_hanh | multi_enemy | 100 | 0 | 186 | 17.1 | 43 | 0.71 |
| phap_tu_ngu_hanh | durable_target | 100 | 0 | 280 | 42.3 | 70 | 0.53 |
| phap_tu_ngu_hanh | burst_pressure | 100 | 0 | 119 | 21.1 | 82 | 0.31 |
| phap_tu_ngu_hanh | attrition | 38 | 63 | 240 | 36.5 | 123 | 0.00 |
| the_tu_hien | single_target | 75 | 25 | 180 | 23.0 | 142 | 0.03 |
| the_tu_hien | multi_enemy | 100 | 0 | 196 | 16.3 | 64 | 0.74 |
| the_tu_hien | durable_target | 100 | 0 | 290 | 41.6 | 92 | 0.60 |
| the_tu_hien | burst_pressure | 100 | 0 | 121 | 20.7 | 112 | 0.22 |
| the_tu_hien | attrition | 100 | 0 | 230 | 38.9 | 135 | 0.14 |
| phap_tu_ngo_dao | single_target | 100 | 0 | 161.5 | 24.9 | 76 | 0.36 |
| phap_tu_ngo_dao | multi_enemy | 100 | 0 | 175.5 | 18.6 | 27 | 0.84 |
| phap_tu_ngo_dao | durable_target | 100 | 0 | 268 | 44.8 | 45 | 0.73 |
| phap_tu_ngo_dao | burst_pressure | 88 | 13 | 117 | 21.2 | 83 | 0.40 |
| phap_tu_ngo_dao | attrition | 100 | 0 | 237 | 38.0 | 92 | 0.38 |
| the_tu_ung_the | single_target | 0 | 100 | – | 11.0 | 136 | 0.00 |
| the_tu_ung_the | multi_enemy | 13 | 88 | 229 | 11.2 | 141 | 0.00 |
| the_tu_ung_the | durable_target | 0 | 100 | – | 26.0 | 156 | 0.00 |
| the_tu_ung_the | burst_pressure | 0 | 100 | – | 7.2 | 131 | 0.00 |
| the_tu_ung_the | attrition | 0 | 100 | – | 15.9 | 146 | 0.00 |
| kiem_tu_ngu | single_target | 0 | 100 | – | 14.9 | 128 | 0.00 |
| kiem_tu_ngu | multi_enemy | 100 | 0 | 216 | 15.0 | 101 | 0.29 |
| kiem_tu_ngu | durable_target | 38 | 63 | 330 | 36.4 | 141 | 0.00 |
| kiem_tu_ngu | burst_pressure | 0 | 100 | – | 11.8 | 124 | 0.00 |
| kiem_tu_ngu | attrition | 0 | 100 | – | 23.4 | 135 | 0.00 |

## Gate verdicts

| Gate | Result |
|---|---|
| exit-1 dominance (no path strictly first everywhere) | PASS |
| exit-2 identifiable strength + weakness per primary path | PASS |
| stalemate cells | none |
| exit-3 deadlocked economy channels | none |
| exit-4 secondary-mechanic dominance | PASS (tolerance 0.20) |

`economyNoEvidence`: `the_tu_ung_the` and `kiem_tu_ngu` on
`single_target`/`attrition` — unchanged from the baseline report.

## Delta read

- `kiem_tu_hien` attrition 25% -> 100%, single_target 63% -> 88% —
  stacking might converts its long-fight weakness into a win; the
  glass-cannon weakness is now burst_pressure only (50%, endHp 0.04).
- `phap_tu_ngu_hanh` attrition 13% -> 38%; still its weakness — exit-2
  holds.
- `the_tu_hien` single_target 63% -> 75%; still slowest-TTK identity,
  attrition sustain unchanged at 100%.
- `the_tu_ung_the` multi_enemy 25% -> 13% — the one unfavorable move;
  fight timing shifts cut into its narrow win band. Still entry-weak
  by design; recorded, not a gate.
- `kiem_tu_ngu` durable_target 0% -> 38%, multi_enemy endHp
  0.16 -> 0.29 — still entry-weak overall.
- All dominance/strength/stalemate/deadlock/attribution gates hold.
  The activation is a uniform entry-level buff, not a path-identity
  break.

## Limitations

Same as the baseline report. The passive's universal delivery means
entry-level readings now include a stacking-might floor that was
previously absent — absolute values are not comparable to the
2026-09-23 numbers; the table above is the new reference.
