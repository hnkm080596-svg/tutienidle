# Trận Pháp (Formation) System — Design Spec

**Date:** 2026-09-05
**Status:** Approved by user, ready for implementation plan.
**Depends on:**
- `docs/superpowers/specs/2026-09-05-combat-art-pipeline-rework-design.md` — `PLAYER_SIDE_REGION` (rows 3-8, columns 0-5), `PartyFormationSlot[]` concept (this spec REPLACES that spec's placeholder `DEFAULT_PARTY_FORMATION`-only design with the real feature it was left open for).
- `docs/superpowers/specs/2026-09-05-companion-roster-system-design.md` — `CompanionInstance`/`CompanionDefinition`, `player.companions[]`.

## 1. Problem / Context

This is the "chức năng sắp thiết kế" (feature to be designed later) that the Combat Art Pipeline spec explicitly deferred: a panel where the player presets which combatants (themselves + owned companions) enter battle and where, by dragging character cards into a 6×6 grid. Different Trận Pháp (formation) layouts support different headcounts and grant different buffs — formations supporting fewer combatants grant stronger buffs than formations supporting more, so no formation is strictly better (design guideline: power vs. headcount tradeoff, "để complement" per the user).

Reference mockup (user-provided, 2026-09-05): a 6×6 drag-target grid (left), a vertical list of selectable Trận Pháp cards (right — selecting one lights up that formation's valid cells in the grid), and a horizontal roster queue at the bottom (one card per owned, not-currently-placed combatant, draggable into a lit cell).

## 2. Decisions

1. **Fixed cell pattern per formation** — each Trận Pháp defines its own exact set of valid cells within the local 6×6 space (not "N cells, player's choice"). Only cells belonging to the currently-selected formation's pattern accept a drop.
2. **One uniform buff per formation** — applies equally to every combatant placed in that formation, regardless of which specific cell they occupy. No per-cell role/bonus design (kept simple, per user).
3. **Player is a draggable card like any companion** — no fixed anchor cell exception. This supersedes the Combat Art Pipeline spec's `resolvePartyMemberPosition()`/"index 0 must be `HERO_LANE_INDEX`/`HERO_COLUMN`" framing for any player who has actually configured a formation; that spec's default remains ONLY as the fallback for a player who has never opened this panel (see §6).
4. **All Trận Pháp available from the start** — no unlock gating in this spec (a future content/progression pass can add one additively without an architecture change).
5. **Buff strength is an explicit per-formation content value**, not an auto-derived formula from headcount — gives the content/balance pass full control; the "fewer people = stronger buff" rule is a design guideline for whoever authors formation content, not an enforced code invariant.

## 3. Data Model

New file: `game/src/data/formation/TranPhap.ts` (content-definition style, mirrors `Companions.ts`/`Enemies.ts`):

```ts
export interface TranPhapCell {
  row: number // local to the 6x6 pattern space, 0-5
  column: number // local to the 6x6 pattern space, 0-5
}

export interface TranPhapDefinition {
  id: string
  name: string

  /** Valid drop cells, local coordinates — length = max headcount for this formation. */
  cellPattern: readonly TranPhapCell[]

  /** One uniform buff applied to every combatant placed in this formation at battle start. */
  buff: {
    definitionId: string // a TurnBuffDefinition id, applied via the existing buff-application path
  }

  description: string
}

export const TRAN_PHAP_FORMATIONS: readonly TranPhapDefinition[] = [
  // content added later — this spec ships the mechanism, not the actual
  // formation roster/buff values (balance/content work, see §8).
]
```

**Local-to-absolute coordinate mapping**: `TranPhapCell.row/column` (0-5, matching the mockup's 6×6 visual) map onto `PLAYER_SIDE_REGION` (`BattlefieldUsableRegion` from the Combat Art Pipeline spec, rows 3-8 / columns 0-5) via:

```ts
function localCellToAbsolute(cell: TranPhapCell): GridPosition {
  return {
    row: (PLAYER_SIDE_REGION.rowMin + cell.row) as LaneIndex,
    column: PLAYER_SIDE_REGION.columnMin + cell.column,
  }
}
```

Since `PLAYER_SIDE_REGION` is already exactly 6 rows × 6 columns, this mapping is a direct 1:1 offset — no scaling needed.

## 4. Player Formation Loadout (persistence)

New field on `PlayerData` (`game/src/core/player/Player.ts`) — the ONLY schema change needed, additive:

```ts
export interface FormationSlotAssignment {
  row: number // local 0-5, matches TranPhapCell space
  column: number // local 0-5

  /** 'player' or a companion's definitionId (stable + unique per §5 of the
   *  Companion Roster spec — duplicates convert to exp, never create a
   *  second owned instance, so definitionId alone is a safe key). */
  combatantId: string
}

export interface FormationLoadout {
  formationId: string
  assignments: FormationSlotAssignment[]
}

// Added to PlayerData interface:
formationLoadout: FormationLoadout | null
```

`createDefaultPlayer()` initializes `formationLoadout: null` (per this project's established convention of always initializing new optional `PlayerData` fields explicitly — memory `tienhiep-phap-tu-system`). `null` means "player has never configured a formation" — see §6 for the resulting fallback.

**Drag-and-drop validation rules** (enforced by the panel's Vue logic, not the data model itself):
- A card can only be dropped on a cell present in the currently-selected formation's `cellPattern`.
- Switching the selected formation while combatants are already placed: any `FormationSlotAssignment` whose `(row, column)` is NOT in the new formation's `cellPattern` is removed and that combatant returns to the bottom roster queue (never silently deleted/lost).
- A combatant already placed cannot occupy two cells; dragging an already-placed card to a new valid cell moves it (removes the old assignment, adds the new one).

## 5. UI — `TranPhapPanel.vue`

Three regions, matching the mockup:
- **Left — 6×6 grid**: renders `CombatSkillDockPanel`-adjacent (new panel, separate mount point — exact placement in the overall UI layout, e.g. a new standalone overlay panel like `SkillPathPanel.vue`/`ArtifactPanel.vue`, is a plan-level decision, not a design decision here). Cells belonging to the selected formation's `cellPattern` render lit/interactive; all other cells render dimmed/non-interactive (per the mockup's "chỉ có thể kéo vào vị trí sáng lên bởi trận pháp được chọn").
- **Right — Trận Pháp card list**: one card per `TranPhapDefinition` in `TRAN_PHAP_FORMATIONS`, showing name + buff summary + headcount. Clicking a card sets it as selected (drives which cells light up on the left) — this does NOT immediately commit `formationLoadout.formationId` until the player has a valid arrangement (or commits explicitly via a save/confirm action, matching how other loadout-style panels in this codebase — e.g. Skill Loadout — commit on an explicit action rather than every intermediate click).
- **Bottom — roster queue**: one draggable card per combatant NOT currently placed (`'player'` always exists as a card unless already placed; each `CompanionInstance` in `player.companions` not currently in `assignments`). Matches the mockup's "Hàng đợi chia ô cho mỗi nhân vật."

## 6. Combat Integration

`GameManager.buildTurnBattle()` (already becoming `PartyFormationSlot[]`-driven per the Combat Art Pipeline spec) resolves its party list from `player.formationLoadout`:

```ts
function resolvePartyFormation(player: PlayerData): PartyFormationSlot[] {
  if (!player.formationLoadout) {
    return DEFAULT_PARTY_FORMATION // Combat Art Pipeline spec's fallback: player alone at HERO_LANE_INDEX/HERO_COLUMN
  }

  return player.formationLoadout.assignments.map((assignment) => {
    const absolute = localCellToAbsolute({ row: assignment.row, column: assignment.column })

    return { combatantId: assignment.combatantId, row: absolute.row, column: absolute.column }
  })
}
```

For each resolved slot, `buildTurnBattle()` builds the `TurnBattleParticipant`:
- `combatantId === 'player'` → today's existing `playerToCombatEntity()` path, positioned at the resolved cell instead of the hardcoded `HERO_LANE_INDEX`/`HERO_COLUMN`.
- otherwise → `companionToCombatEntity(instance, definition)` from the Companion Roster spec, positioned at the resolved cell.

The formation's buff (`TranPhapDefinition.buff.definitionId`) is applied once to every resolved participant at battle start (`declareActorAction`'s first-turn buff-application point, or a dedicated "battle start" application step — the plan should check whether `TurnBattleSystem`/`buildTurnBattle()` already has a clean "apply a buff to a fresh participant" call site to reuse, e.g. the existing boss-trigger buff-application pattern in `declareActorAction()`, `TurnBattleSystem.ts:436-447`, rather than inventing a new one).

## 7. Out of Scope

- The actual roster of Trận Pháp (how many, their exact cell patterns, buff values/names) — content/balance work, follows this mechanism.
- Formation unlock conditions — deferred per §2.4.
- Per-cell roles/positional bonuses within a formation — deferred per §2.2.
- Multiple saved formation presets / quick-swap between saved loadouts (today: exactly one active `formationLoadout` at a time, matching how the existing Skill Loadout system works) — a future enhancement if requested.
- Visual/interaction polish of the drag-and-drop itself (animations, invalid-drop feedback styling) — implementation detail for whichever plan task builds the Vue component, not a design decision.

## 8. Risks / Notes for the Plan

- This spec's `resolvePartyFormation()` is the SAME seam the Combat Art Pipeline spec already flagged as needing `PartyFormationSlot[]` support in `buildTurnBattle()` — the plan should treat these two specs' `GameManager.buildTurnBattle()` changes as one coordinated task, not two separate edits to the same function landing independently.
- Drag-and-drop UI in this codebase has no established precedent (grep for existing drag-drop components before assuming a library/pattern — the plan should check whether native HTML5 drag events, a pointer-based custom implementation, or an existing Vue drag-drop dependency is already used anywhere, e.g. inventory sorting) rather than assuming one is available.
- `TranPhapDefinition.buff.definitionId` must resolve through whichever buff registry `TurnBattleSystem` is constructed with (`TurnBuffRegistry`, see `TurnBattleSystem`'s constructor) — confirm formation buffs are registered there alongside existing skill/reactive-trigger buff definitions, not a separate lookup table.
- Verify `player.companions` entries referenced by a stale `FormationSlotAssignment.combatantId` (e.g. a companion somehow removed from the roster after being placed — not currently possible per the Roster spec's no-duplicate-removal design, but worth a defensive check) are skipped gracefully rather than crashing `buildTurnBattle()`.
- The exact standalone-panel mount point for `TranPhapPanel.vue` (a new overlay panel like `SkillPathPanel.vue`, or nested inside an existing menu) is undecided — the plan's first task should locate the right entry point in `GameRoot.vue`'s existing panel list rather than guessing.
