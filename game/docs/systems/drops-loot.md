# Rớt đồ & phần thưởng chiến đấu (Drop / Loot)

**Trạng thái:** Live.

Core: `core/drop/DropTable.ts`, `resolveDrops.ts`, `DropModifier.ts`, `DropContext.ts`. Data: `data/drop/StageDropTables.ts`, `data/drop/FamilyDropTables.ts`. Orchestrator: `core/game/BattleLootSystem.ts`. Reward: `core/reward/RewardSystem.ts` (`Reward`: `techniqueInsight | cultivation | spiritStone`).

## Ba lớp drop, cộng dồn mỗi kill

1. **Stage table** (`stageDropTableFor(realmId, floor)`) — quyết định item tồn tại ở mốc tiến trình này. Mỗi realm 1 band: `guaranteed` (roll độc lập từng dòng theo `chance`) + `pool` (weighted, rút N lần) + `currency` (`spiritStone`, `techniqueInsight` range). Mortal band guaranteed `tinh_hoa_pham_the` 1–3 @70%.
2. **Family table** (`familyDropTableFor(enemy.family)`) — phần theo "họ quái" (vd `base_quan`/`base_hai`/`base_gioi`/`base_truy` theo slot).
3. **Signature drops** (`enemy.signatureDrops`) — roll riêng theo `chance`, có thể `requiresModifier` (chỉ khi kill mang modifier đó); **không** nhận extra roll, **không** cộng quality bonus — cho item narrative/hidden (great_dao_seed, thien_dia_chi_kieu, yêu đan boss…).

`equipment_any` trong pool rút ngẫu nhiên từ equipment registry.

## Modifier (kill context)

`DropContext` dịch flag kill thành `DropModifier[]`: `tinh_anh` (elite: +1 roll, +1 currency bonus), `boss` (+3 rolls, +2).

- `totalExtraRolls` — pool rút `1 + ΣextraRolls` lần trên bag gộp stage+family.
- `currencyMultiplierFor` — `1 + ΣcurrencyBonus`, **cap ×4** (`MAX_CURRENCY_MULTIPLIER`) — cộng có trần, không nhân chồng (tránh ×12.5 boss+elite).
- `qualityBonusStepsFor` — +0..2 bậc quality lên roll chất của EquipmentSystem (max `MAX_QUALITY_BONUS_STEPS = 2`).

`resolveDrops(table, modifiers, channel, rng)` trả `DropResult { items, spiritStone, techniqueInsight, currencyMultiplier, qualityBonusSteps }`. Channel `active | idle` phân biệt drop trận tay vs auto-farm.

## BattleLootSystem — kill flow

Khi enemy chết trong turn engine:

1. Roll `resolveDrops` → `ResolvedDropItem[]` → đưa vào bag tương ứng (`MaterialBag`, `EquipmentBag`, `PillBag`); overflow báo `createBagOverflowEvent`.
2. Currency: `spiritStone` → Linh Thạch material (đúng realm tier), `techniqueInsight` → tâm pháp đang equip (hết trần/không equip = mất), `skillInsight` suy từ techniqueInsight qua `getSkillInsightReward()` (kế thừa cùng multiplier).
3. Talent hooks: `getHealOnKillMaxHpPercent` (hồi máu khi giết), `getInsightGainMultiplier`, `getSpiritStoneGainMultiplier`.
4. `getRealmRewardMultiplier` scale theo realm.
5. Artifact EXP: `applyArtifactExperience` + `getArtifactExperienceReward`.
6. Signature drop → loot notification với `nameSegments`/`accentColorVar` (tím cho Tinh Hoa Phàm Thể bay về người chơi).
7. `HiddenBeastSystem.onEnemyDefeated` đếm kill Luyện Khí / reset khi giết `huyet_mong` ([enemies-stages.md](./enemies-stages.md)).
8. Boss kill → `player.bossKillCount++` (nuôi tầng Kiếm Ý — [cultivation-paths.md](./cultivation-paths.md)).
9. Quest progress (`kind: 'kill'`) qua QuestSystem ([quests.md](./quests.md)).
10. Battle reward summary `BattleRewardSummary` gom items cho màn hình kết quả.

## Notification

Mỗi item → `NotificationEvent` kind `loot` (icon, nameSegments, amountLabel, accent) → NotificationQueue → toast.

## Liên quan

- [enemies-stages.md](./enemies-stages.md) — ai rớt gì.
- [equipment.md](./equipment.md) — equipment roll quality/rarity.
- [inventory.md](./inventory.md) — bag/stack.
