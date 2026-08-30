# Nhật Kí Worktree — Pháp Tu Đạo Sắc

> **Mục đích file này:** ghi lại MỌI thay đổi thực hiện trong worktree — việc gì, lí do, mục đích — để chủ sở hữu có thể review, cherry-pick từng commit, hoặc xử lí conflict khi merge/integrate về sau.
> **Cập nhật sau MỖI task hoàn thành** (controller append, không phải implementer).
> Ngày bắt đầu: 2026-08-30.

## 1. Thông tin worktree

| Mục | Giá trị |
|---|---|
| Worktree | `E:\tutienidle\.agent-worktrees\phap-tu-dao-sac` |
| Branch | `agent/phap-tu-dao-sac` |
| Base | `master` (worktree tạo từ master ngày 2026-08-30) |
| Spec (nguồn sự thật) | `game/docs/superpowers/specs/2026-08-30-phap-tu-dao-sac-design.md` |
| Plan | `game/docs/superpowers/plans/2026-08-30-phap-tu-dao-sac.md` (17 task) |
| Quy trình | superpowers:subagent-driven-development — mỗi task 1 implementer subagent + 1 reviewer; ledger nội bộ tại `.superpowers/sdd/2026-08-30-phap-tu-dao-sac/progress.md` |

## 2. Mục đích tổng thể — tại sao worktree này tồn tại

Thực thi spec **Pháp Tu Đạo Sắc** (đã duyệt qua brainstorming với user, Sections 1–5):

1. **Chốt đạo vĩnh viễn ở Trúc Cơ** — Thuần (1 hành duy nhất) hoặc Đa Pháp; hoàn trả Ngộ Tính các hành bỏ; không pha trộn.
2. **Thuần hệ** = chuỗi combo auto A→B→C→D→E theo thần thoại Sơn Hải Kinh (Chúc Dung-Hỏa, Thiên Ngô-Thủy, Câu Mang-Mộc, Nhục Thu-Kim, Hậu Thổ-Thổ); mỗi link tích **Thế** (+10, E +20, trần 100, xuyên kill); Thế đầy mở **Ultimate** nhánh (nút manual + auto-AI ưu tiên boss).
3. **Đa Pháp** = reaction là gốc rễ (giữ nguyên) + **Tương Sinh "Luân Chuyển"** (kề sinh → giảm 10% cd skill trước; vòng sinh đủ → buff +3% cast speed/tầng, trần 10) + **Tương Khắc "Chế Khắc"** (kề khắc → +25% dmg + reaction cặp đó +15% reactionEffect).
4. **Bảng reaction hoàn chỉnh 10 cặp** (5 sinh + 5 khắc khớp ngôi sao 5 cánh) — thêm 2 reaction sinh mới **Ngưng Lộ** (Kim+Thủy, buff hồi Pháp Lực) + **Khai Sơn** (Thổ+Kim, buff armor stack).
5. **Thiên phú Pháp Lực Thân Hòa** — MP đổi tên Pháp Lực (chỉ Pháp Tu), manaScaling ×1.5, manaShield 0.25→0.30.
6. **BỎ Phong/Lôi toàn hệ** — ElementType, 6 stats, affixes, ailment mồ côi `te_dien`, reaction chết Lôi Viêm, comment.
7. **Slot mở theo realm**: Phàm Nhân 1, Luyện Khí/Trúc Cơ 2, Kim Đan/Nguyên Anh 3, Hóa Thần→Đại Thừa 4, Độ Kiếp 5.
8. **UI**: Node Tree ngôi sao 5 cánh (đỉnh = phương vị thần, cạnh ngoài = sinh, chéo = khắc), modal chốt đạo, bar Thế, nút ult.

Isolation theo quy tắc AGENTS.md: mọi file-changing task trong worktree + branch riêng, không đụng main worktree.

## 3. Bảng commits — cherry-pick THEO THỨ TỰ

| # | Commit | Task | Nội dung | Phạm vi file |
|---|---|---|---|---|
| 1 | `741600f` | docs | Spec design doc (11 sections, đã duyệt từng section với user) | `game/docs/superpowers/specs/2026-08-30-phap-tu-dao-sac-design.md` |
| 2 | `5641689` | docs | Implementation plan 17 task (TDD, bite-sized) | `game/docs/superpowers/plans/2026-08-30-phap-tu-dao-sac.md` |
| 3 | `51d0215` | T1 | Bỏ Phong/Lôi khỏi type system + stats + affixes + vfx | 12 file (chi tiết §4) |
| 4 | `6dc36c7` | T2 | Xoá ailment `te_dien` + reaction Lôi Viêm + rework fixture phanPhac sang Bốc Hơi | 6 file (chi tiết §4) |

*(bảng cập nhật sau mỗi task)*

## 4. Chi tiết từng thay đổi

