# Thể Tu Beta Baseline — 2026-09-25

Re-baseline driven by the THỂ TU BETA redesign (`docs/specs/the-tu-beta-spec.md`,
authority `docs/design/the-tu-body-pathway-design.txt` — fetched copy on the
design branch). Same harness as `2026-09-23-three-path-baseline.md`: mortal
Lv12 source -> Initiation Ritual -> canonical post-ritual writes ->
Qi Refining 1, `BALANCE_SEEDS = [11, 22, 33, 44, 55, 66, 77, 88]`.

## What changed and why the baseline moved

The `the_tu_hien` recipe is unchanged in *setup* (`purchase_node
cuong_chien`), but beta realm-gating changed what it resolves:

- Luyện Khí Thể Tu is **Basic-only by design**: Cuồng Quyền is the entire
  live kit at this power point (kitSkillIds narrowed to `['cuong_quyen']`).
- Loạn Đấu moved behind the Trúc Cơ core grant (`major_loan_dau`); Bất Tử
  Bá Thể is post-beta (no ultimate slot) — the old sustain/extra-life
  surface that won `attrition` (100%) and `burst_pressure` (100%) is gone.
- Cuồng Quyền also lost its missing-HP scaling at LQ (that scaling now
  arrives with Huyết Cuồng at Trúc Cơ); it is pure Might-conversion.

Only `the_tu_hien` fingerprints moved — all five cells; every other row
is bit-identical to the 2026-09-23 baseline.

## Matrix

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
| the_tu_hien | single_target | 50 | 50 | 180 | 21.8 | 142 | 0.01 |
| the_tu_hien | multi_enemy | 100 | 0 | 186 | 17.3 | 50 | 0.85 |
| the_tu_hien | durable_target | 100 | 0 | 290 | 41.9 | 90 | 0.58 |
| the_tu_hien | burst_pressure | 50 | 50 | 131 | 18.6 | 128 | 0.05 |
| the_tu_hien | attrition | 0 | 100 | – | 35.0 | 155 | 0.00 |
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
| exit-2 identifiable strength + weakness per primary path | **RECORDED DEVIATION** |
| stalemate cells | none |
| exit-3 deadlocked economy channels | none |
| exit-4 secondary-mechanic dominance | PASS (unattributed share <= 0.20 everywhere) |

**exit-2 deviation (by design, flagged for tuning):** `the_tu_hien` has no
identifiable strength — a bare Cuồng Quyền basic is never best-or-tied
first on any benchmark — and is strictly worst on `single_target` (50%
win vs 88% elsewhere) and `attrition` (0/8: with Bất Tử Bá Thể parked and
no sustain loop beyond `kim_cang_bat_hoai_the` regen, the long fight
kills it every seed). `phap_tu_ngu_hanh` correspondingly lost its
strictly-worst slot. Design authority defers entry-level tuning ("Exact
coefficient để balance sau"); the deviation is pinned per-recipe in
`BalanceMatrix.test.ts` rather than asserted away, so restoring the_tu's
strength (or any further drift) still trips the oracle.

`economyNoEvidence` now includes `the_tu_hien` on `attrition` — the cell
is all-defeat so `healingReceived` cannot be observed cycling (fights end
before the regen channel can move); recorded, not penalized.

## Per-path read (primary rows)

- **kiem_tu_hien** — unchanged: fastest TTK on durable/multi_enemy,
  glass-cannon profile intact.
- **phap_tu_ngu_hanh** — unchanged: burst_pressure winner; attrition
  improved to 38% (the_tu no longer monopolizes the long fight) and no
  longer holds a strictly-worst slot.
- **the_tu_hien** — basic-only at entry by design. Competitive-but-tied
  on `multi_enemy`/`durable_target`/`burst_pressure`, strictly worst on
  `single_target` and `attrition`. Post-Trúc Cơ kit (Loạn Đấu + Huyết
  Cuồng / Trấn Áp + Phản Chấn) is outside this entry power point.

## Fingerprint snapshot

`src/core/simulation/benchmark/BalanceMatrix.test.ts` —
`EXPECTED_FINGERPRINTS` updated for all 40 `the_tu_hien` seeds; the other
200 fingerprints are unchanged from 2026-09-23.
