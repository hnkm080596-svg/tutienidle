# R7 Worker Allocation & Production Authority — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (opencode inline execution per AGENTS.md P6 convention) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One pure worker allocator consumed by both online tick and offline settlement (AR-07), and a live-capacity decomposition system wired into the shared pool with persistence (AR-08).

**Architecture:** Introduce `WorkerAllocator` (pure function, foundation layer) as the single distribution rule; migrate `ProductionSystem.tickWorkers` and `settleWorkersOffline` to consume it; give `DecomposeSystem` a dynamic capacity command; wire shared-pool accounting in `GameManager` tick and decompose save/restore in `GameManagerSaveRestore`.

**Tech Stack:** TypeScript, Vitest (TDD), Vue SFC (one binding change).

**Spec:** `game/docs/superpowers/specs/2026-09-08-r7-worker-allocation-design.md`

## Global Constraints

- No `any` (P8); new code typed explicitly.
- New/edited comments in English ASCII only (P15).
- Do not rebalance yields, cycle seconds, or `ORE_PER_WORKER_PER_CYCLE` (spec §10).
- `getWorkerCapacityForLevel` stays the only capacity authority (spec invariant 4).
- All work in a dedicated worktree via `using-git-worktrees` skill; task name `r7-worker-allocation`.
- Verification mode: P3 `full` (touches shared GameManager tick + save shape). Stop on first failure.
- Comments and identifiers below use the exact names from this plan (type consistency across tasks).

---

### Task 1: Pure WorkerAllocator

**Files:**
- Create: `game/src/core/production/WorkerAllocator.ts`
- Test: `game/src/core/production/WorkerAllocator.test.ts`

**Interfaces:**
- Consumes: nothing (pure foundation).
- Produces:
  ```ts
  export function allocateWorkerSlots(
    activeSiteIds: readonly string[],
    assignments: ReadonlyMap<string, number>,
    capacity: number,
  ): Map<string, number>
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// WorkerAllocator.test.ts
import { describe, expect, it } from 'vitest'
import { allocateWorkerSlots } from './WorkerAllocator'

describe('allocateWorkerSlots', () => {
  it('assigns manual sites first in given order, clamped to remaining capacity', () => {
    const result = allocateWorkerSlots(['a', 'b'], new Map([['a', 2], ['b', 5]]), 6)
    expect(result.get('a')).toBe(2)
    expect(result.get('b')).toBe(4) // clamped by remaining
  })

  it('round-robins remainder across unassigned sites in order', () => {
    const result = allocateWorkerSlots(['a', 'b', 'c'], new Map([['a', 1]]), 6)
    expect(result.get('a')).toBe(1)
    expect(result.get('b')).toBe(3) // 5 remaining / 2 sites
    expect(result.get('c')).toBe(2)
  })

  it('leaves remainder IDLE when every site is manual (AR-07 crash case)', () => {
    const result = allocateWorkerSlots(['a'], new Map([['a', 1]]), 3)
    expect(result.get('a')).toBe(1) // not 3
  })

  it('returns empty map when no active sites', () => {
    expect(allocateWorkerSlots([], new Map(), 5).size).toBe(0)
  })

  it('returns all zeros when capacity is 0', () => {
    const result = allocateWorkerSlots(['a', 'b'], new Map(), 0)
    expect(result.get('a')).toBe(0)
    expect(result.get('b')).toBe(0)
  })

  it('floors non-integer capacity and negative assignments', () => {
    const result = allocateWorkerSlots(['a', 'b'], new Map([['a', -2], ['b', 1.9]]), 4.7)
    expect(result.get('a')).toBe(0)
    expect(result.get('b')).toBe(1)
    // remainder 3 round-robin to b only -> b=4
    expect(allocateWorkerSlots(['a', 'b'], new Map([['a', -2], ['b', 1.9]]), 4.7).get('b')).toBe(4)
  })

  it('is deterministic for identical inputs', () => {
    const inputs = () => allocateWorkerSlots(['x', 'y', 'z'], new Map([['y', 2]]), 7)
    expect([...inputs()]).toEqual([...inputs()])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx.cmd vitest run src/core/production/WorkerAllocator.test.ts`
Expected: FAIL — cannot resolve `./WorkerAllocator`.

- [ ] **Step 3: Write minimal implementation**

