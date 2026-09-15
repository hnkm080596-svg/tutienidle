import type { TurnSkillDefinition } from '../../core/battle/turn/TurnSkillAction'
import { THE_GAIN_PER_LINK, THE_GAIN_PER_FINISHER } from '../../core/combat/CombatTypes'

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
// - multiplier 3 — damage 1 kỳ hệ sống = value 1 × might scale; damage
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
  // Task 8 — The gain is authored on the skill, not inferred from the
  // slot: the charge-resolve cast lands once and accrues the link value.
  theGainOnLandedCast: THE_GAIN_PER_LINK,
  damage: { kind: 'physical', multiplier: 3 },
  targeting: { shape: 'single' },
}

// Phase A3 (2026-09-07) — Kiếm Tu ultimate: explicit stronger variant of
// BAT_KIEM_THUAT (per locked design decision — "bản mạnh hơn của special
// hiện có"), gated by currentThe ('the' resource type, Task 1) instead of
// BAT_KIEM_THUAT's deliberate no-resource-gate design (see that skill's
// own comment). Multiplier 5 / cooldown 8 are starting points for
// playtesting, not locked balance — same convention as Phase A2's boss
// enrage magnitudes. Gain path: BAT_KIEM_THUAT occupies the special slot,
// so its landed hits accrue currentThe via the A3 Task 1 gain hook
// (THE_GAIN_PER_LINK, capped at MAX_THE = 100); the ultimate consumes the
// full pool through the generic resource gate when cast. Gains are
// authored fields (Task 8) — THE_GAIN_PER_* constants live in
// CombatTypes but are referenced ONLY by this file's skill data.
export const TRU_TIEN_KIEM_TRAN: TurnSkillDefinition = {
  id: 'tru_tien_kiem_tran',
  cooldownTurns: 8,
  resourceType: 'the',
  resourceCost: 100,
  // Task 8 — legacy finisher gain preserved as an authored field: the
  // pool is consumed by the resource gate first, then +20 lands on the
  // emptied pool (gain-after-consume ordering lives in the engine hook).
  theGainOnLandedCast: THE_GAIN_PER_FINISHER,
  damage: { kind: 'physical', multiplier: 5 },
  targeting: { shape: 'single' },
}
