# QA Review: Economy & Progression Subsystem Deep Audit

- Date: 2026-09-02
- Mode: deep
- Verdict: PASS WITH GAPS
- Task-owned paths: none (read-only exploration)

## Scope and Risk Map

Changed systems: economy/progression, production, cultivation, realm, quest, reward, alchemy, decompose, pill, material, profession, building, game (GameManager, BattleLootSystem, StageWaveSystem).

One-hop consumers: save/restore, UI panels, combat loot, offline accrual.

Escalation decision: Deep audit triggered by broad economy/progression scope crossing multiple persistence boundaries and recent merge activity (dot-pha-loi-kiep spec v54 fields, item-grade rework P5-6, breakthrough unequip T17).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
|---|---|---|---|---|---|---|---|
| ECO-01 | VendorSystem / GameManager | sellMaterialToVendor() creates new VendorSystem per call | Structure equality not required for correctness | Repeat | Equivalent result each call | Unit | Low |
| ECO-02 | ProductionSystem / settleOffline | Budget runs out mid-iteration, remaining cycles cancelled | Budget fairness: earliest cycles settled, rest cancelled | Timing boundary | Settlement count and material amounts | Integration | Low |
| ECO-03 | ProductionSystem / settleOffline | Backlog cancellation loop runs after budget exhaustion | No double-settle | Repeat | Same cycles produce same total reward | Unit | Low |
| ECO-04 | CultivationSystem / addCultivation | Cultivation capped at required for current level | Player cannot exceed required cultivation | Value mutation | Cultivation = min(amount, required) | Unit | Low |
| ECO-05 | GameManager / restoreFromSave | Production settle precedes alchemy settle in restore | Ordering produces correct bag state | Cross-system chain | Materials from production available for alchemy | Integration | Low |
| ECO-06 | BattleLootSystem / processDefeatedEnemies | rewardGranted flag prevents double-reward | Exactly-once per enemy | Repeat | rewardGranted=true before processing | Unit | Low |
| ECO-07 | NodeSystem / devResetBranch | Cascade gỡ node mồ côi loops to stability | All orphaned nodes removed, refund computed | Cross-system chain | No node with missing prereq survives | Unit | Low |
| ECO-08 | ProductionSystem / Worker budget | workerCycles processed in budget, leftover cycles forfeited | No reward for cycles beyond budget | Repeat | Same result on reload | Integration | Low |
| ECO-09 | MeridianSystem / investThongMachDan | Tuần tự bắt buộc, gate realm level trong Luyện Khí | Cannot skip meridian | Reorder | Next meridian requires previous | Unit | Low |
| ECO-10 | QuestSystem / claim | Collect quest consumes material, then marks claimed | Atomic: consume + mark claimed | Interruption | Reload after consume but before mark | Integration | Medium |
| ECO-11 | BattleLootSystem / grantItemDrops | Overflow tracked per-batch, one notification | Overflow not lost silently | Value mutation | overflowParts contains correct amounts | Unit | Low |
| ECO-12 | GameManager / update | drainSettlementEvents called after production tick | Events consumed exactly once per cycle | Repeat | Same event not emitted twice | Unit | Low |
| ECO-13 | AlchemySystem / tick | Job removed before pill added to bag | Idempotent tick after reload | Repeat | Same job not settled twice | Unit | Low |
| ECO-14 | DecomposeSystem / tick | Catch-up limited to 1 cycle | No burst on idle | Timing boundary | Only 1 cycle caught up | Unit | Low |
| ECO-15 | GameManager / restoreFromSave | Equipment auto-dissolve rewards added to material bag | Auto-dissolve rewards credited during restore | Value mutation | Materials added for dissolved equipment | Integration | Medium |
| ECO-16 | saveShapeValidation | v54 4 fields validated | Shape rejects malformed new fields | Value mutation | missing/NaN/boolean for openedMeridianIds | Unit | High |
| ECO-17 | GameManager / chooseCultivationPath | mortalPerfectionAchieved snapshot at breakthrough | Snapshot frozen, never recalculated | Stale state | Changing stats after path choice doesn't update | Integration | Medium |
| ECO-18 | GameManager / chooseCultivationPath | realmId changes but unequipAllEquipment not called | Equipment may remain equipped with wrong realm grade | Cross-system chain | Equipped items after realm change | Integration | High |
| ECO-19 | BattleLootSystem / grantItemDrops | quest hook uses amount - overflow | Quest progress matches actual bag addition | Value mutation | amount - overflow passed to onMaterialCollected | Unit | Low |
| ECO-20 | ProductionSystem / buildCycle | Math.random() used for roll seed | Non-deterministic seed across reloads | Repeat | Same seed not reproducible | Unit | Low |

## Findings

