# R5 — Combat Runtime & Presentation Boundary — Design Spec

Date: 2026-09-08
Missions: Roadmap Phase R5 (Architecture Repair Program), Mission 0 findings AR-14 + AR-20 + relevant AR-24 + AR-29.
Status: APPROVED-by-user-brainstorm (chat), pending spec review.

## 1. Finding / Evidence

### AR-14 (P1, confidence 100): Presentation events influence progression timing; gameplay events mixed with playback
1. **Body refinement gated on VFX arrival:** `BattleLootSystem.ts:383` awards essence materials and emits `reward_particle { kind: 'essence' }`. `CombatScene.ts:1605-1624` plays visual particle streams and emits `essence_arrived` when stream playback completes. `useAppLifecycle.ts:110-128` listens to `essence_arrived` and `App.vue:310` calls `investBodyRefinement()`. In headless/automated mode without visual playback, `useAppLifecycle.ts:302` waits for a 2,000 ms timeout fallback before investing.
   - **Violation of A7:** Presentation (particle stream animation) selects the timing and gating of authoritative character progression.
2. **`attack` gameplay event only fired in presentation mode:** `TurnActionPresentationEvents.ts:35` emits `attack` when Phaser starts its lunge tween; `PassiveSystem.ts:70/140` listens to `attack` to stack passives. In headless mode (`GameManager.ts:3518`), actions resolve without emitting `attack`, causing passive behavior to diverge between headless and presentation modes.

### AR-20 (P2, confidence 100): Ready and Impact ACKs bypass stale-token protection
- `CombatAnimationRuntime.ts:187/:215` checks `if (token !== undefined && token !== this.playbackToken) return;` — if `token` is `undefined`, it accepts the callback unconditionally!
- `CombatScene.ts`:
  - `onTurnReady` calls `this.gameManagerRef?.acknowledgeTurnReady()` with no token;
  - `onAttack` lunge tween calls `this.gameManagerRef?.acknowledgeActionImpact()` with no token;
  - Only `onActionImpact` (VFX completion) captured and passed a token.
- Delayed tweens or cross-battle residual callbacks fire without tokens and bypass the guard, risking state corruption across battles.

### AR-24 (P2, confidence 100): Upward dependencies and runtime import cycles
1. `TurnActionPresentationEvents.ts:6` (in `src/core/battle/turn/`) imports `COUNTDOWN_TOTAL_TICKS` from `../../game/GameManager`, creating an upward dependency from core battle to orchestrator.
2. `CombatAnimationRuntime.ts:6` imports `CombatAnimationName` from `../../../game/support/CombatAnimationSet`, an upward dependency from core engine into game support.

### AR-29 (P2, confidence 100): Extracted scene helpers mutate scene-owned maps
- `combat-cast-bar.ts`: accepts `CombatScene` and mutates `scene.castBars` directly at `:45` and `:75`.
- `combat-position-interpolation.ts`: mutates `scene.interpolations` directly at `:35`.
- Helpers violate encapsulation by treating `CombatScene` as an open state bag.

---

## 2. Invariants

1. **A7 (Presentation Is Not Authority):** Visual arrival, particle completion, and UI timeouts must never gate, delay, or originate authoritative resource grants or character progression. Body refinement auto-investment runs in domain logic independently of Phaser.
2. **A2 (One Rule, One Owner):** Committed gameplay events (such as `attack`) are emitted by the gameplay authority (`TurnBattleSystem`) on every committed action, ensuring identical behavior in headless and presentation modes.
3. **A3 (Deterministic Token Guard):** Presentation acknowledgments (`acknowledgeTurnReady`, `acknowledgeActionImpact`, `acknowledgeActionComplete`) must provide a valid, matching generation token. Missing, null, or mismatched tokens are rejected as stale.
4. **A6 (Dependencies Point Downward):** Neutral pacing constants (`COUNTDOWN_TOTAL_TICKS`, `INTRO_TOTAL_TICKS`) and animation types (`CombatAnimationName`) live in foundation/core contracts below their consumers. No upward imports from `core/battle/turn/` into `core/game/` or `game/support/`.
5. **A3/A5 (Encapsulation):** Rendering helpers (`CombatCastBar`, `CombatPositionInterpolation`) own their private state maps, update lifecycles, and cleanup routines.

