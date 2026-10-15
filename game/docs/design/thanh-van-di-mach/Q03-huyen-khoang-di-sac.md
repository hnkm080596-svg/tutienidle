# Q03 — Huyền Khoáng Dị Sắc

**Định vị:** Hồi I / Phàm Nhân, vòng lặp khoáng sản và bảo toàn vật liệu. **ID:** `tvdm_03`; **predecessor:** `tvdm_02`; **status:** proposed.

## Cốt truyện và copy người chơi

**Mở:** “Một thợ mỏ tìm thấy vân khoáng có ánh đỏ gần vết đào phá của đàn Dã Trư. Đá nguội bên ngoài nhưng khi đưa sát linh lực lại lóe như than hồng. Muốn hiểu tai họa này phải so sánh mẫu khoáng mới với những thỏi quặng đã tích trữ trước đó.”

**Tên:** Huyền Khoáng Dị Sắc. **Mô tả:** “Thu thêm **2 Thập Niên Linh Khoáng Phàm Nhân** sau khi mở nhiệm vụ rồi đem nộp.” **Gợi ý:** “Vào **Sản Xuất → khu khai khoáng**, kiểm tra nguồn tạo khoáng. Khoáng nhận từ túi khởi đầu không tăng tiến độ.” **Đoạn kết:** “Trong khoáng có những sợi linh lực bị nung lệch, kéo về phía hang sâu. Một sinh vật lớn đang nằm trên đường mạch.” **CTA:** “Đến khu khai khoáng”; ready: “Nộp 2 Linh Khoáng”. **Thiếu nguyên liệu:** “Bạn phải có đủ 2 Linh Khoáng ở thời điểm nộp; khoáng đã dùng vào chế tác không còn để bàn giao.”

## Hợp đồng cơ chế

- `condition:{kind:'collect',materialId:'mortal_ore_decade',amount:2}`; `cadence:'once'`, `chainId:'mainline'`; có sẵn trong core. Starter pack cấp **6** quặng không được hồi tố. Có thể kiếm qua nguồn thật đã nối `onMaterialGained`; chỉ đếm item đã thực giao.
- Phải có **2 khoáng trong túi tại claim**; claim trừ đúng 2. Có thể cùng tồn tại với việc dùng khoáng vào trang bị; hành vi tiêu vào hệ khác không đặt âm tiến độ nhưng khóa nhận nếu không còn đủ.
- Thưởng gốc/thực **25 Linh Thạch + 50 tu vi**, object `{spiritStone:25,cultivation:50}`.
- Không làm nhiệm vụ này thành yêu cầu nâng trang bị; `equipment.enhanced` chưa là emitted quest flag trong source. Có thể đưa gợi ý “giữ lại khoáng cho trang bị” ngoài điều kiện chính.

## Plan riêng / nghiệm thu

1. Author data Q03, check inventory/material ID và nguồn khai khoáng có sẵn trước boss. Dùng lại hook collect; nếu nguồn chưa được hook event, sửa chính luồng material landing, không tự cộng UI.
2. UI nêu rõ “thu mới 2, nộp 2”, phân biệt tiến độ đạt với túi hiện thiếu; sử dụng claim-result/domain reason thay vì tự tính ngược thưởng.
3. Test spawn có 6 ore→Q03 0/2; nhận mới 2→2/2; tiêu còn 1→claim lỗi không mất tiền/vật liệu; nhận thêm ore và claim thành công; save/restore ở 1/2, bag overflow không tăng material received quá số giao thật; Q04 chỉ mở sau claim.
4. Runtime: đo nguồn nhận thêm 2 khoáng trong Phàm Nhân, kiểm tra thao tác nộp/giữ; nếu rơi nguyên liệu sai cảnh giới khiến nguồn khan, điều chỉnh nguồn ở PR có owner riêng trước cutover.

**Dẫn truyện:** khoáng dẫn đến dấu tích Dã Trư Vương ở tầng Thanh Vân 1-10.
