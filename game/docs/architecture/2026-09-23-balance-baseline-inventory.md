# P5-M0 — Balance Baseline Inventory

Plan: `docs/superpowers/plans/2026-09-22-three-path-balance-baseline.md`
(externally reviewed to IMPLEMENT-READY, 5 rounds). This document is the
M0 census: every value below was verified against source, not assumed.

## 1. Universal-qualified mortal source

`createDefaultPlayer()` + these field writes (build input, declared once
in `BalanceBaselines.ts`):

| Field | Value | Why |
|---|---|---|
| `realmId` | `'mortal'` | `chooseCultivationPath` requires it |
| `realmLevel` | `12` | `CORE_REALM_LEVEL = 12` (realmSystem.ts:44) |
| `skillLevels` | `{ tram: 3, huy_quyen: 3 }` | `ngu`/`ung_the` offerGates read `player.skillLevels` (CultivationPathKit.ts:429) |
| `skillCastCounts` | `{ linh_bao: CAST_LEVELING_THRESHOLDS.linh_bao.lv3 }` | `ngo_dao` gate reads cast level (CultivationPathKit.ts:435-438); proven pattern in BattleSimulation.test.ts:61 |
| `skillInsight` | `50` | covers `cuong_chien` (insightCost 1) + headroom; element roots cost 0 |
| `selectedTalentIds` | `[]` | `rollVanDaoWaive` uses `Math.random` gated on cost-free talents — empty list keeps purchases deterministic |
| `baseStats` | defaults (might 10, maxHp 100, speed 100, crit 5%/1.5x) | identical source — path differentiation comes from the way's own modifiers |
| `skills` / `techniques` | `[]` | gates read PlayerData mirrors only; the ritual learns/equips way content manager-side |

Verified: `chooseCultivationPath` itself advances mortal →
`qi_refining` Lv1 at commit (GameManagerRealmAdvanceOps.ts:243-258), so
post-ritual `realm: qi_refining` node prerequisites are satisfied.

## 2. BaselineRecipe rows

Primary gate rows:

| Row | ritual | postRitual writes | Resulting kit |
|---|---|---|---|
| `kiem_tu_hien` | `{kiem_tu, hien}` | none | Kiem Pho orb rotation via `KiemPhoProvider` dynamicBasic (`resolveBasic` cycles `unlockedOrbs(realm)`); `freshKiemTuState` preset functional at ritual; orbs auto-learned+equipped via `way.skillIds = KIEM_PHO_ORB_IDS` |
| `phap_tu_ngu_hanh` | `{phap_tu, ngu_hanh}` | `{select_phap_tu_element, element:'fire', route:'dot'}` | `selectPhapTuElement` purchases the free element root (insightCost 0, excludesNode mutex) → unlocks `PHAP_TU_KIT_IDS.fire = [hoa_cau_thuat, tam_muoi_chan_hoa, hoa_ha_cuu_thien]` learned kit; `dai_ngu_hanh_chan_quyet` technique (maxMp+100, manaRegen+2, manaShield+0.25) |
| `the_tu_hien` | `{the_tu, hien}` | `{purchase_node, 'cuong_chien'}` | `resolveTheTuKit` → CUONG_QUYEN/LOAN_DAU/BAT_TU_BA_THE (missing-HP scaling + survive buff); `kim_cang_bat_hoai_the` technique (hpRegen tiers) |

Alternate rows (reported, not gate rows): `phap_tu_ngo_dao`
(postRitual none — kit granted at ritual), `the_tu_ung_the`
(`purchase_node` x3: `ho_mon`/`phan_mon`/`tro_mon` — non-mutex roots,
insightCost 0, qi_refining prereq; M2 correction: without them the
kit's `grantsBuffsAtBuild` carries only the bare `ung_the` marker and
no reactive window ever opens — `buildTheTuAnKit(ownedRoots)` keys the
marker set on owned roots, same root-dependency class as hien's
`cuong_chien`), `kiem_tu_ngu` (none — `ngu_kiem_thuat` resolves via
`NguKiemDaoProvider` at ritual; emblem forge is realm-gated out of the
entry point — `forgeCost` unreachable at qi_refining).

