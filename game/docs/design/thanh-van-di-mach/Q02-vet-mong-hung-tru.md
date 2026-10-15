# Q02 — Vết Móng Hung Trư

**Định vị:** Hồi I / Phàm Nhân, lần chiến đấu có mục đích truyện. **ID:** `tvdm_02`; **predecessor:** `tvdm_01`; **status:** proposed.

## Cốt truyện và copy người chơi

**Mở:** “Bên rìa Thanh Vân Lâm, những gốc cây vừa khai thác bị xới tung. Dấu móng lớn ăn sâu vào đất cứng; trên vài thân cây còn vương vệt hỏa khí đỏ sẫm. Dã Trư trong khu vực vốn nhát người, nay đã tấn công những người vận chuyển lâm mộc.”

**Tên:** Vết Móng Hung Trư. **Mô tả:** “Đi thăm dò Thanh Vân 1-1 đến 1-3, **đánh bại 2 Dã Trư** để giữ tuyến lâm sản an toàn.” **Gợi ý:** “Mở **Thám Hiểm → Thanh Vân**, chọn tầng đầu có Dã Trư. Mỗi Dã Trư bị hạ trong trận thắng hợp lệ tính 1.” **Đoạn kết:** “Đôi mắt chúng vằn đỏ, thân thể nóng như bị hơ lửa. Đây không còn là những con thú rừng thông thường. Mảnh khoáng gần hang trư cũng đổi màu.” **CTA:** “Đi Thám Hiểm”; ready: “Nhận thưởng và truy tìm khoáng mạch”.

## Hợp đồng cơ chế

- `condition:{kind:'kill',enemyId:'mortal_wild_boar',amount:2}`; `cadence:'once'`, `chainId:'mainline'`; non-retroactive, chỉ chiến thắng thực được battle kill funnel ghi nhận, quái khác không tính. **Hiện hỗ trợ**; zone hint 1-1→1-3 là hướng dẫn, **không áp `zoneId`** nếu ID zone không tương ứng chính xác stage nhỏ.
- Thưởng **gốc/thực nhận** `{spiritStone:20,cultivation:40}` = **20 Linh Thạch, 40 tu vi**. Không insight/vật phẩm. Tiến độ `0/2 → 1/2 → 2/2`; claim thủ công, idempotent.
- Dự tính chơi: có thể đánh lại tầng mở khi chưa đủ hai kills; không bắt buộc vượt đến boss, không khóa toàn bộ rừng khi thiếu damage.
- Chặn lời hứa UX nếu gặp bất khả kháng: người mới có thể thua ngay Dã Trư ở cân bằng hiện tại (`MortalChapterJourney.test.ts` có dữ kiện); bảng nhiệm vụ nên chỉ dẫn tu luyện/tăng trang bị, không cho rằng thắng ngay là hiển nhiên.

## Plan riêng / nghiệm thu

1. Add Q02 với predecessor Q01, enemy ID đúng `Enemies.ts`. Không thêm tạm quái mới, không thay skill/battle để làm đẹp riêng cho nhiệm vụ.
2. Đặt nội dung chỉ dẫn khu vực như *gợi ý* thay vì kiểm tra toàn bộ vùng; nếu cần chỉ định stage thật, thêm mapping `stageId` ở presentation, không giả vờ `zoneId` là 1-1.
3. Tạo test: kill trước activation không tính; kill 1 Dã Trư + 1 quái khác chỉ 1/2; defeat/abort không ghi; 2 kills sau activation đủ, claim +20/+40 và unlock Q03 đúng 1 lần; kill event lặp cần theo chứng cứ battle owner (không được tự tăng vô hạn do duplicate settlement).
4. Playwright: thao tác đi từ bảng đến Thám Hiểm, đánh ít nhất trận đầu thật, mở lại bảng sau trận, quan sát `1/2` hoặc `2/2`, thông báo khi thua hữu ích.

**Dẫn truyện:** sau Q02, lần theo khoáng mạch bị sưởi nóng tới Q03.
