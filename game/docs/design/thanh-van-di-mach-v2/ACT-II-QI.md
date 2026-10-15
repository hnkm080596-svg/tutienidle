# Hồi II — Luyện Khí: Tàn Hỏa Sơn Tặc (V2-08 đến V2-14)

**Bối cảnh:** Tu sĩ vừa nhập đạo Ngũ Hành (trong beta hiện là **Hỏa**) truy dấu quặng đỏ. Một toán sơn tặc đã chiếm mỏ, gom linh thảo luyện đan và dựng hỏa trận ở cửa vực. Quest Q08 chỉ được *admit* sau khi nhân vật thật đạt `qi_refining`; Q09–Q14 đi theo predecessor, reward-band Luyện Khí ×8 cho linh thạch/tu vi. Dữ liệu được xác minh từ `data/quest/quests.ts`: enemy `bandit`, boss `ferocious_bandit`, mỏ `qi_refining_ore_decade`, thảo `tu_linh_thao_qi_refining_decade`, đan `tu_linh_dan_qi_refining`, flag `alchemy.crafted`.

**Bản vẽ mục tiêu** `allOf[]` và mọi witness ngoài `kill`, `collect`, `alchemy.crafted` đều là **[MỚI]**. Cần xem `README.md` về hạn chế hiện trạng. Không có nhiệm vụ ép dùng Special/Ultimate hoặc chọn Mộc/Kim/Thủy/Thổ khi beta chưa mở.

## V2-08 — Tàn Hỏa Ven Sơn

- **ID/chaining:** `tvdm2_main_08` ← 07, `requiredRealmId:'qi_refining'`. **Chức năng nối:** Cảnh Giới → Ngũ Hành Hỏa → Chiến Đấu.
- **Mở:** “Nhập đạo mở linh giác. Đường hỏa mạch chạy dưới chân những kẻ cướp khoáng, khiến binh khí chúng đỏ rực trong đêm.” **Mô tả:** “Hoàn thành nhập Luyện Khí/Hỏa và đánh bại 3 Sơn Tặc ở Thanh Vân.” **Kết:** “Trong túi sơn tặc có mẩu giấy ghi vị trí lò đan dã chiến.”
- **Hợp đồng:** `[MỚI] allOf[realm_reached('qi_refining'), path_element_attained('fire'), kill(enemyId:'bandit',amount:3)]`. Realm/element chứng từ bền vững và hồi chiếu nếu có trước quest; kill đếm từ kích hoạt. Không gọi UI chọn hành để suy ra đã nhập đạo.
- **Thưởng:** gốc **20 linh thạch +40 tu vi +400 lĩnh ngộ** → thực **160 linh thạch +320 tu vi +400 lĩnh ngộ**. **CTA:** “Cảnh Giới/Ngũ Hành” → “Thanh Vân 1-11–13”; hiển thị ba mục rõ.
- **Biên + test:** Nhập đạo trước claim Q07 không softlock; không nhận Hỏa chỉ vì mở bảng kỹ năng; kill trong trận thua không được gọi là thắng ải; 3 kill+realm nhưng thiếu Hỏa vẫn ẩn Claim. Nhận thưởng chính xác một lần, sau restore Q09 mới được admit.

## V2-09 — Linh Thảo Trong Tro

- **ID/chaining:** `tvdm2_main_09` ← 08. **Chức năng nối:** Động Thiên/Sản Xuất → Túi → Đan Phòng.
- **Mở:** “Bên bờ suối nóng, linh thảo xanh mọc xen trong tro. Lửa thường thiêu rụi lá, dị hỏa lại làm dược tính cô đặc.” **Mô tả:** “Thu mới 5 Tụ Linh Thảo Luyện Khí và nhận ít nhất 1 lứa linh thảo thành công từ sản xuất.” **Kết:** “Dược sư xác nhận có thể dùng loài thảo này để luyện Tụ Linh Đan.”
- **Hợp đồng:** `[MỚI] allOf[acquire('tu_linh_thao_qi_refining_decade',5), production_batch_claimed(siteKind:'herb',amount:1)]`. Hai mục tiêu cùng một lứa sản xuất có thể hợp lệ: kiểm chứng **hành động** và **lượng thực nhận**, không buộc hai lượt farm. Để nguyên thảo trong túi cho Q10, không turn-in.
- **Thưởng:** gốc **25 linh thạch +500 lĩnh ngộ** → thực **200 linh thạch +500 lĩnh ngộ**. **CTA:** “Thu hoạch Linh Thảo” → “Đan Phòng”, nêu rõ 5 đơn vị **nhận mới**, không chỉ đang có.
- **Biên + test:** Nếu vườn thảo bị khóa/không có seed tại Luyện Khí thì phải sửa faucet ở PR nội dung trước khi phát hành; nếu item overflow, chỉ đếm `delivered`. Sản xuất offline tính một batch receipt duy nhất; restart không cộng lại. 0/5 thảo trong túi ban đầu không hồi tố.

