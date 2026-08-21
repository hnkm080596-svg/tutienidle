# Động Phủ — Asset Requirements

Mockup (`Main.dc.html` trong bản thiết kế) dùng CSS/gradient/shape thuần để
GỢI Ý bố cục và không khí — không phải asset cuối cùng. Trước khi lên UI
thật, cần các asset sau:

```text
src/assets/ui/dong-phu/
├── background-sky.png            # nền trời/núi xa, layer tĩnh, 1920x1080 (hoặc theo DESIGN_WIDTH/HEIGHT)
├── ground-plane.png               # nền đất/đá động phủ, có thể lát (tileable) theo chiều ngang
├── spirit-vein.png                # linh mạch/formation dưới Linh Nhãn — spritesheet animation
│                                   #   kích thước khung: 256x256/frame, 8 frame, loop pulse ~2s
├── player-cultivation-idle.png    # nhân vật tu luyện tại Linh Nhãn — spritesheet
│                                   #   kích thước khung: 128x160/frame, 4 frame, loop ~3s (thở nhẹ/tóc bay)
├── scripture-pavilion.png         # Tàng Kinh Các — static hoặc 2-3 frame khói/ánh sáng cửa sổ
├── alchemy-room.png               # Đan Phòng — cần smoke/fire spritesheet riêng (xem bên dưới)
├── alchemy-smoke.png              # khói/lửa Đan Phòng — spritesheet, 64x64/frame, 6 frame, loop ~2.5s
├── talisman-pavilion.png          # Phù Viện — cần rune-glow spritesheet riêng
├── talisman-runes.png             # linh quang/phù văn Phù Viện — spritesheet, 64x64/frame, 6 frame, loop ~3s
├── equipment-hall.png             # Khí Đường — cần forge-ember spritesheet riêng
├── equipment-forge-embers.png     # lửa lò rèn Khí Đường — spritesheet, 48x48/frame, 8 frame, loop ~1.8s
├── formation-platform.png         # Trận Đài — vòng trận, cần rune-pulse spritesheet riêng
├── formation-rune-pulse.png       # rune pulse Trận Đài — spritesheet, 200x200/frame, 8 frame, loop ~3.5s
└── exploration-gate.png           # Cổng Thám Hiểm — spritesheet, 6 frame (idle glow/portal shimmer)
```

## Ghi chú animation

- Tất cả animation nên **chậm, không giật** (0.15–0.3 FPS hiệu dụng cảm
  nhận) — đúng tinh thần mục 6 của bản kế hoạch (Animation): "nhẹ, chậm,
  không gây rối".
- `player-cultivation-idle.png`: cần thêm biến thể theo path tu luyện
  (Pháp Tu/Kiếm Tu/Thể Tu) ở giai đoạn asset thật — bản mockup hiện dùng 1
  silhouette chung cho cả 3.
- Theo mục 7 (Progression Visual), mỗi công trình + `background-sky.png`/
  `ground-plane.png` cần **bộ biến thể theo mốc cảnh giới** (Phàm Nhân /
  Luyện Khí / Trúc Cơ / Kim Đan / Nguyên Anh+) — xem artboard
  `Progression.dc.html` trong bản thiết kế cho ý tưởng độ sáng/độ chi tiết
  tăng dần. Không bắt buộc có đủ ngay từ đầu; có thể ship trước bản Luyện
  Khí rồi bổ sung dần.

## Placeholder hiện tại

Cho đến khi có asset thật, `Main.dc.html` (và UI thật khi lên code) dùng
CSS shape/gradient thuần (silhouette pavilion, formation ring bằng
`border-radius` + `perspective`, particle bằng `box-shadow` glow) — được
đánh dấu rõ bằng tag `[ASSET: ...]` ngay trên từng công trình trong bản
mockup để không bị nhầm là asset cuối cùng.
