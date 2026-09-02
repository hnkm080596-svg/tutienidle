# Item Grade/Quality Model — Design Spec (v2 — complete)

**Ngày:** 2026-09-01 (v2 rewrite cùng ngày — big rework, tổng hợp mọi quyết định đã duyệt)
**Phạm vi:** Tái cấu trúc toàn bộ trục phẩm/chất trên trang bị + vòng lặp nguyên liệu rèn/tẩy/tinh + tab Phân Giải mới + mở đường gate phẩm (T2.5), Vendor thu mua (6G), chu kỳ Độ Kiếp (6H).
**Roadmap:** `game/docs/roadmap.md` — thay thế T2.4/T2.5/T2.7 bằng thiết kế thống nhất này.
**Lộ trình thực thi:** writing-plans → subagent-driven-development (SDD), từng task TDD.

---

## 0. Tổng quan — tại sao rework

> ✅ **Đã chốt (đối thoại 2026-09-01):** `forgeUsesRemaining` là **ngân sách dùng CHUNG** cho Tẩy + Tinh trên item — "rèn" KHÔNG tồn tại như hành động độc lập. Cường hóa ngược lại là tiến trình của **SLOT** (vĩnh viễn, 100 cấp, tỉ lệ mũ 0.956 + pity 10) — chi tiết §5.1.

Code hiện tại có **3 trục lấn chiếm lẫn nhau** trên trang bị: `realmId` (realm người chơi bắt lên item), `quality` (9 bậc Khí random theo bảng weights 10×9), `rarity` (Ngũ Phẩm 5 random toàn cục). Hệ quả: terminology hiển thị xáo trộn ("Phẩm" cho trục chất), tinh hoa Hóa Luyện là **item chết** (0 consumer — sản xuất mà không gì tiêu thụ), ore Tẩy Luyện tạo bối rối "phải tìm quặng cùng realm", và không có gate phẩm.

Model mới: **2 trục rõ ràng + 1 vòng lặp nguyên liệu khép kín**:
- **Phẩm (grade)** — 10 bậc, deterministic từ realm, điều khiển mọi thứ "tầng sức mạnh"
- **Chất (quality)** — 5 bậc, random, điều khiển mọi thứ "tiềm năng substats"
- **Luyện Khí Tinh Hoa** — nguyên liệu trung gian duy nhất, vòng: khoảng (phân giải) → tinh hoa → rèn/tẩy/tinh (trang bị tốt hơn)

## 1. Terminology chuẩn (nguồn sự thật duy nhất — khóa)

| Thuật ngữ | Thuộc về | Số bậc | Định nghĩa |
|---|---|---|---|
| **Cảnh giới (realm)** | **Nhân vật** | 10 (Phàm Nhân → Độ Kiếp) | Tiến trình người chơi |
| **Phẩm (grade)** | **Item** | 10 (Cửu Phẩm → Tiên Phẩm) | Trùng 1:1 realm. Item sinh khi nhân vật ở realm R → phẩm = bậc của R. Realm KHÔNG phải thuộc tính item — nó là **đầu vào randomizer** chọn phẩm |
| **Chất (quality)** | **Item** | 5 (Hoang → Tiên) | Trục random duy nhất, điều khiển substats |

Phẩm ↔ cảnh giới (bảng 10:10 — đã tồn tại trong code là `PROFESSION_GRADE_BY_REALM`):

| Phẩm | Cảnh giới | | Phẩm | Cảnh giới |
|---|---|---|---|---|
| Cửu Phẩm | Phàm Nhân | | Tứ Phẩm | Hóa Thần |
| Bát Phẩm | Luyện Khí | | Tam Phẩm | Luyện Hư |
| Thất Phẩm | Trúc Cơ | | Nhị Phẩm | Hợp Thể |
| Lục Phẩm | Kim Đan | | Nhất Phẩm | Đại Thừa |
| Ngũ Phẩm | Nguyên Anh | | Tiên Phẩm | Độ Kiếp |

