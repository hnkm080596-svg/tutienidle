# Economy and Progression

## Load When

Changes touch `src/core/economy/`, `src/core/production/`, `src/core/progression/`, `src/core/reward/`, `src/core/realm/`, `src/core/cultivation/`, `src/core/game/GameManager.ts`, or their panel/data consumers. Also load for loot rewards, material costs, unlocks, production settlement, purchase actions, or persistence of these values.

## State Owners and Boundaries

`src/core/economy/VendorSystem.ts`, `src/core/production/ProductionSystem.ts`, and `src/core/progression/NodeSystem.ts` implement focused economy/progression rules. `src/core/material/MaterialBag.ts` holds material quantities; `src/core/reward/RewardSystem.ts` and `src/core/game/BattleLootSystem.ts` bridge reward production into player/bag state. `src/core/game/GameManager.ts` exposes façade actions and builds save-relevant state with the other domain managers. Inspect the action’s delegate and its caller together before assigning ownership.

## High-Risk Invariants

- A successful reward or cost changes the intended receiver and source by the specified amount; a rejected action changes neither.
- A claim or settled production cycle is applied once, even if the same tick or restore path is repeated.
- Purchase and upgrade paths enforce cost, prerequisites, and maximum-level/unlock boundaries atomically.
- Zero, negative, non-finite, and implausibly huge quantities do not create value or corrupt stored amounts.
- A repeat purchase cannot bypass the node-level or ownership guard.
- A reload after a completed transaction represents the post-transaction state, not an intermediate debit or duplicated reward.

## Attack Recipes

- Seed exactly one affordable vendor material; submit amount `0`, `-1`, a fraction, `NaN`, and a value above the bag amount; observe rejection with unchanged bag and currency for every invalid request.
- Purchase a node, repeat the same purchase, then attempt an upgrade at the level cap; observe exactly one initial debit and no out-of-bound node level.
- Start a production cycle, settle at its deadline, call settlement/tick again, then reload; observe one reward record and a stable persisted bag amount.
- Award combat loot, trigger the save path, reload, and inspect materials/progression; observe the loot once and no independent second reward grant.

## Cross-System Chains

- Battle victory → `BattleLootSystem`/reward receiver → `MaterialBag` → `buildGameSave()` → reload.
- Production cycle deadline → `ProductionSystem` settlement → `MaterialBag` → panel refresh through `stateVersion`.
- Node purchase → `NodeSystem` levels/modifiers → `GameManager` stat aggregation → combat-facing player entity.

## Existing Test Seams

`VendorSystem.test.ts` covers atomic sale, invalid amount, affordability, and price behavior. `NodeSystem.test.ts` covers prerequisite, duplicate purchase, cost, max-level, and failed-mutation behavior. `ProductionSystem.test.ts` covers cycle snapshots, idempotent settlement, auto restart, and offline cap behavior. `GameManager.purchaseNode.test.ts`, `GameManager.vendor.test.ts`, `BattleLootSystem.realmReward.test.ts`, and `SaveRoundTrip.test.ts` are cross-boundary seams.

## Coverage Gaps to Look For

Look for assertions that expose both sides of a transaction and the persisted snapshot after it. For UI-triggered purchases, check that the test can observe rejection feedback as well as the domain value. For loot-to-save, look for a seam that runs the real reward-to-snapshot sequence rather than testing the two ends independently.
