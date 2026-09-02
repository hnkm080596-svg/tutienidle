#Design: Pháp Tu Thuần Hệ — Chi tiết 20 skill chuỗi B–E, 5 Ultimate, node chuỗi + biến thể C/D

> Ngày: 2026-09-03 · Trạng thái: DRAFT chờ duyệt
> Spec cha: `2026-08-30-phap-tu-dao-sac-design.md` (§2.1–§2.4, §1.2, §6, §7). Spec này KHÔNG thay đổi quyết định nào của spec cha — chỉ chi tiết hóa phần spec cha để lại cho plan ("Skill B–E chi tiết", "số liệu ult", "node biến thể C/D").
> Phạm vi: (1) 20 skill B–E của 5 chuỗi Thuần — tên/id mới, cơ chế, số liệu; (2) 5 Ultimate theo Thế — hiệu ứng đặc trưng thật thay AoE thuần; (3) node chuỗi trong `PhapTuNodes.ts` — Lập Đạo Thuần, unlock B–E, ult, chuyên sâu Thế, biến thể C/D (2 chọn 1).
> Ngoài phạm vi: nhánh Đa Pháp, Thân Hòa, Sinh/Khắc adjacency, `PlayerData.phapTuDao` + refund, UI ngôi sao — vẫn theo plan cha Task 12–16.

## 0. Hiện trạng hệ thống (đã khảo sát mã)

| Hệ thống | Trạng thái | Ghi chú cho spec này |
|---|---|---|
| `ChainStateSystem.ts` | Xong | Gate cast theo `nextIndex`, `advanceChain`, `resetChainOnKill`; wire trong `BattleSystem` (scheduler + `advanceChainAndGainThe`). Skill ngoài chuỗi tự do. |
| `TheResourceSystem.ts` | Xong | +10/link, +20 finisher (`THE_GAIN_PER_LINK/FINISHER`), cap `MAX_THE = 100`, reset khi ult. Chưa có bonus gain/trần theo node. |
| `UltimateSystem.ts` (phần Pháp Tu) | Xong khung | `PHAP_TU_ULTIMATE_IDS`, `canUse/auto/trigger` — trigger hiện resolve nuke vào MỌI địch (AoE đồng nhất), chưa có hiệu ứng riêng từng hành. |
| `Skills.ts` B–E + 5 ult | Placeholder | 25 skill đã có shape đúng (`execution`, `resourceType`, `target`) nhưng: id vi phạm N2b (`chuc_dung_b`), thiếu `manaScalingRatio`/`attributeScaling` (root A có), Kim đảo thứ tự dấu ấn spec cha, ult chỉ là damage + debuff. `CHAIN_SKILL_IDS` export sẵn. |
| `PhapTuNodes.ts` | Chưa (Task 11) | Vẫn cây cũ: root/power/cadence/mechanic + 2 keystone Reaction/Pure + specs. Chưa có Lập Đạo, node chuỗi, ult, biến thể. |
| `GameManager` | Chưa | Không có `phapTuDao`, không gọi `setChainDefinition`, không wire ult Pháp Tu. |
| Ailment (buffs.ts) | Có | `bong` (refresh, KHÔNG stack), `te_cong` (refresh), `trung_doc` (stack 5), `chay_mau` (stack 5), `thach_hoa`, `troi_chan` (root 2.5s), `choang` (stun 1.5s), `ngung_lo`, `khai_son`, `thach_giap_buff`. |
| `SkillEffectType` | Có | `damage/heal/buff/debuff/add_stack/remove_buff` — nhưng `add_stack`/`remove_buff` CHƯA được `SkillEffectSystem` xử lý cho active skill (thuộc PassiveSystem). |
| Detonate/ward/zone | Có | `consumesAilmentId + damagePerStack (+ healPercentOfDamage)`, `consumesWardForDamage`, `grantsSwordZone` (zone có `element`), `spawnLavaZone`, `hitCountByRealm`, `targeting.shape single/area/line/all_lanes`, `SkillSpecialization` (override effects). |

## 1. Nguyên tắc thiết kế chuỗi (áp dụng chung 5 hành)

1. **Vai trò cố định theo vị trí** (spec cha §2.1 "skill càng muộn càng mạnh"):
   - **A** (root hiện có, giữ nguyên id/tên/số) — mở màn, áp ailment đặc trưng.
   - **B** — nối màn: đòn nhanh, đắp thêm ailment/stack hoặc tự buff dựng thế.
   - **C** — dấu ấn hành (utility/AoE/hồi), có **2 biến thể chọn 1** qua node.
   - **D** — "cash-in" (kích nổ / khuếch đại / lan), có **2 biến thể chọn 1** qua node.
   - **E** — finisher, đòn lớn nhất, +20 Thế, quay về A.
