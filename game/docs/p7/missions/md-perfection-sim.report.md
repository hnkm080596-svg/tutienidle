# M-D — Perfection Economy Simulation — Report

Spec: `md-perfection-sim.spec.md` v12 (external `MD_SPEC_REVIEWED`) · Suite: `src/core/simulation/earlygame/PerfectionEconomy.test.ts` (15/15 green) · Deterministic, `combatCultivationParity` on.

## Verdict

**Mortal perfection is infeasible under the current enumerated sources** — not merely hard. All 3 driven seeds end `proven_infeasible`: the stat axis starves at `realmLevel` 18 with the pool dry, while the body axis still completes 6/6 on schedule.

- **Stat axis**: `required = Σ(cap − baseline) = 45`; `available = creation 5 + breakthroughs 17 = 22`; **shortfall 23** — and the driven run's measured end-state deficit is *exactly* 23 (final `baseStats` 10/4/4/3/6 vs cap 10×5). Driven measurement and analytic budget agree to the point.
- **Reachable-source census**: `Reward` closed-type (no attribute channel — quests can't grant stats), zero authored `random_main_stat` pills, quest `itemDrops` transitively clean. The deficit is a *current-source* verdict, not a claim about future content.
- **Body axis**: 6/6 tiers = 36,790 `tinh_hoa_pham_the`; measured kills 26.1–26.4k vs analytic 26,279 (within ±1%); income 1.407/kill vs expected 1.4.

## Measured values (3 seeds)

| Metric | Normal (avg of 3) | Perfection (avg of 3) |
|---|---|---|
| Outcome | `achieved` (qi_refining) | `proven_infeasible` |
| `wallSeconds` (T_wall) | **~5,385 s (~90 min)** | ~54,487 s (~15.1 h) |
| `battleSeconds` | ~693 | ~45,402 |
| `cultivationSeconds` (idle) | 4,692 | ~9,085 |
| `stageRuns` | ~31 | ~2,027 |
| `enemiesDefeated` | ~335 | ~26,283 |
| `tinhHoaGained` | ~449 | ~36,799 |
| `realmLevelReached` | qi_refining:1 | mortal:18 |
| `attributePointsEarned/Spent` | 12 / 7 | 17 / 17 |
| `statAxisResolvedAt` (T_capout) | — | **~9,913 s (~2.75 h)** |
| `bodyAxisResolvedAt` | — | ~54,487 s |
| `uncountedStageRuns` | 0 | 0 |

Per-seed detail (perfection runs — measured `T_wall` / kills / essence / income-per-kill / `statAt` / `bodyAt`):

| Seed | Outcome | `enemiesDefeated` | `tinhHoaGained` | Income/kill | `T_wall` (s) | `statAt` (s) | `bodyAt` (s) |
|---|---|---|---|---|---|---|---|
| 11 | `proven_infeasible` | 26,141 | 36,805 | 1.4079 | 54,633.6 | 9,908.2 | 54,633.6 |
| 23 | `proven_infeasible` | 26,388 | 36,797 | 1.3945 | 53,483.6 | 9,927.2 | 53,483.6 |
| 7 | `proven_infeasible` | 26,319 | 36,794 | 1.3980 | 55,343.3 | 9,902.9 | 55,343.3 |

Per-seed `battleSeconds`/`idleCultivationSeconds`/`stageRuns`: 11 → 45,549.6 / 9,084 / 2,016; 23 → 44,396.6 / 9,087 / 2,035; 7 → 46,260.3 / 9,083 / 2,029. Averages: battle ~45,402 s + idle ~9,085 s = wall ~54,487 s (internally consistent).

Income variance across seeds: 1.3945–1.4079/kill (±0.5% band around expected 1.4). Normal-run `T_wall` per seed: 11 → 5,381 s; 23 → 5,400 s; 7 → 5,375 s.

## What the numbers say

- **T_capout ≈ 9.9k s** — the stat axis provably exhausts ~2.75 h in, long before the body axis finishes (~54.5k s). A player grinding perfection discovers infeasibility early; the remaining ~44.6k s of body farming is wasted effort toward an unreachable predicate.
- **Minimal quantified gap to feasibility**: +23 raw-stat points at mortal (e.g., an authored `random_main_stat` pill ×23 equivalent, raised cap semantics, or additional `attributePoints` grants). Deferred to the balance phase — this mission changes nothing.
- **Floor-wall finding**: the scripted canonical floor chain stalls at `mortal_dong_5` (`loopFailedAt: 6`, all seeds) — consistent with the documented post-P7-M3 wall characterization. T_normal therefore measures the *transition* path the economy supports (floors best-effort → grind to 12 → tribulation → ritual), not the full floor chain. The wall is a balance-phase finding, already pinned in `EarlyGameSession.test.ts`/`MortalChapterJourney.test.ts`.

## Model notes / limitations

- `combatCultivationParity` mirrors `App.vue`: per 0.1 s combat step `cultivate`+`breakthroughIfReady`; pre-stage + post-terminal `investRefinement` drains mirror `tickOps.update`'s per-tick `investBodyChapter`. Pinned ordering: pre-drain → `essenceBefore` → battle → rewards → `essenceAfter`/`tinhHoaGained` → terminal counters → post-drain.
- `bodyAxisResolvedAtSeconds` granularity = stage boundary (the tier completes inside a drain, timestamped at the drain's T_wall instant — not mid-battle).
- Tribulation tick-time (`tickOps.update(1)`) excluded from `battleSeconds` — a few ticks, noted not modeled.
- Determinism: same seed → identical `EconomyMeasurement` (verified); cross-seed variance only in loot rolls and battle durations.
- `uncountedStageRuns === 0` on all runs — kill accounting complete (live `enemies.filter(!alive)` over the terminal `TurnBattle`).
