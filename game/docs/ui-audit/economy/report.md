# UI/UX Deep-Scan — Slice: economy-social

**Branch:** `devin/ui-scan-economy` · **Reviewer:** Devin (1/4) · **Target:** `origin/master`
**Viewport chính:** 1600×900 · **Adversarial pass:** 820×900, locale `en`, empty/disabled states.

## Cách tiếp cận các màn hình bị gate

Save được seed trực tiếp vào `localStorage["tien-hiep-idle-save:guest"]` (shape hợp lệ theo `saveShapeValidation`/`assertSaveAcceptable`: Trúc Cơ tầng 3, con đường kiếm, đầy đủ `cultivationPath`/`techniques`/`swordPath`/`purchasedNodeIds`). `lastSavedAt` bị làm cũ để kích hoạt modal offline settlement tự nhiên lúc boot. Trong page, panel được mở qua `ui.openLeftPanel(...)`/`ui.openStandalonePanel(...)` và action game qua `gameManager.<domain>Ops` (ví dụ `alchemyOps.startAlchemyJob`, `questOps.notifyMaterialGained`, `economyOps.sellMaterialToVendor`, `companionOps.feedCompanion`, record `companionGifts` được inject để xem flow claim). Không chỉnh production code.

## Verdict tổng quan

Nền tảng UI **khá chắc**: mọi màn hình đều render sạch ở 820px (không overflow ngang), cost `có/cần` thống nhất, preview TRƯỚC⇒SAU ở Khí Đường rõ ràng, disabled state tồn tại đầy đủ. Nhưng lớp kinh tế/xã hội đang **thiếu feedback**: không có currency HUD, bán hàng biến mất không confirm, uống đan không báo gì, gacha/đổi duyên phận là ngõ cụt. Hệ màu dark-panel có bug contrast lặp lại (tên công trình, hướng dẫn empty-state đều gần như vô hình). Nhiều icon nguyên liệu chỉ là chữ cái fallback.

**Điểm trung bình slice: C+** — dùng được, trông được, nhưng người chơi thường xuyên không biết mình vừa mất/nhận gì và mấy màn hình chủ chốt là dead end.

## Bảng chấm điểm màn hình

| # | Màn hình | Grade | Shot |
|---|----------|-------|------|
| 1 | Động Phủ (home) + Command Wheel | B− | `12-home-loaded`, `20-command-wheel` |
| 2 | Offline settlement modal ("Bảo Quan Kết Thúc") | B− | `10-offline-summary-modal`, `11-offline-summary-820w` |
| 3 | Nhân Vật — Túi Vật Trang Bị + paperdoll | C | `21`, `22`, `26`, `70` |
| 4 | Túi Vật — Nguyên Liệu | C+ | `23`, `58` |
| 5 | Túi Vật — Đan Dược | B− | `24`, `57` |
| 6 | Ký Bảo Các (vendor — sell only) | D+ | `30`, `53`, `54`, `72` |
| 7 | Khí Đường — Cường Hóa | B | `31`, `44` |
| 8 | Khí Đường — Tẩy Luyện / Tinh Luyện | C+ | `45`, `46`, `49` |
| 9 | Khí Đường — Hỏa Luyện | C | `47` |
| 10 | Khí Đường — Phân Giải | D+ | `48` |
| 11 | Đan Phòng (alchemy) | C+ | `32`, `52`, `74` |
| 12 | Khai Vật Đường (production) | B− | `34`, `56` |
| 13 | Nhiệm Vụ (quest) | C+ | `35`, `50`, `51` |
| 14 | Chiêu Hiền Quán — Nhân Công | B− | `33` |
| 15 | Chiêu Hiền Quán — Quà Tặng (gift/mail) | B− | `41`, `65`, `66` |
| 16 | Chiêu Hiền Quán — Chiêu Mộ (gacha) | D | `40`, `64` |
| 17 | Chiêu Hiền Quán — Đổi Duyên Phận | D | `42` |
| 18 | Đồng Đội (companion roster + Nuôi) | B− | `36`, `55`, `73` |

## Findings (xếp theo severity)

