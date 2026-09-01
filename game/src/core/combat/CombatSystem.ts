import type { CombatEntity } from './CombatEntity'

import { calculateBaseDamage, applyMultiplierAndCritical } from './DamageCalculator'
import { calculateSkillBaseDamage } from './ElementDamageCalculator'
import { getRealmPressureMultiplier } from './RealmPressure'
import { getHitChance } from './Accuracy'
import { applyEndurance } from './Endurance'

import type { DamageResult } from './CombatTypes'

import type { EventBus } from '../events/EventBus'
import type { ActionDamageInfo } from '../battle/ActionImpactSystem'
import type { ElementType } from '../element/ElementType'
import { EntityVitalsSystem, type VitalsChangeReason } from './EntityVitalsSystem'
import { clampStatValue } from '../stats/StatMetadata'
import { getSkillRuntimeStat } from '../skill/SkillRuntimeStats'
import type { SurviveLethalGuard } from '../talent/SurviveLethalGuard'
import type { SkillManager } from '../skill/SkillManager'
import { SkillTriggerRunner } from '../skill/SkillTriggerRunner'
import type { SkillEffectContext } from '../skill/SkillEffectSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import { BuffSystem } from '../buff/BuffSystem'
import { BuffPool } from '../buff/BuffPool'
import { ReactionManager } from '../element/ReactionManager'

// Thủy Tu Trúc Cơ Pure (Plans/waterpath mục IX, 2026-08-21) — trần %
// giảm sát thương từ thuyThePercent, cùng tinh thần ARMOR_CAP (Armor.
// ts) — không thể trở nên bất tử chỉ bằng cách stack riêng 1 stat.
const WATER_MITIGATION_CAP = 0.75

// Plans/magicpathgeneral Phase 9 (2026-08-21) — DOT RES là 1 stat
// dạng "*Percent" (fraction 0..1, CÙNG THANG với ailmentResistPercent/
// ailmentPotencyPercent...), KHÁC thang "Rating" (net/100) của
// Resistance.ts's getResistanceMitigationPercent() (dùng cho 5 hành
// Power/Resistance/Penetration) — không tái dùng hàm đó ở đây để
// tránh lệch thang đo. kimTheDotResistancePenetrationPercentPerStack
// (penetration) CŨNG là fraction cùng thang, trừ thẳng.
const DOT_RESISTANCE_CAP = 0.75
const DOT_RESISTANCE_FLOOR = -1

/**
 * Toàn bộ combat giờ đi qua action impact (xem ActionImpactSystem/
 * BattleSystem) — resolveActionHit() là điểm vào
 * DUY NHẤT tính damage thật (attack()/attackWithElements() cũ đã bị
 * xoá, không còn nơi nào gọi từ khi combat chuyển hẳn sang action impact).
 *
 * Pipeline đầy đủ (đúng thứ tự accuracy → dodge → block →
 * armor/resistance → endurance → ward → HP): mitigation Armor/
 * Resistance đã áp xong TRONG calculateBaseDamage()/
 * calculateSkillBaseDamage() (mỗi component tự mitigate theo đúng
 * loại của nó — không gộp chung 1 công thức được vì skill nhiều
 * component có thể mang nhiều hành khác nhau cùng lúc). Block và
 * Armor/Resistance đều là % nhân đơn thuần nên thứ tự tính giữa 2
 * bước không đổi kết quả cuối (phép nhân giao hoán) — chỉ thứ tự
 * SỰ KIỆN/emit mới theo đúng accuracy→dodge→block như yêu cầu.
 */
export class CombatSystem {
  readonly vitals: EntityVitalsSystem

  // Thiên phú Bất Tử Thể (talent-direction-choice-plan §6) — session
  // battle-scoped: id entity player + guard giữ lượt sống sót. null =
  // không bảo vệ (trận Độ Kiếp, trận không có PlayerData, hoặc không có
  // thiên phú). GameManager set/reset mỗi lần bắt đầu trận.
  private surviveLethalSession: { playerEntityId: string; guard: SurviveLethalGuard } | null = null