## V2-10 — Đan Hỏa Khai Mạch

- **ID/chaining:** `tvdm2_main_10` ← 09. **Chức năng nối:** Luyện Đan → Vật Liệu → Chiến Đấu.
- **Mở:** “Một lò đan nhỏ đặt trên nền quặng đỏ, lửa trở nên ổn định trước khí tức Luyện Khí. Hãy luyện dược để giảm sức ép khi truy đuổi.” **Mô tả:** “Luyện chế thành công 1 lần và đánh bại thêm 2 Sơn Tặc.” **Kết:** “Mùi đan thoảng qua chiến trường. Bản vẽ lò đan của bọn sơn tặc có một đường hỏa văn kỳ lạ.”
- **Hợp đồng:** `[MỚI] allOf[flag('alchemy.crafted',1),kill('bandit',2)]`; phần flag **[CÓ]**, nhưng hiện chỉ đếm khi active; không tính lò đan thất bại. Tính toán recipe đủ nguyên liệu Luyện Khí và không tiêu hao 5 thảo của Q09 khi chưa dùng vào craft là quyết định của chủ hệ đan.
- **Thưởng:** gốc **30 linh thạch +700 lĩnh ngộ +1 `tu_linh_dan_qi_refining`** → thực **240 linh thạch +700 lĩnh ngộ +1 đan**. Số đan không nhân ×8, cấp qua `QuestItemReward` đang có. **CTA:** “Luyện Đan” / “Đi Thanh Vân”.
- **Biên + test:** Craft thành công nhưng đóng màn hình vẫn tính; hủy craft/craft thất bại không tính; thua trận sau hạ 2 quái vẫn không gọi là chiến thắng cả ải. Nút claim báo túi đan đầy/overflow theo receipt, không hứa vật phẩm vào túi nếu bị mất do tràn.

## V2-11 — Công Pháp Dẫn Hỏa

- **ID/chaining:** `tvdm2_main_11` ← 10. **Chức năng nối:** Công Pháp → Cây Kỹ Năng Hỏa → Chiến Đấu.
- **Mở:** “Tấm bản đồ của sơn tặc dùng nét hỏa tự để đánh dấu khe đá. Muốn đọc được, ngươi phải vận công theo đúng tuần hoàn.” **Mô tả:** “Nâng Công Pháp lên rank 1 (trong grade hiện cho phép) và tăng cấp/mở 1 nút kỹ năng Hỏa hợp lệ.” **Kết:** “Linh văn trên bản đồ hiện tên một trại khoáng nằm sau hẻm núi.”
- **Hợp đồng:** `[MỚI] allOf[technique_rank_at_least(1), skill_node_progress_committed(element:'fire',amount:1)]`. Quan sát authoritative technique/skill state; không được gán flag bằng thao tác mở UI. **Chặn nguồn:** xác nhận grade/rank ceiling tại Luyện Khí, giá nâng và starter node nào thực sự có thể tăng; không buộc Special/Ultimate bị khóa beta.
- **Thưởng:** gốc **35 linh thạch +50 tu vi +900 lĩnh ngộ** → thực **280 linh thạch +400 tu vi +900 lĩnh ngộ**. **CTA:** “Công Pháp” / “Kỹ Năng Hỏa”, nêu rõ cấp/rank hiện tại và nguyên liệu còn thiếu.
- **Biên + test:** Rank trước activation thỏa qua read-only state snapshot trong **reconcile command**, không phát giả event. Nâng nút kỹ năng trước active có thể đối chiếu `skill.level` nếu mục tiêu định nghĩa state (tránh ép hoàn tác). Test rank thiếu tiền, giới hạn grade, nút bị khóa, lặp click, restore.

## V2-12 — Khoáng Mạch Bị Đánh Cắp

- **ID/chaining:** `tvdm2_main_12` ← 11. **Chức năng nối:** Khai Khoáng → Khí Đường/Cường Hóa → Trang Bị.
- **Mở:** “Sơn tặc đào quặng ngay từ vết nứt của Thanh Vân. Một thợ rèn bị bắt thú nhận chúng đang rèn móc giữ linh mạch.” **Mô tả:** “Thu mới 3 Thập Niên Linh Khoáng Luyện Khí và cường hóa trang bị thành công 1 lần.” **Kết:** “Vũ khí được gia cố có thể chạm vào mạch quặng mà không bị thiêu đỏ.”
- **Hợp đồng:** `[MỚI] allOf[acquire('qi_refining_ore_decade',3), equipment_enhanced(amount:1)]`. Chỉ tính enhancement **thành công và trạng thái thay đổi thật**; không cần tiêu quặng bởi quest claim. Trước phát hành phải chứng minh nguồn đồ và phí cường hóa đủ sớm; không được giả định 3 quặng luôn đủ phí.
- **Thưởng:** gốc **35 linh thạch +1.000 lĩnh ngộ** → thực **280 linh thạch +1.000 lĩnh ngộ**. **CTA:** “Đi Mỏ” / “Cường Hóa”; hiển thị tiến độ vật liệu, lần thành công và mục đích sử dụng.
- **Biên + test:** Enhancement fail không được tính hoặc mất chi phí quest riêng; điều kiện inventory không được biến thành phép tiêu nguyên liệu hai lần. Test acquire qua loot hoặc production, cường hóa bằng nguồn thật, save/reload và claim idempotent.

