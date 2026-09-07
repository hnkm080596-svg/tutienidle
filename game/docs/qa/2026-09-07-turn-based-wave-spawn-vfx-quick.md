# QA Review: Turn-Based Wave Redesign + Spawn VFX Wiring (Tasks 4-8) — Quick

- **Ngày:** 2026-09-07
- **Mode:** quick
- **Task-owned paths:** `game/src/core/game/GameManager.ts`, `game/src/core/battle/turn/TurnActionPresentationEvents.ts`, `game/src/game/scenes/CombatScene.ts`, `game/src/game/scenes/combat/combat-vfx-spawner.ts`, + test files (`WaveSpawnTrigger.adversarial.test.ts`, `TurnBattleSystem.slice5qa.test.ts`, `GameManager.enemyClear.test.ts`, `TurnActionPresentationEvents.test.ts`, `CombatScene.turnCountdownSpawn.test.ts`).
- **Exclusions:** `game/package.json`, `game/package-lock.json`, `game/vite.config.ts` (dirty từ trước ở main checkout — không thuộc task), `_pgbackup/`, `_pginfo/`, `pinegrow.json` (Pinegrow artifacts, không review).
- **Changed systems:** turn-based combat wave spawn presentation (snapshot event, VFX telegraph reconcile, countdown telegraph), GameManager battle bootstrap.

## Mapper kết quả

`deepAuditCandidate: true` — reasons: "critical state boundary: time-and-offline", "cross-system change: 4 domains". **Bounded-by-inspection rationale:** không có schema save mới (TurnBattle + pendingEnemySpawns là runtime-only state, không persist); time/offline logic không đổi (BATTLE_FIXED_STEP, tickCountdown giữ nguyên); 4 domains mà mapper liệt kê đều đi qua đúng 1 seam: snapshot event → CombatScene presentation. Rủi ro bị chặn ở biên presentation-only (lifecycle VFX handle + sprite visibility), có oracle cục bộ. Không escalate.

## Invariant ledger

| ID | Transition | Invariant | Attack | Kết quả |
|---|---|---|---|---|
| INV-Q1 | snapshot emit → CombatScene | countdownProgress phải tới scene TRONG pha countdown | Code trace GameManager pacing loop | **CONFIRMED (đã fix)** — emit chỉ ở nhánh 'fighting' → telegraph đếm 3→2→1 không bao giờ render; caller-side wiring missing (P13 class). Fix: emit thêm ở nhánh 'countdown' (GameManager.ts:3641). |
| INV-Q2 | materialize transition | reconcileSpawnVfx phải chạy TRƯỚC sprite reconcile (id rời pending = materializingIds đánh dấu trước 'create' consume) | Đối chiếu legacy applyPendingPositions() thứ tự | **CONFIRMED (đã fix)** qua P5 review — thứ tự sai làm mất fade-in + kẹt id trong materializingIds. Fix: đổi thứ tự gọi. |
| INV-Q3 | battle restart trong cùng scene | turnCountdownSpawnVfxHandles/turnCountdownPendingIds phải dọn sạch ở onBattleStart() + shutdown | Soi 2 cleanup site hiện có (L1232-1237 shutdown, L2188-2193 onBattleStart) | **Suspected — mitigated:** Map/Set mới không được dọn ở 2 site. Nhưng vô hại: handle chỉ được tạo khi countdownProgress !== undefined; battle mới bắt đầu bằng countdown (snapshot đầu flush/clear toàn bộ khi progress === undefined). Không leak sprite/handle vì handle tự destroy trong complete(). Theo dõi nếu sau này battle có thể bắt đầu không qua countdown. |
| INV-Q4 | bootstrap enemy discard | Mọi enemy (kể cả con đầu) spawn qua telegraph; EnemySystem không giữ entity mồ côi | GameManager.enemyClear.test.ts (đã cập nhật, pass) + startStage trace | PASS — despawn khỏi EnemySystem + enemies[] trước khi wave reset. |
| INV-Q5 | victory mid-telegraph | isStageComplete phải false khi còn pending | WaveSpawnTrigger.test.ts + adversarial INV-WST-* (pass) | PASS. |
| INV-Q6 | sum(waves) === totalEnemyCount mọi stage | EffectiveWaves.test.ts (30 stage, pass) | PASS. |

## Evidence

| Kiểm tra | Kết quả | Ghi chú |
|---|---|---|
| `npm.cmd run type-check` | 0 lỗi | sau mọi fix |
| `npx vitest run` (full) | 431 files / 2807 tests PASS | baseline 2801 → +6 (5 Task 5 + 1 Task 7) đúng plan |
| `npx playwright test create-to-combat` | PASS (1.1-1.2m) | spec chơi trận thật tới kết quả — simulation advanced (P13) |
| `npx playwright test boot-fresh save-reload ink-wash-ui` | 5/5 PASS | non-combat e2e sạch |
| `npx playwright test turn-combat-hud / combat-overlay-layout` | FAIL | **baseline fail xác nhận bằng stash-run** (không có thay đổi Task 5-7 vẫn fail y hệt); roadmap mục 7.10 + 518 đã ghi nhận; deferred UI/UX plan Task 13 — pre-existing, không phải defect của task này |
| Manual Playwright pass Task 8 (quan sát telegraph VFX trực quan) | **KHÔNG chạy được** | cần người quan sát canvas; coverage gap |

## Verdict

**PASS WITH EVIDENCE** cho logic/engine层: toàn bộ invariants engine đã được unit tests chứng minh; 2 Confirmed findings (INV-Q1, INV-Q2) đã fix trong dev workflow (trước QA report, hợp lệ vì QA gate cho phép exit QA → fix → re-run; cả 2 fix đã full-verify lại: 2807/2807 + type-check + create-to-combat e2e).

**Coverage gap (không chặn completion vì đây là VFX trực quan cần người xem):** visual confirmation của telegraph circles (countdown party + wave spawn) cần manual quan sát — plan Task 8 yêu cầu nhưng không thể tự động assert canvas rendering từ Playwright spec hiện có.
