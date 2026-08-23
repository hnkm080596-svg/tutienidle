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
export { SKILL_RESOURCE_STAT_KEYS } from './SkillRuntimeStats'
export type { SkillResourceStatKey } from './SkillRuntimeStats'

export interface Skill extends Partial<SkillRuntimeStats> {
  id: string

  name: string

  description: string

  type: SkillType

  level: number

  maxLevel: number

  experience: number

  experienceRequired: number

  requiredRealmId?: string

  requiredRealmLevel?: number

  cooldown: number

  remainingCooldown: number

  // Cast Time (2026-08-21) — giây "niệm" TRƯỚC KHI hiệu ứng thi triển,
  // ĐỘC LẬP với cooldown (khoảng CHỜ SAU khi đã thi triển) và attackSpeed
  // (nhịp đòn cơ bản, KHÔNG dùng cho skill chủ động). undefined/0 = cast
  // tức thời (hành vi CŨ, mọi skill hiện có), xem BattleSystem.
  // updateCasting(). Rút ngắn bởi stat castSpeedPercent.
  castTime?: number

  // Lượng tài nguyên cần để cast, ý nghĩa tuỳ resourceType (mana
  // hoặc rage) — 'none' thì cost không được dùng tới.
  cost: number

  target: SkillTarget

  effects: SkillEffect[]

  passiveModifiers?: StatModifier[]

  // Bắt buộc khi type === 'active', mặc định coi như 'none' nếu
  // không set.
  resourceType?: SkillResourceType

  // PLAN HOÀN CHỈNH mục 6/8 — thay HẲN SkillActiveCategory 4-loại cũ.
  // true = đòn đánh cơ bản, chạy theo attackSpeed timer
  // (BattleSystem.updatePlayerAttack()), KHÔNG qua vòng lặp ưu tiên
  // Skill Loadout (updateAutoCast()) dù có đang chiếm 1 slot hay
  // không — cho phép equip mà KHÔNG cần slot hợp lệ (Phàm Nhân chưa
  // có Skill Loadout UI, xem SkillSystem.equipWithoutSlot()).
  isBasicAttack?: boolean

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
