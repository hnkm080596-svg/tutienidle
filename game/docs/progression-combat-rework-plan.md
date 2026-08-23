# Kế hoạch Progression & Combat Rework

## 1. Quy tắc đã chốt

- Mỗi đại cảnh giới có 12 tầng chính và 6 tầng mở rộng, tối đa tầng 18.
- Tầng 12 mở quyền chuyển đại cảnh giới; người chơi có thể ở lại luyện tiếp đến tầng 18.
- Tầng 18 là trần tuyệt đối. Tu vi không tích lũy vượt chi phí tầng hiện tại.
- Tầng mở rộng 13–18 không ảnh hưởng đường cong của đại cảnh giới kế tiếp.
- Phàm Nhân tầng 1 lên 2 cần 1 phút ở tốc độ tu luyện cơ bản.
- Trong cùng cảnh giới, mỗi lần tăng tầng cần thêm 1 phút so với lần trước.
- Chi phí tầng 1 lên 2 của cảnh giới sau bằng hai lần chi phí tầng 11 lên 12 của cảnh giới trước.
- Không migration save vì dự án đang trong development.

Với `baseMinutes` là chi phí tầng 1 lên 2:

```ts
durationMinutes(level) = baseMinutes + level - 1
nextRealmBaseMinutes = (baseMinutes + 10) * 2
```

Ba cảnh giới đầu có base lần lượt là 1, 22 và 64 phút. Tổng thời gian:

| Cảnh giới | Tầng 1–12 | Tầng 12–18 | Tầng 1–18 |
|---|---:|---:|---:|
| Phàm Nhân | 66 phút | 87 phút | 153 phút |
| Luyện Khí | 297 phút | 213 phút | 510 phút |
| Trúc Cơ | 759 phút | 465 phút | 1.224 phút |

## 2. Tu luyện

- Thay công thức duration multiplier bằng curve trên và dùng một nguồn tính duy nhất.
- Cho tu vi chạy song song với chiến đấu; pause vẫn dừng cả hai.
- Auto đột phá chỉ xử lý tiểu cảnh giới.
- Quán Khí mở từ Phàm Nhân tầng 12; Trúc Cơ mở từ Luyện Khí tầng 12 khi đủ điều kiện riêng.
- Không cho `cultivation` vượt `cultivationRequired` và dừng ở tầng 18.
- Rà lại mọi mốc mở khóa phụ thuộc số tầng cũ.

## 3. Cảm ngộ tâm pháp

- Đổi EXP reward thành Cảm ngộ và cấp cho tâm pháp đang trang bị.
- Tu luyện không tự cộng Cảm ngộ.
- Mỗi tâm pháp giữ tiến độ riêng.
- Bốn phần chi phí Sơ Nhập/Tiểu Thành/Đại Thành/Viên Mãn là 10%/20%/30%/40%, tương ứng mốc tích lũy 10%/30%/60%/100%.
- Đặt tổng Cảm ngộ nền theo cảnh giới trong config tạm để balance.
- Tâm pháp Luyện Khí cần gấp 3 Tụ Linh Quyết Phàm Nhân.

## 4. Địa giới, boss và drop

- Mỗi Địa giới có 3 màn; mỗi màn tương ứng một đại cảnh giới.
- Mỗi màn có 10 tầng (`1.1` đến `1.10`, v.v.). Boss chỉ xuất hiện ở tầng `.10`; đây là quy tắc dùng chung.
- Thanh Vân màn 1 là nội dung Phàm Nhân.
- Quái có thể rơi mọi slot trang bị thông qua drop pool theo màn/cảnh giới.
- Tinh hoa Phàm Nhân rơi ở Thanh Vân 1.1–1.10: quái thường 1–3, boss 5–10.

## 5. Luồng tự động

- Hợp nhất Lặp lại, Tự động thám hiểm và Auto Battle thành `manual | repeat | progress`.
- `manual`: dừng ở kết quả; `repeat`: đánh lại tầng hiện tại; `progress`: thắng đi tiếp, thua dừng.
- Chỉ một countdown và một nguồn bắt đầu trận tiếp theo.

## 6. Tooltip

- Mặc định chỉ hiện giá trị đã roll.
- Giữ Alt mới hiện effective range và so sánh.
- Range phải dùng cùng scale cảnh giới/quality/rarity với giá trị thật.
- Delta so sánh đặt trực tiếp trên dòng stat tương ứng, không có ô so sánh riêng.

## 7. Pháp Tu và loadout

- Phàm Nhân dùng Trảm; chọn Pháp Tu thì Trảm bị unequip và không còn fallback đòn vật lý.
- Loadout lưu slot-instance để cho phép cùng skill ở nhiều ô và cooldown độc lập từng ô.
- Active skill Pháp Tu tốn mana theo config balance tạm.
- Thêm cast time thực cho pháp thuật để cast speed tác động trong combat và hiển thị được trên HUD.
- Bỏ đồng bộ level skill theo cảnh giới; combat phải dùng scaling level thực.

## 8. Kiểm chứng

- Unit test curve, trần tầng, tu luyện song song combat và các mốc 1/22/64 phút.
- Unit test Cảm ngộ, boss `.10`, khoảng Tinh hoa và equipment pool.
- Unit test state machine auto.
- Unit/component test tooltip khi giữ Alt.
- Unit test duplicate skill slot, cooldown độc lập, mana, cast speed và level scaling.
- Chạy `npm.cmd test`, `npm.cmd run type-check`, `npm.cmd run build`.
