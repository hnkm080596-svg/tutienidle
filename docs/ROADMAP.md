# TutiênIdle — Roadmap việc còn lại

> Cập nhật: 2026-09-01 (bản 2 — sau khi merge `feat/i18n-string-refactor` — commit `28eec58`)
> Nguồn: deferred items từ i18n final review, stat-system deep check, e2e trạng thái hiện tại, các plan chưa execute, game-design direction 2026-09-01 (mục 6).
> **Phạm vi:** Skill rework (Phase 2A) được thực hiện BỞI AGENT NÀY trong chuỗi thực thi — không còn là external blocker. Không có dependency "chờ Claude Code".
> **Nguyên tắc UI (khóa, đúng cho mọi UI):** layout phải FLEXIBLE / fit-to-container — số cột, kích thước item tự thích ứng theo container thật qua CSS auto-fill/minmax + ResizeObserver đo contentRect (xem AGENTS.md "UI Layout Rule"). Cấm hardcode số cột/px theo màn hình dev. Áp cho mọi task có UI trong roadmap này (6A Combat UI, 6C Chi Hiền Quán, 6G Vendor...).

---

## 1. Bugfix / ổn định — ƯU TIÊN CAO

### 1.1 Fix MainMenu e2e blocker (5 e2e fails pre-existing trên master)
- **Vấn đề:** 5 e2e tests fail trên master từ khi MainMenu chuyển thành fixed overlay (`App.vue` + `MainMenu.vue`): `create-to-combat`, `ink-wash-ui` (desktop/compact/tall), `save-reload`. Overlay chặn flow boot → `.game-root` không bao giờ xuất hiện.
- **Việc cần làm:**
  - Sửa flow boot: MainMenu overlay phải nhường đúng lúc cho auth/creation flow (hoặc e2e helpers cần click "Bắt đầu tu luyện" trước).
  - Thêm e2e test cho chính MainMenu: hiện overlay khi boot, 4 menu buttons render, click "Bắt đầu tu luyện" ẩn menu và vào auth flow.
- **Verify:** `npx playwright test` pass 6/6 (boot-fresh + 5 test trên).

### 1.2 Dọn working tree master
- **Uncommitted:** skills cleanup (`D .claude/skills/level-1..3-image-generator`, `story-*`, `scene-splitter`, `M skills-lock.json`) — user's own work, cần quyết định commit hoặc restore.
- **Untracked docs cần commit:** `docs/superpowers/plans|specs/2026-08-31-i18n-string-refactor.md`, `-skill-trigger-action-rework.md`, `-engine-phase2a.md`, `-online-required-local-gameplay-foundation.md`, `-tutienidle-adversarial-qa.md` + specs tương ứng + `game/docs/qa/` + `.agents/skills/tutienidle-adversarial-qa/`.
- **4 stashes cũ:** `stash@{0}` main-wip-pre-merge (đã restore một phần — kiểm tra còn thiếu gì rồi drop), `stash@{1..3}` rescue từ worktree đã cleanup (an toàn để drop sau khi verify).

### 1.3 Dọn worktrees cũ (6 còn sót)
- `.agent-worktrees/audit-fixes` (`agent/audit-fixes`) — xem mục 1.3a
- `.agent-worktrees/dong-fu-buildings-style-redesign` (`agent/dong-fu-buildings-style-redesign`)
- `.agent-worktrees/simplify-agent-rules` (`agent/simplify-agent-rules`)
- `.agent-worktrees/tutienidle-adversarial-qa` (detached HEAD)
- `E:\tutienidle-fix-decimal-format` (`agent/fix-enhance-decimal-format`)
- `E:\tutienidle-material-names` (`agent/unify-material-quality-names`)
- Việc: kiểm tra mỗi worktree có uncommitted work không → merge/commit cái giá trị → `git worktree remove` + `git branch -d`.

### 1.3a HOÀN TẬT audit-fixes (GIANG DỞ — cần xử lý trước khi dọn worktree)
**Trạng thái đã kiểm chứng (2026-09-01):**
- Worktree `.agent-worktrees/audit-fixes`, branch `agent/audit-fixes` (base `d4ec83b`).
- Plan: `docs/superpowers/plans/2026-08-31-audit-fixes.md` (15 tasks, TDD từng task) — file này đang là **untracked trong worktree**, chưa có trên master.
- **15/15 tasks đã có code**: 42 files modified (+1254/-177), 6 test files mới (SaveSystem.quota, LocalCloudSaveService.quota, EquipmentBag.autoDissolve, GameManager.enemyClear, MainScene.lifecycle, usePanelPagination).
- **Task 15 verification sweep ĐÃ PASS trên worktree:** type-check ✅, 1518/1519 vitest (1 fail = flake `dongFuBuildingAssets` quen thuộc, pass standalone ✅), build ✅.
- Task 14 có QA report: `game/docs/qa/2026-08-31-task14-locale-consistency-quick.md` — PASS WITH GAPS.
- **TUYÊN TRỐNG: 0 commits.** Toàn bộ 42-file work nằm uncommitted trong working tree của worktree. Agent dừng trước bước commit từng task.

