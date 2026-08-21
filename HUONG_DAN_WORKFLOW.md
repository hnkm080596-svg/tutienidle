# Hướng dẫn giao việc cho Claude và Codex

Bạn chỉ cần thực hiện ba bước.

## Bước 1: Viết yêu cầu

Mở file `TASK.md`, xóa nội dung ví dụ và viết điều bạn muốn bằng tiếng Việt bình thường.

Bạn không cần nêu tên file code hay giải pháp kỹ thuật. Hãy mô tả trải nghiệm hoặc kết quả mong muốn càng rõ càng tốt.

Bạn không cần tự chọn mode. Nếu `TASK.md` không có mục `## Mode`, Nemotron Advisor trên NVIDIA sẽ
đọc yêu cầu và context cô đọng rồi tự chọn mode khi đủ tự tin:

```text
Recommended mode: Balanced
Automatically starting Balanced mode.
```

Advisor không đọc toàn bộ source code và không lưu API key trong dự án. Nếu confidence
`high` hoặc `medium`, workflow tự bắt đầu. Chỉ khi confidence `low` hoặc NVIDIA gặp lỗi,
workflow mới hỏi bạn chọn Enter/Q/B/F. Nếu muốn bỏ qua Advisor, bạn vẫn có thể thêm mode
tiếng Anh ở đầu `TASK.md`:

Nếu NVIDIA tạm thời mất mạng hoặc hết quota, menu vẫn xuất hiện để bạn tự chọn;
lỗi Advisor không làm mất task hoặc tạo worktree dở dang.

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

1. Claude Advisor đề xuất mode và chờ bạn chọn.
2. Với `Full`, Claude đọc dự án và lập kế hoạch; `Quick`/`Balanced` bỏ qua bước này.
3. Codex viết code.
4. Hệ thống stream tiến độ test, kiểm tra TypeScript và build ra terminal.
5. Với `Balanced`/`Full`, một phiên Claude mới review code.
6. Nếu kiểm tra hoặc review phát hiện lỗi, cùng session Codex sửa lại để giữ context.

Nếu test chưa đạt, workflow trả lỗi thẳng cho Codex và không gọi Claude review, giúp
tránh tốn token review cho một bản code chưa sẵn sàng.

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
