# TurnBuffSystem — Design Spec

Date: 2026-09-04
Status: Approved (design), not yet planned/implemented

## 1. Motivation

`BuffSystem.ts` (`game/src/core/buff/BuffSystem.ts`) is the highest
blast-radius file in the whole turn-based combat rework: 33 files
reference its duration-related fields (`duration`, `remainingTime`,
`continuousSeconds`, `damagePerSecond`, `convertsAfterContinuousSeconds`)
across core logic, 8+ combat data files, renderer/VFX/tooltip
presentation, and ~15 test files. It is consumed by the Reaction Engine
(`ReactionManager.ts`), boss enrage/tribulation (`TribulationPhase.ts`
buffs), equipment/talent passives, and every Ngũ Hành element's buff
output.

Critically: **`BuffSystem.ts` is not dormant scaffolding — it is the
system driving the live, currently-playable real-time combat.**
`BattleSystem.ts` (also live) calls `BuffSystem.update(deltaSeconds, ...)`
in 4 places inside its real-time tick loop. This is different from
Milestone 1's Foundation primitives, the AOE Shape extension, and
TurnBattleSystem Slice 1 — all of which are net-new files nobody calls
yet. Converting `BuffSystem.ts` in place — dropping `deltaSeconds`,
renaming `damagePerSecond`→`damagePerTurn` — would immediately break the
live game, since `BattleSystem.ts`'s real-time loop has no concept of
"a turn" to call it with.

**Decision (locked via brainstorming, 2026-09-04): build a fully separate,
new file — `TurnBuffSystem.ts` — that does not modify or get called by
any currently-live file.** It exists standalone and tested, exactly like
Milestone 1's Foundation primitives (`ActionGauge.ts`, `TurnQueue.ts`,
etc.) and Slice 1's `TurnBattleSystem.ts`. The live `BuffSystem.ts`
continues serving real-time combat unchanged. `TurnBuffSystem.ts` becomes
the buff engine only once a later slice performs the actual `BattleSystem`
cutover and rewires callers — that wiring is explicitly out of scope
here, matching the "each system gets its own plan" project convention.

## 2. Scope

**In scope:**
- New file `game/src/core/battle/turn/TurnBuffSystem.ts` — a
  `TurnBuffSystem` class with `apply()`, `update()`, `isStunned()`,
  `isFrozen()`, mirroring `BuffSystem.ts`'s real logic 1:1 except for the
  time-unit change described below.
- New file `game/src/core/battle/turn/TurnBuffTypes.ts` — `TurnBuff`,
  `TurnBuffDefinition`, `TurnBuffEffectTemplate`, `TurnBuffEffect`,
  `TurnBuffPolarity`, `TurnBuffStackMode`, `TurnBuffCcEffect` — a
  complete, independent parallel to `BuffTypes.ts`/`BuffDefinition.ts`/
  `Buff.ts`. Not generic over the old types; no shared base type. This
  avoids any accidental coupling where a future edit to the live
  `BuffDefinition` silently changes turn-based behavior or vice versa.
- New file `game/src/core/battle/turn/TurnBuffPool.ts` — a minimal pool
  class mirroring `BuffPool.ts`'s 8 methods (`getAllById`,
  `getFromSource`, `getAll`, `hasAny`, `add`, `removeInstance`,
  `removeAllById`, `clear`), operating on `TurnBuff[]`. Duplicated
  rather than generalizing the live `BuffPool<T>` — `BuffPool.ts` is
  small (37 lines) and duplicating it keeps this plan's blast radius at
  zero live files, consistent with the rest of this decision.
- All 4 effect types from the live system (`statModifier`, `dot`, `cc`,
  `onHitProc`) — same shapes, same fields, EXCEPT the two DoT fields
  renamed per §3.
- Stack modes (`stack`/`refresh`/`replace`) and buff→buff conversion
  (`convertsToId`/`convertsAfterContinuousTurns`) — same logic as
  `BuffSystem.ts`'s `handleExisting()`/`convert()`, ported verbatim
  except for the renamed time fields.
- Unit tests only, no wiring into any consumer.

**Explicitly out of scope:**
- Any change to `BuffSystem.ts`, `Buff.ts`, `BuffPool.ts`,
  `BuffTypes.ts`, `BuffDefinition.ts`, or `BuffRegistry.ts` — the live
  files are untouched.
- Any change to `BattleSystem.ts`'s 4 `BuffSystem.update()` call sites.
- Any change to buff content (`game/src/data/buff/buffs.ts`, boss enrage
  buffs in `TribulationPhase.ts` data, equipment/talent passive buffs) —
  these remain authored against the live `BuffDefinition` shape.
