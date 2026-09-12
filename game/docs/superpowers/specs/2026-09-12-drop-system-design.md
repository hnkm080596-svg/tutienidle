# Hệ thống Drop — Design Spec

- **Ngày:** 2026-09-12 — **BẢN 2** (sau đối chiếu với spec PC bản 3; thay đổi đánh dấu [SỬA]/[MỚI])
- **Trạng thái:** CHỜ USER REVIEW bản 2
- **Nguồn:** nợ D8 của spec `2026-09-11-perfect-clear-elite-stages-design.md` — *"hệ thống drop hoàn thiện"*
- **Phụ thuộc:** không chặn. `core/enemy/EnemyTag.ts` (spec PC §2.1) **chưa tồn tại trên bất kỳ nhánh nào** — §3.2 giải thích vì sao hệ drop vẫn ship được trước.

---

## 0. Quyết định đã chốt

| # | Quyết định | Nguồn |
|---|---|---|
| E1 | **Thiết kế lại toàn bộ loot table.** Bỏ bảng chép tay per-enemy, chuyển sang bảng dùng chung; quái chỉ tham chiếu. | user |
| E2 | **Trục hai tầng:** bảng theo *stage* (cảnh giới + dải tầng) quyết định **món nào có mặt**; bảng theo *họ quái* quyết định **loại đặc trưng**. | user |
| E3 | Tag tác động drop qua **ba đường**: thêm lượt bốc, nhân tiền, nâng chất trang bị. **Không** mở bảng riêng theo tag. | user |
| E4 | **Tiền = cộng đóng góp, KHÔNG nhân dồn**, trần `MAX_CURRENCY_MULTIPLIER = 4`. Đây là một đợt **nerf có chủ đích** — xem §1.3, §2.3, §6. | user (bác ×12.5) |
| E5 | **Chất trang bị vẫn do `EquipmentSystem.rollItemQuality()` roll ngẫu nhiên.** Hệ drop KHÔNG giành quyền đó, chỉ truyền vào một số nấc cộng thêm. | user (bác `baseGrade` theo stage) |
| E6 | Nâng chất **chỉ áp cho trang bị**. Lượt bốc không ra trang bị → phần nâng **mất luôn**; không dời lượt, không đổi sang thứ khác, không bốc lại. | user |
| E7 | Giữ **lớp drop đặt tay per-enemy** (`signatureDrops`) cho những thứ có chủ đích (`great_dao_seed`, `van_kiem_quyet`). Bảng chung không được nuốt chúng. | Claude, user chưa bác |
| E8 | Hệ drop có **từ vựng modifier riêng**; `boss` là một modifier hợp lệ dù **không phải** EnemyTag — giữ nguyên D4 của spec PC (`createBossVariant` không đổi). | Claude |
| E9 | [MỚI] **Số nấc nâng chất suy ra từ SỐ LƯỢNG modifier**, không phải cộng field của từng modifier: `clamp(len(modifiers) − 1, 0, 2)`. Tái tạo đúng luật "chỉ khi boss + tinh anh" của E5/E6, đồng thời generalize cho tag tương lai với trần +2. | user (L2), Claude sửa cách hiện thực |
| E10 | [MỚI] **Idle bỏ TAG modifier, GIỮ modifier thuộc tính stage.** Idle floor 10 chạy với `['boss']`. Khớp D4 spec PC (boss unconditional cho cả idle lẫn active). | user (C3) |
| E11 | [MỚI] **Idle nhận `signatureDrops` chắc chắn (`chance === 1`), bỏ qua các dòng có `chance < 1`.** | user (L3) |
| E12 | [MỚI] Hệ số tiền áp lên **cả ba** hồ: `spiritStone`, `techniqueInsight`, `skillInsight` — xem §1.6. | Claude (L5) |

### Từ vựng

| Trong prose | Trong code | Là gì |
|---|---|---|
| **chất** | `ItemQuality` | 5 nấc `hoang / huyen / dia / thien / tien`, roll ngẫu nhiên, **chỉ trang bị có** |
| **phẩm nghề** | `ProfessionGrade` | 10 bậc, lấy từ cảnh giới *người chơi*, hệ drop không đụng |
| — | `ItemGrade` | thang 1-3-5-7-9 của Đan/Phù/Trận, hệ drop không đụng |

[MỚI, L9] **Định danh trong code luôn là `ItemQuality`/`quality`; chữ "chất" chỉ xuất hiện trong văn xuôi và chuỗi hiển thị.** Ba trục này được `core/profession/slotRank.ts` ghi rõ là tách biệt có chủ đích. Spec này chỉ đụng **chất**, và chỉ đúng một chỗ (E5).

[MỚI, L7] **Dùng thống nhất chữ "tag"** (khớp `EnemyTag` và spec PC). Chữ "nhãn" không xuất hiện trong spec này nữa.

---

## 1. Hiện trạng (evidence)

