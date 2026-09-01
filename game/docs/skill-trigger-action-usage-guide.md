# Skill Trigger/Action Engine — Usage Guide

How to work with the trigger/action skill engine introduced by
`docs/superpowers/specs/2026-08-31-skill-trigger-action-rework-design.md`.
A skill is either fully on the old `effects: SkillEffect[]` shape or fully
on the new `triggers: TriggerBinding[]` shape — never both.

## Add a new skill using triggers you already have

The full trigger vocabulary is wired into real firing sites:
`onCast` (`BattleSystem.ts`'s cast-resolve path), `onHit`/`onCrit`/`onEvade`
(`BattleSystem.applyActionHit()`), `onKill`/`onDeath`
(`CombatSystem.killIfDead()`), and `onTick` (`BattleSystem.resolveChannelTick()`
for channeled skills). `onProc`/`onResourceFull`/`onBreak` are nested triggers
that fire from inside the action executor that causes them (see
`ActionExecutionHelpers.fireNested` below) rather than from a `BattleSystem`
call site.

1. Pick the trigger you need and the action(s) to run — all 10
   `SkillActionType`s are implemented in
   `game/src/core/skill/SkillActionRegistry.ts` (`dealDamage`, `heal`,
   `applyBuff`, `applyDebuff`, `applyAilment`, `grantResource`,
   `consumeResource`, `consumeForDamage`, `spawnZone`, `spawnVfx`).
2. Add the skill to `game/src/data/skill/Skills.ts` with `effects: []` and
   a `triggers` array, e.g.:

   ```ts
   triggers: [
     { trigger: 'onCast', actions: [{ type: 'dealDamage', value: 1, damageType: 'physical' }] },
   ],
   ```
3. `SkillSystem.getEffectiveSkill()` already applies per-level scaling to
   any `dealDamage.value` — no extra work needed unless your skill needs
   the Huy-Kiếm-style flat-per-cast bonus (that special case is keyed off
   `skill.id === 'tram'` in `SkillSystem.ts` — do not copy that pattern for
   a new skill; ask before adding a second hardcoded id there).
4. Write a `SkillSystem.*.test.ts`/`BattleSystem.*.test.ts` covering it,
   same as any existing skill.

`hitCountByRealm`/`components` on a `dealDamage` action are honored for
damage, and `BattleSystem.ts`'s `onCast` firing loop (right after
`beginSkillBatch()`, before `endSkillBatch()`) reuses the SAME batch that
the old `effects` path opened — a triggers-based skill's `fireHit` calls
land inside one `action_impact` VFX event exactly like the legacy path.
There is no longer a batch-derivation gap to work around.

### Available triggers and actions (Phase 2A)

Triggers: `onCast`, `onHit`, `onCrit`, `onEvade`, `onKill`, `onDeath`,
`onTick`, `onProc`, `onBreak`, `onResourceFull`. Actions: `dealDamage`,
`heal`, `applyBuff`, `applyDebuff`, `applyAilment`, `grantResource`,
`consumeResource`, `consumeForDamage`, `spawnZone`, `spawnVfx`.

`onProc` (fires inside `applyAilment` on a successful roll),
`onResourceFull` (fires inside `grantResource` when a pool clamps to max),
and `onBreak` (fires inside `consumeResource` when `pool: 'breakGauge'`
reaches 0) don't need a firing-site call anywhere — bind them the same way
as any other trigger in `skill.triggers`, and they'll fire automatically
whenever the causing action runs, on ANY skill, without touching
`BattleSystem.ts`. This is the concrete case of "add a parameter, every
related system picks it up automatically."

## Add a new TriggerType

1. Add the literal to `TriggerType` in `game/src/core/skill/SkillTrigger.ts`.
2. Add its context interface (what data the trigger carries) to the same
   file, and a matching entry in `TriggerContextMap`.
