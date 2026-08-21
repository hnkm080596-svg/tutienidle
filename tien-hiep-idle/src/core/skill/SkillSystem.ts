import type { Skill } from './Skill'
import { SKILL_RESOURCE_STAT_KEYS } from './Skill'
import type { SkillEffect } from './SkillEffect'
import type { StatModifier } from '../stats/StatCalculator'
import type { PassiveTrigger } from './SkillTypes'

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

// Export để BattleSystem.castSkill()/PassiveSystem dùng khi gọi
// gainExperience() — tránh mỗi nơi tự định nghĩa số khác nhau.
export const ACTIVE_SKILL_XP_PER_CAST = 10

export const PASSIVE_SKILL_XP_PER_TRIGGER = 2

export interface EffectiveSkill {
  effects: SkillEffect[]

  passiveModifiers?: StatModifier[]

  passiveTrigger?: PassiveTrigger
}

export class SkillSystem {
  constructor(
    private readonly manager: SkillManager,
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
  getEffectiveSkill(skill: Skill): EffectiveSkill {
    const specialization = skill.specializations?.find(
      candidate => candidate.id === skill.selectedSpecializationId,
    )

    const baseEffects = specialization?.effectsOverride ?? skill.effects

    const levelMultiplier = 1 + (skill.level - 1) * ACTIVE_SKILL_DAMAGE_PERCENT_PER_LEVEL

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

  /**
   * Skill rework (2026-08-21) — 19 field "Thế tài nguyên" (Hỏa Thế/
   * Thủy Thế/...) sống trên object Skill (Node Tree ghi trực tiếp vào
   * đó, xem GameManager.purchaseNode()), nhưng combat vẫn đọc qua
   * CombatEntity.stats như mọi stat khác (đơn giản hơn hẳn phải tra
   * ngược "skill nào của entity này sở hữu field này" ở từng read-site
   * combat, đặc biệt với các field đọc phía TARGET như thuyThePercent
   * hay đọc NGOÀI lúc cast như hoaTheDecayReductionPercent). Hàm này
   * đồng bộ giá trị đó thành StatModifier (sourceType 'skill'), gọi bởi
   * GameManager.getAggregatedModifiers() CÙNG chỗ với
   * getScaledPassiveModifiers() — chạy lại mỗi tick, luôn phản ánh
   * đúng giá trị hiện tại trên Skill, không cần bước "resync" riêng khi
   * mua node hay khi load save.
   */
  getSkillResourceStatModifiers(): StatModifier[] {
    const modifiers: StatModifier[] = []

    for (const skill of this.manager.getAll()) {
      for (const stat of SKILL_RESOURCE_STAT_KEYS) {
        const value = skill[stat]

        if (value) {
          modifiers.push({
            id: `skill:${skill.id}:${stat}`,
            sourceId: skill.id,
            sourceType: 'skill',
            stat,
            flat: value,
          })
        }
      }
    }

    return modifiers
  }

  selectSpecialization(skillId: string, specializationId: string): boolean {
    const skill = this.manager.get(skillId)

    if (!skill || !skill.specializations?.some(candidate => candidate.id === specializationId)) {
      return false
    }

    skill.selectedSpecializationId = specializationId

    return true
  }

  gainExperience(skillId: string, amount: number) {
    const skill = this.manager.get(skillId)

    if (!skill) {
      return false
    }

    if (skill.level >= skill.maxLevel) {
      return false
    }

    skill.experience += amount

    while (skill.experience >= skill.experienceRequired) {
      skill.experience -= skill.experienceRequired

      skill.level++

      skill.experienceRequired = Math.floor(skill.experienceRequired * 1.5)

      if (skill.level >= skill.maxLevel) {
        skill.experience = 0
        break
      }
    }

    return true
  }

  learn(skill: Skill): boolean {
    if (this.manager.has(skill.id)) {
      return false
    }

    this.manager.add({
      ...skill,

      unlocked: true,
      equipped: false,

      remainingCooldown: 0,
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

    for (const other of this.manager.getAll()) {
      const conflicts = other.loadoutSlot === slotIndex
        || other.id === skillId
        || (skill.isBasicAttack && other.isBasicAttack && other.id !== skillId)

      if (conflicts) {
        other.equipped = false
        other.loadoutSlot = undefined
      }
    }

    skill.equipped = true
    skill.loadoutSlot = slotIndex

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
      skill.remainingCooldown > 0
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

    skill.remainingCooldown =
      skill.cooldown

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

  update(deltaSeconds: number, cooldownReduction = 0) {
    const effectiveDelta = deltaSeconds * (1 + cooldownReduction)

    for (
      const skill
      of this.manager.getAll()
    ) {
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