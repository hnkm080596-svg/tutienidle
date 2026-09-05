# QA Review: system-code-review-remediation-tasks-2-8

- Date: 2026-09-05
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `game/src/game/support/ActionImpactVfx.ts` (+ test)
  - `game/src/game/scenes/combat/combat-vfx-spawner.ts`
  - `game/src/game/scenes/CombatScene.ts` (+ `CombatScene.actionPlayback.test.ts` mới)
  - `game/src/core/game/GameManager.ts` (settleAutoFarmOffline bounded)
  - `game/src/core/game/GameManager.autoFarmOffline.test.ts`
  - `game/src/core/game/GameManager.autoFarmAdversarial.test.ts` (mới — QA)
  - `game/src/composables/useBagGridLayout.ts` (+ test mới)
  - `game/src/composables/useAppLifecycle.ts` (+ test mới)
  - `game/src/App.vue`
  - `game/src/components/settings/ThemeSwitcher.vue` (+ test)
  - `game/src/components/common/ConfirmModal.vue`, `OverlayPanel.vue` (+ `dialogLabeling.test.ts` mới)
  - `game/src/core/game/GameManager.actionPlayback.test.ts`, `game/src/core/battle/turn/TurnBattleSystem.actionPlayback.test.ts`
  - `game/src/game/scenes/combat/combatTestHarness.ts` (mới) + 12 file scene test chuyển sang harness

## Scope and Risk Map

`changed-risk-map.mjs` trả về 5 domains (combat-and-tribulation, economy-and-progression, pinia-phaser-sync, time-and-offline, ui-input-lifecycle), `deepAuditCandidate: true` (critical state boundary: time-and-offline + cross-system 5 domains). Quyết định KHÔNG escalate vì:

- Time-and-offline risk ĐÃ được chốt bằng implementation fix trong chính task này (bounded settlement, evidence timeout 300s trước fix) và adversarial checks bổ sung (rollback âm, NaN, Infinity, exactly-once per-call) đều pass — oracle rõ ràng, local, deterministic.
- Vue/Pinia/Phaser lifecycle risk được bao bởi `useAppLifecycle.test.ts` (10 test: double-start, double-boot, save-in-flight, symmetric teardown), `CombatScene.actionPlayback.test.ts` (5 test token capture-at-schedule), dialogFocus tests hiện có (26 test liên quan pass).
- 3 unmapped paths đều là test files hoặc harness — được route thủ công: `useAppLifecycle.test.ts` → ui-input-lifecycle (lifecycle invariants); test files kia không có production surface.

