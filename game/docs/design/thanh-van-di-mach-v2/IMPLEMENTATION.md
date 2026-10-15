# Thanh Vân Dị Mạch V2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkboxes for tracking. **Không tự commit/push/merge**; chỉ thực hiện sau khi người dùng yêu cầu. **Không xóa file nào** khi chưa có ủy quyền riêng.

**Goal:** Chuyển 21 chính tuyến (7 Phàm +7 Luyện Khí +7 Trúc Cơ), 25 thành tựu, 7 mẫu daily và 7 mẫu weekly thành nội dung thật, đảm bảo nguồn sự kiện đúng chủ, thưởng idempotent, tiến độ bền vững và panel có thể chơi.

**Architecture:** Quest domain lưu định nghĩa/tiến độ/claim, gameplay owner xác nhận kết quả thông qua event receipt bền vững, `GameManagerQuestOps` phối hợp, UI chỉ query model/issue command. Time authority gán kỳ tuần/ngày, achievement owner giữ ledger riêng, tất cả rewards qua một reward owner; không phát sinh hành vi gameplay từ việc mở panel.

**Tech Stack:** Vue 3, TypeScript, Pinia, Vite, Phaser, Vitest, Playwright; game root `E:/tutienidle/game`.

**Spec:** [README.md](README.md), [ACT-I-MORTAL.md](ACT-I-MORTAL.md), [ACT-II-QI.md](ACT-II-QI.md), [ACT-III-FOUNDATION.md](ACT-III-FOUNDATION.md), [ACHIEVEMENTS-DAILY-WEEKLY.md](ACHIEVEMENTS-DAILY-WEEKLY.md).

**Snapshot:** `master` HEAD `e894af77b` (2026-10-14), **nhiều thay đổi chưa commit** (trong đó có Quest UI). Spec là bản thiết kế dựa trên snapshot này. Mọi implementer **phải kiểm lại HEAD/status**; không sao chép/ghi đè phần UI đang được người khác sửa. Tài liệu V1 tại `../thanh-van-di-mach/` vẫn là lịch sử, không sửa/xóa nó. Đây là kế hoạch nhiều PR, **không phải một yêu cầu gộp vào master**.

## Global Constraints

- **G0/G1 trước mọi code:** `AGENTS.md`, `game/docs/architecture/architecture-worker-workflow.md`, roadmap Phase R8.1, QA protocol canonical (`game/docs/qa/protocol/README.md`), thực tế HEAD/worktree, owner + consumer census. Chỉ ghi PASS khi có evidence; không coi spec là runtime.
- Mỗi PR làm trong worktree `.agent-worktrees/<kebab-task>`, tên branch `codex/<task>` mặc định; worker không sửa ngoài worktree, **không xóa** file; không tự commit/push/deploy. Phát hiện dirty overlaps → dừng chỉnh file giao thoa, bàn giao evidence.
- P3: thay đổi domain nhỏ chạy `npm run type-check` và `npx vitest run <scope>`; đổi architecture/shared state/save/router/Phaser hoặc trước release chạy `npm run verify` trong `game/`. P18 `ocr delegate`, P13/P14 Playwright nếu UI/wiring, P4 QA adversarial, P5 ít nhất 3 lượt review **tuần tự theo resulting state**, và QA internal fixed-point protocol là authority kết luận.
- Quest mainline là content `once`, không khóa tiến trình đột phá của game; không tiêu hao material đối với objective `acquire`. Existing `collect` vẫn có **turn-in semantics** đến khi migration được thực hiện tường minh; không silently đổi toàn bộ quest cũ.
- Đồng bộ item với bag `delivered`; không đếm overflow, preview, UI open, craft fail, battle loss cho `stage_clear`, replay receipt, hay tự khôi phục quest bằng query. Reconcile là **command** tại boot/restore/level/period, query hiển thị **pure**.
- Realm factor stone/cultivation chỉ **Phàm ×1 / Luyện Khí ×8 / Trúc Cơ ×50** qua chung hàm reward; insight/item không nhân. Freeze realm band trên recurring assignment; achievement dùng realm của **ID thành tựu**, meta là thưởng cố định. Không cho UI tự tính lại economy.
- i18n phải qua gateway, source comments ASCII English, type strict no `any` không cần thiết; no extra unlock ngoài beta Hỏa, không chạm Kim Đan, Special/Ultimate hay token/gacha.