  // Trigger/Action rework Task 10 (2026-08-31 spec) — onKill firing.
  // buffRegistry/reactionManager are shared, non-battle-specific
  // dependencies (same kind BattleSystem itself receives via its own
  // constructor — see BattleSystem.ts) — injected here as optional final
  // constructor params so CombatSystem can build a real SkillEffectContext
  // without crashing on an empty registry `.get()` miss. `skillManager`/
  // `buffRegistry`/`reactionManager` are all optional; every existing
  // `new CombatSystem(eventBus)` call site keeps compiling unchanged.
  private readonly skillTriggerRunner = new SkillTriggerRunner()

  constructor(
    private readonly eventBus: EventBus,
    private readonly skillManager?: SkillManager,
    private readonly buffRegistry?: BuffRegistry,
    private readonly reactionManager?: ReactionManager,
  ) {
    this.vitals = new EntityVitalsSystem(eventBus)
  }

  setSurviveLethalSession(
    session: { playerEntityId: string; guard: SurviveLethalGuard } | null,
  ): void {
    this.surviveLethalSession = session
  }

  applyDirectDamage(target: CombatEntity, amount: number, sourceId: string, reason: VitalsChangeReason = 'damage') {
    const applied = this.vitals.applyDamage(target, amount, reason, sourceId)
    this.killIfDead(target, sourceId)
    return applied
  }

  // finalDamagePercent/finalDamageReductionPercent (affix top-tier, thay
  // Supreme Strength/Intelligence) — dùng chung bởi resolveAttack()/
  // applyDotDamage() VÀ mọi damage phản hồi trực tiếp (thorns, ward-break,
  // reaction) để affix này thật sự áp dụng xuyên suốt pipeline, không chỉ
  // đòn đánh chính.
  private finalDamageMultiplier(attacker: CombatEntity | undefined, defender: CombatEntity): number {
    return (1 + (attacker?.stats.finalDamagePercent ?? 0)) * (1 - clampStatValue('finalDamageReductionPercent', defender.stats.finalDamageReductionPercent))
  }

  applyModifiedDirectDamage(target: CombatEntity, rawAmount: number, attacker: CombatEntity, reason: VitalsChangeReason = 'damage') {
    const amount = Math.max(0, rawAmount * this.finalDamageMultiplier(attacker, target))
    return this.applyDirectDamage(target, amount, attacker.id, reason)
  }

  applyHealing(target: CombatEntity, amount: number, sourceId: string, reason: VitalsChangeReason = 'healing') {
    return this.vitals.applyHealing(target, amount, reason, sourceId)
  }

  resolveActionHit(
    source: CombatEntity,
    target: CombatEntity,
    damage: ActionDamageInfo,
    critical = false,
  ): DamageResult {
    if (!this.rollHit(source, target)) {
      return this.resolveDodge(source, target, damage.kind)
    }

    const effectiveMultiplier = damage.multiplier * getRealmPressureMultiplier(source, target)

    // Chance to Ignore Resistance — roll 1 LẦN/đòn (khác Penetration phẳng,
    // đây là "bỏ qua hoàn toàn" mitigation của đòn đó nếu trúng).
    const ignoreResistance = Math.random() < clampStatValue('chanceToIgnoreResistance', source.stats.chanceToIgnoreResistance)

    const baseDamage = damage.kind === 'elemental'
      ? calculateSkillBaseDamage(source, target, damage.components, ignoreResistance)
      : calculateBaseDamage(source, target, damage.kind, ignoreResistance)

    const afterCrit = applyMultiplierAndCritical(baseDamage, effectiveMultiplier, critical, source.stats.criticalDamage)

    const blocked = this.rollBlock(target)

    const afterBlock = blocked ? afterCrit * (1 - clampStatValue('blockEffectiveness', target.stats.blockEffectiveness)) : afterCrit

    const afterEndurance = applyEndurance(afterBlock, target.stats.enduranceThreshold, clampStatValue('endurancePercent', target.stats.endurancePercent))

    // Thủy Tu Trúc Cơ Pure (Plans/waterpath mục IX) — giảm thẳng %
    // TOÀN BỘ sát thương cuối cùng (không phân biệt loại damage, cùng
    // tầng với Endurance — cả 2 đều là lớp phòng thủ "cá nhân", không
    // phải Armor/Resistance theo loại), nền 0 nên không ảnh hưởng path
    // nào chưa có nguồn cấp.
    const afterWaterMitigation = afterEndurance * (1 - Math.min(WATER_MITIGATION_CAP, getSkillRuntimeStat(target, 'thuyThePercent')))

    // Floor "tối thiểu 1" áp trong resolveAttack() SAU finalDamageMultiplier
    // (finalDamagePercent/finalDamageReductionPercent) — đòn bị giảm nhiều
    // tầng vẫn luôn gây được ít nhất 1 sát thương, kể cả khi affix giảm
    // sát thương cuối cùng kéo về dưới 1.
    const finalDamage = afterWaterMitigation

    const result: DamageResult = {
      sourceId: source.id,

      targetId: target.id,

      rawDamage: finalDamage,

      finalDamage,

      damageType: damage.kind,

      critical,

      dodged: false,

      blocked,

      wardAbsorbed: 0,

      manaShieldAbsorbed: 0,

      targetKilled: target.currentHp <= finalDamage,
    }

    return this.resolveAttack(source, target, result, critical, blocked)
  }

