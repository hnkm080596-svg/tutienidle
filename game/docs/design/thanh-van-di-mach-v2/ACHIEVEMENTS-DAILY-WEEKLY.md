# THÀNH TỰU, NHẬT VỤ, TUẦN VỤ — Thanh Vân Dị Mạch V2

**Trạng thái:** ĐỀ XUẤT; toàn bộ achievement/weekly và bản daily beta bên dưới là `[MỚI]`. Tham chiếu: [README](README.md), [Hồi I](ACT-I-MORTAL.md), [Hồi II](ACT-II-QI.md), [Hồi III](ACT-III-FOUNDATION.md). Dùng đúng chủ sở hữu quest/reward/economy, không tạo nguồn tài nguyên qua giao diện.

## Luật chung, chống softlock và chống farm vô hạn

- **Chính tuyến:** 21 nhiệm vụ `tvdm2_main_01..21`, mỗi cảnh giới 7; chuỗi chỉ mở nhiệm vụ tiếp theo khi **claim** nhiệm vụ trước. Các mốc realm/stage đạt trước khi kích hoạt có thể đối chiếu từ dấu mốc bền vững; kill/nhặt/luyện đan/nâng cấp đếm **sau kích hoạt**, trừ loại được định nghĩa rõ là state-at-least. Một `acquire` là vật phẩm **thực nhận** và **không bị thu hồi** khi claim; đây là thay đổi so với `collect` hiện tại.
- **Thành tựu:** tích lũy theo sự kiện gameplay hợp lệ từ khi hệ achievement được bật; mốc một lần được đối chiếu lịch sử tin cậy nếu có, không suy từ số liệu thiếu xuất xứ. Mỗi ID claim một lần **toàn đời nhân vật**, kể cả đã lên cảnh giới sau; nâng cảnh giới không nhân thưởng của achievement cũ. Thành tựu chuỗi tự xác nhận qua quest claim ledger; Q21 và achievement `ach_story_thanh_van_sealed` là **cùng một ID thành tựu**, tránh cấp đôi.
- **Daily/weekly:** định kỳ chỉ tính sự kiện thành công sau lúc bảng nhiệm vụ **được gán**, trong đúng period; **không bắt buộc online lúc reset**. Cho tối đa **3 nhiệm vụ đủ điều kiện hiển thị**, claim tối đa **2/3** mỗi ngày và **2/3** mỗi tuần; slot chưa claim hết hạn cùng period, không carry. Bảng chọn một cách xác định theo account/save id + period + realm-band tại lúc gán + version nội dung; gán **một lần/period**, không reroll bằng mở/đóng UI, logout, restore, restart hay chuyển cảnh giới.
- **Eligibility:** chỉ gán nhiệm vụ có nguồn và API gameplay thực sự mở. Không giao luyện đan, luyện thể hay cường hóa nếu chưa đến bước unlock/có điều kiện nguyên liệu thực hiện được; tối thiểu 3 mẫu khả thi hoặc hiển thị lý do không đủ pool và không đặt quota bất khả thi. Ở Phàm, nhiệm vụ khó như alchemy/equipment-enhance không được ép hiện. Thứ tự ưu tiên: kill/production/ore phổ thông → lối tu luyện → hệ tính phí. Quyền thay thế bài toán **được quyết định lúc gán**, không thay ngầm giữa kỳ.
- **Đồng hồ:** period ngày là UTC `floor(utcMs / 86_400_000)`; tuần bắt đầu **thứ Hai 00:00 UTC**, kéo dài 7 ngày. Hiển thị thời gian địa phương Việt Nam để dễ hiểu nhưng luôn ghi rõ reset lúc **07:00 thứ Hai** theo giờ Việt Nam cho tuần, **07:00 hằng ngày** cho daily. Sử dụng `TimeAuthority`/`GameClock` ở lifecycle command; **chống chỉnh đồng hồ** cần server-validated checkpoint hoặc nguồn thời gian tin cậy, chưa xác minh là đã có. Không được tuyên bố hệ thống chống cheat nếu chỉ dựa `Date.now()` từ máy người chơi.
- **Định danh giao dịch:** mỗi gameplay receipt có `eventId`, `saveId/accountId`, `occurredAt/period`, `kind`, `sourceId`, `quantityDelivered`, `outcomeCommitted`, `authority`; event phải dedupe qua save/reopen, offline settle, battle replay, retry và nhiều panel. Claim `(questId, periodId)` là thao tác atomic/idempotent cùng quota + reward delivery; thất bại trả lý do tiếng Việt, không trừ quota, không trả thưởng nửa chừng.
- **Thưởng:** các con số trong bảng là **thưởng gốc**; linh thạch/tu vi nhân theo **cảnh giới của nhiệm vụ**: Phàm ×1, Luyện Khí ×8, Trúc Cơ ×50. Lĩnh ngộ và số vật phẩm giữ nguyên. Với daily/weekly **đóng băng realm-band lúc bảng được gán**; achievement đóng băng realm-band theo định nghĩa ID (m01–m07 = Phàm, q01–q07 = Luyện Khí, f01–f07 = Trúc Cơ, meta có mức cố định riêng). Nhân đúng một lần tại `RewardSystem`; preview và delivery dùng chung kết quả. Không trả nguyên liệu dùng làm nhiệm vụ để tạo chuỗi farm khép kín.

