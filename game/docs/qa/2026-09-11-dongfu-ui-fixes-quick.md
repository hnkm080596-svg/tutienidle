# QA Quick — Dong Fu UI fixes: remove HomeResourceStrip + ActionFeedbackLog auto-hide (2026-09-11)

- **Scope:** worktree `.agent-worktrees/dongfu-ui-fixes` (branch `feat/dongfu-ui-fixes`)
- **Task-owned diff:** xóa `HomeResourceStrip.vue` + test + mount point `GameRoot.vue` + i18n `resourceStrip.*` (vi/en); auto-hide 5s cho "Nhật ký thao tác" (`actionFeedback` store + `ActionFeedbackLog.vue` root v-if). Khí Đường 3-tab layout defect KHÔNG thuộc change này — chỉ ghi hồ sơ root-cause vào roadmap R11 (per user decision).
- **Mode:** quick (mapper: `pinia-phaser-sync` + `ui-input-lifecycle`, `deepAuditCandidate: true` vì cross-domain — xem mục Escalation vì sao không cần deep)

## Invariant ledger

| ID | State/owner | Action và transition | Invariant | Attack operator | Oracle | Layer | Kết quả |
|---|---|---|---|---|---|---|---|
| INV-UI-1 | `actionFeedback` store (runtime-only) | push entry → isVisible=true, timer 5s | Lifecycle: timer clear-trước-set, không leak handle | Repeat (push liên tục) | timer cũ bị clearTimeout, 1 handle sống | Unit (fake timers) | PASS — test "entry mới trong cửa sổ 5s" + code `scheduleAutoHide` |
| INV-UI-2 | store + `ActionFeedbackLog.vue` | 5s im lặng → ẩn hoàn toàn | Timing boundary: 4999ms còn hiện, 5000ms ẩn | Timing boundary | `isVisible` + root `v-if` | Unit | PASS — test 4999/1 |
| INV-UI-3 | store | `clear()` giữa timer chạy | Lifecycle: cleanup hủy timer, không toggle muộn | Interruption | `isVisible` stay false sau advance | Unit | PASS — test clear |
| INV-UI-4 | store + log UI | user bấm "Thu gọn" rồi có entry mới | UX contract: entry mới un-collapse + hiện | Reorder (user action trước, system event sau) | `collapsed=false`, `isVisible=true` | Unit | PASS — test collapsed |
| INV-UI-5 | `GameRoot.vue` home route | render màn Động Phủ không strip | Conservation/UI: không còn consumer nào tham chiếu component đã xóa | Stale state (import tàn) | type-check + grep 0 ref | Unit + tsc | PASS — vue-tsc sạch, grep 0 match |
| INV-UI-6 | locales vi/en | xóa `resourceStrip.*` | Synchronization: vi↔en key parity | Value mutation (missing key) | i18n parity test | Unit | PASS — `src/i18n/index.test.ts` 33 test |
| INV-UI-7 | log UI + notification toast | entry key-form render qua t() lồng | Regression: render contract không đổi từ side này | — (regression guard) | 5 render test byte-identical | Unit | PASS — ActionFeedbackLog.test.ts |
| INV-UI-8 | boot/save flow dùng `notification` store (khác store) | save error path | Cross-system: auto-hide không nuốt error toast (store riêng, không đụng) | Cross-system chain | code inspection: `App.vue:348` dùng `notification.push`, không phải actionFeedback | Unit (existing 26-file scope) | PASS |

## Focused checks đã chạy

| Check | Kết quả |
|---|---|
| `npx.cmd vitest run src/stores src/components/common src/components/game src/components/layout` | 41 files / 211 tests PASS |
| `npx.cmd vitest run src/i18n src/App.wiring.test.ts` | 2 files / 33 tests PASS (key parity + app-shell wiring guard) |
| `npm.cmd run type-check` (vue-tsc --build) | PASS |

## Escalation decision (mapper trả `deepAuditCandidate: true`)

Không escalate lên deep: change là presentation-only, runtime-only store (không persist — không chạm save/cloud/offline clock), không chạmGameManager/P18 combat, không transaction kinh tế. 2 domain mapper gán (`pinia-phaser-sync`, `ui-input-lifecycle`) đều bounded được bằng unit + wiring test đã chạy. Cross-system duy nhất (INV-UI-8) kiểm bằng code inspection: error boot path dùng `notification` store tách biệt — auto-hide không thể làm mất error feedback.

## Findings

Không có defect Confirmed/Suspected nào trong scope change.

**Coverage gap (không chặn):**
1. **P14 real-browser check deferred** — auto-hide 5s là hành vi timing + visual (fade lúc ẩn). Worktree `.agent-worktrees/**` không chạy được playwright-cli reliably (P14 isolated-worktree exception, xác nhận 2026-09-07). Đã xác nhận trước đó bằng browser thật trên main checkout cho TRIỆU CHỨNG gốc (log luôn hiện); hành vi auto-hide đã lock bằng unit test fake-timer từng mốc 4999/5000ms. Cần 1 lần nhìn thật sau merge (dev server main checkout, chờ 5s không thao tác, xác nhận log biến mất + entry mới làm nó hiện lại).
2. **HomeResourceStrip không còn đường nào xem Linh Thạch nhanh ở màn home** — product note, không phải defect: số Linh Thạch vẫn thấy trong panel Túi (inventory) và tooltip building. Nếu user muốn 1 surface khác (vd trong command wheel), là product decision mới.

## Verdict

**PASS WITH EVIDENCE** — với 2 coverage gap đã nêu (P14 deferred theo rule worktree; product note về visibility Linh Thạch).
