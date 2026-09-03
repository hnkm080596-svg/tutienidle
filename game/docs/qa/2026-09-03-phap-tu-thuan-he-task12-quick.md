# QA Review: Pháp Tu Thuần Hệ — merge master + Task 12 glue (chain/ult/tooltip)

- Date: 2026-09-03
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths:
  - `game/src/core/battle/BattleSystem.ts`
  - `game/src/core/battle/UltimateSystem.ts`
  - `game/src/core/battle/TheResourceSystem.ts`
  - `game/src/core/battle/HazardZoneSystem.ts`
  - `game/src/core/battle/SkillEffectResolver.ts`
  - `game/src/core/skill/SkillEffect.ts`
  - `game/src/core/skill/SkillEffectSystem.ts`
  - `game/src/core/skill/SkillRuntimeStats.ts`
  - `game/src/core/skill/SkillSystem.ts`
  - `game/src/core/skill/SkillSpecialization.ts`
  - `game/src/core/skill/SkillMechanicDescriptions.ts`
  - `game/src/core/game/GameManager.ts`
  - `game/src/core/progression/ProgressionNode.ts`
  - `game/src/data/skill/Skills.ts`
  - `game/src/data/buff/buffs.ts`
  - `game/src/data/progression/PhapTuNodes.ts`
  - `game/src/components/panels/skill-path/SkillDetailView.vue`
  - `game/src/locales/vi.json`, `game/src/locales/en.json`
  - Tests: `BattleSystem.chain.test.ts`, `UltimateSystem.phapTu.test.ts`,
    `TheResourceSystem.test.ts`, `SkillEffectSystem.thuanHe.test.ts`,
    `SkillSystem.targeting.test.ts`, `PhapTuNodes.dao.test.ts`,
    `Skills.chain.test.ts`, `buffs.test.ts`,
    `GameManager.purchaseNode.test.ts`, `GameManager.phapTuChain.test.ts`,
    `SkillMechanicDescriptions.test.ts`, `SkillDetailView.test.ts`

## Scope and Risk Map

`changed-risk-map.mjs` trả 5 domains (combat-and-tribulation,
economy-and-progression, pinia-phaser-sync, time-and-offline,
ui-input-lifecycle), `deepAuditCandidate: true`, `unmappedPaths`:
`locales/{vi,en}.json`.

**Quyết định escalation:** KHÔNG escalate deep. Lý do bound được bằng code
inspection:

- `time-and-offline` map tới vì `GameManager.ts`/`BattleSystem.ts` là
  consumer chung, nhưng diff Task 12 KHÔNG đụng accrual/offline/clock nào:
  không sửa `OfflineProgressSystem`, không sửa `tick()`/autosave, không đổi
  ownership thời gian. Thế là pool TRONG TRẬN (reset mỗi trận qua
  `playerToCombatEntity`), không persist.
- `economy-and-progression`: node `selectsSpecialization` (E-8) và
  `lap_dao_thuan` đã có test purchase/idempotency riêng
  (`GameManager.purchaseNode.test.ts`, `NodeSystem.test.ts`); Task 12 chỉ
  THÊM glue đọc node, không đổi quy tắc chi phí/prereq.
- `pinia-phaser-sync`: thay đổi Vue chỉ là `SkillDetailView.vue` render
  thêm `<ul>` thuần từ computed, không đụng ownership store/scene.
- `unmappedPaths` locales: chỉ thêm 2 key `skillResource.theGainPerLinkBonus`
  /`theMaxBonus` (label/description), được parity test
  `SkillResourceStatLabels.test.ts` + `i18n/index.test.ts` khóa — bounded.

