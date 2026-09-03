# AOE Shape Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the live `ActionTargetingShape` union with `'cross'`, `'row'`, `'column'`, rename its existing `'area'` member to `'square'` everywhere it's used, and wire the already-built `AoeShape.ts` helper (`isCellInShape`) into `ActionTargetingSystem.ts`'s `collectAffected()` so `'cross'` resolves correctly (a cross is not a rectangle — the existing rectangle-bounds filter would wrongly include corner cells).

**Architecture:** Two files change behavior (`CombatAction.ts` for the type, `ActionTargetingSystem.ts` for the resolver logic); every other touched file is a mechanical string-literal rename (`'area'` → `'square'`) with zero behavior change. `AoeShape.ts` (Foundation, already merged) is reused as-is — not modified, not deleted.

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-aoe-shape-extension-design.md`

## Global Constraints

- Do not modify `game/src/core/battle/turn/AoeShape.ts` or `AoeShape.test.ts` — reuse `isCellInShape`/`AoeShapeSpec` as they already exist.
- Do not assign `'cross'`/`'row'`/`'column'` to any skill in `game/src/data/skill/Skills.ts` — this plan adds the shapes, it does not use them in content.
- Do not touch `BounceChain.ts`, `TrueShot.ts`, or any Stat System file — out of scope (separate future plans).
- Every existing skill currently using `shape: 'area'` must resolve to the exact same cells after this plan as before (pure rename, `'square'` case keeps `areaFor()`'s existing `laneRadius`/`columnRadius` rectangle logic unchanged).

---

### Task 1: Extend `ActionTargetingShape` + resolver logic

**Files:**
- Modify: `game/src/core/battle/CombatAction.ts:10` (type), `CombatAction.ts:51` (`targetingForSkill`'s literal)
- Modify: `game/src/core/battle/ActionTargetingSystem.ts:150-225` (`areaFor`, `collectAffected`)
- Test: `game/src/core/battle/ActionTargetingSystem.test.ts` (append new cases; existing `'area'` cases are renamed in Task 2, not this task)

**Interfaces:**
- Consumes: `isCellInShape(anchor: GridPosition, spec: AoeShapeSpec, cell: GridPosition): boolean` and `AoeShapeSpec { shape: AoeShapeId; radius: number; axis?: 'row' | 'column' }` from `game/src/core/battle/turn/AoeShape.ts` (already exported, unchanged).
- Produces: `ActionTargetingShape = 'single' | 'square' | 'cross' | 'line' | 'row' | 'column' | 'all_lanes'` — every later task and every existing consumer reads this exact union.

- [ ] **Step 1: Write the failing tests for the 3 new shapes**

Append to `game/src/core/battle/ActionTargetingSystem.test.ts`, inside a new `describe` block placed after the existing `describe('collectAffected — shape theo grid, clamp biên', ...)` block. Reuse the file's existing fixture helpers verbatim: `entity(id: string, x: number, row: number, hp = 100): CombatEntity` (line 16 — `x` is world-x, rounded to column by `getColumnFromWorldX`, i.e. `Math.round(x)`) and `battleWith(player, enemies, overrides?): Battle` (line 29) and the module-level `const PLAYER = entity('player', 1, 4)` (line 42) — anchor these new tests at `PLAYER`'s own position (x=1, row=4) exactly like the existing `'area'`-shape tests do, rather than introducing a second anchor entity:

```typescript
describe('collectAffected — new shapes (cross/row/column)', () => {
  it("shape 'cross': includes arm cells, excludes corner cells of the bounding box", () => {
    const armUp = entity('arm-up', 1, 2) // same column (1), 2 rows up from anchor row 4 — in cross arm
    const armRight = entity('arm-right', 3, 4) // same row (4), 2 cols right from anchor col 1 — in cross arm
    const corner = entity('corner', 3, 2) // diagonal from anchor — NOT in cross; a rectangle filter would wrongly include it
    const battle = battleWith(PLAYER, [armUp, armRight, corner])
    const targeting: ActionTargeting = { shape: 'cross', laneRadius: 2, columnRadius: 2 }

    const affected = collectAffected(battle, PLAYER, 'arm-up', 4, 1, targeting)

    expect(affected.map(e => e.id).sort()).toEqual(['arm-right', 'arm-up'])
  })

  it("shape 'row': includes every enemy on the anchor's row regardless of column", () => {
    const sameRowFar = entity('same-row-far', 15, 4)
    const otherRow = entity('other-row', 1, 6)
    const battle = battleWith(PLAYER, [sameRowFar, otherRow])
    const targeting: ActionTargeting = { shape: 'row' }

    const affected = collectAffected(battle, PLAYER, 'same-row-far', 4, 1, targeting)

    expect(affected.map(e => e.id)).toEqual(['same-row-far'])
  })

  it("shape 'column': includes every enemy on the anchor's column regardless of row", () => {
    const sameColFar = entity('same-col-far', 1, 9)
    const otherCol = entity('other-col', 3, 4)
    const battle = battleWith(PLAYER, [sameColFar, otherCol])
    const targeting: ActionTargeting = { shape: 'column' }

    const affected = collectAffected(battle, PLAYER, 'same-col-far', 4, 1, targeting)

    expect(affected.map(e => e.id)).toEqual(['same-col-far'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run game/src/core/battle/ActionTargetingSystem.test.ts`
Expected: FAIL — `'cross'`/`'row'`/`'column'` are not valid `ActionTargetingShape` values yet (TypeScript compile error) and `areaFor`/`collectAffected` have no cases for them.

- [ ] **Step 3: Extend the type and `targetingForSkill`**

In `game/src/core/battle/CombatAction.ts`, change line 10:

```typescript
export type ActionTargetingShape = 'single' | 'square' | 'cross' | 'line' | 'row' | 'column' | 'all_lanes'
```

Update the doc comment above it (lines 9, and the `- shape 'area' dùng...` line at 19) to say `'square'` instead of `'area'`. Change line 51 (`targetingForSkill`):

```typescript
    shape: laneRadius > 0 || columnRadius > 0 ? 'square' : 'single',
```

Update the comment at line 165 (`/** AOE lan theo hàng quanh primary target (shape 'area' mặc định). */`) to say `'square'`.

- [ ] **Step 4: Extend `areaFor()` and `collectAffected()`**

In `game/src/core/battle/ActionTargetingSystem.ts`, add the import at the top (alongside the existing imports from `./BattleGrid`):

```typescript
import { isCellInShape, type AoeShapeSpec } from './turn/AoeShape'
```

Replace the `areaFor()` function (lines 150-169) with:

```typescript
export function areaFor(anchorRow: LaneIndex, anchorColumn: number, targeting: ActionTargeting): CellArea | null {
  switch (targeting.shape) {
    case 'single':
      return getCellsInArea({ row: anchorRow, column: anchorColumn }, 0, 0)
    case 'square':
      return getCellsInArea(
        { row: anchorRow, column: anchorColumn },
        targeting.laneRadius ?? 0,
        targeting.columnRadius ?? 0,
      )
    case 'cross':
      // No single rectangle describes a cross — collectAffected() filters
      // per-cell via isCellInShape() instead of using this bounding area.
      return null
    case 'line':
      return { rowStart: anchorRow, rowEnd: anchorRow, colStart: 0, colEnd: GRID_COLUMN_COUNT - 1 }
    case 'row':
      return { rowStart: anchorRow, rowEnd: anchorRow, colStart: 0, colEnd: GRID_COLUMN_COUNT - 1 }
    case 'column':
      return { rowStart: 0, rowEnd: GRID_ROW_COUNT - 1, colStart: anchorColumn, colEnd: anchorColumn }
    case 'all_lanes':
      return getCellsInArea(
        { row: anchorRow, column: anchorColumn },
        GRID_ROW_COUNT,
        targeting.columnRadius ?? 1,
      )
  }
}
```

Then modify `collectAffected()` (lines 179-225): the enemy-inclusion filter needs a `'cross'`-specific branch using `isCellInShape`, while every other shape keeps the current rectangle-bounds check. Replace the function body with:

```typescript
export function collectAffected(
  battle: Battle,
  source: CombatEntity,
  primaryTargetId: string,
  anchorRow: LaneIndex,
  anchorColumn: number,
  targeting: ActionTargeting,
): CombatEntity[] {
  if (source.id !== battle.player.id) {
    return battle.player.alive && battle.playerMaterialized ? [battle.player] : []
  }

  const selection: TargetSelectionMode = targeting.selection ?? 'nearest'

  const isInRange = (row: LaneIndex, column: number): boolean => {
    if (targeting.shape === 'cross') {
      const spec: AoeShapeSpec = { shape: 'cross', radius: targeting.laneRadius ?? 0 }
      return isCellInShape(
        { row: anchorRow, column: anchorColumn },
        spec,
        { row, column },
      )
    }

    const area = areaFor(anchorRow, anchorColumn, targeting)
    if (!area) {
      return false
    }
    return row >= area.rowStart && row <= area.rowEnd && column >= area.colStart && column <= area.colEnd
  }

  const affected = battle.enemies
    .filter(enemy => enemy.entity.alive)
    .filter(enemy => isInRange(enemy.entity.row, getColumnFromWorldX(enemy.entity.x)))
    .map(enemy => ({
      entity: enemy.entity,
      columnDistance: Math.abs(getColumnFromWorldX(enemy.entity.x) - anchorColumn),
      isPrimary: enemy.entity.id === primaryTargetId,
    }))
    .sort((a, b) => {
      // Primary target LUÔN đứng đầu để giữ ngữ nghĩa "mục tiêu chính".
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1
      return compareBySelection(a, b, selection)
    })
    .slice(0, targeting.maxTargets ?? Number.MAX_SAFE_INTEGER)
    .map(entry => entry.entity)

  return affected
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run game/src/core/battle/ActionTargetingSystem.test.ts`
Expected: still FAIL at this point — the file's pre-existing tests use the now-renamed `'area'` literal (Task 2 fixes those). Confirm the 3 NEW tests from Step 1 (`cross`/`row`/`column`) specifically pass; pre-existing `'area'`-shape test failures are expected and handled in Task 2.

- [ ] **Step 6: Commit**

```bash
git add game/src/core/battle/CombatAction.ts game/src/core/battle/ActionTargetingSystem.ts game/src/core/battle/ActionTargetingSystem.test.ts
git commit -m "feat: extend ActionTargetingShape with cross/row/column, wire AoeShape.isCellInShape for cross"
```

---

### Task 2: Rename `'area'` → `'square'` at every remaining literal

**Files:**
- Modify: `game/src/core/battle/ActionTargetingSystem.test.ts:140,142,160,224`
- Modify: `game/src/core/battle/ActionImpactSystem.test.ts:165,228`
- Modify: `game/src/data/skill/Skills.ts:1325,1698,1822,1841,2042,2076`
- Modify: `game/src/core/battle/BattleSystem.castTime.test.ts:307`
- Modify: `game/src/core/battle/SkillEffectResolver.ts:316`
- Modify: `game/src/core/skill/SkillSystem.targeting.test.ts:42,85,101,112`

**Interfaces:**
- Consumes: `ActionTargetingShape` from Task 1 (already includes `'square'`).
- Produces: nothing new — this task only replaces string literals, no new exports.

This task is a pure rename with zero behavior change: every one of these sites currently reads `shape: 'area'` (or, at `SkillSystem.targeting.test.ts:112`, a `Set` literal containing `'area'` as one of its members) and must read `shape: 'square'` (or `'square'` in the set) instead — nothing else on these lines changes.

- [ ] **Step 1: Verify the current literal list is unchanged**

Run: `grep -rn "'area'" game/src` (or the ripgrep equivalent) and confirm the result matches exactly these 23 occurrences across these 9 files (the 6 in `CombatAction.ts`/`ActionTargetingSystem.ts` were already handled by Task 1 — Step 1 of Task 2 is a sanity check that no other file gained a new `'area'` literal since this plan was written, not a search for new work).

- [ ] **Step 2: Rename every literal**

In `game/src/core/battle/ActionTargetingSystem.test.ts`:
- Line 140: `const base: ActionTargeting = { shape: 'area', laneRadius: 1, columnRadius: 1 }` → `shape: 'square'`
- Line 142: the test title string `"shape 'area': anchor ở GÓC trên-phải..."` → `"shape 'square': anchor ở GÓC trên-phải..."`
- Line 160: the test title string `"shape 'area': anchor góc dưới-trái..."` → `"shape 'square': anchor góc dưới-trái..."`
- Line 224: `{ shape: 'area', laneRadius: 0, columnRadius: 1, maxTargets: 2 }` → `{ shape: 'square', ... }`

In `game/src/core/battle/ActionImpactSystem.test.ts`:
- Line 165: `area: { rowStart: 1, rowEnd: 3, colStart: 4, colEnd: 6, shape: 'area' }` → `shape: 'square'`
- Line 228: `area: { rowStart: 0, rowEnd: 4, colStart: 3, colEnd: 7, shape: 'area' }` → `shape: 'square'`

In `game/src/data/skill/Skills.ts`, at each of lines 1325, 1698, 1822, 1841, 2042, 2076: change `targeting: { shape: 'area', ... }` to `targeting: { shape: 'square', ... }` (keep every other field on that line — `laneRadius`/`columnRadius` values — exactly as they are; only the shape literal changes).

In `game/src/core/battle/BattleSystem.castTime.test.ts:307`: `targeting: { shape: 'area', laneRadius: 1, columnRadius: 1 }` → `shape: 'square'`.

In `game/src/core/battle/SkillEffectResolver.ts:316`: `? { ...baseTargeting, shape: 'area' as const, laneRadius, columnRadius }` → `shape: 'square' as const`.

In `game/src/core/skill/SkillSystem.targeting.test.ts`:
- Line 42: `expect(effective.targeting).toEqual({ shape: 'area', laneRadius: 1 })` → `shape: 'square'`
- Line 85: `shape: 'area',` → `shape: 'square',`
- Line 101: `expect(effective.targeting).toEqual({ shape: 'area', laneRadius: 1, columnRadius: 1 })` → `shape: 'square'`
- Line 112: `const shapes = new Set(['single', 'area', 'line', 'all_lanes'])` → `const shapes = new Set(['single', 'square', 'cross', 'line', 'row', 'column', 'all_lanes'])` (this line enumerates the full valid-shape set for a validation test — it must grow to match the Task 1 type, not just rename `'area'`; read the surrounding test to confirm it's asserting "every member of `ActionTargetingShape` is in this set" or similar before editing, and extend accordingly).

- [ ] **Step 3: Run the full renamed-file test suite**

Run: `npx vitest run game/src/core/battle/ActionTargetingSystem.test.ts game/src/core/battle/ActionImpactSystem.test.ts game/src/core/battle/BattleSystem.castTime.test.ts game/src/core/skill/SkillSystem.targeting.test.ts`
Expected: PASS — every renamed assertion matches the renamed literal; the 3 new `cross`/`row`/`column` tests from Task 1 still pass.

- [ ] **Step 4: Commit**

```bash
git add game/src/core/battle/ActionTargetingSystem.test.ts game/src/core/battle/ActionImpactSystem.test.ts game/src/data/skill/Skills.ts game/src/core/battle/BattleSystem.castTime.test.ts game/src/core/battle/SkillEffectResolver.ts game/src/core/skill/SkillSystem.targeting.test.ts
git commit -m "refactor: rename ActionTargetingShape 'area' literal to 'square' at all call sites"
```

---

### Task 3: Full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, zero regressions. In particular, every existing skill in `Skills.ts` that used `shape: 'area'` must produce identical `collectAffected()` results now that it reads `'square'` — the `'square'` branch of both `areaFor()` and `collectAffected()`'s `isInRange` is byte-for-byte the same rectangle logic the old `'area'` branch used, so no skill's live behavior should change. If any test outside the files touched by this plan fails, it indicates a missed `'area'` literal (re-run the Task 2 Step 1 grep) or a consumer that pattern-matches on `ActionTargetingShape` exhaustively (a TypeScript `switch` without a `default` — the compiler error will name the file) — fix and re-run, do not skip or `.skip()` a failing test.

- [ ] **Step 2: Run typecheck**

Run: `npx vue-tsc --noEmit` (or the project's existing typecheck script — check `package.json`'s `scripts` for the exact command already used elsewhere in this repo before running).
Expected: PASS, zero errors. Any exhaustive `switch (shape)` elsewhere in the codebase without a `default` case will now fail to compile until it handles `'square'`/`'cross'`/`'row'`/`'column'` — if the compiler reports one, add the missing case using the same pattern Task 1 used in `areaFor()` (or `default: return <safe fallback>` if a use site is genuinely shape-agnostic — read that call site's context before choosing a fallback).

- [ ] **Step 3: Commit any fixups**

If Steps 1-2 required fixes beyond what Tasks 1-2 anticipated, stage exactly the changed files and commit:

```bash
git add -A
git commit -m "fix: address regressions found during AOE shape extension full-suite verification"
```

If no fixes were needed, skip this step — there is nothing to commit.

## Not Covered By This Plan

- Assigning `'cross'`/`'row'`/`'column'` to any real skill's `targeting` in `Skills.ts` — future content work.
- `BounceChain.ts`/`TrueShot.ts` wiring into `SkillEffectResolver.ts` or `ActionTargetingSystem.ts` — separate future plan.
- Any change to `Skill.ts`'s `laneRadius`/`columnRadius` fields or `targetingForSkill()`'s inference logic beyond the single literal rename in Task 1 Step 3.
- Stat System `speed` conversion — unrelated.
