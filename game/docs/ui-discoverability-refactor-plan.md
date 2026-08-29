# Kế hoạch UI Discoverability & Dọn dẹp Trình bày

> Thuộc Phase 2 của [roadmap.md](./roadmap.md). Kế thừa phần còn nợ của gameplay-ui-feedback-responsive-cleanup-plan (Workstream A/B/I — plan đã dọn sau khi các workstream đó hoàn thành) và giải quyết các vấn đề discoverability/god-class phát hiện trong đợt rà soát 2026-08-27.
> Phần âm thanh tách riêng tại [audio-game-feel-plan.md](./audio-game-feel-plan.md).

## 1. Mục tiêu

- Hotspot công trình trong Động Phủ tự giải thích được: không còn vùng bấm vô hình phụ thuộc tooltip.
- `CombatScene.ts` (2.922 dòng / ~101KB) không còn là god-class.
- Geometry combat một nguồn sự thật (DOM insets), bỏ hằng số trùng.
- Dọn placeholder và emoji lệch tông tiên hiệp.
- Hoàn tất Workstream A/B/I của plan cleanup cũ.

## 2. Hiện trạng

- **Hotspot công trình**: `HomeBuildingIcons.vue` đặt vùng bấm vô hình theo % trên nền PNG `thanh-van-dong-fu-master-buildings-v1.png`; không nameplate, không badge trạng thái (built/locked/upgradeable/đang hoạt động). Người chơi mới không biết gì để bấm.
- **God-class**: `src/game/scenes/CombatScene.ts` ~2.922 dòng chứa damage numbers, cast bar, hit-flash, lunge/recoil, DoT text, hồ lô phần thưởng, grid projection, VFX spawn.
- **Hai nguồn geometry**: `src/core/ui/DesignFrame.ts` xuất hằng `COMBAT_*_HEIGHT` (scene import) trong khi DOM dùng CSS variable `--combat-*-h` với `clamp()` trong `src/assets/theme.css`. `CombatSceneOverlay.vue` đã đo chiều cao thật và cấp `setCombatInsets()` xuống scene — nhưng hằng cũ vẫn tồn tại song song.
- **Emoji**: `CombatEventBar.vue` dùng 💥☠🔥 — lệch tông "Ink & Gold".
- **Placeholder**: `BuildingConstructionGate.vue` vẽ chữ cái hình học thay art; art quái chỉ có tier mortal; chưa có portrait Kiếm Tu.
- **Panel che scene**: mở đồng thời LeftPanel (Nhân Vật) + RightPanel (paperdoll + túi) chiếm ~700–920px ở viewport 1280px.
- **Không có tài nguyên thường trực ở home**: Linh Thạch/vật liệu chính chỉ thấy khi mở panel.
- **Workstream nợ**: A (always-clickable), B (lý do tiếng Việt), I (trim tooltip) chưa phủ building/sản xuất/Luyện Thể/node/đột phá (ghi ở cuối plan cleanup cũ).

## 3. Thiết kế

### 3.1 Nameplate + badge công trình

- Mỗi hotspot trong `HomeBuildingIcons.vue` thêm nameplate nhỏ dưới icon (tên công trình, luôn hiện ở cấp zoom mặc định) và badge trạng thái:
  - `locked`: khóa (mờ + icon khóa)
  - `upgradeable`: chấm sáng (có thể nâng cấp — đủ tài nguyên)
  - `active`: đang có job (thanh tiến trình mini hoặc icon chuyển động)
  - `ready`: thu hoạch được
- Trạng thái suy ra từ `BuildingSystem`/`ProductionSystem` qua store hiện có — không tạo state song song.
- Nameplate dùng typography token sẵn có trong `theme.css`; không hardcode px.

### 3.2 Tách `CombatScene.ts`

Cắt theo trách nhiệm, mỗi module một file trong `src/game/scenes/combat/`:

| Module | Trách nhiệm |
|---|---|
| `combat-damage-text.ts` | Nảy số damage/crit/DoT gom 3 lần/giây |
| `combat-cast-bar.ts` | Cast bar + windup |
| `combat-vfx-spawner.ts` | Spawn VFX theo preset, hit-flash, lunge/recoil |
| `combat-reward-gourd.ts` | Hồ lô hút phần thưởng Bézier |
| `combat-grid-view.ts` | Grid projection 2.5D, depth layers |
| `CombatScene.ts` | Orchestrator: giữ vòng đời scene, EventBus wiring, delegate cho các module |

Nguyên tắc:
- Không đổi hành vi nhìn thấy được — refactor thuần, giữ nguyên 10 file test hiện có của CombatScene làm lưới an toàn.
- Mỗi module nhận dependency tường minh (scene, eventBus), không import vòng.
- Tách dần từng module qua nhiều commit; mỗi lần tách test phải xanh.

### 3.3 Thống nhất geometry combat

- Nguồn sự thật duy nhất: DOM đo thật → `setCombatInsets()` (pattern hiện có của `CombatSceneOverlay.vue`).
- Xóa hằng `COMBAT_*_HEIGHT` khỏi `DesignFrame.ts` sau khi grep xác nhận mọi caller đã chuyển sang insets. Nếu còn caller ngoài scene (vd layout tính trước), chuyển chúng đọc CSS variable hoặc nhận insets.
- Test: scene nhận insets đúng sau resize viewport (mở rộng test hiện có nếu cần).

### 3.4 Dọn emoji và placeholder

- `CombatEventBar.vue`: thay 💥☠🔥 bằng glyph SVG/CSS theo theme Ink & Gold (mỗi reaction một glyph riêng — phối hợp Task icon reaction của [combat-balance-pass-plan.md](./combat-balance-pass-plan.md)).
- `BuildingConstructionGate.vue`: thay chữ cái hình học bằng art placeholder đúng tông (icon công trình + khung); art final theo quy trình sản xuất art đã hoàn thành (thanh-van-dong-fu — xem README trong `public/assets/buildings/dong-fu/`).
- Art quái realm cao và portrait Kiếm Tu: ghi vào checklist asset, thực hiện cùng [truc-co-kim-dan-content-plan.md](./truc-co-kim-dan-content-plan.md) (M1 cần art quái Trúc Cơ).

### 3.5 Tài nguyên thường trực ở home

- Thêm dải tài nguyên gọn ở home (Linh Thạch + 2–3 vật liệu đang dùng nhiều nhất cho nâng cấp), vị trí không xung đột với `DongFuCommandWheel`. Click vào mở panel túi tương ứng.

### 3.6 Quy tắc panel che scene

- Không mở đồng thời LeftPanel + RightPanel chồng nhau ở viewport < 1440px: mở cái sau đóng cái trước (hoặc dock thành tab). Ở viewport rộng hơn cho phép cả hai.
- Ghi quy tắc vào comment component + test component nếu khả thi.

### 3.7 Hoàn tất Workstream A/B/I

Theo định nghĩa trong plan cleanup cũ:
- **A (always-clickable)**: mọi nút hành động luôn nhận click; khi không thực thi được thì phản hồi lý do. Phủ nốt: building, sản xuất, Luyện Thể, node tree, đột phá.
- **B (lý do tiếng Việt)**: mọi từ chối hành động có lý do tiếng Việt rõ ràng, không codename (`missing_essence` → "Thiếu Phàm Khí Tinh Hoa…"). Rà soát enum reason trong `EquipmentSystem`, `BuildingSystem`, `NodeSystem`, breakthrough.
- **I (trim tooltip)**: tooltip mặc định gọn, chi tiết sau Alt — áp dụng cho các panel chưa phủ.

## 4. Nhiệm vụ triển khai