2. **Nhịp chuỗi**: cooldown mỗi link ≤ tổng cast time 1 vòng (~7–8s) để chuỗi không nghẽn khi quay lại (chuỗi đã sequential nên cooldown chỉ chặn spam khi reset-on-kill). Chuẩn: B cd 2 / cast 1.0; C cd 3 / cast 1.2; D cd 4 / cast 1.4; E cd 6 / cast 1.8. Tất cả `execution: { kind: 'cast_time' }`.
3. **Ngân sách sát thương** (× Skill Power, chưa tính detonate): A 1.0 · B 1.1 · C 1.3 (0 nếu C là self-buff) · D 1.5 · E 2.4. Mọi effect `damage` mang `manaScalingRatio: 0.001` + `attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }]` giống A (placeholder thiếu — coi là lỗi cần sửa).
4. **Resource**: `resourceType: 'none'` (theo placeholder + spec cha §9 "không thêm SkillResourceType"); Thế là pool ngoài, không phải cost.
5. **Ailment tái dùng engine** (spec cha §2.2): `bong, te_cong, trung_doc, chay_mau, thach_hoa, troi_chan, choang`. Buff mới chỉ ở `buffs.ts`.
6. **Naming** (`naming-conventions.md` N2/N2b): id = tên hiển thị bỏ dấu, snake_case; KHÔNG hậu tố `_b/_c`. Tên 4 âm Hán-Việt mang khẩu khí vị thần. `buildTag: 'ult'` cho 5 ult (mirror Kiếm Tu, không vào loadout scheduler).
7. **Unlock**: `unlocked: false`, chỉ mở qua node (mục 5). B–E `requiredRealmId` KHÔNG set — realm gate nằm ở node prereq + bảng slot (`SkillLoadoutSlots.ts`) để một chỗ chịu trách nhiệm.

## 2. Năm chuỗi — chi tiết skill

Ký hiệu: `dmg x` = effect damage value x, components 100% element của hành. `→ ailment p%` = effect debuff `ailmentChance p`. Targeting mặc định `single` trừ khi ghi.

### 2.1 Hỏa — Chuỗi CHÚC DUNG (bùng nổ dồn)

Dấu ấn spec cha: A/B/C chồng Thiêu Đốt, D kích nổ mọi Thiêu Đốt, E nuke lan.

| Vị trí | Tên / id | Cơ chế | Số liệu khởi điểm |
|---|---|---|---|
| A | Hỏa Cầu Thuật `hoa_cau_thuat` | giữ nguyên | dmg 1.0, bong 50% |
| B | **Nam Minh Liệt Hỏa** `nam_minh_liet_hoa` | Lửa Nam phương nối đuôi Hỏa Cầu — đắp 1 tầng Bỏng | dmg 1.1 → bong 75%; cd 2 / cast 1.0 |
| C | **Tam Muội Chân Hỏa** `tam_muoi_chan_hoa` | Ba ngọn chân hỏa: đắp Bỏng mạnh; biến thể quyết định tụ/tán | dmg 1.3 → bong 100%; cd 3 / cast 1.2 |
| D | **Chúc Dung Dẫn Nộ** `chuc_dung_dan_no` | Kích nổ TOÀN BỘ Bỏng trên mục tiêu (`consumesAilmentId: 'bong'`) | dmg 1.5 + `damagePerStack: 35` (true dmg); cd 4 / cast 1.4 |
| E | **Hỏa Hà Cửu Thiên** `hoa_ha_cuu_thien` | Sông lửa đổ xuống — nuke lan cả hàng (`targeting: { shape: 'line' }`) | dmg 2.4 → bong 100% (affected_targets); cd 6 / cast 1.8 |

**Yêu cầu dữ liệu**: `bong` phải **stack** để "chồng Thiêu Đốt" có nghĩa (hiện `stackMode: 'refresh'`, Detonate luôn ×1). Đề xuất: `bong` → `stackMode: 'stack', maxStacks: 5`, `dpsRatio 0.3 → 0.15/tầng` (1 tầng yếu hơn, 5 tầng = 0.75 mạnh hơn hiện tại). Ảnh hưởng Bạo Viêm/Hỏa Cầu cũ — xem Notes N1.

**Biến thể C** (node, 2 chọn 1):
- *Tam Muội · Tụ Diễm* `tam_muoi_tu_diem`: single, bong 100% **+ đắp thêm 1 tầng** (2 tầng/cast — qua `add_stack`, xem E-3).
- *Tam Muội · Tán Diễm* `tam_muoi_tan_diem`: `targeting area laneRadius 1`, dmg 1.0, bong 70% lên mọi mục tiêu vùng.

