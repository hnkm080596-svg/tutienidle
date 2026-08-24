# Kế hoạch hệ thống Bản Mệnh Pháp Bảo — Trúc Cơ

## 1. Trạng thái tài liệu

- Phiên bản: `v1.0-draft`.
- Phạm vi: nội dung Trúc Cơ tầng 1–18.
- Trạng thái: chờ validate trước khi triển khai.
- Tên hiển thị: **Bản Mệnh Pháp Bảo**.
- Tên kỹ thuật đề xuất: `artifact`.
- Không dùng tên kỹ thuật `equipment` hoặc `skill` vì pháp bảo là một hệ thống chiến đấu riêng.

Hệ trang bị hiện đã có một bậc Quality mang tên Pháp Bảo. Vì vậy, giao diện của hệ thống mới phải luôn dùng đầy đủ tên **Bản Mệnh Pháp Bảo** ở tiêu đề, tutorial và panel chính để tránh nhầm với phẩm chất trang bị.

## 2. Mục tiêu thiết kế

Bản Mệnh Pháp Bảo là một vũ khí phụ tự vận hành, tương đương “sub gun” của nhân vật:

1. Tạo thêm một lớp hỏa lực tự động nhưng không tranh ô kỹ năng.
2. Không ngắt đòn cơ bản, cast hoặc movement timeline hiện tại.
3. Mỗi pháp bảo thay đổi cách đánh, không chỉ khác tên và VFX.
4. Có vòng nuôi dài xuyên suốt Trúc Cơ tầng 1–18.
5. Không thiên vị Pháp Tu hoặc Kiếm Tu.
6. Dùng lại combat missile data-driven và core authority hiện có.
7. Tạo công dụng thật cho `Tinh Luyện Cốt`, tài nguyên hiện đã có nguồn tạo nhưng chưa có nơi tiêu thụ.

### 2.1. Ngân sách sức mạnh

| Giai đoạn | DPS pháp bảo so với `Pháp Bảo Công` |
|---|---:|
| Vừa vào Trúc Cơ, cấp 1 | 16–18%/giây |
| Cấp 6, đã chọn Đại Nhánh | 20–25%/giây |
| Cấp 12, đã chọn Tiểu Nhánh | 25–32%/giây |
| Cấp 18, hoàn thiện | 30–40%/giây tùy điều kiện |
| Tỷ trọng mục tiêu trong tổng damage build | Khoảng 12–25% |

Nhánh chuyên dụng có thể vượt 40% `Pháp Bảo Công`/giây trong đúng tình huống của nó, chẳng hạn Trấn Sơn Ấn đánh boss đơn, nhưng phải yếu hơn khi gặp tình huống ngoài chuyên môn.

## 3. Mở khóa, sở hữu và trang bị

### 3.1. Thời điểm mở

Sau khi người chơi đột phá thành công từ Luyện Khí sang Trúc Cơ:

- Mở nút **Pháp Bảo** trong `RealmActionNav`.
- Mở đúng một slot Bản Mệnh Pháp Bảo.
- Hiện nghi thức chọn pháp bảo đầu tiên.
- Người chơi chọn miễn phí một trong ba pháp bảo ra mắt.
- Pháp bảo nhận được bắt đầu ở cấp 1.
- Hai pháp bảo còn lại có thể chế tạo sau.

Kết quả Căn Cơ ẩn không ảnh hưởng loại hoặc sức mạnh pháp bảo. Không biến một điều kiện ẩn thành lợi thế build không minh bạch.

Nếu người chơi đóng nghi thức mà chưa chọn, nhân vật vẫn vào Trúc Cơ bình thường nhưng chưa có pháp bảo. Nút Pháp Bảo phải giữ trạng thái nhắc chọn miễn phí cho đến khi lựa chọn hoàn tất.

### 3.2. Chế tạo pháp bảo còn lại

Mỗi pháp bảo là vật phẩm duy nhất. Không thể sở hữu bản trùng.

Chi phí chế tạo một pháp bảo chưa sở hữu:

| Nguyên liệu | Số lượng |
|---|---:|
| Linh Bảo Tàn Phiến | 30 |
| Tinh Luyện Cốt | 5 |
| Linh Thạch | 1.500 |

Pháp bảo chế tạo mới bắt đầu ở cấp 1 và phải nâng riêng.

### 3.3. Trang bị

- Chỉ trang bị tối đa một pháp bảo.
- Đổi pháp bảo miễn phí ngoài chiến đấu.
- Không thể đổi trong countdown hoặc đang chiến đấu.
- Pháp bảo đang trang bị được đưa vào combat snapshot.
- Nâng cấp hoặc đổi nhánh ngoài trận chỉ có hiệu lực từ trận kế tiếp.
- Pháp bảo không chiếm slot `weapon` và không thuộc sáu slot equipment hiện có.
- Pháp bảo không chiếm loadout skill.

## 4. Tài nguyên

### 4.1. Linh Bảo Tàn Phiến

Thêm nguyên liệu chuyên dụng:

- Tên: **Linh Bảo Tàn Phiến**.
- ID dự kiến: `artifact_fragment`.
- Category dự kiến: `artifact` hoặc `other` nếu chưa mở rộng union.
- Source type: `monster`.
- Chỉ rơi trong các màn có `requiredRealmId === 'foundation'`.

Tỷ lệ rơi:

| Nguồn | Phần thưởng |
|---|---:|
| Quái thường Trúc Cơ | 12% nhận 1 |
| Tinh Anh Trúc Cơ | Chắc chắn 2 |
| Boss màn 3.1–3.2 | Chắc chắn 3 |
| Boss màn 3.3–3.4 | Chắc chắn 4 |
| Boss màn 3.5–3.6 | Chắc chắn 5 |
| Boss màn 3.7–3.8 | Chắc chắn 6 |
| Boss màn 3.9–3.10 | Chắc chắn 7 |

Công thức boss:

```text
Số Tàn Phiến = 2 + ceil(số tầng / 2)
```

Mục tiêu farm dự kiến:

- Chỉ farm màn 3.1: khoảng 35–40 lượt để đủ 162 Tàn Phiến.
- Farm màn 3.10: khoảng 17–20 lượt.
- Elite có thể rút ngắn thêm thời gian.

### 4.2. Tinh Luyện Cốt

Giữ nguyên nguồn hiện tại:

```text
1 trang bị phân giải = 2 Bụi Cốt
5 Bụi Cốt + 10 Linh Thạch = 1 Tinh Luyện Cốt
```

Tổng 29 Tinh Luyện Cốt để nâng một pháp bảo lên cấp 18 tương đương:

- 145 Bụi Cốt.
- Khoảng 73 trang bị phân giải.
- Thêm 290 Linh Thạch cho bước tinh luyện.

