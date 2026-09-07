# Phase A6 — Turn-Based Buff/Debuff Status Display

**Status:** Approved design, ready for implementation planning.

**Roadmap context:** `game/docs/roadmap.md` mục 0, Phase A6: "Buff
duration presentation (tooltip/VFX theo lượt)." Depends on A2 (done).

**Reference:** `docs/superpowers/specs/2026-09-07-turn-based-combat-reference.md`.
No new mechanic — this ports an existing, working presentation pipeline
to read from the live engine instead of the dead one, following the
exact "GameManager is the sole caller, CombatScene is the sole listener,
reuse existing event names/payload shapes so scene handlers work
unmodified" pattern `TurnActionPresentationEvents.ts`'s own header
comment already documents for entity snapshots.

## Background

Survey found the roadmap's "no duration display" framing understates the
gap. There already is a full, working status-icon/tooltip/floating-text
pipeline (`CombatVfxSpawner.onStatusAttached/onStatusUpdated/onStatusRemoved`
in `game/src/game/scenes/combat/combat-vfx-spawner.ts`, `StatusTooltip`
in `combat-status-tooltip.ts`, floating name-text on first attach in
`CombatScene.onStatusAttached()`) — but it is fed exclusively by
`status_vfx_attached`/`status_vfx_updated`/`status_vfx_removed` events
emitted only from `legacy/BattleSystem.emitStatusVfxDiff()`
(`BattleSystem.ts:1616-1678`), which never runs for a turn-based fight.
**Turn-based combat shows zero buff/debuff icons today, not just missing
duration numbers.**

The fix is not "port `BuffSystem`/`emitStatusVfxDiff` to
`TurnBuffSystem`" as a rewrite — it's narrower: `emitStatusVfxDiff()`'s
diff algorithm operates on a plain `Map<string, {targetId, dotType,
stacks, remainingTime, polarity, permanent}>` snapshot
(`BattleSystem.snapshotStatuses()`, `BattleSystem.ts:1564-1613`) built
generically from any `BuffPool`-shaped collection — `TurnBuffPool.getAll()`
returns `TurnBuff[]` with the exact same field names (`id`, `sourceId`,
`stacks`, `remainingTurns` in place of `remainingTime`, `polarity`,
`duration`). The diff/emit logic itself needs no redesign, just a
turn-shaped snapshot function and one call site.

## Non-Goals

- **No change to `CombatVfxSpawner`, `StatusTooltip`, or
  `CombatScene.onStatusAttached/onStatusUpdated/onStatusRemoved`.** They
  already consume plain event payloads, not `Battle`/`BuffPool` types
  directly — reusing them unmodified is the whole point of this design.
- **No new VFX preset work.** `getStatusVfxPreset()` (icon shape/color by
  buff id/polarity) is already generic and unaffected.
- **No change to how `TurnBuffPool`/`TurnBuffSystem` themselves track
  buffs.** This is purely a read-side presentation snapshot, same
  boundary `emitTurnBattleEntitySnapshot()` already establishes for
  HP/position.
- **No dual seconds/turns display mode.** Per this project's locked
  "full cutover, no dual shim" policy (same one A0-A4 all followed): the
  tooltip's duration label changes from real-seconds phrasing to
  turn-count phrasing outright, since turn-based is the sole live
  combat engine and `battle/legacy/` is scheduled for deletion (C1 — now
  unblocked, since both A1 and A2 are done).

## Component 1: Turn-based status snapshot + diff-emit

### Design

New file `game/src/core/battle/turn/TurnStatusPresentationEvents.ts`
(sibling to `TurnActionPresentationEvents.ts`, keeping the "one
presentation-emitter concern per file" pattern that file already
follows):

