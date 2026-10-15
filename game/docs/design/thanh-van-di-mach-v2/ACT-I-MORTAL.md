# Hồi I — Phàm Nhân: Mạch Lửa Trong Rừng (V2-01 đến V2-07)

**Bối cảnh:** Thanh Vân Lâm mất mùa, thú rừng trở nên hung dữ. Người tu mới bắt đầu quan sát mạch gỗ, phát hiện quặng nhiễm nhiệt rồi lần đến hang Dã Trư Vương. Mỗi thẻ được mở sau khi **nhận thưởng** thẻ trước, `cadence:'once'`, `chainId:'mainline'`, `requiredRealmId:'mortal'` **không áp dụng** như gate bằng nhau: nhân vật đã vượt cảnh giới vẫn được hoàn thành quest cũ. Bộ nhận diện đề xuất: `tvdm2_main_01`…`07`.

**Dữ liệu nguồn:** enemy `mortal_wild_boar`, boss `mortal_ferocious_wild_boar`, vật liệu `mortal_wood_decade` và `mortal_ore_decade` đang được các quest thật dùng. Stage boss `mortal_dong_10` đã được xác minh. Những điều kiện `allOf`, chứng từ nâng cấp/trang bị/luyện thể và lời thoại dưới đây là **[MỚI]**. Tên CTA chỉ là đề xuất bố cục, không khẳng định routing đã có.

## V2-01 — Lâm Khí Khác Thường

- **ID/chaining:** `tvdm2_main_01`; head; đăng ký ngay sau tạo nhân vật. **Chức năng nối:** Động Phủ/Sản Xuất → Túi → Thám Hiểm.
- **Mở:** “Thanh Vân Lâm từng ngát hương gỗ mục; hôm nay những vết đen trên vỏ cây lại ấm như than. Nếu muốn hiểu nguồn khí lạ, trước hết hãy đem về mẫu vật còn tươi.” **Mô tả hiển thị:** “Thu mới 3 Thập Niên Linh Mộc từ sản xuất hoặc chiến lợi phẩm; đánh bại 1 Dã Trư đang phá rừng.” **Kết:** “Trong thớ gỗ có một sợi nhiệt khí. Đàn trư hẳn đã uống phải nguồn nước chảy qua vết nứt.”
- **Hợp đồng mục tiêu:** `[MỚI] allOf[acquire(materialId:'mortal_wood_decade',amount:3,source:any), kill(enemyId:'mortal_wild_boar',amount:1)]`. `acquire` chỉ tính số thực vào túi **sau active**, không tiêu hao ở claim; các món ban đầu không tính. `kill` `[CÓ]` từ QuestSystem; bản kết hợp `allOf` mới.
- **Thưởng:** gốc **12 linh thạch +20 tu vi** → thực **12/20**; không trả mộc để tránh tự kích hoạt quest kế tiếp. **CTA:** “Đến Sản Xuất” / “Đi Thanh Vân 1-1”; 0/3 và 0/1 riêng, cùng nút “Nhận thưởng” khi cả hai đạt.
- **Biên + nghiệm thu:** Không được đếm mộc khởi tạo, vật liệu overflow hoặc replay cùng receipt; giết trước kích hoạt không tính. Test lấy 2 mộc+1 kill chưa claim; lấy mộc thứ ba→claim đúng 1 lần, giữ nguyên mộc trong túi; save/reopen vẫn 3/3.

## V2-02 — Vết Móng Hung Trư

- **ID/chaining:** `tvdm2_main_02` ← 01. **Chức năng nối:** Chiến Đấu → Nhân Vật/Cảnh Giới → Sản Xuất.
- **Mở:** “Vết móng sâu hằn trên thân cây bị cháy. Dã trư húc đổ cả gốc cổ mộc, nhưng chúng tránh một mạch đá ở giữa rừng.” **Mô tả:** “Hạ 3 Dã Trư và nâng nhân vật đến Phàm Nhân tầng 3.” **Kết:** “Càng mạnh hơn, ngươi càng cảm thấy nhiệt khí luồn dưới lòng đất chứ không đến từ mặt trời.”
- **Hợp đồng:** `[MỚI] allOf[kill('mortal_wild_boar',3), realm_level_reached(realm:'mortal',level:3)]`. Mốc tầng là durable attainment do realm owner ghi, không tăng từ lệnh mở bảng; nhân vật đã đạt tầng 3 trước khi kích hoạt được đối chiếu ngay ở lifecycle command.
- **Thưởng:** gốc **15 linh thạch +35 tu vi** → **15/35**. **CTA:** “Chiến đấu” / “Tu luyện”; hướng dẫn tăng tầng ở đúng nguồn, không âm thầm gọi tăng cấp.
- **Biên + nghiệm thu:** Vào Luyện Khí sớm vẫn nhận chứng từ từng đạt Phàm tầng 3; death-only kill có thể xảy ra ở trận thua nên không viết “thắng 3 trận”. Test tăng tầng trước/sau kích hoạt, 2/3 kills chưa claim, save/restore không cấp lại thưởng.

