# Kỹ năng (Skill)

**Trạng thái:** Live.

Core: `core/skill/Skill.ts`, `SkillSystem.ts`, `SkillManager.ts`, `SkillEffectSystem.ts`, `SkillActionRegistry.ts`, `PassiveSystem.ts`, `SkillRuntimeStats.ts`, `SkillLoadoutSlots.ts`. Data: `data/skill/Skills.ts`, `TurnBasicAttacks.ts`, `TurnReactionPathSkills.ts`, `TalentPassives.ts`. Trigger/action guide: `docs/skill-trigger-action-usage-guide.md`.

## Model `Skill`

Field chính: `id`, `name`, `type` (`active` | `passive`), `level`/`maxLevel`, `experience`/`totalExperience` (cast count), `requiredRealmId/Level`, `cooldown`/`remainingCooldown`, `target` (`self|enemy|all_enemies|ally|all_allies`), `resourceType`+`resourceCost`, `execution` (policy), `effects: SkillEffect[]`, `trigger`/`triggerBindings`, `equipped`, `loadoutSlot(s)`.

## Execution policy (`SkillExecutionPolicy`)

Timing DUY NHẤT của auto-cast — runtime chỉ đọc field này:

| kind | Nhịp |
|---|---|
| `attack_speed` | cadence theo Attack Speed × multiplier; không ICD/CDR/cast time; timer theo từng slot |
| `cooldown` | resolve tức thời, timer = `cooldown`, chịu CDR |
| `cast_time` | niệm trước khi thi triển; cooldown commit lúc bắt đầu niệm, chịu CDR |
| `attack_speed_cast` | niệm + nhịp tái dùng theo attack speed; không CDR |
| `channel` | tụ lực liên tục (Bạt Kiếm); mỗi `tickSeconds` gây 1 phát; không CD/cast time |

## Skill Loadout

`MAX_SKILL_LOADOUT_SLOTS = 5` (`SkillLoadoutSlots.ts`) — `loadoutSlot`/`loadoutSlots` gán skill vào ô 0–4. `SkillManager.getLoadoutSkills()` trả danh sách theo thứ tự slot cho scheduler. Kiếm Tu được gán sẵn 3 skill cố định slot 0/1/2 lúc chọn path ([cultivation-paths.md](./cultivation-paths.md)). Trong turn engine, loadout map thành 3 slot `basic/special/ultimate` của `TurnBattleParticipant`.

## Effect (`SkillEffect`)

`type`: `damage | heal | buff | debuff | add_stack | remove_buff` (+ `ailment` qua `ailmentChance`).

- `damage`: `value` (multiplier), `damageType: physical|primordial` hoặc `components: SkillDamageComponent[]` (pha trộn vd 20% physical + 80% fire), `swordIntentDamageRatio` cho kiếm trận.
- `buff`/`debuff`: `buffId` + `duration` + `stacks`; `ailmentChance` = roll riêng sau khi hit trúng.
- `add_stack`/`remove_buff`: thao tác buff đang chạy (`refresh`, `polarity`, `count` — Pháp Tu Thuần Hệ).
- `healPercentOfDamage`, `consumesAilmentId`+`damagePerStack` (detonate), `consumesWardForDamage` — cơ chế detonate/khiên-nổ.

**Scaling theo level:** active skill +`ACTIVE_SKILL_DAMAGE_PERCENT_PER_LEVEL = 0.05` (5%) damage mỗi level; passive dùng `perLevelFlat`/`perLevelPercent` trên StatModifier.

## Cast count & Huy Kiếm

- `skillCastCounts`/`skillLevels` trên PlayerData — nguồn sự thật save.
- **Huy Kiếm** (tram): `getHuyKiemFlatDamageBonus` — mỗi 10 cast +1 flat damage, không trần. `getHuyKiemLevelForCasts`: Lv2 @1.000, Lv3 @10.000 cast (`HUY_KIEM_L3_CASTS`) — gate route Bạt Kiếm.
- Skill khác lên level bằng Cảm ngộ Kỹ năng (`getSkillUpgradeInsightCost`).

## Passive & trigger

`PassiveSystem` + `PassiveTrigger` (SkillEventType | `per_second`) — passive equipped chạy modifier hoặc trigger→action. `SkillActionRegistry` + `TriggerBinding` bind event→hành vi (xem guide doc). Talent combat cấp hidden passive `talent_passive_*` ([talents.md](./talents.md)). Realm passive là StatModifier, không phải skill.

## SkillRuntimeStats

Field số trên instance skill, node tree cộng qua `skillModifiers`/`aggregateNodeSkillModifiers` — gồm resource path Pháp Tu (`hoaTheGainPerCast`, `thuyThePercent`, `thoTheGainPerCast`, `kimTheGainPerProc`, `huyetPhaGainPerProc`…), hình học (`earthAoeRadius`, `earthKnockbackDistance`), `maxStacksBonusByBuffId`, `theGainPerLinkBonus`/`theMaxBonus` (Thế chain).

## Reaction path (composite)

`compositePicks: { poolType: 'reaction_path', count: 2 }` — Pháp Tu major path chọn 2 skill từ pool `REACTION_PATH_POOL` (`TurnReactionPathSkills.ts`) mỗi lượt; mỗi pick scale riêng (`suddenDeathMultiplier`).

## Liên quan

- [combat-overview.md](./combat-overview.md) — slot→participant, auto-priority.
- [buffs.md](./buffs.md) — ailment/stack skill áp.
- [node-tree.md](./node-tree.md) — unlock + skillModifiers.
- `docs/skill-trigger-action-usage-guide.md` — trigger/action pattern.