## A. Danh sách 25 thành tựu — nhận một lần

**Nguyên tắc đếm:** kill là enemy defeat (`onEnemyDefeated`, kể cả trận cuối thua nếu kill thật); `stage_clear` và `battle_victory` là **thắng trọn trận/ải** được battle/stage owner xác nhận; `acquire` chỉ count delivered material; event nâng cấp/craft/nhận quà phát sau commit thật. Thành tựu theo loại `lifetime_counter` dùng receipt bền vững, loại `state/milestone` đối chiếu từ owner tại reconcile, `chain` từ completedOnceIds. Khi chưa có lịch sử event tin cậy trước ngày bật feature, đặt baseline lúc đầu thay vì tự suy ra achievement đã làm.

### A1. Phàm Nhân (7 thành tựu)

| ID · Danh hiệu | Nội dung hiển thị và điều kiện chính xác | Chứng từ/nguồn | Thưởng gốc → thực |
| --- | --- | --- | --- |
| `ach_m01_lam_thu` · **Người giữ rừng** | “Gom 20 Thập Niên Linh Mộc thật sự về túi.” Nhận mới `mortal_wood_decade` ×20, bất kể từ sản xuất hay chiến lợi phẩm; không tính 15 gỗ khởi đầu. | `acquire`/material-delivery lifetime, `delivered>0`; `source` lưu để debug. | 5 linh thạch +10 tu vi → **5/10**. |
| `ach_m02_tru_tich` · **Trừ hung thú** | “Hạ tổng cộng 10 Dã Trư phá rừng.” `mortal_wild_boar` ×10, mỗi enemy death có ID riêng. | `enemy_defeated`; không thay bằng stage-entry. | 8 linh thạch +15 tu vi → **8/15**. |
| `ach_m03_mach_san` · **Khai khoáng nhập môn** | “Nhận thành phẩm từ 3 lứa sản xuất.” Bất kỳ sản xuất Phàm thành công ×3, 1 batch = 1 lần ngay cả khi ra nhiều món. | `production_batch_claimed`, `batchId` duy nhất. | 8 linh thạch +15 tu vi → **8/15**. |
| `ach_m04_khoang_anh` · **Khoáng ảnh** | “Thu về 15 Thập Niên Linh Khoáng.” Chỉ `mortal_ore_decade` thực nhận ×15, không tính 6 quặng khởi đầu. | `acquire`/delivered lifetime. | 8 linh thạch +20 tu vi → **8/20**. |
| `ach_m05_khi_ho` · **Khí hộ thân** | “Trang bị thành công 2 món khác nhau.” Hai equipment instance ID đã đi qua trạng thái equipped; tháo/lắp lại cùng món không cộng tiếp. | `equipment_first_equipped_unique`, dedupe theo itemInstanceId. | 10 linh thạch +20 tu vi → **10/20**. |
| `ach_m06_the_mach` · **Thân như bàn thạch** | “Tăng Luyện Thể thành công 5 lần.” Năm bước tiến thực, không đếm preview/click lỗi. | `body_refinement_committed` ×5. | 10 linh thạch +25 tu vi → **10/25**. |
| `ach_m07_hung_tru` · **Trấn mạch rừng già** | “Thắng ải `mortal_dong_10` ít nhất một lần.” Đánh chết boss nhưng trận thua không đủ. | Stage owner `completedStageIds` witness hoặc durable clear receipt. | 14 linh thạch +30 tu vi → **14/30**. |

