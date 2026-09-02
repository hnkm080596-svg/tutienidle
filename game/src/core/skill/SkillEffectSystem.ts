import type { SkillEffect } from './SkillEffect'
import type { CombatEntity } from '../combat/CombatEntity'
import { getSkillRuntimeStat } from './SkillRuntimeStats'
import type { CombatSystem } from '../combat/CombatSystem'
import type { BuffSystem } from '../buff/BuffSystem'
import type { BuffRegistry } from '../buff/BuffRegistry'
import type { ReactionManager } from '../element/ReactionManager'
import type { ElementType } from '../element/ElementType'
import { MAX_KIM_THE, MAX_HUYET_PHA } from '../combat/CombatTypes'
import type { ActionDamageInfo } from '../battle/ActionImpactSystem'

export interface SkillEffectContext {
  combatSystem: CombatSystem

  eventBus?: import('../events/EventBus').EventBus

  // Combat Grid Rework (2026-08-24) — bắn MỘT
  // hit impact TẠI target (windup đã trôi ở tầng cast). BattleSystem mở
  // batch quanh applyAll() để gom mọi hit thành đúng 1 action_impact.
  fireHit(target: CombatEntity, damage: ActionDamageInfo): { landed: boolean } | void

  didLandHit?(): boolean

  buffRegistry: BuffRegistry

  // Buff/debuff pool của source/target — theo đúng entity đang tham
  // gia trận (Battle.playerBuffs/enemyBuffs), không phải buff
  // persistent ngoài trận. Xem BattleSystem.ts.
  sourceBuffs: BuffSystem

  targetBuffs: BuffSystem

  // Combat Rework Phase 6 (Pháp Tu Reaction) — kiểm tra/kích phản ứng
  // ngay sau khi effect 'debuff' áp thành công, xem apply() bên dưới.
  reactionManager: ReactionManager

  // Thiên phú Phản Phác (talent-direction-choice-plan §6) — xác suất giữ
  // ailment ở nhánh consume chuẩn của ReactionManager. Nền 0/không truyền
  // = hành vi mặc định (xoá cả 2).
  reactionKeepChance?: number

  // Plans/magicpathgeneral Phase 12 (2026-08-21) — cho phép
  // ReactionManager spawn Lava Zone (Dung Nham) vào ĐÚNG `battle`
  // đang chạy — bind sẵn ở BattleSystem.castSkill(), optional vì hầu
  // hết reaction/test không cần.
  spawnLavaZone?: (spec: {
    ownerId: string
    row: number
    column: number
    laneRadius: number
    columnRadius: number
    duration: number
    tickInterval: number
    damagePerTick: number
    element: ElementType | 'physical'
  }) => void

  // Task 8 (Kiếm Trận keystone, 2026-08-28) — cho phép effect 'damage'
  // spawn SwordZone (SkillEffect.grantsSwordZone) vào ĐÚNG `battle` đang
  // chạy, bind sẵn ở BattleSystem.castSkill() cùng chỗ spawnLavaZone.
  // Optional vì hầu hết skill/test không cần.
  spawnSwordZone?: (spec: {
    ownerId: string
    row: number
    column: number
    laneRadius: number
    columnRadius: number
    charges: number
    tickInterval: number
    damagePerTick: number
    // Pháp Tu Thuần Hệ (E-5, 2026-09-03) — element của zone, mặc định
    // 'metal' (Kiếm Trận). Optional: caller cũ không truyền vẫn đúng.
    element?: ElementType
  }) => void

  // Kiếm Tu (2026-08-15) — id skill ĐANG cast, gắn vào hit lúc
  // bắn để lúc impact TRÚNG (BattleSystem's impact-resolve callback,
  // deferred — không đồng bộ với apply() này) biết tra lại đúng skill
  // nào vừa bắn ra nó, phục vụ Skill.grantsSwordIntentPerHit.
  skillId?: string

