# Mission A — Save Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the persistence boundary — every declared `GameSave` slice gets deep element-level validation, all persistent fields round-trip, and every storage write has a typed failure contract.

**Architecture:** `validateGameSaveShape()` becomes the single trust boundary: after it returns `ok`, domain `restore()` may trust the declared TS shape. One `validate<Slice>Save` function per aggregate (not scattered `if`s). Storage writes funnel through try/catch → typed results. A whole-payload round-trip conformance test makes serializer/validator drift structurally impossible.

**Tech Stack:** TypeScript, Vitest, Pinia (player store), localStorage.

**Spec:** `docs/specs/2026-09-16-audit-remediation-spec.md` (Mission A section). Audit evidence: `docs/qa/2026-09-16-full-project-scout-audit.md` T1-1/3/7/9, T2-13/14/15.

## Global Constraints

- **Dev-stage rule:** no live players — never write migrations or old-save compat shims; delete legacy bridges instead of preserving them.
- P8: no `any`. Narrow with `unknown` + guards (existing file convention: `isObject`, `isFiniteNumber`, `isNonNegativeFiniteNumber`).
- P15: comments English ASCII only in `.ts` files.
- P16: new user-facing strings go through `t()` i18n keys.
- Verification per task (P3 quick): `npm run type-check` + `npx vitest run <task scope>`.
- Worktree: this plan executes inside `.agent-worktrees/save-integrity` (P2 multi-file rule).

---

### Task 1: Deep validators — quests + buildings

**Files:**
- Modify: `game/src/services/save/saveShapeValidation.ts` (validator functions + wire into `validateGameSaveShape` at the `.quests`/`.buildings` sites, currently lines ~876, ~884-886)
- Test: `game/src/services/save/saveShapeValidation.test.ts`

**Interfaces:**
- Consumes: `QuestProgress = { questId: string; progress: number; claimed: boolean }`, `QuestManagerState = { active, completedOnceIds, lastDailyResetAtMs }`, `BuildingInstance = { instanceId, buildingId, level, lastCollectedAt }`.
- Produces: `validateQuestSave(value, path, issues)` and `validateBuildingsSave(entries, path, issues)` — internal functions returning `void`, pushing `ShapeIssue`s.

- [ ] **Step 1: Failing tests** — in `saveShapeValidation.test.ts`, build the minimal valid save (copy the existing happy-path fixture in that file), then per case mutate and expect `ok:false`:

```ts
it('rejects quests.active non-array', () => {
  const save = validSave()
  ;(save as Record<string, unknown>).quests = { active: 'not-an-array', completedOnceIds: [], lastDailyResetAtMs: 0 }
  expect(validateGameSaveShape(save).ok).toBe(false)
})

it('rejects quest progress missing questId / non-finite progress', () => {
  const save = validSave()
  ;(save as Record<string, unknown>).quests = { active: [{ questId: 5, progress: 'x', claimed: 'y' }], completedOnceIds: [], lastDailyResetAtMs: 0 }
  expect(validateGameSaveShape(save).ok).toBe(false)
})

it('rejects building with non-numeric level', () => {
  const save = validSave()
  save.buildings = [{ instanceId: 'i1', buildingId: 'linh_khi_tuyen', level: 'bad', lastCollectedAt: 0 }] as never
  expect(validateGameSaveShape(save).ok).toBe(false)
})

it('rejects building with negative lastCollectedAt', () => { /* level: -1, lastCollectedAt: -5 → ok:false */ })
```

- [ ] **Step 2: Run tests — expect FAIL** (`npx vitest run src/services/save/saveShapeValidation.test.ts`)

- [ ] **Step 3: Implement** in `saveShapeValidation.ts`:

```ts
function validateQuestSave(value: unknown, path: string, issues: ShapeIssue[]): void {
  if (value === undefined) return
  if (!isObject(value)) {
    issues.push({ path, message: 'phải là object hoặc vắng mặt' })
    return
  }
  if (!Array.isArray(value.active)) {
    issues.push({ path: `${path}.active`, message: 'phải là array' })
  } else {
    for (const [i, entry] of value.active.entries()) {
      if (!isObject(entry) || typeof entry.questId !== 'string'
        || !isNonNegativeFiniteNumber(entry.progress) || typeof entry.claimed !== 'boolean') {
        issues.push({ path: `${path}.active[${i}]`, message: 'quest progress sai shape' })
      }
    }
  }
  if (!Array.isArray(value.completedOnceIds) || !value.completedOnceIds.every((id) => typeof id === 'string')) {
    issues.push({ path: `${path}.completedOnceIds`, message: 'phải là string[]' })
  }
  if (!isNonNegativeFiniteNumber(value.lastDailyResetAtMs)) {
    issues.push({ path: `${path}.lastDailyResetAtMs`, message: 'phải là số hữu hạn không âm' })
  }
}

function validateBuildingsSave(entries: unknown[], path: string, issues: ShapeIssue[]): void {
  for (const [i, entry] of entries.entries()) {
    if (!isObject(entry)
      || typeof entry.instanceId !== 'string'
      || typeof entry.buildingId !== 'string'
      || !Number.isInteger(entry.level) || (entry.level as number) < 1
      || !isNonNegativeFiniteNumber(entry.lastCollectedAt)) {
      issues.push({ path: `${path}[${i}]`, message: 'building sai shape' })
    }
  }
}
```

Wire: replace `requireArray(parsed, 'buildings', ...)` result usage → `const buildings = requireArray(...); if (buildings) validateBuildingsSave(buildings, '.buildings', issues)`. Replace the `.quests` isObject check with `validateQuestSave(parsed.quests, '.quests', issues)`.

- [ ] **Step 4: Run tests — expect PASS** (same command)
- [ ] **Step 5: Commit** `git add -A && git commit -m "fix(save): deep-validate quests and buildings slices"`

---

### Task 2: Deep validators — productionSites + alchemyJobs + decompose extension

**Files:**
- Modify: `game/src/services/save/saveShapeValidation.ts`
- Test: `game/src/services/save/saveShapeValidation.test.ts`

**Interfaces:**
- Consumes: `ProductionSiteStateSave { siteId, level, autoRestart, activeCycle?, workerCycles? }`, `ProductionCycleSave { cycleId, siteId, collectionRealmId, siteLevelAtStart, rewardTableVersion, rollSeed, startedAtMs, completesAtMs }`, `AlchemyJobSave { jobId, recipeId, pillId, herbMaterialId, startedAtMs, completesAtMs, roomLevelAtStart }`, `DecomposeSaveState { settings{gradeFilter,ageFilter,workers}, nextCycleAt, started }`.

- [ ] **Step 1: Failing tests** — cases: `productionSites:[{siteId:5,...}]`, `activeCycle.completesAtMs:'x'`, `workerCycles` non-array, `alchemyJobs` entry missing `recipeId` or `completesAtMs` non-finite, `decompose.nextCycleAt:'bad'`, `decompose.started:'yes'`, `decompose.settings.gradeFilter:'bogus'`.

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement:**

