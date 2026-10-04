# Chiến Thắng — preview UI

Preview `/ui-victory.html`, canvas 1440×810 giữ tỷ lệ. G0/G1: đã đọc ảnh mẫu scene14, art request và scaffold Victory; phạm vi chỉ presentation với fixture. Không dùng `useVictorySceneModel` hoặc BattleRewardSummary trong preview, không sửa GameManager, progression, inventory hoặc save.

Các phần đã dựng: tiêu đề Thắng bằng art riêng, nhãn trận chiến và caption; khung giấy9-slice với reward slots, ba thẻ tăng trưởng; nút Thử Lại/Tiếp Tục và notice cố định. Background combat hiện có lấy qua catalog ThanhVan được hiển thị tĩnh sau lớp dim overlay; không tạo hoặc sửa background/parallax. Không gen entity, item icon hoặc thuốc. Item icon dùng asset hiện có; linh thạch dùng motif ngọc tạm thời của UI.

Điểm nối sau:
- UI-65 `VictoryFidelityScene`: model (stage/caption/rewards/growth), notice; emit retry()/continue(). Không nhận thưởng khi mount hoặc click.
- UI-66 `VictoryFidelityRewards`: reward display id/name/amount/icon/motif/tone; số lượng động, overflow nội bộ; amount là chuỗi đã format.
- UI-67 `VictoryFidelityGrowth`: growth id/label/value/detail/icon/progress/tone do host cung cấp; không tính tiến độ hay cấp.
- UI-68 `VictoryPreview`: fixture độc lập. Khi tích hợp dùng kết quả đã resolve từ owner battle/reward; gắn command retry/continue, tránh UI tự phát reward hoặc quyết định auto-countdown.

## Art

Built-in ImageGen, transparent background=true. Output gốc: `C:\Users\hnkm0\.codex\generated_images\01a0f7b5-053f-71d0-a72c-75577519a956\exec-520bedd5-2f92-418f-84c3-24cbc1c6eec2.png`.

Asset dự án: `public/assets/ui/huyen-kim/scene/victory-v2/victory-title-v1.png` (2172×724). Đã xem ảnh và kiểm tra tiêu đề ghép trên background. Giữ nguyên output gốc, không overwrite asset trước.

Prompt:

```text
Use case: stylized-concept. Create one isolated premium Vietnamese xianxia game victory title asset on genuinely transparent background. Exact single text: "Thắng" (Vietnamese, capital T, h, ắ with breve and acute accent, n, g). Absolutely correct diacritics. Bold sweeping hand-painted brush calligraphy in luminous antique gold, cream-gold highlights, textured gold leaf ink, elegant confident strokes and subtle dark ink bleed directly beneath letters for contrast. Wide horizontal composition centered, word occupies most of width, generous transparent margins around all strokes. A few restrained thin curving golden brush flourishes around the word only, no rectangular card, no background scene, no character, no mountains, no paper, no scroll rollers, no extra text, no rewards, no icons, no watermark. Polished Chinese fantasy game UI treatment but readable Vietnamese Latin lettering, not Chinese characters. Transparent cutout asset, approximately 3:1 landscape visual aspect.
```

Đây là bản duyệt UI, chưa QA gameplay/integration, chưa commit/push/merge.

Kiểm tra: type-check exit0; test retry/continue và reward read-only 1 pass. Edge kiểm tra hai nút, notice không đẩy vị trí actions, growth nằm trong giấy, toàn bộ ảnh load đủ. Đã xem screenshot 1440×810, 1920×1080 và 1000×800; console 0 errors/0 warnings.
