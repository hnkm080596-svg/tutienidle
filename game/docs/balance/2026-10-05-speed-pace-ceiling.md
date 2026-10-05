# Speed Pace Ceiling — Hậu Tích Bạt Phát ramp retune — 2026-10-05

Bối cảnh: pace-floor retune trên `codex/hoa-cau-fireball-vfx` đặt Luyện Khí ~1 ngày,
Trúc Cơ ~1 tuần ở nhịp gốc 10 tv/s, kỳ vọng build full-stack ~0.6x. Đo lại trần
hệ số nhân tốc độ tu luyện xếp chồng theo cảnh giới và siết cho giữ trần.

## A. Đo trần trước chỉnh (branch tip)

Công thức duy nhất (`cultivateTick`):
`cps = 10 × talents_cộng_dồn × ramp(cấp) × (1 + TLT)`

| Nguồn | Hệ số | Xếp chồng? | Ghi chú |
|---|---|---|---|
| `lk_dung_nap` (pool LK) | +10/20/35% | cộng dồn additive | beta tối đa lv1 (+10%) |
| `tc_truc_hon` (pool TC) | +15/30/50% | cộng dồn additive | beta tối đa lv1 (+15%) |
| `pham_nhan_chi_cot` (thưởng Đại Đạo) | +75% | additive, loại trừ ramp | thay `pham_cot` (−75%) |
| `ho_tich_bat_phat` (ramp tạo nhân) | x0.5 + 10%/tầng | nhân riêng (multiplicative) | tầng 18 = x2.2 |
| Tụ Linh Trận | +25% | nhân riêng, 1 effect gộp, refresh 24h | writer `activateTuLinhTran` chưa có UI caller |
| Đan Tụ Linh | ~7-8% required/viên (x1.5 potency) | grant phẳng, không phải rate | funnel bởi kinh tế luyện đan |

Tổ hợp tối đa (2 entitlement decision của beta: Quan Khí→LK pool, đột phá thường→TC pool;
Đại Đạo ẩn nuốt entitlement TC và đổi `pham_cot`→`pham_nhan_chi_cot`; ramp và pnc loại trừ nhau):

| Build | x tại tầng 12 | x tại tầng 18 | Thời gian tương đương tầng 18 |
|---|---|---|---|
| ramp + talents (reachable hôm nay) | 2.00 | 2.75 | **0.36x — sát sàn** |
| ramp + talents + TLT (wired) | 2.50 | 3.44 | **0.29x — VI PHẠM sàn 0.35x** |
| pnc + lk1 (+TLT) | 2.31 | 2.31 | 0.43x |
| talents + TLT (không ramp) | 1.56 | 1.56 | 0.64x |

## B. Chỉnh số

Một hằng số duy nhất — nguồn lớn nhất và là nguồn duy nhất tự tăng theo tầng:

- `ho_tich_bat_phat.effects[].perRealmLevel: 0.1 → 0.05`
- description `nhanh thêm 10%` → `nhanh thêm 5%` (giữ đúng lời quảng cáo)

Không đụng: realm bases (đúng chỉ dẫn), TLT 0.25 (writer chưa nối UI, đã bounded bởi
merge 1-effect + validator), talents additive (giữ "speed talent cảm thấy mạnh"),
pill % (kinh tế luyện đan — mặt nạ worker khác), attribute points +1/tầng,
technique rank ceiling = realmLevel (đã realm-paced sẵn).

## C. Sau chỉnh

| Build | x tầng 12 | x tầng 18 | Thời gian tương đương tầng 18 | So sàn 0.35x |
|---|---|---|---|---|
| ramp + talents | 1.31 | 1.69 | 0.59x | OK — ≈ declared 0.6x |
| ramp + talents + TLT (wired) | 1.64 | 2.11 | 0.47x | OK (+0.12 margin) |
| pnc + lk1 (+TLT) | 2.31 | 2.31 | 0.43x | OK (+0.08 margin) |
| talents + TLT | 1.56 | 1.56 | 0.64x | OK |

Full-18 effective time (declared bases LK=70', TC=550'), ramp build talents+TLT:
LK 17.4h (0.74x), TC 126h ≈ 5.3 ngày (0.75x). Sàn tức thời nghiêm nhất nhất là
đỉnh tầng 18 = 0.474x — giữ trên 0.35x mọi tổ hợp reachable.

Trade-space: 0.06 (tầng 18 wired 0.42x, margin 0.07) / 0.07 (0.379x, margin mỏng
0.03) bị loại vì margin trần; 0.05 giữ pay-off đỉnh +35% (ramp vẫn là đòn bẩy
rate lớn nhất cuối cảnh giới) và đặt trần reachable hôm nay đúng ~0.6x declared.

## D. Flag cấu trúc (không sửa — sửa đổi design)

1. **Realm bases chưa land trên branch.** `baseCultivationMinutes` tip vẫn
   mortal 1 / LK 22 / TC 64, trùng `origin/master` — declared 70/550 không có
   trong lịch sử. Toàn bộ số "declared" trên tính theo mô hình, không verify
   được trên data thật. Nếu retune bases của worker khác land sau, số liệu
   tỉ lệ đứng yên (bảng C theo hệ số), thời gian tuyệt đối scale theo bases.
2. **Offline EM-02 stale-TLT edge** (`stores/player.ts` `computeOfflineProgress`):
   `unbuffedCultivationPerSecond = savedCps / (1 + percentAtSave)` lấy TLT live
   tại `lastSavedAt`. Nếu TLT hết hạn trong khe tick→save, `savedCps` vẫn nướng
   ×1.25 vào base "unbuffed" → over-grant tới +25% trong cả cửa sổ capped.
   Fix đúng là re-derive snapshot lúc save hoặc lúc restore — đụng thiết kế
   restore path, không phải tune số. Bounded: ≤ +25% của grant, không chồng.
3. **`getCultivationRampMultiplier` là last-wins, không stacking** — vòng lặp
   ghi đè `multiplier` mỗi effect `cultivation_ramp` (effect sau thắng, không
   nhân không cộng). An toàn hôm nay vì chỉ có 1 talent ramp; nhưng nếu data
   thêm ramp thứ hai thì hành vi là "nguồn sau nuốt nguồn trước" — contract
   ngầm, nên pin khi mở rộng thiết kế.
4. **`activateTuLinhTran` không có production caller** (chỉ test gọi). +25% TLT
   vẫn được tính trong mọi bảng trần vì writer sẵn sàng và validator/offline
   tôn trọng nó — khi nào wire UI, số đã nằm trong envelope.
5. **`totalCultivationGained` không điều khiển technique tier** — brief đề cập
   "technique tier pacing (totalCultivationGained thresholds)" nhưng code không
   có threshold nào đọc field này; rank ceiling = `min(18, realmLevel)` đã
   realm-bound sẵn. Không có gì để retune.
6. **Offline cap 24h** coherent với declared gates (TC ~7 phiên capped cho full
   18 — đúng "by design"); với bases hiện trên branch thì 1 phiên capped cover
   toàn bộ TC (21.8h < 24h) — tự hợp khi bases land.

## E. Verify

- `npm run type-check` — xem log phiên.
- `npx vitest run` scoped: CultivationTick, player.talentM2, player.cultivationSpeed,
  TalentEffects, TuLinhTranBalance, betaWriterBounds T21/Tc8, BetaJourney.
- Pins cập nhật: CultivationTick.test (lvl11 +0%, thêm lvl18 +35%), player.talentM2
  (t11 x1.0 / t12 x1.05). Validator bounds tự propagate (cùng getters).