```ts
function validateProductionCycleSave(value: unknown, path: string, issues: ShapeIssue[]): void {
  if (!isObject(value)
    || typeof value.cycleId !== 'string' || typeof value.siteId !== 'string'
    || typeof value.collectionRealmId !== 'string'
    || !isFiniteNumber(value.siteLevelAtStart) || !isFiniteNumber(value.rewardTableVersion)
    || !isFiniteNumber(value.rollSeed)
    || !isFiniteNumber(value.startedAtMs) || !isFiniteNumber(value.completesAtMs)) {
    issues.push({ path, message: 'production cycle sai shape' })
  }
}

function validateProductionSitesSave(entries: unknown[], path: string, issues: ShapeIssue[]): void {
  for (const [i, entry] of entries.entries()) {
    if (!isObject(entry) || typeof entry.siteId !== 'string'
      || !Number.isInteger(entry.level) || typeof entry.autoRestart !== 'boolean') {
      issues.push({ path: `${path}[${i}]`, message: 'production site sai shape' })
      continue
    }
    if (entry.assignedWorkers !== undefined
      && (!Number.isInteger(entry.assignedWorkers) || (entry.assignedWorkers as number) < 0)) {
      issues.push({ path: `${path}[${i}].assignedWorkers`, message: 'phải là int không âm' })
    }
    if (entry.activeCycle !== undefined) validateProductionCycleSave(entry.activeCycle, `${path}[${i}].activeCycle`, issues)
    if (entry.workerCycles !== undefined) {
      if (!Array.isArray(entry.workerCycles)) {
        issues.push({ path: `${path}[${i}].workerCycles`, message: 'phải là array' })
      } else {
        for (const [j, cycle] of entry.workerCycles.entries()) {
          validateProductionCycleSave(cycle, `${path}[${i}].workerCycles[${j}]`, issues)
        }
      }
    }
  }
}

function validateAlchemyJobsSave(entries: unknown[], path: string, issues: ShapeIssue[]): void {
  for (const [i, entry] of entries.entries()) {
    if (!isObject(entry)
      || typeof entry.jobId !== 'string' || typeof entry.recipeId !== 'string'
      || typeof entry.pillId !== 'string' || typeof entry.herbMaterialId !== 'string'
      || !isFiniteNumber(value.startedAtMs) /* fix: entry.startedAtMs */
      || !isFiniteNumber(entry.completesAtMs) || !isFiniteNumber(entry.roomLevelAtStart)) {
      issues.push({ path: `${path}[${i}]`, message: 'alchemy job sai shape' })
    }
  }
}
```

Extend the existing `decompose` block (lines ~891-903): also require `isNonNegativeFiniteNumber(decompose.nextCycleAt)`, `typeof decompose.started === 'boolean'`, `settings.gradeFilter` ∈ `PROFESSION_GRADE_ORDER ∪ 'all'` (use existing `isProfessionGrade` import), `settings.ageFilter` ∈ `HERB_AGES ∪ 'all'` (import `HERB_AGES` from `core/production/ProductionTypes`).

Wire: `const sites = optionalArray(parsed, 'productionSites', '', issues); if (sites) validateProductionSitesSave(sites, '.productionSites', issues)` — same for `alchemyJobs`.

- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `fix(save): deep-validate productionSites, alchemyJobs, decompose`

---

### Task 3: Defense-in-depth clamps (restore trusts boundary, but belt-and-suspenders on timer poison)

**Files:**
- Modify: `game/src/core/production/DecomposeSystem.ts:182-196` (restore), `game/src/core/quest/QuestManager.ts:111-119` (restore)
- Test: `game/src/core/production/DecomposeSystem.saveRestore.test.ts`, quest manager test file (colocate `QuestManager.test.ts` if none exists)

- [ ] **Step 1: Failing tests:**
  - Decompose: restore `{ settings:{gradeFilter:'all',ageFilter:'all',workers:1}, nextCycleAt: Number('bad') /* NaN */, started:true }` → `tick(now)` must NOT call runOneCycle every tick — assert `drainOutput()` empty after two ticks (or that `getSaveState().nextCycleAt` is finite).
  - QuestManager: `restore({ active: 'x' as never, completedOnceIds: [], lastDailyResetAtMs: 0 })` → `getState().active` is `[]`, no throw.

- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement:**

