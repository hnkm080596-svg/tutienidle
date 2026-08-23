# Talent System Plan

## 1. Mục tiêu

Xây hệ thống Thiên Phú cho bước tạo nhân vật:

- Mỗi lần server roll 9 thiên phú khác nhau.
- Người chơi chọn đúng 3 thiên phú.
- Reroll không giới hạn.
- Không được khóa lựa chọn khi reroll.
- Thiên phú có độ hiếm và trọng số xuất hiện.
- Kết quả roll và lựa chọn cuối cùng được server xác minh.
- Thiên phú tạo hướng build và khác biệt lối chơi, không chỉ là ba bonus số học mạnh nhất.

Hệ thống Thiên Phú thay thế hoàn toàn khái niệm Xuất Thân trong character creation và Save Preview.

## 2. Nguyên tắc thiết kế

- Thiên phú hiếm nên độc đáo hơn, không mặc định luôn mạnh hơn thiên phú thường.
- Thiên phú mạnh cần điều kiện, giới hạn hoặc đánh đổi phù hợp.
- Tránh thiên phú tạo lựa chọn bắt buộc cho mọi build.
- Mỗi thiên phú phải có tác động đo được và test được.
- Effect phải được biểu diễn bằng dữ liệu có kiểu rõ ràng; không thực thi logic từ chuỗi mô tả.
- Save chỉ lưu `talentId`, không sao chép toàn bộ definition.
- Mọi modifier phải đi qua hệ thống stat/effect hiện có hoặc một extension được kiểm soát.

## 3. Nhóm thiên phú

Catalog ban đầu nên phủ các nhóm:

- Tu luyện và đột phá.
- Chiến đấu tổng quát.
- Sinh tồn và phòng thủ.
- Tài nguyên và thu thập.
- Chế tạo và công trình.
- Ngũ hành và phản ứng nguyên tố.
- Kỹ năng hoặc loại đòn đánh.
- Thiên phú đánh đổi/risk-reward.
- Thiên phú thay đổi cơ chế chơi.

Mỗi thiên phú có thể mang nhiều tag để hỗ trợ lọc, phân tích tổ hợp và điều kiện loại trừ.

## 4. Độ hiếm và trọng số khởi điểm

| Độ hiếm tạm | Trọng số | Vai trò |
|---|---:|---|
| Phàm | 55 | Bonus đơn giản, dễ hiểu |
| Linh | 28 | Bonus mạnh hơn hoặc có điều kiện |
| Địa | 12 | Định hình một phần lối chơi |
| Thiên | 4 | Cơ chế đặc biệt hoặc đánh đổi rõ ràng |
| Dị | 1 | Thay đổi đáng kể cách xây dựng nhân vật |

Các tên và trọng số trên là baseline để mô phỏng, chưa phải cân bằng cuối cùng.

Reroll vô hạn khiến độ hiếm trở thành chi phí thời gian. Vì vậy:

- Không thiết kế theo hướng `Dị > Thiên > Địa` trong mọi trường hợp.
- Tập trung vào độ độc đáo và độ chuyên biệt khi rarity tăng.
- Rate limit reroll để bảo vệ backend, không dùng rate limit làm chi phí gameplay.
- Theo dõi số lần reroll và lựa chọn thực tế để cân bằng sau phát hành.

## 5. Quy mô catalog đề xuất

Mục tiêu nội dung cho phiên bản đầu:

- 15 thiên phú Phàm.
- 12 thiên phú Linh.
- 8 thiên phú Địa.
- 5 thiên phú Thiên.
- 3 thiên phú Dị.

Tổng mục tiêu: khoảng 43 thiên phú.

Có thể triển khai kỹ thuật bằng 15-20 thiên phú thử nghiệm trước, nhưng không nên xem đó là catalog đủ để phát hành vì mỗi roll đã hiển thị 9 lựa chọn.

## 6. Data model định hướng

