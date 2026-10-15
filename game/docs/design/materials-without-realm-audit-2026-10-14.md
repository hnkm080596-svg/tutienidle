# Audit nguyên liệu không còn phụ thuộc cảnh giới

## Ruling và implementation mới nhất

User đã duyệt giữ 5 niên đại; một loại Linh Thạch với số lượng tăng theo cảnh giới; giữ realm gate và bảng lượng/giá nâng cấp; không migration; tạo mã nguyên liệu mới. Sau đó user giới hạn patch này ở chức năng, cân bằng chuyển sang patch riêng. Bảng mã, consumer census và kiểm tra tập trung ở `game/docs/qa/material-resource-cutover-2026-10-14.md`. Các câu hỏi phía dưới là lịch sử audit, không phải câu hỏi còn pending.

Read-only subagent: GPT-6.1 Sol / low. Checkout `E:\tutienidle`, branch `master`, HEAD `e894af77b0127614b90fa72c4bc9927a537e7e0a`, gồm nguồn chưa commit. Không sửa gameplay trong audit. Thảo Dược ngoài phạm vi ruling mới.

## Inventory xác minh

| Bề mặt | Nguồn | Hiện tại |
|---|---|---|
| Mã gỗ/khoáng | game/src/data/materials/materials.ts:210; core/profession/ProfessionMaterial.ts:55 | 9 cảnh giới x 5 niên đại = 45 mã mỗi loại; tên đã ẩn cảnh giới nhưng metadata còn |
| Linh Thạch | core/material/SpiritStoneMaterial.ts:16; core/game/GameManagerRewardOps.ts:47 | Một mã spirit_stone_ha_pham, MaterialBag là số dư thật; reward.spiritStone chỉ vận chuyển phần thưởng |
| Gộp stack/save | core/material/MaterialBag.ts:8; core/game/GameManagerSaveRestore.ts:239 | Gỗ/khoáng cap 1000/mã; gộp mã có thể mất phần vượt cap khi restore |
| Save guard/migration | services/save/saveShapeValidation.ts:347,5131; services/save/saveVersion.ts:238 | Guard giữ nguyên liệu theo cảnh giới; version 90 có migration thạch cũ nhưng chưa có migration gỗ/khoáng mới |
| Chu kỳ/output | core/production/ProductionSystem.ts:393,400,595; core/production/ProductionBalance.ts:14,78 | Chu kỳ PN/LK/TC 100/300/900s; roll realm, tuổi và ID output |
| Nâng nguồn | core/production/ProductionCatalog.ts:57; core/production/ProductionSystem.ts:292 | Giá gỗ theo realm/tuổi; gate cấp theo realm nhân vật |
| Công trình | data/building/buildings.ts:25; core/building/BuildingSystem.ts:166 | Giá gỗ/khoáng và gate theo tier; thạch bổ sung theo bảng đã duyệt |
| Sản lượng/giá thạch | core/building/BuildingSystem.ts:37,296; core/economy/EconomyRealmPace.ts:12 | Nguồn thạch và phí thao tác vẫn scale realm; phí equipment quality là quan hệ riêng |
| Phân giải | core/production/DecomposeSystem.ts | /6 floor, grade và tuổi tăng yield; không tiêu stack dưới 1 output |
| Khí Đường/Đan Phòng | core/equipment/EquipmentOperationCostCatalog.ts:64; core/alchemy/AlchemySystem.ts:854; data/alchemy/alchemyRecipes.ts:27 | Enhance dùng essence+Bụi Gỗ+thạch; đan dùng Bụi Gỗ chung, herb riêng; stone fees scale realm |
| Quest | data/quest/quests.ts:33,53,135,237 | Mục tiêu collect dùng ID gỗ/khoáng PN/LK/TC cụ thể |
| Loot | core/game/BattleLootSystem.ts:326; core/reward/RealmRewardScale.ts:23 | Thạch thưởng có scaling enemy realm, talent và authored stage drops |
| UI | composables/useMaterialTooltip.ts:67; panels/bag-sections/MaterialBagSection.vue:188,232,318; composables/useBagFilter.ts:44 | Realm còn quyết định màu, rank, aria/filter; sửa helper chung phải giữ herb |

Các path rút gọn trong bảng đều nằm dưới `E:\tutienidle\game\src\`.

## Rulings cần chốt trước implementation

1. **Identity/niên đại:** giữ 5 niên đại rồi gộp realm cùng tuổi, hay gộp hoàn toàn một mã mỗi loại? Phương án đầu giữ ageFactor phân giải, phương án sau bỏ cả ageFactor. Yêu cầu bỏ realm đã rõ, không cần hỏi lại.
2. **Baseline sản xuất:** chu kỳ và lượng gỗ/khoáng cố định dùng bảng nào? Có giữ tốc độ theo level, tuổi weight 50/25/14/8/3 và amount 3/2/2/1/1? Không tự thay đổi thảo.
3. **Phạm vi Linh Thạch:** bỏ scaling realm ở nguồn và phí thao tác nào? Giá theo độ khó recipe/quality trang bị và authored stage reward có tiếp tục khác nhau không? Identity thạch đã độc lập realm.
4. **Gate nâng cấp:** còn gate level công trình/nguồn theo progression hay bỏ realm gate? Giữ lượng nguyên liệu tăng theo level hay dùng bảng mới?
5. **Migration:** đề xuất bảo toàn lượng 1:1, bảo vệ overflow khi gộp; giữ tiến độ quest và reservation. Cần chốt cap mới và cycle đang chạy: giữ deadline rồi trả mã mới hay restart. Không tự reset save.
6. **Quest collect:** giữ chain/amount với mã chung hay sửa mục tiêu? Sau remap, mục tiêu cần thu mới hay được tính lượng đang có? Giữ completed IDs và tiến độ cũ đến khi có ruling.

Không hỏi lại: nguồn cố định không theo vùng, chu kỳ độc lập từng site, offline 10h/site, thạch tự vào túi, phân giải /6 floor và không consume dưới 1, giá thạch công trình/ore Đan Phòng đã duyệt.

## Giới hạn

Audit chỉ đọc source; không chạy runtime/tests cho migration chưa được chốt. Chưa thực hiện thay đổi bỏ realm. Các vấn đề FX/repeat decomposition đang được xử lý riêng, không phải bằng chứng migration hoàn thành.
