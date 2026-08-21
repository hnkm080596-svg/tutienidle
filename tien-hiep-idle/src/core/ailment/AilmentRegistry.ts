import type { ElementType } from '../element/ElementType'
import type { AilmentCategory, AilmentCcEffect, AilmentId, AilmentStackMode } from './AilmentTypes'
import type { StatType } from '../stats/StatTypes'

/**
 * Template tĩnh (thời lượng/stackMode/hệ số DoT mặc định) — SkillEffectSystem
 * tra theo AilmentId lúc 1 skill roll trúng effect 'ailment', rồi
 * AilmentSystem.apply() dùng để tạo Ailment instance thật (đã snapshot
 * damagePerSecond theo stats nguồn/đích tại thời điểm áp dụng).
 */
export interface AilmentTemplate {
  id: AilmentId

  name: string

  category: AilmentCategory

  duration: number

  stackMode: AilmentStackMode

  maxStacks?: number

  // DoT — hành nào chi phối Power/Resistance dùng để tính
  // damagePerSecond (xem AilmentSystem.apply()); 'physical' dùng
  // attack/defense (Armor) thay vì Power/Resistance hành.
  element?: ElementType | 'physical'

  // DoT — nhân với Power (đã trừ mitigation) của nguồn lúc áp dụng.
  dpsRatio?: number

  // Kiếm Tu (Vạn Kiếm Triều Tông, 2026-08-15) — DoT này bỏ qua thêm
  // 10%-90% Giáp/Kháng theo realmIndex của NGUỒN (source), xem
  // AilmentSystem.calculateDamagePerSecond(). Chỉ có ý nghĩa với
  // category 'dot'.
  armorIgnorePercentByRealm?: boolean

  ccEffect?: AilmentCcEffect

  // 'modifier' — xem Ailment.ts.
  statModifiers?: { stat: StatType; percent?: number; flat?: number }[]

  // Hàn Khí — khi số stack đạt `maxStacks`, TỰ ĐỘNG gỡ instance này
  // và áp luôn ailment với id này thay vào (Đóng Băng) — xem
  // AilmentSystem.apply(). Chỉ có ý nghĩa với template dùng stackMode
  // 'stack'. Pháp Tu (Thủy Tu, 2026-08-15) — field này giờ TỔNG QUÁT
  // hoá thành "ailment đích khi chuyển hoá", dùng chung cho CẢ 2 kiểu
  // trigger: đạt maxStacks (cũ) HOẶC đủ convertsAfterContinuousSeconds
  // (mới, xem bên dưới) — 1 template chỉ nên khai ĐÚNG 1 trong 2 kiểu
  // trigger, không phối hợp cả hai.
  convertsToOnMaxStacks?: AilmentId

  // Làm Chậm — khi ailment này active LIÊN TỤC (không đứt quãng, xem
  // Ailment.ts's continuousSeconds) đủ số giây này thì TỰ ĐỘNG gỡ và
  // áp `convertsToOnMaxStacks` thay vào, độc lập với stackMode/số lần
  // áp — xem AilmentSystem.update()'s convertAilment().
  convertsAfterContinuousSeconds?: number

  // Thổ Tu (Thạch Hóa, 2026-08-21) — khi ailment này ĐANG active trên
  // 1 entity, MỖI ĐÒN ĐÁNH TRÚNG (không tính né, xem BattleSystem.
  // resolveMissiles()) roll % này để áp thêm 1 ailment KHÁC (thường CC
  // — Thạch Hóa dùng lại 'choang' có sẵn thay vì tạo effect/duration
  // riêng). Field TỔNG QUÁT (không hard-code riêng Thạch Hóa trong
  // engine) — bất kỳ ailment tương lai nào cũng dùng lại được cơ chế
  // này, xem AilmentSystem.rollOnHitEffects(). Cả 2 field phải khai
  // CÙNG NHAU mới có hiệu lực.
  onHitChance?: number

  onHitAppliesAilmentId?: AilmentId
}

export class AilmentRegistry {
  private readonly templates = new Map<AilmentId, AilmentTemplate>()

  register(template: AilmentTemplate): void {
    if (this.templates.has(template.id)) {
      throw new Error(`Ailment already registered: ${template.id}`)
    }

    this.templates.set(template.id, template)
  }

  get(id: AilmentId): AilmentTemplate {
    const template = this.templates.get(id)

    if (!template) {
      throw new Error(`Ailment not found: ${id}`)
    }

    return template
  }

  has(id: AilmentId): boolean {
    return this.templates.has(id)
  }

  getAll(): AilmentTemplate[] {
    return Array.from(this.templates.values())
  }
}
