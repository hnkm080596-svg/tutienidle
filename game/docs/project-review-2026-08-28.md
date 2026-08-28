# Project Review Toàn Diện — 2026-08-28

> Audit bởi lead tester/reviewer: đối chiếu roadmap vs code (verify từng file:line) + line-by-line bug/logic review các hệ thống core.
> Baseline tại thời điểm audit: **172 file test / 954 test PASS**, type-check sạch, không lint, 0 E2E spec, 0 file audio.
> Kết quả thực thi các fix được ghi trong mục **5. Kết quả thực thi** ở cuối file này (cập nhật 2026-08-28).

## 1. So sánh Roadmap vs Code

| Plan | Trạng thái | Bằng chứng chính |
|---|---|---|
| **Phase 0** save-shape-validation | ❌ CHƯA LÀM | `SaveSystem.ts:513-554` chỉ check version, cast mù `parsed as GameSave` |
| **Phase 0** economy-ecosystem | 🟡 PARTIAL 3/9 | T4 core + T8 curve xong, T2 một nửa; T1/T3/T5/T6/T7/T9 chưa |
| **Phase 0** docs-sync | 🟡 1/5 | `game-guide.md` vẫn mô tả `core/combat/missile/` đã xóa, building cũ, `data/exploration/` |
| **Phase 0** combat HUD out_of_range | ❌ | `CombatSkillPresentation.ts:109` vẫn dùng `DEFAULT_COMBAT_AI_STRATEGY` |
| **Phase 1** talent-direction-choice | ✅ XONG (đúng như roadmap ghi) | 12 talent có effect thật, roll 9 chọn 1, test khóa đầy đủ |
| **Phase 1** truc-co-kim-dan | ❌ | `Stages.ts:357` Trúc Cơ vẫn clone Luyện Khí; `GameManager.ts:1503` gate Kim Đan `return false` |
| **Phase 1** combat-balance-pass | ❌ 0/8 | 10 skill `resourceType:'none'` nhưng `cost>0`; reaction vẫn flat 60-85 |
| **Phase 2** audio-game-feel | ❌ | 0 audio, 0 AudioManager, chỉ 1 preset screen shake |
| **Phase 2** ui-discoverability | ❌ | CombatScene 2.922 dòng god-class, emoji còn, không nameplate |
| **Phase 3** progression-depth | ❌ | `FoundationResolver.ts:22` parked `return 'human'`, không KiemTuNodes, offline không có Cảm Ngộ |
| **Phase 3** economy Part B | ❌ | Không vendor, không nạp Điểm Rèn, túi chỉ sort không filter |
| **Phase 4** tech-debt | ❌ + THỤT LÙI | GameManager 2.703 → 2.833 dòng; E2E 1 → 0 (spec xóa ở commit `e265e5c`) |
| **Phase 4** online-login | 🟡 PARTIAL | Auth Supabase + migration SQL thật; chưa có cloud-save adapter, Phase 6-9 chưa |

**Plans ngoài roadmap:** 9 plan đã xong (artifact system, tooltip revamp, command wheel, body anchor, progression-combat rework, teleport/autocast, skill flow, icon-vfx import, skill-level fixes). Chưa làm: `skill-constellation-glyph`. `talent-system-plan` đã bị thay thế bởi talent-direction-choice.

## 2. Bug list (đã verify từng dòng)

### CRITICAL/HIGH

1. **Save không validate shape** — `SaveSystem.ts:513-554, 619-640`: import save cùng version nhưng thiếu array → crash boot không hồi phục (`restoreFromSave` iterate array thiếu tại `GameManager.ts:2573-2681`); thiếu `lastSavedAt` → cultivation thành NaN vĩnh viễn (`stores/player.ts:186-190,216,223`); trùng `instanceId` trong save → nhân bản trang bị + double stat modifier (`GameManager.ts:2621`, `EquipmentBag.ts:7-9` không dedupe). 3 bug HIGH cùng 1 root cause.
2. **Cap offline 10h bị bypass hoàn toàn** — `ProductionSystem.ts:270-301`: `settleOffline` dừng ở cap nhưng để cycle dở trong `activeCycle`; `tick()` online không có cap, auto-restart backdate deadline về quá khứ → offline 3 ngày được trả hết trong vài phút sau khi mở game.
3. **Quest thu thập không bao giờ hoàn thành** — `QuestSystem.ts:177-204`: chỉ có hook `kill`, không có hook nhặt material → 3 quest (`collect_tu_linh_thao_1`, `collect_huyen_thiet_1`, `daily_collect_hoi_xuan_thao`) chết vĩnh viễn.
4. **Nhân bản qua dissolve** — `EquipmentSystem.ts:1137-1178`: `dissolveInstances(['uuid1','uuid1'])` → pass 1 tính reward 2 lần, pass 2 remove 1 lần → 1 item ra 2× tinh hoa.
5. **Skill tốn 0 tài nguyên dù khai báo cost** — `Skills.ts` (thái hư nhất kiếm cost 15, kiếm khai thiên môn cost 25, 5 skill Pháp Tu cost 8...) đều `resourceType:'none'`; `SkillSystem.ts:311-328` default `return true` → cast free. **Quyết định 2026-08-28: giữ free, xóa trường cost.**
6. **Worker cycles mất trắng mỗi lần reload** — `SaveSystem.ts:477-485` không persist `workerCycles`, `settleOffline` không settle chúng → mất tiến trình + offline worker = 0.
7. **Trúc Cơ là bản clone Luyện Khí** — `Stages.ts:357-370` (content, thuộc truc-co-kim-dan plan).

