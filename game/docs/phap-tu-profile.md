# Hồ sơ PHÁP TU — hiện trạng code (2026-09-02)

> Nguồn: quét toàn bộ `game/src` + `game/docs`, commit master `3e2d944`. Mọi giá trị trích file + dòng.
> Tài liệu song song: `phap-tu-profile.md` ↔ `kiem-tu-profile.md`.

## 0. Tổng quan

| Khía cạnh | Trạng thái | Nguồn |
|---|---|---|
| Path id | `'phap_tu'` — ĐÃ GỘP 5 path Ngũ Hành cũ (`phap_tu_hoa/moc/thuy/kim/tho`) thành 1 | `core/player/CultivationPathKit.ts:5-12` |
| Chọn path | 1 lần, VĨNH VIỄN, tại Phàm Nhân tầng ≥ 12 — nghi lễ Lễ Nhập Môn (Luyện Khí) | `GameManager.ts:986-993, 1048-1068`; `realmSystem.ts:44` |
| Khởi đầu | Node gốc `hoa_linh_ngo` (cost 0) mua + equip `hoa_cau_thuat` slot 0 | `GameManager.ts:255-256, 1043-1045` |
| Chiều sâu build | Node Tree 5 hành + Element Loadout + Reaction engine + Buff engine + Chain/Thế engine (chưa nối) | các mục dưới |
| Spec "Đạo Sắc" (Thuần hệ chuỗi + Đa Pháp sinh khắc) | **Task 1-10 xong, Task 11-17 CHƯA** — xem §9 | `docs/superpowers/specs/2026-08-30-phap-tu-dao-sac-design.md` |

## 1. SKILL — `data/skill/Skills.ts` (1794 dòng)

### 1.1 Năm skill root (A) — mỗi hành 1 active

| Skill | castTime | Cooldown | Damage | Debuff áp | Đặc tả |
|---|---|---|---|---|---|
| `hoa_cau_thuat` Hỏa Cầu Thuật (L140-212) | 1.6s | 4s | 1.0×Skill Power, fire, manaScaling 0.001, attunement 0.004/điểm | `bong` 50% | `grantsHoaThePerCast`; buildTag burst |
| `thuy_tien_thuat` Thủy Tiễn (L374-438) | 0.9s | 1s | 1.0 water | `te_cong` 50% | root, core |
| `doc_chuong` Độc Chưởng (L319-365) | 1.2s | 2s | **0 direct damage** | `trung_doc` **100%** | root, core |
| `diem_kim_thuat` Điểm Kim (L450-518) | 1.0s | 2.5s | 1.0 metal | `chay_mau` 40% | `grantsKimThePerProc` + `grantsHuyetPhaPerProc` |
| `tho_cau_thuat` Thổ Cầu (L532-596) | 1.4s | 5s | 1.0 earth, `earthPureAreaBehavior` | `thach_hoa` **100%** | `grantsThoThePerCast` |

- Execution: tất cả `cast_time` (chịu Cast Speed; cooldown chịu CDR). `resourceType: 'none'` — mana KHÔNG phải tài nguyên cast (quyết định user, test `Skills.costInvariant.test.ts`).
- Level: maxLevel 10, +5% damage/cấp (`SkillSystem.ts:24`), chi phí `5+3×(lv−1)` Cảm Ngộ.
- **Specialization: engine có, data Pháp Tu khai báo = 0 → CHƯA LÀM.**

### 1.2 Hai mươi skill chuỗi B–E (L1231-1781) — **ORPHAN: không node unlock**

Chuỗi CHÚC DUNG (Hỏa): `chuc_dung_b` Liệt Diễm (3/1.0, bong 0.6) → `_c` Tam Muội (5/1.2, bong 0.8) → `_d` Dẫn Nộ Hỏa Thần (8/1.4, 1.5 + **Detonate bong 30/stack**) → `_e` Hỏa Hà Cửu Thiên (12/2.0, 2.5, bong 1.0)
Chuỗi THIÊN NGÔ (Thủy): `thien_ngo_b` Bát Đầu Trấn Thủy → `_c` Thanh Tuyền Dưỡng Khí (self-buff `ngung_lo` 6s) → `_d` Hồi Lưu Thôn Nộ (troi_chan 0.7) → `_e` Thiên Ngô Bát Vân
Chuỗi CÂU MANG (Mộc): `cau_mang_b` Xuân Sanh Độc Dực → `_c` Mộc Nhiễm Căn Trì (troi_chan 0.6) → `_d` Vạn Mộc Thời Hư (**Detonate trung_doc 25/stack + Lifedrain heal 50%**) → `_e` Kiến Mộc Thần Lâm
Chuỗi NHỤC THU (Kim): `nhuc_thu_b` Kim Châm Vũ → `_c` Thu Giáp Kim Thành (self-buff `khai_son`) → `_d` Kim Chung Cộng Hưởng (Detonate chay_mau 25) → `_e` Kim Luân Trấn Ấp (Detonate 40)
Chuỗi HẬU THỔ (Thổ): `hau_tho_b` Hậu Thổ Trấn Ách → `_c` Địa Trụ Thừa Thiên (self-buff `thach_giap_buff`) → `_d` Côn Lôn Chấn Địa (choang 0.4) → `_e` Cửu Trù Thành Lũy (troi_chan 1.0)

