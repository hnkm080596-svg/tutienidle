# Mission D — Worker Economy Authority Implementation Plan

**STATUS: MERGED** (2026-09-17, merge `bfaa9dc6` → master)

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One workforce authority — workers are required fuel for all production; the manual `activeCycle` path is deleted end-to-end; the UI renders the domain's read model; realms above the beta scope clamp to the top supported territory tier; decompose never catch-up-bursts.

**Architecture:** `ProductionSystem` stays the domain owner. `WorkerAllocator` + `WorkerLaneAdvance` are the already-shared primitives — do NOT build a second allocation/advancement loop. New owners added by this mission: `resolveProductionWorkerCapacity` (one split rule, `WorkerCapacity.ts`), `buildWorkforceView`/`getWorkforceView` (one read model, `WorkforceView.ts` + `GameManagerBuildingOps`), `resolveTerritoryTier` (one realm→tier clamp, `ProductionCatalog.ts`).

**Tech Stack:** TypeScript, Vue 3 (panel rewire), Pinia, Vitest.

**Spec:** `docs/specs/2026-09-16-audit-remediation-spec.md` Mission D (decisions locked: workers-as-fuel, clamp-to-top-tier, HUD+panel controls). Audit: `docs/qa/2026-09-16-full-project-scout-audit.md` T3-17, T3-18, T4-29, T4-30, T5-47 (worker parts), N-02.

**Baseline note (read first):** Mission A is **already merged on master** (commits `a90a2613`..`9c518ca8`): `ProductionSiteStateSave` carries `assignedWorkers`, the serializer emits it, `saveShapeValidation.ts` has `validateProductionSitesSave` with an `activeCycle` element branch, `ProductionSystem.restoreStates` already has the `siteDefinitionsById` guard (MA-R1-04), and `DecomposeSystem.tick` already anchors to `nowMs` (MA-R3-01/02). All line refs in this plan were verified against that post-A tree; Task 5 is regression-pinning only (no code change).

## Global Constraints

- **Dev-stage rule:** no live players — remove the manual cycle path outright. No deprecation bridge, no old-save migration. A stale `activeCycle` key inside `productionSites` is tolerated by the validator as an unknown field and dropped by the domain whitelist on restore (see Task 3).
- **D3 decision (locked):** workers required for production — `activeCycle` deleted; `workerCycles` is the only cycle kind; lane count = `activeWorkerSlots` exactly; no implicit extra lane.
- **D2 decision (locked):** realm→tier resolution clamps at one boundary to the top supported territory tier (`foundation_establishment`); extension point documented; no higher-tier territory content created.
- **D1 decision (locked):** one read model `{ total, reserved, available, requested, effective, idle }`; the panel renders it verbatim and never recomputes capacity or the worker split.
- **A2/A5/A9:** one allocation owner (`WorkerAllocator`), one split rule (`resolveProductionWorkerCapacity`), one realm clamp (`resolveTerritoryTier`). `GameManager*` ops orchestrate; they do not re-derive.
- P8: no `any` — narrow with `unknown` + guards where needed. P15: English ASCII comments in `.ts`/`.vue` — write `-` not `—` inside code comments (this document uses em-dashes in prose; code snippets must emit ASCII only). P16: new UI strings via `t()`, added to BOTH `src/locales/vi.json` and `src/locales/en.json` (`tests/architecture/i18nKeyParity.test.ts` guards parity).
- Use `rg` (ripgrep) for grep-verification gates, not `grep -rn` — Windows checkout, POSIX `grep` may not exist.
- When deleting functions/fields, also remove imports they orphaned — `tsconfig` has no `noUnusedLocals`, so type-check will NOT catch dead imports (known orphans in Task 3: `buildProductionCycle as buildCycle` at `ProductionSystem.ts:35`, `PRODUCTION_OFFLINE_CAP_SECONDS` at :25 — and the `restartCycleMs` harness option in `ProductionOffline.test.ts`).
- P13: the production tick path is wiring-critical — the `GameManager.workerCapacity.test.ts` "full update advances decompose AND production workers together" guard must stay green (it becomes the wiring guard for the workers-only path).
- Verification per task (P3 quick): `npm run type-check` + `npx vitest run <task scope>`.
- Worktree: `.agent-worktrees/worker-economy` (branch `refactor/worker-economy`).

---

### Task 1: Shared worker-pool split (spec D5, audit T4-30 + T5-47 worker part)

The rule "decompose claims `workers` from the CHQ pool first; production gets the remainder" is currently inlined twice: `GameManagerTickOps.ts:155-159` (online tick) and `GameManagerSaveRestore.ts:407-411` (offline restore settle). Extract the ONE owner — the workforce view in Task 2 consumes the same helper.

**Files:**
- Modify: `src/core/production/WorkerCapacity.ts` (add the split helper next to `getWorkerCapacityForLevel`)
- Modify: `src/core/game/GameManagerTickOps.ts` (production block ~:150-168)
- Modify: `src/core/game/GameManagerSaveRestore.ts` (restore-settle split ~:417-421)
- Test: `src/core/production/WorkerCapacity.test.ts` (extend), `src/core/game/GameManagerSaveRestore.boundary.test.ts` (parity test)

**Interfaces:**
- Produces: `resolveProductionWorkerCapacity(totalWorkerCapacity: number, decomposeWorkers: number): number` — pure, floors/clamps, never negative.

- [ ] **Step 1: Failing tests** — in `WorkerCapacity.test.ts`:

```ts
import { getWorkerCapacityForLevel, resolveProductionWorkerCapacity } from './WorkerCapacity'

describe('resolveProductionWorkerCapacity — ONE split rule (Mission D / spec D5)', () => {
  it('decompose claims its workers first; production gets the remainder', () => {
    expect(resolveProductionWorkerCapacity(7, 2)).toBe(5)
    expect(resolveProductionWorkerCapacity(3, 3)).toBe(0)
    expect(resolveProductionWorkerCapacity(0, 0)).toBe(0)
  })

  it('never negative: a stale decompose reservation above the pool yields 0, not debt', () => {
    expect(resolveProductionWorkerCapacity(3, 10)).toBe(0)
    expect(resolveProductionWorkerCapacity(0, 4)).toBe(0)
  })

  it('non-finite / fractional inputs floor defensively', () => {
    expect(resolveProductionWorkerCapacity(Number.NaN, 2)).toBe(0)
    expect(resolveProductionWorkerCapacity(5.9, 1.9)).toBe(4)
    expect(resolveProductionWorkerCapacity(5, Number.NaN)).toBe(5)
  })
})
```

In `GameManagerSaveRestore.boundary.test.ts` — reuse the file's `makeManager()` / `baseSave(player, overrides)` helpers and its existing Pinia setup. Add `import { resolveProductionWorkerCapacity } from '../production/WorkerCapacity'`:

