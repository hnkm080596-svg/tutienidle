# QA Review: drop-system branch (feat/drop-system, 17 commits)

- Date: 2026-09-12
- Mode: quick
- Verdict: PASS WITH GAPS — one Confirmed defect found and fixed during review; see Findings.
- Task-owned paths: `game/src/core/drop/{resolveDrops,DropContext,DropModifier,DropTable,dropSampling}.ts`, `game/src/core/game/{BattleLootSystem,GameManagerTurnBattleOps,StageWaveSystem,battleLootTestSetup}.ts`, `game/src/core/enemy/Enemy.ts`, `game/src/core/equipment/EquipmentSystem.ts`, `game/src/core/{reward/StageDropRules.ts,stage/Stage.ts,artifact/ArtifactProgression.ts}`, `game/src/data/{drop/{StageDropTables,FamilyDropTables},enemy/Enemies.ts,stage/Stages.ts}` plus task-owned `*.test.ts`.

## Scope and Risk Map

Mapper output: 3 domains (combat-and-tribulation, economy-and-progression, inventory-equipment), `deepAuditCandidate: true`, 8 unmapped paths — all unmapped paths are the NEW `core/drop/` module and `data/drop/` tables; they route manually to economy-and-progression (currency/items) and inventory-equipment (equipment grants).

Escalation decision: stayed quick. The change is broad but its blast radius is bounded — no new persisted state, no save-format change, all grants flow through existing save-covered bags (`MaterialBag`, `PillBag`, `EquipmentBag`, technique learn, battle summary). The plan mandated adversarial probes at every task (rng-order documentation, three-red sink drills, economy probe, idle channel probes), so the highest-risk invariants already carry Confirmed-class evidence. The residual economy/progression risk that remains is a deliberate, spec-documented redesign (E4 nerf, measured in §5.3), not an unknown.

Exclusions: `TurnBattleSystem.test.ts` (master, unrelated deterministic fix committed earlier); docs/plan files.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
|---|---|---|---|---|---|---|---|
| INV-DROP-1 | `rewardGranted` flag / BattleLootSystem | same kill processed twice | Exactly-once: one grant per dead enemy | Repeat | bag amounts unchanged on second pass | existing `processDefeatedEnemies` tests | Low — flag set before grant, covered |
| INV-DROP-2 | currency coefficient / DropModifier | boss+elite stacked kill | Boundedness: multiplier ≤ ×4 | Value mutation (bonus 4) | `dropEconomy.test.ts` ceiling assert | unit — probe run: mortal boss fails, stacked stays at cap | High — resolved |
| INV-DROP-3 | `channel` field / BattleLootSystem | throw inside auto-farm cycle | Lifecycle: channel restores to `active` | Interruption | last `setChannel` call is `active` after a thrown cycle | `GameManagerTurnBattleOps.idleDrops.test.ts` (added case) | High — **was a real leak before try/finally**; now covered |
| INV-DROP-4 | family pool / resolveDrops merge | plain kill of bandit-family enemy | Gating: rare technique stays elite/boss-gated | Cross-system chain (realm) | mortal bandit kill yields `van_kiem_quyet` | `resolveDrops.gating.qa.test.ts` | High — **Confirmed defect, fixed** |
| INV-DROP-5 | stage table currency / resolveDrops | hidden beast killed on its only legal stage | Stage-anchored currency: huyet_mong pays qi_refining band | Value mutation | ~10 stone/~40 insight vs authored 150/500 | code inspection + HiddenBeastSystem stage gate | Medium — spec-intended (hand-authored currency retired by design); noted |
| INV-DROP-6 | bags/summary | drops → save → reload | Recoverability: no new persisted state | Interruption | unchanged; bags already save-covered | existing SaveRoundTrip coverage | Low — resolved |
| INV-DROP-7 | signature `requiresModifier` | idle boss kill | E11: only chance===1 signatures on idle | Timing boundary (channel) | `yeu_dan_hung_giao` drops on idle boss; `great_dao_seed` (0.01%) does not | `BattleLootSystem.dropResult.test.ts` + idle tests | High — resolved by existing tests |
| INV-DROP-8 | `equipment_any` registry draw | any kill | item pool unfiltered by realm | Value mutation | whole-registry draw on floor-1 mortal | spec §7.1 documents this as deferred follow-up | Medium — documented gap |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| `npx vitest run` (full) | 502 files / 3362 tests, all pass | includes new drop module + QA tests |
| `npm run type-check` | 0 errors | vue-tsc --build |
| `npm run build` | success | rolldown warnings only (chunk size) |
| `npx eslint` on touched files | clean | |
| Sink-invariant three-red drill | all 3 sources turn red naming `zzz_no_sink` | stage pool, family pool, signatureDrops |
| Economy probe (BOSS currencyBonus 2→4) | mortal boss fails (6.0 vs 4.5); stacked green at ×4 cap | plan expected both red — stacked is structurally capped, cap-holding is the designed behavior |
| Channel-leak test (throw mid-cycle) | `setChannel('active')` still last call | added during this review |
| Gating repro (rng 0.9, mortal+bandit) | technique appeared pre-fix; absent post-fix | `resolveDrops.gating.qa.test.ts` |

