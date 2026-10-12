# Architecture upgrade and production balance check

Status: source analysis; final runtime and aggregate gates remain pending.

Sources: `src/data/building/buildings.ts`, `src/core/building/BuildingSystem.ts`, `src/core/alchemy/AlchemySystem.ts`, `src/core/production/ProductionSystem.ts`, accepted rulings in the Architecture design audit.

| Domain | Current accepted progression | Implication |
| --- | --- | --- |
| Raw production | One independent cycle per enabled site | One enabled site no longer receives the old three-lane pool; the user explicitly accepted this pacing. Three enabled sites retain one lane each. Toggling siblings cannot concentrate output. |
| Khai Vat spirit stone | Existing realm rate multiplied by level progression, ten-hour storage | Building upgrade remains a spirit stone faucet/storage increase; raw sites have separate owner quotes and upgrades. |
| Equipment hall | Three percentage points discount per level after Lv1, cap 24% at Lv9 | Existing sink discount unchanged. |
| Alchemy | Speed multipliers 1, 1.15, 1.32, 1.52, 1.75, 2.01, 2.31, 2.66, 3.06; one kiln | Higher levels shorten cycles, never add concurrent production. Waiting capacity 3..27; total jobs 4..28. |
| Alchemy success | Recipe plus talents, no room-level bonus | More capacity does not improve yield or reduce input cost. Reservations/refunds conserve inputs; active cancellation is a sink. |
| Vendor / Chi | Art only, maxed | No sale faucet, workforce multiplier or dead upgrade sink. |
| Decompose | Immediate linear conversion, floor integer output | Split requests cannot increase yield. Output below one rejects without debit. Full output capacity is required before spending. |
| Expedition | Existing perfect-clear cycle and loot owner unchanged | Visual mounting, playback, remount and reduced motion introduce no faucet. |

No new infinite-resource loop is intended. Conservation and duplicate-settlement checks are required in the aggregate verification. This source analysis does not certify whole-game economy health.

- 2026-10-13 accepted ruling: each production site owns up to ten hours of offline cycle work. The allowance is not shared or transferable; map order and sibling toggles cannot starve or accelerate a site. Legal legacy heads share their own site allowance.
