# QA Quick — Pháp Tu Thuần Hệ (worktree `worktree-phap-tu-thuan-he`)

> Ngày: 2026-09-03 · Mode: quick · Skill: `tutienidle-adversarial-qa`
> **Vị trí trong bộ QA:** đây là lượt quick rerun độc lập (verification pass), bổ sung cho `2026-09-03-phap-tu-thuan-he-task12-quick.md` (report chính — verdict PASS WITH GAPS do gap QA-001: thiếu nút ult HUD). Report này có thêm các oracle: save/restore `selectedSpecializationId`, engine ctx cũ (backward-compat), zero-target ult, add_stack chưa có buff. Verdict dưới đây là của lượt này; trạng thái tổng của feature lấy theo report chính.
> Scope: toàn bộ diff `master...worktree-phap-tu-thuan-he` (36 file, ~4.9k insertions) — 8 engine ext (E-1..E-8), 25 skill data, 42 buff definitions, node tree 17×5, glue chain/ult, tooltip.
> Exclusions (không phải task-owned): `buffs-report.json`, `qa-paths.txt` (QA artifacts không track), `.kilo/kilo.jsonc`, `.mcp.json` (thay đổi ở repo chính, ngoài worktree).

## 1. Risk map (changed-risk-map.mjs)

- Domains: combat-and-tribulation, economy-and-progression, pinia-phaser-sync, time-and-offline, ui-input-lifecycle
- `deepAuditCandidate: true` — reasons: "critical state boundary: time-and-offline", "cross-system change: 5 domains"
- `unmappedPaths: []`
- **Quyết định không escalate sang deep:** reason "time-and-offline" xuất phát từ GameManager xuất hiện trong changed list (GameManager phối hợp timed systems nói chung), KHÔNG phải vì thay đổi chạm code time/offline. Diff GameManager thực tế (diff master...head): `getPhapTuThuanElement()` (đọc nodeLevels), `purchaseNode` thêm nhánh `selectsSpecialization`, `startBattleWithPlayer` thêm `setChainDefinition` — không có thay đổi clock/offline/timestamp. Rủi ro còn lại (chain/ult state) có oracle trực tiếp ở unit/integration layer và đã được phủ test; rủi ro không thể bound từ code inspection: không tìm thấy.

## 2. Invariant ledger

| ID | State/owner | Action & transition | Invariant | Attack operator | Oracle | Kết quả |
|---|---|---|---|---|---|---|
| INV-TH-1 | `TheResourceSystem` (currentThe) | Cast link chuỗi A→E, Thế +10/+20 + bonus, cap max+bonus | Boundedness — Thế không vượt trần, không âm | Value mutation (bonus 0/huge) | `TheResourceSystem.test.ts` (gain/cap/bonus cases) | PASS (đã có test, rerun xanh) |
| INV-TH-2 | `UltimateSystem.triggerPhapTuUltimate` | Ult khi Thế đầy: reset 0, gỡ the_man đúng element | Exactly-once + Synchronization | Repeat (trigger 2 lần), Reorder | `UltimateSystem.phapTu.test.ts` (reset, the_man gỡ theo ult id, không element vẫn reset) | PASS (đã có test, rerun xanh) |
| INV-TH-3 | `SkillEffectSystem` add_stack/remove_buff | add_stack khi buff chưa tồn tại / multi-instance vượt trần | Boundedness — không tạo mới, cap theo maxStacks | Value mutation (stacks 0/huge, count > số có) | `SkillEffectSystem.thuanHe.test.ts` (no-op chưa có buff, cap trần, gỡ hết không crash) | PASS (đã có test, rerun xanh) |
| INV-TH-4 | E-1 spread với ctx cũ / không secondary | spread khi `affectedTargets` undefined hoặc chỉ primary | No-op an toàn, không crash | Degraded environment (ctx thiếu field) | `SkillEffectSystem.thuanHe.test.ts:537` "không affectedTargets (ctx cũ) → không spread, không crash" | PASS (đã có test, rerun xanh) |
| INV-TH-5 | `GameManager.purchaseNode` (E-8) | Mua node biến thể C1 rồi C2 (excludes chặn), skill chưa học | Idempotency — không chọn 2 spec; select fail không rollback purchase | Repeat + Reorder | `GameManager.purchaseNode.test.ts` + `NodeSystem.test.ts` (mở rộng) | PASS (đã có test, rerun xanh) |
| INV-TH-6 | Ult với target set rỗng / skill chưa đăng ký | Kim Phạt khi 0 địch sống; deps nhưng skill không có | No-op + vẫn tiêu Thế + trả true (chủ động ult) | Degraded environment | `UltimateSystem.phapTu.test.ts:319,364` | PASS (đã có test, rerun xanh) |
| INV-TH-7 | Chain definition session-scoped | Player A Thuần start battle → stop → player B guest start | Synchronization — trận kế không thừa hưởng definition | Reorder (đổi player giữa trận) | `GameManager.phapTuChain.test.ts` "chain definition là session-scoped" | PASS (đã có test, rerun xanh) |
| INV-TH-8 | Save/restore skill có `selectedSpecializationId` | buildGameSave serialize nguyên skill object → restore id-match template | Recoverability — progression state giữ nguyên; template refresh chỉ name/description/execution/targeting | Interruption (save/reload) | Code inspection `GameManagerSaveRestore.ts:115-150` + `SaveRoundTrip.test.ts` suite xanh | PASS (code path giữ nguyên object; không có test riêng cho specialization field — coverage gap nhỏ, dev-phase no-migration theo AGENTS.md) |
| INV-TH-9 | `updateTheManBuff` khi registry chưa có definition | Thế chạm trần trước khi buff data đăng ký | Recoverability — no-op, không crash | Reorder (engine chạy trước data) | Code inspection `TheResourceSystem.ts:82` guard `registry.has(id)` + test E-7 suite | PASS |