## Findings

### QA-2026-09-12-001: Gated rare technique leaked into the ungated shared pool
- Severity: Medium
- Status: Confirmed (fixed during this review — production edit made by the dev workflow after evidence was captured)
- Invariant: gating/exactly-intended-reachability — a modifier-gated rare drop must not become reachable by ungated kills
- Preconditions: any bandit-family enemy kill (incl. `mortal_mountain_bandit`, mortal realm) on the active channel
- Reproduction: `resolveDrops` with mortal stage table + bandit family table, rng 0.9 → `van_kiem_quyet` in items
- Expected: technique reachable only via elite (20%) or boss (100%) bandit kills, per its authored contract
- Actual: any bandit kill drew it via the merged pool (~22% of family-slice draws)
- Evidence: deterministic repro test, now inverted into a regression guard
- Test file: `game/src/core/drop/resolveDrops.gating.qa.test.ts`
- Owner subsystem: `data/drop/FamilyDropTables.ts`
- Blast radius: early-game progression pacing (day-one technique on mortal tier); learn() has no realm gate
- Fix applied: pool line removed; bandit `signatureDrops` (0.2/tinh_anh, 1.0/boss) carry the gated contract. qi_refining OQ1 noEquipmentRate moved 13.3% → 7.6% (documented in spec §9).

### QA-2026-09-12-002: Auto-farm channel leak on mid-cycle throw
- Severity: Medium
- Status: Confirmed (fixed during this review — `try/finally` added to `rollAutoFarmCycleReward`)
- Invariant: lifecycle — transient channel must restore on failure
- Preconditions: exception inside `processDefeatedEnemies` during an auto-farm cycle (e.g. `createInstance` throws on missing profession grade)
- Reproduction: mocked `processDefeatedEnemies` throws; assert final `setChannel` call
- Expected: channel restores to `active` regardless of outcome
- Actual (pre-fix): restore skipped on throw → next real battle silently farmed at idle rates
- Evidence: `GameManagerTurnBattleOps.idleDrops.test.ts` throw-case, green post-fix
- Test file: `game/src/core/game/GameManagerTurnBattleOps.idleDrops.test.ts`
- Owner subsystem: `core/game/GameManagerTurnBattleOps.ts`
- Blast radius: wrong reward table on the next real battle; subtle economy drift

## New or Changed QA Tests

- `game/src/core/drop/resolveDrops.gating.qa.test.ts` — pins the elite/boss gate on `van_kiem_quyet`: unreachable from a plain mortal bandit kill; still reachable through the bandit's `signatureDrops` on tinh_anh/boss kills.
- `game/src/core/game/GameManagerTurnBattleOps.idleDrops.test.ts` — added the throw-mid-cycle channel-restore case.

## Gaps and Residual Risk

- `equipment_any` draws from the whole equipment registry regardless of realm (spec §7.1 — deferred follow-up task, documented).
- Hidden-beast currency now follows stage band (~10 stone) instead of its authored 150/500 — spec-intended stage anchoring, but the 1000-kill-window reward fantasy is thinner; flag for playtest.
- P14 browser verification deferred per worktree exception — run the boss-farm floor-10 pass on the main checkout during branch finishing.
- `TurnBattleSystem.selfBuff.qa.test.ts` flake observed in an earlier full run — pre-existing, passed in isolation; not caused by this branch.

## Pre-existing Failures

None observed in the final full run (502/502 green).
