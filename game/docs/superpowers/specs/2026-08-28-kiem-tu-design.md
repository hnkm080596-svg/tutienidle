# Kiếm Tu — Huy Kiếm / Kiếm Trận / Bạt Kiếm (Design)

> Spec chốt 2026-08-28. Trạng thái: ĐÃ DUYỆT với chủ game. Plan implement:
> `docs/superpowers/plans/2026-08-28-kiem-tu-tu-luc.md`.

## 1. Nguyên lý thiết kế

Kiếm Tu có **2 đường con**: **Kiếm Trận** (mặc định) và **Bạt Kiếm** (ẩn).
Nền của cả 2 là **Huy Kiếm** — đòn đánh thường Phàm Nhân, tiến hóa vĩnh
viễn theo số lần cast. Huy Kiếm KHÔNG BAO GIỜ bị gỡ khỏi slot 0.

Đối xứng triết lý:

| | Kiếm Trận | Bạt Kiếm |
|---|---|---|
| Cách đánh | Nhịp **tốc đánh**, AoE liên tục | **Tụ lực**: đứng yên, mỗi x giây 1 phát AoE toàn màn hình |
| Nguồn sức mạnh | Kiếm Ý **combat** (reset mỗi trận) | **Thời gian tụ** (x càng lớn phát quạt càng nặng) |
| Mở đường | Mặc định lúc chọn Kiếm Tu | **Ẩn** — gate Huy Kiếm Lv3 + 9,999 cast |

## 2. Rework Huy Kiếm (`tram`)

- **Bộ đếm cast VĨNH VIỄN**: tái dùng `Skill.totalExperience` (không reset
  khi lên cấp, đã lưu trong save) — ngữ nghĩa mới: `huyKiemCastCount`.
- **Sát thương**: mỗi **10 cast → +1 flat damage** vào effect `damage`
  (cộng vào `value`), **KHÔNG có trần** (9999 cast = +999). Bỏ hoàn toàn
  `ACTIVE_SKILL_DAMAGE_PERCENT_PER_LEVEL = 0.05` cho Huy Kiếm (5% quá
  nhiều). Huy Kiếm là skill DUY NHẤT đi bằng flat, không %.
- **Level: đúng 3 nấc tuyến tính** (thay `getHuyKiemExperienceToNextLevel`
  mũ 1.4 hiện tại):
  - Lv1 → Lv2: **1,000 cast** tích lũy.
  - Lv2 → Lv3: **10,000 cast** tích lũy.
  - Lv3 là trần level; damage tiếp tục tăng vô hạn qua flat counter.
- Huy Kiếm giữ `execution: 'attack_speed'`, là basic slot 0 suốt đời
  (kể cả sau khi đổi sang đường Bạt Kiếm — đường về sau vẫn cast để nuôi
  counter phục vụ Bạt Kiếm).

## 3. Đường KIẾM TRẬN (mặc định)

### 3.1 Thang node chính theo cảnh giới (9 bậc = 9 đại cảnh giới)

Mỗi bậc **mở khóa 1 chiêu AoE mới mạnh hơn**; số kiếm trong trận = số
trong tên. Node prereq = [chiêu trận trước (kind 'node') + đại cảnh giới
(kind 'realm')].

| # | Trận | Cảnh giới gate | Chiêu mở |
|---|---|---|---|
| 1 | Lưỡng Nghi | Luyện Khí (root, cost 0 lúc Quán Khí) | 2 kiếm |
| 2 | Tam Tài | Trúc Cơ | 3 kiếm |
| 3 | Tứ Tượng | Kim Đan | 4 kiếm |
| 4 | Ngũ Hành | Nguyên Anh | 5 kiếm |
| 5 | Lục Đạo | Hóa Thần | 6 kiếm |
| 6 | Thất Tinh | Luyện Hư | 7 kiếm |
| 7 | Bát Quái | Hợp Thể | 8 kiếm |
| 8 | Cửu Cung | Đại Thừa | 9 kiếm |
| 9 | **Vô Cực Kiếm Trận** | **Độ Kiếp** | kiếm trận vô cực — đỉnh thang |

### 3.2 Cơ chế chiêu trận (9 skill data mới)

- `execution: { kind: 'attack_speed' }` — nhịp theo **tốc đánh**.
- `target: 'all_enemies'` (shape `all_lanes` có sẵn) — AoE toàn màn hình;
  level sau có area/hiệu ứng lớn hơn qua growth node.
- Damage = metal, scale theo **`currentSwordIntent`** qua
  `swordIntentDamageRatio` — **KHÔNG tiêu Ý**, chỉ đọc. Kiếm Ý là tài
  nguyên combat thuần (pool `MAX_SWORD_INTENT`, reset mỗi trận) — đúng
  "kiếm ý càng tích nhiều càng mạnh, nhưng không tích kiểu vĩnh viễn".
  (Kiếm Ý vĩnh viễn `SwordIntentSystem` từ `totalCultivationGained` vẫn
  giữ nguyên — nguồn stat riêng, không đụng đường này.)
