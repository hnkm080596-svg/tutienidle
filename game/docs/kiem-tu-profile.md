# Hồ sơ KIẾM TU — hiện trạng code (2026-09-02)

> Nguồn: quét toàn bộ `game/src` + `game/docs`, commit master `3e2d944`. Mọi giá trị trích file + dòng.
> Tài liệu song song: `kiem-tu-profile.md` ↔ `phap-tu-profile.md`.

## 0. Tổng quan

| Khía cạnh | Trạng thái | Nguồn |
|---|---|---|
| Path id | `'kiem_tu'` — 1 path, 2 **route** (Kiếm Trận / Bạt Kiếm) chốt theo cast Huy Kiếm | `CultivationPathKit.ts`, `GameManager.ts:1010-1014` |
| Chọn path | Nghi lễ Lễ Nhập Môn tại Phàm Nhân tầng ≥ 12; **route lock**: `tram` ≥ 10000 cast → Bạt Kiếm, < 10000 → Kiếm Trận | `GameManager.ts:986-1014` |
| Khởi đầu | `tram` (Huy Kiếm) cấp sẵn slot 0 cho mọi nhân vật mới | `App.vue:442-447`, `GameManager.ts` |
| Tài nguyên | Kiếm Thế (0–100, KT), Kiếm Ý tạm (BK, cap perm+900), Kiếm Ý vĩnh viễn (theo bossKillCount) | `CombatTypes.ts:77-82`, `KiemTuResourceSystem.ts`, `KiemYSystem.ts` |
| Spec gốc | `2026-08-29-kiem-the-kiem-y-design.md` ✅ merged (roadmap dòng 45) | `docs/superpowers/` |

## 1. SKILL — `data/skill/Skills.ts`

### 1.1 Huy Kiếm (`tram`, L81-129) — skill quốc dân, nền route
- maxLevel **3**, cooldown 1s, `execution: attack_speed` (nhịp theo Attack Speed, không ICD/CDR/cast), `resourceType none`.
- Damage qua **Trigger/Action engine mới**: `onCast → dealDamage value 1 physical` (L106-119) — skill DUY NHẤT đã migrate.
- `HUY_KIEM_CASTS_PER_LEVEL = 10` → mỗi 10 cast vĩnh viễn **+1 flat damage** không trần; Lv2@1000 cast, Lv3@10000 cast; **không nâng bằng Cảm Ngộ** (`SkillSystem.ts:26-42, 197, 213`).

### 1.2 Chín skill Kiếm Trận (`kiem_tran_*`, L15-68) — table-driven từ `TRAN_SEQUENCE`
Mỗi skill: maxLevel 10, cooldown 1s, `attack_speed`, target `all_enemies`, metal 100%, gate `requiredRealmId` theo trận.
`value = 0.5 + swordCount×0.1` → Lưỡng Nghi 0.7 … Cửu Cung/Vô Cực 1.4.
`swordIntentDamageRatio = 0.0002×swordCount` (0.0004→0.0018) — ⚠️ **nhân với `currentSwordIntent` = pool chết (§4.9) → cống hiến 0**.
Riêng `kiem_tran_tam_tai`: `grantsSwordZone` (3 tick × 0.3×attack, lane 0/col 1).
Bảng trận (`KiemTuNodes.ts:53-74`): Lưỡng Nghi (Luyện Khí, 2 kiếm) → Tam Tài (Trúc Cơ, 3) → Tứ Tượng (Kim Đan, 4) → Ngũ Hành (Nguyên Anh, 5) → Lục Đạo (Hóa Thần, 6) → Thất Tinh (Luyện Hư, 7) → Bát Quái (Hợp Thể, 8) → Cửu Cung (Đại Thừa, 9) → Vô Cực (Độ Kiếp, 9).

### 1.3 Bạt Kiếm Thuật (`bat_kiem_thuat`, L655-694)
maxLevel 10, cooldown 0, `execution: { kind: 'channel', tickSeconds: 3 }` (slider 3–9s), AoE, value 2 metal, attunement 0.004/điểm. Unlock qua node `bat_kiem_an`.