- Any change to presentation/VFX (`combat-vfx-spawner.ts`,
  `combat-status-tooltip.ts`, `CombatScene.ts`) — these display the live
  system's real-time `remainingTime`/`durationSeconds` and are unaffected
  until the real cutover.
- `ReactionManager.ts` — still calls the live `BuffSystem`/`BuffPool`;
  its own turn-based conversion (event-triggered call site relocation,
  per the earlier survey) is separate future work, unblocked by this
  plan but not performed here.
- Wiring `TurnBuffSystem` into `TurnBattleSystem` (Slice 1's core loop
  has zero buffs today) — a later slice's job once Slice 1 is verified.

## 3. Time-Unit Conversion (locked decisions)

1. **Tick timing**: a buff's remaining-turns count decrements exactly
   once per the **buff-holder entity's own turn** (the entity whose
   `TurnBuffPool` holds the instance) — not the turn of whoever applied
   it, not every actor's turn. A buff applied to an entity mid-battle
   (e.g. via a Reaction triggered by someone else's action) starts
   counting down from that entity's *next* turn start — it is never
   partially decremented for a turn that already happened before it was
   applied. This matches the general project-wide policy already locked
   for all other turn-converted resources (Ngũ Hành Thế decay, Momentum
   decay, etc. — `ResourceTurnHook.ts`, Foundation Milestone 1).
2. **Field renames** — `Buff`/`BuffDefinition`'s time-flavored field
   names are renamed in the new parallel types to reflect the new unit:
   - `duration` → kept as `duration` (already unit-agnostic, no rename
     needed).
   - `remainingTime` → `remainingTurns`.
   - `continuousSeconds` → `continuousTurns`.
   - `convertsAfterContinuousSeconds` → `convertsAfterContinuousTurns`.
   - `DotEffectTemplate`/`DotEffect`'s `damagePerSecond` →
     `damagePerTurn` (the resolved runtime value; the authored template
     still carries `dpsRatio`, unchanged — it is a ratio against source
     Power, not a time unit, and stays named as-is since it's not
     multiplied by any time delta at all, only by stacks/mitigation).
3. **`update()` signature**: no `deltaSeconds` parameter.
   `TurnBuffSystem.update(target, combatSystem, registry?, resolveSource?)`
   — one call ticks exactly one turn. DoT damage per call:
   `damagePerTurn * stacks * poisonRootMultiplier(...)` — the
   `* deltaSeconds` multiplication in the live `apply/update` is simply
   dropped, not replaced by any constant, since 1 call = 1 turn exactly.
4. **No balance re-tuning**: every authored numeric `duration`/
   `convertsAfterContinuousSeconds` value carries over unchanged as a
   turn-count (a debuff authored as `duration: 5` meant "5 seconds"
   under the live system; under `TurnBuffDefinition` the same `5` means
   "5 turns"). This is a deliberate, explicit non-goal for this plan —
   rebalancing each buff's numeric value for turn-based pacing is
   separate future content work, matching the precedent already set
   for other systems in this rework (Magicpath General Reaction Engine's
   16/17 balance passes were likewise deliberately deferred).

## 4. Testing

Standard Vitest unit tests for `TurnBuffSystem.ts`, mirroring
`BuffSystem.test.ts`'s existing case shapes but asserting on turns
instead of seconds:
- `apply()` on a fresh target creates a `TurnBuff` with
  `remainingTurns === duration` (after resist/duration-percent
  modifiers).
- Re-`apply()` under each stack mode (`stack` capped at `maxStacks`,
  `refresh` resets `remainingTurns`, `replace` swaps `effects`).
- `stack` mode hitting `maxStacks` with `convertsToId` set converts to
  the target definition (verbatim `convert()` port).
- `update()` called once decrements `remainingTurns` by exactly 1 and
  increments `continuousTurns` by exactly 1; at `remainingTurns <= 0`
  the buff is removed from the pool.
- A `dot` effect deals `damagePerTurn * stacks` (no stray
  `deltaSeconds` factor) via `combatSystem.applyDotDamage`.
- `continuousTurns` crossing `convertsAfterContinuousTurns` triggers
  `convert()` exactly like the live system's `continuousSeconds` path.
- `isStunned()`/`isFrozen()` reflect an active `cc` effect with
  `ccEffect: 'stun'` / `'freeze'`.

## 5. What This Does Not Prove

Not validated here: any real consumer wiring (Reaction Engine, boss
enrage, equipment/talent content, TurnBattleSystem integration), any
presentation/VFX display, any balance tuning of authored duration
values. This plan's only job is: does the buff apply/stack/tick/expire/
convert kernel work correctly when driven by discrete turn calls instead
of `deltaSeconds`, as a standalone, zero-risk-to-live-game unit.
