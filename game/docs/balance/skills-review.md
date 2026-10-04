# Review Balance Chiêu Thức — Pháp Tu (data slice) — 2026-10-04

Cách làm: chơi thật trong lab `?lab=phap_tu` (kit hỏa, manual) + mô phỏng
headless `TurnBattleSystem` 8 seed x từng mốc (LQ/TC/KD) trên build thật
(`zzSkillAudit.test.ts`, scratch, không commit). Cảm giác ghi TRƯỚC, số liệu
đối chiếu SAU.

## A. Trải nghiệm player

Đánh thật `foundation_floor_1` (bầy 3 sói 684hp, ~64 might):

- **Thua tuyệt đối.** Chết trong ~2 lượt hành động của mình. Ly Hỏa Thuật
  gây ~45-62 dame/sói, sói trả ~60-70/lượt/con x 3 con — máu 358 hết trước
  khi bầy mất nửa con đầu.
- **Ngự Diễm (tam_muoi) là nút "bẫy".** Bấm vào = mất trọn 1 lượt (0 dame),
  thanh MP tụt một khúc nhìn rõ (~86/286). Auto-battle cũng tự bấm nó đầu
  tiên khi hết CD — nghĩa là game tự đốt lượt + MP vào một cửa sổ buff mà
  người chơi không hề cảm nhận được hiệu ứng. Trận thua nào cũng thấy
  `mpSpent=86` (đúng 1 lần cast) trước khi chết.
- **Cột Thế gần như không nhúc nhích.** Ở hoa_the lv1-3 (25-75% nhận Thế mỗi
  đòn trúng), trận quyết định kết thúc khi mới 0-3/5 Thế — không bao giờ
  thấy "Pháp Thể" (bản cường hóa của đòn đánh) bắn ra. Đến lv4 (100%) thì
  vẫn cần 5 đòn trúng — trận thua chỉ sống được 1-4 đòn. Cơ chế quả báo lớn
  nhất của kit không tồn tại trong gameplay thật ở mốc nó phải xuất hiện.
- Ở trận cùng sức (quái LQ), kit chạy đúng cảm giác: cầu lửa mỗi lượt, Hỏa
  Ấn tick đều, đến Thế 5 thì đòn cường hóa bắn pulse đốt. Nhịp **mượt** —
  vấn đề chỉ nằm ở con số quái và kinh tế cửa sổ, không nằm ở nhịp cast.
- Tán Diễm dọn bầy 4x80hp trong ~4 cast — biến thể AoE đúng vai trò.
- So cùng một trận: build Thể Tu đánh sói chịu được lâu gấp ~2 lần và gây
  dame ~2 lần (Loan Đấu bùng nổ 60-234). Pháp Tu cảm giác "gãy sớm" vì
  special của nó không ra dame còn body special ra dame thật.

## B. Số liệu chứng minh

### B1. Chiêu basic của 5 hành + sibling body (authored)

| Chiêu | Dame trực tiếp | Ấn/dot | Tỉ lệ gieo | Payoff cửa sổ |
|---|---|---|---|---|
| Ly Hỏa Thuật | 1.0 x Power (+0.4%/att, +0.1%/maxMP) | Hỏa Ấn 0.15/tầng | 0.5 | x1.5 potency Ấn |
| Thủy Tiễn | 1.0 x Power (cùng scaling) | Hàn Tức 0.25/tầng | 0.5 | hồi MP nhỏ |
| Điểm Kim | 1.0 x Power | Liệt Thương 0.2/tầng | 0.4 | +10 xuyên/đòn |
| Thổ Cầu | 1.0 x Power | Trấn Ấn (setup) | 1.0 | đè nhịp địch |
| Độc Chưởng | 0 (theo thiết kế) | Độc Cân 0.2/tầng | 1.0 | +1 tầng độc |
| Cường Quyền (Thể) | 1.4 x Might | — | — | Loan Đấu: 3 hit x1.2, tốn 30% maxHP |

Hỏa Ấn là dot yếu nhất bảng (0.15) dù cùng tỉ lệ 0.5 với Hàn Tức (0.25) —
trong khi toàn bộ kinh tế kit hỏa (cửa sổ potency + Pháp Thể pulse) đều
nhân vào hệ số này.

### B2. Kinh tế cửa sổ Pháp Trạng (5 phần tử chung cấu hình)

- Cost (trước tune): `PHAP_TU_TRANG_COST_PERCENT_OF_MAX = 0.3` -> mỗi cast tốn ~86MP
  (TC) / ~117MP (KD); CD 5 lượt, cửa sổ 3 lượt (uptime trần 60%).