**Việc cần làm (theo thứ tự):**
1. Trên worktree audit-fixes, review diff toàn bộ 42 files (chia theo 15 tasks trong plan) — code đã verify nhưng chưa từng qua task review.
2. Commit theo nhóm task (tối thiểu 15 commits theo plan, hoặc nhóm hợp lý) trên `agent/audit-fixes`.
3. **Rebase/merge lên master mới** — KHÔNG rebase được trực tiếp: master đã đi trước 65 commits (theme-redesign 28 + i18n 13 + docs). Đặc biệt **i18n đã sửa 6 file trùng**: `EquipmentHallPanel.vue/.test.ts`, `SettingsPanel.vue/.test.ts`, `SpiritSpringPanel.vue`, `VendorPanel.vue` → chắc chắn conflict khi integrate.
   - Giải conflict theo hướng: giữ i18n `t('...')` keys làm nguồn string, áp logic audit-fixes (save quota, notifications, export-save, auto-dissolve...) lên trên.
   - Lưu ý Task 14 của audit-fixes (locale consistency Vendor/SpiritSpring/Settings dùng `formatNumber`) **trùng hoàn toàn** với Task 9 đã làm trong i18n branch trên master → khi integrate, Task 14 audit-fixes có thể DROP, chỉ giữ phần `toLocaleTimeString('vi-VN')` trong SettingsPanel (i18n không làm).
4. Sau khi commit xong: chạy full verify lại trên kết quả integrated (type-check, vitest full, build, boot-fresh e2e).
5. Merge vào master, xóa worktree + branch.
6. Copy `docs/superpowers/plans/2026-08-31-audit-fixes.md` + `game/docs/qa/2026-08-31-task14-locale-consistency-quick.md` về master (đang untracked trong worktree).

**Ước lượng effort:** review + commit ~1 session; rebase/conflict-resolve 6 file trùng ~1 session.

### 1.3b Worktree dong-fu-buildings-style-redesign (GIANG DỞ — art pipeline)
**Trạng thái đã kiểm chứng (2026-09-01):**
- 38 dirty files, **0 commits ahead master** → toàn bộ uncommitted.
- Nội dung: v2 art assets cho các building (base/ground-shadow/locked-overlay/silhouette-mask PNG của equipment_hall, gathering_outpost, pill_room...), 2 PowerShell pipeline scripts (`build-dong-fu-building-layers.ps1`, `render-dong-fu-building-previews.ps1`), sửa `dongFuBuildingAssets.test.ts`, **test mới chưa track** `dongFuBuildingPipeline.test.ts`.
- Liên hệ: flaky test `dongFuBuildingAssets` (mục 7) có thể liên quan trực tiếp tới asset/silhouette changes này — worktree này có thể chính là phần làm dở của fix.

**Việc cần làm:** review diff → quyết định giữ (commit trên branch riêng rồi integrate) hay discard (nếu là thử nghiệm style bị bỏ) → dọn worktree.

### 1.3c Worktrees nhỏ còn lại
- `simplify-agent-rules`: 1 dirty file (`AGENTS.md`), 0 commits ahead — là edit rules đang dở, cần review + merge hoặc discard. Lưu ý AGENTS.md trên **master working tree cũng có edit chưa commit** (mục 1.2) — check trùng nội dung trước khi quyết.
- `tutienidle-adversarial-qa` (detached HEAD `d4ec83b`): AGENTS.md edit + untracked `.agents/skills/tutienidle-adversarial-qa/` + `game/docs/qa/` — nội dung TRÙNG với untracked trên master working tree (mục 1.2). An toàn để discard worktree này, giữ bản trên master.
- `E:\tutienidle-fix-decimal-format` (`agent/fix-enhance-decimal-format`, commit `ad46c59`): **clean** — fix `formatStat` thay `toFixed(1)` ở qi-hall. Kiểm tra xem đã merge chưa; nếu chưa, đây chính là phần khớp mục 2.3 (formatStat extension) → cherry-pick/merge rồi xóa.
- `E:\tutienidle-material-names` (`agent/unify-material-quality-names`, commit `435ec08`): **clean** — unify material quality names. Kiểm tra đã merge chưa (commit `55e07fc` cùng chủ đề có trong history của audit-fixes) → nếu chưa merge vào master thì merge, rồi xóa.

---

## 2. i18n — Deferred items từ final review (APPROVED_WITH_MINORS)

### 2.1 vue-i18n v9 → v11 migration (follow-up gần nhất)
- v9.14.5 đang dùng đã deprecated (maintenance mode, không còn upstream fixes).
- API surface đang dùng (`createI18n`, `legacy: false`, `useScope: 'local'`, named-param `t`) ổn định qua v9→v11 — migration là version bump + audit, không rewrite.

### 2.2 Hoàn tất nốt string extraction (các file plan bỏ sót)
- `HomeResourceStrip.vue:81`, `AlchemyView.vue:23/287`, `BreakthroughRequirementPanel.vue:75` — "Linh Thạch" + các label còn hardcode.
- `EquipmentHallPanel.vue` — reviewer từng liệt kê vài dòng còn lại ngoài 5 dòng đã fix (kiểm tra lại bằng grep tiếng Việt).
- Action labels: `ActionAvailability.ts:32` còn "Linh Thạch".

### 2.3 formatStat extension cho SkillResourceStatLabels
- `core/skill/SkillResourceStatLabels.ts:53` còn raw `(value * 100).toFixed(1)` — kiểu dữ liệu khác `StatKey`, cần mở rộng `formatStat()` hoặc helper riêng.

### 2.4 CombatStatusBar mpLabel fallback
- `CombatStatusBar.vue:82` còn `?? 'Linh Lực'` hardcoded — data-coupled, cần route qua `SkillResourceLabels.ts`.

### 2.5 Bỏ locale-coupled test assertions
- `StageSelectPanel.test.ts` assert chuỗi vi cứng (`'10 quái'`, `'Boss: Sơn Khấu'`) — brittle khi đổi locale. Chuyển sang assert qua `t()` key resolution hoặc mount với test locale.

