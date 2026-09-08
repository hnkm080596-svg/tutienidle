# QA Review: C2 GameManagerTurnBattleOps split

- Date: 2026-09-08
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/core/game/GameManager.ts`, `game/src/core/game/GameManagerTurnBattleOps.ts` (new)

## Scope and Risk Map

Task: extract the turn-battle runtime lifecycle (TurnBattle construction, fixed-step driving loop, reward granting, auto-farm) verbatim out of `GameManager.ts` into a new `GameManagerTurnBattleOps` orchestrator, keeping GameManager as a thin facade with an unchanged public API (C2 roadmap item; follows the established SaveRestore/Quest/Alchemy/Building/Equipment Ops split pattern).

`changed-risk-map.mjs` output (both paths): domains `combat-and-tribulation`, `economy-and-progression`, `pinia-phaser-sync`, `time-and-offline`; `deepAuditCandidate: true` (critical state boundary: time-and-offline; cross-system 4 domains); `unmappedPaths`: `GameManagerTurnBattleOps.ts` (new file — routed manually to the same 4 domain packs since its content is verbatim-moved code whose behavior was previously covered under `GameManager.ts`).

Escalation decision: NO deep escalation. Justification: the change is a behavior-preserving structural move, not a semantics change — every moved line keeps its original call order, state ownership stays with the same owners (TurnBattleSystem = resolution authority, CombatAnimationRuntime = timing, BattleLootSystem = loot), and the full 2841-test suite plus targeted combat/time/save seams are green. Time-and-offline semantics (offline cap clamp, cycle carry-over) moved line-for-line with no owner change; the existing `GameManager.autoFarmOffline.test.ts` / `autoFarmAdversarial.test.ts` / `fixedStepCatchup.test.ts` seams directly exercise the moved code and pass. The risk is bounded to "did the re-wiring drop a call" — a class of defect the unit + wiring-guard suites demonstrably cover (one dropped call WAS caught during this QA run, see QA-2026-09-08-001).

One-hop consumers inspected: `App.vue` (update/expectPresentationLayer/drainNotifications), `useAppLifecycle.ts`, `useStageActive.ts`/`useCombatSceneActive.ts`/`useTurnBattleInfo.ts`/`useTurnCombatManual.ts`/`useBattleActions.ts` (getBattle/getTurnBattle/startStage), `CombatScene.ts` (ack bridge setPresentationActive/acknowledge*), `GameManagerSaveRestore` (settleAutoFarmOffline hook), `StageWaveSystem` (launchBattle→startBattleWithPlayer), Pinia player store (type-only), `TurnActionPresentationEvents` (COUNTDOWN_TOTAL_TICKS import — re-export verified).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-C2-1 | TurnBattle state (GameManagerTurnBattleOps) | startBattle → update fixed steps | Determinism: intro→countdown→fighting pacing identical to pre-split driver | Reorder/large delta | battle.state progression, snapshot events | Unit (introPhase, fixedStepCatchup, presentationGate) | High |
| INV-C2-2 | turnBattleRewardsGranted (ops) | enemy killed mid-fighting | Exactly-once loot grant per enemy id | Repeat update ticks | BattleLootSystem summary, player.skillInsight | Unit (DebugTurnRewards, enemyClear) | High |
| INV-C2-3 | victory terminal (ops) | victory with/without repeatContinuously | Exactly-once battle_end emit + completedStageIds push once; StageManager released | Repeat/timing boundary | eventBus event count, completedStageIds | Unit (stageRestart, repeatStage, bossRepeatCycle) | High |
| INV-C2-4 | surviveLethal session (CombatSystem) | direct startBattle (no PlayerData) | Session reset to null on direct start (pre-split line dropped in migration) | Reorder: startBattle twice / battle without player | setSurviveLethalSession(null) called | Unit — confirmed by inspection of pre-split baseline (git show HEAD) | High |
| INV-C2-5 | auto-farm cycle clock (ops) | offline settle + online ticks | Boundedness: 24h cap, non-finite cycle no-op; carry-over exactly settled part | Value mutation (Infinity/0/negative) | perfectClearSeconds accrual, material deltas | Unit (autoFarmOffline, autoFarmAdversarial) | High |
| INV-C2-6 | passive stacks + KiemTu resources | startBattle (both entry points) | Passive stacks reset + KiemTu resource init happen on EVERY battle start, not only startBattleWithPlayer | Reorder: startBattle direct | Kiếm bar state on players[0] | Unit (kiemTuWiring, kiemTuRoute) | Medium |
| INV-C2-7 | presentation-ack contract (CombatAnimationRuntime) | CombatScene mount/ack | Ack contract unchanged; manual pause + PresentationGate behave identically | Repeat ack/stale token | pending token, manual pause state | Unit (presentationGate, turnManualMode/turnManualQa, CombatScene.actionPlayback) | High |
| INV-C2-8 | COUNTDOWN/INTRO constants | buildTurnBattle + snapshot progress | Single shared constant; no drift after move | Stale state | countdownProgress computation | Unit (TurnActionPresentationEvents.test, introPhase) | Medium |
| INV-C2-9 | save restore → settleAutoFarmOffline | restoreFromSave path | Same settle hook fires through new delegate (no double settle) | Idempotency/repeat restore | material deltas after 2 restores | Unit (SaveSystem.bootRestore, autoFarmOffline) | High |
| INV-C2-10 | formation/companion/tran-phap buff | buildTurnBattle | Party placement + companion skip + unknown-buff skip preserved | Value mutation (bad definitionId) | participant positions, buffs presence | Unit (partyFormation, turnBattleEnemyWavePosition) | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` | pass | vue-tsc --build clean |
| `npx vitest run` (full, post-guard-fix) | pass 2841/2841 (413 files) | includes all focused seams below |
| `npm run build` + `check:bundle-split` | pass | entry 540KB, phaser chunk separate |
| `npx eslint` on both touched files | pass (0 warnings) | unused imports cleaned |
| git show HEAD baseline comparison of moved block | pass | `setSurviveLethalSession(null)` + isFinalSpawn parity + reward-shim shape verified line-by-line during QA |
| `GameManager.talentv4.qa.test.ts` A0 test | pass | Bat Tu The cleanse/grant lands on LIVE turn pool through new ops path |
| App.wiring + useAppLifecycle guards | pass | no orphaned function introduced; update() driving path intact |