- Đo thực tế (8 seed): trận thua `mpSpent=86` = đúng 1 cửa sổ rồi chết;
  trận thắng `mpSpent=172-469` = 2-4 cửa sổ cạn bar (bar ~286MP).
- So giá trị: một lượt basic ~45-140 dame tại mốc TC. Cửa sổ tam_muoi x1.5
  potency trên dot 0.15 với 50% proc trả về ~10-25 dame/cửa sổ — đặt mua
  bằng 1 lượt mất dame + 30% MP là lỗ rõ. Sibling Loan Đấu cũng tốn 30%
  maxHP nhưng mua được 3 hit x1.2 (~150-230 dame ở cùng mốc).
- Đặc biệt nguy hiểm cho idle: auto scheduler (độ ưu tiên special > basic)
  tự đốt MP vào cửa sổ mỗi khi hết CD ngay cả khi đó là quyết định tệ.

### B3. Kinh tế Thế + Ấn (đo từ sim)

- `the+`: thua 0-3, thắng/mốc nông +5 (hoa_the lv4 = 100%/đòn trúng).
  Ngưỡng Pháp Thể 5 chỉ đạt được trong trận đã thắng sẵn hoặc trận kéo dài
  -> payoff không xuất hiện đúng lúc cần.
- Dot đóng góp ~35-45% tổng dame hỏa ở trận kéo dài (durable TC:
  buff_periodic 128-474 / tổng 636-1056) — kênh Ấn có trọng lượng thật khi
  được sống, nên base coeff 0.15 là chỗ nghẽn thật.
- Tụ Diễm (+15% coeff, proc 0.7): dps ~119-120 trên durable vs ~100 thường
  — capstone hợp lý, không outlier.

### B4. Ma trận recipe x benchmark (8 seed/cell, quái LQ-stat)

| Recipe | single | multi | durable | burst | attrition |
|---|---|---|---|---|---|
| kiem_tu_hien | 8/8 | 8/8 | 8/8 | 4/8 | 8/8 |
| phap_tu_ngu_hanh | 4/8 | 8/8 | 8/8 | 5/8 | **0/8** |
| the_tu_hien | 4/8 | 8/8 | 8/8 | 4/8 | 0/8 |
| phap_tu_ngo_dao (ẩn) | 8/8 | 8/8 | 8/8 | 7/8 | 8/8 |
| the_tu_ung_the (ẩn) | 0/8 | 8/8 | 3/8 | 0/8 | 0/8 |
| kiem_tu_ngu (ẩn) | 8/8 | 8/8 | 8/8 | 8/8 | 8/8 |

ngu_hanh vẫn là recipe thắng-yếu nhất cùng the_tu_hien (khớp gate
`hasStrength:false` đã pin), chưa phải outlier phi lý so với sibling tuyến
tính.

### B5. Mốc thật (stage data), mọi archetype 0/8

| Build | found_1 | found_5 | found_10 |
|---|---|---|---|
| fire TC | 0/8 (dps 12-25) | — | — |
| fire TC10 | — | 0/8 (dps 17-43) | 0/8 (dps 35-64) |
| fire KD | — | — | 0/8 (dps 120-162, taken ~600) |
| body TC | 0/8 (dps 23-44) | 0/8 | 0/8 |
| control TC (không kit) | 0/8 (dps ~5) | — | — |

Mọi archetype cùng mốc đều thua sàn 1 — tức vấn đề là độ khó sàn (ngoài
domain chiêu thức), không phải kit hỏa riêng yếu tới mức không chơi được;
nhưng trong cùng thất bại, hỏa chỉ đạt ~50% dps của body.

## C. Đề xuất tune (đã áp)

| # | Trường | Cũ → Mới | Lý do 1 dòng |
|---|---|---|---|
| 1 | `PHAP_TU_TRANG_COST_PERCENT_OF_MAX` | 0.30 → 0.15 | Cửa sổ 0-dame tốn 30% maxMP = cạn bar sau 3 cast; ~15% vừa khớp regen ~40-50MP/5 lượt để cửa sổ là nhịp xoay được chứ không phải nút bẫy. |
| 2 | `TAM_MUOI_POTENCY_MULTIPLIER` | 1.5 → 2.0 | Payoff duy nhất của cửa sổ hỏa là hệ số này trên dot 0.5-proc yếu nhất bảng; x2 để cửa sổ hòa-vốn với 1 lượt mất dame (~40-100/cửa sổ vs ~45-90 basic). |
| 3 | `hoa_an.coefficient` | 0.15 → 0.20 | Thấp nhất bảng ấn (Thủy 0.25 cùng proc 0.5); hỏa là hành có cả cửa sổ lẫn Pháp Thể pulse nhân vào dot này nên base yếu nhất = phạt kép. Vẫn < Hàn Tức — giữ định danh "Thủy dot sâu". |