```ts
it('restore settle receives the SAME pool the online tick computes (spec D5 — one rule, no second copy)', () => {
  const manager = makeManager()
  const player = createDefaultPlayer()
  player.autoWorkerCapacity = 7
  manager.setActivePlayer(player)

  // Prime live decompose capacity so the restored workers value survives its clamp.
  manager.decomposeSystem.updateCapacity(7)

  const spy = vi.spyOn(manager.productionSystem, 'settleOffline')

  manager.saveOps.restoreFromSave(
    baseSave(player, {
      player: { ...player, lastSavedAt: Date.now() - 7_200_000 }, // >60s gate -> offline settle runs
      productionSites: [
        { siteId: 'thanh_van_lam', level: 1, autoRestart: true, assignedWorkers: 5 },
      ],
      decompose: {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 2 },
        nextCycleAt: 0,
        started: false,
      },
    }),
  )

  expect(spy).toHaveBeenCalledTimes(1)
  // Asserting against the helper itself (not a literal) is the point:
  // both paths MUST consume the same rule.
  expect(spy.mock.calls[0]![4]?.workerCapacity).toBe(resolveProductionWorkerCapacity(7, 2))
})
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run src/core/production/WorkerCapacity.test.ts src/core/game/GameManagerSaveRestore.boundary.test.ts`) — helper does not exist yet.

- [ ] **Step 3: Implement**

In `WorkerCapacity.ts`, append (English ASCII comments per P15):

```ts
/**
 * Mission D (spec D5) — the ONE worker-pool split rule: decompose
 * claims `decomposeWorkers` from the CHQ pool FIRST; production
 * receives the remainder. Consumed by the online tick
 * (GameManagerTickOps), the offline restore settle
 * (GameManagerSaveRestore) and the UI read model (WorkforceView).
 * Callers never recompute `total - workers` inline (A9).
 */
export function resolveProductionWorkerCapacity(
  totalWorkerCapacity: number,
  decomposeWorkers: number,
): number {
  const total = Number.isFinite(totalWorkerCapacity)
    ? Math.max(0, Math.floor(totalWorkerCapacity))
    : 0

  const reserved = Number.isFinite(decomposeWorkers)
    ? Math.max(0, Math.floor(decomposeWorkers))
    : 0

  return Math.max(0, total - reserved)
}
```

In `GameManagerTickOps.ts` — add `import { resolveProductionWorkerCapacity } from '../production/WorkerCapacity'` and replace lines ~150-168:

```ts
// R7 (AR-08) shared worker pool - decompose claims its workers
// from the CHQ capacity FIRST; production receives the remainder via
// the ONE split rule (Mission D / spec D5) - the same helper the
// restore path uses (GameManagerSaveRestore).
this.deps.decomposeSystem.updateCapacity(activePlayer.autoWorkerCapacity ?? 0)
const productionCapacity = resolveProductionWorkerCapacity(
  activePlayer.autoWorkerCapacity ?? 0,
  this.deps.decomposeSystem.getSettings().workers,
)

this.deps.productionSystem.tickWorkers(
  Date.now(),
  this.deps.materialBag,
  this.deps.materialRegistry,
  activePlayer.realmId,
  productionCapacity,
  this.deps.getWorkerAssignments(),
)
```

In `GameManagerSaveRestore.ts` — add the same import (path `../production/WorkerCapacity`) and replace the inline `Math.max(0, (offlinePlayer.autoWorkerCapacity ?? 0) - this.deps.decomposeSystem.getSettings().workers)` at ~:407-411:

```ts
workerCapacity: resolveProductionWorkerCapacity(
  offlinePlayer.autoWorkerCapacity ?? 0,
  this.deps.decomposeSystem.getSettings().workers,
),
```

- [ ] **Step 4: Run — expect PASS** (`npx vitest run src/core/production src/core/game`) + `npm run type-check`.
- [ ] **Step 5: Commit** `git add -A && git commit -m "refactor(production): single worker-pool split rule for online/offline"`

---

### Task 2: Workforce read model + panel rewire (spec D1, audit T4-29)

`ProductionPanel.vue` today keeps a local `workerMode` ref (:216), reads `player.autoWorkerCapacity` directly (:218), and sliders max to the TOTAL pool — decompose's reservation is invisible (T4-29/T4-30 UI half). Replace all of it with the domain read model.

**Files:**
- Create: `src/core/production/WorkforceView.ts` (interface + pure builder)
- Modify: `src/core/game/GameManagerBuildingOps.ts` (add `decomposeSystem` dep + `getWorkforceView()`; `assignWorkers` clamps to the available pool)
- Modify: `src/core/game/GameManager.ts` (~:669-679, add `decomposeSystem: this.decomposeSystem` to `buildingOps` deps — the field exists at :338)
- Modify: `src/components/panels/ProductionPanel.vue` (consume the view; delete the local ref)
- Modify: `src/locales/vi.json`, `src/locales/en.json` (new key `panels.production.workersReserved`)
- Test: `src/core/production/WorkforceView.test.ts` (new), `src/core/game/GameManager.workerCapacity.test.ts` (extend), `src/components/panels/ChiHienQuan.integration.test.ts` (extend)

**Interfaces:**
- Produces: `WorkforceView = { total: number; reserved: number; available: number; requested: Record<string, number>; effective: Record<string, number>; idle: number }` — `requested` = player-written `assignedWorkers` per site (absent = auto); `effective` = last allocator grant (`activeWorkerSlots`) per site; `idle` = `available - sum(effective)` floored at 0.
- Produces: `GameManagerBuildingOps.getWorkforceView(): WorkforceView`.

- [ ] **Step 1: Failing tests**

`src/core/production/WorkforceView.test.ts` (new):

```ts
import { describe, expect, it } from 'vitest'
import { buildWorkforceView } from './WorkforceView'
import type { ProductionSiteState } from './ProductionTypes'

function state(siteId: string, overrides: Partial<ProductionSiteState> = {}): ProductionSiteState {
  return {
    siteId,
    level: 1,
    autoRestart: true,
    activeWorkerSlots: 0,
    workerCycles: [],
    ...overrides,
  }
}

describe('buildWorkforceView (Mission D / spec D1)', () => {
  it('total/reserved/available come from the one split rule', () => {
    const view = buildWorkforceView(7, 2, [])
    expect(view.total).toBe(7)
    expect(view.reserved).toBe(2)
    expect(view.available).toBe(5)
  })

  it('requested (player intent) and effective (allocator grant) stay distinct; idle is the domain remainder', () => {
    const view = buildWorkforceView(7, 2, [
      state('thanh_van_lam', { assignedWorkers: 4, activeWorkerSlots: 3 }),
      state('thanh_van_quang', { activeWorkerSlots: 2 }),
    ])
    // Requested 4 but the allocator only granted 3 - the UI must not
    // conflate the two (slider shows requested, workers line shows effective).
    expect(view.requested).toEqual({ thanh_van_lam: 4 })
    expect(view.effective).toEqual({ thanh_van_lam: 3, thanh_van_quang: 2 })
    expect(view.idle).toBe(0) // 5 available - 5 granted
  })

  it('no states -> everything idle; non-finite totals floor to 0', () => {
    expect(buildWorkforceView(Number.NaN, 1, [])).toEqual({
      total: 0, reserved: 1, available: 0, requested: {}, effective: {}, idle: 0,
    })
    const view = buildWorkforceView(5, 0, [state('thanh_van_lam')])
    expect(view.idle).toBe(5)
  })
})
```

`GameManager.workerCapacity.test.ts` — extend the `assignWorkers` describe (reuse `managerWithChq`):

