# Economy Ecosystem Plan — Audit & Sửa chữa

> **TRẠNG THÁI 2026-08-28: HOÀN THÀNH (8/9 + T7 bị bỏ).** ✅ T1, T2, T3, T4, T5, T6, T8, T9. ⛔ **T7 Chọn Thảo BỎ** — quyết định 2026-08-28: linh thảo giữ **hoàn toàn random** (ProductionSystem roll identity đều rồi roll niên đại theo weight, 2 bước), không thêm cơ chế chọn thảo. Riêng T6 đổi cách tiếp cận: thay vì giữ drop + recipe 5:1, đã migrate drop `xich_dong`/`huyen_thiet` → `qi_refining_ore_hoang`, xóa 11 material legacy, thêm drop-sink invariant test. Ngoài plan: đã thêm quy đổi cảnh giới linh mộc/khoáng 10:1 (`MaterialTierConversionBalance`).

> Ngày lập: 2026-08-28. Thuộc Phase 0 của [roadmap.md](./roadmap.md).
> Plan này **gộp và thay thế Phần A** của [economy-fixes-sinks-plan.md](./economy-fixes-sinks-plan.md) (A1–A5), bổ sung các vấn đề mới phát hiện khi audit hệ sinh thái 2026-08-28. Phần B (sink/vendor/UX hậu kỳ) vẫn nằm trong plan cũ, thuộc Phase 3.
> Liên quan: [truc-co-kim-dan-content-plan.md](./truc-co-kim-dan-content-plan.md), [progression-depth-plan.md](./progression-depth-plan.md), [docs-sync-audit-plan.md](./docs-sync-audit-plan.md).

## 1. Audit hiện trạng

### 1.1 Production (`src/core/production/`)

- 3 loại slot sản xuất chính: Linh Thảo Viên (Động Thiên), Luyện Khí, Điều Phối Nhân Công (worker).
- Worker: thuê bằng Linh Thạch, có thời hạn; `workerCycles` được xử lý trong loop online.
- **Bug**: `ProductionSystem.settleOffline()` KHÔNG xử lý `workerCycles` — worker mất sản lượng khi offline, trong khi slot tay vẫn chạy.
- Auto-restart slot: đang bám theo realm đã chọn tại thời điểm cấu hình, không bám realm hiện tại của nhân vật.
- Cap offline 10h: `PRODUCTION_OFFLINE_CAP_SECONDS` (`ProductionBalance.ts:115`).

### 1.2 Buildings (`src/core/building/`, `src/data/building/`)

- 5 buildings: Linh Tuyền, Luyện Khí Thất, Đan Phòng, Tàng Kinh Các, Trận Pháp.
- **Bug**: Linh Tuyền capacity `Math.pow(100, level)` (`BuildingSystem.ts:219`) — hàm mũ vô nghĩa ở cấp cao.
- **Bug**: hằng số offline cap trùng: `OFFLINE_PRODUCTION_CAP_SECONDS` (`BuildingSystem.ts:35`) trùng giá trị với `PRODUCTION_OFFLINE_CAP_SECONDS` (`ProductionBalance.ts:115`).
- **Bug**: Đan Phòng max level 9 nhưng bảng speed/success trong `AlchemySystem.ts` chỉ có 5 entry — level 6–9 rơi khỏi bảng.

### 1.3 Kinh tế — Linh Thạch

- Nguồn: quái rơi, Linh Tuyền (vô hạn theo thời gian), quest. Sink: Tẩy Luyện 100/lần, Tinh Luyện 50/unit, luyện đan, thuê worker — đều phẳng.
- **Bug**: Tẩy Luyện/Tinh Luyện hard-code `SPIRIT_STONE_MATERIAL_ID` (Hạ Phẩm) trong `EquipmentSystem.ts`, không resolve theo realm — sai khi nội dung realm cao vào.
- 3 phẩm Linh Thạch đã khai báo trong `SpiritStoneMaterial.ts` (Hạ/Trung/Thượng) nhưng chưa có luồng quy đổi, chưa có sink dùng phẩm cao.
- Comment trong `SpiritStoneMaterial.ts` dự trù đột phá muộn cần hàng tỷ → lạm phát hậu kỳ chắc chắn nếu không có sink hàm mũ (Phần B, Phase 3).

