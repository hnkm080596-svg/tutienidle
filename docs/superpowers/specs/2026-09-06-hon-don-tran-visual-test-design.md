# Hỗn Độn Trận — Visual Test Tooling for Trận Pháp Design

**Date:** 2026-09-06
**Status:** Approved (brainstormed inline, user confirmed each section)
**Depends on:** `2026-09-05-combat-art-pipeline-rework-design.md`, `2026-09-05-companion-roster-system-design.md`, `2026-09-05-tran-phap-formation-system-design.md` (all shipped, mechanism-only, on `master`)

## Problem

Part A/B/C of the combat-art-roster-tranphap plan shipped the *mechanism* for
Trận Pháp (drag-and-drop formation editor, real placement wiring into
`buildTurnBattle()`) and Companion Roster, but both are content-empty
(`TRAN_PHAP_FORMATIONS: []`, `COMPANIONS: []`) and visually unverifiable:

- The formation editor (`TranPhapPanel.vue`) is a flat CSS grid of empty
  `<div>` cells showing raw `combatantId` strings — no sense of how the
  formation will actually look on the real battlefield.
- Every combat entity (real battle included) currently animates via
  `buildPlaceholderAnimationSet()` reusing a *static* 1-frame image as its
  "sheet" — there is no way to visually confirm the Phaser
  `AnimationManager`/frame-cycling pipeline is actually running versus
  silently frozen (the exact failure shape of the 2026-09-05 freeze
  incident, one layer up the stack).
- With `TRAN_PHAP_FORMATIONS` empty, there is no formation that exercises
  every one of the 36 local cells at once — a real content author's first
  formation would only touch a handful of cells, leaving most of the grid
  wiring never visually exercised.

This spec adds test-only tooling to make the already-shipped mechanism
*visually verifiable* — no new gameplay system, no change to enemy spawn
behavior (explicitly confirmed out of scope, see Non-Goals).

## Goals

1. A single placeholder spritesheet, used everywhere `buildPlaceholderAnimationSet()`
   is called (real combat scene included), that makes animation state
   visually obvious: 32 frames, each stamped with its own frame number
   (0–31), so a human watching the screen can immediately tell whether
   `AnimationManager` is cycling frames or stuck.
2. A "Hỗn Độn Trận" (`hon_don_tran`) formation whose `cellPattern` covers
   all 36 cells of the local 6×6 grid — a stress-test formation with every
   slot unlocked.
3. Five test-only `CompanionDefinition` entries so `TranPhapPanel.vue` has
   enough draggable bodies to actually fill a meaningful part of a 36-cell
   grid.
4. `TranPhapPanel.vue` renders its 6×6 grid via an embedded Phaser scene
   (flat, no perspective) instead of plain `<div>`s, so placed
   combatants render as real animated sprites using goal #1's asset.
   Drag-and-drop interaction is unchanged (same HTML5 D&D code from Task
   20) — only the *visual* layer moves from text-in-divs to
   Phaser-rendered sprites.

## Non-Goals

- **No change to `EnemySpawnPlacement.ts`/`resolveEnemySpawnPosition()`.**
  Confirmed with the user: enemies already spawn randomly within
  `ENEMY_SIDE_REGION`, count preset per stage — this is the intended
  design, not a gap. This spec adds a regression test asserting that
  behavior is unaffected by everything else here, and touches no
  production logic in that file.
- **No enemy-side grid in `TranPhapPanel.vue`.** The panel renders only
  the player's local 6×6 (`PLAYER_SIDE_REGION`'s local space) — not the
  full 6×13 battlefield strip. Explicitly reduced from an earlier draft
  of this design after the user caught the over-scope.
- **No reward/loot timing change.** A separate, unrelated request
  (remove mid-battle instant loot toasts, show once at victory) was
  raised in the same conversation and explicitly deferred to its own
  future brainstorm — `BattleLootSystem.ts` is not touched by this spec.