### 1.3 Năm Ultimate Thuần hệ (L1593-1701) — **không call site production**
`tat_phuong` Tất Phương (4.0 fire+bong), `bat_thu` Bát Thủ (4.0 water+te_cong), `kien_moc` Kiến Mộc (4.0 wood+trung_doc+troi_chan), `kim_phat` Kim Phạt (4.0 metal+Detonate 60), `thanh_luy` Hậu Thổ Thành Lũy (4.0 earth+troi_chan). maxLevel 5, cd 0, cast 1.5s.

### 1.4 Chín passive theo cảnh giới (hệ riêng, `Techniques.ts:208-218` map, cấp qua `syncRealmPassive`)
qi_refining Linh Khí Cảm Ứng (atk +0.5%/stack, trigger hit) → Trúc Cơ Ý Chí (def +0.8%, damage_taken) → Kim Đan Chi Quang (critDmg +0.02, critical) → **Nguyên Anh Minh Triệt: `passiveModifiers: []` RỖNG — placeholder chờ thiết kế (Skills.ts:855-863)** → Hóa Thần Chi Uy (atk +2%, kill) → Luyện Hư Bộ (atkSpd +1%, cast) → Hợp Thể Chi Khu (maxHp +1%, attack) → Đại Thừa Đạo Tâm (attunement +1.5%, hit) → Độ Kiếp Chi Tâm (critRate +0.002, per_second). maxStacks 50.

## 2. NODE TREE — `data/progression/PhapTuNodes.ts` (891 dòng, 55 node)

Khung `buildBranch` (L108-251) mỗi hành 11 node: root Lĩnh Ngộ (Hỏa cost 0, 4 hành kia 2) → 3 growth (Power lv10: 1,1,1,2,2,2,3,3,3,4; Cadence lv5; Mechanic lv5) → 2 keystone XOR tại Trúc Cơ (Reaction vs Pure, cost 2) → 2-3 specialization lv5.
Nguyên tắc §6.8: node KHÔNG push modifier vĩnh viễn — mọi hiệu lực suy từ `(registry, nodeLevels)` (`NodeSystem.ts:184-228`).

**HỎA:** `hoa_linh_ngo` → Hỏa Linh (firePower +2/lv), Tật Hỏa (castSpeed +3%/lv), Xích Viêm (ailmentPotency +4%/lv) | KS Reaction "Dẫn Hỏa" (elementApp +15%) / KS Pure "Tụ Hỏa" (`hoa_cau_thuat.hoaTheGainPerCast +1`) | Hỏa Nguyên (+2%/lv app), Cộng Minh (+5%/lv reactionEffect), Hỏa Tâm (firePower +3/lv), Hỏa Mạch (hoaTheGain +2%/lv), Tụ Viêm (decayReduction +2%/lv)
**MỘC:** root "Độc Chưởng" → Độc Nguyên (woodPower), Độc Mạch (castSpeed), Độc Tức (ailmentDuration) | KS "Độc Dẫn" (reactionEffect +15%) / "Mộc Thế" (`doc_chuong.poisonRootMaxStacks +1`) | Cộng Độc, Độc Thực (potency +3%), Độc Linh, Độc Uyên (poisonRootMaxStacks +1+0.5/lv), Độc Trưởng
**THỦY:** → Thủy Linh, Thủy Tốc, Lưu Tốc (CDR +2%/lv) | KS "Dẫn Lưu" (app +15%) / "Tụ Thủy" (`thuy_tien_thuat.thuyThePercent +5%`) | Thủy Dẫn, Cộng Lưu, Thủy Nguyên, Thủy Mạch + Nhuyễn Lưu (thuyThePercent +1%/lv)
**KIM:** → Kim Khí, Huyết Bạo, Huyết Ấn (potency +4%) | KS "Huyết Dẫn" / "Kim Thế" (`kimTheGainPerProc +1` + maxStacksBonus +1) | Điểm Huyệt, Cộng Huyết, Kim Uyên (maxStacks +1+0.5/lv), **Huyết Phá** (`kimTheDotResistancePenetration +0.5%/lv` + `huyetPhaGainPerProc +1` + `huyetPhaBurstDamage 60`), Kim Tâm
**THỔ:** → Thổ Nguyên, Thổ Tốc, Chấn Lực (skillImpact +2%/lv) | KS "Định Thổ" / "Thổ Thế" (`thoTheGainPerCast +1` + skillImpact +5%) | Định Lực, Trọng Thạch (skillDamage +2%/lv), **Chấn Vực** (`earthAoeRadius +1+0.25/lv`), Thổ Tâm