### 1.4 Kinh tế — vật liệu

- Mapping Tinh Hoa chỉ phủ 3 realm (`RefinementBalance.ts:74-81`); realm 4+ fallback im lặng về `tinh_hoa_pham_khi`.
- Drop chết: `xich_dong` (~14 nguồn rơi), `huyen_thiet` (4 nguồn) gần như không có sink. Material mồ côi không nguồn rơi, không sink: `thanh-dong`, `han-thiet`, `hoang_kim_linh_thiet`, `quang_sat`, `thanh_linh_moc`, `phu_chi`, `tinh_ngan`.
- Nghẽn linh thảo: Động Thiên ra 1 thảo/cycle, roll đều 1/8 họ, recipe cần 2–3 thảo cùng họ → ~16–24 cycle mới đủ 1 mẻ đan cấp thấp; không có cơ chế chọn thảo.
- Điểm Rèn không có nguồn hồi sau rework 2026-08-26 (thuộc Phần B, Phase 3).

### 1.5 Tổng hợp vấn đề theo thứ tự ưu tiên

| # | Vấn đề | Mức | Task |
|---|--------|-----|------|
| 1 | Mapping Tinh Hoa realm 4+ sai, fallback im lặng | Cao | T1 |
| 2 | Sink Linh Thạch hard-code Hạ Phẩm; 3 phẩm chưa có luồng dùng/quy đổi | Cao | T2 |
| 3 | Worker không chạy offline | Cao | T3 |
| 4 | Auto-restart bám realm đã chọn thay vì realm hiện tại | Trung bình | T4 |
| 5 | Đan Phòng level 6–9 không có bảng speed/success | Cao | T5 |
| 6 | Drop chết + material mồ côi | Cao | T6 |
| 7 | Nghẽn linh thảo luyện đan cấp thấp | Cao | T7 |
| 8 | Curve Linh Tuyền vô nghĩa + trùng hằng số offline cap | Trung bình | T8 |
| 9 | Docs lệch code (item-design-reference) | Trung bình | T9 |

## 2. Quyết định đã chốt (2026-08-28)

1. **Worker offline (T3)**: worker chạy offline như slot tay, giữ cap 10h.
2. **Linh Thạch phẩm (T2)**: thêm quy đổi **1 chiều lên** `100 Hạ → 1 Trung`, `100 Trung → 1 Thượng`; mọi sink resolve phẩm nhất quán theo realm. Không có quy đổi ngược (giữ sink).
3. **Auto-restart (T4)**: dùng realm hiện tại của nhân vật, không lưu realm đã chọn; UI ghi rõ hành vi này.

## 3. Giai đoạn 0 — Sửa lỗi ngay (9 task)

### T1: Mapping Tinh Hoa đủ 9 realm ✅ *(= A1 cũ)*

- File: `src/core/equipment/RefinementBalance.ts`.
- Thêm entry cho mọi realm trong `EQUIPMENT_REALM_ESSENCE_MATERIAL` theo đúng material đã khai báo trong `materials.ts` (realm 4+: phối hợp truc-co-kim-dan-content-plan để thống nhất id).
- Đổi fallback: ném lỗi dev-visible (hoặc trả `undefined` + guard ở caller từ chối thao tác) khi gặp realm chưa map. Im lặng là nguyên nhân bug.
- Test: unit test từng realm id; test Hóa Luyện item realm cao trả đúng essence.

### T2: Linh Thạch phẩm theo realm + quy đổi 1 chiều ✅ *(mới)*

- File: `src/core/equipment/EquipmentSystem.ts`, `src/core/material/SpiritStoneMaterial.ts`, `src/core/game/GameManager.ts`, UI panel Linh Thạch.
- Tẩy Luyện/Tinh Luyện resolve phẩm bằng `resolveSpiritStoneByRealm(tier)` thay vì hard-code `SPIRIT_STONE_MATERIAL_ID`.
- Reward receiver (GameManager) cấp Linh Thạch đúng phẩm theo realm tier của nguồn phát.
- Thêm quy đổi 1 chiều lên: `100 Hạ → 1 Trung`, `100 Trung → 1 Thượng` (giao dịch atomic, test chống nhân bản).
- UI: nút quy đổi trong panel Linh Thạch, hiển thị tỷ lệ.