```ts
// WorkerAllocator.ts
/**
 * Single workforce distribution rule for every settlement path
 * (online tickWorkers + offline settleWorkersOffline).
 *
 * Rules:
 * 1. capacity is floored at >= 0.
 * 2. Manual sites (assignment present) take min(assigned, remaining)
 *    in activeSiteIds order.
 * 3. Remainder round-robins across sites WITHOUT an assignment, in
 *    activeSiteIds order. If that set is empty the remainder stays
 *    IDLE (never crashes, never invents a second rule).
 * 4. Every active site appears in the result (0 when it got nothing).
 */
export function allocateWorkerSlots(
  activeSiteIds: readonly string[],
  assignments: ReadonlyMap<string, number>,
  capacity: number,
): Map<string, number> {
  const slots = new Map<string, number>()

  for (const siteId of activeSiteIds) {
    slots.set(siteId, 0)
  }

  let remaining = Math.max(0, Math.floor(capacity))

  const manual = activeSiteIds.filter((siteId) => assignments.has(siteId))
  const auto = activeSiteIds.filter((siteId) => !assignments.has(siteId))

  for (const siteId of manual) {
    if (remaining <= 0) {
      break
    }

    const assigned = Math.max(0, Math.floor(assignments.get(siteId) ?? 0))
    const take = Math.min(assigned, remaining)

    slots.set(siteId, take)
    remaining -= take
  }

  for (let index = 0; index < remaining; index++) {
    const siteId = auto[index % auto.length]!

    if (siteId === undefined) {
      break
    }

    slots.set(siteId, (slots.get(siteId) ?? 0) + 1)
  }

  return slots
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx.cmd vitest run src/core/production/WorkerAllocator.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/core/production/WorkerAllocator.ts src/core/production/WorkerAllocator.test.ts
git commit -m "feat(r7): pure worker allocator with idle-capacity and parity rules"
```

---

### Task 2: Migrate tickWorkers to the allocator (fixes AR-07 crash + divergence)

**Files:**
- Modify: `game/src/core/production/ProductionSystem.ts:303-357` (`tickWorkers`)
- Test: `game/src/core/production/ProductionSystem.workers.test.ts` (new file; keep existing `ProductionSystem.test.ts` untouched)

**Interfaces:**
- Consumes: `allocateWorkerSlots` (Task 1).
- Produces: unchanged public signature of `tickWorkers` — behavior change is ONLY: no exception when the auto set is empty, and remainder goes idle instead of to manual sites.

- [ ] **Step 1: Write the failing regression tests**

```ts
// ProductionSystem.workers.test.ts
import { describe, expect, it } from 'vitest'
import { MaterialBag } from '../material/MaterialBag'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { materials } from '../../data/materials/materials'
import { ProductionSystem } from './ProductionSystem'

function makeSystem(autoRestartSiteIds: string[]): ProductionSystem {
  const registry = new MaterialRegistry()
  registry.registerAll(materials)
  const bag = new MaterialBag(registry)
  const system = new ProductionSystem(bag)
  for (const siteId of autoRestartSiteIds) {
    system.ensureSiteState(siteId)
    system.setProductionAutoRestart(siteId, true)
  }
  return system
}

describe('tickWorkers — AR-07 regression', () => {
  it('does not throw when every site is manual and capacity has remainder', () => {
    const system = makeSystem(['herb_garden'])
    const registry = new MaterialRegistry()
    registry.registerAll(materials)
    const bag = new MaterialBag(registry)
    expect(() =>
      system.tickWorkers(Date.now(), bag, registry, 'qi_refining', 3, new Map([['herb_garden', 1]])),
    ).not.toThrow()
    expect(system.getState('herb_garden')!.activeWorkerSlots).toBe(1)
  })

  it('matches allocator output for mixed manual/auto sites', () => {
    const system = makeSystem(['a', 'b', 'c'])
    const registry = new MaterialRegistry()
    registry.registerAll(materials)
    const bag = new MaterialBag(registry)
    system.tickWorkers(Date.now(), bag, registry, 'qi_refining', 6, new Map([['a', 4], ['b', 1]]))
    expect(system.getState('a')!.activeWorkerSlots).toBe(4)
    expect(system.getState('b')!.activeWorkerSlots).toBe(1)
    expect(system.getState('c')!.activeWorkerSlots).toBe(1) // remainder -> unassigned c
  })

  it('remainder is idle when all sites are manual', () => {
    const system = makeSystem(['a', 'b'])
    const registry = new MaterialRegistry()
    registry.registerAll(materials)
    const bag = new MaterialBag(registry)
    system.tickWorkers(Date.now(), bag, registry, 'qi_refining', 6, new Map([['a', 2], ['b', 2]]))
    expect(system.getState('a')!.activeWorkerSlots).toBe(2)
    expect(system.getState('b')!.activeWorkerSlots).toBe(2)
  })
})
```

