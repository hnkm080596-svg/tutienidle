# Adversarial QA — P5 Three-Path Balance Baseline (quick)

Scope: `game/src/core/simulation/benchmark/*` (5 files), P5 deltas in
`BattleSimulation.ts`, `BattleMetrics.ts` (+ their test files).
Task-owned paths only; the remaining dirty files belong to the P1–P4
stack and were excluded from this pass.

## Risk map

`changed-risk-map.mjs`: all 9 paths `unmapped`, `deepAuditCandidate: false`.
Manual routing: combat-and-tribulation (the harness wraps turn combat;
metric lanes read combat events). One-hop consumers: **none** —
`grep -rln "core/simulation"` outside `src/core/simulation/` returns
zero; the module is a leaf by design (P5 boundary requirement).

## Invariant ledger

| ID | State/owner | Hypothesis | Invariant | Result |
| --- | --- | --- | --- | --- |
| INV-P5-1 | fingerprint / collector | Engine/content drift moves a gate-driving metric but not the fingerprint | Determinism | No defect — fingerprint covers outcome, steps, phaseSteps, vitalsDamage, damageByMechanic, resources, casts, playerEndHpFraction; 240-entry committed table re-matches exactly |
| INV-P5-2 | runBattle | State leaks between the 240 matrix runs | Isolation | No defect — fresh `GameManager` + `mortalSourcePlayer()` per run via `recipeInputs`; P4 teardown suite covers battle cleanup |
| INV-P5-3 | BENCHMARKS fixtures | Shared module-level Enemy/Stage objects mutated across the 48 multi_enemy runs | Stale state | No defect — P4 established `enemyToCombatEntity` shares nested objects read-only (`recomputeEffectiveStats` replaces wholesale, never writes in place); identical-seed fingerprints across recipes confirm no cross-run drift |
| INV-P5-4 | `sampleThe` diff lane | Entity removed from `battle.players/enemies` before next sample loses its final-step movement | Conservation | Coverage note — enemy `the` ledgers are not gate-consumed; player participant persists for the whole fight. Low materiality |
| INV-P5-5 | `sampleThe` baseline | `currentThe` granted before first snapshot is sampled as baseline, not income | Conservation | No defect — `currentThe` is optional (`?? 0` at every read: TheEconomy.ts:36-73, TurnBattleSystem.ts:1797+); no pre-fight grant exists |
| INV-P5-6 | EXPECTED_FINGERPRINTS | Committed table predates final tuning / is stale | Oracle honesty | No defect — `BalanceMatrix.test.ts` passes; the table IS the live matrix output |
| INV-P5-7 | deadlock gate | mustCast silently unchecked for alternate recipes | Coverage | No defect — gate iterates all cells (primary + alternate); real matrix shows `ngu_kiem_thuat`/`tham_the`/`van_phap_tuy_tam` casts recorded |
| INV-P5-8 | compareCells | NaN scalar poisons ranking silently | Boundedness | No defect — `playerDps` guarded (`duration > 0 ? : 0`), `endHpFraction` guarded by `maxHp > 0`, NaN can't reach the comparator through these fields |
| INV-P5-9 | economyMovement | timeout seeds wrongly excluded from evidence | Correctness | No defect — `outcome !== 'defeat'` keeps timeouts eligible (a timeout fight ran long enough to cycle) |
| INV-P5-10 | aggregateCell | shared `mortalSourcePlayer()` across seeds drifts | Isolation | No defect — `recipeInputs` → `mortalBuild()` → `mortalSourcePlayer()` is per-call; each seed gets a fresh source |
| INV-P5-11 | playerEndHpFraction | Post-death vitals event corrupts the burst scalar | Monotonicity | No defect — "latest observed state" semantics is intended (revive → post-revive HP is the true end state); defeats drive victoryRate anyway |
| INV-P5-12 | mechanic `unattributed` | traced > vitals over-attribution clamped to 0 hides a double-count | Boundedness | Suspected/Low — `Math.max(0, ...)` floors negative drift; recorded limitation, report surfaces `unattributedShare` for review |

