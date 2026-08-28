# Roadmap Phát Triển — Tiên Hiệp Idle

> Tài liệu định hướng tổng hợp, lập ngày 2026-08-27 sau đợt rà soát toàn diện 5 mảng: Chiến đấu, Tiến trình, Kinh tế, UI/UX, Kỹ thuật & Nội dung.
> Mỗi hạng mục lớn có plan chi tiết riêng (dẫn link bên dưới). Khi plan và roadmap lệch nhau, plan chi tiết là nguồn sự thật cho hạng mục đó.

## 1. Nhận định hiện trạng

**Điểm mạnh cần giữ:**

- Kiến trúc sạch: Vue 3 (UI) + Phaser (canvas) + Pinia, core/data tách biệt, data-driven nhất quán.
- Pipeline damage duy nhất, test phủ dày ở combat (~30 file battle/combat/skill, tổng 154 file test).
- Vòng lặp tu luyện → Độ Kiếp → chọn đường đã có cá tính riêng.
- Kinh tế có file balance tách riêng, giao dịch atomic chống nhân bản.

**Vấn đề lớn nhất, theo thứ tự rủi ro:**

1. **Tường nội dung Trúc Cơ**: hết nội dung thật ở Trúc Cơ tầng 18 (~34 giờ chơi); stage Trúc Cơ là bản clone của Luyện Khí (`data/stage/Stages.ts:357`); không có Kim Đan (`GameManager.ts:1439` trả `false` cứng).
2. **Thiên phú trang trí** *(đã giải quyết 2026-08-28 — [talent-direction-choice-plan.md](./talent-direction-choice-plan.md))*: cũ — 11/13 thiên phú có `effects: []` rỗng; nay thiên phú là quyết định chọn hướng Đạo duy nhất (roll 9 chọn 1, 12 talent có effect thật).
3. **Thiếu âm thanh hoàn toàn**: 0 file audio trong project; 1.137 spritesheet VFX không được tham chiếu.
4. **Bug và drop chết trong kinh tế**: mapping Tinh Hoa sai cho realm 4+ (`RefinementBalance.ts:74-81`); vật liệu legacy vẫn rơi nhưng không còn sink.
5. **Save không validate shape**: chỉ kiểm tra version, tiền lệ crash boot v47 có thể tái diễn.
6. **Tài liệu lệch code**: `game-guide.md` và `item-design-reference.md` mô tả hệ thống đã xóa.
7. **Nợ kỹ thuật**: `GameManager.ts` 2.703 dòng; nhiều hệ thống core 0 test; 1 spec E2E; không có lint.

## 2. Nguyên tắc ưu tiên

- **Giữ chân trước, làm đẹp sau**: nội dung và vòng lặp progression quan trọng hơn juice.
- **Sửa bug hiện hữu trước khi thêm tính năng mới.**
- **Mỗi phase phải để lại bản build chơi được**, không có nhánh dở dang kéo dài.
- **Tài liệu cập nhật cùng code** — không dồn nợ tài liệu.
- Dự án đang trong development phase: không cần migration save (theo AGENTS.md).

## 3. Các phase

### Phase 0 — Sửa lỗi & Ổn định nền tảng

Mục tiêu: loại bug hiện hữu và nợ tài liệu trước khi xây tiếp.

| Hạng mục | Plan |
|---|---|
| Validate shape save khi load/import (chặn crash kiểu v47) | [save-shape-validation-plan.md](./save-shape-validation-plan.md) |
| Sửa bug Tinh Hoa realm 4+, dọn drop legacy, sửa curve Linh Tuyền | [economy-fixes-sinks-plan.md](./economy-fixes-sinks-plan.md) |
| Đồng bộ `game-guide.md`, `item-design-reference.md` với code | [docs-sync-audit-plan.md](./docs-sync-audit-plan.md) |
| Sửa HUD `out_of_range` đọc sai strategy (nằm trong combat pass) | [combat-balance-pass-plan.md](./combat-balance-pass-plan.md) |

Tiêu chí hoàn thành: không còn bug kinh tế đã biết; save hỏng được phát hiện có chủ đích thay vì crash; tài liệu khớp code.

### Phase 1 — Giữ chân người chơi

Mục tiêu: phá tường nội dung Trúc Cơ và biến thiên phú thành quyết định build thật.

| Hạng mục | Plan |
|---|---|
| Thiên phú chọn hướng Đạo (roll 9 chọn 1) + easter egg Phàm Cốt | [talent-direction-choice-plan.md](./talent-direction-choice-plan.md) |
| Nội dung Trúc Cơ thật + pass Kim Đan tối thiểu | [truc-co-kim-dan-content-plan.md](./truc-co-kim-dan-content-plan.md) |
| Bật mana cost, reaction scale theo Power, đa dạng nhịp skill | [combat-balance-pass-plan.md](./combat-balance-pass-plan.md) |

Tiêu chí hoàn thành: người chơi có mục tiêu theo đuổi tới Kim Đan; thiên phú đã chọn tạo khác biệt đo được; combat có quyết định tài nguyên.

