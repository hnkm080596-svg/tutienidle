# QA Review: Bảng 9.5 #5 — Skill name/icon/tooltip trong HUD turn — Quick

- **Ngày:** 2026-09-07
- **Mode:** quick
- **Task-owned paths:** `game/src/data/skill/TurnSkillDisplayMeta.ts` (mới) + test, `game/src/core/combat/CombatSkillPresentation.ts` (+test), `game/src/components/game/combat/hud/TurnCombatSkillBar.vue`, `game/src/components/game/combat/hud/CombatSkillSlot.vue`, `game/src/components/game/combat/hud/TurnCombatSkillBar.display.test.ts` (mới).
- **Exclusions:** không có — toàn bộ diff thuộc task.
- **Changed systems:** combat HUD presentation (display metadata lookup), combat skill presentation layer, skill data map mới.

## Mapper kết quả

`deepAuditCandidate: true` — reason: "cross-system change: 3 domains" (combat-and-tribulation, pinia-phaser-sync, ui-input-lifecycle). **Bounded-by-inspection rationale:** thay đổi là display-only metadata (name/description string lookup theo skillId); không đổi state ownership, không đổi event flow, không đổi Pinia store, không đụng engine logic (TurnBattleSystem 0 diff). 3 domains mà mapper liệt kê đều chạm đúng 1 seam đọc-only: `buildTurnSkillPresentation()` output thêm 2 optional fields. UI lifecycle (tappable/disabled) không đổi. Oracle cục bộ đầy đủ (component mount test + presentation unit test). Không escalate.

## Invariant ledger

| ID | Transition | Invariant | Attack | Kết quả |
|---|---|---|---|---|
| INV-SM-1 | lookup metadata | id lạ → không crash, fallback nhãn role | Unit test (id lạ + empty entry) | PASS — `turnSkillDisplayMetaOf` trả undefined, entry giữ nguyên |
| INV-SM-2 | SKILLS sync | id trùng SKILLS → name/description đồng bộ bảng skill thật, không hardcode 2 nơi | Unit test `tram` → 'Huy Kiếm' | PASS |
| INV-SM-3 | UI render | skillName có → hiện tên thật; không có → 3 nhãn role nguyên vẹn | Component mount test ×2 | PASS |
| INV-SM-4 | existing consumers | mọi consumer hiện tại của `buildTurnSkillPresentation` không bị phá (2 fields optional) | Full suite | PASS — 2809/2809 (baseline 2807 → +7: 3 map + 4 presentation wiring; 2 component) |
| INV-SM-5 | CombatSkillSlot khác | `displayLabel` undefined → label logic cũ nguyên vẹn (skill?.name → emptyLabel → 'Trống') | Full suite (mọi test dùng CombatSkillSlot) | PASS |
| INV-SM-6 | combat thật chạy được | e2e create-to-combat (trận thật tới kết quả) | Playwright | PASS (57s) |

## Evidence

| Kiểm tra | Kết quả |
|---|---|
| `npm.cmd run type-check` | 0 lỗi |
| `npx vitest run` full | 2809/2809 pass |
| `npm.cmd run build` | OK |
| `npx playwright test create-to-combat` | PASS — trận thật chạy tới kết quả (P13) |
| Sweep id production vào map (11 id) | PASS — guard test vĩnh viễn |

## Verdict

**PASS WITH EVIDENCE.** Không tìm thấy defect. Lưu ý nhỏ: icon PNG riêng cho từng skill chưa có (art chưa có) — SlotView hiển thị monogram chữ cái đầu, đúng hành vi fallback hiện có của project; khi có art chỉ cần thêm `icon` vào TurnSkillDisplayMeta (đã chừa concept trong comment).
