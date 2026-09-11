# Perfect Clear + Enemy Tag System — Design Spec

- **Ngày:** 2026-09-11 (bản 2 — thay thế thiết kế stage Tinh Anh sau chỉ đạo mới của user)
- **Trạng thái:** CHỜ USER REVIEW bản cuối
- **Việc roadmap:** 9.5 #4 (perfectClearTurnLimit 0/30) + generalize hệ spawn variant thành tag system
- **Bản 1 bị thay thế vì sao:** user chốt "đã có tag thì cần gì stage Tinh Anh — spawn random, stage 10 là boss, thế thôi". Stage Tinh Anh riêng (floor 3/6/9 → 4/8/9), X=3/5/7, first-clear bonus — HỦY toàn bộ.

---

## 0. Quyết định đã chốt (bản cuối)

| # | Quyết định | Nguồn |
|---|---|---|
| D1 | Hoàn Mỹ = **mọi member `players[]` còn `alive` lúc victory** + `totalTurnsElapsed < stage.perfectClearTurnLimit`. Bỏ HP-loss-75% của players[0]. Chết-then-hồi-sinh OK (Kiếm Tu revive, Tử Sinh Ngô). Ghi 1 lần, không overwrite. | user (giữ từ bản 1) |
| D2 | **KHÔNG có stage Tinh Anh.** Cấu trúc 10 tầng giữ nguyên: 1-9 thường, 10 boss. Tinh Anh là **tag gắn random lúc spawn** (eliteChance 0.1 giữ nguyên tên + giá trị, nghĩa mới = xác suất gắn tag). | user 2026-09-11 |
| D3 | **Enemy Tag System**: tag = multiplier + prefix + flag + reward-tier, data-driven registry kiểu Diablo 2. Boss có thể stack tag tinh_anh → "Đại Vương Tinh Anh ...". Mỗi tag áp đúng 1 lần (dedupe), stack nhân liên tiếp. | user 2026-09-11 |
| D4 | X placeholder: stage thường = `2 × totalEnemyCount`, boss = `14` — "không quan trọng, balance sau" (comment PLACEHOLDER 1 chỗ duy nhất trong builder). | user (giữ từ bản 1) |
| D5 | **Builder `defineChapterStages`**: bỏ 30 literal — config chương (id/name/description/cặp loài) + 1 nơi quy định chung. BossEnemyId chỉ set floor 10. | user 2026-09-11 (giữ từ bản 1) |
| D6 | Idle (auto-farm) giữ nguyên full reward roll — KHÔNG chặn material. | user Q3 |
| D7 | Stat base 46 loài giữ nguyên authored. Tag multiplier tham chiếu `applyEliteMultiplier`/`applyBossMultiplier` có sẵn (không copy số — A9). Tier 4+ (sau beta) sẽ dùng factory pattern — ghi note, không làm trong mission này. | user Q2 |

## 1. Hiện trạng (evidence)

- `recordPerfectClearIfEligible` (`GameManagerTurnBattleOps.ts`): HP-loss ≤75% chỉ của `players[0]` + turns < X. 0/30 stage có X → chip Hoàn Mỹ disabled vĩnh viễn.
- `createEliteVariant`/`createBossVariant` (`Enemy.ts`): 2 hàm hardcode — đổi stat (qua `applyEliteMultiplier`/`applyBossMultiplier`), prefix tên ("Tinh Anh "/"Đại Vương "), switch rewards (eliteRewards / bossRewards ?? eliteRewards), set flag isElite/isBoss. Consumer duy nhất ngoài tests: `StageWaveSystem.pickEnemyForSpawn` + auto-farm roll.
- `eliteChance: 0.1` author sẵn trên entry elite-eligible của cả 30 stage; roll tại `pickEnemyForSpawn:163`.
- Floor-10 boss: `isFinalSpawn && floor === 10 && bossEnemyId` → `createBossVariant`. Floor 1-9 cũng khai `bossEnemyId` (metadata giả — guard chặn spawn, nhưng UI hiện badge Boss sai 30/30 node).
- `normalizedStages` map hack ghi đè `totalEnemyCount` sau khai báo (mortal/qi) — builder sẽ thay.
- Quy định chung thật (đo được): mortal/qi total = 9+floor, foundation = 9+floor; waves chia 3 phần dư về cuối (floor 10 raw `[total]`); pool = [common w5, elite-eligible w3 (eliteChance 0.1)]; spawnInterval 3s; bossEnemyId = loài w3.

