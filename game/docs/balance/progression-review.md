# Progression Balance Review — tu trải nghiệm người chơi

Ngày: 2026-10-04. Người review: Devin (đóng vai player thật). Nhánh: `devin/1791147734-progression-balance` off `codex/hoa-cau-fireball-vfx`.

Phương pháp: chơi thật trên dev server (tạo nhân vật → đi quest chính → đánh stage → lên cảnh → độ kiếp Quán Khí → nhận thiên phú → chọn Pháp Tu/Hỏa → mua node), ghi cảm giác TRƯỚC, sau đó đọc data + chạy headless sim (import module thật, in số đo) để đối chiếu.

---

## A. Trải nghiệm (ghi trước khi nhìn số)

1. **Roll thiên phú dễ đọc**: mỗi lá ghi rõ buff và phần "Ngược lại" (trade-off). Phàm Cốt hiện đúng vai "cạm bẫy có chủ đích" (-75% tốc tu). Qua nhiều lần roll thấy lặp Hải Nạp 2 lần — ổn, pool đủ đa dạng.
2. **Đoạn Phàm Nhân nhịp vừa**: thanh tu vi nhích nhìn thấy được; đánh xen kẻ đến tầng 12 mất ~15-20 phút. Không kẹt.
3. **Trận đầu (Động Heo Rừng 1) hơi nhọc**: 10 heo, ~2.5 phút auto, phải 4 hit mới chết 1 con, máu tụt ~40%. Thắng nhưng màn kết thúc không rõ — không thấy banner thắng, phải tự đoán qua việc mở tầng kế.
4. **Kỹ năng lên bằng số lần thi triển cực chậm**: sau 1 tầng, cây "19/1000" — cảm giác cả tuần mới lên 1 cấp kỹ năng.
5. **Cảm Ngộ (Insight) ở Phàm Nhân có mà không có chỗ tiêu** — hơi kỳ, nhưng hiểu là bank sẵn cho Luyện Khí.
6. **Độ kiếp Quán Khí hay**: quiz tạo căng thẳng, sét đánh tụt ~1/3 HP — sợ nhưng công bằng; chọn thiên phú sau kiếp thấy ý nghĩa.
7. **Sang LK1 mua node "sướng"**: node giá 1-2 điểm, mua liền 3-4 node. Cảm giác "điểm không phải vấn đề — cảnh giới với cấp tâm pháp mới là cửa".
8. **Hơi vòng**: muốn vào tầng LK phải quay lại clear hết 10 tầng Phàm Nhân trước (stage tuần tự).
9. **Tâm Pháp Phẩm 2 xa vời**: cần 200 linh thạch + cảnh giới cao hơn — ở LK1 không thấy đường đến.
10. **Điểm thuộc tính**: 3 điểm cộng tay, không rõ 1 điểm đổi bao nhiêu sức mạnh.

## B. Số liệu (đo từ module thật qua headless sim)

### B1. Nhịp cảnh giới (tu vi yêu cầu, base 10 tu vi/giây, không tính talent)

| Cảnh giới | Thời gian/tầng | Lũy kế đến tầng 12 | Lũy kế đến tầng 18 |
|---|---|---|---|
| Phàm Nhân | 1-18 phút | 78 phút | 171 phút |
| Luyện Khí | 70-87 phút | 906 phút (15.1h) | 1431 phút (~1 ngày) |
| Trúc Cơ | 550-567 phút | 6666 phút (~4.6 ngày) | 10071 phút (~1 tuần) |

Retune 2026-10-05 theo chỉ đạo: Luyện Khí >= 1 ngày, Trúc Cơ >= 1 tuần ở
tốc độ nền (baseCultivationMinutes 22->70, 64->550). Talent tốc
(+10%..+75%), ramp Hậu Tích, Tu Linh Trận đẩy thực tế nhanh hơn (~0.6x
khi stack đủ). Phàm Nhân giữ nguyên vai trò tutorial; Kim Đan+ đã chạy
hệ realmDurationMultiplier (90 ngày+). Giờ mỗi cảnh giới là một "gate
cứng" có chủ đích.