  skillExperience?: number

  // Pháp Tu Thuần Hệ (E-1/E-2, 2026-09-03) — danh sách MỌI entity
  // trúng trong cùng action (primary đứng đầu — thứ tự do
  // collectAffected() đảm bảo). Optional: caller cũ (trigger ctx,
  // test) không truyền = spreadsAilmentId/stacksPerAffectedTarget
  // coi như chỉ có primary (spread no-op, stacks = 1).
  affectedTargets?: CombatEntity[]

  // E-1 — resolver pool buff của MỘT target phụ bất kỳ (BattleSystem
  // bind theo battle; không truyền = spread bỏ qua target phụ không
  // phải ctx.targetBuffs hiện tại).
  secondaryTargetBuffs?: (target: CombatEntity) => BuffSystem | undefined
}

/**
 * Áp SkillEffect thật vào combat — trước đây SkillSystem.use() chỉ
 * set cooldown/trừ resource rồi trả skill, không có gì đọc
 * skill.effects cả. Tách riêng khỏi SkillSystem vì effect cần
 * combatSystem/buffRegistry/buff pool theo trận, những thứ
 * SkillSystem (chỉ quản lý danh sách skill đã học) không nên biết.
 */
export class SkillEffectSystem {
  applyAll(effects: SkillEffect[], source: CombatEntity, target: CombatEntity, ctx: SkillEffectContext) {
    const orderedEffects = [
      ...effects.filter(effect => effect.type === 'damage'),
      ...effects.filter(effect => effect.type !== 'damage'),
    ]

    for (const effect of orderedEffects) {
      // Target đã chết vì effect trước đó (vd damage giết trước khi
      // debuff/ailment kịp áp) — bỏ qua effect còn lại, không áp lên xác.
      if (!target.alive) {
        continue
      }

      if (effect.type === 'debuff' && effects.some(candidate => candidate.type === 'damage') && !(ctx.didLandHit?.() ?? true)) {
        continue
      }

      this.apply(effect, source, target, ctx)
    }
  }

