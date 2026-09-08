# R7 — Worker Allocation & Production Authority — Design Spec

Date: 2026-09-08
Missions: Roadmap Phase R7 (Architecture Repair Program), Mission 0 findings AR-07 + AR-08.
Status: APPROVED-by-user-design (chat, 2026-09-08 — shared worker pool + offline decompose confirmed), pending spec review.

## 1. Finding / Evidence

**AR-07 (P0, confidence 100):** two allocation rules exist and one crashes.

```text
Online  ProductionSystem.tickWorkers (ProductionSystem.ts:303-344)
  - manual sites first (Map order), then remainder round-robins
    autoSites[index % autoSites.length]  ← autoSites NOT checked nonempty
  - repro: 1 auto-restart site + capacity 3 + manual assignment 1
    → autoSites is empty after filtering → `undefined.activeWorkerSlots`
    → TypeError, thrown from GameManager.update (:2751)
    → the exception aborts the SHARED update invocation; every later
      system in that tick (alchemy, decompose, timed effects...) skips
Offline ProductionSystem.settleWorkersOffline (:477-526)
  - manual first, then remainder round-robins ALL activeStates
  - same inputs give a DIFFERENT split than online
```

Executed divergence example from audit: capacity 6, sites A=4 manual,
B=1 manual, C unassigned → online gives remainder to C; offline gives
it to A. Both rules were copied from the same intent; neither is the
authority.

**AR-08 (P1, confidence 100):** the active DecomposeSystem instance can
never receive workers.

```text
GameManager.ts:436   decomposeSystem = new DecomposeSystem(this.materialBag, { autoWorkerCapacity: 0 })
DecomposeSystem.ts:66 capacity stored readonly at construction; no update path exists
DecomposeSystem.ts:79 setSetting clamps workers to this.autoWorkerCapacity (always 0)
DecomposeTab.vue:97  UI slider max hardcoded :max="6" — disconnected from real capacity
GameManager.ts:2800  decomposeSystem.tick() runs every update — dead wiring
```

Requesting six workers in the UI silently yields zero. Its component
test builds an independent capacity-6 system — passing tests, dead
feature (the P13 incident class).

## 2. Product decisions (user, 2026-09-08)

1. **Decompose shares the production worker pool.** One workforce:
   `autoWorkerCapacity` from Chiêu Hiền Quán. Decompose workers
   assigned in the decompose tab reduce capacity available to
   production sites in the same tick.
2. **Decompose runs offline.** On load, pending decompose progress
   settles inside the existing offline budget/cap window, consistent
   with production worker cycles. Decompose state joins GameSave.

## 3. Invariant

1. **One allocation rule.** Exactly one pure allocator function
   distributes a worker capacity across claimant sites. Both online
   (`tickWorkers`) and offline (`settleWorkersOffline`) settlement
   consume its result. Neither path contains its own distribution loop.
2. **No zero-eligible-site exception.** When every site is manual or
   capacity exceeds assigned workers, remaining capacity is IDLE — it
   is not given to any site by a second rule, and it never crashes.
3. **Online ≡ offline allocation.** For identical
   (capacity, assignments, active-site order), both paths produce the
   identical per-site slot map. Idle capacity is identical too.
4. **One capacity source.** `getWorkerCapacityForLevel(chiHienQuanLevel)`
   remains the only capacity authority. Decompose receives capacity
   dynamically (an update command), not constructor-only.
5. **UI maximum equals runtime capacity.** The decompose worker slider
   max is bound to live capacity — no hardcoded 6.
6. **Shared-pool accounting.** Decompose's assigned workers are
   subtracted from the pool BEFORE the production allocator runs. The
   production allocator itself stays decompose-agnostic (it receives an
   already-reduced capacity). Decompose settings clamp to the same live
   capacity.
7. **Persistence policy explicit.** Decompose processing state
   (settings + cycle timer) persists in GameSave and restores without
   awarding duplicate output; restore does not reset player settings.

## 4. Ownership

| Rule | Owner |
|---|---|
| Worker distribution across sites (online + offline) | NEW pure allocator `core/production/WorkerAllocator.ts` (`allocateWorkerSlots`) |
| Capacity value | `getWorkerCapacityForLevel` (unchanged), applied by GameManager/BuildingOps |
| Decompose workers + cycle timing | `DecomposeSystem` (keeps processing state; capacity becomes dynamic) |
| Decompose capacity supply + shared-pool split | `GameManager` tick path (orchestrator: decompose first, production second with remainder) |
| Offline settle orchestration | `GameManagerSaveRestore` (unchanged role, calls same allocator via systems) |
| Assignment persistence | production states `assignedWorkers` (unchanged); decompose settings join save |

