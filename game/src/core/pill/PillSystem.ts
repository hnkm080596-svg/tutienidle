import type { Pill } from './Pill'
import type { PillEffect } from './PillEffect'
import { BuffSystem } from '../buff/BuffSystem'
import type { PlayerData } from '../player/Player'
import type { StatModifier } from '../stats/StatCalculator'

/**
 * Nơi hiệu ứng pill thật sự ghi vào — do PillSystem không giữ
 * PlayerData/CombatEntity cụ thể (giống RewardSystem/RewardReceiver),
 * caller tự cung cấp adapter phù hợp với ngữ cảnh dùng pill
 * (ngoài trận: player store; trong trận: CombatEntity đang chiến đấu).
 */
export interface PillTarget {
  addCultivation(amount: number): void

  heal(amount: number): void
}

export class PillSystem {
  constructor(private readonly buffSystem: BuffSystem) {}

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
        modifier => modifier.id === `pill-permanent:${effect.stat}`,
      )

      const current = existing?.flat ?? 0

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

  private applyEffect(effect: PillEffect, target: PillTarget, pill: Pill): StatModifier | null {
    switch (effect.type) {
      case 'cultivation':
        target.addCultivation(effect.value ?? 0)

        return null

      case 'heal':
        target.heal(effect.value ?? 0)

        return null

      case 'buff':
        if (effect.buff) {
          this.buffSystem.apply(effect.buff)
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
    }
  }
}
