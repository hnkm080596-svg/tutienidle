# M-D — Perfection Economy Simulation (D6 verification)

Status: v12 — impl-review resolution applied (`boundReason` distinguishes the primary bound from stall guards; timeout runs uncounted; default-run outcome must resolve; 3-seed income evidence pinned).
Decision: D6 — mortal perfection stays optional and hard; this mission *measures* whether the current economy supports that intent. **Analysis only — zero production behavior change.**
Worktree: `.agent-worktrees/md-perfection-sim` · Branch: `feat/md-perfection-sim` · Base: `c1714dd0` (post M-F)

## 1. Problem

D6 locked "Phàm Nhân hoàn mỹ optional — giữ khó" on the *assumption* that perfection is achievable-with-grind. Nobody has measured:

- **Stat axis**: perfection requires all 5 `MAIN_STAT_KEYS` at `baseStats >= 10` (mortal `attributeCap`). Enumerated raw-`baseStats` sources reachable at mortal: creation profile (+5 pool) and minor breakthroughs (+1 `attributePoints`/level, `maxLevel` 18 → 17). `permanent_stat` pills emit `pill-permanent:*` *modifiers* — the perfection predicate reads raw `player.baseStats`, so they don't count. `random_main_stat` exists as a `PillSystem.useProfessionPill` code path (`baseStats[stat] += 1`) but **no authored pill carries that effect** — unreachable today. Suspected verdict: `available ≈ 22` vs `required = Σ(cap − baseline) = 45` → infeasible, not merely hard. The sim must prove or refute this deterministically.
- **Body axis**: 6/6 refinement tiers = 50+175+615+2150+7500+26300 = **36,790** `tinh_hoa_pham_the`. Mortal stage table guarantees `amount 1..3 @ chance 0.7` per kill (expected 1.4/kill) → ~26.3k expected kills. The sim must convert this into wall-clock through the real battle driver.
- **T_normal vs T_perfect**: D6's "optional" claim needs the measured relationship — and an honest outcome label when perfection proves infeasible.

## 2. Scope

