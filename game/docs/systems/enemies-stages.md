# Quái & Màn (Enemy / Stage / Zone)

**Trạng thái:** Live — nội dung dừng ở Trúc Cơ tầng 18 (3 chương × 10 tầng).

Types: `core/enemy/Enemy.ts`, `core/stage/Stage.ts`, `core/stage/Zone.ts`. Data: `data/enemy/Enemies.ts`, `data/stage/Stages.ts`, `data/stage/Zones.ts`. Manager: `core/enemy/EnemySystem.ts`/`EnemyManager.ts`, `core/stage/StageManager.ts`, `ZoneRegistry.ts`. UI chọn màn: `StageSelectPanel.vue` (`leftPanelMode = 'stage_select'`).

## Zone / Stage

1 zone duy nhất **`thanh_van`** (Thanh Vân), `requiredRealmId: 'mortal'`, chứa 30 stage theo thứ tự: `mortal_dong_1..10` → `qi_refining_forest … qi_refining_abyssal_pool` (10 stage đặt tên) → `foundation_floor_1..10`.

`Stage` fields chính: `id`, `name`, `requiredRealmId`/`requiredRealmLevel` (level chỉ để hiển thị "Tầng N"), `chapter`/`floor`, `enemyPool: StageEnemyEntry[]` (`enemyId`, `weight`, `eliteChance`), `totalEnemyCount`, `waves` (quái spawn đồng thời mỗi wave — `sum(waves) = totalEnemyCount`, invariant test), `spawnIntervalSeconds` (nhịp spawn song song, không đợi quái chết), `bossEnemyId` (lượt spawn cuối luôn là boss).

**Unlock** (`GameManager.isStageUnlocked`): stage đầu zone mở sẵn; stage kế mở khi stage trước trong `zone.stageIds` có trong `player.completedStageIds`. `perfectClearStageIds`/`perfectClearSeconds` lưu clear hoàn mỹ (không mất HP?) cho chế độ `perfect_farm` và auto-farm.

## Enemy

`Enemy`: `id`, `name`, `level`, `realmId` (cho Realm Pressure), `stats` + `currentHp/maxHp`, `rewards: EnemyReward` (`techniqueInsight`, `skillInsight?`, `spiritStone` — **không** còn cultivation từ kill), `family` (họ quái → family drop table), `signatureDrops` (drop danh định riêng), `lane`, `archetype`.

Biến thể:

- **Elite** — `createEliteVariant`, spawn ngẫu nhiên theo `eliteChance` trong pool; `applyEliteMultiplier` buff stat vừa; drop đậm qua modifier `tinh_anh`.
- **Boss** — `createBossVariant`, `applyBossMultiplier` buff lớn; đặt cố định qua `bossEnemyId`, luôn spawn cuối.
- **Quái ẩn** — `HiddenBeastSystem` (`core/game/HiddenBeastSystem.ts`): đếm kill quái Luyện Khí từ lần giết quái ẩn gần nhất; đủ `HIDDEN_BEAST_KILL_THRESHOLD = 1000` mở window → mỗi spawn stage Luyện Khí roll 5% (`HIDDEN_BEAST_SPAWN_CHANCE_PER_SPAWN`) trà `huyet_mong` (Huyết Mông) thay quái pool; giết xong reset đếm. Không spoil vị trí.

## Boss mechanics

- `specialAttacks` — mỗi `everyNth` attack thay basic bằng impact `damageMultiplier` + `presetId` + `windupSeconds` riêng.
- `tribulationPhases` — đổi phase theo ngưỡng HP (boss mẫu `foundation_ferocious_flood_dragon_whelp` 2 phase @0.5/0.25 HP).
- `enrage` (legacy `BossEnrage`) + `bossTrigger` (turn engine: `{ afterTurns, buffDefinitionId }` → `TurnBossTrigger` qua `toTurnBattleParticipant`).
- `breakGaugeMax` — thanh Break (Thể Tu, boss/quái lớn).

## Nội dung theo chương

- **Chương 1 (mortal_dong_1–10)**: quái Phàm Nhân (`mortal_*` — Dã Trư, Sơn Khấu…), rớt Tinh Hoa Phàm Thể nuôi Luyện Thể.
- **Chương 2 (qi_refining_*)**: 10 stage Luyện Khí theo môi trường (rừng, hỏa diệm, sa mạc, đầm lầy…), quái cặp thường/`ferocious_` (Hung), boss tầng 10 rớt Yêu Đan cho Thông Mạch Đan.
- **Chương 3 (foundation_floor_1–10)**: 20 quái `foundation_*` riêng; quy luật Ngũ Hành Tương Sinh theo cặp tầng Mộc(1-2)→Hỏa(3-4)→Thổ(5-6)→Kim(7-8)→Thủy(9-10); tầng chẵn bản "Hung" mạnh hơn cùng loài; boss `foundation_ferocious_flood_dragon_whelp` (Hung Giao Sủng) tầng 10 — 2 phase + enrage 60s.

## Auto farm

`player.autoFarmStage = { stageId, lastCheckedMs }` — stage đã Hoàn Mỹ có thể farm tự động; `startAutoFarm`/`stopAutoFarm` qua GameManager; offline settle qua `settleAutoFarmOffline` ([game-loop.md](./game-loop.md)).

## Liên quan

- [combat-overview.md](./combat-overview.md) — wave/spawn trong trận.
- [drops-loot.md](./drops-loot.md) — stage/family/signature drop.
- [realms.md](./realms.md) — realm pressure theo realmId.
