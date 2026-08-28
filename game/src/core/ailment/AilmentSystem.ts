import type { Ailment } from './Ailment'
import type { AilmentId } from './AilmentTypes'
import type { AilmentTemplate, AilmentRegistry } from './AilmentRegistry'
import { AilmentManager } from './AilmentManager'
import type { CombatEntity } from '../combat/CombatEntity'
import { getSkillRuntimeStat } from '../skill/SkillRuntimeStats'
import type { CombatSystem } from '../combat/CombatSystem'
import { getArmorMitigationPercent } from '../combat/Armor'
import { getResistanceMitigationPercent } from '../combat/Resistance'
import { elementalBasePower } from '../combat/ElementDamageCalculator'
import type { StatModifier } from '../stats/StatCalculator'

// Trần % giảm duration ailment nhận vào — tránh ailmentResistPercent
// cao vô hạn triệt tiêu hoàn toàn ailment.
const AILMENT_RESIST_CAP = 0.75

/**
 * 1 AilmentSystem bọc 1 AilmentManager — pool CỦA 1 ENTITY, y hệt
 * BuffSystem/BuffManager (Battle.playerBuffs/BattleEnemy.buffs).
 * `target` (entity sở hữu pool này) không cần truyền lại theo id —
 * đã biết chắc chắn qua chính pool đang thao tác, khác resolveMissiles()
 * (cần tra theo id vì missile bay xuyên nhiều entity).
 */
export class AilmentSystem {
  constructor(private readonly manager: AilmentManager) {}

  /**
   * DoT: snapshot damagePerSecond NGAY lúc áp dụng (Power của nguồn,
   * đã trừ mitigation của đích tại thời điểm này, NHÂN thêm
   * ailmentPotencyPercent của nguồn) — không đọc lại stats mỗi tick,
   * rẻ và ổn định dù nguồn/đích có buff đổi giữa chừng. Duration cũng
   * bị giảm theo ailmentResistPercent của đích ngay tại đây (snapshot
   * 1 lần, không đọc lại mỗi tick). `registry` chỉ cần cho
   * `convertsToOnMaxStacks` (Hàn Khí -> Đóng Băng) — optional vì
   * phần lớn ailment không cần chain.
   */
  apply(template: AilmentTemplate, source: CombatEntity, target: CombatEntity, registry?: AilmentRegistry) {
    // Kim Tu Trúc Cơ Pure ("Kim Thế" major + "Huyết Lưu" minor, Plans/
    // KimPath mục 9/15, 2026-08-21) — CHỈ nhân cho DoT element 'metal'
    // (Xuất Huyết/Huyết Độc), KHÔNG qua ailmentPotencyPercent chung —
    // tránh build lai (vd Kim+Mộc) tự buff nhầm DoT hành khác chỉ vì có
    // Kim Thế. currentKimThe đọc trực tiếp (KHÔNG qua StatModifier
    // pipeline — đây là 1 counter runtime, không phải stat tĩnh).
    const kimTheMultiplier = template.element === 'metal'
      ? 1 + source.currentKimThe * getSkillRuntimeStat(source, 'kimTheDotDamagePercentPerStack') + getSkillRuntimeStat(source, 'metalAilmentPotencyPercent')
      : 1

    const damagePerSecond = template.category === 'dot'
      ? this.calculateDamagePerSecond(template, source, target) * (1 + source.stats.ailmentPotencyPercent) * kimTheMultiplier
      : undefined

    const resistMultiplier = 1 - Math.min(AILMENT_RESIST_CAP, Math.max(0, target.stats.ailmentResistPercent))
    // Mộc Tu (Plans/PoisonPath, "Độc Tức"/"Độc Trường" minor) —
    // ailmentDurationPercent nền 0, không ảnh hưởng ailment/path nào
    // chưa có nguồn cấp.
    const duration = template.duration * resistMultiplier * (1 + source.stats.ailmentDurationPercent)

    const existing = this.manager.get(template.id)

    if (!existing) {
      this.manager.add({
        id: template.id,

        category: template.category,

        sourceId: source.id,

        targetId: target.id,

        duration,

        remainingTime: duration,

        stacks: 1,

        maxStacks: template.maxStacks,

        stackMode: template.stackMode,

        damagePerSecond,

        element: template.element,

        ccEffect: template.ccEffect,

        statModifiers: template.statModifiers,

        continuousSeconds: 0,

        convertsToId: template.convertsToOnMaxStacks,

        convertsAfterContinuousSeconds: template.convertsAfterContinuousSeconds,

        // Mộc Tu Trúc Cơ Pure ("Mộc Thế" major, Plans/PoisonPath mục 8)
        // — snapshot 1 lần, || undefined để giữ field "không có" thay
        // vì 0 cho ailment/nguồn không mua node này (gọn hơn khi debug).
        poisonRootPercentPerStack: getSkillRuntimeStat(source, 'poisonRootPercentPerStack') || undefined,

        poisonRootMaxStacks: getSkillRuntimeStat(source, 'poisonRootMaxStacks') || undefined,

        poisonRootThresholdBonusPercent: getSkillRuntimeStat(source, 'poisonRootThresholdBonusPercent') || undefined,

        // Thổ Tu (Thạch Hóa) — snapshot thẳng từ template, KHÔNG có
        // stat nguồn nào chi phối (khác poisonRoot* ở trên) — xem
        // AilmentRegistry.ts's ghi chú.
        onHitChance: template.onHitChance,

        onHitAppliesAilmentId: template.onHitAppliesAilmentId,
      })

      return
    }

    this.handleExisting(existing, template, source, target, duration, damagePerSecond, registry)
  }