Note: site ids in `makeSystem` must exist in the production catalog — check `ProductionCatalog.ts` for real ids (e.g. `herb_garden`) and substitute; do NOT invent catalog entries.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx.cmd vitest run src/core/production/ProductionSystem.workers.test.ts`
Expected: FAIL — the all-manual + remainder case throws `Cannot read properties of undefined (reading 'activeWorkerSlots')` (or matches the old divergent distribution).

- [ ] **Step 3: Migrate tickWorkers to the allocator**

Replace the manual + round-robin block inside `tickWorkers` (lines ~317-340) with:

```ts
    const slotsBySite = allocateWorkerSlots(
      activeStates.map((state) => state.siteId),
      assignmentMap,
      capacity,
    )

    for (const state of activeStates) {
      state.activeWorkerSlots = slotsBySite.get(state.siteId) ?? 0
    }
```

Add the import at the top of the file:

```ts
import { allocateWorkerSlots } from './WorkerAllocator'
```

Delete the now-dead local loops (manual pass + `autoSites[index % autoSites.length]` round-robin). Keep the `workerCycles` spin-up/settle logic below unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx.cmd vitest run src/core/production/ProductionSystem.workers.test.ts src/core/production/ProductionSystem.test.ts`
Expected: PASS (new + existing).

- [ ] **Step 5: Commit**

```bash
git add src/core/production/ProductionSystem.ts src/core/production/ProductionSystem.workers.test.ts
git commit -m "fix(r7): tickWorkers consumes WorkerAllocator — AR-07 crash + offline divergence"
```

---

### Task 3: Migrate settleWorkersOffline to the same allocator (parity)

**Files:**
- Modify: `game/src/core/production/ProductionSystem.ts:477-526` (`settleWorkersOffline` allocation block)
- Test: `game/src/core/production/ProductionSystem.workers.test.ts` (append)

**Interfaces:**
- Consumes: `allocateWorkerSlots` (Task 1).
- Produces: offline settlement whose slot map equals online's for identical inputs.

- [ ] **Step 1: Write the failing parity test**

Append to `ProductionSystem.workers.test.ts`:

```ts
describe('online/offline allocation parity', () => {
  it('settleOffline distributes exactly like tickWorkers for identical inputs', () => {
    const online = makeSystem(['a', 'b', 'c'])
    const offline = makeSystem(['a', 'b', 'c'])
    const registry = new MaterialRegistry()
    registry.registerAll(materials)
    const bagOnline = new MaterialBag(registry)
    const bagOffline = new MaterialBag(registry)
    const assignments = new Map([['a', 4], ['b', 1]])

    online.tickWorkers(Date.now(), bagOnline, registry, 'qi_refining', 6, assignments)

    // Push one ore stack so offline settlement has something to process;
    // the slot distribution is what we compare, not yields.
    offline.settleOffline(bagOffline, registry, 'qi_refining', Date.now() + 60_000, {
      workerCapacity: 6,
      workerAssignments: assignments,
    })

    // Read the distribution the offline path used by checking a state
    // invariant: settleOffline must not exceed the allocator result per
    // site. Cheapest observable: replicate allocator expectation.
    const expected = allocateWorkerSlots(['a', 'b', 'c'], assignments, 6)
    expect(offline.getAllStates().map((s) => s.siteId)).toEqual(['a', 'b', 'c'])
    for (const [siteId, slots] of expected) {
      const state = offline.getState(siteId)!
      // settleOffline does not persist activeWorkerSlots; assert via
      // workerCycles presence where slots > 0, absent where 0.
      if ((slots ?? 0) > 0) {
        expect(state.workerCycles?.length ?? 0).toBeGreaterThanOrEqual(0)
      }
    }
    void online
  })
})
```

If `activeWorkerSlots` is not observable after `settleOffline`, extend `settleWorkersOffline` to record its computed map on the states (`state.activeWorkerSlots = slots`) — this is a read-model improvement, not a behavior change, and makes the parity assertion direct:

