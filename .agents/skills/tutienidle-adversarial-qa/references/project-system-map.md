# TutienIdle System Map

## Source of Truth

Code is primary. Docs are secondary; report disagreement as documentation drift.

## System Boundaries

| System | Primary paths | State owner | One-hop consumers | Existing test seams |
| --- | --- | --- | --- | --- |
| Economy/progression | `core/economy`, `core/production`, `core/progression`, `core/game/GameManager.ts` | Domain bags/managers and `GameManager` orchestration; inspect the mutated system for each action | UI panels, save snapshots, offline production, combat loot | `VendorSystem.test.ts`, `NodeSystem.test.ts`, `ProductionSystem.test.ts`, `GameManager.purchaseNode.test.ts`, `GameManager.vendor.test.ts` |
| Time/offline | `core/idle`, timed effects in `core/player` and `core/game/GameManager.ts` | `GameClock` owns elapsed-time calculation; `OfflineProgressSystem` converts supplied seconds; `GameManager` coordinates timed updates | Economy/progression accrual, combat retry timing, persistence timestamps | `OfflineProgressSystem.test.ts`, `GameManager.fixedStepCatchup.test.ts`, `GameManager.timedEffect.test.ts`, `useAutoRetryCountdown.test.ts`, `useCadenceSmoothing.test.ts` |
| Save/cloud | `services/save`, `services/cloudSave`, `composables/useBootFlow.ts` | `SaveSystem` owns local save shape/read-write-recovery helpers; `CloudSaveCoordinator` owns its revision during a cloud session | Every persisted system, boot/recovery UI, reload flow | `SaveSystem.test.ts`, `SaveRoundTrip.test.ts`, `saveShapeValidation.test.ts`, `CloudSaveCoordinator.test.ts`, `useBootFlow.test.ts`, `tests/e2e/save-reload.spec.ts`, `tests/e2e/boot-fresh.spec.ts` |
| Vue/Pinia/Phaser sync | `stores`, `components/game`, `game/scenes`, `core/events/EventBus.ts`, `composables/useGameState.ts` | Boundary-specific: `GameManager` is injected non-reactive state; `stateVersion` is the Vue refresh bridge; Pinia stores own UI flags | Vue overlays/panels, Phaser scenes, event-driven presentations | `EventBus.test.ts`, `stores/ui.test.ts`, `useStageActive.resultLifecycle.test.ts`, `CombatScene.lifecycle.test.ts`, component tests under `components/game` |
| Combat/tribulation | `core/battle`, `core/combat`, `core/tribulation`, `game/scenes/CombatScene.ts`, `game/scenes/TribulationScene.ts` | `BattleSystem` and `TribulationDirector` own their domain state; `GameManager` orchestrates and scene adapters present events | Loot, progression, UI results, save snapshots | `BattleSystem.test.ts` and focused `BattleSystem.*.test.ts`, `CombatSystem.*.test.ts`, `TribulationDirector.test.ts`, `CombatScene.lifecycle.test.ts`, `TribulationScene.inkWashUi.test.ts` |
| Inventory/equipment | `core/equipment`, `core/item`, `core/material`, inventory/equipment panels | `EquipmentBag`, `MaterialBag`, and `EquipmentSlotManager` hold local collections/slot state; `GameManager` coordinates actions | Stats, combat loadout, economy costs, save snapshots | `EquipmentSystem.test.ts`, `EquipmentStatPolicy.test.ts`, `MaterialBag.test.ts`, `ItemRoll.test.ts`, `EquipmentHallPanel.test.ts`, `InventorySort.test.ts` |
| UI/input/lifecycle | Vue components, router/directives, Phaser scenes | Vue and Pinia own UI state; each Phaser scene owns its subscription lifecycle | All user-observable flows and domain-state feedback | Vue component tests, `CombatScene.lifecycle.test.ts`, `TribulationScene.inkWashUi.test.ts`, `tests/e2e/create-to-combat.spec.ts`, `tests/e2e/ink-wash-ui.spec.ts` |

Representative economy tests demonstrate atomic vendor transactions, node prerequisite/cost boundaries, and idempotent production settlement. Time tests cover the 24-hour offline cap, clock rollback, and fixed-step combat catch-up. Save tests cover current-shape validation, backup restoration, cloud revision conflict retry, and browser reload persistence. Where a UI flow changes a plain `GameManager` object in place, inspect the call to `bumpState()` rather than treating a component as an independent state owner.

## Cross-System Hotspots

`GameManager.ts`, `BattleLootSystem.ts`, `useGameState.ts`, `useStageActive.ts`, `SaveSystem.ts`, `CloudSaveCoordinator.ts`, `EventBus.ts`, `CombatScene.ts`, and boot flow require explicit one-hop review.

`GameManager` is an orchestration hotspot rather than proof that it owns every nested system. `useGameState.ts` documents the `stateVersion` refresh contract; `CombatScene` and `TribulationScene` subscribe to the shared `EventBus` and must pair registrations with teardown.

## Verification Commands

Run from `game/`:

```powershell
# Focused Vitest file or family
npm.cmd run test -- src/core/idle/OfflineProgressSystem.test.ts

# Full Vitest suite
npm.cmd run test

# TypeScript and Vue checks
npm.cmd run type-check

# Production build (runs type-check and Vite build)
npm.cmd run build

# Playwright end-to-end suite
npm.cmd run test:e2e

# Browser inspection: launch the Vite app, then inspect the relevant flow in a browser.
npm.cmd run dev
```

## Maintenance Rule

Confirm paths against code at review time. Do not treat this map as authority when it has drifted.

