# Skill Trigger/Action Engine — Usage Guide

How to work with the trigger/action skill engine introduced by
`docs/superpowers/specs/2026-08-31-skill-trigger-action-rework-design.md`.
A skill is either fully on the old `effects: SkillEffect[]` shape or fully
on the new `triggers: TriggerBinding[]` shape — never both.

## Add a new skill using triggers you already have

1. Pick the trigger (`onCast` today — the only one wired into
   `BattleSystem`) and the action(s) you need (`dealDamage` today —
   `game/src/core/skill/SkillAction.ts`).
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

## Add a new TriggerType

1. Add the literal to `TriggerType` in `game/src/core/skill/SkillTrigger.ts`.
2. Add its context interface (what data the trigger carries) to the same
   file, and a matching entry in `TriggerContextMap`.
3. Add ONE firing call at the site in the codebase where that moment
   actually happens (e.g. the missile-resolve callback in
   `BattleSystem.ts` for a hit-based trigger, `CombatSystem.ts` for a
   kill/death trigger) — call `skillTriggerRunner.fire(yourTrigger, context, skill, source, target, ctx)`.
   No other file needs to change: `SkillTriggerRunner` is generic over
   `TriggerType` already.
4. Add a firing-site-level test (see `SkillTriggerRunner.test.ts` for the
   pattern) using a synthetic skill fixture, independent of any real game
   skill.

## Add a new SkillActionType

1. Add the interface to `game/src/core/skill/SkillAction.ts` and union it
   into `SkillAction`.
2. Add its executor to `SKILL_ACTION_REGISTRY` in
   `game/src/core/skill/SkillActionRegistry.ts` — TypeScript will refuse to
   compile until every `SkillActionType` has one, so you cannot forget
   this step.
3. Add a registry-level test (see `SkillActionRegistry.test.ts`) — one
   test per action type, independent of any specific skill or trigger.
4. If porting an existing `SkillEffect` mechanic, keep the numeric formula
   byte-for-byte identical to `SkillEffectSystem.apply()`'s matching case —
   write a parity test like `SkillEffectParity.test.ts` before deleting the
   old field/case.

## Add a new VFX for an action

Do not build a new event pipeline. `spawnVfx` (not yet implemented — add
it the same way as any other action, per the section above) should just
call `eventBus.emit('action_impact', {...})` — the exact event
`ActionImpactSystem.ts` already emits and `CombatScene.ts`/
`CombatVfxSpawner` already subscribe to once. Adding a new VFX *look* is a
`game/src/data/vfx/CombatVfxPresets.ts` entry, not a code change anywhere
else.

## What's NOT migrated yet

Every skill other than Huy Kiếm (`tram`) is still on the old `effects`
shape and works exactly as before — `SkillEffectSystem`/`SkillEffect.ts`
are untouched and will stay in use until each path (Hỏa Tu, Thủy Tu, Mộc
Tu, Thổ Tu, Kim Tu, the rest of Kiếm Tu, Thể Tu) gets its own migration
plan, per the design spec's migration order.
