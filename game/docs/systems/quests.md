# Nhiệm vụ (Quest)

**Trạng thái:** Live.

Core: `core/quest/{Quest,QuestRegistry,QuestManager,QuestProgress,QuestSystem}.ts`. Data: `data/quest/quests.ts`. UI: `QuestPanel.vue` (standalone `quest`). Ops: `GameManagerQuestOps.ts`.

## Phân tách trách nhiệm

- `Quest` (type): `id`, `name`, `description`, `condition`, `reward`, `cadence`, `requiredRealmId?` — data tĩnh.
- `QuestRegistry`: catalog quest theo id.
- `QuestManager`: **chỉ CRUD state runtime** (`active: QuestProgress[]`, `completedOnceIds: string[]`, `lastDailyResetAtMs`) — không chứa rule. State là slice riêng trong `GameSave`, không nằm trong `PlayerData`.
- `QuestSystem`: stateless (giống `BuildingSystem`) — mọi logic activate/claim/reset nhận registry + manager qua tham số.

## Điều kiện

```ts
CollectQuestCondition  { kind:'collect', materialId, amount }   // amount trừ khỏi MaterialBag khi claim (turn-in)
KillQuestCondition     { kind:'kill', enemyId?, zoneId?, amount } // trống enemyId = mọi quái; trống zoneId = mọi khu
```

Progress chỉ đếm từ lúc quest **được activate** — không retroactive.

## Cadence

- `once`: hoàn thành xong đánh `completedOnceIds`, không bao giờ quay lại.
- `daily`: `checkAndResetDaily` so sánh day-bucket UTC (`floor(ms / 86400000)`) với `lastDailyResetAtMs` — qua ngày mới thì xoá progress daily chưa claim và reset mốc. Không random board: mọi quest daily đang unlock đều active.

## Lifecycle

- **`reconcileActiveQuests`** — command idempotent, trigger ở boot/restore, daily rollover, realm-unlock transition. Activate mọi quest đủ điều kiện (`requiredRealmId` gate theo `getRealmIndex`) chưa hoàn thành.
- **`getActiveQuests`** — read-only projection, **không** side effect (A7 query purity): chỉ trả quest đã có progress.
- **`onEnemyDefeated`** — gọi từ `BattleLootSystem.processDefeatedEnemies` mỗi kill thật sự cấp thưởng (Kiếp không tính); tăng progress kill-quest đang active/chưa claim khớp enemyId/zoneId.
- **`onMaterialCollected`** — hook mọi đường material vào túi (kể cả item reward của quest khác) cập nhật collect-quest.

## Claim (turn-in)

`claim` → `resolveClaimable` kiểm: quest tồn tại, progress đủ, chưa claim, và với collect-quest thì `materialBag.has(materialId, amount)` — rồi:

1. Collect-quest: `materialBag.remove(materialId, amount)`.
2. `reward.reward` qua `RewardSystem.give` (spiritStone/cultivation/techniqueInsight — [rewards.md](./rewards.md)).
3. `reward.itemDrops` (`{ kind:'material'|'pill', itemId, amount? }`): add vào bag tương ứng; **tràn túi → push `bag.overflow` warning** vào notification sink (không mất lặng), material drop vẫn đếm progress collect-quest khác.
4. `markClaimed`; cadence `once` thêm `markCompletedOnce`.

`canClaim` dùng chung `resolveClaimable` — preview và commit cùng một rule (A9).

## Content hiện có

`data/quest/quests.ts` — ~15 quest: collect (tu_linh_thao, hoi_xuan_thao, ore), kill (wild_wolf, bandit, stone_fungus, flood_dragon_whelp, boss `foundation_ferocious_flood_dragon_whelp`, "mọi quái Trúc Cơ ×50"), mix once + daily, gate theo realm. `quests.test.ts` validate enemyId trong kill-quest tồn tại trong registry.

## Liên quan

- [drops-loot.md](./drops-loot.md) — nguồn event kill.
- [inventory.md](./inventory.md) — MaterialBag turn-in.
- [save-load.md](./save-load.md) — quest slice trong GameSave.