### Phase 2 — Game feel & Khám phá

Mục tiêu: game "có hồn" và dễ khám phá hơn.

| Hạng mục | Plan |
|---|---|
| Âm thanh tối thiểu + hit-stop + mở rộng screen shake | [audio-game-feel-plan.md](./audio-game-feel-plan.md) |
| Nameplate công trình, tách CombatScene, dọn placeholder/emoji | [ui-discoverability-refactor-plan.md](./ui-discoverability-refactor-plan.md) |

Tiêu chí hoàn thành: có âm thanh cho các khoảnh khắc chính; hotspot công trình tự giải thích không cần tooltip; CombatScene không còn là god-class.

### Phase 3 — Chiều sâu hệ thống

Mục tiêu: mở rộng các trục progression đang bỏ hoang.

| Hạng mục | Plan |
|---|---|
| Kiến Cơ 4 bậc, node tree Kiếm Tu, chiều sâu idle (Cảm Ngộ offline, nguồn tăng tốc tu luyện) | [progression-depth-plan.md](./progression-depth-plan.md) |
| Sink Linh Thạch hậu kỳ, vendor, Điểm Rèn, filter túi đồ | [economy-fixes-sinks-plan.md](./economy-fixes-sinks-plan.md) (phần Trung bình) |

Tiêu chí hoàn thành: gate đột phá có chất lượng khác nhau; Kiếm Tu có chiều sâu build tương đương Pháp Tu; idle có đường nâng cấp.

### Phase 4 — Bền vững kỹ thuật (chạy song song, không chặn phase khác)

| Hạng mục | Plan |
|---|---|
| Tách dần GameManager, phủ test hệ kinh tế, thêm E2E + lint | [tech-debt-test-coverage-plan.md](./tech-debt-test-coverage-plan.md) |
| Cloud save / online (plan riêng đã có) | [online-login-cloud-save-plan.md](./online-login-cloud-save-plan.md) |

Tiêu chí hoàn thành: không file nào quá ~1.000 dòng trong core/game; mọi hệ thống core có test; luồng boot → tạo nhân vật → combat có E2E.

## 4. Phụ thuộc giữa các plan

```
Phase 0:  save-validation ─┐
          economy-fixes  ──┼─► Phase 1: talent-direction (độc lập)
          docs-sync      ──┘    truc-co-kim-dan (cần economy A1 — mapping Tinh Hoa — xong trước M2/M3)
                                combat-balance (độc lập, nên sau docs-sync để cập nhật guide một lần)
Phase 2:  audio-game-feel, ui-refactor — độc lập, chạy song song Phase 1
Phase 3:  progression-depth — cần truc-co-kim-dan M2 xong (để nối Kiến Cơ vào gate Kim Đan thật)
Phase 4:  tech-debt — chạy nền liên tục
```

- `docs-sync-audit` nên hoàn thành sớm để mọi plan sau tham chiếu tài liệu đúng.
- `truc-co-kim-dan-content` là plan lớn nhất; có thể cắt theo milestone (M1: nội dung Trúc Cơ, M2: gate Kim Đan, M3: realm passive + node).
- Cloud save chỉ nên đóng băng schema save sau khi Phase 0 (validation) xong.

## 5. Ngoài phạm vi roadmap này

- **Phù/Trận Pháp**: đã có roadmap hậu kỳ riêng (`future-talisman-formation-system-plan.md`), giữ khóa.
- **Bàn cờ vây 19×19**: hướng rework đã ghi trong `game-guide.md`, chưa đưa vào roadmap hiện tại — cần quyết định riêng trước khi lập plan.
- **Server roll thiên phú / xác minh backend**: thuộc plan online (`online-login-cloud-save-plan.md`); plan thiên phú trong roadmap này chỉ làm phần effect client-side.
- **Thể Tu**: plumbing combat đã có nhưng chưa đủ nội dung phát hành; được ghi nhận như lựa chọn mở rộng trong `progression-depth-plan.md`, không cam kết mốc.
- **World map**: `src/core/world-map/` mới có hạ tầng (hex layout, validator), chưa có dữ liệu bản đồ thật. Chờ nội dung Kim Đan ổn định (truc-co-kim-dan M3) rồi mới quyết định Thanh Vân có chuyển sang biểu diễn world-map hay giữ stage list.
- **Tutorial động**: tutorial hiện là carousel 9 bước thuần thông tin (`src/data/tutorial/tutorialSteps.ts`). Việc instrument theo dõi hành động thật của người chơi mới chỉ ghi nhận, chưa lập plan.

## 6. Quy trình thực hiện

1. Mỗi plan được thực hiện bởi một phiên agent riêng (theo Context policy trong PROJECT_CONTEXT.md).
2. Trước khi chạy plan: đọc plan + các file được dẫn trong plan.
3. Sau mỗi plan: chạy `npm.cmd run test`, `npm.cmd run type-check`, `npm.cmd run build` từ `game/`.
4. Khi đổi hành vi, cập nhật tài liệu sống trong `docs/` cùng thay đổi code.
5. Không tạo thêm plan không có đuôi `.md`.