### A2. Luyện Khí (7 thành tựu)

| ID · Danh hiệu | Nội dung hiển thị và điều kiện chính xác | Chứng từ/nguồn | Thưởng gốc → thực |
| --- | --- | --- | --- |
| `ach_q01_nhap_hoa` · **Người dẫn Hỏa** | “Đột phá Luyện Khí và nhập đạo hệ Hỏa.” Phải thỏa **cả hai mốc**, không tính chỉ chọn tab Hỏa. | Durable `realm_reached(qi_refining)` + `element_attained(fire)`. | 4 linh thạch +100 lĩnh ngộ → **32 linh thạch +100 lĩnh ngộ**. |
| `ach_q02_tru_tac` · **Thanh trừ sơn tặc** | “Hạ 20 Sơn Tặc tại Thanh Vân.” `bandit` ×20, không kể lượt reset màn hình. | Enemy defeat receipt. | 8 linh thạch +150 lĩnh ngộ → **64 +150**. |
| `ach_q03_linh_thao` · **Thảo dược sư** | “Thu mới 20 Tụ Linh Thảo Luyện Khí.” Chỉ đếm `tu_linh_thao_qi_refining_decade` vào túi. | Material delivered receipt. | 8 linh thạch +150 lĩnh ngộ → **64 +150**. |
| `ach_q04_dan_su` · **Luyện đan sư** | “Luyện đan thành công 5 lò.” Không tính hủy, thiếu nguyên liệu, lò không thành. | `alchemy.crafted` sau commit + craftId. | 10 linh thạch +200 lĩnh ngộ → **80 +200**. |
| `ach_q05_cong_phap` · **Hỏa mạch thông suốt** | “Công Pháp đạt rank 3 trong một grade hợp lệ.” Đối chiếu dấu mốc từng đạt ≥3; reset rank khi lên grade không xóa thành tựu. | Technique owner persisted milestone. | 10 linh thạch +300 lĩnh ngộ → **80 +300**. |
| `ach_q06_toi_luyen` · **Tôi luyện pháp khí** | “Cường hóa thành công 3 lần.” Chỉ tính nâng cấp thực có thay đổi state. | Equipment enhancement committed IDs. | 12 linh thạch +300 lĩnh ngộ → **96 +300**. |
| `ach_q07_son_tac_vuong` · **Phá hỏa trại** | “Thắng trọn ải `qi_refining_abyssal_pool`.” | `completedStageIds`, không thay bằng kill `ferocious_bandit`. | 16 linh thạch +400 lĩnh ngộ → **128 +400**. |

### A3. Trúc Cơ (7 thành tựu)

