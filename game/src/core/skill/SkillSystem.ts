import type { Skill } from './Skill'
import { SKILL_RESOURCE_STAT_KEYS, createSkillRuntimeStats, type SkillRuntimeStats } from './SkillRuntimeStats'
import type { SkillEffect } from './SkillEffect'
import type { StatModifier } from '../stats/StatCalculator'
import type { PassiveTrigger } from './SkillTypes'
import type { PlayerData } from '../player/Player'
import { getSkillUpgradeInsightCost } from './SkillUpgradeBalance'
import type { TriggerBinding } from './SkillTrigger'
import type { DealDamageAction } from './SkillAction'

import {
  SkillManager,
} from './SkillManager'

import type { ActionTargeting } from '../battle/CombatAction'

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

// The Tu Reimagined (spec 2026-09-15, T6) — cast-leveling generalized
// from the tram special-case into a data table: any skill id listed here
// auto-levels by totalExperience in recordCast() and is rejected by the
// insight-upgrade path. The Tu An's ritual gate reads huy_quyen Lv3.
export const CAST_LEVELING_THRESHOLDS: Record<string, { lv2: number; lv3: number }> = {
  tram: { lv2: 1000, lv3: 10000 },
  huy_quyen: { lv2: 1000, lv3: 10000 },
}

/** Level a cast-leveled skill reaches at totalExperience casts (1 below lv2). */
export function getCastLeveledSkillLevel(skillId: string, totalExperience: number): number {
  const thresholds = CAST_LEVELING_THRESHOLDS[skillId]

  if (!thresholds) return 1
  if (totalExperience >= thresholds.lv3) return 3
  if (totalExperience >= thresholds.lv2) return 2
  return 1
}

/** Mốc level tuyến tính: Lv2 tại 1000 cast, Lv3 tại 10000 cast. */
export function getHuyKiemLevelForCasts(totalExperience: number): number {
  return getCastLeveledSkillLevel('tram', totalExperience)
}

/** Ngưỡng cast Huy Kiếm đạt Lv3 — route Kiếm Tu chốt Bạt Kiếm khi
 * tram ≥ mốc này (spec 2026-08-29-kiem-the-kiem-y mục 1). */
export const HUY_KIEM_L3_CASTS = CAST_LEVELING_THRESHOLDS['tram']!.lv3

/** Ngưỡng cast Hủy Quyền đạt Lv3 — cổng offer the_tu_an tại Nghi Lễ
 * Nhập Môn (spec 2026-09-15 T6, xem CultivationPathKit.offerGate). */
export const HUY_QUYEN_L3_CASTS = CAST_LEVELING_THRESHOLDS['huy_quyen']!.lv3

export interface EffectiveSkill {
  effects: SkillEffect[]

  triggers?: TriggerBinding[]

  passiveModifiers?: StatModifier[]

  passiveTrigger?: PassiveTrigger

  // Talent v4 (spec 2026-09-03 §3.3 E2) — 2 field passive mở rộng
  // phải xuyên qua getEffectiveSkill() để PassiveSystem đọc được từ
  // EffectiveSkill (không đọc thẳng Skill instance).
  passiveCondition?: Skill['passiveCondition']

  passiveConvertsTo?: Skill['passiveConvertsTo']

  // Pháp Tu Thuần Hệ (Task 10) — specialization.targetingOverride: có
  // thì thay targeting skill gốc (xem SkillSpecialization).
  targeting?: ActionTargeting
}

export class SkillSystem {
  constructor(
    private readonly manager: SkillManager,
    private readonly onLevelUp?: (skill: Skill, levelsGained: number) => void,
  ) {}

  // Kiếm Tu (2026-08-28) — NodeSystem.hasPrerequisite() chỉ nhận
  // PlayerData (không có SkillManager) nên không đọc totalExperience/
  // level của skill trực tiếp. Sink này đồng bộ mirror
  // player.skillCastCounts/skillLevels mỗi lần recordCast() — GameManager
  // nối vào activePlayer (xem GameManager's constructor).
  private castCountSink?: (skillId: string, totalExperience: number, level: number) => void

