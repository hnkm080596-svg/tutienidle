# Design: Gacha đồng đội (Chiêu Mộ) — 2026-09-12

Roadmap việc #8 ("Party recruit/UI/companion content"). Phần mechanism đã ship (2026-09-06, Part B roster plan): `CompanionDefinition`/`CompanionInstance`, `player.companions` (save v57), `companionToCombatEntity`, `CompanionGacha` (roll grade + pick + duplicate→exp), `CompanionLeveling`, gán ô qua `formationLoadout` + `TranPhapPanel`.

Spec này phủ phần còn lại: **nguồn pull (token), pity, điểm đổi, tiến trình cảnh giới đồng đội, UI pull/roster, roster MVP.**

## 1. Quyết định đã chốt (brainstorm)

| Quyết định | Chọn |
|---|---|
| Currency pull | Token riêng — **Chiêu Hiền Lệnh** (`chieu_hien_lenh`) |
| Nguồn token | Boss tầng 10 + quest (daily) |
| Pool | Một pool, **không** gate cảnh giới người chơi |
| Cảnh giới khởi đầu | Mọi đồng đội pull ra bắt đầu **Phàm Nhân tầng 1** |
| Trần cảnh giới | **Bám theo realm người chơi chính** (`player.realmId`), mọi Chất như nhau — không trần riêng theo Chất |
| Chất (ItemGrade) làm gì | Tốc độ trưởng thành (`growthRate`) + mốc mở skill (`unlockThresholds`) |
| Nguồn EXP | Tham chiến (trận) + vật phẩm nuôi |
| Pull trùng | **+1 Cung Mệnh** (`constellationRank`, max 6) — kiểu Constellation (Genshin) |
| Đột phá cảnh giới | **Tự động** khi đủ EXP — không độ kiếp, không phí |
| Pity | Đếm pull → sàn Địa ở pull thứ 30 + điểm **Duyên Phận** đổi tự chọn |
| Đồng đội ra trận | Theo ô Trận Pháp (tối đa 8 ô còn lại) |
| UI pull | Tab **Chiêu Mộ** trong Chiêu Hiền Quán |
| UI roster | Panel standalone **`companion`** mới + entry command wheel |

## 2. Rate table & pity

```ts
// Rate pull (đã chốt):
hoang:  0.8399   // phần còn lại
huyen:  0.10
dia:    0.05
thien:  0.01
tien:   0.0001   // ~1/10.000 — thực tế chỉ qua đổi Duyên Phận
```

**Effective rate:** bảng trên được **lọc theo grade có ≥1 definition trong `COMPANIONS`** rồi renormalize — vì `pickDefinitionOfGrade` throw khi pool của grade rỗng (vd MVP có 0 Tiên → tien bị loại khỏi bảng hiệu dụng, không reroll-silent). Khi roster có Tiên thật, grade tự quay lại bảng.

**Pity counter** `player.companionPullsSinceRare` — thứ tự rõ ràng:

```ts
counter += 1                                  // đếm pull hiện tại
const pityActive = counter >= PITY_THRESHOLD  // 30
const grade = rollCompanionGrade(pityActive ? ELEVATED_RATES : effectiveRates)
if (grade >= 'dia') counter = 0               // reset kể cả trúng tự nhiên
// kết quả < dia && pityActive → không xảy ra vì ELEVATED_RATES sàn dia
```

`ELEVATED_RATES` = chọn trong `{dia, thien, tien}` theo trọng số tương đối `5 : 1 : 0.01` (≈ 83.2 / 16.6 / 0.17% — cố ý hào phóng hơn rate tự nhiên để pity "có cảm giác"), cũng lọc theo grade có definition.

- **Duyên Phận** `player.duyenPhan`: +1 mỗi pull (kể cả trùng). Đổi tự chọn definition, giá theo Chất:

| Chất | Điểm đổi |
|---|---|
| Hoàng | 20 |
| Huyền | 30 |
| Địa | 60 |
| Thiên | 150 |
| Tiên | 300 |

