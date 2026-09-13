# Buff / Debuff / Ailment

**Trạng thái:** Live — `BuffSystem` là canonical buff authority (R4).

Core: `core/buff/BuffSystem.ts`, `BuffPool.ts`, `BuffTypes.ts`, `BuffRegistry.ts`. Data: `data/buff/buffs.ts` (persistent + ailment), `data/buff/TurnBuffs.ts` + `TurnBuffRegistry.ts` (turn-native). Turn adapter: `core/battle/turn/TurnBuffSystem.ts`, `TurnBuffPool.ts`.

## Model

`BuffDefinition`: `id`, `name`, `polarity` (`buff|debuff`), `duration` (giây — `Infinity` = vĩnh viễn trong trận), `stackMode` (`stack` | `refresh` | `replace`), `maxStacks`, `effects: BuffEffectTemplate[]`.

Effect template:

| type | Làm gì |
|---|---|
| `statModifier` | +flat/percent lên 1 `StatType` của target |
| `dot` | damage mỗi tick (`dpsRatio`, `element`), kèm cơ chế Độc Căn (`poisonRootPercentPerStack`, `poisonRootMaxStacks`, `poisonRootThresholdBonusPercent`) và `armorIgnorePercentByRealm` |
| `cc` | hard CC: `stun` | `freeze` | `root` |
| `onHitProc` | khi chủ buff đánh trúng → chance áp buff khác |
| `reactiveTrigger` | trigger `onCastBegin`/`onImpactLanded` → chance áp definition / queue follow-up |
| `gaugeDelta` | ± % ATB gauge |

`BuffSystem.apply(definition, source, target, registry)` — resolve `dot` damage ngay lúc apply (snapshot stats nguồn), tôn trọng `stackMode`/`maxStacks` (`resolveMaxStacks` cộng `maxStacksBonusByBuffId` từ node). Pool per-entity: `CombatEntity` giữ `BuffPool`; `updateTime()` tick duration; buff `Infinity`/persistent sống ngoài trận trên `player.persistentTimedEffects` (vd **Kiếp Thương** sau độ kiếp thua, 60s).

## Ailment

Ailment = debuff/DoT trong cùng BuffSystem — không còn AilmentSystem riêng. Các ailment hiện có trong `data/buff/buffs.ts`:

| id | Tên | Element | Duration | Ghi chú |
|---|---|---|---|---|
| `bong` | Bỏng | fire | 4s | DoT |
| `trung_doc` | Trúng Độc | wood | 5s | DoT + Độc Căn stack |
| `chay_mau` | Chảy Máu | metal | 5s | DoT |
| `te_cong` | Tê Cóng | water | 4s | DoT/CC |
| `hoai_tu` | Hoại Tử | earth | 8s | DoT |
| `thach_hoa` | Thạch Hóa | — | — | CC |
| `kiep_thuong` | Kiếp Thương | — | 60s | persistent sau độ kiếp thua |

Resist: `ailmentResistPercent` giảm tỉ lệ bị áp — **cap 75%** (`AILMENT_RESIST_CAP`); `ailmentDurationPercent` kéo dài duration; `ailmentPotencyPercent` tăng sức mạnh. Áp ailment qua skill: `ailmentChance` roll độc lập sau khi đòn trúng, rồi `TurnReactionManager` check phản ứng (xem [elements-reactions.md](./elements-reactions.md)).

## Turn-native buffs

`TurnBuffs.ts`/`TurnBuffRegistry.ts` — definition viết cho turn engine (DoT theo lượt, counter buff, mark…), registry `TURN_BUFF_REGISTRY` inject vào battle lúc build.

## Độc Căn (poison root)

`trung_doc` + `POISON_ROOT_THRESHOLD_STACKS = 3` — stack độc tới ngưỡng kích bonus root/cc theo `poisonRoot*` trên template; node Pháp Tu `maxStacksBonusByBuffId` nới trần stack.

## Nguồn áp

Skill (`appliesBuff`/`appliesAilment(s)`, effect `buff`/`debuff`), artifact, đan dược ([pills.md](./pills.md)), realm/tribulation outcome (Kiếp Thương), talent passive, counter buff, boss phase.

## Liên quan

- [damage-pipeline.md](./damage-pipeline.md) — DoT resolve (`applyDotDamage`).
- [elements-reactions.md](./elements-reactions.md) — 2 ailment khác hành phản ứng.
- [skills.md](./skills.md) — `ailmentChance`, `consumesAilmentId`.