### 1.4 Hai Ultimate (buildTag 'ult', không chiếm slot, L214-306)
- `tru_tien_kiem_tran` Tru Tiên Kiếm Trận: cd 30s, value 3 metal AoE, attunement 0.008/điểm — cost 10×số kiếm cao nhất Kiếm Thế (20→90)
- `kiem_khai_thien_mon` Kiếm Khai Thiên Môn: cd 60s, value 5 metal đơn mục tiêu, `swordIntentDamageRatio 0.0002` (⚠️ pool chết §4.9), attunement 0.006 — đốt TOÀN BỘ Kiếm Ý tạm, auto khi có boss + ≥500

### 1.5 Passive liên quan
`passive_kiem_tam_lanh_liet` (critDmg +1%/stack, max 30 — innate Ngự Kiếm) | `passive_thai_hu_kiem_y` (same — innate Thái Hư) | `passive_kim_cang_y_chi` (def +0.8%/stack — innate Kim Cang, dùng chung).
**Specialization: 0 skill Kiếm Tu khai** (hạ tầng có, chưa dùng). `resourceType` tất cả = `'none'` — `'sword_intent'` tồn tại trong engine nhưng **không consumer production** (chỉ fixture test).

## 2. NODE TREE — `data/progression/KiemTuNodes.ts` (493 dòng)

### 2.1 Cây Kiếm Trận (`branchTag 'kiem_tran'`)
- **9 keystone trận** (L76-92): major, Lưỡng Nghi cost 0 còn lại 2, prereq realm + trận trước, `unlocksSkillIds`; **mua trận mới tự thay slot 0** (`GameManager.ts:804-814`).
- 3 growth (L98-156): Trận Kim Lực (metalPower +3/lv), Kiếm Tốc (atkSpd +2%/lv), Kiếm Uy (skillDamage +3%/lv).
- **9 node on-hit** (L443-475): `onHitEffect {kind, baseChance 3%, +3%/lv}` → max 15% Lv5: Kiếm Khí Truy Hồn (`khiem_khi_dmg` = 0.5×swordCount×attack direct), Kiếm Phong Thần Tốc (`khiem_phong_haste`), Kiếm Thương Xuất Huyết (`xuat_huyet_dot` → tái dùng buff `van_kiem_vu`), Kiếm Mạch Trấn Trụ (`tran_tru_cc` 50/50 root/stun), Kiếm Ẩn Phản Kích (`phan_kich_dodge`), Kiếm Trận Hấp Linh (`hap_linh_leech` = 2%×swordCount×0.1 heal), Kiếm Vân Phá Giáp (`pha_giap_pen`), Kiếm Quang Nhất Thống (`quang_crit`), Kiếm Thần Phán Quyết (`than_ngu_hanh`).
- Node ult `kiem_tran_ult_tru_tien` (L309-321): cost 3, prereq Trúc Cơ + Tam Tài.
- Node "chuyển skill cũ": `passive_ngu_kiem_thuat` (⚠️ mô tả "phóng kiếm ứng on-hit" nhưng effect chỉ metalPower +3/lv — lệch mô tả), `passive_van_kiem_trieu_tong` (skillDamage +8%/lv cho ult).

### 2.2 Cây Bạt Kiếm (`branchTag 'bat_kiem'`)
- Root `bat_kiem_an` (L160-171): cost 2, prereq **tram Lv3 + 9999 cast** (⚠️ route-lock dùng 10000 — lệch ngưỡng).
- 4 growth (L173-253): Bạt Kiếm Uy (+3%/lv skillDamage), Hộ Thể (+20 lv/wd), Kiên Nhẫn (+3%/lv ailmentResist), Bất Động (+2%/lv finalDamageReduction). **Hard rule (test `KiemTuNodes.test.ts:23-31, 65-87`): không node nào đụng `tickSeconds` / stat âm.**
- Kiếm Ý công năng (L261-304): Đỡ Đòn (blockChance +1%/lv, blockEff +2%/lv — **hoạt động**), ⚠️ **Kiếm Ý Bất Tử — `effect: {}` rỗng, KHÔNG có runtime hồi sinh theo node** (SurviveLethalGuard chỉ phục vụ thiên phú Bất Tử Thể), ⚠️ **Bạt Kiếm Phẫn Nộ — `effect: {}` rỗng, amp vẫn cố định 0.3** (spec 3.4 đòi +0.1/lv → chưa làm).
- Node ult `bat_kiem_ult_khai_thien` (L323-332).
- Chuyển skill cũ: Thái Hư Nhất Kiếm (critRate +2%/lv, critDmg +4%/lv), Phi Vân Bộ (evasion +2%, atkSpd +2%), Phá Thiên Nhất Kích (skillDamage +5%/lv).

