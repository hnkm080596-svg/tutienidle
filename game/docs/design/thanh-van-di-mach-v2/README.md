# THANH VÂN DỊ MẠCH V2 — 21 chính tuyến + thành tựu + ngày/tuần

**Tình trạng:** ĐỀ XUẤT THIẾT KẾ, không phải nội dung đã phát hành. **Đối chiếu:** `master` tại `e894af77b` ngày 2026-10-14; checkout có thay đổi chưa commit của các nhiệm vụ khác. **Phạm vi:** Phàm Nhân, Luyện Khí, Trúc Cơ (7 chính tuyến/cảnh giới); nhánh Pháp Tu Hỏa đang mở trong beta. Tài liệu V1 tại `../thanh-van-di-mach/` được giữ nguyên.

## Nội dung

| Hồ sơ | Nhiệm vụ | Trục trải nghiệm |
| --- | --- | --- |
| [Hồi I — Phàm Nhân](ACT-I-MORTAL.md) | V2-01 đến V2-07 | Động phủ → sản xuất → dã thú → khoáng → trang bị → luyện thể → tầng boss |
| [Hồi II — Luyện Khí](ACT-II-QI.md) | V2-08 đến V2-14 | Nhập đạo Hỏa → linh thảo → luyện đan → công pháp → khí đường → luyện thể → sơn tặc vương |
| [Hồi III — Trúc Cơ](ACT-III-FOUNDATION.md) | V2-15 đến V2-21 | Khoáng hậu sơn → linh lang → đồng hành → trận pháp → mạch thể → dọn sơn → linh lang vương |
| [Thành tựu, ngày và tuần](ACHIEVEMENTS-DAILY-WEEKLY.md) | 25 thành tựu, 7 mẫu/ngày, 7 mẫu/tuần | Mục tiêu dài hạn + tái chơi có giới hạn kinh tế |
| [Kế hoạch triển khai](IMPLEMENTATION.md) | Các PR độc lập và điểm chặn | Chủ sở hữu, chuyển dữ liệu, kiểm thử, QA và tiêu chí từ chối |

**Định hướng truyện:** Thanh Vân mắc một vết rạn linh mạch. Dã thú bị hỏa khí kích động, sơn tặc đánh cắp quặng để khuếch đại dị hỏa, Linh Lang hậu sơn chống giữ nơi mạch bị tổn thương. Mỗi hồi kết bằng **thắng cả ải boss** và mở câu hỏi cho hồi sau; tu vi/cảnh giới do hệ Cảnh Giới quyết định, không do nhận thưởng quest.

**Điểm khác V1:** 7 nhiệm vụ/cảnh giới và mỗi nhiệm vụ **2–3 mục tiêu phối hợp chức năng**, có người hướng dẫn, câu mở/kết, CTA, hợp đồng xác nhận sự kiện, thưởng gốc/thực tế và test riêng. Đây là thiết kế cần nâng hệ Quest; không thay nội dung đang chạy chỉ bằng sửa một mảng `QUESTS`.

## Hợp đồng nguồn đã xác minh

1. `src/core/quest/Quest.ts`: `QuestCondition` chỉ có **một** `collect | kill | flag`; `cadence` chỉ `once | daily`, chưa hỗ trợ `weekly` hay `allOf`. Chỉ flag đã phát sinh thực: `alchemy.crafted`.
2. `src/core/quest/QuestSystem.ts`: kích hoạt có chủ đích qua `reconcileActiveQuests`; claim một lần; `collect` chỉ đếm vật phẩm nhận **sau khi active** và **trừ vật phẩm khi nhận thưởng**; kill/flag cũng chỉ đếm sau kích hoạt; phát thưởng qua `RewardSystem`. `onEnemyDefeated` phản ánh enemy chết, **không tự chứng minh thắng cả trận**.
3. `src/data/quest/quests.ts`: **15 chính tuyến hiện hành**, các ID vật phẩm/quái dùng trong hồ sơ được dẫn từ catalog này; save ghi tiến độ theo quest ID. `src/core/betaScope.ts:isBetaQuestEnabled` đang **tắt hoàn toàn daily**. Không có weekly/achievement board hoàn chỉnh được chứng minh trong phạm vi census này.
4. `src/data/stage/Stages.ts`: mốc clear `mortal_dong_10`, `qi_refining_abyssal_pool`, `foundation_floor_10`; `GameManagerBattleRewardOps` lưu `completedStageIds` khi hoàn tất ải. `ReleasePolicy` mở Trúc Cơ, đóng vượt trần beta; đồng hành/trận pháp mở từ Trúc Cơ.
5. `questRewardBandRealmId`/`scaleQuestRewardByRealm` chỉ nhân **linh thạch + tu vi** theo Phàm ×1, Luyện Khí ×8, Trúc Cơ ×50. **Lĩnh ngộ kỹ năng và số vật phẩm không nhân.** Mỗi quest ghi `gốc → thực nhận`, tuyệt đối không nhân hai lần. Trạng thái phòng thủ bảng thưởng vật phẩm/đầy túi phải dùng cùng cơ chế claim thật.

**Ký hiệu hợp đồng:** `[CÓ]` trường/hook thật xác nhận từ nguồn; `[MỚI]` điều kiện, chứng từ, màn hình, biểu diễn truyện và lịch reset cần triển khai. `allOf[...]` **chỉ là biểu diễn spec**, chưa phải TypeScript chạy được. Tất cả hành động dạng đạt cấp, nâng trang bị, chỉnh trận, luyện thể, thao tác công pháp cần chứng từ do **domain owner** phát sau commit thành công; mở giao diện không được tính.

## Ràng buộc người chơi

- Chủ động nhận thưởng khi **mọi mục tiêu** đạt; đang chờ vật phẩm để nộp thì ghi chính xác số đang có. Các mục tiêu nhận nguyên liệu mới tính từ lúc quest bắt đầu; gói khởi đầu có sẵn 15 `mortal_wood_decade` và 6 `mortal_ore_decade` không tạo credit hồi tố.
- Thắng ải là thành tích bền vững (ghi ở `completedStageIds`), có thể đồng bộ tại lifecycle command nếu hoàn thành sớm; kill/acquire/craft/upgrade không hồi tố tùy tiện. Có thể chơi, thăng cảnh giới, thử UI mà không claim chính tuyến; quest không được khóa cứng đường nâng cảnh giới.
- Các nhiệm vụ kéo người chơi qua chức năng thật, nhưng tránh khóa cứng vào random drop, gacha, sự kiện ẩn, Ngũ Hành khác Hỏa, cảnh giới sau Trúc Cơ. Chỗ chưa chứng minh được source/faucet được ghi chặn trong từng quest và kế hoạch.
- **Không tự triển khai từ docs này:** cần PR hợp đồng, kiểm cân bằng, test runtime và quyết định bật lịch lặp ở beta. Không xóa file, commit, push, thay UI hoặc thay dữ liệu sản phẩm trong lượt thiết kế này.
