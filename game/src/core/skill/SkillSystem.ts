import type { Skill } from './Skill'
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

    const effects = baseEffects.map(effect =>
      effect.type === 'damage' && effect.value !== undefined
        ? { ...effect, value: effect.value * levelMultiplier }
        : effect,
    )

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

    if (!skill || skill.level >= skill.maxLevel) {
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

    if (!skill || skill.level >= skill.maxLevel) {
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
    })

    return true
  }

  /**
   * PLAN HOÀN CHỈNH mục 8/12 — Skill Loadout: set 1 skill ĐÃ HỌC vào
   * ĐÚNG 1 trong 5 slot. Dọn các trường hợp trùng trước khi gán: (1)
   * skill KHÁC đang chiếm sẵn slotIndex này — bật ra; (2) CHÍNH skill
   * này đang ở 1 slot khác (hoặc equipped rời rạc qua
   * equipWithoutSlot()) — dời hẳn qua slot mới; (3) skill MỚI là
   * isBasicAttack — bật skill isBasicAttack KHÁC đang equip (bất kể có
   * slot hay không, xem clearOtherBasicAttack()) vì tại 1 thời điểm
   * CHỈ 1 đòn cơ bản có hiệu lực (thay mutual-exclusion theo category
   * 'basic' cũ). Validate slotIndex hợp lệ theo tiến trình cảnh giới
   * (getSkillLoadoutSlotCount) là việc của
   * GameManager.setSkillLoadoutSlot() — hàm này thuần domain, không
   * biết gì về realm.
   */
  equipToSlot(skillId: string, slotIndex: number): boolean {
    const skill = this.manager.get(skillId)

    if (!skill || !skill.unlocked) {
      return false
    }

    if (skill.isBasicAttack) {
      for (const other of this.manager.getAll()) {
        if (other.id !== skillId && other.isBasicAttack) {
          other.equipped = false
          other.loadoutSlot = undefined
          other.loadoutSlots = []
        }
      }
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
    skill.equipped = skill.isBasicAttack === true || skill.loadoutSlots.length > 0
    return true
  }

  /**
   * Equip KHÔNG qua slot — CHỈ dùng cho skill "đóng khung" (Phàm Nhân's
   * Trảm, chưa có Skill Loadout UI nào để set vào; kit cố định của
   * profession lúc khởi tạo) — xem Skill.isBasicAttack. Không dùng cho
   * luồng người chơi tự chọn skill vào Loadout (đó là equipToSlot()).
   */
  equipWithoutSlot(skillId: string): boolean {
    const skill = this.manager.get(skillId)

    if (!skill || !skill.unlocked) {
      return false
    }

    // Cùng bất biến "chỉ 1 đòn cơ bản tại 1 thời điểm" với equipToSlot()
    // — cần thiết cho trường hợp Kiếm Tu's ngu_kiem_thuat (equip qua
    // slot 0) GHI ĐÈ basic_strike (equip không slot lúc khởi tạo Phàm
    // Nhân), y hệt hành vi mutual-exclusion category 'basic' cũ.
    if (skill.isBasicAttack) {
      for (const other of this.manager.getAll()) {
        if (other.id !== skillId && other.isBasicAttack) {
          other.equipped = false
          other.loadoutSlot = undefined
        }
      }
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

    if (
      !skill.unlocked ||
      !skill.equipped ||
      // Basic attacks are paced exclusively by Battle.playerAttackTimer
      // (attack speed). Their data cooldown must not create alternating
      // skill/fallback attacks when attackSpeed is greater than 1.
      (!skill.isBasicAttack && skill.remainingCooldown > 0)
    ) {
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
    const globalCooldown = skill.remainingCooldown
    skill.remainingCooldown = 0
    const canUse = this.canUse(skillId, entity)
    skill.remainingCooldown = globalCooldown
    return canUse
  }

  private hasEnoughResource(skill: Skill, entity: CombatEntity): boolean {
    switch (skill.resourceType) {
      case 'mana':
        return entity.currentMp >= skill.cost

      case 'rage':
        return entity.currentRage >= skill.cost

      case 'sword_intent':
        return entity.currentSwordIntent >= skill.cost

      case 'momentum':
        return entity.currentMomentum >= skill.cost

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

    skill.remainingCooldown = skill.isBasicAttack ? 0 : skill.cooldown

    if (skill.resourceType === 'mana') {
      entity.currentMp -= skill.cost
    } else if (skill.resourceType === 'rage') {
      entity.currentRage -= skill.cost
    } else if (skill.resourceType === 'sword_intent') {
      entity.currentSwordIntent -= skill.cost
    } else if (skill.resourceType === 'momentum') {
      entity.currentMomentum -= skill.cost
    }

    return skill
  }

  useInSlot(skillId: string, slotIndex: number, entity: CombatEntity): Skill | null {
    if (!this.canUseInSlot(skillId, slotIndex, entity)) return null
    const skill = this.manager.get(skillId)!
    skill.remainingCooldownBySlot ??= {}
    skill.remainingCooldownBySlot[slotIndex] = skill.cooldown
    this.consumeResource(skill, entity)
    return skill
  }

  private consumeResource(skill: Skill, entity: CombatEntity) {
    if (skill.resourceType === 'mana') entity.currentMp -= skill.cost
    else if (skill.resourceType === 'rage') entity.currentRage -= skill.cost
    else if (skill.resourceType === 'sword_intent') entity.currentSwordIntent -= skill.cost
    else if (skill.resourceType === 'momentum') entity.currentMomentum -= skill.cost
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
