# QA Review: combat-contract (feat/combat-contract, 21ac93cf..0f5c5c47)

- Date: 2026-09-17
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/core/battle/contracts/**`, `game/src/core/battle/runtime/**`, `game/src/core/battle/turn/TurnBattleSystem.ts`, `game/src/core/battle/turn/*.test.ts` (6 updated), `game/src/core/combat/CombatSystem.ts`, `game/src/core/combat/EntityVitalsSystem.ts`, `game/src/core/game/GameManager.ts`, `game/src/core/game/GameManagerTurnBattleOps.ts`, `game/src/core/game/GameManager.battleCycle.test.ts`, `game/tests/architecture/cultivationPathIsolation.test.ts`, docs under `game/docs/{architecture,systems,qa}` + `roadmap.md`.

## Scope and Risk Map

Mapper output: domains `combat-and-tribulation`, `economy-and-progression`, `pinia-phaser-sync`, `time-and-offline`; `deepAuditCandidate: true` ("critical state boundary: time-and-offline", "cross-system change: 4 domains"); unmapped: the 4 docs files, `GameManagerTurnBattleOps.ts`, `GameManager.battleCycle.test.ts`, `cultivationPathIsolation.test.ts`.

**Escalation decision — not escalating, risk confidently bounded by inspection:**

- `GameManager.ts` diff = `setBattleRngFactory` signature `(() => () => number)` → `(() => CombatRng)` + doc comment. No save/offline/time logic; the `time-and-offline` hit is a path-keyword false positive.
- `economy-and-progression` touch = `EntityResourceAdapter` (dormant) delegating `the`-pool gains to `TheEconomy.grantThe` (single clamp authority — same as `consumeResourceFor`) + an architecture-allowlist line.
- `pinia-phaser-sync`: zero Vue/Pinia/Phaser scene or bridge code changed.
- The new scheduler spine is **dormant** — constructed per battle but no production path enqueues or runs it (grep: zero non-test `enqueueAuthored`/`run()`/`createLifecycleSink`/`registerImmediateHandler` calls). The only live-behavior change is the RNG reroute, which has dedicated determinism evidence.
- Unmapped paths routed manually: `GameManagerTurnBattleOps.ts` → combat domain (composition-root wiring, reviewed line-by-line at M4); `GameManager.battleCycle.test.ts` → combat (test-only import swap); `cultivationPathIsolation.test.ts` → economy/progression (allowlist addition only); docs → no runtime risk.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-CC-1 | Per-cycle RNG stream / `GameManagerTurnBattleOps.mintCycleRng` | All 16 roll sites rerouted through one `CombatRng` | Determinism — same seed → same outcome; consumption count+order preserved | Reorder + repeat | Two seeded battles produce deep-equal per-tick logs; different seed diverges | Vitest integration (`TurnBattleSystem.rngContract.test.ts`) | High — the only live-behavior change |
| INV-CC-2 | Roll domain / `CombatRng` impls | `rollChance(0/1/NaN)`; scripted exhaustion | Boundedness + determinism — exactly one consumption, no silent fallback | Value mutation | `roll()<chance` single consumption at all endpoints; exhaustion throws (structural fault) | Unit (`rng.test.ts`) + code inspection | Medium |
| INV-CC-3 | Live battle path | Any remaining `Math.random`/raw-closure bypass | Determinism | Stale state | `Math.random` stack-spy test shows zero combat-path stacks; grep audit of RNG graph | Vitest (`battleCycle.test.ts` session-RNG) + grep | High |
| INV-CC-4 | Scheduler dormancy | Production paths must not dispatch through scheduler | Lifecycle | Repeat/reorder | Zero production `enqueueAuthored`/`run()`/`createLifecycleSink`/`registerImmediateHandler` | Grep (verified at M5 review) | High — dormancy is the safety claim |
| INV-CC-5 | `CombatSystem.applyDotDamage` callers | Signature now returns applied HP | Regression | Repeat | Existing caller `BuffSystem.ts:356` ignores additive return; type-check green | Type-check + suite | Medium |
| INV-CC-6 | Stale scheduler across `abandonBattle` | Retained instance read after teardown | Lifecycle | Interruption | Field read only at engine construction; re-minted per cycle | Code inspection (M4 review) | Low |
| INV-CC-7 | Gauge adapter liveness | Stale `participant.alive` cache passes gate mid-resolution | Stale state | Stale state | `invalid_target_state` skip when entity dead but cache alive | Unit (`ActionGaugeAdapter.test.ts` regression — added at M4 fix) | Medium (dormant path) |
| INV-CC-8 | Adapter field fidelity | `hitCount`/`canCrit`/`canMiss`/`tags` not carried | Cross-system chain | Cross-system chain | Dormant path; recorded deferred to skill megaplan (learned-defect RR8 pattern noted) | Coverage gap — dormant, no live oracle needed | Low while dormant |
| INV-CC-9 | `resolveSourceBuffs` wiring | `legacy_dot` ops preserve authored `dotRecovery` | Conservation | Stale state | Resolver character-identical to engine's (`players→enemies` by participant id, own-pool `getAll`) | Code inspection (M4 review) | Medium (dormant path) |
| INV-CC-10 | `setBattleRngFactory` callers | Old `() => () => number` callers break | Contract | Repeat | Only 2 test callers + delegation chain; type-check green | Type-check | Low |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run verify` (= type-check + build + `npx vitest run`) from `game/` | PASS — 633 files / 5324 tests (+4 expected-fail), build clean | Full run at HEAD `0f5c5c47` |
| `npx vitest run tests/architecture` | PASS — 428 tests | Run at M4 (`c32ccb3e`); architecture diff since then is docs+test-only |
| Playwright `tests/e2e/create-to-combat.spec.ts` | PASS | Real-browser run at M4 in this worktree |
| `TurnBattleSystem.rngContract.test.ts` | Green in suite | Two SeededCombatRng(42) stage battles → deep-equal logs; divergence guard |
| `GameManager.battleCycle.test.ts` session-RNG spec | Green in suite | `Math.random` stack-spy — zero combat-path stacks |
| `ScriptedCombatRng.roll()` exhaustion | Throws structural-fault error (read at HEAD) | No silent `Math.random` fallback — matches contract §50; test-only impl trusts script domain |
| `applyDotDamage` production callers | `BuffSystem.ts:356` ignores additive return value | `applyReactionDamage`/`grantWard` consumed only by dormant adapters |

## Findings

None. All material hypotheses resolved by named green tests, grep evidence, or the M4 roll-site audit. The one defect-class found during implementation (INV-CC-7 stale-liveness) was fixed at `1eba985c` with a regression test before this QA pass — recorded here as resolved, not as an open finding.

## New or Changed QA Tests

None authored by this QA pass — every high-risk hypothesis already has a conclusive named test or grep-level oracle from the implementation reviews.

## Gaps and Residual Risk

- **INV-CC-8 (coverage gap, non-blocking):** standard-hit field fidelity (`hitCount`/`canCrit`/`canMiss`/`tags`) is silently dropped by the damage adapter — dormant path, deferred to the skill megaplan which owns standard-hit fidelity. Recorded in SDD ledger.
- **INV-CC-6 (residual, Nit):** `combatScheduler` field retains a stale instance across `abandonBattle` — read only at engine construction which re-mints first; harmless while dormant.
- **`rngContract` coverage boundary (Low):** the e2e determinism test doesn't consume the engine's `this.rng` sites (no composite/ailment content fires in its fixture) — consumption-count parity there rests on the 1:1 site mapping + scripted unit tests (e.g. `anKit.test.ts:263` draw-order fails on double-consumption).
- **ScriptedCombatRng domain trust (Nit):** a malformed script could inject out-of-`[0,1]` values — test-only seam, documented intent, no production path.
- Pre-existing bare `Math.random` defaults at `NguKiemDaoProvider`/`HiddenBeastSystem`/`DropRoll` — production always overrides; out of scope.

## Pre-existing Failures

`ChiHienQuan.integration.test.ts` flaked once during M4's full-suite run (unmocked `Math.random` gacha path) — passed isolated and on rerun; pre-existing/environmental, unrelated to this change.