1. **Task 1**: Nameplate + badge công trình (§3.1).
2. **Task 2–7**: Tách `CombatScene.ts` từng module (§3.2) — mỗi module một task, test xanh sau mỗi task.
3. **Task 8**: Xóa hằng geometry trùng (§3.3).
4. **Task 9**: Glyph EventBar + placeholder ConstructionGate (§3.4).
5. **Task 10**: Dải tài nguyên home (§3.5) + quy tắc panel (§3.6).
6. **Task 11**: Workstream A/B phủ building/sản xuất/Luyện Thể/node/đột phá.
7. **Task 12**: Workstream I (trim tooltip các panel còn lại).
8. **Task 13**: Checklist asset còn thiếu (quái realm cao, portrait Kiếm Tu, art construction gate) — bàn giao cho pipeline asset.

## 5. Kiểm chứng

```powershell
npm.cmd run test
npm.cmd run type-check
npm.cmd run build
```

- 10 file test CombatScene hiện có không đổi kết quả qua từng task tách module.
- Thủ công: người chưa từng chơi có thể nhận diện công trình và trạng thái của chúng trong Động Phủ mà không cần tooltip; resize 3 viewport (1280/1600/1920) không lệch layout combat.
- Grep xác nhận không còn emoji trong `CombatEventBar.vue`, không còn `COMBAT_*_HEIGHT` trong code runtime.

## 6. Rủi ro và lưu ý

- **Tách CombatScene làm vỡ hiệu năng**: giữ nguyên một scene, chỉ tách file — không đổi vòng đời render; theo dõi FPS trước/sau.
- **Nameplate gây rối màn hình**: mật độ chữ phải kiểm tra ở viewport nhỏ; có toggle ẩn nameplate trong setting nếu cần.
- **Workstream B đụng chạm nhiều enum reason**: làm theo danh sách rà soát, không sửa lan man ngoài lý do từ chối hành động.
- Art final không block code: mọi task dùng placeholder đúng tông khi chưa có asset.

## 7. Tham chiếu từ `Plans .md` cũ (ý tưởng UI rework, chưa implement)

> Chuyển từ `docs/Plans .md` (đã xóa 2026-08-28, docs-sync Task 4) để không mất ý tưởng gốc. Đây là ĐỊNH HƯỚNG UI tương lai, chưa có trong code.

- **Overlay panel thống nhất**: mọi chức năng dùng overlay panel (trừ Nhân Vật và Kho); cần quy tắc/tầng tương tác/logic chung, tránh mỗi chức năng một kiểu thiết kế.
- **Nhân Vật + Kho hợp nhất**: phân 2 bên left/right panel; Kho bên phải; bấm Nhân Vật là slide out cả 2 bên. Left panel chỉ show stats (bỏ khu vực tâm pháp + trang bị), bỏ tab, show hết theo nhóm; Ngũ Hành có thể show dạng art ngôi sao 5 đỉnh (mỗi đỉnh 1 hành, phong lôi ở giữa). Stat dài cho slide nhưng không hiện thanh kéo. Panel phải khi bật luôn là equipment inventory (không phải material).
- **Nút Cảnh Giới** (thay Kho cũ): overlay chứa cảnh giới, tu vi, nút tiểu đột phá/đại đột phá + auto đột phá flag; nút luôn hiện, xám khi chưa đủ điều kiện; giữa panel là sprite tu luyện nhân vật; dưới hoạt ảnh + cây tu vi là nút tương tác. Bỏ realm passive + buff nhập đạo; kiến cơ giữ nguyên nhưng show trong tu luyện panel như node skill (9 node, thắp sáng khi mở khóa).
- **Tâm Pháp overlay**: show hình ảnh, tên, stat cộng thêm, description, thuần thục hiện tại theo thứ tự rõ ràng.
- **Kỹ năng overlay**: không bỏ kỹ năng khi lên cảnh giới; show tất cả đã học, chia nhóm theo cảnh giới như thư viện; trái show tên + cấp tối giản, phải show cây kỹ năng tương ứng.
