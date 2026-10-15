# Q09 — Trảm Sơn Tặc Vương

**Định vị:** Hồi II / Luyện Khí, boss + cột mốc đột phá Trúc Cơ. **ID:** `tvdm_09`; **predecessor:** Q08; **realm gate:** `qi_refining`; **dependency:** `stage_clear`.

## Cốt truyện và copy

**Mở:** “Sơn Tặc Vương cho đào một đường hầm xuyên qua linh mạch. Trong doanh trại là những kiện linh khoáng cháy sém, bản vẽ một ấn ngũ hành và lời dặn ‘khai mạch trước trăng non’. Nếu để hắn hoàn thành, cả hậu sơn sẽ bị xé tung.”

**Tên:** Trảm Sơn Tặc Vương. **Mô tả:** “Chinh phục **Thanh Vân 1-20**, quét sạch Sơn Tặc Vương và bảo vệ lối vào hậu sơn.” **Gợi ý:** “Chuẩn bị đạt Luyện Khí tầng 12 và vượt ải 1-20 nếu muốn tiếp tục đột phá Trúc Cơ. Hoàn thành nhiệm vụ **không tự độ kiếp**.” **Kết:** “Trại tan, nhưng hầm đào đã động đến mạch cổ. Bản vẽ hiện năm vệt khí, chỉ có một vệt đỏ đang chảy ngược. Tiếng Linh Lang từ hậu sơn vọng xuống như một lời cảnh báo.” **CTA:** “Khiêu chiến Thanh Vân 1-20”; ready: “Nhận thưởng và chuẩn bị độ kiếp”.

## Hợp đồng cơ chế

- **Mục tiêu chuẩn:** `stage_clear {stageId:'qi_refining_abyssal_pool',amount:1}` — cơ chế mới ở PR-Q2. Bản combat kill hiện tại chỉ có `ferocious_bandit` và có thể gặp nhiều instance cùng ID nên **kill 1** không đủ để bảo đảm clear stage. Nếu fallback kill 1, copy phải hạ xuống “đánh bại một Sơn Tặc Vương”, không dùng nó làm bằng chứng vượt ải.
- Stage `qi_refining_abyssal_pool` là **điều kiện thật** để hệ Cảnh Giới cho tiến lên Trúc Cơ cùng với Luyện Khí lv12. Stage witness dùng completed stage, claim quest không phát lệnh đột phá. Stage đã clear trước khi Q09 active được reconciled ở quest activation để không softlock.
- `once/mainline`, `requiredRealmId:'qi_refining'`, after Q08. **Thưởng gốc** `{spiritStone:60,skillInsight:1200}` ⇒ **480 Linh Thạch + 1.200 lĩnh ngộ**. Không cultivation/item.
- Chỉ mở Q10 nếu Q09 **đã claim** và nhân vật đã **đột phá thật đến `foundation_establishment`**; không tạo event nhân vật lên realm từ một animation chém boss.

## Plan riêng / nghiệm thu

1. Validate stages `qi_refining_abyssal_pool`, realm gate hiện có; gắn `stage_clear` sau khi engine PR-Q2 cung cấp typed condition.
2. UI hiển thị stage 1-20 và hai trạng thái: “đã vượt ải/chưa đủ điều kiện độ kiếp” và “có thể nhận thưởng”, với CTA liên hệ Cảnh Giới sau claim.
3. Test boss enemy chết ở stage bị thua→`0/1`; stage win→`1/1`; completed earlier and Q09 only now active→reconcile sets claimable; ải win repeated no double grant; Luyện Khí <12 không được lên Trúc Cơ; Qi12 nhưng chưa clear 1-20 cũng không được.
4. E2E qua combat thật và hệ đột phá, kiểm `completedStageIds` đúng, quest claim +480/+1200, chuyển Foundation sau nghi thức được hệ realm xác nhận.

**Dẫn truyện:** sau khi độ kiếp thành công, linh mạch lộ ra ở vùng Trúc Cơ, mở Q10.
