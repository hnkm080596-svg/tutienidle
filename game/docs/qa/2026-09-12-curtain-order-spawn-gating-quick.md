# QA Review: curtain z-order contract + pre-spawn combatant gating

- Date: 2026-09-12
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths:
  - `game/src/core/presentation/OverlayLayers.ts` (new scale entries)
  - `game/src/components/game/PresentationTransitionOverlay.vue`
  - `game/src/components/game/combat/CombatPauseOverlay.vue`
  - `game/src/components/menu/MainMenu.vue`, `game/src/App.vue`
  - `game/src/components/common/{ActionFeedbackLog,ToastContainer,OfflineSummaryModal,TutorialOverlay,WorldAnnouncementOverlay,ErrorScreen,SaveIncompatibleScreen}.vue`
  - `game/src/core/battle/turn/TurnActionPresentationEvents.ts` (`phase` field)
  - `game/src/game/scenes/CombatScene.ts` (`reconcileTurnCountdownSpawn` intro branch + union flush)
  - `game/tests/architecture/overlayLayers.test.ts` (new guard)
  - `game/src/game/scenes/CombatScene.turnCountdownSpawn.test.ts` (updated + 2 new tests)
  - `game/src/core/game/GameManager.introPhase.test.ts` (phase assertion)

## Scope and Risk Map

changed-risk-map.mjs routes the diff to `combat-and-tribulation`,
`pinia-phaser-sync`, `ui-input-lifecycle` and flags `deepAuditCandidate:
true` on the "3 domains" rule.

**Escalation decision (not escalated, reasoned):** the domain span is wide
in file count but each change is presentation-only. Overlay edits swap a
hardcoded z-index for a named scale entry — no state ownership, no
lifecycle, no gameplay. The CombatScene change gates sprite *visibility*
on the engine-owned `phase`/`countdownProgress` contract; it awards no
state, resolves no combat, and the enemy wave path through
`pendingEnemySpawns` is untouched. Engine authority (A7) is preserved —
the scene reads `battle.state` via the snapshot rather than inferring it.
No save/cloud, time/offline, or economy/progression mutation is involved.
Risk is bounded by the new unit tests plus the architecture guard.

Unmapped paths, manually routed:

- `core/presentation/OverlayLayers.ts` → ui-input-lifecycle (z-order scale).
- `tests/architecture/overlayLayers.test.ts` → guard test, no production risk.
- `core/game/GameManager.introPhase.test.ts` → test-only assertion addition.

Exclusions: none — every dirty path is task-owned.

Learned-defect ledger: no spawn-telegraph/z-order entries exist; the
nearest pattern is QA-2026-09-08-RR5 (identity-gated transitions) — this
fix follows the same lesson: `countdownProgress === undefined` carried two
meanings until `phase` gave the transition its identity.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-OVL-1 | App overlay order / OVERLAY_LAYERS | Any panel/modal/toast mounts while curtain closed | Layering: curtain strictly topmost | Stale state (old literal) | No `z-index >= combatPause` literal in src; curtain binds `OVERLAY_LAYERS.curtain` | Architecture guard | High — the reported defect |
| INV-OVL-2 | Reachability of ErrorScreen/SaveIncompatible | Error raised while curtain closed | Recoverability | Timing boundary | Curtain closed window is bounded (~transition duration); curtain has own error shell for transition failures | Code inspection | Medium — bounded by design, user-required |
| INV-OVL-3 | Inline `:style` vs scoped CSS z-index | Migration on 10 components | Determinism | — | Inline style always beats class CSS; type-check + build | type-check/build | Low |
| INV-SPN-1 | `turnCountdownPendingIds` / CombatScene | 'intro' snapshot arrives with players+enemies | Lifecycle: combatant hidden until materialize | Reorder (intro before countdown) | Pending marked, no telegraph handle, sprite hidden at 'create' | Unit (new test) | High — the reported defect |
| INV-SPN-2 | Flush reveal / CombatScene | countdown ends; id pending without handle | Lifecycle: pending id still materializes | Degraded environment (projection missing) | Union flush reveals pending ids AND snapshot ids | Unit (new test) | High — covers rebind-at-fighting hole |
| INV-SPN-3 | Enemy wave path / TurnBattleSystem+scene | pendingEnemySpawns telegraph during 'fighting' | Lifecycle: enemy appears only at materialize | Regression | Unchanged — pending enemies never enter `turnCountdownPendingIds` via wave path; event.enemies only holds materialized entities | Existing suite (TurnBattleSystem, actionPlayback) | High — verified unchanged |
| INV-SPN-4 | Scene state across refight/restart | battle_start / clearSceneState / restartTurnBattleCycle | Lifecycle | Repeat | onBattleStart + clearSceneState already clear pending/handles/telegraph; union flush self-heals a hidden player on mid-fighting rebind | Existing tests + code inspection | Medium |
| INV-SPN-5 | Snapshot consumers | `phase` added to contract | Contract compat | — | Builder is the single source (`buildTurnBattleEntitySnapshot`); `rebindSession` consumes the same shape | type-check (required field) | Medium |
| INV-SPN-6 | Dead-entity reveal | `alive:false` id in snapshot at flush | Correctness | Value mutation | `state.alive` guard on the snapshot-id reveal branch | Code inspection | Low — cannot die during intro/countdown anyway |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` (vue-tsc --build) | PASS, exit 0 | Whole project incl. tests — `phase` required field compiles everywhere |
| `npx vitest run` (full suite) | PASS — 506 files / 3376 tests | Includes new guard + spawn tests |
| `npm run build` | PASS | SFC `:style` bindings compile |
| Focused: turnCountdownSpawn + overlayLayers + events + introPhase + reconciliation + actionPlayback + presentationGate | PASS — 67 tests | See test list below |
| Source scan: `z-index >= 900` literals under src/ | Zero remain | `git grep` + guard test |

## Findings

None confirmed. One bounded residual noted under Gaps.

## New or Changed QA Tests

- `tests/architecture/overlayLayers.test.ts` — curtain is the strict max
  of OVERLAY_LAYERS; the curtain component binds it; no production file
  hardcodes a z-index in the app-level range; all 11 known app-level
  overlays bind their named tier.
- `CombatScene.turnCountdownSpawn.test.ts` — new describe "pre-spawn
  gating": intro snapshot marks party pending WITHOUT spawning telegraph
  handles; intro-marked ids still materialize at flush; snapshot ids
  (mid-fighting rebind) reveal at flush.
- `GameManager.introPhase.test.ts` — asserts `snapshot.entities.phase ===
  'intro'` alongside the existing `countdownProgress` undefined check.

## Gaps and Residual Risk

- **P14 deferred (worktree):** real-browser confirmation of (a) a closed
  curtain covering OfflineSummaryModal/toasts and (b) no pre-spawn player
  flash is deferred per the isolated-worktree exception — verify from an
  authorized main checkout during branch finishing.
- **Suspected-low:** an app error (ErrorScreen/saveGate) raised while the
  curtain is *closed* stays hidden for the remainder of that transition.
  Bounded (closed windows are ~0.4–0.8s and the curtain carries its own
  error shell); this ordering is the user's explicit requirement.
- **Coverage gap (pre-existing):** sprite *label/shadow* visibility is not
  part of the hide contract — `setVisible` gates `sprite.rect` only; the
  name label was already visible over the countdown telegraph before this
  change. Unchanged by this fix; flagged, not in scope.

## Pre-existing Failures

None observed — the full suite is green.
