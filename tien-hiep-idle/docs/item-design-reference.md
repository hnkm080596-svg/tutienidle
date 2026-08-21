# Item Design Reference — Tiên Hiệp Idle

Tài liệu này diễn giải toàn bộ những gì một **item trang bị** (Equipment) có thể mang trong
thiết kế hiện tại của game, sau đợt Building System rework (BUILDing spec) VÀ đợt Equipment
Rework tiếp theo (Rarity/Affix Pool/Forge, 2026-08-14). Viết từ code thật
(`src/core/equipment/*`) tại thời điểm hoàn thành đợt rework gần nhất, không phải từ kế hoạch —
nếu code đổi sau này, tài liệu này cần cập nhật lại theo.

Ngoài Equipment, cuối tài liệu có phần tóm tắt ngắn cho 4 loại item khác trong game (Material/
Pill/Talisman/Formation) để phân biệt rõ vì sao chúng đơn giản hơn nhiều.

## 1. Hai lớp dữ liệu: Template tĩnh vs Instance sở hữu

Mỗi món trang bị có 2 phần tách biệt:

- **`Equipment`** (`core/equipment/Equipment.ts`) — template tĩnh trong registry, dùng chung cho
  mọi bản instance sinh ra từ nó (vd "Thanh Vân Kiếm" là 1 template — mọi Thanh Vân Kiếm rớt ra
  đều bắt đầu từ template này nhưng roll ra chỉ số khác nhau).
- **`EquipmentInstance`** (`core/equipment/EquipmentInstance.ts`) — 1 bản cụ thể người chơi sở
  hữu, tự mang chỉ số ĐÃ ROLL. Cùng 1 template có thể sinh ra nhiều instance khác nhau hoàn toàn
  về phẩm chất/độ hiếm/affix.

## 2. Hai trục độc lập: Quality (phẩm cấp) và Rarity (độ hiếm)

Đây là điểm dễ nhầm nhất — 2 khái niệm nghe giống nhau nhưng **hoàn toàn độc lập**, mỗi trục có
vai trò riêng, không trục nào ảnh hưởng trực tiếp lên trục kia.

### Quality — 9 bậc "tu vi của món đồ"

```
Phàm Khí → Bảo Khí → Linh Khí → Pháp Khí → Pháp Bảo
→ Tiên Bảo → Chí Bảo → Hỗn Độn Chí Bảo → Thiên Địa Trọng Khí
```

Vai trò của Quality (Equipment Rework — mở rộng thêm 2 vai trò mới, không chỉ còn gate Tier):
**"Quality = Potential"** — Quality gate CẢ 3 thứ: Tier Affix tối đa, POOL Affix mở được (mục
3b), VÀ range roll của Implicit (mục 3a) — Quality không tự cộng thẳng multiplier vào giá trị,
chỉ nới RANGE trước khi roll.

| Quality | Tier Affix tối đa | Hệ số range Implicit | Trần Forge Point TUYỆT ĐỐI (cả tier) |
|---|---|---|---|
| Phàm Khí | 1 | ×1.00 | 20 |
| Bảo Khí | 1 | ×1.08 | 30 |
| Linh Khí | 2 | ×1.18 | 45 |
| Pháp Khí | 2 | ×1.28 | 60 |
| Pháp Bảo | 3 | ×1.38 | 80 |
| Tiên Bảo | 3 | ×1.48 | 100 |
| Chí Bảo | 4 | ×1.58 | 130 |
| Hỗn Độn Chí Bảo | 4 | ×1.68 | 160 |
| Thiên Địa Trọng Khí | 5 | ×1.80 | 200 |

Nâng Quality qua thao tác **Nâng Phẩm** (`EquipmentSystem.upgradeQuality()`) — tốn nguyên liệu
theo `template.upgradeQualityCost`, tăng đúng 1 bậc mỗi lần, không roll lại gì khác.

### 2a. Tiềm Năng Rèn — "EquipemtnQuality&rarity" pass (2026-08-14)

Cột "Trần Forge Point" ở bảng trên giờ là trần TUYỆT ĐỐI của cả tier, KHÔNG phải trần thật của 1
instance cụ thể. Mỗi instance roll thêm 1 field độc lập `forgePotential: number` (0-100, đều,
xem `EquipmentSystem.rollForgePotential()`) lúc tạo — trần Rèn THẬT của instance đó là:

```
getMaxForgePoints(quality, forgePotential) = round(forgePotential / 100 × EQUIPMENT_QUALITY_MAX_FORGE_POINTS[quality])
```

Ví dụ: 2 item cùng Phàm Khí (trần tuyệt đối 20) nhưng 1 cái roll `forgePotential 30` (trần thật
6) và 1 cái roll `forgePotential 90` (trần thật 18) — CÙNG Quality nhưng tiềm năng đầu tư khác
hẳn nhau. Đây là hiện thực hoá phân biệt "**Phẩm Chất = cấp của vật phẩm**" (Quality, hiện NỔI
BẬT trong UI Khí Đường — header/viền vàng) vs "**Tiềm Năng Rèn = độ hoàn thiện của lượt roll
này**" (forgePotential, hiện SUBORDINATE — thanh %/số nhỏ trong khu vực Rèn) mà tài liệu
"EquipemtnQuality&rarity" mô tả — 2 axis không cạnh tranh nhau về mặt nhận thức (Phẩm Chất trả
lời "vật phẩm này ĐẲNG CẤP gì", Tiềm Năng Rèn trả lời "BẢN THỂ này roll tốt tới đâu"), dù cả 2
cùng ảnh hưởng tới Rèn. `EquipmentRarity` (Hoàng/Huyền/.../Tiên Phẩm, mục "Rarity" bên dưới) là
trục THỨ 3, hoàn toàn độc lập với cả 2 — tài liệu gốc không đề cập tới trục này.

### Rarity — 5 bậc Ngũ Phẩm (quyết định SỐ LƯỢNG affix, KHÔNG phải sức mạnh trần)

Naming-principles pass (2026-08-14, xem file `nguyen li dat ten` ở gốc project) — đổi từ 4 bậc
chủ đề "Duyên" sang 5 bậc **Phẩm** dùng CHUNG tên/thứ tự với Pill/Talisman/Formation
(`core/item/Pham.ts`, mục 9 dưới):

```
Hoàng Phẩm → Huyền Phẩm → Địa Phẩm → Thiên Phẩm → Tiên Phẩm
```