  private handleExisting(
    existing: Ailment,
    template: AilmentTemplate,
    source: CombatEntity,
    target: CombatEntity,
    duration: number,
    damagePerSecond: number | undefined,
    registry?: AilmentRegistry,
  ) {
    switch (template.stackMode) {
      case 'stack': {
        let nextStacks = existing.stacks + 1

        if (existing.maxStacks !== undefined) {
          nextStacks = Math.min(nextStacks, existing.maxStacks)
        }

        if (template.convertsToOnMaxStacks && registry && existing.maxStacks !== undefined && nextStacks >= existing.maxStacks) {
          this.manager.remove(existing.id)

          this.apply(registry.get(template.convertsToOnMaxStacks), source, target, registry)

          return
        }

        existing.stacks = nextStacks
        existing.remainingTime = duration

        break
      }

      case 'refresh':
        existing.remainingTime = duration

        break

      case 'replace':
        this.manager.remove(existing.id)

        this.manager.add({
          ...existing,

          sourceId: source.id,

          remainingTime: duration,

          damagePerSecond,
        })

        break
    }
  }

  // Mộc Tu Trúc Cơ Pure ("Độc Căn" major + "Độc Uyên"/"Độc Mạch" minor,
  // Plans/PoisonPath mục 8/10, 2026-08-21) — "Poison càng lâu càng
  // mạnh": số tầng Độc Căn = số giây ailment này đã LIÊN TỤC active
  // trên đúng target (continuousSeconds, KHÔNG reset khi 'stack' re-
  // apply — xem Ailment.ts), trần ở poisonRootMaxStacks. undefined/0 =
  // hệ số 1 (không đổi hành vi cho ailment/nguồn chưa mua "Độc Căn").
  private getPoisonRootMultiplier(ailment: Ailment): number {
    if (!ailment.poisonRootMaxStacks) {
      return 1
    }

    const rootStacks = Math.min(ailment.poisonRootMaxStacks, Math.floor(ailment.continuousSeconds))

    const thresholdBonus =
      rootStacks >= AilmentSystem.POISON_ROOT_THRESHOLD_STACKS ? (ailment.poisonRootThresholdBonusPercent ?? 0) : 0

    return 1 + (ailment.poisonRootPercentPerStack ?? 0) * rootStacks + thresholdBonus
  }

  // "Độc Mạch" minor — ngưỡng "≥3 tầng Độc Căn" (Plans/PoisonPath mục
  // 10).
  private static readonly POISON_ROOT_THRESHOLD_STACKS = 3

