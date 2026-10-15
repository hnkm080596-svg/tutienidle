# Age-only material resource cutover

Checkout `E:\tutienidle`, app `game`, branch `master`. Local changes only; no commit/push, no file or save deletion. Continue the user's current checkout and preserve its existing UI/gameplay work.

## Task / approved scope

User approved five ages for wood/ore, one new spirit-stone identity, retained upgrade realm gates and existing increasing cost tables, no save migration, fresh codes instead of reusing old resource codes. Latest steering explicitly defers balance work to a separate patch. This patch does not retune payout amounts, age weights, upgrade prices, speed multipliers or authored stage reward amounts.

Single responsibility: the canonical material identity/metadata and all real producer/consumer chains agree. Owners remain ProfessionMaterial + materials catalog, ProductionSystem/ProductionOffline, DecomposeSystem, BuildingSystem, and shared save acceptance. No alternate bag/currency authority is added.

## New table

| Material | ID |
|---|---|
| Linh Thạch | material_spirit_stone |
| Thập Niên Linh Mộc | material_spirit_wood_decade |
| Bách Niên Linh Mộc | material_spirit_wood_century |
| Thiên Niên Linh Mộc | material_spirit_wood_millennium |
| Vạn Niên Linh Mộc | material_spirit_wood_myriad_year |
| Thượng Cổ Linh Mộc | material_spirit_wood_thuong_co |
| Thập Niên Linh Khoáng | material_spirit_ore_decade |
| Bách Niên Linh Khoáng | material_spirit_ore_century |
| Thiên Niên Linh Khoáng | material_spirit_ore_millennium |
| Vạn Niên Linh Khoáng | material_spirit_ore_myriad_year |
| Thượng Cổ Linh Khoáng | material_spirit_ore_thuong_co |

Wood/ore have no realm metadata. Herbs keep their existing realm/recipe/age contract. Icons reuse existing visual files only, not retired material identities.

## Consumer census / construction evidence

- Canonical constructor now accepts kind + age; boot/catalog validators require five ages, correct IDs, no wood/ore realm metadata and no duplicate entries.
- Production tables have one entry per age. Wood/mine rolls no longer draw realm tiers; equal seed/level yields equal resource rewards in different realms. Herbs retain tier roll and producibility ceiling.
- Online/offline cycle creation and save-cycle duration validation share productionBaseSeconds. Wood/mine reuse the existing mortal baseline (100 seconds at level 1); higher realms no longer slow them. Linh Mạch uses the same baseline clock; realm remains a quantity/rate input for spirit stones.
- Production query rates use the new age pool, not a realm-filtered empty pool. UI retains Chat/age cues; Pham/realm labels and colors no longer derive for wood/ore.
- Building/source upgrade prices, starter grants, loot and quest collect targets reference new IDs. Quest IDs, chain, amounts and timing semantics stay unchanged; balance implications of shared targets are deferred.
- Decomposition accepts canonical age IDs only. Resource realm factor is gone; /6 floor and age factors remain. Herb conversion stays realm-aware. Sub-unit input is retained and repeat command feedback remains wired.
- Spirit stone remains a MaterialBag material and uses one ID. Dong Phu chip icon mapping was updated. Amount scaling in existing realm/stage/operation tables is preserved.
- Save version 91 accepts only its current version; no re-stamp/migration runs. Shape validation rejects retired resource IDs even in a manually re-stamped payload. Old saved bytes remain available; no reset or deletion is performed.

## Focused verification

1. Type-check passed after metadata/signature/save changes.
2. 22 selected test files: 622 tests passed (profession metadata/catalog; production/decompose; bag/building; starter grants; save version/shape; drop/catalog; decompose UI).
3. 7 selected files: 235 tests passed (fresh online/offline/realm-independence regression; equipment, quest and tooltip consumers). Counts overlap previous production scope; not an aggregate unique total.
4. 4 selected files: 28 tests passed (current restore identity, wash transaction, refinement and architecture card consumers).
5. git diff --check passed on the cutover responsibility.

Regression proof includes identical wood/mine deadlines, rewards and rates at PN/LK/TC; online/offline credit equality; five canonical IDs per resource; herbs above the producible realm window still rejected; old versions and retired IDs rejected without changing localStorage; startup and costs use the new codes.

## Limits / deferred work

- No full QA or aggregate fixed-point claim. No merge-ready claim or external update.
- The first wide domain check also selected historical balance simulations. Their old realm-keyed pattern/fuel expectations no longer model this contract; balance-simulation redesign/qualification is deferred with the balance patch, not repaired by changing economic numbers here.
- DecomposeSystem.capacity.test.ts expected legacy inert save fields whereas getSaveState already returned {} before this task; its mismatch is pre-existing and outside this cutover.
- Live auth/reload of an existing v90 character was not used as a fresh v91 runtime acceptance test; old saves are intentionally incompatible and preserved. Fresh catalog/manager/starter/restore paths were checked headlessly.
- Existing cost-row quantities and shared collect-target pacing may need retuning after realm identity removal. No numeric changes are made to hide those effects.

Q1-Q12 summary: existing domain owners retain rules/state; helper direction points toward resource/production foundations; callers use typed commands and detached queries; no presentation authority added; source/cost/quest/save consumers migrated; reset/persistence contract is strict fresh version; no async lifecycle added; authoritative RNG and clock advancement retained; deterministic regression evidence above; old balance assertions and full QA are visible limitations.
