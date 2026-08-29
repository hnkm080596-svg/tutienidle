# Design: Kiếm Thế / Kiếm Ý — Hệ tài nguyên 2 route Kiếm Tu

> Ngày: 2026-08-29 · Trạng thái: ĐÃ DUYỆT bởi người dùng qua các vòng hỏi brainstorming
> Phạm vi: route chốt vĩnh viễn tại Quán Khí, 2 tài nguyên mới (Kiếm Thế / Kiếm Ý), 1 active skill duy nhất mỗi route, chuyển skill cũ thành passive node, gỡ Nộ, 2 ult manual.

## 0. Nguyên tắc định vị 2 route (bản sắc thiết kế)

- **Đa Kiếm (route Kiếm Trận)** — dành cho người chơi chủ động: mạnh ngay từ Lưỡng Nghi, chiều sâu build qua combo on-hit (2→9 loại theo cấp trận), trần **hữu hạn** theo realm (tiến trình = chuỗi keystone trận tiến hóa, không tầng vĩnh viễn).
- **Đơn Kiếm (route Bạt Kiếm)** — dành cho người treo máy: **một chiêu duy nhất** (Bạt Kiếm Thức), yếu lúc mở route (nerf giai đoạn đầu), trần **vô hạn** theo tầng Kiếm Ý tích lũy qua boss diệt — càng treo càng mạnh, mất não nhưng bền.

## 1. Chốt route vĩnh viễn tại Quán Khí

- Khi chọn Kiếm Tu ở Quán Khí, hệ thống đọc `tram` (Huy Kiếm):
  - `tram` < Lv3 (< 10.000 lần trảm) → **route Kiếm Trận**, branch `bat_kiem` ẩn vĩnh viễn.
  - `tram` ≥ Lv3 → **route Bạt Kiếm**, branch `kiem_tran` ẩn vĩnh viễn.
- Gỡ hẳn `GameManager.setKiemTuRoute` (đổi route). `player.kiemTuRoute` ghi đúng 1 lần lúc chọn path, không đổi.
- Node `bat_kiem_thuc` (keystone thuần gate hiện tại) **gỡ** — mất vai trò vì route không còn đổi.
- SkillPathPanel: gỡ toggle Kiếm Trận/Bạt Kiếm (chỉ còn 1 branch hiển thị theo route).
- **Huy Kiếm (tram) sau chốt route**: tháo khỏi loadout, không thể trang bị lại cho Kiếm Tu (Phàm Nhân chưa chọn path vẫn dùng bình thường).
- Cây ẩn "Kiếm Tâm Ẩn" placeholder (dead-code `level >= 18`) gỡ — thay bằng hệ tầng Kiếm Ý thật.

## 2. Kiếm Thế — tài nguyên route Kiếm Trận

| Thuộc tính | Giá trị |
|---|---|
| Kiểu | Pool **trong trận**, reset về 0 đầu mỗi trận |
| Cap | **100** |
| Gain | Mỗi lần cast kiếm trận **+ số kiếm của trận** (Lưỡng Nghi +2, Tam Tài +3, … Vô Cực +9) |
| Tiêu hao 1 — Ult | Tru Tiên Kiếm Trận: cost = **10 × số kiếm trận hiện có** (Lưỡng Nghi 20 → Vô Cực 90) — "trận càng cao đốt càng nhiều", luôn ~10 cast tích đủ |
| Tiêu hao 2 — Buff liên tục | **+1% sát thương kiếm trận & on-hit mỗi 2 điểm Kiếm Thế** (đầy 100 = +50%) — decision: giữ pool ăn +50% hay đốt cho ult |
| Bar UI | Bar 3 của Kiếm Tu hiển thị Kiếm Thế 0–100 khi route KT |

### Ult Tru Tiên Kiếm Trận (skill + node mới, branch `kiem_tran`)

- Mở khóa bằng node major ở **Trúc Cơ** (realm gate `foundation_establishment`).
- Kích hoạt: **nút manual + toggle auto** trong CombatControlBar (mặc định auto: tự bắn khi đủ cost). Ult KHÔNG chiếm loadout slot.
- Hiệu ứng: **Nuke + zone** — 1 đòn AoE lớn mở màn, sau đó kiếm trận trường tồn X giây gây DoT vùng (đề xuất X = 6s, tick 1s).
- Sát thương nuke scale theo cấp trận đang có (số kiếm); zone tick dùng giá trị tick của trận hiện tại.
- On-hit effects (mục 4) áp trên **mọi hit kiếm trận + nuke + zone tick của ult**.

