import type { SkillEffect } from './SkillEffect'
import type { CombatEntity } from '../combat/CombatEntity'
import type { CombatSystem } from '../combat/CombatSystem'
import type { MissileSystem } from '../combat/missile/MissileSystem'
import type { BuffSystem } from '../buff/BuffSystem'
import type { BuffRegistry } from '../buff/BuffRegistry'
import type { AilmentSystem } from '../ailment/AilmentSystem'
import type { AilmentRegistry } from '../ailment/AilmentRegistry'
import type { ReactionManager } from '../element/ReactionManager'
import type { ElementType } from '../element/ElementType'
import { MAX_KIM_THE, MAX_HUYET_PHA } from '../combat/CombatTypes'

export interface SkillEffectContext {
  combatSystem: CombatSystem

  // Effect 'damage' giờ bắn missile thay vì áp tức thời — xem
  // apply() bên dưới. combatSystem vẫn cần cho rollCritical() và
  // (nếu sau này cần) các effect khác đọc trực tiếp combat state.
  missileSystem: MissileSystem

  buffRegistry: BuffRegistry

  ailmentRegistry: AilmentRegistry

  // Buff/Ailment pool của source/target — theo đúng entity đang tham
  // gia trận (Battle.playerBuffs/enemyBuffs, playerAilments/
  // BattleEnemy.ailments), không phải buff persistent ngoài trận.
  // Xem BattleSystem.ts.
  sourceBuffs: BuffSystem

  targetBuffs: BuffSystem

  targetAilments: AilmentSystem

  // Combat Rework Phase 6 (Pháp Tu Reaction) — kiểm tra/kích phản ứng
  // ngay sau khi effect 'ailment' áp thành công, xem apply() bên dưới.
  reactionManager: ReactionManager

  // Plans/magicpathgeneral Phase 12 (2026-08-21) — cho phép
  // ReactionManager spawn Lava Zone (Dung Nham) vào ĐÚNG `battle`
  // đang chạy — bind sẵn ở BattleSystem.castSkill(), optional vì hầu
  // hết reaction/test không cần.
  spawnLavaZone?: (spec: {
    ownerId: string
    x: number
    radius: number
    duration: number
    tickInterval: number
    damagePerTick: number
    element: ElementType | 'physical'
  }) => void