```ts
// DecomposeSystem.restore — line ~194:
const restoredDeadline = Math.floor(source.nextCycleAt ?? 0)
this.nextCycleAt = Number.isFinite(restoredDeadline)
  ? Math.max(this.nextCycleAt, Math.max(0, restoredDeadline))
  : this.nextCycleAt

// QuestManager.restore:
active: structuredClone(Array.isArray(state.active) ? state.active : []),
completedOnceIds: [...(Array.isArray(state.completedOnceIds) ? state.completedOnceIds : [])],
lastDailyResetAtMs: Number.isFinite(state.lastDailyResetAtMs) ? state.lastDailyResetAtMs : 0,
```

- [ ] **Step 4: PASS.** **Step 5: Commit** `fix(save): clamp malformed restore input at domain boundary`

---

### Task 4: Persist `assignedWorkers`

**Files:**
- Modify: `game/src/services/save/saveTypes.ts:266-279` (add field), `game/src/services/save/SaveSystem.ts:366-376` (serializer)
- Test: `game/src/services/save/SaveSystem.saveLoadRoundTrip.test.ts`

- [ ] **Step 1: Failing test** — assign workers via `gameManager.buildingOps`/`productionSystem` setter (see `GameManager.workerCapacity.test.ts:124` for the call shape), save, restore fresh GameManager, assert `getState(siteId).assignedWorkers === N`.

- [ ] **Step 2: FAIL** (field currently dropped).

- [ ] **Step 3: Implement:**
  - `saveTypes.ts`: add `assignedWorkers?: number` to `ProductionSiteStateSave` with a one-line comment (English, per P15 for new comments — match surrounding file style).
  - `SaveSystem.ts` serializer: add `assignedWorkers: state.assignedWorkers` to the mapped object.
  - Restore side: `GameManagerSaveRestore.ts:375` casts to `ProductionSiteState[]` — `ProductionSiteState` already declares `assignedWorkers?: number` (`ProductionTypes.ts:84`); verify the restore path propagates it (read `ProductionSystem.restoreStates`), fix if it strips unknown fields.
  - Also update the stale comment at `saveVersion.ts:13` if it describes a version that never shipped the field — note reality instead.

- [ ] **Step 4: PASS.** **Step 5: Commit** `fix(save): persist assignedWorkers in productionSites slice`

---

### Task 5: `combatInputMode` persistence dirty-check

**Files:**
- Modify: `game/src/App.vue:95-108`
- Test: extend `game/src/stores/ui.flags.test.ts` or App-level test — verify where the subscribe logic is testable; if not extractable, test `savePersistedUiAutomationFlags` call happens when only `combatInputMode` changes (may need a small component harness — follow existing test conventions in `ui.flags.test.ts`).

- [ ] **Step 1: Failing test** — set `ui.combatInputMode` with `battleRunMode` unchanged → `savePersistedUiAutomationFlags` invoked with both fields.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement** — change snapshot to composite:

```ts
let lastAutomationSnapshot: string | undefined

ui.$subscribe((_mutation, state) => {
  const snapshot = `${state.battleRunMode}|${state.combatInputMode}`
  if (snapshot === lastAutomationSnapshot) return
  lastAutomationSnapshot = snapshot
  savePersistedUiAutomationFlags({
    battleRunMode: state.battleRunMode,
    combatInputMode: state.combatInputMode,
  })
}, { detached: true })
```

