# Hướng dẫn hệ thống game hiện tại

> Roadmap hậu kỳ: [Phù Ultimate và Trận Pháp chiến trường](./future-talisman-formation-system-plan.md).
> Hiện tại Phù/Trận được giữ khóa; hướng socket vào Equipment đã bị loại bỏ.
Tài liệu này là điểm tham chiếu tổng hợp cho trạng thái **đang được triển khai trong code**. Các plan rời trước đây đã được hợp nhất và loại bỏ vì trùng lặp hoặc lỗi thời. Khi tài liệu và code khác nhau, các module được dẫn bên dưới là nguồn sự thật.

## Kiến trúc và giao diện

Game dùng Vue 3 cho UI, Pinia cho state phía UI và Phaser cho cảnh nền/chiến đấu. `src/components/layout/GameRoot.vue` ghép các lớp trong khung 16:9 cố định rồi scale theo viewport. Ở Động Phủ, Phaser nằm dưới top bar, bottom bar, panel trái, icon công trình và overlay chức năng. Khi chiến đấu, chrome Động Phủ được thay bằng `CombatSceneOverlay`; canvas Phaser vẫn được giữ và tự chuyển scene. Kích thước khung và slot dùng nguồn chung tại `src/core/ui/DesignFrame.ts` và `SlotSizes.ts`.

## Tu luyện, đột phá và cảnh giới

`CultivationSystem` quản lý tiến độ tu luyện. Luồng đột phá nằm ở `useBreakthrough.ts`; Độ Kiếp được điều phối qua `useTribulation.ts` và dữ liệu kiếp nạn. Lần chuyển từ Phàm Nhân sang Luyện Khí cũng là nghi lễ chọn con đường tu luyện.

Mỗi đại cảnh giới cấp một nội tại đúng một lần qua `RealmPassiveSystem` và dữ liệu `RealmPassives.ts`; người chơi xem chúng trong `RealmPassivePanel.vue`.

Trong chiến đấu, `RealmPressure` so chênh lệch **đại cảnh giới**. Bên cao hơn gây nhiều và nhận ít sát thương hơn. Bậc Nhập Đạo giảm phần áp lực còn lại: bậc 1 không giảm, bậc 6 miễn hoàn toàn. Chênh lệch được chặn ở 5 cảnh giới và hệ số đánh ngược lên không thấp hơn 0,1. Đường cong tuyến tính hiện tại vẫn cần cân bằng bằng playtest.

## Con đường tu luyện hiện có

`src/core/player/CultivationPathKit.ts` hiện chỉ công khai hai lựa chọn:

- **Pháp Tu** dùng Đại Ngũ Hành Chân Quyết. Đây là một path thống nhất; người chơi mở Hỏa, Mộc, Thủy, Kim, Thổ và kỹ năng qua Node Tree, rồi phối hợp nhiều hành bằng element loadout.
- **Kiếm Tu** dùng Ngự Kiếm Tâm Kinh, bộ ba kỹ năng cố định và tài nguyên Kiếm Ý riêng.

Code chiến đấu có một số plumbing và test cho Thể Tu, nhưng `CultivationPathId` chưa đưa Thể Tu thành lựa chọn chơi được. Không nên mô tả nó như path đã phát hành.

Hệ Ngũ Hành nằm trong `src/core/element/`; node Pháp Tu hiện hành nằm tại `src/data/progression/PhapTuNodes.ts`. Hai ailment khác hành cùng tồn tại có thể kích hoạt phản ứng. `ReactionManager` xử lý true damage, tiêu thụ trạng thái và các ngoại lệ data-driven như giữ một vế, tạo ailment, cấp buff hoặc giảm max HP. Các nhánh nguyên tố cũ vì vậy là nội dung của cùng một cây Pháp Tu.

## Skill Node Tree