## G0 task card — áp dụng cho toàn bộ chương trình

| Trường | Ràng buộc / chứng cứ nguồn |
| --- | --- |
| Task / scope | Thiết kế+triển khai độc lập từng capability liên quan quest; **hiện tại chỉ viết tài liệu**, implementation ở PR tương lai. |
| Worktree / branch | Planning: `E:/tutienidle` `master` e894af77b; implementation: tạo **worktree mới trên baseline sạch và được ủy quyền**. |
| Observable | Mỗi quest hiện 2–3 vế riêng, làm đủ mới claim một lần; đạt realm/stage từ trước không kẹt; 3 daily/weekly hợp lệ gán ổn định, quota 2; 25 achievements idempotent. |
| Responsibility | `QuestSystem`/`QuestManager`: tiến độ/claim; domain sources: kết quả; `RewardSystem`: grant; recurring scheduler: period assignment; achievement subsystem: lifetime ledger; `betaScopeQuestDomain`: pure UI projection. |
| Current owner/call chain | `GameManager` → `GameManagerQuestOps` → `QuestSystem/QuestManager` → `RewardSystem` / material/pill bags; `BattleLootSystem` defeat/material hook; `GameManagerBattleRewardOps` stage clear → PlayerData; `GameManagerTickOps` daily tick; `GameManagerSaveRestore` + `SaveSystem` snapshots. |
| Missing capability | Multiobjective `allOf`, non-turn-in acquire, durable typed receipts, stage/battle/production/technique/body/formation witnesses, lifetime achievements, weekly assignment, period claim, multi-progress read-model, beta release gate. |
| Persist/reset | Quest progress & completedOnceIds via `QuestManagerState` → save; player durable stage data; recurring assignment/quota and achievement ledger need new versioned save slices, replace-on-restore, dedup/stale handling. Không được tự đoán có server checkpoint nếu chưa audit. |
| Scope exclusions | Không đổi chiến đấu/realm formulas, không thay logic companion mailbox, không tự phát vật phẩm, không làm content sau Trúc Cơ, không sửa V1 hay UI đang có từ agent khác. |
| Stop/replan | Chạm dirty file người khác; nguồn vật liệu/recipe/item/companion không tồn tại; event không có định danh durable; nguồn đồng hồ không đủ cho cam kết an toàn; economy/softlock không thể chứng minh. |

## G1 — câu hỏi quyết định và chứng cứ hiện tại