One-hop consumers đã inspect: `KiemTuCombatHud.vue` (dùng chung
`tryPlayerUltimate` — giữ nguyên branch Kiếm Tu), `CombatBuildHud.vue`
(chọn HUD theo path), `HazardZoneSystem`/`SkillEffectResolver` (port E-1/E-2/E-5
sau merge).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-TH-1 | `BattleSystem.chain` (per-BattleSystem, set lúc start) | `startBattleWithPlayer` → `setChainDefinition(element?)` | Session-scoped: player không Thuần → chain undefined, không gate | Reorder (2 player liên tiếp, stop() giữa) | `getPhapTuThuanElement()` + cast order event | Integration `GameManager.phapTuChain.test.ts` | High |
| INV-TH-2 | `player.currentThe` (CombatEntity, per-battle) | chain link → `gainTheOnChainLink`; kill → giữ; start mới → 0 | Boundedness + no-leak: Thế không mang sang trận mới | Cross-battle reload | `battle.player.currentThe` sau start mới | Unit `BattleSystem.chain.test.ts` | High |
| INV-TH-3 | `the_man_<el>` buff (BuffPool per-battle) | Thế chạm trần → apply; ult reset → remove | Exactly-once apply; gỡ đúng khi reset; không leak qua trận | Repeat + timing boundary | `BuffSystem.getActiveIds()` | Unit `BattleSystem.chain.test.ts` + `UltimateSystem.phapTu.test.ts` | Medium |
| INV-TH-4 | `UltimateSystem` + `BattleSystem.tryPlayerUltimate` | Thế đầy + boss → auto bắn; manual → bắn | Không double-fire: ult không qua loadout scheduler (equipped:false) | Repeat (auto + manual cùng lúc) | `tryPlayerUltimate()` return + `currentThe` | Unit `BattleSystem.chain.test.ts` | High |
| INV-TH-5 | `selectPhapTuUltimateTargets` + glue `runUltimateEffects` | Kim `single_boss_priority` → chỉ 1 target | Không splash overkill (spec §3 Kim) | Value mutation (nhiều enemy, boss vs no-boss) | `runUltimateEffects` mock targets | Unit `UltimateSystem.phapTu.test.ts` | Medium |
| INV-TH-6 | `SkillEffectResolver` (merge port) | `grantsZone`/`spreadsAilmentId`/`stacksPerAffectedTarget` qua ctx mới | Backward-compat: field optional, default = hành vi cũ | Cross-system chain (E-1/E-2/E-5 sau split) | `SkillEffectSystem.thuanHe.test.ts` | Unit | High |
| INV-TH-7 | `SkillDetailView.vue` mechanic lines | skill có field engine → render dòng mô tả | Không render gì cho skill cũ (không field) | Value mutation (skill thường vs Thuần) | DOM `.skill-detail__mechanics` | Component `SkillDetailView.test.ts` | Low |
| INV-TH-8 | locale parity | thêm `theGainPerLinkBonus`/`theMaxBonus` key | Mọi SKILL_RESOURCE_STAT_KEYS có label+description vi+en | Degraded (thiếu key) | `t(key)` không trả raw key | Unit `SkillResourceStatLabels.test.ts` | Low |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm.cmd run type-check` | PASS | sạch, sau merge + Task 12 |
| `npx.cmd vitest run` (full) | PASS 2318/2318 (342 files) | sau Task 12; baseline master 2298 + 20 test mới |
| `npm.cmd run build` | PASS `✓ built in 4.73s` | production |
| `npx.cmd playwright test boot-fresh create-to-combat` | PASS 2/2 | guest không node → không chain → không vỡ |
| Code: `playerToCombatEntity` không set `currentThe` | Confirmed no-leak | Player.ts:346-418 |
| Code: `updateTheManBuff` chỉ gọi trong `advanceChainAndGainThe` | Confirmed | BattleSystem.ts:2324 |
| Code: `selectPhapTuUltimateTargets` trả `CombatEntity[]` | Confirmed type-safe glue | UltimateSystem.ts:228-229 |
| Code: `PhapTuCombatHud.vue` không có nút ult | Confirmed gap | xem QA-2026-09-03-001 |

## Findings

### QA-2026-09-03-001: Pháp Tu không có nút Ultimate thủ công trong combat HUD
- Severity: Medium
- Status: Coverage gap
- Invariant: Synchronization / spec §2.4 "nút manual riêng (CombatControlBar)"
- Preconditions: Pháp Tu đã Lập Đạo Thuần + học ult + Thế đầy, KHÔNG có boss
  trong trận (auto không bắn vì `autoPhapTuUltimateDecision` require
  `battleHasBoss`).
- Reproduction: Vào trận Pháp Tu Thuần không boss, Thế = 100. Quan sát HUD.
- Expected: Có nút bấm tay để đốt Thế nổ ult (đối xứng `KiemTuCombatHud.vue`
  có nút `tryPlayerUltimate` + toggle auto).
- Actual: `PhapTuCombatHud.vue` chỉ render 5 loadout slot + artifact slot;
  không có nút ult, không có thanh Thế, không có toggle auto. Người chơi chỉ
  nổ ult khi auto-AI thấy boss. Engine `tryPlayerUltimate()` đã hỗ trợ
  branch Pháp Tu (Task 12) nhưng UI không gọi nó cho Pháp Tu.
- Evidence: `PhapTuCombatHud.vue` (53 dòng, không tham chiếu
  `tryPlayerUltimate`/`canUsePhapTuUltimate`); `KiemTuCombatHud.vue:122` là
  consumer duy nhất gọi `tryPlayerUltimate`.
- Test file: none (thiếu UI hook để assert)
- Owner subsystem: `components/game/combat/hud/PhapTuCombatHud.vue`
- Blast radius: UX/progression — ult Pháp Tu Thuần về cơ bản chỉ kích hoạt
  auto khi có boss; không phá save/economy, không crash. Engine path đã đúng
  và đã có test; đây là thiếu surface điều khiển.
- Minimal hook đề xuất (KHÔNG làm trong QA): thêm nút ult + thanh Thế vào
  `PhapTuCombatHud.vue` gọi `gameManager.battleSystem.tryPlayerUltimate()`
  khi `canUsePhapTuUltimate(battle)`, reuse toggle `ultAutoEnabled` — cùng
  pattern `KiemTuCombatHud.vue`.

### QA-2026-09-03-002: Auto-ult Pháp Tu chỉ bắn khi có boss/Độ Kiếp
- Severity: Low
- Status: Suspected (nhất quán với spec, nhưng cần xác nhận ý đồ design)
- Invariant: đúng spec §2.4 "bắn khi có boss/Độ Kiếp trong trận VÀ Thế đầy"
- Preconditions: như trên.
- Reproduction: `autoPhapTuUltimateDecision` require `battleHasBoss(battle)`.
- Expected/Actual: Đây ĐÚNG là hành vi spec mô tả (không phải defect), nhưng
  kết hợp với QA-001 (không có nút manual) nghĩa là trong farm không boss,
  Thế tích đầy mà không bao giờ tiêu → pool "chết" vô hạn. Ghi nhận để người
  dùng quyết: hoặc thêm nút manual (QA-001), hoặc chấp nhận ult chỉ dùng khi
  boss.
- Evidence: `UltimateSystem.ts:263`.
- Test file: `UltimateSystem.phapTu.test.ts` (đã assert auto require boss).
- Owner subsystem: `core/battle/UltimateSystem.ts` (design), UI (gap).
- Blast radius: cân bằng gameplay, không phải lỗi state.

## New or Changed QA Tests

QA run này KHÔNG thêm test mới (không có Confirmed defect cần failing repro).
Toàn bộ test dưới đây là của development workflow Task 12, được dùng làm
evidence:

- `GameManager.phapTuChain.test.ts` — 5 test: chain gate session-scoped, B
  chỉ cast sau A, ult glue nổ/tiêu Thế, không Thuần → không nổ, multi-player
  clear. Chứng minh INV-TH-1/2/4.
- `BattleSystem.chain.test.ts` (mở rộng) — 4 test Task 12: manual ult resolve
  effects, Thế chưa đầy → null, auto boss, không element → null. INV-TH-4.
- `SkillMechanicDescriptions.test.ts` — 7 test helper thuần tooltip. INV-TH-7.
- `SkillDetailView.test.ts` — 4 test render mechanic lines. INV-TH-7.
- `UltimateSystem.phapTu.test.ts` (đã có) — profile single_boss_priority,
  no-splash. INV-TH-5.
- `SkillEffectSystem.thuanHe.test.ts` + `SkillEffectResolver` port — E-1/E-2/E-5
  sau merge. INV-TH-6.

## Gaps and Residual Risk

- **QA-001 (Coverage gap, Medium):** thiếu nút ult Pháp Tu trong HUD. Engine
  sẵn sàng, UI chưa nối. Không chặn verdict vì không phải defect state — là
  thiếu feature surface so với spec §2.4. Cần user quyết định phạm vi (Task 12
  plan chỉ ghi "tooltip", không ghi rõ nút ult HUD).
- **QA-002 (Suspected, Low):** tương tác QA-001 → Thế không tiêu được khi
  farm không boss. Cần xác nhận ý đồ design.
- **Không verify runtime sâu:** chưa có Playwright test cho chuỗi Pháp Tu
  Thuần end-to-end (cần save có node `lap_dao_thuan`); mới có integration
  Vitest qua GameManager. Chấp nhận vì unit+integration đã phủ oracle state.
- Locale parity: đã có test khóa, bounded.

## Pre-existing Failures

Không có. Full suite 2318/2318 xanh; build + e2e xanh.