## 3. TÂM PHÁP — `data/technique/Techniques.ts`
- `ngu_kiem` **Ngự Kiếm Tâm Kinh** (L97-134, kit path): insightMultiplier 3, combatTypeId crit, `resourceLabel 'Kiếm Ý'`, `mpLabel 'Niệm Lực'`, **`usesSwordIntentResource: true`** (flag đổi nguồn thanh tài nguyên — ⚠️ consumer HUD cũ đã xóa §7), innate `passive_kiem_tam_lanh_liet`, tierEffects hpRegen 1.5→4 / mpRegen 0.25→1.5.
- `thai_hu_kiem_quyet` Thái Hư Kiếm Quyết (L137-165): requiredRealm Luyện Khí lv3, innate Thái Hư Kiếm Ý.
- `kim_cang_bat_hoai_the` (L168-192): thiên phòng ngự def, dùng chung.
- `van_kiem_quyet` Vạn Kiếm Quyết (L243-264): rơi boss — ⚠️ **mồ côi, không tác dụng cơ học** (comment L236-241).
- Kiếm Tu KHÔNG có combatModifiers (không +range như Pháp Tu).

## 4. CƠ CHẾ CORE

### 4.1 `KiemTuResourceSystem.ts` (80 dòng)
- **Kiếm Thế** (KT): 0–100, +swordCount mỗi cast Kiếm Trận; `kiemTheDamageBonusPercent = currentKiemThe/2` → **đầy = +50% damage** (áp tạm thời trong resolvePlayerSkillEffects, `BattleSystem.ts:2517-2540`).
- **Kiếm Ý tạm** (BK): cap = vĩnh viễn + 900; +1/tick channel; +`floor(%mấtHP×100/5)` khi nhận đòn (mọi lúc, không chỉ khi tụ — `BattleSystem.ts:392-397`); `consumeKiemYTempFirst` — vĩnh viễn bất khả xâm phạm.
- **Kiếm Ý vĩnh viễn** (`KiemYSystem.ts`): tầng theo `bossKillCount` (10/25/45/70 boss...), +10/tầng, multiplier 0.5%/tầng skillDamage/critRate/critDmg — **chỉ khi `kiem_tu && bat_kiem && bossKillCount>0`** (`stores/player.ts:109-129`); ceiling 100 tầng.

### 4.2 Channel Bạt Kiếm (`BattleSystem.ts`)
- `beginPlayerCast case 'channel': return false` (L2235) — no-op chủ ý, scheduler bỏ slot channel; `initChannelState` (L512-531) bật `tuLucActive` khi loadout có channel **VÀ** route BK.
- `updateChanneling` (L2897-2950): while bắt kịp overshoot; **cắt khi chết/choáng/thạch hóa/trói chân**; +1 Kiếm Ý tạm/tick.
- `resolveChannelTick` (L2986-3067): `combinedMultiplier = (1 + tickLengthBonus + damageTaken×0.3) × tierMult` (base `0.6+0.02×tier`, tier 20→1.0; tickLength `1+(sec−3)/3` ×1@3s→×3@9s); **hấp thụ Huy Kiếm `floor(tramCasts/10)` flat damage**; bắn `onTick` trigger riêng.
- `setChannelTickSeconds` (L3079-3085): slider UI override, reset elapsed.

### 4.3 Ult (`UltimateSystem.ts:60-162`)
TTKT: trừ Kiếm Thế (10×kiếm), nuke mọi địch + SwordZone 6 tick (lane 4/col 4, dmg = swordCount). KKTM: đốt toàn bộ Kiếm Ý tạm, ưu tiên boss, overkill tràn 50% chia đều. Auto-AI check 1s/lần, `ultAutoEnabled` default true. `tryPlayerUltimate` (`BattleSystem.ts:3093-3126`) — **chỉ Kiếm Tu có nút ult**.

