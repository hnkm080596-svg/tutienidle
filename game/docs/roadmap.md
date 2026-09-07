# Roadmap Phát Triển — Tiên Hiệp Idle (Single Source of Truth)

> Tài liệu định hướng tổng hợp DUY NHẤT của project.
> Lập ngày 2026-08-27 sau đợt rà soát toàn diện 5 mảng: Chiến đấu, Tiến trình, Kinh tế, UI/UX, Kỹ thuật & Nội dung.
> **Gộp 2026-09-05**: roadmap riêng `turn-based-combat-roadmap.md` đã được GỘP TOÀN BỘ vào đây (mục 9) — file cũ giờ chỉ còn là con trỏ, không phải nguồn sự thật thứ hai.
> Mỗi hạng mục lớn có plan chi tiết riêng (dẫn link bên dưới). Khi plan và roadmap lệch nhau, plan chi tiết là nguồn sự thật cho hạng mục đó.
> Audit toàn diện mới nhất (bug list + trạng thái từng plan, verify theo file:line): [project-review-2026-08-28.md](./project-review-2026-08-28.md).
> Baseline verify gần nhất (2026-09-05, main checkout): `type-check` sạch + full suite **2510/2510 pass (390 files)** + `build` pass.
> **Cập nhật 2026-09-07**: mục 0 dưới đây là roadmap tới BETA đã hợp nhất — nguồn tham chiếu chính khi lập kế hoạch làm việc từ nay. Mục 1-10 phía dưới GIỮ NGUYÊN làm chi tiết/lịch sử tra cứu (không xóa) — khi mục 0 và chi tiết bên dưới lệch nhau, mục 0 là nguồn sự thật cho THỨ TỰ/PHẠM VI beta; chi tiết kỹ thuật từng hạng mục vẫn tra ở mục 1-10 hoặc plan link tương ứng.

## 0. Roadmap tới Beta — hợp nhất (2026-09-07)

**Trần nội dung: cảnh giới Trúc Cơ.** Không có Kim Đan+ trong beta (quyết định người dùng 2026-08-29, giữ nguyên — data realm cao hơn tồn tại nhưng không có nội dung gate mới). Beta coi là xong khi người chơi có thể chơi trọn vẹn Phàm Nhân → Trúc Cơ với nội dung thật ở mọi hệ thống chạm tới, không có mảng rỗng/placeholder nào lộ ra trong luồng chơi bình thường.

**Đã xong, không cần làm lại** (chi tiết ở mục 1-10): toàn bộ hạ tầng combat turn-based (engine/ATB/targeting/wave-spawn/presentation split + P17 runtime separation, 2026-09-07), Phase 0 (bug/economy/save), phần lớn Phase 1 (nội dung Trúc Cơ M1 — 10 stage/20 enemy/boss/quest, talent catalog v4 M1 combat), phần lớn QA Deep lần 1 (mục 8), item-grade rework, i18n phần lớn, lint/E2E/code-split (Phase 4 một phần).

### Phase A — Combat: nội dung thật (thứ tự phụ thuộc)

