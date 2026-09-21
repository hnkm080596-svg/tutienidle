# Three-Path Balance Baseline — 2026-09-23

P5 measurement over the P4 deterministic harness. Entry-level identity
point: mortal Lv12 source -> real Initiation Ritual -> declared
canonical post-ritual writes -> Qi Refining 1. Fixed seed battery
`BALANCE_SEEDS = [11, 22, 33, 44, 55, 66, 77, 88]` shared across every
cell. Golden-Core-gated capabilities are NOT expected at this power
point (recorded, never asserted).

## Matrix

Recipes: 3 primary (`kiem_tu_hien`, `phap_tu_ngu_hanh`, `the_tu_hien`)
+ 3 alternates reported-only (`phap_tu_ngo_dao`, `the_tu_ung_the`,
`kiem_tu_ngu`). 5 benchmarks x 8 seeds = 40 runs per recipe.

Player DPS is the whole-battery mean of `vitalsDamage.playerOnEnemy /
combatDurationSeconds` per seed (player-sourced hp loss on ENEMY-SIDE
targets only - TTK stays victory-only). Gate failure lists
(dominance/strengths/stalemate/deadlock/exit-4) derive from primary
rows only; alternates are diagnostics.

| Recipe | Benchmark | Win% | Defeat% | TTK (steps, median of wins) | Player DPS | HP taken | End-HP frac |
|---|---|---|---|---|---|---|---|
| kiem_tu_hien | single_target | 63 | 38 | 160 | 25.0 | 129 | 0.03 |
| kiem_tu_hien | multi_enemy | 100 | 0 | 166 | 19.3 | 37 | 0.86 |
| kiem_tu_hien | durable_target | 100 | 0 | 270 | 44.7 | 77 | 0.61 |
| kiem_tu_hien | burst_pressure | 50 | 50 | 121 | 19.7 | 125 | 0.04 |
| kiem_tu_hien | attrition | 25 | 75 | 240 | 38.2 | 144 | 0.00 |
| phap_tu_ngu_hanh | single_target | 88 | 13 | 170 | 23.9 | 106 | 0.15 |
| phap_tu_ngu_hanh | multi_enemy | 100 | 0 | 187 | 17.1 | 43 | 0.71 |
| phap_tu_ngu_hanh | durable_target | 100 | 0 | 291 | 40.8 | 79 | 0.46 |
| phap_tu_ngu_hanh | burst_pressure | 100 | 0 | 121 | 20.5 | 86 | 0.28 |
| phap_tu_ngu_hanh | attrition | 13 | 88 | 251 | 34.6 | 125 | 0.00 |
| the_tu_hien | single_target | 63 | 38 | 180 | 22.7 | 135 | 0.03 |
| the_tu_hien | multi_enemy | 100 | 0 | 196 | 16.3 | 65 | 0.74 |
| the_tu_hien | durable_target | 100 | 0 | 300 | 40.3 | 104 | 0.51 |
| the_tu_hien | burst_pressure | 100 | 0 | 121 | 20.7 | 108 | 0.22 |
| the_tu_hien | attrition | 100 | 0 | 230 | 38.9 | 135 | 0.14 |
| phap_tu_ngo_dao | single_target | 100 | 0 | 171.5 | 23.8 | 84 | 0.28 |
| phap_tu_ngo_dao | multi_enemy | 100 | 0 | 178.5 | 17.8 | 30 | 0.81 |
| phap_tu_ngo_dao | durable_target | 100 | 0 | 278.5 | 43.5 | 49 | 0.70 |
| phap_tu_ngo_dao | burst_pressure | 88 | 13 | 128 | 20.2 | 89 | 0.28 |
| phap_tu_ngo_dao | attrition | 75 | 25 | 247.5 | 36.6 | 107 | 0.11 |
| the_tu_ung_the | single_target | 0 | 100 | – | 10.7 | 136 | 0.00 |
| the_tu_ung_the | multi_enemy | 25 | 75 | 243 | 12.0 | 142 | 0.00 |
| the_tu_ung_the | durable_target | 0 | 100 | – | 24.2 | 156 | 0.00 |
| the_tu_ung_the | burst_pressure | 0 | 100 | – | 7.1 | 131 | 0.00 |
| the_tu_ung_the | attrition | 0 | 100 | – | 15.2 | 146 | 0.00 |
| kiem_tu_ngu | single_target | 0 | 100 | – | 14.2 | 128 | 0.00 |
| kiem_tu_ngu | multi_enemy | 100 | 0 | 226 | 14.3 | 116 | 0.16 |
| kiem_tu_ngu | durable_target | 0 | 100 | – | 33.4 | 144 | 0.00 |
| kiem_tu_ngu | burst_pressure | 0 | 100 | – | 11.5 | 124 | 0.00 |
| kiem_tu_ngu | attrition | 0 | 100 | – | 21.9 | 135 | 0.00 |