```ts
it('getWorkforceView: total from CHQ capacity, reserved from decompose, requested vs effective distinct', () => {
  const { manager, siteId } = managerWithChq(3) // total 7
  manager.decomposeSystem.updateCapacity(7)
  manager.decomposeSystem.setSetting({ workers: 2 })
  manager.buildingOps.assignWorkers(siteId, 4)

  const view = manager.buildingOps.getWorkforceView()
  expect(view.total).toBe(7)
  expect(view.reserved).toBe(2)
  expect(view.available).toBe(5)
  expect(view.requested[siteId]).toBe(4)
})

it('assignWorkers clamps to the AVAILABLE pool (total minus decompose), not the total', () => {
  const { manager, siteId } = managerWithChq(3) // total 7
  manager.decomposeSystem.updateCapacity(7)
  manager.decomposeSystem.setSetting({ workers: 4 })
  manager.buildingOps.assignWorkers(siteId, 99)
  expect(manager.productionSystem.getState(siteId)?.assignedWorkers).toBe(3)
})
```

`ChiHienQuan.integration.test.ts` — new test next to the existing allocation-block test:

```ts
it('ProductionPanel: workerMode derives from persisted assignments (no local ref); slider max = available pool', async () => {
  const deps = makeDeps(ProductionPanel)
  deps.gameManager.buildingManager.add({
    instanceId: 'outpost_inst', buildingId: 'gathering_outpost', level: 1, lastCollectedAt: 0,
  })
  deps.gameManager.buildingManager.add({
    instanceId: 'chq_inst', buildingId: 'chi_hien_quan', level: 2, lastCollectedAt: 0,
  })

  const player = usePlayerStore(deps.pinia)
  player.realmId = 'mortal'
  deps.gameManager.setActivePlayer(player.$state)
  const chq = deps.gameManager.buildingManager.getByBuildingId('chi_hien_quan')!
  deps.gameManager.buildingOps.refreshAutoWorkerCapacity(player.$state, chq) // total 5

  // Decompose holds 2 of the 5 -> production sliders max at 3.
  deps.gameManager.decomposeSystem.updateCapacity(5)
  deps.gameManager.decomposeSystem.setSetting({ workers: 2 })

  // A persisted assignment exists BEFORE mount -> the panel must derive
  // 'manual' from it (audit T4-29: the old local ref always reset to auto).
  const siteId = deps.gameManager.buildingOps.getProductionViews(Date.now())[0]!.definition.siteId
  deps.gameManager.buildingOps.assignWorkers(siteId, 2)

  deps.app.mount(deps.container)
  await nextTick()

  const radios = deps.container.querySelectorAll<HTMLInputElement>('input[name="worker-mode"]')
  expect(radios[0]!.checked).toBe(false) // auto
  expect(radios[1]!.checked).toBe(true)  // manual

  const slider = deps.container.querySelector<HTMLInputElement>('.worker-allocation__slider input[type=range]')
  expect(slider).not.toBeNull()
  expect(slider!.max).toBe('3') // available = 5 - 2, not the total 5

  deps.app.unmount()
})
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run src/core/production/WorkforceView.test.ts src/core/game/GameManager.workerCapacity.test.ts src/components/panels/ChiHienQuan.integration.test.ts`) — `buildWorkforceView`/`getWorkforceView` don't exist; `assignWorkers` still clamps to total.

- [ ] **Step 3: Implement**

Create `src/core/production/WorkforceView.ts`:

```ts
import type { ProductionSiteState } from './ProductionTypes'
import { resolveProductionWorkerCapacity } from './WorkerCapacity'

/**
 * Mission D (spec D1) — the ONE authoritative workforce view.
 * Presentation renders it verbatim and never recomputes capacity,
 * the decompose reservation, or the allocation itself (A2/A7/A9).
 */
export interface WorkforceView {
  /** Total CHQ worker capacity (autoWorkerCapacity on the player). */
  total: number

  /** Workers claimed by decompose before production sees the pool. */
  reserved: number

  /** Pool left for production: max(0, total - reserved). */
  available: number

  /** Player-requested manual assignments: siteId -> count (auto sites absent). */
  requested: Record<string, number>

  /** Last allocator grant per site: siteId -> activeWorkerSlots. */
  effective: Record<string, number>

  /** Available workers not granted to any site on the last allocation pass. */
  idle: number
}

export function buildWorkforceView(
  totalWorkerCapacity: number,
  decomposeWorkers: number,
  states: readonly ProductionSiteState[],
): WorkforceView {
  const total = Number.isFinite(totalWorkerCapacity)
    ? Math.max(0, Math.floor(totalWorkerCapacity))
    : 0

  const reserved = Number.isFinite(decomposeWorkers)
    ? Math.max(0, Math.floor(decomposeWorkers))
    : 0

  const requested: Record<string, number> = {}
  const effective: Record<string, number> = {}

  for (const state of states) {
    if (state.assignedWorkers !== undefined) {
      requested[state.siteId] = state.assignedWorkers
    }
    effective[state.siteId] = state.activeWorkerSlots
  }

  const available = resolveProductionWorkerCapacity(total, reserved)
  const used = Object.values(effective).reduce((sum, count) => sum + count, 0)

  return { total, reserved, available, requested, effective, idle: Math.max(0, available - used) }
}
```

`GameManagerBuildingOps.ts`:
- Add `decomposeSystem: DecomposeSystem` to `GameManagerBuildingOpsDeps` (type import `import type { DecomposeSystem } from '../production/DecomposeSystem'`), plus `import { buildWorkforceView, type WorkforceView } from '../production/WorkforceView'` and extend the existing `WorkerCapacity` import with `resolveProductionWorkerCapacity`.
- Add the read model:

```ts
/**
 * Mission D (spec D1) - the ONE workforce read model for the panel:
 * total/reserved/available/requested/effective/idle, all derived from
 * the same split rule the tick uses. The panel renders this verbatim;
 * it does not recompute the split (A7).
 */
getWorkforceView(): WorkforceView {
  return buildWorkforceView(
    this.deps.getActivePlayer()?.autoWorkerCapacity ?? 0,
    this.deps.decomposeSystem.getSettings().workers,
    this.deps.productionSystem.getAllStates(),
  )
}
```

- In `assignWorkers`, replace `const capacity = this.deps.getActivePlayer()?.autoWorkerCapacity ?? 0` with:

```ts
// Clamp to the production remainder, not the raw total - a slider must
// never let the player promise workers decompose already claimed.
const capacity = resolveProductionWorkerCapacity(
  this.deps.getActivePlayer()?.autoWorkerCapacity ?? 0,
  this.deps.decomposeSystem.getSettings().workers,
)
```

`GameManager.ts` — in the `new GameManagerBuildingOps({...})` literal (~:669-679) add `decomposeSystem: this.decomposeSystem,` (the readonly field at :338 is initialized earlier in the constructor flow — safe to reference here).

`ProductionPanel.vue` script — replace the `workerMode`/`workerCapacity`/`assignedTotal` block (:216-235):

```ts
// --- Workforce read model (Mission D / spec D1) ---
// The panel renders the domain's WorkforceView verbatim - no local
// capacity math, no local mode flag (audit T4-29/T4-30).
const workforce = computed(() => {
  stateVersion.value
  // Track the same tick clock `rows` reads (:96) — reserved/available/
  // effective totals and the slider :max must refresh every tick too,
  // not only on bumpState() interactions (T4-30 reintroduction guard).
  void nowMs.value
  return gameManager.buildingOps.getWorkforceView()
})

const workerMode = computed(() =>
  Object.keys(workforce.value.requested).length > 0 ? 'manual' : 'auto',
)

const assignedTotal = computed(() =>
  Object.values(workforce.value.requested).reduce((sum, count) => sum + count, 0),
)

const effectiveTotal = computed(() =>
  Object.values(workforce.value.effective).reduce((sum, count) => sum + count, 0),
)

function setWorkerMode(mode: 'auto' | 'manual') {
  if (mode === 'auto') {
    // Back to auto: clear every manual assignment.
    for (const row of rows.value) {
      gameManager.buildingOps.assignWorkers(row.siteId, undefined)
    }
  } else {
    // Entering manual snapshots the CURRENT allocator grants so the
    // sliders start from domain truth (mode is derived, so requested
    // must be non-empty for 'manual' to show).
    for (const row of rows.value) {
      gameManager.buildingOps.assignWorkers(row.siteId, workforce.value.effective[row.siteId] ?? 0)
    }
  }

  bumpState()
}
```