### 1.1 Drop đi qua BỐN đường rời nhau

| # | Nơi | Phân biệt elite/boss bằng |
|---|---|---|
| 1 | `BattleLootSystem.grantItemDrops` — duyệt `itemDrops[]`, mỗi dòng tung `chance` **độc lập** | **thay bảng**: `bossRewards ?? eliteRewards ?? rewards` (`Enemy.ts:272,300`) |
| 2 | `grantRandomEquipmentDrop` | `isBoss ? BOSS_EQUIPMENT_DROP_CHANCE : NORMAL_EQUIPMENT_DROP_CHANCE` |
| 3 | `grantArtifactStoneDrop` | `if (realmIndex < foundation_establishment) return` rồi `isBoss ? … : isElite ? … : …` |
| 4 | `rollMortalEssenceAmount(isBoss)` trong nhánh `'material'` | `isBoss` |

Không đường nào biết stage đang chơi là tầng mấy. Stage chỉ góp mặt ở hai chỗ nhỏ: `zoneId` để đặt tên trang bị, và một check `requiredRealmId === 'mortal' && floor <= 10` cho Tinh Hoa Phàm Thể.

### 1.2 Dữ liệu quái

> **[SỬA 2026-09-12 — bản đếm của bản 1 và bản 2 SAI.]** Bản trước ghi "43 quái, 43/43 có `family`". Con số đó đến từ một lệnh grep đếm chuỗi `defineEnemy({`, và nó **bỏ sót toàn bộ tầng Trúc Cơ**, vốn được dựng bằng factory `foundationBeast({...})` chứ không gọi `defineEnemy` trực tiếp trong data. Số đúng bên dưới, đã xác minh lại trên cây code.

`ENEMIES` (`Enemies.ts:1828`) = `[...ENEMY_DEFINITIONS, ...FOUNDATION_ENEMIES, ...HIDDEN_BEASTS]`:

| Nguồn | Số quái | Có `family`? |
|---|---|---|
| `ENEMY_DEFINITIONS` (khai tay) | 43 | 42 |
| `FOUNDATION_ENEMIES` (factory `foundationBeast`, dòng 1469) | 20 | **0** |
| `HIDDEN_BEASTS` | 1 | 1 |
| **Tổng** | **64** | **43** |

- **21/64 quái KHÔNG có `family`** — gần như trọn tầng Trúc Cơ. Hệ quả thiết kế: **tầng họ quái không làm gì cho Trúc Cơ**, và **bảng stage của Trúc Cơ phải gánh toàn bộ bản sắc tầng đó**. Đây không phải lỗ hổng, mà là một ràng buộc phải biết khi cân bằng.
- Trong 43 con khai tay: **10** có `eliteRewards` → **33 con còn lại: bản Tinh Anh (HP ×2.5, ATK ×1.35) rơi ra Y HỆT quái thường**, vì `enemy.eliteRewards ?? enemy.rewards` rơi về bảng thường. **20** có `bossRewards`.
- Cảnh giới: `mortal` 20, `qi_refining` 23, `foundation_establishment` 20, quái ẩn 1.

### 1.3 Hệ số tiền hiện tại

**Quái khai tay** — đo trên `bandit` / Sơn Tặc:

| | Cảm ngộ Tâm Pháp | Linh thạch |
|---|---|---|
| `rewards` | 40 | 10 |
| `eliteRewards` | 200 = ×5 | 60 = ×6 |
| `bossRewards` | 500 = ×12.5 | 150 = ×15 |

**[MỚI] Tầng Trúc Cơ — hệ số nằm trong CÔNG THỨC, không phải bảng chép tay.** `foundationBeast` (`Enemies.ts:1469`) sinh sẵn cả ba bảng từ hằng số, gate bằng `bossEligible`:

| | Cảm ngộ | Linh thạch |
|---|---|---|
| `rewards` khi `bossEligible` | ×2.5 | ×6 |
| `eliteRewards` | ×5 | ×6 |
| `bossRewards` | ×12.5 | ×15 |

Hai điều quan trọng ở bảng này: (a) `bandit` **không phải một ví dụ lẻ** — đúng bộ tỉ lệ ×12.5/×15 đó là hằng số áp cho **20 con cùng lúc**; (b) quái `bossEligible` đã được nhân **ngay ở `rewards` gốc** (×2.5/×6) *trước khi* bảng elite/boss áp — một tầng nhân thứ ba mà bản 1 của spec không biết là có.

E4 cắt **boss xuống ×3** và **elite xuống ×2** — xem §6 R1/R2. Vì (a), đợt cắt này chạm tầng Trúc Cơ **qua factory**, nên §4 Nhịp 3 phải gỡ cả nhánh reward trong factory chứ không chỉ các khối khai tay; nếu bỏ sót, trần ×4 **lặng lẽ không áp cho 20/64 quái** và guard kinh tế §5.3 **không bắt được**, vì nó lấy mẫu resolver chứ không lấy mẫu `enemy.rewards`.