**Biến thể D**:
- *Dẫn Nộ · Liệt Bạo* `dan_no_liet_bao`: `damagePerStack 50`, không gì khác — burst tối đa.
- *Dẫn Nộ · Dư Hỏa* `dan_no_du_hoa`: `damagePerStack 30` + sau kích nổ áp lại 1 tầng bong 100% (effect debuff đứng SAU effect damage) — giữ Bỏng để E/A lặp lại nhanh.

### 2.2 Thủy — Chuỗi THIÊN NGÔ (kiềm chế + hồi)

Dấu ấn spec cha: A/B Tê Cóng, C hồi Pháp Lực, D trói/hấp thụ, E sóng càn quét.

| Vị trí | Tên / id | Cơ chế | Số liệu |
|---|---|---|---|
| A | Thủy Tiễn Thuật `thuy_tien_thuat` | giữ nguyên | dmg 1.0, te_cong 50% |
| B | **Bát Đầu Trấn Thủy** `bat_dau_tran_thuy` | Tám đầu trấn áp — Tê Cóng | dmg 1.1 → te_cong 80%; cd 2 / cast 1.0 |
| C | **Thanh Tuyền Dưỡng Linh** `thanh_tuyen_duong_linh` | `target: 'self'`, buff hồi Pháp Lực | buff `thanh_tuyen` 6s (+8 manaRegenPerSecond, +10% manaRegenPercent, refresh); cd 3 / cast 1.2 |
| D | **Hồi Lưu Thôn Nộ** `hoi_luu_thon_no` | Vòng nước cuốn: trói chân + tự buff hấp thụ | dmg 1.5 → troi_chan 70% + buff self `hoi_luu` 4s (+20% leechPercent); cd 4 / cast 1.4 |
| E | **Bắc Hải Cuồng Lan** `bac_hai_cuong_lan` | Sóng Bắc Hải càn quét toàn bộ dải cột (`targeting all_lanes columnRadius 1`) | dmg 2.4 → te_cong 100%; cd 6 / cast 1.8 |

**Biến thể C**:
- *Dưỡng Linh · Tuyền* `duong_linh_tuyen`: buff `thanh_tuyen` mạnh hơn (+12 regen, 8s).
- *Dưỡng Linh · Băng Giáp* `duong_linh_bang_giap`: thay bằng buff `bang_giap` 6s (+50 wardMax, +5 wardRegenPerSecond) — Thủy phòng thủ.

**Biến thể D**:
- *Thôn Nộ · Cấm Túc* `thon_no_cam_tuc`: troi_chan 100%, bỏ buff hấp thụ.
- *Thôn Nộ · Hấp Lưu* `thon_no_hap_luu`: troi_chan 50%, `hoi_luu` +35% leech 5s.

### 2.3 Mộc — Chuỗi CÂU MANG (nhiễm độc lan)

Dấu ấn spec cha: A/B Trúng Độc, C rễ cấm di chuyển, D lan độc sang kẻ khác, E vườn độc nổ rễ.

| Vị trí | Tên / id | Cơ chế | Số liệu |
|---|---|---|---|
| A | Độc Chưởng `doc_chuong` | giữ nguyên | trung_doc 100% (không dmg) |
| B | **Xuân Sanh Độc Dực** `xuan_sanh_doc_duc` | Cánh độc Câu Mang — đắp Trúng Độc | dmg 1.1 → trung_doc 100%; cd 2 / cast 1.0 |
| C | **Câu Mang Căn Trì** `cau_mang_can_tri` | Rễ trùm mục tiêu — cấm di chuyển, độc ngấm | dmg 1.3 → troi_chan 80% → trung_doc 60%; cd 3 / cast 1.2 |
| D | **Vạn Mộc Lan Độc** `van_moc_lan_doc` | **Lan độc**: sao chép stack Trúng Độc của mục tiêu chính sang mọi địch trong vùng (`spreadsAilmentId: 'trung_doc'`, E-1) | dmg 1.5, `targeting area laneRadius 1 columnRadius 1`, spread 100% stack; cd 4 / cast 1.4 |
| E | **Độc Viên Bạo Căn** `doc_vien_bao_can` | Vườn độc nổ rễ: kích nổ Trúng Độc trên mục tiêu chính + hút máu (`consumesAilmentId: 'trung_doc', damagePerStack 30, healPercentOfDamage 0.4`) | dmg 2.4 (+detonate); cd 6 / cast 1.8 |

Ghi chú vai trò: khác Hỏa/Kim (D kích nổ), Mộc để **E** mới kích nổ vì D phải lan trước — đúng thứ tự dấu ấn spec cha ("D lan độc, E vườn độc nổ rễ").