  apply(effect: SkillEffect, source: CombatEntity, target: CombatEntity, ctx: SkillEffectContext) {
    switch (effect.type) {
      case 'damage': {
        // Attribute scaling/Adaptive — cộng thêm % vào multiplier gốc
        // của skill tại thời điểm cast, không đụng ActionImpactSystem/DamageCalculator.
        // Guard attributes rỗng — Math.max() trên mảng rỗng = -Infinity,
        // kéo toàn bộ multiplier về -Infinity.
        const scalingBonus =
          (effect.attributeScaling ?? []).reduce(
            (sum, entry) =>
              sum +
              (entry.attributes.length === 0
                ? 0
                : entry.ratioPerPoint * Math.max(...entry.attributes.map(stat => source.stats[stat]))),
            0,
          ) +
          (effect.swordIntentDamageRatio ? effect.swordIntentDamageRatio * source.currentSwordIntent : 0) +
          (effect.realmDamageRatio ? effect.realmDamageRatio * source.realmIndex : 0) +
          (effect.manaScalingRatio ? effect.manaScalingRatio * source.stats.maxMp : 0) +
          (effect.skillExperienceRatio
            ? effect.skillExperienceRatio * (ctx.skillExperience ?? 0) / Math.max(1, source.stats.attack)
            : 0)

        // skillDamagePercent là tổng hợp modifier chung (equipment/
        // node/technique + tier Kiếm Ý vĩnh viễn route Bạt Kiếm tính ở
        // stores/player.ts finalStats qua KiemYSystem). Nền = 0 nên
        // KHÔNG ảnh hưởng path nào chưa có nguồn cấp skillDamagePercent.
        const finalMultiplier = (effect.value ?? 1) * (1 + scalingBonus) * (1 + source.stats.skillDamagePercent)

        // Kiếm Tu (Ngự Kiếm Thuật) — "1~9 kiếm bay lần lượt": resolve
        // THẬT nhiều hit riêng trong cùng action, số lượng = realmIndex+1;
        // mỗi hit tự roll critical/dodge/Kiếm Ý riêng (fireHit →
        // BattleSystem.applyActionHit), không gộp chung 1 đòn.
        // Pháp Tu Thuần Hệ (E-4) — hitCount TƯỜNG MINH (số lần cố định,
        // vd Bát Thuần 8 đợt sóng) ƯU TIÊN hơn hitCountByRealm; cả hai
        // không set = 1 hit như cũ.
        const hitCount = effect.hitCount ?? (effect.hitCountByRealm ? source.realmIndex + 1 : 1)

        // Thổ Tu Pure — AOE radius/knockback/secondary đã được batch meta
        // phía BattleSystem đọc từ runtime stats (earthPureActive), nên ở
        // đây chỉ việc fire N hit tại target; vùng quét do ActionTargetingSystem lo.

        for (let hitIndex = 0; hitIndex < hitCount; hitIndex++) {
          // Target đã chết vì hit trước — dừng loạt hit còn lại, không
          // tiếp tục bắn vào xác.
          if (!target.alive) {
            break
          }

          if (effect.components) {
            ctx.fireHit(target, { kind: 'elemental', components: effect.components, multiplier: finalMultiplier })
          } else {
            ctx.fireHit(target, { kind: effect.damageType ?? 'physical', multiplier: finalMultiplier })
          }
        }

        // Kiếm Trận keystone (Tam Tài — Task 8, 2026-08-28) — SAU KHI
        // missile của effect này bắn xong, spawn 1 SwordZone tại vị trí
        // TARGET (không phải source — vùng kiếm khí tồn tại độc lập sau
        // khi trận đã bày, cùng tinh thần LavaZone). Chỉ fire nếu target
        // còn sống — mirrors consumesAilmentId's guard bên dưới.
        // Pháp Tu Thuần Hệ (E-5) — grantsZone là bản tổng quát (mọi
        // element, zoneElement ?? 'metal'); grantsSwordZone (Kiếm Tu)
        // giữ nguyên nghĩa metal — resolver gộp OR 2 flag.
        if (target.alive && (effect.grantsSwordZone || effect.grantsZone) && ctx.spawnSwordZone) {
          ctx.spawnSwordZone({
            ownerId: source.id,
            row: target.row,
            column: Math.round(target.x),
            laneRadius: 0,
            columnRadius: 1,
            charges: effect.swordZoneCharges ?? 3,
            tickInterval: effect.swordZoneTickInterval ?? 1,
            damagePerTick: finalMultiplier * (effect.swordZoneDamageRatio ?? 0.3) * source.stats.attack,
            element: effect.zoneElement ?? 'metal',
          })
        }

        // Pháp Tu Detonate — "cash in" stack ailment hiện có của target
        // cho 1 cục true damage RIÊNG (bỏ qua Armor/Resistance, cùng
        // tinh thần primordialPower), rồi xoá hẳn ailment đó. Tách
        // khỏi damage impact ở trên (đi thẳng currentHp, không qua mitigation/
        // ward/leech/thorns) vì đây là "cash-in" 1 hiệu ứng ĐÃ mitigate
        // sẵn lúc apply ban đầu (xem AilmentSystem.apply()'s snapshot),
        // mitigate thêm lần nữa ở đây là tính trùng.
        if (target.alive && effect.consumesAilmentId && effect.damagePerStack) {
          // Unified Buff System (Task 11, 2026-09-01) — targetAilments/
          // AilmentSystem gỡ khỏi SkillEffectContext, đọc/xoá qua
          // ctx.targetBuffs. AilmentSystem cũ KHÔNG phân biệt nguồn (1
          // pool đơn theo id) nên port trung thực = tổng stacks MỌI
          // nguồn (không truyền sourceId, xem BuffSystem.getStacks) +
          // removeAllById (khớp scope 'any' của ConsumeForDamageAction,
          // xem SkillActionRegistry.ts's consumeForDamage).
          const stacks = ctx.targetBuffs.getStacks(effect.consumesAilmentId)

          if (stacks > 0) {
            const bonusDamage = stacks * effect.damagePerStack

            ctx.combatSystem.applyDirectDamage(target, bonusDamage, source.id, 'damage')

            ctx.targetBuffs.removeAllById(effect.consumesAilmentId)

            ctx.combatSystem.killIfDead(target, source.id)

            // Lifedrain (Mộc Tu) — hồi máu SOURCE bằng % bonus damage
            // vừa gây, xem SkillEffect.ts's ghi chú.
            if (effect.healPercentOfDamage) {
              ctx.combatSystem.applyHealing(source, bonusDamage * effect.healPercentOfDamage, source.id, 'leech')
            }
          }
        }

        // Pháp Tu (Thổ Tu) — "tự nổ khiên": tiêu thụ currentWard của
        // SOURCE (không phải target — khiên của người CAST, không
        // phải của kẻ địch) cho 1 cục true damage bonus lên target,
        // cùng tinh thần Detonate nhưng tiêu thụ Ward thay vì Ailment.
        if (target.alive && effect.consumesWardForDamage && effect.damagePerWardPoint && source.currentWard > 0) {
          const wardBonusDamage = source.currentWard * effect.damagePerWardPoint

          source.currentWard = 0

          ctx.combatSystem.applyDirectDamage(target, wardBonusDamage, source.id, 'ward_break')
        }

        // Pháp Tu Thuần Hệ (E-1, 2026-09-03) — "lan độc": sao chép
        // stack ailment của PRIMARY target (ctx.targetBuffs ở đây là
        // pool của target hiện tại) sang MỌI target phụ trong cùng
        // action. Số lần apply mỗi phụ = ceil(total × percent) — mỗi
        // lần apply +1 stack theo stackMode của buff (stack) hoặc
        // refresh (refresh-mode). Target phụ chết giữa action bị bỏ
        // qua (cùng tinh thần "không áp lên xác" của applyAll).
        if (target.alive && effect.spreadsAilmentId) {
          const totalStacks = ctx.targetBuffs.getStacks(effect.spreadsAilmentId)

          if (totalStacks > 0) {
            const applications = Math.ceil(totalStacks * (effect.spreadStackPercent ?? 1))
            const secondaryTargets = (ctx.affectedTargets ?? [target]).filter(
              (oneTarget) => oneTarget.id !== target.id && oneTarget.alive,
            )

            for (const secondary of secondaryTargets) {
              const secondaryBuffs = ctx.secondaryTargetBuffs?.(secondary)

              if (!secondaryBuffs) {
                continue
              }

              const definition = ctx.buffRegistry.get(effect.spreadsAilmentId)

              for (let i = 0; i < applications; i++) {
                secondaryBuffs.apply(definition, source, secondary, ctx.buffRegistry)
              }
            }
          }

          // Biến thể "Lan Độc → Thấm": gia hạn duration primary (không
          // đổi stacks) — reset remainingTime về duration đã snapshot
          // lúc apply (cùng tinh thần renewWithExtension: không tạo
          // instance mới, không đổi số tầng).
          if (effect.spreadRefreshesPrimary) {
            const primaryInstances = ctx.targetBuffs.getAllById(effect.spreadsAilmentId)

            for (const instance of primaryInstances) {
              instance.remainingTime = instance.duration
            }
          }
        }

        break
      }

      case 'heal':
        ctx.combatSystem.applyHealing(target, effect.value ?? 0, source.id, 'healing')
        break

      case 'buff': {
        if (!effect.buffId) break

        const definition = ctx.buffRegistry.get(effect.buffId)

        // Pháp Tu Thuần Hệ (E-2, 2026-09-03) — Hậu Thổ Thành Lũy:
        // stacks = số target còn sống của action (cap maxStacks của
        // buff — apply() theo stackMode 'stack' tự dừng ở trần).
        // 0 target → không buff. Không có affectedTargets (ctx cũ) →
        // 1 lần apply như hành vi cũ.
        if (effect.stacksPerAffectedTarget) {
          const hitCount = (ctx.affectedTargets ?? [target]).filter((oneTarget) => oneTarget.alive).length

          for (let i = 0; i < hitCount; i++) {
            ctx.sourceBuffs.apply(definition, source, source, ctx.buffRegistry)
          }
          break
        }

        ctx.sourceBuffs.apply(definition, source, source, ctx.buffRegistry)
        break
      }

      // Unified Buff System (Task 11, 2026-09-01) — absorbs old case
      // 'ailment' entirely: chance roll (incl. elementApplicationPercent),
      // Kim Thế/Huyết Phá resource procs, và Reaction check giờ chạy
      // trên MỌI effect 'debuff' (trước đây tách riêng khỏi 'debuff'
      // đơn giản — 2 nhánh giờ hợp nhất vì cùng đi qua BuffRegistry/
      // BuffSystem, không còn AilmentRegistry/AilmentSystem riêng).
      case 'debuff': {
        if (!effect.buffId) break

        // Roll ĐỘC LẬP với dodge/crit của damage chính — 1 skill có
        // thể vừa gây damage vừa có % riêng gây debuff (2 effect tách
        // biệt trong cùng skill.effects). Hỏa Tu Trúc Cơ (Plans/
        // FirePath mục 6/8, 2026-08-21) — elementApplicationPercent
        // cộng THẲNG vào tỉ lệ gốc của skill (Dẫn Hỏa/Hỏa Nguyên),
        // clamp tối đa 1 (100%).
        const chance = Math.min(1, (effect.ailmentChance ?? 1) + source.stats.elementApplicationPercent)

        if (Math.random() >= chance) break

        ctx.targetBuffs.apply(ctx.buffRegistry.get(effect.buffId), source, target, ctx.buffRegistry)

        // Kim Tu Trúc Cơ Pure ("Kim Thế" major, Plans/KimPath mục
        // 9/11, 2026-08-21) — CHỈ tích khi roll THÀNH CÔNG (đã ở
        // trong nhánh này), nền 0 nếu chưa mua "Kim Thế".
        const kimTheGain = getSkillRuntimeStat(source, 'kimTheGainPerProc')
        if (effect.grantsKimThePerProc && kimTheGain > 0) {
          source.currentKimThe = Math.min(
            MAX_KIM_THE + getSkillRuntimeStat(source, 'kimTheMaxStacksBonus'),
            source.currentKimThe + kimTheGain,
          )

          source.timeSinceLastBleedProc = 0
        }

        // Kim Tu ("Huyết Phá", Plans/magicpathgeneral Phase 13,
        // 2026-08-21) — charge ĐỘC LẬP với Kim Thế ở trên (cùng điều
        // kiện roll, 2 counter khác nhau). Chạm MAX_HUYET_PHA thì
        // consume/reset về 0 (KHÔNG mutate ailment/debuff nào — đúng
        // invariant Phase 16) rồi trigger 1 burst damage MỘT LẦN lên
        // target qua ĐÚNG pipeline DOT RES (applyDotDamage()),
        // effectId 'huyet_pha_burst' để phân biệt với tick DoT thường.
        const huyetPhaGain = getSkillRuntimeStat(source, 'huyetPhaGainPerProc')
        if (effect.grantsHuyetPhaPerProc && huyetPhaGain > 0) {
          const nextCharge = (source.currentHuyetPha ?? 0) + huyetPhaGain

          if (nextCharge >= MAX_HUYET_PHA) {
            source.currentHuyetPha = 0

            const burstDamage = getSkillRuntimeStat(source, 'huyetPhaBurstDamage')
            if (burstDamage > 0) {
              ctx.combatSystem.applyDotDamage({
                sourceId: source.id,
                source,
                target,
                rawDamage: burstDamage,
                element: 'metal',
                effectId: 'huyet_pha_burst',
              })
            }
          } else {
            source.currentHuyetPha = nextCharge
          }
        }

        // Combat Rework Phase 6 — debuff vừa áp có thể phản ứng với
        // debuff hành KHÁC đang có sẵn trên target, xem
        // core/element/ReactionManager.ts.
        ctx.reactionManager.checkAndTrigger(
          ctx.targetBuffs,
          effect.buffId,
          source,
          target,
          ctx.combatSystem,
          ctx.buffRegistry,
          ctx.sourceBuffs,
          ctx.spawnLavaZone,
          ctx.reactionKeepChance ?? 0,
        )
        break
      }

      // Pháp Tu Thuần Hệ (E-3, 2026-09-03) — 2 type này trước đây là
      // no-op ở đây (thuộc về PassiveSystem — stack passive theo trigger
      // riêng). PassiveSystem KHÔNG đi qua switch này (nó mutate
      // passiveModifiers trực tiếp, xem PassiveSystem.ts) nên xử lý
      // thật ở đây không ảnh hưởng path passive cũ.
      case 'add_stack': {
        if (!effect.buffId) break

        // 'target' (mặc định) hay 'source' — pool nào nhận stack.
        const pool = effect.scope === 'source' ? ctx.sourceBuffs : ctx.targetBuffs
        const instances = pool.getAllById(effect.buffId)

        // "tăng N stack trên buff đang chạy" — chưa có buff = no-op,
        // KHÔNG tạo mới (khác 'debuff' apply). Chia đều N stack cho MỌI
        // instance (multi-source) rồi cap theo maxStacks của instance
        // (cùng tinh thần StatCalculator.addStack) — tổng không vượt
        // trần của buff definition.
        if (instances.length === 0) {
          break
        }

        const perInstance = Math.floor((effect.stacks ?? 1) / instances.length)
        let remainder = (effect.stacks ?? 1) % instances.length

        for (const instance of instances) {
          const bonus = perInstance + (remainder > 0 ? 1 : 0)

          if (remainder > 0) {
            remainder -= 1
          }

          const nextStacks = instance.stacks + bonus

          instance.stacks = instance.maxStacks !== undefined
            ? Math.min(nextStacks, instance.maxStacks)
            : nextStacks

          if (effect.refresh) {
            instance.remainingTime = instance.duration
          }
        }

        // Trần tổng theo maxStacks của definition (multi-instance):
        // cắt bớt từ instance cuối ngược lên nếu tổng vượt trần.
        const cap = instances[0]?.maxStacks
        if (cap !== undefined) {
          let overflow = instances.reduce((sum, instance) => sum + instance.stacks, 0) - cap

          for (let i = instances.length - 1; i >= 0 && overflow > 0; i--) {
            const cut = Math.min(overflow, instances[i]!.stacks)

            instances[i]!.stacks -= cut
            overflow -= cut
          }
        }
        break
      }

      case 'remove_buff': {
        const pool = effect.scope === 'source' ? ctx.sourceBuffs : ctx.targetBuffs
        const candidates = pool.getAll().filter((buff) => {
          if (effect.buffId !== undefined && buff.id !== effect.buffId) return false
          if (effect.polarity !== undefined && buff.polarity !== effect.polarity) return false
          return true
        })

        // Gỡ tối đa `count` instance (mặc định 1) theo thứ tự pool.
        for (const buff of candidates.slice(0, effect.count ?? 1)) {
          pool.remove(buff.id, buff.sourceId)
        }
        break
      }
    }
  }
}