```ts
type TalentRarity = 'pham' | 'linh' | 'dia' | 'thien' | 'di'

type TalentTag =
  | 'cultivation'
  | 'combat'
  | 'defense'
  | 'resource'
  | 'crafting'
  | 'element'
  | 'skill'
  | 'risk_reward'
  | 'mechanic'

interface TalentDefinition {
  id: string
  name: string
  description: string
  rarity: TalentRarity
  weight: number
  tags: TalentTag[]
  effects: TalentEffect[]
  incompatibleTalentIds: string[]
  enabled: boolean
}
```

`TalentEffect` phải là discriminated union. Các nhóm effect dự kiến:

- Cộng base stat.
- Increased/more modifier có điều kiện.
- Thay đổi tốc độ hoặc hiệu quả tu luyện.
- Tăng sức mạnh/kháng/xuyên kháng nguyên tố.
- Thay đổi tài nguyên, drop hoặc crafting.
- Trigger khi đáp ứng điều kiện chiến đấu.
- Bonus kèm penalty.
- Mở hoặc thay đổi một mechanic cụ thể.

Không dùng `any` hoặc object effect không được xác định schema.

## 7. Quy trình roll phía server

1. Client gửi yêu cầu reroll với session và character-creation draft hiện tại.
2. Server kiểm tra session, trạng thái draft và rate limit.
3. Server tạo `rollId` không đoán được.
4. Server weighted-sample 9 thiên phú không trùng nhau.
5. Server áp dụng enabled flag, prerequisite và incompatibility rules.
6. Server lưu roll có thời hạn.
7. Client chỉ hiển thị 9 kết quả server trả về.
8. Reroll mới vô hiệu hóa roll trước; không giữ lại lựa chọn nào.
9. Khi xác nhận, client gửi `rollId` và đúng 3 `talentId`.
10. Server xác minh cả ba ID thuộc roll còn hiệu lực và không trùng nhau.
11. Ba thiên phú chỉ được gắn vào nhân vật trong transaction tạo character.

Đề xuất rate limit ban đầu: tối đa một reroll mỗi giây trên mỗi session, sau đó điều chỉnh bằng telemetry.

## 8. Luật tổ hợp

- Chín lựa chọn trong một roll không được trùng ID.
- Ba lựa chọn cuối không được trùng ID.
- Các cặp loại trừ tuyệt đối không được cùng xuất hiện trong selection hợp lệ.
- Nếu incompatibility chỉ tạo ra quyết định thú vị chứ không làm build vô hiệu, có thể cho cùng xuất hiện để người chơi tự chọn.
- Không bảo đảm mỗi roll có một thiên phú hiếm; rarity tuân theo trọng số.
- Cần đặt giới hạn số lần resample nội bộ để tránh vòng lặp khi catalog bị lọc quá hẹp.
- Nếu không đủ 9 lựa chọn hợp lệ, server trả lỗi cấu hình thay vì roll trùng.

## 9. Character Creation UI

### Màn hình roll

- Lưới 3x3 gồm 9 thẻ thiên phú.
- Mỗi thẻ hiển thị tên, độ hiếm, mô tả, tag chính và đánh đổi nếu có.
- Click để chọn/bỏ chọn.
- Hiển thị `Đã chọn x/3`.
- Nút xác nhận chỉ bật khi chọn đúng 3.
- Nút Reroll thay toàn bộ 9 thẻ và yêu cầu xác nhận nếu đang chọn dở.
- Không có chức năng khóa thẻ.

### Khả năng đọc

- Màu rarity không phải dấu hiệu duy nhất; cần tên hoặc biểu tượng rarity.
- Mô tả phải nêu rõ con số, điều kiện và penalty.
- Tooltip giải thích các thuật ngữ gameplay chưa quen thuộc.
- Các thẻ có effect chưa khả dụng ở giai đoạn đầu game phải nói rõ thời điểm phát huy tác dụng.

## 10. Quy trình thiết kế catalog

### Bước 1 - Inventory mechanic hiện có

- Liệt kê stat và modifier mà game engine đang hỗ trợ.
- Liệt kê event/trigger có thể quan sát an toàn.
- Liệt kê mechanic cần mở rộng engine.
- Không thiết kế effect không thể kiểm tra hoặc không có điểm tích hợp rõ ràng.