### [High] Không có HUD tiền tệ — số dư Linh Thạch vô hình ở mọi nơi
- **Màn hình:** toàn bộ slice (home, vendor, alchemy, enhance…)
- **Người chơi thấy/làm:** mua bán, nâng cấp, luyện đan đều trừ Linh Thạch nhưng không nơi nào hiển thị số dư hiện tại. Chỉ thấy "có/cần" trong dòng chi phí (`4550/400`) hoặc phải mở túi → tab Nguyên Liệu → filter Khác để thấy "Hạ phẩm Linh Thạch ×6.414" render bằng chữ "H".
- **Vì sao là vấn đề:** người chơi không trả lời được "tôi đang có bao nhiêu tiền" — quyết định kinh tế cơ bản nhất của game idle. Bán đồ xong không thấy tiền tăng.
- **Gợi ý:** thêm currency bar cố định (ví dụ cạnh avatar ở header trái) hiển thị Linh Thạch + Chiêu Hiến Lệnh + Duyên Phận; hoặc ít nhất hiển thị số dư trong header panel Ký Bảo Các.
- **Shot:** `12-home-loaded.png`, `52-alchemy-active-job.png`, `58-bag-material-filter-khac.png`

### [High] Vendor "Bán hết": không chọn số lượng, không preview tổng, không confirm, không feedback
- **Màn hình:** Ký Bảo Các
- **Người chơi thấy/làm:** mỗi dòng "Tên (số) — X hạ/đơn vị" có nút `Bán hết`. Bấm một cái là toàn bộ stack biến mất — không dialog, không "tổng nhận được Y Linh Thạch", không toast thành công (code chỉ push warning khi fail). Dòng item biến mất khỏi list là feedback duy nhất; tiền nhận được thì vô hình (xem finding HUD).
- **Vì sao là vấn đề:** hành động phá hủy hàng loạt không thể hoàn tác, không cho biết trước/sau nhận được gì → dễ bán nhầm, và kể cả bán đúng cũng không có cảm giác "vừa kiếm được tiền".
- **Gợi ý:** cho chọn số lượng (slider/stepper), hiển thị "Nhận: X Linh Thạch" ngay trên nút, confirm cho stack lớn, toast "Đã bán N × tên → +Y Linh Thạch".
- **Shot:** `30-vendor.png`, `53-vendor-after-sell.png`, `54-vendor-sell-toast.png`

### [High] Chiêu Mộ (gacha) + Đổi Duyên Phận là ngõ cụt — tài nguyên tích lũy không có đầu ra
- **Màn hình:** Chiêu Hiền Quán, tab Chiêu Mộ + Đổi Duyên Phận
- **Người chơi thấy/làm:** `Chiêu Hiến Lệnh: 40`, `Bảo hiểm: 14/30` hiển thị như thể sắp được quay; nút Chiêu Mộ disable kèm banner "Chưa mở trong bản hiện tại — đồng đội mới đến qua Quà Tặng." Sang tab Đổi Duyên Phận: "Duyên Phận: 240" với cùng banner — hai loại currency đọc được nhưng không tiêu được.
- **Vì sao là vấn đề:** pity counter 14/30 là lời hứa rõ ràng với người chơi ("quay đủ 30 lần…") nhưng không bao giờ đến được; token vẫn cộng dồn vô nghĩa → cảm giác bị lừa/mất tài nguyên.
- **Gợi ý:** nếu pool đóng thì ẩn pity/tokens (hoặc chuyển thành note nhỏ), hoặc mở một sink tối thiểu (đổi Chiêu Hiến Lệnh → Duyên Phận → nguyên liệu). Ít nhất giải thích "sẽ mở ở phiên bản sau" thay vì chỉ "Chưa mở".
- **Shot:** `40-gacha-chieu-mo.png`, `42-duyen-phan.png`, `64-en-gacha.png`

### [High] Header mọi panel công trình: ảnh art bị 404 (vendor, Chiêu Hiền Quán) và tên công trình gần như vô hình
- **Màn hình:** FunctionOverlayPanel chung cho tất cả buildings
- **Người chơi thấy/làm:** góc trái header là icon ảnh hỏng (broken-image) ở Ký Bảo Các và Chiêu Hiền Quán (`/assets/buildings/dong-fu/vendor.png`, `chi_hien_quan.png` trả 404 — file chỉ tồn tại dưới `dong-fu/v2/`). Tên công trình (serif tối) đè lên art tối → "Ký Bảo Các", "Chiêu Hiền Quán" khó đọc; "Nâng công trình" và chi phí nâng cấp cũng mờ trên nền art.
- **Vì sao là vấn đề:** header là điểm nhận diện đầu tiên của màn hình — vừa xấu (icon hỏng) vừa fail khả năng đọc.
- **Gợi ý:** trỏ `artPath` sang thư mục `v2/` hoặc thêm fallback asset; đặt tên công trình lên pill nền sáng như label trên map ("Chiêu Hiền Quán Cấp 1" ở home rất dễ đọc).
- **Shot:** `30-vendor.png`, `40-gacha-chieu-mo.png`, `52-alchemy-active-job.png`

