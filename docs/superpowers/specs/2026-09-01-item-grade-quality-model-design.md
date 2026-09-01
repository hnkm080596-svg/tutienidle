# Item Grade/Quality Model — Design Spec

**Ngày:** 2026-09-01
**Phạm vi:** Tái cấu trúc trục phẩm/chất trên item + mở đường cho gate phẩm (T2.5), Vendor thu mua (6G), chu kỳ Độ Kiếp (6H). Thay thế và mở rộng T2.4 trong roadmap.
**Roadmap:** `docs/ROADMAP.md` — mục 6D (bảng phẩm ↔ cảnh giới), T2.4/T2.5/T2.7 gộp thành thiết kế này.

---

## 1. Terminology chuẩn (nguồn sự thật duy nhất)

| Thuật ngữ | Thuộc về | Số bậc | Định nghĩa |
|---|---|---|---|
| **Cảnh giới (realm)** | **Nhân vật** | 10 (Phàm Nhân → Độ Kiếp) | Tiến trình của người chơi |
| **Phẩm (grade)** | **Item** | 10 (Cửu Phẩm → Tiên Phẩm) | **Trùng 1:1 với realm** — item sinh ra khi nhân vật ở realm R thì phẩm = bậc tương ứng R. Realm KHÔNG phải thuộc tính của item; nó là đầu vào của randomizer chọn phẩm |
| **Chất (quality)** | Item | 5 (Hoang → Tiên) | Trục random duy nhất, điều khiển substats/affix |

Phẩm ↔ cảnh giới (bảng chuẩn 10:10):

| Phẩm | Cảnh giới |
|---|---|
| Cửu Phẩm | Phàm Nhân |
| Bát Phẩm | Luyện Khí |
| Thất Phẩm | Trúc Cơ |
| Lục Phẩm | Kim Đan |
| Ngũ Phẩm | Nguyên Anh |
| Tứ Phẩm | Hóa Thần |
| Tam Phẩm | Luyện Hư |
| Nhị Phẩm | Hợp Thể |
| Nhất Phẩm | Đại Thừa |
| Tiên Phẩm | Độ Kiếp |

⚠️ **Xung đột dữ liệu đã xử lý:** "Tiên" xuất hiện cả trong phẩm (Tiên Phẩm — bậc 10) lẫn chất (Tiên Chất — bậc 5). Hai trường riêng biệt `grade` và `quality`; UI luôn ghi rõ nhãn "Phẩm: Tiên Phẩm" ≠ "Chất: Tiên Chất".

## 2. Schema item sau cùng

```ts
// EquipmentInstance — thay đổi
grade: ProfessionGrade        // MỚI — thay thế realmId (10 bậc, union có sẵn cuu_pham..tien_pham)
realmLevel: number            // GIỮ — globalLevel scale cần (grade suy ra được realmId, realmLevel thì không)
quality: ItemQuality          // ĐỔI NGHĨA — từ 9 bậc Khí thành 5 chất (union hoang..tien)
forgeUsesTotal: number        // MỚI — số lần rèn cố định theo chất (5/10/20/40/80)
forgeUsesRemaining: number    // MỚI — thay forgePoints/forgePotential
affixes: RolledAffix[]        // giữ — số dòng giờ random 0..N theo chất

// XÓA HẲN
realmId: string               // thay bằng grade
rarity: EquipmentRarity       // vai trò chuyển hết cho quality 5 chất
forgePoints: number           // thay bằng forgeUses*
forgePotential: number        // xóa (luôn 100, ý nghĩa cũ mất)
// trục 9 bậc Khí (EquipmentQuality cũ) + 4 bảng cân bằng của nó
// FORGE_PERCENT_PER_POINT
```

## 3. Bảng phân vai — Phẩm điều khiển gì, Chất điều khiển gì