  private rollHit(source: CombatEntity, target: CombatEntity): boolean {
    return Math.random() < getHitChance(source.stats.accuracyRating, target.stats.evasionRate)
  }

  private rollBlock(target: CombatEntity): boolean {
    return Math.random() < clampStatValue('blockChance', target.stats.blockChance)
  }

  /**
   * Public vì critical phải roll lúc BẮN missile (mang theo suốt
   * hành trình bay), không còn roll ngay lúc tính damage như trước —
   * cần gọi được từ BattleSystem lẫn SkillEffectSystem (2 nơi bắn
   * missile), không chỉ nội bộ CombatSystem. `target` dùng để trừ
   * Critical Strike Avoidance của phía phòng thủ (chance hiệu lực
   * không thể âm).
   */
  rollCritical(source: CombatEntity, target: CombatEntity): boolean {
    const effectiveChance = clampStatValue('criticalRate', source.stats.criticalRate - target.stats.criticalAvoidance)

    return Math.random() < effectiveChance
  }

  /**
   * Trượt (accuracy thua evasion trong contest — xem Accuracy.ts) —
   * không tính damage, không trừ HP, không tích rage. Chỉ emit
   * 'dodge' (giữ nguyên tên event/trigger cũ, không đổi PassiveSystem/
   * FormationSystem) rồi trả kết quả rỗng — KHÔNG đi qua resolveAttack().
   */
  private resolveDodge(
    source: CombatEntity,
    target: CombatEntity,
    damageType: DamageResult['damageType'],
  ): DamageResult {
    this.eventBus.emit('dodge', {
      type: 'dodge',

      sourceId: source.id,

      targetId: target.id,
    })

    return {
      sourceId: source.id,

      targetId: target.id,

      rawDamage: 0,

      finalDamage: 0,

      damageType,

      critical: false,

      dodged: true,

      blocked: false,

      wardAbsorbed: 0,

      manaShieldAbsorbed: 0,

      targetKilled: false,
    }
  }

