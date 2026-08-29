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

## Thiên Phú

Thiên Phú là quyết định chọn hướng Đạo duy nhất lúc tạo nhân vật: roll 9 thẻ, chọn đúng 1 (`CharacterCreationService.ts`, catalog `src/data/talent/Talents.ts`). Mỗi thiên phú là một ngoại lệ của luật chơi — không có talent cộng chỉ số; effect được tiêu thụ qua getter tập trung tại `src/core/talent/TalentEffects.ts` (tốc độ tu luyện, Cảm Ngộ Kỹ năng, Linh Thạch, rơi trang bị, Luyện Thể, luyện đan, sống sót đòn chí mạng, giữ ailment khi Reaction, hồi máu khi diệt quái). Cảm Ngộ Kỹ năng vì vậy mặc định đến từ chiến đấu, riêng thiên phú Ngộ Đạo đổi tu vi tu luyện online lấy Cảm Ngộ — cố ý, là bản sắc talent. Thiên phú đã chọn hiển thị trong panel Nhân Vật.

## Con đường tu luyện hiện có

`src/core/player/CultivationPathKit.ts` hiện chỉ công khai hai lựa chọn:

- **Pháp Tu** dùng Đại Ngũ Hành Chân Quyết. Đây là một path thống nhất; người chơi mở Hỏa, Mộc, Thủy, Kim, Thổ và kỹ năng qua Node Tree, rồi phối hợp nhiều hành bằng element loadout.
- **Kiếm Tu** dùng Ngự Kiếm Tâm Kinh, bộ ba kỹ năng cố định và tài nguyên Kiếm Ý riêng.

Code chiến đấu có một số plumbing và test cho Thể Tu, nhưng `CultivationPathId` chưa đưa Thể Tu thành lựa chọn chơi được. Không nên mô tả nó như path đã phát hành.

Hệ Ngũ Hành nằm trong `src/core/element/`; node Pháp Tu hiện hành nằm tại `src/data/progression/PhapTuNodes.ts`. Hai ailment khác hành cùng tồn tại có thể kích hoạt phản ứng. `ReactionManager` xử lý true damage, tiêu thụ trạng thái và các ngoại lệ data-driven như giữ một vế, tạo ailment, cấp buff hoặc giảm max HP. Các nhánh nguyên tố cũ vì vậy là nội dung của cùng một cây Pháp Tu.

## Nội dung Trúc Cơ (chương 3)

Chương 3 gồm 10 stage authored riêng `foundation_floor_1..10` (`src/data/stage/Stages.ts`) với 20 quái prefix `foundation_` (`src/data/enemy/Enemies.ts`) — không còn clone enemy pool Luyện Khí. Quy luật Ngũ Hành Tương Sinh theo cặp tầng Mộc(1-2)→Hỏa(3-4)→Thổ(5-6)→Kim(7-8)→Thủy(9-10); tầng chẵn dùng bản "Hung " mạnh hơn cùng loài. Boss `foundation_ferocious_flood_dragon_whelp` (Hung Giao Sủng, Màn 3.10) là boss Trúc Cơ đầu tiên dùng cơ chế 2 phase theo ngưỡng HP (0.5/0.25) + enrage sau 60 giây. Có 5 quest Trúc Cơ gate `requiredRealmId: 'foundation_establishment'` (`src/data/quest/quests.ts`) — phần thưởng tài nguyên; `QuestItemReward` chưa hỗ trợ equipment nên thưởng trang bị qua quest dời sau.

**Giới hạn scope progression hiện tại**: nội dung dừng ở Trúc Cơ tầng 18. Kim Đan (gate đột phá, realm passive, node mới, vật liệu realm 4, stage chương 4) chưa mở trong version này — giữ cho version sau.

## Skill Node Tree

Luồng hiện tại không mua trực tiếp trên node. Người chơi chọn node trong `NodeTreePanel.vue`, xem điều kiện/hiệu ứng và mua trong `NodeInspector.vue`. `GameManager.purchaseNode()` cùng `NodeSystem` kiểm tra prerequisite, điểm kỹ năng và áp dụng effect.

Sau giao dịch thành công, `SkillPathPanel.vue` phát `unlockTrigger`; `NodeTreePanel.vue` đo tâm node bằng `getBoundingClientRect`, cập nhật qua `ResizeObserver`, rồi chạy đường nối trước node. `SkillConnections.vue` vẽ SVG cho ba trạng thái `locked`, `active`, `unlocking`; dash-offset tạo ánh sáng chạy parent→child. Kết thúc đường nối, node pulse rồi trở về state purchased reactive. Kế hoạch SkillNode muộn nhất đã được implement đầy đủ, không còn hạng mục code mở.

