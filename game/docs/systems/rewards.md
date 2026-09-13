# Phần thưởng (Reward primitives)

**Trạng thái:** Live.

`core/reward/` — tầng mechanism dùng chung, không phải "hệ thống" có state riêng.

## `Reward` + `RewardSystem`

```ts
interface Reward { techniqueInsight?; cultivation?; spiritStone? }
interface RewardReceiver { addTechniqueInsight; addCultivation; addSpiritStone }
```

`RewardSystem.give(receiver, reward)` — điểm phát duy nhất cho 3 kênh reward scalar. Consumer: stage bounty, quest claim, alchemy/misc. `GameManager.buildPlayerRewardReceiver(player)` dựng receiver quấn quanh `PlayerData`; `BattleLootSystem.setSession(receiver, player)` gắn receiver vào loot pipeline.

## Scale theo cảnh giới — `RealmRewardScale`

`getRealmRewardMultiplier(realmId)`: mortal/Luyện Khí ×1 (baseline); từ Trúc Cơ ×3 mỗi bậc (`3^(index−1)`). Bù việc enemyPool Trúc Cơ tái dùng quái Luyện Khí — enemy.realmId được `StageWaveSystem` override theo `stage.requiredRealmId` lúc spawn, nên đọc realm từ enemy là đọc đúng stage.

## Roll ngẫu nhiên — `DropRoll`

Primitive thuần dùng chung mọi nơi cần random (A9 — một nguồn):

- `randomInt(min, max)` — int uniform trong khoảng đóng.
- `rollChance(chance)` — boolean theo xác suất.
- `weightedRandom(entries)` — 1 giá trị theo trọng số (equipment quality, material age, gacha...).

## Tổng kết trận — `BattleRewardSummary`

Accumulator sống trong `GameManager`, reset mỗi `startBattle`, phục vụ `CombatVictoryPanel`/`CombatDefeatPanel` hiển thị "trận này kiếm được gì":

- Scalar tích luỹ: `techniqueInsight`, `skillInsight`, `spiritStone`, `artifactInsight` (EXP pháp bảo — [artifact.md](./artifact.md)).
- `items: BattleRewardItem[]` — `{ itemId, kind: 'material'|'pill'|'equipment'|'technique', name, amount }`. Đoán Bảo Thạch đi qua `items` (kind material), không có field riêng.

## `SkillInsightBalance`

`getSkillInsightReward(enemy.reward)` — quy đổi phần skill insight từ reward template quái; tách riêng để tune balance không đụng loot pipeline.

## Liên quan

- [drops-loot.md](./drops-loot.md) — pipeline phát reward khi quái chết.
- [quests.md](./quests.md) — claim dùng `RewardSystem.give`.
- [inventory.md](./inventory.md) — item drop vào bag, overflow receipt.
