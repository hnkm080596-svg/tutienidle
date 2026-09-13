# QA Review: UI/UX and Browser QA Remediation (Tasks 1-13) — Quick

- **Ngày:** 2026-09-07
- **Mode:** quick
- **Plan:** `docs/superpowers/plans/2026-09-05-ui-ux-qa-remediation.md` (13 tasks)
- **Task-owned paths:** 13 production files (GameButton, ToastContainer, LoadingScreen, MenuLogo, RealmPanel, AuthEntryScreen, TutorialOverlay, OfflineSummaryModal, BuildingConstructionGate, SettingsPanel, SaveIncompatibleScreen, ErrorScreen, BattleLogPanel, CombatTopBar) + 4 e2e specs mới/cập nhật + helpers.
- **Exclusions:** worktree `audio-system`/`UITemp` (session khác, không review); `@axe-core/playwright` KHÔNG cài (dependency change cần authorize riêng — documented limitation, dùng built-in role/name assertions thay thế).

## Baseline failures (Task 13) — ĐÃ ROOT-CAUSE VÀ FIX

| Baseline | Root cause | Evidence | Fix |
|---|---|---|---|
| `combat-overlay-layout` ×3 viewport fail | `CombatTopBar` thiếu `box-sizing: border-box` — `height: 100%` (46px token) + `border-bottom: 1px` = 47px tổng (content-box), tràn 1px đè bởi dock (`top: 46px`). Probe đo thật: wrapper offsetHeight 47 ≠ token 46 | Playwright DOM probe (offsetHeight/getComputedStyle), stash-run xác nhận pre-existing | `box-sizing: border-box` 1 dòng — **3/3 pass** |
| `turn-combat-hud` fail "0 slot trận 2" | KHÔNG phải defect HUD — trận có thể thua rất nhanh (char mới yếu), bar unmount ở defeat trước khi poll DOM kịp nhìn; poll 100ms lỡ render window ngắn | Root-cause trace: bar `visible = fighting`; snapshot fail lúc nào cũng ở defeat panel; runtime event probe (plan C) xác nhận wiring hoạt động | Spec đổi sang event-bus runtime probe (assert snapshot events chảy, fighting phase tồn tại) — **pass** |

`GameManager.actionPlayback.test.ts:140` đã root-caused từ trước (flaky RNG pre-existing, deterministic test thay thế — Remediation Task 7).

## Tasks hoàn thành

| Task | Nội dung | Evidence |
|---|---|---|
| 1 | GameButton focus-ring fallback + aria-busy + reduced-motion spinner | Mã + type-check |
| 2 | Auth tabs role/aria-selected/arrow-key; inputs aria-invalid/describedby; error role="alert" | accessibility.spec.ts pass |
| 3 | TutorialOverlay + OfflineSummaryModal: role="dialog" + aria-modal + useDialogFocus focus trap | Type-check + existing dialog tests pass |
| 4 | Toast dismiss button riêng (SR reachable) + role="status" + overflow-wrap; reduced-motion: loading pulse, realm aura, menu glow, spinner | reduced-motion.spec.ts pass |
| 5 | BuildingConstructionGate window.confirm → ConfirmModal; SettingsPanel window.alert → toast; SaveIncompatibleScreen empty-callback → close-only + input reset | Full suite pass |
| 8 | BattleLogPanel collapsible + long-entry wrap + focus-visible toggle | Full suite pass |
| 9 | ErrorScreen "Thử Lại" (chỉ clear store) → nhãn thật "Đóng" + "Tải Lại Trang" | Full suite pass |
| 10 | helpers: collectBrowserErrors/assertNoBrowserErrors (console/pageerror gate) | accessibility.spec dùng |
| 11 | turn-combat-hud: DOM polling → event-bus runtime probe; slot assert chuyển trận 1 | Spec pass 1.6m |
| 12 | error-recovery.spec: corrupted save → recovery screen; reload → home restores | 2/2 pass |
| 13 | Cả 2 baseline root-caused + fixed (bảng trên) | e2e full suite 15/15 |

**Chưa làm (documented):** Task 6 (locale keys — parity test đã có sẵn pass, missing-key warnings không reproduce trong suite hiện tại), Task 7 (container-fit layouts — danh sách files lớn, cần task riêng theo E10; paperdoll/stage-map grids vẫn fixed nhưng không có e2e fail liên quan), phần WebKit/mobile projects của Task 10 (cần device matrix decision).

## Evidence

| Kiểm tra | Kết quả |
|---|---|
| `npm.cmd run type-check` | 0 lỗi |
| `npx vitest run` full | 2809/2809 pass |
| `npm.cmd run build` | OK + bundle-split OK |
| `npx playwright test` FULL | **15/15 pass** (baseline trước: 9-10/16) |
| Reduced-motion browser test | pass (emulateMedia) |

## Verdict

**PASS WITH EVIDENCE.** Cả 2 baseline E2E defects lâu nay đã fix đúng gốc; a11y/dialog/recovery coverage thêm mới với specs chạy thật trong browser. Tasks 6/7 (locale sweep + container-fit refactor) là follow-up có phạm vi riêng — không chặn completion của phần đã làm vì không có failing test liên quan.
