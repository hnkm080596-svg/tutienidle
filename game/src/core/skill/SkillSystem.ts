import type { Skill } from './Skill'
import type { SkillExecutionPolicy } from './Skill'
import { SKILL_RESOURCE_STAT_KEYS, createSkillRuntimeStats, type SkillRuntimeStats } from './SkillRuntimeStats'
import type { SkillEffect } from './SkillEffect'
import type { StatModifier } from '../stats/StatCalculator'
import type { PassiveTrigger } from './SkillTypes'
import type { PlayerData } from '../player/Player'
import { getSkillUpgradeInsightCost } from './SkillUpgradeBalance'

import {
  SkillManager,
} from './SkillManager'

import type { CombatEntity } from '../combat/CombatEntity'
import { getRealmIndex } from '../realm/realmSystem'

// Core Loop Foundation checklist (Mục SKILL, "Skill modifier") — mỗi
// bậc level cộng thêm % sát thương cho effect 'damage' của skill chủ
// động. Passive dùng CHUNG cơ chế perLevelFlat/perLevelPercent đã có
// sẵn trên StatModifier (giống TechniqueSystem.getActiveModifiers()),
// không cần hằng số riêng.
const ACTIVE_SKILL_DAMAGE_PERCENT_PER_LEVEL = 0.05

export const HUY_KIEM_CASTS_PER_LEVEL = 10

/** Mỗi 10 cast vĩnh viễn +1 flat damage cho Huy Kiếm — KHÔNG trần. */
export function getHuyKiemFlatDamageBonus(totalExperience: number): number {
  return Math.floor(Math.max(0, totalExperience) / HUY_KIEM_CASTS_PER_LEVEL)
}

/** Mốc level tuyến tính: Lv2 tại 1000 cast, Lv3 tại 10000 cast. */
export function getHuyKiemLevelForCasts(totalExperience: number): number {
  if (totalExperience >= 10000) return 3
  if (totalExperience >= 1000) return 2
  return 1
}

/** Policy dùng cooldown clock (chịu CDR) — còn lại dùng cadence Attack Speed. */
function usesCooldownClock(execution: SkillExecutionPolicy | undefined): boolean {
  return !execution || execution.kind === 'cooldown' || execution.kind === 'cast_time'
}

export interface EffectiveSkill {
  effects: SkillEffect[]

  passiveModifiers?: StatModifier[]

  passiveTrigger?: PassiveTrigger
}

export class SkillSystem {
  constructor(
    private readonly manager: SkillManager,
    private readonly onLevelUp?: (skill: Skill, levelsGained: number) => void,
  ) {}

  /**
   * Hiệu lực THẬT SỰ của 1 skill tại thời điểm hiện tại — áp
   * Specialization (nếu đã chọn, "behavior-changing node" thay hẳn
   * effects/passiveModifiers/passiveTrigger gốc) + scale effect
   * 'damage' theo level. MỌI nơi đọc effects/passiveModifiers/
   * passiveTrigger của 1 skill đã học (combat cast, PassiveSystem
   * trigger/tick, tổng hợp modifier) đều phải qua hàm này thay vì đọc
   * thẳng field trên Skill, để 1 điểm duy nhất quyết định "skill này
   * đang hoạt động thế nào".
   */
  getEffectiveSkill(skill: Skill, levelOverride?: number): EffectiveSkill {
    const specialization = skill.specializations?.find(
      candidate => candidate.id === skill.selectedSpecializationId,
    )

    const baseEffects = specialization?.effectsOverride ?? skill.effects

    const effectiveLevel = levelOverride ?? skill.level
    const levelMultiplier = 1 + (effectiveLevel - 1) * ACTIVE_SKILL_DAMAGE_PERCENT_PER_LEVEL

    const isHuyKiem = skill.id === 'tram'

    const effects = baseEffects.map((effect) => {
      if (effect.type !== 'damage' || effect.value === undefined) {
        return effect
      }

      if (isHuyKiem) {
        return { ...effect, value: effect.value + getHuyKiemFlatDamageBonus(skill.totalExperience ?? 0) }
      }

      return { ...effect, value: effect.value * levelMultiplier }
    })

    return {
      effects,

      passiveModifiers: specialization?.passiveModifiersOverride ?? skill.passiveModifiers,

      passiveTrigger: specialization?.passiveTriggerOverride ?? skill.passiveTrigger,
    }
  }

