import type { Battle } from './Battle'

import type { CombatEntity } from '../combat/CombatEntity'
import type { CombatSystem } from '../combat/CombatSystem'

import type { BuffRegistry } from '../buff/BuffRegistry'
import type { BuffSystem } from '../buff/BuffSystem'

import type { EventBus } from '../events/EventBus'
import type { ReactionManager } from '../element/ReactionManager'

import type { StatModifier } from '../stats/StatCalculator'

import type { Skill } from '../skill/Skill'
import type { SkillEffect } from '../skill/SkillEffect'
import type { SkillSystem } from '../skill/SkillSystem'
import type { SkillEffectContext, SkillEffectSystem } from '../skill/SkillEffectSystem'
import type { SkillTriggerRunner } from '../skill/SkillTriggerRunner'
import { getSkillRuntimeStat } from '../skill/SkillRuntimeStats'

import type {
  ActionDamageInfo,
  ActionImpactSystem,
  HitResolveOptions,
} from './ActionImpactSystem'
import { targetingForSkill, vfxPresetForSkill, type EffectScope } from './CombatAction'
import { areaFor, collectAffected } from './ActionTargetingSystem'
import { worldToGridPosition } from './BattleGrid'
import { gainPhapTuCastResources } from './PhapTuBattleResourceSystem'
import {
  gainKiemTheOnFormationCast,
  kiemTheDamageBonusPercent,
} from './KiemTuResourceSystem'
import { resolveOnHitEffects } from './KiemTranOnHitSystem'
import { getFormationSwordCount } from '../../data/progression/KiemTuNodes'
import type { OnHitEffectKind } from '../progression/ProgressionNode'

// Phase 7 mechanical split (Task 6, 2026-09-02) — extracted VERBATIM từ
// BattleSystem.resolveSkillEffects()/resolvePlayerSkillEffects()/
// resolveOnHitForBattle()/dispatchOnHitEffect() + module-local helper
// scopeForEffect(). KHÔNG đổi hành vi; comments gốc giữ nguyên. Xem
// BattleSystem.ts cho phần còn lại của pipeline cast (FSM cast/channel
// vẫn ở đó và gọi vào đây).

type LavaZoneSpec = NonNullable<SkillEffectContext['spawnLavaZone']> extends (
  spec: infer S,
) => void
  ? S
  : never

type SwordZoneSpec = NonNullable<SkillEffectContext['spawnSwordZone']> extends (
  spec: infer S,
) => void
  ? S
  : never

/**
 * Collaborator surface của resolver — 16 dependency, tất cả là instance
 * readonly hoặc closure BattleSystem đã có sẵn (không có state riêng nào
 * được sao chép sang đây). `buffSystemFor` gộp cặp getBuffSystem(
 * getBuffsFor(...)) vốn LUÔN đi cùng nhau ở mọi call site được tách.
 */
export interface SkillEffectResolverDeps {
  readonly combat: CombatSystem
  readonly skillSystem: SkillSystem
  readonly skillEffectSystem: SkillEffectSystem
  readonly buffRegistry: BuffRegistry
  readonly eventBus: EventBus
  readonly actionImpact: ActionImpactSystem
  readonly reactionManager: ReactionManager
  readonly skillTriggerRunner: SkillTriggerRunner

  readonly getReactionKeepChance: () => number
  readonly getKiemTuRoute: () => 'kiem_tran' | 'bat_kiem' | undefined
  readonly getOnHitNodeLevels: () => Record<string, number>

  /** BattleSystem.battle (private field) — dispatchOnHitEffect đọc live. */
  readonly getCurrentBattle: () => Battle | null

  /** BattleSystem.getBuffSystem(this.getBuffsFor(battle, entity)). */
  readonly buffSystemFor: (battle: Battle, entity: CombatEntity) => BuffSystem

  readonly applyActionHit: (
    battle: Battle,
    source: CombatEntity,
    target: CombatEntity,
    damage: ActionDamageInfo,
    options: HitResolveOptions,
  ) => { landed: boolean }

  readonly spawnLavaZone: (battle: Battle, spec: LavaZoneSpec) => void
  readonly spawnSwordZone: (battle: Battle, spec: SwordZoneSpec) => void
}

function scopeForEffect(effect: SkillEffect): EffectScope {
  if (effect.scope) {
    return effect.scope
  }

  return effect.type === 'heal' || effect.type === 'buff' ? 'source' : 'affected_targets'
}

