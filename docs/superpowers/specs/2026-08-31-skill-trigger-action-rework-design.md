# Skill Trigger/Action Rework — Design

Status: approved by user, ready for implementation planning.

## Problem

`Skill`/`SkillEffect` (`game/src/core/skill/{Skill,SkillEffect}.ts`) currently
represent every new combat mechanic as a bespoke, path-specific field:
`grantsHoaThePerCast`, `grantsSwordIntentPerHit`, `consumesWardForDamage`,
`grantsSwordZone`, `breakDamagePerHit`, `grantsKimThePerProc`, etc. — about
30 fields, each meaningful to exactly one skill. Adding a new mechanic means:

1. A new field on `Skill` or `SkillEffect`.
2. A new branch in `SkillEffectSystem.ts`'s effect switch, or a new ad-hoc
   read site in `BattleSystem.ts` (missile-resolve callback, `castSkill()`,
   `updateChanneling()`).
3. Manual wiring into VFX (`vfxPresetId` resolution), tooltip text, and any
   other consumer — nothing propagates automatically.

This does not scale as more triggers (on-crit, on-evade, on-kill, on-tick,
on-proc, on-break, on-resource-full...) are needed across 6 combat paths (5
Ngũ Hành elements + Kiếm Tu + Thể Tu). The user wants a structure where
adding a new parameter (a trigger, an action, a VFX hook) makes every
downstream system pick it up automatically instead of requiring changes in
N places.

## Goals

- One consistent way to declare "when X happens, do Y" for any skill on any
  of the 6 paths.
- Adding a new trigger or action type is a single registration, not a
  multi-file wiring exercise.
- VFX stays decoupled from core combat logic (already true today via
  `EventBus`; the rework must preserve this, not regress it).
- Full migration: all existing skills/nodes move to the new shape; no
  permanent dual representation.

## Non-goals

- Not building a full scripting DSL (rejected as over-engineering — see
  "Approaches considered").
- Not changing balance/numbers of any existing skill — this is a structural
  rework, not a content rebalance.
- Not extending the system to enemy/boss AI skill authoring in this pass
  (existing generic Boss Phase/Enrage/Summon system is out of scope; may
  reuse the trigger vocabulary later).

## Approaches considered

1. **Trigger/Action Registry (chosen).** Skills declare `triggers:
   TriggerBinding[]`; each binding pairs a `TriggerType` with a typed
   context and an ordered list of `SkillAction`s. A single
   `Record<SkillActionType, Executor>` registry runs every action —
   TypeScript's discriminated-union exhaustiveness makes forgetting to
   register an action type a compile error, not a silent runtime no-op.
2. **Event bus with independent listeners.** Every action is its own
   subscriber on a shared bus. Rejected: several existing mechanics need
   synchronous, ordered results within one trigger firing (e.g. Detonate:
   consume ailment → compute bonus damage → feed into total damage of the
   same missile) — a pure pub/sub model can't guarantee ordering or thread a
   return value between listeners without extra machinery that duplicates
   what a plain ordered action list already gives for free.
3. **Mini rule DSL / data script.** Maximum flexibility, but the mechanic
   vocabulary is well understood and finite (damage, buff, ailment,
   resource, zone, movement, vfx) — a DSL trades type-safety and
   debuggability for flexibility the project doesn't need (YAGNI).

## Architecture

### Triggers

| Trigger | Fires when | Context |
|---|---|---|
| `onCast` | Skill resolves (not cast-bar start) | `{ source, skill }` |
| `onHit` | An attack from this skill connects | `{ source, target, skill, damageDealt, isCrit }` |
| `onCrit` | Same hit as `onHit`, additionally, when the roll crit | same shape as `onHit` |
| `onEvade` | Target evaded this skill's attack | `{ source, target, skill }` |
| `onDodge` | Source evaded an incoming attack | `{ source, attacker, incomingSkill }` |
| `onKill` | Source reduced target to 0 HP | `{ source, target, skill }` |
| `onDeath` | Source itself reduced to 0 HP | `{ source }` |
| `onTick` | Each channel tick or DoT/zone tick | `{ source, target?, skill, tickIndex }` |
| `onProc` | `applyAilment`'s chance roll succeeded, or a Reaction fired | `{ source, target, skill, ailmentId }` |
| `onBreak` | Target's Break Gauge (Thể Tu) hits 0 | `{ source, target }` |
| `onResourceFull` | A tracked resource pool (Hỏa Thế/Kim Thế/Kiếm Ý/Momentum...) hits max | `{ source, resource }` |