`ProductionPanel.vue` template:
- Header (:301): `t('panels.production.workersHeader', { used: workerMode === 'manual' ? assignedTotal : effectiveTotal, total: workforce.available })` and add directly under it:

```html
<small v-if="workforce.reserved > 0" class="worker-allocation__reserved">
  {{ t('panels.production.workersReserved', { count: workforce.reserved }) }}
</small>
```

- Slider (:333): `:max="workforce.available"` (was the raw total).
- Add a small style next to `.worker-allocation__auto-hint`: `.worker-allocation__reserved { color: var(--paper-text-soft); font-size: var(--text-xs); }`

Locales — add to `panels.production` in BOTH files (P16 + i18nKeyParity):
- `vi.json`: `"workersReserved": "Phân Giải đang giữ {count} nhân công",`
- `en.json`: `"workersReserved": "{count} workers held by Decompose",`

- [ ] **Step 4: Run — expect PASS** (same test command) + `npm run type-check` + `npx vitest run tests/architecture/i18nKeyParity.test.ts`.
- [ ] **Step 5: Commit** `git add -A && git commit -m "refactor(production): single workforce read model consumed by UI"`

---

### Task 3: Workers-as-fuel — remove the manual `activeCycle` path (spec D3, audit T3-18)

Biggest blast radius. The manual path is deleted end-to-end: domain state, lifecycle methods, offline phase, save shape/serializer/validator, game-manager ops, panel controls, tests. `workerCycles` becomes the only cycle kind; lane count is exactly `activeWorkerSlots`.

**Verified `activeCycle` consumer inventory** (grep over `src/`, post-verification — every consumer must be handled):

| Consumer | Location | Disposition |
|---|---|---|
| State field | `ProductionTypes.ts:77` (+ stale comments :74-84) | Delete field; rewrite comments |
| Manual lifecycle | `ProductionSystem.ts` `canStart` (:163-173), `startCycle` (:180-202), `tick` (:317-339) | Delete all three |
| Restore copy | `ProductionSystem.ts` `restoreStates` (:114-133) | Whitelist fields; drop `activeCycle` copy |
| Offline deps | `ProductionSystem.ts` `offlineDeps` (:453-467) `canStart`/`startCycle` | Remove both deps |
| Manual settle phase | `ProductionOffline.ts` deps (:32-34), loop (:65-108), forfeit pass (:110-123) | Delete; worker phase takes the full cap budget |
| View model | `ProductionSystem.ts` `getSiteView` (:644-652) | Progress from earliest `workerCycles` head |
| Stale JSDoc | `ProductionSystem.ts` `tickWorkers` comment (:342-343, "slot đầu tiên vẫn là activeCycle") | Rewrite |
| Online driver | `GameManagerTickOps.ts:141-148` `productionSystem.tick(...)` | Delete the call block |
| Ops facade | `GameManagerBuildingOps.ts:295-298` `startProductionCycle` | Delete |
| Boot grant | `App.vue:611` `buildingOps.startProductionCycle` in `onNewCharacter` | Delete the line; keep `setProductionAutoRestart(..., true)` |
| Panel | `ProductionPanel.vue` `start()` (:152-156), `isProducing` (:142), Start `GameButton` (:415-422), `.site-card__action` CSS (:678-680) | Delete all; `isProducing` from `workerCycles` |
| Locales | `vi.json`/`en.json` `panels.production.start` (+ `summary` mentions "bắt đầu cycle") | Remove `start` key; update `summary` text |
| Save shape | `saveTypes.ts` `ProductionSiteStateSave.activeCycle` (~:273) | Delete field |
| Serializer | `SaveSystem.ts:373` `activeCycle: state.activeCycle` | Delete line |
| Validator | `saveShapeValidation.ts` — Mission A Task 2's `if (entry.activeCycle !== undefined) validateProductionCycleSave(...)` inside `validateProductionSitesSave` | Delete the branch (`validateProductionCycleSave` stays for `workerCycles`) |
| Save version | `saveVersion.ts` | Bump to 67 with the dev-phase comment |
| Tests | `ProductionSystem.test.ts` (:118-320 manual lifecycle), `ProductionOffline.test.ts` (harness stubs + entire "manual cycle phase" describe + the manual-budget test :389-423), `SaveSystem.snapshotIsolation.test.ts` (:94-103, :126), `SaveSystem.conformance.test.ts:143` (`activeCycle` inside a `ProductionSiteState` literal — excess-property type error post-removal), `saveShapeValidation.test.ts:1787-1803` ("từ chối activeCycle có siteId khác site cha" expects rejection — post-removal the stale key is tolerated → replace with the tolerance case below; also clean `activeCycle: validCycle()` out of the `validSite()` fixture :577-586), `GameManager.overflowSurfacing.test.ts` (:153-157, :226-230), `useAppLifecycle.test.ts:83` stub key | Rewrite/remove per below |
| Doc references (NOT code consumers) | this plan, `2026-09-16-save-integrity-mission-a.md`, spec, audit, `docs/qa/audit-eslint.json` | Leave; update Mission A plan only if the coordinator wants doc coherence |

`ProductionCycles.ts` (`buildProductionCycle`) is NOT deleted — `WorkerLaneAdvance` uses it for lane respawns.

**Interfaces:**
- Produces: `ProductionSiteState = { siteId; level; autoRestart; activeWorkerSlots; workerCycles?; assignedWorkers? }` — no `activeCycle`.
- Produces: `ProductionSiteStateSave` without `activeCycle`; `ProductionCycleSave` unchanged.
- Consumes: `allocateWorkerSlots`, `advanceWorkerLanes`, `settleProductionOffline` (worker phase only).

- [ ] **Step 1: Failing tests**

`ProductionSystem.test.ts` — delete the manual-path cases (:118-320) and write the workers-as-fuel equivalents:

```ts
describe('ProductionSystem — workers-as-fuel (Mission D / spec D3)', () => {
  it('state has no activeCycle field at all — the manual lane does not exist', () => {
    const system = createSystem()
    const state = system.ensureSiteState('thanh_van_lam')
    expect('activeCycle' in state).toBe(false)
  })

  it('capacity 0 produces NOTHING online even with autoRestart on — workers are required fuel', () => {
    const { bag, registry } = createBag()
    const system = createSystem()
    system.setAutoRestart('thanh_van_lam', true)

    system.tickWorkers(60_000, bag, registry, 'mortal', 0)

    expect(system.getState('thanh_van_lam')!.workerCycles ?? []).toHaveLength(0)
    expect(bag.getAll()).toHaveLength(0)
  })

  it('capacity 0 produces NOTHING offline — no manual fallback phase', () => {
    const { bag, registry } = createBag()
    const system = createSystem()
    system.restoreStates([
      { siteId: 'thanh_van_lam', level: 1, autoRestart: true, activeWorkerSlots: 0, workerCycles: [] },
    ])

    const settled = system.settleOffline(bag, registry, 'mortal', 10_000_000, {
      workerCapacity: 0,
      offlineSinceMs: 0,
    })

    expect(settled).toBe(0)
    expect(bag.getAll()).toHaveLength(0)
  })

  it('lane count equals activeWorkerSlots exactly — 1 worker -> 1 lane, no implicit extra lane', () => {
    const { bag, registry } = createBag()
    const system = createSystem()
    system.setAutoRestart('thanh_van_lam', true)

    system.tickWorkers(1_000, bag, registry, 'mortal', 1)

    const state = system.getState('thanh_van_lam')!
    expect(state.activeWorkerSlots).toBe(1)
    expect(state.workerCycles).toHaveLength(1)
  })

  it('snapshot deadline from collectionRealmId + levelAtStart (worker lane)', () => {
    const { bag, registry } = createBag()
    const system = createSystem()
    system.setAutoRestart('thanh_van_lam', true)

    system.tickWorkers(1_000_000, bag, registry, 'qi_refining', 1)

    const cycle = system.getState('thanh_van_lam')!.workerCycles![0]!
    expect(cycle.collectionRealmId).toBe('qi_refining')
    expect(cycle.completesAtMs - cycle.startedAtMs).toBe(300 * 1000)
  })

  it('a due worker lane grants ONCE; the next tick refills the freed lane (idempotent, no double pay)', () => {
    const { bag, registry } = createBag()
    const system = createSystem()
    system.setAutoRestart('thanh_van_lam', true)

    system.tickWorkers(0, bag, registry, 'mortal', 1)
    const cycle = system.getState('thanh_van_lam')!.workerCycles![0]!
    cycle.rollSeed = 12345
    const expected = system.rollRewards(cycle).reduce((total, reward) => total + reward.amount, 0)

    system.tickWorkers(100_000, bag, registry, 'mortal', 1)
    const afterGrant = bag.getAll().reduce((total, stack) => total + stack.amount, 0)
    expect(afterGrant).toBe(expected)

    // Same instant re-tick: no second grant; the freed lane refills on
    // the NEXT observation (top-up-then-settle order).
    system.tickWorkers(100_000, bag, registry, 'mortal', 1)
    expect(bag.getAll().reduce((total, stack) => total + stack.amount, 0)).toBe(afterGrant)
  })

  it('autoRestart=false gets NO slots even with spare capacity (eligibility gate)', () => {
    const { bag, registry } = createBag()
    const system = createSystem()
    system.setAutoRestart('thanh_van_lam', false)

    system.tickWorkers(1_000, bag, registry, 'mortal', 5)

    expect(system.getState('thanh_van_lam')!.activeWorkerSlots).toBe(0)
    expect(system.getState('thanh_van_lam')!.workerCycles ?? []).toHaveLength(0)
  })

  it('getSiteView reports progress from the earliest worker lane (not a manual cycle)', () => {
    const { bag, registry } = createBag()
    const system = createSystem()
    system.setAutoRestart('thanh_van_lam', true)

    system.tickWorkers(1_000, bag, registry, 'mortal', 1)

    const view = system.getSiteView('thanh_van_lam', 1_000)!
    expect(view.cycleTotalMs).toBe(100_000)
    // The lane was seeded AT nowMs=1_000 (emptyLaneStartMs), so a full
    // 100s remains — not 99s.
    expect(view.cycleRemainingMs).toBe(100_000)
  })

  it('restoreStates drops a stale activeCycle key — tolerated, whitelisted out, never migrated', () => {
    const system = createSystem()
    const stale = {
      siteId: 'thanh_van_lam',
      level: 2,
      autoRestart: true,
      activeWorkerSlots: 0,
      workerCycles: [],
      // Pre-removal payload residue: must NOT round-trip into live state.
      activeCycle: {
        cycleId: 'old', siteId: 'thanh_van_lam', collectionRealmId: 'mortal',
        siteLevelAtStart: 1, rewardTableVersion: 1, rollSeed: 1,
        startedAtMs: 0, completesAtMs: 1,
      },
    }

    system.restoreStates([stale])

    const restored = system.getState('thanh_van_lam')!
    expect('activeCycle' in restored).toBe(false)
    expect(restored.level).toBe(2)
  })
})
```

Keep: the validator/balance describes, the two worker-offline tests (:322-391), the reward-roll sanity describes, and the "cùng collectionRealmId + level" test rewritten to drive `workerCycles` instead of `activeCycle` (spawn a lane via `tickWorkers(0, bag, registry, 'mortal', 1)`, mutate `workerCycles[0].rollSeed`, call `rollRewards`, assert `completesAtMs === computeCycleSeconds(100, 1) * 1000`).

`ProductionOffline.test.ts` — delete the whole `describe('settleProductionOffline — manual cycle phase')` (:137-295), the `canStart`/`startCycle` harness stubs and `starts` recorder, and the "pays worker cycles only from the budget left after manual settle" test (:389-423 — the shared-budget handoff it measured no longer exists; the worker budget/order tests below it stay). Add:

```ts
it('worker phase now receives the FULL cap budget (no manual consumer ahead of it)', () => {
  const states = new Map<string, ProductionSiteState>([
    [LAM, makeState(LAM, { autoRestart: true, workerCycles: [] })],
  ])
  const { deps, grants } = createHarness(states)

  // Window = exactly the cap: floor(CAP_MS / CYCLE_MS) completions all
  // paid — previously a manual cycle could consume budget first.
  const settled = settle(deps, T0 + CAP_MS, {
    workerCapacity: 1,
    offlineSinceMs: T0,
    workerAssignments: new Map([[LAM, 1]]),
  })

  expect(settled).toBe(Math.floor(CAP_MS / CYCLE_MS))
  expect(grants).toHaveLength(settled)
})
```

`SaveSystem.snapshotIsolation.test.ts` — delete the `liveSite.activeCycle = {...}` block (:94-103) and the `liveSite.activeCycle!.startedAtMs = -1` mutation (:126). `workerCycles` coverage already proves detachment.

`GameManager.overflowSurfacing.test.ts` — the two production tests (:140-267) currently `startCycle` a backdated `activeCycle`. Replace that fixture with a due worker lane (the only cycle kind post-removal):

```ts
const siteId = manager.productionSystem.getSiteDefinitions()[0]!.siteId
player.autoWorkerCapacity = 1 // one CHQ worker -> the due lane is eligible

manager.productionSystem.restoreStates([
  {
    siteId,
    level: 1,
    autoRestart: true,
    activeWorkerSlots: 0,
    workerCycles: [
      {
        cycleId: 'due_lane',
        siteId,
        collectionRealmId: player.realmId,
        siteLevelAtStart: 1,
        rewardTableVersion: 1,
        rollSeed: 42,
        startedAtMs: Date.now() - 86_400_000,
        completesAtMs: Date.now() - 1_000, // already due on the next tick
      },
    ],
  },
])

const cycle = manager.productionSystem.getState(siteId)!.workerCycles![0]!
const rewards = manager.productionSystem.rollRewards(cycle)
```

The rest of both tests is unchanged — `tickOps.update(1)` drives `tickWorkers`, which grants the due lane once.

`useAppLifecycle.test.ts:83` — delete the `startProductionCycle: vi.fn()` stub key (dead once `App.vue` stops calling it).

