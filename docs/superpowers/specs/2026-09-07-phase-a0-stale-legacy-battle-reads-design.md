# Phase A0 — Fix Stale Legacy `battleSystem` Reads (Slice 6 Cutover Leftovers)

**Status:** Approved design, ready for implementation planning.

**Roadmap context:** `game/docs/roadmap.md` mục 0, Phase A0. Found via a
codebase-wide "ownership" audit (2026-09-07) run after the same bug shape
was fixed once already in Phase A2 (talent passive-conversion callbacks
reading legacy `battleSystem` instead of the live turn-based battle).
Independent of A1-A7 — no dependency, blocks nothing.

**Reference:** `docs/superpowers/specs/2026-09-07-turn-based-combat-reference.md`.
No new mechanic — both fixes repoint an existing read from a dead system
to the live one, following the exact precedent A2 Component 2 already
established (`docs/superpowers/plans/2026-09-07-phase-a2-buff-content-wiring.md`).

## Background

Since the Slice 6 cutover, `TurnBattleSystem`/`this.turnBattle` is the
only engine driving real combat. `battle/legacy/BattleSystem.ts` still
runs in parallel per-battle (`GameManager.startBattle()` calls both
`this.battleSystem.start(...)` and `this.turnBattle = this.buildTurnBattle(...)`)
purely as a documented, intentionally-inert mirror
(`battle/legacy/README.md`: "lưu state nội bộ vô hại, turn engine không
đọc"). That framing is correct for *writes* into the legacy shim, but
the audit found two places that **read** from it as if it were live —
the same mistake already fixed once in A2, just in two different spots
that survived that pass.

## Non-Goals

- **No `battle/legacy/` deletion.** That's roadmap C1, blocked on A1+A2,
  not touched here.
- **No new turn-based mechanic.** Both fixes repoint existing reads;
  neither adds new gameplay behavior.
- **No fix for the two lower-confidence audit notes** (the fragile-but-
  not-currently-broken `resolvePersistentBuffEntity` accidental-reference
  sharing, and `TurnBattleSystem`'s self-inconsistent `applyGaugeDeltaEffects`).
  Both are cosmetic/latent, not live bugs, and are noted in the roadmap's
  "Đề xuất kỹ thuật" section for a future pass rather than bundled here.

## Component 1: Bất Tử Thể (Survive-Lethal) cleanse/grant writes to a dead `BuffPool`

### Current state

`GameManager.ts:2686-2697` (`startBattleWithPlayer()`) wires
`combatSystem.setSurviveLethalSession()`'s `surviveEffects` from the
**legacy** buff pool:

```ts
surviveEffects: {
  buffSystem: new BuffSystem(this.battleSystem.getPlayerBuffs() ?? new BuffPool()),
  registry: this.buffRegistry,
},
```

`this.battleSystem.getPlayerBuffs()` returns a `BuffPool` freshly created
by `battleSystem.start()` moments earlier — a pool nothing during real
combat ever adds a debuff to or reads from, since combat runs entirely
on `this.turnBattle`'s `TurnBuffPool` instances. `CombatSystem.killIfDead()`
(`CombatSystem.ts:461-514`) uses `surviveEffects.buffSystem.getAll()` to
find debuffs to cleanse and `.apply(tuSinhNgo, ...)` to grant the "Tử
Sinh Ngộ" buff after a lethal-hit rescue. Both calls succeed (no error,
no guard trips) but operate on the empty, unread legacy pool — so the
HP=1 rescue itself works (a separate code path,
`entity.currentHp = 1` at `CombatSystem.ts:480`), but the cleanse and
the granted buff silently do nothing during a real fight. Same failure
shape as A2's already-fixed passive-conversion bug: no error, no log,
looks like it works because the adjacent effect (survival) does.

### Design

1. `CombatSystem`'s `surviveLethalSession.surviveEffects` type
   (`CombatSystem.ts:73` and the matching `setSurviveLethalSession()`
   parameter type at `CombatSystem.ts:99`) changes from
   `{ buffSystem: BuffSystem; registry: BuffRegistry }` to
   `{ buffSystem: TurnBuffSystem; registry: TurnBuffRegistry }`. Full
   cutover, no dual-type/optional-fallback shim — matches this project's
   locked policy for buff-system conversions (same policy A1/A2 already
   followed).
2. `TurnBuffSystem` is missing two methods `killIfDead()`'s cleanse logic
   needs — `getAll(): TurnBuff[]` and `remove(id: string, sourceId:
   string): void` — both ported verbatim from `BuffSystem.getAll()`/
   `BuffPool.removeInstance()` (the same source `TurnBuffSystem.getStacks()`
   was already ported from, per its own comment at `TurnBuffSystem.ts:363-367`).
   `apply()` already exists on `TurnBuffSystem` and needs no change.
3. `GameManager.ts:2686-2697` rewires to the live turn-based pool:
   ```ts
   surviveEffects: {
     buffSystem: new TurnBuffSystem(this.turnBattle!.players[0]!.buffs),
     registry: TURN_BUFF_REGISTRY,
   },
   ```
   `this.turnBattle` is guaranteed set at this point — `startBattleWithPlayer()`
   calls `this.startBattle(playerEntity, enemy)` (which sets
   `this.turnBattle = this.buildTurnBattle(...)`) before reaching this
   line. `players[0]` is the human player's own participant (index 0 by
   construction in `buildTurnBattle()` — confirm this convention still
   holds at implementation time, since companions are appended after
   index 0).