1. `snapshotTurnStatuses(battle: TurnBattle): Map<string, TurnStatusSnapshotEntry>`
   — ported from `BattleSystem.snapshotStatuses()`
   (`BattleSystem.ts:1564-1613`), reading `TurnBuffPool.getAll()` off
   `battle.players[*].buffs` and `battle.enemies[*].buffs` instead of
   `battle.playerBuffs`/`battleEnemy.buffs`. Key shape identical
   (`` `${targetId}:${buff.id}:${buff.sourceId}` ``); `remainingTurns` in
   place of `remainingTime`; `permanent = buff.duration === Infinity`
   (same check, `TurnBuff.duration` already uses the same `Infinity`
   convention per `TURN_BUFF_REGISTRY`'s conversion notes).
2. `diffAndEmitTurnStatusVfx(eventBus: EventBus, battle: TurnBattle, before: Map<string, TurnStatusSnapshotEntry>): void`
   — ported from `BattleSystem.emitStatusVfxDiff()`
   (`BattleSystem.ts:1615-1678`) verbatim in structure: computes `after
   = snapshotTurnStatuses(battle)`, emits `status_vfx_attached` for new
   keys, `status_vfx_updated` for stack/duration changes, `status_vfx_removed`
   for keys present in `before` but not `after` (with the same
   `alive ? 'expired' : 'target_dead'` reason logic, reading
   `TurnBattleParticipant.entity.alive` instead of `BattleEnemy.entity.alive`/
   `Battle.player.alive`). **Reuses the exact same 3 event names and
   payload field names** (`statusInstanceId`, `targetId`, `dotType`,
   `stacks`, `durationSeconds`, `buffName`, `polarity`, `permanent`,
   `reason`) the legacy emitter already uses — this is what lets
   `CombatVfxSpawner`/`CombatScene` need zero changes. `buffName` resolves
   via `TURN_BUFF_REGISTRY.get(id).name` (mirrors
   `buffRegistry.get(current.dotType).name`), guarded the same way
   (`registry.has(id) ? ... : id`, matching this project's established
   "guard against throw-on-unknown-id" fix pattern from the A2 QA pass).
3. No cross-tick state needed on `GameManager` — per the legacy
   precedent (`BattleSystem.update()`, `BattleSystem.ts:956,1089`), the
   "before" snapshot is taken at the START of the same fixed-step call
   that later diffs against "after," not persisted across ticks. Wire
   into `GameManager.updateBattleFixedStep()`'s existing `'fighting'`
   branch (`GameManager.ts:3526-3563`): call `snapshotTurnStatuses(this.turnBattle)`
   immediately before `this.turnBattleSystem.tickPacing(...)` (or at the
   top of the branch, before any mutation happens this step), hold the
   result in a local variable, and call `diffAndEmitTurnStatusVfx(this.eventBus,
   this.turnBattle, thatLocalSnapshot)` at the same point
   `emitTurnBattleEntitySnapshot(this.eventBus, this.turnBattle)`
   already fires (end of the branch) — same call-site shape as A2/A1's
   established "GameManager orchestrates, presentation modules stay
   pure functions" convention.

## Component 2: Turn-count duration text in the tooltip

### Design

`StatusTooltip`'s `formatDetail()` (`combat-status-tooltip.ts:85-91`)
currently renders `"×N · Ns"` (seconds) or `"×N · vĩnh viễn"` (permanent).
Change the non-permanent branch's unit suffix from `"s"` to `" lượt"`
(matching this project's established Vietnamese turn-count phrasing,
e.g. how boss enrage/buff durations are already described in `buffs.ts`
comments and the A2/A1 specs as "sau N lượt"). The `remainingTime`
number itself needs no scaling — it already carries whatever unit the
emitting engine populated it with (real seconds from legacy,
turn-count from this plan's new turn emitter), and since legacy's own
emission path is dead in production (per the ownership audit) and
scheduled for deletion (C1), a single unconditional turn-count label is
correct going forward, not a per-engine conditional format.

Confirm at implementation time whether any other consumer of
`StatusEntry.remainingTime`/the `durationSeconds` event field name
displays a "seconds" assumption elsewhere (e.g. a rounding/formatting
helper shared with real-time HUD elements) — rename the field itself
only if the implementer judges the `durationSeconds` name is actively
misleading enough to cause a future bug; otherwise leave the field name
as-is (matching every other event payload in this codebase that keeps
its established name across the real-time→turn-based conversion, e.g.
`TurnBattleEntitySnapshotEvent` reusing `currentHp`/`maxHp` field names
verbatim) and only change the tooltip's rendered text.

## Testing Strategy

- **Component 1**: unit tests for `snapshotTurnStatuses()` (given a
  `TurnBattle` fixture with buffs on player/enemy, produces the correct
  keyed map) and `diffAndEmitTurnStatusVfx()` (attach/update/remove
  cases, mirroring whatever test coverage `emitStatusVfxDiff` has today
  — check if one exists first, since the blast-radius survey noted "no
  covering tests found" for the legacy version; if so, this is a case
  where the turn-based port gets BETTER test coverage than its legacy
  source, which is fine and expected, not a gap to backport). Integration
  test: drive a real turn-based battle (apply a real ailment via a real
  skill hit, following A1's established production-content-driven test
  style) and assert `status_vfx_attached`/`status_vfx_removed` fire on
  the event bus with the correct `targetId`/`dotType`/`durationSeconds`
  (in turns) at the right ticks.
- **Component 2**: unit test for `StatusTooltip`'s `formatDetail()`
  covering the updated turn-count phrasing (extend
  `combat-status-tooltip.test.ts`, which the survey confirmed already
  exists).
- **P14 (visual) required** — this changes real on-screen presentation.
  Start a real turn-based fight via playwright-cli, apply a real ailment
  to an enemy or the player, and visually confirm a status icon appears
  under/above the correct entity, its tooltip shows the buff name +
  turn-count duration, and the icon disappears when the buff expires or
  the entity dies.
- Full suite + type-check + build per standing requirements.

## Open Items For The Implementation Plan (not decided here)

- Exact `TurnBuff`/`TurnBuffTypes.ts` field names to confirm 1:1 against
  `snapshotTurnStatuses()`'s port (implementer re-reads
  `TurnBuffTypes.ts` at build time — this spec's field mapping is based
  on the current shape but should be re-verified, not assumed frozen).
- Whether `durationSeconds`/`remainingTime` field names get renamed for
  clarity or kept as-is (Component 2, final paragraph) — implementer's
  call, default to keeping names unchanged per precedent.
- Exact insertion point within `updateBattleFixedStep()`'s `'fighting'`
  branch for the "before" snapshot call — implementer confirms current
  line numbers, since this file changes frequently.