- **Duplicate → Cung Mệnh**: pull trùng → `constellationRank + 1` (max 6). Đã C6 → đổi thành **+5 Duyên Phận** (pull không thể reject — roll đã xong). `DUPLICATE_PULL_EXP` cũ **bỏ** — trùng không còn cho exp.
- **Cung Mệnh tăng gì** (đã chốt): mỗi bậc `+10%` base stats (`CONSTELLATION_STAT_PER_RANK = 0.10` → C6 = +60%), cộng thêm **perk authored tại C2/C4/C6** nếu definition có (`constellationPerks`).

## 3. Token — Chiêu Hiền Lệnh

- Material `chieu_hien_lenh`, `category: 'other'` — **không** cần `profession` meta: `other` không nằm trong `VENDOR_SELLABLE_CATEGORIES` (không bán được ở Ký Bảo Các) và không có consumer craft nào đọc meta của nó. **Một loại duy nhất**, không chia phẩm.
- Nguồn:
  - Drop table boss tầng 10 của 3 chương (`data/stage/`), số lượng theo chương (đề xuất: chương 1 ×1, chương 2 ×2, chương 3 ×3 — tune sau).
  - Quest daily mới trong `data/quest/quests.ts` (vd kill-any ×N → 1 token qua `QuestReward.itemDrops`).
- Giá pull: **1 token = 1 pull**. Không làm 10-pull trong MVP.

## 4. Data model

### `CompanionDefinition` (mở rộng)

```ts
interface CompanionDefinition {
  id: string
  name: string
  grade: ItemGrade              // Chất — giữ nguyên
  growthRate: number            // MỚI — hệ số chỉ số theo tầng/cảnh giới
  unlockThresholds: {           // MỚI — mốc mở skill
    special?: { realmId: RealmId; realmLevel: number }
    ultimate?: { realmId: RealmId; realmLevel: number }
  }
  baseStats: CompanionBaseStats
  basic: TurnSkillDefinition
  special?: TurnSkillDefinition
  ultimate?: TurnSkillDefinition
  constellationPerks?: ConstellationPerk[]  // MỚI — perk authored tại mốc Cung Mệnh
}

/** Perk tại mốc Cung Mệnh — data-driven, không if-id. */
type ConstellationPerk =
  | { atRank: number; kind: 'stat'; stat: keyof CompanionBaseStats; percent?: number; flat?: number } // stat thêm khi đủ bậc (phẩm hẹp trên 3 chỉ số companion — KHÔNG dùng StatModifier của pipeline người chơi)
  | { atRank: number; kind: 'skill_override'; slot: 'basic' | 'special' | 'ultimate'; overrides: CompanionSkillOverride } // nâng skill
  // CompanionSkillOverride = whitelist Partial — chỉ cho phép field an toàn:
  // { cooldownTurns?: number; damageMultiplierPercent?: number; healPercentOfDamage?: number }
  // (KHÔNG Partial<TurnSkillDefinition> thô — cấm ghi đè id/targeting làm hỏng kit)
```

**Không có `realmCeiling` theo Chất** — trần cảnh giới đồng đội = `player.realmId` hiện tại (dynamic cap): đồng đội tự lên tới tận cảnh giới người chơi, người chơi phá cảnh thì đồng đội lên tiếp. Chất chỉ khác nhau ở `growthRate` (lên nhanh/mạnh hơn) và `unlockThresholds` (mở skill sớm/muộn).

### `CompanionInstance` (mở rộng)

```ts
interface CompanionInstance {
  instanceId: string            // MỚI — identity ổn định (crypto.randomUUID); KHÔNG dùng array index làm handle
  definitionId: string
  realmId: RealmId              // MỚI — bắt đầu 'mortal'
  realmLevel: number            // đổi nghĩa: tầng trong realmId hiện tại (1..maxLevel của realm đó)
  exp: number                   // exp tích luỹ trong tầng hiện tại
  constellationRank: number     // MỚI — 0..6 (C0..C6); +1 mỗi duplicate pull/exchange
}
```

**Invariant: đúng 1 instance / definitionId** trong `companions` — duplicate pull/exchange không bao giờ tạo instance thứ 2 cùng definition (đổi thành `Record<definitionId, …>` có thể cân nhắc post-MVP, giữ array cho MVP vì mọi consumer hiện đọc array).

