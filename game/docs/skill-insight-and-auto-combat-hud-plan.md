# Kế hoạch Cảm ngộ Kỹ năng và HUD kỹ năng Auto Combat

## 1. Mục tiêu đã chốt

- Điểm kỹ năng không còn nhận được khi tăng tiểu cảnh giới.
- Kỹ năng được mở khóa và nâng cấp bằng **Cảm ngộ Kỹ năng** nhận từ chiến đấu.
- Cảm ngộ Tâm Pháp và Cảm ngộ Kỹ năng là hai tiến trình riêng, dù cùng đến từ chiến đấu.
- Combat luôn tự động. HUD kỹ năng chỉ trình bày build và trạng thái thi triển; không cho click cast và không có hotkey cast.
- Phàm Nhân có đúng một ô **Trảm**.
- Pháp Tu có năm ô kỹ năng.
- Mỗi con đường tu luyện có thiết kế HUD riêng. Không mặc định mọi path đều dùng năm ô hoặc cùng một bố cục.
- Không migration save trong giai đoạn development; thay đổi schema sẽ tăng save version.

## 2. Tài nguyên Cảm ngộ Kỹ năng

Thêm vào `PlayerData`:

```ts
skillInsight: number
totalSkillInsightGained: number
```

- `skillInsight` là số dư có thể tiêu.
- `totalSkillInsightGained` chỉ tăng, dùng cho thống kê hoặc điều kiện progression về sau.
- `CultivationSystem.breakthrough()` ngừng cấp `skillPoints`; `attributePoints` vẫn giữ nguyên.
- Xóa dần `skillPoints` khỏi domain, UI, test và save schema thay vì duy trì hai tài nguyên song song.

## 3. Cảm ngộ từ chiến đấu

Tách rõ reward:

```ts
interface EnemyRewards {
  techniqueInsight?: number
  skillInsight?: number
}
```

- Hạ quái cấp Cảm ngộ Kỹ năng vào người chơi.
- Tâm pháp đang trang bị nhận Cảm ngộ Tâm Pháp.
- Không trang bị tâm pháp vẫn phải nhận Cảm ngộ Kỹ năng.
- Cả hai reward phải đi qua guard `rewardGranted`, không được cấp lặp khi nhiều tick cùng xử lý enemy chết.
- `BattleRewardSummary` và màn hình kết quả hiển thị hai dòng riêng, không tiếp tục dùng tên chung chung `experience`.
- Toàn bộ hệ số reward đặt trong config balance tập trung.

## 4. Mở khóa node bằng Cảm ngộ

Đổi semantic `ProgressionNode.cost` thành `insightCost`.

Quy trình mua node:

1. Kiểm tra node chưa mua.
2. Kiểm tra cảnh giới, nguyên tố và toàn bộ prerequisite.
3. Kiểm tra `player.skillInsight >= node.insightCost`.
4. Trừ Cảm ngộ đúng một lần.
5. Đánh dấu node đã mua.
6. Áp modifier, mở nguyên tố hoặc học kỹ năng.

Các UI `SkillPathPanel`, `NodeTreePanel` và `NodeInspector` đổi nhãn Skill Point/Điểm Pháp Tu thành Cảm ngộ và hiển thị số dư hiện tại cùng chi phí node.

## 5. Nâng cấp kỹ năng bằng Cảm ngộ

Cơ chế active skill tự nhận XP theo số lần cast và passive skill tự nhận XP theo trigger sẽ bị loại bỏ. Auto combat không nên thưởng thêm progression chỉ vì một skill có cooldown ngắn hoặc trigger nhiều lần.

Thêm API domain:

```ts
getSkillUpgradeInsightCost(skill: Skill): number
upgradeSkill(skillId: string, player: PlayerData): boolean
```

- Người chơi chủ động nâng cấp ngoài combat.
- Nâng cấp kiểm tra max level và đủ Cảm ngộ trước khi mutate.
- Chi phí lấy từ config hoặc đường cong cân bằng tập trung, không rải magic number.
- Khi thất bại, thao tác phải hoàn toàn no-op.
- Level vẫn tiếp tục scale damage/modifier qua `SkillSystem.getEffectiveSkill()`.

## 6. HUD kỹ năng trong Auto Combat

HUD được làm bằng Vue trong `CombatSceneOverlay`, không vẽ trực tiếp bằng Phaser. Nó chỉ đọc snapshot của combat và tuyệt đối không gọi `use()`, `useInSlot()` hoặc sửa trực tiếp cooldown/resource.

```text
CombatSceneOverlay
└── CombatBuildHud
    └── renderer theo cultivation path
```

`CombatBuildHud` chọn renderer theo trạng thái nhân vật:

- Chưa nhập môn/Phàm Nhân: `MortalCombatHud`.
- `phap_tu`: `PhapTuCombatHud`.
- `kiem_tu`: `KiemTuCombatHud`.
- Path mới phải đăng ký renderer riêng; không tự rơi về giao diện năm ô của Pháp Tu.

Các renderer dùng chung component nhỏ như icon, cooldown mask, resource cost và cast indicator, nhưng được tự quyết định bố cục và ngôn ngữ hình ảnh.

## 7. Thiết kế theo path

### Phàm Nhân

- Một ô lớn duy nhất cho **Trảm**.
- Thể hiện nhịp đánh kế tiếp bằng vòng tiến độ hoặc hiệu ứng pulse.
- Không dựng năm ô trống và không hiện slot khóa.

### Pháp Tu

