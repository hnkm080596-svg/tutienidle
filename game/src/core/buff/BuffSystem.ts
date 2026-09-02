import type { Buff } from './Buff'
import type { BuffDefinition } from './BuffDefinition'
import { BuffPool } from './BuffPool'
import type { StatModifier } from '../stats/StatCalculator'
import type { CombatEntity } from '../combat/CombatEntity'
import type { CombatSystem } from '../combat/CombatSystem'
import type { BuffRegistry } from './BuffRegistry'
import { getSkillRuntimeStat } from '../skill/SkillRuntimeStats'
import { getArmorMitigationPercent } from '../combat/Armor'
import { getResistanceMitigationPercent } from '../combat/Resistance'
import { elementalBasePower } from '../combat/ElementDamageCalculator'
import type { BuffEffectTemplate } from './BuffTypes'

// Trần % giảm duration buff/debuff nhận vào — tránh ailmentResistPercent
// cao vô hạn triệt tiêu hoàn toàn debuff (ported verbatim từ
// AilmentSystem.AILMENT_RESIST_CAP).
const AILMENT_RESIST_CAP = 0.75

// "Độc Mạch" minor — ngưỡng "≥3 tầng Độc Căn" (ported verbatim từ
// AilmentSystem.POISON_ROOT_THRESHOLD_STACKS).
const POISON_ROOT_THRESHOLD_STACKS = 3

/**
 * 1 BuffSystem bọc 1 BuffPool — pool CỦA 1 ENTITY (target), y hệt
 * AilmentSystem/AilmentManager trước đây. Absorbs AilmentSystem's DoT-
 * scaling/CC/conversion-chain logic verbatim, generalized to iterate
 * `effects[]` (thay vì field cứng damagePerSecond/ccEffect/statModifiers
 * trên Ailment) và index theo `(id, sourceId)` (thay vì id đơn — xem
 * BuffPool.ts) để nhiều nguồn cùng áp 1 buff/debuff id không còn giẫm
 * lên nhau.
 */
export class BuffSystem {
  constructor(private readonly pool: BuffPool) {}

  /**
   * DoT: snapshot damagePerSecond NGAY lúc áp dụng (Power của nguồn, đã
   * trừ mitigation của đích tại thời điểm này, NHÂN thêm
   * ailmentPotencyPercent của nguồn) — không đọc lại stats mỗi tick, rẻ
   * và ổn định dù nguồn/đích có buff đổi giữa chừng. Duration cũng bị
   * giảm theo ailmentResistPercent của đích ngay tại đây (snapshot 1
   * lần, không đọc lại mỗi tick). `registry` chỉ cần cho `convertsToId`
   * (Hàn Khí -> Đóng Băng) — optional vì phần lớn buff/debuff không cần
   * chain.
   */
  apply(definition: BuffDefinition, source: CombatEntity, target: CombatEntity, registry?: BuffRegistry) {
    const resolvedEffects = definition.effects.map((effect) =>
      effect.type === 'dot'
        ? {
            type: 'dot' as const,
            damagePerSecond: this.calculateDamagePerSecond(effect, source, target),
            element: effect.element,
            poisonRootPercentPerStack: effect.poisonRootPercentPerStack,
            poisonRootMaxStacks: effect.poisonRootMaxStacks,
            poisonRootThresholdBonusPercent: effect.poisonRootThresholdBonusPercent,
          }
        : effect,
    )

    const resistMultiplier = 1 - Math.min(AILMENT_RESIST_CAP, Math.max(0, target.stats.ailmentResistPercent))
    const duration = definition.duration * resistMultiplier * (1 + source.stats.ailmentDurationPercent)

    const existing = this.pool.getFromSource(definition.id, source.id)

    if (!existing) {
      this.pool.add({
        id: definition.id,
        sourceId: source.id,
        targetId: target.id,
        polarity: definition.polarity,
        hidden: definition.hidden,
        duration,
        remainingTime: duration,
        stacks: 1,
        maxStacks: this.resolveMaxStacks(definition, source),
        stackMode: definition.stackMode,
        continuousSeconds: 0,
        convertsToId: definition.convertsToId,
        convertsAfterContinuousSeconds: definition.convertsAfterContinuousSeconds,
        effects: resolvedEffects,
      })
      return
    }

    this.handleExisting(existing, definition, source, target, duration, resolvedEffects, registry)
  }