### MEDIUM

8. Đan Phòng level 6-9: bảng speed/success chỉ 5 entry (`AlchemySystem.ts:104,107`); preview lệch settle ở level 6-9 (`GameManager.ts:2235` dùng `?? 0`, settle clamp → +20).
9. Alchemy job bị xóa im lặng khi recipe/pill không resolve — mất nguyên liệu, không refund (`AlchemySystem.ts:276-282`).
10. Linh Tuyền claim mất phần lẻ (tới ~0.99 đá/lần) + reset đồng hồ trước khi add vào túi (`BuildingSystem.ts:351-363`).
11. Dev flag trong shipping code: `localStorage['dev.testModeUnlockAll']='1'` → xây mọi building free, bỏ qua realm gate (`DevMode.ts:11-21`).
12. Nâng site/building level 4-9 bất khả thi: cost bằng material không có nguồn sản xuất (`ProductionCatalog.ts:39-51`, `materials.ts:358-387`). **Deferred có chủ đích: chờ truc-co-kim-dan M2/M3 thêm nguồn sản xuất.**
13. `MaterialBag.add/remove` không guard NaN → NaN poison cả stack (`MaterialBag.ts:20-22`).
14. Offline cap bất nhất: cultivation 24h / production 10h / alchemy vô hạn.
15. Electron quit-flush: `player.save()` async không await, `notifyFlushComplete()` bắn ngay → mất save khi thoát; listener đăng ký trùng (`useElectronBridge.ts:50-53`).
16. Kiếp Thương + cooldown Độ Kiếp không persist → reload trong 60s là sạch debuff, retry miễn phí (`SaveSystem.ts:361-394` không có buffs field).
17. `rewardGranted = true` đặt trước enemy lookup → lookup fail là mất reward vĩnh viễn (`BattleLootSystem.ts:151-278`).
18. Damage floor `Math.max(1,...)` đặt trước finalDamageMultiplier/ward/mana shield (`CombatSystem.ts:136-140,243`).
19. `getHitChance` trả NaN khi accuracy=0 & evasion≤0 → luôn miss (`Accuracy.ts:6-9`).
20. Event `killed:true` phát trước SurviveLethalGuard (`EntityVitalsSystem.ts:90-106`).
21. Heal-on-kill + mana/ward regen bypass `entity_vitals_changed` (`BattleLootSystem.ts:165-170`, `BattleSystem.ts:1565-1604`).
22. Ailment conversion (lam_cham→dong_bang) bỏ qua kháng (`AilmentSystem.ts:300-336`).

### LOW/LATENT

- Lava zone & tribulation loop không guard `interval > 0` (nguy cơ infinite loop nếu data sai) — `BattleSystem.ts:1477`, `TribulationSystem.ts:106`.
- Reaction lookup dùng ailment id cũ sau conversion — `SkillEffectSystem.ts:204-264`.
- `Math.max(...[])` = −Infinity nếu `attributes: []` — `SkillEffectSystem.ts:101-105`.
- `canUseInSlot` mutate cooldown không có try/finally — `SkillSystem.ts:301-309`.
- Kiting retreat không clamp — `BattleSystem.ts:1040-1049`.
- Effect non-damage vẫn apply lên target đã chết — `SkillEffectSystem.ts:81-93`.
- EventBus không cách ly lỗi handler — `EventBus.ts:33-50`.
- `devResetBranch` bỏ qua prereq `nodeCount` — `NodeSystem.ts:268-302`.
- Node `skillModifiers.percent` bị bỏ rơi ở runtime — `GameManager.ts:472-482`.
- Restore save cắt im lặng stack vượt limit — `GameManager.ts:2606-2616`.
- `bootGame` leak tick interval khi re-auth — `App.vue:459-476`.
- Wash/refine hard-code Linh Thạch Hạ Phẩm + essence fallback realm 4+ (nằm trong economy-plan T1/T2).

## 3. Lỗ hổng test coverage

13 thư mục core 0 test: buff, events, formation, inventory, item, math, notification, presentation, talisman (đã có 2), player, ui, assets, dev. Ngoài ra: `MaterialBag`, `ProductionSystem.tickWorkers`, `EquipmentSystem.enhance`, `AlchemySystem.startJob/resolveFuelWood`, `BuildingSystem.build/canBuildDetailed/claim`, `StatCalculator`, `GameClock`, `EventBus`, `BuffSystem` không có test chuyên biệt.

## 4. Plan thực thi (đã duyệt 2026-08-28)

Phạm vi: **Wave 1-5** (toàn bộ bug HIGH+MEDIUM + nốt Phase 0 roadmap + tech debt).

