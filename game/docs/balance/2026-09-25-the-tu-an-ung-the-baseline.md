# Thể Tu Ẩn — Ứng Thế Baseline — 2026-09-25

Re-baseline for the `the_tu_ung_the` recipe, driven by the Ứng Thế beta
rebuild (`docs/design/the-tu-an-ung-the-design.txt`). Same harness as
`2026-09-23-three-path-baseline.md` / `2026-09-25-the-tu-beta-baseline.md`.

## What changed and why the baseline moved

The recipe's `postRitual` writes referenced the superseded tree
(`ho_mon`/`phan_mon`/`tro_mon` root markers). The beta tree removed them —
Phản is baseline, and the only purchasable Luyện Khí writes are the two
minors:

- `postRitual`: `purchase_node ho_mon/phan_mon/tro_mon` →
  `purchase_node minor_thau_the + minor_phan_kinh` (the only LQ nodes;
  `major_quan_the` sits behind foundation_establishment + technique
  rank 5, unreachable at this power point, so Hộ/Trợ baselines and the
  consequence majors are not in the live kit).
- `kitSkillIds`: `tham_the, phan_kich` only — `tu_the`/`bach_ung` are
  parked defs (granted by nothing), `tro_kich`/`trong_phan_kich` are
  Trúc Cơ surface.

All five `the_tu_ung_the` fingerprint cells moved; every other row is
bit-identical.

## Matrix (the_tu_ung_the rows only)

| Recipe | Benchmark | Win% | Defeat% | TTK (median of wins) | Player DPS | HP taken | End-HP frac |
|---|---|---|---|---|---|---|---|
| the_tu_ung_the | single_target | 0 | 100 | – | 14.5 | 135 | 0.00 |
| the_tu_ung_the | multi_enemy | 100 | 0 | 216 | 15.0 | 97 | 0.36 |
| the_tu_ung_the | durable_target | 38 | 62 | 315 | 37.0 | 145 | 0.00 |
| the_tu_ung_the | burst_pressure | 0 | 100 | – | 12.8 | 131 | 0.00 |
| the_tu_ung_the | attrition | 0 | 100 | – | 23.3 | 146 | 0.00 |

## Notes

- Economy channels move where the recipe can win: `theGained` = 1.0 on
  multi_enemy + durable_target, `theSpent` = 0.125 / 0.667 (baseline
  Phản commits). All-defeat cells contribute no economy evidence by
  contract (`economyMovementFor` filters defeats).
- The pathway's shape is reactive-by-design: it wins the crowded
  benchmark (more observed actions -> more Thế income -> more Phản
  commits) and loses single-target/burst where the lone enemy acts
  slowly enough that observation income starves.
- Gates unchanged: dominance PASS, strengths per-recipe deviation for
  `the_tu_hien` still holds (see `2026-09-25-the-tu-beta-baseline.md`),
  no stalemates/deadlocks, secondary-dominance PASS.