| Q | Hiện trạng → quyết định cho implementer |
| --- | --- |
| Q1 | `Quest.ts` đang chỉ đơn mục tiêu; mục tiêu V2 `allOf` có progress từng leaf và failed claim phải atomic; kiểm thử [B1–B3]. |
| Q2 | Quest outcome/claim trong `QuestSystem`; RewardSystem cấp thưởng, gameplay owner quyết định sự kiện thành công. Không chuyển quyền cho Vue. |
| Q3 | `QuestManagerState` giữ active/completed/daily stamp; bổ sung ledger theo identity+period có save/replace/reset rõ, không nhân đôi cache chủ. |
| Q4 | `GameManagerQuestOps` cấp query/claim, `GameManagerTickOps` lifecycle, `GameManagerSaveRestore` restore; phải kiểm tra wiring từ runtime UI. |
| Q5 | Reuse `QuestRegistry`, `QuestSystem`, material landing funnel và `GameClock.utcDayBucket`/`TimeAuthority`; receipt mới chỉ đưa vào nếu có producer+consumer thật. |
| Q6 | Contracts định nghĩa tại `core/quest`/primitive thấp; gameplay không import Vue/Phaser; format data riêng ở `data/quest`. |
| Q7 | Period do TimeAuthority, combat result do battle owner, presentation chỉ hiển thị/nhận click. |
| Q8 | Điều tra tất cả consumers khi thay `QuestCondition`, `QuestCadence`, `QuestProgress`, `BetaQuestSurfaceModel`, save validator và localization. |
| Q9 | `getActiveQuests` và `getBetaQuestSurfaceModels` **đã** là read-only theo R8.1; extend không có `ensureActive()` khi render. |
| Q10 | Mọi receipt/claim có dedupe/idempotency; event ngoài kỳ bị bác; restore/failed grant không hồi thưởng; duplicate stage win không cộng lại. |
| Q11 | Existing `collect` turn-in, 15 quests và daily tắt phải được giữ/đi qua cutover có điều kiện; old saves có active V1 cần chính sách riêng. |
| Q12 | Mỗi slice có tests + P3/P18/P13/P14/P4/P5 và QA fixed-point ledger; docs/plan hiện **chưa chạy** runtime/QA. |

## Bản đồ consumers và trách nhiệm cần audit lại trước khi sửa

| Domain / mutation | Nguồn/cổng hiện hữu | Chỗ tiếp nhận hoặc lưu | Mở rộng dự kiến |
| --- | --- | --- | --- |
| Quest definitions, count/claim | `src/core/quest/{Quest.ts,QuestRegistry.ts,QuestManager.ts,QuestSystem.ts,QuestProgress.ts}` | `src/core/game/GameManagerQuestOps.ts` | objective AST `allOf`, separate per-leaf counters, non-turn-in `acquire`, precise reason + receipt identity |
| Reward & preview | `src/core/quest/QuestSystem.ts:scaleQuestRewardByRealm`, `src/core/reward/RewardSystem.ts` | `src/core/betaScopeQuestDomain.ts`, `src/components/scenes/quest/detail/QuestRewardRow.vue` | common frozen-band resolver and atomic reward claimant |
| Loot/material | `src/core/game/BattleLootSystem.ts`, `GameManagerQuestOps.notifyMaterialGained` | MaterialBag, `QuestSystem.onMaterialCollected` | actual `delivered`, source/batch ID and once receipt |
| Battle end/stage | `src/core/game/GameManagerBattleRewardOps.ts` | PlayerData.completedStageIds, QuestSystem kill hook | stage clear distinct from enemy defeat, one battle ID + optional formation snapshot |
| Period/lifecycle | `src/core/idle/{GameClock.ts,TimeAuthority.ts}`, `src/core/game/GameManagerTickOps.ts` | QuestManager current daily reset, release predicate `src/core/betaScope.ts` | UTC assignment + weekly, quota and clock trust |
| Save/restore | `src/services/save/{saveTypes.ts,SaveSystem.ts}`, `src/core/game/GameManagerSaveRestore.ts` | QuestManager restore, game save validation tests | versioned quest/achievement/period slices, monotonic receipts, consistency on repeat restore |
| UI | `src/components/panels/QuestPanel.vue`, `src/components/scenes/quest/{QuestScene.vue,list/QuestRow.vue,detail/QuestObjectiveList.vue,detail/QuestProgressMeter.vue,tabs/QuestGroupTabs.vue}` | `src/core/betaScopeQuestDomain.ts`, `src/presentation/questUi.ts` | multiobjective list + tabs + achievements, all i18n keys |
| Content | `src/data/quest/quests.ts`, `src/data/stage/Stages.ts` | QuestRegistry/Level progression | V2 IDs/additive migration, catalog source proof |

## Implementation slices — mỗi slice là 1 PR riêng, từng PR phải test độc lập