**CHƯA TỒN TẠI (plan Đạo Sắc Task 11+):** node Lập Đạo, node unlock 20 skill B–E, node unlock 5 ult, nhánh Đa Pháp (reaction/sinh khắc), node Thân Hòa, node chuyên sâu Thế.

## 3. TÂM PHÁP — `data/technique/Techniques.ts`

- `dai_ngu_hanh_chan_quyet` **Tiểu Ngũ Hành Quyết** (L22-66, tự học khi chọn path): insightMultiplier 3, `resourceLabel 'Pháp Lực'`, `mpLabel 'Linh Lực'`, tierEffects (maxMp% / manaRegen% / hpRegen / mpRegen): 3/.5/.5/.5 → 4/.75/.75/.75 → 5/1.5/1.5/1.5 → 10/2/2/2; **combatModifiers: attackRange +2** khi equipped.
- `dai_ngu_hanh_quyet_truc_co` **Đại Ngũ Hành Quyết** (L68-88, reward Trúc Cơ): insightMultiplier 4, tierEffects 5/1/1/1 → 7/1.5/1.5/1.5 → 10/2.5/2.5/2.5 → 15/4/4/4, cùng attackRange +2.
- Stat nền path (`CultivationPathKit.ts:60-82`): maxMp +100, manaRegen +2/s, **manaShieldPercent +0.25** (Linh Lực Hộ Thể — sát thương chuyển vào MP sau Ward, cap 0.8 — `CombatSystem.ts:310-327`).
- `van_kiem_quyet` Vạn Kiếm Quyết (L243-264): **mồ côi** — giá trị cơ học cũ mất hiệu lực, chỉ còn là tâm pháp trang bị được (chờ thiết kế lại).

## 4. CƠ CHẾ CORE

### 4.1 SkillRuntimeStats (19 field "Thế tài nguyên", `SkillRuntimeStats.ts`)
`hoaTheGainPerCast`/`hoaTheDecayReductionPercent` (Hỏa Thế), `thuyThePercent` (Thủy Thế — giảm dmg cuối, **cap 0.75** `CombatSystem.ts:29`), `waterReactionExtensionSeconds`, `poisonRootPercentPerStack/MaxStacks/ThresholdBonus` (Độc Căn), `earthAoeRadius/SecondaryDamagePercent/KnockbackDistance`, `thoTheGainPerCast`, `skillImpactPercent` (**chỉ node khai — chưa có consumer damage thật**), `kimTheGainPerProc/MaxStacksBonus/DotDamagePercentPerStack/DotResistancePenetrationPercentPerStack`, `metalAilmentPotencyPercent`, `huyetPhaGainPerProc/BurstDamage`.

### 4.2 Tài nguyên chiến đấu — `PhapTuBattleResourceSystem.ts`
- **Hỏa Thế**: pool 0–5 (`MAX_HOA_THE`), decay **0.5/s** × (1−decayReduction), +`hoaTheGainPerCast` mỗi cast (`BattleSystem.ts:931, 2681`)
- **Thổ Thế**: pool 0–5, +1/cast, không decay
- **Kim Thế**: pool 0–5, +1/proc Xuất Huyết, decay 1 tầng/5s không proc; nhân DoT metal (`BuffSystem.ts:196`)
- **Huyết Phá**: counter 0–5, chạm ngưỡng → burst 1 lần metal DoT (`SkillEffectSystem.ts:282-303`)
- **Thế (chain)**: `MAX_THE=100`, +10/link +20/finisher — **engine xong (`TheResourceSystem.ts`, `ChainStateSystem.ts`), wire CHƯA: `setChainDefinition` không được production gọi (chỉ test), `triggerPhapTuUltimate`/`autoPhapTuUltimateDecision` không call site → ult Pháp Tu không bao giờ nổ, Thế luôn 0**