### Commit `741600f` + `5641689` — Spec & Plan (docs-only, an toàn cherry-pick riêng lẻ)

- Spec sinh ra từ ~15 vòng hỏi/đáp brainstorming với user; mọi quyết định lớn đều do user duyệt (Sections 1–5).
- Plan decompose spec thành 17 task TDD; Global Constraints: không `any`, không dependency mới, save v54→55, id snake_case không dấu, comment tiếng Việt.

### Task 1 — Bỏ Phong/Lôi khỏi type system (commit `51d0215`)

**Việc đã làm:**
- `ElementType` còn đúng 5 giá trị: `wood | fire | earth | metal | water`; `ELEMENT_ORDER` 5 phần tử.
- Xoá 6 stat: `windPower/windResistance/windPenetration` + `lightningPower/lightningResistance/lightningPenetration` khỏi `StatBlock.ts` (createBaseStats), `StatLabels.ts`, `StatCalculator.ts` (element-stat map), `EnemyStatInput.ts` (input + boss resistance bonus).
- Xoá affix group Phong/Lôi khỏi `data/equipment/affixes.ts` + `EquipmentStatPolicy.ts` (compile fix đi kèm — stat keys không còn tồn tại).
- Xoá case vfx `'wind'`/`'lightning'` trong `CombatAction.ts` (switch còn `default` nguyên vẹn).
- Xoá block test wind/lightning trong `ElementDamageCalculator.test.ts`.
- Sửa comment cũ trong `SaveSystem.ts` (chỉ comment, không logic).
- Thêm test `ElementType.test.ts` (assert 5 hành + `@ts-expect-error` chứng minh 'wind' không còn hợp lệ).

**Lí do (spec §5):** Phong/Lôi chỉ là nền móng type trống — 0 skill, 0 node, 0 reaction từng tồn tại (mọi comment trong code xác nhận "hoãn vì chưa có skill"); affix Phong/Lôi là stat chết gây rối cho người chơi. Identity mới của Pháp Tu là vòng sinh/khắc Ngũ Hành — Phong/Lôi không có chỗ trong vòng đó, giữ lại = nợ content cho thiết kế lơ lửng.

**Kiểm chứng:** type-check PASS, build PASS, test 1412/1413 — 1 fail `InkWashPrimitives.test.ts` là fail TRƯỚC KHI branch tồn tại (verify bằng stash trên base sạch, ngoài phạm vi task — hiện trạng main worktree đang có thay đổi chưa commit ở `InkNineSlice.vue`/`theme.css`, không liên quan branch này).

**Ghi chú cherry-pick / conflict:**
- KHÔNG đụng `theme.css`, `InkNineSlice.*` (những file main worktree đang sửa dở).
- `TribulationChapters.ts` + `TribulationData.test.ts` dùng `'lightning'` là **TribulationChapterKind** (chương kiếp của hệ Đột Phá) — hệ riêng, GIỮ NGUYÊN, đừng nhầm khi conflict-resolve.
- `khiem_phong` (skill Kiếm Tu) là tên riêng, KHÔNG phải element wind — giữ nguyên.

### Task 2 — Xoá te_dien + Lôi Viêm (commit `6dc36c7`)

**Việc đã làm:**
- `AilmentTypes.ts`: xoá `| 'te_dien'` khỏi union `AilmentId` + dọn comment nhắc "marker cho Reaction tương lai của Phong/Lôi" (R5 — cùng chủ đề, cùng file).
- `data/ailment/ailments.ts`: xoá template Tê Điện (id te_dien) — để lại comment ghi chú sự xóa theo convention.
- `ElementReaction.ts`: xoá entry `te_dien: { name: 'Lôi Viêm', baseDamage: 70, ... }` khỏi `bong`; thay 3 block comment Phong/Lôi (Đông Lôi/Thủy Lôi/Độc Phong/Mù/Lôi Huyết) bằng ghi chú ngắn "Phong/Lôi đã bỏ toàn hệ (spec §5), không bao giờ mở lại" — giữ lại các comment về reaction SỐNG (Độc Thủy, Độc Thế, Huyết Độc, Định Thổ).
- `ReactionManager.phanPhac.test.ts`: fixture `bong+te_dien` (Lôi Viêm 75/150 dmg) → `bong+te_cong` (Bốc Hơi 65/130 dmg = 60 + attack 10 × ratio 0.5). Độ phủ cơ chế keepChance (thiên phú Phản Phác) giữ nguyên 6 case. Chú ý: Bốc Hơi có `keepsAilmentId: 'te_cong'` nhưng source fixture không có `waterReactionExtensionSeconds` nên nhánh consume chuẩn vẫn được test đúng.
- `ReactionManager.test.ts`: xoá block test "Thủy + Kim (Tê Điện) KHÔNG còn phản ứng" (vô nghĩa khi te_dien không tồn tại) — để lại comment ghi chú.
- `Skills.ts` comment (dòng ~438): cập nhật "te_dien giờ mồ côi" → "đã xoá sạch theo spec §5".

