import type { Pill } from './Pill'
import type { PillEffect } from './PillEffect'
import type { PlayerData } from '../player/Player'
import type { StatModifier } from '../stats/StatCalculator'
import type { PersistentTimedEffect } from '../player/PersistentTimedEffect'
import { MAIN_STAT_KEYS, type MainStatKey } from '../stats/StatTypes'
import { getMainStatCap } from '../stats/StatCap'
import { addCultivation } from '../cultivation/CultivationSystem'
import { getRequiredCultivation } from '../realm/realmSystem'
import type { BuffDefinition } from '../buff/BuffDefinition'

export function clampToRealmCap(current: number, increase: number, realmId: string): number {
  return Math.max(0, Math.min(increase, getMainStatCap(realmId) - current))
}

/**
 * Nơi hiệu ứng pill thật sự ghi vào — do PillSystem không giữ
 * PlayerData/CombatEntity cụ thể (giống RewardSystem/RewardReceiver),
 * caller tự cung cấp adapter phù hợp với ngữ cảnh dùng pill
 * (ngoài trận: player store; trong trận: CombatEntity đang chiến đấu).
 */
export interface PillTarget {
  addCultivation(amount: number): void

  heal(amount: number): void

  // Unified Buff System (Task 13b) — trước đây PillSystem tự giữ 1
  // BuffSystem và gọi thẳng buffSystem.apply(effect.buff), nhưng
  // apply() giờ đòi hỏi (definition, source: CombatEntity, target:
  // CombatEntity, registry?) — PillSystem không giữ CombatEntity cụ
  // thể nào (đúng doc comment ở trên: "PillSystem không giữ
  // PlayerData/CombatEntity cụ thể"), nên adapter tự resolve entity
  // phù hợp ngữ cảnh của nó, giống addCultivation/heal.
  applyBuff(definition: BuffDefinition): void
}

export type PillUseReason = 'ok' | 'wrong_realm' | 'all_main_stats_capped' | 'requires_phap_tu'

export class PillSystem {
  /**
   * cap = trần cảnh giới hiện tại (RealmData.attributeCap) — undefined
   * nghĩa là cảnh giới chưa thiết kế trần, không giới hạn. Với mỗi
   * effect permanent_stat, tổng bonus CỘNG DỒN của TẤT CẢ pill cùng
   * target 1 stat (bucket `pill-permanent:${stat}`, xem applyEffect)
   * không được vượt cap.
   */
  canUse(pill: Pill, player: PlayerData, cap: number | undefined): boolean {
    if (cap === undefined) {
      return true
    }

    for (const effect of pill.effects) {
      if (effect.type !== 'permanent_stat' || !effect.stat) {
        continue
      }

      const existing = player.modifiers.find(
        (modifier) => modifier.id === `pill-permanent:${effect.stat}`,
      )

      const current = player.baseStats[effect.stat] + (existing?.flat ?? 0)

      if (current + (effect.value ?? 0) > cap) {
        return false
      }
    }

    return true
  }

  /**
   * Trả về các StatModifier "vĩnh viễn" phát sinh từ effect
   * 'permanent_stat' (nếu có) — PillSystem không tự mutate
   * player.modifiers, để GameManager.usePill() quyết định
   * find-or-create theo bucket chung (xem applyEffect).
   */
  use(pill: Pill, target: PillTarget): StatModifier[] {
    const permanentModifiers: StatModifier[] = []

    for (const effect of pill.effects) {
      const modifier = this.applyEffect(effect, target, pill)

      if (modifier) {
        permanentModifiers.push(modifier)
      }
    }

    return permanentModifiers
  }

  private applyEffect(effect: PillEffect, target: PillTarget, _pill: Pill): StatModifier | null {
    switch (effect.type) {
      case 'cultivation':
        target.addCultivation(effect.value ?? 0)

        return null

      case 'heal':
        target.heal(effect.value ?? 0)

        return null

      case 'buff':
        if (effect.buff) {
          target.applyBuff(effect.buff)
        }

        return null

      case 'permanent_stat':
        if (!effect.stat) {
          return null
        }

        return {
          // id chung theo STAT (không theo pill) — nhiều pill khác
          // nhau cùng target 1 stat đều cộng dồn vào CHUNG 1 bucket,
          // để trần cảnh giới (RealmData.attributeCap) tính đúng tổng
          // toàn cục thay vì riêng theo từng pill.
          id: `pill-permanent:${effect.stat}`,

          sourceId: 'pill-permanent',
          sourceType: 'pill',

          stat: effect.stat,

          flat: effect.value ?? 0,
        }

      default:
        return null
    }
  }