### S0. Kiểm nguồn nội dung & quyết định release (read-only)

- [ ] Tạo worktree audit, ghi `git status --short`, `HEAD`, khảo sát roster enemy/items/stages hiện dùng, recipe/faucet ở từng realm, nhịp tài nguyên/giá, nguồn trang bị Luyện Khí/Phàm.
- [ ] Chứng minh **mọi beta account** có nguồn đồng hành qua mailbox hoặc cho quyết định thay Q17/Q18/Q20/Q21; nếu không chứng minh: status **BLOCKED CONTENT**, không tự tạo quà từ quest.
- [ ] Mở ma trận 21 quest × từng objective: producer, owner, gate, ước thời gian kiếm vật liệu, success/failure/rollback; đối chiếu đúng ID có thật. Flag thiếu producer hoặc target unobtainable.
- [ ] Chốt lựa chọn `acquire` giữ vật phẩm; mốc realm/technique đã đạt; stage clear hồi chiếu. Chốt strategy chuyển 15 quest cũ/old saves (additive V2 IDs hoặc snapshot migration, **không** tự duplicate rewards).
- [ ] Deliverable: `source-proof.md`, `economy-simulation.md`, `release-blockers.md` trong worktree của slice; **không claim một feature code đã hoàn tất**.

### S1. Quest objective engine và claim đúng semantics (domain-only)

**Files:** `src/core/quest/{Quest.ts,QuestProgress.ts,QuestManager.ts,QuestSystem.ts}`, `src/core/betaScopeQuestDomain.ts`; tests ở `src/core/quest/*.test.ts` và `src/core/betaScopeQuestDomain.test.ts`.

- [ ] Viết failing tests: 2/3 leaf done không claim; 3/3 claim once; legacy `collect` vẫn cần nộp vật phẩm; **new `acquire`** không trừ túi; duplicate event, stale events, reset/save/restore.
- [ ] Định nghĩa discriminated union (`allOf` với leaf IDs stable, targets, semantics event vs state) và per-leaf `progress[objectiveId]`, versioned serialized state; không nhồi mọi rule vào một `flag` magic string.
- [ ] `reconcileActiveQuests` chỉ giải state/milestone witness tại lifecycle command; `get...()` không mutate. Claim validates toàn bộ vế và current eligibility, grants once/reports Vietnamese reason code.
- [ ] Mở rộng pure projection trả 2–3 rows/progress, `claim`/reward view từ owner. Giữ backward compatibility cho V1 fixtures/consumers, ghi policy migration.
- [ ] P3 quick, OCR, QA/3 sequential passes trong slice; stop nếu claim nửa vời hoặc collector vô tình turn-in acquire.

### S2. Typed gameplay receipt & dedupe foundation

**Files:** tạo primitives ở `src/core/quest/` hoặc domain foundation tùy G1; mutate `QuestSystem`, `QuestManager`; save schema dùng contract mới.

- [ ] Viết tests eventId trùng/quantity=0/NaN/stale session/repeated offline settle; cùng receipt hợp lệ cấp progress cho **nhiều objective** nhưng chỉ một lần cho mỗi objective.
- [ ] Dự kiến contract `ProgressReceipt { eventId:string; playerId:string; kind:union; sourceId:string; committedAtMs:number; units:number; payload:typed; }`; **eventId phải từ owner**, không generate từ UI/bằng thời gian nhận; restore preserves high-water or bounded dedupe ledger across window.
- [ ] Với state evidence, dùng durable state snapshot + source realm owner (lifecycle only); never fake an event. Với battle/formation snapshot, capture at authoritative battle start and bind to resolved battle ID.
- [ ] Test identity collision giữa restart/offline/cache/multi-tab. Nếu không có reliable event identity, **block wiring** thay vì cấp credit bằng best-effort counter.

### S3. Hệ nguồn chứng từ (chia 4 PR nhỏ, thực hiện tuần tự theo producer)