### 2.6 Locale parity lint test (coverage gap)
- Reviewer 7e ghi nhận: chưa có test tự động so key structure `vi.json` ↔ `en.json`. Thêm `game/src/locales/parity.test.ts` (đã có bản so tay trong review, cần biến thành test vĩnh viễn).

### 2.7 (Lâu dài) Extract data content strings
- `data/**/*.ts` (Skills.ts 3086 VN chars, KiemTuNodes.ts 986, Techniques.ts 518...) — item names, lore, descriptions → JSON keyed by ID để localize. Đây là P4, task lớn, tách plan riêng.

---

## 3. Balance / stat system — Từ deep-check đầu session

### 3.1 (P0) Evasion vs Accuracy lệch base
- Player evasion 5, enemy evasion 25 → enemy dodge player nhiều hơn ngược lại. Code đã acknowledge (`StatBlock.ts:42-47`) nhưng chưa fix.
- Fix: rebase player evasion ~20-25, HOẶC thêm `accuracyFloor` cho player hit enemy.

### 3.2 (P1) MP cost cho skill
- `maxMp` chỉ mang tính phòng thủ (manaShieldPercent), skill không tốn MP → spam skill. Thêm MP cost, đặc biệt ultimate.

### 3.3 (P1) Realm Pressure test coverage
- Thiếu test cho grade 1 + gap ≥ 1 (case khó nhất: ×0.5 damage khi đánh cao 1 bậc). Có thể gây "tường thành" progression.

### 3.4 (P2) Armor curve playtest
- `Armor.ts:14-16` tự note "needs playtest tuning" (K=50, cap 75%). Log data 100 combat round để tune.

### 3.5 (P2) Stat cap Phàm Nhân quá chật
- `StatCap.ts:14-36`: chỉ cộng được 9 điểm/stat ở Phàm Nhân. Cân nhắc nâng 15-20.

### 3.6 (P2) CDR cap 300% review
- Lý thuyết cho phép x2 cast speed — cộng dồn attackSpeed dễ phá balance. Xem lại cap hoặc thêm diminishing returns.

### 3.7 (P2) Reaction damage late-game
- Base cố định 60-85 + power ratio 0.5× — vô nghĩa ở late game. Cần scaling theo realm/level.

---

## 4. Plans đã viết nhưng CHƯA execute

### 4.1 Skill Trigger/Action Engine — Phase 2A
- Plan: `docs/superpowers/plans/2026-08-31-skill-trigger-action-engine-phase2a.md` (2320 dòng, 10 actions + 7 triggers mới, `fireNested` helper).
- Spec: `docs/superpowers/specs/2026-08-31-skill-trigger-action-rework-design.md`.
- Lưu ý từ plan: `onDodge` bị drop (YAGNI); Phase 2B (universal entity model cho enemies) là plan riêng, phụ thuộc 2A.

### 4.2 Online-Required Local-Gameplay Foundation
- Plan: `docs/superpowers/plans/2026-08-31-online-required-local-gameplay-foundation.md` (1273 dòng, 13 tasks, Supabase auth/Edge Functions/boot coordinator).
- Spec: `docs/superpowers/specs/2026-08-31-online-required-local-gameplay-architecture-design.md`.
- Cấu trúc 13 tasks:
  1. Typed boot state machine (`useBootFlow` guarded reducer)
  2. Guest/account sessions restorable (backend-mode fail-closed: mock | local-supabase | server)
  3. Server progress schema + idempotency + archive records (SQL migrations, RLS)
  4. Progress payload validation + adapters (LocalProgressService fake, SupabaseProgressService)
  5. Recovery cache + serialized sync coordinator
  6. Authenticated server progress function
  7. Offline settlement → server authority (server time là nguồn duy nhất)
  8. **Unified Welcome/Auth Screen — REMOVE competing MainMenu flow** (dùng lại MenuBackground/MenuLogo/MenuButton, xóa MainMenu độc lập)
  9. Extract game runtime + canonical progress sync
  10. Guest→account progress comparison + selection (không merge, chọn 1, archive 30 ngày)
  11. Connectivity monitor + grace period 90s + reconnect UI
  12. Active session transfer + safe logout
  13. E2E integration + release-readiness verification
- Lưu ý reconcile khi execute:
  - Plan viết trước theme-redesign + i18n + audit-fixes — "preserve uncommitted edits" đã lỗi thời (tất cả đã commit).
  - **MainMenu overlay hiện tại (App.vue:594-607, `showMainMenu` ref) là kiến trúc tạm — Task 8 của plan này THAY THẾ hoàn toàn nó** bằng WelcomeAuthScreen hợp nhất. Fix T1.4 trong roadmap (e2e MainMenu blocker) chỉ là sửa tạm để e2e xanh; đừng đầu tư thêm UI cho MainMenu.
  - Constants khóa: autosave 15s, reconnect grace 90s, guest-link token 10 phút, archive 30 ngày, offline cap 86400s.
  - Prerequisite: Supabase local setup (Task 2-3 cần local-supabase mode để test).

### 4.3 Adversarial QA infrastructure
- Plan: `docs/superpowers/plans/2026-08-31-tutienidle-adversarial-qa.md`.
- Skill `.agents/skills/tutienidle-adversarial-qa/` chưa track trong git (untracked) — commit theo mục 1.2.

---

## 6. Game design direction 2026-09-01 — Combat UI, kinh tế, phẩm/cảnh giới

> Nguồn: design direction từ user 2026-09-01. Trạng thái hiện tại đã khảo sát qua explorer survey (file refs chính xác). Phân loại **NEW** = viết mới hoàn toàn / **MODIFY** = sửa code hiện có.

