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

Quality được roll lúc rớt/tạo item và **CỐ ĐỊNH** — hiện KHÔNG có thao tác nào nâng Quality (không
còn `upgradeQuality`). Muốn Quality cao hơn phải rớt/tạo item mới.

### 2a. Tiềm Năng Rèn — lần chuẩn hóa phẩm chất/độ hiếm (2026-08-14)

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
Thiết kế hiện hành dùng 2 axis không cạnh tranh nhau về mặt nhận thức (Phẩm Chất trả
lời "vật phẩm này ĐẲNG CẤP gì", Tiềm Năng Rèn trả lời "BẢN THỂ này roll tốt tới đâu"), dù cả 2
cùng ảnh hưởng tới Rèn. `EquipmentRarity` (Hoàng/Huyền/.../Tiên Phẩm, mục "Rarity" bên dưới) là
trục THỨ 3, hoàn toàn độc lập với cả 2 — tài liệu gốc không đề cập tới trục này.

### Rarity — 5 bậc Ngũ Phẩm (quyết định SỐ LƯỢNG affix, KHÔNG phải sức mạnh trần)

Lần chuẩn hóa nguyên tắc đặt tên (2026-08-14) đổi từ 4 bậc
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
hạn affix theo Rarity. mainStat được roll lúc tạo/rớt và hiện **CỐ ĐỊNH** — không có thao tác nào
reroll nó (Tẩy/Tinh Luyện chỉ tác động substat affix, xem mục 4).

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

## 4. Cường Hóa/Tẩy Luyện/Tinh Luyện/Hóa Luyện — 4 thao tác Khí Đường

(resource-professions-rework 2026-08-25, `EquipmentSystem.ts`) — mỗi thao tác nhắm ĐÚNG 1 mục tiêu,
không chồng nhau. Cường Hóa là slot-scoped; Tẩy/Tinh/Hóa Luyện là item-scoped — chọn thẳng 1 item
trong túi, và **item đang trang bị / locked / favorite bị chặn** (không sửa field trên instance đang
gắn modifier sống hoặc đang khóa).

| Thao tác | Sửa gì | Lưu ở đâu | Cost |
|---|---|---|---|
| **Cường Hóa** (Enhance) | `enhanceLevel` | `EquipmentSlotState` (theo **SLOT** nhân vật) | Deterministic +1 cấp/lần, trần `maxEnhanceLevel`. Cost nguyên liệu theo `EquipmentOperationCostCatalog` (scale theo level) + Linh Thạch; level Khí Đường giảm cost. |
| **Tẩy Luyện** (Wash) | Reroll TOÀN BỘ identity substat: số dòng, identity từ pool hợp lệ, tier ban đầu — KHÔNG đổi main stat/quality/realm/Cường Hóa | `EquipmentInstance.affixes` (theo **ITEM**) | Điểm Rèn + 1 stack Quáng CÙNG cảnh giới item + Linh Thạch (`WASH_SPIRIT_STONE_COST`, phẩm theo realm item). |
| **Tinh Luyện** (Refine) | Giữ NGUYÊN identity mọi substat, roll lại GIÁ TRỊ từng dòng không khóa trong ±20% (clamp tier); khóa ≤ `REFINE_MAX_LOCKS` dòng | `EquipmentInstance.affixes` (theo **ITEM**) | Điểm Rèn + Tinh Hoa cùng tier + Linh Thạch (đơn giá `REFINE_SPIRIT_STONE_PER_UNIT` × N+L). |
| **Hóa Luyện** (Dissolve) | Phân giải item → **Tinh Hoa** theo realm (`EQUIPMENT_REALM_ESSENCE_MATERIAL`) | (hủy item) | Không tốn nguyên liệu; item equipped/locked/favorite bị loại khỏi danh sách. |

**Điểm Rèn** (`forgePoints`, item-scoped) là tài nguyên Tẩy/Tinh Luyện TIÊU THỤ — khởi tạo ĐẦY theo
`forgePotential` lúc rớt/tạo, trần `getMaxForgePoints(quality, forgePotential)` (mục 2a). KHÔNG còn
thao tác "Rèn" cộng điểm riêng nào; Điểm Rèn chỉ giảm dần khi Tẩy/Tinh Luyện.

Cường Hóa + Điểm Rèn còn lại cùng nhân vào 1 hệ số scale lên mainStat + mọi affix
(`calculateEquipmentScale()`):

```
scale = 1 + enhanceLevel × 0.08 + forgePoints × 0.005
```