## Gate verdicts

| Gate | Result |
|---|---|
| exit-1 dominance (no path strictly first everywhere) | PASS |
| exit-2 identifiable strength + weakness per primary path | PASS |
| stalemate cells | none |
| exit-3 deadlocked economy channels | none |
| exit-4 secondary-mechanic dominance | PASS (unattributed share 0.00 everywhere, tolerance 0.20) |

`economyNoEvidence`: `the_tu_ung_the` and `kiem_tu_ngu` on
`single_target`/`attrition` — all-defeat cells carry no channel
evidence (fights end before channels can cycle); recorded, not
penalized.

## Per-path read (primary rows)

- **kiem_tu_hien** — fastest TTK on durable (270) and multi_enemy
  (166): burst-AoE identity. Weakness: burst_pressure (50% win, endHp
  0.04) and attrition (25%) — the glass-cannon profile is real.
- **phap_tu_ngu_hanh** — strongest survival margins (endHp 0.28/0.46
  under pressure/durable; mana-shield sustain). Weakness: attrition
  (13%) — sustain outlasted by the long-fight benchmark.
- **the_tu_hien** — attrition winner (100%, the sustain identity the
  benchmark was built to discriminate). Weakness: strictly weakest on
  single_target kill-speed — win-rate ties kiem_tu at 63% but loses
  the TTK tie-break (180 vs 160); also slowest TTK on durable (300)
  and multi_enemy (196). Wins by outlasting, not by speed.

Alternates are reported-only: ngo_dao is strong everywhere at entry
(mortal linh_bao Lv3 + tram Lv3 stay learned — see limitations);
ung_the and ngu are honest entry-level weak — ung_the's reactive
economy demonstrably cycles (theGained/theSpent move on multi_enemy)
but proc damage can't carry the fight alone yet, and ngu's emblem
forge is realm-gated (forgeCost unreachable at qi_refining).

## Limitations

- Entry-level point only; full-kit and cross-realm balance are out of
  scope. `linh_ngo_*` empowered-ult and ung_the branch-node scaling are
  Golden-Core+ — recorded via `notActiveAtThisPowerPoint`, never
  asserted.
- `other_skill` is empty on every row after the kit-surface fix: the
  ids that looked non-kit were the ways' own mechanics — kiem-pho
  combo extra-impacts carry the bare combo id (`tam_thich`), and
  ngo_dao strikes resolve under element-skill ids (`diem_kim_thuat`,
  `tho_cau_thuat`, ...). ngo_dao declares all five element ids (its
  strikes genuinely resolve across elements); ngu_hanh declares only
  the recipe-resolved live set (`hoa_cau_thuat`) so foreign-element
  leakage lands in `other_skill` instead of masquerading as kit. The
  remaining non-kit bucket is `buff_periodic` ailment DoTs
  (~0.05-0.45 share, highest on ngu_hanh's burn) — kit-applied but
  tracked as a secondary mechanic by design; not dominant anywhere
  -> PASS.
- 'the' ledger lane is trace-ops + battle-level residual: hit-income
  and proc transactions ride `gain_resource`/`consume_resource` ops
  (exact `applied` totals); the residual `(netObserved - traceNet)`
  covers the raw writers (`grantTheFromCast`, empowerment burn)
  exactly once.
- `loan_dau` cooldown 4->5 (The Tu-owned tuning, M3): strict-worst
  semantics surfaced that the_tu_hien's single_target deficit was
  hidden inside the eps tie-band; the cooldown trim makes the
  single-target weakness strict while attrition sustain (the
  intended strength) is unaffected.
- `full_mitigation_unobservable` + `regen_overheal_unobservable` gaps
  carry over from P4 (recorded in run diagnostics).

## Fingerprint snapshot

The committed regression oracle is
`src/core/simulation/benchmark/BalanceMatrix.test.ts` —
`EXPECTED_FINGERPRINTS` pins all 240 per-seed fingerprints exactly.
Any engine/content drift that moves a gate-driving metric moves a
fingerprint; table updates must land with the causing balance change
and an updated copy of this report.
