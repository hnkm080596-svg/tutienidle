import type { Skill } from './Skill'
import type { SkillEffect } from './SkillEffect'
import type { StatModifier } from '../stats/StatCalculator'
import type { PassiveTrigger } from './SkillTypes'
import type { TriggerBinding } from './SkillTrigger'
import type { DealDamageAction } from './SkillAction'
import {
  NEUTRAL_ROUTE_PROFILE,
  applyRouteToEffectiveSkill,
  type RouteProfile,
} from '../phap-tu/PhapTuRoutes'

import {
  SkillManager,
} from './SkillManager'
import {
  CAST_LEVELING_THRESHOLDS,
  getCastLeveledSkillLevel,
} from './CastLeveling'

import type { ActionTargeting } from '../battle/CombatAction'
import type { SkillProgressionState } from '../skilldef/SkillProgressionState'
import type { SkillId } from '../battle/contracts/ids'

// Core Loop Foundation checklist (Muc SKILL, "Skill modifier") - moi
// bac level cong them % sat thuong cho effect 'damage' cua skill chu
// dong. Passive dung CHUNG co che perLevelFlat/perLevelPercent da co
// san tren StatModifier (giong TechniqueSystem.getActiveModifiers()),
// khong can hang so rieng.
const ACTIVE_SKILL_DAMAGE_PERCENT_PER_LEVEL = 0.05

export const HUY_KIEM_CASTS_PER_LEVEL = 10

/** Moi 10 cast vinh vien +1 flat damage cho Huy Kiem - KHONG tran. */
export function getHuyKiemFlatDamageBonus(totalExperience: number): number {
  return Math.floor(Math.max(0, totalExperience) / HUY_KIEM_CASTS_PER_LEVEL)
}

// P1 - the cast-leveling table lives in ./CastLeveling (a leaf module):
// CultivationPathKit evaluates offer gates through it, and NodeSystem
// consumes the path authority - re-exported here so existing import
// sites keep working. See CastLeveling.ts for the cycle note.
export {
  CAST_LEVELING_THRESHOLDS,
  getCastLeveledSkillLevel,
  HUY_KIEM_L3_CASTS,
  HUY_QUYEN_L3_CASTS,
} from './CastLeveling'

export interface EffectiveSkill {
  effects: SkillEffect[]

  triggers?: TriggerBinding[]

  passiveModifiers?: StatModifier[]

  passiveTrigger?: PassiveTrigger

  // Talent v4 (spec 2026-09-03 sec.3.3 E2) - 2 field passive mo rong
  // phai xuyen qua getEffectiveSkill() de PassiveSystem doc duoc tu
  // EffectiveSkill (khong doc thang Skill instance).
  passiveCondition?: Skill['passiveCondition']

  passiveConvertsTo?: Skill['passiveConvertsTo']

  // Phap Tu Thuan He (Task 10) - specialization.targetingOverride: co
  // thi thay targeting skill goc (xem SkillSpecialization).
  targeting?: ActionTargeting
}

export class SkillSystem {
  constructor(
    private readonly manager: SkillManager,
  ) {}

  // Kiem Tu (2026-08-28) - NodeSystem.hasPrerequisite() chi nhan
  // PlayerData (khong co SkillManager) nen khong doc totalExperience/
  // level cua skill truc tiep. Sink nay dong bo mirror
  // player.skillCastCounts moi lan recordCast() - GameManager
  // noi vao activePlayer (xem GameManager's constructor). M-QI-05 -
  // the sink also receives the cast-channel TARGET level (undefined for
  // non-cast-levelled skills); canonical advancement + notification are
  // the sink owner's job (SkillSystem no longer holds a writable level).
  private castCountSink?: (skillId: string, totalExperience: number, targetLevel: number | undefined) => void

  setCastCountSink(sink: (skillId: string, totalExperience: number, targetLevel: number | undefined) => void): void {
    this.castCountSink = sink
  }

  // M-QI-05 - canonical level provider: every live level read funnels
  // through this injected seam (wired by GameManager to
  // nodeLevels[core_<id>]); Skill.level is frozen authored data.
  private skillLevelProvider?: (skillId: string) => number

  setSkillLevelProvider(provider: (skillId: string) => number): void {
    this.skillLevelProvider = provider
  }

  private levelOf(skill: Skill): number {
    return this.skillLevelProvider?.(skill.id) ?? 1
  }

  // Phap Tu Reimagined Task 3 - route profile provider. The GameManager
  // closure does ALL scoping (path + element + kit membership) so this
  // class keeps no PlayerData dependency; without a provider every
  // skill resolves under the neutral profile.
  private routeProfileProvider?: (skillId: string) => RouteProfile

  setRouteProfileProvider(provider: (skillId: string) => RouteProfile): void {
    this.routeProfileProvider = provider
  }