| ID · Danh hiệu | Nội dung hiển thị và điều kiện chính xác | Chứng từ/nguồn | Thưởng gốc → thực |
| --- | --- | --- | --- |
| `ach_f01_kien_co` · **Kiến Cơ thành đạo** | “Tiến vào Trúc Cơ thành công.” Trạng thái thăng cảnh giới đã được owner xác nhận, không khóa hoàn mỹ/ẩn. | Durable `realm_reached(foundation_establishment)`. | 4 linh thạch +500 lĩnh ngộ → **200 +500**. |
| `ach_f02_bach_lang` · **Người nghe tiếng sói** | “Hạ 30 Linh Lang bị dị hỏa kích động.” `foundation_spirit_wolf` ×30. | Enemy death IDs. | 7 linh thạch +800 lĩnh ngộ → **350 +800**. |
| `ach_f03_hau_son_khoang` · **Huyền khoáng hậu sơn** | “Nhặt 30 Thập Niên Linh Khoáng Trúc Cơ.” `foundation_establishment_ore_decade` ×30 nhận thật. | Material delivered receipt. | 8 linh thạch +900 lĩnh ngộ → **400 +900**. |
| `ach_f04_dong_hanh` · **Đồng đạo tương trợ** | “Có đồng hành beta và xếp vào đội hình ít nhất 1 lần.” Không yêu cầu gacha; nếu mailbox chưa phát thì achievement vẫn hiện **chưa khả dụng**. | Companion account entitlement + valid formation assignment owner. | 8 linh thạch +1.000 lĩnh ngộ → **400 +1.000**. |
| `ach_f05_tran_phap` · **Kết trận hộ sơn** | “Thắng 3 trận với đồng hành đã xếp trước khi vào trận.” | Three distinct battleVictory receipts with verified formation snapshot. | 10 linh thạch +1.200 lĩnh ngộ → **500 +1.200**. |
| `ach_f06_than_the` · **Huyền thể sơ khai** | “Tiến triển Luyện Thể 5 lần sau khi đã Trúc Cơ.” Realm-band stamped at commit, không lấy lượt ở Phàm. | Body refine receipts stamped `realmAtCommit=foundation_establishment`. | 10 linh thạch +1.500 lĩnh ngộ → **500 +1.500**. |
| `ach_f07_lang_vuong` · **Bình định cổ mạch** | “Thắng trọn ải `foundation_floor_10`.” Không đòi Kim Đan. | Durable stage owner clear. | 16 linh thạch +2.000 lĩnh ngộ → **800 +2.000**. |

### A4. Thành tựu hành trình (4 thành tựu)

| ID · Danh hiệu | Điều kiện/nhận diện | Thưởng **cố định**, không áp dụng x50 theo cảnh giới lúc claim |
| --- | --- | --- |
| `ach_story_thanh_van_sealed` · **Thanh Vân yên mạch** | Claim đủ `tvdm2_main_01..21`; Q21 chỉ **mở điều kiện** thành tựu, không tự trả thưởng thành tựu. Có thể claim achievement sau quest. | **1.000 linh thạch +2.000 lĩnh ngộ**, duy nhất một lần. |
| `ach_meta_three_boss` · **Tam chiến định mạch** | Có durable stage-clear cho đủ `mortal_dong_10`, `qi_refining_abyssal_pool`, `foundation_floor_10`. | **500 linh thạch +1.000 lĩnh ngộ**. |
| `ach_meta_day_7` · **Thất nhật tinh cần** | Có **ít nhất một daily claim** trên 7 UTC-day bucket **liên tiếp**; cắt chuỗi nếu bỏ ngày. Chỉ bắt đầu đếm từ ngày bảng daily được bật thật. | **250 linh thạch +500 lĩnh ngộ**. |
| `ach_meta_week_4` · **Bốn tuần bền chí** | Claim ít nhất 4 weekly nhiệm vụ trên **tối thiểu 2 weekly period khác nhau**. Một tuần có quota 2, nên không thể hoàn tất trong 1 tuần. | **400 linh thạch +800 lĩnh ngộ**. |

**Acceptance thành tựu:** mỗi hàng có counter rõ `N/M`, CTA trỏ hành động hợp lệ; khi nhận thưởng được `claimed=true` trước khi xử lý retry, và phải rollback nếu reward không settle. `claim` chỉ khi đủ mọi điều kiện. Với achievement nhận từ event mà `quest` chưa active, hệ achievement có ledger của chính nó; không dùng/động tới `QuestSystem` để giả kích hoạt quest. Với hành động trả thưởng có thể làm vượt túi vật phẩm, chỉ dùng receipt delivery thực. Không cấp điểm cho dummy enemy hay quest debug trong build phát hành.

