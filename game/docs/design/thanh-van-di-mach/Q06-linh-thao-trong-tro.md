# Q06 — Linh Thảo Trong Tro

**Định vị:** Hồi II, dạy nhận nguyên liệu Luyện Khí và chuẩn bị cho Đan Phòng. **ID:** `tvdm_06`; **predecessor:** Q05; **realm gate:** `qi_refining` được ghi trực tiếp để tránh lệ thuộc band reward vào ancestor.

## Cốt truyện và copy

**Mở:** “Ven đường Sơn Tặc bỏ lại, nhiều cây linh thảo bị khói đen phủ kín nhưng rễ vẫn hấp thụ linh lực mạnh khác thường. Trong vài cụm lá có ánh đỏ như chính những thân gỗ và linh khoáng của Thanh Vân. Ngươi cần mẫu thảo còn nguyên để xét ảnh hưởng của Dị Mạch lên dược tính.”

**Tên:** Linh Thảo Trong Tro. **Mô tả:** “Thu thêm **2 Thập Niên Tụ Linh Thảo Luyện Khí**, nộp mẫu để tra xét trước khi luyện đan.” **Gợi ý:** “Tìm nguồn thảo tại hoạt động Động Thiên/Sản Xuất hoặc nguồn rơi đã xác minh trong Luyện Khí. Chỉ nguyên liệu thật được cấp cho túi sau khi nhiệm vụ mở mới tính tiến độ.” **Kết:** “Thảo giữ được linh khí hỗn loạn; nếu luyện thành đan, có thể làm dị hỏa lộ rõ hơn.” **CTA:** “Tìm Linh Thảo”; ready: “Nộp 2 Tụ Linh Thảo”. **Thiếu hàng:** “Số linh thảo bạn đang giữ không đủ để nộp; hãy thu thêm.”

## Hợp đồng cơ chế

- `condition:{kind:'collect',materialId:'tu_linh_thao_qi_refining_decade',amount:2}`; `once/mainline`; predecessor Q05; `requiredRealmId:'qi_refining'`. Đây là **material ID đang được quest mainline cũ sử dụng**, không dùng tên cây legacy đã bị gỡ khỏi registry.
- Nộp 2 vật phẩm tại claim, **trừ 2** khỏi MaterialBag. Người chơi có thể thiếu dược liệu để luyện đan Q07 sau đó, nên cân bằng nguồn phải đảm bảo **hai mẫu để nộp + lượng thực cần cho ít nhất một recipe** trong khoảng thời gian hợp lý. Không hardcode số recipe ingredient khi chưa đọc current recipe.
- Thưởng **gốc** `{spiritStone:20,skillInsight:800}` → **160 Linh Thạch + 800 lĩnh ngộ** (Luyện Khí ×8 chỉ stone). Không cultivation, không pill.
- Quest chỉ hứa “mẫu nghiên cứu” qua copy; hiện engine không sở hữu persistent evidence item “mẫu thảo dị mạch” — không cấp item lore giả.

## Plan riêng / nghiệm thu

1. Audit ID herb có nguồn rơi/thu mới trong real beta and required building gate; xác minh nguồn còn mở sau khi Q05 claim. Nếu không có đường đến herb thì dừng cutover, sửa data owner trước.
2. Author collect Quest; claim trừ 2; đưa nguồn thật vào narrative hint, không tự phát thưởng ở UI.
3. Test: herb sai realm, sai tuổi không tăng; có sẵn trước activation không retro; vào realm mới nhưng Q05 chưa claim không tính; thu đúng mới đủ 2; sau khi nộp, Q07 active và recipe còn đường thực hiện; save/reopen ở 1/2; claim thiếu item không tiêu tài nguyên.
4. Playwright: người chơi tới được nơi sản xuất/nhận herb, collect->quest UI->turn-in, rồi nhìn thấy Q07 dẫn tới Đan Phòng.

**Dẫn truyện:** dùng biến động linh khí trong thảo để thử lửa luyện đan ở Q07.
