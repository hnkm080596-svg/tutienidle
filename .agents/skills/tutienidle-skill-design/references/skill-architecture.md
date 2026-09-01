# Skill architecture reference

Core files: `game/src/core/skill/{Skill,SkillTypes,SkillEffect,SkillEffectSystem,SkillSystem,SkillManager,PassiveSystem,SkillRuntimeStats}.ts`, `game/src/core/progression/{NodeSystem,ProgressionNode}.ts`, `game/src/core/ailment/{Ailment,AilmentTypes,AilmentSystem,AilmentRegistry}.ts`, `game/src/core/element/{ElementReaction,ReactionManager}.ts`, `game/src/composables/useTooltip.ts`.

## The 6 paths

- 5 Ngũ Hành elements under `phap_tu`: Hỏa (fire/DoT+resource `currentHoaThe`), Thủy (water/static defense), Mộc (poison, 0-direct-damage `doc_chuong`), Thổ (root CC + shield-consume), Kim (proc-gated resource + metal DoT bonus). Each element has its own Node Tree and exactly **one root skill == the tree's starter skill** (Hỏa root costs 0, others cost 2 skill points).
- `kiem_tu` (Kiếm Tu / Sword cultivator): dedicated 0–9999 `currentSwordIntent` resource (`MAX_SWORD_INTENT` in `CombatTypes.ts`), multi-hit basic (`hitCountByRealm`), channeled ultimate (`execution.kind === 'channel'`).
- `the_tu` (Thể Tu / Body cultivator): 0–100 `currentMomentum` resource, Break Gauge engine (`breakDamagePerHit`, Stagger on 0).

Every path shares the same `Skill`/`SkillEffect`/`ProgressionNode` shape — do not invent a parallel data model for a new path or element.

## Skill shape (`Skill.ts`)

Required on every active skill:
- `id` (pinyin, snake_case), `name`/`description` (Vietnamese, diacritics — never renamed once shipped, N5), `type: 'active'|'passive'`.
- `execution: SkillExecutionPolicy` — **mandatory for active skills, runtime reads only this field** (no fallback to `castTime`/`isBasicAttack`):
  - `attack_speed` — cadence follows Attack Speed, no ICD/CDR/cast time, timer per loadout slot.
  - `cooldown` — resolves instantly, timer = `cooldown`, affected by CDR.
  - `cast_time` — cast bar before resolving; cooldown commits at cast start; affected by Cast Speed and CDR.
  - `attack_speed_cast` — cast bar + Attack-Speed cadence; not affected by CDR.
  - `channel` — no cooldown/cast time; fires every `tickSeconds` while channeling (Kiếm Tu Bạt Kiếm pattern).
- `resourceType: 'none'|'mana'|'sword_intent'|'momentum'` + `cost` (omit `cost` entirely for `'none'`).
- `target`, `targeting`, optional `laneRadius`/`columnRadius` for grid AOE.
- `passiveTrigger` is mandatory for `type: 'passive'` (reuses `SkillEventType` + `'per_second'`).

## SkillEffect (`SkillEffect.ts`)

One skill = array of `SkillEffect`. Effect `type`: `damage | heal | buff | debuff | ailment | add_stack | remove_buff`.

**Damage effects** compose from a base plus optional flags — reuse these before adding a new field:
- `attributeScaling: {attributes, ratioPerPoint}[]` — multiple entries in one array = "Adaptive" (take the highest), separate array entries = additive.
- `components: SkillDamageComponent[]` — split one hit across multiple `damageType`s (e.g. 20% physical + 80% fire); overrides `damageType` when present.
- `consumesAilmentId` + `damagePerStack` (+ optional `healPercentOfDamage`) — Detonate pattern: trade a running DoT for one burst of **true damage** (bypasses Armor/Resistance), removes the ailment.
- `consumesWardForDamage` + `damagePerWardPoint` — consume the caster's shield for bonus true damage (Thổ Tu pattern).
- `hitCountByRealm` — fire `(realmIndex + 1)` independent missiles (Kiếm Tu pattern).
- `swordIntentDamageRatio` / `realmDamageRatio` / `manaScalingRatio` / `skillExperienceRatio` — read-only scaling off an existing resource/stat, does not consume it.
- `earthPureAreaBehavior` — opt into AOE+Knockback missile behavior (only meaningful with `earthAoeRadius` etc. set via node purchase).
- `grantsSwordZone` (+ `swordZoneCharges/TickInterval/DamageRatio`) — spawn a persistent zone at the target after the missile lands.

**Ailment effects**: set `ailmentId` (look up category/duration/DoT-ratio/CC-effect from `AilmentRegistry`) and `ailmentChance` (0..1, rolled independently of dodge/crit — never implicitly 100%, must be declared). Optional `grantsKimThePerProc` / `grantsHuyetPhaPerProc` fire only on a **successful** chance roll (contrast with `Skill.grants*PerCast`, which fires on every cast regardless of hit).

**Every SkillEffect field is path-specific by convention** — check the inline comment above each field in `SkillEffect.ts` before reusing it outside its documented path; most are hard-gated to one effect `type`.

## Trigger/Action engine (in progress — 2026-08-31 rework)

