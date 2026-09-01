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
  rework, not a content rebalance (does not apply to Phase 2's own new
  content, since the user has explicitly waived parity for that — see
  Phase 2 below).
- ~~Not extending the system to enemy/boss AI skill authoring in this
  pass~~ — superseded by Phase 2: the whole point of the trigger/action
  model is one shape for every `CombatEntity`, not one for players and a
  separate one for enemies.

## Phase 1 (shipped) vs Phase 2 (this section)

Phase 1 (see "Migration plan" below, already implemented and merged) built
the core engine and proved it end-to-end on exactly one skill (Huy Kiếm),
with exactly one trigger (`onCast`) and one action (`dealDamage`) wired into
production. Everything below this point is Phase 2: complete the trigger
and action vocabulary, and — the part Phase 1 explicitly deferred — make
`CombatEntity` truly the only unit of account, so enemies stop having a
parallel, simpler attack system.

## Phase 2 — complete vocabulary + universal entity model

### Why this is one architectural decision, not two

The user's own framing: "không có chuyện mỗi skill mỗi event bao giờ" (no
skill/mechanic ever gets its own bespoke field or event again). The old
`SkillEffect` fields (`grantsSwordIntentPerHit`, `grantsHoaThePerCast`, ...)
were exactly that anti-pattern. The trigger/action registry already fixes
it in principle — but investigation found the fix is currently incomplete
in one specific way: **enemies never went through it at all.**

`BattleSystem.updateEnemyAttacks()`/`fireEnemyAttack()` (`BattleSystem.ts`
~3084-3215) is a second, parallel combat pipeline: enemy data carries
`specialAttacks: {everyNth, damageMultiplier, presetId?, windupSeconds?}[]`
on the entity itself, resolved by picking the first `everyNth` match on an
attack counter and calling `actionImpact.scheduleBasic({damage: {kind,
multiplier}, presetId, windupSeconds})` directly — bypassing
`SkillEffectSystem`/`SkillActionRegistry`/`SkillTriggerRunner` entirely. An
enemy today cannot apply an ailment, grant itself a resource, or use any
mechanic beyond "one physical hit at a damage multiplier." This is a second
"mỗi entity một cơ chế riêng" problem sitting right next to the one Phase 1
solved for skills — so closing it is part of the same architectural goal,
not a follow-on nice-to-have.

**Decision: enemies get real `Skill[]` (with `triggers`), cast through the
exact same `resolveSkillEffects()` pipeline the player uses.** No second
executor, no second registry, no second trigger vocabulary for enemies.

### Trigger vocabulary — the remaining 7

Phase 1 wired `onCast`. This phase wires the rest, but — per the discovery
made during design — most of them don't need a hand-wired call site added
to `BattleSystem`/`CombatSystem`; they're emitted *from inside the action
executor that causes them*, which is itself a small extension to
`SkillTriggerRunner`'s contract (see "Nested firing" below):

| Trigger | Real firing site | Mechanism |
|---|---|---|
| `onHit` / `onCrit` / `onEvade` | `BattleSystem.ts`'s missile-resolve callback (~line 1321, where `grantsSwordIntentPerHit`/`grantsMomentumPerHit`/`breakDamagePerHit` are read today) | Hand-wired call site — this is a genuine external event (a hit resolved), not something an action executor can know about itself. |
| `onKill` / `onDeath` | `CombatSystem.killIfDead()` (`CombatSystem.ts:418-462`) | Hand-wired call site. This is the **single convergence point** for every death pathway already (direct damage, DoT, ward-break, thorns — it already emits the legacy `'death'`/`'kill'` EventBus events here), so one addition covers all of them. |
| `onTick` | `BattleSystem.updateChanneling()` | Hand-wired call site — channel skills only; DoT/zone ticks stay on the ailment/zone systems' own tick, not a skill-level trigger, since a DoT already applied and detached from its casting skill's per-cast context. |
| `onProc` | Inside the new `applyAilment` executor, immediately after a successful chance roll | Nested firing — no separate call site. |
| `onResourceFull` | Inside the new `grantResource` executor, when the write clamps to the pool's max | Nested firing — no separate call site. |
| `onBreak` | Inside the new `consumeResource` executor, when a Break-Gauge-targeted consume reaches 0 | Nested firing — no separate call site. |