### ECO-16: v54 shape validation rejects malformed new fields
- Severity: High
- Status: Confirmed (observed in code)
- Invariant: Boundedness
- Preconditions: Save with malformed `openedMeridianIds` (not array), `luyenKhiKillsSinceBeast` (negative/NaN), `mortalPerfectionAchieved` (non-boolean)
- Evidence: `game/src/services/save/saveShapeValidation.ts:196-203` validates all 4 fields with specific type checks. `requireArray` for `openedMeridianIds` (L196), `requireNonNegativeNumber` for `luyenKhiKillsSinceBeast` (L197), boolean check for `mortalPerfectionAchieved` (L198-200), boolean check for `greatDaoOpportunityLost` (L201-203). These will cause `issues[]` to be non-empty, returning `{ ok: false }`.
- Test file: `game/src/services/save/saveShapeValidation.test.ts` (existing)
- Owner subsystem: save/validation
- Blast radius: Rejects corrupt saves before boot, preventing white-screen crashes.

### ECO-18: `chooseCultivationPath` changes realmId without calling `unequipAllEquipment`
- Severity: High
- Status: Confirmed (code evidence)
- Invariant: Cross-system — Conservation
- Preconditions: Player has equipment equipped before choosing cultivation path (Phàm Nhân). After `chooseCultivationPath('phap_tu', player)` or `('kiem_tu', player)`, realmId changes from 'mortal' to 'qi_refining' (GameManager.ts:1065).
- Reproduction: Create a player with mortal equipment equipped, call `chooseCultivationPath`, then check if equipment is still equipped.
- Expected: `unequipAllEquipment()` should be called after realm change to prevent grade mismatch (per Task 17's stated purpose at L2160-2168). The tribulation-based breakthrough path (`useTribulation.ts:164`) correctly calls `unequipAllEquipment()` after realm change, but `chooseCultivationPath` does not.
- Actual: `GameManager.ts:1065-1070` changes realmId to 'qi_refining' (L1065) and calls `syncRealmPassive`/`syncRealmStatPassive` (L1069-1070) but does NOT call `unequipAllEquipment()`. The `unequipAllEquipment` method is only called in `useTribulation.ts:164` (tribulation breakthroughs) and nowhere else. The mortal→qi_refining path is the only breakthrough that bypasses the guard.
- Evidence: `game/src/core/game/GameManager.ts:1065-1070` — no `unequipAllEquipment` call. `game/src/composables/useTribulation.ts:164` — `unequipAllEquipment()` IS called here. `game/src/core/game/GameManager.ts:2170-2180` — the method exists and is tested. The only caller outside tests is `useTribulation.ts:164`.
- Owner subsystem: GameManager / chooseCultivationPath
- Blast radius: After mortal→qi_refining, player retains equipped mortal items. The item-grade rework P5-6 (T16) means equipment now has a `grade` field via `ProfessionGrade`. If mortal equipment has a different grade than qi_refining allows, the player cannot re-equip these items if manually unequipped, but they remain equipped and functional. The items are stuck in a "can't re-equip" state but not lost. No stat corruption because the equipment stats still apply while equipped.

### ECO-14: Production cycle seed uses `Math.random()` — non-deterministic
- Severity: Medium
- Status: Suspected
- Invariant: Determinism
- Preconditions: Production cycle created via `buildCycle()` (ProductionSystem.ts:83-94) uses `Math.floor(Math.random() * 0x7fffffff)` for `rollSeed` (L91).
- Evidence: `game/src/core/production/ProductionSystem.ts:91` — `rollSeed: Math.floor(Math.random() * 0x7fffffff)`. This means the same game state and clock time produce different rewards on reload. For offline settle, this is especially relevant since the seed is generated at cycle start time, not at settle time.
- Owner subsystem: ProductionSystem
- Blast radius: Non-deterministic rewards across reloads. Cannot replay a known sequence for debugging.

### ECO-10: Quest claim atomicity — material consumed before `markClaimed`
- Severity: Medium
- Status: Suspected
- Invariant: Atomicity
- Preconditions: `QuestSystem.claim()` at L117-118 removes material from bag via `bags.materialBag.remove(...)`, then later calls `manager.markClaimed(questId)` at L142. If the page is closed between these two operations, the material is consumed but the quest is not marked claimed.
- Evidence: `game/src/core/quest/QuestSystem.ts:117-142` — The remove happens at L118, and `markClaimed` at L142. There are several intermediate operations (reward give, item drops, onMaterialCollected hook) that could fail or be interrupted.
- Owner subsystem: QuestSystem
- Blast radius: On reload, the quest appears unclaimed with reduced progress (material already consumed). Player could potentially re-collect the material and claim again, but the original material is lost.

### ECO-20: Production cycle seed non-deterministic across reloads
- Severity: Low
- Status: Suspected
- Invariant: Determinism
- Evidence: `ProductionSystem.ts:91` uses `Math.random()`. Same as ECO-14, listed separately for completeness.
- Owner subsystem: ProductionSystem

## Optimization Opportunities

1. **VendorSystem per-call allocation** (`GameManager.ts:1748, 1771`): `new VendorSystem(...)` created every time `sellMaterialToVendor()` or `getVendorSellableRows()` is called. The constructor receives `this.materialRegistry` and `this.getAlchemyRecipes()` (which creates a new array). Cache the VendorSystem instance, or make its methods static/pure functions.

2. **`getVendorSellableRows` iterates all materials** (`GameManager.ts:1775-1790`): Iterates the entire material bag every call. For a large bag, this is O(n) with a `getUnitSellPrice` lookup per item. Pre-compute sellable items on material add/remove.

3. **`ProductionSystem.tick` iterates ALL states** (`ProductionSystem.ts:271`): `for (const state of this.states.values())` runs every game tick regardless of whether any cycle is active. Add a fast-path skip when no active cycles exist.

4. **`getRealmIndex` does O(n) scan** (`realmSystem.ts:111-113`): `REALMS.findIndex` is called frequently (passive tick, combat, loot scaling). Cache realm index in PlayerData or use a Map lookup.

5. **`REALMS.find` in `getCurrentRealm`** (`realmSystem.ts:4`): Called every cultivation tick. Could use a Map<string, RealmData> for O(1) lookup.

6. **`aggregateNodeStatModifiers` / `aggregateNodeSkillModifiers`** (`NodeSystem.ts:184-238`): Re-iterate ALL nodes every time. Cache results and invalidate on node purchase/upgrade.

7. **`DecomposeSystem.runOneCycle` sorts bag stacks** (`DecomposeSystem.ts:136`): `this.bag.getAll()` creates a new array each cycle. No sorting needed, but the iteration happens every cycle.

8. **`alchemySecondsFor` recomputes multiplier** (`AlchemySystem.ts:132-135`): Computes `Math.min(Math.max(roomLevel, 1), ...)` every call. Cache the result.

## Verified Clean

1. **MaterialBag add/remove guards** (`MaterialBag.ts:23, 67`): Both `add()` and `remove()` guard against NaN, Infinity, and non-positive amounts. `remove()` also guards against insufficient balance. Well-defended.

2. **VendorSystem atomic rollback** (`VendorSystem.ts:116-125`): If Linh Thạch add overflows, the original material is restored before returning `bag_full`. Full atomicity with no partial state.

3. **BattleLootSystem exactly-once guard** (`BattleLootSystem.ts:163-167`): `rewardGranted` flag prevents double-reward per enemy. Checked before processing, set immediately after affirmation.

4. **ProductionSystem settle idempotency** (`ProductionSystem.ts:278`): `state.activeCycle = undefined` before `grantCycleRewards()` ensures no double-settle on repeated tick.

5. **AlchemySystem tick idempotency** (`AlchemySystem.ts:301-345`): Completed jobs are filtered into `remaining` array; the original `this.jobs` is replaced atomically. No double-settle.

6. **Save shape validation for v54 fields** (`saveShapeValidation.ts:194-203`): All 4 new fields (`openedMeridianIds`, `luyenKhiKillsSinceBeast`, `mortalPerfectionAchieved`, `greatDaoOpportunityLost`) are validated with correct type checks. Non-negative number, boolean, and array checks all present.

7. **CultivationSystem breakthrough cap** (`CultivationSystem.ts:35-76`): `cultivation = 0` after breakthrough, preventing accumulation across breakthroughs. The `addCultivation` cap at `required` prevents multi-level AFK skips.

8. **Quest `onMaterialCollected` skip during restore** (`GameManager.ts:3130-3131`): Comment explicitly states the hook must be skipped during restore. The restore path does not call `onMaterialCollected` for restored materials.

9. **ProductionSystem offline cap** (`ProductionSystem.ts:352`): `PRODUCTION_OFFLINE_CAP_SECONDS` bounds the total offline settlement. Backlog beyond cap is forfeited (L403-416), preventing infinite offline accrual.

10. **BattleLootSystem `beginTribulation` clears receiver** (`BattleLootSystem.ts:142-147`): Sets `receiver = null` to prevent stale loot from previous battle. Explicitly documented.

## Gaps and Residual Risk

- **ECO-18 (chooseCultivationPath unequip)**: Confirmed that the guard is absent; impact depends on whether the equipment grade gate (T16) blocks mortal→qi_refining re-equip. Runtime/Playwright evidence needed to confirm the actual player-visible symptom.
- **ECO-10 (quest claim atomicity)**: Requires a browser interruption test (Playwright) to confirm. The window between `bag.remove` and `markClaimed` is small but real.
- **ECO-14 (production seed)**: Non-deterministic seed is a design choice, not necessarily a defect. But it prevents reproducible testing and makes offline rewards unpredictable.
- **Production cycleMath.random()**: Using `Math.random()` for seed generation means the same offline duration produces different rewards on each reload. This is a determinism concern but not a data-loss issue.