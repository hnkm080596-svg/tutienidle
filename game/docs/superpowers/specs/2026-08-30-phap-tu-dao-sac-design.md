# Design: Pháp Tu Đạo Sắc — Thuần Hệ Chuỗi Thần Thoại & Đa Pháp Sinh Khắc

> Ngày: 2026-08-30 · Trạng thái: ĐÃ DUYỆT qua các vòng hỏi brainstorming (Sections 1–5)
> Phạm vi: chốt đạo Thuần/Đa Pháp vĩnh viễn ở Trúc Cơ, 5 chuỗi combo thần thoại Sơn Hải Kinh, hệ Thế + Ultimate, Đa Pháp sinh/khắc kề nhau, bảng reaction hoàn chỉnh 10 cặp, thiên phú Pháp Lực Thân Hòa, bỏ Phong/Lôi toàn hệ.

## 0. Bản sắc thiết kế (định vị 2 lựa chọn đạo)

- **Thuần Hệ** — dành cho người chơi cam kết 1 đạo: chuỗi combo auto A→B→C→D→E của 1 hành (dựa trên thần thoại Sơn Hải Kinh), tích Thế xuyên kill, Thế đầy mở Ultimate nhánh. "Lấy một đạo mà đi tới cùng."
- **Đa Pháp** — dành cho người chơi dung hợp: gốc rễ vẫn là REACTION giữa nhiều hành (giữ nguyên, cường hóa), cộng tầng ngôn ngữ build Tương Sinh "Luân Chuyển" / Tương Khắc "Chế Khắc" theo cặp skill kề nhau trong loadout. Thiên phú Pháp Lực Thân Hòa cho cả hai (cấp lúc chọn path).

Quy tắc chung đã chốt:

| # | Quyết định |
|---|---|
| 1 | Thuần hệ = chuỗi combo auto A→B→C→D→E, mỗi hành 1 chuỗi riêng |
| 2 | Slot mở dần theo realm: Luyện Khí 2 → Kim Đan 3 → Hóa Thần 4 → Độ Kiếp 5; skill càng muộn càng mạnh |
| 3 | Chuỗi nuôi Thế; quái chết → chuỗi reset về A |
| 4 | Thế tích xuyên kill; đầy → Ultimate nhánh (nút manual + toggle auto, AI ưu tiên boss) |
| 5 | Chốt đạo ở Trúc Cơ: Thuần (1 hành) hoặc Đa Pháp — vĩnh viễn, KHÔNG pha trộn |
| 6 | Hoàn trả Ngộ Tính toàn bộ cho các hành/node bị khóa khi chốt |
| 7 | Đa Pháp = reaction là gốc rễ + Sinh/Khắc theo cặp kề nhau trong loadout |
| 8 | Bỏ Phong/Lôi toàn hệ (type, stat, affix, ailment mồ côi, reaction chết, comment) |
| 9 | Pháp Lực = MP đổi tên + thổi hồn qua thiên phú Pháp Lực Thân Hòa (không pool mới) |
| 10 | Node Tree vẽ theo ngôi sao 5 cánh ngũ hành (đỉnh = phương vị thần; cạnh ngoài = sinh; đường chéo = khắc) |
| 11 | Tên chuỗi theo thần thoại Sơn Hải Kinh nắm giữ lực lượng (Chúc Dung, Thiên Ngô, Câu Mang, Nhục Thu, Hậu Thổ) |

## 1. Kiến trúc tổng thể

### 1.1 Hai giai đoạn

**Giai đoạn thử (Phàm Nhân chọn path → Trúc Cơ):**
- Giữ nguyên hiện trạng: root hành nào mua bằng Ngộ Tính (`PhapTuNodes.ts` hiện có), tháo/lắp skill tự do, loadout 2 slot.
- Chưa có chuỗi, chưa có Thế — mọi người Luyện Khí như nhau, thử đủ 5 hành.