### 1.4 Chất trang bị đã có chủ

```ts
// EquipmentSystem.ts:360
private rollItemQuality(): ItemQuality {
  return weightedRandom(ITEM_QUALITY_ORDER.map(q => ({ value: q, weight: ITEM_QUALITY_DROP_WEIGHT[q] })))
}
```

Trọng số cố định, không nhận đầu vào từ stage/quái. Mọi thiết kế đặt "chất gốc" ở nơi khác là dựng quyền sở hữu thứ hai chồng lên cái này.

### 1.5 Invariant đang khoá dữ liệu

- `EnemyDropSinkInvariant.test.ts` — **mọi material rơi ra phải có nơi tiêu thụ** (recipe / chi phí thao tác / cost nghề), trừ `LORE_ALLOWLIST` 5 item cố ý vô dụng.
- `EnemyAlchemyDrops.test.ts` — cấm rơi 10 linh thảo legacy.

Cả hai đang duyệt `[enemy.rewards, enemy.eliteRewards, enemy.bossRewards]` — ba trường sắp biến mất. Xem §5.2.

### 1.6 [MỚI, L5] Có HAI hồ cảm ngộ, không phải một

| Hồ | Đường cấp | Ghi chú |
|---|---|---|
| `techniqueInsight` | **chỉ** vào tâm pháp đang trang bị; không trang bị hoặc chạm trần thì **mất trắng** | `EnemyReward.techniqueInsight`, bắt buộc khai |
| `skillInsight` | **luôn** cấp thẳng vào `player.skillInsight`, không cần trang bị gì | `EnemyReward.skillInsight` optional; không khai thì suy ra từ `techniqueInsight` qua `getSkillInsightReward()` |

Chữ "Cảm ngộ" trong UI phủ **cả hai**. Bản 1 của spec này chỉ nói tới hồ thứ nhất, tức là **bỏ ngỏ** hệ số tiền có áp lên `skillInsight` hay không. **E12 chốt: áp cho cả ba hồ** (`spiritStone`, `techniqueInsight`, `skillInsight`), vì `skillInsight` hôm nay đã suy ra từ `techniqueInsight` — để nó không nhân theo sẽ tạo ra một tỉ lệ lệch nhau giữa hai hồ mà không ai chủ ý thiết kế.

Thiên phú hiện nhân trên đường này (`getSpiritStoneGainMultiplier`, `getInsightGainMultiplier`, `getRealmRewardMultiplier`) **giữ nguyên vị trí và nhân SAU** hệ số modifier. Trần ×4 là trần của **riêng** hệ số modifier, không phải trần của tổng.

---

## 2. Target behavior

### 2.1 Mô hình roll: hai ngăn

Mô hình "mỗi dòng một phép thử độc lập" hiện nay **không diễn đạt được "thêm lượt bốc"** — không có lượt nào để thêm. Nhưng không phải drop nào cũng hợp với bốc: `van_kiem_quyet` chance 1.0 trên boss là *chắc chắn*, không phải *may rủi*. Nên mỗi bảng có hai ngăn:

```ts
interface DropTable {
  guaranteed: DropEntry[]   // tung doc lap theo chance; LUON xet; KHONG an extraRolls
  pool: WeightedDropEntry[] // boc theo weight; so luot = 1 + tong extraRolls
}

interface DropEntry {
  kind: 'material' | 'equipment' | 'equipment_any' | 'pill' | 'technique'
  itemId?: string            // bat buoc tru kind 'equipment_any'
  amount?: { min: number; max: number }
  chance?: number            // chi ngan guaranteed
}

interface WeightedDropEntry extends DropEntry { weight: number }
```

### 2.2 Hai tầng bảng

```ts
interface StageDropTable {
  realmId: string
  floors: { min: number; max: number }        // dai tang, bao gom 2 dau
  currency: { spiritStone: Range; techniqueInsight: Range }
  guaranteed: DropEntry[]
  pool: WeightedDropEntry[]
}

interface FamilyDropTable {
  familyId: string                            // 'boar' | 'wolf' | 'bandit' | ...
  guaranteed: DropEntry[]
  pool: WeightedDropEntry[]
}
```

**KHÔNG có trường `baseGrade`/`baseQuality`** — E5. Tầng stage quyết định *món nào có mặt* (quặng cảnh giới nào, có Đoán Bảo Thạch hay không), không quyết định chất.

Resolver gộp `pool` của hai bảng thành **một túi trọng số duy nhất** rồi bốc N lượt; chạy `guaranteed` của cả hai.

### 2.3 Modifier và luật stack [SỬA]

```ts
interface DropModifier {
  id: string                  // 'boss' | 'tinh_anh' | tag tuong lai
  extraRolls: number          // CONG
  currencyBonus: number       // CONG
}

export const MAX_CURRENCY_MULTIPLIER = 4
export const MAX_QUALITY_BONUS_STEPS = 2
```