⚠️ **Xung đột tên "Tiên":** Tiên Phẩm (grade 10) ≠ Tiên Chất (quality 5). Hai trường riêng; UI luôn ghi nhãn đầy đủ "Phẩm: Tiên Phẩm" / "Chất: Tiên Chất". Hiển thị rút gọn phải đủ ngữ cảnh phân biệt.

## 2. Schema item

```ts
// EquipmentInstance — SAU
grade: ProfessionGrade        // MỚI — thay realmId (10 bậc union có sẵn)
realmLevel: number            // GIỮ — globalLevel scale cần (grade→realm suy được; realmLevel thì không)
quality: ItemQuality          // 5 chất (hoang..tien) — nhận vai trò của rarity cũ
forgeUsesTotal: number        // MỚI — lượt rèn cố định theo chất (5/10/20/40/80)
forgeUsesRemaining: number    // MỚI — giảm 1/lượt TẨY/TINH (ngân sách item)
affixes: RolledAffix[]        // số dòng random 0..N theo chất

// Slot state (EquipmentSlotState) — MỚI enhance fields
enhanceLevel: number          // GIỮ tên — giờ là cấp CƯỜNG HÓA SLOT (vĩnh viễn, 1..100)
enhanceFailStreak: number     // MỚI — pity counter, reset khi thành công
// XÓA HẲN
realmId: string               // → grade
rarity: EquipmentRarity      // → quality (nhận tất cả vai trò)
forgePoints: number           // → forgeUses*
forgePotential: number        // xóa (vô nghĩa)
// EquipmentQuality 9 bậc Khí + 4 bảng cân bằng của nó + FORGE_PERCENT_PER_POINT
```

```ts
// data/materials — SAU
luyen_khi_tinh_hoa: Material  // MỚI — 1 loại duy nhất, category 'essence'
// XÓA: tinh_hoa_pham_khi .. tinh_hoa_thien_dia_trong_khi (10 essence bậc Khí — dead-end items, 0 consumer)
// GIỮ RIÊNG (ngoài scope): tinh_hoa_pham_the — Luyện Thể system dùng, không đụng
```

## 3. Bảng phân vai 17 dòng — ai điều khiển cái gì