(Note: while here, capture the return disposer into a variable for Mission B's unmount cleanup — do NOT wire the unmount call in this task; just store it: `const automationFlagsUnsubscribe = ui.$subscribe(...)`.)

- [ ] **Step 4: PASS.** **Step 5: Commit** `fix(ui): persist combatInputMode-only changes`

---

### Task 6: Exception-safe recovery storage

**Files:**
- Modify: `game/src/services/save/SaveSystem.ts:519-557, 583-637`
- Test: `game/src/services/save/SaveSystem.quota.test.ts` (add cases) — mock `localStorage.setItem` to throw `QuotaExceededError`.

- [ ] **Step 1: Failing tests:**
  - `importSaveRaw(validRaw)` returns `false` (not throw) when `setItem` throws on the final write.
  - `restoreBackup()` returns `false` (not throw) when `setItem` throws.
  - `deleteSave()` doesn't throw when `setItem` throws during `backupCurrentSave`.

- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement** — wrap each raw `localStorage` write:

```ts
export function backupCurrentSave(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) localStorage.setItem(BACKUP_KEY, raw)
    return true
  } catch {
    return false
  }
}
// restoreBackup: wrap setItem+removeItem in try/catch → false on throw.
// deleteSave: void backupCurrentSave() result (delete proceeds regardless).
// importSaveRaw: wrap backupCurrentSave()+final setItem in try → return false.
```

Callers keep existing boolean/void contracts — check `SaveIncompatibleScreen.vue:39,58` and `SettingsPanel.vue:117` still type-check.

- [ ] **Step 4: PASS + `npm run type-check`.**
- [ ] **Step 5: Commit** `fix(save): make recovery storage ops exception-safe`

---

### Task 7: Restore key whitelist (no foreign keys onto `$state`)

**Files:**
- Modify: `game/src/stores/player.ts:355-395`
- Test: `game/src/stores/player.save.test.ts` (or restore-focused sibling)

- [ ] **Step 1: Failing test** — save whose `player` contains a foreign key (`spiritStone: 999` or `__evil: 1`) → after `restoreFromSave`, `'__evil' in player.$state === false` and next `buildGameSave` doesn't contain it.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement** — before the spread at line 357-372, strip `clonedPlayer` to keys of `createDefaultPlayer()`:

```ts
const defaults = createDefaultPlayer() as Record<string, unknown>
const clonedPlayer = structuredClone(save.player) as Record<string, unknown>
for (const key of Object.keys(clonedPlayer)) {
  if (!(key in defaults)) delete clonedPlayer[key]
}
const restoredPlayer: PlayerData = { ...createDefaultPlayer(), ...clonedPlayer, baseStats: ... } // unchanged after
```

- [ ] **Step 4: PASS.** **Step 5: Commit** `fix(save): whitelist player keys on restore`

---

### Task 8: Whole-payload round-trip conformance test

**Files:**
- Test: extend `game/src/services/save/SaveSystem.saveLoadRoundTrip.test.ts`

- [ ] **Step 1: Write the conformance test** (it should PASS immediately if Tasks 1-7 are correct — it exists to lock the contract):

```ts
it('every declared persistent field survives save → parse → validate → restore → save', () => {
  const manager = makeGameManager() // existing test factory in this file
  // populate every slice: assign workers, start production cycle, queue alchemy
  // job, activate quest, build building, set decompose settings, etc.
  const save1 = buildGameSave(player.$state, manager)
  const parsed = JSON.parse(JSON.stringify(save1)) as unknown
  const shape = validateGameSaveShape(parsed)
  expect(shape.ok).toBe(true)
  const fresh = makeGameManager()
  restoreInto(fresh, shape.normalizedSave as GameSave) // use existing restore entry
  const save2 = buildGameSave(player.$state, fresh)
  expect(stripVolatile(save2)).toEqual(stripVolatile(save1)) // strip lastSavedAt only
})
```

Plus a mutation sweep: for each top-level GameSave slice, a save built with that slice populated must produce a byte-identical slice after round-trip.

- [ ] **Step 2: Run — PASS (regression net).**
- [ ] **Step 3: Commit** `test(save): whole-payload round-trip conformance`

---

## Mission A done-criteria

- `validateGameSaveShape` rejects malformed elements in every aggregate slice.
- `assignedWorkers` round-trips; `combatInputMode` persists.
- No storage write path can throw uncaught.
- Foreign keys cannot enter `$state`.
- Round-trip conformance test green; `npm run type-check` + `npx vitest run src/services/save src/stores src/core/production src/core/quest` all green.
- P4: run `tutienidle-adversarial-qa` quick on the diff; P5: run the three-lens review round (A/B/C) — zero unresolved Medium+ before done.