## B. Nhật vụ — 7 mẫu, mỗi ngày chọn 3, nhận tối đa 2

**Ký hiệu:** `R` là realm-band **đã gán** (Phàm ×1, Luyện Khí ×8, Trúc Cơ ×50). Linh thạch `S` thực nhận = `S_base × factor(R)`. Lĩnh ngộ cố định theo mẫu; ở Phàm nếu chưa mở kỹ năng thì có thể tạm trả **0 lĩnh ngộ** với preview rõ ràng, **không silently hide promised rewards**. Bảng nhiệm vụ ngày chỉ được bật sau release-policy approval vì beta hiện tắt `daily`.

| Mẫu/ID | Nội dung và hệ gắn kết | Điều kiện chọn/receipt | Thưởng gốc |
| --- | --- | --- | --- |
| `tvdm2_daily_d1` · **Tảo trừ yêu khí** | “Hạ 5 địch trong vùng phù hợp cảnh giới.” Chiến đấu → EXP/loot → theo dõi tiến độ. | `enemy_defeated` ×5 theo **roster mở tại R**; cần tránh quái thấp cấp/quest dummy lạm dụng, catalog định rõ pool. | **5 linh thạch +10 tu vi**. |
| `tvdm2_daily_d2` · **Quặng cho ngày mai** | “Nhận mới 4 quặng của cảnh giới đang tu.” Sản xuất → túi → khí đường. | `acquire(mortal_ore_decade\|qi_refining_ore_decade\|foundation_establishment_ore_decade,4)` theo R, chỉ delivered. | **6 linh thạch +10 tu vi**. |
| `tvdm2_daily_d3` · **Chăm mạch linh điền** | “Nhận thành phẩm từ 2 batch sản xuất.” Sản xuất gỗ/quặng/thảo → tài nguyên tu luyện. | `production_batch_claimed` ×2, site có thật và đang mở, batch ID distinct. | **4 linh thạch +20 tu vi**. |
| `tvdm2_daily_d4` · **Ngày dưỡng khí** | **Phàm:** “Thu mới 4 Linh Mộc” qua sản xuất/túi; **Luyện Khí/Trúc Cơ:** “Luyện đan thành công 1 lần” qua Đan Phòng. | Chọn variant **khi gán**: `acquire(mortal_wood_decade,4)` hoặc `alchemy_crafted(1)`. Nếu chưa có recipe/faucet, dùng variant thu thập hợp lệ đã được định nghĩa trong catalog, không đổi mục tiêu giữa kỳ. | **5 linh thạch +10 tu vi**. |
| `tvdm2_daily_d5` · **Một lần tĩnh tu** | “Hoàn tất 1 lần tu luyện có tăng tu vi thực.” Tu luyện → cảnh giới. | `cultivation_session_committed` ×1, outcome có tiến độ tăng; không tính mở panel/tick rỗng/treo game. | **5 linh thạch +15 tu vi**. |
| `tvdm2_daily_d6` · **Tôi luyện thường nhật** | “Cường hóa thành công 1 lần.” Khí Đường → Trang Bị. | `equipment_enhanced` ×1; loại khỏi eligible khi chưa có nguồn vật liệu/cấp mở/slot và vật phẩm phù hợp. | **8 linh thạch +10 tu vi**. |
| `tvdm2_daily_d7` · **Thể phách ngày mới** | “Luyện Thể tiến triển thành công 1 lần.” Luyện Thể → tiêu tài nguyên → tăng base stat. | `body_refinement_committed` ×1; cần nguồn vật liệu khả thi ngay trong period. | **9 linh thạch +10 tu vi**. |

**Ví dụ trả thưởng:** D2 tại Luyện Khí = `6×8 = 48` linh thạch +`10×8=80` tu vi; D6 tại Trúc Cơ = `8×50=400` linh thạch +`10×50=500` tu vi. Không thưởng thêm khi vượt 4/4 hay 5/5. Hai slot nhận thưởng tối đa giúp giới hạn faucet kể cả khi 3/3 đều hoàn thành. Có thể tăng quota sau khi telemetry đo tốc độ economy, **không tự ý** tăng trong PR đầu.