### B2. Thu nhập Insight vs giá node — outlier lớn nhất

| Cảnh giới | Insight/kill | Linh thạch/kill |
|---|---|---|
| Phàm Nhân | 3-5 | 1-2 |
| Luyện Khí | 21-27 | 8-12 |
| Trúc Cơ | 162-216 (×3 realm mult) | 75-105 |

Tổng giá cây node (mua hết mọi level): **Hỏa 53 điểm, Kiếm Tu 35, Thể Tu ~40/nhánh**. Một tầng LK (~14 kill × ~24) ≈ **300-380 Insight** — tức clear 1 tầng LK mua được ~6-7 lần cả cây Hỏa. Chưa kể Phàm Nhân đã bank 3-5/kill (farm hết chương ≈ 400-700 điểm trước khi có chỗ tiêu).

**Kết luận**: Insight không phải tài nguyên khan hiếm — nó là "vé miễn phí". Các gate thật sự điều tiết pacing là `realmLevel` + `techniqueRank` (node L3/L4/L5 cần rank 2/3/4 ≈ tầng 2/3/4, vì ceiling rank = min(18, realmLevel) và mỗi rank chỉ 300 mastery ≈ 8 kill LK — rất nhẹ). Hệ quả: mọi talent/node/tiền tệ xoay quanh Insight (Tâm Tuệ +25%/lv, Ngộ Đạo +1/2000 tu vi) đều vô nghĩa vì dư sẵn. Nút vặn nằm ở `src/core/reward/SkillInsightBalance.ts` (hệ số 0.6) — **ngoài domain được cấp** → đề xuất ở mục C, không tự sửa.

### B3. Node yếu hơn sibling — "node phí điểm"

| Node | Giá/level | Trị/level | Tổng max |
|---|---|---|---|
| `<hệ>_ailment_mastery` (vd Hỏa Chưởng) | 9 (5 lv) | +4% uy lực **và** +3% thời gian tật trạng | +20%/+15% |
| Trunk cơ bản (vd Hỏa Ấn Sâu, Diễm Chuẩn) | 9 (5 lv) | +2% một kênh | +10% |
| Vòng ngoài (vd Nhiệt Kéo, Diễm Thấm) | 6 (4 lv, gate TC) | +2.5% một kênh | +10% |

Trunk = ~29% giá trị/điểm của mastery cùng giá — dưới ngưỡng ~30% audit. **Nhưng**: pin-test `PhapTuBasicNodes.test.ts` khẳng định quy ước authored "a maxed power node never exceeds +10% in one direction" — mọi node cơ bản (trunk 5lv×2% và vòng ngoài 4lv×2.5%) đều trần đúng +10%/kênh; mastery là node signature cố ý nằm trên trần. Trunk không phải outlier rõ: nó đang ở trần thiết kế, và vai trò "bản copy thứ hai của kênh" sau khi mastery max là hợp lệ — mua nhầm cũng không thiệt vì Insight dư sẵn (B2). Nâng trunk vượt +10% = sửa trần thiết kế, đó là quyết định design không phải tune số → chuyển sang C2 hỏi ý.

Cây Thổ mỏng (5 node tốn điểm) so với Mộc (~10) — bất đối xứng có chủ đích, ghi nhận không sửa.

### B4. Độ kiếp Trúc Cơ — tử vong gần như chắc chắn

Gear bị tháo khi vào kiếp (snapshot naked). Damage raw (Nhân phẩm): Thân Kiếp 10 hit × 10% = 100% maxHP, Lôi Kiếp 12 × 13% + chốt 30% = 186% — **tổng 286% maxHP**.