## 3. Kiếm Ý — tài nguyên route Bạt Kiếm (gộp pool combat cũ)

Hai lớp, thay thế pool `currentSwordIntent` 0–9999 cũ:

### 3.1 Lớp vĩnh viễn (tầng)

- Nguồn: diệt boss — gồm **boss stage (isBoss) + boss Độ Kiếp + elite/mini-boss**.
- **Tầng vô hạn, chi phí tăng dần**: tầng N cần tổng cộng `10 + 5×(N−1)` boss cộng dồn từ tầng trước (t1: 10 boss, t2: +15 = 25, t3: +20 = 45, …).
- Mỗi tầng **+10 Kiếm Ý vĩnh viễn** — Kiếm Ý vĩnh viễn **không bao giờ bị tiêu hao**.
- Mọi công năng scale theo tầng (mục 3.3).

### 3.2 Lớp tạm thời (trong trận)

- Bắt đầu trận = đúng bằng số Kiếm Ý vĩnh viễn (tầng 3 = khởi đầu 30).
- Gain trong trận: **mỗi tick tụ lực (channel BKT)** + theo **sát thương nhận vào** (đề xuất: +1 Kiếm Ý mỗi tick; +1 Kiếm Ý mỗi 5% maxHP mất).
- Cap trong trận: `vĩnh viễn + 900` (khớp ví dụ "10 vĩnh viễn + 90 tạm").
- **Quy tắc tiêu hao: ăn tạm trước, vĩnh viễn bất khả xâm phạm.** Ví dụ: có 10 vĩnh viễn + 90 tạm, cast tốn 100 → mất 90 tạm, giữ 10 vĩnh viễn.

### 3.3 Công năng theo tầng vĩnh viễn (mở bằng node branch `bat_kiem`)

Mọi hiệu ứng **scale theo tầng Kiếm Ý vĩnh viễn**, không theo pool trong trận:

- Tăng tỉ lệ đỡ đòn, hiệu quả đỡ đòn (node major riêng).
- **Hồi sinh khi HP về 0**: 1 lần/trận, tốn Kiếm Ý lớn (đề xuất 100, ưu tiên tạm trước), hồi 50% HP — cần node major riêng.
- Sát thương BKT + ult KKTM: `× (1 + 0.5% × tầng)`.
- Tier Kiếm Ý theo tu vi cũ (SwordIntentSystem, +0.5%/9999 tu vi): **gỡ hẳn**, thay bằng tầng boss.

### 3.4 Nerf BKT giai đoạn đầu (cân bằng khi mới mở route)

- **Base theo tầng**: sát thương BKT = `base × (0.6 + 0.02 × tầng)` — 0 tầng chỉ 60% base, ~20 tầng về 100%, vô hạn về sau.
- **Hấp thụ Huy Kiếm giữ nguyên**: flat bonus `floor(tổng số lần trảm / 10)` cộng vào BKT (10.000 trảm = +1.000 — phần thưởng 10k casts không nerf).
- **Amp gánh dmg-taken**: `BAT_KIEM_AMP_PER_DAMAGE_TAKEN` từ 1.0 → **0.3**; node BK riêng phục hồi +0.1/level (đường về 1.0 phải qua đầu tư node).

### Ult Kiếm Khai Thiên Môn (chuyển thành ult route BK)

- Kích hoạt: **nút manual + auto-AI** — auto bắn khi: trong trận có boss/Độ Kiếp **VÀ** Kiếm Ý tạm ≥ ngưỡng tối thiểu (đề xuất 500).
- Hiệu ứng: tụ lực ngắn (đề xuất cast ~2s) → **đốt TOÀN BỘ Kiếm Ý tạm** → đòn **đơn mục tiêu** cực lớn (ưu tiên boss), **overkill tràn toàn màn hình** — phần sát thương dư phân ra mọi địch còn sống (đề xuất ratio 50%).
- Sát thương: `base × (1 + Kiếm Ý đốt × ratio)` — reuse cơ chế `swordIntentDamageRatio` hiện có.
- Ult KHÔNG chiếm loadout slot.

