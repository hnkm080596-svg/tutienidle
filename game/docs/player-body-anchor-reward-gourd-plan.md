# Player Body Anchor, Visual Evolution, and Reward Gourd Plan

## 1. Mục tiêu

- Thay các hình ảnh Player mới vào đúng trạng thái Phàm Nhân, tu luyện và Pháp Tu.
- Bổ sung hệ thống body anchor để VFX có thể bám chính xác vào tay, đầu, ngực hoặc chân nhân vật.
- Sửa VFX kinh nghiệm, vật phẩm và tiền thưởng đang bay về vị trí Player cũ sau khi Player teleport.
- Thêm một hồ lô cố định ở góc trái dưới vùng combat và cho toàn bộ reward VFX bay vào miệng hồ lô như bị hút.
- Dùng placeholder để hoàn thiện hành vi trước; chỉ generate art hồ lô sau khi luồng hoạt động đạt yêu cầu.

## 2. Phạm vi và giả định

- Hồ lô nằm ở góc trái dưới **vùng battlefield an toàn**, ngay phía trên Event Bar và Control Bar, để không bị DOM combat HUD che.
- Cả ba loại reward particle hiện tại đều bay về hồ lô: `insight`, `item`, và `currency`.
- Logic cộng thưởng trong core không thay đổi; hạng mục này chỉ thay presentation.
- `phap_tu` dùng art Pháp Tu mới trong combat.
- `mortal` dùng art Phàm Nhân mới trong combat và art kiết già mới khi tu luyện.
- `kiem_tu` tạm dùng fallback Phàm Nhân cho đến khi có art riêng.
- Không thêm dependency và không cần save migration trong development phase hiện tại.

## 3. Hiện trạng và nguyên nhân

`CombatScene.onRewardParticle()` hiện lấy:

- điểm đầu từ sprite của `sourceId`;
- điểm cuối từ vị trí sprite Player tại thời điểm nhận event.

Điểm cuối được chụp một lần trước khi tween bắt đầu. Khi Player teleport trong lúc particle đang bay, VFX tiếp tục bay về tọa độ cũ. Nếu sprite nguồn đã bị dọn trước khi event được render, hàm cũng thoát sớm và không tạo particle.

## 4. Hồ sơ hình ảnh Player

### 4.1. Tạo catalog presentation

Tạo một module dữ liệu, dự kiến:

`src/game/support/PlayerVisualProfiles.ts`

Mỗi profile khai báo:

- ID hình thái;
- texture key và asset URL;
- kích thước nguồn;
- texture combat;
- texture tu luyện nếu có;
- bảng body anchor chuẩn hóa.

Các profile ban đầu:

| Profile | Combat | Tu luyện |
| --- | --- | --- |
| `mortal` | `player-mortal-v1.png` | `player-mortal-cultivate-v1.png` |
| `phap_tu` | `player-phap-tu-v1.png` | Tạm dùng fallback đã thống nhất |
| `kiem_tu` | Tạm dùng `player-mortal-v1.png` | Tạm dùng fallback Phàm Nhân |

### 4.2. Đồng bộ profile vào Phaser

- `PhaserCanvas.vue` giữ snapshot `playerVisualProfileId` trong Phaser registry.
- Khi `realmId` hoặc `cultivationPath` thay đổi, bridge phát event `player_visual_profile_changed` qua EventBus.
- `MainScene` và `CombatScene` đọc snapshot lúc `create()` để không bỏ lỡ trạng thái khi scene khởi động.
- Các scene chỉ nhận profile ID; không giữ tham chiếu trực tiếp đến Player store hoặc GameManager.

### 4.3. Thay texture

- `MainScene` preload art đứng và art kiết già mới.
- `MainScene.onCultivationChanged()` đổi texture tĩnh thay vì gọi animation atlas cũ.
- `CombatScene` preload texture cho mọi profile cần dùng.
- Khi profile đổi, `CombatScene` thay texture, kích thước nguồn và anchor map nhưng giữ nguyên entity, position interpolation, HP/VFX state.

## 5. Hệ thống body anchor

### 5.1. Dữ liệu anchor

Tọa độ lưu theo tỷ lệ `0..1` của ảnh nguồn:

```ts
type PlayerBodyAnchorId =
  | 'head'
  | 'chest'
  | 'castHand'
  | 'offHand'
  | 'feet'

interface NormalizedBodyAnchor {
  x: number
  y: number
}
```

Mỗi hình thái có bảng riêng vì vị trí tay và tỷ lệ đạo bào khác nhau.

### 5.2. Bộ giải tọa độ

Tạo helper thuần, dự kiến:

`src/game/support/SpriteBodyAnchor.ts`

Helper chuyển normalized anchor sang screen coordinate và phải tính đủ:

- `originX` / `originY`;
- `displayWidth` / `displayHeight`;
- `flipX`;
- rotation do walk sway hoặc hiệu ứng khác;
- scale phối cảnh;
- vị trí hiện tại sau interpolation, lunge và recoil.

### 5.3. Hai cách sử dụng

- One-shot VFX: giải anchor đúng thời điểm spawn.
- Sustained/follow VFX: giải lại anchor mỗi frame để effect tiếp tục bám tay khi nhân vật di chuyển.

### 5.4. Debug mode

Thêm cờ development-only để vẽ các chấm màu tại body anchor. Cờ mặc định tắt và không xuất hiện trong production UI.

## 6. Placeholder hồ lô

### 6.1. Cấu trúc

- Dựng placeholder bằng Phaser `Graphics` hoặc `Container`, chưa dùng asset AI.
- Đặt trong `CombatScene`, cùng hệ tọa độ với reward particles.
- Khai báo một anchor `mouth` riêng cho điểm hút.
- Đặt depth trên battlefield entity/VFX nhưng dưới DOM chrome.
- Không có pointer interaction ở giai đoạn này.