### 4.4 SwordZone (`SwordZone.ts` + `BattleSystem.ts:1759-1871`)
Charge-based (hết theo SỐ TICK trúng đích), element ép metal, qua `applyDotDamage`. Nguồn: `kiem_tran_tam_tai` + TTKT.

### 4.5 `van_kiem_vu` (buff Vạn Kiếm Vũ)
DoT metal `dpsRatio 2`, 9s, `armorIgnorePercentByRealm` → bỏ 10%→90% giáp theo realm nguồn (`BuffSystem.ts:160-186`). Consumer thực tế: on-hit `xuat_huyet_dot`.

### 4.6 ⚠️ POOL CHẾT `currentSwordIntent` (0–9999)
Hook tăng `Skill.grantsSwordIntentPerHit` (`BattleSystem.ts:1389-1394`) — **grep toàn data: 0 skill khai** (kẻ từng dùng `ngu_kiem_thuat` đã xóa) → pool luôn 0 → mọi `swordIntentDamageRatio` (9 Kiếm Trận + KKTM) **cống hiến 0**.

### 4.7 🔴 LỖ HỔNG WIRING LỚN NHẤT — 3 closure không inject production
`BattleSystem.ts:336/344/350`: `getKiemYPermanent` (default `() => 0`), `getTramTotalCasts` (`() => 0`), `getOnHitNodeLevels` (`() => ({})`) — **`GameManager` không truyền 3 closure này** (`new BattleSystem(...)` L305-330 chỉ tới `getKiemTuRoute`). Hệ quả game thật:
- Kiếm Ý tạm đầu trận = **0** (không = vĩnh viễn)
- nerf Bạt Kiếm **vĩnh viễn mắc ở 0.6** (tier luôn 0, không bao giờ về 1.0)
- hấp thụ Huy Kiếm luôn **0**
- **9 node on-hit Kiếm Trận KHÔNG BAO GIỜ ROLL**
Test xanh vì fixture tự inject (`BattleSystem.kiemTuResources.test.ts:144-146`) → **khoảng cách production wiring chưa test nào bắt**.

## 5. ĐAN DƯỢC
**Không đan nào gate `kiem_tu`** — gate nghề duy nhất là `requires_phap_tu` (đan Hồi Linh MP; hợp lý vì Kiếm Tu không dùng mana pool).

## 6. REALM/BREAKTHROUGH
Chọn path = nghi lễ Phàm Nhân→Luyện Khí (tầng ≥12). Route lock tự động theo `tram` cast count lúc chọn path. `setKiemTuRoute` đã dỡ (không đổi route giữa chừng). Kim Đan+ chưa có nội dung đột phá.

## 7. UI
- `QuanKhiPanel.vue:95-153`: chỉ HIỂN THỊ route đã chốt (UI đổi đường đã dỡ).
- `SkillPathPanel.vue`: `treeBranchTag = kiemTuRoute ?? 'kiem_tran'` — 1 branch theo route, không toggle.
- `KiemTuCombatHud.vue` (275 dòng): slot 0 + progress **Tụ Lực** + slider Nhịp Tụ Lực 3–9s (route BK, mount reset 3) + **nút Ult + checkbox Tự động** (`canFireUlt`/`fireUltimate → tryPlayerUltimate`).
- ⚠️ **`PlayerHudLayer.updateKiem` ZERO call site production** (`CombatScene.ts` chỉ gọi updateHp/updateMp; event không mang data Kiếm) + bar 3 DOM cũ (`CombatStatusBar.vue` — từng hiện Kiếm Thế/Kiếm Ý/badge tầng) **đã xóa ở 6A-T8** (`991ba75`) → **người chơi Kiếm Tu hiện KHÔNG THẤY bất kỳ thanh Kiếm Thế/Kiếm Ý nào trong trận**. (roadmap 9.4 ⬜, QA-2026-09-02-004.)
- Vestigial: `KIEM_TRAN_SLOT_INDEX=4` + ngoại lệ render (kiếm trận giờ ở slot 0); unequip id ma `ngu_kiem_thuat`/`van_kiem_trieu_tong` (`GameManager.ts:1021`); `usesSwordIntentResource`/`resourceLabel 'Kiếm Ý'` không còn consumer.