### 6A. Combat Scene UI redesign (MODIFY — chủ yếu UI layer)

Yêu cầu:
1. Bỏ thanh HP dạng DOM overlay; chuyển HP player + kẻ địch vào **bên trong background chiến đấu** (Phaser scene).
2. Nút thoát trận cũng nằm trong background.
3. Combat Scene chỉ còn background làm vùng giao diện chính — bỏ lớp khung nền bao ngoài.
4. Bỏ hai bar ở bottom bar (CombatEventBar + CombatControlBar) và thông báo hạ gục/crit tại đó.
5. Floating combat text thay thế toàn bộ thông báo: **sát thương, CRIT, MISS, né tránh, hồi máu, hạ gục, hiệu ứng đặc biệt**.

Trạng thái hiện tại (survey):
- Kiến trúc: Phaser canvas + DOM overlay bars (reserve space qua measured insets, `CombatScene.ts:679-720`, `CombatSceneOverlay.vue:37-52`).
- HP player: DOM `CombatStatusBar.vue:144-178`. HP enemy: Phaser graphics trên sprite (`CombatScene.ts:252-259, 1066-1089`) — enemy HP đã sẵn trong scene.
- Bottom bar: `CombatEventBar.vue` (event feed "Chí Mạng"/"Hạ Gục") + `CombatControlBar.vue` (nút "✕ Thoát Trận" 126-133 + confirm 173-182 + `abandonBattle()`).
- Floating text: `combat-damage-text.ts` có sẵn `showDamageNumber`/`showDotDamageNumber`/`showFloatingText` — "Chí Mạng!", "Né!" đã chạy qua Phaser text.
- Combat event types tồn tại sẵn (`CombatEvent.ts:1-10`): `attack|hit|damage|critical|kill|death|heal|dodge|block`. **Gap:** `kill` chỉ render ở DOM bar (BattleSystem filter 346-348), **`heal` chưa bao giờ được emit** trong core combat.

Việc cần làm:
1. Migrate HP player vào Phaser (canvas graphics bên trong background, cạnh/above player sprite) — xóa `CombatStatusBar.vue` khỏi overlay.
2. Migrate exit button vào Phaser (interactive zone trong background) hoặc giữ DOM nhưng position inside background area — kèm confirm flow + `abandonBattle()` wiring.
3. Bỏ `CombatSceneOverlay.vue` hai bar bottom (EventBar + ControlBar) + khung nền bao ngoài; bỏ measured insets.
4. Bổ sung floating text handlers: extend `CombatScene.subscribeCombatEvents` (`CombatScene.ts:1342-1379`) — thêm `kill` (hiện chỉ DOM), `heal` (**phải emit event mới** — MODIFY cả core emit site), MISS/dodge ("Né!" đã có), hiệu ứng đặc biệt (buff/debuff trigger từ skill system — **chờ skill rework xong**).
5. Boss gold HP fill giữ nguyên (`CombatScene.ts:252-259`).
- **Phụ thuộc:** phần "hiệu ứng đặc biệt" nên làm SAU 4.1 (Phase 2A skill engine) vì floating text cho buff/debuff cần action/trigger vocabulary mới. Các phần HP/exit/floating-text cơ bản làm được ngay.

### 6B. Bugfix hiển thị — xử lý ĐỘC LẬP với redesign linh thảo (mục 6E)

1. **Crit Damage không hiển thị %** — stat `criticalDamage` hiển thị dạng ×1.5 thay vì %. Kiểm tra `StatLabels.ts` unit config + nơi hiển thị (CharacterPanel/tooltip). MODIFY, nhỏ.
2. **"Unidentify" Linh Thảo là bug thật** — KHÔNG phải cơ chế. Survey xác nhận: không có unidentified state nào trong code; các chuỗi "không thể xác định" chỉ là **flavor text** của lore materials (`great_dao_seed`, `thien_dia_chi_kieu` — `materials.ts:36,56`) và fallback labels (`labels.ts:14` "Dữ liệu không hợp lệ", `AlchemyView.vue:56` "Chưa xác định" grade fallback, `PillBagSection.vue:294` "Đan dược không rõ"). Repro được trong game → tìm đúng display path bị rơi vào fallback rồi sửa. (Chờ: user confirm screenshot/vị trí nếu vẫn không tìm thấy.)
3. **Hóa Luyện không hiển thị trang bị có thể hóa luyện** — root cause đã định vị (survey): filter tại `EquipmentHallPanel.vue:799-826` so dropdown "quality" (hoang..tien) với `instance.rarity` (Ngũ Phẩm) — mismatch chất vs phẩm; cộng thêm realm dropdown chỉ có 3 realm đầu. Fix: sửa filter logic + mở đủ realm list. MODIFY, vừa.

### 6C. Chiêu Hiền Quán + hệ thống nhân công (NEW building + MODIFY workers)

Công thức: **Nhân công tối đa = 1 + cấp Chiêu Hiền Quán × 2** (base 1; cấp 1 → tổng 3).

Quy tắc nhân công:
- Chỉ hoạt động sản xuất cần nhân công; **Khí Đường ngoại lệ** (không cần).
- Số nhân công **không giảm** thời gian chu kỳ.
- Sản lượng tuyến tính: **Sản lượng = Sản lượng cơ sở × Số nhân công**.
- Chia nhân công nhiều hoạt động / tập trung một hoạt động / auto-produce nếu đủ nguyên liệu + nhân công.
- Vendor hoàn toàn không liên quan nhân công.