One-hop consumers đã kiểm tra: CombatScene event subscription symmetry (pass), SaveRestore flow (SaveSystem.bootRestore + CloudSaveCoordinator tests pass), theme store consumers (ThemeSwitcher tests pass), bag sections (169 composable/component tests pass).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
|---|---|---|---|---|---|---|---|
| INV-VFX-1 | CombatScene pendingImpact + playbackToken (GameManager) | action_impact event → spawn VFX → tween onComplete → ackActionComplete(token) | Exactly-once ack per action; stale token no-op | Repeat (double complete), Stale state (token đổi giữa chừng) | `acks` count trong bridge mock, token value | Unit (`CombatScene.actionPlayback.test.ts`) | High — cross-battle mutation chặn |
| INV-VFX-2 | CombatScene.projection null | action_impact khi projection miss | Recoverability: ack ngay fallback, engine không treo | Degraded environment | acks length = 1 ngay | Unit | Medium |
| INV-OFF-1 | GameManager.settleAutoFarmOffline + GameClock cap | restore với elapsed nhiều ngày | Boundedness: cycles ≤ cap 24h/cycleMs | Value mutation (3 ngày, Infinity) | lastCheckedMs tiến ≤ 24h | Unit (`autoFarmOffline`, `autoFarmAdversarial`) | High — economy |
| INV-OFF-2 | perfectClearSeconds malformed | cycleSeconds = 0 / NaN | Boundedness: không Infinity loops, không crash | Value mutation | không throw, finite lastCheckedMs | Unit (timeout evidence) | High — freeze |
| INV-OFF-3 | elapsed âm (clock rollback) | settle với elapsedOfflineSeconds < 0 | Monotonicity: lastCheckedMs không lùi | Value mutation | lastCheckedMs giữ nguyên | Unit | Medium |
| INV-OFF-4 | lastCheckedMs tiến | settle(elapsed) hoàn tất | Exactly-once: lastCheckedMs tiến đúng cycles đã roll | Repeat (settle 2 lần cùng elapsed) | lastCheckedMs delta = cycles × cycleMs mỗi call | Unit (adversarial) | High — economy |
| INV-GRID-1 | useBagGridLayout observer | grid trong v-if render sau mount | Lifecycle: observer attach khi ref gán | Reorder (mount trước, render sau) | observe() được gọi, layout cập nhật | Unit (`useBagGridLayout.test.ts`) | Medium |
| INV-GRID-2 | grid remount | ref null → element mới | Lifecycle: observer cũ disconnect, không leak | Repeat | disconnect count + instance mới | Unit | Medium |
| INV-APP-1 | tick/autosave interval | startTickLoop/startAutosave gọi 2 lần | Idempotency: đúng 1 interval | Repeat | intervals length = 1 | Unit (`useAppLifecycle.test.ts`) | High — CPU leak |
| INV-APP-2 | bootGame trong khi pending | bootGame lần 2 | Exactly-once boot flow | Repeat (concurrent) | startSaveLoad count = 1 | Unit | High — double restore |
| INV-APP-3 | boot fail | bootGame lại sau fail | Recoverability: guard reset, retry chạy được | Reorder (fail → retry) | lần 2 startSaveLoad chạy | Unit | Medium |
| INV-APP-4 | unmount/stopAll | teardown | Lifecycle: event-bus off symmetric, listeners gỡ, idempotent | Repeat (stopAll 2 lần) | off count = on count; lần 2 no-op | Unit | High |
| INV-DLG-1 | ConfirmModal/OverlayPanel labeling | render dialog | Synchronization: aria-labelledby/describedby tham chiếu phần tử thật, ID per-instance | Repeat (2 dialog cùng lúc) | getElementById resolve, IDs khác nhau | Component (`dialogLabeling.test.ts`) | Medium — a11y |
| INV-THEME-1 | ThemeSwitcher card | Enter/Space/click | Synchronization: native button activation + aria-pressed | Equivalent input parity | tag BUTTON, aria-pressed đúng | Component | Medium — a11y |
| INV-PLAY-1 | TurnBattleSystem impact/complete | target chết giữa declare/apply | Boundedness: không hit dead target; turn vẫn complete | Timing boundary (death window) | targetIds không chứa dead; state fighting | Unit (`TurnBattleSystem.actionPlayback.test.ts`) | Medium |
| INV-PLAY-2 | rollHit fail (miss) | miss turn | Exactly-once turn accounting: 0 damage, turn elapsed = 1 | Stale/degraded | HP unchanged, turnsElapsed = 1 | Unit (mocked rollHit) | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| `npx vitest run src/core/game/GameManager.autoFarmOffline.test.ts` (TRƯỚC fix Task 3) | TIMEOUT >300s (infinite loop cycleSeconds=0) | Direct runtime evidence của unbounded settlement — đã fix |
| `npm.cmd run type-check` | PASS (0 error) | — |
| `npm.cmd run build` | PASS (built in 4.86s) | — |
| `npx vitest run` (full suite, sau Task 5) | 2571/2571 PASS | 2 flaky trước đó (actionPlayback RNG, DebugDamage) đều pass trong run này |
| `npx vitest run` (full suite, cuối QA) | 2588/2588 PASS | Gồm 4 adversarial tests mới |
| Adversarial probe: `settleAutoFarmOffline` × 2 cùng elapsed 60s (cycle 1s) | `first: 12000, second: 12000` stones | **Pure API call 2 lần = double-credit** (không reachable qua boot flow hiện tại — xem Finding 1) |
| `lastCheckedMs` delta sau settle lần 2 | +60000ms vượt hiện tại | Cùng probe — API không tự idempotent giữa các call độc lập |
| `npx vitest run src/game/scenes/` | 112/112 PASS | — |
| `npx vitest run src/composables/ src/components/` | 214+ PASS | — |