export class SkillEffectResolver {
  constructor(private readonly deps: SkillEffectResolverDeps) {}

  /**
   * Kiếm Thế (spec 2026-08-29-kiem-the-kiem-y mục 2) — wrapper cho
   * resolveSkillEffects với skill CỦA PLAYER: cast kiếm trận
   * (kiem_tran_*) +số kiếm của trận vào pool (cap 100), và mọi hit
   * kiếm trận được cộng +1% sát thương mỗi 2 điểm Kiếm Thế hiện có
   * (đầy 100 = +50%) qua cùng đường finalDamagePercent snapshot như
   * amp Bạt Kiếm. Ult TTKT KHÔNG đi qua đây (nút manual riêng).
   */
  resolvePlayerSkillEffects(
    skill: Skill,
    source: CombatEntity,
    target: CombatEntity,
    battle: Battle,
  ) {
    const isFormation = skill.id.startsWith('kiem_tran_')
    const route = this.deps.getKiemTuRoute()

    if (!isFormation || route !== 'kiem_tran') {
      this.resolveSkillEffects(skill, source, target, battle)
      return
    }

    const swordCount = getFormationSwordCount(skill.id) ?? 0

    const originalFinalDamagePercent = source.stats.finalDamagePercent

    // +1% mỗi 2 điểm Kiếm Thế (đầy 100 = +50%) — quy về FRACTION cùng
    // thang finalDamagePercent (0.5 = +50%).
    const kiemTheBonus = kiemTheDamageBonusPercent(source.currentKiemThe ?? 0) / 100

    if (kiemTheBonus > 0) {
      source.stats.finalDamagePercent = originalFinalDamagePercent + kiemTheBonus
    }

    try {
      this.resolveSkillEffects(skill, source, target, battle)
    } finally {
      source.stats.finalDamagePercent = originalFinalDamagePercent
    }

    // On-hit kiếm trận (spec 2026-08-29 mục 4) — roll sau mỗi cast,
    // áp lên MỌI địch còn sống trong trận (hit kiếm trận là AoE theo
    // targeting; ult TTKT nuke/zone cũng đi qua wrapper này).
    if (battle.enemies.some((enemy) => enemy.entity.alive)) {
      this.resolveOnHitForBattle(battle, source, swordCount)
    }

    // Gain SAU resolve: pool tăng theo cast vừa tung, hưởng từ cast kế.
    gainKiemTheOnFormationCast(source, swordCount)
  }

  /** Roll + dispatch on-hit kiếm trận lên mọi địch còn sống. */
  private resolveOnHitForBattle(battle: Battle, source: CombatEntity, swordCount: number) {
    const nodeLevels = this.deps.getOnHitNodeLevels()
    if (Object.keys(nodeLevels).length === 0) {
      return
    }

    for (const enemy of battle.enemies) {
      if (!enemy.entity.alive) {
        continue
      }

      resolveOnHitEffects(
        nodeLevels,
        Math.random,
        source,
        enemy.entity,
        swordCount,
        (kind, _source, target, swords) => this.dispatchOnHitEffect(kind, _source, target, swords),
      )
    }
  }

