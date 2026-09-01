# Pinia Phaser Sync

## Load When

Changes touch `src/stores/`, `src/components/game/`, `src/game/scenes/`, `src/composables/useGameState.ts`, `src/composables/useStageActive.ts`, `src/composables/useCombatSceneActive.ts`, `src/core/events/EventBus.ts`, or `src/core/game/GameManager.ts` flows that feed presentation.

## State Owners and Boundaries

`src/core/game/GameManager.ts` is a plain injected class, not Vue-reactive state. `src/composables/useGameState.ts` supplies `stateVersion` and `bumpState()` as its refresh boundary. `src/stores/ui.ts` owns flags such as combat-origin, dismissal, and tribulation-scene state. `src/core/events/EventBus.ts` owns handler registration/delivery mechanics, while each Phaser scene owns its particular handlers and teardown. `src/composables/useStageActive.ts` and `src/composables/useCombatSceneActive.ts` derive presentation visibility from both store flags and manager state.

## High-Risk Invariants

- A user action has one authoritative mutation path; views do not independently mutate a mirrored copy.
- A manager mutation visible to Vue bumps the designated state bridge in ordered propagation.
- A handler removed during scene/component shutdown receives no later delivery; recreation does not retain stale subscriptions.
- Registering the same handler twice for one event does not duplicate delivery.
- Recreated scenes, Pinia flags, and manager battle state agree on whether the combat/tribulation presentation is active.

## Attack Recipes

- Trigger a bag/equipment action through a Vue consumer, then inspect the rendered computed value before the next periodic tick; observe the required `bumpState()` refresh.
- Create, shutdown, and recreate `CombatScene`; emit a resize or battle event; observe one active response and no callback from a prior scene.
- Enter combat, reach victory/defeat, retain the result modal, then dismiss it; observe `useStageActive` and `useCombatSceneActive` honor dismissal semantics without exposing the home scene early.
- Emit the same event after registering a handler twice, then after `off`; observe one delivery before removal and none after removal.

## Cross-System Chains

- `GameManager` bag mutation → `bumpState()` → Vue computed panel → user-visible inventory.
- Battle event → `EventBus` → Phaser `CombatScene` presentation and Vue combat overlay → result dismissal Pinia flag.
- Tribulation director event → `EventBus` → `TribulationScene` → UI store scene-active flag → home-scene visibility.

## Existing Test Seams

`EventBus.test.ts` covers on/emit/off, Set deduplication, and clear. `stores/ui.test.ts` covers tribulation and panel flags. `useStageActive.resultLifecycle.test.ts` covers result visibility behavior. `CombatScene.lifecycle.test.ts` covers repeated create/shutdown and resize listener stability. `CombatScene.backgroundLifecycle.test.ts` and `TribulationScene.inkWashUi.test.ts` cover presentation lifecycle neighbors.

## Coverage Gaps to Look For

Look for an integration seam that asserts manager mutation, `stateVersion`, store flags, and scene visibility in one controlled flow. Check that tests can prove teardown when a route/component interrupts an active scene, rather than only testing normal shutdown. Ensure event ordering is observable when a result and dismissal occur in the same update turn.