  private calculateDamagePerSecond(template: AilmentTemplate, source: CombatEntity, target: CombatEntity): number {
    const ratio = template.dpsRatio ?? 1

    // Kiếm Tu (Vạn Kiếm Triều Tông, 2026-08-15) — "bỏ qua 10%-90% giáp/
    // kháng theo cảnh giới": realmIndex 0 (Luyện Khí) -> 10%, realmIndex
    // 8 (Kiếp Lôi/tribulation, realm cuối) -> 90%, ăn khớp đúng dải
    // 9 cảnh giới hiện có (REALMS.length === 9) — công thức tuyến tính
    // đơn giản nhất khớp 2 đầu mút người dùng yêu cầu, không cần bảng
    // tra riêng.
    const armorIgnoreMultiplier = template.armorIgnorePercentByRealm
      ? 1 - Math.min(0.9, 0.1 + source.realmIndex * 0.1)
      : 1

    if (!template.element || template.element === 'physical') {
      const power = source.stats.attack

      const mitigation = getArmorMitigationPercent(target.stats.defense) * armorIgnoreMultiplier

      return Math.max(0, power * ratio * (1 - mitigation))
    }

    // combat-skill-flow-element-power-dot-plan.md §3.2 — DoT nguyên tố
    // snapshot CÙNG nguồn Skill Power với direct hit: (ATK + Power hệ),
    // qua đúng helper elementalBasePower() để 2 pipeline không thể lệch.
    const power = elementalBasePower(source, template.element)

    const resistance = target.stats[`${template.element}Resistance`]

    const penetration = source.stats[`${template.element}Penetration`]

    const mitigation = getResistanceMitigationPercent(resistance, penetration) * armorIgnoreMultiplier

    return Math.max(0, power * ratio * (1 - mitigation))
  }

  /**
   * Hết hạn + tick DoT — gọi mỗi tick từ BattleSystem, NGAY SAU khi
   * stats hiệu lực vừa recompute (updateStatsFromModifiers()), TRƯỚC
   * các bước attack timer/movement bên dưới đọc stats đó. `combatSystem`
   * giờ cũng lo cả DOT RES/DamageEvent/Poison Recovery (xem
   * CombatSystem.applyDotDamage(), Plans/magicpathgeneral Phase
   * 9-11) — hàm này chỉ còn tính RAW damage (trước DOT RES). `registry`
   * optional — chỉ cần khi có ailment nào đó thật sự cần chuyển hoá
   * theo thời gian (Pháp Tu Thủy Tu, xem convertAilment()); không
   * truyền vẫn an toàn (ailment loại này đơn giản không bao giờ chuyển
   * hoá). `resolveSource` optional — trả về CombatEntity của
   * `ailment.sourceId` nếu còn tồn tại trong trận (xem BattleSystem.
   * updateAilments()); không truyền = Kim Thế penetration/Poison
   * Recovery không kích hoạt (source coi như undefined), DOT RES phía
   * target vẫn hoạt động bình thường vì không cần source.
   */
  update(
    deltaSeconds: number,
    target: CombatEntity,
    combatSystem: CombatSystem,
    registry?: AilmentRegistry,
    resolveSource?: (sourceId: string) => CombatEntity | undefined,
  ) {
    const expired: Ailment[] = []

    for (const ailment of this.manager.getAll()) {
      ailment.continuousSeconds += deltaSeconds

      if (
        registry &&
        ailment.convertsToId &&
        ailment.convertsAfterContinuousSeconds !== undefined &&
        ailment.continuousSeconds >= ailment.convertsAfterContinuousSeconds
      ) {
        this.convertAilment(ailment, registry, target, resolveSource?.(ailment.sourceId))

        continue
      }

      if (target.alive && ailment.category === 'dot' && ailment.damagePerSecond) {
        const rawDamage = ailment.damagePerSecond * ailment.stacks * this.getPoisonRootMultiplier(ailment) * deltaSeconds

        combatSystem.applyDotDamage({
          sourceId: ailment.sourceId,
          source: resolveSource?.(ailment.sourceId),
          target,
          rawDamage,
          element: ailment.element,
          effectId: ailment.id,
        })
      }

      ailment.remainingTime -= deltaSeconds

      if (ailment.remainingTime <= 0) {
        expired.push(ailment)
      }
    }

    for (const ailment of expired) {
      this.manager.remove(ailment.id)
    }
  }