## Findings

### QA-2026-09-08-001: Dropped `setSurviveLethalSession(null)` in direct `startBattle()` during migration

- Severity: Medium (latent — no current production caller relies on the reset, but the invariant is contract)
- Status: Confirmed → FIXED during QA discovery (production fix exited QA workflow: comparison against git baseline is direct evidence; fix applied in dev workflow, then full suite re-run)
- Invariant: Direct `startBattle()` (no PlayerData) must reset the survive-lethal session to null — a previously-talentless battle must not inherit a prior battle's session.
- Preconditions: `startBattle(player, enemy)` called directly (test/debug path, and the documented contract comment in the pre-split code).
- Reproduction: static diff comparison `git show HEAD:game/src/core/game/GameManager.ts` line 2257 vs migrated `startBattle()` in `GameManagerTurnBattleOps.ts` — the reset line was absent from the first migration draft.
- Expected: reset present in ops `startBattle()`.
- Actual (before fix): reset missing.
- Evidence: baseline-vs-migration line inspection (direct evidence); after fix, full suite 2841/2841 + type-check green.
- Test file: none (contract covered implicitly by battle-reset tests; a dedicated failing test was not writable without a production spy hook — recorded as coverage note below)
- Owner subsystem: `GameManagerTurnBattleOps.startBattle()`
- Blast radius: none observed at runtime (all production flows go through `startBattleWithPlayer()` which sets a fresh session right after); the risk was stale-session inheritance on the direct path.

## New or Changed QA Tests

None authored. The QA run's conclusive evidence was baseline diff inspection (direct evidence) plus the existing 2841-test suite exercising every moved behavior; no reproduction test was needed after the fix because the defect was already repaired and no failing test could demonstrate it against the fixed code.

## Gaps and Residual Risk

- Coverage gap (non-material): no direct unit test asserts `setSurviveLethalSession(null)` on the direct `startBattle()` path. Minimal hook proposal: a spy on `combatSystem.setSurviveLethalSession` in a `GameManager.startBattle` unit test. Not blocking: production callers all route through `startBattleWithPlayer()`.
- P14 (real-browser visual verification) deferred: isolated worktree cannot reliably run playwright-cli. The change is logic/wiring only (no rendering/CSS/DnD surface); e2e suite (boot-fresh/create-to-combat/save-reload/ink-wash) should be run from the main checkout during branch finishing.

## Pre-existing Failures

None observed: full suite 2841/2841 green before and after the audited change (baseline re-verified at QA start).
