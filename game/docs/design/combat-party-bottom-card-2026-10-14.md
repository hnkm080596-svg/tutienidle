# Mẫu dải card đội hình combat

Trạng thái: mẫu thiết kế, chưa thay UI/runtime. Preview: `game/docs/design/combat-party-bottom-card-2026-10-14.png`.

## Bố cục

- Dải năm card nằm ở đáy vùng game 16:9: một nhân vật chính rồi bốn đồng hành, cùng kích thước và cùng vị trí các thành phần.
- Header giấy cổ: avatar tròn ở trái, tên ở phải. Phần mực tối: một thanh HP gọn rồi ba slot kỹ năng Thường/Đặc Biệt/Tuyệt Kỹ.
- Chỉ viền nhân vật chính sáng hơn nhẹ; không tăng kích thước card. Toàn dải co theo khung game, không theo các breakpoint riêng lẻ.
- Không dùng thêm card trạng thái ở góc trên cho cùng nhân vật. Resource riêng nếu có dùng một hàng nhỏ được giữ chỗ trong cùng chiều cao card.

## Hover và dữ liệu

- Hover avatar/tên/nền card hoặc focus bàn phím: mở tooltip chỉ số phía trên card, luôn nằm trong khung game.
- Tooltip đọc snapshot chỉ số đang có hiệu lực trong trận từ owner combat, cập nhật khi snapshot đổi trong lúc hover; UI không tự tính lại công/thủ.
- Hover slot kỹ năng: tooltip kỹ năng riêng; không mở chồng tooltip stat.
- Slot chưa có kỹ năng hoặc đang khóa vẫn lấy state từ domain. Mẫu không mở khóa companion/ultimate hay thay luật chọn kỹ năng.
- Avatar, tên, kỹ năng và số liệu trong ảnh là minh họa bố cục; runtime sẽ dùng dữ liệu thật.

## Component dự kiến

- CombatPartyDock: neo đáy và chia năm vị trí.
- CombatEntityCard: nhận read-model từng entity, lắp avatar/name/vitals/skill slots, chuyển snapshot stat cho Tooltip.
- Tái sử dụng GameCard, CombatVitalMeter, SlotView/CombatSkillSlot và Tooltip; art frame/fill riêng, không bake chữ/chỉ số vào ảnh runtime.

## Art

Tool: built-in imagegen. Preview được copy vào project, bản gốc generated image giữ nguyên.

Prompt: landscape 16:9 cultivation combat mockup; exactly five equal bottom-anchored independent party cards, one player + four companions; restrained antique-gold meander nine-slice frames, pale parchment headers, dark ink lower interiors; circular head portrait + name, slim HP bar, three circular skill slots each; one current-stat tooltip above third card, no overlapping cards; subdued ink-wash courtyard background, no other HUD. Labels: Nhân Vật Chính, Đồng Hành 1–4; skill roles Thường/Đặc Biệt/Tuyệt Kỹ; tooltip Chỉ Số Hiện Tại. This is a concept, not a production gameplay screenshot.
