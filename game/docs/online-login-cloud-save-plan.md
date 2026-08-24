# Online, Login & Cloud Save Plan

## 1. Mục tiêu

Đưa game thành một ứng dụng web chỉ chơi khi có kết nối mạng, hỗ trợ:

- Chơi ngay bằng tài khoản khách ẩn danh.
- Tự đăng ký và đăng nhập bằng ID/mật khẩu.
- Cloud save; save chính thức không nằm trong `localStorage`.
- Liên kết tiến trình khách với tài khoản.
- Một tài khoản chỉ đăng nhập tại một thiết bị ở cùng thời điểm.
- Pause ngay khi mất mạng hoặc session không còn hợp lệ.
- Server xác minh dữ liệu quan trọng để hạn chế sửa save và gian lận.

Frontend dự kiến deploy trên Vercel. Backend, authentication và PostgreSQL dự kiến dùng Supabase. Không cần tự quản lý VPS trong giai đoạn đầu.

## 2. Quyết định sản phẩm đã chốt

### Tài khoản

- Người chơi được chọn `Chơi ngay` mà không cần đăng ký trước.
- Khách được chơi và cloud save bình thường nhưng tiến trình bị giới hạn tại Trúc Cơ.
- Khách có thể đăng ký hoặc đăng nhập sau này để liên kết tiến trình.
- Người chơi tự đăng ký bằng ID và mật khẩu.
- Không làm quên mật khẩu hoặc xác minh email trong phase đầu.
- ID đăng nhập:
  - Dài 4-20 ký tự.
  - Chỉ gồm chữ Latin, chữ số và dấu gạch dưới.
  - Không phân biệt chữ hoa/chữ thường.
  - Không cho đổi ID trong phase đầu.
- Không có tùy chọn ghi nhớ đăng nhập lâu dài.
- Đăng nhập trên thiết bị mới sẽ vô hiệu hóa session trên thiết bị cũ.
- Logout dừng game và quay về màn hình đăng nhập.
- Có thể đổi tài khoản trên cùng trình duyệt.

### Nhân vật

- Mỗi tài khoản chỉ có một nhân vật trong phase đầu.
- Tên nhân vật phải unique toàn server.
- Không có avatar và không có xuất thân.
- Tạo nhân vật gồm:
  1. Nhập tên.
  2. Roll 9 thiên phú và chọn 3.
  3. Phân bổ 5 điểm tự do vào Căn Cốt, Thân Pháp, Thần Thức, Linh Căn và Thể Chất.
- Không giới hạn số điểm được dồn vào một chỉ số, nhưng tổng phải đúng 5 và mỗi giá trị phải là số nguyên không âm.

### Save

- Tài khoản và khách đều sử dụng cloud save.
- Game phải online; mất mạng thì pause ngay và hiện màn hình reconnect.
- Khi liên kết mà cả save khách và save tài khoản đều tồn tại, người chơi được xem hai bản và chọn một bản để giữ.
- Không gộp tài nguyên hoặc tiến trình giữa hai save.
- Save không được chọn chuyển sang soft-delete 7 ngày trước khi xóa vĩnh viễn.
- Xóa nhân vật yêu cầu nhập lại mật khẩu và soft-delete 7 ngày.
- Tên nhân vật tiếp tục được giữ chỗ trong thời gian chờ xóa.

## 3. Luồng ứng dụng

```text
Boot
  -> Intro khoảng 3 giây
  -> Login / Register / Chơi ngay
  -> Xác thực hoặc tạo anonymous session
  -> Kiểm tra nhân vật
       -> Có nhân vật: Save Preview -> Load Game
       -> Chưa có: Character Creation -> Game
```

Save Preview hiển thị:

- Tên nhân vật.
- Ba thiên phú.
- Cảnh giới.
- Cấp độ hoặc tầng hiện tại.
- Tổng thời gian chơi.
- Lần hoạt động cuối.

## 4. Kiến trúc dự kiến

### Frontend

Vue/Vite chịu trách nhiệm hiển thị intro, authentication UI, save preview, character creation, game và reconnect overlay.

Frontend không được:

- Lưu mật khẩu.
- Tự quyết định kết quả roll thiên phú.
- Tự ghi đè toàn bộ save mà không có kiểm tra từ server.
- Tiếp tục mô phỏng khi kết nối hoặc session không hợp lệ.

### Backend

Backend chịu trách nhiệm:

- Đăng ký, đăng nhập, logout và anonymous session.
- Ánh xạ ID đăng nhập với danh tính authentication.
- Quản lý một active session trên mỗi tài khoản.
- Kiểm tra tên nhân vật unique.
- Roll thiên phú.
- Tạo nhân vật bằng transaction.
- Lưu, version và xác minh save.
- Liên kết hoặc lựa chọn giữa save khách và save tài khoản.
- Soft-delete, restore và permanent delete.
- Kiểm tra hành động kinh tế và progression quan trọng.