## 4. On-hit effects — Đa Kiếm (branch `kiem_tran`)

- **Cơ chế proc**: mỗi hiệu ứng có **tỉ lệ % roll độc lập mỗi hit**; node level tăng tỉ lệ — **3%/level, maxLevel 5 = 15%**.
- **Phạm vi**: mọi hit kiếm trận + nuke + zone tick của ult TTKT.
- **Kiếm Thế tăng sát thương** (mục 2) áp chung lên on-hit.
- **Kiến trúc**: on-hit chạy qua **ModifierSystem/StatBlock + damage pipeline hiện có** (buff hệ thống sẵn có), không hack sát thương trực tiếp.
- Số loại hiệu ứng mở được = **số kiếm của trận** (Lưỡng Nghi 2 → Vô Cực 9); đã mua node = kích hoạt vĩnh viễn.

| Cấp trận mở | Node on-hit | Hiệu ứng |
|---|---|---|
| Lưỡng Nghi (2) | Kiếm Khí Truy Hồn | on-hit cộng thêm sát thương kim |
| Lưỡng Nghi (2) | Kiếm Phong Thần Tốc | on-hit +tốc đánh (stack tạm trong trận) |
| Tam Tài (3) | Kiếm Thương Xuất Huyết | on-hit gây chảy máu (DoT — tái dùng ailment `van_kiem_vu`) |
| Tam Tài (3) | Kiếm Mạch Trấn Trụ | on-hit cơ hội choáng/trói chân |
| Tứ Tượng (4) | Kiếm Ẩn Phản Kích | on-hit né phản đòn |
| Tứ Tượng (4) | Kiếm Trận Hấp Linh | on-hit hút máu |
| Ngũ Hành (5) | Kiếm Vân Phá Giáp | on-hit xuyên/giảm giáp |
| Lục Đạo (6) | Kiếm Quang Nhất Thống | on-hit cộng crit stack |
| Thất Tinh+ (7–9) | Kiếm Thần Phán Quyết | on-hit nguyên tố ngũ hành xoay vòng |

Content dừng ở Trúc Cơ (Tam Tài): chỉ 4 node đầu thực mở được; 5 node còn lại nằm ở data chờ realm sau (cùng pattern khóa realm Vô Cực hiện tại).

## 5. Bộ kỹ năng sau chốt route — mỗi route 1 active skill duy nhất

### 5.1 Route Kiếm Trận

- **Slot 0 = Kiếm Trận tiến hóa**: Lưỡng Nghi → Tam Tài → Tứ Tượng → … — mỗi keystone mới **thay thế** skill cũ (1 skill chiến trận duy nhất, mạnh dần theo realm).
- Ult TTKT = nút riêng (không loadout slot).
- Không skill nào khác trong loadout Kiếm Tu.

### 5.2 Route Bạt Kiếm

- **Slot 0 = Bạt Kiếm Thức** (skill `bat_kiem_thuat` đổi tên hiển thị; giữ nguyên channel + tick slider 3–9s + cơ chế amp dmg-taken hiện có).
- Ult KKTM = nút riêng.
- Không skill nào khác trong loadout Kiếm Tu.

### 5.3 Bảng chuyển skill cũ thành passive node (tên giữ, hiệu ứng theo node)

| Skill cũ | Trở thành |
|---|---|
| Huy Kiếm (tram) | Hấp thụ vào công thức BKT (`floor(casts/10)` flat) + Phàm Nhân giữ dùng trước chốt path |
| Ngự Kiếm Thuật (ngu_kiem_thuat) | Node KT — mỗi cast kiếm trận phóng thêm kiếm ứng hỗ trợ on-hit |
| Vạn Kiếm Triều Tông (van_kiem_trieu_tong) | Node KT — cường hóa ult TTKT (+ratio nuke, kiếm rơi zone) |
| Thái Hư Nhất Kiếm (thai_hu_nhat_kiem) | Node BK — crit/sát thương theo chất Thái Hư |
| Phiêu Vân Bộ (phieu_van_bo) | Node BK — né tránh/tốc đánh (thay buff self cũ) |
| Phá Thiên Nhất Kích (pha_thien_nhat_kich) | Node BK — burst đơn mục tiêu vs boss (hỗ trợ KKTM) |
| Kiếm Khai Thiên Môn (kiem_khai_thien_mon) | Ult BK (mục 3.4) |
| Kiếm Tâm Lãnh Liệt (passive_kiem_tam_lanh_liet) | Passive node (crit stack hiện có) |

