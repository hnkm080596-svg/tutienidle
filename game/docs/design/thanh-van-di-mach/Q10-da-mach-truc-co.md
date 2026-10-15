# Q10 — Đá Mạch Trúc Cơ

**Định vị:** Hồi III, điều tra linh mạch ở cảnh giới mới, nối dấu vết ngũ hành từ Q01/Q03/Q09. **ID:** `tvdm_10`; **predecessor:** `tvdm_09`; **requiredRealmId:** `foundation_establishment`.

## Cốt truyện và copy

**Mở:** “Sau thiên kiếp Trúc Cơ, thần thức ngươi có thể chạm tới những đường linh khí mà trước đây không thấy. Dưới hậu sơn, các vệt mạch giao nhau thành hình ngũ hành, nhưng một vệt âm thầm chảy ngược. Những mảnh khoáng nơi đây rung nhẹ khi đưa lại gần nhau.”

**Tên:** Đá Mạch Trúc Cơ. **Mô tả:** “Thu thêm **2 Thập Niên Linh Khoáng Trúc Cơ**, nộp mẫu để đối chiếu với Huyền Khoáng dị sắc đã tìm được ở Hồi I.” **Gợi ý:** “Thám Hiểm vùng Trúc Cơ để tìm khoáng tương ứng; chiến lợi phẩm có tỉ lệ rơi, không bảo đảm mỗi trận đều có. Chỉ thu được sau khi nhận nhiệm vụ mới tính.” **Kết:** “Hai khối đá phát ra năm vệt sáng, bốn vệt xuôi chiều, vệt đỏ còn lại chạy ngược về Cổ Mộc Đàm. Một tiếng Linh Lang kéo dài phía hậu sơn.” **CTA:** “Thám Hiểm Hậu Sơn”; ready: “Nộp 2 Đá Mạch”.

## Hợp đồng cơ chế

- `condition:{kind:'collect',materialId:'foundation_establishment_ore_decade',amount:2}`; `cadence:'once'`, `chainId:'mainline'`, predecessor Q09, required Foundation. Vật phẩm có trong bảng drop Trúc Cơ; nguồn cần được E2E xác nhận. Không đồng nhất với `qi_refining_ore_decade`.
- Event collect chỉ tính sau khi active; vật liệu có từ trước vào realm và đứng sẵn trong túi không tự điền. Claim cần đang giữ ít nhất 2 và trừ đúng 2. Không bắt buộc quan sát hai khối đá như vật thể 3D/cutscene nếu feature narrative chưa triển khai; copy diễn giải kết quả điều tra.
- Thưởng **gốc** `{spiritStone:15,skillInsight:2000}` ⇒ **750 Linh Thạch + 2.000 lĩnh ngộ** (×50 áp lên stone, insight nguyên giá trị). Không tu vi/item.
- **Cân bằng cần đánh giá:** hệ Trúc Cơ hiện có side quests trả thưởng lớn hơn; khoản 750 là mức chủ động bảo thủ để không đẩy kinh tế quá sớm. Trước code freeze, so sánh thu nhập/trận, chi phí cây skill, time-to-drop và quan hệ với reward hiện hành. Không tăng thưởng chỉ để biến nhiệm vụ thành kênh farm.

## Plan riêng / nghiệm thu

1. Tạo Q10 với gate Foundation **trực tiếp**, check ID trong `StageDropTables.ts` và quy tắc drop; do game chưa hỗ trợ insight scaling, nhập đúng `2000` vào data.
2. UI giải thích nguồn Trúc Cơ và xác suất rơi, tránh hứa “Sản Xuất” nếu nguồn thực là drop từ chiến đấu; tách `gained count` và `currently held`.
3. Test: ở Qi (dù Q09 claim) vẫn locked; Foundation nhưng Q09 chưa claim locked; khi cả hai đủ active 0/2; add 2 ore đúng vào túi khi active được 2/2; mất khoáng trước claim báo thiếu, không thưởng; đủ mới nộp -2 +750/+2000; restore ở 1/2 giữ state.
4. E2E: vào stage Trúc Cơ thật, nhận ore hợp lệ (hoặc dùng controlled reproducible drop test), claim và quan sát chuyển Q11.

**Dẫn truyện:** vệt mạch chỉ nơi đàn Linh Lang có những vùng lông trắng phát sáng, mở Q11.