**Luật tiền (E4) — ghi nguyên văn, khớp từng chữ với D8 spec PC:**

```
currency = 1 + sum(currencyBonus), cap MAX_CURRENCY_MULTIPLIER = 4
```

**Luật nâng chất (E5/E6/E9) — suy ra từ SỐ LƯỢNG modifier, KHÔNG phải field của modifier:**

```
qualityBonusSteps = clamp(len(modifiers) - 1, 0, MAX_QUALITY_BONUS_STEPS)

Ap dung: moi instance trang bi tao ra trong lan giet do duoc +qualityBonusSteps nac,
         chan o 'tien'. CHI trang bi.
Luot boc khong ra trang bi -> phan nang MAT. Khong doi luot, khong doi sang thu khac,
khong "boc lai cho ra trang bi".
```

Vì sao không cho mỗi modifier một field `qualityBonus` rồi cộng lại (đề xuất L2): cộng dồn **không tái tạo được** luật đã chốt. `tinh_anh = +1` thì elite đơn đã được nâng; `boss = +1` thì boss đơn đã được nâng; cả hai đều phá "chỉ khi cả hai". Công thức theo số lượng cho đúng kết quả **và** generalize:

| Số modifier | Ví dụ | qualityBonusSteps |
|---|---|---|
| 0 | quái thường | 0 |
| 1 | tinh anh **hoặc** boss | 0 |
| 2 | **boss + tinh anh** | **+1** |
| 3 | boss + tinh anh + tag tương lai | +2 |
| 4+ | — | +2 (chạm trần) |

Số khởi điểm của modifier (dữ liệu, chỉnh được bằng playtest):

| Modifier | extraRolls | currencyBonus |
|---|---|---|
| `tinh_anh` | +1 | +1 |
| `boss` | +3 | +2 |

Bảng kết quả:

| Trạng thái | Lượt bốc | Hệ số tiền | Chất trang bị |
|---|---|---|---|
| Quái thường | 1 | ×1 | roll thường |
| Tinh anh | 2 | ×2 | roll thường |
| Boss | 4 | ×3 | roll thường |
| **Boss + Tinh anh** | **5** | **×4** (chạm trần) | **roll thường, +1 nấc** |

Dòng cuối là thứ hệ hiện tại không diễn đạt nổi: `??` là *chọn một*, không phải *cộng lại*. Đó là nợ D8, đóng bằng luật chứ không bằng bảng thứ tư.

Trần ×4 là **hằng số riêng**, không phải hệ quả tình cờ của phép cộng — tag thứ ba ra đời chỉ chạm trần sớm hơn, không thổi bay kinh tế.

> **Lưu ý ranh giới:** D3 và §2.1 của spec PC nói **stat** stack theo phép **nhân liên tiếp** (`boss + tinh_anh = HP ×7 ×2.5`). Đó là trục khác và **không đổi**. Cộng-có-trần ở đây chỉ áp cho **tiền**.

### 2.4 Drop đặt tay (E7) [SỬA: thêm luật idle]

```ts
// tren Enemy / EnemyDefinition — THAY THE eliteRewards + bossRewards
signatureDrops?: SignatureDrop[]

interface SignatureDrop extends DropEntry {
  chance: number
  requiresModifier?: string   // 'boss' -> chi roi khi lan giet do mang modifier nay
}
```

Không ăn `extraRolls`, không được nâng chất. Ví dụ giữ nguyên ý đồ hiện tại:

```ts
// bandit
family: 'bandit',
signatureDrops: [
  { kind: 'material',  itemId: 'great_dao_seed',  chance: 0.0001, requiresModifier: 'boss' },
  { kind: 'technique', itemId: 'van_kiem_quyet',  chance: 1,      requiresModifier: 'boss' },
]
```

`great_dao_seed` là cổng mở Đột Phá Trúc Cơ — để nó tan vào túi trọng số chung là âm thầm tháo một cổng tiến trình.

**[MỚI, E11] Trên kênh idle:** `signatureDrops` có `chance === 1` **được cấp**; dòng có `chance < 1` **bị bỏ qua**. Hệ quả cụ thể trên `bandit` boss ở idle: nhận `van_kiem_quyet`, **không** nhận `great_dao_seed`. Cổng Đột Phá Trúc Cơ vì thế vẫn là phần thưởng của lần chơi chủ động, không tự rơi qua đêm.

### 2.5 Ba đường hardcode trở thành vị trí dữ liệu

| Hôm nay | Sau khi đổi |
|---|---|
| `grantArtifactStoneDrop` gate `realmIndex < foundation_establishment` | Đoán Bảo Thạch **có mặt trong bảng stage của Trúc Cơ trở lên, vắng mặt trong bảng Phàm Nhân**. Câu `if` biến mất vì không còn gì để hỏi. |
| `rollMortalEssenceAmount(isBoss)` | Một entry `guaranteed` trong bảng stage Phàm Nhân với dải `amount`. Boss nhiều hơn qua `extraRolls`. |
| `BOSS_/NORMAL_EQUIPMENT_DROP_CHANCE` | Một entry `kind: 'equipment_any'` trong `pool` stage. Trọng số thay hằng số. |

