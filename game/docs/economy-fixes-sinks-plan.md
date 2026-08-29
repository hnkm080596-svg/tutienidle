# Kế hoạch Sửa lỗi Kinh tế & Bổ sung Sink

> **Cập nhật 2026-08-28**: Phần A (A1–A5) đã được gộp và thay thế bởi economy-ecosystem-plan (Phase 0, hoàn thành — đã dọn file). File này chỉ còn là nguồn sự thật cho **Phần B** (B1–B4, Phase 3). Không thực hiện Phần A từ file này.

> Thuộc Phase 0 (phần Cao — sửa bug) và Phase 3 (phần Trung bình — sink/UX) của [roadmap.md](./roadmap.md). Plan chia 2 phần độc lập: **A. Sửa lỗi ngay** và **B. Cân bằng & UX**. Có thể thực hiện A trước, B sau.

## 1. Mục tiêu

- Sửa bug Tinh Hoa khi dissolve item realm 4+.
- Loại bỏ vòng drop chết (vật liệu legacy không còn sink).
- Giảm nút cổ thắt linh thảo ở luyện đan cấp thấp.
- Xây sink Linh Thạch hậu kỳ và van xả vật liệu thừa.
- Cải thiện UX túi đồ (~430 material không có filter).

## 2. Hiện trạng và vấn đề

### 2.1 Bug mapping Tinh Hoa (Cao)

- `EQUIPMENT_REALM_ESSENCE_MATERIAL` (`src/core/equipment/RefinementBalance.ts:74-81`) chỉ map 3 realm; fallback trả `'tinh_hoa_pham_khi'`. Item realm 4+ (Kim Đan trở lên) khi Hóa Luyện sẽ sinh sai tier Tinh Hoa, và Tinh Luyện realm cao kiểm tra sai nguyên liệu.
- Hiện tại realm 4+ chưa có nội dung (xem [truc-co-kim-dan-content-plan.md](./truc-co-kim-dan-content-plan.md)) nên bug chưa lộ ra runtime — sửa trước khi nội dung Kim Đan vào.

### 2.2 Drop chết và vật liệu mồ côi (Cao)

- `xich_dong` rơi từ ~14 chỗ trong `src/data/enemy/Enemies.ts` + 2 chỗ trong `Tribulations.ts`; `huyen_thiet` rơi từ 4 chỗ. Sink thật duy nhất: quest `collect_huyen_thiet_1` cần 3 cái (`src/data/quest/quests.ts:20`). Phần còn lại tích vô hạn.
- `thanh-dong`, `han-thiet`, `hoang_kim_linh_thiet` khai báo trong `src/data/materials/materials.ts:91-111` nhưng không nguồn rơi, không sink — mồ côi.
- `quang_sat`, `thanh_linh_moc`, `phu_chi`, `tinh_ngan` (materials.ts ~120-145) tình trạng tương tự.
- Cường Hóa chỉ chìm `ore_hoang`; quáng phẩm Huyền/Địa/Thiên/Tiên chỉ dùng cho Tẩy Luyện (3 viên/lần) → quáng phẩm cao dễ ứ đọng khi nội dung realm cao vào.

### 2.3 Nút cổ thắt linh thảo (Cao)

- Động Thiên ra 1 thảo/cycle (`GROTTO_HERB_AMOUNT = 1`, `ProductionBalance.ts:106`); họ thảo roll đều 1/8; recipe cần 2–3 thảo cùng họ → trung bình ~16–24 cycle (mỗi cycle nhiều phút) mới đủ 1 mẻ đan cấp thấp; chưa tính niên đại cao weight thấp hơn.
- Không có cơ chế chọn thảo/pity → luyện đan cấp thấp gần như không dùng được trong hàng giờ đầu.

### 2.4 Linh Thạch: nguồn vô hạn, sink phẳng (Trung bình)

- Nguồn: quái rơi, Linh Tuyền (vô hạn theo thời gian), quest. Sink: 100/lần Tẩy Luyện, 50/unit Tinh Luyện, luyện đan — đều phẳng.
- Comment trong `SpiritStoneMaterial.ts` dự trù đột phá muộn cần hàng tỷ → nếu không thêm sink hàm mũ, lạm phát hậu kỳ là chắc chắn.

### 2.5 Điểm Rèn không có nguồn hồi (Trung bình)