**Biến thể C**:
- *Căn Trì · Cấm Bộ* `can_tri_cam_bo`: troi_chan 100% duration ×1.5 (qua buff riêng `cau_mang_can` root 4s), bỏ trung_doc.
- *Căn Trì · Thâm Độc* `can_tri_tham_doc`: bỏ root, `add_stack trung_doc +2` (E-3).

**Biến thể D**:
- *Lan Độc · Quảng* `lan_doc_quang`: `targeting all_lanes columnRadius 1`, spread 50% stack (làm tròn lên).
- *Lan Độc · Thâm* `lan_doc_tham`: area radius 1, spread 100% stack **+ refresh duration** trên mục tiêu chính.

### 2.4 Kim — Chuỗi NHỤC THU (nghiền nát kim loại, KHÔNG kiếm pháp)

Spec cha liệt kê 5 dấu ấn A→E: Kim Châm (Xuất Huyết) · Kim Giáp (phản đòn) · Kim Lang (bão vụn AoE) · Kim Chung Cộng Hưởng (khuếch đại Xuất Huyết) · Kim Luân Trấn Áp (nổ Xuất Huyết). Vì A cố định là Điểm Kim Thuật (đã áp Xuất Huyết = vai Kim Châm), spec này gán **B = Kim Giáp, C = Kim Lang, D = Kim Chung, E = Kim Luân** — giữ TRỌN 5 dấu ấn theo đúng thứ tự (placeholder hiện tại bỏ mất Kim Lang — xem Notes N2).

| Vị trí | Tên / id | Cơ chế | Số liệu |
|---|---|---|---|
| A | Điểm Kim Thuật `diem_kim_thuat` | giữ nguyên | dmg 1.0, chay_mau 40% |
| B | **Thu Giáp Kim Thân** `thu_giap_kim_than` | `target: 'self'` — tự hoá thép, phản đòn | buff `kim_giap` 6s (+15% defense, +15% thornsPercent, refresh); cd 2 / cast 1.0 |
| C | **Kim Lang Toàn Phong** `kim_lang_toan_phong` | Bão vụn thép xoáy AoE (`targeting area laneRadius 1`) | dmg 1.2 → chay_mau 60% (affected_targets); cd 3 / cast 1.2 |
| D | **Kim Chung Cộng Hưởng** `kim_chung_cong_huong` | Chuông rung — **khuếch đại** Xuất Huyết: `add_stack chay_mau +2` + refresh (E-3) | dmg 1.5; cd 4 / cast 1.4 |
| E | **Kim Luân Trấn Áp** `kim_luan_tran_ap` | Đĩa thép đè nghiền: kích nổ toàn bộ Xuất Huyết | dmg 2.4 + `consumesAilmentId 'chay_mau', damagePerStack 40`; cd 6 / cast 1.8 |

Kim Thế/Huyết Phá hiện có (node Trúc Cơ Pure cũ, `grantsKimThePerProc`) chỉ trên A — giữ nguyên, không lan sang B–E.

**Biến thể C**:
- *Kim Lang · Toàn Vực* `kim_lang_toan_vuc`: area laneRadius 1 columnRadius 1, dmg 1.0, chay_mau 50%.
- *Kim Lang · Xuyên Liệt* `kim_lang_xuyen_liet`: `targeting line`, dmg 1.4, chay_mau 80%.

**Biến thể D**:
- *Cộng Hưởng · Tích Huyết* `cong_huong_tich_huyet`: add_stack +3, không choáng.
- *Cộng Hưởng · Chấn Huyết* `cong_huong_chan_huyet`: add_stack +1 → choang 30%.

### 2.5 Thổ — Chuỗi HẬU THỔ (phòng tuyến)

Dấu ấn spec cha: A/B Thạch Hóa/Chấn, C cột đất đỡ đòn, D chấn địa AoE, E thành lũy nhốt target.

| Vị trí | Tên / id | Cơ chế | Số liệu |
|---|---|---|---|
| A | Thổ Cầu Thuật `tho_cau_thuat` | giữ nguyên | dmg 1.0, thach_hoa 100% |
| B | **Hậu Thổ Trấn Ách** `hau_tho_tran_ach` | Đá trấn — Thạch Hóa + chấn | dmg 1.1 → thach_hoa 70% → choang 20%; cd 2 / cast 1.0 |
| C | **Địa Trụ Thừa Thiên** `dia_tru_thua_thien` | `target: 'self'` — cột đất đỡ đòn | buff `dia_tru` 6s (+60 wardMax, +6 wardRegenPerSecond, +10% thornsPercent); cd 3 / cast 1.2 |
| D | **Côn Lôn Chấn Địa** `con_lon_chan_dia` | Chấn địa AoE (`targeting area laneRadius 1 columnRadius 1`) | dmg 1.5 → choang 40% (affected_targets); cd 4 / cast 1.4 |
| E | **Cửu Trù Địa Lao** `cuu_tru_dia_lao` | Ngục đất nhốt mục tiêu: trói + tự nổ khiên (`consumesWardForDamage, damagePerWardPoint 1.5`) | dmg 2.4 → troi_chan 100%; cd 6 / cast 1.8 |

