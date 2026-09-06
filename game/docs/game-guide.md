# Hướng dẫn hệ thống game hiện tại

> Roadmap hậu kỳ: [Phù Ultimate và Trận Pháp chiến trường](./future-talisman-formation-system-plan.md).
> Hiện tại Phù/Trận được giữ khóa; hướng socket vào Equipment đã bị loại bỏ.
Tài liệu này là điểm tham chiếu tổng hợp cho trạng thái **đang được triển khai trong code**. Các plan rời trước đây đã được hợp nhất và loại bỏ vì trùng lặp hoặc lỗi thời. Khi tài liệu và code khác nhau, các module được dẫn bên dưới là nguồn sự thật.

## Kiến trúc và giao diện

Game dùng Vue 3 cho UI, Pinia cho state phía UI và Phaser cho cảnh nền/chiến đấu. `src/components/layout/GameRoot.vue` ghép các lớp trong khung 16:9 cố định rồi scale theo viewport. Ở Động Phủ, Phaser nằm dưới top bar, bottom bar, panel trái, icon công trình và overlay chức năng. Khi chiến đấu, chrome Động Phủ được thay bằng `CombatSceneOverlay`; canvas Phaser vẫn được giữ và tự chuyển scene. Kích thước khung và slot dùng nguồn chung tại `src/core/ui/DesignFrame.ts` và `SlotSizes.ts`.

## Tu luyện, đột phá và cảnh giới

`CultivationSystem` quản lý tiến độ tu luyện (tiểu cảnh giới tự tăng khi tu vi đầy — `useBreakthrough.ts`). Đột phá **đại cảnh giới** là nghi lễ riêng (spec `2026-08-29-dot-pha-loi-kiep`): bấm nút Quán Khí/Trúc Cơ → qua cổng **Độ Kiếp** — `useTribulation.ts` điều phối, runtime nằm ở `core/tribulation/TribulationDirector.ts` (chương kiếp, KHÔNG còn trận đánh quái Kiếp).

**Độ Kiếp mới** gồm các chương theo realm — Quán Khí 2 chương (Tâm Ma → Lôi), Trúc Cơ 3 chương (Tâm Ma → Thân → Lôi):
- **Tâm Ma Kiếp** — minigame hỏi đáp dồn dập (bank câu hỏi `data/tribulation/TribulationMindQuestions.ts`, 4 đáp án, thanh giờ co dần): đúng được hồi máu + kháng lôi tự động, sai stack debuff (giảm phòng thủ, tăng sát thương nhận vào) đến hết kiếp. Kiếp là nội dung tay — vào kiếp mọi vòng tự động dừng.
- **Thân Kiếp / Lôi Kiếp** — tank lôi %maxHP theo nhịp, mitigation `100/(100+phòng thủ)`; chương Lôi khép lại bằng một đạo đại lôi.
- Thua: mất % tu vi theo realm (50% Quán Khí, 40% Trúc Cơ, realm sau giảm dần) + Linh Thạch + Kiếp Thương, cooldown 5 phút.

**Bậc ẩn khi đột phá** (spec §4.2): bậc được xét NGAY LÚC BẤM từ đầu tư trước kiếp, công bố sau khi thắng. Gate công khai chỉ bậc Nhân (tầng 12 + Linh Thạch — Đột Phá Lệnh đã dỡ). Tương truyền người có Trúc Cơ Đan tại thân, căn cốt vững... kinh mạch thông suốt... thiên kiếp cũng phải nhường ba phần. Bậc càng cao kiếp càng khó nhưng nội tại realm càng mạnh (0/5/10/20% chỉ số chính). Người nghịch thiên đủ mọi cơ duyên sẽ gặp **lôi kiếp siêu cấp** — vượt qua thì Phàm Cốt chuyển hóa Phàm Nhân Chi Cốt; thất bại thì cơ duyên Đại Đạo vĩnh viễn đoạn tuyệt.