Trạng thái hiện tại (survey):
- **Chiêu Hiền Quán: NEW hoàn toàn** (zero references).
- Workers hiện tại: global pool `autoWorkerCapacity = buildingLevel × workersPerLevel` (`GameManager.ts:2323-2333`), phân bổ round-robin, mỗi slot = 1 cycle song song (`ProductionSystem.tickWorkers:298-328`) — nghĩa là hiện tại workers ≈ parallel throughput, không đụng cycle time (khớp tinh thần "không giảm cycle time" nhưng chưa khớp công thức nguồn = 1 + level×2).
- `gathering_outpost` "Khai Vật Đường" ĐÃ tồn tại (`buildings.ts:217-241`, workersPerLevel 1) — building tài nguyên.
- Khai Vật Đường + các công trình tài nguyên: MODIFY từ gathering_outpost.
- Linh Tuyền tồn tại (`spirit_spring`) — design mới thay bằng Chiêu Hiền Quán → cần quyết: bỏ/repurpose Linh Tuyền.

Việc cần làm:
1. NEW building `chi_hien_quan` (data + art + panel) với công thức capacity `1 + level × 2`.
2. MODIFY worker capacity source: thay `buildingLevel × workersPerLevel` của gathering_outpost bằng capacity từ Chi Hiền Quán level. Migration công thức phải giữ ý nghĩa:capacity mới ≥ capacity cũ ở cùng progression, tránh nerf âm thầm.
3. MODIFY ProductionSystem: giữ mô hình "workers = parallel slots" (đã khớp "sản lượng tuyến tính × số nhân công" vì mỗi slot chạy 1 cycle đầy đủ) — chỉ đổi nguồn capacity; verify offline settle vẫn đúng.
4. UI phân bổ: chia/nhóm nhân công per site (hiện round-robin tự động) — thêm manual assignment + auto toggle.
5. Quyết định số phận Linh Tuyền (bỏ hay giữ với vai trò khác) — cần user chốt.

### 6D. Bảng ánh xạ phẩm ↔ cảnh giới + luật sử dụng (MODIFY phần lớn, NEW enforcement)

Bảng chuẩn (10 bậc — ĐÃ khớp `PROFESSION_GRADE_BY_REALM` hiện có `ProfessionGrade.ts:38-49`):

| Phẩm | Cảnh giới |
|---|---|
| Cửu phẩm | Phàm Nhân |
| Bát phẩm | Luyện Khí |
| Thất phẩm | Trúc Cơ |
| Lục phẩm | Kim Đan |
| Ngũ phẩm | Nguyên Anh |
| Tứ phẩm | Hóa Thần |
| Tam phẩm | Luyện Hư |
| Nhị phẩm | Hợp Thể |
| Nhất phẩm | Đại Thừa |
| Tiên phẩm | Độ Kiếp |

Quy tắc: chỉ dùng vật phẩm đúng phẩm/cảnh giới hiện tại (cao hơn không dùng được, thấp hơn cũng không); đột phá phải tháo toàn bộ trang bị; sau Độ Kiếp toàn bộ vật phẩm chu kỳ cũ hết dùng; chu kỳ mới bắt đầu (chi tiết = roadmap riêng, xem 6G).

Trạng thái hiện tại (survey):
- 3 trục đang tồn tại riêng rẽ: **ItemGrade** Ngũ Phẩm (hoang/huyền/dịa/thiên/tiên — `ItemGrade.ts:7-17`, dùng làm rarity trang bị), **EquipmentQuality** 9 bậc Khí (`EquipmentQuality.ts:3-26`), **ProfessionGrade** 10 bậc Cửu→Tiên (`ProfessionGrade.ts:11-49`).
- **Chưa có enforcement equip-by-realm** — `EquipmentInstance.realmId` chỉ ghi nhận lúc drop, không gate. NEW enforcement.
- ⚠️ **Xung đột dữ liệu cần xử lý:** Tiên phẩm vừa là phẩm cảnh giới (ProfessionGrade) vừa là chất lượng cao nhất của Linh Thạch/Đan Dược (ItemGrade `tien`). Yêu cầu thiết kế: tách 2 trường riêng, ghi rõ "Phẩm cảnh giới: Tiên phẩm" ≠ "Chất lượng: Tiên phẩm".

Việc cần làm:
1. Áp bảng ánh xạ (đã có `PROFESSION_GRADE_BY_REALM`) làm luật: NEW gate `canUseItem(item, playerRealm)` — đúng phẩm mới dùng; áp cho trang bị + vật phẩm tiêu dùng.
2. NEW rule "đột phá phải tháo toàn bộ trang bị" — hook vào breakthrough flow.
3. NEW data model: tách trường `realmGrade` (phẩm cảnh giới) khỏi `quality` (chất lượng) trên item/material data; sửa toàn bộ display/UI/tooltip ghi nhãn rõ 2 khái niệm.
4. Chuẩn hóa phẩm-chất-màu: audit màu sắc hiển thị giữa 3 trục trên (ItemGrade/EquipmentQuality/ProfessionGrade) — thống nhất bộ màu, tránh 2 trục dùng cùng màu gây nhầm.
5. NEW sau Độ Kiếp: invalidate toàn bộ item chu kỳ cũ (chờ 6G).

### 6E. Linh Mộc trong luyện đan (đa phần EXISTS — chỉ MODIFY nhỏ)

Yêu cầu: Linh Mộc là nhiên liệu; 1 lượt luyện đan = Linh Thảo (chính) + Linh Mộc (nhiên liệu) + nguyên liệu khác; **tất cả cùng phẩm, cùng chất** (VD: Vạn Niên Linh Thảo + Vạn Niên Linh Mộc → Cực Phẩm Linh Đan).