E dùng `consumesWardForDamage` để khép vòng "C dựng khiên → E nổ khiên" — cơ chế đã có (Thạch Giáp Trận tiền lệ).

**Biến thể C**:
- *Địa Trụ · Bích* `dia_tru_bich`: +100 wardMax, +8 wardRegen, bỏ thorns — nuôi E nổ khiên to.
- *Địa Trụ · Thứ* `dia_tru_thu`: +40 wardMax, +25% thornsPercent — phản đòn.

**Biến thể D**:
- *Chấn Địa · Trấn* `chan_dia_tran`: single, dmg 1.7, choang 70%.
- *Chấn Địa · Quảng* `chan_dia_quang`: area laneRadius 2 columnRadius 1, dmg 1.3, choang 25%.

## 3. Năm Ultimate (Thế đầy 100 → reset 0)

Khung chung: `type: 'active'`, `buildTag: 'ult'`, `cooldown 0`, `execution cast_time 1.5`, `resourceType 'none'`, KHÔNG loadout slot, `unlocked: false` mở qua node ult (mục 5). Damage value 4.0 chuẩn. `triggerPhapTuUltimate` hiện resolve nuke AoE đồng nhất — cần mở rộng thành **per-element ult profile** (E-6) để 5 hiệu ứng đặc trưng thật.

| Ult | Tên / id | Hiệu ứng (spec cha §2.4) → thiết kế cụ thể |
|---|---|---|
| Hỏa | **Tất Phương Giáng Thế** `tat_phuong_giang_the` | Nuke AoE `all_lanes columnRadius 1` dmg 4.0 → bong 100% + **vùng cháy** 6 tick × 1s tại vị trí mục tiêu chính (`grantsZone` element fire, `damageRatio 0.5`/tick — E-5). |
| Thủy | **Bát Thủ Càn Quét** `bat_thu_can_quet` | **8 đợt sóng** (`hitCount: 8`, E-4) mỗi đợt dmg 0.6 AoE `all_lanes` → te_cong 100%; **purge tối đa 8 debuff** trên bản thân (`remove_buff scope source, polarity 'debuff', count 8` — E-3). |
| Mộc | **Kiến Mộc Thông Thiên** `kien_moc_thong_thien` | Rễ trăm trượng: `all_lanes` dmg 4.0 → troi_chan 100% → trung_doc 100% (+2 stack) + **vườn độc** zone wood 6 tick × 1s `damageRatio 0.4` (E-5). |
| Kim | **Kim Phạt Thu Sát** `kim_phat_thu_sat` | **Đơn mục tiêu ưu tiên boss** (profile `single_boss_priority`, pattern KKTM — E-6): dmg 6.0 + `consumesAilmentId chay_mau, damagePerStack 80`; overkill KHÔNG tràn (khác KKTM — Kim Phạt là "hình phạt" đơn). |
| Thổ | **Hậu Thổ Thành Lũy** `hau_tho_thanh_luy` | `all_lanes` dmg 4.0 → troi_chan 100% (nhốt) + buff self `thanh_luy` 8s: **+6% defense/tầng, tầng = số địch bị nhốt** (`stacksPerAffectedTarget`, E-2), max 8. |

Auto-AI giữ nguyên `autoPhapTuUltimateDecision` (boss/Độ Kiếp + Thế đầy); nút manual + toggle theo plan cha Task 16.

## 4. Thế — node chuyên sâu (per hành)

Thế hiện là hằng số (`THE_GAIN_PER_LINK 10 / FINISHER 20 / MAX_THE 100`). Node cần đọc bonus từ nhân vật → thêm 2 key `SkillRuntimeStats` gắn lên **skill A** (pattern `hoaTheGainPerCast`): `theGainPerLinkBonus`, `theMaxBonus`; `TheResourceSystem` nhận `owner` để đọc (E-7). "Hiệu ứng khi đầy" = buff `the_man_<element>` tự áp khi `currentThe ≥ max`, gỡ khi ult reset (E-7).

