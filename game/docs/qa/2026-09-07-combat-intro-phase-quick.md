# QA Review: combat intro phase (plan 2026-09-07 Task 4)

- Date: 2026-09-07
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: game/src/core/battle/turn/TurnBattleSystem.ts, game/src/core/battle/BattleTypes.ts, game/src/core/game/GameManager.ts, game/src/components/game/combat/CombatIntroOverlay.vue (new), game/src/components/game/combat/CombatSceneOverlay.vue, game/src/locales/vi.json, game/src/locales/en.json, game/src/core/game/GameManager.introPhase.test.ts (new)

## Scope and Risk Map

Changed systems: turn-based battle state machine (new 'intro' phase before
'countdown'), GameManager pacing loop (new intro branch), legacy BattleState
mirror, combat overlay UI (new curtain overlay), locales. Mapper routed
domains: combat-and-tribulation, economy-and-progression, pinia-phaser-sync,
time-and-offline, ui-input-lifecycle (deepAuditCandidate flagged on
time-and-offline + 5-domain breadth). Escalation decision: NOT escalated -
the change adds one wait phase that freezes all combat logic (verified by
new introPhase tests asserting zero gauge advance / zero turn elapsed), does
not touch clock ownership (GameClock/OfflineProgressSystem untouched), and
does not cross persistence boundaries (no save-shape change: introTurnsRemaining
is a runtime-only optional field on the in-memory TurnBattle; save snapshot
owners unchanged). Risk confidently bounded by code inspection + focused tests.
Exclusions: none (all dirty files are task-owned).

unmappedPaths (en.json, vi.json): locale JSON additions only - two i18n keys
under combat.overlay.intro, mirrored structure in both files, no logic. No
domain pack applies; risk nil.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-INTRO-1 | TurnBattle.state (TurnBattleSystem/GameManager) | startStage -> intro -> countdown after exactly INTRO_TOTAL_TICKS | Determinism: fixed tick count produces the exact state flip, not early/late | Timing boundary (N-1, N, N+1 ticks) | getTurnBattle().state + introTurnsRemaining | Unit (introPhase.test) | High: core new transition, fully observable |
| INV-INTRO-2 | TurnBattle participants (engine) | Ticks while state === 'intro' | Boundedness/freeze: gauges do not advance, no turn resolves during intro | Timing boundary (full intro drain) | actionGauge all 0, totalTurnsElapsed 0 at countdown entry | Unit (introPhase.test) | High: P17 no-combat-in-wait-phase contract |
| INV-INTRO-3 | Legacy Battle mirror + isBattleInProgress consumers | syncLegacyBattleState during intro | Synchronization: in-progress semantics preserved for UI gates (hide home UI, block tribulation, artifact guards) | Stale state (UI reading getBattle() during intro) | artifact/upgrade guards reject; isBattleInProgress true | Unit (existing setArtifactPath/artifactGradeUpgrade tests, updated) | Medium: UI gating consistency |
| INV-INTRO-4 | StageManager single slot | startStage during active intro | Pre-existing single-active-stage contract preserved (rejection, no corrupt slot) | Repeat (double start) | startStage returns false, original battle untouched, introTurnsRemaining intact | Unit (introPhase.qa.test) | High: reuse of existing wait-phase semantics |
| INV-INTRO-5 | abandonBattle during intro | abandon mid-intro | Exactly-once terminal: defeat terminal + stage slot released + refight works | Interruption (abandon at 3/20 ticks) | state defeat, getStageProgress null, refight true | Unit (introPhase.qa.test + repeatStage.test) | High: user exit path |
| INV-INTRO-6 | Fixed-step catch-up loop | update(2.0) lumped delta spans intro boundary | Determinism/bounded catch-up: lumped delta slices into fixed steps, intro->countdown exactly once | Degraded env (large delta), timing boundary | state countdown, countdownTurnsRemaining 30 (not 29/31) after 2s lump | Unit (introPhase.qa.test) | Medium: fixed-step catch-up contract extends to intro |
| INV-INTRO-7 | Action Playback 5-phase machine | presentationActive on across intro+countdown | Lifecycle: pending-state machine unaffected by preceding intro (no stale pending into fighting) | Reorder (intro ticks before presentation ops) | existing 18 actionPlayback tests green; pendingReady only from fighting ticks | Unit (existing suite) | Medium: Task 1-adjacent machinery |
| INV-INTRO-8 | resolveNextStep during intro | Any caller resolves a step while intro | Freeze: intro no-op returned, no actor resolution | Reorder (headless caller ignoring state) | resolveNextStep returns { state: 'intro', ... } no-op | Unit (code inspection + type-level; engine never routes there in GameManager loop) | Low: defensive branch, unreachable from main loop |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| npx vitest run (full suite, after final code state) | 2836/2836 passed, 433 files | Covers all above invariants incl. 3 new introPhase tests |
| npx vitest run GameManager.introPhase.qa.test.ts | 4/4 passed | Adversarial probes (INV-4/5/6) |
| npm run type-check | 0 errors | vue-tsc --build |
| Dev server HTTP check (curl localhost:5176) | 200 | Server served valid HTML; live-browser check not possible (see Gaps) |
| P14 playwright-cli live browser | Not verified | playwright-cli hangs/fails to launch in this sandboxed worktree; same limitation independently hit in the sibling combat-runtime-separation worktree. Per user instruction, replaced by HTTP smoke + suite evidence. |