`saveShapeValidation.test.ts` — post-Mission-A this file gains a case "rejects `activeCycle.completesAtMs: 'x'`". Replace it with a tolerance case (dev-stage rule — unknown fields are not rejected; the domain whitelist drops them on restore):

```ts
it('a stale activeCycle key in productionSites is tolerated (removed field, dev-stage: no migration, no rejection)', () => {
  const save = validSave()
  ;(save as Record<string, unknown>).productionSites = [
    {
      siteId: 'thanh_van_lam', level: 1, autoRestart: true,
      activeCycle: { cycleId: 'old', siteId: 'thanh_van_lam', collectionRealmId: 'mortal',
        siteLevelAtStart: 1, rewardTableVersion: 1, rollSeed: 1, startedAtMs: 0, completesAtMs: 1 },
    },
  ]
  expect(validateGameSaveShape(save).ok).toBe(true)
})
```

`ChiHienQuan.integration.test.ts` — extend the existing allocation test with the removal assertion:

```ts
// Workers-as-fuel (spec D3): no Start-cycle control exists; the panel
// is pure worker allocation + auto-repeat gating.
expect(deps.container.querySelector('.site-card__action')).toBeNull()
```

- [ ] **Step 2: Run — mixed FAIL/PASS expected** (`npx vitest run src/core/production src/core/game src/services/save src/components/panels src/composables`). NOTE: several new tests already pass on the current tree — `'activeCycle' in state` is already false (`ensureSiteState` never sets it), the capacity-0 online/offline tests and the lane-count test are green today (the manual cycle is opt-in, not implicit). The genuinely-red cases are the `getSiteView` progress test, the stale-`activeCycle`-restore whitelist test, and the tolerance/conformance rewrites. Do not "fix" the green ones — they pin the contract.

- [ ] **Step 3: Implement**

`ProductionTypes.ts` — delete `activeCycle?: ProductionCycle` (:77); rewrite the stale block comments (:74-84) in English ASCII:

```ts
/** Parallel lanes the shared worker pool currently grants this site. */
activeWorkerSlots: number

/** In-flight worker lane heads — the ONLY cycle kind (Mission D / spec D3). */
workerCycles?: ProductionCycle[]

/** Player-requested assignment; undefined = AUTO (round-robin share). */
assignedWorkers?: number
```

`ProductionSystem.ts`:
- `restoreStates` — stop the `...state` spread (it smuggles foreign keys incl. legacy `activeCycle`); whitelist:

```ts
restoreStates(states: ProductionSiteState[]): void {
  this.states.clear()

  for (const state of states) {
    // KEEP this guard (added by Mission A review MA-R1-04): a save may
    // carry a siteId with no definition — orphan sites would hold
    // worker slots while producing nothing. Drop at the boundary.
    if (!this.siteDefinitionsById.has(state.siteId)) {
      continue
    }

    this.states.set(state.siteId, {
      siteId: state.siteId,
      level: state.level,
      autoRestart: state.autoRestart,
      activeWorkerSlots: state.activeWorkerSlots ?? 0,
      assignedWorkers: state.assignedWorkers,
      workerCycles: (state.workerCycles ?? []).map((cycle) => ({ ...cycle })),
    })
  }
}
```

The guard is load-bearing — removing it regresses `ProductionSystem.test.ts:479-492` ("drops states whose siteId has no definition — orphan sites must not hold worker capacity").

- Delete `canStart` (:155-165), `startCycle` (:167-194), `tick` (:303-331) entirely.
- `tickWorkers` — rewrite the JSDoc (:342-343): drop "Slot đầu tiên vẫn là activeCycle thủ công" — the truth is now "every lane comes from the pool; lane count = activeWorkerSlots". Keep the assignments paragraph (it documents `assignments`, still valid).
- `offlineDeps()` — drop `canStart`/`startCycle`; keep `states`, `getSiteDefinition`, `grantCycleRewards`.
- `settleOffline` JSDoc — remove "manual + worker" phrasing; return value is now "number of worker cycles settled".
- `getSiteView` (:636-644) — progress from the earliest lane head:

```ts
const lanes = state.workerCycles ?? []

let earliest: ProductionCycle | undefined

for (const cycle of lanes) {
  if (!earliest || cycle.completesAtMs < earliest.completesAtMs) {
    earliest = cycle
  }
}

if (earliest) {
  view.cycleTotalMs = Math.max(1, earliest.completesAtMs - earliest.startedAtMs)
  view.cycleRemainingMs = Math.max(0, earliest.completesAtMs - nowMs)
}
```

- Header comment (:1-5) — update to say production runs on worker lanes only.

`ProductionOffline.ts`:
- `ProductionOfflineDeps` — delete `canStart` + `startCycle`.
- `settleProductionOffline` — delete the manual loop (:65-108) and forfeit pass (:110-123); the body becomes:

```ts
export function settleProductionOffline(
  deps: ProductionOfflineDeps,
  bag: MaterialBag,
  registry: MaterialRegistry,
  currentRealmId: string,
  nowMs: number = Date.now(),
  options: ProductionOfflineOptions = {},
): number {
  // Mission D (spec D3) — workers-as-fuel: the manual activeCycle path
  // is gone; offline settle is exactly the worker-lane phase under the
  // full PRODUCTION_OFFLINE_CAP budget.
  return settleWorkersOffline(
    deps,
    bag,
    registry,
    currentRealmId,
    nowMs,
    PRODUCTION_OFFLINE_CAP_SECONDS * 1000,
    Math.floor(options.workerCapacity ?? 0),
    options.offlineSinceMs,
    options.workerAssignments,
  )
}
```

Update the file header comment + `settleWorkersOffline` JSDoc ("chia ngân sách còn lại sau manual settle" is stale — it now gets the full budget).

`GameManagerTickOps.ts` — delete the `this.deps.productionSystem.tick(...)` call block (:141-148) and fold its comment into the worker-pool comment above `updateCapacity`.

`GameManagerBuildingOps.ts` — delete `startProductionCycle` (:295-298).

`App.vue` (:613-617) — delete the `startProductionCycle` line; keep `setProductionAutoRestart(definition.siteId, true)`; fix the comment to note sites start producing once workers are allocated.

`ProductionPanel.vue`:
- Delete `start()` (:152-156) and the Start `GameButton` (:415-422) + `.site-card__action` CSS (:678-680).
- `isProducing` (:142) → `(view.state.workerCycles?.length ?? 0) > 0 || view.state.activeWorkerSlots > 0`.
- Update the script header comment (:16-20) — no Start button exists anymore.
- Optionally show the auto checkbox always (unchanged); when `!row.isProducing` the card simply shows no progress bar.

Locales — delete `"start"` from `panels.production` in BOTH `vi.json` (:453) and `en.json` (:453); update `summary` to drop "bắt đầu cycle" (vi suggestion: `"Khai Vật Đường khai thác nguyên liệu mọi cảnh giới — phân nhân công cho nguồn, nhận thẳng vào Túi."`; en: `"Khai Vật Đường harvests materials for every realm — assign workers to a source, receive them straight into the Bag."`).

`saveTypes.ts` — delete `activeCycle?: ProductionCycleSave` from `ProductionSiteStateSave` (~:273); keep `workerCycles` and `assignedWorkers` (Mission A).

`SaveSystem.ts:373` — delete the `activeCycle: state.activeCycle,` serializer line.

`saveShapeValidation.ts` — delete the Mission-A `if (entry.activeCycle !== undefined) validateProductionCycleSave(entry.activeCycle, ...)` branch inside `validateProductionSitesSave`. Do NOT add rejection for the stale key — unknown-field tolerance is the dev-stage convention (restore whitelists it out).