  private resolveAttack(
    source: CombatEntity,
    target: CombatEntity,
    result: DamageResult,
    critical: boolean,
    blocked: boolean,
  ) {
    const targetBefore = { hp: target.currentHp, ward: target.currentWard, mp: target.currentMp }
    // Floor "tối thiểu 1" áp SAU finalDamageMultiplier (xem resolveActionHit)
    // — mọi đòn trúng đích luôn gây ít nhất 1 sát thương.
    result.finalDamage = Math.max(1, result.finalDamage * this.finalDamageMultiplier(source, target))

    if (critical) {
      this.eventBus.emit('critical', {
        type: 'critical',

        sourceId: source.id,

        targetId: target.id,
      })
    }

    if (blocked) {
      this.eventBus.emit('block', {
        type: 'block',

        sourceId: source.id,

        targetId: target.id,
      })
    }

    this.eventBus.emit('hit', {
      type: 'hit',

      sourceId: source.id,

      targetId: target.id,
    })

    // Pháp Tu (Thổ Tu, 2026-08-15) — reset đồng hồ "chưa bị đánh" MỖI
    // LẦN thật sự trúng đòn (kể cả khi bị block/không có ward) —
    // wardRegenPerSecond chỉ hồi sau khi mốc này đủ lâu, xem
    // BattleSystem.updateRegen().
    target.timeSinceLastHitTaken = 0

    // Ward hấp thụ TRƯỚC currentHp — phần dư (nếu ward không đủ hoặc
    // không có) mới thật sự trừ máu.
    const wardAbsorbed = Math.min(target.currentWard, result.finalDamage)

    target.currentWard -= wardAbsorbed

    let hpDamage = result.finalDamage - wardAbsorbed

    // Pháp Tu Redesign (magicpath) — Mana Shield: SAU Ward, TRƯỚC HP.
    // % phần damage CÒN LẠI (không phải finalDamage gốc — Ward đã che
    // bớt trước) được đẩy sang mana, quy đổi 1:1, PHẦN MANA KHÔNG ĐỦ
    // CHE thì tràn ngược lại HP (không "ăn free" khi cạn mana, đúng
    // yêu cầu "sát thương giảm sẽ đánh đổi bằng mana").
    const manaShieldPortion = hpDamage * clampStatValue('manaShieldPercent', target.stats.manaShieldPercent)

    const manaShieldAbsorbed = Math.min(manaShieldPortion, target.currentMp)

    target.currentMp -= manaShieldAbsorbed

    hpDamage -= manaShieldAbsorbed

    this.vitals.applyHpDamageFromSnapshot(target, hpDamage, result.finalDamage, 'damage', targetBefore, source.id)

    result.wardAbsorbed = wardAbsorbed

    result.manaShieldAbsorbed = manaShieldAbsorbed

    // Nộ (rage) đã GỠ (spec 2026-08-29-kiem-the-kiem-y mục 5.4) —
    // khối tích currentRage theo damage gây/nhận dỡ sạch.

    this.eventBus.emit('damage', {
      type: 'damage',

      sourceId: source.id,

      targetId: target.id,

      value: result.finalDamage,

      damageType: result.damageType,

      critical,
    })

    // Leech — tính trên TOÀN BỘ finalDamage (không chỉ phần đã trừ
    // HP thật), quy ước ARPG chuẩn.
    if (source.stats.leechPercent > 0 && source.alive) {
      this.applyHealing(source, result.finalDamage * clampStatValue('leechPercent', source.stats.leechPercent), source.id, 'leech')
    }

    // Thorns — trừ thẳng HP nguồn, KHÔNG lặp lại pipeline (không tự
    // roll dodge/crit/thorns ngược lại) — tránh vòng lặp phản đòn vô
    // hạn giữa 2 bên đều có thorns.
    if (target.stats.thornsPercent > 0) {
      this.applyModifiedDirectDamage(source, result.finalDamage * target.stats.thornsPercent, target, 'thorns')
    }

    // Pháp Tu (Thổ Tu) — "Khiên Nổ": Ward VỪA hấp thụ xong VÀ vừa vỡ
    // hẳn (currentWard chạm 0 sau đòn này) thì phản thêm 1 cục damage
    // riêng vào NGUỒN, tỉ lệ theo wardMax (khiên càng lớn nổ càng
    // đau) — tách biệt hoàn toàn khỏi thornsPercent (đó là % theo
    // damage NHẬN vào, cái này % theo DUNG LƯỢNG khiên tối đa).
    if (wardAbsorbed > 0 && target.currentWard <= 0 && target.stats.wardBreakDamagePercent > 0) {
      this.applyModifiedDirectDamage(source, target.stats.wardMax * target.stats.wardBreakDamagePercent, target, 'ward_break')
    }

    this.killIfDead(target, source.id)

    // Thorns có thể giết ngược nguồn — kiểm tra luôn, target là "kẻ
    // giết" trong trường hợp này.
    this.killIfDead(source, target.id)

    return result
  }

