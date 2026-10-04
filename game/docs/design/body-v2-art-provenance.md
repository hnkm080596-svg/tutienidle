# Body v2 — silhouette duyệt UI

Theo lựa chọn của người dùng: Phàm Nhân đứng tấn, Luyện Khí thái cực, Chu Thiên ngồi thiền. Chỉ tạo silhouette đen phong cách tu tiên, không tạo cả panel hoặc background.

## Art

Thư mục: `public/assets/ui/huyen-kim/scene/body-v2/`.

| Asset | Dáng | Trang preview |
|---|---|---|
| mortal-horse-stance-v1.png | Đứng tấn, hai tay thu ở eo | refinement |
| qi-taichi-v1.png | Thái cực, một tay đưa ra, một tay thu trước bụng | meridian |
| zhou-meditation-v1.png | Ngồi thiền xếp bằng | cycle |

Tạo bằng ImageGen với nền trong suốt. Prompt chung: một bóng tu sĩ mực đen, tóc búi và đạo bào, chỉ vài khoảng âm để đọc tư thế; không mặt, da, giải phẫu, viền vàng, hào quang, kinh mạch, chữ, giấy hoặc phong cảnh. Toàn thân nằm gọn trong ảnh, có khoảng trống quanh nhân vật.

Nguồn generation tương ứng: `exec-6b38abfa-764f-4944-8c5d-efaf4e0dd5ee.png`, `exec-103952c9-cdbe-4b79-b096-3b00cb16147e.png`, `exec-d054ccbc-0ba6-4f16-93ca-f41141c7a122.png` trong phiên generated_images `01a0f7b5-053f-71d0-a72c-75577519a956`.

Các bản nhân vật chi tiết/hình nộm trước đó không được nhập vào project.

## Phạm vi

Preview `/ui-body.html` dùng lại DongFuVista, SceneDesignCanvas, PaperPanelNavigation và giấy 9-slice. Chuyển trang chỉ đổi phần nội dung, giữ nền và khung ổn định; hỗ trợ reduced motion. Silhouette không chứa node; node là UI độc lập.

Toàn bộ chỉ số, nguyên liệu và trạng thái là fixture. Không nối gameplay hoặc save. Đã chạy type-check và xem trực tiếp ba trang trong trình duyệt; không phải chứng nhận QA toàn dự án hay merge-ready.