| # | Cơ chế | Thuộc | Giá trị |
|---|---|---|---|
| 1 | Scale mainStat theo tiến trình | **Phẩm** | giữ cơ chế: `× (1 + globalLevel(grade→realm, realmLevel) × 0.05)` |
| 2 | Số dòng affix (substats) lúc tạo item | **Chất** | **RANDOM khoảng**: Hoang 0–1, Huyền 0–2, Địa 0–3, Thiên 0–4, Tiên 0–5 (roll số dòng trong khoảng; mỗi dòng 50/50 prefix/suffix; không còn slot cố định theo chất) |
| 3 | Trần tier affix | **Chất** | mỗi chất +1 tier: Hoang T1 → Huyền T2 → Địa T3 → Thiên T4 → Tiên T5 |
| 4 | Pool affix mở | **Chất** | Hoang basic; Huyền +advanced; Địa +specialized; Thiên +supreme; Tiên all |
| 5 | **Điểm Rèn** = số LẦN rèn cố định | **Chất** | Hoang 5, Huyền 10, Địa 20, Thiên 40, Tiên 80 (**×2 mỗi chất**). Chi phí mỗi lần = 1 (fixed); nguyên liệu khác không đổi. Bỏ `FORGE_PERCENT_PER_POINT` — mỗi lần rèn không cộng % scale nữa, chỉ tốn lượt |
| 6 | Implicit multiplier lúc roll mainStat | **Chất** | 1.00 / 1.15 / 1.30 / 1.50 / 1.75 |
| 7 | Chi phí cường hóa/tẩy/tinh | **Phẩm** | CostCatalog tra qua grade→realm (chi phí Điểm Rèn là 1/lần — xem #5; chỉ chi phí nguyên liệu/khác theo phẩm) |
| 8 | Ore Tẩy Luyện cùng bậc | **Phẩm** | quặng phải cùng phẩm với item (grade→realm prefix) |
| 9 | Tinh Hoa hóa luyện — loại | **Phẩm** | essence của realm tương ứng (grade→realm) |
| 10 | Tinh Hoa hóa luyện — lượng | **Chất** | giữ range hiện: 1-3 / 2-4 / 3-5 / 4-6 / 5-7 |
| 11 | Weight random chất lúc drop | **Chất** | **CỐ ĐỊNH mọi phẩm: 75 / 15 / 8 / 1.99 / 0.01** |
| 11a | **Tẩy Luyện (wash)** — mục đích | **Chất** | Random lại TOÀN BỘ: số dòng substat (trong khoảng 0–N của chất) + dòng nào + giá trị. Mục đích: **ra nhiều dòng, dòng đúng yêu cầu**. Số dòng mới cũng random trong khoảng — tẩy có thể ra ít dòng hơn trước |
| 11b | **Tinh Luyện (refine)** — mục đích | **Chất** | **CHẮC CHẮN tăng chất lượng dòng, không bao giờ giảm** (bỏ cơ chế cộng/trừ `REFINE_VALUE_VARIANCE` hiện tại). Mức tăng random hoàn toàn: **+5% đến +20%** giá trị dòng (balance sau bằng playtest). Mỗi lần tinh: random chọn dòng + random mức tăng trong [5%, 20%] |
| 12 | Gate mặc đồ | **Phẩm** | MỚI (T2.5): `canUseItem` — ngang phẩm mới dùng, chặn 2 chiều; đột phá tháo toàn bộ |
| 13 | Vendor thu mua | **Phẩm** | MỚI (6G): chỉ mua phẩm thấp hơn realm hiện tại |
| 14 | Chu kỳ Độ Kiếp | **Phẩm** | MỚI (6H): item chu kỳ cũ vô dụng sau Độ Kiếp |
| 15 | Màu + label hiển thị | Phẩm + Chất | Phẩm: rank 1–10 (`--rank-color-1..10`, mở color-10, bậc 10 gradient 7 sắc) • Chất: dải 5 màu riêng • 1 đường duy nhất, xóa biến chết `--grade-*`, `--eq-quality-*` |

### Cơ chế rèn/tẩy/tinh — thiết kế chi tiết (thay thế 3 bảng cân bằng cũ)

**Bảng cân bằng mới (5 chất):**

| Chất | Substats (random) | Lượt rèn | Tier trần | Pools | Implicit |
|---|---|---|---|---|---|
| Hoang | 0–1 | 5 | T1 | basic | 1.00 |
| Huyền | 0–2 | 10 | T2 | +advanced | 1.15 |
| Địa | 0–3 | 20 | T3 | +specialized | 1.30 |
| Thiên | 0–4 | 40 | T4 | +supreme | 1.50 |
| Tiên | 0–5 | 80 | T5 | all | 1.75 |

**Điểm Rèn (rework):**
- `forgeUsesTotal: number` (không random — cố định theo chất bảng trên), `forgeUsesRemaining` giảm 1 mỗi lần rèn
- Chi phí mỗi lượt: 1 Điểm Rèn + nguyên liệu theo cơ chế hiện tại (không đổi)
- **Bỏ:** `FORGE_PERCENT_PER_POINT`, `forgePoints`/`forgePotential` trần theo chất, `calculateEquipmentScale` phần forge (chỉ còn `1 + enhanceLevel × ENHANCE_PERCENT_PER_LEVEL`)
- Hiệu quả rèn: giữ nguyên cơ chế hiện tại của "rèn" nếu nó không phải +% scale (xem plan — hiện `FORGE_PERCENT_PER_POINT` là nguồn +% nên khi bỏ, scale trang bị = enhanceLevel + implicit chất + globalLevel phẩm)

**Tẩy Luyện (wash):**
- Giữ: yêu cầu chọn trang bị + quặng cùng phẩm (#8), chi phí nguyên liệu
- Đổi: kết quả random toàn bộ substats — số dòng (0–N chất) + stat nào + tier trong trần + giá trị roll
- Mục đích người chơi: **tìm nhiều dòng + dòng đúng stat cần**

**Tinh Luyện (refine):**
- Đổi từ cơ chế hiện tại (random ±20% `REFINE_VALUE_VARIANCE` có thể GIẢM giá trị): thành **chỉ tăng**
- Mỗi lần: chọn random 1 dòng hiện có → tăng giá trị `+U(5%, 20%)` (uniform random trong khoảng), clamp trong tier range
- Bỏ `REFINE_VALUE_VARIANCE`; giữ `REFINE_MAX_LOCKS` (khóa dòng khi tinh — xem plan có giữ không)
- Balance sau bằng playtest (khoảng 5–20% có thể điều chỉnh)

## 4. Thay đổi chi tiết

### 4.1 Drop pipeline (`EquipmentSystem.createInstance`)

```
cũ: quality = rollQuality(player.realmId)   // weights 10×9
    rarity  = rollRarity()                   // weights toàn cục

mới: grade   = PROFESSION_GRADE_BY_REALM[player.realmId]  // deterministic, không random
     quality = weightedRandom(5 chất, 75/15/8/1.99/0.01)   // trục random duy nhất
```

- `rollQuality` cũ (weights theo realm) **xóa** — bảng `EQUIPMENT_QUALITY_REALM_WEIGHTS` 10×9 xóa
- `rollRarity` cũ **xóa** — thay bằng `rollQuality` mới với weight cố định
- `weightedRandom` hiện tại dùng float trực tiếp — 1.99/0.01 hoạt động không cần đổi

### 4.2 Rename trục chất

- `ItemGrade` (type hoang..tien) → rename **`ItemQuality`** (chất); `EQUIPMENT_RARITY_*` → `ITEM_QUALITY_*` (`EQUIPMENT_RARITY_DROP_WEIGHT` → `ITEM_QUALITY_DROP_WEIGHT` = 75/15/8/1.99/0.01; `EQUIPMENT_RARITY_AFFIX_SLOTS` → `ITEM_QUALITY_AFFIX_SLOTS`)
- `ITEM_GRADE_LABELS` "Hoàng Phẩm…Tiên Phẩm" → **"Hoàng Chất…Tiên Chất"**
- `EquipmentRarity` (alias của ItemGrade) xóa; `instance.rarity` → `instance.quality`
- `EquipmentQuality` (9 bậc Khí) **xóa toàn file** — 4 bảng (MAX_AFFIX_TIER, MAX_FORGE_POINTS, IMPLICIT_MULTIPLIER, UNLOCKED_POOLS) re-fit thành bản 5 chất tại `ItemQuality`
- Chữ "Phẩm" rời khỏi mọi trục chất (label, locale, tooltip, dropdown Hóa Luyện "Mọi phẩm (Ngũ Phẩm)" → "Mọi chất")

### 4.3 Grade trên item

- `grade: ProfessionGrade` — dùng union + `PROFESSION_GRADE_BY_REALM` có sẵn (1 nguồn sự thật, không tạo union song song)
- `getGlobalCultivationLevel(instance.realmId, instance.realmLevel)` → `getGlobalCultivationLevel(realmFromGrade(instance.grade), instance.realmLevel)`
- Ore/essence/cost tra qua `realmFromGrade(instance.grade)`
- Save: item mới lưu `grade`; item cũ (có realmId, không grade) — **dev build, không migration** (AGENTS.md Development Phase)

### 4.4 Màu & hiển thị

- Thang rank màu mở 10: thêm `--rank-color-10` (bậc 10 = gradient 7 sắc, nâng cấp từ `rank-gradient-9` hiện có)
- `professionGradeRank` bỏ clamp (1:1 tới 10)
- Xóa `--grade-hoang…tien` + `--eq-quality-*` (biến chết 0 consumer)
- `composeItemGradeNameSegments` đổi màu qua rank; segment chất (NameSegment.tone 'hoang'…) qua dải 5 màu chất

### 4.5 Gate T2.5 (móc trong spec này, implement theo plan)

- `canUseItem(item, playerRealm)`: `PROFESSION_GRADE_BY_REALM[playerRealm] === item.grade` — ngang phẩm mới dùng
- Áp: trang bị (mặc) + vật phẩm tiêu dùng
- Đột phá đại cảnh giới: tháo toàn bộ trang bị trước khi vào

## 5. Cân bằng — ảnh hưởng đã duyệt

- **Weight chất cố định 75/15/8/1.99/0.01:** động lực farm realm cao đến từ phẩm (scale + giá trị phân giải + gate), không từ chất. Tiên Chất 0.01% ≈ 1/10,000 đồ — reward "tứng". Nếu playtest thấy quá hiếm, đổi 1 hằng số (test khóa tổng = 100).
- **Substats random 0–N:** đồ Hoang có thể 0 dòng (75% chất thấp + 0 dòng có thể = "đá"); Tiên tối đa 5 dòng luôn. Mọi lượt tẩy random lại cả số dòng → có thể tệ hơn trước (đánh đổi có chủ ý).
- **Lượt rèn ×2 mỗi chất (5→80):** Tiên tổng tiềm năng rèn gấp 16× Hoang; mỗi lượt cost 1 + nguyên liệu theo hiện tại → tổng đầu tư theo chất tăng mạnh, đúng nghĩa chất = tiềm năng.
- **Tinh Luyện chỉ tăng (+5%→+20%/lần):** bỏ rủi ro giảm của cơ chế ±20% cũ — Tinh Luyện giờ luôn đầu tư lãi (dòng nào được tăng + bao nhiêu vẫn random). Chờ playtest cân bằng lại khoảng tăng.
- **Bỏ FORGE_PERCENT_PER_POINT:** scale trang bị giờ = enhanceLevel + implicit chất + globalLevel phẩm — 3 nguồn rõ ràng, không còn nguồn +% thứ 4.
- **Đồ chất thấp của phẩm cao vẫn rơi 93%** (75+15+8) — nguyên liệu phân giải như triết lý cũ, chuyển từ "bậc thấp" sang "chất thấp".

## 6. Testing (contract)

1. Drop: 1000 lần roll — phân phối chất khớp weight (bin tolerance); grade luôn = `PROFESSION_GRADE_BY_REALM[realm]` (deterministic)
2. `ITEM_QUALITY_DROP_WEIGHT` tổng = 100 chính xác (75+15+8+1.99+0.01)
3. Substats: roll 1000 items mỗi chất — số dòng luôn trong khoảng [0, N], mọi giá trị khoảng đều xuất hiện; không vượt GLOBAL_MAX_AFFIXES
4. Lượt rèn: `forgeUsesTotal` đúng bảng (5/10/20/40/80); mỗi lần rèn `forgeUsesRemaining` -1; hết lượt thì chặn; chi phí 1 lượt + nguyên liệu đúng
5. Tẩy Luyện: kết quả random số dòng mới trong khoảng chất + stat/tier/value roll lại; giữ nguyên item khác substats
6. Tinh Luyện: 1000 lần — giá trị dòng chỉ TĂNG; mức tăng ∈ [5%, 20%]; clamp trong tier range
7. Gate: item phẩm cao/thấp hơn realm đều chặn; ngang phẩm cho qua; đột phá tháo đồ
8. Không item nào còn field `realmId`/`rarity`/`forgePoints`/`forgePotential`; không còn "Phẩm" trong trục chất (grep label/locale)
9. theme.css không còn `--grade-*`/`--eq-quality-*`; `--rank-color-10` tồn tại; không còn `FORGE_PERCENT_PER_POINT`
10. Hóa Luyện: essence loại theo phẩm, lượng theo chất
11. Parity vi/en cho mọi key locale mới

## 7. Phạm vi file (ước lượng)

**Core (xóa/sửa lớn):** `EquipmentQuality.ts` (xóa), `ItemGrade.ts` (→ ItemQuality + label mới + bảng cân bằng 5 chất), `EquipmentRarity.ts` (xóa alias, merge vào ItemQuality; Exalted chuyển thành cơ chế "Tiên +1 roll" nếu giữ), `EquipmentInstance.ts` (schema + forgeUses*), `EquipmentSystem.ts` (drop pipeline + wash random toàn bộ + refine chỉ-tăng + bỏ FORGE_PERCENT), `RefinementBalance.ts` (WASH/REFINE cost theo chất mới, bỏ VARIANCE, giữ MAX_LOCKS), `EquipmentOperationCostCatalog.ts`, `EquipmentStatPolicy.ts` (substat pool theo chất mới), `EquipmentBag.ts` (auto-dissolve essence)
**Hiển thị:** `theme.css` (+4 theme files check), `labels.ts`, `normalizeSlotRank.ts`, `EquipmentNaming.ts`, `useEquipmentTooltip.ts`, `EquipmentHallPanel.vue` (+tests — 4 tab đều chạm), `SlotView` nếu cần
**Data:** `affixes.ts` (tier mapping nếu tham chiếu quality cũ), `Enemies.ts` không đổi (enemy stats riêng)
**Save:** `saveShapeValidation.ts` (item schema mới), không migration
**Mới:** `canUseItem` + bảng realm→phẩm lookup ngược đã có sẵn

## 8. Ngoài phạm vi

- Rename `getKiemYDamageMultipliers` (note session trước — việc riêng)
- Vendor redesign 6G (gate phẩm chỉ là 1 phần, UI/UX làm sau)
- Chu kỳ Độ Kiếp 6H
- Materials (nguyên liệu) — trục chất 5 đã thống nhất khái niệm, gộp data linh thảo/khoáng/mộc vào thang này là việc của production rework (6C/6E)
