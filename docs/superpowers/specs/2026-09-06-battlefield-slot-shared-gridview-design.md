# Battlefield Slot — Shared `CombatGridView` Between Real Combat and Trận Pháp Panel

**Date:** 2026-09-06
**Status:** Approved (brainstormed inline, user confirmed each section)
**Depends on:** `2026-09-06-hon-don-tran-visual-test-design.md` (shipped — `TranPhapPreviewScene`, `TranPhapPanel.vue` drag-and-drop, placeholder spritesheet)
**Precedes (separate future specs, same overall initiative, in this order):**
1. This spec (Slot abstraction + shared `CombatGridView`)
2. 2.5D projection for the panel (reuse/generalize `BattleGridProjection` for a 6×6 sub-region)
3. Wave spawn redesign (per-stage authored `waves: number[]`, 1–5 enemies/wave, replacing the current 1-enemy-per-wave × N-waves model)
4. Spawn VFX wiring for turn-based combat (`EnemySpawnVfx.ts` telegraph reused for the 3→2→1 countdown and every new/revived unit)

## Problem

The Hỗn Độn Trận visual test tooling (shipped 2026-09-06) gave the Trận Pháp
panel its own hand-rolled Phaser scene, `TranPhapPreviewScene`, duplicating a
small slice of what `CombatGridView` (the real combat renderer) already does:
create a sprite, play its idle animation, position it in a grid cell. This
duplication has already caused one real bug (animation restarting from frame
0 on every drag-drop, because the duplicate's `syncAssignments()` destroyed
and recreated every sprite on every change — fixed ad hoc on 2026-09-06, but
the fix re-implements sprite-lifecycle logic `CombatGridView` already has,
correctly, for combat).