### `PlayerData` (mở rộng)

```ts
companionPullsSinceRare: number   // MỚI — pity counter
duyenPhan: number                 // MỚI — điểm đổi
```

Save bump → `CURRENT_SAVE_VERSION = 60`. **Theo convention dev phase của project: save v59 bị từ chối, KHÔNG viết migration** (xem `saveVersion.ts` — mọi version trước đều "bị từ chối, không migration"). `createDefaultPlayer()` gán default cho field mới; `saveShapeValidation.ts` thêm check `instanceId`/`constellationRank`/`realmId` hợp lệ + counter `isFiniteNumber`/≥0.

## 5. `CompanionProgression` (core mới)

`core/companion/CompanionProgression.ts` — thay/ngoài `CompanionLeveling.ts`:

- `expRequiredForLevel(realmId, realmLevel)` — curve riêng đồng đội: `round(40 × realmLevel^1.2 × (getRealmIndex(realmId) + 1))` — `(index+1)` tránh `realmScale = 0` ở mortal (hệ số nhân 1×/2×/3×… theo bậc realm; hằng số là balance constant trong file).
- `companionStatsAt(definition, instance)` — thay `companionStatsAtLevel`: `base × (1 + growthRate × globalLevel) × (1 + CONSTELLATION_STAT_PER_RANK × constellationRank)` với `globalLevel = getGlobalCultivationLevel(realmId, realmLevel)` — **dùng helper có sẵn** (`realmSystem.ts`), tự đúng với maxLevel không đồng đều (18 vs 9), không tự nhân `index × 18`. Speed vẫn không scale. Growth tuyến tính có thể phình to ở trần cao — balance pass kèm bảng test 2-3 companion mẫu ở §11.
- `applyExp(instance, definition, amount, playerRealmId)` — cộng exp, tự lên tầng; đủ `maxLevel` của realm hiện tại + `realmIndex(companion) < realmIndex(playerRealmId)` → tự phá cảnh (`realmId` lên bậc, `realmLevel=1`, exp thừa carry, có thể chain nhiều tầng/realm trong 1 lần apply). Đạt realm người chơi + max tầng → exp clamp 0 ("level-maxed" = ngang trần người chơi — trần tự nhích lên khi người chơi phá cảnh). **Tách biệt "maxed" của Cung Mệnh**: `constellationRank === 6` mới là max để reject exchange; level-max chỉ dừng exp.
- `applyConstellationRank(instance)` — `rank < 6 → +1` trả instance mới; `rank === 6` → trả `{ maxed: true }` để caller quyết (pull → +5 DP; exchange → reject trước khi trừ điểm).
- `resolveCompanionSkillKit(definition, instance)` — trả kit thi hành: `basic` luôn có; `special`/`ultimate` khi `isSkillUnlocked` đủ mốc; áp `skill_override` perks của các bậc ≤ `constellationRank` lên skill tương ứng; gom `modifier` perks thành list StatModifier cấp khi build combat entity.
- `isSkillUnlocked(definition, instance, slot)` — check `unlockThresholds` vs realm/tầng hiện tại.
- `feedExpItem` — đổi material category `essence`/`other` → EXP: `10 × (professionIndex+1)` nếu material có `profession` meta, fallback flat `10` nếu không (`other` không bắt buộc meta). **Reject sớm `{ ok:false, reason:'level_maxed' }` khi instance đã ngang trần người chơi** — không remove material; UI cũng disable nút Nuôi.

Không độ kiếp, không phí đột phá (đã chốt A).

## 6. Pull flow — `GameManager`

`pullCompanion(player: PlayerData): PullResult` trong `GameManagerCompanionOps.ts` (file ops mới, theo convention `GameManagerQuestOps`):