**Nghiệm thu từng mẫu:** D1 kill không phụ thuộc thắng trận; D2/D4 acquire chỉ tính delivered; D3 hai batch IDs; D4 variant không mutate; D5 không tạo chứng từ từ AFK passive tick ngắn/không có quyết toán; D6 thất bại không ghi; D7 nâng thể thành công một lần. Mọi mẫu thử cùng ma trận: đăng xuất/đăng nhập, reset khi panel đóng, đổi realm giữa kỳ, duplicate event, double-claim, empty claim, một sự kiện có thể đóng góp tiến độ của **nhiều nhiệm vụ đang active** nhưng reward mỗi nhiệm vụ chỉ claim một lần.

## C. Tuần vụ — 7 mẫu, mỗi tuần chọn 3, nhận tối đa 2

| Mẫu/ID | Nội dung hiển thị và chức năng lồng | Chứng từ thành công/eligibility | Thưởng gốc |
| --- | --- | --- | --- |
| `tvdm2_weekly_w1` · **Thanh Vân trừ họa** | “Hạ 25 địch phù hợp vùng/cảnh giới trong tuần.” Chiến Đấu → loot → growth. | 25 distinct enemy defeats với roster đã chốt lúc gán. | **20 linh thạch +40 tu vi**. |
| `tvdm2_weekly_w2` · **Tích khoáng thất nhật** | “Thu mới 20 khoáng của cảnh giới hiện tại.” Khai Khoáng → kho vật liệu → cường hóa. | 20 delivered realm ore, ID cố định khi gán. | **20 linh thạch +40 tu vi**. |
| `tvdm2_weekly_w3` · **Bội thu linh mạch** | “Quyết toán thành phẩm của 8 lứa sản xuất.” Động Phủ/Sản Xuất → túi. | 8 distinct `production_batch_claimed` receipts; đủ faucet trong 7 ngày. | **18 linh thạch +50 tu vi**. |
| `tvdm2_weekly_w4` · **Tám trận tinh luyện** | “Chiến thắng trọn 8 trận trong tuần.” Thám Hiểm → Combat → chiến lợi phẩm. | 8 distinct battle victory receipts, **không** dùng 8 enemy kills. | **24 linh thạch +40 tu vi**. |
| `tvdm2_weekly_w5` · **Dược hỏa duy trì** | “Luyện thành công 3 lò đan.” Nguyên liệu → Đan Phòng → tiêu vật tư. | 3 `alchemy.crafted` receipts; chỉ được gán khi đan/phụ liệu/recipe mở và nguồn nguyên liệu đủ. | **24 linh thạch +50 tu vi**. |
| `tvdm2_weekly_w6` · **Binh khí tinh luyện** | “Cường hóa thành công 3 lần.” Khí Đường → Trang Bị → combat. | 3 success commit IDs; không gán nếu cấp/chi phí bị cap hoặc không đủ nguồn. | **30 linh thạch +50 tu vi**. |
| `tvdm2_weekly_w7` · **Cường thân thủ mạch** | “Luyện Thể tiến triển 3 lần.” Thân thể → kho → tài nguyên khu vực. | 3 success commit IDs; không đòi hidden/perfection/max-rank; nếu cap đang kẹt thì exclude. | **34 linh thạch +50 tu vi**. |

**Ví dụ:** W1 ở Phàm = 20 linh thạch +40 tu vi; W4 ở Luyện Khí = 192 linh thạch +320 tu vi; W7 ở Trúc Cơ = 1.700 linh thạch +2.500 tu vi. Max tuần nếu cả ba eligible đã hoàn thành vẫn **2 claim**. Một battle win có thể đồng thời tính W1 kill và W4 win, phù hợp việc đan xen chức năng; mỗi event gắn với đúng period và không cộng lại khi nhận reward.