## Findings

### QA-2026-09-05-001: settleAutoFarmOffline không tự idempotent giữa 2 call độc lập
- Severity: Low
- Status: Suspected (không reachable qua flow hiện tại)
- Invariant: Idempotency/Exactly-once — một interval offline chỉ được settle một lần
- Preconditions: `settleAutoFarmOffline(player, elapsed)` được gọi lần 2 với cùng `elapsed` (hoặc nguồn lastSavedAt chưa đổi) trước khi `lastCheckedMs` được persist lại
- Reproduction: Gọi 2 lần liên tiếp trong test với cùng tham số (probe đã chạy)
- Expected: Lần 2 không cộng thêm reward (lastCheckedMs là nguồn chặn)
- Actual: Lần 2 roll thêm `floor(cappedElapsed/cycleMs)` cycles nữa — stones +12000 lần 2, lastCheckedMs nhảy vượt hiện tại +60s
- Evidence: runtime probe `[evidence] first: 12000 second: 12000`; lastCheckedMs delta +60000ms
- Test file: none (probe đã xoá sau khi đo — không nhúng vì hành vi là hợp đồng hiện hành: caller chịu trách nhiệm gọi một lần)
- Owner subsystem: `GameManager.settleAutoFarmOffline` (`core/game/GameManager.ts`)
- Blast radius: Nếu một flow tương lai gọi settle 2 lần (boot retry KHÔNG qua Pinia identity guard vì `GameManager.restoreFromSave` không có guard tương đương) → nhân đôi offline reward. Flow hiện tại: `restoreGameSession` chỉ chạy 1 lần per boot; boot-error retry quay về auth rồi boot lại với `coordinator.load()` mới — save identity có thể trùng nhưng `player.restoreFromSave` (Pinia, có QA-002 guard) chạy trước và guard của nó KHÔNG cản `GameManager.restoreFromSave`. Đánh giá reachable THẤP nhưng rủi ro kinh tế cao nếu flow đổi → khuyến nghị development follow-up: thêm lastSavedAt-based guard trong `settleAutoFarmOffline` (so sánh `lastCheckedMs` với `Date.now() - cappedElapsed*1000`, chỉ settle phần thiếu).

## New or Changed QA Tests

- `game/src/core/game/GameManager.autoFarmAdversarial.test.ts` (4 tests): bounded cap 24h, rollback âm no-op, NaN no-op finite-safe, exactly-once lastCheckedMs delta per call. Proves INV-OFF-1/2/3/4.
- Các test mới của task (đã review trong dev workflow): `CombatScene.actionPlayback.test.ts` (INV-VFX-1/2), `useBagGridLayout.test.ts` (INV-GRID-1/2), `useAppLifecycle.test.ts` (INV-APP-1..4), `dialogLabeling.test.ts` (INV-DLG-1), ThemeSwitcher a11y (INV-THEME-1), playback edge cases (INV-PLAY-1/2).

## Gaps and Residual Risk

- Playwright E2E không chạy trong session này (browser matrix cần dev server + browser; ngoài quick scope). Coverage gap chấp nhận được: mọi invariant runtime đã có Vitest oracle.
- Finding 1 là API-level idempotency gap, không reachable qua flow hiện tại — để Suspected với khuyến nghị fix follow-up, không block.
- Flaky pre-existing: `GameManager.actionPlayback.test.ts` "acknowledgeActionImpact → damage applied" (~10-15% fail do RNG variance khi chạy đơn lẻ nhiều lần) và `DebugDamage.test.ts` tương tự — pre-existing, không do task này (chứng minh bằng stash test trên HEAD sạch). Task 7 đã thêm deterministic dodge test; root fix RNG seed là follow-up riêng.

## Pre-existing Failures

- `DebugDamage.test.ts` và 1 test trong `GameManager.actionPlayback.test.ts`: flaky do RNG, fail NGAY CẢ trên HEAD sạch (stash-verified). Không tính là finding của task này.
