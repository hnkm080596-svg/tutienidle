# Q07 — Đan Hỏa Khai Mạch

**Định vị:** Hồi II, dạy Đan Phòng bằng kết quả chế tạo thật. **ID:** `tvdm_07`; **predecessor:** Q06; **realm gate:** `qi_refining`.

## Cốt truyện và copy

**Mở:** “Tụ Linh Thảo hấp thụ Dị Mạch dường như giữ một đốm hỏa khí khó điều hòa. Đan Phòng có thể khiến phần linh lực bị lệch kết tinh, để ngươi nhận ra nó đến từ mạch đất hay từ thuật pháp của Sơn Tặc.”

**Tên:** Đan Hỏa Khai Mạch. **Mô tả:** “Vào **Đan Phòng**, luyện **thành công một viên đan dược**. Chỉ một lần chế tạo thành công sau khi nhiệm vụ mở được tính.” **Gợi ý:** “Kiểm tra công thức, vật liệu và lò trước khi luyện. Thử luyện thất bại chưa hoàn thành nhiệm vụ.” **Kết:** “Trong đan hương ngươi thấy vân hỏa năm nhánh. Dấu vết trên linh thảo trùng khớp kí hiệu của Sơn Tặc: chúng đang tìm kiếm chính nguồn Dị Mạch.” **CTA:** “Đến Đan Phòng”; ready: “Nhận phần thưởng luyện đan”.

## Hợp đồng cơ chế

- `condition:{kind:'flag',flagId:'alchemy.crafted',amount:1}`; `once/mainline`, after Q06, required Qi. **Đã có manifest** `QUEST_FLAG_ALCHEMY_CRAFTED` và production success witness. Chỉ `QuestSystem.onFlag` từ kết quả craft thành công hợp lệ sau activation mới tính. Không đếm mở bảng, click nút, preview, cancel hoặc failed craft.
- Bất kỳ viên đan hợp lệ được current alchemy seam công nhận đều tính. Không hardcode bắt buộc đúng `tu_linh_dan_qi_refining` nếu đã hứa “bất kỳ”; tránh softlock do điều kiện recipe hiếm. Kiểm tra realm/công thức đang cung cấp đủ tài nguyên sau Q06.
- Thưởng **gốc** `{spiritStone:25}` và `{kind:'pill',itemId:'tu_linh_dan_qi_refining',amount:1}` → **200 Linh Thạch + 1 Tụ Linh Đan Luyện Khí**. Pill count ×1 nguyên vẹn. Không tu vi/insight.
- Túi thuốc đầy: source hiện có notification overflow nhưng không bảo đảm vẫn nhận đủ pill. UI phải preview/cảnh báo từ owner, không mô tả pill là đã nhận thành công khi thực tế không giao; cân nhắc preflight capacity ở PR riêng nếu yêu cầu không mất reward.

## Plan riêng / nghiệm thu

1. Giữ lại flag manifest và emitted seam đã có; author new Q07 id, precursor, reward pill hiện có trong `PillRegistry`.
2. Kiểm tra nguyên liệu tối thiểu/lò đang unlock ở Qi; Q06 nộp 2 herb trước đó không được tạo vòng kẹt buộc farm một nguồn đã đóng. UI có link lò thật.
3. Test: craft trước activation không retro; craft fail không tăng; craft thành công sau activation `1/1`; claim +200 stone và 1 pill; duplicate craft settle không thể claim lần hai; bag full thông báo minh bạch; save/reopen chưa/đã claim.
4. Runtime: tự thao tác recipe thành công thật, chuyển sang bảng Quest nhận thưởng, kiểm tra pill đã vào túi; thử trường hợp inventory đầy nếu có thể tái hiện.

**Dẫn truyện:** ở tàn tích lò luyện đan, ngươi tìm ra sổ quặng bị đánh cắp, mở Q08.