  /** Map từng kind on-hit vào hệ thống sẵn có (spec mục 4 — qua pipeline). */
  private dispatchOnHitEffect(
    kind: OnHitEffectKind,
    source: CombatEntity,
    target: CombatEntity,
    swordCount: number,
  ) {
    const battle = this.deps.getCurrentBattle()
    if (!battle) {
      return
    }

    switch (kind) {
      case 'khiem_khi_dmg': {
        // Kiếm khí bổ sung — bonus damage kim qua applyModifiedDirectDamage
        // (pipeline CombatSystem sẵn có, KHÔNG hack trực tiếp).
        const bonus = 0.5 * swordCount * source.stats.attack
        this.deps.combat.applyModifiedDirectDamage(target, bonus, source, 'damage')
        break
      }
      case 'xuat_huyet_dot': {
        // Chảy máu — tái dùng buff/debuff van_kiem_vu sẵn có.
        const buff = this.deps.buffRegistry.get('van_kiem_vu')
        if (buff) {
          this.deps.buffSystemFor(battle, target).apply(
            buff,
            source,
            target,
            this.deps.buffRegistry,
          )
        }
        break
      }
      case 'tran_tru_cc': {
        // Trói chân/choáng — buff/debuff sẵn có theo roll phụ.
        const ccId = Math.random() < 0.5 ? 'troi_chan' : 'choang'
        const buff = this.deps.buffRegistry.get(ccId)
        if (buff) {
          this.deps.buffSystemFor(battle, target).apply(
            buff,
            source,
            target,
            this.deps.buffRegistry,
          )
        }
        break
      }
      case 'hap_linh_leech': {
        // Hút máu theo sát thương ước lượng (leechPercent pipeline).
        const heal = source.stats.attack * 0.2 * swordCount * 0.1
        if (heal > 0 && source.alive) {
          this.deps.combat.applyHealing(source, heal, source.id, 'healing')
        }
        break
      }
      case 'khiem_phong_haste':
      case 'phan_kich_dodge':
      case 'pha_giap_pen':
      case 'quang_crit':
      case 'than_ngu_hanh': {
        // Stat-based kinds — buff stack tạm trong trận qua BuffPool
        // sẵn có (tự hết khi trận kết thúc vì battle buff managers là
        // runtime-per-battle). Modifier pipeline là nguồn tính lại
        // stats (calculateStats chạy mỗi update).
        const statByKind: Record<string, StatModifier['stat']> = {
          khiem_phong_haste: 'attackSpeed',
          phan_kich_dodge: 'evasionRate',
          pha_giap_pen: 'metalPenetration',
          quang_crit: 'criticalRate',
          than_ngu_hanh: 'metalPower',
        }
        const statKey = statByKind[kind] as (typeof statByKind)[string] | undefined
        if (statKey) {
          const buffId = `onhit_${kind}`
          const definition = this.deps.buffRegistry.get(buffId)
          if (definition) {
            this.deps.buffSystemFor(battle, source).apply(definition, source, source, this.deps.buffRegistry)
          }
        }
        break
      }
    }
  }