**Nghiệm thu tuần:** reset thứ Hai UTC đổi cả board và quota, ngày reset không chạm weekly, retry tại 00:00 UTC gắn vào kỳ do clock authority xác thực; kỳ cũ đã hết không claim muộn bằng chỉnh UI. Account có chưa đủ nguồn cho W5/W6/W7 phải tự tạo board từ nhóm khác khi gán; nếu không đủ ba mục tiêu khả thi, phát cảnh báo “Tuần này chưa đủ hoạt động phù hợp” cùng telemetry, không khóa game. Offline settle không tự biến thao tác view thành event.

## D. Giao diện và thông điệp

**Cấu trúc đề xuất:** `Chính Tuyến` · `Nhật Vụ` · `Tuần Vụ` · `Thành Tựu`, vẫn sử dụng QuestScene / QuestPanel / `BetaQuestSurfaceModel` read-only. Chính tuyến trình bày câu truyện trước/sau, 2–3 tiến độ từng mục tiêu, CTA theo chức năng và **Nhận thưởng** (chỉ sáng trạng thái khả dụng, vẫn có thể click để xem lý do thiếu). Daily/weekly có `2/2 lượt nhận`, thời gian reset tại địa phương và nguồn progress riêng. Thành tựu chia `Phàm | Luyện Khí | Trúc Cơ | Hành Trình`, ô có `x/y`, `Đã nhận`, `Chưa mở`, và 1 nút xem nguồn tiến độ.

Ví dụ lý do trực tiếp: “Cần thu thêm 2 Linh Khoáng mới nhận sau khi nhiệm vụ mở”; “Chưa thắng toàn ải 1-10”; “Chưa nhận đồng hành từ hộp thư”; “Đã nhận đủ 2 nhiệm vụ tuần này”; “Nhiệm vụ tuần vừa hết hạn”; “Nguyên liệu chưa thực vào túi”; “Lần luyện thể thất bại nên chưa được tính”. Phần `t('...')` phải đi qua i18n gateway, không hardcode bản Việt trong component.

## E. Các quyết định và chặn phát hành

1. **Chưa có `allOf`, weekly, achievement, event receipt tổng quát:** phải hoàn thành PR domain/save trước khi dùng dữ liệu. Existing `QuestCondition` chỉ có một condition, `cadence` chỉ once/daily, daily beta còn tắt ở `isBetaQuestEnabled`.
2. **Không gán ngược reward theo realm hiện tại:** daily/weekly freeze period band; achievement freeze intrinsic band. Tái dùng hàm scale hiện có theo một owner, không nhân lại tại UI.
3. **Thời gian/anti-cheat:** cần quyết định liệu beta có thời gian xác thực máy chủ; nếu không, daily/weekly phát hành với cảnh báo giới hạn anti-clock-abuse và không gọi là bảo đảm chống gian lận.
4. **Tần suất và sinh thái kinh tế:** xác minh 2 daily +2 weekly tối đa và đạt được trên gameplay thật, kể cả account mới và sau khi nâng realm. Nếu vật phẩm, tiền/tài nguyên hoặc progression quá thiếu, giảm yêu cầu hoặc cấp faucet qua hệ được phép — không phát item trực tiếp vì có quest.
5. **Đồng hành Trúc Cơ:** nguồn mail/operator đủ cho mọi account beta là điều kiện bắt buộc trước khi đặt đồng hành vào tuyến chính và achievement. Nếu không chứng minh được, chuyển objective bắt buộc Q17/Q18/Q20/Q21 sang tương tác formation có thể thực hiện không cần sở hữu; vẫn giữ companion trong nhánh phụ.
6. **Bản định nghĩa thắng trận:** `kill` ≠ `battle_victory` ≠ `stage_clear`, mỗi loại cần owner, receipt và unit test riêng.

**Không phát hành chỉ từ tài liệu này.** Mọi con số là đề xuất balance cần playtest; phần daily/weekly/thành tựu đều chưa có chứng minh runtime hiện hành.
