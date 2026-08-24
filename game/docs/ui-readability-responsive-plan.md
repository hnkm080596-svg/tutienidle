# UI Readability & Responsive Layout Plan

## 1. Bối cảnh

UI sau khi chuyển từ màn hình đăng nhập vào game hiện tạo cảm giác bị thu nhỏ rõ rệt:

- Panel Nhân Vật chật chội và thiếu phân cấp thị giác.
- Chữ trong phần lớn panel quá nhỏ.
- Icon trên top bar, bottom shortcut và các công trình trong Động Phủ khó nhận diện.
- Vùng bấm của nhiều icon nhỏ hơn mức phù hợp cho thao tác chuột/touchpad.
- Màn đăng nhập hiển thị ở kích thước viewport thật, nhưng màn game lại bị scale toàn bộ nên tạo ra bước chuyển kích thước rất đột ngột.

Mục tiêu của plan là sửa nền responsive trước, sau đó chuẩn hóa typography, navigation và lần lượt giảm mật độ của các panel. Không thay đổi gameplay hoặc kiến trúc dữ liệu game.

## 2. Phân tích nguyên nhân

### 2.1. Toàn bộ game bị scale như một ảnh lớn

`GameRoot.vue` dựng giao diện trên design frame cố định `2560x1440`, sau đó áp dụng:

```ts
scale = Math.min(
  window.innerWidth / DESIGN_WIDTH,
  window.innerHeight / DESIGN_HEIGHT,
)
```

Toàn bộ `.game-root`, bao gồm DOM text, SVG icon, button, panel và Phaser canvas, được thu nhỏ bằng CSS `transform: scale(...)`.

Cửa sổ Electron mặc định chỉ là `1280x800`. Ở kích thước này:

- Hệ số scale thực tế là `0.5`.
- Icon SVG `18px` chỉ còn khoảng `9px` hiển thị.
- `IconButton` `32x32px` chỉ còn khoảng `16x16px`.
- Shortcut rộng `56px` chỉ còn khoảng `28px`.
- Chữ `0.6rem` chỉ còn khoảng `4.8px` nếu root font mặc định là `16px`.
- Chữ `0.8rem` chỉ còn khoảng `6.4px`.
- Nhân vật Động Phủ cao `239px` chỉ còn khoảng `120px`.

Ở màn hình Full HD `1920x1080`, hệ số scale vẫn chỉ là `0.75`, nên vấn đề vẫn còn rõ rệt.

### 2.2. Kích thước gốc của component vốn đã nhỏ

Ngay cả trước khi bị scale, nhiều component đang dùng chữ trong khoảng `0.5-0.72rem`. Các vị trí tiêu biểu gồm:

- Character Panel.
- Bottom quick navigation.
- Equipment paperdoll và SlotView.
- Skill/Technique panels.
- Inventory sections.
- Combat status/event/skill UI.

Do đó chỉ bỏ global scale vẫn chưa đủ. UI cần có typography tokens và giới hạn kích thước tối thiểu dùng chung.

### 2.3. Character Panel có mật độ quá cao

Panel trái chỉ chiếm `25%` design frame. Ở cửa sổ Electron, vùng hiển thị vật lý tương đương khoảng `320px`, nhưng header Nhân Vật lại chia thành ba cột:

1. Trang bị sáu slot.
2. Hình nhân vật, tên và chiến lực.
3. Cảnh giới, tầng, tiến độ, ETA, auto breakthrough và hành động.

Bên dưới header còn xếp liên tiếp:

- Tâm Pháp.
- Con đường tu luyện.
- Nhiều nhóm chỉ số.
- Ngũ Hành.
- Thông tin sử dụng đan dược.

Việc cố hiển thị quá nhiều thông tin cùng lúc làm mọi thành phần phải giảm font, spacing và kích thước điều khiển.

### 2.4. Navigation và công trình thiếu khả năng nhận diện

Bottom navigation hiện dùng icon `18px`, label `0.6rem` và button rộng `56px`. Các công trình phụ trong Động Phủ có kích thước gốc khoảng `44-56px`, sau global scale chỉ còn `22-28px` ở cửa sổ Electron mặc định.

Nhiều công trình cũng phụ thuộc vào tooltip, không có nhãn luôn hiển thị, khiến người chơi mới khó biết đâu là shortcut có thể tương tác.

## 3. Nguyên tắc triển khai

