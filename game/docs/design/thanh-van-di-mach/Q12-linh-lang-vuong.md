# Q12 — Linh Lang Vương

**Định vị:** Hồi III / Trúc Cơ, cao trào và điểm kết Beta. **ID:** `tvdm_12`; **predecessor:** Q11; **requiredRealmId:** `foundation_establishment`; **dependency:** stage-clear + narrative ending optional.

## Cốt truyện và copy

**Mở:** “Cổ Mộc Đàm nằm trên nơi năm nhánh linh mạch gặp nhau. Trong màn sương trắng, Linh Lang Vương đứng chắn một khe nứt sâu hun hút. Thân nó bị một dải hỏa khí đỏ xiết chặt, nhưng đôi mắt vẫn hướng về lòng đất, như cố trấn áp thứ đang thoát ra. Để cứu Thanh Vân, ngươi buộc phải vượt qua nó.”

**Tên:** Linh Lang Vương. **Mô tả:** “Chinh phục **Thanh Vân 1-30**, đánh bại Linh Lang Vương và khép lại bí ẩn Thanh Vân Dị Mạch.” **Gợi ý:** “Tầng boss Trúc Cơ có nhiều đối tượng chiến đấu; nhiệm vụ chỉ hoàn thành khi toàn bộ ải kết thúc thắng lợi.” **Kết nhiệm vụ:** “Linh Lang Vương đổ xuống. Dưới chân nó là một phong ấn ngũ hành đã vỡ, trong đó một dòng linh khí chạy ngược vào lòng đất. Dã Trư bị kích động, Sơn Tặc đào mạch, Linh Lang bảo vệ khe nứt — tất cả chỉ là những hệ quả của cùng một Dị Mạch. Ngươi tạm giữ được Thanh Vân, nhưng chưa thể giải trừ căn nguyên.” **CTA:** “Khiêu chiến Thanh Vân 1-30”; ready: “Lĩnh thưởng — Khép lại Hồi III”.

## Hợp đồng cơ chế

- **Mục tiêu chuẩn:** `condition:{kind:'stage_clear',stageId:'foundation_floor_10',amount:1}` theo PR-Q2. Nếu source stage nomenclature là 1-30 trên UI thì phải map chính xác sang `foundation_floor_10`; không tạo stage id ảo. Hạ **một** `foundation_ferocious_spirit_wolf` trong trận chưa chứng minh đã thắng cả boss floor.
- `once/mainline`, Q11 claim gate, required Foundation. Clear trước activation có thể được công nhận từ `completedStageIds` tại reconcile, nhưng **không tự claim**. Save đã hoàn thành quest không lặp reward/cutscene mỗi login.
- Thưởng **gốc** `{spiritStone:80,skillInsight:8000}` ⇒ **4.000 Linh Thạch + 8.000 lĩnh ngộ**. Không cultivation/item. Khoản reward này là chốt đề xuất của concept 12 quest, cần mô phỏng với chi phí Trúc Cơ; không tự nhân insight ×50.
- **Outro thuộc presentation:** chỉ play sau `claimQuest` thành công và receipt completed-once được save, không chạy từ sự kiện boss chết. Có Skip/Replay từ nhật ký nếu muốn, nhưng replay không bao giờ gọi reward thêm. Nếu animation/lời thoại không tải được, quest vẫn hoàn thành, tiền thưởng không bị rollback vô lý.

## Storyboard kết Beta (đề xuất, chưa có runtime)

1. **0–3s**: Linh Lang Vương ngã xuống, vệt hỏa rút về khe mạch; âm gió lạnh thay tiếng gầm.
2. **3–7s**: camera chuyển sang vết phong ấn ngũ sắc dưới Cổ Mộc Đàm; một dòng đỏ di chuyển ngược các dòng khác. VFX chỉ minh họa, không trao vật phẩm/đổi state.
3. **7–11s**: ba hình ảnh hồi tưởng nhanh — mộc đỏ, quặng dị sắc, sổ Sơn Tặc — lần lượt hòa vào ngũ hành ấn.
4. **11–15s**: chữ kể chuyện: “Thanh Vân đã tạm yên. Nhưng sâu dưới lòng đất, Dị Mạch vẫn chảy ngược…” rồi hiện “HẾT HỒI III — BETA”. Có nút **Bỏ qua** và **Đóng**, bản tiếng Việt qua i18n gateway.
5. **Âm thanh:** nền gió đèo thấp, một hit trầm khi phong ấn lộ ra, tiếng ngân mảnh cuối cảnh. Chỉ đạo âm thanh đề xuất, phải chọn/audition asset; không phát âm thanh lặp khi người chơi reconnect.

## Plan riêng / nghiệm thu

1. Gắn Q12 với stage id thật, claim reward, terminal marker hoàn thành chain. Không mở realm Kim Đan và không sinh daily mới sau khi thắng.
2. Cài read-model `endingEligible = quest completion receipt` (hoặc state tương đương của owner) để UI quyết định phát 1 lần theo lifecycle riêng; replay nội dung không tái award.
3. Test: thua/bỏ dở stage 1-30 không hoàn thành; hạ boss đơn vị nhưng thua cả stage không hoàn thành; stage completed trước quest active→ready sau reconcile; lần đầu thắng→claim +4000/+8000; claim 2 lần, save/reopen không nhân đôi; mất asset/skipped outro không ảnh hưởng save; status `COMPLETED` đúng.
4. E2E: đi từ thắng `foundation_floor_10` tới Quest UI, nhận thưởng, xem/skip outro, reload, xác nhận 12/12 claim và không xuất hiện nhiệm vụ chính tuyến mới. Kiểm tra accessibility và tỉ lệ 1672×941/1280×720.

**Lời kết:** “Ngũ khí tương sinh, nhất mạch tương nghịch.” Đây là móc nối cho chương sau Beta; **không** tự tạo nội dung Kim Đan chưa nằm trong phạm vi.