| # | Việc | Phụ thuộc | Chi tiết |
|---|---|---|---|
| A1 | Wire ReactionManager/SkillEffectSystem vào TurnBattleSystem | — | mục 9.5 #2 |
| A2 | Buff content cho 3 nguồn: Tribulation/boss enrage (đổi kiểu sang `TurnBuffDefinition` + gán `TurnBossTrigger`, hiện trống), thiên phú (`passiveConvertsTo` đối chiếu lại `TurnBuffRegistry` thay vì registry cũ), trang bị (☑ **tạo mới**, Affix hiện không có field buff — không phải migrate) | — | ✅ Wiring `TURN_BUFF_REGISTRY`→`TurnBattleSystem` **đã xong** (xem mục 9.5 #6, ghi chú dòng ~609) — bảng cũ nói "0 consumer" đã lỗi thời, chỉ còn thiếu content 3 nguồn trên |
| A3 | Skill content thật: special/ultimate cho mọi build (hiện chỉ Kiếm Tu) | — | mục 9.5 #3 |
| A4 | Reaction Path nội dung thật (pool element skill + ultimate %) | A1 | mục 9.5 #12 |
| A5 | Boss enrage content bằng buff thủ công | A2 | mục 9.5 #11 |
| A6 | Buff duration presentation (tooltip/VFX theo lượt) | A2 | mục 9.5 #7 |
| A7 | `hpRegenPerTurn` | — | ✅ **CHỐT 2026-09-07: giữ** cho kỹ thuật/trang bị/cảnh giới (Pill đã bỏ trước đó, không đổi) |

### Phase B — Progression & thế giới: nội dung thật

| # | Việc | Phụ thuộc | Chi tiết |
|---|---|---|---|
| B1 | `perfectClearTurnLimit` cho 30 stage (hiện 0/30, chip Hoàn Mỹ đang disabled) | — | mục 9.5 #4 |
| B2 | Trận Pháp thật (thay `hon_don_tran` test-only) | — | mục 9.8 Part C, mục 9.9 |
| B3 | Companion roster thật (tên/stat/skill từng companion) | — | ✅ **CHỐT 2026-09-07: TRONG beta.** Engine đã xong (`players[]`, gacha, exp curve) — mục 9.8 Part B, mục 9.5 #8. Cần spec riêng do khối lượng content lớn. |
| B4 | Talent v4 M2 (tu luyện) + M3 (sản xuất) | — | mục 7.5 dòng 76 — target `TurnBuffDefinition`, không phải legacy `BuffDefinition` (mục 10.3) |
| B5 | World Map thật cho Thanh Vân (hạ tầng hex layout đã có, chưa có data bản đồ) | — | ✅ **CHỐT 2026-09-07: TRONG beta**, thay vì giữ dạng danh sách stage. Cần spec riêng — hạ tầng (`src/core/world-map/`) mới có layout+validator, chưa có nội dung. |

### Phase C — Dọn nợ kỹ thuật (chạy sau khi content ổn định, không chặn A/B)

| # | Việc | Phụ thuộc | Chi tiết |
|---|---|---|---|
| C1 | Xóa `battle/legacy/` (engine real-time cũ) + gỡ shim | A1 + A2 | mục 9.5 #9 |
| C2 | Tách tiếp `GameManager.ts` (2.939 dòng) | — | mục 10.4 |
| C3 | Nameplate công trình + dọn placeholder/emoji còn lại | — | Phase 2 cũ (mục 3) |
| C4 | Locale sweep (7.10 Task 6) + container-fit refactor (7.10 Task 7) | — | mục 7.10 |

### Phase D — QA/Release trước beta

| # | Việc |
|---|---|
| D1 | Regression toàn diện + balance pass cho nội dung mới (A+B) |
| D2 | E2E bổ sung: auto-farm Hoàn Mỹ + manual tap-to-cast (sau khi B1 xong, ổn định) |
| D3 | QA Deep pass lần 2 (như mục 8, chạy lại sau khi A+B+C xong) |
| D4 | **Ngoài phạm vi beta** (✅ chốt 2026-09-07): Giai đoạn 6 Pre-production (online foundation/VIP/prestige) → hậu-beta. Âm thanh → vẫn ngoài phạm vi (quyết định 2026-08-29, chưa có tài nguyên). |

### Ghi chú thứ tự

- **A2 chặn đường nhiều nhất** (mở khóa A5, A6, C1) — nên làm sớm trong Phase A.
- **A1 + A2 chặn C1** — không xóa engine cũ khi wiring chưa xong (an toàn rollback).
- **B3 (Companion) và B5 (World Map)** là 2 hạng mục content lớn nhất, mỗi cái cần brainstorm + spec riêng trước khi viết plan — không gộp chung 1 plan (giữ nguyên convention "mỗi hệ thống 1 plan" đã có).
- Phase C không chặn Phase A/B — chạy song song khi có capacity rảnh (đúng tinh thần Phase 4 cũ "chạy song song, không chặn phase khác").
- 3.5/3.6 (Stat cap Phàm Nhân, CDR cap 300%) vẫn treo (mục 10.3) — không chặn beta, xử lý trong Phase D balance pass nếu còn thời gian.

## 1. Nhận định hiện trạng

**Điểm mạnh cần giữ:**

- Kiến trúc sạch: Vue 3 (UI) + Phaser (canvas) + Pinia, core/data tách biệt, data-driven nhất quán.
- Pipeline damage duy nhất, test phủ dày ở combat (~30 file battle/combat/skill, tổng 390 file test / 2510 tests — 2026-09-05).
- Vòng lặp tu luyện → Độ Kiếp → chọn đường đã có cá tính riêng.
- Kinh tế có file balance tách riêng, giao dịch atomic chống nhân bản.
- Combat turn-based ATB đã thay hẳn engine real-time cũ (mục 9) — `TurnBattleSystem` là engine duy nhất, engine cũ nằm nguyên trong `battle/legacy/` chờ xóa.

**Vấn đề lớn nhất, theo thứ tự rủi ro:**

1. **Tường nội dung Trúc Cơ**: hết nội dung thật ở Trúc Cơ tầng 18 (~34 giờ chơi); stage Trúc Cơ là bản clone của Luyện Khí (`data/stage/Stages.ts:357`); không có Kim Đan (`GameManager.ts:1439` trả `false` cứng). *(2026-08-29: M1 đã xong — 10 stage Trúc Cơ thật + 20 enemy `foundation_*` + boss 2-phase/enrage + 5 quest; Kiếm Tu có node tree thật qua kiem-tu-tu-luc, xem Phase 3. Kim Đan M2/M3 bỏ khỏi roadmap cùng ngày theo quyết định người dùng — game kết thúc nội dung "cứng" ở đỉnh Trúc Cơ, realm cao hơn chỉ là data nền.)*
2. **Thiên phú trang trí** *(đã giải quyết 2026-08-28 v3; NÂNG CẤP v4 2026-09-03 — M1 ship)*: cũ — 11/13 thiên phú có `effects: []` rỗng; v3 từng giải quyết bằng percent đơn tuyến; **v4** thay toàn bộ catalog bằng "luật chơi" trên buff/trigger engine (11 combat nhịp tích-ngưỡng-bùng + power budget chung + chi phí đối trọng), M1 đã merge — xem Phase 1.
3. **Thiếu âm thanh hoàn toàn**: 0 file audio trong project; 1.137 spritesheet VFX không được tham chiếu.
4. **Bug và drop chết trong kinh tế** *(đã giải quyết 2026-08-28 — economy-ecosystem hoàn thành: T1–T6+T8+T9, T7 bỏ vì linh thảo giữ hoàn toàn random)*: mapping Tinh Hoa sai cho realm 4+ (`RefinementBalance.ts:74-81`); vật liệu legacy vẫn rơi nhưng không còn sink.
5. **Save không validate shape** *(đã giải quyết 2026-08-28 — save-shape-validation Wave 1 + bổ sung equipment/slot shape khi review)*: chỉ kiểm tra version, tiền lệ crash boot v47 có thể tái diễn.
6. **Tài liệu lệch code** *(đã giải quyết 2026-08-28 — docs-sync viết lại game-guide.md + item-design-reference.md, dọn comment MissileSystem, xóa `Plans .md`)*: `game-guide.md` và `item-design-reference.md` mô tả hệ thống đã xóa.
7. **Nợ kỹ thuật** *(cập nhật 2026-09-05)*: `GameManager.ts` **2.939 dòng** (tách Ops 2026-09-03 xong lại phình do wiring turn-based — cần tách tiếp, xem mục 10); `CombatScene.ts` còn **1.539 dòng** (đã tách `PlayerHudLayer` + HUD rewrite, không còn god-class 2.922 dòng như trước); nhiều hệ thống core 0 test; **lint đã có** (`eslint.config.js` + script `lint`); **E2E đã có 6 spec** (`boot-fresh`, `combat-overlay-layout`, `create-to-combat`, `ink-wash-ui`, `save-reload`, `turn-combat-hud`). Hai plan audit mới về code/lifecycle và UI/UX/browser QA đã được lập, xem mục 7.10.
8. **Việc đang bay (2026-09-05)** — worktree-gp123 Group 1+2 (QA 9.4/9.6/9.8/9.9/9.10/9.11 + OPT-04/06) ✅ **ĐÃ MERGE** 318083; Group 3 (6E/6F/6G) code uncommitted đã hủy — làm lại từ spec (xem 8.6). eat/combat-art-roster-tranphap đang chạy SDD 21-task. Action Playback đã merge qua remediation Tasks 1–8.

## 2. Nguyên tắc ưu tiên

- **Giữ chân trước, làm đẹp sau**: nội dung và vòng lặp progression quan trọng hơn juice.
- **Sửa bug hiện hữu trước khi thêm tính năng mới.**
- **Mỗi phase phải để lại bản build chơi được**, không có nhánh dở dang kéo dài.
- **Tài liệu cập nhật cùng code** — không dồn nợ tài liệu.
- Dự án đang trong development phase: không cần migration save (theo AGENTS.md).

## 2.5. Kết quả thực thi 2026-08-28 (đợt sửa bug + review)

Chi tiết từng bug/file:line trong [project-review-2026-08-28.md](./project-review-2026-08-28.md). Tóm tắt theo wave:

- **Wave 1 — Integrity** ✅: save shape-validation (review bổ sung shape equipment/slot chặn crash boot + NaN), dedupe dissolve/restore, NaN guard MaterialBag.
- **Wave 2 — Economy** ✅: enforce cap 10h online+offline, persist+settle worker, hook quest collect, Đan Phòng 9 level, claim Linh Tuyền giữ phần lẻ, T1 essence đủ 9 realm, T2 phẩm Linh Thạch + quy đổi 100:1.
- **Wave 3 — Combat** ✅: dọn cost skill `resourceType:'none'`, hit-chance NaN guard, damage floor cuối pipeline, killed event sau SurviveLethalGuard, vitals events, guard loop lava/tribulation, kháng conversion, latent fixes.
- **Wave 4 — Nốt Phase 0** ✅: T6 drop chết + material mồ côi ✅ (migrate drop sang `qi_refining_ore_hoang`, xóa 11 material legacy, drop-sink invariant test); HUD `out_of_range` ✅; T9 docs-sync ✅ (viết lại game-guide/item-design-reference, xóa `Plans .md`); T7 Chọn Thảo ⛔ bỏ (linh thảo hoàn toàn random).
- **Ngoài plan (mới)** ✅: quy đổi cảnh giới linh mộc/linh khoáng 10:1 (`MaterialTierConversionBalance` + `GameManager.convertMaterialTier` + UI `ProductionPanel`).
- **Review fixes 2026-08-28** ✅: false-negative save shape (equipment/slot), `craftBreakthroughToken` all-or-nothing, PillBag NaN guard, `convertAilment` dedupe.
- **Wave 5 — Tech debt** 🟡 (cập nhật 2026-09-05): ~~eslint, phủ test hệ thống 0 test, E2E spec, GameManager extraction~~ → **eslint ✅ đã có, E2E ✅ 6 spec đã có**; còn lại: GameManager tách tiếp (2.939 dòng), phủ test hệ 0-test.
- **Kiếm Tu Tự Lực (ngoài plan, merged 2026-08-29)** ✅: node tree Kiếm Tu 2 nhánh (`KiemTuNodes.ts`), 9 skill Kiếm Trận + Bát Kiếm, tự lực combat state (auto-channel tick AoE, Huy Kiếm flat per-cast, skillCastCount prereq), route selection UI + slot auto-replace — phần lớn nằm trong phạm vi [progression-depth-plan.md](./progression-depth-plan.md) (xem Phase 3).
- **UI primitives (ngoài plan, 2026-08-29)** ✅: Bar/Chip/Eyebrow/StatRow/EmptyState/SceneHeader primitives + GameButton mở rộng, migrate ~25+ button/19 progress bar — one bước chuẩn bị cho [ui-discoverability-refactor-plan.md](./ui-discoverability-refactor-plan.md).
- **Pháp Tu ritual progression (ngoài plan, 2026-08-28)** ✅: bỏ nút tiểu đột phá — tự advance khi tu đầy; keystone kim/thổ mở stat The-Gain tương ứng.

## 3. Các phase

### Phase 0 — Sửa lỗi & Ổn định nền tảng

Mục tiêu: loại bug hiện hữu và nợ tài liệu trước khi xây tiếp.

| Hạng mục | Plan | Trạng thái |
|---|---|---|
| Validate shape save khi load/import (chặn crash kiểu v47) | [save-shape-validation-plan.md](./save-shape-validation-plan.md) | ✅ Xong 2026-08-28 (Wave 1; review bổ sung shape equipment/slot) |
| Audit & sửa hệ sinh thái kinh tế: Tinh Hoa realm 4+, phẩm Linh Thạch, worker offline, Đan Phòng 6–9, drop chết, Chọn Thảo, curve Linh Tuyền | economy-ecosystem-plan (đã dọn sau khi hoàn thành; gộp Phần A của economy-fixes-sinks-plan) | ✅ Xong — T1–T6+T8+T9; T7 Chọn Thảo ⛔ bỏ (linh thảo hoàn toàn random) |
| Đồng bộ `game-guide.md`, `item-design-reference.md` với code | docs-sync-audit-plan (đã dọn sau khi hoàn thành) | ✅ Xong 2026-08-28 (Wave 4; đã xóa `Plans .md`) |
| Sửa HUD `out_of_range` đọc sai strategy (nằm trong combat pass) | [combat-balance-pass-plan.md](./combat-balance-pass-plan.md) | ✅ Xong 2026-08-28 (Wave 4) |

Tiêu chí hoàn thành: không còn bug kinh tế đã biết; save hỏng được phát hiện có chủ đích thay vì crash; tài liệu khớp code.

### Phase 1 — Giữ chân người chơi

Mục tiêu: phá tường nội dung Trúc Cơ và biến thiên phú thành quyết định build thật.

| Hạng mục | Plan | Trạng thái |
|---|---|---|
| Thiên phú chọn hướng Đạo (roll 9 chọn 1) + easter egg Phàm Cốt | talent-direction-choice-plan (đã dọn sau khi hoàn thành) | ✅ Xong (v3, thay bởi v4 ở dòng dưới) |
| **Talent Catalog v4 — "thiên phú là luật chơi"** (11 combat + 5 tu luyện + 2+2 sản xuất, power budget chung, siết đa talent) | [spec 2026-09-03-talent-catalog-v4-design.md](./specs/2026-09-03-talent-catalog-v4-design.md) + [plan M1](./plans/2026-09-03-talent-catalog-v4-m1-combat.md) | ✅ **M1 combat XONG** (2026-09-03 catalog/wiring/QA + 2026-09-06 rhythm locks 11 talent + power budget weights — branch gp123-group3-talent 4907ed6+7caad43): E1 convert-on-max khóa test, E2 passiveCondition/passiveConvertsTo, catalog 12 roll (11 combat + Phàm Cốt) + 13 retired + 2 PARKED M3, 5 buff E1, hidden passives `TalentPassives.ts`, GameManager grant/revoke + Bất Tử Thể v4 (cleanse + Tử Sinh Ngộ), collectTalentEffects siết id đầu. **M2 (tu luyện — Hậu Tích Bạt Phát, Lôi Kiếp, Vấn Đạo, Hải Nạp, Ngộ Đạo offline) + M3 (sản xuất — Hỏa Hầu Thông Thần, Bách Luyện Thành Khí, +2 PARKED Trận/Phù) chưa làm** — ⚠️ M2/M3 thiết kế sau rework combat nên phải target `TurnBuffDefinition` (không phải legacy `BuffDefinition`), xem mục 10 |
| Nội dung Trúc Cơ thật | [truc-co-kim-dan-content-plan.md](./truc-co-kim-dan-content-plan.md) | ✅ M1 xong (2026-08-29) — 10 stage Trúc Cơ thật (`foundation_floor_1..10`) + 20 enemy `foundation_*` + boss 2-phase/enrage + 5 quest. **Kim Đan (M2 gate + M3 đời sống) BỎ khỏi roadmap 2026-08-29 (quyết định người dùng)** — plan đóng ở M1; các phụ thuộc Kim Đan trong plan khác chuyển thành parked/khóa vĩnh viễn đến khi người dùng mở lại |
| Reaction scale theo Power, đa dạng nhịp skill, fizzle refund, nền boss skill | [combat-balance-pass-plan.md](./combat-balance-pass-plan.md) | ✅ Xong 2026-08-29 — 8/8 task (xem "Kết quả playtest" cuối plan): dọn cost chết + invariant; reaction `powerScalingRatio 0.5` qua `elementalBasePower`; nhịp 5 skill Pháp Tu riêng biệt (Hỏa 1.6/4, Thủy 0.9/1, Mộc 1.2/2, Kim 1.0/2.5, Thổ 1.4/5); fizzle hoàn 100% resource + 50% cooldown; boss `foundation_ferocious_flood_dragon_whelp` có special attack data-driven; dọn `canUseInSlot`/`use()`/emoji reaction. **Mana giữ nguyên vai trò Linh lực hộ thể** (`manaShieldPercent`), không thêm cost cast (quyết định người dùng). Giữ lại có chủ đích: `attack_speed_cast`, `Skill.castTime` legacy |

Tiêu chí hoàn thành: người chơi có mục tiêu theo đuổi hết Trúc Cơ; thiên phú đã chọn tạo khác biệt đo được; combat có nhịp và phản ứng có ý nghĩa (không phải qua mana cost — mana là Linh lực hộ thể).

### Phase 2 — Game feel & Khám phá

Mục tiêu: game "có hồn" và dễ khám phá hơn.

| Hạng mục | Plan | Trạng thái |
|---|---|---|
| Nameplate công trình, tách CombatScene, dọn placeholder/emoji | [ui-discoverability-refactor-plan.md](./ui-discoverability-refactor-plan.md) | 🟡 Một phần lớn đã xong ngoài plan: UI primitives landed 2026-08-29; `CombatScene` 2.922→**1.539 dòng** (`PlayerHudLayer` tách riêng, HUD rewrite + gỡ legacy controls qua Slice 7 master plan 2026-09-05); CombatSceneOverlay + TurnCombatSkillBar + TurnOrderStrip + BattleLogPanel đã có. **Còn lại**: nameplate công trình, dọn placeholder/emoji |

Tiêu chí hoàn thành: hotspot công trình tự giải thích không cần tooltip; CombatScene không còn là god-class. *(2026-08-29: Âm thanh là asset — tạm bỏ qua khỏi roadmap theo quyết định người dùng; plan [audio-game-feel-plan.md](./audio-game-feel-plan.md) giữ nguyên như tài liệu tham khảo.)*

### Phase 3 — Chiều sâu hệ thống

Mục tiêu: mở rộng các trục progression đang bỏ hoang.

| Hạng mục | Plan | Trạng thái |
|---|---|---|
| Kiến Cơ 4 bậc, node tree Kiếm Tu, chiều sâu idle (Cảm Ngộ offline, nguồn tăng tốc tu luyện) | [progression-depth-plan.md](./progression-depth-plan.md) | 🟡 Một phần — node tree Kiếm Tu (2 nhánh `KiemTuNodes.ts`, 9 skill Kiếm Trận, Bát Kiếm, tự lực combat) ✅ xong qua kiem-tu-tu-luc; **Kiếm Thế / Kiếm Ý (2026-08-29)** ✅ — route chốt vĩnh viễn lúc chọn path (tram Lv3), 2 tài nguyên (Kiếm Thế pool trận KT / Kiếm Ý tầng boss vĩnh viễn BK), mỗi route 1 skill + 2 ult manual, 9 on-hit node, 6 node chuyển skill cũ, gỡ Nộ; **Đột Phá / Bậc Ẩn / Lôi Kiếp (2026-08-29, spec dot-pha-loi-kiep)** ✅ — Kiến Cơ 4 bậc un-park qua resolver `BreakthroughGrades.ts` (Địa: Trúc Cơ Đan + 3 tầng Luyện Th thể; Thiên: 6/6 + 6/8 kinh mạch; Đại Đạo ẩn hoàn toàn — thua kiếp siêu cấp mất vĩnh viễn, thắng chuyển Phàm Cốt → Phàm Nhân Chi Cốt), Kỳ Kinh Bát Mạch 9 đường (MeridianSystem), quái ẩn Huyết Mông cửa sổ 1000 kill drop Thiên Địa Chi Kiều, Thông Mạch Đan/Trúc Cơ Đan (alchemy specialIngredients), TribulationDirector chương kiếp mới (Tâm Ma hỏi đáp + tank lôi, bỏ quái Kiếp + Đột Phá Lệnh + TribulationSystem cũ), caps Luyện Th thể ×3.5, save v54 — số liệu first-pass chờ playtest; Cảm Ngộ offline chưa làm (Ngộ Đạo chỉ online) |
| Sink Linh Thạch hậu kỳ, vendor, Điểm Rèn, filter túi đồ | [economy-fixes-sinks-plan.md](./economy-fixes-sinks-plan.md) (Phần B — Phần A đã gộp vào economy-ecosystem-plan, đã dọn sau khi hoàn thành) | 🟡 Một phần — Điểm Rèn per-item (forgePoints) đã có trong `EquipmentSystem` (rework 2026-08-26); vendor redesign + filter túi đồ → chuyển sang Group 3 của gp123 spec v2 (`2026-09-03-gp123-bugfix-optimize-design.md` — file spec+plan hiện chỉ có trong branch `worktree-gp123`, chưa có trên master, xem mục 8.6) |

Tiêu chí hoàn thành: gate đột phá có chất lượng khác nhau; Kiếm Tu có chiều sâu build tương đương Pháp Tu; idle có đường nâng cấp.

### Phase 4 — Bền vững kỹ thuật (chạy song song, không chặn phase khác)

| Hạng mục | Plan | Trạng thái |
|---|---|---|
| Tách dần GameManager, phủ test hệ kinh tế, thêm E2E + lint | [tech-debt-test-coverage-plan.md](./tech-debt-test-coverage-plan.md) | 🟡 Một phần — GameManager tách Ops (SaveRestore/QuestOps/AlchemyOps/BuildingOps/EquipmentOps) nhưng đã phình lại **2.939 dòng** (wiring turn-based) → cần đợt tách tiếp (mục 10); **lint ✅ đã có** (`eslint.config.js` + `npm run lint`); **E2E ✅ 6 spec** (`game/tests/e2e/`); test 390 files / 2510 tests (2026-09-05); còn lại: phủ test các hệ 0-test |
| Cloud save / online (plan riêng đã có) | [online-login-cloud-save-plan.md](./online-login-cloud-save-plan.md) | 🟡 Một phần — auth Supabase + migration SQL; cloud-save layer có rồi nhưng chỉ là local adapter (`LocalCloudSaveService`), chưa Supabase adapter thật; QA-011 (atomic 2-key) đã fix trong branch `worktree-gp123` (revision-first + rollback), chờ merge |

Tiêu chí hoàn thành: không file nào quá ~1.000 dòng trong core/game; mọi hệ thống core có test; luồng boot → tạo nhân vật → combat có E2E.

## 4. Phụ thuộc giữa các plan

```
Phase 0:  save-validation    ─┐
          economy-ecosystem ──┼─► Phase 1: talent-direction (độc lập)
          docs-sync        ──┘    truc-co-kim-dan (M1 đã xong, M2/M3 bỏ — plan đóng)
                                  combat-balance (độc lập, nên sau docs-sync để cập nhật guide một lần)
Phase 2:  ui-refactor — độc lập, chạy song song Phase 1
          (audio-game-feel tạm bỏ qua khỏi roadmap — asset chưa có)
Phase 3:  progression-depth — Kiến Cơ 4 bậc parked chờ gate cảnh giới mới
          kiem-tu-design  — node tree Kiếm Tu đã xong; thang trận Tứ Tượng+
                            data ghi sẵn, khóa chờ (không còn gate Kim Đan)
          economy-fixes-sinks Phần B — chuyển sang gp123 Group 3 (spec+plan đã có trong branch worktree-gp123)
Phase 4:  tech-debt — chạy nền liên tục
Mục 9:    turn-based rework — CƠ CHẾ XONG (engine duy nhất); còn content/wiring/playback (bảng 9.5)
In-flight: gp123 (Group 1+2 xong chờ merge; Group 3 đang làm) → action-playback (Task 2/8) — thứ tự merge ở mục 10
```

- `docs-sync-audit` nên hoàn thành sớm để mọi plan sau tham chiếu tài liệu đúng.
- `truc-co-kim-dan-content` đóng ở M1 (nội dung Trúc Cơ). M2 gate Kim Đan và M3 đời sống Kim Đan bỏ khỏi roadmap.
- Cloud save chỉ nên đóng băng schema save sau khi Phase 0 (validation) xong.

## 5. Ngoài phạm vi roadmap này

- **Phù/Trận Pháp**: đã có roadmap hậu kỳ riêng (`future-talisman-formation-system-plan.md`), giữ khóa.
- **Bàn cờ vây 19×19**: hướng rework đã ghi trong `game-guide.md`, chưa đưa vào roadmap hiện tại — cần quyết định riêng trước khi lập plan.(bỏ)
- **Server roll thiên phú / xác minh backend**: thuộc plan online (`online-login-cloud-save-plan.md`); plan thiên phú trong roadmap này chỉ làm phần effect client-side.
- **Thể Tu**: plumbing combat đã có nhưng chưa đủ nội dung phát hành; được ghi nhận như lựa chọn mở rộng trong `progression-depth-plan.md`, không cam kết mốc.
- **Kim Đan (M2 gate + M3 đời sống)**: bỏ khỏi roadmap 2026-08-29 (quyết định người dùng). Data realm `golden_core`+ vẫn tồn tại trong game (skill passive, realms) nhưng không có nội dung gate mới; mở lại chỉ khi người dùng yêu cầu.
- **Âm thanh / audio-game-feel**: tạm bỏ qua — là mảng asset, chưa có nguồn tài nguyên audio (quyết định người dùng 2026-08-29). Plan giữ làm tham khảo.
- **World map**: `src/core/world-map/` mới có hạ tầng (hex layout, validator), chưa có dữ liệu bản đồ thật. Với Kim Đan đã bỏ, chờ quyết định riêng về Thanh Vân: chuyển sang biểu diễn world-map hay giữ stage list.
- **Tutorial động**: tutorial hiện là carousel 9 bước thuần thông tin (`src/data/tutorial/tutorialSteps.ts`). Việc instrument theo dõi hành động thật của người chơi mới chỉ ghi nhận, chưa lập plan.
- **Kiếm Tu node tree (đã chuyển vào phạm vi)**: từng nằm ngoài, nay đã làm xong qua `worktree-kiem-tu-tu-luc` — xem Phase 3 / progression-depth.
- **Hệ nhân vật phụ — party/companion recruit + UI/nội dung** (engine `players[]` đã xong 2026-09-04): spec riêng sau, là việc content/feature lớn — xem bảng 9.5 việc #8.

## 6. Quy trình thực hiện

1. Mỗi plan được thực hiện bởi một phiên agent riêng (theo Context policy trong PROJECT_CONTEXT.md).
2. Trước khi chạy plan: đọc plan + các file được dẫn trong plan.
3. Sau mỗi plan: chạy `npm.cmd run type-check`, `npx.cmd vitest run`, `npm.cmd run build` (+ `npm.cmd run test:e2e` và `npm.cmd run lint` khi chạm UI/luồng boot) từ `game/`.
4. Khi đổi hành vi, cập nhật tài liệu sống trong `docs/` cùng thay đổi code.
5. Không tạo thêm plan không có đuôi `.md`.

---

## 7. Cập nhật 2026-09-02 — Todolist thực thi (hợp nhất từ bản mới)

> File `docs/ROADMAP.md` (bản 2026-09-01) đã được gộp vào đây. Các spec/plan cũ tham chiếu `docs/ROADMAP.md` đã được chuyển sang `game/docs/roadmap.md`.

### 7.1. Bugfix / ổn định — ƯU TIÊN CAO

**1.1 Fix MainMenu e2e blocker** ✅ (auth-first flow, 6/6 e2e xanh — merge `306d898`; fix tạm, WelcomeAuthScreen thay thế ở T6.1 Task 8)

**1.2 Dọn working tree master** ✅ (untracked docs committed, skills cleanup committed, 4 stashes xử lý)

**1.3 Dọn worktrees cũ** ✅ (audit-fixes merged `6995cf9`, dong-fu-buildings-style-redesign merged `eaa9719`, 4 worktree nhỏ dọn xong)

**1.3a audit-fixes** ✅ — 15 tasks, merged `6995cf9` (review + commit + integrate + docs)
**1.3b dong-fu-buildings-style-redesign** ✅ — merged `eaa9719`
**1.3c worktrees nhỏ** ✅ — dọn xong (simplify-agent-rules discard; adversarial-qa trùng master; fix-decimal-format duplicate; material-names merged `a68f641`)

### 7.2. i18n — Deferred items từ final review (APPROVED_WITH_MINORS)

- **2.1** ✅ vue-i18n v9.14 → v11.4.10 migration — merged `fc3efa6` (2026-09-03); pure bump, 0 source edits, full matrix xanh (2162 tests, e2e 9/9), QA quick PASS WITH EVIDENCE
- **2.2** ✅ Hoàn tất string extraction — batches 1+2 done: ActionAvailability/AlchemyView/HomeResourceStrip + NodeInspector/SkillDetailView/6 combat overlays (`80c441e`, `46b3df9`), SkillResourceStatLabels (`6705982`); final batch FunctionOverlayPanel + useBagFilter GROUP/AGE_LABELS (`912b1f3`). Chỉ còn data-layer names (= 2.7)
- **2.3** ✅ `formatStat` extension cho `SkillResourceStatLabels` — labels/descriptions chuyển sang locale + shared formatter (formatter judgment đã ghi document), `6705982`
- **2.4** ❌ OBSOLETE — file `CombatStatusBar` xóa trong 6A; field `mpLabel` là dead-code, cleanup `1c7a092`
- **2.5** ✅ Bỏ locale-coupled test assertions — 3 files converted, 5 files verified data-driven (không cần đổi), `d384e1d`
- **2.6** ✅ Locale parity lint test — đã có sẵn: `src/i18n/index.test.ts:81-92` (key parity vi↔en), không cần làm mới
- **2.7** (Lâu dài) Extract data content strings

### 7.3. Balance / stat system — từ deep-check

- **3.1** (P0) Evasion vs Accuracy lệch base — HỦY (asymmetry là design)
- **3.2** (P1) MP cost cho skill — ✅ done
- **3.3** (P1) Realm Pressure test coverage — ✅ done
- **3.4** (P2) Armor curve playtest — ✅ done (K theo realmIndex)
- **3.5** (P2) Stat cap Phàm Nhân quá chật — ⬜ chưa chốt
- **3.6** (P2) CDR cap 300% review — ⬜ hiện vô hại
- **3.7** (P2) Reaction damage late-game — ✅ done (full scaling)

### 7.4. Plans đã viết nhưng CHƯA execute

- **4.1** Skill Trigger/Action Engine Phase 2A — ✅ merged `a47d129`
- **4.2** Online-Required Local-Gameplay Foundation — ⬜ (13 tasks, cần Supabase local)
- **4.3** Adversarial QA infrastructure — ✅ skill có sẵn

### 7.5. Game design direction 2026-09-01

**6A. Combat Scene UI redesign** — ✅ merged `71357a1` (PlayerHudLayer in-canvas, 3 bar DOM xóa, kill/heal floating text). ✅ Kiếm Ý/Thế bar: wiring per-tick poll đã merge `6318083` (`kiemBarBridge.ts` + `pollKiemBar()` — QA-004/9.4 xong).

**6B. Bugfix hiển thị:**
- Crit Damage % — ✅ merged `8981772` + `0fcb17e`
- Unidentify Linh Thảo — HỦY (production rework sẽ đào thải)
- Hóa Luyện filter — ✅ merged `14cfda0` + `abc82be`

**6C. Chiêu Hiền Quán + hệ thống nhân công** — ✅ DONE — merged `84d28bb` 2026-09-02 (QA PASS WITH EVIDENCE; NaN clamp fix `0244031`; integration DOM oracle `a5bf969`)

**6D. Bảng ánh xạ phẩm ↔ cảnh giới** — ✅ item-grade rework Phase 1-4 merged `fd82ed4` + `3c898b0` + `3647cf7`; Phase 5-6 (equip gate, breakthrough unequip, panel tabs, theme, terminology) ✅ merged `a00de32`

**6E. Linh Mộc trong luyện đan** — ✅ XONG (branch eat/gp123-group3-talent, commits fe6c025+d2701d4+2b90e65, 2026-09-06): Mộc/Khoáng chuyển trục age 5 bậc thống nhất (decade..thuong_co — Thượng Cổ cho cả 3 loại), plain wood XÓA, save v57; nhiên liệu lò đan phải ĐÚNG realm + age với thảo (bỏ cheapest-first).

**6F. Cân bằng thu thập–tiêu thụ** — ✅ XONG (commit 0d44686 + 6b8a8f9): PRODUCTION_RATE_TABLE export + simulation 24h × 3 chuỗi (thảo/đan, gỗ/nhiên liệu, khoáng/phân giải) fixed-seed với falsifiable locks. 2 balance observations cho user: herb oversupply 855 vs 60 throughput; tinh hoa 2758 > ore 2046 (chưa tune — design decision).

**6G. Vendor redesign** — ✅ XONG (commit 2c5855c + e54a22a, 2026-09-06): XÓA quy đổi cảnh giới (Linh Thạch + Mộc/Khoáng — MaterialTierConversionBalance deleted); thu mua gate phẩm (chỉ bán material phẩm THẤP HƠN cảnh giới, reason grade_not_below); VendorPanel thu-mua-only, ẨN tab Cửa hàng (chờ 6H). ui-ux-pro-max chạy riêng khi mở lại Cửa hàng.

**6H. Roadmap tương lai** — ⬜ (tiền VIP, Shop VIP, chu kỳ sau Độ Kiếp)

### 7.6. Kỹ thuật nợ nhỏ

- Chunk size warning — ✅ code-split merged `af88cee` (entry 2231→848KB; build 2026-09-05 vẫn còn warning ở chunk phaser ESM ~1.3MB — known, không chặn)
- `_meta` block trong locale JSON — ⬜ (vẫn tồn tại ở cả vi/en, chưa dùng)
- `termGlossary` chưa được consume — ⬜ (verify 2026-09-05: chỉ test file tự import nó)
- Known flaky tests — ✅ XONG (2026-09-02, root-caused cả 3): `dongFuBuildingAssets` xóa test spawn ImageMagick `79bab1c`; `Playtest.continuousCombat` budget 30s `12e3677`; `CombatSystem.waterMitigation` seed Math.random (blockChance 0.05 unseeded — không phải load-flake) `59a71c8`. Full suite 2130/2130 deterministic.

### 7.7. Todolist thực thi — trạng thái

| Task | Mô tả | Trạng thái |
|---|---|---|
| **Giai đoạn 0** — Cứu work treo | audit-fixes + worktrees + stash | ✅ XONG |
| **Giai đoạn 1** — Dọn nhà | untracked docs, skills cleanup, MainMenu e2e | ✅ XONG |
| **Giai đoạn 2** — Game design nền tảng | crit%, unidentify, luyện filter, item-grade rework, combat UI | ✅ XONG |
| **Giai đoạn 3** — Skill engine | Phase 2A, floating text, unified buff | ✅ XONG |
| **Giai đoạn 4** — Sản xuất + kinh tế | i18n leftovers, Chiêu Hiền Quán, UI phân bổ, nhiên liệu, bảng tốc độ, simulation, vendor rework | 🟡 Chiêu Hiền Quán ✅ merged `84d28bb`; i18n leftovers phần lớn xong (xem 7.2 — 2.1/2.3/2.5/2.6 ✅, 2.4 obsolete, 2.2 còn ít file, xem QA report 2026-09-03-task-9-followups-i18n-quick.md); **6E/6F/6G → Group 3 gp123: worktree đã dọn 2026-09-05, code chưa commit đã hủy — re-apply/làm lại từ spec trong branch (xem 8.6)** |
| **Giai đoạn 5** — Balance | evasion, MP cost, armor, reaction, block | ✅ XONG |
| **Giai đoạn 6** — Pre-production | online foundation, VIP, prestige, code-split, QA | 🟡 Một phần |
| **Giai đoạn 7** — Item rework P5-6 | equip gate, breakthrough unequip, tabs, 10-rank theme, terminology, dọn legacy | ✅ XONG |
| **Giai đoạn 8** — UI/UX repair | CombatSceneOverlay styles, overlap guards, e2e layout smoke, dọn probe + UI review items | 🟡 Một phần lớn xong qua Slice 7 HUD rewrite (2026-09-05) — còn nameplate/emoji (Phase 2) |

### 7.8. Thứ tự đề xuất

1. ~~Merge `worktree-gp123`~~ — ✅ XONG `6318083` (0 conflict thật; 2 hunk resolve tay GameManager overflow toast + hudWiring test; save-version hiện hành v56 giữ nguyên — Group 3 mới bump v57).
2. **Action Playback** (Task 2/8 đang chạy ở `feat/action-playback`) — việc combat #1 ở bảng 9.5.
3. **Giai đoạn 8 còn lại** — nameplate/emoji (Phase 2).
4. **Bảng 9.5** — content/wiring turn-based còn lại theo thứ tự tiên quyết.
5. **Giai đoạn 6** — Pre-production: online foundation → VIP → prestige.

### 7.9. Các plan đã execute (thành quả chính)

| Plan | Kết quả |
|---|---|
| audit-fixes (15 tasks) | Save quota, notification, auto-dissolve, MainScene lifecycle, pagination — merged `6995cf9` |
| item-grade rework Phase 1-4 | 2 trục grade/quality, canUseItem gate, rèn/tẩy/tinh slot-level, Luyện Khí Tinh Hoa, tab Phân Giải — merged `fd82ed4` + `3c898b0` + `3647cf7` |
| item-grade rework Phase 5-6 | Equip gate, breakthrough unequip, 5 tab children, 10-rank theme, terminology sweep, dọn legacy — merged `a00de32` |
| Combat Scene UI redesign | PlayerHudLayer in-canvas, bỏ 3 bar DOM, kill/heal floating text — merged `71357a1` |
| Skill Trigger/Action Engine Phase 2A | 10 actions + 7 triggers — merged `a47d129` |
| Unified buff system | Buff icon rows, tooltip, status presets — merged `f63bd06` |
| Combat overlay layering repair | Styles khôi phục, overlap guards, e2e layout — merged `a5c2c03` |
| Balance pass | Armor K theo realm, block cap, reaction scaling, realm pressure tests — merged `47042ac` |
| Code-split | Entry 2231→848KB + phaser chunk riêng — merged `af88cee` |
| Turn-based combat rework (M1→Slice 7 + Fairness + Stat + Future Systems + Auto-farm) | Engine duy nhất + manual UI + party + auto-farm — xem mục 9 (toàn bộ slice 🟢) |

### 7.9.1. Battlefield Slot / shared CombatGridView — Part 1 of 4 XONG (2026-09-06)

| Plan | Kết quả |
|---|---|
| [Battlefield Slot / shared CombatGridView](../../docs/superpowers/plans/2026-09-06-battlefield-slot-shared-gridview.md) | CombatGridView dùng chung combat thật + panel Trận Pháp qua CombatGridViewHost interface; TranPhapCombatPreviewScene thay TranPhapPreviewScene (render qua đúng CombatGridView — animation-reset fix theo kiến trúc, không phải bản vá); SlotState vocabulary introduced (panel consumes today). Real combat zero behavior change (host fallback branch unreachable — CombatScene trả undefined, regression-tested). 6 tasks inline, 2760/2760 tests + type-check + build + targeted e2e pass. Part 2 (2.5D perspective panel — BLOCKING prerequisite này đã thỏa), Part 3 (wave spawn redesign), Part 4 (spawn VFX wiring) chưa bắt đầu. |

### 7.9.2. Battlefield Perspective Panel — Part 2 of 4 XONG (2026-09-06)

| Plan | Kết quả |
|---|---|
| [Battlefield Perspective Panel](../../docs/superpowers/plans/2026-09-06-battlefield-perspective-panel.md) | BattleGridProjection + edrawGridLines() giờ grid-size-agnostic (rows/columns/minRoadHeight parameterized, default giữ nguyên hành vi combat thật 10x16); cổng phòng thủ HERO_COLUMN obsolete XÓA khỏi grid rendering (turn-based không còn cơ chế này); panel Trận Pháp (TranPhapCombatPreviewScene) render 2.5D perspective 420x480 với 2 lớp nền sky/ground — sprite xa nhỏ hơn gần (depth scale hoạt động). Zero behavior change combat thật (default params parity + regression tests). 5 tasks inline, 2770/2770 tests + type-check + build + targeted e2e pass. Part 3 (wave spawn redesign) + Part 4 (spawn VFX wiring) chưa bắt đầu. |

### 7.9.3. Turn-Based Wave Redesign + Spawn VFX Wiring — Part 3+4 of 4 XONG (2026-09-07)

| Plan | Kết quả |
|---|---|
| [Turn-Based Wave Redesign + Spawn VFX Wiring](../../docs/superpowers/plans/2026-09-06-turn-based-wave-spawn-vfx.md) | Turn-based combat giờ spawn CẢ WAVE đồng loạt qua telegraph (`Stage.waves: number[]` authored cho cả 30 stages + `effectiveWaves()` mirror floor-10-solo-boss override; bất biến sum(waves)===totalEnemyCount có guard test). `TurnBattleSystem.tickPacing()` chạy wave-batch/pending-telegraph block mỗi 0.1s tick thật (không phụ thuộc gauge); spawn 1-con-một-lần trong `completeAction()` XÓA. Snapshot event mang `pendingEnemySpawns` (progress-based visual state) + `countdownProgress`; `CombatScene` tái dùng `EnemySpawnVfx.ts` qua `SpawnVfxSnapshot` (narrowed type, zero change legacy call site) cho wave telegraph + thêm `reconcileTurnCountdownSpawn()` riêng cho party countdown 3→2→1 (player + companion materialize cùng lúc). Hai wiring defect bắt được và fix trong verify: (1) emit snapshot phải chạy cả trong pha countdown (nếu không telegraph đếm số không bao giờ render — P13 class), (2) `reconcileSpawnVfx()` phải chạy TRƯỚC sprite reconcile như legacy pattern (nếu không mất fade-in materialize). Zero behavior change legacy engine (`BattleSystem.ts`/`StageWaveSystem.ts` không đụng). 8 tasks, 2807/2807 tests + type-check + build pass; e2e wiring check: create-to-combat + boot-fresh + save-reload + ink-wash pass; `combat-overlay-layout` + `turn-combat-hud` fail là baseline đã ghi nhận (mục 7.10). QA quick: `PASS WITH EVIDENCE` (`game/docs/qa/2026-09-07-turn-based-wave-spawn-vfx-quick.md`). Coverage gap: visual confirmation VFX telegraph trên canvas cần manual quan sát. Hoàn thành Part 3+4 của chuỗi 4 phần Hỗn Độn Trận follow-on (Parts 1-2 — Battlefield Slot/shared CombatGridView, 2.5D panel — đã ship riêng). |

### 7.10. Plans audit remediation — SYSTEM CODE REVIEW: TASKS 1–8 XONG (2026-09-05)

| Plan | Phạm vi | Trạng thái |
|---|---|---|
| [System code review remediation](../../docs/superpowers/plans/2026-09-05-system-code-review-remediation.md) | Action playback token/generation, idempotent presentation teardown, VFX completion, offline auto-farm cap, App/composable lifecycle, playback edge-case tests và typed test fixtures | 🟢 **Tasks 1–9 XONG**: Tasks 1–8 đã merge; Task 9 tách bundle check khỏi Vitest thành `game/scripts/check-bundle-split.mjs` + `check:bundle-split`, save-reload E2E seed `spirit_stone_ha_pham=12345` qua `addInitScript` và assert exact persistence. Full verify 2589/2589 + type-check/build; targeted E2E save-reload/boot-fresh/ink-wash 5/5 pass. Baseline combat E2E (`combat-overlay-layout`, `turn-combat-hud`) vẫn fail riêng vì combat result/presentation timing — deferred to UI/UX plan Task 13. QA Tasks 1–8: `PASS WITH EVIDENCE` (`game/docs/qa/2026-09-05-remediation-tasks-2-8-quick.md`). |
| [UI/UX and browser QA remediation](../../docs/superpowers/plans/2026-09-05-ui-ux-qa-remediation.md) | Accessibility/focus/dialogs, keyboard/touch, responsive container-fit layout, localization, reduced motion, combat HUD UX, error/recovery flows và Playwright matrix | 🟢 **Tasks 1-5, 8-13 XONG (2026-09-07)**: cả 2 baseline E2E defects root-caused và fix (CombatTopBar box-sizing 1px overflow; turn-combat-hud đổi sang event-bus runtime probe — trận có thể thua nhanh là gameplay thật không phải defect HUD); a11y fixes (focus-ring fallback, auth tabs semantics, dialog roles + focus trap, toast dismiss button, reduced-motion 4 surface); window.confirm/alert → in-game primitives; ErrorScreen truthful labels; battle log collapsible; specs mới a11y/reduced-motion/recovery + browser error gate. **Full e2e 15/15 pass** (baseline 9/16). Full verify 2809/2809 + type-check + build. **Còn lại:** Task 6 (locale sweep — parity test đã có, không reproduce missing-key warnings), Task 7 (container-fit refactor — phạm vi lớn, cần task riêng), WebKit/mobile device matrix (chờ decision). QA quick `PASS WITH EVIDENCE` (`game/docs/qa/2026-09-07-ui-ux-qa-remediation-quick.md`). |

**Thứ tự đề xuất:**

1. ~~Điều tra và khóa baseline failures trước: `GameManager.actionPlayback.test.ts:140`~~ — đã xác nhận flaky RNG pre-existing (stash-verified trên HEAD sạch), deterministic dodge test đã thêm trong Task 7; root fix RNG seed là follow-up riêng.
2. ~~Thực hiện các hạng mục P0/P1 của [system code review remediation](../../docs/superpowers/plans/2026-09-05-system-code-review-remediation.md)~~ — 🟢 Tasks 1–8 xong (Task 9 chờ approve).
3. ~~Thực hiện [UI/UX and browser QA remediation](../../docs/superpowers/plans/2026-09-05-ui-ux-qa-remediation.md), ưu tiên modal/focus, locked actions, responsive combat và Playwright diagnostics~~ — 🟢 Tasks 1-5, 8-13 xong 2026-09-07 (còn Task 6 locale sweep, Task 7 container-fit refactor — follow-up riêng).
4. Chỉ chuyển trạng thái sang 🟢 khi có focused tests, type-check/build, Vitest và browser evidence phù hợp; không coi static review là bằng chứng fix.

---

## 8. Giai đoạn 9 — QA Deep Lần 1 (2026-09-02) — ưu tiên sửa trước khi cộng dồn nợ

> Nguồn: `game/docs/qa/2026-09-02-full-project-deep.md` (verdict: FAIL, 1 Confirmed + 11 Suspected/Coverage gap + 9 optimize).
> Phạm vi: toàn project (7 domain pack).
> Nguyên tắc thực thi: TDD theo từng item; reproduction test viết trước, production fix viết sau, verify bằng `type-check` + vitest + build + e2e như AGENTS.md.

### 8.1. Bug fix từ QA deep — ưu tiên cao (theo verdict FAIL)

| Task | Mô tả | Trạng thái |
|---|---|---|
| **9.1** ✅ | **QA-001 (High, Confirmed) — Kẹt trang bị khi đột phá** | XONG 2026-09-02 (branch `worktree-task-9-1`, commits `f5248f4..3a8724a`, merged vào master). Thiết kế cuối (spec v6, user chốt lần 2 — xem note superseded ở 8.2): gộp 3 trigger → `triggerBreakthroughAction` auto-unequip + panel xác nhận "Độ kiếp cũng là độ thân..." cho MỌI đột phá. `chooseCultivationPath` không gate (feature-unlock sau đột phá). QA quick: PASS WITH EVIDENCE. 2 Low deferred: cooldown UX (QA-013), unequip-before-failed-start (QA-014). |
| **9.2** ✅ | QA-002 (High) — `restoreFromSave` thiếu idempotency guard | XONG 2026-09-02 (`c2381da`) — payload-identity guard (WeakMap) chống double offline credit; QA quick PASS WITH EVIDENCE |
| **9.3** ✅ | QA-003 (High) — `OverlayPanel` thiếu focus trap (H5 Giai đoạn 8) | XONG 2026-09-02 (`3dbde61` + test `cfb3b4b`) — useDialogFocus trong OverlayPanel+ConfirmModal, 13 consumers kế thừa; 2 Low deferred: zero-focusable Tab escape, same-tick re-open trigger overwrite |
| **9.4** ✅ | QA-004 (Medium) — `updateKiem` chưa được gọi từ production (defer lâu, sửa cùng 6A) | ✅ **MERGED 2026-09-05** (`6318083` — merge `worktree-gp123`): `kiemBarBridge.ts` (KIEM_BAR_READER_KEY) + CombatScene per-tick `pollKiemBar()` + guard registry + coverage trong `CombatScene.hudWiring.test.ts`. Đúng spec user chốt (poll, không event). |
| **9.5** ✅ | QA-005 (Medium) — `PhaserCanvas.vue setupGame` leak handler khi throw | XONG — qua perf-optimize-pass Task 4 (merged `8b59045`): try/catch bootstrap + `bootError` ref + cleanup on failure (verify grep `a390f93`: catch tại PhaserCanvas.vue:67, expose :244) |
| **9.6** ✅ | QA-006 (Medium) — `CombatDefeatPanel` thiếu 10s auto-return-home | ✅ **MERGED 2026-09-05** (`6318083`): `useAutoRetryCountdown(10, returnHome)` fallback song song 3s refight + `CombatDefeatPanel.test.ts` coverage. |
| **9.7** ✅ | QA-007 (Medium) — `OfflineProgressSystem` thiếu `isFinite(cultivationPerSecond)` guard | XONG 2026-09-02 (`d126008`) — isFinite guard; validator v55 là root guard |
| **9.8** ✅ | QA-008 (Medium) — `MaterialBag.add` overflow bị caller bỏ qua | ✅ **MERGED 2026-09-05** (`6318083`): surface overflow tại mọi reward caller + `bagOverflow.ts` notification + test `GameManager.overflowSurfacing.test.ts` + key locale `bag.overflow`. |
| **9.9** ✅ | QA-009 (Medium) — `useAutoRetryCountdown.start()` không clear handle cũ | ✅ **MERGED 2026-09-05** (`6318083`): `stop()` đầu `start()` + test. |
| **9.10** ✅ | QA-010 (Medium) — `EquipmentSlotManager.restore` thiếu slot-enum check (defense in depth) | ✅ **MERGED 2026-09-05** (`6318083`): skip entry lạ + test. |
| **9.11** ✅ | QA-011 (Low) — `LocalCloudSaveService` 2 key không atomic | ✅ **MERGED 2026-09-05** (`6318083`): revision-first write + rollback on failure + test. |
| **9.12** ✅ | QA-012 (Low) — `stateVersion` bump mỗi tick dù state không đổi (refactor) | **ĐÓNG BY-DESIGN** — perf-optimize-pass Task 5 (merged `b16c3d0`): dirty-check `setExternalModifiers` chặn recompute `finalStats` mỗi tick (phần tốn kém đã xong); `bumpState()` mỗi tick được giữ có chủ đích theo plan perf hướng (a) decouple — không làm thêm |

### 8.2. Spec chi tiết Task 9.1 — QA-001 panel chặn đột phá khi còn mặc trang bị

> **⚠️ SUPERSEDED (user chốt 2026-09-02, lần 2):** mục 3-4 dưới đây (chặn cứng, KHÔNG auto-tháo) đã bị đảo ngược lại. Quyết định cuối cùng: giữ theo code đã làm ở worktree `worktree-task-9-1` — hiện panel xác nhận "Độ kiếp cũng là độ thân..." (title/subtitle/i18n keys ở mục 3 vẫn đúng), người chơi bấm "Đã hiểu" → `triggerBreakthroughAction()` **tự `unequipAllEquipment()`** trước khi vào kiếp (không chặn cứng, không bắt người chơi tự vào Động Phủ tháo đồ). Áp dụng cho cả 2 đường đột phá (mục 2 vẫn đúng). Panel có 2 nút "Đã hiểu"/"Chờ đã" (không phải chỉ 1 nút đóng như mục 1 mô tả ban đầu). Xem plan `2026-09-02-task-9-1-breakthrough-confirm-panel.md` và mục 8.5 để biết trạng thái merge.

**Bối cảnh (spec gốc, đã superseded — giữ lại để tham khảo lịch sử quyết định):** Reproduction test `game/src/core/game/GameManager.realmAdvanceUnequip.test.ts` đã fail. Tuy nhiên, user 2026-09-02 chốt thiết kế mới: thay vì auto-unequip (Task 17 của item-grade rework P5-6), game sẽ **chặn hành động đột phá** + pop panel thông báo.

**Thiết kế hành vi mới:**

1. Khi người chơi bấm "Độ Kiếp" mà vẫn còn trang bị đang mặc:
    - Hành động đột phá bị **từ chối** (không thay đổi realmId, không chạy tribulation).
    - Pop một panel thông báo với nội dung:
      - **Tiêu đề:** "Độ kiếp cũng là độ thân, không gì có thể giúp được ngươi"
      - **Dòng phụ (màu đỏ):** "Không thể mặc trang bị khi độ kiếp"
    - Panel đóng khi người chơi bấm xác nhận (hoặc bấm ngoài — tuỳ theo primitive).

2. Áp dụng cho cả 2 đường đột phá:
    - `useTribulation.ts` (Độ Kiếp Trúc Cơ và các tầng cao hơn).
    - `GameManager.chooseCultivationPath` (Lễ Nhập Môn mortal → qi_refining).

3. **Quyết định user chốt (2026-09-02):**
    - Chặn **tại bước xác nhận** (không disable nút — người chơi phải bấm để được thông báo). Hành vi: bấm nút "Độ Kiếp" → core từ chối `{ ok: false, reason: 'still_equipped' }` → pop panel. Phù hợp với user feedback "phải thông báo cho người chơi".
    - KHÔNG có nút "Tự tháo" trong panel. Người chơi tự vào Động Phủ / trang bị để tháo rồi quay lại.
    - **Mọi string dùng i18n** (locale JSON, không hardcode). Tạo key mới:
      - `tribulation.stillEquipped.title` = "Độ kiếp cũng là độ thân, không gì có thể giúp được ngươi"
      - `tribulation.stillEquipped.subtitle` = "Không thể mặc trang bị khi độ kiếp"
      - `tribulation.stillEquipped.confirm` (nút đóng panel) — ví dụ: "Đã hiểu" / "Ta biết rồi"
    - Cả 2 locale `vi.json` và `en.json` đều phải có đủ 3 key.

4. **Đảo ngược spec cũ:** Việc tự `unequipAllEquipment()` trong `useTribulation.ts:164` là **sai thiết kế** theo quyết định mới. Cần:
    - Dỡ call site `useTribulation.ts:164`.
    - Giữ method `unequipAllEquipment()` (vẫn cần cho test P5-6 và cho trường hợp người chơi tự tháo).
    - Cập nhật doc/comment cũ (nhiều nơi) để phản ánh hành vi "chặn + panel" thay vì "auto-unequip".

5. **Trạng thái `chooseCultivationPath`:** Bản thân hàm này cũng không nên auto-unequip. Cần thêm guard "still_equipped" trước khi đổi realmId.

**Phụ thuộc chéo:**
- Tận dụng `OverlayPanel.vue` primitive (cần kết hợp với Task 9.3 focus trap — làm focus trap trước, dùng cho panel này luôn).
- i18n: text "Độ kiếp cũng là độ thân..." thuộc nhóm "story/lore", có thể hardcode trong data kit (giống `great_dao_seed` description) HOẶC vào locale JSON. **Cần user chốt.**
- Test: thêm test trong `useTribulation.test.ts` / `GameManager.cultivationPathRewards.test.ts` cho 2 đường (tribulation + Lễ Nhập Môn).

**Ước lượng:** ~1 session (TDD theo subagent-driven-development pattern đã dùng cho audit-fixes / item-grade rework).

### 8.3. Optimize (ưu tiên thấp — cộng dồn cuối roadmap)

| ID | File:line | Vấn đề | Gợi ý |
|---|---|---|---|
| **OPT-01** | `game/src/App.vue:360` | `bumpState()` mỗi tick | Tách `stateVersion` thành "bag/equipment" (manual) + "battle/world" (auto) |
| **OPT-02** | `game/src/services/save/SaveSystem.ts:575,583` | `structuredClone` + `JSON.stringify` = double serialize mỗi autosave | ✅ Điều tra xong ở worktree `worktree-perf-optimize-pass` (Task 3) — tiền đề audit sai, chỉ có 1 `JSON.stringify` thật (write-time), `structuredClone` là snapshot cần thiết chống race quest-state. Không sửa code, chỉ thêm test round-trip khoá hành vi. Coi như đóng. |
| **OPT-03** | `game/src/composables/useCadenceSmoothing.ts:56-68` | rAF loop không tự dừng | ✅ Xong — perf-optimize-pass Task 2 (`14a8235`), ĐÃ MERGE (`8b59045`) |
| **OPT-04** | `game/src/core/equipment/EquipmentBag.ts:129-135` | `getEquipped`/`getEquippedInSlot` O(N) |  ✅ **MERGED 318083 2026-09-05** — slot index O(1) getEquippedInSlot + test |
| **OPT-05** | `game/src/components/panels/EquipmentHallPanel/EnhanceTab.vue:63-111` | `enhanceRows` O(slots × 5) mỗi stateVersion bump | ✅ Đóng per gp123 spec v2 §2 (file spec hiện chỉ có trong branch `worktree-gp123`, chưa có trên master — không cần làm) |
| **OPT-06** | `game/src/services/save/SaveSystem.ts:661-668` | `loadGame` đọc+remove `IMPORT_HANDOFF_KEY` mỗi boot kể cả khi không import |  ✅ **MERGED 318083 2026-09-05** — removeItem dịch sau consume, chỉ chạm storage khi key tồn tại |
| **OPT-07** | `game/src/App.vue:285-287` | `drainNotifications()` chạy mỗi tick vô điều kiện | ✅ Xong — perf-optimize-pass Task 2 (`14a8235`, trả mảng rỗng dùng chung), ĐÃ MERGE (`8b59045`) |
| **OPT-08** | `game/src/components/game/PhaserCanvas.vue:120-136` | EventBus handler đăng ký trước async game create | Wrap try/catch + cleanup on failure (cũng liên quan 9.5) |
| **OPT-09** | `game/src/game/scenes/CombatScene.ts` | 11-entry `boundHandlers` array + 14 explicit `on()` | ✅ Xong 2026-09-02 — gộp thành 1 danh sách `getCombatEventBindings()` (22 entry), subscribe/unsubscribe cùng lặp 1 nguồn nên không thể lệch nhau; `unsubscribeCombatEvents()` idempotent (clear `eventBus`); test mới `CombatScene.eventSubscriptionSymmetry.test.ts` |

### 8.4. Thứ tự đề xuất

1. ~~Re-apply thủ công Group 1+2 gp123~~ — ✅ **XONG: merge trực tiếp `6318083` 2026-09-05, 0 conflict thật (2 hunk resolve tay), full verify 2621/2621 + type-check/build/E2E pass — nhanh hơn và an toàn hơn re-apply từng commit như dự kiến; rủi ro save-version ở mục 10.
2. **Group 3 gp123** (6E/6F/6G — spec+plan còn trong branch `worktree-gp123`, implementation chưa commit ĐÃ BỊ HỦY cùng worktree 2026-09-05) — làm lại từ spec trên branch mới từ master, bump save v57.
3. **Task 9.12** — đã đóng by-design (không làm thêm).
4. **OPT còn lại (OPT-01/OPT-08)** — cộng dồn cuối, làm theo đợt refactor.

### 8.5. Worktree đã merge — lịch sử (đóng, chỉ để tra cứu)

> Toàn bộ worktree dưới đây đã merge + dọn (trừ 2 worktree stale ở mục 8.6 chờ dọn). Không dùng bảng này để theo dõi việc đang chạy nữa.

| Worktree (branch) | Việc | Trạng thái thực tế |
|---|---|---|
| `.claude/worktrees/chi-hien-quan` (`worktree-chi-hien-quan`) | Task 6C — Chiêu Hiền Quán (building nhân công mới, công thức `1+level×2`, thay `spirit_spring`) | ✅ **ĐÃ MERGE vào master 2026-09-02** (`84d28bb`, 0 conflict; re-verify 2104/2104 + type-check + build + e2e 3/3). QA re-run **PASS WITH EVIDENCE** (`game/docs/qa/2026-09-02-chi-hien-quan-quick.md` — 2 gaps đóng: NaN clamp bug fix `0244031`, integration DOM oracle `a5bf969` thay browser probe treo). Worktree + branch đã dọn. |
| `.agent-worktrees/task-9-1-breakthrough-equip-panel` (`worktree-task-9-1`) | Task 9.1 — QA-001 panel xác nhận đột phá khi còn trang bị | ✅ **ĐÃ MERGE vào master 2026-09-02** — 6/6 task xong + spec/plan/QA report (`game/docs/qa/2026-09-02-task-9-1-breakthrough-confirm-panel-quick.md`, PASS WITH EVIDENCE). 2 Low deferred: cooldown UX (QA-013), unequip-before-failed-start (QA-014). |
| `.claude/worktrees/perf-optimize-pass` (`worktree-perf-optimize-pass`) | OPT-01..09 (mục 8.3) + tách file lớn | ✅ **ĐÃ MERGE 10/10 tasks vào master** (`8b59045`) + flake root-cause fix (`79bab1c`). OPT-02 đóng (audit sai tiền đề — không cần sửa code), OPT-03/07 xong (Task 2 `14a8235`), OPT-08/09/01 xong qua các task 4-10. BattleSystem/CombatScene/EquipmentSystem tách file + manualChunks đã ship. Worktree đã dọn. |
| `.agent-worktrees/task-9-followups-i18n` (`worktree-task-9-followups-i18n`) | Task 9.2/9.3/9.7 + T4.1 i18n leftovers (vue-i18n v11, 2.2 batches 1+2, 2.3, 2.5) | ✅ **ĐÃ MERGE vào master 2026-09-03** (`2910247`). QA quick **PASS WITH EVIDENCE** (`game/docs/qa/2026-09-03-task-9-followups-i18n-quick.md`). Worktree đã dọn. |
| `.agent-worktrees/deferred-cleanup-followups` (`worktree-deferred-cleanup`) | 5 deferred follow-ups: useDialogFocus edges (`8ccf350`), CombatExitConfirmModal focus trap (`659c0b3`), i18n 2.2 final batch FunctionOverlayPanel/useBagFilter (`912b1f3`), StageSelect numeric + en Form (`db9b5ac`) | ✅ Hoàn tất 5/5 + docs sync (task 5). Full verify matrix xanh: 2172/2172 unit tests (336 files), type-check, build, e2e 9/9. QA quick **PASS WITH EVIDENCE** (`game/docs/qa/2026-09-03-deferred-cleanup-quick.md`). |
| `.claude/worktrees/phap-tu-thuan-he` (`worktree-phap-tu-thuan-he`) | Pháp Tu Thuần Hệ — 20 skill chuỗi B–E + 5 ult per-element + node tree 17 node/hành + 8 engine ext (E-1..E-8) + glue chain/ult + tooltip cơ chế (plan `2026-09-03-phap-tu-thuan-he.md`, spec `newPhapTuDesignSpec.md` §0.b) | ✅ **ĐÃ MERGE vào master 2026-09-03** (fast-forward `fe49848→08ed91b`, 21 commits, 0 conflict; re-verify sau merge: type-check + full suite 2318/2318 + build). QA quick **PASS WITH GAPS** (`game/docs/qa/2026-09-03-phap-tu-thuan-he-task12-quick.md` + rerun độc lập `...-quick.md`). Gap duy nhất (thiếu nút ult thủ công trong `PhapTuCombatHud.vue`) user DEFER thành plan **Task 14** — nút ult manual + panel AI "khi nào dùng ult" cạnh AI target. |

### 8.6. Worktree/branch đang bay (2026-09-05) — THEO DÕI TẠI ĐÂY, không phải 8.5

| Worktree (branch, fork-point) | Việc | Trạng thái thực tế (verify 2026-09-05) |
|---|---|---|
| `worktree-gp123` (branch giữ lại, **worktree đã dọn 2026-09-05**) | gp123 spec v2 + plan Groups 1-3: Group 1 (9.4/9.6/9.8/9.9/9.10/9.11) + Group 2 (OPT-04/06) + Group 3 (6E age-axis migration/6F/6G) | 🟢 **Group 1+2 ĐÃ MERGE 318083 2026-09-05** — đánh giá lại trước merge: verify từng fix (9.4/9.6/9.8/9.9/9.10/9.11 + OPT-04/06) đều còn thiếu trên master, merge-tree lúc đầu báo 0 conflict nhưng master tiến tiếp sinh 2 hunk thật — resolve tay xong, full verify 2621/2621 + type-check/build/E2E pass. Group 3 (6E/6F/6G) code uncommitted đã hủy — làm lại từ spec (docs đã có trên master qua merge); save v57 do Group 3 mới bump (master v56) |
| `.agent-worktrees/action-playback` (`feat/action-playback`, fork `887701c` = master tip) | Action Playback plan 8 task (việc combat #1, bảng 9.5) | 🟡 **Task 2/8 đã commit** (`40868dc`: `TurnSkillDefinition.presetId` + `TurnBattle.queuedFollowUpActorId`); worktree sạch — đang thực thi |
| `.agent-worktrees/slice7-hud-completion` (`feat/slice7-hud-completion` @ `bd69e0d`) | Slice 7 master plan Tasks 3-10 (HUD rewrite) | ✅ Đã merge qua `70cb22e` — **worktree stale, chờ dọn** |
| `.agent-worktrees/talent-v4-m1` (`worktree-talent-v4-m1` @ `8dde70c`) | Talent v4 M1 | ✅ Đã merge qua `660034d` — **worktree stale, chờ dọn** |

### 8.7. Liên kết QA artifacts

- Báo cáo chính: `game/docs/qa/2026-09-02-full-project-deep.md`
- Reproduction test QA-001: `game/src/core/game/GameManager.realmAdvanceUnequip.test.ts`
- Exploration reports (subagent): `game/docs/qa/2026-09-02-{combat-tribulation,economy-progression,save-cloud}-*.md`
- Learned-defect entry: `QA-2026-09-02-001` trong `game/docs/qa/learned-defects.md`

---

## 9. Rework combat real-time → turn-based (ATB) — CƠ CHẾ XONG, CÒN CONTENT/WIRING

> **Gộp từ `turn-based-combat-roadmap.md` ngày 2026-09-05** — file cũ giờ chỉ là con trỏ về mục này. Toàn bộ quyết định/slice/spec/plan dưới đây được giữ nguyên ý.
> Tài liệu gốc: [2026-09-03-turn-based-combat-design.md](../../docs/superpowers/specs/2026-09-03-turn-based-combat-design.md) (spec thiết kế đã duyệt) + [2026-09-04-turn-based-combat-survey-and-stat-decisions.md](../../docs/superpowers/specs/2026-09-04-turn-based-combat-survey-and-stat-decisions.md) (khảo sát hệ thống thật + sửa sai lệch + quyết định Stat).
> Mỗi hạng mục khi đến lượt làm: khảo sát codebase hiện tại → brainstorm/chốt với người dùng → viết plan riêng (`docs/superpowers/plans/...`) → cập nhật dòng trạng thái ở đây kèm link plan. KHÔNG gộp nhiều hệ thống vào một plan (quyết định người dùng, 2026-09-04).
> Khi plan chi tiết và mục này lệch nhau, plan chi tiết là nguồn sự thật.

### 9.1. Nguyên tắc (giữ nguyên từ rework)

- Dev phase — big-bang, không giữ tương thích ngược save.
- Sản xuất/tu luyện (idle) **không đổi** — rework thuần combat.
- Combat không bao giờ mô phỏng offline; "Auto" là chính engine turn-based chạy nhanh hơn, không phải công thức riêng.
- Hệ nhân vật phụ (party/companion) **ngoài phạm vi** rework — engine `players[]` đã xong, recruit/UI/content là spec riêng sau (việc #8, bảng 9.5).

### 9.2. Milestone 1 — Foundation (primitives độc lập) ✅

Dựng các primitive thuần (pure function), test riêng, KHÔNG đụng `BattleSystem.ts`/`CombatSystem.ts` cũ.

| Hạng mục | Plan | Trạng thái |
|---|---|---|
| ActionGauge, TurnQueue, ChannelQueue, AoeShape*, BounceChain, TrueShot, BossTurnTriggers, MomentumBreak, ResourceTurnHook — 9 file mới dưới `game/src/core/battle/turn/` | [2026-09-03-turn-based-combat-foundation.md](../../docs/superpowers/plans/2026-09-03-turn-based-combat-foundation.md) | 🟢 Xong, merge master 2026-09-04 (`aee253b`; 50/50 test turn/ suite; QA [report](qa/2026-09-04-turn-combat-foundation-quick.md) PASS WITH EVIDENCE). ⚠️ `MomentumBreak.ts` sau đó bị **bỏ khỏi design** (Slice 4) nhưng file+tests vẫn tồn tại, 0 consumer — dọn ở việc #14, bảng 9.5 |

### 9.3. Milestone 2 — BattleSystem Replacement ✅ (trọng tâm duy nhất từ 2026-09-04, không tách milestone con)

**Quyết định người dùng 2026-09-04**: không tách "Core System Conversion" thành milestone riêng — mọi hệ làm CHUNG một đợt lớn xoay quanh việc thay `BattleSystem.update(deltaSeconds)`. Mỗi hệ vẫn plan riêng khi đến lượt, nhưng trọng tâm là chính BattleSystem Replacement.

| Slice | Nội dung (tóm tắt — chi tiết xem spec/plan link) | Trạng thái |
|---|---|---|
| Slice 1 — Core Turn Loop | `TurnBattleSystem` headless: 1 player vs N enemy, ATB + targeting gần-nhất-trước-mặt + basic attack qua `CombatSystem.resolveActionHit` | 🟢 Xong 2026-09-04 (`72eec64`; turn/ 63/63; QA PASS WITH EVIDENCE) |
| Slice 2 — 3-Skill Action Model | **THAY hẳn loadout 6-slot**: mọi combatant đúng 3 skill role (`basic`/`special`/`ultimate`, cooldown-lượt + resource-gate); Pháp Tu Thuần map vào chuỗi 1-hành; `resolveNextStep()` step-oriented | 🟢 Xong 2026-09-04 (`e3ade36`; turn/ 131/131; QA PASS WITH EVIDENCE) |
| Slice 3 — Buff/CC Wiring + Zone-as-dot | `TurnBuffPool`/holder + `appliesBuff`; CC block; zone-as-dot thay Lava/Sword Zone (không `TurnHazardZoneSystem`) | 🟢 Xong 2026-09-04 (branch slice345; turn/ 138/138; QA PASS WITH EVIDENCE — CC check TRƯỚC buff tick) |
| Slice 4 — Resource/Boss Triggers | `ResourceTurnHook` + `BossTurnTriggers` (turn-count, single-fire); **BỎ HẲN MomentumBreak** — boss chỉ là quái + buff | 🟢 Xong 2026-09-04 (turn/ 151/151; QA PASS WITH EVIDENCE) |
| Slice 5 — Wave/Stage | `wave{total,spawned}` + `spawnEnemy` factory; spawn ngay khi sân trống; thắng = `isStageComplete()` | 🟢 Xong 2026-09-04 (turn/ 161/161; QA PASS WITH EVIDENCE) |
| Slice 6 — GameManager Cutover | **FLIP THẬT**: thay `startBattle`/`startStage`/`updateBattleFixedStep`/`getBattle`, retire 27-28 file test real-time thành stub RETIRED; unified flow Countdown→Spawn→Gauge→Wave→Result; Bạt Kiếm Thuật channel mất tạm lúc flip | 🟢 Xong 2026-09-04 (`3982621`) |
| Slice 7 — Manual UI | `peekNextActor()` + `resolveActorTurn()`; `TurnCombatSkillBar` 3 nút + toggle Thủ công/Tự động (persist `ui.combatInputMode`); turn-order preview (`peekUpcomingActors` + `TurnOrderStrip`) + battle log (`BattleLogPanel`); HUD rewrite + gỡ legacy (master plan Tasks 3-10, `bd69e0d`) | 🟢 Xong 2026-09-04/05 (`70cb22e`; turn/ 199/199; QA PASS WITH EVIDENCE) |
| AOE Shape extension | `'cross'`/`'row'`/`'column'`, `'area'`→`'square'` | 🟢 Xong (`35c958f`; 2408/2408; QA PASS WITH EVIDENCE) |
| BuffSystem turn-duration | `TurnBuffSystem.ts` mới (port verbatim, giây→lượt) + port nốt 4 method (`getActiveModifiers`/`isRooted`/`rollOnHitEffects`/`getStacks`) | 🟢 Xong (`8545866` + Completion Task 3/4: stats recompute `TurnStatsRecompute.ts`) |
| Buff content migrate | Converter `toTurnBuffDefinition()` + `TURN_BUFF_REGISTRY` (46 buff) | 🟡 Converter xong + **registry wiring xong** (2026-09-06/07, GameManager.ts cả 2 constructor site) — dòng "0 consumer" cũ đã lỗi thời; còn thiếu content 3 nguồn (Tribulation/boss enrage, equipment — tạo mới, thiên phú) → mục 0 Phase A2 |
| Buff turn-count policy | Giữ nguyên số (X giây → X lượt) | 🟢 Đã chốt policy |
| Buff presentation theo lượt | Tooltip/VFX duration | 🔴 Chưa — chờ UI buff turn thật → việc #7 |
| ReactionManager conversion | Event-triggered sẵn; `spawnLavaZone` → dot buff; **turn engine CHƯA gọi ReactionManager/SkillEffectSystem** (không có call site để swap) | 🔴 Chưa wire → việc #2 (definitions `dung_nham_burn`/`kiem_tran_burn` đã sẵn) |
| HazardZoneSystem | **ĐẢO NGƯỢC: KHÔNG xây `TurnHazardZoneSystem`** — zone = DoT qua AOE + buff | 🟢 Đã quyết định (không có gì để build) |
| Stat System conversion | 5 main stat fit nguyên; `speed = 100 + dexterity×0.15` (HSR-SPD); bỏ `cooldownReduction`/`castSpeedPercent`/`movementSpeed`; `hpRegenPerSecond`→`hpRegenPerTurn` (giữ số); ~76 file qua compiler-navigated fixup | 🟢 Xong (`a0ca18b`+`b1251ed`; 2522/2523; QA PASS WITH EVIDENCE — gỡ blocker Slice 6) |
| Manual tap-to-cast UI | Khảo sát `CombatSkillSlot` tái dùng được; `buildTurnSkillPresentation()` union turn-based; skill name/icon gap (TurnSkillDefinition không phải Skill sống) | 🟢 Engine+UI xong; **display metadata gap** → việc #5 |
| StageWaveSystem turn conversion | `WaveSpawnTrigger.ts` (bỏ `spawnCountdown`/`spawnIntervalSeconds` — spawn ngay khi sân trống) | 🟢 Xong (`90f9cf5`; turn/ 100/100; QA PASS WITH EVIDENCE) |
| Rewrite `BattleSystem.*.test.ts` | 27 file → stub RETIRED (phân loại migrated/dropped-by-design/chờ-content) | 🟢 Xong (Completion Task 9, `3982621`) |
| GameManager external contract | Khảo sát driver/call site/UI read-only | 🟢 Khảo sát xong (không tách standalone — chính là Slice 6) |
| Legacy real-time engine | **KHÔNG xóa** — `git mv` vào `battle/legacy/` (BattleSystem/HazardZoneSystem/UltimateSystem/LavaZone/SwordZone + tests pin), giữ history; BuffSystem/SkillEffectSystem/ReactionManager/BattleLootSystem… vẫn sống vì đang chạy | 🟢 Xong 2026-09-05 (`e928a44`): type-check 0, 2506/2506, build pass, e2e 10/10. **Xóa hẳn** → việc #9 (chờ #2+#6) |
| Gameplay fixes (pacing/refight/pill) | 1 pacing tick = 1 gauge-step (không còn 1 tick = 1 turn); enemy speed ×100 khớp thang player; reset per-battle flags ở `startStage`; bỏ Pill `hpRegenPerTurn` (user request) | 🟢 Xong 2026-09-05 (`2ef3be6`; QA PASS WITH EVIDENCE) |

### 9.4. Quyết định design lớn đã chốt (giữ làm hồ sơ — không mở lại nếu không có yêu cầu mới)

- **Combat Fairness Guards** ✅ (`4356858`): **Bá Thể** (dính hard-CC 3 lượt liên tiếp → clear CC + miễn nhiễm 1 lượt, qua `consecutiveHardCcTurns` + `clearCcEffects()`, không buff mới) + **Sudden Death** (từ lượt 11: dmg +30%/lượt cộng dồn, heal/khiên −30%/lượt; damage-side xong, heal-side chờ cơ chế heal — plan ghi Not Covered).
- **Party engine** ✅ (2026-09-04, cùng merge Future Systems): `TurnBattle.player` → `players[]`, chung ATB queue, thua khi toàn party chết; Slice 7 UI party support (pause mọi member, party status row). Recruit/UI/companion content → việc #8.
- **Pháp Tu Reaction Path** ✅ cơ chế (cùng merge): bỏ book/AI — `special` cast 2 hành random khác nhau (Fisher-Yates-2), `ultimate` self-buff `reaction_empowerment` 4 lượt +25% (functionally-inert chờ reaction cutover → việc #12); unlock qua keystone node `reaction_path_unlock_<el>`.
- **Node Tree 3-skill** ✅ (cùng merge): `CHAIN_SKILL_IDS` 5→3 (giữ A/C/E); 9 node/hành + keystone Reaction/Pure; 6 cadence node → speed flat (đúng ngữ nghĩa speed=100 sau conversion). Tổng 121→106 node.
- **Channel skill (Bạt Kiếm Thuật)** ✅ cơ chế (cùng merge): Kiếm Tu `basic` (`tram` = "Trảm", giữ nguyên); Bạt Kiếm Thuật là 1 skill `special` duy nhất, primitive `chargingTurnsRemaining` (3 lượt, multiplier 3, cooldown 5 authored), tách biệt counter Bá Thể.
- **Gauge-delta buff effect** ✅ (cùng merge): `gaugeDelta` one-shot lúc áp buff (deferred targets — sau `consumeGaugeAfterAction`), clamp `[0, GAUGE_MAX]`.
- **Auto-farm Hoàn Mỹ** ✅ 7/7 (2026-09-04): 3 cơ chế auto riêng biệt (vượt ải `progress` + repeat + perfect_farm — giữ nguyên 2 cũ); Hoàn Mỹ = `teamHpLossPercent ≤ 75 && turns < stage.perfectClearTurnLimit`; farm = nửa thời gian, không trận thật, DUY NHẤT được reward offline; save v56. ⚠️ **0/30 stage có `perfectClearTurnLimit`** → chip disabled trong UI thật → việc #4.
- **Battle-speed x1/x2/x4**: 🟢 HỦY hẳn (thay bằng 3 cơ chế auto trên).
- **`CombatAiStrategy`** (nearest/boss_first/…): 🟢 CHẤP NHẬN MẤT — cố định "gần nhất-trước-mặt".
- **Boss Phase System** (HP-threshold/archetypeOverride/summon của `TribulationPhase.ts`): 🟢 KHÔNG xây — boss = quái + buff thiết kế thủ công.
- **Không có CC diminishing-returns riêng**: đã bao bởi Bá Thể.
- **Turn-order preview + battle log**: ✅ xong (Slice 7 mở rộng).
- **Multi-target death-mid-resolution**: ✅ XONG (`d22ed4e` + `TurnBattleSystem.ts:324/432/443` skip target đã chết) — đóng gap Deep Review §3.
- **Enemy `speed` content**: ✅ XONG — không cần author tay: `EnemyStatInput.ts` tự suy `speed = normalizeEnemyAttackSpeed(attackSpeed) × 100` (+ `speedMultiplier`), khớp thang player (80–250, xem gameplay-fixes).
- **Action Playback layer**: spec+plan 8 task xong 2026-09-05 ([design](../../docs/superpowers/specs/2026-09-05-turn-combat-action-playback-design.md) + [plan](../../docs/superpowers/plans/2026-09-05-turn-combat-action-playback.md)) — state machine 5 pha/actor, damage áp lúc VFX land, `presentationActive` flag (test cũ không cần sửa), + effect-kind `reactiveTrigger` (chỉ cơ chế). 🟡 **Task 2/8 đang chạy** ở `feat/action-playback` → việc #1.

### 9.5. VIỆC CÒN LẠI — turn-based (re-verify bằng code 2026-09-05, sắp theo tiên quyết)

| # | Việc | Loại | Trạng thái 2026-09-05 |
|---|---|---|---|
| ~~1~~ | **Action playback + VFX** - damage luc VFX land, engine cho presentation xong moi qua actor ke ([plan](../../docs/superpowers/plans/2026-09-05-turn-combat-action-playback.md) + [defect-fix batch](../../docs/superpowers/plans/2026-09-05-turn-combat-defect-fixes.md)) | Engine split + Phaser wiring | ~~○~~ 🟢 **XONG (2026-09-05, 8/8 Action Playback + 8/8 Defect-fix, branch feat/turn-defect-fixes)**: resolveActorTurn split 3 phase; PresentationGate boot-race fix (tran dau khong headless-resolve nua); follow-up queue FIFO + reciprocity cap hoat dong trong tickPacing; CC-counter khong cong trong charge; duplicate HUD da go (TurnCombatSkillBar la sole surface); 2541/2541 pass |
| 2 | **Wire ReactionManager/SkillEffectSystem vào TurnBattleSystem** — reaction thật kích trong turn combat | Engine wiring lớn (spec riêng) | 🔴 Chưa — `turn/` zero reference tới 2 system này; cần thiết kế skill content thật trước |
| 3 | **Skill content thật**: special/ultimate các build + `Enemy.specialAttacks[]` → `TurnSkillDefinition` | Content data | 🟡 Basic 8 build xong (`TurnBasicAttacks.ts`); special/ultimate chỉ Kiếm Tu (`BAT_KIEM_THUAT` qua `SPECIALS_BY_BUILD`); `specialAttacks[]` mới 1 enemy dùng (`water_surge` boss) |
| 4 | **perfectClearTurnLimit cho stage content** — chip perfect_farm đang disabled | Content data (1 field/stage) | 🔴 **0/30 stage** có field (type + record + UI đã sẵn) |
| 5 | ~~**Skill name/icon/tooltip trong HUD turn** — mapping id → display metadata~~ | Content mapping nhỏ | ✅ **XONG (2026-09-07, trực tiếp trên master)**: `TurnSkillDisplayMeta.ts` mapping skillId → name/description (id trùng SKILLS đồng bộ tự động, id authored author riêng, sweep test guard 11 id); `TurnSkillPresentationEntry` thêm skillName/skillDescription optional; `TurnCombatSkillBar` truyền display-label + tooltip-override; fallback nhãn role khi id lạ. Icon PNG riêng chờ art (SlotView monogram fallback hiện có). 2809/2809 + type-check + build + e2e create-to-combat; QA quick PASS WITH EVIDENCE (`qa/2026-09-07-turn-skill-display-meta-quick.md`) |
| 6 | **Buff content cho TribulationPhase/boss enrage, equipment (mới), talent passive** | Content (wiring đã xong) | 🟡 Converter + registry 46 buff + **wiring GameManager→TurnBattleSystem đã xong (2026-09-06/07, cả 2 constructor site)**. Còn thiếu content 3 nguồn: TribulationPhase/BossEnrage vẫn kiểu `BuffDefinition` cũ (`TurnBossTrigger` có cơ chế, chưa gán data); equipment Affix không có field buff (tạo mới, không phải migrate); talent `passiveConvertsTo` đối chiếu registry cũ. Xem mục 0 Phase A2. |
| 7 | **Buff duration presentation theo lượt** (tooltip/VFX) | UI nhỏ | 🔴 Chờ #6 |
| 8 | **Party recruit/UI/companion content** (engine `players[]` đã xong) | Feature lớn — spec riêng | 🔴 Chưa lên lịch |
| 9 | **Xoá `battle/legacy/`** + gỡ shim GameManager/StageWaveSystem (checklist trong `legacy/README.md`) | Cleanup — spec riêng | 🔴 Chờ #2 + #6 |
| 10 | ~~Multi-target death-mid-resolution hardening~~ | — | ✅ **XONG** (`d22ed4e`) — gạch khỏi danh sách việc |
| 11 | **Boss enrage/tribulation content** bằng buff thủ công (KHÔNG phase-system) | Content | 🔴 Chờ #6 |
| 12 | **Pháp Tu Reaction Path content thật** (pool element skills + ultimate % buff) | Content | 🟡 Cơ chế xong, `reaction_empowerment` inert — số liệu để implement-time |
| 13 | **hpRegenPerTurn** — pills đã bỏ (user request 2026-09-05); techniques/equipment/realm vẫn có stat, engine đã wire (`TurnBattleSystem.ts:361-362`) | Quyết định design | 🟡 **Cần user chốt: giữ stat chung (đã chạy) hay bỏ hẳn** (mục 10) |
| 14 | ~~**Xóa `MomentumBreak.ts` dead code** (+ 2 test files) — mechanic đã bỏ ở Slice 4~~ | Cleanup nhỏ | ✅ **XONG (2026-09-07, merge `fc16dfa`)**: xóa module + 2 test riêng, dọn comment `TurnQueue`; type-check + turn/ 235 tests pass trên master sau merge; [QA quick](./qa/2026-09-05-momentum-break-cleanup-quick.md) PASS WITH EVIDENCE |

### 9.6. Rủi ro liên-plan đã đóng (hồ sơ)

- Conflict Kiếm Tu basic-slot (Completion Task 5 vs Future Systems Task 8): sửa 2 lần, chốt cuối `67de5db` — `tram` = "Trảm", giữ nguyên basic; Bạt Kiếm Thuật = 1 skill `special` charge (xem 9.4).
- Gap "Slice 7 UI xây trước Party": thêm Task 10 vào Future Systems plan (chạy cùng phiên Task 9) — đã merge.
- Placeholder cần 1 lượt tune sau khi cơ chế chạy: Reaction Path ultimate %/số lượt; Bạt Kiếm Thuật `chargeTurns` + hệ số (đối chiếu `BattleSystem.batKiem.test.ts` legacy trước khi bịa số); 3 skill/hành của Node Tree (quyết định lúc thực thi, ghi commit message).

### 9.7. Combat Art Pipeline rework — Part A SHIPPED (2026-09-05, verify 2026-09-06)

Plan: [`2026-09-05-combat-art-roster-tranphap.md`](../../docs/superpowers/plans/2026-09-05-combat-art-roster-tranphap.md) · Spec: [`2026-09-05-combat-art-pipeline-rework-design.md`](../../docs/superpowers/specs/2026-09-05-combat-art-pipeline-rework-design.md).

Part A (Tasks 1–9.5, 22 commits) 🟢 **XONG** — verify Task 9.9 (2026-09-06):

- Battlefield: 2 hộp 6×6 trái/phải (cột 6 là dải phân cách), enemy spawn giới hạn trong hộp địch, boss spawn đúng tâm hộp + luôn đấu solo (1 enemy/stage boss).
- Player spawn theo formation data (không còn hardcode).
- **Fix cốt lõi:** combat art render live trở lại qua event `turn_battle_entity_snapshot` (bắn mỗi fixed step) thay bridge `positions` đã chết của engine real-time cũ.
- Skill UI dời vào dock mép phải (`CombatSkillDockPanel.vue`); Phaser projection chừa chỗ cho dock.
- Sprite-sheet animation thật (idle/ready/cast/standby/death) qua Phaser AnimationManager — hiện là placeholder 1-frame, chờ content drop thật; death chờ animation xong mới remove sprite.
- Boss render ×2 kích thước quái thường (×4 nguồn art).

**Gate tự động (2026-09-06):**
- `npm run type-check` — sạch (vue-tsc --build, 0 lỗi).
- `npx vitest run` — **413 file / 2651 test PASS**, khớp baseline.
- `npx playwright test` (7 spec, 10 test) — **4 pass / 6 fail**. 3/6 fail (`combat-overlay-layout.spec.ts` cả 3 viewport) là `.combat-skill-dock-panel` không kịp mount trong 5s khi 6 spec chạy song song (nghi ngờ CPU contention — chạy đơn lẻ dock mount ngay lập tức, xem defect bên dưới). **3/6 fail còn lại là defect thật, không phải flake.**

**🔴 DEFECT THẬT PHÁT HIỆN KHI PLAYTEST (chưa fix — theo đúng chỉ thị Task 9.9, không tự sửa):**

Trận đấu **treo vĩnh viễn ở màn hình đếm ngược "Xuất Trận!"**, không bao giờ chuyển sang `state: 'fighting'`, khi chạy qua **browser thật với wall-clock timer thật** (Playwright headed/headless Chromium) — dù `npx vitest run` (headless, gọi thẳng `BattleSystem`/`TurnBattleSystem`, không qua vòng lặp `setInterval` thật của `App.vue`) vẫn xanh 100%. Verify độc lập 2 lần: (1) `npx playwright test` chính thức — `create-to-combat.spec.ts`, `save-reload.spec.ts`, `turn-combat-hud.spec.ts` đều timeout (120–210s) chờ `.combat-victory-panel`/`.combat-defeat-panel`; (2) script Playwright thủ công riêng (1 instance, không chạy song song) — treo y hệt ở "Xuất Trận!" sau 30s+ theo dõi, không có exception nào trong console.

Nghi vấn cao nhất: `PresentationGate` (Defect Task 3, `src/core/battle/turn/PresentationGate.ts`) + wiring `setPresentationActive(true)` từ `CombatScene.subscribeCombatEvents()` (`src/game/scenes/CombatScene.ts:1415`, gọi qua optional-chaining `this.gameManagerRef?.setPresentationActive(true)` — nếu `registry.get('gameManager')` sai key/undefined thì no-op ÊM, không throw). Nếu `markReady()` không bao giờ chạy, `GameManager.updateBattleFixedStep()` (dòng ~3585) mãi mãi không gọi `tickCountdown()` vì `presentationGate.isBlocking()` luôn true — safety-net 15s (tính từ `expectPresentationLayer()` gọi ở **module-scope App.vue lúc page load**, KHÔNG phải lúc battle start) lẽ ra phải trôi qua nhưng thực tế không thấy trận nhúc nhích sau 30–50s kể từ page load. Cần điều tra thêm bằng cách nào `setPresentationActive(true)` thực sự có chạy hay không (thêm log tạm/breakpoint) — **chưa xác định được root cause chính xác, chỉ xác định được TRIỆU CHỨNG và khu vực nghi vấn**.

Hệ quả: **không thể playtest trực quan** phần lớn nội dung Task 9.9 yêu cầu (sprite sống động giữa trận, boss to gấp đôi, 3 concern layout dock/TopBar/BattleLogPanel/TurnOrderStrip khi đang fighting) — chỉ chụp được màn hình đếm ngược đứng yên. 3 câu hỏi layout (dock che TopBar counter phải / che BattleLogPanel / TurnOrderStrip đè lên dock) được xác nhận **bằng đọc code CSS** (không phải bằng mắt lúc fighting): cả 3 đều **CÓ xảy ra** theo cấu trúc `position/z-index` hiện tại (`CombatSkillDockPanel.vue` `top:0/right:0/bottom:0/z-index:12` che `.combat-top-bar` phần bên phải + `BattleLogPanel.vue` (`right:8px/bottom:8px`, không z-index → nằm dưới dock theo stacking); `TurnOrderStrip` (`top:60px`, full-width, cùng z-index:12, DOM sau dock) đè lên phần trên của dock).

Screenshots: `.superpowers/sdd/2026-09-05-combat-art-roster-tranphap/screenshots/` (không commit — scratch, git-ignored).

**Chưa bắt đầu (tại thời điểm viết mục 9.7):** Part B (`COMPANIONS` — companion roster) và Part C (`TRAN_PHAP_FORMATIONS`) của plan — theo đúng phạm vi Task 9.9 (chỉ verify Part A).

### 9.8. Defect treo "Xuất Trận!" (mục 9.7 trên) — ĐÃ FIX (2026-09-06), Part B SHIPPED

**Root cause thật** (khác giả thuyết `PresentationGate` ở 9.7 — điều tra sâu hơn tìm ra nguyên nhân khác): `App.vue` định nghĩa `startTickLoop()` nhưng **không có nơi nào gọi nó** — refactor `useAppLifecycle.ts` (commit `d6d9a1d`, "lifecycle idempotence") đã làm rớt lời gọi này khi extract boot logic. `App.vue`'s `tick()` là nơi DUY NHẤT gọi `GameManager.update()` ngoài test, nên toàn bộ simulation (combat/tu luyện/idle/sản xuất) đứng hình vô thời hạn, zero console error. **Có sẵn trên `master`, không phải do branch này gây ra** — verify bằng cách tái hiện trên clean master checkout.

Fix cấu trúc: `bootGame()` trong `useAppLifecycle.ts` TỰ gọi `startTickLoop(tick)` ngay trong success path của chính nó — loại bỏ hoàn toàn khả năng "extract composable, quên rewire" lặp lại (App.vue không còn giữ wrapper riêng, boot thành công CHÍNH LÀ tick loop đã chạy). Kèm: guard tĩnh 2 lớp `App.wiring.test.ts` (bắt hàm top-level mồ côi trong App.vue + member composable không ai tiêu thụ) + coverage cho 1 lỗi phụ phát hiện cùng lúc (countdown overlay đọc field không tồn tại `countdownSecondsRemaining`). Rule mới **P13 (Runtime Wiring Verification)** đã thêm vào `AGENTS.md` + mirror vào `.opencode/agent/build.md`/`general.md`.

Đã cherry-pick 4 commit fix này lên `master` trực tiếp (không chỉ trên branch) vì bug ảnh hưởng người chơi thật ngay lập tức. Verify trên `master`: 410 file/2650 test xanh, type-check sạch, `npm run build` sạch, e2e `create-to-combat.spec.ts` chạy trọn 1 trận tới kết quả thật. Sau đó merge `master` vào branch này (`0ce12f8`) trước khi tiếp Part B/C — mang theo luôn 40 file phân kỳ cũ (EquipmentBag, GameManager, CombatScene, kiemBarBridge...) đã ghi ở HANDOFF "integrate at finish time". Verify sau merge: 425 file/2728 test xanh, build sạch.

**Part B — Companion Roster: SHIPPED (mechanism only, 2026-09-06).** Tasks 10-14: `CompanionDefinition`/`CompanionInstance` (dùng lại thang `ItemGrade` 5 bậc Hoàng/Huyền/Địa/Thiên/Tiên), `PlayerData.companions` (save v57), `companionToCombatEntity()`/`companionStatsAtLevel()` (scale tuyến tính 8%/level, speed không scale), exp/level curve tách riêng file cho balance pass sau, gacha pull với duplicate-to-exp. `COMPANIONS: []` — nội dung roster thật là 1 pass content riêng sau, chưa làm ở đây. Xác nhận không đụng `GameManager.activePlayer`/`EquipmentSlotManager`/`SkillLoadoutSlots.ts` (đúng ý đồ design tách biệt của spec §2).

**Part C — Trận Pháp: SHIPPED (mechanism only, 2026-09-06).** Tasks 16-20:

- `TranPhapDefinition`/`TranPhapCell` types + `TRAN_PHAP_FORMATIONS: []` (nội dung thật là content pass riêng sau, chưa làm ở đây — giống `COMPANIONS`).
- `PlayerData.formationLoadout: FormationLoadout | null` (save v58).
- `localCellToAbsolute()`/`resolvePartyFormation()` (`FormationPlacement.ts`) — điểm nối DUY NHẤT giữa lưới cục bộ 6×6 của Trận Pháp và toạ độ tuyệt đối `PLAYER_SIDE_REGION`, fallback `DEFAULT_PARTY_FORMATION` khi chưa cấu hình.
- `buildTurnBattle()` dùng `resolvePartyFormation()` thật thay placeholder, thêm companion vào turn battle theo formation slot, áp buff Trận Pháp cho player + companion.
- **Phát hiện + sửa khi làm Task 19:** `GameManager.ts` khởi tạo `TurnBattleSystem` với `registry: undefined` ở CẢ 2 nơi — boss enrage buff/reactive trigger/on-hit proc/`skill.appliesBuff` qua turn-based combat đang **no-op âm thầm trong game thật** dù registry thật (`TURN_BUFF_REGISTRY`, 46 buff đã convert) đã có sẵn ở `data/buff/TurnBuffRegistry.ts`. Đã wire registry thật vào cả 2 constructor site — kích hoạt lại toàn bộ các tính năng buff này. Review Task 19 sau đó phát hiện thêm 1 finding Important: `TURN_BUFF_REGISTRY.get()` không guard sẽ crash cả trận nếu content Trận Pháp sau này trỏ tới `buff.definitionId` sai — đã fix (bọc try/catch, skip an toàn giống companion resolution), kèm test xác nhận `startBattle()` không throw khi id không resolve được. **Follow-up chưa làm (ngoài scope, ghi lại):** cùng rủi ro tồn tại ở `TurnReactionPathSkills.ts`'s `PHAP_TU_REACTION_ULTIMATE` (`appliesBuff.definitionId: 'reaction_empowerment'` — id này KHÔNG có trong `buffs.ts`), hiện vô hại vì chưa được wire vào bất kỳ ultimate slot nào, nhưng sẽ cần guard tương tự khi reaction-path ultimate được kích hoạt.
- `TranPhapPanel.vue` — kéo-thả gán player/companion vào lưới 6×6, mở qua slot có sẵn `formation_slot` trong command wheel (trước đó `NEVER_AVAILABLE`, giờ mở thật). Dùng đúng `OverlayPanel`/`useUiStore().standalonePanel` convention thật của codebase (plan's code mẫu đoán sai cả 4 điểm này — sửa lại theo pattern `SkillPathPanel.vue`).

**Gate tự động (2026-09-06):** `npm run type-check` sạch; `npx vitest run` — **427 file / 2738 test PASS**; e2e `create-to-combat.spec.ts` pass (trận đấu vẫn chạy tới kết quả bình thường sau toàn bộ wiring).

**Chưa xác nhận trực quan:** bước "chọn 1 Trận Pháp thật qua UI, xem sprite player đặt đúng ô cấu hình" trong plan (Task 21) không thể thực hiện được — `TRAN_PHAP_FORMATIONS` đang rỗng nên panel không có formation nào để chọn (đúng scope mechanism-only, không phải lỗi). Xác nhận tương đương ở tầng data/integration: `GameManager.partyFormation.test.ts` có test đặt player/companion vào ô tuỳ ý qua `formationLoadout` thật (không phải `DEFAULT_PARTY_FORMATION`) và xác nhận đúng toạ độ tuyệt đối trong `battle.players` — cần playtest trực quan thật khi có nội dung Trận Pháp đầu tiên.

**Toàn bộ 3 phần (Combat Art Pipeline, Companion Roster, Trận Pháp) đã shipped ở mức cơ chế.** `COMPANIONS`/`TRAN_PHAP_FORMATIONS` vẫn là mảng rỗng — nội dung roster/trận pháp thật là các content pass riêng, chưa làm trong phạm vi plan này.

### 9.9. Hỗn Độn Trận visual test tooling — SHIPPED (2026-09-06)

Bịt nốt lỗ hổng ghi ở cuối mục 9.8 (dòng "cần playtest trực quan thật khi có nội dung Trận Pháp đầu tiên"): `COMPANIONS`/`TRAN_PHAP_FORMATIONS` rỗng nên tới lúc đó chưa ai từng NHÌN THẤY cơ chế Trận Pháp/Companion Roster chạy thật trên màn hình. Plan: [`2026-09-06-hon-don-tran-visual-test.md`](../../docs/superpowers/plans/2026-09-06-hon-don-tran-visual-test.md), spec cùng ngày. 6 task, tất cả đã merge:

- **Task 1** — placeholder spritesheet 32-frame dùng chung toàn cục thay `buildPlaceholderAnimationSet()` (1 frame tĩnh cũ), áp dụng cho **MỌI** combat entity không phân biệt test hay thật. **Hệ quả chủ đích (không phải regression):** trận đấu thật (`CombatScene`) từ nay cũng hiện sprite animate đánh số 0→31 thay vì ảnh tĩnh đứng yên, cho tới khi có sprite-sheet nghệ thuật thật thay thế.
- **Task 2** — formation `hon_don_tran` (36/36 ô, phủ toàn bộ lưới 6×6) + 1 buff test-only đi kèm, thêm vào `TRAN_PHAP_FORMATIONS` (trước đó rỗng).
- **Task 3** — 5 companion test-only `test_companion_1`..`test_companion_5` (grade `hoang`), thêm vào `COMPANIONS` (trước đó rỗng).
- **Task 4** — `TranPhapPreviewScene`: scene Phaser lưới 6×6 phẳng, tự vẽ sprite animate tại từng ô đã gán.
- **Task 5** — wire scene đó vào `TranPhapPanel.vue`, vẽ NGAY DƯỚI lưới CSS kéo-thả cũ (thuần hiển thị, không phải drop target — logic D&D 100% giữ nguyên).
- **Task 6 (mục này)** — verify cuối: full suite xanh (428 file / 2744 test), `type-check` sạch, `EnemySpawnPlacement.ts` xác nhận **0 dòng diff** (Non-Goal "enemy spawn không đổi" giữ vững), playtest trực quan thật qua Playwright (msedge) — chọn Hỗn Độn Trận, xác nhận 36/36 ô sáng, kéo player + 3/5 companion test vào ô, sprite hiện đúng ô và animate thật (frame số đổi 5→21 trong ~1s, có ảnh chụp màn hình đối chiếu), 0 console error, đóng/mở lại panel không leak canvas/không duplicate `Phaser.Game` (đếm DOM: luôn đúng 1 `<canvas>`). Vào 1 trận Động 1 thật xác nhận lại side-effect Task 1 (enemy "Tinh Anh Sơn Khấu" animate đánh số y hệt).

**TEST-ONLY, sẽ bị thay/xóa khi có nội dung thật:** `hon_don_tran` (và buff kèm theo), 5 `test_companion_*`, cùng cách chúng lấp đầy `TRAN_PHAP_FORMATIONS`/`COMPANIONS` chỉ để có dữ liệu bấm-thử — content pass thật (trận pháp/companion thật) sẽ thay thế toàn bộ, không phải bổ sung thêm. Sprite-sheet placeholder toàn cục của Task 1 cũng tạm thời — vẫn hiện diện ở CẢ trận thật lẫn panel test cho tới khi có art thật.

**Quyết định Asset Manifest (không phải thiếu sót):** `game/public/assets/characters/placeholder/combat-anim-32frame.png` **không** được thêm vào Asset Manifest tracking Artifact, theo đúng tiền lệ `scripts/generate-vendor-placeholder-art.mjs` (asset placeholder/tạm cũng không được manifest hoá) — cả hai đều là art tạm sẽ bị xoá/thay khi có nội dung thật nên không đáng để theo dõi trong manifest sống.

---

## 10. Ghi chú / Đề xuất / Rủi ro merge (cập nhật khi gộp roadmap 2026-09-05)

### 10.1. Thứ tự merge đề xuất (tránh conflict)

1. ~~Re-apply Group 1+2 gp123 trước~~ — ✅ **XONG: merge thẳng `6318083`** (đánh giá lại: 0 conflict thật sau khi master tiến, verify từng fix còn thiếu trước khi merge — mọi fix đều còn giá trị). Lưu ý 10.2 không còn áp dụng (save version không đổi trong merge này).
2. **`feat/action-playback`** — đang Task 2/8, fork từ master tip nên merge sạch khi xong.
3. Dọn 2 worktree stale: `slice7-hud-completion`, `talent-v4-m1` (code đã merge, chỉ còn worktree + branch).
4. Sau đó mới làm các việc bảng 9.5 theo tiên quyết.

### 10.2. Rủi ro merge đã biết trước

- **Save version**: master `CURRENT_SAVE_VERSION = 56` (auto-farm); code 6E trong branch gp123 cũng tự ghi v56 cho migration age-axis (đụng số). **Khi re-apply Group 1+2 / làm lại Group 3 có chạm save: bump lên v57** gộp cả hai nghĩa, không giữ v56 của bên nào (dev phase — save cũ reject theo policy, không migration).
- **gp123 fork cũ** (`fe49848`, 2026-09-03 — trước talent-v4 merge + toàn bộ turn-rework merge): merge sẽ mang Group 1/2/3 vào sau; Group 1 sửa các file combat/UI mà turn-rework cũng chạm (CombatScene, PhaserCanvas, CombatDefeatPanel) → **review conflict thủ công**, ưu tiên giữ code turn-based master, re-apply fix gp123 lên trên.
- 6E đổi ID/tên Mộc+Khoáng sang age-axis + bỏ plain wood: chạm `MaterialTierConversionBalance`, AlchemySystem, VendorBalance, Decompose/WashTab — sau merge phải chạy full matrix (type-check + 2510 tests + build + e2e) vì đổi data ID diện rộng.

### 10.3. Cần user chốt (chưa quyết — không tự làm)

- **Bảng 9.5 #4**: giá trị `perfectClearTurnLimit` cho từng stage (hiện 0/30 stage có) — cần bảng số hoặc quy tắc (vd theo `totalEnemyCount`). Còn treo — xem mục 0 Phase B1.
- ~~**Bảng 9.5 #13**: giữ `hpRegenPerTurn` làm stat chung (engine đã wire) hay bỏ hẳn khỏi StatType.~~ — ĐÃ CHỐT 2026-09-07: giữ, cho kỹ thuật/trang bị/cảnh giới (mục 0 Phase A7).
- ~~**Bảng 9.5 #14**: xóa `MomentumBreak.ts` + tests luôn, hay giữ làm tài liệu tham khảo~~ — ĐÃ CHỐT: xóa, merge `fc16dfa` 2026-09-07 (git history còn).
- **3.5/3.6** (Stat cap Phàm Nhân, CDR cap 300%): chưa chốt từ 7.3. Không chặn beta — xử lý ở Phase D balance pass nếu còn thời gian.
- **Talent v4 M2/M3**: khi làm, target phải là `TurnBuffDefinition`/turn engine (không phải legacy `BuffDefinition`) — cần ghi rõ trong plan M2/M3 lúc viết. Xem mục 0 Phase B4.
- ~~**World map vs stage list**~~ — ĐÃ CHỐT 2026-09-07: làm world map thật cho beta (mục 0 Phase B5). **Tutorial động** (mục 5) vẫn chờ quyết định riêng, không chặn beta.
- **Companion roster** (mục 9.5 #8) — ĐÃ CHỐT 2026-09-07: trong beta (mục 0 Phase B3).
- **Giai đoạn 6 Pre-production** (online foundation/VIP/prestige) — ĐÃ CHỐT 2026-09-07: hậu-beta, không trong scope beta (mục 0 Phase D4).
- **Task 14 cũ** (nút ult manual + panel AI trong `PhapTuCombatHud.vue`, defer từ thuan-he QA): sau rework 3-skill, "ult manual" đã bao bởi `TurnCombatSkillBar` — **đề xuất đóng Task 14**, trừ khi user muốn panel AI riêng.

### 10.4. Đề xuất kỹ thuật (không làm lặng lẽ — chờ task yêu cầu, theo P9)

- **GameManager 2.939 dòng**: đợt tách Ops mới — ứng viên: turn-battle wiring (~300 dòng quanh `startStage`/rewards/auto-farm/perfect-clear) thành `GameManagerTurnBattleOps`; `convertMaterialTier`/spirit-stone convert thành `GameManagerConvertOps`.
- **StageSelectPanel còn hiện `spawnIntervalSeconds`** (dòng ~278): field này turn-based không dùng (spawn ngay khi sân trống) — ẩn khỏi UI khi dọn display (kèm việc #5).
- **`termGlossary` + `_meta` locale**: hoặc consume thật (dùng trong tooltip/validation) hoặc xóa — hiện chỉ tốn chỗ.
- **E2E**: đã có 6 spec — bổ sung luồng auto-farm Hoàn Mỹ + manual tap-to-cast khi 2 tính năng này ổn định.

---

## Cách cập nhật roadmap này (giữ từ bản turn-based cũ, áp cho toàn file)

Sau mỗi lần khảo sát/brainstorm/viết plan/merge cho một hạng mục:

1. Đổi cột **Trạng thái** (🔴 chưa quyết định → ⚪ đã quyết định chưa có plan → 🟡 đang thực thi/chờ merge → 🟢 xong, kèm ngày + commit/branch).
2. Điền/đổi link **Plan** sang file plan thật vừa viết (`game/docs/superpowers/plans/...` hoặc `docs/superpowers/plans/...` — kiểm tra file tồn tại ở đâu trước khi link).
3. Nếu quyết định mới làm lệch mô tả, cập nhật luôn dòng đó — không để roadmap nói khác plan chi tiết.
4. Việc đang bay ở branch khác ghi rõ **branch + fork-point + trạng thái commit/uncommitted** (mẫu ở mục 8.6) — khi merge xong chuyển vào bảng lịch sử.
5. Lịch sử merge trong mục 8.5/9.x chỉ để tra cứu — không dùng để theo dõi việc đang chạy.