A new, generic alternative to per-skill `SkillEffect` fields is being
phased in (`docs/superpowers/specs/2026-08-31-skill-trigger-action-rework-design.md`),
skill by skill. A skill declares `triggers: TriggerBinding[]` (`game/src/core/skill/SkillTrigger.ts`)
instead of `effects`: each binding pairs a `TriggerType` with an ordered
`SkillAction` list, run through the exhaustive `SkillActionRegistry`
(`game/src/core/skill/SkillActionRegistry.ts`). A skill is EITHER on
`effects` OR on `triggers`, never both.

As of this writing the full vocabulary is implemented: 10 triggers
(`onCast`/`onHit`/`onCrit`/`onEvade`/`onKill`/`onDeath`/`onTick`/`onProc`/
`onBreak`/`onResourceFull`) and 10 actions (`dealDamage`/`heal`/
`applyBuff`/`applyDebuff`/`applyAilment`/`grantResource`/
`consumeResource`/`consumeForDamage`/`spawnZone`/`spawnVfx`) — enough to
express every mechanic the old `SkillEffect` fields covered. `onProc`/
`onResourceFull`/`onBreak` fire from inside their causing action's
executor (no firing site to wire per new skill). Only Huy Kiếm (`tram`) has
actually migrated its DATA to `triggers` so far — every other skill is
still on `effects` and behaves identically; enemies still use a separate
`specialAttacks[]` pipeline pending a follow-up "universal entity model"
plan. See `game/docs/skill-trigger-action-usage-guide.md` for the current
trigger/action list and how to add a new skill, trigger, or action.

## Ailments (`AilmentTypes.ts`, `ElementReaction.ts`)

`AilmentCategory` is exactly `'dot' | 'cc' | 'modifier'` — **no empty/marker category**. An ailment used purely as a Reaction-alignment marker (e.g. Thạch Hóa) must still carry a real dot/cc/modifier effect; the old `'alignment'` category was removed for this reason (2026-08-21 policy, see `[[tienhiep-feedback-no-empty-ailments]]` project memory). `AilmentCcEffect` is `'stun' | 'freeze' | 'root'` — `root` blocks movement only, not action.

Elemental Reactions are keyed by pairs of `AilmentId` in `ElementReaction.ts`/read by `ReactionManager.ts`; a Reaction can output damage, a new ailment, or a self-buff on the trigger source.

## Node Tree (`ProgressionNode.ts`, `NodeSystem.ts`)

`player.nodeLevels` (`Record<nodeId, level>`) is the single source of truth for what's been unlocked — level 0 = not learned, `getNodeMaxLevel` defaults to 1 (buy-once). Modifiers are **never** pushed permanently into `player.modifiers` or mutated onto the `Skill` instance at purchase time; they're always re-derived from `(registry, nodeLevels)` via `aggregateNodeStatModifiers()`/`aggregateNodeSkillModifiers()` so reload is idempotent.

`NodePrerequisite.kind`: `realm | element | node | nodeCount | excludesNode | skillCastCount`. Cost is `node.upgradeCost = {base, perLevel}` (`cost(L→L+1) = base + floor(L/perLevel)`) when multi-level, else flat `insightCost`.

Path-specific runtime counters granted by nodes (Hỏa Thế, Thổ Thế, Kim Thế, Huyết Phá, Break Gauge, etc.) live **directly on the owning `Skill` object** (e.g. `hoaTheGainPerCast`), not on shared `CombatEntity.stats` — a field only ever means something to the one skill that declares it.

## Tooltips (`useTooltip.ts`)

Skills use `TechniqueTooltipContent` (`kind: 'technique'`), a member of the `TooltipContent` discriminated union alongside `EquipmentTooltipContent`, `BuildingTooltipContent`, etc. Populate it whenever a new skill/node ships — the union is exhaustively matched in the render layer, so a missing case is a compile error, not a silent gap.

## Naming (see `game/docs/naming-conventions.md`)

- Skill/technique ids and display names: Vietnamese pinyin without diacritics for the id, full diacritics for the display name — never English flavor words. Mechanic prefix `passive_` is allowed before a Vietnamese root.
- Never invent a new id from scratch; derive it from the display name (strip diacritics, lowercase, `_`-join — rule N2b).
- Any change to a save-relevant `Skill`/`ProgressionNode` field shape requires bumping `CURRENT_SAVE_VERSION` (no-migration convention — old saves are rejected with an Export/Backup escape hatch).

## Extending vs reusing

Before adding a new `SkillEffect`/`Skill` field, check whether the mechanic already fits one of:
1. A `type: 'damage'` effect + `attributeScaling`/`components` (stat-scaled or multi-element damage).
2. A `consumes*`/`grants*PerCast`/`grants*PerProc` flag pair on an existing per-skill resource counter.
3. A Reaction pairing two existing `AilmentId`s instead of a bespoke interaction.
4. A `ProgressionNode` modifier instead of a hardcoded skill-level constant.

Only propose a genuinely new `SkillEffectType` or `SkillExecutionPolicy` kind when none of the above can express the mechanic — these are combat-engine-wide changes (`SkillEffectSystem.ts`, `BattleSystem.ts`) that affect all 6 paths, so confirm with the user before implementing.