### [Medium] Locale `en` tồn tại nhưng không reachable trong UI + data strings chưa dịch → mixed-language
- **Màn hình:** toàn bộ (kiểm tra qua `i18n.global.locale = 'en'`)
- **Người chơi thấy/làm:** không có language switcher nào trong Settings/UI. Khi set `en` thủ công: tab/button dịch ("Enhance", "Recruit", "Pity: 14/30") nhưng tên công trình, mô tả, tên vật phẩm/nguyên liệu/stat vẫn tiếng Việt → câu kiểu "Recruit (1 Chiêu Hiến Lệnh)".
- **Vì sao là vấn đề:** bản en bán thành phẩm; nếu ship toggle thì trải nghiệm lẫn lộn ngay.
- **Gợi ý:** quyết định scope: hoặc ẩn locale en khỏi build, hoặc dịch data layer (tên/mô tả data-driven cần key i18n hoặc bảng dịch riêng); thêm switcher nếu muốn ship.
- **Shot:** `60-en-equipment-hall.png`, `61-en-quest.png`, `64-en-gacha.png`, `62-en-character.png`

### [Medium] Đan dược: 1 click là uống luôn — không confirm, không feedback khi thành công; tooltip có bug "+3.0%%"
- **Màn hình:** Túi Vật → Đan Dược
- **Người chơi thấy/làm:** click vào ô đan = `usePillDetailed` ngay lập tức. Tooltip chi tiết (hiệu ứng, cảnh giới, sở hữu) không nói gì về hành động click; thành công chỉ giảm số lượng — không toast/buff confirmation; fail mới có warning. Tooltip hiển thị "Tu Vi +3.0%%" (dấu % kép).
- **Vì sao là vấn đề:** misclick mất đan; và "uống xong có buff chưa?" — player không biết. `%%` là lỗi hiển thị thật.
- **Gợi ý:** hint trong tooltip ("Click để sử dụng"), toast khi dùng ("Đã dùng Tụ Linh Đan — Tu Vi +3%"), sửa template `%%`.
- **Shot:** `57-pill-clicked.png`, `24-bag-pill.png`

### [Medium] Icon nguyên liệu = chữ cái fallback; ngay cả tiền tệ cũng là một ô "H"
- **Màn hình:** Túi Vật → Nguyên Liệu (đặc biệt filter Khác), vendor
- **Người chơi thấy/làm:** nhiều material render chữ đầu tên (H ×6.414, C ×40, Y ×12, N ×3, M ×5…) trên ô tối — trong đó "H" chính là Linh Thạch. Trang bị có ảnh thật nhưng nguyên liệu/đan phần lớn không.
- **Vì sao là vấn đề:** mất affordance nhận diện, trông như placeholder chưa hoàn thiện; phân biệt chỉ qua chữ cái dễ nhầm.
- **Gợi ý:** icon tối thiểu theo loại (gỗ/quặng/thảo/tinh hoa/linh thạch) — đã có taxonomy filter sẵn.
- **Shot:** `58-bag-material-filter-khac.png`, `23-bag-material.png`

### [Medium] Alchemy: nút luyện disable có label không đọc được; câu yield "Chắc chắn 0 viên, 50% thêm 2 viên" gây nhiễu
- **Màn hình:** Đan Phòng
- **Người chơi thấy/làm:** khi có lò đang luyện, nút craft disable thành thanh xám với chữ mờ gần như vô hình. Dòng yield "Chắc chắn 0 viên, 50% thêm 2 viên" đọc như "chắc chắn được 0" — cảm giác luyện không ra gì (thực tế = base 0 + 50% bonus 2?). Herb radio có counts tốt (×0 vẫn liệt kê — tốt).
- **Vì sao là vấn đề:** disabled state che luôn lý do disable; câu yield sai ngữ nghĩa nhận diện → player không dám luyện.
- **Gợi ý:** nút disable giữ label đọc được + lý do ("Đang luyện Tụ Linh Đan"); đổi yield thành "0–2 viên (50% ra 2)" hoặc "Tối thiểu 0 · 50% +2".
- **Shot:** `52-alchemy-active-job.png`, `32-pill-room.png`

### [Medium] Phân Giải: controls + vùng trống — không có list vật liệu, không empty state, nhân công 0 không giải thích
- **Màn hình:** Khí Đường → Phân Giải
- **Người chơi thấy/làm:** 2 select (Phẩm khoáng/Tuổi khoáng) + slider "Nhân công: 0" + "≈ 0 Luyện Khí Tinh Hoa / lượt" — phía dưới là vùng đen trống hoàn toàn dù túi có khoáng. Không có dòng nào nói "không có vật liệu phù hợp" hay "kéo nhân công để bắt đầu".
- **Vì sao là vấn đề:** player không biết tab này đang trống vì thiếu gì (nhân công? nguyên liệu? filter?) — trông như bug render.
- **Gợi ý:** empty-state text theo điều kiện ("Chưa phân công nhân công" khi slider=0; "Không có khoáng phù hợp" khi filter miss); preview rõ "input → output".
- **Shot:** `48-decompose.png`

