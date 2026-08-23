# Plan: Skill Level và gameplay fixes

## Trạng thái triển khai

Đã triển khai và kiểm thử: auto-progress dừng an toàn khi stage kế bị khóa,
scope Trúc Cơ tầng 18, pose combat/tu luyện, equipment reroll atomic cùng
`realmLevel`, Skill XP/level/scaling/notification/UI và snapshot build giữa
trận. Badge comparison vẫn mặc định ẩn; toggle trực tiếp trên slot là hạng mục
UX riêng chưa được bật. Các nhận định performance chỉ được thay đổi khi có
profiling hoặc test chứng minh regression; hai lần `emitPositions()` hiện phục
vụ hai snapshot khác nhau trong tick và MissileSystem đã cache target theo
`sourceId` trong `pruneDeadTargets()`.

## Quyết định sản phẩm đã chốt

- Progression hiện chỉ được thiết kế tới Trúc Cơ tầng 18. Kim Đan trở lên là dữ liệu giữ chỗ và chưa được mở cho người chơi.
- Boss stage chỉ spawn ở tầng 10 của mỗi chương. `bossEnemyId` ở tầng 1-9 là metadata/reserved data.
- Build combat được snapshot khi bắt đầu trận. Node, trang bị hoặc loadout thay đổi giữa trận chỉ có hiệu lực ở trận kế tiếp.
- Không cần migration save trong giai đoạn phát triển hiện tại. Save schema không hợp lệ có thể bị từ chối rõ ràng thay vì cố phục hồi.
- So sánh trang bị chi tiết hiện lộ bằng tooltip advanced/Alt. Mũi tên ▲/▼ trực tiếp trên slot chỉ được bật khi có UX toggle rõ ràng.

## 1. Thiết kế hoàn chỉnh cho Skill Level

### Mục tiêu

Skill level là progression riêng của từng skill, tăng nhờ sử dụng skill trong combat và không còn đồng bộ theo cảnh giới. Level phải có tác dụng quan sát được, lưu/khôi phục đúng và không thay đổi hiệu lực của trận đang chạy.

### Luật nguồn XP

- Active skill nhận `ACTIVE_SKILL_XP_PER_CAST` đúng một lần khi cast hợp lệ hoàn tất bước kích hoạt. Cast bị từ chối vì cooldown, thiếu tài nguyên hoặc target không hợp lệ không nhận XP.
- Passive skill nhận `PASSIVE_SKILL_XP_PER_TRIGGER` đúng một lần cho mỗi trigger hợp lệ. Passive `per_second` cộng theo số giây nguyên đã thực sự mô phỏng.
- Không cấp XP từ preview UI, countdown trước trận hoặc thao tác mua/equip skill.
- Chốt rõ repeat/progress battle: mỗi cycle/trận tiếp tục cấp XP bình thường; không reset level/XP giữa các trận.

### Level-up và giới hạn

- Skill khởi tạo ở level 1; `experienceRequired` là chi phí lên level kế tiếp.
- `gainExperience()` phải xử lý nhiều level trong một lần cấp XP, cap chính xác ở `maxLevel`, đưa XP dư về 0 tại cap và không tạo vòng lặp khi requirement không hợp lệ.
- Template/runtime phải được tách rõ: template đăng ký không bị mutation dùng chung ngoài ý muốn; trạng thái learned skill mới là dữ liệu level/XP được lưu.
- Skill `maxLevel: 1` không nhận/tích XP và UI hiển thị trạng thái đã tối đa thay vì thanh tiến độ gây hiểu nhầm.

### Hiệu lực level

- Active damage giữ công thức tập trung tại `SkillSystem`: `1 + (level - 1) * 5%`, áp dụng cho mọi damage effect phù hợp đúng một lần.
- Passive modifier dùng `perLevelFlat`/`perLevelPercent` đúng một lần; modifier không khai per-level không bị thay đổi.
- Specialization override vẫn dùng level của skill gốc và không nhân scaling hai lần.
- Level tăng trong trận được ghi vào progression ngay, nhưng effective skill/`skillStats` của `CombatEntity` hiện tại không rebuild. Hiệu lực sức mạnh mới bắt đầu ở trận kế tiếp theo luật snapshot.

### Save và UI

- Xác nhận save chứa `level`, `experience`, `experienceRequired` cho từng learned skill và round-trip không làm mất dữ liệu.
- UI Skill Detail và Loadout hiển thị cùng một nguồn dữ liệu; thanh XP thể hiện XP tới level kế, không dùng `level/maxLevel` làm giả thanh XP.
- Khi level-up, phát một notification/event duy nhất để UI có thể thông báo; không để core phụ thuộc Vue.
- Tooltip ghi rõ bonus hiện tại và bonus level kế tiếp cho damage/per-level modifier khi có.

### Test bắt buộc

- Active cast hợp lệ/không hợp lệ; passive trigger và `per_second` với delta lẻ.
- Một lần XP lên nhiều level; cap; skill `maxLevel: 1`; requirement phòng thủ bằng 0/âm.
- Damage level 1, 2 và max; passive per-level; specialization không double-scale.
- Level-up giữa trận không đổi snapshot hiện tại nhưng có hiệu lực ở trận kế tiếp.
- Save round-trip và UI component cho progress/max level.

## 2. Chặn progression ngoài scope

- Thay gate đại cảnh giới tổng quát bằng điều kiện scope rõ ràng: Trúc Cơ tầng 18 là điểm cuối nội dung hiện tại, không hiện/cho gọi đột phá Kim Đan.
- Giữ luồng đặc thù Phàm Nhân → Luyện Khí và Luyện Khí → Trúc Cơ; không dùng một hằng `CORE_REALM_LEVEL = 12` cho mọi realm.
- Thêm test biên cho Phàm Nhân, Luyện Khí, Trúc Cơ tầng 17/18 và xác nhận Kim Đan không thể vào bằng UI lẫn API.