**Kỳ Kinh Bát Mạch** (độc quyền Luyện Khí, `core/realm/MeridianSystem.ts`): 9 đường kinh mở tuần tự theo tầng (2/4/.../16, Kỳ Kinh Thiên Địa Chi Kiều ở 18), mỗi đường tiêu Thông Mạch Đan (luyện từ Yêu Đan boss Luyện Khí tầng 10). Tương truyền nơi sâu nhất Huyền Đàm Trạch có dị thú chỉ xuất hiện với kẻ đã chém quá ngàn yêu...

Mỗi đại cảnh giới cấp một nội tại đúng một lần qua `RealmPassiveSystem` và dữ liệu `RealmPassives.ts`; người chơi xem chúng trong `RealmPassivePanel.vue`.

Trong chiến đấu, `RealmPressure` so chênh lệch **đại cảnh giới**. Bên cao hơn gây nhiều và nhận ít sát thương hơn. Bậc Nhập Đạo giảm phần áp lực còn lại: bậc 1 không giảm, bậc 6 miễn hoàn toàn. Chênh lệch được chặn ở 5 cảnh giới và hệ số đánh ngược lên không thấp hơn 0,1. Đường cong tuyến tính hiện tại vẫn cần cân bằng bằng playtest.

## Thiên Phú

Thiên Phú là quyết định chọn hướng Đạo duy nhất lúc tạo nhân vật: roll 9 thẻ, chọn đúng 1, giữ cả đời (`CharacterCreationService.ts`, catalog `src/data/talent/Talents.ts`, spec `docs/specs/2026-09-03-talent-catalog-v4-design.md`). Mỗi thiên phú là một ngoại lệ của luật chơi — không có talent cộng chỉ số thuần; mọi talent cùng một ngân sách sức mạnh (~+20-30% công suất cuối Trúc Cơ) nhưng khác HÌNH DẠNG: rủi ro cao được thưởng cao hơn, đầu tư nông nghiệp/ rèn đan được công suất theo đúng phần bỏ ra, còn talent "nhàn" cho giá trị nhỏ nhưng ổn định. Mọi lợi thế đều có chi phí đối trọng ghi rõ trong mô tả.

Catalog v4 chia 3 nhóm (M1 ship nhóm chiến đấu; tu luyện + sản xuất ở các milestone sau):

**Chiến đấu (11 talent)** — mỗi talent nuôi đúng 1 chỉ số bằng nhịp "tích → ngưỡng → bùng nổ → tích lại" trên engine buff/passive có sẵn:

- **Kiếm Quang** (chí mạng): mỗi crit +1% chí mạng (tối đa 10 tầng), chạm ngưỡng hóa Kiếm Vực 8s — mọi đòn chí mạng. *Ví dụ: bạn vừa crit 10 phát liên tiếp — phát thứ 10 mở Kiếm Vực, 8 giây sau mọi đòn đều nổ đỏ.*
- **Phá Giáp** (xuyên giáp): mỗi đòn trúng +2% xuyên (tối đa 5 tầng trong trận).
- **Tật Phong** (tốc đánh): mỗi kill +2% tốc đánh không giới hạn trong trận — nhưng trúng MỘT đòn là mất sạch.
- **Trọng Kích** (sát thương chí mạng): mỗi crit +2% crit damage (3 tầng) rồi bùng +30% sát thương cuối 8s.
- **Hấp Linh** (hút máu): hút máu ×2.5 hiệu lực thường — nhưng chỉ khi HP dưới 50%.
- **Thạch Giáp** (phòng thủ): mỗi lần chặn đòn +2% phòng thủ (10 tầng), chạm ngưỡng hóa Thạch Nham 5s (−50% sát thương nhận).
- **Vô Ảnh** (né): mỗi lần né +2% né (5 tầng), chạm ngưỡng hóa Sát Na 6s (+30% chí mạng + 20% tốc đánh).
- **Cẩn Thận** (endurance): dưới 35% HP giảm 10% sát thương nhận — trên ngưỡng dễ chủ quan, nhận thêm 5%.
- **Hộ Thể** (Hộ Thuẫn): khiên vỡ nổ AoE 30% dung lượng đã mất + khiên hồi nhanh trong 5s.
- **Thứ Phạt** (gai): bị đánh +30% gai, mỗi phản +1 tầng Hận Thứ (5 tầng), không bị đánh 3s thì gai lụi dần.
- **Bất Tử Thể**: mỗi trận 1 lần đòn chí mạng không chết (giữ 1 HP), tẩy sạch debuff + Tử Sinh Ngộ 10s (+30% sát thương cuối, +20% né chí mạng). Độ Kiếp là nghi lễ thật — không áp dụng.

