# AOE Shape Extension — Design Spec

Date: 2026-09-04
Status: Approved (design), not yet planned/implemented

## 1. Motivation

The turn-based combat design spec (§4,
`docs/superpowers/specs/2026-09-03-turn-based-combat-design.md`) calls for
6 AOE shapes: single/cross/square/line/row/column, all routed through the
grid. Milestone 1 (Foundation) built `game/src/core/battle/turn/AoeShape.ts`
as a **standalone** pure-function module with exactly this shape set
(`AoeShapeId = 'single' | 'cross' | 'square' | 'line' | 'row' | 'column'`,
`isCellInShape()`, `boundingBoxForShape()`, fully tested in
`AoeShape.test.ts`) — built before the survey (2026-09-04) discovered the
game already has a **live, production** shape/targeting system:
`ActionTargetingShape = 'single' | 'area' | 'line' | 'all_lanes'` in
`game/src/core/battle/CombatAction.ts:10`, resolved by `areaFor()` /
`collectAffected()` in `game/src/core/battle/ActionTargetingSystem.ts:150-225`,
consumed by `ActionTargeting` at 12 symbol-reference call sites across
`SkillSpecialization.ts`, `Skill.ts`, `SkillSystem.ts`,
`SkillEffectResolver.ts` and others. A follow-up grep for the actual
`'area'` string literal (the one that needs renaming) found 23
occurrences across 9 files — a small, fully enumerable list, given
verbatim per-file/per-line in the implementation plan.

Two shape systems must not remain parallel. This spec locks how they merge.

## 2. Decisions (locked via brainstorming, 2026-09-04)

1. **`AoeShape.ts` stays as a pure-function helper module** —
   `isCellInShape()` / `boundingBoxForShape()` are not deleted, not
   inlined. `ActionTargetingSystem.ts` calls into them for the shapes that
   need real (non-rectangular) shape math (`cross`). This preserves the
   already-tested Foundation logic and avoids a second implementation of
   the same math.
2. **`ActionTargetingShape` is extended in place, and `'area'` is renamed
   to `'square'`** everywhere (type + all 68 call sites), matching the
   spec's real vocabulary. `'cross'`, `'row'`, `'column'` are added as new
   union members. `'single'`, `'line'`, `'all_lanes'` are unchanged.
3. **Scope is code-only.** This plan renames the shape resolver and its
   call sites (mechanical, one string literal at a time) and adds the 3
   new shape branches to `areaFor()`/`collectAffected()`/`isCellInShape`
   wiring. It does **not** assign `'cross'`/`'row'`/`'column'` to any real
   skill's data — no `Skill.ts` content changes, no new skill behavior.
   That is future skill-content work, separate from this plan.
4. **`BounceChain.ts` and `TrueShot.ts` wiring is explicitly out of
   scope** for this plan — each gets its own future plan (per the
   project's standing "one system, one plan" rule). This plan only
   touches the shape/targeting resolver.

## 3. Technical Grounding (verified against current source, 2026-09-04)

- `game/src/core/battle/CombatAction.ts:10` — `export type ActionTargetingShape = 'single' | 'area' | 'line' | 'all_lanes'`
- `game/src/core/battle/CombatAction.ts:25-31` — `ActionTargeting { shape, laneRadius?, columnRadius?, maxTargets?, selection? }`
- `game/src/core/battle/CombatAction.ts:33-55` — `targetingForSkill()` synthesizes `shape: laneRadius>0||columnRadius>0 ? 'area' : 'single'` when a skill has no explicit `targeting` — this call site's literal `'area'` also renames to `'square'`.
- `game/src/core/battle/ActionTargetingSystem.ts:150-169` — `areaFor()` switches on `targeting.shape`, returns a rectangular `CellArea` for `single`/`area`/`line`/`all_lanes`.
- `game/src/core/battle/ActionTargetingSystem.ts:179-225` — `collectAffected()` calls `areaFor()` then filters enemies by **rectangular row/column bounds** (`enemy.entity.row >= area.rowStart && ...`). This rectangle-bounds filter is CORRECT for `single`/`square`(was `area`)/`line`/`all_lanes`/`row`/`column` (all of these are true rectangles or degenerate to one), but **WRONG for `cross`** — a cross shape is not a rectangle (its bounding box includes corner cells the real shape excludes). `collectAffected()` must switch its per-enemy inclusion test from "rectangle bounds check" to `isCellInShape()` from `AoeShape.ts` when `targeting.shape === 'cross'`.
- `game/src/core/battle/turn/AoeShape.ts:8` — `AoeShapeId` already `'single' | 'cross' | 'square' | 'line' | 'row' | 'column'` — this is the exact target vocabulary; no changes needed to this file's shape ids.
- `game/src/core/battle/turn/AoeShape.ts:49-65` — `isCellInShape(anchor, spec, cell)` — `cross` branch: `(cell.column === anchor.column && |cell.row - anchor.row| <= radius) || (cell.row === anchor.row && |cell.column - anchor.column| <= radius)`. This is the real per-cell test `collectAffected()` needs for `cross`.
- `AoeShapeSpec` (`AoeShape.ts:10-15`) shape is `{ shape, radius, axis? }` — different field names than `ActionTargeting`'s `{ shape, laneRadius, columnRadius }`. A small adapter (mapping `ActionTargeting.laneRadius`/`columnRadius` → an `AoeShapeSpec.radius`, using `laneRadius` for `cross`) is needed at the call site in `collectAffected()` — not a shared type merge (out of scope, would ripple into `AoeShape.test.ts`'s own established interface).

## 4. What Changes

- `game/src/core/battle/CombatAction.ts`:
  - `ActionTargetingShape` → `'single' | 'square' | 'cross' | 'line' | 'row' | 'column' | 'all_lanes'` (rename `area`→`square`, add `cross`/`row`/`column`).
  - `targetingForSkill()`'s literal `'area'` → `'square'`.
- `game/src/core/battle/ActionTargetingSystem.ts`:
  - `areaFor()` gains `row`/`column` cases (full-row / full-column rectangles, reusing the same `getCellsInArea` pattern already used for `all_lanes`), renames its `'area'` case to `'square'`, and returns `null` for `'cross'` (cross has no single bounding rectangle usable by the existing filter — see below).
  - `collectAffected()`'s enemy-inclusion filter switches from "always rectangle bounds" to: for `'cross'`, call `isCellInShape()` (imported from `AoeShape.ts`) per-candidate instead of the rectangle check; for every other shape, keep the existing rectangle-bounds filter unchanged.
- All 68 call sites/tests using the string literal `'area'` as an `ActionTargetingShape` value are updated to `'square'` (mechanical rename, no behavior change for existing skills — every current skill still resolves to the exact same cells it did before).

## 5. Testing

- `ActionTargetingSystem.test.ts` (existing, has no current coverage per
  codegraph's blast-radius scan — first real test coverage added by this
  plan): cases for `square` (renamed, same behavior as old `area`),
  `cross` (via `collectAffected`, asserting corner cells are excluded
  while the cross arms are included — this is the regression `AoeShape.ts`
  was already built to prevent), `row`, `column`.
- `AoeShape.test.ts` — unchanged, still the source of truth for
  `isCellInShape`'s cross-shape correctness; `collectAffected()`'s new
  cross branch is a thin consumer of it, not a re-implementation.

## 6. What This Does Not Cover

- No skill in `game/src/data/**` is changed to use `cross`/`row`/`column` —
  they remain purely available shapes with zero live users until a
  future content pass assigns them.
- `BounceChain.ts`, `TrueShot.ts` — separate future plan.
- Any Stat System `speed` change — unrelated.