### [Medium] Quest: không preview phần thưởng; trùng tên; claim phụ thuộc điều kiện ẩn
- **Màn hình:** Nhiệm Vụ
- **Người chơi thấy/làm:** row chỉ có tên + mô tả "Nộp 5 Tụ Linh Thảo mỗi ngày để nhận thưởng" — không hiển thị thưởng gì. Hai quest cùng tên "Thu Thập Tụ Linh Thảo" (một [Hàng Ngày], một thường) dễ nhầm. Progress đếm event `onMaterialCollected` chứ không phải số trong túi — "5/5" vẫn fail claim nếu túi không đủ vật (claim sẽ consume).
- **Vì sao là vấn đề:** "nhận thưởng" mà không biết thưởng gì → động lực yếu; nút `Nhận Thưởng` disable mà không nói vì sao.
- **Gợi ý:** thêm dòng reward chips (icon + số); khi disable, tooltip/label nêu lý do ("Thiếu 2 Tụ Linh Thảo trong túi"); phân biệt tên (thêm hậu tố cảnh giới).
- **Shot:** `35-quest.png`, `50-quest-claimable.png`, `51-quest-claimed.png`

### [Medium] Panel standalone (Nhiệm Vụ, Đồng Đội) không có nút đóng
- **Màn hình:** Nhiệm Vụ, Đồng Đội
- **Người chơi thấy/làm:** modal giữa màn hình không có X, không có nút "Đóng" — phải biết bấm backdrop/Esc/toggle lại.
- **Vì sao là vấn đề:** dead-end affordance kinh điển; trên mobile/narrow càng dễ bí.
- **Gợi ý:** nút X góc phải cho tất cả standalone panel (building panels có tab thì cũng nên có X nhất quán).
- **Shot:** `35-quest.png`, `36-companion.png`

### [Medium] Mô tả Ký Bảo Các hứa "trao đổi/quy đổi" nhưng chỉ có bán — copy lệch thực tế
- **Màn hình:** Ký Bảo Các
- **Người chơi thấy/làm:** mô tả dưới header: "Nơi trao đổi nguyên liệu thừa và quy đổi phẩm cấp Linh Thạch/nguyên liệu." — nhưng panel chỉ có Hóa Bán (buy/convert tab đã bị gỡ theo comment trong code).
- **Vì sao là vấn đề:** player tìm chức năng quy đổi/đổi phẩm cấp không thấy → copy gây kỳ vọng sai.
- **Gợi ý:** sửa mô tả theo chức năng hiện có hoặc khôi phục tab quy đổi.
- **Shot:** `30-vendor.png`

### [Low] Contrast chữ serif tối trên nền tối — pattern lặp ở nhiều nơi
- **Màn hình:** header panel công trình, empty-state Khí Đường, tiêu đề modal offline, skill names Đồng Đội
- **Người chơi thấy/làm:** "Chọn một trang bị bên trái để xem chi tiết." (Tẩy/Tinh Luyện) gần như vô hình; "Bảo Quan Kết Thúc" tối trên navy; tên kỹ năng đồng đội (olive) trên nền đen.
- **Gợi ý:** audit một lần toàn bộ token `--text-*` trên dark surface; empty-state text nên ≥ `#9a9382`.
- **Shot:** `45-wash.png`, `10-offline-summary-modal.png`, `36-companion.png`

### [Low] Ô trang bị trống = ô vuông đen không label; badge "T" đỏ không giải thích
- **Màn hình:** Nhân Vật — Túi Vật Trang Bị + paperdoll; Khí Đường item column
- **Người chơi thấy/làm:** slot trống là ô đen trơn — không ghi slot gì (Vũ Khí/Giáp…). Mỗi item có badge đỏ "T" (Thất phẩm) — không tooltip/legend nào giải thích ký hiệu phẩm.
- **Gợi ý:** label nhỏ dưới slot trống; tooltip/legend cho grade-letter badge.
- **Shot:** `21-character-bag-equipment.png`, `45-wash.png`

