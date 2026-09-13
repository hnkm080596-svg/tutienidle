# Chỉ số — Stat & Modifier

**Trạng thái:** Live.

Types: `core/stats/StatTypes.ts`. Pipeline: `core/stats/StatCalculator.ts`. Store: `stores/player.ts` (getter `finalStats`). Trần main stat: `core/stats/StatCap.ts`.

## Ba lớp stat

- **baseStats** — `PlayerData.baseStats: Stats` (StatBlock) — giá trị nền, gồm cả 5 attribute gốc.
- **modifiers** — `player.modifiers` (vĩnh viễn: mạch, luyện thể, đan, realm passive…) + `externalModifiers` (tạm: buff/technique/equipment do GameManager gộp mỗi tick) + node modifiers suy ra từ `nodeLevels`.
- **finalStats** — getter trên store: `calculateStats(baseStats, [...modifiers, ...externalModifiers, ...aggregated])`, có cache theo signature để không recompute thừa mỗi tick.

## Pipeline `calculateStats` — Added → Increased → More

Mỗi stat chạy 3 tầng kiểu Last Epoch:

1. **Added** — cộng hết `flat` (+ `perLevelFlat × (level−1)`).
2. **Increased** — cộng dồn `percent` (+ `perLevelPercent`) rồi nhân một lần: `(base + flat) × (1 + Σpercent)`. Hai modifier +20% cho ×1.40, không phải ×1.44.
3. **More** — nhân riêng từng `multiplier`.

**Tag-hierarchy Increased:** modifier có `tag` (vd `'fire'`) rơi vào pool riêng của `(stat, tag)`, tự cộng dồn rồi nhân như tầng độc lập so với pool chung — "+20% Increased Fire" và "+20% Increased Damage" ra ×1.44.

`stacks`/`maxStacks` cho modifier xếp tầng; `clampStatValue` áp trần từng stat.

## `StatModifier`

```ts
{ id, sourceId, sourceType, stat, tag?, flat?, percent?, multiplier?,
  stacks?, maxStacks?, perLevelFlat?, perLevelPercent? }
```

`sourceType`: `realm | technique | skill | buff | debuff | equipment | talent | reincarnation | pill | formation | talisman | attribute`.

## 5 attribute gốc (MainStatKey)

`strength` (Căn Cốt) | `dexterity` (Thân Pháp) | `intelligence` (Thần Thức) | `attunement` (Linh Căn) | `vitality` (Thể Chất).

`deriveAttributeModifiers()` quy đổi mỗi lần tính — không có pipeline riêng:

| Attribute | Dẫn xuất chính |
|---|---|
| Căn Cốt | +0.6 attack/điểm |
| Thân Pháp | +0.15 speed, +1.0 evasion, +0.05% crit rate/điểm… |
| Thần Thức | +1.5 accuracy, crit damage… |
| Linh Căn | +0.5 power CẢ 6 hành (gồm primordial), tag riêng từng hành |
| Thể Chất | +8 maxHp, +0.1 hpRegen, +1 enduranceThreshold/điểm |

**Trần đầu tư** (`getMainStatCap`): Phàm Nhân 10 / Luyện Khí 30 / Trúc Cơ 100; realm sau fallback nhân đôi neo 100. Riêng `RealmData.attributeCap` là trần **cộng dồn vĩnh viễn từ đan dược** — ý nghĩa khác, đừng lẫn.

## StatType đáng chú ý

Core: `attack, defense, maxHp, maxMp, speed, attackRange, criticalRate, criticalDamage, evasionRate`. LE-style: `accuracyRating, blockChance, blockEffectiveness, enduranceThreshold, endurancePercent, wardMax, wardRegenPerSecond, wardBreakDamagePercent, manaShieldPercent, leechPercent, thornsPercent, hpRegenPerTurn, manaRegenPerSecond, finalDamagePercent, finalDamageReductionPercent, criticalAvoidance, chanceToIgnoreResistance, ailmentResistPercent, ailmentPotencyPercent, skillDamagePercent, elementApplicationPercent, reactionEffectPercent, ailmentDurationPercent, dotResistancePercent, poisonRecoveryPercent`. Hành: `woodPower…waterPower` + `primordialPower` (Hỗn Nguyên = true damage). Meta: `maxMpPercent, manaRegenPercent, realmPassivePercent, affixDeltaPercent, speedMultiplier, artifactGradeMultiplier, cultivationPercent`.

`evasionRate` là **rating mở** (LE), không phải xác suất 0..1 — đấu với `accuracyRating` qua `getHitChance`.

## Nguồn cấp modifier (ai ghi vào)

| Nguồn | Ghi qua |
|---|---|
| Đột phá/Realm passive | `player.modifiers` |
| Tâm pháp equip | `getAggregatedModifiers()` → external |
| Node tree | `aggregateNodeStatModifiers(nodeLevels)` |
| Buff/debuff | `BuffSystem` → external |
| Trang bị | `EquipmentSystem` → `setEquipmentModifiers` |
| Đan permanent | `PillSystem` → `player.modifiers` (`pill-permanent:*`) |
| Talent | `TalentEffects` + hidden passive skill |
| Kiếm Ý (Bạt Kiếm) | `getKiemYDamageMultipliers` → finalStats |

## Liên quan

- [damage-pipeline.md](./damage-pipeline.md) — stat đi vào hit resolve.
- [equipment.md](./equipment.md), [pills.md](./pills.md), [talents.md](./talents.md).
