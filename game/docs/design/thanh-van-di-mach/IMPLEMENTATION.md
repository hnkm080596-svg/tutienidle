# Kế hoạch triển khai — Thanh Vân Dị Mạch (12 quest, 3 hồi)

**Mốc thiết kế:** 2026-10-14 | **Mốc code đối chiếu:** `master` @ `e894af77b` | **Trạng thái:** đề xuất kế hoạch, chưa thực thi. **Điều phối:** quest-domain owner; reviewer nội bộ độc lập khi có. Mỗi PR là một phạm vi có thể kiểm thử, **không commit/push/merge nếu chưa được người dùng cho phép**.

## T0 — Task card / G0–G1

**Hành vi:** một chuỗi chính tuyến duy nhất 12 quest; người chơi thấy mục tiêu và thưởng đúng; tiến độ tăng từ action thật sau activation; claim một lần, consume vật liệu đúng, save/reopen giữ trạng thái; không kẹt tại cửa cảnh giới/ải. **Owner:** `QuestSystem` (admission/progress/claim); `QuestManager` (trạng thái); domain chiến đấu/sản xuất/luyện đan/stage (sự kiện thành công); `RewardSystem` (cấp thưởng); Vue (hiển thị). **Chuỗi thật:** create/restore/realm-change → reconcile → quest progress receives authored event → claim from UI/ops → owner revalidates → reward → completed-once → next reconcile. **Không thuộc phạm vi:** thay đổi công thức chiến đấu, boss art, UI tổng thể, ngũ hành ngoài Hỏa, tự động mở cảnh giới, thêm daily, thêm gacha.

**Q1/Q2/Q3:** authority ở trên, save `GameSave` quest state; `completedStageIds` do stage authority ghi; không dùng UI làm nguồn thành tích. **Q4–Q6:** production callers nêu tại README; dùng existing `collect/kill/flag` trước, đặt `stage_clear` type ở core/quest và phát sự kiện ở stage completion seam; không thêm domain→Vue import. **Q7–Q9:** reward ở domain claim, UI chỉ đọc projection, không coi animation là chiến thắng. **Q10:** lặp claim, restore, duplicate kill/stage settle và bag overflow cần chứng minh exactly-once; stage witness phải dedupe. **Q11:** mainline 15 quest + carried saves là đường cũ đang được dùng; không xóa lặng. **Q12:** mỗi PR có test, screenshot nếu ảnh hưởng runtime, Gate chung bên dưới; lúc hoàn tất phải có report bằng chứng toàn chuỗi.

## T1 — Quyết định dữ liệu trước production: cutover save (PR nền)

1. Snapshot danh mục 15 ids theo `quests.test.ts`; census save version/restore của `QuestManager` và `GameSave`, xác định có giữ save beta đang chơi không. **Đề xuất mặc định: giữ save**. Thiết kế `catalogVersion` cho chính tuyến hoặc migration idempotent khi restore (chạy một lần có witness version); không làm migration khi chỉ mở UI.
2. Nhóm mapping mục tiêu: Q01←old `main_02`; Q02←old `main_01`/`main_03`/`main_05`; Q03←old `main_04`; Q04←old `main_06`; Q05←old `main_07`/`main_08`/`main_12`; Q06←old `collect_tu_linh_thao_1`; Q07←old `main_10`; Q08←old `collect_qi_refining_ore_decade_1`; Q09←old `main_13`; Q10←**mới** (standalone `collect_foundation_ore_30` không mặc nhiên chuyển sang đã hoàn thành); Q11←old `main_14`; Q12←old `main_15`. Đây là **mức tương ứng ý nghĩa**, không phải câu lệnh tự động copy counter.
3. Chỉ đánh dấu Q đã hoàn thành nếu có witness old completed đủ điều kiện **và** tất cả predecessor mới đã hoàn thành; không nhận thưởng mới cho quest đã được ánh xạ. Với progress cũ đang hoạt động: giữ ở legacy-state ledger cho audit và chỉ chuyển con số nếu `kind`/`target`/`unit` tương đương, giới hạn `min(oldProgress,newAmount)`; trường hợp khác khởi động progress mới từ 0 cùng thông báo chuyển phiên bản (không sửa kết quả inventory). Xử lý old claim đã xong nhưng new predecessor chưa xong bằng trạng thái deferred-compatible; bảo toàn chống thưởng trùng.
4. Test với save mới; save đang active 2/3 ore; save old main10 completed; save claim cuối act; load lặp lại hai lần; lỗi migration giữa chừng; cùng một reward không xuất hiện hai lần. **Stop:** không quyết định rõ giữ save/wipe thì không cutover.