### T3: Worker chạy offline ✅ *(mới)*

- File: `src/core/production/ProductionSystem.ts`.
- `settleOffline()` xử lý `workerCycles` cùng logic với slot tay (cùng rate, cùng cap 10h).
- Test: worker offline output = online output với cùng khoảng thời gian (trong cap); hết cap không phát thêm.

### T4: Auto-restart dùng realm hiện tại ✅ *(mới)*

- File: `src/core/production/ProductionSystem.ts`, `src/components/panels/ProductionPanel.vue`.
- Khi auto-restart, đọc `character.realm` tại thời điểm restart; bỏ lưu realm đã chọn trong cấu hình slot.
- UI: thêm note "Tự động dùng cảnh giới hiện tại của nhân vật".

### T5: Đan Phòng level 6–9 ✅ *(mới)*

- File: `src/core/alchemy/AlchemySystem.ts` (+ file balance nếu có).
- Nối dài bảng speed/success đủ 9 level; level cao hơn = nhanh hơn, success cao hơn (baseline chỉnh theo playtest).
- Test: mọi level 1–9 có entry; không còn truy cập ngoài mảng.

### T6: Drop chết & material mồ côi ✅ *(= A2 cũ — đổi cách tiếp cận)*

> **Đã thực hiện 2026-08-28 (khác thiết kế gốc):** thay vì giữ drop + thêm recipe quy đổi 5:1 tại Lò Luyện, đã (1) migrate MỌI drop `xich_dong`/`huyen_thiet` trong `Enemies.ts` + `Tribulations.ts` → `qi_refining_ore_hoang` (giữ amount/chance), (2) đổi quest `collect_huyen_thiet_1` → `collect_qi_refining_ore_hoang_1`, (3) xóa 11 material legacy (4 linh mộc + 7 linh khoáng) sau khi grep xác nhận không tham chiếu runtime, (4) thêm `EnemyDropSinkInvariant.test.ts` (mọi material drop phải có sink hoặc thuộc lore allowlist), (5) xóa luôn `OreConversionBalance.ts` + `convertOre` vì không còn cần bridge.

- File: `src/data/materials/materials.ts`, `src/data/enemy/Enemies.ts`, `src/data/.../Tribulations.ts`, recipe Lò Luyện.
- Giữ drop `xich_dong`/`huyen_thiet` ở quái Phàm Nhân/Luyện Khí (quest hiện tại vẫn cần); thêm recipe quy đổi tại Lò Luyện: `5 xich_dong/huyen_thiet → 1 nguyên liệu đương đương` (tỷ lệ 5:1 baseline).
- Material mồ côi (`thanh-dong`, `han-thiet`, `hoang_kim_linh_thiet`, `quang_sat`, `thanh_linh_moc`, `phu_chi`, `tinh_ngan`): grep toàn bộ `src/` xác nhận không tham chiếu runtime rồi xóa; dọn tham chiếu (test fixture, comment) cùng lúc.
- Thêm invariant test: mọi material được drop phải có ít nhất 1 sink (recipe/cost/quest).

### T7: Chọn Thảo ⛔ BỎ (2026-08-28) *(= A3 cũ)*

> **QUYẾT ĐỊNH 2026-08-28: BỎ task này.** Linh thảo giữ **hoàn toàn random** — không thêm cơ chế trả Linh Thạch chọn họ thảo. Hiện trạng `ProductionSystem.ts` đã roll ngẫu nhiên (identity đều theo tier → niên đại theo `HERB_AGE_WEIGHTS`), giữ nguyên. Phần thiết kế bên dưới chỉ còn giá trị tham khảo lịch sử.

