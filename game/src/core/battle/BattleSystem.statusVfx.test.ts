// RETIRED (Completion Task 9, 2026-09-04) — mechanic: statusVfx
//
// File này pin hành vi real-time của BattleSystem.update(deltaSeconds)
// đã bị retire trong Slice 6 cutover (unified flow: Countdown → Spawn →
// Gauge combat → Wave → Result, engine = TurnBattleSystem).
//
// Phân loại theo Completion plan Task 9:
//   - Mechanic đã migrate → test tương đương nằm ở core/battle/turn/
//     (TurnBattleSystem.test.ts và các file .*.test.ts cùng thư mục).
//   - Mechanic dropped theo quyết định Deep Review §2 (di chuyển real-time,
//     telegraph, cast bar, channel, boss phase, knockback...) → KHÔNG có
//     equivalent, không port.
//   - Mechanic chờ content migration (resource rules thật, zone-as-dot,
//     chain skills...) → sẽ có test mới khi nội dung thật được thiết kế
//     bằng TurnSkillDefinition/TurnBuffDefinition/ResourceTurnHook.
//
// Nội dung gốc nằm trong git history: git log --follow -- BattleSystem.statusVfx.test.ts

import { describe, expect, it } from 'vitest'

describe('RETIRED: BattleSystem statusVfx (real-time) — xem comment đầu file', () => {
  it('mechanic retired/migrated per Completion Task 9 — engine cutover hoàn tất', () => {
    expect(true).toBe(true)
  })
})