Với def 15 (mức LK12 bình thường), trả lời đúng cả 4 câu (-20%), hồi ~3-5 HP/s: effective ≈ 199% × 0.87 × 0.8 ≈ **139-165% maxHP** — chết kể cả build khá. Chỉ sống nổi nếu đi full nhánh hoàn mỹ (Luyện Huyết/Mạch + mạch Xuân Lôi + maxHp đệm). Fail phạt -40% thanh tu vi + 200 thạch + debuff 60s → vòng retry mỗi lần ~15-20 phút.

So với kiếp Quán Khí (35% raw — nhẹ nhàng) đây là bậc thang ×8 — outlier. **Đã tune: Thân 0.10→0.08, Lôi 0.13→0.10, chốt 0.30→0.20** → raw 220%; Nhân phẩm sống được nếu chuẩn bị (regen + def + trả lời đúng, ~80-90% máu đối), Địa/Thiên (×1.15/×1.3) vẫn gate cứng đúng vai trò premium.

### B5. Đan mạch / essence — mục tiêu siêu dài hạn

- Địa grade Trúc Cơ: 3 tầng luyện thể = 840 tinh hoa phàm ≈ 600 kill Phàm Nhân / ~300 kill LK — cày được trong arc.
- Thiên grade: cả 6 tầng = **36,790 pham-eq** ≈ 26k kill Phàm Nhân hoặc ~6.5k kill Trúc Cơ + 6/8 mạch (41 Thông Mạch Đan × ~500 thạch + 15ph luyện/cái + yêu đan). Chu Thiên 36 bước = 3,690 phap ≈ 2.6k kill TC.
- Đọc: Thiên Kiến Cơ thực tế là mục tiêu "hết nội dung beta mới cày nốt" — giữ nguyên nếu chủ đích là prestige, cân nhắc giảm cap tầng 5-6 nếu muốn reachable trong beta.

### B6. Talent — tỉ lệ và trap