  /**
   * MỌI passive skill đang unlocked (không chỉ equipped — passive
   * luôn có hiệu lực 1 khi mở khoá, giống pattern cũ) cộng dồn vào
   * player.modifiers, scale flat/percent theo level (perLevelFlat/
   * perLevelPercent, CHUNG công thức TechniqueSystem.getActiveModifiers()).
   * Đọc qua getEffectiveSkill() để tôn trọng Specialization đã chọn.
   */
  getScaledPassiveModifiers(): StatModifier[] {
    const modifiers: StatModifier[] = []

    for (const skill of this.manager.getPassiveSkills()) {
      const effective = this.getEffectiveSkill(skill)

      for (const modifier of effective.passiveModifiers ?? []) {
        modifiers.push({
          ...modifier,

          flat: (modifier.flat ?? 0) + (modifier.perLevelFlat ?? 0) * (skill.level - 1),

          percent: (modifier.percent ?? 0) + (modifier.perLevelPercent ?? 0) * (skill.level - 1),
        })
      }
    }

    return modifiers
  }

  /** Tổng hợp riêng tham số path/skill; không đưa chúng vào character Stats. */
  getSkillRuntimeStats(): SkillRuntimeStats {
    const stats = createSkillRuntimeStats()

    for (const skill of this.manager.getAll()) {
      for (const key of SKILL_RESOURCE_STAT_KEYS) {
        stats[key] += skill[key] ?? 0
      }
    }

    return stats
  }

  selectSpecialization(skillId: string, specializationId: string): boolean {
    const skill = this.manager.get(skillId)

    if (!skill || !skill.specializations?.some(candidate => candidate.id === specializationId)) {
      return false
    }

    skill.selectedSpecializationId = specializationId

    return true
  }

  /** Chi phí Cảm ngộ Kỹ năng để nâng skill này lên level kế tiếp — undefined nếu đã tối đa. */
  getSkillUpgradeInsightCost(skillId: string): number | undefined {
    const skill = this.manager.get(skillId)

    if (!skill || skill.id === 'tram' || skill.level >= skill.maxLevel) {
      return undefined
    }

    return getSkillUpgradeInsightCost(skill)
  }

  /**
   * skill-insight-and-auto-combat-hud-plan.md mục 5 — thay HẲN
   * gainExperience()/XP-per-cast cũ: người chơi CHỦ ĐỘNG nâng cấp
   * ngoài combat, tiêu thẳng player.skillInsight. No-op hoàn toàn (KHÔNG
   * mutate gì) nếu skill không tồn tại/đã max level/không đủ Cảm ngộ.
   */
  upgradeSkill(skillId: string, player: PlayerData): boolean {
    const skill = this.manager.get(skillId)

    if (!skill || skill.id === 'tram' || skill.level >= skill.maxLevel) {
      return false
    }

    const cost = getSkillUpgradeInsightCost(skill)

    if (player.skillInsight < cost) {
      return false
    }

    player.skillInsight -= cost
    skill.level++

    this.onLevelUp?.(skill, 1)

    return true
  }

  learn(skill: Skill): boolean {
    if (this.manager.has(skill.id)) {
      return false
    }

    this.manager.add({
      ...structuredClone(skill),

      unlocked: true,
      equipped: false,

      remainingCooldown: 0,
      remainingCooldownBySlot: {},
      experience: skill.experience ?? 0,
      totalExperience: skill.totalExperience ?? 0,
    })

    return true
  }

