# QA Review: Kiếm Tu production wiring fix (3 closure inject)

- Date: 2026-09-03
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/core/game/GameManager.ts` (+15 dòng closure inject + helper `getOnHitNodeLevelsSnapshot`), `game/src/core/game/GameManager.kiemTuWiring.test.ts` (mới, 4 tests). Diff `cc6f385..6367ba4` worktree `kiemtu-wiring-fix`.

## Scope and Risk Map

- Mapper: 4 domains, `deepAuditCandidate: true` (GameManager.ts pattern + time-and-offline).
- **Không escalate deep** — code inspection: diff CHỈ thêm 3 closure đọc-live (`getKiemYPermanent(bossKillCount)`, `skillManager.get('tram').totalExperience`, `getOnHitNodeLevelsSnapshot()`) + 1 helper thuần lọc registry. Không đụng `tickTimedEffects`/`OfflineProgressSystem`/`Date.now()` ownership — time-and-offline mapping là path-pattern heuristic, không phải thay đổi hành vi accrual.
- One-hop consumers đã verify: `initChannelState` (BattleSystem.ts:528), `resolveChannelTick` (3004), `resolveOnHitForBattle` (2570) — 3 điểm tiêu thụ closure, hành vi cũ giữ nguyên khi closure trả 0 (non-Kiếm-Tu player).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-WIRE-1 | `battle.player.currentKiemYTemp` | startBattle route BK, bossKillCount=25 | Synchronization: temp = vĩnh viễn (tier 2 → 20), không 0 | Stale state (closure default 0) | `kiemTuWiring.test.ts` case 1 — **FAIL trước fix (0), PASS sau fix (20)** | Integration (GameManager thật) | High — reproduction + fix |
| INV-WIRE-2 | `tram.totalExperience` | closure đọc live mỗi tick | Conservation: không snapshot stale | Timing boundary (cast tăng giữa trận) | case 2 (đọc qua production path) | Integration | High |
| INV-WIRE-3 | `nodeLevels` on-hit | mua node → snapshot có level; level 0/id lạ/non-onHit loại | Boundedness + Recoverability (không throw id lạ) | Value mutation (0, âm, id ma) | case 3+4 | Unit | High |
| INV-WIRE-4 | Non-Kiếm-Tu player | closure trả 0/{} | Không đổi hành vi cũ (default path) | Regression | full suite 2134/2134 (mọi test cũ giữ nguyên) | Full suite | High |
| INV-WIRE-5 | `nodeRegistry.get` throw | id trong save không có trong registry | Recoverability: `has()` guard trước `get()` | Degraded environment (save cũ/id lạ) | case 4 (`node_khong_ton_tai: 5` không throw) | Unit | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run src/core/game/GameManager.kiemTuWiring.test.ts` TRƯỚC fix | 1 FAIL (`kiemYTemp 0 ≠ 20`) | Reproduction đúng lý do — closure chưa inject |
| ... SAU fix | 4/4 PASS | Wiring hoạt động qua production constructor |
| `npx vitest run src/core/battle src/core/game` | 417/417 PASS | Không regression battle/game |
| `npx vitest run` full | **2134/2134 PASS** | Baseline 2130 + 4 mới |
| `npm.cmd run type-check` | PASS | 0 error |
| `npm.cmd run build` | PASS | 4.28s |
| Debug session (đã dọn file tạm) | 25 boss → tier 2 → 20 | Xác nhận công thức threshold trước khi chốt test |

## Findings

Không có Confirmed defect tồn đọng. Ghi chú đã biết (ngoài scope fix này, đã nằm trong profile docs):
- `currentSwordIntent` pool chết (kiem-tu §4.6) — Suspected design-intent gap, chờ user quyết (nối nguồn vs xóa ratio).
- `updateKiem` chưa wire (QA-004) — task riêng (bar Kiếm), blocker cũ đã hết sau buff-bar merge.

## New or Changed QA Tests

- `GameManager.kiemTuWiring.test.ts` — 4 integration test đầu tiên đi qua **GameManager thật** (production constructor) khóa wiring path; test cũ chỉ xanh vì fixture tự inject closure.

## Gaps and Residual Risk

- Damage assertion end-to-end của hấp thụ Huy Kiếm (floor(casts/10) vào Bạt Kiếm tick) vẫn nằm ở `BattleSystem.kiemTuResources.test.ts` (fixture-level) — wiring path đã khóa ở đây; không cần duplicate.
- On-hit roll trong trận thật (9 node proc theo 3%/lv) chưa có integration test qua GameManager — helper snapshot đã test; dispatch path đã test fixture-level. Coverage gap nhỏ, non-material.

## Pre-existing Failures

- Không.
