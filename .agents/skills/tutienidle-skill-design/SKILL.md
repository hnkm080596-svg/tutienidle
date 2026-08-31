---
name: tutienidle-skill-design
description: Design or implement a combat skill/ability (kỹ năng, chiêu thức, passive, node) for a TutienIdle entity — new element skills, Node Tree branches, specializations, or reworks of Skill/SkillEffect/execution policy/ailment/reaction data. Use before writing any new entry in game/src/data/skill or game/src/data/progression, or before extending SkillEffect/Skill/ProgressionNode types; do not use for pure UI/layout work with no gameplay data change.
---

# TutienIdle Skill Design

Design new combat skills (active/passive), Node Tree branches, and specializations that stay consistent with the existing 6-path (5 Ngũ Hành + Kiếm Tu + Thể Tu) combat architecture — instead of re-deriving mechanics ad hoc per request.

## Shared contract

1. Read the [skill architecture reference](references/skill-architecture.md) fully before writing any skill/node data — it is the map of every mechanism a new skill can plug into (effects, execution policy, resources, ailments, reactions, nodes, tooltips).
2. Identify which of the 6 paths (`phap_tu` element, `kiem_tu`, `the_tu`) and which realm tier (Phàm Nhân/Luyện Khí/Trúc Cơ/...) the skill belongs to before designing content — mechanics differ by path (see reference).
3. Follow [`game/docs/naming-conventions.md`](../../../game/docs/naming-conventions.md): skill/technique ids are Vietnamese pinyin without diacritics (`N2`), never English flavor names; mechanic/system fields stay English.
4. Prefer reusing an existing `SkillEffect` field/flag over adding a new one. Only propose a new field when no existing composition (base effect + attributeScaling + a `grants*PerCast`/`grants*PerProc`/`consumes*` flag) can express the mechanic — see "Extending vs reusing" in the reference.
5. New skills need a `SkillEffect.scope` sane default, a real `execution` policy (never leave it fallback-less), a resource cost matching the owning path's pool, and a tooltip via `TechniqueTooltipContent` — the reference has the checklist.

## Workflow

1. **Clarify the fantasy**: what does the skill do, which path/element, active or passive, which realm/tier unlocks it (Node Tree gate).
2. **Read the reference**, then find the closest existing skill for the same path in `game/src/data/skill/Skills.ts` as a template — copy its shape, don't invent a new one.
3. **Draft the data**: for a skill using only `onCast`/`dealDamage` (the triggers/actions implemented so far — see `game/docs/skill-trigger-action-usage-guide.md`), use the new `triggers` shape with `effects: []`. For any mechanic not yet ported to an action (everything except a plain hit), use the old `effects: SkillEffect[]` shape — do not half-migrate a skill. `Skill` object goes in `Skills.ts` (or `ProgressionNode` in `game/src/data/progression/` for a tree branch) with `execution`, `resourceType`/`cost`, `targeting` either way.
4. **Wire prerequisites**: add the `ProgressionNode` (realm/node/nodeCount/skillCastCount prerequisite) if this is a tree unlock, not a base skill.
5. **Add the tooltip** content and confirm the id follows N2/N2b naming.
6. **Test**: add/extend a `SkillSystem`/`SkillEffectSystem`/`AilmentSystem` test exercising the new effect — this project keeps skill mechanics covered by unit tests (see existing `SkillSystem.*.test.ts` files for the pattern).

Do not implement combat-engine changes (new `SkillEffectType`, new execution policy kind) without confirming with the user first — those are cross-cutting and affect all 6 paths.