- **Wave 1 — Integrity:** save shape-validation; dedupe dissolve/restore; NaN guard MaterialBag; tests.
- **Wave 2 — Economy:** enforce cap offline ở tick online; persist + settle worker; hook quest collect; Đan Phòng 9 level + sửa preview; alchemy fail có event; claim Linh Tuyền giữ phần lẻ; dev flag chỉ dev build; T1 essence 9 realm; T2 phẩm Linh Thạch + quy đổi 100:1.
- **Wave 3 — Combat:** xóa cost skill `resourceType:'none'`; hit-chance NaN guard; damage floor cuối pipeline; killed event sau guard; vitals events; guard loop; kháng conversion; latent fixes.
- **Wave 4 — Nốt Phase 0 roadmap:** T6 drop chết + orphan materials; T7 Chọn Thảo; T9 docs-sync; HUD out_of_range.
- **Wave 5 — Tech debt:** eslint; phủ test hệ thống 0 test; E2E spec; GameManager extraction (incremental).

Verify sau mỗi wave: `npm.cmd run test` + `type-check` + `build` từ `game/`.

## 5. Kết quả thực thi (cập nhật 2026-08-28)

Baseline sau khi hoàn tất Wave 1–4 + fix review: **184 file test / 1083 test PASS**, type-check sạch, build OK.

| Wave | Trạng thái | Ghi chú |
|---|---|---|
| Wave 1 — Integrity | ✅ Xong | save shape-validation + round-trip; dedupe dissolve/restore; NaN guard MaterialBag. Review bổ sung shape `equipment`/`equipmentSlots` (chặn crash boot/NaN `refreshModifiers`). |
| Wave 2 — Economy | ✅ Xong | cap 10h online+offline; persist+settle worker; quest collect hook; Đan Phòng 9 level; claim Linh Tuyền giữ phần lẻ; dev flag; T1 essence 9 realm; T2 phẩm Linh Thạch + quy đổi 100:1. |
| Wave 3 — Combat | ✅ Xong | dọn cost `resourceType:'none'`; hit-chance NaN guard; damage floor cuối pipeline; killed event sau SurviveLethalGuard; vitals events; guard loop lava/tribulation; kháng conversion; latent fixes. |
| Wave 4 — Nốt Phase 0 | 🟡 Một phần | T6 drop chết + orphan ✅ (migrate drop → `qi_refining_ore_hoang`, xóa 11 material, drop-sink invariant test); HUD `out_of_range` ✅; **T7 Chọn Thảo ❌; T9 docs-sync ❌**. |
| Wave 5 — Tech debt | ❌ Chưa làm | eslint; phủ test hệ thống 0 test; E2E spec; GameManager extraction. |

**Ngoài plan (thêm theo yêu cầu người dùng):** quy đổi cảnh giới linh mộc/linh khoáng 10:1 — `MaterialTierConversionBalance.ts` + `GameManager.convertMaterialTier` + UI `ProductionPanel.vue` (gộp LÊN theo thang mortal→qi_refining→foundation_establishment; gỗ giữ dạng, quáng giữ phẩm; chỉ 1 chiều).

**Fix từ đợt review 2026-08-28 (game reviewer pass):**

1. ✅ False-negative save shape — `saveShapeValidation.ts` bổ sung validate `equipment` (slot/equipped/mainStat/affixes/forgePoints) + `equipmentSlots` (slot/enhanceLevel); thêm test.
2. ✅ `craftBreakthroughToken` all-or-nothing — check registry + hoàn Linh Thạch khi token tràn stack.
3. ✅ PillBag NaN/Infinity guard (add + remove) — cùng vector đã harden ở MaterialBag.
4. ✅ `convertAilment` dedupe — remove instance trùng id trước khi add, tránh remove() xoá cả hai.

**Bug đã biết CHƯA sửa (cần quyết định thiết kế, ghi nhận cho đợt sau):**

- [MEDIUM/UNCERTAIN] Linh Tuyền revalue backlog theo realm tại thời điểm claim (`BuildingSystem.ts`) — đột phá xong mới claim thì backlog tính lại theo rate realm cao (×5,6/bậc). Chưa rõ chủ đích hay bug.
- [LOW] Nhóm "bỏ qua overflow khi add" ở cap stack 1000: alchemy settle đan (`AlchemySystem.ts`), quest reward itemDrops (`QuestSystem.ts`), dissolve essence cap 9999 (`GameManager.ts`), toast production hiển thị gross thay vì net. Cần chốt hành vi (refund hay ghi overflow).
- [LOW] `targetKilled` trong `CombatSystem.resolveActionHit` tính trước floor/multiplier (chưa có consumer, sai semantics cho người dùng sau).
- [LOW/LATENT] `SkillEffectSystem.applyAll` skip `!target.alive` áp cả effect 'buff' hướng source — bẫy latent nếu skill tương lai gộp damage+buff.
- [LOW] `PillBag`/quest/dissolve overflow (nhóm trên) + `tickWorkers` không validate territory realm (UNCERTAIN, không exploit được ở content hiện tại).