  /**
   * Plans/magicpathgeneral Phase 9-12 (2026-08-21) — điểm áp dụng THẬT
   * SỰ cho 1 tick "damage-over-time-ở-1-điểm" — dùng chung bởi
   * AilmentSystem.update() (DoT gắn trên entity) VÀ BattleSystem.
   * updateLavaZones() (Lava Zone — Phase 12 nói rõ "không phải DoT
   * trên target", nhưng damage vẫn cần qua ĐÚNG pipeline DOT RES/
   * Poison Recovery/DamageEvent, chỉ khác nguồn KÍCH HOẠT tick là 1
   * VÙNG theo vị trí thay vì 1 Ailment instance). Đúng pipeline Phase
   * 10 "DoT tick → DamageEvent → sourceId/targetId/effectId → DOT RES
   * → final damage". `source` có thể undefined (nguồn đã chết/rời
   * trận) — chỉ ảnh hưởng Kim Thế xuyên kháng + Poison Recovery (2
   * hiệu ứng cần ĐỌC nguồn còn sống), DOT RES phía target vẫn áp bình
   * thường vì đó là stat của TARGET.
   */
  applyDotDamage(params: {
    sourceId: string
    source: CombatEntity | undefined
    target: CombatEntity
    rawDamage: number
    element?: ElementType | 'physical'
    effectId: string
  }) {
    const { sourceId, source, target, rawDamage, element, effectId } = params

    // Kim Tu Trúc Cơ Pure ("Kim Thế" major, Plans/KimPath mục 10) — mỗi
    // tầng currentKimThe xuyên thẳng qua dotResistancePercent của
    // target, CHỈ cho DoT element 'metal' (cùng scope
    // kimTheDotDamagePercentPerStack — build lai không nên xuyên kháng
    // DoT hành khác chỉ vì có Kim Thế).
    const penetration =
      element === 'metal' && source
        ? source.currentKimThe * getSkillRuntimeStat(source, 'kimTheDotResistancePenetrationPercentPerStack')
        : 0

    const mitigation = Math.min(DOT_RESISTANCE_CAP, Math.max(DOT_RESISTANCE_FLOOR, target.stats.dotResistancePercent - penetration))

    const finalDamage = Math.max(0, rawDamage * (1 - mitigation) * this.finalDamageMultiplier(source, target))

    this.vitals.applyDamage(target, finalDamage, 'dot', sourceId)

    this.eventBus.emit('damage', {
      type: 'damage',

      sourceId,

      targetId: target.id,

      value: finalDamage,

      damageType: 'elemental',

      effectId,
    })

    // Mộc Tu (Plans/PoisonPath/EarthPath, Phase 11) — Poison Recovery:
    // CHỈ DoT element 'wood' (Trúng Độc), hồi theo damage THẬT SỰ đã
    // trừ (sau DOT RES) — nguồn phải còn sống, người đã chết/rời trận
    // không hồi được gì.
    if (source?.alive && element === 'wood' && source.stats.poisonRecoveryPercent > 0) {
      this.applyHealing(source, finalDamage * source.stats.poisonRecoveryPercent, source.id, 'leech')
    }

    this.killIfDead(target, sourceId)
  }

  /**
   * Public — AilmentSystem (DoT tick) dùng chung để đảm bảo chết vì
   * hiệu ứng theo thời gian cũng emit đúng 'death'/'kill' như chết vì
   * đòn đánh trực tiếp, không lặp code kiểm tra HP<=0 ở 2 nơi.
   */
  killIfDead(
    entity: CombatEntity,
    killerId: string,
    skillContext?: { killer: CombatEntity; skillId: string },
  ) {
    if (entity.currentHp > 0 || !entity.alive) {
      return
    }

    // Thiên phú Bất Tử Thể (talent-direction-choice-plan §6) — đòn lẽ ra
    // chết thành sống sót HP = 1, trừ 1 lượt của trận. KHÔNG kích hoạt
    // trong trận Độ Kiếp (session null — GameManager.beginTribulation xoá).
    const surviveSession = this.surviveLethalSession

    if (
      surviveSession &&
      entity.id === surviveSession.playerEntityId &&
      surviveSession.guard.tryConsumeUse()
    ) {
      entity.currentHp = 1

      // Event vitals của đòn damage (emit TRƯỚC killIfDead) đã mang
      // killed = true vì HP chạm 0 — phát thêm event hiệu chỉnh SAU khi
      // guard giữ lượt sống sót để consumer (HUD/scene) đọc trạng thái
      // CUỐI là còn sống, không kẹt ở hình ảnh "đã chết".
      this.vitals.emitCurrent(entity, 'survive_lethal', 1, {
        hp: 0,
        ward: entity.currentWard,
        mp: entity.currentMp,
      }, killerId)

      this.eventBus.emit('talent_survive_lethal', {
        type: 'talent_survive_lethal',
        entityId: entity.id,
        sourceId: killerId,
      })

      return
    }

    entity.alive = false

    this.eventBus.emit('death', {
      type: 'death',

      sourceId: killerId,

      targetId: entity.id,
    })

    this.eventBus.emit('kill', {
      type: 'kill',

      sourceId: killerId,

      targetId: entity.id,
    })

    this.fireKillTriggers(entity, skillContext)
  }