Ba câu hỏi `isBoss?` không được trả lời — **chúng không còn được hỏi nữa**. Đó là dấu hiệu trục chia đúng.

### 2.6 Kênh idle [SỬA — C3/E10]

Bản 1 ghi "idle chạy với danh sách modifier rỗng". **Sai**, và mâu thuẫn với D4 của spec PC (boss áp **unconditional cho cả idle lẫn active**). Luật đúng:

```
Idle bo TAG modifier, GIU modifier thuoc tinh stage.
```

| Kênh | Floor 1-9 | Floor 10 |
|---|---|---|
| **Active** | `[]`, hoặc `['tinh_anh']` khi roll trúng `eliteChance` | `['boss']`, hoặc `['boss','tinh_anh']` khi roll trúng |
| **Idle** | `[]` | **`['boss']`** — không bao giờ có `tinh_anh` |

Nghĩa là idle floor 10 vẫn bốc 4 lượt, ×3 tiền, và vẫn nhận `signatureDrops` chắc chắn của boss (E11) — nhưng **không bao giờ** chạm tới ×4, không bao giờ được nâng chất, và không bao giờ nhận signature drop may rủi. Đúng tinh thần D5 spec PC: idle là kênh tiến trình nền, active là kênh farm.

Phân biệt tag/stage-property nằm ở `DropContext` adapter (§3.2), không phải ở chỗ gọi — nên không có đường nào "quên pass cờ" được.

### 2.7 Save/compat

Không field save mới. Drop vào túi ngay lúc rơi; không có state drop nào được lưu. Không migration.

---

## 3. Kiến trúc — owner & ranh giới

```
enemy (isBoss, isElite, tagIds?)  -+
stage (realmId, floor)            -+-> DropContext { familyId, realmId, floor, modifiers[] }
tag (khi he tag ra doi)           -+
                                        |
                              resolveDrops(context)   <- MOT noi duy nhat
                                        |
                     DropResult { items[], spiritStone, techniqueInsight, skillInsight,
                                  qualityBonusSteps }
```

| Trách nhiệm | Owner |
|---|---|
| Hợp đồng bảng + resolver | `core/drop/DropTable.ts`, `core/drop/resolveDrops.ts` — thuần, không I/O |
| Từ vựng modifier + hằng số | `core/drop/DropModifier.ts` |
| Adapter enemy+stage → context, và **phân biệt tag / thuộc tính stage** | `core/drop/DropContext.ts` |
| Bảng theo cảnh giới/tầng | `data/drop/StageDropTables.ts` |
| Bảng theo họ quái | `data/drop/FamilyDropTables.ts` |
| Drop đặt tay | `Enemy.signatureDrops` |
| **Chất trang bị** | `EquipmentSystem.rollItemQuality()` — **KHÔNG ĐỔI**; `createInstance` nhận thêm tham số optional `qualityBonusSteps` |
| Cộng túi, toast, particle, quest hook | `BattleLootSystem` — **giữ nguyên vai trò**, chỉ đổi nguồn: tiêu thụ `DropResult` thay vì tự roll |

### 3.2 Vì sao không đọc thẳng `EnemyTag`

Theo **D4 của spec PC, boss không phải tag** — nó là thuộc tính stage, `createBossVariant` phải giữ nguyên. Nếu hệ drop đọc trực tiếp danh sách tag, boss rơi ra ngoài hệ và ta quay về đúng ternary `isBoss` đang muốn xoá. Với từ vựng riêng, `boss` là một drop-modifier hợp lệ **dù không phải EnemyTag** — D4 nguyên vẹn, drop vẫn thống nhất.

`DropContext` là nơi **duy nhất** biết modifier nào đến từ tag và modifier nào đến từ thuộc tính stage. Luật idle của E10 sống ở đó, một chỗ, không rải ra chỗ gọi.

Hệ quả: **`EnemyTag.ts` chưa tồn tại trên bất kỳ nhánh nào, nhưng hệ drop không bị chặn.** Hôm nay adapter đọc `isBoss`/`isElite`; khi hệ tag ra đời, adapter thêm một dòng ánh xạ `tagId → modifier`. Không file nào khác đổi.

### 3.3 Không đổi

`createBossVariant`, `createEliteVariant` (đến khi spec PC tự xoá), công thức stat và **luật stack stat kiểu nhân của D3 spec PC**, `ITEM_QUALITY_DROP_WEIGHT`, `EquipmentSystem.createInstance` ngoài một tham số optional, QuestSystem hook, auto-farm cycle math, normalize layer, combat pipeline, vị trí nhân của các hệ số thiên phú/realm (§1.6).

---

## 4. Di cư — ba nhịp