Vì Cường Hóa là slot-scoped ("Mục XVI: Item và Slot phải tách hoàn toàn"), thao tác này trong UI
Khí Đường chọn **vị trí trang bị** (Vũ Khí/Mũ/Giáp/...) rồi tự resolve món đang đeo ở đó; đổi trang
bị trong slot KHÔNG mất cấp đã Cường Hóa. Linh Thạch tiêu thụ resolve PHẨM theo realm của trang bị
(Tẩy/Tinh Luyện) hoặc theo enhance level (Cường Hóa), KHÔNG hard-code Hạ Phẩm.

**Khắc Trận** (socket Formation) và **Yểm Phù** (apply Talisman) trước đây cũng slot-scoped — sống
trên `EquipmentSlotState.socketedFormation`/`appliedTalismanIds`. Hiện Phù/Trận đang **giữ khóa**
(chưa phát hành, xem [future-talisman-formation-system-plan.md](./future-talisman-formation-system-plan.md));
plumbing slot vẫn còn nhưng không có luồng tiêu thụ hoạt động.

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

## 6. Cảnh giới của item (realmId) — cố định lúc rớt

`instance.realmId` = cảnh giới người chơi lúc item được tạo/rớt ra — **KHÔNG tự đổi** khi người
chơi lên cảnh giới mới, và hiện **KHÔNG có thao tác nào nâng realmId của item** (không còn
`upgradeRealm`). realmId quyết định PHẨM Linh Thạch + loại Tinh Hoa/Quáng dùng cho Tẩy/Tinh/Hóa
Luyện của chính item đó (mục 4). Đồ cũ tụt hậu thì thay bằng đồ rớt ở cảnh giới cao hơn, hoặc giữ
làm nguyên liệu Hóa Luyện.

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

## 8. Building level ảnh hưởng chức năng (resource-professions-rework 2026-08-25)

Building KHÔNG còn là trạm craft trung gian — nguyên liệu đến thẳng từ ProductionSite (mục 10).
Level building (tối đa 9, nâng bằng Gỗ cùng realm + Linh Thạch) giờ cấp hiệu ứng theo
`BuildingLevelEffect` (`src/data/building/buildings.ts`):

- **Khí Đường**: mỗi cấp từ 2 trở đi giảm 3% chi phí Cường Hóa/Tẩy Luyện/Tinh Luyện (trần 24% ở
  level 9, `equipment_cost_discount`).
- **Đan Phòng**: level 3/6/9 mở thêm 1 slot luyện đan đồng thời (baseline 1, trần 4,
  `concurrent_job_slots`); speed/success bonus luyện đan theo level riêng (`AlchemyBalance`).
- **Linh Tuyền**: rate + storage Linh Thạch tăng theo level (storage = 10h sản lượng).
- **Điều Phối Nhân Công**: +1 worker tự động mỗi level.

Bốn thao tác Khí Đường (Cường Hóa/Tẩy/Tinh/Hóa Luyện) là thao tác TỨC THỜI — không đi qua job/
recipe, chỉ có độ trễ UI cố định khi xử lý.

## 9. Item không phải Equipment (tóm tắt) + hệ Phẩm dùng chung

4 loại còn lại đơn giản hơn nhiều — **không có instance riêng**, chỉ là stack số lượng theo id:

| Loại | Container | Field |
|---|---|---|
| Material | `MaterialBag` | `{ material, amount }` — nguyên liệu thô, không có chỉ số. |
| Pill | `PillBag` | `{ pill, amount }` — dùng tức thời (hồi máu/cộng tu vi/buff vĩnh viễn theo trần cảnh giới), không có state riêng sau khi dùng. |
| Talisman | `TalismanBag` | `{ talisman, amount }` — tiêu thụ khi Yểm Phù (áp vào `EquipmentSlotState.appliedTalismanIds`), stack biến mất, hiệu lực dồn vào SLOT chứ không phải bản thân Phù. |
| Formation | `FormationBag` | `{ formation, amount }` — tiêu thụ khi Khắc Trận (socket vào `EquipmentSlotState.socketedFormation`), tương tự Talisman. |

Không loại nào trong 4 loại này có Rarity/Affix/Enhance/Wash/Refine/Hóa Luyện — những khái niệm đó
CHỈ tồn tại trên Equipment (roll ngẫu nhiên lúc rớt, có instance riêng biệt).