**S3a. Vật liệu / sản xuất:** `GameManagerQuestOps`, `BattleLootSystem`, producer của production batch; phát material-delivery receipt sau khi vào túi, batch ID distinct, kiểm `delivered` và oversize/overflow. Test offline settlement, duplicate callback, material thưởng từ quest không tự tạo vòng hoàn thành lại chính quest.

**S3b. Combat / stage:** `GameManagerBattleRewardOps` và battle owner phát `enemy_defeated`, `battle_victory`, `stage_clear` theo kết quả thực; eventId bind battle session, có formation snapshot at battle start, test boss chết nhưng team thua, retreat/abandon, replay, repeat-stage. Phải kiểm roadmap combat-chain trước edit.

**S3c. Realm / technique / skill / body:** domain owners phát `realm_reached`, `element_attained`, `technique_rank_milestone`, `skill_node_progress_committed`, `body_refinement_committed`, `cultivation_session_committed` khi thay đổi state thật; `rank` grade reset không làm mất historical milestone; test realm vượt từ trước, failed upgrade, cap, restore.

**S3d. Equipment / alchemy / pill / companion / formation:** reuse `alchemy.crafted` nhưng bind craftId; thêm equipment equipped/enhanced, pill use committed, companion owned, formation-assigned receipts và state witness. Audit mailbox entitlement; test remove/re-add, unusable pill, repeated mail claim, empty bag, power-up failure. Mỗi nhóm **1 PR và bộ test riêng**; không sửa owner khác trong cùng slice nếu không cần.

### S4. 21 quest chính tuyến: phân thành 3 PR nội dung

- [ ] **S4a — Phàm Nhân V2-01..07:** đăng ký 7 defs từ [ACT-I](ACT-I-MORTAL.md), ids `tvdm2_main_01..07`, quest chain, 2 goals với CTA; test 7 individual completions, gỗ/quặng khởi tạo không credit, boss `mortal_dong_10` must win, 170 stone/390 cultivation tổng.
- [ ] **S4b — Luyện Khí V2-08..14:** ids `08..14`; admitted only after `qi_refining` realm but older Phàm unfinished remains claimable, Hỏa beta, alchemy/technique/equipment/body/zone stage; test band ×8 và 1 pill unscaled, 2.160 stone, 2.560 cultivation, 6.800 insight tổng.
- [ ] **S4c — Trúc Cơ V2-15..21:** ids `15..21`; companion/gift release gate, formation+combat receipts, `foundation_floor_10` victory. Test band ×50, 11.500 stone, 12.500 cultivation, 37.000 insight; outcome stays Trúc Cơ, no Kim Đan jump.
- [ ] Giữ 15 quest hiện có hoặc chuyển trạng thái theo S0 cutover với user-approved migration. Phải bảo đảm character đã qua vài realm không nhận lại rewards tương đương từ **cả V1+V2** chỉ vì đổi ID; nội dung chỉ phát hành khi migration có test thực.

### S5. Achievement authority và 25 achievement rows

**Files:** tạo `src/core/achievement/` với ledger + registry + system, `src/data/achievement/` definition; composition qua GameManager read/write seam, save types/validators/tests.

- [ ] TDD achievement counter (lifetime dedup), dual-state objective, 1-time claim, reward rollback, account save/restore; tách owner lifetime khỏi `QuestManager` nếu giúp tránh overload/duplicated authority. Receipt có thể multicast từ owner, nhưng dedupe do **mỗi** consumer quản riêng.
- [ ] Author 7+7+7+4 achievement như [bảng A](ACHIEVEMENTS-DAILY-WEEKLY.md); `ach_story_thanh_van_sealed` **chính là** meta 21 claims, không tạo alias khác.
- [ ] Chỉ hồi chiếu stage clear/realm từ authoritative saved witnesses; behavior lịch sử vật liệu/kill trước khi bật không có witness thì baseline rõ trong UI, không giả đạt cột mốc.
- [ ] Test early stage clear / repeated achievement claim / stale save / simultaneously completed 2 milestones / inventory overflow / cross-realm old achievements. P3+OCR+QA/P5.

