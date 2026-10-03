# Độ Kiếp — preview UI

Preview `/ui-tribulation.html` trên canvas 1440×810 scale đồng tỷ lệ. UI-only, không sửa TribulationScene, domain, timer hoặc save. G0/G1: ảnh mẫu scene 13, component scaffold và contract background hiện có được kiểm tra đọc; file art-request là input tham khảo, không thắng quyết định người dùng. UI định vị ba giai đoạn ở trên, realm/strike card góc phải, status bên trái, question/answers bên phải và HP ở dưới. Mặc định preview là Tâm Ma.

Background chỉ trưng bày tĩnh bốn asset Độ Kiếp qua registry `StableSceneArt`, theo thứ tự storm-far → dais → storm-near → vignette, cùng fit/anchor hiện có; không tạo/sửa art hoặc hệ thống background. Vùng giữa dành cho nhân vật và VFX runtime, không thêm entity. Medallion HP dùng lại silhouette ngồi thiền và ornament-ring.

Component / điểm nối:
- UI-60 `TribulationFidelityScene`: nhận display model, selected answer, notice; emit answer(id)/back. Model nhận HP, thời gian, chương và lôi kích đã format từ host.
- UI-61 `TribulationFidelityChapters`: chapters động, current id, chỉ hiển thị trạng thái; không điều khiển progression.
- UI-62 `TribulationFidelityQuestion`: question/answers/selected/time/notice, emit authored answer id. Có vùng notice sẵn; nhiều đáp án scroll nội bộ.
- UI-63 `TribulationFidelityFrame`: khung tối-vàng 9-slice dùng art sẵn, slice360/display28; không tạo asset mới.
- UI-64 `TribulationPreview`: fixture ba trạng thái, nút duyệt giai đoạn chỉ thay UI. Không auto/skip, không resource thứ hai hoặc phần thưởng giả.

Khi tích hợp: timer và resolution do owner độ kiếp cung cấp; chọn đáp án gửi command, UI hiển thị read-model trả về. Không để UI mount/chuyển stage/animation phát sinh outcome. Không mount hai HUD trùng nhau. Victory/defeat sẽ duyệt thành scene riêng sau màn này.

Đây là bản duyệt thị giác, chưa chứng nhận gameplay/QA tích hợp. Không commit/push/merge.

Kiểm tra UI: type-check exit0; test answer identity/selection read-only 1 pass. Edge đã chọn đáp án, xác nhận notice nằm trong khung và câu hỏi fixture không bị cắt; đổi Thân Kiếp/Lôi Kiếp, xác nhận answer card biến mất và 3 strike pips bật; trở về Tâm Ma reset selection. Đã xem screenshot 1440×810, 1920×1080 và 1000×800. Background asset không thay đổi, chưa nối timer hoặc kết quả thật.