Element choice for ngu_hanh is a declared build input (`fire`/`dot` for
the default row); element-sensitivity is a secondary-row concern.

## 3. Benchmark fixtures

All synthetic, deterministic literals — `defineEnemy` shape, stats
tuned in M2 empirically against the real baseline outputs (rationale
column is the DESIGN intent; M2 adjusts numbers so the scalar
discriminates):

| Fixture | Kind | Intent | Shipped statsInput (post-M2 sweep) |
|---|---|---|---|
| `single_target` | `enemy` | moderate hp/might — kill-speed identity | hp 400, might 12, armor 5 |
| `multi_enemy` | `customStage` (pool of N≈4 weak, `totalEnemyCount`+`waves`) | AoE throughput | hp 80, might 6, x4 in two waves |
| `durable_target` | `enemy` | high hp, low might — sustained DPS ceiling resolved by TTK | hp 1200, might 3, armor 8 |
| `burst_pressure` | `enemy` | high might — survival margin (end-HP scalar) | hp 250, might 16, spd 1.2, crit 10% |
| `attrition` | `enemy` | sustain decides — raw-DPS paths die, sustain paths win | hp 900, might 6, armor 5 |

M2 sweep evidence (seed 22, primary rows): the first-pass durable
(hp3000/might5), burst (might30) and attrition (hp1500/might15)
fixtures produced 100% defeats for EVERY recipe — outcome-first
ordering then ties everywhere and no weakness can emerge. The shipped
values discriminate: durable resolves by TTK (270/291/300), burst by
end-HP (0.04/0.28/0.27 on wins, kiem at 50% win), attrition by
outcome (the_tu 100% vs kiem 25% / phap 13%).

## 4. Seed battery

`BALANCE_SEEDS = [11, 22, 33, 44, 55, 66, 77, 88]` — K=8, identical
across all cells. Victory-rate granularity 1/8 = 12.5%. Runtime bound:
6 rows × 5 benchmarks × 8 seeds = 240 runs in the full matrix; gate
rows (3 primary × 5 × 8 = 120) stay the asserted surface.

## 5. Metrics + gates (final contract)

- Player HP output: `hpDamageBySource['player']` — vitals lane,
  `hpBefore − hpAfter` on enemy targets with player-side `sourceId`
  and `reason ∈ {damage, dot, ward_break, reaction, reflection,
  heavenly_tribulation}`.
- Incoming: same lane on `entityId` = player, same reason set.
  `stat_refresh` excluded (verified: `clampToMaxHp` shrinks HP without
  combat damage).
- Mechanic attribution: `trace.records` → `operation.origin.kind` +
  settled `result.damage.hpDamage`; buckets `kit_skill`/`other_skill`/
  `reaction`/`buff_periodic`/`proc`/`scripted`/`unattributed`.
  `kit_skill` membership = the recipe's resolved kit skill set (way
  `ownedContent.skillIds` + kit basics resolved at battle build —
  recorded per recipe in the report).
- Aggregate ordering per benchmark: lexicographic
  `(victoryRate desc, defeatRate asc, scenario scalar…)`;
  scalar ties at relative ε = 0.05; `ttk` = median fightingSteps over
  victorious seeds; `null` ttk never ties with a number.
- Scenario scalars: single/durable → median victory TTK; multi →
  victory TTK then mean player DPS; burst → median end-HP fraction
  then mean DPS; attrition → victory TTK then resource-stability flag.
- Gates: dominance (exit-1), strength+weakness (exit-2), stalemate,
  resource-deadlock via phase-aware `expectedEconomy`
  (`mustGenerate`/`mustSpend`/`notActiveAtThisPowerPoint`/`mustCast`),
  universal-secondary tri-state (PASS / REVIEW_REQUIRED /
  INCONCLUSIVE — only PASS satisfies exit-4).