| Node (mỗi hành) | Cấp | Hiệu lực |
|---|---|---|
| Tụ Thế `tu_the_<element>` | 5 | +1 Thế/link mỗi cấp (cấp 5: link 15, finisher 25) |
| Trường Thế `truong_the_<element>` | 5 | +4 trần Thế mỗi cấp (cấp 5: 120 — ult chậm hơn nhưng buff đầy kéo dài) |
| Thế Mãn `the_man_<element>` | 1 | Khi Thế đầy: Hỏa +15% ailmentPotency · Thủy +6 manaRegen · Mộc +20% ailmentDuration · Kim +8% criticalRate · Thổ +10% defense |

## 5. Node Tree — nhánh Thuần (PhapTuNodes.ts)

### 5.1 Cấu trúc (theo spec cha §1.2, giữ `buildBranch` phần Luyện Khí)

```
[giữ] Root Lĩnh Ngộ → Power (10) / Cadence (5) / Mechanic (5)        branchTag: <element>
[bỏ]  keystoneReaction / keystonePure + specs (thay bằng dưới; xem Notes N4)
[mới] phap_tu_lap_dao (major, gate Trúc Cơ, cost 0, cổng chung)        branchTag: 'lap_dao'
      └─ lap_dao_thuan_<element> ×5 (major, cost 2, excludesNode 4 Thuần khác + da_phap)
            ├─ <B id> node unlock B      prereq: lap_dao_thuan_<el>
            ├─ <C id> node unlock C      prereq: B node + realm golden_core
            │    ├─ biến thể C1 (excludes C2)   prereq: C node
            │    └─ biến thể C2 (excludes C1)
            ├─ <D id> node unlock D      prereq: C node + realm soul_transformation
            │    ├─ biến thể D1 (excludes D2)
            │    └─ biến thể D2 (excludes D1)
            ├─ <E id> node unlock E      prereq: D node + realm tribulation
            ├─ node ult (major)          prereq: B node   (Thế đã có từ Trúc Cơ → ult chơi được sớm)
            ├─ tu_the_<el> (5)           prereq: lap_dao_thuan_<el>
            ├─ truong_the_<el> (5)       prereq: tu_the_<el>
            └─ the_man_<el> (1)          prereq: truong_the_<el>
```

Tổng mỗi hành: 4 (giữ) + 1 Lập Đạo Thuần + 4 unlock + 4 biến thể + 1 ult + 3 Thế = **17 node** (spec cha "~15"). Node `phap_tu_lap_dao_da_phap` chỉ khai để `excludesNode` trỏ tới — nội dung nhánh Đa Pháp theo plan cha Task 11 phần còn lại.

### 5.2 Quy ước node

- `branchTag: 'thuan_<element>'` cho toàn bộ node mới của hành (test plan cha Task 11 đã dùng tag này).
- Node unlock: `type 'major'`, `role 'keystone'`, `insightCost 2`, `effect.unlocksSkillIds: [id]`. Id node = `node_<skill id>`? — KHÔNG: theo N2b id node đặt theo tên node: "Lĩnh ngộ Nam Minh Liệt Hỏa" → `linh_ngo_nam_minh_liet_hoa`.
- Node biến thể: `type 'minor'`, `role 'specialization'`, `insightCost 2`, 1 cấp, `effect.selectsSpecialization: { skillId, specializationId }` (E-8) + `excludesNode` biến thể đối diện. Mua = gọi `SkillSystem.selectSpecialization` — không cần UI chọn riêng.
- Node Thế: `role 'growth'`, `upgradeCost { base 1, perLevel 2 }`, `effect.skillModifiers` lên skill A.
- Realm gate C/D/E khớp bảng `SkillLoadoutSlots.ts` (golden_core 3 / soul_transformation 4 / tribulation 5) — mua được là equip được, không có trạng thái "học rồi không lắp nổi".

## 6. Mở rộng engine cần thiết (đã được phép đề xuất)

