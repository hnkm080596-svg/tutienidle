# Roadmap Phát Triển — Tiên Hiệp Idle

> Tài liệu định hướng tổng hợp, lập ngày 2026-08-27 sau đợt rà soát toàn diện 5 mảng: Chiến đấu, Tiến trình, Kinh tế, UI/UX, Kỹ thuật & Nội dung.
> Mỗi hạng mục lớn có plan chi tiết riêng (dẫn link bên dưới). Khi plan và roadmap lệch nhau, plan chi tiết là nguồn sự thật cho hạng mục đó.
> Audit toàn diện mới nhất (bug list + trạng thái từng plan, verify theo file:line): [project-review-2026-08-28.md](./project-review-2026-08-28.md).

## 1. Nhận định hiện trạng

**Điểm mạnh cần giữ:**

- Kiến trúc sạch: Vue 3 (UI) + Phaser (canvas) + Pinia, core/data tách biệt, data-driven nhất quán.
- Pipeline damage duy nhất, test phủ dày ở combat (~30 file battle/combat/skill, tổng 154 file test).
- Vòng lặp tu luyện → Độ Kiếp → chọn đường đã có cá tính riêng.
- Kinh tế có file balance tách riêng, giao dịch atomic chống nhân bản.

**Vấn đề lớn nhất, theo thứ tự rủi ro:**

1. **Tường nội dung Trúc Cơ**: hết nội dung thật ở Trúc Cơ tầng 18 (~34 giờ chơi); stage Trúc Cơ là bản clone của Luyện Khí (`data/stage/Stages.ts:357`); không có Kim Đan (`GameManager.ts:1439` trả `false` cứng). *(2026-08-29: M1 đã xong — 10 stage Trúc Cơ thật + 20 enemy `foundation_*` + boss 2-phase/enrage + 5 quest; Kiếm Tu có node tree thật qua kiem-tu-tu-luc, xem Phase 3. Kim Đan M2/M3 bỏ khỏi roadmap cùng ngày theo quyết định người dùng — game kết thúc nội dung "cứng" ở đỉnh Trúc Cơ, realm cao hơn chỉ là data nền.)*
2. **Thiên phú trang trí** *(đã giải quyết 2026-08-28 — talent-direction-choice-plan, đã dọn sau khi hoàn thành)*: cũ — 11/13 thiên phú có `effects: []` rỗng; nay thiên phú là quyết định chọn hướng Đạo duy nhất (roll 9 chọn 1, 12 talent có effect thật).
3. **Thiếu âm thanh hoàn toàn**: 0 file audio trong project; 1.137 spritesheet VFX không được tham chiếu.
4. **Bug và drop chết trong kinh tế** *(đã giải quyết 2026-08-28 — economy-ecosystem hoàn thành: T1–T6+T8+T9, T7 bỏ vì linh thảo giữ hoàn toàn random)*: mapping Tinh Hoa sai cho realm 4+ (`RefinementBalance.ts:74-81`); vật liệu legacy vẫn rơi nhưng không còn sink.
5. **Save không validate shape** *(đã giải quyết 2026-08-28 — save-shape-validation Wave 1 + bổ sung equipment/slot shape khi review)*: chỉ kiểm tra version, tiền lệ crash boot v47 có thể tái diễn.
6. **Tài liệu lệch code** *(đã giải quyết 2026-08-28 — docs-sync viết lại game-guide.md + item-design-reference.md, dọn comment MissileSystem, xóa `Plans .md`)*: `game-guide.md` và `item-design-reference.md` mô tả hệ thống đã xóa.
7. **Nợ kỹ thuật**: `GameManager.ts` 2.504 dòng (giảm từ 2.703 sau khi tách TribulationSystem/StageWaveSystem); nhiều hệ thống core 0 test; 0 E2E spec (spec cũ đã xóa ở commit `e265e5c`); không có lint.

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
- **Wave 5 — Tech debt** ❌: eslint, phủ test hệ thống 0 test, E2E spec, GameManager extraction.
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
| Thiên phú chọn hướng Đạo (roll 9 chọn 1) + easter egg Phàm Cốt | talent-direction-choice-plan (đã dọn sau khi hoàn thành) | ✅ Xong |
| Nội dung Trúc Cơ thật | [truc-co-kim-dan-content-plan.md](./truc-co-kim-dan-content-plan.md) | ✅ M1 xong (2026-08-29) — 10 stage Trúc Cơ thật (`foundation_floor_1..10`) + 20 enemy `foundation_*` + boss 2-phase/enrage + 5 quest. **Kim Đan (M2 gate + M3 đời sống) BỎ khỏi roadmap 2026-08-29 (quyết định người dùng)** — plan đóng ở M1; các phụ thuộc Kim Đan trong plan khác chuyển thành parked/khóa vĩnh viễn đến khi người dùng mở lại |
| Reaction scale theo Power, đa dạng nhịp skill, fizzle refund, nền boss skill | [combat-balance-pass-plan.md](./combat-balance-pass-plan.md) | ✅ Xong 2026-08-29 — 8/8 task (xem "Kết quả playtest" cuối plan): dọn cost chết + invariant; reaction `powerScalingRatio 0.5` qua `elementalBasePower`; nhịp 5 skill Pháp Tu riêng biệt (Hỏa 1.6/4, Thủy 0.9/1, Mộc 1.2/2, Kim 1.0/2.5, Thổ 1.4/5); fizzle hoàn 100% resource + 50% cooldown; boss `foundation_ferocious_flood_dragon_whelp` có special attack data-driven; dọn `canUseInSlot`/`use()`/emoji reaction. **Mana giữ nguyên vai trò Linh lực hộ thể** (`manaShieldPercent`), không thêm cost cast (quyết định người dùng). Giữ lại có chủ đích: `attack_speed_cast`, `Skill.castTime` legacy |

