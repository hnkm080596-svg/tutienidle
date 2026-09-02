# QA Review: Unified Buff System (Buff + Ailment merge, worktree `unified-buff-system`)

- Date: 2026-09-02
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths: 86 files, tất cả trong `game/src/` — diff `6fc1a78..HEAD` (27 commits, Tasks 1–17 của plan `docs/superpowers/plans/2026-09-01-unified-buff-system.md`). Core: `core/buff/*` (new/rewrite), `core/ailment/*` + `data/ailment/*` (deleted), `core/battle/`, `core/combat/`, `core/skill/`, `core/element/`, `core/stats/`, `core/pill/`, `core/game/GameManager.ts`, `data/buff/`, `data/skill/`, `composables/useTribulation.ts`, `components/panels/bag-sections/PillBagSection.vue`, `App.vue`.

## Scope and Risk Map

- Mapper (`changed-risk-map.mjs`, 29 production paths): 6 domains, `deepAuditCandidate: true` — reasons: `critical state boundary: time-and-offline` (GameManager.ts), `shared stat pipeline` (StatCalculator.ts), `cross-system change: 6 domains`.
- **Escalation decision: không escalate sang deep.** Justification từ code inspection:
  - GameManager.ts chỉ đổi import/constructor DI (`BuffManager`→`BuffPool`, xoá `AilmentRegistry`/`registerAilments`) + `applyPersistentBuff` signature — không chạm timed-effect accrual, offline, hay save shape (`git diff 6fc1a78..HEAD --stat` cho GameManager: churn cơ học, không logic thời gian).
  - Save/cloud KHÔNG thuộc task-owned diff (0 file trong `services/save`/`services/cloudSave`); Buff/Ailment là ephemeral theo plan (`Battle.ts:118` comment xác nhận không persist).
  - StatCalculator.ts chỉ thu hẹp union `ModifierSourceType` (xoá `'ailment'`) — type-level narrowing, toàn test suite xanh.
  - `useTribulation.ts` (unmapped path) = 1 dòng: `applyPersistentBuff(KIEP_THUONG_DEBUFF, player.finalStats)` — thread real stats để duration-scaling đọc gear thật; bound được.
  - Economy/progression: không file nào trong diff thuộc domain economy; loot/reward pipeline không đổi.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-BUFF-1 | `BuffPool` per entity; key `(id, sourceId)` | 2 nguồn khác nhau áp cùng debuff id lên 1 target | Conservation/Coexistence: mỗi nguồn có instance riêng, không ghi đè | Repeat (multi-source) | `pool.getAllById(id).length === 2`, stacks độc lập | Unit (`BuffPool.test.ts`, `BuffSystem.test.ts` multi-source blocks) | High — core mục tiêu của merge; đã có test xanh |
