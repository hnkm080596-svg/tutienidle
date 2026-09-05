# Combat Art Pipeline Rework — Entity Sync + Sprite Sheet Animation + Battlefield Region + Skill Dock Design

**Date:** 2026-09-05 (updated same day with real battlefield-region bounds + screen-layout dock)
**Status:** Approved by user, ready for implementation plan.

## 1. Problem

Two related problems, addressed together per explicit user decision (this project's usual "one spec per system" convention is overridden here since the pieces are tightly coupled):

### 1.1 Regression — combat entity visuals are disconnected (confirmed bug, not a documented gap)

`CombatScene.ts` receives 100% of its entity-visual data (which sprites exist, their row/x, hp) through a single event, `'positions'` (`BattlePositionsEvent`, `game/src/core/battle/BattleEvents.ts:32`). That event is only ever emitted by the retired real-time engine (`game/src/core/battle/legacy/BattleSystem.ts:837`, inside `emitPositions()`), called from that engine's own `start()`/`flushPendingSpawns()`/`update(deltaSeconds)`.

At the Slice 6 cutover, `GameManager.updateBattleFixedStep()` stopped calling `legacyBattleSystem.update(step)` and replaced it with `syncLegacyBattleState()` (`GameManager.ts:3730-3740`), which only copies `state` (`'fighting'`/`'victory'`/etc.) between the turn engine and the legacy shim — it never re-derives positions/hp/entity lists, and never calls `emitPositions()`. Since nothing else calls `legacyBattleSystem.update()` in production, `positions` fires exactly once (at `battleSystem.start()`, `GameManager.ts:2380`) and never again.

Effect: `CombatScene` only ever sees one frozen snapshot from the start of the fight. Enemies spawned later by `StageWaveSystem`, hp/position changes from real turn resolution, and any party member beyond the first are invisible to the renderer — this is what the user is seeing as "art không còn được link vào nữa."

### 1.2 Feature change — static PNG → real sprite sheet animation

Explicit user decision (2026-09-05, see memory `tienhiep-combat-art-spritesheets`): combat entity art must use Phaser's real animation system (`scene.load.spritesheet` + `Phaser.Animations.AnimationManager`), not static single-frame PNGs loaded via `scene.load.image()`. This reverses a prior simplification — `PlayerVisualProfiles.ts:33` already has a comment noting the current static approach explicitly replaced an older atlas/animation setup.

This pairs naturally with the Action Playback 5-phase per-actor presentation state machine already live in `GameManager` (`idle → ready → cast → standby → idle/ready`, see `docs/superpowers/specs/2026-09-05-turn-combat-action-playback-design.md`) — each phase becomes a named animation clip.

### 1.3 Battlefield layout change

The current grid is 10 rows × 16 columns (`game/src/core/battle/BattleGrid.ts:14-15`, `GRID_ROW_COUNT`/`GRID_COLUMN_COUNT`). The user wants entity placement (spawn, player position) restricted to a sub-region matching the actual background art — parts of the current background (e.g. a cliff face with no floor) have no valid ground, but units currently can be placed there anyway.

**Real bounds, supplied by the user (2026-09-05), row 0 = nearest/bottom of screen:**
- Rows: skip rows 0–2 (nearest 3), rows **3–8 usable** (6 rows), skip row 9 (farthest/top). `HERO_LANE_INDEX = 4` (`BattleLane.ts:26`) already falls inside 3–8 — no need to move the player's fixed lane.
- Columns: **0–12 usable** (13 of 16, left-aligned — player side stays left since `HERO_COLUMN = 1`, enemies still approach from the right within this range).

### 1.4 Screen layout change — combat skill UI moves to a right-side dock

Separately from the logical grid restriction above (§1.3 doesn't shrink the *screen* rendering area, only which grid cells are valid for placement), the user also wants the combat skill/character UI (currently `TurnCombatSkillBar.vue` + `CombatBuildHud.vue`, both bottom-center inside `CombatSceneOverlay.vue`'s battlefield area) moved to a docked panel flush against the right edge of the actual screen — styled like the existing Động Phủ `RightPanel.vue` (`dark-drawer-fill`, `width: clamp(340px, 27vw, 440px)`, `position: absolute; right:0`), NOT reusing that component directly (it's structurally gated to `!isCombatSceneActive` in `GameRoot.vue:65`, mutually exclusive with combat). The battlefield's own rendering viewport (Phaser camera/projection) must shrink to fit the remaining screen width, the same way it already shrinks vertically for the top bar via `combatInsets.ts`.

## 2. Survey Findings

- `GRID_ROW_COUNT = 10`, `GRID_COLUMN_COUNT = 16` (`BattleGrid.ts:14-15`). `getChebyshevDistance()`/`entityGridPosition()` operate on raw row/column numbers — nothing here needs to change.
- Enemy spawn position: `resolveEnemySpawnPosition({ isBoss, random })` (`game/src/core/battle/EnemySpawnPlacement.ts:27`) — boss always `HERO_LANE_INDEX` (row 4, `BattleLane.ts:26`), column randomized within the right-side spawn band; regular enemies randomize both row (`[0, GRID_ROW_COUNT)`) and column.
- Player position: fixed at `HERO_LANE_INDEX`/`HERO_COLUMN` (`BattleLane.ts`) — "tower cố định" per prior stat-system decision, player doesn't move.
- `GameManager.buildTurnBattle()` (`GameManager.ts:2405-2434`) currently hardcodes `players: [playerParticipant]` — a single-element array. The party-migration work made the TYPE plural (`TurnBattle.players: TurnBattleParticipant[]`) but no production code path ever populates more than one player. Building real multi-character party content is a separate, out-of-scope feature — this spec only makes the RENDERING side correctly handle however many players actually appear.
- `CombatScene.ts` hardcodes a single player sprite id, `PLAYER_ID = 'player'` (confirmed by grep, e.g. `CombatScene.ts:175, 629, 1413`).
- Current art loading is 100% `scene.load.image(key, url)` — confirmed in `CombatPreload.ts` (player profiles, enemy templates, gourd, Thanh Vân background layers) and `PlayerVisualProfiles.ts` (`combatTextureKey`/`combatTextureUrl`, one static frame per profile).
- `game/docs/turn-based-combat-roadmap.md`'s Action Playback section explicitly lists "VFX authoring" and "icon/name content wiring" as out of scope for that work — confirms this art-pipeline gap was already known to be deferred, not silently missed.

## 3. Decisions (updated 2026-09-05 with real bounds)

1. **Entity sync**: retire dependence on the legacy `'positions'` bridge for turn-based combat. `GameManager` emits a new event directly from `TurnBattle` state every fixed step while `fighting` (see §4).
2. **Animation granularity**: 5 separate named animation clips per entity — `idle`, `ready`, `cast`, `standby`, `death` — one-to-one with the Action Playback phase machine.
3. **Asset readiness**: no real sprite sheets exist yet. The pipeline (frame metadata, loading, `AnimationManager` wiring) is built now; entities without a real sheet use an auto-generated placeholder sheet so nothing blocks on art delivery. Real sheets drop in later via the existing asset-drop workflow (see memory `tienhiep-asset-manifest`) with no code changes beyond the manifest entry.
4. **Battlefield region**: a new `BattlefieldUsableRegion` concept constrains WHERE entities may be placed/spawned. It does NOT change `GRID_ROW_COUNT`/`GRID_COLUMN_COUNT` or any distance/targeting/AoE formula — those keep operating on the full 10×16 coordinate space. Real bounds: `rowMin=3, rowMax=8, columnMin=0, columnMax=12` (see §1.3).
5. **Multi-player rendering**: `CombatScene` renders exactly as many player sprites as `turnBattle.players.length` at any given moment, using a new formation-position helper. Today this is always 1 (matches current behavior exactly); the helper is structured to place additional members if/when real party content ships (a separate, later feature) — this spec does not add that content.
6. **Screen layout**: the combat skill UI (`TurnCombatSkillBar`/`CombatBuildHud`) moves into a new right-docked panel component, independent of `RightPanel.vue`. `combatInsets.ts`/`ProjectionViewport` gain a `right` inset (mirroring the existing `top` inset's measure-real-DOM-height pattern), and the battlefield projection (`BattleGridProjection.ts`, both flat and perspective modes) shrinks its available width by that inset instead of always centering across the full canvas width.

## 4. Design — Entity Sync Event

New event type (naming follows the existing `emitTurn*` helpers in `TurnActionPresentationEvents.ts`):

```ts
export interface TurnBattleEntitySnapshotEvent {
  players: TurnBattleEntityVisualState[]
  enemies: TurnBattleEntityVisualState[]
}

export interface TurnBattleEntityVisualState {
  id: string
  row: number
  column: number
  currentHp: number
  maxHp: number
  alive: boolean
}
```

`GameManager.updateBattleFixedStep()` builds and emits this (`emitTurnBattleEntitySnapshot(eventBus, ...)`, new helper alongside the existing `emitTurn*` functions) once per fixed step while `turnBattle.state === 'fighting'` — reading directly from `turnBattle.players`/`turnBattle.enemies`, computing `column` via the existing `entityGridPosition()`/`getColumnFromWorldX()` helpers from `BattleGrid.ts`. No dependency on `legacyBattleSystem` at all.

`CombatScene.ts` subscribes to this new event (added to `getCombatEventBindings()`) and reconciles its sprite pool: create a sprite for any `id` not yet present, remove sprites for ids no longer in the snapshot (dead + removed, or `alive: false` past its death animation), update position/hp-bar for existing sprites. This replaces `onPositions`/`applyPendingPositions`'s role for turn-based combat; the legacy `positions` handler stays in place unmodified (still relevant to `TribulationScene`/anything else still reading it — not touched by this spec).

## 5. Design — Sprite Sheet Animation

`PlayerVisualProfile` (`PlayerVisualProfiles.ts`) and the enemy-art equivalent (`EnemyArt.ts`) gain animation-set metadata replacing the single static texture field:

```ts
export type CombatAnimationName = 'idle' | 'ready' | 'cast' | 'standby' | 'death'

export interface CombatAnimationClip {
  key: string // Phaser animation key, e.g. 'player-mortal-idle'
  sheetKey: string // Phaser texture key for the loaded spritesheet
  sheetUrl: string
  frameWidth: number
  frameHeight: number
  frameCount: number
  frameRate: number
  repeat: number // -1 = loop (idle/ready/standby), 0 = play once (cast/death)
}

export interface CombatAnimationSet {
  idle: CombatAnimationClip
  ready: CombatAnimationClip
  cast: CombatAnimationClip
  standby: CombatAnimationClip
  death: CombatAnimationClip
}
```

Loading (`CombatPreload.ts`): replace `scene.load.image(key, url)` calls for combat entities with `scene.load.spritesheet(sheetKey, sheetUrl, { frameWidth, frameHeight })` for each clip in each entity's `CombatAnimationSet`. `CombatScene.create()` registers the actual `Phaser.Animations.Animation` objects once via `scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(sheetKey, ...), frameRate, repeat })`.

Phase-to-animation wiring: `CombatScene`'s existing Action Playback event handlers (`onTurnReady`, `onAttack`/cast-start, the impact/standby handlers) call `sprite.play(animationKeyForPhase(entityId, phase))` instead of (or alongside, where a positional tween still matters, e.g. the attack lunge) their current ad-hoc tween logic. `death` plays once on the entity's alive→false transition (detected via the new entity-sync snapshot from §4) instead of / in addition to any existing death VFX.

**Placeholder generation** (since no real sheets exist yet): a small helper generates a placeholder `CombatAnimationSet` for any entity lacking real art — reusing the entity's current static PNG, sliced into a trivial N-frame sheet (or a single repeated frame if slicing isn't meaningful) so the SAME code path (`AnimationManager`, `sprite.play()`) runs end-to-end today. When real sheets are dropped in later (asset-drop workflow), only the manifest entry changes — no code path changes.

## 6. Design — Battlefield Usable Region

```ts
export interface BattlefieldUsableRegion {
  rowMin: LaneIndex
  rowMax: LaneIndex
  columnMin: number
  columnMax: number
}

// Real bounds (user, 2026-09-05) — rectangle, row 0 = nearest/bottom.
// Excludes rows 0-2 (nearest) and row 9 (farthest); excludes columns 13-15
// (rightmost 3, freed for the screen-layout dock in §7.5 — NOT the same
// thing as the region itself, see §1.4).
export const DEFAULT_BATTLEFIELD_USABLE_REGION: BattlefieldUsableRegion = {
  rowMin: 3,
  rowMax: 8,
  columnMin: 0,
  columnMax: 12,
}
```

The rectangle is split in half for the two sides per the user's description ("chia 2 cho 2 bên") — this matches the existing left/right split already implicit in the engine (player fixed near `HERO_COLUMN = 1`, enemies occupy the rest of the region toward `columnMax`). No new "side" field is needed: `resolveEnemySpawnPosition()`'s existing boss/regular column-banding logic already roughly does this (boss/regular roll toward the far side from the player) — the plan should verify its current column band still makes sense inside `columnMin..columnMax = 0..12` and adjust the band's numbers, not invent a new halving mechanism.

Consumers, both constrained to roll/clamp within the region instead of the full grid:
- `resolveEnemySpawnPosition()` (`EnemySpawnPlacement.ts`) — gains a `region` parameter (default `DEFAULT_BATTLEFIELD_USABLE_REGION`), random row/column rolled within it instead of `[0, GRID_ROW_COUNT)`/the fixed column band.
- Player/party fixed position (§7) — `HERO_LANE_INDEX`/`HERO_COLUMN` become the DEFAULT formation anchor; if the real region excludes them once bounds are supplied, that's a follow-up constant change, not an architecture change.

No change to `getChebyshevDistance()`, `entityGridPosition()`, `collectTurnTargets()`, `selectTarget()`, or any AoE shape logic — all keep operating on the full 10×16 coordinate space exactly as today.

## 7. Design — Multi-Player Rendering

New helper, mirroring `resolveEnemySpawnPosition()`'s shape:

```ts
export function resolvePartyMemberPosition(
  index: number,
  region: BattlefieldUsableRegion = DEFAULT_BATTLEFIELD_USABLE_REGION,
): GridPosition
```

`index === 0` MUST return exactly `{ row: HERO_LANE_INDEX, column: HERO_COLUMN }` — today's real (and only) case, byte-identical to current behavior. `index >= 1` places additional members adjacent to the anchor within `region` (exact offset pattern is an implementation detail for the plan, not a gameplay-content decision — no real content uses it yet).

`GameManager.buildTurnBattle()` changes from hardcoding `players: [playerParticipant]` to mapping over whatever party list it's given (today still always length 1 — this spec does not add multi-character content, only removes the hardcoded assumption from the rendering path). `CombatScene` renders exactly `snapshot.players.length` sprites (from §4's event), never assuming exactly one.

## 7.5. Design — Screen Layout: Right-Side Skill Dock

This is a SCREEN-space change, independent of the grid-space change in §6 — the battlefield's usable grid cells (rows 3-8, columns 0-12) do not map 1:1 to "which pixels of the screen are reserved for UI." The user confirmed the new skill panel sits flush against the actual right edge of the browser viewport (potentially wider than whatever screen-space the 3 excluded grid columns would occupy), styled like the existing Động Phủ drawer.

**New component**: `CombatSkillDockPanel.vue` (name illustrative — plan may pick a clearer one), placed as a sibling of `CombatSceneOverlay.vue`'s existing `<CombatTopBar>` inside its template, NOT nested inside `.combat-scene-overlay__battlefield` (that div is reserved for battlefield-anchored HUD like `CombatAiPanel`). CSS mirrors `RightPanel.vue`: `position: absolute; top: 0; right: 0; bottom: 0; width: clamp(340px, 27vw, 440px);` plus the project's `dark-drawer-fill` utility class. It hosts `TurnCombatSkillBar` and `CombatBuildHud` (moved out of `CombatSceneOverlay.vue:100-105`'s bottom-center battlefield slot into this new dock), unconditionally visible during combat (unlike `RightPanel.vue`, which only shows when `ui.characterOverlayOpen` — the combat dock has no such toggle, it's always present while fighting).

**Insets extension** (`game/src/game/support/combatInsets.ts`): add a `right: number` field to `CombatInsets`, following the exact measure-real-DOM pattern already used for `top` (`CombatSceneOverlay.vue`'s `publishInsets()`/`barHeight()` helpers, `ResizeObserver` on the new dock element). `setCombatInsets({ top, bottom: 0, right })` is called whenever the dock's real width changes.

**Projection extension** (`game/src/game/support/BattleGridProjection.ts`): `ProjectionViewport` gains `rightInset: number` (mirroring `topInset`/`bottomInset`). Flat mode's `resize()` (currently `BattleGridProjection.ts:223-243`) changes its width math from centering across the full `viewport.width` to centering across `viewport.width - viewport.rightInset` (analogous to how `availableHeight` already subtracts `topInset`/`bottomInset`, `BattleGridProjection.ts:235`). Perspective mode's `resize()` (`BattleGridProjection.ts:318-334`, `nearWidth`/`centerX`) needs the equivalent adjustment — read that method fresh in the plan, since its horizontal math (`PERSPECTIVE_SIDE_MARGIN`-based) is structured differently from flat mode's and the exact edit isn't a copy-paste of the flat-mode change.

`CombatScene.applyBattlefieldLayout()` (`CombatScene.ts:766-799`) threads the new inset from `getCombatInsets()`/`getFallbackCombatInsets()` into the `viewport` object passed to `createBattleGridProjection()`/`.resize()`, alongside the existing `topInset`/`bottomInset` wiring.

## 8. Out of Scope

- Building real multi-character party gameplay content (companions/summons) — only the rendering/placement plumbing is prepared.
- The actual pixel art / sprite sheet files themselves — placeholder-only until the user drops in real assets.
- Any change to combat balance/targeting/AoE math.
- Redesigning `RightPanel.vue` itself or the Động Phủ (home) UI — the new combat skill dock is a separate component that happens to share its visual style.

## 9. Risks / Notes for the Plan

- `CombatScene.ts` is a large file (2000+ lines) — the plan must read the current event-binding list and sprite-pool reconciliation code fresh before editing, not paraphrase from this spec.
- Removing the legacy `positions` dependency for turn-based combat must confirm nothing ELSE (e.g. `TribulationScene.ts`, if it shares any combat-visual code) silently relied on the same event for a still-live purpose — check before deleting any legacy-side emission, though this spec does not ask to delete `emitPositions()` itself, only to stop being the sole source of truth for turn-based fights.
- Placeholder sprite-sheet generation needs a concrete, simple implementation (e.g. Canvas-based tiling of the existing static PNG at runtime, or a build-time script) — the plan must pick one concretely, not leave it vague.
- `death` animation timing must coordinate with the existing win/loss check and reward-grant flow (`completeAction()`'s `battle.state = 'defeat'/'victory'` transition, `grantTurnBattleRewards`) so a dying entity's animation isn't cut off by an immediate state-driven cleanup.
- Perspective-mode projection (`BattleGridProjection.ts`'s second `resize()` implementation, `PERSPECTIVE_SIDE_MARGIN`-based) has different horizontal math from flat mode — the plan must read it fresh and design its own `rightInset` handling, not assume flat mode's fix transfers directly.
- The new skill dock is unconditionally visible during combat (no open/close toggle, unlike `RightPanel.vue`) — confirm this doesn't visually collide with `CombatAiPanel` (left corner) or `TurnOrderStrip`/`BattleLogPanel` (top/bottom-right per `CombatSceneOverlay.vue`'s existing layout) before finalizing the dock's exact placement/z-index.
- Moving `resolveEnemySpawnPosition()`'s column band into `columnMin..columnMax = 0..12` may shrink the effective "approach distance" enemies travel before reaching the player compared to today's full 16-column band — acceptable per the region redesign's intent, but worth a quick playtest after implementation, not just a unit-test check.
