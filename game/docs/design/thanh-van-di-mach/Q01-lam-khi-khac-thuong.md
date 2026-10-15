# Q01 — Lâm Khí Khác Thường

**Định vị:** Hồi I, mở tuyến Phàm Nhân, giới thiệu nguồn sản xuất ở Thanh Vân. **Ưu tiên:** P0, tutorial đầu tiên. **ID đề xuất:** `tvdm_01` (ID mới, không ghi đè old `main_01_da_san_dau_tien`). **Trạng thái:** đề xuất, chưa chạy.

## Cốt truyện và copy người chơi

**Mở:** “Những thân cổ mộc ven Thanh Vân Lâm gần đây xuất hiện những đường vân đỏ như than âm ỉ. Người khai sơn bảo rằng gỗ mới đốn còn giữ hơi nóng trong thớ, dù sương sớm vẫn phủ kín rừng. Hãy mang về một ít để kiểm tra xem linh mạch có đổi khác hay không.”

**Tên trên bảng:** Lâm Khí Khác Thường. **Mô tả ngắn:** “Thu thêm **2 Thập Niên Linh Mộc Phàm Nhân** từ nguồn thu thập sau khi tiếp nhận nhiệm vụ, rồi đem về nộp để xét dấu vết dị hỏa.” **Chỉ dẫn:** “Đến **Sản Xuất → Thanh Vân Lâm**, thu hoạch gỗ mới. Gỗ có sẵn trong túi từ đầu game không tính tiến độ.” **Khi hoàn thành:** “Vân gỗ mang nhiệt khí dị thường. Một luồng hỏa âm ỉ đang len qua đất rừng; dấu chân thú dữ xuất hiện quanh bìa rừng.” **CTA:** “Đến Sản Xuất”; khi đủ progress: “Nộp 2 Linh Mộc và nhận thưởng”. **Khi thiếu hàng lúc claim:** “Bạn đã thu đủ gỗ cho nhiệm vụ nhưng hiện không giữ đủ 2 Linh Mộc để nộp. Hãy thu thêm gỗ.”

## Hợp đồng cơ chế

- `cadence: once`, `chainId: mainline`, head của chain, không `requiredRealmId`, không predecessor. `condition: { kind:'collect', materialId:'mortal_wood_decade', amount:2 }` — **đã hỗ trợ**.
- Activation xảy ra khi tạo nhân vật / reconcile restore, không phụ thuộc mở bảng. `onMaterialCollected` chỉ tính lượng **mới nhận sau activation**. Starter inventory có **15** gỗ không được hồi tố.
- Đủ 2/2 chỉ cho phép claim nếu MaterialBag vẫn có ít nhất 2; claim trừ **chính xác 2** rồi cấp thưởng qua domain owner và đánh dấu completed. Không cưỡng ép dành riêng vật liệu; những thao tác tiêu gỗ khác vẫn hợp lệ.
- **Thưởng cấu hình gốc:** `{spiritStone:15,cultivation:20}`. **Thưởng hiển thị và thực trao:** **15 Linh Thạch + 20 tu vi** (Phàm ×1). Không vật phẩm, không insight. **Mục đích kinh tế:** giúp người chơi thấy giá trị nhận thưởng và củng cố loop thu thập.
- **Nút thắt nguồn:** kiểm tra cơ chế unlock, workers và thời gian sinh `mortal_wood_decade` thực tế ở nhân vật mới; nếu không tạo được ít nhất 2 gỗ sớm, phải sửa nguồn/UX trước khi chọn Q01 là cửa đầu.

## Plan riêng / nghiệm thu

1. Data: thêm entry Q01 vào catalog mới, head duy nhất; validate material ID và base reward.
2. Domain: tái dùng collect + claim turn-in; không cần condition mới. UI: progress `0/2`→`2/2`, hiển thị “nộp 2”; CTA chỉ chuyển tới Production nếu router có điểm đến thật.
3. Test: create nhân vật có 15 gỗ và Q01 `0/2`; nhận thêm 1→`1/2`, thêm 1→`2/2`; tiêu gỗ xuống còn 1 thì claim trả lỗi và không trừ/thưởng; bù lại đủ 2 claim trừ 2, nhận +15/+20; claim lặp không cộng. Restore giữa `1/2` giữ nguyên và không kích hoạt trùng.
4. Runtime: chạy walkthrough nhân vật mới **không từng mở Quest UI**, sau đó mở bảng, đối chiếu tiến độ và khả năng sản xuất; đo thời gian thực đến gỗ thứ hai. Không đạt nguồn gỗ sớm = **BLOCKER Q01**.

**Dẫn truyện:** sau khi claim, mở Q02; gỗ đỏ liên hệ vết móng của Dã Trư. Không phát thưởng/tiến độ trong cutscene.
