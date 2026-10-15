# Q05 — Tàn Hỏa Ven Sơn

**Định vị:** Hồi II, nhiệm vụ đầu Luyện Khí, chuyển chủ đề từ thú hoang sang con người khai thác Dị Mạch. **ID:** `tvdm_05`; **predecessor:** Q04; **realm gate:** `qi_refining`.

## Cốt truyện và copy

**Mở:** “Sau lễ Quán Khí, ngươi cảm nhận rõ những luồng hỏa khí len dưới dãy Thanh Vân. Trên tuyến đường núi có vết bánh xe và những đống tro mới. Một toán Sơn Tặc mang linh khoáng vừa lấy từ rừng xuống thung lũng, trên thùng hàng khắc hình năm nhánh mạch, trong đó một nhánh đỏ quay ngược.”

**Tên:** Tàn Hỏa Ven Sơn. **Mô tả:** “Đến Thanh Vân 1-11 đến 1-13, **đánh bại 3 Sơn Tặc** để tìm dấu vết vận chuyển khoáng mang dị hỏa.” **Gợi ý:** “Phải hoàn tất Quán Khí để trở thành tu sĩ Luyện Khí trước. Sau đó vào Thám Hiểm vùng 1-11+.” **Kết:** “Bọn Sơn Tặc không săn tài vật thường: chúng mang khoáng nóng và thảo dược cháy sém về một trại luyện đan.” **CTA khi realm chưa đủ:** “Xem điều kiện đột phá”; khi active: “Truy đuổi Sơn Tặc”. Không hiện lựa chọn Mộc/Kim/Thủy/Thổ vì Beta hiện chỉ Hỏa.

## Hợp đồng cơ chế

- `condition:{kind:'kill',enemyId:'bandit',amount:3}`; `requiredRealmId:'qi_refining'`; `unlocksAfterQuestId:'tvdm_04'`; `once/mainline`. Đếm kill hợp lệ **sau activation**. Chỉ dẫn 1-11–1-13 là vùng khuyến nghị, không tự viết một luật zone chưa có.
- Thưởng **gốc** `{spiritStone:20,cultivation:25,skillInsight:400}`. Hệ số Luyện Khí ×8 với stone/cultivation ⇒ **thực nhận 160 Linh Thạch + 200 tu vi + 400 lĩnh ngộ**. Không item.
- Cửa chuyển hồi: dù Q04 đã claim và có bộ đếm boss, khi vẫn Phàm Nhân quest Q05 **chưa được kích hoạt**; người chơi phải tự đáp ứng cảnh giới. Realm progress là authority của hệ Cảnh Giới, quest không tạo “lễ Quán Khí” giả.
- Sau khi nhận, Q06 mở ngay. Kill trước Q05 active không cộng bù.

## Plan riêng / nghiệm thu

1. Add Q05 với realm gate trực tiếp; validate bandit từ beta roster và stage Luyện Khí truy cập được sau realm transition.
2. UI: locked state ghi yêu cầu Luyện Khí, chỉ dẫn mở Cảnh Giới; active state có link Thám Hiểm thật; reward hiển thị **160/200/400** chứ không phải 20/25/400.
3. Unit+integration: Q04 claim khi Phàm → Q05 locked; realm transition tới Qi → reconcile active `0/3`; kill 3 bandit → ready; claim +160 stone, +200 cultivation, +400 insight; kill Dã Trư không tính; restore ở 2/3 và sau claim. Test reward preview trùng committed amount.
4. E2E: hành trình vượt realm thật và thắng sơn tặc, xác nhận nhiệm vụ không bị kẹt khi chưa từng mở UI.

**Dẫn truyện:** bản đồ trại Sơn Tặc ghi một bãi linh thảo bị đốt, mở Q06.