## 2. Target behavior

### 2.1 Tag system (core mới — Layer 1.5, không đụng Layer 2-4)

```ts
// core/enemy/EnemyTag.ts — generic contract, không biết tag cụ thể
export interface EnemyTag {
  id: string
  namePrefix?: string                        // ghép theo thứ tự tag
  applyStat?: (stats: Stats) => Stats         // THAM CHIẾU applyEliteMultiplier/BossMultiplier — không copy số
  combatFlag?: 'isElite' | 'isBoss'          // set flag CombatEntity
  rewardTier?: 'eliteRewards' | 'bossRewards' // fallback chuỗi boss→elite→base giữ nguyên
}

export function applyEnemyTags(enemy: Enemy, tagIds: readonly string[]): Enemy
```

- Applier: dedupe tagIds (mỗi tag 1 lần) → fold `applyStat` liên tiếp (stack nhân: boss+tinh_anh = ×7 ×2.5 HP), ghép prefix theo thứ tự, set flag. **Rewards** theo tag CUỐI CÙNG có `rewardTier` (theo thứ tự áp), resolve đúng chuỗi fallback legacy: boss = `bossRewards ?? eliteRewards ?? rewards` (3 tầng như `createBossVariant`), tinh_anh = `eliteRewards ?? rewards` (như `createEliteVariant`).
- Tag data đầu tiên (data/enemy/EnemyTags.ts): `tinh_anh` + `boss` — hiện thực đúng 100% hành vi 2 hàm cũ (characterization: output của `applyEnemyTags(template, ['tinh_anh'])` === `createEliteVariant(template)`).
- Tag mới sau này (Hấp Huyết/Cuồng Nộ/Thần Phù...) chỉ thêm 1 entry data.
- `createEliteVariant`/`createBossVariant`: migrate consumer xong thì **xóa** (A12) — tests tham chiếu update.

### 2.2 Spawn integration

```text
pickEnemyForSpawn(stage, isFinalSpawn):
  entry roll như cũ
  entry.eliteChance roll trúng  → applyEnemyTags(template, ['tinh_anh'])
  isFinalSpawn && floor === 10  → applyEnemyTags(template, ['boss'])
```

- `eliteChance` field GIỮ NGUYÊN (tên + giá trị 0.1 + type) — nghĩa mới: xác suất gắn tag tinh_anh.
- Huyết Mông (quái ẩn) giữ nguyên — base enemy khác, không phải tag.
- Consumer isElite/isBoss (ArtifactProgression, bossKillCount, telegraph, loot, HiddenBeast) KHÔNG ĐỔI — flag vẫn được set như cũ.

### 2.3 Builder defineChapterStages (D5)

`Stages.ts` chỉ còn 3 config chương (nội dung thật: id/name/description/cặp loài) + builder sinh 30 stage:

```text
floor 1-9  → thường:  total = 9 + floor
                      waves = chia đều 3 phần, dư PHÂN BỔ DẦN từ phần 2
                      (khớp literal: 10→[3,3,4] · 11→[3,4,4] · 14→[4,5,5] · 17→[5,6,6])
                      pool = [common w5, elite w3 + eliteChance 0.1]
                      perfectClearTurnLimit = 2 × total    // PLACEHOLDER (D4)
floor 10   → boss:    total = 9 + floor
                      waves = [total]  (raw; effectiveWaves override [1] giữ nguyên)
                      bossEnemyId = loài elite — CHỈ floor 10 (dọn metadata giả)
                      perfectClearTurnLimit = 14           // PLACEHOLDER (D4)
mọi stage  → spawnIntervalSeconds = 3, chapter/floor/requiredRealmLevel theo config
```

- `normalizedStages` hack xóa — 3 chương qua cùng 1 builder.
- Noted behavior change: badge Boss UI chỉ còn hiện đúng 3 node floor 10 (hiện sai 30/30).

### 2.4 PC condition (D1) — như bản 1

Predicate mới trong `recordPerfectClearIfEligible`: `players.every(alive) && totalTurnsElapsed < X`. Ghi 1 lần `perfectClearStageIds` + `perfectClearSeconds` (auto-farm cycle/2 giữ nguyên).

### 2.5 UI