  /**
   * Làm Chậm giữ liên tục đủ lâu -> Đóng Băng (Pháp Tu Thủy Tu). Xây
   * instance MỚI trực tiếp từ template đích thay vì gọi lại apply() —
   * apply() cần 1 `source: CombatEntity` sống để snapshot DoT, nhưng
   * update() chỉ có `target` (không giữ tham chiếu nguồn gây ailment).
   * Ailment đích ở use-case này (Đóng Băng) là CC thuần, không có
   * damagePerSecond nên không cần snapshot DoT — xây thẳng an toàn.
   * Duration VẪN phải qua cùng công thức kháng cự như apply(): giảm theo
   * ailmentResistPercent của đích (+ ailmentDurationPercent của nguồn nếu
   * nguồn còn trong trận) — trước đây lấy trần duration template, bỏ qua
   * kháng cự của đích.
   */
  private convertAilment(
    ailment: Ailment,
    registry: AilmentRegistry,
    target: CombatEntity,
    source?: CombatEntity,
  ) {
    const nextTemplate = registry.get(ailment.convertsToId!)

    this.manager.remove(ailment.id)

    const resistMultiplier = 1 - Math.min(AILMENT_RESIST_CAP, Math.max(0, target.stats.ailmentResistPercent))

    const duration = nextTemplate.duration * resistMultiplier * (1 + (source?.stats.ailmentDurationPercent ?? 0))

    // Dedupe: nếu đích ĐÃ có sẵn ailment đích (vd Đóng Băng từ nguồn
    // khác), add thẳng tạo 2 instance cùng id — manager.remove lọc theo id
    // sẽ xoá CẢ HAI khi 1 cái hết hạn. Remove instance cũ trước để thế chỗ.
    this.manager.remove(nextTemplate.id)

    this.manager.add({
      id: nextTemplate.id,

      category: nextTemplate.category,

      sourceId: ailment.sourceId,

      targetId: ailment.targetId,

      duration,

      remainingTime: duration,

      stacks: 1,

      maxStacks: nextTemplate.maxStacks,

      stackMode: nextTemplate.stackMode,

      element: nextTemplate.element,

      ccEffect: nextTemplate.ccEffect,

      statModifiers: nextTemplate.statModifiers,

      continuousSeconds: 0,

      convertsToId: nextTemplate.convertsToOnMaxStacks,

      convertsAfterContinuousSeconds: nextTemplate.convertsAfterContinuousSeconds,
    })
  }

  /**
   * Ailment category 'modifier' (Làm Chậm/Hàn Khí/Cuồng Bạo/Suy Nhược/
   * Uy Áp) biểu diễn được bằng StatModifier — hoà chung pool Increased
   * với buff/equipment khác trên CÙNG stat (xem
   * StatCalculator.calculateStats()), không cần code riêng trong
   * BattleSystem. Choáng/Đóng Băng đọc qua isStunned()/isFrozen() thay
   * vì modifier (không diễn tả được bằng số nhân/cộng đơn thuần — cần
   * CHẶN HẲN hành động/di chuyển).
   */
  getActiveModifiers(): StatModifier[] {
    const modifiers: StatModifier[] = []

    for (const ailment of this.manager.getAll()) {
      for (const entry of ailment.statModifiers ?? []) {
        modifiers.push({
          id: `ailment:${ailment.id}:${entry.stat}`,
          sourceId: ailment.sourceId,
          sourceType: 'ailment',
          stat: entry.stat,
          flat: entry.flat,
          percent: entry.percent,
          stacks: ailment.stacks,
        })
      }
    }

    return modifiers
  }