  resolveSkillEffects(
    skill: Skill,
    source: CombatEntity,
    target: CombatEntity,
    battle: Battle,
  ) {
    gainPhapTuCastResources(skill, source)

    // Nguồn duy nhất emit 'cast' — PassiveSystem dùng event này cho

    // passive có trigger 'cast'.

    this.deps.eventBus.emit('cast', {
      type: 'cast',

      sourceId: source.id,

      targetId: target.id,

      skillId: skill.id,

      skillName: skill.name,
    })

    const sourceBuffs = this.deps.buffSystemFor(battle, source)

    // Đọc qua getEffectiveSkill() để tôn trọng Specialization đã

    // chọn (behavior-changing node) + effect 'damage' đã scale theo

    // level hiện tại.

    const effective = this.deps.skillSystem.getEffectiveSkill(skill, source.skillLevels?.[skill.id])

    // Combat Grid Rework — MỘT action = MỘT impact VFX: mở batch trước

    // vòng lặp, đóng sau; mọi fireHit trong lúc đó đăng ký target vào

    // cùng event action_impact neo tại ô PRIMARY target.

    const earthPureActive =
      effective.effects.some((effect) => effect.earthPureAreaBehavior === true) &&
      getSkillRuntimeStat(source, 'earthAoeRadius') > 0

    const baseTargeting = targetingForSkill(skill)
    const laneRadius = earthPureActive
      ? Math.max(1, Math.round(getSkillRuntimeStat(source, 'earthAoeRadius')))
      : (baseTargeting.laneRadius ?? 0)
    const columnRadius = earthPureActive ? laneRadius : (baseTargeting.columnRadius ?? 0)
    const targeting = earthPureActive
      ? { ...baseTargeting, shape: 'area' as const, laneRadius, columnRadius }
      : baseTargeting
    const anchorCell = worldToGridPosition(target.x, target.row + 0.5)
    const affectedArea = areaFor(target.row, anchorCell.column, targeting)

    if (!affectedArea) {
      return
    }

    this.deps.actionImpact.beginSkillBatch({
      actionId: skill.id,

      sourceId: source.id,

      primaryTargetId: target.id,

      presetId: vfxPresetForSkill(skill),

      anchorCell,
      area: { ...affectedArea, shape: targeting.shape },
      hitCount: effective.effects.some((effect) => effect.hitCountByRealm)
        ? source.realmIndex + 1
        : 1,

      secondaryPercent: earthPureActive
        ? getSkillRuntimeStat(source, 'earthAoeSecondaryDamagePercent')
        : undefined,

      knockbackDistance: earthPureActive
        ? getSkillRuntimeStat(source, 'earthKnockbackDistance')
        : undefined,
    })

    const targets =
      skill.target === 'self'
        ? [source]
        : collectAffected(battle, source, target.id, target.row, anchorCell.column, targeting)

    const applyEffects = (effects: SkillEffect[], oneTarget: CombatEntity) => {
      let landedHit = false
      const targetBuffs = this.deps.buffSystemFor(battle, oneTarget)

      this.deps.skillEffectSystem.applyAll(effects, source, oneTarget, {
        combatSystem: this.deps.combat,
        fireHit: (hitTarget, damageInfo) => {
          const result = this.deps.actionImpact.fireSkillHit(
            battle,

            source,

            hitTarget,

            damageInfo,

            { skillId: skill.id },

            (battleRef, hitSource, hitTargetEntity, hitDamage, hitOptions) => {
              return this.deps.applyActionHit(
                battleRef,
                hitSource,
                hitTargetEntity,
                hitDamage,
                hitOptions,
              )
            },
          )

          landedHit ||= result.landed
          return result
        },
        didLandHit: () => landedHit,
        buffRegistry: this.deps.buffRegistry,

        sourceBuffs,

        targetBuffs,

        reactionManager: this.deps.reactionManager,

        reactionKeepChance: this.deps.getReactionKeepChance(),

        spawnLavaZone: (spec) => this.deps.spawnLavaZone(battle, spec),

        spawnSwordZone: (spec) => this.deps.spawnSwordZone(battle, spec),

        skillId: skill.id,

        skillExperience: skill.totalExperience ?? skill.experience ?? 0,

        eventBus: this.deps.eventBus,
      })
    }

    const sourceEffects = effective.effects.filter((effect) => scopeForEffect(effect) === 'source')
    const primaryEffects = effective.effects.filter(
      (effect) => scopeForEffect(effect) === 'primary_target',
    )
    const areaEffects = effective.effects.filter(
      (effect) => scopeForEffect(effect) === 'affected_targets',
    )

    if (sourceEffects.length > 0) {
      applyEffects(sourceEffects, source)
    }

    if (primaryEffects.length > 0) {
      applyEffects(primaryEffects, target)
    }

    for (const oneTarget of targets) {
      applyEffects(areaEffects, oneTarget)
    }

    // Trigger/Action rework (2026-08-31 spec) — skills fully migrated to
    // `triggers` (effective.effects === []) fire onCast here instead.
    // Reuses the SAME batch (beginSkillBatch() already ran above) so
    // ctx.fireHit still lands inside one action_impact VFX event.
    if (effective.triggers?.length) {
      for (const oneTarget of targets) {
        let landedHit = false
        const targetBuffs = this.deps.buffSystemFor(battle, oneTarget)

        const triggerCtx: SkillEffectContext = {
          combatSystem: this.deps.combat,
          fireHit: (hitTarget, damageInfo) => {
            const result = this.deps.actionImpact.fireSkillHit(
              battle,
              source,
              hitTarget,
              damageInfo,
              { skillId: skill.id },
              (battleRef, hitSource, hitTargetEntity, hitDamage, hitOptions) =>
                this.deps.applyActionHit(battleRef, hitSource, hitTargetEntity, hitDamage, hitOptions),
            )
            landedHit ||= result.landed
            return result
          },
          didLandHit: () => landedHit,
          buffRegistry: this.deps.buffRegistry,
          sourceBuffs,
          targetBuffs,
          reactionManager: this.deps.reactionManager,
          reactionKeepChance: this.deps.getReactionKeepChance(),
          spawnLavaZone: (spec) => this.deps.spawnLavaZone(battle, spec),
          spawnSwordZone: (spec) => this.deps.spawnSwordZone(battle, spec),
          skillId: skill.id,
          skillExperience: skill.totalExperience ?? skill.experience ?? 0,
          eventBus: this.deps.eventBus,
        }

        this.deps.skillTriggerRunner.fire(
          'onCast',
          { source, skill },
          effective.triggers,
          source,
          oneTarget,
          triggerCtx,
        )
      }
    }

    this.deps.actionImpact.endSkillBatch(battle)
  }
}