4. `CombatSystem.ts`'s imports of `BuffSystem`/`BuffPool`/`BuffRegistry`
   (`:21-23`) are dropped if this was their only remaining use in the
   file — implementer checks for other live usages before removing the
   imports.

## Component 2: `CombatTopBar`'s "alive" enemy count reads the empty legacy enemy list

### Current state

`StageWaveSystem.getProgress()` (`StageWaveSystem.ts:198-208`), consumed
live by `GameManager.getStageProgress()` → `CombatTopBar.vue`, returns:

```ts
alive: this.deps.battleSystem.getBattle()?.enemies.length ?? 0,
```

`StageWaveSystemDeps.battleSystem` is the legacy engine
(`StageWaveSystem.ts:16-18`). Legacy `BattleSystem.start()` seeds
`enemies: []`, and the only code that ever pushes into that array
(`queueEnemySpawn`/telegraph-materialize, inside `BattleSystem.update()`/
`StageWaveSystem.update()`) is never invoked in production — the turn-
based loop drives combat instead. So `alive` reads `0` for the entire
real fight. `spawned`/`total` in the same return object are correct
(sourced from `StageManager`'s own counters, not the legacy battle) —
only `alive` is affected.

### Design

`StageWaveSystem` does not own live turn-based enemy state and should
not be made to reach for it through its own legacy `battleSystem`
dependency — the accurate count already lives on `GameManager.turnBattle.enemies`,
which `StageWaveSystem` has no access to today. Rather than adding a
`turnBattle` dependency to `StageWaveSystem` (which would make it depend
on both engines for no reason beyond this one field), `GameManager`
composes the result itself, since it's the one class that already holds
both `stageWaves` and `turnBattle`:

1. Remove the `alive` field from `StageWaveSystem.getProgress()`'s return
   shape (it becomes `{ spawned: number; total: number }`), and update
   `StageWaveSystemDeps` to drop `battleSystem.getBattle()`-for-alive
   usage — implementer confirms `battleSystem` isn't needed elsewhere in
   `StageWaveSystemDeps` before deciding whether to drop the dependency
   entirely or just this one read (`resolveBossSummons()` at
   `StageWaveSystem.ts:218` also reads `this.deps.battleSystem.getBattle()`
   for `pendingSummons` — that is a SEPARATE, currently-dead code path
   not called from the live tick loop per the earlier audit; leave it
   alone, out of scope for this fix, unless the implementer finds it has
   since become live).
2. `GameManager.getStageProgress()` (`GameManager.ts:3096-3098`) composes
   the final shape itself:
   ```ts
   getStageProgress(): { spawned: number; total: number; alive: number } | null {
     const progress = this.stageWaves.getProgress()

     if (!progress) {
       return null
     }

     return {
       ...progress,
       alive: this.turnBattle?.enemies.filter((enemy) => enemy.entity.alive).length ?? 0,
     }
   }
   ```
   Filtering on `entity.alive` (not just array length) matches how "is
   this participant still in the fight" is checked elsewhere in the turn
   engine (e.g. `collectTurnTargets()`'s `.filter((p) => p.entity.alive)`
   in `TurnSkillAction.ts:271`) — a dead-but-not-yet-pruned enemy
   shouldn't count as "alive" in the HUD. Confirm at implementation time
   whether `turnBattle.enemies` ever retains dead entries mid-battle (if
   the engine always prunes them immediately, `.length` alone would be
   equivalent, but the filter is the correct one regardless).

## Testing Strategy

- **Component 1**: a real end-to-end test (extending
  `GameManager.talentv4.qa.test.ts`'s existing "INV" style, following the
  same "drive a real battle through production code, assert on
  production state" convention A2 Component 2 used) that: starts a
  battle for a `bat_tu_the`-selected player, applies a debuff to the
  player's live `TurnBuffPool`, forces a lethal hit, and asserts (a) the
  player survives at HP 1, (b) the debuff is gone from
  `turnBattle.players[0].buffs`, (c) `tu_sinh_ngo` is present in that
  same pool. Also update `GameManager.talentv4.test.ts:106-142`'s
  existing "session gắn surviveEffects" test, since its assertions
  currently check the legacy-typed shape and need to check the
  turn-based one instead.
- **Component 2**: extend or add a `GameManager`/`StageWaveSystem`
  integration test that starts a turn-based battle, kills one of several
  spawned enemies via the real engine, and asserts
  `getStageProgress()!.alive` reflects the correct remaining count (not
  `0`).
- Full suite + type-check + build, per standing verification
  requirements. No P14 trigger for Component 1 (no visible UI change).
  Component 2 changes a real HUD number
  (`CombatTopBar.vue`) — a P14 pass showing the counter tick down across
  a real turn-based fight is warranted before calling this component
  done.

## Open Items For The Implementation Plan (not decided here)

- Exact current signature/call sites of `StageWaveSystemDeps.battleSystem`
  beyond `getProgress()`/`resolveBossSummons()` — implementer confirms
  nothing else depends on it before deciding whether to keep the field
  for `resolveBossSummons()`'s sake or restructure further (restructuring
  `resolveBossSummons()` itself is explicitly out of scope — see
  Component 2's Non-Goals-equivalent note above).
- Whether `players[0]` is a safe assumption for "the human player" in
  `buildTurnBattle()` across all current call sites, or whether a more
  explicit accessor already exists — implementer verifies against
  current code before hardcoding the index.