- Năm ô kỹ năng là phần trung tâm của build HUD.
- Luôn dựng đủ năm vị trí để người chơi nhìn được cấu trúc build.
- Ô chưa mở hoặc chưa trang bị có trạng thái khóa/trống rõ ràng.
- Mỗi ô hiển thị cooldown, cast time, mana cost và trạng thái thiếu mana.
- Có thể dùng màu nguyên tố/nhánh build để tạo liên kết trực quan giữa các pháp thuật.

### Kiếm Tu

- Không sao chép hàng năm ô của Pháp Tu.
- Thiết kế xoay quanh Kiếm Ý và chu trình vận kiếm; ưu tiên bố cục dạng kiếm trận/quỹ đạo hoặc chuỗi kỹ năng.
- Số vị trí và cách nhóm skill lấy từ quy tắc riêng của Kiếm Tu.
- Chi tiết mỹ thuật được chốt ở phase thiết kế Kiếm Tu, nhưng contract dữ liệu phải hỗ trợ ngay từ đầu.

### Path tương lai

- Mỗi path khai báo một `combatHudKind` hoặc được ánh xạ qua registry typed.
- Renderer chỉ chịu trách nhiệm trình bày; BattleSystem vẫn là nguồn quyết định auto-cast duy nhất.
- Không hard-code `phap_tu ? 5 : 5` hoặc ép mọi path vào `MAX_SKILL_LOADOUT_SLOTS`.

## 8. Thông tin hiển thị

Thông tin thường trực trên ô, tùy renderer sắp xếp:

- Icon kỹ năng.
- Tên hoặc ký hiệu ngắn.
- Mana/resource cost.
- Cooldown còn lại bằng số và lớp phủ tiến độ.
- Thanh hoặc vòng cast progress khi đang niệm.
- Trạng thái thiếu tài nguyên, chưa mở, trống hoặc chưa phát hành.

Tooltip có thể hiển thị thêm:

- Mô tả và hiệu ứng.
- Level hiện tại.
- Sát thương hoặc giá trị hiệu ứng thực.
- Cooldown gốc và cooldown thực sau giảm hồi chiêu.
- Cast time gốc và cast time thực sau cast speed.
- Resource type và cost.
- Specialization đang chọn.

HUD không cần nút bấm, phím tắt, focus state hay command queue manual cast.

## 9. Snapshot trạng thái combat

Không chạy timer riêng trong Vue. Tạo snapshot chỉ đọc từ runtime thật:

```ts
interface CombatSkillPresentationState {
  skillId: string
  slotIndex?: number
  cooldownRemaining: number
  cooldownTotal: number
  castRemaining?: number
  castTotal?: number
  resourceCurrent: number
  resourceCost: number
  state:
    | 'ready'
    | 'cooldown'
    | 'casting'
    | 'insufficient_resource'
    | 'locked'
    | 'empty'
    | 'unreleased'
}
```

Nguồn dữ liệu:

- Cooldown: `remainingCooldownBySlot` hoặc timer của basic attack tương ứng.
- Cast: `CombatEntity.castTimeRemaining` và `castTimeTotal`.
- Mana/resource: `CombatEntity` đang nằm trong battle.
- Skill và build: `SkillManager` cùng cultivation path hiện tại.

Snapshot được cập nhật theo nhịp state bridge hiện có. Pause, fixed-step catch-up, Chromium throttle hoặc Electron không được làm HUD tự đếm lệch khỏi BattleSystem.

## 10. Thứ tự triển khai

1. Thêm `skillInsight`, bỏ nguồn cấp `skillPoints` từ breakthrough và tăng save version.
2. Tách reward Cảm ngộ Kỹ năng/Cảm ngộ Tâm Pháp cùng battle summary.
3. Chuyển Node Tree sang `insightCost`.
4. Chuyển nâng level skill từ XP-per-use sang tiêu Cảm ngộ.
5. Định nghĩa presentation snapshot và path-to-renderer registry.
6. Làm HUD một ô của Phàm Nhân.
7. Làm HUD năm ô của Pháp Tu.
8. Làm renderer riêng cho Kiếm Tu theo thiết kế build của path.
9. Hoàn thiện tooltip, animation và responsive layout.

## 11. Kiểm thử bắt buộc

- Đột phá tiểu cảnh giới không cấp Cảm ngộ Kỹ năng; `attributePoints` vẫn tăng.
- Enemy chết chỉ cấp mỗi loại Cảm ngộ một lần.
- Không có tâm pháp vẫn nhận Cảm ngộ Kỹ năng.
- Mở node và nâng skill trừ đúng chi phí; không đủ tài nguyên phải no-op.
- Không còn tăng level skill do cast/trigger.
- Phàm Nhân chỉ hiện một ô Trảm.
- Pháp Tu hiện đúng năm vị trí và đúng trạng thái từng ô.
- Kiếm Tu dùng renderer riêng, không render nhầm giao diện Pháp Tu.
- Cooldown theo slot trùng skill vẫn độc lập.
- Cast progress phản ánh cast speed.
- Thiếu mana/resource được hiển thị đúng.
- Pause và catch-up không làm presentation state lệch runtime.
- HUD không có đường gọi manual cast.

## 12. Ngoài phạm vi

- Manual cast, hotkey cast và click-to-cast.
- Một layout dùng chung cho mọi cultivation path.
- Migration save cũ.
- Cân bằng số Cảm ngộ cuối cùng; phase đầu dùng config tạm để dễ chỉnh.