---

## 3. Target Architecture & Component Changes

### 3.1. Progression Decoupled from VFX (AR-14)
- **Domain auto-investment:**
  - `GameManager.ts`: when `BattleLootSystem` awards essence materials (or in `GameManager.updateStageProgress()`), call `investBodyRefinement(player)` immediately in domain execution.
  - `App.vue`: remove the `lifecycle.consumeEssenceArrival()` and `lifecycle.isEssenceHeadlessTimedOut()` gating for `investBodyRefinement()`. Progression no longer waits for a 2,000ms timeout or visual stream.
  - `CombatScene.ts`: particle stream continues to render visually for player juice, but emitting `essence_arrived` is purely presentation-only (or retired).

### 3.2. Uniform `attack` Event Emission (AR-14)
- In `TurnBattleSystem.ts` (`applyActionImpact`):
  When an action resolves hits or casts, emit the gameplay `attack` event:
  ```typescript
  this.combat.eventBus.emit('attack', {
    type: 'attack',
    sourceId: actor.id,
    targetId: targetIds[0] ?? declared.affected[0]?.id ?? actor.id,
    skillId: declared.skillId,
  })
  ```
  This fires on every committed turn action regardless of headless or presentation mode.
- In `TurnActionPresentationEvents.ts`:
  `emitTurnCastStart` only emits a presentation signal (`turn_cast_start` or keeps visual cues for `CombatScene`), separating gameplay event emission from visual playback pacing.

### 3.3. Mandatory Tokens on All 3 ACKs (AR-20)
- In `CombatAnimationRuntime.ts`:
  All three acknowledgment methods require a mandatory string token:
  ```typescript
  acknowledgeTurnReady(token: string): void {
    if (!token || token !== this.playbackToken) return
    // ...
  }

  acknowledgeActionImpact(token: string): void {
    if (!token || token !== this.playbackToken) return
    // ...
  }

  acknowledgeActionComplete(token: string): void {
    if (!token || token !== this.playbackToken) return
    // ...
  }
  ```
- In `CombatScene.ts`:
  - `onTurnReady`: captures `const token = this.gameManagerRef.getPendingPlaybackToken()`, passes it to onComplete callback `this.gameManagerRef.acknowledgeTurnReady(token)`.
  - `onAttack`: captures `const token = this.gameManagerRef.getPendingPlaybackToken()`, passes it to delayedCall `this.gameManagerRef.acknowledgeActionImpact(token)`.
  - `onActionImpact`: captures token (already existing), passes to `this.gameManagerRef.acknowledgeActionComplete(token)`.
  - Update `gameManagerRef` type definition in `CombatScene.ts` to reflect the required token parameters.

### 3.4. Dependency Inversion (AR-24)
- Create `src/core/battle/turn/TurnBattleConstants.ts`:
  ```typescript
  export const COUNTDOWN_TOTAL_TICKS = 30
  export const INTRO_TOTAL_TICKS = 30
  ```
- Update `GameManagerTurnBattleOps.ts`, `GameManager.ts`, and `TurnActionPresentationEvents.ts` to import from `TurnBattleConstants.ts`.
- Create `src/core/battle/CombatAnimationTypes.ts`:
  ```typescript
  export type CombatAnimationName =
    | 'idle'
    | 'ready'
    | 'cast'
    | 'standby'
    | 'hit'
    | 'death'
    | 'basic_attack'
    | 'victory'
  ```
- Update `CombatAnimationRuntime.ts` and `game/support/CombatAnimationSet.ts` to import `CombatAnimationName` from `core/battle/CombatAnimationTypes.ts`.