`saveVersion.ts` — bump `CURRENT_SAVE_VERSION` to `67` with a comment block matching the file's style:

```ts
// v67 (2026-09-16, audit-remediation spec Mission D): productionSites
// loses `activeCycle` — the manual cycle path was removed entirely
// (workers-as-fuel; workerCycles is the only cycle kind). Save v66 is
// rejected (dev phase, no migration).
```

`GameManagerSaveRestore.ts:385` — the `as ProductionSiteState[]` cast stays; `restoreStates` now whitelists, so a stale `activeCycle` in an old-shaped payload is dropped at the domain boundary (no migration, no validator rejection).

- [ ] **Step 4: Run — expect PASS** `npm run type-check` + `npx vitest run src/core/production src/core/game src/services/save src/components/panels src/composables`. Then `rg "activeCycle|startProductionCycle" src/` must return **0 hits** (the only remaining references are docs under `docs/`).
- [ ] **Step 5: Commit** `git add -A && git commit -m "refactor(production): workers-as-fuel; remove manual activeCycle path"`

---

### Task 4: Realm→territory-tier clamp at the boundary (spec D2, audit T3-17)

Today's failure mode (verified against real code — audit wording partially stale, see notes): `startCycle`/`tick` rejected realms outside `territory.realmIds` outright (that path is now deleted by Task 3), while worker lanes take `currentRealmId` raw — `CYCLE_BASE_SECONDS_BY_REALM['golden_core']` exists (2700s) so lanes spawn on a 45-minute tier the territory does not support, and `getTierWeightProfile` silently degrades to `low` via `indexOf → -1`. Lock the contract: every realm entering production resolves through ONE clamp to a supported territory tier.

**Files:**
- Modify: `src/core/production/ProductionCatalog.ts` (add `resolveTerritoryTier` next to `realmSortKey` — `getRealmIndex` is already imported at :7)
- Modify: `src/core/production/ProductionSystem.ts` (`tickWorkers` realm use at ~:376-387, `settleOffline` delegation at ~:434, `rollRewards` profile lookup at ~:497)
- Test: `src/core/production/ProductionSystem.realmTier.test.ts` (new)

**Interfaces:**
- Produces: `resolveTerritoryTier(territory: TerritoryDefinition, realmId: string): string` — in-list → itself; above top tier → top supported tier; unknown (global index -1) → bottom tier. Never rejects.

- [ ] **Step 1: Failing tests** — `src/core/production/ProductionSystem.realmTier.test.ts` (same `createSystem`/`createBag` harness shape as `ProductionSystem.test.ts`):

```ts
describe('resolveTerritoryTier (Mission D / spec D2)', () => {
  it('supported realms pass through unchanged', () => {
    expect(resolveTerritoryTier(TERRITORY_THANH_VAN, 'mortal')).toBe('mortal')
    expect(resolveTerritoryTier(TERRITORY_THANH_VAN, 'qi_refining')).toBe('qi_refining')
    expect(resolveTerritoryTier(TERRITORY_THANH_VAN, 'foundation_establishment')).toBe('foundation_establishment')
  })

  it('every realm above the beta scope clamps to foundation_establishment', () => {
    for (const realmId of ['golden_core', 'nascent_soul', 'soul_transformation', 'void_refinement', 'body_integration', 'mahayana', 'tribulation']) {
      expect(resolveTerritoryTier(TERRITORY_THANH_VAN, realmId)).toBe('foundation_establishment')
    }
  })

  it('an unknown realm resolves to the bottom tier — never rejected, never -1', () => {
    expect(resolveTerritoryTier(TERRITORY_THANH_VAN, 'not_a_realm')).toBe('mortal')
  })
})

describe('clamp applied at every production entry point (T3-17)', () => {
  it('tickWorkers: a golden_core player spawns foundation-tier lanes at 900s, not 2700s ghost lanes', () => {
    const { bag, registry } = createBag()
    const system = createSystem()
    system.setAutoRestart('thanh_van_lam', true)

    system.tickWorkers(1_000, bag, registry, 'golden_core', 2)

    const state = system.getState('thanh_van_lam')!
    expect(state.activeWorkerSlots).toBe(2)
    expect(state.workerCycles).toHaveLength(2)
    for (const cycle of state.workerCycles!) {
      expect(cycle.collectionRealmId).toBe('foundation_establishment')
      expect(cycle.completesAtMs - cycle.startedAtMs).toBe(900_000)
    }
  })

  it('settleOffline: golden_core settles worker lanes on the clamped tier', () => {
    const { bag, registry } = createBag()
    const system = createSystem()
    system.restoreStates([
      { siteId: 'thanh_van_lam', level: 1, autoRestart: true, activeWorkerSlots: 0, workerCycles: [] },
    ])

    const settled = system.settleOffline(bag, registry, 'golden_core', 1_000_000 + 3_600_000, {
      workerCapacity: 1,
      offlineSinceMs: 1_000_000,
    })

    expect(settled).toBe(4) // 1h / 900s foundation cycles — not frozen, not 2700s
    expect(bag.getAll().length).toBeGreaterThan(0)
  })

  it('rollRewards uses the high-tier profile for clamped foundation cycles (reward table consistent with duration)', () => {
    const system = createSystem()
    let highTierPicks = 0
    for (let seed = 0; seed < 1000; seed++) {
      const cycle = {
        cycleId: `t${seed}`,
        siteId: 'thanh_van_lam',
        collectionRealmId: 'foundation_establishment',
        siteLevelAtStart: 1,
        rewardTableVersion: 1,
        rollSeed: seed * 48271,
        startedAtMs: 0,
        completesAtMs: 1,
      }
      for (const reward of system.rollRewards(cycle)) {
        if (reward.materialId.startsWith('foundation_establishment_wood_')) {
          highTierPicks += 1
        }
      }
    }
    expect(highTierPicks).toBeGreaterThan(250) // high profile 20/40/40 -> ~40%
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run src/core/production/ProductionSystem.realmTier.test.ts`) — today `tickWorkers` spawns `golden_core`/2700s lanes and `settleOffline` settles them at 2700s cadence (1h → ~1 cycle, not 4).

- [ ] **Step 3: Implement**

`ProductionCatalog.ts` — append after `realmSortKey`:

```ts
/**
 * Mission D (spec D2) — realm -> territory-tier resolution at the
 * production boundary. A player realm ABOVE the territory's top
 * supported tier clamps DOWN to it (beta scope ends at
 * foundation_establishment; audit T3-17 — higher realms otherwise ran
 * on unsupported timing with a silent low-profile reward fallback, and
 * the manual start path rejected them outright). A realm absent from
 * the global realm order resolves to the BOTTOM tier: produce
 * something rather than silently stall.
 *
 * Extension point: post-beta territories declare their own realmIds;
 * this resolver clamps per-territory — no engine change needed.
 */
export function resolveTerritoryTier(territory: TerritoryDefinition, realmId: string): string {
  if (territory.realmIds.includes(realmId)) {
    return realmId
  }

  const realmIndex = getRealmIndex(realmId)

  if (realmIndex < 0) {
    return territory.realmIds[0]
  }

  const supported = territory.realmIds.filter((id) => getRealmIndex(id) <= realmIndex)

  return supported[supported.length - 1] ?? territory.realmIds[0]
}
```

