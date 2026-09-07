# QA Review: Phase A0 — Fix Stale Legacy `battleSystem` Reads

- Date: 2026-09-07
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `game/src/core/battle/turn/TurnBuffSystem.ts` (+ `getAll()`) + test
  - `game/src/core/combat/CombatSystem.ts` (`surviveEffects` type cutover)
  - `game/src/core/combat/CombatSystem.surviveLethal.test.ts` (fixtures
    migrated to turn types)
  - `game/src/core/game/GameManager.ts` (surviveEffects wiring +
    `getStageProgress()` composition)
  - `game/src/core/game/GameManager.talentv4.test.ts` (assertions updated)
  - `game/src/core/game/GameManager.talentv4.qa.test.ts` (+ A0 test)
  - `game/src/core/game/StageWaveSystem.ts` (`getProgress()` drops `alive`)
  - `game/src/core/game/GameManager.stageProgress.test.ts` (new)

## Scope and Risk Map

Risk map: 4 domains incl. time-and-offline (`deepAuditCandidate: true`),
`unmappedPaths: []`. Bounded by manual inspection:

- **time-and-offline**: no clock/timestamp surface touched; both fixes are
  read-repointing inside battle-scoped state.
- **economy-and-progression**: no reward/cost path touched; `alive`/`spawned`
  are HUD-only display values. Survive-lethal cleanse/grant is battle-scoped
  buff state (non-persisted, INV-4 precedent).
- **pinia-phaser-sync**: `CombatTopBar.vue` consumes `getStageProgress()`'s
  public shape — unchanged (`{spawned, total, alive}`), so no consumer
  change propagates. No Phaser surface touched.
- **combat-and-tribulation**: primary domain — in-depth below.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
|---|---|---|---|---|---|---|---|
| INV-A0-1 | `CombatSystem.killIfDead` survive effects | Lethal hit with guard uses left | Exactly-once: rescue fires once per battle; HP=1; debuffs cleansed; `tu_sinh_ngo` granted on the LIVE pool | Stale state (legacy dead pool) | `players[0].buffs` — debuff absent, `tu_sinh_ngo` present | Integration (A0 test in talentv4.qa + updated talentv4.test) | High (this IS the bug) |
| INV-A0-2 | Same, no surviveEffects | Lethal hit with no session effects | Atomicity: guard still rescues, no cleanse/grant (old wiring unchanged) | Missing collaborator | HP=1, alive, no throw | Unit (existing test, unchanged, passing) | Medium |
| INV-A0-3 | Same, guard exhausted | Second lethal same battle | Monotonicity: no rescue when uses exhausted; debuffs kept | Repeat lethal | alive=false, debuff kept | Unit (existing, migrated fixture) | High |
| INV-A0-4 | `getStageProgress().alive` | Real stage battle | Wiring: alive = living turn-based enemies, not legacy 0 | Stale state | alive 2 → kill one → 1 (real damage path) | Integration (new stageProgress test) | High (this IS the bug) |
| INV-A0-5 | `getStageProgress().spawned` | Real stage battle | Synchronization: spawned reflects turn wave.spawnedCount, not StageManager's bootstrap-seeded stale counter | Stale state | spawned 2 (not 1) after wave materializes | Integration (new test) | Medium (scope extension — see finding) |
| INV-A0-6 | `getStageProgress()` consumers | CombatTopBar reads | Compatibility: public shape unchanged `{spawned, total, alive}` | Shape mutation | type-check + existing repeatStage/introPhase tests pass | Unit + type-check | Medium |
| INV-A0-7 | `restartTurnBattleCycle` | Auto-repeat next cycle | Idempotency: cycle resets `wave.spawnedCount` to 0 → HUD spawned restarts correctly per cycle | Repeat (verified by code read, not a dedicated test) | cycle resets counter; existing bossRepeatCycle tests pass | Code inspection + existing tests | Low |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| Reproduction pre-fix (A0 test, talentv4.qa) | FAILED at `bong`-still-present assertion — cleanse wrote to dead pool | intended-failure evidence for Component 1 |
| Reproduction pre-fix (stageProgress test) | FAILED `alive: expected 0 to be 2` — legacy list empty | intended-failure evidence for Component 2 |
| Post-fix full suite (worktree) | **2879/2879 pass, 438 files** | both reproductions now pass |
| `npm run type-check` | 0 errors | after each task |
| `npm run build` | BUILD OK | final gate |
| `StageWaveSystem`/`GameManager` suites (68 files, 279 tests) | all pass | no consumer regression from shape change |

## Findings

### QA-2026-09-07-002 (scope extension, resolved in-session): `spawned` counter is ALSO stale

- Severity: Medium
- Status: Confirmed by reproduction (`spawned: expected 1 to be 2`) → fixed
  in the same task, disclosed here per P4.
- Invariant: Synchronization — INV-A0-5.
- Preconditions: real turn-based stage fight.
- Reproduction: start a 2-enemy single-wave stage; after full wave
  materialization read `getStageProgress().spawned`.
- Expected: 2 (all spawned). Actual (pre-fix): 1 — `StageManager.start()`
  seeds `spawnedCount: 1` for the legacy bootstrap enemy, and the turn-based
  wave flow (`battle.wave.spawnedCount`) never increments the StageManager
  counter.
- The spec's Component 2 stated "`spawned`/`total` … are correct — only
  `alive` is affected"; the audit missed that the bootstrap-spawn seed makes
  `spawned` permanently off-by-the-rest-of-the-wave in the turn flow. Fix:
  `GameManager.getStageProgress()` now also sources `spawned` from
  `turnBattle.wave.spawnedCount` (falls back to the legacy value only when
  no turn battle exists). Same bug class, same function under repair, no
  consumer shape change — treated as in-scope for this repair rather than a
  separate phase; flagged prominently here for review.
- Evidence: reproduction pre-fix + passing post-fix.
- Test file: `game/src/core/game/GameManager.stageProgress.test.ts`
- Owner subsystem: `GameManager.getStageProgress()` composition.
- Blast radius: HUD display only.

### Suspected (non-blocking)

1. `resolveBossSummons()` still reads the legacy battle for
   `pendingSummons` (confirmed still dead code path — out of scope per spec
   Non-Goals; will die with C1 anyway).
2. `CombatSystem.ts` still imports `BuffSystem`/`BuffPool`/`BuffRegistry` —
   legitimately: its `onKill` skill-context block constructs throwaway
   legacy pools for the legacy SkillEffectSystem context (verified live
   usage at `:602-603`). Not removable in this task; C1 will handle.

## New or Changed QA Tests

- `GameManager.stageProgress.test.ts` (new): real battle, real telegraph,
  real damage path — proves `alive` and `spawned` track the LIVE turn battle.
- `GameManager.talentv4.qa.test.ts` A0 test: real lethal hit through
  `applyDirectDamage` — proves cleanse+grant land on the live pool.
- `GameManager.talentv4.test.ts`: existing wiring test extended with the
  live-pool behavior assertions (no longer just indirect guard checks).
- `CombatSystem.surviveLethal.test.ts`: v4 fixtures migrated from legacy
  `BuffSystem`/`BuffPool`/`BuffRegistry` to `TurnBuffSystem`/`TurnBuffPool`/
  inline `TurnBuffRegistry` — same scenarios, live types.

## Gaps and Residual Risk

- None material. P14 (visual HUD counter) noted by the plan — but
  playwright-cli is unusable in this environment (hangs, 3+ confirmed
  occurrences); the live-behavior integration test through the real
  engine is the substitute evidence, and the visual check happens
  naturally in normal play.

## Pre-existing Failures

None — full suite green before and after on this branch.
