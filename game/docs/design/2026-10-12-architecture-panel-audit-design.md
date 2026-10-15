# Kiến Trúc — audit và thiết kế đề xuất

Baseline: master local `f2729f0bf`. Trạng thái: đã audit source ban đầu, chưa triển khai. Ảnh người dùng là tham chiếu bố cục; giá và hiệu quả lấy từ runtime. Không xóa file/art/save/branch/worktree trong audit.

## Ruling đã nhận

- Mở mục Tông Môn trên rail, đổi thành Kiến Trúc; gom các control nâng cấp công trình về đây.
- Bỏ hoàn toàn cơ chế worker, theo ruling mới.
- Ký Bảo Các giữ công trình/art, bỏ bán hàng và quy đổi, theo ruling trước.
- Sau panel: khung chiến đấu trực quan theo tiến độ Viễn Chinh Hoàn Mỹ trong Động Phủ.

## Inventory hiệu quả hiện hành

| Công trình | Source / consumer thật | Hiệu quả hiện hành | Xử lý đề xuất |
|---|---|---|---|
| Khai Vật Đường | buildings.ts; BuildingSystem rate/capacity; ProductionPanel | Lv1–9, ngưng tụ Linh Thạch theo realm; hệ số 1 + 0.2 × (level−1); sức chứa bằng 10 giờ sản lượng | Hiện tốc độ/phút và sức chứa current→next; không ghi cấp đội khai thác như ảnh |
| Khí Đường | getCraftModifiers → EquipmentOpsSystem | Lv1–9, giảm chi phí 3 điểm % mỗi cấp sau Lv1, tối đa 24% | Giữ luật thật, không thêm tỷ lệ chế tạo/phẩm khí như ảnh |
| Đan Phòng | getCraftModifiers → GameManagerAlchemyOps; AlchemySystem | Lv1–9; tốc độ 1/1.15/1.32/1.52/1.75/2.01/2.31/2.66/3.06; bonus thành đan 0/5/10/15/20/25/30/35/40 điểm %; thêm slot ở Lv3/6/9 (1→4) | Hiện tốc độ, bonus và slot thật; không tự thêm recipe unlock |
| Truyền Tống Trận | buildings.ts → stage_select | Chỉ Lv1, mở chọn stage | Không có nâng cấp hoặc giảm thời gian di chuyển |
| Ký Bảo Các | buildings.ts; VendorPanel/VendorSystem còn trong master | Chỉ Lv1; source còn bán hàng | Ruling trước supersede source/copy cũ: giữ art, bỏ bán hàng, không nâng cấp giả |
| Chiêu Hiền Quán | WorkerCapacity; BuildingOps; production online/offline | Authored Lv1–9, capacity=1+2×level; Beta dùng pool cố định 3, không hưởng cấp; domain khóa nâng cấp | Bỏ worker; cần chốt giữ art hay bỏ công trình khỏi danh sách, không tự sáng tạo hiệu quả mới |

Giá thật: `BuildingSystem.quoteUpgrade` lấy `template.upgradeCost[currentLevel]`, vật liệu nghề theo tuổi/cảnh giới; realm cần tier ≥ currentLevel+1. Không có giá chung 500/300/200/100 như ảnh. Mọi công trình được reconcile sẵn Lv1, không có luồng xây mới. Tổng công trình/đã xây lấy từ registry/instances.

## Owner và consumer cần chuyển

Owner UI duy nhất là panel Kiến Trúc: current/next effects, quote, thiếu vật liệu và lý do khóa. `BuildingSystem` giữ luật, `BuildingManager` giữ instances; `BuildingOps` điều phối thao tác. Vue không tính luật/chi phí hoặc giữ bản sao authoritative state.

Control đã census: `AlchemyFidelityScene`, `EquipmentFidelityScene`, `FunctionOverlayPanel` (header Production và overlay cũ), qua `BuildingUpgradeButton`, `useBuildingHeaderState`, `useBuildingNavigation`. Chuyển control nâng cấp ra khỏi panel chức năng; các panel vẫn luyện đan, xử lý trang bị, thu hoạch.

Rail: `DongFuStage.NAV_LOCKED` chứa `sect`, chưa có target. Cần destination trong Ui store, beta registry và mount seam; giữ policy các rail khác. `ProductionPanel` còn nâng cấp ProductionSite (Lâm/Quáng/Động Thiên), không thuộc building registry: cần ruling có gom vào chi tiết Khai Vật Đường không.

## Bỏ worker — chuỗi bắt buộc

Roadmap hiện ghi worker là fuel duy nhất cho production. Ruling mới thay contract này; cập nhật roadmap cùng implementation, không chỉ ẩn UI.