### Bước 2 - Ma trận nội dung

Lập ma trận theo:

- Nhóm gameplay.
- Rarity.
- Giai đoạn phát huy sức mạnh.
- Build được hỗ trợ.
- Bonus và penalty.

Mục tiêu là tránh catalog dồn quá nhiều vào combat hoặc một nguyên tố.

### Bước 3 - Bộ thử nghiệm

- Viết 15-20 thiên phú đầu tiên.
- Ưu tiên effect sử dụng stat/modifier hiện có.
- Chỉ thêm mechanic mới khi nó phục vụ nhiều thiên phú hoặc hệ thống khác.
- Review wording và khả năng test trước khi code.

### Bước 4 - Simulator

- Mô phỏng hàng trăm nghìn roll.
- Kiểm tra tỷ lệ rarity thực tế.
- Kiểm tra tần suất từng thiên phú.
- Kiểm tra số lần resample vì incompatibility.
- Kiểm tra xác suất xuất hiện các tổ hợp mạnh.

### Bước 5 - Balance tổ hợp

- Lập danh sách tổ hợp ba thiên phú có khả năng cộng hưởng.
- Test damage, defense, economy và progression ở nhiều mốc cảnh giới.
- Đặt diminishing return, cap hoặc incompatibility khi cần.
- Tránh nerf chỉ dựa trên rarity; cân bằng theo tác động thực tế.

### Bước 6 - Hoàn thiện catalog

- Mở rộng đến khoảng 43 thiên phú.
- Bổ sung localization-ready text nếu dự kiến đa ngôn ngữ.
- Khóa ID ổn định trước khi save production tồn tại.
- Thay đổi/xóa thiên phú sau phát hành phải có migration hoặc compatibility mapping.

## 11. Telemetry đề xuất

Không thu thập dữ liệu cá nhân ngoài nhu cầu vận hành. Các event cân bằng hữu ích:

- Số lần reroll trước khi xác nhận.
- Rarity xuất hiện theo roll.
- Tỷ lệ chọn của từng thiên phú.
- Các bộ ba thường được chọn cùng nhau.
- Tỷ lệ bỏ character creation.
- Progression và hiệu quả build theo bộ thiên phú.

Telemetry không được dùng làm nguồn dữ liệu authoritative cho save.

## 12. Kiểm thử

### Unit

- Weighted sampling đúng phân bố trong tolerance.
- Không có ID trùng trong 9 lựa chọn.
- Disabled talent không xuất hiện.
- Incompatibility và prerequisite được áp dụng đúng.
- Roll cũ vô hiệu sau reroll.
- Chỉ chấp nhận đúng 3 ID thuộc roll hiện hành.

### Integration/security

- Không thể tự gửi talent ID chưa được roll.
- Không thể dùng roll của tài khoản khác.
- Không thể replay roll đã dùng hoặc hết hạn.
- Spam reroll bị rate limit.
- Transaction lỗi không tạo character nửa chừng.

### Balance

- Mô phỏng phân bố rarity và từng talent.
- Test các tổ hợp cực đoan.
- Test hiệu quả ở đầu, giữa và cuối progression hiện có.
- Test tương tác với save/load và thay đổi version.

### UI/E2E

- Lưới 3x3 hiển thị đúng.
- Chọn/bỏ chọn và giới hạn 3.
- Reroll xóa selection cũ.
- Refresh phục hồi draft/roll hợp lệ.
- Xác nhận tạo nhân vật chỉ khi đủ tên, 3 thiên phú và 5 điểm chỉ số.

## 13. Việc cần chốt trước khi implement catalog

- Ý nghĩa và scaling chính xác của Căn Cốt, Thân Pháp, Thần Thức, Linh Căn và Thể Chất.
- Bộ effect nào có thể dùng trực tiếp từ stat system hiện tại.
- Tên chính thức của năm bậc rarity.
- Danh sách 15-20 thiên phú thử nghiệm đầu tiên.
- Quy tắc có cho phép chỉnh/sửa thiên phú sau khi nhân vật đã được tạo hay không; mặc định plan này coi lựa chọn là vĩnh viễn.