Luồng hiện tại không mua trực tiếp trên node. Người chơi chọn node trong `NodeTreePanel.vue`, xem điều kiện/hiệu ứng và mua trong `NodeInspector.vue`. `GameManager.purchaseNode()` cùng `NodeSystem` kiểm tra prerequisite, điểm kỹ năng và áp dụng effect.

Sau giao dịch thành công, `SkillPathPanel.vue` phát `unlockTrigger`; `NodeTreePanel.vue` đo tâm node bằng `getBoundingClientRect`, cập nhật qua `ResizeObserver`, rồi chạy đường nối trước node. `SkillConnections.vue` vẽ SVG cho ba trạng thái `locked`, `active`, `unlocking`; dash-offset tạo ánh sáng chạy parent→child. Kết thúc đường nối, node pulse rồi trở về state purchased reactive. Kế hoạch SkillNode muộn nhất đã được implement đầy đủ, không còn hạng mục code mở.

## Chiến đấu

`BattleSystem` điều phối timeline, cast, movement và missile; `CombatSystem` giải quyết hit, né, chí mạng, giáp, kháng, Realm Pressure, ailment và sát thương. Model missile data-driven trong `src/core/combat/missile/` hỗ trợ xuyên, nảy, bám đích, AOE, tỷ lệ sát thương mục tiêu phụ và knockback; danh sách mục tiêu đã trúng ngăn damage lặp ngoài ý muốn.

Code hiện tại vẫn dùng grid 10×16 và player gate ở mép trái. Hướng rework đã
chốt là bàn cờ vây 19×19: player actor chuyển ra ngoài bàn; player có dải tầm
đánh mặc định 9 hành trên toàn chiều ngang; quái gây sát thương khi vị trí cộng
tầm đánh chạm hành thủ thành số 1. Plan này chưa phải trạng thái runtime hiện tại.

Boss có thể đổi phase theo ngưỡng HP, nhận buff, enrage theo thời gian và triệu hồi quái. UI hiện hành nằm tại `src/components/game/combat/`, gồm top/status/event bar, control bar và các trạng thái thắng, thua, kết quả.

## Trang bị, vật phẩm và kinh tế

Quy tắc về phẩm chất, độ hiếm, affix, set, đặt tên, túi đồ và kinh tế nguyên liệu nằm tại [Item Design Reference](./item-design-reference.md). Không sao chép các bảng vào đây để tránh hai nguồn lệch nhau.

## Công trình, chế tác và khai thác

Khai thác là job theo thời gian, có giới hạn lượt đồng thời theo cảnh giới; các vùng cấp nguyên liệu thô như hạt giống, quặng và linh mộc. `BuildingSystem` quản lý xây, nâng cấp, tích trữ và thu hoạch:

- Linh Thảo Viên gieo hạt theo các ô mở dần theo cấp; Linh Tuyền tạo Linh Thạch.
- Lò Luyện và Thiên Công Phường xử lý nguyên liệu thô thành vật liệu chế tác.
- Crafting station mở màn chức năng tương ứng; cấp công trình có thể giảm thời gian, tăng cơ hội phẩm chất và số job đồng thời.

Recipe/Crafting dùng hàng đợi theo thời gian và route thành phẩm về đúng bag. Định nghĩa cân bằng nằm tại `src/data/building/`, `src/data/exploration/` và `src/data/recipe/`.

## Dữ liệu, asset và bảo trì tài liệu

- Dữ liệu gameplay tĩnh nằm trong `src/data/`; logic domain nằm trong `src/core/`.
- Seed tên tiên hiệp chưa được runtime sử dụng nằm tại `docs/reference/xianxia-name-seed.json`, tách khỏi data tham gia build.
- Quy trình asset: [asset-drop/README.md](../asset-drop/README.md). Yêu cầu riêng của Động Phủ: `src/assets/UI/dong-phu/ASSET_REQUIREMENTS.md`.
- Khi đổi hành vi, cập nhật tài liệu sống trong `docs/` cùng thay đổi code; không tạo thêm plan extensionless.