## 8. TESTS KHÓA HÀNH VI
`KiemTuNodes.test.ts` (chain 9 trận, root gate, **cấm node đụng tickSeconds/stat âm**) | `KiemTuNodes.spec.test.ts` (9 on-hit 3%/lv, 2 ult node, 5 node chuyển cũ, 3 node kiếm ý BK) | `KiemTuResourceSystem.test.ts` | `KiemYSystem.test.ts` (tầng, ceiling, NaN) | `KiemTranOnHitSystem.test.ts` (roll ngưỡng, chặn theo swordCount) | `BattleSystem.batKiem.test.ts` (AoE 3 hàng, amp 0.3, cắt tụ khi stun, 9s≈3×3s, thorns kỳ sau) | `BattleSystem.kiemTuResources.test.ts` (init 2 pool, +kiếm/cast, nerf 0.6+0.3, hấp thụ 1000 casts, buff 100 → >1.3×) | `BattleSystem.onTick/swordZone.test.ts` | `UltimateSystem.test.ts` | `GameManager.kiemTuRoute.test.ts` (route lock 2 chiều, tram tháo loadout, keystone thay slot 0) | `GameManager.buildSnapshot.test.ts` | `SkillSystem.huyKiem/channel.test.ts` | `CombatEntity.kiemTuResource.test.ts` | `BuffSystem.test.ts:350-375` (armorIgnore) | `KiemTuCombatHud.test.ts` (slider, nút ult) | `PlayerHudLayer.test.ts:170-182` (updateKiem **chỉ test method-level** — wiring scene không test).

## 9. DOCS/PLANS
- `2026-08-29-kiem-the-kiem-y-design.md` + plan ✅ merged (roadmap:45).
- `skill-trigger-action-usage-guide.md:128`: Kiếm Tu (trừ `tram`) **chưa migrate sang Trigger/Action engine**, vẫn chạy `effects` cũ.
- `truc-co-kim-dan-content-plan.md:92,136`: ý tưởng cũ (tram maxLevel 18, milestone Kiếm Ý Kim Đan) **không còn khớp code** (tram maxLevel 3).
- Defect mở: QA-2026-09-02-004 (bar Kiếm), QA-001 (unequip — dùng chung 2 path).

## 10. TỒN ĐỌNG — tóm tắt (theo mức nghiêm trọng)

1. 🔴 **3 closure BattleSystem không inject production** (§4.7): game thật → Kiếm Ý tạm = 0, Bạt Kiếm nerf vĩnh viễn 0.6, không hấp thụ Huy Kiếm, **on-hit Kiếm Trận không bao giờ proc**. Test xanh giả nhờ fixture. → **Đây là bug wiring, cần fix + test integration bắt production path.**
2. 🔴 **Bar Kiếm Thế/Kiếm Ý không hiển thị**: `updateKiem` zero call site + bar DOM cũ đã xóa (QA-004, roadmap 9.4).
3. 🟠 **Pool `currentSwordIntent` chết** (§4.6): mọi `swordIntentDamageRatio` cống hiến 0 — hoặc nối nguồn tăng, hoặc xóa ratio khỏi data.
4. 🟠 **Node placeholder không hiệu lực**: Kiếm Ý Bất Tử (hồi sinh), Bạt Kiếm Phẫn Nộ (amp/lv).
5. 🟡 Lệch ngưỡng 9999 vs 10000; lệch mô tả `passive_ngu_kiem_thuat`; id ma trong unequip list.
6. 🟡 Chưa migrate Trigger/Action (trừ `tram`); chưa specialization; chưa có art/portrait Kiếm Tu; chưa có artifact definition.
7. 🟡 Chưa guard khóa re-equip `tram` ở `setSkillLoadoutSlot` (spec Task 4 yêu cầu).
8. ⚪ Vestigial: slot 4 kiếm trận, `usesSwordIntentResource`, `van_kiem_quyet` mồ côi.
9. ⚪ On-hit node 5-9 + trận Tứ Tượng+ khóa realm chờ (chủ đích — content dừng Trúc Cơ).