| INV-BUFF-2 | `BuffSystem.update()` per entity pool | DoT tick mỗi frame cho MỌI instance | Exactly-once: 1 tick không double-tick 1 instance | Repeat | `applyDotDamage` call count === instance count (`BuffSystem.test.ts` 'ticks DoT damage independently per source instance') | Unit | High — đã cover |
| INV-BUFF-3 | `GameManager.buffPool` (persistent) vs `battle.playerBuffs` (per-battle) | Apply Kiếp Thương ngoài battle → vào battle | Synchronization: persistent buff hiệu lực qua `getAggregatedModifiers` → finalStats snapshot lúc startBattle (parity hành vi cũ) | Reorder (apply rồi vào trận) | `getAggregatedModifiers()` chứa modifier kiep_thuong; stats trong trận nhận qua finalStats snapshot | Unit (GameManager.*.test.ts dùng getAggregatedModifiers) | High — parity giữ nguyên, không regression |
| INV-BUFF-4 | `GameManager.tick()` → `buffSystem.update()` | Battle đang chạy + persistent pool có buff | Exactly-once: không double-tick (BattleSystem tick `battle.playerBuffs` — pool KHÁC; GameManager tick `GameManager.buffPool`) | Concurrency | 2 pool tách biet — code inspection (GameManager.ts:3274, BattleSystem.ts:1437-1457) | Static inspection | High — không có test trực tiếp phân tách 2 pool; xem Gaps |
| INV-BUFF-5 | `PillTarget.applyBuff` (PillBagSection adapter) | Dùng đan trong trận player đã chết (`battle.player.alive === false`) | Recoverability: fallback `applyPersistentBuff(definition, finalStats)` — buff không mất | Value mutation (edge) | Code inspection PillBagSection.vue:156-166 | Static | Medium |
| INV-BUFF-6 | `ReactionManager.checkAndTrigger` | Reaction do source S kích hoạt với existing buff của source KHÁC | Conservation: `existingSourceId = source.id` assumption — nếu existing thuộc nguồn khác, remove(source-khác) là no-op im lặng | Cross-source | Plan Task 12 caveat; existing test fixtures đều 1 nguồn | Unit tests hiện có (xanh nhưng không cover cross-source) | Medium — suspected, không confirm được; xem Gaps |
| INV-BUFF-7 | `BuffSystem.convert()` (Làm Chậm→Đóng Băng) | Convert đúng lúc continuousSeconds đạt ngưỡng | Atomicity: instance cũ remove + instance mới add trong 1 pass | Timing boundary | `BuffSystem.test.ts` ported convert block (3 cases) | Unit | High — đã cover (ported từ AilmentSystem.convert.test.ts) |
| INV-BUFF-8 | DoT formulas ported verbatim | Apply + tick với mọi element | Determinism/parity số: dpsRatio/multiplier không đổi | Value mutation | Parity tests poisonRoot(5)/kimThe(4)/onHitProc(8)/convert(3) ported | Unit | High — đã cover |
| INV-BUFF-9 | `game/src/data/skill/Skills.ts` — `type:'ailment'` entries rewrite | Skill cũ dùng ailmentId giờ dùng `type:'debuff', buffId` | Conservation: mọi skill vẫn áp được debuff của nó | Reorder/stale | Type-check PASS (union đóng) + full suite + e2e create-to-combat | Integration | High — đã cover |
| INV-BUFF-10 | Merge vs master (26 commits mới) | Merge worktree về master tương lai | Synchronization: semantics T5.4 (armor realmIndex, reaction realmScalar, powerScalingRatio 1.0) không mất sau merge | Stale state (semantic conflict) | `git merge-tree` dry-run: 7 conflicts | Static (merge-tree) | High — xem Findings QA-2026-09-02-2 |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm.cmd run type-check` (phiên trước) | PASS | 0 lỗi |
| `npx vitest run` full suite (phiên trước) | PASS | 275 files / 1653 tests, 0 fail, 94.47s |
| `npm.cmd run build` (phiên trước) | PASS | Build sạch 5.92s, chỉ chunk-size warning có sẵn |
| `npx playwright test tests/e2e/boot-fresh.spec.ts` | PASS | 1/1 (10.8s) — boot + guest + character creation |
| `npx playwright test tests/e2e/create-to-combat.spec.ts` | PASS | 1/1 (53.2s) — battle real-time chạy end-to-end qua BuffSystem mới, kết thúc victory/defeat modal |
| `git merge-tree --write-tree master worktree-unified-buff-system` | 7 conflicts | Dry-run không mutate; chi tiết ở Findings |
| Grep `AilmentManager\|AilmentSystem\|AilmentRegistry\|core/ailment\|data/ailment` trong `game/src` | Chỉ còn comments lịch sử | 0 import/code thực — deletion sạch |

## Findings

### QA-2026-09-02-1: ReactionManager cross-source removal — giả định "existing thuộc về reacting source"

- Severity: Medium
- Status: Suspected (static concern; không có failing reproduction — mọi test fixture hiện có đều single-source nên không thể prove lẫn disprove trong allowlist QA)
- Invariant: Conservation — reaction consume đúng instance của chủ nó
- Preconditions: Target có existing debuff do source A áp; source B (khác A) áp debuff mới kích reaction giữa 2 id đó
- Reproduction: cần test 2 nguồn khác nhau trên cùng target rồi kích reaction — không có fixture nào như vậy hiện nay
- Expected: instance bị remove là instance đã tham gia reaction (của A), hoặc hành vi được spec hoá rõ
- Actual: `ReactionManager.ts:144` `existingSourceId = source.id` (của B) → `remove(existingId, B)` là no-op, instance của A sống sót; reaction vẫn tick damage nhưng không "tiêu" nguyên liệu
- Evidence: static inspection `ReactionManager.ts:142-152`; plan Task 12 caveat đã dự đoán đúng điểm này
- Test file: none (không thể viết reproduction trong allowlist mà không kết luận được intended behavior — cần product owner quyết định semantics cross-source)
- Owner subsystem: `core/element/ReactionManager.ts`
- Blast radius: reactions trong multi-source combat (boss + adds cùng tick debuff lên player) — hiếm hiện tại vì player thường là nguồn duy nhất áp debuff

### QA-2026-09-02-2: Merge conflict với master kèm 3 semantic conflicts ẩn (T5.4 balance)

- Severity: High (đối với hành động merge tương lai; KHÔNG phải defect của worktree branch này)
- Status: Confirmed (bằng chứng trực tiếp: `git merge-tree` dry-run + diff inspection) — nhưng đây là risk của quá trình merge, không phải defect runtime của code đã verify ở trên
- Invariant: Synchronization — thay đổi cân bằng T5.4 trên master phải sống sót qua merge
- Preconditions: merge `worktree-unified-buff-system` → `master`
- Reproduction: `git merge-tree --write-tree master worktree-unified-buff-system`
- Expected: conflict được giải bằng tay + re-verify
- Actual: 7 conflicts:
  1. `game/src/App.vue` (content) — master thêm `restoreGameSession()` boot flow; worktree xoá `registerAilments(ailments)` + import ailments. Cả 2 thay đổi đều cần giữ: lấy master làm base, xoá dòng ailments.
  2. `game/src/core/ailment/AilmentSystem.ts` (modify/delete) — master sửa `getArmorMitigationPercent(target.stats.defense, target.realmIndex)` (T5.4 armor realm-scaling); worktree xoá file. **Giải: giữ deletion + PORT tham số realmIndex vào `BuffSystem.calculateDamagePerSecond()` (`getArmorMitigationPercent(target.stats.defense)` → thêm `target.realmIndex`) — không port là mất T5.4 trong DoT physical, một regression cân bằng im lặng.**
  3. `game/src/core/element/ElementReaction.ts` (content) — master: `powerScalingRatio` 0.5→1.0 (3 reactions) + BOM ký tự đầu file; worktree: `AilmentId`→`string` toàn bảng + xoá import. **Giải: lấy side worktree, áp tay 3 giá trị `powerScalingRatio: 1.0` của master, xoá BOM.**
  4. `game/src/core/element/ReactionManager.test.ts` (content) — master: T5.4 realmScalar assertions; worktree: đổi fixture BuffSystem/BuffDefinition. **Giải: kết hợp — fixture mới của worktree + thêm assertion realmScalar của master ( realmScalar 1+realmIndex×1.5 nhân baseDamage — code ReactionManager.ts đã auto-merge nên test phải khớp).**
  5. `game/src/core/element/ReactionManager.powerScaling.test.ts` (content) — tương tự 4.
  6. `game/src/core/element/ReactionManager.phanPhac.test.ts` (content) — tương tự 4.
  7. `game/src/core/skill/SkillEffectSystem.test.ts` (content) — master: 8 dòng sửa test; worktree: port case 'ailment'→'debuff'. Cần xem block cụ thể khi merge.
- Semantic conflicts ẩn KHÔNG hiện trong merge-tree (auto-merge nhưng đổi behavior):
  - **`ReactionManager.ts` auto-merged** — master thêm `realmScalar` nhân `baseDamage` (T5.4). Xanh: auto-merge này giữ được T5.4. Nhưnassert các test ported ở 4-6 đang assert số cũ → phải update theo realmScalar (đây chính là nguồn conflict 4-6).
  - **`CombatSystem.ts` auto-merged** — cần eyeball nhanh post-merge nhưng merge-tree không flag.
  - **`Armor.ts`** — master thêm `realmIndex` param (default 0). Worktree `BuffSystem.calculateDamagePerSecond()` gọi 1-arg → vẫn compile (default) nhưng bỏ qua realmIndex → mất T5.4 cho DoT physical. Cùng fix với mục 2.
- Evidence: `git merge-tree` output ở trên; `git diff 6fc1a78..master` cho từng file
- Test file: n/a (post-merge verification: full suite + focused element suites)
- Owner subsystem: merge process (người thực hiện merge)
- Blast radius: cân bằng combat T5.4 (armor scaling, reaction scaling) nếu resolve sai

## New or Changed QA Tests

- Không test mới — QA run này không viết reproduction test nào (finding 1 không xác định được intended semantics; finding 2 là merge-process risk, oracle là merge-tree dry-run đã ghi nhận).

## Gaps and Residual Risk

1. **INV-BUFF-4 (2-pool separation)**: không có unit test nào trực tiếp chứng minh GameManager.buffPool và battle.playerBuffs được tick độc lập đúng 1 lần mỗi pool. Code inspection (GameManager.ts:3268-3279 + BattleSystem.ts:1437-1457) chứng minh tách biet về cấu trúc, nhưng một regression tương lai (vd ai đó merge pool) sẽ không có test chặn. Coverage gap, medium.
2. **QA-2026-09-02-1 (cross-source reaction)**: suspected, cần product decision. Không block verdict vì: hiện tại mọi luồng gameplay player-side đều single-source (player là nguồn duy nhất); boss/adds chưa áp debuff trùng id lên player theo data hiện hành.
3. **Manual combat smoke (Task 17 Step 5)**: e2e create-to-combat chạy battle thật 53s qua toàn pipeline BuffSystem (skill → debuff → DoT → expiry), nhưng KHÔNG assert cụ thể buff icon/tooltip hiển thị hay số damage tick trong DOM/canvas. Observability không đủ để assert chính xác visual buff state qua Playwright hiện nay — chấp nhận là limitation, bù đắp bằng 1653 unit/integration tests xanh bao phủ toàn math.
4. **Post-merge verification chưa chạy** (naturally — merge chưa xảy ra): mọi evidence ở trên chỉ áp dụng cho HEAD của worktree branch. Sau khi resolve 7 conflicts + port 2 semantic fixes (armor realmIndex vào BuffSystem, powerScalingRatio 1.0 vào ElementReaction), BẮT BUỘC re-run: type-check + full vitest + build + boot-fresh e2e.

## Pre-existing Failures

- Không có. Full suite 275 files xanh ở cả 2 phiên chạy.

## Addendum (2026-09-02): Merge executed — finding 2 resolved

Merge `worktree-unified-buff-system` → `master` đã thực hiện (commit `f63bd06`), resolves cả 7 textual conflicts + 2 semantic T5.4 fixes đúng như finding QA-2026-09-02-2 khuyến nghị:

| Conflict | Resolution |
| --- | --- |
| App.vue | Master side (restoreGameSession boot flow) − `registerAilments(ailments)` + import |
| AilmentSystem.ts (modify/delete) | Giữ deletion; **port `target.realmIndex` vào `BuffSystem.calculateDamagePerSecond()`** (armor K-scaling T5.4) |
| ElementReaction.ts | Worktree side (`string` ids, không BOM) + giữ `powerScalingRatio: 1.0` của master (git auto-merge đã đúng 3/5, 2 chỗ `0.5` còn lại khớp master nên giữ nguyên) |
| ReactionManager.test.ts | Số T5.4 master (70/70/75) + biến `targetBuffs` worktree |
| ReactionManager.powerScaling.test.ts | Comment T5.4 + fixture BuffSystem; block "realm scalar" của master port khỏi fixture AilmentSystem đã xoá |
| ReactionManager.phanPhac.test.ts | Số T5.4 master (70/70/140) + biến `targetBuffs` |
| SkillEffectSystem.test.ts | Số T5.4 master (70) + `targetBuffs` + import `vi` của worktree (BOM removed) |

Post-merge verification (mới, trên merge commit `f63bd06`):
- `npm.cmd run type-check`: PASS
- `npx vitest run`: **PASS — 299 files / 1993 tests** (master's tests + worktree's tests, 0 fail)
- `npm.cmd run build`: PASS (5.90s)
- `npx playwright test tests/e2e/boot-fresh.spec.ts`: PASS (6.0s)

Verdict sau merge: PASS WITH EVIDENCE cho phạm vi merge này. Finding QA-2026-09-02-1 (cross-source reaction, Suspected) vẫn mở — là product decision, không thuộc scope merge.