1. Sửa responsive foundation trước khi tăng font từng component.
2. Không dùng việc tăng kích thước cửa sổ Electron làm giải pháp chính.
3. Tách hệ tọa độ thiết kế của Phaser khỏi kích thước hiển thị DOM.
4. Không có nội dung chính nào nhỏ hơn `12px` ở kích thước hiển thị thực tế.
5. Thông tin quan trọng phải được ưu tiên; thông tin chi tiết có thể nằm trong tab, accordion hoặc tooltip.
6. Dùng shared tokens/primitives để tránh mỗi panel tự định nghĩa một thang kích thước khác nhau.
7. Triển khai theo từng lớp nhỏ, chạy type-check/build/test sau mỗi work stream lớn.

## 4. Work streams

### WS1 - Responsive foundation

Mức ưu tiên: P0.

Phạm vi chính:

- `src/components/layout/GameRoot.vue`
- `src/core/ui/DesignFrame.ts`
- `src/components/game/MainScene.vue`
- `src/components/game/combat/CombatSceneOverlay.vue`
- `src/game/scenes/CombatScene.ts`

Công việc:

- Bỏ việc scale toàn bộ DOM bằng `transform`.
- Cho game root nhận kích thước 16:9 thực tế vừa với viewport.
- Giữ design coordinates riêng cho Phaser nếu cần, nhưng không để chúng thu nhỏ typography và controls của Vue.
- Chuyển top bar, bottom bar và combat bar sang kích thước CSS thực, có giới hạn bằng `clamp()`.
- Đồng bộ các inset/reserved area giữa Vue overlay và Phaser canvas.
- Bảo đảm resize cửa sổ không gây lệch scene hoặc tràn panel.

Tiêu chí hoàn thành:

- UI không còn co xuống 50% tại `1280x800`.
- Đăng nhập và màn game có cùng cảm nhận về tỷ lệ chữ/control.
- Phaser scene và DOM chrome vẫn căn đúng sau resize.

### WS2 - Typography, spacing và interaction tokens

Mức ưu tiên: P0.

Phạm vi chính:

- `src/assets/theme.css`
- `src/components/common/IconButton.vue`
- `src/components/common/ResourceDisplay.vue`
- `src/components/common/SlotView.vue`

Thêm hoặc chuẩn hóa token:

- Text phụ nhỏ nhất: `12px`.
- Nội dung thông thường: `14-16px`.
- Section heading: `16-18px`.
- Panel title: `18-22px`.
- Icon navigation chính: `22-24px`.
- Vùng bấm icon tối thiểu: `40x40px`, ưu tiên `44x44px`.
- Line-height nội dung: `1.4-1.55`.
- Spacing scale dùng chung, ví dụ `4/8/12/16/24px`.

Công việc:

- Thay các cỡ `0.5-0.72rem` bằng semantic typography tokens phù hợp.
- Giữ chữ cực nhỏ chỉ cho marker không thiết yếu và luôn có tooltip thay thế.
- Chuẩn hóa focus-visible, hover, active và disabled state.
- Kiểm tra độ tương phản của text muted trên nền ink.

Tiêu chí hoàn thành:

- Không còn nội dung chính dưới `12px` hiển thị thực tế.
- Control chính có vùng bấm tối thiểu `40px`.
- Các component dùng cùng một hệ phân cấp chữ.

### WS3 - Redesign Character Panel

Mức ưu tiên: P0.

Phạm vi chính:

- `src/components/layout/LeftPanel.vue`
- `src/components/panels/CharacterPanel.vue`
- `src/components/panels/EquipmentPaperdoll.vue`
- `src/components/panels/loadout-sections/TechniqueSlotCard.vue`

Bố cục đề xuất:

1. Header hai vùng:
   - Chân dung, tên và chiến lực.
   - Cảnh giới, tầng, thanh tu vi, ETA và hành động Đột Phá.
2. Trang bị chuyển thành section riêng bên dưới, dùng lưới `3x2`.
3. Tâm Pháp và con đường tu luyện hiển thị dưới dạng summary card.
4. Chỉ số được chia thành tab hoặc accordion:
   - Thuộc tính chính.
   - Chiến đấu.
   - Ngũ Hành.
   - Hiệu ứng bổ sung.
5. Chiều rộng panel chuyển từ `25%` sang drawer responsive, dự kiến:

```css
width: clamp(360px, 30vw, 480px);
```