Equipment Rework (2026-08-14) — bỏ hẳn "Unique"/`fixedAffixes` cũ: **không còn item cố định
affix nào trong game**, mọi item đều đi qua đúng 1 pipeline roll ngẫu nhiên ("không có item
đúng, chỉ có roll tốt hay xấu"). Lưu ý quan trọng: dù tên GIỐNG hệ Phẩm dùng cho Pill/Talisman/
Formation, Ý NGHĨA MECHANIC của trục này trên Equipment vẫn hoàn toàn khác — chỉ quyết định số
lượng Affix roll được (roll density), KHÔNG quyết định sức mạnh trần như Quality (mục 2a) hay
như Phẩm trên Pill/Talisman/Formation (mục 9).

| Rarity | Prefix tối đa | Suffix tối đa | Trọng số roll |
|---|---|---|---|
| Hoàng Phẩm | 0 | 0 | 55 |
| Huyền Phẩm | 1 | 1 | 27 |
| Địa Phẩm | 2 | 1 | 12 |
| Thiên Phẩm | 2 | 2 | 5 |
| Tiên Phẩm | 3 | 3 | 1 |

Rarity roll ngẫu nhiên **lúc rớt/tạo item** (`EquipmentSystem.createInstance()`) và **không đổi
được sau đó** — không có thao tác "nâng rarity" nào trong game.

**Exalted Affix** — CHỈ `tien_pham` mới có `EQUIPMENT_RARITY_EXALTED_AFFIX_CHANCE = 15%` cơ
hội roll thêm **1 affix bonus** từ pool `'supreme'` (mục 3b), NGOÀI 3/3 slot bình thường — affix
này CHẠM TRẦN TIER TOÀN HỆ THỐNG (tier 5) bất kể Quality thật của item đó là gì (đặc quyền của
Rarity cao nhất, không phải Quality — 1 item Phàm Khí vẫn có thể roll trúng 1 dòng Exalted cực
mạnh nếu đủ may mắn, đúng tinh thần "roll tốt hay xấu"). Vẫn HOÀN TOÀN ngẫu nhiên, không phải
item cố định. Tổng tối đa: 3+3 base + 1 exalted = 7 affix, còn dư 1 dưới `GLOBAL_MAX_AFFIXES = 8`
cho Yểm Phù.

## 3. Chỉ số: Implicit (mainStat) + Affix (Prefix/Suffix)

### 3a. Implicit (mainStat)

1 chỉ số CHẮC CHẮN có trên mọi instance của cùng 1 template. Roll qua **2 hệ số nhân độc lập,
dồn vào nhau**: Quality scale RANGE trước khi roll (`EQUIPMENT_QUALITY_IMPLICIT_MULTIPLIER`, xem
mục 2), rồi Realm scale KẾT QUẢ sau khi roll (`MAIN_STAT_REALM_SCALE = 0.05`/mốc cảnh giới toàn
cục — đồ rớt ở cảnh giới cao luôn mạnh hơn đồ cùng Quality rớt ở cảnh giới thấp). Nằm ngoài giới
hạn affix theo Rarity. **Tinh Luyện** (mục 4) là thao tác DUY NHẤT reroll lại giá trị này.

### 3b. Affix (Prefix/Suffix) + Pool

`affixes: RolledAffix[]` — các dòng Prefix/Suffix roll từ `AffixRegistry`, mỗi dòng có `tier`
(giới hạn bởi Quality) và `value` (roll trong range của đúng tier đó, cố định lúc roll — **Tẩy
Luyện** là thao tác DUY NHẤT roll lại value, không đổi affixId/tier). Một số affix chỉ roll được
trên slot nhất định (`Affix.slots`).

Equipment Rework thêm trục thứ 3 lên affix: **`pool: AffixPool`** (`'basic' | 'advanced' |
'specialized' | 'supreme'`) — Quality mở dần pool truy cập được
(`EQUIPMENT_QUALITY_UNLOCKED_POOLS`):

```
Phàm Khí/Bảo Khí         → basic
Linh Khí/Pháp Khí        → + advanced
Pháp Bảo/Tiên Bảo        → + specialized
Chí Bảo trở lên          → + supreme
```

Pool `'supreme'` là pool DUY NHẤT Exalted Affix (mục 2) được phép rút ra, kể cả khi Quality thật
của item chưa tự mở pool đó.

## 4. Cường Hóa/Tẩy Luyện/Tinh Luyện/Rèn — 4 thao tác, 4 mục tiêu KHÔNG chồng nhau

Equipment Rework định nghĩa lại rõ ràng: mỗi thao tác nhắm vào ĐÚNG 1 thứ, không thao tác nào
làm việc của thao tác khác:

| Thao tác | Sửa gì | Lưu ở đâu | Kiểu thao tác |
|---|---|---|---|
| **Cường Hóa** (Enhance) | `enhanceLevel` | `EquipmentSlotState` (theo **SLOT** nhân vật) | Deterministic, +1 cấp/lần, có trần `maxEnhanceLevel` (theo template). |
| **Tẩy Luyện** (Wash) | Giá trị từng `RolledAffix.value` hiện có | `EquipmentInstance.affixes` (theo **ITEM**) | Reroll ngẫu nhiên trong range tier hiện tại, KHÔNG đổi affixId/tier, không giới hạn số lần. |
| **Tinh Luyện** (Refine) | `mainStat.flat` (Implicit) | `EquipmentInstance.mainStat` (theo **ITEM**) | Reroll ngẫu nhiên (mục 3a), KHÔNG đổi affixes, không giới hạn số lần — đối xứng với Tẩy Luyện nhưng nhắm Implicit thay vì Affix. |
| **Rèn** (Forge) | `forgePoints` | `EquipmentInstance.forgePoints` (theo **ITEM**) | Deterministic, +1 điểm/lần, trần theo Quality (mục 2) — thay thế hoàn toàn vai trò cũ của `refineLevel`. |

Cường Hóa + Rèn cùng cộng vào 1 hệ số scale nhân thẳng vào mainStat + mọi affix
(`calculateEquipmentScale()`):

```
scale = 1 + enhanceLevel × 0.08 + forgePoints × 0.005
```

Vì Cường Hóa là slot-scoped (giống lý do kiến trúc gốc — "Mục XVI: Item và Slot phải tách hoàn
toàn", đổi trang bị trong slot KHÔNG mất cấp đã cường hóa), thao tác này trong UI (Khí Đường)
chọn **vị trí trang bị** (Vũ Khí/Mũ/Giáp/...) rồi tự resolve món đang trang bị ở đó. 3 thao tác
còn lại (Tẩy/Tinh Luyện/Rèn) đều item-scoped — chọn thẳng 1 item trong túi, và **item đang trang
bị bị chặn** cho tới khi tháo ra (không được sửa field trên 1 instance đang gắn modifier sống).

Tương tự Cường Hóa, **Khắc Trận** (socket Formation) và **Yểm Phù** (apply Talisman) cũng slot-
scoped — sống trên `EquipmentSlotState.socketedFormation`/`appliedTalismanIds`, không theo item.

## 5. `EquipmentSlotState` — dữ liệu sống theo NHÂN VẬT, không theo item

6 slot cố định (`weapon`/`helmet`/`armor`/`boots`/`ring`/`necklace`), sống suốt đời nhân vật,
không bị xoá khi tháo/đổi đồ:

| Field | Ý nghĩa |
|---|---|
| `enhanceLevel` | Cấp Cường Hóa hiện tại của slot (xem mục 4). |
| `socketedFormation` | Trận đã khắc vào slot này (kèm bản copy sống của modifier, tự mất khi unsocket). |
| `bonusAffixSlots` | Số affix slot mở thêm qua Yểm Phù, tích luỹ theo slot — món đồ trang bị vào sau tự được "lấp bù" affix cho đủ hạn mức (`reconcileBonusAffixSlots()`), không vượt `GLOBAL_MAX_AFFIXES = 8`. |
| `appliedTalismanIds` | Danh sách Phù đã áp — chỉ CỘNG, không có cơ chế gỡ. |

Vì vậy: 1 item "yếu" (rarity thấp) vẫn có thể rất mạnh nếu trang bị vào 1 slot đã đầu tư nhiều
Cường Hóa/Yểm Phù/Khắc Trận từ trước — sức mạnh KHÔNG nằm gọn trong 1 chỗ.

## 6. Nâng Cảnh Giới (item)

`instance.realmId` = cảnh giới người chơi lúc item được tạo/rớt ra — không tự đổi khi người chơi
lên cảnh giới mới. Thao tác **Nâng Cảnh Giới** (`upgradeRealm()`) cập nhật `instance.realmId`
lên bằng cảnh giới hiện tại của người chơi (chỉ khi player đang ở cảnh giới CAO HƠN), tốn cả
nguyên liệu (`upgradeRealmCost`) lẫn Linh Thạch (`upgradeRealmSpiritStoneCost`) — cách duy nhất
để 1 món đồ cũ không bị tụt hậu so với sức mạnh hiện tại của nhân vật mà không cần rớt đồ mới.

## 7. Toàn bộ field của 1 EquipmentInstance

```ts
interface EquipmentInstance {
  instanceId: string        // định danh duy nhất
  itemId: string             // trỏ về Equipment template
  slot: EquipmentSlot        // weapon/helmet/armor/boots/ring/necklace
  equipped: boolean          // đang trang bị hay còn trong túi (CÙNG 1 container — EquipmentBag,
                              // equip/unequip chỉ là boolean flip, không di chuyển giữa container)
  quality: EquipmentQuality  // 'pham_khi'..'thien_dia_trong_khi' — gate tier/pool affix + range Implicit
  rarity: EquipmentRarity    // 'hoang_pham'|'huyen_pham'|'dia_pham'|'thien_pham'|'tien_pham' — số lượng affix tối đa
  realmId: string            // cảnh giới lúc tạo/rớt — xem mục 6
  mainStat: StatModifier     // implicit — Tinh Luyện reroll field .flat này, xem mục 3a/4
  affixes: RolledAffix[]     // prefix/suffix đã roll (mỗi dòng có pool riêng trên Affix template, mục 3b)
  forgePoints: number        // xem mục 4 — item-scoped, thay thế refineLevel cũ
  forgePotential: number     // 0-100, Tiềm Năng Rèn — xem mục 2a, độc lập với quality/rarity
}
```

Field slot-scoped (enhanceLevel/socketedFormation/bonusAffixSlots/appliedTalismanIds) **không**
nằm trên instance — xem mục 5.

## 8. Building level giờ ảnh hưởng crafting (mới trong đợt này)

Đan/Trận/Phù (không phải Equipment) giờ chịu modifier từ Building tương ứng
(`BuildingSystem.getCraftModifiers()`, xem `core/building/BuildingLevelEffect.ts`):

- `craft_time_reduction` — rút ngắn `craftDuration` thật của Recipe.
- `craft_quality_bonus` — cơ hội (%) nhận thêm +1 thành phẩm khi thu hoạch (không phải roll
  Quality/Rarity gì — Pill/Talisman/Formation không roll instance, `pham` là field TĨNH trên
  template, xem mục 9).
- `concurrent_job_slots` — số lượt craft chạy song song cùng loại (trước đây cứng 1 lượt/loại).

Building này **không** ảnh hưởng gì tới Equipment (Khí Đường không đi qua CraftingSystem — Cường
Hóa/Tẩy/Tinh Luyện/Rèn vẫn là thao tác tức thời, chỉ thêm 1 độ trễ UI cố định ~1s khi xử lý).

## 9. Item không phải Equipment (tóm tắt) + hệ Phẩm dùng chung

4 loại còn lại đơn giản hơn nhiều — **không có instance riêng**, chỉ là stack số lượng theo id:

| Loại | Container | Field |
|---|---|---|
| Material | `MaterialBag` | `{ material, amount }` — nguyên liệu thô, không có chỉ số. |
| Pill | `PillBag` | `{ pill, amount }` — dùng tức thời (hồi máu/cộng tu vi/buff vĩnh viễn theo trần cảnh giới), không có state riêng sau khi dùng. |
| Talisman | `TalismanBag` | `{ talisman, amount }` — tiêu thụ khi Yểm Phù (áp vào `EquipmentSlotState.appliedTalismanIds`), stack biến mất, hiệu lực dồn vào SLOT chứ không phải bản thân Phù. |
| Formation | `FormationBag` | `{ formation, amount }` — tiêu thụ khi Khắc Trận (socket vào `EquipmentSlotState.socketedFormation`), tương tự Talisman. |

Không loại nào trong 4 loại này có Rarity/Affix/Enhance/Wash/Refine/Forge/Nâng Cảnh Giới — những
khái niệm đó CHỈ tồn tại trên Equipment (roll ngẫu nhiên lúc rớt, có instance riêng biệt).

**Nhưng** kể từ naming-principles pass (2026-08-14), Pill/Talisman/Formation ĐỀU có field
`pham: Pham` (`core/item/Pham.ts`) — cùng 5 tên/thứ tự Hoàng→Huyền→Địa→Thiên→Tiên Phẩm với
Equipment Rarity (mục 2), nhưng Ý NGHĨA khác hẳn: đây là field TĨNH trên template (không roll,
không đổi sau khi tạo), và trực tiếp biểu thị ĐỘ MẠNH thật của effect (không phải "may mắn của
lượt roll" như Equipment Rarity) — 1 pill Tiên Phẩm luôn mạnh hơn pill Hoàng Phẩm cùng họ hiệu
ứng, không có yếu tố ngẫu nhiên nào. `pham` thay thế hoàn toàn field `grade: number` cũ.

Quy ước ĐẶT TÊN áp dụng cho cả 3 loại: **`[Phẩm] + [Effect] + Đan/Phù/Trận`** (VD "Huyền Phẩm Tụ
Khí Đan", "Địa Phẩm Đoạt Mệnh Trận") — tên PHẢI nói thẳng công dụng, không dùng tên lore/loài quái
(vd "Viêm Hồ Đan" đặt theo tên quái chế ra nó là SAI quy tắc, đã sửa lại thành "Thiên Phẩm Cường
Công Đan" theo đúng họ hiệu ứng Cường Công). Cùng 1 từ Effect có thể xuất hiện ở cả Đan/Phù/Trận
(vd "Tụ Khí"/"Tụ Linh") — đó là điểm CỐ Ý, giúp người chơi học vocabulary chung của game, miễn là
hiệu ứng THẬT của mỗi loại khác nhau. Equipment KHÔNG theo quy ước này — tên template
(`Equipment.name`) là 1 chuỗi cố định không mang Phẩm/Quality (vd "Thiết Kiếm"), Phẩm/Quality chỉ
hiện qua UI label riêng (mục 2), lý do: Equipment có instance rớt ra với Phẩm random mỗi lần, còn
Pill/Talisman/Formation không roll — Phẩm của chúng CỐ ĐỊNH theo đúng cái tên đã in trên nhãn.

## 10. Nền kinh tế nguyên liệu — "tunghematandsuch" pass (2026-08-14)

Thay hẳn material "mỗi loài quái 1-2 material riêng" (zoo material) bằng 1 hệ gọn hơn, theo
đúng công thức tổng quát của tài liệu gốc:

```
Đan:  1-3 Linh Thảo (niên đại tuỳ ý) + 1 Yêu Đan  + Linh Thạch
Phù:  1-2 Linh Mộc  (niên đại tuỳ ý) + 1 Yêu Huyết + Linh Thạch
Trận: 1-3 Linh Thiết (đa hành)       + 1 Yêu Cốt   + Linh Thạch
```

- **Linh Thảo/Linh Mộc/Linh Thiết** (`Material.years`/`element`, `core/material/Material.ts`) —
  3 nhóm nguyên liệu tự nhiên. Niên đại (0/100/1000, hậu tố Bách Niên/Thiên Niên) đặt TRẦN Phẩm
  tối đa 1 recipe dùng nó có thể đạt (Hoàng/Huyền Phẩm dùng bậc gốc, Địa Phẩm dùng Bách Niên,
  Thiên/Tiên Phẩm dùng Thiên Niên) — KHÔNG đảm bảo chắc chắn ra đúng Phẩm đó, kết quả vẫn qua
  recipe/CraftingSystem như cũ, niên đại chỉ mở khoá TRẦN. Linh Thiết dùng trục Ngũ Hành (5 biến
  thể nguyên tố: Huyền Thiết/Xích Đồng/Thanh Đồng/Hàn Thiết/Hoàng Kim Linh Thiết) thay vì niên
  đại, vì đã đủ đa dạng cho Bày Trận cần trộn nhiều loại.
- **Yêu Đan/Yêu Huyết/Yêu Cốt** (`yeu_dan_qi_refining` v.v.) — rơi từ MỌI quái, tiered theo
  **cảnh giới của quái** (`realmId`), không phải theo loài — id hậu tố `_<realmId>`, chỉ tier
  `qi_refining` tồn tại (chưa có Stage nào ở realm cao hơn). Thay hẳn 16 material trophy riêng
  từng loài (wolf-fang/flame-fox-fur/... — xem `data/enemy/Enemies.ts`).
- **`Linh Thạch`** — KHÔNG phải material mới, chính là `player.spiritStone` có sẵn (đã hiện "Linh
  thạch" trong `CharacterPanel.vue` từ trước). Wire vào Recipe qua `Recipe.spiritStoneCost`
  (`CraftingSystem.canStart()`/`start()`) và Equipment qua `Equipment.enhanceSpiritStoneCost`
  (`EquipmentSystem.enhance()`) — cùng pattern `upgradeRealmSpiritStoneCost` đã có từ trước.
- **Luyện Khí** (`GameManager.smeltEquipment()`) — cách THỨ HAI để có Equipment (ngoài rớt từ
  quái): tốn 3 Linh Thiết + Linh Thạch, roll 1 instance mới qua ĐÚNG `equipmentSystem.
  createInstance()` sẵn có, cộng thêm **Bụi Cốt** làm phế liệu. Vẫn là thao tác INSTANT (không
  qua Recipe/CraftingSystem — Equipment luôn instant, xem mục 8), UI ở khu "Luyện Khí" riêng
  trong Khí Đường (`EquipmentHallPanel.vue`, tách khỏi khối `OPERATIONS` vì đây tạo instance MỚI
  chứ không sửa 1 instance có sẵn).
- **Bụi Cốt** (`bui_cot`) — tiêu thụ lại bởi Cường Hóa (`enhanceCost`, mọi template Equipment đã
  đổi sang tham chiếu material này) — đúng vòng "Khai thác → Luyện Khí → phế liệu → Cường Hóa".
- **Tinh Luyện Cốt** (`tinh_luyen_cot`, `GameManager.refineBuiCot()`) — Bụi Cốt + Linh Thạch →
  Tinh Luyện Cốt, 1 conversion đơn giản (không qua Recipe). **CHƯA có consumer nào trong đợt
  này** — tài liệu gốc chỉ liệt kê use-case tương lai ("cường hóa cao cấp", "sửa chữa Khí") chưa
  có mechanic cụ thể để wire vào; cố tình dừng ở mức "có nguồn thu thật" thay vì bịa 1 sink giả.