**Nested firing**: `SkillTriggerRunner.fire()` gains a `triggers:
TriggerBinding[] | undefined` parameter it already threads through (per
Phase 1's `EffectiveSkill`-vs-`Skill` fix), and the `ActionExecutor`
signature gains a `fire: (trigger, context) => void` callback bound to the
same runner/triggers/source/target/ctx, so `applyAilment`/`grantResource`/
`consumeResource` can call `runtime.fire('onProc', {...})` etc. without
needing their own copy of the runner or the skill's trigger list.

### Action vocabulary — the remaining 10

Finalized during design (see conversation): `applyMovement` was proposed in
the original spec table but investigation found no real per-action
movement primitive to port — knockback is a **batch-level** field
(`options.knockbackDistance`, threaded through `resolveOneHit`, set once at
`beginSkillBatch`), and root is already just the `troi_chan` ailment. Both
fold into existing actions instead of getting a new one:

| Action | Fields | Replaces / notes |
|---|---|---|
| `dealDamage` (Phase 1, extended) | + `knockbackDistance?: number` | batch-level knockback, read at `beginSkillBatch` time same as `earthPureAreaBehavior` today |
| `heal` | `value?: number`, `healPercentOfDamage?: number` (reads `runtime.consumedDamage`) | `heal` effect. Default scope: source (self-heal) unless the binding declares otherwise |
| `applyBuff` | `buffId: string` | `buff` effect — applies to `ctx.sourceBuffs` |
| `applyDebuff` | `buffId: string` | `debuff` effect — applies to `ctx.targetBuffs` |
| `applyAilment` | `ailmentId: AilmentId`, `chance?: number` | `ailment` effect + `ailmentChance`; fires `onProc` on success (see above); still calls `ctx.reactionManager.checkAndTrigger(...)` unchanged |
| `grantResource` | `pool: SkillResourcePoolKey`, `amount: number` | `grantsHoaThePerCast`/`grantsSwordIntentPerHit`/`grantsMomentumPerHit`/etc.; max looked up per-pool from existing `MAX_*` constants (`CombatTypes.ts`), fires `onResourceFull` on clamp |
| `consumeResource` | `pool: SkillResourcePoolKey \| 'breakGauge'`, `amount: number \| 'all'` | writes `runtime.consumedAmount`; `pool: 'breakGauge'` targets the enemy's Break Gauge and fires `onBreak` at 0, replacing `breakDamagePerHit` |
| `consumeForDamage` | `source: 'ailment' \| 'ward'`, `ailmentId?: AilmentId` (required when `source: 'ailment'`), `damagePerUnit: number`, `healPercentOfDamage?: number` | unifies Detonate (`consumesAilmentId`+`damagePerStack`) and ward-break (`consumesWardForDamage`+`damagePerWardPoint`); writes `runtime.consumedDamage` |
| `spawnZone` | `zoneKind: 'lava' \| 'sword'`, `charges: number`, `tickInterval: number`, `damageRatio: number`, `position: 'source' \| 'target'` | `grantsSwordZone` + Lava Zone's existing `spawnLavaZone` path — both already exist as `ctx.spawnLavaZone`/`ctx.spawnSwordZone` |
| `spawnVfx` | `presetId: CombatVfxPresetId`, `target?: 'source' \| 'target'` | emits `eventBus.emit('action_impact', ...)` — reuses the existing pipeline, no new VFX plumbing |

`addStack`/`removeBuff` (from the original `SkillEffectType` union) are
**not** ported — they were already dead code in `SkillEffectSystem.apply()`
(a no-op case, real stacking lives entirely in `PassiveSystem`'s separate
`passiveTrigger`/`passiveModifiers` mechanism). No action needed here.

### Universal entity model — enemies as `Skill[]`

- Enemy data (`game/src/data/enemy/*`) gains a `skills: Skill[]` field,
  replacing `specialAttacks`. Each entry is a real `Skill` — same type
  players use, `triggers`-based (no enemy content is written in the old
  `effects` shape; there is nothing to preserve parity with, since
  `specialAttacks` never had ailments/buffs/resources to begin with).
- Windup (`windupSeconds`) maps to `execution: { kind: 'cast_time',
  castTime: windupSeconds }` — an existing, already-correct policy; no new
  execution kind needed.
- Selection: keep the existing `everyNth`-on-attack-counter policy as the
  enemy "AI" (simpler than the player's Loadout/slot system — enemies don't
  need cooldown UI or manual slot assignment) but resolve it into a `Skill`
  from `entity.skills` instead of a raw `{damageMultiplier, presetId}`
  descriptor; fall back to a default basic-attack `Skill` (mirrors Huy
  Kiếm's role for players) when no `everyNth` matches.
- `fireEnemyAttack()` shrinks to: pick the skill (existing `everyNth`
  logic, new return type) → call `resolveSkillEffects(skill, enemyEntity,
  player, battle)` — the exact function the player path already calls.
  `scheduleBasic()`/`ActionImpactSystem`'s basic-attack path is retired for
  enemies once this lands (`beginSkillBatch`/`endSkillBatch` already covers
  the VFX side generically, per Phase 1's VFX findings).
- `resolvePlayerSkillEffects`/`beginPlayerCast`/`finishPlayerCastTransaction`
  stay player-named and player-only where they truly are (resource
  consumption via the player's mana/Kiếm Ý/Momentum pools, Loadout slot
  bookkeeping, cast-count tracking for Huy Kiếm) — only the shared tail,
  `resolveSkillEffects()` itself, needs to already be (and already is,
  per its current `source`/`target: CombatEntity` signature) entity-agnostic.
  No renaming of the player-specific wrapper functions is required.

### Testing strategy (Phase 2)

- Same registry/firing-site-level testing bar as Phase 1: one test per new
  `SkillActionType` executor (including its nested `onProc`/
  `onResourceFull`/`onBreak` firing), one test per new hand-wired trigger
  context shape.
- No parity tests against old enemy behavior are required — `specialAttacks`
  never had a numeric contract beyond "1 hit, multiplier, preset," and the
  user has explicitly waived preserving old numbers for this beta-phase
  redesign. New enemy `Skill[]` content is designed fresh, not ported.
- Real end-to-end test: at least one enemy in a real battle test using an
  `applyAilment`-bound skill, proving ailments now work on the enemy side
  of combat (something structurally impossible before this phase).

### Out of scope (still, after Phase 2)

- Redesigning/rebalancing actual Ngũ Hành/Kiếm Tu/Thể Tu skill content —
  Phase 2 completes the engine; migrating existing player skill *data* off
  `effects` remains its own follow-up work per path (unchanged from Phase
  1's migration order).
- Tooltip generic-ization (still deliberately last, per the original
  migration plan).
- `CURRENT_SAVE_VERSION` bump (still deferred to when the full rework
  ships, per the user's explicit no-per-save-migration ruling).

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