  /**
   * PLAN HOÀN CHỈNH mục 8/12 — Skill Loadout: set 1 skill ĐÃ HỌC vào
   * ĐÚNG 1 trong N slot. Dọn các trường hợp trùng trước khi gán: (1)
   * skill KHÁC đang chiếm sẵn slotIndex này — bật ra; (2) CHÍNH skill
   * này đang ở 1 slot khác — dời hẳn qua slot mới. Validate slotIndex
   * hợp lệ theo tiến trình cảnh giới (getSkillLoadoutSlotCount) là việc
   * của GameManager.setSkillLoadoutSlot() — hàm này thuần domain, không
   * biết gì về realm. Execution policy rework (plan §8.6): KHÔNG còn
   * mutual-exclusion isBasicAttack — mọi active đều là loadout bình thường.
   */
  equipToSlot(skillId: string, slotIndex: number): boolean {
    const skill = this.manager.get(skillId)

    if (!skill || !skill.unlocked) {
      return false
    }

    for (const other of this.manager.getAll()) {
      if (other.id !== skillId && (other.loadoutSlots?.includes(slotIndex) || other.loadoutSlot === slotIndex)) {
        other.loadoutSlots = (other.loadoutSlots ?? []).filter(index => index !== slotIndex)
        other.loadoutSlot = other.loadoutSlots[0]
        other.equipped = other.loadoutSlots.length > 0
      }
    }

    skill.equipped = true
    skill.loadoutSlots = [...new Set([...(skill.loadoutSlots ?? []), slotIndex])].sort((a, b) => a - b)
    skill.loadoutSlot = skill.loadoutSlots[0]
    skill.remainingCooldownBySlot ??= {}

    return true
  }

  unequipFromSlot(slotIndex: number): boolean {
    const skill = this.manager.getEquippedInSlot(slotIndex)
    if (!skill) return false
    skill.loadoutSlots = (skill.loadoutSlots ?? []).filter(index => index !== slotIndex)
    delete skill.remainingCooldownBySlot?.[slotIndex]
    skill.loadoutSlot = skill.loadoutSlots[0]
    skill.equipped = skill.loadoutSlots.length > 0
    return true
  }

  /**
   * Equip KHÔNG qua slot — CHỈ dùng cho PASSIVE (passive không thuộc
   * Skill Loadout, xem syncRealmPassive()/equipTechnique()).
   * Execution policy rework (plan §8.6): scheduler chỉ đọc loadout nên
   * active skill PHẢI equip qua slot — không còn luồng "equipped nhưng
   * không có slot" cho active.
   */
  equipWithoutSlot(skillId: string): boolean {
    const skill = this.manager.get(skillId)

    if (!skill || !skill.unlocked) {
      return false
    }

    skill.equipped = true

    return true
  }

  unequip(skillId: string): boolean {
    const skill =
      this.manager.get(skillId)

    if (!skill) {
      return false
    }

    skill.equipped = false
    skill.loadoutSlot = undefined
    skill.loadoutSlots = []
    skill.remainingCooldownBySlot = {}

    return true
  }

  canUse(skillId: string, entity: CombatEntity): boolean {
    const skill =
      this.manager.get(skillId)

    if (!skill) {
      return false
    }

    if (!skill.unlocked || !skill.equipped || skill.remainingCooldown > 0) {
      return false
    }

    // "Luyện Khí kì chỉ mở đánh thường, Trúc Cơ mở tuyệt kỹ, nộ kỹ
    // tạm thời chưa ra mắt" (2026-08-15, áp dụng MỌI path) —
    // `unreleased` chặn cứng bất kể cảnh giới (dỡ bỏ sau khi nội dung
    // thật sự phát hành, chỉ cần xoá field này). `requiredRealmId` so
    // theo realmIndex (0-based, xem core/realm/realmSystem.ts) — thấp
    // hơn cảnh giới yêu cầu thì chưa dùng được, KHÔNG liên quan gì
    // đến việc đã HỌC skill hay chưa (unlocked/equipped vẫn giữ
    // nguyên, chỉ tạm khoá quyền CAST).
    if (skill.unreleased) {
      return false
    }

    if (skill.requiredRealmId && entity.realmIndex < getRealmIndex(skill.requiredRealmId)) {
      return false
    }

    return this.hasEnoughResource(skill, entity)
  }

  canUseInSlot(skillId: string, slotIndex: number, entity: CombatEntity): boolean {
    const skill = this.manager.get(skillId)
    if (!skill || (skill.remainingCooldownBySlot?.[slotIndex] ?? 0) > 0) return false
    // Tạm bỏ qua global cooldown để xét riêng slot — try/finally để
    // remainingCooldown LUÔN được khôi phục kể cả khi canUse() throw.
    const globalCooldown = skill.remainingCooldown
    skill.remainingCooldown = 0
    try {
      return this.canUse(skillId, entity)
    } finally {
      skill.remainingCooldown = globalCooldown
    }
  }