| # | Mở rộng | Vị trí | Dùng bởi |
|---|---|---|---|
| E-1 | `SkillEffect.spreadsAilmentId?: string`, `spreadStackPercent?: number` (mặc định 1), `spreadRefreshesPrimary?: boolean` — sao chép ailment từ primary target sang affected_targets (trừ primary); dùng `BuffSystem` apply với stacks tính được | `SkillEffect.ts`, `SkillEffectSystem.case 'damage'` (sau missile resolve) | Mộc D + 2 biến thể |
| E-2 | `SkillEffect.stacksPerAffectedTarget?: boolean` — effect `buff` scope source: stacks = số affected_targets còn sống (cap `maxStacks` buff) | `SkillEffectSystem.case 'buff'` | Thành Lũy |
| E-3 | Xử lý `add_stack` (buffId, stacks, refresh) và `remove_buff` (`polarity`, `count`, scope) cho ACTIVE skill trong `SkillEffectSystem` (hiện chỉ PassiveSystem) | `SkillEffectSystem`, `SkillEffect` thêm `polarity?`, `count?` | Hỏa C1, Mộc C2, Kim D + biến thể, Bát Thủ |
| E-4 | `SkillEffect.hitCount?: number` — bắn N missile cố định (song song `hitCountByRealm`, loại trừ nhau) | `SkillEffectSystem.case 'damage'` | Bát Thủ |
| E-5 | Tổng quát `grantsSwordZone` → `grantsZone` với `zoneElement?: ElementType` (SwordZone đã có field `element`); giữ alias cũ cho Kiếm Tu | `SkillEffect.ts`, `BattleSystem.spawnSwordZone` | Tất Phương, Kiến Mộc |
| E-6 | `UltimateSystem.triggerPhapTuUltimate(battle, element, nuke)` đọc **profile** `{ targeting: 'all' \| 'single_boss_priority' }` theo `PHAP_TU_ULTIMATE_PROFILES`; hiệu ứng còn lại nằm trong skill data (resolver chạy effects của skill ult) | `UltimateSystem.ts`, GameManager glue | Kim Phạt (single) vs 4 ult AoE |
| E-7 | `SkillRuntimeStats` + `theGainPerLinkBonus`, `theMaxBonus`; `TheResourceSystem.gainTheOnChainLink(player, isFinisher)` đọc `player.skills` skill A; `consumeTheForUlt` so với `MAX_THE + bonus`; buff `the_man_<el>` áp/gỡ theo trạng thái đầy | `SkillRuntimeStats.ts`, `TheResourceSystem.ts`, `UltimateSystem.canUsePhapTuUltimate` | Node Thế mục 4 |
| E-8 | `NodeEffect.selectsSpecialization?: { skillId; specializationId }` — `GameManager.purchaseNode` gọi `selectSpecialization` | `ProgressionNode.ts`, `GameManager` | Node biến thể C/D |

Không thêm `SkillEffectType` mới, không thêm execution policy mới, không thêm `SkillResourceType`.

## 7. Buff mới (`buffs.ts`)

| id | Polarity | Duration | Effects |
|---|---|---|---|
| `thanh_tuyen` | buff | 6 refresh | manaRegenPerSecond +8 flat, manaRegenPercent +0.10 |
| `bang_giap` | buff | 6 refresh | wardMax +50, wardRegenPerSecond +5 |
| `hoi_luu` | buff | 4 refresh | leechPercent +0.20 |
| `cau_mang_can` | debuff | 4 refresh | cc root (bản dài của troi_chan, chỉ biến thể Mộc C1) |
| `kim_giap` | buff | 6 refresh | defense +15%, thornsPercent +0.15 |
| `dia_tru` | buff | 6 refresh | wardMax +60, wardRegenPerSecond +6, thornsPercent +0.10 |
| `thanh_luy` | buff | 8 stack max 8 | defense +6%/tầng |
| `the_man_fire/water/wood/metal/earth` | buff | ∞ (gỡ bởi engine) | theo bảng mục 4 |

`ngung_lo`/`khai_son` trả lại đúng vai reaction buff (placeholder Thủy C/Kim C đang mượn — gỡ).

## 8. Ảnh hưởng hệ thống & tích hợp

- **Skills.ts**: xoá 25 placeholder id cũ, thay 25 skill mới; cập nhật `CHAIN_SKILL_IDS`, `PHAP_TU_ULTIMATE_IDS`; cập nhật `Skills.chain.test.ts`, `Skills.costInvariant.test.ts`, `UltimateSystem.phapTu.test.ts` theo id mới. Dev phase — không migration save (AGENTS.md).
- **PhapTuNodes.ts**: bỏ keystone Reaction/Pure + specs Trúc Cơ cũ (spec cha §1.2 "keystone Thuần/Reaction cũ BỎ") — các skill stat `hoaTheGainPerCast`, `kimTheGainPerProc`, `thuyThePercent`, `poisonRootMaxStacks`, `thoTheGainPerCast`, `earthAoeRadius`… mất nguồn cấp từ node. Runtime vẫn an toàn (nền 0) nhưng thành dead code — xem Notes N4.
- **Tooltip**: `TechniqueTooltipContent` phải render được: hitCount, spread, stacksPerAffectedTarget, add_stack/remove_buff, zone element — bổ sung nhánh hiển thị.
- **Chain gate**: `canCastChainSkill` dùng `loadoutEntries.length` — skill C/D/E unlock nhưng slot chưa mở thì không equip được → không cast; nhất quán.
- **GameManager** (plan cha Task 12/15): khi `phapTuDao.kind === 'thuan'` → `setChainDefinition({ skillIds: CHAIN_SKILL_IDS[element] })`, wire ult profile. Spec này chỉ yêu cầu data + engine ext sẵn sàng cho glue đó.
- **Reaction**: Thuần chỉ 1 hành → không reaction liên hành; không cần đổi `ElementReaction.ts`.