## V2-13 — Ngũ Hành Phá Trận

- **ID/chaining:** `tvdm2_main_13` ← 12. **Chức năng nối:** Luyện Thể → Kỹ Năng Hỏa → Chiến Đấu Sơn Tặc.
- **Mở:** “Một hỏa trận cũ nằm dưới chân trại. Gió cuốn tro thành hình phù, như thể chính khe nứt đang nuôi dưỡng tà thuật.” **Mô tả:** “Hoàn thành 1 lần Luyện Thể tại Luyện Khí và đánh bại 5 Sơn Tặc bằng bất kỳ kỹ năng hợp lệ.” **Kết:** “Bộ trận tan rã, hỏa khí rút về vực sâu. Sơn Tặc Vương vẫn giữ chìa khóa.”
- **Hợp đồng:** `[MỚI] allOf[body_refinement_committed(minRealm:'qi_refining',amount:1),kill('bandit',5)]`. Chỉ ghi receipt tiến triển thật, không yêu cầu 36 bước Nghịch Chu Thiên hoàn mỹ, không yêu cầu hiệu ứng nguyên tố không có trong beta; kỹ năng Hỏa được gợi ý trong CTA nhưng không bắt buộc một loại skill chưa mở.
- **Thưởng:** gốc **45 linh thạch +80 tu vi +1.300 lĩnh ngộ** → thực **360 linh thạch +640 tu vi +1.300 lĩnh ngộ**. **CTA:** “Luyện Thể” / “Dẹp Trại Sơn Tặc”.
- **Biên + test:** Nâng luyện thể ngoài Luyện Khí sau khi đã tới Trúc Cơ: phải định nghĩa witness `minRealm` rõ (đề xuất có thể hoàn thành bằng Trúc Cơ để tránh quest tồn đọng), hoặc giữ hỗ trợ nâng ở cảnh giới đã qua. Test 5 kills trước/after upgrade, clamp counter, offline defeat replay không nhân thưởng.

## V2-14 — Trảm Sơn Tặc Vương

- **ID/chaining:** `tvdm2_main_14` ← 13; hồi II kết. **Chức năng nối:** Vận Dụng Hỏa Pháp → Boss Ải → Độ Kiếp Trúc Cơ.
- **Mở:** “Sơn Tặc Vương đốt lò quặng ngay miệng vực. Hắn tưởng mình điều khiển dị hỏa, nhưng dòng lửa bên dưới đang lần theo từng bước chân hắn.” **Mô tả:** “Đã đạt Luyện Khí tầng 12 và chiến thắng toàn ải Thanh Vân 1-20.” **Kết:** “Vật chứng trên người thủ lĩnh chỉ về hậu sơn, nơi một bầy Linh Lang đang cố phong kín mạch đất. Đường độ kiếp đã xuất hiện.”
- **Hợp đồng:** `[MỚI] allOf[realm_level_reached('qi_refining',12),stage_clear('qi_refining_abyssal_pool',1)]`; các chứng từ mốc bền vững có thể đã đạt trước active. `kill('ferocious_bandit',1)` **không thay thế** chiến thắng toàn ải. Cảnh giới thật được nâng qua owner Cảnh Giới/Độ Kiếp, quest chỉ chỉ đường.
- **Thưởng:** gốc **80 linh thạch +150 tu vi +2.000 lĩnh ngộ** → thực **640 linh thạch +1.200 tu vi +2.000 lĩnh ngộ**. **CTA:** “Khiêu chiến 1-20” → “Độ Kiếp Trúc Cơ”.
- **Biên + test:** Giết boss rồi chết/retreat không đạt; `completedStageIds` vẫn đúng sau restore. Độ kiếp xảy ra trước Q14 claim không khóa hoàn tất vì bền vững chứng từ đã đạt Luyện Khí 12. Quest claim không thể gọi breakthrough hoặc tăng cảnh giới.

## Nhịp kinh tế Hồi II

Tổng **270 linh thạch gốc → 2.160 thực**, **320 tu vi gốc → 2.560 thực**, **6.800 lĩnh ngộ (không nhân)** và **1 Tụ Linh Đan Luyện Khí**. Cần balance test tổng chi phí rank công pháp, skill node, nâng trang bị, luyện thể và đan trước khi phê duyệt. Số thưởng có chủ đích thấp hơn riêng lẻ so với loot tích lũy, không biến claim thành nguồn giàu nhất mỗi cảnh giới.
