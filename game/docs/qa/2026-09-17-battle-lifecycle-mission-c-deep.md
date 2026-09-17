# QA Review: Battle Lifecycle Constitution (Mission C)

- Date: 2026-09-17
- Mode: deep (mandatory escalation — combat chain + lifecycle boundary)
- Verdict: PASS WITH GAPS
- Task-owned paths: `src/core/battle/**` (BattleCyclePolicy, SeededRandom, AilmentChance, TurnBattleSystem, TurnSkillAction), `src/core/game/GameManagerTurnBattleOps.ts`, `src/core/game/GameManager.ts`, `src/core/game/StageWaveSystem.ts`, `src/core/stage/StageSystem.ts`, `src/core/buff/BuffSystem.ts`, `src/core/combat/CombatSystem.ts`, `src/core/player/CultivationPathRuntime.ts`, `src/core/player/CultivationPathRegistry.ts`, `src/core/phap-tu/PhapTuRoutes.ts`, `src/core/game/SkillToTurnSkillConverter.ts`, `src/data/skill/PhapTuEmpoweredUlts.ts`, `src/core/skill/SkillEffect.ts`

## Scope and Risk Map

Changed systems: turn-battle lifecycle (single-owner `beginBattleCycle`), session RNG threading, cultivation-path runtime registry, mid-impact death guards, skill-semantic fixes. One-hop consumers reviewed: `StageWaveSystem` launch chain, `CombatAnimationRuntime` ack/token surface, `BattleLootSystem` session carry, `CombatScene`/presentation session, `useBattleActions` repeat/refight callers. Excluded: economy `Math.random` defaults in alchemy/equipment/gacha (documented non-combat boundary, spec C3).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-C-1 | Cycle-scoped engine state / `GameManagerTurnBattleOps` | `restartTurnBattleCycle` after victory | Lifecycle: repeat cycle is provably fresh | Repeat | Every `BATTLE_CYCLE_RESET_FIELDS` entry asserted post-repeat | `GameManager.battleCycle.test.ts` | Impact high, reachability high (auto-repeat loop) |
| INV-C-2 | Playback token / `CombatAnimationRuntime` | Stale ack arrives after a new cycle began | Stale state: token from cycle N cannot drain cycle N+1 pending | Stale state | Monotonic `playback-N` token rejection | `GameManager.battleCycle.test.ts` | High — cross-battle mutation |
| INV-C-3 | Session RNG / `beginBattleCycle` | Every combat roll reads one minted source | Determinism: seeded battles replay identically | Reorder/repeat | Two seeded runs produce identical positions/hp/turns | `GameManager.battleCycle.test.ts` determinism case | High — the mission's core contract |
| INV-C-4 | `Math.random` escapes on combat path | Any roll during battle | Determinism: no unseeded roll on the combat path | Value mutation (seed) | Stack-trace attribution of every `Math.random` call in a seeded battle | Same determinism test | High |
| INV-C-5 | Path dispatch / `CultivationPathRegistry` | Battle start for every `path:way` pair + unknown pair | Recoverability: unknown/absent path cannot lock progression | Value mutation | `resolveCultivationPathRuntime` falls back to mortal runtime, never throws | `CultivationPathRuntime.test.ts` + registry fallback inspection | High — progression lock class |
| INV-C-6 | `isStageStarting`/`pendingLaunchStage` | `stageWaves.start` throws mid-launch | Recoverability: launch flags always clear | Interruption | `finally` block at `startStage:1342-1346` | inspection | Medium |
| INV-C-7 | `EnemySystem` membership | Battle end (victory/defeat/abandon) then next battle | Lifecycle: no ghost entities in the enemy manager | Interruption/repeat | `enemyManager.clear()` in `abandonBattle`; per-kill `despawn` in `BattleLootSystem:400`; repeat only runs post-victory (all dead→despawned) | inspection | Medium |
| INV-C-8 | `elementApplicationPercent` | Ailment application in turn combat | Boundedness/parity: base+percent clamped ≤1, same as legacy `SkillEffectSystem:294` | Value mutation | `AilmentChance.test.ts` (5 cases) | unit | High — confirmed-closed bug class |
| INV-C-9 | `stacksPerAffectedTarget` | `hau_tho_thanh_luy` cast vs N targets, incl. dead targets | Exactly-once/stack-count = living affected targets only | Value mutation (dead/alive mix) | `TurnBattleSystem.stacksPerAffectedTarget.test.ts` (3 cases, incl. 8-cap) | unit | Medium |
| INV-C-10 | `ailmentStackBonus` | Route profile applied to ailment with omitted stacks | Parity: engine implicit-1 base + bonus | Value mutation | `PhapTuRoutes.test.ts` expects 2 | unit | Medium |
| INV-C-11 | `UNSUPPORTED_EFFECT_FIELDS` | Skill with authored `scope`/`refresh` converts | Synchronization: unsupported semantics reported, not dropped | Stale state | `SkillToTurnSkillConverter.test.ts` reports both | unit | Medium |
| INV-C-12 | `boundaryQueue`/pipeline/token | Cycle entry while commands pending | Lifecycle: cycle-N commands cannot execute in cycle N+1 | Reorder | `clearCycleEntryState` runs first inside `beginBattleCycle` | `GameManager.battleCycle.test.ts` | High |
| INV-C-13 | `lastStageEnemyTemplate` | Repeat cycle where `pickEnemyForTurnSpawn` returns undefined | Stale state: prior-cycle template usable as fallback | Stale state | Field is fallback-only; spawn still routes through wave system | inspection | Low |
| INV-C-14 | Manual-mode flag + queued executions | Repeat during manual mode | Lifecycle: pending manual cannot cross boundary | Interruption | `turnSystemPending` reset + fresh `TurnBattleSystem` instance | `GameManager.turnManualMode.test.ts` + battleCycle tests | High |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` | PASS | clean |
| `npm run build` | PASS | 5.82s |
| `npx vitest run` (full) | PASS | 616 files / 5196 tests / 4 expected-fail / 0 failures |
| `npx playwright test tests/e2e/turn-combat-hud.spec.ts` | PASS | 3.7m isolated run — battle resolves, refight works |
| `npx playwright test tests/e2e/create-to-combat.spec.ts` | PASS | 3.6m |
| Repeat-cycle field reset | PASS | `GameManager.battleCycle.test.ts` asserts each `BATTLE_CYCLE_RESET_FIELDS` entry post-repeat |
| Stale-ack rejection | PASS | generation bump + `resetPendingState` + monotonic tokens, tested |
| Seeded replay determinism | PASS | identical positions/hp/turn order across two seeded runs; remaining `Math.random` calls stack-traced to `resolveDrops`/`BattleLootSystem` only (documented economy boundary) |
| Path-runtime unknown pair | PASS | `resolveCultivationPathRuntime` falls back to `createMortalRuntime`; no throw path |
| Launch-flag cleanup | PASS | `finally` clears `isStageStarting`/`pendingLaunchStage` (`startStage:1342-1346`) |
| Enemy ghost entities | PASS | `abandonBattle` → `enemyManager.clear()`; victory→repeat despawns all via per-kill `despawn` |
| `elementApplicationPercent` proc-chance parity | PASS | legacy `SkillEffectSystem:294` applies it only to declared `ailmentChance`, matching the turn port |

## Findings

### QA-2026-09-17-C1: `resolveAilmentApplicationChance` doc promises `[0,1]`, implementation clamps only the top
- Severity: Low
- Status: Confirmed (code/doc inspection — behaviorally equivalent at the sole call site)
- Invariant: Boundedness
- Preconditions: `elementApplicationPercent` negative (no authored negative source exists today; stat domain is gated)
- Expected: contract matches doc, `Math.max(0, Math.min(1, x))`
- Actual: `Math.min(1, x)` — a negative result still behaves as 0 (`rng() < neg` is always false), so no live defect; contract drift only
- Evidence: `AilmentChance.ts`
- Test file: none
- Owner subsystem: `core/battle/turn`
- Blast radius: none today; semantic drift if a second consumer ever asserts the return range

### QA-2026-09-17-C2: Stored `Math.random` defaults on three combat-adjacent signatures
- Severity: Low
- Status: Confirmed (inspection; all production call sites pass explicit rng)
- Invariant: Determinism
- Locations: `BuffSystem.rollOnHitEffects` (`:483`), `BuffSystem` (`:508`), `StageSystem.pickNextEnemyEntry` (`:8`), `GameManagerTurnBattleOps.combatRng` field initializer (`:806`)
- Expected: lazy `() => Math.random()` convention used everywhere else in this mission (avoids `vi.spyOn` bypass and makes the boundary obvious)
- Actual: stored references — unreachable in production today (ops always passes `this.combatRng`; wave system always passes `options.rng`; the field is re-minted before any roll), but a future caller omitting the arg silently escapes the session boundary AND test spies
- Evidence: grep + call-site audit
- Test file: none
- Owner subsystem: combat RNG boundary
- Blast radius: latent — convention drift, not a live defect

### QA-2026-09-17-C3: `startBattle`/`startBattleWithPlayer` during an active non-stage battle leaves prior `EnemySystem` entities
- Severity: Low
- Status: Suspected (pre-existing; reachable only through devtools/test entry paths — UI flows route through `abandonBattle` which clears)
- Invariant: Lifecycle
- Expected: cycle entry clears stale enemy-manager membership
- Actual: `beginBattleCycle` does not clear `enemyManager`; the real exit paths do
- Evidence: `GameManagerTurnBattleOps.ts` — `abandonBattle` clears, `beginBattleCycle` doesn't
- Test file: none
- Owner subsystem: `core/game`
- Blast radius: devtools/test path only; entity ids are uuid-suffixed so no collision; manager list grows until next abandon/defeat exit

### QA-2026-09-17-C4: `lastStageEnemyTemplate` persists across cycles
- Severity: Low
- Status: Confirmed (inspection — intentional-looking fallback, bounded)
- Invariant: Lifecycle (mild)
- Notes: fallback is only consumed when `pickEnemyForTurnSpawn` returns undefined inside a live stage battle; cross-cycle staleness can only substitute a template within the same stage. Recorded for visibility; no fix recommended.
- Test file: none

## New or Changed QA Tests

None added by this audit — every high-risk hypothesis was resolved by an existing intended-failing regression test authored during implementation (`GameManager.battleCycle.test.ts`, `TurnBattleSystem.stacksPerAffectedTarget.test.ts`, `AilmentChance.test.ts`, `PhapTuRoutes.test.ts`, `SkillToTurnSkillConverter.test.ts`, `battleLifecyclePathBoundary.test.ts`) or by direct code inspection of an unambiguous oracle.

## Gaps and Residual Risk

- `turn-combat-hud` e2e flaked once under parallel vitest load (CPU starvation of the RAF-driven combat clock — round 19/20 at the 180s assert boundary); green on isolated re-run (3.7m). Class: Flaky environment, not a code defect — evidence retained.
- Electron quit-flush interplay with the new cycle owner is unit-tested but not e2e-tested (not drivable in Playwright — same limitation as Mission B).
- The four stored-`Math.random` defaults (C2) are one-word fixes away from the mission's own convention; recommended as a hygiene follow-up inside this mission rather than deferred.

## Pre-existing Failures

None observed. The `kiem-tu/invariants` file-scan timeouts under load seen in Mission B did not recur in this suite run.

---

# Addendum — External audit round (lease/ownership unification), HEAD cb3a602f+

External re-review of Mission C against post-B-rounds master returned `REQUEST CHANGES` — 1 High + 3 Medium. All four verified real before repair; this round is the fix record.

## Findings (confirmed → fixed)

### EXT-C1 (HIGH): `StageWaveSystem.start()` leaked the slot on a thrown launch
- **Evidence:** `stageManager.start()` acquired the lease at admission; `pickEnemyForSpawn` (`weightedRandom` throws on empty pool) and `launchBattle`→`beginBattleCycle` (`resolvePathRuntime`, skill conversion, `spawnEnemy` — all real throw paths) ran with no rollback. Only the `!firstEnemyTemplate` return-false branch released. A thrown start left the global slot occupied forever — same soft-lock family Mission B removed.
- **Fix:** `start` is now a transaction — `acquire` → `try { pick; launch }` → any failure runs `rollbackFailedStart(lease)` which releases ONLY the acquired lease (identity-checked) and resets `activeStagePlayer`/`repeatStageContinuously`; thrown errors rethrow unwrapped.
- **Tests:** `GameManager.stageLease.test.ts` — launch-chain throw (path-runtime resolver seam) → lease freed → retry starts; enemy-pick throw (empty authored pool) → lease freed. Both were red pre-fix (lease leaked).

### EXT-C2 (MEDIUM): refused `startStage` re-seeded the running battle's RNG
- **Evidence:** `mintCycleRng()` created AND installed via `combatSystem.setRandomSource()` before `stageWaves.start()` could refuse (locked stage, occupied slot, pick failure) — a rejected request mutated the live battle's random stream, breaking the C3 one-RNG-per-cycle contract.
- **Fix:** mint/install split — `mintCycleRng()` returns a candidate; `commitCycleRng` installs. `startStage` carries the candidate in `pendingCycleRng`; the wave pick consumes it; `beginBattleCycle` is the commit point (`commitCycleRng(pendingCycleRng ?? mintCycleRng())`). A refused start mints but never installs — the live stream is provably untouched.
- **Test:** refused occupied-slot start → `setRandomSource` call count unchanged, installed stream is still cycle A's, stage A lease intact. Red pre-fix (2 installs vs 1).

### EXT-C3 (MEDIUM): multi-instance lane skipped the actor-death check
- **Evidence:** the `scaledDamage` multi-instance loop (Kiem Tu `instances.count = kiemDaoCount` — a real production path) checked `!target.entity.alive` between instances but not `!actor.entity.alive`, unlike every sibling lane (composite picks, non-damaging, charge, extra-impact — all T3-22b guarded). A lethal Reflection on instance 1 let instances 2..N resolve from a dead caster.
- **Fix:** `if (!actor.entity.alive || !target.entity.alive) break` at the top of the instance loop — same guard, same lane.
- **Test:** `midImpactDeath.test.ts` — `instances.count = 3` + lethal reflect → `resolveActionHit` called exactly once; actor dead; one landed hit only. Red pre-fix (2 calls).

### EXT-C4 (MEDIUM/architectural): ambient slot vs exact lease ownership
- **Evidence:** `stopRepeat()` called `stageManager.stop()` unconditionally — any stale battle teardown could stomp a foreign lease (auto-farm's, or a re-acquired stage's). The repeat gate asked `get() !== null` ("someone holds the slot") instead of "I still hold my lease". `getProgress` reported a foreign lease's stageId as ours.
- **Fix:** `StageManager` is now a capability API — `acquire()` returns the lease token, `release(lease)` frees the slot only for the exact object it still holds (stale/foreign tokens are no-ops). `start`/`stop`/`restartCycle` removed (`restartCycle` had zero callers — dead ambient-mutation path). `StageWaveSystem` tracks `stageLease`; `stopRepeat` releases only its own; new `holdsActiveStageLease()` backs the repeat gate; `getProgress` reports only while the wave lease is live. `GameManagerAutoFarmOps` migrated — `farmLease` IS the capability object.
- **Tests:** `StageManager.test.ts` (new, 5 tests — foreign/stale/null token refusal, second-owner isolation). `stageLease.test.ts` — stale `stopRepeat` via `abandonBattle` cannot release a foreign lease; victory+repeat does NOT restart when a foreign owner holds the slot. Both red pre-fix.

## Verification
- `npm run verify` on the final diff: type-check + build + full vitest suite.
- Scoped green: 12 files / 72 tests (lease transaction, RNG admission, farm suites, repeat/boss/battle-cycle regressions) + 8 files / 47 tests (composable/presentation lifecycle surface).
- P13/P14: not triggered — domain-layer change; repeat/victory/launch lifecycle is exercised end-to-end via ManualClockSource integration tests (`repeatStage`, `battleCycle`, `stageLease`).

## Residual (documented, not blocking)
- A throw AFTER `beginBattleCycle` commits (post-admission, mid-cycle-build) leaves the previous battle's teardown already run — the lease is still correctly released and the error propagates; reconstructing the torn-down battle is out of scope (pre-existing half-cycle reality, not worsened).
