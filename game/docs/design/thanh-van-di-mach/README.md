# THANH VÂN DỊ MẠCH — hồ sơ thiết kế chính tuyến Beta

**Ngày:** 2026-10-14. **Mốc nguồn đã đọc:** `master` @ `e894af77b` (checkout đang có thay đổi khác chưa commit). **Trạng thái:** `PROPOSED / SPEC`; chưa triển khai, chưa kiểm thử gameplay theo đề xuất. **Chủ đề:** 12 nhiệm vụ, 3 hồi, Phàm Nhân → Luyện Khí → Trúc Cơ; Ngũ Hành beta hiện chỉ mở Hỏa.

## Chốt thiết kế

Người chơi sống sót ở vùng Thanh Vân, điều tra một linh mạch nhiễm hỏa; thú vật biến dị mở đầu câu chuyện, sơn tặc lợi dụng dị hỏa ở trung hồi, Linh Lang bảo vệ nơi mạch bị thương ở cuối hồi. Cốt truyện kể qua một đoạn mở, một mục tiêu đo được, một đoạn kết và một chỉ dẫn hành động chính xác trong bảng Nhiệm Vụ. Mỗi quest được nhận/hoàn thành một lần; nhận thưởng chủ động, không cần mở UI để tiến độ tăng. **Câu thoại dưới đây là copy được đề xuất**, hệ thống hiện chỉ có `name` và `description` nên chưa tự hiển thị các đoạn mở/kết.

| # | Hồi / cảnh giới | Hồ sơ đầy đủ | Mục tiêu | Thưởng người chơi thực nhận |
|---|---|---|---|---|
| 01 | I / Phàm Nhân | [Lâm Khí Khác Thường](Q01-lam-khi-khac-thuong.md) | Thu mới 2 Mộc | 15 LT + 20 tu vi |
| 02 | I / Phàm Nhân | [Vết Móng Hung Trư](Q02-vet-mong-hung-tru.md) | Diệt 2 Dã Trư | 20 LT + 40 tu vi |
| 03 | I / Phàm Nhân | [Huyền Khoáng Dị Sắc](Q03-huyen-khoang-di-sac.md) | Thu mới 2 Khoáng | 25 LT + 50 tu vi |
| 04 | I / Phàm Nhân | [Hung Trư Trấn Mạch](Q04-hung-tru-tran-mach.md) | Hạ boss Heo Rừng Vương | 60 LT + 120 tu vi |
| 05 | II / Luyện Khí | [Tàn Hỏa Ven Sơn](Q05-tan-hoa-ven-son.md) | Diệt 3 Sơn Tặc | 160 LT + 200 tu vi + 400 lĩnh ngộ |
| 06 | II / Luyện Khí | [Linh Thảo Trong Tro](Q06-linh-thao-trong-tro.md) | Thu mới 2 Tụ Linh Thảo | 160 LT + 800 lĩnh ngộ |
| 07 | II / Luyện Khí | [Đan Hỏa Khai Mạch](Q07-dan-hoa-khai-mach.md) | Luyện đan thành công 1 lần | 200 LT + 1 Tụ Linh Đan Luyện Khí |
| 08 | II / Luyện Khí | [Khoáng Mạch Bị Đánh Cắp](Q08-khoang-mach-bi-danh-cap.md) | Thu mới 2 Khoáng Luyện Khí | 200 LT + 800 lĩnh ngộ |
| 09 | II / Luyện Khí | [Trảm Sơn Tặc Vương](Q09-tram-son-tac-vuong.md) | Hạ boss Sơn Tặc Vương | 480 LT + 1.200 lĩnh ngộ |
| 10 | III / Trúc Cơ | [Đá Mạch Trúc Cơ](Q10-da-mach-truc-co.md) | Thu mới 2 Khoáng Trúc Cơ | 750 LT + 2.000 lĩnh ngộ |
| 11 | III / Trúc Cơ | [Bóng Trắng Hậu Sơn](Q11-bong-trang-hau-son.md) | Diệt 3 Linh Lang | 1.250 LT + 3.500 lĩnh ngộ |
| 12 | III / Trúc Cơ | [Linh Lang Vương](Q12-linh-lang-vuong.md) | Hạ boss Linh Lang Vương | 4.000 LT + 8.000 lĩnh ngộ |

