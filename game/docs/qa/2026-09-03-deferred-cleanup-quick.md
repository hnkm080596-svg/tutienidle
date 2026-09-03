# QA Review: deferred-cleanup-followups — consolidated quick close-out

- **Ngày:** 2026-09-03
- **Branch/worktree:** `.agent-worktrees/deferred-cleanup-followups` (`worktree-deferred-cleanup`)
- **Verdict:** **PASS WITH EVIDENCE**
- **Loại:** Quick review (consolidated) — 5 deferred follow-ups + docs sync; không có production code mới trong Task 5 (docs only).

## Phạm vi đã review

Task-owned paths: consolidated over the SDD series `2026-09-03-deferred-cleanup-followups` (commits `8ccf350..db9b5ac` + docs):

- `game/src/composables/useDialogFocus.ts` — zero-focusable Tab containment + same-tick re-open trigger guard (`8ccf350`)
- `game/src/components/combat/CombatExitConfirmModal.vue` — focus trap, Escape cancel exit (`659c0b3`)
- `game/src/components/**` — i18n 2.2 final batch: FunctionOverlayPanel + useBagFilter GROUP/AGE_LABELS (`912b1f3`)
- `game/tests/**` + StageSelect numeric assertion + en 'Form' terminology unification (`db9b5ac`)
- `game/docs/roadmap.md` — mục 8.5 sync + 7.2 (2.2) status
- `game/docs/qa/**` — báo cáo này

Mỗi task đã nhận quick review riêng (review-clean, theo ledger `.superpowers/sdd/2026-09-03-deferred-cleanup-followups/progress.md`); report này re-verify branch end-state as a whole và collect deferred findings.

## Verify matrix (evidence)

| Command | Kết quả | Ghi chú |
|---|---|---|
| `npm.cmd run test` | ✅ PASS | 336 test files, **2172/2172 tests passed** (96.6s) |
| `npm.cmd run type-check` | ✅ PASS | `vue-tsc --build` clean, 0 error |
| `npm.cmd run build` | ✅ PASS | vite 8.2.2, 675 modules, built in 5.6s (chunk-size warning pre-existing, informational) |
| `npm.cmd run test:e2e` | ✅ PASS | **9/9** Playwright spec (boot-fresh, save-reload, create-to-combat, combat-overlay-layout ×3, ink-wash-ui ×3) |

## Invariants spot-checked

| # | Invariant | Cách verify | Kết quả |
|---|---|---|---|
| INV-1 | useDialogFocus: Tab trong dialog 0 focusable không thoát ra background; re-open cùng tick không double-listener | adversarial tests từ Task 1 (bắt đầu lô `useDialogFocus`), suite xanh trong matrix trên | ✅ |
| INV-2 | CombatExitConfirmModal: focus giữ trong modal khi Tab; Escape → cancel (không exit combat) | adversarial tests từ Task 2, suite xanh | ✅ |
| INV-3 | i18n 2.2 final batch: key parity vi↔en giữ nguyên (`src/i18n/index.test.ts:81-92` parity test xanh), rendered output byte-identical với literals cũ | parity + locale assertions trong suite; component tests assert qua `t()` resolution | ✅ |
| INV-4 | StageSelect: assertion numeric (không phụ thuộc locale string), en dùng 'Form' thống nhất | test file updated ở `db9b5ac`, suite xanh | ✅ |
| INV-5 | Docs-only Task 5: không production code đổi sau `db9b5ac` | `git status` — chỉ untracked docs (spec/plan/qa); `git diff` trên `src/` rỗng | ✅ |

## Deferred / còn lại (tracked, không phải regression)

1. **i18n 2.7 data-layer strings** — materials/buffs/skills/buildings names + lore còn hardcode vi. Khối lượng lớn, **lập plan riêng** (roadmap 7.2: 2.2 ✅, chỉ còn 2.7).
2. **QA-013 / QA-014** (từ Task 9.1, Low): cooldown UX khi breakout bị chặn; unequip-before-failed-start edge — xem `game/docs/qa/2026-09-02-task-9-1-breakthrough-confirm-panel-quick.md`.
3. **QA-2026-09-03-002** (pre-existing): `DongFuCommandWheel` Tab handler bỏ qua modal-open state — đã ghi nhận trong report Task 9 followups, chưa sửa (pre-existing, ngoài scope 5 follow-ups).
4. **Stringly-typed badge key threading** — refactor gắn với 2.7 (data-layer strings), làm cùng plan 2.7.

## Kết luận

Cả 5 deferred follow-ups đã merge trên branch với full verify matrix xanh (2172 unit + 9 e2e + type-check + build). Task 5 docs-only. Verdict: **PASS WITH EVIDENCE**.