## V2-03 — Huyền Khoáng Dị Sắc

- **ID/chaining:** `tvdm2_main_03` ← 02. **Chức năng nối:** Khai Khoáng → Kho Vật Liệu → Khí Đường.
- **Mở:** “Thợ mỏ nhặt được viên quặng xanh có tia đỏ chạy qua lõi. Không ai dám đập nó vì tiếng vang giống nhịp tim.” **Mô tả:** “Thu mới 3 Thập Niên Linh Khoáng và nhận ít nhất 1 lượt thành phẩm từ điểm sản xuất quặng.” **Kết:** “Mạch quặng hướng về hang đá. Có kẻ đã đào thứ gì đó ra từ sâu trong lòng núi.”
- **Hợp đồng:** `[MỚI] allOf[acquire('mortal_ore_decade',3), production_batch_claimed(siteKind:'ore',amount:1)]`. Nguồn sản xuất phải thực sự có thể khai thác ở Phàm; nếu route production không xuất receipt thì PR hợp đồng bắt buộc. Không tính bấm mở Khí Đường là hoàn tất.
- **Thưởng:** gốc **16 linh thạch +35 tu vi** → **16/35**. **CTA:** “Đến Mỏ” / “Mở Khí Đường”; nguyên liệu ở quest này được giữ lại cho nhịp sau, không lấy vật liệu sẵn có làm progress.
- **Biên + nghiệm thu:** 6 quặng khởi đầu không được tính hồi tố; claim batch có số thực nhận 0 do đầy túi không tính acquire nhưng có thể phát receipt batch nếu xử lý thành công — cần copy rõ. Test điều kiện đạt tách biệt, settle offline đúng một lần, lập lại batch ID không nhân tiến độ.

## V2-04 — Rèn Khí Hộ Thân

- **ID/chaining:** `tvdm2_main_04` ← 03. **Chức năng nối:** Trang Bị → Khí Đường → Chiến Đấu.
- **Mở:** “Khoáng dị sắc có thể gia cố một mảnh hộ giáp. Lão thợ rèn bảo ngươi đừng bước vào sào huyệt dã trư khi tay còn trống.” **Mô tả:** “Trang bị thành công 1 món đồ và hạ thêm 3 Dã Trư sau khi chuẩn bị.” **Kết:** “Vết móng đập vào giáp bật tia sáng đỏ; hung tính của đàn trư giờ có nguyên nhân rõ ràng.”
- **Hợp đồng:** `[MỚI] allOf[equipment_equipped(amount:1,uniqueMutation:true), kill('mortal_wild_boar',3)]`. Chứng từ trang bị phát sau commit của owner; tháo rồi lắp lại cùng món không thể farm vô hạn; **release gate:** phải kiểm thực sự có đồ ở giai đoạn này, nếu thiếu cấp đồ qua nguồn gameplay hợp lệ trong PR nội dung, không tự cấp từ presentation.
- **Thưởng:** gốc **20 linh thạch +50 tu vi** → **20/50**. **CTA:** “Mở Trang Bị” / “Khiêu chiến”; trạng thái 0/1 trang bị, 0/3 quái.
- **Biên + nghiệm thu:** Trang bị trước kích hoạt không phát event credit; nếu người chơi đang mặc đồ thì đối chiếu `equippedCount>=1` như một `state_at_least` khi nhận quest, tránh bắt tháo-lắp. Test thiếu đồ, đầy túi, đổi đồ, unequip/re-equip và restore.

## V2-05 — Khai Mở Thể Mạch

- **ID/chaining:** `tvdm2_main_05` ← 04. **Chức năng nối:** Luyện Thể → Vật Liệu → Chiến Đấu.
- **Mở:** “Hỏa khí không chỉ thiêu cây; nó dồn ép cả huyết mạch. Hãy luyện gân cốt để chịu nổi sức nóng.” **Mô tả:** “Thực hiện 1 lượt Luyện Thể thành công và hạ 2 Dã Trư.” **Kết:** “Một tia nóng xuyên qua kinh mạch rồi tan đi. Thân thể giờ chịu được luồng khí nặng hơn.”
- **Hợp đồng:** `[MỚI] allOf[body_refinement_committed(amount:1), kill('mortal_wild_boar',2)]`. Sử dụng API chủ luyện thể; chỉ tiến độ tăng thật và tiêu tài nguyên hợp lệ mới tạo receipt. Không yêu cầu luyện thể **bậc 7/ẩn**, không cần hoàn thành chu thiên nghịch.
- **Thưởng:** gốc **22 linh thạch +60 tu vi** → **22/60**. **CTA:** “Luyện Thể” / “Thử sức”; chỉ báo rõ nguyên liệu và điều kiện thiếu.
- **Biên + nghiệm thu:** Không có vật liệu thì không ghi credit; click thất bại không trừ nguyên liệu; đếm tối đa 1 receipt riêng biệt; thuộc tính thể lực tăng đúng authority, save/reopen giữ thưởng.