**Giai đoạn chốt (Trúc Cơ):**
- Node "Lập Đạo" (major, realm gate `foundation_establishment`): chọn **Thuần** (thêm chọn 1 trong 5 hành) HOẶC **Đa Pháp**.
- Khóa vĩnh viễn, không API đổi (tiền lệ `setKiemTuRoute` đã gỡ cho Kiếm Tu).
- Hoàn trả Ngộ Tính toàn bộ node các hành bị bỏ (chọn Thuần) — insight refund ghi qua transaction chuẩn; skill các hành bị bỏ unequip + khóa.
- Chọn **Đa Pháp**: node chuỗi 5 nhánh Thuần ẩn vĩnh viễn; root 5 hành giữ nguyên mở (đó là bản chất đa pháp — reaction cần nhiều hành).
- Chọn **Thuần**: khóa luôn 4 hành còn lại (skill unequip + node refund), chỉ chuỗi hành đã chọn tồn tại; node sinh/khắc + reaction-spec của Đa Pháp ẩn (không reaction liên hành khi chỉ còn 1 hành — reaction tự mất nghĩa).

### 1.2 Cấu trúc nhánh node sau redesign

- **5 nhánh Thuần** (mỗi hành ~15 node): khung `buildBranch` giữ nguyên (Root → Power nền 10 cấp → Cadence → Mechanic), keystone Thuần/Reaction cũ BỎ, thay bằng: node "Lập Đạo — Thuần [hành]" + chuỗi unlock (5 skill) + node chuyên sâu Thế (gain/trần/hiệu ứng E) + node biến thể chuỗi (C/D có 2 biến thể chọn 1).
- **1 nhánh Đa Pháp** (~20 node): node "Lập Đạo — Đa Pháp" + 2 nhóm: Reaction (7 node: +áp element, +powerScalingRatio, giữ vế ailment...), Sinh-Khắc (6 node: tăng % nurture/Chế Khắc, Đồng Sinh, Liên Khắc...). Node Thân Hòa là group riêng (xem §3.5).
- Luyện Khí giữ nguyên cây chung hiện tại (root 5 hành + power/cadence/mechanic).

### 1.3 Phạm vi file chính

`PhapTuNodes.ts` (6 nhánh mới), `Skills.ts` (15 skill chuỗi + 5 ult), `CultivationPathKit.ts` (thiên phú Thân Hòa), `ElementType.ts` + stats/affixes (bỏ Phong/Lôi), BattleSystem scheduler chuỗi, `ElementReaction.ts` (2 reaction mới + relation metadata + dọn), UI chốt đạo + bar Pháp Lực + tree ngôi sao 5 cánh.

## 2. Thuần hệ — chuỗi kỹ năng 5 thần Sơn Hải Kinh

### 2.1 Khung chuỗi chung

- 5 skill/hành: A (mở màn) → B → C → D → E (đại chiêu kết chuỗi). Cast A mới mở B, B mới mở C... (chain state trong BattleSystem).
- Quái chết → chuỗi reset về A: farm thường chuỗi ngắn (reset liên tục), boss trụ lâu → chuỗi đầy — scaling tự nhiên theo độ dài fight.
- Mỗi link cast hoàn tất (không cần trúng đòn — nhất quán gate chuỗi §7) +10 Thế (E cho nhiều hơn — khởi điểm +20). Thế tích xuyên kill, trần 100, về 0 khi bắn Ultimate.
- Ultimate mở khi Thế đầy: nút manual + toggle auto (mặc định auto — AI bắn khi gặp boss/Độ Kiếp), pattern TTKT/KKTM đã có cho Kiếm Tu. Ult KHÔNG chiếm loadout slot.
- Skill A là root skill hiện có của hành (Hỏa Cầu Thuật...) — giữ id; B–E là skill mới.

### 2.2 Năm chuỗi (tên thần SHK + dấu ấn cơ chế)