  // Combat Rework Phase 6 (Pháp Tu Reaction) — liệt kê MỌI ailment
  // đang active trên entity sở hữu pool này, để ReactionManager quét
  // tìm cặp khớp ELEMENT_REACTIONS. Xem core/element/ReactionManager.ts.
  getActiveIds(): AilmentId[] {
    return this.manager.getAll().map(ailment => ailment.id)
  }

  /**
   * Thổ Tu (Thạch Hóa, Plans/magicpathgeneral, 2026-08-21) — gọi bởi
   * BattleSystem NGAY SAU 1 đòn XÁC NHẬN TRÚNG (không dodged) lên
   * chính entity sở hữu pool này. Quét MỌI ailment đang active có khai
   * onHitChance/onHitAppliesAilmentId (field TỔNG QUÁT, không riêng gì
   * Thạch Hóa — xem AilmentRegistry.ts), roll ĐỘC LẬP cho từng ailment
   * (1 target có thể có nhiều nguồn on-hit-proc cùng lúc, dù hiện tại
   * chỉ Thạch Hóa dùng), rồi áp `onHitAppliesAilmentId` nếu thắng roll.
   * `target` = entity sở hữu pool này (self, cần truyền lại để
   * apply() ghi đúng targetId); `source` = kẻ VỪA đánh trúng (chủ
   * nhân của ailment MỚI sinh ra, vd Choáng sourceId = người đánh).
   */
  rollOnHitEffects(source: CombatEntity, target: CombatEntity, registry: AilmentRegistry) {
    for (const ailment of this.manager.getAll()) {
      if (ailment.onHitChance && ailment.onHitAppliesAilmentId && Math.random() < ailment.onHitChance) {
        this.apply(registry.get(ailment.onHitAppliesAilmentId), source, target, registry)
      }
    }
  }

  isStunned(): boolean {
    return this.manager.getAll().some(ailment => ailment.ccEffect === 'stun')
  }

  isFrozen(): boolean {
    return this.manager.getAll().some(ailment => ailment.ccEffect === 'freeze')
  }

  // Thổ Tu ("Trói Chân", Plans/EarthPath mục VI, 2026-08-21) — Root:
  // CHỈ chặn resolveMovement() (xem BattleSystem.ts), KHÔNG tính vào
  // isIncapacitated() — target vẫn attack/cast bình thường.
  isRooted(): boolean {
    return this.manager.getAll().some(ailment => ailment.ccEffect === 'root')
  }

  // Pháp Tu — Detonate (SkillEffect.consumesAilmentId, xem
  // SkillEffectSystem.ts) — "cash in" số stack hiện có của 1 ailment
  // (vd Bỏng) cho 1 skill burst, rồi xoá hẳn ailment đó khỏi target.
  getStacks(ailmentId: AilmentId): number {
    return this.manager.get(ailmentId)?.stacks ?? 0
  }

  remove(ailmentId: AilmentId) {
    this.manager.remove(ailmentId)
  }

  // Thủy Tu Trúc Cơ Reaction ("Dẫn Lưu" major, Plans/waterpath mục
  // VII, 2026-08-21) — dùng khi ReactionManager quyết định GIỮ LẠI 1
  // ailment (gia hạn thêm giây) thay vì xoá nó như hành vi mặc định
  // (no-op nếu ailment không còn active — Reaction luôn kiểm tra
  // trước khi gọi). Plans/magicpathgeneral Phase 16 invariant
  // (2026-08-21) — "Reaction không được mutate debuff cũ": KHÔNG sửa
  // trực tiếp field remainingTime trên instance đang có (đã từng làm
  // `ailment.remainingTime += seconds`), mà xoá hẳn rồi tạo 1 instance
  // MỚI (spread field cũ + remainingTime cộng thêm) — hành vi quan sát
  // được bên ngoài giống hệt, nhưng không còn giữ tham chiếu tới
  // object cũ nào bị sửa tại chỗ.
  renewWithExtension(ailmentId: AilmentId, extraSeconds: number) {
    const existing = this.manager.get(ailmentId)

    if (!existing) {
      return
    }

    this.manager.remove(ailmentId)

    this.manager.add({
      ...existing,

      remainingTime: existing.remainingTime + extraSeconds,
    })
  }
}