## Findings

### QA-2026-09-07-001: startStage during intro rejected by pre-existing single-slot StageManager
- Severity: Low
- Status: Confirmed (as pre-existing behavior, NOT a Task 4 regression) - resolved by aligning the probe to the standing contract
- Invariant: INV-INTRO-4
- Preconditions: an active stage battle in 'intro'
- Reproduction: startStage while intro active returns false
- Expected (standing contract): rejection - identical to countdown-phase behavior before Task 4 (StageManager.start L23-26 via StageWaveSystem.start L60-62; both files untouched by Task 4 diff)
- Actual: matches standing contract
- Evidence: dedicated probe test passed confirming rejection + original battle continuity; verified Task 4 diff does not touch StageManager/StageWaveSystem (git numstat)
- Test file: game/src/core/game/GameManager.introPhase.qa.test.ts (repeat probe)
- Owner subsystem: core/game (StageWaveSystem/StageManager, pre-existing)
- Blast radius: none - behavior identical pre/post Task 4

No other findings. The initial hypothesis that intro changed restart semantics
was DISPROVEN: the rejection predates Task 4 (probe against unchanged guard
chain) and is identical during the old countdown phase.

## New or Changed QA Tests

- game/src/core/game/GameManager.introPhase.qa.test.ts (new, 4 tests): timing
  boundary at N/N+1 ticks, abandon-mid-intro interruption, double-start
  repeat against the standing single-slot contract, lumped-delta catch-up
  across the intro boundary. Each proves its ledger invariant via observable
  TurnBattle state.
- game/src/core/game/GameManager.introPhase.test.ts (new, 3 tests, dev-authored
  then QA-reviewed): exact transition tick, freeze during intro, full-drain
  boundary. Kept as regression tests.

## Gaps and Residual Risk

- P14 live-browser visual confirmation of the curtain animation is Not
  verified (environment limitation, not a code risk). The curtain is pure
  CSS animation (no logic) driven by the same stateVersion computed pattern
  as the verified CombatCountdownOverlay; logic-side visibility state
  (getBattle().state === 'intro') is fully unit-verified. Residual visual
  risk: low, bounded to CSS rendering only.
- Curtain reopen animation: plan's Step 9 snippet only specifies the close
  animation; overlay unmounts when state flips to countdown (v-if), so no
  explicit reopen animation exists. Flagged to plan owner as a design note,
  not a defect.

## Pre-existing Failures

- None observed: baseline before Task 4 was 2833/2833 green; after Task 4,
  2836/2836 green (3 net-new tests, all existing tests adapted only for the
  intended new intro-first sequence).