### [Low] Command wheel: item dưới cùng bị clip ở 900px; "Trận" mơ hồ; Ký Bảo Các không có trên wheel
- **Màn hình:** DongFuCommandWheel (Tab)
- **Người chơi thấy/làm:** "Truyền Tống Trận" ở vòng dưới bị cắt một nửa ở chiều cao 900px. Slot "Trận" (Trận Pháp) đọc như "Trận" đánh nhau. Ký Bảo Các chỉ vào được qua hotspot trên map — không có trên wheel.
- **Gợi ý:** scale wheel theo viewport hoặc đảm bảo ring cuối trong safe area; đổi "Trận" → "Trận Pháp"; cân nhắc thêm Ký Bảo Các.
- **Shot:** `20-command-wheel.png`

### [Low] Quà Tặng: không badge khi có quà chờ; row gift thiếu ngữ cảnh
- **Màn hình:** Chiêu Hiền Quán → Quà Tặng
- **Người chơi thấy/làm:** tab không có badge/dot khi có gift pending — phải tự mở mới biết. Row chỉ hiện "Thần Nông Huyền Chất" + nút Nhận: không nói vì sao được tặng, nhận được gì (companion? vật phẩm?).
- **Gợi ý:** badge đếm trên tab + trên label building ở map; row thêm "Đạt Trúc Cơ — tặng đồng đội Thần Nông".
- **Shot:** `65-gift-pending.png`, `66-gift-claimed.png`, `41-gift-qua-tang.png`

### [Low] Production: icon thẻ là ô tối placeholder; claim chỉ là counter về 0
- **Màn hình:** Khai Vật Đường
- **Người chơi thấy/làm:** mỗi resource card có khung icon tối trống (chỉ vệt symbol mờ). Bấm "Thu hoạch" xong số về 0 — không toast "nhận +806 Linh Mạch", không breakdown theo loại.
- **Gợi ý:** icon loại tài nguyên; toast/delta summary khi claim; lịch sử claim gần nhất.
- **Shot:** `34-production.png`, `56-production-claimed.png`

### [Nit] Offline modal chỉ liệt kê Linh lực — nguyên liệu/đan luyện xong offline không xuất hiện
- **Màn hình:** Bảo Quan Kết Thúc
- **Người chơi thấy/làm:** modal chỉ có Thời gian + "+ Linh lực 4,751". Không thấy sản xuất/đan hoàn thành trong lúc offline dù các hệ đó chạy nền.
- **Gợi ý:** thêm section "Sản xuất/Luyện đan trong lúc vắng mặt" nếu có; hiện tại player không biết có hay không.
- **Shot:** `10-offline-summary-modal.png`, `11-offline-summary-820w.png`

### [Nit] Đơn vị bán "hạ/đơn vị" khó hiểu
- **Màn hình:** Ký Bảo Các
- **Chi tiết:** "24 hạ/đơn vị" — "hạ" là gì? (hạ phẩm linh thạch?) không rõ; nên hiển thị icon/tên tiền tệ.
- **Shot:** `30-vendor.png`

### [Nit] Không có scrollbar nhìn thấy — nội dung panel trái bị giấu dưới fold
- **Màn hình:** Character left panel
- **Chi tiết:** Ngũ Hành nằm dưới fold nhưng không scrollbar/indicator nào báo còn nội dung — dễ tưởng panel hết.
- **Shot:** `25-leftpanel-scrolled.png`, `27-ngu-hanh-visible.png`

### [Nit] Companion detail: mã "C0/C1/C2" chưa giải thích; vùng Cung Mệnh C1–C6 cryptic
- **Màn hình:** Đồng Đội
- **Chi tiết:** roster ghi "C0 · Phàm Nhân 3", Cung Mệnh C1–C6 — player mới không decode được (cấp? constellation?).
- **Shot:** `36-companion.png`

## Ghi nhận tích cực (đáng giữ)

- 820px: không overflow ngang ở bất kỳ màn hình nào (`scrollWidth === innerWidth`), bố cục 2 cột tự co tốt.
- Khí Đường Cường Hóa: preview TRƯỚC⇒SAU + delta phần trăm xanh, badge +N cập nhật ngay, chi phí `có/cần` rõ.
- Companion Nuôi: select hiển thị `x800 (+10 EXP)`, feedback "+10 EXP" ngay dưới, EXP bar cập nhật.
- Quà Tặng claim: toast "Quà tặng: Thần Nông" + row chuyển sang mục "Đã nhận" — flow sạch.
- Alchemy: herb radio kèm số lượng tồn kho từng tuổi; job đang chạy có timer + "Hủy (mất nguyên liệu)" cảnh báo rõ.
- Quest claim: progress bar 5/5 → nút enable → trạng thái "Đã Nhận" đúng.
- Empty state Quà Tặng ("Chưa có quà tặng nào") tồn tại và đọc được.