## Focused checks run

- Boundary grep: zero non-simulation importers — PASS.
- `npx vitest run src/core/simulation`: 44/44 PASS (includes the
  fingerprint-snapshot oracle and the FPS-independence/determinism proofs).
- `npm run verify`: 697 files / 6095 tests PASS.
- `currentThe` initialization audit: optional field, `?? 0` at all
  read sites — no hidden pre-baseline income.

## Findings

- **Low (recorded, not blocking)**: `damageByMechanic.unattributed`
  clamps negative drift to 0 — an over-attributing trace lane would be
  invisible. Report surfaces `unattributedShare`; acceptable for a
  measurement tool.
- **Low (coverage note)**: enemy-entity `the` movement in an entity's
  death step can be unsampled; no gate consumes enemy ledgers.

No Critical/High/Medium findings. No reproduction tests needed — no
confirmed defect exists.

## Verdict

**PASS WITH EVIDENCE** — leaf tooling module, zero external consumers,
all invariants checked against live evidence.

---

## Addendum — post external-review rework (2026-09-23, second pass)

The external review round changed metric semantics after the first
QA pass; re-verified surface below.

- `the` lane is now **trace-ops + battle residual** (not the per-step
  net diff recorded above): hit-income/proc transactions ride
  `gain_resource`/`consume_resource` ops with exact `applied` totals;
  the residual `(last - first - traceNet)` covers only raw writers
  (`grantTheFromCast`, empowerment burn). INV-P5-4/5 sampling notes are
  superseded; residual proof: `raw currentThe writes land via the
  residual lane` test.
- Player output denominator is now `vitalsDamage.playerOnEnemy`
  (player-sourced hp loss on enemy-side targets only); the bilateral
  bySource/byTarget maps remain diagnostic. Op-lane filter mirrors the
  contract (`payload.targetId` must role-key to `enemy:*`). Dead
  enemies stay in `battle.enemies` (filtered by `.alive`, never
  spliced) so role keys survive death.
- `playerDps` is the all-seeds battery mean (defeat seeds included);
  `ttk` stays victory-median.
- Stalemate + deadlock failure lists are primary-row only;
  `economyNoEvidence` still reports alternate cells as diagnostics.
- `kitSkillIds` covers the recipe-resolved mechanic surface: the
  realm-reachable kiem-pho combo ids (`reachableKiemPhoComboIds` —
  at qi_refining only `tam_thich`; higher-realm combos classify as
  `other_skill` leakage),
  ngo_dao's five `PHAP_TU_BASICS` element ids (its strikes resolve
  across elements), and ngu_hanh's resolved live set only
  (`hoa_cau_thuat`) — foreign-element origins on that row classify as
  `other_skill` leakage. `other_skill` is now empty on every matrix
  row; only `buff_periodic` remains as the designed secondary bucket.
- `loan_dau.cooldownTurns` 4->5 (The Tu-owned tuning): the_tu_hien's
  single_target weakness is now strictly-worst outside eps, attrition
  strength preserved. `TheTuSkills.test.ts` pin updated.
- New collector oracles pin: enemy-side vs self/ally vitals,
  stat_refresh exclusion, skill-op bucket + target filter,
  untraced-damage unattributed, byKind+unattributed coverage sum, real
  reaction bucket on the ngo_dao fixture.
- Re-verified: 55/55 sim tests + 8 provider tests, ascii ratchet,
  type-check; committed fingerprint table regenerated after the
  digest gained `playerOnEnemy`.
- Final state after all four external review rounds: `npm run verify`
  green — 697 files / 6107 tests (the only failure seen across runs
  was the known ChiHienQuan `Math.random` scheduling flake, unrelated
  to this surface and green on isolated re-run).

Verdict for the reworked state: **PASS WITH EVIDENCE** (no new
Critical/High/Medium findings; no production-code QA edits made).
External review verdict: IMPLEMENT-READY after 4 fix rounds.
