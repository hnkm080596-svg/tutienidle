# Hồi III — Trúc Cơ: Linh Lang Hộ Mạch (V2-15 đến V2-21)

**Bối cảnh:** Sau độ kiếp, người chơi tiếp cận hậu sơn. Linh Lang không phải thủ phạm mà là loài yêu thú đang cố trấn vết nứt, trong khi khối quặng bị đánh cắp đã làm nguồn khí lệch dòng. **Trục cơ chế:** vật liệu cấp Trúc Cơ → săn thú → đồng hành nhận quà → trận pháp → cường hóa → chuẩn bị hậu sơn → boss và lựa chọn cứu linh mạch. Q15 admit sau **realm thực `foundation_establishment`**, không phụ thuộc việc mở UI nhiệm vụ. Q16–Q21 theo predecessor claim.

**Dữ liệu thực có dẫn từ quest catalog:** `foundation_establishment_ore_decade`, `foundation_spirit_wolf`, `foundation_ferocious_spirit_wolf`; boss stage `foundation_floor_10`. Domain đồng hành/trận pháp mở tại Trúc Cơ theo release policy nhưng **cách nhận quà và khả năng có đồng hành cho mọi tài khoản cần xác minh trước khi buộc Q17/Q18**. Không có gacha, không dùng hệ pháp bảo Trúc Cơ còn deferred.

## V2-15 — Đá Mạch Trúc Cơ

- **ID/chaining:** `tvdm2_main_15` ← 14; `requiredRealmId:'foundation_establishment'`. **Chức năng nối:** Cảnh Giới → Mỏ/Động Thiên → Túi vật liệu.
- **Mở:** “Lôi kiếp rửa sạch tạp khí, nhưng dưới chân hậu sơn vẫn nặng mùi sắt cháy. Một mẩu quặng trắng chuyển đỏ khi người tu cầm lên.” **Mô tả:** “Bước vào Trúc Cơ, thu mới 3 Thập Niên Linh Khoáng Trúc Cơ và lĩnh ít nhất 1 lứa quặng từ sản xuất.” **Kết:** “Trên quặng có dấu răng sói. Linh Lang dường như đem đá về lấp vết nứt.”
- **Hợp đồng:** `[MỚI] allOf[realm_reached('foundation_establishment'), acquire('foundation_establishment_ore_decade',3),production_batch_claimed(siteKind:'ore',amount:1)]`. Realm đối chiếu bền vững; acquisition mới tính sau activation; bảo đảm faucet Trúc Cơ tại vùng hậu sơn thật sự trả đúng vật liệu.
- **Thưởng:** gốc **16 linh thạch +20 tu vi +2.500 lĩnh ngộ** → thực **800 linh thạch +1.000 tu vi +2.500 lĩnh ngộ**. **CTA:** “Đến Mỏ Hậu Sơn”; giải thích quặng phải ở band Trúc Cơ.
- **Biên + test:** Vật liệu `qi_refining_ore_decade` không khớp; tràn túi không cộng phần chưa nhận; lứa quặng đã lĩnh trước active không được tính batch, realm đã đạt được hồi chiếu. 1 lứa vừa đủ 3 quặng có thể thỏa đồng thời cả hai chứng từ.

## V2-16 — Bóng Trắng Hậu Sơn

- **ID/chaining:** `tvdm2_main_16` ← 15. **Chức năng nối:** Thám Hiểm → Chiến Đấu → Đan dược hồi phục.
- **Mở:** “Những bóng trắng băng qua màn sương, không tấn công mỏ mà đuổi người khỏi khe sâu. Chúng bị bỏng ở cổ và chân, có vẻ đang gắng sống sót.” **Mô tả:** “Đánh bại 5 Linh Lang và sử dụng thành công 1 đan dược hợp lệ để hồi phục/tu luyện.” **Kết:** “Trong ổ sói có một tấm phù cũ. Ai đó đã từng cố bảo vệ linh mạch.”
- **Hợp đồng:** `[MỚI] allOf[kill('foundation_spirit_wolf',5), pill_used(amount:1)]`. `pill_used` phải là receipt **consumption/benefit committed** của Pill domain; nếu viên đan không có hiệu ứng hợp lệ vì nhân vật đầy tài nguyên, UI phải nói lý do, không ép spam. **Nguồn đan được audit:** recipe/drop/bag có ít nhất một loại hợp lệ ở Trúc Cơ.
- **Thưởng:** gốc **20 linh thạch +3.000 lĩnh ngộ** → thực **1.000 linh thạch +3.000 lĩnh ngộ**. **CTA:** “Đi Hậu Sơn” / “Mở Túi Đan Dược”.
- **Biên + test:** Trận thua chỉ phản ánh quái chết nếu authority vẫn tính kill — mô tả không gọi là thắng 5 trận. Dùng đan thất bại/không trừ túi không tính; tiêu đan, sát thương, hồi máu và quest progress không được đếm trùng khi save/reload. Nếu game không có thao tác pill usable đáng tin ở Trúc Cơ, chặn phát hành Q16, không fake receipt.

## V2-17 — Linh Lang Chi Ước

