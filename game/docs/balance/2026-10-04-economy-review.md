# Đánh Giá Kinh Tế Phàm Nhân (1–2h đầu)

Ngày: 2026-10-04. Nhánh nền: `codex/hoa-cau-fireball-vfx`.
Phương pháp: chơi thật ~50 phút trên dev server (save khách tới Phàm Nhân
tầng 11, cps 14, qua ~1.5 động) + sim headless accrual/spend bằng vitest
trên chính data/balance files + đọc toàn bộ catalog trong
`src/data/{building,materials,pill,alchemy,drop,equipment,artifact,
talisman,formation}/**` và các balance engine tương ứng.

Phạm vi: kinh tế chương Phàm Nhân (mortal) — faucet/sink linh thạch,
nguyên liệu nghề (gỗ/quặng/thảo), tinh hoa, thể luyện, đan dược,
nâng nhà và nâng đồ. Không đánh giá UI.

---

## A. Trải nghiệm (ghi trước khi xem số)

1. **Nhịp mở đầu gọn, không chán.** Tutorial dẫn nhanh vào vòng:
   tu luyện chạy nền → vào động đánh hiệp → nhặt drop → quest thưởng.
   Khoảng 30 phút đầu lúc nào cũng có nút để bấm, có thứ để làm.
2. **Linh thạch hiếm khi thắt nút.** Sau ~1.5 động + quest chuỗi đầu,
   tiền đủ mở/nâng các nhà cơ bản (Đan Phòng, Luyện Thể Phòng, Linh
   Mạch). Thứ phải chờ là tài nguyên chuyên dụng (gỗ/quặng/thảo),
   không phải linh thạch — cảm giác "có tiền, đợi hàng".
3. **Linh Mạch nhỏ giọt.** Thu thủ công 2.1 viên/phút; phải nhớ bấm,
   con số thu không đáng kể so với linh thạch rơi từ đánh hiệp. Cảm
   giác mỏ chỉ là phụ.
4. **Drop đánh hiệp "mở vòi".** Mỗi phát giết đều cho linh thạch + 1
   món đồ + essence. Túi đồ đầy rất nhanh — ~30 phút đã ~15 món,
   phải ngồi rà/phân rã.
5. **Đan phòng nửa chết.** Công thức Hồi Linh Đan hiện và chế được ở
   Phàm Nhân, nhưng thể lực (MP) của nhân vật bằng 0 — chế xong không
   có tác dụng, đúng nghĩa bẫy tốn nguyên liệu. Tụ Linh Đan chế 10
   phút, tu vi cộng vào nhỏ tới mức không cảm nhận được.
6. **Luyện thể đụng trần sớm.** Essence về nhanh nhưng nấc tiếp theo
   bị tầng cảnh giới khóa — cảm giác "nhiều essence không tiêu được".
7. **Sạp buôn trống.** Giao diện mở nhưng ở Phàm Nhân không bán được
   món nào — cơ chế "chưa tới lượt".
8. **Quest thưởng đôi chỗ khó bấm** (nút "Nhận Thưởng" nằm trong
   board đang gập) — nhỏ nhưng dễ đứt dây chuyền thưởng.

## B. Số liệu (sim + đọc balance)

Sim headless (mortal, 75% thời gian đánh động, còn lại để game idle),
2 giờ đầu:

| Faucet (theo giờ) | Linh thạch | Gỗ | Quặng | Thảo | Trang bị | Essence |
|---|---|---|---|---|---|---|
| Đánh động (mortal) | 338 (~5.6/ph) | — | — | — | ~225 | ~315 |
| Linh Mạch L1 | 127 (~2.1/ph) | — | — | — | — | — |
| Site L1 (Lâm/Quáng/Động Thiên) | — | ~86 | ~86 | ~36 | — | — |

- 2 giờ tổng: ~1464 linh thạch (trong đó quest chuỗi đầu ~535, tức
  ~37% thu nhập), ~450 trang bị, ~630 essence, ~172 gỗ/quặng, ~72 thảo.
- Cổng tu vi Phàm Nhân: 12 tầng × 600 = 7200 tu vi = 78 phút thuần
  ở cps 10 — đội hình faucet phù hợp với trục thời gian này.

Cặp nhu cầu ↔ faucet cùng mốc:

| Sink | Giá | Faucet cùng mốc | Thời gian đủ |
|---|---|---|---|
| Đan Phòng L1 | 5 gỗ + 2 quặng | site ~86/h mỗi loại | ~6 phút |
| Linh Mạch L2 | 25 linh thạch | đánh động ~5.6/ph | ~7 phút |
| Site L2 | 5 gỗ Luyện Khí + 100 thạch | gỗ giới tiếp rơi sẵn ở site | ~30 phút |
| Cuờng hóa +1 | 4 quặng + 50 thạch | động + quặng site | ~10 phút |
| Tuộc (wash) 1 lần | 2 essence + 100 thạch | essence dư hàng trăm | ~18 phút (thạch) |
| Tụ Linh Đan mortal | 50 thạch + 2 thảo + 2 gỗ | thảo ~36/h | **trả ~14s tu vi** |

Mismatch phát hiện (đối chiếu data):

1. **Đan phương chết — `hoi_linh_dan_mortal`:** hiệu quả mp_regen nhưng
   `maxMp`/`manaRegenPerTurn` là stat spell-domain, bằng 0 đến tận
   Luyện Khí (đường pháp mở khi quán khí chọn hành). Chế được và hiển
   thị trên Đan Phòng ở Phàm Nhân → bẫy tốn 50 thạch + nguyên liệu.