**Nhịp 1 — dựng song song.** Bảng mới + resolver ra đời, **chưa ai gọi**. Chỉ characterization test gọi cả hai và in bảng so sánh. Cây code chạy hệt như cũ. Rủi ro bằng không, và đã có đủ dữ liệu để quyết định số — kể cả Open Question OQ1 (§9).

**Nhịp 2 — chuyển đường dẫn.** `BattleLootSystem` đổi sang tiêu thụ `DropResult`; ba hàm hardcode bị hút vào bảng. Đây là nhịp **duy nhất** hành vi đổi, đổi một lần, có test kinh tế canh.

**Nhịp 3 — dọn.** Xoá `eliteRewards`/`bossRewards` khỏi **ba** nơi, không phải một: (a) 10 + 20 khối khai tay trong `ENEMY_DEFINITIONS`; (b) **nhánh reward trong factory `foundationBeast`** (`Enemies.ts:1469`) — bỏ sót chỗ này thì 20/64 quái giữ nguyên hệ số cũ và trần ×4 không áp cho cả tầng Trúc Cơ [SỬA 2026-09-12]; (c) field trên `Enemy`/`EnemyDefinition`. **Chỉ sau khi nhịp 2 xanh** — nhịp này không lùi được.

---

## 5. Verification strategy

Kỷ luật dự án: **mọi guard phải được nhìn thấy đỏ trước khi chấp nhận.**

### 5.1 Characterization trước khi động vào gì

RNG hạt giống cố định, giết mỗi con trong **64** con ở cả ba dạng (thường/elite/boss), ghi chính xác cái gì rơi. Lưới an toàn để biết cái gì *đã* đổi — không thay đổi nào lọt qua im lặng.

### 5.2 Invariant sink — phép thử ba-lần-đỏ

`EnemyDropSinkInvariant` phải viết lại để duyệt **ba nguồn mới**: bảng stage, bảng họ, `signatureDrops`. Đây là chỗ dễ tự lừa nhất — quên một nguồn thì test vẫn xanh trong khi luật đã thủng.

**Phép thử bắt buộc:** cố tình thêm một material không có sink vào **từng nguồn trong ba nguồn**, xác nhận test đỏ ở **cả ba lần**. Chỉ khi đó mới tính là đã viết lại đúng. Cùng cách với `EnemyAlchemyDrops`.

### 5.3 Kinh tế là con số, không phải cảm giác [SỬA — C4/L8]

Test tính **kỳ vọng tiền (cả ba hồ, §1.6) và số món trên mỗi lần giết** cho từng dải stage × từng dạng, cũ so với mới.

**Biên cụ thể [L8]:** N = 100.000 lần giết seeded mỗi ô. Ở cỡ mẫu đó nhiễu lấy mẫu trên các kỳ vọng này dưới 1%, nên mỗi ô được khẳng định so với **một hằng số có tên** với dung sai **±5%** — đủ chặt để bắt một thay đổi dữ liệu thật, đủ lỏng để không flake. Hằng số nằm trong file test, đổi nó là một thay đổi hiện rõ trong review chứ không phải một con số trôi.

Test **sẽ đỏ ở boss và elite** — đó là bằng chứng cho E4, không phải tai nạn:

| Dạng | Hôm nay (`bandit`) | Sau khi đổi | Δ |
|---|---|---|---|
| Elite | ×5 cảm ngộ / ×6 linh thạch | **×2** | ≈ −60% … −67% |
| Boss | ×12.5 / ×15 | **×3** | ≈ −76% … −80% |
| Boss + tinh anh | *không diễn đạt được* | **×4** | mới |

**Số đo thật (N = 100.000 seeded, Task 6 — `mortal`/`boar`, kênh active):**

| Dạng | Linh thạch/kill | Cảm ngộ/kill | Items/kill |
|---|---|---|---|
| Thường | 1.50 | 6.50 | 1.70 |
| Tinh anh | 3.00 | 13.01 | 2.70 |
| Boss | 4.50 | 19.50 | 4.70 |
| Boss + tinh anh | 6.00 | 26.00 | 5.70 |

Các con số này là hằng số có tên trong `dropEconomy.test.ts` (`EXPECTED_SPIRIT_STONE_PER_KILL`), dung sai ±5%. Guard kinh tế lấy mẫu `resolveDrops` — nó **không** thấy `enemy.rewards`, nên nhánh công thức cũ trong factory `foundationBeast` phải bị gỡ ở Nhịp 3 nếu không trần ×4 lặng lẽ không áp cho tầng Trúc Cơ.

### 5.4 Luật stack

Boss+tinh_anh → 5 lượt, ×4, +1 nấc chất. **Probe:** bỏ `tinh_anh`, phải tụt về 4 lượt, ×3, **và qualityBonusSteps về 0**.

Thêm một probe cho E9: dựng một modifier thứ ba giả, xác nhận `qualityBonusSteps` lên 2 và **không** lên 3.