More triggers can be added later by (a) adding one variant to `TriggerType`
+ its context type, and (b) adding one firing call at the relevant existing
site — no other file needs to change, since `SkillTriggerRunner` and the
action registry are already generic over `TriggerType`.

### Actions

`SkillAction` is a discriminated union executed by
`game/src/core/skill/SkillActionRegistry.ts`'s `Record<SkillActionType,
Executor>`:

| Action | Replaces (old field) |
|---|---|
| `dealDamage` | `damage` effect, `components`, `attributeScaling`, `swordIntentDamageRatio`, `realmDamageRatio`, `manaScalingRatio`, `skillExperienceRatio`, `hitCountByRealm` |
| `heal` | `heal` effect, `healPercentOfDamage` (reads `ctx.consumedDamage` from a prior `consumeForDamage` action in the same binding) |
| `applyBuff` / `applyDebuff` | `buff` / `debuff` effect |
| `applyAilment` | `ailment` effect + `ailmentChance`; `grantsKimThePerProc`/`grantsHuyetPhaPerProc` become separate `onProc` bindings instead of flags on this action |
| `addStack` / `removeBuff` | unchanged |
| `grantResource` / `consumeResource` | `grantsHoaThePerCast`, `grantsThoThePerCast`, `grantsSwordIntentPerHit`, `grantsMomentumPerHit` |
| `consumeForDamage` | `consumesAilmentId`+`damagePerStack` (Detonate) and `consumesWardForDamage`+`damagePerWardPoint`, unified with a `source: 'ailment' \| 'ward'` param |
| `spawnZone` | `grantsSwordZone` + `swordZoneCharges`/`swordZoneTickInterval`/`swordZoneDamageRatio` |
| `applyMovement` | Thổ Tu knockback/root behavior |
| `spawnVfx` | `vfxPresetId` resolution — emits an event only, never touches Phaser directly |

**Action chaining**: actions within one `TriggerBinding` run in declared
order, sharing one `ActionRuntimeContext` scratch object (e.g.
`consumeForDamage` writes `ctx.consumedDamage`; a later `heal` action with
`healPercentOfDamage` reads it). This generalizes today's Lifedrain special
case without either action needing to know about the other by name.

### Data flow / firing sites

No new firing sites are needed — the 6 existing call sites change from
"read a field, branch on it" to "build a typed context, call
`SkillTriggerRunner.fire(trigger, context, skill)`":

1. `BattleSystem.castSkill()` → `onCast`.
2. Missile-resolve callback → `onHit` always; additionally `onCrit` when
   `isCrit`; `onEvade` on the source's skill when the target evaded.
3. `updateChanneling()` / DoT tick in `AilmentSystem` → `onTick`.
4. After a successful `applyAilment` chance roll → `onProc`.
5. Break Gauge hits 0 → `onBreak`. A resource pool setter hits its max →
   `onResourceFull`.
6. Target HP hits 0 → `onKill` (source's skill) / `onDeath` (target).

`SkillTriggerRunner` (new, `game/src/core/skill/SkillTriggerRunner.ts`) is
the only module that knows how to match a firing `TriggerType` against
`skill.triggers` and run the matched actions through the registry — no
other system needs to know what triggers exist.

### VFX — reusing the existing pipeline, not building a new one

Investigation confirmed the exact split the user wants **already exists**
and should be reused as-is:

- `game/src/core/battle/ActionImpactSystem.ts` (core, no Phaser import)
  decides *when* and *which* VFX: it emits `eventBus.emit('action_impact',
  {..., presetId, affectedArea, landedTargetIds, hitCount})` via
  `game/src/core/events/EventBus.ts` (framework-agnostic).
- `game/src/game/scenes/CombatScene.ts` subscribes once
  (`eventBus.on('action_impact', ...)`) and delegates to
  `CombatVfxSpawner.onActionImpact` (`game/src/game/scenes/combat/combat-vfx-spawner.ts`),
  which looks up `CombatVfxPreset` (`game/src/data/vfx/CombatVfxPresets.ts`)
  and calls `spawnActionImpactVfx()` (`game/src/game/support/ActionImpactVfx.ts`)
  — the only place that touches `Phaser.GameObjects.Graphics`.
- A parallel pipeline (`onStatusAttached` → `StatusVfxPresets.ts`) handles
  ailment/status VFX the same way.

The `spawnVfx` action therefore just calls `eventBus.emit('action_impact',
...)` (or a new event type on the same bus for non-hit triggers like
`onCast`/`onProc` that want their own VFX) — **no new event bus, no new
Phaser-facing code** is needed. `CombatScene` never needs to change when a
new trigger or preset is added.

### Tooltip

`TechniqueTooltipContent` (`game/src/composables/useTooltip.ts`) is
regenerated from `skill.triggers` (icon per trigger + action summary)
instead of hand-written per-mechanic text, closing the drift between
tooltip copy and actual behavior.

## Migration plan

Sequential, not big-bang, so every step is verifiable before the next:

1. **Core infra**: `TriggerType`/context types, `SkillAction` union,
   `ActionRuntimeContext`, `SkillActionRegistry`, `SkillTriggerRunner`. No
   skill migrated yet — only registry/context-shape unit tests.
2. **Dual-run firing sites**: the 6 call sites call `SkillTriggerRunner.fire`
   alongside (not instead of) the old field reads. Verify against `Huy Kiếm`
   (`id: 'tram'`, `game/src/data/skill/Skills.ts`) — the first, simplest
   skill in the game: no resource cost, no ailment, no path-specific
   mechanic, only a `damage` effect plus its own flat per-cast scaling
   special case. It exercises exactly `onCast`/`onHit`/`onCrit`/`onEvade`
   with none of the resource-pool or ailment machinery, making it the
   cheapest possible proof that the new pipeline reproduces old behavior
   before any path-specific complexity is introduced.
3. **Migrate `Huy Kiếm` first** as the pilot skill (same reason as above —
   smallest surface area, and it belongs to Kiếm Tu, a path migrated later
   in the path order below; migrating it standalone first decouples "does
   the new engine work" from "is a full path correctly converted"). Then
   **migrate path by path**, simplest → most complex (mirrors the original
   Ngũ Hành redesign order in project history): Hỏa Tu → Thủy Tu → Mộc Tu →
   Thổ Tu → Kim Tu → Kiếm Tu (remaining skills) → Thể Tu. Per path: convert
   `game/src/data/skill/Skills.ts` / `game/src/data/progression/*.ts`
   entries, delete the old fields that path alone used, rerun that path's
   `SkillSystem.*.test.ts` / `AilmentSystem.*.test.ts`.
4. **Cleanup**: once the last path is migrated, delete all remaining old
   fields from `Skill.ts`/`SkillEffect.ts`, delete the old switch branches
   in `SkillEffectSystem.ts`, bump `CURRENT_SAVE_VERSION` (no-migration
   convention — old saves rejected, Export/Backup remains the escape hatch).
5. **Tooltip generic-ization** last, since it depends on all data already
   being in the new shape.

## Testing strategy

- **Registry-level**: one test per `SkillActionType` executor, independent
  of any specific skill.
- **Firing-site-level**: one test per `TriggerType` confirming context shape
  and firing moment.
- **Parity tests** for every special-cased legacy mechanic (Detonate,
  ward-consume, sword zone, `hitCountByRealm`, Break Gauge) — assert new
  behavior equals old behavior, not just "doesn't crash."
- Existing `SkillSystem.*.test.ts`/`AilmentSystem.*.test.ts` files stay as
  the regression gate per migrated path: only the data-construction part
  changes (`skill.triggers` instead of loose fields), assertions stay.
- End of each path migration: grep/codegraph sweep confirming no remaining
  reference to that path's old fields outside the path itself.

## Risks

- Touches roughly 15 skill/node data files and dozens of test files across
  multiple sessions — real risk of partial-migration drift if a session
  ends mid-path. Migration plan's per-path boundary exists specifically to
  keep every checkpoint independently green.
- Save-version bump requires the existing Export/Backup escape hatch to
  remain functional through the whole migration (verify at step 4, not
  after).

## Usage guide (post-completion)

To be included in the final deliverable — a short "how to add a new X"
reference for: adding a skill using existing triggers/actions, adding a new
`TriggerType`, adding a new `SkillActionType`, adding a new VFX preset. This
also feeds an update to the existing `tutienidle-skill-design` skill
(`.agents/skills/tutienidle-skill-design/`) so it reflects the new
architecture instead of the pre-rework field-per-mechanic model.