2. **`tu_linh_dan_mortal` gần như vô giá trị:** `cultivationPercent`
   = 2% nhu cầu tầng hiện tại → tầng 12 cho 144 tu vi ≈ 14 giây tu
   luyện nền, trong khi tốn 50 thạch + 2 thảo + 2 gỗ + 600 giây lò.
   Cùng 50 thạch, Tụ Linh Trận cho +25% cps trong 24h — chênh hàng trăm
   lần hiệu quả.
3. **Trang bị rơi theo vòi:** pool mortal chỉ có `equipment_any w20`,
   resolveDrops chạy mỗi kill → ~225 món/giờ. Cap mềm 500 + auto-
   dissolve là van xả đúng thiết kế, nhưng túi spam và tinh hoa phân
   rã (0-1-2/món) chồng lên essence glut.
4. **Essence glut có chủ đích:** ~315/h vs cap đốt thể
   50/175/615/2150/7500/26300 (×3.5, data ghi "first-pass"). Tier 1-2
   gần đúng trục chơi; tier 4+ là dành cho Luyện Khí+ (substitution
   1 cao = 2 thấp hấp thụ dư). Cảm giác "tiền không tiêu" ở cuối
   chương là hệ quả gate tầng, không phải bug số.
5. **`doan_bao_thach` tồn kho vô sink:** drop ở Trúc Cơ, sink trễ tới
   Ngũ Hành Châu (Kim Đan), không bán được — đúng thiết kế tích trữ,
   không sửa.
6. **Vendor chết ở Phàm Nhân:** `isGradeBelowPlayer` yêu cầu material
   thấp realm NGHIÊM NGẶT → mortal không bán được gì; essence/tinh hoa
   không có profession meta nên cũng không bán. Mở van từ Luyện Khí —
   hợp lý nhưng nên có hint cho người chơi.
7. **Chú thích Linh Mạch lỗi thời:** comment "max-level = 5% farm
   online" không còn đúng — L9 ~330/h ≈ tốc độ đánh động. L1 127/h
   ≈ 38% battle — vai trò phụ hợp lý.

## C. Tune đã áp dụng trong PR này (bảo thủ, chỉ outlier rõ)

1. `src/data/alchemy/alchemyRecipes.ts` — đánh `retired: true` cho
   recipe `hoi_linh_dan` ở realm `mortal` (gate theo
   `family.effect.kind === 'mp_regen' && realmId === 'mortal'`).
   Lý do: dead craft đã xác nhận cả live (maxMp=0) lẫn data
   (spell-domain stats). Dùng `retired` thay vì xóa recipe vì:
   pill vẫn resolvable cho save-compat và test `registerPill`
   (`PillSystem.profession.test.ts` dùng `hoi_linh_dan_mortal`); herb
   base `hoi_linh_thao_mortal_*` vẫn resolve `pillRecipeId` (pool
   grotto sinh theo `PILL_FAMILIES`, nằm ngoài domain data/**); số
   recipe giữ 8 mortal / 74 tổng nên pin
   `EconomySimulation.test.ts` (`toBe(8)`, `toHaveLength(72+2)`)
   không phải đụng. Craft gate (`AlchemySystem.ts:413`) từ chối
   retired → recipe hết hiện trên Đan Phòng và hết chế được;
   dormant job cũ (nếu save có) vẫn settle bình thường.
   Đảo cờ này khi mortal có spell domain.
2. `src/data/pill/pills.ts` — `cultivationPercent` base 0.02 → 0.04.
   Lý do: 14s tu vi cho 50 thạch + 2 thảo + 2 gỗ + 600s là trap so
   với mọi lựa chọn cùng giá (Tụ Linh Trận 25%/24h, cuờng hóa,
   nâng nhà). Gấp đôi vẫn khiêm tốn: ~29s ở mortal t12, ~46s ở
   Luyện Khí t1; slope theo tier giữ nguyên. Test
   `PillSystem.profession.test.ts` đọc `basePercent` động nên không
   cần sửa pin.

Không tune (có lý do):
- Trang bị mỗi kill: là nguồn gear duy nhất của mortal và van
  auto-dissolve hoạt động; giảm weight làm khan hiếm nguồn nâng đồ.
- Essence cap ×3.5 / vendor grade gate / doan_bao_thach deferred
  sink: cấu trúc cố ý hoặc "first-pass" đã được đánh dấu trong code;
  thuộc quyết định thiết kế, không phải outlier số.

## Đề xuất tiếp theo (chờ quyết định, chưa làm)

- **Thảo dược mồ côi:** `hoi_linh_thao_mortal_*` vẫn được Động Thiên
  sinh và vẫn là "sole recipe ingredient" của recipe vừa nghỉ hưu →
  không bán được kể cả ở Luyện Khí+. Fix sạch cần lọc family không có
  recipe live khỏi pool trong `core/production/ProductionCatalog.ts`
  (ngoài domain data/** của PR này).
- **TLD vẫn có thể yếu:** ở 0.04, giá trị thời gian của một viên vẫn
  thua chi phí lò. Nếu muốn alchemy là song song đáng dùng, cân nhắc
  0.06–0.08 base hoặc giảm giá mortal 50→30 thạch. Bản chất alchemy
  là funnel song song nên "thua thời gian lò" không nhất thiết là vấn
  đề — quyết định này cần định hướng thiết kế.
- **Hint vendor:** một dòng chữ "nguyên liệu cảnh giới thấp hơn mới
  bán được" giúp người chơi không bối rối ở Phàm Nhân — ngoài phạm
  vi (UI).
- **Chú thích Linh Mạch:** sửa comment "5% farm online" trong
  `BuildingSystem.ts` khi có dịp — mismatch comment-to-code,
  không thuộc data/**.