### S6. Daily + weekly scheduler, receipt window và quota

**Files:** `src/core/quest/` period assignment authority, `src/core/idle/TimeAuthority` integration, `GameManagerTickOps`, `betaScope.ts` release gate, `QuestManager`/save schema; separate tests.

- [ ] TDD UTC day rollover, Monday UTC weekly rollover, clock forward/back, offline past periods, assignment deterministic and frozen, realm transition mid-day/mid-week, 3 selected, 2 claim quota, no reroll, dead period, idempotency.
- [ ] Author daily 7 / weekly 7 templates theo [bảng B/C](ACHIEVEMENTS-DAILY-WEEKLY.md), eligibility from authoritative unlock/recipe/cap/faucet; fallback only at period assignment; no forced inaccessible task.
- [ ] TimeAuthority currently sits at `src/core/idle/TimeAuthority.ts`; **audit whether server-backed time exists before advertising anti-cheat**. Do not trust client `Date.now()` as proof. If not available, record weakened anti-clock-abuse as release decision (not fixed-point PASS for a claim requiring server time).
- [ ] Integrate `isBetaQuestEnabled`/`isBetaFeature('dailyQuest')` through **approved release switch**; preserve current disabled beta behavior until S6 acceptance. No deployment/unlock from this document.

### S7. Full Quest scene and achievement presentation

**Files:** `src/components/scenes/quest/**`, `src/components/panels/QuestPanel.vue`, `src/core/betaScopeQuestDomain.ts`, `src/presentation/questUi.ts`, relevant `locales/**` (confirm live path).

- [ ] Check ongoing dirty Quest UI work and current scene 18 fidelity contract before any edit; coordinate owner when overlap. Keep existing 3-column layout and extend data, avoid destroying current CSS/art intent.
- [ ] Build four groups/tabs `Chính Tuyến · Nhật Vụ · Tuần Vụ · Thành Tựu`; row/list + detail support multiple per-goal meters, story open/outro, disabled-reason on click, frozen rewards + period clocks, 2/2 quota, locked states, formation/companion CTA. Frontend never calls domain mutation while rendering.
- [ ] Use i18n for ALL new player-facing Vietnamese labels; one reward authority/claim reason code; responsive 1280×720 and 1672×941, keyboard/screenreader affordances and back/close flow.
- [ ] Run P13+P14 **inside same implementation worktree**: launch actual dev server, navigate to Quest scene, verify 7-quest chain, both reset boards, each goal, claim/retry, overflow, time boundary, close/reopen, screen sizes, console and screenshot evidence. No runtime proof = `QA_UNVERIFIED`.

### S8. Release QA, economy simulation, enable decision

- [ ] Run aggregate G0-G5 impact census, `npm run verify`, OCR on exact task diff, P13/P14 Playwright/E2E, adversarial QA, ≥3 **sequential resulting-state** review passes; maintain one `qa:internal` ledger, learning policy and fixed-point criteria per protocol. Independent reviewers if slots available; lack of independence noted, never forged.
- [ ] Simulate fresh account and old save through 21 quests, daily/weekly over ≥2 UTC weeks (fake clock tests only), no panel-opening dependency, early realm/stage unlock, death vs win, offline settle, race claim, repeated restore, full inventory, zero materials, companion unavailable, territory closed, boss repeated, rank grade reset.
- [ ] Confirm V2 full mainline base/effective totals **13.830 linh thạch /15.450 tu vi /43.800 lĩnh ngộ** plus one pill; achievements and recurring **separate** and capped. Validate real faucets/costs and no infinite feedback loops.
- [ ] If QA finds root-class bug, implement fix in responsible slice worktree and invalidate/re-run affected evidence; only terminal QA predicate permits `QA_FIXED_POINT_REACHED`. Explicit signoff for release-flag on, production migrations, commit/push/merge/deploy must follow user decision.

