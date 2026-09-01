# Inventory and Equipment

## Load When

Changes touch `src/core/equipment/`, `src/core/inventory/`, `src/core/item/`, `src/core/material/`, `src/composables/useEquipmentActions.ts`, `src/composables/useEquipmentTooltip.ts`, equipment/inventory/bag panels, `GameManager.ts`, or save serialization/restoration of bags and slots.

## State Owners and Boundaries

`src/core/equipment/EquipmentBag.ts` holds equipment instances and deduplicates by `instanceId`. `src/core/material/MaterialBag.ts` holds material stacks and enforces finite-positive add/remove and stack limits. `src/core/equipment/EquipmentSlotManager.ts` holds the fixed slot-state collection separately from bag ownership. `src/core/equipment/EquipmentSystem.ts` applies equipment rule operations. `src/core/game/GameManager.ts` coordinates equipment, materials, stat refresh, and save-facing collections. UI composables/panels consume this state via the manager/state-version bridge.

## High-Risk Invariants

- Each equipment instance ID has one bag owner; duplicate input does not create a second owned item or double modifiers.
- Material stacks cannot exceed their configured capacity without reporting overflow, and remove cannot create value.
- Equip/unequip changes item flags, slot state, and derived stats atomically; a failed operation leaves all three unchanged.
- Removing, dissolving, or consuming an equipped item is rejected or first resolves equipment state according to the action contract; no dangling equipped reference remains.
- Stat recomputation reflects the actual equipped set exactly once.
- Save/load preserves current bag IDs, stack amounts, equipment flags, and slot state for a current-shape save.

## Attack Recipes

- Add the same equipment instance twice, equip it, and recompute stats; observe one bag entry and one modifier contribution.
- Fill a material stack to its limit, add one more, then remove zero/negative/non-finite/too-large amounts; observe bounded quantity and no mutation on invalid removal.
- Attempt to equip/unequip while a required slot, bag item, or resource condition fails; compare bag, slots, and stats before/after for full atomicity.
- Select an equipped item for a removal/dissolve-style operation, then reload after the accepted path; observe no equipped ID that lacks a bag instance.

## Cross-System Chains

- Equipment action → `EquipmentBag`/`EquipmentSlotManager` → `GameManager` stat assembly → combat entity.
- Material cost → `MaterialBag` → equipment operation result → Vue panel refresh through `stateVersion`.
- Bag and slot collections → `buildGameSave()` → restore → inventory/equipment panel rendering.

## Existing Test Seams

`EquipmentSystem.test.ts` covers roll/affix bounds, all-or-nothing operations, equipped-item guards, duplicate selection handling, and bag dedupe. `EquipmentStatPolicy.test.ts`, `EquipmentOperationCostCatalog.test.ts`, and `RefinementBalance.test.ts` cover policy/cost seams. `MaterialBag.test.ts` covers stack conservation, limits, invalid numerics, and safe removal. `EquipmentHallPanel.test.ts`, `InventorySort.test.ts`, `MaterialBagFilter.test.ts`, `useEquipmentTooltip.test.ts`, and `SaveRoundTrip.test.ts` cover consumer and persistence seams.

## Coverage Gaps to Look For

Look for a test that observes bag ownership, slot state, and derived combat stats after a single real action. Check restore behavior for duplicate IDs or a slot that points to a removed instance. Ensure capacity tests expose overflow handling to the caller/UI rather than only validating the final stack.