## 5. Existing primitives reused

- `WorkerCapacity.getWorkerCapacityForLevel` — capacity source (unchanged).
- `ProductionSystem` manual-assignment snapshot (`assignedWorkers`,
  `getWorkerAssignments`) — persistence + parity input (unchanged shape).
- `DecomposeSystem` cycle engine (tick/catch-up-one/drainOutput) — kept;
  only its capacity plumbing and save wiring change.
- `PRODUCTION_OFFLINE_CAP_SECONDS` budget — decompose offline settles
  inside the same cap window concept; no second time model.

## 6. Missing primitive (added by this mission)

`allocateWorkerSlots(activeSiteIds: string[], assignments: Map<string, number>, capacity: number): Map<string, number>`

Pure function; no system imports. Rules (both settlements must match):

```text
1. capacity = max(0, floor(capacity))
2. per site: slots = min(max(0, floor(assigned)), remaining) in
   activeSiteIds order — sites without assignment get none here
3. remainder → round-robin across sites WITHOUT an assignment, in
   activeSiteIds order; if that set is empty, remainder stays IDLE
4. sites with slots 0 may appear in the result as 0 (explicit, not absent)
```

## 7. Migration path

Vertical slice order (each ends green before the next starts):

```text
S1  WorkerAllocator + full parity/edge test matrix (pure, TDD)
S2  tickWorkers consumes allocator (behavior-preserving except the
    crash/parity fix) + regression test for AR-07 repro
S3  settleWorkersOffline consumes the same allocator + parity test
    online-vs-offline on real states
S4  DecomposeSystem dynamic capacity: replace constructor-readonly
    capacity with an explicit update command; clamp on both set and
    capacity change (shrink case: workers > new capacity → clamped)
S5  GameManager shared-pool wiring: decompose capacity update per tick,
    production receives capacity minus decompose workers; DecomposeTab
    slider max bound to live capacity (i18n labels unchanged)
S6  Decompose persistence: save shape + restore; offline settle of
    decompose progress inside the offline window (online tick engine
    reused with an elapsed-time catch-up bounded by the same cap)
```

## 8. Real consumers to migrate (production, not fixtures)

- `GameManager.update` tick path (:2751 tickWorkers, :2800 decompose tick).
- `GameManagerSaveRestore.restoreFromSave` offline settle (:274).
- `DecomposeTab.vue` workers slider (:94-101).
- Existing tests that only hand-construct systems stay as unit coverage;
  they are NOT accepted as evidence of the wiring fix — the plan adds
  GameManager-level integration tests (P13 lesson).

## 9. Regression tests required

- AR-07 repro: 1 auto site + manual assignment + spare capacity → no
  throw, remainder idle.
- Zero sites / all-manual / mixed / overcommitted / capacity 0 /
  non-integer inputs (allocator matrix).
- Insertion-order stability: same inputs → same distribution.
- Online-vs-offline parity on real `ProductionSystem` states.
- Full `GameManager.update` runs with decompose consuming part of the
  pool; production gets the remainder; both advance.
- Capacity change: CHQ upgrade raises both systems' ceilings; save from
  old capacity restores without stuck workers (clamped).
- Decompose: slider max = live capacity; assignment beyond capacity
  clamps; restore replays within budget; repeated restore does not
  double-settle.

## 10. Explicit out of scope

- Resource yield/cost rebalance (6F per-worker rates stay).
- New production sites; new decompose outputs.
- Offline decomposition semantics beyond the user-confirmed settle
  (no new mechanics invented).
- Vendor, crafting, quest systems (separate missions).
- Renaming `autoWorkerCapacity` or changing its save shape (name
  retained; only its consumers change).

## 11. Completion gate

```text
- one allocation rule in code (grep: no other distribution loop)
- online == offline for identical inputs (test evidence)
- AR-07 repro test green; no zero-eligible-site exception possible
- decompose receives live capacity; UI max == runtime capacity
- shared-pool accounting test at GameManager level
- decompose save/restore + offline settle evidence
- P3 full + adversarial QA quick + code review pass
- browser check of decompose tab deferred per P14 worktree exception
  (recorded in mission report)
```