- Badge Boss: tự nhiên đúng sau builder (chỉ 3 node có bossEnemyId).
- Ẩn `spawnIntervalSeconds` khỏi StageSelectPanel display (10.4 sweep).
- Chip Hoàn Mỹ: logic sẵn có (`isSelectedStagePerfectClear`) — tự enable khi có X + đạt điều kiện.
- i18n: mọi string display mới qua locale keys (P16). Không có string mới trừ khi ẩn display làm key orphan (verify khi làm).

### 2.6 Save/compat

Dev phase — không migration (E8). Không field save mới: X/spawnTags-ish đều registry data; `perfectClear*` giữ nguyên shape. Player save cũ thiếu X → stage chưa từng Hoàn Mỹ vẫn hợp lệ.

## 3. Kiến trúc — owner & ranh giới

| Trách nhiệm | Owner | Ghi chú |
|---|---|---|
| Tag contract + applier | `core/enemy/EnemyTag.ts` | generic, không content-ID (A8) |
| Tag data (tinh_anh/boss) | `data/enemy/EnemyTags.ts` | registry pattern như TURN_BUFF_REGISTRY |
| Công thức stat multiplier | `EnemyStatInput.applyEliteMultiplier`/`applyBossMultiplier` — GIỮ NGUYÊN 1 owner (A2/A9) — tag tham chiếu, không copy số |
| Quy định stage + builder | `data/stage/ChapterStages.ts` — `defineChapterStages` | 1 nơi cho mọi rule (D5) |
| Roll elite + boss spawn | `StageWaveSystem.pickEnemyForSpawn` | chỉ đổi hàm áp tag |
| Predicate Hoàn Mỹ | `GameManagerTurnBattleOps.recordPerfectClearIfEligible` | query thuần (A3) |
| UI badge | `StageSelectPanel.vue` | presentation (A7) |

Không đổi: normalize (Layer 2), combat pipeline (Layer 4, R1-R5), BattleLootSystem, Idle/auto-farm, QuestSystem, tribulation.

## 4. Verification strategy

- **TDD từng slice:** (a) characterization test: `applyEnemyTags(['tinh_anh'])` === `createEliteVariant` cũ (byte-equal các field stat/flag/rewards/name) — chạy được cả 2 hàm trong cùng test trước khi xóa hàm cũ; (b) stack test: boss+tinh_anh nhân liên tiếp + prefix ghép đúng + dedupe; (c) predicate alive-for-all (RED: party member chết + victory → không ghi); (d) data test: 30 stage có X, waves-sum === total (bất biến sẵn), bossEnemyId chỉ ở 3 floor-10, eliteChance 0.1 nguyên vẹn trên entry elite; (e) builder output parity: sinh stage === literal cũ (id/floor/total/waves/pool) trừ X (mới) + bossEnemyId floor 1-9 (đổi có chủ đích — noted behavior change).
- **P3:** quick mỗi task; full cuối mission. **P14:** browser — vào Động 1 thật, thấy quái thường; stage map badge Boss chỉ node 10; thắng dưới X với toàn đội sống → chip Hoàn Mỹ enable. **P4:** adversarial quick cuối mission.
- Hypothesis QA bắt buộc: roll elite 0.1 qua tag vẫn đúng phân phối (seeded test); auto-farm roll dùng tag path cho reward elite như cũ; once-only PC.

## 5. Out of scope

- Stage Tinh Anh riêng / first-clear bonus / X=3/5/7 (ĐÃ HỦY theo chỉ đạo).
- Tag mới ngoài tinh_anh/boss (mở sau bằng data).
- Enemy stat factory tier 4+ (note D7 — mission riêng khi mở nội dung).
- Balance thật X (đợt balance sau).
- Rebalance eliteRewards/drop (giữ nguyên authored).

## 6. Risks

| Rủi ro | Mitigation |
|---|---|
| Xóa createEliteVariant/BossVariant phá test/æn consumer ngầm | Characterization test trước khi xóa; grep consumer; migrate rồi mới remove (A12) |
| Builder sinh lệch literal cũ ở field nào đó (waves chia, total) | Parity test builder-vs-literal cho mọi field trừ 2 thay đổi đã ghi |
| Đổi bossEnemyId floor 1-9 ảnh hưởng logic khác ngoài UI | Grep toàn bộ consumer `bossEnemyId` (đã rà: EffectiveWaves/EffectiveEnemyCount floor-10 guard, StageWaveSystem floor-10 guard, StageSelect badge, Stages.test) — floor 1-9 chỉ là display sai được sửa |
| Tag stack boss+tinh_anh chưa có trong game thật (chỉ tương lai) | Test unit lock hành vi stack; không cần content ngay |