  // =========================
  // PILL NGHỀ (2026-08-24, resource-professions-rework §5) — gate theo
  // reason + 4 effect MVP. Pill có realmId bị gate ĐÚNG cảnh giới.
  // =========================

  canUseProfessionPill(pill: Pill, player: PlayerData): PillUseReason {
    // Exact-realm gate (plan §5.2) — chỉ pill MỚI có realmId.
    if (pill.realmId && pill.realmId !== player.realmId) {
      return 'wrong_realm'
    }

    // Linh lực (MP) là tài nguyên riêng của Pháp Tu (maxMp = 0 với path
    // khác) — pill hồi MP báo lỗi thay vì lãng phí hiệu ứng trong im lặng.
    const hasManaRegen = pill.effects.some(
      (effect) => effect.type === 'regen' && (effect.mpPerSecond ?? 0) > 0,
    )

    if (hasManaRegen && player.cultivationPath !== 'phap_tu') {
      return 'requires_phap_tu'
    }

    if (pill.effects.some((effect) => effect.type === 'random_main_stat')) {
      const cap = getMainStatCap(player.realmId)
      const uncapped = MAIN_STAT_KEYS.filter((key) => (player.baseStats[key] ?? 0) < cap)

      if (uncapped.length === 0) {
        return 'all_main_stats_capped'
      }
    }

    return 'ok'
  }

  /**
   * Apply pill nghề lên player (MUTATE player — caller chịu trách nhiệm
   * consume bag SAU khi gọi thành công, atomic consumption plan §5.2):
   * - random_main_stat: +1 ĐIỂM thật vào 1 Main Stat CHƯA cap (roll đều
   *   trên candidate hợp lệ, RNG inject để test deterministic — plan §5.3).
   *   KHÔNG đụng attributePoints/bucket pill-permanent cũ.
   * - regen: tạo PersistentTimedEffect (deadline tuyệt đối, group
   *   'pill_regen' — GameManager.applyTimedEffect xử lý refresh policy).
   * - cultivation: % yêu cầu tầng hiện tại qua addCultivation (giữ cap).
   * - skill_insight: cộng skillInsight + totalSkillInsightGained trong
   *   cùng nhịp (Cảm Ngộ = skillInsight, plan §5.1).
   */
  useProfessionPill(
    pill: Pill,
    player: PlayerData,
    random: () => number = Math.random,
  ): { mainStat?: MainStatKey; timedEffect?: PersistentTimedEffect } {
    let mainStat: MainStatKey | undefined
    let timedEffect: PersistentTimedEffect | undefined

    for (const effect of pill.effects) {
      if (effect.type === 'random_main_stat') {
        const cap = getMainStatCap(player.realmId)
        const candidates = MAIN_STAT_KEYS.filter((key) => (player.baseStats[key] ?? 0) < cap)

        const stat = candidates[Math.floor(random() * candidates.length)] ?? candidates[0]

        if (stat) {
          // +1 ĐIỂM thuộc tính THẬT vào baseStats (plan §5.3).
          player.baseStats[stat] += 1
          mainStat = stat
        }

        continue
      }

      if (effect.type === 'regen') {
        const now = Date.now()

        timedEffect = {
          id: `pill-regen:${pill.id}:${now}`,

          sourceItemId: pill.id,

          effectGroup: effect.effectGroup ?? 'pill_regen',

          durationStackable: effect.stackable ?? false,

          appliedAtMs: now,

          expiresAtMs: now + (effect.durationSeconds ?? 0) * 1000,

          modifiers: [
            {
              id: `pill-regen-hp:${pill.id}`,

              sourceId: pill.id,

              sourceType: 'pill',

              stat: 'hpRegenPerTurn',

              flat: effect.hpPerSecond ?? 0,
            },

            {
              id: `pill-regen-mp:${pill.id}`,

              sourceId: pill.id,

              sourceType: 'pill',

              stat: 'manaRegenPerSecond',

              flat: effect.mpPerSecond ?? 0,
            },
          ],
        }

        continue
      }

      if (effect.type === 'cultivation') {
        // Tu Vi theo % yêu cầu tầng HIỆN TẠI lúc uống (plan §5.5), qua
        // addCultivation để giữ cap tầng.
        const required = getRequiredCultivation(player.realmId, player.realmLevel)

        addCultivation(player, Math.floor(required * (effect.cultivationPercent ?? 0)))

        continue
      }

      if (effect.type === 'skill_insight') {
        // Cảm Ngộ = skillInsight + lifetime counter, cùng transaction.
        const amount = effect.value ?? 0

        player.skillInsight += amount
        player.totalSkillInsightGained += amount

        continue
      }
    }

    return { mainStat, timedEffect }
  }
}
