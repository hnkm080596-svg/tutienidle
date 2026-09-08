# R2 — Stat Provenance & Effective Combat Stats — QA Quick Report

Date: 2026-09-08
Worktree: E:/tutienidle/.agent-worktrees/r2-stat-provenance
Branch: feat/r2-stat-provenance
Mission: R2 (roadmap 0.6) based on Mission 0 findings AR-02 + AR-05.
Spec: game/docs/superpowers/specs/2026-09-08-r2-stat-provenance-design.md

## P17 contract evidence

The maintained combat reference
`docs/superpowers/specs/2026-09-07-turn-based-combat-reference.md` is
absent (2026-09-08). The stat-semantics contract below was established
from production consumers and tests before changing behavior:

- `StatCalculator.calculateStats` (2-pass with attribute derivation) is
  the only attribute-derivation owner. It runs exactly once per entity
  construction: player via `stores/player.ts finalStats` →
  `useBattleActions.startBattle` → `GameManager.startStage` →
  `playerToCombatEntity` (stores result as BOTH `baseStats` and `stats`);
  enemy via `defineEnemy` → `normalizeEnemyStats` (all 5 attributes
  hardcoded 0) → `enemyToCombatEntity` (same baseStats/stats shape).
- `CombatEntity.baseStats` therefore holds the RESOLVED base, not raw
  authored input. The old `?? entity.stats` fallback at the recompute
  call site hid this contract.
- New `calculateEffectiveStats(resolvedBase, tempModifiers)` =
  1-pass fold without attribute derivation; `TurnStatsRecompute`
  migrates to it.
- Intended behavior (disclosed in spec §9): in-battle attribute-derived
  stats drop from double-applied to single (audit probe 10→70→130
  becomes 10→70→70+buffs). This restores authored intent; no rebalance
  was performed (roadmap Must-NOT respected).
- `participant.speed` is a synced read-only cache of
  `entity.stats.speed`; engine syncs it at recompute + both pacing
  loops (tickPacing, peekNextActor). Gauge state stays queue-owned.

## Changes reviewed (task-owned diff, 9 files)

Production: StatCalculator.ts, TurnStatsRecompute.ts, TurnBattleSystem.ts,
TurnBattleAdapter.ts. Tests: StatCalculator.turnConversion.test.ts,
TurnStatsRecompute.test.ts, TurnBattleSystem.effectiveSpeed.test.ts (new),
slice3qa/slice4qa fixture corrections. Exclusions: none (all task-owned).

## TDD evidence

- RED (primitive): `calculateEffectiveStats is not a function` →
  GREEN after implementation (2 tests).
- RED (engine AR-02): recompute produced attack 130 no-buff / 260 with
  2×+50% buff against expected 70/140 → GREEN after migration.
- RED (engine AR-05): `participant.speed` stayed 100 after +100% buff →
  GREEN after sync (rate check: player gauge rate = 2× enemy rate).

## Invariant ledger (quick mode)

| ID | State/owner | Action/transition | Invariant | Attack operator | Oracle | Result |
|---|---|---|---|---|---|---|
| INV-R2-1 | Effective stats / TurnStatsRecompute | Turn-start recompute with buff pool | Conservation: attribute derivation exactly once | Real chain fixture (resolved 70 + buff) | effective.attack 140 for 2×50% buff on 70 | PASS (TurnStatsRecompute.test.ts) |
| INV-R2-2 | Effective stats / TurnStatsRecompute | No buffs | Idempotency: recompute returns resolved base unchanged | repeat calls, empty pool | deep-equal resolved | PASS |
| INV-R2-3 | Speed cache / TurnBattleSystem | Buff applied → next pacing | Synchronization: cache equals owner | +100% speed buff pre-applied | player.speed 200 after resolveNextStep | PASS (effectiveSpeed.test.ts) |
| INV-R2-4 | Gauge / ActionGauge via engine | Buffed player pacing | Monotonicity: gauge advances at effective rate | rate probe clone | player rate = 2× enemy rate | PASS |
| INV-R2-5 | CC contract / slice3qa | Stun duration-2 blocks exactly 2 turns | Lifecycle: CC expiry timing unchanged | fixture with speeds on entity.stats | step1/2 blocked, step3 acts | PASS after fixture fix |
| INV-R2-6 | Resource tick / slice4qa | Fast enemy acts first, slow player pool not ticked | Ordering: resource ownership per actor | speeds on entity.stats (1 vs 100) | mana_pool stays 10 | PASS after fixture fix |
| INV-R2-7 | Rewards / BattleLootSystem consumers | Battle completion after migrated stats | Exactly-once reward (R1 inheritance) | full game-suite run | 69 files / 284 tests pass | PASS |
| INV-R2-8 | Tribulation stats path | applyPersistentBuff caller-supplied finalStats | Synchronization: tribulation keeps resolved-base contract | code inspection (unchanged call shape) | type-check + existing suites | PASS (code-level, no behavior change) |

## Focused checks run

- `src/core/game` full: 69 files / 284 tests PASS (adapter + battle-ops
  + reward consumers on the migrated contract).
- Full suite: 414 files / 2851 tests PASS (P3 full: type-check + build
  + vitest, stop-on-failure respected; one intermediate failure wave —
  2 stale-contract fixtures — was diagnosed and fixed before the final
  green run).

## Fixture correction note (not a production defect)

slice3qa INV-S3-1 and slice4qa INV-S4-4 set participant speed via the
`makeParticipant(id, entity, speed, priority)` helper while
`entity.stats.speed` stayed 100 — a state unreachable in production
(the adapter copies entity.stats.speed). Under the R2 contract the
engine syncs cache←owner, so the fixtures were updated to set speed on
`entity.stats` (production shape), preserving each test's original
2:1 / 1:100 rate intent and expectations. This is a test-side contract
alignment, not a weakening of a guard.

## Escalation assessment

Mapper returned all-unmapped (script's static domain map does not list
turn-battle paths); manual routing performed to combat-and-tribulation +
pinia store (player.finalStats unchanged). No save/cloud, no clock/
offline, no Vue/Pinia/Phaser lifecycle ownership change: effective stats
live and die inside the battle session; store contract unchanged.
deepAuditCandidate false; risk confidently bounded — no escalation.

## Suspected / coverage gaps (not confirmed defects)

- Order preview (`TurnOrderPreview.peekUpcomingActors`) clones
  participants (including the synced speed), so preview pacing now
  matches effective speed by construction; no dedicated preview-rate
  test was added (existing preview tests assert identity/order, all
  green). Classified as a minor coverage gap, low impact.
- Boss enrage speed content (`data/buff/buffs.ts` +20%) now actually
  reaches gauge pacing (previously stale) — an intentional behavior
  restoration per AR-05; balance numbers remain the A2 placeholder
  values pending the Phase D1 playtest (pre-existing roadmap note).

## Verdict

**PASS WITH EVIDENCE**
