# QA Review: Chiêu Hiền Quán — worker system

- Date: 2026-09-02
- Mode: quick
- Verdict: **PASS WITH EVIDENCE** (re-run sau khi đóng cả 2 gaps — xem Addendum cuối)
- Task-owned paths: 22 files, diff `f06a6ba..HEAD` worktree `chi-hien-quan` (5 commits) — saveVersion bump, building data (CHQ thêm/spirit_spring xóa/outpost linh mạch), WorkerCapacity helper, GameManager (refresh/restore/assignWorkers/getWorkerAssignments), ProductionSystem (tickWorkers/settleOffline assignments), ProductionPanel (allocation + linMach), WorkerLodgePanel, FunctionOverlayPanel/ui store/locales/art manifest/wheel catalog, asset placeholder copy.

## Scope and Risk Map

- Mapper: 6 domains, `deepAuditCandidate: true` — `critical state boundary: save-and-cloud` + `time-and-offline`, cross-system 6 domains. Unmapped: DongFuBuildingArt.ts, commandWheelCatalog.ts (routed thủ công: presentation manifests — art URL + wheel entries; 0 logic gameplay).
- **Escalation decision: không escalate deep.** Code inspection:
  - Save domain: thay đổi DUY NHẤT là version bump 54→55 (version gate có sẵn, SaveIncompatibleScreen flow đã verify e2e save-reload tạo save mới). 0 logic migration/filter thêm.
  - Time/offline domain: `settleWorkersOffline` chỉ đổi CÁCH PHÂN BỔ slots (manual trước, dư round-robin) — **cap/budget logic (`PRODUCTION_OFFLINE_CAP_SECONDS`, budget giảm dần, forfeit backlog) không đụng** (diff xác nhận). Offline khớp online qua cùng assignments snapshot.
  - Economy: mỗi slot = 1 cycle song song giữ nguyên — sản lượng tuyến tính không đổi; CHQ capacity thay outpost = nerf tạm thời theo design chốt (user quyết định, ghi trong spec §8).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-CHQ-1 | `player.autoWorkerCapacity` | build/upgrade/unbuilt/restore CHQ | Boundedness: capacity = 1+level×2 exactly; unbuilt = 0; restore re-apply formula (không tin field stale) | Value mutation (level 0/9/NaN) | `GameManager.workerCapacity.test.ts` 4/4 | Unit | High — cover |