### 4.3 Reaction — `ElementReaction.ts` (10 cặp) + `ReactionManager.ts`
damage = (base × **realmScalar (1+realmIndex×1.5)** + sourcePower×ratio + currentHp×%) × (1+reactionEffectPercent); true damage; cap maxHp-reduction 30%; thiên phú Phản Phác giữ 25%.
Bốc Hơi (60, keep te_cong, ratio 1.0) | Độc Viêm (%HP 10) | Độc Thủy (65, ratio 1.0) | Dung Nham (→ `dung_nham` + **LavaZone** lane1/col2/6s/20 dmg) | Trói Chân (→ `troi_chan`) | Độc Thế (→ buff `doc_the`) | Khai Sơn (50, ratio 0.5, → `khai_son`) | **Thiêu Huyết (85, ratio 1.0, −3% maxHp vĩnh viễn)** | Huyết Độc (→ `huyet_doc`) | Ngưng Lộ (40, ratio 0.5, → `ngung_lo`).

### 4.4 Buff/debuff Pháp Tu dùng (`data/buff/buffs.ts`)
`bong` (DoT 0.3 fire 4s) | `te_cong` (0.25 water) | `trung_doc` (0.2 wood, stack 5) | `chay_mau` (0.2 metal, stack 5) | `thach_hoa` (evasion −30% + **onHitProc 50% → choang**) | `troi_chan` (root 2.5s) | `dung_nham` | `huyet_doc` | `choang` (stun 1.5s) | `dong_bang` (freeze 2s) | `lam_cham` (−30% atk/move, **converts→dong_bang sau 2s liên tục**) | `han_khi` (stack 5, converts→dong_bang) | `doc_the` Độc Căn (∞, +5% potency +2% poisonRecovery/stack) | `ngung_lo` (+5 manaRegen/s 6s) | `khai_son` (+8% def/stack) | `thach_giap_buff` (ward +40, thorns 10%).
**Orphan (không nguồn áp Pháp Tu):** `suy_nhuoc`, `uy_ap`, `giap_ran`, `hoai_tu`, `cuong_bao`, `han_khi`, `lam_cham` (chỉ Artifact Không lộ trình).

### 4.5 Element Loadout — **cô lập, chưa nối**
`canEquipElement` + slot table (BASE 2, +1/2 đại cảnh giới, MAX 5) — engine xong, test xanh. NHƯNG: **không node Pháp Tu nào khai `unlocksElement`** (grep 0) + **không có UI picker** (`ElementLoadoutPicker.vue` đã gỡ) → `equippedElements` luôn rỗng ⇒ Ngũ Hành Châu rotation (artifact) không có phần tử xoay.

### 4.6 WuxingRelations — `SINH_CYCLE`/`KHAC_PAIRS`/`isSinhCycle` xong; **`core/battle/AdjacencySystem` được comment trỏ tới nhưng KHÔNG TỒN TẠI** → Luân Chuyển/Chế Khắc (Đa Pháp) chưa làm.

### 4.7 Công thức nền
elementalBasePower = attack + {element}Power; Attunement +0.5 Power + 0.1%/điểm; resistance net/100 clamp [−1, .75]; pipeline: accuracy (sàn 5%) → crit → multiplier×level(+5%/lv) + scaling → block → endurance → **thuyThe** → ward → manaShield → HP. Cast speed clamp 300%, CDR clamp 300%, fizzle hoàn 100% resource + 50% cooldown.

## 5. ĐAN DƯỢC
Họ **Hồi Linh** (MP regen `2×1.7^tier`/s) — họ duy nhất gate `requires_phap_tu` (`PillSystem.ts:146-154`). 8 họ × 9 phẩm còn lại dùng chung. 2 đan đặc biệt: Thông Mạch Đan (kinh mạch), Trúc Cơ Đan (vật chứng đột phá).