Tinh Luyện Cốt là nút thắt đầu tư trang bị, không phải tài nguyên farm boss.

### 4.3. Vai trò từng tài nguyên

- Linh Thạch: chi phí kinh tế chung.
- Linh Bảo Tàn Phiến: chứng minh đã farm nội dung Trúc Cơ.
- Tinh Luyện Cốt: nối vòng rơi đồ → phân giải → tinh luyện → nuôi pháp bảo.

## 5. Cấp pháp bảo 1–18

### 5.1. Quy tắc chung

- Pháp bảo có cấp 1–18.
- Cấp pháp bảo không được vượt tầng Trúc Cơ hiện tại.
- Nếu nhân vật Trúc Cơ tầng 7, pháp bảo tối đa cấp 7.
- Mỗi cấp tăng 4% damage cơ bản, cộng tuyến tính.

Công thức:

```text
Hệ số cấp L = 1 + 0,04 × (L - 1)
```

Ví dụ:

- Cấp 1: ×1,00.
- Cấp 6: ×1,20.
- Cấp 12: ×1,44.
- Cấp 18: ×1,68.

### 5.2. Bảng chi phí đầy đủ

Chi phí trong mỗi dòng là chi phí nâng tới cấp được ghi trong dòng.

| Cấp đạt tới | Hệ số cấp | Linh Thạch | Tàn Phiến | Tinh Luyện Cốt | Nội dung mở |
|---:|---:|---:|---:|---:|---|
| 1 | 1,00 | 0 | 0 | 0 | Nhận pháp bảo |
| 2 | 1,04 | 50 | 1 | 0 | +4% damage |
| 3 | 1,08 | 75 | 1 | 0 | +4% damage |
| 4 | 1,12 | 100 | 2 | 0 | +4% damage |
| 5 | 1,16 | 150 | 2 | 0 | +4% damage |
| 6 | 1,20 | 250 | 4 | 1 | Chọn Đại Nhánh |
| 7 | 1,24 | 300 | 4 | 0 | +4% damage |
| 8 | 1,28 | 400 | 5 | 0 | +4% damage |
| 9 | 1,32 | 500 | 6 | 1 | +4% damage |
| 10 | 1,36 | 650 | 7 | 1 | +4% damage |
| 11 | 1,40 | 800 | 8 | 1 | +4% damage |
| 12 | 1,44 | 1.100 | 12 | 3 | Chọn Tiểu Nhánh |
| 13 | 1,48 | 1.300 | 12 | 2 | +4% damage |
| 14 | 1,52 | 1.600 | 14 | 2 | +4% damage |
| 15 | 1,56 | 1.900 | 16 | 3 | +4% damage |
| 16 | 1,60 | 2.300 | 18 | 3 | +4% damage |
| 17 | 1,64 | 2.800 | 20 | 4 | +4% damage |
| 18 | 1,68 | 3.600 | 30 | 8 | Mở Chân Hình |

Tổng cho một pháp bảo cấp 18:

| Tài nguyên | Tổng |
|---|---:|
| Linh Thạch | 17.875 |
| Linh Bảo Tàn Phiến | 162 |
| Tinh Luyện Cốt | 29 |

Theo giai đoạn:

| Giai đoạn | Linh Thạch | Tàn Phiến | Tinh Luyện Cốt |
|---|---:|---:|---:|
| Cấp 1 → 6 | 625 | 10 | 1 |
| Cấp 6 → 12 | 3.750 | 42 | 6 |
| Cấp 12 → 18 | 13.500 | 110 | 22 |

Phần lớn chi phí nằm ở cấp 13–18 để cấp 6 và nhánh đầu tiên đến sớm, còn hoàn thiện cấp 18 vẫn là mục tiêu dài hạn.

## 6. Công thức sát thương

### 6.1. Pháp Bảo Công thích ứng

Để không thiên vị Kiếm Tu hoặc Pháp Tu, pháp bảo sử dụng chỉ số thích ứng.

Khi bắt đầu trận:

```text
Pháp Bảo Công = giá trị lớn nhất trong:
- Công
- Mộc Công
- Hỏa Công
- Thổ Công
- Kim Công
- Thủy Công
```

Loại damage được khóa theo chỉ số thắng tại combat snapshot:

- Công cao nhất → damage vật lý.
- Mộc Công cao nhất → damage Mộc.
- Hỏa Công cao nhất → damage Hỏa.
- Thổ Công cao nhất → damage Thổ.
- Kim Công cao nhất → damage Kim.
- Thủy Công cao nhất → damage Thủy.
- Nếu bằng nhau, ưu tiên Công vật lý.

Sau khi loại damage đã được khóa:

- Buff trong trận lên đúng chỉ số đó vẫn tăng damage pháp bảo.
- Loại damage không đổi giữa trận.
- Không xảy ra tình trạng pháp bảo đổi hành liên tục vì buff.

Phong và Lôi chưa thuộc scope Trúc Cơ nên không tham gia phép chọn trong phiên bản đầu. Khi hai hành này thành nội dung chơi được, bổ sung chúng vào danh sách thích ứng mà không đổi công thức còn lại.

### 6.2. Công thức một hit

```text
Sát thương gốc
= Pháp Bảo Công hiện tại
× Hệ số riêng của pháp bảo
× Hệ số cấp
× Hệ số nhánh
```

Sau đó đi qua combat pipeline hiện tại:

```text
Accuracy
→ Dodge
→ Realm Pressure
→ Armor hoặc kháng nguyên tố
→ Critical
→ Block
→ Endurance
→ giảm sát thương cuối
→ Ward
→ HP
```

Pháp bảo được hưởng:

- Accuracy.
- Critical Rate.
- Critical Damage.
- Chance to Ignore Resistance.
- Final Damage Percent.
- Projectile Speed Percent.
- Realm Pressure.

Pháp bảo không được hưởng:

- Attack Speed.
- Cast Speed.
- Cooldown Reduction.
- Skill Damage Percent.
- Các modifier ghi rõ “kỹ năng”.

### 6.3. Quy tắc chống vòng lặp proc

Damage pháp bảo:

- Không tạo Mana.
- Không tạo Nộ.
- Không tạo Kiếm Ý.
- Không tạo Hỏa Thế, Thủy Thế, Kim Thế hoặc tài nguyên path.
- Không kích hoạt passive “khi ra đòn”.
- Không kích hoạt passive “khi dùng kỹ năng”.
- Không kích hoạt hiệu ứng “khi skill đánh trúng”.
- Không gây ailment nếu pháp bảo không ghi rõ.
- Không hút máu.
- Không thể kích hoạt lại chính pháp bảo.

Pháp bảo phát các event riêng:

- `artifact_fired`.
- `artifact_hit`.
- `artifact_critical`.
- `artifact_kill`.

Các event này phục vụ VFX, HUD và thống kê damage, không đi qua proc kỹ năng.

## 7. Hoạt động trong chiến đấu

### 7.1. Timer

- Pháp bảo có timer riêng.
- Timer bắt đầu ở 0 khi trận chuyển từ countdown sang `fighting`.
- Pháp bảo bắn ngay khi trận chính thức bắt đầu.
- Timer không chạy trong countdown, pause, victory hoặc defeat.
- Khi không có mục tiêu, timer vẫn về 0 và giữ trạng thái sẵn sàng.
- Khi quái mới xuất hiện, pháp bảo bắn ngay.
- Pháp bảo tiếp tục hoạt động khi nhân vật đang cast, bị choáng hoặc bị đóng băng.
- Pháp bảo dừng khi nhân vật chết.
- Fixed-step simulation phải là authority; Phaser chỉ trình bày projectile/VFX.

### 7.2. Mục tiêu

Mỗi pháp bảo có AI mục tiêu riêng:

- Phi Kiếm: bám mục tiêu mà đòn cơ bản của nhân vật sẽ chọn.
- Liệt Hồn Châm: ưu tiên kẻ địch có phần trăm HP thấp nhất.
- Trấn Sơn Ấn: chọn vị trí có thể đánh trúng nhiều mục tiêu nhất.

Quy tắc hòa:

1. Mục tiêu gần người chơi hơn.
2. Nếu vẫn bằng nhau, mục tiêu spawn trước.

## 8. Pháp bảo 1 — Thanh Trúc Phi Kiếm

### 8.1. Vai trò

- Pháp bảo cân bằng.
- Ổn định ở mọi nội dung.
- Có nhánh dọn quái và nhánh đánh boss.
- Đạn bám mục tiêu.

### 8.2. Chỉ số cơ bản

| Thuộc tính | Giá trị |
|---|---:|
| Chu kỳ | 2,4 giây |
| Hệ số damage cấp 1 | 0,42 |
| Projectile | Homing |
| Mục tiêu | Mục tiêu đòn cơ bản |
| AOE | Không |
| Xuyên mặc định | Không |

Damage mỗi phát:

```text
Phi Kiếm Damage = Pháp Bảo Công × 0,42 × Hệ số cấp
```

| Cấp | Hệ số mỗi phát | DPS trước phòng thủ, chưa tính crit |
|---:|---:|---:|
| 1 | 0,420 | 17,50% Pháp Bảo Công/giây |
| 6 | 0,504 | 21,00%/giây |
| 12 | 0,605 | 25,20%/giây |
| 18 | 0,706 | 29,40%/giây |

Với crit nền 5% và Critical Damage 150%, DPS kỳ vọng cấp 18 là khoảng 30,2% Pháp Bảo Công/giây trước phòng thủ.

### 8.3. Đại Nhánh cấp 6 A — Phân Quang Kiếm Trận

Dành cho dọn nhiều quái.

Hiệu ứng cấp 6:

- Mỗi lần kích hoạt thứ ba là một lượt Phân Quang.
- Vẫn bắn một phi kiếm chính 100%.
- Bắn thêm hai phi kiếm phụ.
- Mỗi kiếm phụ gây 55% damage của kiếm chính.
- Kiếm phụ phải chọn hai mục tiêu khác nhau.
- Không được dồn kiếm phụ vào mục tiêu chính.
- Nếu không đủ mục tiêu, số kiếm thừa biến mất.
- Mỗi kiếm roll accuracy và crit riêng.
- Bộ đếm reset khi bắt đầu trận.

Ví dụ lượt thứ ba có ba mục tiêu:

```text
Mục tiêu chính: 100%
Mục tiêu phụ 1: 55%
Mục tiêu phụ 2: 55%
Tổng damage tối đa: 210%
```

#### Tiểu nhánh cấp 12 A1 — Vạn Ảnh

- Damage kiếm phụ tăng từ 55% lên 75%.
- Cấu hình lượt Phân Quang: `100% + 75% + 75%`.
- Tổng tối đa: 250%.

#### Tiểu nhánh cấp 12 A2 — Truy Mệnh

- Kiếm phụ vẫn gây 55%.
- Nếu mục tiêu phụ còn dưới hoặc bằng 35% HP trước hit, kiếm phụ gây thêm 50%.
- Damage thực tế với mục tiêu thấp máu: `55% × 1,5 = 82,5%`.
- Nếu mục tiêu chết khi kiếm đang bay, kiếm tự tìm mục tiêu thấp máu gần nhất.

#### Chân Hình cấp 18 — Vạn Kiếm Phân Quang

Áp dụng cho cả A1 và A2:

- Lượt Phân Quang bắn bốn kiếm phụ thay vì hai.
- Mỗi kiếm vẫn phải vào một mục tiêu khác nhau.
- A1: `100% + 4 × 75% = 400%` tối đa.
- A2: `100% + 4 × 55%`, hoặc tối đa 430% nếu cả bốn mục tiêu phụ đều thấp máu.
- Không tăng damage đơn mục tiêu.

### 8.4. Đại Nhánh cấp 6 B — Dưỡng Kiếm Tâm

Dành cho boss hoặc mục tiêu sống lâu.

Hiệu ứng cấp 6:

- Phi Kiếm đánh trúng cùng một mục tiêu sẽ tạo một Kiếm Ấn.
- Tối đa năm Kiếm Ấn.
- Mỗi Kiếm Ấn có sẵn trước hit tăng 4% damage cho hit đó.
- Dodge không tạo Kiếm Ấn.
- Đổi mục tiêu hoặc mục tiêu chết sẽ mất toàn bộ ấn.

Chuỗi damage:

| Phát | Ấn trước hit | Damage |
|---:|---:|---:|
| 1 | 0 | 100% |
| 2 | 1 | 104% |
| 3 | 2 | 108% |
| 4 | 3 | 112% |
| 5 | 4 | 116% |
| 6 trở đi | 5 | 120% |

#### Tiểu nhánh cấp 12 B1 — Phá Cương

Mỗi Kiếm Ấn khiến hit hiện tại bỏ qua 4% phần mitigation đã tính của mục tiêu.

```text
Mitigation hiệu lực
= Mitigation gốc × (1 - 0,04 × số Kiếm Ấn)
```

Ở năm ấn:

- Giáp đang giảm 50% → chỉ còn giảm 40%.
- Kháng đang giảm 40% → chỉ còn giảm 32%.

Đây là bỏ qua tương đối, không trừ thẳng 20 điểm phần trăm.

#### Tiểu nhánh cấp 12 B2 — Tật Ảnh