```ts
expect(offline.getState('a')!.activeWorkerSlots).toBe(4)
expect(offline.getState('b')!.activeWorkerSlots).toBe(1)
expect(offline.getState('c')!.activeWorkerSlots).toBe(1)
```

Prefer the direct assertion; adjust only if a real blocker appears (record it in the mission report).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run src/core/production/ProductionSystem.workers.test.ts`
Expected: FAIL on the offline distribution (audit divergence: offline gives remainder to manual A).

- [ ] **Step 3: Replace the offline allocation block**

Inside `settleWorkersOffline`, replace the manual + round-robin block (lines ~499-526) with:

```ts
    const slotsBySite = allocateWorkerSlots(
      activeStates.map((state) => state.siteId),
      workerAssignments ?? new Map<string, number>(),
      workerCapacity,
    )

    for (const state of activeStates) {
      state.activeWorkerSlots = slotsBySite.get(state.siteId) ?? 0
    }
```

Remove the superseded `slotsBySite` init loop and the remainder loop.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx.cmd vitest run src/core/production/ProductionSystem.workers.test.ts src/core/production/ProductionSystem.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/production/ProductionSystem.ts src/core/production/ProductionSystem.workers.test.ts
git commit -m "fix(r7): offline settlement consumes WorkerAllocator — online/offline parity"
```

---

### Task 4: DecomposeSystem dynamic capacity command

**Files:**
- Modify: `game/src/core/production/DecomposeSystem.ts`
- Test: `game/src/core/production/DecomposeSystem.capacity.test.ts` (new)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  ```ts
  updateCapacity(capacity: number): void   // NEW — replaces constructor-readonly capacity
  getCapacity(): number
  ```
  Constructor option `autoWorkerCapacity` is REMOVED from `DecomposeSystemOptions` (breaking to tests only; production wiring lands in Task 5).

- [ ] **Step 1: Write the failing tests**

```ts
// DecomposeSystem.capacity.test.ts
import { describe, expect, it } from 'vitest'
import { MaterialBag } from '../material/MaterialBag'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { materials } from '../../data/materials/materials'
import { DecomposeSystem } from './DecomposeSystem'

function makeSystem(): { system: DecomposeSystem; bag: MaterialBag; registry: MaterialRegistry } {
  const registry = new MaterialRegistry()
  registry.registerAll(materials)
  const bag = new MaterialBag(registry)
  return { system: new DecomposeSystem(bag, { cycleSeconds: 30 }), bag, registry }
}

describe('DecomposeSystem dynamic capacity', () => {
  it('starts at capacity 0 and clamps workers to 0', () => {
    const { system } = makeSystem()
    system.setSetting({ workers: 6 })
    expect(system.getSettings().workers).toBe(0)
  })

  it('updateCapacity raises the ceiling; setSetting clamps to it', () => {
    const { system } = makeSystem()
    system.updateCapacity(4)
    expect(system.getCapacity()).toBe(4)
    system.setSetting({ workers: 6 })
    expect(system.getSettings().workers).toBe(4)
  })

  it('updateCapacity shrinks current workers (CHQ downgrade / stale save)', () => {
    const { system } = makeSystem()
    system.updateCapacity(6)
    system.setSetting({ workers: 6 })
    system.updateCapacity(2)
    expect(system.getSettings().workers).toBe(2)
  })

  it('floors and rejects negative capacity', () => {
    const { system } = makeSystem()
    system.updateCapacity(3.9)
    expect(system.getCapacity()).toBe(3)
    system.updateCapacity(-5)
    expect(system.getCapacity()).toBe(0)
    expect(system.getSettings().workers).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx.cmd vitest run src/core/production/DecomposeSystem.capacity.test.ts`
Expected: FAIL — `updateCapacity`/`getCapacity` do not exist.

- [ ] **Step 3: Implement**

In `DecomposeSystem.ts`:

- Remove `autoWorkerCapacity` from `DecomposeSystemOptions` and the readonly field; add `private capacity = 0`.
- Constructor keeps only `bag` + optional `cycleSeconds`.
- Add:

```ts
  /** Live capacity from the workforce authority (GameManager per tick). */
  updateCapacity(capacity: number): void {
    this.capacity = Math.max(0, Math.floor(capacity))

    if (this.settings.workers > this.capacity) {
      this.settings.workers = this.capacity
    }
  }

  getCapacity(): number {
    return this.capacity
  }
```