1. `materialBag.has('chieu_hien_lenh', 1)` → `false` trả `{ ok:false, reason:'missing_token' }`.
2. `materialBag.remove('chieu_hien_lenh', 1)` — trừ trước roll sau (atomic convention giống vendor).
3. Pity check → `rollCompanionGrade(effectiveRates)` → `pickDefinitionOfGrade(grade, COMPANIONS)` — `effectiveRates`/`ELEVATED_RATES` đã lọc grade rỗng (§2) nên không bao giờ throw.
4. Cập nhật `companionPullsSinceRare` theo pseudocode §2; `duyenPhan += 1`.
5. Đã sở hữu (theo `definitionId`, invariant 1-1) → **Cung Mệnh +1** (`applyConstellationRank`); đã C6 → `duyenPhan += 5` bù; chưa sở hữu → `player.companions.push({ instanceId: randomUUID(), realmId:'mortal', realmLevel:1, exp:0, constellationRank:0 })`.
6. Trả `PullResult { ok:true, definition, isDuplicate, constellationRankAfter?, grade, pityTriggered, duyenPhan }` — UI render reveal từ result, KHÔNG tự roll.

`exchangeCompanion(player, definitionId)` — mua bằng Duyên Phận, xử lý giống hệt duplicate path của pull (đã chốt: **chỉ hạn chế khi Cung Mệnh max**):

1. Definition không có trong `COMPANIONS` → reject.
2. Đã sở hữu + `constellationRank === 6` → reject `{ ok:false, reason:'constellation_maxed' }` — không trừ điểm.
3. Check `duyenPhan >= cost(grade)` → thiếu → reject `{ ok:false, reason:'insufficient_duyen_phan' }`.
4. Trừ điểm → chưa sở hữu: push instance mới (`instanceId` mới, `constellationRank:0`); đã sở hữu (chưa C6): `constellationRank + 1` — **không** tạo instance thứ 2 (invariant 1-1 giữ nguyên).

`feedCompanion(instanceId, materialId, count)` — nuôi EXP từ material bag: lookup instance theo `instanceId` (không index), gate `level_maxed` → reject trước khi remove, atomic remove + `applyCompanionExp`; trả `{ ok, expGained, levelsGained, realmBreakthroughs, clampedExp }` cho UI feedback.

## 7. EXP tham chiến

Hook `BattleLootSystem.processDefeatedEnemies` (cùng nơi cấp artifact EXP): mỗi companion có ô trong `formationLoadout` **tại thời điểm xử lý kill** (snapshot formation hiện tại — đổi đội hình giữa trận ảnh hưởng kill kế tiếp, không retroactive) nhận `2 × (getRealmIndex(stage.requiredRealmId) + 1)` EXP/kill; gọi `applyExp`. Dự bị không tự lên.

## 8. UI

### Chiêu Hiền Quán (`WorkerLodgePanel.vue`) — thêm tab

- Tab **Chiêu Mộ**: nút Pull (label kèm `x1 Chiêu Hiền Lệnh`, hiện số đang có), pity `x/30`, Duyên Phận hiện có; reveal card tối giản (tên + màu Chất + "Trùng → Cung Mệnh +1 (C{n})"/"+5 Duyên Phận"). Không cinematic.
- Tab **Đổi Duyên Phận**: danh sách definition đổi được + giá theo Chất.
- Tab nhân công hiện tại giữ nguyên.

### Panel `companion` mới (standalone)

- `panelIds.ts`: `StandalonePanel += 'companion'`; `data/ui/commandWheelCatalog.ts`: entry mới (vd `id:'companion_roster'`, `target:{kind:'standalone', panel:'companion'}`), gate realm: `mortal` (đồng đội không gate).
- `CompanionPanel.vue`: grid card theo Chất → detail (tên, Chất, cảnh giới/tầng, EXP bar, **6 ô Cung Mệnh** — sáng theo `constellationRank`, tooltip perk đã mở/khoá ở C2/C4/C6, skill đã mở/khoá kèm mốc, stats hiện tại) + nút **Nuôi** (chọn material → EXP, disable khi level-maxed) + hint gán ô qua Trận Pháp.
- i18n: key mới dưới `companion.*` trong `locales/{vi,en}.json`.

## 9. Combat integration