  private hasEnoughResource(skill: Skill, entity: CombatEntity): boolean {
    const cost = skill.cost ?? 0

    switch (skill.resourceType) {
      case 'mana':
        return entity.currentMp >= cost

      case 'rage':
        return entity.currentRage >= cost

      case 'sword_intent':
        return entity.currentSwordIntent >= cost

      case 'momentum':
        return entity.currentMomentum >= cost

      default:
        return true
    }
  }

  use(skillId: string, entity: CombatEntity): Skill | null {
    if (!this.canUse(skillId, entity)) {
      return null
    }

    const skill =
      this.manager.get(skillId)!

    skill.remainingCooldown = skill.cooldown

    this.consumeResource(skill, entity)
    this.gainCastExperience(skill)

    return skill
  }

  /**
   * Cast transaction (combat-skill-flow-element-power-dot-plan.md §4.1)
   * — BẮT ĐẦU niệm: CHỈ trừ tài nguyên MỘT LẦN, KHÔNG set cooldown
   * (cooldown commit lúc hoàn tất/fizzle qua commitSlotCooldown()).
   * Trả null nếu không đủ điều kiện — khi đó KHÔNG mutate gì.
   */
  beginCastInSlot(skillId: string, slotIndex: number, entity: CombatEntity): Skill | null {
    if (!this.canUseInSlot(skillId, slotIndex, entity)) return null

    const skill = this.manager.get(skillId)!

    this.consumeResource(skill, entity)
    this.gainCastExperience(skill)

    return skill
  }

  /**
   * Nửa còn lại của transaction — commit cooldown ĐẦY ĐỦ cho đúng slot,
   * gọi lúc HOÀN TẤT niệm (kể cả fizzle) hoặc ngay sau resolve với skill
   * tức thời (§4.2). Policy 'attack_speed' không dùng cooldown clock →
   * no-op ở đây (cadence do BattleSystem quản).
   */
  commitSlotCooldown(skillId: string, slotIndex: number): void {
    const skill = this.manager.get(skillId)

    if (!skill) {
      return
    }

    skill.remainingCooldownBySlot ??= {}

    if (usesCooldownClock(skill.execution)) {
      skill.remainingCooldownBySlot[slotIndex] = skill.cooldown
    }
  }

  /**
   * Legacy một-câu (begin + commit cùng lúc) — CHỈ còn cho skill TỨC
   * THỜI ngoài scheduler; BattleSystem đã chuyển sang cặp
   * beginCastInSlot()/commitSlotCooldown().
   */
  useInSlot(skillId: string, slotIndex: number, entity: CombatEntity): Skill | null {
    const skill = this.beginCastInSlot(skillId, slotIndex, entity)

    if (!skill) return null

    this.commitSlotCooldown(skillId, slotIndex)

    return skill
  }

  private consumeResource(skill: Skill, entity: CombatEntity) {
    const cost = skill.cost ?? 0

    if (skill.resourceType === 'mana') entity.currentMp -= cost
    else if (skill.resourceType === 'rage') entity.currentRage -= cost
    else if (skill.resourceType === 'sword_intent') entity.currentSwordIntent -= cost
    else if (skill.resourceType === 'momentum') entity.currentMomentum -= cost
  }

  private gainCastExperience(skill: Skill): void {
    if (skill.id !== 'tram') return

    skill.experience = (skill.experience ?? 0) + 1
    skill.totalExperience = (skill.totalExperience ?? 0) + 1

    const targetLevel = getHuyKiemLevelForCasts(skill.totalExperience)

    if (targetLevel > skill.level) {
      const levelsGained = targetLevel - skill.level
      skill.level = targetLevel
      this.onLevelUp?.(skill, levelsGained)
    }
  }

  update(deltaSeconds: number, cooldownReduction = 0) {
    const effectiveDelta = deltaSeconds * (1 + Math.min(3, Math.max(0, cooldownReduction)))

    for (
      const skill
      of this.manager.getAll()
    ) {
      for (const slot of Object.keys(skill.remainingCooldownBySlot ?? {})) {
        const slotIndex = Number(slot)
        skill.remainingCooldownBySlot![slotIndex] = Math.max(
          0,
          (skill.remainingCooldownBySlot![slotIndex] ?? 0) - effectiveDelta,
        )
      }
      if (
        skill.remainingCooldown <= 0
      ) {
        continue
      }

      skill.remainingCooldown =
        Math.max(
          0,
          skill.remainingCooldown -
            effectiveDelta,
        )
    }
  }
}