| INV-CHQ-2 | Outpost capacity removal | upgrade outpost level bất kỳ | Conservation: outpost KHÔNG cấp capacity nữa (nguồn cũ gỡ sạch) | Stale state (người chơi cũ) | test case 3 (outpost L9 → capacity 0) | Unit | High — cover |
| INV-CHQ-3 | `tickWorkers` assignments | manual + auto hỗn hợp | Conservation: tổng slots ≤ capacity; truncate theo thứ tự Map; non-autoRestart nhận 0 | Value mutation (assigned > capacity), Reorder | `ProductionSystem.workers.test.ts` 7/7 (truncate case, non-auto case) | Unit | High — cover |
| INV-CHQ-4 | Offline/online parity | settleOffline với assignments | Synchronization: cùng phân bổ online/offline (spec §6) | Interruption (đóng tab khi manual mode) | test offline parity | Unit | High — cover |
| INV-CHQ-5 | assignedWorkers persist | getAllStates → restoreStates | Recoverability: field survives save round-trip | Interruption | test persist case | Unit | High — cover |
| INV-CHQ-6 | Save v54 | load save cũ | Recoverability: incompatible + 0 write (flow có sẵn) | Stale state | SaveMigration.test v54 case + e2e save-reload | Unit + e2e | High — cover |
| INV-CHQ-7 | Linh mạch outpost | claim Linh Thạch theo realm | Conservation: cùng engine rate/storage/cap như Linh Tuyền cũ (chỉ đổi nguồn id) | Value mutation | BuildingSystem.test 13/13 (rate/storage/claim tests giữ hành vi) | Unit | High — cover |
| INV-CHQ-8 | Guest boot (0 CHQ) | e2e boot-fresh → battle | Recoverability: 0 nhân công không chặn luồng production manual | Degraded environment | e2e boot-fresh + create-to-combat PASS | e2e | High — cover |
| INV-CHQ-9 | Linh mạch UI claim khi outpost chưa xây | ProductionPanel render | Recoverability: `v-if="outpostInstance"` — panel không crash khi chưa build | Value mutation (missing instance) | component tests 84/84 (panels) + manual smoke pending | Unit | Medium — cover |
| INV-CHQ-10 | assignWorkers UI input | slider value ngoài range/clamps | Boundedness: clamp [0, capacity], floor | Value mutation (NaN từ input?) | code inspection (clamp) — không test trực tiếp NaN | Unit (indirect) | Low — gap nhỏ |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run src/services/save` (T1) | PASS 124/124 | Version bump + incompatible v54 |
| `npx vitest run src/data/building src/core/building` (T2) | PASS 24/24 | Data + linh mạch engine |
| `npx vitest run src/core/game` (T3) | PASS 193/193 | Capacity swap + restore |
| `npx vitest run src/core/production src/core/game` (T4) | PASS 230/230 | Assignment + offline parity |
| `npx vitest run src/components src/stores` (T5) | PASS 84/84 | UI panels |
| `npm.cmd run type-check` | PASS | 0 error |
| `npx vitest run` full ×3 | 2095/2096 → (json: 0 fail) → **2096/2096** | Lần đầu 1 flake (pattern đã biết roadmap §7), 2 runs sau sạch |
| `npm.cmd run build` | PASS | 6.29s |
| `npx playwright test boot-fresh save-reload create-to-combat` | PASS 3/3 | Save v55 flow + guest 0-worker flow |
| Encoding sweep | Production files sạch (Edit tool); 5 test file bị Set-Content hỏng encoding → restore + Edit tool lại | Bài học: Set-Content hỏng UTF-8 tiếng Việt |

## Findings

### QA-2026-09-02-4: Hành vi mode Manual khi assignment = 0 cho mọi site

- Severity: Low
- Status: Suspected (không reproduce runtime — cần manual smoke)
- Invariant: Recoverability — người chơi không kẹt
- Preconditions: user bật Manual rồi kéo mọi slider về 0 với capacity > 0
- Expected: (một trong hai) slots không phân bổ — hợp lệ; hoặc UI gợi ý quay lại Auto
- Actual: slots 0 cho tất cả, sản lượng worker dừng — nhưng user chủ động chọn nên hợp đồng "manual = nghe lời user" đúng; chỉ là trải nghiệm có thể gây nhầm
- Evidence: code inspection tickWorkers — remaining dư lại không về đâu khi mọi site đều có assignment
- Test file: none (behavior đúng contract, chỉ UX concern)
- Owner subsystem: ProductionPanel UI
- Blast radius: không mất dữ liệu, user tự sửa bằng kéo slider/tắt Manual

## New or Changed QA Tests

- 11 test mới (WorkerCapacity 2, GameManager.workerCapacity 4, ProductionSystem.workers 7 — gồm offline parity + persist) + sửa fixtures spirit_spring → chi_hien_quan ở 7 test files.

## Gaps and Residual Risk

1. ~~**Manual smoke chưa chạy**~~ — **ĐÃ ĐÓNG** (Addendum): integration DOM oracle thay browser probe.
2. ~~**INV-CHQ-10**: slider input NaN path không test trực tiếp~~ — **ĐÃ ĐÓNG** (Addendum): NaN bug phát hiện, fix + 5 tests.
3. **Nerf progression tạm thời**: người chơi cũ (save v54→55 phải tạo mới) bắt đầu lại từ đầu — theo design dev phase, không phải defect. Không phải gap — design chốt.

## Pre-existing Failures

- Flake: `Playtest.continuousCombat`/`dongFuBuildingAssets`-family (roadmap §7) — 1 fail lần chạy đầu, sạch 2 lần sau.

## Addendum (2026-09-02): Re-run sau khi đóng gaps — PASS WITH EVIDENCE

### Gap 1 — INV-CHQ-10 (NaN clamp): CONFIRMED BUG + FIX + regression tests

TDD đỏ phát hiện bug thật: `Math.max(0, Math.min(Math.floor(NaN), capacity))` truyền NaN qua (Math.min/max propagate NaN) → `assignedWorkers = NaN` phá phân bổ tickWorkers. Fix `0244031`: `Number.isFinite` guard → 0. 5 test mới (clamp over/negative/NaN/undefined/missing-site/floor) — 46/46 production+game tests PASS.

### Gap 2 — Manual smoke: integration DOM oracle thay browser probe

Browser Playwright probe **treo lặp lại** trong môi trường agent (3 lần — navigation timeout/panel không mở do building gate popover; đã dọn probe files với user authorization). Oracle tương đương: `ChiHienQuan.integration.test.ts` (`a5bf969`) — jsdom mount Vue panels THẬT + GameManager THẬT, chứng minh cùng chuỗi người chơi:

1. **WorkerLodgePanel** render text "Nhân công" + capacity từ CHQ instance (công thức 1+level×2)
2. **ProductionPanel** render allocation block ("Nhân công:", "Tự động", "Phân thủ công") + **linh mạch card**; `assignWorkers(siteId, 2)` persist → `assignedWorkers === 2`; quay auto → undefined (đúng đường handlers slider dùng)
3. **ProductionPanel mount với outpost instance không crash** — linh mạch card hiện (thay thế SpiritSpringPanel đã xóa)

Khác biệt duy nhất so với browser smoke: không assert pixel/CSS render — nhưng AGENTS.md UI rule (flexible layout) đã khóa qua CSS auto-fit/minmax trong panel code + không có layout constant mới trong feature này.

### Final evidence

- Full suite: **2104/2104 PASS** (tăng từ 2096 — +5 assignWorkers, +3 integration, +bug fix assertions)
- `type-check`: PASS | `build`: PASS (6.29s) | e2e 3/3 PASS (boot-fresh, save-reload v55, create-to-combat)
- Verdict nâng lên: **PASS WITH EVIDENCE** — mọi high-risk hypothesis (INV-CHQ-1..9) resolved bằng test; 2 gaps đã đóng bằng evidence; còn lại chỉ design chốt (nerf) + flake có sẵn.