## T2 — Chuẩn hoá chứng cứ stage-clear (PR engine độc lập)

1. Thêm `QuestCondition` kiểu `stage_clear {stageId,amount:1}` và xử lý trong `QuestSystem` theo quan hệ owner event, chỉ khi chiến đấu thực tế đã kết thúc thắng và stage owner ghi completed stage; không phát từ UI/VFX.
2. Chọn chính sách retroactivity **rõ ràng**: boss stage-clear là achievement có thể đã đạt trước khi quest admission; tránh softlock vì boss đã clear, nên tại activation dùng **completedStageIds** đã lưu làm witness cho Q04/09/12, nhưng không auto-claim/reward. Các quest `collect/kill/flag` giữ non-retroactive hiện hành. Nếu không muốn stage replay miễn phí, đây là đường bắt buộc. Chỉ kiểm tra read-only data khi reconcile command, không khi UI get.
3. Stage completion event trùng/retry/restore không tăng count quá 1; `stage_clear` target phải tồn tại `STAGES`; no kill 1 unit shortcut. Test boss floor có nhiều enemy cùng boss ID, thua/abort không tính, stage đã clear trước admission tính đúng, các lần chơi lại không thưởng thêm.

## T3 — Catalog, đối tượng và phần thưởng (PR content)

1. Implement từng quest dựa theo **card Q01–Q12** dưới thư mục này, `id=tvdm_XX`, `chainId:'mainline'`, `cadence:'once'`, predecessor tuyến tính Qn-1; Q05 `requiredRealmId='qi_refining'`, Q10 `'foundation_establishment'`; build lại `quests.test.ts` membership/order/unlock/beta roster/cross-domain IDs. Chỉ đưa quest đã có witness thật; song song engine PR nếu boss yêu cầu stage_clear.
2. Ban đầu nhập **base reward** đã ghi trong card, so sánh projection thực nhận với hệ số x1/x8/x50; nghiệm thu 12 tổng thưởng, pill có thật, không scale insight. Test material consumed tại claim, quy trình thiếu vật liệu báo lỗi tiếng Việt, claim lặp không tái cộng, inventory full đưa cảnh báo theo existing policy.
3. Validate nguồn nguyên liệu (gỗ/khoáng Phàm, dược Luyện Khí, khoáng Luyện Khí, khoáng Trúc Cơ) có thể đến sau activation, nguồn không bị realm/hành khóa, lượng 2 trong thời gian mục tiêu. Không hứa độ dài chờ nếu chưa đo gameplay. Baseline challenge: run earlygame sim; nếu thất bại boar đầu, cân bằng thuộc PR riêng có scope được duyệt.
4. Gate chuyển hồi: Q04 claim không tự đưa lên Luyện Khí, Q09 claim không tự đưa lên Trúc Cơ; thông báo và nút định hướng chỉ đến hệ cảnh giới. Chỉ mở Q05/Q10 khi realm đã chuyển thật.

## T4 — Narrative projection và Quest UI (PR presentation)

1. Thêm catalog copy hiển thị theo id ở data/presentation projection (nếu hỗ trợ `introText`, `completionText`, `hintText`, `ctaDestination`); không thêm cache/mutable quest progress ở Vue. Mỗi card có nội dung thoại/hint/kết đầy đủ.
2. UI phân biệt `LOCKED`, `ACTIVE`, `READY_TO_CLAIM`, `COMPLETED`; chỉ claim khi domain cho phép, còn lại nút vẫn phản hồi bằng lý do rõ ràng (không dead `disabled`). Hiển thị `progress x/y`, yêu cầu sở hữu đủ vật liệu lúc nộp, reward **actual** (không raw), nguồn vật liệu/ải theo card.
3. Deep link tới Sản Xuất / Thám Hiểm / Đan Phòng / Cảnh Giới nếu router hiện hỗ trợ; nếu chưa, hiển thị hướng dẫn chữ và không render CTA giả. i18n cho mọi UI control, error, notification; `name`/`description` từ authored data theo chính sách content của dự án. Visual 1672×941 và 1280×720, keyboard/scroll và trạng thái túi đầy.