Mỗi Kiếm Ấn giảm 2,5% chu kỳ Phi Kiếm.

| Số ấn | Chu kỳ |
|---:|---:|
| 0 | 2,40 giây |
| 1 | 2,34 giây |
| 2 | 2,28 giây |
| 3 | 2,22 giây |
| 4 | 2,16 giây |
| 5 | 2,10 giây |

Không chịu thêm Cooldown Reduction hoặc Attack Speed.

#### Chân Hình cấp 18 — Nhất Kiếm Phá Đạo

Khi một hit chuẩn bị đưa Kiếm Ấn từ bốn lên năm:

- Hit đó nhận hệ số ×1,8.
- Hit đó chắc chắn chí mạng.
- Sau khi hit resolve, toàn bộ Kiếm Ấn bị xóa.
- Nếu hit bị dodge, không kích hoạt Chân Hình và giữ nguyên bốn ấn.

Ví dụ với bốn ấn:

```text
Damage trước crit
= damage cơ bản × 1,16 × 1,8
= 208,8%
```

Sau đó nhân Critical Damage hiện tại.

## 9. Pháp bảo 2 — Liệt Hồn Châm

### 9.1. Vai trò

- Tốc độ bắn cao.
- Kết liễu quái yếu.
- Mạnh với mục tiêu thấp máu.
- Có nhánh xử tử hoặc nhánh multi-hit.

### 9.2. Chỉ số cơ bản

| Thuộc tính | Giá trị |
|---|---:|
| Chu kỳ | 0,8 giây |
| Hệ số damage cấp 1 | 0,13 |
| Projectile | Homing |
| Mục tiêu | Phần trăm HP thấp nhất |
| AOE | Không |

Damage:

```text
Liệt Hồn Châm Damage
= Pháp Bảo Công × 0,13 × Hệ số cấp
```

Nội tại mặc định:

- Nếu mục tiêu còn tối đa 25% HP trước hit: +25% damage.
- Kiểm tra HP khi châm chạm mục tiêu, không kiểm tra lúc bắn.

| Cấp | Hệ số mỗi châm | DPS chưa tính nội tại |
|---:|---:|---:|
| 1 | 0,130 | 16,25%/giây |
| 6 | 0,156 | 19,50%/giây |
| 12 | 0,187 | 23,40%/giây |
| 18 | 0,218 | 27,30%/giây |

Ở cấp 18, đánh mục tiêu dưới hoặc bằng 25% HP:

```text
27,30% × 1,25 = 34,13% Pháp Bảo Công/giây
```

### 9.3. Đại Nhánh cấp 6 A — Đoạt Mệnh

Thay nội tại mặc định bằng:

- Ngưỡng kích hoạt tăng từ 25% lên 35% HP.
- Bonus damage tăng từ 25% lên 45%.

```text
Mục tiêu ≤35% HP: damage ×1,45
```

#### Tiểu nhánh cấp 12 A1 — Tuyệt Mạch

- Bonus execute tăng từ 45% lên 70%.
- Với boss, bonus bị giới hạn ở 50%.

```text
Quái thường ≤35% HP: ×1,70
Boss ≤35% HP: ×1,50
```

#### Tiểu nhánh cấp 12 A2 — Liên Sát

- Giữ bonus ×1,45.
- Nếu Liệt Hồn Châm trực tiếp giết mục tiêu, timer lập tức về 0.
- Có internal cooldown 1,2 giây.
- Kill bởi DOT, skill hoặc pháp bảo khác không kích hoạt.
- Nếu không có mục tiêu mới, pháp bảo giữ trạng thái sẵn sàng.

#### Chân Hình cấp 18 — Đoạn Hồn

Lần đầu tiên Liệt Hồn Châm đánh một mục tiêu khi nó đang dưới hoặc bằng 15% HP:

- Quái thường: hit đó ×2.
- Boss: hit đó ×1,25.
- Mỗi mục tiêu chỉ bị Đoạn Hồn một lần trong trận.
- Hệ số này nhân sau bonus Đoạt Mệnh.

Với A1, quái thường dưới hoặc bằng 15% HP:

```text
Damage = cơ bản ×1,70 ×2
       = 340%
```

Đây là một hit damage, không phải execute theo phần trăm max HP.

### 9.4. Đại Nhánh cấp 6 B — Thiên La Châm

Dành cho hit dày và damage ổn định.

Hiệu ứng cấp 6:

- Mỗi lần kích hoạt thứ tư thay phát thường bằng ba châm.
- Mỗi châm gây 60% damage phát thường.
- Cả ba bắn vào cùng mục tiêu.
- Mỗi châm roll hit và crit riêng.
- Tổng tối đa: 180%.
- Bộ đếm tính theo lần kích hoạt, không tính số projectile.
- Bộ đếm reset đầu trận.

Chuỗi:

```text
Lần 1: 100%
Lần 2: 100%
Lần 3: 100%
Lần 4: 3 × 60% = 180%
```

#### Tiểu nhánh cấp 12 B1 — Tụ Mang

- Ba châm ở lần thứ tư tăng từ 60% lên 75%.
- Tổng damage lượt thứ tư: 225%.

#### Tiểu nhánh cấp 12 B2 — Tán Mang

Lần thứ tư:

- Châm chính gây 100% vào mục tiêu chính.
- Hai châm phụ gây 65% vào hai mục tiêu khác nhau.
- Không đủ mục tiêu thì châm thừa biến mất.
- Không dồn châm phụ vào mục tiêu chính.
- Tổng tối đa: 230%.

#### Chân Hình cấp 18 — Vạn Châm Xuyên Tâm

Mỗi lần kích hoạt thứ tám thay hoàn toàn lượt thứ tư thông thường.

Nếu chọn Tụ Mang:

- Bắn sáu châm vào cùng mục tiêu.
- Mỗi châm gây 50%.
- Tổng: 300%.

Nếu chọn Tán Mang:

- Một châm 100% vào mục tiêu chính.
- Tối đa năm châm phụ, mỗi châm 55%.
- Mỗi châm phụ phải chọn mục tiêu khác nhau.
- Tổng tối đa: 375%.
- Nếu không đủ mục tiêu, châm thừa biến mất.

Nội tại +25% damage dưới hoặc bằng 25% HP vẫn áp dụng riêng cho từng châm.

## 10. Pháp bảo 3 — Trấn Sơn Ấn

### 10.1. Vai trò

- Pháp bảo chậm, hit nặng.
- AOE và kiểm soát đội hình.
- Có nhánh dọn quái và nhánh đánh boss.

### 10.2. Chỉ số cơ bản