- Chiêu mới mở = **tự thay vào slot "Kiếm Trận" riêng**; chiêu cũ về
  codex (vẫn xem, không mất). Slot trận là slot loadout thứ 5 (slot 4),
  tách khỏi 3 slot basic/special/ultimate hiện có.

### 3.3 Tổ chức skill trong loadout Kiếm Tu (5 slot)

| Slot | Skill | Ghi chú |
|---|---|---|
| 0 | Huy Kiếm | basic, vĩnh viễn |
| 1 | Kiếm Khai Thiên Môn | special cooldown, gate Trúc Cơ (giữ nguyên) |
| 2 | Vạn Kiếm Triều Tông | **ultimate, gate Trúc Cơ** (xem 3.4) |
| 3 | (dự phòng — Tâm Pháp innate / để trống) | |
| 4 | **Slot Kiếm Trận** | auto-replace theo thang 3.1 |

**Ngự Kiếm Thuật** (`ngu_kiem_thuat`): bị thay vai trò bởi các chiêu
trận từ Lưỡng Nghi trở đi. Đề xuất: giữ trong data/codex như chiêu
chuyển tiếp, không còn cấp từ kit. Chi tiết chuyển đổi lưu trong plan.

### 3.4 Vạn Kiếm Triều Tông = ultimate path

- **Ultimate là dạng skill MỌI path đều có, mở ở Trúc Cơ.** Riêng đường
  Bạt Kiếm KHÔNG có ultimate (identity của nó là nhịp tụ lực đều).
- Sửa data `van_kiem_trieu_tong`: thêm
  `requiredRealmId: 'foundation_establishment'`; KHÔNG còn cấp sẵn từ
  kit lúc nhập môn — mở/hiện gate Trúc Cơ (slot hiển thị khóa đến khi
  đủ cảnh giới).

### 3.5 Phạm vi code trong đợt này (PRODUCT SCOPE)

Progression hiện chỉ mở tới Trúc Cơ tầng 18 (gate Kim Đan đóng cứng —
`canTriggerRealmBreakthrough()` return false). Do đó:

- **Implement đủ**: Lưỡng Nghi + Tam Tài + Vạn Kiếm gate Trúc Cơ + toàn
  bộ đường Bạt Kiếm + Huy Kiếm rework.
- **Chỉ ghi data + khóa chờ**: Tứ Tượng → Vô Cực Kiếm Trận (chain node
  + skill data đầy đủ, tự mở khi content Kim Đan+ ra mắt — không cần
  sửa logic sau này).

## 4. Đường BẠT KIẾM (ẩn)

### 4.1 Gate mở đường

- Điều kiện: **Huy Kiếm đạt Lv3** VÀ **≥ 9,999 cast** tích lũy.
- Kiểm tra lúc chọn đường (nút đổi đường chỉ hiện khi đủ). Đổi được
  ngoài combat, qua lại 2 đường tự do (pattern `setArtifactPath`).

### 4.2 Bạt Kiếm Thuật — cơ chế thuần tụ lực

- **Không cooldown, không cast time.** Vào trận nhân vật **tự động
  tụ lực** (idle game — không cần bấm).
- **Mỗi x giây quạt 1 phát AoE toàn màn hình** (`target:
  'all_enemies'`). x = **thời gian tụ lực**.
- **x khởi điểm 3 giây, trần 9 giây**, chỉnh bằng **UI riêng trong trận**
  (slider ở khu CombatControlBar) — "để tránh phí thời gian" (tuỳ trận
  kéo x lên cho đòn nặng, hoặc hạ xuống dọn màn nhanh).
- **Sát thương dựa vào thời gian tụ**: multiplier phát quạt tăng theo x
  (nền: ×1 tại 3s → ×3 tại 9s, tuyến tính — hằng số điều chỉnh qua
  playtest).
- **Trong lúc tụ: nhận càng nhiều sát thương → gây càng nhiều** — amp =
  % maxHP đã mất trong kỳ tụ hiện tại × hệ số (nền 1.0). Đứng ăn đòn
  trong tụ là chủ đích, không phải khuyết điểm.
- Tụ kết thúc khi: hết trận / chết / bị khống chế cứng (stun, thạch
  hóa). Phát quạt đang tích KHÔNG được phát — mất tích lũy amp của kỳ.

### 4.3 Node cây Bạt Kiếm — RÀNG BUỘC CỨNG

Cây node Bạt Kiếm **CHỈ được phép có** 2 loại node:

1. **Tăng thời gian tụ**: tăng trần x (tối đa 9s), tăng hệ số dmg theo x.
2. **Phòng thủ trong lúc tụ**: ward/giáp, giảm damage nhận, không bị
   gián đoạn khi trúng đòn thường.