- Rework 2026-08-26 xóa regen Điểm Rèn; mỗi item chỉ ~2–5 lần Tẩy/Tinh rồi chết tiến bộ, chỉ thay bằng drop mới. Nếu playtest cho thấy quá harsh, cần cơ chế "nạp lại" bằng tài nguyên.

### 2.6 Bug nhỏ và trùng lặp (Trung bình)

- Linh Tuyền capacity `Math.pow(100, level)` (`BuildingSystem.ts:219`) — vô nghĩa ở cấp cao.
- Hai hằng số offline cap trùng giá trị 10h: `OFFLINE_PRODUCTION_CAP_SECONDS` (`BuildingSystem.ts:35`) và `PRODUCTION_OFFLINE_CAP_SECONDS` (`ProductionBalance.ts:115`).

### 2.7 UX túi đồ (Trung bình)

- ~430 material (288 biến thể thảo khác icon/tuổi, trùng tên hiển thị); chỉ có sort, không filter/tìm kiếm (`MaterialBagSection.vue`).
- EquipmentBag không giới hạn sức chứa, không auto-dissolve → tích trữ vô hạn.

## 3. Thiết kế

### 3.1 Phần A — Sửa lỗi ngay

**A1. Mapping Tinh Hoa:**
- Thêm entry cho mọi realm trong `EQUIPMENT_REALM_ESSENCE_MATERIAL` theo đúng material đã khai báo trong `materials.ts` (realm 4+: `kim_dan` trở lên — phối hợp với plan nội dung Kim Đan để thống nhất id).
- Đổi fallback: thay vì lặng lẽ trả `tinh_hoa_pham_khi`, hàm resolve phải ném lỗi dev-visible (hoặc trả `undefined` + guard ở caller từ chối thao tác) khi gặp realm chưa map. Im lặng là nguyên nhân bug.
- Test: unit test cho từng realm id; test Hóa Luyện item realm cao trả đúng essence.

**A2. Drop legacy — quyết định theo hướng conversion sink:**
- Giữ drop `xich_dong`/`huyen_thiet` ở quái Phàm Nhân/Luyện Khí (quest hiện tại vẫn cần), thêm recipe quy đổi tại Lò Luyện: `5 xich_dong/huyen_thiet → 1 <realm>_ore_common_processed` hoặc nguyên liệu Cường Hóa đương đương. Tỷ lệ 5:1 là baseline, playtest chỉnh.
- Vật liệu mồ côi không nguồn rơi (`thanh-dong`, `han-thiet`, `hoang_kim_linh_thiet`, `quang_sat`, `thanh_linh_moc`, `phu_chi`, `tinh_ngan`): xóa khỏi `materials.ts` nếu không còn tham chiếu runtime; nếu còn tham chiếu (test fixture, comment) thì dọn tham chiếu cùng lúc. Kiểm tra bằng grep trước khi xóa.
- Rà drop trong `Enemies.ts`/`Tribulations.ts`: mọi `itemId` phải trỏ material còn tồn tại và có sink (thêm invariant test: mọi material được drop phải có ít nhất 1 sink — recipe/cost/quest).

**A3. Nghẽn thảo:**
- Thêm cơ chế **Chọn Thảo** tại Động Thiên: trả Linh Thạch để chọn họ thảo cho cycle kế (chi phí baseline: 20 Linh Thạch, tăng 10% mỗi lần dùng liên tiếp cùng họ, reset khi đổi họ — chống spam rẻ).
- Tăng `GROTTO_HERB_AMOUNT` từ 1 lên 2 cho Động Thiên cấp 3+ (cấp công trình là progression tự nhiên của yield).
- Giữ nguyên weight niên đại; không thêm pity (Chọn Thảo đã là van an toàn).

**A4. Bug Linh Tuyền + trùng hằng số:**
- Thay `Math.pow(100, level)` bằng curve hữu hạn, vd `1000 + 500 * (level - 1)` — capacity phải là con số chơi được, không phải hàm mũ. Baseline chỉnh theo playtest.
- Gộp về một hằng số duy nhất `PRODUCTION_OFFLINE_CAP_SECONDS` tại `ProductionBalance.ts`; `BuildingSystem.ts` import từ đó.

### 3.2 Phần B — Sink, vendor, UX (Phase 3)