`ProductionSystem.ts`:
- Import: `import { resolveTerritoryTier } from './ProductionCatalog'` — check for import-cycle risk first: `ProductionCatalog.ts` does NOT import `ProductionSystem.ts`, so this edge is safe.
- `tickWorkers` — resolve once at the top of the per-site loop section and use the resolved id everywhere:

```ts
// Mission D (spec D2) — resolve the player's realm to a supported
// territory tier ONCE at the boundary; every spawned lane snapshots
// the clamped id.
const collectionRealmId = resolveTerritoryTier(this.deps.territory, currentRealmId)
```

then `CYCLE_BASE_SECONDS_BY_REALM[collectionRealmId]` and `collectionRealmId` inside `advanceWorkerLanes({...})` (replacing both `currentRealmId` uses at ~:384 and :395).

- `settleOffline` — clamp at the delegation boundary:

```ts
return settleProductionOffline(
  this.offlineDeps(),
  bag,
  registry,
  resolveTerritoryTier(this.deps.territory, currentRealmId),
  nowMs,
  options,
)
```

- `rollRewards` (~:505) — resolve the snapshot realm before the profile lookup so a corrupted restored snapshot can never hit the `indexOf → -1` fallback:

```ts
const profile = getTierWeightProfile(
  resolveTerritoryTier(this.deps.territory, cycle.collectionRealmId),
  this.deps.territory.realmIds,
)
```

- `ProductionBalance.ts` `getTierWeightProfile` — keep `index <= 0 → low` but update its JSDoc: `-1 is unreachable for cycles written through the clamp; the clause doubles as corrupt-snapshot defense and the bottom-tier (index 0) case.` This satisfies D2's "indexOf → -1 fallback deleted" by making -1 structurally unreachable rather than by crashing on corrupt data — do NOT throw on corrupt snapshots (a poisoned save must degrade, not crash the tick).

- [ ] **Step 4: Run — expect PASS** (`npx vitest run src/core/production`) + `npm run type-check`.
- [ ] **Step 5: Commit** `git add -A && git commit -m "fix(production): clamp realm to supported territory tier"`

---

### Task 5: Decompose cadence — regression pin for the already-landed fix (spec D4, audit N-02)

> **STATUS — fix already merged:** the `missedCycles = min(..., 1)` per-tick burst described by N-02 was removed by Mission A review fix MA-R3-01 — `DecomposeSystem.tick` at :141-149 already does `this.nextCycleAt = nowMs + this.cycleMs` before `runOneCycle()`, and `DecomposeSystem.test.ts:202-222` already covers the no-burst contract. A second MA-R3-02 guard (:130-139) rebases far-future deadlines. This task remains ONLY as additive regression pinning — there is no code change and no "expect FAIL" step.

**Files:**
- Test only: `src/core/production/DecomposeSystem.test.ts` (extend — reuse `createSystemWithCapacity`/`addOre` harness)

- [ ] **Step 1: Add the regression test** (skips the MA-R3-02 far-future rebase because 29_999 ≤ cycleMs):

```ts
it('stalled tick runs exactly ONE late cycle and re-anchors nextCycleAt to now (spec D4 — pins MA-R3-01)', () => {
  addOre('mortal_ore_decade', 1_000)

  const system = createSystemWithCapacity(6)
  system.setSetting({ workers: 1 })

  system.tick(0)        // starts: nextCycleAt = 30_000
  system.tick(300_000)  // 270s late -> exactly one catch-up cycle

  expect(system.drainOutput()).toHaveLength(1)
  // Anchored to NOW, not advanced one step from the stale deadline
  // (pre-MA-R3-01 bug: re-armed at 60_000 -> every later tick burned a
  // cycle until the timer caught up).
  expect(system.getSaveState().nextCycleAt).toBe(330_000)

  // Immediately afterwards nothing is due — no catch-up backlog drains.
  system.tick(300_001)
  system.tick(310_000)
  expect(system.drainOutput()).toHaveLength(0)

  // And the next legitimate cycle lands at the new deadline.
  system.tick(330_000)
  expect(system.drainOutput()).toHaveLength(1)
})
```

- [ ] **Step 2: Run — expect PASS immediately** (`npx vitest run src/core/production/DecomposeSystem.test.ts`) — this is a pin, not a TDD driver; if it FAILS, MA-R3-01 regressed and that is a bug to investigate, not a test to weaken.
- [ ] **Step 3: Commit** `git add -A && git commit -m "test(decompose): pin now-anchored catch-up (MA-R3-01 regression net)"`

---

## Mission D done-criteria

- **UI shows engine truth:** `ProductionPanel` renders `getWorkforceView()` verbatim — mode derives from persisted `assignedWorkers`, sliders max to `available` (total − decompose), the decompose reservation is visible. No local `workerMode` ref.
- **Realms clamp:** every production entry point (`tickWorkers`, `settleOffline`, `rollRewards`) resolves through `resolveTerritoryTier`; realms above `foundation_establishment` produce on the top supported tier — never rejected, never a silent `-1` profile.
- **Workers-as-fuel:** `rg "activeCycle" src/` returns 0 hits; a 0-worker site produces nothing online or offline; lane count = `activeWorkerSlots`; save shape drops `activeCycle`; stale keys are tolerated at the validator and whitelisted out at `restoreStates` — no migration anywhere.
- **Decompose cadence:** a late tick runs exactly one cycle; `nextCycleAt = nowMs + cycleMs`.
- **One split rule:** `resolveProductionWorkerCapacity` is the only place `total - decomposeWorkers` is computed; the boundary parity test pins restore to it.
- **Verification:** `npm run type-check` + `npx vitest run src/core/production src/core/game src/services/save src/components/panels src/composables` green; P13 guard `GameManager.workerCapacity.test.ts` "full update advances decompose AND production workers together" still green; full mode (`npm run build` + `npx vitest run`) before merge.
- **P4:** run `tutienidle-adversarial-qa` quick on the aggregate diff — focus areas: save round-trip without `activeCycle`, offline settle parity, and the panel's derived mode.
- **P5:** run the three-lens review round (A/B/C) before declaring the mission complete — zero unresolved Medium+ required.

## Audit cross-check notes (verified against the tree while authoring this plan)

- **T3-18 partially stale:** the audit's "docs say slot 1 = manual `activeCycle`, workers = slots 2+, so a 1-worker site may run 2 producers" describes the stale comments (`ProductionTypes.ts:79`, `ProductionSystem.ts:335`), not the current mechanics — `activeWorkerSlots` already feeds `advanceWorkerLanes` directly, so a 1-worker site runs exactly 1 lane plus the separate manual cycle. The contract problem (a second production path outside the worker pool) is real; the numeric double-count claim is only literally true when the manual cycle is also running. This plan frames the fix as deleting the legacy path + comments, not changing lane math.
- **T3-17 partially stale:** `CYCLE_BASE_SECONDS_BY_REALM` already contains higher-realm timings (golden_core 2700s, …), so worker lanes did not fully "die" for golden_core+ — they spawned on unsupported timing while `getTierWeightProfile` silently fell to `low`, and only the manual `startCycle` rejected outright. The clamp fixes both halves.
- **T4-29, T4-30, N-02, T5-47 (worker part):** all verified accurate as described.
- **Mission A dependency (satisfied — A is merged):** Mission A landed `assignedWorkers` persistence + an `activeCycle` element check in `validateProductionSitesSave`. This plan's Task 3 deletes that check; the edit applies to the merged validator as-is.