### 5.4 Gỡ Nộ (rage)

- `resourceType: 'rage'` + `currentRage` + MAX_RAGE gỡ khỏi hệ thống (Phá Thiên Nhất Kích là consumer duy nhất, giờ thành node). Dev phase — xóa sạch, không để mồ côi.

## 6. UI Combat

- **Bar 3** CombatStatusBar: route KT → Kiếm Thế 0–100 | route BK → Kiếm Ý tạm (cap động) + badge tầng vĩnh viễn.
- **Nút Ult** mới trong CombatControlBar (hiện khi route có ult đã mở): manual click + toggle auto (TTKT mặc định auto; KKTM auto-AI theo điều kiện boss + ngưỡng 500).
- KiemTuCombatHud: gỡ hiển thị chain slot 1/2 (chỉ còn slot 0 + nút ult); Tụ Lực progress bar giữ cho BK.
- SkillPathPanel: 1 branch theo route; loadout strip Kiếm Tu hiển thị đúng 1 slot.

## 7. Save & data (dev phase — không migration)

- `PlayerData` thêm tường minh (pattern `createDefaultPlayer` cho Pinia reactivity):
  - `bossKillCount: number` — tổng boss diệt vĩnh viễn (tầng + vĩnh viễn kiếm ý tính từ đây).
  - `kiemTuRoute` giữ như hiện tại nhưng ghi 1 lần lúc chọn path.
- Save v53: bump `CURRENT_SAVE_VERSION` + comment block theo convention (precedent v19 cultivationPath, v21 totalCultivationGained).
- Pool trong trận (Kiếm Thế / Kiếm Ý tạm) = state CombatEntity, không persist.
- `SkillResourceType`: bỏ `'rage'`; `'sword_intent'` đổi ngữ nghĩa thành Kiếm Ý tạm (giữ key hoặc đổi `'kiem_y'` — implementation quyết định, ưu tiên giữ key để ít rủi ro).

## 8. Testing (pattern hiện tại)

- Unit:
  - Route chốt 2 chiều (tram < / ≥ Lv3), vĩnh viễn (không API đổi).
  - Kiếm Thế: gain = số kiếm/cast, cap 100, buff +1%/2 điểm, cost ult 10×số kiếm.
  - Kiếm Ý: tầng công thức cộng dồn (10/25/45…), +10 vĩnh viễn/tầng, khởi đầu trận = vĩnh viễn, ưu tiên tiêu tạm trước, cap tạm +900.
  - Nerf BKT: base 60% @0 tầng, 100% @20 tầng; amp 0.3 + node +0.1.
  - Hồi sinh: 1 lần/trận, tốn 100 tạm trước, hồi 50%.
  - Ult KKTM: đốt all tạm (giữ vĩnh viễn), overkill tràn 50%, auto-AI điều kiện boss + ≥500.
  - On-hit: roll 3%/level max 15%, áp cả nuke/zone, chạy qua modifier pipeline.
- Data validation: KiemTuNodes mới (9 on-hit node + node chuyển đổi skill cũ + node công năng kiếm ý) — pattern test data hiện có.
- BattleSystem channel test hiện có: giữ nguyên hành vi (amp cơ chế cũ, chỉ đổi hằng số).

## 9. Phạm vi loại trừ / chờ sau

- Realm trên Trúc Cơ: on-hit node 5–9 + kiếm trận Tứ Tượng+ nằm data chờ (khóa realm, đã có pattern).
- Cân bằng số liệu cuối (base BKT, ratio KKTM, ngưỡng 500): tinh chỉnh khi playtest, số liệu trong spec là điểm bắt đầu.
- VFX ult (cinematic cổng kiếm / nuke trận): dùng preset có sẵn nếu khớp, làm mới để sau.