**Lí do (spec §5):** te_dien là ailment mồ côi — skill Kim cũ áp nó đã bị xoá từ đợt redesign trước (comment cũ tự thừa nhận), reaction Lôi Viêm không bao giờ trigger thật trong gameplay. Test phanPhac đang test một reaction chết — rework fixture sang cặp sống giữ nguyên độ phủ cơ chế.

**Kiểm chứng:** 3 file test element 26/26 pass; type-check PASS; full suite 1411/1412 (chỉ InkWashPrimitives pre-existing fail — như Task 1).

**Ghi chú cherry-pick / conflict:**
- Bảng reaction giờ còn 8 cặp sống — Task 3 (commit kế tiếp) sẽ thêm `relation` metadata cho cả 8 + 2 reaction mới Ngưng Lộ/Khai Sơn → tổng 10. Nếu cherry-pick Task 3 mà KHÔNG lấy Task 2, `relation.test` sẽ fail vì thiếu entry — **lấy Task 2 và Task 3 cùng cụm**.
- File `Skills.ts` chứa nhiều comment mojibake (encoding hỏng từ trước, hiện trạng repo) — comment block Kim Tu được viết lại ASCII-an toàn, phần còn lại của file không đụng.


## 5. Rulings / quyết định controller (mọi quyết định nằm ở đây)

| # | Ruling | Lí do | Chi phí nếu sai |
|---|---|---|---|
| R1 | `TribulationChapters.ts` 'lightning' KHÔNG thuộc phạm vi bỏ Phong/Lôi | Là chapter kind của hệ Đột Phá, không phải ElementType (spec §5 mục 7) | Không |
| R2 | Task 1 đụng thêm `EquipmentStatPolicy.ts` + `ElementLabels.ts` (ngoài danh sách brief) | `satisfies readonly StatType[]` + `Record<ElementType,…>` bắt buộc compile-level; reviewer xác nhận an toàn | Không |
| R3 | Minor findings của Task 1 review (dead import `ElementDamageCalculator.test.ts:2`; orphan CSS/presets/comments Phong-Lôi: `theme.css` vars `--el-wind/--el-lightning`, `CombatVfxPresets.ts` `wind_blade/lightning_strike`, CSS chips `CharacterPanel.vue`, comments `ProgressionNode.ts:44-46`) — route vào **Task 17** (mở rộng scope: docs sync + final cleanup), không vào fix-loop | Dead code cosmetic, 0 tác động gameplay; gom 1 đợt dọn cuối rẻ hơn từng đợt | Task 17 phải nhớ dọn — đã ghi ledger |
| R4 | Nhãn "Task 2 candidates" trong report Task 1 là SAI — Task 2 chỉ sở hữu te_dien/Lôi Viêm/comment trong `ElementReaction.ts` + `AilmentTypes.ts` | Tránh Task 2 làm loãng scope | Không |
| R5 | Trong lúc Task 2 sửa `AilmentTypes.ts` (xoá dòng 'te_dien') thì dọn LUÔN stale comment Phong/Lôi cùng file (~dòng 11-12) — mở rộng scope nhỏ, tự nhiên | File đã mở, 2 dòng comment cùng chủ đề; tránh để Task 17 quay lại file lần nữa | Không |

## 6. Tàn dư đã biết (deferred — không chặn)

- [→ Task 17] Dead import `calculateElementDamage` trong `ElementDamageCalculator.test.ts:2`.
- [→ Task 17] `theme.css`: biến `--el-wind`/`--el-lightning`; CSS `.element-chip--wind/--lightning` trong `CharacterPanel.vue` (chips chạy theo `ELEMENT_ORDER` nên đã unreachable).
- [→ Task 17] `CombatVfxPresets.ts` preset id `wind_blade`/`lightning_strike` + test ảnh hưởng; comments Phong/Lôi `ProgressionNode.ts:44-46`.
- [hiện trạng repo, không phải branch này] `InkWashPrimitives.test.ts` fail 1 case từ trước; main worktree có thay đổi CHƯA COMMIT: `game/src/assets/theme.css`, `InkNineSlice.vue`, `InkNineSlice.test.ts` — **nguy cơ conflict cao nhất khi integrate là Task 16 (UI) chạm `theme.css`/component chung**.

## 7. Trạng thái

- Task 2/17 ✅ (commit `6dc36c7`).
- Tiếp theo: Task 3 — relation metadata + 2 reaction mới Ngưng Lộ/Khai Sơn + 2 buff.
- Cập nhật file này sau mỗi task hoàn thành.
