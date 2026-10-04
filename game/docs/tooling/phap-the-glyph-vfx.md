# Pháp Thế hệ Hỏa — chữ 火 tích tầng (preview VFX)

Đây là VFX biểu diễn 0–5 tầng trên người thi triển, **không sở hữu logic buff**. Hiện chỉ được điều khiển trong diễn võ; Devin nối sự kiện stack thật sau khi review PR/base.

- Nguồn nét thư pháp: `art/vfx/hoa-cau-thuat/fire-character-calligraphy.svg` (cùng hình chữ dùng cho vòng phép Arcadia). Script `art/vfx/hoa-cau-thuat/build-phap-the-glyph.mjs` tách bốn nét và xuất sáu SVG trong `public/assets/vfx/hoa-cau-thuat/phap-the/`.
- Mức 0: đủ bốn nét màu xám bạc; mức 1–4: từng nét theo thứ tự được thắp đỏ-cam và giữ sáng; mức 5: atlas Arcadia `fire-stroke/hoa-the` (nguồn `art/vfx/hoa-cau-thuat/Hoa The.json`) — ấn chữ cháy sống với lưỡi lửa và hạt lửa bay lên, phát đoạn reveal một lần rồi lặp đuôi cháy. Nét thứ tư được vẽ phía sau nét trung tâm để phần nối liền mạch. Không vẽ nét thứ năm.
- Điểm đặt trong preview: sát phía trên đầu nhân vật, ở ngoài silhouette; chữ đã thu còn 75% so với bản phác trước. Kích thước và vị trí do consumer tùy chỉnh theo anchor unit; không phủ lên art unit hoặc aura Tam Muội.
- Hợp đồng cho runtime: truyền số nguyên `0..5` của buff Pháp Thế hệ Hỏa để chọn texture `phap-the-N.svg` (mức 5 dùng atlas `hoa-the` thay cho SVG tĩnh); cộng tầng đúng lúc thi triển Hỏa Cầu theo logic game; hủy/giảm tầng phải chọn lại texture tương ứng. Không tự suy ra stack từ animation hoặc impact.
- Xem thử: `/dev/skill-vfx.html?preset=hoa_cau_comet&manual=1&tam_muoi=1&phap_the=0`. Chọn `Pháp Thế` để xem 0–5; nút `Thi triển` mô phỏng +1 tầng vào thời điểm phóng. Mô phỏng này không ghi save và không thay đổi combat.

SVG tách nét là asset code-native bắt nguồn từ hình thư pháp đã dùng trong thiết kế vòng phép; nó **không phải** một effect JSON Arcadia mới. Các vòng phép, Tụ Hỏa, projectile và aura Tam Muội vẫn giữ nguồn Arcadia riêng.
