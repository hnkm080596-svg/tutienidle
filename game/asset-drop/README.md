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

## Manifest — UI thường (không phải combat scene/trận pháp)

Chrome dùng chung (áp cho mọi panel/button/tab):

| File thả vào `asset-drop/` | Đường dẫn đích | Dùng cho |
|---|---|---|
| `ui__panel__background.png` | `public/assets/ui/panel/background.png` | Nền chung OverlayPanel/GamePanel |
| `ui__panel__frame.png` | `public/assets/ui/panel/frame.png` | Viền khung panel |
| `ui__button__primary.png` | `public/assets/ui/button/primary.png` | GameButton trạng thái thường |
| `ui__button__primary-hover.png` | `public/assets/ui/button/primary-hover.png` | GameButton hover |
| `ui__button__disabled.png` | `public/assets/ui/button/disabled.png` | GameButton disabled |
| `ui__tab__active.png` | `public/assets/ui/tab/active.png` | TabBar tab đang chọn |
| `ui__tab__inactive.png` | `public/assets/ui/tab/inactive.png` | TabBar tab chưa chọn |
| `ui__portrait__player-frame.png` | `public/assets/ui/portrait/player-frame.png` | PlayerPortrait khung viền |

Nền riêng từng panel chức năng:

| File thả vào `asset-drop/` | Đường dẫn đích | Panel |
|---|---|---|
| `ui__panel-character__background.png` | `public/assets/ui/panel/character/background.png` | CharacterPanel.vue |
| `ui__panel-inventory__background.png` | `public/assets/ui/panel/inventory/background.png` | InventoryPanel.vue |
| `ui__panel-equipment-hall__background.png` | `public/assets/ui/panel/equipment-hall/background.png` | EquipmentHallPanel.vue |
| `ui__panel-pill-room__background.png` | `public/assets/ui/panel/pill-room/background.png` | PillRoomPanel.vue |
| `ui__panel-scripture-pavilion__background.png` | `public/assets/ui/panel/scripture-pavilion/background.png` | ScripturePavilionPanel.vue |
| `ui__panel-vendor__background.png` | `public/assets/ui/panel/vendor/background.png` | VendorPanel.vue |
| `ui__panel-worker-lodge__background.png` | `public/assets/ui/panel/worker-lodge/background.png` | WorkerLodgePanel.vue |
| `ui__panel-quest__background.png` | `public/assets/ui/panel/quest/background.png` | QuestPanel.vue |
| `ui__panel-settings__background.png` | `public/assets/ui/panel/settings/background.png` | SettingsPanel.vue |
| `ui__panel-realm__background.png` | `public/assets/ui/panel/realm/background.png` | RealmPanel.vue |
| `ui__panel-skill-path__background.png` | `public/assets/ui/panel/skill-path/background.png` | SkillPathPanel.vue |
| `ui__panel-technique__background.png` | `public/assets/ui/panel/technique/background.png` | TechniquePanel.vue |
| `ui__panel-artifact__background.png` | `public/assets/ui/panel/artifact/background.png` | ArtifactPanel.vue |
| `ui__panel-quan-khi__background.png` | `public/assets/ui/panel/quan-khi/background.png` | QuanKhiPanel.vue |
| `ui__panel-luyen-the__background.png` | `public/assets/ui/panel/luyen-the/background.png` | LuyenThePanel.vue |

Icon riêng từng nút Command Wheel (DongFuCommandWheel.vue, xem `wheelIconPath()`
— path suy thẳng từ `slot.id` trong `commandWheelCatalog.ts`, chưa có file thì
chỉ hiện label chữ, không vỡ layout):

| File thả vào `asset-drop/` | Đường dẫn đích | Slot (label trong game) |
|---|---|---|
| `ui__wheel__character.png` | `public/assets/ui/wheel/character.png` | Nhân Vật |
| `ui__wheel__realm.png` | `public/assets/ui/wheel/realm.png` | Cảnh Giới |
| `ui__wheel__skill.png` | `public/assets/ui/wheel/skill.png` | Kỹ Năng |
| `ui__wheel__technique.png` | `public/assets/ui/wheel/technique.png` | Tâm Pháp |
| `ui__wheel__luyen_the.png` | `public/assets/ui/wheel/luyen_the.png` | Luyện Thể |
| `ui__wheel__quest.png` | `public/assets/ui/wheel/quest.png` | Nhiệm Vụ |
| `ui__wheel__phap_bao.png` | `public/assets/ui/wheel/phap_bao.png` | Pháp Bảo |
| `ui__wheel__formation_slot.png` | `public/assets/ui/wheel/formation_slot.png` | Trận |
| `ui__wheel__teleport_array.png` | `public/assets/ui/wheel/teleport_array.png` | Truyền Tống Trận |
| `ui__wheel__pill_room.png` | `public/assets/ui/wheel/pill_room.png` | Đan Phòng |
| `ui__wheel__gathering_outpost.png` | `public/assets/ui/wheel/gathering_outpost.png` | Sản Xuất |
| `ui__wheel__chi_hien_quan.png` | `public/assets/ui/wheel/chi_hien_quan.png` | Chiêu Hiền Quán |
| `ui__wheel__equipment_hall.png` | `public/assets/ui/wheel/equipment_hall.png` | Khí Đường |
| `ui__wheel__scripture_pavilion.png` | `public/assets/ui/wheel/scripture_pavilion.png` | Tàng Kinh Các |
| `ui__wheel__settings.png` | `public/assets/ui/wheel/settings.png` | Cài Đặt |

`talisman_slot` (Phù) không có trong bảng — slot future, chưa render nút nào
trong wheel nên chưa cần icon.