Mật khẩu phải do hệ thống authentication băm và quản lý; không lưu mật khẩu dạng văn bản trong bảng ứng dụng.

## 5. Data model định hướng

Các bảng hoặc miền dữ liệu tối thiểu:

- `profiles`: ID đăng nhập chuẩn hóa và metadata tài khoản.
- `account_sessions`: session hiện hành, thiết bị và thời điểm vô hiệu hóa.
- `characters`: danh tính và trạng thái tổng quan của nhân vật.
- `character_saves`: payload save, schema version và revision.
- `character_talents`: ba thiên phú đã chọn.
- `talent_rolls`: roll đang có hiệu lực và chín lựa chọn do server cấp.
- `game_transactions`: nhật ký nhận/tiêu tài nguyên quan trọng.
- `deleted_characters`: trạng thái soft-delete và thời hạn xóa vĩnh viễn, hoặc các trường tương đương trên `characters`.

Ràng buộc quan trọng:

- ID đăng nhập chuẩn hóa phải unique.
- Tên nhân vật chuẩn hóa phải unique, kể cả trong 7 ngày soft-delete.
- Mỗi account có tối đa một character hoạt động.
- Mỗi save write dùng `saveRevision` để tránh request cũ ghi đè dữ liệu mới.

## 6. Session và kết nối

- Guest credential được giữ trong trình duyệt cho đến khi người chơi xóa site data.
- Guest credential không được dùng để tự động vào game sau khi người chơi chủ động logout.
- Refresh khi đang ở phiên đăng nhập thường sẽ yêu cầu đăng nhập lại vì không có `Ghi nhớ đăng nhập`.
- Mỗi request quan trọng phải kiểm tra session version hoặc session ID hiện hành.
- Khi đăng nhập ở thiết bị mới, backend tăng session version hoặc vô hiệu hóa token cũ.
- Thiết bị cũ pause và hiển thị thông báo đã đăng nhập tại nơi khác.
- Mất kết nối pause ngay; chỉ resume sau khi server xác nhận session và trả trạng thái mới nhất.

## 7. Liên kết save khách

Nếu tài khoản đích chưa có nhân vật:

- Chuyển quyền sở hữu character/save khách sang tài khoản trong một transaction.

Nếu tài khoản đích đã có nhân vật:

1. Hiển thị hai Save Preview.
2. Người chơi chọn bản muốn giữ.
3. Xác nhận lần hai.
4. Chuyển bản còn lại sang soft-delete 7 ngày.
5. Không cộng hoặc trộn dữ liệu giữa hai bản.

Thao tác phải idempotent để retry không tạo hai nhân vật hoặc nhân đôi tài nguyên.

## 8. Phạm vi chống cheat

Phase đầu tối thiểu phải có:

- Thời gian chuẩn từ server.
- Roll thiên phú phía server.
- Xác minh tổng điểm tạo nhân vật.
- Schema validation cho mọi request.
- Authorization theo quyền sở hữu character.
- Optimistic concurrency cho save.
- Idempotency key cho phần thưởng và giao dịch.
- Rate limit cho login, register, reroll và các action nhạy cảm.
- Audit log cho nhận/tiêu tài nguyên quan trọng.

Sau đó chuyển dần sang server-authoritative theo thứ tự:

1. Phần thưởng và drop chiến đấu.
2. Nhận/tiêu tài nguyên.
3. Chế tạo và nâng cấp.
4. Tu vi và progression theo thời gian.
5. Exploration và các tác vụ thời gian dài.
6. Bảng xếp hạng hoặc giao dịch nếu được bổ sung.

Chỉ đưa save hiện tại lên database không đủ chống cheat vì logic game vẫn chạy trên trình duyệt.

## 9. Các phase triển khai

### Phase 1 - Đặc tả nền tảng

- Chốt boot/auth/game state machine.
- Thiết kế database schema và Row Level Security.
- Định nghĩa API contract, error contract và save schema version.
- Lập danh sách hành động client-authoritative và server-authoritative.

### Phase 2 - Backend authentication

- Tạo Supabase project và môi trường development.
- Implement register ID/password.
- Implement login, logout và anonymous session.
- Implement single active session.
- Thêm rate limit và audit cho authentication.

### Phase 3 - Intro và authentication UI

- Intro khoảng 3 giây bằng asset có sẵn.
- Login, Register và Chơi ngay.
- Loading, lỗi xác thực và trạng thái server không khả dụng.
- Dừng boot hiện tại cho đến khi auth/save được giải quyết.