Chuỗi online: `GameManagerTickOps → WorkerCapacity/split → ProductionSystem.tickWorkers → WorkerAllocator/WorkerLaneAdvance`. Offline/save: `GameManagerSaveRestore → settleOffline → workerCycles`. Các field/consumer liên quan: `PlayerData.autoWorkerCapacity`, `activeWorkerSlots`, `assignedWorkers`, `WorkerLodgePanel`, `WorkforceView`, decompose reservation và save serializers/validators.

Đề xuất production tự chạy một chu kỳ riêng mỗi site đang bật, không pool/tuyển dụng/phân công/reservation, không đọc cấp Chiêu Hiền Quán. Giữ tốc độ, chi phí, sản lượng, RNG, cap offline và TimeAuthority hiện hành. Online/offline dùng cùng cơ chế tiến chu kỳ. Chuyển tiến độ đang chạy có kiểm soát; restore lặp không thưởng hai lần; dữ liệu worker cũ không tạo thêm luồng. Không tự reset save hoặc cấp hoàn phí.

**Chênh lệch vừa xác minh cần ruling:** `WorkerAllocator` round-robin toàn bộ pool 3 qua các site đang bật. Một site nhận 3 lane; hai site nhận 2/1; ba site nhận 1/1/1. Vì thế đề xuất một chu kỳ riêng/site chỉ giữ nhịp baseline khi cả ba đang bật, không giữ tổng sản lượng ở mọi cấu hình. Chưa được coi là design balance đã chốt. Cần chọn independent per-site baseline hoặc tổng công suất chia qua site đang bật; phương án thứ hai vẫn cần luật phân phối công suất dù không còn worker/tuyển dụng/phân công.

Inventory các file nghỉ dùng trước khi xin phép xóa vật lý. Không làm sống lại feature đang scope-hidden khác.

## Bố cục và concept

Dùng `PcPaperScene/PcPaperChrome` và controls `public/assets/ui/tien-hiep-2026-10` đang phục vụ các panel hiện hành; art công trình từ `DongFuBuildingArt`. Không trộn bộ chrome lịch sử chỉ vì từng có tài liệu handoff.

Theo ảnh: plaque Kiến Trúc + quay lại; hàng tổng quan công trình/vật liệu; grid desktop 3 cột × 2 hàng. Card có art, tên, level/state, current→next effect, vật liệu có/cần, chi tiết và nâng cấp. Bỏ mã ID tiếng Anh khỏi UI. Công trình max-level/dormant không hứa hiệu quả chưa có. Nút vẫn nhận click; domain kiểm tra lúc click, trả lý do tiếng Việt qua i18n. Dùng scale scene hiện hành, không cắt chữ/che rail.

## Khung Viễn Chinh — sau panel

`GameManagerAutoFarmOps` giữ eligibility Hoàn Mỹ, stage lease độc quyền, clock và thưởng; hiện không chạy TurnBattleSystem. Thêm read model/presentation đọc stage, chu kỳ và receipts đã resolve. Khung tái hiện hero/enemy/skill/VFX theo tiến độ, không giả thành combat log thật, không mở trận thứ hai, sửa HP hoặc gọi loot từ animation.

Mất focus, mount lại và reduced-motion không đổi thưởng. Dừng Viễn Chinh gọi domain hiện hành. Đề xuất inset sân chiến đấu trong Động Phủ, ngoài vòng thao tác/rail; có tên stage, tiến độ, trạng thái, Dừng; không che cả màn hình.

## Phương án và trình tự

1. Chỉ gom UI, giữ worker: không đạt ruling, loại.
2. Gom UI + thay worker bằng chu kỳ production riêng từng site: đề xuất; giữ balance hiện hành.
3. Sáng tạo hệ lợi ích công trình/nhân lực mới: chưa có ruling, không chọn.

Sau duyệt: task card/brief và worktree mới; thay worker, kiểm tra online/offline/save/reopen; read model upgrades và migrate UI; hoàn thiện panel/art; full verify + Playwright trong worktree; sau đó khung Viễn Chinh và thử mount/unmount/stop/reload/background/reduced-motion. Reviewer Luna 6, OCR và review resulting-state. Không tuyên bố xong trước evidence runtime.

## Ruling cuối cần chốt

- Sau bỏ worker: giữ Chiêu Hiền Quán như công trình/art không nâng cấp, hay bỏ khỏi danh sách công trình? Không có hiệu quả thay thế được phép.
- Nâng cấp từng Lâm/Quáng/Động Thiên: chuyển vào chi tiết Khai Vật Đường hay giữ tại Sản Xuất?
- Duyệt thiết kế: production tự chạy giữ nhịp hiện tại; panel theo ảnh nhưng hiệu quả/giá thật; khung Viễn Chinh chỉ làm presentation.
