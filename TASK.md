# VIỆC CẦN LÀM

<!--
Xóa phần ví dụ bên dưới và viết yêu cầu của bạn.
Bạn có thể viết bằng tiếng Việt bình thường, không cần biết thuật ngữ lập trình.
-->

## Tôi muốn

HIện tại sau khi battle thất bại, animation của nhân vật ở battle sau bị mất. Thanh status(hp) phải cập nhật khi nhận,gây sát thương chứ không phải chỉ khi tiêu diệt hoặc bị tiêu diệt. Hiện tại vẫn chưa thấy hiện tên skill trong combat (tôi chỉ đang test pháp tu). Chỉ có projectile bay ra, có nhảy máu bị trừ của mob, nhưng không thấy tên skill nhảy lên. Cơ chế mở tầng quái sẽ là hoàn thành rồi mới mở tầng tiếp theo, không phải mở theo cảnh giới nhân vật. Các từ chỉ qualities và rarity khi xuất hiện trong game đều cần phải kèm theo màu sắc tương ứng, bất kể xuất hiện ở đâu, ví dụ "phàm khí" luôn màu xám, chí bảo luôn màu đỏ. Hiện tại tooltip đang là ví dụ : Huyền Phẩm * Thanh vân Thiết Kiếm, rồi xuống hàng lại thêm Vũ KHí-chí bảo--huyền phẩm, này là dư thừa, khung đã bảo phẩm chất, tên đã có chất lượng, chỉ cần để lại vũ khí là được.Các dòng chỉ số không cần ghi "gốc x~y" chỉ cần "x~y" là được. Bậc của chỉ số phụ có thể thay bằng số La mã hoặc màu sắc tương ứng, ví dụ bậc 1 trắng, bậc 2 xanh lá, ...Thay đổi tên không gọi là đầu tư, mà gọi là Tình trạng rèn : a/b. Đồ trong game rớt theo cảnh giới nhân vật, nên không cần thể hiện yêu cầu mặc. chúng ta cũng không có cơ chế đó. các loại tên của chỉ số cũng lạ lùng, "của thân pháp" là sao ? Nhân tiện 5 loại chỉ số gốc sẽ không thể xuất hiện trên bất kì item/cách nào trừ uống đan dược và tăng cảnh giới. Hiện tại vẫn chưa thấy tooltip so sánh thi hover lên trên một trang bị cùng loại với trang bị đang mặc. Bỏ cơ chế set đồ đi. Tôi sẽ đưa cho bạn một folder chứa toàn icon của item các loại, hệ thống item giờ sẽ hoàn toàn random từ chỉ số, đến hình ảnh(chọn random một ảnh bên trong data khi tạo item), đến tên gọi(dựa theo lần trước chúng ta đã thực hiện việc ghép các tiền tố và hậu tố). Chúng ta sẽ rework việc phân chia chỉ số nào sẽ xuất hiện trên các loại trang bị, tôi cần bạn thiết kế sao cho vũ khí cho mainStat tấn công.

## Khi hoàn thành, tôi mong đợi

Ma trận stat đã chỉnh
Slot	Thiên hướng	Main stat cố định
Vũ khí	Công	attack
Mũ	Thủ – sinh lực	maxHp
Áo	Thủ – giáp	defense
Giày	Thủ – né tránh	evasionRate
Nhẫn	Công	criticalRate hoặc critical damage
Dây chuyền	Utility	atkspeed hoặc castspeed