Tiêu chí hoàn thành: người chơi có mục tiêu theo đuổi hết Trúc Cơ; thiên phú đã chọn tạo khác biệt đo được; combat có nhịp và phản ứng có ý nghĩa (không phải qua mana cost — mana là Linh lực hộ thể).

### Phase 2 — Game feel & Khám phá

Mục tiêu: game "có hồn" và dễ khám phá hơn.

| Hạng mục | Plan | Trạng thái |
|---|---|---|
| Nameplate công trình, tách CombatScene, dọn placeholder/emoji | [ui-discoverability-refactor-plan.md](./ui-discoverability-refactor-plan.md) | 🟡 Chuẩn bị một phần — layer UI primitives (Bar/Chip/Eyebrow/StatRow/EmptyState/SceneHeader, GameButton mở rộng) đã landed 2026-08-29; CombatScene vẫn 2.922 dòng god-class, chưa nameplate, chưa dọn emoji |

Tiêu chí hoàn thành: hotspot công trình tự giải thích không cần tooltip; CombatScene không còn là god-class. *(2026-08-29: Âm thanh là asset — tạm bỏ qua khỏi roadmap theo quyết định người dùng; plan [audio-game-feel-plan.md](./audio-game-feel-plan.md) giữ nguyên như tài liệu tham khảo.)*

### Phase 3 — Chiều sâu hệ thống

Mục tiêu: mở rộng các trục progression đang bỏ hoang.