| Hành | Thần (phương vị) | Chuỗi | Dấu ấn cơ chế | Ult (Thế đầy) | Thế |
|---|---|---|---|---|---|
| Hỏa | Chúc Dung (Nam) | Chuỗi Chúc Dung | Bùng nổ dồn: A/B/C chồng Thiêu Đốt, D kích nổ mọi Thiêu Đốt, E nuke lan | Tất Phương — điểu hỏa một chân, nơi nó hiện là cháy lớn | Hỏa Thế |
| Thủy | Thiên Ngô (Bắc) | Chuỗi Thiên Ngô | Kiềm chế + hồi: A/B Tê Cóng, C hồi Pháp Lực, D trói/hấp thụ, E sóng càn quét | Bát Thủ — 8 đầu 8 đợt sóng càn quét sạch debuff | Thủy Thế |
| Mộc | Câu Mang (Đông) | Chuỗi Câu Mang | Nhiễm độc lan: A/B Trúng Độc, C rễ cấm di chuyển, D lan độc sang kẻ khác, E vườn độc nổ rễ | Kiến Mộc — thụ thần nối trời đất, rễ trăm trượng | Mộc Thế |
| Kim | Nhục Thu (Tây) | Chuỗi Nhục Thu | Nghiền nát kim loại (KHÔNG kiếm pháp — tách Kiếm Tu): A Kim Châm (vụn thép, Xuất Huyết), B Kim Giáp (tự hoá thép, phản đòn), C Kim Lang (bão mảnh vụn xoáy AoE), D Kim Chung Cộng Hưởng (rung, khuếch đại Xuất Huyết), E Kim Luân Trấn Áp (đĩa thép đè nghiền, nổ Xuất Huyết) | Kim Phạt — Thu là mùa hình phạt | Kim Thế |
| Thổ | Hậu Thổ (Trung) | Chuỗi Hậu Thổ | Phòng tuyến: A/B Thạch Hóa/Chấn, C cột đất đỡ đòn, D chấn địa AoE, E thành lũy nhốt target | Thành Lũy | Thổ Thế |

Tên skill bên trong chuỗi mang khẩu khí vị thần (vd Câu Mang B "Xuân Sanh", Nhục Thu C "Thu Sát"). Tên hiển thị mới; id skill giữ pattern snake_case hiện có. Ailment tái dùng engine: bong, te_cong, trung_doc, chay_mau, thach_hoa, troi_chan — 0 hệ thống mới.

### 2.3 Thế — tài nguyên Thuần hệ

- Pool trên `CombatEntity` (`currentThe` kiểu per-element? — KHÔNG: chỉ 1 pool `currentThe` vì đã chốt 1 hành duy nhất sau Lập Đạo).
- Trần 100, +10/link (E +20). Tích xuyên kill trong phiên farm; logout về 0 (state trong trận, không persist).
- Tiêu hao: bắn Ultimate reset về 0. Node chuyên sâu: +gain, +trần, hiệu ứng phụ khi đầy (vd Hỏa Thế đầy: Thiêu Đốt mạnh hơn).
- Bar 3 hiển thị Thế 0–100 (pattern bar Kiếm Thế).

### 2.4 Ultimate từng nhánh

| Ult | Hiệu ứng (khởi điểm) |
|---|---|
| Tất Phương | Nuke AoE lớn + để lại vùng cháy DoT 6s (tick 1s) |
| Bát Thủ | 8 đợt sóng liên hoàn, mỗi đợt AoE + purge 1 debuff trên bản thân |
| Kiến Mộc | Rễ trăm trượng trói toàn bộ địch + vườn độc DoT vùng |
| Kim Phạt | Đĩa thép đè mục tiêu (đơn mục tiêu cực lớn) + nổ toàn bộ Xuất Huyết đang có |
| Thành Lũy | Nhốt target trong thành đất (bao vây, chặn chạy) + ta tăng armor theo số địch nhốt |

Ult đọc qua ModifierSystem/damage pipeline hiện có (tiền lệ TTKT nuke+zone). Chi tiết số liệu base/ratio để plan quyết định, spec chỉ chốt shape.