## T5 — Bộ test thực hiện theo nhiệm vụ (mỗi quest có checklist riêng)

| Quest | Trường hợp riêng trọng yếu | Điều kiện PASS |
|---|---|---|
| Q01 | Spawn có sẵn 15 wood; sau activation thu 1→2; nộp trừ 2 | Không retrocount, không kẹt, +15/+20 |
| Q02 | Quái khác không tính; chết không ghi kill; kill Dã Trư đủ 2 | 2/2 mới nhận; +20/+40 |
| Q03 | Spawn có sẵn 6 ore; thu 2 mới; tiêu hết ore trước claim | Báo thiếu hàng; đủ hàng lại claim +25/+50 |
| Q04 | Một kill boss vs trọn `mortal_dong_10`, replay, stage clear có trước activation | Clear thật mới ready; +60/+120; không mở Qi sai |
| Q05 | Claim Q04 khi còn Mortal, rồi ritual Luyện Khí | Trước realm gate không active; 3 bandit +160/+200/+400 |
| Q06 | Herb từ đúng nguồn/ID; herb có sẵn trước activation; hụt bag | 2 đơn vị mới; trừ 2; +160/+800 |
| Q07 | Craft thất bại, craft thành công trước/sau activation, túi pill đầy | Chỉ 1 successful new craft; +200 +1 pill hoặc overflow warning |
| Q08 | Ore Qi sai tuổi/sai realm; bị tiêu vào enhance trước claim | Chỉ đúng id; đủ nộp; +200/+800 |
| Q09 | Boss-ID xuất hiện nhiều con; clear `qi_refining_abyssal_pool`; Foundation gate | Stage clear đúng; +480/+1200; không bỏ qua tribulation |
| Q10 | Ở Qi đã có khoáng TC; đến Foundation mới activate | Chỉ tiến độ nhận mới sau active; +750/+2000 |
| Q11 | 3 wolf đúng ID; thắng stage khác không đếm nhầm | +1250/+3500, không trùng event |
| Q12 | Thua/exit rồi thắng `foundation_floor_10`; replay, save/reopen | Một lần claim +4000/+8000; kết thúc câu chuyện đúng |

## G4/G5 — Evidence và tiêu chuẩn bàn giao

Với thay đổi production mỗi PR cần đúng P3 quick/full theo mặt ảnh hưởng, P18 OCR, P13/P14 Playwright cho wiring/quest UI, P4 adversarial, 3+ sequential reviews trên trạng thái sau sửa; kiểm tra fixed-point protocol hiện hành (không tuyên bố fixed-point từ docs). Tối thiểu kiểm tra `npm run type-check`, `npx vitest run` các bộ liên quan; khi đổi wiring/root, milestone/cutover thì `npm run verify`. Test E2E chạy từ implementation worktree, screenshot quest collect progress, claim, gate, boss clear, save/reopen, 2 cỡ màn hình; âm thanh hiện tại không thuộc scope — nếu có tiếng hiệu ứng quest mới cần đánh giá âm lượng/không phát lặp.

**Phân ranh PR gợi ý:** PR-Q1 snapshot/save compatibility; PR-Q2 stage-clear; PR-Q3 Act I catalog & tests; PR-Q4 Act II catalog & tests; PR-Q5 Act III catalog & tests; PR-Q6 narrative/projection/UX; PR-Q7 tổng hợp runtime QA & balance. PR-Q3–Q5 phụ thuộc engine/cutover review; có thể làm trên nhánh riêng nhưng chỉ bật đủ 12 quest đồng thời khi graph hợp lệ. **Tất cả file trong checkout đang dirty khác công việc:** triển khai production mới cần worktree riêng ở `.agent-worktrees/<task>` và tránh đè sửa dở của người khác.
