import type {
  SkillType,
  SkillTarget,
  SkillResourceType,
  PassiveTrigger,
} from './SkillTypes'
import type { SkillEffect } from './SkillEffect'
import type { StatModifier } from '../stats/StatCalculator'
import type { SkillSpecialization } from './SkillSpecialization'
import type { SkillRuntimeStats } from './SkillRuntimeStats'
import type { ActionTargeting, CombatVfxPresetId } from '../battle/CombatAction'
export { SKILL_RESOURCE_STAT_KEYS } from './SkillRuntimeStats'
export type { SkillResourceStatKey } from './SkillRuntimeStats'

/**
 * Skill execution policy (plan §8.1) — cơ chế timing DUY NHẤT của active
 * skill auto-cast. Runtime CHỈ đọc field này (không fallback từ
 * castTime/path). Mỗi policy tự khai ý nghĩa:
 * - `attack_speed`: cadence theo Attack Speed (× multiplier), không ICD,
 *   không CDR, không cast time. Timer theo TỪNG SLOT
 *   (CombatEntity.skillCadenceRemainingBySlot).
 * - `cooldown`: resolve tức thời, timer = skill.cooldown, chịu CDR.
 * - `cast_time`: niệm trước khi thi triển; cast time chịu Cast Speed,
 *   cooldown commit lúc BẮT ĐẦU niệm, chịu CDR.
 * - `attack_speed_cast`: vừa niệm vừa có nhịp tái dùng theo Attack Speed;
 *   không chịu CDR.
 */
export type SkillExecutionPolicy =
  | {
      kind: 'attack_speed'
      attackSpeedMultiplier?: number
    }
  | {
      kind: 'cooldown'
    }
  | {
      kind: 'cast_time'
      castTime: number
    }
  | {
      kind: 'attack_speed_cast'
      castTime: number
      attackSpeedMultiplier?: number
    }

export interface Skill extends Partial<SkillRuntimeStats> {
  id: string

  name: string

  description: string

  type: SkillType

  level: number

  maxLevel: number

  /** XP còn lại trong cấp hiện tại; Huy Kiếm tự nhận +1 mỗi lần cast. */
  experience?: number

  /** XP tích lũy suốt đời, dùng cho hệ số sát thương và hook mở Kiếm Tu. */
  totalExperience?: number

  requiredRealmId?: string

  requiredRealmLevel?: number

  cooldown: number

  remainingCooldown: number

  // Cast Time (2026-08-21) — giây "niệm" TRƯỚC KHI hiệu ứng thi triển.
  // Skill execution policy rework (plan §8) — field này CHỈ còn là dữ
  // liệu tham khảo cho skill có `execution` kind 'cast_time'/
  // 'attack_speed_cast' (policy tự khai castTime riêng); runtime KHÔNG
  // đọc fallback từ đây nữa. Giữ để UI/tooltip hiển thị.
  castTime?: number

  // Lượng tài nguyên cần để cast, ý nghĩa tuỳ resourceType (mana, rage,
  // sword_intent, momentum) — 'none' thì KHÔNG khai field này (skill free,
  // runtime không đọc cost).
  cost?: number

  target: SkillTarget

  effects: SkillEffect[]

  passiveModifiers?: StatModifier[]

  // Bắt buộc khi type === 'active', mặc định coi như 'none' nếu
  // không set.
  resourceType?: SkillResourceType

  // Skill execution policy (plan §8.1/§8.3) — BẮT BUỘC cho MỌI active
  // skill; passive không dùng. Runtime chỉ đọc field này — không còn
  // fallback isBasicAttack/castTime/path. Xem type doc phía trên.
  execution?: SkillExecutionPolicy

  // ================= Combat Grid Rework (2026-08-24) =================
  targeting?: ActionTargeting

  // AOE theo grid: lan quanh ô PRIMARY target. undefined/0 = single.
  laneRadius?: number

  columnRadius?: number

  // Override preset VFX impact; mặc định suy từ element.
  vfxPresetId?: CombatVfxPresetId

  // PLAN HOÀN CHỈNH mục 8/12 — vị trí (0-4) trong Skill Loadout, chỉ
  // có ý nghĩa khi equipped === true. undefined = đã HỌC (unlocked)
  // nhưng CHƯA được set vào Loadout — đây chính là ranh giới "Skill
  // Tree = học" (unlocked) vs "Skill Loadout = set" (equipped +
  // loadoutSlot), xem SkillSystem.equipToSlot()/SkillManager.
  // getLoadoutSkills().
  loadoutSlot?: number

  // A learned technique can occupy multiple loadout slots. Cooldowns live
  // on slot instances so duplicate spells recharge independently.
  loadoutSlots?: number[]