## 3. Đa Pháp — reaction gốc rễ + Sinh/Khắc kề nhau

### 3.1 Reaction (giữ nguyên + hoàn thiện — xem §5)

### 3.2 TƯƠNG SINH "Luân Chuyển" (chỉ Đa Pháp — Thuần có chuỗi riêng)

- Skill B đứng sau skill A trong loadout, nếu A sinh B (Mộc→Hỏa→Thổ→Kim→Thủy→Mộc): sau khi cast B, cooldown A giảm 10% (nurture).
- Hoàn tất 1 vòng quay đủ chu trình (cast đủ 5 skill quay về skill đầu) → +1 tầng Luân Chuyển: buff +3% tốc cast toàn chuỗi, trần 10 tầng.
- Cảm giác: chuỗi chạy nhẵn, nhanh dần — hợp idle.

### 3.3 TƯƠNG KHẮC "Chế Khắc" (chỉ Đa Pháp)

- Skill B đứng sau skill A, nếu A khắc B (Mộc⇄Thổ, Thổ⇄Thủy, Thủy⇄Hỏa, Hỏa⇄Kim, Kim⇄Mộc): đòn B +25% sát thương.
- Reaction giữa đúng cặp khắc kề nhau được khuếch đại: +15% reactionEffectPercent (stat đã có trong damage pipeline).
- Cảm giác: đè áp, burst — hợp diệt boss.

### 3.4 Loadout = trục Ngũ Hành

Thứ tự trang bị là quyết định build: vòng sinh (mượt nhanh dần) / trục khắc (đè burst) / trộn. Bảng quan hệ:

- Sinh: Mộc→Hỏa→Thổ→Kim→Thủy→Mộc
- Khắc: Mộc⇄Thổ, Thổ⇄Thủy, Thủy⇄Hỏa, Hỏa⇄Kim, Kim⇄Mộc

### 3.5 Pháp Lực Thân Hòa (thiên phú chọn path Pháp Tu)

- MP của Pháp Tu đổi tên hiển thị → **Pháp Lực** (bar 2, chỉ label + theme màu, không pool mới).
- Effect khi chọn path: manaScalingRatio mọi skill +50% giá trị base hiện có; manaShieldPercent 0.25 → 0.30.
- Node Thân Hòa (group RIÊNG, không thuộc nhánh Đa Pháp — cả Thuần lẫn Đa Pháp đều mua được, mở sau Lập Đạo bất kể đạo nào): mỗi 10% Pháp Lực còn lại +X% sát thương đầu ra; Pháp Lực < 30% giảm Y% sát thương nhận vào. X/Y = khởi điểm plan quyết định.
- Synergy: Ngưng Lộ (reaction mới) nuôi trực tiếp Pháp Lực.

## 4. Bảng Reaction hoàn chỉnh 10 cặp

5 hành = C(5,2) = 10 cặp: 5 sinh + 5 khắc, khớp 1-1 hình học ngôi sao (cạnh ngoài = sinh, đường chéo = khắc). Mỗi cặp đúng 1 reaction, không ô trống, không entry giả.

Ngôn ngữ: sinh = biến đổi/kéo dài/tạo sinh; khắc = tiêu hao/ap chế/phá hoại.

