# Trang Bị — preview UI

Preview `/ui-equipment.html`, artboard 1440×810 scale đồng tỷ lệ, nền Động Phủ và navigation dùng chung. Phạm vi chỉ trình bày với fixture, không nối EquipmentSystem, inventory, save hoặc gameplay.

Theo quyết định người dùng: giữ vị trí sáu ô trang bị quanh vùng nhân vật; để trống vùng ảnh 264×374 tại (338,229) để thêm art sau. Prop `characterImage` là điểm nối ảnh, hiện không truyền ảnh. Không gen nhân vật.

Không có bảng chi tiết cố định ở giữa. Tooltip tại (716,264), rộng 306, chỉ mount khi hover/focus item; rời chuột/blur/Escape/scroll túi sẽ ẩn. Tooltip dùng giấy 9-slice hiện có, là lớp overlay trong artboard nên scale cùng UI và không đẩy bố cục. Sáu ô trang bị và túi đồ dùng cùng `EquipmentPaperItem`; ảnh item dùng asset có sẵn.

Component map / ownership:
- `EquipmentPreview`: cung cấp fixture và điều hướng, không persist.
- `EquipmentFidelityScene`: bố cục, vùng ảnh nhân vật, state hover UI, emit navigate/back/action.
- `EquipmentPaperItem`: nhận item/label, emit inspect/leave; không equip hoặc tính chỉ số.
- `EquipmentPaperTooltip`: chỉ render item đã format (name, grade, slot, level, enhancement, description, stats, tone).

Các chỉ số dưới nhân vật là dữ liệu mẫu để duyệt bố cục. Trước tích hợp thay bằng read-model do domain cung cấp. Các nút thao tác chỉ hiện notice trong vùng cố định; danh mục lọc hiện là nhãn minh họa. QA gameplay và tích hợp giao implementer sau khi duyệt hình.

Không commit/push/merge. Không sửa asset background hoặc scene gameplay hiện hữu.

Điều chỉnh chiều ngang theo duyệt: túi tại x=758, rộng 620, lưới 7 cột ×74 với gap 10; vùng ảnh và sáu ô trang bị giữ nguyên. Tooltip vẫn là overlay ở giữa và không dành riêng một cột trống.

Bản thử tương phản v3: lòng ô ngọc bích tối, viền vàng cổ và đường viền phẩm chất sáng; typography tăng độ đậm và cỡ nhãn. Tooltip đổi từ giấy sang asset `dong-fu-v2/panel-nine-slice.png` hiện có (slice 360, viền hiển thị 30), giữ nguyên vị trí và hành vi hover. Nút/tab dùng ngọc bích tối và chữ vàng nhạt. Không tạo art mới. Type-check và test inspection pass; Edge kiểm tra hover/leave, lưới không overflow ngang và ảnh 1440×810/1000×800. Hướng này đang chờ người dùng duyệt.

Kiểm tra bản duyệt: type-check chạy thành công sau sửa handler back; Vitest kiểm tra vùng ảnh rỗng, tooltip mặc định ẩn, hover/leave/focus/Escape (1 test pass). Edge đã chạy hover ô trang bị và túi, rời chuột, Escape, thao tác notice, hai kích thước 1440×810 và 1000×800; screenshot được xem trực tiếp. Console preview: 0 errors, 0 warnings. Đây là bằng chứng UI preview, không phải chứng nhận QA tích hợp gameplay.