| Hạng mục | Plan | Trạng thái |
|---|---|---|
| Kiến Cơ 4 bậc, node tree Kiếm Tu, chiều sâu idle (Cảm Ngộ offline, nguồn tăng tốc tu luyện) | [progression-depth-plan.md](./progression-depth-plan.md) | 🟡 Một phần — node tree Kiếm Tu (2 nhánh `KiemTuNodes.ts`, 9 skill Kiếm Trận, Bát Kiếm, tự lực combat) ✅ xong qua kiem-tu-tu-luc; **Kiếm Thế / Kiếm Ý (2026-08-29)** ✅ — route chốt vĩnh viễn lúc chọn path (tram Lv3), 2 tài nguyên (Kiếm Thế pool trận KT / Kiếm Ý tầng boss vĩnh viễn BK), mỗi route 1 skill + 2 ult manual, 9 on-hit node, 6 node chuyển skill cũ, gỡ Nộ; **Đột Phá / Bậc Ẩn / Lôi Kiếp (2026-08-29, spec dot-pha-loi-kiep)** ✅ — Kiến Cơ 4 bậc un-park qua resolver `BreakthroughGrades.ts` (Địa: Trúc Cơ Đan + 3 tầng Luyện Th thể; Thiên: 6/6 + 6/8 kinh mạch; Đại Đạo ẩn hoàn toàn — thua kiếp siêu cấp mất vĩnh viễn, thắng chuyển Phàm Cốt → Phàm Nhân Chi Cốt), Kỳ Kinh Bát Mạch 9 đường (MeridianSystem), quái ẩn Huyết Mông cửa sổ 1000 kill drop Thiên Địa Chi Kiều, Thông Mạch Đan/Trúc Cơ Đan (alchemy specialIngredients), TribulationDirector chương kiếp mới (Tâm Ma hỏi đáp + tank lôi, bỏ quái Kiếp + Đột Phá Lệnh + TribulationSystem cũ), caps Luyện Th thể ×3.5, save v54 — số liệu first-pass chờ playtest; Cảm Ngộ offline chưa làm (Ngộ Đạo chỉ online) |
| Sink Linh Thạch hậu kỳ, vendor, Điểm Rèn, filter túi đồ | [economy-fixes-sinks-plan.md](./economy-fixes-sinks-plan.md) (Phần B — Phần A đã gộp vào economy-ecosystem-plan, đã dọn sau khi hoàn thành) | 🟡 Một phần — Điểm Rèn per-item (forgePoints) đã có trong `EquipmentSystem` (rework 2026-08-26); chưa vendor, chưa filter túi đồ |

Tiêu chí hoàn thành: gate đột phá có chất lượng khác nhau; Kiếm Tu có chiều sâu build tương đương Pháp Tu; idle có đường nâng cấp.

### Phase 4 — Bền vững kỹ thuật (chạy song song, không chặn phase khác)

| Hạng mục | Plan | Trạng thái |
|---|---|---|
| Tách dần GameManager, phủ test hệ kinh tế, thêm E2E + lint | [tech-debt-test-coverage-plan.md](./tech-debt-test-coverage-plan.md) | 🟡 Một phần — GameManager 2.703→2.504 dòng (tách `TribulationSystem`, `StageWaveSystem`, `TemplateRegistry`); test file tăng 154→191 (1093 test ~); vẫn chưa lint, chưa E2E spec (spec cũ đã xóa) |
| Cloud save / online (plan riêng đã có) | [online-login-cloud-save-plan.md](./online-login-cloud-save-plan.md) | 🟡 Một phần — auth Supabase + migration SQL; cloud-save layer có rồi nhưng chỉ là local adapter (`LocalCloudSaveService`), chưa Supabase adapter thật |

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
          economy-fixes-sinks Phần B — độc lập
Phase 4:  tech-debt — chạy nền liên tục
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

## 6. Quy trình thực hiện

1. Mỗi plan được thực hiện bởi một phiên agent riêng (theo Context policy trong PROJECT_CONTEXT.md).
2. Trước khi chạy plan: đọc plan + các file được dẫn trong plan.
3. Sau mỗi plan: chạy `npm.cmd run test`, `npm.cmd run type-check`, `npm.cmd run build` từ `game/`.
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

- **2.1** ⬜ vue-i18n v9 → v11 migration
- **2.2** ⬜ Hoàn tất nốt string extraction (các file plan bỏ sót)
- **2.3** ⬜ `formatStat` extension cho `SkillResourceStatLabels`
- **2.4** ⬜ `CombatStatusBar` `mpLabel` fallback (hardcoded 'Linh Lực')
- **2.5** ⬜ Bỏ locale-coupled test assertions
- **2.6** ⬜ Locale parity lint test (`vi.json` ↔ `en.json`)
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

**6A. Combat Scene UI redesign** — ✅ merged `71357a1` (PlayerHudLayer in-canvas, 3 bar DOM xóa, kill/heal floating text). ⚠️ Kiếm Ý/Thế bar chưa có data event (defer)

**6B. Bugfix hiển thị:**
- Crit Damage % — ✅ merged `8981772` + `0fcb17e`
- Unidentify Linh Thảo — HỦY (production rework sẽ đào thải)
- Hóa Luyện filter — ✅ merged `14cfda0` + `abc82be`

**6C. Chiêu Hiền Quán + hệ thống nhân công** — 🟡 code xong ở worktree `worktree-chi-hien-quan` (chưa merge), QA quick PASS WITH GAPS, còn thiếu manual smoke — xem 8.5 (NEW building + công thức `1 + cấp×2`; đổi nguồn worker capacity; UI phân bổ)

