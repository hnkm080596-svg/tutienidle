# Q08 — Khoáng Mạch Bị Đánh Cắp

**Định vị:** Hồi II, khai thác khoáng Luyện Khí và bước lộ rõ con người can thiệp linh mạch. **ID:** `tvdm_08`; **predecessor:** Q07; **realm gate:** `qi_refining`.

## Cốt truyện và copy

**Mở:** “Cuốn sổ tìm thấy bên lò cháy ghi những chuyến vận chuyển khoáng bí mật qua Thanh Vân. Đá được chia theo tuổi quặng, rồi đánh dấu bằng một vệt đỏ uốn ngược trên sơ đồ ngũ mạch. Muốn lần ra địa điểm đào phá, ngươi phải giữ lại mẫu khoáng từ chính vùng Sơn Tặc hoạt động.”

**Tên:** Khoáng Mạch Bị Đánh Cắp. **Mô tả:** “Thu thêm và nộp **2 Thập Niên Linh Khoáng Luyện Khí** để đối chiếu vết hỏa ấn trong sổ Sơn Tặc.” **Gợi ý:** “Thám Hiểm các tầng Luyện Khí có khoáng phù hợp hoặc kiểm tra nguồn sản xuất thật. Vật liệu dùng cho Cường Hóa không còn để nộp.” **Kết:** “Hai thỏi khoáng có vân lửa chạy cùng chiều, dẫn lên trại Sơn Tặc Vương tại đáy hẻm núi.” **CTA:** “Tìm Linh Khoáng”; ready: “Nộp 2 Linh Khoáng”.

## Hợp đồng cơ chế

- `condition:{kind:'collect',materialId:'qi_refining_ore_decade',amount:2}`, `once/mainline`, after Q07, required Qi. **ID đã được quest hiện tại dùng**. Đếm lượng thật vào túi sau activation, chỉ đúng cảnh giới/tuổi; claim đòi giữ 2, trừ 2, không “giữ chỗ” bằng state riêng.
- **Thưởng gốc** `{spiritStone:25,skillInsight:800}` ⇒ **200 Linh Thạch + 800 lĩnh ngộ**. Không cultivation, không vật phẩm.
- Có thể gợi ý Khí Đường / cường hóa như hoạt động tự chọn; không lén biến quest thành bắt buộc cường hóa do chưa có `equipment.enhanced` witness. Người chơi có quyền dùng khoáng trước và kiếm lại để nộp.
- Hint phải trỏ nguồn **được xác minh trong beta**; không hứa nguồn drop bảo đảm 100% nếu drop tables dùng xác suất.

## Plan riêng / nghiệm thu

1. Data Q08 và reward; census đường nhận item trong chapter Luyện Khí và chân `onMaterialGained` của mọi nguồn cho phép.
2. UI tiến độ thu mới `x/2` và tồn kho `current/2` tách biệt; khi thiếu khoáng sau cường hóa, thông báo số cần bổ sung rõ ràng.
3. Test thu đúng 1 quặng Luyện Khí + 1 Phàm Nhân→`1/2`; nộp thiếu khoáng thất bại không cộng thưởng; đủ khoáng claim -2 +200/+800; restore giữa 1/2; claim Q08 mở Q09 ngay.
4. E2E: nhận quặng bằng drop thực hoặc sản xuất, kiểm tra tính chất non-retroactive và turn-in; gợi ý thiết bị không gây giao diện ngõ cụt.

**Dẫn truyện:** sổ quặng và dấu vận chuyển mở đường đối đầu Sơn Tặc Vương Q09.