### Phase 4 - Character creation

- Kiểm tra và giữ chỗ tên unique.
- Tích hợp roll/chọn thiên phú theo plan riêng.
- Phân bổ 5 điểm chỉ số.
- Tạo character và initial save trong một transaction.

Trạng thái frontend prototype (2026-08-24):

- Đã có intro 3 giây, Login/Register/Chơi ngay và wizard tạo nhân vật ba bước.
- Đã có validation ID phía client, chọn đúng 3/9 thiên phú và phân đúng 5 điểm.
- Đã nối kết quả tạo nhân vật vào local player/save để kiểm thử end-to-end UI.
- Chưa hoàn thành backend auth, kiểm tra tên unique, server roll và transaction tạo nhân vật; các phần này vẫn thuộc Phase 2/4 phía server.

Hạ tầng Supabase đã scaffold (2026-08-24):

- Migration nằm tại `supabase/migrations/202608240001_online_auth_character.sql`.
- Adapter tự chuyển từ mock sang Supabase khi có `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`.
- Supabase Auth cần bật Anonymous Sign-ins và tắt email confirmation vì phase đầu dùng ID/mật khẩu, không dùng email người chơi.
- Chỉ dùng anon key ở frontend; tuyệt đối không đưa service-role key vào biến `VITE_*`.
- RPC session-sensitive đều xác minh `sessionId` active để thiết bị cũ mất quyền thao tác sau lần đăng nhập mới.

### Phase 5 - Cloud save

- Tách bootstrap hiện tại khỏi `App.vue` thành state rõ ràng.
- Thay local save chính thức bằng cloud save.
- Autosave định kỳ và theo sự kiện quan trọng.
- Thêm `saveRevision`, retry an toàn và xử lý conflict.
- Tắt offline progression không được server xác nhận.

Trạng thái chuẩn bị trong development (2026-08-24):

- Đã tách boot thành state machine: intro, auth, loading save, character creation, initializing, game và error.
- Đã có `CloudSaveService`/`CloudSaveCoordinator` và local adapter dùng optimistic revision.
- Conflict không tự động ghi đè; UI chuyển sang trạng thái lỗi để người chơi quyết định sau này.
- Local save vẫn là nguồn chính trong development. Supabase cloud adapter, autosave và conflict UI đầy đủ được hoãn tới khi save schema ổn định.

### Phase 6 - Save preview và guest linking

- Implement Save Preview.
- Implement chuyển guest save sang tài khoản mới.
- Implement màn hình chọn save khi cả hai bên tồn tại.
- Soft-delete bản không được chọn.

### Phase 7 - Reconnect và session eviction

- Theo dõi network/session health.
- Pause ngay khi mất mạng.
- Resume từ trạng thái server mới nhất.
- Đẩy thiết bị cũ ra khi có login mới.

### Phase 8 - Delete và restore

- Xác nhận lại mật khẩu.
- Soft-delete 7 ngày.
- Restore trong thời hạn.
- Scheduled permanent deletion và giải phóng tên.

### Phase 9 - Hardening và phát hành

- Chuyển các action kinh tế quan trọng lên server.
- Bổ sung logging, monitoring và cảnh báo bất thường.
- Unit, integration, security và E2E tests.
- Type-check và production build.
- Deploy frontend lên Vercel và backend/database lên Supabase.

## 10. Tiêu chí kiểm thử chính

- Đăng ký ID hợp lệ, trùng ID và sai định dạng.
- Login đúng/sai mật khẩu.
- Guest session được phục hồi đúng và không vượt giới hạn Trúc Cơ.
- Hai thiết bị đăng nhập cùng tài khoản.
- Mất mạng giữa tick, save và giao dịch.
- Tên nhân vật trùng hoặc đang soft-delete.
- Giả mạo roll, talent ID hoặc tổng điểm.
- Hai request save cạnh tranh bằng cùng revision.
- Liên kết guest khi tài khoản có hoặc chưa có character.
- Retry không tạo duplicate reward/save/character.
- Xóa, restore và permanent delete sau 7 ngày.

## 11. Giới hạn và việc cần chốt khi triển khai

- Chưa có backend/API trong repository hiện tại.
- Chưa có tài khoản Vercel/Supabase hoặc cấu hình môi trường.
- Cần chọn chính xác cơ chế session/token để việc đá thiết bị cũ có hiệu lực nhanh.
- Cần đặc tả tác dụng gameplay của năm chỉ số chính.
- Hệ thống thiên phú được thiết kế trong tài liệu riêng `talent-system-plan.md`.