## Chiến đấu

`BattleSystem` điều phối timeline, cast, movement và impact; `CombatSystem` giải quyết hit, né, chí mạng, giáp, kháng, Realm Pressure, ailment và sát thương. Hệ impact thống nhất `ActionImpactSystem` (`src/core/battle/ActionImpactSystem.ts`) thay thế model missile cũ: basic attack được schedule với windup rồi snapshot anchor cell (on_impact) và resolve từng hit; player skill mở một batch, mỗi `fireHit()` resolve ngay, `endBatch()` phát đúng một `action_impact` neo tại ô mục tiêu chính. Hỗ trợ AOE, knockback, tỷ lệ sát thương mục tiêu phụ; danh sách mục tiêu đã trúng ngăn damage lặp ngoài ý muốn. Gameplay không phụ thuộc VFX/Phaser — event chỉ mang dữ liệu grid.

Code hiện tại vẫn dùng grid 10×16 và player gate ở mép trái.

> **Định hướng đã chốt, CHƯA implement**: bàn cờ vây 19×19 — player actor chuyển ra ngoài bàn; player có dải tầm đánh mặc định 9 hành trên toàn chiều ngang; quái gây sát thương khi vị trí cộng tầm đánh chạm hành thủ thành số 1. Đây KHÔNG phải trạng thái runtime hiện tại.

Boss có thể đổi phase theo ngưỡng HP, nhận buff, enrage theo thời gian và triệu hồi quái. UI hiện hành nằm tại `src/components/game/combat/`, gồm top/status/event bar, control bar và các trạng thái thắng, thua, kết quả.

## Trang bị, vật phẩm và kinh tế

Quy tắc về phẩm chất, độ hiếm, affix, set, đặt tên, túi đồ và kinh tế nguyên liệu nằm tại [Item Design Reference](./item-design-reference.md). Không sao chép các bảng vào đây để tránh hai nguồn lệch nhau.

## Công trình, chế tác và khai thác

Địa Giới Thanh Vân (`src/core/production/ProductionCatalog.ts`) có đúng 3 nguồn khai thác, mỗi nguồn 1 site, level riêng (tối đa 9, giữ level khi đột phá, nâng bằng Gỗ cùng realm + Linh Thạch): **Thanh Vân Lâm** (gỗ), **Huyền Thiết Quảng** (linh khoáng 3 realm × 5 phẩm), **Thanh Vân Động Thiên** (linh thảo — mỗi đan phương có đúng 1 thảo riêng). Khai thác là job theo thời gian; worker tự động điều phối qua building Điều Phối Nhân Công.

`BuildingSystem` (`src/data/building/buildings.ts`) quản lý xây/nâng/tích trữ/thu hoạch 5 building:

- **Linh Tuyền** — ngưng tụ Linh Thạch theo thời gian, storage = 10h sản lượng, rate scale theo realm.
- **Khí Đường** — gate 4 thao tác trang bị (Cường Hóa/Tẩy Luyện/Tinh Luyện/Hóa Luyện, xem [Item Design Reference](./item-design-reference.md)); level giảm chi phí thao tác.
- **Đan Phòng** — gate luyện đan; level 3/6/9 thêm slot luyện đan đồng thời.
- **Truyền Tống Trận** — gate Thám Hiểm (chọn combat stage).
- **Điều Phối Nhân Công** — gate panel 3 nguồn Lâm/Quáng/Động Thiên; +1 worker mỗi level.

Không còn building trung gian chế tác (Linh Thảo Viên, Lò Luyện, Thiên Công Phường, Trận Đài, Phù Viện đã loại bỏ); nguyên liệu đến thẳng từ ProductionSite, không qua recipe/crafting queue. Định nghĩa cân bằng nằm tại `src/data/building/buildings.ts` và `src/core/production/`.

## Dữ liệu, asset và bảo trì tài liệu

- Dữ liệu gameplay tĩnh nằm trong `src/data/`; logic domain nằm trong `src/core/`.
- Seed tên tiên hiệp chưa được runtime sử dụng nằm tại `docs/reference/xianxia-name-seed.json`, tách khỏi data tham gia build.
- Quy trình asset: [asset-drop/README.md](../asset-drop/README.md).
- Khi đổi hành vi, cập nhật tài liệu sống trong `docs/` cùng thay đổi code; không tạo thêm plan extensionless.