IN:
- A deterministic simulation (`core/simulation/earlygame/`) driving `EarlyGameSession` through production seams only — same tooling rule as `BattleSimulation`/`EarlyGameLoop`: headless orchestrator, reads public surfaces, nothing on the gameplay path may import it.
- `measureNormalRun(seed)`: T_normal = time to the successful mortal→`qi_refining` transition. The canonical loop **sliced through the `ritual` step** runs best-effort; if the scripted floor chain stalls (`mortal_dong_5` is a characterized balance wall — `MortalChapterJourney` pins floors 5–10 as currently unassertable), the run completes the transition the economy actually supports: grind to `realmLevel` 12 → tribulation → ritual. `loopFailedAt` is recorded in the measurement so the stall is **reported, not absorbed**; `purchase_node`/`qi_refining_forest` (post-mortal economy) are excluded.
- `measurePerfectionRun(seed, opts?)`: same mortal prefix, then the perfection window (levels 12→18): farm best cleared stage → equip → invest → allocate round-robin across `MAIN_STAT_KEYS` → grind breakthroughs. Two axes resolve **independently** (§3.3) — a starved stat axis does not stop the body measurement. Outcome enum:
  - `achieved` — `completedTiers >= 6` AND every main stat ≥ cap (same predicate `GameManagerRealmAdvanceOps` computes) — run stops immediately;
  - `proven_infeasible` — stat axis exhausted at `realmLevel === maxLevel` with `attributePoints === 0` and predicate still false, **and** the run continued until the body axis resolved (6/6) — body measurements are still complete;
  - `safety_bound` — a guard bound hit before the run could otherwise terminate (if it triggers under defaults, that itself is a finding). The measurement records `boundReason` so guards stay distinguishable: `max_kills` (the specified primary bound, `enemiesDefeated >= maxKills`, default ~40k), `max_iterations` (secondary stall guard — a zero-kill best-floor loop can't reach `maxKills`), `no_cleared_stage` (no floor to farm), `transition_incomplete` (normal-run only — could not reach `qi_refining`). Precedence rule: a bound fires only when the run hasn't already terminated — a stat `proven_infeasible` verdict with body still incomplete at bound ⇒ `safety_bound`, **not** `proven_infeasible` (§3.3).
- `EconomyMeasurement` record: `outcome`, `boundReason` (non-null iff `safety_bound`), `statAxisVerdict` (`achieved`|`proven_infeasible`|`unresolved` — `unresolved` when `safety_bound` ends the run before the stat axis exhausts), `statAxisResolvedAtSeconds` (resolution timestamp — `T_achieved` or `T_capout` per verdict, `null` when unresolved), `bodyTiersCompleted`, `bodyAxisResolvedAtSeconds` (`null` when the body axis didn't resolve — a bound hit does **not** resolve it), `cultivationSeconds` (idle waits only — see §3.1), `battleSeconds`, `stageRuns`, `victories`, `defeats`, `enemiesDefeated`, `tinhHoaGained`, `attributePointsEarned/Spent`, `realmLevelReached`, final raw `baseStats` main-key snapshot, `perfectionPredicateWouldPass`.
- `mortalStatBudget()` — pure *enumerated-source* budget (see §3.4); a cross-check, not the verdict owner.
- `reachableStatSourceCensus()` — data-level assertions over the catalogued baseStats writers (§3.5).
- `expectedEssencePerKill()` / `expectedKillsForBody()` — analytic values derived from `STAGE_DROP_TABLES` mortal band + `BODY_REFINEMENT_TIERS`.
- Report `docs/p7/missions/md-perfection-sim.report.md`: measured values per seed (≥3), income variance, per-axis verdict, `T_capout`/`T_achieved` bounds, and the minimal quantified gap to feasibility.

OUT:
- Any production change (balance, drop rates, caps, new stat sources) — findings go to the user, not into code.
- Save shape, version, migration; post-mortal economy; multiple creation profiles (one canonical profile, documented).

## 3. Design

### 3.1 Production-parity wall-clock (per-step co-advancement)

Production (`App.vue`) advances `player.cultivate(simulatedDelta)` every frame **including during battles**, and auto-`breakthrough()` when the bar fills. `cultivateTick` clamps accrual at the current level's `required` — batching a whole battle's seconds into one `cultivate(total)` call fills at most one level and **discards** the overflow that production would roll into the next level. The sim therefore cannot feed cultivation per-battle — it must co-advance per feed, exactly as production does per frame.

**Pinned model — session-owned parity flag**: `EarlyGameSession` gains a sim-only writable `combatCultivationParity: boolean` (default `false`). When `true`, `runStage` mirrors the production world-tick behavior around the battle:

- **Per consumed step** (inside `onAdvance`): `session.cultivate(COMBAT_STEP_SECONDS); session.breakthroughIfReady()` — mirroring `App.vue`'s per-frame cultivate+auto-breakthrough at 0.1s granularity.
- **Pre-stage** (immediately before `startStage`/CombatBuild): drain `session.investRefinement()` until it returns 0 — covers essence freed by *non-battle* breakthroughs that unlock a new body tier between stages; production's next world tick would auto-invest it before the next combat builds.
- **Post-terminal** (after rewards settle and the `tinhHoaGained` bag-delta snapshot is taken): drain `session.investRefinement()` until it returns 0 — covers essence looted during the battle, mirroring `GameManagerTickOps.update`'s per-tick `investBodyChapter` auto-invest. Mid-battle investment can't rewrite a frozen combat entity anyway, so terminal draining yields an equivalent pre-battle-N+1 state with **stage-boundary granularity** — the report must label `bodyAxisResolvedAtSeconds` accordingly (resolution lands at the stage boundary where the tier completed, not mid-battle).

**Pinned ordering** (mandatory, not implementation detail):
```
pre-stage drain → snapshot essenceBefore → startStage/battle →
rewards settle → snapshot essenceAfter / record tinhHoaGained →
record terminal counters (battleSeconds += advances×0.1, kills,
result, uncountedStageRuns) → post-terminal drain
```
Snapshotting *before* the pre-stage drain would count old drained essence as negative income — the order above keeps `tinhHoaGained` equal to what the battle actually dropped. Terminal counters land **before** the post-drain so `bodyCompletedAtSeconds` inside `investRefinement()` reads the true stage-end T_wall, not the pre-battle value.

**Body-completion timestamp**: the first drain (pre or post) that brings `completedTiers` to 6 records `simRunTotals.bodyCompletedAtSeconds = battleSeconds + idleCultivationSeconds` *at that instant* — session-owned observation, so a tier completing during a pre-stage drain isn't timestamped late by the whole battle that follows. `bodyAxisResolvedAtSeconds` reports this value (`null` if never reached).

Both measurement runs set the flag, so `measureNormalRun` (which delegates stage calls into `CANONICAL_EARLY_LOOP`/`EarlyGameLoop` → `session.runStage`) and `measurePerfectionRun` get **identical** parity — a per-callsite hook would asymmetrically exclude the normal run's stages. This preserves cultivation overflow, mid-battle level-ups, attribute-point arrival timing, body-gate timing, and body-progression strength between stages in both runs.

- `battleSeconds` = consumed combat seconds summed over runs (each advance consumes `COMBAT_STEP_SECONDS`).
- `cultivationSeconds` = **idle-wait only** — `session.cultivate(s)` calls the driver makes *outside* battles (grind waits). Battle-carried cultivation is already inside `battleSeconds`; counting it again would double-count.
- `T_wall = battleSeconds + cultivationSeconds` under this model — no `max()` bound needed because co-advancement already merges the concurrent component.

### 3.2 Session seams (simulation-harness only)

`EarlyGameSession` gains sim-only additions — permitted by spec §4 since it is simulation infrastructure, never production ops:

- `combatCultivationParity: boolean` — writable flag (default `false`); when `true`, `runStage` also: drains `investRefinement()`→0 **pre-stage** before CombatBuild (breakthrough-unlocked tiers) and **post-terminal** after the `tinhHoaGained` snapshot (looted essence); plus `onAdvance` calls `cultivate(COMBAT_STEP_SECONDS)` + `breakthroughIfReady()` per consumed step (§3.1 — cultivation + auto-invest parity).
- `materialAmount(id: string): number` — delegates `gameManager.materialBag.getAmount(id)` (typed API exists — no cast seam).
- `simRunTotals` — **cumulative** measurement counters at session authority, required because `EarlyGameLoop`/`CANONICAL_EARLY_LOOP` steps call `session.runStage()`/`cultivate()`/`allocateAttribute()`/`investRefinement()`/`breakthroughIfReady()` *internally*: neither `lastRunStats` nor the final bag can reconstruct a run's totals (essence is consumed by internal invests; allocations happen inside growth steps). Fields and update points:
  ```
  stageRuns / victories / defeats      — runStage terminal, per StageRunResult
  enemiesDefeated                      — runStage terminal, += per-run kills (§3.2 formula)
  battleSeconds                        — runStage terminal, += advances × COMBAT_STEP_SECONDS
  idleCultivationSeconds               — cultivate(), += s only when NOT a parity advance
                                         (session-internal in-drive flag distinguishes)
  tinhHoaGained                        — runStage, += bag delta of tinh_hoa_pham_the
                                         (before/after snapshot per run — survives internal
                                         invest consumption that a final-bag read would miss)
  attributePointsEarned                — breakthroughIfReady(), += player.attributePoints
                                         delta across a successful breakthrough call
  attributePointsSpent                 — allocateAttribute(), += 1 on success
  uncountedStageRuns                   — runStage terminal, += 1 when lastRunStats.counted
                                         is false (aggregate kill-completeness signal —
                                         a single flagged run invalidates the kill total;
                                         report measurements must assert this is 0)
  bodyCompletedAtSeconds               — recorded inside investRefinement() the first time
                                         completedTiers reaches 6 (battleSeconds +
                                         idleCultivationSeconds at that instant); null
                                         otherwise — covers parity drains AND explicit
                                         sim invest calls, so pre-stage completions are
                                         not timestamped late by the battle that follows
  ```
- `lastRunStats: { result: StageRunResult; enemiesDefeated: number; counted: boolean }` — per-run record populated inside `runStage` at terminal from the terminal `TurnBattle` (readable via `getTurnBattle()`, which persists post-run). `GameManagerBattleRewardOps` feeds `processDefeatedEnemies` a **newly mapped** `pendingEnemies` array — the per-wave splice mutates that copy, so the live `turnBattle.enemies` **retains** dead participants (`entity.alive === false`). Telegraphed spawns in `wave.pendingEnemySpawns` are never in `enemies`. Exact formula over the live array:
  ```
  enemiesDefeated = turnBattle.enemies.filter(e => !e.entity.alive).length
  ```
  Victory ⇒ equals `wave.spawnedCount === stage.totalEnemyCount`; defeat ⇒ partial kills still counted, matching the loot that actually landed in the bag. Missing/odd terminal state ⇒ `enemiesDefeated = 0` recorded with `counted:false` so the report can't silently treat it as a real zero. `simRunTotals.enemiesDefeated` accumulates this same per-run value (with `counted` runs still added at 0 — a `counted:false` run in the report is itself flagged).

`runStage`'s return contract (`StageRunResult`) is unchanged; the parity flag defaults `false`, so existing consumers (`MortalChapterJourney`, `EarlyGameLoop`) are unaffected.

### 3.3 Perfection drive (decoupled axes)

`measurePerfectionRun`:

1. Mortal prefix = the canonical loop sliced before the `tribulation` step, run best-effort (`loopFailedAt` tolerated — the dong_5 wall may stall the scripted floor chain; the perfection window farms whichever floor cleared).
2. Perfection window: loop `{ farm best cleared stage (with §3.1 per-step co-advance); equipAll; investRefinement; round-robin allocate across MAIN_STAT_KEYS; grind breakthroughs toward 18 }`.
3. **Stat axis** starts `unresolved` and resolves on whichever condition lands first, checked each loop iteration:
   - `achieved` — `MAIN_STAT_KEYS.every(stat => player.baseStats[stat] >= cap)` becomes true (in a feasible economy this can precede level 18);
   - `proven_infeasible` — `realmLevel === maxLevel` AND `attributePoints === 0` (pool starved) with the predicate still false.
   Record `statAxisResolvedAtSeconds` at whichever resolution lands (`T_achieved` or `T_capout` semantics — the report labels it by verdict). The run does **not** stop at stat resolution alone — the body axis still needs measuring unless the overall predicate is already true. A `safety_bound` exit before exhaustion leaves the verdict `unresolved` rather than fabricating one.
4. **Body axis** resolves only when `completedTiers === 6` (`bodyAxisResolvedAtSeconds`). A bound hit does **not** resolve the body axis — `bodyAxisResolvedAtSeconds` stays `null` and `bodyTiersCompleted` reports wherever it stopped.
5. Run terminates on the first of, in order: predicate true ⇒ `achieved`; `enemiesDefeated >= maxKills` ⇒ `safety_bound`/`max_kills`; `iterations >= maxIterations` ⇒ `safety_bound`/`max_iterations` (secondary stall guard — catches a degenerate zero-kill best-floor loop that `maxKills` alone cannot reach); no cleared stage to farm ⇒ `safety_bound`/`no_cleared_stage`; stat verdict `proven_infeasible` AND body axis resolved ⇒ `proven_infeasible` (body numbers still fully reported). Regardless of stat verdict, a starved stat axis does not promote a bound exit to `proven_infeasible`.
6. Record `perfectionPredicateWouldPass` by evaluating the ops predicate verbatim (`getBodyRefinementCompletedTiers(player) >= BODY_REFINEMENT_TIERS.length && MAIN_STAT_KEYS.every(stat => player.baseStats[stat] >= getMainStatCap('mortal'))`).

### 3.4 Budget formulas (pinned, data-derived — no magic numbers)

- `baseline[stat] = createBaseStats()[stat]` — raw authored base (canonical authority: `StatBlock.ts`), not a hardcoded 1.
- `required = Σ_{stat ∈ MAIN_STAT_KEYS} (getMainStatCap('mortal') − baseline[stat])`.
- `available = CHARACTER_CREATION_ATTRIBUTE_POINTS + (mortalRealm.maxLevel − createDefaultPlayer().realmLevel)` — creation pool + minor-breakthrough grants, the two enumerated sources reachable at mortal today.
- `shortfall = required − available`. Named `enumeratedSourceBudget` semantics: it describes *currently enumerated* sources and is a **cross-check** — the infeasibility verdict is owned by the *driven* run's measured end-state (§3.5), which cannot cheat past real sources.

### 3.5 Assertions (the test — structure, not tuned numbers)

- **Driven run is the verdict owner**: `measurePerfectionRun` ends `outcome === 'proven_infeasible'` (expected current verdict) OR `achieved`; the suite asserts `statAxisVerdict`, `perfectionPredicateWouldPass`, the measured end-state raw-stat deficit, and `simRunTotals.uncountedStageRuns === 0` (kill accounting complete). `realmLevelReached` is asserted **conditionally**: `proven_infeasible` ⇒ `=== 18`; `achieved` ⇒ no level requirement (a feasible economy may cap stats before 18).
- **Reachable-source census** (`reachableStatSourceCensus()` — explicit, data-verifiable, not implied by the deficit):
  - `Reward` is a closed type (`skillInsight|cultivation|spiritStone`) — quests **structurally cannot** grant attribute points; asserted via a `Reward` keyed-exhaustiveness compile check.
  - `PILLS.every(p => !p.effects.some(e => e.type === 'random_main_stat'))` — no authored pill reaches the `baseStats +=` path.
  - Quest `itemDrops` resolve only through `PILLS`/`MATERIALS` — with the PILLS census clean, no quest transitively reaches raw stats either.
  - `baseStats` writers reachable at mortal reduce to: creation allocation (one-time pool), `allocateAttributePoint` (breakthrough pool), `useProfessionPill` (`random_main_stat` — unauthored). The census asserts exactly this set is enumerated in `mortalStatBudget`.
- **Cross-check (scoped honestly)**: the agreement between driven deficit and analytic `shortfall` holds **for the sources the driver exercises** — farm/kill/allocate/breakthrough paths. A future source delivered through a *new* action class (quest claim, pill use, event) would be caught by the census assertions above, not by the deficit agreement — the spec claims only that composition.
- `mortalStatBudget().available < required`, shortfall reported exactly.
- `measureNormalRun` ends at `realmId === 'qi_refining'` post-ritual with counters > 0.
- Body axis: `bodyTiersCompleted === 6`; measured `enemiesDefeated` within ±25% of `expectedKillsForBody()`; measured essence income within ±25% of `expectedEssencePerKill() × enemiesDefeated` — with `enemiesDefeated` now exact (partial-kill loot included), the income/kill cross-check is sound.
- Determinism: same seed → identical `EconomyMeasurement`; ≥3 seeds report income variance.

## 4. Risks / invariants

- **No production mutation**: all code lives under `core/simulation/` + the pinned `EarlyGameSession` reads/hook (simulation infrastructure) + docs. Any seam the sim needs beyond §3.2 → spec amendment, not a production edit.
- **Determinism**: no `Math.random`/`Date.now` in measurement paths (session RNGs + fixed clock cover).
- **Read-only catalogs**: `STAGE_DROP_TABLES`, `BODY_REFINEMENT_TIERS`, `REALMS`, `MAIN_STAT_KEYS`, `createBaseStats`, `PILLS`, `QUESTS` — reads only.
- **Historical docs untouched.**
- Tribulation tick-time (`tickOps.update(1)` inside `runTribulation`) is excluded from `battleSeconds` — the ritual is a few ticks, noted in the report rather than modeled.

## 5. Acceptance

- [ ] `EconomyMeasurement` (two-axis), `mortalStatBudget` (enumerated-source), `reachableStatSourceCensus`, `expectedEssencePerKill`/`expectedKillsForBody` implemented per §3.4–3.5.
- [ ] `measureNormalRun` (mortal-prefix slice) + `measurePerfectionRun` (per-step co-advance, decoupled-axes outcome enum) complete on ≥3 seeds.
- [ ] §3.5 assertions green — including census + scoped cross-check.
- [ ] Report doc with measured bounds, kills, income, deficit, per-axis verdict, quantified gap.
- [ ] Zero production-file diffs (only `core/simulation/**`, `EarlyGameSession` sim-seams, tests, docs).
- [ ] External review `MD_IMPL_REVIEWED`.