| Thuộc tính | Giá trị |
|---|---:|
| Chu kỳ | 4,8 giây |
| Hệ số damage cấp 1 | 0,78 |
| Bán kính AOE | 90 world unit |
| Damage mục tiêu phụ | 55% |
| Knockback | 18 world unit |
| Mục tiêu | Tâm cụm đông nhất |

Damage:

```text
Damage chính = Pháp Bảo Công × 0,78 × Hệ số cấp
Damage phụ = Damage chính × 0,55
```

| Cấp | Hệ số hit chính | DPS đơn mục tiêu |
|---:|---:|---:|
| 1 | 0,780 | 16,25%/giây |
| 6 | 0,936 | 19,50%/giây |
| 12 | 1,123 | 23,40%/giây |
| 18 | 1,310 | 27,30%/giây |

Một lần crit được roll cho lần giáng Ấn; mục tiêu chính và toàn bộ mục tiêu phụ cùng nhận trạng thái crit đó. Accuracy vẫn roll riêng cho từng mục tiêu.

### 10.3. Chọn tâm AOE

Với mỗi kẻ địch sống, hệ thống thử dùng vị trí của nó làm tâm:

1. Đếm số mục tiêu trong bán kính.
2. Chọn tâm đánh được nhiều mục tiêu nhất.
3. Nếu bằng nhau, chọn tâm gần người chơi hơn.
4. Nếu vẫn bằng nhau, chọn mục tiêu spawn trước.

Tâm được khóa khi Ấn bắt đầu giáng. Nếu mục tiêu tâm chết, Ấn vẫn rơi tại vị trí đã khóa.

### 10.4. Đại Nhánh cấp 6 A — Sơn Hà Trấn

Dành cho dọn quái:

- Bán kính tăng từ 90 lên 135.
- Damage mục tiêu phụ tăng từ 55% lên 75%.
- Knockback tăng từ 18 lên 28.
- Mục tiêu chính vẫn nhận 100%.

#### Tiểu nhánh cấp 12 A1 — Chấn Địa

Mục tiêu sống sót sau khi bị hit:

- Quái thường: giảm 20% tốc độ di chuyển trong 2,5 giây.
- Boss: giảm 10% trong 2,5 giây.
- Chỉ ảnh hưởng movement speed.
- Không giảm attack speed hoặc cast speed.
- Tái kích hoạt chỉ làm mới thời gian, không cộng dồn.

#### Tiểu nhánh cấp 12 A2 — Liên Sơn

Mỗi mục tiêu phụ thực sự nhận damage giảm 0,3 giây chu kỳ tiếp theo:

- Không tính mục tiêu chính.
- Dodge không được tính.
- Tối đa giảm 1,2 giây.
- Chu kỳ thấp nhất là 3,6 giây.
- Chỉ áp dụng cho một lần kích hoạt kế tiếp.

Ví dụ đánh trúng chính và bốn mục tiêu phụ:

```text
Chu kỳ kế tiếp = 4,8 - 4 × 0,3 = 3,6 giây
```

#### Chân Hình cấp 18 — Sơn Hà Cộng Chấn

Mỗi lần kích hoạt chẵn tạo một dư chấn sau 0,7 giây:

- Dư chấn xảy ra tại vị trí lần giáng Ấn trước.
- Gây 45% damage của hit chính cho mọi mục tiêu trong bán kính.
- Roll accuracy riêng cho từng mục tiêu.
- Roll crit mới một lần cho cả dư chấn.
- Không knockback.
- Không gây slow Chấn Địa.
- Không kích hoạt giảm chu kỳ Liên Sơn.
- Nếu không còn kẻ địch trong vùng, dư chấn vẫn diễn ra nhưng không gây damage.

### 10.5. Đại Nhánh cấp 6 B — Trấn Vương Ấn

Dành cho boss và mục tiêu đơn:

- Bán kính giảm từ 90 xuống 60.
- Damage phụ giảm từ 55% xuống 40%.
- Nếu tại thời điểm impact chỉ có một kẻ địch trong bán kính:
  - damage chính ×1,25;
  - boss không bị knockback.
- Nếu có từ hai kẻ địch trở lên, không nhận bonus đơn mục tiêu.

#### Tiểu nhánh cấp 12 B1 — Phá Nhạc

Khi điều kiện đơn mục tiêu thỏa mãn, bỏ qua 30% mitigation đã tính.

```text
Mitigation hiệu lực = Mitigation gốc ×0,70
```

Ví dụ:

- Giáp giảm 50% → còn giảm 35%.
- Kháng giảm 40% → còn giảm 28%.

#### Tiểu nhánh cấp 12 B2 — Điệp Ấn

Mỗi lần mục tiêu chính bị đánh trúng liên tiếp:

- Sau hit nhận một tầng Điệp Ấn.
- Tối đa ba tầng.
- Mỗi tầng tồn tại trước hit tăng 6% damage hit đó.
- Đổi mục tiêu hoặc mục tiêu chết xóa toàn bộ tầng.
- Dodge không thêm tầng.

| Tầng trước hit | Bonus |
|---:|---:|
| 0 | 0% |
| 1 | 6% |
| 2 | 12% |
| 3 | 18% |

#### Chân Hình cấp 18 — Trấn Thiên Nhất Kích

Mỗi lần kích hoạt thứ ba thỏa điều kiện đơn mục tiêu:

- Hệ số đơn mục tiêu tăng từ ×1,25 lên ×1,75.
- Không cộng `1,25 × 1,75`; ×1,75 thay thế ×1,25.
- Nếu lúc impact có thêm quái đi vào bán kính, Chân Hình không kích hoạt.
- Bộ đếm vẫn tiêu thụ dù điều kiện thất bại.

Chuỗi đơn mục tiêu:

```text
Lần 1: ×1,25
Lần 2: ×1,25
Lần 3: ×1,75
```

## 11. Bảng hệ số damage từng cấp

Các hệ số dưới đây chưa tính nhánh.

| Cấp | Phi Kiếm/phát | Liệt Hồn Châm/phát | Trấn Sơn Ấn/hit chính |
|---:|---:|---:|---:|
| 1 | 0,420 | 0,130 | 0,780 |
| 2 | 0,437 | 0,135 | 0,811 |
| 3 | 0,454 | 0,140 | 0,842 |
| 4 | 0,470 | 0,146 | 0,874 |
| 5 | 0,487 | 0,151 | 0,905 |
| 6 | 0,504 | 0,156 | 0,936 |
| 7 | 0,521 | 0,161 | 0,967 |
| 8 | 0,538 | 0,166 | 0,998 |
| 9 | 0,554 | 0,172 | 1,030 |
| 10 | 0,571 | 0,177 | 1,061 |
| 11 | 0,588 | 0,182 | 1,092 |
| 12 | 0,605 | 0,187 | 1,123 |
| 13 | 0,622 | 0,192 | 1,154 |
| 14 | 0,638 | 0,198 | 1,186 |
| 15 | 0,655 | 0,203 | 1,217 |
| 16 | 0,672 | 0,208 | 1,248 |
| 17 | 0,689 | 0,213 | 1,279 |
| 18 | 0,706 | 0,218 | 1,310 |