### 5.5 Luật phí lượt (E6)

Test: lần giết boss+tinh_anh mà **không** lượt nào ra trang bị → không có item nào bị đổi chất, không có lượt bốc bù. **Probe:** cài resolver "tìm cho ra một trang bị" → test phải đỏ.

### 5.6 Chất vẫn thuộc EquipmentSystem

Test: với `qualityBonusSteps = 0`, phân phối chất của 10.000 instance rơi ra **không phân biệt được** với `ITEM_QUALITY_DROP_WEIGHT`. **Probe:** đặt một `baseQuality` ở bảng stage → test phải đỏ.

### 5.7 Kênh idle [SỬA — C3/E10]

- Idle floor 1-9 cho đúng bằng quái thường. **Probe:** cho idle nhận `tinh_anh` → test phải đỏ.
- Idle floor 10 chạy với **đúng** `['boss']`: 4 lượt, ×3, `qualityBonusSteps = 0`.
- Idle boss nhận `signatureDrops` `chance === 1`, **không** nhận `chance < 1`. **Probe:** hạ `van_kiem_quyet` xuống 0.99 → idle phải ngừng nhận nó.

### 5.8 Cổng

P3 quick mỗi task, full cuối mission. P14 browser: giết boss tầng 10 nhiều lần, xác nhận có lần ra prefix "Tinh Anh Đại Vương" kèm trang bị chất cao hơn thường lệ. P4 adversarial quick.

---

## 6. Risks

| # | Rủi ro | Mức | Xử lý |
|---|---|---|---|
| R1 | **Nerf tiền boss ×12.5-15 → ×3** | Cao, **có chủ đích** (E4) | §5.3 in ra con số cụ thể; user duyệt con số. Đổi trần không cần đụng cơ chế |
| R2 | **[MỚI, L1] Nerf tiền elite ×5-6 → ×2** | Cao, **có chủ đích** | Cùng nguồn với R1: trần ×4 buộc elite phải thấp hơn boss một khoảng có nghĩa. Phần bù của elite là `extraRolls` và §1.2 (33 con lâu nay cho 0 đồ giờ có cho) — **bù bằng đồ, không bù bằng tiền**. Muốn giữ tiền elite gần mức cũ thì `tinh_anh.currencyBonus` phải lên +2, nhưng khi đó elite = ×3 = boss, và combo ×5 bị trần cắt về ×4 — khoảng cách elite/boss gần như biến mất. **Khuyến nghị giữ +1**, chỉnh sau playtest |
| R3 | **33 con elite bỗng cho đồ** thay vì không cho gì (§1.2) | Trung bình — lạm phát material | Cùng test §5.3; chỉnh trọng số túi, không chỉnh cơ chế |
| R4 | **Viết lại invariant sink mà quên một nguồn** | Cao, và **im lặng** | Phép thử ba-lần-đỏ §5.2 |
| R5 | Bảng họ quái đẻ ra material chưa có sink | Trung bình | Chính invariant đó bắt — nhưng chỉ khi đã viết lại đúng |
| R6 | Hệ drop giành quyền roll chất | Trung bình | Probe §5.6 |
| R7 | `EnemyTag.ts` chưa tồn tại | Thấp | §3.2 — adapter đọc `isBoss`/`isElite`, không bị chặn |
| R8 | Nhịp 3 xoá `eliteRewards` làm vỡ test ngầm | Trung bình | grep + characterization §5.1 trước khi xoá; nhịp 3 tách riêng |
| R9 | [MỚI] **Nâng chất rơi vào khoảng không** — boss+tinh_anh nhưng không lượt nào ra trang bị | Đã đo: 0.0% (2026-09-12) | **OQ1 §9 - ĐÃ ĐÓNG** |

---

## 7. Out of scope

- Cân bằng lại toàn bộ trọng số (số trong spec là điểm khởi đầu phát hành, chỉnh bằng playtest).
- Material mới cho các họ quái chưa có đồ đặc trưng.
- **Drop gắn với Hoàn Mỹ (Perfect Clear)** — PC hiện là điều kiện mở idle; biến nó thành nguồn drop là một thiết kế riêng.
- Tag mới ngoài `tinh_anh`; hệ tag (thuộc spec PC).
- Rework `ITEM_QUALITY_DROP_WEIGHT`, `ProfessionGrade`, `ItemGrade`.
- **Luật stack stat kiểu nhân** của D3 spec PC — trục khác, không đụng.

### 7.1 [MỚI, L6] Việc kế tiếp đã đặt tên: lọc `equipment_any` theo cảnh giới

Hôm nay `grantRandomEquipmentDrop` bốc **một món bất kỳ trong toàn bộ registry trang bị**, không lọc gì — Động 1 rơi được đồ Trúc Cơ. Đây là một lỗi thật, nhưng **không sửa trong đợt này**: đổi trục drop đồng thời đổi pool trang bị thì không phân biệt được thay đổi kinh tế nào do cái gì gây ra.