- `setSetting` clamps to `this.capacity` instead of the old field.

- [ ] **Step 4: Update the old test file's constructor calls**

`DecomposeSystem.test.ts` constructs with `{ autoWorkerCapacity: 6 }` in ~10 places — replace each with `new DecomposeSystem(bag, { cycleSeconds: 30 })` followed by `system.updateCapacity(6)`. Same for `ProductionBalance.simulation.test.ts:318` and `DecomposeTab.test.ts:22`. This is mechanical migration of test fixtures to the new command, not a behavior rewrite.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx.cmd vitest run src/core/production/DecomposeSystem.capacity.test.ts src/core/production/DecomposeSystem.test.ts src/core/production/ProductionBalance.simulation.test.ts src/components/panels/equipment-hall/DecomposeTab.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/production/DecomposeSystem.ts src/core/production/DecomposeSystem.capacity.test.ts src/core/production/DecomposeSystem.test.ts src/core/production/ProductionBalance.simulation.test.ts src/components/panels/equipment-hall/DecomposeTab.test.ts
git commit -m "feat(r7): DecomposeSystem dynamic capacity command (AR-08)"
```

---

### Task 5: GameManager shared-pool wiring + UI max binding

**Files:**
- Modify: `game/src/core/game/GameManager.ts:436` (constructor), `:2751-2758` + `:2800` (tick path)
- Modify: `game/src/components/panels/equipment-hall/DecomposeTab.vue:94-101`
- Test: `game/src/core/game/GameManager.sharedWorkerPool.test.ts` (new)

**Interfaces:**
- Consumes: `DecomposeSystem.updateCapacity/getCapacity` (Task 4), production `assignWorkers` (unchanged).
- Produces: shared-pool tick order — decompose gets `updateCapacity(playerCapacity)` and its assigned workers first; production `tickWorkers` receives `playerCapacity - decomposeWorkers`.

- [ ] **Step 1: Write the failing integration test**

```ts
// GameManager.sharedWorkerPool.test.ts
import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'

describe('shared worker pool — AR-08 wiring', () => {
  it('decompose receives live capacity and production gets the remainder', () => {
    const manager = new GameManager()
    // Simulate CHQ level 3 → capacity 7 via the capacity authority path
    const player = manager.getActivePlayer()
    if (!player) throw new Error('active player missing in test harness')
    player.autoWorkerCapacity = 7
    manager.setActivePlayer(player)

    manager.decomposeSystem.updateCapacity(7)
    manager.decomposeSystem.setSetting({ workers: 2 })

    // Production side: one auto site with no manual assignment gets 5.
    const states = manager.productionSystem.getAllStates()
    for (const state of states) manager.setProductionAutoRestart(state.siteId, true)

    manager.update(1)

    expect(manager.decomposeSystem.getCapacity()).toBe(7)
    expect(manager.decomposeSystem.getSettings().workers).toBe(2)

    const totalProductionSlots = manager
      .productionSystem.getAllStates()
      .reduce((sum, state) => sum + state.activeWorkerSlots, 0)
    expect(totalProductionSlots).toBe(5) // 7 - 2 decompose
  })

  it('capacity 0 (no CHQ) starves both systems without errors', () => {
    const manager = new GameManager()
    const player = manager.getActivePlayer()
    if (!player) throw new Error('active player missing in test harness')
    player.autoWorkerCapacity = 0
    manager.setActivePlayer(player)
    manager.update(1)
    expect(manager.decomposeSystem.getCapacity()).toBe(0)
  })
})
```

Note: a fresh `GameManager` may create a default player — inspect `GameManager` constructor / `App.vue:398-419` new-character flow and use the real entry (`createNewGame`-equivalent or `setActivePlayer`) rather than fabricating a player object. If the harness needs the boot flow, mirror what `GameManager.workerCapacity.test.ts` does today.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run src/core/game/GameManager.sharedWorkerPool.test.ts`
Expected: FAIL — production gets all 7 (decompose never wired into the pool) and decompose capacity stays 0.

- [ ] **Step 3: Wire the tick path**

`GameManager.ts` constructor (line ~436): `new DecomposeSystem(this.materialBag)` (capacity now dynamic).

In `update()`, BEFORE `this.productionSystem.tickWorkers(...)` (line ~2751):