  remainingCooldownBySlot?: Record<number, number>

  // Bắt buộc khi type === 'passive' — xem PassiveSystem.
  passiveTrigger?: PassiveTrigger

  // Pháp Tu profession-tier ladder (2026-08-14) — nhãn PHÂN LOẠI thuần
  // UI cho passive skill (Skill.ts's Tâm Pháp summary panel nhóm
  // passive theo hướng build) — không ảnh hưởng runtime, chỉ tổ chức
  // hiển thị "Core/DOT/Burst" cho người chơi dễ hiểu build của mình.
  buildTag?: 'core' | 'dot' | 'burst'

  unlocked: boolean

  equipped: boolean

  // "Nộ kỹ tạm thời chưa ra mắt" (2026-08-15, áp dụng mọi path) —
  // chặn CAST cứng bất kể unlocked/equipped/cooldown/resource, xem
  // SkillSystem.canUse(). Vẫn học/trang bị được bình thường (để build
  // hiện đủ trên UI), chỉ tạm khoá quyền dùng — gỡ field này khi nội
  // dung thật sự phát hành.
  unreleased?: boolean

  // Kiếm Tu (2026-08-15) — Ngự Kiếm Thuật (basic) đánh trúng thì +1
  // Kiếm Ý chiến đấu (CombatEntity.currentSwordIntent), xem
  // BattleSystem.ts's missile-resolve callback.
  grantsSwordIntentPerHit?: boolean

  // Thể Tu (Combat Rework Phase 7) — đánh TRÚNG (không tính né) thì +N
  // Momentum (CombatEntity.currentMomentum, xem CombatTypes.ts's
  // MAX_MOMENTUM) — cùng hook missile-resolve callback với
  // grantsSwordIntentPerHit, khác ở chỗ theo LƯỢNG thay vì cố định +1.
  grantsMomentumPerHit?: number

  // Thể Tu (Combat Rework Phase 7) — đánh TRÚNG thì trừ thêm N vào
  // target.currentBreakGauge (nếu target có, xem CombatEntity.ts) —
  // KHÔNG qua Damage Engine/mitigation, cùng tinh thần Detonate. Chạm
  // 0 thì Stagger (áp 'choang'), xem BattleSystem's missile-resolve
  // callback.
  breakDamagePerHit?: number

  // Hỏa Tu Pure (Plans/FirePath mục 7, 2026-08-21) — mỗi lần CAST
  // (không phải mỗi đòn TRÚNG như grantsMomentumPerHit) skill này thì
  // +source.skillStats.hoaTheGainPerCast vào currentHoaThe (0 nếu chưa mua
  // node "Tụ Hỏa" — nền của stat đó là 0), xem BattleSystem.castSkill().
  grantsHoaThePerCast?: boolean

  // Thổ Tu Pure (Plans/EarthPath mục XV, 2026-08-21) — cùng mô hình
  // grantsHoaThePerCast nhưng cấp currentThoThe, KHÔNG có decay đối
  // ứng (xem BattleSystem.castSkill()/CombatEntity.currentThoThe).
  grantsThoThePerCast?: boolean

  // Core Loop Foundation checklist (Mục SKILL) — danh sách lựa chọn
  // "behavior-changing node" (template, không đổi giữa các instance
  // nếu có nhiều — hiện game chỉ có 1 instance/skill nên không quan
  // trọng). Không khai = skill này chưa có specialization nào.
  specializations?: SkillSpecialization[]

  // Lựa chọn CỦA NGƯỜI CHƠI — instance-level, mặc định chưa chọn
  // (dùng effects/passiveModifiers/passiveTrigger gốc). Xem
  // SkillSystem.selectSpecialization()/getEffectiveSkill().
  selectedSpecializationId?: string

  // Skill rework (2026-08-21) — Node Tree Pháp Tu trước đây cộng các
  // field "Thế tài nguyên" dưới đây thẳng vào CombatEntity.stats (kho
  // chỉ số CHUNG của nhân vật). Vì mỗi field CHỈ có ý nghĩa với ĐÚNG 1
  // skill (vd hoaTheGainPerCast chỉ Hỏa Cầu Thuật dùng), chuyển hẳn
  // sang gắn TRỰC TIẾP lên object Skill sở hữu nó — GameManager.
  // purchaseNode() ghi thẳng số vào đây khi mua node (xem NodeSystem.ts),
  // combat đọc qua entity.skills (CombatEntity.ts) hoặc ctx.skill
  // (SkillEffectSystem.ts), KHÔNG còn đọc entity.stats.<field> nữa.
  // undefined = coi như 0 (chưa mua node cấp field này).
}