3. Add ONE firing call at the site in the codebase where that moment
   actually happens (e.g. `BattleSystem.applyActionHit()` for a hit-based
   trigger, `CombatSystem.killIfDead()` for a kill/death trigger) — call
   `skillTriggerRunner.fire(yourTrigger, context, triggers, source, target, ctx)`,
   where `triggers` is the resolved `TriggerBinding[]` for the current
   skill (e.g. `effective.triggers` in production code, not the
   `Skill`/`EffectiveSkill` object itself).
   No other file needs to change: `SkillTriggerRunner` is generic over
   `TriggerType` already.
4. Add a firing-site-level test (see `SkillTriggerRunner.test.ts` for the
   pattern) using a synthetic skill fixture, independent of any real game
   skill.

## Add a new SkillActionType

The registry is closed today — every `SkillActionType` has an executor in
`SKILL_ACTION_REGISTRY` (`game/src/core/skill/SkillActionRegistry.ts`), and
the `{ [K in SkillActionType]: ActionExecutor<...> }` mapped type means
TypeScript refuses to compile if a new `SkillActionType` is missing one.

1. Add the interface to `game/src/core/skill/SkillAction.ts` and union it
   into `SkillAction`.
2. Add its executor to `SKILL_ACTION_REGISTRY` in
   `game/src/core/skill/SkillActionRegistry.ts`.
3. If the action should fire a nested trigger on some internal condition
   (e.g. `applyAilment` firing `onProc` on a successful roll, `grantResource`
   firing `onResourceFull` on hitting the cap, `consumeResource` firing
   `onBreak` on hitting zero), call
   `helpers.fireNested('onWhatever', { ...context })` from inside the
   executor — see `applyAilment`/`grantResource`/`consumeResource` in
   `SkillActionRegistry.ts` for the pattern. `fireNested` is threaded in as
   the executor's 6th parameter (`ActionExecutionHelpers`) by
   `runSkillAction()`, not looked up globally.
4. Add a registry-level test (see `SkillActionRegistry.test.ts`) — one
   test per action type, independent of any specific skill or trigger.
5. If porting an existing `SkillEffect` mechanic, keep the numeric formula
   byte-for-byte identical to `SkillEffectSystem.apply()`'s matching case —
   write a parity test like `SkillEffectParity.test.ts` before deleting the
   old field/case.

## Add a new VFX for an action

Do not build a new event pipeline. `spawnVfx` is implemented
(`SkillActionRegistry.ts`) and calls `eventBus.emit('action_impact', {...})`
— the exact event `ActionImpactSystem.ts` already emits and
`CombatScene.ts`/`CombatVfxSpawner` already subscribe to once. Follow that
executor as the template for any action that needs to spawn VFX outside a
`fireHit` call. Adding a new VFX *look* is a
`game/src/data/vfx/CombatVfxPresets.ts` entry, not a code change anywhere
else.

## What's NOT migrated yet

The full trigger/action vocabulary now exists (10 triggers, 10 actions) —
every current `SkillEffect`/`Skill` mechanic has an equivalent. What's
still outstanding:

- Every skill except Huy Kiếm (`tram`) is still on the old `effects` shape
  and works exactly as before — `SkillEffectSystem`/`SkillEffect.ts` are
  untouched and will stay in use until each path (Hỏa Tu, Thủy Tu, Mộc Tu,
  Thổ Tu, Kim Tu, the rest of Kiếm Tu, Thể Tu) gets its own migration plan.
- Enemies still use `specialAttacks[]`, a separate, simpler pipeline that
  cannot use ailments/buffs/resources — the "universal entity model"
  (enemies authored as real `Skill[]`, cast through the exact same
  `resolveSkillEffects()` pipeline as the player) is Phase 2B, a follow-up
  plan.
- `onKill`/`onDeath` are structurally complete (`CombatSystem.killIfDead()`
  can fire them) but have no live production firing site yet — no
  production caller passes `killIfDead()`'s optional `skillContext`, and
  `onDeath` is deliberately unfired pending a per-entity skill-list lookup
  (see the comment above `killIfDead()`'s `fireKillTriggers` call).
