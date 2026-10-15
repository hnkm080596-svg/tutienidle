# Q11 — Bóng Trắng Hậu Sơn

**Định vị:** Hồi III, biến Linh Lang từ đối thủ thông thường thành manh mối về mạch cổ. **ID:** `tvdm_11`; **predecessor:** Q10; **requiredRealmId:** `foundation_establishment`.

## Cốt truyện và copy

**Mở:** “Đá Mạch cộng hưởng đã đánh thức những đốm sáng trắng lẩn trong rừng sâu. Người qua đường nói Linh Lang trở nên cuồng loạn, nhưng những dấu chân không dẫn xuống làng mà vòng quanh lối vào Cổ Mộc Đàm, như thể đàn sói đang chắn ai đó khỏi tới gần.”

**Tên:** Bóng Trắng Hậu Sơn. **Mô tả:** “Đánh bại **3 Linh Lang** vùng Trúc Cơ để lần theo biến động linh khí trắng trong đàn sói.” **Gợi ý:** “Đi Thám Hiểm các tầng Trúc Cơ có `Linh Lang`. Không cần đánh boss ngay. Những con thú khác không được tính.” **Kết:** “Trên lông Linh Lang có vệt sáng giống Đá Mạch; chúng bị Dị Mạch làm đau đớn nhưng vẫn tuần tra quanh Cổ Mộc Đàm. Có lẽ Linh Lang Vương đang cố giữ thứ gì đó ở bên dưới.” **CTA:** “Lần theo Linh Lang”; ready: “Nhận thưởng điều tra”.

## Hợp đồng cơ chế

- `condition:{kind:'kill',enemyId:'foundation_spirit_wolf',amount:3}`; `once/mainline`; predecessor Q10; required Foundation. Existing kill rule; không đếm boss `foundation_ferocious_spirit_wolf` thay cho thường, không hồi tố những trận trước activation.
- Battle system sở hữu kết quả một lần; quest chỉ nhận kill từ successful authoritative event, không từ ảnh animation tử vong, không từ fake UI calls. Nhiều quest cùng đếm Linh Lang có thể cập nhật riêng mỗi quest active đúng điều kiện mà không làm duplicate reward.
- Thưởng **gốc** `{spiritStone:25,skillInsight:3500}` ⇒ **1.250 Linh Thạch + 3.500 lĩnh ngộ**. Không tu vi/item.
- Chủ đề truyện tránh tuyên bố mọi Linh Lang là ác thú; hành động phòng vệ của nhân vật vẫn giữ lựa chọn chiến đấu theo combat loop hiện hành.

## Plan riêng / nghiệm thu

1. Dữ liệu Q11 với target wolf thường đúng ID trong beta roster; gate Foundation trực tiếp cho scaling không phụ thuộc chuỗi.
2. UI lồng câu chuyện “giải cứu hậu sơn” thay vì đếm tiêu diệt vô nghĩa; copy không hứa NPC/đồ rơi đặc biệt chưa được định nghĩa.
3. Test: hạ 2 wolf thường + boss 1→`2/3`, không ready; hạ thêm wolf thường→`3/3`; claim +1250/+3500; kill trước activation không tính; restore 2/3; event from failed battle không tính; replay and duplicate event không thể claim lại.
4. Runtime: thắng trận thực ở một hoặc nhiều stage Trúc Cơ, verify count và CTA, trạng thái Q12 sau claim.

**Dẫn truyện:** từ bầy sói còn sống ngươi biết rằng Lang Vương chưa rời khe mạch, mở Q12.