  // Trần stack của 1 buff definition trên 1 entity — `definition.maxStacks`
  // là nền, `source.skillStats.maxStacksBonusByBuffId[definition.id]` (nếu
  // có) cộng thêm (node "Độc Chướng" +1 trần Trúng Độc — Pháp Tu Thuần
  // Hệ E-2, 2026-09-03). Không truyền skillStats = y hệt hành vi cũ.
  private resolveMaxStacks(definition: BuffDefinition, source: CombatEntity): number | undefined {
    if (definition.maxStacks === undefined) {
      return undefined
    }

    const bonus = source.skillStats?.maxStacksBonusByBuffId?.[definition.id] ?? 0

    return definition.maxStacks + bonus
  }

  private handleExisting(
    existing: Buff,
    definition: BuffDefinition,
    source: CombatEntity,
    target: CombatEntity,
    duration: number,
    resolvedEffects: Buff['effects'],
    registry?: BuffRegistry,
  ) {
    switch (definition.stackMode) {
      case 'stack': {
        let nextStacks = existing.stacks + 1
        if (existing.maxStacks !== undefined) {
          nextStacks = Math.min(nextStacks, existing.maxStacks)
        }

        if (
          definition.convertsToId &&
          registry &&
          existing.maxStacks !== undefined &&
          nextStacks >= existing.maxStacks
        ) {
          this.pool.removeInstance(existing.id, existing.sourceId)
          this.apply(registry.get(definition.convertsToId), source, target, registry)
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
        this.pool.removeInstance(existing.id, existing.sourceId)
        this.pool.add({
          ...existing,
          duration,
          remainingTime: duration,
          effects: resolvedEffects,
        })
        break
    }
  }

  // Mộc Tu Trúc Cơ Pure ("Độc Căn" major + "Độc Uyên"/"Độc Mạch" minor) —
  // "Poison càng lâu càng mạnh": số tầng Độc Căn = số giây buff này đã
  // LIÊN TỤC active trên đúng target (continuousSeconds, KHÔNG reset khi
  // 'stack' re-apply — xem Buff.ts), trần ở poisonRootMaxStacks.
  // undefined/0 = hệ số 1 (không đổi hành vi cho buff/nguồn chưa mua
  // "Độc Căn").
  private getPoisonRootMultiplier(effect: Extract<Buff['effects'][number], { type: 'dot' }>, continuousSeconds: number): number {
    if (!effect.poisonRootMaxStacks) {
      return 1
    }

    const rootStacks = Math.min(effect.poisonRootMaxStacks, Math.floor(continuousSeconds))
    const thresholdBonus =
      rootStacks >= POISON_ROOT_THRESHOLD_STACKS ? (effect.poisonRootThresholdBonusPercent ?? 0) : 0

    return 1 + (effect.poisonRootPercentPerStack ?? 0) * rootStacks + thresholdBonus
  }

  private calculateDamagePerSecond(
    effect: Extract<BuffEffectTemplate, { type: 'dot' }>,
    source: CombatEntity,
    target: CombatEntity,
  ): number {
    const ratio = effect.dpsRatio ?? 1

    // Kiếm Tu (Vạn Kiếm Triều Tông) — "bỏ qua 10%-90% giáp/kháng theo cảnh
    // giới": realmIndex 0 (Luyện Khí) -> 10%, realmIndex 8 (Kiếp Lôi/
    // tribulation, realm cuối) -> 90% — ported verbatim from
    // AilmentSystem.calculateDamagePerSecond().
    const armorIgnoreMultiplier = effect.armorIgnorePercentByRealm
      ? 1 - Math.min(0.9, 0.1 + source.realmIndex * 0.1)
      : 1

    if (!effect.element || effect.element === 'physical') {
      // T5.4 (merge 2026-09-02) — armor mitigation K-scale theo realmIndex
      // của đích (giống master's port vào AilmentSystem cũ trước khi xoá).
      // Không truyền = mất cân bằng DoT vật lý late-game (giáp target
      // realm cao giảm gần như toàn bộ DoT).
      const power = source.stats.attack
      const mitigation =
        getArmorMitigationPercent(target.stats.defense, target.realmIndex) * armorIgnoreMultiplier
      return Math.max(0, power * ratio * (1 - mitigation)) * (1 + source.stats.ailmentPotencyPercent)
    }

    // combat-skill-flow-element-power-dot-plan.md §3.2 — DoT nguyên tố
    // snapshot CÙNG nguồn Skill Power với direct hit: (ATK + Power hệ),
    // qua đúng helper elementalBasePower() để 2 pipeline không thể lệch.
    const power = elementalBasePower(source, effect.element)
    const resistance = target.stats[`${effect.element}Resistance`]
    const penetration = source.stats[`${effect.element}Penetration`]
    const mitigation = getResistanceMitigationPercent(resistance, penetration) * armorIgnoreMultiplier

    // Kim Tu Trúc Cơ Pure ("Kim Thế" major + "Huyết Lưu" minor) — CHỈ
    // nhân cho DoT element 'metal' (Xuất Huyết/Huyết Độc), KHÔNG qua
    // ailmentPotencyPercent chung — tránh build lai (vd Kim+Mộc) tự buff
    // nhầm DoT hành khác chỉ vì có Kim Thế. currentKimThe đọc trực tiếp
    // (KHÔNG qua StatModifier pipeline — đây là 1 counter runtime,
    // không phải stat tĩnh).
    const kimTheMultiplier =
      effect.element === 'metal'
        ? 1 +
          source.currentKimThe * getSkillRuntimeStat(source, 'kimTheDotDamagePercentPerStack') +
          getSkillRuntimeStat(source, 'metalAilmentPotencyPercent')
        : 1

    return Math.max(0, power * ratio * (1 - mitigation)) * (1 + source.stats.ailmentPotencyPercent) * kimTheMultiplier
  }

  /**
   * Hết hạn + tick DoT — gọi mỗi tick từ BattleSystem, NGAY SAU khi
   * stats hiệu lực vừa recompute (updateStatsFromModifiers()), TRƯỚC
   * các bước attack timer/movement bên dưới đọc stats đó. `combatSystem`
   * lo cả DOT RES/DamageEvent/Poison Recovery (xem
   * CombatSystem.applyDotDamage()) — hàm này chỉ còn tính RAW damage
   * (trước DOT RES). `registry` optional — chỉ cần khi có buff nào đó
   * thật sự cần chuyển hoá theo thời gian (Pháp Tu Thủy Tu, xem
   * convert()); không truyền vẫn an toàn (buff loại này đơn giản không
   * bao giờ chuyển hoá). `resolveSource` optional — trả về CombatEntity
   * của `buff.sourceId` nếu còn tồn tại trong trận; không truyền = Kim
   * Thế penetration/Poison Recovery không kích hoạt (source coi như
   * undefined), DOT RES phía target vẫn hoạt động bình thường vì không
   * cần source.
   */
  update(
    deltaSeconds: number,
    target: CombatEntity,
    combatSystem: CombatSystem,
    registry?: BuffRegistry,
    resolveSource?: (sourceId: string) => CombatEntity | undefined,
  ) {
    const expired: Buff[] = []

    for (const buff of this.pool.getAll()) {
      buff.continuousSeconds += deltaSeconds

      if (
        registry &&
        buff.convertsToId &&
        buff.convertsAfterContinuousSeconds !== undefined &&
        buff.continuousSeconds >= buff.convertsAfterContinuousSeconds
      ) {
        this.convert(buff, registry, target, resolveSource?.(buff.sourceId))
        continue
      }

      for (const effect of buff.effects) {
        if (effect.type === 'dot' && effect.damagePerSecond && target.alive) {
          const rawDamage =
            effect.damagePerSecond * buff.stacks * this.getPoisonRootMultiplier(effect, buff.continuousSeconds) * deltaSeconds

          combatSystem.applyDotDamage({
            sourceId: buff.sourceId,
            source: resolveSource?.(buff.sourceId),
            target,
            rawDamage,
            element: effect.element,
            effectId: buff.id,
          })
        }
      }

      buff.remainingTime -= deltaSeconds
      if (buff.remainingTime <= 0) {
        expired.push(buff)
      }
    }

    for (const buff of expired) {
      this.pool.removeInstance(buff.id, buff.sourceId)
    }
  }

  /**
   * Làm Chậm giữ liên tục đủ lâu -> Đóng Băng (Pháp Tu Thủy Tu). Xây
   * instance MỚI trực tiếp từ definition đích thay vì gọi lại apply() —
   * apply() cần 1 `source: CombatEntity` sống để snapshot DoT, nhưng
   * update() chỉ có `target` (không giữ tham chiếu nguồn gây buff).
   * Buff đích ở use-case này (Đóng Băng) là CC thuần, không có DoT nên
   * không cần snapshot damagePerSecond — xây thẳng an toàn. Duration
   * VẪN phải qua cùng công thức kháng cự như apply(): giảm theo
   * ailmentResistPercent của đích (+ ailmentDurationPercent của nguồn
   * nếu nguồn còn trong trận).
   */
  private convert(buff: Buff, registry: BuffRegistry, target: CombatEntity, source?: CombatEntity) {
    const nextDefinition = registry.get(buff.convertsToId!)

    this.pool.removeInstance(buff.id, buff.sourceId)

    const resistMultiplier = 1 - Math.min(AILMENT_RESIST_CAP, Math.max(0, target.stats.ailmentResistPercent))
    const duration = nextDefinition.duration * resistMultiplier * (1 + (source?.stats.ailmentDurationPercent ?? 0))

    // Dedupe: nếu đích ĐÃ có sẵn buff đích từ CÙNG nguồn (vd Đóng Băng
    // từ cùng nguồn), add thẳng tạo 2 instance cùng (id, sourceId) —
    // removeInstance lọc theo (id, sourceId) sẽ xoá CẢ HAI khi 1 cái
    // hết hạn. Remove instance cũ trước để thế chỗ.
    this.pool.removeInstance(nextDefinition.id, buff.sourceId)

    this.pool.add({
      id: nextDefinition.id,
      sourceId: buff.sourceId,
      targetId: buff.targetId,
      polarity: nextDefinition.polarity,
      hidden: nextDefinition.hidden,
      duration,
      remainingTime: duration,
      stacks: 1,
      maxStacks: nextDefinition.maxStacks,
      stackMode: nextDefinition.stackMode,
      continuousSeconds: 0,
      convertsToId: nextDefinition.convertsToId,
      convertsAfterContinuousSeconds: nextDefinition.convertsAfterContinuousSeconds,
      effects: nextDefinition.effects.map((effect) =>
        effect.type === 'dot' ? { ...effect, damagePerSecond: 0 } : effect,
      ),
    })
  }

  /**
   * Buff effect 'statModifier' (Làm Chậm/Hàn Khí/Cuồng Bạo/Suy Nhược/Uy
   * Áp) biểu diễn được bằng StatModifier — hoà chung pool Increased với
   * buff/equipment khác trên CÙNG stat (xem
   * StatCalculator.calculateStats()), không cần code riêng trong
   * BattleSystem. Choáng/Đóng Băng/Trói Chân đọc qua
   * isStunned()/isFrozen()/isRooted() thay vì modifier (không diễn tả
   * được bằng số nhân/cộng đơn thuần — cần CHẶN HẲN hành động/di
   * chuyển).
   */
  getActiveModifiers(): StatModifier[] {
    const modifiers: StatModifier[] = []

    for (const buff of this.pool.getAll()) {
      for (const effect of buff.effects) {
        if (effect.type === 'statModifier') {
          modifiers.push({
            id: `buff:${buff.id}:${buff.sourceId}:${effect.stat}`,
            sourceId: buff.sourceId,
            sourceType: buff.polarity,
            stat: effect.stat,
            flat: effect.flat,
            percent: effect.percent,
            stacks: buff.stacks,
          })
        }
      }
    }

    return modifiers
  }

  isStunned(): boolean {
    return this.pool.getAll().some((buff) => buff.effects.some((e) => e.type === 'cc' && e.ccEffect === 'stun'))
  }

  isFrozen(): boolean {
    return this.pool.getAll().some((buff) => buff.effects.some((e) => e.type === 'cc' && e.ccEffect === 'freeze'))
  }

  // Thổ Tu ("Trói Chân") — Root: CHỈ chặn resolveMovement() (xem
  // BattleSystem.ts), KHÔNG tính vào isIncapacitated() — target vẫn
  // attack/cast bình thường.
  isRooted(): boolean {
    return this.pool.getAll().some((buff) => buff.effects.some((e) => e.type === 'cc' && e.ccEffect === 'root'))
  }

  /**
   * Thổ Tu (Thạch Hóa) — gọi bởi BattleSystem NGAY SAU 1 đòn XÁC NHẬN
   * TRÚNG (không dodged) lên chính entity sở hữu pool này. Quét MỌI
   * buff đang active có khai onHitProc (field TỔNG QUÁT, không riêng gì
   * Thạch Hóa), roll ĐỘC LẬP cho từng buff (1 target có thể có nhiều
   * nguồn on-hit-proc cùng lúc), rồi áp `appliesBuffId` nếu thắng roll.
   * `target` = entity sở hữu pool này (self, cần truyền lại để apply()
   * ghi đúng targetId); `source` = kẻ VỪA đánh trúng (chủ nhân của buff
   * MỚI sinh ra, vd Choáng sourceId = người đánh).
   */
  rollOnHitEffects(source: CombatEntity, target: CombatEntity, registry: BuffRegistry) {
    for (const buff of this.pool.getAll()) {
      for (const effect of buff.effects) {
        if (effect.type === 'onHitProc' && Math.random() < effect.chance) {
          this.apply(registry.get(effect.appliesBuffId), source, target, registry)
        }
      }
    }
  }

  // Pháp Tu — Detonate (SkillEffect.consumesAilmentId) — "cash in" số
  // stack hiện có của 1 buff/debuff (vd Bỏng) cho 1 skill burst. Không
  // truyền sourceId = tổng stacks trên MỌI nguồn (vd multi-source
  // poison), truyền sourceId = đúng 1 instance của nguồn đó.
  getStacks(id: string, sourceId?: string): number {
    if (sourceId !== undefined) {
      return this.pool.getFromSource(id, sourceId)?.stacks ?? 0
    }
    return this.pool.getAllById(id).reduce((sum, buff) => sum + buff.stacks, 0)
  }

  getFromSource(id: string, sourceId: string): Buff | undefined {
    return this.pool.getFromSource(id, sourceId)
  }

  getAllById(id: string): Buff[] {
    return this.pool.getAllById(id)
  }

  // Combat Rework Phase 6 (Pháp Tu Reaction) — liệt kê MỌI buff/debuff
  // id đang active trên entity sở hữu pool này, để ReactionManager quét
  // tìm cặp khớp ELEMENT_REACTIONS.
  getActiveIds(): string[] {
    return this.pool.getAll().map((buff) => buff.id)
  }

  // Bản sao theo lịch sử của BuffPool.getAll() — cần cho các consumer
  // quét TOÀN BỘ instance (vd SkillEffectSystem's 'remove_buff' lọc
  // theo polarity/count) mà không đụng tới pool nội bộ.
  getAll(): Buff[] {
    return this.pool.getAll()
  }

  remove(id: string, sourceId: string): void {
    this.pool.removeInstance(id, sourceId)
  }

  removeAllById(id: string): void {
    this.pool.removeAllById(id)
  }

  // Thủy Tu Trúc Cơ Reaction ("Dẫn Lưu") — dùng khi ReactionManager
  // quyết định GIỮ LẠI 1 buff/debuff (gia hạn thêm giây) thay vì xoá nó
  // như hành vi mặc định (no-op nếu buff không còn active). Invariant
  // "Reaction không được mutate debuff cũ": KHÔNG sửa trực tiếp field
  // remainingTime trên instance đang có, mà xoá hẳn rồi tạo 1 instance
  // MỚI (spread field cũ + remainingTime cộng thêm).
  renewWithExtension(id: string, sourceId: string, extraSeconds: number): void {
    const existing = this.pool.getFromSource(id, sourceId)
    if (!existing) {
      return
    }

    this.pool.removeInstance(id, sourceId)
    this.pool.add({ ...existing, remainingTime: existing.remainingTime + extraSeconds })
  }
}