  // Task 10 — onKill fires on the KILLER's own casting skill (known via
  // skillContext.skillId, which is always the killer's skill). Only
  // fires when the caller supplied BOTH a killer CombatEntity and a
  // skillId (see killIfDead's doc): CombatSystem has no entity registry
  // to resolve a bare killerId string into a CombatEntity, and no
  // "currently casting skill" concept on its own — callers that only
  // have a killerId (applyDirectDamage/applyModifiedDirectDamage/
  // applyDotDamage today) skip firing, same as non-skill deaths
  // (DoT ticks, thorns, ward-break).
  //
  // onDeath is intentionally NOT fired here (2026-09-01 review ruling,
  // overriding the original brief's Step 3 snippet): onDeath is meant to
  // represent "the DYING entity's OWN skill has an onDeath binding",
  // which requires enumerating the VICTIM's skills for one with an
  // onDeath trigger — but CombatSystem/SkillManager only expose lookup
  // by a single known skillId (skillManager.get(id)), not "all skills
  // belonging to entity X". skillContext.skillId is the KILLER's skill,
  // so firing onDeath against it here would attribute the trigger to the
  // wrong entity's skill. Deferred to a future task once a per-entity
  // skill-list lookup exists; OnDeathContext/the 'onDeath' TriggerType
  // (Task 1) stay declared, just unfired from this call site for now.
  //
  // buffRegistry/reactionManager are shared, non-battle-specific
  // dependencies — injected via the constructor (2026-09-01 review fix)
  // and used for real here when provided; skip firing entirely if either
  // is missing rather than constructing an empty throwaway registry
  // (BuffRegistry.get() THROWS on a miss, so an empty throwaway registry
  // would crash killIfDead() mid-battle-tick the first time a bound
  // action looked one up — not silently no-op).
  //
  // sourceBuffs/targetBuffs ARE still throwaway/stubbed (unchanged from
  // the original design): those are the per-battle BUFF POOLS for this
  // battle's specific entities (as opposed to the shared REGISTRY that
  // defines what buffs exist at all), and CombatSystem has no access to
  // BattleSystem's real per-battle pools. An onKill action that only
  // touches CombatEntity fields directly (grantResource/consumeResource)
  // works correctly through this path; an onKill action that reads/
  // writes a persistent buff POOL (as opposed to just looking up a
  // registry definition) will not see/affect the real battle-scoped pool.
  private fireKillTriggers(
    victim: CombatEntity,
    skillContext?: { killer: CombatEntity; skillId: string },
  ): void {
    if (!skillContext || !this.skillManager || !this.buffRegistry || !this.reactionManager) {
      return
    }

    const skill = this.skillManager.get(skillContext.skillId)

    if (!skill?.triggers?.length) {
      return
    }

    const ctx: SkillEffectContext = {
      combatSystem: this,
      fireHit: () => ({ landed: true }),
      buffRegistry: this.buffRegistry,
      sourceBuffs: new BuffSystem(new BuffPool()),
      targetBuffs: new BuffSystem(new BuffPool()),
      reactionManager: this.reactionManager,
    }

    this.skillTriggerRunner.fire(
      'onKill',
      { source: skillContext.killer, target: victim, skill },
      skill.triggers,
      skillContext.killer,
      victim,
      ctx,
    )
  }
}