**B1. Sink Linh Thạch hàm mũ hậu kỳ:**
- Đột phá Kim Đan trở lên tiêu Linh Thạch theo cấp số nhân (phối hợp [truc-co-kim-dan-content-plan.md](./truc-co-kim-dan-content-plan.md) — gate Kim Đan đã dự trù sink Linh Thạch).
- Thêm "Tụ Linh Trận" (building mới hoặc nâng cấp Linh Tuyền): đổi Linh Thạch lấy % tốc độ tu luyện tạm thời (buff 24h) — sink lặp lại có giá trị thật.

**B2. Vendor / van xả vật liệu:**
- Thêm chức năng **Hóa Bán** trong Khí Đường hoặc panel riêng: bán material thừa lấy Linh Thạch theo giá trị tier (bảng giá data-driven trong file balance mới, vd `VendorBalance.ts`).
- Chỉ cho bán material không phải nguyên liệu duy nhất của recipe nào (hoặc cảnh báo xác nhận) để tránh tự bắn chân.

**B3. Điểm Rèn:**
- Thêm nguồn hồi: "Nạp Điểm Rèn" cho item bằng Tinh Hoa + Linh Thạch (chi phí tăng theo số lần nạp), giữ scarcity nhưng không dead-end.
- Hiển thị Điểm Rèn trong tooltip túi trang bị và thêm vào tiêu chí sort.

**B4. Filter/tìm kiếm túi:**
- MaterialBag: ô tìm kiếm theo tên + filter theo nhóm (gỗ/quặng/thảo/tinh hoa/khác) + gộp thảo theo họ với badge realm/niên đại.
- EquipmentBag: thêm auto-dissolve theo ngưỡng (vd tự Hóa Luyện item quality < X khi túi > Y% sức chứa, toggle trong setting) và giới hạn sức chứa khởi điểm, mở rộng bằng building/currency.

## 4. Nhiệm vụ triển khai

### Phần A (Phase 0)

1. **Task A1**: sửa `RefinementBalance.ts` + test (theo §3.1 A1).
2. **Task A2**: thêm conversion recipe; xóa material mồ côi sau khi grep xác nhận không tham chiếu; thêm invariant test "mọi drop có sink".
3. **Task A3**: Chọn Thảo (data + logic trong `ProductionSystem`/UI Động Thiên) + tăng `GROTTO_HERB_AMOUNT` theo cấp; unit test yield và chi phí.
4. **Task A4**: sửa curve Linh Tuyền + gộp hằng số offline cap; cập nhật test building.
5. **Task A5**: cập nhật `docs/item-design-reference.md` phần liên quan (theo quy trình docs-sync-audit đã hoàn thành 2026-08-28).

### Phần B (Phase 3)

6. **Task B1**: sink Linh Thạch cho gate đột phá + Tụ Linh Trận (design chi tiết khi vào phase, cần số liệu playtest Linh Thạch/giờ từ telemetry nếu có).
7. **Task B2**: vendor Hóa Bán — data bảng giá + UI + test giao dịch atomic.
8. **Task B3**: Nạp Điểm Rèn — cost table + UI + test.
9. **Task B4**: filter/search/gộp túi — component test.

Mỗi task kết thúc bằng: test liên quan xanh + `npm.cmd run type-check`.

## 5. Kiểm chứng

```powershell
npm.cmd run test
npm.cmd run type-check
npm.cmd run build
```

- Unit test: mapping essence đủ realm; invariant drop-có-sink; chi phí Chọn Thảo; curve Linh Tuyền; round-trip save không đổi shape.
- `EconomySimulation.test.ts` hiện có phải chạy lại sau mỗi thay đổi bảng balance.
- Thủ công: tạo save dev, kiểm tra túi không còn material mồ côi; luyện 1 mẻ đan cấp thấp trong < 10 phút với Chọn Thảo.

## 6. Rủi ro và lưu ý

- **Xóa nhầm material còn tham chiếu**: bắt buộc grep toàn bộ `src/` trước khi xóa; test fixture (`EquipmentSystem.test.ts` dùng `huyen_thiet`) phải được cập nhật cùng lúc.
- **Chọn Thảo làm luyện đan quá dễ**: chi phí Linh Thạch phải đủ đau ở cấp thấp; theo dõi số lần dùng qua telemetry nếu có.
- **Vendor tạo lạm phát ngược** (bán rác ra nhiều Linh Thạch hơn chi phí farm): bảng giá phải thấp hơn chi phí sản xuất trung bình; kiểm tra bằng `EconomySimulation`.
- Phần B phụ thuộc số liệu playtest — không chốt số cuối trước khi có dữ liệu; dùng baseline + cờ balance tập trung trong file balance riêng.