- `companionToCombatEntity` đổi sang `companionStatsAt(definition, instance)` (đã gồm Cung Mệnh stat bonus); `modifier` perks của Cung Mệnh cộng vào stats entity lúc build.
- `buildTurnBattle` (GameManagerTurnBattleOps:819): hiện chỉ truyền `definition.basic` vào `toTurnBattleParticipant` — mở rộng: participant nhận `resolveCompanionSkillKit(definition, instance)` — basic luôn có, `special`/`ultimate` khi `isSkillUnlocked`, `skill_override` perks đã áp. Companion KHÔNG có loadout/node — kit = definition ∩ đã mở ∩ perk đã đủ bậc.
- Art: MVP dùng placeholder animation set hiện có (fallback theo id đã implement); `combatTextureKey` riêng là content pass sau.

## 10. Roster MVP

10 companion: **4 Hoàng / 3 Huyền / 2 Địa / 1 Thiên / 0 Tiên** (Tiên thêm khi có art+content; rate 0.01% vẫn giữ trong bảng để pool sẵn sàng — effective-rates tự loại khi chưa có definition). Chủ đề tu tiên (đạo sĩ, kiếm khách, thú cưng linh…), `basic`/`special`/`ultimate` dùng `TurnSkillDefinition` tái dùng mechanism sẵn (damage/buff/ailment — không `if id` đặc biệt, A8). MVP: `constellationPerks` chỉ cần ở Địa/Thiên (C2/C4/C6); Hoàng/Huyền có thể chỉ nhận stat bonus thuần — perk content là pass sau.

`TEST_COMPANIONS` xoá khi roster thật ship; nút cấp test trong `TranPhapPanel.vue` xoá cùng.

## 11. Testing

- Unit: `rollCompanionGrade` phân phối đúng bảng mới; effective-rates lọc grade rỗng (0 Tiên → pull không throw, không rớt slot); pity order — counter=29 rồi trúng dia tự nhiên → reset 0, pull 30 roll bình thường (không kích pity); pity kích đúng ở pull thứ 30 liên tiếp <dia; duplicate→`constellationRank+1`, C6→+5 DP; `exchangeCompanion` reject `constellation_maxed`/`insufficient_duyen_phan`, owned-chưa-C6 → rank+1 (không tạo instance 2); `applyExp` lên tầng/phá cảnh chain/clamp trần người chơi; `feedExpItem` reject `level_maxed` trước khi remove; `companionStatsAt` growth qua `getGlobalCultivationLevel` (đúng cả realm 9 tầng) × constellation bonus; `isSkillUnlocked`; `resolveCompanionSkillKit` áp đúng `skill_override`/`modifier` theo rank.
- Save: v60 — `createDefaultPlayer` gán field mới đúng default; validator check `instanceId`/`constellationRank`/counter (reject NaN/âm); save v59 bị reject `incompatible` (không migration — convention dev phase).
- Integration: `pullCompanion` atomic (thiếu token không trừ, roll luôn có kết quả); quest daily trả token; boss drop token vào bag; companion gán ô → vào trận → nhận EXP; đổi formation giữa trận → EXP kill kế theo formation mới.
- QA quick (P4) sau implement; P14 nếu đụng reveal UI.

## 12. Out of scope (YAGNI)

Banner luân phiên, 10-pull, pull cinematic, equipment cho companion, companion Thể Tu route, companion breakthough có gameplay, token chia phẩm, trade/giữa người chơi.

## 13. Files touched (dự kiến)

- Mới: `core/companion/CompanionProgression.ts`, `core/game/GameManagerCompanionOps.ts`, `components/panels/CompanionPanel.vue`, `data/materials/materials.ts` entry token, tests tương ứng.
- Sửa: `data/companion/Companions.ts` (schema + roster), `core/companion/CompanionGacha.ts` (pity-aware rates — mechanism giữ, rate table là data), `core/player/Player.ts` (2 field), `services/save/saveVersion.ts` (v60, KHÔNG migration — dev-phase convention) + `saveShapeValidation.ts`, `GameManagerTurnBattleOps.ts` (kit unlock), `BattleLootSystem.ts` (companion EXP), `WorkerLodgePanel.vue` (tabs), `panelIds.ts`, `commandWheelCatalog.ts`, `locales/*`, signatureDrops boss + quest daily, `TranPhapPanel.vue` (gỡ nút test).