## 9. Testing (theo AGENTS.md — focused + type-check + build)

- Data: 25 skill mới đúng shape (execution, resourceType none, không `cost`, id N2b, mọi damage có manaScaling/attunement); `CHAIN_SKILL_IDS` 5×5 trỏ id tồn tại; ult có `buildTag 'ult'`.
- Node: `PhapTuNodes.dao.test.ts` (plan cha Task 11 test) + biến thể C/D excludes nhau + realm gate khớp `REALM_SLOT_TABLE` + Thế node modifiers lên skill A.
- Engine: E-1 spread copy stacks đúng % / bỏ primary; E-2 stacks = số target; E-3 add_stack/remove_buff active; E-4 hitCount 8 roll độc lập; E-5 zone element fire/wood tick; E-6 Kim Phạt single boss-priority không splash, 4 ult còn lại AoE; E-7 gain/trần bonus + the_man áp/gỡ; E-8 purchase node chọn specialization.
- Chuỗi tích hợp: sim 1 vòng A→E mỗi hành (BattleSystem) — Thế = 10×4+20 = 60, E quay về A; Hỏa D detonate ×stack bong; Thổ E nổ ward từ C.
- QA: `tutienidle-adversarial-qa` quick mode sau implement (deep nếu chạm lifecycle Thế/ult).

## 10. Notes / Suggestions (đề xuất thay đổi so với ý gốc — chờ anh quyết)

- **N1 — `bong` stack**: spec cha nói "A/B/C chồng Thiêu Đốt" nhưng `bong` hiện refresh-only nên Detonate luôn ×1. Đề xuất đổi `bong` sang stack (max 5, dpsRatio 0.15/tầng). Ảnh hưởng: Bạo Viêm/Hỏa Cầu Thuật cũ đổi cảm giác (1 tầng yếu hơn). Phương án khác: giữ `bong` refresh, thêm ailment mới `liet_diem` stackable cho chuỗi — nhưng làm Hỏa Cầu (A) không "chồng" được, trái spec cha.
- **N2 — Thứ tự Kim**: spec cha liệt kê Kim Châm → Kim Giáp → Kim Lang → Kim Chung → Kim Luân (5 dấu ấn) trong khi A cố định là Điểm Kim Thuật. Spec này coi Điểm Kim Thuật đã đóng vai Kim Châm (áp Xuất Huyết) và giữ đủ 4 dấu ấn còn lại đúng thứ tự. Placeholder hiện tại bỏ Kim Lang và đẩy Kim Châm thành B — trái spec cha.
- **N3 — Mộc D lan vs E nổ**: giữ đúng spec cha (D lan, E nổ) dù 4 hành khác nổ ở D; hệ quả Mộc burst đến muộn hơn 1 link — cân bằng bằng heal 40% ở E.
- **N4 — Keystone Trúc Cơ cũ**: spec cha §1.2 bỏ keystone Reaction/Pure + specs. Việc này để lại ~10 field `SkillRuntimeStats` (hoaThe/kimThe/huyetPha/thuyThe/poisonRoot/earthAoe/thoThe) và engine đối ứng thành mồ côi. Spec này KHÔNG xoá engine đó (ngoài phạm vi, và "deletion requires authorization") — chỉ gỡ node cấp. Đề xuất: đợt dọn riêng sau khi Đa Pháp xong, hoặc chuyển vài field vào nhánh Đa Pháp (vd poisonRoot → Đa Pháp Mộc).
- **N5 — Ult node prereq**: đặt ult mở ngay sau B (Trúc Cơ) để Thế có đầu ra ở content hiện tại (chỉ tới Trúc Cơ). Nếu anh muốn ult là phần thưởng chuỗi đủ, đổi prereq sang E node (khi đó Thế vô dụng tới Độ Kiếp).
- **N6 — Trần Thế qua node** (Trường Thế) làm ult chậm hơn — đổi lại là buff Thế Mãn kéo dài; nếu anh thấy phản trực giác, thay Trường Thế bằng "Tích Thế: +5 Thế khi quái chết" (cần thêm hook kill → Thế).
- **N7 — `hoi_luu` leech**: `leechPercent` không áp cho true damage Detonate (comment SkillEffect) — Thủy không có Detonate nên OK; ghi để tránh nhầm khi lan sang hành khác.