| # | Cơ chế | Thuộc | Thiết kế |
|---|---|---|---|
| 1 | Scale mainStat theo tiến trình | **Phẩm** | `× (1 + globalLevel(grade→realm, realmLevel) × 0.05)` — giữ cơ chế, đổi nguồn tra |
| 2 | Số dòng substat lúc tạo | **Chất** | **RANDOM khoảng**: Hoang 0–1, Huyền 0–2, Địa 0–3, Thiên 0–4, Tiên 0–5. Roll số dòng; mỗi dòng 50/50 prefix/suffix; trần `GLOBAL_MAX_AFFIXES=8` giữ |
| 3 | Trần tier affix | **Chất** | mỗi chất +1 tier: T1/T2/T3/T4/T5 |
| 4 | Pool affix mở | **Chất** | Hoang basic; Huyền +advanced; Địa +specialized; Thiên +supreme; Tiên all |
| 5 | Điểm Rèn (ngân sách item) | **Chất** | **5/10/20/40/80** (×2 mỗi chất), cố định. Dùng CHUNG cho Tẩy + Tinh: mỗi lần tẩy/tinh tốn 1 lượt + nguyên liệu riêng. Hết lượt → chặn cả 2. Bỏ FORGE_PERCENT_PER_POINT. (Cường hóa slot là tiến trình riêng — xem #7a) |
| 7a | **Cường Hóa SLOT (mới)** | **Realm** | Cấp cường hóa gắn SLOT (vĩnh viễn, 1..100 = 10 realm×10), KHÔNG theo item. Tỉ lệ `max(1%, 100×0.956^(L-1))` — fail KHÔNG phạt (chỉ mất nguyên liệu), **pity 10 fail liên tiếp = chắc chắn thành công**. Item vào slot được khuếch đại theo cấp slot |
| 6 | Implicit multiplier (roll mainStat) | **Chất** | 1.00 / 1.15 / 1.30 / 1.50 / 1.75 |
| 7 | Chi phí nguyên liệu (tẩy/tinh) | **Phẩm item** | CostCatalog tra qua grade→realm của ITEM (giữ cấu trúc, đổi nguồn tra). Chi phí cường hóa slot theo realm của SLOT — xem #7a |
| 8 | ~~Ore Tẩy Luyện cùng bậc~~ | — | **XÓA** — Tẩy không còn dùng ore (xem #9a) |
| 9 | Tinh hoa Hóa Luyện — loại | — | **1 loại: `luyen_khi_tinh_hoa`** — bảng 10 essence theo realm xóa |
| 10 | Tinh hoa Hóa Luyện — lượng | **Chất** | giữ range: 1-3 / 2-4 / 3-5 / 4-6 / 5-7 |
| 11 | Weight chất lúc drop | **Chất** | **CỐ ĐỊNH mọi phẩm: 75 / 15 / 8 / 1.99 / 0.01** (tổng = 100 chính xác) |
| 11a | **Tẩy Luyện (wash)** | **Chất** | Random lại TOÀN BỘ substats: số dòng (random lại trong khoảng 0–N chất) + stat + tier + value. Mục đích: **ra nhiều dòng, dòng đúng yêu cầu** — có thể ra ít hơn trước (đánh đổi có chủ ý) |
| 11b | **Tinh Luyện (refine)** | **Chất** | **Chắc chắn tăng, không bao giờ giảm** (bỏ ±20% variance). Mỗi lần: chọn random 1 dòng → tăng `+U(5%, 20%)` **mức độc lập từng dòng** (mỗi substat roll mức riêng). Clamp trong tier range. Balance sau bằng playtest |
| 12 | Gate mặc đồ | **Phẩm** | MỚI: `canUseItem` — ngang phẩm mới dùng, chặn 2 chiều (cao & thấp); đột phá đại cảnh giới tháo toàn bộ |
| 13 | Vendor thu mua | **Phẩm** | MỚI (6G): chỉ mua phẩm thấp hơn realm |
| 14 | Chu kỳ Độ Kiếp | **Phẩm** | MỚI (6H): item chu kỳ cũ vô dụng |
| 15 | Màu + label | Phẩm + Chất | Phẩm rank 1–10 (`--rank-color-1..10`, mở color-10, bậc 10 gradient 7 sắc) • Chất dải 5 màu • **1 đường duy nhất** — xóa biến chết `--grade-*`, `--eq-quality-*` |
| 9a | **Nguyên liệu Tẩy/Tinh/Cường** | — | Mọi hành động tốn **Luyện Khí Tinh Hoa** (đơn vị chuẩn): Rèn 1/lượt; Tẩy = bảng cost mới theo 5 chất (giữ cấu trúc số 2→18 cũ, đổi đơn vị tinh hoa); Tinh = bảng 1→9 theo 5 chất + Linh Thạch (N+L)×50 giữ; Cường hóa giữ Linh Thạch theo level + thêm tinh hoa theo bảng plan |
| 9b | **Tab Phân Giải (mới, tab 5 Khí Đường)** | — | Nguồn DUY NHẤT tinh hoa: phân giải **linh khoáng**. Settings: lọc phẩm, lọc chất, số nhân công (pool chung). Chạy như production cycle (tick, không instant). Output tuyến tính: `tinh_hoa = hệ_số(phẩm, chất) × nhân_công`. Khởi điểm hệ số: chất +1 bậc ×2, phẩm ×1.5/bậc — chốt số trong plan bằng quy tắc cân bằng 6F |

### Bảng cân bằng 5 chất (tổng hợp)

| Chất | Substats | Lượt rèn | Tier trần | Pools | Implicit | Essence (hóa luyện) |
|---|---|---|---|---|---|---|
| Hoang | 0–1 | 5 | T1 | basic | 1.00 | 1–3 |
| Huyền | 0–2 | 10 | T2 | +advanced | 1.15 | 2–4 |
| Địa | 0–3 | 20 | T3 | +specialized | 1.30 | 3–5 |
| Thiên | 0–4 | 40 | T4 | +supreme | 1.50 | 4–6 |
| Tiên | 0–5 | 80 | T5 | all | 1.75 | 5–7 |

### Luyện Khí Tinh Hoa — vòng lặp khép kín

```
Linh Khoáng (mọi phẩm/chất — từ Khai Vật Đường)
    │  Tab Phân Giải (settings: phẩm, chất, nhân công — production cycle)
    ▼
Luyện Khí Tinh Hoa (1 material duy nhất)
    │  Rèn (1/lượt) · Tẩy (bảng theo chất) · Tinh (bảng theo chất) · Cường hóa (bảng plan)
    ▼
Trang bị (phẩm = realm, chất = substats)
```

**Lý do thiết kế (đã duyệt):**
1. Đơn giản hóa logic chọn nguyên liệu ở Khí Đường — hết "phải tìm đúng ore cùng realm"
2. Tạo đầu ra cho sản phẩm "thường" (khoáng phẩm/chất thấp thường bị bỏ qua — giờ đều có giá trị)
3. Fix dead-end: tinh hoa cũ 10 loại không gì tiêu thụ — giờ 1 loại có vòng khép kín
4. Pattern "phân giải → nguyên liệu trung gian" tái sử dụng được cho hệ thống khác khi phù hợp

## 4. Drop pipeline mới

```ts
// EquipmentSystem.createInstance — TRƯỚC
quality = rollQuality(player.realmId)   // weights 10×9 theo realm
rarity  = rollRarity()                  // weights toàn cục

// SAU
grade   = PROFESSION_GRADE_BY_REALM[player.realmId]   // deterministic — realm CHỌN phẩm
quality = weightedRandom([
  { value: 'hoang', weight: 75 },
  { value: 'huyen', weight: 15 },
  { value: 'dia',   weight: 8 },
  { value: 'thien', weight: 1.99 },
  { value: 'tien',  weight: 0.01 },
])
affixCount = randomInt(0, QUALITY_MAX_SUBSTATS[quality])  // khoảng 0–N
forgeUsesTotal = QUALITY_FORGE_USES[quality]
```

- `rollQuality` cũ (weights realm) **xóa** + `EQUIPMENT_QUALITY_REALM_WEIGHTS` 10×9 **xóa**
- `rollRarity` cũ **xóa** — `EQUIPMENT_RARITY_DROP_WEIGHT` thay bằng `ITEM_QUALITY_DROP_WEIGHT` (75/15/8/1.99/0.01)
- `weightedRandom` dùng float — 1.99/0.01 hoạt động nguyên bản (đã kiểm chứng `DropRoll.ts:30-44`)
- **Xóa `WASH_LINE_COUNT_WEIGHTS` + `WASH_TIER_WEIGHTS` theo OreQuality** (5×2 bảng) — thay bằng khoảng 0–N chất + tier weights mới theo chất (chốt trong plan)
- **Exalted Affix** (`EQUIPMENT_RARITY_EXALTED_AFFIX_CHANCE` 15%): giữ cơ chế — chỉ áp cho Tiên Chất, +1 dòng supreme vượt slot

## 5. Thay đổi cơ chế chi tiết

### 5.1 Cường Hóa (enhance) — REWORK: thuộc SLOT, pity system

**Mô hình mới — Cường hóa là tiến trình của SLOT (vĩnh viễn):**
- Cấp cường hóa gắn với **slot** (weapon/helmet/...), KHÔNG theo item. Tháo/đổi đồ không mất cấp
- Item mặc vào slot được **khuếch đại** theo cấp cường hóa slot — item yếu ở slot mạnh vẫn yếu; cường hóa = đầu tư tài khoản
- 10 cảnh giới × 10 cấp = **100 level cường hóa slot** tổng
- Tẩy/Tinh ngược lại: hành động trên **item**, tốn **Điểm Rèn của item** (`forgeUsesRemaining`) — tiến trình tạm thời, đi theo item

**Tỉ lệ thành công — đường cong mũ:**
```
successRate(level L) = max(1%, round(100 × 0.956^(L-1)))
```
- L1=100%, L5≈84%, L10≈64%, L20≈41%, L40≈17%, L60≈7%, L80≈2.8%, L100=floor 1%
- ×0.956/level, giảm đều ~4.4%, không bậc nhảy; cực đoan có chủ ý (user-approved)
- Floor 1% — không bao giờ 0%

**Bảo Hiểm (pity) — 10 lần thất bại liên tiếp = chắc chắn thành công:**
- `enhanceFailStreak: number` per-slot, persist qua save
- Fail → streak+1; đạt 10 → lần tiếp theo thành công CHẮC CHẮC (bất kể tỉ lệ), reset streak=0; Success → streak=0
- **Thất bại KHÔNG phạt** — chỉ mất nguyên liệu của lần thử đó (user-approved); không rơi cấp
- UI bắt buộc: hiển thị counter khi streak ≥ 3 ("Bảo hiểm 4/10") — người chơi thấy ánh sáng cuối đường
- Hệ quả cân bằng: kỳ vọng end-game ≤ 10 lần thử/slot-level (trần hóa cực đoan); đầu-game pity không bao giờ chạm

**Chi phí:**
- Nguyên liệu mỗi lần THỬ (kể cả fail): Linh Thạch theo level + cost catalog theo phẩm slot (giữ cấu trúc) — chốt bảng trong plan
- Đơn vị tinh hoa cho cường hóa: **không dùng** — cường hóa không tốn Điểm Rèn (đó là của tẩy/tinh trên item)

### 5.2 Rèn (forge) — REWORK
- `forgeUsesRemaining` giảm 1/lượt; chặn khi 0; hiển thị "x/y lượt"
- 1 lượt = 1 Luyện Khí Tinh Hoa (cố định mọi chất — khoảng cách chất nằm ở TỔNG lượt)
- **Bỏ:** `FORGE_PERCENT_PER_POINT`, `calculateEquipmentScale` phần forge (chỉ còn enhance), `getMaxForgePoints`, `forgePotential`/`forgePoints` toàn hệ (UI tooltip, auto-dissolve candidate sort, tests)
- **Đã chốt:** không có hành động "rèn" độc lập — `forgeUsesRemaining` là ngân sách item dùng CHUNG cho Tẩy + Tinh (mỗi lần tẩy/tinh tốn 1 lượt). Điểm rèn = tài nguyên tạm thời của item, đối cực với cường hóa vĩnh viễn của slot (§5.1)

### 5.3 Tẩy Luyện (wash) — REWORK
- Input: trang bị + **Luyện Khí Tinh Hoa** (bảng theo chất) + Linh Thạch giữ — **KHÔNG còn ore**, KHÔNG còn yêu cầu "quặng cùng realm"
- Kết quả: roll lại toàn bộ — số dòng `randomInt(0, N_chất)`, mỗi dòng: stat (prefix/suffix pool chất cho phép, exclude mainStat + trùng), tier (weights mới theo chất, trần = tier chất), value (roll trong tier)
- Exalted: chỉ Tiên Chất, 15% +1 dòng supreme
- Xóa: `WASH_ORE_AMOUNT`, `getWashCost` phần ore, ore filter UI, prefix `${realmId}_ore_` lookup
- Mục đích người chơi: **nhiều dòng + đúng stat** — tẩy xấu hơn là rủi ro có chủ ý

### 5.4 Tinh Luyện (refine) — REWORK
- Input: trang bị + tinh hoa (bảng 1→9 theo 5 chất) + Linh Thạch `(N + L) × 50` giữ
- **Chắc chắn tăng:** chọn random 1 dòng chưa khóa → `newValue = clamp(oldValue × (1 + U(0.05, 0.20)), tier.min, tier.max)` — **mỗi lần tăng mức riêng của dòng đó**, không đồng loạt
- Bỏ `REFINE_VALUE_VARIANCE` (cơ chế ±20% có thể giảm)
- Giữ: `REFINE_MAX_LOCKS = 3` (khóa dòng khi tăng — người chơi chiến lược), preview/commit flow (`previewRefineValues`/`commitRefineValues` giữ kiến trúc, đổi thuật toán roll)

### 5.5 Hóa Luyện (dissolve) — đổi output
- Output: `luyen_khi_tinh_hoa` — lượng theo chất (bảng 1-3 → 5-7 giữ nguyên range cũ)
- Auto-dissolve (soft cap 500): giữ nguyên hành vi, chỉ đổi material output
- Xóa: `EQUIPMENT_REALM_ESSENCE_MATERIAL` bảng 10, `ESSENCE_TIER_NAMES`, `equipmentEssenceMaterialId`

### 5.6 Tab Phân Giải (mới)
- Vị trí: **tab thứ 5 trong Khí Đường** (cùng panel với Cường Hóa/Tẩy/Tinh/Hóa Luyện — quyết định panel riêng trong plan nếu EquipmentHallPanel quá lớn; hiện 1806 dòng đã lớn — **khuyến nghị plan tách component tab riêng** để giữ file nhỏ)
- Settings: [Phẩm: tất cả/chọn] [Chất: tất cả/chọn] [Nhân công: 0..max]
- Chạy: production cycle (tick qua ProductionSystem hoặc tick riêng trong EquipmentSystem — chốt kiến trúc trong plan; hướng tới tái dùng ProductionSystem cho khớp 6F cân bằng per-worker)
- Output tuyến tính + hệ số khởi điểm (chốt số trong plan theo quy tắc 6F "sản xuất ≤ tiêu thụ trên mỗi nhân công, cùng phẩm cùng chất"):
  ```
  tinh_hoa/lượt = base(phẩm khoáng) × hệ_số(chất khoáng) × nhân_công
  base khởi điểm: 1 + (bậc_phẩm − 1) × 0.5    — Cửu 1.0 ... Tiên 5.5
  hệ_số chất: Hoang 1 × Huyền 2 × Địa 4 × Thiên 8 × Tiên 16 (×2/chất, khớp tinh thần lượt rèn ×2)
  ```

### 5.7 Gate phẩm (T2.5 — móc trong rework này)
- `canUseItem(item, playerRealm)`: `PROFESSION_GRADE_BY_REALM[playerRealm] === item.grade` — ngang phẩm mới dùng
- Áp: mặc trang bị + dùng vật phẩm tiêu dùng (đan dược — kiểm tra trong plan; scope tối thiểu: trang bị)
- Đột phá đại cảnh giới: **tháo toàn bộ trang bị** trước khi vào (hook breakthrough flow — 1 task riêng trong plan)
- UI: item sai phẩm hiện nhãn "Yêu cầu: X Phẩm (Cảnh Giới Y)" + nút mặc bị khóa, giải thích lý do

### 5.8 Màu & hiển thị
- Thang màu rank mở 10: thêm `--rank-color-10` (bậc 10 = gradient 7 sắc — nâng cấp `rank-gradient-9` hiện có thành 10)
- `professionGradeRank` bỏ clamp 9 → 1:1 tới 10
- `equipmentQualityRank` 9 bậc → 5 chất 1:1 (dải màu chất riêng biệt với phẩm — 2 dải không trùng色 tránh nhầm)
- Xóa `--grade-hoang..tien` + `--eq-quality-*` (0 consumer — kiểm chứng)
- `composeItemGradeNameSegments` (ItemGrade.ts:21) đổi `--grade-${grade}` → rank qua mapping chất
- Rename display: `ITEM_GRADE_LABELS` "Hoàng Phẩm…Tiên Phẩm" → **"Hoàng Chất…Tiên Chất"**; mọi locale/tooltip/dropdown đổi theo ("Mọi phẩm (Ngũ Phẩm)" → "Mọi chất (Ngũ Chất)")
- Type rename: `ItemGrade`→`ItemQuality`, `EQUIPMENT_RARITY_*`→`ITEM_QUALITY_*`, `EquipmentRarity` xóa (alias ItemGrade cũ)

## 6. Kiến trúc & ranh giới hệ thống

- **StatCalculator pipeline bất động** — rework này không đụng cách tính stat (Added/Increased/More giữ). Trang bị vẫn bơm modifier qua `applyModifiers()`
- **Nguồn stat hợp pháp** (note đã khóa trước): Tâm Pháp/Trang bị/Buff — item schema đổi không thêm nguồn thứ 4
- **ProductionSystem tái dùng** cho tab Phân Giải (site mới loại decompose) — không invent tick engine mới; khớp nguyên tắc cân bằng 6F
- **Save:** schema mới `grade`/`quality`/`forgeUses*` — **không migration** (dev phase, AGENTS.md). Item cũ trong save (`realmId`/`rarity`/`forgePoints`): shape validation từ chối item không hợp lệ → toast "vật phẩm dữ liệu cũ đã bị loại bỏ" — ghi chú trong plan để discard sạch
- **Enemy không đổi:** enemy stats riêng (`Enemies.ts` dùng stats trực tiếp, không item) — kiểm chứng trong plan bằng grep

## 7. Testing (13 contract)

1. **Drop chất:** 1000 rolls — phân phối khớp 75/15/8/1.99/0.01 (bin tolerance ±2%); `ITEM_QUALITY_DROP_WEIGHT` tổng = 100 chính xác
2. **Drop phẩm:** grade luôn = `PROFESSION_GRADE_BY_REALM[realm]` (deterministic, mọi realm)
3. **Substats:** 1000 items/chất — count ∈ [0, N] hợp lệ, mọi giá trị xuất hiện; ≤ GLOBAL_MAX_AFFIXES=8
4. **Lượt rèn:** total đúng bảng 5/10/20/40/80; tẩy/tinh mỗi lần -1 (ngân sách chung); 0 → chặn cả 2 hành động
4a. **Cường hóa slot:** tỉ lệ L1..L100 đúng `max(1%, round(100×0.956^(L-1)))`; fail → streak+1 + mất nguyên liệu, KHÔNG rơi cấp; pity streak 10 → thành công chắc chắn + reset; thành công thường → reset; slot cấp GIỮ khi tháo/đổi item; item mặc vào slot được khuếch đại theo cấp slot
5. **Tẩy:** random lại count trong khoảng + stat/tier/value mới; mainStat KHÔNG đổi; có thể ít dòng hơn trước
6. **Tinh:** 1000 lần — chỉ TĂNG; mức tăng từng dòng ∈ [5%, 20%] độc lập; clamp tier; dòng khóa không bị chọn
7. **Phân Giải:** output = base(phẩm) × hệ_số(chất) × nhân_công đúng bảng; lọc phẩm/chất hoạt động; cycle qua ProductionSystem
8. **Gate:** phẩm cao/thấp chặn 2 chiều; ngang cho qua; đột phá tháo toàn bộ trang bị
9. **Hóa Luyện:** output `luyen_khi_tinh_hoa` lượng theo chất range cũ; auto-dissolve giữ hành vi
10. **Chết sạch:** grep 0 tham chiếu `realmId`/`rarity`/`forgePoints`/`forgePotential` trên instance; 0 `tinh_hoa_pham_khi..thien_dia` (trừ `tinh_hoa_pham_the` Luyện Thể); 0 `FORGE_PERCENT_PER_POINT`; 0 `--grade-`/`--eq-quality-` trong css; 0 "Phẩm" trong label chất; 0 `ENHANCE_PERCENT_PER_LEVEL` cũ + 0 `DEFAULT_MAX_ENHANCE_LEVEL = 10` (thay bằng 100 slot levels)
11. **Cân bằng 6F:** vitest simulation — mỗi cặp khoáng→tinh_hoa→hành động: tốc độ sản xuất ≤ tiêu thụ trên 1 nhân công, cùng phẩm cùng chất
12. **E2E:** boot → tạo nhân vật → chiến đấu → item rơi hiển thị đúng phẩm/chất → Khí Đường 5 tab hoạt động (ink-wash-ui suite không vỡ)
13. **Parity vi/en** mọi key mới

## 8. Phạm vi file

**Core — xóa:** `EquipmentQuality.ts` (toàn file), bảng `EQUIPMENT_QUALITY_REALM_WEIGHTS`, `FORGE_PERCENT_PER_POINT`, `REFINE_VALUE_VARIANCE`, `WASH_LINE_COUNT_WEIGHTS`/`WASH_TIER_WEIGHTS` (OreQuality), `WASH_ORE_AMOUNT`, `EQUIPMENT_REALM_ESSENCE_MATERIAL` + `ESSENCE_TIER_NAMES`, `--grade-*`/`--eq-quality-*` (css)
**Core — sửa lớn:** `ItemGrade.ts` (→ ItemQuality: union giữ 5 giá trị, labels "Chất", bảng cân bằng mới), `EquipmentInstance.ts` (schema §2), `EquipmentSystem.ts` (drop/wash/refine/forge §5, cost getWashCost bỏ ore), `RefinementBalance.ts` (cost tinh hoa theo chất, essence→luyen_khi_tinh_hoa, tier weights mới), `EquipmentOperationCostCatalog.ts` (tra grade), `EquipmentStatPolicy.ts` (pool theo chất), `EquipmentBag.ts` (auto-dissolve output)
**Mới:** tab Phân Giải component + settings + ProductionSystem site loại decompose; `canUseItem` (+hook đột phá tháo đồ); material `luyen_khi_tinh_hoa`
**Hiển thị:** theme.css (+4 themes), labels.ts, normalizeSlotRank.ts, EquipmentNaming.ts, useEquipmentTooltip.ts, EquipmentHallPanel.vue (5 tabs — tách component nếu quá lớn), SlotView, MaterialBagSection (essence hiển thị), vi/en.json
**Slot enhance:** `EquipmentSlotState.ts` (enhanceLevel 1..100 + enhanceFailStreak, pity logic), EquipmentSystem (roll success/fail, scale áp item trong slot), cost catalog cường hóa theo slot-level
**Data:** materials.ts (thêm/xóa), affixes.ts (nếu tham chiếu quality cũ — grep trong plan)
**Save:** saveShapeValidation.ts (schema mới + discard item cũ)
**Không đổi:** Enemies.ts, StatCalculator pipeline, tinh_hoa_pham_the (Luyện Thể), KiemY

## 9. Ngoài phạm vi (defer rõ ràng)

- `getKiemYDamageMultipliers` rename (note session trước)
- Vendor UI redesign 6G (gate phẩm đã sẵn — UI làm sau)
- Chu kỳ Độ Kiếp 6H
- Linh thảo/linh mộc production rework 6C/6E (trục chất materials gộp chung khi làm production)
- E2E visual regression đầy đủ (chỉ smoke ink-wash-ui)

## 10. Rủi ro & thứ tự giảm rủi ro (input cho plan)

1. **Phasing:** Core schema → drop → 3 hành động → tab Phân Giải → gate → UI màu/label — mỗi phase verify độc lập (spec này lớn, plan phải chia task nhỏ có TDD từng task)
2. **Balance data dependency:** bảng hệ số Phân Giải + tier weights wash phụ thuộc 6F — plan viết số khởi điểm + test cân bằng, đánh dấu "tuning sau playtest"
3. **EquipmentHallPanel 1806 dòng** — thêm tab 5 cần tách component ngay từ đầu task UI
4. **Dead references:** 3 trục cũ dính ~20 file — plan phải có task "dọn chết sạch" (test contract #10) trước khi считать hoàn thành
5. **Item cũ trong save:** validation reject path cần test riêng (không crash, discard có thông báo)