  /**
   * Hieu luc THAT SU cua 1 skill tai thoi diem hien tai - ap
   * Specialization (neu da chon, "behavior-changing node" thay han
   * effects/passiveModifiers/passiveTrigger goc) + scale effect
   * 'damage' theo level. MOI noi doc effects/passiveModifiers/
   * passiveTrigger cua 1 skill da hoc (combat cast, PassiveSystem
   * trigger/tick, tong hop modifier) deu phai qua ham nay thay vi doc
   * thang field tren Skill, de 1 diem duy nhat quyet dinh "skill nay
   * dang hoat dong the nao".
   */
  getEffectiveSkill(skill: Skill, levelOverride?: number): EffectiveSkill {
    const specialization = skill.specializations?.find(
      candidate => candidate.id === skill.selectedSpecializationId,
    )

    const baseEffects = specialization?.effectsOverride ?? skill.effects

    const effectiveLevel = levelOverride ?? this.levelOf(skill)
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

    // Trigger/Action rework (2026-08-31 spec) - mirrors the effects
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

    const effective: EffectiveSkill = {
      effects,

      triggers,

      passiveModifiers: specialization?.passiveModifiersOverride ?? skill.passiveModifiers,

      passiveTrigger: specialization?.passiveTriggerOverride ?? skill.passiveTrigger,

      // Talent v4 E2 - condition/convert khong thuoc specialization
      // override (dung theo spec: 2 field nay la ngu nghia talent,
      // luon xuyen qua tu Skill goc).
      passiveCondition: skill.passiveCondition,

      passiveConvertsTo: skill.passiveConvertsTo,

      targeting: specialization?.targeting ?? skill.targeting,
    }

    // Phap Tu Reimagined Task 3 - route seam 1 (effective surface):
    // direct damage + ailment chance factors. Turn-runtime fields
    // (ailmentStackBonus) apply post-conversion at the orchestration
    // site via applyRouteToTurnSkill.
    return applyRouteToEffectiveSkill(
      effective,
      this.routeProfileProvider?.(skill.id) ?? NEUTRAL_ROUTE_PROFILE,
    )
  }

  /**
   * skilldef M5f (R6) -- the canonical persistent-state projection of a
   * learned skill: level/xp/cast-count/specialization as ONE readonly
   * SkillProgressionState owned HERE (the save surface), never a field
   * read scattered across consumers. The legacy `Skill` record still
   * carries these fields today -- this is the single projection seam
   * their extraction funnels through when the skill data is redesigned
   * on SkillDefinition.
   */
  progressionOf(skill: Skill): SkillProgressionState {
    return {
      skillId: skill.id as SkillId,
      level: this.levelOf(skill),
      experience: skill.experience ?? 0,
      totalExperience: skill.totalExperience ?? 0,
      ...(skill.selectedSpecializationId !== undefined
        ? { selectedSpecializationId: skill.selectedSpecializationId }
        : {}),
    }
  }

  /**
   * skilldef M5f (R6) -- the {definition, progression} pair contract the
   * resolver's world is built on: `definition` is the specialization-
   * resolved authored payload (getEffectiveSkill), `progression` the
   * persistent state layer above. Consumers that need the split read
   * THIS; getEffectiveSkill stays for callers that only need the
   * resolved payload until the Skill data is redesigned on
   * SkillDefinition.
   */
  getResolvedSkill(
    skill: Skill,
    levelOverride?: number,
  ): { definition: EffectiveSkill; progression: SkillProgressionState } {
    return {
      definition: this.getEffectiveSkill(skill, levelOverride),
      progression: this.progressionOf(skill),
    }
  }

  /**
   * MOI passive skill da hoc (learned = manager membership; passive
   * luon co hieu luc 1 khi da hoc, giong pattern cu) cong don vao
   * player.modifiers, scale flat/percent theo level (perLevelFlat/
   * perLevelPercent, CHUNG cong thuc TechniqueSystem.getActiveModifiers()).
   * Doc qua getEffectiveSkill() de ton trong Specialization da chon.
   */
  getScaledPassiveModifiers(): StatModifier[] {
    const modifiers: StatModifier[] = []

    for (const skill of this.manager.getPassiveSkills()) {
      const effective = this.getEffectiveSkill(skill)

      for (const modifier of effective.passiveModifiers ?? []) {
        modifiers.push({
          ...modifier,

          flat: (modifier.flat ?? 0) + (modifier.perLevelFlat ?? 0) * (this.levelOf(skill) - 1),

          percent: (modifier.percent ?? 0) + (modifier.perLevelPercent ?? 0) * (this.levelOf(skill) - 1),
        })
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

  // P7-M4 -- learn() is the ONLY skill-state write: SkillManager
  // membership IS the learned authority (the retired unlocked/equipped/
  // loadout flags had no second writer). A held entry is learned;
  // learned passives always apply; combat resolves roles from the way
  // kit, never from per-skill slot state.
  learn(skill: Skill): boolean {
    if (this.manager.has(skill.id)) {
      return false
    }

    this.manager.add({
      ...structuredClone(skill),

      experience: skill.experience ?? 0,
      totalExperience: skill.totalExperience ?? 0,
    })

    return true
  }

  /**
   * 9.5 #9 - record ONE committed cast reported by the turn engine
   * (TurnBattleSystem.onSkillCast, wired via GameManagerTurnBattleOps for
   * the primary player only). Generic per learned skill: totalExperience
   * is the cast counter the PlayerData skillCastCounts mirror reflects.
   * CAST_LEVELING_THRESHOLDS skills (tram, huy_quyen) auto-level via
   * getCastLeveledSkillLevel; every other skill levels only through
   * its Core Node (progressionOps.levelUpSkill, Cam Ngo). tram also keeps the legacy per-cast
   * experience tick feeding getHuyKiemFlatDamageBonus. No-op for
   * unknown/unlearned ids (e.g. 'generic_physical').
   */
  recordCast(skillId: string): void {
    const skill = this.manager.get(skillId)

    if (!skill) {
      return
    }

    skill.totalExperience = (skill.totalExperience ?? 0) + 1

    // Cast-leveled skills (CAST_LEVELING_THRESHOLDS) auto-level by cast
    // count - the canonical nodeLevels[core] write + level-up
    // notification are the sink owner's job (M-QI-05: SkillSystem holds
    // no writable level authority). tram additionally keeps its legacy
    // per-cast `experience` tick (save-mirror parity).
    const targetLevel = getCastLeveledSkillLevel(skill.id, skill.totalExperience)

    if (targetLevel !== undefined && skill.id === 'tram') {
      skill.experience = (skill.experience ?? 0) + 1
    }

    this.castCountSink?.(skill.id, skill.totalExperience, targetLevel)
  }
}