- **No real content.** `hon_don_tran` and the 5 test companions are
  marked TEST-ONLY in code comments; a future balance/content pass
  replaces or removes them the same way `COMPANIONS`/`TRAN_PHAP_FORMATIONS`
  are already documented as mechanism-only.
- **No perspective/projection math in the panel.** Explicitly rejected by
  the user — flat grid only. `BattleGridProjection.ts` (the real combat
  scene's perspective system) is not reused or extended here.

## Design

### 1. Global placeholder spritesheet

**Current mechanism** (`game/src/game/support/CombatAnimationSet.ts`):
`buildPlaceholderAnimationSet(entityKey, staticTextureUrl, frameSize)`
returns a `CombatAnimationSet` whose 5 clips (idle/ready/cast/standby/death)
all point `sheetUrl` at the entity's own static PNG with `frameCount: 1`.
Loading is asset-file-based (`scene.load.spritesheet(sheetKey, sheetUrl,
{frameWidth, frameHeight})` in `CombatPreload.ts`'s `queueCombatAssets()`),
and animation creation reads `clip.frameCount` to build
`generateFrameNumbers(sheetKey, {start: 0, end: frameCount - 1})`
(`CombatScene.ts`'s `registerCombatAnimations()`). Display size is set via
`gameSprite.setDisplaySize(width, characterHeight * sizeMultiplier)` —
**absolute pixel size, independent of the source texture's native
dimensions** (confirmed by reading `combat-grid-view.ts`).

This means a single shared placeholder asset, at one canonical frame size,
can replace every entity's individual 1-frame reuse with zero changes to
the loading or animation-registration pipeline — only
`buildPlaceholderAnimationSet()`'s own body changes.

**New asset:** one PNG, a vertical strip of 32 frames. Each frame: a
portrait-oriented rounded rectangle silhouette (representing a standing
character, taller than wide) with its frame index (`0`–`31`) rendered as
large, high-contrast text centered in the frame. Generated once by a
script (canvas/PIL, whatever is available in the implementation
environment) and committed as a static asset — **not** generated at
Phaser runtime — because the existing loader is asset-file-based and
introducing a parallel runtime-`generateTexture()` path would be an
unrequested architecture change (P9). Committing a new asset path means
updating the Asset Manifest per this project's existing convention.

**Fix to `buildPlaceholderAnimationSet()`:** the function's `staticTextureUrl`/`frameSize`
parameters are no longer used to build the sheet — every call now points
at the shared placeholder asset with `frameCount: 32` and the asset's own
canonical frame dimensions, regardless of what the caller passes for
sizing (sizing stays governed entirely by `sizeMultiplier` +
`setDisplaySize()`, unaffected). Frame rate: modest (documented, tunable
constant) so the number is legible while cycling — legibility matters
more than realism here.

This changes the *animation sheet* for every combat entity everywhere
(real battle included, confirmed by the user as intentional) — it does
**not** touch the separate "plain image" texture keys used for
non-animated purposes (`combat-grid-view.ts`'s icon/portrait usages,
`MainScene.ts`) — those are a different texture key entirely (see Part
A's Task 9 deferred note on double texture loading) and are out of scope.

### 2. `hon_don_tran` formation

Added to `TRAN_PHAP_FORMATIONS` (`game/src/data/formation/TranPhap.ts`,
currently `[]`):

```ts
{
  id: 'hon_don_tran',
  name: 'Hỗn Độn Trận',
  cellPattern: /* all 36 cells: row 0-5 × column 0-5 */,
  buff: { definitionId: 'hon_don_tran_test_buff' }, // TEST-ONLY, see below
  description: '...',
}
```

`buff.definitionId` points at a harmless test-only buff. If it does not
resolve in `TURN_BUFF_REGISTRY` for any reason, `buildTurnBattle()`
already skips gracefully (Task 19's fix, `GameManager.ts`) rather than
crashing — this formation is exactly the kind of content this guard exists
for, so no additional wiring safety work is needed here, but the buff
should still resolve for a clean test experience.

### 3. Five test-only companions

Added to `COMPANIONS` (`game/src/data/companion/Companions.ts`, currently
`[]`) — 5 `CompanionDefinition` entries, clearly named/commented
TEST-ONLY, using placeholder `baseStats` and a trivial `basic`
`TurnSkillDefinition` (matching the shape already established in Task
10/12's test fixtures). They exist purely so `TranPhapPanel.vue`'s
combatant queue has bodies to drag into `hon_don_tran`'s 36 cells.

### 4. `TranPhapPanel.vue` — Phaser-rendered flat 6×6 grid

Current state (Task 20, already shipped): `<OverlayPanel>` wrapping a CSS
grid of `<div class="tran-phap-panel__cell">`, native HTML5
`draggable`/`@dragstart`/`@dragover.prevent`/`@drop` for interaction.

**Change:** the grid's *visual* rendering moves into a small embedded
Phaser scene (new, panel-local — not a reuse of the real `CombatScene`)
that:
- Draws a clear 6×6 gridline (flat — no perspective transform, no reuse
  of `BattleGridProjection.ts`).
- Renders one background layer/rect beneath the grid, currently a flat
  fill, reserved so a real background image can be dropped in later
  without restructuring the scene.
- Renders a sprite (using goal #1's shared placeholder animation set,
  playing the `idle` clip) at each occupied cell's Phaser-space
  coordinates, computed by simple flat math (`row * cellSize`, `column *
  cellSize`) — no perspective, no projection helper reuse.

**Interaction stays HTML, not Phaser:** the existing native drag-and-drop
markup (`onDrop`/`onDragStart`/`isLitCell`) remains as an **invisible DOM
grid overlaid on top of the Phaser canvas**, same 6×6 cell geometry,
`pointer-events` active only on that overlay. This preserves Task 20's
already-tested drag-and-drop logic completely unchanged — only what
renders *underneath* the drop targets changes from text to sprites. The
Phaser canvas itself is purely a rendering surface, never a drag/drop
target.

## Verification

- `buildPlaceholderAnimationSet()` unit tests: confirm every clip now
  reports `frameCount: 32` and points at the shared placeholder asset
  regardless of caller-provided size/URL.
- `TranPhap.test.ts`: `hon_don_tran`'s `cellPattern` covers exactly the 36
  cells of the 0–5×0–5 space (existing test already asserts every cell
  stays within 0–5 bounds; add an explicit count/coverage assertion for
  this formation).
- `Companions.test.ts`: existing tests (unique id, valid grade + basic
  skill) already cover the 5 new entries without modification.
- New regression test confirming `resolveEnemySpawnPosition()`'s behavior
  is byte-for-byte unchanged (same signature, same region, same
  distribution) — proves Non-Goal #1 held.
- Manual/E2E: open the Trận Pháp panel, select Hỗn Độn Trận, confirm all
  36 cells render as drop targets, drag several test companions in,
  confirm sprites animate (frame number visibly cycling) at their placed
  cells.
- Full existing suite (`npx vitest run`) + `npm run type-check` stay
  green throughout — this is purely additive/substitutive, no existing
  behavior in the shipped mechanism changes shape.

## Risks / Notes

- Asset Manifest workflow must be updated for the new placeholder PNG
  path (project convention — see `tienhiep-asset-manifest` memory).
- Swapping the placeholder sheet globally means the **real battle scene**
  will also show numbered-frame animation instead of a frozen single
  frame until real art lands — confirmed intentional by the user.
- The panel's own Phaser scene is a second, independent Phaser instance
  from the real `CombatScene`/`MainScene` — standard multi-scene Phaser
  usage, but the implementation should confirm texture/animation keys
  registered for it don't collide with the real game's registry (Phaser's
  `TextureManager`/`AnimationManager` are global to the `Phaser.Game`
  instance, not per-scene) — likely resolved by registering this panel's
  placeholder animation under its own distinct key namespace, or simply
  reusing the exact same shared keys since the asset and clip
  definitions are identical either way.