Easter egg **Phàm Cốt** (Dị, hiếm): −75% tốc độ tu luyện cả đời — gate bí ẩn của Đại Đạo Trúc Cơ; thắng kiếp Đại Đạo chuyển hóa thành Phàm Nhân Chi Cốt (+75% tốc tu vĩnh viễn).

Effect được tiêu thụ qua getter tập trung tại `src/core/talent/TalentEffects.ts`; talent chiến đấu cấp hidden passive (`data/skill/TalentPassives.ts`) do GameManager grant/revoke; save edit chứa nhiều id chỉ đọc id ĐẦU (không cộng dồn). Thiên phú đã chọn hiển thị trong panel Nhân Vật.

## Con đường tu luyện hiện có

`src/core/player/CultivationPathKit.ts` hiện chỉ công khai hai lựa chọn:

- **Pháp Tu** dùng Đại Ngũ Hành Chân Quyết. Đây là một path thống nhất; người chơi mở Hỏa, Mộc, Thủy, Kim, Thổ và kỹ năng qua Node Tree, rồi phối hợp nhiều hành bằng element loadout.
- **Kiếm Tu** dùng Ngự Kiếm Tâm Kinh (spec 2026-08-29-kiem-the-kiem-y). Route chốt VĨNH VIỄN đúng lúc chọn path: Huy Kiếm (tram) đạt Lv3 (10.000 lần trảm) → Bạt Kiếm (Đơn Kiếm), chưa → Kiếm Trận (Đa Kiếm). Mỗi route ĐÚNG 1 active skill ở slot 0:
  - **Kiếm Trận (Đa Kiếm)**: kiếm trận tiến hóa Lưỡng Nghi → Tam Tài → ... (mỗi keystone thay thế skill cũ), tích **Kiếm Thế** (pool trong trận, +số kiếm/cast, cap 100) cho ult Tru Tiên Kiếm Trận (nổ trảm AoE + kiếm trận trường tồn) + buff +1% sát thương mỗi 2 điểm. Chiều sâu qua 9 node on-hit (mở theo cấp trận 2-9 kiếm, roll 3%/cấp tối đa 15%).
  - **Bạt Kiếm (Đơn Kiếm)**: Bạt Kiếm Thức tụ lực (channel) duy nhất — "càng treo càng mạnh": tầng **Kiếm Ý vĩnh viễn** theo boss diệt (tầng N cần tổng 10+5×(N-1) boss, mỗi tầng +10 kiếm ý nền đầu trận + 0.5% dmg/crit), pool tạm gain theo tick tụ lực + sát thương nhận vào, tiêu hao ăn tạm trước (vĩnh viễn bất khả xâm phạm). Ult Kiếm Khai Thiên Môn đốt toàn bộ kiếm ý tạm, đơn mục tiêu ưu tiên boss, overkill tràn 50%. Skill cũ (Ngự Kiếm/Thái Hư/Phiêu Vân/Phá Thiên/Vạn Kiếm...) chuyển thành passive node trong cây công pháp; hồi sinh 1 lần/trận qua node Kiếm Ý Bất Tử; Nộ (rage) đã gỡ khỏi hệ thống.

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

Địa Giới Thanh Vân (`src/core/production/ProductionCatalog.ts`) có đúng 3 nguồn khai thác, mỗi nguồn 1 site, level riêng (tối đa 9, giữ level khi đột phá, nâng bằng Gỗ cùng realm + Linh Thạch): **Thanh Vân Lâm** (gỗ), **Huyền Thiết Quảng** (linh khoáng — mỗi loại theo 5 bậc tuổi Thập Niên → Thượng Cổ, trục tuổi thống nhất với linh thảo theo gp123 6E), **Thanh Vân Động Thiên** (linh thảo — mỗi đan phương có đúng 1 thảo riêng). Khai thác là job theo thời gian; worker tự động điều phối qua building Điều Phối Nhân Công.

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