| Cặp | Quan hệ | Reaction | Hiệu ứng | Trạng thái |
|---|---|---|---|---|
| Mộc+Hỏa | Sinh | Độc Viêm | % currentHp dmg | giữ nguyên |
| Hỏa+Thổ | Sinh | Dung Nham | DoT mới + LavaZone AoE | giữ nguyên |
| Thủy+Mộc | Sinh | Độc Thủy | true dmg, giữ Tê Cóng | giữ nguyên |
| Kim+Thủy | Sinh | Ngưng Lộ | baseDamage 40 + buff nguồn ngung_lo (+5 manaRegen/s, 6s, refresh) | MỚI |
| Thổ+Kim | Sinh | Khai Sơn | baseDamage 50 + buff nguồn khai_son (+8% armor/stack, max 3, 6s) | MỚI |
| Hỏa+Thủy | Khắc | Bốc Hơi | true dmg lớn (keepsAilmentId te_cong) | giữ nguyên |
| Hỏa+Kim | Khắc | Thiêu Huyết | dmg + trừ maxHp vĩnh viễn (cap cộng dồn) | giữ nguyên |
| Kim+Mộc | Khắc | Huyết Độc | gộp 2 DoT → huyet_doc mạnh hơn | giữ nguyên |
| Mộc+Thổ | Khắc | Độc Thế | buff stack doc_the cho nguồn | giữ nguyên |
| Thổ+Thủy | Khắc | Trói Chân | root CC troi_chan | giữ nguyên |

Kỹ thuật: 2 reaction mới dùng thuần field sẵn có (baseDamage/powerScalingRatio/appliesBuffId + 2 buff mới trong data/buff/buffs.ts). Thêm metadata `relation: 'sinh' | 'khac'` vào ElementReactionDefinition — cho UI ngôi sao + logic Chế Khắc tra bảng.

## 5. Dọn Phong/Lôi + reaction chết

1. `ElementType` còn 5 hành; xoá wind/lightning khỏi StatBlock, StatLabels, StatCalculator, EnemyStatInput, ElementDamageCalculator, ELEMENT_ORDER.
2. Xoá affix Phong/Lôi khỏi affixes.ts (stat chết).
3. Xoá ailment `te_dien` (mồ côi — không skill nào áp; comment Skills.ts:440 xác nhận).
4. Xoá reaction Lôi Viêm (`bong.te_dien`) — entry chết.
5. Rework `ReactionManager.phanPhac.test.ts` — fixture chuyển sang cặp sống (Bốc Hơi bong+te_cong), giữ độ phủ mechanic phanPhac.
6. Dọn comment Phong/Lôi trong ElementReaction.ts (Đông Lôi/Thủy Lôi/Độc Phong/Mù/Lôi Huyết) — thay bằng ghi chú "hệ Phong/Lôi đã bỏ 2026-08-30, không mở lại".
7. Kiểm tra: `te_dien` không phải hệ Lôi — nó là "tê điện" của Kim nhưng mồ côi nên xoá luôn; chương kiếp `lightning` của Đột Phá (TribulationChapters) là hệ riêng — KHÔNG đụng.

## 6. Slot mở theo realm

| Realm | Slot | Ghi chú |
|---|---|---|
| Phàm Nhân | 1 | giữ hiện tại |
| Luyện Khí → Trúc Cơ | 2 | A+B (toàn bộ nội dung hiện có) |
| Kim Đan → Nguyên Anh | 3 | +C |
| Hóa Thần → Đại Thừa | 4 | +D |
| Độ Kiếp+ | 5 | +E — đủ chuỗi |

`KIEM_TRAN_SLOT_INDEX` (slot 4) chỉ dành cho Kiếm Tu — 2 path không bao giờ tranh slot (thay công thức getSkillLoadoutSlotCount hiện tại: base 2, +1 mỗi 2 realm — đổi thành bảng realm gate như trên).

Nội dung hiện dừng ở Trúc Cơ → thực tế chỉ A+B chơi được; C/D/E là data khóa realm chờ mở (pattern on-hit Kiếm Tu 5–9).

## 7. Chuỗi engine (BattleSystem)

- Chain state trên player: `chainNextSkillId` (skill tiếp theo được phép), reset khi target chết.
- Scheduler auto-cast: duyệt loadout theo thứ tự slot, chỉ cast skill có `ready` (skill trước trong chuỗi đã CAST — không cần hit).
- Thế: pool `currentThe` trên CombatEntity, +10/cast link thành công (E +20), trần 100; persistent xuyên kill trong phiên, reset khi bắn ult; không lưu save.
- Ult: nút manual + toggle auto trong CombatControlBar (mặc định auto — điều kiện boss/kiếp); không chiếm loadout slot.
- Sinh/khắc adjacency: đọc thứ tự loadout, tra bảng quan hệ, áp stat khi cast (cd giảm / dmg tăng / reactionEffectPercent).