## 12. Ví dụ damage thực tế

Giả sử:

```text
Pháp Bảo Công = 500
Critical Rate = 5%
Critical Damage = 150%
Mục tiêu có Defense = 50
```

Defense 50 tạo mitigation:

```text
50 / (50 + 50) = 50%
```

### 12.1. Cấp 1

Phi Kiếm:

```text
Raw = 500 ×0,42 = 210
Sau giáp = 105
Critical = 157,5
```

Liệt Hồn Châm:

```text
Raw = 500 ×0,13 = 65
Sau giáp = 32,5
Dưới 25% HP = 40,625
Critical khi thấp HP = 60,9375
```

Trấn Sơn Ấn:

```text
Raw chính = 500 ×0,78 = 390
Sau giáp = 195

Raw phụ = 390 ×0,55 = 214,5
Sau giáp = 107,25
```

### 12.2. Cấp 18

Phi Kiếm:

```text
Raw = 500 ×0,706 = 353
Sau giáp = 176,5
Critical = 264,75
```

Liệt Hồn Châm:

```text
Raw = 500 ×0,218 = 109
Sau giáp = 54,5
Dưới 25% HP = 68,125
```

Trấn Sơn Ấn:

```text
Raw chính = 500 ×1,310 = 655
Sau giáp = 327,5

Raw phụ = 655 ×0,55 = 360,25
Sau giáp = 180,125
```

## 13. Đổi nhánh

Lần chọn ở cấp 6 và cấp 12 là miễn phí. Chỉ được đổi ngoài trận.

### 13.1. Đổi Tiểu Nhánh cấp 12

Giữ nguyên Đại Nhánh:

| Chi phí | Số lượng |
|---|---:|
| Linh Thạch | 300 |
| Linh Bảo Tàn Phiến | 5 |
| Tinh Luyện Cốt | 1 |

### 13.2. Đổi Đại Nhánh

Xóa cả Đại Nhánh và Tiểu Nhánh:

| Chi phí | Số lượng |
|---|---:|
| Linh Thạch | 750 |
| Linh Bảo Tàn Phiến | 12 |
| Tinh Luyện Cốt | 3 |

Quy tắc:

- Không giảm cấp pháp bảo.
- Không hoàn nguyên liệu nâng cấp.
- Sau khi trả phí, người chơi chọn nhánh mới ngay.
- Không cho để pháp bảo ở trạng thái thiếu nhánh nếu đã vượt cấp yêu cầu.
- Việc đổi nhánh phải atomic; nếu không thể hoàn thành lựa chọn mới thì không trừ tài nguyên.

## 14. Giao diện

### 14.1. Panel Bản Mệnh Pháp Bảo

Nút **Pháp Bảo** xuất hiện trong `RealmActionNav` từ Trúc Cơ.

Khu bên trái:

- Danh sách ba pháp bảo.
- Cấp hiện tại.
- Trạng thái đã sở hữu/chưa sở hữu.
- Dấu đang trang bị.

Khu trung tâm:

- Hình pháp bảo.
- Cấp và thanh tiến hóa.
- Pháp Bảo Công hiện tại.
- Loại damage thích ứng dự kiến.
- Damage mỗi phát.
- Chu kỳ.
- DPS đơn mục tiêu ước tính.
- Hành vi mục tiêu.
- Tổng damage pháp bảo ở trận gần nhất.

Khu bên phải:

- Cây Đại Nhánh cấp 6.
- Hai Tiểu Nhánh cấp 12.
- Chân Hình cấp 18.
- Nút đổi nhánh.
- Preview chính xác trước/sau khi chọn.

Khu nâng cấp phải hiển thị số thực trước/sau, không chỉ ghi “damage tăng 4%”:

```text
Cấp 11 → 12
Damage Phi Kiếm: 0,588 → 0,605 Pháp Bảo Công
Mở: Khắc Ấn cấp 12

Cần:
1.100 Linh Thạch       đang có X
12 Linh Bảo Tàn Phiến đang có Y
3 Tinh Luyện Cốt       đang có Z
```

### 14.2. Combat HUD

Một slot pháp bảo nhỏ cạnh HUD kỹ năng:

- Icon pháp bảo.
- Cấp.
- Vòng đếm chu kỳ.
- Bộ đếm nhánh:
  - Phi Kiếm: số lần tới Phân Quang hoặc số Kiếm Ấn.
  - Liệt Hồn Châm: số lần tới Tam Châm/Vạn Châm.
  - Trấn Sơn Ấn: số lần tới Cộng Chấn/Trấn Thiên.
- Flash vàng khi Chân Hình sẵn sàng.
- Không hiển thị như một ô skill có thể bấm.

### 14.3. Tooltip

Tooltip pháp bảo phải hiển thị:

- Hệ số damage hiện tại.
- Damage ước tính theo snapshot ngoài trận.
- Chu kỳ cố định.
- DPS đơn mục tiêu trước mitigation.
- Loại damage thích ứng dự kiến.
- Targeting rule.
- Toàn bộ hiệu ứng nhánh bằng số cụ thể.
- Dòng cảnh báo: “Không nhận Tốc Đánh, Tốc Thi Triển hoặc Hồi Chiêu”.
- Dòng cảnh báo: “Không tạo tài nguyên chiến đấu hoặc kích hoạt hiệu ứng kỹ năng”.

## 15. Dữ liệu cần lưu

Mỗi nhân vật có:

```ts
interface ArtifactProgress {
  artifactId: string
  owned: boolean
  level: number
  majorBranchId?: string
  minorBranchId?: string
}

interface ArtifactLoadout {
  equippedArtifactId?: string
  artifacts: ArtifactProgress[]
}
```

Không lưu runtime combat:

- Timer.
- Bộ đếm phát.
- Kiếm Ấn.
- Điệp Ấn.
- Internal cooldown của Liên Sát.
- Danh sách mục tiêu đã bị Đoạn Hồn.
- Trạng thái Chân Hình.

Các state trên reset mỗi trận.

Save cũ không có field pháp bảo được normalize thành:

```text
Không sở hữu pháp bảo
Không trang bị pháp bảo
```

Nếu người chơi đã ở Trúc Cơ nhưng chưa chọn pháp bảo, panel hiển thị nghi thức chọn miễn phí.

Các guard dữ liệu bắt buộc:

- `level` luôn clamp 1–18 cho pháp bảo đã sở hữu.
- Pháp bảo chưa sở hữu không được trang bị.
- `equippedArtifactId` không tồn tại trong registry thì bỏ trang bị an toàn.
- Nhánh không hợp lệ với pháp bảo thì bỏ nhánh, không crash save.
- Cấp dưới 6 không giữ Đại Nhánh.
- Cấp dưới 12 không giữ Tiểu Nhánh.

## 16. Kiến trúc triển khai dự kiến

Không đưa pháp bảo vào `SkillSystem`, vì nếu làm vậy sẽ dễ vô tình nhận:

- cooldown reduction;
- skill XP;
- mana cost;
- passive trigger;
- loadout slot;
- cast state.

Module riêng:

```text
src/core/artifact/
  Artifact.ts
  ArtifactRegistry.ts
  ArtifactProgress.ts
  ArtifactSystem.ts
  ArtifactTargeting.ts
  ArtifactUpgradeBalance.ts
  ArtifactBranch.ts
```

Dữ liệu:

```text
src/data/artifact/Artifacts.ts
src/data/artifact/ArtifactBranches.ts
```

UI dự kiến:

```text
src/components/panels/ArtifactPanel.vue
src/components/panels/artifact/ArtifactList.vue
src/components/panels/artifact/ArtifactDetails.vue
src/components/panels/artifact/ArtifactBranchTree.vue
src/components/game/combat/hud/ArtifactCombatHud.vue
```

### 16.1. Combat integration

- `Battle` giữ `artifactRuntime`.
- `GameManager` đưa artifact loadout/progress vào player combat snapshot.
- `BattleSystem.update()` gọi `ArtifactSystem.update()` sau movement và trước missile resolution.
- `ArtifactSystem` tạo missile qua `MissileSystem`.
- Missile bổ sung metadata nguồn `artifact` và `artifactId`.
- Damage vẫn đi qua `CombatSystem`, nhưng nhận damage context cấm resource/proc/leech.
- `projectile_spawned` mang `artifactId` để Phaser chọn VFX.
- Core tiếp tục là authority cho projectile, target và impact.

Damage context dự kiến phải phân biệt tối thiểu:

```ts
type CombatDamageOrigin = 'basic_attack' | 'skill' | 'artifact' | 'enemy'

interface CombatDamageContext {
  origin: CombatDamageOrigin
  skillId?: string
  artifactId?: string
  grantsResources: boolean
  triggersSkillPassives: boolean
  allowsLeech: boolean
}
```

Không dùng một cờ rời rạc ở nhiều call site. Một context thống nhất giúp ngăn pháp bảo vô tình kích hoạt đường damage cũ.

### 16.2. Runtime state dự kiến

```ts
interface ArtifactRuntimeState {
  artifactId: string
  level: number
  majorBranchId?: string
  minorBranchId?: string
  damageStat: 'attack' | 'woodPower' | 'firePower' | 'earthPower' | 'metalPower' | 'waterPower'
  damageElement?: 'wood' | 'fire' | 'earth' | 'metal' | 'water'
  timerRemaining: number
  activationCount: number
  lockedTargetId?: string
  stackCount: number
  internalCooldownRemaining: number
  markedTargetIds: string[]
}
```

Nếu các pháp bảo cần state khác biệt nhiều khi triển khai, dùng discriminated union theo `artifactId`; không dùng `any` hoặc một object tự do.

## 17. Test nghiệm thu

### 17.1. Upgrade và economy

- Không thể nâng vượt tầng Trúc Cơ.
- Không thể nâng nếu nhân vật chưa đạt Trúc Cơ.
- Không thể nâng nếu thiếu một trong ba nguyên liệu.
- Trừ nguyên liệu atomic: thất bại không trừ gì.
- Cấp 6 bắt buộc chọn Đại Nhánh.
- Cấp 12 bắt buộc chọn Tiểu Nhánh.
- Cấp 18 mở đúng Chân Hình theo Đại Nhánh.
- Tổng chi phí cấp 1→18 đúng `17.875 / 162 / 29`.
- Không thể chế tạo pháp bảo đã sở hữu.
- Pháp bảo mới chế tạo luôn ở cấp 1.
- Đổi nhánh không làm giảm cấp.
- Đổi nhánh thất bại không trừ nguyên liệu.

### 17.2. Combat chung

- Pháp bảo không bắn trong countdown.
- Bắn ngay khi `fighting` bắt đầu.
- Tiếp tục bắn khi nhân vật choáng/đóng băng.
- Tiếp tục bắn khi nhân vật đang cast.
- Dừng khi nhân vật chết.
- Không tạo Nộ, Mana, Kiếm Ý hoặc Thế.
- Không kích hoạt passive attack/skill.
- Không bị Attack Speed hoặc Cooldown Reduction tác động.
- Buff đúng Pháp Bảo Công trong trận thay đổi damage.
- Buff hành khác không làm đổi loại damage đã snapshot.
- Đổi trang bị ngoài trận không thay đổi snapshot trận đang chạy.
- Projectile vẫn resolve đúng khi không có Phaser renderer.
- Một delta lớn và nhiều delta nhỏ cho kết quả tương đương trong fixed-step simulation.
- Homing retarget đúng khi mục tiêu chết giữa đường.
- Damage attribution trong battle summary ghi đúng `artifactId`.

### 17.3. Thanh Trúc Phi Kiếm

- Phân Quang kích hoạt đúng mỗi lần thứ ba.
- Không dồn kiếm phụ vào một mục tiêu.
- Không đủ mục tiêu thì không phát sinh damage ảo.
- Vạn Ảnh dùng đúng 75%.
- Truy Mệnh kiểm tra HP lúc impact.
- Kiếm Tâm chỉ cộng ấn khi hit.
- Đổi mục tiêu xóa ấn.
- Tật Ảnh không hạ chu kỳ dưới 2,10 giây.
- Nhất Kiếm Phá Đạo không kích hoạt khi dodge.
- Guaranteed crit dùng đúng Critical Damage hiện tại.
- Sau Chân Hình, Kiếm Ấn trở về 0.

### 17.4. Liệt Hồn Châm

- Target đúng mục tiêu có phần trăm HP thấp nhất.
- Execute kiểm tra HP lúc impact.
- Boss dùng đúng cap bonus của Tuyệt Mạch.
- Liên Sát có internal cooldown 1,2 giây.
- Kill từ nguồn khác không reset timer.
- Lần thứ tư bắn đúng ba projectile.
- Lần thứ tám thay thế, không cộng thêm lượt thứ tư.
- Tụ Mang và Tán Mang chọn đúng mục tiêu.
- Đoạn Hồn chỉ kích hoạt một lần trên mỗi mục tiêu.
- Boss nhận ×1,25 thay vì ×2 từ Đoạn Hồn.

