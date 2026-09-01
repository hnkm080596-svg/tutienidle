# Combat and Tribulation

## Load When

Changes touch `src/core/battle/`, `src/core/combat/`, `src/core/enemy/`, `src/core/ailment/`, `src/core/buff/`, `src/core/tribulation/`, `src/core/skill/`, `src/core/talent/`, `src/game/scenes/CombatScene.ts`, `src/game/scenes/TribulationScene.ts`, combat/tribulation components, `GameManager.ts`, or `BattleLootSystem.ts`.

## State Owners and Boundaries

`src/core/battle/BattleSystem.ts` owns battle progression and emits combat-facing events. `src/core/combat/CombatSystem.ts` and related entity/resource systems own lower-level combat rules. `src/core/tribulation/TribulationDirector.ts` owns tribulation phases, questions, cooldown, and terminal state. `src/core/game/GameManager.ts` starts/updates/orchestrates domain systems; `src/core/game/BattleLootSystem.ts` applies post-battle rewards. `src/game/scenes/CombatScene.ts` and `src/game/scenes/TribulationScene.ts` adapt `EventBus` events into presentation and must not become a second combat authority.

## High-Risk Invariants

- Given identical deterministic inputs and seed/control seam, an outcome is reproducible; randomness is not silently re-rolled during replay or recovery.
- Tick ordering produces one coherent terminal result when death, victory, and reward conditions collide.
- Damage, health, resources, cooldowns, and timer catch-up remain bounded under zero, negative, non-finite, and large deltas.
- A victory reward is applied exactly once, including low-FPS catch-up and repeated result presentation.
- Pause/resume preserves the chosen combat/tribulation lifecycle without emitting stale actions or changing a terminal result.

## Attack Recipes

- Run the same battle fixture with its available deterministic control twice; compare terminal state, rewards, and emitted summary.
- Arrange lethal player and enemy damage in one update; observe a defined terminal state and no duplicate death/victory reward.
- Deliver an in-cap duration as fixed 0.1-second steps and as a throttled delta; compare combat result and bounded catch-up behavior.
- Win a battle, re-open/recreate the result presentation, then save/reload; observe one loot application and consistent progression.
- Start tribulation, answer at the question timeout boundary, then pause/resume during lightning; observe one phase transition and a bounded cooldown/result.

## Cross-System Chains

- Battle result → `BattleLootSystem` → reward/material/player progression → save snapshot.
- Fixed-step `GameManager.update()` → `BattleSystem` events → `CombatScene`/Vue combat UI → result controls.
- Tribulation phase/director event → `EventBus` → `TribulationScene` → UI active flag and return to main scene.

## Existing Test Seams

`BattleSystem.test.ts` and its focused `BattleSystem.*.test.ts` files cover health snapshots, countdown, gates, skill flow, resource behavior, and repeated effects. `CombatSystem.*.test.ts`, `AttackTiming.test.ts`, and `EntityVitalsSystem.test.ts` cover combat-rule seams. `TribulationDirector.test.ts` covers question progression, timeout, defeat/victory, cooldown, and damage mitigation. `GameManager.fixedStepCatchup.test.ts`, `BattleLootSystem.*.test.ts`, `CombatScene.lifecycle.test.ts`, and `tests/e2e/create-to-combat.spec.ts` cover cross-system paths.

## Coverage Gaps to Look For

Check whether random battle paths have an explicit seed or injectable roll source suitable for replay. Seek a same-tick terminal collision test that observes both domain result and reward count. Verify low-FPS and pause/resume tests run through the reward/persistence handoff, not only the battle state.