**6D. Bảng ánh xạ phẩm ↔ cảnh giới** — ✅ item-grade rework Phase 1-4 merged `fd82ed4` + `3c898b0` + `3647cf7`; Phase 5-6 (equip gate, breakthrough unequip, panel tabs, theme, terminology) ✅ merged `a00de32`

**6E. Linh Mộc trong luyện đan** — ⬜ (siết rule `resolveFuelWood` cùng phẩm-chất)

**6F. Cân bằng thu thập–tiêu thụ** — ⬜ (bảng tốc độ chuẩn per-worker; simulation test 24h)

**6G. Vendor redesign** — ⬜ (bỏ quy đổi, gate thu mua theo phẩm, 2-tab UI)

**6H. Roadmap tương lai** — ⬜ (tiền VIP, Shop VIP, chu kỳ sau Độ Kiếp)

### 7.6. Kỹ thuật nợ nhỏ

- Chunk size warning — ✅ code-split merged `af88cee` (entry 2231→848KB)
- `_meta` block trong locale JSON — ⬜
- `termGlossary` chưa được consume — ⬜
- Known flaky tests — ⬜ (cân nhắc nâng timeout)

### 7.7. Todolist thực thi — trạng thái

| Task | Mô tả | Trạng thái |
|---|---|---|
| **Giai đoạn 0** — Cứu work treo | audit-fixes + worktrees + stash | ✅ XONG |
| **Giai đoạn 1** — Dọn nhà | untracked docs, skills cleanup, MainMenu e2e | ✅ XONG |
| **Giai đoạn 2** — Game design nền tảng | crit%, unidentify, luyện filter, item-grade rework, combat UI | ✅ XONG |
| **Giai đoạn 3** — Skill engine | Phase 2A, floating text, unified buff | ✅ XONG |
| **Giai đoạn 4** — Sản xuất + kinh tế | i18n leftovers, Chiêu Hiền Quán, UI phân bổ, nhiên liệu, bảng tốc độ, simulation, vendor rework | 🟡 Chiêu Hiền Quán code xong ở worktree (chưa merge, xem 8.5); còn lại (i18n leftovers, nhiên liệu, bảng tốc độ, simulation, vendor) chưa làm |
| **Giai đoạn 5** — Balance | evasion, MP cost, armor, reaction, block | ✅ XONG |
| **Giai đoạn 6** — Pre-production | online foundation, VIP, prestige, code-split, QA | 🟡 Một phần |
| **Giai đoạn 7** — Item rework P5-6 | equip gate, breakthrough unequip, tabs, 10-rank theme, terminology, dọn legacy | ✅ XONG |
| **Giai đoạn 8** — UI/UX repair | CombatSceneOverlay styles, overlap guards, e2e layout smoke, dọn probe + UI review items | ⬜ |

### 7.8. Thứ tự đề xuất

1. **Giai đoạn 8** — UI/UX repair (T8.1-T8.4 + các item UI review)
2. **Giai đoạn 4** — Sản xuất + kinh tế: i18n leftovers → Chiêu Hiền Quán → nhiên liệu → bảng tốc độ → simulation → vendor
3. **Giai đoạn 6** — Pre-production: online foundation → VIP → prestige

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

---

## 8. Giai đoạn 9 — QA Deep Lần 1 (2026-09-02) — ưu tiên sửa trước khi cộng dồn nợ

> Nguồn: `game/docs/qa/2026-09-02-full-project-deep.md` (verdict: FAIL, 1 Confirmed + 11 Suspected/Coverage gap + 9 optimize).
> Phạm vi: toàn project (7 domain pack).
> Nguyên tắc thực thi: TDD theo từng item; reproduction test viết trước, production fix viết sau, verify bằng `type-check` + vitest + build + e2e như AGENTS.md.

### 8.1. Bug fix từ QA deep — ưu tiên cao (theo verdict FAIL)