`LT` = Linh Thạch; `tu vi` = cultivation; `lĩnh ngộ` = skillInsight. Tổng thưởng chính tuyến: **7.320 LT + 430 tu vi + 16.700 lĩnh ngộ + 1 Tụ Linh Đan Luyện Khí** (trước mọi cân bằng lại). Hồi I: 120 LT / 230 tu vi; hồi II: 1.200 LT / 200 tu vi / 3.200 lĩnh ngộ / 1 đan; hồi III: 6.000 LT / 13.500 lĩnh ngộ. Đây là **đề xuất kinh tế**, chưa được xác nhận qua mô phỏng tốc độ tiến triển.

## Quy tắc tính tiền thưởng — KHÔNG nhân đôi

`QuestSystem.questRewardBandRealmId` suy ra cảnh giới của quest từ `requiredRealmId` hoặc mắt xích đã đặt gate. `scaleQuestRewardByRealm` chỉ nhân `spiritStone` và `cultivation` theo `stoneCostRealmFactor`: Phàm ×1; Luyện Khí ×8; Trúc Cơ ×50. `skillInsight` và số lượng vật phẩm **không nhân**. Mỗi card ghi **giá trị cấu hình gốc** và **giá trị hiển thị/trao thưởng**, tuyệt đối không nhập giá trị đã nhân vào dữ liệu rồi tiếp tục dùng hệ số. Read-model và nhận thưởng dùng cùng nguồn tính; không hardcode tiền thưởng tại Vue.

## Cơ chế thực có và phần cần bổ sung

**Hiện có:** `Quest.condition` = `collect` (đếm vật liệu nhận mới khi quest active; lúc nhận thưởng trừ vật liệu khỏi túi), `kill` (đếm đúng `enemyId` hoặc vùng), `flag` (thực có `alchemy.crafted`). Nhiệm vụ `once` mở theo `unlocksAfterQuestId`, `requiredRealmId`, kích hoạt bằng `reconcileActiveQuests`; `getActiveQuests` chỉ đọc. Kill từ nguồn chiến đấu hợp lệ, collect từ luồng vật phẩm vào túi; cả hai không cộng bù quá khứ. Thưởng từ `RewardSystem` qua quest claim; pill reward đã được hỗ trợ. Khi túi đầy phải hiển thị tình trạng thực nhận/cảnh báo.

**Chưa có:** kiểu `stage_clear` để chứng minh chính xác *đã vượt cửa 1-10/1-20/1-30*; đoạn mở/kết riêng, speaker, điểm dấu nhiệm vụ trên bản đồ, định hướng deep-link tự động sau nhận; các chứng cứ cấp độ/tăng trang bị/khai mở node chưa có `QuestCondition` tương ứng. Ba nhiệm vụ boss v1 có thể dùng `kill enemyId ×1` để phát hành với cơ chế hiện hữu, nhưng **không được quảng bá thành hoàn thành tầng boss** khi chưa có `stage_clear` chứng minh. Phương án khuyến nghị: triển khai `stage_clear` ở PR riêng rồi chuyển 04/09/12 khi đã có test. Hệ thống boss có thể sinh nhiều đơn vị cùng `enemyId`; `kill ×1` chỉ chứng minh một đối tượng chết.