- Fingerprint: extends P4 digest with normalized `hpDamageBySource` +
  `damageByMechanic` + `phaseSteps` + resource ledger — the
  gate-driving fields are regression-covered.

## 6. expectedEconomy declarations

| Row | mustGenerate | mustSpend | notActiveAtThisPowerPoint | mustCast |
|---|---|---|---|---|
| kiem_tu/hien | — | — | — | orb basics (kit def ids resolved at build) |
| phap_tu/ngu_hanh | `theGained` (+5/cast via `applyPhapTuTheGains`), `mpGained` (manaRegen 2/turn) | `mpSpent` (mana-shield absorb on hits taken) | `theSpent` (empowered ult is golden_core-gated — verified PhapTuNodes.builders.ts:184) | element basic `hoa_cau_thuat` |
| the_tu/hien | `healingReceived` (hpRegen from `kim_cang_bat_hoai_the` tier) | — | `the*` (ung_the-owned; verified TheEconomy.ts "ung_the proc-fuel") | `cuong_quyen` |
| ngo_dao (alt) | per census of its kit | | | kit actives |
| ung_the (alt) | `theGained` | `theSpent` (reactive procs) | — | kit actives |
| ngu (alt) | — | — | Kiem Y/Kiem Dao gauges unledgered (buff-state — recorded limitation) | kit actives |

`none` (all lists empty) is a legal declaration; the gate never
invents channels the way doesn't own.

## 7. Harness changes required (verified gaps)

- `BattleSimulation.ts` registers only `PHAP_TU_NODES` +
  `PHAP_TU_AN_NODES`; production registers the full closure
  (`App.vue:295-299` adds `KIEM_TU_NODES` + `THE_TU_NODES` +
  `THE_TU_AN_NODES`). `purchaseNode('cuong_chien')` fails without it
  (`nodeRegistry.has` → false). M1 extends the bootstrap.
- `BattleSimulationInput` gains `postRitual?: readonly
  SimulationCanonicalWrite[]` — closed union
  `{select_phap_tu_element, element, route}` |
  `{purchase_node, nodeId}`, executed via
  `gameManager.progressionOps.selectPhapTuElement` /
  `progressionOps.purchaseNode` after the ritual, before battle start.
  A false return throws with the recipe id.
- `BattleMetricsCollector` gains `hpDamageBySource` (vitals lane),
  `hpDamageTaken` (same reason set on player target),
  `damageByMechanic` (trace provenance), all fingerprint-covered.
- M2/M3 correction: `the` is trace-ops + battle-level residual —
  external review showed hit-income (`grantHitOutcomeIncome`) and proc
  transactions DO route through `gain_resource`/`consume_resource`
  ops (emitAndSettle), while `grantTheFromCast`
  (skill theGainOnLandedCast/Crit) and the empowerment burn
  (`currentThe = 0`) stay raw. The trace lane counts exact op
  totals (`result.result?.applied`); the residual lane adds
  `(netObserved - traceNet)` per participant so raw writes are still
  captured once. A per-step net-diff lane was rejected — it would
  double-count the op-routed movement it overlaps.
- Baseline player at qi_refining Lv1 vs real `wild_wolf`
  (hp 200 / might 20): fixtures are synthetic-tuned, not real-content
  bound — the matrix compares paths, not content difficulty.

## 8. Recorded limitations (honest, not auto-failed)

- Entry-level only: ngu_hanh empowered-ult lane + `theSpent` are
  golden_core-gated; full-kit comparison is deferred.
- Kiếm Ngự's Kiếm Ý/Kiếm Đạo gauges are buff-state — no ledger
  channel; alternate-row only.
- `unattributed` mechanic bucket will contain genuinely non-scheduler
  damage (e.g. ward-break self-damage emitted inside
  `resolveActionHit`); the coverage tolerance absorbs it.
- DoT/non-hit damage sources attributed via `origin.kind`, not by the
  `damage` event lane.