## V2-06 — Dấu Tích Dị Hỏa

- **ID/chaining:** `tvdm2_main_06` ← 05. **Chức năng nối:** Tu Luyện → Luyện Thể → Thám Hiểm.
- **Mở:** “Trong hang có những vệt đỏ như kinh văn, nhưng đèn dầu không đủ nóng để tạo ra chúng. Vết nứt của núi hẳn đã được mở từ trước.” **Mô tả:** “Đạt Phàm Nhân tầng 8 và hoàn tất thêm 1 lần Luyện Thể.” **Kết:** “Ngươi nghe tiếng gầm ở đáy động. Thứ canh giữ mạch hỏa đang thức giấc.”
- **Hợp đồng:** `[MỚI] allOf[realm_level_reached('mortal',8), body_refinement_committed(1,afterActivation:true)]`. Tầng 8 là ngưỡng **không buộc đột phá hoàn mỹ**; tầng đã đạt được nhận bằng durable realm witness. Phải đối chiếu tốc độ tu luyện/vật liệu luyện thể để không ép grind vô lý.
- **Thưởng:** gốc **25 linh thạch +70 tu vi** → **25/70**. **CTA:** “Tu Luyện” / “Luyện Thể”, mô tả cụ thể hai cột kiểm tra; có thể hoàn tất khi đã sang Luyện Khí nhờ chứng từ đạt tầng cũ.
- **Biên + nghiệm thu:** Quest activated sau khi đạt tầng 8 vẫn hoàn thành vế cấp; lượt luyện thể trước active không tính. Khi tất cả đã đạt, claim đúng một lần và mở Q07; chuyển giới không xóa nhiệm vụ dang dở.

## V2-07 — Hung Trư Trấn Mạch

- **ID/chaining:** `tvdm2_main_07` ← 06, hồi I kết. **Chức năng nối:** Trang Bị + Luyện Thể (đã học) → Ải Boss → Cảnh Giới.
- **Mở:** “Dã Trư Vương nằm trên khe nứt. Mỗi lần nó cào đất, cột khí đỏ lại bốc lên như ngọn nến ngược.” **Mô tả:** “Chiến thắng toàn ải Thanh Vân 1-10 và chứng tỏ đã đạt Phàm Nhân tầng 12.” **Kết:** “Đá vỡ, mạch lửa chạy thẳng về Sơn Tặc Trại. Phàm cốt đã rèn xong, đường nhập Luyện Khí đang mở.”
- **Hợp đồng:** `[MỚI] allOf[stage_clear(stageId:'mortal_dong_10',amount:1), realm_level_reached('mortal',12)]`. Stage owner xác nhận **chiến thắng cả ải** ghi `completedStageIds`; hạ 1 `mortal_ferocious_wild_boar` rồi thua không thể thay stage clear. Cả hai chứng từ mốc trạng thái được hồi chiếu trong **lifecycle reconcile** nếu xảy ra trước khi active. Đây là mục tiêu hiển thị “vượt ải”, không sử dụng `kill` fallback khi phát hành.
- **Thưởng:** gốc **60 linh thạch +120 tu vi** → **60/120**. **CTA:** “Khiêu chiến 1-10”, sau hoàn thành: “Đến Cảnh Giới — Quán Khí”. **Nhận thưởng không tự đột phá**; quest Q08 vẫn chờ realm `qi_refining` do hệ cảnh giới chuyển.
- **Biên + nghiệm thu:** Thắng ải/đạt 12 trước active đều được đối chiếu; thua sau khi giết boss không tính; đánh lại không nhân ải; giữ trạng thái completed stage qua restore và nhận thưởng đúng một lần. Người chơi đã ở Luyện Khí không bị khóa Q07 chỉ vì `realmId` khác Phàm.

## Nhịp kinh tế Hồi I

Tổng **170 linh thạch, 390 tu vi**, mỗi lần trả tại claim; không phát vật liệu làm ảnh hưởng tăng trưởng tiến độ. Cần mô phỏng khả năng đạt các mốc tầng 3/8/12, nguồn trang bị và luyện thể trước khi duyệt. Nhiệm vụ 04/05/06 có đường hướng dẫn thao tác nhưng không được khóa thao tác cốt lõi khi chưa mở panel Quest.