  // Kiếm Tu (2026-08-15) — id skill ĐANG cast, gắn vào Missile lúc
  // bắn (xem MissileSystem.fire()'s tham số skillId) để lúc missile
  // TRÚNG (BattleSystem's missile-resolve callback, deferred — không
  // đồng bộ với apply() này) biết tra lại đúng skill nào vừa bắn ra
  // nó, phục vụ Skill.grantsSwordIntentPerHit. undefined = đòn đánh
  // thường fallback (không qua skill nào, xem updatePlayerAttack()).
  skillId?: string
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
    for (const effect of effects) {
      this.apply(effect, source, target, ctx)
    }
  }

  apply(effect: SkillEffect, source: CombatEntity, target: CombatEntity, ctx: SkillEffectContext) {
    switch (effect.type) {
      case 'damage': {
        // Attribute scaling/Adaptive — cộng thêm % vào multiplier gốc
        // của skill tại thời điểm cast, không đụng Missile/DamageCalculator.
        const scalingBonus =
          (effect.attributeScaling ?? []).reduce(
            (sum, entry) => sum + entry.ratioPerPoint * Math.max(...entry.attributes.map(stat => source.stats[stat])),
            0,
          ) +
          (effect.swordIntentDamageRatio ? effect.swordIntentDamageRatio * source.currentSwordIntent : 0) +
          (effect.realmDamageRatio ? effect.realmDamageRatio * source.realmIndex : 0)

        // Kiếm Ý vĩnh viễn (Kiếm Tu, 2026-08-15) — % khuếch đại MỌI
        // effect 'damage' của skill chủ động, xem core/player/
        // SwordIntentSystem.ts. Nền = 0 nên KHÔNG ảnh hưởng path nào
        // khác chưa có nguồn cấp skillDamagePercent.
        const finalMultiplier = (effect.value ?? 1) * (1 + scalingBonus) * (1 + source.stats.skillDamagePercent)

        // Kiếm Tu (Ngự Kiếm Thuật, 2026-08-15) — "1~9 kiếm bay lần
        // lượt": bắn THẬT nhiều missile liên tiếp trong 1 lượt đánh
        // thường, số lượng = realmIndex + 1 (0-based, khớp đúng dải
        // "1~9" với 9 đại cảnh giới hiện có) — mỗi kiếm tự roll
        // critical/dodge/Kiếm Ý riêng (xem BattleSystem's missile-
        // resolve callback), không gộp chung 1 đòn.
        const hitCount = effect.hitCountByRealm ? source.realmIndex + 1 : 1

        // Thổ Tu Pure (Plans/EarthPath mục XVI, 2026-08-21) — Thổ Cầu
        // Thuật GHI ĐÈ projectileBehavior tĩnh bằng 1 behavior dựng từ
        // stats NGAY LÚC CAST, chỉ khi đã mua Major "Thổ Thế"
        // (earthAoeRadius > 0) — trước đó bắn đơn mục tiêu như mọi
        // skill khác (effect.projectileBehavior undefined với Thổ Cầu).
        const behavior =
          effect.earthPureProjectileBehavior && source.stats.earthAoeRadius > 0
            ? {
                aoeRadius: source.stats.earthAoeRadius,
                aoeSecondaryDamagePercent: source.stats.earthAoeSecondaryDamagePercent,
                knockbackDistance: source.stats.earthKnockbackDistance,
              }
            : effect.projectileBehavior

        for (let hitIndex = 0; hitIndex < hitCount; hitIndex++) {
          const critical = ctx.combatSystem.rollCritical(source, target)

          if (effect.components) {
            ctx.missileSystem.fire(
              source,
              target,
              { kind: 'elemental', components: effect.components, multiplier: finalMultiplier },
              critical,
              ctx.skillId,
              behavior,
            )
          } else {
            ctx.missileSystem.fire(
              source,
              target,
              { kind: effect.damageType ?? 'physical', multiplier: finalMultiplier },
              critical,
              ctx.skillId,
              behavior,
            )
          }
        }

        // Pháp Tu Detonate — "cash in" stack ailment hiện có của target
        // cho 1 cục true damage RIÊNG (bỏ qua Armor/Resistance, cùng
        // tinh thần primordialPower), rồi xoá hẳn ailment đó. Tách
        // khỏi missile ở trên (đi thẳng currentHp, không qua mitigation/
        // ward/leech/thorns) vì đây là "cash-in" 1 hiệu ứng ĐÃ mitigate
        // sẵn lúc apply ban đầu (xem AilmentSystem.apply()'s snapshot),
        // mitigate thêm lần nữa ở đây là tính trùng.
        if (effect.consumesAilmentId && effect.damagePerStack) {
          const stacks = ctx.targetAilments.getStacks(effect.consumesAilmentId)

          if (stacks > 0) {
            const bonusDamage = stacks * effect.damagePerStack

            target.currentHp = Math.max(0, target.currentHp - bonusDamage)

            ctx.targetAilments.remove(effect.consumesAilmentId)

            ctx.combatSystem.killIfDead(target, source.id)

            // Lifedrain (Mộc Tu) — hồi máu SOURCE bằng % bonus damage
            // vừa gây, xem SkillEffect.ts's ghi chú.
            if (effect.healPercentOfDamage) {
              source.currentHp = Math.min(source.maxHp, source.currentHp + bonusDamage * effect.healPercentOfDamage)
            }
          }
        }

        // Pháp Tu (Thổ Tu) — "tự nổ khiên": tiêu thụ currentWard của
        // SOURCE (không phải target — khiên của người CAST, không
        // phải của kẻ địch) cho 1 cục true damage bonus lên target,
        // cùng tinh thần Detonate nhưng tiêu thụ Ward thay vì Ailment.
        if (effect.consumesWardForDamage && effect.damagePerWardPoint && source.currentWard > 0) {
          const wardBonusDamage = source.currentWard * effect.damagePerWardPoint

          source.currentWard = 0

          target.currentHp = Math.max(0, target.currentHp - wardBonusDamage)

          ctx.combatSystem.killIfDead(target, source.id)
        }

        break
      }

      case 'heal':
        target.currentHp = Math.min(target.maxHp, target.currentHp + (effect.value ?? 0))
        break

      case 'buff':
        if (effect.buffId) {
          ctx.sourceBuffs.apply(ctx.buffRegistry.get(effect.buffId))
        }
        break

      case 'debuff':
        if (effect.buffId) {
          ctx.targetBuffs.apply(ctx.buffRegistry.get(effect.buffId))
        }
        break

      case 'ailment': {
        // Roll ĐỘC LẬP với dodge/crit của damage chính — 1 skill có
        // thể vừa gây damage vừa có % riêng gây ailment (2 effect
        // tách biệt trong cùng skill.effects). Hỏa Tu Trúc Cơ (Plans/
        // FirePath mục 6/8, 2026-08-21) — elementApplicationPercent
        // cộng THẲNG vào tỉ lệ gốc của skill (Dẫn Hỏa/Hỏa Nguyên),
        // clamp tối đa 1 (100%).
        const ailmentChance = Math.min(1, (effect.ailmentChance ?? 1) + source.stats.elementApplicationPercent)

        if (effect.ailmentId && Math.random() < ailmentChance) {
          ctx.targetAilments.apply(ctx.ailmentRegistry.get(effect.ailmentId), source, target, ctx.ailmentRegistry)

          // Kim Tu Trúc Cơ Pure ("Kim Thế" major, Plans/KimPath mục
          // 9/11, 2026-08-21) — CHỈ tích khi roll THÀNH CÔNG (đã ở
          // trong nhánh này), nền 0 nếu chưa mua "Kim Thế".
          if (effect.grantsKimThePerProc && source.stats.kimTheGainPerProc > 0) {
            source.currentKimThe = Math.min(
              MAX_KIM_THE + source.stats.kimTheMaxStacksBonus,
              source.currentKimThe + source.stats.kimTheGainPerProc,
            )

            source.timeSinceLastBleedProc = 0
          }

          // Kim Tu ("Huyết Phá", Plans/magicpathgeneral Phase 13,
          // 2026-08-21) — charge ĐỘC LẬP với Kim Thế ở trên (cùng điều
          // kiện roll, 2 counter khác nhau). Chạm MAX_HUYET_PHA thì
          // consume/reset về 0 (KHÔNG mutate ailment/debuff nào —
          // đúng invariant Phase 16) rồi trigger 1 burst damage MỘT
          // LẦN lên target qua ĐÚNG pipeline DOT RES (applyDotDamage()),
          // effectId 'huyet_pha_burst' để phân biệt với tick DoT thường.
          if (effect.grantsHuyetPhaPerProc && source.stats.huyetPhaGainPerProc > 0) {
            const nextCharge = (source.currentHuyetPha ?? 0) + source.stats.huyetPhaGainPerProc

            if (nextCharge >= MAX_HUYET_PHA) {
              source.currentHuyetPha = 0

              if (source.stats.huyetPhaBurstDamage > 0) {
                ctx.combatSystem.applyDotDamage({
                  sourceId: source.id,
                  source,
                  target,
                  rawDamage: source.stats.huyetPhaBurstDamage,
                  element: 'metal',
                  effectId: 'huyet_pha_burst',
                })
              }
            } else {
              source.currentHuyetPha = nextCharge
            }
          }

          // Combat Rework Phase 6 — ailment vừa áp có thể phản ứng với
          // ailment hành KHÁC đang có sẵn trên target, xem
          // core/element/ReactionManager.ts.
          ctx.reactionManager.checkAndTrigger(
            ctx.targetAilments,
            effect.ailmentId,
            source,
            target,
            ctx.combatSystem,
            ctx.ailmentRegistry,
            ctx.sourceBuffs,
            ctx.buffRegistry,
            ctx.spawnLavaZone,
          )
        }
        break
      }

      case 'add_stack':
      case 'remove_buff':
        // Thuộc về PassiveSystem (stack passive theo trigger riêng,
        // không phải effect của skill chủ động) — không xử lý ở đây.
        break
    }
  }
}
