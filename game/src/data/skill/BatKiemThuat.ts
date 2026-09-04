import type { TurnSkillDefinition } from '../../core/battle/turn/TurnSkillAction'

// Future Systems Task 8 (2026-09-04) — Bạt Kiếm Thuật: MỘT skill duy nhất
// ở vai trò `special` của Kiếm Tu, 2 phase lồng trong primitive
// chargingTurnsRemaining (Task 7): cast = bắt đầu charge ("Thế"), charge
// xong tự resolve ("Trảm") — KHÔNG resource pool riêng, KHÔNG skill
// "Thế" thứ hai (bản chốt cuối cùng 2026-09-04, thay 2 nháp trước).
//
// Số liệu authored (no-rebalance đối chiếu hệ sống):
// - chargeTurns 3 — channel hệ sống tick mỗi 3s nổ 1 kỳ (BattleSystem
//   channel tickSeconds default 3, git history BattleSystem.batKiem.test.ts
//   createBatKiemThuat) → X giây → X lượt policy.
// - multiplier 3 — damage 1 kỳ hệ sống = value 1 × attack scale; damage
//   Trảm tỉ lệ số lượt charge (spec: "tùy thuộc vào lượt charge mà gây
//   sát thương") → 1 × 3 = 3. Amp hệ sống (mất HP +6%/20% maxHP, hệ số
//   0.3 — spec 2026-08-29) là cơ chế real-time riêng, KHÔNG port (channel
//   state không tồn tại trong turn engine).
// - Cooldown 5 sau Trảm — tương đương nhịp dùng lại sau 1 chu kỳ Thế+
//   Trảm (3 lượt) + khe thở 2 lượt; không có cooldown hệ sống đối chiếu
//   (real-time dùng cast-free channel), authored theo nhịp tổng.
// - basic của Kiếm Tu (`tram`/"Huy Kiếm") GIỮ NGUYÊN hoàn toàn — đó là
//   "Trảm" theo cách gọi của user, không đụng.
export const BAT_KIEM_THUAT: TurnSkillDefinition = {
  id: 'bat_kiem_thuat',
  cooldownTurns: 5,
  chargeTurns: 3,
  damage: { kind: 'physical', multiplier: 3 },
  targeting: { shape: 'single' },
}