- **ID/chaining:** `tvdm2_main_17` ← 16. **Chức năng nối:** Hộp Thư/Quà Đồng Hành → Trận Pháp → Chiến Đấu.
- **Mở:** “Người giữ núi gửi một phong thư: linh thú phản ứng với lực lượng lẻ loi, nhưng dịu xuống khi có khí tức đồng hành.” **Mô tả:** “Nhận một đồng hành được cấp sẵn tại Trúc Cơ, đặt đồng hành vào một vị trí trận pháp hợp lệ.” **Kết:** “Khí tức giao hòa, bầy sói ngừng cắn xé và hé lộ đường lên sườn núi.”
- **Hợp đồng:** `[MỚI] allOf[companion_available(accountOwned:true),formation_member_assigned(amount:1)]`. **Rủi ro phát hành High:** quà đồng hành beta được operator/mailbox phân phát; không được yêu cầu gacha hay khóa cứng người chơi không nhận quà. PR nội dung phải chứng minh mọi account beta đủ điều kiện tự nhận ít nhất 1 trong hai đồng hành đã chọn (Thần Nông/Khai Minh) theo đường phân phối hợp lệ. Nếu chưa chứng minh, đổi điều kiện chính tuyến thành `formation_unlocked` (chứng từ realm), chuyển việc xếp đồng hành sang sidequest; thay đổi phải được phê duyệt rõ.
- **Thưởng:** gốc **24 linh thạch +4.000 lĩnh ngộ** → thực **1.200 linh thạch +4.000 lĩnh ngộ**. **CTA:** “Nhận quà Đồng Hành” / “Xếp Trận”; hướng dẫn chưa có quà bằng lỗi tiếng Việt của owner.
- **Biên + test:** Rút/đặt lại nhân vật không farm completion; người nhận quà trước khi active vẫn hoàn tất bằng **state snapshot** của tài khoản và đội hình ở reconcile; kiện đầy túi/mailbox chậm không khóa claim vĩnh viễn; không tính khi mở hộp thư mà chưa nhận thật.

## V2-18 — Rèn Bảo Hộ Mạch

- **ID/chaining:** `tvdm2_main_18` ← 17. **Chức năng nối:** Khí Đường → Trang Bị → Trận Pháp.
- **Mở:** “Những phù đá cũ phản ứng với binh khí đã gia cố. Lão thợ đề nghị giữ trận có đồng hành trong khi ngươi chuẩn bị bảo hộ mạch.” **Mô tả:** “Cường hóa thành công 1 món trang bị tại Trúc Cơ và duy trì ít nhất 1 vị trí đồng hành trong trận.” **Kết:** “Mạch phù bắt đầu sáng trở lại; lỗ hổng lớn nhất nằm ở tầng sâu nhất.”
- **Hợp đồng:** `[MỚI] allOf[equipment_enhanced(minRealm:'foundation_establishment',amount:1),formation_member_present(minCount:1)]`. Enhancement receipt do Equipment owner phát; formation presence là trạng thái hiện tại được owner xác nhận ngay khi claim, không dùng thao tác visual drag làm chứng cứ.
- **Thưởng:** gốc **24 linh thạch +40 tu vi +4.500 lĩnh ngộ** → thực **1.200 linh thạch +2.000 tu vi +4.500 lĩnh ngộ**. **CTA:** “Cường Hóa” / “Xem Trận Pháp”; hiển thị phí/giới hạn từ preview authority.
- **Biên + test:** Cường hóa thất bại không tính; tháo đồng hành trước claim làm điều kiện formation quay về thiếu; tăng rank sau khi quest activate đủ một receipt; không cần chế tạo pháp bảo bị deferred.

## V2-19 — Linh Khí Tụ Trận

- **ID/chaining:** `tvdm2_main_19` ← 18. **Chức năng nối:** Luyện Thể → Công Pháp → Trận Pháp.
- **Mở:** “Dòng khí bị xé thành nhiều sợi. Chỉ có thân thể vững và tuần hoàn công pháp chính xác mới chống được lực giật ngược.” **Mô tả:** “Tiến triển Luyện Thể thành công 2 lần và đạt Công Pháp rank 1 trong grade đang cho phép.” **Kết:** “Ngươi đủ sức đến gần mạch lõi. Bầy sói dẫn đường thay vì cản lối.”
- **Hợp đồng:** `[MỚI] allOf[body_refinement_committed(amount:2,afterActivation:true), technique_rank_at_least(1)]`. Rank là state có thể đạt từ trước; hai lượt luyện thể là receipt mới để thấy tiến trình; không yêu cầu đường ẩn, hoàn mỹ bậc tối đa, hay breakthrough quá trần beta.
- **Thưởng:** gốc **30 linh thạch +40 tu vi +5.000 lĩnh ngộ** → thực **1.500 linh thạch +2.000 tu vi +5.000 lĩnh ngộ**. **CTA:** “Luyện Thể” / “Công Pháp”; mỗi hệ đưa lỗi điều kiện và số nguyên liệu thiếu từ owner.
- **Biên + test:** Khi rank đổi grade reset về 0, chứng từ `technique_rank_at_least` phải tham chiếu **grade hiện tại**/lịch sử đạt hợp lệ rõ ràng; nếu bắt current rank thì có thể gây softlock sau upgrade grade, khuyến nghị dùng `rank_milestone_attained` bền vững. Hai upgrade hợp lệ phải là hai commit riêng, không đếm replay receipt.