## 6. REALM/BREAKTHROUGH
Chọn path = nghi lễ Phàm Nhân→Luyện Khí (tầng ≥12). **Luyện Khí→Trúc Cơ qua Độ Kiếp** — grade 1-6 theo Luyện Thể/kinh mạch/mortalPerfection; thắng → Đại Ngũ Hành Quyết + Ngũ Hành Châu. **Kim Đan+ `canTriggerBreakthrough = false`** (chờ content). ⚠️ Defect mở QA-2026-09-02-001: `chooseCultivationPath` không unequip khi đổi realm (reproduction test đang fail có chủ đích).

## 7. UI
`QuanKhiPanel` (chọn path) | `SkillPathPanel` + `NodeTreePanel` + `NodeInspector` (node tree 5 hành, cột branch theo ElementType) | `CombatBuildHud → PhapTuCombatHud` (5 ô skill + artifact slot) | `PlayerHudLayer` (HP + MP "Linh Lực"; **bar 3 `updateKiem` chết — QA-004**).
**Gap:** không bar Thế 0–100, không nút ult Pháp Tu (chỉ Kiếm Tu có), không modal Lập Đạo, không sao 5 cánh.

## 8. TESTS KHÓA HÀNH VI
`GameManager.phapTu{Fire,Water,Wood,Metal,Earth}Path.test.ts` (idempotent, keystone XOR, growth, runtime stats) | `Skills.rhythm.test.ts` (bảng nhịp 5 skill) | `Skills.costInvariant.test.ts` | `Skills.chain.test.ts` (5×5 data) | `ChainStateSystem.test.ts` + `BattleSystem.chain.test.ts` + `TheResourceSystem.test.ts` + `UltimateSystem.phapTu.test.ts` (engine chain/ult — **xanh nhờ fixture tự wire**) | `BattleSystem.hoaThe/earthPath/kimPath/huyetPha/lavaZone/thachHoa.test.ts` | `CombatSystem.waterMitigation.test.ts` | `ReactionManager*.test.ts` + `ElementReaction.relation.test.ts` + `WuxingRelations.test.ts` + `ElementLoadout/Slot.test.ts` | `BuffSystem.test.ts` (Độc Căn/Kim Thế/Thạch Hóa/convert) | `NodeSystem.test.ts` | `cultivationRitualFlow.integration.test.ts`.

## 9. DOCS/PLANS
- **Spec Đạo Sắc** `2026-08-30-phap-tu-dao-sac-design.md` (DUYỆT) + plan 17 task: **Task 1-10 xong** (ElementType, 10 reaction, WuxingRelations, slot table, Thế pool, chain engine, wire scheduler, 20 skill, 5 ult) — **Task 11-17 CHƯA** (node Lập Đạo + 6 nhánh, PlayerData.phapTuDao, Thân Hòa, adjacency, glue GameManager, UI, docs).
- `combat-balance-pass-plan.md` ✅ (nhịp 5 skill + powerScaling).
- Defect mở: QA-001 (unequip), QA-004 (bar Thế), QA-2026-09-02-1 (reaction cross-source — suspected).

## 10. TỒN ĐỌNG — tóm tắt (theo mức nghiêm trọng)

1. 🔴 **Chuỗi Thuần hệ chưa nối vào game**: 20 skill B–E + 5 ult là data mồ côi — không node unlock, `setChainDefinition` không production gọi, ult không call site → **Thế luôn 0, ult không nổ, chuỗi không gate**. Engine + test xanh nhưng game thật chưa chạy.
2. 🔴 **Element Loadout cô lập**: không node `unlocksElement`, không UI picker → rotation Ngũ Hành Châu chết.
3. 🟠 **Đa Pháp adjacency chưa làm** (`AdjacencySystem` không tồn tại).
4. 🟠 **Pháp Lực Thân Hòa (Task 13) chưa làm** — `resourceLabel 'Pháp Lực'` chỉ là label.
5. 🟡 UI Đạo Sắc chưa làm (bar Thế, nút ult, modal Lập Đạo, sao 5 cánh); `updateKiem` chết (QA-004).
6. 🟡 Placeholder: `passive_nguyen_anh_minh_triet` rỗng; `skillImpactPercent` chưa consumer; `van_kiem_quyet` mồ côi; specialization chưa dùng.
7. 🟡 Ailment orphan: suy_nhuoc, uy_ap, giap_ran, hoai_tu, cuong_bao, han_khi.
8. ⚪ Nội dung dừng ở Trúc Cơ (slot 3-5, skill C/D/E khóa realm chờ mở — chủ đích).