The user wants the panel to eventually look and behave like real combat
(2.5D perspective, same sprite lifecycle, same visual language) and asked
directly: "tại sao bạn không dùng combatgridview cho trận pháp?" ("why
don't you use CombatGridView for Trận Pháp?"). Investigation confirmed
`CombatGridView` cannot be reused as-is — its constructor takes a concrete
`CombatScene` and reads ~15 properties directly off it
(`this.scene.projection`, `this.scene.isPerspective`,
`this.scene.characterWidth`, `this.scene.playerProfile`, `this.scene.add`,
`this.scene.physics`, `this.scene.textures`, `this.scene.sprites`, etc.) —
it is a helper module extracted from `CombatScene.ts` (see
`combat-grid-view.ts:1-4`'s own header comment: "tách từ CombatScene.ts...
mọi cross-call đi qua scene delegate"), not a standalone renderer.

This spec generalizes `CombatGridView` behind a narrow host interface so
both `CombatScene` (real combat, production-critical, heavily tested) and a
new, much simpler Trận Pháp preview scene can drive the exact same
sprite/grid rendering code — with zero behavior change for real combat.

## Goals

1. Extract a `CombatGridViewHost` interface capturing exactly what
   `CombatGridView` needs from its host scene today (Phaser primitives +
   battlefield state fields) — nothing more, nothing derived speculatively.
2. `CombatScene implements CombatGridViewHost` with **zero behavior
   change** — every field it needs already exists on `CombatScene` today
   (this step is a type-level contract, not a rewrite), except one new
   one-line method (`fallbackSpriteTextureKey()`, §4) that unconditionally
   returns `undefined` — provably a no-op addition, not a rewrite either.
3. `CombatGridView`'s constructor takes `host: CombatGridViewHost` instead
   of `scene: CombatScene`; every internal `this.scene.x` reference becomes
   `this.host.x`. The handful of places where `CombatGridView` currently
   calls back through `this.scene.applySpriteSize()` /
   `this.scene.applyEntityDepthScale()` / `this.scene.updateEnemyHealthBar()`
   / `this.scene.entityHeadY()` (all four are thin delegates on
   `CombatScene` that just forward to `this.gridView.xxx()` — a
   self-referential round-trip) call the method on `this` directly instead.
4. A new, minimal preview scene (replacing `TranPhapPreviewScene`)
   implements `CombatGridViewHost` with the smallest possible real state —
   flat rendering (`isPerspective: false`, matching the already-approved
   Non-Goal from the prior spec: no perspective yet, that is Part 2's job),
   6×6 grid, no health bars (health is optional in `getOrCreateSprite`'s
   signature already — omitting it is a supported, existing code path, not
   a new branch). It drives `CombatGridView` for sprite creation/
   positioning/destruction instead of hand-rolled Phaser calls.
5. Introduce the `SlotState` vocabulary (`'enabled' | 'locked' | 'disabled'
   | 'hover' | 'occupied'`) as a shared type, consumed today only by the
   panel (locked = outside the selected formation's `cellPattern`,
   occupied = has an assignment, hover = active drag-over) — real combat
   does not need interactive cell states yet, but the type lives in a
   shared module so a future feature (manual targeting, cell tooltips)
   does not have to invent its own vocabulary.
6. Fix the animation-reset bug as a *side effect* of reusing
   `CombatGridView`'s existing sprite lifecycle (`getOrCreateSprite` is a
   no-op if the id is already in `this.host.sprites` — sprites are only
   created once and left alone until explicitly destroyed), replacing the
   2026-09-06 ad hoc diff fix in `TranPhapPreviewScene.syncAssignments()`
   with the same mechanism real combat already relies on.

## Non-Goals

- **No 2.5D/perspective for the panel yet.** Explicitly deferred to Part 2
  of this initiative (its own future spec). This spec keeps the panel
  `isPerspective: false`, using `CombatGridView`'s existing flat/Rectangle
  code paths.
- **No wave-spawn redesign, no spawn VFX wiring.** Parts 3 and 4, separate
  future specs.
- **No change to real combat's visual behavior, tests, or performance.**
  `CombatScene`/`combat-grid-view.test.ts`'s existing assertions must pass
  unchanged — this is a pure extraction, not a rewrite of combat rendering.
- **No health bars, no depth-sorting, no boss scaling in the panel.** The
  panel's host simply never passes a `health` argument to
  `getOrCreateSprite()` — the existing `health?:` optional parameter
  already handles this (see `combat-grid-view.ts:252-257`), no new branch
  needed.
- **No change to `TranPhapPanel.vue`'s drag-and-drop interaction code**
  (`onDrop`/`removeAssignment`/click-to-remove/drag-from-cell — all shipped
  2026-09-06). This spec only changes what draws *underneath* the existing
  HTML overlay, same boundary the prior spec established.

## Design

### 1. `CombatGridViewHost` interface

New file `game/src/game/scenes/combat/CombatGridViewHost.ts`, extracted
verbatim from what `combat-grid-view.ts` currently reads off `this.scene`:

```ts
export interface CombatGridViewHost {
  // Phaser primitives CombatGridView calls directly.
  readonly add: Phaser.GameObjects.GameObjectFactory
  readonly physics: Phaser.Physics.Arcade.ArcadePhysics
  readonly textures: Phaser.Textures.TextureManager

  // Battlefield/rendering state.
  readonly isPerspective: boolean
  readonly projection: BattleGridProjection | undefined
  readonly gridGraphics: Phaser.GameObjects.Graphics | undefined
  readonly usingArtBackdrop: boolean
  readonly arenaRect: Phaser.GameObjects.Rectangle | undefined
  readonly characterWidth: number
  readonly characterHeight: number
  readonly playerSourceSize: { w: number; h: number }
  readonly playerProfile: { combatTextureKey: string }
  readonly sprites: Map<string, EntitySprite>
  entityFootMinY: number
  entityFootMaxY: number

  // resetVisual() only — Phaser.Scene subclasses get `tweens` for free
  // (TranPhapCombatPreviewScene extends Phaser.Scene, no extra work);
  // `interpolations` the panel provides as a trivial empty Map (it does
  // not interpolate positions) — resetVisual()'s `.get(PLAYER_ID)` on an
  // empty map returns undefined, already guarded by `if (entry)`.
  readonly tweens: Phaser.Tweens.TweenManager
  readonly interpolations: Map<string, unknown>

  /**
   * Texture key dùng cho sprite khi id không phải PLAYER_ID và không khớp
   * resolveEnemyTextureKey() — combat thật trả undefined (Rectangle
   * fallback, hành vi hiện tại không đổi); panel Trận Pháp trả về sheet
   * placeholder dùng chung. Xem §4 "Texture key note".
   */
  fallbackSpriteTextureKey(id: string): string | undefined
}
```

`CombatScene` already declares every one of these fields today (confirmed
by reading `CombatScene.ts`: `projection?`, `isPerspective` getter,
`characterWidth`/`characterHeight`, `playerSourceSize`, `playerProfile`,
`sprites`, `entityFootMinY`/`entityFootMaxY`, `arenaRect?`,
`usingArtBackdrop`, `gridGraphics`) — adding `implements CombatGridViewHost`
to the class declaration is the only change needed on `CombatScene` itself
for this step. No field is renamed, retyped, or removed.

### 2. `CombatGridView` decoupling

`combat-grid-view.ts`'s constructor:

```ts
// Before
constructor(private readonly scene: CombatScene) {}

// After
constructor(private readonly host: CombatGridViewHost) {}
```

Every `this.scene.x` inside `combat-grid-view.ts` becomes `this.host.x`,
**except** the five self-referential delegate calls
(`this.scene.applySpriteSize(...)`, `this.scene.applyEntityDepthScale(...)`,
`this.scene.updateEnemyHealthBar(...)`, `this.scene.entityHeadY(...)`,
`this.scene.positionSprite(...)` — the last one appears once, inside
`resetVisual()`), which become direct calls to the method already defined
on `CombatGridView` itself (`this.applySpriteSize(...)`, etc.) — removing
a round-trip through a host that, for the panel, will not define matching
delegate methods (the panel calls `CombatGridView`'s methods directly, it
is not itself a "scene with delegates" the way `CombatScene` is).
`this.scene.tweens`/`this.scene.interpolations` (both only inside
`resetVisual()`) become `this.host.tweens`/`this.host.interpolations` —
plain field reads, not delegates.

`CombatScene.ts`'s own `_gridView` lazy getter changes from
`new CombatGridView(this)` to `new CombatGridView(this)` — **unchanged**,
because `CombatScene` now satisfies `CombatGridViewHost` structurally; no
call-site change needed there.

### 3. `SlotState` type

New file `game/src/game/support/SlotState.ts`:

```ts
// Slot — vocabulary chung cho trạng thái tương tác của 1 ô chiến trường,
// dùng bởi panel Trận Pháp hôm nay (combat thật chưa có tương tác click/
// kéo trên ô, nhưng type nằm ở đây để tính năng sau (targeting thủ công,
// tooltip theo ô) không phải tự bịa lại 1 bộ tên khác).
export type SlotState = 'enabled' | 'locked' | 'disabled' | 'hover' | 'occupied'
```

No resolver function is added in this spec — the panel computes state
inline from data it already has (`isLitCell()`, `assignmentAt()`, native
HTML5 dragover), it just labels the resulting CSS class with this
vocabulary instead of the current single boolean
(`tran-phap-panel__cell--lit`). A shared `slotStateFor()` helper is
speculative until a second real consumer exists — YAGNI per project
convention.

### 4. New panel scene: `TranPhapCombatPreviewScene`

Replaces `TranPhapPreviewScene` (deleted, not deprecated — nothing else
imports it; confirmed via `grep -rn TranPhapPreviewScene` returning only
`TranPhapPanel.vue` and its own test file). Implements
`CombatGridViewHost` with the smallest real values:

```ts
export class TranPhapCombatPreviewScene extends Phaser.Scene implements CombatGridViewHost {
  readonly isPerspective = false
  projection: BattleGridProjection | undefined
  gridGraphics: Phaser.GameObjects.Graphics | undefined
  readonly usingArtBackdrop = false
  arenaRect: Phaser.GameObjects.Rectangle | undefined
  characterWidth = PREVIEW_CELL_SIZE
  characterHeight = PREVIEW_CELL_SIZE
  readonly playerSourceSize = { w: 1, h: 1 } // không dùng khi isPerspective=false, applySpriteSize() flat đọc characterWidth/Height trực tiếp — giữ 1:1 tránh chia 0.
  readonly playerProfile = { combatTextureKey: PLACEHOLDER_SHEET_KEY }
  sprites = new Map<string, EntitySprite>()
  entityFootMinY = 0
  entityFootMaxY = 1
  readonly interpolations = new Map<string, unknown>() // resetVisual() không dùng ở panel — Map rỗng thỏa mãn type, .get() luôn undefined.
  // `tweens` KHÔNG khai ở đây — Phaser.Scene đã có sẵn `this.tweens`, lớp con thỏa mãn CombatGridViewHost tự động.

  private gridView!: CombatGridView

  create(): void {
    this.gridView = new CombatGridView(this)
    // ... vẽ nền + gọi this.gridView.redrawGridLines() thay vì tự vẽ Graphics tay.
  }

  syncAssignments(assignments: FormationSlotAssignment[]): void {
    const nextIds = new Set(assignments.map((a) => a.combatantId))

    for (const [id, sprite] of this.sprites) {
      if (!nextIds.has(id)) {
        this.gridView.destroyEntitySprite(sprite)
        this.sprites.delete(id)
      }
    }

    for (const assignment of assignments) {
      const sprite = this.gridView.getOrCreateSprite(
        assignment.combatantId,
        0x4caf50,
        assignment.combatantId,
        assignment.row as LaneIndex,
      )

      this.gridView.positionSprite(sprite, assignment.column)
    }
  }
}
```

`getOrCreateSprite`'s existing no-op-if-exists guard
(`combat-grid-view.ts:259-263`: `if (existing) { return existing }`) is
what fixes the animation-reset bug for free — an id already in
`this.sprites` is never destroyed/recreated by this loop, only
repositioned.

**Texture key note:** `getOrCreateSprite`'s enemy branch (the one this
scene's non-`PLAYER_ID` sprites fall into, since `PLAYER_ID` is a specific
constant `'player'` string only real combat's player uses) resolves
texture via `resolveEnemyTextureKey(id)` — for the panel's
`combatantId`s (`'player'`, `'test_companion_1'`, ...) this will not match
any real enemy template, so every sprite falls to the **Rectangle
fallback** branch (`combat-grid-view.ts:382-447`), not the sprite/
animation path. This is a real gap this spec must close: add a small
override path (documented below) so the panel's sprites use the shared
placeholder spritesheet/animation instead of a plain colored rectangle,
preserving Goal 6 (animation must still play).

**Resolution (revised after self-review):** checking "does the player's
texture key happen to exist" is NOT a safe discriminator — the player's
texture is *always* preloaded in real combat (`queueCombatAssets()`
always queues it), so a naive
`this.host.textures.exists(this.host.playerProfile.combatTextureKey)`
check would be true for every real-combat enemy that legitimately falls
to the Rectangle fallback today (an id outside the Mortal art batch,
`resolveEnemyTextureKey(id)` returns `undefined`) — silently redirecting
them to render as the *player's* sprite instead of their intended
Rectangle, a real regression to existing, intentional combat behavior.

Instead, use the explicit `fallbackSpriteTextureKey(id)` host method
already added to the interface in §1 (not inferred from texture
existence). `getOrCreateSprite`'s branch order becomes: `id === PLAYER_ID` → player
branch (unchanged) → `resolveEnemyTextureKey(id)` match → enemy sprite
branch (unchanged) → **else, if `this.host.fallbackSpriteTextureKey(id)`
returns a key that `this.host.textures.exists()`** → reuse the sprite/
animation wiring generically with that key → else Rectangle fallback
(unchanged). `CombatScene.fallbackSpriteTextureKey()` returns `undefined`
unconditionally — a one-line method, provably zero behavior change (the
new branch is dead code for real combat, by construction, not by
incidental texture-existence timing).
`TranPhapCombatPreviewScene.fallbackSpriteTextureKey()` returns
`PLACEHOLDER_SHEET_KEY` unconditionally.

`TranPhapPanel.vue`'s `<script setup>` changes only its dynamic import
target (`TranPhapPreviewScene` → `TranPhapCombatPreviewScene`) and the
`PREVIEW_CELL_SIZE`/`PREVIEW_GRID_SIZE` constants' new home (moved to the
new scene file, same values, same meaning) — the `watch()`-driven
Phaser.Game lifecycle, drag-and-drop overlay, and all Vue-side logic
shipped 2026-09-06 are untouched.

## Verification

- `combat-grid-view.test.ts` (existing, real combat) passes **unchanged**
  — proves the extraction preserved real combat's behavior exactly.
- New `CombatGridViewHost`-conformance check: `CombatScene` compiles as
  `implements CombatGridViewHost` with zero added/changed fields (a
  type-level proof, not a runtime test).
- New test asserting `CombatScene.fallbackSpriteTextureKey('anything')`
  returns `undefined` for every input, AND a `combat-grid-view.test.ts`
  case with an enemy id outside the Mortal art batch still renders as a
  Rectangle (not the player's texture) — proves the new branch is
  provably dead for real combat, not just "currently doesn't trigger."
- New test for `TranPhapCombatPreviewScene`: dropping a combatant creates
  a sprite; dropping a second combatant does **not** destroy/recreate the
  first sprite's `Phaser.GameObjects.Sprite` instance (identity check via
  object reference in `this.sprites`) — this is the regression test for
  the animation-reset bug, replacing the ad hoc fix's now-deleted logic.
- Full suite (`npx vitest run`) + `npm run type-check` stay green
  throughout.
- Manual Playwright pass (same guest-flow pattern as the prior spec):
  open Trận Pháp panel, drag several companions in, confirm sprites
  animate and do **not** visibly restart/flicker when a *different* cell
  changes.

## Risks / Notes

- This is the highest-blast-radius change of the whole four-part
  initiative — it touches `combat-grid-view.ts`, a file real combat
  depends on every frame. Implementation happens in an isolated worktree;
  the pre-flight and per-task review loop (SDD) must explicitly diff
  `combat-grid-view.ts`'s behavior for every existing call site
  (`getOrCreateSprite`, `positionSprite`, `applySpriteSize`,
  `applyEntityDepthScale`, `updateEnemyHealthBar`, `destroyEntitySprite`,
  `updateEntityDepths`, `redrawGridLines`, `resetVisual`) before/after,
  not just run the test suite.
- The new `else if` branch in `getOrCreateSprite()` (texture-override
  fallback) is the one piece of *real combat's* production code this spec
  actually edits (everything else in `combat-grid-view.ts` is a rename,
  `this.scene` → `this.host`). It must be reviewed with the same rigor as
  a production combat change, not waved through as "just extraction."
- `TranPhapPreviewScene.ts`/`.test.ts` (2026-09-06) are deleted in this
  spec's plan, not kept alongside the new scene — confirmed no other
  consumer exists.
- Parts 2–4 (2.5D projection, wave redesign, spawn VFX) each get their own
  spec once this one ships and is reviewed — this spec's Non-Goals are
  deliberate deferrals, not omissions.