Công việc chi tiết:

- Không tiếp tục nhét paperdoll, portrait và realm vào ba cột ngang.
- Đưa name/realm/progress/action vào vùng nhìn thấy đầu tiên.
- Tăng spacing giữa các section.
- Giảm số divider lặp lại và dùng card grouping rõ hơn.
- Giữ scroll cho nội dung chi tiết, không để action chính trôi khỏi vùng đầu panel.

Tiêu chí hoàn thành:

- Tên, chiến lực, cảnh giới, tiến độ và hành động chính nhìn thấy mà không cần cuộn.
- Không có label bị cắt ở `1280x800`.
- Paperdoll đủ lớn để nhận diện item và badge.
- Panel có phân cấp rõ, không còn cảm giác mọi thông tin có cùng độ ưu tiên.

### WS4 - Top bar và bottom shortcuts

Mức ưu tiên: P1.

Phạm vi chính:

- `src/components/layout/DongFuTopBar.vue`
- `src/components/layout/BottomBar.vue`
- `src/components/layout/DongFuQuickNav.vue`
- `src/components/layout/RealmActionNav.vue`

Công việc:

- Tăng icon navigation lên khoảng `24px`.
- Tăng label lên `12-13px`.
- Tăng shortcut width lên khoảng `72-88px`, tùy viewport.
- Tăng chiều cao và vùng bấm của Menu/Settings.
- Làm active state rõ hơn bằng indicator, nền và/hoặc border.
- Giữ label luôn hiển thị cho navigation chính.
- Cho bottom nav co giãn hoặc scroll ngang có kiểm soát khi số action tăng.

Tiêu chí hoàn thành:

- Shortcut nhận diện được ngay ở cửa sổ mặc định.
- Không có shortcut nào chỉ dựa vào icon nhỏ hoặc tooltip.
- Label không bị xuống dòng ngoài chủ đích.

### WS5 - Động Phủ world icons

Mức ưu tiên: P1.

Phạm vi chính:

- `src/components/game/HomeBuildingIcons.vue`
- `src/components/game/BuildingDetailPopover.vue`

Công việc:

- Công trình chính có silhouette lớn hơn và nameplate ngắn.
- Công trình phụ có kích thước hiển thị tối thiểu khoảng `56-64px`.
- Bổ sung trạng thái trực quan cho built, locked, available và upgradeable.
- Không phụ thuộc hoàn toàn vào tooltip để giải thích chức năng.
- Rà lại vị trí để công trình không bị panel trái hoặc chrome che.
- Ưu tiên độ dễ bấm hơn việc giữ toàn bộ công trình quá sát phối cảnh nền.

Tiêu chí hoàn thành:

- Người chơi có thể nhận diện công trình và chức năng chính khi nhìn scene.
- Công trình phụ không còn nhỏ hơn icon navigation.
- Vùng bấm khớp với silhouette hiển thị.

### WS6 - Inventory, slots và feature panels

Mức ưu tiên: P1.

Thứ tự rà soát:

1. Inventory, BagGrid, SlotView và EquipmentPaperdoll.
2. Kỹ Năng và Tâm Pháp.
3. Chọn Ải và Thám Hiểm.
4. Đan Phòng, Phù Viện, Khí Đường và Trận Đài.
5. Tooltip, modal, toast và tutorial.

Công việc:

- Điều chỉnh slot target size theo container thật sau khi bỏ global scale.
- Giảm số cột khi viewport nhỏ thay vì thu nhỏ slot vô hạn.
- Dùng responsive grid và minimum card width.
- Đảm bảo CTA, filter và pagination có vùng bấm phù hợp.
- Chuẩn hóa title, subtitle, body và metadata theo typography tokens.

Tiêu chí hoàn thành:

- Slot icon và badge đọc được ở `1280x800`.
- Không có card bị ép đến mức tên item/skill mất ý nghĩa.
- Panel chỉ scroll tại vùng nội dung được chủ động thiết kế.

### WS7 - Combat HUD

Mức ưu tiên: P1 sau responsive foundation.

Phạm vi chính:

- `src/components/game/combat/CombatSceneOverlay.vue`
- `src/components/game/combat/CombatTopBar.vue`
- `src/components/game/combat/CombatStatusBar.vue`
- `src/components/game/combat/CombatEventBar.vue`
- `src/components/game/combat/CombatControlBar.vue`
- `src/components/game/combat/hud/*`

