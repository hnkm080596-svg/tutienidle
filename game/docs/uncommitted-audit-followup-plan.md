# Kế hoạch xử lý sau audit thay đổi chưa commit

## Quyết định đã chốt

- Không viết migration cho save version 37 sang 38. Save phát triển cũ được phép bị báo không tương thích.
- Chưa thêm Electron vào project ở đợt sửa hiện tại.
- Những vấn đề chỉ thuộc khâu đóng gói Electron được giữ lại để xử lý khi bắt đầu làm desktop shell.
- Logic mô phỏng phải đúng độc lập với UI renderer; không xem Electron là cách thay thế cho việc sửa game core.

## Ưu tiên 1 — sửa trong game core

### Fixed-step/catch-up cho combat

Hiện tại `App.vue` có thể chuyển một `deltaSeconds` lớn trực tiếp vào `GameManager`. Nhiều timer tiêu thụ toàn bộ delta nhưng hành động đánh/cast chỉ được thực hiện tối đa một lần trong một update. Kết quả combat vì vậy có thể thay đổi khi tab bị throttle, tiến trình bị suspend hoặc máy vừa thức dậy.

Việc cần làm:

1. Thêm simulation accumulator và chạy combat bằng fixed step có giới hạn, dự kiến 50–100 ms mỗi bước.
2. Đặt giới hạn catch-up hợp lý để tránh khóa UI sau một khoảng treo quá dài.
3. Quy định rõ thời gian bị suspend dài được mô phỏng tiếp, chuyển thành offline progress, hay tạm dừng combat.
4. Thêm test so sánh kết quả của nhiều delta nhỏ với một delta lớn cho attack timer, cast, cooldown, regen, ailment, movement, spawn và kết thúc trận.
5. Giữ cơ chế catch-up nhiều lần lôi kích của Độ Kiếp hiện tại và thêm regression test chung với fixed-step.

### Projectile phải có authority ở core

Hiện tại khi Phaser báo sẵn sàng va chạm, core projectile fallback bị tắt và sát thương chờ va chạm từ vòng render. Điều này khiến simulation phụ thuộc renderer.

Việc cần làm:

1. Để core cập nhật vị trí, retarget và quyết định impact của projectile.
2. Phaser chỉ nội suy/hiển thị theo event hoặc snapshot từ core.
3. Bảo đảm projectile vẫn resolve đúng khi không có scene, scene shutdown, FPS thấp hoặc renderer tạm dừng.
4. Thêm test cho projectile khi renderer không phát `projectile_impact`, target chết giữa đường và delta lớn.

### Countdown auto retry dùng deadline thực

`useAutoRetryCountdown` đang giảm một giây cho mỗi callback `setInterval`, nên callback bị throttle sẽ làm countdown kéo dài sai.

Việc cần làm:

1. Lưu deadline bằng timestamp.
2. Mỗi callback tính lại số giây còn lại từ deadline thay vì trừ cố định 1.
3. Khi callback quay lại trễ và deadline đã qua, chỉ chạy action hoàn tất đúng một lần.
4. Thêm fake-timer test cho callback tới trễ nhiều giây và cleanup khi component unmount.

### Đồng nhất thông báo trang bị rơi ngẫu nhiên

`grantRandomEquipmentDrop` đã thêm vật phẩm, particle và battle summary nhưng chưa tạo loot notification như nhánh equipment drop khai báo trong enemy data.

Việc cần làm:

1. Dùng cùng formatter tên, icon, rarity color và `pushLootNotification` cho cả hai nguồn drop.
2. Thêm test xác nhận bag, summary và notification chỉ được cộng một lần.

## Ưu tiên 2 — xử lý khi đóng gói Electron

Electron có thể giảm throttle nền nhưng không giải quyết hoàn toàn tính đúng đắn của clock/combat. Chỉ thực hiện phần này sau khi fixed-step và projectile authority ở core đã ổn định.

1. Tạo `BrowserWindow` với `webPreferences.backgroundThrottling: false` cho cửa sổ game.
2. Kiểm thử ba trạng thái riêng: cửa sổ mất focus, minimize và hệ điều hành sleep/resume.
3. Bắt sự kiện suspend/resume ở main process để ghi timestamp và áp chính sách offline/suspend đã chọn ở core.
4. Không dùng cờ Chromium tắt throttle toàn cục nếu `backgroundThrottling: false` đã đủ; tránh tăng CPU/GPU không cần thiết.
5. Đo CPU, GPU và pin khi cửa sổ chạy nền trước khi bật cấu hình này mặc định trong bản phát hành.

## Trước khi đưa thay đổi lên Git

1. Xác nhận các file `particle-frame-*.png` là asset thật; nếu chỉ là output thử nghiệm thì loại khỏi thay đổi.
2. Không đưa `test-results/`, `test-results-*.png` và cấu hình `.claude/settings.local.json` cá nhân vào commit sản phẩm.
3. Bổ sung ignore rule cho output Playwright nếu chưa có.
4. Chạy lại toàn bộ Vitest, `npm.cmd run type-check`, `npm.cmd run build` và E2E liên quan combat/tooltip.

## Điều kiện hoàn thành

- Cùng seed và cùng tổng thời gian mô phỏng cho kết quả combat tương đương dù delta được chia nhỏ hay dồn lớn.
- Combat và projectile hoàn tất đúng khi không có Phaser renderer.
- Độ Kiếp không mất hoặc nhân đôi lôi kích sau throttle/suspend.
- Auto retry hoàn tất theo thời gian thực và không gọi callback hai lần.
- Không có artifact kiểm thử hoặc cấu hình máy cá nhân trong commit.