### 3.5. Encapsulated Scene Helpers (AR-29)
- `game/src/game/scenes/combat/combat-cast-bar.ts`:
  - Owns `private readonly castBars = new Map<string, CastBarSprite>()`.
  - Exposes `onCastStart(event)`, `destroyCastBar(sourceId)`, `destroyAll()`, `update(sourceId, caster)`.
  - `CombatScene.ts` exposes getter `get castBars(): Map<string, CastBarSprite>` delegating to `this.castBar.getCastBars()` for backwards compatibility with any existing tests.
- `game/src/game/scenes/combat/combat-position-interpolation.ts`:
  - Owns `private readonly interpolations = new Map<string, PositionInterpolation>()`.
  - Exposes `setInterpolationTarget`, `snapInterpolationTarget`, `interpolate`, `clear()`.
  - `CombatScene.ts` exposes getter `get interpolations()` delegating to helper for backwards compatibility.

---

## 4. Files to Touch

1. `game/src/core/battle/turn/TurnBattleConstants.ts` (create — AR-24).
2. `game/src/core/battle/CombatAnimationTypes.ts` (create — AR-24).
3. `game/src/core/battle/turn/TurnActionPresentationEvents.ts` (import from constants — AR-24).
4. `game/src/core/game/GameManagerTurnBattleOps.ts` (import from constants — AR-24).
5. `game/src/core/game/GameManager.ts` (re-export constants, immediate body refinement — AR-14, AR-24).
6. `game/src/core/battle/turn/CombatAnimationRuntime.ts` (mandatory tokens, import from types — AR-20, AR-24).
7. `game/src/core/battle/turn/TurnBattleSystem.ts` (emit `attack` in `applyActionImpact` — AR-14).
8. `game/src/game/scenes/CombatScene.ts` (pass tokens to ready/impact, delegate castBars/interpolations — AR-20, AR-29).
9. `game/src/game/scenes/combat/combat-cast-bar.ts` (encapsulate map — AR-29).
10. `game/src/game/scenes/combat/combat-position-interpolation.ts` (encapsulate map — AR-29).
11. `game/src/game/support/CombatAnimationSet.ts` (import from types — AR-24).
12. `game/src/App.vue` & `game/src/composables/useAppLifecycle.ts` (clean up essence arrival gating — AR-14).
13. Tests:
    - `CombatAnimationRuntime.test.ts` (assert rejection of undefined/stale tokens on ready/impact/complete).
    - `TurnBattleSystem.test.ts` (assert `attack` emitted on action commit in headless mode).
    - `combat-cast-bar.ts` / `CombatScene.ts` tests (verify encapsulation).

---

## 5. Verification Strategy & TDD

- **TDD Step 1 (Tokens):** Test that `acknowledgeTurnReady` and `acknowledgeActionImpact` without token or with stale token are rejected.
- **TDD Step 2 (Headless Attack Event):** Test that resolving a turn in `TurnBattleSystem` headlessly emits `'attack'` on EventBus.
- **TDD Step 3 (Encapsulation):** Verify `CombatCastBar` and `CombatPositionInterpolation` own their private maps.
- **P3 Full Verification:** `type-check` + `build` + `npx vitest run`.
- **P4 Adversarial QA Quick Report:** Write QA report with invariant ledger.
- **P14 Live Browser Check:** Validate that animations, lunge, ready flourish, and VFX playback in `CombatScene` advance smoothly without freezing or token rejection in the browser.

---

## 6. Explicitly Out of Scope

- Splitting `CombatScene` due to line count alone (roadmap mandate §CombatScene rule).
- Adding new combat character art or VFX presets (Phase R6).
- Remote cloud save changes (Phase R10).

---

## 7. Completion Gate

- Progression investment no longer waits for visual particles or 2s timeout.
- `attack` event fires reliably in both headless and presentation modes.
- Stale token rejection strictly enforced on all 3 presentation ACKs.
- No upward imports from `core/battle/` into `core/game/` or `game/support/`.
- Scene helpers encapsulate their state maps.
- Full test suite green (type-check + build + vitest).
