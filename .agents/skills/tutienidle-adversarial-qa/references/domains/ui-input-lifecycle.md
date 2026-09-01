# UI Input Lifecycle

## Load When

Changes touch a `.vue` file under `src/`, `src/router/`, `src/directives/`, UI composables such as `useTooltip`, `usePanelPagination`, `useBagPagination`, or `uiScale`, Phaser scenes, input controls, overlays, result panels, or Playwright visual/user-flow coverage. Require `ui-ux-pro-max` for UI/UX decisions.

## State Owners and Boundaries

Vue components under `src/components/` own their local mounted lifecycle and render input state. Pinia stores under `src/stores/` own shared UI flags. Domain objects remain behind `src/core/game/GameManager.ts` and the `src/composables/useGameState.ts` `stateVersion` bridge. Phaser scenes in `src/game/scenes/` own their registered `EventBus`, Phaser scale, tween, and shutdown lifecycle resources. `CombatScene.ts` and `TribulationScene.ts` demonstrate explicit handler references and shutdown cleanup; do not infer that an overlay owns combat state.

## High-Risk Invariants

- Repeated pointer, keyboard, or synthetic activation invokes a domain action at most once while the action is disabled or loading.
- Equivalent keyboard, pointer, and focus interactions reach the same enabled action and observable state.
- Overlay stacking has a defined active surface; background controls cannot act through a blocking overlay.
- A component/scene teardown removes listeners, timers, delayed work, and visible transient artifacts that could act on a replacement scene.
- Route, scene, or result-flow interruption leaves visual state aligned with Pinia and domain state.
- Controls, disabled/loading affordances, focus treatment, and feedback are evaluated with `ui-ux-pro-max` when a UI/UX decision is needed.

## Attack Recipes

- Activate a result/purchase control repeatedly with pointer, Enter, and Space while its action is pending; observe one domain request and stable disabled/loading feedback.
- Open a modal/overlay, attempt keyboard focus and pointer interaction on the underlying panel, then close it; observe the intended active layer and restored focus path.
- Create and shutdown a combat/tribulation scene repeatedly, then fire resize and event-bus events; observe one active listener and no stale visual update.
- Interrupt a combat result flow by dismissal, scene exit, or navigation; observe matching UI flags, active scene, and domain result with no orphaned overlay.

## Cross-System Chains

- Pointer/keyboard action → Vue handler → `GameManager` mutation → `bumpState()` → disabled/value feedback in the same panel.
- Battle/tribulation event → `EventBus` → Phaser scene and Vue overlay → Pinia dismissal/scene flags.
- Route or scene shutdown → listener/timer cleanup → next scene creation → Playwright-visible interaction state.

## Existing Test Seams

`CombatScene.lifecycle.test.ts` verifies listener cleanup over repeated lifecycle runs; `TribulationScene.inkWashUi.test.ts` covers tribulation presentation. `stores/ui.test.ts` and `useStageActive.resultLifecycle.test.ts` cover overlay/scene flags. Component seams include `SettingsPanel.test.ts`, `StageSelectPanel.test.ts`, `EquipmentHallPanel.test.ts`, and game-component tests such as `DongFuCommandWheel.test.ts`. Browser seams are `tests/e2e/create-to-combat.spec.ts`, `tests/e2e/ink-wash-ui.spec.ts`, `tests/e2e/boot-fresh.spec.ts`, and `tests/e2e/save-reload.spec.ts`.

## Coverage Gaps to Look For

Check whether rapid repeated input and keyboard/focus parity have direct observable assertions. Look for overlay tests that confirm blocked background activation and focus restoration. For lifecycle paths, verify test controls can expose timers/listeners after route or scene interruption. Use the UI/UX skill’s accessibility and interaction guidance before recommending visual or interaction changes.