**Lưu ý**: Talisman (Phù) và Formation (Trận) hiện đang **giữ khóa** (chưa phát hành — xem
[future-talisman-formation-system-plan.md](./future-talisman-formation-system-plan.md)). Plumbing bag
+ slot vẫn còn nhưng không có luồng tiêu thụ hoạt động; chỉ **Material** và **Pill** đang hoạt động thật.

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

## 10. Nền kinh tế nguyên liệu (resource-professions-rework 2026-08-25 + economy pass 2026-08-28)

Đã loại bỏ hoàn toàn hệ cũ (Yêu Đan/Yêu Huyết/Yêu Cốt, Bụi Cốt, Luyện Khí `smeltEquipment`,
Tinh Luyện Cốt, CraftingSystem/Recipe). Nguyên liệu hiện đến từ **3 nguồn sản xuất** của Địa Giới
Thanh Vân (`src/core/production/ProductionCatalog.ts`), mỗi nguồn 1 site, level riêng (tối đa 9,
giữ level khi đột phá, nâng bằng Gỗ cùng realm + Linh Thạch):

| Nguồn | Ra gì | Dùng vào đâu |
|---|---|---|
| **Thanh Vân Lâm** (forest) | Gỗ theo realm × 5 tuổi (`<realm>_wood_<age>`, gp123 6E C2 — plain wood đã xóa) | Nâng building/site, nhiên liệu luyện đan. |
| **Huyền Thiết Quảng** (mine) | Linh khoáng: realm × 5 tuổi (`<realm>_ore_<age>`) | Tẩy Luyện (1 stack cùng cảnh giới item), nâng building, quy đổi cảnh giới. |
| **Thanh Vân Động Thiên** (grotto) | Linh thảo: mỗi đan phương có ĐÚNG 1 thảo riêng, biến thể niên đại | Luyện đan (Đan Phòng). |

- **Quy ước ID thống nhất (gp123 6E task C2, save v57)**: gỗ/khoáng/thảo đều dùng CÙNG trục
  tuổi 5 bậc `decade`/`century`/`millennium`/`myriad_year`/`thuong_co` (Thập Niên → Thượng Cổ,
  bảng `MATERIAL_AGE_LABELS`). Hậu tố phẩm cũ (`hoang|huyen|dia|thien|tien`) và plain
  `<realm>_wood` KHÔNG TỒN TẠI nữa — meta `profession.quality` đổi thành `profession.age`,
  save cũ bị từ chối (dev phase).

- **Linh Thạch** — material thật trong `MaterialBag` (`SpiritStoneMaterial.ts`), 3 phẩm Hạ/Trung/
  Thượng. Nguồn: Linh Tuyền, quái rơi, quest. Sink: 4 thao tác Khí Đường, luyện đan, thuê worker,
  Đột Phá Lệnh. Quy đổi **1 chiều lên** `100 Hạ → 1 Trung`, `100 Trung → 1 Thượng`
  (`GameManager.convertSpiritStonesUp`); phẩm dùng resolve theo realm/enhance level, KHÔNG hard-code
  Hạ Phẩm.
- **Tinh Hoa** (`tinh_hoa_*`) — ra từ **Hóa Luyện** trang bị, mapping theo realm
  (`RefinementBalance.EQUIPMENT_REALM_ESSENCE_MATERIAL`); là nguyên liệu của **Tinh Luyện**.
- **Quy đổi cảnh giới linh mộc/linh khoáng** — gộp LÊN `10 bậc thấp → 1 bậc cao` theo thang
  mortal→qi_refining→foundation_establishment (`MaterialTierConversionBalance` +
  `GameManager.convertMaterialTier`); cả gỗ lẫn khoáng giữ TUỔI khi lên cảnh giới
  (`<realm>_wood_<age>` / `<realm>_ore_<age>`, gp123 6E C2); chỉ 1 chiều (giữ sink).
  NOTE: tính năng quy đổi sẽ bị XÓA ở task E2 (plan gp123 6E).
- **Vật liệu mồ côi đã dọn (2026-08-28)**: 11 material legacy (thanh_linh_moc, xich_dong,
  huyen_thiet, thanh-dong, han-thiet, hoang_kim_linh_thiet, tinh_ngan, quang_sat, phu_chi, ...) đã
  xóa; drop quái migrate về `qi_refining_ore_decade` (trước 6E C2 là `qi_refining_ore_hoang`).
  Invariant test đảm bảo mọi material drop đều có
  sink (`EnemyDropSinkInvariant.test.ts`).