**TUYỆT ĐỐI KHÔNG có node giảm thời gian tụ.** Damage và thời gian là
cùng một trục đánh đổi — tăng x là tăng sức mạnh.

## 5. Node Tree hạ tầng (`data/progression/KiemTuNodes.ts`)

- 2 cây dùng chung `ProgressionNode`/`NodeSystem` (aggregator, idempotent
  — KHÔNG push modifier lúc mua):
  - **Cây Kiếm Trận** (`branchTag: 'kiem_tran'`): root Lưỡng Nghi →
    chain 9 trận + growth phụ (kiếm xuyên thêm mục tiêu, +Ý mỗi hit,
    AoE radius).
  - **Cây Bạt Kiếm** (`branchTag: 'bat_kiem'`): root gate (4.1) →
    growth (trần x, hệ số dmg/x, def trong tụ) → keystone "Bạt Kiếm
    Thức" (bật chế độ đường Bạt Kiếm).
- **Prereq kind mới**: `{ kind: 'skillCastCount'; skillId: string;
  level?: number; count?: number }` — thoả khi skill đã học đạt level
  hoặc tổng cast đạt ngưỡng (đọc từ save). Gate root Bạt Kiếm dùng
  kind này.

## 6. Engine cần thêm (tổng hợp)

1. `SkillExecutionPolicy` + `kind: 'channel'`: tick lặp theo `x` giây,
   tự động, không CD clock/không cast time; dừng khi chết/khống chế.
2. `CombatEntity`: `tuLucElapsed` (giây trong kỳ tụ hiện tại),
   `tuLucDamageTakenPercent` (% maxHP đã mất trong kỳ, reset mỗi kỳ).
3. `SkillSystem.getEffectiveSkill()`: hook flat-damage Huy Kiếm
   (`floor(totalExperience / 10)`), áp cho skill `tram` — 1 điểm duy
   nhất quyết định damage như kiến trúc hiện có.
4. Slot loadout "Kiếm Trận" (slot 4) + logic auto-replace khi mở trận mới.
5. UI slider x trong trận (CombatControlBar) — chỉ hiện khi đường Bạt
   Kiếm đang bật.
6. Gate `canChooseCultivationPath` mở rộng: nút đổi đường Kiếm Trận ↔
   Bạt Kiếm ngoài combat, điều kiện 4.1.
7. `SwordZone` (biến thể `LavaZone`, element metal, không decay theo
   thời gian mà theo số lần bị chạm) — cho keystone growth Kiếm Trận.
8. VFX preset `tu_luc` (xoáy kiếm quanh người) + `bat_kiem_quat` (sóng
   kiếm lan toàn màn) trong `data/vfx`.

## 7. Save

- `Skill.totalExperience` đã có sẵn trong save — KHÔNG cần field mới cho
  bộ đếm cast (tương thích save cũ tự nhiên).
- Đường đang chọn (`kiem_tran` | `bat_kiem`) + trần x đã mở: thêm field
  mới trên `PlayerData` (dev phase — không cần migration, save cũ có thể
  vỡ theo AGENTS.md).

## 8. Test dự kiến

- **Unit**: 10 cast = +1 flat dmg, vô trần; Lv2@1000/Lv3@10000;
  multiplier phát quạt theo x; amp = %HP mất × hệ số; đúng x giây đúng
  1 tick trúng mọi hàng; gate Bạt Kiếm (Lv3 + 9999); auto-replace slot
  trận; Vạn Kiếm khóa đến Trúc Cơ.
- **Data validation**: chain 9 trận đúng realm prereq + thứ tự; cây Bạt
  Kiếm không chứa node giảm thời gian (validation khởi động — sai data
  phải báo lỗi rõ ràng).
- **Integration**: đổi đường ngoài combat (không đổi giữa trận); tụ tự
  động khi vào trận; khống chế cắt tụ; slider đổi x giữa trận có hiệu
  lực từ kỳ tụ kế.

## 9. Notes / Đề xuất đã ghi nhận với chủ game

1. "Ngũ **Hình**" trong brief gốc được hiểu là Ngũ **Hành**.
2. Ngự Kiếm Thuật & Kiếm Khai Thiên Môn của kit cũ: Ngự Kiếm nhường vai
   cho các chiêu trận (đề xuất giữ trong codex); Kiếm Khai Thiên Môn
   giữ special slot 1.
3. Ultimate Trúc Cơ cho **Pháp Tu** chưa tồn tại trong data — cần design
   riêng, ngoài phạm vi spec này.
4.Scope code ngay: chỉ Lưỡng Nghi/Tam Tài/Bạt Kiếm/Huy rework; Tứ Tượng
  trở đi là data khóa chờ (mục 3.5).