Sáu slot có main stat riêng, không trùng nhau.
Substat theo slot
Vũ khí
Chỉ nhận substat tấn công:
- criticalRate
- criticalDamage
- attackSpeed
- castSpeedPercent
- accuracyRating
- skillDamagePercent
- ailmentPotencyPercent
- leechPercent
- firePower, woodPower, waterPower, metalPower, earthPower
- Thêm các chỉ số xuyên kháng nguyên tố vào hệ thống stat, bổ sung vào đây
attack không thể xuất hiện lại vì đã là main stat.
Mũ
Thiên về tài nguyên và chống hiệu ứng:
- maxMp
- wardMax
- wardRegenPerSecond
- manaRegenPerSecond
- criticalAvoidance
- ailmentResistPercent
- dotResistancePercent
- manaShieldPercent
Áo
Thiên về chịu sát thương trực tiếp:
- maxHp
- blockChance
- blockEffectiveness
- enduranceThreshold
- endurancePercent
- criticalAvoidance
- dotResistancePercent
- thornsPercent
- hpRegenPerSecond
Giày
Thiên về né tránh, di chuyển và hồi phục:
- movementSpeed
- criticalAvoidance
- ailmentResistPercent
- hpRegenPerSecond
- wardRegenPerSecond
- endurancePercent
evasionRate không xuất hiện lại vì đã là main stat.
Nhẫn
Trang sức thiên công:
- attack
- attackSpeed
- castSpeedPercent
- accuracyRating
- skillDamagePercent
- ailmentPotencyPercent
- leechPercent
- Sức mạnh của năm nguyên tố
criticalRate/critical damage không xuất hiện lại vì đã là main stat.
Dây chuyền
Trang sức thiên utility/phòng thủ:
- cooldownReduction
- manaRegenPerSecond
- wardMax
- wardRegenPerSecond
- maxHp
- criticalAvoidance
- ailmentResistPercent
- manaShieldPercent
- leechPercent
atkspeed/castspeed không xuất hiện lại vì đã là main stat.
Điều chỉnh dữ liệu hiện tại
Các affix sau phải bị loại khỏi hệ thống trang bị:
- suffix_dexterity
- suffix_vitality
- prefix_supreme_strength
- suffix_supreme_intelligence
attunement hiện chưa có affix nhưng cũng phải được policy cấm rõ ràng để tránh được thêm nhầm sau này.
Hai affix Supreme dùng Strength và Intelligence nên được thay bằng chỉ số trang bị thực sự:
- Supreme thiên công: thêm final damage boost vào hệ thống chỉ số
- Supreme thiên thủ/utility: final damage reduction vào hệ thống chỉ số
Luật hệ thống
Nên khai báo rõ danh sách cấm:
const EQUIPMENT_FORBIDDEN_STATS = [
  'strength',
  'dexterity',
  'intelligence',
  'attunement',
  'vitality',
] as const
Khi đăng ký dữ liệu và khi roll cần kiểm tra đồng thời:
1. Main stat đúng với slot.
2. Affix thuộc pool cho phép của slot.
3. Không thuộc năm thuộc tính nhân vật bị cấm.
4. Không trùng main stat.
5. Không trùng bất kỳ substat nào đã có.
6. Supreme/Exalted cũng phải qua toàn bộ các luật trên.
Nên thêm validation lúc khởi động để dữ liệu sai bị phát hiện ngay, thay vì chỉ trông chờ bộ lọc roll. Như vậy một affix thuộc năm chỉ số cấm sẽ báo lỗi dữ liệu rõ ràng.
Kế hoạch triển khai cập nhật
1. Tạo EquipmentSlotStatPolicy chứa main stat và substat hợp lệ của từng slot.
2. Tạo danh sách năm stat bị cấm trên equipment.
3. Chuyển Mũ sang maxHp, Giày sang evasionRate, Dây chuyền sang atkspeed hoặc castspeed, nhẫn sang critdmg/critrate.
4. Xóa hoặc thay thế bốn affix thuộc tính hiện có.
5. Áp policy vào tạo item, thêm dòng, affix bonus và Exalted.
6. Thêm validation cho toàn bộ equipment/affix data.
7. Quyết định xử lý item cũ: xóa hẳn. vì cơ chế mới, random toàn bộ, chúng ta chỉ cần base dạng : Kiếm/Châu/Quyền, Quán(mũ/mão), Bào(áo), Hài(giày), Trụy(necklace), và giới(ring)
8. Cập nhật tooltip để thể hiện rõ thiên hướng Công/Thủ/Utility.
9. Viết test cho main stat, slot pool, chống trùng và năm stat bị cấm.
10. Chạy test, type-check và build.
Điểm cốt lõi là tách hẳn hai hệ: năm thuộc tính chính chỉ đến từ phân điểm/cơ chế nhân vật; trang bị chỉ cung cấp các combat stat cụ thể. Điều này giúp giá trị điểm thuộc tính không bị trang bị lấn át và mỗi slot có bản sắc rõ hơn.

## Không được thay đổi



## Ghi chú hoặc tài liệu liên quan
