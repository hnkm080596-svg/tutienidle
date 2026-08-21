# Asset drop folder

Thả PNG thẳng vào đây (không cần tạo thư mục con) — **đặt tên đúng theo
manifest** (bảng đầy đủ đã gửi riêng), rồi chạy:

```
npm run assets:route
```

Script sẽ tự chuyển từng file vào đúng chỗ trong `public/assets/`.

## Quy tắc đặt tên

`__` trong tên file = dấu `/` trong đường dẫn đích cuối cùng.

```
frames__pham_khi.png                          -> public/assets/frames/pham_khi.png
equipment__quality-backdrop__bao_khi.png       -> public/assets/equipment/quality-backdrop/bao_khi.png
ui__Slot__slot-backdrop.png                    -> public/assets/ui/Slot/slot-backdrop.png
```

Nếu file đích đã tồn tại, script sẽ **bỏ qua và cảnh báo** (không tự
ghi đè) — xoá file cũ thủ công trước nếu muốn thay ảnh đã có.

Không cần tự tạo thư mục — script tự tạo theo tên file.