Công việc:

- Đồng bộ lại chiều cao bar và reserved battlefield area.
- Phóng skill icons, cooldown text và trạng thái tài nguyên.
- Giữ battlefield là trọng tâm, không để HUD lớn quá mức sau khi bỏ transform.
- Kiểm tra các HUD khác nhau của Phàm Nhân, Pháp Tu và Kiếm Tu.
- Rà modal thắng/thua và auto-refight countdown.

Tiêu chí hoàn thành:

- Combat HUD đọc được trong chuyển động.
- Skill shortcut và cooldown rõ ở `1280x800`.
- Phaser effects không bị DOM bars che hoặc lệch tọa độ.

### WS8 - UI scale setting

Mức ưu tiên: P2, chỉ thực hiện sau khi responsive foundation ổn định.

Công việc:

- Thêm lựa chọn UI scale trong Settings, ví dụ `90% / 100% / 110% / 125%`.
- Chỉ scale semantic tokens/control sizing, không quay lại scale toàn bộ game root.
- Lưu lựa chọn trong UI settings hiện có.

Mục đích:

- Hỗ trợ màn hình độ phân giải cao, Windows DPI scaling và nhu cầu thị lực khác nhau.
- Đây là tùy chỉnh người dùng, không phải cách sửa lỗi responsive nền.

## 5. Thứ tự triển khai đề xuất

1. WS1 - Responsive foundation.
2. WS2 - Typography và interaction tokens.
3. WS3 - Character Panel.
4. WS4 - Navigation shortcuts.
5. WS5 - Động Phủ world icons.
6. WS6 - Inventory và feature panels.
7. WS7 - Combat HUD.
8. WS8 - UI scale setting.

Không nên triển khai Character Panel hoặc tăng font hàng loạt trước WS1, vì global transform sẽ tiếp tục làm sai kích thước hiển thị và gây khó đánh giá kết quả.

## 6. Kế hoạch kiểm thử

### 6.1. Viewport matrix

Kiểm tra tối thiểu tại:

- `1280x800` - cửa sổ Electron mặc định.
- `1366x768`.
- `1600x900`.
- `1920x1080`.
- `2560x1440`.
- Windows display scaling 125% và 150% khi có môi trường phù hợp.

### 6.2. Visual regression

Thêm Playwright screenshot coverage cho:

- Động Phủ mặc định.
- Character Panel.
- Inventory và paperdoll.
- Skill Path overlay.
- Technique overlay.
- Stage Select.
- Combat HUD của từng cultivation path.
- Modal thắng/thua.

Ưu tiên kiểm tra computed size thay vì chỉ dựa vào ảnh:

- Font nội dung chính `>= 12px`.
- Icon navigation chính `>= 22px`.
- Vùng bấm chính `>= 40px`.
- Panel nằm hoàn toàn trong viewport.
- Không có horizontal overflow ngoài vùng được thiết kế.

### 6.3. Verification bắt buộc

Sau mỗi work stream có thay đổi code:

```powershell
npm.cmd test
npm.cmd run type-check
npm.cmd run build
```

Chạy thêm Playwright tests liên quan sau khi đã có visual/responsive coverage.

## 7. Definition of Done

Đợt UI readability được coi là hoàn thành khi:

- Chuyển từ đăng nhập vào game không còn làm UI co nhỏ rõ rệt.
- Nội dung chính không nhỏ hơn `12px` ở mọi viewport được hỗ trợ.
- Icon shortcut chính tối thiểu `22px`, vùng bấm tối thiểu `40px`.
- Character Panel không còn bố cục ba cột chật chội.
- Thông tin nhân vật quan trọng hiển thị trước nội dung chi tiết.
- Công trình Động Phủ có thể nhận diện và bấm dễ dàng.
- Inventory slot, skill shortcut và combat HUD đọc được ở `1280x800`.
- Không có panel bị cắt, tràn hoặc lệch sau resize.
- Type-check, unit tests, build và responsive Playwright coverage đều pass.

## 8. Giới hạn hiện tại của lần phân tích

Plan này được xây dựng từ audit source code và phép tính kích thước hiển thị. Tại thời điểm phân tích không có phiên trình duyệt tích hợp khả dụng để chụp screenshot runtime. Khi bắt đầu WS1 cần tạo bộ screenshot baseline tại các viewport trong mục 6 trước khi thay đổi layout.