## V2-20 — Hậu Sơn Dị Biến

- **ID/chaining:** `tvdm2_main_20` ← 19. **Chức năng nối:** Thám Hiểm → Chiến Đấu → Trận Pháp/Đồng Hành.
- **Mở:** “Linh Lang ngã xuống bên những tảng đá đã nứt đôi. Vết thương giống vệt nóng trên quặng ở Thanh Vân Lâm; hóa ra nguồn bệnh chung ở một chỗ.” **Mô tả:** “Hạ 6 Linh Lang nổi loạn và hoàn tất 2 trận đấu có đội hình đồng hành hợp lệ.” **Kết:** “Đường đến cổ mộc đàm đã mở. Một con Lang Vương kiệt sức vẫn cố giữ tảng đá cuối cùng.”
- **Hợp đồng:** `[MỚI] allOf[kill('foundation_spirit_wolf',6),battle_victory_with_formation(amount:2)]`. Hệ battle owner xác thực kết quả cả trận, snapshot formation tại **battle start**, và receipt riêng cho mỗi trận; không tính thua trận, không lấy hiệu ứng hình ảnh của companion làm authority. Hai chiến thắng có thể đóng góp kill cùng lúc.
- **Thưởng:** gốc **36 linh thạch +50 tu vi +6.000 lĩnh ngộ** → thực **1.800 linh thạch +2.500 tu vi +6.000 lĩnh ngộ**. **CTA:** “Lên Hậu Sơn”; trên HUD chỉ dẫn đội hình trước khi vào trận.
- **Biên + test:** Auto-farm settle phải có battle IDs bền vững, không đếm 2 lần từ render/resolve; thắng mà không có đồng hành hợp lệ không tính vế trận; replay stage không nhân vô hạn nếu cấp receipt trùng; save sau 1/2 trận giữ trạng thái.

## V2-21 — Linh Lang Vương

- **ID/chaining:** `tvdm2_main_21` ← 20, kết beta tại Trúc Cơ. **Chức năng nối:** Trận Pháp + Trang Bị + Luyện Thể → Boss Hậu Sơn → Thành Tựu.
- **Mở:** “Lang Vương đứng giữa hồ cổ mộc, chân không còn vững. Dưới tảng đá nó giữ là đầu mút linh mạch đang nứt. Bầy sói liều chết để ngăn dị hỏa tràn ra đồng bằng.” **Mô tả:** “Giữ ít nhất 1 đồng hành trong đội hình và chiến thắng toàn ải Linh Lang Vương ở Hậu Sơn.” **Kết:** “Lang Vương gục xuống; ngươi phong kín vết rạn, trả khí tức dịu mát cho Thanh Vân. Mạch sâu hơn vẫn còn, nhưng hành trình Trúc Cơ kết thúc tại đây.”
- **Hợp đồng:** `[MỚI] allOf[formation_member_present(minCount:1), stage_clear('foundation_floor_10',1)]`. Stage clear từ chứng từ `completedStageIds` tại owner **chỉ khi chiến thắng toàn ải**; hạ `foundation_ferocious_spirit_wolf` đơn lẻ không chứng minh đã clear. Formation hiện diện yêu cầu lúc claim chỉ nếu vẫn hợp lệ; nên lưu **snapshot tại stage win** để khỏi buộc người chơi xếp lại sau khi thắng. Stage clear có thể hồi chiếu nếu đã clear trước activation; phần snapshot formation phải có semantics bảo toàn và migration cụ thể.
- **Thưởng:** gốc **80 linh thạch +100 tu vi +12.000 lĩnh ngộ** → thực **4.000 linh thạch +5.000 tu vi +12.000 lĩnh ngộ**; thêm **thành tựu một lần** `ach_story_thanh_van_sealed` nhận qua ledger riêng, không tự cấp hai lần qua quest. **CTA:** “Hậu Sơn — Linh Lang Vương” → “Xem Biên Niên Thành Tựu”. Không làm cảnh giới nhảy lên Kim Đan.
- **Biên + test:** Hạ boss rồi thua trận 0/1; có formation nhưng thua 0/1; đã thắng từ sớm được reconcile; duplicate completion/claim/save/restore không nhân linh thạch/achievement. Thử khi đồng hành bị gỡ trước claim và khi account chưa phát quà; fail closed với lý do, không vĩnh viễn kẹt beta.

## Nhịp kinh tế Hồi III

Tổng **230 linh thạch gốc → 11.500 thực**, **250 tu vi gốc → 12.500 thực**, **37.000 lĩnh ngộ không nhân**. Trần beta ở Trúc Cơ; không có thưởng artifact/domain Kim Đan hay hệ phái chưa mở. Phải kiểm chi phí luyện thể hai lần, đan, cường hóa và kết quả trận có companion thật trước khi mở cả hồi cho người chơi.