**Cửa cảnh giới:** Q05 chỉ kích hoạt sau nhân vật đạt `qi_refining`; nghi thức Quán Khí và tầng Phàm 12 là điều kiện từ hệ Cảnh Giới, không phải reward do quest quyết định. Q10 chỉ kích hoạt sau `foundation_establishment`; cửa vào Trúc Cơ cần Luyện Khí cấp 12 **và** đã hoàn thành stage `qi_refining_abyssal_pool`, qua độ kiếp thật. Không dùng quest claim để tự nâng cảnh giới. Nội dung beta chỉ có Hỏa, không hứa lựa chọn bốn hành khác.

**Không kẹt do đồ trong túi:** nhân vật mới có sẵn 15 `mortal_wood_decade` và 6 `mortal_ore_decade` từ gói khởi đầu; chúng không tự điền tiến độ Q01/Q03. Copy phải nói “**thu thêm sau khi nhận nhiệm vụ**”. Q01 và Q03 cần bảo đảm nguồn gỗ/khoáng hoạt động đủ sớm; nếu người chơi đã có nguyên liệu trong túi thì vẫn phải nhận **hai đơn vị mới** trong khi giữ đủ **hai đơn vị để nộp**. Nhiệm vụ Q06/Q08/Q10 cần nguồn sản xuất/rơi đồ thật và kiểm tra túi/nhịp chờ, không tạo vật phẩm giả để tháo kẹt. Không ép dùng nguyên liệu nhiệm vụ trước khi claim. Hệ UI giải thích rõ hành vi nộp và nguyên nhân chưa thể nhận thưởng.

## Tương thích chính tuyến 15 nhiệm vụ đang chạy

`game/src/data/quest/quests.ts` hiện có **15 quest `chainId:'mainline'`**, bài kiểm tra `quests.test.ts` khóa số lượng, id, thứ tự; save giữ `active` và `completedOnceIds` theo id. Bản thiết kế **12 nhịp** là một catalog phiên bản mới, **không phải hiện trạng**. Hướng triển khai khuyến nghị: tạo ids mới `tvdm_01`…`tvdm_12`, phát hành một catalog mainline duy nhất, kèm bộ chuyển đổi id cũ vào save nếu giữ save beta. Không tái sử dụng id cũ cho điều kiện khác loại khi progress active có thể đã tồn tại; không để 15 cũ và 12 mới cùng active. Đọc [kế hoạch kỹ thuật và chuyển save](IMPLEMENTATION.md) trước khi thay `quests.ts`.

## Bản đồ nguồn và điểm chặn QA

- Chủ nhiệm vụ: `game/src/core/quest/{Quest,QuestManager,QuestSystem}.ts`; dữ liệu `game/src/data/quest/quests.ts`.
- Tiến độ chiến đấu: `BattleLootSystem` → QuestSystem kill; stage-clear từ `GameManagerBattleRewardOps` tại nơi ghi `player.completedStageIds`.
- Claim và reconcile: `GameManagerQuestOps`; khởi tạo `services/character/initializeCharacter.ts`; save/restore theo phase R8.1 của `game/docs/roadmap.md`.
- Cảnh giới và ải: `data/stage/Stages.ts` — boss Phàm `mortal_dong_10`, boss Luyện Khí `qi_refining_abyssal_pool`, boss Trúc Cơ `foundation_floor_10`.
- UI: `components/scenes/quest/QuestScene.vue` / `QuestFidelityScene.vue`, read-model `core/betaScopeQuestDomain.ts`; i18n gateway cho nút/lỗi.
- Kiểm thử: `data/quest/quests.test.ts`, `core/quest/QuestSystem.lifecycle.test.ts`, `core/game/GameManager.mainlineCarriedSaves.qa.test.ts`, `core/game/GameManager.questLifecycle.test.ts`, kết hợp E2E Quest Scene và stage clear thật.

**Quyền và mức xác minh:** tài liệu-only tại `E:/tutienidle`, không cần worktree mới theo P2 exception; không xóa file, không chạm sản phẩm/UI, không commit/push. G0/G1 đối chiếu nguồn; các bước P3/P13/P14/P18/P4/P5 thuộc **kế hoạch implementation**, chưa được ghi PASS.