| Task | Mô tả | Trạng thái |
|---|---|---|
| **9.1** 🟡 | **QA-001 (High, Confirmed) — Kẹt trang bị khi đột phá** | ĐÃ ĐỔI THIẾT KẾ (user 2026-09-02); **user chốt lại 2026-09-02 (lần 2): giữ theo code worktree** (confirm panel → auto-unequip, KHÔNG chặn cứng — xem note superseded ở 8.2) — 4/6 task đã code ở `worktree-task-9-1` (chưa merge), còn Task 5 (sửa test dở) + Task 6 (dọn dead code) |
| **9.2** ⬜ | QA-002 (High) — `restoreFromSave` thiếu idempotency guard | |
| **9.3** ⬜ | QA-003 (High) — `OverlayPanel` thiếu focus trap (H5 Giai đoạn 8) | |
| **9.4** ⬜ | QA-004 (Medium) — `updateKiem` chưa được gọi từ production (defer lâu, sửa cùng 6A) | |
| **9.5** ⬜ | QA-005 (Medium) — `PhaserCanvas.vue setupGame` leak handler khi throw | |
| **9.6** ⬜ | QA-006 (Medium) — `CombatDefeatPanel` thiếu 10s auto-return-home | |
| **9.7** ⬜ | QA-007 (Medium) — `OfflineProgressSystem` thiếu `isFinite(cultivationPerSecond)` guard | |
| **9.8** ⬜ | QA-008 (Medium) — `MaterialBag.add` overflow bị caller bỏ qua | |
| **9.9** ⬜ | QA-009 (Medium) — `useAutoRetryCountdown.start()` không clear handle cũ | |
| **9.10** ⬜ | QA-010 (Medium) — `EquipmentSlotManager.restore` thiếu slot-enum check (defense in depth) | |
| **9.11** ⬜ | QA-011 (Low) — `LocalCloudSaveService` 2 key không atomic | |
| **9.12** ⬜ | QA-012 (Low) — `stateVersion` bump mỗi tick dù state không đổi (refactor) | |

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
| **OPT-03** | `game/src/composables/useCadenceSmoothing.ts:56-68` | rAF loop không tự dừng | ✅ Code xong ở worktree `worktree-perf-optimize-pass` (Task 2, commit `14a8235`) — chưa merge vào master |
| **OPT-04** | `game/src/core/equipment/EquipmentBag.ts:129-135` | `getEquipped`/`getEquippedInSlot` O(N) | Thêm `Map<EquipmentSlot, EquipmentInstance>` index |
| **OPT-05** | `game/src/components/panels/EquipmentHallPanel/EnhanceTab.vue:63-111` | `enhanceRows` O(slots × 5) mỗi stateVersion bump | Memoize theo `(stateVersion, selectedSlot)` |
| **OPT-06** | `game/src/services/save/SaveSystem.ts:661-668` | `loadGame` đọc+remove `IMPORT_HANDOFF_KEY` mỗi boot kể cả khi không import | Lazy read |
| **OPT-07** | `game/src/App.vue:285-287` | `drainNotifications()` chạy mỗi tick vô điều kiện | ✅ Code xong ở worktree `worktree-perf-optimize-pass` (Task 2, commit `14a8235`, dạng trả mảng rỗng dùng chung thay vì early-return) — chưa merge vào master |
| **OPT-08** | `game/src/components/game/PhaserCanvas.vue:120-136` | EventBus handler đăng ký trước async game create | Wrap try/catch + cleanup on failure (cũng liên quan 9.5) |
| **OPT-09** | `game/src/game/scenes/CombatScene.ts` | 11-entry `boundHandlers` array + 14 explicit `on()` | ✅ Xong 2026-09-02 — gộp thành 1 danh sách `getCombatEventBindings()` (22 entry), subscribe/unsubscribe cùng lặp 1 nguồn nên không thể lệch nhau; `unsubscribeCombatEvents()` idempotent (clear `eventBus`); test mới `CombatScene.eventSubscriptionSymmetry.test.ts` |

### 8.4. Thứ tự đề xuất

1. **Task 9.1** (QA-001 panel chặn đột phá) — làm đầu vì Confirmed + đảo ngược spec cũ; dùng `OverlayPanel` primitive (cần Task 9.3 trước một phần — focus trap).
2. **Task 9.3** (focus trap OverlayPanel) — bổ trợ cho 9.1.
3. **Task 9.2** (idempotency restoreFromSave) — bảo vệ save integrity.
4. **Task 9.7** (OfflineProgressSystem isFinite) — bảo vệ save integrity.
5. **Task 9.8** (MaterialBag.add overflow caller) — bảo vệ resource conservation.
6. **Task 9.4, 9.5, 9.6, 9.9, 9.10, 9.11** — bổ trợ, sắp xếp theo thời gian tiện tay.
7. **Task 9.12 + OPT-01..09** — cộng dồn cuối, làm theo đợt refactor.

