# Hướng dẫn giao việc cho Claude và Codex

Bạn chỉ cần thực hiện ba bước.

## Bước 1: Viết yêu cầu

Mở file `TASK.md`, xóa nội dung ví dụ và viết điều bạn muốn bằng tiếng Việt bình thường.

Bạn không cần nêu tên file code hay giải pháp kỹ thuật. Hãy mô tả trải nghiệm hoặc kết quả mong muốn càng rõ càng tốt.

Bạn có thể thêm một trong ba mode tiếng Anh ở đầu `TASK.md`:

```text
## Mode

Balanced
```

- `Quick`: Codex làm và chạy kiểm tra; không gọi Claude. Dùng cho text, CSS nhỏ, hoặc thay đổi rất rõ ràng.
- `Balanced`: Codex làm, sau đó Claude review bằng session độc lập. Đây là mặc định khi không ghi mode.
- `Full`: Claude lập kế hoạch, Codex làm, rồi Claude review. Chỉ dùng cho task lớn hoặc ảnh hưởng nhiều hệ thống.

Mỗi task bắt đầu bằng session mới. Chỉ các vòng Codex sửa feedback trong cùng task mới tiếp tục session cũ để giữ context mà không kéo lịch sử qua nhiều task.

Ví dụ:

```text
## Tôi muốn

Thêm nút "Bán đồ thường" trong túi trang bị.

## Khi hoàn thành, tôi mong đợi

- Bấm nút sẽ bán toàn bộ trang bị Common chưa khóa.
- Trang bị đang mặc không bị bán.
- Trước khi bán phải hỏi xác nhận.

## Không được thay đổi

- Không thay đổi cách trang bị và tháo trang bị hiện tại.

## Ghi chú hoặc tài liệu liên quan

- Giao diện nằm trong InventoryPanel.
```

## Bước 2: Bắt đầu workflow

Lưu `TASK.md`, sau đó mở terminal tại thư mục dự án và chạy:

```powershell
.\workflow.cmd
```

Workflow sẽ tự thực hiện:

1. Claude đọc dự án và lập kế hoạch.
2. Codex viết code và test.
3. Hệ thống chạy test, kiểm tra TypeScript và build.
4. Một phiên Claude mới review code.
5. Nếu review phát hiện lỗi, Codex sửa và Claude kiểm tra lại.

Không đóng terminal khi workflow đang chạy.

## Bước 3: Nhờ kiểm tra và nhập code

Khi terminal báo `Workflow passed`, nhắn cho Codex trong cuộc trò chuyện này:

```text
Kiểm tra run mới nhất và nhập code giúp tôi.
```

Codex sẽ kiểm tra kết quả, commit và nhập thay đổi vào nhánh chính.

## Nếu workflow không chạy

Chạy:

```powershell
.\workflow.cmd doctor
```

Sau đó gửi toàn bộ phần lỗi hiển thị trong terminal cho Codex.

## Lưu ý

- Mỗi lần chỉ để một yêu cầu trong `TASK.md`.
- `TASK.md` được phép thay đổi; workflow vẫn chạy miễn là các file khác không có thay đổi chưa commit.
- Không sửa code trong lúc workflow đang chạy.
- Workflow không tự commit, push hoặc xóa code.
- Nếu yêu cầu quá lớn, nên chia thành nhiều task nhỏ để review chính xác hơn.
