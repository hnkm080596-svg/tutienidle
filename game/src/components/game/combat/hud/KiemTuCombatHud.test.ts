// RETIRED (Slice 7 master plan Task 7, 2026-09-04) — slider Nhịp Tụ Lực
// + nút Ult Kiếm Tu đã GỠ BỎ khỏi KiemTuCombatHud theo quyết định người
// dùng (2026-09-04): cả 2 điều khiển gọi thẳng real-time battleSystem/
// UltimateSystem.ts đã chết từ Slice 6 cutover (engine duy nhất giờ là
// TurnBattleSystem). 4 test dưới đây pin chính các mechanic bị gỡ —
// không còn behavioral analog.
//
// KiemTuCombatHud mới render 3 slot cố định (basic/special/ultimate)
// qua useCombatSkillPresentation — behavior bấm-chọn-skill được exercise
// end-to-end qua GameManager.turnManualMode.test.ts (pause/submit) +
// CombatSkillPresentation.test.ts (state derivation) + smoke test
// browser (QA report 2026-09-04-turn-combat-completion-remaining-quick).
//
// Nội dung gốc trong git history:
// git log --follow -- src/components/game/combat/hud/KiemTuCombatHud.test.ts
import { describe, expect, it } from 'vitest'

describe('RETIRED: KiemTuCombatHud legacy slider/Ult — xem comment đầu file', () => {
  it('mechanics retired per Slice 7 master plan Task 7 — legacy real-time controls removed', () => {
    expect(true).toBe(true)
  })
})
