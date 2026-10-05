# Tiên Hiệp UI — thiết kế PC và wiring

**Current workflow — 2026-10-05:** art creation and interactive previews, one scene at a time. No further production wiring in this phase. See [ART-PREVIEW-WIRING-SPEC.md](ART-PREVIEW-WIRING-SPEC.md) for the current completion boundary and user-requested behavior to retain in future integration. Auth review runs at `/ui-auth-preview.html`. The production-wiring status below records earlier work and is historical.

**DESIGN APPROVED / PRODUCTION WIRING IN PROGRESS — 2026-10-05.** Người dùng đã duyệt bộ thiết kế tại `http://127.0.0.1:5449/ui-design-review.html` và cho phép nối chức năng hiện có. Implementation cũ bị chấm 1/10 là lịch sử đã bị thay thế, không phải chuẩn để nghiệm thu. PC trước, mobile sau.

Bộ gallery có 32 bố cục dùng chung giấy ngà ấm, hoa văn vàng, mực sơn thủy, slot/nút/inspector và font Source Serif 4 cục bộ. Production đang chuyển sang các component này; bằng chứng gallery không thay thế bằng chứng thao tác trong game. Nhân vật động vẫn dùng art hiện có; Luyện Thể/Kinh Mạch/Chu Thiên dùng sơ đồ và hiệu ứng điểm huyệt Arcadia đã duyệt.

Ranh giới: chỉ trình bày và nối consumer hiện có, không thay đổi dữ liệu, lệnh, admission, chi phí, thời gian hay save. Xung đột chức năng phải hỏi người dùng trước khi sửa phần phụ thuộc. Quyết định đã chốt: màn tạo nhân vật hiển thị **Chiêu mở đầu**, **Linh Bạo mở; Trảm và Huy Quyền khóa**, không bổ sung lựa chọn Đạo Lộ hoặc thay payload khởi tạo.

Đọc `SHARED-VISUAL-CONTRACT.md`, `REBUILD-EXECUTION.md`, `UI-SHARED-CONSUMER-MAP.md` và các `WIRE-*-G5.md` để biết composition, owner, consumer, kiểm tra và khoảng trống hiện tại. Chưa có tuyên bố QA fixed point hoặc nghiệm thu toàn bộ production. Các mô tả pack/preview cũ bên dưới là lịch sử.
| Thuộc tính | Giá trị |
|---|---|
| Branch | codex/tien-hiep-ui-redesign |
| Worktree | E:/tutienidle/.agent-worktrees/hoa-cau-fireball-vfx |
| App root | E:/tutienidle/.agent-worktrees/hoa-cau-fireball-vfx/game |
| Git HEAD được audit | f8af8007b0b6519e6aa6997fedad2cc77939538a |
| Commit/push | Chưa thực hiện; toàn bộ implementation là thay đổi local trong worktree này |
| Phạm vi | Toàn bộ UI: auth → home → progression → collection/workshop → battle/tribulation → results → system dialogs |

## Dùng bộ bàn giao

1. Đọc **WIRING-PLAN.md**: thứ tự thực hiện, consumer thực, ranh giới và điều kiện nghiệm thu.
2. Đọc **SCENE-SPECS.md**: bố cục, dữ liệu, owner và state cho từng nhóm màn.
3. Dùng **game/public/assets/ui/tien-hiep-2026-10/pack.json** và **source/**: 23 PNG gốc cùng khung v2 bổ sung, sourceRect, slice, vùng chữ và mapping chrome. Script `game/scripts/build-tien-hiep-ui.mjs` tạo runtime derivatives.
4. Đối chiếu **component-census.csv**, **existing-chrome-census.csv**, **ui-art-consumer-search.txt** để tìm consumer ngoài registry. Census có 286 Vue files, 237 reachable qua literal imports từ main; không được coi đó là bằng chứng mounted route.
5. Game thật chạy từ app root tại **http://127.0.0.1:5449/**. **/ui-secondary.html** là fixture riêng cho bề mặt còn scope-hidden; không mở chúng trong bản beta. **preview.html**, server authoring và zip ban đầu là tài liệu lịch sử của giai đoạn art, không đại diện code runtime mới nhất.

Từ worktree chạy:

```powershell
node game/docs/design/tien-hiep-ui-redesign-2026-10-05/preview-server.mjs
```

Server in ra URL localhost với port được cấp tự do. Có thể chọn Nhân Vật, Động Phủ, Trang Bị, Kỹ Năng, Công trình, Chiến đấu, Cài Đặt hoặc Bộ art. Nhấn nhân vật ở Động Phủ để mở vòng chức năng. Các số “—” là vùng chờ model, không phải balance mới.

## Hướng mỹ thuật đã chốt

Giấy ngà có vân, mực than và vàng cổ, nền sơn thủy ban ngày có cung điện và thác. Dùng art rời; chữ, icon chức năng, số, badge, progress và feedback ghép từ hệ thống. Nền mới không chứa nhân vật hoặc UI. Nhân vật động, portrait, logo, item/skill icons, cauldron và building props hiện có được dùng lại. Không thay tên game theo chữ “Tiên Hiệp” trong ảnh tham khảo.

22 component: page/panel/slot/orb/avatar frames; paper; rail; primary/secondary buttons; title/section/building/tab/resource/identity plates; list row; text field; progress track; divider; gold/red ceremony ribbons; power ribbon. Asset thứ 23 là world-vista. Asset dùng chung giữa màn, không cần một hình nền UI riêng cho mỗi màn.

Min desktop 1280×720, reference 1672×941, Full HD 1920×1080. Chữ body 16–18px, title 28–38px; tên dài được wrap hoặc inspector đọc đủ; số tabular. Dưới 1280 ưu tiên tab/detail drawer và scroll có chủ đích, không thu cả game xuống đến mức không đọc được.

## Đã kiểm tra / giới hạn bằng chứng

- **PASS cấu trúc:** 23 source tồn tại, SHA-256, kích thước/sourceRect hợp lệ, slice không chồng, aperture của frame/orb/avatar trong suốt; 43 registry entries đều được map hoặc giữ/suppress có lý do. Xem PACK-VALIDATION.json và source-metrics.json.
- **PASS authoring preview:** inspected compositing trên giấy và mực; các nhóm bố cục đã mở trong browser. Character/reference desktop, settings/workshop/combat tại 1280×720, character tại 1920×1080; wheel đóng mặc định và mở khi bấm. Browser không ghi nhận warn/error trong lần kiểm tra cuối.
- **Không tuyên bố production PASS:** chưa thay registry/consumer, chưa kiểm thử command, progression, save, combat hoặc dữ liệu runtime thật; đó là nhiệm vụ wiring, không phải phần art còn thiếu.
- PNG có màu RGB ẩn ở alpha 1–5/255 trên vài cạnh; không phải viền đỏ đậm trong compositing thực. Không dùng RGB của pixel gần trong suốt để kết luận lỗi. Không chỉnh sửa alpha/pixel hoặc ghi đè art cũ.

Giữ raw source độ phân giải cao. Không có bộ crop 1×/2× riêng: renderer dùng sourceRect và slice source pixels. Chữ và icon không nằm trong bitmap. Tất cả art mới tintable=false; không áp phép tint grayscale cũ.

## Quyết định user bắt buộc

- UI-only; giữ owner, command và rule hiện tại.
- Thuật ngữ Đạo Lộ; skin chung, glyph/màu phụ phân biệt đạo lộ.
- Wheel chỉ hiện khi bấm nhân vật.
- Thiên Cơ dùng chain sẵn trong HEAD.
- Button khóa không nhận action; lý do đọc được cạnh nút hoặc phần detail có thể focus.
- Màn release-scope-hidden vẫn hidden, nhưng SCENE-SPECS thiết kế đầy đủ.
- Không vẽ nhân vật/logo; nếu thực sự cần custom art động khi wiring, dùng Arcadia theo tài liệu tooling.
- Agent khác wiring sau authoring; không commit/push/integrate tự động.

AUDIT-AND-HANDOFF-PLAN.md là lịch sử audit ban đầu; các trạng thái draft/HOLD trong đó đã được supersede bởi README, pack và kết quả kiểm tra cuối này.
> Current phase (2026-10-05): visual-first shared design reconstruction. Existing production visuals were rejected. New paper/landscape/auxiliary prototypes are not production-wired or completion-certified. No commit/push/integration has occurred.