- File: `src/core/production/ProductionSystem.ts`, `ProductionBalance.ts`, UI Động Thiên.
- Cơ chế **Chọn Thảo**: trả Linh Thạch để chọn họ thảo cho cycle kế. Chi phí baseline 20 Linh Thạch, tăng 10% mỗi lần dùng liên tiếp cùng họ, reset khi đổi họ (chống spam rẻ). **Không thêm pity** — Chọn Thảo đã là van an toàn.
- Tăng `GROTTO_HERB_AMOUNT` từ 1 lên 2 cho Động Thiên cấp 3+.
- Giữ nguyên weight niên đại.
- Test: chi phí tăng theo chuỗi, reset khi đổi họ; yield theo cấp công trình.

### T8: Curve Linh Tuyền + gộp hằng số offline cap ✅ *(= A4 cũ)*

- File: `src/core/building/BuildingSystem.ts`, `src/core/production/ProductionBalance.ts`.
- Thay `Math.pow(100, level)` bằng curve hữu hạn, vd `1000 + 500 * (level - 1)` (baseline chỉnh theo playtest).
- Gộp về một hằng số duy nhất `PRODUCTION_OFFLINE_CAP_SECONDS` tại `ProductionBalance.ts`; `BuildingSystem.ts` import từ đó.
- Test: curve capacity; cap đồng nhất 1 nguồn.

### T9: Docs sync ✅ *(= A5 cũ)*

- Cập nhật `docs/item-design-reference.md` phần liên quan (phối hợp [docs-sync-audit-plan.md](./docs-sync-audit-plan.md)): phẩm Linh Thạch, quy đổi, Chọn Thảo, Điểm Rèn.

## 4. Giai đoạn 1 — Sink & UX hậu kỳ (Phase 3 roadmap)

Giữ nguyên theo **Phần B** của [economy-fixes-sinks-plan.md](./economy-fixes-sinks-plan.md):

- **B1**: Sink Linh Thạch hàm mũ cho gate đột phá + Tụ Linh Trận.
- **B2**: Vendor Hóa Bán (bảng giá data-driven, `VendorBalance.ts`).
- **B3**: Nạp Điểm Rèn bằng Tinh Hoa + Linh Thạch.
- **B4**: Filter/tìm kiếm túi, auto-dissolve EquipmentBag.

Không lặp lại thiết kế ở đây; plan cũ là nguồn sự thật cho Phần B.

## 5. Giai đoạn 2 — Nội dung Trúc Cơ/Kim Đan

Theo [truc-co-kim-dan-content-plan.md](./truc-co-kim-dan-content-plan.md):

- M1: nội dung Trúc Cơ thật.
- M2: gate Kim Đan — **cần T1 + T2 xong trước** (mapping Tinh Hoa + phẩm Linh Thạch theo realm).
- M3: realm passive + node — cần T1 + T2.
- M4: balance progression.

## 6. Kiểm chứng

Sau mỗi task, chạy từ `game/`:

```powershell
npm.cmd run test
npm.cmd run type-check
npm.cmd run build
```

- Unit test: mapping essence đủ realm; invariant drop-có-sink; chi phí Chọn Thảo; curve Linh Tuyền; quy đổi Linh Thạch atomic; worker offline = online trong cap.
- `EconomySimulation.test.ts` phải chạy lại sau mỗi thay đổi bảng balance.
- Thủ công: tạo save dev, luyện 1 mẻ đan cấp thấp trong < 10 phút với Chọn Thảo; túi không còn material mồ côi.

## 7. Rủi ro và lưu ý

- **Xóa nhầm material còn tham chiếu** (T6): bắt buộc grep toàn bộ `src/` trước khi xóa; test fixture (`EquipmentSystem.test.ts` dùng `huyen_thiet`) cập nhật cùng lúc.
- **Chọn Thảo làm luyện đan quá dễ** (T7): chi phí phải đủ đau ở cấp thấp.
- **Quy đổi phẩm tạo bypass sink** (T2): chỉ cho quy đổi lên, không có chiều ngược; chi phí Tẩy/Tinh Luyện tính bằng phẩm resolve theo realm.
- **Worker offline thay đổi thu nhập kỳ vọng** (T3): kiểm tra lại `EconomySimulation` sau khi bật.
- Dự án đang development phase: không cần migration save (theo AGENTS.md).
