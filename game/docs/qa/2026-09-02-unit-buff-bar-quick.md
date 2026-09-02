# QA Review: Unit Buff Bar (icon row trên sprite)

- Date: 2026-09-02
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths: 13 files, diff `661d719..HEAD` worktree `buff-bar` (6 commits) — `core/battle/BattleEvents.ts` (payload), `core/battle/BattleSystem.ts` (snapshot+emit), `data/vfx/StatusVfxPresets.ts` (presets), `game/scenes/CombatScene.ts` (wire+cleanup), `game/scenes/combat/combat-vfx-spawner.ts` (icon row), `combat-status-tooltip.ts` (mới), `combatConstants.ts`; + 6 test files.

## Scope and Risk Map

- Mapper (7 production paths): 2 domains (combat-and-tribulation, pinia-phaser-sync), `deepAuditCandidate: true` (cross-system 2 domains), unmapped: `StatusVfxPresets.ts` (data-only, route thủ công → combat presentation).
- **Escalation decision: không escalate deep.** Bounded từ code inspection:
  - Save/cloud: 0 file trong `services/**` — buff/icon ephemeral (Battle không persist), diff verify.
  - Time/offline: 0 logic thời gian mới — chỉ reused `remainingTime` snapshot đã có.
  - Economy/progression: không file nào thuộc domain; loot/reward pipeline không đổi.
  - Vue/Pinia/Phaser lifecycle: các thay đổi render nằm trong pattern lifecycle đã có (statuses Map + 2 cleanup sites đã pair subscribe/unsubscribe từ 6A); thêm `floatedStatusKeys` clear ở cả 2 sites ✓; tooltip destroy theo container lifecycle.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-BB-1 | `statuses` Map (scene) | attach→update→removed vòng đời đầy đủ | Exactly-once: 1 statusInstanceId = 1 entry; removed destroy icon+label; dedupe theo has() | Repeat (attach 2 lần cùng id) | `statusRow.test.ts` remove case + dedupe qua has check | Unit | High — cover |
