# R5 — Combat Runtime & Presentation Boundary — QA Quick Report

Date: 2026-09-08
Worktree: E:/tutienidle/.agent-worktrees/r5-runtime-presentation
Branch: feat/r5-runtime-presentation
Mission: R5 (roadmap 0.6) based on Mission 0 findings AR-14 + AR-20 + relevant AR-24 + AR-29.
Spec: game/docs/superpowers/specs/2026-09-08-r5-combat-runtime-presentation-boundary-design.md
Plan: game/docs/superpowers/plans/2026-09-08-r5-combat-runtime-presentation-boundary.md

## P17 Contract Evidence

The maintained combat reference `docs/superpowers/specs/2026-09-07-turn-based-combat-reference.md` is absent (2026-09-08). The runtime/presentation boundary contract below was established from production consumers and tests before modifying behavior:

- **A7 Presentation Separation:** Presentation owns visual rendering, particle streams, lunge tweens, and animations. Gameplay systems own authoritative rules and progression. Body refinement auto-investment (`gameManager.investBodyRefinement`) runs directly in the domain tick when materials are available, decoupled from visual particle arrival or the 2,000ms headless timeout fallback.
- **A2 Gameplay Event Authority:** Committed action events (such as `'attack'`) are emitted by the gameplay authority (`TurnBattleSystem.applyActionImpact`) on every action commit. Both headless and presentation-driven modes emit `'attack'` identically, ensuring passive listeners receive events without depending on whether Phaser is rendering.
- **A3 Deterministic Token Protection:** All 3 presentation acknowledgment methods (`acknowledgeTurnReady`, `acknowledgeActionImpact`, `acknowledgeActionComplete`) validate the playback generation token. `CombatScene` captures the pending token at event entry and passes it into tweens and delayed calls. Stale or empty tokens are strictly rejected when presentation is active.
- **A6 Dependency Direction:** `TurnBattleConstants.ts` (`COUNTDOWN_TOTAL_TICKS`, `INTRO_TOTAL_TICKS`) and `CombatAnimationTypes.ts` (`CombatAnimationName`) live in core foundation modules below their callers, eliminating upward imports from `core/battle/` into `core/game/` or `game/support/`.
- **A3/A5 Encapsulation:** Scene helpers (`CombatCastBar`, `CombatPositionInterpolation`) own their private state maps, update lifecycles, and cleanup routines. `CombatScene` delegates to them via getters/setters, preserving test compatibility without exposing internal state.

## Changes Reviewed (16 files, +146 / −83 lines)

- Production:
  - `game/src/App.vue` (decouple body refinement from visual particles).
  - `game/src/core/battle/turn/TurnBattleConstants.ts` (new foundation constants).
  - `game/src/core/battle/CombatAnimationTypes.ts` (new animation type).
  - `game/src/core/battle/turn/TurnActionPresentationEvents.ts` (import from constants).
  - `game/src/core/game/GameManagerTurnBattleOps.ts` (import from constants).
  - `game/src/core/battle/turn/CombatAnimationRuntime.ts` (mandatory token validation, import from types).
  - `game/src/core/battle/turn/TurnBattleSystem.ts` (emit `attack` event on action commit).
  - `game/src/core/combat/CombatSystem.ts` (public readonly eventBus).
  - `game/src/game/scenes/CombatScene.ts` (capture tokens, delegate castBars and interpolations).
  - `game/src/game/scenes/combat/combat-cast-bar.ts` (encapsulated castBars map).
  - `game/src/game/scenes/combat/combat-position-interpolation.ts` (encapsulated interpolations map).
  - `game/src/game/support/CombatAnimationSet.ts` (import from types).
- Tests & Wiring:
  - `game/src/App.wiring.test.ts` (documented unwired lifecycle members per P13).
  - `game/src/core/battle/turn/CombatAnimationRuntime.test.ts` (new AR-20 token validation tests).
  - `game/src/core/battle/turn/TurnBattleSystem.attackEvent.qa.test.ts` (new AR-14 attack event test).
  - `game/src/game/scenes/combat/combat-helpers-encapsulation.qa.test.ts` (new AR-29 helper encapsulation test).

## Invariant Ledger (Quick Mode)

| ID | State / Owner | Action & Transition | Invariant | Attack Operator | Observable Oracle | Test Layer | Result |
|---|---|---|---|---|---|---|---|
| INV-R5-1 | Progression / `App.vue` | Body refinement materials available in inventory | Law A7: progression must not wait for visual arrival | Essence in bag, no arrival event emitted | `investBodyRefinement()` consumes material in tick | Unit / Integration | PASS |
| INV-R5-2 | Event authority / `TurnBattleSystem` | Headless battle step resolves action | Law A2: gameplay `attack` event emitted identically | Step resolution without presentation | EventBus emits `type: 'attack'` with sourceId, targetId, skillId | Integration | PASS |
| INV-R5-3 | Timing / `CombatAnimationRuntime` | Delayed/residual `acknowledgeTurnReady` fires with stale/empty token | Law A3: stale or empty token must be rejected when presentation active | `token: ''` or `token: 'wrong_token'` | Runtime remains in `ready` phase, does not advance to `cast` | Unit | PASS |
| INV-R5-4 | Timing / `CombatAnimationRuntime` | Delayed/residual `acknowledgeActionImpact` fires with stale/empty token | Law A3: stale or empty token must be rejected | `token: ''` or `token: 'wrong_token'` | Runtime remains in `cast` phase, does not advance to `standby` | Unit | PASS |
| INV-R5-5 | Dependency / `TurnBattleConstants` | Build and bundle inspection | Law A6: core/battle must not import from core/game | AST / compilation check | Zero import cycles detected | Static / Build | PASS |
| INV-R5-6 | Encapsulation / `CombatCastBar` | Create, show, and destroy cast bar | Law A3/A5: helper owns private state map | Helper manages cast bars | `castBars` map managed internally, `destroyCastBar` cleans up | Unit | PASS |
| INV-R5-7 | Encapsulation / `CombatPositionInterpolation` | Interpolation target set and cleared | Law A3/A5: helper owns private interpolations map | Helper manages interpolations | `interpolations` map managed internally, `clear()` purges | Unit | PASS |
| INV-R5-8 | Presentation / `CombatScene` | Presentation active, tokens captured at spawn | Law A3: presentation calls pass matching tokens | Full action playback cycle | Action advances through ready → cast → impact → standby → complete | Integration | PASS |

## Verification Evidence

- P3 full:
  - `npm.cmd run type-check`: **PASS (0 errors)**.
  - `npm.cmd run build`: **PASS (0 errors)**.
  - `npx.cmd vitest run`: **421 files / 2892 tests PASS (0 failures)**.
- P5 code review: PASS (pre-simplified with E3, clean boundaries, no findings ≥80).
- P13 runtime wiring: verified via `App.wiring.test.ts` (20/20 PASS) and `useAppLifecycle.test.ts` (11/11 PASS).
- P14: deferred to main checkout per isolated-worktree exception.

## Verdict

**PASS WITH EVIDENCE**