Trạng thái hiện tại (survey): **fuel wood ĐÃ tồn tại** — `AlchemyRecipe.fuelWoodRealmId/fuelWoodAmount` + `resolveFuelWood` (`AlchemySystem.ts:150-182`, quality wood `<realm>_wood_<quality>` cho realm 4+). Herb age axis (`years` 10/100/1000/10000) + `profession.age` decade→myriad_year đã có. **Gap:** chưa có rule ép fuel cùng chất với herb.

Việc cần làm:
1. MODIFY `resolveFuelWood`: ép fuel wood cùng chất (age/quality) với herb được chọn — không còn "cheapest-first" tự do.
2. MODIFY recipe validation + UI hiển thị nhiên liệu yêu cầu (hiện ẩn resolve logic).
3. Kiểm tra "Cực Phẩm Linh Đan" — tên/khái niệm pill-tier cao nhất theo age; điều chỉnh `PillFamilies` nếu cần.
- Không NEW hệ thống nào — chỉ siết rule.

### 6F. Cân bằng thu thập–tiêu thụ (NEW methodology + NEW simulation check)

Nguyên tắc (khóa từ design direction):
- Cân bằng theo **từng chuỗi** nguyên liệu → công thức/công trình: `Tốc độ sản xuất nguyên liệu ≤ Tốc độ tiêu thụ nguyên liệu` (tính trên 1 nhân công mỗi bên, cùng phẩm, cùng chất, không bonus).
- Kiểm tra nền kinh tế tổng thể bằng mô phỏng là bước xác nhận cuối, **không thay thế** cân bằng từng chuỗi.
- Phân bổ nhân công là lựa chọn người chơi: dư/thiếu do phân bổ ≠ lỗi cân bằng.

Việc cần làm:
1. NEW: bảng tốc độ chuẩn (per-worker, per-quality) cho mọi source (Khai Vật Đường sites) và sink (recipes/buildings) — tài liệu + data-driven constants.
2. MODIFY `ProductionBalance` + `AlchemySystem` timing: điều chỉnh cycle-time/yield để thỏa bất đẳng thức ở mỗi chuỗi cốt lõi (Linh Thảo→Đan, Linh Mộc→nhiên liệu, ore→Khí Đường).
3. NEW vitest simulation: mô phỏng 24h idle mỗi chuỗi (1 worker mỗi bên) assert sản xuất ≤ tiêu thụ — biến thành test vĩnh viễn chống regression khi tune.
4. Lưu ý: các chuỗi qua **Vendor** không tính (vendor không liên quan nhân công — 6G).

### 6G. Vendor redesign (MODIFY lớn)

Yêu cầu: chỉ còn 2 chức năng:
- **Thu mua:** chỉ mua vật phẩm phẩm THẤP HƠN cảnh giới hiện tại (không mua cùng phẩm/cao hơn); thanh toán Linh Thạch; **bỏ cơ chế quy đổi/nâng phẩm**.
- **Cửa hàng:** bán vật phẩm đặc biệt/VIP; không bán/thuê nhân công; dùng tiền cao cấp riêng (không Linh Thạch); UI như cửa hàng thật (danh sách, giá, số dư, giới hạn mua, thông tin vật phẩm).

Trạng thái hiện tại (survey): VendorPanel có 3 chức năng — Linh Thạch Đổi Phẩm (100:1, `SpiritStoneMaterial.ts:70`), Linh Mộc/Khoáng Đổi Phẩm theo cảnh giới (`MaterialTierConversionBalance.ts:9`), Hóa Bán materials (`GameManager.ts:1752-1800`). **Không có "mua" và không có generic nâng phẩm.**

Việc cần làm:
1. REMOVE 2 cơ chế đổi phẩm (spirit-stone conversion + material tier conversion) — xóa UI + core + balance files.
2. MODIFY Hóa Bán → "Thu mua" với gate phẩm: chỉ bán được item phẩm < phẩm cảnh giới hiện tại (dùng bảng 6D).
3. NEW "Cửa hàng" tab: data catalog hàng VIP + currency riêng — **phụ thuộc thiết kế tiền VIP (6H), làm sau**.
4. UI rebuild VendorPanel: 2 tab [Thu mua | Cửa hàng], format theo spec UI cửa hàng.
- Thứ tự: làm (1)(2)(4-tab-1) trước, (3) chờ 6H.

### 6H. Roadmap tương lai — CHƯA khóa thiết kế (chỉ ghi nhận, không ảnh hưởng scope trước mắt)

- **Tiền VIP:** tên gọi, cách kiếm, có mua bằng tiền thật không, có nhận từ sự kiện/thành tựu không, giới hạn + nguyên tắc chống pay-to-win. → mở khóa khi thiết kế Shop VIP (mục Cửa hàng 6G-3).
- **Chu kỳ tu luyện mới sau Độ Kiếp:** hiện progression chỉ thiết kế tới Trúc Cơ 18 (`realm.ts:36-40`), Kim Đan→Độ Kiếp là placeholder data, không có prestige/rebirth code nào. Thiết kế chu kỳ mới = hệ thống khởi động lại phẩm/công trình/vật phẩm sau Độ Kiếp (khớp quy tắc 6D "sau Độ Kiếp vật phẩm chu kỳ cũ vô dụng").

### Phân giai đoạn thực hiện (từ design direction, điều chỉnh theo phụ thuộc thực tế)

**Giai đoạn nền tảng (làm ngay — không phụ thuộc skill rework):**
1. 6B: 3 bugfix hiển thị (crit %, unidentify, hóa luyện filter).
2. 6D-1..4: chuẩn hóa phẩm/chất/màu + áp bảng ánh xạ + luật dùng đúng phẩm (phần enforcement item-use).
3. 6A: Combat Scene UI redesign (HP vào background, exit button, bỏ bottom bars, floating text cho damage/crit/miss/dodge/heal/kill — trừ "hiệu ứng đặc biệt").