### 6.2. Vị trí responsive

- Neo theo canvas và combat bottom inset, không theo grid Player.
- Vị trí mục tiêu: góc trái dưới battlefield, phía trên Event Bar + Control Bar.
- Tính lại trong `applyBattlefieldLayout()` và mọi lần resize.
- Giữ margin tối thiểu để không chạm mép màn hình hoặc Combat Build HUD.

### 6.3. Phản hồi hút

- Idle sway rất nhẹ, có thể tắt nếu gây nhiễu.
- Khi một reward stream tới miệng, hồ lô pulse một nhịp.
- Nhiều mote trong cùng stream không tạo hàng chục pulse; chỉ pulse một lần cho mỗi reward event.

## 7. Refactor reward VFX

### 7.1. Điểm phát

Ưu tiên theo thứ tự:

1. body anchor `chest` của sprite nguồn còn tồn tại;
2. screen position cuối được cache theo entity ID;
3. vị trí grid/projected cuối cùng nếu cache sprite không còn.

Cache phải được cập nhật sau `positionSprite()` và chỉ xóa sau khi mọi reward/death presentation liên quan đã có cơ hội sử dụng.

### 7.2. Điểm hút

- Không còn gọi `emitPoint(player)`.
- Luôn lấy điểm cuối từ anchor `mouth` của reward gourd.
- Với particle đang bay khi resize, điểm cuối được giải lại theo vị trí hồ lô mới.
- Player teleport không còn ảnh hưởng quỹ đạo reward.

### 7.3. Chuyển động hút

- Giữ màu riêng theo `insight`, `item`, `currency`.
- Bay theo Bézier từ nguồn tới hồ lô.
- Tăng tốc ở nửa cuối quỹ đạo.
- Giảm scale và thu hẹp độ phân tán khi tiến gần miệng.
- Thêm xoáy nhỏ ở đoạn cuối để tạo cảm giác bị hút.
- Khi mote cuối hoặc mốc đại diện chạm đích, kích hoạt pulse hồ lô.

### 7.4. Lifecycle

- Dọn active particles, tween, cache và collector handle khi scene shutdown.
- Auto-refight không tạo thêm hồ lô mới hoặc giữ tween từ trận trước.
- Battle end cho phép stream đã sinh hoàn tất, trừ khi scene thật sự shutdown.

## 8. Generate art hồ lô sau placeholder

Chỉ bắt đầu bước này khi placeholder, anchor miệng và reward suction đã hoạt động đúng.

Định hướng art:

- hồ lô chibi mặc họa;
- tông ngọc sẫm, đồng cổ và dây đỏ trầm;
- miệng hồ lô rõ, silhouette đọc tốt ở kích thước khoảng 48–64 px;
- không chữ, không bệ, không bóng nền;
- PNG RGBA trong suốt thật.

Đường dẫn dự kiến:

`public/assets/ui/combat/reward-gourd-v1.png`

Khi thay placeholder bằng art thật, giữ nguyên collector API và chỉ cập nhật texture, kích thước cùng normalized mouth anchor.

## 9. Kiểm thử

### Unit tests

- Chọn đúng visual profile theo `realmId` và `cultivationPath`.
- Fallback an toàn cho `kiem_tu` và profile không hợp lệ.
- Body anchor đúng với origin center/foot, scale, rotation và `flipX`.
- `castHand` tiếp tục bám tay khi Player bob, lunge hoặc recoil.
- Reward target luôn là gourd mouth, không phải Player.
- Teleport Player giữa tween không đổi đích reward.
- Sprite nguồn đã bị dọn vẫn dùng last-known position.
- Hồ lô đặt đúng safe area sau resize.
- Shutdown/auto-refight không để lại tween hoặc object trùng.

### Verification bắt buộc

- Chạy các test CombatScene liên quan.
- Chạy `npm.cmd run type-check`.
- Chạy `npm.cmd run build`.
- QA trực quan ít nhất các trường hợp:
  - Player đứng yên;
  - Player teleport trong lúc reward đang bay;
  - nhiều enemy chết gần nhau;
  - item, insight và currency cùng xuất hiện;
  - resize giữa animation;
  - auto-refight liên tiếp.

## 10. Thứ tự triển khai

1. Tạo visual profile catalog và bridge profile vào Phaser.
2. Thay các ảnh Player mới trong Home/Combat.
3. Tạo body-anchor resolver, anchor data và debug overlay.
4. Dựng placeholder hồ lô cùng mouth anchor.
5. Refactor reward particles sang collector cố định.
6. Thêm source-position cache và xử lý resize/lifecycle.
7. Viết test và QA placeholder.
8. Generate art hồ lô.
9. Thay placeholder bằng asset thật và hiệu chỉnh mouth anchor.
10. Chạy verification cuối.

## 11. Tiêu chí hoàn thành

- Hình thái Player đúng với Phàm Nhân/Pháp Tu trong combat.
- Pose tu luyện mới thay thế sprite tu luyện cũ theo policy profile.
- VFX gắn tay xuất phát đúng tại bàn tay trong mọi scale và chuyển động toàn thân.
- Reward VFX xuất phát từ vị trí enemy hợp lý kể cả sau khi sprite bị dọn.
- Mọi reward VFX bay vào miệng hồ lô và không bị Player teleport làm lệch.
- Hồ lô nằm ổn định ở safe area trên mọi kích thước hỗ trợ.
- Không có object/tween rò rỉ qua auto-refight hoặc scene shutdown.
- Test liên quan, type-check và build đều đạt.
