# Q04 — Hung Trư Trấn Mạch

**Định vị:** Hồi I / Phàm Nhân, boss chương mở nút thắt dị hỏa. **ID:** `tvdm_04`; **predecessor:** `tvdm_03`; **status:** proposed; đòi `stage_clear` ở bản chuẩn.

## Cốt truyện và copy người chơi

**Mở:** “Tận đáy động là một Dã Trư Vương đã không còn nhận ra hình hài cũ: những đường nứt đỏ nổi dưới bộ da dày, mỗi hơi thở làm đá vách hang nóng lên. Nó nằm đè lên mạch quặng vừa lộ, như bị một ý chí bên dưới lôi kéo.”

**Tên:** Hung Trư Trấn Mạch. **Mô tả:** “Vượt **Thanh Vân 1-10**, đánh bại Dã Trư Vương và làm chủ toàn bộ tầng.” **Gợi ý:** “Chuẩn bị tu luyện/trang bị trước khi khiêu chiến. Chỉ được tính khi tầng 1-10 kết thúc bằng chiến thắng.” **Kết:** “Hỏa khí tràn ra từ khe đá nhưng không tắt khi thú vương ngã xuống. Vết rạn hướng về dãy núi xa; muốn truy nguồn dị hỏa, ngươi cần bước vào Luyện Khí.” **CTA:** “Khiêu chiến Thanh Vân 1-10”; ready: “Nhận thưởng”; khi chưa đủ cảnh giới: “Đến Cảnh Giới để chuẩn bị Quán Khí” (chỉ dẫn, không chuyển realm tự động).

## Hợp đồng cơ chế

- **Mục tiêu chuẩn được khuyến nghị:** `condition:{kind:'stage_clear',stageId:'mortal_dong_10',amount:1}` — **chưa tồn tại**, phải bổ sung ở PR-Q2 theo IMPLEMENTATION.md. Clear tính khi stage authority commit `completedStageIds`, không tính do một `mortal_ferocious_wild_boar` chết giữa trận. Tầng boss có thể xuất hiện nhiều instance dùng chung enemy ID.
- **Fallback nếu trì hoãn PR-Q2 (không dùng text “vượt tầng”):** `kill {enemyId:'mortal_ferocious_wild_boar',amount:1}`; viết copy đúng “hạ 1 Dã Trư Vương”, và ghi rủi ro nhận thưởng trước khi clear. **Bản phát hành chuẩn chốt stage_clear**, fallback chỉ thử nghiệm có ghi ngoại lệ.
- `once`, `mainline`, gate claim Q03, không gate realm. Stage clear có thể đạt trước khi quest active: xem `completedStageIds` tại **reconcile command** để không buộc đánh lại boss vô cớ; retroactivity đặc biệt chỉ dùng cho thành tích stage, không hồi tố kill/collect.
- Thưởng gốc/thực **60 Linh Thạch + 120 tu vi**. Quest claim **không nâng** Phàm Nhân→Luyện Khí; hệ cảnh giới kiểm tầng 12, lễ Quán Khí và điều kiện riêng.

## Plan riêng / nghiệm thu

1. Engine dependency: hoàn thành schema, stage witness, duplication/restore tests của PR-Q2; xác minh stage ID `mortal_dong_10` từ `Stages.ts`.
2. Data: Q04 predecessor Q03; không điều kiện `requiredRealmId:'qi_refining'` vì đây là thử thách Phàm Nhân. UI trạng thái chưa qua ải, đã qua ải/chưa claim, đã claim/đang chờ chuyển giới.
3. Test: thắng một enemy boss nhưng thua stage thì `0/1`; clear stage thật→`1/1`; replay không tăng; clear stage trước activation được reconcile đúng; claim một lần +60/+120; khi còn Phàm cấp <12 không tự vào Luyện Khí; stage clear tương tác với save đúng.
4. E2E: đánh stage 1-10 thật, theo dõi stage victory + Quest card; thao tác Quán Khí nếu hệ nhân vật cho phép sau điều kiện cảnh giới. Không tạo circular gate giữa Q04 và nghi thức realm.

**Dẫn truyện:** Q05 chỉ được activate khi nhân vật đã vào `qi_refining`; khoảng nghỉ chuyển giới là nội dung có chủ đích.