**Giai đoạn sản xuất (sau nền tảng):**
4. 6C: Chiêu Hiền Quán + công thức nhân công + phân bổ + auto-produce; quyết số phận Linh Tuyền.
5. 6E: siết rule nhiên liệu cùng phẩm-chất.
6. 6F: cân bằng từng chuỗi + simulation test.

**Giai đoạn kinh tế (sau sản xuất):**
7. 6G-1,2,4: bỏ quy đổi, thu mua theo phẩm, UI thu mua. (Cửa hàng VIP chờ 6H.)

**Tương lai (chưa khóa):**
8. 6H: tiền VIP + Shop VIP + chu kỳ sau Độ Kiếp.

**Phụ thuộc chéo cần lưu:**
- 6D (bảng phẩm) là input cho 6G-2 (gate thu mua) — làm 6D trước.
- 6C (nhân công) là input cho 6F (cân bằng per-worker) — làm 6C trước.
- 6A "hiệu ứng đặc biệt" floating text + mọi đụng `core/skill/**` — làm SAU 4.1 Phase 2A (trong cùng chuỗi thực thi).
- 6D-3 (tách 2 trường phẩm/quality) có thể đụng materials/equipment data files đang được audit-fixes worktree chạm (materials.ts, EquipmentBag) — integrate audit-fixes (1.3a) TRƯỚC khi làm 6D-3 tránh conflict.

---

## 7. Kỹ thuật nợ nhỏ (nếu tiện tay)

- **Chunk size warning:** build bundle 2.17MB (> 500KB) — cân nhắc code-split bằng dynamic import cho Phaser + locales.
- **`_meta` block** trong vi/en.json không được tham chiếu — hoặc dùng (để version/parity check) hoặc bỏ.
- **termGlossary chưa được consume** — các component chưa import `TERMS`; locale values phải tự đồng bộ tay. Khi sửa terminology lần sau, cân nhắc route qua glossary.
- **Known flaky tests** (đều pass standalone, fail dưới load full-suite): `Playtest.continuousCombat` (timeout 5s), `dongFuBuildingAssets` (asset bounds, ~5s). Cân nhắc nâng timeout hoặc tách khỏi full-suite mặc định.

---

## Thứ tự đề xuất

1. **Cứu work đang treo:** 1.3a (hoàn tất audit-fixes — review + commit + integrate; 42 files verified work, và là tiền đề cho 6D-3) → 1.3b/1.3c (dọn 4 worktree còn lại).
2. **Dọn nhà:** 1.2 (commit docs + dọn stash) → 1.1 (MainMenu e2e blocker).
3. **Game design — nền tảng (song song được với luồng 1-2):** 6B-1..3 (3 bugfix hiển thị) → 6D (bảng phẩm + enforcement + tách trường) → 6A (Combat Scene UI).
4. **Skill engine:** 4.1 Phase 2A (plan đã viết, 2320 dòng — thực thi bằng subagent-driven-development như các plan trước) → sau đó 6A-4 "hiệu ứng đặc biệt" floating text.
5. **Kế tiếp:** 2.1-2.6 (i18n leftovers) → 6C (Chiêu Hiền Quán + nhân công) → 6E (nhiên liệu cùng phẩm) → 6F (cân bằng chuỗi).
6. **Giai đoạn kinh tế:** 6G-1,2,4 (Vendor thu mua + bỏ quy đổi). Shop VIP (6G-3) chờ 6H.
7. **Song song/khi có data playtest:** 3.1 → 3.3 → 3.2 → các mục 3.x còn lại.
8. **Trước khi ra production:** 4.2 online foundation (13 tasks, cần Supabase local setup trước; Task 8 sẽ thay thế MainMenu tạm thời — khi đó xóa e2e MainMenu tạm) → 6H (tiền VIP + chu kỳ sau Độ Kiếp) → 4.3 (Adversarial QA) áp dụng như quy trình thường xuyên.

---

## Todolist thực thi (theo thứ tự — tick khi xong)

> Mỗi mục: việc → verify. Quy ước verify chuẩn: `npm.cmd run type-check` + vitest liên quan (full suite cho việc lớn) + `npm.cmd run build` khi đụng production code. Commit sau mỗi việc, KHÔNG push/merge nếu không có lệnh.

### Giai đoạn 0 — Cứu work đang treo — ✅ TOÀN BỘ XONG (2026-09-01/02)
- [x] **T0.1-T0.4** audit-fixes 15 tasks — merged `6995cf9` (review + commit + integrate + docs)
- [x] **T0.5** dong-fu-buildings-style-redesign — merged `eaa9719`
- [x] **T0.6** 4 worktree nhỏ — dọn xong (simplify-agent-rules discard; adversarial-qa trùng master; fix-decimal-format duplicate; material-names merged `a68f641`)

### Giai đoạn 1 — Dọn nhà — ✅ XONG
- [x] **T1.1** Untracked docs committed (vào merge `a68f641`)
- [x] **T1.2** Skills cleanup committed
- [x] **T1.3** 4 stashes — 1 apply (columnWidth `fd68a0e`), 3 drop (dead-end WIP)
- [x] **T1.4** MainMenu e2e blocker — `306d898` (auth-first flow, 6/6 e2e xanh; fix tạm — WelcomeAuthScreen thay thế ở T6.1 Task 8)