Sau đợt này nó là **một dòng dữ liệu** trong `StageDropTables`, nên việc lọc trở thành một **task riêng, thuần dữ liệu**, không phải sửa code. Ghi vào roadmap ngay khi nhịp 3 xong, đừng để rơi.

---

## 8. Tiêu chí chấp nhận

1. Một con quái bất kỳ, ở một stage bất kỳ, với một tập modifier bất kỳ → **đúng một** hàm quyết định cái gì rơi.
2. `data/enemy/Enemies.ts` không còn `eliteRewards`/`bossRewards`; mỗi quái khai `family` + `signatureDrops` khi thật sự cần.
3. Không còn `isBoss`/`isElite` ternary nào trong `BattleLootSystem` quyết định *cái gì* rơi.
4. Tinh Anh của **cả 64** con cho nhiều hơn quái thường — đo được, không phải khẳng định.
5. Boss+tinh_anh cho 5 lượt, ×4 tiền, +1 nấc chất trang bị; không ra trang bị thì phần nâng mất.
6. Phân phối chất với `qualityBonusSteps = 0` không phân biệt được với hôm nay.
7. Invariant sink đỏ được ở cả ba nguồn dữ liệu mới.
8. Idle floor 1-9 = quái thường; idle floor 10 = `['boss']` và chỉ nhận signature drop chắc chắn.
9. Hệ số tiền áp lên cả ba hồ `spiritStone` / `techniqueInsight` / `skillInsight`; thiên phú vẫn nhân sau.

---

## 9. Open questions

### OQ1 [L4] — nâng chất có rơi vào khoảng không quá thường xuyên không?

**Câu hỏi:** trong một lần giết boss+tinh_anh (5 lượt bốc), xác suất **không lượt nào** ra trang bị là bao nhiêu?

**Vì sao chưa trả lời được:** trọng số túi chưa được author — chúng ra đời ở Nhịp 1.

**Ước lượng với trọng số minh hoạ ở §2.2** (`equipment_any` weight 20 trên tổng 170 ≈ 11,8%): `(1 − 0,118)^5 ≈ 53%`. Tức là **hơn một nửa** số lần giết boss+tinh_anh, phần thưởng đặc biệt nhất của cả hệ thống không xảy ra gì cả.

**Luật quyết định (user chốt trước):** đo tại Nhịp 1 với trọng số thật.

- Nếu xác suất trượt **≤ 20%** → giữ nguyên E6 ("phí lượt thì thôi").
- Nếu **> 20%** → đổi E6 sang: *một trong các lượt bốc của lần giết đó được bảo đảm ra trang bị* khi `qualityBonusSteps > 0`.

Con số ước lượng trên cho thấy nhánh thứ hai **nhiều khả năng sẽ trúng**. Ghi rõ ở đây để nó là một phép đo có kế hoạch, không phải một phát hiện muộn.

**ĐÃ ĐO (Task 6, 2026-09-12, đo lại theo boss+tinh_anh 5 lượt):**
`sampleDropExpectation` với 100,000 mẫu/realm (seed cố định,
`game/src/core/drop/dropSampling.ts`), đúng tập modifier
`[BOSS_MODIFIER, TINH_ANH_MODIFIER]`:

| Realm | noEquipmentRate (boss+tinh_anh, 5 lượt) |
|---|---|
| `mortal` (family `boar`) | **0.0%** |
| `qi_refining` (family `bandit`) | **13.3%** |
| `foundation_establishment` (không `family`) | **13.2%** |

Realm `mortal` không ràng buộc được câu hỏi: pool của nó toàn dòng equipment
(`equipment` + `equipment_any` — phản ánh đúng lịch sử tầng này chỉ từng rơi
`tinh_hoa_pham_the` và `base_kiem`), nên mọi lượt bốc đều ra trang bị. Hai
realm còn lại pha dòng `material` vào pool nên mới là nơi câu hỏi cắn; luật
quyết định áp lên **số xấu nhất** = 13.3%.

**Kết quả: nhánh 1 trúng** — `13.3% ≤ 20%` → **giữ nguyên E6**. Không cần bảo
đảm trang bị. OQ1 **ĐÃ ĐÓNG**.

Lưu ý cho các quyết định sau: ở kill **thường** (1 lượt) thì
`foundation_establishment` đo `noEquipmentRate = 66.7%` — phần lớn quái thường
tầng Trúc Cơ không rơi trang bị, đúng thiết kế (không có quality bonus nên
không có gì bị phí), nhưng là con số cần biết khi cân bằng lượt bốc. Số đo
4-lượt trước đó (qi_refining boss 20.0%, foundation boss 19.7%) sát ngưỡng
đúng như dự đoán suy ra ~13% ở 5 lượt. Bảng đầy đủ nằm trong
`.superpowers/sdd/2026-09-12-drop-system/task-6-report.md`.