  setCastCountSink(sink: (skillId: string, totalExperience: number, level: number) => void): void {
    this.castCountSink = sink
  }

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

    const scaleDamageValue = (value: number): number =>
      isHuyKiem ? value + getHuyKiemFlatDamageBonus(skill.totalExperience ?? 0) : value * levelMultiplier

    const effects = baseEffects.map((effect) => {
      if (effect.type !== 'damage' || effect.value === undefined) {
        return effect
      }

      return { ...effect, value: scaleDamageValue(effect.value) }
    })

    // Trigger/Action rework (2026-08-31 spec) — mirrors the effects
    // mapping above for skills already migrated to `triggers`: a
    // `dealDamage` action's `value` gets the same per-level/flat-bonus
    // treatment `effect.value` gets. Skills still on `effects` have
    // `skill.triggers === undefined`, so this is a no-op for them.
    const triggers = skill.triggers?.map((binding) => ({
      ...binding,
      actions: binding.actions.map((action) => {
        if (action.type !== 'dealDamage' || action.value === undefined) {
          return action
        }

        return { ...action, value: scaleDamageValue(action.value) } satisfies DealDamageAction
      }),
    }))

    return {
      effects,

      triggers,

      passiveModifiers: specialization?.passiveModifiersOverride ?? skill.passiveModifiers,

      passiveTrigger: specialization?.passiveTriggerOverride ?? skill.passiveTrigger,

      // Talent v4 E2 — condition/convert không thuộc specialization
      // override (đúng theo spec: 2 field này là ngữ nghĩa talent,
      // luôn xuyên qua từ Skill gốc).
      passiveCondition: skill.passiveCondition,

      passiveConvertsTo: skill.passiveConvertsTo,

      targeting: specialization?.targeting ?? skill.targeting,
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

    if (!skill || skill.id in CAST_LEVELING_THRESHOLDS || skill.level >= skill.maxLevel) {
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

    if (!skill || skill.id in CAST_LEVELING_THRESHOLDS || skill.level >= skill.maxLevel) {
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

    return true
  }

  unequipFromSlot(slotIndex: number): boolean {
    const skill = this.manager.getEquippedInSlot(slotIndex)
    if (!skill) return false
    skill.loadoutSlots = (skill.loadoutSlots ?? []).filter(index => index !== slotIndex)
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

    return true
  }

  /**
   * 9.5 #9 — record ONE committed cast reported by the turn engine
   * (TurnBattleSystem.onSkillCast, wired via GameManagerTurnBattleOps for
   * the primary player only). Generic per learned skill: totalExperience
   * is the cast counter the PlayerData skillCastCounts mirror reflects.
   * Cast-leveled skills (CAST_LEVELING_THRESHOLDS — tram, huy_quyen)
   * additionally auto-level via getCastLeveledSkillLevel; tram also keeps
   * the legacy per-cast experience tick feeding getHuyKiemFlatDamageBonus.
   * Every other skill levels only through upgradeSkill (Cam Ngo).
   * No-op for unknown/unlearned ids (e.g. 'generic_physical').
   */
  recordCast(skillId: string): void {
    const skill = this.manager.get(skillId)

    if (!skill) {
      return
    }

    skill.totalExperience = (skill.totalExperience ?? 0) + 1

    if (skill.id in CAST_LEVELING_THRESHOLDS) {
      if (skill.id === 'tram') {
        skill.experience = (skill.experience ?? 0) + 1
      }

      const targetLevel = getCastLeveledSkillLevel(skill.id, skill.totalExperience)

      if (targetLevel > skill.level) {
        const levelsGained = targetLevel - skill.level
        skill.level = targetLevel
        this.onLevelUp?.(skill, levelsGained)
      }
    }

    this.castCountSink?.(skill.id, skill.totalExperience, skill.level)
  }
}