### Giai đoạn 2 — Game design nền tảng — ✅ XONG
- [x] **T2.1** Crit Damage % — `8981772` + SYSTEM/DISPLAY boundary `0fcb17e`
- [x] **T2.2** Unidentify Linh Thảo — HỦY (production rework sẽ đào thải; user quyết 2026-09-01)
- [x] **T2.3** Hóa Luyện filter chất/phẩm tách 2 trục + 10 realms — `14cfda0` + grid pagination `abc82be`
- [x] **T2.4-T2.7** → THAY BẰNG item-grade rework (spec riêng `2026-09-01-item-grade-quality-model-design.md`): 2 trục grade/quality + canUseItem gate + tách trường — Phase 1-4 core merged `fd82ed4` (T1-9+12) + `3c898b0` (T10 enhance/pity) + `3647cf7` (Phase 4 Decompose tab). CÒN: Task 16-23 (equip gate + breakthrough unequip + panel tách + theme + dọn chết) — Phase 5-6 của plan rework
- [x] **T2.8-T2.10** Combat Scene UI — merged `71357a1` (6A plan: PlayerHudLayer in-canvas, 3 bar DOM xóa, kill/heal floating text)
  - ⚠️ Kiếm Ý/Thế bar chưa có data event (defer — cần emit từ BattleSystem, ghi trong commit a7bb7a0)

### Giai đoạn 3 — Skill engine — ✅ XONG (2026-09-02)
- [x] **T3.1** Phase 2A merged `a47d129` (10 actions + 7 triggers; usage guide Task 13 hoàn tất)
- [x] **T3.2** Floating "hiệu ứng đặc biệt" — kênh có sẵn (action_impact + status_vfx → vfxSpawner); buff-system merge `f63bd06` khép kín chuỗi
- [x] **T3.3** Merge unified-buff worktree — merged `f63bd06` (7 conflicts + 2 semantic T5.4 fixes: armor realmIndex vào BuffSystem, powerScalingRatio 1.0; re-verified 1993 tests + build + e2e; QA report `game/docs/qa/2026-09-02-unified-buff-quick.md`)

### Giai đoạn 4 — Sản xuất + kinh tế
- [ ] **T4.1** ⬜ i18n leftovers (v11 migration chưa — vẫn 9.14.5; extract sót; SkillResourceStatLabels formatStat; CombatStatusBar fallback; locale-coupled tests; parity lint test)
- [ ] **T4.2** ⬜ Chiêu Hiền Quán (NEW building + `1 + cấp×2`; đổi nguồn worker capacity — DecomposeSystem đã nhận capacity qua constructor, chỉ cần swap nguồn)
- [ ] **T4.3** ⬜ UI phân bổ nhân công per-site + auto toggle
- [ ] **T4.4** ⬜ Nhiên liệu luyện đan cùng phẩm-chất (`resolveFuelWood` bỏ cheapest-first)
- [ ] **T4.5** ⬜ Bảng tốc độ chuẩn per-worker/per-quality
- [ ] **T4.6** ⬜ Simulation test 24h idle (sản xuất ≤ tiêu thụ)
- [ ] **T4.7-T4.9** ⬜ Vendor rework (bỏ quy đổi, gate thu mua theo phẩm, 2-tab UI)

### Giai đoạn 5 — Balance — ✅ XONG (2026-09-01)
- [x] **T5.1** HỦY — asymmetry là design
- [x] **T5.2** `886b9b3` 11/11 tests
- [x] **T5.3** HỦY — idle game
- [x] **T5.4** Armor K theo realmIndex — merged `47042ac` (K = 50×(1+realmIndex×0.8))
- [x] **T5.5** Block base 5% + soft 75% + hard 90% + reaction full scaling — merged `47042ac`
  - ⬜ Stat cap Phàm Nhân + CDR cap — CHƯA làm (user chưa chốt; CDR hiện không có nguồn vượt 100% — cap vô hại)

### Giai đoạn 6 — Pre-production
- [ ] **T6.1** ⬜ Online foundation (plan có sẵn; prerequisite Supabase local; Task 8 thay MainMenu tạm)
- [ ] **T6.2** ⬜ Thiết kế tiền VIP → mở Shop VIP
- [ ] **T6.3** ⬜ Chu kỳ sau Độ Kiếp (prestige)
- [x] **T6.4** Bundle code-split — `af88cee` (entry 2231→848KB + phaser chunk riêng + contract test)
- [x] **T6.5** Adversarial QA — skill có sẵn, dùng theo AGENTS.md; quy trình thường xuyên khi feature xong

### Giai đoạn 7 — Item rework Phase 5-6 (CÒN TỪ PLAN REWORK)
- [ ] **T16** ⬜ Equip gate ngang phẩm (`canUseItemGrade` vào `EquipmentSystem.equip` — reason `grade_mismatch`)
- [ ] **T17** ⬜ Breakthrough unequip toàn bộ + warning UI
- [ ] **T18** ⬜ Phase 5 gate (type-check + full + build + e2e)
- [ ] **T19** ⬜ Tách EquipmentHallPanel thành 5 tab children (extract EnhanceTab/WashTab/RefineTab/DissolveTab)
- [ ] **T20** ⬜ Theme 10-rank màu + dọn biến chết + pity UI keys (deferred Task 10 review)
- [ ] **T21** ⬜ Terminology sweep (locale/tooltip/naming + enhance-row tooltip fix từ Task 10 review)
- [ ] **T22** ⬜ Xóa file legacy (ItemGrade/EquipmentQuality/EquipmentRarity/ItemGradeRefs shim) + dead-reference contract test + dọn patch scripts
- [ ] **T23** ⬜ Final full verify + ROADMAP update