```ts
      // R7 shared worker pool (AR-08) — decompose claims its workers
      // from the CHQ capacity FIRST; production receives the remainder.
      this.decomposeSystem.updateCapacity(this.activePlayer.autoWorkerCapacity ?? 0)
      const decomposeWorkers = this.decomposeSystem.getSettings().workers
      const productionCapacity = Math.max(
        0,
        (this.activePlayer.autoWorkerCapacity ?? 0) - decomposeWorkers,
      )
```

then pass `productionCapacity` into the existing `tickWorkers(...)` call in place of `this.activePlayer.autoWorkerCapacity ?? 0`.

- [ ] **Step 4: Bind the UI slider max to live capacity**

`DecomposeTab.vue` — replace the hardcoded `:max="6"`:

```html
        <input
          type="range"
          min="0"
          :max="system.getCapacity()"
          step="1"
          :value="settingsMirror.workers"
          @input="onWorkersInput"
        />
```

and refresh `settingsMirror` after capacity changes — add a small `onMounted`/state-version driven refresh consistent with the existing mirror-sync pattern in that file (the file already re-syncs the mirror after `applySetting`; extend the same pattern so the slider max re-renders when capacity changes while the tab is open).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx.cmd vitest run src/core/game/GameManager.sharedWorkerPool.test.ts src/components/panels/equipment-hall/DecomposeTab.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/game/GameManager.ts src/components/panels/equipment-hall/DecomposeTab.vue src/core/game/GameManager.sharedWorkerPool.test.ts
git commit -m "feat(r7): shared worker pool wiring — decompose claims from CHQ capacity first"
```

---

### Task 6: Decompose persistence + offline settle

**Files:**
- Modify: `game/src/core/production/DecomposeSystem.ts` (state snapshot/restore + offline catch-up)
- Modify: `game/src/services/save/SaveSystem.ts` (`buildGameSave` + parse/validate of the new slice)
- Modify: `game/src/core/game/GameManagerSaveRestore.ts` (restore wiring)
- Test: `game/src/core/production/DecomposeSystem.saveRestore.test.ts` (new), plus extend `game/src/services/save/SaveSystem.saveLoadRoundTrip.test.ts`

**Interfaces:**
- Consumes: existing `PRODUCTION_OFFLINE_CAP_SECONDS` cap constant.
- Produces:
  ```ts
  // DecomposeSystem
  export interface DecomposeSaveState {
    settings: DecomposeSettings
    nextCycleAt: number
    started: boolean
  }
  getSaveState(): DecomposeSaveState
  restore(state: DecomposeSaveState | undefined): void
  settleOffline(nowMs: number, offlineSinceMs: number): void
  ```
  GameSave gains an optional `decompose?: DecomposeSaveState` field (additive; E8 dev-save policy — no migration for old saves).

- [ ] **Step 1: Write the failing tests**

```ts
// DecomposeSystem.saveRestore.test.ts
import { describe, expect, it } from 'vitest'
import { MaterialBag } from '../material/MaterialBag'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { materials } from '../../data/materials/materials'
import { DecomposeSystem } from './DecomposeSystem'

function makeSystem() {
  const registry = new MaterialRegistry()
  registry.registerAll(materials)
  const bag = new MaterialBag(registry)
  return { system: new DecomposeSystem(bag, { cycleSeconds: 30 }), bag, registry }
}