## 3. Equipment reroll/refine hoàn chỉnh, không migration

- Validate equipment instance trước khi trừ nguyên liệu: template tồn tại, main stat hiện tại thuộc `template.mainStats`, quality hợp lệ và range hữu hạn.
- Đổi `rollMainStat()` sang kết quả thất bại có kiểu hoặc validate ở public boundary; dữ liệu không hợp lệ phải trả failure rõ ràng, không throw xuyên lên UI.
- Chỉ trừ nguyên liệu sau khi mọi validation và phép roll đã thành công; failure phải atomic, không đổi item/bag/modifier.
- Khi refine/upgrade realm thành công, cập nhật đồng bộ cả `realmId` và `realmLevel` dùng để roll/tooltip. Không cho thao tác làm equipment tụt progression.
- Vì không migration, save/instance schema cũ không hợp lệ bị từ chối hoặc thao tác trả lỗi rõ ràng; không đoán stat thay thế ngẫu nhiên.
- Test malformed retained stat, template thiếu range, không mất nguyên liệu khi lỗi, realm metadata sau refine/upgrade và modifier của item đang equip.

## 4. Auto vượt ải kẹt tại 1.5

### Nguyên nhân hiện tại

Tầng 5 không phải cuối zone; mỗi zone kết thúc ở tầng 10. Sau khi thắng 1.5,
`getNextStageInZone()` vẫn trả đúng stage 1.6. Tuy nhiên 1.6 yêu cầu
`realmLevel >= 6`: callback cập nhật `selectedStageId` sang 1.6 trước rồi gọi
`startBattle()`, trong khi `GameManager.startStage()` có thể trả `false` vì stage
chưa mở. Kết quả trả về hiện bị bỏ qua, battle cũ vẫn ở `victory`, countdown đã
về 0 và modal không còn hành động tương tác.

### Hành vi cần triển khai

- Tạo một resolver thuần cho “đích tiếp theo” trả một trong: stage kế tiếp đã mở, stage kế tiếp đang bị khóa, hoặc completed/no destination. Tầng 1-10 phải được coi là cùng một tuyến; tầng 5 không phải boundary.
- Cho `useBattleActions.startBattle()` trả lại kết quả boolean của `GameManager.startStage()` thay vì bỏ qua. Chỉ commit `selectedZoneId`/`selectedStageId` sau khi destination hợp lệ và trận mới thực sự bắt đầu; hoặc lưu selection cũ để rollback khi start thất bại.
- Nếu stage kế tiếp bị khóa bởi cảnh giới (trường hợp 1.5 thắng khi người chơi mới ở tầng 5), dừng auto sạch sẽ, giữ modal ở trạng thái thủ công có nút `Tiếp Tục`/`Đánh Lại`, và có thể hiển thị lý do khóa; không hiển thị `0s` disabled.
- Chỉ chuyển sang zone/chương kế tiếp sau tầng 10. Nếu đã hết nội dung hoặc đích tiếp theo chưa mở, dùng cùng nhánh dừng auto an toàn ở trên.
- Nếu start stage mới thất bại vì dữ liệu/gate: rollback selection, chuyển manual và hiện hành động phục hồi; không để modal không tương tác.
- Countdown phải có trạng thái `idle/running/completed/cancelled`, chống callback chạy hai lần và cleanup khi unmount.

### Test bắt buộc

- 1.4 → 1.5 và 1.5 → 1.6 khi stage kế tiếp đã mở.
- Thắng 1.5 khi realm level chưa đủ mở 1.6 phải chuyển về manual với nút hoạt động, không còn `0s`.
- 1.10 → 2.1 chỉ khi zone/chương kế tồn tại và đã mở.
- Destination/startStage thất bại không làm sai selection.
- Unmount/remount modal và fake timers không tạo hai trận.

## 5. Các vấn đề còn lại

- Cultivation vẫn tăng song song combat, nhưng pose phải dùng `!isFighting`: emit `cultivation_changed` với `false` khi vào countdown/fighting và `true` khi rời combat. Test event transition và animation key.
- Giữ combat snapshot; thêm test/documentation thay vì đồng bộ `skillStats` giữa trận.
- Badge comparison: chưa triển khai ngay. Khi làm UX, thêm toggle có nhãn/keyboard support, mặc định ẩn, rồi mới map delta tổng hợp sang `state.comparison`; Alt tooltip vẫn là nguồn chi tiết.
- Performance findings chỉ xử lý sau profiling. Trước mắt loại duplicate `emitPositions()` nếu test chứng minh cùng tick phát hai payload tương đương; không rewrite collection chỉ vì Big-O với N nhỏ.

## Thứ tự triển khai

1. Fix auto-progress boundary và regression tests vì đang tạo soft-lock UI quan sát được.
2. Chặn progression ở Trúc Cơ 18 và sửa pose cultivation/combat.
3. Làm equipment reroll/refine atomic và đồng bộ realm metadata.
4. Triển khai Skill Level theo contract trên, gồm save/UI/event/tests.
5. Thiết kế toggle badge riêng; sau đó mới profiling và cleanup performance.

## Cổng hoàn thành

- Chạy test mục tiêu cho từng nhóm thay đổi và toàn bộ Vitest.
- Chạy `npm.cmd run type-check` và `npm.cmd run build`.
- Không thêm dependency, không migration save, không thay đổi combat entity giữa trận.