- Roll: trọng số pham 55/linh 28/địa 12/thiên 4/dị 1 (tổng 477), 9 lá không hoàn → thiên ~7.3%/roll, pham_cot ~15.8% (có re-offer 15%). Hợp lý.
- `lk_tam_tue` (Tâm Tuệ, +25% Insight/lv trong pool đột phá LK): **trap nhẹ** — Insight đã dư (B2), đổi slot đột phá lấy currency vô giá trị. Chưa tune vì căn nguyên là economy Insight (ngoài domain).
- `ngo_dao` (Ngộ Đạo, +1 Insight/2000 tu vi): ~5-10 điểm/realm — nhỏ nhưng free, giữ.
- `tat_phong` (Tật Phong): mất hết stack chỉ vì 1 đòn — trong auto-battle boss trúng đòn thường xuyên → thực tế +0-40% tốc, variance cao; mô tả nói rõ rồi nên chỉ flag.
- Trọng Kích / Hấp Linh / Cẩn Thận / Vân Đạo (PR #116): đã tune, sibling check không thấy outlier mới → không đụng.

### B7. Đống khác đo được

- Linh thạch: 8-12/kill LK → 200 thạch Phẩm 2 ≈ ~20 kill LK (nhưng bị chặn realm TC mới mua) — mức hợp lý.
- Technique rank: 300 mastery/rank grade 1 ≈ 8 kill LK; ceiling = realm level — theo sát cảnh giới, không kẹt.
- Stage: tầng N cần realmLevel N, boss tầng 10 trước gate đột phá tầng 12 — nhịp đều.
- Bất cập trải nghiệm không thuộc data: màn kết stage không rõ trạng thái thắng; thăng cấp kỹ năng bằng cast count (19/1000 sau 1 tầng) — flag cho UI/skill-data owners.

## C. Đề xuất tune

### C1. Đã áp dụng (trong domain, bảo thủ)

1. **`src/data/tribulation/TribulationChapters.ts`** (chapter Trúc Cơ): `Thân Kiếp 0.10→0.08`, `Lôi Kiếp 0.13→0.10`, `đại lôi 0.30→0.20`. Raw 286%→220% maxHP — Nhân phẩm sống được khi chuẩn bị đúng, Địa/Thiên vẫn đòi đầu tư nhánh luyện thể. Pin-test `TribulationDirector.terminal.test.ts` cập nhật: giữ nguyên lớp kịch bản boundary (chết trên đòn cuối chương / mid-chapter / không đổi outcome), re-derive def và thêm talent `loi_kiep` ×2 cho 2 kịch bản "chết trong Thân Kiếp" vì 8%/hit tối đa chỉ còn ~96% ở mọi def.

### C2. Đề xuất chưa áp dụng — cần Minh quyết (ngoài domain hoặc thay đổi lớn)

1. **Insight economy thừa ~1 bậc lũy thừa**: nút vặn ở `src/core/reward/SkillInsightBalance.ts` (`SKILL_INSIGHT_PER_TECHNIQUE_MASTERY 0.6 → ~0.15-0.2`) hoặc tăng `insightCost` node theo realm. Nếu không sửa, mọi node insight-effect (Tâm Tuệ, Ngộ Đạo) đều là trap. → cần quyết định economy trước.
2. **Trần +10%/kênh của node cơ bản** (B3): nếu muốn trunk không còn "bản kém của mastery", nâng trần lên 12.5-15% (đổi perLevelFlat trunk + cập nhật pin); nếu mastery cố ý là premium signature thì giữ nguyên — em không tự quyết vì đây là trần thiết kế có pin-test.
3. **`lk_tam_tue`**: chỉ nên retune sau khi chốt (1). Nếu giữ economy hiện tại, đổi sang trị số khác (vd %exp stage).
4. **Cast-count kỹ năng**: 19/1000 sau 1 tầng → cân nhắc giảm ngưỡng hoặc batch-count (knob ở `data/skill`, ngoài domain).
5. **Thiên Kiến Cơ 36,790 essence**: nếu muốn reachable trong beta, giảm cap tầng 5-6 (7,500/26,300 → ~2-3k/8k) hoặc thêm nguồn essence mới; nếu là prestige cuối nội dung thì giữ.
6. **UI**: thắng stage nên có kết quả rõ — giao lại owner UI (không sửa theo yêu cầu).

### C2 — Kết quả áp dụng (2026-10-04, theo chỉ thị Minh "làm theo đề xuất balance")

- **C2.1 Insight economy — ĐÃ ÁP DỤNG**: `SKILL_INSIGHT_PER_TECHNIQUE_MASTERY 0.6 → 0.18` (`SkillInsightBalance.ts`). Insight trở về khan hiếm; toàn bộ node insight-effect (Tâm Tuệ, Ngộ Đạo) thoát bẫy theo.
- **C2.2 Trần +10%/kênh — ĐÃ ÁP DỤNG ở mức 12.5%**: 12 node thân cây `stat(..., 0.02)` → `0.025` (cap 0.10→0.125). Vòng ngoài foundation-gated giữ 0.025×4=0.10. Pin `PhapTuBasicNodes.test.ts` cập nhật theo phân vùng trunk/outer.
- **C2.3 `lk_tam_tue` — KHÔNG ĐỔI**: sau C2.1 insight không còn dư, talent tự khôi phục giá trị.
- **C2.4 Cast-count — ĐÃ ÁP DỤNG**: `CAST_LEVELING_THRESHOLDS` lv2 `1000 → 250` (tram/linh_bao/huy_quyen); lv3 giữ 10.000 (cổng ẩn L3 có chủ đích, không đụng).
- **C2.5 Thiên Kiến Cơ — ĐÃ ÁP DỤNG phương án giảm cap**: luyen_tang `7500→2500`, luyen_mach `26300→8000` (tổng ≤ ~13.5k essence, reachable trong beta).
- **C2.6 UI thắng/thua — giữ nguyên** (owner UI).