| INV-BB-2 | Icon row layout | N>8 icons trong 1 hàng | Boundedness: counter "+N" ở icon cuối, icon dư ẩn — không render vô hạn | Value mutation (nhiều buff) | `statusRow.test.ts` >8 case | Unit | High — cover |
| INV-BB-3 | floatedStatusKeys | attach lặp cùng (targetId, buffId) | Exactly-once floating: 2 nguồn cùng id → 1 lần duy nhất | Repeat | `floatingStatusText.test.ts` case 2 | Unit | High — cover |
| INV-BB-4 | Tooltip lifecycle | icon bị removed khi tooltip mở | Synchronization: tooltip đóng đúng icon (hideFor), 1 active duy nhất | Reorder (removed giữa hover) | `status-tooltip.test.ts` hideFor + `statusRow.test.ts` remove→hideFor | Unit | High — cover |
| INV-BB-5 | Scene lifecycle | battle_end/shutdown giữa lúc có icons+tooltip | Recoverability: 2 cleanup sites destroy icon+stackLabel, hide tooltip, clear floated keys | Interruption | `scenes` suite 102/102 (lifecycle tests xanh) | Unit | High — cover qua regression |
| INV-BB-6 | Event payload compat | consumer cũ đọc event (không biết fields mới) | Conservation: optional fields — old consumers không vỡ | Stale state | full suite 2030 PASS + castTime/onTick/teleport regression | Unit | High — cover |
| INV-BB-7 | Permanent vs temporary tiers | onhit_* duration Infinity | Boundedness: 2 hàng riêng, permanent không timer | Value mutation (Infinity duration) | `statusRow.test.ts` permanent row case | Unit | Medium — cover |
| INV-BB-8 | setInteractive lần đầu trong game | input handler trên icon khi scene restart | Lifecycle: handler theo icon instance — destroy icon = handlers đi theo; không leak qua restart | Repeat mount/unmount | scenes lifecycle regression + manual smoke | Unit + manual | Medium — partial (không có test restart-with-icon; ghi gap) |
| INV-BB-9 | Tooltip remainingTime stale | buff decay giữa updates | Synchronization: biết lệch — limitation chốt spec §5 (≤ vài giây) | Timing boundary | spec ghi nhận; không test (bản chất visual) | Doc | Low — accepted limitation |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run src/core/battle/BattleSystem.statusVfx.test.ts` | PASS 6/6 | Buff áp qua skill scheduler (kênh production) |
| `npx vitest run src/data/vfx/StatusVfxPresets.test.ts` | PASS 8/8 | Shape taxonomy + 4 lớp fallback |
| `npx vitest run src/game/scenes/combat/combat-vfx-spawner.statusRow.test.ts` | PASS 10/10 | Row layout, tiers, overflow counter |
| `npx vitest run src/game/scenes/combat/combat-status-tooltip.test.ts` | PASS 7/7 | Tooltip lifecycle |
| `npx vitest run src/game/scenes/CombatScene.floatingStatusText.test.ts` | PASS 6/6 | First-attach dedupe |
| `npx vitest run src/game/scenes` (regression) | PASS 102/102 | Lifecycle/reward/background xanh |
| `npm.cmd run type-check` | PASS | 0 error |
| `npx vitest run` full (3 lần) | Chạy 1: 2028/2030 (2 fail); chạy 2 (json): 0 fail; chạy 3: 2030/2030 PASS | 2 fail đầu = flake pattern đã biết (roadmap §7: Playtest.continuousCombat, dongFuBuildingAssets) — Flaky label, không phải regression |
| `npm.cmd run build` | PASS | 3.97s |
| Debug session (đã xóa artifacts) | Pipeline insight: attached CHỈ phát khi buff áp trong tick | Đã chôn vào test comment — quan trọng cho maintainer |

## Findings

### QA-2026-09-02-3: Icon attach miss khi target chưa materialize

- Severity: Low
- Status: Coverage gap (đã chốt trong spec §6 — edge hiếm)
- Invariant: Exactly-once presentation
- Preconditions: buff áp tick mà sprite chưa spawn (telegraph)
- Expected: icon hiện sau khi sprite xuất hiện
- Actual: event bị skip, không có cơ chế replay — icon miss cho tới khi stack update không tạo lại (updated no-op trên entry thiếu)
- Evidence: spawner `onStatusAttached` skip khi `!spriteFor` — giữ hành vi cũ
- Test file: none — cần production hook (sprite ready tracking) mới test được; ghi nhận
- Owner subsystem: combat-vfx-spawner
- Blast radius:buff trúng target đang telegraph — trong gameplay thực các skill chỉ resolve khi target materialize; rủi ro lý thuyết

## New or Changed QA Tests

- 6 test file mới trong task implementation (đã liệt kê ở Verification) — mọi test khớp behavior thật của pipeline (kể cả pipeline note về attached-timing trong test comment).

## Gaps and Residual Risk

1. **Manual combat smoke chưa chạy** (Task 6 Step 4) — cần dev server + trận thật: icon row vị trí thực tế, tooltip hover, floating text. Unit tests mock scene không chứng minh vị trí pixel đúng. **Cần chạy trước khi merge.**
2. **INV-BB-8 (restart với icons sống)**: không có test scene restart trong khi statuses còn entries — lifecycle tests hiện không cover combo này. Risk thấp (cleanup 2 sites đều chạy), ghi gap.
3. **`setInteractive` trên scene test environment**: unit test mock không chạy input thật — Playwright/manual mới chứng minh hover hoạt động. Ghi gap.

## Pre-existing Failures

- Flake pattern: `Playtest.continuousCombat` / `dongFuBuildingAssets` — có trong roadmap mục 7, pass standalone, không phải regression của task.