## 8. UI

- **Node Tree ngôi sao 5 cánh** (SkillPathPanel Pháp Tu): 5 đỉnh = phương vị thần (Đông Câu Mang, Nam Chúc Dung, Tây Nhục Thu, Bắc Thiên Ngô, Trung Hậu Thổ); cạnh ngoài = sinh; đường chéo = khắc. Luyện Khí: đủ sao sáng, root mỗi đỉnh. Thuần: 4 đỉnh khóa mờ, 1 đỉnh sáng rực — chuỗi tỏa sâu từ đỉnh. Đa Pháp: toàn sao sáng — node sinh trên cạnh, node khắc trên chéo, reaction/Thân Hòa ở tâm.
- **Chốt đạo**: modal/ceremony "Lập Đạo" khi mua node major (đúng tinh thần Độ Kiếp overlay).
- **Bar Pháp Lực**: bar 2 đổi label "Linh Lực" → "Pháp Lực" cho Pháp Tu.
- **Bar 3**: Thuần → Thế 0–100 + nút ult; Đa Pháp → không có bar 3 (không Thế) — thay bằng badge Luân Chuyển tầng khi > 0.
- **Loadout strip**: tooltip mỗi slot hiện quan hệ với slot kề (icon sinh/khắc).

## 9. Save & data (dev phase — không migration)

- Save bump version + `phapTuDao: { kind: 'thuan', element } | { kind: 'da_phap' } | undefined` (undefined = chưa chốt, Luyện Khí).
- Insight refund: ghi qua transaction chuẩn (pattern alchemy reserve); không lưu phần "đã refund" riêng — refund tính từ nodeLevels khi chốt.
- Thế/chain state/Luân Chuyển tầng = state trong trận, không persist.
- SkillResourceType: không thêm loại mới (Thế là pool riêng trên CombatEntity như currentKiemThe).

## 10. Testing

- Unit chuỗi: gate cast (B chỉ sau A), reset-on-kill, slot gate theo realm (2/3/4/5).
- Unit Thế: +10/link (E +20), trần 100, xuyên kill, reset khi bắn ult.
- Unit ult: mở khi đầy, manual + auto-AI điều kiện boss.
- Unit sinh/khắc adjacency: cd giảm đúng cặp sinh kề, dmg +25% đúng cặp khắc kề, reactionEffectPercent +15%, Luân Chuyển tầng +3% trần 10.
- Unit refund: chốt Thuần hoàn đủ insight từng node đã mua các hành khác.
- Reaction mới: Ngưng Lộ buff regen nguồn, Khai Sơn armor stack max 3; relation metadata đúng bảng.
- Dọn Phong/Lôi: test kiểu grep-guard (không còn windPower/lightningPower/te_dien ở runtime data), phanPhac test rework giữ độ phủ.
- Data validation: 15 node × 5 nhánh + 20 node Đa Pháp (pattern test data hiện có).
- Regression: 8 reaction cũ giữ nguyên hành vi (test hiện có không đổi trừ fixture te_dien).

## 11. Phạm vi loại trừ / chờ sau

- Số liệu balance (40/50/5/8%/15%/25%/10%/3%/+10 Thế...): khởi điểm, tinh chỉnh playtest.
- Realm trên Trúc Cơ (C/D/E, slot 3–5): data khóa realm chờ — đúng pattern Kiếm Tu.
- Skill B–E chi tiết (tên từng chiêu, số liệu từng skill): plan implementation quyết định theo dấu ấn đã chốt.
- VFX chuỗi/ult: dùng preset có sẵn, làm mới để sau.
- Thể Tu (path thứ 3): ngoài phạm vi.