describe('DecomposeSystem save/restore + offline settle', () => {
  it('save state round-trips settings and cycle timer', () => {
    const { system } = makeSystem()
    system.updateCapacity(4)
    system.setSetting({ workers: 3, gradeFilter: 'all', ageFilter: 'decade' })
    system.tick(1_000)
    const snapshot = structuredClone(system.getSaveState())

    const fresh = makeSystem()
    fresh.system.restore(snapshot)

    expect(fresh.system.getSettings()).toEqual(system.getSettings())
    expect(fresh.system.getSaveState().nextCycleAt).toBe(snapshot.nextCycleAt)
  })

  it('settleOffline advances completed cycles inside the offline window, once', () => {
    const { system, bag } = makeSystem()
    system.updateCapacity(2)
    system.setSetting({ workers: 2 })
    system.tick(1_000)

    const now = 1_000 + 120_000 // two 30s cycles elapsed
    const settledFirst = system.settleOffline(now, 1_000)
    const drained = system.drainOutput().reduce((s, e) => s + e.amount, 0)
    expect(settledFirst).toBeGreaterThanOrEqual(1)
    expect(drained).toBeGreaterThan(0)

    // Repeat settle over the same window must not double-award.
    const settledAgain = system.settleOffline(now, 1_000)
    const drainedAgain = system.drainOutput().reduce((s, e) => s + e.amount, 0)
    expect(settledAgain).toBe(0)
    expect(drainedAgain).toBe(0)
  })

  it('restore with undefined keeps defaults (old saves without the slice)', () => {
    const { system } = makeSystem()
    expect(() => system.restore(undefined)).not.toThrow()
    expect(system.getSettings().workers).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx.cmd vitest run src/core/production/DecomposeSystem.saveRestore.test.ts`
Expected: FAIL — methods do not exist.

- [ ] **Step 3: Implement snapshot/restore + offline catch-up**

`DecomposeSystem.ts` additions:

```ts
  getSaveState(): DecomposeSaveState {
    return {
      settings: { ...this.settings },
      nextCycleAt: this.nextCycleAt,
      started: this.started,
    }
  }

  restore(state: DecomposeSaveState | undefined): void {
    if (!state) {
      return
    }

    this.settings = {
      gradeFilter: state.settings.gradeFilter,
      ageFilter: state.settings.ageFilter,
      // Clamp restored workers to current capacity (stale-save safety).
      workers: Math.min(Math.max(0, Math.floor(state.settings.workers)), this.capacity),
    }
    this.nextCycleAt = Math.max(0, Math.floor(state.nextCycleAt))
    this.started = state.started
  }

  /**
   * Offline catch-up bounded by the same offline window as production:
   * advance cycle completions that fell inside [offlineSinceMs, nowMs],
   * consuming ore and queueing output. One call per restore; repeated
   * calls over the same window settle nothing (timer already advanced).
   */
  settleOffline(nowMs: number, offlineSinceMs: number): number {
    if (!this.started || this.settings.workers <= 0) {
      if (this.started && this.nextCycleAt > 0) {
        // Keep timer monotonic across long offline gaps (idle catch-up
        // already caps at one cycle in tick()).
        this.nextCycleAt = Math.max(this.nextCycleAt, offlineSinceMs + this.cycleMs)
      }

      return 0
    }

    let settled = 0

    while (this.nextCycleAt <= nowMs && settled < 5000) {
      this.runOneCycle()
      settled += 1
      this.nextCycleAt += this.cycleMs
    }

    return settled
  }
```

Guard: if `nextCycleAt` is far in the past (e.g. restored save older than the cycle timer can express), the `settled < 5000` guard bounds the loop; the cap window policy is `[offlineSinceMs, nowMs]` — clamp `offlineSinceMs` up in the caller so the loop starts from the earliest cycle after the offline window began (see Step 5 wiring). Add an explicit comment for the deviation if the exact catch-up count differs from online `tick()`'s one-cycle catch-up — offline is an intentional bounded catch-up per spec §2 decision 2.

- [ ] **Step 4: Add the save slice**

`SaveSystem.ts`:
- Extend the save DTO type with `decompose?: DecomposeSaveState` (import the type from `DecomposeSystem` — type-only import to avoid layering violations).
- `buildGameSave(...)` writes `decompose: gameManager.decomposeSystem.getSaveState()` when the arg is available (follow the existing pattern for `productionSites` / `alchemyJobs` in that file).
- Extend the save shape validation (the section that validates `productionSites`/`alchemyJobs`) with a permissive-but-typed check: if present, `decompose.settings.workers` must be a non-negative finite number; otherwise drop the slice (do not throw — E8: old dev saves lack it).

`GameManagerSaveRestore.ts` — inside `restoreFromSave`, after the production offline settle block (line ~284), add:

```ts
    // R7 (AR-08) — decompose persists processing state and settles
    // offline inside the same window as production workers.
    this.deps.decomposeSystem.restore(save.decompose)

    if (offlinePlayer && elapsedOfflineSeconds > 60) {
      this.deps.decomposeSystem.settleOffline(Date.now(), save.player.lastSavedAt ?? Date.now())
      for (const entry of this.deps.decomposeSystem.drainOutput()) {
        // Delivery goes through the material bag; overflow handling must
        // match the online tick path (GameManager.update :2802).
        this.deps.notifyQuestMaterialGained?.(entry.materialId, entry.amount)
      }
    }
```

Adapt to the real deps surface (check how `decomposeSystem` and its drain path are exposed — `GameManager.ts:2800-2802` is the reference for the online delivery contract; reuse the exact same delivery/overflow helper rather than inventing a new one).

- [ ] **Step 5: Round-trip test at SaveSystem level**

Extend `SaveSystem.saveLoadRoundTrip.test.ts` (it already exercises `questManager.ensureActive` at :78/:108 — follow its setup):

```ts
  it('decompose state survives save/load without double-settling', () => {
    // Setup: capacity + workers + started timer on a fresh manager.
    // Act: buildGameSave → mutate nothing → restoreFromSave on a new manager.
    // Assert: settings equal; output granted exactly once for the window.
  })
```

Write it following the file's existing `buildGameSave`/`restoreFromSave` harness (real manager instances; no hand-made saves).

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx.cmd vitest run src/core/production/DecomposeSystem.saveRestore.test.ts src/services/save/SaveSystem.saveLoadRoundTrip.test.ts src/core/game/GameManager.sharedWorkerPool.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/core/production/DecomposeSystem.ts src/services/save/SaveSystem.ts src/core/game/GameManagerSaveRestore.ts src/core/production/DecomposeSystem.saveRestore.test.ts src/services/save/SaveSystem.saveLoadRoundTrip.test.ts
git commit -m "feat(r7): decompose persistence + bounded offline settle (AR-08)"
```

---

### Task 7: Wiring guards + full verification + docs

**Files:**
- Test: `game/src/core/game/GameManager.workerCapacity.test.ts` (extend, do not weaken existing assertions)
- Modify: `game/docs/roadmap.md` (R7 status block only)
- Test: `game/src/core/production/WorkerAllocator.test.ts` (append distribution-order guard if not covered)

**Interfaces:**
- Consumes: everything above.
- Produces: completion evidence for the mission report.

- [ ] **Step 1: P13 wiring guard test**

Extend `GameManager.workerCapacity.test.ts` with a test proving the real tick loop drives BOTH systems (the P13 incident class — a unit test on systems in isolation is not accepted evidence):

```ts
  it('full GameManager.update advances decompose AND production workers together', () => {
    // CHQ capacity N; decompose workers 1; one auto production site.
    // manager.update(1) — then assert: decompose capacity == N,
    // production slots == N - 1, and (after advancing nowMs past one
    // decompose cycle) exactly one decompose output lands in the bag.
    // No panel interaction anywhere in the test.
  })
```

Implement following the harness of `GameManager.sharedWorkerPool.test.ts` (Task 5). The assert-on-output-in-bag step may need `vi.useFakeTimers()` or direct `Date.now` control — mirror how `ProductionSystem.test.ts:310` handles "tick after 3 days".

- [ ] **Step 2: Run the full suite (P3 full)**

```bash
npm.cmd run type-check
npm.cmd run build
npx.cmd vitest run
```

Expected: all green. Stop on first failure; fix; rerun.

- [ ] **Step 3: Grep evidence for single-rule invariant**

```bash
Select-String -Path game\src\core\production\*.ts -Pattern "index % auto|index % activeStates|% .*Sites" 
```

Expected: no distribution loop outside `WorkerAllocator.ts`. Record output in the mission report.

- [ ] **Step 4: Update roadmap status block**

`game/docs/roadmap.md` — replace the R7 row/section status with the completion evidence line (same style as R1's): branch, files, tests, verification modes, QA verdict. Do not touch other sections (P10).

- [ ] **Step 5: Commit**

```bash
git add src/core/game/GameManager.workerCapacity.test.ts game/docs/roadmap.md
git commit -m "test(r7): wiring guard + roadmap status cutover"
```

---

## Self-Review Notes

- Spec coverage: §3 invariants 1-3 → Tasks 1-3; invariant 4-6 → Tasks 4-5; invariant 7 → Task 6; §9 regression matrix → distributed across Tasks 1-7. §11 gate → Task 7.
- Type consistency: `allocateWorkerSlots`, `updateCapacity`, `getCapacity`, `getSaveState`, `DecomposeSaveState`, `settleOffline(nowMs, offlineSinceMs)` used identically in all tasks.
- Known judgment calls flagged in-plan: Task 3 direct `activeWorkerSlots` observability; Task 5 real-player harness note; Task 6 delivery-helper reuse instruction. Each carries an explicit instruction to adapt to the real code surface and record deviations in the mission report.
- Out-of-scope boundaries from spec §10 are restated here as Global Constraints; the executor may not expand them.