### 17.5. Trấn Sơn Ấn

- Chọn đúng cụm đông nhất.
- Tie-break target deterministic.
- Tâm impact không đổi nếu target chết.
- Damage phụ dùng đúng hệ số.
- Knockback dùng đúng khoảng cách.
- Slow chỉ ảnh hưởng movement speed.
- Slow refresh nhưng không stack.
- Liên Sơn chỉ đếm secondary hit không dodge.
- Liên Sơn không giảm chu kỳ dưới 3,6 giây.
- Cộng Chấn không kích hoạt slow hoặc giảm chu kỳ.
- Trấn Vương mất bonus nếu mục tiêu thứ hai đi vào vùng trước impact.
- Phá Nhạc giảm mitigation theo tỷ lệ tương đối.
- Điệp Ấn xóa stack khi đổi mục tiêu.
- Trấn Thiên dùng ×1,75 thay thế ×1,25.

### 17.6. Save và UI

- Save/load giữ đúng sở hữu, cấp, nhánh và pháp bảo trang bị.
- Runtime state không persist.
- Save cũ không có artifact vẫn load được.
- Trúc Cơ chưa chọn pháp bảo thấy nghi thức chọn miễn phí.
- Tooltip hiển thị đúng hệ số trước/sau nâng cấp.
- HUD timer không giả vờ chạy khi không có combat target.
- HUD counter nhánh đồng bộ runtime state.
- Panel không cho thao tác thay đổi build trong combat.

## 18. Chỉ tiêu balance khi playtest

Một pháp bảo được coi là đạt nếu:

- Cấp 1 đóng góp 10–18% tổng damage của build Trúc Cơ mới.
- Cấp 18 đóng góp 20–30% tổng damage.
- Nhánh chuyên boss không vượt nhánh còn lại quá 15% trong trận nhiều quái.
- Nhánh AOE không vượt nhánh boss ở mục tiêu đơn.
- Không pháp bảo nào rút ngắn thời gian diệt boss quá 30% so với không trang bị.
- Không nhánh nào tạo tài nguyên path nhanh hơn build không dùng pháp bảo.
- Nâng từ cấp 1 lên 6 cảm nhận được nhưng không làm mất giá trị skill.
- Cấp 18 thay đổi rõ nhịp chiến đấu, không chỉ là thêm damage.
- Ba pháp bảo cùng cấp/chưa chọn nhánh phải có single-target DPS nền lệch nhau không quá 10%.
- Khi đúng chuyên môn, nhánh nên mạnh hơn nhánh đối diện khoảng 15–30%, không phải 2–3 lần.

### 18.1. Ma trận simulation tối thiểu

Chạy simulation cố định seed cho mỗi cấu hình:

| Biến | Giá trị cần thử |
|---|---|
| Pháp Bảo Công | 100, 500, 1.000 |
| Cấp pháp bảo | 1, 6, 12, 18 |
| Critical Rate | 5%, 25%, 50% |
| Critical Damage | 150%, 200%, 300% |
| Mitigation mục tiêu | 0%, 25%, 50%, 75% |
| Số mục tiêu | 1, 3, 6 |
| Thời lượng trận | 15, 30, 60, 180 giây |

Mỗi cấu hình chạy tối thiểu 1.000 lần nếu có RNG crit/dodge để so damage trung bình và độ lệch.

## 19. Thứ tự triển khai sau khi plan được duyệt

### Phase 1 — Domain và economy

1. Thêm type, registry và static data pháp bảo.
2. Thêm progress/loadout vào PlayerData và save normalization.
3. Thêm Linh Bảo Tàn Phiến và drop rule Trúc Cơ.
4. Thêm chọn pháp bảo đầu tiên, chế tạo, nâng cấp và đổi nhánh.
5. Unit test toàn bộ transaction và bảng chi phí.

### Phase 2 — Combat core

1. Thêm combat damage origin/context.
2. Thêm artifact runtime snapshot.
3. Thêm timer và target selection.
4. Tích hợp MissileSystem mà không phát skill/basic-attack proc.
5. Triển khai ba hành vi cơ bản.
6. Triển khai toàn bộ nhánh cấp 6/12/18.
7. Unit test headless, fixed-step và projectile lifecycle.

### Phase 3 — UI

1. Thêm entry `Pháp Bảo` vào RealmActionNav.
2. Thêm nghi thức lựa chọn đầu tiên.
3. Thêm ArtifactPanel, cây nhánh và transaction feedback.
4. Thêm tooltip tính damage thực.
5. Thêm ArtifactCombatHud.
6. Component test trạng thái khóa/mở/nâng/đổi nhánh.

### Phase 4 — Phaser presentation

1. Pháp bảo bay quanh nhân vật.
2. VFX projectile riêng cho từng pháp bảo.
3. Telegraph Trấn Sơn Ấn.
4. VFX Chân Hình cấp 18.
5. Đảm bảo presentation không nắm combat authority.

### Phase 5 — Balance và hoàn thiện

1. Chạy simulation matrix.
2. Playtest các build Pháp Tu và Kiếm Tu.
3. So tỷ trọng damage theo cấp 1/6/12/18.
4. Chỉnh hệ số data-only nếu vượt ngưỡng.
5. Chạy toàn bộ Vitest, type-check, build và E2E combat liên quan.

## 20. Giới hạn và điểm cần validate

Nội dung Trúc Cơ hiện đang tái sử dụng encounter pool Luyện Khí và đổi realm của quái. Bảng chi phí trong tài liệu phù hợp với economy hiện tại, nhưng khi quái/drop Trúc Cơ thật được thiết kế, phải chạy simulation lại và có thể chỉnh tỷ lệ Tàn Phiến.

Các quyết định cần được validate trước khi implementation:

1. Duyệt ba pháp bảo: Thanh Trúc Phi Kiếm, Liệt Hồn Châm, Trấn Sơn Ấn.
2. Duyệt damage thích ứng theo chỉ số cao nhất.
3. Duyệt pháp bảo vẫn hoạt động khi nhân vật bị khống chế.
4. Duyệt bảng chi phí cấp 1–18.
5. Duyệt Linh Bảo Tàn Phiến và tỷ lệ rơi.
6. Duyệt mốc Đại Nhánh cấp 6, Tiểu Nhánh cấp 12, Chân Hình cấp 18.
7. Duyệt chi phí đổi nhánh.
8. Duyệt quy tắc không tạo tài nguyên và không kích hoạt proc skill.
9. Duyệt một slot pháp bảo riêng, không dùng slot `weapon`.
10. Duyệt mục tiêu tỷ trọng 12–25% tổng damage build.