### 8.5. Worktree đang chạy (2026-09-02, chưa merge — cập nhật sau lần rà soát thực tế)

> 3 worktree song song, không đụng file của nhau (xem ràng buộc "Global Constraints" trong plan `perf-optimize-pass`). Trạng thái dưới đây lấy từ `git log`/`git status` thực tế trong từng worktree, không phải suy đoán.

| Worktree (branch) | Việc | Trạng thái thực tế |
|---|---|---|
| `.claude/worktrees/chi-hien-quan` (`worktree-chi-hien-quan`) | Task 6C — Chiêu Hiền Quán (building nhân công mới, công thức `1+level×2`, thay `spirit_spring`) | Code xong cả 6 task trong plan (9 commit) + QA quick review **PASS WITH GAPS** (`game/docs/qa/2026-09-02-chi-hien-quan-quick.md`). Full suite 2096/2096, type-check/build/e2e xanh. Còn thiếu: manual smoke thật (dev server) chưa chạy, 1 e2e smoke file (`chq-smoke.mjs`) chưa commit. **Sẵn sàng review-để-merge**, chưa merge vào `master`. |
| `.agent-worktrees/task-9-1-breakthrough-equip-panel` (`worktree-task-9-1`) | Task 9.1 — QA-001 panel xác nhận đột phá khi còn trang bị | 4/6 task của plan `2026-09-02-task-9-1-breakthrough-confirm-panel.md` đã commit (gộp `canTriggerBreakthrough`, `triggerBreakthroughAction`, panel xác nhận + i18n keys, dọn RealmPanel). Task 5 đang dở — 2 test file sửa dở chưa commit (`useTribulation.dotPha.test.ts`, `GameManager.realmAdvanceUnequip.test.ts`); Task 6 (dọn dead code) chưa làm. **User chốt 2026-09-02 (lần 2): giữ nguyên hướng code hiện tại** (confirm panel → auto-unequip), spec chặn-cứng ở mục 8.2 đã superseded. Còn lại trước khi merge: hoàn thành Task 5-6, chạy full verify (`test`+`type-check`+`build`). |
| `.claude/worktrees/perf-optimize-pass` (`worktree-perf-optimize-pass`) | OPT-01..09 (mục 8.3) + tách file lớn | Plan 10 task (`2026-09-02-perf-optimize-pass.md`), đã xong Task 1-3/10: Task 1 safety-net test; Task 2 = **OPT-03** (rAF cadence tự dừng) + **OPT-07** (NotificationQueue trả mảng rỗng dùng chung thay vì alloc mới); Task 3 điều tra **OPT-02** — kết luận audit sai tiền đề (chỉ có 1 `JSON.stringify` thật ở write-time, `structuredClone` là snapshot cần thiết chống race quest-state) → **không cần sửa code**, chỉ thêm test round-trip khoá hành vi. Task 4-10 (PhaserCanvas try/catch = 9.5/OPT-08, dirty-check stateVersion = OPT-01, BattleSystem/CombatScene/EquipmentSystem tách file, bundle chunk) **chưa làm**. Locked worktree, chưa merge. |

Khi merge bất kỳ worktree nào, nhớ cập nhật lại bảng trạng thái tương ứng ở mục 7.4 (6C), 8.1 (9.1) và 8.3 (OPT) — bảng đó vẫn đang ghi "⬜" dù code thực tế đã có ở worktree.

### 8.6. Liên kết QA artifacts

- Báo cáo chính: `game/docs/qa/2026-09-02-full-project-deep.md`
- Reproduction test QA-001: `game/src/core/game/GameManager.realmAdvanceUnequip.test.ts`
- Exploration reports (subagent): `game/docs/qa/2026-09-02-{combat-tribulation,economy-progression,save-cloud}-*.md`
- Learned-defect entry: `QA-2026-09-02-001` trong `game/docs/qa/learned-defects.md`