## QA cases, rejection criteria, player-story acceptance

| Case | Expected invariant / rejection if violated |
| --- | --- |
| New game with starting 15 wood/6 ore | Starting inventory credits `acquire` **0**, new delivered items count; a material delivery may progress one quest and an achievement exactly once each. |
| Already level 12/old boss cleared | Milestone recognized during lifecycle reconciliation, without touching UI; early kill/batch events do not backfill. |
| Gear swap/body upgrade/alchemy/pill | Failed operations do not count, success commits one receipt; unsatisfiable prerequisite means release blocker, not a permanent quest lock. |
| Enemy boss killed then player loses | `kill` can advance only kill objective; `stage_clear`/`battle_victory` remain 0. |
| Companion not distributed | Q17 and descendants **cannot be shipped** under current contract; switch content to approved fallback or fix verified gift distribution at legitimate owner. |
| Period expires during claim | TimeAuthority decides period, wrong-period claim denied with **no** quota/reward side effects; stale assignment can't reset via UI. |
| Save/reopen/restore twice | Identical quest/achievement/period state; no repeated grants, no regress to claimed=unclaimed, duplicate receipt idempotent. |
| Quest UI unavailable | Domain progress still moves and new quests still unlock from lifecycle command. |
| Realm changes during assigned week | Board targets + reward band frozen until next Monday UTC. |
| End Trúc Cơ | Story ends with clear `foundation_floor_10`, meta achievement eligible; no unlock Kim Đan from quest. |

## Phân công agent đề xuất khi có slot

Agent **A (quest/core/save)** phụ trách S1–S2 (tuần tự) + ledger/snapshots; Agent **B (gameplay receipts)** chia S3a–S3d theo owner, có thể fan độc lập nếu file ownership không giao nhau; Agent **C (narrative/content/balance)** S0 rồi S4a–S4c theo đúng dependencies; Agent **D (recurrence + achievement)** S5/S6, phân nhiệm vụ sau S2; Agent **E (Vue UI/UX + i18n)** S7 sau read-model contract; Agent **F (adversarial QA)** độc lập read-only, tấn công aggregate ở S8. Điều phối viên sở hữu kiểm G0/G1, ledger, aggregate diff và kết luận QA; **6 roles là cấu trúc đề xuất, không phải 6 agent đã được spawn**.

**Phụ thuộc:** `S0 → S1 → S2 → (S3a,S3b,S3c,S3d) → S4a→S4b→S4c`; `S2 → S5`; `S2+S3 + TimeAuthority → S6`; `S4+S5+S6 → S7 → S8`. Có thể kiểm từng slice độc lập nhưng release chỉ khi toàn bộ đường gameplay, save và UI chứng minh được.

## Handoff / tình trạng tài liệu

- `[DESIGNED]` 21 quest, 25 achievement, 7 daily templates, 7 weekly templates cùng công thức thưởng, narrative và edge tests.
- `[SOURCE-VERIFIED SNAPSHOT]` existing quest union đơn vế, V1 `collect` turn-in, daily beta off, stage IDs, quest reward factor, quest UI model once-only, R8.1 query purity.
- `[NOT IMPLEMENTED]` receipt/multiobjective/achievement/weekly/eligibility/UI extension; chưa chạy type-check/build/Vitest/Playwright/QA vì chỉ tạo Markdown.
- `[BLOCKED UNTIL PROVED]` đảm bảo đồng hành beta; nguồn trang bị/đan/luyện thể của mỗi realm; time trust; chuyển V1 sang V2 không duplicate rewards; tác động vào Quest UI đang dirty.

**Không có file nào bị xóa; không yêu cầu tự commit/push/merge.**