## 3. Focused verification (rerun 2026-09-03)

- `npx vitest run` (11 focused QA files): **158/158 PASS** — TheResourceSystem, UltimateSystem.phapTu, SkillEffectSystem.thuanHe, GameManager.phapTuChain, GameManager.purchaseNode, PhapTuNodes.dao, Skills.chain, Skills.costInvariant, buffs, SkillMechanicDescriptions, SkillDetailView
- Full suite: **2307/2307 PASS** (340 files, trước đó cùng ngày)
- type-check PASS · build PASS · e2e boot-fresh + create-to-combat PASS
- Tooltip focused: 11/11 PASS (commit `38b5bdb`)

## 4. Findings

- **Confirmed defects: 0** — không có reproduction test thất bại hay runtime evidence nào chứng minh defect.
- **Suspected: 0.**
- **Coverage gaps (2, đều low):**
  1. INV-TH-8: chưa có test round-trip save riêng cho `selectedSpecializationId` trên skill Thuần (restore path giữ nguyên object theo code inspection, dev-phase no-migration được AGENTS.md cho phép). Khuyến nghị: thêm 1 case vào `SaveRoundTrip.test.ts` khi làm Đa Pháp.
  2. `bong` stack N1 đổi cảm giác Hỏa cũ (dpsRatio 0.15/tầng vs 0.3 refresh cũ) — số liệu khởi điểm playtest, không phải defect; test khóa shape theo plan §Execution Notes.

## 5. Verdict

**PASS WITH GAPS** — theo verdict tổng của feature (gap QA-001 UI ult HUD chờ user quyết, xem report chính `2026-09-03-phap-tu-thuan-he-task12-quick.md`).

- Lượt verification này riêng lẻ: **PASS WITH EVIDENCE** cho phạm vi engine/state/data mà nó phủ (không Confirmed defect, không Suspected).
- Bằng chứng: focused QA set 158/158 + full suite 2307/2307 (18:42, trước khi session song song thêm 11 test Task 12 → 2318/2318 trong report chính) + e2e 2/2 + type-check + build (2026-09-03).
- deepAuditCandidate được bound bằng code inspection (diff GameManager không chạm time/offline) + oracle trực tiếp cho mọi hypothesis cao-rank.
- Không sửa production code trong QA run. Commit duy nhất trong lượt này: file QA report này (docs-only, nằm trong QA write allowlist `game/docs/qa/**`).