Giữ nguyên (đã cân nhắc, không outlier rõ): PHAP_TRANG_TURNS=3 (khe hở
2 lượt/CD5 là định danh "cửa sổ", cost mới đã mở được uptime), CD special
5, ailmentChance 0.5 (node tăng qua elementApplicationPercent), hệ số
capstone Tụ/Tán, payoff reaction (khac 0.1-0.35 mạch lạc nhau, nhưng xem
ngoài phạm vi), KIM_LIET 10/tầng, TRONG_NHAC 0.5 gauge.

### Xác nhận sau tune (đo lại cùng harness, 8 seed)

- `phap_tu_ngu_hanh` matrix: single 4→**7/8**, burst 5→**7/8**, attrition
  0→**2/8**; ttk durable 270→260. Recipe yếu nhất được kéo lên mà không
  phá gate dominance (vẫn `hasStrength:true/hasWeakness:false` như pin).
- Window cost thực tế: `mpSpent` 4 cast cửa sổ từ 225→112 (đúng 43MP/cast
  ở MP ~286) — cửa sổ không còn ăn cả bar.
- Kênh Ấn nay rõ hơn ở trận dài: `buff_periodic` chiếm ~45-65% tổng dame
  hỏa (trước ~35-45%) — đúng định danh "dot là kênh payoff chính".
- Trận mốc thật (`foundation_floor_*`) vẫn 0/8 mọi archetype — xác nhận
  ràng buộc là độ khó sàn, không phải kit (ngoài phạm vi #1).

Pin test cập nhật kèm: `Skills.kit.test.ts` (0.3→0.15), `buffs.test.ts`
(hoa_an 0.15→0.2) + thêm invariant "dot hỏa không yếu hơn dot sibling".
Fingerprint BalanceMatrix regenerate — chỉ 2 recipe spell trôi
(`phap_tu_ngu_hanh` + `phap_tu_ngo_dao`, 80 cell), 160 cell còn lại
byte-identical.

## Ngoài phạm vi (ghi nhận, không sửa)

1. **Độ khó sàn Trúc Cơ**: 3 sói x684hp/~64 might ở `foundation_floor_1`
   đánh bại MỌI archetype mốc realmLevel 1 (kể cả KD vs floor 10).
   Caveat: sim thiếu trang bị/đồng hành người chơi thật có; dù vậy tỉ lệ
   quá gắt — cần quyết định ở `data/enemy`/`data/stage`.
2. **Ngưỡng Thế 5 + THE_GAIN_CHANCE_PER_LEVEL=0.25**: core
   (`PhapTuPath.ts`, `CultivationPathRegistry.ts`). Ở hoa_the lv1-3 payoff
   Pháp Thể gần như không bao giờ bắn trong trận quyết định. Đề xuất Minh
   cân nhắc: nâng base chance (vd 0.35/level) hoặc hạ ngưỡng 5→4.
3. **Cooldown/castTime authored trên basic là trường chết** trong turn
   engine (resolveAuthoredBasic ép cd=0) nhưng `cooldown:4, castTime:1.6`
   của Ly Hỏa vẫn hiển thị trên tooltip UI — lệch với hành vi thật
   (1 đòn/lượt). Cần quyết định: sửa data hay sửa tooltip.
4. **Reaction chỉ bắn khi có 2 hành ấn trên 1 mục tiêu** — solo 1 hành
   không bao giờ kích được; payoff chưa từng xuất hiện trong mọi trận đo.
   Vấn đề thiết kế hệ thống, không phải số.
5. `hoa_the` maxLevel 4 và đường insight capstone nằm ở
   `data/progression` — ngoài 3 thư mục được cấp.

### Ngoài phạm vi — cập nhật áp dụng (2026-10-04, theo chỉ thị Minh)

- Mục 2 `THE_GAIN_CHANCE_PER_LEVEL` — ĐÃ ÁP DỤNG `0.25 → 0.35`/level (`PhapTuPath.ts`); ngưỡng Thế giữ 5. Pin `PhapTuPath.way.test.ts` cập nhật.
- Các mục 1 (enemy/stage), 3 (cooldown tooltip), 4 (reaction 2-ấn), 5 (`hoa_the` maxLevel) — giữ nguyên chờ quyết định thiết kế.
